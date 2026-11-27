import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { mapAonHit, mapAonHits } from './aon'
import snapshot from '../public/data/aon-pf2e.json?raw'
import sfSnapshot from '../public/data/aon-sf2e.json?raw'
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
const sfHits: Parameters<typeof mapAonHit>[0][] = JSON.parse(sfSnapshot)
const official = (name: string) => {
  const hit = hits.find(hit => hit._source?.name === name)
  expect(hit, name).toBeDefined()
  return mapAonHit(hit!, 'pf2e')!
}
const officialSf = (name: string) => {
  const hit = sfHits.find(hit => hit._source?.name === name)
  expect(hit, name).toBeDefined()
  return mapAonHit(hit!, 'sf2e')!
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

it('grants Presence Intensifier Suggestion with its daily house rule and Finely Tuned', () => {
  const previous = getSettings().presenceIntensifierDaily
  try {
    updateSettings({ presenceIntensifierDaily: true })
    const presence = officialSf('Presence Intensifier')
    const suggestion = officialSf('Suggestion')
    const entries = [presence, suggestion]
    const c: Character = { ...base, systems: ['sf2e'], level: 17,
      augmentations: [{ id: 'presence', entryId: presence.id, name: presence.name, slot: 'apex' }] }
    const grant = itemSpells(c, entries)[0]
    expect(grant).toMatchObject({ name: 'Suggestion', rank: 9, actions: 'Two Actions', dc: 38,
      frequency: 'once per day', entry: { name: 'Suggestion' } })
    expect(itemSpellUses(c, grant)).toMatchObject({ limit: 1, remaining: 1 })
    const tuned: Character = { ...c, feats: [{ name: 'Finely Tuned', type: 'Archetype Feat', level: 6,
      slot: 'archetype:6:0', choice: presence.name }] }
    const enhanced = itemSpells(tuned, entries)[0]
    expect(enhanced).toMatchObject({ frequency: 'twice per day', usageKey: grant.usageKey })
    expect(itemSpellUses(tuned, enhanced)).toMatchObject({ limit: 2, remaining: 2 })
    expect(itemSpells({ ...tuned, level: 20 }, entries)[0].rank).toBe(10)
    expect(itemSpells({ ...tuned, level: 5 }, entries)[0]).toMatchObject({ rank: 4, frequency: 'once per day' })
    expect(itemSpells({ ...c, augmentations: [] }, entries)).toEqual([])
    expect(itemSpells({ ...c, systems: ['pf2e'] }, entries)).toEqual([])
    updateSettings({ presenceIntensifierDaily: false })
    expect(itemSpells(tuned, entries)[0]).toMatchObject({ rank: 4, frequency: 'once per hour' })
  } finally {
    updateSettings({ presenceIntensifierDaily: previous })
  }
})

it.each([
  ['Commercial', 2, 1], ['Tactical', 2, 3], ['Advanced', 4, 3],
] as const)('adds %s Cloaking Skin Invisibility with grade-based shared uses', (grade, rank, limit) => {
  const entries = mapAonHits(sfHits.filter(hit => /^(?:Cloaking Skin(?: \([^)]*\))?|Invisibility)$/.test(String(hit._source?.name))), 'sf2e')
  const skin = entries.find(entry => entry.name === `Cloaking Skin (${grade})`)!
  expect(skin).toBeDefined()
  let c: Character = { ...base, systems: ['sf2e'], augmentations: [
    { id: 'skin', entryId: skin.id, name: skin.name, slot: 'standard' },
  ], augmentationDailyUses: { skin: true }, augmentationExtraDailyUses: { skin: true } }
  const feat = { name: 'Finely Tuned', type: 'Archetype Feat', level: 6, choice: skin.name }
  const getSpell = () => itemSpells(c, entries).find(spell => spell.source.id === skin.id)!
  let spell = getSpell()
  expect(spell).toMatchObject({ name: 'Invisibility', rank, actions: 'Single Action' })
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />))
    .not.toContain('Invisible for up to 1 minute.')
  expect(itemSpellUses(c, spell)).toMatchObject({ limit, remaining: limit - 1, spent: [0] })
  c = { ...c, feats: [feat] }
  spell = getSpell()
  expect(itemSpellUses(c, spell)).toMatchObject({ limit: limit + 1, remaining: limit - 1, spent: [0, limit] })
  const tracker = ItemSpellUses({ c, spell, save: patch => { c = { ...c, ...patch } } })
  findUseButton(tracker, `Restore Invisibility (${skin.name}) use 1`)!()
  expect(itemSpellUses(c, getSpell())?.remaining).toBe(limit)
  c = { ...c, feats: [] }
  expect(itemSpellUses(c, getSpell())?.spent).not.toContain(limit)
  c = { ...c, feats: [feat] }
  expect(itemSpellUses(c, getSpell())?.spent).toContain(limit)
  expect(itemSpells({ ...c, augmentations: [] }, entries)).toEqual([])
})

