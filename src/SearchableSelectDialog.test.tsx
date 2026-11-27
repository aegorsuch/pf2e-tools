import { Children, isValidElement, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { PickerDialog } from './PickerDialog'
import { SearchableSelect } from './SearchableSelect'
import { EntryDescription } from './EntryDescription'
import { PickerSort } from './PickerSort'
import { SpellDefenseFilter } from './SpellDefenseFilter'
import { GearSystemFilter } from './GearSystemFilter'
import type { ContentEntry } from './types'

vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useState: vi.fn((initial: unknown) => [initial, vi.fn()]), useRef: vi.fn(), useMemo: vi.fn(), useId: vi.fn() }
})

it.each([
  ['pf2e', ['Fighter', 'Shared']],
  ['sf2e', ['Mechanic', 'Shared']],
] as const)('filters class options for %s while retaining shared classes', (system, expected) => {
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()]).mockReturnValueOnce([system, vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })
  visit(SearchableSelect({ 'aria-label': 'Class', value: '', alwaysSearchable: true,
    optionSystems: value => value === 'Fighter' ? ['pf2e'] : value === 'Mechanic' ? ['sf2e'] : ['pf2e', 'sf2e'],
    children: <><option value="">None</option><option>Fighter</option><option>Mechanic</option><option>Shared</option></> }))
  expect(found.filter(item => item.type === 'button' && expected.some(name => item.props['aria-label'] === `Class: ${name}`)))
    .toHaveLength(2)
  expect(found.filter(item => item.type === 'button' && ['Fighter', 'Mechanic', 'Shared']
    .some(name => item.props['aria-label'] === `Class: ${name}`))).toHaveLength(2)
  expect(found.some(item => item.type === GearSystemFilter)).toBe(true)
})

it('opens a searchable picker in the enclosing native dialog', () => {
  const dialog = {} as HTMLElement
  const setContainer = vi.fn()
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([false, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, setContainer]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const props = { 'aria-label': 'Learn dirge spell', value: '', optionCount: 11,
    children: <option value="fear">Fear</option> }
  const find = (node: ReactNode, type: unknown): Record<string, unknown> | undefined => {
    let result: Record<string, unknown> | undefined
    Children.forEach(node, child => {
      if (result || !isValidElement<Record<string, unknown>>(child)) return
      result = child.type === type ? child.props : find(child.props.children as ReactNode, type)
    })

    return result
  }
  const trigger = find(SearchableSelect(props), 'button')
  expect(trigger).toBeDefined()
  ;(trigger!.onClick as (event: unknown) => void)({ currentTarget: { closest: () => dialog } })
  expect(setContainer).toHaveBeenCalledWith(dialog)
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([dialog, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()])
  expect(find(SearchableSelect(props), PickerDialog)?.container).toBe(dialog)
})

it('keeps spell details separate from the plus selection action', () => {
  const setOpen = vi.fn()
  const select = { value: '', dispatchEvent: vi.fn() }
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([true, setOpen])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: select })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const props = { 'aria-label': 'Spell Rank 3 slot 1', value: '', alwaysSearchable: true, primaryDetails: true,
    children: <><option value="">Not Selected</option><option value="fear">+2 Fear</option></>,
    renderDetails: (value: string) => <EntryDescription name={value} /> }
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })
  visit(SearchableSelect(props))
  expect(found.find(item => item.type === EntryDescription)?.props.name).toBe('fear')
  const add = found.find(item => item.type === 'button' && item.props['aria-label'] === 'Select +2 Fear')
  expect(add).toBeDefined()
  expect(found.indexOf(add!)).toBeLessThan(found.findIndex(item => item.type === EntryDescription))
  expect(select.dispatchEvent).not.toHaveBeenCalled()
  ;(add!.props.onClick as () => void)()
  expect(select.value).toBe('fear')
  expect(select.dispatchEvent).toHaveBeenCalledOnce()
  expect(setOpen).toHaveBeenCalledWith(false)
})

