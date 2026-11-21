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

function heritageMovementSpeeds(markdown: string, rawSpeed: unknown): Record<string, number | string> {
  const parsed: Record<string, number | string> = {}
  const modes = ['land', 'climb', 'swim', 'fly', 'burrow'] as const
  const speeds = rawSpeed && typeof rawSpeed === 'object' ? rawSpeed as Record<string, unknown> : {}
  for (const mode of modes) {
    const raw = speeds[mode]
    if (typeof raw === 'number' && raw > 0) parsed[`speed_${mode}`] = raw
  }

  const sentences = plain(markdown).split(/(?<=[.!?])\s+/)
  for (const sentence of sentences) {
    if (/\b(?:if|when|while|unless|only if|only while)\b/i.test(sentence)) continue
    for (const mode of modes.slice(1)) {
      const fixed = new RegExp(`\\b(\\d+)[- ]foot\\s+${mode}\\s+Speed\\b|\\b${mode}\\s+Speed\\s+(?:of\\s+|equal to\\s+)?(\\d+)\\s+feet\\b|\\b${mode}\\s+Speed\\s+(?:increases?|improves?|becomes?)\\s+(?:to\\s+)?(\\d+)\\s+feet\\b|\\b(?:increase|improve) your ${mode} Speed to (\\d+) feet\\b`, 'i')
        .exec(sentence)
      const feet = fixed && Number(fixed.slice(1).find(Boolean))
      if (feet) parsed[`speed_${mode}`] = Math.max(Number(parsed[`speed_${mode}`]) || 0, feet)
      else if (new RegExp(`\\b${mode}\\s+Speed\\s+equal to\\s+(?:your\\s+)?(?:base\\s+)?(?:land\\s+)?Speed\\b`, 'i').test(sentence)) {
        parsed[`speed_${mode}`] = 'land'
      }
    }

    const land = /\b(?:your\s+)?(?:land\s+)?Speed\s+(?:is|becomes|of)\s+(\d+)\s+feet\b/i.exec(sentence)?.[1]
      ?? /\b(?:your\s+)?land Speed\s+(?:increases?|improves?)\s+to\s+(\d+)\s+feet\b/i.exec(sentence)?.[1]
    if (land) parsed.speed_land = Number(land)
    const adjustment = /\b(?:your\s+)?land Speed\s+(?:is\s+)?(reduced|increased)\s+by\s+(\d+)\s+feet(?:\s*\(to\s*(\d+)\s+feet[^)]*\))?/i.exec(sentence)
    if (adjustment) {
      if (adjustment[3]) parsed.speed_land = Number(adjustment[3])
      else parsed.speed_land_adjustment = (adjustment[1].toLowerCase() === 'reduced' ? -1 : 1) * Number(adjustment[2])
    }
  }
  return parsed
}

function heritageSkillGrant(markdown: string) {
  const skills = ['Acrobatics', 'Arcana', 'Athletics', 'Crafting', 'Deception', 'Diplomacy', 'Intimidation',
    'Medicine', 'Nature', 'Occultism', 'Performance', 'Religion', 'Society', 'Stealth', 'Survival',
    'Thievery', 'Computers', 'Piloting']
  const match = new RegExp(`\\byou\\s+(?:also\\s+)?(?:become|are)\\s+trained\\s+in\\s+(${skills.join('|')})(\\s+Lore)?\\b`, 'i')
    .exec(plain(markdown))
  const skill = match && skills.find(name => name.toLowerCase() === match[1].toLowerCase())
  return skill ? `${skill}${match?.[2] ? ' Lore' : ''}` : undefined
}

function heritageFeatGrants(markdown: string) {
  const choiceFeats = new Set([
    'Adopted Ancestry', 'Ancestral Cantrip', 'Assurance', 'Religious Talisman',
    'Specialty Crafting',
  ])
  const grants = new Set<string>()
  for (const match of markdown.matchAll(/\b(?:gain|gains|receive|receives)\s+(?:the|a|an)?\s*\[([^\]]+)\]\((?:\/Feats\.aspx|\/feats\/)[^)]*\)/gi)) {
    const start = Math.max(markdown.lastIndexOf('.', match.index), markdown.lastIndexOf(';', match.index),
      markdown.lastIndexOf('!', match.index))
    const prefix = plain(markdown.slice(start + 1, match.index!))
    const tail = plain(markdown.slice(match.index! + match[0].length)).split(/[.!?]/, 1)[0]
    if (/\b(?:if|when|while|unless)\b/i.test(`${prefix} ${tail}`)) continue
    if (!/\b(?:skill |general |ancestry |class )?feat\b/i.test(tail)) continue
    const name = plain(match[1]).trim()
    if (name && !choiceFeats.has(name) && !/^Ancestral Unarmed Attack\b/i.test(name)) grants.add(name)
  }
  return [...grants]
}

