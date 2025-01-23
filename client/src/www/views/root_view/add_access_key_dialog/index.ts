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

@customElement('add-access-key-dialog')
export class AddAccessKeyDialog extends LitElement {
  @property({type: Function}) localize!: (
    key: string,
    ...args: string[]
  ) => string;
  @property({type: Boolean}) open: boolean;
  @property({type: String}) accessKey: string = '';
  @property({type: Boolean}) isValidAccessKey: boolean = false;
  @property({type: Function}) validateAccessKey: (
    accessKey: string
  ) => Promise<boolean>;

  static styles = css`
    :host {
      --md-sys-color-primary: var(--outline-primary);
      --md-sys-shape-corner-extra-large: 2px;
      --md-sys-shape-corner-full: 2px;

      width: 100%;
      height: 100%;
    }

    md-dialog {
      --md-dialog-container-color: var(
        --outline-app-dialog-primary-background-color
      );

      min-width: 300px;
    }

    section {
      margin-bottom: 12px;
    }

    section.help-text {
      color: var(--outline-medium-gray);
    }

    a {
      color: var(--outline-primary);
    }

    md-filled-text-field {
      --md-filled-text-field-input-text-font: 'Menlo', monospace;
      --md-filled-text-field-container-color: var(--outline-light-gray);

      width: 100%;
    }

    fieldset {
      border: none;
      text-transform: uppercase;
    }
  `;

  render() {
    return html`<md-dialog
      .open="${this.open}"
      @cancel=${this.handleCancel}
      quick
    >
      <header slot="headline">
        ${this.localize('add-access-key-dialog-header')}
      </header>
      <article slot="content">
        <section
          class="help-text"
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
            .error=${Boolean(this.accessKey) && !this.isValidAccessKey}
            @input=${this.handleEdit}
            error-text="${this.localize('add-access-key-dialog-error-text')}"
            label="${this.localize('add-access-key-dialog-label')}"
            rows="5"
            type="textarea"
            .value=${this.accessKey}
          ></md-filled-text-field>
        </section>
      </article>
      <fieldset slot="actions">
        <md-text-button @click=${this.handleCancel}>
          ${this.localize('cancel')}
        </md-text-button>
        <md-filled-button
          @click=${this.handleConfirm}
          ?disabled=${!this.accessKey || !this.isValidAccessKey}
          >${this.localize('confirm')}</md-filled-button
        >
      </fieldset>
    </md-dialog>`;
  }

  private updateIsValidAccessKey(
    accessKey: string,
    validate: (accessKey: string) => Promise<boolean>
  ) {
    this.isValidAccessKey = false;
    validate(accessKey).then(result => {
      this.isValidAccessKey = result;
    });
  }

  private handleEdit(event: InputEvent) {
    this.accessKey = (event.target as HTMLInputElement).value;

    this.updateIsValidAccessKey(this.accessKey, this.validateAccessKey);
  }

  private handleConfirm() {
    this.dispatchEvent(
      new CustomEvent('AddServerRequested', {
        detail: {accessKey: this.accessKey},
        composed: true,
        bubbles: true,
      })
    );

    this.accessKey = '';
  }

  private handleCancel(event: Event) {
    event.preventDefault();

    this.dispatchEvent(
      new CustomEvent('IgnoreServerRequested', {
        detail: {accessKey: this.accessKey},
        composed: true,
        bubbles: true,
      })
    );

    this.accessKey = '';
  }
}
