import { db, ensureSupplementalContent } from './db'
import { CATEGORY_TO_KIND, DATA_FIELDS, EXCLUDED_LEGACY_RANGER_FEAT_IDS, RETAINED_LEGACY_EQUIPMENT_IDS, RETAINED_LEGACY_FEAT_IDS, SUBCLASS_CLASSES, fetchAonHits, parseChoiceDescriptions, parseFeatRitualGrants, parseFeatSpellGrants, plain, usesFullItemRules, type Hit } from './aonQuery.ts'
import type { ContentEntry, GameSystem } from './types'
import { isWeaponMode } from './weaponModes'
import { backgroundEntries, deityBackgroundEntries } from './backgrounds'

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
    url: s.url ? AON_SITES[system] + text(s.url)
      + (system === 'pf2e' && [...RETAINED_LEGACY_FEAT_IDS, ...RETAINED_LEGACY_EQUIPMENT_IDS].some(id => id === hit._id) ? '&NoRedirect=1' : '') : '',
    sourceBook: Array.isArray(s.source) ? s.source.join(', ') : text(s.source),
  }
  const markdown = kind === 'background'
    ? text(s.markdown).replace(/^[\s\S]*?\*\*Source\*\*[^\n]*\n/i, '') : text(s.markdown)
  const familiarRules = markdown
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '')
    .replace(/<column\b[^>]*>[\s\S]*?<\/column>/gi, '')
    .replace(/^\s*\*\*(?:Source|Ability Type)\*\*[^\n]*\n/gim, '')
  if (kind === 'background' && markdown.trim()) data.full_description = true
  for (const f of DATA_FIELDS) {
    const v = s[f]
    if (typeof v === 'number' || typeof v === 'boolean') data[f] = v
    else if (typeof v === 'string' && v) data[f] = v
    else if (Array.isArray(v) && v.length) data[f] = v.join(', ')
  }
  // The search index omits Intimidation: https://2e.aonsrd.com/deities/20-zon-shelyn
  if (system === 'sf2e' && kind === 'deity' && name === 'Zon-Shelyn') data.skill = 'Crafting, Intimidation'
  if (system === 'sf2e' && kind === 'class') {
    if (name === 'Soldier') data.attribute = 'Constitution'
    if (name === 'Operative') data.attribute = 'Dexterity'
    if (name === 'Witchwarper') data.attribute = 'Intelligence, Charisma'
  }
  if (kind === 'spell') {
    const header = text(s.markdown).split(/\n\s*---\s*\n/, 1)[0]
    for (const field of ['duration', 'range']) {
      const match = new RegExp(`\\*\\*${field}\\*\\*[ \\t]*([^\\r\\n]*)`, 'i').exec(header)
      const value = match ? plain(match[1]) : ''
      if (value) data[`${field}_text`] = value
    }
  }
  if (kind === 'feat') {
    const special = /\*\*Special\*\*\s*([^\n]*)/i.exec(text(s.markdown))?.[1] ?? ''
    data.repeatable = /\b(?:take|select|choose) this (?:ancestry |class |skill |general )?feat (?:multiple times|more than once|twice|a second time|up to \w+ times)\b/i.test(special)
    const archetypes = /^\*\*Archetypes?\*\*\s+(.+)$/im.exec(text(s.markdown))?.[1] ?? ''
    const levels = [...archetypes.matchAll(/\[([^\]]+)\]\([^)]*\)\s*\(Level (\d+)\)/gi)]
    if (levels.length) data.archetype_levels = levels.map((match) => `${match[1]}:${match[2]}`).join(', ')
  }
  const land = (s.speed as { land?: unknown } | undefined)?.land
  if (typeof land === 'number') data.speed = land
  const leadsTo = kind === 'feat' ? /<title\b[^>]*>[^<]*\bleads to\.\.\.<\/title>([\s\S]*)/i.exec(text(s.markdown))?.[1] : undefined
  const featLinks = leadsTo ? [...leadsTo.matchAll(/\[([^\]]+)\]\((\/(?:Feats\.aspx|feats\/)[^)]*)\)/gi)]
    .map(match => ({ name: match[1], url: AON_SITES[system] + match[2] })) : []
  const ritualGrants = kind === 'feat' ? parseFeatRitualGrants(text(s.markdown)) : []
  const comparisonMarkdown = kind === 'feat' ? text(s.markdown)
    .replace(/<details\b[^>]*\bclass=["'][^"']*\bclarification\b[^"']*["'][^>]*>[\s\S]*?<\/details>/gi, '') : ''
  const choiceDescriptions = kind === 'feat' ? parseChoiceDescriptions(markdown) : []
  // SF2e ids embed the parent ancestry (ancestries--1-astrazoan--heritages--1-aquazoan)
  const parent = /^ancestries--\d+-(.+?)--heritages/.exec(hit._id ?? '')
  if (text(s.resistances)) data.resistances = text(s.resistances)
  if (kind === 'classFeature') data.class = text(s.class)
  if (kind === 'subclass') {
    const category = text(s.category).toLowerCase()
    data.class = SUBCLASS_CLASSES[category]
    if (category === 'muse') {
      const feat = /\*\*Muse Feat\*\*\s*\[([^\]]+)\]/i.exec(markdown)?.[1]
      const spell = /\*\*Muse Spell\*\*\s*\[([^\]]+)\]/i.exec(markdown)?.[1]
      if (feat) data.grants_muse_feat = plain(feat)
      if (spell) data.grants_focus_spells = plain(spell)
    } else if (category === 'mystery') {
      const spell = /\*\*Initial Revelation Spell\*\*\s*\[([^\]]+)\]/i.exec(markdown)?.[1]
      if (spell) data.grants_focus_spells = plain(spell)
    }
  }
  if (kind === 'familiar') {
    const type = /\*\*Ability Type\*\*\s+([^\n]+)/i.exec(markdown)?.[1]
    if (type) data.ability_type = plain(type)
  }
  if (text(s.category).toLowerCase() === 'fatal-method') data.subclass_type = 'fatal-method'
  if (text(s.category).toLowerCase() === 'grim-fascination') {
    const spell = /\*\*Grave Spell\*\*\s*\[([^\]]+)\]\([^)]*\)/i.exec(markdown)?.[1]
    if (spell) data.grants_focus_spells = plain(spell)
  }
  if (kind === 'heritage' && parent) data.ancestry = parent[1]
  if (usesFullItemRules(s)) {
    const actions = text(s.markdown).split(/\n\s*\n/)
      .filter(paragraph => /^\*\*Activate\b/.test(paragraph.trim()))
      .map(paragraph => /<actions\s+string="([^"]*)"/.exec(paragraph)?.[1] ?? '').join(';')
    data.item_activation_actions = actions
    if (traits.includes('Artifact')) data.artifact_activation_actions = actions
  }
  return {
    id: `aon:${system}:${hit._id ?? `${kind}:${name}`}`,
    systems: [system],
    kind,
    source: 'official',
    name,
    level,
    traits,
    description: (kind === 'ancestry' || kind === 'companion') && text(s.about) ? text(s.about)
      : (['feat', 'heritage', 'background', 'spell', 'ritual', 'trait', 'classFeature', 'armorGroup', 'companionSpec', 'companionAdv', 'subclass'].includes(kind)
      || kind === 'familiar' || usesFullItemRules(s)) && markdown.trim()
      ? (kind === 'familiar' ? familiarRules : markdown).split(/\n\s*\n/).map(plain).filter(Boolean).join('\n\n') : text(s.summary),
    ...(kind === 'feat' && comparisonMarkdown !== text(s.markdown)
      ? { comparisonRules: comparisonMarkdown.split(/\n\s*\n/).map(plain).join('\n\n') } : {}),
    ...(choiceDescriptions.length ? { choiceDescriptions } : {}),
    data,
    effects: [],
    ...(kind === 'weapon' && Array.isArray(s.weapon_modes) ? { weaponModes: s.weapon_modes.filter(isWeaponMode) } : {}),
    ...(kind === 'feat' ? { spellGrants: parseFeatSpellGrants(text(s.markdown)) } : {}),
    ...(ritualGrants.length ? { ritualGrants } : {}),
    ...(featLinks.length ? { featLinks } : {}),
    // Stable timestamp so re-importing doesn't make every entry look changed and re-sync
    updatedAt: 1,
  }
}

