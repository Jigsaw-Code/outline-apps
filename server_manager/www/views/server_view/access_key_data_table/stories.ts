/**
 * Copyright 2025 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {html} from 'lit';

import './index';
import {DataTableSortDirection} from './data_table';
import {AccessKeyDataTable} from './index';

export default {
  title: 'Manager/Server View/Access Key Data Table',
  component: 'access-keydata-table',
  args: {
    localize: (key: string) => {
      return (
        {
          'server-view-access-keys-last-connected-column-header':
            'Last connected',
          'server-view-access-keys-last-connected-tooltip':
            'This shows the last time the key successfully connected to the server.',
          'server-view-access-keys-last-active-column-header': 'Last active',
          'server-view-access-keys-last-active-tooltip':
            'This shows the last time the key sent or received data through the server. If this time is significantly earlier than the last connected time, the key could be connecting but failing to sending data. ',
          'server-view-access-keys-peak-devices-column-header':
            'Peak devices <i>(last 30 days)</i>',
          'server-view-access-keys-peak-devices-tooltip':
            'This shows the most devices connected to the server using this key at one time, within the last 30 days. It also shows the time when this occurred.',
          'server-view-access-keys-key-column-header': 'Key',
          'server-view-access-keys-usage-column-header':
            'Usage <i>(last 30 days)</i>',
          'server-view-access-keys-usage-tooltip':
            'This shows how much data the key transferred through the server over the last 30 days.',
          'server-view-access-keys-usage-limit': '(80%+ used)',
          'server-access-key-rename': 'Rename',
          remove: 'Remove',
          'data-limit': 'Data Limit',
        } as {[key: string]: string}
      )[key];
    },
    accessKeys: [
      {
        id: '0',
        name: 'Key 001',
        isOnline: true,
        connection: {
          lastTrafficSeen: new Date('2/19/2025 16:54:03'),
          peakDeviceCount: {
            data: 3,
            timestamp: new Date('2/17/2025 18:32:07'),
          },
        },
        dataTransferred: {
          bytes: 62 * 1000 * 1000,
        },
        dataLimit: {
          bytes: 100 * 1000 * 1000,
        },
      },
      {
        id: '1',
        name: 'Key 002',
        isOnline: true,
        connection: {
          lastTrafficSeen: new Date('2/19/2025 17:02:21'),
          peakDeviceCount: {
            data: 17,
            timestamp: new Date('2/19/2025 22:41:38'),
          },
        },
        dataTransferred: {
          bytes: 86 * 1000 * 1000,
        },
        dataLimit: {
          bytes: 100 * 1000 * 1000,
        },
      },
      {
        id: '2',
        name: 'Key 003',
        isOnline: false,
        connection: {
          lastTrafficSeen: new Date('1/30/2025 7:02:31'),
          peakDeviceCount: {
            data: 2,
            timestamp: new Date('1/29/2025 8:48:29'),
          },
        },
        dataTransferred: {
          bytes: 45 * 1000 * 1000,
        },
        dataLimit: {
          bytes: 100 * 1000 * 1000,
        },
      },
      {
        id: '3',
        name: 'Key 004',
        isOnline: false,
        connection: {
          lastTrafficSeen: new Date('9/14/2024 19:17:51'),
          peakDeviceCount: {
            data: 0,
            timestamp: new Date('1/29/2025 8:48:29'),
          },
        },
        dataTransferred: {
          bytes: 0 * 1000 * 1000,
        },
        dataLimit: {
          bytes: 100 * 1000 * 1000,
        },
      },
    ],
    sortColumnId: 'peakDevices',
    sortDirection: DataTableSortDirection.DESCENDING,
    language: 'en',
  },
};

export const Example = ({
  accessKeys,
  localize,
  language,
  sortColumnId,
  sortDirection,
}: AccessKeyDataTable) => {
  return html`<access-key-data-table
    .accessKeys=${accessKeys}
    .localize=${localize}
    language=${language}
    sortColumnId=${sortColumnId}
    sortDirection=${sortDirection}
  />`;
};
