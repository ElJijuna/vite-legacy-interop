# [1.1.0](https://github.com/ElJijuna/vite-legacy-interop/compare/v1.0.4...v1.1.0) (2026-07-22)


### Bug Fixes

* replace npm install with npm ci for consistent dependency installation ([2e761a8](https://github.com/ElJijuna/vite-legacy-interop/commit/2e761a8d7edd152a0a92d016ae77a8c35421dc24))
* update Vite peer dependency range to support versions 6.x and 7.x ([756709e](https://github.com/ElJijuna/vite-legacy-interop/commit/756709ec6a13caba5cb95e1df7deffb4df6c4c86))


### Features

* add integration tests for legacy interop with real Vite build ([f1bc3bd](https://github.com/ElJijuna/vite-legacy-interop/commit/f1bc3bd219dd87e4acc49e802c551a49c546067f))
* add support for query suffix in module resolution ([8388d25](https://github.com/ElJijuna/vite-legacy-interop/commit/8388d25d48daa5e1b71647868996454c6fa97d2b))
* enhance error handling and warnings for missing libDir in legacyInterop ([87a1684](https://github.com/ElJijuna/vite-legacy-interop/commit/87a16845d8ed8c00c19af3648ab1ffd959189ee3))

## [1.0.4](https://github.com/ElJijuna/vite-legacy-interop/compare/v1.0.3...v1.0.4) (2026-04-06)


### Bug Fixes

* prevent import loop via importer check instead of absolute path resolution ([bd7059b](https://github.com/ElJijuna/vite-legacy-interop/commit/bd7059b92116412f19c53913d5e35c63d8654ff6))
* split serve/build strategies to resolve CJS interop errors in both modes ([fc4af9d](https://github.com/ElJijuna/vite-legacy-interop/commit/fc4af9db2d32caa0bc38d74f63a47cae17f9735d))
* use namespace import in virtual module to resolve missing default export ([2bde17f](https://github.com/ElJijuna/vite-legacy-interop/commit/2bde17f9cb4370174f17a00a6ac4fc66453b2778))

## [1.0.3](https://github.com/ElJijuna/vite-legacy-interop/compare/v1.0.2...v1.0.3) (2026-04-06)


### Bug Fixes

* resolve absolute path in virtual module ID to prevent double-import loop ([0c0cd36](https://github.com/ElJijuna/vite-legacy-interop/commit/0c0cd36bd63d161b135a63a332bf0a8f6426c698))

## [1.0.2](https://github.com/ElJijuna/vite-legacy-interop/compare/v1.0.1...v1.0.2) (2026-04-05)


### Bug Fixes

* lazy-load module scan on first resolveId call ([7f100d1](https://github.com/ElJijuna/vite-legacy-interop/commit/7f100d1e2bc92d8c13bcbab25c7a1bffc7db1d4b))

## [1.0.1](https://github.com/ElJijuna/vite-legacy-interop/compare/v1.0.0...v1.0.1) (2026-04-05)


### Bug Fixes

* remove export * from virtual module wrapper to prevent tree-shaking issues ([b9720bb](https://github.com/ElJijuna/vite-legacy-interop/commit/b9720bb23713d54e898511b90ca28e46f86abfb0))

# 1.0.0 (2026-04-05)


### Bug Fixes

* add .js extension to virtual module imports and fix TypeScript errors ([f45328f](https://github.com/ElJijuna/vite-legacy-interop/commit/f45328f11f900e9298aecf0801b1daf3be71c4c5))
* correct __component variable name in load hook test. ([6fd2610](https://github.com/ElJijuna/vite-legacy-interop/commit/6fd26108b6bea3a65ee39024dce8241da1916b15))


### Features

* add vite-legacy-interop plugin ([0b82d5f](https://github.com/ElJijuna/vite-legacy-interop/commit/0b82d5f8aee517c974269d3b81af16047b24cb96))
