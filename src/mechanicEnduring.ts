import type { Character, MedicMod } from './types'

export const enduringWeaponMods = ['bigBoom', 'incapacitant', 'longRange', 'bunkerBuster',
  'pinpointShot', 'explosiveShot', 'glitchPulse'] as const
export const enduringGrenadeMods = ['bigBoom', 'incapacitant', 'longRange', 'bunkerBuster'] as const
export const enduringMineMods = ['bigBoom', 'bunkerBuster', 'incapacitant', 'smartMine', 'targeting',
  'healing', 'bigBang', 'blackHole'] as const

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
  | { kind: 'mine'; item: string; mod: typeof enduringMineMods[number]; label: string }
  | { kind: 'mine'; item: string; mod: 'damageType'; value: DamageType; label: string }
  | { kind: 'mine'; item: string; mod: 'transmutativeCasing' | 'exploitiveAssault'; value: string; label: string }
  | { kind: 'mine'; item: string; mod: 'debilitation'; value: string[]; label: string }
  | { kind: 'mine'; item: string; mod: 'medicMods'; value: MedicMod; label: string }
  | { kind: 'medic'; item: string; mod: MedicMod; label: string; index: number }
  | { kind: 'exo'; item: string; mod: 'debilitation'; value: string[]; label: string }

export function setEnduringMod(c: Character, choice?: EnduringModChoice): Partial<Character> {
  const weapons = { ...c.mechanicWeaponMods }
  const grenades = { ...c.mechanicGrenadeMods }
  const armor = { ...c.mechanicArmorMods }
  let mine = c.mechanicEnduringMine
  let deployed = c.mechanicDeployedMines
  let equipment = c.equipment
  let debilitation = c.mechanicExocortexDebilitation
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
  } else if (previous?.kind === 'mine') {
    const mod = enduringMineMods.find(value => value === previous.mod)
    if (mod || previous.mod === 'damageType' || previous.mod === 'transmutativeCasing'
      || previous.mod === 'exploitiveAssault' || previous.mod === 'debilitation' || previous.mod === 'medicMods') {
      mine = undefined
      deployed = deployed?.map(item => item.enduring ? {
        ...item, enduring: false, ...(mod ? { [mod]: false }
          : previous.mod === 'medicMods' ? { medicMods: (item.medicMods ?? []).filter(value => value !== previous.value) }
            : { [previous.mod]: undefined }),
      } : item)
    }
  } else if (previous?.kind === 'medic') {
    equipment = equipment.map(item => item.mechanicItemId === previous.item
      ? { ...item, mechanicMedicMods: (item.mechanicMedicMods ?? []).filter(mod => mod !== previous.mod) } : item)
  } else if (previous?.kind === 'exo' && previous.mod === 'debilitation') {
    debilitation = []
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
  else if (choice?.kind === 'mine' && choice.mod === 'damageType')
    mine = { enduring: true, baseDamage: ['bludgeoning', 'piercing', 'slashing'].includes(choice.value) ? 'piercing' : 'fire',
      damageType: choice.value }
  else if (choice?.kind === 'mine' && choice.mod === 'medicMods')
    mine = { enduring: true, medicMods: [choice.value] }
  else if (choice?.kind === 'mine' && 'value' in choice)
    mine = { enduring: true, [choice.mod]: choice.value }
  else if (choice?.kind === 'mine') mine = { enduring: true, [choice.mod]: true }
  else if (choice?.kind === 'medic') {
    if (!equipment[choice.index]) throw new Error('Enduring medic item is unavailable')
    equipment = equipment.map((item, index) => index === choice.index ? {
      ...item, mechanicItemId: choice.item,
      mechanicMedicMods: [...(item.mechanicMedicMods ?? []).filter(mod => mod !== choice.mod), choice.mod],
    } : item)
  }
  else if (choice?.kind === 'exo') debilitation = choice.value
  return { mechanicWeaponMods: weapons, mechanicGrenadeMods: grenades, mechanicArmorMods: armor,
    mechanicDroneKillbotActive: killbot, mechanicDroneDesperateRepairActive: desperateRepair,
    mechanicEnduringMine: mine, mechanicDeployedMines: deployed, equipment,
    mechanicExocortexDebilitation: debilitation, mechanicEnduringMod: choice }
}
