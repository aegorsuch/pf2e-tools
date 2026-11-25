import { expect, it } from 'vitest'
import { featChoiceOptions, gearPickerEntries, unconventionalWeaponChoice, weaponAccessSources, weaponAttack } from './builder'
import { gearAccess } from './gearAccess'
import { getSettings, updateSettings } from './settings'
import { weaponFamiliarity } from './weaponFamiliarity'
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

it('grants access only to uncommon magical orc tattoos from Tattooed Historian', () => {
  const tattoo = content('Orc tattoo', 'item', { access: 'Membership in a particular group' }, ['Orc', 'Magical', 'Tattoo', 'Uncommon'])
  const c = { ...character, feats: [selected('Tattooed Historian Dedication', undefined, 2)] }
  expect(gearAccess(character, [tattoo], tattoo)?.automatic).toBe(false)
  expect(gearAccess(c, [tattoo], tattoo)).toMatchObject({ automatic: true, sources: ['Tattooed Historian Dedication'] })
  expect(gearAccess(c, [tattoo], { ...tattoo, traits: ['Orc', 'Occult', 'Tattoo', 'Uncommon'] })?.automatic).toBe(true)
  for (const traits of [['Orc', 'Magical', 'Tattoo', 'Rare'], ['Magical', 'Tattoo', 'Uncommon'],
    ['Orc', 'Tattoo', 'Uncommon'], ['Orc', 'Magical', 'Uncommon']]) {
    expect(gearAccess(c, [tattoo], { ...tattoo, traits })?.automatic).toBe(false)
  }
  expect(gearAccess({ ...c, level: 1 }, [tattoo], tattoo)?.automatic).toBe(false)
})

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

it('applies Explosive Savant proficiency to bombs and firearms without granting Access or critical specialization', () => {
  const bomb = content('Alchemical Bomb', 'weapon', { weapon_category: 'Martial', weapon_group: 'Bomb', damage: '1d6 F' })
  const firearm = content('Arquebus', 'weapon', { weapon_category: 'Martial', weapon_group: 'Firearm', damage: '1d8 P', rarity: 'uncommon' })
  const advanced = content('Advanced Firearm', 'weapon', { weapon_category: 'Advanced', weapon_group: 'Firearm', damage: '1d8 P' })
  const unrelated = weapon('Longsword', 'Martial')
  const entries = [wizard, bomb, firearm, advanced, unrelated]
  const c = { ...character, feats: [selected('Explosive Savant')] }
  for (const entry of [bomb, firearm]) expect(attack(c, entry, entries)).toMatchObject({ rank: 2, prof: 9, criticalSpecialization: false })
  expect(attack(c, advanced, entries).rank).toBe(1)
  expect(attack(c, unrelated, entries).rank).toBe(1)
  expect(attack({ ...c, feats: [] }, firearm, entries).rank).toBe(1)
  expect(attack({ ...c, feats: [selected('Explosive Savant', undefined, 9)] }, firearm, entries).rank).toBe(1)
  expect(attack({ ...c, className: undefined }, bomb, entries).rank).toBe(0)
  expect(weaponAccessSources(c, entries, firearm)).not.toContain('Explosive Savant')
  const equipmentBomb = content("Alchemist's Fire (Lesser)", 'item', {}, ['Alchemical', 'Bomb', 'Consumable'])
  expect(weaponFamiliarity(c, equipmentBomb, 'Martial', entries).proficiency).toBe('Simple')
  expect(weaponFamiliarity({ ...c, feats: [] }, equipmentBomb, 'Martial', entries).proficiency).toBeUndefined()
})

