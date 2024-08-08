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

import '@polymer/paper-button/paper-button';
import './cloud-install-styles';
import './outline-step-view';
import './style.css';
import {Polymer} from '@polymer/polymer/lib/legacy/polymer-fn';
import {html} from '@polymer/polymer/lib/utils/html-tag';

const DO_CARD_HTML = html`
  <style>
    :host {
      --do-blue: #1565c0;
    }
    #digital-ocean img {
      height: 22px;
      width: 22px;
    }
    .card#digital-ocean .tag,
    .card#digital-ocean .email {
      color: var(--medium-gray);
    }
    #digital-ocean .description ul {
      /* NOTE: this URL must be relative to the ui_components sub dir,
          unlike our <img src="..."> attributes */
      list-style-image: url('../images/check_white.svg');
    }
    /* Reverse check icon for RTL languages */
    :host(:dir(rtl)) #digital-ocean .description ul {
      list-style-image: url('../images/check_white_rtl.svg');
    }
    /* DigitalOcean card background colours (gets brighter, inactive -> active). */
    .card#digital-ocean {
      background: var(--do-blue);
    }
    .card#digital-ocean:hover {
      background: rgba(28, 103, 189, 0.92);
    }
  </style>
  <div id="digital-ocean" class="card" on-tap="connectToDigitalOceanTapped">
    <div class="card-header">
      <div
        class="tag"
        hidden$="[[_computeIsAccountConnected(digitalOceanAccountName)]]"
      >
        [[localize('setup-recommended')]]
      </div>
      <div
        class="email"
        hidden$="[[!_computeIsAccountConnected(digitalOceanAccountName)]]"
      >
        [[digitalOceanAccountName]]
      </div>
      <img src="images/do_white_logo.svg" />
    </div>
    <div class="card-title">DigitalOcean</div>
    <div class="card-body">
      <div class="description">
        <ul hidden$="[[_computeIsAccountConnected(digitalOceanAccountName)]]">
          <li>[[localize('setup-do-easiest')]]</li>
          <li>[[localize('setup-do-cost')]]</li>
          <li>[[localize('setup-do-data')]]</li>
          <li>[[localize('setup-cancel')]]</li>
        </ul>
        <p hidden$="[[!_computeIsAccountConnected(digitalOceanAccountName)]]">
          [[localize('setup-do-create')]]
        </p>
      </div>
    </div>
    <div class="card-footer">
      <paper-button
        class="primary"
        hidden$="[[_computeIsAccountConnected(digitalOceanAccountName)]]"
        >[[localize('setup-action')]]</paper-button
      >
      <paper-button
        class="primary"
        hidden$="[[!_computeIsAccountConnected(digitalOceanAccountName)]]"
        >[[localize('setup-create')]]</paper-button
      >
    </div>
  </div>
`;

const GCP_STYLES = html`
  <style>
    :host {
      --gcp-blue: #4285f4;
    }
    .card#gcp .tag {
      color: var(--gcp-blue);
    }
    #gcp .description ul {
      list-style-image: url('../images/check_blue.svg');
    }
    :host(:dir(rtl)) #gcp .description ul {
      list-style-image: url('../images/check_blue_rtl.svg');
    }
    iron-icon {
      width: 16px;
      height: 16px;
      margin-left: 4px;
      vertical-align: middle;
    }
  </style>
`;

const GCP_CARD_HTML = html`
  ${GCP_STYLES}
  <style>
    /* This card contains hyperlinks so the whole thing can't be clickable. */
    .card#gcp {
      cursor: auto;
    }
    .card-footer {
      cursor: pointer;
    }
  </style>
  <div id="gcp" class="card" hidden$="[[!_showNewGcpFlow(gcpAccountName)]]">
    <div class="card-header">
      <div class="tag" hidden$="[[_computeIsAccountConnected(gcpAccountName)]]">
        [[localize('setup-recommended')]]
      </div>
      <div
        class="email"
        hidden$="[[!_computeIsAccountConnected(gcpAccountName)]]"
      >
        [[gcpAccountName]]
      </div>
      <img src="images/gcp-logo.svg" />
    </div>
    <div class="card-title">Google Cloud Platform</div>
    <div class="card-body">
      <div class="description">
        <ul hidden$="[[_computeIsAccountConnected(gcpAccountName)]]">
          <li>[[localize('setup-gcp-easy')]]</li>
          <li
            inner-h-t-m-l="[[localize('setup-gcp-free-tier',
              'openLinkFreeTier', _openLinkFreeTier,
              'openLinkIpPrice', _openLinkIpPrice,
              'closeLink', _closeLink)]]"
          ></li>
          <li
            inner-h-t-m-l="[[localize('setup-gcp-free-trial',
              'openLinkFreeTrial', _openLinkFreeTrial,
              'closeLink', _closeLink)]]"
          ></li>
          <li>[[localize('setup-cancel')]]</li>
        </ul>
        <p hidden$="[[!_computeIsAccountConnected(gcpAccountName)]]">
          [[localize('setup-gcp-create')]]
        </p>
      </div>
    </div>
    <div class="card-footer" on-tap="setUpGcpTapped">
      <paper-button
        class="primary"
        hidden$="[[_computeIsAccountConnected(gcpAccountName)]]"
        >[[localize('setup-action')]]</paper-button
      >
      <paper-button
        class="primary"
        hidden$="[[!_computeIsAccountConnected(gcpAccountName)]]"
        >[[localize('setup-create')]]</paper-button
      >
    </div>
  </div>
`;

