import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { DamageRoll, MultipleDamageRoll, rollSpellDamage, rollTreehealerHealing, rollWarpWorld, spellActionRolls, spellDamage, SpellActions, SpellDamageRolls, sunBladeDamage, WarpWorldRoll } from './SpellDamage'
import { SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'

vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useState: vi.fn(react.useState) }
})

afterEach(() => vi.restoreAllMocks())

it('rolls Animal Allies damage at the cast rank', () => {
  const entry: ContentEntry = { id: 'allies', name: 'Animal Allies', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 0)).toEqual([])
  for (const rank of [1, 5, 10]) {
    const [damage] = spellDamage(entry.name, rank)
    expect(damage).toMatchObject({ dice: rank * 3, sides: 4, type: 'piercing' })
    expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
      .toContain(`title="Two Actions; Damage: ${rank * 3}d4 piercing"`)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(rollSpellDamage(damage)).toBe(rank * 3)
  }
})

it('rolls Armor of Thorn and Claw persistent bleed with its separate piercing trigger', () => {
  const entry: ContentEntry = { id: 'armor', name: 'Armor of Thorn and Claw', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 0)).toEqual([])
  for (const [rank, dice, piercing] of [[1, 1, 1], [2, 1, 1], [3, 2, 3], [10, 5, 9]]) {
    const [damage] = spellDamage(entry.name, rank)
    expect(damage).toMatchObject({ label: 'Persistent bleed', dice, sides: 4, type: 'persistent bleed' })
    expect(damage.note).toContain(`separately deals ${piercing} piercing`)
    expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
      .toContain(`${dice}d4 persistent bleed`)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(rollSpellDamage(damage)).toBe(dice)
  }
})

it('rolls Avenging Wildwood branches damage at the cast rank', () => {
  const entry: ContentEntry = { id: 'wildwood', name: 'Avenging Wildwood', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 2, traits: [], description: '', data: { actions: 'Three Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 1)).toEqual([])
  for (const [rank, dice] of [[2, 2], [3, 2], [4, 3], [10, 6]]) {
    const [damage] = spellDamage(entry.name, rank)
    expect(damage).toMatchObject({ label: 'Branches Strike', dice, sides: 8, type: 'bludgeoning, piercing, or slashing' })
    expect(damage.note).toContain('each Sustain')
    expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
      .toContain(`${dice}d8 bludgeoning, piercing, or slashing`)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(rollSpellDamage(damage)).toBe(dice)
  }
})

it('calculates Lay on Hands healing at the actual spell rank', () => {
  const entry: ContentEntry = { id: 'lay-on-hands', name: 'Lay on Hands', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: [], description: '', data: { actions: 'Single Action' }, effects: [], updatedAt: 1 }
  for (const rank of [1, 5, 10]) {
    const [healing] = spellDamage(entry.name, rank)
    expect(rollSpellDamage(healing)).toBe(rank * 6)
    const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />)
    expect(markup).toContain('aria-label="Roll Lay on Hands: Healing"')
    expect(markup).toContain(`Healing: ${rank * 6} HP`)
  }
})

it('rolls Treehealer healing once and gives half the result back to the user', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollTreehealerHealing()).toEqual({ target: 63, self: 31 })
})

it.each([[4, 2], [6, 3], [8, 4], [10, 5]])('rolls Burning Trail damage at rank %i as %id10 fire', (rank, dice) => {
  const entry: ContentEntry = { id: 'burning-trail', name: 'Burning Trail', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 4, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellActionRolls(entry.name, rank, entry)).toMatchObject([
    { actions: 'Two Actions', damage: { label: 'Damage', dice, sides: 10, type: 'fire' } },
  ])
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d10 fire"`)
})

it('provides a heightened Sun Blade roll with sunlight and target options', () => {
  for (const rank of [2, 5, 10]) {
    expect(spellDamage('Sun Blade', rank)).toEqual([{ label: 'Damage', dice: rank - 1, sides: 4, type: 'fire' }])
    const markup = renderToStaticMarkup(<SpellActions name="Sun Blade" rank={rank} />)
    expect(markup).toContain('aria-label="Roll Sun Blade: Damage"')
    expect(markup).toContain(`${rank - 1}d4 fire`)
    for (const label of ['Bright sunlight', 'Evil', 'Undead']) expect(markup).toContain(label)
    expect(sunBladeDamage(rank, true, true, true)).toEqual({ label: 'Damage', dice: rank - 1, sides: 6, type: 'fire',
      components: [{ dice: rank - 1, sides: 6, type: 'good' }, { dice: rank - 1, sides: 6, type: 'positive' }] })
    expect(sunBladeDamage(rank, false, false, true).components).toEqual([{ dice: rank - 1, sides: 4, type: 'positive' }])
  }
})

