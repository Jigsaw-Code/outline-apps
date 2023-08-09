module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'client/build',
        'client/cordova',
        'client/cordova/android',
        'client/cordova/apple',
        'client/cordova/apple/ios',
        'client/cordova/apple/macos',
        'client/dotfiles',
        'client/docs',
        'client/electron',
        'client/electron/linux',
        'client/electron/windows',
        'client/www'
      ],
    ],
  },
};
