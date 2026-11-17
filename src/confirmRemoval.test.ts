import { afterEach, expect, it, vi } from 'vitest'
import { confirmRemoval } from './confirmRemoval'

afterEach(() => vi.unstubAllGlobals())

it.each([false, true])('removes only after confirmation: %s', (accepted) => {
  const confirm = vi.fn(() => accepted)
  vi.stubGlobal('window', { confirm, dispatchEvent: vi.fn() })
  const remove = vi.fn()
  confirmRemoval('character "Test" and all its saved options', remove)
  expect(confirm).toHaveBeenCalledWith('Remove character "Test" and all its saved options?')
  expect(remove).toHaveBeenCalledTimes(accepted ? 1 : 0)
})

it('announces confirmed removals so they can be undone', () => {
  const dispatchEvent = vi.fn()
  vi.stubGlobal('window', { confirm: () => true, dispatchEvent })
  confirmRemoval('gear "Rope"', vi.fn())
  expect(dispatchEvent.mock.calls[0][0].detail).toBe('gear "Rope"')
})

it('does not hide removal failures after confirmation', () => {
  vi.stubGlobal('window', { confirm: () => true, dispatchEvent: vi.fn() })
  expect(() => confirmRemoval('homebrew "Test"', () => { throw new Error('Delete failed') })).toThrow('Delete failed')
})
