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

import {html} from 'lit';

import './index';
import {DataTableSortDirection, defaultNumericComparator} from './index';

export default {
  title: 'Manager/Server View/Access Key Data Table/Data Table',
  component: 'data-table',
};

export const RenderExample = () => {
  return html`<data-table
    .columns=${[
      {
        id: 'name',
        displayName: 'Employee Name',
        render: ({name}: {name: string}) => html`${name}`,
      },
      {
        id: 'tags',
        displayName: 'Tags',
        tooltip: 'Tooltip for the employee tags',
        render({tags}: {tags: Array<string>}) {
          return html`${tags.map(
            tag =>
              html`<span
                style="background-color: hsl(200, 9%, 48%); color: white; padding: 2px 6px; margin: 2px; border-radius: 5px;"
                >${tag}</span
              >`
          )}`;
        },
      },
    ]}
    .data=${[
      {
        name: 'Vini',
        tags: ['Lead', 'IC', 'Manager'],
      },
      {
        name: 'Sander',
        tags: ['Lead', 'IC'],
      },
      {
        name: 'Jyyi',
        tags: ['IC'],
      },
      {
        name: 'Daniel',
        tags: ['IC'],
      },
    ]}
  />`;
};

export const ComparatorExample = () => {
  return html`<data-table
    .columns=${[
      {
        id: 'name',
        displayName: 'Player Name',
        render: ({name}: {name: string}) => html`${name}`,
      },
      {
        id: 'score',
        displayName: 'Score',
        render: ({score}: {score: number}) => html`${score}`,
        comparator: (row1: {score: number}, row2: {score: number}) =>
          defaultNumericComparator(row1.score, row2.score),
      },
    ]}
    .data=${[
      {
        name: 'graxxxor23',
        score: 32342,
      },
      {
        name: 'kron3_killa',
        score: 123,
      },
      {
        name: 'bigbungus1007',
        score: 123432,
      },
    ]}
    sortColumnId="score"
    sortDirection=${DataTableSortDirection.ASCENDING}
  />`;
};

export const HeavyDataExample = () => {
  const data = [];

  let index = 1000;
  while (index--) {
    data.push({
      id: String(index),
      value: String(index),
    });
  }

  return html`<data-table
    .columns=${[
      {
        id: 'id',
        displayName: 'ID',
        render: ({id}: {id: string}) => html`${id}`,
      },
      {
        id: 'value',
        displayName: 'Value',
        render: ({value}: {value: string}) => html`${value}`,
      },
    ]}
    .data=${data}
  />`;
};
