/**
 * Request and response types for the Leadsets API v1.
 *
 * Response objects are plain JSON from the API. Every response also carries a
 * non-enumerable `lastResponse` with the HTTP status, headers and rate-limit info.
 */

// ---- Vocabularies --------------------------------------------------------------------------

export type Seniority = 'c_level' | 'vp' | 'head' | 'director' | 'manager' | 'ic'
export type PersonFunction = 'revenue' | 'marketing' | 'engineering' | 'product' | 'ops' | 'finance' | 'hr'
export type Plan = 'free' | 'solo' | 'pro' | 'team' | 'max'
/** Status of an email attached to a person. Invalid emails are never returned. */
export type EmailStatus = 'verified' | 'catch_all' | 'unknown'
/** Status from `emails.verify`. */
export type VerificationStatus = 'verified' | 'catch_all' | 'unknown' | 'invalid'

/** A value or a list of values. */
export type OneOrMany<T> = T | T[]

// ---- Shared response parts -----------------------------------------------------------------

/** Where a field came from, when it was last seen and how confident we are in it. */
export interface FieldSource {
  source: string | null
  seen_at: string | null
  confidence: number | null
}

export interface Location {
  country: string | null
  region: string | null
  city: string | null
}

/**
 * What this call counted and what is left. Which keys appear depends on the endpoint and
 * the plan: paid plans get the five-hour and weekly meters, Free gets the one-time balances,
 * scrape endpoints get scrape units.
 */
export interface Usage {
  search_records_counted?: number
  search_records_left_5h?: number
  search_requests_left_5h?: number
  search_records_left_week?: number
  free_search_records_left?: number
  enrich_records_counted?: number
  enrich_records_left_5h?: number
  enrich_requests_left_5h?: number
  enrich_records_left_week?: number
  free_enrich_records_left?: number
  free_calls_left?: number
  scrape_units_counted?: number
  scrape_units_left?: number
  /** True when limits could not be checked for this call. */
  degraded?: boolean
  [key: string]: number | boolean | undefined
}

/** Rate-limit headers of a response, parsed. `null` when the header was absent. */
export interface RateLimitInfo {
  /** `X-Leadsets-Records-Remaining`: records left in this kind's five-hour window. */
  recordsRemaining: number | null
  /** `X-Leadsets-Requests-Remaining`: requests left in this kind's five-hour window. */
  requestsRemaining: number | null
  /** `X-Leadsets-Weekly-Remaining`: records left in this kind's weekly window. */
  weeklyRemaining: number | null
  /** `X-Leadsets-Free-Remaining`: Free plan only, free records left. */
  freeRemaining: number | null
  /** `Retry-After` in seconds. */
  retryAfter: number | null
}

/** HTTP details of a response. Available as the non-enumerable `lastResponse` on every result. */
export interface ResponseMeta {
  status: number
  headers: Headers
  requestId: string | null
  /** The Idempotency-Key that was sent, if any. */
  idempotencyKey: string | null
  /** True when the API replayed a stored result for this Idempotency-Key (nothing was counted again). */
  idempotentReplayed: boolean
  rateLimit: RateLimitInfo
  /** How many HTTP attempts the call took (1 = no retries). */
  attempts: number
}

export interface APIResponse {
  /** Quote it to support: we can see exactly what happened. */
  request_id: string
  usage: Usage
  /** HTTP status, headers and rate-limit info. Not serialized by JSON.stringify. */
  readonly lastResponse: ResponseMeta
}

// ---- People --------------------------------------------------------------------------------

export interface Email {
  address: string
  status: EmailStatus
  type: 'business' | 'personal' | string
  confidence: number
  checked_at: string | null
  verified_by: string | null
  mx_provider: string | null
}

export interface PersonCompany {
  company_id: string | null
  name: string | null
  domain: string | null
  industry: string | null
  employees: number | null
  employee_range: string | null
}

export interface Person {
  person_id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  title: string | null
  seniority: Seniority | null
  /** Finer-grained seniority, e.g. "founder" or "senior". */
  seniority_detail: string | null
  function: PersonFunction | null
  /** Finer-grained function, e.g. "sales" or "revops". */
  function_detail: string | null
  linkedin_url: string | null
  location: Location
  company: PersonCompany | null
  email: Email | null
  /** Present on `people.enrich` with `include_personal_email`. */
  personal_email?: Email | null
  /** Which filters this record matched (search results only). */
  match_reasons?: string[]
  refreshed_at: string | null
  confirmed_at: string | null
  stale_after_at: string | null
  stale: boolean
  /** Source, last-seen date and confidence for every field that has a value. */
  sources: Record<string, FieldSource>
}

export interface PeopleSearchParams {
  /** Job titles. Fuzzy-matched: "VP Sales" also finds "Vice President, Sales". */
  title?: OneOrMany<string>
  seniority?: OneOrMany<Seniority>
  function?: OneOrMany<PersonFunction>
  /** Only people at these companies (domains). */
  company_domain?: OneOrMany<string>
  /** Company headcount range, e.g. "50-200", "1000+" or "<50". */
  employees?: string
  /** Leadsets industry slugs, e.g. "saas". */
  industry?: OneOrMany<string>
  /** ISO 3166-1 alpha-2 country codes, e.g. "US". */
  country?: OneOrMany<string>
  /** Only people with a verified work email. */
  has_verified_email?: boolean
  /** Only records refreshed within this many days. */
  max_age_days?: number
  /** Leave out records flagged stale. */
  exclude_stale?: boolean
  /** 1–100. Default 25. Free plan: at most 10. */
  limit?: number
  /** `next_cursor` from the previous page. */
  cursor?: string
  /** Optional: the request in plain language, kept with your request log. */
  prompt?: string
}

