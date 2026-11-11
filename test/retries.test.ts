import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backoff } from '../src/core.js'
import { APIConnectionError, APITimeoutError, InvalidRequestError, RateLimitError } from '../src/index.js'
import { client, errorReply, mockFetch, usage } from './helpers.js'

const ok = { body: { items: [], next_cursor: null, usage, request_id: 'req_ok' } }

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** Runs a promise to completion while advancing fake timers. Returns it and the time it took. */
async function run<T>(p: Promise<T>): Promise<{ value?: T; error?: unknown; elapsed: number }> {
  const start = Date.now()
  let done = false
  let value: T | undefined
  let error: unknown
  p.then(
    (v) => {
      value = v
      done = true
    },
    (e) => {
      error = e
      done = true
    },
  )
  while (!done) await vi.advanceTimersByTimeAsync(50)
  return { value, error, elapsed: Date.now() - start }
}

describe('retries', () => {
  it('retries a 429 after Retry-After seconds, with the same Idempotency-Key', async () => {
    const m = mockFetch(errorReply(429, 'too_many_concurrent', {}, { 'Retry-After': '2' }), ok)
    const r = await run(client(m).people.search({ limit: 5 }))
    expect(r.error).toBeUndefined()
    expect(m.calls).toHaveLength(2)
    expect(r.elapsed).toBeGreaterThanOrEqual(2000)
    expect(r.elapsed).toBeLessThan(2400)
    const keys = m.calls.map((c) => c.headers['idempotency-key'])
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(keys[1]).toBe(keys[0])
    expect((r.value as { lastResponse: { attempts: number } }).lastResponse.attempts).toBe(2)
  })

  it('retries 5xx with exponential backoff', async () => {
    const m = mockFetch(errorReply(500, 'internal_error'), errorReply(503, 'unavailable'), ok)
    const r = await run(client(m).people.search({}))
    expect(r.error).toBeUndefined()
    expect(m.calls).toHaveLength(3)
    // ~0.5 s then ~1 s, each with up to 25% jitter below.
    expect(r.elapsed).toBeGreaterThanOrEqual(1100)
    expect(r.elapsed).toBeLessThan(1700)
  })

  it('retries network errors', async () => {
    const m = mockFetch(new TypeError('fetch failed'), ok)
    const r = await run(client(m).companies.search({}))
    expect(r.error).toBeUndefined()
    expect(m.calls).toHaveLength(2)
  })

  it('throws APIConnectionError when the retries run out', async () => {
    const m = mockFetch(new TypeError('fetch failed'))
    const r = await run(client(m).people.enrich({ email: 'a@b.co' }))
    expect(r.error).toBeInstanceOf(APIConnectionError)
    expect((r.error as Error).cause).toBeInstanceOf(TypeError)
    expect(m.calls).toHaveLength(3)
  })

  it('throws the last API error when the retries run out', async () => {
    const m = mockFetch(errorReply(429, 'window_full', { meter: 'search_records_5h' }, { 'Retry-After': '1' }))
    const r = await run(client(m, { maxRetries: 1 }).people.search({}))
    expect(r.error).toBeInstanceOf(RateLimitError)
    expect(m.calls).toHaveLength(2)
  })

  it('does not wait for a Retry-After longer than maxRetryDelay (a weekly limit)', async () => {
    const m = mockFetch(errorReply(429, 'weekly_limit', {}, { 'Retry-After': '86400' }), ok)
    const r = await run(client(m).people.search({}))
    expect(r.error).toBeInstanceOf(RateLimitError)
    expect((r.error as RateLimitError).retryAfter).toBe(86400)
    expect(m.calls).toHaveLength(1)
  })

  it('maxRetryDelay is configurable', async () => {
    const m = mockFetch(errorReply(429, 'window_full', {}, { 'Retry-After': '90' }), ok)
    const r = await run(client(m, { maxRetryDelay: 120_000 }).people.search({}))
    expect(r.error).toBeUndefined()
    expect(r.elapsed).toBeGreaterThanOrEqual(90_000)
  })

  it('does not retry 4xx other than 429', async () => {
    const m = mockFetch(errorReply(400, 'invalid_request'), ok)
    const r = await run(client(m).people.search({}))
    expect(r.error).toBeInstanceOf(InvalidRequestError)
    expect(m.calls).toHaveLength(1)
  })

  it('maxRetries: 0 on the client or per request turns retries off', async () => {
    const m = mockFetch(errorReply(503, 'unavailable'), ok)
    expect((await run(client(m, { maxRetries: 0 }).usage.get())).error).toBeDefined()
    expect(m.calls).toHaveLength(1)
    const m2 = mockFetch(errorReply(503, 'unavailable'), ok)
    expect((await run(client(m2).usage.get({ maxRetries: 0 }))).error).toBeDefined()
    expect(m2.calls).toHaveLength(1)
  })

  it('times out each attempt and retries; APITimeoutError at the end', async () => {
    const hang = (_input: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    let calls = 0
    const fetch = (i: string, init: RequestInit) => {
      calls++
      return hang(i, init)
    }
    const r = await run(client({ fetch, calls: [] }, { timeout: 1000, maxRetries: 1 }).people.search({}))
    expect(r.error).toBeInstanceOf(APITimeoutError)
    expect(calls).toBe(2)
  })

  it('an aborted signal stops at once without retrying', async () => {
    const ctrl = new AbortController()
    const fetch = (_i: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    const p = client({ fetch, calls: [] }).people.search({}, { signal: ctrl.signal })
    ctrl.abort()
    const r = await run(p)
    expect(r.error).toBeInstanceOf(DOMException)
  })

  it('backoff grows and is capped', () => {
    expect(backoff(0)).toBeGreaterThanOrEqual(375)
    expect(backoff(0)).toBeLessThanOrEqual(500)
    expect(backoff(3)).toBeGreaterThanOrEqual(3000)
    expect(backoff(20)).toBeLessThanOrEqual(8000)
  })
})

describe('idempotency', () => {
  it('sends a fresh Idempotency-Key on every paid POST', async () => {
    vi.useRealTimers()
    const m = mockFetch(ok)
    const ls = client(m)
    await ls.people.search({})
    await ls.people.search({})
    await ls.people.enrich({ email: 'a@b.co' })
    await ls.companies.search({})
    await ls.companies.enrich({ domain: 'a.co' })
    await ls.emails.verify('a@b.co')
    await ls.scrape.company({ domain: 'a.co' })
    await ls.scrape.jobs({ domain: 'a.co' })
    const keys = m.calls.map((c) => c.headers['idempotency-key'])
    expect(keys.every((k) => typeof k === 'string' && k.length === 36)).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('uses the caller’s Idempotency-Key', async () => {
    vi.useRealTimers()
    const m = mockFetch(ok)
    const res = await client(m).people.search({}, { idempotencyKey: 'crm-row-42' })
    expect(m.calls[0]?.headers['idempotency-key']).toBe('crm-row-42')
    expect(res.lastResponse.idempotencyKey).toBe('crm-row-42')
  })

  it('GET requests get no key unless one is passed', async () => {
    vi.useRealTimers()
    const m = mockFetch({ body: { usage: {}, request_id: 'r' } })
    await client(m).usage.get()
    expect(m.calls[0]?.headers['idempotency-key']).toBeUndefined()
  })
})
