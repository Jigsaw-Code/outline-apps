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

import {LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import './data_table';
import {DataTableSortDirection, NUMERIC_COMPARATOR} from './data_table';

import './access_key_status';
import './access_key_controls';
import './access_key_usage_meter';

export interface AccessKeyDataTableRow {
  id: string;
  name: string;
  connected: boolean;
  dataUsageBytes: number;
  dataLimitBytes: number;
  asCount: number;
}

@customElement('access-key-data-table')
export class AccessKeyDataTable extends LitElement {
  @property({type: Array}) accessKeys: AccessKeyDataTableRow[];
  @property({type: Object}) localize: (messageId: string) => string;
  @property({type: String}) language: string;
  @property({type: String}) sortColumn: string;
  @property({type: String}) sortDirection: DataTableSortDirection =
    DataTableSortDirection.NONE;

  render() {
    return html`
      <data-table
        .columns=${[
          {
            name: this.localize('server-view-access-keys-key-column-header'),
            render: ({name, connected}: AccessKeyDataTableRow) =>
              html`<access-key-status
                name=${name}
                .connected=${connected}
              ></access-key-status>`,
          },
          {
            name: this.localize('server-view-access-keys-usage-column-header'),
            tooltip: this.localize('server-view-access-keys-usage-tooltip'),
            render: ({dataUsageBytes, dataLimitBytes}: AccessKeyDataTableRow) =>
              html`<access-key-usage-meter
                dataUsageBytes=${dataUsageBytes}
                dataLimitBytes=${dataLimitBytes}
                .localize=${this.localize}
                language=${this.language}
              ></access-key-usage-meter>`,
          },
          {
            name: this.localize(
              'server-view-access-keys-as-count-column-header'
            ),
            tooltip: this.localize('server-view-access-keys-as-count-tooltip'),
            render: ({asCount}: AccessKeyDataTableRow) => html`${asCount}`,
            comparator: (
              row1: AccessKeyDataTableRow,
              row2: AccessKeyDataTableRow
            ) => NUMERIC_COMPARATOR(row1.asCount, row2.asCount),
          },
          {
            render: ({id}: AccessKeyDataTableRow) =>
              html`<access-key-controls
                id=${id}
                .localize=${this.localize}
              ></access-key-controls>`,
          },
        ]}
        .data=${this.accessKeys}
        sortColumn=${this.sortColumn}
        sortDirection=${this.sortDirection}
      ></data-table>
    `;
  }
}
