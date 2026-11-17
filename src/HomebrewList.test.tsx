import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { groupHomebrew, HomebrewList } from './HomebrewList'
import { homebrewCharacterOptions } from './supplemental'
import type { ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'
import * as settings from './settings'
import { HouseRules } from './HouseRules'

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

it('filters homebrew by entry or category and expands matching groups', () => {
  const feat = homebrewCharacterOptions([])[0]
  const entries: ContentEntry[] = [
    { ...feat, id: 'wolf', kind: 'companion', name: 'Wolf' },
    { ...feat, id: 'cat', kind: 'companion', name: 'Cat' },
  ]
  const render = (search: string) => renderToStaticMarkup(
    <HomebrewList entries={entries} search={search} onEdit={() => {}} onDelete={() => {}} />,
  )
  expect(render('wOlF')).toContain('open=""')
  expect(render('wOlF')).toContain('Edit Wolf')
  expect(render('wOlF')).not.toContain('Edit Cat')
  expect(render('companions')).toContain('Edit Cat')
  expect(render('missing')).toContain('No homebrew matches your search.')
})

it('includes every saved rule in its own searchable category even without homebrew entries', () => {
  const render = (search = '') => renderToStaticMarkup(
    <HomebrewList entries={[]} search={search} onEdit={() => {}} onDelete={() => {}} />,
  )
  expect(render().match(/type="checkbox"/g)).toHaveLength(Object.keys(getSettings()).length)
  expect(render()).toContain('id="homebrew-rules"')
  expect(render('Rules')).toContain('Inventor Armor Innovation Gauntlets')
  expect(render('highest mental')).toContain('open=""')
  expect(render('highest mental')).toContain('Innate Spells Use Highest Mental Attribute')
  expect(render('highest mental')).not.toContain('Free Archetype')
  const previous = getSettings().innateHighestMental
  try {
    updateSettings({ innateHighestMental: false })
    expect(render('innate')).not.toContain('checked=""')
    updateSettings({ innateHighestMental: true })
    expect(render('innate')).toContain('checked=""')
  } finally { updateSettings({ innateHighestMental: previous }) }
})

it.each([
  { enabled: false, accepted: false },
  { enabled: false, accepted: true },
  { enabled: true, accepted: false },
])('confirms only rule disabling and preserves settings on cancellation: %j', ({ enabled, accepted }) => {
  const previous = getSettings()
  const confirm = vi.fn(() => accepted)
  vi.stubGlobal('window', { confirm })
  const hook = vi.spyOn(settings, 'useSettings').mockImplementation(getSettings)
  try {
    updateSettings({ freeArchetype: !enabled })
    const before = getSettings()
    const timestamp = settings.getSettingsUpdatedAt()
    let change: ((event: { target: { checked: boolean } }) => void) | undefined
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'input' && child.props.type === 'checkbox') change = child.props.onChange as typeof change
      visit(child.props.children as ReactNode)
    })
    visit(HouseRules({ search: 'Free Archetype' }))
    if (!change) throw new Error('Missing rule checkbox')
    change({ target: { checked: enabled } })
    if (enabled) expect(confirm).not.toHaveBeenCalled()
    else expect(confirm).toHaveBeenCalledWith('Disable rule "Free Archetype"?')
    expect(getSettings()).toEqual({ ...before, freeArchetype: enabled || !accepted })
    if (!enabled && !accepted) expect(settings.getSettingsUpdatedAt()).toBe(timestamp)
  } finally {
    hook.mockRestore()
    updateSettings(previous)
  }
})
