import { expect, it } from 'vitest'
import { fiendLevelLimit, fiendOptions, normalizeFiends, normalizePlants, plantLevelLimit, plantOptions } from './summonedFiends'
import type { Hit } from './aonQuery'

const creature = (id: string, name: string, traits: string[], level: number, extra: Record<string, unknown> = {}): Hit => ({
  _id: id, _source: { name, trait: ['Fiend', ...traits], level, rarity: 'Common', url: `/Monsters.aspx?ID=${id}`, ...extra },
})

it('retains eligible legacy subtypes without assigning them to a subtype-less remaster', () => {
  const fiends = normalizeFiends([
    creature('1', 'Imp', ['Devil'], 1, { remaster_id: ['3'] }),
    creature('2', 'Quasit', ['Demon'], 1, { remaster_id: ['3'] }),
    creature('3', 'Imp', [], 1, { legacy_id: ['1', '2'] }),
    creature('4', 'Demon', ['Demon'], 5, { remaster_id: ['5'] }),
    creature('5', 'Demon', ['Demon'], 5),
    creature('6', 'Rare demon', ['Demon'], 1, { rarity: 'Rare' }),
    creature('7', 'Strong demon', ['Demon'], 16),
    creature('8', 'Broken', ['Demon'], 2, { url: 'https://example.com' }),
  ])
  expect(fiends.map(fiend => fiend.id)).toEqual(['5', '1', '3', '2'])
  expect(fiendOptions(fiends, 5, 'Pitborn').map(fiend => fiend.name)).toEqual(['Demon', 'Quasit'])
  expect(fiendOptions(fiends, 5, 'Hellspawn').map(fiend => fiend.id)).toEqual(['1'])
  expect(fiendOptions(fiends, 5, undefined, 'devil').map(fiend => fiend.id)).toEqual(['1'])
  expect(fiends.find(fiend => fiend.id === '3')?.traits).toEqual(['Fiend'])
  expect(fiends[0].hp).toBeUndefined()
})

it('enforces spell rank limits and refuses unknown lineages', () => {
  expect([4, 5, 6, 7, 8, 9, 10, 11].map(fiendLevelLimit)).toEqual([undefined, 5, 7, 9, 11, 13, 15, undefined])
  const fiends = normalizeFiends([creature('1', 'Weak', ['Daemon'], 5), creature('2', 'Strong', ['Daemon'], 6)])
  expect(fiendOptions(fiends, 5, 'Grimspawn').map(fiend => fiend.name)).toEqual(['Weak'])
  expect(fiendOptions(fiends, 6, 'Grimspawn')).toHaveLength(2)
  expect(fiendOptions(fiends, 6, 'Unknown')).toEqual([])
})

it('filters plant and fungus summons by rarity, remaster and spell rank', () => {
  const plant = (id: string, name: string, traits: string[], level: number, extra: Record<string, unknown> = {}): Hit => ({
    _id: id, _source: { name, trait: traits, level, rarity: 'Common', url: `/Monsters.aspx?ID=${id}`, ...extra },
  })
  const creatures = normalizePlants([
    plant('1', 'Sapling', ['Plant'], -1),
    plant('2', 'Mushroom', ['Fungus'], 5),
    plant('3', 'Rare plant', ['Plant'], 1, { rarity: 'Rare' }),
    plant('4', 'Legacy plant', ['Plant'], 1, { remaster_id: ['5'] }),
    plant('5', 'Remaster plant', ['Plant'], 1),
    plant('6', 'Animal', ['Animal'], 1),
  ])
  expect([1, 2, 3, 4, 5, 6, 9, 10, 11].map(plantLevelLimit)).toEqual([-1, 1, 2, 3, 5, 7, 13, 15, undefined])
  expect(plantOptions(creatures, 1).map(creature => creature.name)).toEqual(['Sapling'])
  expect(plantOptions(creatures, 5).map(creature => creature.name)).toEqual(['Mushroom', 'Remaster plant', 'Sapling'])
})