it('opens False Vitality controls at the item spell rank', () => {
  const charm = make('Vitality Charm', 'item', 'Activate Two Actions; Frequency once per day; Effect You cast a 4th-rank false vitality spell.')
  const vitality = { ...make('False Vitality', 'spell'), level: 2, data: { actions: 'Two Actions' } }
  const c = { ...base, equipment: [{ name: charm.name, qty: 1 }] }
  expect(itemSpells(c, [charm, vitality])[0]).toMatchObject({ name: 'False Vitality', rank: 4 })
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[charm, vitality]} save={() => {}} />)
  expect(html).toContain('False Vitality (Rank 4)</h4>')
  expect(html).toContain('aria-label="False Vitality active"')
})

it('adds scaling Invisibility from Clandestine Suit and scales Cloaking Device uses by upgrade grade', () => {
  const suit: ContentEntry = { ...make('Clandestine Suit', 'armor'), systems: ['sf2e'], level: 9,
    data: { url: 'clandestine', armor_grade: 'Advanced', upgrade_slots: 0 } }
  const module = (name: string, level: number): ContentEntry => ({ ...make(name, 'item'), systems: ['sf2e'], level,
    data: { item_subcategory: 'Armor Upgrades' } })
  const commercial = module('Cloaking Device (Commercial)', 8)
  const tactical = module('Cloaking Device (Tactical)', 10)
  const invisibility: ContentEntry = { ...make('Invisibility', 'spell'), systems: ['sf2e'], level: 2 }
  const armor = { id: 'clandestine-id', name: suit.name, potency: 0, resilient: 0, runes: [], worn: true }
  const c: Character = { ...base, systems: ['sf2e'], level: 9, armors: [armor] }
  const entries = [suit, commercial, tactical, invisibility]
  const first = itemSpells(c, entries)[0]
  expect(first).toMatchObject({
    name: 'Invisibility', rank: 5, actions: 'Single Action', frequency: 'once per day',
    usageKey: JSON.stringify([armor.id, 'cloaking-device', 'invisibility']),
    source: { name: commercial.name },
  })
  const upgraded = itemSpells({ ...c, level: 10 }, entries)[0]
  expect(upgraded).toMatchObject({ rank: 5, frequency: 'three times per day', source: { name: tactical.name } })
  expect(upgraded.usageKey).toBe(first.usageKey)
  const highest = itemSpells({ ...c, level: 20 }, entries)[0]
  expect(highest).toMatchObject({ rank: 10, frequency: 'three times per day' })
  const html = renderToStaticMarkup(<SpellsSection c={{ ...c, level: 10 }} entries={entries} save={() => {}} />)
  expect(html).not.toContain('Invisible for 1 minute.')
  expect(html).toContain('aria-label="3 of 3 uses remaining"')
})

it("grants grade-scaled Lock from Tactical and Advanced Programmer's Plushies", () => {
  const commercial = officialSf("Programmer's Plushie (Commercial)")
  const tactical = officialSf("Programmer's Plushie (Tactical)")
  const advanced = officialSf("Programmer's Plushie (Advanced)")
  const lock = officialSf('Lock')
  const entries = [commercial, tactical, advanced, lock]
  const spells = (name: string) => itemSpells({
    ...base, systems: ['sf2e'], equipment: [{ name, qty: 1 }],
  }, entries)
  expect(spells(commercial.name)).toEqual([])
  expect(spells(tactical.name)).toContainEqual(expect.objectContaining({
    name: 'Lock', rank: 3, dc: 25, source: tactical,
  }))
  expect(spells(advanced.name)).toContainEqual(expect.objectContaining({
    name: 'Lock', rank: 7, dc: 35, source: advanced,
  }))
  const html = renderToStaticMarkup(<SpellsSection c={{
    ...base, systems: ['sf2e'], equipment: [{ name: tactical.name, qty: 1 }],
  }} entries={entries} save={() => {}} />)
  expect(html).toContain('>Lock</button>')
})

