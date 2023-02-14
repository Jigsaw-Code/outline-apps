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
import {Result} from 'src/infrastructure/result';

import {ShadowsocksSessionErrorCodes} from '../../model/v2_errors';

import {ShadowsocksSessionConfig} from '../tunnel';

export class ShadowsocksSessionConfigResult extends Result<ShadowsocksSessionConfig, ShadowsocksSessionErrorCodes> {}

// DON'T use these methods outside of this folder!

// Parses an access key string into a ShadowsocksConfig object.
export function staticKeyToShadowsocksSessionConfig(staticKey: string): ShadowsocksSessionConfigResult {
  const result = new ShadowsocksSessionConfigResult();

  try {
    const config = SHADOWSOCKS_URI.parse(staticKey);

    result.value = {
      host: config.host.data,
      port: config.port.data,
      method: config.method.data,
      password: config.password.data,
      prefix: config.extra['prefix'],
    };
  } catch (error) {
    result.addError(ShadowsocksSessionErrorCodes.KEY_PARSE_FAILURE);
  }

  return result;
}

function parseShadowsocksSessionConfigJson(maybeJsonText: string): ShadowsocksSessionConfigResult {
  const result = new ShadowsocksSessionConfigResult();

  try {
    const {method, password, server: host, server_port: port, prefix} = JSON.parse(maybeJsonText);

    result.value = {
      method,
      password,
      host,
      port,
      prefix,
    };
  } catch (_) {
    result.addError(ShadowsocksSessionErrorCodes.JSON_PARSE_FAILURE);

    return result;
  }

  if (!result.value.method) {
    result.addError(ShadowsocksSessionErrorCodes.MISSING_METHOD);
  }

  if (!result.value.password) {
    result.addError(ShadowsocksSessionErrorCodes.MISSING_PASSWORD);
  }

  if (!result.value.host) {
    result.addError(ShadowsocksSessionErrorCodes.MISSING_HOST);
  }

  if (!result.value.port) {
    result.addError(ShadowsocksSessionErrorCodes.MISSING_PORT);
  }

  return result;
}

// fetches information from a dynamic access key and attempts to parse it
// TODO(daniellacosse): unit tests
export async function fetchShadowsocksSessionConfig(configLocation: URL): Promise<ShadowsocksSessionConfigResult> {
  const result: ShadowsocksSessionConfigResult = new ShadowsocksSessionConfigResult();

  let response;
  try {
    response = await fetch(configLocation);
  } catch (error) {
    result.addError(ShadowsocksSessionErrorCodes.DYNAMIC_FETCH_FAILURE);

    return result;
  }

  const responseBody = (await response.text()).trim();
  const parseShadowsocksSessionResult = parseShadowsocksSessionConfigJson(responseBody);

  if (parseShadowsocksSessionResult.value) {
    return parseShadowsocksSessionResult;
  }

  // assume it's a static key instead
  return staticKeyToShadowsocksSessionConfig(responseBody);
}
