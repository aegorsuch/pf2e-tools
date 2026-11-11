import { expect, it } from 'vitest'
import type { Character, ContentEntry } from './types'
import { ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS, FIST, GAUNTLET, HAFT_STRIKER_WEAPON, homebrewWeapons, IRON_FIST, ORC_TUSKS } from './supplemental'
import { effectiveWeapon, eligibleWeaponRunes, handwrapRuneOptions, isLockedWeapon, ownedWeapons, weaponAttack, weaponCategory } from './builder'

const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Ranger',
  abilities: { str: 12, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('uses simple proficiency and finesse for the haft while retaining Strength damage', () => {
  const attack = weaponAttack(base, [HAFT_STRIKER_WEAPON, {
    ...HAFT_STRIKER_WEAPON, id: 'ranger', kind: 'class', name: 'Ranger',
    data: { attack_proficiency: 'Trained in simple weapons' },
  }], { id: 'haft', name: 'Haft Striker Stance', potency: 0, striking: 0, runes: [] })
  expect(weaponCategory(HAFT_STRIKER_WEAPON)).toBe('Simple')
  expect(attack).toMatchObject({ ability: 'dex', attack: 16, damage: '1d4+1 bludgeoning', traits: ['Agile', 'Finesse'] })
})

it('grants Haft Striker Stance from its feat without duplicating configured weapons', () => {
  const c = { ...base, feats: [{ name: 'Haft Striker Stance', type: 'Class Feat', level: 2 }] }
  const weapons = ownedWeapons(c, [])
  expect(weapons.filter((weapon) => weapon.name === HAFT_STRIKER_WEAPON.name)).toHaveLength(1)
  expect(ownedWeapons({ ...c, weapons }, []).filter((weapon) => weapon.name === HAFT_STRIKER_WEAPON.name)).toHaveLength(1)
  expect(ownedWeapons({ ...c, weapons, feats: [] }, []).map((weapon) => weapon.name)).toEqual(['Fist'])
  const configured = { id: 'manual-haft', name: HAFT_STRIKER_WEAPON.name, potency: 2, striking: 1, runes: ['Flaming'] }
  expect(ownedWeapons({ ...c, weapons: [configured] }, []).find((weapon) => weapon.name === configured.name)).toBe(configured)
})

it('derives and locks one gauntlet while eligible armor is worn, preserving independent weapon runes', () => {
  const plate = { id: 'plate', name: 'Full Plate', potency: 0, resilient: 0, runes: [], worn: true }
  const c: Character = { ...base, armors: [plate], handwraps: { potency: 3, striking: 3, runes: ['Flaming'] } }
  const gauntlet = ownedWeapons(c, []).find((weapon) => weapon.name === 'Gauntlet')!
  expect(isLockedWeapon(c, gauntlet.name)).toBe(true)
  expect(weaponCategory(GAUNTLET)).toBe('Simple')
  expect(weaponAttack(c, [], gauntlet)).toMatchObject({
    ability: 'str', item: 0, damage: '1d4+1 bludgeoning', traits: ['Agile', 'Free-Hand'],
  })
  const configured = { ...gauntlet, potency: 2, striking: 1, runes: ['Flaming'] }
  const saved = { ...c, weapons: [configured] }
  expect(ownedWeapons(saved, []).filter((weapon) => weapon.name === 'Gauntlet')).toEqual([configured])
  const unworn = { ...saved, armors: [{ ...plate, worn: false }] }
  expect(ownedWeapons(unworn, []).map((weapon) => weapon.name)).not.toContain('Gauntlet')
  expect(isLockedWeapon(unworn, 'Gauntlet')).toBe(false)
  expect(ownedWeapons({ ...unworn, armors: [plate] }, []).find((weapon) => weapon.name === 'Gauntlet')).toEqual(configured)
  for (const name of ['Full Plate', 'Half Plate', 'Splint Mail']) {
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
    traits: tekko.traits, data: tekko.data,
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
  expect(weaponAttack(c, [clawed], provided)).toMatchObject({ ability: 'dex', item: 1, damage: '2d4+1 slashing', traits: tekko.traits })
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
  expect(weaponAttack(c, [], weapons[0])).toMatchObject({ attack: 16, damage: '1d6+1 piercing', traits: ['Finesse', 'Unarmed'] })
  expect(ownedWeapons({ ...c, weapons, feats: [] }, []).map((weapon) => weapon.name)).toEqual(['Fist'])
})

it('adds Iron Fist only with Iron Fists and retains other unarmed attacks', () => {
  const c = { ...base, feats: ['Iron Fists', 'Tusks'].map((name) => ({ name, type: 'Ancestry Feat', level: 1 })) }
  const weapons = ownedWeapons(c, [])
  expect(weapons.map((weapon) => weapon.name)).toEqual(['Iron Fist', 'Tusks'])
  expect(weaponAttack(c, [], weapons[0])).toMatchObject({
    damage: '1d4+1 bludgeoning', traits: ['Agile', 'Finesse', 'Shove', 'Unarmed'],
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
  expect(active.map((weapon) => weapon.name)).toEqual([ANIMAL_FEATURE_CLAWS.name, ANIMAL_FEATURE_JAWS.name])
  expect(weaponAttack(c, [], active[0])).toMatchObject({
    attack: 16, ability: 'dex', damage: '1d6+1 slashing', traits: ['Agile', 'Finesse', 'Unarmed'],
  })
  expect(weaponAttack(c, [], active[1])).toMatchObject({
    attack: 13, ability: 'str', damage: '1d8+1 piercing', traits: ['Unarmed'],
  })
  const reloaded: Character = JSON.parse(JSON.stringify({ ...c, weapons: active }))
  expect(ownedWeapons(reloaded, [])).toEqual(active)
  expect(ownedWeapons({ ...reloaded, activeSpells: [] }, []).map((weapon) => weapon.name)).toEqual(['Fist'])
  expect(ownedWeapons({ ...reloaded, feats: [] }, []).map((weapon) => weapon.name)).toEqual(['Fist'])
  expect(ownedWeapons({ ...base, activeSpells: ['Animal Feature'], spells: [
    { name: 'Animal Feature', rank: 2, cantrip: false },
  ] }, []).map((weapon) => weapon.name)).toEqual([ANIMAL_FEATURE_CLAWS.name, ANIMAL_FEATURE_JAWS.name])
})

it('shares handwrap fundamentals and compatible property runes with current and future unarmed attacks only', () => {
  const c: Character = { ...base, handwraps: { potency: 2, striking: 1, runes: ['Impactful (Greater)', 'Wounding'] } }
  const fist = ownedWeapons(c, [])[0]
  expect(weaponAttack(c, [], fist)).toMatchObject({ attack: 18, item: 2, damage: '2d4+1 bludgeoning' })
  expect(effectiveWeapon(c, [], fist).runes).toEqual(['Impactful (Greater)'])
  const buffed: Character = {
    ...c, activeSpells: ['Animal Feature'],
    feats: [...['Iron Fists', 'Tusks'].map((name) => ({ name, type: 'Ancestry Feat', level: 1 })),
      { name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' }],
  }
  for (const weapon of ownedWeapons(buffed, [])) {
    expect(weaponAttack(buffed, [], weapon).item).toBe(2)
    expect(weaponAttack(buffed, [], weapon).damage).toMatch(/^2d[468]\+1 /)
    expect(effectiveWeapon(buffed, [], weapon).runes).toEqual(weapon.name === IRON_FIST.name ? ['Impactful (Greater)'] : c.handwraps!.runes)
    expect(weapon).toMatchObject({ potency: 0, striking: 0, runes: [] })
  }
  const haft = { id: 'haft', name: HAFT_STRIKER_WEAPON.name, potency: 1, striking: 0, runes: [] }
  expect(effectiveWeapon(c, [], haft)).toBe(haft)
  expect(weaponAttack(c, [], haft)).toMatchObject({ item: 1, damage: '1d4+1 bludgeoning' })
  expect(weaponAttack({ ...c, handwraps: undefined }, [], fist)).toMatchObject({ item: 0, damage: '1d4+1 bludgeoning' })
})

it('offers handwrap runes for compatible unarmed attacks without requiring the buff to be active', () => {
  const options = handwrapRuneOptions({ ...base, handwraps: { potency: 3, striking: 0, runes: [] } }, []).map((rune) => rune.name)
  expect(options).toContain('Wounding')
  expect(options).not.toContain('Shifting')
  expect(options).not.toContain('Returning')
})

it('ignores directly configured unarmed runes while leaving saved data and manufactured weapons unchanged', () => {
  const unarmed = { id: FIST.id, name: FIST.name, potency: 3, striking: 3, runes: ['Flaming'] }
  expect(effectiveWeapon(base, [], unarmed)).toMatchObject({ potency: 0, striking: 0, runes: [] })
  expect(weaponAttack(base, [], unarmed)).toMatchObject({ item: 0, damage: '1d4+1 bludgeoning' })
  expect(unarmed).toMatchObject({ potency: 3, striking: 3, runes: ['Flaming'] })
  const c: Character = { ...base, handwraps: { potency: 1, striking: 1, runes: ['Impactful'] } }
  expect(effectiveWeapon(c, [], unarmed)).toMatchObject({ potency: 1, striking: 1, runes: ['Impactful'] })
  expect(effectiveWeapon(c, [], { ...unarmed, name: 'Gauntlet' })).toMatchObject({ potency: 3, striking: 3, runes: ['Flaming'] })
  expect(effectiveWeapon({ ...c, handwraps: undefined }, [], unarmed)).toMatchObject({ potency: 0, striking: 0, runes: [] })
})

it('derives hardlight tracking and damage dice from its saved grade, not directly configured attack runes', () => {
  const c: Character = {
    ...base, handwraps: { kind: 'hardlight', grade: 'Advanced', potency: 0, striking: 0, runes: ['Wounding'] },
    activeSpells: ['Animal Feature'],
    feats: [{ name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' }],
  }
  const attack = ownedWeapons(c, []).find((weapon) => weapon.name === ANIMAL_FEATURE_CLAWS.name)!
  expect(weaponAttack(c, [], attack)).toMatchObject({ item: 1, damage: '2d6+1 slashing' })
  expect(effectiveWeapon(c, [], attack).runes).toEqual(['Wounding'])
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
