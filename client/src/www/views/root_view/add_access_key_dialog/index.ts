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

import {initialize} from '@ionic/core/components';
import {defineCustomElement} from '@ionic/core/components/ion-modal.js';
import {LitElement, html} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';

@customElement('add-access-key-dialog')
export class AddAccessKeyDialog extends LitElement {
  @property({type: Function}) localize!: (
    key: string,
    ...args: string[]
  ) => string;
  @property({type: Boolean}) open: boolean;
  @property({type: String}) accessKey: string = '';
  @property({type: Function}) isValidAccessKey: (accessKey: string) => boolean;
  @query('ion-modal') modal: HTMLIonModalElement;

  render() {
    initialize();
    defineCustomElement();

    return html`<ion-modal
      id="addAccessKeyDialog"
      .is-open="${this.open}"
      animated="false"
    >
      <header>${this.localize('add-access-key-dialog-header')}</header>
      <article>
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
            .error=${this.accessKey && !this.isValidAccessKey(this.accessKey)}
            @input=${this.handleEdit}
            error-text="${this.localize('add-access-key-dialog-error-text')}"
            label="${this.localize('add-access-key-dialog-label')}"
            rows="5"
            type="textarea"
            .value=${this.accessKey}
          ></md-filled-text-field>
        </section>
      </article>
      <fieldset>
        <md-text-button @click=${this.handleCancel}>
          ${this.localize('cancel')}
        </md-text-button>
        <md-filled-button
          @click=${this.handleConfirm}
          ?disabled=${!this.accessKey || !this.isValidAccessKey(this.accessKey)}
          >${this.localize('confirm')}</md-filled-button
        >
      </fieldset>
    </ion-modal>`;
  }

  private handleEdit(event: InputEvent) {
    this.accessKey = (event.target as HTMLInputElement).value;
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
