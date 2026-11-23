import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { classRepertoireRows, classSpellcasting, classSpellSlots, eligibleFeats, knowsSpell, languageAllowance } from './builder'
import { SpellsSection } from './SpellsSection'
import { homebrewCharacterOptions } from './supplemental'
import type { Character, ContentEntry } from './types'

const base: Character = {
  id: 'caster', name: 'Caster', className: 'Bard', systems: ['pf2e'], level: 1,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it.each([
  ['Champion', 'Divine Warrior', 'Divine', 'cha'],
  ['Ranger', 'Primal Warrior', 'Primal', 'wis'],
] as const)('adds fixed and selectable %s class cantrips through %s', (className, name, tradition, ability) => {
  const feat = homebrewCharacterOptions([]).find(entry => entry.name === name)!
  const spell = (spellName: string, spellTradition: string, traits = ['Cantrip']): ContentEntry => ({
    id: spellName, name: spellName, kind: 'spell', systems: ['pf2e'], source: 'official', level: 1,
    traits, data: { tradition: spellTradition }, description: '', effects: [], updatedAt: 0,
  })
  const entries = [feat, spell('Guidance', 'Divine, Primal'), spell('Test Cantrip', tradition),
    spell('Protect Companion', 'Divine, Primal'), spell('Divine Lance', 'Divine'),
    spell('Other Tradition', tradition === 'Divine' ? 'Primal' : 'Divine'),
    spell('Focus Cantrip', tradition, ['Cantrip', 'Focus']), spell('Ranked Spell', tradition, [])]
  const c: Character = { ...base, className, level: 5, abilities: { ...base.abilities, wis: 16 },
    feats: [{ name, type: 'Class Feat', level: 1, sourceId: feat.id, slot: 'class:1:0' }] }
  expect(eligibleFeats(entries, { ...c, feats: [] }, { key: 'class:1:0', category: 'class', level: 1 })).toContain(feat)
  expect(classSpellSlots(c)).toEqual({ 0: 2 })
  expect(classSpellcasting(c, entries)).toMatchObject({ traditions: [tradition], ability })
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Class Spells')
  expect(html).toContain('Protect Companion')
  expect(html).not.toContain('Clear Protect Companion spell slot')
  if (name === 'Primal Warrior') {
    expect(html).toContain('Cantrip slot 1')
    expect(html).toContain('Guidance')
    expect(html).toContain('Test Cantrip')
    expect(html).not.toContain('value="Protect Companion"')
  } else {
    expect(html).toContain('Divine Lance')
    expect(html).not.toContain('Clear Divine Lance spell slot')
    expect(html).not.toContain('Cantrip slot 1')
    expect(html).not.toContain('Cantrip slot 2')
  }
  expect(html).not.toContain('Other Tradition')
  expect(html).not.toContain('Focus Cantrip')
  expect(html).not.toContain('Ranked Spell')
  expect(html).toContain(`${tradition} DC ${ability === 'cha' ? 21 : 20}`)
  const selected: Character = { ...c, spellcasting: { ability, tradition, rank: 1, slots: {},
    prepared: { '0:0': 'Guidance', '0:1': 'Test Cantrip' } } }
  expect(knowsSpell(selected, entries, 'Protect Companion')).toBe(true)
  expect(knowsSpell(selected, entries, 'Guidance')).toBe(name === 'Primal Warrior')
  expect(knowsSpell(selected, entries, 'Test Cantrip')).toBe(false)
  expect(knowsSpell({ ...selected, feats: [] }, entries, 'Guidance')).toBe(false)
  const selectedHtml = renderToStaticMarkup(<SpellsSection c={selected} entries={entries} save={() => {}} />)
  expect(selectedHtml).toContain('Cantrips (Heightened Level 3)')
  expect(selectedHtml).not.toContain('Clear Protect Companion spell slot')
  if (name === 'Primal Warrior') expect(selectedHtml).toContain('Clear Guidance spell slot')
  else expect(selectedHtml).not.toContain('Clear Divine Lance spell slot')
  expect(classSpellSlots({ ...c, feats: [] })).toBeUndefined()
  expect(classSpellSlots({ ...c, level: 0 })).toEqual({})
  if (name === 'Primal Warrior') {
    expect(languageAllowance(c, entries).locked).toContain('Wildsong')
    expect(languageAllowance({ ...c, level: 0 }, entries).locked).not.toContain('Wildsong')
  }
})

it.each([
  ['Bard', 1, { 0: 5, 1: 2 }],
  ['Bard', 3, { 0: 5, 1: 3, 2: 2 }],
  ['Cleric', 1, { 0: 5, 1: 6 }],
  ['Druid', 1, { 0: 5, 1: 2 }],
  ['Witch', 2, { 0: 5, 1: 3 }],
  ['Wizard', 19, { 0: 6, 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 1 }],
  ['Oracle', 1, { 0: 5, 1: 3 }],
  ['Sorcerer', 3, { 0: 5, 1: 4, 2: 3 }],
  ['Magus', 3, { 0: 5, 1: 2, 2: 1 }],
  ['Summoner', 1, { 0: 5, 1: 1 }],
  ['Psychic', 3, { 0: 6, 1: 2, 2: 1 }],
  ['Animist', 19, { 0: 6, 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 1 }],
])('derives %s slot progression at level %i without saved slot counts', (className, level, expected) => {
  expect(classSpellSlots({ ...base, className, level })).toEqual(expected)
})

it.each([
  ['Mystic', 1, { 0: 5, 1: 3 }],
  ['Mystic', 3, { 0: 5, 1: 4, 2: 3 }],
  ['Technomancer', 1, { 0: 5, 1: 2 }],
  ['Technomancer', 3, { 0: 5, 1: 3, 2: 2 }],
])('derives Starfinder %s slots at level %i', (className, level, expected) => {
  expect(classSpellSlots({ ...base, systems: ['sf2e'], className, level })).toEqual(expected)
})

it.each([
  ['Mystic', 4],
  ['Technomancer', 3],
])('adds the Starfinder rank-10 slot for %s at level 19', (className, slotsPerRank) => {
  const slots = classSpellSlots({ ...base, systems: ['sf2e'], className, level: 19 })!
  expect(slots[9]).toBe(slotsPerRank)
  expect(slots[10]).toBe(1)
})

it('derives Mystic connection tradition and caster ability from selected class', () => {
  const c: Character = { ...base, systems: ['sf2e'], className: 'Mystic', subclass: 'Elemental', level: 7 }
  expect(classSpellcasting(c, [])).toEqual({ traditions: ['Primal'], rank: 2, ability: 'wis' })
  expect(classSpellcasting({ ...c, subclass: 'Shadow' }, [])?.traditions).toEqual(['Divine'])
  expect(classSpellcasting({ ...c, className: 'Technomancer', subclass: '' }, []))
    .toMatchObject({ traditions: ['Arcane'], ability: 'int' })
})

it('scales Bloodrager spell attack and DC proficiency with active spellcasting feats', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', level: 20,
    feats: [
      { name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, choice: 'Divine' },
      { name: 'Surging Blood Magic', type: 'Class Feat', level: 12 },
      { name: 'Exultant Blood Magic', type: 'Class Feat', level: 18 },
    ] }
  expect(classSpellcasting({ ...c, level: 1 }, [])).toBeUndefined()
  expect(classSpellcasting({ ...c, level: 11 }, [])).toEqual({ traditions: ['Divine'], ability: 'cha', rank: 1 })
  expect(classSpellcasting({ ...c, level: 12 }, [])).toEqual({ traditions: ['Divine'], ability: 'cha', rank: 2 })
  expect(classSpellcasting({ ...c, level: 18 }, [])).toEqual({ traditions: ['Divine'], ability: 'cha', rank: 3 })
  expect(classSpellcasting({ ...c, feats: c.feats.slice(0, 1) }, [])?.rank).toBe(1)
  expect(classSpellcasting({ ...c, systems: ['sf2e'] }, [])).toBeUndefined()
})

