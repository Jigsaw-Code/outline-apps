export const getNativeAndroidMessageDirectory = filepath => {
  let [languageCode] = filepath
    .split('/')
    .at(-1)
    .split('.');

  switch (languageCode) {
    case 'es-419':
      languageCode = 'es';
      break;
    case 'sr-Latn':
      languageCode = 'b+sr+Latn';
      break;
    case 'zh-CN':
      languageCode = 'zh-rCN';
      break;
    case 'zh-TW':
      languageCode = 'zh-rTW';
      break;
    case 'pt-BR':
      languageCode = 'zh-rBR';
      break;
    case 'pt-PT':
      languageCode = 'zh-rPT';
      break;
  }

  return `src/cordova/plugin/android/resources/strings/values-${languageCode}`;
};
