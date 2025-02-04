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
    localize: () => 'Translation pending...',
    accessKeys: [
      {name: 'Key#1', dataUsage: '30 GB', dataLimit: '1 TB', asCount: '3'},
      {name: 'Key#2', dataUsage: '12 GB', dataLimit: '1 TB', asCount: '5'},
      {name: 'Key#3', dataUsage: '10 GB', dataLimit: '1 TB', asCount: '2'},
    ],
    sortColumn: 'key',
    sortDescending: true,
  },
};

export const Example = ({
  accessKeys,
  localize,
  sortColumn,
  sortDescending,
}: AccessKeyDataTable) => {
  return html`<access-key-data-table
    .accessKeys=${accessKeys}
    .localize=${localize}
    .sortColumn=${sortColumn}
    .sortDescending=${sortDescending}
  />`;
};
