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

import * as location from './location';
import {ManagedServer} from './server';

export class Zone implements location.CloudLocation {
  /** @see https://cloud.google.com/compute/docs/regions-zones */
  private static readonly LOCATION_MAP: {readonly [regionId: string]: location.GeoLocation} = {
    'asia-east1': location.CHANGHUA_COUNTY,
    'asia-east2': location.HONG_KONG,
    'asia-northeast1': location.TOKYO,
    'asia-northeast2': location.OSAKA,
    'asia-northeast3': location.SEOUL,
    'asia-south1': location.MUMBAI,
    'asia-south2': location.DELHI,
    'asia-southeast1': location.JURONG_WEST,
    'asia-southeast2': location.JAKARTA,
    'australia-southeast1': location.SYDNEY,
    'australia-southeast2': location.MELBOURNE,
    'europe-north1': location.HAMINA,
    'europe-west1': location.ST_GHISLAIN,
    'europe-west2': location.LONDON,
    'europe-west3': location.FRANKFURT,
    'europe-west4': location.EEMSHAVEN,
    'europe-west6': location.ZURICH,
    'europe-central2': location.WARSAW,
    'northamerica-northeast1': location.MONTREAL,
    'northamerica-northeast2': location.TORONTO,
    'southamerica-east1': location.SAO_PAULO,
    'us-central1': location.IOWA,
    'us-east1': location.SOUTH_CAROLINA,
    'us-east4': location.NORTHERN_VIRGINIA,
    'us-west1': location.OREGON,
    'us-west2': location.LOS_ANGELES,
    'us-west3': location.SALT_LAKE_CITY,
    'us-west4': location.LAS_VEGAS,
  };

  /** ID is a GCP Zone ID like "us-central1-a". */
  constructor(public readonly id: string) {}

  /** Returns a region ID like "us-central1". */
  get regionId(): string {
    return this.id.substring(0, this.id.lastIndexOf('-'));
  }

  get location(): location.GeoLocation {
    return Zone.LOCATION_MAP[this.regionId];
  }
}

export interface ZoneOption extends location.CloudLocationOption {
  readonly cloudLocation: Zone;
}

export type Project = {
  id: string;
  name: string;
};

export type BillingAccount = {
  id: string;
  name: string;
};

/**
 * The Google Cloud Platform account model.
 */
export interface Account {
  /**
   * Returns a globally unique identifier for this Account.
   */
  getId(): string;

  /**
   * Returns a user-friendly name associated with the account.
   */
  getName(): Promise<string>;

  /**
   * Creates an Outline server on a Google Compute Engine VM instance.
   *
   * This method returns after the VM instance has been created. The Shadowbox
   * Outline server may not be fully installed. See {@link ManagedServer#waitOnInstall}
   * to be notified when the server installation has completed.
   *
   * @param projectId - The GCP project ID.
   * @param name - The name to be given to the server.
   * @param zone - The GCP zone to create the server in.
   */
  createServer(projectId: string, name: string, zone: Zone): Promise<ManagedServer>;

  /**
   * Lists the Outline servers in a given GCP project.
   *
   * @param projectId - The GCP project ID.
   */
  listServers(projectId: string): Promise<ManagedServer[]>;

  /**
   * Lists the Google Compute Engine locations available to given GCP project.
   *
   * @param projectId - The GCP project ID.
   */
  listLocations(projectId: string): Promise<Readonly<ZoneOption[]>>;

  /**
   * Creates a new Google Cloud Platform project.
   *
   * The project ID must conform to the following:
   * - must be 6 to 30 lowercase letters, digits, or hyphens
   * - must start with a letter
   * - no trailing hyphens
   *
   * @param id - The project ID.
   * @param billingAccount - The billing account ID.
   */
  createProject(id: string, billingAccountId: string): Promise<Project>;

  /** Lists the Google Cloud Platform projects available with the user. */
  listProjects(): Promise<Project[]>;

  /**
   * Lists the active Google Cloud Platform billing accounts associated with
   * the user.
   */
  listOpenBillingAccounts(): Promise<BillingAccount[]>;
}
