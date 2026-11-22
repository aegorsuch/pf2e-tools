import { expect, it } from 'vitest'
import { achievementKey, achievementOptions, ethnicityOptions, featAccess, featRarity } from './featAccess'
import { eligibleFeats, featSelectionPrerequisiteChecker } from './builder'
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

it('grants Spirit Coffin through Bakuwa heritage or Tian Xia origin independently', () => {
  const coffin: ContentEntry = { ...feat, id: 'spirit-coffin', name: 'Spirit Coffin', traits: ['Lizardfolk', 'Uncommon'],
    data: { access: 'bakuwa lizardfolk heritage  or Tian Xia origin' } }
  const bakuwa: Character = { ...character, ancestry: 'Lizardfolk', heritage: 'Bakuwa Lizardfolk', achievements: [] }
  expect(featAccess(bakuwa, coffin)).toMatchObject({ automatic: true, source: 'ancestry' })
  expect(featSelectionPrerequisiteChecker(bakuwa, [coffin], { key: 'ancestry:1:0', category: 'ancestry', level: 1 })(coffin))
    .toEqual({ missing: [], manual: [] })
  const wetlander = { ...bakuwa, heritage: 'Wetlander Lizardfolk' }
  expect(featAccess(wetlander, coffin)?.automatic).toBe(false)
  expect(featAccess({ ...wetlander, feats: [{ name: 'Bony Plates', type: 'Ancestry Feat', level: 1 }] }, coffin)?.automatic).toBe(false)
  expect(featAccess({ ...wetlander, achievements: ['Tian Xia origin'] }, coffin))
    .toMatchObject({ automatic: true, source: 'achievement' })
  const requiredBoth = { ...coffin, data: { access: 'Bakuwa Lizardfolk heritage and Tian Xia origin' } }
  expect(featAccess(bakuwa, requiredBoth)?.automatic).toBe(false)
  expect(featAccess({ ...wetlander, achievements: ['Tian Xia origin'] }, requiredBoth)?.automatic).toBe(false)
})

it('offers Old Cheliax access for Hellknight Dedication', () => {
  const hellknight: ContentEntry = { ...feat, name: 'Hellknight Dedication', level: 2, traits: ['Archetype', 'Dedication', 'Uncommon'],
    data: { archetype: 'Hellknight', access: "You're from Old Cheliax.", prerequisite: 'trained by a Hellknight Order' } }
  const [option] = achievementOptions([hellknight])
  expect(option).toEqual({ key: 'from old cheliax', requirement: 'From Old Cheliax', feats: ['Hellknight Dedication'] })
  const saved: Character = JSON.parse(JSON.stringify({ ...character, level: 2, achievements: [option.key] }))
  expect(featAccess(saved, hellknight)).toMatchObject({ automatic: true, source: 'achievement' })
  expect(featSelectionPrerequisiteChecker(saved, [hellknight], { key: 'archetype:2:0', category: 'archetype', level: 2 })(hellknight))
    .toEqual({ missing: [], manual: [] })
  expect(featAccess(saved, { ...hellknight, data: { ...hellknight.data, access: 'You’re from Old Cheliax.' } })?.automatic).toBe(true)
  expect(featAccess(character, hellknight)?.automatic).toBe(false)
  expect(featAccess(saved, { ...hellknight, data: { access: "You're from New Cheliax." } })?.automatic).toBe(false)
})

it('offers Nidalese Horselords training as the achievement for Born In The Saddle', () => {
  const source = { ...feat, name: 'Born In The Saddle', data: { access: 'You’re from Nidal.' } }
  const [option] = achievementOptions([source])
  expect(option.requirement).toBe('Trained with the Nidalese Horselords')
  const saved = { ...character, achievements: [option.key] }
  expect(featAccess(saved, source)).toMatchObject({ automatic: true, source: 'achievement' })
  expect(featAccess(character, source)?.automatic).toBe(false)
})

