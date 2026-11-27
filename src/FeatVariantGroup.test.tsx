// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import * as builder from './builder'
import { SearchableFeatSlots } from './FeatSlots'
import { VERSATILE_THESIS_FEAT } from './arcaneTheses'
import type { Character, ContentEntry } from './types'

it('selects an available Versatile Thesis variant in a Wizard class feat slot', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const c: Character = { id: 'wizard', name: 'Test', systems: ['pf2e'], className: 'Wizard', level: 16,
    arcaneThesis: 'Spell Blending', abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<SearchableFeatSlots c={c} entries={[VERSATILE_THESIS_FEAT]} categories={['class']} save={save} />))
    await act(async () => {
      const section = container.querySelector('details')!
      section.open = true
      section.dispatchEvent(new Event('toggle'))
    })
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="L16 Class feat"]')!.click())
    const dialog = document.querySelector('[aria-label="L16 Class feat picker"]')!
    expect(dialog.textContent).not.toContain('Versatile Thesis (Spell Blending)')
    const choice = dialog.querySelector<HTMLButtonElement>('[aria-label="L16 Class: Versatile Thesis (Staff Nexus)"]')!
    await act(async () => choice.click())
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      feats: [expect.objectContaining({ name: 'Versatile Thesis', choice: 'Staff Nexus', slot: 'class:16:0' })],
    }))
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('pages expanded feat variants and selects a later choice', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const feat: ContentEntry = { id: 'choices', name: 'Unconventional Weaponry', kind: 'feat',
    source: 'official', systems: ['pf2e'], level: 1, traits: ['Human'], description: '', data: {}, effects: [], updatedAt: 0 }
  const entries = [feat, ...Array.from({ length: 125 }, (_, i): ContentEntry => ({
    ...feat, id: `choice-${i}`, name: `Choice ${String(i + 1).padStart(2, '0')}`,
    kind: 'weapon', traits: [], data: { weapon_category: 'Martial' },
  }))]
  const c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], className: 'Ranger', ancestry: 'Human', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<SearchableFeatSlots c={c} entries={entries} categories={['ancestry']} save={save} />))
    await act(async () => {
      const section = container.querySelector('details')!
      section.open = true
      section.dispatchEvent(new Event('toggle'))
    })
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="L01 Ancestry feat"]')!.click())
    const group = document.querySelector<HTMLDetailsElement>('.feat-variant-group')!
    expect(group.open).toBe(false)
    expect(group.querySelector('.feat-variant-list')).toBeNull()
    await act(async () => {
      group.open = true
      group.dispatchEvent(new Event('toggle'))
    })
    expect(group.querySelector('.feat-variant-list')).not.toBeNull()
    await act(async () => {
      group.open = false
      group.dispatchEvent(new Event('toggle'))
    })
    expect(group.querySelector('.feat-variant-list')).toBeNull()
    await act(async () => {
      group.open = true
      group.dispatchEvent(new Event('toggle'))
    })
    expect(group.querySelectorAll('.picker-option-row')).toHaveLength(100)
    const showMore = [...group.querySelectorAll('button')].find(button => button.textContent?.includes('Show more'))!
    expect(showMore.textContent).toContain('25 left')
    await act(async () => showMore.click())
    expect(group.querySelectorAll('.picker-option-row')).toHaveLength(125)
    const choice = group.querySelector<HTMLButtonElement>('[aria-label="L01 Ancestry: Unconventional Weaponry (Choice 125)"]')
    expect(choice).not.toBeNull()
    await act(async () => choice!.click())
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      feats: [expect.objectContaining({ name: feat.name, choice: 'Choice 125', slot: 'ancestry:1:0' })],
    }))
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('reuses feat-choice variants when ancestry search text changes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const entries = Array.from({ length: 150 }, (_, index): ContentEntry => ({
    id: `ancestry-${index}`, name: `Human Feat ${index}`, kind: 'feat',
    source: 'official', systems: ['pf2e'], level: 1, traits: ['Human'], description: '', data: {}, effects: [], updatedAt: 0,
  }))
  const c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], className: 'Ranger', ancestry: 'Human', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const choiceOptions = vi.spyOn(builder, 'featChoiceOptions')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<SearchableFeatSlots c={c} entries={entries} categories={['ancestry']} save={() => {}} />))
    await act(async () => {
      const section = container.querySelector('details')!
      section.open = true
      section.dispatchEvent(new Event('toggle'))
    })
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="L01 Ancestry feat"]')!.click())
    const callsAfterOpening = choiceOptions.mock.calls.length
    const input = document.querySelector<HTMLInputElement>('[aria-label="Search L01 Ancestry feats"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'no matching feat')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(choiceOptions).toHaveBeenCalled()
    const callsAfterFirstSearch = choiceOptions.mock.calls.length
    expect(callsAfterFirstSearch).toBeGreaterThan(callsAfterOpening)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'still no matching feat')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(choiceOptions).toHaveBeenCalledTimes(callsAfterFirstSearch)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})
