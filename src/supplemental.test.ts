import { expect, it } from 'vitest'
import type { Character, ContentEntry } from './types'
import { FIST, HAFT_STRIKER_WEAPON, IRON_FIST, ORC_TUSKS } from './supplemental'
import { eligibleWeaponRunes, ownedWeapons, weaponAttack, weaponCategory } from './builder'

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
