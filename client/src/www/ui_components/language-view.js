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

import {DirMixin} from '@polymer/polymer/lib/mixins/dir-mixin.js';
import {html} from '@polymer/polymer/lib/utils/html-tag.js';
import {PolymerElement} from '@polymer/polymer/polymer-element.js';

class OutlineLanguageView extends DirMixin(PolymerElement) {
  static get template() {
    return html`
      <style>
        :host {
          background: #fff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
          width: 100%;
          height: 100vh;
          font-family: var(--outline-font-family);
        }
        .language-item {
          display: flex;
          cursor: pointer;
          font-size: 16px;
          border-bottom: 1px solid #e0e0e0;
          padding-left: 24px;
          --paper-item-selected: {
            color: var(--medium-green);
            font-weight: normal;
          }
        }
        .language-name {
          text-align: left;
          flex-grow: 1;
        }
      </style>

      <div id="main">
        <paper-listbox
          selected="{{selectedLanguage}}"
          attr-for-selected="value"
          on-selected-changed="_languageSelected"
        >
          <template is="dom-repeat" items="{{languages}}" as="lang">
            <paper-item class="language-item" value="{{lang.id}}">
              <span class="language-name">{{lang.name}}</span>
              <iron-icon icon="check" hidden$="{{_shouldHideCheckmark(selectedLanguage, lang.id)}}"></iron-icon>
            </paper-item>
          </template>
        </paper-listbox>
      </div>
    `;
  }

  static get is() {
    return 'language-view';
  }

  static get properties() {
    return {
      selectedLanguage: String,
      // An array of {id, name, dir} language objects.
      languages: {
        type: Array,
        readonly: true,
      },
    };
  }

  _languageSelected(event) {
    const languageCode = event.detail.value;
    const params = {bubbles: true, composed: true, detail: {languageCode}};
    this.language = languageCode;
    this.dispatchEvent(new CustomEvent('SetLanguageRequested', params));
  }

  _shouldHideCheckmark(selectedLanguage, languageCode) {
    return selectedLanguage !== languageCode;
  }
}
customElements.define(OutlineLanguageView.is, OutlineLanguageView);
