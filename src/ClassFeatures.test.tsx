import { FeatSlots } from './FeatSlots'
import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ClassFeatures } from './ClassFeatures'
import type { Character, ContentEntry } from './types'
import { effectiveWeapon, syncClassArchetypeDedication, warriorLegendWeakness } from './builder'
import { DamageRoll } from './SpellDamage'

function findControl(node: ReactNode, label: string): { value?: string; onChange?: (event: { target: { value: string } }) => void } | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ 'aria-label'?: string; value?: string; onChange?: (event: { target: { value: string } }) => void; children?: ReactNode }>(child)) continue
    if (child.props['aria-label'] === label) return child.props
    const nested = findControl(child.props.children, label)
    if (nested) return nested
  }
}

function findDamageRoll(node: ReactNode, name: string): { damage?: { dice: number }; onRoll?: () => void } | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ name?: string; damage?: { dice: number }; onRoll?: () => void; children?: ReactNode }>(child)) continue
    if (child.type === DamageRoll && child.props.name === name) return child.props
    const nested = findDamageRoll(child.props.children, name)
    if (nested) return nested
  }
}

function findButton(node: ReactNode, label: string): { disabled?: boolean; onClick?: () => void } | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; disabled?: boolean; onClick?: () => void }>(child)) continue
    if (child.type === 'button' && child.props.children === label) return child.props
    const nested = findButton(child.props.children, label)
    if (nested) return nested
  }
}

it('preserves cursed weakness when the dedication is granted', () => {
  let c: Character = { id: 'warrior', systems: ['pf2e'], name: 'Test', level: 1, className: 'Fighter',
    subclass: 'Warrior of Legend', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const tree = () => ClassFeatures({ c, entries: [], save: patch => { c = { ...c, ...patch } } })
  expect(warriorLegendWeakness(c, [])).toBeUndefined()
  expect(findControl(tree(), 'Cursed Weakness')).toBeUndefined()
  c = { ...c, warriorLegendDamageType: 'Slashing' }
  expect(warriorLegendWeakness(c, [])).toEqual({ damage: 'slashing', value: 1 })
  c = { ...c, level: 2 }
  c = { ...c, ...syncClassArchetypeDedication(c, []) }
  expect(c.feats).toContainEqual(expect.objectContaining({ name: 'Warrior of Legend Dedication', choice: 'Slashing' }))
  expect(findControl(tree(), 'Cursed Weakness')).toBeUndefined()
  expect(warriorLegendWeakness(c, [])).toEqual({ damage: 'slashing', value: 1 })
  c = { ...c, feats: c.feats.map(feat => ({ ...feat, choice: 'Piercing' })) }
  expect(warriorLegendWeakness(c, [])?.damage).toBe('piercing')
  c = { ...c, ...syncClassArchetypeDedication(c, []) }
  expect(c.warriorLegendDamageType).toBe('Piercing')
  expect(warriorLegendWeakness({ ...c, level: 1 }, [])?.damage).toBe('piercing')
  const changedClass = { ...c, subclass: undefined }
  const returned = { ...changedClass, ...syncClassArchetypeDedication(changedClass, []), subclass: 'Warrior of Legend', level: 1 }
  expect(warriorLegendWeakness(returned, [])?.damage).toBe('piercing')
  expect(warriorLegendWeakness({ ...c, subclass: undefined }, [])).toBeUndefined()
})

it('tracks Precision Edge damage dice and resets at a new round', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 19, className: 'Ranger', subclass: 'Precision',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const tree = () => ClassFeatures({ c, entries: [], save: patch => { c = { ...c, ...patch } } })
  expect(findDamageRoll(tree(), 'Precision Edge')?.damage?.dice).toBe(3)
  findDamageRoll(tree(), 'Precision Edge')?.onRoll?.()
  expect(c.rangerPrecisionHitsThisRound).toBe(1)
  expect(findDamageRoll(tree(), 'Precision Edge')?.damage?.dice).toBe(2)
  findDamageRoll(tree(), 'Precision Edge')?.onRoll?.()
  expect(c.rangerPrecisionHitsThisRound).toBe(2)
  findDamageRoll(tree(), 'Precision Edge')?.onRoll?.()
  expect(c.rangerPrecisionHitsThisRound).toBe(3)
  expect(findDamageRoll(tree(), 'Precision Edge')).toBeUndefined()
  expect(renderToStaticMarkup(tree())).toContain('Precision Edge damage used this round')
  expect(findButton(tree(), 'Reset for new round')?.disabled).toBe(false)
  findButton(tree(), 'Reset for new round')?.onClick?.()
  expect(c.rangerPrecisionHitsThisRound).toBe(0)
  expect(findDamageRoll(tree(), 'Precision Edge')?.damage?.dice).toBe(3)
})

