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

import { Corner, type Menu } from '@material/web/menu/menu';

import { Localizer } from '@outline/infrastructure/i18n';

import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { Ref } from 'lit/directives/ref.js';

import { ServerConnectionType, ServerListItem, ServerListItemElement, ServerListItemEvent } from '..';
import { ServerConnectionState } from '../../server_connection_indicator';

import './server_rename_dialog';
import './server_info_dialog';
import '../../server_connection_indicator';

export * from './legacy';

@customElement('server-card')
export class ServerCard
  extends LitElement
  implements ServerListItemElement {
  @property({ type: Object }) server: ServerListItem;
  @property({ type: Object }) localize: Localizer;
  @property({ type: Boolean }) darkMode = false;

  @query('.card-menu') menu: Ref<Menu>;
  @query('.card-menu-button') menuButton: Ref<HTMLElement>;

  @state() isRenameDialogOpen = false;
  @state() isInfoDialogOpen = false;

  static styles = css`
    /* TODO(daniellacosse): reset via postcss */
    h2,
    span,
    footer,
    button,
    div {
      all: initial;
    }

    * {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }

    :host {
      --server-name-size: 1rem;
      --server-address-size: 0.875rem;

      display: inline-block;
      height: 100%;
      position: relative;
      width: 100%;
    }

    .card {
      --min-indicator-size: calc(
          var(--server-name-size) + var(--outline-mini-gutter) +
            var(--server-address-size) + 48px - 1rem
        );

      --max-indicator-size: calc(
        var(--outline-slim-gutter) + var(--server-name-size) +
          var(--outline-mini-gutter) + var(--server-address-size) +
          var(--outline-slim-gutter) + 48px - 1rem
      );
      
      align-items: center;
      background: var(--outline-card-background);
      border-radius: var(--outline-corner);
      box-shadow: var(--outline-elevation);
      display: grid;
      gap: var(--outline-gutter);
      grid-gap: var(--outline-gutter);
      overflow: hidden;
      width: 100%;

      grid-template-columns: 0 1fr auto 0;
      grid-template-rows: 0 minmax(0, 1fr) auto;
      grid-template-areas:
        '. . . .'
        '. metadata menu .'
        'footer footer footer footer';
    }

    .card-metadata {
      font-family: var(--outline-font-family);
      color: var(--outline-text-color);
      gap: var(--outline-slim-gutter);
      grid-area: metadata;
      display: flex;
      align-items: center;
    }

    server-connection-indicator {
      margin: 0 var(--outline-mini-gutter);
      min-height: var(--min-indicator-size);
      max-height: var(--max-indicator-size);
      float: left;
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

    .card-connection-label {
      color: var(--outline-label-color);
      font-size: var(--server-address-size);
      font-family: var(--outline-font-family);
      padding-top: 0.5rem;
    }

    .card-metadata-server-name,
    .card-metadata-server-address {
      -webkit-box-orient: vertical;
      display: -webkit-box;
      font-family: var(--outline-font-family);
      overflow: hidden;
      text-overflow: ellipsis;
      -webkit-user-select: text;
      user-select: text;
    }

    .card-metadata-server-name {
      /* https://caniuse.com/?search=line-clamp */
      -webkit-line-clamp: 3;
      color: var(--outline-text-color);
      font-size: var(--server-name-size);
      margin-bottom: var(--outline-mini-gutter);
      /* To break the line in case a sequence of word characters is longer than the line.
        See https://github.com/Jigsaw-Code/outline-apps/issues/1372. */
      word-break: break-all;
    }

    .card-metadata-server-address {
      /* https://caniuse.com/?search=line-clamp */
      -webkit-line-clamp: 2;
      color: var(--outline-label-color);
      font-size: var(--server-address-size);
      word-break: break-all;
    }

    .card-metadata-connection-type-container {
      display: flex;
      align-items: center;
      margin-top: var(--outline-gutter);
      gap: var(--outline-mini-gutter);
    }

    md-assist-chip {
      --md-assist-chip-leading-icon-color: var(--outline-text-color);
      --md-assist-chip-outline-width: 0;
      --md-assist-chip-container-shape: 1rem;
    }

    .card-menu {
      --md-menu-container-color: var(--outline-card-background);
    }

    .card-menu-button {
      align-self: start;
      grid-area: menu;
      position: relative;
    }

    .card-menu-button md-icon {
      color: var(--outline-text-color);
    }

    .card-footer {
      background: var(--outline-card-footer);
      box-sizing: border-box;
      grid-area: footer;
      padding: var(--outline-mini-gutter) var(--outline-gutter);
      text-align: end;
    }

    .card-error {
      color: var(--outline-error);
      margin: 0 var(--outline-slim-gutter);
    }

    .card-footer-button {
      --md-sys-color-primary: var(--outline-primary);

      text-transform: uppercase;
    }
  `

  get isConnectedState() {
    return [
      ServerConnectionState.CONNECTING,
      ServerConnectionState.CONNECTED,
      ServerConnectionState.RECONNECTING,
    ].includes(this.server.connectionState);
  }

  get hasErrorMessage() {
    return Boolean(this.server.errorMessageId);
  }

  render() {
    return html`
      <div class="card">
        <div class="card-metadata" aria-labelledby="server-name">
          <server-connection-indicator
            ?darkMode=${this.darkMode}
            connection-state="${this.server.connectionState}"
          ></server-connection-indicator>
          <div class="card-metadata-text">
            <h2 class="card-metadata-server-name" id="server-name">
              ${this.server.name}
            </h2>
            <label class="card-metadata-server-address">${this.server.address}</label>
            <div class="card-metadata-connection-type-container">
              ${this.renderConnectionType()}
            </div>
          </div>
        </div>
        <md-icon-button
          class="card-menu-button"
          @click=${this.openMenu}
        >
          <md-icon>more_vert</md-icon>
        </md-icon-button>  
        <footer class="card-footer">
          <span class="card-error">${this.hasErrorMessage ? this.localize(this.server.errorMessageId) : ''}</span>
          <md-text-button
            class="card-footer-button"
            @click="${this.connectToggle}"
            ?disabled=${this.hasErrorMessage}
          >
            ${this.localize(this.isConnectedState ? 'disconnect-button-label' : 'connect-button-label')}
          </md-text-button>
        </footer>
      </div>
      <md-menu
        class="card-menu"
        menuCorner=${Corner.END_END}
        quick
      >
        <md-menu-item @click="${this.beginRename}">
          ${this.localize('server-rename')}
        </md-menu-item>
        <md-menu-item @click="${this.forget}">
          ${this.localize('server-forget')}
        </md-menu-item>
      </md-menu>
      <server-rename-dialog
        .open=${this.isRenameDialogOpen}
        .localize=${this.localize}
        .serverId=${this.server.id}
        .serverName=${this.server.name}
        @cancel=${this.cancelRename}
        @submit=${this.submitRename}
      ></server-rename-dialog>
    `;
  }

    // TODO: hoist colors and add messages
  renderConnectionType() {
    if (!this.server.connectionType) {
      return html`<i>${this.localize('server-card-no-connection-type')}</i>`
    }

    let connectionMessage, connectionIcon, connectionColor, connectionInfoDialog;

    switch(this.server.connectionType) {
      case ServerConnectionType.PROXYLESS:
        connectionInfoDialog = html`<server-proxyless-info-dialog
          .open=${this.isInfoDialogOpen}
          .localize=${this.localize}
          @cancel=${this.closeInfo}
        ></server-proxyless-info-dialog>`;
      case ServerConnectionType.SPLIT:
        connectionColor = '--outline-partial-connection-color';
        connectionIcon = 'shield';
        connectionInfoDialog ??= html`<server-split-tunneling-info-dialog
          .open=${this.isInfoDialogOpen}
          .localize=${this.localize}
          @cancel=${this.closeInfo}
        ></server-split-tunneling-info-dialog>`
        connectionMessage = this.localize('server-card-limited-connection-type')
        break;
      case ServerConnectionType.COMPLETE:
        connectionColor = '--outline-complete-connection-color';
        connectionIcon = 'shield_lock';
        connectionInfoDialog = html`<server-complete-protection-info-dialog
          .open=${this.isInfoDialogOpen}
          .localize=${this.localize}
          @cancel=${this.closeInfo}
        ></server-complete-protection-info-dialog>`;
        connectionMessage = this.localize('server-card-complete-connection-type')
        break;
    }

    return html`
      <md-assist-chip style="background: var(${connectionColor});">
        <md-icon slot="icon">${connectionIcon}</md-icon>
        ${connectionMessage}
      </md-assist-chip>
      <md-icon-button @click=${this.openInfo}>
        <md-icon>info</md-icon>
      </md-icon-button>
      ${connectionInfoDialog}
    `;
  }

  beginRename() {
    this.isRenameDialogOpen = true;
  }

  cancelRename() {
    this.isRenameDialogOpen = false;
  }

  submitRename(event: CustomEvent) {
    this.isRenameDialogOpen = false;

    this.dispatchEvent(
      new CustomEvent(ServerListItemEvent.RENAME, {
        detail: { serverId: event.detail.id, newName: event.detail.name },
        bubbles: true,
        composed: true,
      })
    );
  }

  openInfo() {
    this.isInfoDialogOpen = true;
  }

  closeInfo() {
    this.isInfoDialogOpen = false;
  }
  
  openMenu() {
    const menuElement = this.menu.value;
    const menuButtonElement = this.menuButton.value;

    if (!menuElement) {
      return;
    }

    if (!menuElement.anchorElement) {
      menuElement.anchorElement = menuButtonElement;
    }

    menuElement.show();
  }

  connectToggle() {
    this.dispatchEvent(
      new CustomEvent(
        this.isConnectedState
          ? ServerListItemEvent.DISCONNECT
          : ServerListItemEvent.CONNECT,
        {
          detail: { serverId: this.server.id },
          bubbles: true,
          composed: true,
        }
      )
    );
  }

  connectToggleKeyboardDispatcher(event: KeyboardEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.key === 'Enter') {
      this.connectToggle();
    }
  }

  forget() {
    this.dispatchEvent(
      new CustomEvent(ServerListItemEvent.FORGET, {
        detail: { serverId: this.server.id },
        bubbles: true,
        composed: true,
      })
    );
  }
}
