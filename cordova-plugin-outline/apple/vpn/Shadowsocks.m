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
#include <limits.h>
#include <pthread.h>
#if TARGET_OS_IPHONE
#import <Shadowsocks_iOS/shadowsocks.h>
#else
#import <Shadowsocks_macOS/shadowsocks.h>
#endif
#import <Tun2Socks/Tun2socks.h>

@import CocoaLumberjack;

const int kShadowsocksLocalPort = 9999;
static const int kShadowsocksTimeoutSecs = INT_MAX;
static const int kShadowsocksTcpAndUdpMode =
    1;  // See https://github.com/shadowsocks/shadowsocks-libev/blob/4ea517/src/jconf.h#L44
static char *const kShadowsocksLocalAddress = "127.0.0.1";

@interface Shadowsocks ()
@property (nonatomic) pthread_t ssLocalThreadId;
@property (nonatomic, copy) void (^startCompletion)(ErrorCode);
@property (nonatomic, copy) void (^stopCompletion)(ErrorCode);
@property(nonatomic) bool checkConnectivity;
@end

@implementation Shadowsocks

- (id) init:(NSDictionary *)config {
  self = [super init];
  if (self) {
    _config = config;
  }
  return self;
}

- (void)startWithConnectivityChecks:(bool)checkConnectivity
                         completion:(void (^)(ErrorCode))completion {
  if (self.ssLocalThreadId != 0) {
    DDLogError(@"Shadowsocks already running");
    return completion(shadowsocksStartFailure);
  }
  self.checkConnectivity = checkConnectivity;
  dispatch_async(dispatch_get_main_queue(), ^{
    // Start ss-local from the main application thread.
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
  long errorCode;
  NSError *error;
  BOOL success = ShadowsocksCheckConnectivity(self.config[@"host"], [self.config[@"port"] intValue],
                                              self.config[@"password"], self.config[@"method"],
                                              &errorCode, &error);
  DDLogInfo(@"Connectivity checks result: %ld", errorCode);
  if (!success) {
    DDLogError(@"Failed to perform connectivity checks: %@", error);
  }
  self.startCompletion(errorCode);
}

@end
