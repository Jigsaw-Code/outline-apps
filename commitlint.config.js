module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'client',
        'client/android',
        'client/ios',
        'client/linux',
        'client/macos',
        'client/windows',
        'devtools',
        'docs',
        'infrastructure',
        'manager',
        'manager/linux',
        'manager/macos',
        'manager/windows',
        'storybook'
      ],
    ],
    'type-enum': [
      2,
      'always',
      ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'proposal', 'refactor', 'revert', 'style', 'test'],
    ],
  },
};
