// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { EntryDescription } from './EntryDescription'
import { SearchableSelect } from './SearchableSelect'
import { HuntPreyToggle } from './StatusesSection'
import type { Character, ContentEntry } from './types'

afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

it.each([['Ranger', undefined], ['Ranger', 'Vindication'], ['Rogue', 'Avenger']] as const)(
  'opens Hunt Prey from the %s class header without toggling the section', async (className, subclass) => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    } })
    const c: Character = { id: 'hunt-prey-header', name: 'Test', systems: ['pf2e'], level: 4, className, subclass,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
    const save = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try {
      await act(async () => root.render(<details><summary>Class <HuntPreyToggle c={c} entries={[]} save={save} summary /></summary></details>))
      const section = container.querySelector('details')!
      await act(async () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click())
      expect(section.open).toBe(false)
      expect(container.querySelector('dialog')?.open).toBe(true)
      expect(container.querySelector('dialog')?.textContent).toContain('Survival checks to Track it')
      expect(save).not.toHaveBeenCalled()
      await act(async () => container.querySelector<HTMLInputElement>('input[aria-label="Hunt Prey active"]')!.click())
      expect(section.open).toBe(false)
      expect(save).toHaveBeenCalledWith({ huntPreyActive: true })
    } finally {
      await act(async () => root.unmount())
    }
  },
)

it('opens deferred details with focus, follows links, and resets on close', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  } })
  const source: ContentEntry = {
    id: 'source', name: 'Source Feat', kind: 'feat', source: 'official', systems: ['pf2e'], level: 1,
    traits: [], description: 'Source rules.', data: {}, effects: [], updatedAt: 0,
    featLinks: [{ name: 'Next Feat', url: '/next' }],
  }
  const target: ContentEntry = { ...source, id: 'next', name: 'Next Feat', description: 'Next rules.',
    data: { url: '/next' }, featLinks: [] }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<EntryDescription name={source.name} entry={source}
    entries={[source, target]} buttonLabel="Details" deferDetails />))

  const button = container.querySelector<HTMLButtonElement>('button')!
  const dialog = container.querySelector<HTMLDialogElement>('dialog')!
  expect(dialog.textContent).toBe('')
  await act(async () => button.click())
  expect(dialog.open).toBe(true)
  expect(document.activeElement).toBe(dialog.querySelector('h4'))
  expect(dialog.textContent).toContain('Source rules.')
  const next = [...dialog.querySelectorAll('button')].find(item => item.textContent === 'Next Feat')!
  await act(async () => next.click())
  expect(dialog.textContent).toContain('Next rules.')
  await act(async () => dialog.close())
  expect(dialog.open).toBe(false)
  expect(dialog.textContent).toBe('')
  await act(async () => button.click())
  expect(dialog.textContent).toContain('Source rules.')
  expect(dialog.textContent).not.toContain('Next rules.')
  await act(async () => root.unmount())
})

it('opens deferred spell details inside a searchable picker without selecting the spell', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  } })
  const entry: ContentEntry = {
    id: 'spell', name: 'Test Spell', kind: 'spell', source: 'official', systems: ['pf2e'], level: 1,
    traits: [], description: 'Spell rules.', data: {}, effects: [], updatedAt: 0,
  }
  const change = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<SearchableSelect aria-label="Spell" value="" alwaysSearchable primaryDetails
    onChange={change} renderDetails={() => <EntryDescription name={entry.name} entry={entry} deferDetails />}>
    <option value="">Choose</option><option value={entry.id}>{entry.name}</option>
  </SearchableSelect>))
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Spell"]')!.click())
  const picker = document.querySelector<HTMLElement>('[role="dialog"]')!
  expect(picker.textContent).not.toContain('Spell rules.')
  const details = [...picker.querySelectorAll('button')].find(item => item.textContent === entry.name)!
  await act(async () => details.click())
  const dialog = picker.querySelector<HTMLDialogElement>('dialog')!
  expect(dialog.open).toBe(true)
  expect(dialog.textContent).toContain('Spell rules.')
  expect(document.activeElement).toBe(dialog.querySelector('h4'))
  expect(change).not.toHaveBeenCalled()
  await act(async () => dialog.close())
  expect(picker.querySelector('dialog')?.textContent).toBe('')
  await act(async () => root.unmount())
})
