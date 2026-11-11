import { db } from './db'
import type { ContentEntry, EntryKind, GameSystem } from './types'

// Verified live: both systems share one Elasticsearch host, split by index (pf2e: aon, sf2e: aonsf).
export const AON_ENDPOINTS: Record<GameSystem, string> = {
  pf2e: 'https://elasticsearch.aonprd.com/aon/_search',
  sf2e: 'https://elasticsearch.aonprd.com/aonsf/_search',
}

export const AON_SITES: Record<GameSystem, string> = {
  pf2e: 'https://2e.aonprd.com',
  sf2e: 'https://2e.aonsrd.com',
}

// Scalar/array fields copied into entry.data (arrays are joined with ", ")
const DATA_FIELDS = [
  'hp', 'size', 'attribute', 'attribute_flaw', 'language', 'vision', 'rarity', 'skill', 'feat', 'prerequisite',
  'actions', 'trigger', 'bulk', 'price', 'damage', 'hands', 'weapon_type', 'ac', 'dex_cap', 'strength',
  'check_penalty', 'range', 'tradition', 'school', 'item_category', 'perception_proficiency',
  'fortitude_proficiency', 'reflex_proficiency', 'will_proficiency', 'skill_proficiency', 'divine_font',
  'domain_primary', 'sanctification',
]
const SOURCE_FIELDS = ['name', 'category', 'class', 'level', 'trait', 'summary', 'url', 'source', 'speed', ...DATA_FIELDS]

// Legacy docs carry remaster_id (pointing to their remaster replacement); skip those.
const REMASTER_ONLY = (category: string) => ({
  bool: { filter: [{ term: { category } }], must_not: [{ exists: { field: 'remaster_id' } }] },
})

const CATEGORY_TO_KIND: Record<string, EntryKind> = {
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
  const data: Record<string, string | number | boolean> = {
    url: s.url ? AON_SITES[system] + text(s.url) : '',
    sourceBook: Array.isArray(s.source) ? s.source.join(', ') : text(s.source),
  }
  for (const f of DATA_FIELDS) {
    const v = s[f]
    if (typeof v === 'number' || typeof v === 'boolean') data[f] = v
    else if (typeof v === 'string' && v) data[f] = v
    else if (Array.isArray(v) && v.length) data[f] = v.join(', ')
  }
  const land = (s.speed as { land?: unknown } | undefined)?.land
  if (typeof land === 'number') data.speed = land
  // SF2e ids embed the parent ancestry (ancestries--1-astrazoan--heritages--1-aquazoan)
  const parent = /^ancestries--\d+-(.+?)--heritages/.exec(hit._id ?? '')
  if (kind === 'classFeature') data.class = text(s.class)
  if (kind === 'heritage' && parent) data.ancestry = parent[1]
  return {
    id: `aon:${system}:${hit._id ?? `${kind}:${name}`}`,
    systems: [system],
    kind,
    source: 'official',
    name,
    level,
    traits,
    description: text(s.summary),
    data,
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
      body: JSON.stringify({ size: 10000, query: REMASTER_ONLY(category), _source: SOURCE_FIELDS }),
    })
    if (!res.ok) throw new Error(`AoN ${category}: HTTP ${res.status}`)
    const json = (await res.json()) as { hits?: { hits?: Hit[] } }
    for (const h of json.hits?.hits ?? []) {
      const e = mapAonHit(h, system)
      if (e) entries.push(e)
    }
    onProgress?.(entries.length)
  }
  // Tombstone previously imported entries that are no longer in the (remaster-only) results
  const fresh = new Set(entries.map((e) => e.id))
  const stale = await db.content.where('id').startsWith(`aon:${system}:`).filter((e) => !e.deleted && !fresh.has(e.id)).toArray()
  await db.content.bulkPut([...entries, ...stale.map((e) => ({ ...e, deleted: true, updatedAt: Date.now() }))])
  return entries.length
}

// Bump when the mapping changes so existing installs re-import automatically
export const AON_IMPORT_VERSION = 2
const REFRESH_MS = 7 * 24 * 3600 * 1000
const inFlight = new Map<GameSystem, Promise<number>>()

// Import official content when it is missing, outdated or older than a week; no-op otherwise.
export async function ensureAonImported(system: GameSystem, onProgress?: (n: number) => void) {
  const key = `aon-import:${system}`
  const [version, at] = (localStorage.getItem(key) ?? '').split(':').map(Number)
  const fresh = version === AON_IMPORT_VERSION && Date.now() - at < REFRESH_MS
  if (fresh && (await db.content.where('id').startsWith(`aon:${system}:`).count()) > 0) return 0
  let run = inFlight.get(system)
  if (!run) {
    run = importFromAon(system, onProgress).then((n) => {
      localStorage.setItem(key, `${AON_IMPORT_VERSION}:${Date.now()}`)
      return n
    })
    inFlight.set(system, run)
    run.then(() => inFlight.delete(system), () => inFlight.delete(system))
  }
  return run
}
