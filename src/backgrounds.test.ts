import { expect, it } from 'vitest'
import { mapAonHits } from './aon'
import { backgroundLoreCount, characterDeityLores, deityLoreBackgroundEntries, PROFESSION_LORES } from './backgrounds'
import { backgroundLoreIncreaseSlots, backgroundLoreSlots, backgroundSkills, backgroundSkillSlots, backgroundVariants, boostSlots, featChoiceOptions, plannedSlots, ranksAt, skillRankBudget, skillTokenPurchase } from './builder'
import { getSettings, updateSettings } from './settings'
import type { Character, ContentEntry } from './types'

const compile = (name: string, markdown: string, skill: string[] = [], feat: string[] = []) => mapAonHits([{
  _id: `background-${name}`, _source: { name, category: 'background', markdown, skill, feat },
}], 'pf2e')
const skill = (name: string) => `[${name}](/Skills.aspx?ID=1)`
const feat = (name: string) => `[${name}](/Feats.aspx?ID=1)`
const base: Character = {
  id: 'background-test', name: 'Test', systems: ['pf2e'], level: 1,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], lores: [], equipment: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('offers only Street Urchin city variants while preserving skills, boosts, feat, and legacy choices', () => {
  const entries = mapAonHits([{ _id: 'street-urchin', _source: {
    name: 'Street Urchin', category: 'background', attribute: ['Dexterity', 'Constitution'], feat: ['Pickpocket'],
    skill: ['Thievery', 'Lore for the city you lived in as a street urchin (such as Absalom Lore or Magnimar Lore).'],
    markdown: `You're trained in the ${skill('Thievery')} skill, and a ${skill('Lore')} skill for the city you lived in as a street urchin (such as Absalom Lore or Magnimar Lore). You gain the ${feat('Pickpocket')} skill feat.`,
  } }], 'pf2e')
  const options = backgroundVariants(entries, ['Cooking Lore', 'Iomedae Lore'])
  expect(options.map(option => option.value)).toEqual([
    'Street Urchin (Absalom)', 'Street Urchin (Katapesh)', 'Street Urchin (Magnimar)',
  ])
  for (const city of ['Absalom', 'Katapesh', 'Magnimar']) {
    const background = options.find(option => option.value === `Street Urchin (${city})`)!.background
    const saved: Character = JSON.parse(JSON.stringify({ ...base, background: background.name }))
    expect(ranksAt(saved, entries)).toMatchObject({ Thievery: 1, [`${city} Lore`]: 1 })
    expect(ranksAt({ ...saved, level: 20 }, entries)[`${city} Lore`]).toBe(1)
    expect(backgroundLoreSlots(saved, entries)).toEqual([])
    expect(background.data.feat).toBe('Pickpocket')
    expect(boostSlots(saved, entries).find(slot => slot.key === 'background:0')?.options).toEqual(['dex', 'con'])
  }
  const legacy: Character = { ...base, background: 'Street Urchin', backgroundLores: { 'Street Urchin': ['Old City Lore'] } }
  expect(ranksAt(legacy, entries)).toMatchObject({ Thievery: 1, 'Old City Lore': 1 })
})

it('offers only professional Lore variants for Grifter and preserves chosen training', () => {
  const entries = compile('Grifter', `You're trained in ${skill('Deception')} and a ${skill('Lore')} skill related to a profession or subject you fake expertise in.
You gain the ${feat('Charming Liar')} skill feat.`, ['Deception', 'Lore related to a profession or subject you fake expertise in'], ['Charming Liar'])
  const variants = backgroundVariants(entries, ['Abadar Lore', 'Zon-Shelyn Lore', 'Forest Lore', 'Accounting Lore'])
  expect(variants.filter(option => option.lore).map(option => option.lore)).toEqual(PROFESSION_LORES)
  expect(variants.at(-1)).toMatchObject({ value: 'Grifter (Custom Profession Lore)', custom: true })
  expect(variants.some(option => /Abadar|Zon-Shelyn|Forest/.test(option.value))).toBe(false)
  const selected = variants.find(option => option.lore === 'Accounting Lore')!
  const c: Character = { ...base, background: selected.background.name, backgroundLores: { Grifter: [selected.lore!] } }
  expect(ranksAt(c, entries)).toMatchObject({ Deception: 1, 'Accounting Lore': 1 })
  expect(entries[0].data.feat).toBe('Charming Liar')
})

