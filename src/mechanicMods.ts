import { featTakenLevel } from './featChoices'
import type { Character } from './types'

export function boostingTheBasics(c: Character) {
  return c.className === 'Mechanic' && c.systems.includes('sf2e')
    && c.feats.some(feat => feat.name === 'Boosting The Basics' && featTakenLevel(feat) <= c.level)
}
