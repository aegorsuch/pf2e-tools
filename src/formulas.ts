import { automaticFeatGrants, featTakenLevel } from './builder'
import type { Character, ContentEntry } from './types'

export const STANDARD_SNARE_FORMULAS = ['Pit Illusion Snare', 'Shadow Cloak Snare']
export const formulaKey = (name: string) => name.trim().toLowerCase()

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
    { source: 'Brastlewark Snare Engineering', names: brastlewark
      ? c.brastlewarkFormulaMode === 'standard' ? STANDARD_SNARE_FORMULAS : c.brastlewarkFormulaMode === 'other' ? c.brastlewarkFormulaChoices ?? [] : []
      : [] },
    { source: 'Other', names: c.formulas ?? [] },
  ]
  const known = new Map<string, { name: string; source: string }>()
  for (const group of groups) for (const name of group.names) {
    if (name.trim() && !known.has(formulaKey(name))) known.set(formulaKey(name), { name, source: group.source })
  }
  return [...known.values()].sort((a, b) => a.name.localeCompare(b.name))
}
