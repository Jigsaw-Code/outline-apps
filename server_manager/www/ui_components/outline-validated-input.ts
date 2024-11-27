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
import './cloud-install-styles';

import './outline-server-settings-styles';
import {Polymer} from '@polymer/polymer/lib/legacy/polymer-fn';
import {html} from '@polymer/polymer/lib/utils/html-tag';

// outline-validated-input
// This is an input, with a cancel and a save button, which performs client-side validation and has
// an event-based hook for server-side evaluation.
//
// Attributes:
//   * editable: Is this input editable?  Default: false
//   * visible: Is this input visible?  Default: false
//   * label: The label for the input.  Default: null
//   * value: The initial value entered in the input.  SHOULD be a valid value.  Default: null
//   * allowed-pattern: Regex describing what inputs are allowed.  Users will be prevented from
//       entering inputs which don't follow the pattern.  Default: ".*"
//   * max-length: The number of characters allowed in the input.  Default: Number.POSITIVE_INFINITY
//   * client-side-validator: A function which takes a string and returns either an empty string on
//       success or an error message on failure.  This function will be called on every keystroke.
//       Default: () => ""
//   * event: The name of the event fired when the save button is tapped.  Passes the current input
//       value as "value" and the Polymer object as "ui".  The handler for this event MUST call
//       ui.setSavedState() or ui.setErrorState(message) depending on its result. Default: null
Polymer({
  _template: html`
    <style include="cloud-install-styles"></style>
    <style include="outline-server-settings-styles"></style>
    <style>
      #container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 545px;
      }

      paper-input {
        width: 60%;
      }

      paper-button {
        height: 36px;
        min-width: 83px;
        text-align: center;
      }

      paper-button[disabled] {
        color: rgba(255, 255, 255, 0.3);
      }

      #saveButton {
        background: var(--primary-green);
        color: #fff;
      }

      #cancelButton {
        color: #fff;
      }

      #saveButton[disabled] {
        background-color: rgba(255, 255, 255, 0.12);
      }

      #cancelButton[disabled] {
        background-color: rgba(0, 0, 0, 0);
      }
    </style>
    <div id="container" hidden$="[[!visible]]">
      <!-- We use on-focus instead of on-tap to handle the case where text is selected but the tap event isn't fired. -->
      <paper-input
        id="input"
        readonly$="[[!editable]]"
        allowed-pattern="[[allowedPattern]]"
        value="[[value]]"
        label="[[label]]"
        maxlength="[[maxLength]]"
        on-focus="_enterEditingState"
        on-keyup="_onKeyUp"
        always-float-label=""
      >
      </paper-input>
      <paper-button
        id="cancelButton"
        hidden$="[[!_showButtons]]"
        disabled$="[[!_enableButtons]]"
        on-tap="_cancel"
      >
        [[localize('cancel')]]
      </paper-button>
      <paper-button
        id="saveButton"
        hidden$="[[!_showButtons]]"
        disabled$="[[!_enableButtons]]"
        on-tap="_save"
      >
        [[localize('save')]]
      </paper-button>
    </div>
  `,

  is: 'outline-validated-input',

  properties: {
    // Properties affecting the whole element
    editable: {type: Boolean, value: false},
    visible: {type: Boolean, value: false},
    // Properties affecting the input
    label: {type: String, value: null},
    allowedPattern: {type: String, value: '.*'},
    maxLength: {type: Number, value: Number.POSITIVE_INFINITY},
    value: {type: String, value: null},
    // `value` here is evaluated.  If it were simply `() => "`, then clientSideValidator
    // would default to just "", not a function returning "".
    // Note also that we can't use paper-input's validator attribute because it will fight
    // with any server-side validation and cause unpredictable results.
    clientSideValidator: {
      type: Function,
      value: () => {
        return () => '';
      },
    },
    // Properties affecting the buttons
    _showButtons: {type: Boolean, value: false},
    _enableButtons: {type: Boolean, value: false},
    // Other properties
    event: {type: String, value: null},
    localize: {type: Function},
  },

  _onKeyUp(e: KeyboardEvent) {
    const input = this.$.input;
    if (e.key === 'Escape') {
      this._cancel();
      input.blur();
      return;
    } else if (e.key === 'Enter') {
      if (!input.invalid) {
        this._save();
        input.blur();
      }
      return;
    }
    const validationError = this.clientSideValidator(input.value);
    if (validationError) {
      input.invalid = true;
      this.$.saveButton.disabled = true;
      input.errorMessage = validationError;
    } else {
      input.invalid = false;
      this.$.saveButton.disabled = false;
    }
  },

  _cancel() {
    const input = this.$.input;
    input.value = this.value;
    input.invalid = false;
    this._showButtons = false;
  },

  _save() {
    const input = this.$.input;
    const value = input.value;
    if (value === this.value) {
      this._cancel();
      return;
    }
    this.$.cancelButton.disabled = true;
    this.$.saveButton.disabled = true;
    input.readonly = true;
    input.invalid = false;

    // We use this heuristic to avoid having to pass a constructor as an attribute
    const numberValue = Number(value);
    const typedValue = Number.isNaN(numberValue) ? value : numberValue;

    this.fire(this.event, {
      validatedInput: typedValue,
      ui: this,
    });
  },

  _enterEditingState() {
    if (!this.editable) {
      return;
    }
    this._showButtons = true;
    this.$.cancelButton.disabled = false;
    this.$.saveButton.disabled = this.$.input.invalid;
  },

  enterSavedState() {
    const input = this.$.input;
    this.value = input.value;
    this._showButtons = false;
    input.readonly = false;
  },

  enterErrorState(message: string) {
    const input = this.$.input;
    this._enableButtons = true;
    input.errorMessage = message;
    input.invalid = true;
    input.readonly = false;
    input.focus();
  },
});
