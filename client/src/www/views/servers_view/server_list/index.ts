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

import {Localizer} from '@outline/infrastructure/i18n';
import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import '../server_list_item/server_card';
import {ServerListItem, ServerListItemEvent} from '../server_list_item'; // Added ServerListItemEvent

@customElement('server-list')
export class ServerList extends LitElement {
  @property({type: Boolean}) darkMode = false;

  static styles = [
    css`
      :host {
        box-sizing: border-box;
        display: block;
        height: 100%;
        margin: 0 auto;
        padding: 8px;
        width: 100%;
      }

      server-row-card {
        margin: 0 auto 8px auto;
        height: auto;
      }

      /* TODO(daniellacosse): Remove the hard-coded heights. */
      server-hero-card {
        height: 400px;
      }
    `,
  ];

  @property({type: Object}) localize: Localizer = msg => msg;
  @property({type: Array}) servers: ServerListItem[] = [];

  render() {
    if (this.hasSingleServer) {
      return html`<server-hero-card
        ?darkMode=${this.darkMode}
        .localize=${this.localize}
        .server=${this.servers[0]}
        @${ServerListItemEvent.SET_ALLOWED_APPS}=${this._handleSetAllowedApps}
      ></server-hero-card>`;
    } else {
      return html`
        ${this.servers.map(
          server =>
            html`<server-row-card
              ?darkMode=${this.darkMode}
              .localize=${this.localize}
              .server=${server}
              @${ServerListItemEvent.SET_ALLOWED_APPS}=${this._handleSetAllowedApps}
            ></server-row-card>`
        )}
      `;
    }
  }

  private _handleSetAllowedApps(event: CustomEvent<{serverId: string; allowedApps: string[]}>) {
    // Re-dispatch an event that a higher-level component can handle.
    // This component doesn't have direct access to the server repository.
    this.dispatchEvent(
      new CustomEvent('set-server-allowed-apps', {
        bubbles: true,
        composed: true,
        detail: event.detail,
      })
    );
  }

  private get hasSingleServer() {
    return this.servers.length === 1;
  }
}
