/*
  Copyright 2020 The Outline Authors

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

import {Polymer} from '@polymer/polymer/lib/legacy/polymer-fn.js';
import {html} from '@polymer/polymer/lib/utils/html-tag.js';

Polymer({
  _template: html`
    <style>
      :host {
        margin: 0 !important;
        font-size: 14px;
        line-height: 20px;
        color: rgba(0, 0, 0, 0.87);
        --error-color: #f44336;
        --success-color: #00bfa5;
      }
      :host a {
        color: var(--medium-green);
        text-decoration: none;
      }
      paper-dialog {
        margin: 0 auto;
        position: fixed;
        bottom: 0;
        width: 100%;
        overflow: hidden;
      }
      .vertical-margin {
        margin: 24px 0;
      }
      .title {
        font-size: 20px;
        line-height: 32px;
        padding-bottom: 12px;
      }
      .faded {
        color: rgba(0, 0, 0, 0.54);
      }
      .center {
        text-align: center;
      }
      .shadow {
        box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.14), 0 2px 2px 0 rgba(0, 0, 0, 0.12), 0 1px 3px 0 rgba(0, 0, 0, 0.2);
        border-radius: 2px;
      }
      .top-divider {
        border-top-width: 1px;
        border-top-color: rgba(0, 0, 0, 0.08);
        border-top-style: solid;
      }
      /* rtl:ignore */
      paper-input {
        margin: 24px;
        --paper-input-container-underline: {
          display: none;
        }
        --paper-input-container-underline-focus: {
          display: none;
        }
        --paper-input-container-underline-disabled: {
          display: none;
        }
        --paper-input-container: {
          padding: 18px 0;
        }
      }
      #addServerSheet paper-input {
        --paper-input-container-label: {
          color: rgba(0, 0, 0, 0.3);
        }
      }
      .footer {
        margin: 0;
        padding: 24px 36px;
        background: #fafafa;
        color: #737373;
      }
      #server-config {
        padding: 24px;
      }
      #serverDetectedSheet paper-input {
        /* For some strange reason, Apple increases the brightness of the input. Reduce it, baring
         * in mind the trade-off with respect to Android, which displays the text appropriately.
         * Also note that both opacity declarations are required for it to be applied in Apple.
         */
        --paper-input-container-input-color: var(--success-color);
        --paper-input-container-disabled: {
          opacity: 1;
        }
        --paper-input-container-input: {
          opacity: 1;
          filter: brightness(0.8);
          /* Do not flip the access key. */
          direction: ltr /* rtl:ignore */;
        }
      }
      paper-button {
        margin: 0;
        font-weight: 500;
      }
      .button-container {
        display: -webkit-box;
        display: -moz-box;
        display: -ms-flexbox;
        display: -webkit-flex;
        display: flex;
        justify-content: space-between;
        margin-bottom: 48px;
      }
      .input-focus {
        text-align: left;
      }
      .input-invalid {
        color: var(--error-color);
        --paper-input-container-input-color: var(--error-color);
      }
      #add-server-button {
        background-color: var(--dark-green);
        color: #fff;
        padding: 0 20px;
      }
      paper-input iron-icon {
        --iron-icon-fill-color: #333;
        opacity: 0.4;
        margin-left: 12px;
      }
      #serverDetectedSheet iron-icon {
        opacity: 1;
        --iron-icon-fill-color: var(--success-color);
      }
      /* Reverse key icon */
      :host(:dir(rtl)) iron-icon {
        transform: scaleX(-1);
      }
    </style>

    <paper-dialog id="addServerSheet" with-backdrop>
      <div class="vertical-margin">
        <div class="title">[[localize('server-add-access-key')]]</div>
        <div class="faded">[[localize('server-add-instructions')]]</div>
      </div>
      <paper-input
        id="accessKeyInput"
        class="shadow"
        label="[[localize('server-access-key-label', 'ssProtocol', 'ss://')]]"
        no-label-float=""
        value="{{accessKey}}"
      >
        <iron-icon icon="communication:vpn-key" slot="suffix"></iron-icon>
      </paper-input>
      <div class="footer center top-divider">
        <template is="dom-if" if="[[shouldShowNormalAccessMessage]]">
          <div
            id="addServerFooter"
            inner-h-t-m-l="[[localize('server-create-your-own', 'breakLine', '<br/>', 'openLink', '<a href=https://s3.amazonaws.com/outline-vpn/index.html>', 'closeLink', '</a>')]]"
          ></div>
        </template>
        <template is="dom-if" if="[[shouldShowAltAccessMessage]]">
          <div
            id="addServerFooterAlt"
            inner-h-t-m-l="[[localize('server-create-your-own-access', 'breakLine', '<br/>', 'openLink', '<a href=https://s3.amazonaws.com/outline-vpn/index.html>', 'openLink2', '<a href=https://www.reddit.com/r/outlinevpn/wiki/index/outline_vpn_access_keys/>', 'closeLink', '</a>')]]"
          ></div>
        </template>
        <template is="dom-if" if="[[invalidAccessKeyInput]]">
          <div
            id="invalidAccessKeyFooter"
            inner-h-t-m-l="[[localize('server-add-invalid', 'openLine', '<span class=input-invalid>', 'closeLine', '</span><br/>')]]"
          ></div>
        </template>
      </div>
    </paper-dialog>

    <!-- no-cancel-on-outside-click prevents the dialog appearing for only
         an instant when the user clicks on some other part of the window.
         This is a real problem on desktop. -->
    <paper-dialog id="serverDetectedSheet" with-backdrop no-cancel-on-outside-click>
      <div class="vertical-margin">
        <div class="title">[[localize('server-access-key-detected')]]</div>
        <div class="faded">
          [[localize('server-detected')]]
        </div>
        <div class="shadow vertical-margin">
          <paper-input value="[[accessKey]]" no-label-float="" disabled="">
            <iron-icon icon="communication:vpn-key" slot="suffix"></iron-icon>
          </paper-input>
        </div>
        <div class="button-container">
          <paper-button class="faded" on-tap="_ignoreDetectedServer">[[localize('server-add-ignore')]]</paper-button>
          <paper-button id="add-server-button" on-tap="_addDetectedServer">[[localize('server-add')]]</paper-button>
        </div>
      </div>
    </paper-dialog>
  `,

  is: 'add-server-view',

  properties: {
    localize: Function,
    useAltAccessMessage: Boolean,
    invalidAccessKeyInput: {
      Boolean,
      value: false,
    },
    accessKey: {
      type: String,
      observer: '_accessKeyChanged',
    },
    shouldShowNormalAccessMessage: {
      type: Boolean,
      computed: '_computeShouldShowNormalAccessMessage(useAltAccessMessage, invalidAccessKeyInput)',
    },
    shouldShowAltAccessMessage: {
      type: Boolean,
      computed: '_computeShouldShowAltAccessMessage(useAltAccessMessage, invalidAccessKeyInput)',
    },
  },

  ready: function() {
    this.$.serverDetectedSheet.addEventListener('opened-changed', this._openChanged.bind(this));
    this.$.addServerSheet.addEventListener('opened-changed', this._openChanged.bind(this));
    // Workaround for --paper-input-container-input-[focus|invalid] not getting applied.
    // See https://github.com/PolymerElements/paper-input/issues/546.
    this.$.accessKeyInput.addEventListener('focused-changed', this._inputFocusChanged.bind(this));
    this.$.accessKeyInput.addEventListener('invalid-changed', this._inputInvalidChanged.bind(this));
  },

  openAddServerSheet: function() {
    this.$.serverDetectedSheet.close();
    this.$.addServerSheet.open();
  },

  openAddServerConfirmationSheet: function(accessKey) {
    this.$.addServerSheet.close();
    this.accessKey = accessKey;
    this.$.serverDetectedSheet.open();
  },

  isAddingServer: function() {
    return this.$.serverDetectedSheet.opened;
  },

  close: function() {
    this.$.addServerSheet.close();
    this.$.serverDetectedSheet.close();
  },

  _accessKeyChanged: function() {
    // Use debounce to detect when the user has stopped typing.
    this.debounce(
      'accessKeyChanged',
      () => {
        this._addServerFromInput();
      },
      750
    );
  },

  _addServerFromInput: function() {
    var accessKeyInput = this.$.accessKeyInput;
    if (!this.accessKey || this.accessKey === '') {
      accessKeyInput.invalid = false;
      return;
    }
    if (accessKeyInput.validate()) {
      this.fire('AddServerConfirmationRequested', {accessKey: this.accessKey});
    }
  },

  _addDetectedServer: function() {
    this.fire('AddServerRequested', {accessKey: this.accessKey});
    this.close();
  },

  _ignoreDetectedServer: function() {
    this.fire('IgnoreServerRequested', {accessKey: this.accessKey});
    this.close();
  },

  // Event listeners
  _openChanged: function(event) {
    var dialog = event.target;
    if (dialog.opened) {
      // Scroll the page to the bottom to prevent the dialog from moving when the keyboard
      // appears. Also disallow scrolling to prevent the dialog from sliding under the keyboard.
      // See https://github.com/PolymerElements/iron-overlay-behavior/issues/140.
      window.scrollTo(0, document.body.scrollHeight);
      document.body.addEventListener('touchmove', this._disallowScroll, {passive: false});
    } else {
      // Restore scrolling and reset state.
      document.body.removeEventListener('touchmove', this._disallowScroll, {passive: false});
      this.accessKey = '';
    }
  },

  _inputFocusChanged: function(event) {
    var input = event.target;
    if (input.focused) {
      this.$.accessKeyInput.label = '';
    } else {
      this.$.accessKeyInput.label = this.localize('server-access-key-label', 'ssProtocol', 'ss://');
    }
    input.toggleClass('input-focus', input.focused);
  },

  _inputInvalidChanged: function(event) {
    var input = event.target;
    input.toggleClass('input-invalid', input.invalid);
    if (input.invalid) {
      this.invalidAccessKeyInput = input.invalid;
    } else {
      this.invalidAccessKeyInput = false;
    }
  },

  _disallowScroll: function(event) {
    event.preventDefault();
  },

  _computeShouldShowNormalAccessMessage(useAltAccessMessage, invalidAccessKeyInput) {
    return !useAltAccessMessage && !invalidAccessKeyInput;
  },

  _computeShouldShowAltAccessMessage(useAltAccessMessage, invalidAccessKeyInput) {
    return useAltAccessMessage && !invalidAccessKeyInput;
  },
});
