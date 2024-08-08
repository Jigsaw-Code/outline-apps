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

const DDLogLevel ddLogLevel = DDLogLevelInfo;
NSString *const kActionStart = @"start";
NSString *const kActionRestart = @"restart";
NSString *const kActionStop = @"stop";
NSString *const kActionGetTunnelId = @"getTunnelId";
NSString *const kMessageKeyAction = @"action";
NSString *const kMessageKeyTunnelId = @"tunnelId";
NSString *const kMessageKeyConfig = @"config";
NSString *const kMessageKeyError = @"error";
NSString *const kMessageKeyHost = @"host";
NSString *const kMessageKeyPort = @"port";
NSString *const kMessageKeyOnDemand = @"is-on-demand";
NSString *const kDefaultPathKey = @"defaultPath";

@interface PacketTunnelProvider ()<Tun2socksTunWriter>
@property (nonatomic) NSString *hostNetworkAddress;  // IP address of the host in the active network.
@property id<Tun2socksTunnel> tunnel;

// result callbacks for 'start' and 'stop', accepts a nullable error string
@property (nonatomic, copy) void (^startCompletion)(NSString * _Nullable);
@property (nonatomic, copy) void (^stopCompletion)(NSString * _Nullable);

@property (nonatomic) DDFileLogger *fileLogger;
@property(nonatomic) OutlineTunnel *tunnelConfig;
@property(nonatomic) OutlineTunnelStore *tunnelStore;
@property(nonatomic) dispatch_queue_t packetQueue;
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

  _tunnelStore = [[OutlineTunnelStore alloc] initWithAppGroup:appGroup];

  _packetQueue = dispatch_queue_create("org.getoutline.packetqueue", DISPATCH_QUEUE_SERIAL);

  return self;
}

- (void)startTunnelWithOptions:(NSDictionary *)options
             completionHandler:(void (^)(NSError *))completionHandler {
  DDLogInfo(@"Starting tunnel");
  if (options == nil) {
    DDLogWarn(@"Received a connect request from preferences");
    NSString *msg = NSLocalizedStringWithDefaultValue(
        @"vpn-connect", @"Outline", [NSBundle mainBundle],
        @"Please use the Outline app to connect.",
        @"Message shown in a system dialog when the user attempts to connect from settings");
    [self displayMessage:msg
        completionHandler:^(BOOL success) {
          completionHandler([NSError errorWithDomain:NEVPNErrorDomain
                                                code:NEVPNErrorConfigurationDisabled
                                            userInfo:nil]);
          exit(0);
        }];
    return;
  }
  OutlineTunnel *tunnelConfig = [self retrieveTunnelConfig:options];
  if (tunnelConfig == nil) {
    DDLogError(@"Failed to retrieve the tunnel config.");
    completionHandler([NSError errorWithDomain:NEVPNErrorDomain
                                          code:NEVPNErrorConfigurationUnknown
                                      userInfo:nil]);
    return;
  }
  self.tunnelConfig = tunnelConfig;

  // Compute the IP address of the host in the active network.
  NSString *hostname = self.tunnelConfig.config[@"host"];
  if (hostname == nil || hostname.length == 0) {
    [self execAppCallbackForAction:kActionStart errorString:@"host is empty"];
    return completionHandler([NSError errorWithDomain:NEVPNErrorDomain
                                                 code:NEVPNErrorConfigurationInvalid
                                             userInfo:nil]);
  }
  self.hostNetworkAddress = [self getNetworkIpAddress:[hostname UTF8String]];
  if (self.hostNetworkAddress == nil) {
    [self execAppCallbackForAction:kActionStart errorString:@"Failed to resolve IP of host"];
    return completionHandler([NSError errorWithDomain:NEVPNErrorDomain
                                                 code:NEVPNErrorConfigurationReadWriteFailed
                                             userInfo:nil]);
  }
  bool isOnDemand = options[kMessageKeyOnDemand] != nil;
  // Bypass connectivity checks for auto-connect. If the tunnel configuration is no longer
  // valid, the connectivity checks will fail. The system will keep calling this method due to
  // On Demand being enabled (the VPN process does not have permission to change it), rendering the
  // network unusable with no indication to the user. By bypassing the checks, the network would
  // still be unusable, but at least the user will have a visual indication that Outline is the
  // culprit and can explicitly disconnect.
  bool supportUDP = true;
  if (!isOnDemand) {
    NSError *err = nil;
    ShadowsocksClient* client = [self getClientWithError:&err];
    if (err != nil) {
      [self execAppCallbackForAction:kActionStart errorString:err.localizedDescription];
      return completionHandler([NSError errorWithDomain:NEVPNErrorDomain
                                                   code:NEVPNErrorConfigurationInvalid
                                               userInfo:nil]);
    }

    long connStatus;
    ShadowsocksCheckConnectivity(client, &connStatus, &err);
    if (err != nil) {
      [self execAppCallbackForAction:kActionStart errorString:err.localizedDescription];
      return completionHandler([NSError errorWithDomain:NEVPNErrorDomain
                                                   code:NEVPNErrorConfigurationInvalid
                                               userInfo:nil]);
    }
    supportUDP = ((connStatus & ShadowsocksUDPConnected) == ShadowsocksUDPConnected);
  }

  [self connectTunnel:[OutlineTunnel getTunnelNetworkSettingsWithTunnelRemoteAddress:self.hostNetworkAddress]
           completion:^(NSError *_Nullable error) {
             if (error != nil) {
               [self execAppCallbackForAction:kActionStart errorString:@"VPN permission is not granted"];
               return completionHandler(error);
             }
             BOOL isUdpSupported = isOnDemand ? self.tunnelStore.isUdpSupported : supportUDP;
             [self startTun2SocksWithUDPSupported:isUdpSupported error:&error];
             if (error != nil) {
               [self execAppCallbackForAction:kActionStart errorString:error.localizedDescription];
               return completionHandler([NSError errorWithDomain:NEVPNErrorDomain
                                                            code:NEVPNErrorConnectionFailed
                                                        userInfo:nil]);
             }
             [self listenForNetworkChanges];
             [self.tunnelStore save:tunnelConfig];
             self.tunnelStore.isUdpSupported = isUdpSupported;
             self.tunnelStore.status = TunnelStatusConnected;
             [self execAppCallbackForAction:kActionStart errorString:nil];
             completionHandler(nil);
           }];
}

