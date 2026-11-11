import { afterEach, expect, it, vi } from 'vitest'
import { refreshApp } from './refresh'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('reloads normally when service workers are unavailable', async () => {
  const reload = vi.fn()
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('window', { location: { reload } })
  await refreshApp()
  expect(reload).toHaveBeenCalledOnce()
})

it('reloads cached app offline without checking for updates', async () => {
  const reload = vi.fn()
  const getRegistration = vi.fn()
  vi.stubGlobal('navigator', { onLine: false, serviceWorker: { getRegistration } })
  vi.stubGlobal('window', { location: { reload } })
  await refreshApp()
  expect(getRegistration).not.toHaveBeenCalled()
  expect(reload).toHaveBeenCalledOnce()
})

it('activates waiting update before reloading', async () => {
  const reload = vi.fn()
  const worker = Object.assign(new EventTarget(), {
    state: 'installed',
    postMessage: vi.fn(() => {
      worker.state = 'activated'
      worker.dispatchEvent(new Event('statechange'))
    }),
  })
  const update = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', {
    onLine: true,
    serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ update, waiting: worker }) },
  })
  vi.stubGlobal('window', { location: { reload } })
  await refreshApp()
  expect(update).toHaveBeenCalledOnce()
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  expect(reload).toHaveBeenCalledOnce()
})

it('reports update failures without reloading', async () => {
  const reload = vi.fn()
  vi.stubGlobal('navigator', {
    onLine: true,
    serviceWorker: {
      getRegistration: vi.fn().mockResolvedValue({
        update: vi.fn().mockRejectedValue(new Error('Network failed')),
      }),
    },
  })
  vi.stubGlobal('window', { location: { reload } })
  await expect(refreshApp()).rejects.toThrow('Network failed')
  expect(reload).not.toHaveBeenCalled()
})
