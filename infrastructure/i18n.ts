// Copyright 2018 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {PrimitiveType, FormatXMLElementFn} from 'intl-messageformat';

export type FormattableMessage =
  | string
  | symbol
  | object
  | PrimitiveType
  | FormatXMLElementFn<
      symbol | object,
      string | symbol | object | (string | symbol | object)[]
    >;

export interface Localizer {
  (messageID: string, ...formatKeyValueList: FormattableMessage[]): string;
}

export class LanguageCode {
  private language: string;
  private normalizedLanguage: string;

  constructor(languageCodeStr: string) {
    this.language = languageCodeStr;
    this.normalizedLanguage = languageCodeStr.toLowerCase();
  }
  matches(other: LanguageCode): boolean {
    return this.normalizedLanguage === other.normalizedLanguage;
  }
  string(): string {
    return this.language;
  }
  split(): string[] {
    return this.language.split('-');
  }
}

export class LanguageMatcher {
  constructor(
    private supportedLanguages: LanguageCode[],
    private defaultLanguage?: LanguageCode
  ) {}

  // Goes over each user language, trying to find the supported language that matches
  // the best. We'll trim variants of the user and supported languages in order to find
  // a match, but the language base is guaranteed to match.
  getBestSupportedLanguage(
    userLanguages: LanguageCode[]
  ): LanguageCode | undefined {
    for (const userLanguage of userLanguages) {
      const parts = userLanguage.split();
      while (parts.length > 0) {
        const trimmedUserLanguage = new LanguageCode(parts.join('-'));
        const supportedLanguage =
          this.getSupportedLanguage(trimmedUserLanguage);
        if (supportedLanguage) {
          return supportedLanguage;
        }
        parts.pop();
      }
    }
    return this.defaultLanguage;
  }

  // Returns the closest supported language that matches the user language.
  // We make sure the language matches, but the variant may differ.
  private getSupportedLanguage(
    userLanguage: LanguageCode
  ): LanguageCode | undefined {
    for (const supportedLanguage of this.supportedLanguages) {
      const parts = supportedLanguage.split();
      while (parts.length > 0) {
        const trimmedSupportedLanguage = new LanguageCode(parts.join('-'));
        if (userLanguage.matches(trimmedSupportedLanguage)) {
          return supportedLanguage;
        }
        parts.pop();
      }
    }
    return undefined;
  }
}

export function languageList(languagesAsStr: string[]): LanguageCode[] {
  return languagesAsStr.map(l => new LanguageCode(l));
}

// Returns the languages supported by the browser.
export function getBrowserLanguages(): LanguageCode[] {
  // Ensure that navigator.languages is defined and not empty, as can be the case with some browsers
  // (i.e. Chrome 59 on Electron).
  let languages = navigator.languages as string[];
  if (!languages || languages.length === 0) {
    languages = [navigator.language];
  }
  return languageList(languages);
}
