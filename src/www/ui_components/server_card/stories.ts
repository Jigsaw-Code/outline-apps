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

import {html} from "lit-html";

import {makeStorybookConfig} from "../../.storybook/make_storybook_config";
import {Localized, languageControl, makeLocalize} from "../../.storybook/make_localize";
import {ServerCard, ServerConnectionState} from "./index";

export const Example = async ({language, serverName, serverAddress, state, expanded}: Localized<ServerCard>) => {
  const localize = await makeLocalize(language);

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

export default makeStorybookConfig(ServerCard, {
  containerName: "ServerView",
  controls: [
    languageControl,
    {
      controlName: "serverName",
      controlType: "text",
      defaultValue: "My Server",
    },
    {
      controlName: "serverAddress",
      controlType: "text",
      defaultValue: "1.0.0.127",
    },
    ...serverConnectionVizControls,
  ],
});