it('keeps item-spell triggers in source rules rather than inline helper text', () => {
  const source = make("Hunter's Dawn", 'item')
  const condition = "You hit a creature with a ranged Strike with Hunter's Dawn"
  source.spellGrants = [{ kind: 'innate', spells: ['Command'], rank: 1, condition, frequency: 'once per day' }]
  const spell = make('Command', 'spell')
  const entries = [source, spell]
  const c = { ...base, equipment: [{ name: source.name, qty: 1 }] }
  expect(itemSpells(c, entries)[0]).toMatchObject({ condition })
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('>Command</button>')
  expect(html).not.toContain(condition)
})

it('does not turn triggers, casting bonuses, crafting requirements, or spell-effect references into item spells', () => {
  const references = make('Reference Charm', 'item',
    'Whenever you cast heal, increase healing.\n\nActivate Reaction; Trigger You are hit by force barrage; Effect Gain resistance as if you cast heal.\n\nCraft Requirements Supply one casting of heal.')
  const c = { ...base, equipment: [{ name: references.name, qty: 1 }] }
  expect(itemSpells(c, [references, make('Heal', 'spell'), make('Force Barrage', 'spell')])).toEqual([])
})

it('lists the Highhelm wall effect without a separate spell use', () => {
  const entries = [official('Highhelm Stronghold Plate'), official('Bastion Plate'), official('Wall of Stone')]
  const armor = { id: 'stronghold', name: 'Highhelm Stronghold Bastion Plate', worn: true, potency: 0, resilient: 0, runes: [] }
  const c: Character = { ...base, armors: [armor] }
  const spell = itemSpells(c, entries)[0]
  expect(spell).toMatchObject({ name: 'Wall of Stone', actions: 'Three Actions', source: { name: armor.name } })
  expect(itemSpellUses(c, spell)).toBeUndefined()
  expect(itemSpells({ ...c, armors: [{ ...armor, worn: false }] }, entries)).toEqual([])
  expect(itemSpells({ ...c, armors: [{ ...armor, worn: false, strongholdWallActive: true }] }, entries))
    .toMatchObject([{ name: 'Wall of Stone' }])
})

it.each(['Breastplate of the Mountain', 'Full Plate of the Mountain', 'Bastion Plate of the Mountain'])(
  'lists the %s Regenerate activation and scales its rank', name => {
    const entries = [official('Breastplate of the Mountain'), official('Breastplate'), official('Full Plate'),
      official('Bastion Plate'), official('Regenerate')]
    const armor = { id: 'mountain', name, worn: true, potency: 0, resilient: 0, runes: [] }
    const c: Character = { ...base, level: 20, armors: [armor] }
    const original = itemSpells(c, entries)
    expect(original).toMatchObject([{ name: 'Regenerate', rank: 7, actions: 'Two Actions',
      frequency: 'once per day', source: { name } }])
    expect(itemSpellUses(c, original[0])).toMatchObject({ remaining: 1 })
    updateSettings({ innateAutoHeighten: true })
    const scaled = itemSpells(c, entries)
    expect(scaled).toMatchObject([{ name: 'Regenerate', rank: 10, actions: 'Two Actions', frequency: 'once per day' }])
    expect(itemSpells({ ...c, level: 10 }, entries)[0].rank).toBe(7)
    expect(scaled[0].usageKey).toBe(original[0].usageKey)
    expect(itemSpellUses({ ...c, itemSpellUses: { [scaled[0].usageKey]: [0] } }, scaled[0])?.remaining).toBe(0)
    expect(itemSpells({ ...c, armors: [{ ...armor, worn: false }] }, entries)).toEqual([])
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
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)).not.toContain('spell-rank-label')
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

