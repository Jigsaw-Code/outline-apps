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

import {GcpServer} from './gcp_server';
import * as server_install from './server_install';
import * as gcp_api from '../cloud/gcp_api';
import {SCRIPT} from '../install_scripts/gcp_install_script';
import * as gcp from '../model/gcp';
import {BillingAccount, Project} from '../model/gcp';
import * as server from '../model/server';

/** Returns a unique, RFC1035-style name as required by GCE. */
function makeGcpInstanceName(): string {
  function pad2(val: number) {
    return val.toString().padStart(2, '0');
  }

  const now = new Date();
  const year = now.getUTCFullYear().toString();
  const month = pad2(now.getUTCMonth() + 1); // January is month 0.
  const day = pad2(now.getUTCDate());
  const hour = pad2(now.getUTCHours());
  const minute = pad2(now.getUTCMinutes());
  const second = pad2(now.getUTCSeconds());
  return `outline-${year}${month}${day}-${hour}${minute}${second}`;
}

// Regions where the first f1-micro instance is free.
// See https://cloud.google.com/free/docs/gcp-free-tier/#compute
const FREE_TIER_REGIONS = new Set<string>([
  'us-west1',
  'us-central1',
  'us-east1',
]);

export function isInFreeTier(zone: gcp.Zone): boolean {
  return FREE_TIER_REGIONS.has(zone.regionId);
}

/**
 * The Google Cloud Platform account model.
 */
export class GcpAccount implements gcp.Account {
  private static readonly OUTLINE_PROJECT_NAME = 'Outline servers';
  private static readonly OUTLINE_FIREWALL_NAME = 'outline';
  private static readonly OUTLINE_FIREWALL_TAG = 'outline';
  private static readonly MACHINE_SIZE = 'e2-micro';
  private static readonly REQUIRED_GCP_SERVICES = ['compute.googleapis.com'];

  private readonly apiClient: gcp_api.RestApiClient;

  constructor(
    private id: string,
    private refreshToken: string,
    private shadowboxSettings: server_install.ShadowboxSettings
  ) {
    this.apiClient = new gcp_api.RestApiClient(refreshToken);
  }

  getId(): string {
    return this.id;
  }

  /** @see {@link Account#getName}. */
  async getName(): Promise<string> {
    const userInfo = await this.apiClient.getUserInfo();
    return userInfo?.email;
  }

  /** Returns the refresh token. */
  getRefreshToken(): string {
    return this.refreshToken;
  }

  /** @see {@link Account#listServers}. */
  async listServers(projectId: string): Promise<server.ManagedServer[]> {
    const result: GcpServer[] = [];
    const filter = 'labels.outline=true';
    const listAllInstancesResponse = await this.apiClient.listAllInstances(
      projectId,
      filter
    );
    const instanceMap = listAllInstancesResponse?.items ?? {};
    Object.values(instanceMap).forEach(({instances}) => {
      instances?.forEach(instance => {
        const {zoneId} = gcp_api.parseZoneUrl(instance.zone);
        const locator = {projectId, zoneId, instanceId: instance.id};
        const id = `${this.id}:${instance.id}`;
        result.push(
          new GcpServer(
            id,
            locator,
            instance.name,
            Promise.resolve(),
            this.apiClient
          )
        );
      });
    });
    return result;
  }

  /** @see {@link Account#listLocations}. */
  async listLocations(projectId: string): Promise<gcp.ZoneOption[]> {
    const listZonesResponse = await this.apiClient.listZones(projectId);
    const zones = listZonesResponse.items ?? [];
    return zones.map(zoneInfo => ({
      cloudLocation: new gcp.Zone(zoneInfo.name),
      available: zoneInfo.status === 'UP',
    }));
  }

  /** @see {@link Account#listProjects}. */
  async listProjects(): Promise<Project[]> {
    const filter = 'labels.outline=true AND lifecycleState=ACTIVE';
    const response = await this.apiClient.listProjects(filter);
    if (response.projects?.length > 0) {
      return response.projects.map(project => {
        return {
          id: project.projectId,
          name: project.name,
        };
      });
    }
    return [];
  }

  /** @see {@link Account#createProject}. */
  async createProject(
    projectId: string,
    billingAccountId: string
  ): Promise<Project> {
    // Create GCP project
    const createProjectData = {
      projectId,
      name: GcpAccount.OUTLINE_PROJECT_NAME,
      labels: {
        outline: 'true',
      },
    };
    const createProjectResponse =
      await this.apiClient.createProject(createProjectData);
    let createProjectOperation = null;
    while (!createProjectOperation?.done) {
      await sleep(2 * 1000);
      createProjectOperation = await this.apiClient.resourceManagerOperationGet(
        createProjectResponse.name
      );
    }
    if (createProjectOperation.error) {
      // TODO: Throw error. The project wasn't created so we should have nothing to delete.
    }

    await this.configureProject(projectId, billingAccountId);

    return {
      id: projectId,
      name: GcpAccount.OUTLINE_PROJECT_NAME,
    };
  }

  async isProjectHealthy(projectId: string): Promise<boolean> {
    const projectBillingInfo =
      await this.apiClient.getProjectBillingInfo(projectId);
    if (!projectBillingInfo.billingEnabled) {
      return false;
    }

    const listEnabledServicesResponse =
      await this.apiClient.listEnabledServices(projectId);
    for (const requiredService of GcpAccount.REQUIRED_GCP_SERVICES) {
      const found = listEnabledServicesResponse.services.find(
        service => service.config.name === requiredService
      );
      if (!found) {
        return false;
      }
    }

    return true;
  }

