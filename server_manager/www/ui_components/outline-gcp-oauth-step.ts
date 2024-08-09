// Copyright 2021 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import '@polymer/polymer/polymer-legacy';
import '@polymer/iron-pages/iron-pages';
import './outline-step-view';

import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {COMMON_STYLES} from './cloud-install-styles';

@customElement('outline-gcp-oauth-step')
export class GcpConnectAccountApp extends LitElement {
  @property({type: Function}) onCancel: Function;
  @property({type: Function}) localize: Function;

  static get styles() {
    return [
      COMMON_STYLES,
      css`
        :host {
        }
        .container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100%;
          align-items: center;
          padding: 132px 0;
          font-size: 14px;
        }
        #connectAccount img {
          width: 48px;
          height: 48px;
          margin-bottom: 12px;
        }
        .card {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: space-between;
          margin: 24px 0;
          padding: 24px;
          background: var(--background-contrast-color);
          box-shadow:
            0 0 2px 0 rgba(0, 0, 0, 0.14),
            0 2px 2px 0 rgba(0, 0, 0, 0.12),
            0 1px 3px 0 rgba(0, 0, 0, 0.2);
          border-radius: 2px;
        }
        @media (min-width: 1025px) {
          paper-card {
            /* Set min with for the paper-card to grow responsively. */
            min-width: 600px;
          }
        }
        .card p {
          color: var(--light-gray);
          width: 100%;
          text-align: center;
        }
        .card paper-button {
          color: var(--light-gray);
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 2px;
        }
        .card paper-button[disabled] {
          color: var(--medium-gray);
          background: transparent;
        }
        /* Mirror images */
        :host(:dir(rtl)) .mirror {
          transform: scaleX(-1);
        }
      `,
    ];
    // TODO: RTL
  }

  render() {
    return html` <outline-step-view id="connectAccount">
      <span slot="step-title">${this.localize('gcp-oauth-connect-title')}</span>
      <span slot="step-description"
        >${this.localize('oauth-connect-description')}</span
      >
      <paper-card class="card">
        <div class="container">
          <img src="images/gcp-logo.svg" />
          <p>${this.localize('oauth-connect-tag')}</p>
        </div>
        <paper-button @tap="${this.onCancelTapped}"
          >${this.localize('cancel')}</paper-button
        >
      </paper-card>
    </outline-step-view>`;
  }

  private onCancelTapped() {
    if (this.onCancel) {
      this.onCancel();
    }
  }
}
