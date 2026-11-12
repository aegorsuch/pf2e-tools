import { describe, expect, it } from 'vitest'
import { eligibleFeats, featPrerequisiteChecker, featSelectionPrerequisiteChecker } from './builder'
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

describe('shared prerequisite enforcement', () => {
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
