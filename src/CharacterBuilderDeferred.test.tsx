import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { CharacterBuilder } from './CharacterBuilder'
import { plannedSlots } from './builder'
import type { Character } from './types'

it('keeps section summaries current without mounting closed section controls', () => {
  const c: Character = {
    id: 'deferred', systems: ['pf2e'], name: 'Deferred', level: 4, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    formulas: ['Rope'], companions: [{ id: 'wolf', type: 'Wolf', name: 'Fang' }],
    spells: [{ name: 'Heal', rank: 1, cantrip: false }],
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: {}, prepared: { '1:0': 'Heal' } },
  }
  const render = (character: Character) => renderToStaticMarkup(
    <CharacterBuilder character={character} catalog={[]} onClose={() => {}} />,
  )
  const markup = render(c)
  expect(markup).toContain('1 known')
  expect(markup).toContain('Young Wolf (Fang)')
  expect(markup).toContain('<strong>Spells</strong><span>1/11 spells</span>')
  expect(markup).not.toContain('Search formulas')
  expect(markup).not.toContain('Companion type')
  expect(markup).not.toContain('Search spells')
  expect(render({ ...c, formulas: [], companions: [], spells: [] })).toContain('0 known')
  expect(render({ ...c, formulas: [], companions: [], spells: [] })).toContain('0 minions')
  expect(render({ ...c, formulas: [], companions: [], spells: [], spellcasting: undefined })).toContain('0/11 spells')
})

it('shows ancestry feat progress beside the ancestry name', () => {
  const c: Character = {
    id: 'ancestry-progress', systems: ['pf2e'], name: 'Gnome', level: 5, ancestry: 'Gnome', heritage: 'Sensate Gnome',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const slots = plannedSlots(c, []).filter(slot => slot.category === 'ancestry')
  const render = (character: Character) => renderToStaticMarkup(
    <CharacterBuilder character={character} catalog={[]} onClose={() => {}} />,
  )
  expect(render(c)).toContain(`Sensate Gnome (0/${slots.length})`)
  const filled = { ...c, feats: slots.map(slot => ({ name: 'Selected feat', type: 'Ancestry Feat', level: slot.level, slot: slot.key })) }
  expect(render(filled)).toContain(`Sensate Gnome (${slots.length}/${slots.length})`)
})
