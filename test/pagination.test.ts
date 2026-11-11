import { describe, expect, it } from 'vitest'
import type { Person } from '../src/index.js'
import { client, mockFetch, person, usage } from './helpers.js'

function pages(n: number, perPage: number) {
  return (call: { body: unknown }) => {
    const body = call.body as { cursor?: string; limit?: number }
    const page = body.cursor ? Number(body.cursor.slice(2)) : 1
    const count = Math.min(perPage, body.limit ?? 25)
    return {
      body: {
        items: Array.from({ length: count }, (_, i) => person(`p${page}-${i}`)),
        next_cursor: page < n ? `c_${page + 1}` : null,
        usage: { ...usage, search_records_counted: count },
        request_id: `req_${page}`,
      },
    }
  }
}

describe('pagination', () => {
  it('people.searchAll yields every person across pages, following next_cursor', async () => {
    const m = mockFetch(pages(3, 2))
    const out: Person[] = []
    for await (const p of client(m).people.searchAll({ country: 'US', limit: 2 })) out.push(p)
    expect(out.map((p) => p.person_id)).toEqual(['p1-0', 'p1-1', 'p2-0', 'p2-1', 'p3-0', 'p3-1'])
    expect(m.calls.map((c) => (c.body as { cursor?: string }).cursor)).toEqual([undefined, 'c_2', 'c_3'])
    expect(m.calls.every((c) => (c.body as { country: string }).country === 'US')).toBe(true)
  })

  it('maxItems stops early and asks only for what is left', async () => {
    const m = mockFetch(pages(10, 25))
    const out: Person[] = []
    for await (const p of client(m).people.searchAll({ limit: 25 }, { maxItems: 30 })) out.push(p)
    expect(out).toHaveLength(30)
    expect(m.calls.map((c) => (c.body as { limit: number }).limit)).toEqual([25, 5])
  })

  it('maxPages stops after that many pages', async () => {
    const m = mockFetch(pages(10, 2))
    const out: Person[] = []
    for await (const p of client(m).people.searchAll({ limit: 2 }, { maxPages: 2 })) out.push(p)
    expect(out).toHaveLength(4)
    expect(m.calls).toHaveLength(2)
  })

  it('breaking out of the loop stops fetching', async () => {
    const m = mockFetch(pages(10, 2))
    for await (const _ of client(m).people.searchAll({ limit: 2 })) break
    expect(m.calls).toHaveLength(1)
  })

  it('searchPages yields pages with usage; a caller key is derived per page', async () => {
    const m = mockFetch(pages(3, 1))
    const seen: string[] = []
    for await (const page of client(m).people.searchPages({ limit: 1 }, { idempotencyKey: 'run-7' })) {
      seen.push(page.request_id)
      expect(page.usage.search_records_counted).toBe(1)
      expect(page.lastResponse.status).toBe(200)
    }
    expect(seen).toEqual(['req_1', 'req_2', 'req_3'])
    expect(m.calls.map((c) => c.headers['idempotency-key'])).toEqual(['run-7', 'run-7-p2', 'run-7-p3'])
  })

  it('companies.searchAll and searchPages', async () => {
    const m = mockFetch((call) => {
      const cursor = (call.body as { cursor?: string }).cursor
      return {
        body: {
          items: [{ company_id: cursor ?? 'first' }],
          next_cursor: cursor ? null : 'c_next',
          usage: {},
          request_id: 'r',
        },
      }
    })
    const ids: string[] = []
    for await (const c of client(m).companies.searchAll({ industry: 'saas' })) ids.push(c.company_id)
    expect(ids).toEqual(['first', 'c_next'])
    let n = 0
    for await (const _ of client(m).companies.searchPages({})) n++
    expect(n).toBe(2)
    expect(m.calls[0]?.url).toBe('https://api.leadsets.ai/v1/companies/search')
  })

  it('stops on an empty page', async () => {
    const m = mockFetch({ body: { items: [], next_cursor: 'c_x', usage: {}, request_id: 'r' } })
    const out: Person[] = []
    for await (const p of client(m).people.searchAll({})) out.push(p)
    expect(out).toHaveLength(0)
    expect(m.calls).toHaveLength(1)
  })
})
