import { featTakenLevel } from './featChoices'
import type { Character, ContentEntry } from './types'

export const MAGIC_TRADITIONS = ['Arcane', 'Divine', 'Occult', 'Primal'] as const
export type MagicTradition = typeof MAGIC_TRADITIONS[number]

export function minorMagicOptions(c: Character, entries: ContentEntry[]) {
  const tradition = c.minorMagic?.tradition
  if (!c.feats.some(feat => feat.name === 'Minor Magic' && featTakenLevel(feat) <= c.level)
    || !tradition || !MAGIC_TRADITIONS.includes(tradition)) return []
  return entries.filter(entry => entry.kind === 'spell' && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system))
    && entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
    && !entry.traits.some(trait => /^(uncommon|rare|unique|focus)$/i.test(trait))
    && !/^(uncommon|rare|unique)$/i.test(String(entry.data.rarity ?? ''))
    && String(entry.data.tradition ?? '').split(',').some(value => value.trim().toLowerCase() === tradition.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function minorMagicSpells(c: Character, entries: ContentEntry[]) {
  const tradition = c.minorMagic?.tradition
  if (!tradition) return []
  const options = minorMagicOptions(c, entries)
  const names = c.minorMagic?.cantrips?.[tradition] ?? []
  return [...new Set(names.slice(0, 2))].flatMap(name => {
    const entry = options.find(option => option.name === name)
    return entry ? [entry] : []
  })
}
