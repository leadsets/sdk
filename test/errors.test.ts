import { describe, expect, it } from 'vitest'
import { parseRetryAfter } from '../src/errors.js'
import {
  APIConnectionError,
  APIError,
  APITimeoutError,
  AuthenticationError,
  ConnectionError,
  FreeRecordsExhaustedError,
  IdempotencyConflictError,
  InternalServerError,
  InvalidRequestError,
  LeadsetsError,
  NotFoundError,
  PaymentRequiredError,
  PermissionDeniedError,
  RateLimitError,
  ScrapeUnitsExhaustedError,
  ServiceUnavailableError,
  TimeoutError,
} from '../src/index.js'
import { client, errorReply, mockFetch } from './helpers.js'

async function failWith(reply: Parameters<typeof mockFetch>[0]) {
  const m = mockFetch(reply)
  try {
    await client(m, { maxRetries: 0 }).people.search({})
  } catch (e) {
    return e as APIError
  }
  throw new Error('expected an error')
}

describe('error mapping', () => {
  const cases: [number, string, new (...a: never[]) => APIError][] = [
    [400, 'invalid_request', InvalidRequestError],
    [401, 'unauthorized', AuthenticationError],
    [402, 'free_records_exhausted', FreeRecordsExhaustedError],
    [402, 'scrape_units_exhausted', ScrapeUnitsExhaustedError],
    [403, 'forbidden', PermissionDeniedError],
    [404, 'not_found', NotFoundError],
    [409, 'idempotency_conflict', IdempotencyConflictError],
    [429, 'window_full', RateLimitError],
    [429, 'weekly_limit', RateLimitError],
    [429, 'too_many_concurrent', RateLimitError],
    [500, 'internal_error', InternalServerError],
    [503, 'unavailable', ServiceUnavailableError],
  ]
  for (const [status, type, Cls] of cases) {
    it(`${status} ${type} → ${Cls.name}`, async () => {
      const e = await failWith(errorReply(status, type))
      expect(e).toBeInstanceOf(Cls)
      expect(e).toBeInstanceOf(APIError)
      expect(e).toBeInstanceOf(LeadsetsError)
      expect(e.name).toBe(Cls.name)
      expect(e.status).toBe(status)
      expect(e.type).toBe(type)
      expect(e.message).toBe(`${type} happened`)
      expect(e.requestId).toBe('req_err000000001')
      expect(e.charged).toBe(0)
    })
  }

  it('402s share PaymentRequiredError; 503 is an InternalServerError', async () => {
    expect(await failWith(errorReply(402, 'scrape_units_exhausted'))).toBeInstanceOf(PaymentRequiredError)
    expect(await failWith(errorReply(402, 'free_records_exhausted'))).toBeInstanceOf(PaymentRequiredError)
    expect(await failWith(errorReply(503, 'unavailable'))).toBeInstanceOf(InternalServerError)
  })

  it('falls back to the status when the type is unknown', async () => {
    expect(await failWith(errorReply(404, 'something_new'))).toBeInstanceOf(NotFoundError)
    expect(await failWith(errorReply(418, 'teapot'))).toBeInstanceOf(APIError)
    expect(await failWith(errorReply(502, 'bad_gateway'))).toBeInstanceOf(InternalServerError)
  })

  it('invalid_request carries param', async () => {
    const e = await failWith(errorReply(400, 'invalid_request', { param: 'employees' }))
    expect(e.param).toBe('employees')
  })

  it('PermissionDeniedError carries upgrade_url', async () => {
    const e = (await failWith(
      errorReply(403, 'forbidden', { upgrade_url: 'https://www.leadsets.ai/pricing' }),
    )) as PermissionDeniedError
    expect(e.upgradeUrl).toBe('https://www.leadsets.ai/pricing')
  })

  it('RateLimitError carries retryAfter, meter and resetsAt', async () => {
    const e = await failWith(
      errorReply(
        429,
        'window_full',
        { meter: 'search_records_5h', resets_at: '2026-11-11T17:00:00Z' },
        { 'Retry-After': '1200' },
      ),
    )
    expect(e).toBeInstanceOf(RateLimitError)
    expect(e.retryAfter).toBe(1200)
    expect(e.meter).toBe('search_records_5h')
    expect(e.resetsAt).toBe('2026-11-11T17:00:00Z')
  })

  it('ScrapeUnitsExhaustedError carries the meter', async () => {
    const e = await failWith(errorReply(402, 'scrape_units_exhausted', { meter: 'scrape_units' }))
    expect(e.meter).toBe('scrape_units')
  })

  it('a non-JSON error body still becomes an APIError', async () => {
    const e = await failWith({ status: 502, text: '<html>Bad gateway</html>' })
    expect(e).toBeInstanceOf(InternalServerError)
    expect(e.requestId).toBeNull()
    expect(e.message).toContain('Bad gateway')
    const empty = await failWith({ status: 500, text: '' })
    expect(empty.message).toBe('Request failed with status 500')
  })

  it('connection and timeout errors', () => {
    expect(new APITimeoutError()).toBeInstanceOf(APIConnectionError)
    expect(new APIConnectionError()).toBeInstanceOf(LeadsetsError)
    expect(new APIConnectionError()).not.toBeInstanceOf(APIError)
    expect(new APIConnectionError().requestId).toBeNull()
    expect(ConnectionError).toBe(APIConnectionError)
    expect(TimeoutError).toBe(APITimeoutError)
  })

  it('parses Retry-After as seconds or an HTTP date', () => {
    expect(parseRetryAfter('30')).toBe(30)
    expect(parseRetryAfter(null)).toBeNull()
    expect(parseRetryAfter('soon')).toBeNull()
    const now = Date.parse('2026-11-11T10:00:00Z')
    expect(parseRetryAfter('Wed, 11 Nov 2026 10:00:10 GMT', now)).toBe(10)
  })
})
