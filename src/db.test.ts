import { beforeEach, expect, it, vi } from 'vitest'
import type { ContentEntry } from './types'

const mocks = vi.hoisted(() => {
  const content = {
    get: vi.fn(),
    add: vi.fn(),
    put: vi.fn(),
    where: vi.fn(() => ({
      anyOf: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
      equals: vi.fn(() => ({ filter: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })) })),
    })),
  }
  const characters = { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() }
  return { content, characters }
})

vi.mock('dexie', () => ({
  default: class {
    content = mocks.content
    characters = mocks.characters
    version() { return { stores: () => undefined } }
    async transaction(...args: unknown[]) {
      return (args[args.length - 1] as () => Promise<void>)()
    }
  },
}))

import { ensureSupplementalContent } from './db'
import { FIST, homebrewWeapons, PLASMA_ARRAY } from './supplemental'

const staleVersatileEnvoy = {
  id: 'homebrew:versatile-envoy',
  name: 'Versatile Envoy',
  kind: 'feat',
  source: 'homebrew',
  systems: ['sf2e'],
  level: 10,
  traits: ['Envoy'],
  description: '',
  data: { class: 'Envoy' },
  effects: [],
  updatedAt: 1,
}

const staleVersatileOperative = {
  id: 'homebrew:versatile-operative',
  name: 'Versatile Operative',
  kind: 'feat',
  source: 'homebrew',
  systems: ['sf2e'],
  level: 10,
  traits: ['Operative'],
  description: '',
  data: { class: 'Operative' },
  effects: [],
  updatedAt: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.content.get.mockImplementation(async (id: string) => {
    if (id === staleVersatileEnvoy.id) return { ...staleVersatileEnvoy }
    if (id === staleVersatileOperative.id) return { ...staleVersatileOperative }
    return undefined
  })
})

it('refreshes bundled Versatile Envoy metadata in existing installs', async () => {
  await ensureSupplementalContent()

  expect(mocks.content.put).toHaveBeenCalledWith(expect.objectContaining({
    id: staleVersatileEnvoy.id,
    data: expect.objectContaining({ repeatable: true }),
  }))
})

it('preserves user-edited Versatile Envoy content', async () => {
  mocks.content.get.mockResolvedValueOnce(undefined)
  mocks.content.get.mockImplementation(async (id: string) =>
    id === staleVersatileEnvoy.id ? { ...staleVersatileEnvoy, updatedAt: 2 } : undefined)

  await ensureSupplementalContent()

  expect(mocks.content.put).not.toHaveBeenCalledWith(expect.objectContaining({
    id: staleVersatileEnvoy.id,
  }))
})

it('refreshes bundled Versatile Operative metadata in existing installs', async () => {
  await ensureSupplementalContent()

  expect(mocks.content.put).toHaveBeenCalledWith(expect.objectContaining({
    id: staleVersatileOperative.id,
    data: expect.objectContaining({ repeatable: true }),
  }))
})

it('installs the bundled Plasma Array in existing databases', async () => {
  await ensureSupplementalContent()

  expect(mocks.content.add).toHaveBeenCalledWith(PLASMA_ARRAY)
})

it('refreshes generated Focus Rifle traits in existing installs', async () => {
  const laser: ContentEntry = { ...FIST, id: 'laser-rifle', name: 'Laser Rifle', systems: ['sf2e'],
    source: 'official', kind: 'weapon', level: 0, traits: ['Tech'], data: {
      weapon_category: 'Simple', weapon_group: 'Laser', weapon_type: 'Ranged', damage: '1d8 F',
      hands: 2, range: 100, reload: 1, upgrade_slots: 1, weapon_ammunition: '10 charges',
    } }
  const focus = homebrewWeapons([laser]).find(entry => entry.name === 'Laser Focus Rifle')!
  mocks.content.where.mockImplementationOnce(() => ({
    anyOf: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([laser]) })),
    equals: vi.fn(() => ({ filter: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })) })),
  }))
  mocks.content.get.mockImplementation(async (id: string) =>
    id === focus.id ? { ...focus, traits: ['Tech'] } : undefined)

  await ensureSupplementalContent()

  expect(mocks.content.put).toHaveBeenCalledWith(expect.objectContaining({
    id: focus.id, traits: expect.arrayContaining(['Unwieldy', 'Volley 30 ft.']),
  }))
})
