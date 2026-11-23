// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { SpellActions } from './SpellDamage'
import { SpellsSection, SpiritOfTheBeastOptions } from './SpellsSection'
import { StatusesContent } from './StatusesSection'
import { resistances } from './builder'
import type { Character, ContentEntry } from './types'

it('rolls Sun Blade with selected sunlight and target damage, and Lay on Hands healing', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<><SpellActions name="Sun Blade" rank={4} /><SpellActions name="Lay on Hands" rank={4} /></>))
    for (const label of ['Bright sunlight', 'Evil', 'Undead']) {
      const input = [...container.querySelectorAll('label')].find(item => item.textContent?.includes(label))?.querySelector('input')
      expect(input).toBeTruthy()
      await act(async () => input!.click())
    }
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Roll Sun Blade: Damage"]')!.click())
    expect(container.querySelector('[aria-label="Sun Blade: Damage result"]')?.textContent).toContain('3 fire; 3 good; 3 positive')
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Roll Lay on Hands: Healing"]')!.click())
    expect(container.querySelector('[aria-label="Lay on Hands: Healing result"]')?.textContent).toContain('24 HP')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

it('opens Enduring Might options and synchronizes its trigger resistance with statuses', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const spell: ContentEntry = { id: 'enduring', name: 'Enduring Might', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 4, traits: ['Focus'], description: '', data: { actions: 'Reaction' }, effects: [], updatedAt: 1 }
  const initial: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 11,
    abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], spells: [{ name: spell.name, rank: 4, cantrip: false }], equipment: [], lores: [], languages: [],
    entryIds: [], extraSlots: [], updatedAt: 0 }
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    const save = (patch: Partial<Character>) => setC(previous => ({ ...previous, ...patch }))
    return <><SpellsSection c={c} entries={[spell]} save={save} /><StatusesContent c={c} entries={[spell]} save={save} /></>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Enduring Might options"]')!.click())
    const dialog = container.querySelector<HTMLDialogElement>('dialog[open]')!
    const toggle = dialog.querySelector<HTMLInputElement>('[aria-label="Enduring Might active"]')!
    await act(async () => toggle.click())
    expect(resistances(current, [spell])).toContainEqual({ damage: 'All damage from triggering attack or effect',
      value: 14, source: spell.name })
    const toggles = container.querySelectorAll<HTMLInputElement>('[aria-label="Enduring Might active"]')
    expect([...toggles].every(input => input.checked)).toBe(true)
    await act(async () => toggles[toggles.length - 1].click())
    expect(resistances(current, [spell]).some(item => item.source === spell.name)).toBe(false)
    expect([...container.querySelectorAll<HTMLInputElement>('[aria-label="Enduring Might active"]')].every(input => !input.checked)).toBe(true)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
})

it('opens Spirit of the Beast options and synchronizes the companion aspect', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const spell: ContentEntry = { id: 'spirit', name: 'Spirit of the Beast', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 2, traits: ['Focus'], description: '', data: { actions: 'Single Action' }, effects: [], updatedAt: 1 }
  const initial: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 9,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], spells: [{ name: spell.name, rank: 2, cantrip: false }], companions: [{ id: 'bear', name: 'Bear', type: 'Bear' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  function Sheet() {
    const [c, setC] = useState(initial)
    const save = (patch: Partial<Character>) => setC(previous => ({ ...previous, ...patch }))
    return <><SpellsSection c={c} entries={[spell]} save={save} /><SpiritOfTheBeastOptions c={c} save={save} companionId="bear" /></>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Spirit of the Beast options"]')!.click())
    const dialog = container.querySelector<HTMLDialogElement>('dialog[open]')!
    const select = dialog.querySelector<HTMLSelectElement>('[aria-label="Spirit of the Beast aspect on Bear"]')!
    await act(async () => { select.value = 'Might'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect([...container.querySelectorAll<HTMLSelectElement>('[aria-label="Spirit of the Beast aspect on Bear"]')]
      .map(item => item.value)).toEqual(['Might', 'Might'])
  } finally {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
})
