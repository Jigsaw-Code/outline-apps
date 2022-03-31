/* tslint:disable */
import {ServerConnectionState, ServerConnectionViz} from "./index";
import {html} from "lit-html";

export default {
  title: "Server Card/Server Connection Vizualization",
  component: "server-connection-viz",
  args: {
    state: ServerConnectionState.INITIAL,
    expanded: false,
  },
  argTypes: {
    state: {
      control: "select",
      options: Object.keys(ServerConnectionState),
    },
    expanded: {
      control: "boolean",
    },
  },
};

export const Example = ({state, expanded}: ServerConnectionViz) =>
  html`
    <server-connection-viz
      .state="${state ?? ServerConnectionState.INITIAL}"
      .expanded="${expanded}"
    ></server-connection-viz>
  `;
