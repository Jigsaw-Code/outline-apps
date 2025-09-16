/*
  Copyright 2025 The Outline Authors
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

import type {MdCheckbox} from '@material/web/checkbox/checkbox.js';

import {LitElement, html, css} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import '@material/web/all.js';

import completeProtectionHeaderImage from '../../../assets/dialog_headers/complete_protection.svg';
import proxylessHeaderImage from '../../../assets/dialog_headers/proxyless.svg';
import splitTunnelingHeaderImage from '../../../assets/dialog_headers/split_tunneling.svg';

@customElement('connection-confirm-dialog')
class ConnectionConfirmDialog extends LitElement {
  @property({type: Boolean}) open: boolean = false;
  @property({type: Object}) localize!: (key: string) => string;

  @property({type: String}) headerImage: string;
  @property({type: String}) titleMessageId: string;
  @property({type: String}) contentMessageId: string;
  @property({type: String}) confirmButtonMessageId: string = 'enable';

  @state() private isChecked: boolean = false;

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

    header {
      padding: 0;
      padding-bottom: initial;
      flex-direction: column;
    }

    img {
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }

    h1 {
      box-sizing: border-box;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0px;
      line-height: 1.75rem;
      margin-bottom: var(--outline-slim-gutter);
      padding: 0 1.5rem;
      text-align: left;
      vertical-align: middle;
      width: 100%;
    }

    article {
      font-weight: 400;
      font-size: 0.875rem;
      line-height: 1.25rem;
      letter-spacing: 0.5px;
      padding: 1.5rem;
    }

    fieldset {
      display: flex;
      flex-direction: column;
      gap: var(--outline-gutter);
    }

    a {
      text-decoration: underline;
      color: var(--outline-primary);
    }

    fieldset {
      border: none;
      text-transform: uppercase;
    }

    .action-row {
      display: flex;
      gap: var(--outline-gutter);
    }

    .action-row:last-child {
      justify-content: flex-end;
    }

    .confirmation-checkbox {
      /* 'display: flex;' distorts the checkbox by default. */
      display: grid;

      /* 
        We can't use 'auto' for the first column, as the checkbox highlight area
        is not part of the document flow.
      */
      grid-template-columns: 2rem 1fr;
      place-items: center;

      font-family: var(--outline-font-family);
      text-transform: initial;
      background: var(--outline-light-gray);
      border-radius: var(--outline-corner);
      border: 1px solid var(--outline-warning);
      cursor: pointer;
      gap: var(--outline-mini-gutter);
      padding: var(--outline-slim-gutter) var(--outline-mini-gutter);
    }

    .confirmation-checkbox-label {
      width: 100%;
      padding-right: var(--outline-mini-gutter);
    }
  `;

  render() {
    return html`
      <md-dialog .open=${this.open} @close=${this.close} quick>
        <header slot="headline">
          <img src="${this.headerImage}" />
          <h1>${unsafeHTML(this.localize(this.titleMessageId))}</h1>
        </header>

        <article slot="content">
          ${unsafeHTML(this.localize(this.contentMessageId))}
        </article>

        <fieldset slot="actions">
          <div class="action-row">
            <label class="confirmation-checkbox">
              <md-checkbox
                @change=${this.change}
                ?checked=${this.isChecked}
              ></md-checkbox>
              <div class="confirmation-checkbox-label">
                ${this.localize('connection-confirm-checkbox-label')}
              </div>
            </label>
          </div>

          <div class="action-row">
            <md-text-button @click=${this.close}>
              ${this.localize('not-now')}
            </md-text-button>
            <md-filled-button
              @click=${this.confirm}
              ?disabled=${!this.isChecked}
            >
              ${this.localize(this.confirmButtonMessageId)}
            </md-filled-button>
          </div>
        </fieldset>
      </md-dialog>
    `;
  }

  private change(e: Event) {
    this.isChecked = (e.target as MdCheckbox).checked;
  }

  private close() {
    this.dispatchEvent(new CustomEvent('cancel'));

    this.isChecked = false;
  }

  private confirm() {
    if (!this.isChecked) return;

    this.dispatchEvent(new CustomEvent('confirm'));

    this.isChecked = false;
  }
}

@customElement('basic-access-confirm-dialog')
export class BasicAccessConfirmDialog extends ConnectionConfirmDialog {
  render() {
    return html`
      <connection-confirm-dialog
        .open=${this.open}
        .localize=${this.localize}
        headerImage=${completeProtectionHeaderImage}
        titleMessageId="basic-access-title"
        contentMessageId="basic-access-content"
        confirmButtonMessageId="next"
      ></connection-confirm-dialog>
    `;
  }
}

@customElement('proxyless-confirm-dialog')
export class ProxylessConfirmDialog extends ConnectionConfirmDialog {
  render() {
    return html`
      <connection-confirm-dialog
        .open=${this.open}
        .localize=${this.localize}
        headerImage=${proxylessHeaderImage}
        titleMessageId="proxyless-confirm-dialog-title"
        contentMessageId="proxyless-confirm-dialog-content"
      ></connection-confirm-dialog>
    `;
  }
}

@customElement('split-confirm-dialog')
export class SplitConfirmDialog extends ConnectionConfirmDialog {
  render() {
    return html`
      <connection-confirm-dialog
        .open=${this.open}
        .localize=${this.localize}
        headerImage=${splitTunnelingHeaderImage}
        titleMessageId="split-confirm-dialog-title"
        contentMessageId="split-confirm-dialog-content"
      ></connection-confirm-dialog>
    `;
  }
}
