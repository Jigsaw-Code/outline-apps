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
  it('extracts address', () => {
    expect(
      vpn.getAddressFromTransportConfig({host: 'example.com', port: '443'})
    ).toEqual('example.com:443');
    expect(
      vpn.getAddressFromTransportConfig({host: '1:2::3', port: '443'})
    ).toEqual('[1:2::3]:443');
    expect(vpn.getAddressFromTransportConfig({host: 'example.com'})).toEqual(
      'example.com'
    );
    expect(vpn.getAddressFromTransportConfig({host: '1:2::3'})).toEqual(
      '1:2::3'
    );
  });

  it('fails on invalid config', () => {
    expect(vpn.getAddressFromTransportConfig({})).toBeUndefined();
  });
});

describe('getHostFromTransport', () => {
  it('extracts host', () => {
    expect(
      vpn.getHostFromTransportConfig({host: 'example.com', port: '443'})
    ).toEqual('example.com');
    expect(
      vpn.getHostFromTransportConfig({host: '1:2::3', port: '443'})
    ).toEqual('1:2::3');
  });

  it('fails on invalid config', () => {
    expect(vpn.getHostFromTransportConfig({})).toBeUndefined();
  });
});

describe('setTransportHost', () => {
  it('sets host', () => {
    expect(
      JSON.stringify(
        vpn.setTransportConfigHost(
          {host: 'example.com', port: '443'},
          '1.2.3.4'
        )
      )
    ).toEqual('{"host":"1.2.3.4","port":"443"}');
    expect(
      JSON.stringify(
        vpn.setTransportConfigHost({host: 'example.com', port: '443'}, '1:2::3')
      )
    ).toEqual('{"host":"1:2::3","port":"443"}');
    expect(
      JSON.stringify(
        vpn.setTransportConfigHost({host: '1.2.3.4', port: '443'}, '1:2::3')
      )
    ).toEqual('{"host":"1:2::3","port":"443"}');
  });

  it('fails on invalid config', () => {
    expect(vpn.setTransportConfigHost({}, '1:2::3')).toBeUndefined();
  });
});
