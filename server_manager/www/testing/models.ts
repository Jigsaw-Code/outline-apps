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
  constructor(protected id: string) {
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
    return '1.2.3';
  }
  getAccessKey(accessKeyId: server.AccessKeyId) {
    return Promise.reject(new Error(`Access key "${accessKeyId}" not found`));
  }
  listAccessKeys() {
    return Promise.resolve([]);
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
  addAccessKey() {
    return Promise.reject(new Error('FakeServer.addAccessKey not implemented'));
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
    _limit: server.DataLimit
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
  setDefaultDataLimit(_limit: server.DataLimit): Promise<void> {
    return Promise.reject(
      new Error('FakeServer.setDefaultDataLimit not implemented')
    );
  }
  removeDefaultDataLimit(): Promise<void> {
    return Promise.resolve();
  }
  getDefaultDataLimit(): server.DataLimit | undefined {
    return undefined;
  }
}

export class FakeManualServer
  extends FakeServer
  implements server.ManualServer
{
  constructor(public manualServerConfig: server.ManualServerConfig) {
    super(manualServerConfig.apiUrl);
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
    super(id);
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