it('searches option labels and extra text while retaining the selected option and disabled groups', () => {
  vi.mocked(useState).mockReturnValueOnce(['  flame  ', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })
  visit(SearchableSelect({
    'aria-label': 'Spell', value: 'shield', alwaysSearchable: true,
    searchText: value => value === 'fire' ? 'flame damage' : '',
    children: <><option value="">None</option><option value="shield">Shield</option>
      <optgroup label="Restricted" disabled><option value="fire">Fire</option></optgroup>
      <option value="ice">Ice</option></>,
  }))
  const buttons = found.filter(item => item.type === 'button')
  expect(buttons.find(item => item.props['aria-label'] === 'Spell: Shield')).toBeDefined()
  expect(buttons.find(item => item.props['aria-label'] === 'Spell: Fire')?.props.disabled).toBe(true)
  expect(buttons.find(item => item.props['aria-label'] === 'Spell: Ice')).toBeUndefined()
  expect(found.some(item => item.props.role === 'status')).toBe(false)
})

it('reports no matches even when the selected option remains visible', () => {
  vi.mocked(useState).mockReturnValueOnce(['missing', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })
  visit(SearchableSelect({ 'aria-label': 'Spell', value: 'shield', alwaysSearchable: true,
    children: <option value="shield">Shield</option> }))
  expect(found.some(item => item.props['aria-label'] === 'Spell: Shield')).toBe(true)
  expect(found.some(item => item.props.role === 'status')).toBe(true)
})

it.each([
  ['name', ['Alpha', 'Beta', 'Unknown']],
  ['level', ['Beta', 'Alpha', 'Unknown']],
  ['level-desc', ['Alpha', 'Beta', 'Unknown']],
] as const)('sorts picker options by %s before pagination', (sort, expected) => {
  const setSort = vi.fn()
  const setLimit = vi.fn()
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, setLimit]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce([sort, setSort])
    .mockReturnValueOnce(['all', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })
  visit(SearchableSelect({ 'aria-label': 'Rune', value: '', optionLevel: value => ({ alpha: 10, beta: 2 } as Record<string, number>)[value],
    children: <><option value="">Choose rune</option><option value="alpha">Alpha</option>
      <option value="beta">Beta</option><option value="unknown" disabled>Unknown</option></> }))
  const buttons = found.filter(item => item.type === 'button' && String(item.props['aria-label']).startsWith('Rune: '))
  expect(buttons.map(item => String(item.props['aria-label']).replace('Rune: ', '')).slice(1)).toEqual(expected)
  expect(buttons.at(-1)?.props.disabled).toBe(true)
  const control = found.find(item => item.type === PickerSort)
  expect(control?.props.value).toBe(sort)
  ;(control!.props.onChange as (value: string) => void)(sort === 'name' ? 'level' : 'name')
  expect(setSort).toHaveBeenCalled()
  expect(setLimit).toHaveBeenCalledWith(100)
})

it('sorts by underlying spell name before pagination, ignoring heightened labels', () => {
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([2, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })

  visit(SearchableSelect({ 'aria-label': 'Spell', value: '', primaryDetails: true,
    optionLevel: value => value === 'zebra' ? 1 : 2,
    optionSortName: value => ({ zebra: 'Zebra', alpha: 'Alpha', beta: 'Beta' } as Record<string, string>)[value],
    children: <><option value="zebra">+2 Zebra</option><option value="beta">Beta</option>
      <option value="alpha">+1 Alpha</option></> }))
  expect(found.filter(item => item.type === 'button' && String(item.props['aria-label']).startsWith('Select '))
    .map(item => item.props['aria-label'])).toEqual(['Select +1 Alpha', 'Select Beta'])
})

it('sorts spell choices by damage type without requiring level metadata', () => {
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['damage', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()]).mockReturnValueOnce(['both', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const spell = (name: string, description: string): ContentEntry => ({ id: name, name, kind: 'spell',
    systems: ['pf2e'], source: 'official', level: 1, traits: [], description, data: {}, effects: [], updatedAt: 0 })
  const spells = [spell('Fire', 'Deals fire damage.'), spell('Shield', 'Protects you.'), spell('Cold', 'Deals cold damage.')]
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })

  visit(SearchableSelect({ 'aria-label': 'Spell', value: '', optionSpell: value => spells.find(spell => spell.name === value),
    children: <>{spells.map(spell => <option key={spell.id}>{spell.name}</option>)}</> }))
  expect(found.find(item => item.type === PickerSort)?.props.includeDamage).toBe(true)
  expect(found.filter(item => item.type === 'button' && String(item.props['aria-label']).startsWith('Spell: '))
    .map(item => item.props['aria-label'])).toEqual(['Spell: Cold', 'Spell: Fire', 'Spell: Shield'])
  expect(found.filter(item => item.type === 'small').map(item => item.props.children)).toEqual(['Cold', 'Fire', 'Other'])
})

