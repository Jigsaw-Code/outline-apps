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

import {SessionConfigFetchFailed} from '../model/errors';
import {PlatformError} from '../model/platform_error';

/**
 * An interface for fetching resources located at a given URL.
 */
export interface ResourceFetcher {
  /**
   * Fetches the content of a resource located at the given URL.
   * @param url The URL of the resource to fetch.
   * @returns A Promise that resolves to a string containing the content of the fetched resource.
   */
  fetch(url: string): Promise<string>;
}

/**
 * Fetches resources using the browser's built-in fetch function.
 */
export class BrowserResourceFetcher implements ResourceFetcher {
  async fetch(url: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        cache: 'no-store',
        redirect: 'follow',
      });
    } catch (cause) {
      throw new SessionConfigFetchFailed(
        'Failed to fetch VPN information from dynamic access key.',
        {cause}
      );
    }
    return await response.text();
  }
}

/**
 * Fetches resources using Electron's IPC to communicate with the main process.
 */
export class ElectronResourceFetcher implements ResourceFetcher {
  async fetch(url: string): Promise<string> {
    try {
      return await window.electron.methodChannel.invoke('fetch-config', url);
    } catch (e) {
      throw PlatformError.parseFrom(e);
    }
  }
}
