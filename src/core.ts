import { APIConnectionError, APIError, APITimeoutError, LeadsetsError, parseRetryAfter } from './errors.js'
import type { RateLimitInfo, ResponseMeta } from './types.js'
import { VERSION } from './version.js'

export const DEFAULT_BASE_URL = 'https://api.leadsets.ai'
export const DEFAULT_TIMEOUT_MS = 120_000
export const DEFAULT_MAX_RETRIES = 2
export const DEFAULT_MAX_RETRY_DELAY_MS = 60_000

type Fetch = (input: string, init: RequestInit) => Promise<Response>

export interface ClientOptions {
  /** Your API key (`ls_live_…`). Defaults to the LEADSETS_API_KEY or LEADSETS_KEY environment variable. */
  apiKey?: string | undefined
  /** Defaults to https://api.leadsets.ai (or the LEADSETS_BASE_URL environment variable). */
  baseURL?: string | undefined
  /** Retries on 429, 5xx, timeouts and network errors. Default 2. */
  maxRetries?: number | undefined
  /** Per-attempt timeout in milliseconds. Default 120000. */
  timeout?: number | undefined
  /**
   * The longest `Retry-After` the SDK will wait for before retrying, in milliseconds.
   * A 429 asking for a longer wait (a weekly limit, say) is thrown at once. Default 60000.
   */
  maxRetryDelay?: number | undefined
  /** A custom fetch implementation. Defaults to the global fetch. */
  fetch?: Fetch | undefined
  /** Headers sent with every request. */
  defaultHeaders?: Record<string, string> | undefined
}

export interface RequestOptions {
  /**
   * Idempotency-Key for this call. The SDK generates one for every paid call when you don't,
   * and reuses it on retries, so a retry never counts records twice. Keys last 24 hours.
   */
  idempotencyKey?: string | undefined
  maxRetries?: number | undefined
  timeout?: number | undefined
  signal?: AbortSignal | undefined
  headers?: Record<string, string> | undefined
}

interface ApiRequest {
  method: 'GET' | 'POST'
  path: string
  body?: unknown
  /** Paid POSTs: send an Idempotency-Key. */
  idempotent?: boolean
}

export class HttpClient {
  readonly apiKey: string
  readonly baseURL: string
  readonly maxRetries: number
  readonly timeout: number
  readonly maxRetryDelay: number
  private readonly fetchImpl: Fetch
  private readonly defaultHeaders: Record<string, string>

  constructor(opts: ClientOptions = {}) {
    const apiKey = opts.apiKey ?? env('LEADSETS_API_KEY') ?? env('LEADSETS_KEY')
    if (!apiKey) {
      throw new LeadsetsError(
        'No API key. Pass one to new Leadsets(apiKey) or set the LEADSETS_API_KEY environment variable. Get a free key at https://www.leadsets.ai/signup.',
      )
    }
    this.apiKey = apiKey
    this.baseURL = (opts.baseURL ?? env('LEADSETS_BASE_URL') ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.maxRetries = nonNegative(opts.maxRetries, DEFAULT_MAX_RETRIES)
    this.timeout = nonNegative(opts.timeout, DEFAULT_TIMEOUT_MS)
    this.maxRetryDelay = nonNegative(opts.maxRetryDelay, DEFAULT_MAX_RETRY_DELAY_MS)
    const f = opts.fetch ?? (globalThis.fetch as Fetch | undefined)
    if (!f) throw new LeadsetsError('No fetch implementation found. Use Node 18+ or pass `fetch` in the options.')
    this.fetchImpl = opts.fetch ?? ((input, init) => globalThis.fetch(input, init))
    this.defaultHeaders = opts.defaultHeaders ?? {}
  }

  async request<T extends object>(req: ApiRequest, opts: RequestOptions = {}): Promise<T> {
    const maxRetries = nonNegative(opts.maxRetries, this.maxRetries)
    const timeout = nonNegative(opts.timeout, this.timeout)
    const idempotencyKey = req.idempotent ? (opts.idempotencyKey ?? newIdempotencyKey()) : (opts.idempotencyKey ?? null)
    const url = `${this.baseURL}/v1${req.path}`
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': `leadsets-sdk-js/${VERSION}`,
      ...this.defaultHeaders,
      ...opts.headers,
      Authorization: `Bearer ${this.apiKey}`,
    }
    if (req.body !== undefined) headers['Content-Type'] = 'application/json'
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
    const body = req.body !== undefined ? JSON.stringify(req.body) : undefined

    for (let attempt = 0; ; attempt++) {
      let res: Response
      const timer = timeoutSignal(timeout, opts.signal)
      try {
        res = await this.fetchImpl(url, { method: req.method, headers, body, signal: timer.signal })
      } catch (err) {
        timer.clear()
        if (opts.signal?.aborted) throw err
        const e = timer.timedOut()
          ? new APITimeoutError(undefined, { cause: err })
          : new APIConnectionError(undefined, { cause: err })
        if (attempt < maxRetries) {
          await sleep(backoff(attempt), opts.signal)
          continue
        }
        throw e
      }

      let text: string
      try {
        text = await res.text()
      } catch (err) {
        timer.clear()
        if (opts.signal?.aborted) throw err
        const e = timer.timedOut()
          ? new APITimeoutError(undefined, { cause: err })
          : new APIConnectionError('The connection closed before the response was read.', { cause: err })
        if (attempt < maxRetries) {
          await sleep(backoff(attempt), opts.signal)
          continue
        }
        throw e
      }
      timer.clear()
      const parsed = parseJson(text)

      if (res.ok) {
        const data = (parsed && typeof parsed === 'object' ? parsed : {}) as T
        const meta = responseMeta(res, data, idempotencyKey, attempt + 1)
        Object.defineProperty(data, 'lastResponse', {
          value: meta,
          enumerable: false,
          writable: false,
          configurable: true,
        })
        return data
      }

      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as { error?: unknown; request_id?: unknown }
      const error = obj.error && typeof obj.error === 'object' ? (obj.error as Record<string, unknown>) : undefined
      const apiErr = APIError.from({
        status: res.status,
        error: error ?? (text && !parsed ? { message: text.slice(0, 500) } : undefined),
        requestId: typeof obj.request_id === 'string' ? obj.request_id : null,
        headers: res.headers,
        body: parsed ?? text,
      })
      const delay = this.retryDelay(apiErr, attempt)
      if (attempt < maxRetries && delay !== null) {
        await sleep(delay, opts.signal)
        continue
      }
      throw apiErr
    }
  }

