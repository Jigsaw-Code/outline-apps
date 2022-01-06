/* tslint:disable */
import { Meta } from '@storybook/web-components';

import { ServerConnectionState } from './server_connection_viz';

export default {
  component: "server-connection-viz",
  // argTypes: {
  //   state: {
  //     control: 'select',
  //     options: Object.keys(ServerConnectionState)
  //   }
  // }
} as Meta;

export const Connected = () => `<server-connection-viz state="${ServerConnectionState.CONNECTED}"></server-connection-viz>`;
export const Connecting = () => `<server-connection-viz state="${ServerConnectionState.CONNECTING}" expanded=""></server-connection-viz>`;