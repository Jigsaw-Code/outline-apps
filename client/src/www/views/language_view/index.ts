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

import {LitElement, html, css, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/ripple/ripple.js';
import '@material/web/icon/icon.js';

@customElement('language-view')
export class LanguageView extends LitElement {
  @property({type: Array}) languages!: {id: string; name: string}[];
  @property({type: String}) selectedLanguageID!: string;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      justify-content: space-between;
      text-align: center;
      width: 100%;
    }

    md-list-item {
      cursor: pointer;
      position: relative;
    }
  `;

  render() {
    return html`
      <md-list>
        ${this.languages.map(
          ({id, name}) => html`
            <md-list-item
              value="${id}"
              @click="${this.handleLanguageSelection}"
            >
              <md-ripple></md-ripple>
              ${this.selectedLanguageID === id
                ? html`<md-icon slot="start">check</md-icon>`
                : nothing}
              ${name}
            </md-list-item>
          `
        )}
      </md-list>
    `;
  }

  private handleLanguageSelection({target}: Event) {
    const languageCode = (target as HTMLInputElement)?.value || '';

    this.dispatchEvent(
      new CustomEvent('SetLanguageRequested', {
        bubbles: true,
        composed: true,
        detail: {languageCode},
      })
    );
  }
}
