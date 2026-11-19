import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Character, ContentEntry } from './types'
import { witchwarperParadox, witchwarperRepertoireSlots, witchwarperSetup, witchwarperSpellcasting, witchwarperSpellOptions, witchwarperSpellSlots } from './witchwarper'
import { additionalSkillCount, automaticFeatGrants, classSpellcasting, classSpellSlots, focusSpells, speed } from './builder'
import { mapAonHit } from './aon'
import { SpellsSection } from './SpellsSection'

const base: Character = {
  id: 'witchwarper', name: 'Witchwarper', className: 'Witchwarper', subclass: 'Analyst',
  systems: ['sf2e'], level: 1, abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  boosts: { class: 'int' },
}

describe('Witchwarper class setup', () => {
  it.each([
    ['Analyst', 'Computers', 'Arcane', 'Warp Probability'],
    ['Anomaly', 'Deception', 'Arcane', 'Warp Terrain'],
    ['Gap Influenced', 'Society', 'Occult', 'Warp Presence'],
    ['Precog', 'Piloting', 'Occult', 'Warp Time'],
  ] as const)('maps %s to its paradox rules', (subclass, skill, tradition, warpSpell) => {
    const c = { ...base, subclass }
    const paradox = witchwarperParadox(c)
    expect(paradox).toMatchObject({ skill, tradition, initialWarpSpell: warpSpell })
    expect(paradox?.spells).toHaveLength(10)
    expect(witchwarperSetup(c)?.quantumField.effect).toBe(paradox?.quantumField)
  })

  it('uses the selected class key attribute and the Witchwarper proficiency milestones', () => {
    expect(witchwarperSpellcasting(base)).toEqual({ traditions: ['Arcane'], ability: 'int', rank: 1 })
    expect(witchwarperSpellcasting({ ...base, boosts: { class: 'cha' }, level: 7 }))
      .toEqual({ traditions: ['Arcane'], ability: 'cha', rank: 2 })
    expect(witchwarperSpellcasting({ ...base, level: 15 })?.rank).toBe(3)
    expect(witchwarperSpellcasting({ ...base, level: 19 })?.rank).toBe(4)
    expect(witchwarperSpellcasting({ ...base, boosts: { class: 'wis' } })?.ability).toBeUndefined()
  })

  it.each([
    [1, { 0: 5, 1: 3 }],
    [2, { 0: 5, 1: 4 }],
    [3, { 0: 5, 1: 4, 2: 3 }],
    [18, { 0: 5, 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4 }],
    [19, { 0: 5, 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 1 }],
  ])('derives the level %i slot progression', (level, slots) => {
    expect(witchwarperSpellSlots({ ...base, level })).toEqual(slots)
  })

  it('includes the Intelligence-modified trained-skill budget and field growth', () => {
    const klass = mapAonHit({ _id: 'witchwarper', _source: { name: 'Witchwarper', category: 'class',
      skill_proficiency: ['Trained in one skill determined by your paradox', 'Trained in a number of additional skills equal to 3 plus your Intelligence modifier'] } }, 'sf2e')!
    expect(additionalSkillCount(base, [klass])).toBe(6)
    expect(witchwarperSetup(base)?.quantumField).toMatchObject({ shape: 'burst', radiusFeet: 20 })
    expect(witchwarperSetup({ ...base, level: 19 })?.quantumField.radiusFeet).toBe(100)
  })

  it('does not apply paradox benefits for an invalid or stale class/paradox selection', () => {
    for (const c of [
      { ...base, subclass: 'Druid of the Storm' },
      { ...base, className: 'Mystic' },
      { ...base, systems: ['pf2e'] as Character['systems'] },
      { ...base, level: 0 },
    ]) {
      expect(witchwarperParadox(c)).toBeUndefined()
      expect(witchwarperSetup(c)).toBeUndefined()
    }
    expect(witchwarperSpellSlots({ ...base, className: 'Mystic' })).toBeUndefined()
  })

  it('integrates paradox spellcasting and focus spells without requiring manual spellcasting configuration', () => {
    expect(classSpellcasting(base, [])).toEqual({ traditions: ['Arcane'], ability: 'int', rank: 1 })
    expect(classSpellSlots(base)).toEqual({ 0: 5, 1: 3 })
    expect(focusSpells(base, [])).toEqual({ spells: [{ name: 'Warp Probability', source: 'Analyst paradox' }], points: 1 })
    expect(focusSpells({ ...base, subclass: 'Precog' }, []).spells[0].name).toBe('Warp Time')
    expect(witchwarperRepertoireSlots(base).filter(slot => slot.granted).map(slot => slot.granted))
      .toEqual(['Analyze Target', 'Sure Strike'])
    expect(witchwarperRepertoireSlots({ ...base, level: 19 }).filter(slot => slot.rank === 10)).toHaveLength(2)
    const feat = { name: 'Quantum Research', level: 20, type: 'Class Feat' }
    expect(classSpellSlots({ ...base, level: 20, feats: [feat, feat] })?.[10]).toBe(2)
    expect(classSpellSlots({ ...base, level: 19, feats: [feat] })?.[10]).toBe(1)
  })

  it('adds a familiar cantrip to the repertoire without adding a ranked spell choice', () => {
    const c = { ...base, spellcasting: { ability: 'int' as const, tradition: 'Arcane', rank: 1, slots: {},
      repertoire: { 'familiar-cantrip-connection': 'Spare Cantrip' } } }
    const slots = witchwarperRepertoireSlots(c, true)
    expect(slots.filter(slot => slot.rank === 0)).toHaveLength(6)
    expect(slots.filter(slot => slot.rank === 1)).toHaveLength(3)
    expect(slots.at(-1)).toMatchObject({ key: 'familiar-cantrip-connection', value: 'Spare Cantrip' })
  })

  it('limits repertoire options to valid tradition, rank and access without including focus spells', () => {
    const entries = [
      magic('Arcane Bolt'), magic('Rare Bolt', 1, 'Arcane', ['Rare']),
      { ...magic('Restricted Bolt'), data: { tradition: 'Arcane', access: 'Kellid ethnicity' } },
      magic('Wrong Tradition', 1, 'Occult'), magic('Higher Rank', 2),
      magic('Warp Probability', 1, 'Arcane', ['Focus']), magic('Analyze Target', 1, 'Arcane', ['Cantrip']),
      { ...magic('Deleted'), deleted: true },
    ]
    expect(witchwarperSpellOptions(base, entries, 1).map(entry => entry.name)).toEqual(['Arcane Bolt', 'Rare Bolt'])
    expect(witchwarperSpellOptions(base, entries, 0).map(entry => entry.name)).toEqual(['Analyze Target'])
    expect(witchwarperSpellOptions({ ...base, spells: [{ name: 'Rare Bolt', cantrip: false, rank: 1 }] }, entries, 1)
      .map(entry => entry.name)).toEqual(['Arcane Bolt', 'Rare Bolt'])
    for (const c of [
      { ...base, ethnicity: 'Kellid' },
      { ...base, featAccessOverrides: ['Restricted Bolt'] },
      { ...base, spells: [{ name: 'Restricted Bolt', cantrip: false, rank: 1 }] },
    ]) {
      expect(witchwarperSpellOptions(c, entries, 1).map(entry => entry.name)).toEqual(['Arcane Bolt', 'Rare Bolt', 'Restricted Bolt'])
    }
    const compatible: ContentEntry = { ...magic('Compatible Magic'), systems: ['pf2e'] }
    expect(witchwarperSpellOptions(base, [compatible], 1)).toEqual([])
    expect(witchwarperSpellOptions({ ...base, systems: ['sf2e', 'pf2e'] }, [compatible], 1)).toEqual([compatible])
  })

  it('renders spontaneous repertoire, shared slot usage and signature heightening rather than prepared slots', () => {
    const entries = [magic('Analyze Target', 1, 'Arcane', ['Cantrip']), magic('Sure Strike'), magic('Arcane Bolt'),
      magic('Warp Probability', 1, 'Arcane', ['Focus']), magic('Sift the Sphere', 2)]
    const c: Character = { ...base, level: 3, spellcasting: {
      ability: 'int', tradition: 'Arcane', rank: 1, slots: {},
      repertoire: { '1:1': 'Arcane Bolt' }, signatureSpells: { 1: '1:1' }, spentSlots: ['1:0'],
    } }
    const before = JSON.stringify(c)
    const html = renderToStaticMarkup(createElement(SpellsSection, { c, entries,
      save: () => { throw Error('Rendering must not rewrite persisted choices') } }))
    expect(html).toContain('Spell Repertoire')
    expect(html).toContain('Spell Rank 1 (3/4 slots)')
    expect(html).toContain('aria-label="Cast rank for Arcane Bolt"')
    expect(html.indexOf('>Arcane Bolt</button>')).toBeLessThan(html.indexOf('>Sure Strike</button>'))
    expect(html).toContain('aria-label="Signature spell rank 1 choice 2"')
    expect(html).toContain('value="2">Rank 2')
    expect(html).toContain('Warp Probability')
    const rankOneChoices = /<select aria-label="Witchwarper rank 1 spell 3"[^>]*>([\s\S]*?)<\/select>/.exec(html)?.[1] ?? ''
    expect(rankOneChoices).toContain('Not Selected')
    expect(rankOneChoices).not.toContain('value="Sure Strike"')
    expect(rankOneChoices).not.toContain('value="Arcane Bolt"')
    expect(html).not.toContain('Spell Rank 1 slot 1')
    expect(html).not.toContain('Spell slots:')
    expect(JSON.stringify(c)).toBe(before)
  })

  it('applies Precog movement only while selected and grants Core Memories from permanent trained skills', () => {
    const moving: Character = { ...base, subclass: 'Precog', witchwarper: { movingInQuantumField: true } }
    expect(speed(moving, [])).toBe(30)
    expect(speed({ ...moving, subclass: 'Analyst' }, [])).toBe(25)
    expect(speed({ ...moving, witchwarper: {} }, [])).toBe(25)
    const memory: Character = { ...base, witchwarper: { anchor: 'Core Memories', coreMemorySkill: 'Computers' } }
    expect(automaticFeatGrants(memory, []))
      .toContainEqual({ name: 'Assurance', choice: 'Computers', source: 'Core Memories', level: 1 })
    expect(automaticFeatGrants({ ...memory, witchwarper: { ...memory.witchwarper, coreMemorySkill: 'Athletics' } }, []))
      .not.toContainEqual(expect.objectContaining({ source: 'Core Memories' }))
  })
})

function magic(name: string, level = 1, tradition = 'Arcane', traits: string[] = []): ContentEntry {
  return { id: name, name, kind: 'spell', systems: ['sf2e'], source: 'official', level, traits,
    data: { tradition }, description: '', effects: [], updatedAt: 0 }
}
