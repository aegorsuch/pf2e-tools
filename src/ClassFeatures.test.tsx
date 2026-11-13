import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ClassFeatures } from './ClassFeatures'
import type { Character, ContentEntry } from './types'

it('labels class features with leading, zero-padded levels', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feature = (name: string, level: number): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'classFeature', source: 'official', name, level, traits: [],
    description: '', data: { class: 'Ranger' }, effects: [], updatedAt: 0,
  })

  const markup = renderToStaticMarkup(
    <ClassFeatures c={c} entries={[feature('First Feature', 1), feature('Later Feature', 10)]} save={() => {}} />,
  )
  expect(markup).toContain('Class Features (2)')
  expect(markup).toContain('<details class="character-subsection"><summary>')
  expect(markup).not.toContain('open=""')
  expect(markup).toContain('L01 First Feature')
  expect(markup).toContain('L10 Later Feature')
})

it('saves an explicit Champion confirmation of legacy Tenets of Good', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 2, className: 'Champion',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const tree = () => ClassFeatures({ c, entries: [], save: patch => { c = { ...c, ...patch } } })
  const findInput = (node: ReactNode): Record<string, unknown> | undefined => {
    let found: Record<string, unknown> | undefined
    Children.forEach(node, child => {
      if (found || !isValidElement<Record<string, unknown>>(child)) return
      found = child.type === 'input' && child.props['aria-label'] === 'Legacy Tenets of Good'
        ? child.props : findInput(child.props.children as ReactNode)
    })
    return found
  }
  expect(findInput(tree())?.checked).toBe(false)
  const onChange = findInput(tree())?.onChange as (event: { target: { checked: boolean } }) => void
  onChange({ target: { checked: true } })
  expect(c.legacyTenetsOfGood).toBe(true)
  expect(findInput(tree())?.checked).toBe(true)
  expect(renderToStaticMarkup(tree())).toContain('Confirm legacy compatibility with your GM')
  expect(findInput(ClassFeatures({ c: { ...c, className: 'Fighter' }, entries: [], save: () => {} }))).toBeUndefined()
})
