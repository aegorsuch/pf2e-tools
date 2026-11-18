import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ClassFeatures } from './ClassFeatures'
import type { Character, ContentEntry } from './types'
import { effectiveWeapon } from './builder'

function findControl(node: ReactNode, label: string): { value?: string; onChange?: (event: { target: { value: string } }) => void } | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ 'aria-label'?: string; value?: string; onChange?: (event: { target: { value: string } }) => void; children?: ReactNode }>(child)) continue
    if (child.props['aria-label'] === label) return child.props
    const nested = findControl(child.props.children, label)
    if (nested) return nested
  }
}

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
      found = child.type === 'input' && child.props['aria-label'] === 'Confirm legacy Tenets of Good'
        ? child.props : findInput(child.props.children as ReactNode)
    })
    return found
  }
  expect(findInput(tree())?.checked).toBe(false)
  const onChange = findInput(tree())?.onChange as (event: { target: { checked: boolean } }) => void
  onChange({ target: { checked: true } })
  expect(c.legacyTenetsOfGood).toBe(true)
  expect(findInput(tree())?.checked).toBe(true)
  expect(renderToStaticMarkup(tree())).not.toContain('Known causes map to matching tenets automatically')
  expect(findInput(ClassFeatures({ c: { ...c, className: 'Fighter' }, entries: [], save: () => {} }))).toBeUndefined()
})

it('selects one equipped Giant weapon by id and retains it when stowed or changing class', () => {
  const sword: ContentEntry = { id: 'sword', name: 'Bastard Sword', kind: 'weapon', systems: ['pf2e'], source: 'official',
    level: 0, traits: ['Two-Hand d12'], description: '', data: { weapon_category: 'Martial', hands: 1, damage: '1d8 S' }, effects: [], updatedAt: 1 }
  const weapon = { id: 'first', name: sword.name, potency: 0, striking: 0, runes: [], material: 'Cold Iron' }
  let c: Character = { id: 'c', systems: ['pf2e'], name: 'Amiri', className: 'Barbarian', subclass: 'Giant Instinct', level: 10,
    abilities: { str: 18, dex: 14, con: 18, int: 10, wis: 10, cha: 10 }, feats: [], equipment: [], lores: [], languages: [], entryIds: [],
    weapons: [weapon, { ...weapon, id: 'second', stowed: true }], extraSlots: [], updatedAt: 0 }
  const tree = () => ClassFeatures({ c, entries: [sword], save: patch => { c = { ...c, ...patch } } })
  const before = JSON.stringify(c.weapons)
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('value="first"')
  expect(markup).not.toContain('value="second"')
  findControl(tree(), 'Giant Instinct weapon')!.onChange!({ target: { value: 'second' } })
  expect(c.giantWeaponId).toBeUndefined()
  findControl(tree(), 'Giant Instinct weapon')!.onChange!({ target: { value: 'first' } })
  expect(c.giantWeaponId).toBe('first')
  expect(effectiveWeapon(c, [sword], weapon)).toMatchObject({ size: 'Large', material: 'Orichalcum', potency: 2, striking: 1 })
  expect(JSON.stringify(c.weapons)).toBe(before)
  findControl(tree(), 'Giant Raging Resistance')!.onChange!({ target: { value: 'Fire' } })
  expect(c.giantRagingResistance).toBe('Fire')
  c = { ...c, weapons: c.weapons!.map(item => ({ ...item, stowed: true })) }
  expect(findControl(tree(), 'Giant Instinct weapon')?.value).toBe('first')
  expect(renderToStaticMarkup(tree())).toContain('not equipped or unavailable')
  c = { ...c, className: 'Fighter' }
  expect(findControl(tree(), 'Giant Instinct weapon')).toBeUndefined()
  expect(effectiveWeapon(c, [sword], weapon)).toEqual({ ...weapon, material: 'Cold Iron (Standard-Grade)' })
  expect(c.giantWeaponId).toBe('first')
  c = { ...c, className: 'Barbarian', level: 8 }
  expect(findControl(tree(), 'Giant Raging Resistance')).toBeUndefined()
  expect(c.giantRagingResistance).toBe('Fire')
})

it('moves Verdant choice to Class Features without losing saved enhancements or hidden weapons', () => {
  const spear: ContentEntry = { id: 'spear', name: 'Spear', kind: 'weapon', systems: ['pf2e'], source: 'official',
    level: 0, traits: [], description: '', data: { hands: 1, damage: '1d6 P' }, effects: [], updatedAt: 1 }
  const first = { id: 'first', name: spear.name, potency: 3, striking: 2, runes: ['Flaming'], verdantWeapon: true }
  const second = { ...first, id: 'second', verdantWeapon: false }
  const hidden = { ...second, id: 'missing', name: 'Unavailable weapon', stowed: true }
  let c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 10, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Verdant Weapon', type: 'Class Feat', level: 1 }], weapons: [first, second, hidden],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const tree = () => ClassFeatures({ c, entries: [spear], save: patch => { c = { ...c, ...patch } } })
  expect(findControl(tree(), 'Verdant Weapon')?.value).toBe('first')
  findControl(tree(), 'Verdant Weapon')!.onChange!({ target: { value: 'second' } })
  expect(c.weapons).toEqual([{ ...first, verdantWeapon: false }, { ...second, verdantWeapon: true }, hidden])
  expect(effectiveWeapon(c, [spear], c.weapons![1])).toMatchObject({ material: 'Peachwood (Standard-Grade)', potency: 3, striking: 2, runes: ['Flaming'] })
  c = { ...c, weapons: c.weapons!.map(item => ({ ...item, stowed: true })) }
  expect(findControl(tree(), 'Verdant Weapon')?.value).toBe('second')
})