it.each([[1, 2, 1], [5, 10, 5], [10, 20, 10]])(
  'rolls initial and persistent Phantom Pain damage at rank %i', (rank, initial, persistent) => {
    const damage = spellDamage('Phantom Pain', rank)[0]
    expect(damage).toEqual({ label: 'Damage', dice: initial, sides: 4, type: 'mental',
      additional: { label: 'Persistent damage', dice: persistent, sides: 4, type: 'persistent mental' } })
    expect(spellDamage('Phantom Pain', 0)).toEqual([])
    const entry: ContentEntry = { id: 'phantom-pain', name: 'Phantom Pain', systems: ['pf2e', 'sf2e'], kind: 'spell',
      source: 'official', level: 1, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
    const markup = renderToStaticMarkup(<SpellActions name="Phantom Pain" rank={rank} entry={entry} />)
    expect(markup).toContain(`${initial}d4 mental`)
    expect(markup).toContain(`${persistent}d4 persistent mental`)
    const setResult = vi.fn()
    vi.mocked(useState).mockReturnValueOnce([undefined, setResult])
    const tree = DamageRoll({ name: 'Phantom Pain', damage })
    const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
    if (!isValidElement<{ onClick: () => void }>(button)) throw new Error('Missing Phantom Pain roll button')
    vi.spyOn(Math, 'random').mockReturnValue(0)
    button.props.onClick()
    expect(setResult).toHaveBeenCalledWith({ primary: initial, additional: persistent })
  },
)

it('rolls heightened Vindicator mark damage and its dismissal separately', () => {
  expect(spellDamage("Vindicator's Mark", 0)).toEqual([])
  for (const [rank, initial, dismissal] of [[1, 2, 2], [2, 2, 2], [3, 4, 3], [9, 10, 6]]) {
    expect(spellActionRolls("Vindicator's Mark", rank)).toEqual([
      { damage: { label: 'Initial damage', dice: initial, sides: 4, type: 'spirit' }, actions: 'Two Actions' },
      { damage: { label: 'Dismissal damage', dice: dismissal, sides: 6, type: 'spirit' }, actions: 'One Action' },
    ])
  }
})

it('rolls Verdant Code piercing damage without inventing heightening', () => {
  const entry: ContentEntry = { id: 'verdant-code', name: 'Verdant Code', systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 2, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 1)).toEqual([])
  for (const rank of [2, 6, 10]) {
    expect(spellDamage(entry.name, rank)).toEqual([{ label: 'Damage', dice: 2, sides: 6, type: 'piercing' }])
    expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
      .toContain('2d6 piercing')
  }
})

it('rolls Burstmoji damage and shows heightened hazardous terrain damage', () => {
  expect(spellDamage('Burstmoji', 3)).toEqual([])
  for (const [rank, dice, terrain] of [[4, 6, 5], [7, 12, 11], [10, 18, 17]]) {
    expect(spellDamage('Burstmoji', rank)).toEqual([{ label: 'Damage', dice, sides: 6, type: 'fire',
      additional: { label: 'Hazardous terrain', dice: 0, sides: 0, bonus: terrain, type: 'fire' } }])
  }
})

it('rolls Wall of Fire damage at its actual cast rank', () => {
  const entry: ContentEntry = { id: 'wall-of-fire', name: 'Wall of Fire', systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 4, traits: [], description: '', data: { actions: 'Three Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 3)).toEqual([])
  for (const rank of [4, 7, 10]) {
    expect(spellDamage(entry.name, rank)).toEqual([{ label: 'Damage', dice: rank, sides: 6, type: 'fire' }])
    expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />)).toContain(`${rank}d6 fire`)
  }
})

it('rolls Divine Decree spirit damage at its cast rank without save outcomes', () => {
  const entry: ContentEntry = { id: 'divine-decree', name: 'Divine Decree', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 7, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 6)).toEqual([])
  for (const rank of [7, 8, 10]) {
    const [damage] = spellDamage(entry.name, rank)
    expect(damage).toEqual({ label: 'Damage', dice: rank, sides: 10, type: 'spirit' })
    expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />)).toContain(`${rank}d10 spirit`)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(rollSpellDamage(damage)).toBe(rank)
  }
})

it('rolls Shatter sonic damage at its cast rank', () => {
  const entry: ContentEntry = { id: 'shatter', name: 'Shatter', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 2, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 1)).toEqual([])
  vi.spyOn(Math, 'random').mockReturnValue(0)
  for (const rank of [2, 3, 10]) {
    const [damage] = spellDamage(entry.name, rank)
    expect(damage).toEqual({ label: 'Damage', dice: rank, sides: 10, type: 'sonic' })
    expect(rollSpellDamage(damage)).toBe(rank)
    const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />)
    expect(markup).toContain('aria-label="Roll Shatter: Damage"')
    expect(markup).toContain(`${rank}d10 sonic`)
  }
})

it('rolls Breath of Life healing as a reaction with two-rank heightening', () => {
  const entry: ContentEntry = { id: 'breath-of-life', name: 'Breath of Life', systems: ['pf2e', 'sf2e'], kind: 'spell',
    source: 'official', level: 5, traits: [], description: '', data: { actions: 'Reaction' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 4)).toEqual([])
  vi.spyOn(Math, 'random').mockReturnValue(0)
  for (const [rank, dice] of [[5, 5], [6, 5], [7, 6], [9, 7], [10, 7]]) {
    const [damage] = spellDamage(entry.name, rank)
    expect(damage).toEqual({ label: 'Healing', dice, sides: 8, type: 'HP' })
    expect(rollSpellDamage(damage)).toBe(dice)
    const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />)
    expect(markup).toContain('aria-label="Roll Breath of Life: Healing"')
    expect(markup).toContain(`title="Reaction; Healing: ${dice}d8 HP"`)
  }
})

