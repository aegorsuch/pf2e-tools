import { db } from './db'
import { CATEGORY_TO_KIND, DATA_FIELDS, fetchAonHits, plain, type Hit } from './aonQuery.ts'
import type { ContentEntry, GameSystem } from './types'

export const AON_SITES: Record<GameSystem, string> = {
  pf2e: 'https://2e.aonprd.com',
  sf2e: 'https://2e.aonsrd.com',
}

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
  if (kind === 'feat') {
    const special = /\*\*Special\*\*\s*([^\n]*)/i.exec(text(s.markdown))?.[1] ?? ''
    data.repeatable = /\b(?:take|select|choose) this (?:ancestry |class |skill |general )?feat (?:multiple times|more than once)\b/i.test(special)
  }
  const land = (s.speed as { land?: unknown } | undefined)?.land
  if (typeof land === 'number') data.speed = land
  // SF2e ids embed the parent ancestry (ancestries--1-astrazoan--heritages--1-aquazoan)
  const parent = /^ancestries--\d+-(.+?)--heritages/.exec(hit._id ?? '')
  if (text(s.resistances)) data.resistances = text(s.resistances)
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
    description: kind === 'classFeature' && text(s.markdown) ? plain(text(s.markdown)) : text(s.summary),
    data,
    effects: [],
    // Stable timestamp so re-importing doesn't make every entry look changed and re-sync
    updatedAt: 1,
  }
}

// Hits come from the snapshot built at deploy time. AoN's Elasticsearch only allows CORS from its own
// sites and localhost, so the deployed app cannot query it directly; direct queries are the fallback.
async function loadHits(system: GameSystem, onProgress?: (n: number) => void) {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/aon-${system}.json`)
    if (res.ok) {
      const hits = (await res.json()) as unknown
      if (Array.isArray(hits) && hits.length) return hits as Hit[]
    }
  } catch { /* no snapshot; query AoN directly */ }
  return fetchAonHits(system, fetch, onProgress)
}

// Store every AoN entry as official content (replaces prior AoN copies).
export async function importFromAon(system: GameSystem, onProgress?: (n: number) => void) {
  const entries: ContentEntry[] = []
  for (const h of await loadHits(system, onProgress)) {
    const e = mapAonHit(h, system)
    if (e) entries.push(e)
  }
  // Tombstone previously imported entries that are no longer in the (remaster-only) results
  const fresh = new Set(entries.map((e) => e.id))
  const stale = await db.content.where('id').startsWith(`aon:${system}:`).filter((e) => !e.deleted && !fresh.has(e.id)).toArray()
  await db.content.bulkPut([...entries, ...stale.map((e) => ({ ...e, deleted: true, updatedAt: Date.now() }))])
  return entries.length
}

// Bump when the mapping changes so existing installs re-import automatically
export const AON_IMPORT_VERSION = 11
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
