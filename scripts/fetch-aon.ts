import { mkdir, writeFile } from 'node:fs/promises'
import { AON_ENDPOINTS, fetchAonHits, type Hit } from '../src/aonQuery.ts'
import { normalizeFiends } from '../src/summonedFiends.ts'

// Snapshots AoN at build time: the browser can't query AoN's Elasticsearch directly from our origin (CORS).
await mkdir('public/data', { recursive: true })
for (const system of ['pf2e', 'sf2e'] as const) {
  const hits = await fetchAonHits(system, fetch)
  await writeFile(`public/data/aon-${system}.json`, JSON.stringify(hits))
  console.log(`aon-${system}.json: ${hits.length} entries`)
}
const response = await fetch(AON_ENDPOINTS.pf2e, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ size: 10000, query: { bool: { filter: [
    { term: { category: 'creature' } }, { term: { trait: 'Fiend' } }, { range: { level: { lte: 15 } } },
  ] } } }),
})
if (!response.ok) throw new Error(`AoN fiends: HTTP ${response.status}`)
const result = await response.json() as { hits?: { hits?: Hit[] } }
if (!result.hits?.hits) throw new Error('AoN fiends: missing creature data')
const fiends = normalizeFiends(result.hits.hits)
await writeFile('public/data/aon-fiends.json', JSON.stringify(fiends))
console.log(`aon-fiends.json: ${fiends.length} entries`)
