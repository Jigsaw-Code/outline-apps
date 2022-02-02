/* tslint:disable */
import {ServerConnectionState, ServerConnectionViz} from "./server_connection_viz";

export default {
  title: "Server Connection Vizualization",
  component: "server-connection-viz",
  args: {
    state: ServerConnectionState.INITIAL,
  },
  argTypes: {
    state: {
      control: "select",
      options: Object.keys(ServerConnectionState),
    },
  },
};

export const Example = ({state}: ServerConnectionViz) =>
  `<server-connection-viz state="${state}"></server-connection-viz>`;
