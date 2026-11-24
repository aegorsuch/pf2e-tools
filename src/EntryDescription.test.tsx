// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { EntryDescription } from './EntryDescription'
import { SearchableSelect } from './SearchableSelect'
import { HuntPreyToggle } from './StatusesSection'
import { FeatSlots } from './FeatSlots'
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

it('opens selected feat details after an unrelated slot update', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const feat: ContentEntry = { id: 'selected', name: 'Selected Feat', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 1, traits: ['Human'], description: 'Selected feat rules.', data: {}, effects: [], updatedAt: 0 }
  const c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 1, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: feat.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = (character: Character) => <FeatSlots c={character} entries={[feat]} categories={['ancestry']}
    save={() => {}} search={{}} onSearch={() => {}} />
  try {
    await act(async () => root.render(render(c)))
    expect(container.textContent).not.toContain('Selected feat rules.')
    await act(async () => root.render(render({ ...c, extraSlots: [{ category: 'ancestry', level: 1, count: 1 }] })))
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === feat.name)!
    await act(async () => button.click())
    expect(button.parentElement?.querySelector('dialog')?.open).toBe(true)
    expect(button.parentElement?.querySelector('dialog')?.textContent).toContain('Selected feat rules.')
  } finally { await act(async () => root.unmount()) }
})

it.each([false, true])('shows the chosen spell in %s feat details', async (deferred) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const feat: ContentEntry = { id: 'mask', name: 'Mask of Power', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 5, traits: ['Orc'], description: 'Mask rules.', data: {}, effects: [], updatedAt: 0 }
  const spell: ContentEntry = { ...feat, id: 'fear', name: 'Fear', kind: 'spell', level: 1,
    description: 'Fear spell rules.', traits: [] }
  const c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 5, ancestry: 'Orc',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: feat.name, type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: spell.name }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    const render = (entry: ContentEntry, choice: string) => <EntryDescription name={entry.name} entry={entry} choice={choice}
      character={c} entries={[feat, spell]} deferDetails={deferred} />
    await act(async () => root.render(render(feat, 'Fear')))
    expect(container.querySelector('dialog')?.textContent).not.toContain('Fear spell rules.')
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
    expect(container.querySelector('dialog')?.textContent).toContain('Mask rules.')
    expect(container.querySelector('dialog')?.textContent).toContain('Fear: Fear spell rules.')
    await act(async () => root.render(render({ ...feat, name: 'Unrelated Feat' }, 'Fear')))
    expect(container.querySelector('dialog')?.textContent).not.toContain('Fear spell rules.')
  } finally { await act(async () => root.unmount()) }
})

it('shows spell rules for the specific feat variant before selection', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const feat: ContentEntry = { id: 'mask', name: 'Mask of Power', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 5, traits: ['Orc'], description: 'Mask rules.', data: {}, effects: [], updatedAt: 0 }
  const fear: ContentEntry = { ...feat, id: 'fear', name: 'Fear', kind: 'spell', level: 1,
    description: 'Fear rules.', traits: [] }
  const pain: ContentEntry = { ...fear, id: 'pain', name: 'Phantom Pain', description: 'Pain rules.' }
  const c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 5, ancestry: 'Orc',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], spells: [{ name: 'Fear', rank: 1, cantrip: false, entryId: 'fear' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<FeatSlots c={c} entries={[feat, fear, pain]} categories={['ancestry']} save={() => {}}
      search={{ 'ancestry:5:0:open': '1' }} onSearch={() => {}} />))
    expect(document.querySelector('[aria-label="L05 Ancestry: Mask of Power (Fear)"]')).toBeNull()
    const option = document.querySelector<HTMLButtonElement>('[aria-label="L05 Ancestry: Mask of Power (Phantom Pain)"]')!
    const details = option.closest('li')!.querySelector<HTMLButtonElement>('[aria-label="Details: Mask of Power"]')!
    await act(async () => details.click())
    const dialog = details.parentElement!.querySelector('dialog')!
    expect(dialog.textContent).toContain('Phantom Pain: Pain rules.')
    expect(dialog.textContent).not.toContain('Fear rules.')
  } finally { await act(async () => root.unmount()) }
})

it.each([[3, 1, 2], [4, 3, 6]])('rolls Battle Prayer with Religion rank %i', async (rank, success, critical) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const feat: ContentEntry = { id: 'battle-prayer', name: 'Battle Prayer', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 7, traits: ['General', 'Skill'], description: 'Prayer rules.',
    data: { actions: 'Single Action' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 15, rankOverrides: { Religion: rank },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: feat.name, type: 'Skill Feat', level: 7, slot: 'skill:8:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<FeatSlots c={c} entries={[feat]} categories={['skill']} save={() => {}} search={{}} onSearch={() => {}} />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Roll Battle Prayer"]')!.click())
    const result = container.querySelector('output[aria-label="Battle Prayer result"]')!
    expect(result.textContent).toContain('Religion d20: 1')
    expect(result.textContent).toContain(`success: ${success} alignment damage`)
    expect(result.textContent).toContain(`critical success: ${critical} alignment damage`)
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Hide Battle Prayer result"]')!.click())
    expect(container.querySelector('output')).toBeNull()
    await act(async () => root.render(<FeatSlots c={{ ...c, level: 6 }} entries={[feat]} categories={['skill']} save={() => {}} search={{}} onSearch={() => {}} />))
    expect(container.querySelector('[aria-label="Roll Battle Prayer"]')).toBeNull()
  } finally { await act(async () => root.unmount()) }
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
