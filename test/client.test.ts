import { afterEach, describe, expect, it, vi } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import { DEFAULT_BASE_URL, Leadsets, LeadsetsError, VERSION } from '../src/index.js'
import { client, KEY, mockFetch, person, usage } from './helpers.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('configuration', () => {
  it('VERSION matches package.json', () => {
    expect(VERSION).toBe(pkg.version)
  })

  it('takes the key as the first argument (the quickstart form)', async () => {
    const m = mockFetch({ body: { items: [], next_cursor: null, usage, request_id: 'req_1' } })
    const ls = new Leadsets(KEY, { fetch: m.fetch })
    await ls.people.search({})
    expect(m.calls[0]?.headers.authorization).toBe(`Bearer ${KEY}`)
  })

  it('reads LEADSETS_API_KEY from the environment', async () => {
    vi.stubEnv('LEADSETS_API_KEY', 'ls_live_fromenv000000000000')
    vi.stubEnv('LEADSETS_KEY', 'ls_live_other00000000000000')
    const m = mockFetch({ body: { request_id: 'req_1', usage: {} } })
    await new Leadsets({ fetch: m.fetch }).usage.get()
    expect(m.calls[0]?.headers.authorization).toBe('Bearer ls_live_fromenv000000000000')
  })

  it('falls back to LEADSETS_KEY', async () => {
    vi.stubEnv('LEADSETS_API_KEY', '')
    vi.stubEnv('LEADSETS_KEY', 'ls_live_other00000000000000')
    const m = mockFetch({ body: { request_id: 'req_1', usage: {} } })
    await new Leadsets(undefined, { fetch: m.fetch }).usage.get()
    expect(m.calls[0]?.headers.authorization).toBe('Bearer ls_live_other00000000000000')
  })

  it('an explicit key wins over the environment', async () => {
    vi.stubEnv('LEADSETS_API_KEY', 'ls_live_fromenv000000000000')
    const m = mockFetch({ body: { request_id: 'req_1', usage: {} } })
    await new Leadsets(KEY, { fetch: m.fetch }).usage.get()
    expect(m.calls[0]?.headers.authorization).toBe(`Bearer ${KEY}`)
  })

  it('throws without a key', () => {
    vi.stubEnv('LEADSETS_API_KEY', '')
    vi.stubEnv('LEADSETS_KEY', '')
    expect(() => new Leadsets()).toThrow(LeadsetsError)
    expect(() => new Leadsets()).toThrow(/LEADSETS_API_KEY/)
  })

  it('uses api.leadsets.ai by default; baseURL and LEADSETS_BASE_URL override it', async () => {
    expect(DEFAULT_BASE_URL).toBe('https://api.leadsets.ai')
    const m = mockFetch({ body: { request_id: 'req_1', usage: {} } })
    await client(m).usage.get()
    expect(m.calls[0]?.url).toBe('https://api.leadsets.ai/v1/usage')

    await client(m, { baseURL: 'http://localhost:8080/' }).usage.get()
    expect(m.calls[1]?.url).toBe('http://localhost:8080/v1/usage')

    vi.stubEnv('LEADSETS_BASE_URL', 'https://staging.example.com')
    const ls = client(m)
    expect(ls.baseURL).toBe('https://staging.example.com')
  })

  it('sends a User-Agent with the SDK name and version, JSON headers and default headers', async () => {
    const m = mockFetch({ body: { items: [], next_cursor: null, usage, request_id: 'req_1' } })
    await client(m, { defaultHeaders: { 'X-Trace': 'abc' } }).people.search({ limit: 1 })
    const h = m.calls[0]?.headers ?? {}
    expect(h['user-agent']).toBe(`leadsets-sdk-js/${VERSION}`)
    expect(h['content-type']).toBe('application/json')
    expect(h.accept).toBe('application/json')
    expect(h['x-trace']).toBe('abc')
  })
})

