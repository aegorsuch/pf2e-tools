import { expect, it } from 'vitest'
import { achievementOptions, ethnicityOptions, featAccess, featRarity } from './featAccess'
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
  expect(featAccess(character, feat)).toEqual({ requirement: 'Kellid ethnicity', automatic: true, approved: false, source: 'ethnicity' })
  expect(featAccess({ ...character, ethnicity: 'Ulfen' }, feat)?.automatic).toBe(false)
  expect(featAccess({ ...character, ethnicity: undefined, featAccessOverrides: [feat.id] }, feat)?.approved).toBe(true)
  expect(featAccess({ ...character, ethnicity: undefined, featAccessOverrides: ['other-feat'] }, feat)?.approved).toBe(false)
  expect(featAccess(character, { ...feat, traits: [], data: {} })).toBeUndefined()
  expect(featAccess(character, { ...feat, traits: ['Rare'], data: {} })).toBeUndefined()
})

it('groups shared narrative Access conditions without inventing demographic, prerequisite or rarity achievements', () => {
  const entries = [
    { ...feat, id: 'wild', name: 'Wild Hunter Dedication', data: { access: "You've trained with or defeated a member of the wild hunt." } },
    { ...feat, id: 'also-wild', name: 'Another Hunt Feat', data: { access: ' You\u2019ve trained with or defeated a member of the wild hunt. ' } },
    { ...feat, id: 'deleted', name: 'Deleted', deleted: true, data: { access: 'Defeat a dragon.' } },
    { ...feat, id: 'prerequisite', data: { prerequisite: 'Defeat a dragon.' } },
    { ...feat, id: 'rarity', data: {} },
    { ...feat, id: 'origin', data: { access: 'You are from Ustalav.' } },
    { ...feat, id: 'skill', data: { access: 'trained in Crafting' } },
    feat,
  ]
  const options = achievementOptions(entries)
  expect(options).toHaveLength(1)
  expect(options[0].feats).toEqual(['Another Hunt Feat', 'Wild Hunter Dedication'])
  expect(achievementOptions(entries)).toBe(options)
  const refreshed = achievementOptions([...entries, { ...feat, id: 'dragon', name: 'Dragon Victor', data: { access: 'Defeat a dragon.' } }])
  expect(refreshed).toHaveLength(2)
})

it('persists exact achievement access across JSON saves, but not unrelated conditions or other characters', () => {
  const wild = { ...feat, data: { access: 'You\u2019ve trained with or defeated a member of the wild hunt.' } }
  const option = achievementOptions([wild])[0]
  const saved: Character = JSON.parse(JSON.stringify({ ...character, achievements: [option.key] }))
  expect(featAccess(saved, wild)).toMatchObject({ automatic: true, approved: false, source: 'achievement' })
  expect(featAccess(saved, { ...wild, data: { access: "You've trained with or defeated a member of the wild hunt" } })?.automatic).toBe(true)
  expect(featAccess(character, wild)?.automatic).toBe(false)
  expect(featAccess({ ...saved, achievements: [] }, wild)?.automatic).toBe(false)
  expect(featAccess(saved, { ...wild, data: { access: 'Defeat a dragon.' } })?.automatic).toBe(false)
  expect(featAccess({ ...character, ethnicity: undefined, achievements: ['Kellid ethnicity'] }, feat)?.automatic).toBe(false)
})

it('groups Lastwall membership access wordings into one named achievement and preserves legacy selections', () => {
  const entries = [
    { ...feat, id: 'guardian', name: 'Devoted Guardian', data: { access: 'Knights of Lastwall have access to this feat.' } },
    { ...feat, id: 'stance', name: 'Everstand Stance', data: { access: 'A character who is a member of the Knights of Lastwall has access to this option.' } },
    { ...feat, id: 'member', name: 'Member Feat', data: { access: 'You are a member of the Knights of Lastwall.' } },
  ]
  const [option] = achievementOptions(entries)
  expect(achievementOptions(entries)).toHaveLength(1)
  expect(option.requirement).toBe('Member of the Knights of Lastwall')
  expect(option.feats).toEqual(['Devoted Guardian', 'Everstand Stance', 'Member Feat'])
  for (const value of [option.key, option.requirement, 'knights of lastwall have access to this feat']) {
    const saved: Character = JSON.parse(JSON.stringify({ ...character, achievements: [value] }))
    for (const entry of entries) expect(featAccess(saved, entry)).toMatchObject({ automatic: true, source: 'achievement' })
    expect(featAccess(saved, { ...feat, data: { access: 'Member of the Knights of Lastwall of knight rank.' } })?.automatic).toBe(false)
    expect(featAccess(saved, { ...feat, data: { access: 'You are from the Eye of Dread region.' } })?.automatic).toBe(false)
  }
  expect(featAccess(character, entries[0])?.automatic).toBe(false)
})

it.each(['Uncommon', 'Rare', 'Unique'])('shows %s rarity without inventing an Access requirement', rarity => {
  const entry = { ...feat, traits: [rarity], data: {} }
  expect(featAccess(character, entry)).toBeUndefined()
  expect(featRarity(entry)).toBe(rarity)
  const fromData = { ...entry, traits: [], data: { rarity: rarity.toLowerCase(), access: ' ' } }
  expect(featAccess(character, fromData)).toBeUndefined()
  expect(featRarity(fromData)).toBe(rarity)
  for (const access of [rarity, `${rarity} feat.`, `Rarity: ${rarity}`]) {
    expect(featAccess(character, { ...entry, data: { access } })).toBeUndefined()
  }
  expect(featAccess(character, { ...entry, data: { access: 'You must be a member of the Knights of Lastwall.' } })?.automatic).toBe(false)
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
