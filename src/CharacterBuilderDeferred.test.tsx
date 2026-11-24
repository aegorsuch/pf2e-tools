// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { CharacterBuilder } from './CharacterBuilder'
import { plannedSlots } from './builder'
import type { Character, ContentEntry } from './types'

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

it('updates equipment groups when inventory or catalog changes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const c: Character = {
    id: 'equipment-updates', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const item: ContentEntry = { id: 'item', name: 'Test Item', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: '', data: { item_category: 'Grafts' }, effects: [], updatedAt: 0 }
  const catalog = [item]
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = async (character: Character, entries: ContentEntry[]) => {
    await act(async () => root.render(<CharacterBuilder character={character} catalog={entries} onClose={() => {}} />))
  }
  try {
    await render(c, catalog)
    const equipment = [...container.querySelectorAll('details')].find(details =>
      details.querySelector('summary strong')?.textContent === 'Equipment')!
    await act(async () => { equipment.open = true; equipment.dispatchEvent(new Event('toggle')) })
    const group = (name: string) => [...equipment.querySelectorAll('.equipment-group')]
      .find(element => element.querySelector('h4')?.textContent === name)?.textContent ?? ''
    expect(group('Grafts')).not.toContain('Test Item')
    const equipped = { ...c, equipment: [{ name: 'Test Item', qty: 1 }] }
    await render(equipped, catalog)
    expect(group('Grafts')).toContain('Test Item')
    await render(equipped, [{ ...item, data: { item_category: 'Tattoos' } }])
    expect(group('Grafts')).not.toContain('Test Item')
    expect(group('Tattoos')).toContain('Test Item')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
