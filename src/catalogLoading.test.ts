import { beforeEach, expect, it, vi } from 'vitest'
import { loadRequiredCatalogs } from './catalogLoading'
import { ensureAonImported } from './aon'
import { db } from './db'

vi.mock('./aon', () => ({ ensureAonImported: vi.fn() }))
vi.mock('./db', () => {
  const count = vi.fn()
  return { db: { content: { where: () => ({ startsWith: () => ({ filter: () => ({ count }) }) }) } }, count }
})

beforeEach(() => vi.resetAllMocks())

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
