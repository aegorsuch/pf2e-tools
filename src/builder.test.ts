import { describe, expect, it } from 'vitest'
import { classFeatures, classSkills, computeAbilities, eligibleFeats, plannedSlots, ranksAt } from './builder'
import type { Character, ContentEntry } from './types'

const entry = (kind: ContentEntry['kind'], name: string, data: ContentEntry['data'] = {}, level = 1, traits: string[] = []): ContentEntry => ({
  id: `${kind}:${name}`, systems: ['pf2e'], kind, source: 'official', name, level, traits, description: '', data, effects: [], updatedAt: 1,
})

const entries = [
  entry('ancestry', 'Elf', { attribute: 'Dexterity, Intelligence, Free', attribute_flaw: 'Constitution', hp: 6 }),
  entry('background', 'Scholar', { attribute: 'Intelligence, Wisdom', skill: 'Arcana, Academia Lore' }),
  entry('class', 'Wizard', {
    attribute: 'Intelligence', perception_proficiency: 'Trained', will_proficiency: 'Expert',
    skill_proficiency: 'Trained in Arcana, Trained in a number of additional skills equal to 2 plus your Intelligence modifier',
  }),
  entry('classFeature', 'Arcane School', { class: 'Wizard' }),
  entry('classFeature', 'Will Expertise', { class: 'Wizard' }, 9),
  entry('classFeature', 'Wizard Feats', { class: 'Wizard' }),
  entry('classFeature', 'Rage', { class: 'Barbarian' }),
  entry('feat', 'Toughness', {}, 1, ['General']),
  entry('feat', 'Fleet', {}, 1, ['General']),
  entry('feat', 'Counterspell', {}, 1, ['Wizard']),
  entry('feat', 'High Spell', {}, 8, ['Wizard']),
]

const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'T', level: 1, ancestry: 'Elf', className: 'Wizard', background: 'Scholar',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

describe('computeAbilities', () => {
  it('applies flaw, fixed and chosen boosts, slowing past 18', () => {
    const c = { ...base, boosts: { 'ancestry:2': 'dex', 'background:0': 'int', 'background:1': 'wis', 'free1:0': 'int', 'free1:1': 'int' } as Character['boosts'] }
    const a = computeAbilities(c, entries)
    expect(a.con).toBe(8)
    expect(a.dex).toBe(14)
    expect(a.wis).toBe(12)
    // ancestry +2, class +2, background +2, free +2 = 18; the last free boost adds only 1
    expect(a.int).toBe(19)
  })
})

describe('plannedSlots', () => {
  it('follows the standard progression up to the character level', () => {
    const keys = (level: number) => plannedSlots({ ...base, level }).map((s) => `${s.category}${s.level}`)
    expect(keys(1)).toEqual(['ancestry1', 'class1'])
    expect(keys(3)).toEqual(['ancestry1', 'class1', 'class2', 'skill2', 'general3'])
  })
  it('includes extra slots', () => {
    const slots = plannedSlots({ ...base, extraSlots: [{ category: 'class', level: 1, count: 1 }] })
    expect(slots.filter((s) => s.category === 'class').map((s) => s.key)).toEqual(['class:1:0', 'class:1:1'])
  })
})

describe('eligibleFeats', () => {
  it('filters by trait and level, hiding feats used in other slots', () => {
    const slot = { key: 'class:1:0', category: 'class' as const, level: 1 }
    expect(eligibleFeats(entries, base, slot).map((f) => f.name)).toEqual(['Counterspell'])
    const general = { key: 'general:3:0', category: 'general' as const, level: 3 }
    const used = { ...base, feats: [{ name: 'Fleet', type: 'x', level: 1, slot: 'general:7:0' }] }
    expect(eligibleFeats(entries, used, general).map((f) => f.name)).toEqual(['Toughness'])
  })
})

describe('skills', () => {
  it('parses class skills', () => {
    expect(classSkills(entries[2])).toEqual({ fixed: ['Arcana'], additional: 2 })
  })
  it('ignores choice lines', () => {
    const k = entry('class', 'Fighter', { skill_proficiency: 'Trained in your choice of Acrobatics or Athletics, Trained in a number of additional skills equal to 3 plus your Intelligence modifier' })
    expect(classSkills(k)).toEqual({ fixed: [], additional: 3 })
  })
  it('combines sources, increases and overrides', () => {
    const c = { ...base, level: 3, skillPicks: ['Society'], skillIncreases: { 3: 'Society' }, rankOverrides: { Reflex: 2 } }
    const r = ranksAt(c, entries)
    expect(r).toMatchObject({ Arcana: 1, Society: 2, 'Academia Lore': 1, Perception: 1, Will: 2, Reflex: 2 })
  })
})

describe('classFeatures', () => {
  it('lists own-class features up to level, skipping planner-covered ones', () => {
    expect(classFeatures(entries, base).map((f) => f.name)).toEqual(['Arcane School'])
    expect(classFeatures(entries, { ...base, level: 9 }).map((f) => f.name)).toEqual(['Arcane School', 'Will Expertise'])
  })
  it('raises save ranks from expertise features', () => {
    expect(ranksAt(base, entries).Will).toBe(2)
    expect(ranksAt({ ...base, level: 9 }, entries).Will).toBe(2)
    const e = entries.map((x) => (x.name === 'Will Expertise' ? { ...x, name: 'Reflex Expertise' } : x))
    expect(ranksAt({ ...base, level: 9 }, e).Reflex).toBe(2)
  })
})
