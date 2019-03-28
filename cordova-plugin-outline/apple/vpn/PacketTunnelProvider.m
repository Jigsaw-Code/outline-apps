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
#include <sys/socket.h>
#import "Shadowsocks.h"
#import "ShadowsocksConnectivity.h"
#include "VpnExtension-Swift.h"
#import <Tun2Socks/Tun2socks.h>

const DDLogLevel ddLogLevel = DDLogLevelInfo;
NSString *const kActionStart = @"start";
NSString *const kActionRestart = @"restart";
NSString *const kActionStop = @"stop";
NSString *const kActionGetConnectionId = @"getConnectionId";
NSString *const kActionIsReachable = @"isReachable";
NSString *const kMessageKeyAction = @"action";
NSString *const kMessageKeyConnectionId = @"connectionId";
NSString *const kMessageKeyConfig = @"config";
NSString *const kMessageKeyErrorCode = @"errorCode";
NSString *const kMessageKeyHost = @"host";
NSString *const kMessageKeyPort = @"port";
NSString *const kMessageKeyOnDemand = @"is-on-demand";
NSString *const kDefaultPathKey = @"defaultPath";
static NSDictionary *kVpnSubnetCandidates;  // Subnets to bind the VPN.

@interface PacketTunnelProvider ()<Tun2socksTunWriter>
@property (nonatomic) Shadowsocks *shadowsocks;
@property(nonatomic) ShadowsocksConnectivity *ssConnectivity;
@property (nonatomic) NSString *hostNetworkAddress;  // IP address of the host in the active network.
@property(nonatomic) id<Tun2socksAppleTunnel> tunnel;
@property (nonatomic, copy) void (^startCompletion)(NSNumber *);
@property (nonatomic, copy) void (^stopCompletion)(NSNumber *);
@property (nonatomic) DDFileLogger *fileLogger;
@property (nonatomic) OutlineConnection *connection;
@property (nonatomic) OutlineConnectionStore *connectionStore;
@end

@implementation PacketTunnelProvider

