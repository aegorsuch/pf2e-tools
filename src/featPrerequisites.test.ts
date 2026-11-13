import { describe, expect, it } from 'vitest'
import { additionalSkillCount, automaticFeatGrants, championDevotionOptions, dailyLongevityRanks, eligibleFeats, featChoiceOptions, featPrerequisiteChecker, featSelectionPrerequisiteChecker, featTakenLevel, focusSpells, maxHp, plannedSlots, ranksAt, senses, syncOrderExplorerFeats } from './builder'
import { featPrerequisiteSuggestions } from './featPrerequisites'
import { mapAonHit } from './aon'
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

it('checks champion blessing prerequisites at the feat selection level', () => {
  const c: Character = { ...base, className: 'Champion', blessing: 'Blessed Shield',
    feats: [{ ...selected('Second Blessing', 8), choice: 'Blessed Armament' }] }
  expect(check('blessed shield', c, [], 2).missing).toEqual(['blessed shield'])
  expect(check('blessed shield', c, [], 3).missing).toEqual([])
  expect(check('blessed armament', c, [], 7).missing).toEqual(['blessed armament'])
  expect(check('blessed armament', c, [], 8).missing).toEqual([])
  expect(check('blessed swiftness', c).missing).toEqual(['blessed swiftness'])
})

it('grants Shield Block from matching class features or the Warpriest doctrine', () => {
  const classes = ['Champion', 'Fighter', 'Druid', 'Inventor', 'Exemplar', 'Commander', 'Guardian', 'Runesmith']
  const features = classes.map(name => ({ ...entry('classFeature', 'Shield Block', { class: name }), id: `shield:${name}` }))
  for (const className of classes) {
    const c = { ...base, level: 1, className }
    expect(automaticFeatGrants(c, features)).toContainEqual({ name: 'Shield Block', source: className, level: 1 })
    expect(check('Shield Block', c, features)).toEqual({ missing: [], manual: [] })
    expect(automaticFeatGrants({ ...c, level: 0 }, features)).not.toContainEqual(expect.objectContaining({ name: 'Shield Block' }))
  }
  const cleric = { ...base, level: 1, className: 'Cleric', subclass: 'Warpriest' }
  expect(automaticFeatGrants(cleric, features)).toContainEqual({ name: 'Shield Block', source: 'Warpriest', level: 1 })
  expect(check('Shield Block', cleric, features)).toEqual({ missing: [], manual: [] })
  expect(automaticFeatGrants({ ...cleric, subclass: 'Cloistered Cleric' }, features))
    .not.toContainEqual(expect.objectContaining({ name: 'Shield Block' }))
  expect(automaticFeatGrants({ ...cleric, systems: ['sf2e'] }, features))
    .not.toContainEqual(expect.objectContaining({ name: 'Shield Block' }))
  const fighter = { ...base, level: 1, className: 'Fighter' }
  const feature = features.find(item => item.data.class === 'Fighter')!
  expect(automaticFeatGrants(fighter, [{ ...feature, id: 'foreign', systems: ['sf2e'] }, feature]))
    .toContainEqual({ name: 'Shield Block', source: 'Fighter', level: 1 })
})