it('shows Alkenstar or Dongun Hold travel for achievements and feat access while preserving saved origin selections', () => {
  const source = { ...feat, name: 'Alkenstar Agent', data: { access: 'You are from Dongun Hold or Alkenstar.' } }
  const [option] = achievementOptions([source])
  expect(option).toEqual({
    key: 'from dongun hold or alkenstar',
    requirement: 'Travelled through Alkenstar or Dongun Hold',
    feats: ['Alkenstar Agent'],
  })
  expect(featAccess({ ...character, achievements: [option.key] }, source)).toMatchObject({
    automatic: true,
    source: 'achievement',
    requirement: 'Travelled through Alkenstar or Dongun Hold',
  })
  for (const saved of [option.requirement, 'From Dongun Hold or Alkenstar', 'You are from Dongun Hold or Alkenstar.']) {
    expect(featAccess({ ...character, achievements: [saved] }, source)?.automatic).toBe(true)
  }
  const updatedSource = { ...source, data: { access: option.requirement } }
  expect(achievementOptions([updatedSource])).toEqual([option])
  expect(featAccess({ ...character, achievements: [option.key] }, updatedSource)?.automatic).toBe(true)
  expect(featAccess(character, source)?.automatic).toBe(false)
})

it('offers Alkenstar, Mana Wastes, and Nixbrix achievements as alternative Black Powder access', () => {
  const entries: ContentEntry[] = ['Inured to Alchemy', 'Pain Tolerance', 'Powder Punch Stance'].map(name => ({
    ...feat, id: name, name, traits: ['Fighter', 'Uncommon'],
    data: { access: "You're from Alkenstar or the Mana Wastes.", prerequisite: 'expert in Fortitude saves' },
  }))
  const labels = ['Agree to Nixbrix\'s challenge to defeat Bitey', 'Traveled through Alkenstar', 'Traveled through the Mana Wastes']
  const options = achievementOptions(entries)
  expect(options.map(option => option.requirement)).toEqual(labels)
  for (const option of options) {
    expect(option.feats).toEqual(['Inured to Alchemy', 'Pain Tolerance', 'Powder Punch Stance'])
    const saved: Character = JSON.parse(JSON.stringify({ ...character, achievements: [option.key] }))
    for (const entry of entries) {
      expect(featAccess(saved, entry)).toMatchObject({ automatic: true, source: 'achievement',
        requirement: 'Traveled through Alkenstar or the Mana Wastes' })
      expect(featAccess(character, entry)).toMatchObject({ automatic: false, requirement: 'Traveled through Alkenstar or the Mana Wastes' })
    }
    const slot = { key: 'class:6:0', category: 'class' as const, level: 6 }
    expect(featSelectionPrerequisiteChecker({ ...saved, className: 'Fighter', level: 6 }, entries, slot)(entries[1]).missing)
      .toContain('expert in Fortitude saves')
    const fighter: ContentEntry = { ...feat, id: 'fighter', name: 'Fighter', kind: 'class',
      data: { fortitude_proficiency: 'Expert' } }
    expect(featSelectionPrerequisiteChecker({ ...saved, className: 'Fighter', level: 6 }, [...entries, fighter], slot)(entries[1]).missing)
      .toEqual([])
  }
  const fromAlkenstar = { ...character, achievements: ['From Alkenstar'] }
  expect(featAccess(fromAlkenstar, { ...feat, data: { access: 'You are from Dongun Hold or Alkenstar.' } })?.automatic).toBe(true)
  for (const saved of ['From Alkenstar', 'From Mana Wastes', 'From the Mana Wastes',
    "You're from Alkenstar or the Mana Wastes.", ...labels.slice(1)]) {
    expect(featAccess({ ...character, achievements: [saved] }, entries[0])?.automatic).toBe(true)
  }
  const updatedSource = { ...entries[0], data: { access: 'Traveled through Alkenstar or the Mana Wastes' } }
  expect(achievementOptions([updatedSource]).map(option => option.requirement)).toEqual(labels)
  expect(featAccess(fromAlkenstar, updatedSource)).toMatchObject({ automatic: true,
    requirement: 'Traveled through Alkenstar or the Mana Wastes' })
  expect(featAccess({ ...character, achievements: [labels[1]] },
    { ...feat, data: { access: 'You are from Dongun Hold or Alkenstar.' } })?.automatic).toBe(true)
  expect(featAccess({ ...character, achievements: ['From Dongun Hold or Alkenstar'] }, entries[0])?.automatic).toBe(false)
  expect(featAccess({ ...character, achievements: [labels[0]] }, { ...entries[0], name: 'Unrelated Feat' })?.automatic).toBe(false)
  expect(featAccess({ ...character, achievements: [labels[0]] }, { ...entries[0], source: 'homebrew' })?.automatic).toBe(false)
})

