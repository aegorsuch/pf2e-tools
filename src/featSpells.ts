import { INITIATE_TRAINING, ancestryFeatTraits, featTakenLevel, selectedFeatEntry } from './featChoices'
import type { Character, ContentEntry, SpellGrant } from './types'
import { warmaskSource } from './warmask'
import { characterHeritages } from './heritages'
import { divineBoonSpells } from './divineIntercessions'
import { getSettings } from './settings'
import { cantripOptions } from './minorMagic'
import { GODCLAW_DOMAINS, hellknightTrainingBenefit, hellknightTrainingSpellRules } from './hellknight'
import { spellAccessGranted } from './featAccess'

export const DOMAIN_FEATS = ['Domain Initiate', "Deity's Domain", 'Advanced Domain', "Advanced Deity's Domain"]
export const KITSUNE_SPELL_FAMILIARITY_CANTRIPS = ['Daze', 'Forbidding Ward', 'Ghost Sound']
export const EXTRAPLANAR_SUPPLICATION_SPELLS = ['Bane', 'Bless']
export const automaticFeatChoiceKey = (source: string, feat: string, instance?: string) =>
  JSON.stringify(instance === undefined ? [source, feat] : [source, feat, instance])
const PSYCHIC_FEAT_SPELLS: Record<string, { names: string[]; tradition: string; rank: number }> = {
  'Lush Psychic': { names: ['Cellular Stimulant', 'Gentle Landing'], tradition: 'primal', rank: 1 },
  'Psychic Investigator': { names: ['Hypercognition', 'Mind Reading'], tradition: 'occult', rank: 3 },
  'Tectonic Psychic': { names: ['Wall of Fire', 'Burstmoji'], tradition: 'primal', rank: 7 },
}
const FIENDISH_MAGIC_SPELLS: Record<string, string[]> = {
  Grimspawn: ['False Vitality', 'See the Unseen'],
  Pitborn: ['Paranoia', 'Shatter'],
  Hellspawn: ['Invisibility', 'Disguise Magic'],
}

function fiendishMagicSpells(c: Character) {
  if (!c.systems.includes('pf2e')) return []
  return [...new Set(c.feats.filter(feat => featTakenLevel(feat) <= c.level)
    .flatMap(feat => FIENDISH_MAGIC_SPELLS[feat.name] ?? []))]
}

const domainSpellCache = new WeakMap<ContentEntry[], ContentEntry[]>()
export function domainFeatSpells(c: Character, entries: ContentEntry[], featName: string, domain: string) {
  let spells = domainSpellCache.get(entries)
  if (!spells) {
    spells = entries.filter(entry => entry.kind === 'spell' && !entry.deleted && entry.traits.includes('Focus')
      && (entry.level === 1 || entry.level === 4) && typeof entry.data.domain === 'string')
    domainSpellCache.set(entries, spells)
  }
  return spells.filter(spell => spell.systems.some(system => c.systems.includes(system))
    && spell.level === (featName.startsWith('Advanced') ? 4 : 1)
    && String(spell.data.domain).split(',').some(value => value.trim().toLowerCase() === domain.trim().toLowerCase()))
}

export function domainSpellDescription(c: Character, entries: ContentEntry[], featName: string, domain: string) {
  const spells = domainFeatSpells(c, entries, featName, domain)
  return spells.length ? `${domain} domain grants focus spell${spells.length === 1 ? '' : 's'}: ${spells.map(spell =>
    `${spell.name}: ${spell.description || 'Spell description unavailable; sync Archives of Nethys content to load it.'}`).join(' ')}`
    : 'Domain spell data unavailable. Sync Archives of Nethys content to load it.'
}

export function refocusRecovery(c: Character, entries: ContentEntry[], capacity: number, spent: number) {
  let recovery = 1
  for (const feat of c.feats.filter(feat => featTakenLevel(feat) <= c.level)) {
    const text = entries.find(entry => entry.kind === 'feat' && !entry.deleted && entry.name === feat.name
      && entry.systems.some(system => c.systems.includes(system)))?.description ?? ''
    if (/(?:When|Whenever) you Refocus, you (?:regain|recover) all your Focus Points|Whenever you Refocus, completely refill your focus pool/i.test(text)) {
      recovery = capacity
    }
    const conditional = /spent at least ([23]) Focus Points since the last time you Refocused/i.exec(text)
    const amount = /(?:recover|regain) ([23]) Focus Points when you Refocus instead of 1/i.exec(text)
    if (conditional && amount && (c.focusPointsSpentSinceRefocus ?? spent) >= Number(conditional[1])) {
      recovery = Math.max(recovery, Number(amount[1]))
    }
  }
  return Math.min(capacity, recovery)
}

const spellAlias = (name: string) => name.toLowerCase() === 'pass without trace' ? 'vanishing tracks'
  : name.toLowerCase() === 'goodberry' ? 'cornucopia'
    : name.toLowerCase() === 'phantom steed' ? 'marvelous mount' : name.toLowerCase()
const matchesSpell = (spell: ContentEntry, name: string) => spell.name.toLowerCase() === name.toLowerCase()
  || spell.name.toLowerCase() === spellAlias(name)

export function activeCaypinAlly(c: Character) {
  return !!c.creatureAllyActive && c.systems.includes('sf2e') && c.ancestry === 'Vesk'
    && c.feats.some(feat => feat.name === 'Creature Ally' && feat.choice === 'Summon Animal' && featTakenLevel(feat) <= c.level)
}

export function activeLashuntaAlly(c: Character) {
  return c.systems.includes('sf2e') && c.ancestry === 'Lashunta'
    && c.feats.some(feat => feat.name === 'Creature Ally' && featTakenLevel(feat) <= c.level)
    ? c.lashuntaCreatureAlly : undefined
}

const hasUntamedForm = (c: Character) =>
  c.feats.some(feat => feat.name === 'Untamed Form' && featTakenLevel(feat) <= c.level)
  || !!c.spells?.some(spell => spell.name === 'Untamed Form')

function highestDruidSlotRank(c: Character) {
  if (c.className === 'Druid') return Math.min(10, Math.ceil(c.level / 2))
  const has = (name: string) => c.feats.some(feat => feat.name === name && featTakenLevel(feat) <= c.level)
  if (!has('Basic Druid Spellcasting')) return undefined
  const basic = Math.min(3, Math.max(0, Math.floor(c.level / 2) - 1))
  if (!has('Expert Druid Spellcasting')) return basic
  const expert = Math.min(6, Math.max(0, Math.floor(c.level / 2) - 2))
  return has('Master Druid Spellcasting') ? Math.min(8, expert + Math.max(0, Math.floor((c.level - 16) / 2))) : expert
}

