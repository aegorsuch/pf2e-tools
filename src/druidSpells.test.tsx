import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { classSpellcasting, classSpellSlots, druidSpellList } from './builder'
import { SelectedSlotSpell, SpellsSection } from './SpellsSection'
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

it('opens selected spells by name and confirms clearing without affecting locked slots', () => {
  const clear = vi.fn()
  const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
  vi.stubGlobal('window', { confirm })
  try {
    const tree = SelectedSlotSpell({ name: 'Heal', entry: spell('Heal'), onClear: clear })
    const html = renderToStaticMarkup(tree)
    expect(html).toContain('aria-haspopup="dialog">Heal</button>')
    expect(html).toContain('aria-label="Clear Heal spell slot"')
    let remove: (() => void) | undefined
    Children.forEach(tree.props.children as ReactNode, child => {
      if (isValidElement<{ 'aria-label'?: string; onClick?: () => void }>(child)
        && child.props['aria-label'] === 'Clear Heal spell slot') remove = child.props.onClick
    })
    expect(remove).toBeDefined()
    remove?.()
    expect(clear).not.toHaveBeenCalled()
    remove?.()
    expect(clear).toHaveBeenCalledOnce()
    expect(renderToStaticMarkup(SelectedSlotSpell({ name: 'Heal', entry: spell('Heal') })))
      .not.toContain('aria-label="Clear Heal spell slot"')
    const heightened = renderToStaticMarkup(SelectedSlotSpell({ name: 'Summon Undead', entry: spell('Summon Undead'), heightened: 8 }))
    expect(heightened).toContain('aria-haspopup="dialog">Summon Undead (+8)</button>')
    expect(heightened).toMatch(/<h4[^>]*>Summon Undead<small>/)
  } finally { vi.unstubAllGlobals() }
})

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

it('prepares accessible primal spells without a manually populated spellbook or slot counts', () => {
  const entries = [spell('Heal'), spell('Cantrip', 1, 'Primal', ['Cantrip']),
    spell('Rare Magic', 1, 'Primal', ['Rare']), spell('Arcane Only', 1, 'Arcane'), spell('Higher Rank', 2),
    { ...spell('Restricted Magic'), data: { tradition: 'Primal', access: 'Kellid ethnicity' } }]
  const html = render(base, entries)
  const rankOne = choices(html, 'Spell Rank 1 slot 1')
  const cantrip = choices(html, 'Cantrip slot 1')
  expect(rankOne).toContain('value="Heal"')
  expect(rankOne).toContain('value="Rare Magic"')
  for (const name of ['Cantrip', 'Restricted Magic', 'Arcane Only', 'Higher Rank']) expect(rankOne).not.toContain(`value="${name}"`)
  expect(choices(render({ ...base, ethnicity: 'Kellid' }, entries), 'Spell Rank 1 slot 1')).toContain('value="Restricted Magic"')
  expect(cantrip).toContain('value="Cantrip"')
  expect(cantrip).not.toContain('value="Heal"')
  expect(html).not.toContain('Spell slots:')
  expect(html).not.toContain('Slots follow your Druid level')
  expect(html).toContain('Spell Rank 1 slot 2')
  expect(html).not.toContain('Spell Rank 1 slot 3')
  expect(html).not.toContain('type="number"')
  expect(html).not.toContain('Filter spells by tradition')
  expect(html).toContain('<span>Duration</span><span>Range</span><span>Save</span><span>Area/Targets</span>')
})

it('orders Druid preparation by actual spell rank and labels heightened choices', () => {
  const entries = [spell('Zap', 1), spell('Alpha', 2), spell('Beta', 2), spell('Gamma', 3)]
  const html = render({ ...base, level: 5 }, entries)
  const options = choices(html, 'Spell Rank 3 slot 1')
  expect(options).toMatch(/>Gamma<\/option>[\s\S]*>\+1 Alpha<\/option>[\s\S]*>\+1 Beta<\/option>[\s\S]*>\+2 Zap<\/option>/)
})

it('retains explicit learned access to uncommon spells', () => {
  const rare = { ...spell('Rare Magic', 1, 'Primal', ['Rare']), data: { tradition: 'Primal', access: 'Kellid ethnicity' } }
  const c = { ...base, spells: [{ name: rare.name, entryId: rare.id, rank: 1, cantrip: false }] }
  expect(choices(render(base, [rare]), 'Spell Rank 1 slot 1')).not.toContain('value="Rare Magic"')
  expect(choices(render(c, [rare]), 'Spell Rank 1 slot 1')).toContain('value="Rare Magic"')
  expect(render(c, [rare])).toContain('aria-label="Remove Rare Magic"')
})

it.each(['', 'aon:pf2e:heal', 'aon:sf2e:heal', 'Heal'])('deduplicates Druid choices while preserving saved preparation %j', selected => {
  const entries = [
    { ...spell('Heal'), id: 'aon:sf2e:heal', systems: ['sf2e'] as Character['systems'] },
    { ...spell('Guidance', 1, 'Primal', ['Cantrip']), id: 'aon:sf2e:guidance', systems: ['sf2e'] as Character['systems'] },
    { ...spell('Heal'), id: 'aon:pf2e:heal' },
    { ...spell('Guidance', 1, 'Primal', ['Cantrip']), id: 'aon:pf2e:guidance' },
  ]
  const c: Character = { ...base, systems: ['pf2e', 'sf2e'],
    spells: [{ name: 'Heal', rank: 1, cantrip: false }],
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: {}, prepared: { '1:0': selected } } }
  const before = JSON.stringify(c)
  const html = render(c, entries)
  if (!selected) expect(choices(html, 'Spell Rank 1 slot 1').match(/>Heal<\/option>/g)).toHaveLength(1)
  expect(choices(html, 'Cantrip slot 1').match(/>Guidance<\/option>/g)).toHaveLength(1)
  if (selected) {
    expect(html).toContain('aria-label="Clear Heal spell slot"')
    expect(html).not.toContain('aria-label="Details: Heal"')
    expect(html).not.toContain('disabled="" aria-label="Cast spell slot rank 1 slot 1"')
  }
  expect(html).not.toContain('(unavailable)')
  expect(JSON.stringify(c)).toBe(before)
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
  expect(html).toContain('aria-label="Clear Arcane Only spell slot"')
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
  expect(html).toContain('aria-label="Clear Heal spell slot"')
  expect(html).not.toContain('Heal (unavailable)')
  expect(html).not.toContain('disabled="" aria-label="Cast spell slot rank 1 slot 1"')
})

it('keeps large closed spell pickers small and selected spells visible', () => {
  const entries = Array.from({ length: 200 }, (_, index) => spell(`Primal ${index}`))
  const c: Character = { ...base, level: 20,
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: {}, prepared: { '1:0': 'Primal 50' } } }
  const html = render(c, entries)
  expect(html).toContain('aria-expanded="false"')
  expect(html).toContain('aria-label="Clear Primal 50 spell slot"')
  expect(html.match(/<option/g)).toHaveLength(32)
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
