import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { armorClass, armorEntry, resistances, speed } from './builder'
import { ArmorList } from './GearSection'
import { INVENTOR_ARMOR_ID } from './grantedArmor'
import { armorModifications, armorModificationOptions, armorModificationSlots } from './inventorArmor'
import type { Character, ContentEntry } from './types'

const base: Character = {
  id: 'inventor', systems: ['pf2e'], name: 'Test', level: 15, className: 'Inventor', subclass: 'Armor',
  abilities: { str: 16, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('restricts slots by level, suit, prerequisites and duplicate selections without deleting choices', () => {
  const c: Character = { ...base, level: 6, inventorArmorModifications: { initial: 'Speed Boosters', breakthrough: 'Hyper Boosters' } }
  expect(armorModificationSlots(c)).toEqual(['initial'])
  expect(armorModifications(c).map(mod => mod.name)).toEqual(['Speed Boosters'])
  expect(armorModifications({ ...c, level: 7 }).map(mod => mod.name)).toEqual(['Speed Boosters', 'Hyper Boosters'])
  expect(armorModificationOptions({ ...c, level: 7, inventorArmorModifications: {} }, 'breakthrough').map(mod => mod.name))
    .not.toContain('Hyper Boosters')
  expect(armorModificationOptions({ ...c, inventorArmorSuit: 'Subterfuge Suit' }, 'initial').map(mod => mod.name))
    .not.toContain('Muscular Exoskeleton')
  expect(c.inventorArmorModifications?.breakthrough).toBe('Hyper Boosters')
})

it('applies worn resistance modifications, overdrive, enhancement and same-type resistance correctly', () => {
  const c: Character = { ...base, level: 15, feats: [{ name: 'Manifold Modifications', type: 'Class Feat', level: 8 }],
    inventorArmorModifications: { initial: 'Harmonic Oscillator', manifold: 'Metallic Reactance', breakthrough: 'Enhanced Resistance',
      enhanced: 'Metallic Reactance', revolutionary: 'Energy Barrier', overdrive: true } }
  const values = resistances(c, [])
  expect(values).toContainEqual({ damage: 'Electricity', value: 20, source: 'Metallic Reactance' })
  expect(values).toContainEqual({ damage: 'Force', value: 12, source: 'Harmonic Oscillator' })
  expect(values).toContainEqual({ damage: 'Fire', value: 9, source: 'Energy Barrier' })
  expect(resistances({ ...c, armors: [{ id: INVENTOR_ARMOR_ID, name: 'Power Suit', worn: false,
    potency: 0, resilient: 0, runes: [] }] }, [])).toEqual([])
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)).toContain('Enhanced resistance')
})

it('uses status stacking for boosters and applies heavy construction armor proficiency', () => {
  const c: Character = { ...base, level: 15, rankOverrides: { Crafting: 4 },
    inventorArmorModifications: { initial: 'Speed Boosters', breakthrough: 'Hyper Boosters', overdrive: true } }
  expect(speed(c, [])).toBe(55)
  expect(speed({ ...c, inventorArmorModifications: { ...c.inventorArmorModifications, overdrive: false } }, [])).toBe(35)
  const heavy: Character = { ...c, inventorArmorModifications: { breakthrough: 'Heavy Construction' } }
  expect(armorEntry(heavy, [], 'Power Suit')?.data).toMatchObject({ armor_category: 'Heavy', armor_group: 'Plate', medium_proficiency: true })
  const klass: ContentEntry = { id: 'inventor', name: 'Inventor', kind: 'class', source: 'official', systems: ['pf2e'],
    level: 0, traits: [], description: '', data: { medium_armor_proficiency: 'Expert' }, effects: [], updatedAt: 0 }
  expect(armorClass(heavy, [klass])).toBeGreaterThan(armorClass(heavy, []))
})
