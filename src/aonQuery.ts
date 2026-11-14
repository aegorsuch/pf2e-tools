import type { EntryKind, GameSystem, SpellGrant } from './types.ts'

// Verified live: both systems share one Elasticsearch host, split by index (pf2e: aon, sf2e: aonsf).
export const AON_ENDPOINTS: Record<GameSystem, string> = {
  pf2e: 'https://elasticsearch.aonprd.com/aon/_search',
  sf2e: 'https://elasticsearch.aonprd.com/aonsf/_search',
}

// Scalar/array fields copied into entry.data (arrays are joined with ", ")
export const DATA_FIELDS = [
  'hp', 'size', 'archetype', 'attribute', 'attribute_flaw', 'language', 'vision', 'rarity', 'skill', 'feat', 'prerequisite', 'access',
  'actions', 'trigger', 'duration', 'bulk', 'price', 'damage', 'hands', 'weapon_type', 'usage', 'ac', 'dex_cap', 'strength',
  'check_penalty', 'range', 'thrown_range', 'tradition', 'school', 'item_category', 'perception_proficiency',
  'fortitude_proficiency', 'reflex_proficiency', 'will_proficiency', 'skill_proficiency',
  'armor_proficiency', 'armor_class_proficiency', 'ac_proficiency', 'unarmored_proficiency',
  'light_armor_proficiency', 'medium_armor_proficiency', 'heavy_armor_proficiency', 'attack_proficiency',
  'defense_proficiency', 'divine_font', 'hardness', 'ancestry', 'item_subcategory', 'weapon_group', 'armor_group', 'weapon_category', 'armor_category', 'damage_type', 'reload', 'speed_penalty',
  'domain_primary', 'sanctification', 'sanctification_required', 'warden_spell_tier',
  'deity_category', 'epithet', 'edict', 'anathema', 'area_of_concern', 'religious_symbol', 'favored_weapon', 'domain', 'domain_alternate', 'cleric_spells', 'about', 'pantheon_member', 'grants_languages', 'grants_lore', 'grants_armor_groups', 'grants_armor_categories', 'grants_vision', 'grants_armor_specialization', 'grants_focus_spells', 'grants_order_spells', 'grants_focus_point',
  'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'sense', 'speed_raw', 'mount', 'companion_attacks', 'companion_support', 'companion_maneuver',
]
const SOURCE_FIELDS = ['name', 'category', 'class', 'level', 'trait', 'summary', 'url', 'source', 'speed', ...DATA_FIELDS]
export const usesFullItemRules = (source: Record<string, unknown>) =>
  /Property Runes|Precious Material/i.test(String(source.item_subcategory)) || source.item_category === 'Materials'
  || source.item_category === 'Augmentations'

// Retain these legacy oaths because their remaster replacements have different mechanics.
export const RETAINED_LEGACY_FEAT_IDS = ['feat-219', 'feat-1669']

const contentQuery = (category: string, system: GameSystem) => ({
  bool: { filter: [{ term: { category } }], must_not: [
    category === 'feat' && system === 'pf2e'
      ? { bool: { filter: [{ exists: { field: 'remaster_id' } }], must_not: [{ ids: { values: RETAINED_LEGACY_FEAT_IDS } }] } }
      : { exists: { field: 'remaster_id' } },
  ] },
})

