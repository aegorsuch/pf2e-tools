import type { ContentEntry, GameSystem } from './types'

export type GearSystem = GameSystem | 'both'

export function matchesGearSystem(entry: ContentEntry, system: GearSystem, enabled: GameSystem[]) {
  return entry.systems.some(value => enabled.includes(value) && (system === 'both' || value === system))
}