it('shares selected deities across characters without duplicates or deleted characters', () => {
  const characters: Character[] = [
    { ...base, deity: '  Zon-Shelyn ' }, { ...base, deity: 'zon-shelyn' }, { ...base, deity: 'Abadar' },
    { ...base, deity: 'Deleted deity', deleted: true }, { ...base, deity: '  ' },
    { ...base, background: 'Acolyte (Sarenrae Lore)' },
    { ...base, feats: [{ name: 'Free Heart', type: 'Ancestry Feat', level: 1, choice: 'Acolyte (Meyel Lore)' }] },
  ]
  expect(characterDeityLores(characters)).toEqual(['Abadar Lore', 'Meyel Lore', 'Sarenrae Lore', 'Zon-Shelyn Lore'])
})

it('adds saved deity Lore variants to Acolyte while preserving its default and other backgrounds', () => {
  const catalog = compile('Acolyte', `You're trained in ${skill('Religion')} and ${skill('Scribing Lore')}.
You gain the ${feat('Student of the Canon')} skill feat.`, ['Religion', 'Scribing Lore'], ['Student of the Canon'])
  const entries = deityLoreBackgroundEntries(catalog, characterDeityLores([{ ...base, deity: 'Zon-Shelyn' }]))
  expect(backgroundVariants(entries, ['Cooking Lore']).map(option => option.value))
    .toEqual(['Acolyte', 'Acolyte (Zon-Shelyn Lore)'])
  expect(backgroundSkills(entries[0])).toEqual(['Religion', 'Scribing Lore'])
  const saved: Character = JSON.parse(JSON.stringify({ ...base, background: 'Acolyte (Zon-Shelyn Lore)' }))
  const restored = deityLoreBackgroundEntries(catalog, characterDeityLores([saved]))
  expect(ranksAt(saved, restored)).toMatchObject({ Religion: 1, 'Zon-Shelyn Lore': 1 })
  expect(ranksAt(saved, restored)['Scribing Lore'] ?? 0).toBe(0)
  expect(restored.find(entry => entry.name === saved.background)?.data.feat).toBe('Student of the Canon')
  expect(restored.find(entry => entry.name === saved.background)?.description).toContain('Zon-Shelyn Lore')
  expect(restored.find(entry => entry.name === saved.background)?.description).not.toContain('Scribing Lore')
  expect(ranksAt({ ...saved, background: undefined }, restored).Religion ?? 0).toBe(0)
  const sf = catalog.map<ContentEntry>(entry => ({ ...entry, systems: ['sf2e'] }))
  expect(deityLoreBackgroundEntries(sf, ['Zon-Shelyn Lore'])).toEqual(sf)
})

it('lists only deity variants for Disciple, including Zon-Shelyn, with matching grants and boosts', () => {
  const entries = mapAonHits([
    { _id: 'disciple', _source: { name: 'Disciple', category: 'background', markdown:
      `You're trained in a skill listed in your deity's divine skill entry and one Lore skill related to your deity. You gain the ${feat('Religious Talisman')} skill feat.` } },
    { _id: 'abadar', _source: { name: 'Abadar', category: 'deity', skill: ['Society'], attribute: ['Constitution', 'Intelligence'] } },
    { _id: 'zon-shelyn', _source: { name: 'Zon-Shelyn', category: 'deity', skill: ['Crafting'], attribute: ['Constitution', 'Charisma'] } },
    { _id: 'atheism', _source: { name: 'Atheism', category: 'deity' } },
  ], 'sf2e')
  const backgrounds = entries.filter(entry => entry.kind === 'background')
  expect(backgroundVariants(backgrounds, ['Cooking Lore']).map(option => option.value))
    .toEqual(['Disciple (Abadar)', 'Disciple (Zon-Shelyn)'])
  const c: Character = { ...base, systems: ['sf2e'], background: 'Disciple (Abadar)' }
  expect(ranksAt(c, entries)).toMatchObject({ Society: 1, 'Abadar Lore': 1 })
  expect(backgroundLoreCount(backgrounds.find(entry => entry.name === c.background))).toBe(0)
  expect(backgrounds.find(entry => entry.name === c.background)?.data.feat).toBe('Religious Talisman')
  expect(boostSlots(c, entries).find(slot => slot.key === 'background:0')?.options).toEqual(['con', 'int'])
  const zon: Character = { ...c, background: 'Disciple (Zon-Shelyn)' }
  expect(boostSlots(zon, entries).find(slot => slot.key === 'background:0')?.options).toEqual(['con', 'cha'])
  expect(backgroundSkillSlots(zon, entries)).toMatchObject([{ options: ['Crafting', 'Intimidation'], value: '' }])
  for (const choice of ['Crafting', 'Intimidation', 'Society']) {
    const saved: Character = JSON.parse(JSON.stringify({ ...zon, backgroundSkillChoices: { [zon.background!]: choice } }))
    const ranks = ranksAt(saved, entries)
    expect(ranks['Zon-Shelyn Lore']).toBe(1)
    expect(ranks.Crafting ?? 0).toBe(Number(choice === 'Crafting'))
    expect(ranks.Intimidation ?? 0).toBe(Number(choice === 'Intimidation'))
    expect(ranks.Society ?? 0).toBe(0)
    expect(ranksAt({ ...saved, background: undefined }, entries)[choice] ?? 0).toBe(0)
  }
})

