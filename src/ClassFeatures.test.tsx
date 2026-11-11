import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ClassFeatures } from './ClassFeatures'
import type { Character, ContentEntry } from './types'

it('labels class features with leading, zero-padded levels', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feature = (name: string, level: number): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'classFeature', source: 'official', name, level, traits: [],
    description: '', data: { class: 'Ranger' }, effects: [], updatedAt: 0,
  })
  const markup = renderToStaticMarkup(
    <ClassFeatures c={c} entries={[feature('First Feature', 1), feature('Later Feature', 10)]} save={() => {}} />,
  )
  expect(markup).toContain('Class Features (2)')
  expect(markup).toContain('L01 First Feature')
  expect(markup).toContain('L10 Later Feature')
})