it('derives Bloodrager cantrips, spellcasting slots and repertoire from active feats', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', level: 20,
    feats: [
      { name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, choice: 'Divine' },
      { name: 'Rising Blood Magic', type: 'Class Feat', level: 4 },
      { name: 'Surging Blood Magic', type: 'Class Feat', level: 12 },
      { name: 'Exultant Blood Magic', type: 'Class Feat', level: 18 },
    ] }
  expect(classSpellSlots({ ...c, level: 1 })).toBeUndefined()
  expect(classSpellSlots({ ...c, level: 2 })).toEqual({ 0: 2 })
  expect(classSpellSlots({ ...c, level: 6 })).toEqual({ 0: 2, 1: 1, 2: 1 })
  expect(classSpellSlots({ ...c, level: 12 })).toEqual({ 0: 2, 1: 1, 2: 1, 3: 1, 4: 1 })
  expect(classSpellSlots(c)).toEqual({ 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2 })
  expect(classRepertoireRows(c)).toEqual({ 0: 2, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 })
  expect(classSpellSlots({ ...c, feats: c.feats.slice(0, 1) })).toEqual({ 0: 2 })
  expect(classSpellSlots({ ...c, systems: ['sf2e'] })).toBeUndefined()
})

it('offers Bloodrager repertoire spells from the chosen tradition without manual spell setup', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', level: 4,
    feats: [
      { name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, choice: 'Divine' },
      { name: 'Rising Blood Magic', type: 'Class Feat', level: 4 },
    ] }
  const spell = (name: string, tradition: string, cantrip = false): ContentEntry => ({
    id: name, name, kind: 'spell', systems: ['pf2e'], source: 'official', level: 1,
    traits: cantrip ? ['Cantrip', 'Attack'] : [], data: { tradition }, description: '', effects: [], updatedAt: 0,
  })
  const entries = [spell('Divine Cantrip', 'Divine', true), spell('Divine Spell', 'Divine'), spell('Arcane Spell', 'Arcane')]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Cantrip slot 1')
  expect(html).toContain('Cantrip slot 2')
  expect(html).toContain('Spell Rank 1 slot 1')
  expect(html).toContain('Divine Cantrip')
  expect(html).toContain('Divine Spell')
  expect(html).not.toContain('Arcane Spell')
  expect(html).not.toContain('Spell slots:')
})

