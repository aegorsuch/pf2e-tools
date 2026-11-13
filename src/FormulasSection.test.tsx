import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { FormulasSection } from './FormulasSection'
import { gadgetLimits, knownFormulas, snareAdvancements, updateFormulaChoice } from './formulas'
import type { Character, ContentEntry } from './types'

const c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 4, className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
const item = (name: string, level: number, traits: string[]): ContentEntry => ({
  id: name, name, kind: 'item', level, traits, systems: ['pf2e'], source: 'official', description: '', data: {}, effects: [], updatedAt: 0,
})
const entries = [
  item('Alarm Snare', 1, ['Snare']), item('Spike Snare', 1, ['Snare']),
  item('Rare Snare', 1, ['Snare', 'Rare']), item('High Snare', 5, ['Snare', 'Magical', 'Uncommon']),
  item('Low Snare', 4, ['Snare', 'Magical', 'Uncommon']),
  item('Pit Illusion Snare', 3, ['Snare', 'Magical', 'Uncommon']),
  item('Shadow Cloak Snare', 4, ['Snare', 'Magical', 'Uncommon']),
]
const dedication = { name: 'Snarecrafter Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }
const brastlewark = { name: 'Brastlewark Snare Engineering', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' }

it('preserves dormant choices and fills gaps when selecting a later formula slot', () => {
  const choices = updateFormulaChoice([], 3, 'Low Snare')
  expect(JSON.parse(JSON.stringify(choices))).toEqual(['', '', '', 'Low Snare'])
  expect(updateFormulaChoice(choices, 0, 'Spike Snare')).toEqual(['Spike Snare', '', '', 'Low Snare'])
  const character: Character = { ...c, level: 8, feats: [dedication], skillPicks: ['Survival'],
    skillIncreases: { 3: 'Survival', 7: 'Survival' }, snareAdvancementFormulaChoices: choices }
  expect(knownFormulas(JSON.parse(JSON.stringify(character)), entries))
    .toContainEqual({ name: 'Low Snare', source: 'Snarecrafter Dedication' })
  const legacy: Character = { ...character, snareAdvancementFormulaChoices: JSON.parse('[null,null,null,"Low Snare"]') }
  expect(knownFormulas(legacy, entries)).toContainEqual({ name: 'Low Snare', source: 'Snarecrafter Dedication' })
})

it('retains user choices and derives formulas only while their granting feats are active', () => {
  const character: Character = { ...c, feats: [dedication, brastlewark], formulas: ['Alarm Snare', 'Rope'],
    snareFormulaChoices: ['Spike Snare'], brastlewarkFormulaMode: 'standard' }
  expect(knownFormulas(character, entries)).toEqual([
    { name: 'Alarm Snare', source: 'Other' },
    { name: 'Pit Illusion Snare', source: 'Brastlewark Snare Engineering' },
    { name: 'Rope', source: 'Other' },
    { name: 'Shadow Cloak Snare', source: 'Brastlewark Snare Engineering' },
    { name: 'Spike Snare', source: 'Snare Crafting' },
  ])
  expect(knownFormulas({ ...character, level: 1 }, entries)).toEqual([
    { name: 'Alarm Snare', source: 'Other' }, { name: 'Rope', source: 'Other' },
  ])
  expect(knownFormulas(JSON.parse(JSON.stringify(character)), entries)).toEqual(knownFormulas(character, entries))
})

it('offers only eligible initial and alternative snares without inventing Brastlewark choices', () => {
  const character: Character = { ...c, level: 6, feats: [dedication, brastlewark], snareFormulaChoices: ['Alarm Snare'],
    brastlewarkFormulaMode: 'other' }
  const markup = renderToStaticMarkup(<FormulasSection c={character} entries={entries} save={() => {}} />)
  expect(markup).toContain('Choose four common 1st-level snare formulas')
  expect(markup).toContain('Spike Snare (Level 1)')
  expect(markup).not.toContain('Rare Snare (Level 1)')
  expect(markup).not.toContain('High Snare (Level 5)')
  expect(markup).toContain('Low Snare (Level 4)')
  expect(markup).toContain('You must have access to each formula')
  expect(knownFormulas({ ...character, brastlewarkFormulaMode: undefined }, entries).map(formula => formula.name))
    .toEqual(['Alarm Snare'])
})

it('grants snare formula choices when relevant proficiency increases after dedication', () => {
  const character: Character = { ...c, level: 8, feats: [dedication], skillPicks: ['Survival'],
    skillIncreases: { 3: 'Survival', 7: 'Survival' },
    snareAdvancementFormulaChoices: ['Spike Snare', '', '', 'Low Snare'] }
  expect(snareAdvancements(character, entries)).toEqual([{ rank: 2, level: 3 }, { rank: 3, level: 7 }])
  expect(knownFormulas(character, entries)).toContainEqual({ name: 'Spike Snare', source: 'Snarecrafter Dedication' })
  expect(knownFormulas({ ...character, level: 4 }, entries).map(formula => formula.name)).not.toContain('Low Snare')
  const html = renderToStaticMarkup(<FormulasSection c={character} entries={entries} save={() => {}} />)
  expect(html).toContain('Expert snare formula 1')
  expect(html).toContain('Master snare formula 1')
  expect(html).toContain('level 3 or lower')
  expect(html).toContain('level 7 or lower')
  expect(snareAdvancements({ ...character, className: 'Fighter' }, entries)).toEqual([])
  expect(character.snareAdvancementFormulaChoices?.[3]).toBe('Low Snare')
})

it('tracks gadget formula and daily preparation limits without deleting dormant choices', () => {
  const gadget = item('Clockwork Goggles', 3, ['Gadget', 'Uncommon'])
  const character: Character = { ...c, level: 14, rankOverrides: { Crafting: 3 },
    feats: [{ name: 'Gadget Specialist', type: 'Class Feat', level: 4 },
      { name: 'Ubiquitous Gadgets', type: 'Class Feat', level: 8 },
      { name: 'Ubiquitous Gadgets', type: 'Class Feat', level: 8, slot: 'class:14:0' }],
    gadgetFormulaChoices: [gadget.name, '', '', '', '', 'Stored'], gadgetPreparations: [gadget.name] }
  expect(gadgetLimits(character, [gadget])).toEqual({ formulas: 6, prepared: 7 })
  expect(knownFormulas(character, [gadget])).toContainEqual({ name: gadget.name, source: 'Gadget Specialist' })
  const markup = renderToStaticMarkup(<FormulasSection c={character} entries={[gadget]} save={() => {}} />)
  expect(markup).toContain('Gadget formula 6')
  expect(markup).toContain('2/6 feat choices')
  expect(gadgetLimits({ ...character, rankOverrides: { Crafting: 4 } }, [gadget])).toEqual({ formulas: 9, prepared: 8 })
  expect(knownFormulas({ ...character, rankOverrides: { Crafting: 2 } }, [gadget]).map(formula => formula.name)).not.toContain('Stored')
  expect(character.gadgetFormulaChoices?.[5]).toBe('Stored')
})
