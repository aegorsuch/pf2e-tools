import { beforeEach, expect, it, vi } from 'vitest'
import { loadRequiredCatalogs, readCatalog } from './catalogLoading'
import { ensureAonImported } from './aon'
import { db } from './db'
import type { ContentEntry } from './types'

vi.mock('./aon', () => ({ ensureAonImported: vi.fn() }))
vi.mock('./db', () => {
  const count = vi.fn()
  const toArray = vi.fn()
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  query.anyOf = vi.fn(() => query)
  query.distinct = vi.fn(() => query)
  query.equals = vi.fn(() => query)
  query.filter = vi.fn(() => query)
  query.startsWith = vi.fn(() => query)
  query.toArray = toArray
  query.count = count
  const where = vi.fn(() => query)
  return { db: { content: { toArray, where } }, count, where }
})

beforeEach(() => vi.resetAllMocks())

it('waits for the requested import before reading the full catalog', async () => {
  const where = vi.mocked(db.content.where)
  expect(await readCatalog(true, ['pf2e'], 'old', 'character:pf2e:1'))
    .toEqual({ key: 'old', full: false, entries: [] })
  expect(where).not.toHaveBeenCalled()
  vi.mocked(db.content.where('systems').anyOf('pf2e').distinct().toArray).mockResolvedValue([])
  expect(await readCatalog(true, ['pf2e'], 'character:pf2e:1', 'character:pf2e:1'))
    .toEqual({ key: 'character:pf2e:1', full: true, entries: [] })
  expect(where).toHaveBeenCalledWith('systems')
})

it('still reads the catalog for a character without selected systems', async () => {
  const query = vi.mocked(db.content.where('systems').anyOf('pf2e').distinct().toArray).mockResolvedValue([])
  expect(await readCatalog(true, ['pf2e'], 'previous', ''))
    .toEqual({ key: 'previous', full: true, entries: [] })
  expect(query).toHaveBeenCalledOnce()
})

it('filters and orders the catalog after loading', async () => {
  const entry: ContentEntry = { id: 'b', name: 'B', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 1 }
  vi.mocked(db.content.where('systems').anyOf('pf2e').distinct().toArray).mockResolvedValue([
    entry, { ...entry, id: 'a', name: 'A' }, { ...entry, id: 'deleted', deleted: true },
    { ...entry, id: 'sf', systems: ['sf2e'] },
  ])
  const catalog = await readCatalog(true, ['pf2e'], 'ready', 'ready')
  expect(catalog.entries.map(item => item.id)).toEqual(['a', 'b'])
  expect(db.content.where).toHaveBeenCalledWith('systems')
})

it('keeps starter catalog limited to homebrew and enabled-system classes', async () => {
  const pf2eFeat: ContentEntry = { id: 'feat', name: 'Feat', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 1 }
  const sf2eClass: ContentEntry = { ...pf2eFeat, id: 'class', name: 'Class', kind: 'class', systems: ['sf2e'] }
  const pf2eClass: ContentEntry = { ...pf2eFeat, id: 'class-pf2e', name: 'Class', kind: 'class' }
  const homebrew: ContentEntry = { ...pf2eFeat, id: 'homebrew', source: 'homebrew', systems: ['pf2e', 'sf2e'] }
  vi.mocked(db.content.where('source').equals('homebrew').toArray)
    .mockResolvedValueOnce([homebrew])
    .mockResolvedValueOnce([sf2eClass, pf2eClass])
  const catalog = await readCatalog(false, ['pf2e'], '', '')
  expect(catalog.entries.map(item => item.id)).toEqual(['class-pf2e', 'homebrew'])
  expect(db.content.where('kind').anyOf).toHaveBeenCalledWith('class', 'ancestry', 'subclass')
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
