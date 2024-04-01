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

import {css, html, LitElement, TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

import './server_connection_indicator';
import './server_list';

import {ServerListItem as _ServerListItem} from './server_list_item';
import {ServerConnectionState as _ServerConnectionState} from './server_connection_indicator';
import { Localizer } from 'src/infrastructure/i18n';

export type ServerListItem = _ServerListItem;

// (This value is used: it's exported.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export import ServerConnectionState = _ServerConnectionState;

@customElement('servers-view')
export class ServerList extends LitElement {
  static styles = [
    css`
      :host {
        width: 100%;
        height: 100%;
        /* Use vh, as % does not work in iOS. |header-height|+|server-margin| = 64px.
         * Subtract |header-height| to fix iOS padding, and |server-margin| to fix scrolling in Android.
         */
        height: -webkit-calc(100vh - 64px);
        font-size: 14px;
        line-height: 20px;

        display: flex;
        flex-direction: column;
        justify-content: center;
        margin: auto;
        max-width: 400px;
      }
      :host a {
        color: var(--medium-green);
        text-decoration: none;
      }
      .server-list {
        width: 100%;
        height: 100%;
        margin: auto;
      }
      .header {
        color: rgba(0, 0, 0, 0.87);
        font-size: 20px;
        line-height: 32px;
        margin-top: 34px;
      }
      .subtle {
        color: rgba(0, 0, 0, 0.54);
      }
      .footer {
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        margin: 0;
        padding: 24px 0 16px;
        text-align: center;
      }
      paper-button {
        display: flex;
        flex: 1;
        flex-direction: column;
        text-transform: none;
        outline: none; /* Remove outline for Safari. */
      }
      paper-button server-connection-indicator {
        width: 192px;
        height: 192px;
      }
    `,
  ];

  @property({type: Function}) localize: Localizer = msg => msg;
  @property({type: Boolean}) useAltAccessMessage = false;
  @property({type: Array}) servers: ServerListItem[] = [];

  get shouldShowZeroState() {
    return this.servers ? this.servers.length === 0 : false;
  }

  private requestPromptAddServer() {
    this.dispatchEvent(new CustomEvent('add-server', {bubbles: true, composed: true}));
  }

  private get zeroStateFooter(): TemplateResult {
    let msg;
    if (this.useAltAccessMessage) {
      msg = this.localize(
        'server-create-your-own-zero-state-access',
        'breakLine', '<br/>',
        'openLink', '<a href=https://s3.amazonaws.com/outline-vpn/get-started/index.html#step-1>',
        'openLink2', '<a href=https://www.reddit.com/r/outlinevpn/wiki/index/outline_vpn_access_keys/>',
        'closeLink', '</a>');
    } else {
      msg = this.localize(
        'server-create-your-own-zero-state',
        'breakLine', '<br/>',
        'openLink', '<a href=https://s3.amazonaws.com/outline-vpn/get-started/index.html#step-1>',
        'closeLink', '</a>');
    }
    return html ` <div class="footer subtle">${unsafeHTML(msg)}</div>`;
  }

  private get renderMainContent(): TemplateResult {
    if (this.shouldShowZeroState) {
      return html`
        <paper-button
          noink=""
          @tap="${this.requestPromptAddServer}"
        >
          <server-connection-indicator connection-state="disconnected"></server-connection-indicator>
          <div class="header">${this.localize('server-add')}</div>
          <div class="subtle">${this.localize('server-add-zero-state-instructions')}</div>
        </paper-button>
        ${this.zeroStateFooter}
      `;
    } else {
      return html`
        <server-list
          .servers=${this.servers}
          .localize=${this.localize}
        ></server-list>
      `;
    }
  }

  render() {
    return html`
      ${this.renderMainContent}
      <user-comms-dialog
        id="autoConnectDialog"
        .localize=${this.localize}
        title-localization-key="auto-connect-dialog-title"
        detail-localization-key="auto-connect-dialog-detail"
        fire-event-on-hide="AutoConnectDialogDismissed"
      ></user-comms-dialog>
    `;
  }
}
