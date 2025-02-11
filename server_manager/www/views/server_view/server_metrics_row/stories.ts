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

import './tunnel_time';
import './bandwidth';

export default {
  title: 'Manager/Server View/Server Metrics Row',
};

export const Bandwidth = () => {
  return html`<server-metrics-bandwidth-row
    title="Total bandwidth used"
    titleIcon="data_usage"
    tooltip="Lorem ipsum"
    totalBandwidthBytes=${380 * 1000 * 1000 * 1000}
    bandwidthLimitBytes=${1 * 1000 * 1000 * 1000 * 1000}
    totalBandwidthTitle="Total bandwidth used"
    bandwidthLimitThreshold=${0.8}
    bandwidthLimitTooltip="Bandwidth usage is hih. Set data limits for your keys in the access key table to avoid potential issues"
    currentBandwidthBytes=${1.2 * 1000 * 1000 * 1000}
    currentBandwidthTitle="Current bandwidth usage"
    peakBandwidthBytes=${20.8 * 1000 * 1000 * 1000}
    peakBandwidthTimestamp="2/19/2025 22:41:38"
    peakBandwidthTitle="Maximum bandwidth usage (last 30 days)"
    bandwidthAsnTitle="ASNs with highest bandwidth usage"
    .bandwidthAsns=${[
      {
        bandwidthBytes: 265 * 1000 * 1000 * 1000,
        asOrg: 'Iran Telecommunication Company PJS',
        asn: 'AS58224',
        countryFlag: '🇮🇷',
      },
      {
        bandwidthBytes: 46 * 1000 * 1000 * 1000,
        asOrg: 'Mobile Communication Company of Iran PLC',
        asn: 'AS197207',
        countryFlag: '🇮🇷',
      },
      {
        bandwidthBytes: 41 * 1000 * 1000 * 1000,
        asOrg: 'IRANCELL-AS',
        asn: 'AS44244',
        countryFlag: '🇮🇷',
      },
      {
        bandwidthBytes: 28 * 1000 * 1000 * 1000,
        asOrg: 'Myanma Posts and Telecommunications',
        asn: 'AS9988',
        countryFlag: '🇲🇲',
      },
    ]}
  ></server-metrics-bandwidth-row>`;
};

export const TunnelTime = () => {
  return html`<server-metrics-tunnel-time-row
    title="Total Tunnel Time <i>(last 30 days)</i>"
    titleIcon="timer"
    tooltip="Lorem ipsum"
    totalTunnelTimeHours=${1573}
    tunnelTimeAsnTitle="ASNs with highest Tunnel Time <i>(last 30 days)</i>"
    .tunnelTimeAsns=${[
      {
        tunnelTimeHours: 1080,
        asOrg: 'Iran Telecommunication Company PJS',
        asn: 'AS58224',
        countryFlag: '🇮🇷',
      },
      {
        tunnelTimeHours: 194,
        asOrg: 'IRANCELL-AS',
        asn: 'AS44244',
        countryFlag: '🇮🇷',
      },
      {
        tunnelTimeHours: 186,
        asOrg: 'Mobile Communication Company of Iran PLC',
        asn: 'AS197207',
        countryFlag: '🇮🇷',
      },
      {
        tunnelTimeHours: 98,
        asOrg: 'Myanma Posts and Telecommunications',
        asn: 'AS9988',
        countryFlag: '🇲🇲',
      },
    ]}
  ></server-metrics-tunnel-time-row>`;
};
