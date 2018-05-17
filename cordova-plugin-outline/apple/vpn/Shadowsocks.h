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

#ifndef Shadowsocks_h
#define Shadowsocks_h

#import <Foundation/Foundation.h>
#import "PacketTunnelProvider.h"

/**
 * Manages the lifecycle and configuration of ss-local, the Shadowsocks client library.
 */
@interface Shadowsocks : NSObject

extern const int kShadowsocksLocalPort;

@property (nonatomic) NSDictionary *config;

/**
 * Initializes the object with a Shadowsocks server configuration, |config|.
 */
- (id)init:(NSDictionary *)config;

/**
 * Starts ss-local on a separate thread with the configuration supplied in the constructor.
 * If |checkConnectivity| is true, verifies that the server credentials are valid and that
 * the remote supports UDP forwarding, calling |completion| with the result.
 */
- (void)startWithConnectivityChecks:(bool)checkConnectivity
                         completion:(void (^)(ErrorCode))completion;

/**
 * Stops the thread running ss-local. Calls |completion| with the success of the operation.
 */
- (void)stop:(void (^)(ErrorCode))completion;

/**
 * Determines weather the server is reachable via TCP at "host" and "port" in |config|.
 */
- (void)isReachable:(void (^)(ErrorCode))completion;

@end

#endif /* Shadowsocks_h */