it.each([
  [0, 'Supernova', 'fire', 'electricity', undefined],
  [1, 'Earthquake', 'bludgeoning', undefined, undefined],
  [2, 'Inferno', 'fire', undefined, undefined],
  [3, 'Eldritch Storm', 'sonic', 'mental', undefined],
  [4, 'Flash Freeze', 'cold', undefined, undefined],
  [5, 'Radioactive Blast', 'bludgeoning', 'fire', 3],
] as const)('rolls Warp World effect %i with heightened damage', (index, name, type, persistent, poison) => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  random.mockReturnValueOnce((index + 0.1) / 6)
  const result = rollWarpWorld(6)
  expect(result).toEqual({ index, damage: 6, persistent: persistent ? 3 : undefined, poison })
  expect(random).toHaveBeenCalledTimes(1 + 6 + (persistent ? 3 : 0) + (poison ? 3 : 0))
  vi.mocked(useState).mockReturnValueOnce([result, vi.fn()])
  const html = renderToStaticMarkup(<WarpWorldRoll rank={6} />)
  expect(html).toContain(`${name}: 6 ${type}`)
  if (persistent) expect(html).toContain(`3 persistent ${persistent}`)
  if (poison) expect(html).toContain('critical failure: 3 persistent poison')
})

it('toggles Warp World rolls from its action icon', () => {
  const setResult = vi.fn()
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.mocked(useState).mockReturnValueOnce([undefined, setResult])
  const tree = WarpWorldRoll({ rank: 4 })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw new Error('Missing Warp World roll button')
  button.props.onClick()
  expect(setResult).toHaveBeenCalledWith({ index: 0, damage: 4, persistent: 1, poison: undefined })
  vi.mocked(useState).mockReturnValueOnce([{ index: 0, damage: 4, persistent: 1 }, setResult])
  const active = WarpWorldRoll({ rank: 4 })
  const clear = Children.toArray(active.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(clear)) throw new Error('Missing Warp World clear button')
  clear.props.onClick()
  expect(setResult).toHaveBeenLastCalledWith(undefined)
  expect(random).toHaveBeenCalledTimes(6)
  expect(renderToStaticMarkup(<SpellActions name="Warp World" rank={4} />)).toContain('aria-label="Roll Warp World"')
})

it('offers Quantum Negation damage by target level without calculating save outcomes', () => {
  const entry: ContentEntry = { id: 'quantum-negation', name: 'Quantum Negation', systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 10, traits: ['Focus'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 9)).toEqual([])
  const rolls = spellActionRolls(entry.name, 10, entry)
  expect(rolls.map(roll => roll.damage)).toMatchObject([
    { label: 'Target level 13 or lower', bonus: 9999, dice: 0 },
    { label: 'Target level 14-16', dice: 25, sides: 10 },
    { label: 'Target level 17 or higher', dice: 20, sides: 10 },
  ])
  expect(rolls.every(roll => roll.actions === 'Two Actions')).toBe(true)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rolls.map(roll => rollSpellDamage(roll.damage))).toEqual([9999, 25, 20])
  const html = renderToStaticMarkup(<SpellActions name={entry.name} rank={10} entry={entry} />)
  expect(html).toContain('Reduce Will save success by one step')
  expect(html).toContain('25d10 untyped damage')
  expect(html).toContain('20d10 untyped damage')
  expect(html.match(/<button /g)).toHaveLength(1)
  const damages = rolls.map(roll => roll.damage)
  const setResults = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, setResults])
  const tree = MultipleDamageRoll({ name: entry.name, damages, actions: 'Two Actions' })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw new Error('Missing Quantum Negation roll')
  button.props.onClick()
  expect(setResults).toHaveBeenCalledWith([9999, 25, 20])
  vi.mocked(useState).mockReturnValueOnce([[9999, 25, 20], setResults])
  const result = renderToStaticMarkup(<MultipleDamageRoll name={entry.name} damages={damages} actions="Two Actions" />)
  for (const text of ['Target level 13 or lower: 9999', 'Target level 14-16: 25', 'Target level 17 or higher: 20']) {
    expect(result).toContain(text)
  }
  vi.mocked(useState).mockReturnValueOnce([[9999, 25, 20], setResults])
  const shown = MultipleDamageRoll({ name: entry.name, damages, actions: 'Two Actions' })
  const clear = Children.toArray(shown.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(clear)) throw new Error('Missing clear button')
  clear.props.onClick()
  expect(setResults).toHaveBeenLastCalledWith(undefined)
})

it('scales other cantrips with their heightening steps', () => {
  expect(spellDamage('Daze', 1)[0]).toMatchObject({ dice: 1, sides: 6, type: 'mental' })
  expect(spellDamage('Daze', 5)[0].dice).toBe(3)
  expect(spellDamage('Divine Lance', 4)[0]).toMatchObject({ dice: 5, sides: 4, type: 'spirit' })
  expect(spellDamage('Spirit Object', 3)[0].dice).toBe(6)
  expect(spellDamage('Ghostly Shift', 6)[0]).toMatchObject({ dice: 4, type: 'force (amp only)' })
  expect(spellDamage('Vitality Lash', 0)).toEqual([])
})

it.each([[1, 0, 1], [3, 1, 2], [9, 4, 5]])('scales Ancient Dust at rank %i using the spellcasting modifier', (rank, dice, persistent) => {
  expect(spellDamage('Ancient Dust', rank, 4)[0]).toMatchObject({
    dice, sides: 6, bonus: 4, type: 'void', additional: { bonus: persistent, type: 'void' },
  })
  expect(spellDamage('Ancient Dust', rank)).toEqual([])
})

it('uses the spellcasting modifier for Torturous Trauma and reports when it is unavailable', () => {
  expect(spellDamage('Torturous Trauma', 4, -1)[0]).toMatchObject({ dice: 4, sides: 4, bonus: -1 })
  expect(spellDamage('Torturous Trauma', 1)).toEqual([])
  const entry: ContentEntry = { id: 'trauma', name: 'Torturous Trauma', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Cantrip'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={4} entry={entry} />)).toContain('Spellcasting modifier unavailable')
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={4} entry={entry} spellcastingModifier={-1} />))
    .toContain('4d4-1 bludgeoning')
})

