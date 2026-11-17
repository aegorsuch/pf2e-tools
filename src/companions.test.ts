import { describe, expect, it } from 'vitest'
import { parseCompanion } from './aonQuery'
import { eligibleFeats } from './builder'
import { companionAdvancement, companionStats, faithfulSteedChange, minionFerocity, specializationOptions } from './companions'
import { homebrewCompanions } from './supplemental'
import type { Character, ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'

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
  it('applies Apex Companion only to its chosen animal and restores normal statistics when unavailable', () => {
    const apex = entry('feat', 'Apex Companion', { grants_focus_spells: 'Apex Companion' }, 20)
    const spell = entry('spell', 'Apex Companion', {}, 10, ['Focus'])
    const animal = { ...bear, data: { ...bear.data, speed_raw: '35 feet, swim 20 feet',
      companion_attacks: 'jaws|1d8 piercing|deadly d8;claw|1d6 slashing|agile;tail|1d12 bludgeoning|' } }
    const entries = [animal, apex, spell]
    const c: Character = { ...base, level: 20, feats: [{ name: apex.name, type: 'Class Feat', level: 20 }],
      companions: [{ id: 'a', type: 'Bear', name: '' }, { id: 'b', type: 'Bear', name: '' }],
      activeSpells: ['Apex Companion', 'Enlarge Companion'], apexCompanionId: 'b', enlargeCompanionId: 'b' }
    const advancement = { mature: true, advanced: 'Nimble', specializations: [] }
    const before = JSON.stringify(c)
    const normal = companionStats({ ...c, activeSpells: [] }, entries, 'Bear', advancement, 'b')!
    const stats = companionStats(c, entries, 'Bear', advancement, 'b')!
    expect(stats).toMatchObject({ apex: true, size: 'Huge', reach: 15, temporaryHp: 30,
      ignoreAllDifficultTerrain: true, speed: '45 feet, swim 30 feet', senses: 'Darkvision', clumsy: 0 })
    expect(stats.hp).toBe(normal.hp)
    expect(stats.ac).toBe(normal.ac)
    expect(stats.attacks.map(attack => attack.damage)).toEqual(['2d10+7 piercing', '2d8+7 slashing', '2d12+7 bludgeoning'])
    expect(stats.attacks.map(attack => attack.attack)).toEqual(normal.attacks.map(attack => attack.attack))
    for (const attack of stats.attacks) expect(attack.traits.match(/deadly d12/gi)).toHaveLength(1)
    expect(stats.enlarge).toBeUndefined()
    expect(companionStats(c, entries, 'Bear', advancement, 'a')?.apex).toBe(false)
    expect(companionStats({ ...c, activeSpells: [] }, entries, 'Bear', advancement, 'b')).toEqual(normal)
    expect(companionStats({ ...c, feats: [], activeSpells: ['Apex Companion'] }, entries, 'Bear', advancement, 'b')).toEqual(normal)
    expect(companionStats({ ...c, level: 19 }, entries, 'Bear', advancement, 'b')?.apex).toBe(false)
    for (const trait of ['Construct', 'Eidolon'])
      expect(companionStats(c, [{ ...animal, traits: [trait] }, apex, spell], 'Bear', advancement, 'b')?.apex).toBe(false)
    expect(JSON.stringify(c)).toBe(before)
  })

  it('grants Ferocious Beasts to every animal companion, but not constructs or eidolons', () => {
    const c: Character = { ...base, level: 13,
      companions: [{ id: 'first', type: 'Bear', name: '' }, { id: 'second', type: 'Bear', name: '' }],
      feats: [{ name: 'Ferocious Beasts', type: 'Ancestry Feat', level: 13 }] }
    const before = JSON.stringify(c)
    expect(companionStats(c, [bear], 'Bear')?.ferocity).toEqual({ temporaryHp: 0 })
    expect(companionStats(c, [bear], 'Bear', undefined, 'second')?.ferocity).toEqual({ temporaryHp: 0 })
    for (const trait of ['Construct', 'Eidolon']) {
      expect(companionStats(c, [{ ...bear, traits: [trait] }], 'Bear')?.ferocity).toBeUndefined()
    }
    expect(companionStats({ ...c, level: 12 }, [bear], 'Bear')?.ferocity).toBeUndefined()
    expect(companionStats({ ...c, feats: [] }, [bear], 'Bear')?.ferocity).toBeUndefined()
    expect(JSON.stringify(c)).toBe(before)
  })

  it('inherits Undying Ferocity only with an active Ferocious Beasts grant', () => {
    const beasts = { name: 'Ferocious Beasts', type: 'Ancestry Feat', level: 13 }
    const undying = { name: 'Undying Ferocity', type: 'Ancestry Feat', level: 9 }
    const c: Character = { ...base, level: 15, feats: [beasts, undying] }
    expect(minionFerocity(c)).toEqual({ temporaryHp: 15 })
    expect(minionFerocity({ ...c, level: 20 })).toEqual({ temporaryHp: 20 })
    expect(minionFerocity({ ...c, feats: [undying] })).toBeUndefined()
    expect(minionFerocity({ ...c, feats: [beasts, { ...undying, takenLevel: 16 }] })).toEqual({ temporaryHp: 0 })
  })

  it.each([
    ['Small', 'Small', false],
    ['Small', 'Medium', true],
    ['Medium', 'Medium', false],
    ['Medium', 'Large', true],
    ['Large', 'Large', false],
    ['Large', 'Huge', true],
  ])('grants Rider full mount for a %s rider with a %s companion: %s', (riderSize, companionSize, mount) => {
    const ancestry = entry('ancestry', 'Sized Ancestry', { size: riderSize })
    const bird = entry('companion', 'Bird', { ...bear.data, size: companionSize, speed_raw: '10 feet, fly 60 feet' }, 1, ['Animal'])
    const c: Character = { ...base, level: 1, ancestry: ancestry.name,
      feats: [{ name: 'Rider', type: 'Class Feat', level: 1 }],
      companions: [{ id: 'bird', type: bird.name, name: '' }] }
    const before = JSON.stringify({ c, bird })
    const stats = companionStats(c, [ancestry, bird], bird.name)!
    expect(stats).toMatchObject({ mount, riderMount: mount, size: companionSize, speed: '10 feet, fly 60 feet' })
    expect(companionStats({ ...c, feats: [] }, [ancestry, bird], bird.name)?.mount).toBe(false)
    expect(companionStats({ ...c, feats: [{ ...c.feats[0], takenLevel: 2 }] }, [ancestry, bird], bird.name)?.mount).toBe(false)
    expect(companionStats(c, [ancestry, { ...bird, traits: ['Construct'] }], bird.name)?.mount).toBe(false)
    expect(JSON.stringify({ c, bird })).toBe(before)
  })

  it('updates Rider mount eligibility with companion growth and preserves native mount abilities', () => {
    const c: Character = { ...base, feats: [{ name: 'Rider', type: 'Class Feat', level: 1 }] }
    const medium = { ...bear, data: { ...bear.data, size: 'Medium' } }
    expect(companionStats(c, [medium], medium.name)?.mount).toBe(false)
    expect(companionStats(c, [medium], medium.name, { mature: true, advanced: undefined, specializations: [] })?.mount).toBe(true)
    const horse = entry('companion', 'Horse', { ...bear.data, mount: true })
    expect(companionStats({ ...c, feats: [] }, [horse], horse.name)).toMatchObject({ mount: true, riderMount: false })
  })

  it('applies Pale Horse only while mounted on the faithful steed and scales retaliation', () => {
    const companions: NonNullable<Character['companions']> = [
      { id: 'first', type: 'Bear', name: '', paleHorse: 'Fire' },
      { id: 'second', type: 'Bear', name: '', paleHorse: 'Void' },
    ]
    const c: Character = { ...base, className: 'Champion', level: 20, companions, feats: [
      { ...feat('Faithful Steed'), slot: 'class:2:0' }, { ...feat('Pale Horse'), slot: 'class:12:0' },
    ] }
    expect(companionStats(c, [bear], 'Bear')?.paleHorse).toEqual({ damage: 'Fire', resistance: 10, retaliation: '3d6' })
    expect(companionStats({ ...c, level: 16 }, [bear], 'Bear')?.paleHorse?.retaliation).toBe('2d6')
    expect(companionStats({ ...c, level: 12 }, [bear], 'Bear')?.paleHorse?.retaliation).toBe('1d6')
    expect(companionStats({ ...c, level: 11 }, [bear], 'Bear')?.paleHorse).toBeUndefined()
    expect(companionStats(c, [bear], 'Bear', undefined, 'second')?.paleHorse).toBeUndefined()
    expect(companionStats({ ...c, companions: [{ ...companions[0], paleHorse: undefined }] }, [bear], 'Bear')?.paleHorse).toBeUndefined()
  })

  it.each([['Celestial Mount', 'Celestial', 'Unholy 10'], ['Fiendish Mount', 'Fiend', 'Holy 10']])(
    'applies %s benefits to the first companion', (name, trait, weakness) => {
      const companions = [{ id: 'first', type: 'Bear', name: '' }, { id: 'second', type: 'Bear', name: '' }]
      const c: Character = { ...base, className: 'Champion', level: 20, companions,
        feats: [{ ...feat(name), slot: 'class:20:0' }] }
      const result = companionStats(c, [bear], 'Bear')!
      expect(result.hp).toBe(companionStats({ ...c, feats: [] }, [bear], 'Bear')!.hp + 40)
      expect(result.senses).toContain('Darkvision')
      expect(result.speed).toContain('fly 35 feet')
      expect(result.grantedTraits).toContain(trait)
      expect(result.weakness).toBe(weakness)
      expect(companionStats(c, [bear], 'Bear', undefined, 'second')!.weakness).toBeUndefined()
      expect(companionStats({ ...c, level: 19 }, [bear], 'Bear')!.weakness).toBeUndefined()
    },
  )

  it('applies Stealthy Companion and Primal Howl only to the eligible companion', () => {
    const companions = [{ id: 'first', type: 'Bear', name: '' }, { id: 'second', type: 'Bear', name: '' }]
    const c: Character = { ...base, level: 15, companions, feats: [feat('Stealthy Companion'), feat('Primal Howl')] }
    const advance = { mature: true, advanced: 'Nimble', specializations: ['Ambusher'] }
    const stealthyBear = { ...bear, data: { ...bear.data, skill: 'Stealth' } }
    const stats = companionStats(c, [stealthyBear], bear.name, advance)!
    expect(stats.skills.find(skill => skill.name === 'Stealth')?.rank).toBe(4)
    expect(stats.stealthyCompanion).toBe(true)
    expect(stats.primalHowl).toBe('7d6')
    const other = companionStats(c, [bear], bear.name, undefined, 'second')!
    expect(other.stealthyCompanion).toBe(false)
    expect(other.primalHowl).toBeUndefined()
    const without = companionStats({ ...c, feats: [] }, [stealthyBear], bear.name, advance)!
    expect(without.skills.find(skill => skill.name === 'Stealth')?.rank).toBe(3)
    expect(companionStats(c, [bear], bear.name, advance)!.skills.find(skill => skill.name === 'Stealth')?.rank).toBe(3)
  })

  it('does not apply future companion advancement feats', () => {
    const c: Character = { ...base, level: 4, feats: [{ ...feat('Incredible Companion', 'Nimble'), slot: 'class:8:0' }] }
    expect(companionAdvancement(c)).toMatchObject({ mature: false, advanced: undefined })
  })
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

  it.each([
    ['Alacritous Horseshoes', 5, 2],
    ['Alacritous Horseshoes (Greater)', 10, 3],
  ])('applies %s to its equipped companion', (name, speed, athletics) => {
    const horse = entry('companion', 'Horse', { ...bear.data, speed_raw: '40 feet' })
    const shoes = entry('item', name, { item_subcategory: 'Companion Items' }, name.includes('Greater') ? 14 : 7, ['Companion'])
    const c: Character = { ...base, companions: [{
      id: 'horse', type: 'Horse', name: 'Buddy',
      equipment: { Shoes: { entryId: shoes.id, name: shoes.name, qty: 1 } },
    }] }
    const stats = companionStats(c, [horse, shoes], 'Horse')!
    expect(stats.speed).toBe(`${40 + speed} feet`)
    expect(stats.speedBonuses).toContainEqual({ source: name, feet: speed })
    const athleticsSkill = stats.skills.find(skill => skill.name === 'Athletics')
    expect(athleticsSkill?.bonus).toBe(9)
    expect(athleticsSkill?.note).toContain(`+${athletics} circumstance bonus to Athletics checks`)
    expect(athleticsSkill?.note).toContain('when Leaping, move 5 feet farther horizontally or 3 feet higher vertically')
    expect(athleticsSkill?.noteSource).toBe(name)
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
    const later = { ...champion, level: 4, feats: [{ ...feat('Faithful Steed'), slot: 'class:6:0' }] }
    expect(faithfulSteedChange(later, [horse])).toBeUndefined()
    expect(faithfulSteedChange({ ...later, level: 6 }, [horse])).toEqual(change)
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

  it('seeds smaller companions without Mount and preserves normal growth', () => {
    const originals = [
      entry('companion', 'Isgeri Boarhound', { ...bear.data, strength: 2, dexterity: 3, mount: false }),
      entry('companion', 'Cat', { ...bear.data, strength: 2, dexterity: 3, constitution: 1, mount: false }),
    ]
    const variants = homebrewCompanions(originals)
    expect(variants[0].description).toContain('direwolf raised among Sarkoris')
    expect(variants[1].description).toContain('pale-furred mountain cat')
    expect(variants.every(variant => !/copy|using .*statistics|Isgeri|big cat, such as/i.test(variant.description))).toBe(true)
    expect(variants.map((variant) => variant.name)).toEqual(['Sarkorian Direwolf', 'Snow Leopard'])
    for (const [index, variant] of variants.entries()) {
      const size = index === 0 ? 'Medium' : 'Small'
      expect(variant).toMatchObject({
        source: 'homebrew', traits: [],
        data: { ...originals[index].data, size, mount: false, fixed_size: false },
      })

      for (const feats of [[], [feat('Impressive Mount')], [feat('Incredible Mount', 'Nimble')], [feat('Incredible Mount', 'Savage'), feat('Specialized Mount', 'Racer')]]) {
        const c = { ...base, feats }
        const advancement = companionAdvancement(c)
        const original = companionStats(c, originals, originals[index].name, advancement)!
        const grownSize = advancement.mature ? index === 0 ? 'Large' : 'Medium' : size
        expect(companionStats(c, variants, variant.name, advancement)).toEqual({
          ...original, entry: variant, size: grownSize, naturalSize: grownSize, mount: false,
        })
        expect(original.size).toBe(advancement.mature ? 'Medium' : 'Small')
      }
    }
    expect(originals.every((original) => original.data.size === 'Small' && original.data.mount === false)).toBe(true)
    expect(homebrewCompanions([{ ...originals[0], deleted: true }, { ...originals[1], kind: 'item' }])).toEqual([])
    const rider = { ...base, feats: [feat('Impressive Mount'), feat('Rider')] }
    expect(companionStats(rider, variants, 'Sarkorian Direwolf', companionAdvancement(rider))?.mount).toBe(true)
    expect(companionStats(rider, variants, 'Snow Leopard', companionAdvancement(rider))?.mount).toBe(false)
  })

  it('carries Lock Jaw rules into the direwolf and renames all Boarhound text', () => {
    const original = { ...entry('companion', 'Isgeri Boarhound', {
      ...bear.data, companion_maneuver: 'Lock Jaw', companion_maneuver_actions: 'Single Action',
      companion_support: "Your boarhound supports you. Isgeri boarhounds are hunters.",
      companion_maneuver_requirements: "The boarhound's last action was a successful jaws Strike.",
      companion_maneuver_description: 'The target becomes grabbed, as if the boarhound successfully Grappled the target.',
    }), description: 'Isgeri Boarhounds hunt. A boarhound is loyal.' }
    const [direwolf] = homebrewCompanions([original])
    expect(direwolf.data.companion_maneuver).toBe('Lock Jaw')
    expect(direwolf.data.companion_maneuver_actions).toBe('Single Action')
    expect(direwolf.data.companion_maneuver_requirements).toContain("direwolf's last action")
    expect(direwolf.data.companion_maneuver_description).toContain('direwolf successfully Grappled')
    expect(JSON.stringify(direwolf)).not.toMatch(/boarhound/i)
    expect(original.description).toContain('Boarhounds')
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
    expect(stats.speed).toBe('35 feet')
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
    expect(specializationOptions({ ...c, level: 16, feats: [{ ...c.feats[0], slot: 'class:18:0' }] }, [], 0)).not.toContain('Auspice')
    expect(companionAdvancement({ ...c, feats: [feat('Specialized Mount', 'Auspice')] }).specializations).not.toContain('Auspice')
    const content = entry('feat', 'Auspicious Mount', {}, 16, ['Champion'])
    const taken = { ...c, className: 'Champion', feats: [{ ...c.feats[0], slot: 'class:16:0' }] }
    expect(eligibleFeats([content], taken, { key: 'bonus:16:1', category: 'bonus', level: 16 })).not.toContain(content)
    expect(eligibleFeats([content], { ...taken, feats: [] }, { key: 'class:16:0', category: 'class', level: 16 })).toContain(content)
  })

  it.each([true, false])('applies No Flight %s to Auspice grants without removing natural flight or other benefits', noFlight => {
    const previous = getSettings().championFormNoFlight
    const c: Character = { ...base, level: 20, className: 'Champion', companions: [{ id: 'mount', type: 'Bear', name: '' }],
      feats: [feat('Loyal Warhorse'), feat('Imposing Destrier', 'Nimble'), { ...feat('Auspicious Mount', 'Auspice'), level: 16 }] }
    const before = JSON.stringify(c)
    try {
      updateSettings({ championFormNoFlight: noFlight })
      const stats = companionStats(c, [bear], 'Bear', companionAdvancement(c), 'mount')!
      expect(stats.speed).toBe(noFlight ? '35 feet' : '35 feet, fly 35 feet')
      expect(stats.auspice).toBe(true)
      expect(stats.skills).toContainEqual(expect.objectContaining({ name: 'Religion', rank: 2 }))
      const bird = { ...bear, data: { ...bear.data, speed_raw: '35 feet, fly 60 feet' } }
      expect(companionStats(c, [bird], 'Bear', companionAdvancement(c), 'mount')!.speed).toContain('fly 60 feet')
      expect(JSON.stringify(c)).toBe(before)
    } finally { updateSettings({ championFormNoFlight: previous }) }
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
