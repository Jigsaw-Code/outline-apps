module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['android', 'apple', 'ios', 'macos', 'cordova', 'devtools', 'electron', 'linux', 'windows', 'www'],
    ],
  },
};