it('gives Martial Disciple exactly two variants with the matching skill feat', () => {
  const entries = compile('Martial Disciple', `You're trained in your choice of ${skill('Acrobatics')} or ${skill('Athletics')},
and ${skill('Warfare Lore')}. You gain ${feat('Cat Fall')} if you chose Acrobatics or ${feat('Quick Jump')} if you chose Athletics.`,
  ['Acrobatics', 'Athletics', 'Warfare Lore'])
  expect(backgroundVariants(entries).map(option => option.value)).toEqual([
    'Martial Disciple (Acrobatics)', 'Martial Disciple (Athletics)',
  ])
  for (const [chosen, other, granted] of [['Acrobatics', 'Athletics', 'Cat Fall'], ['Athletics', 'Acrobatics', 'Quick Jump']]) {
    const entry = entries.find(entry => entry.name === `Martial Disciple (${chosen})`)!
    expect(entry.data.feat).toBe(granted)
    const ranks = ranksAt({ ...base, background: entry.name }, entries)
    expect(ranks[chosen]).toBe(1)
    expect(ranks['Warfare Lore']).toBe(1)
    expect(ranks[other] ?? 0).toBe(0)
  }
  expect(backgroundSkills(entries[0])).toEqual(['Warfare Lore'])
})

it('restricts Scholar Assurance to the selected Scholar variant', () => {
  const entries = compile('Scholar', `You're trained in ${skill('Arcana')}, ${skill('Nature')}, ${skill('Occultism')}, or ${skill('Religion')},
and ${skill('Academia Lore')}. You gain the ${feat('Assurance')} skill feat.`,
  ['Arcana', 'Nature', 'Occultism', 'Religion', 'Academia Lore'], ['Assurance'])
  const c = { ...base, background: 'Scholar (Nature)' }
  const slot = plannedSlots(c, entries).find(slot => slot.grantedFeat === 'Assurance')!
  expect(slot.grantedBy).toBe(c.background)
  expect(featChoiceOptions('Assurance', c, entries, slot.key)).toEqual(['Nature'])
  expect(backgroundVariants(entries)).toHaveLength(4)
})

it('keeps independent Lore choices and conditional feat choices paired', () => {
  const entries = compile('Conservator', `You're trained in either the ${skill('Crafting')} skill or the ${skill('Thievery')} skill,
and you're trained in either the ${skill('Accounting Lore')} or the ${skill('Underworld Lore')} skill.
If you selected Crafting, you gain the ${feat('Quick Repair')} skill feat.
If you chose Thievery, you gain the ${feat('Assurance (Thievery)')} skill feat.`)
  const variants = backgroundVariants(entries)
  expect(variants).toHaveLength(4)
  for (const { background } of variants) {
    expect(backgroundSkills(background)).toHaveLength(2)
    expect(background.data.feat).toBe(background.name.includes('(Crafting,') ? 'Quick Repair' : 'Assurance')
    if (background.data.feat === 'Assurance') expect(background.data.background_choice_Assurance).toBe('Thievery')
  }
})

