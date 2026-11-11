// Handle every error type. The SDK already retries 429, 5xx and network errors (2 retries by default).
// Run: LEADSETS_API_KEY=ls_live_… npx tsx examples/error-handling.ts
import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  FreeRecordsExhaustedError,
  InvalidRequestError,
  Leadsets,
  NotFoundError,
  RateLimitError,
} from '@leadsets/sdk'

const ls = new Leadsets({ maxRetries: 3 })

try {
  const res = await ls.people.search(
    { title: ['Head of Growth'], country: 'GB', limit: 25 },
    { idempotencyKey: 'growth-gb-1' },
  )
  console.log(res.items.length, 'people')
} catch (err) {
  if (err instanceof RateLimitError) {
    // window_full, weekly_limit or too_many_concurrent, after the SDK's own retries.
    console.log(`${err.type} on ${err.meter}; resets at ${err.resetsAt}; retry in ${err.retryAfter}s`)
  } else if (err instanceof FreeRecordsExhaustedError) {
    console.log('Free records are used up. Pick a plan to keep going.')
  } else if (err instanceof InvalidRequestError) {
    console.log(`Bad value for ${err.param}: ${err.message}`)
  } else if (err instanceof AuthenticationError) {
    console.log('Check the API key.')
  } else if (err instanceof NotFoundError) {
    console.log('Nothing found; nothing counted.')
  } else if (err instanceof APIError) {
    console.log(`API error ${err.status} ${err.type}: ${err.message} (request_id ${err.requestId})`)
  } else if (err instanceof APIConnectionError) {
    console.log('Network problem:', err.message)
  } else {
    throw err
  }
}
