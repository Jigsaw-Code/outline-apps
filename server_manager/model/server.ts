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

import {CustomError} from '@outline/infrastructure/custom_error';

import {CloudLocation} from './location';

export interface Server {
  // Gets a globally unique identifier for this Server.  THIS MUST NOT make a network request, as
  // it's used to identify unreachable servers.
  getId(): string;

  // Gets the server's name for display.
  getName(): string;

  // Gets the version of the shadowbox binary the server is running
  getVersion(): string;

  // Returns a set of experimental endpoints the server supports
  getSupportedExperimentalEndpoints(): Promise<Set<string>>;

  // Updates the server name.
  setName(name: string): Promise<void>;

  // Return access key
  getAccessKey(accessKeyId: AccessKeyId): Promise<AccessKey>;

  // Lists the access keys for this server, including the admin.
  listAccessKeys(): Promise<AccessKey[]>;

  // Returns server metrics
  getServerMetrics(): Promise<ServerMetricsJson>;

  // Adds a new access key to this server.
  addAccessKey(): Promise<AccessKey>;

  // Renames the access key given by id.
  renameAccessKey(accessKeyId: AccessKeyId, name: string): Promise<void>;

  // Removes the access key given by id.
  removeAccessKey(accessKeyId: AccessKeyId): Promise<void>;

  // Sets a default access key data transfer limit over a 30 day rolling window for all access keys.
  // This limit is overridden by per-key data limits.  Forces enforcement of all data limits,
  // including per-key data limits.
  setDefaultDataLimit(limit: DataLimit): Promise<void>;

  // Returns the server default access key data transfer limit, or undefined if it has not been set.
  getDefaultDataLimit(): DataLimit | undefined;

  // Removes the server default data limit.  Per-key data limits are still enforced.  Traffic is
  // tracked for if the limit is re-enabled.  Forces enforcement of all data limits, including
  // per-key limits.
  removeDefaultDataLimit(): Promise<void>;

  // Sets the custom data limit for a specific key. This limit overrides the server default limit
  // if it exists. Forces enforcement of the chosen key's data limit.
  setAccessKeyDataLimit(
    accessKeyId: AccessKeyId,
    limit: DataLimit
  ): Promise<void>;

  // Removes the custom data limit for a specific key.  The key is still bound by the server default
  // limit if it exists. Forces enforcement of the chosen key's data limit.
  removeAccessKeyDataLimit(accessKeyId: AccessKeyId): Promise<void>;

  // Returns whether metrics are enabled.
  getMetricsEnabled(): boolean;

  // Updates whether metrics are enabled.
  setMetricsEnabled(metricsEnabled: boolean): Promise<void>;

  // Gets the ID used for metrics reporting.
  getMetricsId(): string;

  // Checks if the server is healthy.
  isHealthy(): Promise<boolean>;

  // Gets the date when this server was created.
  getCreatedDate(): Date;

  // Returns the server's domain name or IP address.
  getHostnameForAccessKeys(): string;

  // Changes the hostname for shared access keys.
  setHostnameForAccessKeys(hostname: string): Promise<void>;

  // Returns the server's management API URL.
  getManagementApiUrl(): string;

  // Returns the port number for new access keys.
  // Returns undefined if the server doesn't have a port set.
  getPortForNewAccessKeys(): number | undefined;

  // Changes the port number for new access keys.
  setPortForNewAccessKeys(port: number): Promise<void>;
}

// Manual servers are servers which the user has independently setup to run
// shadowbox, and can be on any cloud provider.
export interface ManualServer extends Server {
  getCertificateFingerprint(): string | undefined;

  forget(): void;
}

// Error thrown when monitoring an installation that the user canceled.
export class ServerInstallCanceledError extends CustomError {
  constructor(message?: string) {
    super(message);
  }
}

// Error thrown when server installation failed.
export class ServerInstallFailedError extends CustomError {
  constructor(message?: string) {
    super(message);
  }
}

// Managed servers are servers created by the Outline Manager through our
// "magic" user experience, e.g. DigitalOcean.
export interface ManagedServer extends Server {
  // Yields how far installation has progressed (0.0 to 1.0).
  // Exits when installation has completed. Throws ServerInstallFailedError or
  // ServerInstallCanceledError if installation fails or is canceled.
  monitorInstallProgress(): AsyncGenerator<number, void>;
  // Returns server host object.
  getHost(): ManagedServerHost;
}

// The managed machine where the Outline Server is running.
export interface ManagedServerHost {
  // Returns the monthly outbound transfer limit.
  getMonthlyOutboundTransferLimit(): DataAmount;
  // Returns the monthly cost.
  getMonthlyCost(): MonetaryCost;
  // Returns the server location
  getCloudLocation(): CloudLocation;
  // Deletes the server - cannot be undone.
  delete(): Promise<void>;
}

export class DataAmount {
  terabytes: number;
}

export class MonetaryCost {
  // Value in US dollars.
  usd: number;
}

// Configuration for manual servers.  This is the output emitted from the
// shadowbox install script, which is needed for the manager connect to
// shadowbox.
export interface ManualServerConfig {
  apiUrl: string;
  certSha256?: string;
}

// Repository of ManualServer objects.  These are servers the user has setup
// themselves, and configured to run shadowbox, outside of the manager.
export interface ManualServerRepository {
  // Lists all existing Shadowboxes.
  listServers(): Promise<ManualServer[]>;
  // Adds a manual server using the config (e.g. user input).
  addServer(config: ManualServerConfig): Promise<ManualServer>;
  // Retrieves a server with `config`.
  findServer(config: ManualServerConfig): ManualServer | undefined;
}

export type AccessKeyId = string;

export interface AccessKey {
  id: AccessKeyId;
  name: string;
  accessUrl: string;
  dataLimit?: DataLimit;
}

// Data transfer allowance, measured in bytes.
// NOTE: Must be kept in sync with the definition in src/shadowbox/access_key.ts.
export interface DataLimit {
  readonly bytes: number;
}

export type ServerMetricsJson = {
  server: {
    location: string;
    asn: number;
    asOrg: string;
    tunnelTime?: {
      seconds: number;
    };
    dataTransferred?: {
      bytes: number;
    };
  }[];
  accessKeys: {
    accessKeyId: number;
    tunnelTime?: {
      seconds: number;
    };
    dataTransferred?: {
      bytes: number;
    };
  }[];
};