it('checks champion sanctification and devotion spell prerequisites from actual choices', () => {
  const deity = entry('deity', 'Patron', { divine_font: 'Heal', sanctification: 'holy, unholy' })
  const c: Character = { ...base, className: 'Champion', deity: deity.name, sanctification: 'Holy', devotionSpell: 'Lay on Hands' }
  const entries = [deity]
  expect(championDevotionOptions(c, entries)).toEqual(['Shields of the Spirit', 'Lay on Hands'])
  expect(focusSpells(c, entries)).toMatchObject({ points: 1, spells: [{ name: 'Lay On Hands', source: 'Devotion Spells' }] })
  expect(check('holy', c, entries).missing).toEqual([])
  expect(check('unholy', c, entries).missing).toEqual(['unholy'])
  expect(check("you aren't unholy", c, entries).missing).toEqual([])
  expect(check('devotion spell (_lay on hands_)', c, entries).missing).toEqual([])
  expect(check('_touch of the void_', c, entries).missing).toEqual(['_touch of the void_'])
  expect(check('holy', c).manual).toEqual(['holy'])
  const unsanctified = { ...c, sanctification: undefined, devotionSpell: 'Touch of the Void' as const }
  expect(check('holy', unsanctified, entries).missing).toEqual(['holy'])
  expect(focusSpells(unsanctified, entries).spells).toEqual([])
  expect(check('champion’s aura', c, entries).missing).toEqual([])
  const justice = { ...c, subclass: 'Justice' }
  const resistance = 'champion’s reaction that grants an ally resistance to an enemy’s damage (including the grandeur, justice, liberation, and redemption causes)'
  const strike = 'champion’s reaction that grants extra damage with your Strikes (including the desecration, iniquity, and obedience causes)'
  expect(check(resistance, justice, entries).missing).toEqual([])
  expect(check(strike, justice, entries).missing).toEqual([strike])
  expect(check(resistance, { ...c, subclass: 'Iniquity' }, entries).missing).toEqual([resistance])
  expect(check(resistance, c, entries).manual).toEqual([resistance])
  const oath = entry('feat', 'Oath', {}, 2, ['Champion', 'Oath'])
  const sworn = { ...c, feats: [selected('Oath', 2)] }
  expect(check('Any feat with the oath trait', sworn, [oath], 1).missing).toHaveLength(1)
  expect(check('Any feat with the oath trait', sworn, [oath], 2).missing).toEqual([])
})

it('treats Reactive Strike as the legacy Attack of Opportunity prerequisite at its acquisition level', () => {
  const reactive = entry('feat', 'Reactive Strike', {}, 6, ['Champion'])
  const stance = entry('feat', 'Impassable Wall Stance', { prerequisite: 'Attack of Opportunity' }, 8, ['Champion'])
  const fighterStrike = entry('classFeature', 'Reactive Strike', { class: 'Fighter' }, 1)
  const entries = [reactive, stance, fighterStrike]
  const champion: Character = { ...base, className: 'Champion', feats: [selected('Reactive Strike', 6)] }
  expect(featPrerequisiteChecker(champion, entries, 8)(stance)).toEqual({ missing: [], manual: [] })
  expect(featPrerequisiteChecker(champion, entries, 5)(stance).missing).toEqual(['Attack of Opportunity'])
  expect(featPrerequisiteChecker({ ...champion, feats: [] }, entries, 8)(stance).missing).toEqual(['Attack of Opportunity'])
  expect(featPrerequisiteChecker({ ...base, className: 'Fighter', feats: [] }, entries, 8)(stance))
    .toEqual({ missing: [], manual: [] })
})

it('resolves Tenets of Good only when explicitly confirmed for a Champion', () => {
  const c: Character = { ...base, className: 'Champion', subclass: 'Justice' }
  const oath = entry('feat', 'Dragonslayer Oath', { prerequisite: 'tenets of good' }, 2, ['Champion', 'Oath'])
  const evaluate = (character: Character, level = character.level) => featPrerequisiteChecker(character, [oath], level)(oath)
  expect(evaluate(c)).toEqual({ missing: [], manual: ['tenets of good'] })
  expect(evaluate({ ...c, legacyTenetsOfGood: true })).toEqual({ missing: [], manual: [] })
  expect(evaluate({ ...c, legacyTenetsOfGood: true }, 0)).toEqual({ missing: [], manual: ['tenets of good'] })
  expect(evaluate({ ...c, className: 'Fighter', legacyTenetsOfGood: true })).toEqual({ missing: [], manual: ['tenets of good'] })
  expect(evaluate(JSON.parse(JSON.stringify({ ...c, legacyTenetsOfGood: true })))).toEqual({ missing: [], manual: [] })
})

