import { describe, expect, it } from 'vitest'
import { eligibleFeats, featPrerequisiteChecker, featSelectionPrerequisiteChecker, featTakenLevel, plannedSlots } from './builder'
import { featPrerequisiteSuggestions } from './featPrerequisites'
import { getSettings, updateSettings } from './settings'
import type { Character, ContentEntry } from './types'

const entry = (kind: ContentEntry['kind'], name: string, data: ContentEntry['data'] = {}, level = 1, traits: string[] = []): ContentEntry =>
  ({ id: `${kind}:${name}`, systems: ['pf2e'], kind, source: 'official', name, data, level, traits, description: '', effects: [], updatedAt: 1 })
const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Prerequisite test', level: 20, className: 'Barbarian', subclass: 'Fury',
  abilities: { str: 14, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const selected = (name: string, level = 1) => ({ name, type: 'Class Feat', level: 1, slot: `class:${level}:0` })
const target = (prerequisite: string) => entry('feat', 'Target', { prerequisite }, 1, ['Barbarian'])
const check = (prerequisite: string, c = base, entries: ContentEntry[] = [], level = c.level) =>
  featPrerequisiteChecker(c, entries, level)(target(prerequisite))

it('suggests exact General and Skill feat prerequisites for this class and ancestry without confusing longer feat names', () => {
  const titan = entry('feat', 'Titan Wrestler', {}, 1, ['General', 'Skill'])
  const diehard = entry('feat', 'Diehard', {}, 1, ['General'])
  const advanced = entry('feat', 'Greater Titan Wrestler', {}, 8, ['Fighter'])
  const data = [
    titan, diehard, advanced,
    entry('feat', 'The Harder They Fall (Ranger)', { prerequisite: 'Titan Wrestler' }, 8, ['Ranger']),
    entry('feat', 'Ancestral Resolve', { prerequisite: 'Diehard; expert in Survival' }, 9, ['Human']),
    entry('feat', 'Adopted Resolve', { prerequisite: 'Diehard' }, 9, ['Dwarf']),
    entry('feat', 'Other Class', { prerequisite: 'Titan Wrestler' }, 8, ['Rogue']),
    entry('feat', 'Not the Same Prerequisite', { prerequisite: advanced.name }, 10, ['Ranger']),
    { ...entry('feat', 'Deleted', { prerequisite: 'Titan Wrestler' }, 1, ['Ranger']), deleted: true },
    entry('feat', 'Descriptive Mention', {}, 1, ['Ranger']),
  ]
  data[data.length - 1].description = 'Titan Wrestler is useful but not required.'
  const context = { className: 'Ranger', ancestryTraits: ['Human'] }
  const suggestions = featPrerequisiteSuggestions(data, context)
  expect(suggestions.get(titan.name)).toEqual(['The Harder They Fall (Ranger)'])
  expect(suggestions.get(diehard.name)).toEqual(['Ancestral Resolve'])
  expect(suggestions.has(advanced.name)).toBe(false)
  expect(featPrerequisiteSuggestions(data, { ...context, ancestryTraits: ['Dwarf'] }).get(diehard.name)).toEqual(['Adopted Resolve'])
  expect(featPrerequisiteSuggestions(data, { ...context, className: 'Rogue' }).get(titan.name)).toEqual(['Other Class'])
  expect(featPrerequisiteSuggestions(data, { ...context, knownFeats: ['Titan Wrestler'] }).has(titan.name)).toBe(false)
})

describe('shared prerequisite enforcement', () => {
  it.each([
    ['Ranger', 'Snarecrafter Dedication', 'Snarecrafter', 'rangerSnarecrafter', 'archetype:2:g99'],
    ['Champion', 'Cavalier Dedication', 'Cavalier', 'championCavalier', 'archetype:2:g98'],
    ['Druid', 'Cavalier Dedication', 'Cavalier', 'druidCavalier', 'archetype:2:g97'],
  ] as const)('exempts only the active locked %s dedication from the dedication lock', (className, name, archetype, setting, lockedSlot) => {
    const previous = getSettings()[setting]
    const dedication = entry('feat', name, { archetype }, 2, ['Archetype', 'Dedication'])
    const followup = entry('feat', 'Archetype Training', { archetype }, 4, ['Archetype'])
    const medic = entry('feat', 'Medic Dedication', { archetype: 'Medic', prerequisite: 'trained in Medicine' }, 2, ['Archetype', 'Dedication'])
    const wizard = entry('feat', 'Wizard Dedication', { archetype: 'Wizard' }, 2, ['Archetype', 'Dedication'])
    const data = [dedication, followup, medic, wizard]
    const c: Character = { ...base, className, level: 6, skillPicks: ['Medicine'],
      feats: [{ ...selected(name, 2), slot: lockedSlot }] }
    const slot = { key: 'archetype:4:0', category: 'archetype' as const, level: 4 }
    try {
      updateSettings({ [setting]: true })
      expect(featSelectionPrerequisiteChecker(c, data, slot)(medic).missing).toEqual([])
      expect(featSelectionPrerequisiteChecker(c, data, slot)(followup).missing).toEqual([])
      expect(featSelectionPrerequisiteChecker({ ...c, skillPicks: [] }, data, slot)(medic).missing).toContain('trained in Medicine')
      const withMedic = { ...c, feats: [...c.feats, { ...selected(medic.name, 4), slot: 'archetype:4:0' }] }
      expect(featSelectionPrerequisiteChecker(withMedic, data, { ...slot, key: 'archetype:6:0', level: 6 })(wizard).missing)
        .toContain('2 more Medic archetype feats before another dedication')
      expect(featSelectionPrerequisiteChecker({ ...c, feats: [{ ...c.feats[0], slot: 'archetype:2:0' }] }, data, slot)(medic).missing)
        .toContain(`2 more ${archetype} archetype feats before another dedication`)
      updateSettings({ [setting]: false })
      expect(featSelectionPrerequisiteChecker(c, data, slot)(medic).missing)
        .toContain(`2 more ${archetype} archetype feats before another dedication`)
    } finally { updateSettings({ [setting]: previous }) }
  })

  it('requires actual warden spells, specific warden choices, and acquisition-level availability', () => {
    const natural = entry('feat', 'Natural Conduit', { prerequisite: 'warden spells' }, 4, ['Ranger'])
    const strength = entry('feat', 'Animal Strength', { prerequisite: '_animal feature_ warden spell' }, 6, ['Ranger'])
    const gravity = entry('spell', 'Gravity Weapon', { warden_spell_tier: 'Initiate' }, 1, ['Focus', 'Ranger'])
    const animal = entry('spell', 'Animal Feature', { warden_spell_tier: 'Advanced' }, 2, ['Focus', 'Ranger'])
    const data = [natural, strength, gravity, animal, entry('feat', 'Unrelated Focus', { grants_focus_spells: 'Other Spell' })]
    const c: Character = { ...base, className: 'Ranger', level: 8,
      feats: [{ ...selected('Initiate Warden', 1), choice: gravity.name }] }
    expect(featPrerequisiteChecker({ ...c, feats: [] }, data)(natural)).toEqual({ missing: ['warden spells'], manual: [] })
    expect(featPrerequisiteChecker({ ...c, feats: [selected('Unrelated Focus')] }, data)(natural).missing).toEqual(['warden spells'])
    expect(featPrerequisiteChecker(c, data)(natural)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(c, data)(strength)).toEqual({ missing: ['_animal feature_ warden spell'], manual: [] })
    const learned = { ...c, feats: [...c.feats, { ...selected('Advanced Warden', 4), choice: animal.name }] }
    expect(featPrerequisiteChecker(learned, data, 6)(strength)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(learned, data, 3)(strength).missing).toEqual(['_animal feature_ warden spell'])
    expect(featPrerequisiteChecker({ ...c, feats: [selected('Initiate Warden')] }, data)(natural).missing).toEqual(['warden spells'])
  })

  it('enforces animal-companion and bare hunter-edge capabilities instead of treating absent capabilities as manual', () => {
    const companion = target('an animal companion')
    const manifold = target("hunter's edge, masterful hunter")
    const edge = entry('classFeature', "Hunter's Edge", { class: 'Ranger' })
    const hunter = entry('classFeature', 'Masterful Hunter', { class: 'Ranger' }, 17)
    const data = [companion, manifold, edge, hunter]
    const c: Character = { ...base, className: 'Ranger', level: 18 }
    expect(featPrerequisiteChecker(c, data)(companion)).toEqual({ missing: ['an animal companion'], manual: [] })
    expect(featPrerequisiteChecker({ ...c, companions: [{ id: 'bear', name: '', type: 'Bear' }] }, data)(companion)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(c, data)(manifold)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(c, data, 16)(manifold)).toEqual({ missing: ['masterful hunter'], manual: [] })
    expect(featPrerequisiteChecker({ ...c, className: 'Fighter' }, data)(manifold).missing).toEqual(["hunter's edge", 'masterful hunter'])
  })

  it('allows Rangers to substitute Survival only for Snarecrafter archetype Crafting prerequisites, including prerequisite chains', () => {
    const dedication = entry('feat', 'Snarecrafter Dedication', { archetype: 'Snarecrafter', prerequisite: 'trained in Crafting' }, 2, ['Archetype', 'Dedication'])
    const snares = entry('feat', 'Powerful Snares', { archetype: 'Snarecrafter', prerequisite: 'master in Crafting; Snarecrafter Dedication' }, 8, ['Archetype'])
    const unrelated = entry('feat', 'Other Craft', { prerequisite: 'master in Crafting' }, 8, ['Ranger'])
    const data = [dedication, snares, unrelated]
    const c: Character = { ...base, className: 'Ranger', level: 8, rankOverrides: { Survival: 3 },
      feats: [{ ...selected(dedication.name, 2), type: 'Archetype Feat', slot: 'archetype:2:0' }] }
    expect(featPrerequisiteChecker(c, data)(snares)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(c, data)({ ...snares, data: { ...snares.data,
      prerequisite: '[Ranger] master in Crafting; Snarecrafter Dedication' } })).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(c, data)(unrelated).missing).toEqual(['master in Crafting'])
    expect(featPrerequisiteChecker({ ...c, className: 'Fighter' }, data)(snares).missing).toContain('master in Crafting')
    expect(featPrerequisiteChecker({ ...c, rankOverrides: { Survival: 2 } }, data)(snares).missing).toEqual(['master in Crafting'])
    expect(featPrerequisiteChecker({ ...c, feats: [] }, data)(snares).missing).toEqual(['Snarecrafter Dedication'])
  })

  it('grants Multitalented only second-level multiclass dedications, bypassing dedication locks but preserving other prerequisites', () => {
    const cavalier = entry('feat', 'Cavalier Dedication', { archetype: 'Cavalier' }, 2, ['Archetype', 'Dedication'])
    const wizard = entry('feat', 'Wizard Dedication', { archetype: 'Wizard', prerequisite: 'Intelligence +2; trained in Arcana' }, 2,
      ['Archetype', 'Dedication', 'Multiclass'])
    const ownClass = entry('feat', 'Barbarian Dedication', { archetype: 'Barbarian' }, 2, ['Archetype', 'Dedication', 'Multiclass'])
    const medic = entry('feat', 'Medic Dedication', { archetype: 'Medic' }, 2, ['Archetype', 'Dedication'])
    const highLevel = entry('feat', 'High Dedication', { archetype: 'High' }, 4, ['Archetype', 'Dedication', 'Multiclass'])
    const nonDedication = entry('feat', 'Other Archetype Feat', { archetype: 'Wizard' }, 2, ['Archetype', 'Multiclass'])
    const data = [cavalier, wizard, ownClass, medic, highLevel, nonDedication]
    const c: Character = { ...base, level: 9, ancestry: 'Human', skillPicks: ['Arcana'],
      feats: [
        { name: cavalier.name, type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' },
        { name: 'Multitalented', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' },
      ] }
    const slot = plannedSlots(c).find(slot => slot.grantedBy === 'Multitalented')!
    expect(slot).toMatchObject({ category: 'archetype', level: 9, maxFeatLevel: 2 })
    expect(featTakenLevel({ name: wizard.name, type: 'Dedication Feat', level: 2, slot: slot.key })).toBe(9)
    expect(featSelectionPrerequisiteChecker(c, data, slot)(wizard).missing).toEqual(['Intelligence +2'])
    const aiuvarin = { ...c, heritage: 'Aiuvarin' }
    expect(eligibleFeats(data, aiuvarin, slot).map(feat => feat.name)).toEqual([wizard.name])
    expect(featSelectionPrerequisiteChecker({ ...aiuvarin, skillPicks: [] }, data, slot)(wizard).missing).toEqual(['trained in Arcana'])
    const normal = { key: 'archetype:8:0', category: 'archetype' as const, level: 8 }
    expect(featSelectionPrerequisiteChecker(aiuvarin, data, normal)(wizard).missing).toContain('Intelligence +2')
    expect(featSelectionPrerequisiteChecker(aiuvarin, data, normal)(wizard).missing)
      .toContain('2 more Cavalier archetype feats before another dedication')
    expect(eligibleFeats(data, { ...c, abilities: { ...c.abilities, int: 14 } }, slot)).toContain(wizard)
    expect(plannedSlots({ ...c, level: 8 }).some(slot => slot.grantedBy === 'Multitalented')).toBe(false)
    expect(plannedSlots({ ...c, feats: c.feats.slice(0, 1) }).some(slot => slot.grantedBy === 'Multitalented')).toBe(false)
  })

  it('enforces Adapted Cantrip, Adaptive Adept, and Inner Wellspring at selection level', () => {
    const cantrip = entry('feat', 'Adapted Cantrip', { prerequisite: 'spellcasting class feature' }, 1, ['Human'])
    const adept = entry('feat', 'Adaptive Adept', { prerequisite: 'Adapted Cantrip; can cast 3rd-rank spells' }, 5, ['Human'])
    const inner = entry('feat', 'Inner Wellspring', { prerequisite: 'focus pool' }, 13, ['Human'])
    const wizard = entry('class', 'Wizard', { tradition: 'Arcane' })
    const focus = entry('feat', 'Focus Grant', { grants_focus_spells: 'Focus Spell' })
    const mystic = entry('classFeature', 'Mystic Spellcasting', { class: 'Mystic' })
    const data = [cantrip, adept, inner, wizard, focus, mystic]
    const c = { ...base, ancestry: 'Human', level: 13, className: 'Fighter' }
    const first = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
    const fifth = { key: 'ancestry:5:0', category: 'ancestry' as const, level: 5 }
    const thirteenth = { key: 'ancestry:13:0', category: 'ancestry' as const, level: 13 }
    expect(eligibleFeats(data, c, first)).not.toContain(cantrip)
    expect(eligibleFeats(data, { ...c, className: 'Mystic' }, first)).toContain(cantrip)
    expect(eligibleFeats(data, c, thirteenth)).not.toContain(inner)
    expect(eligibleFeats(data, { ...c, feats: [selected('Focus Grant', 2)] }, thirteenth)).toContain(inner)
    const caster = { ...c, className: 'Wizard', feats: [{ ...selected('Adapted Cantrip', 1), slot: 'ancestry:1:0' }] }
    expect(eligibleFeats(data, caster, fifth)).toContain(adept)
    expect(featPrerequisiteChecker(caster, data, 4)(adept).missing).toContain('can cast 3rd-rank spells')
    expect(eligibleFeats(data, { ...caster, feats: [] }, fifth)).not.toContain(adept)
    expect(eligibleFeats(data, { ...caster, className: 'Fighter' }, fifth)).not.toContain(adept)
    expect(check('can cast 3rd-level spells', caster, data, 5).missing).toEqual([])
  })
  it.each([['Gloomseer', 'Nidalese'], ['Dragon Spit', 'Tian-Dan'], ['Wavetouched Paragon', 'Bonuwat']])('enforces %s ethnicity as a prerequisite, not overridable access', (name, ethnicity) => {
    const feat = entry('feat', name, { prerequisite: `${ethnicity} ethnicity` }, 1, ['Human'])
    const c: Character = { ...base, level: 1, ancestry: 'Human', featAccessOverrides: [feat.id] }
    const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
    for (const ethnicity of [undefined, 'Kellid']) {
      const character = { ...c, ethnicity }
      expect(featSelectionPrerequisiteChecker(character, [feat], slot)(feat)).toEqual({ missing: [String(feat.data.prerequisite)], manual: [] })
      expect(eligibleFeats([feat], character, slot)).not.toContain(feat)
    }
    expect(featSelectionPrerequisiteChecker({ ...c, ethnicity: ethnicity.toLowerCase() }, [feat], slot)(feat)).toEqual({ missing: [], manual: [] })
    expect(eligibleFeats([feat], { ...c, ethnicity }, slot)).toContain(feat)
    expect(check(`${ethnicity} ethnicity or Kellid ethnicity`, { ...c, ethnicity: 'Kellid' })).toEqual({ missing: [], manual: [] })
  })

  it('combines ethnicity alternatives with other required prerequisites', () => {
    const alternatives = 'Garundi ethnicity, Mauxi ethnicity, or Tian-Yae ethnicity'
    expect(check(alternatives, { ...base, ethnicity: 'Mauxi' })).toEqual({ missing: [], manual: [] })
    expect(check(alternatives, { ...base, ethnicity: 'Kellid' })).toEqual({ missing: [alternatives], manual: [] })
    expect(check('Nidalese ethnicity; Strength +3', { ...base, ethnicity: 'Nidalese' })).toEqual({ missing: ['Strength +3'], manual: [] })
    expect(check('Nidalese ethnicity; Strength +3', { ...base, ethnicity: 'Kellid', abilities: { ...base.abilities, str: 16 } }))
      .toEqual({ missing: ['Nidalese ethnicity'], manual: [] })
  })

  it('explains dedication locks while allowing pickers to include unmet options', () => {
    const dedication = entry('feat', 'Cavalier Dedication', { archetype: 'Cavalier' }, 2, ['Archetype', 'Dedication'])
    const other = entry('feat', 'Defend Mount', { archetype: 'Cavalier' }, 4, ['Archetype'])
    const medic = entry('feat', 'Medic Dedication', { archetype: 'Medic' }, 2, ['Archetype', 'Dedication'])
    const c: Character = { ...base, level: 6, feats: [selected(dedication.name, 2), selected(other.name, 4)] }
    const data = [dedication, other, medic]
    const slot = { key: 'archetype:6:0', category: 'archetype' as const, level: 6 }
    expect(featSelectionPrerequisiteChecker(c, data, slot)(medic).missing).toEqual(['1 more Cavalier archetype feat before another dedication'])
    expect(eligibleFeats(data, c, slot)).not.toContain(medic)
    expect(eligibleFeats(data, c, slot, { includeUnmetPrerequisites: true })).toContain(medic)
  })

  it('explains required companion types without leaving a redundant manual warning', () => {
    const steed = entry('feat', 'Chiardmar Steed', { prerequisite: 'horse animal companion' }, 6, ['Ranger'])
    const c: Character = { ...base, className: 'Ranger', level: 6 }
    const slot = { key: 'class:6:0', category: 'class' as const, level: 6 }
    expect(featSelectionPrerequisiteChecker(c, [steed], slot)(steed)).toEqual({ missing: ['horse animal companion'], manual: [] })
    expect(featSelectionPrerequisiteChecker({ ...c, companions: [{ id: 'horse', type: 'Horse', name: 'Horse' }] }, [steed], slot)(steed))
      .toEqual({ missing: [], manual: [] })
    expect(eligibleFeats([steed], c, slot, { includeUnmetPrerequisites: true })).toContain(steed)
  })

  it('enforces feat chains, their instinct prerequisites, selection levels, and self-exclusion', () => {
    const giant = entry('subclass', 'Giant', { class: 'Barbarian' })
    const parent = entry('feat', "Giant's Stature", { prerequisite: 'Giant instinct' }, 6, ['Barbarian'])
    const child = entry('feat', "Titan's Stature", { prerequisite: "Giant's Stature" }, 12, ['Barbarian'])
    const data = [giant, parent, child]
    const slot = { key: 'class:12:0', category: 'class' as const, level: 12 }
    const c = { ...base, subclass: 'Giant', feats: [selected(parent.name, 6)] }
    expect(eligibleFeats(data, base, slot)).not.toContain(child)
    expect(eligibleFeats(data, c, slot)).toContain(child)
    expect(eligibleFeats(data, { ...c, subclass: 'Fury' }, slot)).not.toContain(child)
    expect(eligibleFeats(data, { ...c, feats: [selected(parent.name, 14)] }, slot)).not.toContain(child)
    expect(featPrerequisiteChecker(c, data, 12, 0)(child).missing).toEqual([parent.name])
    expect(c.feats).toEqual([selected(parent.name, 6)])
  })

  it.each([
    ['Barbarian', 'Animal', 'instinct'], ['Bard', 'Maestro', 'muse'],
    ['Cleric', 'Warpriest', 'doctrine'], ['Rogue', 'Ruffian', 'racket'],
    ['Sorcerer', 'Angelic', 'bloodline'], ['Witch', 'Resentment', 'patron'],
    ['Alchemist', 'Bomber', 'research field'], ['Champion', 'Justice', 'cause'],
    ['Oracle', 'Battle', 'mystery'], ['Investigator', 'Empiricism', 'methodology'],
    ['Inventor', 'Armor', 'innovation'], ['Gunslinger', 'Pistolero', 'way'],
    ['Magus', 'Laughing Shadow', 'hybrid study'], ['Psychic', 'The Tangible Dream', 'conscious mind'],
    ['Animist', 'Medium', 'practice'], ['Summoner', 'Dragon', 'eidolon'],
    ['Swashbuckler', 'Fencer', 'style'], ['Wizard', 'School of Battle Magic', 'arcane school'],
    ['Ranger', 'Precision', "hunter's edge"],
  ])('checks %s specialization requirements using the same evaluator', (className, subclass, role) => {
    const data = [entry('subclass', subclass, { class: className })]
    const prerequisite = `${subclass} ${role}`
    expect(check(prerequisite, { ...base, className, subclass }, data)).toEqual({ missing: [], manual: [] })
    expect(check(prerequisite, { ...base, className, subclass: 'Other' }, data).missing).toEqual([prerequisite])
  })

  it('recognizes additional druid orders, Untamed/Wild naming, and class-qualified prerequisites', () => {
    const c = { ...base, className: 'Druid', order: 'Storm', subclass: undefined,
      feats: [{ ...selected('Order Explorer', 2), choice: 'Wild' }] }
    expect(check('animal instinct or untamed order', c, [entry('subclass', 'Animal', { class: 'Barbarian' })])).toEqual({ missing: [], manual: [] })
    expect(check('animal order', c).missing).toEqual(['animal order'])
    expect(check('[Druid] animal order', { ...c, order: 'Animal' }).missing).toEqual([])
    expect(check('[Druid] animal order', { ...base, className: 'Ranger' }).missing).toEqual([])
    expect(check('[Druid] animal order', c).missing).toEqual(['animal order'])
  })

  it('counts automatic muse feats, additional muses, animal-order companions, and modeled spellcasting', () => {
    const muse = { ...entry('subclass', 'Maestro', { class: 'Bard' }),
      description: 'Muse Feat Lingering Composition\n\nMuse Spell soothe' }
    const enigma = entry('subclass', 'Enigma', { class: 'Bard' })
    const data = [muse, enigma, entry('feat', 'Lingering Composition'), entry('feat', 'Animal Companion'),
      entry('class', 'Bard', { tradition: 'Occult' })]
    const bard: Character = { ...base, className: 'Bard', subclass: 'Enigma',
      feats: [{ ...selected('Multifarious Muse', 2), choice: 'Maestro' }] }
    expect(check('maestro muse; Lingering Composition; spellcasting class feature', bard, data))
      .toEqual({ missing: [], manual: [] })
    expect(check('Lingering Composition', { ...bard, feats: [] }, data).missing).toHaveLength(1)
    expect(check('Animal Companion', { ...base, className: 'Druid', order: 'Animal' }, data)).toEqual({ missing: [], manual: [] })
    expect(check('ability to cast spells', bard, data)).toEqual({ missing: [], manual: [] })
  })

  it.each([
    ['pf2e', 'Lizardfolk', 'Cloudleaper Lizardfolk', 'Iruxi Glide'],
    ['pf2e', 'Tengu', 'Wavediver Tengu', 'Waxed Feathers'],
    ['pf2e', 'Leshy', 'Pine Leshy', 'Towering Growth'],
    ['sf2e', 'Vesk', 'Fork-Tongued Vesk', 'Venomous Cocktail'],
    ['sf2e', 'Lashunta', 'Damaya Lashunta', 'Psychic Scholar'],
    ['sf2e', 'Android', 'Hellforged Android', 'Hardened Plates'],
  ] as const)('checks %s %s ancestry feat heritage prerequisites', (system, ancestry, heritage, name) => {
    const data = [
      { ...entry('heritage', heritage), systems: [system] },
      { ...entry('feat', name, { prerequisite: `${heritage} heritage` }, 1, [ancestry]), systems: [system] },
    ]
    const c: Character = { ...base, systems: [system], ancestry, heritage }
    const slot = { key: 'ancestry:5:0', category: 'ancestry' as const, level: 5 }
    expect(eligibleFeats(data, c, slot)).toContain(data[1])
    expect(eligibleFeats(data, { ...c, heritage: 'Different heritage' }, slot)).not.toContain(data[1])
    expect(eligibleFeats(data, { ...c, ancestry: 'Human' }, slot)).not.toContain(data[1])
  })

  it('handles AND, OR, parentheses, Oxford lists, and inherited rank or specialization wording', () => {
    const data = [entry('feat', 'Cleave'), entry('feat', 'Knockback'), entry('feat', 'Thrash'),
      ...['Armor', 'Construct', 'Weapon'].map((name) => entry('subclass', name, { class: 'Inventor' }))]
    const c = { ...base, skillPicks: ['Athletics', 'Nature'], feats: [selected('Cleave')],
      skillIncreases: { 3: 'Athletics', 5: 'Nature' } }
    expect(check('Cleave; (Knockback or Thrash)', c, data).missing).toEqual(['Knockback or Thrash'])
    expect(check('Cleave or Knockback', c, data).missing).toEqual([])
    expect(check('Cleave; expert in Athletics and Nature', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('Trained in Arcana, Occultism, or Religion', c, data).missing).toHaveLength(1)
    expect(check('Trained in Arcana, Nature, Occultism, or Religion', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('armor, construct, or weapon innovation', { ...base, className: 'Inventor', subclass: 'Armor' }, data)).toEqual({ missing: [], manual: [] })
    expect(check('armor, construct, or weapon innovation', { ...base, className: 'Inventor', subclass: 'Other' }, data).missing).toHaveLength(1)
  })

  it('does not split conjunctions or commas inside known feat names', () => {
    const names = ['Come and Get Me', 'Poisoned Sticks and Stones', 'Ready, Set, Go']
    const data = names.map((name) => entry('feat', name))
    const c = { ...base, feats: names.map((name, i) => selected(name, i + 1)) }
    expect(check('Come and Get Me; Poisoned Sticks and Stones', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('Come and Get Me and Ready, Set, Go', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('Come and Get Me and Ready, Set, Go', { ...c, feats: [c.feats[0]] }, data).missing).toEqual(['Ready, Set, Go'])
  })

  it.each([
    ['Trained in Medicine or Tian Xia Lore', 'Medicine', 'Tian Xia Lore', 1],
    ['Expert in Crafting or Cooking Lore', 'Crafting', 'Cooking Lore', 2],
    ['Expert in Religion or Expert in Undead Lore', 'Religion', 'Undead Lore', 2],
    ['Master in Crafting, Master in Medicine, or Herbalism Lore', 'Medicine', 'Herbalism Lore', 3],
  ] as const)('accepts either qualified skill in %s without treating the whole expression as a Lore name', (prerequisite, skill, lore, rank) => {
    const c: Character = { ...base, skillPicks: [skill],
      skillIncreases: Object.fromEntries([3, 7].slice(0, rank - 1).map((level) => [level, skill])) }
    expect(check(prerequisite, c)).toEqual({ missing: [], manual: [] })
    expect(check(prerequisite, { ...base, lores: [{ name: lore, rank }] })).toEqual({ missing: [], manual: [] })
    expect(check(prerequisite).missing).toHaveLength(1)
  })

  it('resolves named ancestry feat prerequisites using their ancestry source rather than another same-named feat', () => {
    const ancestry = entry('feat', 'Draconic Scent', {}, 1, ['Dragonblood'])
    const archetype = { ...entry('feat', 'Draconic Scent', { prerequisite: 'Dragon Disciple Dedication' }, 1, ['Archetype']),
      id: 'archetype:scent' }
    const c: Character = { ...base, ancestry: 'Human', heritage: 'Dragonblood',
      feats: [{ ...selected('Draconic Scent'), type: 'Ancestry Feat', slot: 'ancestry:1:0' }] }
    expect(check('Draconic Scent', c, [archetype, ancestry, entry('feat', 'Dragon Disciple Dedication')]))
      .toEqual({ missing: [], manual: [] })
  })

  it('allows ancestry feats granted by a versatile heritage without granting access to other heritages', () => {
    const feat = entry('feat', 'Draconic Scent', {}, 1, ['Dragonblood'])
    const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
    expect(eligibleFeats([feat], { ...base, ancestry: 'Human', heritage: 'Dragonblood' }, slot)).toContain(feat)
    expect(eligibleFeats([feat], { ...base, ancestry: 'Human', heritage: 'Aiuvarin' }, slot)).not.toContain(feat)
  })

  it('uses level-appropriate skill ranks, abilities, class features, and background-granted feats', () => {
    const c: Character = { ...base, skillPicks: ['Athletics'], skillIncreases: { 3: 'Athletics', 7: 'Athletics' } }
    expect(check('master in Athletics', c, [], 6).missing).toHaveLength(1)
    expect(check('master in Athletics', c, [], 7).missing).toHaveLength(0)
    expect(check('Strength +2; Dexterity 12', c).missing).toEqual([])
    expect(check('Intelligence +1', c).missing).toEqual(['Intelligence +1'])
    const data = [entry('classFeature', 'Weapon Specialization', { class: 'Barbarian' }, 7),
      entry('feat', 'Shield Block'), entry('background', 'Guard', { feat: 'Shield Block' })]
    expect(check('weapon specialization', c, data, 6).missing).toHaveLength(1)
    expect(check('weapon specialization', c, data, 7).missing).toHaveLength(0)
    expect(check('Shield Block', { ...c, background: 'Guard' }, data)).toEqual({ missing: [], manual: [] })
  })

  it('checks armor, weapons, saves, Lore, and senses without treating unknown qualifications as satisfied', () => {
    const klass = entry('class', 'Barbarian', {
      attack_proficiency: 'Trained in martial weapons', defense_proficiency: 'Trained in medium armor',
      fortitude_proficiency: 'Expert',
    })
    const c = { ...base, ancestry: 'Elf', lores: [{ name: 'Warfare Lore', rank: 3 }] }
    const data = [klass, entry('ancestry', 'Elf', { vision: 'Low-Light Vision' })]
    expect(check('trained in medium armor and martial weapons; expert in Fortitude saves', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('master in one or more Lore skills', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('trained in Astrology Lore or trained in Occultism', c, data).missing).toHaveLength(1)
    expect(check('low-light vision or scent', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('you have permanent wings', c, data)).toEqual({ missing: [], manual: ['you have permanent wings'] })
    expect(check('trained in a skill with the Recall Knowledge action', c, data).manual).toHaveLength(1)
    expect(check('Cleave or a special blessing from your GM', c, [...data, entry('feat', 'Cleave')]))
      .toEqual({ missing: [], manual: ['Cleave or a special blessing from your GM'] })
  })

  it('reports cyclic dependencies and ambiguous source versions rather than accepting them', () => {
    const a = entry('feat', 'First', { prerequisite: 'Second' })
    const b = entry('feat', 'Second', { prerequisite: 'First' })
    const c = { ...base, feats: [selected('First'), selected('Second')] }
    expect(check('First', c, [a, b]).missing.join()).toContain('Circular prerequisite')
    const variant = { ...a, id: 'variant', data: { prerequisite: 'Third' } }
    expect(check('First', c, [a, variant]).manual).toEqual(['Verify source version of First'])
    expect(check('First', { ...c, entryIds: ['variant'] }, [a, variant, entry('feat', 'Third')]).missing).toEqual(['Third'])
  })
})
