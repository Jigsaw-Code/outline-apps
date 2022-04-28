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

import {html, css} from "lit";
import {customElement, property, state} from "lit/decorators.js";

import "../../server_connection_indicator";
import "@material/mwc-button";
import "@material/mwc-icon-button";
import "@material/mwc-menu";

import {ServerConnectionState} from "../../server_connection_indicator";
import {ServerListItemElement, ServerListItemEvent} from "..";

@customElement("server-card")
export class ServerCard extends ServerListItemElement {
  @property() disabled: boolean;
  @property() expanded: boolean;

  @property({attribute: "root-path"}) rootPath: string;
  @property() localize: (messageID: string) => string;

  @state() connectButtonText: string;
  @state() connectButtonDispatcher: () => void;
  @state() renameButtonDispatcher: () => void;
  @state() forgetButtonDispatcher: () => void;

  @state() optionsMenuOpen: boolean;
  @state() toggleOptionsMenu: () => void;

  static styles = css`
    :host,
    .server-card-header,
    .server-card-body,
    .server-card-footer {
      display: block;
      width: 100%;
    }

    :host {
      position: relative;
      user-select: none;

      /* TODO: make :host a card */

      /* css variables */
      --outline-error: hsl(4, 90%, 58%);
      --outline-primary: hsl(170, 60%, 46%);
      --outline-dark-gray: hsl(213, 5%, 39%);
      --outline-medium-gray: hsl(0, 0%, 45%);
    }

    .server-card-header {
      user-select: text;
    }

    .server-card-menu {
      position: absolute;
      top: 0;
      right: 0;
    }

    .server-card-body {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .server-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .server-card-error {
      color: var(--outline-error);
    }
  `;

  willUpdate(updatedProperties: Map<keyof ServerCard, ServerCard[keyof ServerCard]>) {
    if (updatedProperties.has("optionsMenuOpen")) {
      this.toggleOptionsMenu = () => (this.optionsMenuOpen = !this.optionsMenuOpen);
    }

    if (updatedProperties.has("server") || updatedProperties.has("localize")) {
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
        this.connectButtonText = this.localize("disconnect-button-label");
        this.connectButtonDispatcher = () =>
          this.dispatchEvent(new CustomEvent(ServerListItemEvent.DISCONNECT, {detail: this.server}));
      } else {
        this.connectButtonText = this.localize("connect-button-label");
        this.connectButtonDispatcher = () =>
          this.dispatchEvent(new CustomEvent(ServerListItemEvent.CONNECT, {detail: this.server}));
      }
    }
  }

  render() {
    const connectionIndicator = html`
      <server-connection-indicator
        connection-state="${this.server.connectionState}"
        root-path="${this.rootPath}"
      ></server-connection-indicator>
    `;

    const errorMessage = html`
      <span class="server-card-error">${this.localize(this.server.errorMessageId)}</span>
    `;

    const header = html`
      <header class="server-card-header">
        ${!this.expanded && connectionIndicator}
        <div>
          <h2>
            ${this.server.name ||
              this.localize(this.server.isOutlineServer ? "server-default-name-outline" : "server-default-name")}
          </h2>
          <span>${this.server.address}</span>
        </div>
      </header>
    `;

    const menu = html`
      <div class="server-card-menu">
        <mwc-icon-button icon="more-vert" @click=${this.toggleOptionsMenu}></mwc-icon-button>
        <mwc-menu ?open="${this.optionsMenuOpen}">
          <mwc-list-item @click="${this.renameButtonDispatcher}">${this.localize("server-rename")}</mwc-list-item>
          <mwc-list-item @click="${this.forgetButtonDispatcher}">${this.localize("server-forget")}</mwc-list-item>
        </mwc-menu>
      </div>
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

    return this.expanded ? [header, menu, body, footer] : [header, menu, footer];
  }
}
