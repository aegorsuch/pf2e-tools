import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { DamageRoll, rollSpellDamage, spellActionRolls, spellDamage, SpellActions, SpellDamageRolls } from './SpellDamage'
import { SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'

vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useState: vi.fn(react.useState) }
})

afterEach(() => vi.restoreAllMocks())

it.each([[1, 2], [5, 6], [10, 11]])('scales Electric Arc, Frostbite, and Gouging Claw at rank %i', (rank, dice) => {
  for (const [name, sides, type] of [
    ['Electric Arc', 4, 'electricity'], ['Frostbite', 4, 'cold'], ['Gouging Claw', 6, 'piercing or slashing'],
  ] as const) {
    const entry: ContentEntry = { id: name, name, systems: ['pf2e'], kind: 'spell',
      source: 'official', level: 1, traits: ['Cantrip'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
    const damage = spellDamage(name, rank)[0]
    expect(damage).toMatchObject({ dice, sides, type })
    expect(spellDamage(name, 0)).toEqual([])
    expect(renderToStaticMarkup(<SpellActions name={name} rank={rank} entry={entry} />))
      .toContain(`${dice}d${sides} ${type}`)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(rollSpellDamage(damage)).toBe(dice)
    vi.mocked(Math.random).mockReturnValue(0.999999)
    expect(rollSpellDamage(damage)).toBe(dice * sides)
    vi.restoreAllMocks()
  }
  expect(spellDamage('Frostbite', rank)[0].note).toContain(`weakness ${rank}`)
  expect(spellDamage('Gouging Claw', rank)[0].note).toContain(`${rank + 1} persistent bleed`)
})

it.each([[1, 1], [3, 2], [5, 3], [9, 5]])('scales Caustic Blast rank %i to %id8 acid', (rank, dice) => {
  const entry: ContentEntry = { id: 'caustic-blast', name: 'Caustic Blast', systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Cantrip', 'Acid'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toMatchObject({ label: 'Damage', dice, sides: 8, type: 'acid',
    note: `Critical failure: ${dice} persistent acid` })
  expect(spellDamage(entry.name, 0)).toEqual([])
  expect(spellActionRolls(entry.name, rank, entry)).toMatchObject([{ actions: 'Two Actions', damage }])
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d8 acid; Critical failure: ${dice} persistent acid"`)
})

it('rolls every Cataclysm component once with conditional damage identified', () => {
  const entry: ContentEntry = { id: 'cataclysm', name: 'Cataclysm', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 10, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 9)).toEqual([])
  const rolls = spellActionRolls(entry.name, 10, entry)
  expect(rolls).toHaveLength(1)
  const save = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, save])
  const tree = DamageRoll({ name: entry.name, damage: rolls[0].damage, actions: rolls[0].actions })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw new Error('Missing Cataclysm roll')
  const random = vi.spyOn(Math, 'random')
  for (let i = 0; i < 21; i++) random.mockReturnValueOnce(Math.floor(i / 3) / 10)
  button.props.onClick()
  expect(random).toHaveBeenCalledTimes(21)
  expect(save).toHaveBeenCalledWith([3, 6, 9, 12, 15, 18, 21])
  vi.mocked(useState).mockReturnValueOnce([[3, 6, 9, 12, 15, 18, 21], vi.fn()])
  const html = renderToStaticMarkup(<DamageRoll name={entry.name} damage={rolls[0].damage} actions="Two Actions" />)
  for (const text of ['3 acid', '6 bludgeoning (grounded)', '9 cold', '12 electricity',
    '15 bludgeoning (flying)', '18 bludgeoning (tsunami; double if swimming)', '21 fire',
    'Treat resistances as 10 lower']) expect(html).toContain(text)
})

it('records a limited damage roll once and refuses disabled rolls', () => {
  const onRoll = vi.fn()
  const damage = { label: 'Damage', dice: 2, sides: 8, type: 'fire' }
  const run = (disabled: boolean) => {
    vi.mocked(useState).mockReturnValueOnce([undefined, vi.fn()])
    const tree = DamageRoll({ name: 'Test', damage, disabled, onRoll })
    const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
    if (!isValidElement<{ onClick: () => void }>(button)) throw new Error('Missing damage roll')
    button.props.onClick()
  }
  run(false)
  run(true)
  expect(onRoll).toHaveBeenCalledTimes(1)
})

