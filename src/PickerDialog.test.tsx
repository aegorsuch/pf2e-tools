import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { PickerDialog } from './PickerDialog'

vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useEffect: vi.fn(), useRef: vi.fn() }
})
vi.mock('react-dom', async importOriginal => {
  const reactDom = await importOriginal<typeof import('react-dom')>()
  return { ...reactDom, createPortal: vi.fn() }
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it('places a nested picker inside its native dialog and closes it on Escape', () => {
  const parent = {} as HTMLElement
  const close = vi.fn()
  const panel = { contains: vi.fn(() => false) }
  vi.mocked(useRef).mockReturnValueOnce({ current: panel })
    .mockReturnValueOnce({ current: null }).mockReturnValueOnce({ current: close })
  const body = {}
  vi.stubGlobal('document', { body })
  PickerDialog({ label: 'Learn dirge spell picker', searchLabel: 'Search', query: '', onQuery: () => {},
    onClose: close, children: null, container: parent })
  const [backdrop, target] = vi.mocked(createPortal).mock.calls[0]
  expect(target).toBe(parent)
  class Target { closest = () => parent }
  vi.stubGlobal('Element', Target)
  const content = backdrop as React.ReactElement<{ children: React.ReactElement<{ onKeyDown: (event: unknown) => void }> }>
  const event = { target: new Target(), key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() }
  content.props.children.props.onKeyDown(event)
  expect(event.preventDefault).toHaveBeenCalled()
  expect(event.stopPropagation).toHaveBeenCalled()
  expect(close).toHaveBeenCalledOnce()
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