export const SUBCLASS_CLASSES: Record<string, string> = {
  'hunters-edge': 'Ranger', cause: 'Champion', instinct: 'Barbarian', muse: 'Bard', 'druidic-order': 'Druid',
  doctrine: 'Cleric', 'research-field': 'Alchemist', racket: 'Rogue', bloodline: 'Sorcerer',
  patron: 'Witch', 'arcane-school': 'Wizard', mystery: 'Oracle', methodology: 'Investigator',
  innovation: 'Inventor', way: 'Gunslinger', 'hybrid-study': 'Magus', 'conscious-mind': 'Psychic',
  practice: 'Animist', eidolon: 'Summoner', style: 'Swashbuckler',
}

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
  trait: 'trait',
  deity: 'deity',
  'class-feature': 'classFeature',
  language: 'language',
  'armor-group': 'armorGroup',
  'animal-companion': 'companion',
  'animal-companion-specialization': 'companionSpec',
  'animal-companion-advanced': 'companionAdv',
  ...Object.fromEntries(Object.keys(SUBCLASS_CLASSES).map((category) => [category, 'subclass' as const])),
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
  md = md.replace(/[_*]/g, '')
  const name = (s: string) => s.replace(/^_+|_+$/g, '').trim()
  const spells = [...md.matchAll(/\b(?:gain|learn) the \[([^\]]+)\]\(\/(?:Spells\.aspx|spells\/)[^)]*\)\s+(?:order|focus|devotion|domain|hex|revelation|composition|school|bloodline|amp|qi) spell/gi)].map((m) => name(m[1]))
  const byOrder = [...md.matchAll(/member of the (\w+) order, you gain \[([^\]]+)\]\(\/Spells\.aspx/gi)].map((m) => `${m[1].toLowerCase()}:${name(m[2])}`)
  return { spells: spells.join(', '), byOrder: byOrder.join(', '), point: /Increase the number of Focus Points in your focus pool by 1/i.test(md) }
}

