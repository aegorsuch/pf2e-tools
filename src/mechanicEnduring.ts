import type { Character } from './types'

export const enduringWeaponMods = ['bigBoom', 'incapacitant', 'longRange', 'bunkerBuster',
  'pinpointShot', 'explosiveShot', 'glitchPulse'] as const
export const enduringGrenadeMods = ['bigBoom', 'incapacitant', 'longRange', 'bunkerBuster'] as const

type WeaponMod = typeof enduringWeaponMods[number]
type GrenadeMod = typeof enduringGrenadeMods[number]
type DamageType = NonNullable<NonNullable<Character['mechanicWeaponMods']>[string]['damageType']>
type ConfiguredMod = { mod: 'damageType'; value: DamageType }
  | { mod: 'transmutativeCasing' | 'exploitiveAssault'; value: string }
export type EnduringModChoice =
  | { kind: 'weapon'; item: string; mod: WeaponMod; label: string }
  | { kind: 'grenade'; item: string; mod: GrenadeMod; label: string }
  | ({ kind: 'weapon' | 'grenade'; item: string; label: string } & ConfiguredMod)
  | { kind: 'armor'; item: string; mod: 'magneticLevitators'; label: string }
  | { kind: 'armor'; item: string; mod: 'energyNeutralizer'; value: NonNullable<NonNullable<Character['mechanicArmorMods']>[string]['energyNeutralizer']>; label: string }
  | { kind: 'drone'; item: string; mod: 'killbot' | 'desperateRepair'; label: string }

export function setEnduringMod(c: Character, choice?: EnduringModChoice): Partial<Character> {
  const weapons = { ...c.mechanicWeaponMods }
  const grenades = { ...c.mechanicGrenadeMods }
  const armor = { ...c.mechanicArmorMods }
  let killbot = c.mechanicDroneKillbotActive
  let desperateRepair = c.mechanicDroneDesperateRepairActive
  const previous = c.mechanicEnduringMod
  const configured = previous?.mod === 'damageType' || previous?.mod === 'transmutativeCasing'
    || previous?.mod === 'exploitiveAssault'
  if (previous?.kind === 'weapon' && enduringWeaponMods.some(mod => mod === previous.mod) && weapons[previous.item]) {
    weapons[previous.item] = { ...weapons[previous.item], [previous.mod]: false }
  } else if (previous?.kind === 'grenade' && enduringGrenadeMods.some(mod => mod === previous.mod) && grenades[previous.item]) {
    grenades[previous.item] = { ...grenades[previous.item], [previous.mod]: false }
  } else if (previous?.kind === 'weapon' && configured && weapons[previous.item]) {
    weapons[previous.item] = { ...weapons[previous.item], [previous.mod]: undefined }
  } else if (previous?.kind === 'grenade' && configured && grenades[previous.item]) {
    grenades[previous.item] = { ...grenades[previous.item], [previous.mod]: undefined }
  } else if (previous?.kind === 'armor' && previous.mod === 'magneticLevitators' && armor[previous.item]) {
    armor[previous.item] = { ...armor[previous.item], magneticLevitators: false }
  } else if (previous?.kind === 'armor' && previous.mod === 'energyNeutralizer' && armor[previous.item]) {
    armor[previous.item] = { ...armor[previous.item], energyNeutralizer: [] }
  } else if (previous?.kind === 'drone' && previous.mod === 'killbot') {
    killbot = false
  } else if (previous?.kind === 'drone' && previous.mod === 'desperateRepair') {
    desperateRepair = false
  }
  if (choice?.kind === 'weapon')
    weapons[choice.item] = { ...weapons[choice.item], [choice.mod]: 'value' in choice ? choice.value : true }
  else if (choice?.kind === 'grenade')
    grenades[choice.item] = { ...grenades[choice.item], [choice.mod]: 'value' in choice ? choice.value : true }
  else if (choice?.kind === 'armor' && choice.mod === 'magneticLevitators')
    armor[choice.item] = { ...armor[choice.item], magneticLevitators: true }
  else if (choice?.kind === 'armor' && choice.mod === 'energyNeutralizer')
    armor[choice.item] = { ...armor[choice.item], energyNeutralizer: choice.value }
  else if (choice?.kind === 'drone' && choice.mod === 'killbot') killbot = true
  else if (choice?.kind === 'drone' && choice.mod === 'desperateRepair') desperateRepair = true
  return { mechanicWeaponMods: weapons, mechanicGrenadeMods: grenades, mechanicArmorMods: armor,
    mechanicDroneKillbotActive: killbot, mechanicDroneDesperateRepairActive: desperateRepair, mechanicEnduringMod: choice }
}
