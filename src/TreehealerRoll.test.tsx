// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { FeatSlots } from './FeatSlots'
import type { Character, ContentEntry } from './types'

it('hides Treehealer healing when its roll button is clicked again', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const treehealer: ContentEntry = { id: 'treehealer', systems: ['pf2e'], kind: 'feat', source: 'official',
    name: 'Treehealer', level: 17, traits: ['Elf'], description: 'Heal a plant creature.', data: {},
    effects: [], updatedAt: 0 }
  const c: Character = { id: 'treehealer-test', systems: ['pf2e'], name: 'Test', level: 17, className: 'Ranger',
    ancestry: 'Elf', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Treehealer', type: 'Ancestry Feat', level: 17, slot: 'ancestry:17:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<FeatSlots c={c} entries={[treehealer]} categories={['ancestry']} save={() => {}} />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Roll Treehealer: Healing"]')!.click())
    expect(container.querySelector('[aria-label="Treehealer healing result"]')).not.toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Hide Treehealer healing"]')!.click())
    expect(container.querySelector('[aria-label="Treehealer healing result"]')).toBeNull()
    expect(container.querySelector('[aria-label="Roll Treehealer: Healing"]')).not.toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
