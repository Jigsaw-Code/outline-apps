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

import {sleep} from '@outline/infrastructure/sleep';
import {ValueStream} from '@outline/infrastructure/value_stream';

import {makePathApiClient} from './fetcher';
import {ShadowboxServer} from './shadowbox_server';
import * as gcp_api from '../cloud/gcp_api';
import {Zone} from '../model/gcp';
import * as server from '../model/server';
import {DataAmount, ManagedServerHost, MonetaryCost} from '../model/server';

enum InstallState {
  // Unknown state - server request may still be pending.
  UNKNOWN = 0,
  // The instance has been created.
  INSTANCE_CREATED,
  // The static IP has been allocated.
  IP_ALLOCATED,
  // The system has booted (detected by the creation of guest tags)
  INSTANCE_RUNNING,
  // The server has generated its management service certificate.
  CERTIFICATE_CREATED,
  // Server is running and has the API URL and certificate fingerprint set.
  COMPLETED,
  // Server installation failed.
  FAILED,
  // Server installation was canceled by the user.
  CANCELED,
}

function getCompletionFraction(state: InstallState): number {
  // Values are based on observed installation timing.
  // Installation typically takes ~2.6 minutes in total.
  switch (state) {
    case InstallState.UNKNOWN:
      return 0.01;
    case InstallState.INSTANCE_CREATED:
      return 0.12;
    case InstallState.IP_ALLOCATED:
      return 0.14;
    case InstallState.INSTANCE_RUNNING:
      return 0.4;
    case InstallState.CERTIFICATE_CREATED:
      return 0.7;
    case InstallState.COMPLETED:
      return 1.0;
    default:
      return 0;
  }
}

function isFinal(state: InstallState): boolean {
  return (
    state === InstallState.COMPLETED ||
    state === InstallState.FAILED ||
    state === InstallState.CANCELED
  );
}

export class GcpServer extends ShadowboxServer implements server.ManagedServer {
  private static readonly GUEST_ATTRIBUTES_POLLING_INTERVAL_MS = 5 * 1000;

  private readonly instanceReadiness: Promise<void>;
  private readonly gcpHost: GcpHost;
  private readonly installState = new ValueStream<InstallState>(
    InstallState.UNKNOWN
  );

  constructor(
    id: string,
    private locator: gcp_api.InstanceLocator,
    private gcpInstanceName: string, // See makeGcpInstanceName() in gcp_account.ts.
    instanceCreation: Promise<unknown>,
    private apiClient: gcp_api.RestApiClient
  ) {
    super(id);
    // Optimization: start the check for a static IP immediately.
    const hasStaticIp: Promise<boolean> = this.hasStaticIp();
    this.instanceReadiness = instanceCreation
      .then(async () => {
        if (this.installState.isClosed()) {
          return;
        }
        this.setInstallState(InstallState.INSTANCE_CREATED);
        if (!(await hasStaticIp)) {
          await this.promoteEphemeralIp();
        }
        if (this.installState.isClosed()) {
          return;
        }
        this.setInstallState(InstallState.IP_ALLOCATED);
        this.pollInstallState(); // Start asynchronous polling.
      })
      .catch(e => {
        this.setInstallState(InstallState.FAILED);
        throw e;
      });
    this.gcpHost = new GcpHost(
      locator,
      gcpInstanceName,
      this.instanceReadiness,
      apiClient,
      this.onDelete.bind(this)
    );
  }

  private getRegionLocator(): gcp_api.RegionLocator {
    return {
      regionId: new Zone(this.locator.zoneId).regionId,
      projectId: this.locator.projectId,
    };
  }

  private async hasStaticIp(): Promise<boolean> {
    try {
      // By convention, the static IP for an Outline instance uses the instance's name.
      await this.apiClient.getStaticIp(
        this.getRegionLocator(),
        this.gcpInstanceName
      );
      return true;
    } catch (e) {
      if (is404(e)) {
        // The IP address has not yet been reserved.
        return false;
      }
      throw new server.ServerInstallFailedError(`Static IP check failed: ${e}`);
    }
  }

  private async promoteEphemeralIp(): Promise<void> {
    const instance = await this.apiClient.getInstance(this.locator);
    // Promote ephemeral IP to static IP
    const ipAddress = instance.networkInterfaces[0].accessConfigs[0].natIP;
    const createStaticIpData = {
      name: instance.name,
      description: instance.description,
      address: ipAddress,
    };
    const createStaticIpOperation = await this.apiClient.createStaticIp(
      this.getRegionLocator(),
      createStaticIpData
    );
    const operationErrors = createStaticIpOperation.error?.errors;
    if (operationErrors) {
      throw new server.ServerInstallFailedError(
        `Firewall creation failed: ${operationErrors}`
      );
    }
  }

