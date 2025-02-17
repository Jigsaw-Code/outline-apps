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
  title: 'Manager/Server View/Access Key Data Table/Access Key Controls',
  component: 'access-key-controls',
};

export const Example = {
  args: {
    accessKey: {
      id: 'ss://key.com:3000',
      name: 'key',
    },
    localize: (key: string) => {
      return (
        {
          'server-access-key-rename': 'Rename',
          remove: 'Remove',
          'data-limit': 'Data Limit',
        } as {[key: string]: string}
      )[key];
    },
    serverVersion: '1.6.0',
  },
};
