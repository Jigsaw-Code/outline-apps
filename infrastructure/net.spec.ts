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

describe('splitHostAndPort', () => {
  it('should split IPv4 host and port', () => {
    const input = '192.168.1.100:3000';
    const expected = {host: '192.168.1.100', port: 3000};
    expect(net.splitHostPort(input)).toEqual(expected);
  });

  it('should split hostname and port', () => {
    const input = 'localhost:8080';
    const expected = {host: 'localhost', port: 8080};
    expect(net.splitHostPort(input)).toEqual(expected);
  });

  it('should split IPv6 host and port', () => {
    const input = '[2001:db8::1]:80';
    const expected = {host: '2001:db8::1', port: 80};
    expect(net.splitHostPort(input)).toEqual(expected);
  });

  it('should split IPv6 host and port without brackets', () => {
    const input = '2001:db8::1:80';
    const expected = {host: '2001:db8::1', port: 80};
    expect(net.splitHostPort(input)).toEqual(expected);
  });

  it('should return null for invalid input', () => {
    const input = 'invalid-input';
    expect(net.splitHostPort(input)).toBeNull();
  });

  it('should return null for missing port', () => {
    const input = 'localhost';
    expect(net.splitHostPort(input)).toBeNull();
  });

  it('should return null for invalid port', () => {
    const input = 'localhost:abc';
    expect(net.splitHostPort(input)).toBeNull();
  });
});
