import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Plugin } from 'vite'

vi.mock('node:module', () => ({
  createRequire: (_url: string | URL) => ({
    resolve: (specifier: string, _options?: { paths?: string[] }) => {
      if (specifier === 'legacy-lib/package.json') return '/mocks/legacy-lib/package.json'
      if (specifier === 'other-lib/package.json') return '/mocks/other-lib/package.json'
      throw new Error(`Cannot find module '${specifier}'`)
    },
  }),
}))

vi.mock('node:fs', () => ({
  readdirSync: vi.fn(),
}))

import { readdirSync } from 'node:fs'
import { legacyInterop } from './index'

// Dirent-like helpers
const file = (name: string) => ({ name, isFile: () => true, isDirectory: () => false })
const dir = (name: string) => ({ name, isFile: () => false, isDirectory: () => true })

function getConfig(plugin: Plugin) {
  const hook = plugin.config
  if (typeof hook === 'function') return hook
  if (hook && typeof hook === 'object' && 'handler' in hook) return hook.handler
  throw new Error('config hook not found')
}

function getResolveId(plugin: Plugin) {
  const hook = plugin.resolveId
  if (typeof hook === 'function') return hook
  if (hook && typeof hook === 'object' && 'handler' in hook) return hook.handler
  throw new Error('resolveId hook not found')
}

function getLoad(plugin: Plugin) {
  const hook = plugin.load
  if (typeof hook === 'function') return hook
  if (hook && typeof hook === 'object' && 'handler' in hook) return hook.handler
  throw new Error('load hook not found')
}

const buildEnv = { command: 'build', mode: 'production' } as const
const serveEnv = { command: 'serve', mode: 'development' } as const

/** Call the config hook with build command so resolveId becomes active. */
function activateBuildMode(plugin: Plugin) {
  getConfig(plugin).call({} as never, {}, buildEnv)
}

// Default mock:
//   legacy-lib/lib/        -> Button.js, Input.js, Grid/ (dir)
//   legacy-lib/lib/Grid/   -> Column.js, Row.js
//   other-lib/dist/        -> Widget.js
const setupReaddirMock = () => {
  vi.mocked(readdirSync).mockImplementation((path: any) => {
    if (path === '/mocks/legacy-lib/lib') return [file('Button.js'), file('Input.js'), dir('Grid')] as any
    if (path === '/mocks/legacy-lib/lib/Grid') return [file('Column.js'), file('Row.js')] as any
    if (path === '/mocks/other-lib/dist') return [file('Widget.js')] as any
    return []
  })
}

