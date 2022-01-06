/* tslint:disable */
import { Meta } from '@storybook/web-components';

import { ServerConnectionState, ServerConnectionViz } from './server_connection_viz';

export default {
  component: 'server-connection-viz',
  args: {
    state: ServerConnectionState.INITIAL
  },
  argTypes: {
    state: {
      control: 'select',
      options: Object.keys(ServerConnectionState)
    }
  }
} as Meta;

export const Example = ({ state }: ServerConnectionViz) =>
  `<server-connection-viz state="${state}"></server-connection-viz>`;
