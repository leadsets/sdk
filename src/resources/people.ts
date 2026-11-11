import type { HttpClient, RequestOptions } from '../core.js'
import { items, type PaginationOptions, paginate } from '../pagination.js'
import type {
  PeopleSearchParams,
  PeopleSearchResponse,
  Person,
  PersonEnrichParams,
  PersonEnrichResponse,
} from '../types.js'

export class People {
  constructor(private readonly http: HttpClient) {}

  /** POST /v1/people/search. 1 search record per record returned; empty results use none. */
  search(params: PeopleSearchParams = {}, options?: RequestOptions): Promise<PeopleSearchResponse> {
    return this.http.request({ method: 'POST', path: '/people/search', body: params, idempotent: true }, options)
  }

  /** Every matching person, page after page. Use `maxItems` to cap what you pay for. */
  searchAll(params: PeopleSearchParams = {}, options?: PaginationOptions): AsyncGenerator<Person, void, undefined> {
    return items<Person, PeopleSearchResponse>(this.searchPages(params, options))
  }

  /** Every page of results (with `usage` and `lastResponse` per page). */
  searchPages(
    params: PeopleSearchParams = {},
    options?: PaginationOptions,
  ): AsyncGenerator<PeopleSearchResponse, void, undefined> {
    return paginate((p, o) => this.search(p, o), params, options)
  }

  /** POST /v1/people/enrich. 1 enrichment record when found (+1 for a personal email); 404 uses none. */
  enrich(params: PersonEnrichParams, options?: RequestOptions): Promise<PersonEnrichResponse> {
    return this.http.request({ method: 'POST', path: '/people/enrich', body: params, idempotent: true }, options)
  }
}
