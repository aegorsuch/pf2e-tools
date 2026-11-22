import { expect, it } from 'vitest'
import type { Character, ContentEntry } from './types'
import { ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS, FIST, GAUNTLET, HAFT_STRIKER_WEAPON, homebrewCharacterOptions, homebrewWeapons, IRON_FIST, ORC_TUSKS, OVERSIZED_THROW } from './supplemental'
import { automaticFeatGrants, backgroundSkills, boostSlots, effectiveWeapon, eligibleFeats, eligibleWeaponRunes, handwrapRuneOptions, isLockedWeapon, ownedWeapons, weaponAttack, weaponCategory } from './builder'
import { getSettings, updateSettings } from './settings'
import { FeatSlots } from './FeatSlots'
import { MinionsContent } from './MinionsSection'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { removeColdIronTusks } from './supplemental'

it('retires Cold Iron Tusks without touching other feats, weapons or character choices', () => {
  const c: Character = { ...base, entryIds: ['homebrew:cold-iron-tusks', 'other'],
    feats: [{ name: 'Cold Iron Tusks', type: 'Ancestry Feat', level: 5 }, { name: 'Tusks', type: 'Ancestry Feat', level: 1 }],
    skillPicks: ['Athletics'] }
  const before = JSON.stringify(c)
  const updated = removeColdIronTusks(c)
  expect(updated.feats.map(feat => feat.name)).toEqual(['Tusks'])
  expect(updated.entryIds).toEqual(['other'])
  expect(updated.skillPicks).toEqual(['Athletics'])
  expect(JSON.stringify(c)).toBe(before)
  expect(removeColdIronTusks(updated)).toBe(updated)
  expect(homebrewCharacterOptions([]).some(entry => entry.name === 'Cold Iron Tusks')).toBe(false)
})

