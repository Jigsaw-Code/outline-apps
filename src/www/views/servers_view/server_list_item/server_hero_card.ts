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

import '@material/mwc-button';
import '@material/mwc-icon-button';
import '@material/mwc-menu';
import '../server_connection_indicator';

import {html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {createRef, Ref, ref} from 'lit/directives/ref.js';
import {Menu} from '@material/mwc-menu';

import {ServerConnectionState} from '../server_connection_indicator';
import {ServerListItemElement} from '.';

@customElement('server-hero-card')
export class ServerHeroCard extends ServerListItemElement {
  @property({attribute: 'root-path'}) rootPath: string;
  @property() localize: (messageID: string) => string;

  menuRef: Ref<Menu> = createRef();

  static styles = css`
    /* TODO(daniellacosse): global css reset */
    h2,
    span,
    footer,
    button,
    div {
      all: initial;
    }

    :host {
      --server-name-size: 1rem;
      --server-address-size: 0.875rem;

      align-items: center;
      border-radius: var(--outline-corner);
      box-shadow: var(--outline-elevation);
      display: grid;
      grid-gap: var(--outline-slim-gutter);
      grid-template-columns: 0 1fr auto 0;
      grid-template-rows: 0 auto minmax(0, 1fr) auto;
      grid-template-areas:
        '. . . .'
        '. metadata menu .'
        '. button button .'
        'footer footer footer footer';
      height: 100%;
      min-width: var(--min-supported-device-width);
      overflow: hidden;
      user-select: none;
      width: 100%;
    }

    .card-metadata {
      font-family: var(--outline-font-family);
      grid-area: metadata;
      height: 100%;
      display: flex;
      align-items: center;
    }

    .card-metadata-text {
      user-select: text;
      padding: var(--outline-slim-gutter);
    }

    .card-metadata-server-name {
      display: block;
      margin-bottom: var(--outline-mini-gutter);
      font-size: var(--server-name-size);
      font-family: var(--outline-font-family);
    }

    .card-metadata-server-address {
      color: var(--outline-medium-gray);
      font-size: var(--server-address-size);
      font-family: var(--outline-font-family);
    }

    .card-menu {
      align-self: start;
      grid-area: menu;
      position: relative;
    }

    .card-connection-button-container {
      grid-area: button;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      height: 100%;
      gap: var(--outline-slim-gutter);
      box-sizing: border-box;
      padding: var(--outline-large-gutter) 0;
    }

    server-connection-indicator {
      cursor: pointer;
      min-height: 192px;
      max-height: calc(var(--min-supported-device-width) - var(--outline-slim-gutter) - var(--outline-slim-gutter));
    }

    .card-connection-label {
      color: var(--outline-medium-gray);
      font-size: var(--server-address-size);
      font-family: var(--outline-font-family);
    }

    .card-footer {
      align-items: center;
      background: var(--outline-light-gray);
      border-top: var(--outline-hairline);
      box-sizing: border-box;
      display: flex;
      grid-area: footer;
      justify-content: end;
      padding: var(--outline-mini-gutter) var(--outline-gutter);
    }

    .card-error {
      color: var(--outline-error);
      margin: 0 var(--outline-slim-gutter);
    }
  `;

  render() {
    let serverNameText, connectionStatusText, connectButtonText, hasErrorMessage, errorMessageText;

    if (this.server.name) {
      serverNameText = this.server.name;
    } else {
      serverNameText = this.localize(
        this.server.isOutlineServer ? 'server-default-name-outline' : 'server-default-name'
      );
    }

    if (this.isConnected) {
      connectButtonText = this.localize('disconnect-button-label');
    } else {
      connectButtonText = this.localize('connect-button-label');
    }

    switch (this.server.connectionState) {
      case ServerConnectionState.CONNECTING:
        connectionStatusText = this.localize('connecting-server-state');
        break;
      case ServerConnectionState.CONNECTED:
        connectionStatusText = this.localize('connected-server-state');
        break;
      case ServerConnectionState.RECONNECTING:
        connectionStatusText = this.localize('reconnecting-server-state');
        break;
      case ServerConnectionState.DISCONNECTING:
        connectionStatusText = this.localize('disconnecting-server-state');
        break;
      case ServerConnectionState.DISCONNECTED:
      default:
        connectionStatusText = this.localize('disconnected-server-state');
        break;
    }

    if (this.server.errorMessageId) {
      hasErrorMessage = true;
      errorMessageText = this.localize(this.server.errorMessageId);
    }

    return html`
      <div class="card-metadata" aria-labelledby="server-name">
        <div class="card-metadata-text">
          <h2 class="card-metadata-server-name" id="server-name">
            ${serverNameText}
          </h2>
          <label class="card-metadata-server-address">${this.server.address}</label>
        </div>
      </div>
      <div class="card-menu">
        <mwc-icon-button icon="more_vert" @click=${() => this.menuRef.value?.show()}></mwc-icon-button>
        <mwc-menu ${ref(this.menuRef)}>
          <mwc-list-item @click="${this.dispatchServerRenameEvent}">${this.localize('server-rename')}</mwc-list-item>
          <mwc-list-item @click="${this.dispatchServerForgetEvent}">${this.localize('server-forget')}</mwc-list-item>
        </mwc-menu>
      </div>
      <div class="card-connection-button-container">
        <server-connection-indicator
          @click="${!hasErrorMessage && this.dispatchServerConnectEvent}"
          connection-state="${this.server.connectionState}"
          id="${connectButtonText}"
          role="button"
          root-path="${this.rootPath}"
          title="${connectButtonText}"
        ></server-connection-indicator>
        <label class="card-connection-label" for="${connectButtonText}">${connectionStatusText}</label>
      </div>
      <footer class="card-footer">
        <span class="card-error">${errorMessageText}</span>
        <mwc-button
          label="${connectButtonText}"
          @click="${this.dispatchServerConnectEvent}"
          ?disabled=${hasErrorMessage}
        >
        </mwc-button>
      </footer>
    `;
  }
}
