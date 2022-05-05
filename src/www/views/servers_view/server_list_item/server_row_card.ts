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

import {ServerListItemElement} from '.';

@customElement('server-row-card')
export class ServerRowCard extends ServerListItemElement {
  @property({attribute: 'root-path'}) rootPath: string;
  @property() localize: (messageID: string) => string;

  menuRef: Ref<Menu> = createRef();

  static styles = css`
    /* TODO(daniellacosse): global css reset */
    h2,
    span,
    footer,
    div {
      all: initial;
    }

    :host {
      --server-name-size: 1rem;
      --server-address-size: 0.875rem;

      align-items: center;
      background: var(--outline-card-background);
      border-radius: var(--outline-corner);
      box-shadow: var(--outline-elevation);
      display: grid;
      grid-gap: var(--outline-slim-gutter);
      grid-template-columns: 0 1fr auto 0;
      grid-template-rows: 0 minmax(0, 1fr) auto;
      grid-template-areas:
        '. . . .'
        '. metadata menu .'
        'footer footer footer footer';
      height: 100%;
      min-width: var(--min-supported-device-width);
      overflow: hidden;
      user-select: none;
      width: 100%;
    }

    .card-metadata {
      grid-area: metadata;
      height: 100%;
      display: flex;
      align-items: center;
    }

    server-connection-indicator {
      float: left;
      min-height: calc(var(--server-name-size) + var(--outline-mini-gutter) + var(--server-address-size));
      max-height: calc(
        var(--outline-slim-gutter) + var(--server-name-size) + var(--outline-mini-gutter) + var(--server-address-size) +
          var(--outline-slim-gutter)
      );
    }

    .card-metadata-text {
      user-select: text;
      padding: var(--outline-slim-gutter);
    }

    .card-metadata-server-name {
      display: block;
      margin-bottom: var(--outline-mini-gutter);
      color: var(--outline-text-color);
      font-family: var(--outline-font-family);
      font-size: var(--server-name-size);
    }

    .card-metadata-server-address {
      color: var(--outline-label-color);
      font-family: var(--outline-font-family);
      font-size: var(--server-address-size);
    }

    .card-menu {
      align-self: start;
      grid-area: menu;
      position: relative;
    }

    .card-footer {
      align-items: center;
      background: var(--outline-card-footer);
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
    let serverNameText, connectButtonText, hasErrorMessage, errorMessageText;

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

    if (this.server.errorMessageId) {
      hasErrorMessage = true;
      errorMessageText = this.localize(this.server.errorMessageId);
    }

    return html`
      <div class="card-metadata" aria-labelledby="server-name">
        <server-connection-indicator
          connection-state="${this.server.connectionState}"
          root-path="${this.rootPath}"
        ></server-connection-indicator>
        <div class="card-metadata-text">
          <h2 id="server-name" class="card-metadata-server-name">
            ${serverNameText}
          </h2>
          <span class="card-metadata-server-address">${this.server.address}</span>
        </div>
      </div>
      <div class="card-menu">
        <mwc-icon-button icon="more_vert" @click=${() => this.menuRef.value?.show()} tabindex="0"></mwc-icon-button>
        <mwc-menu ${ref(this.menuRef)}>
          <mwc-list-item @click="${this.dispatchServerRenameEvent}">${this.localize('server-rename')}</mwc-list-item>
          <mwc-list-item @click="${this.dispatchServerForgetEvent}">${this.localize('server-forget')}</mwc-list-item>
        </mwc-menu>
      </div>
      <footer class="card-footer">
        <span class="card-error">${errorMessageText}</span>
        <mwc-button
          label="${connectButtonText}"
          tabindex="0"
          @click="${this.dispatchServerConnectEvent}"
          ?disabled=${hasErrorMessage}
        >
        </mwc-button>
      </footer>
    `;
  }
}
