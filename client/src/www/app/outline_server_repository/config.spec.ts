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

describe('getAddressFromTransport', () => {
  it('extracts address', () => {
    expect(
      config.getAddressFromTransportConfig({host: 'example.com', port: '443'})
    ).toEqual('example.com:443');
    expect(
      config.getAddressFromTransportConfig({host: '1:2::3', port: '443'})
    ).toEqual('[1:2::3]:443');
    expect(config.getAddressFromTransportConfig({host: 'example.com'})).toEqual(
      'example.com'
    );
    expect(config.getAddressFromTransportConfig({host: '1:2::3'})).toEqual(
      '1:2::3'
    );
  });

  it('fails on invalid config', () => {
    expect(config.getAddressFromTransportConfig({})).toBeUndefined();
  });
});

describe('getHostFromTransport', () => {
  it('extracts host', () => {
    expect(
      config.getHostFromTransportConfig({host: 'example.com', port: '443'})
    ).toEqual('example.com');
    expect(
      config.getHostFromTransportConfig({host: '1:2::3', port: '443'})
    ).toEqual('1:2::3');
  });

  it('fails on invalid config', () => {
    expect(config.getHostFromTransportConfig({})).toBeUndefined();
  });
});

describe('setTransportHost', () => {
  it('sets host', () => {
    expect(
      JSON.stringify(
        config.setTransportConfigHost(
          {host: 'example.com', port: '443'},
          '1.2.3.4'
        )
      )
    ).toEqual('{"host":"1.2.3.4","port":"443"}');
    expect(
      JSON.stringify(
        config.setTransportConfigHost(
          {host: 'example.com', port: '443'},
          '1:2::3'
        )
      )
    ).toEqual('{"host":"1:2::3","port":"443"}');
    expect(
      JSON.stringify(
        config.setTransportConfigHost({host: '1.2.3.4', port: '443'}, '1:2::3')
      )
    ).toEqual('{"host":"1:2::3","port":"443"}');
  });

  it('fails on invalid config', () => {
    expect(config.setTransportConfigHost({}, '1:2::3')).toBeUndefined();
  });
});

describe('parseTunnelConfig', () => {
  it('parse correctly', () => {
    expect(
      config.parseTunnelConfig(
        '{"server": "example.com", "server_port": 443, "method": "METHOD", "password": "PASSWORD"}'
      )
    ).toEqual({
      transport: {
        host: 'example.com',
        port: 443,
        method: 'METHOD',
        password: 'PASSWORD',
      },
    });
  });

  it('parse prefix', () => {
    expect(
      config.parseTunnelConfig(
        '{"server": "example.com", "server_port": 443, "method": "METHOD", "password": "PASSWORD", "prefix": "POST "}'
      )
    ).toEqual({
      transport: {
        host: 'example.com',
        port: 443,
        method: 'METHOD',
        password: 'PASSWORD',
        prefix: 'POST ',
      },
    });
  });

  it('parse URL', () => {
    const ssUrl = SIP002_URI.stringify(
      makeConfig({
        host: 'example.com',
        port: 443,
        method: 'chacha20-ietf-poly1305',
        password: 'PASSWORD',
      })
    );
    expect(config.parseTunnelConfig(ssUrl)).toEqual({
      transport: {
        host: 'example.com',
        port: 443,
        method: 'chacha20-ietf-poly1305',
        password: 'PASSWORD',
      },
    });
  });
});
