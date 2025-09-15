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

import type {
  MdFilledSelect,
  MdFilledTextField,
  MdRadio,
} from '@material/web/all.js';

import {LitElement, html, css, nothing} from 'lit';
import {customElement, property, state, query} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import '@material/web/all.js';

interface DnsServerUI {
  url: URL;
  nameMessageId: string;
  descriptionMessageId: string;
}

type DnsConfigurationUI =
  | {
      server: DnsServerUI;
    }
  | {
      custom: URL;
    };

@customElement('dns-config-dialog')
export class DnsConfigDialog extends LitElement {
  @property({type: Boolean}) open: boolean = false;
  @property({type: Object}) localize!: (key: string) => string;

  @property({type: Array}) serverOptions: DnsServerUI[] = [];
  @property({type: Object}) configuration: DnsConfigurationUI;

  @query('#server-selector') private serverSelector: MdFilledSelect;
  @query('#custom-input') private customInput: MdFilledTextField;

  @state() private editedConfiguration: DnsConfigurationUI;

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

    h1 {
      box-sizing: border-box;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0px;
      line-height: 1.75rem;
      margin-bottom: 0;
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

    .content {
      display: flex;
      flex-direction: column;
      gap: var(--outline-gutter);
    }

    .description {
      color: var(--md-sys-color-on-surface-variant);
      margin: 0;
    }

    .radio-label {
      display: grid;
      grid-template-columns: 2rem 1fr;
      align-items: center;
      gap: var(--outline-mini-gutter);
      cursor: pointer;
    }

    .radio-label > div {
      width: 100%;
    }

    .radio-option-group md-filled-select,
    .radio-option-group md-filled-text-field {
      margin-left: calc(2rem + var(--outline-mini-gutter));
      width: calc(100% - 2rem - var(--outline-mini-gutter));
      margin-top: var(--outline-mini-gutter);
    }

    .server-description {
      margin-left: calc(2rem + var(--outline-mini-gutter));
      width: calc(100% - 2rem - var(--outline-mini-gutter));
      font-size: 0.75rem; /* 12px */
      line-height: 1rem;
      margin-top: var(--outline-mini-gutter);
      color: var(--md-sys-color-on-surface-variant);
    }

    fieldset {
      border: none;
      text-transform: uppercase;
    }
  `;

  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      if (this.configuration) {
        return (this.editedConfiguration = {...this.configuration});
      }

      this.editedConfiguration = {server: this.currentlySelectedServer};
    }
  }

  get currentlySelectedServer() {
    return (
      this.serverOptions.find(
        server => server.url.toString() === this.serverSelector?.value
      ) ?? this.serverOptions[0]
    );
  }

  render() {
    return html`
      <md-dialog .open=${this.open} @close=${this.close} quick>
        <header slot="headline">${this.localize('dns-select-title')}</header>

        <article slot="content">
            <div class="description">
              ${this.localize('dns-select-description')}
            </div>

            <div class="radio-option-group">
              <label class="radio-label">
                <md-radio
                  name="config-type"
                  value="server"
                  @change=${this.switchConfigurationType}
                  ?checked=${'server' in this.editedConfiguration}
                ></md-radio>
                <div>${this.localize('dns-built-in-server')}</div>
              </label>

              <md-filled-select
                id="server-selector"
                .value=${this.currentlySelectedServer?.url.toString()}
                @change=${this.selectServer}
              >
                ${this.serverOptions.map(
                  server => html`
                    <md-select-option .value=${server.url.toString()}>
                      <div slot="headline">
                        ${this.localize(server.nameMessageId)}
                      </div>
                    </md-select-option>
                  `
                )}
              </md-filled-select>
              <p class="server-description">
                ${unsafeHTML(this.localize(this.currentlySelectedServer?.descriptionMessageId))}
              </p>
            </div>

            <div class="radio-option-group">
              <label class="radio-label">
                <md-radio
                  name="config-type"
                  value="custom"
                  @change=${this.switchConfigurationType}
                  ?checked=${'custom' in this.editedConfiguration}
                ></md-radio>
                <div>${this.localize('dns-custom-server')}</div>
              </label>
              <md-filled-text-field
                id="custom-input"
                .value=${'custom' in this.editedConfiguration ? this.editedConfiguration.custom.toString() : nothing}
                placeholder=${this.localize('dns-custom-placeholder')}
                @input=${this.inputCustom}
              ></md-filled-text-field>
            </div>
          </div>
        </article>

        <fieldset slot="actions">
          <md-text-button @click=${this.close}>
            ${this.localize('cancel')}
          </md-text-button>
          <md-filled-button
            @click=${this.confirm}
          >
            ${this.localize('accept')}
          </md-filled-button>
        </fieldset>
      </md-dialog>
    `;
  }

  private switchConfigurationType(event: Event) {
    const element = event.target as MdRadio;

    switch (element.value) {
      case 'server':
        this.editedConfiguration = {
          server: this.currentlySelectedServer,
        };
        break;
      case 'custom':
        this.editedConfiguration = {
          custom: new URL(this.customInput.value),
        };
        break;
    }
  }

  private selectServer(event: Event) {
    const element = event.target as MdFilledSelect;

    this.editedConfiguration = {
      server: this.serverOptions.find(
        server => server.url.toString() === element.value
      ),
    };
  }

  private inputCustom(event: Event) {
    const element = event.target as MdFilledTextField;

    this.editedConfiguration = {
      custom: new URL(element.value),
    };
  }

  private close() {
    this.dispatchEvent(new CustomEvent('cancel'));
  }

  private confirm() {
    this.dispatchEvent(
      new CustomEvent('confirm', {detail: this.editedConfiguration})
    );
  }
}
