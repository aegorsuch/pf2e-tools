import { expect, it } from 'vitest'
import { matchesSpellDefense, type SpellDefense } from './spellDefense'
import type { ContentEntry } from './types'

const spell = (data: ContentEntry['data'], traits: string[] = [], description = ''): ContentEntry => ({
  id: 'spell', name: 'Spell', systems: ['pf2e'], kind: 'spell', source: 'official', level: 1,
  traits, description, data, effects: [], updatedAt: 0,
})

it.each([
  [spell({ saving_throw: 'AC' }), ['all', 'ac']],
  [spell({}, ['Attack']), ['all', 'ac']],
  [spell({}, [], 'Make a ranged spell attack.'), ['all', 'ac']],
  [spell({ saving_throw: 'basic Reflex' }), ['all', 'save', 'reflex']],
  [spell({ save: 'Fortitude or Will' }), ['all', 'save', 'fortitude', 'will']],
  [spell({}, [], 'Each creature attempts a Will saving throw.'), ['all', 'save', 'will']],
  [spell({ saving_throw: 'Reflex' }, ['Attack']), ['all', 'ac', 'save', 'reflex']],
  [spell({}), ['all']],
] as [ContentEntry, SpellDefense[]][])('matches spell defenses from metadata and rules', (entry, expected) => {
  for (const filter of ['all', 'ac', 'save', 'fortitude', 'reflex', 'will'] as const)
    expect(matchesSpellDefense(entry, filter)).toBe(expected.includes(filter))
})
