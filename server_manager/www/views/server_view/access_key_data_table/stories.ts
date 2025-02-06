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
          'server-view-access-keys-key-column-header': 'Key',
          'server-view-access-keys-usage-column-header':
            'Usage <i>(last 30 days)</i>',
          'server-view-access-keys-usage-tooltip': 'Lorem ipsum',
          'server-view-access-keys-as-count-column-header':
            'Total ASes seen <i>(last 30 days)</i>',
          'server-view-access-keys-as-count-tooltip': 'Lorem ipsum',
          'server-view-access-keys-usage-limit': '(80%+ used)',
          'server-access-key-rename': 'Rename',
          remove: 'Remove',
          'data-limit': 'Data Limit',
        } as {[key: string]: string}
      )[key];
    },
    accessKeys: [
      {
        id: 'ss://key1.com:3000',
        name: 'Key#1',
        connected: false,
        dataUsageBytes: 100000000,
        dataLimitBytes: 10000000000,
        asnCount: 3,
      },
      {
        id: 'ss://key2.com:3000',
        name: 'Key#2',
        connected: true,
        dataUsageBytes: 8000000000,
        dataLimitBytes: 10000000000,
        asnCount: 5,
      },
      {
        id: 'ss://key3.com:3000',
        name: 'Key#3',
        connected: false,
        dataUsageBytes: 6500000000,
        dataLimitBytes: 10000000000,
        asnCount: 2,
      },
    ],
    sortColumnId: 'asnCount',
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
