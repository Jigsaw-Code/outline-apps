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
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

import '@material/mwc-icon';
import '../../info_tooltip';

const DEFAULT_COMPARATOR = (value1: string, value2: string): -1 | 0 | 1 => {
  if (value1 === value2) return 0;
  if (value1 < value2) return -1;
  if (value1 > value2) return 1;
};

const DEFAULT_RENDERER = (value: string): TemplateResult<1> => html`${value}`;

@customElement('data-table')
export class DataTable extends LitElement {
  @property({type: Object}) columns: Map<
    string,
    {
      comparator?: (_value1: string, _value2: string) => -1 | 0 | 1;
      render?: (_value: string) => TemplateResult<1>;
      tooltip?: string;
      hidden?: boolean;
    }
  >;
  @property({type: Array}) data: {[columnName: string]: string}[];

  @property({type: String}) sortColumn?: string;
  @property({type: Boolean}) sortDescending?: boolean;

  static styles = css`
    :host {
      --data-table-background-color: hsl(197, 13%, 22%);
      --data-table-text-color: hsl(0, 0%, 79%);
      --data-table-font-family: 'Roboto', system-ui;

      --data-table-cell-padding: 1rem;
      --data-table-cell-border-bottom: 1px solid hsl(0, 0%, 79%);
    }

    section {
      display: grid;
      grid-template-columns: repeat(var(--data-table-columns), auto);
    }

    .header,
    .row {
      box-sizing: border-box;
      color: var(--data-table-text-color);
      content-visibility: auto;
      font-family: var(--data-table-font-family);
      padding: var(--data-table-cell-padding);
    }

    .header {
      align-items: center;
      gap: 0.5rem;
      display: flex;
      font-weight: bold;
      background-color: var(--data-table-background-color);
      position: sticky;
      top: 0;
      z-index: 1;
      margin-bottom: 1rem;
    }

    .header-sort {
      font-size: 1.2rem;
    }

    .header info-tooltip {
      --info-tooltip-icon-size: 1.2rem;
    }

    .row {
      border-bottom: var(--data-table-cell-border-bottom);
      background-color: var(--data-table-background-color);
      margin-bottom: 2px;
    }
  `;

  render() {
    return html`
      <style>
        :host {
          --data-table-columns: ${this.columnNames.length};
        }
      </style>
      <section>
        ${this.columnNames.map(columnName => this.renderHeaderCell(columnName))}
        ${this.sortedData.flatMap(row =>
          this.columnNames.map(columnName =>
            this.renderDataCell(columnName, row[columnName])
          )
        )}
      </section>
    `;
  }

  renderHeaderCell(columnName: string) {
    const column = this.columns.get(columnName);

    return html`<div class="header">
      ${column?.hidden ? nothing : unsafeHTML(columnName)}
      ${column?.tooltip
        ? html`<info-tooltip text=${column?.tooltip}></info-tooltip>`
        : nothing}
      ${this.sortColumn === columnName
        ? html`<mwc-icon class="header-sort">
            ${this.sortDescending ? 'arrow_upward' : 'arrow_downward'}
          </mwc-icon>`
        : nothing}
    </div>`;
  }

  renderDataCell(columnName: string, rowValue: string) {
    return html`<div class="row">
      ${(this.columns.get(columnName)?.render ?? DEFAULT_RENDERER)(rowValue)}
    </div>`;
  }

  private get columnNames() {
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
