import { afterEach, expect, it, vi } from 'vitest'
import { confirmRemoval } from './confirmRemoval'

afterEach(() => vi.unstubAllGlobals())

it.each([false, true])('removes only after confirmation: %s', (accepted) => {
  const confirm = vi.fn(() => accepted)
  vi.stubGlobal('window', { confirm })
  const remove = vi.fn()
  confirmRemoval('character "Test" and all its saved options', remove)
  expect(confirm).toHaveBeenCalledWith('Remove character "Test" and all its saved options?')
  expect(remove).toHaveBeenCalledTimes(accepted ? 1 : 0)
})

it('does not hide removal failures after confirmation', () => {
  vi.stubGlobal('window', { confirm: () => true })
  expect(() => confirmRemoval('homebrew "Test"', () => { throw new Error('Delete failed') })).toThrow('Delete failed')
})
