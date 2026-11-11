import { mkdir, writeFile } from 'node:fs/promises'
import { fetchAonHits } from '../src/aonQuery.ts'

// Snapshots AoN at build time: the browser can't query AoN's Elasticsearch directly from our origin (CORS).
await mkdir('public/data', { recursive: true })
for (const system of ['pf2e', 'sf2e'] as const) {
  const hits = await fetchAonHits(system, fetch)
  await writeFile(`public/data/aon-${system}.json`, JSON.stringify(hits))
  console.log(`aon-${system}.json: ${hits.length} entries`)
}
