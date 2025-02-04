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

import {LitElement, html, css} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';

import '@material/mwc-icon-button';
import '@material/mwc-icon';
import '@material/mwc-menu';

@customElement('access-key-controls')
export class AccessKeyControls extends LitElement {
  @property({type: Object}) localize: (messageId: string) => string;
  @property({type: String}) id: string;

  @query('#menuButton') menuButton: IconButton;
  @query('#menu') menu: Menu;

  static styles = css`
    :host {
      flex-grow: 1;
    }

    .wrapper {
      float: right;
    }
  `;

  render() {
    return html`
      <span class="wrapper">
        <mwc-icon-button
          icon="share"
          @click=${this.fireShareEvent}
        ></mwc-icon-button>
        <mwc-icon-button
          icon="more_vert"
          id="menuButton"
          @click=${() => {
            this.menu.anchor = this.menuButton;
            this.menu.show();
          }}
        ></mwc-icon-button>
        <mwc-menu id="menu" corner="TOP_LEFT" menuCorner="END">
          <mwc-list-item @click=${this.fireEditNameEvent} graphic="icon">
            <mwc-icon slot="graphic">create</mwc-icon>
            ${this.localize('server-access-key-rename')}
          </mwc-list-item>
          <mwc-list-item @click=${this.fireDeleteEvent} graphic="icon">
            <mwc-icon slot="graphic">delete</mwc-icon>
            ${this.localize('remove')}
          </mwc-list-item>
          <!-- TODO: hide this on versions 1.6 or earlier? -->
          <mwc-list-item @click=${this.fireEditDataLimitEvent} graphic="icon">
            <mwc-icon slot="graphic">perm_data_setting</mwc-icon>
            ${this.localize('data-limit')}
          </mwc-list-item>
        </mwc-menu>
      </span>
    `;
  }

  fireDeleteEvent() {
    this.dispatchEvent(
      new CustomEvent('AccessKeyControls::Delete', {
        bubbles: true,
        composed: true,
        detail: {id: this.id},
      })
    );
  }

  fireEditDataLimitEvent() {
    this.dispatchEvent(
      new CustomEvent('AccessKeyControls::EditDataLimit', {
        bubbles: true,
        composed: true,
        detail: {id: this.id},
      })
    );
  }

  fireEditNameEvent() {
    this.dispatchEvent(
      new CustomEvent('AccessKeyControls::EditName', {
        bubbles: true,
        composed: true,
        detail: {id: this.id},
      })
    );
  }

  fireShareEvent() {
    this.dispatchEvent(
      new CustomEvent('AccessKeyControls::Share', {
        bubbles: true,
        composed: true,
        detail: {id: this.id},
      })
    );
  }
}
