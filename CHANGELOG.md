# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-11-11

### Changed

- Package homepage is https://www.leadsets.ai/docs, without tracking parameters.

## [0.1.0] - 2026-11-11

### Added

- First release of `@leadsetsai/sdk`.
- `people.search`, `people.enrich`, `companies.search`, `companies.enrich`, `emails.verify`,
  `scrape.company`, `scrape.jobs`, `jobs.get` and `usage.get`.
- Pagination with `searchAll` (records) and `searchPages` (pages), with `maxItems` and `maxPages`.
- Typed errors mapped from `error.type` and status, each with `requestId`.
- Automatic retries with exponential backoff and jitter on 429 (honouring `Retry-After`), 5xx,
  timeouts and network errors.
- An auto-generated `Idempotency-Key` on every paid call, reused across retries.
- Parsed rate-limit headers on `lastResponse.rateLimit`.
- ESM and CommonJS builds with type declarations; no runtime dependencies.

[0.1.0]: https://github.com/leadsets/sdk/releases/tag/v0.1.0
