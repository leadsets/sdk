import type { HttpClient, RequestOptions } from '../core.js'
import { items, type PaginationOptions, paginate } from '../pagination.js'
import type {
  CompaniesSearchParams,
  CompaniesSearchResponse,
  Company,
  CompanyEnrichParams,
  CompanyEnrichResponse,
} from '../types.js'

export class Companies {
  constructor(private readonly http: HttpClient) {}

  /** POST /v1/companies/search. 1 search record per record returned; empty results use none. */
  search(params: CompaniesSearchParams = {}, options?: RequestOptions): Promise<CompaniesSearchResponse> {
    return this.http.request({ method: 'POST', path: '/companies/search', body: params, idempotent: true }, options)
  }

  /** Every matching company, page after page. Use `maxItems` to cap what you pay for. */
  searchAll(params: CompaniesSearchParams = {}, options?: PaginationOptions): AsyncGenerator<Company, void, undefined> {
    return items<Company, CompaniesSearchResponse>(this.searchPages(params, options))
  }

  /** Every page of results. */
  searchPages(
    params: CompaniesSearchParams = {},
    options?: PaginationOptions,
  ): AsyncGenerator<CompaniesSearchResponse, void, undefined> {
    return paginate((p, o) => this.search(p, o), params, options)
  }

  /** POST /v1/companies/enrich. 1 enrichment record when found; 404 uses none. */
  enrich(params: CompanyEnrichParams, options?: RequestOptions): Promise<CompanyEnrichResponse> {
    return this.http.request({ method: 'POST', path: '/companies/enrich', body: params, idempotent: true }, options)
  }
}
