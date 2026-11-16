import type { Character, ContentEntry } from './types'
import { getSettings } from './settings'

const WARDEN_TIERS: Record<string, string> = {
  'Initiate Warden': 'Initiate',
  'Advanced Warden': 'Advanced',
  'Masterful Warden': 'Master',
  'Peerless Warden': 'Peerless',
}
type NamedFeat = Pick<Character['feats'][number], 'name'> & Partial<Character['feats'][number]>
export const featTakenLevel = (feat: Character['feats'][number]) => feat.takenLevel ?? (Number(feat.slot?.split(':')[1]) || feat.level)

const ANCESTRAL_UNARMED_FEATS: Record<string, string[]> = {
  orc: ['Tusks', 'Tusks (Orc)', 'Iron Fists', 'Iron Fist'],
  barathu: ['Tentacle Whip'],
  pahtra: ['Predatory'],
  vesk: ['Brutal Anatomy'],
  goblin: ['Fang Sharpener'],
}

export function ancestralUnarmedFeatNames(ancestries: string[]) {
  return [...new Set(ancestries.flatMap(ancestry => {
    const name = ancestry.trim().toLowerCase()
    return ANCESTRAL_UNARMED_FEATS[['dromaar', 'half-orc'].includes(name) ? 'orc' : name] ?? []
  }))]
}

export function alloyedAttackChoice(c: Character) {
  const choice = c.feats.find(feat => feat.name === 'Alloyed Attacks' && featTakenLevel(feat) <= c.level)?.choice
  return choice === 'Cold Iron' || choice === 'Silver' || choice === 'Adamantine' && c.level >= 13 ? choice : undefined
}

