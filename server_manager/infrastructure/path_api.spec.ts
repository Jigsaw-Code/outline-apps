// Copyright 2022 The Outline Authors
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

import {PathApiClient} from './path_api';

describe('PathApi', () => {
  // Mock fetcher
  let lastRequest: HttpRequest;
  let nextResponse: Promise<HttpResponse>;

  const fetcher = (request: HttpRequest) => {
    lastRequest = request;
    return nextResponse;
  };

  beforeEach(() => {
    lastRequest = undefined;
    nextResponse = undefined;
  });

  const api = new PathApiClient('https://asdf.test/foo', fetcher);

  it('GET', async () => {
    const response = {status: 200, body: '{"asdf": true}'};
    nextResponse = Promise.resolve(response);
    expect(await api.request('bar')).toEqual({asdf: true});
    expect(lastRequest).toEqual({
      url: 'https://asdf.test/foo/bar',
      method: 'GET',
    });
  });

  it('PUT form data', async () => {
    const response = {status: 200, body: '{"asdf": true}'};
    nextResponse = Promise.resolve(response);
    expect(await api.requestForm('bar', 'PUT', {name: 'value'})).toEqual({asdf: true});
    expect(lastRequest).toEqual({
      url: 'https://asdf.test/foo/bar',
      method: 'PUT',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'name=value',
    });
  });

  it('POST JSON data', async () => {
    const response = {status: 200, body: '{"asdf": true}'};
    nextResponse = Promise.resolve(response);
    expect(await api.requestJson('bar', 'POST', {key: 'value'})).toEqual({asdf: true});
    expect(lastRequest).toEqual({
      url: 'https://asdf.test/foo/bar',
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: '{"key":"value"}',
    });
  });
});
