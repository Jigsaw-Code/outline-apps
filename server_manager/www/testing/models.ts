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

import * as accounts from '../../model/accounts';
import * as digitalocean from '../../model/digitalocean';
import * as gcp from '../../model/gcp';
import * as server from '../../model/server';

export class FakeDigitalOceanAccount implements digitalocean.Account {
  private servers: server.ManagedServer[] = [];

  constructor(private accessToken = 'fake-access-token') {}

  getId(): string {
    return 'account-id';
  }
  async getName(): Promise<string> {
    return 'fake-digitalocean-account-name';
  }
  async getStatus(): Promise<digitalocean.Status> {
    return {
      needsBillingInfo: false,
      needsEmailVerification: false,
      dropletLimit: 3,
      hasReachedLimit: false,
    };
  }
  listServers() {
    return Promise.resolve(this.servers);
  }
  async hasReachedLimit(): Promise<boolean> {
    return false;
  }
  listLocations() {
    return Promise.resolve([
      {
        cloudLocation: new digitalocean.Region('AMS999'),
        available: true,
      },
      {
        cloudLocation: new digitalocean.Region('FRA999'),
        available: false,
      },
    ]);
  }
  createServer(region: digitalocean.Region) {
    const newServer = new FakeManagedServer(region.id, false);
    this.servers.push(newServer);
    return Promise.resolve(newServer);
  }
  getAccessToken(): string {
    return this.accessToken;
  }
}

export class FakeGcpAccount implements gcp.Account {
  constructor(
    private refreshToken = 'fake-access-token',
    private billingAccounts: gcp.BillingAccount[] = [],
    private locations: gcp.ZoneOption[] = []
  ) {}

  getId() {
    return 'id';
  }
  async getName(): Promise<string> {
    return 'fake-gcp-account-name';
  }
  getRefreshToken(): string {
    return this.refreshToken;
  }
  createServer(
    _projectId: string,
    _name: string,
    _zone: gcp.Zone
  ): Promise<server.ManagedServer> {
    return undefined;
  }
  async listLocations(_projectId: string): Promise<Readonly<gcp.ZoneOption[]>> {
    return this.locations;
  }
  async listServers(_projectId: string): Promise<server.ManagedServer[]> {
    return [];
  }
  async createProject(
    _id: string,
    _billingAccountId: string
  ): Promise<gcp.Project> {
    return {
      id: 'project-id',
      name: 'project-name',
    };
  }
  async isProjectHealthy(_projectId: string): Promise<boolean> {
    return true;
  }
  async listOpenBillingAccounts(): Promise<gcp.BillingAccount[]> {
    return this.billingAccounts;
  }
  async listProjects(): Promise<gcp.Project[]> {
    return [];
  }
}

export class FakeServer implements server.Server {
  private name = 'serverName';
  private metricsId: string;
  private metricsEnabled = false;
  apiUrl: string;
  private accessKeys: server.AccessKey[] = [];

  constructor(
    protected id: string,
    private readonly version: string
  ) {
    this.metricsId = Math.random().toString();
  }
  getId() {
    return this.id;
  }
  getName() {
    return this.name;
  }
  setName(name: string) {
    this.name = name;
    return Promise.resolve();
  }
  getVersion() {
    return this.version;
  }
  getAccessKey(accessKeyId: server.AccessKeyId) {
    const accessKey = this.accessKeys.find(key => key.id === accessKeyId);
    if (accessKey) {
      return Promise.resolve(accessKey);
    }
    return Promise.reject(new Error(`Access key "${accessKeyId}" not found`));
  }
  listAccessKeys() {
    return Promise.resolve(this.accessKeys);
  }
  getMetricsEnabled() {
    return this.metricsEnabled;
  }
  setMetricsEnabled(metricsEnabled: boolean) {
    this.metricsEnabled = metricsEnabled;
    return Promise.resolve();
  }
  getMetricsId() {
    return this.metricsId;
  }
  isHealthy() {
    return Promise.resolve(true);
  }
  getCreatedDate() {
    return new Date();
  }
  getDataUsage() {
    return Promise.resolve(new Map<server.AccessKeyId, number>());
  }
  getServerMetrics(): Promise<{
    server?: server.ServerMetrics;
    accessKeys: server.AccessKeyMetrics[];
  }> {
    return Promise.reject(
      new Error('FakeServer.getServerMetrics not implemented')
    );
  }
  getSupportedExperimentalUniversalMetricsEndpoint(): Promise<boolean> {
    return Promise.reject(
      new Error('FakeServer.getSupportedExperimentalEndpoints not implemented')
    );
  }
  addAccessKey() {
    const accessKey = {
      id: Math.floor(Math.random()).toString(),
      name: 'test-name',
      accessUrl: 'test-access-url',
    };
    this.accessKeys.push(accessKey);
    return Promise.resolve(accessKey);
  }
  renameAccessKey(_accessKeyId: server.AccessKeyId, _name: string) {
    return Promise.reject(
      new Error('FakeServer.renameAccessKey not implemented')
    );
  }
  removeAccessKey(_accessKeyId: server.AccessKeyId) {
    return Promise.reject(
      new Error('FakeServer.removeAccessKey not implemented')
    );
  }
  setHostnameForAccessKeys(_hostname: string) {
    return Promise.reject(new Error('FakeServer.setHostname not implemented'));
  }
  getHostnameForAccessKeys() {
    return 'fake-server';
  }
  getManagementApiUrl() {
    return this.apiUrl || Math.random().toString();
  }
  getPortForNewAccessKeys(): number | undefined {
    return undefined;
  }
  setPortForNewAccessKeys(): Promise<void> {
    return Promise.reject(
      new Error('FakeServer.setPortForNewAccessKeys not implemented')
    );
  }
  setAccessKeyDataLimit(
    _accessKeyId: string,
    _limit: server.Data
  ): Promise<void> {
    return Promise.reject(
      new Error('FakeServer.setAccessKeyDataLimit not implemented')
    );
  }
  removeAccessKeyDataLimit(_accessKeyId: string): Promise<void> {
    return Promise.reject(
      new Error('FakeServer.removeAccessKeyDataLimit not implemented')
    );
  }
  setDefaultDataLimit(_limit: server.Data): Promise<void> {
    return Promise.reject(
      new Error('FakeServer.setDefaultDataLimit not implemented')
    );
  }
  removeDefaultDataLimit(): Promise<void> {
    return Promise.resolve();
  }
  getDefaultDataLimit(): server.Data | undefined {
    return undefined;
  }
}

