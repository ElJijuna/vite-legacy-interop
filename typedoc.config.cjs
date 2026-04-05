/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  entryPoints: ['src/index.ts'],
  out: 'docs',
  name: 'vite-legacy-interop',
  readme: 'README.md',
  includeVersion: true,
  navigationLinks: {
    'npm': 'https://www.npmjs.com/package/vite-legacy-interop',
    'GitHub': 'https://github.com/ElJijuna/vite-legacy-interop',
  },
  excludePrivate: true,
  excludeInternal: true,
  plugin: [],
}
