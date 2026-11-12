import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { rollSpellDamage, spellDamage, SpellDamageRolls } from './SpellDamage'
import { SpellsSection } from './SpellsSection'
import type { Character } from './types'

afterEach(() => vi.restoreAllMocks())

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

it('rolls every damage die, includes endpoints, and totals individual results', () => {
  vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.999999)
  const damage = spellDamage('Slime Spit', 1)[0]
  expect(rollSpellDamage(damage)).toEqual({ rolls: [1, 6], total: 7 })
})

it('renders rank-scaled rollers beside owned spells and omits unavailable spell damage', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 19, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    spells: ['Slime Spit', 'Warning Stripes', "Ranger's Bramble", 'Gluttonous Growth', 'Pulverizing Wake']
      .map((name) => ({ name, rank: 1, cantrip: false })),
  }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Damage: 20d6 poison')
  expect(markup).toContain('Contact damage: 5d8 poison')
  expect(markup).toContain('Critical failure: 9d4 persistent bleed')
  expect(markup).toContain('Sustain damage: 14d6 piercing')
  expect(markup).toContain('Cone: 11d8 sonic')
  expect(renderToStaticMarkup(<SpellsSection c={{ ...c, spells: [] }} entries={[]} save={() => {}} />)).not.toContain('aria-label="Roll ')
  for (const name of ['Warning Stripes', "Ranger's Bramble", 'Gluttonous Growth', 'Pulverizing Wake'])
    expect(spellDamage(name, 2)).toEqual([])
})
