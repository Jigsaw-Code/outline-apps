/**
 * Copyright 2025 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {IconButton} from '@material/mwc-icon-button';
import type {Menu} from '@material/mwc-menu';

import {LitElement, html, css, nothing} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';
import {gte as versionGreaterThanOrEqualTo} from 'semver';

import '@material/mwc-icon-button';
import '@material/mwc-icon';
import '@material/mwc-menu';

/**
 * The version at which the outline server starts supporting data limits.
 * Don't show options having to do with data limits if they aren't supported.
 *
 * @type {string}
 */
export const SERVER_DATA_LIMITS_SUPPORT_VERSION = '1.6.0';

/**
 * Events that can be fired from the access-key-controls element.
 */
export enum AccessKeyControlsEvent {
  DELETE = 'AccessKeyControls.Delete',
  EDIT_DATA_LIMIT = 'AccessKeyControls.EditDataLimit',
  EDIT_NAME = 'AccessKeyControls.EditName',
  SHARE = 'AccessKeyControls.Share',
}

@customElement('access-key-controls')
export class AccessKeyControls extends LitElement {
  @property({type: Object}) localize: (messageId: string) => string;
  @property({type: String}) id: string;
  @property({type: String}) serverVersion: string =
    SERVER_DATA_LIMITS_SUPPORT_VERSION;

  @query('#menuButton') menuButton: IconButton;
  @query('#menu') menu: Menu;

  static styles = css`
    :host {
      flex-grow: 1;
    }

    .wrapper {
      float: right;
    }

    .menu-wrapper {
      position: relative;
    }
  `;

  render() {
    return html`
      <span class="wrapper">
        <mwc-icon-button icon="share" @click=${this.share}></mwc-icon-button>
        <span class="menu-wrapper">
          <mwc-icon-button
            icon="more_vert"
            id="menuButton"
            @click=${() => {
              this.menu.anchor = this.menuButton;
              this.menu.show();
            }}
          ></mwc-icon-button>
          <mwc-menu id="menu">
            <mwc-list-item @click=${this.editName} graphic="icon">
              <mwc-icon slot="graphic">create</mwc-icon>
              ${this.localize('server-access-key-rename')}
            </mwc-list-item>
            <mwc-list-item @click=${this.delete} graphic="icon">
              <mwc-icon slot="graphic">delete</mwc-icon>
              ${this.localize('remove')}
            </mwc-list-item>
            ${versionGreaterThanOrEqualTo(
              this.serverVersion,
              SERVER_DATA_LIMITS_SUPPORT_VERSION
            )
              ? html`<mwc-list-item @click=${this.editDataLimit} graphic="icon">
                  <mwc-icon slot="graphic">perm_data_setting</mwc-icon>
                  ${this.localize('data-limit')}
                </mwc-list-item>`
              : nothing}
          </mwc-menu>
        </span>
      </span>
    `;
  }

  delete() {
    this.dispatchEvent(
      new CustomEvent(AccessKeyControlsEvent.DELETE, {
        bubbles: true,
        composed: true,
        detail: {id: this.id},
      })
    );
  }

  editDataLimit() {
    this.dispatchEvent(
      new CustomEvent(AccessKeyControlsEvent.EDIT_DATA_LIMIT, {
        bubbles: true,
        composed: true,
        detail: {id: this.id},
      })
    );
  }

  editName() {
    this.dispatchEvent(
      new CustomEvent(AccessKeyControlsEvent.EDIT_NAME, {
        bubbles: true,
        composed: true,
        detail: {id: this.id},
      })
    );
  }

  share() {
    this.dispatchEvent(
      new CustomEvent(AccessKeyControlsEvent.SHARE, {
        bubbles: true,
        composed: true,
        detail: {id: this.id},
      })
    );
  }
}
