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
import '@polymer/polymer/polymer-legacy';

import '@polymer/iron-pages/iron-pages';
import './cloud-install-styles';
import './outline-step-view';

import {Polymer} from '@polymer/polymer/lib/legacy/polymer-fn';
import {html} from '@polymer/polymer/lib/utils/html-tag';

export interface OutlineDoOauthStep extends Element {
  onCancel: Function;
  showConnectAccount(): void;
  showAccountActive(): void;
  showBilling(): void;
  showEmailVerification(): void;
}

Polymer({
  _template: html`
    <style include="cloud-install-styles">
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
    </style>

    <iron-pages id="pages" attr-for-selected="id" selected="{{ currentPage }}">
      <outline-step-view id="connectAccount">
        <span slot="step-title">[[localize('oauth-connect-title')]]</span>
        <span slot="step-description"
          >[[localize('oauth-connect-description')]]</span
        >
        <paper-card class="card">
          <div class="container">
            <img src="images/digital_ocean_logo.svg" />
            <p>[[localize('oauth-connect-tag')]]</p>
          </div>
          <paper-button on-tap="_cancelTapped"
            >[[localize('cancel')]]</paper-button
          >
        </paper-card>
      </outline-step-view>

      <outline-step-view id="verifyEmail">
        <span slot="step-title">[[localize('oauth-activate-account')]]</span>
        <span slot="step-description">[[localize('oauth-verify')]]</span>
        <paper-card class="card">
          <div class="container">
            <img class="mirror" src="images/do_oauth_email.svg" />
            <p>[[localize('oauth-verify-tag')]]</p>
          </div>
          <paper-button on-tap="_cancelTapped"
            >[[localize('oauth-sign-out')]]</paper-button
          >
        </paper-card>
      </outline-step-view>

      <outline-step-view id="enterBilling">
        <span slot="step-title">[[localize('oauth-activate-account')]]</span>
        <span slot="step-description">[[localize('oauth-billing')]]</span>
        <paper-card class="card">
          <div class="container">
            <img class="mirror" src="images/do_oauth_billing.svg" />
            <p>[[localize('oauth-billing-tag')]]</p>
          </div>
          <paper-button on-tap="_cancelTapped"
            >[[localize('oauth-sign-out')]]</paper-button
          >
        </paper-card>
      </outline-step-view>

      <outline-step-view id="accountActive">
        <span slot="step-title">[[localize('oauth-activate-account')]]</span>
        <span slot="step-description"
          >[[localize('oauth-account-active')]]</span
        >
        <paper-card class="card">
          <div class="container">
            <img class="mirror" src="images/do_oauth_done.svg" />
            <p>[[localize('oauth-account-active-tag')]]</p>
          </div>
          <paper-button disabled=""
            >[[localize('oauth-sign-out')]]</paper-button
          >
        </paper-card>
      </outline-step-view>
    </iron-pages>
  `,

  is: 'outline-do-oauth-step',

  properties: {
    currentPage: {
      type: String,
      value: 'connectAccount',
    },
    cancelButtonText: {
      type: String,
      value: 'Cancel',
    },
    localize: {
      type: Function,
    },
    onCancel: Function,
  },

  _cancelTapped() {
    if (this.onCancel) {
      this.onCancel();
    }
  },

  showEmailVerification() {
    this.currentPage = 'verifyEmail';
  },

  showBilling() {
    this.currentPage = 'enterBilling';
  },

  showAccountActive() {
    this.currentPage = 'accountActive';
  },

  showConnectAccount() {
    this.currentPage = 'connectAccount';
  },
});
