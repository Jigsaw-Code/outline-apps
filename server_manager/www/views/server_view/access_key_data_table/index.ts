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
import {NUMERIC_COMPARATOR} from './data_table';

export interface AccessKeyDataTableRow {
  name: string;
  dataUsage: string;
  dataLimit: string;
  asCount: string;
  // ???
}

@customElement('access-key-data-table')
export class AccessKeyDataTable extends LitElement {
  @property({type: Array}) accessKeys: AccessKeyDataTableRow[];
  @property({type: Object}) localize: (messageId: string) => string;
  @property({type: String}) sortColumn: string;
  @property({type: Boolean}) sortDescending: boolean;

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
            'dataUsage',
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
    return html`<mwc-icon>vpn_key</mwc-icon> ${name}`;
  }

  renderUsage(dataUsage: string, {dataLimit}: AccessKeyDataTableRow) {
    return html`${dataUsage} (${dataLimit})`;
  }

  renderControls() {
    return html`<mwc-icon>more_vert</mwc-icon>`;
  }
}
