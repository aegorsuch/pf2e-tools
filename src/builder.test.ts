import { describe, expect, it } from 'vitest'
import { additionalSkillCount, ancestryLabel, armorClass, boostSlots, classFeatures, classSkills, computeAbilities, baseItems, eligibleFeats, heritagesFor, maxHp, plannedSlots, ranksAt, skillRankBudget, weaponAttack } from './builder'
import type { Character, ContentEntry } from './types'

const entry = (kind: ContentEntry['kind'], name: string, data: ContentEntry['data'] = {}, level = 1, traits: string[] = []): ContentEntry => ({
  id: `${kind}:${name}`, systems: ['pf2e'], kind, source: 'official', name, level, traits, description: '', data, effects: [], updatedAt: 1,
})

const entries = [
  entry('ancestry', 'Elf', { attribute: 'Dexterity, Intelligence, Free', attribute_flaw: 'Constitution', hp: 6 }),
  entry('ancestry', 'Human', { attribute: 'Two free ability boosts' }),
  entry('background', 'Scholar', { attribute: 'Intelligence, Wisdom', skill: 'Arcana, Academia Lore' }),
  entry('background', 'Scout', { attribute: 'Dexterity, Wisdom' }),
  entry('class', 'Wizard', {
    attribute: 'Intelligence', perception_proficiency: 'Trained', will_proficiency: 'Expert',
    skill_proficiency: 'Trained in Arcana, Trained in a number of additional skills equal to 2 plus your Intelligence modifier',
  }),
  entry('class', 'Ranger', { attribute: 'Dexterity, Strength' }),
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

describe('ancestryLabel', () => {
  it('does not repeat an ancestry already in the heritage name', () => {
    expect(ancestryLabel('Human', 'Pioneer Human')).toBe('Pioneer Human')
    expect(ancestryLabel('Human', 'Pioneer human')).toBe('Pioneer human')
    expect(ancestryLabel('Human', 'Winterborn')).toBe('Winterborn Human')
    expect(ancestryLabel('Human', 'Humanity')).toBe('Humanity Human')
  })

  it('handles incomplete selections', () => {
    expect(ancestryLabel('Human')).toBe('Human')
    expect(ancestryLabel(undefined, 'Pioneer')).toBe('Pioneer')
    expect(ancestryLabel()).toBe('')
  })
})

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

  it('creates two free ancestry boosts for Human in addition to the four level-1 boosts', () => {
    const ranger: Character = { ...base, ancestry: 'Human', className: 'Ranger', background: 'Scout' }
    const slots = boostSlots(ranger, entries)
    expect(slots.filter((s) => s.group === 'ancestry')).toHaveLength(2)
    expect(slots.filter((s) => s.group === 'free1')).toHaveLength(4)
    expect(slots.find((s) => s.key === 'ancestry:0')?.fixed).toBeUndefined()
    const scores = computeAbilities({
      ...ranger,
      boosts: {
        'ancestry:0': 'wis',
        'ancestry:1': 'con',
        'background:0': 'dex',
        'background:1': 'cha',
        class: 'dex',
        'free1:0': 'str',
        'free1:1': 'int',
        'free1:2': 'wis',
        'free1:3': 'cha',
      },
    }, entries)
    expect(scores).toEqual({ str: 12, dex: 14, con: 12, int: 12, wis: 14, cha: 14 })
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
  it('sorts feats alphabetically and allows only marked feats to repeat', () => {
    const feats = [
      entry('feat', 'Zeal', {}, 1, ['Ranger']),
      entry('feat', 'Alpha', {}, 1, ['Ranger']),
      entry('feat', 'Multifarious Muse', { repeatable: true }, 1, ['Ranger']),
    ]
    const c: Character = { ...base, className: 'Ranger', feats: [
      { name: 'Zeal', type: 'Class Feat', level: 1, slot: 'class:1:0' },
      { name: 'Multifarious Muse', type: 'Class Feat', level: 1, slot: 'class:1:1' },
    ] }
    expect(eligibleFeats(feats, c, { key: 'class:1:2', category: 'class', level: 1 }).map((f) => f.name))
      .toEqual(['Alpha', 'Multifarious Muse'])
  })
})

describe('skills', () => {
  it('parses class skills', () => {
    expect(classSkills(entries.find((e) => e.kind === 'class' && e.name === 'Wizard'))).toEqual({ fixed: ['Arcana'], additional: 2 })
  })
  it('ignores choice lines', () => {
    const k = entry('class', 'Fighter', { skill_proficiency: 'Trained in your choice of Acrobatics or Athletics, Trained in a number of additional skills equal to 3 plus your Intelligence modifier' })
    expect(classSkills(k)).toEqual({ fixed: [], additional: 3 })
  })
  it('combines sources, increases and overrides', () => {
    const c = { ...base, level: 3, skillPicks: ['Society'], skillIncreases: { 3: 'Society' }, rankOverrides: { Reflex: 2 } }
    const r = ranksAt(c, entries)
    expect(r).toMatchObject({ Arcana: 1, Society: 2, 'Academia Lore': 1, Perception: 1, Will: 2, Reflex: 0 })
  })
  it('adds Natural Skill picks and groups available skill increases by rank ceiling', () => {
    const naturalSkill = entry('feat', 'Natural Skill')
    const ranger = entry('class', 'Ranger', {
      skill_proficiency: 'Trained in a number of additional skills equal to 4 plus your Intelligence modifier',
    })
    const c = { ...base, className: 'Ranger', level: 7, feats: [{ name: 'Natural Skill', type: 'Ancestry Feat', level: 1 }] }
    const withFeat = [...entries.filter((e) => !(e.kind === 'class' && e.name === 'Ranger')), naturalSkill, ranger]
    expect(classSkills(ranger)).toEqual({ fixed: [], additional: 4 })
    expect(additionalSkillCount(c, withFeat)).toBe(6)
    expect(skillRankBudget(c, withFeat)).toEqual({ trained: 6, expert: 2, master: 1, legendary: 0 })
    expect(skillRankBudget({ ...c, skillPicks: ['Acrobatics'], skillIncreases: { 3: 'Nature' } }, withFeat))
      .toEqual({ trained: 5, expert: 1, master: 1, legendary: 0 })
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

describe('defenses', () => {
  it('calculates HP with Toughness and AC from worn armor and class proficiency', () => {
    const ranger = entry('class', 'Ranger', { hp: 8, medium_armor_proficiency: 'Trained' })
    const plate = entry('armor', 'Half Plate', { ac: 4, dex_cap: 1 }, 0, ['Medium'])
    const expertise = entry('classFeature', 'Medium Armor Expertise', { class: 'Ranger' }, 5)
    const c = {
      ...base, className: 'Ranger', level: 5, abilities: { ...base.abilities, dex: 16, con: 14 },
      equipment: [{ name: 'Half Plate', qty: 1 }],
    }
    const data = [...entries.filter((e) => !(e.kind === 'class' && e.name === 'Ranger')), ranger, plate, expertise]
    expect(armorClass(c, data)).toBe(24)
    expect(maxHp(c, data)).toBe(56)
    expect(maxHp({ ...c, feats: [{ name: 'Toughness', type: 'General Feat', level: 1 }] }, data)).toBe(61)
  })
})

describe('configured gear', () => {
  const ranger = entry('class', 'Ranger', { hp: 8, medium_armor_proficiency: 'Trained', attack_proficiency: 'Trained in simple and martial weapons' })
  const plate = entry('armor', 'Half Plate', { ac: 4, dex_cap: 1 }, 0, ['Medium'])
  const bow = entry('weapon', 'Longbow', { damage: '1d8 P', range: 100, weapon_type: 'Martial' })
  const data = [...entries.filter((e) => !(e.kind === 'class' && e.name === 'Ranger')), ranger, plate, bow]
  const c: Character = {
    ...base, className: 'Ranger', level: 5, abilities: { ...base.abilities, dex: 16, str: 12, con: 14 }, equipment: [],
  }

  it('adds potency and resilient runes to worn armor AC and saves, and raised shield', () => {
    const armors = [{ id: 'a', name: 'Half Plate', potency: 2, resilient: 1, runes: [], worn: true }]
    expect(armorClass({ ...c, armors }, data)).toBe(armorClass({ ...c, armors: [{ ...armors[0], potency: 0 }] }, data) + 2)
    expect(armorClass({ ...c, armors: [{ ...armors[0], worn: false }] }, data)).toBeLessThan(armorClass({ ...c, armors }, data))
    const shield = { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: true }
    expect(armorClass({ ...c, armors, shield }, data)).toBe(armorClass({ ...c, armors }, data) + 2)
  })

  it('computes weapon attack and striking damage', () => {
    const w = { id: 'w', name: 'Longbow', potency: 2, striking: 1, runes: [] }
    const a = weaponAttack(c, data, w)
    expect(a.ability).toBe('dex')
    expect(a.attack).toBe(3 + 7 + 2)
    expect(a.damage).toBe('2d8 P')
  })
})

describe('heritagesFor', () => {
  it('offers PF2e (trait-tagged) and SF2e (linked) heritages together, plus versatile ones', () => {
    const list = [
      entry('ancestry', 'Gnome'), entry('ancestry', 'Elf'),
      entry('heritage', 'Chameleon Gnome', {}, 1, ['Gnome', 'Heritage']),
      entry('heritage', 'Woodland Elf', {}, 1, ['Elf', 'Heritage']),
      entry('heritage', 'Aquazoan Gnome', { ancestry: 'gnome' }),
      entry('heritage', 'Changeling', {}, 1, ['Heritage']),
    ]
    expect(heritagesFor(list, 'Gnome').map((h) => h.name).sort()).toEqual(['Aquazoan Gnome', 'Chameleon Gnome', 'Changeling'])
  })
})

describe('baseItems', () => {
  it('drops graded upgrades of an existing base item', () => {
    const list = ['Armored Coat', 'Advanced Armored Coat', 'Laser Pistol', 'Laser Pistol, Tactical', 'Advanced Rifle', 'Hand Crossbow', 'Crossbow']
      .map((n) => entry('armor', n))
    expect(baseItems(list).map((e) => e.name)).toEqual(['Armored Coat', 'Laser Pistol', 'Advanced Rifle', 'Hand Crossbow', 'Crossbow'])
  })
})
