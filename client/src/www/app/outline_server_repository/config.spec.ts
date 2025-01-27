// Copyright 2024 The Outline Authors
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

import * as config from './config';
import * as methodChannel from '../method_channel';

describe('parseAccessKey', () => {
  methodChannel.installDefaultMethodChannel({
    async invokeMethod(methodName: string, params: string): Promise<string> {
      if (!params) {
        throw Error('empty transport config');
      }
      if (params.indexOf('invalid') > -1) {
        throw Error('fake invalid config');
      }
      return `{"transport": ${JSON.stringify(params)}, "firstHop": "first-hop:4321"}`;
    },
  });

  it('extracts name from ss:// key', async () => {
    const transportConfig = `ss://${encodeURIComponent(
      btoa('chacha20-ietf-poly1305:SECRET')
    )}@example.com:4321`;
    const accessKey = `${transportConfig}#My%20Server`;
    expect(await config.parseAccessKey(accessKey)).toEqual(
      new config.StaticServiceConfig('My Server', {
        firstHop: 'first-hop:4321',
        transport: transportConfig,
      })
    );
  });

  it('extracts name from ssconf:// key', async () => {
    expect(
      await config.parseAccessKey('ssconf://example.com:4321/path#My%20Server')
    ).toEqual(
      new config.DynamicServiceConfig(
        'My Server',
        new URL('https://example.com:4321/path')
      )
    );
  });

  it('name extraction ignores parameters', async () => {
    const transportConfig = 'ss://anything';
    const accessKey = `${transportConfig}#foo=bar&My%20Server&baz=boo`;
    expect(await config.parseAccessKey(accessKey)).toEqual(
      new config.StaticServiceConfig('My Server', {
        firstHop: 'first-hop:4321',
        transport: transportConfig,
      })
    );
  });
});
