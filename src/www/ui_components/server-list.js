/*
  Copyright 2020 The Outline Authors

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

import './server-card.js';

import {Polymer} from '@polymer/polymer/lib/legacy/polymer-fn.js';
import {html} from '@polymer/polymer/lib/utils/html-tag.js';

Polymer({
  _template: html`
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
        padding: 0 8px; /* Necessary for smaller displays */
      }
      @media (min-width: 600px) {
        server-card {
          margin: 24px auto;
          max-width: 550px;
        }
      }
    </style>
    <template is="dom-repeat" items="[[servers]]">
      <server-card server-id="[[item.id]]" server-name="[[_computeServerName(item.name, item.isOutlineServer)]]" server-address="[[item.address]]" error-message="[[localize(item.errorMessageId)]]" disabled="[[item.errorMessageId]]" localize="[[localize]]" root-path="[[rootPath]]" expanded="[[hasSingleServer]]"></server-card>
    </template>
`,

  is: 'server-list',

  properties: {
    // Need to declare localize function passed in from parent, or else
    // localize() calls within the template won't be updated.
    localize: Function,
    rootPath: String,
    servers: Array,
    hasSingleServer: {
      type: Boolean,
      computed: '_computeHasSingleServer(servers)',
    },
  },

  getServerCard: function(serverId) {
    var cards = this.shadowRoot.querySelectorAll('server-card');
    for (var i = 0, card = cards[i]; card; card = cards[++i]) {
      if (card.serverId === serverId) {
        return card;
      }
    }
    throw new Error(`Card for server ${serverId} not found`);
  },

  _computeHasSingleServer: function(servers) {
    return !!servers && servers.length === 1;
  },

  _computeServerName: function(serverName, isOutlineServer) {
    if (serverName) {
      return serverName;
    }
    return isOutlineServer ? this.localize('server-default-name-outline') :
                             this.localize('server-default-name');
  }
});
