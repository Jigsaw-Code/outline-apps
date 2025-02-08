/**
 * Copyright 2025 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {LitElement, html, css, nothing} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';

import {AccessKeyDataTableRow} from '..';

export enum AccessKeyStatusEvent {
  NAME_FIELD_CHANGE = 'AccessKeyStats.NameFieldChange',
}

@customElement('access-key-status')
export class AccessKeyStatus extends LitElement {
  @property({type: Object}) key: AccessKeyDataTableRow;
  @property({type: Boolean}) connected: boolean;

  @query('#nameField') nameField: HTMLElement;

  static styles = css`
    :host {
      --access-key-status-gap: 0.5rem;
      --access-key-status-icon-size: 2rem;
      --access-key-status-text-color: hsl(0, 0%, 79%);
      --access-key-status-key-name-field-border: 1px solid
        hsla(167, 57%, 61%, 0.88);
      --access-key-status-font-family: 'Inter', system-ui;
      --access-key-status-indicator-size: 0.5rem;
      --access-key-status-indicator-color: hsla(127, 67%, 59%, 1);

      font-family: var(--access-key-status-font-family);
      align-items: center;
      display: inline-flex;
      gap: var(--access-key-status-gap);
    }

    .icon-wrapper {
      align-items: center;
      background: gray;
      border-radius: 50%;
      display: inline-flex;
      flex-shrink: 0;
      height: var(--access-key-status-icon-size);
      justify-content: center;
      position: relative;
      width: var(--access-key-status-icon-size);
    }

    .icon-status-indicator {
      background: var(--access-key-status-indicator-color);
      border-radius: 50%;
      bottom: 0;
      display: inline-block;
      height: var(--access-key-status-indicator-size);
      position: absolute;
      right: 0;
      width: var(--access-key-status-indicator-size);
    }

    #nameField:focus {
      outline: none;
      border-bottom: var(--access-key-status-key-name-field-border);
    }
  `;

  render() {
    return html` <div class="icon-wrapper">
        <mwc-icon>vpn_key</mwc-icon>
        ${this.key.isOnline
          ? html`<div class="icon-status-indicator"></div>`
          : nothing}
      </div>

      <span id="nameField" contenteditable @blur=${this.change}
        >${this.key.name}</span
      >`;
  }

  change() {
    if (this.key.name === this.nameField.textContent) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent(AccessKeyStatusEvent.NAME_FIELD_CHANGE, {
        bubbles: true,
        composed: true,
        detail: {...this.key, name: this.nameField.textContent},
      })
    );
  }
}
