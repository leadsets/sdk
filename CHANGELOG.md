# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-11-26

### Changed

- `scrape.jobs` counts 1 scrape unit per role returned, not per page read (the API's new rule). New `limit`
  (1–500, default 25) caps the roles returned and stops further reads; `max_pages` is no longer charged.
- `ScrapeJobsResponse`: new `limited` and `pages_read`; `units_used` is the roles returned.

## [0.4.0] - 2026-11-26

### Changed

- `scrape.jobs` takes the company website only: `{ domain }` is required and `url` is gone (the API no longer
  accepts it). Roles now also come from LinkedIn's public job listings; `Job.source` can be `"linkedin"`.
- `ScrapeJobsResponse`: new `company` and `sources`; `careers_url` can be null when only LinkedIn had roles.

## [0.3.0] - 2026-11-25

### Added

- `people.search`: `include_company` (default true) and `include_emails` (default false, on with `has_verified_email`).

### Changed

- The API counts each person as one search record and their company as another, and each work email
  as one enrichment record. Pass `include_company: false` for people only.
- Search results no longer carry work emails unless you ask for them with `include_emails: true`. `Person.company` and
  `Person.email` are optional in the types: they are absent when left out.

## [0.2.1] - 2026-11-22

### Changed

- Published from GitHub Actions with npm trusted publishing (OIDC) and provenance, without a
  long-lived npm token. No changes to the package itself.
- Releases are automatic: merging `develop` into `main` creates the GitHub release, and each
  GitHub release is published to npm with the same version.

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
