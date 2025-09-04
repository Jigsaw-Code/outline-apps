/*
  Copyright 2024 The Outline Authors
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

import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import '@material/web/all.js';

@customElement('server-info-dialog')
export class ServerInfoDialog extends LitElement {
  @property({type: Boolean}) open: boolean = false;
  @property({type: Object}) localize!: (key: string) => string;

  static styles = css`
    :host {
      --md-sys-color-primary: var(--outline-primary);
      --md-sys-shape-corner-extra-large: 2px;
      --md-sys-shape-corner-full: 2px;

      --md-dialog-container-color: var(
        --outline-app-dialog-primary-background-color
      );
      --md-filled-text-field-container-color: var(--outline-input-bg);
      --md-filled-text-field-input-text-color: var(--outline-input-text);
    }

    fieldset {
      border: none;
      text-transform: uppercase;
    }
  `;

  render() {
    return html`
      <md-dialog .open=${this.open} @close=${this.handleClose} quick>
        <!-- image? -->
        <header slot="headline"></header>
        <p slot="content"></p>
        <fieldset slot="actions">
          <md-text-button @click=${this.handleClose}
            >${this.localize('okay')}</md-text-button
          >
        </fieldset>
      </md-dialog>
    `;
  }

  private handleClose() {
    this.dispatchEvent(new CustomEvent('cancel'));
  }
}