it('rolls and rerolls all ten Primal Howl dice when its two-action button is clicked and announces the total', () => {
  const damage = { label: 'Damage', dice: 10, sides: 6, type: 'sonic' }
  const setResult = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, setResult])
  const tree = DamageRoll({ name: 'Primal Howl', damage, actions: 'Two Actions' })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw new Error('Missing damage roll button')
  vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  button.props.onClick()
  expect(Math.random).toHaveBeenCalledTimes(10)
  expect(setResult).toHaveBeenLastCalledWith(60)
  vi.mocked(Math.random).mockReturnValue(0)
  button.props.onClick()
  expect(Math.random).toHaveBeenCalledTimes(20)
  expect(setResult).toHaveBeenLastCalledWith(10)
  vi.mocked(useState).mockReturnValueOnce([10, setResult])
  const html = renderToStaticMarkup(<DamageRoll name="Primal Howl" damage={damage} actions="Two Actions" />)
  expect(html).toContain('title="Two Actions; Damage: 10d6 sonic"')
  expect(html).toContain('<output aria-live="polite" aria-label="Primal Howl: Damage result"> 10 sonic</output>')
})

it.each([['Heal Companion', 10], ['Heal Animal', 8]] as const)('maps %s action icons to their own heightened healing formulas', (name, sides) => {
  const rolls = spellActionRolls(name, 5)
  expect(rolls.map(roll => roll.actions)).toEqual(['One Action', 'Two Actions'])
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rolls.map(roll => rollSpellDamage(roll.damage))).toEqual([5, 45])
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rolls.map(roll => rollSpellDamage(roll.damage))).toEqual([5 * sides, 5 * sides + 40])
  const markup = renderToStaticMarkup(<SpellActions name={name} rank={5} />)
  expect(markup).toContain(`aria-label="Roll ${name}: 1-action healing"`)
  expect(markup).toContain(`aria-label="Roll ${name}: 2-action healing"`)
  expect(markup).toContain(`title="One Action; 1-action healing: 5d${sides} HP"`)
  expect(markup).toContain(`title="Two Actions; 2-action healing: 5d${sides}+40 HP"`)
  expect(markup.match(/<button /g)).toHaveLength(2)
})

it('uses a spell action icon for a supported damage roll and keeps non-rolling spell actions passive', () => {
  const entry: ContentEntry = { id: 'slime', name: 'Slime Spit', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellActionRolls(entry.name, 3, entry)).toMatchObject([{ actions: 'Two Actions', damage: { dice: 6, sides: 6 } }])
  const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={3} entry={entry} />)
  expect(markup).toContain('aria-label="Roll Slime Spit: Damage"')
  expect(markup).toContain('6d6 poison')
  const passive = renderToStaticMarkup(<SpellActions name="Sure Strike" rank={1} entry={{ ...entry, name: 'Sure Strike' }} />)
  expect(passive).toContain('aria-label="Two Actions"')
  expect(passive).not.toContain('<button')
  const multiple = renderToStaticMarkup(<SpellActions name="Pulverizing Wake" rank={7} entry={entry} />)
  expect(multiple).toContain('<small>Strike bonus</small>')
  expect(multiple).toContain('<small>Cone</small>')
  expect(multiple).toContain('3d8 sonic')
  expect(multiple).toContain('8d8 sonic')
})

it('rolls verified Fireball, Void Warp, and Deathly Scream formulas at heightened ranks', () => {
  const fireball: ContentEntry = { id: 'fireball', name: 'Fireball', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 3, traits: [], data: { actions: 'Two Actions' }, effects: [], updatedAt: 1,
    description: 'A roaring blast detonates, dealing 6d6 fire damage.\n\nHeightened (+1) The damage increases by 2d6.' }
  expect(spellActionRolls('Fireball', 5, fireball)).toMatchObject([
    { actions: 'Two Actions', damage: { dice: 10, sides: 6, type: 'fire' } },
  ])
  expect(renderToStaticMarkup(<SpellActions name="Fireball" rank={5} entry={fireball} />))
    .toContain('title="Two Actions; Damage: 10d6 fire"')
  expect(spellDamage('Void Warp', 5)).toMatchObject([{ dice: 6, sides: 4, type: 'void' }])
  expect(spellDamage('Deathly Scream', 5)).toMatchObject([{ dice: 5, sides: 4, type: 'mental' }])
  expect(spellActionRolls('Harm', 5).map(roll => [roll.actions, roll.damage.dice]))
    .toEqual([['One Action', 5], ['Two Actions', 5], ['Three Actions', 5]])
  expect(spellActionRolls('Fireball', 2, fireball)).toEqual([])
})

