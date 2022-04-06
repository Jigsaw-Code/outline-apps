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

export const langCodeToName: {[langCode: string]: {id: string; name: string; dir: "rtl" | "ltr"}} = {
  am: {id: "am", name: "አማርኛ", dir: "ltr"},
  ar: {id: "ar", name: "العربية", dir: "rtl"},
  az: {id: "az", name: "Azərbaycanca", dir: "ltr"},
  bg: {id: "bg", name: "Български", dir: "ltr"},
  ca: {id: "ca", name: "Català", dir: "ltr"},
  cs: {id: "cs", name: "Česky", dir: "ltr"},
  da: {id: "da", name: "Dansk", dir: "ltr"},
  de: {id: "de", name: "Deutsch", dir: "ltr"},
  el: {id: "el", name: "Ελληνικά", dir: "ltr"},
  en: {id: "en", name: "English", dir: "ltr"},
  "es-419": {id: "es-419", name: "Español", dir: "ltr"},
  fa: {id: "fa", name: "فارسی", dir: "rtl"},
  fi: {id: "fi", name: "Suomi", dir: "ltr"},
  fil: {id: "fil", name: "Wikang Filipino", dir: "ltr"},
  fr: {id: "fr", name: "Français", dir: "ltr"},
  he: {id: "he", name: "עברית", dir: "rtl"},
  hi: {id: "hi", name: "हिन्दी", dir: "ltr"},
  hr: {id: "hr", name: "Hrvatski", dir: "ltr"},
  hu: {id: "hu", name: "Magyar", dir: "ltr"},
  id: {id: "id", name: "Bahasa Indonesia", dir: "ltr"},
  it: {id: "it", name: "Italiano", dir: "ltr"},
  ja: {id: "ja", name: "日本語", dir: "ltr"},
  kk: {id: "kk", name: "Қазақ тілі", dir: "ltr"},
  km: {id: "km", name: "ភាសាខ្មែរ", dir: "ltr"},
  ko: {id: "ko", name: "한국어", dir: "ltr"},
  lt: {id: "lt", name: "Lietuvių", dir: "ltr"},
  lv: {id: "lv", name: "Latviešu", dir: "ltr"},
  my: {id: "my", name: "မြန်မာစာ", dir: "ltr"},
  nl: {id: "nl", name: "Nederlands", dir: "ltr"},
  no: {id: "no", name: "Norsk (bokmål / riksmål)", dir: "ltr"},
  pl: {id: "pl", name: "Polski", dir: "ltr"},
  "pt-BR": {id: "pt-BR", name: "Português", dir: "ltr"},
  ro: {id: "ro", name: "Română", dir: "ltr"},
  ru: {id: "ru", name: "Русский", dir: "ltr"},
  sk: {id: "sk", name: "Slovenčina", dir: "ltr"},
  sl: {id: "sl", name: "Slovenščina", dir: "ltr"},
  sr: {id: "sr", name: "Српски", dir: "ltr"},
  "sr-Latn": {id: "sr-Latn", name: "Srpski", dir: "ltr"},
  sv: {id: "sv", name: "Svenska", dir: "ltr"},
  th: {id: "th", name: "ไทย", dir: "ltr"},
  tr: {id: "tr", name: "Türkçe", dir: "ltr"},
  uk: {id: "uk", name: "Українська", dir: "ltr"},
  ur: {id: "ur", name: "اردو", dir: "rtl"},
  vi: {id: "vi", name: "Việtnam", dir: "ltr"},
  "zh-CN": {id: "zh-CN", name: "简体中文", dir: "ltr"},
  "zh-TW": {id: "zh-TW", name: "繁體中文", dir: "ltr"},
};

const _langNameToCode: {[langName: string]: {id: string; code: string; dir: "rtl" | "ltr"}} = {};

for (const code in langCodeToName) {
  if (code in langCodeToName) {
    const {name, ...rest} = langCodeToName[code];

    _langNameToCode[name] = {code, ...rest};
  }
}

export const langNameToCode = _langNameToCode;
