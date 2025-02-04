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

export interface DataTableColumnProperties {
  comparator?: (_value1: string, _value2: string) => -1 | 0 | 1;
  name?: string;
  render?: (_value: string) => TemplateResult<1>;
  tooltip?: string;
}

export const DEFAULT_COMPARATOR = (
  value1: string,
  value2: string
): -1 | 0 | 1 => {
  if (value1 === value2) return 0;
  if (value1 < value2) return -1;
  if (value1 > value2) return 1;
};

export const NUMERIC_COMPARATOR = (
  value1: string | number,
  value2: string | number
): -1 | 0 | 1 => {
  [value1, value2] = [Number(value1), Number(value2)];

  if (value1 === value2) return 0;
  if (value1 < value2) return -1;
  if (value1 > value2) return 1;
};

export const DEFAULT_RENDERER = (value: string): TemplateResult<1> =>
  html`${value}`;

@customElement('data-table')
export class DataTable extends LitElement {
  @property({type: Object}) columns: Map<string, DataTableColumnProperties>;
  @property({type: Array}) data: {[columnName: string]: string}[];

  @property({type: String}) sortColumn?: string;
  @property({type: Boolean}) sortDescending?: boolean;

  static styles = css`
    :host {
      --data-table-background-color: hsl(197, 13%, 22%);
      --data-table-text-color: hsl(0, 0%, 79%);
      --data-table-font-family: 'Roboto', system-ui;

      --data-table-cell-padding: 1rem;
    }

    .table-container {
      container-type: size;
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

    td {
      content-visibility: auto;
    }

    label {
      display: none;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 0.75rem;
      margin: 0.25rem 0;
    }

    th {
      align-items: center;
      gap: 0.5rem;

      display: flex;
      font-weight: bold;

      --mdc-icon-size: 1.2rem;
    }

    @container (max-width: 540px) {
      table {
        grid-template-columns: auto;
      }
      th {
        display: none;
      }
      td {
        padding: 0.25rem 1rem;
      }
      td:first-child {
        padding-top: 1rem;
      }
      td:last-child {
        padding-bottom: 1rem;
      }
      label {
        display: block;
      }
    }
  `;

  render() {
    return html`
      <style>
        :host {
          --data-table-columns: ${this.columnIds.length};
        }
      </style>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              ${this.columnIds.map(columnName =>
                this.renderHeaderCell(columnName)
              )}
            </tr>
          </thead>
          <tbody>
            ${this.sortedData.map(row => {
              return html`<tr>
                ${this.columnIds.map(columnId => {
                  return this.renderDataCell(columnId, row[columnId]);
                })}
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  renderHeaderCell(columnId: string) {
    const column = this.columns.get(columnId);

    return html`<th>
      <span>${unsafeHTML(column.name)}</span>
      ${column?.tooltip
        ? html`<info-tooltip text=${column?.tooltip}></info-tooltip>`
        : nothing}
      ${this.sortColumn === columnId
        ? html`<mwc-icon>
            ${this.sortDescending ? 'arrow_upward' : 'arrow_downward'}
          </mwc-icon>`
        : nothing}
    </th>`;
  }

  renderDataCell(columnId: string, rowValue: string) {
    return html`<td>
      <label>${unsafeHTML(this.columns.get(columnId)?.name)}</label>
      ${(this.columns.get(columnId)?.render ?? DEFAULT_RENDERER)(rowValue)}
    </td>`;
  }

  private get columnIds() {
    return [...this.columns.keys()];
  }

  private get sortedData() {
    if (!this.sortColumn) {
      return this.data;
    }

    const comparator =
      this.columns.get(this.sortColumn)?.comparator ?? DEFAULT_COMPARATOR;

    return this.data.sort((row1, row2) => {
      const [value1, value2] = [row1[this.sortColumn], row2[this.sortColumn]];

      if (this.sortDescending) {
        return comparator(value2, value1);
      }

      return comparator(value1, value2);
    });
  }
}
