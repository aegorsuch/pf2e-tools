// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, onTestFinished, vi } from 'vitest'
import { SpellActions } from './SpellDamage'
import { SpellsSection, SpiritOfTheBeastOptions } from './SpellsSection'
import { StatusesContent, StatusesSummary } from './StatusesSection'
import { SensesAndSpeedSummary, SkillsSection } from './SkillsSection'
import { MinionsSection } from './MinionsSection'
import { WeaponList } from './GearSection'
import { activeAnimalFeatures, ownedWeapons, resistances, weaponAttack } from './builder'
import { OVERSIZED_THROW } from './supplemental'
import { companionStats } from './companions'
import type { Character, ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'

it('rides an eligible summoned creature using its movement instead of the rider bonuses', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const initial: Character = { id: 'rider', name: 'Test', systems: ['sf2e'], level: 13, ancestry: 'Lashunta',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Ally', type: 'Ancestry Feat', level: 13 }, { name: 'Fleet', type: 'General Feat', level: 3 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    lashuntaCreatureAlly: 'Shotalashu', mountedCompanionId: 'old-mount' }
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    const save = (patch: Partial<Character>) => setC(previous => ({ ...previous, ...patch }))
    return <><SensesAndSpeedSummary c={c} entries={[]} /><MinionsSection c={c} entries={[]} save={save} />
      <SpellsSection c={c} entries={[{ id: 'summon', name: 'Summon Animal', kind: 'spell', systems: ['sf2e'],
        source: 'official', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }]} save={save} /></>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    expect(container.querySelector('summary')?.textContent).toContain('Speed 30 ft.')
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Mounted on Shotalashu"]')!.click())
    expect(current.mountedCompanionId).toBeUndefined()
    expect(container.querySelector('summary')?.textContent).toContain('Speed 40 ft.')
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>('[aria-label="Creature Ally summoned creature"]')!
      select.value = 'Squox'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(current.mountedSummon).toBeUndefined()
    expect(container.querySelector('[aria-label="Mounted on Squox"]')).toBeNull()
    expect(container.querySelector('summary')?.textContent).toContain('Speed 30 ft.')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('uses the Technomancer spell database to learn and prepare Starfinder arcane spells', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const initial: Character = { id: 'tech', name: 'Test', systems: ['sf2e'], level: 1, className: 'Technomancer',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const spell = (name: string, tradition: string): ContentEntry => ({ id: name, name, systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 1, traits: [], description: `${name} rules`, data: { tradition }, effects: [], updatedAt: 0 })
  const entries = [spell('Arcane Test', 'Arcane'), spell('Divine Test', 'Divine')]
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    return <SpellsSection c={c} entries={entries} save={patch => setC(previous => ({ ...previous, ...patch }))} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Open Spell Database rank 1"]')!.click())
    expect(container.querySelector('dialog[open]')?.textContent).toContain('Spell Database')
    expect(container.querySelector('[aria-label="Learn Divine Test"]')).toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Learn Arcane Test"]')!.click())
    expect(current.spells).toContainEqual(expect.objectContaining({ name: 'Arcane Test', entryId: 'Arcane Test' }))
    const slot = container.querySelector<HTMLSelectElement>('select[aria-label="Spell Rank 1 slot 1"]')!
    expect([...slot.options].map(option => option.value)).toContain('Arcane Test')
    expect(container.querySelectorAll('.dirge-rank').length).toBeGreaterThan(0)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
})

it('learns and prepares Spellshot cantrips after changing ranks in the spellbook', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  } })
  const ignition: ContentEntry = { id: 'ignition', name: 'Ignition', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Cantrip'], description: 'Fire damage.',
    data: { tradition: 'Arcane' }, effects: [], updatedAt: 0 }
  const initial: Character = { id: 'spellshot', name: 'Test', systems: ['pf2e'], level: 4, className: 'Gunslinger',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Spellshot Dedication', type: 'Archetype Feat', level: 2 },
      { name: 'Basic Wizard Spellcasting', type: 'Archetype Feat', level: 4 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    return <SpellsSection c={c} entries={[ignition]} save={patch => setC(previous => ({ ...previous, ...patch }))} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Open Wizard rank 1"]')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('dialog[open] [aria-label="Cantrips"]')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Learn Ignition"]')!.click())
    expect(current.spells).toContainEqual(expect.objectContaining({ name: 'Ignition', rank: 0, cantrip: true, bookSlot: 'wizard:0:0' }))
    const slot = container.querySelector<HTMLSelectElement>('select[aria-label="Cantrip slot 1"]')!
    expect([...slot.options].map(option => option.value)).toContain('ignition')
    await act(async () => {
      slot.value = 'ignition'
      slot.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(current.spellcasting?.prepared?.['0:0']).toBe('ignition')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
    vi.unstubAllGlobals()
  }
})

it('tracks Summon Animal and Creature Ally in statuses', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const initial: Character = { id: 'summon', name: 'Test', systems: ['sf2e'], level: 13, ancestry: 'Vesk',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Ally', type: 'Ancestry Feat', level: 13, choice: 'Summon Animal' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const spell: ContentEntry = { id: 'summon', name: 'Summon Animal', systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Summon'], description: 'Summon animal rules.',
    data: { actions: 'Three Actions', tradition: 'Primal' }, effects: [], updatedAt: 0 }
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    return <><StatusesSummary c={c} entries={[spell]} save={() => {}} />
      <StatusesContent c={c} entries={[spell]} save={patch => setC(previous => ({ ...previous, ...patch }))} /></>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Summon Animal status"]')!.click())
    expect(current.creatureAllyActive).toBe(true)
    expect(container.querySelector('summary')?.textContent).toContain('Summon Animal')
    expect(container.querySelector('[aria-label="Summon Animal options"]')).toBeTruthy()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('activates and dismisses a Pahtra cat through Summon Animal status', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  const initial: Character = { id: 'pahtra-summon', name: 'Test', systems: ['sf2e'], level: 13, ancestry: 'Pahtra',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Ally', type: 'Ancestry Feat', level: 13, choice: 'Summon Animal' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const spell: ContentEntry = { id: 'summon', name: 'Summon Animal', systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Summon'], description: '', data: { tradition: 'Primal' }, effects: [], updatedAt: 0 }
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    const save = (patch: Partial<Character>) => setC(previous => ({ ...previous, ...patch }))
    return <><StatusesSummary c={c} entries={[spell]} save={save} />
      <StatusesContent c={c} entries={[spell]} save={save} /><MinionsSection c={c} entries={[spell]} save={save} />
      <SpellsSection c={c} entries={[spell]} save={save} /></>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    const toggle = container.querySelector<HTMLInputElement>('[aria-label="Summon Animal status"]')!
    await act(async () => toggle.click())
    expect(current.creatureAllyActive).toBe(true)
    expect(container.textContent).toContain('Summoned Cat')
    const spellToggle = container.querySelector<HTMLInputElement>('[aria-label="Summoned Cat active"]')!
    expect(spellToggle.checked).toBe(true)
    confirm.mockReturnValueOnce(false)
    await act(async () => spellToggle.click())
    expect(current.creatureAllyActive).toBe(true)
    expect(spellToggle.checked).toBe(true)
    await act(async () => spellToggle.click())
    expect(confirm).toHaveBeenCalled()
    expect(current.creatureAllyActive).toBe(false)
    expect(container.textContent).not.toContain('Summoned Cat')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

it('keeps Lashunta summon selection and status toggles in sync', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const confirm = vi.spyOn(window, 'confirm')
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const initial: Character = { id: 'lashunta-status', name: 'Test', systems: ['sf2e'], level: 13, ancestry: 'Lashunta',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Ally', type: 'Ancestry Feat', level: 13 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const spell: ContentEntry = { id: 'summon', name: 'Summon Animal', systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Summon'], description: 'Summon animal rules.',
    data: { actions: 'Three Actions', tradition: 'Primal' }, effects: [], updatedAt: 0 }
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    return <StatusesContent c={c} entries={[spell]} save={patch => setC(previous => ({ ...previous, ...patch }))} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    const outer = container.querySelector<HTMLInputElement>('[aria-label="Summon Animal status"]')!
    const inner = container.querySelector<HTMLInputElement>('[aria-label="Summon Animal active"]')!
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Creature Ally summoned creature"]')!
    expect(select.closest('dialog')).toBeTruthy()
    expect(inner.disabled).toBe(true)
    await act(async () => outer.click())
    expect(container.querySelector('dialog[open]')).toBeTruthy()
    expect(outer.checked).toBe(false)
    await act(async () => {
      select.value = 'Squox'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(current.lashuntaCreatureAlly).toBe('Squox')
    expect(outer.checked).toBe(true)
    expect(inner.checked).toBe(true)
    confirm.mockReturnValueOnce(false)
    await act(async () => outer.click())
    expect(current.lashuntaCreatureAlly).toBe('Squox')
    expect(outer.checked).toBe(true)
    confirm.mockReturnValue(true)
    await act(async () => inner.click())
    expect(current.lashuntaCreatureAlly).toBeUndefined()
    expect(outer.checked).toBe(false)
    expect(inner.checked).toBe(false)
    await act(async () => outer.click())
    expect(current.lashuntaCreatureAlly).toBe('Squox')
    expect(inner.checked).toBe(true)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    confirm.mockRestore()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
})

it('tracks Holo-Roger and shows its conditional Demoralize bonus only while active', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const initial: Character = { id: 'pirate', name: 'Test', systems: ['sf2e'], level: 2,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Space Pirate Dedication', type: 'Archetype Feat', level: 2 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  function Sheet() {
    const [c, setC] = useState(initial)
    const save = (patch: Partial<Character>) => setC(previous => ({ ...previous, ...patch }))
    return <><StatusesSummary c={c} entries={[]} save={save} /><StatusesContent c={c} entries={[]} save={save} />
      <SkillsSection c={c} entries={[]} save={save} /></>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    expect(container.querySelector('[aria-label="Holo-Roger options"] [aria-label="Free Action"]')).toBeTruthy()
    expect(container.textContent).not.toContain('while the holo-flag is projected on a starship')
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Holo-Roger status"]')!.click())
    expect(container.querySelector('summary')?.textContent).toContain('Holo-Roger')
    expect(container.querySelector<HTMLInputElement>('[aria-label="Holo-Roger active"]')?.checked).toBe(true)
    expect(container.textContent).toContain('While projected on a starship, gain a +1 circumstance bonus to Intimidation checks to Demoralize.')
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Holo-Roger active"]')!.click())
    expect(container.querySelector<HTMLInputElement>('[aria-label="Holo-Roger status"]')?.checked).toBe(false)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('selects Animal Feature effects from statuses with the active Persistent Animal Feature feat', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const previous = getSettings().championFormNoFlight
  updateSettings({ championFormNoFlight: false })
  const initial: Character = { id: 'animal', name: 'Test', systems: ['pf2e'], level: 8, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' },
      { name: 'Persistent Animal Feature', type: 'Class Feat', level: 8 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const spell: ContentEntry = { id: 'animal', name: 'Animal Feature', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 2, traits: ['Focus'], description: 'Animal feature rules.',
    data: { actions: 'Single Action', warden_spell_tier: 'Advanced' }, effects: [], updatedAt: 0 }
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    return <StatusesContent c={c} entries={[spell]} save={patch => setC(previous => ({ ...previous, ...patch }))} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Choose Animal Feature effects"]')!.click())
    for (const name of ['Claws', 'Jaws', 'Fish Tail', 'Owl Eyes', 'Wings']) {
      await act(async () => container.querySelector<HTMLInputElement>(`[aria-label="Animal Feature: ${name}"]`)!.click())
    }
    expect(activeAnimalFeatures(current, [spell])).toEqual(['Claws', 'Fish Tail', 'Jaws', 'Owl Eyes', 'Wings'])
    expect(activeAnimalFeatures({ ...current, level: 7 }, [spell])).toEqual(['Wings'])
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Animal Feature: Jaws"]')!.click())
    expect(activeAnimalFeatures(current, [spell])).not.toContain('Jaws')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    updateSettings({ championFormNoFlight: previous })
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
})

it('opens status options for Hunt Prey and Parry, with Favored Terrain controlled inline', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const initial: Character = { id: 'status-actions', name: 'Test', systems: ['pf2e'], level: 8, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Favored Terrain', type: 'Class Feat', level: 2, choice: 'Plains' }],
    weapons: [{ id: 'sword', name: 'Parry Sword', potency: 0, striking: 0, runes: [] }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const weapon: ContentEntry = { id: 'sword', name: 'Parry Sword', systems: ['pf2e'], kind: 'weapon',
    source: 'official', level: 1, traits: ['Parry'], description: '', data: { weapon_category: 'Martial', hands: 1 },
    effects: [], updatedAt: 0 }
  let current = initial
  function Sheet() {
    const [c, setC] = useState(initial)
    current = c
    return <StatusesContent c={c} entries={[weapon]} save={patch => setC(previous => ({ ...previous, ...patch }))} />
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    for (const name of ['Hunt Prey', 'Parry']) {
      const button = container.querySelector<HTMLButtonElement>(`[aria-label="${name} options"]`)!
      expect(button).toBeTruthy()
      await act(async () => button.click())
      const dialog = button.nextElementSibling!
      expect(dialog.hasAttribute('open')).toBe(true)
      expect(dialog.textContent).not.toContain('Description unavailable')
      await act(async () => dialog.querySelector<HTMLInputElement>(`[aria-label="${name} active in options"]`)!.click())
    }
    expect(current.huntPreyActive).toBe(true)
    expect(current.parrying).toBe(true)
    expect(container.querySelector('[aria-label="Favored Terrain options"]')).toBeNull()
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Favored Terrain status"]')!.click())
    expect(current.activeFeatEffects).toContain('Favored Terrain')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
})

it.each([false, true])('rolls and hides Oversized Throw damage without toggling its card (%s)', async displayOnly => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  const c: Character = { id: 'barbarian', name: 'Test', systems: ['pf2e'], level: 10, className: 'Barbarian',
    raging: true, abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Oversized Throw', type: 'Class Feat', level: 4 }], weapons: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const weapon = ownedWeapons(c, []).find(item => item.id === OVERSIZED_THROW.id)!
  const match = /^(\d+)d(\d+)([+-]\d+)?\s+bludgeoning$/.exec(weaponAttack(c, [], weapon).damage)!
  const expected = Number(match[1]) * (Math.floor(Number(match[2]) * 0.5) + 1) + Number(match[3] ?? 0)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<WeaponList c={c} entries={[]} save={() => {}} displayOnly={displayOnly} />))
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Roll Oversized Throw: Damage"]')!
    const card = button.closest('details')
    await act(async () => button.click())
    expect(container.querySelector('[aria-label="Oversized Throw: Damage result"]')?.textContent).toContain(`${expected} bludgeoning`)
    if (card) expect(card.open).toBe(true)
    await act(async () => button.click())
    expect(container.querySelector('[aria-label="Oversized Throw: Damage result"]')).toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

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
  const previous = getSettings().protectCompanionAll
  onTestFinished(() => updateSettings({ protectCompanionAll: previous }))
  updateSettings({ protectCompanionAll: false })
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
    const familiarDefenses = container.querySelector('[data-minion-name="Witch\'s Familiar"] .companion-actions')!
    expect(familiarDefenses.textContent).not.toContain('Protect Companion')
    expect(familiarDefenses.querySelector('input')).toBeNull()
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Protect Companion active"]')!.click())
    expect(familiarAc()).toBe(baseAc)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('synchronizes all-minion Protect Companion toggles', async () => {
  const previous = getSettings().protectCompanionAll
  onTestFinished(() => updateSettings({ protectCompanionAll: previous }))
  updateSettings({ protectCompanionAll: true })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const bear: ContentEntry = { id: 'bear', name: 'Bear', systems: ['pf2e'], kind: 'companion', source: 'official',
    level: 1, traits: [], description: '', data: { size: 'Small', hp: 8, dexterity: 2 }, effects: [], updatedAt: 0 }
  const initial: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 5, className: 'Witch',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    spells: [{ name: 'Protect Companion', rank: 0, cantrip: true }],
    companions: [{ id: 'bear', type: 'Bear', name: '' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  function Sheet() {
    const [c, setC] = useState(initial)
    const save = (patch: Partial<Character>) => setC(previous => ({ ...previous, ...patch }))
    return <><StatusesContent c={c} entries={[bear]} save={save} /><MinionsSection c={c} entries={[bear]} save={save} /></>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Sheet />))
    const toggles = () => [...container.querySelectorAll<HTMLInputElement>('input[aria-label^="Protect Companion"]')]
    expect(container.querySelector('[aria-label="Protect Companion target"]')).toBeNull()
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Protect Companion active"]')!.click())
    expect(toggles().length).toBeGreaterThan(0)
    expect(toggles().every(toggle => toggle.checked)).toBe(true)
    await act(async () => container.querySelector<HTMLInputElement>('[aria-label="Protect Companion active"]')!.click())
    expect(toggles().every(toggle => !toggle.checked)).toBe(true)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('rolls and hides requested spell damage', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const spells = [
    { name: 'Animal Allies', rank: 3, actions: 'Two Actions', label: 'Damage', expected: '9 piercing' },
    { name: 'Armor of Thorn and Claw', rank: 3, actions: 'Two Actions', label: 'Persistent bleed', expected: '2 persistent bleed' },
    { name: 'Avenging Wildwood', rank: 4, actions: 'Three Actions', label: 'Branches Strike', expected: '3 bludgeoning, piercing, or slashing' },
  ]
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    for (const spell of spells) {
      const entry: ContentEntry = { id: spell.name, name: spell.name, systems: ['pf2e'], kind: 'spell',
        source: 'official', level: 1, traits: [], description: '', data: { actions: spell.actions }, effects: [], updatedAt: 0 }
      await act(async () => root.render(<SpellActions name={spell.name} rank={spell.rank} entry={entry} />))
      const button = container.querySelector<HTMLButtonElement>(`[aria-label="Roll ${spell.name}: ${spell.label}"]`)!
      expect(button).toBeTruthy()
      await act(async () => button.click())
      expect(container.querySelector(`[aria-label="${spell.name}: ${spell.label} result"]`)?.textContent).toContain(spell.expected)
      await act(async () => button.click())
      expect(container.querySelector(`[aria-label="${spell.name}: ${spell.label} result"]`)).toBeNull()
    }
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
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
