// Copyright 2021 The Outline Authors
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

import * as digitalocean from './digitalocean';
import * as gcp from './gcp';

export interface CloudAccounts {
  /**
   * Connects a DigitalOcean account.
   *
   * Only one DigitalOcean account can be connected at any given time.
   * Subsequent calls to this method will overwrite any previously connected
   * DigtialOcean account.
   *
   * @param accessToken: The DigitalOcean access token.
   */
  connectDigitalOceanAccount(accessToken: string): digitalocean.Account;

  /**
   * Connects a Google Cloud Platform account.
   *
   * Only one Google Cloud Platform account can be connected at any given time.
   * Subsequent calls to this method will overwrite any previously connected
   * Google Cloud Platform account.
   *
   * @param refreshToken: The GCP refresh token.
   */
  connectGcpAccount(refreshToken: string): gcp.Account;

  /**
   * Disconnects the DigitalOcean account.
   */
  disconnectDigitalOceanAccount(): void;

  /**
   * Disconnects the Google Cloud Platform account.
   */
  disconnectGcpAccount(): void;

  /**
   * @returns the connected DigitalOcean account (or null if none exists).
   */
  getDigitalOceanAccount(): digitalocean.Account;

  /**
   * @returns the connected Google Cloud Platform account (or null if none exists).
   */
  getGcpAccount(): gcp.Account;
}
