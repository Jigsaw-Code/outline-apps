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

import englishMessages from '../messages/en.json';
import IntlMessageFormat, {PrimitiveType, FormatXMLElementFn} from 'intl-messageformat';

type FormattableMessage =
  | string
  | symbol
  | object
  | PrimitiveType
  | FormatXMLElementFn<symbol | object, string | symbol | object | (string | symbol | object)[]>;

export const localize = (messageID: string, ...formatKeyValueList: FormattableMessage[]): string => {
  const message = (englishMessages as {[messageID: string]: string})[messageID];
  const formatConfigObject: Record<string, FormattableMessage> = {};

  for (let index = 0; index < formatKeyValueList.length; index += 2) {
    const [key, value] = formatKeyValueList.slice(index, index + 2);

    formatConfigObject[String(key)] = value;
  }

  if (!message) {
    return `${messageID}(${JSON.stringify(formatConfigObject)})`;
  }

  // we support only english messages in the storybook, for now.
  // blocked on modern-web.dev adding support for addons:
  // https://github.com/modernweb-dev/web/issues/1341
  return String(new IntlMessageFormat(message, 'en').format(formatConfigObject));
};
