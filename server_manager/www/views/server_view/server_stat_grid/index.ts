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
import {styleMap} from 'lit/directives/style-map.js';

import {ServerStatCard} from '../server_stat_card';

@customElement('server-stat-grid')
export class ServerStatGrid extends LitElement {
  @property({type: Array}) stats: Array<
    ServerStatCard & {column: string; row: string}
  >;
  @property({type: Number}) columns: number;
  @property({type: Number}) rows: number;

  static styles = [
    css`
      :host,
      article {
        width: 100%;
        height: 100%;
      }

      article {
        display: grid;
        gap: 0.25rem;
      }
    `,
  ];

  render() {
    return html`
      <article
        style=${styleMap({
          gridTemplateColumns: `repeat(${this.columns}, 1fr)`,
          gridTemplateRows: `repeat(${this.rows}, 1fr)`,
        })}
      >
        ${this.stats.map(
          ({
            name,
            value,
            units,
            icon,
            column: gridColumn,
            row: gridRow,
          }) => html`
            <server-stat-card
              style=${styleMap({gridColumn, gridRow})}
              .name=${name}
              .value=${value}
              .units=${units}
              .icon=${icon}
            >
            </server-stat-card>
          `
        )}
      </article>
    `;
  }
}
