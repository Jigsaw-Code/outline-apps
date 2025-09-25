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
import {customElement, property, state} from 'lit/decorators.js';

@customElement('add-access-key-dialog')
export class AddAccessKeyDialog extends LitElement {
  @property({type: String, attribute: true, reflect: true}) accessKey:
    | string
    | null = null;
  @property({type: Object}) accessKeyValidator!: (
    accessKey: string
  ) => Promise<boolean>;
  @property({type: Object}) localize!: (
    key: string,
    ...args: string[]
  ) => string;
  @property({type: Boolean}) open: boolean;

  @state() hasEmptyAccessKey: boolean;
  @state() hasInvalidAccessKey: boolean;

  static styles = css`
    :host {
      width: 100%;
      height: 100%;
    }

    md-dialog {
      min-width: 300px;
    }

    section {
      margin-bottom: 12px;
      color: var(--outline-text-color);
    }

    section.help-text {
      color: var(--outline-label-color);
    }

    md-filled-text-field {
      --md-filled-text-field-input-text-font: 'Menlo', monospace;

      width: 100%;
    }

    fieldset {
      border: none;
      text-transform: uppercase;
    }

    /* Explicit fixing for error text */
    md-filled-text-field::part(error) {
      color: var(--outline-error-color);
    }
  `;

  async connectedCallback() {
    super.connectedCallback();

    await this.runAccessKeyChecks(this.accessKey);
  }

  async attributeChangedCallback(
    attributeName: string,
    oldValue: string,
    newValue: string
  ) {
    super.attributeChangedCallback(attributeName, oldValue, newValue);

    await this.runAccessKeyChecks(newValue);
  }

  render() {
    return html`<md-dialog .open="${this.open}" @cancel=${this.cancel} quick>
      <header slot="headline" style="color: var(--outline-text-color);">
        ${this.localize('add-access-key-dialog-header')}
      </header>
      <article slot="content" style="color: var(--outline-text-color);">
        <section
          class="help-text"
          style="color: var(--outline-label-color);"
          .innerHTML=${this.localize(
            'add-access-key-dialog-help-text',
            'openLink',
            '<a href=https://s3.amazonaws.com/outline-vpn/index.html>',
            'closeLink',
            '</a>'
          )}
        ></section>
        <section>
          <md-filled-text-field
            .error=${!this.hasEmptyAccessKey && this.hasInvalidAccessKey}
            @input=${this.edit}
            error-text="${this.localize('add-access-key-dialog-error-text')}"
            label="${this.localize('add-access-key-dialog-label')}"
            rows="5"
            type="textarea"
            .value=${this.accessKey ?? ''}
          ></md-filled-text-field>
        </section>
      </article>
      <fieldset slot="actions">
        <md-text-button @click=${this.cancel}>
          ${this.localize('cancel')}
        </md-text-button>
        <md-filled-button
          @click=${this.confirm}
          ?disabled=${this.hasEmptyAccessKey || this.hasInvalidAccessKey}
          >${this.localize('confirm')}</md-filled-button
        >
      </fieldset>
    </md-dialog>`;
  }

  private async runAccessKeyChecks(accessKey: string | null) {
    if (accessKey === null) {
      this.hasInvalidAccessKey = true;
      this.hasEmptyAccessKey = true;
    } else {
      this.hasInvalidAccessKey = !(await this.accessKeyValidator(accessKey));
      this.hasEmptyAccessKey = false;
    }
  }

  private edit(event: InputEvent) {
    event.preventDefault();

    this.accessKey = (event.target as HTMLInputElement).value;
  }

  private confirm(event: Event) {
    event.preventDefault();

    this.dispatchEvent(
      new CustomEvent('AddServerRequested', {
        detail: {accessKey: this.accessKey},
        composed: true,
        bubbles: true,
      })
    );

    this.accessKey = null;
  }

  private cancel(event: Event) {
    event.preventDefault();

    this.dispatchEvent(
      new CustomEvent('IgnoreServerRequested', {
        detail: {accessKey: this.accessKey},
        composed: true,
        bubbles: true,
      })
    );

    this.accessKey = null;
  }
}
