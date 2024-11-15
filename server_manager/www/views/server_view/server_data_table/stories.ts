import {html} from 'lit';

import './index';
import {ServerDataTable} from './index';

export default {
  title: 'Manager/Server View/Server Data Table',
  component: 'server-data-table',
  args: {
    columns: [
      ['id', {}],
      ['value', {}],
    ],
    data: [
      {id: '0', value: 'value-0'},
      {id: '1', value: 'value-1'},
      {id: '2', value: 'value-2'},
    ],
    sortColumn: 'id',
    sortDescending: true,
  },
};

export const BasicExample = ({
  columns,
  data,
  sortColumn,
  sortDescending,
}: ServerDataTable) => {
  return html`<server-data-table
    .columns=${new Map(columns)}
    .data=${data}
    .sortColumn=${sortColumn}
    .sortDescending=${sortDescending}
  />`;
};

export const RenderExample = () => {
  return html`<server-data-table
    .columns=${new Map([
      ['Employee Name', {}],
      [
        'Tags',
        {
          render(value: string) {
            const tags = value.split(',');

            return html`${tags.map(
              tag =>
                html`<span
                  style="background-color: hsl(200, 19%, 18%); color: white; padding: 2px 6px; margin: 2px; border-radius: 5px;"
                  >${tag}</span
                >`
            )}`;
          },
        },
      ],
    ])}
    .data=${[
      {
        'Employee Name': 'Vini',
        Tags: 'Lead,IC,Manager',
      },
      {
        'Employee Name': 'Sander',
        Tags: 'Lead,IC',
      },
      {
        'Employee Name': 'Jyyi',
        Tags: 'IC',
      },
      {
        'Employee Name': 'Daniel',
        Tags: 'IC',
      },
    ]}
  />`;
};

export const ComparatorExample = () => {
  return html`<server-data-table
    .columns=${new Map([
      ['Player Name', {}],
      [
        'Score',
        {
          comparator(value1: string, value2: string) {
            return Number(value1) - Number(value2);
          },
        },
      ],
    ])}
    .data=${[
      {
        'Player Name': 'graxxxor23',
        Score: '32342',
      },
      {
        'Player Name': 'kron3_killa',
        Score: '123',
      },
      {
        'Player Name': 'bigbungus1007',
        Score: '123432',
      },
    ]}
    .sortColumn=${'Score'}
    .sortDescending=${true}
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

  return html`<server-data-table
    .columns=${new Map([
      ['id', {}],
      ['value', {}],
    ])}
    .data=${data}
  />`;
};