it('shows Rivethun membership while automatically accepting its background and retaining old checked wording', () => {
  const access = 'Rivethun Adherent background or you are a member of the Rivethun'
  const source = { ...feat, data: { access } }
  expect(achievementOptions([source])[0].requirement).toBe('Trained with the Rivethun')
  expect(featAccess({ ...character, background: 'Rivethun Adherent' }, source)).toMatchObject({ automatic: true, source: 'background' })
  expect(featAccess({ ...character, achievements: [access] }, source)?.automatic).toBe(true)
  expect(featAccess({ ...character, achievements: ['Member of the Rivethun'] }, source)?.automatic).toBe(true)
  expect(featAccess(character, source)?.automatic).toBe(false)
})

it('shows only defender training as an achievement and accepts actual Dwarf ancestry automatically', () => {
  const access = 'You are a dwarf or have undergone defender training in a dwarven settlement such as Highhelm.'
  const source = { ...feat, data: { access } }
  const [option] = achievementOptions([source])
  expect(option.requirement).toBe('Undergone defender training in a dwarven settlement such as Highhelm')
  expect(featAccess({ ...character, ancestry: 'Dwarf' }, source)).toMatchObject({ automatic: true, source: 'ancestry' })
  expect(featAccess({ ...character, ancestry: 'Human', achievements: [option.key] }, source)?.automatic).toBe(true)
  expect(featAccess({ ...character, ancestry: 'Human', achievements: [access] }, source)?.automatic).toBe(true)
  expect(featAccess({ ...character, ancestry: 'Human' }, source)?.automatic).toBe(false)
})

it('capitalizes membership labels and shares equipment membership with feat achievements', () => {
  const armor: ContentEntry = { ...feat, kind: 'armor', data: { access: 'a character who is a member of the Hellknights has access to this armor.' } }
  const [option] = achievementOptions([armor])
  expect(option.requirement).toBe('Trained with the Hellknights')
  expect(featAccess({ ...character, achievements: [option.key] }, armor)?.automatic).toBe(true)
  expect(featAccess({ ...character, achievements: [option.requirement] }, armor)).toMatchObject({
    requirement: 'Trained with the Hellknights', automatic: true,
  })
})
it('shares Tian elementalism access with Intensified Element Stance without bypassing Medicine training', () => {
  const legacy = 'Tian Xia origin or exposure to Tian elementalism'
  const label = 'Trained in Tian Xia elementalism'
  const intensified: ContentEntry = { ...feat, name: 'Intensified Element Stance', level: 6, traits: ['Ranger'],
    data: { access: 'Tian Xia origin', prerequisite: 'Trained in Medicine' } }
  const dedication = { ...feat, id: 'vanguard', name: 'Five-breath Vanguard Dedication', data: { access: legacy } }
  expect(achievementOptions([intensified, dedication])).toEqual([{
    key: legacy.toLowerCase(), requirement: label, feats: ['Five-breath Vanguard Dedication', 'Intensified Element Stance'],
  }])
  const c: Character = { ...character, className: 'Ranger', level: 6, achievements: [label], skillPicks: ['Medicine'] }
  const slot = { key: 'class:6:0', category: 'class' as const, level: 6 }
  expect(featAccess(c, intensified)).toMatchObject({ requirement: label, automatic: true, source: 'achievement' })
  expect(featAccess(c, dedication)).toMatchObject({ requirement: label, automatic: true, source: 'achievement' })
  for (const previous of [legacy, 'Tian Xia origin or exposure to Tian Xia elementalism']) {
    expect(featAccess({ ...c, achievements: [previous] }, dedication))
      .toMatchObject({ requirement: label, automatic: true, source: 'achievement' })
  }
  expect(achievementOptions([{ ...dedication, data: { access: label } }])[0])
    .toMatchObject({ key: legacy.toLowerCase(), requirement: label })
  expect(featAccess({ ...c, achievements: ['Tian Xia origin'] }, intensified)?.automatic).toBe(true)
  expect(eligibleFeats([intensified], c, slot)).toContain(intensified)
  expect(eligibleFeats([intensified], { ...c, skillPicks: [] }, slot)).not.toContain(intensified)
  expect(featAccess({ ...c, achievements: [] }, intensified)?.automatic).toBe(false)
})

it('uses Tian Xia origin or familiarity with Sun Wukong for Wukong Extension', () => {
  const label = 'Tian Xia origin or familiar with Sun Wukong'
  const extension = { ...feat, name: 'Wukong Extension', data: { access: 'Old imported Access condition' } }
  expect(achievementOptions([extension])).toEqual([{
    key: label.toLowerCase(), requirement: label, feats: ['Wukong Extension'],
  }])
  expect(featAccess({ ...character, achievements: [label] }, extension))
    .toMatchObject({ requirement: label, automatic: true, source: 'achievement' })
  expect(featAccess(character, extension)).toMatchObject({ requirement: label, automatic: false })
})

