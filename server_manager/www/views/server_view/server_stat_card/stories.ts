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
import {ServerStatCard} from './index';

export default {
  title: 'Manager/Server View/Server Stat Card',
  component: 'server-stats-card',
  args: {
    icon: 'swap_horiz',
    name: 'Data transferred / last 30 days',
    units: 'Bytes',
    value: 0,
  },
};

export const Example = ({icon, name, value, units}: ServerStatCard) => html`
  <div style="height: 300px;">
    <server-stat-card
      icon=${icon}
      name=${name}
      value=${value}
      units=${units}
    ></server-stat-card>
  </div>
`;
