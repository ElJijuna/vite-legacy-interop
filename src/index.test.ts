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
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:legacy-lib/lib/Button.js'
      )
    })
  })

  // ─── resolveId ──────────────────────────────────────────────────────────────

  describe('resolveId', () => {
    it('returns null for unrelated imports', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'react', undefined, { isEntry: false })).toBeNull()
    })

    it('returns null for bare lib import without subpath', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib', undefined, { isEntry: false })).toBeNull()
    })

    it('returns null for import without libDir prefix', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const resolveId = getResolveId(plugin)
      // missing the 'lib/' segment
      expect(resolveId.call({} as never, 'legacy-lib/Button', undefined, { isEntry: false })).toBeNull()
    })

    it('resolves flat component', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:legacy-lib/lib/Button.js'
      )
    })

    it('resolves flat component with .js extension', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Button.js', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:legacy-lib/lib/Button.js'
      )
    })

    it('resolves nested component (Grid/Column)', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Grid/Column', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:legacy-lib/lib/Grid/Column.js'
      )
    })

    it('returns null and warns for unknown module', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const resolveId = getResolveId(plugin)
      const result = resolveId.call({} as never, 'legacy-lib/lib/NonExistent', undefined, { isEntry: false })
      expect(result).toBeNull()
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('NonExistent'))
    })

    it('handles multiple libs', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib', { name: 'other-lib', libDir: 'dist' }] })
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:legacy-lib/lib/Button.js'
      )
      expect(resolveId.call({} as never, 'other-lib/dist/Widget', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:other-lib/dist/Widget.js'
      )
    })

    it('uses custom libDir', () => {
      const plugin = legacyInterop({ libs: [{ name: 'other-lib', libDir: 'dist' }] })
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'other-lib/dist/Widget', undefined, { isEntry: false })).toBe(
        '\0legacy-interop:other-lib/dist/Widget.js'
      )
      // 'lib' is not the configured libDir
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
      const resolveId = getResolveId(plugin)
      resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })
      expect(console.log).toHaveBeenCalledWith('[vite-legacy-interop] Resolving: legacy-lib/lib/Button')
    })

    it('does not log when showLog is false', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'], showLog: false })
      const resolveId = getResolveId(plugin)
      resolveId.call({} as never, 'legacy-lib/lib/Button', undefined, { isEntry: false })
      expect(console.log).not.toHaveBeenCalled()
    })

    it('does not log when source does not match', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'], showLog: true })
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

    it('returns ESM wrapper code for virtual module', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const load = getLoad(plugin)
      const code = load.call({} as never, '\0legacy-interop:/mocks/legacy-lib/lib/Button.js') as string
      expect(code).toContain("import _mod from '/mocks/legacy-lib/lib/Button.js'")
      expect(code).toContain('export default _default')
      expect(code).not.toContain("export * from")
    })

    it('includes __esModule interop in generated code', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const load = getLoad(plugin)
      const code = load.call({} as never, '\0legacy-interop:/mocks/legacy-lib/lib/Button.js') as string
      expect(code).toContain('_mod.__esModule')
      expect(code).toContain('_mod.default')
    })

    it('uses the correct original import path for nested modules', () => {
      const plugin = legacyInterop({ libs: ['legacy-lib'] })
      const load = getLoad(plugin)
      const code = load.call({} as never, '\0legacy-interop:/mocks/legacy-lib/lib/Grid/Column.js') as string
      expect(code).toContain("import _mod from '/mocks/legacy-lib/lib/Grid/Column.js'")
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
      const resolveId = getResolveId(plugin)
      expect(resolveId.call({} as never, 'unknown-lib/lib/Button', undefined, { isEntry: false })).toBeNull()
    })
  })
})
