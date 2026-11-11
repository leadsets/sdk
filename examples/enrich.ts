// Enrich a person (from a LinkedIn URL, a work email, or a name plus company domain) and a company.
// Run: LEADSETS_API_KEY=ls_live_… npx tsx examples/enrich.ts
import { Leadsets, NotFoundError } from '@leadsets/sdk'

const ls = new Leadsets()

try {
  const { person, matched_by } = await ls.people.enrich({ full_name: 'Maya Chen', company_domain: 'northwind.io' })
  console.log(`matched by ${matched_by}:`, person.full_name, person.title, person.email?.address, person.email?.status)
  // Every field says where it came from and when it was last seen.
  console.log('title source:', person.sources.title)
} catch (err) {
  // A miss costs nothing.
  if (err instanceof NotFoundError) console.log('No match; nothing was counted.')
  else throw err
}

const { company } = await ls.companies.enrich({ domain: 'northwind.io' })
console.log(company.name, company.industry, company.employees, company.technologies)