- (id)init {
  self = [super init];
#if TARGET_OS_IPHONE
  NSString *appGroup = @"group.org.outline.ios.client";
#else
  NSString *appGroup = @"QT8Z3Q9V3A.org.outline.macos.client";
#endif
  NSURL *containerUrl = [[NSFileManager defaultManager]
                         containerURLForSecurityApplicationGroupIdentifier:appGroup];
  NSString *logsDirectory = [[containerUrl path] stringByAppendingPathComponent:@"Logs"];
  id<DDLogFileManager> logFileManager = [[DDLogFileManagerDefault alloc]
                                         initWithLogsDirectory:logsDirectory];
  _fileLogger = [[DDFileLogger alloc] initWithLogFileManager:logFileManager];
  [DDLog addLogger:[DDASLLogger sharedInstance]];
  [DDLog addLogger:_fileLogger];

  _connectionStore = [[OutlineConnectionStore alloc] initWithAppGroup:appGroup];
  kVpnSubnetCandidates = @{
    @"10" : @"10.111.222.0",
    @"172" : @"172.16.9.1",
    @"192" : @"192.168.20.1",
    @"169" : @"169.254.19.0"
  };

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
  OutlineConnection *connection = [self retrieveConnection:options];
  if (connection == nil) {
    DDLogError(@"Failed to retrieve the connection.");
    completionHandler([NSError errorWithDomain:NEVPNErrorDomain
                                          code:NEVPNErrorConfigurationUnknown
                                      userInfo:nil]);
    return;
  }
  self.connection = connection;

  // Compute the IP address of the host in the active network.
  self.hostNetworkAddress = [self getNetworkIpAddress:[self.connection.config[@"host"] UTF8String]];
  if (self.hostNetworkAddress == nil) {
    [self execAppCallbackForAction:kActionStart errorCode:illegalServerConfiguration];
    return completionHandler([NSError errorWithDomain:NEVPNErrorDomain
                                                 code:NEVPNErrorConfigurationReadWriteFailed
                                             userInfo:nil]);
  }
  bool isOnDemand = options[kMessageKeyOnDemand] != nil;
  self.shadowsocks = [[Shadowsocks alloc] init:[self getShadowsocksNetworkConfig]];
  // Bypass connectivity checks for auto-connect. If the connection configuration is no longer
  // valid, the connectivity checks will fail. The system will keep calling this method due to
  // On Demand being enabled (the VPN process does not have permission to change it), rendering the
  // network unusable with no indication to the user. By bypassing the checks, the network would
  // still be unusable, but at least the user will have a visual indication that Outline is the
  // culprit and can explicitly disconnect.
  [self.shadowsocks
      startWithConnectivityChecks:!isOnDemand
                       completion:^(ErrorCode errorCode) {
                         ErrorCode clientErrorCode =
                             (errorCode == noError || errorCode == udpRelayNotEnabled) ? noError
                                                                                       : errorCode;
                         if (clientErrorCode == noError) {
                           [self connectTunnel:[self getTunnelNetworkSettings]
                                    completion:^(NSError *error) {
                                      if (!error) {
                                        BOOL isUdpSupported =
                                            isOnDemand ? self.connectionStore.isUdpSupported
                                                       : errorCode == noError;

                                        if (![self startTun2Socks:isUdpSupported]) {
                                          [self execAppCallbackForAction:kActionStart
                                                               errorCode:vpnStartFailure];
                                          return completionHandler([NSError
                                              errorWithDomain:NEVPNErrorDomain
                                                         code:NEVPNErrorConnectionFailed
                                                     userInfo:nil]);
                                        }
                                        [self execAppCallbackForAction:kActionStart
                                                             errorCode:noError];
                                        // Listen for network changes.
                                        [self addObserver:self
                                               forKeyPath:kDefaultPathKey
                                                  options:NSKeyValueObservingOptionOld
                                                  context:nil];

                                        [self.connectionStore save:connection];
                                        self.connectionStore.isUdpSupported = isUdpSupported;
                                        self.connectionStore.status = ConnectionStatusConnected;

                                      } else {
                                        [self execAppCallbackForAction:kActionStart
                                                             errorCode:vpnPermissionNotGranted];
                                      }
                                      completionHandler(error);
                                    }];
                         } else {
                           [self execAppCallbackForAction:kActionStart errorCode:clientErrorCode];
                           completionHandler([NSError errorWithDomain:NEVPNErrorDomain
                                                                 code:NEVPNErrorConnectionFailed
                                                             userInfo:nil]);
                         }
                       }];
}

- (void)stopTunnelWithReason:(NEProviderStopReason)reason
           completionHandler:(void (^)(void))completionHandler {
  DDLogInfo(@"Stopping tunnel");
  self.connectionStore.status = ConnectionStatusDisconnected;
  [self removeObserver:self forKeyPath:kDefaultPathKey];
  [self.tunnel disconnect];
  [self.shadowsocks stop:^(ErrorCode errorCode) {
    DDLogInfo(@"Shadowsocks stopped");
    [self cancelTunnelWithError:nil];
    [self execAppCallbackForAction:kActionStop errorCode:errorCode];
    completionHandler();
  }];
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
  DDLogInfo(@"Received app message: %@", action);
  void (^callbackWrapper)(NSNumber *) = ^void (NSNumber *errorCode) {
    NSString *connectionId;
    if (self.connection != nil) {
      connectionId = self.connection.id;
    }
    NSDictionary *response = @{kMessageKeyAction: action, kMessageKeyErrorCode: errorCode,
                               kMessageKeyConnectionId: connectionId};
    completionHandler([NSJSONSerialization dataWithJSONObject:response options:kNilOptions error:nil]);
  };
  if ([kActionStart isEqualToString:action] || [kActionRestart isEqualToString:action]) {
    self.startCompletion = callbackWrapper;
    if ([kActionRestart isEqualToString:action]) {
      self.connection = [[OutlineConnection alloc] initWithId:message[kMessageKeyConnectionId]
                                                       config:message[kMessageKeyConfig]];
      [self restartShadowsocks:true];
      [self connectTunnel:[self getTunnelNetworkSettings]
               completion:^(NSError *_Nullable error) {
                 if (error != nil) {
                   [self execAppCallbackForAction:kActionStart errorCode:vpnStartFailure];
                   [self cancelTunnelWithError:error];
                 }
               }];
    }
  } else if ([kActionStop isEqualToString:action]) {
    self.stopCompletion = callbackWrapper;
  } else if ([kActionGetConnectionId isEqualToString:action]) {
    NSData *response = nil;
    if (self.connection != nil) {
      response = [NSJSONSerialization dataWithJSONObject:@{kMessageKeyConnectionId: self.connection.id}
                                                 options:kNilOptions error:nil];
    }
    completionHandler(response);
  } else if ([kActionIsReachable isEqualToString:action]) {
    NSString *host = message[kMessageKeyHost];
    NSNumber *port = message[kMessageKeyPort];
    if (!host || !port) {
      completionHandler(nil);
      return;
    }
    // We need to allocate an instance variable for the completion block to be retained. Otherwise,
    // the completion block gets deallocated and system sends a nil response.
    self.ssConnectivity = [[ShadowsocksConnectivity alloc] initWithPort:kShadowsocksLocalPort];
    [self.ssConnectivity
        isReachable:[self getNetworkIpAddress:(const char *)[host UTF8String]]
               port:[port intValue]
         completion:^(BOOL isReachable) {
           ErrorCode errorCode = isReachable ? noError : serverUnreachable;
           NSDictionary *response = @{kMessageKeyErrorCode : [NSNumber numberWithLong:errorCode]};
           completionHandler(
               [NSJSONSerialization dataWithJSONObject:response options:kNilOptions error:nil]);
         }];
  }
}