it('tracks Briar Oaken Resilience uses at its current sharpness', () => {
  const entries = [official('Briar'), official('Bastard Sword'), official('Oaken Resilience'), official('Breath of Life')]
  let c: Character = { ...base, equipment: [{ name: 'Briar', qty: 1 }],
    weapons: [{ id: 'briar', name: 'Briar', potency: 0, striking: 0, runes: [], briarSharpness: 4 }] }
  const result = itemSpells(c, entries)
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ name: 'Oaken Resilience', rank: 2, frequency: 'three times per day' })
  expect(itemSpellUses(c, result[0])).toMatchObject({ limit: 3, remaining: 3 })
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const markup = () => renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
  expect(markup()).toContain('aria-label="3 of 3 uses remaining"')
  expect(markup()).not.toContain('three times per day')
  findUseButton(ItemSpellUses({ c, save, spell: result[0] }), 'Spend Oaken Resilience (Briar Bastard Sword) use 2')!()
  expect(itemSpellUses(c, result[0])).toMatchObject({ remaining: 2, spent: [1] })
  expect(markup()).toContain('aria-label="2 of 3 uses remaining"')
  findUseButton(ItemSpellUses({ c, save, spell: result[0] }), 'Restore Oaken Resilience (Briar Bastard Sword) use 2')!()
  expect(itemSpellUses(c, result[0])).toMatchObject({ remaining: 3, spent: [] })
  expect(itemSpells({ ...c, weapons: [{ ...c.weapons![0], briarSharpness: 0 }] }, entries)).toEqual([])
})

it('renders innate-style item rows with actions and usage dots, without rank labels or source text', () => {
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
  expect(html).not.toContain('spell-rank-label')
  expect(html).toContain('Will DC 25')
  expect(html).not.toContain('Focus Points')
  expect(html).not.toContain('Remove Fear')
  expect(html).not.toContain('Fear active')
})

it('hides the one-minute activation beside item Creation without changing other activations', () => {
  const source = make('Creation Charm', 'item',
    'Activate 1 minute; Frequency once per day; Effect You cast a 5th-rank creation spell.')
  const other = make('Other Charm', 'item',
    'Activate 1 minute; Frequency once per day; Effect You cast a 2nd-rank fear spell.')
  const creation = make('Creation', 'spell')
  const fear = make('Fear', 'spell')
  const entries = [source, other, creation, fear]
  const c = { ...base, equipment: [{ name: source.name, qty: 1 }, { name: other.name, qty: 1 }] }
  expect(itemSpells(c, entries).find(spell => spell.name === 'Creation')?.actions).toBe('1 minute')
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  const rows = html.match(/<li class="innate-spell-row">[\s\S]*?<\/li>/g) ?? []
  expect(rows.find(row => row.includes('>Creation</button>'))).not.toContain('1 minute')
  expect(rows.find(row => row.includes('>Fear</button>'))).toContain('1 minute')
  const faster = { ...source, description: source.description.replace('1 minute', 'Two Actions') }
  const fasterHtml = renderToStaticMarkup(<SpellsSection c={c} entries={[faster, creation]} save={() => {}} />)
  expect(fasterHtml).toContain('aria-label="Two Actions"')
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

it.each(['At will', 'Staff charges', 'once per hour'])('renders %s spells and falls back to spell action icons', frequency => {
  const source: ContentEntry = { ...make('Spell Charm', 'item'),
    spellGrants: [{ kind: 'innate', spells: ['Fear'], frequency }] }
  const spell = { ...make('Fear', 'spell'), data: { actions: 'Two Actions' } }
  const c = { ...base, equipment: [{ name: source.name, qty: 1 }] }
  const grant = itemSpells(c, [source, spell])[0]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[source, spell]} save={() => {}} />)
  if (frequency === 'once per hour') expect(html).not.toContain(frequency)
  else expect(html).toContain(frequency)
  expect(html).toContain('class="action-cost" aria-label="Two Actions"')
  expect(html).not.toContain('>Spell Charm</button>')
  expect(!!itemSpellUses(c, grant)).toBe(frequency === 'once per hour')
  if (frequency !== 'once per hour') expect(html).not.toContain('class="focus-point"')
})

it('provides actionable healing and Ancestral Embrace Avatar in item spells', () => {
  const embrace = official('Ancestral Embrace')
  const avatar = official('Avatar')
  const heal = official('Heal')
  const hide = official('Hide Armor')
  const charm = make('Healing Charm', 'item', 'Activate Two Actions; Frequency once per day; Effect You cast a 3rd-rank heal spell.')
  const c: Character = { ...base, equipment: [{ name: charm.name, qty: 1 }],
    armors: [{ id: 'armor', name: embrace.name, worn: true, potency: 0, resilient: 0, runes: [] }] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[embrace, hide, avatar, charm, heal]} save={() => {}} />)
  expect(html).toContain('aria-label="Avatar options"')
  expect(html).toContain('aria-label="Avatar active"')
  expect(html).toContain('aria-label="Roll Heal: 2-action healing"')
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
