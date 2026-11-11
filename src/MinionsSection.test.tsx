import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { MinionsSection } from './MinionsSection'
import type { Character, ContentEntry } from './types'

it('places companion advancement choices on the companion card', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Incredible Companion', type: 'Class Feat', level: 8, choice: 'Nimble' },
      { name: 'Specialized Companion', type: 'Class Feat', level: 10, choice: 'Ambusher' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'wolf', name: 'Wolf', type: 'Wolf' }],
  }
  const wolf: ContentEntry = {
    id: 'wolf', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Wolf', level: 1,
    traits: [], description: '', data: { strength: 2, dexterity: 2, constitution: 2, intelligence: -4, wisdom: 1, charisma: 0, hp: 8, size: 'Medium', speed: 35, companion_attacks: 'Jaws|1d8 piercing|' },
    effects: [], updatedAt: 0,
  }

  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[wolf]} save={() => {}} />)

  expect(markup).toContain('aria-label="Companion advancement"')
  expect(markup).toContain('aria-label="Companion specialization 2"')
  expect(markup).toContain('<option value="Nimble" selected="">Nimble</option>')
  expect(markup).toContain('<option value="Ambusher" selected="">Ambusher</option>')
  expect(markup).not.toContain('Add animal companion')
  expect(markup).toContain('aria-label="Companion type"')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, feats: [], companions: [] }} entries={[wolf]} save={() => {}} />))
    .not.toContain('Add animal companion')
})
