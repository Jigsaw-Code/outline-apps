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

#import "Shadowsocks.h"
#include <arpa/inet.h>
#include <limits.h>
#include <pthread.h>
#if TARGET_OS_IPHONE
#import <Shadowsocks_iOS/shadowsocks.h>
#else
#import <Shadowsocks_macOS/shadowsocks.h>
#endif

@import CocoaAsyncSocket;
@import CocoaLumberjack;

const int kShadowsocksLocalPort = 9999;
const int kShadowsocksTimeoutSecs = INT_MAX;
const int kShadowsocksTcpAndUdpMode = 1;  // See https://github.com/shadowsocks/shadowsocks-libev/blob/4ea517/src/jconf.h#L44
char *const kShadowsocksLocalAddress = "127.0.0.1";

char *const kDnsResolverAddress = "208.67.222.222";  // OpenDNS
const uint16_t kDnsResolverPort = 53;
const size_t kDnsRequestNumBytes = 28;

const size_t kSocksHeaderNumBytes = 10;
const uint8_t kSocksMethodsResponseNumBytes = 2;
const size_t kSocksConnectResponseNumBytes = 10;
const uint8_t kSocksVersion = 0x5;
const uint8_t kSocksMethodNoAuth = 0x0;
const uint8_t kSocksCmdConnect = 0x1;
const uint8_t kSocksAtypIpv4 = 0x1;
const uint8_t kSocksAtypDomainname = 0x3;

const NSTimeInterval kTcpSocketTimeoutSecs = 10.0;
const NSTimeInterval kUdpSocketTimeoutSecs = 1.0;
const long kSocketTagHttpRequest = 100;
const int kUdpForwardingMaxChecks = 5;
const uint16_t kHttpPort = 80;

@interface Shadowsocks () <GCDAsyncSocketDelegate, GCDAsyncUdpSocketDelegate>
@property (nonatomic) pthread_t ssLocalThreadId;
@property (nonatomic, copy) void (^startCompletion)(ErrorCode);
@property (nonatomic, copy) void (^stopCompletion)(ErrorCode);
@property (nonatomic) dispatch_queue_t dispatchQueue;
@property (nonatomic) dispatch_group_t dispatchGroup;
@property (nonatomic) GCDAsyncUdpSocket *udpSocket;
@property (nonatomic) GCDAsyncSocket *credentialsSocket;
@property (nonatomic) GCDAsyncSocket *reachabilitySocket;
@property (nonatomic) bool isRemoteUdpForwardingEnabled;
@property (nonatomic) bool serverCredentialsAreValid;
@property (nonatomic) bool isServerReachable;
@property (nonatomic) int udpForwardingNumChecks;
@property(nonatomic) bool checkConnectivity;
@end

@implementation Shadowsocks

- (id) init:(NSDictionary *)config {
  self = [super init];
  if (self) {
    _config = config;
    _dispatchQueue = dispatch_queue_create("Shadowsocks", NULL);
    _dispatchGroup = dispatch_group_create();

  }
  return self;
}

- (void)startWithConnectivityChecks:(bool)checkConnectivity
                         completion:(void (^)(ErrorCode))completion {
  self.checkConnectivity = checkConnectivity;
  dispatch_async(dispatch_get_main_queue(), ^{
    // Start ss-local from the main application thread.
    self.udpForwardingNumChecks = 0;
    self.startCompletion = completion;
    [self startShadowsocksThread];
  });
}

-(void)stop:(void (^)(ErrorCode))completion {
  if (self.ssLocalThreadId == 0) {
    return;
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    // The ev_loop in the ss-local thread will not break unless it is signaled to stop from the main
    // application thread.
    DDLogInfo(@"Stopping Shadowsocks");
    self.stopCompletion = completion;
    pthread_kill(self.ssLocalThreadId, SIGUSR1);
    self.ssLocalThreadId = 0;
  });
}

#pragma mark - Lifecycle

void shadowsocksCallback(int socks_fd, int udp_fd, void *udata) {
  DDLogInfo(@"Shadowsocks callback.");
  if (socks_fd <= 0 || udp_fd <= 0) {
    return;
  }
  Shadowsocks* ss = (__bridge Shadowsocks *)udata;
  [ss checkServerConnectivity];
}