const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Ranger',
  abilities: { str: 12, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('marks homebrew Watch Initiate feats rare', () => {
  const entries = homebrewCharacterOptions([])
  for (const name of ['Blackwatch Initiate', 'Greywatch Initiate', 'Magewatch Initiate', 'Palewatch Initiate']) {
    expect(entries.find(entry => entry.name === name)?.traits).toContain('Rare')
  }
})

it('offers level-20 Tethered weapon feats for each weapon feature', () => {
  const entries = homebrewCharacterOptions([])
  expect(entries.find(entry => entry.name === 'Tethered Living Weapon')).toMatchObject({
    level: 20, traits: ['Archetype'], data: { archetype: 'Wild Hunter', prerequisite: 'Living Weapon, Wild Hunter Dedication' },
  })
  expect(entries.find(entry => entry.name === 'Tethered Verdant Weapon')).toMatchObject({
    level: 20, traits: ['Druid'], data: { class: 'Druid', prerequisite: 'Verdant Weapon' },
  })
  expect(entries.find(entry => entry.name === 'Tethered Osteo Weapon')).toMatchObject({
    level: 20, traits: ['Necromancer'], data: { class: 'Necromancer', prerequisite: 'Osteo Armaments' },
  })
  expect(entries.find(entry => entry.name === 'Tethered Favored Weapon')).toMatchObject({
    level: 20, traits: ['Champion', 'Cleric'], data: { class: 'Champion, Cleric' },
  })
})

it('provides Caravan Contortionist background boosts, skills, and Quick Squeeze', () => {
  const background = homebrewCharacterOptions([]).find(entry => entry.name === 'Caravan Contortionist')!
  const c = { ...base, background: background.name }
  expect(background.kind).toBe('background')
  expect(backgroundSkills(background)).toEqual(['Acrobatics', 'Caravan Lore'])
  expect(boostSlots(c, [background]).find(slot => slot.key === 'background:0')?.options).toEqual(['dex', 'cha'])
  expect(background.data.feat).toBe('Quick Squeeze')
})

it('provides Direwolf Bonded boosts, training and Titan Wrestler without adding an animal companion', () => {
  const background = homebrewCharacterOptions([]).find(entry => entry.name === 'Direwolf Bonded')!
  const c: Character = { ...base, level: 1, className: 'Fighter', background: background.name }
  const entries = [background, ...['Canny Acumen', 'Titan Wrestler'].map((name): ContentEntry => ({
    ...HAFT_STRIKER_WEAPON, id: name, name, kind: 'feat', level: 1, traits: name === 'Canny Acumen' ? ['General'] : ['General', 'Skill'],
  }))]
  const before = JSON.stringify(c)
  expect(backgroundSkills(background)).toEqual(['Nature', 'Sarkoris Lore'])
  expect(boostSlots(c, entries).find(slot => slot.key === 'background:0')?.options).toEqual(['dex', 'wis'])
  expect(boostSlots(c, entries).find(slot => slot.key === 'background:1')).toMatchObject({ group: 'background', label: 'Background (free)' })
  const feats = renderToStaticMarkup(createElement(FeatSlots, { c, entries, save: () => {} }))
  expect(feats).toContain('Canny Acumen')
  expect(feats).toContain('Titan Wrestler')
  expect(background.description).toContain('Canny Acumen general feat and the Titan Wrestler skill feat.')
  expect(background.description).not.toContain('Train Animal')
  expect(background.description).not.toContain('general feat slot')
  expect(background.description).not.toContain('Obtain an animal companion')
  expect(background.description).toContain('Aid your Nature, Perception, and Survival checks')
  const minions = renderToStaticMarkup(createElement(MinionsContent, { c, entries, save: () => {} }))
  expect(minions).not.toContain('Choose companion')
  expect(c.companions).toBeUndefined()
  expect(JSON.stringify(c)).toBe(before)
})

it.each([['Gravity Weapon', 14], ['Enlarge Companion', 18]] as const)('offers Persistent %s only in eligible Ranger class slots from level %i', (name, level) => {
  const feat = homebrewCharacterOptions([]).find(entry => entry.name === `Persistent ${name}`)!
  const slot = { key: `class:${level}:0`, category: 'class' as const, level }
  const c: Character = { ...base, level, className: 'Ranger' }
  expect(eligibleFeats([feat], c, slot)).toContain(feat)
  expect(eligibleFeats([feat], { ...c, level: level - 1 }, { ...slot, key: `class:${level - 2}:0`, level: level - 2 })).not.toContain(feat)
  expect(eligibleFeats([feat], { ...c, className: 'Fighter' }, slot)).not.toContain(feat)
  expect(eligibleFeats([feat], c, { ...slot, category: 'skill' })).not.toContain(feat)
  expect(feat.description).toContain(`When you cast ${name}`)
  expect(feat.description).toContain('until the next time you make your daily preparations')
})

it('offers Rider as a level-one companion-class feat and grants Ride without creating a companion', () => {
  const rider = homebrewCharacterOptions([]).find(entry => entry.name === 'Rider')!
  const slot = { key: 'class:1:0', category: 'class' as const, level: 1 }
  const entries = [rider]
  for (const className of ['Champion', 'Commander', 'Druid', 'Ranger']) {
    const c: Character = { ...base, level: 1, className }
    expect(eligibleFeats(entries, c, slot)).toContain(rider)
  }
  expect(eligibleFeats(entries, { ...base, level: 1, className: 'Fighter' }, slot)).not.toContain(rider)
  expect(eligibleFeats(entries, { ...base, level: 1 }, { ...slot, category: 'general' })).not.toContain(rider)
  const c: Character = { ...base, level: 1, feats: [{ name: 'Rider', type: 'Class Feat', level: 1 }] }
  const before = JSON.stringify(c)
  expect(automaticFeatGrants(c, entries)).toContainEqual({ name: 'Ride', source: 'Rider', level: 1 })
  expect(automaticFeatGrants({ ...c, feats: [{ ...c.feats[0], takenLevel: 3 }] }, entries))
    .not.toContainEqual(expect.objectContaining({ source: 'Rider' }))
  expect(JSON.stringify(c)).toBe(before)
})

it('offers Mounted Parry as a Cavalier feat requiring its dedication', () => {
  const mountedParry = homebrewCharacterOptions([]).find(entry => entry.name === 'Mounted Parry')!
  const dedication: ContentEntry = { ...mountedParry, id: 'cavalier', name: 'Cavalier Dedication', level: 2,
    traits: ['Archetype', 'Dedication'], data: { archetype: 'Cavalier' } }
  const slot = { key: 'archetype:6:0', category: 'archetype' as const, level: 6 }
  const c: Character = { ...base, level: 6, feats: [{ name: dedication.name, type: 'Class Feat', level: 2 }] }
  expect(mountedParry).toMatchObject({ source: 'homebrew', level: 6, data: { archetype: 'Cavalier', prerequisite: 'Cavalier Dedication' } })
  expect(eligibleFeats([mountedParry, dedication], c, slot)).toContain(mountedParry)
  expect(eligibleFeats([mountedParry, dedication], { ...c, feats: [] }, slot)).not.toContain(mountedParry)
})

it('offers Persistent Magic Hide through Beastmaster at level ten without opening other Ranger persistent feats', () => {
  const persistent = homebrewCharacterOptions([])
  const hide = persistent.find(entry => entry.name === 'Persistent Magic Hide')!
  const dedication: ContentEntry = { ...hide, id: 'beastmaster', name: 'Beastmaster Dedication', level: 2,
    traits: ['Archetype', 'Dedication'], data: { archetype: 'Beastmaster' } }
  const c: Character = { ...base, className: 'Champion',
    feats: [{ name: dedication.name, level: 2, type: 'Dedication Feat', slot: 'archetype:2:0' }] }
  const entries = [...persistent, dedication]
  const slot = { key: 'archetype:10:0', category: 'archetype' as const, level: 10 }
  const offered = eligibleFeats(entries, c, slot)
  expect(offered).toContain(hide)
  expect(offered.filter(entry => entry.name.startsWith('Persistent '))).toEqual([hide])
  expect(eligibleFeats(entries, c, { ...slot, key: 'archetype:8:0', level: 8 })).not.toContain(hide)
  expect(eligibleFeats(entries, { ...c, feats: [] }, slot)).not.toContain(hide)
  expect(eligibleFeats(entries, { ...base, className: 'Ranger' }, { ...slot, category: 'class', key: 'class:10:0' })).toContain(hide)
})

it.each([['Greywatch', 'Deception'], ['Blackwatch', 'Occultism'], ['Palewatch', 'Religion'], ['Magewatch', 'Arcana']])('offers %s Initiate at level four to its three classes with trained %s required', (watch, skill) => {
  const greywatch = homebrewCharacterOptions([]).find(entry => entry.name === `${watch} Initiate`)!
  const slot = { key: 'class:4:0', category: 'class' as const, level: 4 }
  const c: Character = { ...base, level: 4, skillPicks: [skill] }
  for (const className of ['Gunslinger', 'Investigator', 'Ranger']) {
    expect(eligibleFeats([greywatch], { ...c, className }, slot)).toContain(greywatch)
  }
  expect(eligibleFeats([greywatch], { ...c, className: 'Fighter' }, slot)).toEqual([])
  expect(eligibleFeats([greywatch], { ...c, skillPicks: [] }, slot)).toEqual([])
  expect(eligibleFeats([greywatch], { ...c, level: 3 }, { ...slot, key: 'class:2:0', level: 2 })).toEqual([])
  expect(eligibleFeats([greywatch], c, { ...slot, category: 'skill' })).toEqual([])
  expect(greywatch).toMatchObject({ source: 'homebrew', data: { prerequisite: `Trained in ${skill}` } })
})

it('offers Weapon Innovation Jousting to Inventors with an acquired weapon innovation', () => {
  const feat = homebrewCharacterOptions([]).find(entry => entry.name === 'Weapon Innovation Jousting')!
  const weapon = { ...HAFT_STRIKER_WEAPON, id: 'innovation:weapon', kind: 'subclass' as const, name: 'Weapon', data: { class: 'Inventor' } }
  const entries = [feat, weapon]
  const slot = { key: 'class:4:0', category: 'class' as const, level: 4 }
  const c: Character = { ...base, level: 10, className: 'Inventor', subclass: 'Weapon' }
  expect(eligibleFeats(entries, c, slot)).toContain(feat)
  expect(eligibleFeats(entries, { ...c, subclass: 'Armor' }, slot)).not.toContain(feat)
  const secondary: Character = { ...c, subclass: 'Armor',
    feats: [{ name: 'Second Innovation', type: 'Class Feat', level: 8, choice: 'Weapon' }] }
  expect(eligibleFeats(entries, secondary, slot)).toContain(feat)
  expect(eligibleFeats(entries, { ...secondary, feats: [] }, slot)).not.toContain(feat)
  expect(eligibleFeats(entries, secondary, { ...slot, key: 'class:8:0', level: 8 })).toContain(feat)
})

it('provides ranger copies of the druid feats without changing their rules', () => {
  const originals: ContentEntry[] = ['Effortless Concentration', 'Forgotten Presence', 'Timeless Nature'].map((name, index) => ({
    ...HAFT_STRIKER_WEAPON, id: `official:${index}`, kind: 'feat', name, level: [16, 8, 14][index],
    traits: ['Druid', 'Uncommon'], description: `${name} rules`, data: { class: 'Druid', archetype: 'Other' },
  }))
  const copies = homebrewCharacterOptions(originals).filter(entry => entry.id.startsWith('homebrew:ranger-'))
  expect(copies).toHaveLength(3)
  for (const [index, copy] of copies.entries()) {
    expect(copy).toMatchObject({ name: originals[index].name, level: originals[index].level, source: 'homebrew',
      description: originals[index].description, traits: ['Uncommon', 'Ranger'], data: { class: 'Ranger' } })
    expect(copy.data.archetype).toBeUndefined()
  }
  const slot = (level: number) => ({ key: `class:${level}:0`, category: 'class' as const, level })
  expect(eligibleFeats([...originals, ...copies], { ...base, level: 13 }, slot(12)).map(feat => feat.name)).not.toContain('Timeless Nature')
  expect(eligibleFeats([...originals, ...copies], { ...base, level: 14 }, slot(14)).find(feat => feat.name === 'Timeless Nature')?.id)
    .toBe('homebrew:ranger-timeless-nature')
})

it('copies Twinned Defense for Ranger without changing Fighter rules or archetype access', () => {
  const original: ContentEntry = { ...HAFT_STRIKER_WEAPON, id: 'twinned-defense', kind: 'feat', name: 'Twinned Defense (Fighter)',
    level: 16, traits: ['Fighter', 'Stance'],
    description: 'Twinned Defense (Fighter)\n\nArchetypes Dual-Weapon Warrior (Level 18)\n\nGain the benefits of Twin Parry while in this stance.',
    data: { class: 'Fighter', actions: 'Single Action', prerequisite: 'Twin Parry', requirements: 'Wielding two melee weapons',
      archetype: 'Dual-Weapon Warrior', archetype_levels: 'Dual-Weapon Warrior=18' } }
  const before = JSON.stringify(original)
  const copy = homebrewCharacterOptions([original]).find(entry => entry.name === 'Twinned Defense Stance')!
  expect(copy).toMatchObject({ level: 16, source: 'homebrew', traits: ['Stance', 'Ranger'],
    description: 'Twinned Defense Stance\n\nGain the benefits of Twin Parry while in this stance.',
    data: { class: 'Ranger', prerequisite: 'Twin Parry', actions: 'Single Action', requirements: original.data.requirements } })
  expect(copy.data.archetype).toBeUndefined()
  expect(copy.data.archetype_levels).toBeUndefined()
  const c: Character = { ...base, level: 16, feats: [{ name: 'Twin Parry', type: 'Class Feat', level: 4 }] }
  const twin: ContentEntry = { ...original, id: 'twin-parry', name: 'Twin Parry', level: 4, traits: ['Fighter', 'Ranger'], data: {} }
  const slot = { key: 'class:16:0', category: 'class' as const, level: 16 }
  expect(eligibleFeats([original, copy], c, slot)).toContain(copy)
  expect(eligibleFeats([copy, twin], { ...c, feats: [] }, slot)).not.toContain(copy)
  expect(eligibleFeats([copy], { ...c, className: 'Fighter' }, slot)).not.toContain(copy)
  expect(JSON.stringify(original)).toBe(before)
})

it('provides Strong Arm to Ranger and Barbarian and applies its range only to thrown attacks', () => {
  const original: ContentEntry = { ...HAFT_STRIKER_WEAPON, id: 'strong-arm', kind: 'feat', name: 'Strong Arm',
    level: 2, traits: ['Rogue'], description: 'Increase thrown range increment by 10 feet.', data: { class: 'Rogue' } }
  const copy = homebrewCharacterOptions([original]).find(entry => entry.id === 'homebrew:strong-arm-ranger-barbarian')!
  expect(copy).toMatchObject({ name: original.name, level: 2, traits: ['Ranger', 'Barbarian'], data: { class: 'Ranger, Barbarian' } })
  const javelin: ContentEntry = { ...HAFT_STRIKER_WEAPON, name: 'Javelin', traits: ['Thrown'], data: { weapon_type: 'Ranged', range: 30, damage: '1d6 P' } }
  const dagger: ContentEntry = { ...HAFT_STRIKER_WEAPON, name: 'Dagger', traits: ['Thrown'], data: { weapon_type: 'Melee', damage: '1d4 P' } }
  const bow: ContentEntry = { ...javelin, name: 'Bow', traits: [], data: { ...javelin.data, range: 100 } }
  const c: Character = { ...base, feats: [{ name: 'Strong Arm', type: 'Class Feat', level: 2 }] }
  const owned = (name: string, id = name) => ({ id, name, potency: 0, striking: 0, runes: [] })
  expect(weaponAttack(c, [javelin], owned('Javelin')).range).toBe(40)
  expect(weaponAttack(c, [dagger], owned('Dagger')).thrownRangeBonus).toBe(10)
  expect(weaponAttack(c, [bow], owned('Bow')).range).toBe(100)
  expect(weaponAttack(c, [], owned('Oversized Throw', OVERSIZED_THROW.id)).range).toBe(30)
  expect(weaponAttack({ ...c, feats: [] }, [javelin], owned('Javelin')).range).toBe(30)
})
it('stops seeding Claymore while preserving statistics for previously owned copies', () => {
  const katana: ContentEntry = {
    ...HAFT_STRIKER_WEAPON, id: 'aon:pf2e:weapon-411', name: 'Katana',
    traits: ['Deadly d8', 'Two-Hand d10', 'Uncommon', 'Versatile P'],
    data: { weapon_category: 'Martial', weapon_group: 'Sword', weapon_type: 'Melee', damage: '1d6 S',
      hands: '1', bulk: 1, price: 200, rarity: 'uncommon', url: 'https://2e.aonprd.com/Weapons.aspx?ID=411' },
  }
  expect(homebrewWeapons([katana])).toEqual([])
  const claymore: ContentEntry = { ...katana, id: 'homebrew:claymore', name: 'Claymore',
    source: 'homebrew', data: { ...katana.data, retired: true } }
  expect(katana.name).toBe('Katana')
  const weapon = { id: 'claymore', name: 'Claymore', potency: 1, striking: 1, runes: [] }
  expect(weaponAttack(base, [claymore], weapon).damage).toBe('2d6+1 S')
  expect(homebrewWeapons([{ ...katana, deleted: true }])).toEqual([])
  expect(homebrewWeapons([{ ...katana, source: 'homebrew' }])).toEqual([])
})

it('does not seed a broad-bladed Spear or modify official Spear statistics', () => {
  const spear: ContentEntry = { ...HAFT_STRIKER_WEAPON, id: 'aon:pf2e:weapon-365', name: 'Spear',
    traits: ['Thrown'], data: { weapon_type: 'Melee', damage: '1d6 P', hands: 1, thrown_range: 20 } }
  const before = JSON.stringify(spear)
  expect(homebrewWeapons([spear])).toEqual([])
  expect(JSON.stringify(spear)).toBe(before)
  expect(homebrewWeapons([{ ...spear, deleted: true }])).toEqual([])
})

it('removes Agile only while a Barbarian rages with the house rule enabled', () => {
  const previous = getSettings().barbarianIgnoreAgile
  const c = { ...base, className: 'Barbarian', raging: true }
  const fist = { id: FIST.id, name: FIST.name, potency: 0, striking: 0, runes: [] }
  try {
    updateSettings({ barbarianIgnoreAgile: true })
    expect(weaponAttack(c, [], fist).traits).not.toContain('Agile')
    expect(weaponAttack(c, [], fist).entry?.traits).not.toContain('Agile')
    expect(weaponAttack(c, [], fist).traits).toContain('Finesse')
    expect(weaponAttack({ ...c, raging: false }, [], fist).traits).toContain('Agile')
    expect(weaponAttack({ ...c, className: 'Ranger' }, [], fist).traits).toContain('Agile')
    updateSettings({ barbarianIgnoreAgile: false })
    expect(weaponAttack(c, [], fist).traits).toContain('Agile')
    expect(FIST.traits).toContain('Agile')
  } finally { updateSettings({ barbarianIgnoreAgile: previous }) }
})

it('adds full Strength to Oversized Throw and scales its dice with specialization', () => {
  const c = { ...base, className: 'Barbarian', abilities: { ...base.abilities, str: 20 } }
  const thrown = { id: OVERSIZED_THROW.id, name: OVERSIZED_THROW.name, potency: 0, striking: 0, runes: [] }
  expect(weaponAttack({ ...c, level: 4 }, [], thrown).damage).toBe('1d10+5 bludgeoning')
  expect(weaponAttack({ ...c, level: 7 }, [], thrown).damage).toBe('2d10+5 bludgeoning')
  expect(weaponAttack({ ...c, level: 15 }, [], thrown).damage).toBe('3d10+5 bludgeoning')
})

it('copies Flyssa mechanics into a separate homebrew Seax without changing the official weapon', () => {
  const flyssa: ContentEntry = {
    ...HAFT_STRIKER_WEAPON, id: 'aon:pf2e:weapon-285', name: 'Flyssa', level: 0,
    traits: ['Agile', 'Finesse', 'Versatile'],
    data: { weapon_category: 'Martial', weapon_group: 'Knife', weapon_type: 'Melee', damage: '1d6 S',
      damage_type: 'Piercing, Slashing', hands: '1', bulk: 0.1, price: 100, rarity: 'common',
      url: 'https://2e.aonprd.com/Weapons.aspx?ID=285' },
  }
  const original = JSON.stringify(flyssa)
  const [seax] = homebrewWeapons([flyssa])
  expect(seax.description).not.toMatch(/flyssa|copy|using .*statistics/i)
  expect(seax.description).toContain('broad-backed blade')
  expect(seax).toMatchObject({ id: 'homebrew:seax', name: 'Seax', source: 'homebrew', traits: flyssa.traits, data: flyssa.data })
  expect(weaponAttack(base, [seax], { id: 'seax', name: 'Seax', potency: 0, striking: 0, runes: [] }))
    .toMatchObject({ damage: '1d6+1 S', ability: 'dex', traits: ['Agile', 'Finesse', 'Versatile P'] })
  expect(JSON.stringify(flyssa)).toBe(original)
  expect(homebrewWeapons([{ ...flyssa, deleted: true }])).toEqual([])
})

it('uses simple proficiency and finesse for the haft while retaining Strength damage', () => {
  const attack = weaponAttack(base, [HAFT_STRIKER_WEAPON, {
    ...HAFT_STRIKER_WEAPON, id: 'ranger', kind: 'class', name: 'Ranger',
    data: { attack_proficiency: 'Trained in simple weapons' },
  }], { id: 'haft', name: 'Haft Striker Stance', potency: 0, striking: 0, runes: [] })
  expect(weaponCategory(HAFT_STRIKER_WEAPON)).toBe('Simple')
  expect(attack).toMatchObject({ ability: 'dex', attack: 16, damage: '1d4+1 bludgeoning', traits: ['Agile', 'Finesse'] })
})

it('grants Haft Striker Stance from its feat without duplicating configured weapons', () => {
  const polearm: ContentEntry = { ...HAFT_STRIKER_WEAPON, id: 'glaive', name: 'Glaive', data: { hands: 2, weapon_group: 'Polearm', damage: '1d8 slashing' } }
  const main = { id: 'main', name: polearm.name, potency: 2, striking: 1, runes: ['Flaming'] }
  const c = { ...base, activeStance: HAFT_STRIKER_WEAPON.name, weapons: [main], feats: [{ name: 'Haft Striker Stance', type: 'Class Feat', level: 4 }] }
  const entries: ContentEntry[] = [polearm, { ...HAFT_STRIKER_WEAPON, id: 'haft-feat', kind: 'feat', level: 4, traits: ['Stance'] }]
  const weapons = ownedWeapons(c, entries)
  expect(weapons.filter((weapon) => weapon.name === HAFT_STRIKER_WEAPON.name)).toHaveLength(1)
  expect(ownedWeapons({ ...c, weapons }, entries).filter((weapon) => weapon.name === HAFT_STRIKER_WEAPON.name)).toHaveLength(1)
  expect(ownedWeapons({ ...c, weapons, feats: [] }, entries).map((weapon) => weapon.name)).toEqual(['Glaive', 'Fist'])
  const configured = { id: 'manual-haft', name: HAFT_STRIKER_WEAPON.name, potency: 2, striking: 1, runes: ['Flaming'] }
  expect(ownedWeapons({ ...c, weapons: [main, configured] }, entries).find((weapon) => weapon.name === configured.name)).toBe(configured)
})

it('derives and locks one gauntlet while eligible armor is worn, preserving independent weapon runes', () => {
  const plate = { id: 'plate', name: 'Full Plate', potency: 0, resilient: 0, runes: [], worn: true }
  const c: Character = { ...base, armors: [plate], handwraps: { potency: 3, striking: 3, runes: ['Flaming'] } }
  const gauntlet = ownedWeapons(c, []).find((weapon) => weapon.name === 'Gauntlet')!
  expect(isLockedWeapon(c, gauntlet.name)).toBe(true)
  expect(weaponCategory(GAUNTLET)).toBe('Simple')
  expect(weaponAttack(c, [], gauntlet)).toMatchObject({
    ability: 'dex', item: 0, damage: '1d4+1 bludgeoning', traits: ['Agile', 'Finesse', 'Free-Hand', 'Grapple', 'Nonlethal', 'Shove'],
  })
  const configured = { ...gauntlet, potency: 2, striking: 1, runes: ['Flaming'] }
  const saved = { ...c, weapons: [configured] }
  expect(ownedWeapons(saved, []).filter((weapon) => weapon.name === 'Gauntlet')).toEqual([configured])
  const unworn = { ...saved, armors: [{ ...plate, worn: false }] }
  expect(ownedWeapons(unworn, []).map((weapon) => weapon.name)).not.toContain('Gauntlet')
  expect(isLockedWeapon(unworn, 'Gauntlet')).toBe(false)
  expect(ownedWeapons({ ...unworn, armors: [plate] }, []).find((weapon) => weapon.name === 'Gauntlet')).toEqual(configured)
  for (const name of ['Full Plate', 'Half Plate', 'Hellknight Plate', 'Splint Mail']) {
    const wearer = { ...base, armors: [{ ...plate, name }] }
    expect(ownedWeapons(wearer, []).map((weapon) => weapon.name)).toContain('Gauntlet')
    expect(isLockedWeapon(wearer, 'Gauntlet')).toBe(true)
  }
  expect(ownedWeapons({ ...base, armors: [{ ...plate, name: 'Chain Mail' }] }, []).map((weapon) => weapon.name)).not.toContain('Gauntlet')
  const manual = { ...configured, id: 'purchased-gauntlet' }
  expect(ownedWeapons({ ...c, weapons: [manual] }, []).filter((weapon) => weapon.name === 'Gauntlet')).toEqual([manual])
  expect(ownedWeapons({ ...base, weapons: [manual] }, [])).toContain(manual)
  const imported = { ...base, equipment: [{ name: 'Full Plate', qty: 1 }] }
  const entry: ContentEntry = { ...GAUNTLET, id: 'full-plate', kind: 'armor', name: 'Full Plate', data: { ac: 6, dex_cap: 0 } }
  expect(ownedWeapons(imported, [entry]).map((weapon) => weapon.name)).toContain('Gauntlet')
  expect(isLockedWeapon(imported, 'Gauntlet', [entry])).toBe(true)
})

it('inherits fist and unarmed attack traits for gauntlets', () => {
  const spiked: ContentEntry = { ...GAUNTLET, id: 'spiked', name: 'Spiked Gauntlet', data: { ...GAUNTLET.data, damage: '1d4 piercing' } }
  const bladed: ContentEntry = { ...GAUNTLET, id: 'bladed', name: 'Bladed Gauntlet', traits: ['Agile', 'Finesse', 'Free-Hand'] }
  const bow: ContentEntry = { ...GAUNTLET, id: 'bow', name: 'Gauntlet Bow', data: { ...GAUNTLET.data, weapon_type: 'Ranged' } }
  const unarmed: ContentEntry = { ...GAUNTLET, id: 'unarmed-fist', name: 'Test Fist',
    traits: ['Grapple', 'Trip', 'Unarmed'], data: { ...GAUNTLET.data, weapon_category: 'Unarmed' } }
  const entries = [spiked, bladed, bow, unarmed]
  const iron = { name: 'Iron Fists', type: 'Ancestry Feat', level: 1 }
  const owned = (name: string) => ({ id: name, name, potency: 0, striking: 0, runes: [] })
  const character = { ...base, feats: [iron], weapons: [owned(unarmed.name)] }
  for (const name of ['Gauntlet', 'Spiked Gauntlet']) {
    const attack = weaponAttack(character, entries, owned(name))
    expect(attack.traits).toEqual(expect.arrayContaining(['Finesse', 'Nonlethal', 'Grapple', 'Trip', 'Shove']))
    expect(attack.traits).not.toContain('Unarmed')
    expect(attack.ability).toBe('dex')
    expect(weaponAttack({ ...character, feats: [] }, entries, owned(name)).traits).not.toContain('Shove')
    expect(weaponAttack({ ...character, level: 0 }, entries, owned(name)).traits).not.toContain('Shove')
  }
  expect(weaponAttack(character, entries, owned('Bladed Gauntlet')).traits)
    .toEqual(expect.arrayContaining(['Agile', 'Finesse', 'Free-Hand', 'Grapple', 'Trip', 'Shove']))
  expect(weaponAttack(character, entries, owned('Gauntlet Bow')).traits).not.toContain('Grapple')
  const armor = { id: 'plate', name: 'Full Plate', potency: 0, resilient: 0, runes: [], worn: true }
  const wearer = { ...character, armors: [armor] }
  const gauntlet = ownedWeapons(wearer, entries).find(weapon => weapon.name === 'Gauntlet')!
  expect(weaponAttack(wearer, entries, gauntlet).traits).toEqual(expect.arrayContaining(['Finesse', 'Grapple', 'Shove']))
  expect(GAUNTLET.traits).toEqual(['Agile', 'Free-Hand'])
  expect(spiked.traits).toEqual(['Agile', 'Free-Hand'])
})

it('gates gauntlet Finesse behind the Free-Hand rule without removing other or native traits', () => {
  const previous = getSettings().freeHandFinesse
  const bladed: ContentEntry = { ...GAUNTLET, id: 'bladed', name: 'Bladed Gauntlet', traits: ['Finesse', 'Free-Hand'] }
  const spiked: ContentEntry = { ...GAUNTLET, id: 'spiked', name: 'Spiked Gauntlet' }
  const owned = (name: string) => ({ id: name, name, potency: 0, striking: 0, runes: [] })
  try {
    updateSettings({ freeHandFinesse: false })
    expect(weaponAttack(base, [spiked], owned('Gauntlet')).traits).not.toContain('Finesse')
    expect(weaponAttack(base, [spiked], owned('Spiked Gauntlet')).traits).toContain('Nonlethal')
    expect(weaponAttack(base, [bladed], owned(bladed.name)).traits).toContain('Finesse')
    updateSettings({ freeHandFinesse: true })
    expect(weaponAttack(base, [spiked], owned('Spiked Gauntlet')).traits).toContain('Finesse')
  } finally { updateSettings({ freeHandFinesse: previous }) }
})

it('copies the specified Tekko-Kagi as Clawed Gauntlet without its Bastet flavor text', () => {
  const tekko: ContentEntry = {
    ...GAUNTLET, id: 'aon:pf2e:weapon-304', name: 'Tekko-Kagi',
    traits: ['Agile', 'Disarm', 'Finesse', 'Free-Hand', 'Monk', 'Parry', 'Uncommon'],
    description: 'Four curved blades resemble claws. Adherents of Bastet favor this weapon.',
    data: { weapon_category: 'Martial', weapon_group: 'Brawling', weapon_type: 'Melee', damage: '1d4 slashing', hands: '1', bulk: 0.1, price: 20, rarity: 'uncommon', url: 'https://2e.aonprd.com/Weapons.aspx?ID=304' },
  }
  const [clawed] = homebrewWeapons([{ ...tekko, id: 'aon:pf2e:weapon-101', name: 'Tekko-kagi', traits: ['Trip'] }, tekko])
  expect(clawed).toMatchObject({
    id: 'homebrew:clawed-gauntlet', name: 'Clawed Gauntlet', source: 'homebrew', updatedAt: 1,
    traits: tekko.traits.filter(trait => trait !== 'Uncommon'), data: { ...tekko.data, rarity: 'common' },
  })
  expect(clawed.description).not.toContain('Bastet')
  expect(weaponCategory(clawed)).toBe('Martial')
  const c: Character = {
    ...base, armors: [{ id: 'splint', name: 'Splint Mail', worn: true, gauntlet: 'Clawed Gauntlet', potency: 0, resilient: 0, runes: [] }],
    handwraps: { potency: 3, striking: 3, runes: ['Flaming'] },
    weapons: [{ id: GAUNTLET.id, name: 'Gauntlet', potency: 1, striking: 1, runes: ['Wounding'] }],
  }
  const attacks = ownedWeapons(c, [clawed])
  const provided = attacks.find((weapon) => weapon.id === GAUNTLET.id)!
  expect(provided).toMatchObject({ name: 'Clawed Gauntlet', potency: 1, striking: 1, runes: ['Wounding'] })
  expect(isLockedWeapon(c, 'Clawed Gauntlet', [clawed])).toBe(true)
  expect(isLockedWeapon(c, 'Gauntlet', [clawed])).toBe(false)
  expect(weaponAttack(c, [clawed], provided)).toMatchObject({ ability: 'dex', item: 0, damage: '1d4+1 slashing',
    traits: expect.arrayContaining([...clawed.traits, 'Nonlethal']) })
  const regular: Character = { ...c, armors: c.armors!.map((armor) => ({ ...armor, gauntlet: 'Gauntlet' })) }
  const back = ownedWeapons(regular, [clawed]).find((weapon) => weapon.id === GAUNTLET.id)!
  expect(effectiveWeapon(regular, [clawed], back).runes).toEqual([])
  expect(c.weapons![0].runes).toEqual(['Wounding'])
  expect(homebrewWeapons([{ ...tekko, deleted: true }])).toEqual([])
  expect(homebrewWeapons([{ ...tekko, id: 'aon:pf2e:weapon-101' }])).toEqual([])
})

it('provides a default fist until a different unarmed attack is available', () => {
  expect(ownedWeapons(base, []).map((weapon) => weapon.name)).toEqual(['Fist'])
  const c = { ...base, feats: [{ name: 'Tusks', type: 'Ancestry Feat', level: 1 }] }
  const weapons = ownedWeapons(c, [])
  expect(weapons.map((weapon) => weapon.name)).toEqual(['Tusks'])
  expect(weaponAttack(c, [], weapons[0])).toMatchObject({ attack: 18, damage: '2d6+1 piercing', traits: ['Finesse', 'Grapple', 'Unarmed'] })
  expect(ownedWeapons({ ...c, weapons, feats: [] }, []).map((weapon) => weapon.name)).toEqual(['Fist'])
})

it.each(['Gauntlet', 'Spiked Gauntlet', 'Bladed Gauntlet', 'Clawed Gauntlet', 'Custom Gauntlets'])('hides covered fists for %s without hiding other natural attacks or losing saved fist configuration', (name) => {
  const fist = { id: FIST.id, name: FIST.name, potency: 2, striking: 1, runes: ['Flaming'] }
  const gauntlet = { id: 'purchased', name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, weapons: [fist, gauntlet] }
  expect(ownedWeapons(c, []).map((weapon) => weapon.name)).toEqual([name])
  expect(ownedWeapons({ ...c, weapons: [fist] }, [])).toEqual([fist])
  const natural: Character = {
    ...c, feats: ['Iron Fists', 'Tusks'].map((name) => ({ name, type: 'Ancestry Feat', level: 1 })),
    weapons: [...c.weapons!, { ...fist, id: IRON_FIST.id, name: IRON_FIST.name }],
  }
  expect(ownedWeapons(natural, []).map((weapon) => weapon.name)).toEqual([name, 'Tusks'])
  expect(ownedWeapons({ ...natural, weapons: natural.weapons!.filter((weapon) => weapon.id !== gauntlet.id) }, []).map((weapon) => weapon.name))
    .toEqual(['Iron Fist', 'Tusks'])
  expect(c.weapons?.[0]).toEqual(fist)
})

it.each(['Battleglove', 'Commercial Battleglove', 'Tactical Battleglove', 'Advanced Battleglove',
  'Superior Battleglove', 'Elite Battleglove', 'Ultimate Battleglove', 'Paragon Battleglove',
  'Magnet-Directed Battleglove'])('hides ordinary Fist with %s but keeps special fists', name => {
  const fist = { id: FIST.id, name: FIST.name, potency: 2, striking: 1, runes: ['Flaming'] }
  const glove = { id: 'glove', name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, level: 10, systems: ['pf2e', 'sf2e'], weapons: [fist, glove],
    feats: [{ name: 'Spark Fist', type: 'Ancestry Feat', level: 5 }, { name: 'Iron Fists', type: 'Ancestry Feat', level: 1 }] }
  expect(ownedWeapons(c, []).map(weapon => weapon.name)).toEqual([name, 'Iron Fist', 'Spark Fist'])
  expect(ownedWeapons({ ...c, weapons: [fist], feats: [] }, [])).toEqual([fist])
  expect(c.weapons?.[0]).toEqual(fist)
})

it('does not hide Fist for unrelated glove weapons', () => {
  const glove = { id: 'glove', name: 'Battleglove Launcher', potency: 0, striking: 0, runes: [] }
  expect(ownedWeapons({ ...base, weapons: [glove] }, []).map(weapon => weapon.name)).toEqual(['Battleglove Launcher', 'Fist'])
  const other = { ...glove, name: 'Glove' }
  expect(ownedWeapons({ ...base, weapons: [other] }, []).map(weapon => weapon.name)).toEqual(['Glove', 'Fist'])
})

it('adds Iron Fist only with Iron Fists and retains other unarmed attacks', () => {
  const c = { ...base, feats: ['Iron Fists', 'Tusks'].map((name) => ({ name, type: 'Ancestry Feat', level: 1 })) }
  const weapons = ownedWeapons(c, [])
  expect(weapons.map((weapon) => weapon.name)).toEqual(['Iron Fist', 'Tusks'])
  expect(weaponAttack(c, [], weapons[0])).toMatchObject({
    damage: '2d4+1 bludgeoning', traits: ['Agile', 'Finesse', 'Grapple', 'Shove', 'Unarmed'],
  })
  const configured = weapons.map((weapon) => ({ ...weapon, striking: 1 }))
  expect(ownedWeapons({ ...c, weapons: configured }, [])).toEqual(configured)
})

it('hides an existing Fist when another configured unarmed attack is present', () => {
  const jaws = { ...ORC_TUSKS, id: 'jaws', name: 'Jaws' }
  const c = { ...base, weapons: [FIST, jaws].map((entry) => ({ id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] })) }
  expect(ownedWeapons(c, [jaws]).map((weapon) => weapon.name)).toEqual(['Jaws'])
  expect(ownedWeapons({ ...c, weapons: c.weapons.filter((weapon) => weapon.name !== jaws.name) }, []).map((weapon) => weapon.name)).toEqual(['Fist'])
  expect(ownedWeapons({ ...base, weapons: [{ id: IRON_FIST.id, name: IRON_FIST.name, potency: 0, striking: 0, runes: [] }] }, []).map((weapon) => weapon.name)).toEqual(['Fist'])
})

