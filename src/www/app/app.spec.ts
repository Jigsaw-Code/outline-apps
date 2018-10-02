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

import {unwrapInvite} from './app';

describe('unwrapInvite', () => {
  it('ignores empty string', () => {
    const s = 'i am not a shadowsocks link';
    expect(unwrapInvite('')).toEqual('');
  });

  it('ignores garbage', () => {
    const s = 'i am not a shadowsocks link';
    expect(unwrapInvite(s)).toEqual(s);
  });

  it('ignores url without fragment', () => {
    const s = 'https://whatever.com/invite.html';
    expect(unwrapInvite(s)).toEqual(s);
  });

  it('ignores non-ss fragment', () => {
    const s = 'https://whatever.com/invite.html#iamjustaname';
    expect(unwrapInvite(s)).toEqual(s);
  });

  it('detects ss fragment', () => {
    const s = 'ss://myhost.com:3333';
    expect(unwrapInvite(`https://whatever.com/invite.html#${encodeURIComponent(s)}`)).toEqual(s);
  });

  it('handles fragment after redirect', () => {
    const s = 'ss://myhost.com:3333';
    expect(unwrapInvite(`https://whatever.com/invite.html#/en/invite/${encodeURIComponent(s)}`))
        .toEqual(s);
  });
});
