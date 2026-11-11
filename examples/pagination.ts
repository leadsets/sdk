// Walk every page of a search. maxItems caps what you pay for: the last page asks only for what's left.
// Run: LEADSETS_API_KEY=ls_live_… npx tsx examples/pagination.ts
import { Leadsets } from '@leadsets/sdk'

const ls = new Leadsets()

let n = 0
for await (const person of ls.people.searchAll({ title: ['VP Sales'], country: 'US', limit: 100 }, { maxItems: 250 })) {
  n++
  console.log(n, person.full_name, person.company?.domain)
}

// Or page by page, to read usage as you go.
for await (const page of ls.companies.searchPages({ industry: 'saas', employees: '50-200' }, { maxPages: 3 })) {
  console.log(`${page.items.length} companies; records left this window: ${page.usage.search_records_left_5h}`)
}
