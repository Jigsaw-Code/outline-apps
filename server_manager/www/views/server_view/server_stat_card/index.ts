/*
  Copyright 2021 The Outline Authors
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

import '@material/mwc-icon';

import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('server-stat-card')
export class ServerStatCard extends LitElement {
  static styles = [
    css`
      :host {
        /* TODO: hoist these variables */
        --server-stat-card-background: #2e3a3f;
        --server-stat-card-foreground: rgba(255, 255, 255, 0.54);
        --server-stat-card-highlight: #ffffff;

        background: var(--server-stat-card-background);
        border-radius: 0.25rem;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        height: 100%;
        justify-content: space-between;
        padding: 2rem;
        width: 100%;
      }

      .stat-card-data,
      .stat-card-data-value, 
      .stat-card-name {
        all: initial;
        font-family: "Roboto", sans-serif;
      }

      .stat-card-data-value, 
      .stat-card-data,
      .stat-card-icon,
      .stat-card-name {
        color: var(--server-stat-card-foreground);
      }

      .stat-card-data-value {
        font-size: 3rem;
        font-weight: 300;
        color: var(--server-stat-card-highlight);
      }
    `,
  ];

  @property({type: Number}) value: number;
  @property({type: String}) icon: string;
  @property({type: String}) name: string;
  @property({type: String}) units: string;

  render() {
    return html`
      <mwc-icon class="stat-card-icon">${this.icon}</mwc-icon>
      <p class="stat-card-data">
        <span class="stat-card-data-value">${this.value}</span> ${this.units}
      </p>
      <p class="stat-card-name">
        ${this.name}
      </p>`
  }
}
