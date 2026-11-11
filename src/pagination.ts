import type { RequestOptions } from './core.js'

export interface PaginationOptions extends RequestOptions {
  /** Stop after this many items (the last page asks only for what's left, so you pay for no more). */
  maxItems?: number | undefined
  /** Stop after this many pages. */
  maxPages?: number | undefined
}

interface Page<T> {
  items: T[]
  next_cursor: string | null
}

type Params = { limit?: number | undefined; cursor?: string | undefined }

/**
 * Fetches pages by following `next_cursor`. When the caller passes an idempotencyKey, each
 * page gets its own key derived from it (`<key>-p2`, `<key>-p3` …), because each page has a
 * different body.
 */
export async function* paginate<P extends Params, R extends Page<unknown>>(
  fetchPage: (params: P, opts: RequestOptions) => Promise<R>,
  params: P,
  opts: PaginationOptions = {},
): AsyncGenerator<R, void, undefined> {
  const { maxItems, maxPages, ...reqOpts } = opts
  let cursor = params.cursor
  let seen = 0
  for (let page = 1; ; page++) {
    if (maxPages !== undefined && page > maxPages) return
    let limit = params.limit
    if (maxItems !== undefined) {
      const left = maxItems - seen
      if (left <= 0) return
      limit = Math.min(limit ?? 25, left)
    }
    const pageParams = { ...params, ...(limit !== undefined ? { limit } : {}), ...(cursor ? { cursor } : {}) } as P
    const key = reqOpts.idempotencyKey
    const res = await fetchPage(pageParams, { ...reqOpts, idempotencyKey: key && page > 1 ? `${key}-p${page}` : key })
    seen += res.items.length
    yield res
    if (!res.next_cursor || res.items.length === 0) return
    cursor = res.next_cursor
  }
}

export async function* items<T, R extends Page<T>>(pages: AsyncIterable<R>): AsyncGenerator<T, void, undefined> {
  for await (const p of pages) yield* p.items
}
