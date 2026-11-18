import { afterEach, expect, it, vi } from 'vitest'
import { AON_IMPORT_VERSION, importFromAon } from './aon'

const stored = vi.hoisted(() => ({ bulkPut: vi.fn() }))
vi.mock('./db', () => ({
  db: { content: {
    where: () => ({ startsWith: () => ({ filter: () => ({ toArray: async () => [] }) }) }),
    bulkPut: stored.bulkPut,
  } },
  ensureSupplementalContent: async () => {},
}))
afterEach(() => vi.unstubAllGlobals())

it('imports fresh versioned snapshots rather than marking stale runtime-cached summaries as current', async () => {
  const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'https://example.com')
    return new Response(JSON.stringify([{ _id: 'human', _source: {
      name: 'Human', category: 'ancestry', summary: 'Old summary.',
      ...(url.searchParams.get('v') === AON_IMPORT_VERSION ? { about: 'Complete new introduction.' } : {}),
    } }]), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchFn)
  expect(await importFromAon('pf2e')).toBe(1)
  expect(fetchFn).toHaveBeenCalledTimes(1)
  expect(new URL(String(fetchFn.mock.calls[0][0]), 'https://example.com').searchParams.get('v')).toBe(AON_IMPORT_VERSION)
  expect(stored.bulkPut).toHaveBeenCalledWith([expect.objectContaining({ description: 'Complete new introduction.' })])
})
