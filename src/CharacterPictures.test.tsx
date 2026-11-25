// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { CharacterPictures } from './CharacterPictures'
import { processCharacterPicture } from './characterPictureData'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('resizes uploaded pictures and saves them as compact WebP data', async () => {
  const bitmap = { width: 2400, height: 1200, close: vi.fn() }
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
  const drawImage = vi.fn()
  const context = new Proxy(Object.create(null) as CanvasRenderingContext2D, {
    get: (_target, property) => property === 'drawImage' ? drawImage : undefined,
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/webp;base64,AA==')

  const picture = await processCharacterPicture(new File(['image'], 'portrait.png', { type: 'image/png' }))

  expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1280, 640)
  expect(toDataURL).toHaveBeenCalledWith('image/webp', 0.82)
  expect(picture).toMatchObject({ name: 'portrait', dataUrl: 'data:image/webp;base64,AA==' })
  expect(picture.id).toBeTruthy()
  expect(bitmap.close).toHaveBeenCalledOnce()
})

it('saves one selected picture as the character picture', async () => {
  const bitmap = { width: 800, height: 600, close: vi.fn() }
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy(
    Object.create(null) as CanvasRenderingContext2D,
    { get: (_target, property) => property === 'drawImage' ? vi.fn() : undefined },
  ))
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,AA==')

  const save = vi.fn().mockResolvedValue(undefined)
  const container = document.createElement('div')
  const root = createRoot(container)
  await act(async () => root.render(<CharacterPictures save={save} />))
  const input = container.querySelector<HTMLInputElement>('input[type="file"][aria-label="Character picture"]')
  if (!input) throw new Error('Missing picture upload control')
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [new File(['image'], 'portrait.png', { type: 'image/png' })],
  })

  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    name: 'portrait',
    dataUrl: 'data:image/webp;base64,AA==',
  }))
  expect(save).toHaveBeenCalledOnce()
  await act(async () => root.unmount())
})
