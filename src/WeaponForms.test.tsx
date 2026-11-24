// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { WeaponList } from './GearSection'
import type { Character, ContentEntry } from './types'

it('opens a form trait without toggling the weapon card and keeps the form selector usable', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const melee: ContentEntry = { id: 'melee', name: 'Test Combination (Melee)', kind: 'weapon', source: 'official',
    systems: ['pf2e'], level: 0, traits: ['Combination', 'Sweep'], description: '', effects: [], updatedAt: 0,
    data: { url: 'same', hands: 2, weapon_category: 'Martial', weapon_type: 'Melee', damage: '1d6 bludgeoning' } }
  const ranged: ContentEntry = { ...melee, id: 'ranged', name: 'Test Combination (Ranged)',
    traits: ['Combination', 'Deadly d8'], data: { ...melee.data, weapon_type: 'Ranged', range: 80, damage: '1d6 piercing' } }
  let c: Character = { id: 'forms', name: 'Forms', systems: ['pf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    weapons: [{ id: 'weapon', name: melee.name, potency: 0, striking: 0, runes: [] }] }
  const entries = [melee, ranged]
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  try {
    await act(async () => root.render(<WeaponList c={c} entries={entries} save={save} />))
    const card = container.querySelector<HTMLDetailsElement>('details[aria-label="Test Combination"]')!
    const trait = [...card.querySelectorAll<HTMLButtonElement>('summary button')].find(button => button.textContent === 'Sweep')!
    expect(card.open).toBe(true)
    await act(async () => trait.click())
    expect(card.open).toBe(true)
    expect(trait.parentElement?.querySelector('dialog[open]')).toBeTruthy()
    const select = card.querySelector<HTMLSelectElement>('[aria-label="Combination form: Test Combination"]')!
    await act(async () => { select.value = 'Ranged'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(c.weapons?.[0].combinationForm).toBe('Ranged')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
})
