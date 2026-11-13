import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { armorRanks, eligibleFeats, featChoiceOptions, plannedSlots, ranksAt, weaponAttack } from './builder'
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
