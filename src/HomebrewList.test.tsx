import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { groupHomebrew, HomebrewList } from './HomebrewList'
import { DISARMING_RUNE, GRAPPLING_RUNE, homebrewCharacterOptions, KILLERS_BELT_MAJOR, PARRYING_RUNE } from './supplemental'
import type { ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'
import * as settings from './settings'
import { HouseRules, matchingHouseRules } from './HouseRules'
import { equipmentDisplayName } from './equipmentGroups'

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

it('lists each homebrew weapon grade family once without changing its saved entries', () => {
  const feat = homebrewCharacterOptions([])[0]
  const family = 'supplemental:sf2e:starday-gyrojet'
  const base: ContentEntry = { ...feat, id: family, kind: 'weapon', systems: ['sf2e'], level: 3,
    name: 'Starday Night Special (Gyrojet Pistol)', data: { weapon_grade_family: family } }
  const advanced = { ...base, id: `${family}:advanced`, level: 4, name: `Advanced ${base.name}` }
  const elite = { ...base, id: `${family}:elite`, level: 12, name: `Elite ${base.name}` }
  const unrelated = { ...base, id: 'other', name: 'Other Weapon', data: {} }
  const entries = [elite, unrelated, advanced, base]
  const before = JSON.stringify(entries)
  const weapons = groupHomebrew(entries).find(group => group.name === 'Weapons')!.entries
  expect(weapons).toEqual([unrelated, base])
  const markup = renderToStaticMarkup(<HomebrewList entries={entries} search="gyrojet" onEdit={() => {}} onDelete={() => {}} />)
  expect(markup).toContain('Starday Night Special Gyrojet Pistol')
  expect(markup).not.toContain('Advanced Starday')
  expect(markup).not.toContain('(Gyrojet Pistol)')
  expect(equipmentDisplayName(advanced.name)).toBe('Advanced Starday Night Special Gyrojet Pistol')
  expect(JSON.stringify(entries)).toBe(before)
})

it('groups homebrew runes separately from gear and makes the category searchable', () => {
  const entries = [PARRYING_RUNE, KILLERS_BELT_MAJOR, GRAPPLING_RUNE, DISARMING_RUNE]
  const before = JSON.stringify(entries)
  const groups = groupHomebrew(entries)
  expect(groups.map(group => group.name)).toEqual(['Gear', 'Runes'])
  expect(groups[0].entries).toEqual([KILLERS_BELT_MAJOR])
  expect(groups[1].entries).toEqual([DISARMING_RUNE, GRAPPLING_RUNE, PARRYING_RUNE])
  const markup = renderToStaticMarkup(<HomebrewList entries={entries} search="runes" onEdit={() => {}} onDelete={() => {}} />)
  expect(markup).toContain('<h3>Runes (3)</h3>')
  expect(markup).toContain('open=""')
  for (const rune of groups[1].entries) {
    expect(markup).toContain(`aria-label="Edit ${rune.name}"`)
    expect(markup).toContain(`aria-label="Delete ${rune.name}"`)
  }
  expect(markup).not.toContain(KILLERS_BELT_MAJOR.name)
  expect(JSON.stringify(entries)).toBe(before)
})

it('includes every saved rule in its own searchable category even without homebrew entries', () => {
  const render = (search = '') => renderToStaticMarkup(
    <HomebrewList entries={[]} search={search} onEdit={() => {}} onDelete={() => {}} />,
  )
  expect(render().match(/type="checkbox"/g)).toHaveLength(Object.keys(getSettings()).length)
  expect(render()).toContain('id="homebrew-rules"')
  expect(render('Rules')).toContain('Inventor Armor Innovation Gauntlets')
  expect(getSettings().innateAutoHeighten).toBe(true)
  expect(getSettings().ignoreArchetypeFeatMinimums).toBe(true)
  expect(render('Ignore Archetype Feat Minimums')).toContain('checked=""')
  expect(getSettings().commanderBeastmaster).toBe(true)
  expect(getSettings().commanderCavalier).toBe(true)
  expect(render('Commander Beastmaster Dedication')).toContain('checked=""')
  expect(render('Commander Cavalier Dedication')).toContain('checked=""')
  expect(render('Auto-Heighten Innate and Item Spells')).toContain('checked=""')
  expect(render('Auto-Heighten Innate and Item Spells')).toContain('Auto-Heighten Innate and Item Spells')
  expect(render('highest mental')).toContain('open=""')
  expect(render('highest mental')).toContain('Innate Spells Use Highest Mental Attribute')
  expect(render('highest mental')).not.toContain('Free Archetype')
  const previous = getSettings().innateHighestMental
  try {
    updateSettings({ innateHighestMental: false })
    expect(render('highest mental')).not.toContain('checked=""')
    updateSettings({ innateHighestMental: true })
    expect(render('highest mental')).toContain('checked=""')
  } finally { updateSettings({ innateHighestMental: previous }) }
})

it('alphabetizes clarified rule labels and keeps renamed rules searchable', () => {
  const labels = matchingHouseRules('').map(rule => rule.label)
  expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
  for (const label of [
    'Advanced General Training and General Training: Once Each',
    'Disable fly speed from Animal Feature, Auspice Specialization, Celestial Form, Fiendish Form, Untamed Shift',
    'Cyborg Machine Heart or Mortal Heart Exclusive',
    'Druid Order Explorer Grants Skills',
    'Deity Grants Lore',
    'Disable Adopted Ancestry, Cultural Adaptability, Orc Kinship, Social Chameleon',
    'Disable Ancient Elf, Multitalented',
    'Disable Warden spells for Beastmaster except for Heal Companion and Magic Hide',
    'Disable Multiple Animal Companions',
    'Inventor Access: Bladed Gauntlet and Firearms',
    'Orc Warmask Item Bonus Scaling',
    'Ranger Cavalier Dedication',
  ]) expect(matchingHouseRules(label).map(rule => rule.label)).toContain(label)
})

it.each([
  { enabled: false, accepted: false },
  { enabled: false, accepted: true },
  { enabled: true, accepted: false },
].flatMap(test => (['freeArchetype', 'rangerCavalier', 'commanderCavalier', 'deityLore', 'ignoreArchetypeFeatMinimums'] as const).map(key => ({ ...test, key }))))('confirms only rule disabling and preserves settings on cancellation: %j', ({ enabled, accepted, key }) => {
  const previous = getSettings()
  const confirm = vi.fn(() => accepted)
  vi.stubGlobal('window', { confirm })
  const hook = vi.spyOn(settings, 'useSettings').mockImplementation(getSettings)
  try {
    updateSettings({ [key]: !enabled })
    const before = getSettings()
    const timestamp = settings.getSettingsUpdatedAt()
    let change: ((event: { target: { checked: boolean } }) => void) | undefined
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'input' && child.props.type === 'checkbox') change = child.props.onChange as typeof change
      visit(child.props.children as ReactNode)
    })
    const label = matchingHouseRules('').find(rule => rule.key === key)!.label
    visit(HouseRules({ search: label }))
    if (!change) throw new Error('Missing rule checkbox')
    change({ target: { checked: enabled } })
    if (enabled) expect(confirm).not.toHaveBeenCalled()
    else expect(confirm).toHaveBeenCalledWith(`Disable rule "${label}"?`)
    expect(getSettings()).toEqual({ ...before, [key]: enabled || !accepted })
    if (!enabled && !accepted) expect(settings.getSettingsUpdatedAt()).toBe(timestamp)
  } finally {
    hook.mockRestore()
    updateSettings(previous)
  }
})
