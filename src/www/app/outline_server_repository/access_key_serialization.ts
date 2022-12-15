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

import {SHADOWSOCKS_URI} from 'ShadowsocksConfig';

import * as errors from '../../model/errors';

import {ShadowsocksSessionConfig} from '../tunnel';

// DON'T use these methods outside of this folder!

// Parses an access key string into a ShadowsocksConfig object.
export function staticKeyToShadowsocksSessionConfig(staticKey: string): ShadowsocksSessionConfig {
  try {
    const config = SHADOWSOCKS_URI.parse(staticKey);
    return {
      host: config.host.data,
      port: config.port.data,
      method: config.method.data,
      password: config.password.data,
      prefix: config.extra['prefix'],
    };
  } catch (error) {
    throw new errors.ServerAccessKeyInvalid(error.message || 'Failed to parse static access key.');
  }
}

function parseShadowsocksSessionConfigJson(maybeJsonText: string): ShadowsocksSessionConfig | null {
  let sessionConfig;
  try {
    const {method, password, server: host, server_port: port, prefix} = JSON.parse(maybeJsonText);

    sessionConfig = {
      method,
      password,
      host,
      port,
      prefix,
    };
  } catch (_) {
    // It's not JSON, so return null.
    return null;
  }

  // These are the mandatory keys.
  for (const key of ['method', 'password', 'host', 'port']) {
    if (sessionConfig && !sessionConfig[key]) {
      throw new errors.ServerAccessKeyInvalid(
        `Incomplete VPN information returned from dynamic access key: missing "${key}".`
      );
    }
  }

  return sessionConfig;
}

// fetches information from a dynamic access key and attempts to parse it
// TODO(daniellacosse): unit tests
export async function fetchShadowsocksSessionConfig(configLocation: URL): Promise<ShadowsocksSessionConfig> {
  let response;
  try {
    response = await fetch(configLocation);
  } catch (error) {
    throw new errors.SessionConfigFetchFailed(
      error.message || 'Failed to fetch VPN information from dynamic access key.'
    );
  }

  const responseBody = (await response.text()).trim();

  const parseShadowsocksSessionResult = parseShadowsocksSessionConfigJson(responseBody);
  if (parseShadowsocksSessionResult) return parseShadowsocksSessionResult;

  try {
    return staticKeyToShadowsocksSessionConfig(responseBody);
  } catch (error) {
    throw new errors.ServerAccessKeyInvalid(
      error.message || 'Failed to parse VPN information from returned static access key.'
    );
  }
}
