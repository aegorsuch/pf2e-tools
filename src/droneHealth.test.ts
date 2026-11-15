import { expect, it } from 'vitest'
import { damageDrone } from './droneDamage'
import type { Character, ContentEntry } from './types'

const field: ContentEntry = { id: 'field', name: 'Force Field (Tactical)', kind: 'item', level: 4,
  source: 'official', systems: ['sf2e'], traits: ['Tech'], description: '', effects: [], updatedAt: 0,
  data: { item_subcategory: 'Armor Upgrades' } }
const c: Character = { id: 'm', name: 'Mechanic', systems: ['sf2e'], className: 'Mechanic', subclass: 'Drone', level: 10,
  abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, feats: [],
  equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  mechanicDroneChassis: 'Agile', mechanicDroneHp: 40, mechanicDroneTemporaryHp: 3,
  mechanicDroneCustomizations: { Commercial: [{ name: 'Upgrade Slot' }] }, mechanicDroneArmorUpgrades: ['field'],
  mechanicDroneForceFields: { field: { hp: 8, active: true, coolingDown: false } } }

it('applies weakness, then force field, temporary HP, and drone HP', () => {
  const patch = damageDrone(c, [field], 15, 'electricity', false, false)
  expect(patch.mechanicDroneForceFields?.field).toEqual({ hp: 0, active: false, coolingDown: true })
  expect(patch.mechanicDroneTemporaryHp).toBe(0)
  expect(patch.mechanicDroneHp).toBe(31)
  expect(JSON.parse(JSON.stringify({ ...c, ...patch })).mechanicDroneHp).toBe(31)
})

it('does not damage a shutdown drone or one immune to the damage', () => {
  expect(damageDrone(c, [field], 20, 'mental', false, false)).toEqual({})
  expect(damageDrone(c, [field], 20, 'poison', false, false)).toEqual({})
  expect(damageDrone(c, [field], 20, 'fire', false, true)).toEqual({})
  expect(damageDrone({ ...c, mechanicDroneHp: 0 }, [field], 20, 'fire', false, false)).toEqual({})
  const sapient: Character = { ...c, feats: [
    { name: 'Tactical Drone', type: 'Class Feat', level: 4 },
    { name: 'Advanced Drone', type: 'Class Feat', level: 8, choice: 'Burly' },
  ], mechanicDroneCustomizations: { Commercial: [{ name: 'Upgrade Slot' }], Advanced: [{ name: 'Sapient' }] } }
  expect(damageDrone(sapient, [field], 20, 'mental', false, false))
    .toMatchObject({ mechanicDroneTemporaryHp: 0, mechanicDroneHp: 23 })
})

it('applies the highest relevant resistance and ignores inactive force fields', () => {
  const shielding = { ...field, id: 'shield', name: 'Explosive Defense Unit' }
  const resistant: Character = { ...c, feats: [
    { name: 'Tactical Drone', type: 'Class Feat', level: 4 },
    { name: 'Advanced Drone', type: 'Class Feat', level: 8, choice: 'Burly' },
  ], mechanicDroneArmorUpgrades: ['shield'],
  mechanicDroneCustomizations: { Commercial: [{ name: 'Upgrade Slot' }], Advanced: [{ name: 'Resistant Panels', choice: 'fire' }] } }
  expect(damageDrone(resistant, [shielding], 10, 'fire', true, false))
    .toMatchObject({ mechanicDroneTemporaryHp: 0, mechanicDroneHp: 38 })
  const noSlot = { ...c, mechanicDroneCustomizations: { Commercial: [] } }
  expect(damageDrone(noSlot, [field], 10, 'bludgeoning', false, false))
    .toMatchObject({ mechanicDroneTemporaryHp: 0, mechanicDroneHp: 33 })
  expect(damageDrone(c, [field], 4, 'other', false, false))
    .toMatchObject({ mechanicDroneTemporaryHp: 0, mechanicDroneHp: 39 })
})

it('preserves active field HP when resistance prevents damage and removes grounded weakness', () => {
  const grounded: Character = { ...c, mechanicDroneCustomizations: {
    Commercial: [{ name: 'Upgrade Slot' }, { name: 'Grounded' }],
  }, mechanicArmorMods: { 'mechanic:drone': { energyNeutralizer: ['electricity'] } },
    feats: [{ name: 'Energy Neutralizer', type: 'Class Feat', level: 2 }] }
  const patch = damageDrone(grounded, [field], 1, 'electricity', false, false)
  expect(patch).toEqual({})
  expect(damageDrone({ ...c, mechanicDroneCustomizations: { Commercial: [{ name: 'Upgrade Slot' }, { name: 'Grounded' }] } },
    [field], 5, 'electricity', false, false).mechanicDroneForceFields?.field)
    .toEqual({ hp: 3, active: true, coolingDown: false })
})