- (void)startShadowsocks {
  if (self.config == nil) {
    self.startCompletion(illegalServerConfiguration);
    DDLogError(@"Failed to start ss-local, missing configuration.");
    return;
  }
  int port = [self.config[@"port"] intValue];
  char *host = (char *)[self.config[@"host"] UTF8String];
  char *password = (char *)[self.config[@"password"] UTF8String];
  char *method = (char *)[self.config[@"method"] UTF8String];
  const profile_t profile = {.remote_host = host,
                             .local_addr = kShadowsocksLocalAddress,
                             .method = method,
                             .password = password,
                             .remote_port = port,
                             .local_port = kShadowsocksLocalPort,
                             .timeout = kShadowsocksTimeoutSecs,
                             .acl = NULL,
                             .log = NULL,
                             .fast_open = 0,
                             .mode = kShadowsocksTcpAndUdpMode,
                             .verbose = 0};
  DDLogInfo(@"Starting Shadowsocks");
  int success = start_ss_local_server_with_callback(profile, shadowsocksCallback,
                                                    (__bridge void *)self);
  if (success < 0) {
    DDLogError(@"Failed to start ss-local");
    self.startCompletion(shadowsocksStartFailure);
    return;
  }
  DDLogInfo(@"Shadowsocks terminated");
  if (self.stopCompletion) {
    self.stopCompletion(noError);
    self.stopCompletion = nil;
  }
}

// Entry point for the Shadowsocks POSIX thread.
void *startShadowsocks(void *udata) {
  Shadowsocks* ss = (__bridge Shadowsocks *)udata;
  [ss startShadowsocks];
  return NULL;
}

// Starts a POSIX thread that runs ss-local.
- (void)startShadowsocksThread {
  pthread_attr_t attr;
  int err = pthread_attr_init(&attr);
  if (err) {
    DDLogError(@"pthread_attr_init failed with error %d", err);
    self.startCompletion(shadowsocksStartFailure);
    return;
  }
  err = pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
  if (err) {
    DDLogError(@"pthread_attr_setdetachstate failed with error %d", err);
    self.startCompletion(shadowsocksStartFailure);
    return;
  }
  err = pthread_create(&_ssLocalThreadId, &attr, &startShadowsocks, (__bridge void *)self);
  if (err) {
    DDLogError(@"pthread_create failed with error %d", err);
    self.startCompletion(shadowsocksStartFailure);
  }
  err = pthread_attr_destroy(&attr);
  if (err) {
    DDLogError(@"pthread_attr_destroy failed with error %d", err);
    self.startCompletion(shadowsocksStartFailure);
    return;
  }
}

#pragma mark - Connectivity

/**
 * Checks that the remote server is reachable, allows UDP forwarding, and the credentials are valid.
 * Synchronizes and parallelizes the execution of the connectivity checks and calls
 * |startCompletion| with the combined outcome.
 * Only performs the tests if |checkConnectivity| is true; otherwise calls |startCompletion|
 * with success.
 */
- (void) checkServerConnectivity {
  if (!self.checkConnectivity) {
    self.startCompletion(noError);
    return;
  }
  [self checkRemoteUdpForwardingEnabled];
  [self checkServerReachability];
  [self checkServerCredentials];
  dispatch_group_notify(self.dispatchGroup, self.dispatchQueue, ^{
    DDLogInfo(@"Server connectivity checks done");
    if (self.isRemoteUdpForwardingEnabled) {
     self.startCompletion(noError);
    } else if (self.serverCredentialsAreValid) {
     self.startCompletion(udpRelayNotEnabled);
    } else if (self.isServerReachable) {
     self.startCompletion(invalidServerCredentials);
    } else {
      self.startCompletion(serverUnreachable);
    }
  });
}

#pragma mark - UDP Forwarding

struct socks_udp_header {
  uint16_t rsv;
  uint8_t frag;
  uint8_t atyp;
  uint32_t addr;
  uint16_t port;
};

/**
 * Verifies that the server has enabled UDP forwarding. Performs an end-to-end test by sending
 * a DNS request through the proxy. This method is a superset of |checkServerCredentials|, as its
 * success implies that the server credentials are valid. Sets |isRemoteUdpForwardingEnabled| to
 * the outcome of the check.
 */