it.each([
  ['Driving Lore or Piloting Lore', ['Driving Lore', 'Piloting Lore']],
  ['Augmentation or Life Science Lore Lore', ['Augmentation Lore', 'Life Science Lore']],
  ['Darklands, Desert, or Jungle Lore', ['Darklands Lore', 'Desert Lore', 'Jungle Lore']],
])('splits shared Lore suffixes and malformed indexed alternatives: %s', (label, choices) => {
  const entries = compile('Driver', `You're trained in ${skill('Acrobatics')} and the ${skill(label)} skill.
You gain the ${feat('Assurance')} skill feat with the chosen lore.`, ['Acrobatics', label], ['Assurance'])
  const variants = backgroundVariants(entries)
  expect(variants.map(variant => variant.background.data.background_choice_Assurance)).toEqual(choices)
  for (const { background } of variants) expect(backgroundSkills(background)).toEqual([
    'Acrobatics', background.data.background_choice_Assurance,
  ])
})

it('includes an unlinked Lore alternative without granting both', () => {
  const entries = compile('Driver', `You're trained in ${skill('Acrobatics')} and the ${skill('Driving Lore Lore')} skill or Piloting Lore.
You gain the ${feat('Assurance')} skill feat with the chosen lore.`,
  ['Acrobatics', 'Driving Lore Lore or Piloting Lore'])
  expect(backgroundVariants(entries).map(option => option.value)).toEqual(['Driver (Driving Lore)', 'Driver (Piloting Lore)'])
  expect(entries[1].data.feat).toBe('Assurance')
})

it('keeps named lineage packages separate and recovers unlinked fixed Lore', () => {
  const entries = compile('Brevic Noble', `Choose one lineage.

**Garess**: You're trained in ${skill('Crafting')} and the Architecture Lore skill. You gain the ${feat('Specialty Crafting')} skill feat.

**Lebeda**: You're trained in ${skill('Society')} and the Mercantile Lore skill. You gain the ${feat('Multilingual')} skill feat.`)
  expect(backgroundSkills(entries[0])).toEqual([])
  expect(backgroundVariants(entries).map(option => [option.value, option.background.data.skill, option.background.data.feat])).toEqual([
    ['Brevic Noble (Garess)', 'Crafting, Architecture Lore', 'Specialty Crafting'],
    ['Brevic Noble (Lebeda)', 'Society, Mercantile Lore', 'Multilingual'],
  ])
})

it('does not turn illustrative Lore examples into exhaustive choices', () => {
  const entries = compile('Animal Wrangler', `You're trained in ${skill('Athletics')} or ${skill('Nature')},
and a ${skill('Lore')} skill related to an animal (such as ${skill('Equine Lore')} or ${skill('Feline Lore')}).
You gain ${feat('Titan Wrestler')} if you chose Athletics or ${feat('Train Animal')} if you chose Nature.`,
  ['Athletics', 'Nature', 'Lore related to an animal (such as Equine Lore or Feline Lore)'])
  expect(backgroundVariants(entries).map(option => option.value)).toEqual(['Animal Wrangler (Athletics)', 'Animal Wrangler (Nature)'])
  expect(backgroundLoreCount(entries[1])).toBe(1)
  expect(backgroundSkills(entries[1])).toEqual(['Athletics'])
})

it.each(['Scout', 'Nomad'])('uses Scout-style terrain variants for %s and keeps saved choices', name => {
  const entries = compile(name, `You're trained in ${skill('Survival')} and a ${skill('Lore')} skill related to one terrain.`,
    ['Survival', 'Lore related to one terrain'])
  const variant = backgroundVariants(entries).find(option => option.value === `${name} (Forest Lore)`)!
  expect(variant.terrain).toBe('Forest')
  const c = { ...base, background: name, backgroundTerrainLore: { [name]: variant.terrain! } }
  expect(backgroundSkills(entries[0], JSON.parse(JSON.stringify(c)))).toEqual(['Survival', 'Forest Lore'])
  expect(backgroundLoreSlots(c, entries)).toEqual([])
})

