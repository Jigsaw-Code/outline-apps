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
import {customElement, property} from 'lit/decorators.js';

@customElement('access-key-status')
export class AccessKeyStatus extends LitElement {
  @property({type: String}) name: string;
  @property({type: Boolean}) connected: boolean;

  static styles = css`
    :host {
      --access-key-status-gap: 0.5rem;
      --access-key-status-icon-size: 2rem;
      --access-key-status-text-color: hsl(0, 0%, 79%);
      --access-key-status-font-family: 'Inter', system-ui;
      --access-key-status-indicator-size: 0.5rem;
      --access-key-status-indicator-color: hsla(127, 67%, 59%, 1);

      font-family: var(--access-key-status-font-family);
      color: var(--access-key-status-text-color);
    }

    .key {
      align-items: center;
      display: inline-flex;
      gap: var(--access-key-status-gap);
    }

    .key-icon {
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

    .key-icon-indicator {
      background: var(--access-key-status-indicator-color);
      border-radius: 50%;
      bottom: 0;
      display: inline-block;
      height: var(--access-key-status-indicator-size);
      position: absolute;
      right: 0;
      width: var(--access-key-status-indicator-size);
    }
  `;

  render() {
    return html`<div class="key">
      <div class="key-icon">
        <mwc-icon>vpn_key</mwc-icon>
        ${this.connected
          ? html`<div class="key-icon-indicator"></div>`
          : nothing}
      </div>
      ${this.name}
    </div>`;
  }
}