it('shares Nidalese Horselords training across both steeds and Born In The Saddle while preserving saved access', () => {
  const label = 'Trained with the Nidalese Horselords'
  const steeds: ContentEntry[] = ['Chiardmar Steed', 'Nidarrmar Steed'].map(name => ({
    ...feat, id: name, name, level: 6, traits: ['Ranger'], data: { access: 'You’re from Nidal.', prerequisite: 'horse animal companion' },
  }))
  const saddle = { ...feat, name: 'Born In The Saddle', data: { access: 'You’re from Nidal.' } }
  expect(achievementOptions([...steeds, saddle])).toEqual([{
    key: achievementKey(label), requirement: label, feats: ['Born In The Saddle', 'Chiardmar Steed', 'Nidarrmar Steed'],
  }])
  const c: Character = { ...character, className: 'Ranger', level: 6, achievements: [label] }
  const slot = { key: 'class:6:0', category: 'class' as const, level: 6 }
  for (const steed of steeds) {
    expect(featAccess(c, steed)).toMatchObject({ automatic: true, source: 'achievement' })
    expect(featAccess(c, { ...steed, data: { ...steed.data, access: 'You\ufffdre from Nidal.' } }))
      .toMatchObject({ requirement: label, automatic: true })
    expect(featAccess({ ...c, achievements: [] }, steed)?.automatic).toBe(false)
  }
  for (const saved of ['Nidal origin or exposure to Nidalese husbandry', 'Trained with Nidalese Horselords',
    'member of the nidalese horselords', label]) {
    for (const source of [...steeds, saddle])
      expect(featAccess({ ...c, achievements: [saved] }, source))
        .toMatchObject({ requirement: label, automatic: true, source: 'achievement' })
  }
  expect(eligibleFeats(steeds, c, slot)).toEqual([])
  expect(eligibleFeats(steeds, { ...c, companions: [{ id: 'wolf', type: 'Wolf', name: 'Wolf' }] }, slot)).toEqual([])
  expect(eligibleFeats(steeds, { ...c, companions: [{ id: 'horse', type: 'Horse', name: 'Horse' }] }, slot)).toEqual(steeds)
  expect(featAccess(c, { ...steeds[0], name: 'Unrelated Nidal Feat' })?.automatic).toBe(false)
})

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
  expect(option.requirement).toBe('Trained with the Knights of Lastwall')
  expect(option.feats).toEqual(['Devoted Guardian', 'Everstand Stance', 'Member Feat'])
  for (const value of [option.key, option.requirement, 'Trained with Knights of Lastwall', 'Member of the Knights of Lastwall',
    'Member of or trained by Knights of Lastwall', 'knights of lastwall have access to this feat']) {
    const saved: Character = JSON.parse(JSON.stringify({ ...character, achievements: [value] }))
    for (const entry of entries) expect(featAccess(saved, entry)).toMatchObject({
      requirement: 'Trained with the Knights of Lastwall', automatic: true, source: 'achievement',
    })
    expect(featAccess(saved, { ...feat, data: { access: 'Member of the Knights of Lastwall of knight rank.' } })?.automatic).toBe(false)
    expect(featAccess(saved, { ...feat, data: { access: 'You are from the Eye of Dread region.' } })?.automatic).toBe(false)
  }
  expect(featAccess(character, entries[0])).toMatchObject({
    requirement: 'Trained with the Knights of Lastwall', automatic: false,
  })
})

it.each([
  ['A character who is a member of the Pathfinder Society has access to this option.', 'Trained with the Pathfinder Society'],
  ['You are a member of the Eyeswide.', 'Trained with the Eyeswide'],
  ["You've trained with or defeated a member of the wild hunt.", 'Trained with or defeated a member of the wild hunt'],
  ['You\u2019ve trained with a member of the wild hunt.', 'Trained with a member of the wild hunt'],
  ['You have trained with a member of the wild hunt.', 'Trained with a member of the wild hunt'],
])('shortens achievement wording without changing saved access conditions: %s', (access, label) => {
  const entry = { ...feat, data: { access } }
  const [option] = achievementOptions([entry])
  expect(option.requirement).toBe(label)
  const saved: Character = JSON.parse(JSON.stringify({ ...character, achievements: [option.key] }))
  expect(featAccess(saved, entry)).toMatchObject({ automatic: true, source: 'achievement' })
  expect(featAccess({ ...character, achievements: [access] }, entry)).toMatchObject({ automatic: true, source: 'achievement' })
  expect(featAccess({ ...character, achievements: [label] }, entry)).toMatchObject({ automatic: true, source: 'achievement' })
  expect(featAccess(character, entry)?.automatic).toBe(false)
})

