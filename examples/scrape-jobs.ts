// Open roles from a company's careers page: a hiring signal. Needs a paid plan with scrape units.
// Run: LEADSETS_API_KEY=ls_live_… npx tsx examples/scrape-jobs.ts
import { Leadsets, PermissionDeniedError, ScrapeUnitsExhaustedError } from '@leadsetsai/sdk'

const ls = new Leadsets()

try {
  const res = await ls.scrape.jobs({ domain: 'example.com', max_pages: 3 })
  console.log(`${res.count} open roles at ${res.careers_url}`)
  for (const job of res.jobs) console.log(`- ${job.title} (${job.team ?? 'no team'}, ${job.location ?? 'no location'})`)
  console.log('scrape units left:', res.usage.scrape_units_left)
} catch (err) {
  if (err instanceof PermissionDeniedError) console.log('Scraping needs a paid plan:', err.upgradeUrl)
  else if (err instanceof ScrapeUnitsExhaustedError) console.log('No scrape units left. Add a pack in Billing.')
  else throw err
}
