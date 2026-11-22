import { beforeEach, expect, it, vi } from 'vitest'
import { loadRequiredCatalogs, readCatalog } from './catalogLoading'
import { ensureAonImported } from './aon'
import { db } from './db'
import type { ContentEntry } from './types'

vi.mock('./aon', () => ({ ensureAonImported: vi.fn() }))
vi.mock('./db', () => {
  const count = vi.fn()
  const toArray = vi.fn()
  return { db: { content: { toArray, where: () => ({ startsWith: () => ({ filter: () => ({ count }) }) }) } }, count }
})

beforeEach(() => vi.resetAllMocks())

it('waits for the requested import before reading the full catalog', async () => {
  const read = vi.mocked(db.content.toArray)
  expect(await readCatalog(true, ['pf2e'], 'old', 'character:pf2e:1'))
    .toEqual({ key: 'old', full: false, entries: [] })
  expect(read).not.toHaveBeenCalled()
  read.mockResolvedValue([])
  expect(await readCatalog(true, ['pf2e'], 'character:pf2e:1', 'character:pf2e:1'))
    .toEqual({ key: 'character:pf2e:1', full: true, entries: [] })
  expect(read).toHaveBeenCalledOnce()
})

it('still reads the catalog for a character without selected systems', async () => {
  const read = vi.mocked(db.content.toArray).mockResolvedValue([])
  expect(await readCatalog(true, ['pf2e'], 'previous', ''))
    .toEqual({ key: 'previous', full: true, entries: [] })
  expect(read).toHaveBeenCalledOnce()
})

it('filters and orders the catalog after loading', async () => {
  const entry: ContentEntry = { id: 'b', name: 'B', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 1 }
  vi.mocked(db.content.toArray).mockResolvedValue([
    entry, { ...entry, id: 'a', name: 'A' }, { ...entry, id: 'deleted', deleted: true },
    { ...entry, id: 'sf', systems: ['sf2e'] },
  ])
  const catalog = await readCatalog(true, ['pf2e'], 'ready', 'ready')
  expect(catalog.entries.map(item => item.id)).toEqual(['a', 'b'])
})

it('loads only requested catalogs and reports completion', async () => {
  vi.mocked(ensureAonImported).mockResolvedValue(10)
  const status = vi.fn()
  expect(await loadRequiredCatalogs(['pf2e'], status, () => true)).toBe(true)
  expect(ensureAonImported).toHaveBeenCalledTimes(1)
  expect(ensureAonImported).toHaveBeenCalledWith('pf2e', expect.any(Function))
  expect(status).toHaveBeenCalledWith('Loaded 10 pf2e entries from Archives of Nethys')
})

it('uses saved content after an import failure and surfaces the warning', async () => {
  vi.mocked(ensureAonImported).mockRejectedValue(new Error('offline'))
  const count = db.content.where('id').startsWith('aon:pf2e:').filter(() => true).count
  vi.mocked(count).mockResolvedValue(5)
  const status = vi.fn()
  expect(await loadRequiredCatalogs(['pf2e'], status, () => true)).toBe(true)
  expect(status).toHaveBeenCalledWith('Could not load pf2e content (offline); using saved data')
})

it('blocks editor loading if neither import nor cached content is available', async () => {
  vi.mocked(ensureAonImported).mockRejectedValue(new Error('offline'))
  const count = db.content.where('id').startsWith('aon:pf2e:').filter(() => true).count
  vi.mocked(count).mockResolvedValue(0)
  await expect(loadRequiredCatalogs(['pf2e'], vi.fn(), () => true)).rejects.toThrow('Could not load pf2e content (offline)')
})

it('stops loading additional systems when the request is no longer active', async () => {
  let active = true
  vi.mocked(ensureAonImported).mockImplementation(async () => { active = false; return 10 })
  expect(await loadRequiredCatalogs(['pf2e', 'sf2e'], vi.fn(), () => active)).toBe(false)
  expect(ensureAonImported).toHaveBeenCalledTimes(1)
})
