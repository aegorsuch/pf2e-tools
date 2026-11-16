import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { classSpellcasting, classSpellSlots, druidSpellList } from './builder'
import { SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'

const base: Character = {
  id: 'druid', name: 'Druid', className: 'Druid', systems: ['pf2e'], level: 1,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const spell = (name: string, level = 1, tradition = 'Primal', traits: string[] = []): ContentEntry => ({
  id: name, name, kind: 'spell', systems: ['pf2e'], source: 'official', level, traits,
  data: { tradition }, description: '', effects: [], updatedAt: 0,
})
const taken = (name: string, level: number) => ({ name, level, type: 'Class Feat' })
const render = (c: Character, entries: ContentEntry[]) =>
  renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => { throw Error('Rendering must not rewrite character data') }} />)
const choices = (html: string, label: string) =>
  new RegExp(`<select aria-label="${label}"[^>]*>([\\s\\S]*?)</select>`).exec(html)?.[1] ?? ''

it.each([
  [1, [5, 2]],
  [2, [5, 3]],
  [3, [5, 3, 2]],
  [7, [5, 3, 3, 3, 2]],
  [17, [5, ...Array(8).fill(3), 2]],
  [18, [5, ...Array(9).fill(3)]],
  [19, [5, ...Array(9).fill(3), 1]],
  [20, [5, ...Array(9).fill(3), 1]],
])('derives Druid spell slots at level %i', (level, counts) => {
  expect(Object.values(classSpellSlots({ ...base, level })!)).toEqual(counts)
})

it('applies Hierophant power once, only when acquired, without changing other casters', () => {
  const c = { ...base, level: 20, feats: [taken("Hierophant's Power", 20), taken("Hierophant's Power", 20)] }
  expect(classSpellSlots(c)?.[10]).toBe(2)
  expect(classSpellSlots({ ...c, level: 19 })?.[10]).toBe(1)
  expect(classSpellSlots({ ...c, feats: [taken("Hierophant's Power", 21)] })?.[10]).toBe(1)
  expect(classSpellSlots({ ...c, className: 'Wizard' })).toBeUndefined()
  expect(classSpellSlots({ ...base, level: 0 })).toEqual({})
})

it.each([[1, 1], [7, 2], [15, 3], [19, 4]])('fixes Druid tradition, ability and proficiency at level %i', (level, rank) => {
  expect(classSpellcasting({ ...base, level,
    spellcasting: { ability: 'int', tradition: 'Arcane', rank: 1, slots: {} } }, []))
    .toMatchObject({ traditions: ['Primal'], ability: 'wis', rank })
})

it('adds feat-granted spells to the primal list and excludes unavailable content and focus spells', () => {
  const heal = spell('Heal')
  const illusions = ['Illusory Disguise', 'Illusory Object', 'Illusory Scene'].map(name => spell(name, 1, 'Arcane'))
  const memory = spell('Rewrite Memory', 4, 'Occult')
  const entries = [heal, ...illusions, memory, spell('Arcane Only', 1, 'Arcane'),
    spell('Tempest Surge', 1, 'Primal', ['Focus']), { ...spell('Deleted'), deleted: true },
    { ...spell('Other System'), systems: ['sf2e'] as Character['systems'] }]
  const c = { ...base, level: 8, feats: [taken('Fey Caller', 8), taken('Forgotten Presence', 8)] }
  expect(druidSpellList(base, entries)).toEqual([heal])
  expect(druidSpellList(c, entries).map(entry => entry.name))
    .toEqual(['Heal', 'Illusory Disguise', 'Illusory Object', 'Illusory Scene', 'Rewrite Memory'])
  expect(druidSpellList({ ...c, level: 7 }, entries)).toEqual([heal])
  expect(druidSpellList({ ...c, feats: [taken('Fey Caller', 9)] }, entries)).toEqual([heal])
})

it('prepares common primal spells without a manually populated spellbook or slot counts', () => {
  const entries = [spell('Heal'), spell('Cantrip', 1, 'Primal', ['Cantrip']),
    spell('Rare Magic', 1, 'Primal', ['Rare']), spell('Arcane Only', 1, 'Arcane'), spell('Higher Rank', 2)]
  const html = render(base, entries)
  const rankOne = choices(html, 'Spell Rank 1 slot 1')
  const cantrip = choices(html, 'Cantrip slot 1')
  expect(rankOne).toContain('value="Heal"')
  for (const name of ['Cantrip', 'Rare Magic', 'Arcane Only', 'Higher Rank']) expect(rankOne).not.toContain(`value="${name}"`)
  expect(cantrip).toContain('value="Cantrip"')
  expect(cantrip).not.toContain('value="Heal"')
  expect(html).toContain('Cantrips: 5')
  expect(html).toContain('Rank 1: 2')
  expect(html).not.toContain('type="number"')
  expect(html).not.toContain('Filter spells by tradition')
  expect(html).toContain('<span>Duration</span><span>Range</span><span>Save</span><span>Area/Targets</span>')
})

