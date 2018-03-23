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

import {Server} from './server';

export class OutlineError extends Error {
  constructor(message?: string) {
    // ref:
    // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html#support-for-newtarget
    super(message);  // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this,
                          new.target.prototype);  // restore prototype chain
    this.name = new.target.name;
  }
}

export class ServerAlreadyAdded extends OutlineError {
  constructor(public readonly server: Server) {
    super();
  }
}

export class ServerIncompatible extends OutlineError {
  constructor(message: string) {
    super(message);
  }
}

export class ServerUrlInvalid extends OutlineError {
  constructor(message: string) {
    super(message);
  }
}

export class OperationTimedOut extends OutlineError {
  constructor(public readonly timeoutMs: number, public readonly operationName: string) {
    super();
  }
}

export class FeedbackSubmissionError extends OutlineError {
  constructor() {
    super();
  }
}

export class OutlinePluginError extends OutlineError {
  constructor() {
    super();
  }
}

export class UnexpectedPluginError extends OutlinePluginError {
  constructor() {
    super();
  }
}
export class VpnPermissionNotGranted extends OutlinePluginError {
  constructor() {
    super();
  }
}

export class InvalidServerCredentials extends OutlinePluginError {
  constructor(public readonly server: Server) {
    super();
  }
}

export class RemoteUdpForwardingDisabled extends OutlinePluginError {
  constructor() {
    super();
  }
}

export class ServerUnreachable extends OutlinePluginError {
  constructor(public readonly server: Server) {
    super();
  }
}

export class NetworkSystemError extends OutlinePluginError {
  constructor() {
    super();
  }
}

export class IllegalServerConfiguration extends OutlinePluginError {
  constructor(public readonly serverConfig: cordova.plugins.outline.ServerConfig) {
    super();
  }
}

export class ShadowsocksStartFailure extends OutlinePluginError {
  constructor() {
    super();
  }
}

export class HttpProxyStartFailure extends OutlinePluginError {
  constructor() {
    super();
  }
}

export class ConfigureSystemProxyFailure extends OutlinePluginError {
  constructor() {
    super();
  }
}

// For passing errors between JS and the native plugin components.
export class OutlineNativeError extends Error {
  constructor(public readonly errorCode: number) {
    super();
  }
}

// This must be kept in sync with:
//  - cordova-plugin-outline/apple/src/OutlineVpn.swift#ErrorCode
//  - cordova-plugin-outline/apple/vpn/PacketTunnelProvider.h#NS_ENUM
//  - cordova-plugin-outline/outlinePlugin.js#ERROR_CODE
export enum ErrorCode {
  NO_ERROR = 0,
  UNEXPECTED = 1,
  VPN_PERMISSION_NOT_GRANTED = 2,
  INVALID_SERVER_CREDENTIALS = 3,
  UDP_RELAY_NOT_ENABLED = 4,
  SERVER_UNREACHABLE = 5,
  VPN_START_FAILURE = 6,
  ILLEGAL_SERVER_CONFIGURATION = 7,
  SHADOWSOCKS_START_FAILURE = 8,
  HTTP_PROXY_START_FAILURE = 9,
  CONFIGURE_SYSTEM_PROXY_FAILURE = 10
}
