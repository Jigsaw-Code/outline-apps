/*
  Copyright 2025 The Outline Authors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import {html} from 'lit';

import {ServerListItem} from '../servers_view';
import {ServerConnectionState} from '../servers_view/server_connection_indicator';

import './index';
import { RootView } from './index';

export default {
  title: 'Root View',
  component: 'root-view',
  args: {
    appVersion: '1.2.3',
    servers: [
      {
        id: 'server-1',
        name: 'My First Server',
        address: '127.0.0.1:12345',
        connectionState: ServerConnectionState.CONNECTED,
      },
      {
        id: 'server-2',
        name: 'My Second Server',
        address: '192.168.1.1:80',
        connectionState: ServerConnectionState.DISCONNECTED,
      },
      {
        id: 'server-3',
        name: 'A Server With A Very Long Name That Should Be Truncated',
        address: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        connectionState: ServerConnectionState.DISCONNECTED,
        errorMessageId: 'error-feedback-submission',
      },
    ] as ServerListItem[]
  }
}

export const Example = ({appVersion, servers}: RootView) =>
  html`<root-view .appVersion=${appVersion} .servers=${servers}></root-view>`;

