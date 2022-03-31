/* tslint:disable */
import {html} from "lit-html";

import "./index";
import {ServerList} from "./index";

import {ServerConnectionState} from "../server_card/server_connection_viz";

export default {
  title: "Server List",
  component: "server-list",
  args: {
    servers: [
      {
        name: "My Cool Server 1",
        address: "127.0.0.1:34873",
        state: ServerConnectionState.INITIAL,
      },
      {
        name: "My Cool Server 2",
        address: "127.0.0.1:48094",
        state: ServerConnectionState.CONNECTED,
      },
      {
        name: "My Cool Server 3",
        address: "127.0.0.1:12305",
        state: ServerConnectionState.DISCONNECTING,
      },
    ],
  },
  argTypes: {
    servers: {
      control: "object",
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

export const Example = ({servers}: ServerList) =>
  html`
    <server-list .localize="${localize}" .servers="${servers}"></server-list>
  `;
