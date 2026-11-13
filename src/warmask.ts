import { featTakenLevel } from './featChoices'
import type { Character } from './types'

export const WARMASK_SOURCES = {
  'The Gods': { skill: 'Religion', tradition: 'Divine' },
  'The Land': { skill: 'Nature', tradition: 'Primal' },
  Magic: { skill: 'Arcana', tradition: 'Arcane' },
  'The Unknown': { skill: 'Occultism', tradition: 'Occult' },
} as const

export function warmaskSource(c: Character) {
  if (!c.systems.includes('pf2e')) return undefined
  const choice = c.feats.find(feat => feat.name === 'Orc Warmask' && featTakenLevel(feat) <= c.level)?.choice
  return Object.entries(WARMASK_SOURCES).find(([name]) => name === choice)?.[1]
}
