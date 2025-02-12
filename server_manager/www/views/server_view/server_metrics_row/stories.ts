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
    .localize=${(key: string) => {
      return {
        'server-view-server-metrics-bandwidth-title': 'Total bandwidth used',
        'server-view-server-metrics-bandwidth-as-breakdown':
          'ASNs with highest bandwidth usage',
        'server-view-server-metrics-bandwidth-tooltip':
          'This shows the total amount of data transferred through the server over the last 30 days.',
        'server-view-server-metrics-bandwidth-usage': 'Current bandwidth usage',
        'server-view-server-metrics-bandwidth-usage-max':
          'Maximum bandwidth usage <i>(last 30 days)</i>',
      }[key];
    }}
    totalBytes=${380 * 1000 * 1000 * 1000}
    limitBytes=${1 * 1000 * 1000 * 1000 * 1000}
    limitThreshold=${0.8}
    currentBytes=${1.2 * 1000 * 1000 * 1000}
    peakBytes=${20.8 * 1000 * 1000 * 1000}
    peakTimestamp="2/19/2025 22:41:38"
    .locations=${[
      {
        bytes: 265 * 1000 * 1000 * 1000,
        asOrg: 'Iran Telecommunication Company PJS',
        asn: 'AS58224',
        countryFlag: '🇮🇷',
      },
      {
        bytes: 46 * 1000 * 1000 * 1000,
        asOrg: 'Mobile Communication Company of Iran PLC',
        asn: 'AS197207',
        countryFlag: '🇮🇷',
      },
      {
        bytes: 41 * 1000 * 1000 * 1000,
        asOrg: 'IRANCELL-AS',
        asn: 'AS44244',
        countryFlag: '🇮🇷',
      },
      {
        bytes: 28 * 1000 * 1000 * 1000,
        asOrg: 'Myanma Posts and Telecommunications',
        asn: 'AS9988',
        countryFlag: '🇲🇲',
      },
    ]}
  ></server-metrics-bandwidth-row>`;
};

export const BandwidthWarning = () => {
  return html`<server-metrics-bandwidth-row
    .localize=${(key: string) => {
      return {
        'server-view-server-metrics-bandwidth-title': 'Total bandwidth used',
        'server-view-server-metrics-bandwidth-as-breakdown':
          'ASNs with highest bandwidth usage',
        'server-view-server-metrics-bandwidth-tooltip':
          'This shows the total amount of data transferred through the server over the last 30 days.',
        'server-view-server-metrics-bandwidth-limit-tooltip':
          'High bandwidth usage detected over the last 30 days. Consider setting data limits to prevent overages and keep your service running smoothly. <a href="https://support.google.com/outline/answer/15331326" target="_blank">Learn more.</a>',
        'server-view-server-metrics-bandwidth-usage': 'Current bandwidth usage',
        'server-view-server-metrics-bandwidth-usage-max':
          'Maximum bandwidth usage <i>(last 30 days)</i>',
      }[key];
    }}
    totalBytes=${800 * 1000 * 1000 * 1000}
    limitBytes=${1 * 1000 * 1000 * 1000 * 1000}
    limitThreshold=${0.8}
    currentBytes=${1.2 * 1000 * 1000 * 1000}
    peakBytes=${20.8 * 1000 * 1000 * 1000}
    peakTimestamp="2/19/2025 22:41:38"
    .locations=${[
      {
        bytes: 265 * 1000 * 1000 * 1000,
        asOrg: 'Iran Telecommunication Company PJS',
        asn: 'AS58224',
        countryFlag: '🇮🇷',
      },
      {
        bytes: 46 * 1000 * 1000 * 1000,
        asOrg: 'Mobile Communication Company of Iran PLC',
        asn: 'AS197207',
        countryFlag: '🇮🇷',
      },
      {
        bytes: 41 * 1000 * 1000 * 1000,
        asOrg: 'IRANCELL-AS',
        asn: 'AS44244',
        countryFlag: '🇮🇷',
      },
      {
        bytes: 28 * 1000 * 1000 * 1000,
        asOrg: 'Myanma Posts and Telecommunications',
        asn: 'AS9988',
        countryFlag: '🇲🇲',
      },
    ]}
  ></server-metrics-bandwidth-row>`;
};

export const TunnelTime = () => {
  return html`<server-metrics-tunnel-time-row
    .localize=${(key: string) => {
      return {
        'server-view-server-metrics-tunnel-time-title':
          'Total tunnel time <i>(last 30 days)</i>',
        'server-view-server-metrics-tunnel-time-as-breakdown':
          'ASNs with highest tunnel time',
        'server-view-server-metrics-tunnel-time-tooltip': 'Lorem ipsum',
      }[key];
    }}
    totalHours=${1573}
    .regions=${[
      {
        seconds: 1080 * 60 * 60,
        asOrg: 'Iran Telecommunication Company PJS',
        asn: 'AS58224',
        countryFlag: '🇮🇷',
      },
      {
        seconds: 194 * 60 * 60,
        asOrg: 'IRANCELL-AS',
        asn: 'AS44244',
        countryFlag: '🇮🇷',
      },
      {
        seconds: 186 * 60 * 60,
        asOrg: 'Mobile Communication Company of Iran PLC',
        asn: 'AS197207',
        countryFlag: '🇮🇷',
      },
      {
        seconds: 98 * 60 * 60,
        asOrg: 'Myanma Posts and Telecommunications',
        asn: 'AS9988',
        countryFlag: '🇲🇲',
      },
    ]}
  ></server-metrics-tunnel-time-row>`;
};
