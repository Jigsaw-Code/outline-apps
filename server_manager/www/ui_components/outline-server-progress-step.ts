/*
  Copyright 2018 The Outline Authors

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
import '@polymer/paper-progress/paper-progress';
import '@polymer/paper-button/paper-button';
import './outline-progress-spinner';
import './outline-step-view';
import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {COMMON_STYLES} from './cloud-install-styles';

@customElement('outline-server-progress-step')
export class OutlineServerProgressStep extends LitElement {
  @property({type: String}) serverName: string;
  @property({type: Number}) progress = 0;
  @property({type: Function}) localize: Function;

  static get styles() {
    return [
      COMMON_STYLES,
      css`
        :host {
          text-align: center;
        }
        .card {
          margin-top: 72px;
          box-shadow:
            0 0 2px 0 rgba(0, 0, 0, 0.14),
            0 2px 2px 0 rgba(0, 0, 0, 0.12),
            0 1px 3px 0 rgba(0, 0, 0, 0.2);
          border-radius: 2px;
          color: var(--light-gray);
          background: var(--background-contrast-color);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .servername {
          margin: 24px 0 72px 0;
          text-align: center;
        }
        .card p {
          font-size: 14px;
          color: var(--light-gray);
        }
        outline-progress-spinner {
          margin-top: 72px;
        }
        paper-button {
          width: 100%;
          border: 1px solid var(--light-gray);
          border-radius: 2px;
          color: var(--light-gray);
        }
      `,
    ];
  }

  override render() {
    return html` <outline-step-view display-action="">
      <span slot="step-title">${this.localize('setup-do-title')}</span>
      <span slot="step-description"
        >${this.localize('setup-do-description')}</span
      >
      <span slot="step-action">
        <paper-button id="cancelButton" @tap="${this.handleCancelTapped}">
          ${this.localize('cancel')}
        </paper-button>
      </span>
      <div class="card">
        <outline-progress-spinner></outline-progress-spinner>
        <div class="servername">
          <p>${this.serverName}</p>
        </div>
        <paper-progress
          id="bar"
          class="transiting"
          value="${100 * this.progress}"
        ></paper-progress>
      </div>
    </outline-step-view>`;
  }

  private handleCancelTapped() {
    // Set event options required to escape the shadow DOM.
    this.dispatchEvent(
      new CustomEvent('CancelServerCreationRequested', {
        bubbles: true,
        composed: true,
      })
    );
  }
}
