import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { CharacterBuilder } from './CharacterBuilder'
import type { Character } from './types'

it('keeps section summaries current without mounting closed section controls', () => {
  const c: Character = {
    id: 'deferred', systems: ['pf2e'], name: 'Deferred', level: 4, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    formulas: ['Rope'], companions: [{ id: 'wolf', type: 'Wolf', name: 'Fang' }],
    spells: [{ name: 'Heal', rank: 1, cantrip: false }],
  }
  const render = (character: Character) => renderToStaticMarkup(
    <CharacterBuilder character={character} catalog={[]} onClose={() => {}} />,
  )
  const markup = render(c)
  expect(markup).toContain('1 known')
  expect(markup).toContain('Young Wolf (Fang)')
  expect(markup).toContain('1 spells')
  expect(markup).not.toContain('Search formulas')
  expect(markup).not.toContain('Companion type')
  expect(markup).not.toContain('Search spells')
  expect(render({ ...c, formulas: [], companions: [], spells: [] })).toContain('0 known')
  expect(render({ ...c, formulas: [], companions: [], spells: [] })).toContain('0 minions')
  expect(render({ ...c, formulas: [], companions: [], spells: [] })).toContain('0 spells')
})
