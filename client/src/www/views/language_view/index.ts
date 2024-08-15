/*
  Copyright 2024 The Outline Authors

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
import {customElement, property, query} from 'lit/decorators.js';
import '@material/mwc-list/mwc-list.js';
import '@material/mwc-list/mwc-list-item.js';
import '@material/mwc-icon';

@customElement('language-view')
export class LanguageView extends LitElement {
  @property({type: String}) selectedLanguage!: string;
  @property({type: Array}) languages!: {id: string; name: string}[];

  @query('mwc-list') list!: {
    selected: {value: string} | null;
  };

  static styles = css`
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
    }
    .language-item[activated] {
      color: var(--medium-green);
      font-weight: normal;
    }
    .language-name {
      text-align: left;
      flex-grow: 1;
    }
  `;

  render() {
    return html`
      <div id="main">
        <mwc-list @selected="${this.languageSelected}">
          ${this.languages.map(
            lang => html`
              <mwc-list-item
                value="${lang.id}"
                ?activated=${this.selectedLanguage === lang.id}
              >
                <span class="language-name">${lang.name}</span>
                ${this.selectedLanguage === lang.id
                  ? html`<mwc-icon>check</mwc-icon>`
                  : ''}
              </mwc-list-item>
            `
          )}
        </mwc-list>
      </div>
    `;
  }

  private languageSelected() {
    const languageCode = this.list.selected?.value || '';
    this.dispatchEvent(
      new CustomEvent('SetLanguageRequested', {
        bubbles: true,
        composed: true,
        detail: {languageCode},
      })
    );
  }
}