it('applies Space Pirate familiarity to named weapon families and razing modes at expert proficiency', () => {
  const pirate: Character = { ...character, systems: ['sf2e'], level: 2,
    feats: [{ name: 'Space Pirate Dedication', type: 'Archetype Feat', level: 2 }] }
  const klass = { ...wizard, systems: ['sf2e'] as Character['systems'] }
  const cutlass = { ...weapon('Advanced Phase Cutlass', 'Martial'), systems: ['sf2e'] as Character['systems'] }
  const flail = { ...weapon('Electroflail', 'Advanced'), systems: ['sf2e'] as Character['systems'] }
  const rapier = { ...weapon('Nano-Edge Rapier', 'Martial'), systems: ['sf2e'] as Character['systems'] }
  const razing = { ...weapon('Razing Gun', 'Martial', ['Razing']), systems: ['sf2e'] as Character['systems'] }
  const other = { ...weapon('Longsword', 'Martial'), systems: ['sf2e'] as Character['systems'] }
  const entries = [klass, cutlass, flail, rapier, razing, other]
  for (const item of [cutlass, rapier, razing])
    expect(attack(pirate, item, entries)).toMatchObject({ rank: 2, criticalSpecialization: true })
  expect(attack(pirate, flail, entries)).toMatchObject({ rank: 1, criticalSpecialization: false })
  expect(attack(pirate, other, entries)).toMatchObject({ rank: 1, criticalSpecialization: false })
  expect(attack({ ...pirate, level: 1 }, cutlass, entries).rank).toBe(1)
  expect(attack({ ...pirate, systems: ['pf2e'] }, cutlass, entries).rank).toBe(1)
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

it('gives Dwarves all tagged and listed Starfinder weapons with no weapon choice', () => {
  const source: ContentEntry = { ...content('Ancestral Weapon Familiarity', 'feat', {}, ['Dwarf']), systems: ['sf2e'],
    description: 'You gain access to all uncommon weapons with your ancestry trait.' }
  const dwarfTagged = weapon('Dwarf Laser Axe', 'Advanced', ['Dwarf'], 'uncommon')
  const requested = ['Artillery Laser', 'Breaching Gun', 'Hammer', 'Machine Gun', 'Roto Laser', 'Stellar Cannon']
    .map(name => weapon(name, 'Advanced', [], 'uncommon'))
  const unrelated = weapon('Human Plasma Rifle', 'Advanced', ['Human'], 'uncommon')
  const entries = [wizard, source, dwarfTagged, ...requested, unrelated]
  const c: Character = { ...character, systems: ['sf2e'], ancestry: 'Dwarf',
    feats: [selected('Ancestral Weapon Familiarity', 'Unwanted choice')] }
  for (const entry of [dwarfTagged, ...requested]) {
    expect(attack(c, entry, entries)).toMatchObject({ rank: 1, criticalSpecialization: true })
    expect(weaponAccessSources(c, entries, entry)).toContain(source.name)
  }
  expect(attack(c, unrelated, entries).rank).toBe(0)
  expect(featChoiceOptions('Ancestral Weapon Familiarity', c, entries, '')).toBeUndefined()
})

it('applies the full adopted Dwarf weapon list without a choice and only after adoption', () => {
  const source: ContentEntry = { ...content('Ancestral Weapon Familiarity', 'feat', {}, ['Dwarf']), systems: ['sf2e'],
    description: 'Option(s): artillery laser, hammer' }
  const artillery = weapon('Artillery Laser', 'Advanced', [], 'uncommon')
  const hammer = weapon('Hammer', 'Martial')
  const tagged = weapon('Dwarf Laser Axe', 'Advanced', ['Dwarf'], 'uncommon')
  const unrelated = weapon('Human Plasma Rifle', 'Advanced', ['Human'])
  const entries = [wizard, source, artillery, hammer, tagged, unrelated]
  const familiarity = { ...selected(source.name, undefined, 1), slot: 'ancestry:5:0', takenLevel: 5, sourceId: source.id }
  const c: Character = { ...character, ancestry: 'Human', systems: ['sf2e'], level: 9, feats: [
    { ...selected('Adopted Ancestry', 'Dwarf'), type: 'General Feat', takenLevel: 5 }, familiarity,
  ] }
  for (const choice of [undefined, 'Artillery Laser']) {
    const next = { ...c, feats: [c.feats[0], { ...familiarity, choice }] }
    expect(attack(next, artillery, entries)).toMatchObject({ rank: 1, criticalSpecialization: true })
    expect(attack(next, hammer, entries)).toMatchObject({ rank: 2, criticalSpecialization: true })
    expect(attack(next, tagged, entries).rank).toBe(1)
    expect(attack(next, unrelated, entries).rank).toBe(0)
    expect(weaponAccessSources(next, entries, artillery)).toContain(source.name)
  }
  expect(attack({ ...c, level: 4 }, artillery, entries)).toMatchObject({ rank: 0, criticalSpecialization: false })
  expect(attack({ ...c, feats: [c.feats[0], { ...familiarity, slot: 'ancestry:1:0', takenLevel: 1 }] }, artillery, entries).rank).toBe(0)
})

it('allows rarity alone while preserving stated weapon grants and saved GM approval', () => {
  const uncommon = weapon('Dwarven Waraxe', 'Advanced', ['Dwarf'], 'uncommon')
  const rare = { ...uncommon, id: 'rare-waraxe', data: { ...uncommon.data, rarity: 'rare' }, traits: ['Dwarf', 'Rare'] }
  const armor = content('Dwarf Armor', 'armor', { rarity: 'uncommon' }, ['Dwarf'])
  const entries = [dwarf, uncommon, rare, armor]
  const c = { ...character, feats: [selected('Dwarven Weapon Familiarity')] }
  expect(gearAccess(character, entries, uncommon)).toMatchObject({ automatic: true, approved: false })
  expect(gearAccess(c, entries, uncommon)).toMatchObject({ automatic: true, sources: ['Dwarven Weapon Familiarity'] })
  expect(gearAccess(c, entries, rare)?.automatic).toBe(true)
  expect(gearAccess(c, entries, armor)?.automatic).toBe(true)
  const saved = JSON.parse(JSON.stringify({ ...c, gearAccessOverrides: [armor.id] }))
  expect(gearAccess(saved, entries, armor)?.approved).toBe(true)
  expect(gearAccess(saved, entries, rare)?.approved).toBe(false)
  expect(gearAccess(c, entries, weapon('Longsword', 'Martial'))).toBeUndefined()
})

it('grants Inventors Access to uncommon firearms and firearm ammunition, but not rare firearms', () => {
  const firearm = content('Air Repeater', 'weapon', {
    weapon_category: 'Simple', weapon_group: 'Firearm', rarity: 'uncommon', damage: '1d4 P',
  })
  const ammunition = content('Firearm Ammunition (10 rounds)', 'weapon', {
    weapon_category: 'Ammunition', rarity: 'uncommon',
  })
  const rareFirearm = { ...firearm, id: 'rare-firearm', data: { ...firearm.data, rarity: 'rare' } }
  const nonFirearm = weapon('Dwarven Waraxe', 'Advanced', ['Dwarf'], 'uncommon')
  const entries = [firearm, ammunition, rareFirearm, nonFirearm]
  const inventor = { ...character, className: 'Inventor' }

  expect(weaponAccessSources(inventor, entries, firearm)).toEqual(['Inventor Firearm Access'])
  expect(weaponAccessSources(inventor, entries, ammunition)).toEqual(['Inventor Firearm Access'])
  expect(gearAccess(inventor, entries, firearm)).toMatchObject({ automatic: true, sources: ['Inventor Firearm Access'] })
  expect(weaponAccessSources(inventor, entries, rareFirearm)).toEqual([])
  expect(weaponAccessSources(inventor, entries, nonFirearm)).toEqual([])
  expect(weaponAccessSources(character, entries, firearm)).toEqual([])
})

it('toggles Inventor Access for uncommon firearms, ammunition, and Bladed Gauntlet together', () => {
  const firearm = weapon('Air Repeater', 'Simple', [], 'uncommon')
  firearm.data.weapon_group = 'Firearm'
  const ammunition = content('Firearm Ammunition (10 rounds)', 'weapon', {
    weapon_category: 'Ammunition', rarity: 'uncommon',
  })
  const gauntlet = weapon('Bladed Gauntlet', 'Simple', [], 'uncommon')
  const entries = [firearm, ammunition, gauntlet]
  const inventor = { ...character, className: 'Inventor' }
  const original = getSettings().inventorFirearmAccess
  try {
    updateSettings({ inventorFirearmAccess: true })
    for (const entry of entries) expect(weaponAccessSources(inventor, entries, entry)).toEqual(['Inventor Firearm Access'])
    updateSettings({ inventorFirearmAccess: false })
    for (const entry of entries) expect(weaponAccessSources(inventor, entries, entry)).toEqual([])
  } finally {
    updateSettings({ inventorFirearmAccess: original })
  }
})

it('toggles Barbarian War Javelin Access without changing proficiency or unrelated equipment access', () => {
  const javelin = weapon('War Javelin', 'Martial', ['Thrown', 'Uncommon'], 'uncommon')
  const other = weapon('Dwarven Waraxe', 'Advanced', ['Dwarf'], 'uncommon')
  const rare = { ...javelin, id: 'rare-javelin', data: { ...javelin.data, rarity: 'rare' }, traits: ['Thrown', 'Rare'] }
  const barbarianClass = content('Barbarian', 'class', { attack_proficiency: 'Trained in simple weapons, Trained in martial weapons' })
  const entries = [barbarianClass, javelin, other, rare]
  const barbarian = { ...character, className: 'Barbarian' }
  const original = getSettings().barbarianWarJavelinAccess
  try {
    updateSettings({ barbarianWarJavelinAccess: true })
    expect(gearAccess(barbarian, entries, javelin)).toMatchObject({
      automatic: true, sources: ['Barbarian War Javelin Access'],
    })
    expect(attack(barbarian, javelin, entries).rank).toBe(1)
    expect(weaponAccessSources(character, entries, javelin)).toEqual([])
    expect(weaponAccessSources(barbarian, entries, other)).toEqual([])
    expect(weaponAccessSources(barbarian, entries, rare)).toEqual([])
    updateSettings({ barbarianWarJavelinAccess: false })
    expect(gearAccess(barbarian, entries, javelin)).toMatchObject({ automatic: true, approved: false, sources: [] })
    expect(attack(barbarian, javelin, entries).rank).toBe(1)
    expect(gearAccess({ ...barbarian, gearAccessOverrides: [javelin.id] }, entries, javelin))
      .toMatchObject({ automatic: true, approved: true })
  } finally { updateSettings({ barbarianWarJavelinAccess: original }) }
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

it('grants Coldstar Dueling Pistol access from Unconventional Weaponry: Dueling Pistol choice', () => {
  const pistol = { ...weapon('Dueling Pistol', 'Martial', ['Uncommon'], 'uncommon'),
    data: { weapon_category: 'Martial', weapon_type: 'Ranged', weapon_group: 'Firearm', range: 60, hands: 1, damage: '1d6 P' } }
  const coldstar = content('Coldstar Pistols', 'item', {
    item_subcategory: 'Specific Magic Weapons', rarity: 'uncommon', url: '/items/coldstar-pistols',
  }, ['Uncommon'])
  coldstar.description = 'Base Weapon Dueling Pistol. A +3 greater striking Dueling Pistol.'
  const entries = [wizard, pistol, coldstar]
  const coldstarWeapon = gearPickerEntries(entries, 'weapon').find(entry => entry.data.named_weapon_source === 'Coldstar Pistols')!
  const c = { ...character, feats: [selected('Unconventional Weaponry', 'Dueling Pistol')] }
  expect(unconventionalWeaponChoice(entries, coldstarWeapon.name)).toBe('Dueling Pistol')
  expect(featChoiceOptions('Unconventional Weaponry', c, entries, 'ancestry:1:0')).toContain('Dueling Pistol')
  expect(weaponAccessSources(c, entries, coldstarWeapon)).toContain('Unconventional Weaponry')
  expect(gearAccess(c, entries, coldstarWeapon)).toMatchObject({ automatic: true, sources: ['Unconventional Weaponry'] })
})

it('applies Unconventional Weaponry across grades of the selected SF2e weapon', () => {
  const pistol: ContentEntry = { ...weapon('Rotating Pistol', 'Martial'), systems: ['sf2e'],
    data: { weapon_category: 'Martial', damage: '1d6 P', upgrade_slots: 1, url: '/weapons/rotating-pistol' } }
  const advanced: ContentEntry = { ...pistol, id: 'advanced', name: 'Advanced Rotating Pistol', level: 4 }
  const other: ContentEntry = { ...pistol, id: 'other', name: 'Other Pistol', data: { ...pistol.data, url: '/weapons/other' } }
  const c: Character = { ...character, className: 'Witchwarper', systems: ['sf2e'],
    feats: [selected('Unconventional Weaponry', pistol.name)] }
  const entries = [pistol, advanced, other]
  expect(attack(c, pistol, entries).rank).toBe(1)
  expect(attack(c, advanced, entries).rank).toBe(1)
  expect(attack({ ...c, level: 11 }, advanced, entries).rank).toBe(2)
  expect(attack(c, other, entries).rank).toBe(0)
  expect(attack({ ...c, feats: [] }, advanced, entries).rank).toBe(0)
})

it('grants Access and familiarity to a selected cultural weapon without a separate approval', () => {
  const katana = weapon('Katana', 'Martial', [], 'uncommon')
  const entries = [wizard, katana]
  const c = { ...character, feats: [selected('Unconventional Weaponry', katana.name)] }
  expect(weaponAccessSources(c, entries, katana)).toEqual(['Unconventional Weaponry'])
  expect(gearAccess(c, entries, katana)).toMatchObject({ automatic: true, sources: ['Unconventional Weaponry'] })
  expect(attack(c, katana, entries).rank).toBe(2)
  expect(weaponAccessSources({ ...c, feats: [] }, entries, katana)).toEqual([])
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
  expect(weaponAccessSources(c, entries, common)).toEqual(['Unconventional Weaponry'])
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
