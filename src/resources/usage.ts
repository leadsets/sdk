import type { HttpClient, RequestOptions } from '../core.js'
import type { UsageResponse } from '../types.js'

export class UsageResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /v1/usage: what's left in every meter and when each window resets. Free to call. */
  get(options?: RequestOptions): Promise<UsageResponse> {
    return this.http.request({ method: 'GET', path: '/usage' }, options)
  }
}