it('groups equivalent membership labels without dropping rank requirements', () => {
  const entries = [
    { ...feat, id: 'society', name: 'Society Feat', data: { access: 'Member of the Pathfinder Society.' } },
    { ...feat, id: 'society-alt', name: 'Other Society Feat', data: { access: 'A character who is a member of the Pathfinder Society has access to this option.' } },
    { ...feat, id: 'society-rank', name: 'Ranked Society Feat', data: { access: 'Member of the Pathfinder Society at the rank of second mark or higher.' } },
  ]
  const options = achievementOptions(entries)
  expect(options).toHaveLength(2)
  const member = options.find(option => option.requirement === 'Trained with the Pathfinder Society')
  expect(member?.feats).toEqual(['Other Society Feat', 'Society Feat'])
  for (const value of [member!.key, member!.requirement, 'Member of the Pathfinder Society.',
    'Member of or trained by the Pathfinder Society']) {
    const saved: Character = JSON.parse(JSON.stringify({ ...character, achievements: [value] }))
    expect(featAccess(saved, entries[1])).toMatchObject({
      requirement: 'Trained with the Pathfinder Society', automatic: true, source: 'achievement',
    })
    expect(featAccess(saved, entries[2])?.automatic).toBe(false)
  }
  expect(featAccess(character, entries[0])).toMatchObject({
    requirement: 'Trained with the Pathfinder Society', automatic: false,
  })
})

it('offers Shackles travel as shared access while preserving legacy selections and actual prerequisites', () => {
  const label = 'Traveled through the Shackles'
  const entries: ContentEntry[] = ['Cheaters Always Prosper', 'Cannonball Fall', 'Rock the Boat'].map(name => ({
    ...feat, id: name, name, level: 8, traits: ['Fighter'],
    data: { access: "You're from the Shackles", prerequisite: 'trained in Acrobatics' },
  }))
  const [option] = achievementOptions(entries)
  expect(achievementOptions(entries)).toEqual([{
    key: label.toLowerCase(), requirement: label, feats: entries.map(entry => entry.name).sort(),
  }])
  for (const value of [option.key, label, `${label}.`, "You're from the Shackles", 'From the Shackles']) {
    const saved: Character = JSON.parse(JSON.stringify({ ...character, level: 8, achievements: [value] }))
    for (const entry of entries) expect(featAccess(saved, entry)).toMatchObject({
      requirement: label, automatic: true, source: 'achievement',
    })
    const slot = { key: 'class:8:0', category: 'class' as const, level: 8 }
    expect(featSelectionPrerequisiteChecker(saved, entries, slot)(entries[0]))
      .toEqual({ missing: ['trained in Acrobatics'], manual: [] })
    expect(featSelectionPrerequisiteChecker({ ...saved, skillPicks: ['Acrobatics'] }, entries, slot)(entries[0]))
      .toEqual({ missing: [], manual: [] })
    expect(featAccess(saved, { ...entries[0], data: { access: "You're from Ustalav." } })?.automatic).toBe(false)
  }
  expect(featAccess(character, entries[0])).toMatchObject({ requirement: label, automatic: false })
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
  expect(ethnicityOptions([feat, ...entries, ...prerequisites])).toEqual(['Ergaksen (Surface)', 'Holtaksen (Mountain)', 'Kellid', 'Nidalese', 'Tian-Dan', 'Varisian'])
  expect(featAccess({ ...character, ethnicity: 'Varisian' }, entries[0])?.automatic).toBe(true)
  expect(featAccess(character, entries[3])?.automatic).toBe(false)
})

