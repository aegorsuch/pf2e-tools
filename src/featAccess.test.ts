import { expect, it } from 'vitest'
import { ethnicityOptions, featAccess } from './featAccess'
import type { Character, ContentEntry } from './types'

const character: Character = {
  id: 'c', systems: ['pf2e'], name: 'Test', level: 1, ethnicity: 'Kellid', featAccessOverrides: [],
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const feat: ContentEntry = {
  id: 'witch-warden', name: 'Witch Warden', kind: 'feat', systems: ['pf2e'], source: 'official', level: 1,
  traits: ['Human', 'Uncommon'], data: { access: 'Kellid ethnicity' }, description: '', effects: [], updatedAt: 1,
}

it('separates ethnicity access, exact-entry approval and ordinary unrestricted feats', () => {
  expect(featAccess(character, feat)).toEqual({ requirement: 'Kellid ethnicity', automatic: true, approved: false })
  expect(featAccess({ ...character, ethnicity: 'Ulfen' }, feat)?.automatic).toBe(false)
  expect(featAccess({ ...character, ethnicity: undefined, featAccessOverrides: [feat.id] }, feat)?.approved).toBe(true)
  expect(featAccess({ ...character, ethnicity: undefined, featAccessOverrides: ['other-feat'] }, feat)?.approved).toBe(false)
  expect(featAccess(character, { ...feat, traits: [], data: {} })).toBeUndefined()
  expect(featAccess(character, { ...feat, traits: ['Rare'], data: {} })?.automatic).toBe(false)
})

it('derives ethnicity choices without interpreting nationalities or complex conditions as automatic access', () => {
  const entries = ['Varisian ethnicity or New Thassilon nationality', 'mountain dwarf ethnicity',
    'any surface dwarf ethnicity', 'Kellid ethnicity and follower of a deity'].map((access, i) => ({ ...feat, id: String(i), data: { access } }))
  const prerequisites = ['Nidalese ethnicity', 'Tian-Dan ethnicity; trained in Arcana'].map((prerequisite, i) => ({
    ...feat, id: `prerequisite:${i}`, data: { prerequisite },
  }))
  expect(ethnicityOptions([feat, ...entries, ...prerequisites])).toEqual(['Kellid', 'Mountain Dwarf', 'Nidalese', 'Tian-Dan', 'Varisian'])
  expect(featAccess({ ...character, ethnicity: 'Varisian' }, entries[0])?.automatic).toBe(true)
  expect(featAccess(character, entries[3])?.automatic).toBe(false)
})
