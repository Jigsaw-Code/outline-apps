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

export const localize = (messageId: string): string => TEST_MESSAGES[messageId];
