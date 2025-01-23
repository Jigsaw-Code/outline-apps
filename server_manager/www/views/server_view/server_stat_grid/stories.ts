/**
 * Copyright 2024 The Outline Authors
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
import {ServerStatGrid} from './index';

export default {
  title: 'Manager/Server View/Server Stat Grid',
  component: 'server-stats-grid',
  args: {
    columns: 3,
    rows: 2,
    stats: [
      {
        icon: 'swap_horiz',
        name: 'Data transferred / last 30 days',
        units: 'GB',
        value: 2345,
      },
      {
        icon: 'timer',
        name: 'Average time spent across clients',
        units: 'Client Hours / Hour',
        value: 83.7,
        column: '3',
        row: '1 / 3',
      },
      {
        icon: 'key',
        name: 'Server access',
        units: 'Keys',
        value: 155,
        row: '1',
        column: '1 / 3',
      },
      {
        icon: 'cloud',
        name: 'Allowance Used',
        units: '/ 15 TB',
        value: 12.3,
      },
    ],
  },
};

export const Example = ({stats, columns, rows}: ServerStatGrid) => html`
  <div style="height: 80vh;">
    <server-stat-grid
      columns=${columns}
      rows=${rows}
      .stats=${stats}
    ></server-stat-grid>
  </div>
`;
