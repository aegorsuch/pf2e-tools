import type { EntryKind, GameSystem } from './types.ts'

// Verified live: both systems share one Elasticsearch host, split by index (pf2e: aon, sf2e: aonsf).
export const AON_ENDPOINTS: Record<GameSystem, string> = {
  pf2e: 'https://elasticsearch.aonprd.com/aon/_search',
  sf2e: 'https://elasticsearch.aonprd.com/aonsf/_search',
}

// Scalar/array fields copied into entry.data (arrays are joined with ", ")
export const DATA_FIELDS = [
  'hp', 'size', 'archetype', 'attribute', 'attribute_flaw', 'language', 'vision', 'rarity', 'skill', 'feat', 'prerequisite',
  'actions', 'trigger', 'bulk', 'price', 'damage', 'hands', 'weapon_type', 'ac', 'dex_cap', 'strength',
  'check_penalty', 'range', 'tradition', 'school', 'item_category', 'perception_proficiency',
  'fortitude_proficiency', 'reflex_proficiency', 'will_proficiency', 'skill_proficiency',
  'armor_proficiency', 'armor_class_proficiency', 'ac_proficiency', 'unarmored_proficiency',
  'light_armor_proficiency', 'medium_armor_proficiency', 'heavy_armor_proficiency', 'attack_proficiency',
  'defense_proficiency', 'divine_font', 'hardness', 'ancestry', 'item_subcategory', 'weapon_group', 'armor_group', 'weapon_category', 'armor_category', 'damage_type', 'reload', 'speed_penalty',
  'domain_primary', 'sanctification', 'warden_spell_tier',
  'deity_category', 'edict', 'anathema', 'area_of_concern', 'religious_symbol', 'favored_weapon', 'domain', 'domain_alternate', 'cleric_spells', 'about', 'pantheon_member', 'grants_languages', 'grants_lore', 'grants_armor_groups', 'grants_armor_categories', 'grants_vision', 'grants_armor_specialization', 'grants_focus_spells', 'grants_order_spells', 'grants_focus_point',
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
  'armor-group': 'armorGroup',
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

// Full deity description (the summary field is truncated): paragraphs between the Source line and the Category block
export function parseDeityAbout(md: string) {
  const body = /\*\*Source\*\*[^\n]*\n([\s\S]*?)<column gap="tiny">/.exec(md)?.[1] ?? ''
  return body.split(/\n\s*\n/).map(plain).filter(Boolean).join('\n\n')
}

// Languages a feat teaches its taker ("You speak and understand Fey"); sentences about allies are ignored
export function parseFeatLanguages(md: string) {
  const out: string[] = []
  for (const sentence of md.split(/(?<=\.)\s+|<br\s*\/?>|\n/)) {
    if (!/\byou (?:can |also |now )?(?:speak|learn|understand|gain|know)/i.test(sentence) || /\b(?:they|ally|allies|target|creature)\b/i.test(sentence)) continue
    for (const m of sentence.matchAll(/\[([^\]]+)\]\(\/Languages\.aspx[^)]*\)/g)) out.push(m[1])
  }
  return [...new Set(out)].join(', ')
}

// Focus spells a feat grants ("You gain the [wild shape] order spell"), spells that depend on the taker's druidic order
// ("if you're a member of the flame order, you gain [combustion]"), and whether it adds a Focus Point
export function parseFeatFocus(md: string) {
  const name = (s: string) => s.replace(/^_+|_+$/g, '').trim()
  const spells = [...md.matchAll(/\b(?:gain|learn) the \[([^\]]+)\]\(\/Spells\.aspx[^)]*\)\s+(?:order|focus|devotion|domain|hex|revelation|composition|school|bloodline|amp) spell/gi)].map((m) => name(m[1]))
  const byOrder = [...md.matchAll(/member of the (\w+) order, you gain \[([^\]]+)\]\(\/Spells\.aspx/gi)].map((m) => `${m[1].toLowerCase()}:${name(m[2])}`)
  return { spells: spells.join(', '), byOrder: byOrder.join(', '), point: /Increase the number of Focus Points in your focus pool by 1/i.test(md) }
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
        if (category === 'feat' && typeof s.markdown === 'string') {
          const langs = parseFeatLanguages(s.markdown)
          if (langs) s.grants_languages = langs
          const focus = parseFeatFocus(s.markdown)
          if (focus.spells) s.grants_focus_spells = focus.spells
          if (focus.byOrder) s.grants_order_spells = focus.byOrder
          if (focus.point) s.grants_focus_point = 'yes'
          const text = plain(s.markdown)
          const lore = /Additional Lore feat for ([A-Z][\w' -]*? Lore)/.exec(text)?.[1]
          if (lore) s.grants_lore = lore
          const sight = /\byou(?:[^.]*?)\b(?:gain|have) (darkvision|low-light vision)/i.exec(text)?.[1]
          if (sight) s.grants_vision = sight.replace(/\b\w/g, (m) => m.toUpperCase())
          const spec = /armor specialization.*?\.(?=\s|<|$)/i.exec(s.markdown)?.[0]
          if (spec || /armor specialization/i.test(plain(s.markdown))) s.grants_armor_specialization = 'yes'
          if (spec) {
            const groups = [...spec.matchAll(/\[([^\]]+)\]\(\/ArmorGroups\.aspx[^)]*\)/g)].map((m) => m[1])
            if (groups.length) s.grants_armor_groups = groups.join(', ')
            const cats = spec.split('[')[0].match(/light|medium|heavy|unarmored/gi) ?? []
            if (cats.length) s.grants_armor_categories = cats.join(', ')
          }
        }
        if (category === 'deity' && typeof s.markdown === 'string') {
          const spells = parseClericSpells(s.markdown)
          if (spells) s.cleric_spells = spells
          const about = parseDeityAbout(s.markdown)
          if (about) s.about = about
        }
        if (category !== 'feat' && category !== 'class-feature' && category !== 'armor-group') delete s.markdown
      }
      hits.push(hit)
    }
    onProgress?.(hits.length)
  }
  return hits
}
