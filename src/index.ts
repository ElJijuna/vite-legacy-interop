import type { Plugin } from 'vite'
import { join, dirname, relative } from 'node:path'
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'

const require = createRequire(import.meta.url)

const VIRTUAL_PREFIX = '\0legacy-interop:'

/**
 * Library configuration for the {@link legacyInterop} plugin.
 */
export interface LibConfig {
  /** Package name as it appears in import statements. */
  name: string
  /**
   * Subfolder inside the package to scan for modules.
   * @defaultValue `'lib'`
   */
  libDir?: string
}

/**
 * Options for the {@link legacyInterop} plugin.
 */
export interface LegacyInteropOptions {
  /**
   * List of libraries to intercept. Each entry can be a package name string
   * or a {@link LibConfig} object to customise the subfolder.
   *
   * @example
   * ```ts
   * libs: ['legacy-lib', { name: 'another-legacy-lib', libDir: 'dist' }]
   * ```
   */
  libs: (string | LibConfig)[]
  /**
   * When `true`, logs each resolved import path to the console.
   * @defaultValue `false`
   */
  showLog?: boolean
}

interface ResolvedLib {
  name: string
  libDir: string
  prefix: string
  modules: Set<string> | null
}

function scanDir(dir: string, baseDir: string): Set<string> {
  const result = new Set<string>()
  let entries
  try {
    entries = readdirSync(dir, { encoding: 'utf-8', withFileTypes: true })
  } catch {
    return result
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      for (const sub of scanDir(fullPath, baseDir)) result.add(sub)
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const rel = relative(baseDir, fullPath).replace(/\.js$/, '').replace(/\\/g, '/')
      result.add(rel)
    }
  }
  return result
}

function createLib(lib: string | LibConfig): ResolvedLib {
  const name = typeof lib === 'string' ? lib : lib.name
  const libDir = typeof lib === 'string' ? 'lib' : (lib.libDir ?? 'lib')
  const prefix = `${name}/${libDir}/`
  return { name, libDir, prefix, modules: null }
}

function ensureModules(lib: ResolvedLib): Set<string> {
  if (lib.modules !== null) return lib.modules

  lib.modules = new Set<string>()
  try {
    const pkgPath = require.resolve(`${lib.name}/package.json`)
    const libDirPath = join(dirname(pkgPath), lib.libDir)
    lib.modules = scanDir(libDirPath, libDirPath)
  } catch (error) {
    console.error(`[vite-legacy-interop] Error resolving modules for '${lib.name}':`, error)
  }
  return lib.modules
}

/**
 * Vite plugin that intercepts subpath imports of legacy CJS libraries and
 * wraps them in ESM-compatible virtual modules, preventing CommonJS interop
 * errors at runtime with Rolldown.
 *
 * Supports nested subpaths (e.g. `lib/Grid/Column`) and is configurable
 * per library.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite'
 * import { legacyInterop } from 'vite-legacy-interop'
 *
 * export default defineConfig({
 *   plugins: [
 *     legacyInterop({
 *       libs: ['legacy-lib', { name: 'other-legacy-lib', libDir: 'dist' }],
 *       showLog: true,
 *     }),
 *   ],
 * })
 * ```
 */
export function legacyInterop({ libs, showLog = false }: LegacyInteropOptions): Plugin {
  const validLibs = libs.filter(lib => (typeof lib === 'string' ? lib : lib.name).trim() !== '')

  if (!validLibs.length) {
    throw new Error('[vite-legacy-interop] The "libs" option must be a non-empty array.')
  }

  const resolvedLibs = validLibs.map(createLib)

  return {
    name: 'vite-legacy-interop',
    enforce: 'pre',
    resolveId(source) {
      for (const lib of resolvedLibs) {
        if (!source.startsWith(lib.prefix)) continue

        const modulePath = source.slice(lib.prefix.length).replace(/\.js$/, '')

        if (!ensureModules(lib).has(modulePath)) {
          console.warn(`[vite-legacy-interop] '${source}' was not found in '${lib.name}/${lib.libDir}'`)
          return null
        }

        if (showLog) {
          console.log(`[vite-legacy-interop] Resolving: ${source}`)
        }

        const sourceWithExt = source.endsWith('.js') ? source : `${source}.js`
        let absolutePath: string
        try {
          absolutePath = require.resolve(sourceWithExt)
        } catch {
          absolutePath = sourceWithExt
        }

        return VIRTUAL_PREFIX + absolutePath
      }

      return null
    },
    load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return null

      const absolutePath = id.slice(VIRTUAL_PREFIX.length)

      return [
        `import _mod from '${absolutePath}';`,
        `const _default = _mod && _mod.__esModule && 'default' in _mod ? _mod.default : _mod;`,
        `export default _default;`,
      ].join('\n')
    },
  }
}

export default legacyInterop
