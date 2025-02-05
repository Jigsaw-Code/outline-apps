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

import './access_key_controls';
import {
  AccessKeyControlsEvent,
  SERVER_DATA_LIMITS_SUPPORT_VERSION,
} from './access_key_controls';
import './access_key_status';
import './access_key_usage_meter';
import './data_table';
import {
  DataTableEvent,
  DataTableSortDirection,
  defaultNumericComparator,
} from './data_table';

/**
 * Data expected in the access key table.
 */
export interface AccessKeyDataTableRow {
  id: string;
  name: string;
  connected: boolean;
  dataUsageBytes: number;
  dataLimitBytes: number;
  asnCount: number;
}

/**
 * Events that can be emitted by the access key table.
 */
export enum AccessKeyDataTableEvent {
  SORT = 'AccessKeyDataTable.Sort',
  DELETE_KEY = 'AccessKeyDataTable.DeleteKey',
  EDIT_KEY_DATA_LIMIT = 'AccessKeyDataTable.EditKeyDataLimit',
  EDIT_KEY_NAME = 'AccessKeyDataTable.EditKeyName',
  SHARE_KEY = 'AccessKeyDataTable.ShareKey',
}
@customElement('access-key-data-table')
export class AccessKeyDataTable extends LitElement {
  @property({type: Array}) accessKeys: AccessKeyDataTableRow[];
  @property({type: Object}) localize: (messageId: string) => string;
  @property({type: String}) language: string;
  @property({type: String}) serverVersion: string =
    SERVER_DATA_LIMITS_SUPPORT_VERSION;
  @property({type: String}) sortColumnId: string;
  @property({type: String}) sortDirection: DataTableSortDirection =
    DataTableSortDirection.NONE;

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener(DataTableEvent.SORT, (event: CustomEvent) => {
      this.forwardEvent(event, AccessKeyDataTableEvent.SORT);
    });

    this.addEventListener(
      AccessKeyControlsEvent.DELETE,
      (event: CustomEvent) => {
        this.forwardEvent(event, AccessKeyDataTableEvent.DELETE_KEY);
      }
    );

    this.addEventListener(
      AccessKeyControlsEvent.EDIT_DATA_LIMIT,
      (event: CustomEvent) => {
        this.forwardEvent(event, AccessKeyDataTableEvent.EDIT_KEY_DATA_LIMIT);
      }
    );

    this.addEventListener(
      AccessKeyControlsEvent.EDIT_NAME,
      (event: CustomEvent) => {
        this.forwardEvent(event, AccessKeyDataTableEvent.EDIT_KEY_NAME);
      }
    );

    this.addEventListener(
      AccessKeyControlsEvent.SHARE,
      (event: CustomEvent) => {
        this.forwardEvent(event, AccessKeyDataTableEvent.SHARE_KEY);
      }
    );
  }

  render() {
    return html`
      <data-table
        .columns=${[
          {
            id: 'name',
            displayName: this.localize(
              'server-view-access-keys-key-column-header'
            ),
            render: ({name, connected}: AccessKeyDataTableRow) =>
              html`<access-key-status
                name=${name}
                .connected=${connected}
              ></access-key-status>`,
          },
          {
            id: 'usage',
            displayName: this.localize(
              'server-view-access-keys-usage-column-header'
            ),
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
            id: 'asnCount',
            displayName: this.localize(
              'server-view-access-keys-as-count-column-header'
            ),
            tooltip: this.localize('server-view-access-keys-as-count-tooltip'),
            render: ({asnCount}: AccessKeyDataTableRow) => html`${asnCount}`,
            comparator: (
              row1: AccessKeyDataTableRow,
              row2: AccessKeyDataTableRow
            ) => defaultNumericComparator(row1.asnCount, row2.asnCount),
          },
          {
            id: 'controls',
            render: ({id}: AccessKeyDataTableRow) =>
              html`<access-key-controls
                id=${id}
                .localize=${this.localize}
                serverVersion=${this.serverVersion}
              ></access-key-controls>`,
          },
        ]}
        .data=${this.accessKeys}
        sortColumnId=${this.sortColumnId}
        sortDirection=${this.sortDirection}
      ></data-table>
    `;
  }

  private forwardEvent(sourceEvent: CustomEvent, forwardedEventName: string) {
    sourceEvent.stopImmediatePropagation();

    this.dispatchEvent(
      new CustomEvent(forwardedEventName, {
        detail: sourceEvent.detail,
        bubbles: true,
        composed: true,
      })
    );
  }
}
