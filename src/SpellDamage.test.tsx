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
