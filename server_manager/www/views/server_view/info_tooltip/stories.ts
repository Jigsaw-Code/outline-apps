import {html} from 'lit';
import '../info_tooltip';

export default {
  title: 'Manager/Server View/Info Tooltip',
  component: 'info-tooltip',
};

export const Basic = () => html`
  <info-tooltip text="Tooltip text here"></info-tooltip>
`;
