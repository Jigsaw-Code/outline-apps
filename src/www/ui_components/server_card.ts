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
import {LegacyElementMixin} from '@polymer/polymer/lib/legacy/legacy-element-mixin';

import {ServerConnectionState} from './server_connection_viz';
@customElement('server-card') export class ServerCard extends LegacyElementMixin
(PolymerElement) {
  static template = html`
    <style>
      :host {
        display: block;
      }
      :focus {
        /* Disable outline for focused elements; mainly affects the iOS WebView,
        * where elements stay highlighted after user interaction.
        */
        outline: 0 !important;
      }
      paper-card {
        width: 100%;
      }
      paper-menu-button {
        color: #5f6368;
      }
      paper-item {
        white-space: nowrap;
      }
      paper-item:not([disabled]) {
        cursor: pointer;
      }
      .card-header {
        display: flex;
      }
      .card-content {
        text-align: center;
        padding: 10% 0;
      }
      .card-header server-connection-viz {
        padding: 16px 0 0 16px;
      }
      #serverInfo {
        flex: 1;
        padding: 16px 0 0 16px;
        font-size: 20px;
        /* Make the sever name and address copyable */
        -webkit-user-select: text; /* Safari */
        -ms-user-select: text; /* IE/Edge */
        user-select: text; /* Chrome */
      }
      #serverName {
        line-height: 32px;
        word-break: break-word;
      }
      #serverAddress {
        color: rgba(0, 0, 0, 0.54);
        font-size: small;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #server-visualization-button {
        background: none;
        border-radius: 100px;
        margin: 0;
        padding: 3px 3px 0;
      }
      .status-message {
        color: var(--disabled-text-color);
        font-size: small;
        font-weight: normal;
        margin: 12px 0;
        text-transform: capitalize;
      }
      .card-actions {
        display: flex;
        align-items: center;
        border-radius: 0 0 2px 2px;
        border-top: none;
      }
      .expanded .card-actions {
        background-color: var(--paper-grey-50);
        border-top: 1px solid #e8e8e8;
      }
      #connectButton {
        color: #2fbea5;
        font-weight: bold;
      }
      #connectButton[disabled] {
        color: var(--disabled-text-color);
        background: transparent;
      }
      #errorMessage {
        color: #f44336;
        margin-right: auto;
      }
      @media (max-width: 360px) {
        #serverInfo {
          font-size: 18px;
        }
        #serverName {
          line-height: 24px;
        }
      }
      @media (min-height: 600px) {
        .card-content {
          padding: 20% 0;
        }
      }
    </style>
    <paper-card class\$="[[expandedClassName]]">
      <div class="card-header">
        <server-connection-viz 
          state="[[state]]"
          root-path="[[rootPath]]"
          hidden\$="[[expanded]]"
        ></server-connection-viz>
        <div id="serverInfo">
          <div id="serverName">[[localizedServerName]]</div>
          <div id="serverAddress">[[serverAddress]]</div>
        </div>
        <paper-menu-button horizontal-align="right" close-on-activate="true">
          <paper-icon-button 
            icon="icons:more-vert"
            slot="dropdown-trigger"
          ></paper-icon-button>
          <paper-listbox 
            id="menu"
            slot="dropdown-content"
            on-iron-activate="onMenuItemPressed"
            attr-for-selected="name"
          >
            <paper-item name="rename">[[localize('server-rename')]]</paper-item>
            <paper-item name="forget">[[localize('server-forget')]]</paper-item>
          </paper-listbox>
        </paper-menu-button>
      </div>
      <div class="card-content" hidden\$="[[!expanded]]">
        <div>
          <paper-button 
            id="server-visualization-button"
            on-tap="onConnectToggled"
            disabled\$="[[connectButtonDisabled]]"
            noink=""
          >
            <server-connection-viz 
              state="[[state]]"
              root-path="[[rootPath]]"
              expanded=""
            ></server-connection-viz>
          </paper-button>
        </div>
        <div class\$="status-message [[state]]">[[statusMessage]]</div>
      </div>
      <div class="card-actions">
        <div id="errorMessage">[[errorMessage]]</div>
        <paper-button
          id="connectButton"
          on-tap="onConnectToggled"
          disabled\$="[[connectButtonDisabled]]"
        >
          [[connectButtonLabel]]
        </paper-button>
      </div>
    </paper-card>
  `;

  @property({type: Boolean}) disabled: boolean;
  @property({type: String}) errorMessage: string;
  @property({type: Boolean}) expanded = false;
  @property({type: Boolean}) isOutlineServer = true;
  @property({type: String}) rootPath: string;
  @property({type: String}) serverAddress: string;
  @property({type: String}) serverId: string;
  @property({type: String}) serverName: string;
  @property({type: String}) state: ServerConnectionState = ServerConnectionState.DISCONNECTED;

  // Need to declare localize function passed in from parent, or else
  // localize() calls within the template won't be updated.

  // @polymer/decorators doesn't support Function constructors...
  @property({type: Object}) localize: (messageId: string) => string;

  @computed('serverName', 'isOutlineServer', 'localize')
  get localizedServerName() {
    if (this.serverName.length) {
      return this.serverName;
    }

    return this.localize(this.isOutlineServer ? 'server-default-name-outline' : 'server-default-name');
  }

  @computed('state', 'localize')
  get statusMessage() {
    if (!this.localize) return '';

    switch (this.state) {
      case ServerConnectionState.CONNECTING:
        return this.localize('connecting-server-state');
      case ServerConnectionState.CONNECTED:
        return this.localize('connected-server-state');
      case ServerConnectionState.RECONNECTING:
        return this.localize('reconnecting-server-state');
      case ServerConnectionState.DISCONNECTING:
        return this.localize('disconnecting-server-state');
      case ServerConnectionState.DISCONNECTED:
      default:
        return this.localize('disconnected-server-state');
    }
  }

  @computed('state', 'localize')
  get connectButtonLabel() {
    if (!this.localize) return '';

    switch (this.state) {
      case ServerConnectionState.CONNECTING:
      case ServerConnectionState.CONNECTED:
      case ServerConnectionState.RECONNECTING:
        return this.localize('disconnect-button-label');
      case ServerConnectionState.DISCONNECTING:
      case ServerConnectionState.DISCONNECTED:
      default:
        return this.localize('connect-button-label');
    }
  }

  @computed('state')
  get connectButtonDisabled() {
    return (
        this.disabled || this.state === ServerConnectionState.CONNECTING ||
        this.state === ServerConnectionState.DISCONNECTING);
  }

  @computed('expanded')
  get expandedClassName() {
    return this.expanded ? 'expanded' : '';
  }

  protected onConnectToggled() {
    const {serverId} = this;

    this.state === ServerConnectionState.DISCONNECTED ? this.fire('ConnectPressed', {serverId}) :
                                                        this.fire('DisconnectPressed', {serverId});
  }

  protected onMenuItemPressed({detail: {selected}}: CustomEvent) {
    const {serverName, serverId} = this;

    if (selected === 'forget') {
      this.fire('ForgetPressed', {serverId});
    } else if (selected === 'rename') {
      this.fire('ShowServerRename', {serverName, serverId});
    }

    // This can leave the pressed paper-item in the selected state,
    // causing it to get selected styling (e.g. font-weight: bold),
    // so explicitly deselect it:
    this.async(() => (this.$.menu as HTMLInputElement).select());
  }
}
