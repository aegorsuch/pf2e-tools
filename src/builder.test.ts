import { parseClericSpells, parseDeityAbout, parseFeatLanguages } from './aonQuery'
import { describe, expect, it } from 'vitest'
import { armorSpecialization, autoClassSkills, classLabel, subclassOptions, featLores, senses, additionalSkillCount, ancestryLabel, armorClass, boostSlots, cannyAcumenOptions, classFeatures, classSkills, computeAbilities, baseItems, eligibleFeats, isMagicItem, heritagesFor, languageAllowance, languageGroups, maxHp, orphanedArchetypeFeats, focusSpells, orderMagicOptions, propertyRunes, unslottedFeats, speed, initiativeBonus, plannedSlots, ranksAt, skillRankBudget, weaponAttack } from './builder'
import { updateSettings } from './settings'
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

  describe('class labels', () => {
    it.each([
      ['Ranger', 'Outwit', 'Outwit Ranger'],
      ['Champion', 'Justice', 'Champion of Justice'],
      ['Barbarian', 'Giant', 'Giant Instinct Barbarian'],
      ['Barbarian', 'Giant Instinct', 'Giant Instinct Barbarian'],
      ['Inventor', 'Construct', 'Construct Inventor'],
      ['Druid', 'Animal', 'Druid of the Animal Order'],
      ['Druid', 'Storm', 'Druid of the Storm Order'],
    ])('labels %s with selected %s specialization', (className, subclass, expected) => {
      expect(classLabel({ ...base, className, subclass, ...(className === 'Druid' ? { order: subclass } : {}) })).toBe(expected)
      expect(classLabel({ ...base, className })).toBe(className)
    })

    it('recognizes imported subclass choices while allowing explicit changes and clearing', () => {
      const outwit = entry('subclass', 'Outwit', { class: 'Ranger' })
      const data = [outwit, entry('subclass', 'Justice', { class: 'Champion' }), { ...outwit, id: 'deleted', name: 'Deleted', deleted: true }]
      const c: Character = {
        ...base, className: 'Ranger',
        imported: { source: 'pathbuilder', raw: { build: { class: 'Ranger', specials: ['Hunt Prey', 'Outwit'] } }, unmapped: [] },
      }
      expect(subclassOptions(c, data)).toEqual([outwit])
      expect(classLabel(c, data)).toBe('Outwit Ranger')
      expect(classLabel({ ...c, subclass: 'Precision' }, data)).toBe('Precision Ranger')
      expect(classLabel({ ...c, subclass: '' }, data)).toBe('Ranger')
      expect(classLabel({ ...c, className: 'Champion' }, data)).toBe('Champion')
      expect(classLabel({ ...c, imported: undefined, feats: [{ name: "Hunter's Edge", type: 'Class Feature', level: 1, choice: 'Outwit' }] }, data))
        .toBe('Outwit Ranger')
      expect(classLabel({ ...base, className: 'Druid', imported: { source: 'pathbuilder', raw: { class: 'Druid', specials: ['Animal Order'] }, unmapped: [] } }))
        .toBe('Druid of the Animal Order')
    const explorer = { name: 'Order Explorer', type: 'Class Feat', level: 2, choice: 'Animal' }
    expect(classLabel({ ...base, className: 'Druid', order: 'Storm', feats: [explorer] })).toBe('Druid of the Storm Order')
    expect(classLabel({
        ...base, className: 'Druid', feats: [explorer],
        imported: { source: 'pathbuilder', raw: { class: 'Druid', specials: ['Storm Order', 'Animal Order'] }, unmapped: [] },
    })).toBe('Druid of the Storm Order')
    expect(classLabel({ ...base, className: 'Druid', feats: [explorer] })).toBe('Druid')
    })
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
    updateSettings({ freeArchetype: false })
    const keys = (level: number) => plannedSlots({ ...base, level }).map((s) => `${s.category}${s.level}`)
    expect(keys(1)).toEqual(['ancestry1', 'class1'])
    expect(keys(3)).toEqual(['ancestry1', 'class1', 'class2', 'skill2', 'general3'])
  })
  it('adds a Free Archetype slot at every even level when enabled', () => {
    updateSettings({ freeArchetype: true })
    expect(plannedSlots({ ...base, level: 5 }).filter((s) => s.category === 'archetype').map((s) => s.level)).toEqual([2, 4])
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
  it('grants Champions their selected deity skill alongside Religion without spending additional picks', () => {
    const champion = entry('class', 'Champion', {
      skill_proficiency: 'Trained in Religion, Trained in one skill determined by your choice of deity, Trained in a number of additional skills equal to 2 plus your Intelligence modifier',
    })
    const divine = [champion, entry('deity', 'Iomedae', { skill: 'Intimidation' }), entry('deity', 'Sarenrae', { skill: 'Medicine' })]
    const c = { ...base, className: 'Champion', background: undefined, deity: 'Iomedae', level: 7 }
    expect(classSkills(champion)).toEqual({ fixed: ['Religion'], choices: [], additional: 2 })
    expect(autoClassSkills(c, divine)).toEqual(['Religion', 'Intimidation'])
    expect(additionalSkillCount(c, divine)).toBe(2)
    for (const enabled of [false, true]) {
      updateSettings({ autoClassSkills: enabled })
      expect(ranksAt(c, divine)).toMatchObject({ Religion: enabled ? 3 : 1, Intimidation: enabled ? 3 : 1 })
    }
    updateSettings({ autoClassSkills: false })
    const changed = { ...c, deity: 'Sarenrae' }
    expect(autoClassSkills(changed, divine)).toEqual(['Religion', 'Medicine'])
    expect(ranksAt(changed, divine).Intimidation).toBeUndefined()
    expect(autoClassSkills({ ...c, deity: undefined }, divine)).toEqual(['Religion'])
    expect(autoClassSkills({ ...base, deity: 'Iomedae' }, [...entries, ...divine])).toEqual(['Arcana'])
    expect(autoClassSkills(c, [champion, entry('deity', 'Iomedae', { skill: 'Religion' })])).toEqual(['Religion'])
  })

  it('parses class skills', () => {
    expect(classSkills(entries.find((e) => e.kind === 'class' && e.name === 'Wizard'))).toMatchObject({ fixed: ['Arcana'], additional: 2 })
  })
  it('ignores choice lines', () => {
    const k = entry('class', 'Fighter', { skill_proficiency: 'Trained in your choice of Acrobatics or Athletics, Trained in a number of additional skills equal to 3 plus your Intelligence modifier' })
    expect(classSkills(k)).toMatchObject({ fixed: [], additional: 3 })
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
    expect(classSkills(ranger)).toMatchObject({ fixed: [], additional: 4 })
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

  it('finds archetype feats whose Dedication is missing', () => {
    const data = [
      entry('feat', 'Archaeologist Dedication', { archetype: 'Archaeologist' }, 2, ['Archetype', 'Dedication']),
      entry('feat', 'Scholastic Identification', { archetype: 'Archaeologist' }, 4, ['Archetype', 'Skill']),
    ]
    const feat = (name: string) => ({ name, type: 'Skill Feat', level: 4 })
    expect(orphanedArchetypeFeats({ ...base, feats: [feat('Scholastic Identification')] }, data).map((f) => f.name)).toEqual(['Scholastic Identification'])
    expect(orphanedArchetypeFeats({ ...base, feats: [feat('Archaeologist Dedication'), feat('Scholastic Identification')] }, data)).toEqual([])
  })

  it('lets a house-rule Dedication level keep an extra level 2 Dedication slot', () => {
    updateSettings({ freeArchetype: true, rangerSnarecrafter: true })
    const ranger = { ...base, className: 'Ranger', level: 2, extraSlots: [{ category: 'archetype' as const, level: 2, count: 1 }] }
    expect(plannedSlots(ranger).filter((s) => s.category === 'archetype').map((s) => s.key)).toEqual(['archetype:2:0', 'archetype:2:g99'])
    updateSettings({ rangerSnarecrafter: false })
  })

  it('gives druids focus spells from their order and Order Magic', () => {
    const feat = (name: string, choice?: string) => ({ name, type: 'Class Feat', level: 4, choice })
    const druid = { ...base, className: 'Druid', order: 'Leaf', feats: [feat('Order Explorer', 'Storm'), feat('Order Magic')] }
    expect(focusSpells(druid, []).spells.map((s) => s.name)).toEqual(['Goodberry'])
    expect(orderMagicOptions(druid)).toEqual(['Storm'])
    const chosen = { ...druid, feats: [feat('Order Explorer', 'Storm'), feat('Order Magic', 'Storm')] }
    expect(focusSpells(chosen, []).spells.map((s) => s.name)).toEqual(['Goodberry', 'Tempest Surge'])
    expect(focusSpells({ ...chosen, className: 'Ranger' }, []).spells).toEqual([])
  })

  it('adds feat-granted focus spells, order-specific advanced spells and focus points', () => {
    const feat = (name: string, data: Record<string, string>) => ({ id: name, kind: 'feat' as const, name, data } as never)
    const entries = [feat('Wild Shape', { grants_focus_spells: 'wild shape' }), feat('Advanced Elemental Spell', { grants_order_spells: 'flame:combustion, stone:stone lance' }), feat('Hedge Prison', { grants_focus_spells: 'hedge prison', grants_focus_point: 'yes' })]
    const f = (name: string) => ({ name, type: 'Class Feat', level: 6 })
    const druid = { ...base, className: 'Druid', order: 'Flame', feats: [f('Wild Shape'), f('Advanced Elemental Spell'), f('Hedge Prison')] }
    const r = focusSpells(druid, entries)
    expect(r.spells.map((s) => s.name)).toEqual(['Combustion', 'Hedge Prison', 'Wild Shape', 'Wildfire'])
    expect(r.points).toBe(2)
  })

  it('finds feats stranded in slots that no longer exist', () => {
    updateSettings({ freeArchetype: true, rangerSnarecrafter: true })
    const ranger = { ...base, className: 'Ranger', level: 2 }
    const stranded = { name: 'Archaeologist Dedication', type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' }
    expect(unslottedFeats({ ...ranger, feats: [stranded] })).toEqual([stranded])
    expect(unslottedFeats({ ...ranger, level: 1, feats: [stranded] })).toEqual([])
    updateSettings({ rangerSnarecrafter: false })
    expect(unslottedFeats({ ...ranger, feats: [stranded] })).toEqual([])
  })

  it('applies Fleet, Incredible Initiative and Canny Acumen', () => {
    const feat = (name: string, choice?: string) => ({ name, type: 'General Feat', level: 3, choice })
    const data = [...entries, entry('ancestry', 'Zephyr', { speed: 30 })]
    const c = { ...base, ancestry: 'Zephyr', level: 3 }
    expect(speed(c, data)).toBe(30)
    expect(speed({ ...c, feats: [feat('Fleet')] }, data)).toBe(35)
    expect(initiativeBonus({ ...c, feats: [feat('Incredible Initiative')] }, data) - initiativeBonus(c, data)).toBe(2)
    expect(ranksAt({ ...c, feats: [feat('Canny Acumen', 'Will')] }, data).Will).toBe(2)
    expect(ranksAt({ ...c, level: 17, feats: [feat('Canny Acumen', 'Will')] }, data).Will).toBe(3)
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

describe('isMagicItem', () => {
  it('treats specific/leveled PF2e items and magical-trait items as magic, not bases', () => {
    expect(isMagicItem(entry('weapon', 'Fractal Hook', {}, 12))).toBe(true)
    expect(isMagicItem(entry('armor', 'Some Armor', {}, 1, ['Magical']))).toBe(true)
    expect(isMagicItem(entry('weapon', 'Longsword', {}, 0))).toBe(false)
    expect(isMagicItem(entry('weapon', 'Composite Longbow', { weapon_category: 'Martial', item_subcategory: 'Base Weapons' }, 1))).toBe(false)
  })
})

describe('languageAllowance', () => {
  it('locks Common, ancestry and class languages and counts 1 + Int and Multilingual', () => {
    const list = [entry('ancestry', 'Elf', { language: 'Common, Elven' })]
    const c = { ...base, ancestry: 'Elf', className: 'Druid', abilities: { ...base.abilities, int: 14 }, feats: [{ name: 'Multilingual', type: 'General Feat', level: 1 }] }
    expect(languageAllowance(c, list)).toMatchObject({ locked: ['Common', 'Elven', 'Wildsong'], slots: 5 })
  })
})

describe('languageGroups', () => {
  it('groups synced AoN languages by rarity in order and falls back when none are synced', () => {
    const synced = [entry('language', 'Wildsong', { rarity: 'Secret' }), entry('language', 'Elven', { rarity: 'Common' }), entry('language', 'Aklo', { rarity: 'Uncommon' }), entry('language', 'Sussuran', { rarity: 'Secret' })]
    expect(Object.keys(languageGroups(synced))).toEqual(['Common', 'Rare', 'Secret', 'Uncommon'])
    expect(languageGroups(synced).Secret.map(([n]) => n)).toEqual(['Wildsong'])
    expect(Object.keys(languageGroups([]))).toContain('Rare')
  })
})

describe('automatic class skill training', () => {
  const druid = entry('class', 'Druid', { skill_proficiency: 'Trained in Nature, Trained in a number of additional skills equal to 2 plus your Intelligence modifier' })
  const c = { ...base, className: 'Druid', order: 'Animal' }

  it('trains class and druidic order skills, and ranks them up with level only under the house rule', () => {
    expect(ranksAt({ ...c, level: 7 }, [druid])).toMatchObject({ Nature: 1, Athletics: 1 })
    updateSettings({ autoClassSkills: true })
    try {
      expect(ranksAt(c, [druid])).toMatchObject({ Nature: 1, Athletics: 1 })
      expect(ranksAt({ ...c, level: 3 }, [druid])).toMatchObject({ Nature: 2, Athletics: 2 })
      expect(ranksAt({ ...c, level: 6 }, [druid])).toMatchObject({ Nature: 2, Athletics: 2 })
      expect(ranksAt({ ...c, level: 7 }, [druid])).toMatchObject({ Nature: 3, Athletics: 3 })
      expect(ranksAt({ ...c, level: 15 }, [druid])).toMatchObject({ Nature: 4, Athletics: 4 })
    } finally {
      updateSettings({ autoClassSkills: false })
    }
  })
})

describe('class skill choice', () => {
  it('auto-trains the picked skill only', () => {
    const fighter = entry('class', 'Fighter', { skill_proficiency: 'Trained in your choice of Acrobatics or Athletics, Trained in a number of additional skills equal to 3 plus your Intelligence modifier' })
    expect(classSkills(fighter).choices).toEqual(['Acrobatics', 'Athletics'])
    const c = { ...base, className: 'Fighter', classSkill: 'Athletics' }
    expect(ranksAt(c, [fighter]).Athletics).toBe(1)
    expect(ranksAt(c, [fighter]).Acrobatics ?? 0).toBe(0)
  })
})

describe('Order Explorer', () => {
  it('trains the second order skill', () => {
    const druid = entry('class', 'Druid', { skill_proficiency: 'Trained in Nature' })
    const c = { ...base, className: 'Druid', order: 'Animal', feats: [{ name: 'Order Explorer', type: 'class', level: 2, choice: 'Storm' }] }
    expect(ranksAt(c, [druid])).toMatchObject({ Athletics: 1, Acrobatics: 1 })
  })
})

describe('auto-advance lores', () => {
  it('ranks background lore up with level only when enabled', () => {
    const bg = entry('background', 'Scholar', { skill: 'Academia Lore' })
    const c = { ...base, level: 7, background: 'Scholar' }
    expect(ranksAt(c, [bg])['Academia Lore']).toBe(1)
    updateSettings({ autoLores: true })
    try { expect(ranksAt(c, [bg])['Academia Lore']).toBe(3) } finally { updateSettings({ autoLores: false }) }
  })
})

describe('deity cleric spells', () => {
  it('parses spells by rank from a deity page', () => {
    const md = '**Cleric Spells**\n\n- **1st**\n[Summon Animal](/Spells.aspx?ID=1694)\n\n- **2nd**\n[Speak with Animals](/Spells.aspx?ID=1680)\n\n</column>'
    expect(parseClericSpells(md)).toBe('1st: Summon Animal; 2nd: Speak with Animals')
  })
})

describe('deity description', () => {
  it('keeps every paragraph before the category block', () => {
    const md = '<title>x</title>\n**Source** [Book](/S.aspx?ID=1) pg. 2\n\nFirst paragraph.\n\n Second [para](/x).\n\n<column gap="tiny">\n**Category** y'
    expect(parseDeityAbout(md)).toBe('First paragraph.\n\nSecond para.')
  })
})

describe('feat grants', () => {
  it('reads languages a feat teaches its taker but not its allies', () => {
    const md = 'You speak and understand [Fey](/Languages.aspx?ID=119), gain darkvision. In addition, they can speak and understand [Sylvan](/Languages.aspx?ID=1).'
    expect(parseFeatLanguages(md)).toBe('Fey')
  })
  it('adds feat languages to the locked languages', () => {
    const feat = entry('feat', 'Wild Hunter Dedication', { grants_languages: 'Fey' })
    const fey = entry('language', 'Fey', { rarity: 'Common' })
    const c = { ...base, feats: [{ name: 'Wild Hunter Dedication', type: 'Archetype Feat', level: 8 }] }
    expect(languageAllowance(c, [feat, fey]).locked).toContain('Fey')
    expect(languageAllowance(c, [feat, fey]).sources.fey).toBe('Wild Hunter Dedication')
  })
  it('shows the worn armor group effect only with a specialization source', () => {
    const wood = { ...entry('armorGroup', 'Wood'), description: 'Source Treasure Vault pg. 9 Wood armor splinters.' }
    const armor = entry('armor', 'Wooden Breastplate', { armor_group: 'Wood' })
    const feat = entry('feat', 'Armor Trick', { grants_armor_specialization: 'yes' })
    const worn = { ...base, armors: [{ id: 'a', name: 'Wooden Breastplate', worn: true, potency: 0, resilient: 0, runes: [] }] } as Character
    expect(armorSpecialization(worn, [wood, armor, feat])).toBeUndefined()
    const withFeat = { ...worn, feats: [{ name: 'Armor Trick', type: 'General Feat', level: 1 }] }
    expect(armorSpecialization(withFeat, [wood, armor, feat])).toMatchObject({ group: 'Wood', effect: 'Wood armor splinters.' })
  })
})

describe('feat-granted slots', () => {
  it('adds a general feat slot while General Training is taken', () => {
    const c = { ...base, level: 1, feats: [{ name: 'General Training', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
    expect(plannedSlots(c).filter((s) => s.category === 'general').map((s) => s.key)).toEqual(['general:1:g0'])
    expect(plannedSlots({ ...c, feats: [] }).some((s) => s.category === 'general')).toBe(false)
  })

  it('places Advanced General Training at its selected level while keeping its level-7 limit and saved key', () => {
    for (const level of [9, 13]) {
      const c = { ...base, level, feats: [{ name: 'Advanced General Training', type: 'Ancestry Feat', level: 13, slot: `ancestry:${level}:0` }] }
      const slot = plannedSlots(c).find((s) => s.key === 'general:7:g2')!
      expect(slot).toMatchObject({ level, maxFeatLevel: 7 })
      const feats = [entry('feat', 'Eligible', {}, 7), entry('feat', 'Too high', {}, 8)]
        .map((feat) => ({ ...feat, traits: ['General'] }))
      expect(eligibleFeats(feats, c, slot).map((feat) => feat.name)).toEqual(['Eligible'])
      expect(plannedSlots({ ...c, level: level - 1 }).some((s) => s.key === slot.key)).toBe(false)
    }
  })

  it('uses the granting feat level when Advanced General Training has no assigned slot', () => {
    const c = { ...base, level: 13, feats: [{ name: 'Advanced General Training', type: 'Ancestry Feat', level: 13 }] }
    expect(plannedSlots(c).find((s) => s.key === 'general:7:g2')?.level).toBe(13)
  })
})

it('keeps rune levels attached to rune-picker options', () => {
  const runes = [
    entry('item', 'Greater Moonweave', { item_subcategory: 'Weapon Property Runes' }, 8),
    entry('item', 'Major Moonweave', { item_subcategory: 'Weapon Property Runes' }, 17),
  ]
  expect(propertyRunes(runes, 'Weapon')).toEqual([
    { name: 'Moonweave (Greater)', level: 8 },
    { name: 'Moonweave (Major)', level: 17 },
  ])
})

describe('archetype rules', () => {
  it('prevents incompatible steed breeds across class and archetype slots but allows replacing the current breed', () => {
    const dedication = entry('feat', 'Cavalier Dedication', { archetype: 'Cavalier' }, 2, ['Archetype', 'Dedication'])
    const breeds = ['Chiardmar Steed', 'Nidarrmar Steed'].map((name) =>
      entry('feat', name, { archetype: 'Cavalier', archetype_levels: 'Cavalier:8' }, 6, ['Champion']))
    const data = [dedication, ...breeds]
    for (const [index, chosen] of breeds.entries()) {
      const incompatible = breeds[1 - index]
      const c: Character = {
        ...base, className: 'Champion', level: 8, companions: [{ id: 'horse', type: 'Horse', name: '' }],
        feats: [
          { name: dedication.name, type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' },
          { name: chosen.name, type: 'Class Feat', level: 6, slot: 'class:6:0' },
        ],
      }
      expect(eligibleFeats(data, c, { key: 'archetype:8:0', category: 'archetype', level: 8 })).not.toContain(incompatible)
      expect(eligibleFeats(data, c, { key: 'class:8:0', category: 'class', level: 8 })).not.toContain(incompatible)
      expect(eligibleFeats(data, c, { key: 'class:6:0', category: 'class', level: 6 })).toEqual(breeds)
      expect(eligibleFeats(data, { ...c, feats: c.feats.slice(0, 1) }, { key: 'archetype:8:0', category: 'archetype', level: 8 })).toEqual(breeds)
      for (const companions of [[], [{ id: 'wolf', type: 'Sarkorian Direwolf', name: 'Horse' }]]) {
        expect(eligibleFeats(data, { ...c, companions }, { key: 'class:6:0', category: 'class', level: 6 })).toEqual([])
      }
    }
  })

  const ded = entry('feat', 'Wild Hunter Dedication', { archetype: 'Wild Hunter' }, 2, ['Archetype', 'Dedication'])
  const other = entry('feat', 'Living Weapon', { archetype: 'Wild Hunter' }, 2, ['Archetype'])
  const ded2 = entry('feat', 'Medic Dedication', { archetype: 'Medic' }, 2, ['Archetype', 'Dedication'])
  const slot = { key: 'archetype:4:0', category: 'archetype' as const, level: 4 }
  const has = (...names: string[]) => ({ ...base, level: 4, feats: names.map((name, i) => ({ name, type: 'Dedication Feat', level: 2, slot: `archetype:2:${i}` })) })
  const names = (c: Character) => eligibleFeats([ded, other, ded2], c, slot).map((e) => e.name)
  it('needs the Dedication before other archetype feats', () => {
    expect(names(has())).toEqual(['Medic Dedication', 'Wild Hunter Dedication'])
    expect(names(has('Wild Hunter Dedication'))).toEqual(['Living Weapon'])
  })
  it('accepts shared Cavalier feats through either dedication and counts them toward dedication requirements', () => {
    const cavalier = entry('feat', 'Cavalier Dedication', { archetype: 'Cavalier' }, 2, ['Archetype', 'Dedication'])
    const unicorn = entry('feat', 'Unicorn Rider Dedication', { archetype: 'Unicorn Rider' }, 2, ['Archetype', 'Dedication'])
    const shared = entry('feat', 'Defend Mount', { archetype: 'Cavalier, Unicorn Rider' }, 6, ['Archetype'])
    const charge = entry('feat', "Cavalier's Charge", { archetype: 'Cavalier, Unicorn Rider' }, 4, ['Archetype'])
    const data = [cavalier, unicorn, shared, charge, ded2]
    const target = { key: 'archetype:6:0', category: 'archetype' as const, level: 6 }
    for (const dedication of [cavalier, unicorn]) {
      const c = { ...has(dedication.name), level: 6 }
      expect(eligibleFeats(data, c, target).map((feat) => feat.name)).toContain('Defend Mount')
      const chosen = { ...c, feats: [...c.feats, { name: shared.name, type: 'Dedication Feat', level: 6 }] }
      expect(orphanedArchetypeFeats(chosen, data)).toEqual([])
      expect(orphanedArchetypeFeats({ ...chosen, feats: chosen.feats.filter((feat) => feat.name !== dedication.name) }, data).map((feat) => feat.name)).toEqual(['Defend Mount'])
      expect(eligibleFeats(data, chosen, target).map((feat) => feat.name)).not.toContain('Medic Dedication')
      const complete = { ...chosen, feats: [...chosen.feats, { name: charge.name, type: 'Dedication Feat', level: 4 }] }
      expect(eligibleFeats(data, complete, target).map((feat) => feat.name)).toContain('Medic Dedication')
    }
  })
  it('offers additional Cavalier class feats at their archetype level without restricting their normal class access', () => {
    const cavalier = entry('feat', 'Cavalier Dedication', { archetype: 'Cavalier' }, 2, ['Archetype', 'Dedication'])
    const launch = entry('feat', 'Galloping Launch', { archetype: 'Cavalier', archetype_levels: 'Cavalier:6' }, 4, ['Ranger'])
    const data = [cavalier, launch]
    const c = { ...has(cavalier.name), level: 6 }
    expect(eligibleFeats(data, c, { key: 'archetype:4:0', category: 'archetype', level: 4 })).not.toContain(launch)
    expect(eligibleFeats(data, c, { key: 'archetype:6:0', category: 'archetype', level: 6 })).toContain(launch)
    expect(eligibleFeats(data, { ...c, feats: [] }, { key: 'archetype:6:0', category: 'archetype', level: 6 })).not.toContain(launch)
    const ranger: Character = { ...base, className: 'Ranger', level: 4, feats: [{ name: launch.name, type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
    expect(eligibleFeats(data, ranger, { key: 'class:4:0', category: 'class', level: 4 })).toContain(launch)
    expect(orphanedArchetypeFeats(ranger, data)).toEqual([])
    expect(orphanedArchetypeFeats({ ...ranger, feats: [{ ...ranger.feats[0], slot: 'archetype:6:0' }] }, data).map((feat) => feat.name)).toEqual([launch.name])
  })
})

it('allows Canny Acumen only when it improves natural proficiency, excluding its own existing benefit', () => {
  const data = [
    entry('class', 'Druid', { perception_proficiency: 'Trained', will_proficiency: 'Expert', fortitude_proficiency: 'Trained', reflex_proficiency: 'Trained' }),
    entry('class', 'Ranger', { perception_proficiency: 'Expert', will_proficiency: 'Trained', fortitude_proficiency: 'Trained', reflex_proficiency: 'Trained' }),
    { ...entry('classFeature', 'Ranger Expertise', { class: 'Ranger' }, 7), description: 'Your proficiency rank for Perception increases to master.' },
  ]
  const druid: Character = { ...base, className: 'Druid', feats: [{ name: 'Canny Acumen', type: 'General Feat', level: 1, choice: 'Reflex' }] }
  expect(cannyAcumenOptions(druid, data)).toEqual(['Fortitude', 'Perception', 'Reflex'])
  expect(cannyAcumenOptions({ ...base, className: 'Ranger' }, data)).toEqual(['Fortitude', 'Reflex', 'Will'])
  expect(cannyAcumenOptions({ ...base, className: 'Ranger', level: 17 }, data)).not.toContain('Perception')
  expect(cannyAcumenOptions({ ...druid, level: 17 }, data)).toContain('Will')
})

describe('feat grants beyond languages', () => {
  it('adds lores and senses from feats', () => {
    const feat = entry('feat', 'Wild Hunter Dedication', { grants_lore: 'Hunting Lore', grants_vision: 'Darkvision' })
    const c = { ...base, feats: [{ name: 'Wild Hunter Dedication', type: 'Dedication Feat', level: 8 }] }
    expect(featLores(c, [feat])).toEqual(['Hunting Lore'])
    expect(ranksAt(c, [feat])['Hunting Lore']).toBe(1)
    expect(senses(c, [feat])).toEqual([{ value: 'Darkvision', source: 'Wild Hunter Dedication' }])
  })
})

describe('armor specialization from feats', () => {
  it('limits Skins of the Slain to its armor groups and categories', () => {
    const feat = entry('feat', 'Skins Of The Slain', { grants_armor_specialization: 'yes', grants_armor_groups: 'leather, skeletal, wood', grants_armor_categories: 'light, medium' })
    const groups = ['Leather', 'Chain'].map((n) => ({ ...entry('armorGroup', n), description: `${n} effect.` }))
    const armors = [entry('armor', 'Leather Armor', { armor_group: 'Leather', armor_category: 'Light' }), entry('armor', 'Chain Mail', { armor_group: 'Chain', armor_category: 'Medium' })]
    const wear = (name: string) => ({ ...base, feats: [{ name: feat.name, type: 'Archetype Feat', level: 10 }], armors: [{ id: 'a', name, worn: true, potency: 0, resilient: 0, runes: [] }] }) as Character
    const all = [feat, ...groups, ...armors]
    expect(armorSpecialization(wear('Leather Armor'), all)?.group).toBe('Leather')
    expect(armorSpecialization(wear('Chain Mail'), all)).toBeUndefined()
  })
})

describe('homebrew feat rules', () => {
  it('adds a locked Snarecrafter Dedication slot for Rangers at level 2 when enabled', () => {
    const ranger = { ...base, className: 'Ranger', level: 2 }
    updateSettings({ rangerSnarecrafter: true })
    expect(plannedSlots(ranger).some((s) => s.key === 'archetype:2:g99')).toBe(true)
    expect(plannedSlots({ ...ranger, level: 1 }).some((s) => s.key === 'archetype:2:g99')).toBe(false)
    expect(plannedSlots({ ...ranger, className: 'Wizard' }).some((s) => s.key === 'archetype:2:g99')).toBe(false)
    updateSettings({ rangerSnarecrafter: false })
    expect(plannedSlots(ranger).some((s) => s.key === 'archetype:2:g99')).toBe(false)
    updateSettings({ championCavalier: true, druidCavalier: true })
    expect(plannedSlots({ ...ranger, className: 'Champion' }).map((s) => s.key)).toContain('archetype:2:g98')
    expect(plannedSlots({ ...ranger, className: 'Druid' }).map((s) => s.key)).toContain('archetype:2:g97')
    updateSettings({ championCavalier: false, druidCavalier: false })
  })
  it('hides skill feats from General pickers when General Feats Only is on', () => {
    const list = [entry('feat', 'Toughness', {}, 1, ['General']), entry('feat', 'Assurance', {}, 1, ['General', 'Skill'])]
    const slot = { key: 'general:3:0', category: 'general' as const, level: 3 }
    updateSettings({ generalFeatsOnly: true })
    expect(eligibleFeats(list, base, slot).map((e) => e.name)).toEqual(['Toughness'])
    updateSettings({ generalFeatsOnly: false })
    expect(eligibleFeats(list, base, slot).map((e) => e.name)).toEqual(['Assurance', 'Toughness'])
  })
})