- (void)checkRemoteUdpForwardingEnabled {
  DDLogInfo(@"Starting remote UDP forwarding check.");
  dispatch_group_enter(self.dispatchGroup);
  self.isRemoteUdpForwardingEnabled = false;
  self.udpForwardingNumChecks = 0;
  self.udpSocket = [[GCDAsyncUdpSocket alloc] initWithDelegate:self delegateQueue:self.dispatchQueue];
  struct in_addr dnsResolverAddress;
  if (!inet_aton(kDnsResolverAddress, &dnsResolverAddress)) {
    DDLogError(@"Failed to convert DNS resolver IP.");
    [self onUdpForwardingResult:false];
    return;
  }
  struct socks_udp_header socksHeader = {
    .atyp = kSocksAtypIpv4,
    .addr = dnsResolverAddress.s_addr,  // Already in network order
    .port = htons(kDnsResolverPort)
  };
  uint8_t *dnsRequest = [self getDnsRequest];
  size_t packetNumBytes = kSocksHeaderNumBytes + kDnsRequestNumBytes;
  uint8_t socksPacket[packetNumBytes];
  memset(socksPacket, 0, packetNumBytes);
  memcpy(socksPacket, &socksHeader, kSocksHeaderNumBytes);
  memcpy(socksPacket + kSocksHeaderNumBytes, dnsRequest, kDnsRequestNumBytes);

  NSData* packetData = [[NSData alloc] initWithBytes:socksPacket length:packetNumBytes];

  dispatch_source_t timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, self.dispatchQueue);
  if (!timer) {
    DDLogError(@"Failed to create timer");
    [self onUdpForwardingResult:false];
    return;
  }
  dispatch_source_set_timer(timer, dispatch_time(DISPATCH_TIME_NOW, 0),
                            kUdpSocketTimeoutSecs * NSEC_PER_SEC, 0);
  __weak Shadowsocks *weakSelf = self;
  dispatch_source_set_event_handler(timer, ^{
    if (++weakSelf.udpForwardingNumChecks > kUdpForwardingMaxChecks ||
        weakSelf.isRemoteUdpForwardingEnabled) {
      dispatch_source_cancel(timer);
      if (!weakSelf.isRemoteUdpForwardingEnabled) {
        [weakSelf onUdpForwardingResult:false];
      }
      [weakSelf.udpSocket close];
      return;
    }
    DDLogInfo(@"Checking remote server's UDP forwarding (%d of %d).",
          weakSelf.udpForwardingNumChecks, kUdpForwardingMaxChecks);
    [weakSelf.udpSocket sendData:packetData
                          toHost:[[NSString alloc] initWithUTF8String:kShadowsocksLocalAddress]
                            port:kShadowsocksLocalPort
                     withTimeout:kUdpSocketTimeoutSecs
                             tag:0];
    if (![weakSelf.udpSocket receiveOnce:nil]) {
      DDLogError(@"UDP socket failed to receive data");
      [self onUdpForwardingResult:false];
      return;
    }
  });
  dispatch_resume(timer);
}

// Returns a byte representation of a DNS request for "google.com".
- (uint8_t *) getDnsRequest {
  static uint8_t kDnsRequest[] = {
    0, 0,  // [0-1]   query ID
    1, 0,  // [2-3]   flags; byte[2] = 1 for recursion desired (RD).
    0, 1,  // [4-5]   QDCOUNT (number of queries)
    0, 0,  // [6-7]   ANCOUNT (number of answers)
    0, 0,  // [8-9]   NSCOUNT (number of name server records)
    0, 0,  // [10-11] ARCOUNT (number of additional records)
    6, 'g', 'o', 'o', 'g', 'l', 'e',
    3, 'c', 'o', 'm',
    0,  // null terminator of FQDN (root TLD)
    0, 1, // QTYPE, set to A
    0, 1  // QCLASS, set to 1 = IN (Internet)
  };
  return kDnsRequest;
}

#pragma mark - GCDAsyncUdpSocketDelegate

