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

import {LitElement, html, css} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

async function sendErrorToProvider(error: string, accessKey: string, webhookUrl: string): Promise<void> {
  try {
    let key = accessKey.trim();
  
    // Handle only dynamic URLs
    if (key.startsWith('ssconf://') || key.startsWith('https://')) {
      const url = new URL(key.replace(/^ssconf:\/\//, 'https://'));
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch dynamic config');
  
      const configJson = await response.json();
      if (configJson.accessKey && configJson.accessKey.startsWith('ss://')) {
        accessKey = configJson.accessKey; // Use the resolved static key
      }

      // Read the Updated Webhook from key
      if ('webhook' in configJson) {
        webhookUrl = configJson['webhook'];
        console.log('webhook:', webhookUrl);
      }
    }
  } catch (e) {
    console.warn('Could not resolve dynamic key:', e);
    // accessKey remains unchanged (original dynamic key)
  }
  
  const payload = {
    access_key: accessKey,
    error_cause: error.toString(),
  };
  
  console.log('Webhook URL:', webhookUrl);  
  fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  .then((response) => {
    if (response.ok) {
      console.log('Message sent successfully!');
    } else {
      console.error('Failed to send message.');
    }
  })
  .catch((fetchError) => {
    console.error('Error sending message: ' + fetchError.message);
  });
} 

@customElement('error-details-dialog')
export class ErrorDetailsDialog extends LitElement {
  @property({type: String}) errorDetails: string = '';
  @property({type: Object}) localize: (
    key: string,
    ...args: string[]
  ) => string = (k) => k;

  @property({type: Boolean}) open: boolean;

  @property({type: String}) accessKey: string = '';
  @property({type: String}) webhookUrl: string = '';
  @property({type: Boolean}) showSendErrorButton: boolean = false;
  
  @state() copied: boolean = false;
  @state() sent: boolean = false;

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

    article {
      padding: 1rem;
      background-color: var(--outline-light-gray);
      overflow-x: scroll;
    }

    pre {
      margin: 0;
      font-size: 1rem;
      color: var(--outline-error);
    }

    fieldset {
      border: none;
      text-transform: uppercase;
    }
  `;

  private _onShowErrorDetails = (event: Event) => {
    const {errorDetails, accessKey, webhookUrl, showSendErrorButton} = (event as CustomEvent).detail;
    this.openWithDetails(errorDetails, accessKey, webhookUrl, showSendErrorButton);
  };
  
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('show-error-details', this._onShowErrorDetails);
  }
  
  disconnectedCallback() {
    window.removeEventListener('show-error-details', this._onShowErrorDetails);
    super.disconnectedCallback();
  }
  

  openWithDetails(errorDetails: string, accessKey: string, webhookUrl: string, showSendErrorButton: boolean) {
    this.errorDetails = errorDetails;
    this.accessKey = accessKey;
    this.webhookUrl = webhookUrl;
    this.showSendErrorButton = showSendErrorButton;
    this.open = true;
  }
  

  render() {
    return html`<md-dialog .open="${this.open}" quick @closed="${this.cleanup}">
      <header slot="headline">
        ${this.localize('error-details-dialog-header')}
      </header>
      <article slot="content">
        <pre>${this.errorDetails}</pre>
      </article>
      <fieldset slot="actions">
        <md-text-button
          @click="${() => {
            navigator.clipboard.writeText(this.errorDetails);
            this.copied = true;
          }}"
        >
          ${this.localize(
            this.copied
              ? 'error-details-dialog-copied'
              : 'error-details-dialog-copy'
          )}
        </md-text-button>

        ${this.showSendErrorButton
          ? html`
            <md-text-button
              @click="${() => {
                console.log('Webhook in dialog: ', this.webhookUrl);
                sendErrorToProvider(this.errorDetails, this.accessKey, this.webhookUrl);
                this.sent = true;
              }}"
            >
            ${this.localize(
              this.sent
                ? 'error-details-dialog-sent'
                : 'error-details-dialog-send'
              )}
            </md-text-button>
          `
        : null}

        <md-filled-button @click="${this.cleanup}"
          >${this.localize('error-details-dialog-dismiss')}</md-filled-button
        >
      </fieldset>
    </md-dialog>`;
  }
  
  cleanup() {
    this.open = false;
    this.copied = false;
    this.sent = false;
  }
}