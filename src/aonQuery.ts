import type { EntryKind, GameSystem, SpellGrant } from './types.ts'
import { parseWeaponModes } from './weaponModes.ts'
import { plain } from './plain.ts'
export { plain } from './plain.ts'

// Verified live: both systems share one Elasticsearch host, split by index (pf2e: aon, sf2e: aonsf).
export const AON_ENDPOINTS: Record<GameSystem, string> = {
  pf2e: 'https://elasticsearch.aonprd.com/aon/_search',
  sf2e: 'https://elasticsearch.aonprd.com/aonsf/_search',
}

// Scalar/array fields copied into entry.data (arrays are joined with ", ")
export const DATA_FIELDS = [
  'hp', 'size', 'archetype', 'attribute', 'attribute_flaw', 'language', 'vision', 'rarity', 'skill', 'feat', 'prerequisite', 'access',
  'actions', 'trigger', 'duration', 'range', 'area', 'target', 'targets', 'save', 'saving_throw', 'saving_throw_dc', 'saving_throw_basic',
  'cast', 'cost', 'secondary_casters', 'primary_check', 'secondary_checks',
  'bulk', 'price', 'damage', 'hands', 'weapon_type', 'usage', 'ac', 'dex_cap', 'strength',
  'check_penalty', 'range', 'thrown_range', 'tradition', 'school', 'item_category', 'perception_proficiency',
  'fortitude_proficiency', 'reflex_proficiency', 'will_proficiency', 'skill_proficiency',
  'armor_proficiency', 'armor_class_proficiency', 'ac_proficiency', 'unarmored_proficiency',
  'light_armor_proficiency', 'medium_armor_proficiency', 'heavy_armor_proficiency', 'attack_proficiency',
  'defense_proficiency', 'divine_font', 'hardness', 'ancestry', 'item_subcategory', 'weapon_group', 'armor_group', 'weapon_category', 'armor_category', 'damage_type', 'reload', 'speed_penalty',
  'domain_primary', 'sanctification', 'sanctification_required', 'alignment', 'warden_spell_tier', 'upgrade_slots', 'weapon_ammunition', 'weapon_tracking',
  'deity_category', 'epithet', 'edict', 'anathema', 'area_of_concern', 'religious_symbol', 'favored_weapon', 'domain', 'domain_alternate', 'cleric_spells', 'about', 'pantheon_member', 'grants_languages', 'grants_lore', 'grants_armor_groups', 'grants_armor_categories', 'grants_vision', 'grants_armor_specialization', 'grants_focus_spells', 'grants_order_spells', 'grants_focus_point',
  'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'sense', 'speed_raw', 'mount', 'companion_attacks', 'companion_support', 'companion_maneuver',
  'companion_maneuver_actions', 'companion_maneuver_traits', 'companion_maneuver_requirements', 'companion_maneuver_description',
]
const SOURCE_FIELDS = ['name', 'category', 'class', 'level', 'trait', 'summary', 'url', 'source', 'speed', 'legacy_id', ...DATA_FIELDS]
export const usesFullItemRules = (source: Record<string, unknown>) =>
  ['equipment', 'weapon', 'armor', 'shield'].includes(String(source.category))

// Retain these legacy oaths because their remaster replacements have different mechanics.
export const RETAINED_LEGACY_FEAT_IDS = ['feat-219', 'feat-220', 'feat-1669']
export const RETAINED_LEGACY_EQUIPMENT_IDS = ['equipment-290', 'equipment-291']

// Old Ranger snare feats; keep the remastered Snarecrafter archetype instead.
export const EXCLUDED_LEGACY_RANGER_FEAT_IDS = [
  'feat-506', 'feat-509', 'feat-516', 'feat-527', 'feat-539', 'feat-1766', 'feat-1779',
]

const contentQuery = (category: string, system: GameSystem) => ({
  bool: { filter: [{ term: { category } }], must_not: [
    ['feat', 'equipment'].includes(category) && system === 'pf2e'
      ? { bool: { filter: [{ exists: { field: 'remaster_id' } }], must_not: [{ ids: { values: category === 'feat' ? RETAINED_LEGACY_FEAT_IDS : RETAINED_LEGACY_EQUIPMENT_IDS } }] } }
      : { exists: { field: 'remaster_id' } },
    ...(category === 'feat' && system === 'pf2e' ? [{ ids: { values: EXCLUDED_LEGACY_RANGER_FEAT_IDS } }] : []),
  ] },
})

