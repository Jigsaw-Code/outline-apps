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
import type {DataTableColumnProperties} from './data_table';

import './access_key_status';
import './access_key_controls';
import './access_key_usage_meter';

export interface AccessKeyDataTableRow {
  nameAndStatus: string;
  dataUsageAndLimit: string;
  asCount: string;
  // ???
}

@customElement('access-key-data-table')
export class AccessKeyDataTable extends LitElement {
  @property({type: Array}) accessKeys: AccessKeyDataTableRow[];
  @property({type: Object}) localize: (messageId: string) => string;
  @property({type: String}) language: string;
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
        .columns=${new Map<string, DataTableColumnProperties>([
          [
            'nameAndStatus',
            {
              name: this.localize('server-view-access-keys-key-column-header'),
              render: nameAndStatus => {
                const [name, status] = nameAndStatus.split(',');

                return html`<access-key-status
                  name=${name}
                  .connected=${Boolean(status)}
                ></access-key-status>`;
              },
            },
          ],
          [
            'dataUsageAndLimit',
            {
              name: this.localize(
                'server-view-access-keys-usage-column-header'
              ),
              tooltip: this.localize('server-view-access-keys-usage-tooltip'),
              render: dataUsageAndLimit => {
                const [dataUsageBytes, dataLimitBytes] =
                  dataUsageAndLimit.split(',');

                return html`<access-key-usage-meter
                  dataUsageBytes=${Number(dataUsageBytes)}
                  dataLimitBytes=${Number(dataLimitBytes)}
                  .localize=${this.localize}
                  language=${this.language}
                ></access-key-usage-meter>`;
              },
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

  renderControls() {
    return html`<mwc-icon style="float: right;">more_vert</mwc-icon>`;
  }
}