  /** Milliseconds to wait before retrying, or null to not retry. */
  private retryDelay(err: APIError, attempt: number): number | null {
    const retryable = err.status === 408 || err.status === 429 || err.status >= 500
    if (!retryable) return null
    if (err.retryAfter !== null) {
      const ms = err.retryAfter * 1000
      if (ms > this.maxRetryDelay) return null
      // A little jitter so parallel workers don't all retry at the same instant.
      return ms + Math.random() * 250
    }
    return backoff(attempt)
  }
}

/** Exponential backoff with jitter: ~0.5 s, 1 s, 2 s … capped at 8 s. */
export function backoff(attempt: number): number {
  const base = Math.min(8_000, 500 * 2 ** attempt)
  return base * (0.75 + Math.random() * 0.25)
}

function responseMeta(res: Response, data: object, idempotencyKey: string | null, attempts: number): ResponseMeta {
  const h = res.headers
  const rid = (data as { request_id?: unknown }).request_id
  return {
    status: res.status,
    headers: h,
    requestId: typeof rid === 'string' ? rid : null,
    idempotencyKey,
    idempotentReplayed: h.get('idempotent-replayed') === 'true',
    rateLimit: rateLimitInfo(h),
    attempts,
  }
}

export function rateLimitInfo(h: Headers): RateLimitInfo {
  return {
    recordsRemaining: num(h.get('x-leadsets-records-remaining')),
    requestsRemaining: num(h.get('x-leadsets-requests-remaining')),
    weeklyRemaining: num(h.get('x-leadsets-weekly-remaining')),
    freeRemaining: num(h.get('x-leadsets-free-remaining')),
    retryAfter: parseRetryAfter(h.get('retry-after')),
  }
}

const num = (v: string | null): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseJson(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function nonNegative(v: number | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback
}

function env(name: string): string | undefined {
  try {
    const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const v = p?.env?.[name]
    return v?.trim() ? v.trim() : undefined
  } catch {
    return undefined
  }
}

/** A random UUID v4, from Web Crypto when available. */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** An AbortSignal that fires on timeout or when the caller's signal aborts. */
function timeoutSignal(ms: number, outer?: AbortSignal) {
  const ctrl = new AbortController()
  let timedOut = false
  const timer =
    ms > 0
      ? setTimeout(() => {
          timedOut = true
          ctrl.abort()
        }, ms)
      : undefined
  const onAbort = () => ctrl.abort(outer?.reason)
  if (outer) {
    if (outer.aborted) ctrl.abort(outer.reason)
    else outer.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: ctrl.signal,
    timedOut: () => timedOut,
    clear: () => {
      if (timer) clearTimeout(timer)
      outer?.removeEventListener('abort', onAbort)
    },
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
