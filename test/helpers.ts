import type { ClientOptions } from '../src/core.js'
import { Leadsets } from '../src/index.js'

export interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

export type Reply =
  | { status?: number; body?: unknown; headers?: Record<string, string>; text?: string }
  | ((call: Call) => { status?: number; body?: unknown; headers?: Record<string, string> })
  | Error

/** A fetch that answers from a queue of replies and records every call. */
export function mockFetch(...replies: Reply[]) {
  const calls: Call[] = []
  const queue = [...replies]
  const fetch = async (input: string, init: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((v, k) => {
      headers[k] = v
    })
    const call: Call = {
      url: input,
      method: init.method ?? 'GET',
      headers,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)
    const next = queue.length > 1 ? queue.shift() : queue[0]
    if (!next) throw new Error('mockFetch: no reply queued')
    if (next instanceof Error) throw next
    const r = typeof next === 'function' ? next(call) : next
    const text = 'text' in r && typeof r.text === 'string' ? r.text : JSON.stringify(r.body ?? {})
    return new Response(text, {
      status: r.status ?? 200,
      headers: { 'content-type': 'application/json', ...r.headers },
    })
  }
  return { fetch, calls }
}

export const KEY = 'ls_live_test0000000000000000'

export function client(m: ReturnType<typeof mockFetch>, opts: ClientOptions = {}) {
  return new Leadsets({ apiKey: KEY, fetch: m.fetch, ...opts })
}

export const usage = { search_records_counted: 1, search_records_left_5h: 499, search_requests_left_5h: 2499 }

export function person(id = '6f1c0000-0000-4000-8000-000000000001') {
  return {
    person_id: id,
    full_name: 'Maya Chen',
    first_name: 'Maya',
    last_name: 'Chen',
    title: 'VP Sales',
    seniority: 'vp',
    seniority_detail: 'vp',
    function: 'revenue',
    function_detail: 'sales',
    linkedin_url: 'https://www.linkedin.com/in/mayachen',
    location: { country: 'US', region: 'CA', city: 'San Francisco' },
    company: {
      company_id: 'c1',
      name: 'Northwind Analytics',
      domain: 'northwind.io',
      industry: 'SaaS',
      employees: 120,
      employee_range: '51-200',
    },
    email: {
      address: 'maya@northwind.io',
      status: 'verified',
      type: 'business',
      confidence: 0.95,
      checked_at: '2026-11-02T00:00:00Z',
      verified_by: 'leadsets',
      mx_provider: 'google',
    },
    match_reasons: ['function', 'seniority', 'size', 'industry', 'country'],
    refreshed_at: '2026-11-01T00:00:00Z',
    confirmed_at: '2026-11-01T00:00:00Z',
    stale_after_at: '2027-01-05T00:00:00Z',
    stale: false,
    sources: { title: { source: 'licensed', seen_at: '2026-11-01T00:00:00Z', confidence: 0.9 } },
  }
}

export function errorReply(
  status: number,
  type: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return {
    status,
    headers,
    body: { error: { type, message: `${type} happened`, ...extra, charged: 0 }, request_id: 'req_err000000001' },
  }
}
