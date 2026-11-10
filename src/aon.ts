import { db } from './db'
import type { ContentEntry, EntryKind, GameSystem } from './types'

// UNVERIFIED: endpoints and field names are based on the Archives of Nethys public
// Elasticsearch index and must be checked against live data. Base URLs are overridable.
export const AON_ENDPOINTS: Record<GameSystem, string> = {
  pf2e: 'https://elasticsearch.aonprd.com/aon/_search',
  sf2e: 'https://elasticsearch.aonsrd.com/aon/_search',
}

const CATEGORY_TO_KIND: Record<string, EntryKind> = {
  feat: 'feat',
  weapon: 'weapon',
  armor: 'armor',
  spell: 'spell',
  equipment: 'item',
  ancestry: 'ancestry',
  class: 'class',
}

type Hit = { _id?: string; _source?: Record<string, unknown> }

const text = (v: unknown) => (typeof v === 'string' ? v : '')

export function mapAonHit(hit: Hit, system: GameSystem): ContentEntry | null {
  const s = hit._source
  if (!s) return null
  const kind = CATEGORY_TO_KIND[text(s.category).toLowerCase()]
  const name = text(s.name)
  if (!kind || !name) return null
  const traits = Array.isArray(s.trait) ? s.trait.filter((t): t is string => typeof t === 'string') : []
  const level = typeof s.level === 'number' ? s.level : 0
  return {
    id: `aon:${system}:${hit._id ?? `${kind}:${name}`}`,
    systems: [system],
    kind,
    source: 'official',
    name,
    level,
    traits,
    description: text(s.summary) || text(s.text),
    data: { url: text(s.url), sourceBook: Array.isArray(s.source) ? s.source.join(', ') : text(s.source) },
    effects: [],
    // Stable timestamp so re-importing doesn't make every entry look changed and re-sync
    updatedAt: 1,
  }
}

// Fetch every category page from AoN and store as official entries (replaces prior AoN copies).
export async function importFromAon(system: GameSystem, onProgress?: (n: number) => void) {
  const categories = Object.keys(CATEGORY_TO_KIND)
  const entries: ContentEntry[] = []
  for (const category of categories) {
    const res = await fetch(AON_ENDPOINTS[system], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 10000, query: { term: { category } } }),
    })
    if (!res.ok) throw new Error(`AoN ${category}: HTTP ${res.status}`)
    const json = (await res.json()) as { hits?: { hits?: Hit[] } }
    for (const h of json.hits?.hits ?? []) {
      const e = mapAonHit(h, system)
      if (e) entries.push(e)
    }
    onProgress?.(entries.length)
  }
  await db.content.bulkPut(entries)
  return entries.length
}
