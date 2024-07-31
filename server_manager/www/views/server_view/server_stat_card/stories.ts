import {html} from 'lit';

import './index';
import {ServerStatCard} from './index';

export default {
  title: 'Manager/Server View/Server Stat Card',
  component: 'server-stats-card',
  args: {
    icon: "swap_horiz",
    name: "Data transferred / last 30 days",
    units: "Bytes",
    value: 0
  }
};

export const Example = ({icon, name, value, units}: ServerStatCard) => html`
  <div style="height: 300px;">
    <server-stat-card icon=${icon} name=${name} value=${value} units=${units} />
  </div>
`;
