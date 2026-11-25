import { mkdir, writeFile } from 'node:fs/promises'
import { AON_ENDPOINTS, fetchAonHits, type Hit } from '../src/aonQuery.ts'
import { normalizeApparitions } from '../src/apparitions.ts'
import { normalizeCelestials, normalizeFiends, normalizePlants, normalizeUndead } from '../src/summonedFiends.ts'

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
const celestialResponse = await fetch(AON_ENDPOINTS.pf2e, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ size: 10000, query: { bool: { filter: [
    { term: { category: 'creature' } }, { term: { trait: 'Celestial' } }, { range: { level: { lte: 15 } } },
  ] } } }),
})
if (!celestialResponse.ok) throw new Error(`AoN celestials: HTTP ${celestialResponse.status}`)
const celestialResult = await celestialResponse.json() as { hits?: { hits?: Hit[] } }
if (!celestialResult.hits?.hits) throw new Error('AoN celestials: missing creature data')
const celestials = normalizeCelestials(celestialResult.hits.hits)
await writeFile('public/data/aon-celestials.json', JSON.stringify(celestials))
console.log(`aon-celestials.json: ${celestials.length} entries`)
const apparitionResponse = await fetch(AON_ENDPOINTS.pf2e, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ size: 1000, query: { bool: { filter: [{ term: { category: 'apparition' } }] } } }),
})
if (!apparitionResponse.ok) throw new Error(`AoN apparitions: HTTP ${apparitionResponse.status}`)
const apparitionResult = await apparitionResponse.json() as { hits?: { hits?: Hit[] } }
if (!apparitionResult.hits?.hits) throw new Error('AoN apparitions: missing data')
const apparitions = normalizeApparitions(apparitionResult.hits.hits as never)
await writeFile('public/data/aon-apparitions.json', JSON.stringify(apparitions))
console.log(`aon-apparitions.json: ${apparitions.length} entries`)
const plantResponse = await fetch(AON_ENDPOINTS.pf2e, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ size: 10000, query: { bool: { filter: [
    { term: { category: 'creature' } }, { terms: { trait: ['Plant', 'Fungus'] } }, { range: { level: { lte: 15 } } },
  ] } } }),
})
if (!plantResponse.ok) throw new Error(`AoN plants: HTTP ${plantResponse.status}`)
const plantResult = await plantResponse.json() as { hits?: { hits?: Hit[] } }
if (!plantResult.hits?.hits) throw new Error('AoN plants: missing creature data')
const plants = normalizePlants(plantResult.hits.hits)
await writeFile('public/data/aon-plants.json', JSON.stringify(plants))
console.log(`aon-plants.json: ${plants.length} entries`)
const undeadResponse = await fetch(AON_ENDPOINTS.pf2e, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ size: 10000, query: { bool: { filter: [
    { term: { category: 'creature' } }, { term: { trait: 'Undead' } }, { range: { level: { lte: 15 } } },
  ] } } }),
})
if (!undeadResponse.ok) throw new Error(`AoN undead: HTTP ${undeadResponse.status}`)
const undeadResult = await undeadResponse.json() as { hits?: { hits?: Hit[] } }
if (!undeadResult.hits?.hits) throw new Error('AoN undead: missing creature data')
const undead = normalizeUndead(undeadResult.hits.hits)
await writeFile('public/data/aon-undead.json', JSON.stringify(undead))
console.log(`aon-undead.json: ${undead.length} entries`)
