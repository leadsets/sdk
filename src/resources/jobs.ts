import type { HttpClient, RequestOptions } from '../core.js'
import type { AsyncJob } from '../types.js'

export class Jobs {
  constructor(private readonly http: HttpClient) {}

  /** GET /v1/jobs/{id}: status of an async job. */
  get(id: string, options?: RequestOptions): Promise<AsyncJob> {
    if (!id) throw new TypeError('jobs.get: id is required')
    return this.http.request({ method: 'GET', path: `/jobs/${encodeURIComponent(id)}` }, options)
  }
}