// Only explicit, unconditional grants. Conditional effects and variable DC/rank rules stay in the source text.
export function parseFeatSpellGrants(md: string): SpellGrant[] {
  const body = md.split(/\n---\n/)[1]?.replace(/[_*]/g, '') ?? ''
  const headerFrequency = /^\*\*Frequency\*\*\s+((?:once|twice|\d+ times) per day)\s*$/im.exec(md.split(/\n---\n/)[0])?.[1]
  const grants: SpellGrant[] = []
  if (/\bClaim a defined territory\b/i.test(body)) {
    const territory = /Within its borders, you can cast ([^\n]+?) as innate divine cantrips\b/i.exec(body)
    if (territory) {
      const spells = [...territory[1].matchAll(/\[([^\]]+)\]\((?:https:\/\/2e\.(?:aonprd|aonsrd)\.com)?\/(?:Spells\.aspx|spells\/)[^)]*\)/gi)]
        .map(match => match[1])
      if (spells.length) grants.push({ kind: 'innate', spells, tradition: 'divine', frequency: 'at will',
        heightened: true, condition: 'Only within your claimed territory' })
    }
  }
  const territorialDaily = /While in your territory, you can cast ([^\n]+?) as innate divine spells, each once per day\./i.exec(body)
  if (territorialDaily) {
    const spells = [...territorialDaily[1].matchAll(/\[([^\]]+)\]\((?:https:\/\/2e\.(?:aonprd|aonsrd)\.com)?\/(?:Spells\.aspx|spells\/)[^)]*\)/gi)]
      .map(match => match[1])
    if (spells.length) grants.push({ kind: 'innate', spells, tradition: 'divine', frequency: 'once per day',
      condition: 'Only within your claimed territory' })
  }
  const attribute = (/spellcasting (?:attribute|ability)(?: for [^.!?\n]*?)?(?: modifier)? is (Intelligence|Wisdom|Charisma)/i.exec(body)?.[1]
    ?? /(Intelligence|Wisdom|Charisma) is (?:the |your )?(?:key )?spellcasting (?:attribute|ability)/i.exec(body)?.[1]
    ?? /(?:use|using) (Intelligence|Wisdom|Charisma) as your spellcasting (?:attribute|ability)/i.exec(body)?.[1])?.toLowerCase()
  const ability = attribute === 'intelligence' ? 'int' : attribute === 'wisdom' ? 'wis' : attribute === 'charisma' ? 'cha' : undefined
  const cantrip = /Choose one cantrip from the \[([^\]]+)\]\([^)]*\) spell list/i.exec(body)
  if (cantrip && /innate spell at[- ]will/i.test(body)) {
    grants.push({ kind: 'innate', spells: [], choice: 'cantrip', tradition: cantrip[1], heightened: true, frequency: 'at will', ...(ability ? { ability } : {}) })
  }
  const separateDaily = /You gain ([^\n]+?) as (\d+)(?:st|nd|rd|th)-rank (arcane|divine|occult|primal) innate spells\.\s*You can cast each of these (?:arcane|divine|occult|primal) innate spells once per day\./i.exec(body)
  if (separateDaily) {
    const spells = [...separateDaily[1].matchAll(/\[([^\]]+)\]\((?:https:\/\/2e\.(?:aonprd|aonsrd)\.com)?\/(?:Spells\.aspx|spells\/)[^)]*\)/gi)]
      .map(match => match[1])
    if (spells.length) grants.push({ kind: 'innate', spells, rank: Number(separateDaily[2]),
      tradition: separateDaily[3], frequency: 'once per day', heightened: false, ...(ability ? { ability } : {}) })
  }
  const higherDC = /using the higher of your class DC or\s+spell DC/i.test(body)
  if ((!higherDC && /class DC|whichever is higher/i.test(body)) || /At \d+(?:st|nd|rd|th) level|if you could|if its modifier/i.test(body)) return grants
  const sentences = body.split(/(?<=[.!?])\s+/)
  for (const [index, sentence] of sentences.entries()) {
    if (!/^(?:(?:once|twice|\d+ times) per day,? )?you (?:can cast|gain|learn)\b/i.test(sentence.trim())) continue
    const names = [...sentence.matchAll(/\[([^\]]+)\]\((?:https:\/\/2e\.(?:aonprd|aonsrd)\.com)?\/(?:Spells\.aspx|spells\/)[^)]*\)/gi)].map(match => match[1])
    if (!names.length) continue
    if (/innate (?:(?:arcane|divine|occult|primal) )?(?:spell|cantrip)/i.test(sentence)) {
      if (/\b(?:if|while|unless)\b/i.test(sentence)) continue
      const tradition = /\b(arcane|divine|occult|primal)\b/i.exec(sentence)?.[1]
      const frequencies = [...sentence.matchAll(/\b(?:once|twice|\d+ times) per day\b|\bat[- ]will\b/gi)].map(match => match[0])
      if (!frequencies.length && headerFrequency && names.length === 1
        && sentences.filter(text => /\byou can cast\b.*\binnate\b/i.test(text)).length === 1) frequencies.push(headerFrequency)
      const ranks = [...sentence.matchAll(/\b(\d+)(?:st|nd|rd|th)-(?:rank|level)\b/gi)]
      if (!tradition || frequencies.length !== 1 || ranks.length > 1) continue
      const next = plain(sentences[index + 1] ?? '')
      const scales = (text: string) => /half your level,? rounded up/i.test(text)
      const shared = names.length > 1 && /\bor\b/i.test(sentence)
      const heightened = scales(sentence) || /innate cantrip/i.test(sentence)
        || scales(next) && (/^(?:This spell|Its spell rank)\b/i.test(next) && names.length === 1
          || shared && /^You choose which spell/i.test(next))
      const rule: SpellGrant = {
        kind: 'innate', spells: names, tradition, frequency: frequencies[0].toLowerCase().replace('at-will', 'at will'),
        ...(ranks[0] ? { rank: Number(ranks[0][1]) } : {}),
        heightened, shared,
        ...(ability ? { ability } : {}),
        ...(higherDC ? { dc: 'higher-class-or-spell' as const } : {}),
      }
      if (!heightened && scales(next)) {
        grants.push(...names.map(name => ({ ...rule, spells: [name], heightened: next.toLowerCase().includes(name.toLowerCase()) })))
      } else grants.push(rule)
    } else if (/(?:focus|devotion|qi|hex|order|domain|revelation|composition) spells?\b/i.test(sentence)
      || /\byou gain the \[[^\]]+\]\(\/Spells\.aspx[^)]*\) order\.$/i.test(sentence.trim())) {
      if (/\b(?:if|choose|depending|based on)\b/i.test(sentence) || /\bor\b/i.test(sentence) && names.length <= 1) continue
      grants.push({ kind: 'focus', spells: names, heightened: true, ...(ability ? { ability } : {}),
        ...(/\bor\b/i.test(sentence) ? { choice: 'listed' as const } : {}),
        tradition: /\bare (arcane|divine|occult|primal) spells/i.exec(body)?.[1] })
    }
  }
  return grants
}

