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

import '@material/mwc-icon';

import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('server-stat-card')
export class ServerStatCard extends LitElement {
  @property({type: Number}) value: number;
  @property({type: String}) icon: string;
  @property({type: String}) name: string;
  @property({type: String}) units: string;

  static styles = [
    css`
      :host {
        background: var(--server-stat-card-background);
        border-radius: 0.25rem;
        box-sizing: border-box;
        container-name: conceal-name conceal-data-units;
        container-type: size;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        height: 100%;
        justify-content: space-between;
        overflow: hidden;
        padding: 2rem;
        width: 100%;
      }

      .data,
      .data-value,
      .name {
        all: initial;
        font-family: 'Roboto', sans-serif;
      }

      mwc-icon,
      .data,
      .data-value,
      .name {
        color: var(--server-stat-card-foreground);
      }

      .data-value {
        color: var(--server-stat-card-highlight);
        font-size: 3rem;
        font-weight: 300;
      }

      @container conceal-name (max-height: 150px) {
        .name {
          display: none;
        }
      }

      @container conceal-data-units (max-width: 150px) {
        .data-units {
          display: none;
        }
      }
    `,
  ];

  render() {
    return html`<mwc-icon class="icon">${this.icon}</mwc-icon>
      <p class="data">
        <span class="data-value">${this.value}</span>
        <span class="data-units">${this.units}</span>
      </p>
      <p class="name">${this.name}</p>`;
  }
}
