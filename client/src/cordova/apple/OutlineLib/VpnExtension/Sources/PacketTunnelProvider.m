// Copyright 2018 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#import "PacketTunnelProvider.h"
#import "VpnExtension-Swift.h"

#include <arpa/inet.h>
#include <ifaddrs.h>
#include <netdb.h>

@import Tun2socks;

#ifdef DEBUG
const DDLogLevel ddLogLevel = DDLogLevelDebug;
#else
const DDLogLevel ddLogLevel = DDLogLevelInfo;
#endif

NSString *const kDefaultPathKey = @"defaultPath";

@interface PacketTunnelProvider ()<Tun2socksTunWriter>
@property id<Tun2socksTunnel> tunnel;
@property (nonatomic, copy) void (^startCompletion)(NSNumber *);
@property (nonatomic, copy) void (^stopCompletion)(NSNumber *);
@property (nonatomic) DDFileLogger *fileLogger;
@property (nonatomic, nullable) NSString *transportConfig;
@property (nonatomic) dispatch_queue_t packetQueue;
@property (nonatomic) BOOL isUdpSupported;
@end

@implementation PacketTunnelProvider

- (id)init {
  self = [super init];
  NSString *appGroup = @"group.org.getoutline.client";
  NSURL *containerUrl = [[NSFileManager defaultManager]
                         containerURLForSecurityApplicationGroupIdentifier:appGroup];
  NSString *logsDirectory = [[containerUrl path] stringByAppendingPathComponent:@"Logs"];
  id<DDLogFileManager> logFileManager = [[DDLogFileManagerDefault alloc]
                                         initWithLogsDirectory:logsDirectory];
  _fileLogger = [[DDFileLogger alloc] initWithLogFileManager:logFileManager];
  [DDLog addLogger:[DDOSLogger sharedInstance]];
  [DDLog addLogger:_fileLogger];

  _packetQueue = dispatch_queue_create("org.getoutline.packetqueue", DISPATCH_QUEUE_SERIAL);

  return self;
}

- (void)startTunnelWithOptions:(NSDictionary *)options
             completionHandler:(void (^)(NSError *))completion {
  DDLogInfo(@"Starting tunnel");
  DDLogDebug(@"Options are %@", options);

  // mimics fetchLastDisconnectErrorWithCompletionHandler on older systems
  void (^startDone)(NSError *) = ^(NSError *err) {
    [SwiftBridge saveLastErrorWithNsError:err];
    completion(err);
  };

  // MARK: Process Config.
  if (self.protocolConfiguration == nil) {
    DDLogError(@"Failed to retrieve NETunnelProviderProtocol.");
    return startDone([SwiftBridge newIllegalConfigOutlineErrorWithMessage:@"no config specified"]);
  }
  NETunnelProviderProtocol *protocol = (NETunnelProviderProtocol *)self.protocolConfiguration;
  NSString *tunnelId = protocol.providerConfiguration[@"id"];
  if (![tunnelId isKindOfClass:[NSString class]]) {
    DDLogError(@"Failed to retrieve the tunnel id.");
    return startDone([SwiftBridge newInternalOutlineErrorWithMessage:@"no tunnal ID specified"]);
  }

  NSString *transportConfig = protocol.providerConfiguration[@"transport"];
  if (![transportConfig isKindOfClass:[NSString class]]) {
    DDLogError(@"Failed to retrieve the transport configuration.");
    return startDone([SwiftBridge newIllegalConfigOutlineErrorWithMessage:@"config is not a String"]);
  }
  self.transportConfig = transportConfig;

  // startTunnel has 3 cases:
  // - When started from the app, we get options != nil, with no ["is-on-demand"] entry.
  // - When started on-demand, we get option != nil, with ["is-on-demand"] = 1;.
  // - When started from the VPN settings, we get options == nil
  NSNumber *isOnDemandNumber = options == nil ? nil : options[@"is-on-demand"];
  bool isOnDemand = isOnDemandNumber != nil && [isOnDemandNumber intValue] == 1;
  DDLogDebug(@"isOnDemand is %d", isOnDemand);

  // Bypass connectivity checks for auto-connect. If the tunnel configuration is no longer
  // valid, the connectivity checks will fail. The system will keep calling this method due to
  // On Demand being enabled (the VPN process does not have permission to change it), rendering the
  // network unusable with no indication to the user. By bypassing the checks, the network would
  // still be unusable, but at least the user will have a visual indication that Outline is the
  // culprit and can explicitly disconnect.
  PlaterrorsPlatformError *udpConnectionError = nil;
  if (!isOnDemand) {
    OutlineNewClientResult* clientResult = [SwiftBridge newClientWithTransportConfig:self.transportConfig];
    if (clientResult.error != nil) {
      return startDone([SwiftBridge newOutlineErrorFromPlatformError:clientResult.error]);
    }
    OutlineTCPAndUDPConnectivityResult *connResult = OutlineCheckTCPAndUDPConnectivity(clientResult.client);
    DDLogDebug(@"Check connectivity result: tcpErr=%@, udpErr=%@", connResult.tcpError, connResult.udpError);
    if (connResult.tcpError != nil) {
      return startDone([SwiftBridge newOutlineErrorFromPlatformError:connResult.tcpError]);
    }
    udpConnectionError = connResult.udpError;
  }

  [self startRouting:[SwiftBridge getTunnelNetworkSettings]
          completion:^(NSError *_Nullable error) {
            if (error != nil) {
              return startDone([SwiftBridge newOutlineErrorFromNsError:error]);
            }
            BOOL isUdpSupported =
                isOnDemand ? self.isUdpSupported : udpConnectionError == nil;
            PlaterrorsPlatformError *tun2socksError = [self startTun2Socks:isUdpSupported];
            if (tun2socksError != nil) {
              return startDone([SwiftBridge newOutlineErrorFromPlatformError:tun2socksError]);
            }
            [self listenForNetworkChanges];
            startDone(nil);
          }];
}