// TODO: Delete this card once we have full confidence in the new GCP flow.
const GCP_LEGACY_CARD_HTML = html`
  ${GCP_STYLES}
  <div
    id="gcp"
    class="card"
    on-tap="setUpGcpAdvancedTapped"
    hidden$="[[_showNewGcpFlow(gcpAccountName)]]"
  >
    <div class="card-header">
      <div class="tag">[[localize('setup-advanced')]]</div>
      <img src="images/gcp-logo.svg" />
    </div>
    <div class="card-title">Google Cloud Platform</div>
    <div class="card-body">
      <div class="description">
        <ul>
          <li>[[localize('setup-step-by-step')]]</li>
          <li>[[localize('setup-firewall-instructions')]]</li>
          <li>[[localize('setup-simple-commands')]]</li>
        </ul>
      </div>
    </div>
    <div class="card-footer">
      <paper-button class="primary">[[localize('setup-action')]]</paper-button>
    </div>
  </div>
`;

const AWS_CARD_HTML = html`
  <style>
    :host {
      --aws-orange: #ff9900;
    }
    .card#aws .tag {
      color: var(--aws-orange);
    }
    #aws .description ul {
      list-style-image: url('../images/check_orange.svg');
    }
    :host(:dir(rtl)) #aws .description ul {
      list-style-image: url('../images/check_orange_rtl.svg');
    }
  </style>
  <div id="aws" class="card" on-tap="setUpAwsTapped">
    <div class="card-header">
      <div class="tag">[[localize('setup-advanced')]]</div>
      <img src="images/aws-logo.svg" />
    </div>
    <div class="card-title">Amazon Lightsail</div>
    <div class="card-body">
      <div class="description">
        <ul>
          <li>[[localize('setup-step-by-step')]]</li>
          <li>[[localize('setup-firewall-instructions')]]</li>
          <li>[[localize('setup-simple-commands')]]</li>
        </ul>
      </div>
    </div>
    <div class="card-footer">
      <paper-button on-tap="setUpAwsTapped" class="primary"
        >[[localize('setup-action')]]</paper-button
      >
    </div>
  </div>
`;

const MANUAL_CARD_HTML = html`
  <style>
    :host {
      --manual-server-green: #00bfa5;
    }
    .card#manual-server .tag {
      color: var(--manual-server-green);
    }
    #manual-server .description ul {
      list-style-image: url('../images/check_green.svg');
    }
    :host(:dir(rtl)) #manual-server .description ul {
      list-style-image: url('../images/check_green_rtl.svg');
    }
  </style>
  <div id="manual-server" class="card" on-tap="setUpGenericCloudProviderTapped">
    <div class="card-header">
      <div class="tag">[[localize('setup-advanced')]]</div>
      <img src="images/cloud.svg" />
    </div>
    <div class="card-title">[[localize('setup-anywhere')]]</div>
    <div class="card-body">
      <div class="description">
        <ul>
          <li>[[localize('setup-tested')]]</li>
          <li>[[localize('setup-simple-commands')]]</li>
        </ul>
      </div>
    </div>
    <div class="card-footer">
      <paper-button on-tap="setUpGenericCloudProviderTapped"
        >[[localize('setup-action')]]</paper-button
      >
    </div>
  </div>
`;

