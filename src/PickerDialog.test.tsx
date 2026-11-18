import { useEffect, useRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { PickerDialog } from './PickerDialog'

vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useEffect: vi.fn(), useRef: vi.fn() }
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it.each([true, false])('keeps viewport still when opening and closing a picker (trigger connected: %s)', connected => {
  class Trigger {
    isConnected = connected
    focus = vi.fn()
  }
  const previous = new Trigger()
  const search = { focus: vi.fn() }
  vi.mocked(useRef).mockReturnValueOnce({ current: null })
    .mockReturnValueOnce({ current: search }).mockReturnValueOnce({ current: () => {} })
  PickerDialog({ label: 'Ancestry picker', searchLabel: 'Search feats', query: '', onQuery: () => {}, onClose: () => {}, children: null })
  vi.stubGlobal('HTMLElement', Trigger)
  vi.stubGlobal('document', { activeElement: previous })
  const setup = vi.mocked(useEffect).mock.calls[1][0]
  const cleanup = setup()
  expect(search.focus).toHaveBeenCalledWith({ preventScroll: true })
  if (typeof cleanup !== 'function') throw new Error('Missing focus cleanup')
  cleanup()
  if (connected) expect(previous.focus).toHaveBeenCalledWith({ preventScroll: true })
  else expect(previous.focus).not.toHaveBeenCalled()
})
