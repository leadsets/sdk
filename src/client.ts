import { type ClientOptions, HttpClient } from './core.js'
import { Companies } from './resources/companies.js'
import { Emails } from './resources/emails.js'
import { Jobs } from './resources/jobs.js'
import { People } from './resources/people.js'
import { Scrape } from './resources/scrape.js'
import { UsageResource } from './resources/usage.js'

/**
 * The Leadsets API client.
 *
 * ```ts
 * const ls = new Leadsets(process.env.LEADSETS_KEY)
 * const res = await ls.people.search({ function: ['revenue'], country: 'US', limit: 10 })
 * ```
 */
export class Leadsets {
  readonly people: People
  readonly companies: Companies
  readonly emails: Emails
  readonly scrape: Scrape
  readonly jobs: Jobs
  readonly usage: UsageResource
  /** The base URL requests go to. */
  readonly baseURL: string

  constructor(apiKey?: string | ClientOptions, options: ClientOptions = {}) {
    const opts: ClientOptions =
      typeof apiKey === 'object' && apiKey !== null ? apiKey : { ...options, apiKey: apiKey ?? options.apiKey }
    const http = new HttpClient(opts)
    this.baseURL = http.baseURL
    this.people = new People(http)
    this.companies = new Companies(http)
    this.emails = new Emails(http)
    this.scrape = new Scrape(http)
    this.jobs = new Jobs(http)
    this.usage = new UsageResource(http)
  }
}
