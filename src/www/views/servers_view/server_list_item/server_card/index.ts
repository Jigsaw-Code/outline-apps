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

import {html, css} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

import '../../server_connection_indicator';
import '@material/mwc-button';
import '@material/mwc-icon-button';
import '@material/mwc-menu';

import {ServerConnectionState} from '../../server_connection_indicator';
import {ServerListItemElement, ServerListItemEvent} from '..';

@customElement('server-card')
export class ServerCard extends ServerListItemElement {
  @property() disabled: boolean;
  @property() expanded: boolean;

  @property({attribute: 'root-path'}) rootPath: string;
  @property() localize: (messageID: string) => string;

  @state() connectButtonText: string;
  @state() connectButtonDispatcher: () => void;
  @state() renameButtonDispatcher: () => void;
  @state() forgetButtonDispatcher: () => void;

  @state() optionsMenuOpen: boolean;
  @state() toggleOptionsMenu: () => void;

  static styles = css`
    :host {
      width: 100%;
      height: 100%;

      user-select: none;
      overflow: hidden;

      box-shadow: 0px 3px 2px rgba(0, 0, 0, 0.3);
      border-top: 1px solid hsl(0, 0%, 85%);
      border-radius: 2px;

      display: flex;
      flex-direction: column;

      /* css variables */
      --outline-error: hsl(4, 90%, 58%);
      --outline-primary: hsl(170, 60%, 46%);
      --outline-dark-gray: hsl(213, 5%, 39%);
      --outline-medium-gray: hsl(0, 0%, 45%);

      --mdc-theme-primary: var(--outline-primary);
    }

    .server-card-header {
      display: flex;
      align-items: center;
      justify-content: space-around;
      box-sizing: border-box;
      padding: 1rem;
      flex: 1;
    }

    .server-card-metadata-text {
      user-select: text;
      margin: 0 0.75rem;
      flex: 1;
    }

    .server-card-metadata-server-name {
      margin: 0;
      margin-bottom: 0.25rem;
    }

    .server-card-metadata-server-address {
      color: gray;
    }

    .server-card-menu {
      align-self: flex-start;
      margin: -0.5rem -0.25rem;
    }

    .server-card-body {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .server-card-footer {
      display: flex;
      justify-content: end;
      background: hsl(0, 0%, 95%);
      border-top: 1px solid hsl(0, 0%, 85%);
      box-sizing: border-box;
      padding: 0.25rem 1rem;
    }

    .server-card-error {
      color: var(--outline-error);
    }
  `;

  willUpdate(updatedProperties: Map<keyof ServerCard, ServerCard[keyof ServerCard]>) {
    if (updatedProperties.has('optionsMenuOpen')) {
      this.toggleOptionsMenu = () => (this.optionsMenuOpen = !this.optionsMenuOpen);
    }

    if (updatedProperties.has('server') || updatedProperties.has('localize')) {
      this.renameButtonDispatcher = () =>
        this.dispatchEvent(new CustomEvent(ServerListItemEvent.RENAME, {detail: this.server}));
      this.forgetButtonDispatcher = () =>
        this.dispatchEvent(new CustomEvent(ServerListItemEvent.FORGET, {detail: this.server}));

      if (
        [
          ServerConnectionState.CONNECTING,
          ServerConnectionState.CONNECTED,
          ServerConnectionState.RECONNECTING,
        ].includes(this.server.connectionState)
      ) {
        this.connectButtonText = this.localize('disconnect-button-label');
        this.connectButtonDispatcher = () =>
          this.dispatchEvent(new CustomEvent(ServerListItemEvent.DISCONNECT, {detail: this.server}));
      } else {
        this.connectButtonText = this.localize('connect-button-label');
        this.connectButtonDispatcher = () =>
          this.dispatchEvent(new CustomEvent(ServerListItemEvent.CONNECT, {detail: this.server}));
      }
    }
  }

  render() {
    const connectionIndicator = html`
      <server-connection-indicator
        style="max-height: 5rem;"
        connection-state="${this.server.connectionState}"
        root-path="${this.rootPath}"
      ></server-connection-indicator>
    `;

    const errorMessage = html`
      <span class="server-card-error">${this.localize(this.server.errorMessageId)}</span>
    `;

    const menu = html`
      <div class="server-card-menu">
        <mwc-icon-button icon="more_vert" @click=${this.toggleOptionsMenu}></mwc-icon-button>
        <mwc-menu ?open="${this.optionsMenuOpen}">
          <mwc-list-item @click="${this.renameButtonDispatcher}">${this.localize('server-rename')}</mwc-list-item>
          <mwc-list-item @click="${this.forgetButtonDispatcher}">${this.localize('server-forget')}</mwc-list-item>
        </mwc-menu>
      </div>
    `;

    const header = html`
      <header class="server-card-header">
        ${!this.expanded && connectionIndicator}
        <div class="server-card-metadata-text">
          <h3 class="server-card-metadata-server-name">
            ${this.server.name ||
              this.localize(this.server.isOutlineServer ? 'server-default-name-outline' : 'server-default-name')}
          </h3>
          <span class="server-card-metadata-server-address">${this.server.address}</span>
        </div>
        ${menu}
      </header>
    `;

    const body = html`
      <section class="server-card-body">
        <button @click="${this.connectButtonDispatcher}">
          ${connectionIndicator}
        </button>
        <span>${this.localize(`${this.server.connectionState}-server-state`)}</span>
      </section>
    `;

    const footer = html`
      <footer class="server-card-footer">
        ${this.server.errorMessageId && errorMessage}
        <mwc-button label="${this.connectButtonText}" @click="${this.connectButtonDispatcher}"> </mwc-button>
      </footer>
    `;

    return this.expanded ? [header, body, footer] : [header, footer];
  }
}
