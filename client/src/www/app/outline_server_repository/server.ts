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

import {Localizer} from '@outline/infrastructure/i18n';
import * as net from '@outline/infrastructure/net';

import {staticKeyToTunnelConfig} from './access_key';
import {TunnelConfigJson, TransportConfigJson, getAddressFromTransportConfig} from './config';
import {VpnApi, StartRequestJson} from './vpn';
import * as errors from '../../model/errors';
import {PlatformError} from '../../model/platform_error';
import {Server, ServerType} from '../../model/server';

export const TEST_ONLY = {parseTunnelConfigJson};

// PLEASE DON'T use this class outside of this `outline_server_repository` folder!

export class OutlineServer implements Server {
  errorMessageId?: string;
  readonly tunnelConfigLocation: URL;
  private _address: string;
  private readonly staticTunnelConfig?: TunnelConfigJson;

  constructor(
    private vpnApi: VpnApi,
    readonly id: string,
    public name: string,
    readonly accessKey: string,
    readonly type: ServerType,
    localize: Localizer
  ) {
    switch (this.type) {
      case ServerType.DYNAMIC_CONNECTION:
        this.tunnelConfigLocation = new URL(
          accessKey.replace(/^ssconf:\/\//, 'https://')
        );
        this._address = '';

        if (!name) {
          this.name =
            this.tunnelConfigLocation.port === '443'
              ? this.tunnelConfigLocation.hostname
              : net.joinHostPort(
                  this.tunnelConfigLocation.hostname,
                  this.tunnelConfigLocation.port
                );
        }
        break;

      case ServerType.STATIC_CONNECTION:
      default:
        this.staticTunnelConfig = staticKeyToTunnelConfig(accessKey);
        this._address = getAddressFromTransportConfig(
          this.staticTunnelConfig.transport
        );

        if (!name) {
          this.name = localize(
            accessKey.includes('outline=1')
              ? 'server-default-name-outline'
              : 'server-default-name'
          );
        }
        break;
    }
  }

  get address() {
    return this._address;
  }

  async connect() {
    let tunnelConfig: TunnelConfigJson;
    if (this.type === ServerType.DYNAMIC_CONNECTION) {
      tunnelConfig = await fetchTunnelConfig(this.tunnelConfigLocation);
      this._address = getAddressFromTransportConfig(tunnelConfig.transport);
    } else {
      tunnelConfig = this.staticTunnelConfig;
    }

    try {
      const request: StartRequestJson = {
        id: this.id,
        name: this.name,
        config: tunnelConfig,
      };
      await this.vpnApi.start(request);
    } catch (cause) {
      // TODO(junyi): Remove the catch above once all platforms are migrated to PlatformError
      if (cause instanceof PlatformError) {
        throw cause;
      }

      // e originates in "native" code: either Cordova or Electron's main process.
      // Because of this, we cannot assume "instanceof OutlinePluginError" will work.
      if (cause.errorCode) {
        throw errors.fromErrorCode(cause.errorCode);
      }

      throw new errors.ProxyConnectionFailure(
        `Failed to connect to server ${this.name}.`,
        {cause}
      );
    }
  }

  async disconnect() {
    try {
      await this.vpnApi.stop(this.id);

      if (this.type === ServerType.DYNAMIC_CONNECTION) {
        this._address = '';
      }
    } catch (e) {
      // All the plugins treat disconnection errors as ErrorCode.UNEXPECTED.
      throw new errors.RegularNativeError();
    }
  }

  checkRunning(): Promise<boolean> {
    return this.vpnApi.isRunning(this.id);
  }
}

function parseTunnelConfigJson(responseBody: string): TunnelConfigJson | null {
  const responseJson = JSON.parse(responseBody);

  if ('error' in responseJson) {
    throw new errors.SessionProviderError(
      responseJson.error.message,
      responseJson.error.details
    );
  }

  const transport: TransportConfigJson = {
    type: 'shadowsocks',
    endpoint: {
      type: 'dial',
      host: responseJson.server,
      port: responseJson.server_port, 
    },
    cipher: responseJson.method,
    secret: responseJson.password,
  };
  if (responseJson.prefix) {
    transport.prefix = responseJson.prefix;
  }
  return {
    transport,
  };
}

/** fetchTunnelConfig fetches information from a dynamic access key and attempts to parse it. */
// TODO(daniellacosse): unit tests
export async function fetchTunnelConfig(
  configLocation: URL
): Promise<TunnelConfigJson> {
  let response;
  try {
    response = await fetch(configLocation, {
      cache: 'no-store',
      redirect: 'follow',
    });
  } catch (cause) {
    throw new errors.SessionConfigFetchFailed(
      'Failed to fetch VPN information from dynamic access key.',
      {cause}
    );
  }

  const responseBody = (await response.text()).trim();
  if (!responseBody) {
    throw new errors.ServerAccessKeyInvalid(
      'Got empty config from dynamic key.'
    );
  }
  try {
    if (responseBody.startsWith('ss://')) {
      return staticKeyToTunnelConfig(responseBody);
    }

    return parseTunnelConfigJson(responseBody);
  } catch (cause) {
    if (cause instanceof errors.SessionProviderError) {
      throw cause;
    }

    throw new errors.ServerAccessKeyInvalid(
      'Failed to parse VPN information fetched from dynamic access key.',
      {cause}
    );
  }
}
