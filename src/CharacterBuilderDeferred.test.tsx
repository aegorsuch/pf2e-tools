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

it('opens Parry rules from Defense and Statuses summaries without toggling either section', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const c: Character = { id: 'parry', systems: ['pf2e'], name: 'Test', level: 8, className: 'Ranger', parrying: true,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    weapons: [{ id: 'weapon', name: 'Parry Sword', potency: 0, striking: 0, runes: [] }] }
  const weapon: ContentEntry = { id: 'weapon', name: 'Parry Sword', kind: 'weapon', source: 'official', systems: ['pf2e'],
    level: 1, traits: ['Parry'], description: '', data: { weapon_category: 'Martial', hands: 1 }, effects: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<CharacterBuilder character={c} catalog={[weapon]} onClose={() => {}} />))
    for (const sectionName of ['Defense', 'Statuses']) {
      const section = [...container.querySelectorAll('details')].find(details =>
        details.querySelector(':scope > summary > strong')?.textContent === sectionName)!
      const summary = section.querySelector(':scope > summary')!
      const button = [...summary.querySelectorAll('button')].find(item => item.textContent === 'Parry')!
      expect(button).toBeTruthy()
      await act(async () => button.click())
      expect(section.open).toBe(false)
      const dialog = summary.querySelector('dialog[open]')!
      expect(dialog.textContent).toContain('While wielding a parry weapon')
      dialog.removeAttribute('open')
    }
    expect(container.querySelector<HTMLInputElement>('[aria-label="Parry active (summary)"]')?.checked).toBe(true)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
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

it('updates class feat slots and progress when a blank slot is added and filled', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const c: Character = {
    id: 'class-slots', systems: ['pf2e'], name: 'Test', level: 2, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const catalog: ContentEntry[] = []
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = async (character: Character) => act(async () => root.render(
    <CharacterBuilder character={character} catalog={catalog} onClose={() => {}} />,
  ))
  try {
    await render(c)
    const section = [...container.querySelectorAll('details')].find(details =>
      details.querySelector('summary strong')?.textContent === 'Class')!
    await act(async () => { section.open = true; section.dispatchEvent(new Event('toggle')) })
    const count = () => [...section.querySelectorAll('.character-subsection > summary h4')]
      .find(heading => heading.textContent?.startsWith('Class Feats'))?.textContent
    const initial = plannedSlots(c, catalog).filter(slot => slot.category === 'class').length
    expect(count()).toBe(`Class Feats 0/${initial}`)
    const added: Character = { ...c, extraSlots: [{ category: 'class', level: 2, count: 1 }] }
    await render(added)
    expect(count()).toBe(`Class Feats 0/${initial + 1}`)
    expect(section.querySelectorAll('[aria-label="L02 Class feat"]')).toHaveLength(2)
    await render({ ...added, feats: [{ name: 'Test feat', type: 'Class Feat', level: 2, slot: 'class:2:1' }] })
    expect(count()).toBe(`Class Feats 1/${initial + 1}`)
    expect(section.textContent).toContain('Test feat')
    await render(c)
    expect(count()).toBe(`Class Feats 0/${initial}`)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