it('lists class features beside class feats with description buttons and no remove control', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feature = (name: string, level: number): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'classFeature', source: 'official', name, level, traits: [],
    description: 'Feature text.', data: { class: 'Ranger' }, effects: [], updatedAt: 0,
  })
  const features = [feature('First Feature', 1), feature('Later Feature', 10)]
  const markup = renderToStaticMarkup(
    <FeatSlots c={c} entries={features} save={() => {}} categories={['class']} features={features} />,
  )
  expect(markup).toContain('>First Feature<')
  expect(markup).toContain('>Later Feature<')
  expect(markup).not.toContain('aria-label="Remove First Feature')
  expect(markup.indexOf('First Feature')).toBeLessThan(markup.indexOf('Later Feature'))
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
  expect(effectiveWeapon(c, [sword], weapon)).toEqual({ ...weapon, material: 'Cold Iron (Standard-Grade)', potency: 2, striking: 1 })
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

it('selects one proficient equipped Osteo Armament while preserving saved gear and stowed choices', () => {
  const spear: ContentEntry = { id: 'spear', name: 'Spear', kind: 'weapon', systems: ['pf2e'], source: 'official',
    level: 0, traits: [], description: '', data: { weapon_category: 'Simple', hands: 1, damage: '1d6 P' }, effects: [], updatedAt: 1 }
  const advanced = { ...spear, id: 'advanced', name: 'Advanced weapon', data: { ...spear.data, weapon_category: 'Advanced' } }
  const necromancer: ContentEntry = { ...spear, id: 'necromancer', name: 'Necromancer', kind: 'class',
    data: { attack_proficiency: 'Trained in simple weapons' } }
  const first = { id: 'first', name: spear.name, potency: 3, striking: 2, runes: ['Flaming'], material: 'Cold Iron', osteoArmament: true }
  const second = { ...first, id: 'second', osteoArmament: false }
  const hidden = { ...second, id: 'hidden', stowed: true }
  const untrained = { ...second, id: 'untrained', name: advanced.name }
  let c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 15, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Osteo Armaments', type: 'Class Feat', level: 4 }], weapons: [first, second, hidden, untrained],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const tree = () => ClassFeatures({ c, entries: [spear, advanced, necromancer], save: patch => { c = { ...c, ...patch } } })
  expect(findControl(tree(), 'Osteo Armaments')?.value).toBe('first')
  for (const id of ['hidden', 'untrained', 'missing']) {
    findControl(tree(), 'Osteo Armaments')!.onChange!({ target: { value: id } })
    expect(c.weapons).toEqual([first, second, hidden, untrained])
  }
  findControl(tree(), 'Osteo Armaments')!.onChange!({ target: { value: 'second' } })
  expect(c.weapons).toEqual([{ ...first, osteoArmament: false }, { ...second, osteoArmament: true }, hidden, untrained])
  expect(effectiveWeapon(c, [spear, necromancer], c.weapons![1])).toMatchObject({
    material: undefined, potency: 3, striking: 2, runes: ['Flaming', 'Decaying (Greater)'],
  })
  c = { ...c, weapons: c.weapons!.map(item => ({ ...item, stowed: true })) }
  expect(findControl(tree(), 'Osteo Armaments')?.value).toBe('second')
  expect(renderToStaticMarkup(tree())).toContain('not equipped or unavailable')
  findControl(tree(), 'Osteo Armaments')!.onChange!({ target: { value: '' } })
  expect(c.weapons!.some(weapon => weapon.osteoArmament)).toBe(false)
  expect(c.weapons![1].material).toBe('Cold Iron')
  c = { ...c, level: 3 }
  expect(findControl(tree(), 'Osteo Armaments')).toBeUndefined()
})