it('requires a master skill for Exceptional Artisan and restricts its bonus feat to the selected skill', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 9, ancestry: 'Orc', rankOverrides: { Crafting: 3 },
    feats: [{ name: 'Exceptional Artisan', type: 'Ancestry Feat', level: 9, choice: 'Crafting', slot: 'ancestry:9:0' }] }
  expect(check('master in at least one skill', c).missing).toEqual([])
  expect(check('master in at least one skill', { ...c, rankOverrides: {} }).missing).toHaveLength(1)
  expect(featChoiceOptions('Exceptional Artisan', c, [], c.feats[0].slot!)).toEqual(['Crafting'])
  expect(automaticFeatGrants(c, [])).toContainEqual({ name: 'Assurance', source: 'Exceptional Artisan (Crafting)', level: 9 })
  const slot = plannedSlots(c).find(candidate => candidate.grantedBy === 'Exceptional Artisan')!
  const skillFeat = (name: string, skill: string): ContentEntry => ({ ...entry('feat', name, { skill }, 1, ['General', 'Skill']), systems: ['sf2e'] })
  expect(eligibleFeats([skillFeat('Quick Repair', 'Crafting'), skillFeat('Quick Squeeze', 'Acrobatics')], c, slot)
    .map(feat => feat.name)).toEqual(['Quick Repair'])
  expect(eligibleFeats([skillFeat('Quick Repair', 'Crafting')], { ...c, rankOverrides: {} }, slot)).toEqual([])
})

it('grants both prescient feats at the level Predictive Purchase is taken', () => {
  const c: Character = { ...base, level: 10, feats: [selected('Predictive Purchase', 10)] }
  expect(automaticFeatGrants(c, [])).toEqual(expect.arrayContaining([
    { name: 'Prescient Planner', source: 'Predictive Purchase', level: 10 },
    { name: 'Prescient Consumable', source: 'Predictive Purchase', level: 10 },
  ]))
  expect(automaticFeatGrants({ ...c, level: 9 }, [])).toEqual([])
})

it('enforces the Rogue sneak attack dice prerequisite at the selection level', () => {
  const c: Character = { ...base, className: 'Rogue' }
  expect(check('sneak attack 2d6', c, [], 4).missing).toEqual(['sneak attack 2d6'])
  expect(check('sneak attack 2d6', c, [], 5).missing).toEqual([])
})

it('checks proficiency in sawtooth sabers, including weapon familiarity', () => {
  const saber = entry('weapon', 'Sawtooth Saber', { weapon_category: 'Advanced' }, 0)
  const rogue = entry('class', 'Rogue', { attack_proficiency: 'Trained in martial weapons' })
  const c: Character = { ...base, className: 'Rogue', level: 8 }
  expect(check('trained in sawtooth sabers', c, [saber, rogue]).missing).toEqual(['trained in sawtooth sabers'])
  const trained = { ...c, feats: [{ ...selected('Weapon Proficiency'), choice: 'Sawtooth Saber' }] }
  expect(check('trained in sawtooth sabers', trained, [saber, rogue]).missing).toEqual([])
  expect(check('trained in sawtooth sabers', c, [rogue]).manual).toEqual(['trained in sawtooth sabers'])
})

it('grants Free Heart background skills and feat without its attribute boosts', () => {
  const background = entry('background', 'Performer', { skill: 'Performance, Theater Lore', feat: 'Fascinating Performance', ability: 'Charisma' })
  const rare = entry('background', 'Secret', { rarity: 'rare' })
  const klass = entry('class', 'Bard', { skill_proficiency: 'Trained in Performance' })
  const c: Character = { ...base, level: 1, className: 'Bard', ancestry: 'Elf',
    feats: [{ ...selected('Free Heart'), choice: 'Performer' }] }
  const entries = [background, rare, klass]
  expect(featChoiceOptions('Free Heart', c, entries, '')).toEqual(['Performer'])
  expect(ranksAt(c, entries)).toMatchObject({ Performance: 1, 'Theater Lore': 1 })
  expect(automaticFeatGrants(c, entries)).toContainEqual({ name: 'Fascinating Performance', source: 'Free Heart (Performer)', level: 1 })
  expect(additionalSkillCount(c, entries)).toBe(additionalSkillCount({ ...c, feats: [] }, entries) + 1)
  expect(ranksAt({ ...c, level: 0 }, entries)['Theater Lore']).toBeUndefined()
})

