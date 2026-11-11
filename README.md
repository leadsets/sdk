# Leadsets TypeScript SDK

[![npm](https://img.shields.io/npm/v/@leadsets/sdk.svg)](https://www.npmjs.com/package/@leadsets/sdk)
[![CI](https://github.com/leadsets/sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/leadsets/sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The official TypeScript and JavaScript client for the [Leadsets](https://www.leadsets.ai/?utm_source=github&utm_medium=readme&utm_campaign=sdk-js&utm_content=intro) API.

Leadsets is B2B data for AI agents and the developers who build them. Search people and companies, enrich a person or a company, verify emails and scrape company websites and careers pages, over a REST API or an MCP server. Every record says why it matched, every field carries its source and freshness, and emails are only labelled verified when they are.

- Typed requests and responses
- Automatic retries with backoff on 429 (honouring `Retry-After`), 5xx and network errors
- An Idempotency-Key on every paid call, so a retry never counts records twice
- Cursor pagination with async iterators
- Zero runtime dependencies. Uses the native `fetch`, ships ESM and CommonJS, and runs on Node.js 18+, Bun, Deno and edge runtimes

## Contents

- [Install](#install)
- [Quickstart](#quickstart)
- [Authentication](#authentication)
- [Resources](#resources)
- [Pagination](#pagination)
- [Errors and retries](#errors-and-retries)
- [Limits and usage](#limits-and-usage)
- [Idempotency](#idempotency)
- [Configuration](#configuration)
- [TypeScript](#typescript)
- [MCP](#mcp)
- [Support](#support)
- [License](#license)

## Install

```bash
npm install @leadsets/sdk
# or
pnpm add @leadsets/sdk
yarn add @leadsets/sdk
bun add @leadsets/sdk
```

## Quickstart

[Create a free account](https://www.leadsets.ai/signup?utm_source=github&utm_medium=readme&utm_campaign=sdk-js&utm_content=quickstart) and copy your API key. Keys start with `ls_live_`.

```bash
export LEADSETS_API_KEY="ls_live_…"
```

Ten revenue leaders at US SaaS companies with 20–200 people:

```ts
import { Leadsets } from '@leadsets/sdk'

const ls = new Leadsets(process.env.LEADSETS_API_KEY)

const res = await ls.people.search({
  function: ['revenue'],
  seniority: ['vp', 'head'],
  employees: '20-200',
  country: 'US',
  industry: 'saas',
  limit: 10,
})

console.log(res.items[0].match_reasons, res.usage)
```

Every response carries what the call counted and what is left (`usage`), plus a `request_id`. The [quickstart guide](https://www.leadsets.ai/docs/quickstart?utm_source=github&utm_medium=readme&utm_campaign=sdk-js&utm_content=quickstart) walks through the same call with cURL.

## Authentication

The API uses bearer keys. Pass the key to the constructor, or leave it out and the SDK reads the `LEADSETS_API_KEY` environment variable (or `LEADSETS_KEY`).

```ts
const ls = new Leadsets('ls_live_…') // explicit
const ls = new Leadsets() // from LEADSETS_API_KEY / LEADSETS_KEY
const ls = new Leadsets({ apiKey: 'ls_live_…' }) // with other options
```

Keep the key server-side. Don't ship it to a browser. A free key is available at [leadsets.ai/signup](https://www.leadsets.ai/signup?utm_source=github&utm_medium=readme&utm_campaign=sdk-js&utm_content=authentication).

## Resources

| Method                        | Endpoint                    | Uses                                                     |
| ----------------------------- | --------------------------- | -------------------------------------------------------- |
| `ls.people.search(params)`    | `POST /v1/people/search`    | 1 search record per record returned                      |
| `ls.people.enrich(params)`    | `POST /v1/people/enrich`    | 1 enrichment record when found (+1 for a personal email) |
| `ls.companies.search(params)` | `POST /v1/companies/search` | 1 search record per record returned                      |
| `ls.companies.enrich(params)` | `POST /v1/companies/enrich` | 1 enrichment record when found                           |
| `ls.emails.verify(params)`    | `POST /v1/emails/verify`    | 1 enrichment record per email checked                    |
| `ls.scrape.company(params)`   | `POST /v1/scrape/company`   | 1 scrape unit per page read                              |
| `ls.scrape.jobs(params)`      | `POST /v1/scrape/jobs`      | 1 scrape unit per page read                              |
| `ls.jobs.get(id)`             | `GET /v1/jobs/{id}`         | nothing                                                  |
| `ls.usage.get()`              | `GET /v1/usage`             | nothing                                                  |

Every method takes an optional last argument with [request options](#per-request-options).

### People search

Filters: `title`, `seniority` (`c_level`, `vp`, `head`, `director`, `manager`, `ic`), `function` (`revenue`, `marketing`, `engineering`, `product`, `ops`, `finance`, `hr`), `company_domain`, `employees` (`"50-200"`, `"1000+"`, `"<50"`), `industry` (slugs such as `"saas"`), `country` (ISO 3166-1 alpha-2), `has_verified_email`, `max_age_days`, `exclude_stale`, `limit` (1–100, default 25) and `cursor`. A string or an array works wherever a list is accepted.

```ts
const res = await ls.people.search({
  title: ['VP Sales', 'Head of Sales'], // fuzzy: "VP Sales" also finds "Vice President, Sales"
  country: ['US', 'CA'],
  employees: '50-200',
  has_verified_email: true,
  limit: 25,
})

for (const p of res.items) {
  console.log(p.full_name, p.title, p.company?.domain, p.email?.address, p.email?.status)
  console.log(p.match_reasons) // ["title", "size", "country", "verified_email"]
  console.log(p.sources.title) // { source, seen_at, confidence }
}
```

Each person has `person_id`, names, `title`, `seniority` and `function` (with finer `seniority_detail` and `function_detail`), `linkedin_url`, `location`, `company`, `email` (with `status`, `confidence` and `checked_at`), `refreshed_at`, `stale` and `sources`.

### People enrich

Look a person up by LinkedIn URL, by work email, or by name plus company domain.

```ts
const { person, matched_by } = await ls.people.enrich({ linkedin_url: 'https://www.linkedin.com/in/example' })
await ls.people.enrich({ email: 'jane@example.com' })
await ls.people.enrich({ full_name: 'Jane Doe', company_domain: 'example.com' })
await ls.people.enrich({
  first_name: 'Jane',
  last_name: 'Doe',
  company_domain: 'example.com',
  include_personal_email: true,
})
```

No match is a `NotFoundError` and costs nothing.

### Companies search

```ts
const res = await ls.companies.search({
  industry: 'saas',
  employees: '50-200',
  country: 'US',
  technology: ['hubspot', 'salesforce'], // matches any
  limit: 50,
})
console.log(res.items.map((c) => [c.name, c.domain, c.employees]))
```

### Companies enrich

```ts
const { company } = await ls.companies.enrich({ domain: 'example.com' }) // a URL works too
await ls.companies.enrich({ linkedin_url: 'https://www.linkedin.com/company/example' })

console.log(company.industry, company.naics, company.employee_range, company.revenue_range, company.technologies)
```

### Email verification

One email or up to 100 per call. Each result has a `status` (`verified`, `catch_all`, `unknown`, `invalid`), a `confidence` and `checked_at`.

```ts
const one = await ls.emails.verify('jane@example.com')
const many = await ls.emails.verify(['jane@example.com', 'sam@example.org'])
// or: ls.emails.verify({ emails: [...] })

console.log(many.summary) // { verified, catch_all, unknown, invalid, not_checked }
for (const r of many.results) {
  if (r.status === null) console.log(r.email, r.reason) // not checked, not counted
}
```

### Scrape a company website

A website as structured JSON: name, description, headings, key links (pricing, customers, careers, docs and more), social profiles and page text. `max_pages` (1–10, default 1) adds the about, pricing, customers, product and careers pages. Scraping is available on paid plans with scrape units.

```ts
const site = await ls.scrape.company({ domain: 'example.com', max_pages: 3 })
console.log(site.name, site.key_links.pricing, site.social.linkedin)
console.log(
  site.pages.map((p) => p.url),
  site.usage.scrape_units_left,
)
```

### Scrape open roles

Open roles from a company's careers page or job board: title, link, team, location and posted date when shown. `max_pages` defaults to 3.

```ts
const res = await ls.scrape.jobs({ domain: 'example.com' })
console.log(res.count, res.careers_url)
for (const job of res.jobs) console.log(job.title, job.team, job.location, job.url)
```

### Async jobs

```ts
const job = await ls.jobs.get('job_123')
```

Async jobs are not generally available yet. Until they are, `jobs.get` throws `NotFoundError`. Split large runs across windows instead.

### Usage

What's left in every meter and when each window resets. Free to call, so call it before a big run.

```ts
const u = await ls.usage.get()
console.log(u.plan)
if (u.search && 'records_5h' in u.search) {
  const [used, limit] = u.search.records_5h
  console.log(`${limit - used} search records left; resets at ${u.search.resets_at}`)
}
console.log(u.concurrent_searches, u.scrape_units)
```

On the Free plan, `u.free` holds the one-time balances instead.

## Pagination

Searches return `next_cursor`. `searchAll` follows it for you and yields one record at a time:

```ts
for await (const person of ls.people.searchAll({ title: ['VP Sales'], country: 'US', limit: 100 })) {
  console.log(person.full_name)
}
```

Each record returned counts, so cap a run with `maxItems`. The last page asks only for what's left, so you never pay for more than you take. `maxPages` caps the number of calls.

```ts
for await (const company of ls.companies.searchAll({ industry: 'saas' }, { maxItems: 250 })) {
  /* … */
}
```

To read `usage` as you go, iterate pages instead:

```ts
for await (const page of ls.people.searchPages({ country: 'US', limit: 100 }, { maxPages: 5 })) {
  console.log(page.items.length, page.usage.search_records_left_5h)
}
```

Breaking out of a loop stops fetching. To page by hand, pass `cursor: res.next_cursor` to the next `search` call.

## Errors and retries

Every API error has a status, a machine-readable `type`, a message and a `request_id`. The SDK throws a typed error for each:

| Class                       | Status | `type`                                                          |
| --------------------------- | ------ | --------------------------------------------------------------- |
| `InvalidRequestError`       | 400    | `invalid_request` (`param` names the field)                     |
| `AuthenticationError`       | 401    | `unauthorized`                                                  |
| `FreeRecordsExhaustedError` | 402    | `free_records_exhausted`                                        |
| `ScrapeUnitsExhaustedError` | 402    | `scrape_units_exhausted`                                        |
| `PermissionDeniedError`     | 403    | `forbidden` (`upgradeUrl` when an upgrade would allow the call) |
| `NotFoundError`             | 404    | `not_found`                                                     |
| `IdempotencyConflictError`  | 409    | `idempotency_conflict`                                          |
| `RateLimitError`            | 429    | `window_full`, `weekly_limit`, `too_many_concurrent`            |
| `InternalServerError`       | 5xx    | `internal_error`                                                |
| `ServiceUnavailableError`   | 503    | `unavailable`                                                   |
| `APIConnectionError`        | none   | the request got no answer                                       |
| `APITimeoutError`           | none   | the request timed out                                           |

`FreeRecordsExhaustedError` and `ScrapeUnitsExhaustedError` extend `PaymentRequiredError`. Every HTTP error extends `APIError`, and everything extends `LeadsetsError`. `ConnectionError` and `TimeoutError` are exported as aliases of the last two.

```ts
import { APIError, NotFoundError, RateLimitError } from '@leadsets/sdk'

try {
  await ls.people.enrich({ email: 'jane@example.com' })
} catch (err) {
  if (err instanceof NotFoundError) {
    // nothing to enrich; nothing was counted
  } else if (err instanceof RateLimitError) {
    console.log(err.type, err.meter, err.resetsAt, err.retryAfter)
  } else if (err instanceof APIError) {
    console.log(err.status, err.type, err.message, err.requestId)
  } else {
    throw err
  }
}
```

**Retries.** The SDK retries 429, 5xx, timeouts and network errors up to `maxRetries` times (default 2). It waits for `Retry-After` when the API sends one, and otherwise backs off exponentially with jitter (about 0.5 s, 1 s, 2 s, up to 8 s). A `Retry-After` longer than `maxRetryDelay` (default 60 s), such as a weekly limit, is thrown at once so a run doesn't hang. 400, 401, 402, 403, 404 and 409 are never retried.

## Limits and usage

- **Records count only when data comes back.** Empty results, misses and errors use no records. Every call counts one request toward its window, hits and misses alike.
- **Paid plans have rolling five-hour windows** for records and for requests, plus a **weekly** records window, kept separately for search and for enrichment. Scraping uses scrape units.
- **Free** has 1,000 enrichment records and 100 search records, one time, with no card needed. Paid plans start at $29/month. See [pricing](https://www.leadsets.ai/pricing?utm_source=github&utm_medium=readme&utm_campaign=sdk-js&utm_content=limits).

Every response has a `usage` object with what the call counted and what's left, and the SDK parses the rate-limit headers into `res.lastResponse.rateLimit`:

```ts
const res = await ls.people.search({ country: 'US' })
res.usage // { search_records_counted, search_records_left_5h, search_requests_left_5h, search_records_left_week }
res.lastResponse.rateLimit // { recordsRemaining, requestsRemaining, weeklyRemaining, freeRemaining, retryAfter }
res.lastResponse.requestId // also res.request_id
res.lastResponse.headers // the raw Headers
```

`lastResponse` is non-enumerable, so it stays out of `JSON.stringify(res)`. Read more in the [docs](https://www.leadsets.ai/docs?utm_source=github&utm_medium=readme&utm_campaign=sdk-js&utm_content=limits).

## Idempotency

The SDK sends an `Idempotency-Key` with every paid call (all POSTs) and reuses it across its own retries, so a retry never counts records twice. Pass your own key to make a call safe to repeat across processes, for example one key per CRM row:

```ts
await ls.people.enrich({ email: row.email }, { idempotencyKey: `crm-${row.id}` })
```

A repeat with the same key and body returns the first result (`res.lastResponse.idempotentReplayed === true`) and counts nothing. The same key with a different body throws `IdempotencyConflictError`. Keys last 24 hours. With `searchAll`/`searchPages`, a key you pass is suffixed per page (`key`, `key-p2`, `key-p3` …).

## Configuration

```ts
const ls = new Leadsets({
  apiKey: 'ls_live_…', // default: LEADSETS_API_KEY or LEADSETS_KEY
  baseURL: 'https://api.leadsets.ai', // default; LEADSETS_BASE_URL also works
  maxRetries: 2, // retries on 429, 5xx, timeouts and network errors
  timeout: 120_000, // per attempt, in ms
  maxRetryDelay: 60_000, // longest Retry-After to wait for, in ms
  fetch: customFetch, // default: global fetch
  defaultHeaders: { 'X-My-App': 'crm-sync' },
})
```

### Per-request options

```ts
await ls.people.search(params, {
  idempotencyKey: 'run-42',
  maxRetries: 5,
  timeout: 30_000,
  signal: AbortSignal.timeout(10_000),
  headers: { 'X-Trace-Id': 'abc' },
})
```

## TypeScript

Every request and response is typed: `PeopleSearchParams`, `PeopleSearchResponse`, `Person`, `Company`, `Email`, `EmailVerification`, `ScrapeCompanyResponse`, `Job`, `UsageResponse`, `Usage` and more, all exported from `@leadsets/sdk`.

```ts
import type { Person, PeopleSearchParams } from '@leadsets/sdk'

const query: PeopleSearchParams = { seniority: ['vp'], function: ['marketing'] }
```

Fields the API may leave empty are typed `T | null`. The package ships ESM and CommonJS builds with declarations, has no runtime dependencies and needs a global `fetch` (Node.js 18+, Bun, Deno and edge runtimes). In the browser, keep your key on a server and proxy requests.

## MCP

Using an AI agent? Leadsets also runs a hosted MCP server at `https://mcp.leadsets.ai` with the same tools, so Claude, Cursor, ChatGPT and other MCP clients can call it with no code. See [Connect via MCP](https://www.leadsets.ai/docs/mcp?utm_source=github&utm_medium=readme&utm_campaign=sdk-js&utm_content=mcp).

## Support

- [Docs](https://www.leadsets.ai/docs?utm_source=github&utm_medium=readme&utm_campaign=sdk-js&utm_content=support) and the [quickstart](https://www.leadsets.ai/docs/quickstart?utm_source=github&utm_medium=readme&utm_campaign=sdk-js&utm_content=support)
- [Support](https://www.leadsets.ai/support?utm_source=github&utm_medium=readme&utm_campaign=sdk-js&utm_content=support): include the `request_id` from the response or error and we can see exactly what happened
- Bugs and feature requests: [GitHub issues](https://github.com/leadsets/sdk/issues)
- Security: see [SECURITY.md](SECURITY.md)

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
