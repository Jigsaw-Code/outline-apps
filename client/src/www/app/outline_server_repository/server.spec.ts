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

import {TEST_ONLY} from './server';

describe('parseTunnelConfigJson', () => {
  it('parse correctly', () => {
    expect(
      TEST_ONLY.parseTunnelConfigJson(
        '{"server": "example.com", "server_port": 443, "method": "METHOD", "password": "PASSWORD"}'
      )
    ).toEqual({
      transport: {
        type: 'shadowsocks',
        endpoint: {
          type: 'dial',
          host: 'example.com',
          port: 443,
        },
        cipher: 'METHOD',
        secret: 'PASSWORD',
      },
    });
  });

  it('parse prefix', () => {
    expect(
      TEST_ONLY.parseTunnelConfigJson(
        '{"server": "example.com", "server_port": 443, "method": "METHOD", "password": "PASSWORD", "prefix": "POST "}'
      )
    ).toEqual({
      transport: {
        type: 'shadowsocks',
        endpoint: {
          type: 'dial',
          host: 'example.com',
          port: 443,
        },
        cipher: 'METHOD',
        secret: 'PASSWORD',
        prefix: 'POST ',
      },
    });
  });
});
