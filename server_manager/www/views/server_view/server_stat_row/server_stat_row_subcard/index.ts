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

import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('server-stat-row-subcard')
export class ServerStatRowSubcard extends LitElement {
  @property({type: String}) highlight = '';
  @property({type: String}) title = '';
  @property({type: String}) subtitle = '';
  @property({type: String}) icon = '';

  static styles = css`
    :host {
      --server-stat-row-subcard-background: rgb(60, 70, 73);
      --server-stat-row-subcard-border-color: rgba(255, 255, 255, 0.12);
      --server-stat-row-subcard-border-radius: 0.5rem;
      --server-stat-row-subcard-font-family: 'Roboto', system-ui;
      --server-stat-row-subcard-highlight-border-color: rgb(88, 197, 173);
      --server-stat-row-subcard-highlight-border-width: 2px;
      --server-stat-row-subcard-highlight-color: rgb(68, 107, 102);
      --server-stat-row-subcard-highlight-margin-bottom: 1rem;
      --server-stat-row-subcard-highlight-padding-horizontal: 0.5rem;
      --server-stat-row-subcard-highlight-padding-vertical: 0.25rem;
      --server-stat-row-subcard-padding: 1rem;
      --server-stat-row-subcard-subtitle-font-size: 0.9rem;
      --server-stat-row-subcard-text-color: rgba(255, 255, 255, 0.87);
      --server-stat-row-subcard-title-font-size: 1rem;
      --server-stat-row-subcard-title-margin-bottom: 0.25rem;

      background-color: var(--server-stat-row-subcard-background);
      border-radius: var(--server-stat-row-subcard-border-radius);
      box-sizing: border-box;
      display: block;
      padding: var(--server-stat-row-subcard-padding);
      width: 100%;
    }

    .highlight,
    .title,
    .subtitle {
      all: initial;
      font-family: var(--server-stat-row-subcard-font-family);
      color: var(--server-stat-row-subcard-text-color);
      word-wrap: break-word;
    }

    .highlight {
      background-color: var(--server-stat-row-subcard-highlight-color);
      border-radius: var(--server-stat-row-subcard-border-radius);
      border: var(--server-stat-row-subcard-highlight-border-width) solid
        var(--server-stat-row-subcard-highlight-border-color);
      display: inline-block;
      margin-bottom: var(--server-stat-row-subcard-highlight-margin-bottom);
      padding: var(--server-stat-row-subcard-highlight-padding-vertical)
        var(--server-stat-row-subcard-highlight-padding-horizontal);
    }

    .title {
      display: block;
      font-size: var(--server-stat-row-subcard-title-font-size);
      margin-bottom: var(--server-stat-row-subcard-title-margin-bottom);
    }

    .subtitle {
      font-size: var(--server-stat-row-subcard-subtitle-font-size);
      font-weight: bold;
    }
  `;

  render() {
    return html`
      <div>
        ${this.highlight
          ? html`<mark class="highlight">${this.highlight}</mark>`
          : ''}
        <h2 class="title">${this.title}</h2>
        <p class="subtitle">
          <span>${this.subtitle}</span>
          ${this.icon
            ? html`<span role="img" aria-label="Icon">${this.icon}</span>`
            : ''}
        </p>
      </div>
    `;
  }
}
