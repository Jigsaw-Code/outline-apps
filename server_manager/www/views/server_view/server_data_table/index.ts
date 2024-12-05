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

import {css, html, LitElement, TemplateResult, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';

const DEFAULT_COMPARATOR = (value1: string, value2: string): -1 | 0 | 1 => {
  if (value1 === value2) return 0;
  if (value1 < value2) return -1;
  if (value1 > value2) return 1;
};

const DEFAULT_RENDER = (value: string): TemplateResult<1> => {
  return html`${value}`;
};

@customElement('server-data-table')
export class ServerDataTable extends LitElement {
  @property({type: Array}) columns: Map<
    string,
    {
      comparator?: (_value1: string, _value2: string) => -1 | 0 | 1;
      render?: (_value: string) => TemplateResult<1>;
    }
  >;
  @property({type: Array}) data: {[columnName: string]: string}[];

  @property({type: String}) sortColumn?: string;
  @property({type: String}) sortDescending?: boolean;

  static styles = css`
    .table-container {
      container-type: size;
    }

    .table {
      display: grid;
      grid-template-columns: repeat(var(--server-data-table-columns), auto);
    }

    .table-header {
      font-weight: bold;
      color: white;
      background-color: hsl(200, 19%, 18%);
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .table-row {
      background-color: white;
    }

    .table-row-shaded {
      background-color: hsl(0, 0%, 95%);
    }

    .table-header,
    .table-row {
      box-sizing: border-box;
      content-visibility: auto;
      font-family: Roboto, system-ui;
      padding: 1rem;
    }

    .table-row-label {
      display: none;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 0.75rem;
      margin: 0.25rem 0;
    }

    @container (max-width: 540px) {
      .table {
        grid-template-columns: auto;
      }

      .table-header {
        display: none;
      }

      .table-row {
        padding: 0.25rem 1rem;
      }

      .table-row-empty {
        padding-top: 0;
        padding-bottom: 0;
      }

      .table-row-start {
        padding-top: 1rem;
      }

      .table-row-end {
        padding-bottom: 1rem;
      }

      .table-row-label {
        display: block;
      }
    }
  `;

  private get columnNames() {
    return [...this.columns.keys()];
  }

  private get transformedData() {
    if (this.sortColumn) {
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

    return this.data;
  }

  render() {
    return html`
      <div class="table-container">
        <style>
          :host {
            --server-data-table-columns: ${this.columnNames.length};
          }
        </style>
        <div class="table">
          ${this.columnNames.map((columnName: string) => {
            return this.renderTableHeaderCell(columnName);
          })}
          ${this.transformedData.flatMap((row, rowIndex) => {
            return this.columnNames.map((columnName, columnIndex) => {
              return this.renderTableDataCell(
                columnName,
                columnIndex,
                row[columnName],
                rowIndex
              );
            });
          })}
        </div>
      </div>
    `;
  }

  renderTableHeaderCell(columnName: string) {
    if (this.sortColumn === columnName) {
      return html`<div class="table-header">
        ${columnName} ${this.sortDescending ? '↑' : '↓'}
      </div>`;
    }

    return html`<div class="table-header">${columnName}</div>`;
  }

  renderTableDataCell(
    columnName: string,
    columnIndex: number,
    rowValue: string,
    rowIndex: number
  ) {
    const dataCellContents = rowValue
      ? html`<div class="table-row-label">${columnName}</div>
          ${(this.columns.get(columnName)?.render ?? DEFAULT_RENDER)(rowValue)}`
      : nothing;

    return html`<div
      class=${classMap({
        ['table-row-end']: columnIndex === this.columnNames.length - 1,
        ['table-row-shaded']: rowIndex % 2 === 0,
        ['table-row-start']: columnIndex === 0,
        ['table-row-empty']: !rowValue,
        ['table-row']: true,
      })}
    >
      ${dataCellContents}
    </div>`;
  }
}