it.each([[1, 1], [2, 2], [5, 2], [6, 3], [9, 3], [10, 4]])('scales Thrall Charge at rank %i', (rank, dice) => {
  expect(spellDamage('Thrall Charge', rank)[0]).toMatchObject({
    dice, sides: 6, additional: { bonus: rank, label: 'Destroyed thrall status bonus' },
  })
})

it.each([[1, 1], [2, 1], [3, 3], [5, 4], [7, 5], [9, 6], [10, 6]])('scales Glass Shield at rank %i', (rank, dice) => {
  expect(spellDamage('Glass Shield', rank)[0]).toMatchObject({ dice, sides: 4, type: 'piercing' })
})

it('shows conditional and alternative damage for cantrips in one action roll', () => {
  const entry: ContentEntry = { id: 'ignition', name: 'Ignition', systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Cantrip'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage('Ignition', 3)).toMatchObject([
    { label: 'Ranged', dice: 4, sides: 4, additional: { dice: 3, sides: 4 } },
    { label: 'Melee', dice: 4, sides: 6, additional: { dice: 3, sides: 6 } },
  ])
  expect(renderToStaticMarkup(<SpellActions name="Ignition" rank={3} entry={entry} />).match(/<button /g)).toHaveLength(1)
  expect(spellDamage('Bramble Bush', 5)).toMatchObject([
    { dice: 3, sides: 4 }, { dice: 1, sides: 4, bonus: 2 },
  ])
  expect(spellDamage('Glimpse Weakness', 5)).toMatchObject([{ bonus: 6 }, { dice: 3, sides: 4, bonus: 3 }])
  expect(spellDamage('Live Wire', 5)[0]).toMatchObject({
    dice: 3, components: [{ dice: 3, type: 'electricity' }, { dice: 3, type: 'persistent electricity (critical hit)' }],
  })
  expect(spellDamage('Puff of Poison', 5)[0]).toMatchObject({ dice: 3, additional: { dice: 3, type: 'poison' } })
  expect(spellDamage('Needle Darts', 5)[0].additional).toMatchObject({ bonus: 5, type: 'bleed' })
  expect(spellDamage('Slashing Gust', 5)[0].additional).toMatchObject({ dice: 5, sides: 4, type: 'bleed' })
  expect(spellDamage('Redistribute Potential', 1)[0].type).toBe('cold or fire')
  expect(spellDamage('Redistribute Potential', 5)[1]).toMatchObject({ dice: 14, sides: 6, type: 'cold or fire' })
  expect(spellDamage('Telekinetic Rend', 5)[1]).toMatchObject({ dice: 3, additional: { dice: 3, type: 'slashing' } })
  expect(spellDamage('Dancing Blade', 5)[1]).toMatchObject({ dice: 5, sides: 10 })
  expect(spellDamage('Shatter Mind', 5)[1]).toMatchObject({ dice: 7, sides: 10 })
  expect(spellDamage('Imaginary Weapon', 5)[1]).toMatchObject({ dice: 10, sides: 6 })
})

it('uses the character spellcasting ability for cantrip damage in the spell list', () => {
  const entry: ContentEntry = { id: 'trauma', name: 'Torturous Trauma', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Cantrip'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, feats: [], equipment: [], lores: [],
    languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    spellcasting: { ability: 'int', tradition: 'Arcane', rank: 1, slots: {} },
    spells: [{ name: entry.name, rank: 1, cantrip: true }],
  }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[entry]} save={() => {}} />)
  expect(markup).toContain('3d4+4 bludgeoning')
  expect(markup).not.toContain('Spellcasting modifier unavailable')
})

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
  expect(spellDamage('Gouging Claw', rank)[0].additional).toMatchObject({ bonus: rank + 1, type: 'persistent bleed' })
})

it.each([[1, 2], [5, 6], [10, 11]])('shows Gouging Claw persistent bleed at rank %i', (rank, bleed) => {
  const damage = spellDamage('Gouging Claw', rank)[0]
  const setResult = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, setResult])
  const tree = DamageRoll({ name: 'Gouging Claw', damage, actions: 'Two Actions', toggleResult: true })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing damage roll')
  vi.spyOn(Math, 'random').mockReturnValue(0)
  button.props.onClick()
  expect(Math.random).toHaveBeenCalledTimes(rank + 1)
  expect(setResult).toHaveBeenCalledWith({ primary: rank + 1, additional: bleed })
  vi.mocked(useState).mockReturnValueOnce([{ primary: rank + 1, additional: bleed }, vi.fn()])
  const html = renderToStaticMarkup(<DamageRoll name="Gouging Claw" damage={damage} actions="Two Actions" toggleResult />)
  expect(html).toContain(`${rank + 1} piercing or slashing + ${bleed} persistent bleed`)
  expect(html).toContain('Double damage and bleed on a critical success')
})

