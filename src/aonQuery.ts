import type { EntryKind, GameSystem } from './types.ts'

// Verified live: both systems share one Elasticsearch host, split by index (pf2e: aon, sf2e: aonsf).
export const AON_ENDPOINTS: Record<GameSystem, string> = {
  pf2e: 'https://elasticsearch.aonprd.com/aon/_search',
  sf2e: 'https://elasticsearch.aonprd.com/aonsf/_search',
}

// Scalar/array fields copied into entry.data (arrays are joined with ", ")
export const DATA_FIELDS = [
  'hp', 'size', 'attribute', 'attribute_flaw', 'language', 'vision', 'rarity', 'skill', 'feat', 'prerequisite',
  'actions', 'trigger', 'bulk', 'price', 'damage', 'hands', 'weapon_type', 'ac', 'dex_cap', 'strength',
  'check_penalty', 'range', 'tradition', 'school', 'item_category', 'perception_proficiency',
  'fortitude_proficiency', 'reflex_proficiency', 'will_proficiency', 'skill_proficiency', 'divine_font',
  'domain_primary', 'sanctification', 'warden_spell_tier',
]
const SOURCE_FIELDS = ['name', 'category', 'class', 'level', 'trait', 'summary', 'url', 'source', 'speed', ...DATA_FIELDS]

// Legacy docs carry remaster_id (pointing to their remaster replacement); skip those.
const REMASTER_ONLY = (category: string) => ({
  bool: { filter: [{ term: { category } }], must_not: [{ exists: { field: 'remaster_id' } }] },
})

export const CATEGORY_TO_KIND: Record<string, EntryKind> = {
  feat: 'feat',
  weapon: 'weapon',
  armor: 'armor',
  spell: 'spell',
  equipment: 'item',
  ancestry: 'ancestry',
  class: 'class',
  background: 'background',
  heritage: 'heritage',
  deity: 'deity',
  'class-feature': 'classFeature',
}

export type Hit = { _id?: string; _source?: Record<string, unknown> }

// Fetch every category from AoN (remaster only). `fetchFn` is injectable for Node and browser use.
export async function fetchAonHits(system: GameSystem, fetchFn: typeof fetch, onProgress?: (n: number) => void) {
  const hits: Hit[] = []
  for (const category of Object.keys(CATEGORY_TO_KIND)) {
    const res = await fetchFn(AON_ENDPOINTS[system], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 10000, query: REMASTER_ONLY(category), _source: category === 'feat' ? [...SOURCE_FIELDS, 'markdown'] : SOURCE_FIELDS }),
    })
    if (!res.ok) throw new Error(`AoN ${category}: HTTP ${res.status}`)
    const json = (await res.json()) as { hits?: { hits?: Hit[] } }
    hits.push(...(json.hits?.hits ?? []))
    onProgress?.(hits.length)
  }
  return hits
}
