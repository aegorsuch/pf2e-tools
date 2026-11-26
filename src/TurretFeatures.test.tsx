// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { TurretFeatures } from './MechanicFeatures'
import { turretWeapon } from './mechanicTurret'
import type { Character } from './types'

it('selects unique extra arrays and rolls both Self-destruct damage types', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  let c: Character = { id: 'm', name: 'Mechanic', systems: ['sf2e'], className: 'Mechanic', subclass: 'Turret', level: 8,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Expansive Array', type: 'Class Feat', level: 8, slot: 'class:8:0' },
      { name: 'Self-destruct', type: 'Class Feat', level: 4, slot: 'class:4:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = () => root.render(<TurretFeatures c={c} entries={[]} save={patch => { c = { ...c, ...patch } }} />)
  try {
    await act(async () => render())
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Expansive Array 1"]')!
    await act(async () => { select.value = 'Mental Array'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(c.mechanicTurretExtraArrays).toEqual(['Mental Array'])
    await act(async () => render())
    expect(container.querySelector<HTMLOptionElement>('[aria-label="Expansive Array 2"] option[value="Mental Array"]')?.disabled).toBe(true)
    const array = container.querySelector<HTMLSelectElement>('[aria-label="Turret array"]')!
    await act(async () => { array.value = 'Mental Array'; array.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(turretWeapon(c, [])?.entry.data.damage).toBe('2d8 mental')
    await act(async () => render())
    const roll = container.querySelector<HTMLButtonElement>('[aria-label="Roll Self-destruct: Damage and Fire damage"]')!
    expect(roll.title).toContain('3d6 piercing')
    expect(roll.title).toContain('3d6 fire')
    await act(async () => roll.click())
    expect(container.querySelector('output')?.textContent).toContain('3 piercing')
    expect(container.querySelector('output')?.textContent).toContain('3 fire')
    expect(turretWeapon({ ...c, feats: [] }, [])).toBeUndefined()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})
