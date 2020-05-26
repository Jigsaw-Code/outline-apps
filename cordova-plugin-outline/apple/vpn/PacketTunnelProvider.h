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

#ifndef PacketTunnelProvider_h
#define PacketTunnelProvider_h

@import NetworkExtension;
@import CocoaLumberjack;

extern const DDLogLevel ddLogLevel;

@interface PacketTunnelProvider : NEPacketTunnelProvider

// This must be kept in sync with:
//  - cordova-plugin-outline/apple/src/OutlineVpn.swift#ErrorCode
//  - cordova-plugin-outline/outlinePlugin.js#ERROR_CODE
//  - www/model/errors.ts
typedef NS_ENUM(NSInteger, ErrorCode) {
  noError = 0,
  undefinedError = 1,
  vpnPermissionNotGranted = 2,
  invalidServerCredentials = 3,
  udpRelayNotEnabled = 4,
  serverUnreachable = 5,
  vpnStartFailure = 6,
  illegalServerConfiguration = 7,
  shadowsocksStartFailure = 8,
  configureSystemProxyFailure = 9,
  noAdminPermissions = 10,
  unsupportedRoutingTable = 11,
  systemMisconfigured = 12
};

@end

#endif /* PacketTunnelProvider_h */
