import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AbilitiesSection, AbilityBoostChoices } from './AbilitiesSection'
import { computeAbilities, type SectionProps } from './builder'
import type { Character, ContentEntry } from './types'

const entry = (kind: ContentEntry['kind'], name: string, attribute: string): ContentEntry => ({
  id: name, systems: ['pf2e'], kind, source: 'official', name, level: 1, traits: [], description: '',
  data: { attribute }, effects: [], updatedAt: 1,
})

const entries = [
  entry('ancestry', 'Human', 'Two free ability boosts'),
  entry('background', 'Scout', 'Dexterity, Wisdom'),
  entry('class', 'Ranger', 'Dexterity, Strength'),
]

const character: Character = {
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, ancestry: 'Human', background: 'Scout', className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, boosts: {},
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

function findElement(node: ReactNode, predicate: (type: unknown, props: Record<string, unknown>) => boolean): Record<string, unknown> | undefined {
  let result: Record<string, unknown> | undefined
  Children.forEach(node, (child) => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    result = predicate(child.type, child.props) ? child.props : findElement(child.props.children as ReactNode, predicate)
  })
  return result
}

function checkbox(props: SectionProps, groups: string[], label: string) {
  const tree = AbilityBoostChoices({ ...props, groups })
  const found = findElement(tree, (type, p) => type === 'input' && p['aria-label'] === label)
  expect(found).toBeDefined()
  return found as { checked: boolean; disabled: boolean; className?: string; onChange: () => void }
}

