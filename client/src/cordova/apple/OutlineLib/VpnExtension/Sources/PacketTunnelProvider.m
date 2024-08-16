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
#include <arpa/inet.h>
#include <ifaddrs.h>
#include <netdb.h>

@import OutlineTunnel;
@import Tun2socks;

#ifdef DEBUG
const DDLogLevel ddLogLevel = DDLogLevelDebug;
#else
const DDLogLevel ddLogLevel = DDLogLevelInfo;
#endif

NSString *const kDefaultPathKey = @"defaultPath";

@interface PacketTunnelProvider ()<Tun2socksTunWriter>
@property (nonatomic) NSString *hostNetworkAddress;  // IP address of the host in the active network.
@property id<Tun2socksTunnel> tunnel;
@property (nonatomic) DDFileLogger *fileLogger;
@property (nonatomic, nullable) OutlineTunnel *transportConfig;
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
    self.lastErrorDescription = (err == nil ? nil : err.localizedDescription);
    completion(err);
  };

  // MARK: Process Config.
  if (self.protocolConfiguration == nil) {
    DDLogError(@"Failed to retrieve NETunnelProviderProtocol.");
    return startDone([NSError errorWithDomain:NEVPNErrorDomain
                                         code:NEVPNErrorConfigurationUnknown
                                     userInfo:@{NSLocalizedDescriptionKey:@"Unknown protocol config"}]);
  }
  NETunnelProviderProtocol *protocol = (NETunnelProviderProtocol *)self.protocolConfiguration;
  NSString *tunnelId = protocol.providerConfiguration[@"id"];
  if (![tunnelId isKindOfClass:[NSString class]]) {
      DDLogError(@"Failed to retrieve the tunnel id.");
      return startDone([NSError errorWithDomain:NEVPNErrorDomain
                                           code:NEVPNErrorConfigurationUnknown
                                       userInfo:@{NSLocalizedDescriptionKey:@"Missing tunnel ID"}]);
  }

  NSDictionary *transportConfig = protocol.providerConfiguration[@"transport"];
  if (![transportConfig isKindOfClass:[NSDictionary class]]) {
      DDLogError(@"Failed to retrieve the transport configuration.");
      return startDone([NSError errorWithDomain:NEVPNErrorDomain
                                           code:NEVPNErrorConfigurationUnknown
                                       userInfo:@{NSLocalizedDescriptionKey:@"Invalid config format"}]);
  }

  self.transportConfig = [[OutlineTunnel alloc] initWithId:tunnelId config:transportConfig];

  // Compute the IP address of the host in the active network.
  // TODO(fortuna): Stop resolving the name here and remove dependency on the host name.
  self.hostNetworkAddress =
      getNetworkIpAddress([self.transportConfig.config[@"host"] UTF8String]);
  if (self.hostNetworkAddress == nil) {
    return startDone([NSError errorWithDomain:NEVPNErrorDomain
                                         code:NEVPNErrorConfigurationReadWriteFailed
                                     userInfo:@{NSLocalizedDescriptionKey:@"getaddr failed"}]);
  }

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
  bool supportUDP = true;
  if (!isOnDemand) {
    NSError *err = nil;
    ShadowsocksClient* client = [self newClientAndReturnError:&err];
    if (err != nil) {
      return startDone(err);
    }

    long connStatus;
    ShadowsocksCheckConnectivity(client, &connStatus, &err);
    if (err != nil) {
      return startDone(err);
    }
    supportUDP = ((connStatus & ShadowsocksUDPConnected) == ShadowsocksUDPConnected);
  }

  [self startRouting:[OutlineTunnel getTunnelNetworkSettings]
          completion:^(NSError *_Nullable error) {
            if (error != nil) {
              return startDone(error);
            }
            BOOL isUdpSupported = isOnDemand ? self.isUdpSupported : supportUDP;
            [self startTun2SocksWithUDPSupported:isUdpSupported andReturnError:&error];
            if (error != nil) {
              return startDone(error);
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

- (ShadowsocksClient*) newClientAndReturnError:(NSError * _Nullable *)err {
  // TODO(fortuna): Pass transport config as an opaque string to ShadowsocksNewClient.
  ShadowsocksConfig* config = [[ShadowsocksConfig alloc] init];
  config.host = self.hostNetworkAddress;
  config.port = [self.transportConfig.port intValue];
  config.password = self.transportConfig.password;
  config.cipherName = self.transportConfig.method;
  config.prefix = self.transportConfig.prefix;

  ShadowsocksClient* client = ShadowsocksNewClient(config, err);
  if (err != nil && *err != nil) {
    DDLogError(@"Failed to construct client: %@", *err);
  }
  return client;
}

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

/** Calls getaddrinfo to retrieve the IP address literal as a string for |ipv4Str| in the active network.
 This is necessary to support IPv6 DNS64/NAT64 networks. For more details see:
 https://developer.apple.com/library/content/documentation/NetworkingInternetWeb/Conceptual/NetworkingOverview/UnderstandingandPreparingfortheIPv6Transition/UnderstandingandPreparingfortheIPv6Transition.html */
NSString* getNetworkIpAddress(const char * ipv4Str) {
  // TODO(fortuna): Move this logic to Go, so we don't depend on the host name.
  struct addrinfo *info;
  struct addrinfo hints = {
    .ai_family = PF_UNSPEC,
    .ai_socktype = SOCK_STREAM,
    .ai_flags = AI_DEFAULT
  };
  int error = getaddrinfo(ipv4Str, NULL, &hints, &info);
  if (error) {
    DDLogError(@"getaddrinfo failed: %s", gai_strerror(error));
    return NULL;
  }

  char networkAddress[INET6_ADDRSTRLEN];
  bool success = getIpAddressString(info->ai_addr, networkAddress, INET6_ADDRSTRLEN);
  freeaddrinfo(info);
  if (!success) {
    DDLogError(@"inet_ntop failed with code %d", errno);
    return NULL;
  }
  return [NSString stringWithUTF8String:networkAddress];
}

#pragma mark - tun2socks

/** Restarts tun2socks if |configChanged| or the host's IP address has changed in the network. */
- (void)reconnectTunnel {
  if (!self.transportConfig || !self.tunnel) {
    DDLogError(@"Failed to reconnect tunnel, missing tunnel configuration.");
    return;
  }
  const char *hostAddress = (const char *)[self.transportConfig.host UTF8String];
  NSString *activeHostNetworkAddress = getNetworkIpAddress(hostAddress);
  if (!activeHostNetworkAddress) {
    DDLogError(@"Failed to retrieve the remote host IP address in the network");
    return;
  }
  if ([activeHostNetworkAddress isEqualToString:self.hostNetworkAddress]) {
    // Nothing changed. Connect the tunnel with the current settings.
      [self startRouting:[OutlineTunnel getTunnelNetworkSettings]
             completion:^(NSError *_Nullable error) {
               if (error != nil) {
                 [self cancelTunnelWithError:error];
               }
             }];
    return;
  }
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

- (void)startTun2SocksWithUDPSupported:(BOOL)isUdpSupported andReturnError:(NSError * _Nullable *)err {
  BOOL isRestart = self.tunnel != nil && self.tunnel.isConnected;
  if (isRestart) {
    [self.tunnel disconnect];
  }
  __weak PacketTunnelProvider *weakSelf = self;
  ShadowsocksClient* client = [self newClientAndReturnError:err];
  if (err != nil && *err != nil) {
    DDLogError(@"Failed to get tun2socks client: %@", *err);
    return;
  }
  self.tunnel = Tun2socksConnectShadowsocksTunnel(weakSelf, client, isUdpSupported, err);
  if (err != nil && *err != nil) {
    DDLogError(@"Failed to start tun2socks: %@", *err);
    return;
  }
  if (!isRestart) {
    dispatch_async(self.packetQueue, ^{
      [weakSelf processPackets];
    });
  }
  DDLogInfo(@"tun2socks started");
}

#pragma mark - fetch last disconnect error


// TODO: Remove this code once we only support newer systems (macOS 13.0+, iOS 16.0+)

/*
   In the app, we need to use [NEVPNConnection fetchLastDisconnectErrorWithCompletionHandler] to
   retrive the most recent error that caused the VPN extension to disconnect.

   But it's only available on newer systems (macOS 13.0+, iOS 16.0+), so we need a workaround for
   older ones.

   The workaround lets the app to use [NETunnelProviderSession sendProviderMessage] to get the
   error through an IPC method.

   The extension also needs to save the last error to disk, as the system will unload the extension
   after a failed connection.

   We use [NSUserDefaults standardUserDefaults] to store the error, so it's available even after
   the extension restarts.
*/


NSString *const kFetchLastErrorRPCName = @"fetchLastDisconnectErrorDescription";
NSString *const kLastErrorPersistenceKey = @"lastDisconnectErrorDescription";

- (void)handleAppMessage:(NSData *)messageData completionHandler:(void (^)(NSData * _Nullable))completion {
  // mimics fetchLastDisconnectErrorWithCompletionHandler on older systems
  NSString *rpcName = [[NSString alloc] initWithData:messageData encoding:NSUTF8StringEncoding];
  if (![rpcName isEqualToString:kFetchLastErrorRPCName]) {
    DDLogWarn(@"Invalid Extension RPC call: %@", rpcName);
    return completion(nil);
  }
  completion([self.lastErrorDescription dataUsingEncoding:NSUTF8StringEncoding]);
}

- (NSString * _Nullable)lastErrorDescription {
  NSUserDefaults *storage = [NSUserDefaults standardUserDefaults];
  return [storage stringForKey:kLastErrorPersistenceKey];
}

- (void)setLastErrorDescription:(NSString * _Nullable)description {
  NSUserDefaults *storage = [NSUserDefaults standardUserDefaults];
  if (description == nil || description.length == 0) {
    [storage removeObjectForKey:kLastErrorPersistenceKey];
  } else {
    [storage setObject:description forKey:kLastErrorPersistenceKey];
  }
}

- (void)cancelTunnelWithError:(nullable NSError *)error {
  [super cancelTunnelWithError:error];
  self.lastErrorDescription = (error == nil ? nil : error.localizedDescription);
}

@end
