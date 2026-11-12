import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { MinionsSection } from './MinionsSection'
import { CompanionSpellOptions, SpellsSection } from './SpellsSection'
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

function findToggle(node: ReactNode, label: string): ((event: { target: { checked: boolean } }) => void) | undefined {
  let found: ((event: { target: { checked: boolean } }) => void) | undefined
  Children.forEach(node, (child) => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = child.type === 'input' && child.props['aria-label'] === label
      ? child.props.onChange as (event: { target: { checked: boolean } }) => void
      : findToggle(child.props.children as ReactNode, label)
  })
  return found
}

it('syncs companion spell toggles in both directions, persists targets, and gates heightened choices', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 6, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    activeSpells: ['Keen Smell'],
    companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Cat', name: 'B' }],
    spells: ['Canopy Crawler', 'Enlarge Companion'].map((name) => ({ name, rank: 2, cantrip: false })),
  }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  for (const name of ['Canopy Crawler', 'Enlarge Companion'] as const) {
    const component = (companionId?: string) => CompanionSpellOptions({ c, entries: [], save, name, companionId })
    const on = findToggle(component('b'), `${name} on B`)
    if (!on) throw new Error('Missing companion spell toggle')
    on({ target: { checked: true } })
    expect(c.activeSpells).toContain(name)
    expect(c.activeSpells).toContain('Keen Smell')
    const spells = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={save} />)
    expect(spells).toContain(`aria-label="${name} active" checked=""`)
    expect(renderToStaticMarkup(component('a'))).not.toContain('checked=""')
    const off = findToggle(component(), `${name} active`)
    if (!off) throw new Error('Missing spell list toggle')
    off({ target: { checked: false } })
    expect(renderToStaticMarkup(component('b'))).not.toContain('checked=""')
    const spellOn = findToggle(component(), `${name} active`)
    if (!spellOn) throw new Error('Missing spell list toggle')
    spellOn({ target: { checked: true } })
    expect(renderToStaticMarkup(component('b'))).toContain('checked=""')
  }
  expect(c.canopyCrawlerCompanionId).toBe('b')
  expect(c.enlargeCompanionId).toBe('b')
  const select = (name: 'Canopy Crawler' | 'Enlarge Companion', label: string, value: string) => {
    const change = findSelect(CompanionSpellOptions({ c, entries: [], save, name }), label)
    if (!change) throw new Error('Missing companion spell choice')
    change({ target: { value } })
  }
  select('Enlarge Companion', 'Enlarge Companion size', 'Huge')
  expect(c.enlargeCompanionSize).toBeUndefined()
  c = { ...c, level: 7 }
  select('Enlarge Companion', 'Enlarge Companion size', 'Huge')
  expect(c.enlargeCompanionSize).toBe('Huge')
  select('Canopy Crawler', 'Canopy Crawler target', 'Both')
  expect(c.canopyCrawlerTarget).toBe('Companion')
  c = { ...c, level: 9 }
  select('Canopy Crawler', 'Canopy Crawler target', 'Both')
  expect(c.canopyCrawlerTarget).toBe('Both')
  select('Canopy Crawler', 'Canopy Crawler companion', 'a')
  expect(c.canopyCrawlerCompanionId).toBe('a')
  select('Canopy Crawler', 'Canopy Crawler companion', 'invalid')
  expect(c.canopyCrawlerCompanionId).toBe('a')
  c = { ...c, level: 6 }
  expect(renderToStaticMarkup(<CompanionSpellOptions c={c} entries={[]} save={save} name="Enlarge Companion" />))
    .toContain('<option selected="">Large</option>')
  expect(c.enlargeCompanionSize).toBe('Huge')
})

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
  expect(markup).not.toContain(advanced)
  expect(markup).not.toContain(specialized)
  expect(markup).not.toContain('Add animal companion')
  expect(markup).toContain('aria-label="Companion type"')
  expect(markup).not.toContain('aria-label="Companion name"')
  expect(markup).toContain('<strong>Wolf</strong>')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, feats: [], companions: [] }} entries={[wolf]} save={() => {}} />))
    .not.toContain('Add animal companion')
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const choose = findSelect(MinionsSection({ c, entries: [wolf], save }), 'Companion specialization 2')
  if (!choose) throw new Error('Missing specialization dropdown')
  choose({ target: { value: 'Racer' } })
  expect(c.feats[1]).toMatchObject({ name: specialized, choice: 'Racer' })
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={[wolf]} save={save} />)).toContain('<span>Racer</span>')
  c = { ...c, feats: [...c.feats].reverse() }
  const reordered = renderToStaticMarkup(<MinionsSection c={c} entries={[wolf]} save={save} />)
  expect(reordered.indexOf('aria-label="Companion advancement"')).toBeLessThan(reordered.indexOf('aria-label="Companion specialization 1"'))
  const advance = findSelect(MinionsSection({ c, entries: [wolf], save }), 'Companion advancement')
  if (!advance) throw new Error('Missing advancement dropdown')
  advance({ target: { value: 'Savage' } })
  expect(c.feats[1]).toMatchObject({ name: advanced, choice: 'Savage' })
  expect(c.feats[0]).toMatchObject({ name: specialized, choice: 'Racer' })
  c = { ...c, feats: [...c.feats,
    { name: specialized, type: 'Class Feat', level: 10, choice: 'Wrecker' },
    { name: specialized, type: 'Class Feat', level: 10, choice: 'Ambusher' },
  ] }
  const sorted = renderToStaticMarkup(<MinionsSection c={c} entries={[wolf]} save={save} />)
  expect(sorted.indexOf('aria-label="Companion advancement"')).toBeLessThan(sorted.indexOf('aria-label="Companion specialization 4"'))
  expect(sorted.indexOf('aria-label="Companion specialization 4"')).toBeLessThan(sorted.indexOf('aria-label="Companion specialization 1"'))
  expect(sorted.indexOf('aria-label="Companion specialization 1"')).toBeLessThan(sorted.indexOf('aria-label="Companion specialization 3"'))
  expect(sorted.indexOf('<span>Ambusher</span>')).toBeLessThan(sorted.indexOf('<span>Racer</span>'))
  expect(sorted.indexOf('<span>Racer</span>')).toBeLessThan(sorted.indexOf('<span>Wrecker</span>'))
  const changeFirst = findSelect(MinionsSection({ c, entries: [wolf], save }), 'Companion specialization 4')
  if (!changeFirst) throw new Error('Missing alphabetized specialization')
  changeFirst({ target: { value: 'Bully' } })
  expect(c.feats[3]).toMatchObject({ name: specialized, choice: 'Bully' })
  expect(c.feats[0]).toMatchObject({ name: specialized, choice: 'Racer' })
})
