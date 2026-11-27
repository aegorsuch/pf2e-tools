// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { EquipmentSearch } from './EquipmentSearch'
import { equipmentGroupName } from './equipmentGroups'
import { OwnedScrollSpell, ScrollAdept, scrollAdeptLimits, scrollAdeptOptions } from './ScrollsSection'
import type { Character, ContentEntry } from './types'

const spell = (name: string, level: number, tradition = 'Arcane', traits: string[] = []): ContentEntry => ({
  id: name, name, level, traits, kind: 'spell', systems: ['pf2e'], source: 'official',
  data: { tradition }, description: '', effects: [], updatedAt: 0,
})
const fear = spell('Fear', 1)
const haste = spell('Haste', 3)
const heal = spell('Heal', 1, 'Divine')
const cantrip = spell('Ignition', 1, 'Arcane', ['Cantrip'])
const scroll: ContentEntry = { ...fear, id: 'scroll', name: '1st-rank Scroll', kind: 'item', traits: ['Scroll'], data: { bulk: 0.1 } }
const wizard: Character = {
  id: 'wizard', name: 'Wizard', systems: ['pf2e'], level: 10, className: 'Wizard',
  abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
  feats: [{ name: 'Scroll Adept', type: 'Class Feat', level: 10 }], equipment: [],
  spells: [fear, haste, heal, cantrip].map(entry => ({
    name: entry.name, entryId: entry.id, rank: entry.level, cantrip: entry === cantrip,
  })), lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const entries = [fear, haste, heal, cantrip, scroll,
  { ...fear, id: 'wizard-class', name: 'Wizard', kind: 'class' as const, data: { tradition: 'Arcane' } }]

it('scales preparations and limits spellbook choices to distinct eligible ranks', () => {
  expect(scrollAdeptLimits(wizard, entries)).toEqual({ count: 2, maxRank: 3 })
  expect(scrollAdeptLimits({ ...wizard, level: 15 }, entries)).toEqual({ count: 3, maxRank: 6 })
  expect(scrollAdeptLimits({ ...wizard, level: 19 }, entries)).toEqual({ count: 4, maxRank: 8 })
  expect(scrollAdeptLimits({ ...wizard, level: 9 }, entries)).toBeUndefined()
  expect(scrollAdeptOptions(wizard, entries, 2).map(option => [option.entry.name, option.rank]))
    .toEqual([['Fear', 1], ['Fear', 2]])
  const archetype: Character = { ...wizard, className: 'Gunslinger', level: 12, feats: [
    { name: 'Scroll Adept', type: 'Class Feat', level: 10 },
    { name: 'Spellshot Dedication', type: 'Archetype Feat', level: 2 },
    { name: 'Basic Wizard Spellcasting', type: 'Archetype Feat', level: 4 },
    { name: 'Expert Wizard Spellcasting', type: 'Archetype Feat', level: 12 },
  ], spells: [{ name: 'Fear', entryId: fear.id, rank: 1, cantrip: false, bookSlot: 'wizard:1:0' }] }
  expect(scrollAdeptLimits(archetype, entries)).toEqual({ count: 2, maxRank: 2 })
  expect(scrollAdeptOptions(archetype, entries, 2)).toHaveLength(2)
  const saved = { spellId: fear.id, name: fear.name, rank: 1 }
  const reduced = { ...wizard, level: 9, scrollAdeptPreparations: [saved] }
  const markup = renderToStaticMarkup(<ScrollAdept c={reduced} entries={entries} save={() => {}} />)
  expect(markup).toContain('Fear')
  expect(markup).toContain('Daily preparations')
  expect(reduced.scrollAdeptPreparations).toEqual([saved])
})

it('prepares different ranks, consumes scrolls, and resets without losing cancelled preparations', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  let latest = wizard
  function Sheet() {
    const [character, setCharacter] = useState(wizard)
    latest = character
    return <ScrollAdept c={character} entries={entries} save={patch => setCharacter(previous => ({ ...previous, ...patch }))} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const click = async (label: string) => {
    const button = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
    expect(button).not.toBeNull()
    await act(async () => button!.click())
  }
  try {
    await act(async () => root.render(<Sheet />))
    await click('Scroll Adept scroll 1')
    await click('Scroll Adept scroll 1: Fear (rank 1)')
    expect(latest.scrollAdeptPreparations?.[0]).toMatchObject({ name: 'Fear', rank: 1 })
    await click('Scroll Adept scroll 2')
    expect(document.querySelector('[aria-label="Scroll Adept scroll 2: Fear (rank 1)"]')).toBeNull()
    await click('Scroll Adept scroll 2: Fear (rank 2)')
    const cast = [...container.querySelectorAll('button')].find(button => button.textContent === 'Cast')!
    await act(async () => cast.click())
    expect(latest.scrollAdeptPreparations?.[0]?.used).toBe(true)
    await click('Scroll Adept scroll 2')
    expect(document.querySelector('[aria-label="Scroll Adept scroll 2: Fear (rank 1)"]')).toBeNull()
    const reset = [...container.querySelectorAll('button')].find(button => button.textContent === 'Daily preparations')!
    confirm.mockReturnValueOnce(false)
    await act(async () => reset.click())
    expect(latest.scrollAdeptPreparations).toHaveLength(2)
    await act(async () => reset.click())
    expect(latest.scrollAdeptPreparations).toEqual([])
  } finally {
    await act(async () => root.unmount())
    container.remove()
    confirm.mockRestore()
    vi.unstubAllGlobals()
  }
})

it('groups owned scrolls and casts one from a stack without changing other items', async () => {
  expect(equipmentGroupName(scroll, scroll.name, 'Other equipment')).toBe('Scrolls')
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  let latest: Character = { ...wizard, equipment: [{ name: scroll.name, qty: 2 }, { name: 'Rope', qty: 1 }] }
  function Sheet() {
    const [character, setCharacter] = useState<Character>(latest)
    latest = character
    return <><OwnedScrollSpell c={character} entries={entries} index={0} entry={scroll}
      save={patch => setCharacter(previous => ({ ...previous, ...patch }))} />
      <EquipmentSearch c={character} entries={entries} category="Scrolls"
        save={patch => setCharacter(previous => ({ ...previous, ...patch }))} /></>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Spell on 1st-rank Scroll"]')!.click())
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Spell on 1st-rank Scroll: Fear"]')!.click())
    expect(latest.equipment[0].scrollSpell).toBe('Fear')
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Add 1st-rank Scroll"]')!.click())
    expect(latest.equipment).toHaveLength(3)
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Cast')!.click())
    expect(latest.equipment[0]).toMatchObject({ qty: 1, scrollSpell: 'Fear' })
    expect(latest.equipment[1]).toEqual({ name: 'Rope', qty: 1 })
  } finally {
    await act(async () => root.unmount())
    container.remove()
    confirm.mockRestore()
    vi.unstubAllGlobals()
  }
})
