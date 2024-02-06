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
import '@polymer/paper-dialog/paper-dialog';

import {Polymer} from '@polymer/polymer/lib/legacy/polymer-fn';
import {html} from '@polymer/polymer/lib/utils/html-tag';

export interface OutlineModalDialog extends Element {
  open(title: string, text: string, buttons: string[]): Promise<number>;
  close(): void;
}

Polymer({
  _template: html`
    <style include="cloud-install-styles"></style>
    <style>
      :host {
        margin: 0px;
      }
      h3 {
        margin-bottom: 0;
      }
      paper-button {
        color: var(--primary-green);
      }
    </style>
    <paper-dialog id="dialog" modal="">
      <h3 hidden$="[[!title]]">[[title]]</h3>
      <div>[[text]]</div>
      <p class="buttons">
        <template is="dom-repeat" items="{{buttons}}">
          <paper-button dialog-dismiss="" on-tap="buttonTapped">[[item]]</paper-button>
        </template>
      </p>
    </paper-dialog>
  `,

  is: 'outline-modal-dialog',

  properties: {
    title: String,
    text: String,
    buttons: Array,
  },

  // Returns a Promise which fulfills with the index of the button clicked.
  open(title: string, text: string, buttons: string[]) {
    this.title = title;
    this.text = text;
    this.buttons = buttons;
    this.$.dialog.open();
    return new Promise((fulfill, reject) => {
      this.fulfill = fulfill;
      this.reject = reject;
    });
  },

  close() {
    this.$.dialog.close();
  },

  buttonTapped(event: Event & {model: {index: number}}) {
    if (!this.fulfill) {
      console.error('outline-modal-dialog: this.fulfill not defined');
      return;
    }
    this.fulfill(event.model.index);
  },
});
