import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { mapAonHit } from './aon'
import snapshot from '../public/data/aon-pf2e.json?raw'
import { itemSpells } from './itemSpells'
import { SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'

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

it('renders item sources and fixed ranks without focus points or removable learned-spell controls', () => {
  const source = make('Spark Charm', 'item', 'Activate Reaction; Frequency once per day; Effect You cast a 2nd-rank fear spell (DC 25).')
  const spell = { ...make('Fear', 'spell'), data: { saving_throw: 'Will' } }
  const c = { ...base, equipment: [{ name: source.name, qty: 1 }] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[source, spell]} save={() => {}} />)
  expect(html).toContain('Item Spells')
  expect(html).toContain('Spark Charm')
  expect(html).toContain('Rank 2')
  expect(html).toContain('Will DC 25')
  expect(html).not.toContain('Focus Points')
  expect(html).not.toContain('Remove Fear')
  expect(html).not.toContain('Fear active')
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