export const SUBCLASS_CLASSES: Record<string, string> = {
  'hunters-edge': 'Ranger', cause: 'Champion', instinct: 'Barbarian', muse: 'Bard', 'druidic-order': 'Druid',
  doctrine: 'Cleric', 'research-field': 'Alchemist', racket: 'Rogue', bloodline: 'Sorcerer',
  patron: 'Witch', 'arcane-school': 'Wizard', mystery: 'Oracle', methodology: 'Investigator',
  innovation: 'Inventor', way: 'Gunslinger', 'hybrid-study': 'Magus', 'conscious-mind': 'Psychic',
  practice: 'Animist', eidolon: 'Summoner', style: 'Swashbuckler', 'grim-fascination': 'Necromancer', 'fatal-method': 'Necromancer',
}

export const CATEGORY_TO_KIND: Record<string, EntryKind> = {
  feat: 'feat',
  weapon: 'weapon',
  armor: 'armor',
  shield: 'shield',
  spell: 'spell',
  ritual: 'ritual',
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
  'weapon-group': 'weaponGroup',
  'animal-companion': 'companion',
  'animal-companion-specialization': 'companionSpec',
  'animal-companion-advanced': 'companionAdv',
  'familiar-ability': 'familiar',
  'familiar-specific': 'familiar',
  ...Object.fromEntries(Object.keys(SUBCLASS_CLASSES).map((category) => [category, 'subclass' as const])),
}

export function parseChoiceDescriptions(markdown: string) {
  const sections: { text: string; options: Record<string, string> }[] = []
  for (const match of markdown.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>|<(ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi)) {
    const block = match[0]
    if ([...block.matchAll(/<(?:table|ul|ol)\b/gi)].length !== 1) continue
    let complete = true
    const references = new Map<string, string[]>()
    const rows = /^<table\b/i.test(block)
      ? [...block.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((row, index) => {
        const cells = [...row[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
        if (index === 0 && cells.length >= 2 && (cells.every(cell => cell[1].toLowerCase() === 'th')
          || cells.every(cell => /^\s*\*\*[^*]+\*\*\s*$/.test(cell[2])))) return []
        if (cells.length < 2) { complete = false; return [] }
        const label = plain(cells[0][2])
        const raw = cells.map(cell => cell[2]).join(' ').replace(/\*\*([^*]+)\*\*/g, '$1')
        references.set(label, [...raw.matchAll(/(?<=[\w)])(\*+)(?!\*)/g)].map(marker => marker[1]))
        return [[label, cells.slice(1).map(cell => plain(cell[2])).join(', ')]]
      })
      : [...block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].flatMap(row => {
        const option = /^\s*(?:\*\*([^*]+)\*\*|<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>)\s*:?\s*([\s\S]+)$/i.exec(row[1])
        if (!option) complete = false
        return option ? [[plain(option[1] ?? option[2]), plain(option[3])]] : []
      })
    if (!complete || rows.length < 2 || rows.some(([name, detail]) => !name || !detail)
      || new Set(rows.map(([name]) => name.toLowerCase())).size !== rows.length) continue
    const options = Object.fromEntries(rows)
    let source = block
    let following = markdown.slice(match.index + block.length)
    for (;;) {
      const footnote = /^(?:\s|<br\s*\/?>)*(\*+)[ \t]+([^\n]*?)(?=<\/(?:row|column)\b|$|\n)/i.exec(following)
      const affected = footnote && rows.filter(([name]) => references.get(name)?.includes(footnote[1]))
      if (!footnote || !affected?.length) break
      for (const [name] of affected) {
        options[name] += `${/[.!?]$/.test(options[name]) ? ' ' : '. '}${plain(footnote[2])}`
      }
      source += footnote[0]
      following = following.slice(footnote[0].length)
    }
    // Keep exact imported text so replacing a choice block cannot remove surrounding rules.
    const text = source.split(/\n\s*\n/).map(plain).filter(Boolean).join('\n\n')
    sections.push({ text, options })
  }
  return sections
}

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

export function parseAncestryAbout(md: string) {
  const body = /\*\*Source\*\*[^\n]*\n([\s\S]*)/i.exec(md)?.[1] ?? ''
  const boundary = /<title\b[^>]*>\s*You Might\b/i.exec(body)
  return plain(boundary ? body.slice(0, boundary.index) : body.split(/<\/column>|<title\b/i)[0])
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

const parseFeatMagicHacks = (md: string) => {
  const text = md.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  return [...text.matchAll(/\b(?:gain|learn) the (?!initial\b|advanced\b|greater\b)([a-z][\w'’ -]*?)\s+magic hack\b/gi)]
    .map(match => plain(match[1]))
}

// Focus spells a feat grants ("You gain the [wild shape] order spell"), spells that depend on the taker's druidic order
// ("if you're a member of the flame order, you gain [combustion]"), and whether it adds a Focus Point
export function parseFeatFocus(md: string) {
  md = md.replace(/[_*]/g, '').replace(/\[(composition)\]\([^)]*\)/gi, '$1')
  const name = (s: string) => s.replace(/^_+|_+$/g, '').trim()
  const spells = [...new Set([
    ...[...md.matchAll(/\b(?:gain|learn) the \[([^\]]+)\]\(\/?(?:Spells\.aspx|spells\/)[^)]*\)\s+(?:(?:spellshape )?(?:order|focus|devotion|domain|hex|revelation|composition|school|bloodline|amp|qi|warp) (?:spell|cantrip)|order(?=[.!?]))/gi)].map((m) => name(m[1])),
    ...[...md.matchAll(/\b(?:gain|learn) the (?:order|focus|devotion|domain|hex|revelation|composition|school|bloodline|amp|qi) spell \[([^\]]+)\]\(\/?(?:Spells\.aspx|spells\/)[^)]*\)/gi)].map((m) => name(m[1])),
    ...[...md.matchAll(/\b(?:gain|learn) the \[([^\]]+)\]\(\/?(?:Spells\.aspx|spells\/)[^)]*\)\s+magic hack\b/gi)].map((m) => name(m[1])),
    ...parseFeatMagicHacks(md),
  ])]
  const byOrder = [...md.matchAll(/member of the (\w+) order, you gain \[([^\]]+)\]\(\/?Spells\.aspx/gi)].map((m) => `${m[1].toLowerCase()}:${name(m[2])}`)
  return { spells: spells.join(', '), byOrder: byOrder.join(', '), point: /Increase the number of Focus Points in your focus pool by 1/i.test(md) }
}

