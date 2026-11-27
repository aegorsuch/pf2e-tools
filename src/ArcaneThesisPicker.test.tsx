// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { Character } from './types'

const state = vi.hoisted(() => ({ character: undefined as Character | undefined }))
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => undefined }))
vi.mock('./db', async importOriginal => {
  const original = await importOriginal<typeof import('./db')>()
  return { ...original, db: {
    ...original.db,
    characters: {
      get: async () => state.character,
      put: async (character: Character) => { state.character = character },
    },
    transaction: async (_mode: string, _table: unknown, run: () => Promise<void>) => run(),
  } }
})

import { CharacterBuilder } from './CharacterBuilder'

it('selects and clears Wizard theses without changing feat slots', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  state.character = { id: 'wizard', systems: ['pf2e'], name: 'Test', level: 1, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const catalog: import('./types').ContentEntry[] = []
  const render = async () => act(async () => root.render(
    <CharacterBuilder character={state.character!} catalog={catalog} onClose={() => {}} />,
  ))
  try {
    await render()
    const section = [...container.querySelectorAll('details')].find(details =>
      details.querySelector(':scope > summary > strong')?.textContent === 'Class')!
    await act(async () => { section.open = true; section.dispatchEvent(new Event('toggle')) })
    const feats = [...section.querySelectorAll('details')].find(details =>
      details.querySelector(':scope > summary h4')?.textContent?.startsWith('Class Features & Feats'))!
    await act(async () => { feats.open = true; feats.dispatchEvent(new Event('toggle')) })
    const names = ['Improved Familiar Attunement', 'Metamagical Experimentation', 'Spell Blending', 'Spell Substitution', 'Staff Nexus']
    for (const name of names) {
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Arcane Thesis feat"]')!.click())
      const dialog = document.querySelector('[aria-label="Arcane Thesis feat picker"]')!
      expect([...dialog.querySelectorAll('.feat-modal-list button')].map(button => button.textContent)).toEqual(names)
      await act(async () => [...dialog.querySelectorAll('button')].find(button => button.textContent === name)!.click())
      expect(state.character!.arcaneThesis).toBe(name)
      expect(state.character!.feats).toEqual([])
      await render()
      expect(container.textContent).toContain(name)
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Clear Arcane Thesis"]')!.click())
      expect(state.character!.arcaneThesis).toBeUndefined()
      await render()
    }
    state.character = { ...state.character!, level: 16, arcaneThesis: 'Spell Blending' }
    await render()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="L16 Class feat"]')!.click())
    const featDialog = document.querySelector('[aria-label="L16 Class feat picker"]')!
    expect(featDialog.textContent).not.toContain('Versatile Thesis (Spell Blending)')
    await act(async () => featDialog.querySelector<HTMLButtonElement>('[aria-label="L16 Class: Versatile Thesis (Staff Nexus)"]')!.click())
    expect(state.character!.feats).toEqual([expect.objectContaining({ name: 'Versatile Thesis', choice: 'Staff Nexus' })])
    await render()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Clear Arcane Thesis"]')!.click())
    await render()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Arcane Thesis feat"]')!.click())
    expect(document.querySelector('[aria-label="Arcane Thesis feat picker"]')!.textContent).not.toContain('Staff Nexus')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