it('retains explicit learned access to uncommon spells', () => {
  const rare = spell('Rare Magic', 1, 'Primal', ['Rare'])
  const c = { ...base, spells: [{ name: rare.name, entryId: rare.id, rank: 1, cantrip: false }] }
  expect(choices(render(c, [rare]), 'Spell Rank 1 slot 1')).toContain('value="Rare Magic"')
  expect(render(c, [rare])).toContain('aria-label="Remove Rare Magic"')
})

it('retains saved preparations and spent slots while deriving valid current-level capacity', () => {
  const heal = { ...spell('Heal'), data: { tradition: 'Primal', saving_throw: 'Will' } }
  const arcane = spell('Arcane Only', 1, 'Arcane')
  const c: Character = { ...base, level: 3, spellcasting: {
    ability: 'int', tradition: 'Arcane', rank: 4, slots: { 1: 9, 10: 5 },
    prepared: { '1:0': arcane.id, '1:1': heal.id, '10:0': 'Future Spell' }, spentSlots: ['1:1', '10:0'],
  } }
  const before = JSON.stringify(c)
  const html = render(c, [heal, arcane])
  expect(html).toContain('Arcane Only (unavailable)')
  expect(html).toContain('Selected spell unavailable for your current spell list or slot rank.')
  expect(html).toContain('disabled="" aria-label="Cast spell slot rank 1 slot 1"')
  expect(html).toContain('disabled="" aria-label="Cast spell slot rank 1 slot 2"')
  expect(html).toContain('Spell Rank 2 slot 2')
  expect(html).not.toContain('Spell Rank 10 slot')
  expect(html).toContain('<small>Save</small>Will DC 19')
  expect(JSON.stringify(c)).toBe(before)
})

it('preserves name-based legacy preparations without requiring saved entry IDs', () => {
  const heal = { ...spell('Heal'), id: 'canonical-heal' }
  const c: Character = { ...base, spells: [{ name: 'Heal', rank: 1, cantrip: false }],
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: {}, prepared: { '1:0': 'Heal' } } }
  const html = render(c, [heal])
  expect(choices(html, 'Spell Rank 1 slot 1')).toContain('value="Heal" selected=""')
  expect(html).not.toContain('Heal (unavailable)')
  expect(html).not.toContain('disabled="" aria-label="Cast spell slot rank 1 slot 1"')
})

it('keeps large closed spell pickers small and selected spells visible', () => {
  const entries = Array.from({ length: 200 }, (_, index) => spell(`Primal ${index}`))
  const c: Character = { ...base, level: 20,
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: {}, prepared: { '1:0': 'Primal 50' } } }
  const html = render(c, entries)
  expect(html).toContain('aria-expanded="false"')
  expect(html).toContain('value="Primal 50" selected=""')
  expect(html.match(/<option/g)).toHaveLength(34)
  expect(html).not.toContain('value="Primal 199"')
  expect(html).not.toContain('disabled="" aria-label="Cast spell slot rank 1 slot 1"')
})

it('retains manual settings with an explicit warning for unsupported flexible preparation', () => {
  const c: Character = { ...base, level: 4, feats: [taken('Flexible Spellcaster Dedication', 2)],
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: { 0: 5, 1: 2, 2: 2 } } }
  expect(classSpellSlots(c)).toBeUndefined()
  const html = render(c, [])
  expect(html).toContain('Flexible Spellcaster preparation is not automated')
  expect(html).toContain('value="2"')
})

it('bounds spell catalog work instead of rescanning every entry for every preparation slot', () => {
  let reads = 0
  const spells = Array.from({ length: 80 }, (_, index) => spell(`Primal ${index}`))
  const entries = [
    ...Array.from({ length: 1000 }, (_, index) => ({ ...spell(`Filler ${index}`), kind: 'item' as const })),
    ...spells,
  ].map(entry => new Proxy(entry, { get(target, property) {
    if (property === 'kind') reads++
    return Reflect.get(target, property)
  } }))
  const c: Character = { ...base, level: 19, order: 'Storm',
    spells: spells.map(entry => ({ name: entry.name, entryId: entry.id, rank: 1, cantrip: false })),
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: {} } }
  render(c, entries)
  reads = 0
  render(c, entries)
  expect(reads).toBeLessThan(entries.length * 50)
})