export function adoptedAncestryText(c: Character, text: string) {
  if ([c.ancestry, c.heritage].some(name => /^(orc|dromaar|half-orc)$/i.test(name?.trim() ?? ''))
    || !c.feats.some(feat => feat.name === 'Adopted Ancestry' && feat.choice?.trim().toLowerCase() === 'orc'
      && featTakenLevel(feat) <= c.level)) return text
  return text.replace(/\btusks?\b/gi, word => {
    const replacement = word.toLowerCase() === 'tusk' ? 'tooth' : 'teeth'
    return word === word.toUpperCase() ? replacement.toUpperCase()
      : word[0] === word[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement
  })
}

export function ancestralAttackName(c: Character, name: string, material?: string) {
  const display = adoptedAncestryText(c, name)
  const tusks = /^Tusks(?: \(Orc\))?$/i.test(name)
  const fixed = tusks && c.feats.some(feat => feat.name === 'Cold Iron Tusks' && featTakenLevel(feat) <= c.level)
    && c.level >= 5 ? 'Cold Iron' : undefined
  const selected = material ?? (tusks || /^Iron Fists?$/i.test(name) ? fixed ?? alloyedAttackChoice(c) : undefined)
  return selected && !display.startsWith(`${selected} `) ? `${selected} ${display}` : display
}

export function ancestryFeatTraits(c: Character) {
  const active = c.feats.filter(feat => featTakenLevel(feat) <= c.level)
  const testSubject = c.level >= 1 && c.systems.includes('sf2e') && c.heritage === 'Cyborg' && getSettings().cyborgTestSubject
  return [c.ancestry, c.heritage, ...(c.heritage?.trim().toLowerCase() === 'dromaar' ? ['Orc'] : []),
    ...(testSubject ? ['Test-Subject Ysoki'] : []), ...active.filter(feat => feat.name === 'Adopted Ancestry').map(feat => feat.choice),
    ...(c.systems.includes('pf2e') && active.some(feat => feat.name === 'Orc Kinship') ? ['Orc'] : [])]
    .filter((name): name is string => !!name).map(name => name.trim().toLowerCase())
}

const selectedFeatCache = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()
export function selectedFeatEntry(c: Character, entries: ContentEntry[], name: string, sourceId?: string) {
  let names = selectedFeatCache.get(entries)
  if (!names) {
    names = new Map()
    for (const entry of entries) if (entry.kind === 'feat' && !entry.deleted) {
      const variants = names.get(entry.name) ?? []
      variants.push(entry)
      names.set(entry.name, variants)
    }
    selectedFeatCache.set(entries, names)
  }
  const sources = (names.get(name) ?? []).filter(entry => entry.systems.some(system => c.systems.includes(system)))
  if (!sources.length) return undefined
  const id = sourceId ?? c.feats.find(feat => feat.name === name && featTakenLevel(feat) <= c.level)?.sourceId
  if (id) return sources.find(entry => entry.id === id)
  if (sources.length === 1) return sources[0]
  // Older saves retain content IDs without a per-feat source ID.
  const saved = sources.filter(entry => c.entryIds.includes(entry.id))
  if (saved.length === 1) return saved[0]
  for (const ancestry of ancestryFeatTraits(c)) {
    const source = sources.find(entry => entry.traits.some(trait => trait.toLowerCase() === ancestry))
    if (source) return source
  }
  return c.systems.map(system => sources.find(entry => entry.systems.includes(system))).find(Boolean)
}

export const isCompanionAdvancement = (name: string) => /^Incredible (?:Companion|Mount)(?: \(|$)/.test(name) || name === 'Imposing Destrier'
export const isCompanionSpecialization = (name: string) => /^Specialized (?:Companion|Mount)(?: \(|$)/.test(name) || name === 'Auspicious Mount'

export function compareFeatSelections(a: Pick<Character['feats'][number], 'name' | 'choice'>, b: Pick<Character['feats'][number], 'name' | 'choice'>) {
  return a.name.localeCompare(b.name)
    || Number(!a.choice) - Number(!b.choice)
    || (a.choice ?? '').localeCompare(b.choice ?? '')
}

export function spellWardenLabel(tier: unknown) {
  return typeof tier === 'string' && ['Initiate', 'Advanced', 'Master', 'Peerless'].includes(tier)
    ? `${tier} Warden`
    : undefined
}

export function wardenSpellOptions(feat: NamedFeat, entries: ContentEntry[]) {
  const tier = WARDEN_TIERS[feat.name]
  if (!tier) return []
  return wardenSpellsAtTier(tier, entries)
}

// House addition: Snare Hopping is offered alongside the Initiate Warden spells
const EXTRA_WARDEN_SPELLS: Record<string, string[]> = { Initiate: ['Snare Hopping'] }

export const wardenTierOf = (entry: ContentEntry) =>
  entry.data.warden_spell_tier ?? Object.entries(EXTRA_WARDEN_SPELLS).find(([, names]) => names.includes(entry.name))?.[0]

const wardenSpellCache = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()
function wardenSpellsAtTier(tier: string, entries: ContentEntry[]) {
  let tiers = wardenSpellCache.get(entries)
  if (!tiers) {
    tiers = new Map()
    wardenSpellCache.set(entries, tiers)
  }
  let spells = tiers.get(tier)
  if (!spells) {
    spells = entries.filter((entry) => entry.kind === 'spell' && entry.systems.includes('pf2e') && wardenTierOf(entry) === tier)
      .sort((a, b) => a.name.localeCompare(b.name))
    tiers.set(tier, spells)
  }
  return spells
}

export function hasWardenChoice(feat: NamedFeat) {
  return Object.hasOwn(WARDEN_TIERS, feat.name)
}

export function canSelectWardenFeat(name: string, c: Character, entries: ContentEntry[], slotKey?: string) {
  const tier = WARDEN_TIERS[name]
  if (!tier || !c.systems.includes('pf2e')) return true
  const options = new Set(wardenSpellsAtTier(tier, entries).map((spell) => spell.name))
  const choices = new Set<string>()
  let unassigned = 0
  for (const feat of c.feats) {
    if (feat.name !== name || feat.slot === slotKey) continue
    if (feat.choice) choices.add(feat.choice)
    else unassigned++
  }
  return [...options].filter((option) => !choices.has(option)).length > unassigned
}

export function grantedWardenSpells(c: Character, entries: ContentEntry[]) {
  const found = new Map<string, ContentEntry>()
  for (const feat of c.feats) {
    if (!feat.choice || !hasWardenChoice(feat) || featTakenLevel(feat) > c.level) continue
    const spell = wardenSpellOptions(feat, entries).find((entry) => entry.name === feat.choice)
    if (spell) found.set(spell.name, spell)
  }
  return [...found.values()]
}
