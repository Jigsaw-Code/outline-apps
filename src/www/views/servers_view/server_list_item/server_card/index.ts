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
import '../../server_connection_indicator';

import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {createRef, Ref, ref} from 'lit/directives/ref.js';

import {Menu} from '@material/mwc-menu';

import {ServerListItem, ServerListItemElement, ServerListItemEvent, ServerListItemElementWithDispatcher} from '..';
import {ServerConnectionState} from '../../server_connection_indicator';

const sharedCSS = css`
  /* TODO(daniellacosse): reset via postcss */
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
    background: var(--outline-card-background);
    border-radius: var(--outline-corner);
    box-shadow: var(--outline-elevation);
    display: grid;
    grid-gap: var(--outline-slim-gutter);
    height: 100%;
    min-width: var(--min-supported-device-width);
    overflow: hidden;
    user-select: none;
    width: 100%;
  }

  .card-metadata {
    font-family: var(--outline-font-family);
    color: var(--outline-text-color);
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
    color: var(--outline-text-color);
    font-size: var(--server-name-size);
    font-family: var(--outline-font-family);
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

// TODO(daniellacosse): don't rerender dispatchers unnecessarily
const getSharedDispatchers = ({dispatcher, server}: ServerListItemElementWithDispatcher) => ({
  renameDispatcher: () =>
    dispatcher(new CustomEvent(ServerListItemEvent.RENAME, {detail: server, bubbles: true, composed: true})),
  forgetDispatcher: () =>
    dispatcher(new CustomEvent(ServerListItemEvent.FORGET, {detail: server, bubbles: true, composed: true})),
  connectToggleDispatcher: () =>
    dispatcher(
      new CustomEvent(
        isConnectedState(server.connectionState) ? ServerListItemEvent.DISCONNECT : ServerListItemEvent.CONNECT,
        {detail: server, bubbles: true, composed: true}
      )
    ),
});

const isConnectedState = (connectionState: ServerConnectionState) =>
  [ServerConnectionState.CONNECTING, ServerConnectionState.CONNECTED, ServerConnectionState.RECONNECTING].includes(
    connectionState
  );

const renderSharedHTML = (element: ServerListItemElementWithDispatcher) => {
  const {renameDispatcher, forgetDispatcher, connectToggleDispatcher} = getSharedDispatchers(element);
  const {server, localizer, menu} = element;

  const serverNameText =
    server.name ?? localizer(server.isOutlineServer ? 'server-default-name-outline' : 'server-default-name');
  const hasErrorMessage = Boolean(server.errorMessageId);
  const errorMessageText = hasErrorMessage && localizer(server.errorMessageId);
  const connectButtonText = localizer(
    isConnectedState(server.connectionState) ? 'disconnect-button-label' : 'connect-button-label'
  );

  return {
    metadataTextHTML: html`
      <div class="card-metadata-text">
        <h2 class="card-metadata-server-name" id="server-name">
          ${serverNameText}
        </h2>
        <label class="card-metadata-server-address">${server.address}</label>
      </div>
    `,
    menuHTML: html`
      <div class="card-menu">
        <mwc-icon-button icon="more_vert" @click=${menu.value?.show}></mwc-icon-button>
        <mwc-menu ${ref(menu)}>
          <mwc-list-item @click="${renameDispatcher}">${localizer('server-rename')}</mwc-list-item>
          <mwc-list-item @click="${forgetDispatcher}">${localizer('server-forget')}</mwc-list-item>
        </mwc-menu>
      </div>
    `,
    footerHTML: html`
      <footer class="card-footer">
        <span class="card-error">${errorMessageText}</span>
        <mwc-button label="${connectButtonText}" @click="${connectToggleDispatcher}" ?disabled=${hasErrorMessage}>
        </mwc-button>
      </footer>
    `,
  };
};

@customElement('server-row-card')
export class ServerRowCard extends LitElement implements ServerListItemElement {
  @property() server: ServerListItem;

  @property({attribute: 'root-path'}) rootPath: string;
  @property() localizer: (messageID: string) => string;

  menu: Ref<Menu> = createRef();

  static styles = [
    sharedCSS,
    css`
      :host {
        grid-template-columns: 0 1fr auto 0;
        grid-template-rows: 0 minmax(0, 1fr) auto;
        grid-template-areas:
          '. . . .'
          '. metadata menu .'
          'footer footer footer footer';
      }

      server-connection-indicator {
        float: left;
        min-height: calc(var(--server-name-size) + var(--outline-mini-gutter) + var(--server-address-size));
        max-height: calc(
          var(--outline-slim-gutter) + var(--server-name-size) + var(--outline-mini-gutter) + var(--server-address-size) +
            var(--outline-slim-gutter)
        );
      }
    `,
  ];

  render() {
    const {metadataTextHTML, menuHTML, footerHTML} = renderSharedHTML({
      ...this,
      dispatcher: this.dispatchEvent,
    });

    return html`
      <div class="card-metadata" aria-labelledby="server-name">
        <server-connection-indicator
          connection-state="${this.server.connectionState}"
          root-path="${this.rootPath}"
        ></server-connection-indicator>
        ${metadataTextHTML}
      </div>
      ${menuHTML} ${footerHTML}
    `;
  }
}

@customElement('server-hero-card')
export class ServerHeroCard extends LitElement implements ServerListItemElement {
  @property() server: ServerListItem;

  @property({attribute: 'root-path'}) rootPath: string;
  @property() localizer: (messageID: string) => string;

  menu: Ref<Menu> = createRef();

  static styles = [
    sharedCSS,
    css`
      :host {
        grid-template-columns: 0 1fr auto 0;
        grid-template-rows: 0 auto minmax(0, 1fr) auto;
        grid-template-areas:
          '. . . .'
          '. metadata menu .'
          '. button button .'
          'footer footer footer footer';
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
        color: var(--outline-label-color);
        font-size: var(--server-address-size);
        font-family: var(--outline-font-family);
      }
    `,
  ];

  render() {
    const element = {...this, dispatcher: this.dispatchEvent};

    // HTML
    const {metadataTextHTML, menuHTML, footerHTML} = renderSharedHTML(element);
    const connectionButtonText = this.localizer(
      isConnectedState(this.server.connectionState) ? 'disconnect-button-label' : 'connect-button-label'
    );
    const connectionStatusText = this.localizer(`${this.server.connectionState}-server-state`);

    // dispatchers
    const {connectToggleDispatcher} = getSharedDispatchers(element);
    const connectToggleKeyboardDispatcher = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.key === 'Enter') {
        connectToggleDispatcher();
      }
    };

    return html`
      <div class="card-metadata" aria-labelledby="server-name">
        ${metadataTextHTML}
      </div>
      ${menuHTML}
      <div class="card-connection-button-container">
        <server-connection-indicator
          @click="${!this.server.errorMessageId && connectToggleDispatcher}"
          @keydown="${connectToggleKeyboardDispatcher}"
          connection-state="${this.server.connectionState}"
          id="${connectionButtonText}"
          role="button"
          tabindex="0"
          root-path="${this.rootPath}"
          title="${connectionStatusText}"
        ></server-connection-indicator>
        <label class="card-connection-label" for="${connectionButtonText}">${connectionStatusText}</label>
      </div>
      ${footerHTML}
    `;
  }
}