it('offers only ethnicities associated with the selected ancestry', () => {
  const entries: ContentEntry[] = [
    { ...feat, id: 'human', traits: ['Human'], data: { access: 'Kellid ethnicity' } },
    { ...feat, id: 'dwarf', traits: ['Dwarf'], data: { access: 'mountain dwarf ethnicity' } },
    { ...feat, id: 'elf', traits: ['Elf'], data: { prerequisite: 'Mualijae ethnicity, Ilverani ethnicity, or Vourinoi ethnicity' } },
    { ...feat, id: 'orc', traits: ['Orc'], data: { access: 'Matanji ethnicity' } },
    { ...feat, id: 'halfling', traits: ['Halfling'], data: { access: 'Jaric ethnicity' } },
    { ...feat, id: 'deleted', deleted: true, traits: ['Human'], data: { access: 'Old ethnicity' } },
  ]
  expect(ethnicityOptions(entries, 'Human')).toEqual([
    'Chelaxian', 'Erutaki', 'Garundi', 'Keleshite', 'Kellid', 'Lirgeni', 'Mauxi', 'Nidalese', 'Shoanti', 'Taldan', 'Tian-Dan', 'Tian-Yae', 'Ulfen', 'Varisian', 'Vudrani',
  ])
  expect(ethnicityOptions(entries, 'dwarf')).toEqual(['Ergaksen (Surface)', 'Grondaksen (Underground)', 'Holtaksen (Mountain)'])
  expect(ethnicityOptions(entries, 'Elf')).toEqual(['Ekujae', 'Ilverani', 'Mualijae', 'Spiresworn', 'Vourinoi'])
  expect(ethnicityOptions(entries, 'Orc')).toEqual(['Belkzen', 'Matanji'])
  expect(ethnicityOptions(entries, 'Halfling')).toEqual(['Isgeri', 'Jaric (Mountain)', 'Mihrini', "Song'o (Jungle)", 'Uhlam (Forest)'])
  expect(ethnicityOptions(entries, 'Android')).toEqual([])
})

it('offers the listed Human ethnicities without catalog data and deduplicates catalog matches', () => {
  const listed = ethnicityOptions([], 'Human')
  expect(listed).toEqual(['Chelaxian', 'Erutaki', 'Garundi', 'Keleshite', 'Lirgeni', 'Mauxi', 'Nidalese', 'Shoanti', 'Taldan', 'Tian-Dan', 'Tian-Yae', 'Ulfen', 'Varisian', 'Vudrani'])
  const duplicate = { ...feat, traits: ['Human'], data: { access: 'varisian ethnicity' } }
  expect(ethnicityOptions([duplicate], 'Human')).toEqual(listed)
})

it.each([
  ['Grondaksen (Underground)', 'Grondaksen', 'underground dwarf'],
  ['Holtaksen (Mountain)', 'Holtaksen', 'mountain dwarf'],
  ['Ergaksen (Surface)', 'Ergaksen', 'surface dwarf'],
])('matches %s to existing ethnicity access without changing saved values', (label, name, legacy) => {
  expect(ethnicityOptions([], 'Dwarf')).toContain(label)
  const access = { ...feat, traits: ['Dwarf'], data: { access: `${legacy} ethnicity` } }
  for (const ethnicity of [label, name, legacy, label.toLowerCase()]) {
    const c = { ...character, ancestry: 'Dwarf', ethnicity }
    expect(featAccess(c, access)).toMatchObject({ automatic: true, source: 'ethnicity' })
    expect(c.ethnicity).toBe(ethnicity)
  }
  const other = ethnicityOptions([], 'Dwarf').find(option => option !== label)!
  expect(featAccess({ ...character, ethnicity: other }, access)?.automatic).toBe(false)
  if (name === 'Ergaksen') {
    expect(featAccess({ ...character, ethnicity: label }, { ...access, data: { access: 'any surface dwarf ethnicity' } })?.automatic).toBe(true)
  }
})

it('uses generic names for dwarven feats taken through Adopted Ancestry (Dwarf)', async () => {
  const { adoptedAncestryText } = await import('./featChoices')
  const adopted = { ...character, ancestry: 'Human', feats: [{ name: 'Adopted Ancestry', type: 'Ancestry Feat', level: 1, choice: 'Dwarf' }] }
  expect(adoptedAncestryText(adopted, 'Dwarven Doughtiness')).toBe('Doughtiness')
  expect(adoptedAncestryText(adopted, 'Dwarven Zero-G Familiarity')).toBe('Zero-G Familiarity')
  expect(adoptedAncestryText(adopted, 'Dwarven Weapon Familiarity')).toBe('Dwarven Weapon Familiarity')
  expect(adoptedAncestryText(adopted, 'Dwarven Lore')).toBe('Dwarven Lore')
  expect(adoptedAncestryText({ ...adopted, ancestry: 'Dwarf' }, 'Dwarven Doughtiness')).toBe('Dwarven Doughtiness')
})