function heritageSize(markdown: string) {
  for (const sentence of plain(markdown).split(/(?<=[.!?])\s+/)) {
    if (/\b(?:if|when|while|unless)\b/i.test(sentence)) continue
    const match = /\b(?:your size is|you are)\s+(Tiny|Small|Medium|Large|Huge)\b/i.exec(sentence)
    if (match) return match[1][0].toUpperCase() + match[1].slice(1).toLowerCase()
  }
  return undefined
}

function heritageLanguageRules(markdown: string) {
  const text = plain(markdown)
  const languages = new Set<string>()
  for (const match of text.matchAll(/\byou\s+(?:can\s+)?speak\s+([A-Z][A-Za-z-]*)\b/gi)) languages.add(match[1])
  for (const match of text.matchAll(/\byou\s+learn\s+(?:the\s+)?([A-Z][A-Za-z-]*)\s+(?:language|as an additional language)\b/gi)) {
    languages.add(match[1])
  }
  const choices = new Map<number, number>()
  const addChoice = (level: number, count: number) => choices.set(level, (choices.get(level) ?? 0) + count)
  const counts: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 }
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (/\b(?:if|when|while|unless)\b/i.test(sentence)) continue
    for (const match of sentence.matchAll(/\byou\s+(?:learn|know)\s+(a|an|one|two|three|four|five)\s+(?:new\s+|additional\s+|bonus\s+)?languages?\b/gi)) {
      addChoice(1, counts[match[1].toLowerCase()])
    }
  }
  const choiceLanguages = text.match(/\byou\s+learn\s+any\s+(?:regional\s+)?language\s+of\s+your\s+choice\b/gi) ?? []
  if (choiceLanguages.length) addChoice(1, choiceLanguages.length)
  for (const match of text.matchAll(/\byou\s+learn\s+another\s+(?:regional\s+)?language\b[^.]*?\bat\s+(\d+)(?:st|nd|rd|th)\s+level\b/gi)) {
    addChoice(Number(match[1]), 1)
  }
  for (const match of text.matchAll(/\band\s+again\s+at\s+(\d+)(?:st|nd|rd|th)\s+level\b/gi)) {
    addChoice(Number(match[1]), 1)
  }
  return {
    ...(languages.size ? { grants_languages: [...languages].join(', ') } : {}),
    ...(choices.size ? { grants_language_slots: [...choices].sort(([a], [b]) => a - b).map(([level, count]) => `${level}:${count}`).join(';') } : {}),
  }
}

function heritageResistances(markdown: string) {
  const damageTypes = new Set([
    'acid', 'bludgeoning', 'cold', 'electricity', 'fire', 'force', 'mental', 'negative', 'poison',
    'piercing', 'precision', 'slashing', 'sonic', 'spirit', 'vitality', 'void', 'radiation', 'physical',
  ])
  const grants = new Set<string>()
  for (const sentence of plain(markdown).split(/(?<=[.!?])\s+/)) {
    const patterns = [
      /\b(?:gain|gains|have|has|gives you)\s+([a-z][a-z -]*?)\s+resistance equal to half your level\b/gi,
      /\b(?:gain|gains|have|has|gives you)\s+resistance to ([a-z][a-z -]*?) equal to half your level\b/gi,
    ]
    for (const pattern of patterns) {
      for (const match of sentence.matchAll(pattern)) {
        if (/\b(?:if|when|while|unless)\b/i.test(sentence.slice(0, match.index))) continue
        const damage = match[1].toLowerCase().replace(/\s+damage$/, '').trim()
        if (damageTypes.has(damage)) grants.add(`${damage}=half`)
      }
    }
  }
  return [...grants]
}