# pragma mark - Connection

// Creates a OutlineConnection from options supplied in |config|, or retrieves the last working
// connection from disk. Normally the app provides a connection configuration. However, when the VPN
// is started from settings or On Demand, the system launches this process without supplying a
// configuration, so it is necessary to retrieve a previously persisted connection from disk.
// To learn more about On Demand see: https://help.apple.com/deployment/ios/#/iord4804b742.
- (OutlineConnection *)retrieveConnection:(NSDictionary *)config {
  OutlineConnection *connection;
  if (config != nil && !config[kMessageKeyOnDemand]) {
    connection = [[OutlineConnection alloc] initWithId:config[kMessageKeyConnectionId] config:config];
  } else if (self.connectionStore != nil) {
    DDLogInfo(@"Retrieving connection from store.");
    connection = [self.connectionStore load];
  }
  return connection;
}

# pragma mark - Network

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

- (NEPacketTunnelNetworkSettings *) getTunnelNetworkSettings {
  NSString *vpnAddress = [self selectVpnAddress];
  NEIPv4Settings *ipv4Settings =
      [[NEIPv4Settings alloc] initWithAddresses:@[ vpnAddress ] subnetMasks:@[ @"255.255.255.0" ]];
  ipv4Settings.includedRoutes = @[[NEIPv4Route defaultRoute]];
  ipv4Settings.excludedRoutes = [self getExcludedIpv4Routes];

  // Although we don't support proxying IPv6 traffic, we need to set IPv6 routes so that the DNS
  // settings are respected on IPv6-only networks. Bind to a random unique local address (ULA).
  NEIPv6Settings *ipv6Settings = [[NEIPv6Settings alloc] initWithAddresses:@[@"fd66:f83a:c650::1"]
                                                      networkPrefixLengths:@[@120]];
  ipv6Settings.includedRoutes = @[[NEIPv6Route defaultRoute]];

  // The remote address is not used for routing, but for display in Settings > VPN > Outline.
  NEPacketTunnelNetworkSettings *settings =
      [[NEPacketTunnelNetworkSettings alloc] initWithTunnelRemoteAddress:self.hostNetworkAddress];
  settings.IPv4Settings = ipv4Settings;
  settings.IPv6Settings = ipv6Settings;
  // Configure with OpenDNS and Dyn DNS resolver addresses.
  settings.DNSSettings = [[NEDNSSettings alloc] initWithServers:@[@"208.67.222.222", @"216.146.35.35",
                                                                  @"208.67.220.220", @"216.146.36.36"]];
  return settings;
}