// Animal companion stat block: unarmed attacks as "name|damage|traits" joined by ";", plus support benefit and advanced maneuver
export function parseCompanion(md: string) {
  const attacks = [...md.matchAll(/\*\*(?:Melee|Ranged)\*\*\s*<actions[^>]*\/>\s*([^\n]*?),?\s*\n\s*\*\*Damage\*\*\s*([^\n]+)/g)].map((m) => {
    const label = plain(m[1])
    const traits = /\(([^)]*)\)/.exec(label)?.[1] ?? ''
    return `${label.replace(/\s*\([^)]*\)/, '').trim()}|${plain(m[2])}|${traits.toLowerCase()}`
  })
  const field = (name: string) => plain(new RegExp(`\\*\\*${name}\\*\\*\\s*([^\\n]+)`).exec(md)?.[1] ?? '')
  return { attacks: attacks.join(';'), support: field('Support Benefit'), maneuver: field('Advanced Maneuver') }
}

// Resistances in "damage=value" form; value is a number or "half" (half the character's level, minimum 1)
export function parseResistances(t: string) {
  const out: string[] = []
  const re = new RegExp(`(?:\\b(${DAMAGE_TYPES}) resistance|resistance to (${DAMAGE_TYPES}))\\s+(?:equal to half your level|(?:of )?(\\d+))`, 'gi')
  for (const m of t.matchAll(re)) out.push(`${(m[1] ?? m[2]).toLowerCase()}=${m[3] ?? 'half'}`)
  return [...new Set(out)].join(',')
}

export type Hit = { _id?: string; _source?: Record<string, unknown> }

// Fetch remastered content and explicitly supported legacy entries.
export async function fetchAonHits(system: GameSystem, fetchFn: typeof fetch, onProgress?: (n: number) => void) {
  const hits: Hit[] = []
  for (const category of Object.keys(CATEGORY_TO_KIND)) {
    if (system !== 'pf2e' && SUBCLASS_CLASSES[category]) continue
    const res = await fetchFn(AON_ENDPOINTS[system], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 10000, query: contentQuery(category, system), _source: [...SOURCE_FIELDS, 'markdown'] }),
    })
    if (!res.ok) throw new Error(`AoN ${category}: HTTP ${res.status}`)
    const json = (await res.json()) as { hits?: { hits?: Hit[] } }
    for (const hit of json.hits?.hits ?? []) {
      const s = hit._source
      if (s) {
        if (category === 'weapon' && typeof s.markdown === 'string') {
          const traits = /<traits\b[^>]*>([\s\S]*?)<\/traits>/i.exec(s.markdown)?.[1] ?? ''
          const range = /<trait\b[^>]*\blabel="Thrown\s+(\d+)\s*(?:ft\.?|feet)\s*"[^>]*>/i.exec(traits)?.[1]
          if (range) s.thrown_range = Number(range)
        }
        // Keep full rules text for description popups and class features.
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
          s.sanctification_required = /\bDivine Sanctification\s+must choose\b/i.test(plain(s.markdown))
          const spells = parseClericSpells(s.markdown)
          if (spells) s.cleric_spells = spells
          const about = parseDeityAbout(s.markdown)
          if (about) s.about = about
        }
        if (category === 'animal-companion' && typeof s.markdown === 'string') {
          const comp = parseCompanion(s.markdown)
          if (comp.attacks) s.companion_attacks = comp.attacks
          if (comp.support) s.companion_support = comp.support
          if (comp.maneuver) s.companion_maneuver = comp.maneuver
        }
        if (!['feat', 'spell', 'trait', 'class-feature', 'armor-group', 'animal-companion-specialization', 'animal-companion-advanced'].includes(category) && !SUBCLASS_CLASSES[category]
          && !(category === 'equipment' && usesFullItemRules(s))) delete s.markdown
      }
      hits.push(hit)
    }
    onProgress?.(hits.length)
  }
  return hits
}
