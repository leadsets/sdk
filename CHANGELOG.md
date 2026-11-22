# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.2.1] - 2026-11-22

### Changed

- Published from GitHub Actions with npm trusted publishing (OIDC) and provenance, without a
  long-lived npm token. No changes to the package itself.

## [0.2.0] - 2026-11-19

### Added

- `companies.search`: `keywords` and `exclude_keywords`, matched as whole words in the company's
  name, description and specialties. Companies carry `specialties` and `email_domain`.
- `people.search`: `company_keywords` and `exclude_company_keywords` (what the person's company does),
  `match_headline` (title words also match the LinkedIn headline) and `priorities` with
  `company_linkedin_url`: the best contacts at one company, in your order of preference, each
  tagged with `priority`. People carry `headline`; the response carries `company` with `priorities`.
- `people.count` and `companies.count`: how many records match (`count`, `count_capped`), using no
  records.
- `Usage.limits` and `Usage.resets_at`: the limits behind the remaining counts, and when each window
  resets.

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

[0.2.1]: https://github.com/leadsets/sdk/releases/tag/v0.2.1
[0.2.0]: https://github.com/leadsets/sdk/releases/tag/v0.2.0
[0.1.1]: https://github.com/leadsets/sdk/releases/tag/v0.1.1
[0.1.0]: https://github.com/leadsets/sdk/releases/tag/v0.1.0
