import { describe, expect, it } from 'vitest'
import { parseCompanion } from './aonQuery'
import { eligibleFeats } from './builder'
import { companionAdvancement, companionStats, specializationOptions } from './companions'
import type { Character, ContentEntry } from './types'

const entry = (kind: ContentEntry['kind'], name: string, data: ContentEntry['data'] = {}, level = 1, traits: string[] = []): ContentEntry => ({
  id: `${kind}:${name}`, systems: ['pf2e'], kind, source: 'official', name, level, traits, description: '', data, effects: [], updatedAt: 1,
})
const bear = entry('companion', 'Bear', {
  hp: 8, size: 'Small', strength: 3, dexterity: 2, constitution: 2, intelligence: -4, wisdom: 1, charisma: 0, skill: 'Intimidation',
  speed_raw: '35 feet', companion_attacks: 'jaws|1d8 piercing|;claw|1d6 slashing|agile',
})
const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'T', level: 4, className: 'Druid',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const feat = (name: string, choice?: string, slot?: string) => ({ name, type: 'Class Feat', level: 4, choice, slot })

describe('animal companions', () => {
  it('parses attacks, support benefit and maneuver from AoN markdown', () => {
    const md = `**Melee**\n<actions string="Single Action" />\njaws,\n**Damage** 1d8 piercing\n\n**Melee**\n<actions string="Single Action" />\nclaw ([Agile](/Traits.aspx?ID=170)),\n**Damage** 1d6 slashing\n\n**Support Benefit** Your bear [mauls](/x) foes.\n\n**Advanced Maneuver** Bear Hug`
    expect(parseCompanion(md)).toEqual({ attacks: 'jaws|1d8 piercing|;claw|1d6 slashing|agile', support: 'Your bear mauls foes.', maneuver: 'Bear Hug' })
  })

  it('calculates a young companion from the master level', () => {
    const s = companionStats(base, [bear], 'Bear')!
    expect(s.hp).toBe(8 + (6 + 2) * 4)
    expect(s.ac).toBe(10 + 2 + 4 + 2)
    expect(s.attacks[0]).toMatchObject({ name: 'jaws', attack: 3 + 6, damage: '1d8+3 piercing' })
    expect(s.size).toBe('Small')
  })

  it('applies Mature, Nimble and up to three distinct specializations from feats', () => {
    const c = { ...base, feats: [feat('Mature Animal Companion (Druid)'), feat('Incredible Companion (Druid)', 'Nimble'),
      feat('Specialized Companion (Druid)', 'Ambusher'), feat('Specialized Companion (Druid)', 'Racer'), feat('Specialized Companion (Druid)', 'Wrecker'), feat('Specialized Companion (Druid)', 'Tracker')] }
    const adv = companionAdvancement(c)
    expect(adv).toEqual({ mature: true, advanced: 'Nimble', specializations: ['Ambusher', 'Racer', 'Wrecker'] })
    const s = companionStats(c, [bear], 'Bear', adv)!
    expect(s.size).toBe('Medium')
    expect(s.mods).toMatchObject({ str: 3 + 1 + 1 + 1, dex: 2 + 1 + 2 + 1 })
    expect(s.attacks[0].damage).toBe('2d8+8 piercing')
    expect(s.reflex).toBe(s.mods.dex + 4 + 4)
    expect(s.fortitude).toBe(s.mods.con + 4 + 8)
  })

  it('lets Specialized Companion be taken three times only', () => {
    const spec = entry('feat', 'Specialized Companion (Druid)', {}, 14, ['Druid'])
    const slot = { key: 'class:14:0', category: 'class' as const, level: 14 }
    const take = (n: number) => ({ ...base, level: 14, feats: Array.from({ length: n }, (_, i) => feat(spec.name, undefined, `class:12:${i}`)) })
    expect(eligibleFeats([spec], take(2), slot)).toHaveLength(1)
    expect(eligibleFeats([spec], take(3), slot)).toHaveLength(0)
  })

  it('lets Specialized Mount be taken three times only, including unassigned specialization choices', () => {
    const dedication = entry('feat', 'Cavalier Dedication', { archetype: 'Cavalier' }, 2, ['Archetype', 'Dedication'])
    const spec = entry('feat', 'Specialized Mount', { archetype: 'Cavalier', repeatable: true }, 14, ['Archetype'])
    const slot = { key: 'archetype:14:4', category: 'archetype' as const, level: 14 }
    const take = (n: number) => ({
      ...base, level: 14, feats: [feat(dedication.name, undefined, 'archetype:2:0'),
        ...Array.from({ length: n }, (_, i) => feat(spec.name, undefined, `archetype:14:${i}`))],
    })
    expect(eligibleFeats([dedication, spec], take(2), slot)).toContain(spec)
    expect(eligibleFeats([dedication, spec], take(3), slot)).not.toContain(spec)
  })

  it('applies mount advancement and specialization through the companion calculator', () => {
    const mount = { ...base, feats: [feat('Impressive Mount'), feat('Incredible Mount', 'Nimble'), feat('Specialized Mount', 'Ambusher')] }
    const companion = { ...base, feats: [feat('Mature Animal Companion'), feat('Incredible Companion', 'Nimble'), feat('Specialized Companion', 'Ambusher')] }
    expect(companionAdvancement({ ...base, feats: [feat('Impressive Mount')] }).mature).toBe(true)
    expect(companionAdvancement(mount)).toEqual({ mature: true, advanced: 'Nimble', specializations: ['Ambusher'] })
    expect(companionStats(mount, [bear], 'Bear', companionAdvancement(mount)))
      .toEqual(companionStats(companion, [bear], 'Bear', companionAdvancement(companion)))
  })

  it('shares distinct specialization options between mount and companion feats', () => {
    const c = { ...base, feats: [feat('Specialized Companion', 'Ambusher'), feat('Specialized Mount', 'Racer')] }
    expect(specializationOptions(c, [], 1)).not.toContain('Ambusher')
    expect(specializationOptions(c, [], 1)).toContain('Racer')
    expect(specializationOptions(c, [], 0)).not.toContain('Racer')
    expect(companionAdvancement(c).specializations).toEqual(['Ambusher', 'Racer'])
  })
})
