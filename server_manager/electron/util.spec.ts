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

import {redactManagerUrl} from './util';

describe('XHR breadcrumbs', () => {
  it('handles the normal case', () => {
    expect(
      redactManagerUrl('https://124.10.10.2:48000/abcd123/access-keys')
    ).toEqual('access-keys');
  });

  it('handles no port', () => {
    expect(redactManagerUrl('https://124.10.10.2/abcd123/access-keys')).toEqual(
      'access-keys'
    );
  });

  it('handles just one path element', () => {
    expect(redactManagerUrl('https://124.10.10.2/abcd123')).toEqual('');
    expect(redactManagerUrl('https://124.10.10.2/abcd123/')).toEqual('');
  });

  it('handles no pathname', () => {
    expect(redactManagerUrl('https://124.10.10.2')).toEqual('');
    expect(redactManagerUrl('https://124.10.10.2/')).toEqual('');
  });

  it('handles commands with args', () => {
    expect(
      redactManagerUrl('https://124.10.10.2/abcd123/access-keys/52')
    ).toEqual('access-keys/52');
  });

  it('throws on garbage', () => {
    expect(() => {
      redactManagerUrl('once upon a time');
    }).toThrowError(TypeError);
  });
});
