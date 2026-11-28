// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { pushBackLayer } from './backLayers'

afterEach(() => vi.restoreAllMocks())

it('closes the top overlay on back instead of leaving the current view', async () => {
  const close = vi.fn()
  window.history.replaceState({ pfChar: true }, '')
  const release = pushBackLayer(close)
  expect(window.history.state).toMatchObject({ pfChar: true })
  expect(window.history.state.pfLayer).toBeTypeOf('number')
  window.history.back()
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(close).toHaveBeenCalledTimes(1)
  expect(window.history.state).toEqual({ pfChar: true })
  release()
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(close).toHaveBeenCalledTimes(1)
})
