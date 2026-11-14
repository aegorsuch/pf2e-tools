import { expect, it } from 'vitest'
import { weaponAttack } from './builder'
import { weaponModificationOptions, weaponModificationSlots } from './inventorWeapon'
import type { Character, ContentEntry, OwnedWeapon } from './types'

const entry = (name: string, data: ContentEntry['data'], traits: string[] = []): ContentEntry => ({
  id: `weapon:${name}`, systems: ['pf2e'], kind: 'weapon', source: 'official', name, level: 0,
  traits, description: '', data, effects: [], updatedAt: 1,
})

const base: Character = {
  id: 'inventor-mods', systems: ['pf2e'], name: 'Inventor', level: 16, ancestry: 'Human',
  className: 'Inventor', subclass: 'Weapon',
  abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

const item: OwnedWeapon = {
  id: 'innovation', name: 'Prototype', potency: 0, striking: 0, runes: [], inventorInnovation: true,
}

it('unlocks weapon innovation modification slots by class level and feats', () => {
  const prototype = entry('Prototype', { weapon_category: 'Simple', damage: '1d6 piercing', hands: 1 })
  expect(weaponModificationSlots({ ...base, level: 1 }, item, prototype)).toEqual(['initial'])
  expect(weaponModificationSlots({ ...base, level: 7 }, item, prototype)).toEqual(['initial', 'breakthrough'])
  expect(weaponModificationSlots({
    ...base, feats: [{ name: 'Manifold Modifications', type: 'Class Feat', level: 8 }],
  }, item, prototype)).toEqual(['initial', 'breakthrough', 'revolutionary', 'manifold'])
  expect(weaponModificationSlots({
    ...base, className: 'Rogue', feats: [{ name: 'Basic Modification', type: 'Class Feat', level: 8 }],
  }, item, prototype)).toEqual(['basic'])
})

it('filters modifications by weapon eligibility and prevents duplicate or conflicting picks', () => {
  const melee = entry('Prototype', { weapon_category: 'Simple', damage: '1d6 piercing', hands: 1 })
  const ranged = entry('Prototype', { weapon_category: 'Simple', weapon_type: 'Ranged', range: 60, damage: '1d6 piercing' })
  expect(weaponModificationOptions(base, item, melee, 'initial').map(option => option.name)).toContain('Complex Simplicity')
  expect(weaponModificationOptions(base, item, melee, 'initial').map(option => option.name)).not.toContain('Blunt Shot')
  expect(weaponModificationOptions(base, item, ranged, 'initial').map(option => option.name)).toContain('Blunt Shot')
  expect(weaponModificationOptions(base, item, ranged, 'initial').map(option => option.name)).not.toContain('Entangling Form')

  const configured: OwnedWeapon = { ...item, inventorModifications: {
    initial: 'Complex Simplicity', breakthrough: 'Manifold Alloy',
  } }
  const revolutionary = weaponModificationOptions(base, configured, melee, 'revolutionary').map(option => option.name)
  expect(revolutionary).not.toContain('Enhanced Damage')
  expect(weaponModificationOptions(base, configured, melee, 'initial').map(option => option.name)).not.toContain('Manifold Alloy')
})

it('applies selected Complex Simplicity damage and traits to weapon calculations', () => {
  const prototype = entry('Prototype', { weapon_category: 'Simple', damage: '1d6 piercing', hands: 1 })
  const configured: OwnedWeapon = { ...item, inventorModifications: {
    initial: 'Complex Simplicity', complexSimplicityTraits: ['Versatile P', 'Razing'],
  } }
  const attack = weaponAttack({ ...base, level: 1 }, [prototype], configured)
  expect(attack.damage).toMatch(/^1d8/)
  expect(attack.traits).toEqual(expect.arrayContaining(['Versatile P', 'Razing']))
  const incomplete = weaponAttack({ ...base, level: 1 }, [prototype], {
    ...item, inventorModifications: { initial: 'Complex Simplicity' },
  })
  expect(incomplete.damage).toMatch(/^1d6/)
})
