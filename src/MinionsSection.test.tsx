import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { MinionsSection } from './MinionsSection'
import type { Character, ContentEntry } from './types'

function findSelect(node: ReactNode, label: string): ((event: { target: { value: string } }) => void) | undefined {
  let found: ((event: { target: { value: string } }) => void) | undefined
  Children.forEach(node, (child) => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = child.type === 'select' && child.props['aria-label'] === label
      ? child.props.onChange as (event: { target: { value: string } }) => void
      : findSelect(child.props.children as ReactNode, label)
  })
  return found
}

it.each([
  ['Incredible Companion', 'Specialized Companion'],
  ['Incredible Mount', 'Specialized Mount'],
])('places %s and %s choices on the companion card', (advanced, specialized) => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: advanced, type: 'Class Feat', level: 8, choice: 'Nimble' },
      { name: specialized, type: 'Class Feat', level: 10, choice: 'Ambusher' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'wolf', name: 'Wolf', type: 'Wolf' }],
  }
  const wolf: ContentEntry = {
    id: 'wolf', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Wolf', level: 1,
    traits: [], description: '', data: { strength: 2, dexterity: 2, constitution: 2, intelligence: -4, wisdom: 1, charisma: 0, hp: 8, size: 'Medium', speed: 35, companion_attacks: 'Jaws|1d8 piercing|' },
    effects: [], updatedAt: 0,
  }

  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[wolf]} save={() => {}} />)

  expect(markup).toContain('aria-label="Companion advancement"')
  expect(markup).toContain('aria-label="Companion specialization 2"')
  expect(markup).toContain('<option value="Nimble" selected="">Nimble</option>')
  expect(markup).toContain('<option value="Ambusher" selected="">Ambusher</option>')
  expect(markup).not.toContain('Add animal companion')
  expect(markup).toContain('aria-label="Companion type"')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, feats: [], companions: [] }} entries={[wolf]} save={() => {}} />))
    .not.toContain('Add animal companion')
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const choose = findSelect(MinionsSection({ c, entries: [wolf], save }), 'Companion specialization 2')
  if (!choose) throw new Error('Missing specialization dropdown')
  choose({ target: { value: 'Racer' } })
  expect(c.feats[1]).toMatchObject({ name: specialized, choice: 'Racer' })
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={[wolf]} save={save} />)).toContain('<span>Racer</span>')
})
