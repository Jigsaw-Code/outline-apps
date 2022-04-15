/* tslint:disable */
/*
  Copyright 2022 The Outline Authors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import "./index";

import {html} from "lit";

import {localize} from "../../../.storybook/localize";
import {ServerConnectionState} from "../server_connection_indicator";
import {ServerCard} from "./index";

export default {
  title: "Servers View/Server Card",
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
