# Changelog

## [0.2.0] - 2026-05-29

### Fixed
- Align `apiKey` resolution with Pi's latest value-resolution rules, including
  `!command`, `$ENV`, `${ENV}`, escape handling, and legacy env-name fallback.
- Update `README.md` and `README-CN.md` examples to use the new `$ENV` style.

## [0.1.2] - 2026-05-28

### Fixed
- Replace `setTimeout` + `globalThis.fetch = patchedFetch` with `Object.defineProperty`
  getter/setter to survive `undici.install()` from `configureHttpDispatcher()` and coexist
  with other extensions that also patch `globalThis.fetch`.
- `originalFetch` replaced with dynamic `underlyingFetch` reference so that
  `undici.install()` updates propagate to proxied requests.

## [0.1.1] - 2026-05-24

### Fixed
- Update to use `globalThis.fetch` interception style matching pi-proxy-fetch extension.

## [0.1.0] - 2026-05-24

### Added
- Added a Pi package entry for Claude-compatible header and request-path adaptation.
- Added runtime compatibility handling based on `~/.pi/agent/models.json` and `~/.pi/agent/claude-code-headers-compat.json`.
- Added support for enabling compatibility only for selected providers through `matchedProvidersUrl`.
- Added support for overriding default request headers through `modifyHeaders`.
- Added support for resolving `${API_KEY}` from either an environment variable name or a literal API key in `models.json`.
- Added user-facing documentation in `README.md` and `README-CN.md`.