describe('legacyInterop', () => {
  beforeEach(setupReaddirMock)
  afterEach(vi.restoreAllMocks)

  // ─── factory ────────────────────────────────────────────────────────────────

  describe('factory', () => {
    it('returns a plugin with correct name', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      expect(plugin.name).toBe('vite-legacy-interop')
    })

    it('enforces pre order', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      expect(plugin.enforce).toBe('pre')
    })

    it('throws when libs is empty', () => {
      expect(() => legacyInterop({ libs: [] })).toThrow('[vite-legacy-interop]')
    })

    it('throws when all lib names are empty strings', () => {
      expect(() => legacyInterop({ libs: ['', '  '] })).toThrow('[vite-legacy-interop]')
    })

    it('ignores empty strings and uses valid entries', () => {
      const plugin = legacyInterop({ libs: ['', 'legacy-lib', ''] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:legacy-lib/lib/Button'
      )
    })
  })

  // ─── config ──────────────────────────────────────────────────────────────────

  describe('config', () => {
    it('returns optimizeDeps.include for all discovered modules in serve mode', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const result = getConfig(plugin).call({} as never, {}, serveEnv) as any
      expect(result?.optimizeDeps?.include).toEqual(expect.arrayContaining([
        'legacy-lib/lib/Button',
        'legacy-lib/lib/Input',
        'legacy-lib/lib/Grid/Column',
        'legacy-lib/lib/Grid/Row',
      ]))
    })

    it('returns optimizeDeps.include for multiple libs in serve mode', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib', { name: 'other-lib', libDir: 'dist' }] })
      const result = getConfig(plugin).call({} as never, {}, serveEnv) as any
      expect(result?.optimizeDeps?.include).toContain('legacy-lib/lib/Button')
      expect(result?.optimizeDeps?.include).toContain('other-lib/dist/Widget')
    })

    it('returns nothing in build mode (virtual modules handle interop)', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const result = getConfig(plugin).call({} as never, {}, buildEnv)
      expect(result).toBeUndefined()
    })
  })

  // ─── resolveId ──────────────────────────────────────────────────────────────

  describe('resolveId', () => {
    it('returns null for all imports in serve mode', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      getConfig(plugin).call({} as never, {}, serveEnv)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })).toBeNull()
      expect(resolveId.call({} as never, 'react', undefined, { isEntry: false })).toBeNull()
    })

    it('returns null for unrelated imports in build mode', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'react', undefined, { isEntry: false })).toBeNull()
    })

    it('returns null for bare lib import without subpath', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib', undefined, { isEntry: false })).toBeNull()
    })

    it('returns null for import without libDir prefix', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/Button', undefined, { isEntry: false })).toBeNull()
    })

    it('resolves flat component', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:legacy-lib/lib/Button'
      )
    })

    it('resolves flat component with .js extension', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Button.js', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:legacy-lib/lib/Button.js'
      )
    })

    it('resolves nested component (Grid/Column)', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Grid/Column', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:legacy-lib/lib/Grid/Column'
      )
    })

    it('returns null when importer is our own virtual module (loop prevention)', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      const virtualImporter = '\0legacy-interop:legacy-lib/lib/Button'
      expect(resolveId.call({} as never, 'legacy-lib/lib/Button.js', virtualImporter, { isEntry: false })).toBeNull()
    })

    it('returns null and warns for unknown module', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      const result = resolveId.call({} as never, 'legacy-lib/lib/NonExistent', undefined, { isEntry: false })
      expect(result).toBeNull()
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('NonExistent'))
    })

    it('handles multiple libs', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib', { name: 'other-lib', libDir: 'dist' }] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:legacy-lib/lib/Button'
      )
      expect(resolveId.call({} as never, 'other-lib/dist/Widget', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:other-lib/dist/Widget'
      )
    })

    it('uses custom libDir', () => {
      const plugin = legacyInterop({ libs: [{ name: 'other-lib', libDir: 'dist' }] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'other-lib/dist/Widget', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:other-lib/dist/Widget'
      )
      expect(resolveId.call({} as never, 'other-lib/lib/Widget', undefined, { isEntry: false })).toBeNull()
    })
  })

  // ─── showLog ─────────────────────────────────────────────────────────────────

  describe('showLog', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    it('logs when showLog is true and source resolves', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'], showLog: true })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })
      expect(console.log).toHaveBeenCalledWith('[vite-legacy-interop] Resolving: legacy-lib/lib/Button')
    })

    it('does not log when showLog is false', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'], showLog: false })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })
      expect(console.log).not.toHaveBeenCalled()
    })

    it('does not log when source does not match', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'], showLog: true })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      resolveId.call({} as never, 'react', undefined, { isEntry: false })
      expect(console.log).not.toHaveBeenCalled()
    })
  })

  // ─── load ────────────────────────────────────────────────────────────────────

  describe('load', () => {
    it('returns null for non-virtual IDs', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const load = getLoad(plugin)
      expect(load.call({} as never, 'legacy-lib/lib/Button')).toBeNull()
      expect(load.call({} as never, 'react')).toBeNull()
    })

    it('uses namespace import to handle CJS modules without explicit default', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const load = getLoad(plugin)
      const code = load.call({} as never, '\0legacy-interop:legacy-lib/lib/Button') as string
      expect(code).toContain("import * as _modNs from 'legacy-lib/lib/Button.js'")
      expect(code).not.toContain('import _mod from')
    })

    it('returns ESM wrapper with default export', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const load = getLoad(plugin)
      const code = load.call({} as never, '\0legacy-interop:legacy-lib/lib/Button') as string
      expect(code).toContain('export default _default')
      expect(code).not.toContain('export * from')
    })

    it('preserves .js extension when already present in virtual ID', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const load = getLoad(plugin)
      const code = load.call({} as never, '\0legacy-interop:legacy-lib/lib/Button.js') as string
      expect(code).toContain("import * as _modNs from 'legacy-lib/lib/Button.js'")
    })

    it('extracts default from namespace', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const load = getLoad(plugin)
      const code = load.call({} as never, '\0legacy-interop:legacy-lib/lib/Button') as string
      expect(code).toContain("'default' in _modNs")
      expect(code).toContain('_modNs.default')
    })

    it('unwraps nested default without requiring __esModule flag', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const load = getLoad(plugin)
      const code = load.call({} as never, '\0legacy-interop:legacy-lib/lib/Button') as string
      expect(code).toContain("'default' in _mod ? _mod.default : _mod")
      expect(code).not.toContain('__esModule')
    })

    it('uses the correct package path for nested modules', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const load = getLoad(plugin)
      const code = load.call({} as never, '\0legacy-interop:legacy-lib/lib/Grid/Column') as string
      expect(code).toContain("import * as _modNs from 'legacy-lib/lib/Grid/Column.js'")
    })
  })

  // ─── apply ───────────────────────────────────────────────────────────────────

  describe('apply', () => {
    it('defaults to undefined (applies to both build and serve)', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      expect(plugin.apply).toBeUndefined()
    })

    it('sets apply to build', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'], apply: 'build' })
      expect(plugin.apply).toBe('build')
    })

    it('sets apply to serve', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'], apply: 'serve' })
      expect(plugin.apply).toBe('serve')
    })
  })

  // ─── error handling ──────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('does not throw when package cannot be resolved', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => legacyInterop({ libs: ['unknown-lib'] })).not.toThrow()
    })

    it('logs error when package cannot be resolved', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const plugin = legacyInterop({ libs: ['unknown-lib'] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      resolveId.call({} as never, 'unknown-lib/lib/Button', undefined, { isEntry: false })
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('unknown-lib'),
        expect.any(Error)
      )
    })

    it('returns null for all imports when package failed to resolve', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const plugin = legacyInterop({ libs: ['unknown-lib'] })
      activateBuildMode(plugin)
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'unknown-lib/lib/Button', undefined, { isEntry: false })).toBeNull()
    })
  })
})
