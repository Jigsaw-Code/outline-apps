// Copyright 2020 The Outline Authors
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

import * as i18n from './i18n';

describe('LanguageMatcher', () => {
  it('returns supported language on match', () => {
    const SUPPORTED_LANGUAGES = i18n.languageList(['es', 'pt-BR', 'ru']);
    const matcher = new i18n.LanguageMatcher(SUPPORTED_LANGUAGES, undefined);
    const supportedLanguage = matcher.getBestSupportedLanguage(
      i18n.languageList(['pt-PT'])
    );
    expect(supportedLanguage?.string()).toEqual('pt-BR');
  });
  it('returns the right variant', () => {
    const SUPPORTED_LANGUAGES = i18n.languageList(['en-GB', 'en-IN', 'en-US']);
    const matcher = new i18n.LanguageMatcher(SUPPORTED_LANGUAGES, undefined);
    const supportedLanguage = matcher.getBestSupportedLanguage(
      i18n.languageList(['en-IN'])
    );
    expect(supportedLanguage?.string()).toEqual('en-IN');
  });
  it('prefers first matched user language', () => {
    const SUPPORTED_LANGUAGES = i18n.languageList(['en-US', 'pt-BR']);
    const matcher = new i18n.LanguageMatcher(SUPPORTED_LANGUAGES, undefined);
    const supportedLanguage = matcher.getBestSupportedLanguage(
      i18n.languageList(['cn', 'en-GB', 'pt-BR'])
    );
    expect(supportedLanguage?.string()).toEqual('en-US');
  });
  it('returns default on no match', () => {
    const SUPPORTED_LANGUAGES = i18n.languageList(['es', 'pt-BR', 'ru']);
    const matcher = new i18n.LanguageMatcher(
      SUPPORTED_LANGUAGES,
      new i18n.LanguageCode('fr')
    );
    const supportedLanguage = matcher.getBestSupportedLanguage(
      i18n.languageList(['cn'])
    );
    expect(supportedLanguage?.string()).toEqual('fr');
  });
  it('returns undefined on no match and no default', () => {
    const SUPPORTED_LANGUAGES = i18n.languageList(['es', 'pt-BR', 'ru']);
    const matcher = new i18n.LanguageMatcher(SUPPORTED_LANGUAGES);
    const supportedLanguage = matcher.getBestSupportedLanguage(
      i18n.languageList(['cn'])
    );
    expect(supportedLanguage).toBeUndefined();
  });
});
