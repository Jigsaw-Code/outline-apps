import {html} from 'lit';

import './index';
import {ServerStatGrid} from './index';

export default {
  title: 'Manager/Server View/Server Stat Grid',
  component: 'server-stats-grid',
  args: {
    columns: 3,
    rows: 2,
    stats: [
      {
        icon: "swap_horiz",
        name: "Data transferred / last 30 days",
        units: "GB",
        value: 2345
      },
      {
        icon: "timer",
        name: "Average time spent across clients",
        units: "Client Hours / Hour",
        value: 83.7,
        column: "3",
        row: "1 / 3",
      },
      {
        icon: "key",
        name: "Server access",
        units: "Keys",
        value: 155,
        row: "1",
        column: "1 / 3"
      },
      {
        icon: "cloud",
        name: "Allowance Used",
        units: "/ 15 TB",
        value: 12.3
      }
    ]
  }
};

export const Example = ({stats, columns, rows}: ServerStatGrid) => html`
  <div style="height: 80vh;">
    <server-stat-grid columns=${columns} rows=${rows} .stats=${stats} />
  </div>
`;
