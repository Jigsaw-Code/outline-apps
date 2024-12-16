/**
 * Copyright 2024 The Outline Authors
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

import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('server-allowance-usage')
export class ServerAllowanceUsage extends LitElement {
  @property({type: String}) message: string;
  @property({type: Number}) allowanceUsed: number;
  @property({type: Number}) allowanceLimit: number;
  @property({type: String}) allowanceUnit: 'gigabyte' | 'terabyte' = 'terabyte';
  @property({type: String}) languageCode: string = 'en-US';

  static styles = css`
    :host {
      background: var(--server-allowance-usage-background);
      border-radius: 0.5rem;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      justify-content: space-between;
      overflow: hidden;
      padding: 1rem;
      width: 100%;
      border: 2px solid var(--server-allowance-usage-foreground);
    }

    .message,
    .allowance,
    .allowance-percentage,
    .allowance-limit {
      all: initial;
      font-family: 'Roboto', sans-serif;
    }

    .message {
      color: var(--server-allowance-usage-foreground);
    }

    .allowance {
      margin-top: 1rem;
    }

    .allowance-percentage {
      color: var(--server-allowance-usage-highlight);
      font-size: 2rem;
    }

    .allowance-limit {
      color: var(--server-allowance-usage-highlight);
    }

    progress {
      width: 100%;
      height: 1rem;
      appearance: none;
    }

    progress[value]::-webkit-progress-bar {
      border-radius: 1rem;
      background: var(--server-allowance-usage-highlight);
    }

    progress[value]::-webkit-progress-value {
      border-radius: 1rem;
      background: var(--server-allowance-usage-progress);
    }
  `;

  get formattedPercentage() {
    return Intl.NumberFormat(this.languageCode, {
      style: 'percent',
      maximumSignificantDigits: 2,
    }).format(this.allowanceUsed / this.allowanceLimit);
  }

  get formattedLimit() {
    return Intl.NumberFormat(this.languageCode, {
      style: 'unit',
      unit: this.allowanceUnit,
    }).format(this.allowanceLimit);
  }

  render() {
    return html`
      <p class="message">${this.message}</p>
      <p class="allowance">
        <span class="allowance-percentage">${this.formattedPercentage}</span>
        <span class="allowance-limit">/${this.formattedLimit}</span>
      </p>
      <progress
        value=${this.allowanceUsed}
        max=${this.allowanceLimit}
      ></progress>
    `;
  }
}