describe('ability score boost controls', () => {
  it('shows ancestry, background, and class boosts alongside free boosts', () => {
    const markup = renderToStaticMarkup(<AbilitiesSection c={character} entries={entries} save={() => {}} />)
    expect(markup).toContain('Ancestry Boosts')
    expect(markup).toContain('Background Boosts')
    expect(markup).toContain('L01 Boosts')
    expect(markup).toContain('Class Boost')
    expect(markup).not.toContain('<select')
    expect(markup.match(/type="checkbox"/g)).toHaveLength(24)
  })

  it('shows fixed class boosts in ability scores', () => {
    const fixedEntries = [...entries, entry('class', 'Wizard', 'Intelligence')]
    const c = { ...character, className: 'Wizard' }
    const props = { c, entries: fixedEntries, save: () => {} }
    const markup = renderToStaticMarkup(<AbilitiesSection {...props} />)
    expect(markup).toContain('<h4>Class Boost</h4>')
    expect(checkbox(props, ['class'], 'Class Boost: Intelligence (fixed)')).toMatchObject({ checked: true, disabled: true })
    expect(checkbox(props, ['class'], 'Class Boost: Strength')).toMatchObject({ checked: false, disabled: true })
  })

  it('pads single-digit boost levels without changing double-digit levels', () => {
    const markup = renderToStaticMarkup(<AbilitiesSection c={{ ...character, level: 20 }} entries={entries} save={() => {}} />)
    for (const level of ['01', '05', '10', '15', '20']) {
      expect(markup).toContain(`<h4>L${level} Boosts</h4>`)
    }
  })

  it('shares choices in both directions and keeps other boosts intact', () => {
    let c: Character = { ...character, boosts: { 'free1:0': 'str' } }
    const props = () => ({
      c, entries,
      save: (patch: Partial<Character>) => {
        c = { ...c, ...patch, boosts: patch.boosts ?? c.boosts }
        c.abilities = computeAbilities(c, entries)
      },
    })
    const scorePanel = findElement(AbilitiesSection(props()), (type) => type === AbilityBoostChoices)
    const scoreGroups = scorePanel?.groups as string[]
    expect(scoreGroups).toContain('class')

    checkbox(props(), scoreGroups, 'Ancestry Boosts: Wisdom').onChange()
    expect(checkbox(props(), ['ancestry'], 'Ancestry Boosts: Wisdom').checked).toBe(true)
    checkbox(props(), ['ancestry'], 'Ancestry Boosts: Wisdom').onChange()
    checkbox(props(), ['ancestry'], 'Ancestry Boosts: Constitution').onChange()
    expect(checkbox(props(), scoreGroups, 'Ancestry Boosts: Constitution').checked).toBe(true)

    checkbox(props(), scoreGroups, 'Background Boosts: Dexterity').onChange()
    expect(checkbox(props(), ['background'], 'Background Boosts: Dexterity').checked).toBe(true)
    checkbox(props(), ['background'], 'Background Boosts: Dexterity').onChange()
    checkbox(props(), ['background'], 'Background Boosts: Wisdom').onChange()
    expect(checkbox(props(), scoreGroups, 'Background Boosts: Wisdom').checked).toBe(true)
    checkbox(props(), scoreGroups, 'Class Boost: Dexterity').onChange()
    expect(checkbox(props(), ['class'], 'Class Boost: Dexterity').checked).toBe(true)
    checkbox(props(), ['class'], 'Class Boost: Dexterity').onChange()
    checkbox(props(), ['class'], 'Class Boost: Strength').onChange()
    expect(checkbox(props(), scoreGroups, 'Class Boost: Strength').checked).toBe(true)
    expect(c.boosts).toMatchObject({ 'free1:0': 'str', 'ancestry:0': 'con', 'background:0': 'wis', class: 'str' })
    expect(c.abilities).toMatchObject({ str: 14, con: 12, wis: 12 })
  })

  it('respects restricted class choices and group capacity', () => {
    const props = { c: character, entries, save: () => {} }
    expect(checkbox(props, ['class'], 'Class Boost: Wisdom')).toMatchObject({ disabled: true, className: 'boost-forbidden' })
    expect(checkbox(props, ['class'], 'Class Boost: Dexterity')).toMatchObject({ disabled: false, className: undefined })
    const full = { ...props, c: { ...character, boosts: { class: 'dex' as const } } }
    expect(checkbox(full, ['class'], 'Class Boost: Wisdom')).toMatchObject({ disabled: true, className: 'boost-forbidden' })
    expect(checkbox(full, ['class'], 'Class Boost: Strength')).toMatchObject({ disabled: true, checked: false, className: undefined })
    expect(checkbox(full, ['class'], 'Class Boost: Dexterity')).toMatchObject({ disabled: false, checked: true, className: undefined })
  })

  it('reassigns background choices between restricted and free slots without dropping choices', () => {
    let c: Character = { ...character, boosts: { 'background:1': 'dex', 'free1:0': 'con' } }
    const props = () => ({
      c, entries,
      save: (patch: Partial<Character>) => { c = { ...c, ...patch } },
    })
    checkbox(props(), ['background'], 'Background Boosts: Strength').onChange()
    expect(c.boosts).toEqual({ 'background:0': 'dex', 'background:1': 'str', 'free1:0': 'con' })
    expect(checkbox(props(), ['background'], 'Background Boosts: Wisdom').disabled).toBe(true)
    checkbox(props(), ['background'], 'Background Boosts: Dexterity').onChange()
    expect(checkbox(props(), ['background'], 'Background Boosts: Constitution')).toMatchObject({ disabled: true, className: undefined })
    checkbox(props(), ['background'], 'Background Boosts: Wisdom').onChange()
    expect(c.boosts).toMatchObject({ 'background:0': 'wis', 'background:1': 'str' })
  })

  it('keeps fixed ancestry boosts locked while allowing only distinct free boosts', () => {
    const elfEntries = [...entries, entry('ancestry', 'Elf', 'Dexterity, Intelligence, Free')]
    let c: Character = { ...character, ancestry: 'Elf' }
    const props = () => ({
      c, entries: elfEntries,
      save: (patch: Partial<Character>) => { c = { ...c, ...patch } },
    })
    expect(checkbox(props(), ['ancestry'], 'Ancestry Boosts: Dexterity (fixed)')).toMatchObject({ checked: true, disabled: true, className: undefined })
    checkbox(props(), ['ancestry'], 'Ancestry Boosts: Wisdom').onChange()
    expect(c.boosts).toEqual({ 'ancestry:2': 'wis' })
    expect(checkbox(props(), ['ancestry'], 'Ancestry Boosts: Strength').disabled).toBe(true)
    checkbox(props(), ['ancestry'], 'Ancestry Boosts: Wisdom').onChange()
    expect(c.boosts).toEqual({})
  })

  it('still limits level boosts to four distinct choices', () => {
    const c: Character = { ...character, boosts: { 'free1:0': 'str', 'free1:1': 'dex', 'free1:2': 'con', 'free1:3': 'int' } }
    const props = { c, entries, save: () => {} }
    expect(checkbox(props, ['free1'], 'L01 Boosts: Wisdom')).toMatchObject({ disabled: true, checked: false, className: undefined })
    expect(checkbox(props, ['free1'], 'L01 Boosts: Strength')).toMatchObject({ checked: true, disabled: false })
  })

  it('lets existing duplicate choices be cleared without removing fixed or unrelated boosts', () => {
    const elfEntries = [...entries, entry('ancestry', 'Elf', 'Dexterity, Intelligence, Free')]
    let c: Character = { ...character, ancestry: 'Elf', boosts: { 'ancestry:2': 'dex', 'free1:0': 'wis' } }
    const props = {
      c, entries: elfEntries,
      save: (patch: Partial<Character>) => { c = { ...c, ...patch } },
    }
    const tree = AbilityBoostChoices({ ...props, groups: ['ancestry'] })
    const button = findElement(tree, (type) => type === 'button')
    if (!button) throw new Error('Missing duplicate cleanup control')
    const clearDuplicates = button.onClick as () => void
    clearDuplicates()
    expect(c.boosts).toEqual({ 'free1:0': 'wis' })
    expect(computeAbilities(c, elfEntries).dex).toBe(12)
  })
})