- (void)stopTunnelWithReason:(NEProviderStopReason)reason
           completionHandler:(void (^)(void))completionHandler {
  DDLogInfo(@"Stopping tunnel");
  self.tunnelStore.status = TunnelStatusDisconnected;
  [self stopListeningForNetworkChanges];
  [self.tunnel disconnect];
  [self cancelTunnelWithError:nil];
  [self execAppCallbackForAction:kActionStop errorString:nil];
  completionHandler();
}

// Receives messages and callbacks from the app. The callback will be executed asynchronously,
// echoing the provided data on success and nil on error.
// Expects |messageData| to be JSON encoded.
- (void)handleAppMessage:(NSData *)messageData completionHandler:(void (^)(NSData *))completionHandler {
  if (messageData == nil) {
    DDLogError(@"Received nil message from app");
    return;
  }
  NSDictionary *message = [NSJSONSerialization JSONObjectWithData:messageData options:kNilOptions error:nil];
  if (message == nil) {
    DDLogError(@"Failed to receive message from app");
    return;
  } else if (completionHandler == nil) {
    DDLogError(@"Missing message completion handler");
    return;
  }
  NSString *action = message[kMessageKeyAction];
  if (action == nil) {
    DDLogError(@"Missing action key in app message");
    return completionHandler(nil);
  }
  void (^callbackWrapper)(NSString * _Nullable) = ^void(NSString * _Nullable errMsg) {
    NSString *tunnelId = @"";
    if (self.tunnelConfig != nil) {
      tunnelId = self.tunnelConfig.id;
    }
    NSDictionary *response = @{
      kMessageKeyAction : action,
      kMessageKeyError : errMsg ?: [NSNull null],
      kMessageKeyTunnelId : tunnelId
    };
    DDLogDebug(@"Received app message: %@, response: %@", action, response);
    completionHandler([NSJSONSerialization dataWithJSONObject:response options:kNilOptions error:nil]);
  };
  if ([kActionStart isEqualToString:action] || [kActionRestart isEqualToString:action]) {
    self.startCompletion = callbackWrapper;
    if ([kActionRestart isEqualToString:action]) {
      self.tunnelConfig = [[OutlineTunnel alloc] initWithId:message[kMessageKeyTunnelId]
                                                     config:message[kMessageKeyConfig]];
      [self reconnectTunnel:true];
    }
  } else if ([kActionStop isEqualToString:action]) {
    self.stopCompletion = callbackWrapper;
  } else if ([kActionGetTunnelId isEqualToString:action]) {
    NSData *response = nil;
    if (self.tunnelConfig != nil) {
      response =
          [NSJSONSerialization dataWithJSONObject:@{kMessageKeyTunnelId : self.tunnelConfig.id}
                                          options:kNilOptions
                                            error:nil];
    }
    completionHandler(response);
  }
}

