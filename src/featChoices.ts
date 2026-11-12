import type { Character, ContentEntry } from './types'

const WARDEN_TIERS: Record<string, string> = {
  'Initiate Warden': 'Initiate',
  'Advanced Warden': 'Advanced',
  'Masterful Warden': 'Master',
  'Peerless Warden': 'Peerless',
}
type NamedFeat = Pick<Character['feats'][number], 'name'> & Partial<Character['feats'][number]>
export const featTakenLevel = (feat: Character['feats'][number]) => feat.takenLevel ?? (Number(feat.slot?.split(':')[1]) || feat.level)

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
