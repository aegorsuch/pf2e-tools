import { afterEach, beforeEach, expect, it } from 'vitest'
import { mapAonHit } from './aon'
import { armorBulk, armorStrengthMet, automaticFeatGrants, boostSlots, classDifficultyClass, equippedWeaponHands, offensiveDefenseAttack, ranksAt, resistances, starfinderArmorPenalties, subclassOptions, weaponAttack, weaponHands } from './builder'
import { ERUDITE_LORE_KEY } from './soldier'
import { getSettings, updateSettings } from './settings'
import type { Character, ContentEntry } from './types'

const base: Character = {
  id: 'soldier', name: 'Soldier', className: 'Soldier', systems: ['sf2e'], level: 1,
  abilities: { str: 10, dex: 12, con: 18, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const soldier = mapAonHit({ _id: 'soldier', _source: {
  name: 'Soldier', category: 'class', attribute: ['Key Attribute'],
  skill_proficiency: ['Trained in Intimidation', 'Trained in a number of additional skills equal to 3 plus your Intelligence modifier'],
  attack_proficiency: ['Trained in simple weapons', 'Trained in martial weapons', 'Trained in unarmed attacks'],
} }, 'sf2e')!
const armor: ContentEntry = {
  id: 'armor', name: 'Armor', kind: 'armor', systems: ['sf2e'], source: 'official', level: 1,
  traits: [], data: { strength: 3, check_penalty: -2, speed_penalty: -10, bulk: 3 }, description: '', effects: [], updatedAt: 0,
}
const weapon: ContentEntry = {
  ...armor, id: 'gun', name: 'Gun', kind: 'weapon', traits: ['Automatic', 'Tech'],
  data: { weapon_category: 'Martial', range: 60, hands: 2, damage: '1d8 piercing', weapon_tracking: 1, weapon_grade: 'Tactical' },
}
const owned = { id: 'gun', name: 'Gun', potency: 0, striking: 0, runes: [] }
let previous: ReturnType<typeof getSettings>
beforeEach(() => {
  previous = getSettings()
  updateSettings({ autoClassSkills: false, autoLores: false })
})
afterEach(() => updateSettings(previous))

it('provides Constitution and all five fighting styles, with Erudite skill variants', () => {
  expect(boostSlots(base, [soldier]).find(slot => slot.key === 'class')?.fixed).toBe('con')
  expect(classDifficultyClass(base, [soldier])).toBe(17)
  expect(subclassOptions(base, []).map(entry => entry.name)).toEqual(expect.arrayContaining([
    'Action Hero', 'Armor Storm', 'Bombard', 'Close Quarters', 'Erudite Warrior (Diplomacy)', 'Erudite Warrior (Society)',
  ]))
  expect(subclassOptions({ ...base, systems: ['pf2e'] }, [])).toEqual([])
})

it.each([[1, 1], [6, 1], [7, 2], [13, 3], [17, 4]])('scales both Erudite skills at level %i without paid increases', (level, rank) => {
  const c = { ...base, level, subclass: 'Erudite Warrior (Diplomacy)',
    subclassSkillChoices: { [ERUDITE_LORE_KEY]: 'Military Lore' } }
  expect(ranksAt(c, [soldier])).toMatchObject({ Diplomacy: rank, 'Military Lore': rank })
  expect(ranksAt({ ...c, className: 'Mechanic' }, [soldier])['Military Lore']).toBeUndefined()
  if (level === 7) expect(ranksAt(c, [soldier], 7)).toMatchObject({ Diplomacy: 1, 'Military Lore': 1 })
})

it('uses Constitution for armor requirements but requires actual Strength for the worn Bulk discount', () => {
  const c = { ...base, armors: [{ id: 'armor', name: 'Armor', potency: 0, resilient: 0, runes: [], worn: true }] }
  expect(armorStrengthMet(c, armor)).toBe(true)
  expect(starfinderArmorPenalties(c, [armor])).toEqual({ check: 0, speed: -5 })
  expect(armorBulk(c, armor, true)).toBe(3)
  const strong = { ...c, abilities: { ...c.abilities, str: 16 } }
  expect(armorBulk(strong, armor, true)).toBe(2)
  expect(armorBulk(strong, armor, false)).toBe(3)
  expect(armorBulk(strong, { ...armor, data: { ...armor.data, bulk: 1 } }, true)).toBe(1)
  expect(starfinderArmorPenalties({ ...c, className: 'Mechanic' }, [armor])).toEqual({ check: -2, speed: -10 })
})

it('keeps normal Dexterity Strikes separate from Constitution area DCs and doubles Action Hero cone range', () => {
  const entries = [soldier, weapon]
  const hero = weaponAttack({ ...base, subclass: 'Action Hero' }, entries, owned)
  expect(hero).toMatchObject({ ability: 'dex', mod: 1, breakdown: { total: 5 } })
  expect(hero.areaAttacks).toContainEqual(expect.objectContaining({ name: 'Auto-Fire', dc: 18, shape: '60-foot cone' }))
  expect(weaponAttack(base, entries, owned).areaAttacks[0].shape).toBe('30-foot cone')
  expect(weaponAttack({ ...base, level: 5 }, entries, owned).criticalSpecialization).toBe(true)
  expect(weaponAttack({ ...base, level: 4 }, entries, owned).criticalSpecialization).toBe(false)
  expect(weaponAttack({ ...base, className: 'Mechanic' }, entries, owned).areaAttacks).toEqual([])
})

it('shows Ammo Hoarder and Run Hot only for their required weapon traits', () => {
  const c: Character = { ...base, level: 8, feats: [
    { name: 'Ammo Hoarder', type: 'Class Feat', level: 8 },
    { name: 'Run Hot', type: 'Class Feat', level: 8 },
  ] }
  const automatic = weaponAttack(c, [soldier, weapon], owned).breakdown.notes?.join(' ')
  expect(automatic).toContain('Auto-Fire expends ammunition equal to the number of targets')
  expect(automatic).not.toContain('Run Hot')
  const area = { ...weapon, traits: [...weapon.traits, 'Area'] }
  const areaNotes = weaponAttack(c, [soldier, area], owned).breakdown.notes?.join(' ')
  expect(areaNotes).toContain('Run Hot (3 actions): Area Fire twice')
})

it('grants Close Quarters Whirling Swipe and only conditional Armor Storm resistance', () => {
  expect(automaticFeatGrants({ ...base, subclass: 'Close Quarters' }, []))
    .toContainEqual({ name: 'Whirling Swipe', source: 'Close Quarters', level: 1 })
  expect(resistances({ ...base, level: 9, subclass: 'Armor Storm' }, []))
    .toContainEqual({ damage: 'All damage from attacks by suppressed creatures', value: 4, source: 'Armor Storm' })
  expect(resistances({ ...base, subclass: 'Bombard' }, [])).toEqual([])
})

it.each([
  ['Force Field (Commercial)', 1, '2d10 bludgeoning'],
  ['Force Field (Superior)', 2, '2d10 bludgeoning'],
  ['Force Field (Elite)', 2, '3d10 bludgeoning'],
  ['Force Field (Ultimate)', 3, '3d10 bludgeoning'],
  ['Force Field (Paragon)', 3, '4d10 bludgeoning'],
])('scales Offensive Defense from %s grade', (name, tracking, damage) => {
  const forceField: ContentEntry = {
    ...armor, id: name, name, kind: 'item', level: 10, data: { item_subcategory: 'Armor Upgrades' },
  }
  const c: Character = { ...base, level: 6, feats: [{ name: 'Offensive Defense', type: 'Class Feat', level: 6 }],
    armors: [{ id: 'armor', name: armor.name, potency: 0, resilient: 0, runes: [], upgrades: [forceField.id], worn: true }] }
  const attack = offensiveDefenseAttack(c, [forceField])
  expect(attack?.entry.data).toMatchObject({ damage, weapon_tracking: tracking, weapon_group: 'Shield' })
  expect(attack?.weapon.potency).toBe(tracking)
})

it('requires Offensive Defense and a worn Force Field upgrade or held tech shield', () => {
  const forceField: ContentEntry = { ...armor, id: 'force-field', name: 'Force Field', kind: 'item',
    data: { item_subcategory: 'Armor Upgrades' } }
  const feat = { name: 'Offensive Defense', type: 'Class Feat', level: 6 }
  const c: Character = { ...base, level: 6, feats: [feat],
    armors: [{ id: 'armor', name: armor.name, potency: 0, resilient: 0, runes: [], upgrades: [forceField.id], worn: false }] }
  expect(offensiveDefenseAttack(c, [forceField])).toBeUndefined()
  expect(offensiveDefenseAttack({ ...c, feats: [] }, [forceField])).toBeUndefined()
  const shield: ContentEntry = { ...armor, id: 'irising-shield', name: 'Superior Irising Shield', kind: 'shield',
    traits: ['Tech'], data: {} }
  const heldShield = { id: 'irising-shield', name: shield.name, equipped: true, hardness: 5, hp: 20, damage: 0, raised: false }
  expect(offensiveDefenseAttack({ ...c, armors: [], shield: heldShield }, [shield])?.entry.data)
    .toMatchObject({ damage: '2d10 bludgeoning', weapon_tracking: 2 })
  expect(offensiveDefenseAttack({ ...c, armors: [], shield: { ...heldShield, equipped: false } }, [shield])).toBeUndefined()
})

it('uses Offensive Defense tracking for attack and area DC without adding Strength to its fixed damage', () => {
  const forceField: ContentEntry = { ...armor, id: 'superior-force-field', name: 'Force Field (Superior)', kind: 'item',
    data: { item_subcategory: 'Armor Upgrades' } }
  const c: Character = { ...base, level: 6, abilities: { ...base.abilities, str: 18 },
    feats: [{ name: 'Offensive Defense', type: 'Class Feat', level: 6 }],
    armors: [{ id: 'armor', name: armor.name, potency: 0, resilient: 0, runes: [], upgrades: [forceField.id], worn: true }] }
  const added = offensiveDefenseAttack(c, [forceField])!
  const entries = [soldier, forceField, added.entry]
  const attack = weaponAttack(c, entries, added.weapon)
  expect(attack).toMatchObject({
    damage: '2d10 bludgeoning', item: 2,
    areaAttacks: [{ name: 'Area Fire', shape: '5-foot burst', dc: (classDifficultyClass(c, entries) ?? 0) + 2 }],
  })
})

it('adds Soldier weapon specialization only from level seven with expert weapon proficiency', () => {
  const expertise: ContentEntry = { ...soldier, id: 'expertise', kind: 'classFeature', name: 'Soldier Weapon Expertise', level: 5,
    data: { class: 'Soldier' }, description: 'Your proficiency ranks for simple weapons, martial weapons, and unarmed attacks increases to expert.' }
  const entries = [soldier, weapon, expertise]
  expect(weaponAttack({ ...base, level: 6 }, entries, owned).damage).toBe('1d8 piercing')
  expect(weaponAttack({ ...base, level: 7 }, entries, owned).damage).toBe('1d8+2 piercing')
})

it("allows Damoritosh's Grip to wield two-handed weapons with one hand without changing earlier levels", () => {
  const c: Character = { ...base, level: 18, feats: [{ name: "Damoritosh's Grip", type: 'Class Feat', level: 18 }],
    weapons: [{ ...owned, handsHeld: 1 }] }
  expect(weaponHands([weapon], c.weapons![0], c)).toBe(1)
  expect(equippedWeaponHands(c, [weapon])).toBe(1)
  expect(weaponHands([weapon], { ...owned, handsHeld: 2 }, c)).toBe(2)
  expect(weaponHands([weapon], owned, c)).toBe(2)
  expect(weaponHands([weapon], c.weapons![0], { ...c, level: 17 })).toBe(2)
  expect(weaponHands([weapon], c.weapons![0], { ...c, systems: ['pf2e'] })).toBe(2)
})
