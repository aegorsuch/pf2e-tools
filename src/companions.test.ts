import { describe, expect, it } from 'vitest'
import { parseCompanion } from './aonQuery'
import { eligibleFeats } from './builder'
import { companionAdvancement, companionStats, faithfulSteedChange, specializationOptions } from './companions'
import { homebrewCompanions } from './supplemental'
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
  it('applies Chiardmar Steed only to the first horse, stacking specialization Speed and respecting acquisition level', () => {
    const horse = entry('companion', 'Horse', { ...bear.data, speed_raw: '40 feet, swim 20 feet', mount: true })
    const companions = [{ id: 'first', type: 'Horse', name: '' }, { id: 'second', type: 'Horse', name: '' }]
    const c: Character = { ...base, level: 8, companions,
      feats: [{ name: 'Chiardmar Steed', type: 'Dedication Feat', level: 6, slot: 'archetype:8:0' }] }
    const stats = companionStats(c, [horse], 'Horse')!
    expect(stats.speed).toBe('45 feet, swim 20 feet')
    expect(stats.speedBonuses).toContainEqual({ source: 'Chiardmar Steed', feet: 5 })
    expect(stats.ignoreDifficultTerrain).toBe(10)
    expect(companionStats(c, [horse], 'Horse', { mature: true, advanced: 'Nimble', specializations: ['Racer'] })!.speed).toBe('55 feet, swim 20 feet')
    expect(companionStats(c, [horse], 'Horse', undefined, 'second')!.speed).toBe('40 feet, swim 20 feet')
    expect(companionStats({ ...c, level: 7 }, [horse], 'Horse')!.ignoreDifficultTerrain).toBe(0)
    expect(companionStats({ ...c, feats: [] }, [horse], 'Horse')!.speed).toBe('40 feet, swim 20 feet')
    expect(companionStats(c, [bear], 'Bear')!.speed).toBe('35 feet')
  })

  it('passes Faithful Steed sanctification to the first companion and its Strikes without mutating content', () => {
    const companions = [{ id: 'first', type: bear.name, name: '' }, { id: 'second', type: bear.name, name: '' }]
    const deity = entry('deity', 'Patron', { sanctification: 'holy, unholy' })
    const c: Character = { ...base, level: 3, className: 'Champion', deity: deity.name, companions,
      feats: [{ name: 'Faithful Steed', type: 'Class Feat', level: 1, slot: 'class:2:0' }] }
    for (const sanctification of ['Holy', 'Unholy'] as const) {
      const character = { ...c, sanctification }
      const stats = companionStats(character, [bear, deity], bear.name)!
      expect(stats.grantedTraits).toContain(sanctification)
      expect(stats.attacks.every((attack) => attack.traits.includes(sanctification))).toBe(true)
      expect(companionStats(character, [bear, deity], bear.name, undefined, 'second')!.grantedTraits).toEqual([])
      expect(companionStats({ ...character, feats: [] }, [bear, deity], bear.name)!.grantedTraits).toEqual([])
      expect(companionStats({ ...character, level: 1 }, [bear, deity], bear.name)!.grantedTraits).toEqual([])
    }
    expect(companionStats(c, [bear, deity], bear.name)!.grantedTraits).toEqual([])
    expect(bear.data.companion_attacks).toBe('jaws|1d8 piercing|;claw|1d6 slashing|agile')
  })

  it('grants Faithful Steed once, repairs saved Champions, and preserves chosen or removed companions', () => {
    const horse = entry('companion', 'Horse', { ...bear.data, mount: true })
    const champion: Character = { ...base, className: 'Champion', feats: [feat('Faithful Steed')] }
    const change = faithfulSteedChange(champion, [horse])!
    expect(change).toEqual({ faithfulSteedGranted: true, companions: [{ id: 'c:faithful-steed', type: 'Horse', name: '' }] })
    expect(faithfulSteedChange({ ...champion, companions: [] }, [horse])).toEqual(change)
    const saved: Character = JSON.parse(JSON.stringify({ ...champion, ...change }))
    expect(faithfulSteedChange(saved, [horse])).toBeUndefined()
    expect(faithfulSteedChange({ ...saved, companions: [] }, [horse])).toBeUndefined()
    const existing = [{ id: 'custom', type: 'Sarkorian Direwolf', name: 'Existing' }]
    expect(faithfulSteedChange({ ...champion, companions: existing }, [horse])).toEqual({ faithfulSteedGranted: true })
    expect(existing).toEqual([{ id: 'custom', type: 'Sarkorian Direwolf', name: 'Existing' }])
    expect(faithfulSteedChange({ ...champion, feats: [] }, [horse])).toBeUndefined()
    expect(faithfulSteedChange({ ...champion, level: 1 }, [horse])).toBeUndefined()
    expect(faithfulSteedChange(champion, [])).toBeUndefined()
    expect(faithfulSteedChange(champion, [{ ...horse, deleted: true }])).toBeUndefined()
  })

  it('advances Champion steeds through Loyal Warhorse and Imposing Destrier', () => {
    const champion = { ...base, className: 'Champion', feats: [feat('Faithful Steed')] }
    const young = companionStats(champion, [bear], bear.name, companionAdvancement(champion))!
    const mature = { ...champion, feats: [...champion.feats, feat('Loyal Warhorse')] }
    expect(companionAdvancement(mature)).toMatchObject({ mature: true })
    const grown = companionStats(mature, [bear], bear.name, companionAdvancement(mature))!
    expect(grown.size).toBe('Medium')
    expect(grown.attacks[0].damage).toBe('2d8+4 piercing')
    expect(young.attacks[0].damage).toBe('1d8+3 piercing')
    for (const advanced of ['Nimble', 'Savage']) {
      const improved = { ...mature, feats: [...mature.feats, feat('Imposing Destrier', advanced)] }
      expect(companionAdvancement(improved)).toMatchObject({ mature: true, advanced })
      expect(companionStats(improved, [bear], bear.name, companionAdvancement(improved))!.ac).toBeGreaterThan(grown.ac)
    }
  })

  it('seeds fixed-size mount variants without changing base stats or normal companion growth', () => {
    const originals = [
      entry('companion', 'Isgeri Boarhound', { ...bear.data, strength: 2, dexterity: 3, mount: false }),
      entry('companion', 'Cat', { ...bear.data, strength: 2, dexterity: 3, constitution: 1, mount: false }),
    ]
    const variants = homebrewCompanions(originals)
    expect(variants.map((variant) => variant.name)).toEqual(['Sarkorian Direwolf', 'Snow Leopard'])
    for (const [index, variant] of variants.entries()) {
      const size = index === 0 ? 'Large' : 'Medium'
      expect(variant).toMatchObject({
        source: 'homebrew', traits: ['Mount'],
        data: { ...originals[index].data, size, mount: true, fixed_size: true },
      })

      for (const feats of [[], [feat('Impressive Mount')], [feat('Incredible Mount', 'Nimble')], [feat('Incredible Mount', 'Savage'), feat('Specialized Mount', 'Racer')]]) {
        const c = { ...base, feats }
        const advancement = companionAdvancement(c)
        const original = companionStats(c, originals, originals[index].name, advancement)!
        expect(companionStats(c, variants, variant.name, advancement)).toEqual({
          ...original, entry: variant, size, naturalSize: size, mount: true,
        })
        expect(original.size).toBe(advancement.mature ? 'Medium' : 'Small')
      }
    }
    expect(originals.every((original) => original.data.size === 'Small' && original.data.mount === false)).toBe(true)
    expect(homebrewCompanions([{ ...originals[0], deleted: true }, { ...originals[1], kind: 'item' }])).toEqual([])
  })

  it.each([[16, 20], [18, 25], [20, 30]])('applies Auspice benefits at level %i without granting them to other companions', (level, extraHP) => {
    const c: Character = { ...base, level, className: 'Champion',
      companions: [{ id: 'mount', type: 'Bear', name: '' }, { id: 'other', type: 'Bear', name: '' }],
      feats: [feat('Loyal Warhorse'), feat('Imposing Destrier', 'Nimble'),
        { ...feat('Auspicious Mount', 'Auspice'), level: 16 }] }
    const without = { ...c, feats: c.feats.slice(0, -1) }
    const normal = companionStats(without, [bear], 'Bear', companionAdvancement(without), 'mount')!
    const stats = companionStats(c, [bear], 'Bear', companionAdvancement(c), 'mount')!
    expect(stats.mods.int).toBe(normal.mods.int + 2)
    expect(stats.mods.wis).toBe(normal.mods.wis + 1)
    expect(stats.skills).toContainEqual({ name: 'Religion', rank: 2, bonus: stats.mods.wis + level + 4, clumsy: false })
    expect(stats.hp).toBe(normal.hp + extraHP)
    expect(stats.speed).toBe('35 feet, fly 35 feet')
    for (const [auspiceServitor, traits, weakness] of [
      ['Celestial', ['Celestial', 'Holy'], 'Unholy 5'],
      ['Fiend', ['Fiend', 'Unholy'], 'Holy 5'],
      ['Monitor', ['Monitor'], undefined],
    ] as const) {
      const saved: Character = JSON.parse(JSON.stringify({ ...c, companions: [{ ...c.companions![0], auspiceServitor }] }))
      const changed = companionStats(saved, [bear], 'Bear', companionAdvancement(saved), 'mount')!
      expect(changed).toMatchObject({ auspiceTraits: [...traits], weakness, hp: normal.hp + extraHP + (weakness ? 5 : 0) })
    }
    expect(companionStats(c, [bear], 'Bear', undefined, 'other')!.auspice).toBe(false)
    expect(companionAdvancement({ ...c, level: 15 }).specializations).not.toContain('Auspice')
    expect(companionAdvancement(without).specializations).not.toContain('Auspice')
  })

  it('offers Auspice only for Auspicious Mount and keeps that feat non-repeatable', () => {
    const c = { ...base, level: 16, feats: [
      { ...feat('Auspicious Mount'), level: 16 }, feat('Specialized Mount'),
    ] }
    expect(specializationOptions(c, [], 0)).toContain('Auspice')
    expect(specializationOptions(c, [], 0)).toContain('Ambusher')
    expect(specializationOptions(c, [], 1)).not.toContain('Auspice')
    expect(specializationOptions({ ...c, level: 15 }, [], 0)).not.toContain('Auspice')
    expect(companionAdvancement({ ...c, feats: [feat('Specialized Mount', 'Auspice')] }).specializations).not.toContain('Auspice')
    const content = entry('feat', 'Auspicious Mount', {}, 16, ['Champion'])
    const taken = { ...c, className: 'Champion', feats: [{ ...c.feats[0], slot: 'class:16:0' }] }
    expect(eligibleFeats([content], taken, { key: 'bonus:16:1', category: 'bonus', level: 16 })).not.toContain(content)
    expect(eligibleFeats([content], { ...taken, feats: [] }, { key: 'class:16:0', category: 'class', level: 16 })).toContain(content)
  })

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