// Only explicit, unconditional grants. Conditional effects and variable DC/rank rules stay in the source text.
export function parseFeatSpellGrants(md: string): SpellGrant[] {
  const body = md.split(/\n---\n/)[1]?.replace(/[_*]/g, '').replace(/\[(composition)\]\([^)]*\)/gi, '$1') ?? ''
  const headerFrequency = /^\*\*Frequency\*\*\s+((?:once|twice|\d+ times) per day)\s*$/im.exec(md.split(/\n---\n/)[0])?.[1]
  const grants: SpellGrant[] = []
  if (/\bClaim a defined territory\b/i.test(body)) {
    const territory = /Within its borders, you can cast ([^\n]+?) as innate divine cantrips\b/i.exec(body)
    if (territory) {
      const spells = [...territory[1].matchAll(/\[([^\]]+)\]\((?:https:\/\/2e\.(?:aonprd|aonsrd)\.com)?\/?(?:Spells\.aspx|spells\/)[^)]*\)/gi)]
        .map(match => match[1])
      if (spells.length) grants.push({ kind: 'innate', spells, tradition: 'divine', frequency: 'at will',
        heightened: true, condition: 'Only within your claimed territory' })
    }
  }
  const territorialDaily = /While in your territory, you can cast ([^\n]+?) as innate divine spells, each once per day\./i.exec(body)
  if (territorialDaily) {
    const spells = [...territorialDaily[1].matchAll(/\[([^\]]+)\]\((?:https:\/\/2e\.(?:aonprd|aonsrd)\.com)?\/?(?:Spells\.aspx|spells\/)[^)]*\)/gi)]
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
  const separateDaily = /You gain ([^\n]+?) as (\d+)(?:st|nd|rd|th)-rank (arcane|divine|occult|primal) innate spells\.\s*You can cast each (?:of these )?(?:(?:arcane|divine|occult|primal) )?(?:innate )?spells? once\s+per day[.,]/i.exec(body)
  if (separateDaily) {
    const spells = [...separateDaily[1].matchAll(/\[([^\]]+)\]\((?:https:\/\/2e\.(?:aonprd|aonsrd)\.com)?\/?(?:Spells\.aspx|spells\/)[^)]*\)/gi)]
      .map(match => match[1])
    if (spells.length) grants.push({ kind: 'innate', spells, rank: Number(separateDaily[2]),
      tradition: separateDaily[3], frequency: 'once per day', heightened: false, fixedRank: true, ...(ability ? { ability } : {}) })
  }
  const higherDC = /using the higher of your class DC or\s+spell DC/i.test(body)
  if ((!higherDC && /class DC|whichever is higher/i.test(body)) || /At \d+(?:st|nd|rd|th) level|if you could|if its modifier/i.test(body)) return grants
  const sentences = body.replace(/<br\s*\/?>/gi, ' ').split(/(?<=[.!?])\s+/)
  for (const [index, sentence] of sentences.entries()) {
    if (!/^(?:additionally,? )?(?:(?:(?:once|twice|\d+ times) per day|once before your next daily preparations?),? )?you (?:can cast|gain|learn)\b/i.test(sentence.trim())) continue
    const names = [...new Set([
      ...[...sentence.matchAll(/\[([^\]]+)\]\((?:https:\/\/2e\.(?:aonprd|aonsrd)\.com)?\/?(?:Spells\.aspx|spells\/)[^)]*\)/gi)]
        .map(match => plain(match[1])),
      ...parseFeatMagicHacks(sentence),
    ])]
    if (!names.length) continue
    if (/innate (?:(?:arcane|divine|occult|primal) )?(?:spell|cantrip)/i.test(sentence)) {
      if (/\b(?:if|while|unless)\b/i.test(sentence)) continue
      const tradition = /\b(arcane|divine|occult|primal)\b/i.exec(sentence)?.[1]
      const frequencies = [...sentence.matchAll(/\b(?:once|twice|\d+ times) per (?:day|hour)\b|\bat[- ]will\b|\bonce before your next daily preparations?\b/gi)]
        .map(match => /before your next daily preparations?/i.test(match[0]) ? 'once per day' : match[0])
      if (!frequencies.length && /\binnate cantrip\b/i.test(sentence) && names.length === 1) frequencies.push('at will')
      if (!frequencies.length && headerFrequency && names.length === 1
        && sentences.filter(text => /\byou can cast\b.*\binnate\b/i.test(text)).length === 1) frequencies.push(headerFrequency)
      const ranks = [...sentence.matchAll(/\b(\d+)(?:st|nd|rd|th)-(?:rank|level)\b/gi)]
      if (frequencies.length !== 1 || ranks.length > 1) continue
      const next = plain(sentences[index + 1] ?? '')
      const scales = (text: string) => /half your level,? rounded up/i.test(text)
      const shared = names.length > 1 && /\bor\b/i.test(sentence)
      const heightened = scales(sentence) || /innate cantrip/i.test(sentence)
        || scales(next) && (/^(?:This spell|Its spell rank)\b/i.test(next) && names.length === 1
          || shared && /^You choose which spell/i.test(next))
      const rule: SpellGrant = {
        kind: 'innate', spells: names, tradition, frequency: frequencies[0].toLowerCase().replace('at-will', 'at will'),
        ...(ranks[0] ? { rank: Number(ranks[0][1]) } : {}),
        heightened, shared, ...(ranks[0] ? { fixedRank: true } : {}),
        ...(ability ? { ability } : {}),
        ...(higherDC ? { dc: 'higher-class-or-spell' as const } : {}),
      }
      if (!heightened && scales(next)) {
        grants.push(...names.map(name => ({ ...rule, spells: [name], heightened: next.toLowerCase().includes(name.toLowerCase()) })))
      } else grants.push(rule)
    } else if (/(?:focus|devotion|qi|hex|order|domain|revelation|composition|grave|warp) (?:spells?|cantrips?)\b|magic hacks?\b/i.test(sentence)
      || /\byou gain the \[[^\]]+\]\(\/?Spells\.aspx[^)]*\) order\.$/i.test(sentence.trim())) {
      if (/\b(?:if|choose|depending|based on)\b/i.test(sentence) || /\bor\b/i.test(sentence) && names.length <= 1) continue
      grants.push({ kind: 'focus', spells: names, heightened: true, ...(ability ? { ability } : {}),
        ...(/\bor\b/i.test(sentence) ? { choice: 'listed' as const } : {}),
        tradition: /\bare (arcane|divine|occult|primal) spells/i.exec(body)?.[1] })
    }
  }
  return grants
}

