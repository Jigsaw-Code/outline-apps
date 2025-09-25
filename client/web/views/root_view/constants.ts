/*
  Copyright 2020 The Outline Authors

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

export interface Language {
  id: string;
  name: string;
  dir: 'ltr' | 'rtl';
  supportId?: string;
}

export const TOAST_TIMEOUT_MS = 3000;
export const TOAST_RENDER_DEFER_MS = 350;

export const PRIVACY_POLICY_URL =
  'https://support.google.com/outline/answer/15331222';

export const LANGUAGES_AVAILABLE: Record<string, Language> = {
  af: {id: 'af', name: 'Afrikaans', dir: 'ltr'},
  am: {id: 'am', name: 'አማርኛ', dir: 'ltr'},
  ar: {id: 'ar', name: 'العربية', dir: 'rtl', supportId: 'ar'},
  az: {id: 'az', name: 'azərbaycan', dir: 'ltr'},
  bg: {id: 'bg', name: 'български', dir: 'ltr', supportId: 'bg'},
  bn: {id: 'bn', name: 'বাংলা', dir: 'ltr'},
  bs: {id: 'bs', name: 'bosanski', dir: 'ltr', supportId: 'bs'},
  ca: {id: 'ca', name: 'català', dir: 'ltr', supportId: 'ca'},
  cs: {id: 'cs', name: 'Čeština', dir: 'ltr', supportId: 'cs'},
  da: {id: 'da', name: 'Dansk', dir: 'ltr', supportId: 'da'},
  de: {id: 'de', name: 'Deutsch', dir: 'ltr', supportId: 'de'},
  el: {id: 'el', name: 'Ελληνικά', dir: 'ltr', supportId: 'el'},
  en: {id: 'en', name: 'English', dir: 'ltr', supportId: 'en_US'},
  'en-GB': {id: 'en-GB', name: 'English (United Kingdom)', dir: 'ltr'},
  es: {id: 'es', name: 'Español', dir: 'ltr', supportId: 'es'},
  'es-419': {
    id: 'es-419',
    name: 'Español (Latinoamérica)',
    dir: 'ltr',
    supportId: 'es',
  },
  et: {id: 'et', name: 'eesti', dir: 'ltr', supportId: 'et'},
  fa: {id: 'fa', name: 'فارسی', dir: 'rtl', supportId: 'fa'},
  fi: {id: 'fi', name: 'Suomi', dir: 'ltr', supportId: 'fi'},
  fil: {id: 'fil', name: 'Filipino', dir: 'ltr', supportId: 'tl'},
  fr: {id: 'fr', name: 'Français', dir: 'ltr', supportId: 'fr'},
  he: {id: 'he', name: 'עברית', dir: 'rtl', supportId: 'iw'},
  hi: {id: 'hi', name: 'हिन्दी', dir: 'ltr', supportId: 'hi'},
  hr: {id: 'hr', name: 'Hrvatski', dir: 'ltr', supportId: 'hr'},
  hu: {id: 'hu', name: 'magyar', dir: 'ltr', supportId: 'hu'},
  hy: {id: 'hy', name: 'հայերեն', dir: 'ltr', supportId: 'hy'},
  id: {id: 'id', name: 'Indonesia', dir: 'ltr', supportId: 'in'},
  is: {id: 'is', name: 'íslenska', dir: 'ltr'},
  it: {id: 'it', name: 'Italiano', dir: 'ltr', supportId: 'it'},
  ja: {id: 'ja', name: '日本語', dir: 'ltr', supportId: 'ja'},
  ka: {id: 'ka', name: 'ქართული', dir: 'ltr', supportId: 'ka'},
  kk: {id: 'kk', name: 'қазақ тілі', dir: 'ltr'},
  km: {id: 'km', name: 'ខ្មែរ', dir: 'ltr'},
  ko: {id: 'ko', name: '한국어', dir: 'ltr', supportId: 'ko'},
  lo: {id: 'lo', name: 'ລາວ', dir: 'ltr'},
  lt: {id: 'lt', name: 'lietuvių', dir: 'ltr', supportId: 'lt'},
  lv: {id: 'lv', name: 'latviešu', dir: 'ltr', supportId: 'lv'},
  mk: {id: 'mk', name: 'македонски', dir: 'ltr', supportId: 'mk'},
  mn: {id: 'mn', name: 'монгол', dir: 'ltr'},
  ms: {id: 'ms', name: 'Melayu', dir: 'ltr'},
  mr: {id: 'mr', name: 'मराठी', dir: 'ltr'},
  my: {id: 'my', name: 'မြန်မာ', dir: 'ltr'},
  ne: {id: 'ne', name: 'नेपाली', dir: 'ltr'},
  nl: {id: 'nl', name: 'Nederlands', dir: 'ltr', supportId: 'nl_NL'},
  no: {id: 'no', name: 'norsk', dir: 'ltr', supportId: 'no'},
  pl: {id: 'pl', name: 'polski', dir: 'ltr', supportId: 'pl'},
  'pt-BR': {
    id: 'pt-BR',
    name: 'Português (Brasil)',
    dir: 'ltr',
    supportId: 'pt_BR',
  },
  'pt-PT': {
    id: 'pt-PT',
    name: 'Português (Portugal)',
    dir: 'ltr',
    supportId: 'pt_BR',
  },
  ro: {id: 'ro', name: 'română', dir: 'ltr', supportId: 'ro'},
  ru: {id: 'ru', name: 'Русский', dir: 'ltr', supportId: 'ru'},
  si: {id: 'si', name: 'සිංහල', dir: 'ltr'},
  sk: {id: 'sk', name: 'Slovenčina', dir: 'ltr', supportId: 'sk'},
  sl: {id: 'sl', name: 'slovenščina', dir: 'ltr', supportId: 'sl'},
  sq: {id: 'sq', name: 'shqip', dir: 'ltr', supportId: 'sq'},
  sr: {id: 'sr', name: 'српски', dir: 'ltr', supportId: 'sr'},
  'sr-Latn': {id: 'sr-Latn', name: 'srpski (latinica)', dir: 'ltr'},
  sv: {id: 'sv', name: 'Svenska', dir: 'ltr', supportId: 'sv'},
  sw: {id: 'sw', name: 'Kiswahili', dir: 'ltr'},
  ta: {id: 'ta', name: 'தமிழ்', dir: 'ltr'},
  th: {id: 'th', name: 'ไทย', dir: 'ltr', supportId: 'th'},
  tr: {id: 'tr', name: 'Türkçe', dir: 'ltr', supportId: 'tr'},
  uk: {id: 'uk', name: 'Українська', dir: 'ltr', supportId: 'uk'},
  ur: {id: 'ur', name: 'اردو', dir: 'rtl', supportId: 'ur'},
  vi: {id: 'vi', name: 'Tiếng Việt', dir: 'ltr', supportId: 'vi'},
  'zh-CN': {id: 'zh-CN', name: '简体中文', dir: 'ltr', supportId: 'zh_CN'},
  'zh-TW': {id: 'zh-TW', name: '繁體中文', dir: 'ltr', supportId: 'zh_TW'},
};
