// Copyright 2018 The Outline Authors
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

import {parseManualServerConfig} from './management_urls';

describe('parseManualServerConfig', () => {
  it('basic case', () => {
    const result = parseManualServerConfig(
      '{"apiUrl":"http://abc.com/xyz", "certSha256":"1234567"}'
    );
    expect(result.apiUrl).toEqual('http://abc.com/xyz');
    expect(result.certSha256).toEqual('1234567');
  });

  it('ignores missing outer braces', () => {
    const result = parseManualServerConfig(
      '"apiUrl":"http://abc.com/xyz", "certSha256":"1234567"'
    );
    expect(result.apiUrl).toEqual('http://abc.com/xyz');
    expect(result.certSha256).toEqual('1234567');
  });

  it('ignores missing quotes on key names', () => {
    const result = parseManualServerConfig(
      'apiUrl:"http://abc.com/xyz", "certSha256":"1234567"'
    );
    expect(result.apiUrl).toEqual('http://abc.com/xyz');
    expect(result.certSha256).toEqual('1234567');
  });

  it('ignores missing quotes on values', () => {
    const result = parseManualServerConfig(
      '"apiUrl":http://abc.com/xyz, "certSha256":"1234567"'
    );
    expect(result.apiUrl).toEqual('http://abc.com/xyz');
    expect(result.certSha256).toEqual('1234567');
  });

  it('ignores content outside of braces', () => {
    const result = parseManualServerConfig(
      'working... {"apiUrl":http://abc.com/xyz, "certSha256":"1234567"} ALL DONE'
    );
    expect(result.apiUrl).toEqual('http://abc.com/xyz');
    expect(result.certSha256).toEqual('1234567');
  });

  it('strips whitespace', () => {
    const result = parseManualServerConfig(
      '{"apiUrl":http://abc.com/xyz, "certSha256":"123   4567"}'
    );
    expect(result.apiUrl).toEqual('http://abc.com/xyz');
    expect(result.certSha256).toEqual('1234567');
  });

  it('strips newlines', () => {
    const result = parseManualServerConfig(
      '{"apiUrl":http://abc.com/xyz, "certSha256":"123\n4567"}'
    );
    expect(result.apiUrl).toEqual('http://abc.com/xyz');
    expect(result.certSha256).toEqual('1234567');
  });
});