export interface PeopleSearchResponse extends APIResponse {
  items: Person[]
  next_cursor: string | null
}

export interface PersonEnrichParams {
  /** LinkedIn profile URL (strongest identifier). */
  linkedin_url?: string
  /** A known work email. */
  email?: string
  /** Full name; use with `company_domain`. */
  full_name?: string
  first_name?: string
  last_name?: string
  /** Company domain; use with a name. */
  company_domain?: string
  /** Also return a personal email when there is one (paid plans). */
  include_personal_email?: boolean
  prompt?: string
}

export interface PersonEnrichResponse extends APIResponse {
  person: Person
  matched_by: 'linkedin_url' | 'email' | 'name_and_domain'
  /** Why a requested personal email was left out. */
  personal_email_note?: string
}

// ---- Companies -----------------------------------------------------------------------------

export interface Company {
  company_id: string
  name: string | null
  domain: string | null
  linkedin_url: string | null
  industry: string | null
  naics: string | null
  employees: number | null
  employee_range: string | null
  revenue_range: string | null
  location: Location
  founded_year: number | null
  description: string | null
  technologies: string[]
  match_reasons?: string[]
  refreshed_at: string | null
  confirmed_at: string | null
  stale_after_at: string | null
  stale: boolean
  sources: Record<string, FieldSource>
}

export interface CompaniesSearchParams {
  industry?: OneOrMany<string>
  /** Headcount range, e.g. "50-200" or "1000+". */
  employees?: string
  country?: OneOrMany<string>
  /** Technologies the company uses, e.g. "hubspot". Matches any. */
  technology?: OneOrMany<string>
  /** Only these domains. */
  domain?: OneOrMany<string>
  max_age_days?: number
  exclude_stale?: boolean
  /** 1–100. Default 25. Free plan: at most 10. */
  limit?: number
  cursor?: string
  prompt?: string
}

export interface CompaniesSearchResponse extends APIResponse {
  items: Company[]
  next_cursor: string | null
}

export interface CompanyEnrichParams {
  /** Company domain or website URL, e.g. "northwind.io". */
  domain?: string
  /** LinkedIn company page URL. */
  linkedin_url?: string
  prompt?: string
}

export interface CompanyEnrichResponse extends APIResponse {
  company: Company
}

// ---- Emails --------------------------------------------------------------------------------

export interface EmailVerifyParams {
  /** One email to verify. */
  email?: string
  /** Up to 100 emails to verify. */
  emails?: string[]
}

export interface EmailVerification {
  email: string
  /** `null` when the email was not checked (see `reason`); nothing was counted for it. */
  status: VerificationStatus | null
  confidence: number | null
  checked_at: string | null
  source: string | null
  mx_provider: string | null
  /** Why the email was not checked, e.g. "not_checked: limit reached". */
  reason?: string
}

export interface EmailVerifySummary {
  verified: number
  catch_all: number
  unknown: number
  invalid: number
  not_checked: number
}

export interface EmailVerifyResponse extends APIResponse {
  results: EmailVerification[]
  summary: EmailVerifySummary
}

// ---- Scrape --------------------------------------------------------------------------------

export interface ScrapeParams {
  /** Company domain, e.g. "northwind.io". */
  domain?: string
  /** A specific page to start from (overrides domain). */
  url?: string
  /** Pages to read, 1–10. 1 scrape unit per page read. */
  max_pages?: number
}

export interface ScrapedPage {
  url: string
  title: string | null
  description: string | null
  /** Page text as Markdown, truncated. */
  text: string
}

export interface ScrapeCompanyResponse extends APIResponse {
  domain: string
  url: string
  name: string | null
  description: string | null
  headings: string[]
  /** e.g. pricing, about, customers, careers, contact, blog, docs, product, login, signup. */
  key_links: Record<string, string>
  /** e.g. linkedin, x, github, youtube, facebook, instagram. */
  social: Record<string, string>
  pages: ScrapedPage[]
  units_used: number
  scraped_at: string
}

export interface Job {
  title: string
  url: string
  location: string | null
  team: string | null
  posted: string | null
  /** Where the role is listed, e.g. "greenhouse", "lever" or "site". */
  source: string
  found_on: string
}

export interface ScrapeJobsResponse extends APIResponse {
  domain: string
  careers_url: string
  jobs: Job[]
  count: number
  units_used: number
  scraped_at: string
}

// ---- Async jobs ----------------------------------------------------------------------------

export interface AsyncJob extends APIResponse {
  id: string
  status: string
  [key: string]: unknown
}

// ---- Usage ---------------------------------------------------------------------------------

/** `[used, limit]`. */
export type Meter = [number, number]

export interface WindowMeters {
  records_5h: Meter
  requests_5h: Meter
  records_week: Meter
  resets_at: string | null
  week_resets_at: string | null
}

export interface Unavailable {
  unavailable: true
}

export interface FreeMeters {
  search_records: Meter
  enrich_records: Meter
  data_calls: Meter
  search_per_call: number
  note: string
}

export interface UsageResponse extends APIResponse {
  plan: Plan
  /** Free plan: one-time balances. */
  free?: FreeMeters
  /** Paid plans: enrichment windows. */
  enrich?: WindowMeters | Unavailable
  /** Paid plans: search windows. */
  search?: WindowMeters | Unavailable
  /** Plans with a weekly personal email cap. */
  personal_emails_week?: Meter | Unavailable
  /** `[running, limit]`. `running` is null when it could not be read. */
  concurrent_searches: [number | null, number]
  scrape_units: number
  scraping: boolean
}
