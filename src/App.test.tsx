// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { Character } from './types'

const state = vi.hoisted(() => ({ characters: [] as Character[] }))
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: (query: () => unknown) => {
  const result = query()
  return result instanceof Promise ? undefined : result
} }))
vi.mock('./db', () => ({
  db: { characters: { filter: () => ({ toArray: () => state.characters }) }, content: { toArray: () => [] } },
  ensureSupplementalContent: vi.fn().mockResolvedValue(undefined),
  newId: () => 'new-character', removeEntry: vi.fn(), saveEntry: vi.fn(),
}))
vi.mock('./catalogLoading', () => ({
  loadRequiredCatalogs: vi.fn().mockResolvedValue(true),
  readCatalog: (full: boolean, _enabled: unknown, key: string) => ({ entries: [], key, full }),
}))
vi.mock('./sync', () => ({
  onAuthChange: () => () => {}, signInWithGitHub: vi.fn(), signOut: vi.fn(), startAutoSync: vi.fn(), supabase: null,
}))
vi.mock('./CharacterBuilder', () => ({
  CharacterBuilder: ({ character, onClose }: { character: Character; onClose: () => void }) =>
    <div><h2>{character.name} sheet</h2><button type="button" onClick={onClose}>Back to characters</button></div>,
}))

import App from './App'
import * as builder from './builder'

it('defers character-list feat checks while editing and refreshes them on return', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.sessionStorage.clear()
  state.characters = [{ id: 'one', name: 'Lini', systems: ['pf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }]
  const checks = vi.spyOn(builder, 'hasRemainingFeatSelections')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<App />))
    expect(container.querySelector('[aria-label="Feat selections remaining"]')).not.toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Lini"]')!.click())
    await vi.waitFor(() => expect(container.textContent).toContain('Lini sheet'))
    checks.mockClear()
    const c = state.characters[0]
    state.characters = [{ ...c, feats: builder.plannedSlots(c).map(slot =>
      ({ name: 'Selected', type: 'Ancestry Feat', level: slot.level, slot: slot.key })) }]
    await act(async () => root.render(<App />))
    expect(checks).not.toHaveBeenCalled()
    const back = [...container.querySelectorAll('button')].find(button => button.textContent === 'Back to characters')!
    await act(async () => back.click())
    expect(checks).toHaveBeenCalled()
    expect(container.querySelector('[aria-label="Feat selections remaining"]')).toBeNull()
  } finally {
    await act(async () => root.unmount())
    checks.mockRestore()
    container.remove()
    window.sessionStorage.clear()
    vi.unstubAllGlobals()
  }
})

it('restores the open character after refresh and clears it when returning home', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.sessionStorage.clear()
  state.characters = [{ id: 'one', name: 'Lini', systems: ['pf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }]
  const container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  try {
    await act(async () => root.render(<App />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Lini"]')!.click())
    await vi.waitFor(() => expect(container.textContent).toContain('Lini sheet'))
    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(<App />))
    await vi.waitFor(() => expect(container.textContent).toContain('Lini sheet'))
    expect(container.querySelector('[aria-label="Edit Lini"]')).toBeNull()
    const back = [...container.querySelectorAll('button')].find(button => button.textContent === 'Back to characters')!
    await act(async () => back.click())
    expect(container.querySelector('[aria-label="Edit Lini"]')).not.toBeNull()
    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(<App />))
    expect(container.querySelector('[aria-label="Edit Lini"]')).not.toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    window.sessionStorage.clear()
    vi.unstubAllGlobals()
  }
})

it('returns home if the restored character no longer exists', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  state.characters = []
  window.sessionStorage.setItem('pf2e-tools:open-character', 'missing')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<App />))
    expect(container.textContent).toContain('The previously opened character is no longer available.')
    expect(container.textContent).toContain('Characters')
    expect(window.sessionStorage.getItem('pf2e-tools:open-character')).toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    window.sessionStorage.clear()
    vi.unstubAllGlobals()
  }
})