it.each([[1, 3], [5, 7], [10, 12]])('scales Needle Darts at rank %i to %id4 piercing', (rank, dice) => {
  const entry: ContentEntry = { id: 'needle', name: 'Needle Darts', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Cantrip'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toEqual({ label: 'Damage', dice, sides: 4, type: 'piercing' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d4 piercing"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(dice * 4)
})

it('shows only the rolled Needle Darts damage', () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  const markup = renderToStaticMarkup(<DamageRoll name="Needle Darts" damage={spellDamage('Needle Darts', 5)[0]} actions="Two Actions" />)
  expect(markup).toContain('17 piercing</output>')
  expect(markup).not.toContain('critical:')
  expect(markup).not.toContain('persistent bleed')
})

it.each([[1, 2], [5, 6], [10, 11]])('rolls Telekinetic Projectile at rank %i as %id6', (rank, dice) => {
  const entry: ContentEntry = { id: 'telekinetic-projectile', name: 'Telekinetic Projectile', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Cantrip'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const rolls = spellActionRolls(entry.name, rank, entry)
  expect(rolls).toHaveLength(1)
  expect(rolls[0].damage).toEqual({ label: 'Damage', dice, sides: 6, type: 'B/P/S' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d6 B/P/S"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(rolls[0].damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(rolls[0].damage)).toBe(dice * 6)
  expect(spellDamage(entry.name, 0)).toEqual([])
})

it('shows only the rolled Telekinetic Projectile damage', () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  const markup = renderToStaticMarkup(<DamageRoll name="Telekinetic Projectile" damage={spellDamage('Telekinetic Projectile', 5)[0]} actions="Two Actions" />)
  expect(markup).toContain('17 B/P/S</output>')
  expect(markup).not.toContain('critical:')
})

it.each([[1, 1], [2, 1], [3, 2], [5, 3], [10, 5]])('rolls Injury Echo at rank %i with %i dice per damage type', (rank, dice) => {
  const entry: ContentEntry = { id: 'injury-echo', name: 'Injury Echo', systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Cantrip'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const rolls = spellActionRolls(entry.name, rank, entry)
  expect(rolls).toHaveLength(1)
  expect(rolls[0].damage).toEqual({ label: 'Damage', dice, sides: 8, type: 'B/P/S',
    additional: { label: 'Conditional persistent bleed', dice, sides: 4, type: 'bleed' } })
  const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />)
  expect(markup.match(/<button /g)).toHaveLength(1)
  expect(markup).toContain(`title="Two Actions; Damage: ${dice}d8 B/P/S; Conditional persistent bleed: ${dice}d4 bleed"`)
  expect(spellDamage(entry.name, 0)).toEqual([])
})

it('rolls Injury Echo damage and conditional bleed independently with one click', () => {
  const damage = spellDamage('Injury Echo', 3)[0]
  const save = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, save])
  const tree = DamageRoll({ name: 'Injury Echo', damage, actions: 'Two Actions' })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing Injury Echo roll')
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  random.mockReturnValueOnce(0).mockReturnValueOnce(0)
  button.props.onClick()
  expect(random).toHaveBeenCalledTimes(4)
  expect(save).toHaveBeenCalledWith({ primary: 2, additional: 8 })
  vi.mocked(useState).mockReturnValueOnce([{ primary: 2, additional: 8 }, vi.fn()])
  const markup = renderToStaticMarkup(<DamageRoll name="Injury Echo" damage={damage} actions="Two Actions" />)
  expect(markup).toContain('Damage: 2 B/P/S; Conditional persistent bleed: 8 bleed')
})

