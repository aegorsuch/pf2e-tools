import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { mapAonHit } from './aon'
import snapshot from '../public/data/aon-pf2e.json?raw'
import { itemSpells, itemSpellUses } from './itemSpells'
import { ItemSpellUses, SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'

let previousAutoHeighten: boolean
beforeEach(() => {
  previousAutoHeighten = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
})
afterEach(() => updateSettings({ innateAutoHeighten: previousAutoHeighten }))

const base: Character = {
  id: 'item-caster', systems: ['pf2e'], name: 'Test', level: 20, className: 'Fighter',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const make = (name: string, kind: ContentEntry['kind'], description = ''): ContentEntry => ({
  id: name, name, kind, description, systems: ['pf2e'], source: 'official', level: 1,
  traits: [], data: {}, effects: [], updatedAt: 0,
})
const hits: Parameters<typeof mapAonHit>[0][] = JSON.parse(snapshot)
const official = (name: string) => {
  const hit = hits.find(hit => hit._source?.name === name)
  expect(hit, name).toBeDefined()
  return mapAonHit(hit!, 'pf2e')!
}

function findUseButton(node: ReactNode, label: string): (() => void) | undefined {
  let click: (() => void) | undefined
  Children.forEach(node, child => {
    if (click || !isValidElement<Record<string, unknown>>(child)) return
    click = child.type === 'button' && child.props['aria-label'] === label
      ? child.props.onClick as () => void : findUseButton(child.props.children as ReactNode, label)
  })
  return click
}

it('derives castable equipment spells without changing learned spells or retaining removed sources', () => {
  const charm = make('Healing Charm', 'item', 'Activate Two Actions; Frequency once per day; Effect You cast a 3rd-rank heal spell.')
  const other = { ...charm, id: 'other', name: 'Other Charm' }
  const heal = make('Heal', 'spell')
  const c: Character = { ...base, equipment: [{ name: charm.name, qty: 2 }, { name: other.name, qty: 1 }],
    spells: [{ name: 'Fear', rank: 1, cantrip: false }] }
  const before = JSON.stringify(c)
  expect(itemSpells(c, [charm, other, heal])).toMatchObject([
    { source: { name: 'Healing Charm' }, name: 'Heal', rank: 3, actions: 'Two Actions', frequency: 'once per day' },
    { source: { name: 'Other Charm' }, name: 'Heal', rank: 3 },
  ])
  expect(JSON.stringify(c)).toBe(before)
  expect(itemSpells({ ...c, equipment: [] }, [charm, other, heal])).toEqual([])
  expect(itemSpells({ ...c, equipment: c.equipment.map(item => ({ ...item, qty: 0 })) }, [charm, other, heal])).toEqual([])
  expect(itemSpells(c, [{ ...charm, deleted: true }, { ...other, systems: ['sf2e'] }, heal])).toEqual([])
})

it('does not turn triggers, casting bonuses, crafting requirements, or spell-effect references into item spells', () => {
  const references = make('Reference Charm', 'item',
    'Whenever you cast heal, increase healing.\n\nActivate Reaction; Trigger You are hit by force barrage; Effect Gain resistance as if you cast heal.\n\nCraft Requirements Supply one casting of heal.')
  const c = { ...base, equipment: [{ name: references.name, qty: 1 }] }
  expect(itemSpells(c, [references, make('Heal', 'spell'), make('Force Barrage', 'spell')])).toEqual([])
})

it('auto-heightens item spells without lowering higher ranks, changing uses, or granting additional spells', () => {
  const charm = make('Spell Charm', 'item', 'Activate Reaction; Frequency twice per day; Effect You cast a 2nd-rank fear spell (DC 25).')
  const higher: ContentEntry = { ...make('Healing Charm', 'item'),
    spellGrants: [{ kind: 'innate', spells: ['Heal'], rank: 6, frequency: 'once per day' }] }
  const entries = [charm, higher, make('Fear', 'spell'), make('Heal', 'spell')]
  let c: Character = { ...base, level: 9, equipment: [{ name: charm.name, qty: 1 }, { name: higher.name, qty: 1 }] }
  const original = itemSpells(c, entries)
  c = { ...c, itemSpellUses: { [original[0].usageKey]: [0] } }
  const before = JSON.stringify(c)
  updateSettings({ innateAutoHeighten: true })
  const heightened = itemSpells(c, entries)
  expect(heightened.map(spell => spell.rank)).toEqual([5, 6])
  expect(heightened.map(spell => [spell.name, spell.usageKey, spell.frequency, spell.actions, spell.dc]))
    .toEqual(original.map(spell => [spell.name, spell.usageKey, spell.frequency, spell.actions, spell.dc]))
  expect(itemSpellUses(c, heightened[0])).toMatchObject({ remaining: 1, spent: [0] })
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)).toContain('Rank 5')
  expect(JSON.stringify(c)).toBe(before)
  updateSettings({ innateAutoHeighten: false })
  expect(itemSpells(c, entries).map(spell => spell.rank)).toEqual([2, 6])
})

