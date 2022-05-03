/* tslint:disable */
/*
  Copyright 2022 The Outline Authors

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

import './server_card';
import {ServerCard as ServerCardElement} from './server_card';

import {localize} from '../../../.storybook/localize';
import {ServerConnectionState} from '../server_connection_indicator';

export default {
  title: 'Servers View/Server List Item',
  component: 'server-card',
  args: {
    server: {
      name: 'My Server',
      address: '1.0.0.127',
      connectionState: ServerConnectionState.INITIAL,
    },
    expanded: false,
    disabled: false,
  },
  argTypes: {
    server: {
      object: 'select',
    },
    expanded: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export const ServerCard = ({server, disabled, expanded}: ServerCardElement) => {
  return html`
    <div style="width: 100%; height: 300px;">
      <server-card .localize=${localize} .server=${server} ?expanded=${expanded} ?disabled=${disabled}></server-card>
    </div>
  `;
};