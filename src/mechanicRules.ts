import { abilityMod, conditionPenalty, proficiencyBonus } from './builder'
import type { Character } from './types'

export function mechanicClassDC(c: Character) {
  const rank = c.level >= 17 ? 3 : c.level >= 9 ? 2 : 1
  return 10 + abilityMod(c.abilities.int) + proficiencyBonus(rank, c.level) - conditionPenalty(c, 'int')
}
