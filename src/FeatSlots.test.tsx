import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { FeatSlots } from './FeatSlots'
import { plannedSlots } from './builder'
import type { Character, ContentEntry } from './types'

function findButton(node: ReactNode, label: string): (() => void) | undefined {
  let result: (() => void) | undefined
  Children.forEach(node, (child) => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'button' && child.props['aria-label'] === label) result = child.props.onClick as () => void
    else result = findButton(child.props.children as ReactNode, label)
  })
  return result
}

function findSelect(node: ReactNode, label: string): ((event: { target: { value: string } }) => void) | undefined {
  let result: ((event: { target: { value: string } }) => void) | undefined
  Children.forEach(node, (child) => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'select' && child.props['aria-label'] === label) result = child.props.onChange as (event: { target: { value: string } }) => void
    else result = findSelect(child.props.children as ReactNode, label)
  })
  return result
}

it('prefixes ancestry slots and feat options with zero-padded levels', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 13, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feat: ContentEntry = {
    id: 'feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Natural Ambition', level: 1,
    traits: ['Human'], description: '', data: {}, effects: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['ancestry']} title="Ancestry Feats" />)
  expect(markup).toContain('Ancestry Feats')
  expect(markup).toContain('L01 Ancestry')
  expect(markup).toContain('L13 Ancestry')
  expect(markup).toContain('L01 Natural Ambition')
  expect(markup).toContain('class="feat-slot-list"')
  expect(markup).toContain('class="feat-slot-row"')
})

it('allows repeatable feats in multiple slots and retains their entry link until the final copy is removed', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [],
    extraSlots: [{ category: 'class', level: 1, count: 1 }], updatedAt: 0,
  }
  const entries: ContentEntry[] = [{
    id: 'warden', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Initiate Warden', level: 1,
    traits: ['Ranger'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }]
  const tree = () => FeatSlots({ c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  const select = () => findSelect(tree(), 'L01 Class feat')
  const chooseFirst = select()
  if (!chooseFirst) throw new Error('Missing first slot')
  chooseFirst({ target: { value: 'Initiate Warden' } })
  const removeExtra = findButton(tree(), 'Remove L01 Class extra feat slot 1')
  expect(removeExtra).toBeDefined()
  const chooseExtra = (() => {
    let selects: Array<(event: { target: { value: string } }) => void> = []
    const visit = (node: ReactNode) => Children.forEach(node, (child) => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'select' && child.props['aria-label'] === 'L01 Class feat') selects.push(child.props.onChange as (event: { target: { value: string } }) => void)
      visit(child.props.children as ReactNode)
    })
    visit(tree())
    return selects[1]
  })()
  if (!chooseExtra) throw new Error('Missing extra slot')
  chooseExtra({ target: { value: 'Initiate Warden' } })
  expect(c.feats).toHaveLength(2)
  expect(c.entryIds).toEqual(['warden'])
  const remove = findButton(tree(), 'Remove L01 Class extra feat slot 1')
  if (!remove) throw new Error('Missing remove button')
  remove()
  expect(c.feats).toHaveLength(1)
  expect(c.entryIds).toEqual(['warden'])
})

it('adds slots beside a selected feat and removes only the chosen extra slot', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, ancestry: 'Human', className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'First', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: ['first', 'second', 'third'], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = ['First', 'Second', 'Third'].map((name) => ({
    id: name.toLowerCase(), systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 0,
  }))
  const tree = () => FeatSlots({ c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  const add = () => {
    const action = findButton(tree(), 'Add L01 Class feat slot')
    if (!action) throw new Error('Missing add button')
    action()
  }
  add()
  add()
  expect(c.extraSlots).toEqual([{ category: 'class', level: 1, count: 1 }, { category: 'class', level: 1, count: 1 }])
  expect(plannedSlots(c).filter((s) => s.category === 'class').map((s) => s.key)).toEqual(['class:1:0', 'class:1:1', 'class:1:2'])
  c.feats.push(
    { name: 'Second', type: 'Class Feat', level: 1, slot: 'class:1:1' },
    { name: 'Third', type: 'Class Feat', level: 1, slot: 'class:1:2' },
  )
  const remove = findButton(tree(), 'Remove L01 Class extra feat slot 1')
  if (!remove) throw new Error('Missing remove button')
  remove()
  expect(c.extraSlots).toEqual([{ category: 'class', level: 1, count: 1 }])
  expect(c.feats).toEqual([
    { name: 'First', type: 'Class Feat', level: 1, slot: 'class:1:0' },
    { name: 'Third', type: 'Class Feat', level: 1, slot: 'class:1:1' },
  ])
  expect(c.entryIds).toEqual(['first', 'third'])
})

it('removes existing counted extras without changing other slots', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 3,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Extra', type: 'Bonus Feat', level: 1, slot: 'bonus:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], updatedAt: 0,
    extraSlots: [{ category: 'bonus', level: 1, count: 2 }, { category: 'class', level: 1, count: 1 }],
  }
  const tree = FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['bonus'] })
  const remove = findButton(tree, 'Remove L01 Bonus extra feat slot 0')
  if (!remove) throw new Error('Missing remove button')
  remove()
  expect(c.extraSlots).toEqual([{ category: 'bonus', level: 1, count: 1 }, { category: 'class', level: 1, count: 1 }])
  expect(c.feats).toEqual([])
})

it('keeps extra slots next to their matching standard slot', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], updatedAt: 0,
    extraSlots: [{ category: 'ancestry', level: 1, count: 2 }, { category: 'class', level: 1, count: 1 }],
  }
  expect(plannedSlots(c).map((s) => s.key)).toEqual([
    'ancestry:1:0', 'ancestry:1:1', 'ancestry:1:2', 'class:1:0', 'class:1:1',
  ])
})
