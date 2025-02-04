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

import './data_table';
import {NUMERIC_COMPARATOR} from './data_table';

export interface AccessKeyDataTableRow {
  name: string;
  dataUsageAndLimit: string;
  asCount: string;
  // ???
}

@customElement('access-key-data-table')
export class AccessKeyDataTable extends LitElement {
  @property({type: Array}) accessKeys: AccessKeyDataTableRow[];
  @property({type: Object}) localize: (messageId: string) => string;
  @property({type: String}) sortColumn: string;
  @property({type: Boolean}) sortDescending: boolean;

  static style = css`
    .key {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .key-icon {
      display: inline-flex;
      height: 2rem;
      width: 2rem;
      background: gray;
      border-radius: 50%;
      align-items: center;
      justify-content: center;
    }
  `;

  render() {
    return html`
      <data-table
        .columns=${new Map([
          [
            'name',
            {
              name: this.localize('server-view-access-keys-key-column-header'),
              render: this.renderKey,
            },
          ],
          [
            'dataUsageAndLimit',
            {
              name: this.localize(
                'server-view-access-keys-usage-column-header'
              ),
              tooltip: this.localize('server-view-access-keys-usage-tooltip'),
              render: this.renderUsage,
            },
          ],
          [
            'asCount',
            {
              name: this.localize(
                'server-view-access-keys-as-count-column-header'
              ),
              tooltip: this.localize(
                'server-view-access-keys-as-count-tooltip'
              ),
              comparator: NUMERIC_COMPARATOR,
            },
          ],
          [
            'controls',
            {
              render: this.renderControls,
            },
          ],
        ])}
        .data=${this.accessKeys}
        sortColumn=${this.sortColumn}
        sortDescending=${this.sortDescending}
      ></data-table>
    `;
  }

  renderKey(name: string) {
    return html` <style>
        .key {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .key-icon {
          display: inline-flex;
          height: 2rem;
          width: 2rem;
          background: gray;
          border-radius: 50%;
          align-items: center;
          justify-content: center;
        }
      </style>
      <div class="key">
        <div class="key-icon"><mwc-icon>vpn_key</mwc-icon></div>
        ${name}
      </div>`;
  }

  renderUsage(dataUsageAndLimit: string) {
    const [dataUsage, dataLimit] = dataUsageAndLimit.split(',');

    return html` <style>
        progress {
          width: 100%;
          height: 1rem;
          appearance: none;
        }
        progress[value]::-webkit-progress-bar {
          border-radius: 5px;
          background: gray;
        }
        progress[value]::-webkit-progress-value {
          border-radius: 5px;
          background: green;
        }
      </style>
      <progress value=${dataUsage} max=${dataLimit}></progress>
      <div>${dataUsage} / ${dataLimit}</div>`;
  }

  renderControls() {
    return html`<mwc-icon style="float: right;">more_vert</mwc-icon>`;
  }
}
