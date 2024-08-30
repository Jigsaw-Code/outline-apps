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

import * as vpn from './vpn';

describe('getAddressFromTransport', () => {
  it('extracts from JSON', () => {
    expect(
      new vpn.TransportConfig({host: 'example.com', port: '443'}).getAddress()
    ).toEqual('example.com:443');
    expect(
      new vpn.TransportConfig({host: '1:2::3', port: '443'}).getAddress()
    ).toEqual('[1:2::3]:443');
  });

  it('fails on invalid config', () => {
    expect(new vpn.TransportConfig({}).getAddress()).toBeUndefined();
  });
});

describe('getHostFromTransport', () => {
  it('extracts from JSON', () => {
    expect(
      new vpn.TransportConfig({host: 'example.com', port: '443'}).getHost()
    ).toEqual('example.com');
    expect(
      new vpn.TransportConfig({host: '1:2::3', port: '443'}).getHost()
    ).toEqual('1:2::3');
  });

  it('fails on invalid config', () => {
    expect(new vpn.TransportConfig({}).getHost()).toBeUndefined();
  });
});

describe('setTransportHost', () => {
  it('sets host for JSON', () => {
    expect(
      new vpn.TransportConfig({host: 'example.com', port: '443'})
        .setHost('1.2.3.4')
        .toString()
    ).toEqual('{"host":"1.2.3.4","port":"443"}');
    expect(
      new vpn.TransportConfig({host: 'example.com', port: '443'})
        .setHost('1:2::3')
        .toString()
    ).toEqual('{"host":"1:2::3","port":"443"}');
    expect(
      new vpn.TransportConfig({host: '1.2.3.4', port: '443'})
        .setHost('1:2::3')
        .toString()
    ).toEqual('{"host":"1:2::3","port":"443"}');
  });

  it('fails on invalid config', () => {
    expect(new vpn.TransportConfig({}).setHost('1:2::3')).toBeUndefined();
  });
});
