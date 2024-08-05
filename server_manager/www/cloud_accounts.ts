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

import {DigitalOceanAccount} from './digitalocean_account';
import {GcpAccount} from './gcp_account';
import {ShadowboxSettings} from './server_install';
import * as accounts from '../model/accounts';
import * as digitalocean from '../model/digitalocean';
import * as gcp from '../model/gcp';

type DigitalOceanAccountJson = {
  accessToken: string;
};

type GcpAccountJson = {
  refreshToken: string;
};

/**
 * Manages connected cloud provider accounts.
 */
export class CloudAccounts implements accounts.CloudAccounts {
  private readonly LEGACY_DIGITALOCEAN_STORAGE_KEY = 'LastDOToken';
  private readonly DIGITALOCEAN_ACCOUNT_STORAGE_KEY = 'accounts.digitalocean';
  private readonly GCP_ACCOUNT_STORAGE_KEY = 'accounts.gcp';

  private digitalOceanAccount: DigitalOceanAccount = null;
  private gcpAccount: GcpAccount = null;

  constructor(
    private shadowboxSettings: ShadowboxSettings,
    private isDebugMode: boolean,
    private storage = localStorage
  ) {
    this.load();
  }

  /** See {@link CloudAccounts#connectDigitalOceanAccount} */
  connectDigitalOceanAccount(accessToken: string): digitalocean.Account {
    this.digitalOceanAccount = this.createDigitalOceanAccount(accessToken);
    this.save();
    return this.digitalOceanAccount;
  }

  /** See {@link CloudAccounts#connectGcpAccount} */
  connectGcpAccount(refreshToken: string): gcp.Account {
    this.gcpAccount = this.createGcpAccount(refreshToken);
    this.save();
    return this.gcpAccount;
  }

  /** See {@link CloudAccounts#disconnectDigitalOceanAccount} */
  disconnectDigitalOceanAccount(): void {
    // TODO(fortuna): Revoke access token.
    this.digitalOceanAccount = null;
    this.save();
  }

  /** See {@link CloudAccounts#disconnectGcpAccount} */
  disconnectGcpAccount(): void {
    // TODO(fortuna): Revoke access token.
    this.gcpAccount = null;
    this.save();
  }

  /** See {@link CloudAccounts#getDigitalOceanAccount} */
  getDigitalOceanAccount(): digitalocean.Account {
    return this.digitalOceanAccount;
  }

  /** See {@link CloudAccounts#getGcpAccount} */
  getGcpAccount(): gcp.Account {
    return this.gcpAccount;
  }

  /** Loads the saved cloud accounts from disk. */
  private load(): void {
    const digitalOceanAccountJsonString = this.storage.getItem(
      this.DIGITALOCEAN_ACCOUNT_STORAGE_KEY
    );
    if (!digitalOceanAccountJsonString) {
      const digitalOceanToken = this.loadLegacyDigitalOceanToken();
      if (digitalOceanToken) {
        this.digitalOceanAccount =
          this.createDigitalOceanAccount(digitalOceanToken);
        this.save();
      }
    } else {
      const digitalOceanAccountJson: DigitalOceanAccountJson = JSON.parse(
        digitalOceanAccountJsonString
      );
      this.digitalOceanAccount = this.createDigitalOceanAccount(
        digitalOceanAccountJson.accessToken
      );
    }

    const gcpAccountJsonString = this.storage.getItem(
      this.GCP_ACCOUNT_STORAGE_KEY
    );
    if (gcpAccountJsonString) {
      const gcpAccountJson: GcpAccountJson = JSON.parse(
        this.storage.getItem(this.GCP_ACCOUNT_STORAGE_KEY)
      );
      this.gcpAccount = this.createGcpAccount(gcpAccountJson.refreshToken);
    }
  }

  /** Loads legacy DigitalOcean access token. */
  private loadLegacyDigitalOceanToken(): string {
    return this.storage.getItem(this.LEGACY_DIGITALOCEAN_STORAGE_KEY);
  }

  /** Replace the legacy DigitalOcean access token. */
  private saveLegacyDigitalOceanToken(accessToken?: string): void {
    if (accessToken) {
      this.storage.setItem(this.LEGACY_DIGITALOCEAN_STORAGE_KEY, accessToken);
    } else {
      this.storage.removeItem(this.LEGACY_DIGITALOCEAN_STORAGE_KEY);
    }
  }

  private createDigitalOceanAccount(accessToken: string): DigitalOceanAccount {
    return new DigitalOceanAccount(
      'do',
      accessToken,
      this.shadowboxSettings,
      this.isDebugMode
    );
  }

  private createGcpAccount(refreshToken: string): GcpAccount {
    return new GcpAccount('gcp', refreshToken, this.shadowboxSettings);
  }

  private save(): void {
    if (this.digitalOceanAccount) {
      const accessToken = this.digitalOceanAccount.getAccessToken();
      const digitalOceanAccountJson: DigitalOceanAccountJson = {accessToken};
      this.storage.setItem(
        this.DIGITALOCEAN_ACCOUNT_STORAGE_KEY,
        JSON.stringify(digitalOceanAccountJson)
      );
      this.saveLegacyDigitalOceanToken(accessToken);
    } else {
      this.storage.removeItem(this.DIGITALOCEAN_ACCOUNT_STORAGE_KEY);
      this.saveLegacyDigitalOceanToken(null);
    }
    if (this.gcpAccount) {
      const refreshToken = this.gcpAccount.getRefreshToken();
      const gcpAccountJson: GcpAccountJson = {refreshToken};
      this.storage.setItem(
        this.GCP_ACCOUNT_STORAGE_KEY,
        JSON.stringify(gcpAccountJson)
      );
    } else {
      this.storage.removeItem(this.GCP_ACCOUNT_STORAGE_KEY);
    }
  }
}
