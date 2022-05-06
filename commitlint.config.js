module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['android', 'apple', 'cordova', 'devtools', 'electron', 'linux', 'windows', 'www']],
  },
};