it('heightens actual staff spells and deduplicates resulting ranks without unlocking higher-grade spells', () => {
  const entries = [official('Staff of Healing (Greater)'), ...['Stabilize', 'Heal', 'Clear Mind', 'Regenerate'].map(official)]
  updateSettings({ innateAutoHeighten: true })
  const spells = itemSpells({ ...base, equipment: [{ name: 'Staff of Healing (Greater)', qty: 1 }] }, entries)
  expect(spells.filter(spell => spell.name === 'Heal')).toHaveLength(1)
  expect(spells.every(spell => spell.rank === 10 && spell.frequency === 'Staff charges')).toBe(true)
  expect(spells.some(spell => spell.name === 'Regenerate')).toBe(false)
})

it('preserves independent activations when auto-heightening makes their spell ranks equal', () => {
  const charm = make('Dual Charm', 'item',
    'Activate Two Actions; Frequency once per day; Effect You cast a 2nd-rank fear spell.\n\nActivate Two Actions; Frequency once per day; Effect You cast a 4th-rank fear spell.')
  const c: Character = { ...base, equipment: [{ name: charm.name, qty: 1 }] }
  updateSettings({ innateAutoHeighten: true })
  const spells = itemSpells(c, [charm, make('Fear', 'spell')])
  expect(spells.map(spell => spell.rank)).toEqual([10, 10])
  expect(spells[0].usageKey).not.toBe(spells[1].usageKey)
  const spent = { ...c, itemSpellUses: { [spells[0].usageKey]: [0] } }
  expect(itemSpellUses(spent, spells[0])?.remaining).toBe(0)
  expect(itemSpellUses(spent, spells[1])?.remaining).toBe(1)
})

it.each([['Masquerade Scarf', 1, 'once per day'], ['Masquerade Scarf (Greater)', 2, 'At will']] as const)(
  'uses only %s selected grade and its activation overrides', (name, rank, frequency) => {
    const source = official(name)
    const result = itemSpells({ ...base, equipment: [{ name, qty: 1 }] }, [source, official('Illusory Disguise')])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ name: 'Illusory Disguise', rank, frequency,
      actions: rank === 2 ? 'Two Actions' : '1 minute' })
  })

it.each([['Staff of Healing', 1], ['Staff of Healing (Greater)', 3]] as const)(
  'inherits lower staff spell lists without exposing higher grades for %s', (name, maximum) => {
    const names = ['Stabilize', 'Heal', 'Clear Mind', 'Sound Body', 'Cleanse Affliction', 'Breath of Life', 'Field of Life', 'Regenerate']
    const result = itemSpells({ ...base, equipment: [{ name, qty: 1 }] }, [official(name), ...names.map(official)])
    expect(result).toContainEqual(expect.objectContaining({ name: 'Stabilize', rank: 10 }))
    expect(result.filter(spell => spell.name === 'Heal').map(spell => spell.rank)).toEqual(maximum === 1 ? [1] : [1, 2, 3])
    expect(result.filter(spell => spell.name !== 'Stabilize').every(spell => spell.rank <= maximum)).toBe(true)
    expect(result.every(spell => spell.frequency === 'Staff charges' && spell.usesSpellcasting)).toBe(true)
  })

it('uses current Briar sharpness instead of granting spells from future artifact tiers', () => {
  const entries = [official('Briar'), official('Bastard Sword'), official('Oaken Resilience'), official('Breath of Life')]
  const c: Character = { ...base, equipment: [{ name: 'Briar', qty: 1 }],
    weapons: [{ id: 'briar', name: 'Briar', potency: 0, striking: 0, runes: [], briarSharpness: 4 }] }
  const result = itemSpells(c, entries)
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ name: 'Oaken Resilience', rank: 2 })
  expect(itemSpells({ ...c, weapons: [{ ...c.weapons![0], briarSharpness: 0 }] }, entries)).toEqual([])
})

it('renders innate-style item rows with actions, fixed ranks and usage dots instead of source text', () => {
  const source = make('Spark Charm', 'item', 'Activate Reaction; Frequency once per day; Effect You cast a 2nd-rank fear spell (DC 25).')
  const spell = { ...make('Fear', 'spell'), data: { saving_throw: 'Will', actions: 'Two Actions' } }
  const c = { ...base, equipment: [{ name: source.name, qty: 1 }] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[source, spell]} save={() => {}} />)
  expect(html).toContain('Item Spells')
  expect(html).not.toContain('>Spark Charm</button>')
  expect(html).not.toContain('once per day')
  expect(html).toContain('aria-label="Spend Fear (Spark Charm) use 1"')
  expect(html).toContain('class="action-cost" aria-label="Reaction"')
  expect(html).not.toContain('class="action-cost" aria-label="Two Actions"')
  expect(html).toContain('Rank 2')
  expect(html).toContain('Will DC 25')
  expect(html).not.toContain('Focus Points')
  expect(html).not.toContain('Remove Fear')
  expect(html).not.toContain('Fear active')
})