it('preserves legacy longevity choices as regular proficiency for prerequisites', () => {
  const c: Character = { ...base, level: 9, ancestry: 'Elf', skillPicks: ['Athletics'], feats: [
    { ...selected('Ancestral Longevity', 5), choice: 'Acrobatics' },
    { ...selected('Expert Longevity', 9), choice: 'Athletics' },
  ] }
  expect(dailyLongevityRanks(c, [])).toMatchObject({ Acrobatics: 1, Athletics: 2 })
  expect(ranksAt(c, []).Acrobatics).toBe(1)
  expect(check('trained in Acrobatics', c).missing).toEqual([])
  expect(check('expert in Athletics', c).missing).toEqual([])
  expect(ranksAt(c, [], 5).Acrobatics).toBeUndefined()
  expect(ranksAt(c, [], 9).Athletics).toBe(1)
  expect(dailyLongevityRanks({ ...c, level: 8 }, []).Athletics).toBe(1)
  expect(dailyLongevityRanks({ ...c, feats: [c.feats[1]] }, []).Athletics).toBe(1)
})

it.each(['Celestial Form', 'Fiendish Form'])('%s grants darkvision even when flight is disabled', name => {
  const c: Character = { ...base, level: 18, feats: [selected(name, 18)] }
  expect(senses(c, [])).toContainEqual({ value: 'Darkvision', source: name })
  expect(senses({ ...c, level: 17 }, [])).toEqual([])
})

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
    ['Cite the Deep Lore', 'Society', 'Blend In', 'Elf'],
    ["Diplomat's Facade", 'Deception', 'Lie to Me', 'Elf'],
    ['Broken Hand Technique', 'Athletics', 'Titan Wrestler', 'Orc'],
    ['Spelunker', 'Acrobatics', 'Quick Squeeze', 'Orc'],
  ])('grants %s skill and feat, with an alternate when already trained', (name, skill, bonus, ancestry) => {
    const character: Character = { ...base, systems: ['sf2e'], ancestry, feats: [selected(name)] }
    expect(ranksAt(character, [])[skill]).toBe(1)
    expect(automaticFeatGrants(character, [])).toContainEqual({ name: bonus, source: name, level: 1 })
    const duplicate = { ...character, skillPicks: [skill], feats: [{ ...character.feats[0], choice: 'Medicine' }] }
    expect(featChoiceOptions(name, duplicate, [], 'class:1:0', 0)).toContain('Medicine')
    expect(ranksAt(duplicate, []).Medicine).toBe(1)
    expect(automaticFeatGrants({ ...character, systems: ['pf2e'] }, []).some(grant => grant.source === name)).toBe(false)
  })
  it('grants Hold-Scarred Orc ancestry HP and Diehard', () => {
    const orc: Character = { ...base, level: 1, ancestry: 'Orc', heritage: 'Hold-Scarred Orc' }
    const ancestry = entry('ancestry', 'Orc', { hp: 10 })
    expect(maxHp(orc, [ancestry])).toBe(12)
    expect(automaticFeatGrants(orc, [])).toContainEqual({ name: 'Diehard', source: 'Hold-Scarred Orc', level: 1 })
    expect(check('Diehard', orc).missing).toEqual([])
    expect(maxHp({ ...orc, heritage: undefined }, [ancestry])).toBe(10)
  })
  it('grants Forager from the Starfinder Orc Rugged Survivalist, not the Pathfinder archetype', () => {
    const orc: Character = { ...base, systems: ['sf2e'], ancestry: 'Orc', feats: [selected('Rugged Survivalist', 9)] }
    expect(automaticFeatGrants(orc, [])).toContainEqual({ name: 'Forager', source: 'Rugged Survivalist', level: 9 })
    expect(automaticFeatGrants({ ...orc, level: 8 }, [])).toEqual([])
    expect(automaticFeatGrants({ ...orc, systems: ['pf2e'] }, [])).toEqual([])
  })
  it('hides redundant Orc ancestral unarmed attack when Tusks or Iron Fists is already selected', () => {
    const feat: ContentEntry = { ...entry('feat', 'Ancestral Unarmed Attack', {}, 1, ['Orc']), systems: ['sf2e'] }
    const orc: Character = { ...base, systems: ['sf2e'], ancestry: 'Orc', level: 5 }
    const slot = { category: 'ancestry' as const, key: 'ancestry:5:0', level: 5 }
    expect(eligibleFeats([feat], { ...orc, feats: [] }, slot)).toEqual([feat])
    expect(eligibleFeats([feat], { ...orc, feats: [selected('Tusks')] }, slot)).toEqual([])
    expect(eligibleFeats([feat], { ...orc, feats: [selected('Iron Fists')] }, slot)).toEqual([])
  })
  it('grants Beast Trainer and Hold Mark choices only at their acquisition levels', () => {
    const orc: Character = { ...base, ancestry: 'Orc', feats: [
      { ...selected('Beast Trainer', 5), choice: 'Pet' },
      { ...selected('Hold Mark', 9), choice: 'Empty Hand' },
    ] }
    expect(ranksAt(orc, []).Nature).toBe(1)
    expect(ranksAt(orc, []).Intimidation).toBe(1)
    expect(automaticFeatGrants(orc, [])).toContainEqual({ name: 'Pet', source: 'Beast Trainer', level: 5 })
    expect(ranksAt({ ...orc, level: 4 }, []).Nature ?? 0).toBe(0)
    expect(ranksAt({ ...orc, level: 8 }, []).Intimidation ?? 0).toBe(0)
    expect(automaticFeatGrants({ ...orc, feats: [{ ...orc.feats[0], choice: 'Train Animal' }] }, []))
      .toContainEqual({ name: 'Train Animal', source: 'Beast Trainer', level: 5 })
    expect(automaticFeatGrants({ ...orc, feats: [{ ...orc.feats[0], choice: undefined }] }, [])).toEqual([])
  })
  it('requires a prior primal innate spell for First World Adept and a familiar for familiar feats', () => {
    const source = mapAonHit({ _id: 'first-world', _source: { name: 'First World Magic', category: 'feat', level: 1, trait: ['Gnome'],
      markdown: 'Header\n\n---\n\nChoose one cantrip from the [primal](/SpellLists.aspx?Tradition=4) spell list. You can cast this cantrip as an innate spell at will.' } }, 'pf2e')!
    const spell = entry('spell', 'Light', { tradition: 'primal' }, 1, ['Cantrip'])
    const gnome: Character = { ...base, className: 'Ranger', ancestry: 'Gnome', level: 9,
      feats: [{ ...selected(source.name, 1), type: 'Ancestry Feat', choice: spell.name }] }
    expect(check('at least one primal innate spell', gnome, [source, spell]).missing).toEqual([])
    expect(check('at least one primal innate spell', { ...gnome, feats: [] }, [source, spell]).missing).toHaveLength(1)
    expect(check('at least one primal innate spell', { ...gnome, feats: [{ ...gnome.feats[0], choice: undefined }] }, [source, spell]).missing).toHaveLength(1)
    expect(check('a familiar', gnome).missing).toHaveLength(1)
    expect(check('a familiar', { ...gnome, feats: [selected('Animal Accomplice')] }).missing).toEqual([])
  })
  it('requires limited telepathy for Distant Telepath', () => {
    const elf: Character = { ...base, systems: ['sf2e'], ancestry: 'Elf', heritage: 'Asanan Elf' }
    expect(check('limited telepathy', elf).missing).toEqual([])
    expect(check('limited telepathy', { ...elf, heritage: 'Other Elf' }).missing).toEqual(['limited telepathy'])
    expect(check('limited telepathy', { ...elf, ancestry: 'Lashunta', heritage: undefined }).missing).toEqual([])
    expect(check('limited telepathy', { ...elf, systems: ['pf2e'] }).missing).toEqual(['limited telepathy'])
  })
  it('requires a construct companion for No! No! I Created You!', () => {
    const inventor: Character = { ...base, className: 'Inventor', subclass: 'Construct' }
    expect(check('construct companion', inventor).missing).toEqual([])
    expect(check('construct companion', { ...inventor, subclass: 'Armor' }).missing).toEqual(['construct companion'])
    expect(check('construct companion', { ...inventor, subclass: 'Armor', feats: [{ ...selected('Second Innovation', 8), choice: 'Construct' }] }, [], 7).missing).toEqual(['construct companion'])
    expect(check('construct companion', { ...inventor, subclass: 'Armor', feats: [{ ...selected('Second Innovation', 8), choice: 'Construct' }] }).missing).toEqual([])
  })
  it('permits a second Ubiquitous Gadgets only at level 14 or later', () => {
    const gadget = entry('feat', 'Ubiquitous Gadgets', { prerequisite: 'Gadget Specialist' }, 8, ['Inventor'])
    const inventor: Character = { ...base, className: 'Inventor', level: 16,
      feats: [selected('Gadget Specialist', 4), selected('Ubiquitous Gadgets', 8)] }
    const slot = (level: number) => ({ key: `class:${level}:0`, category: 'class' as const, level })
    expect(eligibleFeats([gadget], inventor, slot(12))).toEqual([])
    expect(eligibleFeats([gadget], inventor, slot(14))).toEqual([gadget])
    expect(eligibleFeats([gadget], { ...inventor, feats: [...inventor.feats, selected('Ubiquitous Gadgets', 14)] }, slot(16))).toEqual([])
  })
  it('grants each Order Explorer a first-level feat from its chosen order at the acquisition level', () => {
    const animal = entry('feat', 'Animal Companion', { prerequisite: 'animal order' }, 1, ['Druid'])
    const flame = entry('feat', 'Leshy Familiar', { prerequisite: 'leaf order' }, 1, ['Druid'])
    const general = entry('feat', 'Other Druid Feat', {}, 1, ['Druid'])
    const c: Character = { ...base, className: 'Druid', order: 'Storm', level: 4, feats: [
      { ...selected('Order Explorer', 2), choice: 'Animal' },
      { ...selected('Order Explorer', 4), choice: 'Leaf' },
    ] }
    const slots = plannedSlots(c).filter(slot => slot.grantedBy === 'Order Explorer')
    expect(slots.map(slot => [slot.level, slot.maxFeatLevel, slot.grantedOrder])).toEqual([[2, 1, 'Animal'], [4, 1, 'Leaf']])
    expect(eligibleFeats([animal, flame, general], c, slots[0])).toEqual([animal])
    expect(eligibleFeats([animal, flame, general], c, slots[1])).toEqual([flame])
    const untamed = entry('feat', 'Untamed Form', { prerequisite: 'untamed order' }, 1, ['Druid'])
    const wild = { ...c, feats: [{ ...selected('Order Explorer', 2), choice: 'Wild' }] }
    expect(eligibleFeats([untamed], wild, plannedSlots(wild).find(slot => slot.grantedBy === 'Order Explorer')!)).toEqual([untamed])
    expect(plannedSlots({ ...c, level: 1 }).filter(slot => slot.grantedBy === 'Order Explorer')).toEqual([])
  })
  it.each([
    ['Animal', 'Animal Companion', 'animal'], ['Flame', 'Fire Lung', 'flame'],
    ['Leaf', 'Leshy Familiar', 'leaf'], ['Stone', 'Steadying Stone', 'stone'],
    ['Storm', 'Storm Born', 'storm'], ['Wave', 'Shore Step', 'wave'], ['Wild', 'Untamed Form', 'untamed'],
  ])('automatically selects the available %s order feat', (order, name, prerequisite) => {
    const feat = entry('feat', name, { prerequisite: `${prerequisite} order` }, 1, ['Druid'])
    const c: Character = { ...base, className: 'Druid', order: 'Leaf', level: 4, feats: [
      { ...selected('Order Explorer', 2), choice: order },
    ] }
    const patch = syncOrderExplorerFeats(c, [feat])!
    const granted = patch.feats!.find(selectedFeat => selectedFeat.name === name)
    expect(granted).toMatchObject({ name, takenLevel: 2, slot: 'class:1:order-explorer:class:2:0' })
    expect(patch.entryIds).toContain(feat.id)
    expect(syncOrderExplorerFeats({ ...c, ...patch }, [feat])).toBeUndefined()
    expect(syncOrderExplorerFeats({ ...c, level: 1 }, [feat])).toBeUndefined()
  })

  it('updates old order selections when the order changes, but leaves genuine alternatives to the user', () => {
    const fire = entry('feat', 'Fire Lung', { prerequisite: 'flame order' }, 1, ['Druid'])
    const wave = entry('feat', 'Shore Step', { prerequisite: 'wave order' }, 1, ['Druid'])
    const anotherWave = entry('feat', 'Another Wave Feat', { prerequisite: 'wave order' }, 1, ['Druid'])
    const slot = 'class:1:order-explorer:class:2:0'
    const c: Character = { ...base, className: 'Druid', order: 'Animal', level: 4,
      feats: [{ ...selected('Order Explorer', 2), choice: 'Wave' }, { ...selected('Fire Lung'), slot, takenLevel: 2 }],
      entryIds: [fire.id] }
    expect(syncOrderExplorerFeats(c, [])).toBeUndefined()
    const patch = syncOrderExplorerFeats(c, [fire, wave])!
    expect(patch.feats!.map(feat => feat.name)).toEqual(['Order Explorer', 'Shore Step'])
    expect(patch.entryIds).toEqual([wave.id])
    const multiple = syncOrderExplorerFeats(c, [fire, wave, anotherWave])!
    expect(multiple.feats!.map(feat => feat.name)).toEqual(['Order Explorer'])
    expect(syncOrderExplorerFeats({ ...c, feats: [...c.feats.slice(0, 1), { ...selected('Shore Step'), slot }] },
      [fire, wave, anotherWave])).toBeUndefined()
  })
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

  it('enforces Wandering Heart environmental heritage requirements without guessing unknown heritages', () => {
    const prerequisite = 'Arctic Elf, Cavern Elf, Desert Elf, Woodland Elf, or any other elf heritage based on adapting to an environment'
    for (const heritage of ['Arctic Elf', 'Cavern Elf', 'Desert Elf', 'Woodland Elf', 'Aquatic Elf']) {
      expect(check(prerequisite, { ...base, ancestry: 'Elf', heritage })).toEqual({ missing: [], manual: [] })
    }
    for (const heritage of ['Ancient Elf', 'Seer Elf', 'Whisper Elf', undefined]) {
      expect(check(prerequisite, { ...base, ancestry: 'Elf', heritage }).missing).toEqual([prerequisite])
    }
    expect(check(prerequisite, { ...base, ancestry: 'Elf', heritage: 'Unrecognized Elf' }))
      .toEqual({ missing: [], manual: [prerequisite] })
    const feat = entry('feat', 'Wandering Heart', { prerequisite }, 13, ['Elf'])
    const slot = { key: 'ancestry:13:0', category: 'ancestry' as const, level: 13 }
    const elf = { ...base, level: 13, ancestry: 'Elf' }
    expect(eligibleFeats([feat], { ...elf, heritage: 'Woodland Elf' }, slot)).toContain(feat)
    expect(eligibleFeats([feat], { ...elf, heritage: 'Ancient Elf' }, slot)).not.toContain(feat)
  })

  it('restricts Otherworldly Magic to Elf ancestry without inventing a prerequisite', () => {
    const feat = entry('feat', 'Otherworldly Magic', {}, 1, ['Elf'])
    const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
    expect(eligibleFeats([feat], { ...base, ancestry: 'Elf' }, slot)).toContain(feat)
    expect(eligibleFeats([feat], { ...base, ancestry: 'Human' }, slot)).not.toContain(feat)
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
