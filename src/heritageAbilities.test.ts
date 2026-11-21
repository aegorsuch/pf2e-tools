import { expect, it } from 'vitest'
import { mapAonHit } from './aon'
import { ancestryFlaws, boostSlots, computeAbilities, maxHp } from './builder'
import type { Character } from './types'

const character = (ancestry: string, heritage: string, boosts?: Character['boosts']): Character => ({
  id: 'heritage-abilities',
  name: 'Test',
  systems: ['sf2e'],
  level: 1,
  ancestry,
  heritage,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  boosts,
  feats: [],
  equipment: [],
  lores: [],
  languages: [],
  entryIds: [],
  extraSlots: [],
  updatedAt: 0,
})

const ancestryEntry = (name: string, boosts: string[], flaws: string[], hp = 6) => mapAonHit({
  _id: `ancestries--1-${name.toLowerCase()}`,
  _source: { category: 'ancestry', name, attribute: boosts, attribute_flaw: flaws, hp },
}, 'sf2e')!

const heritageEntry = (parent: string, name: string, markdown: string, hp?: number) => mapAonHit({
  _id: `ancestries--1-${parent.toLowerCase()}--heritages--1-${name.toLowerCase().replaceAll(' ', '-')}`,
  _source: { category: 'heritage', name, trait: [parent], markdown, ...(hp === undefined ? {} : { hp }) },
}, 'sf2e')!

it('adds heritage boosts and flaws while restricting the ancestry free boost', () => {
  const lashunta = ancestryEntry('Lashunta', ['Charisma', 'Free'], [])
  const damaya = heritageEntry('Lashunta', 'Damaya Lashunta',
    'You gain an attribute boost to Intelligence and an attribute flaw to Constitution, but the free ancestry boost can’t also be Intelligence.')
  const c = character('Lashunta', 'Damaya Lashunta', { 'ancestry:1': 'int' })
  const entries = [lashunta, damaya]

  expect(damaya.data).toMatchObject({
    heritage_ability_boosts: 'Intelligence',
    heritage_ability_flaws: 'Constitution',
    heritage_free_boost_exclusions: 'Intelligence',
  })
  expect(boostSlots(c, entries)).toEqual(expect.arrayContaining([
    expect.objectContaining({ fixed: 'int', group: 'ancestry' }),
    expect.objectContaining({ key: 'ancestry:1', options: expect.not.arrayContaining(['int']) }),
  ]))
  expect(ancestryFlaws(c, entries)).toEqual(['con'])
  expect(computeAbilities(c, entries).int).toBe(12)
})

it('replaces ancestry boosts and flaws for an overriding heritage', () => {
  const pahtra = ancestryEntry('Pahtra', ['Charisma', 'Dexterity', 'Free'], ['Constitution'], 8)
  const saberine = heritageEntry('Pahtra', 'Saberine Pahtra',
    'Instead of the normal attribute boosts, you can choose to gain a boost to Strength, a boost to Charisma, a free boost, and a flaw in Intelligence.')
  const c = character('Pahtra', 'Saberine Pahtra')

  expect(boostSlots(c, [pahtra, saberine]).filter(slot => slot.group === 'ancestry').map(slot => slot.fixed))
    .toEqual(['str', 'cha', undefined])
  expect(ancestryFlaws(c, [pahtra, saberine])).toEqual(['int'])
})

it('swaps ancestry boosts and flaws and uses imported heritage HP', () => {
  const dwarf = ancestryEntry('Dwarf', ['Constitution', 'Wisdom', 'Free'], ['Charisma'], 10)
  const hyrngar = heritageEntry('Dwarf', 'Deep Space Hyrngar',
    'You have an attribute bonus to Charisma and a flaw to Wisdom rather than the other way around.')
  const c = character('Dwarf', 'Deep Space Hyrngar')
  expect(boostSlots(c, [dwarf, hyrngar]).filter(slot => slot.group === 'ancestry').map(slot => slot.fixed))
    .toEqual(['con', 'cha', undefined])
  expect(ancestryFlaws(c, [dwarf, hyrngar])).toEqual(['wis'])

  const goblin = ancestryEntry('Goblin', ['Dexterity', 'Charisma', 'Free'], ['Wisdom'])
  const junker = heritageEntry('Goblin', 'Junker Goblin',
    'You gain an attribute boost to Intelligence instead of Charisma, but the free ancestry boost can’t also be Intelligence.')
  expect(boostSlots(character('Goblin', 'Junker Goblin'), [goblin, junker])
    .find(slot => slot.key === 'ancestry:1')?.fixed).toBe('int')
  expect(boostSlots(character('Goblin', 'Junker Goblin'), [goblin, junker])
    .find(slot => slot.key === 'ancestry:2')?.options).not.toContain('int')
})

it('applies heritage boosts, flaws, and HP directly from descriptive rules', () => {
  const lashunta = ancestryEntry('Lashunta', ['Charisma', 'Free'], [])
  const korasha = heritageEntry('Lashunta', 'Korasha Lashunta',
    'You gain an attribute boost to Strength and an attribute flaw to Wisdom.', 8)
  const c = character('Lashunta', 'Korasha Lashunta')
  expect(boostSlots(c, [lashunta, korasha]).some(slot => slot.fixed === 'str')).toBe(true)
  expect(ancestryFlaws(c, [lashunta, korasha])).toEqual(['wis'])
  expect(maxHp(c, [lashunta, korasha])).toBe(8)
})
