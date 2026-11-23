// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { SearchableFeatSlots } from './FeatSlots'
import type { Character, ContentEntry } from './types'

it('renders collapsed feat variants only when expanded and selects a choice', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const feat: ContentEntry = { id: 'choices', name: 'Unconventional Weaponry', kind: 'feat',
    source: 'official', systems: ['pf2e'], level: 1, traits: ['Human'], description: '', data: {}, effects: [], updatedAt: 0 }
  const entries = [feat, ...Array.from({ length: 12 }, (_, i): ContentEntry => ({
    ...feat, id: `choice-${i}`, name: `Choice ${String(i + 1).padStart(2, '0')}`,
    kind: 'weapon', traits: [], data: { weapon_category: 'Martial' },
  }))]
  const c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], className: 'Ranger', ancestry: 'Human', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<SearchableFeatSlots c={c} entries={entries} categories={['ancestry']} save={save} />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="L01 Ancestry feat"]')!.click())
    const group = document.querySelector<HTMLDetailsElement>('.feat-variant-group')!
    expect(group.open).toBe(false)
    expect(group.querySelector('.feat-variant-list')).toBeNull()
    await act(async () => {
      group.open = true
      group.dispatchEvent(new Event('toggle'))
    })
    expect(group.querySelector('.feat-variant-list')).not.toBeNull()
    await act(async () => {
      group.open = false
      group.dispatchEvent(new Event('toggle'))
    })
    expect(group.querySelector('.feat-variant-list')).toBeNull()
    await act(async () => {
      group.open = true
      group.dispatchEvent(new Event('toggle'))
    })
    const choice = group.querySelector<HTMLButtonElement>('[aria-label="L01 Ancestry: Unconventional Weaponry (Choice 02)"]')
    expect(choice).not.toBeNull()
    await act(async () => choice!.click())
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      feats: [expect.objectContaining({ name: feat.name, choice: 'Choice 02', slot: 'ancestry:1:0' })],
    }))
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
