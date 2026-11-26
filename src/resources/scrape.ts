import type { HttpClient, RequestOptions } from '../core.js'
import type { ScrapeCompanyResponse, ScrapeJobsParams, ScrapeJobsResponse, ScrapeParams } from '../types.js'

export class Scrape {
  constructor(private readonly http: HttpClient) {}

  /** POST /v1/scrape/company. 1 scrape unit per page read (default 1 page). Paid plans with scrape units. */
  company(params: ScrapeParams, options?: RequestOptions): Promise<ScrapeCompanyResponse> {
    return this.http.request({ method: 'POST', path: '/scrape/company', body: params, idempotent: true }, options)
  }

  /**
   * POST /v1/scrape/jobs: open roles from the company's careers page, its job board and LinkedIn, from its
   * website. 1 scrape unit per page read (default up to 3). Paid plans with scrape units.
   */
  jobs(params: ScrapeJobsParams, options?: RequestOptions): Promise<ScrapeJobsResponse> {
    return this.http.request({ method: 'POST', path: '/scrape/jobs', body: params, idempotent: true }, options)
  }
}