Polymer({
  _template: html`
    <style include="cloud-install-styles"></style>
    <style>
      :host {
        text-align: center;
      }
      .container {
        display: flex;
        flex-flow: row wrap;
        padding: 12px 0;
      }
      .card {
        background-color: var(--background-contrast-color);
        display: flex;
        flex-direction: column;
        flex: 1 0 40%;
        justify-content: space-between;
        padding: 16px 24px 12px 24px;
        margin: 12px 12px 0 0;
        height: 320px;
        text-align: left;
        color: var(--medium-gray);
        font-weight: normal;
        border-radius: 2px;
        /* For shadows and hover/click colours. */
        transition: 135ms;
        /* Whole card is clickable. */
        cursor: pointer;
        box-shadow:
          0 3px 1px -2px rgba(0, 0, 0, 0.02),
          0 2px 2px 0 rgba(0, 0, 0, 0.14),
          0 1px 5px 0 rgba(0, 0, 0, 0.12);
      }
      /* Card shadows (common to all cards). */
      .card:hover {
        box-shadow:
          0 2px 4px -1px rgba(0, 0, 0, 0.2),
          0 4px 5px 0 rgba(0, 0, 0, 0.1),
          0 1px 10px 0 rgba(0, 0, 0, 0.2);
      }
      .card:active {
        box-shadow:
          0 5px 5px -3px rgba(0, 0, 0, 0.2),
          0 8px 10px 1px rgba(0, 0, 0, 0.14),
          0 3px 14px 2px rgba(0, 0, 0, 0.12);
      }
      /* Non-DigitalOcean card background colours (get darker, inactive -> active). */
      .card:hover {
        background: rgba(38, 50, 56, 0.16);
      }
      .card .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        color: var(--light-gray);
      }
      .card .card-body {
        flex: 6; /* for spacing */
      }
      .card p {
        margin: 0;
      }
      .card .tag {
        font-weight: 500;
        letter-spacing: 0.05em;
        font-size: 10px;
        text-transform: uppercase;
      }
      .card p {
        color: var(--medium-gray);
      }
      .card-title {
        font-size: 20px;
        line-height: 32px;
        flex: 2; /* for spacing */
        color: var(--light-gray);
      }
      .card img {
        margin-top: 11px;
      }
      .card .description {
        letter-spacing: 0;
        line-height: 24px;
      }
      .card .description ul {
        margin-top: 0px;
        padding-left: 16px;
      }
      .card .description ul li {
        margin-bottom: 8px;
      }
      .card-footer {
        padding-top: 12px;
        border-top: 1px solid var(--border-color);
      }
      .card-footer paper-button {
        width: 100%;
        height: 100%;
        margin: 0;
        letter-spacing: 0.75px;
        background-color: inherit;
        color: var(--light-gray);
      }
    </style>

    <outline-step-view>
      <span slot="step-title">[[localize('setup-title')]]</span>
      <span slot="step-description">[[localize('setup-description')]]</span>

      <div class="container">
        ${DO_CARD_HTML} ${GCP_CARD_HTML} ${GCP_LEGACY_CARD_HTML}
        ${AWS_CARD_HTML} ${MANUAL_CARD_HTML}
      </div>
    </outline-step-view>
  `,

  is: 'outline-intro-step',

  properties: {
    digitalOceanAccountName: {
      type: String,
      value: null,
    },
    gcpAccountName: {
      type: String,
      value: null,
    },
    localize: {
      type: Function,
    },
  },

  _openLinkFreeTier:
    '<a href="https://cloud.google.com/free/docs/gcp-free-tier#compute">',
  _openLinkIpPrice:
    '<a href="https://cloud.google.com/vpc/network-pricing#ipaddress">',
  _openLinkFreeTrial:
    '<a href="https://cloud.google.com/free/docs/gcp-free-tier/#free-trial">',
  _closeLink: '<iron-icon icon=open-in-new></iron-icon></a>',

  _computeIsAccountConnected(accountName: string) {
    return Boolean(accountName);
  },

  _showNewGcpFlow(gcpAccountName: string) {
    return (
      outline.gcpAuthEnabled || this._computeIsAccountConnected(gcpAccountName)
    );
  },

  connectToDigitalOceanTapped() {
    if (this.digitalOceanAccountName) {
      this.fire('CreateDigitalOceanServerRequested');
    } else {
      this.fire('ConnectDigitalOceanAccountRequested');
    }
  },

  setUpGenericCloudProviderTapped() {
    this.fire('SetUpGenericCloudProviderRequested');
  },

  setUpAwsTapped() {
    this.fire('SetUpAwsRequested');
  },

  setUpGcpTapped() {
    if (this.gcpAccountName) {
      this.fire('CreateGcpServerRequested');
    } else {
      this.fire('ConnectGcpAccountRequested');
    }
  },

  setUpGcpAdvancedTapped() {
    this.fire('SetUpGcpRequested');
  },
});