const spellIndexes = new WeakMap<ContentEntry[], { spells: ContentEntry[]; named: Map<string, ContentEntry[]> }>()
function spellIndex(entries: ContentEntry[]) {
  let index = spellIndexes.get(entries)
  if (!index) {
    const spells = entries.filter(entry => entry.kind === 'spell' && !entry.deleted)
    const named = new Map<string, ContentEntry[]>()
    for (const spell of spells) {
      const name = spell.name.toLowerCase()
      const variants = named.get(name) ?? []
      variants.push(spell)
      named.set(name, variants)
    }
    index = { spells, named }
    spellIndexes.set(entries, index)
  }
  return index
}

function matchingSpells(entries: ContentEntry[], name: string) {
  const named = spellIndex(entries).named
  const normalized = name.toLowerCase()
  const alias = spellAlias(name)
  const exact = named.get(normalized) ?? []
  return alias === normalized ? exact : [...exact, ...(named.get(alias) ?? [])]
}

function ancestralOptions(c: Character, source?: ContentEntry) {
  const options = /Option\(s\):\s*([^\n]*)/i.exec(source?.description ?? '')?.[1]
  if (!options) return undefined
  const restriction = /^\[([^\]]+?) heritage only\]\s*/i.exec(options)
  if (!restriction) return options
  const heritage = c.heritage?.trim().toLowerCase() ?? ''
  const required = restriction[1].trim().toLowerCase()
  if (heritage !== required && !heritage.startsWith(`${required} `)) return undefined
  return options.slice(restriction[0].length)
}

function featSource(c: Character, entries: ContentEntry[], name: string, sourceId?: string) {
  if (name === 'Ancestral Magic' || name === 'Ancestral Cantrip') {
    const source = selectedFeatEntry(c, entries, name, sourceId)
    return source && ancestralOptions(c, source)
      && source.traits.some(trait => ancestryFeatTraits(c).includes(trait.toLowerCase())) ? source : undefined
  }
  return selectedFeatEntry(c, entries, name, sourceId)
}

function ancestralCantripRules(c: Character, entries: ContentEntry[], sourceId?: string) {
  const source = featSource(c, entries, 'Ancestral Cantrip', sourceId)
  const options = ancestralOptions(c, source)
  if (!options) return undefined
  const parts = options.split(';').map(part => part.trim())
  if (parts.some(part => /shiny heritage only/i.test(part)) && !/\bshiny\b/i.test(c.heritage ?? '')) return undefined
  const tradition = parts.find(part => /^(arcane|divine|occult|primal)$/i.test(part))
  const spells = parts.at(-1)?.split(/\s*,\s*(?:or\s+)?|\s+or\s+/i).map(name => name.trim().replace(/[.)]+$/, '')).filter(Boolean) ?? []
  return spells.length ? { tradition, spells, any: /^any (?:arcane|divine|occult|primal) cantrip$/i.test(spells[0]) } : undefined
}

export function fixedAncestralCantrip(c: Character, entries: ContentEntry[], sourceId?: string) {
  const rules = ancestralCantripRules(c, entries, sourceId)
  return rules && !rules.any && rules.spells.length === 1 ? rules.spells[0] : undefined
}

function ancestralMagicRules(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  const source = featSource(c, entries, 'Ancestral Magic', feat.sourceId)
  const options = /^(arcane|divine|occult|primal)\s*;([^\n]*)/i.exec(ancestralOptions(c, source) ?? '')
  if (!options) return undefined
  const level = featTakenLevel(feat)
  const rank = level >= 17 ? 7 : level >= 13 ? 5 : level >= 9 ? 3 : 1
  const used = new Set(c.feats.filter(other => other.name === feat.name
    && (feat.slot ? other.slot !== feat.slot : other !== feat)).flatMap(other => other.choice ? [other.choice.toLowerCase()] : []))
  const spells = [...options[2].matchAll(/(?:^|;)\s*(\d+)(?:st|nd|rd|th)\s+([^;]+)/gi)]
    .filter(match => Number(match[1]) <= rank)
    .flatMap(match => match[2].split(',').map(name => name.trim().replace(/[.)]+$/, '')).filter(Boolean))
    .filter(name => !used.has(name.toLowerCase()))
  return { tradition: options[1], rank, spells }
}

export function ancestralMagicAvailable(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  return !!ancestralMagicRules(c, entries, feat)?.spells.length
}

