/**
 * Copyright 2024 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {findLanguageMatch, findMatch, Language, Languages} from './language';


const LANGUAGES: Languages = {
  'en-US': {id: 'en-US', name: 'English (US)', dir: 'ltr'},
  'en-GB': {id: 'en-GB', name: 'English (UK)', dir: 'ltr'},
  fr: {id: 'fr', name: 'French', dir: 'ltr'},
  de: {id: 'de', name: 'German', dir: 'ltr'},
};

describe('findLanguageMatch', () => {
  it('should find an exact match', () => {
    const result = findLanguageMatch('en-US', LANGUAGES);
    expect(result).toEqual(LANGUAGES['en-US']);
  });

  it('should find a broader match', () => {
    const result = findLanguageMatch('fr-CA', LANGUAGES);
    expect(result).toEqual(LANGUAGES['fr']);
  });

  it('should handle case insensitivity', () => {
    const result = findLanguageMatch('EN-US', LANGUAGES);
    expect(result).toEqual(LANGUAGES['en-US']);
  });

  it('should return undefined for no match', () => {
    const result = findLanguageMatch('es', LANGUAGES);
    expect(result).toBeUndefined();
  });

  it('should use the matchFunction if provided', () => {
    const matchFunction = (code: string, variant: string): Language => {
      if (variant === 'nl') {
        return {id: 'nl', name: 'Custom Dutch', dir: 'ltr'} as Language;
      }
      return undefined;
    };
    const result = findLanguageMatch('nl-NL', LANGUAGES, matchFunction);
    expect(result).toEqual({id: 'nl', name: 'Custom Dutch', dir: 'ltr'});
  });
});

describe('findMatch', () => {
  it('should find the first match from the list', () => {
    const findMock = (code: string, variant: string) =>
      findLanguageMatch(variant, LANGUAGES);
    const result = findMatch(['en', 'fr-ca', 'es'], findMock);
    expect(result).toEqual(LANGUAGES['fr']);
  });

  it('should return undefined if no matches are found', () => {
    const findMock = () => undefined;
    const result = findMatch(['xx', 'yy'], findMock);
    expect(result).toBeUndefined();
  });
});