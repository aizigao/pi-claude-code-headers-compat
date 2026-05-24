# Changelog

## [0.1.0] - 2026-05-24

### Added
- Added a Pi package entry for Claude-compatible header and request-path adaptation.
- Added runtime compatibility handling based on `~/.pi/agent/models.json` and `~/.pi/agent/claude-code-headers-compat.json`.
- Added support for enabling compatibility only for selected providers through `matchedProvidersUrl`.
- Added support for overriding default request headers through `modifyHeaders`.
- Added support for resolving `${API_KEY}` from either an environment variable name or a literal API key in `models.json`.
- Added user-facing documentation in `README.md` and `README-CN.md`.
