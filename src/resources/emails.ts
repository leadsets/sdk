import type { HttpClient, RequestOptions } from '../core.js'
import type { EmailVerifyParams, EmailVerifyResponse } from '../types.js'

export class Emails {
  constructor(private readonly http: HttpClient) {}

  /**
   * POST /v1/emails/verify. One email (`email`) or up to 100 (`emails`), or pass a string or
   * an array directly. 1 enrichment record per email checked.
   */
  verify(params: EmailVerifyParams | string | string[], options?: RequestOptions): Promise<EmailVerifyResponse> {
    const body = typeof params === 'string' ? { email: params } : Array.isArray(params) ? { emails: params } : params
    return this.http.request({ method: 'POST', path: '/emails/verify', body, idempotent: true }, options)
  }
}
