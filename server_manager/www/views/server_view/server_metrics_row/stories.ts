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

export default {
  title: 'Manager/Server View/Server Metrics Row',
  component: 'server-metrics-row',
};

export const Example = () => {
  return html`
    <server-metrics-row
      title="Total bandwidth used"
      titleIcon="data_usage"
      value="38%"
      valueLabel="380 GB /1 TB"
      tooltip="Lorem ipsum"
      subtitle="ASNs with highest bandwidth usage"
      .subcards=${[
        {
          highlight: '265 GB',
          title: 'Iran Telecommunication Company PJS',
          subtitle: 'AS58224',
          icon: '🇮🇷',
        },
        {
          highlight: '46 GB',
          title: 'Mobile Communication Company of Iran PLC',
          subtitle: 'AS197207',
          icon: '🇮🇷',
        },
        {
          highlight: '41 GB',
          title: 'IRANCELL-AS',
          subtitle: 'AS44244',
          icon: '🇮🇷',
        },
        {
          highlight: '28 GB',
          title: 'Myanma Posts and Telecommunications',
          subtitle: 'AS9988',
          icon: '🇲🇲',
        },
      ]}
    ></server-metrics-row>
    <div style="padding: 0.5rem;"></div>
    <server-metrics-row
      title="Total Tunnel Time <i>(last 30 days)</i>"
      titleIcon="timer"
      value="1573"
      valueLabel="hours"
      tooltip="Lorem ipsum"
      subtitle="ASNs with highest Tunnel Time <i>(last 30 days)</i>"
      .subcards=${[
        {
          highlight: '1080 hours',
          title: 'Iran Telecommunication Company PJS',
          subtitle: 'AS58224',
          icon: '🇮🇷',
        },
        {
          highlight: '194 hours',
          title: 'IRANCELL-AS',
          subtitle: 'AS44244',
          icon: '🇮🇷',
        },
        {
          highlight: '186 hours',
          title: 'Mobile Communication Company of Iran PLC',
          subtitle: 'AS197207',
          icon: '🇮🇷',
        },
        {
          highlight: '98 hours',
          title: 'Myanma Posts and Telecommunications',
          subtitle: 'AS9988',
          icon: '🇲🇲',
        },
      ]}
    ></server-metrics-row>
  `;
};
