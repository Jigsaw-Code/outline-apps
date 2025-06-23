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

import {InMemoryStorage} from '@outline/infrastructure/memory_storage';

import {CloudAccounts} from './cloud_accounts';

describe('CloudAccounts', () => {
  it('get account methods return null when no cloud accounts are connected', () => {
    const cloudAccounts = createCloudAccount();
    expect(cloudAccounts.getDigitalOceanAccount()).toBeNull();
    expect(cloudAccounts.getGcpAccount()).toBeNull();
  });

  it('load connects account that exist in local storage', () => {
    const storage = createInMemoryStorage(
      'fake-access-token',
      'fake-refresh-token'
    );
    const cloudAccounts = createCloudAccount(storage);
    expect(cloudAccounts.getDigitalOceanAccount()).not.toBeNull();
    expect(cloudAccounts.getGcpAccount()).not.toBeNull();
  });

  it('connects accounts when connect methods are invoked', () => {
    const cloudAccounts = createCloudAccount();

    expect(cloudAccounts.getDigitalOceanAccount()).toBeNull();
    cloudAccounts.connectDigitalOceanAccount('fake-access-token');
    expect(cloudAccounts.getDigitalOceanAccount()).not.toBeNull();

    expect(cloudAccounts.getGcpAccount()).toBeNull();
    cloudAccounts.connectGcpAccount('fake-access-token');
    expect(cloudAccounts.getGcpAccount()).not.toBeNull();
  });

  it('removes account when disconnect is invoked', () => {
    const storage = createInMemoryStorage(
      'fake-access-token',
      'fake-refresh-token'
    );
    const cloudAccounts = createCloudAccount(storage);

    expect(cloudAccounts.getDigitalOceanAccount()).not.toBeNull();
    cloudAccounts.disconnectDigitalOceanAccount();
    expect(cloudAccounts.getDigitalOceanAccount()).toBeNull();

    expect(cloudAccounts.getGcpAccount()).not.toBeNull();
    cloudAccounts.disconnectGcpAccount();
    expect(cloudAccounts.getGcpAccount()).toBeNull();
  });

  it('functional noop on calling disconnect when accounts are not connected', () => {
    const cloudAccounts = createCloudAccount();

    expect(cloudAccounts.getDigitalOceanAccount()).toBeNull();
    cloudAccounts.disconnectDigitalOceanAccount();
    expect(cloudAccounts.getDigitalOceanAccount()).toBeNull();

    expect(cloudAccounts.getGcpAccount()).toBeNull();
    cloudAccounts.disconnectGcpAccount();
    expect(cloudAccounts.getGcpAccount()).toBeNull();
  });

  it('migrates existing legacy DigitalOcean access token on load', () => {
    const storage = new InMemoryStorage();
    storage.setItem('LastDOToken', 'legacy-digitalocean-access-token');
    const cloudAccounts = createCloudAccount(storage);

    expect(cloudAccounts.getDigitalOceanAccount()).not.toBeNull();
  });

  it('updates legacy DigitalOcean access token when account reconnected', () => {
    const storage = new InMemoryStorage();
    storage.setItem('LastDOToken', 'legacy-digitalocean-access-token');
    const cloudAccounts = createCloudAccount(storage);

    expect(storage.getItem('LastDOToken')).toEqual(
      'legacy-digitalocean-access-token'
    );
    cloudAccounts.connectDigitalOceanAccount('new-digitalocean-access-token');
    expect(storage.getItem('LastDOToken')).toEqual(
      'new-digitalocean-access-token'
    );
  });
});

function createInMemoryStorage(
  digitalOceanAccessToken?: string,
  gcpRefreshToken?: string
): Storage {
  const storage = new InMemoryStorage();
  if (digitalOceanAccessToken) {
    storage.setItem(
      'accounts.digitalocean',
      JSON.stringify({accessToken: digitalOceanAccessToken})
    );
  }
  if (gcpRefreshToken) {
    storage.setItem(
      'accounts.gcp',
      JSON.stringify({refreshToken: gcpRefreshToken})
    );
  }
  return storage;
}

function createCloudAccount(storage = createInMemoryStorage()): CloudAccounts {
  const shadowboxSettings = {
    imageId: 'fake-image-id',
    metricsUrl: 'fake-metrics-url',
    sentryApiUrl: 'fake-sentry-api',
  };
  return new CloudAccounts(shadowboxSettings, true, storage);
}
