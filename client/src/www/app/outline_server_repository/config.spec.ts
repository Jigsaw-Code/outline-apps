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

import {makeConfig, SIP002_URI} from 'ShadowsocksConfig';

import * as config from './config';

describe('parseTunnelConfig', () => {
  it('parses correctly', async () => {
    expect(
      await config.parseTunnelConfig(
        '{"server": "example.com", "server_port": 443, "method": "METHOD", "password": "PASSWORD"}'
      )
    ).toEqual({
      firstHop: 'example.com:443',
      transport:
        '{"host":"example.com","port":443,"method":"METHOD","password":"PASSWORD"}',
    });
  });

  it('parses prefix', async () => {
    expect(
      await config.parseTunnelConfig(
        '{"server": "example.com", "server_port": 443, "method": "METHOD", "password": "PASSWORD", "prefix": "POST "}'
      )
    ).toEqual({
      firstHop: 'example.com:443',
      transport:
        '{"host":"example.com","port":443,"method":"METHOD","password":"PASSWORD","prefix":"POST "}',
    });
  });

  it('parses URL', async () => {
    const ssUrl = SIP002_URI.stringify(
      makeConfig({
        host: 'example.com',
        port: 443,
        method: 'chacha20-ietf-poly1305',
        password: 'PASSWORD',
      })
    );
    expect(await config.parseTunnelConfig(ssUrl)).toEqual({
      firstHop: 'example.com:443',
      transport:
        '{"host":"example.com","port":443,"method":"chacha20-ietf-poly1305","password":"PASSWORD"}',
    });
  });

  it('parses URL with blanks', async () => {
    const ssUrl = SIP002_URI.stringify(
      makeConfig({
        host: 'example.com',
        port: 443,
        method: 'chacha20-ietf-poly1305',
        password: 'PASSWORD',
      })
    );
    expect(await config.parseTunnelConfig(`  ${ssUrl} \n\n\n`)).toEqual({
      firstHop: 'example.com:443',
      transport:
        '{"host":"example.com","port":443,"method":"chacha20-ietf-poly1305","password":"PASSWORD"}',
    });
  });
});

describe('serviceNameFromAccessKey', () => {
  it('extracts name from ss:// key', () => {
    expect(
      config.TEST_ONLY.serviceNameFromAccessKey(
        new URL('ss://anything#My%20Server')
      )
    ).toEqual('My Server');
  });
  it('extracts name from ssconf:// key', () => {
    expect(
      config.TEST_ONLY.serviceNameFromAccessKey(
        new URL('ssconf://anything#My%20Server')
      )
    ).toEqual('My Server');
  });
  it('ignores parameters', () => {
    expect(
      config.TEST_ONLY.serviceNameFromAccessKey(
        new URL('ss://anything#foo=bar&My%20Server&baz=boo')
      )
    ).toEqual('My Server');
  });
});
