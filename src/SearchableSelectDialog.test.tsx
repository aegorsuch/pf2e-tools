import { Children, isValidElement, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { PickerDialog } from './PickerDialog'
import { SearchableSelect } from './SearchableSelect'
import { EntryDescription } from './EntryDescription'

vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useState: vi.fn(), useRef: vi.fn(), useMemo: vi.fn(), useId: vi.fn() }
})

it('opens a searchable picker in the enclosing native dialog', () => {
  const dialog = {} as HTMLElement
  const setContainer = vi.fn()
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([false, vi.fn()])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, setContainer])
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
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([dialog, vi.fn()])
  expect(find(SearchableSelect(props), PickerDialog)?.container).toBe(dialog)
})

it('keeps spell details separate from the plus selection action', () => {
  const setOpen = vi.fn()
  const select = { value: '', dispatchEvent: vi.fn() }
  vi.mocked(useState).mockReturnValueOnce(['', vi.fn()]).mockReturnValueOnce([true, setOpen])
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()])
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
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()])
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
    .mockReturnValueOnce([100, vi.fn()]).mockReturnValueOnce([undefined, vi.fn()])
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
