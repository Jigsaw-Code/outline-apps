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

import {Server} from '../model/server';
import {ServerCard} from './server_card';

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
        ></server-card>
      </template>
    `;
  }

  // Need to declare localize function passed in from parent, or else
  // localize() calls within the template won't be updated.

  // @polymer/decorators doesn't support Function constructors...
  @property({type: Object}) localize: (messageId: string) => string;
  @property({type: String}) rootPath: string;
  @property({type: Array}) servers: Server[] = [];

  @computed('servers')
  get hasSingleServer() {
    return this.servers.length === 1;
  }

  private get serverCards(): Iterable<ServerCard> {
    return this.shadowRoot.querySelectorAll<ServerCard>('server-card');
  }

  getServerCard(serverId: string): ServerCard {
    for (const card of this.serverCards) {
      if (card.serverId === serverId) {
        return card;
      }
    }

    throw new Error(`Card for server ${serverId} not found`);
  }
}