it('sorts spell choices alphabetically within their groups without level metadata', () => {
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()]).mockReturnValueOnce(['both', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })
  visit(SearchableSelect({ 'aria-label': 'Spell', value: '', optionSpell: () => undefined,
    children: <><optgroup label="First"><option>Zebra</option><option>Alpha</option></optgroup>
      <optgroup label="Second"><option>Delta</option><option>Beta</option></optgroup></> }))
  expect(found.filter(item => item.type === 'button' && String(item.props['aria-label']).startsWith('Spell: '))
    .map(item => item.props['aria-label'])).toEqual(['Spell: Alpha', 'Spell: Zebra', 'Spell: Beta', 'Spell: Delta'])
})

it('does not resolve option levels while the picker is closed', () => {
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([false, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['level', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const optionLevel = vi.fn(() => 1)
  SearchableSelect({ 'aria-label': 'Rune', value: '', optionLevel, children: <option value="one">One</option> })
  expect(optionLevel).not.toHaveBeenCalled()
})

it('resolves levels only for matching or selected options when sorting search results', () => {
  vi.mocked(useState).mockReturnValueOnce(['flame', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['level', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()]).mockReturnValueOnce(['both', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const levels: Record<string, number | undefined> = { shield: 3, flameA: 2, flameB: 1, flameC: undefined, ice: 4 }
  const optionLevel = vi.fn((value: string) => levels[value])
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })
  visit(SearchableSelect({ 'aria-label': 'Spell', value: 'shield', optionLevel,
    children: <><option value="">None</option><option value="shield">Shield</option>
      <option value="flameA">Flame A</option><option value="flameB">Flame B</option>
      <option value="flameC">Flame C</option><option value="ice">Ice</option></> }))
  expect(optionLevel.mock.calls.map(([value]) => value).sort()).toEqual(['flameA', 'flameB', 'flameC', 'shield'])
  expect(found.filter(item => item.type === 'button' && String(item.props['aria-label']).startsWith('Spell: '))
    .map(item => item.props['aria-label'])).toEqual(['Spell: None', 'Spell: Flame B', 'Spell: Flame A', 'Spell: Shield', 'Spell: Flame C'])
})

it('does not resolve spells when defense and system filters are inactive', () => {
  vi.mocked(useState).mockReturnValueOnce(['flame', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['all', vi.fn()]).mockReturnValueOnce(['both', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const optionSpell = vi.fn(() => undefined)
  SearchableSelect({ 'aria-label': 'Spell', value: 'shield', alwaysSearchable: true, optionSpell,
    children: <><option value="">None</option><option value="flame">Flame</option>
      <option value="shield">Shield</option><option value="ice">Ice</option></> })
  expect(optionSpell).not.toHaveBeenCalled()
})

it('resolves filters for search matches and the retained selection only', () => {
  vi.mocked(useState).mockReturnValueOnce(['flame', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['reflex', vi.fn()]).mockReturnValueOnce(['both', vi.fn()])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const optionSpell = vi.fn((value: string): ContentEntry => ({ id: value, name: value, kind: 'spell',
    systems: ['pf2e'], source: 'official', level: 1, traits: [], description: '',
    data: { saving_throw: 'Reflex' }, effects: [], updatedAt: 0 }))
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })
  visit(SearchableSelect({ 'aria-label': 'Spell', value: 'shield', alwaysSearchable: true, optionSpell,
    children: <><option value="">None</option><option value="flame">Flame</option>
      <option value="shield">Shield</option><option value="ice">Ice</option></> }))
  expect(optionSpell.mock.calls.map(([value]) => value)).toEqual(['flame', 'shield'])
  expect(found.filter(item => item.type === 'button' && String(item.props['aria-label']).startsWith('Spell: '))
    .map(item => item.props['aria-label'])).toEqual(['Spell: None', 'Spell: Flame', 'Spell: Shield'])
})

it('filters spell choices by defense together with search and resets pagination', () => {
  const setDefense = vi.fn()
  const setLimit = vi.fn()
  vi.mocked(useState).mockReturnValueOnce(['flame', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce([100, setLimit]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
    .mockReturnValueOnce(['reflex', setDefense])
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('picker')
  vi.mocked(useMemo).mockImplementation(fn => fn())
  const spell = (name: string, defense: string): ContentEntry => ({ id: name, name, kind: 'spell', systems: ['sf2e'],
    source: 'official', level: 1, traits: [], description: '', data: { saving_throw: defense }, effects: [], updatedAt: 0 })
  const entries = [spell('Flame Burst', 'basic Reflex'), spell('Flame Bolt', 'AC'), spell('Frost', 'Reflex')]
  const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    found.push({ type: child.type, props: child.props })
    visit(child.props.children as ReactNode)
  })

  visit(SearchableSelect({ 'aria-label': 'Spell', value: '', primaryDetails: true,
    optionSpell: value => entries.find(entry => entry.id === value),
    children: <>{entries.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</> }))
  expect(found.filter(item => item.type === 'button' && String(item.props['aria-label']).startsWith('Select '))
    .map(item => item.props['aria-label'])).toEqual(['Select Flame Burst'])
  const filter = found.find(item => item.type === SpellDefenseFilter)!
  ;(filter.props.onChange as (value: string) => void)('ac')
  expect(setDefense).toHaveBeenCalledWith('ac')
  expect(setLimit).toHaveBeenCalledWith(100)
})

it.each([
    ['both', ['Select Shared PF2E', 'Select Shared SF2E']],
    ['pf2e', ['Select Shared PF2E']],
    ['sf2e', ['Select Shared SF2E']],
  ] as const)('filters spell choices by %s and defense', (system, expected) => {
    const setSystem = vi.fn()
    const setLimit = vi.fn()
    vi.mocked(useState).mockReturnValueOnce(['shared', vi.fn()]).mockReturnValueOnce([true, vi.fn()])
      .mockReturnValueOnce([100, setLimit]).mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce(['name', vi.fn()])
      .mockReturnValueOnce(['reflex', vi.fn()]).mockReturnValueOnce([system, setSystem])
    vi.mocked(useRef).mockReturnValue({ current: null })
    vi.mocked(useId).mockReturnValue('picker')
    vi.mocked(useMemo).mockImplementation(fn => fn())
    const spell = (id: string, game: 'pf2e' | 'sf2e', defense: string): ContentEntry =>
      ({ id, name: 'Shared', kind: 'spell', systems: [game], source: 'official', level: 1,
        traits: [], description: '', data: { saving_throw: defense }, effects: [], updatedAt: 0 })
    const entries = [spell('pf', 'pf2e', 'Reflex'), spell('sf', 'sf2e', 'Reflex'), spell('ac', 'sf2e', 'AC')]
    const found: Array<{ type: unknown; props: Record<string, unknown> }> = []
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      found.push({ type: child.type, props: child.props })
      visit(child.props.children as ReactNode)
    })
    visit(SearchableSelect({ 'aria-label': 'Spell', value: '', primaryDetails: true,
      optionSpell: value => entries.find(entry => entry.id === value),
      children: <><option value="pf">Shared PF2E</option><option value="sf">Shared SF2E</option>
        <option value="ac">Shared AC</option></> }))
    expect(found.filter(item => item.type === 'button' && String(item.props['aria-label']).startsWith('Select '))
      .map(item => item.props['aria-label'])).toEqual(expected)
    const filter = found.find(item => item.type === GearSystemFilter)!
    ;(filter.props.onChange as (value: string) => void)('pf2e')
    expect(setSystem).toHaveBeenCalledWith('pf2e')
    expect(setLimit).toHaveBeenCalledWith(100)
  })