- (void)stopTunnelWithReason:(NEProviderStopReason)reason
           completionHandler:(void (^)(void))completionHandler {
  DDLogInfo(@"Stopping tunnel, reason: %ld", (long)reason);
  // Check for NEProviderStopReasonUserInitiated
  [self stopListeningForNetworkChanges];
  [self.tunnel disconnect];
  [self cancelTunnelWithError:nil];
  completionHandler();
}

# pragma mark - Network

- (void)startRouting:(NEPacketTunnelNetworkSettings *)settings
           completion:(void (^)(NSError *))completionHandler {
  __weak PacketTunnelProvider *weakSelf = self;
  [self setTunnelNetworkSettings:settings completionHandler:^(NSError * _Nullable error) {
    if (error != nil) {
      DDLogError(@"Failed to start routing: %@", error.localizedDescription);
    } else {
      DDLogInfo(@"Routing started");
      // Passing nil settings clears the tunnel network configuration. Indicate to the system that
      // the tunnel is being re-established if this is the case.
      weakSelf.reasserting = settings == nil;
    }
    completionHandler(error);
  }];
}

// Registers KVO for the `defaultPath` property to receive network connectivity changes.
- (void)listenForNetworkChanges {
  [self stopListeningForNetworkChanges];
  [self addObserver:self
         forKeyPath:kDefaultPathKey
            options:NSKeyValueObservingOptionOld
            context:nil];
}

// Unregisters KVO for `defaultPath`.
- (void)stopListeningForNetworkChanges {
  @try {
    [self removeObserver:self forKeyPath:kDefaultPathKey];
  } @catch (id exception) {
    // Observer not registered, ignore.
  }
}

- (void)observeValueForKeyPath:(nullable NSString *)keyPath
                      ofObject:(nullable id)object
                        change:(nullable NSDictionary<NSString *, id> *)change
                       context:(nullable void *)context {
  if (![kDefaultPathKey isEqualToString:keyPath]) {
    return;
  }
  // Since iOS 11, we have observed that this KVO event fires repeatedly when connecting over Wifi,
  // even though the underlying network has not changed (i.e. `isEqualToPath` returns false),
  // leading to "wakeup crashes" due to excessive network activity. Guard against false positives by
  // comparing the paths' string description, which includes properties not exposed by the class.
  NWPath *lastPath = change[NSKeyValueChangeOldKey];
  if (lastPath == nil || [lastPath isEqualToPath:self.defaultPath] ||
      [lastPath.description isEqualToString:self.defaultPath.description]) {
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [self handleNetworkChange:self.defaultPath];
  });
}

- (void)handleNetworkChange:(NWPath *)newDefaultPath {
  DDLogInfo(@"Network connectivity changed");
  if (newDefaultPath.status == NWPathStatusSatisfied) {
    DDLogInfo(@"Reconnecting tunnel.");
    // Check whether UDP support has changed with the network.
    BOOL isUdpSupported = [self.tunnel updateUDPSupport];
    DDLogDebug(@"UDP support: %d -> %d", self.isUdpSupported, isUdpSupported);
    self.isUdpSupported = isUdpSupported;
    [self reconnectTunnel];
  } else {
    DDLogInfo(@"Clearing tunnel settings.");
    [self startRouting:nil completion:^(NSError * _Nullable error) {
      if (error != nil) {
        DDLogError(@"Failed to clear tunnel network settings: %@", error.localizedDescription);
      } else {
        DDLogInfo(@"Tunnel settings cleared");
      }
    }];
  }
}

