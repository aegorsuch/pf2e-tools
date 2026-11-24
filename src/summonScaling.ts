import type { Character } from './types'
import { getSettings } from './settings'
import { fiendLevelLimit, plantLevelLimit, undeadLevelLimit, type SummonedFiend } from './summonedFiends'

export function creatureScaling(level: number, target: number) {
  const index = (value: number) => value + 1
  const delta = (table: number[]) => table[index(target)] - table[index(level)]
  return {
    ac: delta([14, 15, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29, 30, 32, 33, 35, 36]),
    checks: delta([5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 18, 19, 21, 22, 23, 25, 26]),
    skills: delta([4, 5, 6, 7, 9, 10, 12, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27]),
    hp: delta([7, 15, 20, 30, 45, 60, 75, 95, 115, 135, 155, 175, 195, 215, 235, 255, 275]),
    attack: delta([6, 6, 7, 9, 10, 12, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28]),
    damage: delta([3, 4, 5, 8, 10, 12, 13, 15, 17, 18, 20, 22, 23, 25, 27, 28, 30]),
    ability: delta([2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6]),
  }
}

export function scaledDamage(text: string, increase: number) {
  return text.replace(/^(\d+d\d+)([+–-]\d+)?/i, (_, dice: string, modifier?: string) => {
    const total = Number((modifier ?? '0').replace('–', '-')) + increase
    return `${dice}${total >= 0 ? '+' : ''}${total}`
  })
}

export function scaledSummon(c: Character, kind: 'fiend' | 'plant' | 'undead', creature: SummonedFiend) {
  const rank = c.summonInnateRanks?.[kind]
  if (!getSettings().innateAutoHeighten || rank === undefined || creature.level < -1 || creature.level > 15) return creature
  const heightened = Math.min(10, Math.max(rank, Math.ceil(c.level / 2)))
  const limit = (kind === 'fiend' ? fiendLevelLimit : kind === 'plant' ? plantLevelLimit : undeadLevelLimit)(heightened)
  const target = Math.max(creature.level, limit ?? creature.level)
  if (target === creature.level) return creature
  const delta = creatureScaling(creature.level, target)
  return { ...creature, level: target,
    abilities: creature.abilities.map(value => value !== null && value >= 0 ? value + delta.ability : value),
    hp: creature.hp === undefined ? undefined : creature.hp + delta.hp,
    ac: creature.ac === undefined ? undefined : creature.ac + delta.ac,
    saves: creature.saves.map(value => value === null ? null : value + delta.checks),
    perception: creature.perception === undefined ? undefined : creature.perception + delta.checks,
    skills: creature.skills.replace(/\+(\d+)/g, (_, value: string) => `+${Number(value) + delta.skills}`),
    attacks: creature.attacks.map(value => value.replace(/^(.*?\s)\+(\d+)/, (_, prefix: string, bonus: string) =>
      `${prefix}+${Number(bonus) + delta.attack}`).replace(/(—\s*)(\d+d\d+(?:[+–-]\d+)?)/i,
      (_, prefix: string, damage: string) => `${prefix}${scaledDamage(damage, delta.damage)}`)),
  }
}
