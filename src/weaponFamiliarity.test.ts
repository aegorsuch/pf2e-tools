import { expect, it } from 'vitest'
import { featChoiceOptions, gearPickerEntries, weaponAccessSources, weaponAttack } from './builder'
import { gearAccess } from './gearAccess'
import type { Character, ContentEntry } from './types'

const character: Character = {
  id: 'c', systems: ['pf2e'], name: 'Test', level: 5, ancestry: 'Dwarf', className: 'Wizard',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const content = (name: string, kind: ContentEntry['kind'], data: ContentEntry['data'] = {}, traits: string[] = []): ContentEntry =>
  ({ id: name, name, kind, data, traits, systems: ['pf2e'], source: 'official', level: 0, description: '', effects: [], updatedAt: 0 })
const weapon = (name: string, category: string, traits: string[] = [], rarity = 'common') =>
  content(name, 'weapon', { weapon_category: category, damage: '1d6 P', rarity }, traits)
const wizard = content('Wizard', 'class', { attack_proficiency: 'Expert in simple weapons, Trained in martial weapons' })
const dwarf = content('Dwarf', 'ancestry')
const selected = (name: string, choice?: string, level = 1): Character['feats'][number] => ({ name, choice, level, type: 'Ancestry Feat' })
const attack = (c: Character, entry: ContentEntry, entries: ContentEntry[]) =>
  weaponAttack(c, entries, { id: 'w', name: entry.name, potency: 0, striking: 0, runes: [] })

it('remaps Dwarven weapons to scaling category proficiency without changing unrelated weapons or granting universal training', () => {
  const martial = weapon('Long Hammer', 'Martial', ['Dwarf'])
  const advanced = weapon('Dwarven Waraxe', 'Advanced', ['Dwarf'], 'uncommon')
  const named = weapon('Battle Axe', 'Martial')
  const other = weapon('Longsword', 'Martial')
  const entries = [wizard, dwarf, martial, advanced, named, other]
  const c = { ...character, feats: [selected('Dwarven Weapon Familiarity')] }
  expect(attack(c, martial, entries)).toMatchObject({ rank: 2, prof: 9, criticalSpecialization: true })
  expect(attack(c, advanced, entries).rank).toBe(1)
  expect(attack(c, named, entries).rank).toBe(2)
  expect(attack(c, other, entries)).toMatchObject({ rank: 1, criticalSpecialization: false })
  expect(attack({ ...c, level: 4 }, martial, entries).criticalSpecialization).toBe(false)
  expect(attack({ ...c, feats: [selected('Dwarven Weapon Familiarity', undefined, 9)] }, martial, entries).rank).toBe(1)
  expect(attack({ ...c, className: undefined }, advanced, entries).rank).toBe(0)
})

it('grants only stated weapon Access, not all ancestry gear or rare versions, and persists GM approval separately', () => {
  const uncommon = weapon('Dwarven Waraxe', 'Advanced', ['Dwarf'], 'uncommon')
  const rare = { ...uncommon, id: 'rare-waraxe', data: { ...uncommon.data, rarity: 'rare' }, traits: ['Dwarf', 'Rare'] }
  const armor = content('Dwarf Armor', 'armor', { rarity: 'uncommon' }, ['Dwarf'])
  const entries = [dwarf, uncommon, rare, armor]
  const c = { ...character, feats: [selected('Dwarven Weapon Familiarity')] }
  expect(gearAccess(character, entries, uncommon)).toMatchObject({ automatic: false, approved: false })
  expect(gearAccess(c, entries, uncommon)).toMatchObject({ automatic: true, sources: ['Dwarven Weapon Familiarity'] })
  expect(gearAccess(c, entries, rare)?.automatic).toBe(false)
  expect(gearAccess(c, entries, armor)?.automatic).toBe(false)
  const saved = JSON.parse(JSON.stringify({ ...c, gearAccessOverrides: [armor.id] }))
  expect(gearAccess(saved, entries, armor)?.approved).toBe(true)
  expect(gearAccess(saved, entries, rare)?.approved).toBe(false)
  expect(gearAccess(c, entries, weapon('Longsword', 'Martial'))).toBeUndefined()
})

it('uses membership achievements for armor Access without conflating permission with proficiency', () => {
  const armor = content('Hellknight Plate', 'armor', {
    rarity: 'uncommon', access: 'A character who is a member of the Hellknights has access to this option.',
  })
  expect(gearAccess(character, [armor], armor)?.automatic).toBe(false)
  expect(gearAccess({ ...character, achievements: ['Member of the Hellknights'] }, [armor], armor)?.automatic).toBe(true)
  const sf: ContentEntry = { ...armor, id: 'sf-plate', systems: ['sf2e'], data: { rarity: 'common' } }
  const mixed = [armor, sf]
  expect(gearPickerEntries(mixed, 'armor')).toEqual([armor])
  expect(gearAccess(character, mixed, gearPickerEntries(mixed, 'armor')[0])?.automatic).toBe(false)
  expect(gearAccess(character, [sf], gearPickerEntries([sf], 'armor')[0])).toBeUndefined()
})

it('applies Unconventional Weaponry only to its valid selected weapon and checks advanced qualification at acquisition', () => {
  const martial = weapon('Clan Pistol', 'Martial', ['Dwarf'], 'uncommon')
  const advanced = weapon('Dwarven Waraxe', 'Advanced', ['Dwarf'], 'uncommon')
  const other = weapon('Other Dwarf Weapon', 'Martial', ['Dwarf'], 'uncommon')
  const entries = [wizard, dwarf, martial, advanced, other]
  const c = { ...character, feats: [selected('Unconventional Weaponry', martial.name)] }
  expect(attack(c, martial, entries).rank).toBe(2)
  expect(attack(c, other, entries).rank).toBe(1)
  expect(weaponAccessSources(c, entries, martial)).toEqual(['Unconventional Weaponry'])
  const untrained = content('Wizard', 'class', { attack_proficiency: 'Expert in simple weapons' })
  const noMartial = [untrained, ...entries.slice(1)]
  expect(featChoiceOptions('Unconventional Weaponry', c, noMartial, 'ancestry:1:0')).not.toContain(advanced.name)
  expect(attack({ ...c, feats: [selected('Unconventional Weaponry', advanced.name)] }, advanced, noMartial).rank).toBe(0)
  expect(attack({ ...c, feats: [selected('Unconventional Weaponry', advanced.name)] }, advanced, entries).rank).toBe(1)
  expect(weaponAccessSources({ ...c, feats: [selected('Unconventional Weaponry', martial.name, 9)] }, entries, martial)).toEqual([])
})

it('requires cultural eligibility confirmation rather than treating every uncommon weapon as ancestral', () => {
  const katana = weapon('Katana', 'Martial', [], 'uncommon')
  const entries = [wizard, katana]
  const c = { ...character, feats: [selected('Unconventional Weaponry', katana.name)] }
  expect(weaponAccessSources(c, entries, katana)).toEqual([])
  expect(attack(c, katana, entries).rank).toBe(1)
  const confirmed = { ...c, feats: [{ ...c.feats[0], culturalWeapon: true }] }
  expect(weaponAccessSources(confirmed, entries, katana)).toEqual(['Unconventional Weaponry'])
  expect(attack(confirmed, katana, entries).rank).toBe(2)
  const nodachi = weapon('Nodachi', 'Advanced', [], 'uncommon')
  const overlapping = { ...character, feats: [selected('Oni Weapon Familiarity'),
    { ...selected('Unconventional Weaponry', nodachi.name), culturalWeapon: true }] }
  expect(attack(overlapping, nodachi, [wizard, nodachi]).rank).toBe(2)
})

it('does not mistake legacy named training for training with all ancestry weapons', () => {
  const trident = weapon('Trident', 'Martial')
  const ancestral = weapon('Azarketi Weapon', 'Advanced', ['Azarketi'], 'uncommon')
  const c = { ...character, className: undefined, feats: [selected('Azarketi Weapon Familiarity')] }
  expect(attack(c, trident, [trident, ancestral]).rank).toBe(1)
  expect(attack(c, ancestral, [trident, ancestral]).rank).toBe(0)
  expect(attack(c, trident, [trident, ancestral]).criticalSpecialization).toBe(false)
})

it('requires Tengu daily sword practice to target an owned sword without granting Access to that sword', () => {
  const sword = { ...weapon('Falcata', 'Advanced', [], 'uncommon'), data: { weapon_category: 'Advanced', weapon_group: 'Sword', rarity: 'uncommon' } }
  const c = { ...character, feats: [selected('Tengu Weapon Familiarity', sword.name)] }
  expect(attack(c, sword, [wizard, sword]).rank).toBe(0)
  const owned = { ...c, equipment: [{ name: sword.name, qty: 1 }] }
  expect(attack(owned, sword, [wizard, sword]).rank).toBe(1)
  expect(weaponAccessSources(owned, [wizard, sword], sword)).toEqual([])
})
