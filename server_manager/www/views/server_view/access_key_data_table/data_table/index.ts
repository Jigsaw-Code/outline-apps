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

/**
 * A function that compares two values of type T and returns a number indicating their relative order.
 *
 * @template T The type of the values being compared.
 * @param {T} value1 The first value to compare.
 * @param {T} value2 The second value to compare.
 * @returns {-1 | 0 | 1} A negative number if value1 is less than value2, zero if they are equal, or a positive number if value1 is greater than value2.
 */
export type Comparator<T> = (value1: T, value2: T) => -1 | 0 | 1;

/**
 * A default comparator function for numerical data.
 *
 * @param {number} value1 The first numerical value.
 * @param {number} value2 The second numerical value.
 * @returns {-1 | 0 | 1}  -1 if value1 < value2, 0 if value1 === value2, 1 if value1 > value2.
 */
export const defaultNumericComparator: Comparator<number> = (
  value1: number,
  value2: number
): -1 | 0 | 1 => {
  if (value1 === value2) return 0;
  if (value1 < value2) return -1;
  if (value1 > value2) return 1;
};

/**
 * Enum representing the sort direction of a DataTable column.
 */
export enum DataTableSortDirection {
  ASCENDING = 'ascending',
  DESCENDING = 'descending',
  NONE = 'none',
}

/**
 * Properties describing a column in a DataTable.
 *
 * @template T The type of data represented in the column.
 */
export interface DataTableColumnProperties<T> {
  comparator?: Comparator<T>;
  displayName?: string;
  id: string;
  render: (_value: T) => TemplateResult<typeof INTERNAL_LIT_ENUM_HTML_RESULT>;
  tooltip?: string;
}

// TODO: this table is meant to collapse when a certain container size is reached, but
// our current version of Electron dosen't support it. Add a container query once
// electron is upgraded.

@customElement('data-table')
export class DataTable<T extends object> extends LitElement {
  @property({type: Array}) columns: DataTableColumnProperties<T>[];
  @property({type: Array}) data: T[];

  @property({type: String}) sortColumnId?: string;
  @property({type: String}) sortDirection: DataTableSortDirection =
    DataTableSortDirection.NONE;

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
    `;
  }

  renderHeaderCell(columnProperties: DataTableColumnProperties<T>) {
    let sortIcon;

    switch (this.sortDirection) {
      case DataTableSortDirection.ASCENDING:
        sortIcon = html`<mwc-icon>arrow_upward</mwc-icon>`;
        break;
      case DataTableSortDirection.DESCENDING:
        sortIcon = html`<mwc-icon>arrow_downward</mwc-icon>`;
        break;
      case DataTableSortDirection.NONE:
      default:
        sortIcon = nothing;
    }

    return html`<th @click=${() => this.sort(columnProperties)}>
      <span>${unsafeHTML(columnProperties.displayName)}</span>
      ${columnProperties?.tooltip
        ? html`<info-tooltip text=${columnProperties?.tooltip}></info-tooltip>`
        : nothing}
      ${this.sortColumnId === columnProperties.id ? sortIcon : nothing}
    </th>`;
  }

  sort(columnProperties: DataTableColumnProperties<T>) {
    if (!columnProperties.comparator) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent('DataTable.Sort', {
        detail: {
          columnId: columnProperties.id,
          sortDirection: this.sortDirection,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private get sortedData() {
    if (
      !this.sortColumnId ||
      this.sortDirection === DataTableSortDirection.NONE
    ) {
      return this.data;
    }

    const comparator = this.columns.find(
      ({id}) => id === this.sortColumnId
    )?.comparator;

    if (!comparator) {
      return this.data;
    }

    return this.data.sort((row1, row2) => {
      if (this.sortDirection === DataTableSortDirection.DESCENDING) {
        return comparator(row2, row1);
      }

      return comparator(row1, row2);
    });
  }
}
