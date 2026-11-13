import { automaticFeatGrants, featTakenLevel, ranksAt } from './builder'
import type { Character, ContentEntry } from './types'

export const STANDARD_SNARE_FORMULAS = ['Pit Illusion Snare', 'Shadow Cloak Snare']
export const formulaKey = (name: string) => name.trim().toLowerCase()

export function updateFormulaChoice(values: string[], index: number, value: string) {
  const next = Array.from({ length: Math.max(values.length, index + 1) }, (_, i) => values[i] ?? '')
  next[index] = value
  return next
}

export function snareAdvancements(c: Character, entries: ContentEntry[]) {
  const dedication = c.feats.filter(feat => feat.name === 'Snarecrafter Dedication' && featTakenLevel(feat) <= c.level)
    .sort((a, b) => featTakenLevel(a) - featTakenLevel(b))[0]
  if (!dedication) return []
  const skill = (level: number) => {
    const ranks = ranksAt({ ...c, level }, entries, level + 1, false)
    return Math.max(ranks.Crafting ?? 0, c.className === 'Ranger' ? ranks.Survival ?? 0 : 0)
  }
  const advancements: { rank: number; level: number }[] = []
  for (let level = featTakenLevel(dedication); level <= c.level; level++) {
    const before = level > 1 ? skill(level - 1) : 0
    const after = skill(level)
    for (let rank = Math.max(2, before + 1); rank <= Math.min(4, after); rank++) advancements.push({ rank, level })
  }
  return advancements
}

export function gadgetLimits(c: Character, entries: ContentEntry[]) {
  if (!c.feats.some(feat => feat.name === 'Gadget Specialist' && featTakenLevel(feat) <= c.level)) return undefined
  const crafting = ranksAt(c, entries).Crafting ?? 0
  const rank = crafting >= 4 ? 4 : crafting >= 3 ? 3 : 2
  const ubiquitous = c.feats.filter(feat => feat.name === 'Ubiquitous Gadgets' && featTakenLevel(feat) <= c.level)
    .sort((a, b) => featTakenLevel(a) - featTakenLevel(b))
  const extras = ubiquitous.length ? 1 + Number(ubiquitous.slice(1).some(feat => featTakenLevel(feat) >= 14)) : 0
  return { formulas: 3 * (rank - 1), prepared: rank + 2 * extras }
}

export function formulaSources(c: Character, entries: ContentEntry[]) {
  const active = c.feats.filter(feat => featTakenLevel(feat) <= c.level)
  const background = entries.find(entry => entry.kind === 'background' && entry.name === c.background)
  const backgroundFeats = String(background?.data.feat ?? '').split(',').map(formulaKey)
  const snareCrafting = active.some(feat => feat.name === 'Snare Crafting')
    || automaticFeatGrants(c, entries).some(feat => feat.name === 'Snare Crafting')
    || backgroundFeats.includes('snare crafting')
  const brastlewark = active.find(feat => feat.name === 'Brastlewark Snare Engineering')
  return { snareCrafting, brastlewark }
}

export function knownFormulas(c: Character, entries: ContentEntry[]) {
  const { snareCrafting, brastlewark } = formulaSources(c, entries)
  const groups = [
    { source: 'Snare Crafting', names: snareCrafting ? c.snareFormulaChoices ?? [] : [] },
    ...snareAdvancements(c, entries).map(({ rank }) => ({
      source: 'Snarecrafter Dedication', names: (c.snareAdvancementFormulaChoices ?? []).slice((rank - 2) * 3, (rank - 1) * 3),
    })),
    { source: 'Gadget Specialist', names: (c.gadgetFormulaChoices ?? []).slice(0, gadgetLimits(c, entries)?.formulas ?? 0) },
    { source: 'Brastlewark Snare Engineering', names: brastlewark
      ? c.brastlewarkFormulaMode === 'standard' ? STANDARD_SNARE_FORMULAS : c.brastlewarkFormulaMode === 'other' ? c.brastlewarkFormulaChoices ?? [] : []
      : [] },
    { source: 'Other', names: c.formulas ?? [] },
  ]
  const known = new Map<string, { name: string; source: string }>()
  for (const group of groups) for (const name of group.names) {
    if (typeof name === 'string' && name.trim() && !known.has(formulaKey(name))) known.set(formulaKey(name), { name, source: group.source })
  }
  return [...known.values()].sort((a, b) => a.name.localeCompare(b.name))
}
