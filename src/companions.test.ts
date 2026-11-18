import { describe, expect, it } from 'vitest'
import { parseCompanion } from './aonQuery'
import { eligibleFeats, featSelectionPrerequisiteChecker } from './builder'
import { bardingOptions, companionAdvancement, companionStats, equippedBarding, faithfulSteedChange, minionFerocity, specializationOptions } from './companions'
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
  it('offers light/heavy base and specific barding with stable automatically scaling anti-dragon choices', () => {
    const item = (name: string, level = 0, description = '', data: ContentEntry['data'] = {}) =>
      ({ ...entry('item', name, { item_subcategory: 'Companion Items', ...data }, level), description })
    const items = [
      item('Barding', 0, 'Armor for animals.', { item_subcategory: '', item_category: 'Adventuring Gear' }),
      item('Waverider Barding', 5, 'This light barding has wave patterns.'),
      item('Barding of the Zephyr', 10, 'This light barding has wind patterns.'),
      item('Anti-Dragon Barding', 6, 'This light barding grants a +2 item bonus and deals 1d4 piercing damage.', { price: 20000 }),
      item('Greater Anti-Dragon Barding', 12, 'This light barding grants a +2 item bonus and deals 1d4 piercing damage.', { price: 170000 }),
      item('Barding Saddle', 7),
    ]
    const before = JSON.stringify(items)
    const low = bardingOptions(items, 11)
    expect(low.map(entry => entry.name)).toEqual([
      'Anti-Dragon Barding (Heavy)', 'Anti-Dragon Barding (Light)', 'Barding (Heavy)', 'Barding (Light)',
      'Barding of the Zephyr (Heavy)', 'Barding of the Zephyr (Light)', 'Waverider Barding (Heavy)', 'Waverider Barding (Light)',
    ])
    const dragon = low.find(entry => entry.name === 'Anti-Dragon Barding (Heavy)')!
    const saved = { entryId: dragon.id, name: dragon.name, qty: 1 }
    expect(dragon).toMatchObject({ level: 6, data: { price: 20000 } })
    const scaled = equippedBarding(items, 12, saved)!
    expect(scaled).toMatchObject({ id: dragon.id, name: dragon.name, level: 12, data: { price: 170000 } })
    expect(scaled.description).toContain('heavy barding grants a +4 item bonus and deals 3d4 piercing damage.')
    expect(equippedBarding(items, 11, saved)?.level).toBe(6)
    expect(equippedBarding(items, 12, { entryId: items[4].id, name: items[4].name, qty: 1 })?.name)
      .toBe('Anti-Dragon Barding (Light)')
    expect(equippedBarding([], 12, saved)).toBeUndefined()
    expect(bardingOptions(items, 12, 'Large').find(entry => entry.name === 'Barding (Heavy)'))
      .toMatchObject({ level: 3, data: { price: 5000, bulk: 8 } })
    expect(JSON.stringify(items)).toBe(before)
  })

  it('applies barding armor, Dexterity caps and Strength-dependent penalties only to its wearer', () => {
    const barding = entry('item', 'Barding', {}, 0)
    const entries = [bear, barding]
    const variants = bardingOptions(entries, 4)
    const wear = (weight: string): Character => {
      const selected = variants.find(entry => entry.data.barding_type === weight)!
      return { ...base, companions: [
        { id: 'bear', type: 'Bear', name: '', equipment: { Barding: { entryId: selected.id, name: selected.name, qty: 1 } } },
        { id: 'other', type: 'Bear', name: '' },
      ] }
    }
    const light = companionStats(wear('Light'), entries, 'Bear')!
    expect(light.ac).toBe(19)
    expect(light.speed).toBe('35 feet')
    expect(light.bardingCheckPenalty).toBe(0)
    const heavy = companionStats(wear('Heavy'), entries, 'Bear')!
    expect(heavy.ac).toBe(21)
    expect(heavy.speed).toBe('25 feet')
    expect(heavy.skills.find(skill => skill.name === 'Athletics')).toMatchObject({ bonus: 6, noteSource: 'Barding (Heavy)' })
    expect(heavy.skills.find(skill => skill.name === 'Acrobatics')?.bonus).toBe(5)
    expect(heavy.fortitude).toBe(light.fortitude)
    const stronger = companionStats(wear('Heavy'), entries, 'Bear', { mature: true, advanced: 'Savage', specializations: [] })!
    expect(stronger.mods.dex).toBe(4)
    expect(stronger.ac).toBe(22)
    expect(stronger.speed).toBe('30 feet')
    expect(stronger.bardingCheckPenalty).toBe(0)
    expect(companionStats(wear('Heavy'), entries, 'Bear',
      { mature: true, advanced: 'Savage', specializations: ['Steadfast Strider'] })?.ac).toBe(24)
    const other = companionStats(wear('Heavy'), entries, 'Bear', undefined, 'other')!
    expect(other.ac).toBe(18)
    expect(other.speed).toBe('35 feet')
    expect(other.barding).toBeUndefined()
  })

  it.each([11, 12])('scales anti-dragon conditional defenses and retaliation at level %i without boosting all saves', level => {
    const barding = entry('item', 'Anti-Dragon Barding', { item_subcategory: 'Companion Items' }, 6)
    const entries = [bear, barding]
    const c: Character = { ...base, level, companions: [
      { id: 'bear', type: 'Bear', name: '', equipment: { Barding: { entryId: barding.id, name: barding.name, qty: 1 } } },
    ] }
    const stats = companionStats(c, entries, 'Bear')!
    const unarmored = companionStats({ ...c, companions: [{ ...c.companions![0], equipment: undefined }] }, entries, 'Bear')!
    expect(stats.antiDragon).toEqual({ source: 'Anti-Dragon Barding (Light)', bonus: level >= 12 ? 4 : 2, damage: level >= 12 ? '3d4' : '1d4' })
    expect(stats.fortitude).toBe(unarmored.fortitude)
    expect(stats.reflex).toBe(unarmored.reflex)
  })

  it.each([
    { native: [], expected: ['Animal', 'Minion'] },
    { native: ['Uncommon'], expected: ['Animal', 'Minion', 'Uncommon'] },
    { native: ['Animal', 'Minion', 'animal', 'Mount'], expected: ['Animal', 'Minion'] },
    { native: ['Minion', 'Plant', 'Uncommon'], expected: ['Plant', 'Minion', 'Uncommon'] },
    { native: ['Fungus', 'Minion'], expected: ['Fungus', 'Minion'] },
    { native: ['Dragon', 'Minion', 'Uncommon'], expected: ['Dragon', 'Minion', 'Uncommon'] },
    { native: ['Incorporeal', 'Minion', 'Undead'], expected: ['Undead', 'Minion', 'Incorporeal'] },
    { native: ['Construct', 'Minion'], expected: ['Construct', 'Minion'] },
  ])('defaults missing creature traits but preserves native exceptions: $native', ({ native, expected }) => {
    const companion = { ...bear, traits: native }
    const before = JSON.stringify(companion)
    expect(companionStats(base, [companion], bear.name)?.traits).toEqual(expected)
    expect(JSON.stringify(companion)).toBe(before)
  })

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
      expect(result.grantedTraits).toContain(trait)
      expect(result.weakness).toBe(weakness)
      expect(companionStats(c, [bear], 'Bear', undefined, 'second')!.weakness).toBeUndefined()
      expect(companionStats({ ...c, level: 19 }, [bear], 'Bear')!.weakness).toBeUndefined()
      const previous = getSettings().championFormNoFlight
      const flyingBear = { ...bear, data: { ...bear.data, speed_raw: '35 feet, fly 15 feet' } }
      try {
        updateSettings({ championFormNoFlight: true })
        expect(companionStats(c, [bear], 'Bear')!.speed).toBe('35 feet')
        expect(companionStats(c, [flyingBear], 'Bear')!.speed).toBe('35 feet, fly 15 feet')
        updateSettings({ championFormNoFlight: false })
        expect(companionStats(c, [bear], 'Bear')!.speed).toBe('35 feet, fly 35 feet')
        expect(companionStats(c, [flyingBear], 'Bear')!.speed).toBe('35 feet, fly 35 feet')
      } finally { updateSettings({ championFormNoFlight: previous }) }
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
    expect(athleticsSkill?.note).toContain(`+${9 + athletics} to Athletics checks to High Jump and Long Jump (+${athletics} circumstance bonus)`)
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
      expect(stats.traits).toEqual(expect.arrayContaining(['Animal', 'Minion', sanctification]))
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
    expect(variants.every(variant => !/Starts (?:Small|Medium)/i.test(variant.description))).toBe(true)
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

  it('seeds a Small Riding Badger with Mount and otherwise identical Badger rules and growth', () => {
    const badger = entry('companion', 'Badger', { ...bear.data, strength: 2, wisdom: 2,
      mount: false, speed_raw: '25 feet, burrow 10 feet, climb 10 feet', skill: 'Survival',
      companion_support: "Your badger digs around your foe's position.",
      companion_maneuver: 'Badger Rage', companion_maneuver_actions: 'Single Action',
      companion_maneuver_traits: 'Concentrate, Emotion, Mental',
      companion_maneuver_requirements: "The badger isn't fatigued or raging.",
      companion_maneuver_description: 'The badger enters a state of pure rage that lasts for 1 minute.',
    }, 1, ['Animal', 'Minion'])
    const before = JSON.stringify(badger)
    const [riding] = homebrewCompanions([badger])
    expect(riding).toMatchObject({ id: 'homebrew:riding-badger', name: 'Riding Badger', source: 'homebrew', updatedAt: 1 })
    expect(riding.traits).toEqual(badger.traits)
    expect(riding.data).toEqual({ ...badger.data, size: 'Small', mount: true, fixed_size: false })
    for (const feats of [[], [feat('Mature Animal Companion')], [feat('Incredible Companion', 'Savage'), feat('Specialized Companion', 'Racer')]]) {
      const c = { ...base, level: 16, feats }
      const advancement = companionAdvancement(c)
      const original = companionStats(c, [badger], badger.name, advancement)!
      const mounted = companionStats(c, [riding], riding.name, advancement)
      expect(mounted).toEqual({ ...original, entry: riding, mount: true })
      expect(mounted?.size).toBe(advancement.mature ? 'Medium' : 'Small')
    }
    expect(JSON.stringify(badger)).toBe(before)
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
      const deity = entry('deity', 'Patron', { sanctification: 'holy, unholy' })
      const saved: Character = JSON.parse(JSON.stringify({ ...c, deity: deity.name,
        sanctification: auspiceServitor === 'Celestial' ? 'Holy' : auspiceServitor === 'Fiend' ? 'Unholy' : undefined,
        companions: [{ ...c.companions![0], auspiceServitor: 'Celestial' }] }))
      const before = JSON.stringify(saved)
      const changed = companionStats(saved, [bear, deity], 'Bear', companionAdvancement(saved), 'mount')!
      expect(changed).toMatchObject({ auspiceTraits: [...traits], weakness, hp: normal.hp + extraHP + (weakness ? 5 : 0) })
      expect(changed.traits).toEqual(expect.arrayContaining(['Animal', 'Minion', ...traits]))
      expect(JSON.stringify(saved)).toBe(before)
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

  it('applies Spirit of the Beast aspects scaled by spell rank', () => {
    const companion = (spiritAspect?: 'Might' | 'Swiftness' | 'Insight') => ({ id: 'a', name: '', type: 'Bear', spiritAspect })
    const at = (level: number, spiritAspect?: 'Might' | 'Swiftness' | 'Insight') => {
      const c = { ...base, level, spells: [{ name: 'Spirit of the Beast', rank: 1, level: 1 }] as never, companions: [companion(spiritAspect)] }
      return companionStats(c, [bear], 'Bear', undefined, 'a')!
    }
    const none = at(9)
    const might = at(9, 'Might')
    expect(might.fortitude).toBe(none.fortitude + 2)
    expect(might.skills.find(s => s.name === 'Athletics')!.bonus).toBe(none.skills.find(s => s.name === 'Athletics')!.bonus + 2)
    expect(might.reflex).toBe(none.reflex)
    expect(at(15, 'Swiftness').reflex).toBe(at(15).reflex + 3)
    expect(at(1, 'Insight').will).toBe(at(1).will + 1)
    expect(at(1, 'Insight').perceptionNote).toContain('Seek')
  })

  it('hides legacy Beastmaster Heal Animal while preserving saved selections and native healing', () => {
    const dedication = entry('feat', 'Beastmaster Dedication', { archetype: 'Beastmaster' }, 2, ['Archetype', 'Dedication'])
    const heal = entry('feat', 'Heal Animal', { archetype: 'Beastmaster' }, 4, ['Archetype'])
    const slot = { key: 'archetype:4:0', category: 'archetype' as const, level: 4 }
    const c = { ...base, level: 4, feats: [feat(dedication.name, undefined, 'archetype:2:0')] }
    expect(eligibleFeats([dedication, heal], c, slot)).not.toContain(heal)
    const owned = { ...c, feats: [...c.feats, feat('Heal Companion', undefined, 'class:2:0')] }
    expect(eligibleFeats([dedication, heal], owned, slot)).not.toContain(heal)
    const companionSpell = entry('spell', 'Heal Companion', { warden_spell_tier: 'Initiate' }, 1, ['Focus', 'Ranger'])
    const warden = { ...c, className: 'Ranger', feats: [...c.feats, feat('Initiate Warden', 'Heal Companion', 'class:2:0')] }
    expect(eligibleFeats([dedication, heal, companionSpell], warden, slot)).not.toContain(heal)
    const native = entry('feat', 'Heal Animal', {}, 4, ['Druid'])
    expect(eligibleFeats([native], c, { ...slot, category: 'class' })).toContain(native)
    const duplicate = { ...owned, feats: [...owned.feats, feat('Heal Animal', undefined, 'class:2:1')] }
    const before = JSON.stringify(duplicate)
    expect(eligibleFeats([dedication, heal], duplicate, slot)).not.toContain(heal)
    expect(JSON.stringify(duplicate)).toBe(before)
  })

  it('hides the Ranger or Druid copy of Side by Side once either is owned', () => {
    const ranger = entry('feat', 'Side by Side (Ranger)', {}, 12, ['Ranger'])
    const druid = entry('feat', 'Side by Side (Druid)', {}, 10, ['Druid'])
    const c = { ...base, level: 12, className: 'Ranger', feats: [feat('Side by Side (Druid)', undefined, 'class:10:0')] }
    expect(eligibleFeats([ranger, druid], c, { key: 'class:12:0', category: 'class' as const, level: 12 })).not.toContain(ranger)
    expect(eligibleFeats([ranger], { ...c, feats: [] }, { key: 'class:12:0', category: 'class' as const, level: 12 })).toContain(ranger)
  })

  it('hides Beastmaster Animal Empathy when the class already provided it', () => {
    const dedication = entry('feat', 'Beastmaster Dedication', { archetype: 'Beastmaster' }, 2, ['Archetype', 'Dedication'])
    const ranger = entry('feat', 'Animal Empathy (Ranger)', { archetype: 'Beastmaster' }, 4, ['Archetype', 'Ranger'])
    const druid = entry('feat', 'Animal Empathy (Druid)', { archetype: 'Beastmaster' }, 4, ['Archetype', 'Druid'])
    const slot = { key: 'archetype:4:0', category: 'archetype' as const, level: 4 }
    const c = { ...base, level: 4, feats: [feat(dedication.name, undefined, 'archetype:2:0')] }
    expect(eligibleFeats([dedication, ranger, druid], c, slot)).toEqual([druid])
    expect(eligibleFeats([dedication, druid, ranger], { ...c, className: 'Champion' }, slot)).toEqual([ranger])
    expect(eligibleFeats([dedication, druid, ranger], { ...c, className: 'Champion' }, slot,
      { includeUnmetPrerequisites: true })).toEqual([ranger])
    const saved = { ...c, className: 'Champion', feats: [...c.feats, feat(druid.name, undefined, slot.key)] }
    expect(eligibleFeats([dedication, ranger, druid], saved, slot)).toEqual([druid])
    expect(eligibleFeats([dedication, ranger, druid], { ...c, className: 'Ranger' },
      { key: 'class:4:0', category: 'class', level: 4 })).toEqual([ranger])
    const owned = { ...c, feats: [...c.feats, feat('Animal Empathy (Ranger)', undefined, 'class:2:0')] }
    const options = eligibleFeats([dedication, ranger, druid], owned, slot)
    expect(options).not.toContain(ranger)
    expect(options).not.toContain(druid)
  })

  it('hides multi-companion-only Beastmaster feats under the single companion rule', () => {
    const call = entry('feat', "Beastmaster's Call", {}, 12, ['Archetype'])
    expect(eligibleFeats([call], { ...base, level: 12 }, { key: 'archetype:12:0', category: 'archetype' as const, level: 12 })).not.toContain(call)
    const extra = entry('feat', 'Additional Companion', {}, 4, ['Archetype'])
    const swift = entry('feat', 'Swift Guardian', {}, 4, ['Archetype'])
    const slot = { key: 'archetype:4:0', category: 'archetype' as const, level: 4 }
    const out = eligibleFeats([extra, swift], { ...base, level: 4 }, slot)
    expect(out).not.toContain(extra)
    expect(out).not.toContain(swift)
    for (const name of ['Lead the Pack', 'Pack Takedown']) {
      const pack = entry('feat', name, {}, 16, ['Archetype'])
      const character = { ...base, level: 20 }
      const packSlot = { key: 'archetype:20:0', category: 'archetype' as const, level: 20 }
      expect(eligibleFeats([pack], character, packSlot)).not.toContain(pack)
      expect(eligibleFeats([pack], character, packSlot, { includeUnmetPrerequisites: true })).not.toContain(pack)
      expect(featSelectionPrerequisiteChecker(character, [pack], packSlot)(pack).missing)
        .toContain('Disable Multiple Animal Companions must be disabled')
    }
  })

  it('gates attack-specific Beastmaster feats by the companion and grants their maneuvers', () => {
    const dedication = entry('feat', 'Beastmaster Dedication', { archetype: 'Beastmaster' }, 2, ['Archetype', 'Dedication'])
    const sinking = entry('feat', 'Sinking Jaws', { archetype: 'Beastmaster', prerequisite: 'Beastmaster Dedication; animal companion with a jaws or fangs unarmed attack' }, 10, ['Archetype'])
    const tail = entry('feat', 'Sweeping Tail', { archetype: 'Beastmaster', prerequisite: 'Beastmaster Dedication; animal companion with a tail unarmed attack' }, 10, ['Archetype'])
    const slot = { key: 'archetype:10:0', category: 'archetype' as const, level: 10 }
    const c: Character = { ...base, level: 10, feats: [feat(dedication.name, undefined, 'archetype:2:0')],
      companions: [{ id: 'a', name: '', type: 'Bear' }] }
    const out = eligibleFeats([dedication, sinking, tail, bear], c, slot)
    expect(out).toContain(sinking)
    expect(out).not.toContain(tail)
    const owned = { ...c, feats: [...c.feats, feat('Sinking Jaws', undefined, 'archetype:10:0')] }
    const stats = companionStats(owned, [bear], 'Bear', undefined, 'a')!
    expect(stats.beastmasterManeuvers.map(m => m.name)).toEqual(['Sinking Jaws'])
    expect(stats.beastmasterManeuvers[0].description).toContain(`${10 + stats.mods.str} piercing`)
  })

  it('adds Pack Movement, Heightened Instincts and Call Companion notes', () => {
    const c: Character = { ...base, level: 10, feats: [feat('Pack Movement', undefined, 'archetype:8:0'), feat('Heightened Instincts', undefined, 'archetype:10:0')],
      companions: [{ id: 'a', name: '', type: 'Bear' }, { id: 'b', name: '', type: 'Bear' }] }
    const stats = companionStats(c, [bear], 'Bear', undefined, 'a')!
    expect(stats.beastmasterSpecial.map(x => x.name)).toEqual(['Pack Movement', 'Heightened Instincts', 'Call Companion'])
  })

  it.each([
    ['Champion', 'Loyal Warhorse', 'Imposing Destrier', 'Auspicious Mount'],
    ['Commander', 'Battle-Tested Companion', 'Battle-Hardened Companion', 'Peerless Mascot Companion'],
    ['Druid', 'Mature Animal Companion (Druid)', 'Incredible Companion (Druid)', 'Specialized Companion (Druid)'],
    ['Ranger', 'Mature Animal Companion (Ranger)', 'Incredible Companion (Ranger)', 'Specialized Companion (Ranger)'],
  ])('prefers native %s companion progression before any upgrades are selected', (className, matureName, advancedName, specializedName) => {
    const previous = getSettings().singleAnimalCompanion
    const dedication = entry('feat', 'Beastmaster Dedication', { archetype: 'Beastmaster' }, 2, ['Archetype', 'Dedication'])
    const native = [matureName, advancedName, specializedName].map((name, i) =>
      entry('feat', name, {}, [6, 10, 16][i], [className]))
    const archetype = ['Mature Beastmaster Companion', 'Incredible Beastmaster Companion', 'Specialized Beastmaster Companion',
      'Impressive Mount', 'Incredible Mount', 'Specialized Mount'].map((name, i) =>
      entry('feat', name, { archetype: 'Beastmaster' }, [4, 8, 14][i % 3], ['Archetype']))
    const sideBySide = entry('feat', 'Side by Side (Druid)', { archetype: 'Beastmaster', prerequisite: 'Animal Companion' }, 14, ['Druid'])
    const entries = [dedication, ...native, ...archetype, sideBySide]
    const c: Character = { ...base, className, level: 20, feats: [feat(dedication.name, undefined, 'archetype:2:0')] }
    const slot = { key: 'archetype:20:0', category: 'archetype' as const, level: 20 }
    const before = JSON.stringify(c)
    try {
      updateSettings({ singleAnimalCompanion: true })
      const offered = eligibleFeats(entries, c, slot)
      for (const option of archetype) {
        expect(offered.includes(option)).toBe(['Champion', 'Commander'].includes(className)
          && ['Specialized Beastmaster Companion', 'Specialized Mount'].includes(option.name))
      }
      expect(offered).toContain(sideBySide)
      for (const option of native) expect(eligibleFeats(entries, c, { ...slot, category: 'class' })).toContain(option)
      expect(eligibleFeats(entries, { ...c, level: 4 }, { ...slot, level: 4, key: 'archetype:4:0' })).not.toContain(archetype[0])
      for (const option of archetype) {
        const saved = { ...c, feats: [...c.feats, { ...feat(option.name, undefined, slot.key), sourceId: option.id }] }
        expect(eligibleFeats(entries, saved, slot, { includeUnmetPrerequisites: true })).toContain(option)
      }
      updateSettings({ singleAnimalCompanion: false })
      for (const option of archetype) expect(eligibleFeats(entries, c, slot)).toContain(option)
      expect(JSON.stringify(c)).toBe(before)
    } finally { updateSettings({ singleAnimalCompanion: previous }) }
  })

  it('uses only native progression available in the character ruleset', () => {
    const dedication = entry('feat', 'Beastmaster Dedication', { archetype: 'Beastmaster' }, 2, ['Archetype', 'Dedication'])
    const mature = entry('feat', 'Mature Beastmaster Companion', { archetype: 'Beastmaster' }, 4, ['Archetype'])
    const foreign: ContentEntry = { ...entry('feat', 'Loyal Warhorse', {}, 6, ['Champion']), systems: ['sf2e'] }
    const c: Character = { ...base, className: 'Champion', feats: [feat(dedication.name, undefined, 'archetype:2:0')] }
    expect(eligibleFeats([dedication, mature, foreign], c, { key: 'archetype:4:0', category: 'archetype', level: 4 })).toContain(mature)
  })

  it.each([
    ['Champion', 'Imposing Destrier', 'Auspicious Mount', 'Auspice'],
    ['Commander', 'Battle-Hardened Companion', 'Peerless Mascot Companion', 'Ambusher'],
  ])('lets %s supplement its single native specialization up to three total', (className, advancedName, nativeName, choice) => {
    const previous = getSettings().singleAnimalCompanion
    const dedication = entry('feat', 'Beastmaster Dedication', { archetype: 'Beastmaster' }, 2, ['Archetype', 'Dedication'])
    const advanced = entry('feat', advancedName, {}, 10, [className])
    const native = entry('feat', nativeName, { prerequisite: advancedName }, 16, [className])
    const specialized = entry('feat', 'Specialized Beastmaster Companion',
      { archetype: 'Beastmaster', prerequisite: 'Incredible Beastmaster Companion', repeatable: true }, 14, ['Archetype'])
    const entries = [dedication, advanced, native, specialized]
    const c: Character = { ...base, className, level: 20, feats: [
      feat(dedication.name, undefined, 'archetype:2:0'), feat(advanced.name, 'Nimble', 'class:10:0'),
      feat(native.name, choice, 'class:16:0'),
    ] }
    const slot = { key: 'archetype:20:0', category: 'archetype' as const, level: 20 }
    try {
      updateSettings({ singleAnimalCompanion: true })
      expect(eligibleFeats(entries, c, slot)).toContain(specialized)
      const second = { ...c, feats: [...c.feats, feat(specialized.name, 'Racer', 'archetype:18:0')] }
      expect(eligibleFeats(entries, second, slot)).toContain(specialized)
      const third = { ...second, feats: [...second.feats, feat(specialized.name, undefined, 'archetype:20:1')] }
      expect(eligibleFeats(entries, third, slot)).not.toContain(specialized)
      expect(eligibleFeats(entries, third, { ...slot, key: 'archetype:20:1' })).toContain(specialized)
      expect(specializationOptions(second, [], second.feats.length)).not.toContain(choice)
      expect(specializationOptions(second, [], second.feats.length)).not.toContain('Racer')
      expect(eligibleFeats(entries, third, { ...slot, category: 'class' })).not.toContain(native)
    } finally { updateSettings({ singleAnimalCompanion: previous }) }
  })

  it('offers Beastmaster Side by Side at level 14 without requiring the Druid Animal Companion feat', () => {
    const previous = getSettings().championBeastmaster
    const dedication = entry('feat', 'Beastmaster Dedication', { archetype: 'Beastmaster' }, 2, ['Archetype', 'Dedication'])
    const animal = entry('feat', 'Animal Companion', {}, 1, ['Druid', 'Ranger'])
    const sideBySide = entry('feat', 'Side by Side (Druid)', {
      archetype: 'Beastmaster', archetype_levels: 'Beastmaster: 14', prerequisite: animal.name,
    }, 10, ['Druid'])
    const entries = [dedication, animal, sideBySide]
    const c: Character = { ...base, className: 'Champion', level: 14,
      feats: [feat('Faithful Steed', undefined, 'class:1:0'), feat(dedication.name, undefined, 'archetype:2:0')],
      companions: [{ id: 'horse', type: 'Horse', name: '' }] }
    const slot = { key: 'archetype:14:0', category: 'archetype' as const, level: 14 }
    try {
      updateSettings({ championBeastmaster: false })
      expect(featSelectionPrerequisiteChecker(c, entries, slot)(sideBySide)).toEqual({ missing: [], manual: [] })
      expect(eligibleFeats(entries, c, slot)).toContain(sideBySide)
      expect(eligibleFeats(entries, { ...c, level: 13 }, { ...slot, level: 13, key: 'archetype:13:0' })).not.toContain(sideBySide)
      expect(eligibleFeats(entries, { ...c, feats: c.feats.slice(0, 1) }, slot)).not.toContain(sideBySide)
      const selected = { ...c, feats: [...c.feats, feat(sideBySide.name, undefined, 'class:10:0')] }
      expect(eligibleFeats(entries, selected, slot)).not.toContain(sideBySide)
    } finally { updateSettings({ championBeastmaster: previous }) }
  })

  it('applies Commander native maturity, advanced training and ordinary specializations', () => {
    const c: Character = { ...base, className: 'Commander', level: 16,
      feats: [feat('Battle-Tested Companion'), feat('Battle-Hardened Companion', 'Nimble'), feat('Peerless Mascot Companion', 'Ambusher')] }
    expect(companionAdvancement(c)).toEqual({ mature: true, advanced: 'Nimble', specializations: ['Ambusher'] })
    expect(companionAdvancement({ ...c, level: 1 })).toEqual({ mature: false, advanced: undefined, specializations: [] })
    const specialized = entry('feat', 'Peerless Mascot Companion', {}, 16, ['Commander'])
    expect(eligibleFeats([specialized], { ...c, level: 20 },
      { key: 'class:20:0', category: 'class', level: 20 })).not.toContain(specialized)
  })

  it('hides Mature and Incredible Beastmaster Companion but lets class advancement unlock Specialized', () => {
    const mature = entry('feat', 'Mature Beastmaster Companion', {}, 4, ['Archetype'])
    const incredible = entry('feat', 'Incredible Beastmaster Companion', {}, 10, ['Archetype'])
    const specialized = entry('feat', 'Specialized Beastmaster Companion', { prerequisite: 'Incredible Beastmaster Companion' }, 14, ['Archetype'])
    const slot = { key: 'archetype:14:0', category: 'archetype' as const, level: 14 }
    const c = { ...base, level: 14, feats: [feat('Incredible Companion (Druid)', 'Nimble', 'class:10:0')] }
    const out = eligibleFeats([mature, incredible, specialized], c, slot)
    expect(out).not.toContain(mature)
    expect(out).not.toContain(incredible)
    expect(out).toContain(specialized)
    expect(eligibleFeats([incredible, specialized], { ...c, feats: [] }, slot)).not.toContain(specialized)
  })

  it('retains needed Beastmaster advancement and recognizes equivalent class and mount training', () => {
    const previous = getSettings().singleAnimalCompanion
    const dedication = entry('feat', 'Beastmaster Dedication', {}, 2, ['Archetype', 'Dedication'])
    const mature = entry('feat', 'Mature Beastmaster Companion', { prerequisite: dedication.name }, 4, ['Archetype'])
    const incredible = entry('feat', 'Incredible Beastmaster Companion', { prerequisite: mature.name }, 8, ['Archetype'])
    const specialized = entry('feat', 'Specialized Beastmaster Companion', { prerequisite: incredible.name }, 14, ['Archetype'])
    const entries = [dedication, mature, incredible, specialized]
    const slot = { key: 'archetype:14:0', category: 'archetype' as const, level: 14 }
    const young = { ...base, level: 14, feats: [feat(dedication.name, undefined, 'archetype:2:0')],
      companions: [{ id: 'bear', type: 'Bear', name: '' }] }
    try {
      updateSettings({ singleAnimalCompanion: true })
      expect(eligibleFeats(entries, young, slot)).toContain(mature)
      expect(eligibleFeats(entries, young, slot)).not.toContain(incredible)
      for (const name of ['Mature Animal Companion (Ranger)', 'Impressive Mount']) {
        const c = { ...young, feats: [...young.feats, feat(name, undefined, 'class:4:0')] }
        expect(eligibleFeats(entries, c, slot)).not.toContain(mature)
        expect(eligibleFeats(entries, c, slot)).toContain(incredible)
        expect(eligibleFeats(entries, c, slot)).not.toContain(specialized)
      }
      const advanced = { ...young, feats: [...young.feats, feat('Incredible Mount', 'Savage', 'archetype:8:0')] }
      expect(eligibleFeats(entries, advanced, slot)).not.toContain(mature)
      expect(eligibleFeats(entries, advanced, slot)).not.toContain(incredible)
      expect(eligibleFeats(entries, advanced, slot)).toContain(specialized)
      const before = JSON.stringify(advanced)
      const saved = { ...advanced, feats: [...advanced.feats, feat(incredible.name, 'Nimble', slot.key)] }
      expect(eligibleFeats(entries, saved, slot)).toContain(incredible)
      expect(JSON.stringify(advanced)).toBe(before)
      const future = { ...young, feats: [...young.feats, feat('Incredible Mount', 'Savage', 'archetype:16:0')] }
      expect(eligibleFeats(entries, future, slot)).toContain(mature)
      expect(eligibleFeats(entries, future, slot)).not.toContain(specialized)
      updateSettings({ singleAnimalCompanion: false })
      expect(eligibleFeats(entries, advanced, slot)).toContain(mature)
      expect(eligibleFeats(entries, advanced, slot)).not.toContain(specialized)
      const pack = entry('feat', 'Lead the Pack', {}, 16, ['Archetype'])
      expect(eligibleFeats([pack], { ...young, level: 20 }, { ...slot, level: 20 })).toContain(pack)
    } finally { updateSettings({ singleAnimalCompanion: previous }) }
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

  it('shares the three-specialization cap across class, mount, and Beastmaster feats', () => {
    const specialized = entry('feat', 'Specialized Beastmaster Companion', {}, 14, ['Archetype'])
    const slot = { key: 'archetype:16:0', category: 'archetype' as const, level: 16 }
    const c = { ...base, level: 16, feats: [feat('Specialized Companion', 'Ambusher', 'class:14:0'),
      feat('Specialized Mount', 'Racer', 'archetype:14:0')] }
    expect(eligibleFeats([specialized], c, slot)).toContain(specialized)
    expect(eligibleFeats([specialized], { ...c, feats: [...c.feats,
      feat(specialized.name, undefined, 'archetype:14:1')] }, slot)).not.toContain(specialized)
  })

  it.each(['Incredible Companion (Ranger)', 'Incredible Companion (Druid)', 'Incredible Beastmaster Companion', 'Imposing Destrier'])(
    'hides duplicate Incredible Mount after %s but retains access to Specialized Mount', name => {
      const previous = getSettings().singleAnimalCompanion
      const dedication = entry('feat', 'Cavalier Dedication', { archetype: 'Cavalier' }, 2, ['Archetype', 'Dedication'])
      const impressive = entry('feat', 'Impressive Mount', { archetype: 'Cavalier', prerequisite: dedication.name }, 4, ['Archetype'])
      const incredible = entry('feat', 'Incredible Mount', { archetype: 'Cavalier', prerequisite: impressive.name }, 8, ['Archetype'])
      const specialized = entry('feat', 'Specialized Mount', { archetype: 'Cavalier', prerequisite: incredible.name }, 14, ['Archetype'])
      const entries = [dedication, impressive, incredible, specialized]
      const slot = { key: 'archetype:14:0', category: 'archetype' as const, level: 14 }
      const c = { ...base, level: 14, feats: [feat(dedication.name, undefined, 'archetype:2:0'),
        feat(impressive.name, undefined, 'archetype:4:0'), feat(name, 'Nimble', 'class:6:0')] }
      try {
        updateSettings({ singleAnimalCompanion: true })
        expect(eligibleFeats(entries, c, slot)).not.toContain(incredible)
        expect(eligibleFeats(entries, c, slot)).toContain(specialized)
        const selected = { ...c, feats: [...c.feats, feat(incredible.name, 'Savage', slot.key)] }
        expect(eligibleFeats(entries, selected, slot)).toContain(incredible)
        const young = { ...c, companions: [{ id: 'bear', type: 'Bear', name: '' }], feats: [c.feats[0], c.feats[1]] }
        expect(eligibleFeats(entries, young, slot)).toContain(incredible)
        expect(eligibleFeats(entries, young, slot)).not.toContain(specialized)
        const future = { ...c, feats: [...c.feats.slice(0, 2), feat(name, 'Nimble', 'class:16:0')] }
        expect(eligibleFeats(entries, future, slot)).toContain(incredible)
        expect(eligibleFeats(entries, future, slot)).not.toContain(specialized)
        updateSettings({ singleAnimalCompanion: false })
        expect(eligibleFeats(entries, c, slot)).toContain(incredible)
        expect(eligibleFeats(entries, c, slot)).not.toContain(specialized)
      } finally { updateSettings({ singleAnimalCompanion: previous }) }
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
