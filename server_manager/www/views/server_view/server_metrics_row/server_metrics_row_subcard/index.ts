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

@customElement('server-metrics-row-subcard')
export class ServerMetricsRowSubcard extends LitElement {
  @property({type: String}) highlight?: string;
  @property({type: String}) title: string;
  @property({type: String}) subtitle?: string;
  @property({type: String}) icon?: string;

  static styles = css`
    :host {
      --server-metrics-row-subcard-background: hsl(194, 10%, 26%);
      --server-metrics-row-subcard-border-radius: 0.5rem;
      --server-metrics-row-subcard-font-family: 'Inter', system-ui;
      --server-metrics-row-subcard-padding: 1rem;
      --server-metrics-row-subcard-text-color: hsla(0, 0, 100%, 0.87);

      --server-metrics-row-subcard-highlight-border: 2px solid
        hsl(167, 49%, 56%);
      --server-metrics-row-subcard-highlight-color: hsl(172, 22%, 34%);
      --server-metrics-row-subcard-highlight-margin-bottom: 1rem;
      --server-metrics-row-subcard-highlight-padding: 0.25rem 0.5rem;

      --server-metrics-row-subcard-title-font-size: 1rem;
      --server-metrics-row-subcard-title-margin-bottom: 0.25rem;

      --server-metrics-row-subcard-subtitle-font-size: 0.9rem;

      background-color: var(--server-metrics-row-subcard-background);
      border-radius: var(--server-metrics-row-subcard-border-radius);
      box-sizing: border-box;
      display: block;
      padding: var(--server-metrics-row-subcard-padding);
      width: 100%;
    }

    .highlight,
    .title,
    .subtitle {
      all: initial;
      color: var(--server-metrics-row-subcard-text-color);
      font-family: var(--server-metrics-row-subcard-font-family);
      word-wrap: break-word;
    }

    .highlight {
      background-color: var(--server-metrics-row-subcard-highlight-color);
      border-radius: var(--server-metrics-row-subcard-border-radius);
      border: var(--server-metrics-row-subcard-highlight-border);
      display: inline-block;
      margin-bottom: var(--server-metrics-row-subcard-highlight-margin-bottom);
      padding: var(--server-metrics-row-subcard-highlight-padding);
    }

    .title {
      display: block;
      font-size: var(--server-metrics-row-subcard-title-font-size);
      margin-bottom: var(--server-metrics-row-subcard-title-margin-bottom);
    }

    .subtitle {
      font-size: var(--server-metrics-row-subcard-subtitle-font-size);
      font-weight: bold;
    }
  `;

  render() {
    return html`
      <div>
        ${this.highlight
          ? html`<mark class="highlight">${this.highlight}</mark>`
          : nothing}
        <h4 class="title">${this.title}</h4>
        ${this.subtitle
          ? html`<p class="subtitle">
              <span>${this.subtitle}</span>
              ${this.icon
                ? html`<span role="img" aria-label="Icon">${this.icon}</span>`
                : nothing}
            </p>`
          : nothing}
      </div>
    `;
  }
}