describe('endpoints', () => {
  it('people.search: POST /v1/people/search with the body as given', async () => {
    const m = mockFetch({
      body: { items: [person()], next_cursor: 'c_abc', usage, request_id: 'req_3f9a1c0b2d4e' },
      headers: {
        'X-Leadsets-Records-Remaining': '499',
        'X-Leadsets-Requests-Remaining': '2499',
        'X-Leadsets-Weekly-Remaining': '2499',
      },
    })
    const ls = client(m)
    const res = await ls.people.search({
      function: ['revenue'],
      seniority: ['vp', 'head'],
      employees: '20-200',
      country: 'US',
      industry: 'saas',
      limit: 10,
    })
    expect(m.calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.leadsets.ai/v1/people/search',
      body: {
        function: ['revenue'],
        seniority: ['vp', 'head'],
        employees: '20-200',
        country: 'US',
        industry: 'saas',
        limit: 10,
      },
    })
    expect(res.items[0]?.match_reasons).toContain('function')
    expect(res.items[0]?.email?.status).toBe('verified')
    expect(res.items[0]?.sources.title?.confidence).toBe(0.9)
    expect(res.usage.search_records_counted).toBe(1)
    expect(res.next_cursor).toBe('c_abc')
    expect(res.request_id).toBe('req_3f9a1c0b2d4e')
    expect(res.lastResponse.rateLimit).toEqual({
      recordsRemaining: 499,
      requestsRemaining: 2499,
      weeklyRemaining: 2499,
      freeRemaining: null,
      retryAfter: null,
    })
    expect(res.lastResponse.status).toBe(200)
    expect(res.lastResponse.requestId).toBe('req_3f9a1c0b2d4e')
    expect(res.lastResponse.attempts).toBe(1)
    // lastResponse is not part of the JSON.
    expect(Object.keys(res)).not.toContain('lastResponse')
    expect(JSON.parse(JSON.stringify(res))).not.toHaveProperty('lastResponse')
  })

  it('companies.search', async () => {
    const m = mockFetch({
      body: { items: [], next_cursor: null, usage: { search_records_counted: 0 }, request_id: 'r' },
    })
    await client(m).companies.search({ industry: 'saas', technology: ['hubspot'], employees: '50-200' })
    expect(m.calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.leadsets.ai/v1/companies/search',
      body: { industry: 'saas', technology: ['hubspot'], employees: '50-200' },
    })
  })

  it('people.enrich', async () => {
    const m = mockFetch({
      body: { person: person(), matched_by: 'linkedin_url', usage: { enrich_records_counted: 1 }, request_id: 'r' },
      headers: { 'X-Leadsets-Free-Remaining': '999' },
    })
    const res = await client(m).people.enrich({ linkedin_url: 'https://www.linkedin.com/in/mayachen' })
    expect(m.calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.leadsets.ai/v1/people/enrich',
      body: { linkedin_url: 'https://www.linkedin.com/in/mayachen' },
    })
    expect(res.person.full_name).toBe('Maya Chen')
    expect(res.matched_by).toBe('linkedin_url')
    expect(res.lastResponse.rateLimit.freeRemaining).toBe(999)
  })

  it('companies.enrich', async () => {
    const m = mockFetch({ body: { company: { company_id: 'c1', name: 'Northwind' }, usage: {}, request_id: 'r' } })
    const res = await client(m).companies.enrich({ domain: 'northwind.io' })
    expect(m.calls[0]).toMatchObject({
      url: 'https://api.leadsets.ai/v1/companies/enrich',
      body: { domain: 'northwind.io' },
    })
    expect(res.company.name).toBe('Northwind')
  })

  it('emails.verify takes an object, a string or an array', async () => {
    const reply = {
      body: {
        results: [
          { email: 'a@b.co', status: 'verified', confidence: 0.95, checked_at: 'x', source: 's', mx_provider: null },
        ],
        summary: { verified: 1, catch_all: 0, unknown: 0, invalid: 0, not_checked: 0 },
        usage: { enrich_records_counted: 1 },
        request_id: 'r',
      },
    }
    const m = mockFetch(reply)
    const ls = client(m)
    const res = await ls.emails.verify({ emails: ['a@b.co', 'c@d.co'] })
    await ls.emails.verify('a@b.co')
    await ls.emails.verify(['a@b.co'])
    expect(m.calls.map((c) => c.body)).toEqual([
      { emails: ['a@b.co', 'c@d.co'] },
      { email: 'a@b.co' },
      { emails: ['a@b.co'] },
    ])
    expect(m.calls[0]?.url).toBe('https://api.leadsets.ai/v1/emails/verify')
    expect(res.summary.verified).toBe(1)
    expect(res.results[0]?.status).toBe('verified')
  })

  it('scrape.company and scrape.jobs', async () => {
    const m = mockFetch(
      {
        body: {
          domain: 'northwind.io',
          url: 'https://northwind.io/',
          name: 'Northwind',
          description: null,
          headings: [],
          key_links: { pricing: 'https://northwind.io/pricing' },
          social: {},
          pages: [],
          units_used: 1,
          scraped_at: 'x',
          usage: { scrape_units_counted: 1, scrape_units_left: 99 },
          request_id: 'r',
        },
      },
      {
        body: {
          domain: 'northwind.io',
          careers_url: 'https://northwind.io/careers',
          jobs: [
            { title: 'AE', url: 'u', location: 'Remote', team: 'Sales', posted: null, source: 'site', found_on: 'u' },
          ],
          count: 1,
          units_used: 2,
          scraped_at: 'x',
          usage: { scrape_units_counted: 2, scrape_units_left: 97 },
          request_id: 'r',
        },
      },
    )
    const ls = client(m)
    const c = await ls.scrape.company({ domain: 'northwind.io', max_pages: 3 })
    const j = await ls.scrape.jobs({ domain: 'northwind.io' })
    expect(m.calls[0]).toMatchObject({
      url: 'https://api.leadsets.ai/v1/scrape/company',
      body: { domain: 'northwind.io', max_pages: 3 },
    })
    expect(m.calls[1]).toMatchObject({
      url: 'https://api.leadsets.ai/v1/scrape/jobs',
      body: { domain: 'northwind.io' },
    })
    expect(c.key_links.pricing).toBe('https://northwind.io/pricing')
    expect(c.usage.scrape_units_left).toBe(99)
    expect(j.jobs[0]?.title).toBe('AE')
  })

  it('jobs.get: GET /v1/jobs/{id}, id escaped, no body or Idempotency-Key', async () => {
    const m = mockFetch({ body: { id: 'job 1', status: 'done', usage: {}, request_id: 'r' } })
    const res = await client(m).jobs.get('job 1')
    expect(m.calls[0]).toMatchObject({ method: 'GET', url: 'https://api.leadsets.ai/v1/jobs/job%201', body: undefined })
    expect(m.calls[0]?.headers['idempotency-key']).toBeUndefined()
    expect(res.status).toBe('done')
    expect(() => client(m).jobs.get('')).toThrow(TypeError)
  })

  it('usage.get: GET /v1/usage, no body or Idempotency-Key', async () => {
    const m = mockFetch({
      body: {
        plan: 'pro',
        enrich: {
          records_5h: [9150, 15000],
          requests_5h: [30400, 75000],
          records_week: [45800, 75000],
          resets_at: '2026-11-11T14:15:00Z',
          week_resets_at: null,
        },
        search: { unavailable: true },
        concurrent_searches: [2, 5],
        scrape_units: 320,
        scraping: true,
        usage: {},
        request_id: 'req_u',
      },
    })
    const res = await client(m).usage.get()
    expect(m.calls[0]).toMatchObject({ method: 'GET', url: 'https://api.leadsets.ai/v1/usage', body: undefined })
    expect(m.calls[0]?.headers['idempotency-key']).toBeUndefined()
    expect(m.calls[0]?.headers['content-type']).toBeUndefined()
    expect(res.plan).toBe('pro')
    expect(res.concurrent_searches).toEqual([2, 5])
    if (res.enrich && 'records_5h' in res.enrich) expect(res.enrich.records_5h[1]).toBe(15000)
  })

  it('reports a replayed idempotent result', async () => {
    const m = mockFetch({
      body: { items: [], next_cursor: null, usage, request_id: 'req_1' },
      headers: { 'Idempotent-Replayed': 'true' },
    })
    const res = await client(m).people.search({}, { idempotencyKey: 'row-1' })
    expect(res.lastResponse.idempotentReplayed).toBe(true)
    expect(res.lastResponse.idempotencyKey).toBe('row-1')
  })
})
