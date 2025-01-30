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
  title: 'Manager/Server View/Server Metrics Row/Server Metrics Row Subcard',
  component: 'server-metrics-row-subcard',
  argTypes: {
    highlight: {control: 'text'},
    title: {control: 'text'},
    subtitle: {control: 'text'},
    icon: {control: 'text'},
  },
};

export const Example = {
  args: {
    highlight: '14.1hrs',
    title: 'Spectrum Online Systems Inc',
    subtitle: 'ASN3149',
    icon: '🇺🇸',
  },
};
