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

import './index';

export default {
  title: 'Manager/Server View/Server Metrics Row',
  component: 'server-metrics-row',
  argTypes: {
    annotation: {control: 'text'},
    subcards: {control: 'object'},
    subtitle: {control: 'text'},
    title: {control: 'text'},
    titleIcon: {control: 'text'},
    tooltip: {control: 'text'},
    value: {control: 'text'},
    valueLabel: {control: 'text'},
  },
};

export const Example = {
  args: {
    title: 'Total Tunnel Time <i>(last 30 days)</i>',
    value: '43.5',
    valueLabel: 'Total hours',
    subtitle: 'ASNs with highest Tunnel Time <i>(last 30 days)</i>',
    tooltip:
      'Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit.\nDonec a diam lectus.',
    titleIcon: 'timer',
    subcards: [
      {
        highlight: '14.1hrs',
        title: 'Spectrum Online Systems Inc',
        subtitle: 'ASN3149',
        icon: '🇺🇸',
      },
      {
        highlight: '14.1hrs',
        title: 'Spectrum Online Systems Inc',
        subtitle: 'ASN3149',
        icon: '🇺🇸',
      },
      {
        highlight: '14.1hrs',
        title: 'Spectrum Online Systems Inc',
        subtitle: 'ASN3149',
        icon: '🇺🇸',
      },
      {
        highlight: '14.1hrs',
        title: 'Spectrum Online Systems Inc',
        subtitle: 'ASN3149',
        icon: '🇺🇸',
      },
    ],
  },
};
