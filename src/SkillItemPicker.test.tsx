// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { SkillItemPicker } from './SkillItemPicker'
import type { Character, ContentEntry } from './types'

afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

it('opens a skill-filtered picker, adds equipment, and closes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close', { bubbles: true }))
  } })
  const c: Character = { id: 'picker', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const boots: ContentEntry = { id: 'boots', name: 'Boots', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: '+2 item bonus to Acrobatics checks.', data: {}, effects: [], updatedAt: 0 }
  const armbands = { ...boots, id: 'armbands', name: 'Armbands', description: '+2 item bonus to Athletics checks.' }
  const save = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<SkillItemPicker c={c} entries={[boots, armbands]} save={save} skill="Acrobatics" value="+0" />))
  const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Acrobatics item bonus equipment"]')!
  const dialog = container.querySelector<HTMLDialogElement>('dialog')!
  expect(dialog.querySelector('input')).toBeNull()
  await act(async () => trigger.click())
  expect(dialog.open).toBe(true)
  expect(dialog.querySelector('[aria-label="Add Boots"]')).not.toBeNull()
  expect(dialog.querySelector('.gear-results li')?.textContent).toContain('(+2)')
  expect(dialog.querySelector('[aria-label="Add Armbands"]')).toBeNull()
  await act(async () => dialog.querySelector<HTMLButtonElement>('.equipment-name')!.click())
  const details = dialog.querySelector<HTMLDialogElement>('.entry-dialog')!
  expect(details.open).toBe(true)
  await act(async () => details.close())
  expect(dialog.open).toBe(true)
  expect(dialog.querySelector('[aria-label="Add Boots"]')).not.toBeNull()
  await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Add Boots"]')!.click())
  expect(save).toHaveBeenCalledWith({ equipment: [{ name: 'Boots', qty: 1 }] })
  expect(dialog.open).toBe(false)
  await act(async () => trigger.click())
  await act(async () => [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Cancel')!.click())
  expect(dialog.open).toBe(false)
  await act(async () => root.unmount())
})
