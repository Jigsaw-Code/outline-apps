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

  it('parses websockets:// access key correctly', async () => {
    // Basic YAML config
    const yamlConfig = `
transport:
  $type: tcpudp
  tcp:
    $type: shadowsocks
    endpoint: ss.example.com:4321
    cipher: chacha20-ietf-poly1305
    secret: SECRET
    prefix: "POST "
  udp:
    $type: shadowsocks
    endpoint: ss.example.com:4321
    cipher: chacha20-ietf-poly1305
    secret: SECRET
`;
    const encodedConfig = btoa(yamlConfig);
    mockMethodChannel.invokeMethod.and.returnValue({
      client: yamlConfig,
      firstHop:
        '{"host":"ss.example.com","port":4321,"method":"chacha20-ietf-poly1305","password":"SECRET"}',
    });
    const config = await parseAccessKey(
      `websockets://${encodedConfig}#testname`
    );
    expect(config instanceof StaticServiceConfig).toBe(true);
    const staticConfig = config as StaticServiceConfig;
    expect(staticConfig.name).toEqual('testname');
    expect(staticConfig.tunnelConfig.firstHop).toEqual(
      '{"host":"ss.example.com","port":4321,"method":"chacha20-ietf-poly1305","password":"SECRET"}'
    );
    expect(staticConfig.tunnelConfig.client).toEqual(yamlConfig);
  });

  it('parses websockets:// access key with provided base64 encoded YAML correctly', async () => {
    const encodedConfig =
      'dHJhbnNwb3J0OgogICR0eXBlOiB0Y3B1ZHAKICB0Y3A6CiAgICAkdHlwZTogc2hhZG93c29ja3MKICAgIGVuZHBvaW50OgogICAgICAgICR0eXBlOiB3ZWJzb2NrZXQKICAgICAgICB1cmw6IHdzczovL2V4YW1wbGUuY29tL1NFQ1JFVF9QQVRIL3RjcAogICAgY2lwaGVyOiBjaGFjaGEyMC1pZXRmLXBvbHkxMzA1CiAgICBzZWNyZXQ6IFNTX1NFQ1JFVAogIHVkcDoKICAgICR0eXBlOiBzaGFkb3dzb2NrcwogICAgZW5kcG9pbnQ6CiAgICAgICAgJHR5cGU6IHdlYnNvY2tldAogICAgICAgIHVybDogd3NzOi8vZXhhbXBsZS5jb20vU0VDUkVUX1BBVEgvdWRwCiAgICBjaXBoZXI6IGNoYWNoYTIwLWlldGYtcG9seTEzMDUKICAgIHNlY3JldDogU1NfU0VDUkVU';
    const decodedYaml = atob(encodedConfig);
    mockMethodChannel.invokeMethod.and.returnValue({
      client: decodedYaml,
      firstHop:
        '{"host":"example.com","port":443,"method":"chacha20-ietf-poly1305","password":"SS_SECRET"}',
    });
    const config = await parseAccessKey(
      `websockets://${encodedConfig}#MyServer`
    );
    expect(config instanceof StaticServiceConfig).toBe(true);
    const staticConfig = config as StaticServiceConfig;
    expect(staticConfig.name).toEqual('MyServer');
    expect(staticConfig.tunnelConfig.firstHop).toEqual(
      '{"host":"example.com","port":443,"method":"chacha20-ietf-poly1305","password":"SS_SECRET"}'
    );
    expect(staticConfig.tunnelConfig.client).toEqual(decodedYaml);
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
