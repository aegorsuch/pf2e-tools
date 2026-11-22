import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { classSpellcasting, classSpellSlots } from './builder'
import { SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'

const base: Character = {
  id: 'caster', name: 'Caster', className: 'Bard', systems: ['pf2e'], level: 1,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

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
