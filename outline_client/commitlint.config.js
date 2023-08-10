module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'build',
        'cordova',
        'cordova/android',
        'cordova/apple',
        'cordova/apple/ios',
        'cordova/apple/macos',
        'devtools',
        'docs',
        'electron',
        'electron/linux',
        'electron/windows',
        'www',
        'service',
        'service/linux',
        'service/windows',
      ],
    ],
  },
};