it('derives Animal Feature attacks only while the known spell is active, including after reload', () => {
  const c: Character = {
    ...base, activeSpells: ['Animal Feature'],
    feats: [{ name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' }],
  }
  expect(ownedWeapons({ ...c, activeSpells: [] }, []).map((weapon) => weapon.name)).toEqual(['Fist'])
  const active = ownedWeapons(c, [])
  expect(active.map((weapon) => weapon.name)).toEqual([ANIMAL_FEATURE_CLAWS.name])
  expect(weaponAttack(c, [], active[0])).toMatchObject({
    attack: 18, ability: 'dex', damage: '2d6+1 slashing', traits: ['Agile', 'Finesse', 'Grapple', 'Unarmed'],
  })
  const jaws = ownedWeapons({ ...c, animalFeature: 'Jaws' }, [])
  expect(jaws.map((weapon) => weapon.name)).toEqual([ANIMAL_FEATURE_JAWS.name])
  expect(weaponAttack(c, [], jaws[0])).toMatchObject({
    attack: 15, ability: 'str', damage: '2d8+1 piercing', traits: ['Grapple', 'Unarmed'],
  })
  const reloaded: Character = JSON.parse(JSON.stringify({ ...c, weapons: active }))
  expect(ownedWeapons(reloaded, [])).toEqual(active)
  expect(ownedWeapons({ ...reloaded, activeSpells: [] }, []).map((weapon) => weapon.name)).toEqual(['Fist'])
  expect(ownedWeapons({ ...reloaded, feats: [] }, []).map((weapon) => weapon.name)).toEqual(['Fist'])
  expect(ownedWeapons({ ...base, activeSpells: ['Animal Feature'], spells: [
    { name: 'Animal Feature', rank: 2, cantrip: false },
  ] }, []).map((weapon) => weapon.name)).toEqual([ANIMAL_FEATURE_CLAWS.name])
})

it('shares handwrap fundamentals and compatible property runes with current and future unarmed attacks only', () => {
  const c: Character = { ...base, handwraps: { potency: 2, striking: 1, runes: ['Impactful (Greater)', 'Wounding'] } }
  const fist = ownedWeapons(c, [])[0]
  expect(weaponAttack(c, [], fist)).toMatchObject({ attack: 18, item: 2, damage: '2d4+1 bludgeoning' })
  expect(effectiveWeapon(c, [], fist).runes).toEqual(['Grievous', 'Grappling'])
  const buffed: Character = {
    ...c, activeSpells: ['Animal Feature'],
    feats: [...['Iron Fists', 'Tusks'].map((name) => ({ name, type: 'Ancestry Feat', level: 1 })),
      { name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' }],
  }
  for (const weapon of ownedWeapons(buffed, [])) {
    expect(weaponAttack(buffed, [], weapon).item).toBe(2)
    expect(weaponAttack(buffed, [], weapon).damage).toMatch(/^2d[468]\+1 /)
    expect(effectiveWeapon(buffed, [], weapon).runes).toEqual(['Grievous', 'Grappling'])
    expect(weapon).toMatchObject({ potency: 0, striking: 0, runes: [] })
  }
  const haft = { id: 'haft', name: HAFT_STRIKER_WEAPON.name, potency: 1, striking: 0, runes: [] }
  expect(effectiveWeapon(c, [], haft)).toBe(haft)
  expect(weaponAttack(c, [], haft)).toMatchObject({ item: 1, damage: '1d4+1 bludgeoning' })
  expect(weaponAttack({ ...c, handwraps: undefined }, [], fist)).toMatchObject({ item: 2, damage: '2d4+1 bludgeoning' })
})

it('offers handwrap runes for compatible unarmed attacks without requiring the buff to be active', () => {
  const options = handwrapRuneOptions({ ...base, handwraps: { potency: 3, striking: 0, runes: [] } }, []).map((rune) => rune.name)
  expect(options).toContain('Wounding')
  expect(options).not.toContain('Shifting')
  expect(options).not.toContain('Returning')
})

it('ignores directly configured unarmed runes while leaving saved data and manufactured weapons unchanged', () => {
  const unarmed = { id: FIST.id, name: FIST.name, potency: 3, striking: 3, runes: ['Flaming'] }
  expect(effectiveWeapon(base, [], unarmed)).toMatchObject({ potency: 2, striking: 1, runes: ['Grievous', 'Grappling'] })
  expect(weaponAttack(base, [], unarmed)).toMatchObject({ item: 2, damage: '2d4+1 bludgeoning' })
  expect(unarmed).toMatchObject({ potency: 3, striking: 3, runes: ['Flaming'] })
  const c: Character = { ...base, handwraps: { potency: 1, striking: 1, runes: ['Impactful'] } }
  expect(effectiveWeapon(c, [], unarmed)).toMatchObject({ potency: 2, striking: 1, runes: ['Grievous', 'Grappling'] })
  expect(effectiveWeapon(c, [], { ...unarmed, name: 'Gauntlet' })).toMatchObject({ potency: 3, striking: 3, runes: ['Flaming'] })
  expect(effectiveWeapon({ ...c, handwraps: undefined }, [], unarmed)).toMatchObject({ potency: 2, striking: 1, runes: ['Grievous', 'Grappling'] })
})

it('derives hardlight tracking and damage dice from its automatically upgraded grade, not attack runes', () => {
  const c: Character = {
    ...base, handwraps: { kind: 'hardlight', grade: 'Advanced', potency: 0, striking: 0, runes: ['Wounding'] },
    activeSpells: ['Animal Feature'],
    feats: [{ name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' }],
  }
  const attack = ownedWeapons(c, []).find((weapon) => weapon.name === ANIMAL_FEATURE_CLAWS.name)!
  expect(weaponAttack(c, [], attack)).toMatchObject({ item: 2, damage: '2d6+1 slashing' })
  expect(effectiveWeapon(c, [], attack).runes).toEqual([])
  expect(weaponAttack({ ...c, handwraps: { ...c.handwraps!, grade: 'Paragon' } }, [], attack))
    .toMatchObject({ item: 3, damage: '4d6+1 slashing' })
})

it('filters runes using AoN weapon, damage, trait, and named-weapon requirements', () => {
  const rune = (name: string, usage: string): ContentEntry => ({
    ...HAFT_STRIKER_WEAPON, id: name, kind: 'item', name,
    data: { item_subcategory: 'Weapon Property Runes', usage },
  })
  const runes = [
    rune('Wounding', 'etched onto a piercing or slashing melee weapon'),
    rune('Returning', 'etched onto a thrown weapon'),
    rune('Deflecting', 'etched onto a weapon with the parry trait'),
    rune('Flurrying', 'etched onto a melee weapon with the monk trait'),
    rune('Crushing', 'etched onto a bludgeoning weapon'),
    rune('Bloodbane', 'etched onto a clan dagger'),
    rune('Flaming', 'etched onto a weapon'),
    rune('Greater Flaming', 'etched onto a weapon'),
    rune('Holy', "etched onto a weapon that isn't unholy"),
    rune('Unholy', "etched into a weapon that isn't holy"),
  ]
  const available = (entry: ContentEntry, selected: string[] = []) => eligibleWeaponRunes([entry, ...runes], {
    id: 'w', name: entry.name, potency: 3, striking: 0, runes: selected,
  }).map((r) => r.name)
  const bow = { ...HAFT_STRIKER_WEAPON, name: 'Bow', traits: [], data: { weapon_type: 'Ranged', range: 60, damage: '1d6 piercing' } }
  expect(available(bow)).not.toContain('Wounding')
  expect(available(bow)).not.toContain('Returning')
  expect(available(bow)).toContain('Flaming')
  expect(available(bow, ['Flaming'])).not.toContain('Flaming (Greater)')
  const sword = { ...bow, name: 'Sword', data: { weapon_type: 'Melee', damage: '1d8 slashing' } }
  expect(available(sword)).toContain('Wounding')
  expect(available(sword)).not.toContain('Crushing')
  expect(available(sword)).not.toContain('Bloodbane')
  const club = { ...sword, name: 'Club', traits: ['Thrown 20 feet', 'Parry', 'Monk'], data: { weapon_type: 'Melee', damage: '1d6 bludgeoning' } }
  expect(available(club)).toEqual(expect.arrayContaining(['Crushing', 'Returning', 'Deflecting', 'Flurrying']))
  expect(available(club)).not.toContain('Wounding')
  expect(available({ ...sword, name: 'Clan Dagger' })).toContain('Bloodbane')
  expect(available(sword, ['Unholy'])).not.toContain('Holy')
  expect(available(sword, ['Holy'])).not.toContain('Unholy')
  expect(eligibleWeaponRunes([bow], { id: 'w', name: bow.name, potency: 1, striking: 0, runes: [] }).map((r) => r.name)).not.toContain('Wounding')
})

it('preserves normalized rune usage, source precedence, and content updates in indexed lookups', () => {
  const sword = { ...HAFT_STRIKER_WEAPON, name: 'Sword', data: { weapon_type: 'Melee', damage: '1d8 slashing' } }
  const rune: ContentEntry = {
    ...HAFT_STRIKER_WEAPON, id: 'greater-flaming', kind: 'item', name: 'Greater Flaming',
    data: { item_subcategory: 'Weapon Property Runes', usage: 'etched onto a ranged weapon' },
  }
  const otherItem = { ...rune, id: 'other', data: { item_subcategory: 'Other Items', usage: 'etched onto a weapon' } }
  const duplicate = { ...rune, id: 'duplicate', name: 'Flaming (Greater)', data: { ...rune.data, usage: 'etched onto a weapon' } }
  const catalog = [sword, otherItem, rune, duplicate]
  const owned = { id: 'sword', name: sword.name, potency: 3, striking: 0, runes: [] }
  expect(eligibleWeaponRunes(catalog, owned).map(option => option.name)).not.toContain('Flaming (Greater)')
  const updated = catalog.map(entry => entry.id === rune.id ? { ...entry, data: { ...entry.data, usage: 'etched onto a weapon' } } : entry)
  expect(eligibleWeaponRunes(updated, owned).map(option => option.name)).toContain('Flaming (Greater)')
  const decaying = { ...rune, id: 'decaying', name: 'Decaying', data: { ...rune.data, usage: 'etched onto a weapon' } }
  const disrupting = { ...rune, id: 'disrupting', name: 'Greater Disrupting',
    data: { ...rune.data, usage: 'etched onto a weapon without a decaying rune' } }
  expect(eligibleWeaponRunes([sword, decaying, disrupting], { ...owned, runes: ['Disrupting (Greater)'] })
    .map(option => option.name)).not.toContain('Decaying')
})
