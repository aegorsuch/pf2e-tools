// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { SpellActions } from './SpellDamage'
import { SpellsSection, SpiritOfTheBeastOptions } from './SpellsSection'
import { StatusesContent } from './StatusesSection'
import { SkillsSection } from './SkillsSection'
import { MinionsSection } from './MinionsSection'
import { resistances } from './builder'
import { companionStats } from './companions'
import type { Character, ContentEntry } from './types'

it('synchronizes Untamed Shift and Harden Flesh through statuses', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const initial: Character = { id: 'druid', name: 'Test', systems: ['pf2e'], level: 10, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Untamed Form', type: 'Class Feat', level: 1 }, { name: 'Harden Flesh', type: 'Class Feat', level: 10 }],
    spells: [{ name: 'Untamed Shift', rank: 1, cantrip: false }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const entries: ContentEntry[] = [
    { id: 'shift', name: 'Untamed Shift', systems: ['pf2e'], kind: 'spell', source: 'official', level: 1,
      traits: [], description: 'Change your shape.', data: { actions: 'Single Action to Two Actions' }, effects: [], updatedAt: 0 },
    { id: 'harden', name: 'Harden Flesh', systems: ['pf2e'], kind: 'feat', source: 'official', level: 10,
      traits: ['Druid'], description: 'Harden your flesh.', data: { actions: 'Single Action' }, effects: [], updatedAt: 0 },
  ]
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    const save = (patch: Partial<Character>) => setC(previous => ({ ...previous, ...patch }))
    return <><StatusesContent c={c} entries={entries} save={save} /><SkillsSection c={c} entries={entries} save={save} part="defense" /></>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    const shift = container.querySelector<HTMLInputElement>('[aria-label="Untamed Shift status"]')!
    expect(shift.disabled).toBe(true)
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Choose Untamed Shift effects"]')!.click())
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Untamed Shift: Claws"]')!.click())
    expect(current.activeSpells).toContain('Untamed Shift')
    expect(current.untamedShiftEffects).toEqual(['Claws'])
    expect(shift.checked).toBe(true)
    await act(async () => shift.click())
    expect(current.activeSpells).not.toContain('Untamed Shift')
    expect(current.untamedShiftEffects).toEqual(['Claws'])
    await act(async () => shift.click())
    expect(current.activeSpells).toContain('Untamed Shift')
    const statusHarden = container.querySelector<HTMLInputElement>('[aria-label="Harden Flesh status"]')!
    expect(statusHarden.closest('dialog')).toBeNull()
    await act(async () => statusHarden.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Harden Flesh options"]')!.click())
    const harden = container.querySelectorAll<HTMLInputElement>('[aria-label="Harden Flesh active"]')
    expect(harden).toHaveLength(2)
    await act(async () => harden[0].click())
    expect(statusHarden.checked).toBe(false)
    await act(async () => harden[1].click())
    expect(statusHarden.checked).toBe(true)
    expect(resistances(current, [])).toContainEqual({ damage: 'Physical (except adamantine)', value: 3, source: 'Harden Flesh' })
    await act(async () => statusHarden.click())
    expect(resistances(current, [])).toEqual([])
  } finally {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
})

it('opens Purify Air details from statuses', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const c: Character = { id: 'druid', name: 'Test', systems: ['pf2e'], level: 4, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Leshy Familiar', type: 'Class Feat', level: 1 },
      { name: 'Leshy Familiar Secrets', type: 'Class Feat', level: 4, choice: 'Purify Air' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<StatusesContent c={c} entries={[]} save={() => {}} />))
    const button = [...container.querySelectorAll('button')].find(item => item.textContent === 'Purify Air')!
    await act(async () => button.click())
    expect(container.querySelector('dialog[open]')?.textContent).toContain('Recycles air for one Medium creature')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
})

it('targets a Witch familiar with Protect Companion instead of its animal companion', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const bear: ContentEntry = { id: 'bear', name: 'Bear', systems: ['pf2e'], kind: 'companion', source: 'official',
    level: 1, traits: [], description: '', data: { size: 'Small', hp: 8, dexterity: 2 },
    effects: [], updatedAt: 0 }
  const initial: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 5, className: 'Witch',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    spells: [{ name: 'Protect Companion', rank: 0, cantrip: true }],
    companions: [{ id: 'bear', type: 'Bear', name: '' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    const save = (patch: Partial<Character>) => setC(previous => ({ ...previous, ...patch }))
    return <><StatusesContent c={c} entries={[bear]} save={save} /><MinionsSection c={c} entries={[bear]} save={save} /></>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    const familiarAc = () => Number(container.querySelector('[data-minion-name="Witch\'s Familiar"] .gear-stats span:nth-child(2) b')?.textContent)
    const baseAc = familiarAc()
    const baseBearAc = companionStats(current, [bear], 'Bear', undefined, 'bear')!.ac
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Protect Companion active"]')!.click())
    expect(companionStats(current, [bear], 'Bear', undefined, 'bear')!.ac).toBe(baseBearAc + 1)
    expect(familiarAc()).toBe(baseAc)
    const target = container.querySelector<HTMLSelectElement>('[aria-label="Protect Companion target"]')!
    await act(async () => { target.value = 'familiar:primary'; target.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(current.protectCompanionFamiliar).toBe('primary')
    expect(companionStats(current, [bear], 'Bear', undefined, 'bear')!.ac).toBe(baseBearAc)
    expect(familiarAc()).toBe(baseAc + 1)
    expect(container.querySelector<HTMLInputElement>('[aria-label="Protect Companion on Familiar"]')!.checked).toBe(true)
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Protect Companion on Familiar"]')!.click())
    expect(familiarAc()).toBe(baseAc)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('rolls and hides familiar and companion ability results', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const cat: ContentEntry = { id: 'cat', name: 'Cat', systems: ['pf2e'], kind: 'companion', source: 'official',
    level: 1, traits: [], description: '', data: { size: 'Medium', companion_attacks: 'Claw|1d6 slashing|agile' },
    effects: [], updatedAt: 0 }
  const base: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const druid: Character = { ...base, className: 'Druid',
    feats: [{ name: 'Leshy Familiar', type: 'Class Feat', level: 1 },
      { name: 'Leshy Familiar Secrets', type: 'Class Feat', level: 4, choice: 'Verdant Burst' },
      { name: 'Vicious Rend', type: 'Archetype Feat', level: 10 }],
    companions: [{ id: 'cat', type: 'Cat', name: '' }] }
  const witch: Character = { ...base, className: 'Witch',
    feats: [{ name: 'Spirit Familiar (Witch)', type: 'Class Feat', level: 8 }] }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<MinionsSection c={druid} entries={[cat]} save={() => {}} />))
    for (const [label, resultLabel, expected] of [
      ['Roll Verdant Burst: Healing and Additional plant healing', 'Verdant Burst: Healing result', 'Healing: 4 HP; Additional plant healing: 8 HP'],
      ['Roll Vicious Rend: Persistent bleed', 'Vicious Rend: Persistent bleed result', '1 bleed'],
    ]) {
      const button = container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!
      expect(button).toBeTruthy()
      await act(async () => button.click())
      expect(container.querySelector(`[aria-label="${resultLabel}"]`)?.textContent).toContain(expected)
      await act(async () => button.click())
      expect(container.querySelector(`[aria-label="${resultLabel}"]`)).toBeNull()
    }
    await act(async () => root.render(<MinionsSection c={witch} entries={[]} save={() => {}} />))
    const shed = container.querySelector<HTMLButtonElement>('[aria-label="Roll Shed Spirit: Damage"]')!
    expect(shed).toBeTruthy()
    await act(async () => shed.click())
    expect(container.querySelector('[aria-label="Shed Spirit: Damage result"]')?.textContent).toContain('8 spirit')
    await act(async () => shed.click())
    expect(container.querySelector('[aria-label="Shed Spirit: Damage result"]')).toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

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
