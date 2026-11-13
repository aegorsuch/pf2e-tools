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

it('applies Starfinder ancestral weapon familiarity to elf bows, rapier, and elf-trait weapons', () => {
  const source: ContentEntry = { ...content('Ancestral Weapon Familiarity', 'feat', {}, ['Elf']), systems: ['sf2e'],
    description: 'You gain access to all uncommon weapons with your ancestry trait.\n\nOption(s): all bows or nano-edge rapier' }
  const bow = { ...weapon('Star Bow', 'Advanced'), data: { weapon_category: 'Advanced', weapon_group: 'Bow' } }
  const crossbow = { ...weapon('Crossbow', 'Advanced'), data: { weapon_category: 'Advanced', weapon_group: 'Crossbow' } }
  const rapier = weapon('Nano-Edge Rapier', 'Martial')
  const ancestral = weapon('Elven Laser', 'Advanced', ['Elf'], 'uncommon')
  const c: Character = { ...character, systems: ['sf2e'], ancestry: 'Elf',
    feats: [selected('Ancestral Weapon Familiarity')] }
  const entries = [wizard, source, bow, crossbow, rapier, ancestral]
  expect(attack(c, bow, entries).rank).toBe(1)
  expect(attack(c, crossbow, entries).rank).toBe(0)
  expect(attack(c, rapier, entries).rank).toBe(2)
  expect(attack({ ...c, feats: [selected('Ancestral Weapon Familiarity', 'all bows')] }, rapier, entries).rank).toBe(2)
  expect(attack({ ...c, feats: [selected('Ancestral Weapon Familiarity', 'nano-edge rapier')] }, bow, entries).rank).toBe(1)
  expect(attack(c, bow, entries).criticalSpecialization).toBe(true)
  expect(weaponAccessSources(c, entries, ancestral)).toContain(source.name)
  expect(weaponAccessSources(c, entries, rapier)).not.toContain(source.name)
  expect(attack({ ...c, level: 4 }, bow, entries).criticalSpecialization).toBe(false)
  expect(attack({ ...c, feats: [] }, bow, entries).rank).toBe(0)
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

it('allows culturally common weapons and makes the rare Shobhad exception explicit', () => {
  const common = weapon('Cultural Rifle', 'Martial', ['Dwarf'])
  const rare = weapon('Shobhad Longrifle', 'Martial', [], 'rare')
  const entries = [wizard, dwarf, common, rare]
  const selection = selected('Unconventional Weaponry', common.name)
  const c = { ...character, feats: [selection] }
  expect(featChoiceOptions('Unconventional Weaponry', c, entries, '')).toContain(common.name)
  expect(featChoiceOptions('Unconventional Weaponry', c, entries, '')).toContain('Shobhad Longrifle (Pathfinder)')
  expect(weaponAccessSources(c, entries, common)).toEqual([])
  expect(weaponAccessSources({ ...c, feats: [{ ...selection, culturalWeapon: true }] }, entries, common))
    .toEqual(['Unconventional Weaponry'])
  const rifle = { ...selection, choice: rare.name, culturalWeapon: true }
  expect(weaponAccessSources({ ...c, feats: [rifle] }, entries, rare)).toEqual([])
  expect(weaponAccessSources({ ...c, feats: [{ ...rifle, rareWeaponOverride: true }] }, entries, rare))
    .toEqual(['Unconventional Weaponry'])
})

it('keeps Pathfinder and Starfinder Shobhad Longrifles distinct across saved selections', () => {
  const pf = { ...weapon('Shobhad Longrifle', 'Martial', [], 'rare'), id: 'pf', data: {
    weapon_category: 'Martial', damage: '1d6 P', rarity: 'rare', weapon_group: 'Firearm' } }
  const sf: ContentEntry = { ...weapon('Shobhad Longrifle', 'Martial', ['Shobhad']), id: 'sf', systems: ['sf2e'],
    data: { weapon_category: 'Martial', damage: '1d8 P', rarity: 'common', weapon_group: 'Sniper' } }
  const c: Character = { ...character, systems: ['pf2e', 'sf2e'], feats: [
    { ...selected('Unconventional Weaponry', 'Shobhad Longrifle (Starfinder)'), culturalWeapon: true },
  ] }
  for (const entries of [[wizard, pf, sf], [wizard, sf, pf]]) {
    expect(gearPickerEntries(entries, 'weapon').map(entry => entry.name)).toEqual(expect.arrayContaining([
      'Shobhad Longrifle (Pathfinder)', 'Shobhad Longrifle (Starfinder)',
    ]))
    const make = (name: string) => weaponAttack(c, entries, { id: name, name, potency: 0, striking: 0, runes: [] })
    expect(make('Shobhad Longrifle (Starfinder)')).toMatchObject({ rank: 2, entry: { id: 'sf' } })
    expect(make('Shobhad Longrifle (Pathfinder)')).toMatchObject({ rank: 1, entry: { id: 'pf' } })
    expect(make('Shobhad Longrifle').entry?.id).toBe(entries[1].id)
  }
  const sfOnly = { ...c, systems: ['sf2e'] as Character['systems'] }
  expect(gearPickerEntries([sf], 'weapon').map(entry => entry.name)).toEqual(['Shobhad Longrifle (Starfinder)'])
  expect(gearPickerEntries([pf], 'weapon').map(entry => entry.name)).toEqual(['Shobhad Longrifle (Pathfinder)'])
  expect(weaponAttack(sfOnly, [wizard, sf], { id: 'w', name: 'Shobhad Longrifle (Starfinder)', potency: 0, striking: 0, runes: [] }).rank).toBe(2)
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