// Hits come from the snapshot built at deploy time. AoN's Elasticsearch only allows CORS from its own
// sites and localhost, so the deployed app cannot query it directly; direct queries are the fallback.
async function loadHits(system: GameSystem, onProgress?: (n: number) => void) {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/aon-${system}.json?v=${encodeURIComponent(AON_IMPORT_VERSION)}`)
    if (res.ok) {
      const hits = (await res.json()) as unknown
      if (Array.isArray(hits) && hits.length) return hits as Hit[]
    }
  } catch { /* no snapshot; query AoN directly */ }
  return fetchAonHits(system, fetch, onProgress)
}

export function mapAonHits(hits: Hit[], system: GameSystem) {
  const entries: ContentEntry[] = []
  const hasUpdatedJuggernaut = system === 'pf2e' && hits.some(hit => hit._id === 'feat-5880')
  const hasUpdatedFlexibility = system === 'pf2e' && hits.some(hit => hit._id === 'feat-4858')
  for (const h of hits) {
    if (system === 'pf2e' && EXCLUDED_LEGACY_RANGER_FEAT_IDS.includes(h._id ?? '')) continue
    if (hasUpdatedJuggernaut && h._id === 'feat-1167') continue
    if (hasUpdatedFlexibility && h._id === 'feat-1171') continue
    const e = mapAonHit(h, system)
    if (!e) continue
    const adjusted = dropHellknightTrainingPrerequisite(e)
    if (system === 'pf2e' && adjusted.kind === 'feat' && adjusted.name === 'Mortification' && /\bHellknight\b/.test(String(adjusted.data.archetype ?? ''))) {
      entries.push(...MORTIFICATION_DAMAGE.map(damage => ({
        ...adjusted, id: `${adjusted.id}:${damage}`, name: `Mortification (${damage[0].toUpperCase()}${damage.slice(1)})`,
        data: { ...adjusted.data, resistances: `${damage}=hellknight` },
      })))
    } else if (adjusted.kind === 'background') entries.push(...backgroundEntries(adjusted, text(h._source?.markdown)))
    else entries.push(adjusted)
  }
  return deityBackgroundEntries(entries)
}

const MORTIFICATION_DAMAGE = ['bludgeoning', 'piercing', 'slashing']

const HELLKNIGHT_MANUAL = /trained by a Hellknight Order|member of a Hellknight Order|passed the Hellknight Test|refused to take or have failed the Hellknight Test|^lawful alignment$/i

function dropHellknightTrainingPrerequisite(entry: ContentEntry): ContentEntry {
  if (entry.kind !== 'feat' || !/\bHellknight\b/.test(String(entry.data.archetype ?? ''))) return entry
  const strip = (text: string) => text.split(/;\s*/).filter(part => part && !HELLKNIGHT_MANUAL.test(part.trim().replace(/\.$/, ''))).join('; ')
  const prerequisite = entry.data.prerequisite === undefined ? undefined : strip(String(entry.data.prerequisite))
  const description = entry.description.replace(/^(Prerequisites?:?[ \t]*)(.*)$/im, (_, label, rest) => {
    const remaining = strip(rest)
    return remaining ? `${label}${remaining}` : ''
  })
  if (prerequisite === entry.data.prerequisite && description === entry.description) return entry
  const { prerequisite: _old, ...data } = entry.data
  return { ...entry, data: prerequisite ? { ...data, prerequisite } : data, description }
}

// Store every AoN entry as official content (replaces prior AoN copies).
export async function importFromAon(system: GameSystem, onProgress?: (n: number) => void) {
  const entries = mapAonHits(await loadHits(system, onProgress), system)
  // Tombstone previously imported entries that are no longer in the (remaster-only) results
  const fresh = new Set(entries.map((e) => e.id))
  const stale = await db.content.where('id').startsWith(`aon:${system}:`).filter((e) => !e.deleted && !fresh.has(e.id)).toArray()
  await db.content.bulkPut([...entries, ...stale.map((e) => ({ ...e, deleted: true, updatedAt: Date.now() }))])
  await ensureSupplementalContent()
  return entries.length
}

// Every deploy gets a new build id, so existing installs re-import the fresh snapshot after each update
declare const __BUILD_ID__: string
export const AON_IMPORT_VERSION = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'
const REFRESH_MS = 7 * 24 * 3600 * 1000
const inFlight = new Map<GameSystem, Promise<number>>()

// Import official content when it is missing, outdated or older than a week; no-op otherwise.
export async function ensureAonImported(system: GameSystem, onProgress?: (n: number) => void) {
  const key = `aon-import:${system}`
  const [version, at] = (localStorage.getItem(key) ?? '').split(':')
  const fresh = version === AON_IMPORT_VERSION && Date.now() - Number(at) < REFRESH_MS
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