#pragma mark - Tunnel

// Creates a OutlineTunnel from options supplied in |config|, or retrieves the last working
// tunnel from disk. Normally the app provides a tunnel configuration. However, when the VPN
// is started from settings or On Demand, the system launches this process without supplying a
// configuration, so it is necessary to retrieve a previously persisted tunnel from disk.
// To learn more about On Demand see: https://help.apple.com/deployment/ios/#/iord4804b742.
- (OutlineTunnel *)retrieveTunnelConfig:(NSDictionary *)config {
  OutlineTunnel *tunnelConfig;
  if (config != nil && !config[kMessageKeyOnDemand]) {
    tunnelConfig = [[OutlineTunnel alloc] initWithId:config[kMessageKeyTunnelId] config:config];
  } else if (self.tunnelStore != nil) {
    DDLogInfo(@"Retrieving tunnelConfig from store.");
    tunnelConfig = [self.tunnelStore load];
  }
  return tunnelConfig;
}

# pragma mark - Network

- (ShadowsocksClient*) getClientWithError:(NSError * _Nullable *)err {
  ShadowsocksConfig* config = [[ShadowsocksConfig alloc] init];
  config.host = self.hostNetworkAddress;
  config.port = [self.tunnelConfig.port intValue];
  config.password = self.tunnelConfig.password;
  config.cipherName = self.tunnelConfig.method;
  config.prefix = self.tunnelConfig.prefix;

  ShadowsocksClient* client = ShadowsocksNewClient(config, err);
  if (err != nil && *err != nil) {
    DDLogError(@"Failed to construct client: %@", *err);
  }
  return client;
}