export function parseFeatRitualGrants(md: string) {
  const body = md.split(/\n---\n/)[1] ?? ''
  return [...new Set([...body.matchAll(/\byou (?:learn|gain)\s+(?:the\s+)?\[([^\]]+)\]\((?:https:\/\/2e\.(?:aonprd|aonsrd)\.com)?\/?Rituals\.aspx[^)]*\)\s+ritual\b/gi)]
    .map(match => plain(match[1])))]
}

// Animal companion stat block: unarmed attacks as "name|damage|traits" joined by ";", plus support benefit and advanced maneuver
export function parseCompanion(md: string) {
  const attacks = [...md.matchAll(/\*\*(?:Melee|Ranged)\*\*\s*<actions[^>]*\/>\s*([^\n]*?),?\s*\n\s*\*\*Damage\*\*\s*([^\n]+)/g)].map((m) => {
    const label = plain(m[1])
    const traits = /\(([^)]*)\)/.exec(label)?.[1] ?? ''
    return `${label.replace(/\s*\([^)]*\)/, '').trim()}|${plain(m[2])}|${traits.toLowerCase()}`
  })
  const field = (name: string) => plain(new RegExp(`\\*\\*${name}\\*\\*\\s*([^\\n]+)`).exec(md)?.[1] ?? '')
  const maneuverActionId = /<document\b[^>]*\bid="action-(\d+)"/i.exec(md)?.[1]
  return {
    attacks: attacks.join(';'),
    support: field('Support Benefit'),
    maneuver: field('Advanced Maneuver'),
    maneuverActionUrl: maneuverActionId ? `/Actions.aspx?ID=${maneuverActionId}` : undefined,
  }
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
        if (category === 'armor' && system === 'sf2e' && typeof s.markdown === 'string' && s.upgrade_slots === undefined) {
          const slots = /\*\*Upgrades\*\*\s*(\d+)/i.exec(s.markdown)?.[1]
          if (slots) s.upgrade_slots = Number(slots)
        }
        if (category === 'weapon' && typeof s.markdown === 'string') {
          if (system === 'sf2e') {
            const modes = parseWeaponModes(s.markdown)
            if (modes.length > 1) s.weapon_modes = modes
            const name = String(s.name ?? '').trim().toLowerCase()
            const table = /<table>([\s\S]*?)<\/table>/gi
            for (const match of s.markdown.matchAll(table)) {
              const headers = [...match[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(cell => plain(cell[1]).toLowerCase())
              const slotColumn = headers.indexOf('upgrades')
              const levelColumn = headers.indexOf('level')
              if (slotColumn < 0) continue
              for (const row of match[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
                const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => plain(cell[1]))
                const baseName = cells[0]?.replace(/^(?:commercial|tactical|advanced|superior|elite|ultimate|paragon)\s+/i, '').toLowerCase()
                const baseGrade = baseName === name && levelColumn >= 0 && /^\d+$/.test(cells[levelColumn] ?? '')
                  && Number(cells[levelColumn]) === s.level
                if ((cells[0]?.toLowerCase() === name || baseGrade) && /^\d+$/.test(cells[slotColumn] ?? '')) {
                  s.upgrade_slots = Number(cells[slotColumn])
                  const tracking = /\btracking\s*\+(\d+)/i.exec(cells.join(' '))?.[1]
                  if (tracking) s.weapon_tracking = Number(tracking)
                  break
                }
              }
            }
            if (s.upgrade_slots === undefined) {
              const slots = /\*\*Upgrades\*\*\s*(\d+|[—–-])(?!\w)/i.exec(s.markdown)?.[1]
              if (slots) s.upgrade_slots = /^\d+$/.test(slots) ? Number(slots) : 0
            }
            if (s.weapon_tracking === undefined) {
              const tracking = /<trait\b[^>]*\blabel="Tracking\s*\+(\d+)"/i.exec(s.markdown)?.[1]
              if (tracking) s.weapon_tracking = Number(tracking)
            }
            const ammo = /\*\*(?:Ammunition|Magazine)\*\*\s*([^\n]+)/i.exec(s.markdown)?.[1]
            if (ammo) s.weapon_ammunition = plain(ammo)
          }
          const form = /\((Melee|Ranged)\)$/i.exec(String(s.name ?? ''))?.[1]
          const traits = (form
            ? new RegExp(`<title\\b[^>]*>\\s*${form}\\s*<\\/title>\\s*<traits\\b[^>]*>([\\s\\S]*?)<\\/traits>`, 'i')
              .exec(s.markdown)?.[1]
            : /<traits\b[^>]*>([\s\S]*?)<\/traits>/i.exec(s.markdown)?.[1]) ?? ''
          const range = /<trait\b[^>]*\blabel="Thrown\s+(\d+)\s*(?:ft\.?|feet)\s*"[^>]*>/i.exec(traits)?.[1]
          if (range) s.thrown_range = Number(range)
          const versatile = /<trait\b[^>]*\blabel="(Versatile\s+[BPS](?:\s*,\s*[BPS])*)"\s*[^>]*>/i.exec(traits)?.[1]
          if (versatile && Array.isArray(s.trait)) {
            s.trait = s.trait.map(trait => typeof trait === 'string' && /^versatile$/i.test(trait.trim()) ? versatile : trait)
          }
          const twoHand = /<trait\b[^>]*\blabel="(Two-Hand\s+(?:1)?d(?:4|6|8|10|12))"\s*[^>]*>/i.exec(traits)?.[1]?.replace(/\b1d/i, 'd')
          if (twoHand && Array.isArray(s.trait)) {
            s.trait = s.trait.map(trait => typeof trait === 'string' && /^two-hand$/i.test(trait.trim()) ? twoHand : trait)
          }
          for (const name of ['Boost', 'Deadly', 'Fatal', 'Fatal Aim']) {
            const label = new RegExp(`<trait\\b[^>]*\\blabel="(${name}\\s+(?:1)?d(?:4|6|8|10|12))"\\s*[^>]*>`, 'i').exec(traits)?.[1]?.replace(/\b1d/i, 'd')
            if (label && Array.isArray(s.trait)) {
              s.trait = s.trait.map(trait => typeof trait === 'string' && trait.trim().toLowerCase() === name.toLowerCase() ? label : trait)
            }
          }
        }
        // Keep full rules text for description popups and class features.
        const found = parseResistances(plain(typeof s.markdown === 'string' ? s.markdown : ''))
        if (found) s.resistances = found
        if (['feat', 'heritage'].includes(category) && typeof s.markdown === 'string') {
          const langs = parseFeatLanguages(s.markdown)
          if (langs) s.grants_languages = langs
          const focus = parseFeatFocus(s.markdown)
          if (focus.spells) s.grants_focus_spells = focus.spells
          if (focus.byOrder) s.grants_order_spells = focus.byOrder
          if (focus.point) s.grants_focus_point = 'yes'
          const text = plain(s.markdown)
          const lore = /Additional Lore feat for ([A-Z][\w' -]*? Lore)/.exec(text)?.[1]
          if (lore) s.grants_lore = lore
          const sight = /\byou(?:[^.]*?)\b(?:gain|have)\s+(darkvision|low-light vision)\b/i.exec(text)?.[1]
            ?? /\byou(?:[^.]*?)\b(?:gain|have)[^.]*,\s*(?:and\s+)?(darkvision|low-light vision)\b/i.exec(text)?.[1]
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
        if (category === 'ancestry' && typeof s.markdown === 'string') {
          const about = parseAncestryAbout(s.markdown)
          if (about) s.about = about
        }
        if (category === 'deity' && typeof s.markdown === 'string') {
          const divineSkill = /^\*\*Divine Skill\*\*[ \t]*([^\r\n]+)/mi.exec(s.markdown)?.[1]
          if (divineSkill) s.skill = plain(divineSkill).split(/\s+or\s+|,\s*/).filter(Boolean)
          s.sanctification_required = /\bDivine Sanctification\s+must choose\b/i.test(plain(s.markdown))
          const spells = parseClericSpells(s.markdown)
          if (spells) s.cleric_spells = spells
          const about = parseDeityAbout(s.markdown)
          if (about) s.about = about
        }
        if (category === 'animal-companion' && typeof s.markdown === 'string') {
          const comp = parseCompanion(s.markdown)
          const about = parseDeityAbout(s.markdown)
          if (about) s.about = about
          if (comp.attacks) s.companion_attacks = comp.attacks
          if (comp.support) s.companion_support = comp.support
          if (comp.maneuver) s.companion_maneuver = comp.maneuver
          if (comp.maneuverActionUrl) s.companion_maneuver_action_url = comp.maneuverActionUrl
        }
        if (!['feat', 'heritage', 'background', 'spell', 'trait', 'class-feature', 'armor-group', 'weapon-group', 'animal-companion-specialization', 'animal-companion-advanced', 'familiar-ability', 'familiar-specific'].includes(category) && !SUBCLASS_CLASSES[category]
          && !usesFullItemRules(s)) delete s.markdown
      }
      hits.push(hit)
    }
    onProgress?.(hits.length)
  }
  const deities = hits.flatMap(hit => {
    const source = hit._source
    return system === 'pf2e' && source?.category === 'deity' && !source.alignment && Array.isArray(source.legacy_id)
      ? [{ source, ids: source.legacy_id.filter((id): id is string => typeof id === 'string') }] : []
  })
  const legacyIds = [...new Set(deities.flatMap(deity => deity.ids))]
  if (legacyIds.length) {
    const response = await fetchFn(AON_ENDPOINTS[system], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: legacyIds.length, query: { ids: { values: legacyIds } }, _source: ['alignment'] }),
    })
    if (!response.ok) throw new Error(`AoN legacy deity alignments: HTTP ${response.status}`)
    const json = (await response.json()) as { hits?: { hits?: Hit[] } }
    const alignments = new Map((json.hits?.hits ?? []).flatMap(hit =>
      hit._id && typeof hit._source?.alignment === 'string' ? [[hit._id, hit._source.alignment] as const] : []))
    for (const { source, ids } of deities) {
      const values = [...new Set(ids.map(id => alignments.get(id)))]
      if (values.length === 1 && values[0]) source.alignment = values[0]
    }
  }
  const maneuverUrls = [...new Set(hits.flatMap(hit => {
    const source = hit._source
    return source?.category === 'animal-companion' && typeof source.companion_maneuver_action_url === 'string'
      ? [source.companion_maneuver_action_url] : []
  }))]
  if (maneuverUrls.length) {
    const response = await fetchFn(AON_ENDPOINTS[system], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        size: maneuverUrls.length,
        query: { bool: { filter: [{ term: { category: 'action' } }, { terms: { url: maneuverUrls } }] } },
        _source: ['url', 'actions', 'trait', 'requirements', 'markdown'],
      }),
    })
    if (!response.ok) throw new Error(`AoN companion maneuvers: HTTP ${response.status}`)
    const json = (await response.json()) as { hits?: { hits?: Hit[] } }
    const actions = new Map<string, Record<string, unknown>>()
    for (const hit of json.hits?.hits ?? []) {
      const source = hit._source
      if (typeof source?.url === 'string') actions.set(source.url.toLowerCase(), source)
    }
    for (const hit of hits) {
      const source = hit._source
      const url = source?.companion_maneuver_action_url
      const action = typeof url === 'string' ? actions.get(url.toLowerCase()) : undefined
      if (!source || !action) continue
      if (typeof action.actions === 'string') source.companion_maneuver_actions = action.actions
      const traits = Array.isArray(action.trait)
        ? action.trait.filter((trait): trait is string => typeof trait === 'string').join(', ')
        : typeof action.trait === 'string' ? action.trait : ''
      if (traits) source.companion_maneuver_traits = traits
      const markdown = typeof action.markdown === 'string' ? action.markdown : ''
      const requirements = typeof action.requirements === 'string'
        ? plain(action.requirements)
        : plain(/\*\*Requirements\*\*\s*([^\n]+)/i.exec(markdown)?.[1] ?? '')
      if (requirements) source.companion_maneuver_requirements = requirements
      const sections = markdown.split(/\n---\n/)
      const body = sections[sections.length - 1]?.trim() ?? ''
      const description = plain((body || markdown).replace(/^\*\*Requirements\*\*[^\n]*\n?/i, ''))
      if (description) source.companion_maneuver_description = description
    }
  }
  return hits
}
