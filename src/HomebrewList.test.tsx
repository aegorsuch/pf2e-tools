import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { groupHomebrew, HomebrewList } from './HomebrewList'
import { homebrewCharacterOptions } from './supplemental'
import type { ContentEntry } from './types'

afterEach(() => vi.unstubAllGlobals())

it.each([false, true])('confirms homebrew deletion before invoking its persistence handler: %s', (accepted) => {
  const entry = homebrewCharacterOptions([])[0]
  const confirm = vi.fn(() => accepted)
  vi.stubGlobal('window', { confirm })
  const onDelete = vi.fn()
  let remove: (() => void) | undefined
  const visit = (node: ReactNode) => Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'button' && child.props['aria-label'] === `Delete ${entry.name}`) remove = child.props.onClick as () => void
    visit(child.props.children as ReactNode)
  })
  visit(HomebrewList({ entries: [entry], onEdit: () => {}, onDelete }))
  if (!remove) throw new Error('Missing homebrew delete button')
  remove()
  expect(confirm).toHaveBeenCalledWith(`Remove homebrew "${entry.name}"?`)
  expect(onDelete).toHaveBeenCalledTimes(accepted ? 1 : 0)
  if (accepted) expect(onDelete).toHaveBeenCalledWith(entry.id)
})

it('alphabetizes collapsible categories and entries, placing shared class feats in both groups', () => {
  const feat = homebrewCharacterOptions([])[0]
  const entries: ContentEntry[] = [
    ...homebrewCharacterOptions([]),
    { ...feat, id: 'wolf', kind: 'companion', name: 'Wolf' },
    { ...feat, id: 'cat', kind: 'companion', name: 'Cat' },
    { ...feat, id: 'familiar', kind: 'familiar', name: 'Raven' },
    { ...feat, id: 'general', name: 'General Test', data: {}, traits: ['General'] },
    { ...feat, id: 'deleted', name: 'Deleted', deleted: true },
  ]
  const groups = groupHomebrew(entries)
  const names = groups.map((group) => group.name)
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  expect(names).toEqual(expect.arrayContaining(['Champion Feats', 'Companions', 'Druid Feats', 'Familiars', 'General Feats', 'Heritages', 'Ranger Feats', 'Wild Hunter Feats']))
  expect(groups.find((group) => group.name === 'Companions')?.entries.map((entry) => entry.name)).toEqual(['Cat', 'Wolf'])
  for (const name of ['Druid Feats', 'Ranger Feats']) expect(groups.find((group) => group.name === name)?.entries.map((entry) => entry.name)).toContain('Primal Nimbleness')
  const markup = renderToStaticMarkup(<HomebrewList entries={entries} onEdit={() => {}} onDelete={() => {}} />)
  expect(markup).toContain('aria-label="Edit Cat"')
  expect(markup).toContain('aria-label="Delete Cat"')
  expect(markup).toContain('class="icon-button"')
  expect(markup).not.toContain('>Edit</button>')
  expect(markup).not.toContain('>Delete</button>')
  expect(markup).not.toContain('(companion')
  expect(markup).not.toContain('open=""')
  expect(markup).not.toContain('Deleted')
})