- (NSArray *)getExcludedIpv4Routes {
  NSMutableArray *excludedIpv4Routes = [[NSMutableArray alloc] init];
  for (Subnet *subnet in [Subnet getReservedSubnets]) {
    NEIPv4Route *route =
        [[NEIPv4Route alloc] initWithDestinationAddress:subnet.address subnetMask:subnet.mask];
    [excludedIpv4Routes addObject:route];
  }
  return excludedIpv4Routes;
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
    ShadowsocksConnectivity *ssConnectivity =
        [[ShadowsocksConnectivity alloc] initWithPort:kShadowsocksLocalPort];
    [ssConnectivity isUdpForwardingEnabled:^(BOOL isUdpSupported) {
      DDLogDebug(@"UDP support: %d -> %d", self.connectionStore.isUdpSupported, isUdpSupported);
      [self setConectionUdpSupport:isUdpSupported];
    }];
    [self restartShadowsocks:false];
    [self connectTunnel:[self getTunnelNetworkSettings] completion:^(NSError * _Nullable error) {
      if (error != nil) {
        [self cancelTunnelWithError:error];
      }
    }];
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

- (NSArray *)getNetworkInterfaceAddresses {
  struct ifaddrs *interfaces = nil;
  NSMutableArray *addresses = [NSMutableArray new];
  if (getifaddrs(&interfaces) != 0) {
    DDLogError(@"Failed to retrieve network interface addresses");
    return addresses;
  }
  struct ifaddrs *interface = interfaces;
  while (interface != nil) {
    if (interface->ifa_addr->sa_family == AF_INET) {
      // Only consider IPv4 interfaces.
      NSString *address = [NSString
          stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)interface->ifa_addr)->sin_addr)];
      [addresses addObject:address];
    }
    interface = interface->ifa_next;
  }
  freeifaddrs(interfaces);

  return addresses;
}

// Selects an IPv4 address for the VPN to bind to from a pool of private subnets by checking against
// the subnets assigned to the existing network interfaces.
- (NSString *)selectVpnAddress {
  NSMutableDictionary *candidates =
      [[NSMutableDictionary alloc] initWithDictionary:kVpnSubnetCandidates];
  for (NSString *address in [self getNetworkInterfaceAddresses]) {
    for (NSString *subnetPrefix in kVpnSubnetCandidates) {
      if ([address hasPrefix:subnetPrefix]) {
        // The subnet (not necessarily the address) is in use, remove it from our list.
        [candidates removeObjectForKey:subnetPrefix];
      }
    }
  }
  if (candidates.count == 0) {
    // Even though there is an interface bound to the subnet candidates, the collision probability
    // with an actual address is low.
    return [self selectRandomValueFromDictionary:kVpnSubnetCandidates];
  }
  // Select a random subnet from the remaining candidates.
  return [self selectRandomValueFromDictionary:candidates];
}

- (id)selectRandomValueFromDictionary:(NSDictionary *)dict {
  return [dict.allValues objectAtIndex:(arc4random_uniform((uint32_t)dict.count))];
}

# pragma mark - Shadowsocks

// Restarts ss-local if |configChanged| or the host's IP address has changed in the network.
- (void)restartShadowsocks:(bool)configChanged {
  if (self.hostNetworkAddress == nil || self.connection == nil) {
    DDLogError(@"Failed to restart Shadowsocks, missing connection configuration.");
    [self execAppCallbackForAction:kActionStart errorCode:illegalServerConfiguration];
    return;
  }
  const char *hostAddress = (const char *)[self.connection.config[@"host"] UTF8String];
  NSString *activeHostNetworkAddress = [self getNetworkIpAddress:hostAddress];
  if (!activeHostNetworkAddress) {
    DDLogError(@"Failed to retrieve the remote host IP address in the network");
    [self execAppCallbackForAction:kActionStart errorCode:illegalServerConfiguration];
    return;
  }
  if (configChanged || ![activeHostNetworkAddress isEqualToString:self.hostNetworkAddress]) {
    DDLogInfo(@"Configuration or host IP address changed with the network. Restarting ss-local.");
    self.hostNetworkAddress = activeHostNetworkAddress;
    [self.shadowsocks stop:^(ErrorCode errorCode) {
      DDLogInfo(@"Shadowsocks stopped.");
      self.shadowsocks.config = [self getShadowsocksNetworkConfig];
      __weak PacketTunnelProvider *weakSelf = self;
      [self.shadowsocks
          startWithConnectivityChecks:true
                           completion:^(ErrorCode errorCode) {
                             ErrorCode clientErrorCode =
                                 errorCode == noError || errorCode == udpRelayNotEnabled
                                     ? noError
                                     : errorCode;
                             [weakSelf execAppCallbackForAction:kActionStart
                                                      errorCode:clientErrorCode];
                             if (clientErrorCode != noError) {
                               DDLogWarn(@"Tearing down VPN");
                               [self cancelTunnelWithError:
                                         [NSError errorWithDomain:NEVPNErrorDomain
                                                             code:NEVPNErrorConnectionFailed
                                                         userInfo:nil]];
                               return;
                             }
                             BOOL isUdpSupported = errorCode == noError;
                             [self setConectionUdpSupport:isUdpSupported];
                             [weakSelf.connectionStore save:self.connection];
                           }];
    }];
  }
}

