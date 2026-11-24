// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { mapAonHit } from './aon'
import snapshot from '../public/data/aon-pf2e.json?raw'
import { ArmorList } from './GearSection'
import type { Character } from './types'

const hits: Parameters<typeof mapAonHit>[0][] = JSON.parse(snapshot)
const entries = ['Rebounding Breastplate', 'Breastplate', 'Full Plate', 'Bastion Plate'].map(name =>
  mapAonHit(hits.find(hit => hit._source?.name === name)!, 'pf2e')!)
const base: Character = { id: 'kinetic-pulse', name: 'Test', systems: ['pf2e'], level: 20,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }

it.each(['Rebounding Breastplate', 'Rebounding Full Plate', 'Rebounding Bastion Plate'])(
  'rolls Kinetic Pulse from the %s action icon', async name => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const armor = { id: 'armor', name, worn: true, potency: 0, resilient: 0, runes: [] }
    const render = (worn: boolean) => root.render(<ArmorList c={{ ...base, armors: [{ ...armor, worn }] }}
      entries={entries} save={() => {}} part="armor" />)
    try {
      await act(async () => render(true))
      const button = container.querySelector<HTMLButtonElement>('[aria-label="Roll Kinetic Pulse: Damage"]')!
      expect(button.title).toContain('12d6 force')
      expect(button.disabled).toBe(false)
      const details = button.closest('details')!
      expect(details.open).toBe(false)
      await act(async () => button.click())
      expect(container.querySelector('[aria-label="Kinetic Pulse: Damage result"]')?.textContent).toContain('12 force')
      expect(details.open).toBe(false)
      await act(async () => button.click())
      expect(container.querySelector('[aria-label="Kinetic Pulse: Damage result"]')).toBeNull()
      await act(async () => render(false))
      expect(container.querySelector<HTMLButtonElement>('[aria-label="Roll Kinetic Pulse: Damage"]')?.disabled).toBe(true)
    } finally {
      await act(async () => root.unmount())
      container.remove()
      random.mockRestore()
      vi.unstubAllGlobals()
    }
  })
