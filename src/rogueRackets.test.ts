import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { armorRanks, eligibleFeats, featChoiceOptions, featPrerequisiteChecker, plannedSlots, ranksAt, weaponAttack, weaponRanks } from './builder'
import { getSettings, updateSettings } from './settings'
import { WeaponList } from './GearSection'
import { homebrewCharacterOptions } from './supplemental'
import type { Character, ContentEntry } from './types'

const base: Character = { id: 'rogue', systems: ['pf2e'], name: 'Rogue', className: 'Rogue', subclass: 'Thief', level: 10,
  abilities: { str: 12, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
const rogue: ContentEntry = { id: 'rogue', name: 'Rogue', kind: 'class', source: 'official', systems: ['pf2e'], level: 0,
  traits: [], description: '', data: { light_armor_proficiency: 'Expert' }, effects: [], updatedAt: 0 }
const dagger: ContentEntry = { id: 'dagger', name: 'Dagger', kind: 'weapon', source: 'official', systems: ['pf2e'], level: 0,
  traits: ['Finesse'], description: '', data: { weapon_category: 'Simple', damage: '1d4 piercing' }, effects: [], updatedAt: 0 }

it('grants primary racket skills and thief damage without adding Dexterity to thrown strikes', () => {
  expect(ranksAt(base, [rogue]).Thievery).toBe(1)
  expect(weaponAttack(base, [dagger], { id: 'd', name: 'Dagger', potency: 0, striking: 0, runes: [] }).damage).toBe('1d4+4 piercing')
  const thrown = { ...dagger, traits: ['Finesse', 'Thrown'], data: { ...dagger.data, weapon_type: 'Ranged' } }
  expect(weaponAttack(base, [thrown], { id: 'd', name: 'Dagger', potency: 0, striking: 0, runes: [] }).damage).toBe('1d4+1 piercing')
})

it('scales Rogue weapon proficiency at levels 5 and 13 from its class features', () => {
  const klass: ContentEntry = { ...rogue, data: { attack_proficiency: 'Trained in simple weapons, Trained in martial weapons, Trained in unarmed attacks' } }
  const tricks: ContentEntry = { ...rogue, id: 'tricks', kind: 'classFeature', name: 'Weapon Tricks', level: 5,
    data: { class: 'Rogue' }, description: 'You gain expert proficiency in simple weapons, martial weapons, and unarmed attacks.' }
  const master: ContentEntry = { ...tricks, id: 'master-tricks', name: 'Master Tricks', level: 13,
    description: 'Your proficiency ranks increase to master for all simple weapons, martial weapons, and unarmed attacks.' }
  const entries = [klass, tricks, master, dagger]
  for (const [level, rank] of [[1, 1], [4, 1], [5, 2], [12, 2], [13, 3], [20, 3]]) {
    const c = { ...base, level }
    expect(weaponRanks(c, entries)).toEqual({ Simple: rank, Martial: rank, Advanced: 0, Unarmed: rank })
    expect(weaponAttack(c, entries, { id: 'd', name: 'Dagger', potency: 0, striking: 0, runes: [] }).rank).toBe(rank)
  }
})

it('auto-scales racket skills despite lower saved overrides, only after acquisition', () => {
  const settings = getSettings()
  try {
    updateSettings({ autoClassSkills: true })
    for (const [level, rank] of [[1, 1], [3, 2], [7, 3], [15, 4]]) {
      expect(ranksAt({ ...base, level, rankOverrides: { Thievery: 1 } }, [rogue]).Thievery).toBe(rank)
    }
    const c: Character = { ...base, level: 15, rankOverrides: { Thievery: 1, Intimidation: 1, Stealth: 2 },
      feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Ruffian' }] }
    expect(ranksAt(c, [rogue])).toMatchObject({ Thievery: 4, Intimidation: 4, Stealth: 2 })
    expect(ranksAt(c, [rogue], 10).Intimidation).toBe(1) // saved override, not the later racket
    expect(ranksAt({ ...c, rankOverrides: {} }, [rogue], 10).Intimidation).toBeUndefined()
    expect(ranksAt(c, [rogue], 11).Intimidation).toBe(3)
    expect(ranksAt({ ...c, rankOverrides: { Thievery: 4 } }, [rogue], 4).Thievery).toBe(4)
    const mastermind: Character = { ...base, level: 15, subclass: 'Scoundrel', rogueRacketSkills: { Mastermind: 'Nature' },
      feats: [{ ...c.feats[0], choice: 'Mastermind' }] }
    expect(ranksAt(mastermind, [rogue])).toMatchObject({ Deception: 4, Diplomacy: 4, Society: 4, Nature: 4 })
    updateSettings({ autoClassSkills: false })
    expect(ranksAt(c, [rogue])).toMatchObject({ Thievery: 1, Intimidation: 1 })
  } finally { updateSettings(settings) }
})

it('checks additional racket prerequisites at the level the feat was acquired', () => {
  const ruffian: ContentEntry = { ...rogue, id: 'ruffian', kind: 'subclass', name: 'Ruffian', data: { class: 'Rogue' } }
  const target: ContentEntry = { ...rogue, id: 'target', kind: 'feat', name: 'Ruffian Feat',
    traits: ['Rogue'], data: { prerequisite: 'ruffian racket' } }
  const c: Character = { ...base, level: 12, feats: [{ name: 'Versatile Rogue', type: 'Class Feat',
    level: 10, slot: 'class:10:0', choice: 'Ruffian' }] }
  expect(featPrerequisiteChecker(c, [ruffian], 9)(target).missing).toEqual(['ruffian racket'])
  expect(featPrerequisiteChecker(c, [ruffian], 10)(target).missing).toEqual([])
  expect(featPrerequisiteChecker({ ...c, level: 9 }, [ruffian])(target).missing).toEqual(['ruffian racket'])
  const brutal: ContentEntry = { ...target, id: 'brutal', name: 'Brutal Beating', level: 2 }
  expect(eligibleFeats([ruffian, brutal], c, { key: 'class:12:0', category: 'class', level: 12 })).toContain(brutal)
  expect(eligibleFeats([ruffian, brutal], c, { key: 'class:8:0', category: 'class', level: 8 })).not.toContain(brutal)
})

it('offers a different repeatable racket with its grants and bonus skill feat slot', () => {
  const versatile = { name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Ruffian' }
  const c: Character = { ...base, feats: [versatile] }
  expect(homebrewCharacterOptions([]).find(entry => entry.name === versatile.name)?.data.repeatable).toBe(true)
  expect(featChoiceOptions(versatile.name, c, [rogue], 'class:10:0')).toEqual(['Ruffian', 'Scoundrel', 'Mastermind', 'Avenger'])
  expect(ranksAt(c, [rogue]).Intimidation).toBe(1)
  expect(armorRanks(c, [rogue]).Medium).toBe(2)
  expect(plannedSlots(c)).toContainEqual(expect.objectContaining({ category: 'skill', level: 10, grantedBy: 'Versatile Rogue' }))
  expect(plannedSlots({ ...c, level: 9 }).some(slot => slot.grantedBy === 'Versatile Rogue')).toBe(false)
  expect(featChoiceOptions(versatile.name, { ...c, feats: [versatile, { ...versatile, slot: 'class:12:0', choice: 'Scoundrel' }] },
    [rogue], 'class:12:0')).toEqual(['Scoundrel', 'Mastermind', 'Avenger'])
  const duplicates = { ...base, level: 20, feats: [
    { ...versatile, choice: 'Thief' }, { ...versatile, slot: 'class:12:0' }, { ...versatile, slot: 'class:14:0' },
  ] }
  expect(plannedSlots(duplicates).filter(slot => slot.grantedBy === 'Versatile Rogue')).toHaveLength(1)
})

it('grants Avenger divine skill, medium armor and deity-favored weapon proficiency', () => {
  const deity: ContentEntry = { ...rogue, id: 'deity', kind: 'deity', name: 'Deity',
    data: { skill: 'Religion', favored_weapon: 'Sawtooth Saber' } }
  const saber: ContentEntry = { ...dagger, name: 'Sawtooth Saber', data: { ...dagger.data, weapon_category: 'Advanced' } }
  const c: Character = { ...base, deity: deity.name, feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10,
    slot: 'class:10:0', choice: 'Avenger' }] }
  expect(ranksAt(c, [rogue, deity]).Religion).toBe(1)
  expect(armorRanks(c, [rogue]).Medium).toBe(2)
  expect(weaponAttack(c, [rogue, deity, saber], { id: 'saber', name: saber.name, potency: 0, striking: 0, runes: [] }).rank).toBe(1)
  expect(weaponAttack({ ...c, level: 9 }, [rogue, deity, saber], { id: 'saber', name: saber.name, potency: 0, striking: 0, runes: [] }).rank).toBe(0)
  const withWeapon = { ...c, weapons: [{ id: 'saber', name: saber.name, potency: 0, striking: 0, runes: [] }] }
  const markup = renderToStaticMarkup(createElement(WeaponList, { c: withWeapon, entries: [rogue, deity, saber], save: () => {}, displayOnly: true }))
  expect(markup).toContain('critical specialization applies on a critical hit against an off-guard target')
  expect(markup).toContain('sneak attack applies to your prey')
})

it('auto-scales the Avenger deity skill for primary and additional rackets', () => {
  const deity: ContentEntry = { ...rogue, id: 'deity', kind: 'deity', name: 'Deity', data: { skill: 'Religion' } }
  const settings = getSettings()
  try {
    updateSettings({ autoClassSkills: true })
    for (const [level, rank] of [[1, 1], [3, 2], [7, 3], [15, 4]]) {
      expect(ranksAt({ ...base, level, subclass: 'Avenger', deity: deity.name }, [rogue, deity]).Religion).toBe(rank)
    }
    const c: Character = { ...base, level: 15, deity: deity.name, feats: [{ name: 'Versatile Rogue',
      type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Avenger' }] }
    expect(ranksAt(c, [rogue, deity], 10).Religion).toBeUndefined()
    expect(ranksAt(c, [rogue, deity], 11).Religion).toBe(3)
    expect(ranksAt(c, [rogue, deity]).Religion).toBe(4)
    expect(ranksAt({ ...c, deity: undefined }, [rogue, deity]).Religion).toBeUndefined()
    updateSettings({ autoClassSkills: false })
    expect(ranksAt(c, [rogue, deity]).Religion).toBe(1)
  } finally { updateSettings(settings) }
})

it('omits Ruffian weapon helper text in both weapon views', () => {
  const c: Character = { ...base, subclass: 'Ruffian' }
  const weapon = (id: string, category: string, damage: string): ContentEntry =>
    ({ ...dagger, id, name: id, data: { weapon_category: category, damage } })
  const entries = [weapon('Simple d8', 'Simple', '1d8 piercing'), weapon('Simple d10', 'Simple', '1d10 piercing'),
    weapon('Martial d6', 'Martial', '1d6 piercing'), weapon('Martial d8', 'Martial', '1d8 piercing')]
  const weapons = entries.map(entry => ({ id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] }))
  for (const displayOnly of [true, false]) {
    const markup = renderToStaticMarkup(createElement(WeaponList, { c: { ...c, weapons }, entries, save: () => {}, displayOnly }))
    expect(markup).not.toContain('Ruffian: this weapon')
    for (const weapon of entries) expect(markup).toContain(weapon.name)
  }
})

it('grants both Mastermind skills only after its skill choice', () => {
  const c = { ...base, subclass: 'Mastermind', rogueRacketSkills: { Mastermind: 'Occultism' } }
  expect(ranksAt(c, [rogue])).toMatchObject({ Society: 1, Occultism: 1 })
  expect(ranksAt({ ...c, rogueRacketSkills: { Mastermind: 'Acrobatics' } }, [rogue]).Acrobatics).toBeUndefined()
})

it('offers Eldritch Trickster with its spellcasting multiclass dedication slot', () => {
  const wizard: ContentEntry = { ...rogue, id: 'wizard', kind: 'feat', name: 'Wizard Dedication', level: 2,
    traits: ['Archetype', 'Dedication', 'Multiclass'], data: { archetype: 'Wizard' } }
  const casting: ContentEntry[] = ['Basic', 'Expert', 'Master'].map(tier => ({ ...wizard, id: tier,
    name: `${tier} Wizard Spellcasting`, traits: ['Archetype'], data: { archetype: 'Wizard' } }))
  const fighter: ContentEntry = { ...wizard, id: 'fighter', name: 'Fighter Dedication', data: { archetype: 'Fighter' } }
  const entries = [rogue, wizard, fighter, ...casting]
  expect(featChoiceOptions('Versatile Rogue', base, entries, 'class:10:0')).toContain('Eldritch Trickster')
  const c: Character = { ...base, feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10,
    slot: 'class:10:0', choice: 'Eldritch Trickster' }] }
  const slot = plannedSlots(c).find(candidate => candidate.grantedBy === 'Eldritch Trickster')!
  expect(slot).toMatchObject({ category: 'archetype', level: 10, maxFeatLevel: 2 })
  expect(eligibleFeats(entries, c, slot).map(feat => feat.name)).toEqual(['Wizard Dedication'])
  expect(plannedSlots({ ...c, level: 9 }).some(candidate => candidate.grantedBy === 'Eldritch Trickster')).toBe(false)
  const primary = { ...base, level: 1, subclass: 'Eldritch Trickster' }
  const initialSlot = plannedSlots(primary).find(candidate => candidate.grantedBy === 'Eldritch Trickster')!
  expect(eligibleFeats(entries, primary, initialSlot).map(feat => feat.name)).toEqual(['Wizard Dedication'])
  const magical: ContentEntry = { ...wizard, id: 'magical', name: 'Magical Trickster', level: 4, traits: ['Rogue'], data: {} }
  expect(eligibleFeats([magical], { ...primary, level: 2 }, { key: 'class:2:0', category: 'class', level: 2 }))
    .toContain(magical)
})
