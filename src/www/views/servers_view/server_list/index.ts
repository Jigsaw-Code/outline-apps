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

import '../server_list_item/server_card';
import {ServerListItem} from '../server_list_item';
import {Localizer} from 'src/infrastructure/i18n';

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
          padding: 8px;
          box-sizing: border-box;
        }

        server-row-card {
          margin: 0 auto 8px auto;
          height: 130px;
        }

        server-hero-card {
          height: 400px;
        }
      </style>

      <!-- TODO(daniellacosse): use slots instead after we move this to lit -->
      <template is="dom-repeat" items="[[servers]]">
        <template is="dom-if" if="[[hasSingleServer]]">
          <server-hero-card localize="[[localize]]" server="[[item]]"></server-hero-card>
        </template>
        <template is="dom-if" if="[[!hasSingleServer]]">
          <server-row-card localize="[[localize]]" server="[[item]]"></server-row-card>
        </template>
      </template>
    `;
  }

  // Need to declare localize function passed in from parent, or else
  // localize() calls within the template won't be updated.

  // @polymer/decorators doesn't support Function constructors...
  @property({type: Object}) localize: Localizer;
  @property({type: Array}) servers: ServerListItem[] = [];

  @computed('servers')
  get hasSingleServer() {
    return this.servers.length === 1;
  }

  getErrorMessage(errorMessageId: string) {
    if (typeof errorMessageId === 'string') {
      return this.localize(errorMessageId);
    }
  }
}