function heritageAttackEntries(heritage: ContentEntry, markdown: string): ContentEntry[] {
  if (heritage.name === 'Fork-Tongued Vesk') return []
  const sentences = plain(markdown).split(/(?<=[.!?])\s+/)
  const entries: ContentEntry[] = []
  const damageTypes = 'acid|bludgeoning|cold|electricity|fire|force|mental|negative|piercing|poison|slashing|sonic|spirit|vitality|void'
  const addAttack = (attackName: string, dice: string, damageType: string, group: string, traits: string[], ranged: boolean, range: number, description: string) => {
    const name = `${heritage.name} ${attackName.replace(/\b\w/g, value => value.toUpperCase())}`
    const id = `${heritage.id}:attack:${attackName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    if (entries.some(entry => entry.id === id)) return
    const weaponTraits = [...new Set(traits.map(trait => trait[0].toUpperCase() + trait.slice(1).toLowerCase()))]
    if (!weaponTraits.some(trait => trait.toLowerCase() === 'unarmed')) weaponTraits.push('Unarmed')
    entries.push({
      id,
      systems: heritage.systems,
      kind: 'weapon',
      source: 'official',
      name,
      level: heritage.level,
      traits: weaponTraits,
      description,
      data: {
        weapon_category: 'Unarmed',
        weapon_type: ranged ? 'Ranged' : 'Melee',
        weapon_group: group[0].toUpperCase() + group.slice(1),
        hands: 0,
        damage: `${dice} ${damageType}`,
        ...(range ? { range, range_increment: range } : {}),
        granted_by_heritage: heritage.name,
      },
      effects: [],
      updatedAt: heritage.updatedAt,
    })
  }
  for (const sentence of sentences) {
    const match = /\byou\s+(?:gain|have)\s+(?:a|an)\s+([a-z][a-z -]*?)\s+(?:(ranged|melee)\s+)?unarmed attack\b/i.exec(sentence)
    if (!match || /\b(?:if|when|while|unless)\b/i.test(sentence)) continue
    const damage = new RegExp(`\\bdeals?\\s+(\\d+d\\d+)\\s+(${damageTypes})\\s+damage\\b`, 'i').exec(sentence)
    if (!damage) continue
    const attackName = match[1].trim()
    const finalWord = attackName.split(/\s+/).pop()!
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const traitSentence = sentences.find(value => new RegExp(
      `\\b(?:your|the)\\s+${escape(finalWord)}s?\\s+(?:are|is)\\s+in\\s+the\\s+[a-z -]+\\s+group\\s+and\\s+have\\s+the\\s+[^.]+\\s+traits?\\b`, 'i',
    ).test(value))
    const group = /\bin the ([a-z -]+?) weapon group\b/i.exec(sentence)?.[1]
      ?? (traitSentence && /\bin the ([a-z -]+?) group\b/i.exec(traitSentence)?.[1])
      ?? 'Brawling'
    const directTraits = /\b(?:with|has|have)\s+(?:the\s+)?([a-z ,]+?)\s+traits?\b/i.exec(sentence)?.[1] ?? ''
    const secondaryTraits = traitSentence
      ? /\bhave the ([^.]+?) traits?\b/i.exec(traitSentence)?.[1] ?? '' : ''
    const traits = [...new Set([directTraits, secondaryTraits]
      .flatMap(value => value.split(/,\s*|\s+and\s+/i))
      .map(value => value.trim()).filter(Boolean))]
    const range = Number(/\brange increment(?: of)?\s+(\d+)\s+feet\b/i.exec(sentence)?.[1] ?? 0)
    addAttack(attackName, damage[1], damage[2], group, traits,
      match[2]?.toLowerCase() === 'ranged' || range > 0, range, sentence)
  }
  const standardized = /Ancestral Unarmed Attack\s*\(([^)]+)\)\s+standardized ancestry feat/i.exec(plain(markdown))?.[1]
  if (standardized) {
    const attackName = standardized.split(',', 1)[0].trim()
    const damage = new RegExp(`\\b(\\d+d\\d+)\\s+(${damageTypes})\\b`, 'i').exec(standardized)
    if (attackName && damage) {
      const group = /\b([a-z -]+?) weapon group\b/i.exec(standardized)?.[1] ?? 'Brawling'
      const traits = /\[([^\]]+)\]/.exec(standardized)?.[1].split(/,\s*|\s+and\s+/i).map(trait => trait.trim()) ?? []
      const range = Number(/\brange increment\s*(?:of)?\s*(\d+)\s+feet\b/i.exec(standardized)?.[1] ?? 0)
      addAttack(attackName, damage[1], damage[2], group, traits, range > 0, range, standardized)
    }
  }
  return entries
}

function heritageSenseGrant(markdown: string) {
  const match = /\byou\s+(?:also\s+)?(?:gain|have)\s+(precise|imprecise)\s+(scent|tremorsense|wavesense)(?:\s+with)?(?:\s+(?:a\s+)?range)?\s+of\s+(\d+)\s+feet/i
    .exec(plain(markdown))
  if (!match) return undefined
  return `${match[2][0].toUpperCase()}${match[2].slice(1)} (${match[1]}) ${match[3]} feet`
}

function heritageAttributeRules(markdown: string): Record<string, string> {
  const text = plain(markdown)
  const abilities = 'Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma'
  const rules: Record<string, string> = {}
  const override = new RegExp(`instead of the normal attribute boosts, you can choose to gain ([^.]+)`, 'i').exec(text)?.[1]
  if (override) {
    const boosts = [...override.matchAll(new RegExp(`boost to (${abilities})`, 'gi'))].map(match => match[1])
    if (/\bfree boost\b/i.test(override)) boosts.push('Free')
    const flaw = new RegExp(`flaw (?:in|to) (${abilities})`, 'i').exec(override)?.[1]
    if (boosts.length) rules.heritage_ability_boosts_override = boosts.join(', ')
    if (flaw) rules.heritage_ability_flaws_override = flaw
    return rules
  }

  const boostSwaps: string[] = []
  for (const match of text.matchAll(new RegExp(`(?:attribute )?boost to (${abilities}) instead of (${abilities})`, 'gi'))) {
    boostSwaps.push(`${match[2]}:${match[1]}`)
  }
  const flawSwaps: string[] = []
  for (const match of text.matchAll(new RegExp(`(?:attribute )?flaw to (${abilities}) instead of (${abilities})`, 'gi'))) {
    flawSwaps.push(`${match[2]}:${match[1]}`)
  }
  const omittedFlaw = new RegExp(`don't gain (?:the )?attribute flaw to (${abilities}) but instead gain (?:an )?flaw to (${abilities})`, 'i').exec(text)
  if (omittedFlaw) flawSwaps.push(`${omittedFlaw[1]}:${omittedFlaw[2]}`)
  const reverse = new RegExp(`attribute (?:bonus|boost) to (${abilities}) and a flaw to (${abilities}) rather than the other way around`, 'i').exec(text)
  if (reverse) {
    boostSwaps.push(`${reverse[2]}:${reverse[1]}`)
    flawSwaps.push(`${reverse[1]}:${reverse[2]}`)
  }
  if (boostSwaps.length) rules.heritage_ability_boost_swaps = boostSwaps.join(';')
  if (flawSwaps.length) rules.heritage_ability_flaw_swaps = flawSwaps.join(';')

  const extraBoosts = [...text.matchAll(new RegExp(`gain an attribute boost to (${abilities})`, 'gi'))]
    .filter(match => !/\binstead of\b/i.test(text.slice(match.index, match.index + match[0].length + 80)))
    .map(match => match[1])
  const extraFlaws = [...text.matchAll(new RegExp(`attribute flaw to (${abilities})`, 'gi'))]
    .filter(match => !/\binstead of\b/i.test(text.slice(match.index, match.index + match[0].length + 80))
      && !/\bdon't gain\b/i.test(text.slice(Math.max(0, match.index - 50), match.index)))
    .map(match => match[1])
  if (extraBoosts.length) rules.heritage_ability_boosts = [...new Set(extraBoosts)].join(', ')
  if (extraFlaws.length) rules.heritage_ability_flaws = [...new Set(extraFlaws)].join(', ')
  const exclusion = new RegExp(`free ancestry boost can(?:'|’)t also be (${abilities})`, 'i').exec(text)?.[1]
  if (exclusion) rules.heritage_free_boost_exclusions = exclusion
  return rules
}

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
  if (kind === 'heritage') {
    Object.assign(data, heritageMovementSpeeds(text(s.markdown), s.speed))
    Object.assign(data, heritageAttributeRules(text(s.markdown)))
    Object.assign(data, heritageLanguageRules(text(s.markdown)))
    const size = heritageSize(text(s.markdown))
    if (size) data.size = size
    const resistances = heritageResistances(text(s.markdown))
    if (resistances.length) {
      const existing = typeof data.resistances === 'string' ? data.resistances.split(',').map(value => value.trim()) : []
      const existingDamage = new Set(existing.map(value => value.split('=')[0].trim().toLowerCase()))
      data.resistances = [...existing, ...resistances.filter(value => !existingDamage.has(value.split('=')[0]))].join(',')
    }
    const feats = heritageFeatGrants(text(s.markdown))
    if (feats.length) data.grants_heritage_feats = feats.join(';')
    const skill = heritageSkillGrant(text(s.markdown))
    if (skill) data.grants_skill = skill
    const sense = heritageSenseGrant(text(s.markdown))
    if (sense) data.grants_senses = sense
  }
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
    else {
      entries.push(adjusted)
      if (adjusted.kind === 'heritage') entries.push(...heritageAttackEntries(adjusted, text(h._source?.markdown)))
    }
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
