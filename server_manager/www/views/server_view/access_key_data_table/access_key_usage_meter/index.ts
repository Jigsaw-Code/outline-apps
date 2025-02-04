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

import {formatBytes} from '../../../../data_formatting';

@customElement('access-key-usage-meter')
export class AccessKeyUsageMeter extends LitElement {
  @property({type: String}) language: string;
  @property({type: Number}) dataUsageBytes: number;
  @property({type: Number}) dataLimitBytes: number;
  @property({type: Number}) dataLimitWarningThreshold: number = 80;
  @property({type: Object}) localize: (messageId: string) => string;

  static styles = css`
    :host {
      --access-key-usage-meter-font-family: 'Inter', system-ui;
      --access-key-usage-meter-gap: 0.5rem;
      --access-key-usage-meter-size: 1rem;

      --access-key-usage-meter-color: hsla(167, 57%, 61%, 0.88);
      --access-key-usage-meter-text-color: hsl(0, 0%, 79%);

      --access-key-usage-meter-warning-color: white;
      --access-key-usage-meter-warning-text-color: hsla(39, 77%, 53%, 1);

      flex-grow: 1;
    }

    label {
      color: var(--access-key-usage-meter-text-color);
      font-family: var(--access-key-usage-meter-font-family);
    }

    .warning > label {
      color: var(--access-key-usage-meter-warning-text-color);
    }

    progress {
      display: block;
      appearance: none;
      height: var(--access-key-usage-meter-size);
      margin-bottom: var(--access-key-usage-meter-gap);
      width: 100%;
    }

    progress[value]::-webkit-progress-bar {
      background: var(--access-key-usage-meter-text-color);
    }

    progress[value]::-webkit-progress-value {
      background: var(--access-key-usage-meter-color);
    }

    .warning > progress[value]::-webkit-progress-value {
      background: var(--access-key-usage-meter-warning-color);
    }
  `;

  render() {
    const isApproachingDataLimit =
      (this.dataUsageBytes / this.dataLimitBytes) * 100 >=
      this.dataLimitWarningThreshold;

    return html`<div class=${isApproachingDataLimit ? 'warning' : ''}>
      <progress
        id="progress"
        max=${this.dataLimitBytes}
        value=${this.dataUsageBytes}
      ></progress>
      <label for="progress">
        ${formatBytes(this.dataUsageBytes, this.language)} /
        ${formatBytes(this.dataLimitBytes, this.language)}
        ${isApproachingDataLimit
          ? this.localize('server-view-access-keys-usage-limit')
          : nothing}
      </label>
    </div>`;
  }
}