- (void)connectTunnel:(NEPacketTunnelNetworkSettings *)settings
           completion:(void (^)(NSError *))completionHandler {
  __weak PacketTunnelProvider *weakSelf = self;
  [self setTunnelNetworkSettings:settings completionHandler:^(NSError * _Nullable error) {
    if (error != nil) {
      DDLogError(@"Failed to set tunnel network settings: %@", error.localizedDescription);
    } else {
      DDLogInfo(@"Tunnel connected");
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
    DDLogDebug(@"UDP support: %d -> %d", self.tunnelStore.isUdpSupported, isUdpSupported);
    self.tunnelStore.isUdpSupported = isUdpSupported;
    [self reconnectTunnel:false];
  } else {
    DDLogInfo(@"Clearing tunnel settings.");
    [self connectTunnel:nil completion:^(NSError * _Nullable error) {
      if (error != nil) {
        DDLogError(@"Failed to clear tunnel network settings: %@", error.localizedDescription);
      } else {
        DDLogInfo(@"Tunnel settings cleared");
      }
    }];
  }
}

// Converts a struct sockaddr address |sa| to a string. Expects |maxbytes| to be allocated for |s|.
// Returns whether the operation succeeded.
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

// Calls getaddrinfo to retrieve the IP address literal as a string for |ipv4Str| in the active network.
// This is necessary to support IPv6 DNS64/NAT64 networks. For more details see:
// https://developer.apple.com/library/content/documentation/NetworkingInternetWeb/Conceptual/NetworkingOverview/UnderstandingandPreparingfortheIPv6Transition/UnderstandingandPreparingfortheIPv6Transition.html
- (NSString *)getNetworkIpAddress:(const char *)ipv4Str {
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

// Restarts tun2socks if |configChanged| or the host's IP address has changed in the network.
- (void)reconnectTunnel:(bool)configChanged {
  if (!self.tunnelConfig || !self.tunnel) {
    DDLogError(@"Failed to reconnect tunnel, missing tunnel configuration.");
    [self execAppCallbackForAction:kActionStart errorString:@"Missing tunnel configuration for reconnection"];
    return;
  }
  const char *hostAddress = (const char *)[self.tunnelConfig.config[@"host"] UTF8String];
  NSString *activeHostNetworkAddress = [self getNetworkIpAddress:hostAddress];
  if (!activeHostNetworkAddress) {
    DDLogError(@"Failed to retrieve the remote host IP address in the network");
    [self execAppCallbackForAction:kActionStart errorString:@"Failed to resolve IP of host"];
    return;
  }
  if (!configChanged && [activeHostNetworkAddress isEqualToString:self.hostNetworkAddress]) {
    // Nothing changed. Connect the tunnel with the current settings.
      [self connectTunnel:[OutlineTunnel getTunnelNetworkSettingsWithTunnelRemoteAddress:self.hostNetworkAddress]
             completion:^(NSError *_Nullable error) {
               if (error != nil) {
                 [self cancelTunnelWithError:error];
               }
             }];
    return;
  }

  DDLogInfo(@"Configuration or host IP address changed with the network. Reconnecting tunnel.");
  self.hostNetworkAddress = activeHostNetworkAddress;

  NSError *err;
  ShadowsocksClient* client = [self getClientWithError:&err];
  if (err != nil) {
    [self execAppCallbackForAction:kActionStart errorString:err.localizedDescription];
    [self cancelTunnelWithError:[NSError errorWithDomain:NEVPNErrorDomain
                                                    code:NEVPNErrorConfigurationInvalid
                                                userInfo:nil]];
    return;
  }

  long connStatus;
  ShadowsocksCheckConnectivity(client, &connStatus, &err);
  if (err != nil) {
    DDLogError(@"Connectivity checks failed. Tearing down VPN");
    [self execAppCallbackForAction:kActionStart errorString:err.localizedDescription];
    [self cancelTunnelWithError:[NSError errorWithDomain:NEVPNErrorDomain
                                                    code:NEVPNErrorConnectionFailed
                                                userInfo:nil]];
    return;
  }

  BOOL isUDPSupported = ((connStatus & ShadowsocksUDPConnected) == ShadowsocksUDPConnected);
  [self startTun2SocksWithUDPSupported:isUDPSupported error:&err];
  if (err != nil) {
    DDLogError(@"Failed to reconnect tunnel. Tearing down VPN");
    [self execAppCallbackForAction:kActionStart errorString:err.localizedDescription];
    [self cancelTunnelWithError:[NSError errorWithDomain:NEVPNErrorDomain
                                                    code:NEVPNErrorConnectionFailed
                                                userInfo:nil]];
    return;
  }

  [self connectTunnel:[OutlineTunnel getTunnelNetworkSettingsWithTunnelRemoteAddress:self.hostNetworkAddress]
           completion:^(NSError *_Nullable error) {
             if (error != nil) {
               [self execAppCallbackForAction:kActionStart errorString:error.localizedDescription];
               [self cancelTunnelWithError:error];
               return;
             }
             self.tunnelStore.isUdpSupported = isUDPSupported;
             [self.tunnelStore save:self.tunnelConfig];
             [self execAppCallbackForAction:kActionStart errorString:nil];
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

- (void)startTun2SocksWithUDPSupported:(BOOL)isUdpSupported error:(NSError * _Nullable *)err {
  BOOL isRestart = self.tunnel != nil && self.tunnel.isConnected;
  if (isRestart) {
    [self.tunnel disconnect];
  }
  __weak PacketTunnelProvider *weakSelf = self;
  ShadowsocksClient* client = [self getClientWithError:err];
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

# pragma mark - App IPC

// Executes the callback (|startCompletion| or |stopCompletion|) for the given |action|.
// Sends |errorString| (usually a JSON PlatformError) to the app to show the operation result, nil means success.
// Callbacks are only executed once to prevent a bad access exception (EXC_BAD_ACCESS).
- (void)execAppCallbackForAction:(NSString *)action errorString:(NSString * _Nullable)errMsg {
  if ([kActionStart isEqualToString:action] && self.startCompletion != nil) {
    self.startCompletion(errMsg);
    self.startCompletion = nil;
  } else if ([kActionStop isEqualToString:action] && self.stopCompletion != nil) {
    self.stopCompletion(errMsg);
    self.stopCompletion = nil;
  } else {
    DDLogWarn(@"No callback for action %@", action);
  }
}

@end
