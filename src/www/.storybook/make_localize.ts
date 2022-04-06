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

// import IntlMessageFormat from "intl-messageformat";
import {StorybookControl} from "./make_storybook_config";
import {langNameToCode} from "../messages/languages";

export type Localized<T extends object> = T & {language: string};

export const languageControl: StorybookControl = {
  controlName: "language",
  controlType: "select",
  defaultValue: "English",
  options: Object.keys(langNameToCode),
};

export async function makeLocalize(language: string = "English") {
  const {code} = langNameToCode[language];

  let messages: {[key: string]: string};
  try {
    messages = await import(`../messages/${code}.json`);
  } catch (e) {
    window.alert(`Could not load messages for language "${language}"`);
  }
  return (messageID: string, ...args: string[]): string => {
    const params = {} as {[key: string]: any};
    for (let i = 0; i < args.length; i += 2) {
      params[args[i]] = args[i + 1];
    }
    if (!messages || !messages[messageID]) {
      // Fallback that shows message id and params.
      return `${messageID}(${JSON.stringify(params, null, " ")})`;
    }
    // Ideally we would pre-parse and cache the IntlMessageFormat objects,
    // but it's ok here because it's a test app.
    // const formatter = new IntlMessageFormat(messages[messageID], language);
    // return formatter.format(params) as string;
    return messages[messageID];
  };
}
