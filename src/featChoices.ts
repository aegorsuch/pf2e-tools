import type { Character, ContentEntry } from './types'

const WARDEN_TIERS: Record<string, string> = {
  'Initiate Warden': 'Initiate',
  'Advanced Warden': 'Advanced',
  'Masterful Warden': 'Master',
  'Peerless Warden': 'Peerless',
}

export function wardenSpellOptions(feat: Character['feats'][number], entries: ContentEntry[]) {
  const tier = WARDEN_TIERS[feat.name]
  if (!tier) return []
  return entries.filter((entry) => entry.kind === 'spell' && entry.systems.includes('pf2e') && entry.data.warden_spell_tier === tier)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function hasWardenChoice(feat: Character['feats'][number]) {
  return Object.hasOwn(WARDEN_TIERS, feat.name)
}

export function grantedWardenSpells(c: Character, entries: ContentEntry[]) {
  const found = new Map<string, ContentEntry>()
  for (const feat of c.feats) {
    if (!feat.choice || !hasWardenChoice(feat)) continue
    const spell = wardenSpellOptions(feat, entries).find((entry) => entry.name === feat.choice)
    if (spell) found.set(spell.name, spell)
  }
  return [...found.values()]
}
