import { featTakenLevel } from './featChoices'
import type { Character, MechanicEnergy } from './types'

export const MECHANIC_ENERGIES: MechanicEnergy[] = ['acid', 'cold', 'electricity', 'fire', 'sonic']
export const energyNeutralizerCount = (c: Character) => c.level >= 15 ? 3 : c.level >= 10 ? 2 : 1
const hasFeat = (c: Character, name: string) => c.feats.some(feat => feat.name === name && featTakenLevel(feat) <= c.level)

export function energyNeutralizerResistances(c: Character, id: string) {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e') || !hasFeat(c, 'Energy Neutralizer')) return []
  const value = hasFeat(c, 'Enhanced Energy Neutralizer') ? c.level : Math.max(0, Math.floor((c.abilities.int - 10) / 2))
  const types = (c.mechanicArmorMods?.[id]?.energyNeutralizer ?? []).slice(0, energyNeutralizerCount(c))
  return value ? [...new Set(types.filter((type): type is MechanicEnergy => type !== null && MECHANIC_ENERGIES.includes(type)))]
    .map(damage => ({ damage, value, source: 'Energy Neutralizer' })) : []
}
