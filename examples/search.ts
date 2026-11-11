// Ten revenue leaders at US SaaS companies with 20–200 people.
// Run: LEADSETS_API_KEY=ls_live_… npx tsx examples/search.ts
import { Leadsets } from '@leadsets/sdk'

const ls = new Leadsets(process.env.LEADSETS_KEY)

const res = await ls.people.search({
  function: ['revenue'],
  seniority: ['vp', 'head'],
  employees: '20-200',
  country: 'US',
  industry: 'saas',
  limit: 10,
})

for (const p of res.items) {
  console.log(
    `${p.full_name} · ${p.title} @ ${p.company?.name ?? '?'} · ${p.email?.address ?? 'no email'} (${p.email?.status ?? '-'})`,
  )
  console.log('  matched on:', p.match_reasons?.join(', '))
}
console.log('usage:', res.usage)
console.log('records left in this 5-hour window:', res.lastResponse.rateLimit.recordsRemaining)
