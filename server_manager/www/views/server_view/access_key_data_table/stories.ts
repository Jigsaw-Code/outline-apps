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
        nameAndStatus: 'Key#1',
        dataUsageAndLimit: '100000000,10000000000',
        asCount: '3',
        controlsForId: 'ss://key1.com:3000',
      },
      {
        nameAndStatus: 'Key#2,true',
        dataUsageAndLimit: '8000000000,10000000000',
        asCount: '5',
        controlsForId: 'ss://key2.com:3000',
      },
      {
        nameAndStatus: 'Key#3',
        dataUsageAndLimit: '6500000000,10000000000',
        asCount: '2',
        controlsForId: 'ss://key3.com:3000',
      },
    ],
    sortColumn: 'nameAndStatus',
    sortDescending: true,
    language: 'en',
  },
};

export const Example = ({
  accessKeys,
  localize,
  language,
  sortColumn,
  sortDescending,
}: AccessKeyDataTable) => {
  return html`<access-key-data-table
    .accessKeys=${accessKeys}
    .localize=${localize}
    language=${language}
    .sortColumn=${sortColumn}
    .sortDescending=${sortDescending}
  />`;
};
