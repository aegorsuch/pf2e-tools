import { beforeEach, expect, it, vi } from 'vitest'

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

beforeEach(() => {
  vi.clearAllMocks()
  mocks.content.get.mockImplementation(async (id: string) =>
    id === staleVersatileEnvoy.id ? { ...staleVersatileEnvoy } : undefined)
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
