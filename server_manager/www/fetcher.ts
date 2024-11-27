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

import {Fetcher, PathApiClient} from '@outline/infrastructure/path_api';

async function fetchWrapper(request: HttpRequest): Promise<HttpResponse> {
  const response = await fetch(request.url, request);
  return {
    status: response.status,
    body: await response.text(),
  };
}

/**
 * @param fingerprint A SHA-256 hash of the expected leaf certificate, in binary encoding.
 * @returns An HTTP client that enforces `fingerprint`, if set.
 */
function makeFetcher(fingerprint?: string): Fetcher {
  if (fingerprint) {
    return request => fetchWithPin(request, fingerprint);
  }
  return fetchWrapper;
}

/**
 * @param base A valid URL
 * @param fingerprint A SHA-256 hash of the expected leaf certificate, in binary encoding.
 * @returns A fully initialized API client.
 */
export function makePathApiClient(
  base: string,
  fingerprint?: string
): PathApiClient {
  return new PathApiClient(base, makeFetcher(fingerprint));
}
