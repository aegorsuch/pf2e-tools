import type { Character, ContentEntry } from './types.js'

export const FULMINATING_SHOT_ELEMENTS = ['Acid', 'Cold', 'Electricity', 'Fire'] as const
export type FulminatingShotElement = typeof FULMINATING_SHOT_ELEMENTS[number]

export function fulminatingShotBonus(c: Character) {
  const activeFeat = c.feats.some(feat => feat.name === 'Fulminating Shot'
    && (feat.takenLevel ?? feat.level) <= c.level)
  const element = FULMINATING_SHOT_ELEMENTS.find(option => option === c.fulminatingShotElement)
  if (!c.systems.includes('pf2e') || !activeFeat || !c.fulminatingShotActive || !element) return undefined
  const dice = c.level >= 18 ? 3 : c.level >= 12 ? 2 : 1
  return `${dice}d6 ${element.toLowerCase()}`
}

export function fulminatingShotDamage(c: Character, entry?: ContentEntry) {
  const group = String(entry?.data.weapon_group ?? '').toLowerCase()
  return group === 'firearm' || group === 'crossbow' ? fulminatingShotBonus(c) : undefined
}
