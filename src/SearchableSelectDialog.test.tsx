import { Children, isValidElement, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { PickerDialog } from './PickerDialog'
import { SearchableSelect } from './SearchableSelect'

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
