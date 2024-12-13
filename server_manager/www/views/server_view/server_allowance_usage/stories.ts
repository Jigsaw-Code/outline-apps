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
import {ServerAllowanceUsage} from './index';

export default {
  title: 'Manager/Server View/Server Allowance Usage',
  component: 'server-allowance-usage',
  args: {
    message: 'Allowance used in the last 30 days',
    allowanceUsed: 0.38,
    allowanceLimit: 1,
  },
};

export const Example = ({
  message,
  allowanceUsed,
  allowanceLimit,
}: ServerAllowanceUsage) => html`
  <div style="height: 300px;">
    <style>
      :root {
        --server-allowance-usage-background: var(--outline-dark-primary);
        --server-allowance-usage-foreground: var(--outline-medium-gray);
        --server-allowance-usage-highlight: var(--outline-white);
        --server-allowance-usage-progress: var(--outline-primary);
      }
    </style>
    <server-allowance-usage
      message=${message}
      allowanceUsed=${allowanceUsed}
      allowanceLimit=${allowanceLimit}
    />
  </div>
`;
