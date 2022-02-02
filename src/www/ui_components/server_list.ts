/*
  Copyright 2021 The Outline Authors
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

import {computed, customElement, property} from '@polymer/decorators';
import {html, PolymerElement} from '@polymer/polymer';

import {ServerCard} from './server_card';
import {ServerConnectionState} from './server_connection_viz';

export interface ServerCardModel {
  disabled: boolean;
  errorMessageId: string;
  isOutlineServer: boolean;
  address: string;
  id: string;
  name: string;
  state: ServerConnectionState;
}

@customElement('server-list')
export class ServerList extends PolymerElement {
  static get template() {
    return html`
      <style>
        :host {
          display: block;
          margin: 0 auto;
          width: 100%;
          height: 100%;
        }

        server-card {
          margin: 8px auto;
          max-width: 400px; /* better card spacing on pixel and iphone */
          padding: 0 8px; /* necessary for smaller displays */
        }

        @media (min-width: 600px) {
          server-card {
            margin: 24px auto;
            max-width: 550px;
          }
        }
      </style>

      <template is="dom-repeat" items="[[servers]]">
        <server-card 
          disabled="[[item.errorMessageId]]" 
          error-message="[[localize(item.errorMessageId)]]" 
          expanded="[[hasSingleServer]]"
          localize="[[localize]]" 
          root-path="[[rootPath]]" 
          server-address="[[item.address]]" 
          server-id="[[item.id]]"
          server-name="[[item.name]]" 
          is-outline-server="[[item.isOutlineServer]]"
          state="[[item.state]]"
        ></server-card>
      </template>
    `;
  }

  // Need to declare localize function passed in from parent, or else
  // localize() calls within the template won't be updated.

  // @polymer/decorators doesn't support Function constructors...
  @property({type: Object}) localize: (messageId: string) => string;
  @property({type: String}) rootPath: string;
  @property({type: Array}) servers: ServerCardModel[] = [];

  @computed('servers')
  get hasSingleServer() {
    return this.servers.length === 1;
  }
}
