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

import * as net from './net';

describe('joinHostPort', () => {
  it('joins correctly', () => {
    expect(net.joinHostPort('example.com', '443')).toEqual('example.com:443');
    expect(net.joinHostPort('1.2.3.4', '443')).toEqual('1.2.3.4:443');
    expect(net.joinHostPort('1:2:3::4', '443')).toEqual('[1:2:3::4]:443');
    expect(net.joinHostPort('8example.com', '443')).toEqual('8example.com:443');
  });
});

describe('splitHostPort', () => {
  it('splits correctly', () => {
    expect(net.splitHostPort('example.com:443')).toEqual({
      host: 'example.com',
      port: '443',
    });
    expect(net.splitHostPort('example.com:')).toEqual({
      host: 'example.com',
      port: '',
    });
    expect(net.splitHostPort('1.2.3.4:443')).toEqual({
      host: '1.2.3.4',
      port: '443',
    });
    expect(net.splitHostPort('1.2.3.4:')).toEqual({
      host: '1.2.3.4',
      port: '',
    });
    expect(net.splitHostPort('[1:2:3::4]:443')).toEqual({
      host: '1:2:3::4',
      port: '443',
    });
    expect(net.splitHostPort('[1:2:3::4]:')).toEqual({
      host: '1:2:3::4',
      port: '',
    });
    expect(net.splitHostPort('8example.com:443')).toEqual({
      host: '8example.com',
      port: '443',
    });
  });
});