  async repairProject(
    projectId: string,
    billingAccountId: string
  ): Promise<void> {
    return await this.configureProject(projectId, billingAccountId);
  }

  /** @see {@link Account#listBillingAccounts}. */
  async listOpenBillingAccounts(): Promise<BillingAccount[]> {
    const response = await this.apiClient.listBillingAccounts();
    if (response.billingAccounts?.length > 0) {
      return response.billingAccounts
        .filter(billingAccount => billingAccount.open)
        .map(billingAccount => ({
          id: billingAccount.name.substring(
            billingAccount.name.lastIndexOf('/') + 1
          ),
          name: billingAccount.displayName,
        }));
    }
    return [];
  }

  private async createFirewallIfNeeded(projectId: string): Promise<void> {
    // Configure Outline firewall
    const getFirewallResponse = await this.apiClient.listFirewalls(
      projectId,
      GcpAccount.OUTLINE_FIREWALL_NAME
    );
    if (
      !getFirewallResponse?.items ||
      getFirewallResponse?.items?.length === 0
    ) {
      const createFirewallData = {
        name: GcpAccount.OUTLINE_FIREWALL_NAME,
        direction: 'INGRESS',
        priority: 1000,
        targetTags: [GcpAccount.OUTLINE_FIREWALL_TAG],
        allowed: [
          {
            IPProtocol: 'all',
          },
        ],
        sourceRanges: ['0.0.0.0/0'],
      };
      const createFirewallOperation = await this.apiClient.createFirewall(
        projectId,
        createFirewallData
      );
      const errors = createFirewallOperation.error?.errors;
      if (errors) {
        throw new server.ServerInstallFailedError(
          `Firewall creation failed: ${errors}`
        );
      }
    }
  }

  /** @see {@link Account#createServer}. */
  async createServer(
    projectId: string,
    name: string,
    zone: gcp.Zone,
    metricsEnabled: boolean
  ): Promise<server.ManagedServer> {
    // TODO: Move this to project setup.
    await this.createFirewallIfNeeded(projectId);

    // Create VM instance
    const gcpInstanceName = makeGcpInstanceName();
    const createInstanceData = {
      name: gcpInstanceName,
      description: name, // Show a human-readable name in the GCP console
      machineType: `zones/${zone.id}/machineTypes/${GcpAccount.MACHINE_SIZE}`,
      disks: [
        {
          boot: true,
          initializeParams: {
            sourceImage:
              'projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts',
          },
        },
      ],
      networkInterfaces: [
        {
          network: 'global/networks/default',
          // Empty accessConfigs necessary to allocate ephemeral IP
          accessConfigs: [{}],
        },
      ],
      labels: {
        outline: 'true',
      },
      tags: {
        // This must match the firewall target tag.
        items: [GcpAccount.OUTLINE_FIREWALL_TAG],
      },
      metadata: {
        items: [
          {
            key: 'enable-guest-attributes',
            value: 'TRUE',
          },
          {
            key: 'user-data',
            value: this.getInstallScript(name, metricsEnabled),
          },
        ],
      },
    };
    const zoneLocator = {projectId, zoneId: zone.id};
    const createInstanceOperation = await this.apiClient.createInstance(
      zoneLocator,
      createInstanceData
    );
    const errors = createInstanceOperation.error?.errors;
    if (errors) {
      throw new server.ServerInstallFailedError(
        `Instance creation failed: ${errors}`
      );
    }

    const instanceId = createInstanceOperation.targetId;
    const instanceLocator = {instanceId, ...zoneLocator};
    const instanceCreation = this.apiClient.computeEngineOperationZoneWait(
      zoneLocator,
      createInstanceOperation.name
    );

    const id = `${this.id}:${instanceId}`;
    return new GcpServer(
      id,
      instanceLocator,
      gcpInstanceName,
      instanceCreation,
      this.apiClient
    );
  }

  private async configureProject(
    projectId: string,
    billingAccountId: string
  ): Promise<void> {
    // Link billing account
    const updateProjectBillingInfoData = {
      name: `projects/${projectId}/billingInfo`,
      projectId,
      billingAccountName: `billingAccounts/${billingAccountId}`,
    };
    await this.apiClient.updateProjectBillingInfo(
      projectId,
      updateProjectBillingInfoData
    );

    // Enable APIs
    const enableServicesData = {
      serviceIds: GcpAccount.REQUIRED_GCP_SERVICES,
    };
    const enableServicesResponse = await this.apiClient.enableServices(
      projectId,
      enableServicesData
    );
    let enableServicesOperation = null;
    while (!enableServicesOperation?.done) {
      await sleep(2 * 1000);
      enableServicesOperation = await this.apiClient.serviceUsageOperationGet(
        enableServicesResponse.name
      );
    }
    if (enableServicesResponse.error) {
      // TODO: Throw error.
    }
  }

  private getInstallScript(
    serverName: string,
    metricsEnabled: boolean
  ): string {
    return (
      '#!/bin/bash -eu\n' +
      server_install.getShellExportCommands(
        this.shadowboxSettings,
        serverName,
        metricsEnabled
      ) +
      SCRIPT
    );
  }
}
