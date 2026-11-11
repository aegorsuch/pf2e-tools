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
  'fortitude_proficiency', 'reflex_proficiency', 'will_proficiency', 'skill_proficiency',
  'armor_proficiency', 'armor_class_proficiency', 'ac_proficiency', 'unarmored_proficiency',
  'light_armor_proficiency', 'medium_armor_proficiency', 'heavy_armor_proficiency', 'attack_proficiency',
  'defense_proficiency', 'divine_font', 'hardness', 'ancestry', 'item_subcategory', 'weapon_group', 'armor_group', 'weapon_category', 'armor_category', 'damage_type', 'reload', 'speed_penalty',
  'domain_primary', 'sanctification', 'warden_spell_tier',
  'deity_category', 'edict', 'anathema', 'area_of_concern', 'religious_symbol', 'favored_weapon', 'domain', 'domain_alternate', 'cleric_spells',
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
  shield: 'shield',
  spell: 'spell',
  equipment: 'item',
  ancestry: 'ancestry',
  class: 'class',
  background: 'background',
  heritage: 'heritage',
  deity: 'deity',
  'class-feature': 'classFeature',
  language: 'language',
}

// Class feature summaries often omit the proficiency sentences, so keep the full text without markup
export const plain = (md: string) => md
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]*>/g, ' ')
  .replace(/[*_`]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const DAMAGE_TYPES = 'acid|cold|electricity|fire|sonic|poison|mental|force|negative|positive|vitality|void|bludgeoning|piercing|slashing|physical|spirit'
// Cleric spells by rank from a deity page: "1st: Summon Animal; 2nd: Speak with Animals"
export function parseClericSpells(md: string) {
  const section = /\*\*Cleric Spells\*\*([\s\S]*?)(?:<\/column>|$)/.exec(md)?.[1] ?? ''
  return [...section.matchAll(/-\s*\*\*([^*]+)\*\*\s*\n([^\n]+)/g)].map((m) => `${m[1].trim()}: ${plain(m[2])}`).join('; ')
}

// Resistances in "damage=value" form; value is a number or "half" (half the character's level, minimum 1)
export function parseResistances(t: string) {
  const out: string[] = []
  const re = new RegExp(`(?:\\b(${DAMAGE_TYPES}) resistance|resistance to (${DAMAGE_TYPES}))\\s+(?:equal to half your level|(?:of )?(\\d+))`, 'gi')
  for (const m of t.matchAll(re)) out.push(`${(m[1] ?? m[2]).toLowerCase()}=${m[3] ?? 'half'}`)
  return [...new Set(out)].join(',')
}

export type Hit = { _id?: string; _source?: Record<string, unknown> }

// Fetch every category from AoN (remaster only). `fetchFn` is injectable for Node and browser use.
export async function fetchAonHits(system: GameSystem, fetchFn: typeof fetch, onProgress?: (n: number) => void) {
  const hits: Hit[] = []
  for (const category of Object.keys(CATEGORY_TO_KIND)) {
    const res = await fetchFn(AON_ENDPOINTS[system], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 10000, query: REMASTER_ONLY(category), _source: [...SOURCE_FIELDS, 'markdown'] }),
    })
    if (!res.ok) throw new Error(`AoN ${category}: HTTP ${res.status}`)
    const json = (await res.json()) as { hits?: { hits?: Hit[] } }
    for (const hit of json.hits?.hits ?? []) {
      const s = hit._source
      if (s) {
        // Only resistance text is needed from most markdown; keep the full text for feats and class features
        const found = parseResistances(plain(typeof s.markdown === 'string' ? s.markdown : ''))
        if (found) s.resistances = found
        if (category === 'deity' && typeof s.markdown === 'string') {
          const spells = parseClericSpells(s.markdown)
          if (spells) s.cleric_spells = spells
        }
        if (category !== 'feat' && category !== 'class-feature') delete s.markdown
      }
      hits.push(hit)
    }
    onProgress?.(hits.length)
  }
  return hits
}