it('toggles spell damage off before rolling again without counting a clear as a roll', () => {
  const damage = { label: 'Damage', dice: 2, sides: 6, type: 'fire' }
  const setResult = vi.fn()
  const onRoll = vi.fn()
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  const click = (result: number | undefined) => {
    vi.mocked(useState).mockReturnValueOnce([result, setResult])
    const tree = DamageRoll({ name: 'Test', damage, actions: 'Two Actions', toggleResult: true, onRoll })
    const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
    if (!isValidElement<{ onClick: () => void; 'aria-label': string }>(button)) throw Error('Missing damage roll')
    expect(button.props['aria-label']).toBe(result === undefined ? 'Roll Test: Damage' : 'Hide Test: Damage result')
    button.props.onClick()
  }
  click(undefined)
  expect(setResult).toHaveBeenLastCalledWith(2)
  expect(random).toHaveBeenCalledTimes(2)
  click(2)
  expect(setResult).toHaveBeenLastCalledWith(undefined)
  expect(random).toHaveBeenCalledTimes(2)
  expect(onRoll).toHaveBeenCalledTimes(1)
  random.mockReturnValue(0.999999)
  click(undefined)
  expect(setResult).toHaveBeenLastCalledWith(12)
  expect(random).toHaveBeenCalledTimes(4)
  expect(onRoll).toHaveBeenCalledTimes(2)
  click(0)
  expect(setResult).toHaveBeenLastCalledWith(undefined)
  expect(onRoll).toHaveBeenCalledTimes(2)
  const entry: ContentEntry = { id: 'fireball', name: 'Fireball', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 3, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const actions = SpellActions({ name: entry.name, rank: 3, entry })
  const roll = Children.toArray(actions.props.children).find(child => isValidElement(child) && child.type === DamageRoll)
  expect(isValidElement<{ toggleResult: boolean }>(roll) && roll.props.toggleResult).toBe(true)
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

it.each([
  ['Blood Infusion', 1, { label: 'Failure damage', dice: 1, sides: 6, type: 'persistent bleed',
    note: 'Success: 1 persistent bleed; critical failure: 2d6 persistent bleed' }],
  ['Bloody Tendrils', 6, { label: 'Damage', dice: 2, sides: 12, type: 'bludgeoning' }],
  ['Blossoming Gore', 7, { label: 'Persistent bleed', dice: 0, sides: 0, bonus: 14, type: 'persistent bleed' }],
  ['Bone Spear', 3, { label: 'Damage', dice: 6, sides: 6, type: 'piercing' }],
  ['Bony Barrage', 4, { label: 'Damage', dice: 4, sides: 10, type: 'piercing' }],
  ['Necrotic Bomb', 5, { label: 'Damage', dice: 5, sides: 12, type: 'void' }],
  ['Song of the Soul', 5, { label: 'Healing', dice: 5, sides: 8, type: 'HP' }],
  ['Zombie Horde', 5, { label: 'Damage', dice: 5, sides: 4, type: 'bludgeoning' }],
  ['Eclipse Burst', 9, { label: 'Damage', dice: 10, sides: 10, type: 'cold',
    additional: { label: 'Void damage to living creatures', dice: 10, sides: 4, type: 'void' } }],
] as const)('rolls %s at rank %i using its documented damage', (name, rank, expected) => {
  expect(spellDamage(name, rank)).toEqual([expected])
  const [roll] = spellDamage(name, rank)
  expect(renderToStaticMarkup(<SpellActions name={name} rank={rank}
    entry={{ id: name, name, systems: ['pf2e'], kind: 'spell', source: 'official', level: rank,
      traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }} />))
    .toContain(roll.additional ? roll.additional.label : roll.type)
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

it('offers Dread Mosquito Storm area damage and selectable Necrotic Blood stages', () => {
  const entry: ContentEntry = { id: 'dread-mosquito-storm', name: 'Dread Mosquito Storm', systems: ['pf2e'],
    kind: 'spell', source: 'official', level: 8, traits: [], description: '', data: { actions: 'Three Actions' },
    effects: [], updatedAt: 1 }
  const html = renderToStaticMarkup(<SpellActions name={entry.name} rank={8} entry={entry} />)
  expect(html).toContain('aria-label="Roll Dread Mosquito Storm: Area damage"')
  expect(html).toContain('1 void')
  expect(html).toContain('aria-label="Necrotic Blood stage"')
  expect(html).toContain('Stage 1 disease damage: 3d10 void')
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

it('hides a displayed Primal Howl result on the next action click', () => {
  const setResult = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([10, setResult])
  const tree = DamageRoll({ name: 'Primal Howl', damage: { label: 'Damage', dice: 10, sides: 6, type: 'sonic' },
    actions: 'Two Actions', toggleResult: true })
  const button = Children.toArray(tree.props.children).find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw new Error('Missing damage roll button')
  const random = vi.spyOn(Math, 'random')
  button.props.onClick()
  expect(setResult).toHaveBeenCalledWith(undefined)
  expect(random).not.toHaveBeenCalled()
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

it('rolls Heal at the selected action and spell rank', () => {
  const rolls = spellActionRolls('Heal', 5)
  expect(rolls.map(roll => [roll.actions, roll.damage.dice, roll.damage.bonus ?? 0]))
    .toEqual([['One Action', 5, 0], ['Two Actions', 5, 40], ['Three Actions', 5, 0]])
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rolls.map(roll => rollSpellDamage(roll.damage))).toEqual([5, 45, 5])
  const markup = renderToStaticMarkup(<SpellActions name="Heal" rank={5} actionOverride="Two Actions" />)
  expect(markup).toContain('aria-label="Roll Heal: 2-action healing"')
  expect(markup).not.toContain('1-action healing')
  expect(markup).not.toContain('3-action healing')
})

it('rolls Rebuke Death healing for its selected action and heightened rank', () => {
  expect(spellActionRolls('Rebuke Death', 1).map(roll => [roll.actions, roll.damage.label, roll.damage.dice]))
    .toEqual([
      ['One Action', '1-action healing', 3],
      ['Two Actions', '2-action healing', 3],
      ['Three Actions', '3-action healing', 3],
    ])
  expect(spellDamage('Rebuke Death', 4).map(healing => healing.dice)).toEqual([6, 6, 6])
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(spellActionRolls('Rebuke Death', 1).map(roll => rollSpellDamage(roll.damage))).toEqual([3, 3, 3])
  const markup = renderToStaticMarkup(<SpellActions name="Rebuke Death" rank={1} actionOverride="Two Actions" />)
  expect(markup).toContain('aria-label="Roll Rebuke Death: 2-action healing"')
  expect(markup).toContain('title="Two Actions; 2-action healing: 3d6 HP"')
  expect(markup).not.toContain('1-action healing')
  expect(markup).not.toContain('3-action healing')
})

it('rolls heightened Eradicate Undeath vitality damage', () => {
  expect(spellDamage('Eradicate Undeath', 3)).toEqual([])
  expect(spellDamage('Eradicate Undeath', 4)).toEqual([{ label: 'Damage', dice: 4, sides: 12, type: 'vitality' }])
  expect(spellDamage('Eradicate Undeath', 7)).toEqual([{ label: 'Damage', dice: 7, sides: 12, type: 'vitality' }])
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(spellDamage('Eradicate Undeath', 4)[0])).toBe(4)
  const entry: ContentEntry = { id: 'eradicate-undeath', name: 'Eradicate Undeath', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 4, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const markup = renderToStaticMarkup(<SpellActions name={entry.name} rank={4} entry={entry} />)
  expect(markup).toContain('aria-label="Roll Eradicate Undeath: Damage"')
  expect(markup).toContain('title="Two Actions; Damage: 4d12 vitality"')
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
  expect(multiple.match(/<button /g)).toHaveLength(1)
  expect(multiple).toContain('Strike bonus')
  expect(multiple).toContain('Cone')
  expect(multiple).toContain('3d8 sonic')
  expect(multiple).toContain('8d8 sonic')
})

it('rolls Corrosive Haze acid damage and heightens by 1d8 and 1d6 persistent', () => {
  expect(spellDamage('Corrosive Haze', 6)).toMatchObject([{ dice: 6, sides: 8, type: 'acid', additional: { dice: 1, sides: 6 } }, { dice: 3, sides: 8 }])
  expect(spellDamage('Corrosive Haze', 8)).toMatchObject([{ dice: 8, additional: { dice: 3 } }, { dice: 5 }])
})

it('rolls Inject Nanobots acid damage and heightens by 2d6 per rank', () => {
  expect(spellDamage('Inject Nanobots', 2)).toMatchObject([{ dice: 4, sides: 6, type: 'acid' }])
  expect(spellDamage('Inject Nanobots', 5)).toMatchObject([{ dice: 10, sides: 6 }])
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

it('rolls Curse of Death damage for the selected stage and heightened rank', () => {
  expect(spellDamage('Curse of Death', 4)).toEqual([])
  expect(spellDamage('Curse of Death', 5)).toEqual([
    { label: 'Stage 1 damage', dice: 4, sides: 6, type: 'void' },
    { label: 'Stage 2 damage', dice: 8, sides: 6, type: 'void' },
    { label: 'Stage 3 damage', dice: 12, sides: 6, type: 'void' },
  ])
  expect(spellDamage('Curse of Death', 8).map(damage => damage.dice)).toEqual([7, 11, 15])
  const entry: ContentEntry = { id: 'curse-of-death', name: 'Curse of Death', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 5, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const markup = renderToStaticMarkup(<SpellActions name="Curse of Death" rank={6} entry={entry} />)
  expect(markup).toContain('aria-label="Curse of Death stage"')
  expect(markup).toContain('aria-label="Roll Curse of Death: Stage 1 damage"')
  expect(markup).toContain('title="Two Actions; Stage 1 damage: 5d6 void"')
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(spellDamage('Curse of Death', 6).map(damage => rollSpellDamage(damage))).toEqual([5, 9, 13])
})

it.each([
  ['Eldritch Wrath', 4, 3, 10, 9, 12, 'mental', 'Two Actions'],
  ['Slice Reality', 6, 7, 10, 11, 8, 'void', 'Three Actions'],
  ['Death Sentence', 7, 11, 10, 14, 10, 'spirit', 'Two Actions'],
] as const)('rolls %s at base and heightened ranks', (name, baseRank, baseDice, highRank, highDice, sides, type, actions) => {
  const entry: ContentEntry = { id: name, name, systems: ['sf2e'], kind: 'spell',
    source: 'official', level: baseRank, traits: [], description: '', data: { actions }, effects: [], updatedAt: 1 }
  expect(spellDamage(name, baseRank - 1)).toEqual([])
  expect(spellDamage(name, baseRank)).toMatchObject([{ dice: baseDice, sides, type }])
  const roll = spellActionRolls(name, highRank, entry)[0]
  expect(roll).toMatchObject({ actions, damage: { dice: highDice, sides, type } })
  expect(renderToStaticMarkup(<SpellActions name={name} rank={highRank} entry={entry} />))
    .toContain(`title="${actions}; Damage: ${highDice}d${sides} ${type}"`)
  const setResult = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, setResult])
  const button = Children.toArray(DamageRoll({ name, damage: roll.damage, actions }).props.children)
    .find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing damage roll')
  vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  button.props.onClick()
  expect(setResult).toHaveBeenCalledWith(highDice * sides)
})

it('rolls Call Cosmos cold and fire independently from the action icon', () => {
  const name = 'Call Cosmos'
  const entry: ContentEntry = { id: name, name, systems: ['sf2e'], kind: 'spell',
    source: 'official', level: 9, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(name, 8)).toEqual([])
  expect(spellDamage(name, 9)).toMatchObject([{ dice: 5, sides: 12, type: 'cold', additional: { dice: 5, sides: 12, type: 'fire' } }])
  const roll = spellActionRolls(name, 10, entry)[0]
  expect(roll.damage).toMatchObject({ dice: 7, sides: 12, type: 'cold', additional: { dice: 7, sides: 12, type: 'fire' } })
  expect(renderToStaticMarkup(<SpellActions name={name} rank={10} entry={entry} />))
    .toContain('title="Two Actions; Damage: 7d12 cold + 7d12 fire"')
  const setResult = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, setResult])
  const button = Children.toArray(DamageRoll({ name, damage: roll.damage, actions: roll.actions }).props.children)
    .find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing damage roll')
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  for (let i = 0; i < 7; i++) random.mockReturnValueOnce(0)
  button.props.onClick()
  expect(random).toHaveBeenCalledTimes(14)
  expect(setResult).toHaveBeenCalledWith({ primary: 7, additional: 84 })
  vi.mocked(useState).mockReturnValueOnce([{ primary: 7, additional: 84 }, vi.fn()])
  expect(renderToStaticMarkup(<DamageRoll name={name} damage={roll.damage} actions={roll.actions} />))
    .toContain('7 cold + 84 fire')
})

it.each([[1, 3], [5, 7], [10, 12]])('scales Needle Darts at rank %i to %id4 piercing', (rank, dice) => {
  const entry: ContentEntry = { id: 'needle', name: 'Needle Darts', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: ['Cantrip'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  const damage = spellDamage(entry.name, rank)[0]
  expect(damage).toMatchObject({ label: 'Damage', dice, sides: 4, type: 'piercing', additional: { bonus: rank } })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
    .toContain(`Damage: ${dice}d4 piercing; Critical hit persistent: ${rank} bleed`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(dice * 4)
})

it('shows rolled Needle Darts damage and conditional persistent bleed', () => {
  vi.mocked(useState).mockReturnValueOnce([{ primary: 17, additional: 5 }, vi.fn()])
  const markup = renderToStaticMarkup(<DamageRoll name="Needle Darts" damage={spellDamage('Needle Darts', 5)[0]} actions="Two Actions" />)
  expect(markup).toContain('17 piercing; Critical hit persistent: 5 bleed')
  expect(markup).not.toContain('critical:')
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

it.each([
  ['Vampiric Feast', 2, 0, 'void', 'Two Actions'],
  ['Vampiric Feast', 3, 6, 'void', 'Two Actions'],
  ['Vampiric Feast', 5, 10, 'void', 'Two Actions'],
  ['Vampiric Feast', 10, 20, 'void', 'Two Actions'],
  ['Blood Vendetta', 1, 0, 'bleed', 'Reaction'],
  ['Blood Vendetta', 2, 2, 'bleed', 'Reaction'],
  ['Blood Vendetta', 3, 2, 'bleed', 'Reaction'],
  ['Blood Vendetta', 4, 4, 'bleed', 'Reaction'],
  ['Blood Vendetta', 10, 10, 'bleed', 'Reaction'],
])('rolls %s at rank %i as %id6 %s', (name, rank, dice, type, actions) => {
  const entry: ContentEntry = { id: name, name, systems: ['pf2e'], kind: 'spell',
    source: 'official', level: name === 'Vampiric Feast' ? 3 : 2, traits: [], description: '',
    data: { actions }, effects: [], updatedAt: 0 }
  const damage = spellDamage(name, rank)[0]
  if (!dice) {
    expect(damage).toBeUndefined()
    return
  }
  expect(damage).toMatchObject({ dice, sides: 6, type })
  expect(renderToStaticMarkup(<SpellActions name={name} rank={rank} entry={entry} />))
    .toContain(`${dice}d6 ${type}`)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(rollSpellDamage(damage)).toBe(dice)
  vi.mocked(Math.random).mockReturnValue(0.999999)
  expect(rollSpellDamage(damage)).toBe(dice * 6)
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

it.each([
  ['Vampiric Exsanguination', 6, 12, 6],
  ['Vampiric Exsanguination', 7, 14, 6],
  ['Vampiric Exsanguination', 10, 20, 6],
  ['Stop Heart', 8, 10, 10],
  ['Stop Heart', 9, 11, 10],
  ['Stop Heart', 10, 12, 10],
] as const)('rolls %s at rank %i as %id%i void without save outcomes', (name, rank, dice, sides) => {
  const baseRank = name === 'Stop Heart' ? 8 : 6
  const entry: ContentEntry = { id: name, name, systems: ['pf2e'], kind: 'spell',
    source: 'official', level: baseRank, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(name, baseRank - 1)).toEqual([])
  const damage = spellDamage(name, rank)[0]
  expect(damage).toEqual({ label: 'Damage', dice, sides, type: 'void' })
  expect(spellActionRolls(name, rank, entry)).toEqual([{ damage, actions: 'Two Actions' }])
  expect(renderToStaticMarkup(<SpellActions name={name} rank={rank} entry={entry} />))
    .toContain(`title="Two Actions; Damage: ${dice}d${sides} void"`)
  const setResult = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, setResult])
  const button = Children.toArray(DamageRoll({ name, damage, actions: 'Two Actions' }).props.children)
    .find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing damage roll')
  vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  button.props.onClick()
  expect(setResult).toHaveBeenCalledWith(dice * sides)
})

it.each([[5, 10, 5], [6, 12, 6], [10, 20, 10]])(
  'rolls Calcium Rain piercing and persistent bleed damage at rank %i', (rank, dice, persistent) => {
    const entry: ContentEntry = { id: 'calcium-rain', name: 'Calcium Rain', systems: ['pf2e'], kind: 'spell',
      source: 'official', level: 5, traits: [], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 1 }
    expect(spellDamage('Calcium Rain', 4)).toEqual([])
    const damage = spellDamage(entry.name, rank)[0]
    expect(damage).toEqual({ label: 'Damage', dice, sides: 4, type: 'piercing',
      additional: { label: 'Persistent bleed', dice: 0, sides: 0, bonus: persistent, type: 'persistent bleed' } })
    expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={rank} entry={entry} />))
      .toContain(`title="Two Actions; Damage: ${dice}d4 piercing; Persistent bleed: ${persistent} persistent bleed"`)
    const setResult = vi.fn()
    vi.mocked(useState).mockReturnValueOnce([undefined, setResult])
    const button = Children.toArray(DamageRoll({ name: entry.name, damage, actions: 'Two Actions' }).props.children)
      .find(child => isValidElement(child) && child.type === 'button')
    if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing damage roll')
    vi.spyOn(Math, 'random').mockReturnValue(0)
    button.props.onClick()
    expect(setResult).toHaveBeenCalledWith({ primary: dice, additional: persistent })
  },
)

it('rolls Incarnate Ancient Specter departure damage', () => {
  const entry: ContentEntry = { id: 'incarnate-ancient-specter', name: 'Incarnate Ancient Specter',
    systems: ['pf2e'], kind: 'spell', source: 'official', level: 7, traits: [],
    description: '', data: { actions: 'Three Actions' }, effects: [], updatedAt: 1 }
  expect(spellDamage(entry.name, 6)).toEqual([])
  const damage = spellDamage(entry.name, 7)[0]
  expect(damage).toEqual({ label: 'Departure damage', dice: 4, sides: 6, type: 'persistent bleed' })
  expect(renderToStaticMarkup(<SpellActions name={entry.name} rank={7} entry={entry} />))
    .toContain('title="Three Actions; Departure damage: 4d6 persistent bleed"')
  const setResult = vi.fn()
  vi.mocked(useState).mockReturnValueOnce([undefined, setResult])
  const button = Children.toArray(DamageRoll({ name: entry.name, damage, actions: 'Three Actions' }).props.children)
    .find(child => isValidElement(child) && child.type === 'button')
  if (!isValidElement<{ onClick: () => void }>(button)) throw Error('Missing departure damage roll')
  vi.spyOn(Math, 'random').mockReturnValue(0)
  button.props.onClick()
  expect(setResult).toHaveBeenCalledWith(4)
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

it('opens Bless status toggle from its two-action icon', () => {
  const bless: ContentEntry = { id: 'bless', name: 'Bless', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: [], description: '', data: { actions: 'Two Actions', tradition: 'Divine' },
    effects: [], updatedAt: 1 }
  const c: Character = { id: 'bless', systems: ['pf2e'], name: 'Test', level: 3, className: 'Cleric',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    spells: [{ name: 'Bless', rank: 1, cantrip: false }],
  }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[bless]} save={() => {}} />)
  expect(markup).toContain('aria-label="Bless options" aria-haspopup="dialog"')
  expect(markup).toContain('<dialog')
  expect(markup).toContain('aria-label="Bless active"')
  expect(markup).not.toContain('aria-label="Activate Bless"')
})

it('scales Entropy Strike void and tech persistent acid damage by rank', () => {
  expect(spellDamage('Entropy Strike', 2)).toEqual([])
  expect(spellDamage('Entropy Strike', 3)[0]).toMatchObject({ dice: 5, sides: 8, type: 'void', additional: { dice: 2, sides: 6, type: 'persistent acid' } })
  expect(spellDamage('Entropy Strike', 5)[0]).toMatchObject({ dice: 7, additional: { dice: 4 } })
  expect(spellDamage('Entropy Strike', 10)[0]).toMatchObject({ dice: 12, additional: { dice: 9 } })
})

it('scales Supercharge Weapon extra damage every two ranks', () => {
  expect(spellDamage('Supercharge Weapon', 1)[0]).toMatchObject({ dice: 1, sides: 6 })
  expect(spellDamage('Supercharge Weapon', 4)[0]).toMatchObject({ dice: 2 })
  expect(spellDamage('Supercharge Weapon', 10)[0]).toMatchObject({ dice: 5 })
})

it('scales Rocket Dash fire and critical failure persistent damage', () => {
  expect(spellDamage('Rocket Dash', 5)).toEqual([])
  expect(spellDamage('Rocket Dash', 6)[0]).toMatchObject({ dice: 6, sides: 12, additional: { dice: 2, sides: 6 } })
  expect(spellDamage('Rocket Dash', 10)[0]).toMatchObject({ dice: 10, additional: { dice: 4 } })
})

it("rolls Scrounger's Glee healing and heightens it every two ranks", () => {
  expect(spellDamage("Scrounger's Glee", 1)).toEqual([{ label: 'Healing', dice: 1, sides: 4, type: 'HP' }])
  expect(spellDamage("Scrounger's Glee", 5)[0].dice).toBe(3)
})
