import { expect, it } from 'vitest'
import { FOLLOWER_TYPES, followerStats } from './followers'
import type { Character } from './types'

const base: Character = { id: 'captain', name: 'Test', systems: ['pf2e'], level: 4,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
  equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }

it('calculates Sharpshooter statistics at each advancement', () => {
  const cases = [
    { level: 4, feats: [], dex: 3, hp: 32, ac: 20, saves: [7, 9, 8], attack: 9, damage: '1d6 piercing' },
    { level: 4, feats: ['Experienced Follower'], dex: 4, hp: 32, ac: 21, saves: [9, 12, 9], attack: 10, damage: '2d6 piercing' },
    { level: 8, feats: ['Veteran Follower'], dex: 4, hp: 68, ac: 26, saves: [14, 16, 13], attack: 17, damage: '2d6+2 piercing' },
    { level: 14, feats: ['Exceptional Follower'], dex: 5, hp: 130, ac: 33, saves: [22, 26, 25], attack: 25, damage: '3d6+4 piercing' },
  ]
  for (const test of cases) {
    const c = { ...base, level: test.level, feats: test.feats.map(name => ({ name, type: 'Archetype Feat', level: test.level })) }
    const stats = followerStats(c, 'Sharpshooter')!
    expect(stats.attributes.dex).toBe(test.dex)
    expect(stats.hp).toBe(test.hp)
    expect(stats.ac).toBe(test.ac)
    expect(stats.saves).toEqual(test.saves)
    expect(stats.attacks[0]).toMatchObject({ bonus: test.attack, damage: test.damage })
  }
})

it('calculates all published follower types and applies chosen adept skill', () => {
  for (const type of FOLLOWER_TYPES) expect(followerStats(base, type)).toBeDefined()
  const veteran = { ...base, level: 8, feats: [{ name: 'Veteran Follower', type: 'Archetype Feat', level: 8 }] }
  expect(followerStats(veteran, 'Adept', 'Occultism')!.skills).toEqual(expect.arrayContaining([
    { name: 'Occultism', value: 16 }, { name: 'Nature', value: 13 },
  ]))
  expect(followerStats(base, 'Unknown')).toBeUndefined()
})