it('saves and restores item uses separately from innate uses, sharing alternatives but not other activations or items', () => {
  const source = make('Choice Charm', 'item',
    'Activate Two Actions; Frequency once per day; Effect You cast fear or heal.\n\nActivate Single Action; Frequency twice per day; Effect You cast light.')
  const other = { ...source, id: 'Other Charm', name: 'Other Charm' }
  const entries = [source, other, ...['Fear', 'Heal', 'Light'].map(name => make(name, 'spell'))]
  let c: Character = { ...base, equipment: [{ name: source.name, qty: 1 }, { name: other.name, qty: 1 }],
    innateSpellUses: { existing: [0] }, activeSpells: ['Oaken Resilience'] }
  const spells = itemSpells(c, entries)
  const fear = spells.find(spell => spell.source.id === source.id && spell.name === 'Fear')!
  const heal = spells.find(spell => spell.source.id === source.id && spell.name === 'Heal')!
  const light = spells.find(spell => spell.source.id === source.id && spell.name === 'Light')!
  const independent = spells.find(spell => spell.source.id === other.id && spell.name === 'Fear')!
  expect(fear.usageKey).toBe(heal.usageKey)
  expect(fear.usageKey).not.toBe(light.usageKey)
  expect(fear.usageKey).not.toBe(independent.usageKey)
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const click = (spell: typeof fear, action: 'Spend' | 'Restore', index = 1) => {
    const handler = findUseButton(ItemSpellUses({ c, save, spell }), `${action} ${spell.name} (${spell.source.name}) use ${index}`)
    if (!handler) throw new Error('Missing item use dot')
    handler()
  }
  click(fear, 'Spend')
  expect(itemSpellUses(c, heal)).toMatchObject({ remaining: 0, spent: [0] })
  expect(itemSpellUses(c, independent)).toMatchObject({ remaining: 1 })
  expect(itemSpellUses(c, light)).toMatchObject({ remaining: 2 })
  click(light, 'Spend', 2)
  expect(itemSpellUses(c, light)).toMatchObject({ remaining: 1, spent: [1] })
  click(heal, 'Restore')
  expect(itemSpellUses(c, fear)).toMatchObject({ remaining: 1, spent: [] })
  expect(itemSpellUses(c, light)).toMatchObject({ remaining: 1, spent: [1] })
  expect(c.innateSpellUses).toEqual({ existing: [0] })
  expect(c.activeSpells).toEqual(['Oaken Resilience'])
  const reloaded = itemSpells(c, [...entries].reverse()).find(spell => spell.source.id === source.id && spell.name === 'Light')!
  expect(itemSpellUses(c, reloaded)).toMatchObject({ remaining: 1, spent: [1] })
})

it.each(['At will', 'Staff charges', 'once per hour'])('retains %s notes and falls back to spell action icons', frequency => {
  const source: ContentEntry = { ...make('Spell Charm', 'item'),
    spellGrants: [{ kind: 'innate', spells: ['Fear'], frequency }] }
  const spell = { ...make('Fear', 'spell'), data: { actions: 'Two Actions' } }
  const c = { ...base, equipment: [{ name: source.name, qty: 1 }] }
  const grant = itemSpells(c, [source, spell])[0]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[source, spell]} save={() => {}} />)
  expect(html).toContain(frequency)
  expect(html).toContain('class="action-cost" aria-label="Two Actions"')
  expect(html).not.toContain('>Spell Charm</button>')
  expect(!!itemSpellUses(c, grant)).toBe(frequency === 'once per hour')
  if (frequency !== 'once per hour') expect(html).not.toContain('class="focus-point"')
})

it('includes spells from worn armor runes and removes them when armor is taken off', () => {
  const rune = make('Spell Rune', 'item', 'Activate Two Actions; Effect You cast a 2nd-rank fear spell.')
  const entries = [official('Chain Mail'), rune, official('Fear')]
  const c: Character = { ...base, armors: [{ id: 'armor', name: 'Chain Mail', worn: true, potency: 0, resilient: 0, runes: [rune.name] }] }
  expect(itemSpells(c, entries)).toContainEqual(expect.objectContaining({ name: 'Fear', rank: 2, source: expect.objectContaining({ name: rune.name }) }))
  expect(itemSpells({ ...c, armors: [{ ...c.armors![0], worn: false }] }, entries)).toEqual([])
})

it('keeps referenced spell effects separate from actual spells and surfaces unavailable explicit grants', () => {
  const winged = official('Winged')
  expect(itemSpells({ ...base, equipment: [{ name: winged.name, qty: 1 }] }, [winged, official('Fly')])).toEqual([])
  const source: ContentEntry = { ...make('Custom Spell Charm', 'item'),
    spellGrants: [{ kind: 'innate', spells: ['Missing Spell'], rank: 4, frequency: 'once per day' }] }
  const c = { ...base, equipment: [{ name: source.name, qty: 1 }] }
  expect(itemSpells(c, [source])).toMatchObject([{ name: 'Missing Spell', rank: 4, frequency: 'once per day' }])
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={[source]} save={() => {}} />)).toContain('Spell data unavailable')
})
