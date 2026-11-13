import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { FormulasSection } from './FormulasSection'
import { knownFormulas } from './formulas'
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
  expect(markup).toContain('three snare formulas')
  expect(knownFormulas({ ...character, brastlewarkFormulaMode: undefined }, entries).map(formula => formula.name))
    .toEqual(['Alarm Snare'])
})
