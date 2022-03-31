/* tslint:disable */
import {ServerConnectionState} from "./server_connection_viz";
import {html} from "lit-html";

import "./index";
import {ServerCard} from "./index";

export default {
  title: "Server Card",
  component: "server-card",
  args: {
    serverName: "My Server",
    serverAddress: "1.0.0.127",
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

const TEST_MESSAGES: {[messageId: string]: string} = {
  "server-rename": "Rename",
  "server-forget": "Remove",
  "connect-button-label": "Connect",
  "disconnect-button-label": "Disconnect",
  "disconnected-server-state": "Disconnected",
  "server-default-name-outline": "My Outline Server",
  "default-name-outline": "My Server",
  "connected-server-state": "Connected",
};

const localize = (messageId: string): string => TEST_MESSAGES[messageId];

export const Example = ({serverName, serverAddress, state, expanded}: ServerCard) => {
  return html`
    <server-card
      .localize=${localize}
      server-name="${serverName}"
      server-address="${serverAddress}"
      .state="${state ?? ServerConnectionState.INITIAL}"
      .expanded="${expanded}"
    ></server-card>
  `;
};