- (void)udpSocket:(GCDAsyncUdpSocket *)sock didNotSendDataWithTag:(long)tag dueToError:(NSError *)error {
  DDLogError(@"Failed to send data on UDP socket");
}

- (void)udpSocket:(GCDAsyncUdpSocket *)sock didReceiveData:(NSData *)data
      fromAddress:(NSData *)address
withFilterContext:(id)filterContext {
  if (!self.isRemoteUdpForwardingEnabled) {
    // Only report success if it hasn't been done so already.
    [self onUdpForwardingResult:true];
  }
}

- (void)onUdpForwardingResult:(bool)enabled {
  DDLogInfo(@"Remote UDP forwarding %@.", enabled ? @"enabled" : @"disabled");
  self.isRemoteUdpForwardingEnabled = enabled;
  dispatch_group_leave(self.dispatchGroup);
}

#pragma mark - Credentials

struct socks_methods_request {
  uint8_t ver;
  uint8_t nmethods;
  uint8_t method;
};

struct socks_request_header {
  uint8_t ver;
  uint8_t cmd;
  uint8_t rsv;
  uint8_t atyp;
};

/**
 * Verifies that the server credentials are valid. Performs an end-to-end authentication test
 * by issuing an HTTP HEAD request to a target domain through the proxy.
 * Sets |serverCredentialsAreValid| to the outcome of the check.
 */
- (void)checkServerCredentials {
  DDLogInfo(@"Starting server creds. validation");
  dispatch_group_enter(self.dispatchGroup);
  self.serverCredentialsAreValid = false;
  self.credentialsSocket = [[GCDAsyncSocket alloc] initWithDelegate:self
                                                      delegateQueue:self.dispatchQueue];
  NSError* error;
  [self.credentialsSocket connectToHost:[[NSString alloc] initWithUTF8String:kShadowsocksLocalAddress]
                                 onPort:kShadowsocksLocalPort
                            withTimeout:kTcpSocketTimeoutSecs error:&error];
  if (error) {
    DDLogError(@"Unable to connect to local Shadowsocks server.");
    dispatch_group_leave(self.dispatchGroup);
    return;
  }

  struct socks_methods_request methodsRequest = {
    .ver = kSocksVersion,
    .nmethods = 0x1,
    .method = kSocksMethodNoAuth
  };
  NSData* methodsRequestData = [[NSData alloc] initWithBytes:&methodsRequest
                                                      length:sizeof(struct socks_methods_request)];
  [self.credentialsSocket writeData:methodsRequestData withTimeout:kTcpSocketTimeoutSecs tag:0];
  [self.credentialsSocket readDataToLength:kSocksMethodsResponseNumBytes
                               withTimeout:kTcpSocketTimeoutSecs tag:0];

  size_t socksRequestHeaderNumBytes = sizeof(struct socks_request_header);
  NSString *domain = [self chooseRandomDomain];
  uint8_t domainNameNumBytes = domain.length;
  size_t socksRequestNumBytes = socksRequestHeaderNumBytes + domainNameNumBytes +
      sizeof(uint16_t) /* port */ + sizeof(uint8_t) /* domain name length */;

  struct socks_request_header socksRequestHeader = {
    .ver = kSocksVersion,
    .cmd = kSocksCmdConnect,
    .atyp = kSocksAtypDomainname
  };
  uint8_t socksRequest[socksRequestNumBytes];
  memset(socksRequest, 0x0, socksRequestNumBytes);
  memcpy(socksRequest, &socksRequestHeader, socksRequestHeaderNumBytes);
  socksRequest[socksRequestHeaderNumBytes] = domainNameNumBytes;
  memcpy(socksRequest + socksRequestHeaderNumBytes + sizeof(uint8_t), [domain UTF8String],
         domainNameNumBytes);
  uint16_t httpPort = htons(kHttpPort);
  memcpy(socksRequest + socksRequestHeaderNumBytes + sizeof(uint8_t) + domainNameNumBytes,
         &httpPort, sizeof(uint16_t));

  NSData* socksRequestData = [[NSData alloc] initWithBytes:socksRequest
                                                    length:socksRequestNumBytes];
  [self.credentialsSocket writeData:socksRequestData withTimeout:kTcpSocketTimeoutSecs tag:0];
  [self.credentialsSocket readDataToLength:kSocksConnectResponseNumBytes
                               withTimeout:kTcpSocketTimeoutSecs tag:0];

  NSString* httpRequest = [[NSString alloc] initWithFormat:@"HEAD / HTTP/1.1\r\nHost: %@\r\n\r\n",
                           domain];
  [self.credentialsSocket writeData:[NSData dataWithBytes:[httpRequest UTF8String]
                                                   length:httpRequest.length]
                        withTimeout:kTcpSocketTimeoutSecs tag:kSocketTagHttpRequest];
  [self.credentialsSocket readDataWithTimeout:kTcpSocketTimeoutSecs tag:kSocketTagHttpRequest];
  [self.credentialsSocket disconnectAfterReading];
}