export class FakeManualServer
  extends FakeServer
  implements server.ManualServer
{
  constructor(public manualServerConfig: server.ManualServerConfig) {
    super(manualServerConfig.apiUrl, '0.0.0');
  }
  getManagementApiUrl() {
    return this.manualServerConfig.apiUrl;
  }
  forget() {
    return Promise.reject(new Error('FakeManualServer.forget not implemented'));
  }
  getCertificateFingerprint() {
    return this.manualServerConfig.certSha256;
  }
  getSupportedExperimentalUniversalMetricsEndpoint(): Promise<boolean> {
    return Promise.resolve(null);
  }
  async getServerMetrics(): Promise<{
    server?: server.ServerMetrics;
    accessKeys: server.AccessKeyMetrics[];
  }> {
    if (await this.getSupportedExperimentalUniversalMetricsEndpoint()) {
      return {
        server: {
          tunnelTime: {
            seconds: 0,
          },
          dataTransferred: {
            bytes: 0,
          },
          bandwidth: {
            current: {
              data: {
                bytes: 0,
              },
              timestamp: new Date(),
            },
            peak: {
              data: {
                bytes: 0,
              },
              timestamp: new Date(),
            },
          },
          locations: [
            {
              location: 'US',
              asn: 10000,
              asOrg: 'Fake AS',
            },
          ],
        },
        accessKeys: [
          {
            accessKeyId: '0',
            dataTransferred: {
              bytes: 0,
            },
          },
        ],
      };
    }

    return {
      accessKeys: [
        {
          accessKeyId: '0',
          dataTransferred: {
            bytes: 0,
          },
        },
      ],
    };
  }
}

export class FakeManualServerRepository
  implements server.ManualServerRepository
{
  private servers: server.ManualServer[] = [];

  addServer(config: server.ManualServerConfig) {
    const newServer = new FakeManualServer(config);
    this.servers.push(newServer);
    return Promise.resolve(newServer);
  }

  findServer(config: server.ManualServerConfig) {
    return this.servers.find(
      server => server.getManagementApiUrl() === config.apiUrl
    );
  }

  listServers() {
    return Promise.resolve(this.servers);
  }
}

export class FakeManagedServer
  extends FakeServer
  implements server.ManagedServer
{
  constructor(
    id: string,
    private isInstalled = true
  ) {
    super(id, '1.2.3');
  }
  async *monitorInstallProgress() {
    yield 0.5;
    if (!this.isInstalled) {
      // Leave the progress bar at 0.5 and never return.
      await new Promise(() => {});
    }
  }
  getHost() {
    return {
      getMonthlyOutboundTransferLimit: () => ({terabytes: 1}),
      getMonthlyCost: () => ({usd: 5}),
      getCloudLocation: () => new digitalocean.Region('AMS999'),
      delete: () => Promise.resolve(),
      getHostId: () => 'fake-host-id',
    };
  }
}

export class FakeCloudAccounts implements accounts.CloudAccounts {
  constructor(
    private digitalOceanAccount: digitalocean.Account = null,
    private gcpAccount: gcp.Account = null
  ) {}

  connectDigitalOceanAccount(accessToken: string): digitalocean.Account {
    this.digitalOceanAccount = new FakeDigitalOceanAccount(accessToken);
    return this.digitalOceanAccount;
  }

  connectGcpAccount(refreshToken: string): gcp.Account {
    this.gcpAccount = new FakeGcpAccount(refreshToken);
    return this.gcpAccount;
  }

  disconnectDigitalOceanAccount(): void {
    this.digitalOceanAccount = null;
  }

  disconnectGcpAccount(): void {
    this.gcpAccount = null;
  }

  getDigitalOceanAccount(): digitalocean.Account {
    return this.digitalOceanAccount;
  }

  getGcpAccount(): gcp.Account {
    return this.gcpAccount;
  }
}