  getHost(): ManagedServerHost {
    return this.gcpHost;
  }

  async *monitorInstallProgress(): AsyncGenerator<number, void> {
    for await (const state of this.installState.watch()) {
      yield getCompletionFraction(state);
    }

    if (this.installState.get() === InstallState.FAILED) {
      throw new server.ServerInstallFailedError();
    } else if (this.installState.get() === InstallState.CANCELED) {
      throw new server.ServerInstallCanceledError();
    }
    yield getCompletionFraction(this.installState.get());
  }

  private async pollInstallState(): Promise<void> {
    while (!this.installState.isClosed()) {
      const outlineGuestAttributes = await this.getOutlineGuestAttributes();
      if (
        outlineGuestAttributes.has('apiUrl') &&
        outlineGuestAttributes.has('certSha256')
      ) {
        const certSha256 = outlineGuestAttributes.get('certSha256');
        const apiUrl = outlineGuestAttributes.get('apiUrl');
        this.setManagementApi(makePathApiClient(apiUrl, atob(certSha256)));
        this.setInstallState(InstallState.COMPLETED);
        break;
      } else if (outlineGuestAttributes.has('install-error')) {
        this.setInstallState(InstallState.FAILED);
        break;
      } else if (outlineGuestAttributes.has('certSha256')) {
        this.setInstallState(InstallState.CERTIFICATE_CREATED);
      } else if (outlineGuestAttributes.has('install-started')) {
        this.setInstallState(InstallState.INSTANCE_RUNNING);
      }

      await sleep(GcpServer.GUEST_ATTRIBUTES_POLLING_INTERVAL_MS);
    }
  }

  private async getOutlineGuestAttributes(): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const guestAttributes = await this.apiClient.getGuestAttributes(
      this.locator,
      'outline/'
    );
    const attributes = guestAttributes?.queryValue?.items ?? [];
    attributes.forEach(entry => {
      result.set(entry.key, entry.value);
    });
    return result;
  }

  private setInstallState(newState: InstallState): void {
    console.debug(InstallState[newState]);
    this.installState.set(newState);
    if (isFinal(newState)) {
      this.installState.close();
    }
  }

  private onDelete(): void {
    if (!this.installState.isClosed()) {
      this.setInstallState(InstallState.CANCELED);
    }
  }
}

class GcpHost implements server.ManagedServerHost {
  constructor(
    private readonly locator: gcp_api.InstanceLocator,
    private readonly gcpInstanceName: string,
    private readonly instanceReadiness: Promise<unknown>,
    private readonly apiClient: gcp_api.RestApiClient,
    private readonly deleteCallback: () => void
  ) {}

  async delete(): Promise<void> {
    this.deleteCallback();
    // The GCP API documentation doesn't specify whether instances can be deleted
    // before creation has finished, and the static IP allocation is entirely
    // asynchronous, so we must wait for instance setup to complete before starting
    // deletion. Also, if creation failed, then deletion is trivially successful.
    try {
      await this.instanceReadiness;
    } catch (e) {
      console.warn(`Attempting deletion of server that failed setup: ${e}`);
    }
    const regionLocator = {
      regionId: this.getCloudLocation().regionId,
      projectId: this.locator.projectId,
    };
    // By convention, the static IP for an Outline instance uses the instance's name.
    await this.waitForDelete(
      this.apiClient.deleteStaticIp(regionLocator, this.gcpInstanceName),
      'Deleted server did not have a static IP'
    );
    await this.waitForDelete(
      this.apiClient.deleteInstance(this.locator),
      'No instance for deleted server'
    );
  }

  private async waitForDelete(
    deletion: Promise<gcp_api.ComputeEngineOperation>,
    msg404: string
  ): Promise<void> {
    try {
      await deletion;
      // We assume that deletion will eventually succeed once the operation has
      // been queued successfully, so there's no need to wait for it.
    } catch (e) {
      if (is404(e)) {
        console.warn(msg404);
        return;
      }
      throw e;
    }
  }

  getHostId(): string {
    return this.locator.instanceId;
  }

  getMonthlyCost(): MonetaryCost {
    return undefined;
  }

  getMonthlyOutboundTransferLimit(): DataAmount {
    return undefined;
  }

  getCloudLocation(): Zone {
    return new Zone(this.locator.zoneId);
  }
}

function is404(error: Error): boolean {
  return error instanceof gcp_api.HttpError && error.getStatusCode() === 404;
}
