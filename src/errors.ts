/**
 * Error hierarchy.
 *
 *   LeadsetsError
 *   ├── APIError                       the API answered with an error status
 *   │   ├── InvalidRequestError        400 invalid_request
 *   │   ├── AuthenticationError        401 unauthorized
 *   │   ├── PaymentRequiredError       402
 *   │   │   ├── FreeRecordsExhaustedError   free_records_exhausted
 *   │   │   └── ScrapeUnitsExhaustedError   scrape_units_exhausted
 *   │   ├── PermissionDeniedError      403 forbidden (upgradeUrl)
 *   │   ├── NotFoundError              404 not_found
 *   │   ├── IdempotencyConflictError   409 idempotency_conflict
 *   │   ├── RateLimitError             429 window_full, weekly_limit, too_many_concurrent
 *   │   └── InternalServerError        5xx internal_error
 *   │       └── ServiceUnavailableError     503 unavailable
 *   └── APIConnectionError             the request never got an answer
 *       └── APITimeoutError            ...because it timed out
 */

export interface ErrorBody {
  type?: string
  message?: string
  param?: string
  meter?: string
  resets_at?: string
  upgrade_url?: string
  charged?: number
  [key: string]: unknown
}

export class LeadsetsError extends Error {
  /** The request_id of the failed call, when the API returned one. */
  readonly requestId: string | null

  constructor(message: string, requestId: string | null = null, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
    this.requestId = requestId
  }
}

export interface APIErrorInit {
  status: number
  error: ErrorBody | undefined
  requestId: string | null
  headers: Headers
  body: unknown
}

export class APIError extends LeadsetsError {
  /** HTTP status. */
  readonly status: number
  /** Machine-readable `error.type`, e.g. "window_full". */
  readonly type: string | null
  /** The field a 400 refers to. */
  readonly param: string | null
  /** The meter that ran out, e.g. "search_records_5h". */
  readonly meter: string | null
  /** When the meter's window frees up (ISO 8601). */
  readonly resetsAt: string | null
  /** Seconds to wait, from the `Retry-After` header. */
  readonly retryAfter: number | null
  /** Always 0: errors never count records. */
  readonly charged: number | null
  /** The `error` object of the response. */
  readonly error: ErrorBody | undefined
  readonly headers: Headers
  /** The full parsed response body. */
  readonly body: unknown

  constructor(init: APIErrorInit) {
    const msg = init.error?.message ?? `Request failed with status ${init.status}`
    super(msg, init.requestId)
    this.status = init.status
    this.error = init.error
    this.type = str(init.error?.type)
    this.param = str(init.error?.param)
    this.meter = str(init.error?.meter)
    this.resetsAt = str(init.error?.resets_at)
    this.charged = typeof init.error?.charged === 'number' ? init.error.charged : null
    this.retryAfter = parseRetryAfter(init.headers.get('retry-after'))
    this.headers = init.headers
    this.body = init.body
  }

  /** Builds the most specific error class for a response. */
  static from(init: APIErrorInit): APIError {
    const Cls = (init.error?.type && BY_TYPE[init.error.type]) || byStatus(init.status)
    return new Cls(init)
  }
}

export class InvalidRequestError extends APIError {}
export class AuthenticationError extends APIError {}
export class PaymentRequiredError extends APIError {}
export class FreeRecordsExhaustedError extends PaymentRequiredError {}
export class ScrapeUnitsExhaustedError extends PaymentRequiredError {}

export class PermissionDeniedError extends APIError {
  /** Where to upgrade, when a plan change would allow the call. */
  readonly upgradeUrl: string | null
  constructor(init: APIErrorInit) {
    super(init)
    this.upgradeUrl = str(init.error?.upgrade_url)
  }
}

export class NotFoundError extends APIError {}
export class IdempotencyConflictError extends APIError {}
export class RateLimitError extends APIError {}
export class InternalServerError extends APIError {}
export class ServiceUnavailableError extends InternalServerError {}

export class APIConnectionError extends LeadsetsError {
  constructor(message = 'Could not reach the Leadsets API.', options?: { cause?: unknown }) {
    super(message, null, options)
  }
}

export class APITimeoutError extends APIConnectionError {
  constructor(message = 'The request to the Leadsets API timed out.', options?: { cause?: unknown }) {
    super(message, options)
  }
}

/** Aliases. */
export { APIConnectionError as ConnectionError, APITimeoutError as TimeoutError }

type ErrorClass = new (init: APIErrorInit) => APIError

const BY_TYPE: Record<string, ErrorClass> = {
  invalid_request: InvalidRequestError,
  unauthorized: AuthenticationError,
  free_records_exhausted: FreeRecordsExhaustedError,
  scrape_units_exhausted: ScrapeUnitsExhaustedError,
  forbidden: PermissionDeniedError,
  not_found: NotFoundError,
  idempotency_conflict: IdempotencyConflictError,
  window_full: RateLimitError,
  weekly_limit: RateLimitError,
  too_many_concurrent: RateLimitError,
  internal_error: InternalServerError,
  unavailable: ServiceUnavailableError,
}

function byStatus(status: number): ErrorClass {
  if (status === 400 || status === 413 || status === 422) return InvalidRequestError
  if (status === 401) return AuthenticationError
  if (status === 402) return PaymentRequiredError
  if (status === 403) return PermissionDeniedError
  if (status === 404) return NotFoundError
  if (status === 409) return IdempotencyConflictError
  if (status === 429) return RateLimitError
  if (status === 503) return ServiceUnavailableError
  if (status >= 500) return InternalServerError
  return APIError
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** `Retry-After` as seconds: a number of seconds or an HTTP date. */
export function parseRetryAfter(v: string | null, now: number = Date.now()): number | null {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  if (Number.isFinite(n)) return Math.max(0, n)
  const t = Date.parse(v)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.ceil((t - now) / 1000))
}
