// Verify a list of emails in batches of 100 and keep only the deliverable ones.
// Run: LEADSETS_API_KEY=ls_live_… npx tsx examples/verify-list.ts
import { Leadsets } from '@leadsetsai/sdk'

const ls = new Leadsets()

const emails = ['jane@example.com', 'sam@example.org', 'not-an-email', 'jo@example.net']

const keep: string[] = []
for (let i = 0; i < emails.length; i += 100) {
  const batch = emails.slice(i, i + 100)
  const res = await ls.emails.verify({ emails: batch })
  for (const r of res.results) {
    if (r.status === 'verified') keep.push(r.email)
    if (r.status === null) console.log(`${r.email}: ${r.reason}`) // not checked, not counted
  }
  console.log('summary:', res.summary)
}
console.log('deliverable:', keep)