export function widespreadFascinationOptions(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  if (c.className !== 'Necromancer' || !c.systems.includes('pf2e')) return []
  const used = new Set([c.subclass, ...c.feats.filter(other => other.name === 'Widespread Fascination'
    && featTakenLevel(other) <= c.level
    && (feat.slot ? other.slot !== feat.slot : other !== feat)).map(other => other.choice)])
  return entries.filter(entry => entry.kind === 'subclass' && !entry.deleted && entry.systems.includes('pf2e')
    && entry.data.class === 'Necromancer' && typeof entry.data.grants_focus_spells === 'string'
    && !used.has(entry.name) && !used.has(entry.data.grants_focus_spells))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const WITCH_LESSON_RANKS: Record<string, number> = { 'Basic Lesson': 1, 'Greater Lesson': 3, 'Major Lesson': 5 }

export function witchLessonOptions(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  const maxRank = WITCH_LESSON_RANKS[feat.name]
  if (!maxRank || c.className !== 'Witch' || !c.systems.includes('pf2e')) return []
  const used = new Set(c.feats.filter(other => other.name in WITCH_LESSON_RANKS && featTakenLevel(other) <= c.level
    && (feat.slot ? other.slot !== feat.slot : other !== feat)).flatMap(other => other.choice ? [other.choice.toLowerCase()] : []))
  return spellIndex(entries).spells.filter(spell => spell.kind === 'spell' && !spell.deleted && spell.systems.includes('pf2e')
    && typeof spell.data.witch_lesson === 'string' && spell.traits.some(trait => trait.toLowerCase() === 'hex')
    && spell.level <= maxRank && !used.has(spell.name.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function featSpellOptions(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  if (feat.name in WITCH_LESSON_RANKS) return witchLessonOptions(c, entries, feat)
  if (feat.name === 'Psychic Talent' && c.systems.includes('sf2e')) {
    return spellIndex(entries).spells.filter(spell => spell.systems.includes('sf2e')
      && spell.traits.some(trait => /^cantrip$/i.test(trait))
      && !spell.traits.some(trait => /^focus$/i.test(trait))
      && String(spell.data.tradition ?? '').split(',').some(tradition => /^occult$/i.test(tradition.trim()))
      && spellAccessGranted(c, spell))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (['Psychic Mastery', 'Psychic Paragon'].includes(feat.name) && c.systems.includes('sf2e')) {
    const rank = feat.name === 'Psychic Mastery' ? 2 : 6
    return spellIndex(entries).spells.filter(spell => spell.systems.includes('sf2e') && spell.level === rank
      && !spell.traits.some(trait => /^(?:cantrip|focus|uncommon|rare|unique)$/i.test(trait))
      && !/^(?:uncommon|rare|unique)$/i.test(String(spell.data.rarity ?? ''))
      && String(spell.data.tradition ?? '').split(',').some(tradition => /^occult$/i.test(tradition.trim()))
      && spellAccessGranted(c, spell))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Kitsune Spell Familiarity' && c.systems.includes('pf2e')) {
    return spellIndex(entries).spells.filter(spell => spell.systems.includes('pf2e')
      && KITSUNE_SPELL_FAMILIARITY_CANTRIPS.includes(spell.name)
      && spell.traits.some(trait => trait.toLowerCase() === 'cantrip')
      && String(spell.data.tradition ?? '').toLowerCase().split(/,\s*/).includes('divine'))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Widespread Fascination' && c.className === 'Necromancer' && c.systems.includes('pf2e')) {
    const names = new Set(widespreadFascinationOptions(c, entries, feat).map(entry => entry.data.grants_focus_spells))
    return spellIndex(entries).spells.filter(spell => spell.systems.includes('pf2e')
      && spell.level === 1 && spell.traits.some(trait => trait.toLowerCase() === 'focus')
      && spell.traits.some(trait => trait.toLowerCase() === 'necromancer')
      && !spell.traits.some(trait => trait.toLowerCase() === 'cantrip')
      && names.has(spell.name))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Bone Magic') {
    return spellIndex(entries).spells.filter(spell => spell.systems.some(system => c.systems.includes(system))
      && spell.traits.some(trait => trait.toLowerCase() === 'cantrip')
      && ['occult', 'primal'].some(tradition => String(spell.data.tradition ?? '').toLowerCase().split(/,\s*/).includes(tradition))
      && !spell.traits.some(trait => /^(uncommon|rare|unique|focus)$/i.test(trait)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Mask of Power') {
    return spellIndex(entries).spells.filter(spell => spell.kind === 'spell' && !spell.deleted
      && spell.systems.some(system => c.systems.includes(system))
      && ['Fear', 'Phantom Pain', 'True Strike', 'Sure Strike'].includes(spell.name))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Creature Ally' || feat.name === 'Creature Shape') {
    if (c.systems.includes('sf2e') && c.ancestry === 'Lashunta') return undefined
    const trait = feat.name === 'Creature Ally' ? 'summon' : 'polymorph'
    return spellIndex(entries).spells.filter(spell => spell.kind === 'spell' && !spell.deleted
      && spell.systems.some(system => c.systems.includes(system))
      && spell.traits.some(value => value.toLowerCase() === trait)
      && !spell.traits.some(value => /^(uncommon|rare|unique|focus|cantrip)$/i.test(value))
      && !/^(uncommon|rare|unique)$/i.test(String(spell.data.rarity ?? ''))
      && (trait === 'summon' ? spell.level <= 5 : /battle form/i.test(spell.description ?? '')))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Touch of the Sea') {
    return spellIndex(entries).spells.filter(spell => spell.kind === 'spell' && !spell.deleted
      && spell.systems.some(system => c.systems.includes(system))
      && ['Gale Blast', 'Spout'].includes(spell.name)).sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Ancestral Cantrip') {
    const rules = ancestralCantripRules(c, entries, feat.sourceId)
    return spellIndex(entries).spells.filter(spell => spell.kind === 'spell' && !spell.deleted
      && spell.systems.some(system => c.systems.includes(system))
      && spell.traits.some(trait => trait.toLowerCase() === 'cantrip')
      && !!rules && (rules.any ? !!rules.tradition && String(spell.data.tradition ?? '').toLowerCase().split(/,\s*/).includes(rules.tradition.toLowerCase())
        && !spell.traits.some(trait => /^(uncommon|rare|unique|focus)$/i.test(trait))
        : rules.spells.some(name => matchesSpell(spell, name))))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Ancestral Magic') {
    const rules = ancestralMagicRules(c, entries, feat)
    return spellIndex(entries).spells.filter(spell => spell.kind === 'spell' && !spell.deleted
      && spell.systems.some(system => c.systems.includes(system))
      && rules?.spells.some(name => matchesSpell(spell, name)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  const entry = featSource(c, entries, feat.name)
  const rule = entry?.spellGrants?.find(grant => grant.choice)
  if (!rule && feat.name !== 'Qi Spells') return undefined
  return spellIndex(entries).spells.filter(spell => spell.kind === 'spell' && !spell.deleted && spell.systems.some(system => c.systems.includes(system))
    && (feat.name === 'Qi Spells'
      ? spell.level === 1 && spell.traits.includes('Focus') && spell.traits.includes('Monk')
      : rule?.choice === 'cantrip'
        ? spell.traits.some(trait => trait.toLowerCase() === 'cantrip')
          && typeof rule.tradition === 'string' && String(spell.data.tradition).toLowerCase().split(/,\s*/).includes(rule.tradition.toLowerCase())
          && !spell.traits.some(trait => /^(uncommon|rare|unique|focus)$/i.test(trait))
        : rule?.spells.some(name => name.toLowerCase() === spell.name.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function boneMagicChoiceOptions(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  return [...new Set((featSpellOptions(c, entries, feat) ?? []).flatMap(spell =>
    (['occult', 'primal'] as const)
      .filter(tradition => spell.name === 'Void Warp' ? tradition === 'primal'
        : String(spell.data.tradition ?? '').toLowerCase().split(/,\s*/).includes(tradition))
      .map(tradition => `${tradition}|${spell.name}`)))]
}

export function mageAutomatonOptions(c: Character, entries: ContentEntry[]) {
  return c.level >= 1 && c.heritage === 'Mage Automaton' ? cantripOptions(c, spellIndex(entries).spells, 'Arcane') : []
}

export function gnomeHeritageTradition(c: Character) {
  if (!c.systems.includes('pf2e') || c.level < 1) return undefined
  if (c.heritage?.toLowerCase() === 'fey-touched gnome') return 'Primal' as const
  if (c.heritage?.toLowerCase() !== 'wellspring gnome') return undefined
  const tradition = c.gnomeHeritageMagic?.tradition
  return tradition && (['Arcane', 'Divine', 'Occult'] as const).includes(tradition) ? tradition : undefined
}

export function gnomeHeritageCantripOptions(c: Character, entries: ContentEntry[]) {
  const tradition = gnomeHeritageTradition(c)
  return tradition ? cantripOptions(c, spellIndex(entries).spells, tradition) : []
}

function orderTrainingRules(c: Character, entries: ContentEntry[], feat: Character['feats'][number]): SpellGrant[] {
  const benefit = hellknightTrainingBenefit(c, feat.name, feat.choice)
  if (benefit?.name === 'Dedication to the Five' && benefit.choice && GODCLAW_DOMAINS.includes(benefit.choice)) {
    return domainFeatSpells(c, entries, 'Domain Initiate', benefit.choice).map(entry => ({
      kind: 'focus', spells: [entry.name], tradition: 'Divine', heightened: true,
      condition: `Casting this domain spell grants ${2 * Math.ceil(c.level / 2)} temporary HP for 1 round.`,
    }))
  }
  return hellknightTrainingSpellRules(c, feat.name, feat.choice)
}

export function grantedFeatSpells(c: Character, entries: ContentEntry[]) {
  const out: { entry: ContentEntry; source: string; rule: SpellGrant; rank: number; usageKey: string }[] = []
  const gnomeTradition = gnomeHeritageTradition(c)
  const gnomeCantrip = gnomeTradition && c.gnomeHeritageMagic?.cantrips?.[gnomeTradition]
    ? gnomeHeritageCantripOptions(c, entries).find(entry => entry.name === c.gnomeHeritageMagic?.cantrips?.[gnomeTradition])
    : undefined
  if (gnomeCantrip && gnomeTradition && c.heritage) out.push({ entry: gnomeCantrip, source: c.heritage,
    rule: { kind: 'innate', spells: [gnomeCantrip.name], tradition: gnomeTradition, frequency: 'at will', heightened: true },
    rank: Math.ceil(c.level / 2), usageKey: JSON.stringify(['heritage', c.heritage, gnomeTradition, gnomeCantrip.name]) })
  const mageCantrip = c.mageAutomatonCantrip
    ? mageAutomatonOptions(c, entries).find(entry => entry.name === c.mageAutomatonCantrip) : undefined
  if (mageCantrip) out.push({ entry: mageCantrip, source: 'Mage Automaton',
    rule: { kind: 'innate', spells: [mageCantrip.name], tradition: 'arcane', frequency: 'at will', heightened: true },
    rank: Math.ceil(c.level / 2), usageKey: JSON.stringify(['heritage', 'Mage Automaton', mageCantrip.name]) })
  for (const grant of divineBoonSpells(c)) {
    const entry = matchingSpells(entries, grant.name).find(spell => spell.systems.some(system => c.systems.includes(system)))
    if (entry) out.push({ entry, source: grant.source,
      rule: { kind: 'innate', spells: [entry.name], tradition: 'divine', frequency: grant.frequency },
      rank: Math.max(entry.level, grant.rank ?? entry.level), usageKey: JSON.stringify(['deity', grant.deity, grant.id, entry.name]) })
  }
  if (characterHeritages(c, entries).some(heritage => heritage.name === 'Seer Elf')) {
    const entry = matchingSpells(entries, 'Detect Magic').find(spell => spell.systems.some(system => c.systems.includes(system)))
    if (entry) out.push({ entry, source: 'Seer Elf',
      rule: { kind: 'innate', spells: [entry.name], tradition: 'arcane', frequency: 'at will', heightened: true },
      rank: Math.ceil(c.level / 2), usageKey: JSON.stringify(['heritage', 'Seer Elf', entry.name]) })
  }
  if (c.systems.includes('sf2e') && c.ancestry === 'Vesk' && c.heritage === 'Venomthought Vesk' && c.level >= 1) {
    const entry = matchingSpells(entries, 'Daze').find(spell => spell.systems.includes('sf2e'))
    if (entry) out.push({ entry, source: 'Venomthought Vesk',
      rule: { kind: 'innate', spells: [entry.name], tradition: 'occult', frequency: 'at will', heightened: true },
      rank: Math.ceil(c.level / 2), usageKey: JSON.stringify(['heritage', 'Venomthought Vesk', entry.name]) })
  }
  for (const heritage of characterHeritages(c, entries)) {
    const granted = typeof heritage.data.grants_heritage_feats === 'string'
      && heritage.data.grants_heritage_feats.split(';').includes('Kitsune Spell Familiarity')
    if (!granted) continue
    const choice = c.automaticFeatChoices?.[automaticFeatChoiceKey(heritage.name, 'Kitsune Spell Familiarity')]
    const entry = choice && featSpellOptions(c, entries, {
      name: 'Kitsune Spell Familiarity', type: 'Ancestry Feat', level: 1, slot: '',
    })?.find(spell => spell.name === choice)
    if (entry) out.push({ entry, source: heritage.name,
      rule: { kind: 'innate', spells: [entry.name], tradition: 'divine', frequency: 'at will', heightened: true },
      rank: Math.ceil(c.level / 2),
      usageKey: JSON.stringify(['heritage-feat', heritage.name, 'Kitsune Spell Familiarity', entry.name]) })
  }
  for (const [index, feat] of c.feats.entries()) {
    if (featTakenLevel(feat) > c.level) continue
    const selection = feat.slot ?? `${feat.name}:${c.feats.slice(0, index).filter(other => other.name === feat.name).length}`
    const source = featSource(c, entries, feat.name, feat.sourceId)
    if (feat.name === 'Halo' && c.systems.includes('pf2e')) {
      const entry = matchingSpells(entries, 'Light').find(spell => spell.systems.includes('pf2e'))
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'divine', heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, 'light']) })
      continue
    }
    if (feat.name === 'Extraplanar Supplication') {
      const choice = feat.choice
      const entry = c.systems.includes('pf2e') && choice && EXTRAPLANAR_SUPPLICATION_SPELLS.includes(choice)
        ? matchingSpells(entries, choice).find(spell => spell.systems.includes('pf2e')) : undefined
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'divine', frequency: 'once per day', fixedRank: true },
        rank: 1, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      continue
    }
    if (feat.name === 'Fiendish Magic') {
      for (const name of fiendishMagicSpells(c)) {
        const entry = matchingSpells(entries, name).find(spell => spell.systems.includes('pf2e'))
        if (entry) out.push({ entry, source: feat.name,
          rule: { kind: 'innate', spells: [entry.name], tradition: 'divine', frequency: 'once per day', fixedRank: true },
          rank: 2, usageKey: JSON.stringify([selection, feat.name, name.toLowerCase()]) })
      }
      continue
    }
    if (feat.name === 'Psychic Talent' && c.systems.includes('sf2e')) {
      const entry = feat.choice && featSpellOptions(c, entries, feat)?.find(spell => spell.name === feat.choice)
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'occult', frequency: 'at will', heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, entry.name.toLowerCase()]) })
      continue
    }
    if (['Psychic Mastery', 'Psychic Paragon'].includes(feat.name) && c.systems.includes('sf2e')) {
      const entry = feat.choice && featSpellOptions(c, entries, feat)?.find(spell => spell.name === feat.choice)
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'occult', frequency: 'once per day' },
        rank: feat.name === 'Psychic Mastery' ? 2 : 6, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      continue
    }
    const psychicSpells = c.systems.includes('sf2e') ? PSYCHIC_FEAT_SPELLS[feat.name] : undefined
    if (psychicSpells) {
      for (const name of psychicSpells.names) {
        const entry = matchingSpells(entries, name).find(spell => spell.systems.includes('sf2e'))
        if (entry) out.push({ entry, source: feat.name,
          rule: { kind: 'innate', spells: [name], tradition: psychicSpells.tradition, frequency: 'once per day', fixedRank: true },
          rank: psychicSpells.rank, usageKey: JSON.stringify([selection, feat.name, name.toLowerCase()]) })
      }
      continue
    }
    if (feat.name === 'Kitsune Spell Familiarity') {
      const entry = feat.choice && featSpellOptions(c, entries, feat)?.find(spell => spell.name === feat.choice)
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'divine', frequency: 'at will', heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, entry.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Plant Shape' && c.systems.includes('pf2e')) {
      const rank = highestDruidSlotRank(c)
      if (!hasUntamedForm(c) && rank !== undefined && rank >= 5) {
        const entry = matchingSpells(entries, 'Plant Form').find(spell => spell.systems.includes('pf2e'))
        if (entry) out.push({ entry, source: feat.name,
          rule: { kind: 'feat', spells: [entry.name], tradition: 'primal', frequency: 'once per day' },
          rank, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      }
      continue
    }
    if (feat.name === 'Natural Illusionist' && c.systems.includes('pf2e')) {
      for (const name of ['Illusory Disguise', 'Item Facade', 'Ventriloquism']) {
        const entry = matchingSpells(entries, name).find(spell => spell.systems.includes('pf2e'))
        if (entry) out.push({ entry, source: feat.name,
          rule: { kind: 'feat', spells: [entry.name], frequency: 'once per day', shared: true,
            condition: 'Tradition and spell DC are not specified; consult the GM' },
          rank: Math.min(10, Math.max(1, Math.floor((c.level - 3) / 2))),
          usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      }
      continue
    }
    if (feat.name === "Wind God's Fan" || feat.name === "Thunder God's Fan") continue
    if (feat.name === 'Tengu Feather Fan' && c.systems.includes('pf2e')) {
      const has = (name: string) => c.feats.some(other => other.name === name && featTakenLevel(other) <= c.level)
      const fan = [['Gust of Wind', 1, true], ['Wall of Wind', 3, has("Wind God's Fan")], ['Lightning Bolt', 5, has("Thunder God's Fan")]] as const
      const limit = Math.min(3, 1 + Number(has("Wind God's Fan")) + Number(has("Thunder God's Fan")))
      for (const [name, rank, active] of fan) {
        const entry = active && matchingSpells(entries, name).find(spell => spell.systems.includes('pf2e'))
        if (entry) out.push({ entry, source: feat.name,
          rule: { kind: 'feat', spells: [entry.name], tradition: 'primal', frequency: `${limit} times per day`, shared: true,
            dc: 'higher-class-or-spell', condition: 'Wave Fan activation; only you can use it' },
          rank, usageKey: JSON.stringify([selection, feat.name, 'fan']) })
      }
      continue
    }
    const choiceFeat = feat.name === 'Hurricane Swing'
      ? { names: ['Lightning Bolt', 'Gust of Wind'], rank: 6, condition: 'Reaction when you critically hit with a slashing weapon Strike; choose one spell' }
      : feat.name === 'Trickster Tengu'
        ? { names: ['Aerial Form', 'Cursed Metamorphosis'], rank: 7, condition: 'Choose one spell; Aerial Form must take the form of a bird' }
        : feat.name === 'Great Tengu Form'
          ? { names: ['Enlarge', 'Fly'], rank: 4, condition: 'Gained together as part of Long-Nosed Form; lasts 5 minutes or until you shift out of it' }
          : undefined
    if (choiceFeat && c.systems.includes('pf2e')) {
      for (const name of choiceFeat.names) {
        const entry = matchingSpells(entries, name).find(spell => spell.systems.includes('pf2e'))
        if (entry) out.push({ entry, source: feat.name,
          rule: { kind: 'feat', spells: [entry.name], tradition: 'primal', frequency: 'once per day', shared: true,
            condition: choiceFeat.condition },
          rank: choiceFeat.rank, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      }
      continue
    }
    if (feat.name === 'True Shapeshifter' && c.systems.includes('pf2e')) {
      const entry = matchingSpells(entries, 'Nature Incarnate').find(spell => spell.systems.includes('pf2e'))
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'feat', spells: [entry.name], tradition: 'primal', frequency: 'once per day',
          condition: c.feats.some(other => other.name === 'Plant Shape' && featTakenLevel(other) <= c.level)
            ? 'Kaiju or green man form only' : 'Kaiju form only' },
        rank: 10, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      continue
    }
    if (feat.name === 'Homeward Bound' && c.systems.includes('pf2e')) {
      const entry = matchingSpells(entries, 'Interplanar Teleport').find(spell => spell.systems.includes('pf2e'))
      const tradition = c.heritage?.toLowerCase() === 'wellspring gnome' ? gnomeTradition : 'Primal'
      if (entry && tradition) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition, frequency: 'twice per week',
          condition: 'Only between the First World and the Universe; no planar key required' },
        rank: entry.level, usageKey: JSON.stringify([selection, feat.name, 'weekly']) })
      continue
    }
    if (feat.name === 'Cautious Curiosity' && (gnomeTradition === 'Arcane' || gnomeTradition === 'Occult')) {
      for (const name of ['Disguise Magic', 'Silence']) {
        const entry = matchingSpells(entries, name).find(spell => spell.systems.includes('pf2e'))
        if (entry) out.push({ entry, source: feat.name,
          rule: { kind: 'innate', spells: [entry.name], tradition: gnomeTradition, frequency: 'once per day',
            fixedRank: true, condition: 'Must target yourself' },
          rank: 2, usageKey: JSON.stringify([selection, feat.name, entry.name.toLowerCase()]) })
      }
      continue
    }
    if (feat.name === 'Ancestral Pest' && c.systems.includes('sf2e')) {
      const entry = matchingSpells(entries, 'Pest Form').find(spell => spell.systems.some(system => c.systems.includes(system)))
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'primal', frequency: 'at will', fixedRank: true },
        rank: 1, usageKey: JSON.stringify([selection, feat.name, entry.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Advanced Targeting System' && ancestryFeatTraits(c).includes('android')) {
      const entry = matchingSpells(entries, 'Sure Strike').find(spell => spell.systems.some(system => c.systems.includes(system)))
        ?? matchingSpells(entries, 'True Strike').find(spell => spell.systems.some(system => c.systems.includes(system)))
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'arcane', frequency: 'once per day', fixedRank: true },
        rank: 1, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      continue
    }
    if (feat.name === 'Kijimuna Whistle' && c.systems.includes('pf2e')) {
      const entry = matchingSpells(entries, 'Summon Plant or Fungus').find(spell => spell.systems.includes('pf2e'))
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'primal', frequency: 'once per day',
          fixedRank: true, condition: 'This casting loses the manipulate trait; cast by whistling' },
        rank: 5, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      continue
    }
    if (feat.name === "Grandmother's Favorite" && c.systems.includes('sf2e')) {
      const spell: ContentEntry = entries.find(entry => entry.kind === 'spell' && !entry.deleted && entry.name === 'Divine Decree'
        && entry.systems.includes('sf2e')) ?? {
        id: 'reference:divine-decree', systems: ['sf2e'], kind: 'spell', source: 'official',
        name: 'Divine Decree', level: 7, traits: [], description: 'Starfinder spell details are unavailable in the catalog. The linked Pathfinder reference may require GM confirmation.',
        data: { url: 'https://2e.aonprd.com/Spells.aspx?ID=1495', sourceBook: 'Pathfinder Player Core reference' },
        effects: [], updatedAt: 0,
      }
      out.push({ entry: spell, source: feat.name,
        rule: { kind: 'innate', spells: [spell.name], tradition: 'divine', frequency: 'once per day',
          ...(spell.id === 'reference:divine-decree' ? { condition: 'Starfinder spell details unavailable; Pathfinder reference requires GM confirmation' } : {}) },
        rank: 7, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      continue
    }
    if (feat.name === 'Fortified Monument' && c.systems.includes('sf2e')) {
      if (c.ancestry === 'Vesk' && c.heritage === 'Enshrined Vesk' && c.level >= 13) {
        const entry = matchingSpells(entries, 'Cairn Form').find(spell => spell.systems.includes('sf2e'))
        if (entry) out.push({ entry, source: feat.name,
          rule: { kind: 'innate', spells: [entry.name], tradition: 'divine', frequency: 'twice per day',
            fixedRank: true, condition: 'Must target yourself. While active, a creature that damages you with an unarmed attack or non-reach melee weapon takes 8 bludgeoning damage.' },
          rank: 6, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      }
      continue
    }
    if (feat.name === 'Mortal Heart') {
      const spell = entries.find(entry => entry.kind === 'spell' && !entry.deleted && entry.name === 'Moment of Renewal'
        && entry.systems.some(system => c.systems.includes(system)))
      if (spell) out.push({ entry: spell, source: feat.name,
        rule: { kind: 'innate', spells: [spell.name], tradition: 'primal', frequency: 'once per day',
          condition: 'Up to six living creatures within 100 feet who can hear you, including yourself' },
        rank: 8, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      continue
    }
    if (feat.name === 'Mask of Power') {
      const warmask = warmaskSource(c)
      const entry = featSpellOptions(c, entries, feat)?.find(spell => spell.name === feat.choice)
      if (warmask && entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: warmask.tradition, frequency: 'once per day',
          condition: 'Must be wearing your warmask' },
        rank: 1, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      continue
    }
    if (feat.name === 'Bone Magic') {
      const selectedChoice = feat.choice === 'occult|Void Warp' ? 'primal|Void Warp' : feat.choice
      const choices = boneMagicChoiceOptions(c, entries, feat)
        .filter(choice => choice === selectedChoice || !!selectedChoice && choice.endsWith(`|${selectedChoice}`))
      const [tradition, name] = choices.length === 1 ? choices[0].split('|', 2) : []
      const spell = featSpellOptions(c, entries, feat)?.find(entry => entry.name === name)
      if (spell && tradition) out.push({ entry: spell, source: feat.name,
        rule: { kind: 'innate', spells: [spell.name], tradition, frequency: 'at will', heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, tradition, spell.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Widespread Fascination') {
      const fascination = widespreadFascinationOptions(c, entries, feat)
        .find(entry => entry.name === feat.choice || entry.data.grants_focus_spells === feat.choice)
      const spell = fascination && featSpellOptions(c, entries, feat)
        ?.find(entry => entry.name === fascination.data.grants_focus_spells)
      if (spell) out.push({ entry: spell, source: feat.name,
        rule: { kind: 'focus', spells: [spell.name], heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, spell.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Ancestral Cantrip') {
      const rule = ancestralCantripRules(c, entries, feat.sourceId)
      const selected = fixedAncestralCantrip(c, entries, feat.sourceId) ?? feat.choice
      const spell = selected && featSpellOptions(c, entries, feat)?.find(entry => matchesSpell(entry, selected))
      if (rule && spell) out.push({ entry: spell, source: feat.name,
        rule: { kind: 'innate', spells: [spell.name], tradition: rule.tradition, frequency: 'at will', heightened: true,
          ...(!rule.tradition ? { condition: 'Tradition not specified in ancestry source; verify with GM' } : {}) },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, spell.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Elemental Wrath') {
      const spell = entries.find(entry => entry.kind === 'spell' && !entry.deleted
        && entry.name === 'Caustic Blast' && entry.systems.some(system => c.systems.includes(system)))
      if (spell) {
        out.push({ entry: spell, source: feat.name,
          rule: { kind: 'innate', spells: [spell.name], tradition: 'primal', frequency: 'at will', heightened: true },
          rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, 'elemental-wrath']) })
      }
      continue
    }
    if (feat.name === 'Grown of Oak') {
      const entry = entries.find(spell => spell.kind === 'spell' && !spell.deleted && spell.name === 'Oaken Resilience'
        && spell.systems.some(system => c.systems.includes(system)))
      const slots = Object.entries(c.spellcasting?.slots ?? {}).filter(([rank, count]) => count > 0 && Number.isInteger(Number(rank)) && Number(rank) >= 1 && Number(rank) <= 10).map(([rank]) => Number(rank))
      const otherSpells = grantedFeatSpells({ ...c, feats: c.feats.filter(other => other.name !== 'Grown of Oak') }, entries)
      const highest = Math.max(c.className === 'Druid' ? Math.min(10, Math.ceil(c.level / 2)) : 0,
        ...slots, ...otherSpells.filter(grant => !grant.entry.traits.some(trait => trait.toLowerCase() === 'cantrip')).map(grant => grant.rank), 0)
      if (entry && highest >= 3) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'primal', frequency: 'at will',
          condition: 'Targets you and your leshy familiar within 30 feet' },
        rank: highest - 1, usageKey: JSON.stringify([selection, feat.name, entry.name.toLowerCase()]) })
      continue
    }
    if (['Creature Shape', 'Creature Ally'].includes(feat.name) && c.systems.includes('sf2e') && c.ancestry === 'Lashunta') {
      const name = feat.name === 'Creature Shape' ? 'Animal Form' : 'Summon Animal'
      const entry = matchingSpells(entries, name).find(spell => spell.systems.includes('sf2e'))
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'occult', frequency: 'once per day', fixedRank: true },
        rank: feat.name === 'Creature Shape' ? 8 : 5, usageKey: JSON.stringify([selection, feat.name, entry.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Creature Ally' || feat.name === 'Creature Shape') {
      const entry = featSpellOptions(c, entries, feat)?.find(spell => spell.name === feat.choice)
      const tradition = c.systems.includes('sf2e') && c.ancestry === 'Vesk'
        ? 'primal' : String(entry?.data.tradition ?? '').split(/,\s*/)[0]
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: tradition || undefined, frequency: 'once per day',
          condition: feat.name === 'Creature Ally' ? 'The summoned creature must be one of your ancestry\'s creatures'
            : 'Transform only into a battle form that matches your ancestral creature; use your normal AC if higher' },
        rank: feat.name === 'Creature Ally' ? 5 : 8, usageKey: JSON.stringify([selection, feat.name, entry.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Touch of the Sea') {
      const entry = featSpellOptions(c, entries, feat)?.find(spell => spell.name === feat.choice)
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'primal', frequency: 'at will', heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, entry.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Ancestral Magic') {
      const rule = ancestralMagicRules(c, entries, feat)
      const spell = feat.choice && featSpellOptions(c, entries, feat)?.find(entry => entry.name === feat.choice)
      if (rule && spell) out.push({ entry: spell, source: feat.name,
        rule: { kind: 'innate', spells: [spell.name], tradition: rule.tradition, frequency: 'once per day' },
        rank: rule.rank, usageKey: JSON.stringify([selection, feat.name, spell.name.toLowerCase()]) })
      continue
    }
    const rules = [...source?.spellGrants ?? [], ...orderTrainingRules(c, entries, feat)]
      .filter(rule => !(c.heritage?.toLowerCase() === 'wellspring gnome' && !gnomeTradition
        && source?.traits.some(trait => trait.toLowerCase() === 'gnome')
        && rule.kind === 'innate' && rule.tradition?.toLowerCase() === 'primal'))
      .map(rule => feat.name === 'Ancestral Form' && rule.kind === 'innate'
        ? { ...rule, tradition: 'primal', heightened: true, fixedRank: false, condition: 'Must target yourself; crocodile form only' }
        : ['Bone Investiture', 'Fossil Rider'].includes(feat.name) && rule.kind === 'innate'
        ? { ...rule, tradition: 'primal', condition: rule.condition ?? 'Must target yourself' }
        : c.heritage?.toLowerCase() === 'wellspring gnome' && gnomeTradition
          && source?.traits.some(trait => trait.toLowerCase() === 'gnome')
          && rule.kind === 'innate' && rule.tradition?.toLowerCase() === 'primal'
        ? { ...rule, tradition: gnomeTradition } : rule)
      .map(rule => feat.name === 'Scarlet Strands' && rule.kind === 'innate'
        && rule.spells.some(name => name.toLowerCase() === 'web')
        ? { ...rule, condition: 'Requires a free hand to pluck and throw hairs' } : rule)
    const options = featSpellOptions(c, entries, feat)
    if (feat.name === 'Cackle' && c.className === 'Witch' && c.systems.includes('pf2e')) {
      const spell = matchingSpells(entries, 'Cackle')[0]
      if (spell) out.push({ entry: spell, source: feat.name, rule: { kind: 'focus', spells: [spell.name], heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, 'hex']) })
      continue
    }
    if (feat.name in WITCH_LESSON_RANKS && feat.choice) {
      const spell = witchLessonOptions(c, entries, feat).find(option => option.name === feat.choice)
      if (spell) out.push({ entry: spell, source: feat.name, rule: { kind: 'focus', spells: [spell.name], heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, 'lesson', spell.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Qi Spells' && feat.choice && options?.some(spell => spell.name === feat.choice)) {
      const entry = options.find(spell => spell.name === feat.choice)
      if (entry) out.push({ entry, source: feat.name, rule: { kind: 'focus', spells: [entry.name], heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, 'qi']) })
      continue
    }
    if (DOMAIN_FEATS.includes(feat.name) && feat.choice) {
      for (const entry of domainFeatSpells(c, entries, feat.name, feat.choice)) {
        out.push({ entry, source: `${feat.name}: ${feat.choice}`, rule: { kind: 'focus', spells: [entry.name], tradition: 'Divine', heightened: true },
          rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, 'domain', entry.name]) })
      }
    }
    for (const baseRule of rules) {
      const rule = feat.name === 'Forgotten in the Crowd' && baseRule.kind === 'innate'
        && baseRule.frequency === 'once per day' && baseRule.spells.some(name => name.toLowerCase() === 'invisibility')
        && c.feats.some(other => featTakenLevel(other) <= c.level && (other.name === 'Face in the Crowd'
          || Object.entries(INITIATE_TRAINING).some(([name, training]) => other.name === name
            && training.feats.some(name => name === 'Face in the Crowd'))))
        ? { ...baseRule, frequency: 'twice per day' } : baseRule
      const names = rule.choice ? options?.filter(spell => spell.name === feat.choice).map(spell => spell.name) ?? [] : rule.spells
      for (const name of names) {
        const available = matchingSpells(entries, name).filter(spell => spell.systems.some(system => c.systems.includes(system)))
        const entry = available.find(spell => spell.name.toLowerCase() === name.toLowerCase()) ?? available[0]
        if (entry) out.push({ entry, source: feat.name,
          rule: feat.name === 'Empathetic Connection'
            ? { ...rule, condition: rule.condition ?? 'The target is temporarily immune for 24 hours' }
            : feat.name === 'Imperious Nature' ? { ...rule, condition: rule.condition ?? 'This effect loses the linguistic trait' }
            : feat.name === 'Stonegate' ? { ...rule, condition: rule.condition ?? 'Only through barriers of earth or stone' } : rule,
          rank: rule.heightened || entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
          ? Math.ceil(c.level / 2) : rule.rank ?? entry.level,
          usageKey: JSON.stringify([selection, feat.name, baseRule.spells.map(spell => spell.toLowerCase()).sort(),
            rule.tradition?.toLowerCase() ?? '', rule.shared || rule.choice ? 'shared' : entry.name.toLowerCase()]) })
      }
    }
  }
  return getSettings().innateAutoHeighten
    ? out.map(grant => grant.rule.kind === 'innate' ? { ...grant, rank: Math.max(grant.rank, Math.ceil(c.level / 2)) } : grant)
    : out
}

export function dailyInnateUses(c: Character, grant: ReturnType<typeof grantedFeatSpells>[number]) {
  if (grant.rule.kind === 'focus') return undefined
  const uses = limitedSpellUses(grant.rule.frequency, c.innateSpellUses?.[grant.usageKey])
  return uses && { key: grant.usageKey, ...uses }
}

export function limitedSpellUses(frequencyText?: string, saved: number | number[] = 0) {
  const frequency = /^(once|twice|(\d+) times) per (?:minute|hour|day|week|month)(?: each)?$/i.exec(frequencyText ?? '')
  if (!frequency) return undefined
  const limit = frequency[1].toLowerCase() === 'once' ? 1 : frequency[1].toLowerCase() === 'twice' ? 2 : Number(frequency[2])
  if (!Number.isSafeInteger(limit) || limit < 1) return undefined
  const savedIndices = Array.isArray(saved) ? [...new Set(saved.filter(index => Number.isInteger(index) && index >= 0))] : undefined
  const spent = savedIndices
    ? savedIndices.filter(index => index < limit)
    : Array.from({ length: Math.min(limit, Math.max(0, Math.floor(typeof saved === 'number' ? saved : 0))) }, (_, index) => index)
  for (let index = 0; spent.length < Math.min(limit, savedIndices?.length ?? 0); index++) {
    if (!spent.includes(index)) spent.push(index)
  }
  return { limit, spent, used: spent.length, remaining: limit - spent.length }
}

export function unresolvedFeatSpells(c: Character, entries: ContentEntry[]): { name: string; source?: ContentEntry; sourceName?: string }[] {
  const missingBoonSpells = divineBoonSpells(c)
    .filter(grant => !matchingSpells(entries, grant.name).some(entry => entry.systems.some(system => c.systems.includes(system))))
    .map(grant => ({ name: grant.name, source: entries.find(entry => entry.kind === 'deity' && entry.name === grant.deity), sourceName: grant.source }))
  const seer = characterHeritages(c, entries).find(heritage => heritage.name === 'Seer Elf')
  const missingHeritageSpells: { name: string; source?: ContentEntry; sourceName?: string }[] = seer && !matchingSpells(entries, 'Detect Magic')
    .some(entry => entry.systems.some(system => c.systems.includes(system))) ? [{ name: 'Detect Magic', source: seer }] : []
  if (c.systems.includes('sf2e') && c.ancestry === 'Vesk' && c.heritage === 'Venomthought Vesk' && c.level >= 1
    && !matchingSpells(entries, 'Daze').some(entry => entry.systems.includes('sf2e'))) {
    missingHeritageSpells.push({ name: 'Daze', source: characterHeritages(c, entries).find(heritage => heritage.name === 'Venomthought Vesk'), sourceName: 'Venomthought Vesk' })
  }
  return [...missingBoonSpells, ...missingHeritageSpells, ...c.feats.filter(feat => featTakenLevel(feat) <= c.level).flatMap(feat => {
    const source = featSource(c, entries, feat.name)
    if (feat.name === 'Halo' && c.systems.includes('pf2e')) {
      return matchingSpells(entries, 'Light').some(entry => entry.systems.includes('pf2e')) ? [] : [{ name: 'Light', source }]
    }
    if (feat.name === 'Extraplanar Supplication') {
      const choice = feat.choice
      return c.systems.includes('pf2e') && choice && EXTRAPLANAR_SUPPLICATION_SPELLS.includes(choice)
        && !matchingSpells(entries, choice).some(entry => entry.systems.includes('pf2e')) ? [{ name: choice, source }] : []
    }
    if (feat.name === 'Fiendish Magic') {
      return fiendishMagicSpells(c).filter(name => !matchingSpells(entries, name).some(entry => entry.systems.includes('pf2e')))
        .map(name => ({ name, source }))
    }
    const psychicSpells = c.systems.includes('sf2e') ? PSYCHIC_FEAT_SPELLS[feat.name] : undefined
    if (psychicSpells) {
      return psychicSpells.names
        .filter(name => !matchingSpells(entries, name).some(entry => entry.systems.includes('sf2e')))
        .map(name => ({ name, source }))
    }
    if (['Creature Shape', 'Creature Ally'].includes(feat.name) && c.systems.includes('sf2e') && c.ancestry === 'Lashunta') {
      const name = feat.name === 'Creature Shape' ? 'Animal Form' : 'Summon Animal'
      return matchingSpells(entries, name).some(entry => entry.systems.includes('sf2e')) ? [] : [{ name, source }]
    }
    const training = hellknightTrainingBenefit(c, feat.name, feat.choice)
    if (training?.name === 'Dedication to the Five' && training.choice && GODCLAW_DOMAINS.includes(training.choice)
      && !domainFeatSpells(c, entries, 'Domain Initiate', training.choice).length) {
      return [{ name: `${training.choice} domain focus spell`, source }]
    }
    if (feat.name === "Grandmother's Favorite" && c.systems.includes('sf2e')) return []
    if (feat.name === 'Plant Shape' && c.systems.includes('pf2e')) {
      if (hasUntamedForm(c)) return []
      const rank = highestDruidSlotRank(c)
      if (rank === undefined) return [{ name: 'Plant Form (druid spell slot rank unavailable)', source }]
      if (rank < 5) return [{ name: 'Plant Form (druid spell slot rank below 5)', source }]
      return matchingSpells(entries, 'Plant Form').some(entry => entry.systems.includes('pf2e'))
        ? [] : [{ name: 'Plant Form', source }]
    }
    if (feat.name === 'Natural Illusionist' || feat.name === 'True Shapeshifter' || feat.name === 'Cautious Curiosity' || feat.name === 'Homeward Bound') {
      const names = feat.name === 'Natural Illusionist' ? ['Illusory Disguise', 'Item Facade', 'Ventriloquism']
        : feat.name === 'True Shapeshifter' ? ['Nature Incarnate']
        : feat.name === 'Homeward Bound' ? ['Interplanar Teleport'] : ['Disguise Magic', 'Silence']
      return names.filter(name => !matchingSpells(entries, name).some(entry => entry.systems.includes('pf2e')))
        .map(name => ({ name, source }))
    }
    if (feat.name === 'Kijimuna Whistle' && c.systems.includes('pf2e')) {
      return matchingSpells(entries, 'Summon Plant or Fungus').some(entry => entry.systems.includes('pf2e'))
        ? [] : [{ name: 'Summon Plant or Fungus', source }]
    }
    if (feat.name === 'Grown of Oak' && !entries.some(entry => entry.kind === 'spell' && !entry.deleted
      && entry.name === 'Oaken Resilience' && entry.systems.some(system => c.systems.includes(system)))) {
      return [{ name: 'Oaken Resilience', source }]
    }
    if (feat.name === 'Elemental Wrath' && !entries.some(entry => entry.kind === 'spell' && !entry.deleted
      && entry.name === 'Caustic Blast' && entry.systems.some(system => c.systems.includes(system)))) {
      return [{ name: 'Caustic Blast', source }]
    }
    return [...source?.spellGrants ?? [], ...orderTrainingRules(c, entries, feat)].flatMap(rule => (rule.choice ? feat.choice ? [feat.choice] : [] : rule.spells)
      .filter(name => !matchingSpells(entries, name).some(entry => entry.systems.some(system => c.systems.includes(system))))
      .map(name => ({ name, source })))
  })]
}
