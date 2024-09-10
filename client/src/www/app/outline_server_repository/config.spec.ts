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

describe('newTunnelJson', () => {
  it('parses dynamic key', () => {
    expect(
      config.newTunnelJson({
        server: 'example.com',
        server_port: 443,
        method: 'METHOD',
        password: 'PASSWORD',
      })
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
    } as config.TunnelConfigJson);
  });

  it('parses prefix', () => {
    expect(
      config.newTunnelJson({
        server: 'example.com',
        server_port: 443,
        method: 'METHOD',
        password: 'PASSWORD',
        prefix: '\x03\x02\x03',
      })
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
        prefix: '\x03\x02\x03',
      },
    } as config.TunnelConfigJson);
  });

  it('fails on missing server', () => {
    expect(() => {
      config.newTunnelJson({
        server_port: 443,
        method: 'METHOD',
        password: 'PASSWORD',
      });
    }).toThrow();
  });

  it('fails on missing port', () => {
    expect(() => {
      config.newTunnelJson({
        server: 'example.com',
        method: 'METHOD',
        password: 'PASSWORD',
      });
    }).toThrow();
  });

  it('fails on missing method', () => {
    expect(() => {
      config.newTunnelJson({
        server: 'example.com',
        server_port: 443,
        password: 'PASSWORD',
      });
    }).toThrow();
  });

  it('fails on missing password', () => {
    expect(() => {
      config.newTunnelJson({
        server: 'example.com',
        server_port: 443,
        method: 'METHOD',
      });
    }).toThrow();
  });

  it('parses new format', () => {
    expect(
      config.newTunnelJson({
        transport: {
          type: 'shadowsocks',
          endpoint: {
            type: 'dial',
            host: 'example.com',
            port: 443,
          },
          cipher: 'METHOD',
          secret: 'PASSWORD',
          prefix: '\x03\x02\x03',
        },
      })
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
        prefix: '\x03\x02\x03',
      },
    } as config.TunnelConfigJson);
  });

  it('parses abbreviated endpoint', () => {
    expect(
      config.newTunnelJson({
        transport: {
          type: 'shadowsocks',
          endpoint: 'example.com:443',
          cipher: 'METHOD',
          secret: 'PASSWORD',
          prefix: '\x03\x02\x03',
        },
      })
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
        prefix: '\x03\x02\x03',
      },
    } as config.TunnelConfigJson);
  });

  it('parses multi-hop', () => {
    expect(
      config.newTunnelJson({
        transport: {
          type: 'shadowsocks',
          endpoint: {
            type: 'dial',
            host: 'server2.com',
            port: 443,
            dialer: {
              type: 'shadowsocks',
              endpoint: 'server1.com:8888',
              cipher: 'METHOD1',
              secret: 'PASSWORD1',
              prefix: '\x01\x01\x01',
            },
          },
          cipher: 'METHOD2',
          secret: 'PASSWORD2',
          prefix: '\x03\x02\x03',
        },
      })
    ).toEqual({
      transport: {
        type: 'shadowsocks',
        endpoint: {
          type: 'dial',
          host: 'server2.com',
          port: 443,
          dialer: {
            type: 'shadowsocks',
            endpoint: {
              type: 'dial',
              host: 'server1.com',
              port: 8888,
            },
            cipher: 'METHOD1',
            secret: 'PASSWORD1',
            prefix: '\x01\x01\x01',
          },
        },
        cipher: 'METHOD2',
        secret: 'PASSWORD2',
        prefix: '\x03\x02\x03',
      },
    } as config.TunnelConfigJson);
  });

  it('parses pipe', () => {
    expect(
      config.newTunnelJson({
        transport: [
          {
            type: 'shadowsocks',
            endpoint: 'server1.com:8888',
            cipher: 'METHOD1',
            secret: 'PASSWORD1',
            prefix: '\x01\x01\x01',
          },
          {
            type: 'shadowsocks',
            endpoint: 'server2.com:443',
            cipher: 'METHOD2',
            secret: 'PASSWORD2',
            prefix: '\x03\x02\x03',
          },
        ],
      })
    ).toEqual({
      transport: {
        type: 'pipe',
        dialers: [
          {
            type: 'shadowsocks',
            endpoint: {
              type: 'dial',
              host: 'server1.com',
              port: 8888,
            },
            cipher: 'METHOD1',
            secret: 'PASSWORD1',
            prefix: '\x01\x01\x01',
          },
          {
            type: 'shadowsocks',
            endpoint: {
              type: 'dial',
              host: 'server2.com',
              port: 443,
            },
            cipher: 'METHOD2',
            secret: 'PASSWORD2',
            prefix: '\x03\x02\x03',
          },
        ],
      },
    } as config.TunnelConfigJson);
  });
});

describe('getAddressFromTransport', () => {
  it('extracts address', () => {
    expect(
      config.getAddressFromTransportConfig({
        endpoint: {
          type: 'dial',
          host: 'example.com',
          port: 443,
        },
      } as config.TransportConfigJson)
    ).toEqual('example.com:443');
    expect(
      config.getAddressFromTransportConfig({
        endpoint: {
          type: 'dial',
          host: '1:2::3',
          port: 443,
        },
      } as config.TransportConfigJson)
    ).toEqual('[1:2::3]:443');
  });

  it('fails on invalid config', () => {
    expect(
      config.getAddressFromTransportConfig(
        {} as unknown as config.TransportConfigJson
      )
    ).toBeUndefined();
  });
});

describe('getHostFromTransport', () => {
  it('extracts host', () => {
    expect(
      config.getHostFromTransportConfig({
        type: 'shadowsocks',
        endpoint: {
          type: 'dial',
          host: 'example.com',
        },
      } as config.TransportConfigJson)
    ).toEqual('example.com');
    expect(
      config.getHostFromTransportConfig({
        endpoint: {
          type: 'dial',
          host: '1:2::3',
        },
      } as config.TransportConfigJson)
    ).toEqual('1:2::3');
  });

  it('fails on invalid config', () => {
    expect(
      config.getHostFromTransportConfig(
        {} as unknown as config.TransportConfigJson
      )
    ).toBeUndefined();
  });
});

describe('setTransportHost', () => {
  it('sets host', () => {
    expect(
      JSON.stringify(
        config.setTransportConfigHost(
          {
            endpoint: {
              type: 'dial',
              host: 'example.com',
              port: 443,
            },
          } as config.TransportConfigJson,
          '1.2.3.4'
        )
      )
    ).toEqual('{"endpoint":{"type":"dial","host":"1.2.3.4","port":443}}');
    expect(
      JSON.stringify(
        config.setTransportConfigHost(
          {
            endpoint: {
              type: 'dial',
              host: 'example.com',
              port: 443,
            },
          } as config.TransportConfigJson,
          '1:2::3'
        )
      )
    ).toEqual('{"endpoint":{"type":"dial","host":"1:2::3","port":443}}');
    expect(
      JSON.stringify(
        config.setTransportConfigHost(
          {
            endpoint: {
              type: 'dial',
              host: '1.2.3.4',
              port: 443,
            },
          } as config.TransportConfigJson,
          '1:2::3'
        )
      )
    ).toEqual('{"endpoint":{"type":"dial","host":"1:2::3","port":443}}');
  });

  it('fails on invalid config', () => {
    expect(
      config.setTransportConfigHost(
        {} as unknown as config.TransportConfigJson,
        '1:2::3'
      )
    ).toBeUndefined();
  });
});
