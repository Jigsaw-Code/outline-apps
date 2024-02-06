// Copyright 2020 The Outline Authors
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

import '@polymer/iron-icon/iron-icon';
import '@polymer/iron-icons/iron-icons';

import {css, html, LitElement, PropertyDeclarations} from 'lit-element';

export class SortSpan extends LitElement {
  static get styles() {
    return css`
      :host {
        display: inline-block;
        cursor: pointer;
        user-select: none;
      }
    `;
  }
  static get properties(): PropertyDeclarations {
    return {direction: {type: Number}};
  }

  direction: -1 | 0 | 1 = 0;

  override render() {
    let arrow = html`<iron-icon></iron-icon>`;
    if (this.direction === -1) {
      arrow = html`<iron-icon icon="arrow-upward"></iron-icon>`;
    } else if (this.direction === 1) {
      arrow = html`<iron-icon icon="arrow-downward"></iron-icon>`;
    }
    return html`<slot></slot>${arrow}`;
  }
}

customElements.define('outline-sort-span', SortSpan);