it.each([[1, 1], [2, 1], [3, 2], [5, 3], [10, 5]])('rolls Haunting Hymn at rank %i as %id8 sonic', (rank, dice) => {
  const entry: ContentEntry = { id: 'haunting-hymn', name: 'Haunting Hymn', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Cantrip'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const rolls = spellActionRolls(entry.name, rank, entry)
  expect(rolls).toHaveLength(1)
  expect(rolls[0].damage).toEqual({ label: 'Damage', dice, sides: 8, type: 'sonic' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d8 sonic"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(rolls[0].damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(rolls[0].damage)).toBe(dice * 8)
  expect(spellDamage(entry.name, 0)).toEqual([])
})

it('shows only the rolled Haunting Hymn damage', () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  const markup = renderToStaticMarkup(<DamageRoll name="Haunting Hymn" damage={spellDamage('Haunting Hymn', 5)[0]} actions="Two Actions" />)
  expect(markup).toContain('17 sonic</output>')
  expect(markup).not.toContain('critical:')
})

it.each([[3, 3], [4, 4], [10, 10]])('rolls Bonewall Bulwark at rank %i as %id10 bludgeoning', (rank, dice) => {
  const entry: ContentEntry = { id: 'bonewall-bulwark', name: 'Bonewall Bulwark', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 3, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const rolls = spellActionRolls(entry.name, rank, entry)
  expect(rolls).toHaveLength(1)
  expect(rolls[0].damage).toEqual({ label: 'Wall attack', dice, sides: 10, type: 'bludgeoning' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Wall attack: ${dice}d10 bludgeoning"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(rolls[0].damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(rolls[0].damage)).toBe(dice * 10)
  expect(spellDamage(entry.name, 2)).toEqual([])
})

it('shows only the rolled Bonewall Bulwark damage', () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  const markup = renderToStaticMarkup(<DamageRoll name="Bonewall Bulwark" damage={spellDamage('Bonewall Bulwark', 5)[0]} actions="Two Actions" />)
  expect(markup).toContain('17 bludgeoning</output>')
  expect(markup).not.toContain('critical:')
})

it.each([[3, 2, 4], [4, 3, 6], [10, 9, 18]])("rolls Moth's Supper at rank %i as %id4 healing and %id4 Treat Wounds bonus", (rank, healing, wounds) => {
  const entry: ContentEntry = { id: 'moths-supper', name: "Moth's Supper", systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 3, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const rolls = spellActionRolls(entry.name, rank, entry)
  expect(rolls.map(roll => roll.damage)).toEqual([
    { label: '10-minute healing', dice: healing, sides: 4, type: 'HP',
      additional: { label: 'Treat Wounds bonus', dice: wounds, sides: 4, type: 'HP' } },
  ])
  const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />)
  expect(markup.match(/<button /g)).toHaveLength(1)
  expect(markup).toContain('10-minute healing and Treat Wounds bonus')
  expect(markup).toContain(`title="Two Actions; 10-minute healing: ${healing}d4 HP; Treat Wounds bonus: ${wounds}d4 HP"`)
  expect(spellDamage(entry.name, 2)).toEqual([])
})

it("rolls Moth's Supper healing independently with one click", () => {
  const damage = spellDamage("Moth's Supper", 3)[0]
  const save = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, save])
  const tree = DamageRoll({ name: "Moth's Supper", damage, actions: 'Two Actions' })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing healing roll')
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  random.mockReturnValueOnce(0).mockReturnValueOnce(0)
  button.props.onClick()
  expect(random).toHaveBeenCalledTimes(6)
  expect(save).toHaveBeenCalledWith({ primary: 2, additional: 16 })
  vi.mocked(useState).mockReturnValueOnce([{ primary: 2, additional: 16 }, vi.fn()])
  const markup = renderToStaticMarkup(<DamageRoll name="Moth's Supper" damage={damage} actions="Two Actions" />)
  expect(markup).toContain('10-minute healing: 2 HP; Treat Wounds bonus: 16 HP')
})

it.each([[1, 2], [4, 8], [10, 20]])('rolls Grim Tendrils rank %i as %id4 void', (rank, dice) => {
  const entry: ContentEntry = { id: 'grim', name: 'Grim Tendrils', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toEqual({ label: 'Damage', dice, sides: 4, type: 'void' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d4 void"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(dice * 4)
})

it('shows only rolled Grim Tendrils damage', () => {
  vi.mocked(useState).mockReturnValueOnce([7, vi.fn()])
  const html = renderToStaticMarkup(<DamageRoll name="Grim Tendrils" damage={spellDamage('Grim Tendrils', 3)[0]} actions="Two Actions" />)
  expect(html).toContain('7 void</output>')
  expect(html).not.toContain('persistent bleed')
  expect(spellDamage('Grim Tendrils', 0)).toEqual([])
})

it('rolls Shadow Army mental and bludgeoning damage separately from one action', () => {
  const entry: ContentEntry = { id: 'shadow-army', name: 'Shadow Army', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 10, traits: [], description: '', data: { actions: 'Three Actions' }, effects: [], updatedAt: 1 }
  const rolls = spellActionRolls(entry.name, 10, entry)
  expect(rolls).toHaveLength(1)
  expect(spellDamage(entry.name, 9)).toEqual([])
  const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={10} entry={entry} />)
  expect(markup).toContain('title="Three Actions; Damage: 3d10 mental + 3d10 bludgeoning"')
  expect(markup.match(/<button /g)).toHaveLength(1)
  const save = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, save])
  const tree = DamageRoll({ name: entry.name, damage: rolls[0].damage, actions: rolls[0].actions })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing Shadow Army roll')
  vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0)
    .mockReturnValueOnce(0.999999).mockReturnValueOnce(0.999999).mockReturnValueOnce(0.999999)
  button.props.onClick()
  expect(save).toHaveBeenCalledWith({ primary: 3, additional: 30 })
  vi.mocked(useState).mockReturnValueOnce([{ primary: 3, additional: 30 }, vi.fn()])
  expect(renderToStaticMarkup(<DamageRoll name={entry.name} damage={rolls[0].damage} actions="Three Actions" />))
    .toContain('3 mental + 30 bludgeoning')
})

it.each([[2, 1], [3, 1], [4, 2], [9, 4], [10, 5]])('rolls Blood Runs Cold at rank %i as %id6 persistent cold', (rank, dice) => {
  const entry: ContentEntry = { id: 'blood', name: 'Blood Runs Cold', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 2, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toMatchObject({ dice, sides: 6, type: 'persistent cold' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d6 persistent cold"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(dice * 6)
})

it('does not offer Blood Runs Cold damage below rank 2', () => {
  expect(spellDamage('Blood Runs Cold', 1)).toEqual([])
})

it.each([[4, 2], [5, 2], [6, 3], [10, 5]])('rolls Bloodspray Curse rank %i with %id6 for each applicable damage type', (rank, dice) => {
  const entry: ContentEntry = { id: 'bloodspray', name: 'Bloodspray Curse', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 4, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const roll = spellActionRolls(entry.name, rank, entry)[0]
  expect(roll.damage).toMatchObject({ dice, sides: 6, type: 'piercing or slashing',
    additional: { dice, sides: 6, type: 'persistent bleed (failure only)' } })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Strike bonus: ${dice}d6 piercing or slashing + ${dice}d6 persistent bleed (failure only)"`)
})

it('rolls Bloodspray Curse strike and failure bleed damage separately', () => {
  const damage = spellDamage('Bloodspray Curse', 4)[0]
  const save = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, save])
  const tree = DamageRoll({ name: 'Bloodspray Curse', damage, actions: 'Two Actions' })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing Bloodspray Curse roll')
  vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0)
    .mockReturnValueOnce(0.999999).mockReturnValueOnce(0.999999)
  button.props.onClick()
  expect(save).toHaveBeenCalledWith({ primary: 2, additional: 12 })
  vi.mocked(useState).mockReturnValueOnce([{ primary: 2, additional: 12 }, vi.fn()])
  expect(renderToStaticMarkup(<DamageRoll name="Bloodspray Curse" damage={damage} actions="Two Actions" />))
    .toContain('2 piercing or slashing + 12 persistent bleed (failure only)')
  expect(spellDamage('Bloodspray Curse', 3)).toEqual([])
})

it.each([[5, 5], [6, 6], [10, 10]])('rolls Blood-Feasting Breath at rank %i as %id6 void', (rank, dice) => {
  const entry: ContentEntry = { id: 'blood-feasting', name: 'Blood-Feasting Breath', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 5, traits: [], description: '', data: { actions: 'Three Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toMatchObject({ dice, sides: 6, type: 'void' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Three Actions; Damage: ${dice}d6 void"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(dice * 6)
})

it('shows Blood-Feasting Breath damage without save outcomes', () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  expect(renderToStaticMarkup(<DamageRoll name="Blood-Feasting Breath" damage={spellDamage('Blood-Feasting Breath', 5)[0]} actions="Three Actions" />))
    .toContain('17 void</output>')
  expect(spellDamage('Blood-Feasting Breath', 4)).toEqual([])
})

it.each([[6, 6], [7, 7], [10, 10]])("rolls Poltergeist's Fury at rank %i as %id4 piercing", (rank, dice) => {
  const entry: ContentEntry = { id: 'poltergeist', name: "Poltergeist's Fury", systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 6, traits: [], description: '', data: { actions: 'Three Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toMatchObject({ dice, sides: 4, type: 'piercing' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Three Actions; Damage: ${dice}d4 piercing"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(dice * 4)
})

it("shows Poltergeist's Fury damage without save outcomes", () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  expect(renderToStaticMarkup(<DamageRoll name="Poltergeist's Fury" damage={spellDamage("Poltergeist's Fury", 6)[0]} actions="Three Actions" />))
    .toContain('17 piercing</output>')
  expect(spellDamage("Poltergeist's Fury", 5)).toEqual([])
})

it.each([[7, 7], [8, 8], [10, 10]])('rolls Devouring Void at rank %i as %id8 void', (rank, dice) => {
  const entry: ContentEntry = { id: 'devouring-void', name: 'Devouring Void', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 7, traits: [], description: '', data: { actions: 'Three Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toMatchObject({ dice, sides: 8, type: 'void' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Three Actions; Damage: ${dice}d8 void"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(dice * 8)
})

it('shows Devouring Void damage without save outcomes', () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  expect(renderToStaticMarkup(<DamageRoll name="Devouring Void" damage={spellDamage('Devouring Void', 7)[0]} actions="Three Actions" />))
    .toContain('17 void</output>')
  expect(spellDamage('Devouring Void', 6)).toEqual([])
})

it.each([8, 9, 10])('rolls Canticle of Everlasting Grief at rank %i as 10d6 mental', rank => {
  const entry: ContentEntry = { id: 'canticle', name: 'Canticle of Everlasting Grief', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 8, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toMatchObject({ dice: 10, sides: 6, type: 'mental' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain('title="Two Actions; Damage: 10d6 mental"')
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(10)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(60)
})

it('shows Canticle of Everlasting Grief damage without save outcomes', () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  expect(renderToStaticMarkup(<DamageRoll name="Canticle of Everlasting Grief" damage={spellDamage('Canticle of Everlasting Grief', 8)[0]} actions="Two Actions" />))
    .toContain('17 mental</output>')
  expect(spellDamage('Canticle of Everlasting Grief', 7)).toEqual([])
})

it.each([9, 10])('rolls Vampiric Revelry at rank %i as 12d6 void without duration helper text', rank => {
  const entry: ContentEntry = { id: 'vampiric', name: 'Vampiric Revelry', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 9, traits: [], description: '', data: { actions: 'Two Actions to 2 rounds' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toMatchObject({ dice: 12, sides: 6, type: 'void' })
  const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />)
  expect(markup).toContain('title="Two Actions; Damage: 12d6 void"')
  expect(markup).not.toContain('to 2 rounds')
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(12)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(72)
})

it('shows Vampiric Revelry damage without save outcomes', () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  expect(renderToStaticMarkup(<DamageRoll name="Vampiric Revelry" damage={spellDamage('Vampiric Revelry', 9)[0]} actions="Two Actions" />))
    .toContain('17 void</output>')
  expect(spellDamage('Vampiric Revelry', 8)).toEqual([])
})

it.each([[6, 12], [7, 14], [10, 20]])('rolls Necrotize at rank %i as %id6 void', (rank, dice) => {
  const entry: ContentEntry = { id: 'necrotize', name: 'Necrotize', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 6, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toMatchObject({ dice, sides: 6, type: 'void' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d6 void"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(dice * 6)
})

it('shows Necrotize damage without save outcomes', () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  expect(renderToStaticMarkup(<DamageRoll name="Necrotize" damage={spellDamage('Necrotize', 6)[0]} actions="Two Actions" />))
    .toContain('17 void</output>')
  expect(spellDamage('Necrotize', 5)).toEqual([])
})

it.each([[6, 11], [7, 13], [10, 19]])('rolls Phantasmal Calamity at rank %i as %id6 mental', (rank, dice) => {
  const entry: ContentEntry = { id: 'phantasmal', name: 'Phantasmal Calamity', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 6, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toMatchObject({ dice, sides: 6, type: 'mental' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d6 mental"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(dice * 6)
})

it('shows Phantasmal Calamity damage without save outcomes', () => {
  vi.mocked(useState).mockReturnValueOnce([17, vi.fn()])
  expect(renderToStaticMarkup(<DamageRoll name="Phantasmal Calamity" damage={spellDamage('Phantasmal Calamity', 6)[0]} actions="Two Actions" />))
    .toContain('17 mental</output>')
  expect(spellDamage('Phantasmal Calamity', 5)).toEqual([])
})

it('rolls Tear the Veil once and shows damage for each save', () => {
  const entry: ContentEntry = { id: 'tear', name: 'Tear the Veil', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 10, traits: [], description: '', data: { actions: 'Three Actions' }, effects: [], updatedAt: 1 }
  const rolls = spellActionRolls(entry.name, 10, entry)
  expect(rolls).toHaveLength(1)
  const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={10} entry={entry} />)
  expect(markup.match(/<button /g)).toHaveLength(1)
  expect(markup).toContain('title="Three Actions; Damage: 5d12 / 10d12 / 20d12 void"')
  const save = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, save])
  const tree = DamageRoll({ name: entry.name, damage: rolls[0].damage, actions: rolls[0].actions })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing Tear the Veil roll')
  const random = vi.spyOn(Math, 'random')
  for (let i = 0; i < 5; i++) random.mockReturnValueOnce(0)
  for (let i = 0; i < 5; i++) random.mockReturnValueOnce(1 / 12)
  for (let i = 0; i < 10; i++) random.mockReturnValueOnce(2 / 12)
  button.props.onClick()
  expect(random).toHaveBeenCalledTimes(20)
  expect(save).toHaveBeenCalledWith([5, 15, 45])
  vi.mocked(useState).mockReturnValueOnce([[5, 15, 45], vi.fn()])
  const output = renderToStaticMarkup(<DamageRoll name={entry.name} damage={rolls[0].damage} actions="Three Actions" />)
  expect(output).toContain('Success: 5 void')
  expect(output).toContain('Failure: 15 void')
  expect(output).toContain('Critical failure: 45 void')
  expect(spellDamage(entry.name, 9)).toEqual([])
})

it.each([[4, 2], [5, 2], [6, 3], [10, 5]])('rolls Whispers of the Void at rank %i using %id8 for success', (rank, successDice) => {
  const entry: ContentEntry = { id: 'whispers', name: 'Whispers of the Void', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 4, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const rolls = spellActionRolls(entry.name, rank, entry)
  expect(rolls).toHaveLength(1)
  expect(rolls[0].damage).toMatchObject({ dice: 2 * successDice, sides: 8, type: 'persistent void',
    outcomes: [{ label: 'Success', dice: successDice }, { label: 'Failure or critical failure', dice: 2 * successDice }] })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${successDice}d8 / ${2 * successDice}d8 persistent void"`)
  expect(spellDamage(entry.name, 3)).toEqual([])
})

it('rolls both Whispers of the Void damage pools with one action', () => {
  const damage = spellDamage('Whispers of the Void', 4)[0]
  const save = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, save])
  const tree = DamageRoll({ name: 'Whispers of the Void', damage, actions: 'Two Actions' })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing Whispers of the Void roll')
  vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0)
    .mockReturnValueOnce(0.999999).mockReturnValueOnce(0.999999)
  button.props.onClick()
  expect(save).toHaveBeenCalledWith([2, 18])
  vi.mocked(useState).mockReturnValueOnce([[2, 18], vi.fn()])
  const markup = renderToStaticMarkup(<DamageRoll name="Whispers of the Void" damage={damage} actions="Two Actions" />)
  expect(markup).toContain('Success: 2 persistent void')
  expect(markup).toContain('Failure or critical failure: 18 persistent void')
})

it.each([[5, 10], [7, 14], [10, 20]])('rolls Grisly Growths at rank %i as %id6 piercing', (rank, dice) => {
  const entry: ContentEntry = { id: 'grisly', name: 'Grisly Growths', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 5, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const roll = spellActionRolls(entry.name, rank, entry)[0]
  expect(roll).toMatchObject({ actions: 'Two Actions', damage: { dice, sides: 6, type: 'piercing' } })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d6 piercing"`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(roll.damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(roll.damage)).toBe(dice * 6)
})

it('does not offer Grisly Growths damage below rank 5', () => {
  expect(spellDamage('Grisly Growths', 4)).toEqual([])
})

it.each([[7, 70], [8, 80], [10, 100]])('shows Execute damage at rank %i as %i void or vitality', (rank, amount) => {
  const entry: ContentEntry = { id: 'execute', name: 'Execute', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 7, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const rolls = spellActionRolls(entry.name, rank, entry)
  expect(rolls.map(roll => [roll.actions, roll.damage.type, rollSpellDamage(roll.damage)]))
    .toEqual([['Two Actions', 'vitality or void', amount]])
  const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />)
  expect(markup).toContain(`title="Two Actions; Damage: ${amount} vitality or void"`)
  expect(markup.match(/<button /g)).toHaveLength(1)
  expect(markup).not.toContain('0d')
})

it('shows Execute damage and both possible types after rolling', () => {
  vi.mocked(useState).mockReturnValueOnce([70, vi.fn()])
  const markup = renderToStaticMarkup(<DamageRoll name="Execute" damage={spellDamage('Execute', 7)[0]} actions="Two Actions" />)
  expect(markup).toContain('> 70 vitality or void</output>')
})

it.each([[8, 10], [9, 11], [10, 12]])('rolls Desiccate at rank %i as %id10 void', (rank, dice) => {
  expect(spellDamage('Desiccate', rank)).toEqual([{ label: 'Damage', dice, sides: 10, type: 'void' }])
})

it.each([[9, 9], [10, 10]])('shows only Massacre rank %i success damage', (rank, dice) => {
  const entry: ContentEntry = { id: 'massacre', name: 'Massacre', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 9, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const rolls = spellActionRolls(entry.name, rank, entry)
  expect(rolls.map(roll => roll.damage)).toEqual([
    { label: 'Success', dice, sides: 6, type: 'void' },
  ])
  const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />)
  expect(markup).toContain(`title="Two Actions; Success: ${dice}d6 void"`)
  expect(markup.match(/<button /g)).toHaveLength(1)
  expect(markup).not.toContain('Failure')
  expect(markup).not.toContain('Backlash')
})

it('does not offer high-rank spell damage below its base rank', () => {
  expect(spellDamage('Execute', 6)).toEqual([])
  expect(spellDamage('Desiccate', 7)).toEqual([])
  expect(spellDamage('Massacre', 8)).toEqual([])
})

it.each([
  ['Slime Spit', 1, 2, 6], ['Slime Spit', 10, 20, 6],
  ['Warning Stripes', 3, 2, 8], ['Warning Stripes', 4, 2, 8], ['Warning Stripes', 5, 3, 8], ['Warning Stripes', 10, 5, 8],
  ["Ranger's Bramble", 3, 2, 4], ["Ranger's Bramble", 10, 9, 4],
  ['Gluttonous Growth', 5, 4, 6], ['Gluttonous Growth', 10, 14, 6],
])('scales %s at rank %i to %id%i', (name, rank, dice, sides) => {
  expect(spellDamage(name, rank)).toMatchObject([{ dice, sides }])
  const markup = renderToStaticMarkup(<SpellDamageRolls name={name} rank={rank} />)
  expect(markup).toContain(`${dice}d${sides}`)
  expect(markup).toContain(`aria-label="Roll ${name.replaceAll("'", '&#x27;')}:`)
})

it('keeps Pulverizing Wake strike bonus fixed while heightening its separate cone roll', () => {
  for (const rank of [5, 6, 10]) {
    expect(spellDamage('Pulverizing Wake', rank)).toEqual([
      { label: 'Strike bonus', dice: 3, sides: 8, type: 'sonic' },
      { label: 'Cone', dice: 6 + rank - 5, sides: 8, type: 'sonic' },
    ])
    const markup = renderToStaticMarkup(<SpellDamageRolls name="Pulverizing Wake" rank={rank} />)
    expect(markup).toContain('aria-label="Roll Pulverizing Wake: Strike bonus"')
    expect(markup).toContain('aria-label="Roll Pulverizing Wake: Cone"')
  }
})

it('rolls every damage die, includes endpoints, and returns only the total', () => {
  vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.999999)
  const damage = spellDamage('Slime Spit', 1)[0]
  expect(rollSpellDamage(damage)).toBe(7)
})

it.each([['Heal Companion', 10], ['Heal Animal', 8]] as const)('scales both %s action versions and includes the two-action flat healing', (name, sides) => {
  vi.spyOn(Math, 'random').mockReturnValue(0)
  for (const rank of [1, 5, 10]) {
    const healing = spellDamage(name, rank)
    expect(healing).toEqual([
      { label: '1-action healing', dice: rank, sides, type: 'HP' },
      { label: '2-action healing', dice: rank, sides, bonus: 8 * rank, type: 'HP' },
    ])
    expect(rollSpellDamage(healing[0])).toBe(rank)
    expect(rollSpellDamage(healing[1])).toBe(9 * rank)
    const markup = renderToStaticMarkup(<SpellDamageRolls name={name} rank={rank} />)
    expect(markup).toContain(`1-action healing: ${rank}d${sides} HP`)
    expect(markup).toContain(`2-action healing: ${rank}d${sides}+${8 * rank} HP`)
  }
})

it('renders rank-scaled rollers beside owned spells and omits unavailable spell damage', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 19, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    spells: ['Heal Animal', 'Slime Spit', 'Warning Stripes', "Ranger's Bramble", 'Gluttonous Growth', 'Pulverizing Wake']
      .map((name) => ({ name, rank: 1, cantrip: false })),
  }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Damage: 20d6 poison')
  expect(markup).toContain('Contact damage: 5d8 poison')
  expect(markup).toContain('Critical failure: 9d4 persistent bleed')
  expect(markup).toContain('Sustain damage: 14d6 piercing')
  expect(markup).toContain('Cone: 11d8 sonic')
  expect(markup).toContain('aria-label="Roll Heal Animal: 1-action healing"')
  expect(markup).toContain('title="Two Actions; 2-action healing: 10d8+80 HP"')
  expect(renderToStaticMarkup(<SpellsSection c={{ ...c, spells: [] }} entries={[]} save={() => {}} />)).not.toContain('aria-label="Roll ')
  for (const name of ['Warning Stripes', "Ranger's Bramble", 'Gluttonous Growth', 'Pulverizing Wake'])
    expect(spellDamage(name, 2)).toEqual([])
})

it('scales Entropy Strike void and tech persistent acid damage by rank', () => {
  expect(spellDamage('Entropy Strike', 2)).toEqual([])
  expect(spellDamage('Entropy Strike', 3)[0]).toMatchObject({ dice: 5, sides: 8, type: 'void', additional: { dice: 2, sides: 6, type: 'persistent acid' } })
  expect(spellDamage('Entropy Strike', 5)[0]).toMatchObject({ dice: 7, additional: { dice: 4 } })
})
