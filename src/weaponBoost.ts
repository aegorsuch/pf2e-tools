import type { Character, ContentEntry } from './types'

export function weaponBoostDamage(entry: ContentEntry | undefined, traits: string[]) {
  if (!entry) return undefined
  const die = traits.map(trait => /^boost\s+(?:1)?d(4|6|8|10|12)$/i.exec(trait.trim())?.[1]).find(Boolean)
  if (!die) return undefined
  const grade = /^(advanced|superior|elite|ultimate|paragon)\b/i.exec(entry.name)?.[1]?.toLowerCase()
  const dice = grade === 'paragon' ? 4 : grade === 'elite' || grade === 'ultimate' ? 3
    : grade === 'advanced' || grade === 'superior' ? 2 : 1
  return `${dice}d${die}`
}

export function weaponBoostChange(c: Character, id: string, active: boolean): Partial<Character> {
  const ids = (c.boostedWeaponIds ?? []).filter(existing => existing !== id)
  return { boostedWeaponIds: active ? [...ids, id] : ids }
}
