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

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import './server_connection_indicator';
import './server_list';

import {ServerListItem as _ServerListItem} from './server_list_item';
import {ServerConnectionState as _ServerConnectionState} from './server_connection_indicator';

export type ServerListItem = _ServerListItem;

/*
  TODO: dialogs should be handled elsewhere

  <user-comms-dialog
    id="autoConnectDialog"
    localize="[[localize]]"
    title-localization-key="auto-connect-dialog-title"
    detail-localization-key="auto-connect-dialog-detail"
    fire-event-on-hide="AutoConnectDialogDismissed"
  ></user-comms-dialog>
*/

// (This value is used: it's exported.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export import ServerConnectionState = _ServerConnectionState;

export enum ServersViewEvent {
  START_SERVER_CREATION = 'PromptAddServerRequested',
}

@customElement('servers-view')
export class ServersView extends LitElement {
  @property() localize: (...messageIDs: string[]) => string;
  @property() serverItems: ServerListItem[];

  static styles = css`
    header,
    p,
    footer,
    button {
      all: initial;
    }

    :host {
      width: 100%;
      height: 100%;
    }

    :host,
    button {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    footer {
      border: solid var();
      border-top: var();
      padding: 0 var();
    }
  `;

  render() {
    if (this.serverItems.length === 0) {
      return html`
        <button @click=${() => this.dispatchEvent(new CustomEvent(ServersViewEvent.START_SERVER_CREATION))}>
          <server-connection-indicator connection-state="disconnected"></server-connection-indicator>
          <header>
            <h2>${this.localize('server-add')}</h2>
            <p>${this.localize('server-add-zero-state-instructions')}</p>
          </header>
        </button>
        <footer>
          ${this.localize(
            'server-create-your-own-zero-state',
            'breakLine',
            '<br/>',
            'openLink',
            '<a href=https://s3.amazonaws.com/outline-vpn/index.html>',
            'closeLink',
            '</a>'
          )}
        </footer>
      `;
    }

    const serverItemTemplate =
      this.serverItems.length === 1
        ? (server: ServerListItem) =>
            html`
              <server-hero-card localize=${this.localize} server=${server}></server-hero-card>
            `
        : (server: ServerListItem) =>
            html`
              <server-row-card localize=${this.localize} server=${server}></server-row-card>
            `;

    return html`
      <server-list
        localize=${this.localize}
        item-template=${serverItemTemplate}
        server-items=${this.serverItems}
      ></server-list>
    `;
  }
}