it('keeps Bloodrager casting slots independent from repertoire and requires an attack cantrip', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', level: 18,
    feats: [
      { name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, choice: 'Divine' },
      { name: 'Rising Blood Magic', type: 'Class Feat', level: 4 },
      { name: 'Surging Blood Magic', type: 'Class Feat', level: 12 },
      { name: 'Exultant Blood Magic', type: 'Class Feat', level: 18 },
    ],
    spellcasting: { ability: 'cha', tradition: 'Divine', rank: 3, slots: {},
      prepared: { '0:0': 'Guidance', '1:0': 'Fear' }, spentSlots: ['1:0'] } }
  const spell = (name: string, traits: string[]): ContentEntry => ({
    id: name, name, kind: 'spell', systems: ['pf2e'], source: 'official', level: 1,
    traits, data: { tradition: 'Divine' }, description: '', effects: [], updatedAt: 0,
  })
  const entries = [spell('Guidance', ['Cantrip']), spell('Light', ['Cantrip']), spell('Divine Lance', ['Cantrip', 'Attack']), spell('Fear', [])]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Divine Lance')
  expect(html).not.toContain('>Light</option>')
  expect(html).toContain('aria-label="Cast spell slot rank 1 slot 1"')
  expect(html).not.toContain('disabled="" aria-label="Cast spell slot rank 1 slot 1"')
  const exhausted = renderToStaticMarkup(<SpellsSection c={{ ...c, spellcasting: { ...c.spellcasting!, spentSlots: ['1:0', '1:1'] } }}
    entries={entries} save={() => {}} />)
  expect(exhausted).toContain('disabled="" aria-label="Cast spell slot rank 1 slot 1"')
})

it('renders automatically computed slots without manual slot controls or saved spellcasting data', () => {
  const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 3 }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('Spell Rank 1 slot 1')
  expect(html).toContain('Spell Rank 2 slot 2')
  expect(html).not.toContain('Spell slots:')
  expect(html).not.toContain('type="number"')
})

it('adds Cleric Divine Font slots at the highest spell rank, restricted to Heal or Harm', () => {
  const c: Character = { ...base, className: 'Cleric', systems: ['pf2e'], level: 1 }
  const entry = (name: string, kind: ContentEntry['kind'], data: ContentEntry['data']): ContentEntry => ({
    id: name, name, kind, systems: ['pf2e'], source: 'official', level: 1, traits: [],
    data, description: '', effects: [], updatedAt: 0,
  })
  const entries = [
    entry('Cleric', 'class', { tradition: 'Divine', attribute: 'Wisdom' }),
    entry('Heal', 'spell', { tradition: 'Divine' }),
    entry('Harm', 'spell', { tradition: 'Divine' }),
    entry('Fear', 'spell', { tradition: 'Divine' }),
  ]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Spell Rank 1 slot 6')
  expect(html).toContain('value="Heal"')
  expect(html).toContain('value="Harm"')
  expect(html).not.toContain('value="Fear"')
  expect(classSpellSlots({ ...c, level: 5 })?.[3]).toBe(7)
  expect(classSpellSlots({ ...c, level: 15 })?.[8]).toBe(8)
})

it('keeps flexible prepared casting on manual slot settings', () => {
  const c: Character = { ...base, className: 'Wizard', level: 2,
    feats: [{ name: 'Flexible Spellcaster Dedication', type: 'Class Feat', level: 2 }] }
  expect(classSpellSlots(c)).toBeUndefined()
})
