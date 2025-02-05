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

import {css, html, LitElement, TemplateResult, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

import '@material/mwc-icon';
import '../../info_tooltip';

const INTERNAL_LIT_ENUM_HTML_RESULT = 1;

export interface DataTableColumnProperties<T> {
  comparator?: (_value1: T, _value2: T) => -1 | 0 | 1;
  name?: string;
  render: (_value: T) => TemplateResult<typeof INTERNAL_LIT_ENUM_HTML_RESULT>;
  tooltip?: string;
}

export const NUMERIC_COMPARATOR = (
  value1: string | number,
  value2: string | number
): -1 | 0 | 1 => {
  [value1, value2] = [Number(value1), Number(value2)];

  if (value1 === value2) return 0;
  if (value1 < value2) return -1;
  if (value1 > value2) return 1;
};

@customElement('data-table')
export class DataTable<T extends object> extends LitElement {
  @property({type: Array}) columns: DataTableColumnProperties<T>[];
  @property({type: Array}) data: T[];

  @property({type: String}) sortColumn?: string;
  @property({type: Boolean}) sortDescending?: boolean;

  static styles = css`
    :host {
      --data-table-background-color: hsl(197, 13%, 22%);
      --data-table-text-color: hsl(0, 0%, 79%);
      --data-table-font-family: 'Inter', system-ui;

      --data-table-cell-padding: 1rem;

      --data-table-header-icon-size: 1.2rem;
      --data-table-header-gap: 0.5rem;
      --data-table-header-border-bottom: 0.7rem solid hsla(200, 16%, 19%, 1);

      --data-table-row-border-bottom: 1px solid hsla(0, 0%, 100%, 0.2);
    }

    table,
    thead,
    tbody,
    tr,
    td,
    th {
      all: initial;
    }

    thead,
    tbody,
    tr {
      display: contents;
    }

    table {
      display: grid;
      grid-template-columns: repeat(var(--data-table-columns), auto);
      background-color: var(--data-table-background-color);
    }

    th {
      font-weight: bold;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    th,
    td {
      box-sizing: border-box;
      color: var(--data-table-text-color);
      font-family: var(--data-table-font-family);
      padding: var(--data-table-cell-padding);
    }

    th {
      align-items: center;
      background-color: var(--data-table-background-color);
      cursor: pointer;
      display: flex;
      font-weight: bold;
      gap: var(--data-table-header-gap);
      border-bottom: var(--data-table-header-border-bottom);

      --mdc-icon-size: var(--data-table-header-icon-size);
    }

    td {
      border-bottom: var(--data-table-row-border-bottom);
      display: flex;
      align-items: center;
    }
  `;

  render() {
    return html`
      <style>
        :host {
          --data-table-columns: ${this.columns.length};
        }
      </style>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              ${this.columns.map(column => this.renderHeaderCell(column))}
            </tr>
          </thead>
          <tbody>
            ${this.sortedData.map(row => {
              return html`<tr>
                ${this.columns.map(column => {
                  return html`<td>${column.render(row)}</td>`;
                })}
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  renderHeaderCell(columnProperties: DataTableColumnProperties<T>) {
    return html`<th @click=${() => this.fireSortEvent(columnProperties)}>
      <span>${unsafeHTML(columnProperties.name)}</span>
      ${columnProperties?.tooltip
        ? html`<info-tooltip text=${columnProperties?.tooltip}></info-tooltip>`
        : nothing}
      ${this.sortColumn === columnProperties.name
        ? html`<mwc-icon>
            ${this.sortDescending ? 'arrow_upward' : 'arrow_downward'}
          </mwc-icon>`
        : nothing}
    </th>`;
  }

  fireSortEvent(columnProperties: DataTableColumnProperties<T>) {
    if (!columnProperties.comparator) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent('DataTable::Sort', {
        detail: {
          columnName: columnProperties.name,
          sortDescending: !this.sortDescending,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private get sortedData() {
    if (!this.sortColumn) {
      return this.data;
    }

    const comparator = this.columns.find(
      ({name}) => name === this.sortColumn
    )?.comparator;

    if (!comparator) {
      return this.data;
    }

    return this.data.sort((row1, row2) => {
      if (this.sortDescending) {
        return comparator(row2, row1);
      }

      return comparator(row1, row2);
    });
  }
}