// Returns a statically defined array containing domain names for validating server credentials.
+ (const NSArray *)getCredentialsValidationDomains {
  static const NSArray *kCredentialsValidationDomains;
  static dispatch_once_t kDispatchOnceToken;
  dispatch_once(&kDispatchOnceToken, ^{
    // We have chosen these domains due to their neutrality.
    kCredentialsValidationDomains = @[@"eff.org", @"ietf.org", @"w3.org",
                                      @"wikipedia.org", @"example.com"];
  });
  return kCredentialsValidationDomains;
}

// Returns a random domain from |kCredentialsValidationDomains|.
- (NSString *)chooseRandomDomain {
  const NSArray *domains = [Shadowsocks getCredentialsValidationDomains];
  int index = arc4random_uniform((uint32_t)domains.count);
  return domains[index];
}

#pragma mark - Reachability

- (void)isReachable:(void (^)(ErrorCode))completion {
  [self checkServerReachability];
  dispatch_group_notify(self.dispatchGroup, self.dispatchQueue, ^{
    completion(self.isServerReachable ? noError : serverUnreachable);
  });
}

/**
 * Checks that the server is reachable on the host and port specified on |config|. Sets
 * |isServerReachable| to the outcome of the check.
 */
- (void)checkServerReachability {
  DDLogInfo(@"Starting server reachability check.");
  dispatch_group_enter(self.dispatchGroup);
  self.isServerReachable = false;
  self.reachabilitySocket = [[GCDAsyncSocket alloc] initWithDelegate:self
                                                       delegateQueue:self.dispatchQueue];
  NSString *host = self.config[@"host"];
  uint16_t port = [self.config[@"port"] intValue];
  NSError* error;
  [self.reachabilitySocket connectToHost:host
                                  onPort:port
                             withTimeout:kTcpSocketTimeoutSecs
                                   error:&error];
  if (error) {
    DDLogError(@"Unable to connect to Shadowsocks server.");
    dispatch_group_leave(self.dispatchGroup);
    return;
  }
}

#pragma mark - GCDAsyncSocketDelegate

- (void)socket:(GCDAsyncSocket *)sock didReadData:(NSData *)data withTag:(long)tag {
  // We don't need to inspect any of the data, as the SOCKS responses are hardcoded in ss-local and
  // the fact that we have read the HTTP response indicates that the server credentials are valid.
  if (tag == kSocketTagHttpRequest && data != nil) {
    NSString *httpResponse = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    self.serverCredentialsAreValid = httpResponse != nil && [httpResponse hasPrefix:@"HTTP/1.1"];
  }
}

- (void)socket:(GCDAsyncSocket *)sock didConnectToHost:(NSString *)host port:(uint16_t)port {
  if ([self.reachabilitySocket isEqual:sock]) {
    self.isServerReachable = true;
    [self.reachabilitySocket disconnect];
  }
}

- (void)socketDidDisconnect:(GCDAsyncSocket *)sock withError:(NSError *)error {
  if ([self.reachabilitySocket isEqual:sock]) {
    DDLogInfo(@"Server %@.", self.isServerReachable ? @"reachable" : @"unreachable");
  } else {
    DDLogInfo(@"Server creds. %@.",
              self.serverCredentialsAreValid ? @"succeeded" : @"failed");
  }
  dispatch_group_leave(self.dispatchGroup);
}

@end