- (NSDictionary *)getShadowsocksNetworkConfig {
  if (self.connection == nil) {
    DDLogError(@"Failed to retrieve configuration from nil connection");
    return nil;
  }
  NSMutableDictionary *config = [[NSMutableDictionary alloc]
                                 initWithDictionary:self.connection.config];
  config[@"host"] = self.hostNetworkAddress;
  return config;
}


# pragma mark - tun2socks

- (BOOL)close:(NSError *_Nullable *)error {
  return YES;
}

- (BOOL)write:(NSData *_Nullable)packet n:(long *)n error:(NSError *_Nullable *)error {
  [self.packetFlow writePackets:@[ packet ] withProtocols:@[ @(AF_INET) ]];
  return YES;
}

- (void)processInboundPackets {
  __weak typeof(self) weakSelf = self;
  __block long bytesWritten = 0;
  [weakSelf.packetFlow readPacketsWithCompletionHandler:^(NSArray<NSData *> *_Nonnull packets,
                                                          NSArray<NSNumber *> *_Nonnull protocols) {
    for (NSData *packet in packets) {
      [weakSelf.tunnel write:packet ret0_:&bytesWritten error:nil];
    }
    dispatch_async(dispatch_get_main_queue(), ^{
      [weakSelf processInboundPackets];
    });
  }];
}

- (BOOL)startTun2Socks:(BOOL)isUdpSupported {
  if (self.tunnel != nil && self.tunnel.isConnected) {
    [self execAppCallbackForAction:kActionStart errorCode:noError];
    return YES;  // tun2socks already running
  }
  __weak PacketTunnelProvider *weakSelf = self;
  NSError *err;
  self.tunnel = Tun2socksConnectSocksTunnel(weakSelf, @"127.0.0.1", kShadowsocksLocalPort,
                                            isUdpSupported, &err);
  if (err != nil) {
    DDLogError(@"Failed to start tun2socks: %@", err);
    return NO;
  }
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
                   [NSThread detachNewThreadSelector:@selector(processInboundPackets)
                                            toTarget:self
                                          withObject:nil];
                 });
  return YES;
}

- (void)setConectionUdpSupport:(BOOL)isUdpSupported {
  [self.tunnel setUDPEnabled:isUdpSupported];
  self.connectionStore.isUdpSupported = isUdpSupported;
}

# pragma mark - App IPC

// Executes a callback stored in |callbackMap| for the given |action|. |errorCode| is passed to the
// app to indicate the operation success.
// Callbacks are only executed once to prevent a bad access exception (EXC_BAD_ACCESS).
- (void)execAppCallbackForAction:(NSString *)action errorCode:(ErrorCode)code {
  NSNumber *errorCode = [NSNumber numberWithInt:code];
  if ([kActionStart isEqualToString:action] && self.startCompletion != nil) {
    self.startCompletion(errorCode);
    self.startCompletion = nil;
  } else if ([kActionStop isEqualToString:action] && self.stopCompletion != nil) {
    self.stopCompletion(errorCode);
    self.stopCompletion = nil;
  } else {
    DDLogWarn(@"No callback for action %@", action);
  }
}

@end