it('offers named and custom open Lore variants without spending unrestricted skill training', () => {
  const entries = compile('Cultist', `You're trained in ${skill('Occultism')} and a ${skill('Lore')} skill related to your deity or cult.`,
    ['Occultism', 'Lore related to your deity or cult.'])
  const variants = backgroundVariants(entries, ['Abadar Lore', 'Iomedae Lore'])
  expect(variants.map(option => option.value)).toEqual([
    'Cultist (Abadar Lore)', 'Cultist (Iomedae Lore)', 'Cultist (Custom Lore)',
  ])
  const c = { ...base, background: 'Cultist', backgroundLores: { Cultist: ['Iomedae Lore'] } }
  expect(backgroundSkills(entries[0], JSON.parse(JSON.stringify(c)))).toEqual(['Occultism', 'Iomedae Lore'])
  expect(skillRankBudget(c, entries).trained).toBe(skillRankBudget({ ...c, backgroundLores: undefined }, entries).trained)
  expect(ranksAt(c, entries)['Iomedae Lore']).toBe(1)
  expect(ranksAt({ ...c, background: undefined }, entries)['Iomedae Lore']).toBeUndefined()
  expect(backgroundSkills(entries[0], { ...c, backgroundLores: { Cultist: ['Arcana', 'Extra Lore'] } })).toEqual(['Occultism'])
})

it('enforces multiple Lore slots, uniqueness, and Lore-only grants without Additional Lore scaling', () => {
  const entries = compile('Time Traveler', `You are trained in three ${skill('Lore')} skills of your choice.`)
  const previous = { autoLores: getSettings().autoLores, skillTokenConversion: getSettings().skillTokenConversion }
  try {
    updateSettings({ autoLores: false, skillTokenConversion: true })
    const c = { ...base, level: 20, background: 'Time Traveler',
      backgroundLores: { 'Time Traveler': ['Ancient History Lore', 'ancient history Lore', 'Arcana', 'Extra Lore'] } }
    expect(backgroundLoreSlots(c, entries)).toHaveLength(3)
    expect(backgroundSkills(entries[0], c)).toEqual(['Ancient History Lore'])
    expect(ranksAt(c, entries)['Ancient History Lore']).toBe(1)
    expect(ranksAt(c, entries)['Extra Lore']).toBeUndefined()
  } finally { updateSettings(previous) }
})

it('restricts Reborn Soul bonus increases to its two chosen Lore skills', () => {
  const entries = compile('Reborn Soul', `You become trained in two ${skill('Lore')} skills.
At 3rd level, 7th level, and 15th level, you receive skill increases, which you can apply only to these Lore skills.`)
  const previous = { autoLores: getSettings().autoLores, skillTokenConversion: getSettings().skillTokenConversion }
  try {
    updateSettings({ autoLores: false, skillTokenConversion: true })
    const c = { ...base, level: 7, background: 'Reborn Soul',
      backgroundLores: { 'Reborn Soul': ['Ancient History Lore', 'Farming Lore'] }, skillPicks: ['Athletics'] }
    const slots = backgroundLoreIncreaseSlots(c, entries)
    expect(slots.map(slot => slot.level)).toEqual([3, 7])
    const spent = { ...c, skillIncreases: Object.fromEntries(slots.map(slot => [slot.key, 'Ancient History Lore'])) }
    expect(ranksAt(spent, entries)['Ancient History Lore']).toBe(3)
    expect(ranksAt(spent, entries, 7)['Ancient History Lore']).toBe(2)
    expect(ranksAt({ ...spent, background: undefined }, entries)['Ancient History Lore']).toBeUndefined()
    const invalid = { ...c, skillIncreases: { [slots[0].key]: 'Athletics' } }
    expect(ranksAt(invalid, entries).Athletics).toBe(1)
    expect(skillRankBudget(invalid, entries)).toEqual(skillRankBudget(c, entries))
    expect(skillTokenPurchase({ ...c, skillIncreases: { 3: 'Crafting', 5: 'Crafting', 7: 'Crafting' } },
      entries, 'Athletics', 2)).toBeUndefined()
    expect(skillTokenPurchase({ ...c, skillIncreases: { 3: 'Crafting', 5: 'Crafting', 7: 'Crafting' } },
      entries, 'Ancient History Lore', 2)).toBeDefined()
  } finally { updateSettings(previous) }
})
