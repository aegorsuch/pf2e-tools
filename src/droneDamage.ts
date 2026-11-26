import { droneCustomizations, droneForceField, droneStats } from './drone'
import type { Character, ContentEntry } from './types'

export const DRONE_DAMAGE_TYPES = ['acid', 'bleed', 'bludgeoning', 'cold', 'electricity', 'fire', 'mental',
  'piercing', 'poison', 'slashing', 'sonic', 'spirit', 'vitality', 'void', 'other'] as const
export type DroneDamageType = typeof DRONE_DAMAGE_TYPES[number]

export function damageDrone(c: Character, entries: ContentEntry[], amount: number, type: DroneDamageType,
  area: boolean, nonlethal: boolean): Partial<Character> {
  const stats = droneStats(c, entries)
  if (!stats || !Number.isInteger(amount) || amount <= 0) throw new Error('Invalid drone damage')
  const hp = Math.min(stats.hp, Math.max(0, c.mechanicDroneHp ?? stats.hp))
  if (!hp || nonlethal || ['bleed', 'poison', 'spirit', 'vitality', 'void'].includes(type)
    || type === 'mental' && stats.mentalImmune) return {}
  const resistance = Math.max(0, ...stats.resistances.filter(item => item.damage === type
    || area && item.damage === 'acid, cold, electricity, and fire area damage'
      && ['acid', 'cold', 'electricity', 'fire'].includes(type)).map(item => item.value))
  const weakness = type === 'electricity' ? stats.electricityWeakness : 0
  let damage = Math.max(0, amount + weakness - resistance)
  const patch: Partial<Character> = {}
  const id = c.mechanicDroneArmorUpgrades?.[0]
  const entry = id && entries.find(item => item.id === id && !item.deleted && item.kind === 'item'
    && item.systems.includes('sf2e') && item.data.item_subcategory === 'Armor Upgrades')
  const hasSlot = droneCustomizations(c, 'Commercial')
    .some(item => item.name === 'Upgrade Slot')
  const field = entry && hasSlot ? droneForceField(entry) : undefined
  const state = id && field ? c.mechanicDroneForceFields?.[id] : undefined
  if (id && field && state?.active && !state.coolingDown && type !== 'mental' && type !== 'other' && damage > 0) {
    const current = Math.max(0, Math.min(field.hp, state.hp))
    const remaining = Math.max(0, current - damage)
    damage = Math.max(0, damage - current)
    patch.mechanicDroneForceFields = { ...c.mechanicDroneForceFields,
      [id]: { hp: remaining, active: remaining > 0, coolingDown: remaining === 0 } }
  }
  const temp = Math.max(0, c.mechanicDroneTemporaryHp ?? 0)
  if (damage > 0) {
    patch.mechanicDroneTemporaryHp = Math.max(0, temp - damage)
    patch.mechanicDroneHp = Math.max(0, hp - Math.max(0, damage - temp))
  }
  return patch
}