/**
 Converts a struct sockaddr address |sa| to a string. Expects |maxbytes| to be allocated for |s|.
 @return whether the operation succeeded.
*/
bool getIpAddressString(const struct sockaddr *sa, char *s, socklen_t maxbytes) {
  if (!sa || !s) {
    DDLogError(@"Failed to get IP address string: invalid argument");
    return false;
  }
  switch (sa->sa_family) {
    case AF_INET:
      inet_ntop(AF_INET, &(((struct sockaddr_in *)sa)->sin_addr), s, maxbytes);
      break;
    case AF_INET6:
      inet_ntop(AF_INET6, &(((struct sockaddr_in6 *)sa)->sin6_addr), s, maxbytes);
      break;
    default:
      DDLogError(@"Cannot get IP address string: unknown address family");
      return false;
  }
  return true;
}

#pragma mark - tun2socks

/** Restarts tun2socks if |configChanged| or the host's IP address has changed in the network. */
- (void)reconnectTunnel {
  if (!self.transportConfig || !self.tunnel) {
    DDLogError(@"Failed to reconnect tunnel, missing tunnel configuration.");
    return;
  }
  // Nothing changed. Connect the tunnel with the current settings.
  [self startRouting:[SwiftBridge getTunnelNetworkSettings]
         completion:^(NSError *_Nullable error) {
           if (error != nil) {
             [self cancelTunnelWithError:error];
           }
         }];
}

- (BOOL)close:(NSError *_Nullable *)error {
  return YES;
}

- (BOOL)write:(NSData *_Nullable)packet n:(long *)n error:(NSError *_Nullable *)error {
  [self.packetFlow writePackets:@[ packet ] withProtocols:@[ @(AF_INET) ]];
  return YES;
}

// Writes packets from the VPN to the tunnel.
- (void)processPackets {
  __weak typeof(self) weakSelf = self;
  __block long bytesWritten = 0;
  [weakSelf.packetFlow readPacketsWithCompletionHandler:^(NSArray<NSData *> *_Nonnull packets,
                                                          NSArray<NSNumber *> *_Nonnull protocols) {
    for (NSData *packet in packets) {
      [weakSelf.tunnel write:packet ret0_:&bytesWritten error:nil];
    }
    dispatch_async(weakSelf.packetQueue, ^{
      [weakSelf processPackets];
    });
  }];
}

- (PlaterrorsPlatformError*)startTun2Socks:(BOOL)isUdpSupported {
  BOOL isRestart = self.tunnel != nil && self.tunnel.isConnected;
  if (isRestart) {
    [self.tunnel disconnect];
  }
  __weak PacketTunnelProvider *weakSelf = self;
  OutlineNewClientResult* clientResult = [SwiftBridge newClientWithTransportConfig:self.transportConfig];
  if (clientResult.error != nil) {
    return clientResult.error;
  }
  Tun2socksConnectOutlineTunnelResult *result =
    Tun2socksConnectOutlineTunnel(weakSelf, clientResult.client, isUdpSupported);
  if (result.error != nil) {
    DDLogError(@"Failed to start tun2socks: %@", result.error);
    return result.error;
  }
  self.tunnel = result.tunnel;
  if (!isRestart) {
    dispatch_async(self.packetQueue, ^{
      [weakSelf processPackets];
    });
  }
  return nil;
}

#pragma mark - fetch last disconnect error

// TODO: Remove this code once we only support newer systems (macOS 13.0+, iOS 16.0+)

NSString *const kFetchLastErrorIPCName = @"fetchLastDisconnectDetailedJsonError";

- (void)handleAppMessage:(NSData *)messageData completionHandler:(void (^)(NSData * _Nullable))completion {
  // mimics fetchLastDisconnectErrorWithCompletionHandler on older systems
  NSString *ipcName = [[NSString alloc] initWithData:messageData encoding:NSUTF8StringEncoding];
  if (![ipcName isEqualToString:kFetchLastErrorIPCName]) {
    DDLogWarn(@"Invalid Extension IPC call: %@", ipcName);
    return completion(nil);
  }
  completion([SwiftBridge loadLastErrorToIPCResponse]);
}

- (void)cancelTunnelWithError:(nullable NSError *)error {
  [SwiftBridge saveLastErrorWithNsError:error];
  [super cancelTunnelWithError:error];
}

@end
