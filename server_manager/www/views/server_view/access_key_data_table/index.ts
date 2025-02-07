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
import {customElement, property, query} from 'lit/decorators.js';

import './access_key_controls';
import {
  AccessKeyControlsEvent,
  SERVER_DATA_LIMITS_SUPPORT_VERSION,
} from './access_key_controls';
import {AccessKeyStatus, AccessKeyStatusEvent} from './access_key_status';
import './access_key_status';
import './access_key_usage_meter';
import './data_table';
import {
  DataTable,
  DataTableEvent,
  DataTableSortDirection,
  defaultNumericComparator,
  defaultStringComparator,
} from './data_table';
import {formatBytes} from '../../../data_formatting';

/**
 * Data expected in the access key table.
 */
export interface AccessKeyDataTableRow {
  id: string;
  name: string;
  connected: boolean;
  accessUrl: string;
  dataUsageBytes: number;
  dataLimitBytes: number;
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

  @query('data-table') table: DataTable<AccessKeyDataTableRow>;

  connectedCallback() {
    super.connectedCallback();

    this.forwardEventListener(
      DataTableEvent.SORT,
      AccessKeyDataTableEvent.SORT
    );

    this.forwardEventListener(
      AccessKeyControlsEvent.DELETE,
      AccessKeyDataTableEvent.DELETE_KEY
    );

    this.forwardEventListener(
      AccessKeyControlsEvent.EDIT_DATA_LIMIT,
      AccessKeyDataTableEvent.EDIT_KEY_DATA_LIMIT
    );

    // Redirect the controls' edit name event to the
    // inline input in the name column.
    this.addEventListener(
      AccessKeyControlsEvent.EDIT_NAME,
      (event: CustomEvent) => {
        event.stopImmediatePropagation();

        (
          this.table.shadowRoot.getElementById(
            this.nameColumnIndex(event.detail)
          ) as AccessKeyStatus
        ).nameField.focus();
      }
    );

    // When the name columns' name field changes, _then_ fire the
    // edit name event.
    this.forwardEventListener(
      AccessKeyStatusEvent.NAME_FIELD_CHANGE,
      AccessKeyDataTableEvent.EDIT_KEY_NAME
    );

    this.forwardEventListener(
      AccessKeyControlsEvent.SHARE,
      AccessKeyDataTableEvent.SHARE_KEY
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
            render: (key: AccessKeyDataTableRow) =>
              html`<access-key-status
                id=${this.nameColumnIndex(key)}
                .key=${key}
              ></access-key-status>`,
            comparator: (a: AccessKeyDataTableRow, b: AccessKeyDataTableRow) =>
              defaultStringComparator(a.name, b.name),
          },
          {
            id: 'usage',
            displayName: this.localize(
              'server-view-access-keys-usage-column-header'
            ),
            tooltip: this.localize('server-view-access-keys-usage-tooltip'),
            render: ({
              dataUsageBytes,
              dataLimitBytes,
            }: AccessKeyDataTableRow) => {
              if (!dataLimitBytes) {
                return html`${formatBytes(dataUsageBytes, this.language)}`;
              }

              return html`<access-key-usage-meter
                dataUsageBytes=${dataUsageBytes}
                dataLimitBytes=${dataLimitBytes}
                .localize=${this.localize}
                language=${this.language}
              ></access-key-usage-meter>`;
            },
            comparator: (a: AccessKeyDataTableRow, b: AccessKeyDataTableRow) =>
              defaultNumericComparator(a.dataUsageBytes, b.dataUsageBytes),
          },
          {
            id: 'controls',
            render: (key: AccessKeyDataTableRow) =>
              html`<access-key-controls
                .key=${key}
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

  private nameColumnIndex(key: AccessKeyDataTableRow) {
    return `status-id-${key.id}`;
  }

  private forwardEventListener(
    sourceEventName: string,
    forwardedEventName: string
  ) {
    this.addEventListener(sourceEventName, (sourceEvent: CustomEvent) => {
      sourceEvent.stopImmediatePropagation();

      this.dispatchEvent(
        new CustomEvent(forwardedEventName, {
          detail: sourceEvent.detail,
          bubbles: true,
          composed: true,
        })
      );
    });
  }
}
