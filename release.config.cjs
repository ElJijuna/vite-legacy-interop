module.exports = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    '@semantic-release/npm',
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        // biome-ignore lint/suspicious/noTemplateCurlyInString: interpolated by semantic-release at release time, not by JS.
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
  ],
};
