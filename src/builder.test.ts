import { parseClericSpells, parseDeityAbout, parseFeatLanguages } from './aonQuery'
import { mapAonHit } from './aon'
import { describe, expect, it, vi } from 'vitest'
import * as featChoices from './featChoices'
import { ancestralSkills, movementSpeeds, armorRanks, weaponRanks, featChoiceOptions, loreReplacementChoices, armorSpecialization, autoClassSkills, automaticFeatGrants, bulkLimits, classLabel, subclassOptions, subclassSkillChoice, subclassSkillGrants, availableOrders, featLores, senses, additionalSkillCount, ancestryLabel, armorClass, boostSlots, cannyAcumenOptions, classFeatures, classSkills, computeAbilities, baseItems, eligibleFeats, featPrerequisiteChecker, isMagicItem, isVersatileHeritage, heritagesFor, languageAllowance, languageGroups, maxHp, orphanedArchetypeFeats, focusSpells, orderMagicOptions, propertyRunes, resistances, untrainedSkillProficiency, unslottedFeats, speed, initiativeBonus, perceptionCircumstance, plannedSlots, ranksAt, skillRankBudget, weaponAttack } from './builder'
import { getSettings, updateSettings } from './settings'
import { shieldStats, activeHomebrewDedications, hitPointBonuses, terrainExpertiseBenefits, terrainExpertiseOptions } from './builder'
import type { Character, ContentEntry } from './types'

const entry = (kind: ContentEntry['kind'], name: string, data: ContentEntry['data'] = {}, level = 1, traits: string[] = []): ContentEntry => ({
  id: `${kind}:${name}`, systems: ['pf2e'], kind, source: 'official', name, level, traits, description: '', data, effects: [], updatedAt: 1,
})

it('merges equivalent cross-system ancestry feats after eligibility filtering but retains different rules and prerequisites', () => {
  const original = { ...entry('feat', 'Shared Training', {}, 1, ['Human']),
    description: "Header\n\n---\n\nYou have training with weapons (such as axes). If you are trained, gain a bonus." }
  const duplicate: ContentEntry = { ...original, id: 'sf-training', systems: ['sf2e'], traits: ['Human', 'Shirren'],
    description: "Other Header\n\n---\n\nYou've training with weapons (such as swords). If you're trained, gain a bonus.\n\nShared Training leads to... Other Feat" }
  const different = { ...original, id: 'different-training', description: 'Gain two bonuses instead.' }
  const restricted = { ...original, id: 'restricted-training', data: { prerequisite: 'Level 5' } }
  const c: Character = { id: 'dedup', name: 'Test', systems: ['pf2e', 'sf2e'], ancestry: 'Human', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const options = eligibleFeats([entry('ancestry', 'Human'), entry('ancestry', 'Shirren'), original, duplicate, different, restricted],
    c, { key: 'ancestry:1:0', category: 'ancestry', level: 1 }, { includeUnmetPrerequisites: true })
  expect(options.map(option => option.id)).toEqual([original.id, different.id, restricted.id])
})

it('merges equivalent skill feats without losing clarifications, different rules, homebrew, or saved sources', () => {
  const rules = "Choose a skill you're trained in. You can receive a result of 10 + your proficiency bonus."
  const clarification = '<details class="clarification"><summary>Paizo Clarification</summary>This still counts as a roll.</details>'
  const special = '\n\n**Special** You can select this feat multiple times. Each time, choose a different skill.'
  const mapped = (system: 'pf2e' | 'sf2e', id: string, body: string, prerequisite = 'trained in at least one skill') =>
    mapAonHit({ _id: id, _source: { category: 'feat', name: 'Assurance', level: 1,
      trait: ['Fortune', 'General', 'Skill'], skill: system === 'pf2e' ? ['Athletics', 'Athletics'] : ['Athletics'],
      prerequisite, markdown: `Assurance\n\nSource ${system}\n\n---\n\n${body}${special}` } }, system)!
  const pf = mapped('pf2e', 'pf-assurance', `${rules} ${clarification}`)
  const sf = mapped('sf2e', 'sf-assurance', rules.replace("you're", 'you\u2019re'), 'Trained in at least one skill')
  const different = mapped('sf2e', 'different-rules', rules.replace('10 +', '12 +'))
  const restricted = mapped('sf2e', 'different-prerequisite', rules, 'expert in at least one skill')
  const homebrew: ContentEntry = { ...pf, id: 'custom-assurance', source: 'homebrew' }
  const c: Character = { id: 'skill-dedup', name: 'Test', systems: ['pf2e', 'sf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const data = [sf, pf, different, restricted, homebrew]
  const slot = { key: 'skill:1:0', category: 'skill' as const, level: 1 }
  const options = (character: Character, available = data) =>
    eligibleFeats(available, character, slot, { includeUnmetPrerequisites: true }).map(feat => feat.id)
  expect(options(c)).toEqual([pf.id, different.id, restricted.id, homebrew.id])
  expect(pf.description).toContain('Paizo Clarification')
  expect(pf.description).toContain('Each time, choose a different skill.')
  expect(options({ ...c, systems: ['sf2e', 'pf2e'] })).toEqual([sf.id, different.id, restricted.id, homebrew.id])
  expect(options(c, [sf])).toEqual([sf.id])
  const selected = { ...c, entryIds: [sf.id],
    feats: [{ name: sf.name, type: 'Skill Feat', level: 1, slot: slot.key, sourceId: sf.id }] }
  const saved = JSON.stringify(selected)
  expect(options(selected)).toEqual([sf.id, different.id, restricted.id, homebrew.id])
  expect(options({ ...selected, feats: [{ ...selected.feats[0], sourceId: undefined }] }))
    .toEqual([sf.id, different.id, restricted.id, homebrew.id])
  expect(JSON.stringify(selected)).toBe(saved)
})

it.each([
  ['Arcane Sense', '5119', '761-arcane-sense', {}, {}, []],
  ['Quick Identification', '5195', '861-quick-identification',
    { prerequisite: 'trained in Arcana, Nature, Occultism, or Religion' },
    { prerequisite: 'Trained in Arcana, Trained in Nature, Trained in Occultism, or Trained in Religion' }, []],
  ['Automatic Knowledge', '5122', '765-automatic-knowledge',
    { prerequisite: 'expert in a skill with the Recall Knowledge action; Assurance in that skill' },
    { prerequisite: 'expert in a skill with the Recall Knowledge action, Assurance in that skill' }, []],
  ['Train Animal', '5228', '900-train-animal', {}, {}, ['Downtime', 'Manipulate']],
] as const)('merges audited %s core-book copies but not unrelated versions', (name, pfId, sfId, pfData, sfData, extraTraits) => {
  const pf = { ...entry('feat', name, pfData, 1, ['General', 'Skill', ...extraTraits]),
    id: `aon:pf2e:feat-${pfId}`, description: 'Flavor. Shared benefit.' }
  const sf: ContentEntry = { ...pf, id: `aon:sf2e:feats--${sfId}`, systems: ['sf2e'], data: sfData,
    traits: ['General', 'Skill'], description: 'Shared benefit.' }
  const different = { ...pf, id: 'other-version', description: 'Different benefit.' }
  const c: Character = { id: 'shared-skill', name: 'Test', systems: ['pf2e', 'sf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(eligibleFeats([sf, pf, different], c, { key: 'skill:1:0', category: 'skill', level: 1 },
    { includeUnmetPrerequisites: true }).map(feat => feat.id)).toEqual([pf.id, different.id])
})

it.each([
  ['Advanced General Training', 13, 'ancestry'],
  ['Cooperative Nature', 1, 'ancestry'],
  ['Cooperative Soul', 9, 'ancestry'],
  ['Incredible Improvisation', 9, 'ancestry'],
  ['Multitalented', 9, 'ancestry'],
  ['Prescient Planner', 3, 'general'],
  ['Unconventional Weaponry', 1, 'ancestry'],
] as const)('offers one official %s across systems while preserving homebrew', (name, level, category) => {
  const pf = { ...entry('feat', name, {}, level, [category === 'general' ? 'General' : 'Human']), description: 'Pathfinder wording.' }
  const sf: ContentEntry = { ...pf, id: `sf:${name}`, systems: ['sf2e'], description: 'Starfinder wording.',
    data: name === 'Cooperative Soul' ? { prerequisite: 'Cooperative Nature' } : {} }
  const homebrew: ContentEntry = { ...pf, id: `custom:${name}`, source: 'homebrew' }
  const c: Character = { id: 'human', name: 'Test', systems: ['pf2e', 'sf2e'], ancestry: 'Human', level,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const slot = { key: `${category}:${level}:0`, category, level }
  expect(eligibleFeats([sf, pf, homebrew], c, slot, { includeUnmetPrerequisites: true })).toEqual([pf, homebrew])
  expect(eligibleFeats([sf], { ...c, systems: ['sf2e'] }, slot, { includeUnmetPrerequisites: true })).toEqual([sf])
})

it('merges core and Galactic Ancestries Unconventional Weaponry copies without altering saved weapon choices', () => {
  const pf = entry('feat', 'Unconventional Weaponry', {}, 1, ['Human'])
  const core: ContentEntry = { ...pf, id: 'sf-core', systems: ['sf2e'], traits: ['Human', 'Shirren'],
    description: 'Core weapon familiarity.' }
  const galactic: ContentEntry = { ...core, id: 'sf-galactic', traits: ['Human'],
    description: 'Updated familiarity for martial weapons or guns.' }
  const homebrew: ContentEntry = { ...pf, id: 'custom-weaponry', source: 'homebrew' }
  const c: Character = { id: 'weaponry', name: 'Test', systems: ['pf2e', 'sf2e'], ancestry: 'Human', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: pf.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', sourceId: galactic.id, choice: 'Shobhad Longrifle' }],
    equipment: [], lores: [], languages: [], entryIds: [galactic.id], extraSlots: [], updatedAt: 0 }
  const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
  const saved = JSON.stringify(c)
  expect(eligibleFeats([core, galactic, pf, homebrew], c, slot)).toEqual([pf, homebrew])
  expect(eligibleFeats([galactic, pf, core, homebrew], c, slot)).toEqual([pf, homebrew])
  expect(eligibleFeats([core, galactic, homebrew], { ...c, systems: ['sf2e'] }, slot)).toEqual([core, homebrew])
  expect(JSON.stringify(c)).toBe(saved)
})

it('offers one eligible official Overcrowd while preserving homebrew options', () => {
  const core = { ...entry('feat', 'Overcrowd', {}, 9, ['Ysoki']), systems: ['sf2e' as const],
    description: 'As long as you are Small, you can share a square with a Small ally.' }
  const galactic = { ...entry('feat', 'Overcrowd', { prerequisite: 'Small size or smaller' }, 9, ['Ysoki']),
    id: 'galactic-overcrowd', systems: ['sf2e' as const], description: 'Small or smaller creatures can share a square.' }
  const pathfinder = { ...entry('feat', 'Overcrowd', {}, 9, ['Ratfolk']), id: 'pf-overcrowd',
    description: 'As long as you are Small, you can share a square with a Small ally.' }
  const homebrew = { ...core, id: 'custom-overcrowd', source: 'homebrew' as const }
  const c: Character = { id: 'ysoki', name: 'Test', systems: ['pf2e', 'sf2e'], ancestry: 'Ysoki', level: 9,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const slot = { key: 'ancestry:9:0', category: 'ancestry' as const, level: 9 }
  expect(eligibleFeats([galactic, core, homebrew], c, slot, { includeUnmetPrerequisites: true })).toEqual([core, homebrew])
  expect(eligibleFeats([galactic], c, slot, { includeUnmetPrerequisites: true })).toEqual([galactic])
  const adopted = { ...c, feats: [{ name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Ratfolk' }] }
  expect(eligibleFeats([pathfinder, galactic, core], adopted, slot).map(feat => feat.id)).toEqual([core.id])
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

it('resolves successive ancestry training grants without exponential history checks', () => {
  const names = ['Cite the Deep Lore', "Diplomat's Facade", 'Broken Hand Technique', 'Spelunker',
    'Eye for Treasure', 'Rat Retinal HUD', 'Munitions Crafter', 'Orc Lore']
  const data = names.map(name => ({ ...entry('feat', name, {}, 1, ['Orc']), systems: ['sf2e' as const] }))
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Orc', level: 20,
    feats: names.map((name, index) => ({ name, type: 'Ancestry Feat', level: 1, slot: `ancestry:${index + 1}:0` })) }
  const source = vi.spyOn(featChoices, 'selectedFeatEntry')
  try {
    expect(ranksAt(c, data)).toMatchObject({
      Society: 1, Deception: 1, Athletics: 1, Acrobatics: 1, Crafting: 1, Computers: 1,
    })
    expect(source.mock.calls.length).toBeLessThan(2000)
  } finally { source.mockRestore() }
})

it('keeps cached ranks isolated and current after character, rule and catalog changes', () => {
  const previous = getSettings().autoClassSkills
  const c: Character = { ...base, level: 7, skillPicks: [], feats: [
    { name: 'Skill Training', type: 'Skill Feat', level: 1, slot: 'skill:2:0', choice: 'Medicine' },
  ] }
  try {
    updateSettings({ autoClassSkills: false })
    const first = ranksAt(c, entries)
    expect(first).toMatchObject({ Arcana: 1, Medicine: 1 })
    first.Arcana = 99
    expect(ranksAt(c, entries).Arcana).toBe(1)
    c.skillPicks!.push('Athletics')
    c.feats[0].choice = 'Nature'
    expect(ranksAt(c, entries)).toMatchObject({ Athletics: 1, Nature: 1 })
    expect(ranksAt(c, entries).Medicine).toBeUndefined()
    c.rankOverrides = { Nature: 3 }
    expect(ranksAt(c, entries).Nature).toBe(3)
    expect(ranksAt(c, entries, 99, false).Nature).toBe(1)
    expect(ranksAt(c, entries, 2, false).Nature).toBeUndefined()
    updateSettings({ autoClassSkills: true })
    expect(ranksAt(c, entries).Arcana).toBe(3)
    const changed = entries.map(source => source.kind === 'class' && source.name === 'Wizard'
      ? { ...source, data: { ...source.data, skill_proficiency: 'Trained in Occultism' } } : source)
    expect(ranksAt(c, changed).Occultism).toBe(3)
    expect(ranksAt(c, changed).Arcana).toBe(1)
    c.level = 1
    expect(ranksAt(c, entries, 99, false)).toMatchObject({ Arcana: 1, Athletics: 1 })
    expect(ranksAt(c, entries, 99, false).Nature).toBeUndefined()
  } finally { updateSettings({ autoClassSkills: previous }) }
})

describe('replacement slots for redundant fixed feat grants', () => {
  const data = [
    entry('background', 'Direwolf Bonded', { feat: 'Canny Acumen, Titan Wrestler' }),
    entry('feat', 'Titan Wrestler', {}, 1, ['General', 'Skill']),
    entry('feat', 'Canny Acumen', {}, 1, ['General']),
    { ...entry('feat', 'Broken Hand Technique', {}, 1, ['Human']), systems: ['sf2e' as const] },
    entry('feat', 'Level Five Skill', {}, 5, ['General', 'Skill']),
    entry('feat', 'Level Six Skill', {}, 6, ['General', 'Skill']),
    entry('feat', 'Unqualified Skill', { prerequisite: 'Strength +4' }, 1, ['General', 'Skill']),
    entry('feat', 'Fleet', {}, 1, ['General']),
  ]
  const c: Character = { ...base, level: 20, systems: ['pf2e', 'sf2e'], background: 'Direwolf Bonded',
    feats: [{ name: 'Broken Hand Technique', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' }] }
  const replacements = (character: Character, catalog = data) => plannedSlots(character, catalog).filter(slot => slot.redundantFeat)

  it('uses the duplicate acquisition level and normal category, level and prerequisite rules', () => {
    const [slot] = replacements(c)
    expect(replacements(c)).toHaveLength(1)
    expect(slot).toMatchObject({ category: 'skill', level: 5, grantedBy: 'Broken Hand Technique', redundantFeat: 'Titan Wrestler' })
    expect(eligibleFeats(data, c, slot).map(feat => feat.name)).toEqual(['Level Five Skill'])
    expect(replacements({ ...c, level: 4 })).toEqual([])
    expect(replacements({ ...c, background: undefined })).toEqual([])
    expect(replacements({ ...c, feats: [] })).toEqual([])
    expect(replacements(JSON.parse(JSON.stringify(c)))[0].key).toBe(slot.key)
    expect(replacements({ ...c, dismissedFeatSlots: [slot.key] })).toEqual([slot])
  })

  it('also recognizes an earlier purchased feat without rewarding ordinary duplicate selections', () => {
    const purchased: Character['feats'][number] = { name: 'Titan Wrestler', type: 'Skill Feat', level: 1, slot: 'skill:2:0' }
    const selected = { ...c, background: undefined, feats: [purchased, ...c.feats] }
    expect(replacements(selected)[0]).toMatchObject({ category: 'skill', level: 5 })
    expect(replacements({ ...selected, feats: [...selected.feats].reverse() })).toEqual(replacements(selected))
    expect(replacements({ ...selected, feats: [purchased, { ...purchased, slot: 'skill:4:0' }] })).toEqual([])
    expect(replacements({ ...selected, feats: [{ ...purchased, slot: 'skill:10:0' }, ...c.feats] })).toEqual([])
  })

  it('grants one same-type slot per additional fixed grant with stable source identities', () => {
    const catalog = [...data, entry('background', 'Fast Background', { feat: 'Fleet' })]
    const character: Character = { ...c, background: 'Fast Background', feats: [
      { name: 'Fleet', type: 'General Feat', level: 1, slot: 'general:1:0' },
      { name: 'Gg-os Frame', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' },
    ] }
    const slots = replacements(character, catalog)
    expect(slots.map(slot => [slot.category, slot.level])).toEqual([['general', 1], ['general', 5]])
    expect(new Set(slots.map(slot => slot.key)).size).toBe(2)
    expect(replacements({ ...character, feats: [...character.feats].reverse() }, catalog)).toEqual(slots)
  })

  it('does not compensate repeatable feats or double-count a background choice slot', () => {
    const catalog = [...data, entry('background', 'Lore Background', { feat: 'Additional Lore' }),
      entry('feat', 'Additional Lore', { repeatable: true }, 1, ['General', 'Skill'])]
    const lores = { ...c, background: 'Lore Background', feats: [
      { name: 'Additional Lore', type: 'Skill Feat', level: 1, slot: 'skill:2:0', choice: 'Art' },
      { name: 'Additional Lore', type: 'Skill Feat', level: 1, slot: 'skill:4:0', choice: 'War' },
    ] }
    expect(replacements(lores, catalog)).toEqual([])
    const canny = { ...c, feats: [
      { name: 'Canny Acumen', type: 'General Feat', level: 1, slot: 'general:1:direwolf-bonded', choice: 'Will' },
    ] }
    expect(replacements(canny)).toEqual([])
  })

  it('does not let replacement selections or their grants generate replacement chains', () => {
    const [slot] = replacements(c)
    const character = { ...c, feats: [...c.feats,
      { name: 'Gg-os Frame', type: 'Skill Feat', level: 1, slot: slot.key, takenLevel: 5 },
      { name: 'Fleet', type: 'General Feat', level: 1, slot: 'general:3:0' },
    ] }
    expect(replacements(character)).toEqual([slot])
    expect(unslottedFeats(character, data)).not.toContainEqual(character.feats[1])
  })
})

it('reads concatenated Starfinder Mechanic class skill proficiencies', () => {
  const mechanic = { ...entry('class', 'Mechanic', {
    skill_proficiency: 'Trained in Computers Trained in Crafting Trained in a number of additional skills equal to 2 plus your Intelligence modifier',
  }), systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], className: 'Mechanic', background: undefined }
  expect(classSkills(mechanic)).toEqual({ fixed: ['Computers', 'Crafting'], choices: [], additional: 2 })
  expect(ranksAt(c, [mechanic])).toMatchObject({ Computers: 1, Crafting: 1 })
  expect(additionalSkillCount(c, [mechanic])).toBe(2)
})

it("restricts Mechanic's Ingenuity bonus feats to Computers or Crafting", () => {
  const c: Character = { ...base, systems: ['sf2e'], className: 'Mechanic', level: 15 }
  const slots = plannedSlots(c).filter(slot => slot.grantedBy === "Mechanic's Ingenuity")
  expect(slots.map(slot => slot.level)).toEqual([3, 7, 15])
  const feats = ['Computers', 'Crafting', 'Medicine'].map(skill => ({
    ...entry('feat', `${skill} Feat`, { skill }, 1, ['General', 'Skill']), systems: ['sf2e' as const],
  }))
  expect(eligibleFeats(feats, c, slots[0]).map(feat => feat.name)).toEqual(['Computers Feat', 'Crafting Feat'])
  expect(plannedSlots({ ...c, level: 2 }).some(slot => slot.grantedBy === "Mechanic's Ingenuity")).toBe(false)
})

it("applies only legal Mechanic's Ingenuity skill increases at their levels", () => {
  const mechanic = { ...entry('class', 'Mechanic', {
    skill_proficiency: 'Trained in Computers, Trained in Crafting, Trained in a number of additional skills equal to 2 plus your Intelligence modifier',
  }), systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], className: 'Mechanic', level: 15, background: undefined,
    skillPicks: ['Athletics'], skillIncreases: { 'mechanic-ingenuity:3': 'Computers',
      'mechanic-ingenuity:7': 'Computers', 'mechanic-ingenuity:15': 'Computers' } }
  expect(ranksAt(c, [mechanic])).toMatchObject({ Computers: 4, Crafting: 1, Athletics: 1 })
  expect(ranksAt({ ...c, level: 6 }, [mechanic])).toMatchObject({ Computers: 2, Crafting: 1 })
  expect(ranksAt({ ...c, skillIncreases: { 'mechanic-ingenuity:3': 'Athletics' } }, [mechanic]).Athletics).toBe(1)
  expect(ranksAt({ ...c, level: 3, skillIncreases: { 3: 'Computers', 'mechanic-ingenuity:3': 'Computers' } }, [mechanic]).Computers).toBe(2)
})

it('applies Test-Subject Ysoki and Rat Retinal HUD training without duplicating Computers', () => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Test-Subject Ysoki',
    className: 'Operative', background: undefined, testSubjectAdaptation: 'Cybernetic Augmentation',
    feats: [{ name: 'Rat Retinal HUD', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
  const operative = { ...entry('class', 'Operative', { skill_proficiency: 'Trained in Computers, Trained in a number of additional skills equal to 2 plus your Intelligence modifier' }), systems: ['sf2e'] as const }
  const catalog: ContentEntry[] = [{ ...operative, systems: ['sf2e'] }]
  expect(ranksAt(c, catalog).Computers).toBe(1)
  expect(additionalSkillCount(c, catalog)).toBe(4)
  expect(automaticFeatGrants(c, catalog)).toContainEqual({ name: 'Assurance', choice: 'Computers', source: 'Test-Subject Ysoki', level: 1 })
  expect(additionalSkillCount({ ...c, feats: [] }, catalog)).toBe(3)
  expect(additionalSkillCount({ ...c, testSubjectAdaptation: undefined }, catalog)).toBe(3)
  const noComputerClass = { ...c, className: undefined }
  expect(ranksAt(noComputerClass, []).Computers).toBe(1)
  expect(additionalSkillCount(noComputerClass, [])).toBe(1)
  expect(ranksAt({ ...noComputerClass, feats: [], testSubjectAdaptation: undefined }, []).Computers ?? 0).toBe(0)
  expect(senses({ ...c, testSubjectAdaptation: 'Psychic Augmentation' }, [])).toContainEqual({
    value: 'Limited Telepathy 30 feet', source: 'Test-Subject Ysoki',
  })
  const telepathicFeat = entry('feat', 'Telepathic Feat', { prerequisite: 'limited telepathy' })
  expect(featPrerequisiteChecker({ ...c, testSubjectAdaptation: 'Psychic Augmentation' }, [telepathicFeat])(telepathicFeat).missing).toEqual([])
  expect(featPrerequisiteChecker({ ...c, testSubjectAdaptation: 'Radioactive' }, [telepathicFeat])(telepathicFeat).missing).not.toEqual([])
})

it('grants Cyborg the cybernetic Test-Subject benefits only while the house rule is enabled', () => {
  const previous = getSettings().cyborgTestSubject
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Cyborg', className: 'Operative', background: undefined }
  const operative = { ...entry('class', 'Operative', { skill_proficiency: 'Trained in Computers, Trained in a number of additional skills equal to 2 plus your Intelligence modifier' }), systems: ['sf2e' as const] }
  const heritage = { ...entry('heritage', 'Test-Subject Ysoki'), systems: ['sf2e' as const] }
  const gated = { ...entry('feat', 'Heritage Gate', { prerequisite: 'Test-Subject Ysoki heritage' }), systems: ['sf2e' as const] }
  try {
    updateSettings({ cyborgTestSubject: true })
    expect(ranksAt(c, [operative]).Computers).toBe(1)
    expect(additionalSkillCount(c, [operative])).toBe(3)
    expect(automaticFeatGrants(c, [operative])).toContainEqual({ name: 'Assurance', choice: 'Computers', source: 'Test-Subject Ysoki', level: 1 })
    expect(featPrerequisiteChecker(c, [heritage, gated])(gated).missing).toEqual([])
    expect(ranksAt({ ...c, className: undefined }, []).Computers).toBe(1)
    updateSettings({ cyborgTestSubject: false })
    expect(additionalSkillCount(c, [operative])).toBe(2)
    expect(automaticFeatGrants(c, [operative])).not.toContainEqual(expect.objectContaining({ source: 'Test-Subject Ysoki' }))
    expect(featPrerequisiteChecker(c, [heritage, gated])(gated).missing).not.toEqual([])
    expect(ranksAt({ ...c, className: undefined }, []).Computers ?? 0).toBe(0)
  } finally { updateSettings({ cyborgTestSubject: previous }) }
})

it('applies Cyborg frame training, granted feats, and selected resistance', () => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Cyborg', className: 'Operative', background: undefined, level: 9,
    feats: [{ name: 'X-hat Firewalker Frame', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
      { name: 'Deflective Plating', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: 'Fire' },
      { name: 'Data Retrieval', type: 'Ancestry Feat', level: 5, slot: 'ancestry:9:0' }] }
  const operative = { ...entry('class', 'Operative', { skill_proficiency: 'Trained in Computers, Trained in a number of additional skills equal to 2 plus your Intelligence modifier' }), systems: ['sf2e' as const] }
  expect(additionalSkillCount(c, [operative])).toBe(4)
  expect(automaticFeatGrants(c, [operative])).toEqual(expect.arrayContaining([
    { name: 'Phreaker', source: 'X-hat Firewalker Frame', level: 1 },
    { name: 'Open-Source Research', source: 'Data Retrieval', level: 9 },
  ]))
  expect(resistances(c, [])).toContainEqual({ damage: 'Fire', value: 4, source: 'Deflective Plating' })
  expect(resistances({ ...c, feats: c.feats.map(feat => feat.name === 'Deflective Plating' ? { ...feat, choice: 'Invalid' } : feat) }, []))
    .not.toContainEqual(expect.objectContaining({ source: 'Deflective Plating' }))
  const fleet: Character = { ...c, feats: [{ name: 'Gg-os Frame', type: 'Ancestry Feat', level: 1 }] }
  expect(speed(fleet, [])).toBe(30)
  expect(speed({ ...fleet, feats: [...fleet.feats, { name: 'Fleet', type: 'General Feat', level: 1 }] }, [])).toBe(30)
  const fist = { id: 'fist', name: 'Fist', potency: 0, striking: 0, runes: [] }
  const pistons: Character = { ...c, feats: [{ name: 'Hydraulic Pistons', type: 'Ancestry Feat', level: 5 }] }
  expect(weaponAttack(pistons, [], fist)).toMatchObject({ traits: expect.arrayContaining(['Boost d4', 'Tech']), criticalSpecialization: true })
  expect(automaticFeatGrants(pistons, [])).toContainEqual({ name: 'Quick Jump', source: 'Hydraulic Pistons', level: 5 })
})

it('applies sensory upgrades and ancestry-specific burrowing', () => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Ysoki', level: 9, feats: [
    { name: 'Adaptive Visual Receptors', type: 'Ancestry Feat', level: 1 },
    { name: 'Enhanced Olfactory System', type: 'Ancestry Feat', level: 1 },
    { name: 'Enhanced Senses', type: 'Ancestry Feat', level: 1 },
    { name: 'Burrowing Specialist', type: 'Ancestry Feat', level: 9 },
  ] }
  const ancestry = { ...entry('ancestry', 'Ysoki', { vision: 'Low-Light Vision' }), systems: ['sf2e' as const] }
  const burrow = { ...entry('feat', 'Burrowing Specialist', {}, 9, ['Ysoki']), systems: ['sf2e' as const], description: 'Option(s): 10 feet' }
  expect(senses(c, [ancestry])).toEqual(expect.arrayContaining([
    { value: 'Darkvision', source: 'Adaptive Visual Receptors' },
    { value: 'Scent (imprecise) 60 feet', source: 'Enhanced Olfactory System, Enhanced Senses' },
  ]))
  expect(movementSpeeds(c, [ancestry, burrow])).toContainEqual({ name: 'Burrow', feet: 10, source: 'Burrowing Specialist' })
  expect(movementSpeeds({ ...c, level: 8 }, [ancestry, burrow]).some(speed => speed.name === 'Burrow')).toBe(false)
})

it('grants Intimidating Glare instead of a replacement skill when already trained', () => {
  const background = entry('background', 'Guard', { skill: 'Intimidation' })
  const c: Character = { ...base, systems: ['sf2e'], background: 'Guard', className: undefined,
    feats: [{ name: 'Pick On Someone My Size', type: 'Ancestry Feat', level: 1 }] }
  expect(automaticFeatGrants(c, [background])).toContainEqual({ name: 'Intimidating Glare', source: 'Pick On Someone My Size', level: 1 })
  expect(additionalSkillCount(c, [background])).toBe(0)
  expect(ranksAt({ ...c, background: undefined }, []).Intimidation).toBe(1)
  expect(automaticFeatGrants({ ...c, background: undefined }, [])).not.toContainEqual(expect.objectContaining({ name: 'Intimidating Glare' }))
})

it('grants Ysoki lore, skills and replacement training in normal skill selections', () => {
  const ancestral = { ...entry('feat', 'Ancestral Skills', {}, 1, ['Ysoki']), systems: ['sf2e' as const], description: 'Option(s): Society, Stealth' }
  const background = entry('background', 'Sneak', { skill: 'Stealth, Deception' })
  const names = ["Grandmother's Lore", 'Ysoki Lore', 'Tinkering Fingers', 'Extended Family', 'Ancestral Skills']
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Ysoki', className: undefined, background: 'Sneak', level: 7,
    feats: names.map((name, i) => ({ name, type: 'Ancestry Feat', level: 1, slot: `ancestry:${i ? 5 : 1}:${i}` })) }
  const catalog = [ancestral, background]
  expect(ranksAt(c, catalog)).toMatchObject({ Deception: 1, Thievery: 1, Acrobatics: 1, Stealth: 1,
    Crafting: 1, Diplomacy: 1, Society: 1, 'Ysoki Lore': 3, 'Lao Shu Po Lore': 3 })
  expect(additionalSkillCount(c, catalog)).toBe(3)
  expect(automaticFeatGrants(c, catalog)).toEqual(expect.arrayContaining([
    { name: 'Additional Lore', choice: 'Lao Shu Po', source: "Grandmother's Lore", level: 1 },
    { name: 'Additional Lore', choice: 'Ysoki', source: 'Ysoki Lore', level: 5 },
  ]))
  expect(ranksAt({ ...c, level: 1 }, catalog).Crafting ?? 0).toBe(0)
})

it('hides generic Ancestral Skills only when the matching ancestry lore feat teaches identical skills', () => {
  const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
  const ancestral = { ...entry('feat', 'Ancestral Skills', {}, 1, ['Orc']), systems: ['sf2e' as const], description: 'Option(s): Athletics, Survival' }
  const lore = { ...entry('feat', 'Orc Lore', {}, 1, ['Orc']), systems: ['pf2e' as const] }
  const c: Character = { ...base, ancestry: 'Orc', systems: ['pf2e', 'sf2e'], feats: [] }
  expect(eligibleFeats([ancestral, lore], c, slot).map(feat => feat.name)).toEqual(['Orc Lore'])
  const different = { ...ancestral, description: 'Option(s): Society, Survival' }
  expect(eligibleFeats([different, lore], c, slot).map(feat => feat.name)).toContain('Ancestral Skills')
  expect(eligibleFeats([ancestral], c, slot).map(feat => feat.name)).toContain('Ancestral Skills')
  const elfSkills = { ...ancestral, traits: ['Elf'], description: 'Option(s): Arcana, Nature' }
  const elfLore = { ...lore, name: 'Elven Lore', traits: ['Elf'],
    description: 'You gain the trained proficiency rank in Arcana and Nature. You also gain the Additional Lore general feat for Elf Lore.' }
  const elf = { ...c, ancestry: 'Elf' }
  expect(eligibleFeats([elfSkills, elfLore], elf, slot).map(feat => feat.name)).toEqual(['Elven Lore'])
  const selected = { ...elf, feats: [{ name: 'Elven Lore', type: 'Ancestry Feat', level: 1 }] }
  expect(ranksAt(selected, [elfSkills, elfLore])).toMatchObject({ Arcana: 1, Nature: 1, 'Elf Lore': 1 })
})

it('prefers an ancestry-specific Prehensile Tail while preserving existing limb selections', () => {
  const slot = { key: 'ancestry:5:0', category: 'ancestry' as const, level: 5 }
  const tail = { ...entry('feat', 'Prehensile Tail', {}, 5, ['Ysoki']), systems: ['sf2e' as const] }
  const limb = { ...entry('feat', 'Prehensile Limbs', {}, 5, ['Ysoki']), systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Ysoki', level: 9, feats: [] }
  expect(eligibleFeats([tail, limb], c, slot).map(feat => feat.name)).toEqual(['Prehensile Tail'])
  expect(eligibleFeats([limb], c, slot).map(feat => feat.name)).toEqual(['Prehensile Limbs'])
  expect(eligibleFeats([{ ...tail, traits: ['Ord'] }, limb], c, slot).map(feat => feat.name)).toEqual(['Prehensile Limbs'])
  const chosen = { ...c, feats: [{ name: 'Prehensile Limbs', type: 'Ancestry Feat', level: 5, slot: slot.key }] }
  expect(eligibleFeats([tail, limb], chosen, slot).map(feat => feat.name)).toContain('Prehensile Limbs')
  const tailTaken = { ...c, feats: [{ name: 'Prehensile Tail', type: 'Ancestry Feat', level: 5, slot: slot.key }] }
  expect(eligibleFeats([tail, limb], tailTaken, { ...slot, key: 'ancestry:9:0', level: 9 })).toEqual([])
})

it("grants Officer's Education benefits twice at their selected levels", () => {
  const education = entry('feat', "Officer's Education", { repeatable: true }, 8, ['Commander'])
  const ordinary = entry('feat', 'Advanced General', {}, 7, ['General'])
  const restricted = entry('feat', 'Restricted General', { prerequisite: 'master in Medicine' }, 7, ['General'])
  const first = { name: education.name, type: 'Class Feat', level: 8, slot: 'class:8:0' }
  const second = { ...first, slot: 'class:12:0' }
  const c: Character = { ...base, className: 'Commander', level: 12, feats: [first, second],
    skillPicks: ['Medicine', 'Society'], skillIncreases: {
      'officer-education:class:8:0': 'Medicine', 'officer-education:class:12:0': 'Society',
    } }
  const one = { ...c, feats: [first] }
  expect(additionalSkillCount(c, entries) - additionalSkillCount({ ...c, feats: [] }, entries)).toBe(4)
  expect(additionalSkillCount(one, entries) - additionalSkillCount({ ...c, feats: [] }, entries)).toBe(2)
  expect(languageAllowance(c, entries)).toMatchObject({ slots: 3, commonOnlySlots: 2 })
  expect(languageAllowance({ ...c, level: 7 }, entries)).toMatchObject({ slots: 1, commonOnlySlots: 0 })
  expect(ranksAt(c, entries)).toMatchObject({ Medicine: 2, Society: 2 })
  expect(ranksAt({ ...c, level: 9 }, entries)).toMatchObject({ Medicine: 2, Society: 1 })
  expect(ranksAt({ ...c, feats: [] }, entries)).toMatchObject({ Medicine: 1, Society: 1 })
  const slots = plannedSlots(c).filter(slot => slot.grantedBy === education.name)
  expect(slots.map(slot => [slot.key, slot.level])).toEqual([
    ['general:1:officer-education:class:8:0', 8], ['general:1:officer-education:class:12:0', 12],
  ])
  expect(eligibleFeats([ordinary, restricted], c, slots[0]).map(feat => feat.name)).toEqual(['Advanced General'])
  const classSlot = { key: 'class:14:0', category: 'class' as const, level: 14 }
  expect(eligibleFeats([education], { ...c, level: 14, feats: [first] }, classSlot)).toContainEqual(education)
  expect(eligibleFeats([education], { ...c, level: 14 }, classSlot)).toEqual([])
  expect(eligibleFeats([education], c, { ...classSlot, key: second.slot, level: 12 })).toContainEqual(education)
})

describe('subclass skill grants', () => {
  it('parses Starfinder class choice and excludes subclass placeholders', () => {
    const envoy = entry('class', 'Envoy', { skill_proficiency: 'Trained in one of the following skills of your choice: Deception, Diplomacy, Intimidation, Trained in one skill based on your leadership style, Trained in a number of additional skills equal to 6 plus your Intelligence modifier' })
    expect(classSkills(envoy)).toEqual({ fixed: [], choices: ['Deception', 'Diplomacy', 'Intimidation'], additional: 6 })
    const oracle = entry('class', 'Oracle', { skill_proficiency: 'Trained in Religion, Trained in one skill determined by your mystery' })
    expect(classSkills(oracle).fixed).toEqual(['Religion'])
  })

  it('grants methodology and style skills and preserves individual choices', () => {
    const c = { ...base, background: undefined, className: 'Investigator', subclass: 'Empiricism',
      subclassSkillChoices: { 'Investigator:Empiricism': 'Lore', 'Investigator:Empiricism:lore': 'Sailing Lore',
        'Investigator:Esoterica': 'Religion' } }
    expect(subclassSkillChoice(c, [])?.options).toContain('Lore')
    expect(subclassSkillGrants(c, [])).toEqual(['Sailing Lore'])
    expect(subclassSkillGrants({ ...c, subclass: 'Esoterica' }, [])).toEqual(['Religion'])
    expect(subclassSkillGrants({ ...c, subclass: 'Forensic Medicine' }, [])).toEqual(['Medicine'])
    expect(subclassSkillGrants({ ...c, subclassSkillChoices: { 'Investigator:Empiricism': 'Athletics' } }, [])).toEqual([])
    expect(subclassSkillGrants({ ...c, className: 'Swashbuckler', subclass: 'Wit' }, [])).toEqual(['Diplomacy'])
  })

  it('uses catalog bloodline, patron and mystery skills and handles selected exemplar and Lore', () => {
    const options = [
      entry('subclass', 'Draconic', { class: 'Sorcerer', skill: 'Intimidation' }),
      entry('subclass', 'Imperial', { class: 'Sorcerer', skill: 'Arcana, Society' }),
      entry('subclass', 'Lore', { class: 'Oracle', skill: 'Occultism' }),
      entry('subclass', 'The Inscribed One', { class: 'Witch', skill: 'Arcana' }),
    ]
    const c = { ...base, background: undefined, className: 'Sorcerer', subclass: 'Draconic',
      subclassSkillChoices: { 'Sorcerer:Draconic': 'Primal', 'Oracle:Lore': 'Sailing Lore' } }
    expect(subclassSkillGrants(c, options)).toEqual(['Intimidation', 'Nature'])
    expect(subclassSkillGrants({ ...c, subclass: 'Imperial' }, options)).toEqual(['Arcana', 'Society'])
    expect(subclassSkillGrants({ ...c, className: 'Witch', subclass: 'The Inscribed One' }, options)).toEqual(['Arcana'])
    const oracle = { ...c, className: 'Oracle', subclass: 'Lore', level: 7 }
    const previous = getSettings()
    try {
      updateSettings({ autoClassSkills: false, autoLores: false })
      expect(ranksAt(oracle, options)).toMatchObject({ Occultism: 1, 'Sailing Lore': 1 })
      updateSettings({ autoLores: true })
      expect(ranksAt(oracle, options)['Sailing Lore']).toBe(3)
      updateSettings({ autoLores: false, autoClassSkills: true })
      expect(ranksAt(oracle, options)['Sailing Lore']).toBe(3)
    } finally { updateSettings(previous) }
  })

  it('makes all Starfinder subclass skills available only to eligible systems', () => {
    const expected: Record<string, string[]> = {
      Envoy: ['Athletics', 'Stealth', 'Acrobatics', 'Performance', 'Computers', 'Medicine'],
      Mystic: ['Occultism', 'Nature', 'Medicine', 'Performance', 'Stealth'],
      Operative: ['Deception', 'Computers', 'Acrobatics', 'Stealth', 'Athletics'],
      Witchwarper: ['Computers', 'Deception', 'Society', 'Piloting'],
    }
    for (const [className, skills] of Object.entries(expected)) {
      const sf = { ...base, systems: ['sf2e'] as Character['systems'], className }
      const options = subclassOptions(sf, [])
      expect(options.map(option => option.data.skill).sort()).toEqual(skills.sort())
      for (const option of options) {
        expect(subclassSkillGrants({ ...sf, subclass: option.name }, [])).toEqual([option.data.skill])
      }
      expect(subclassOptions({ ...sf, systems: ['pf2e'] }, [])).toEqual([])
    }
  })

  it('replaces overlapping subclass training without consuming regular choices', () => {
    const klass = entry('class', 'Investigator', { skill_proficiency: 'Trained in Society, Trained in a number of additional skills equal to 4 plus your Intelligence modifier' })
    const background = entry('background', 'Doctor', { skill: 'Medicine' })
    const c = { ...base, background: 'Doctor', className: 'Investigator', subclass: 'Forensic Medicine', skillPicks: ['Medicine'] }
    expect(ranksAt(c, [klass, background]).Medicine).toBe(1)
    expect(additionalSkillCount(c, [klass, background])).toBe(5)
    expect(skillRankBudget(c, [klass, background]).trained).toBe(5)
    expect(additionalSkillCount({ ...c, subclass: 'Interrogation' }, [klass, background])).toBe(4)
  })

  it('normalizes remastered Untamed order and corrects Flame and Leaf skills', () => {
    const druid = { ...base, background: undefined, className: 'Druid', order: 'Untamed' }
    expect(subclassSkillGrants(druid, [])).toEqual(['Intimidation'])
    expect(classLabel(druid)).toBe('Druid of the Untamed Order')
    expect(focusSpells(druid, []).spells.map(spell => spell.name)).toContain('Untamed Shift')
    expect(availableOrders(druid)).not.toContain('Wild')
    expect(subclassSkillGrants({ ...druid, order: 'Flame' }, [])).toEqual(['Acrobatics'])
    expect(subclassSkillGrants({ ...druid, order: 'Leaf' }, [])).toEqual(['Diplomacy'])
  })
})

it('limits advanced domains to eligible initial choices available at the feat level', () => {
  const deity = entry('deity', 'Gozreh', { domain_primary: 'Air, Nature, Travel, Water, water', domain_alternate: 'Fire' })
  const c: Character = { ...base, level: 10, deity: 'Gozreh', feats: [
    { name: "Deity's Domain", type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'water' },
    { name: "Deity's Domain", type: 'Class Feat', level: 1, slot: 'class:10:0', choice: 'Air' },
    { name: 'Domain Initiate', type: 'Class Feat', level: 1, slot: 'class:1:1', choice: 'Nature' },
    { name: "Deity's Domain", type: 'Class Feat', level: 1, slot: 'class:1:2', choice: 'Fire' },
    { name: "Advanced Deity's Domain", type: 'Class Feat', level: 8, slot: 'class:8:0', choice: 'Water' },
  ] }
  expect(featChoiceOptions("Deity's Domain", c, [deity], 'class:1:3')).toEqual(['Air', 'Nature', 'Travel', 'Water'])
  expect(featChoiceOptions("Advanced Deity's Domain", c, [deity], 'class:8:0')).toEqual(['Water'])
  expect(featChoiceOptions("Advanced Deity's Domain", c, [deity], 'class:8:1')).toEqual([])
  expect(featChoiceOptions('Advanced Domain', c, [deity], 'class:8:1')).toEqual(['Nature', 'Water'])
  expect(featChoiceOptions("Deity's Domain", { ...c, deity: undefined }, [deity], 'class:1:3')).toEqual([])
  expect(featChoiceOptions("Advanced Deity's Domain", { ...c, deity: undefined }, [deity], 'class:8:0')).toEqual([])
})

describe('official passive feat mechanics', () => {
  it('grants Dwarven Lore and Clan Lore skills, lore, and replacements for already-trained skills', () => {
    const dwarvenLore = { name: 'Dwarven Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    const clanLore = { name: 'Clan Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'Breakiron' }
    const dwarf = { ...base, ancestry: 'Dwarf', background: undefined }
    const dwarven = { ...dwarf, feats: [dwarvenLore] }
    expect(ranksAt(dwarven, entries)).toMatchObject({ Crafting: 1, Religion: 1, 'Dwarven Lore': 1 })
    expect(featLores(dwarven, entries)).toContain('Dwarven Lore')

    const replacedDwarven = { ...dwarf, skillPicks: ['Crafting', 'Religion'], feats: [
      { ...dwarvenLore, replacements: ['Society', 'Athletics'] },
    ] }
    const dwarfChoices = loreReplacementChoices(replacedDwarven, entries, 0)
    expect(dwarfChoices.map(({ skill, value }) => [skill, value])).toEqual([
      ['Crafting', 'Society'], ['Religion', 'Athletics'],
    ])
    expect(dwarfChoices[1].options).not.toContain('Society')
    expect(ranksAt(replacedDwarven, entries)).toMatchObject({ Society: 1, Athletics: 1 })

    const clan = { ...dwarf, skillPicks: ['Crafting'], feats: [clanLore] }
    expect(featChoiceOptions('Clan Lore', clan, entries, clanLore.slot, 0)).toContain('Breakiron')
    expect(featLores(clan, entries)).toContain('Alchemy Lore')
    expect(ranksAt(clan, entries)).toMatchObject({ Crafting: 1, Survival: 1 })
    const replacedClan = { ...clan, feats: [{ ...clanLore, replacements: ['Society'] }] }
    expect(loreReplacementChoices(replacedClan, entries, 0).map(({ skill }) => skill)).toEqual(['Crafting'])
    expect(ranksAt(replacedClan, entries).Society).toBe(1)
  })

  it('grants Stonemason’s Eye and Eye for Treasure mechanics only when their prerequisites apply', () => {
    const stone = { name: "Stonemason's Eye", type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    const treasure = { name: 'Eye for Treasure', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    const untrained = { ...base, background: undefined }
    const stonemason = { ...untrained, feats: [stone] }
    expect(ranksAt(stonemason, entries).Crafting).toBe(1)
    expect(automaticFeatGrants(stonemason, entries)).not.toContainEqual(expect.objectContaining({ name: 'Specialty Crafting' }))
    expect(perceptionCircumstance({ ...stonemason, activeFeatEffects: ["Stonemason's Eye"] }))
      .toEqual({ value: 2, source: "Stonemason's Eye" })
    const trainedStonemason = { ...stonemason, skillPicks: ['Crafting'] }
    expect(automaticFeatGrants(trainedStonemason, entries)).toContainEqual({
      name: 'Specialty Crafting', choice: 'Stonemasonry', source: "Stonemason's Eye", level: 1,
    })

    const untrainedTreasure = { ...untrained, feats: [treasure] }
    expect(ranksAt(untrainedTreasure, entries).Crafting).toBe(1)
    expect(automaticFeatGrants(untrainedTreasure, entries)).toContainEqual({
      name: "Crafter's Appraisal", source: 'Eye for Treasure', level: 1,
    })
    const trainedTreasure = { ...untrained, skillPicks: ['Crafting'], feats: [{ ...treasure, choice: 'Society' }] }
    expect(featChoiceOptions('Eye for Treasure', trainedTreasure, entries, treasure.slot, 0)).toContain('Society')
    expect(ranksAt(trainedTreasure, entries).Society).toBe(1)
  })

  it('grants Pioneer Human Survival and Terrain Expertise without consuming a feat or training pick', () => {
    const c: Character = { ...base, ancestry: 'Human', heritage: 'Pioneer Human', level: 19, skillPicks: [] }
    expect(ranksAt(c, entries).Survival).toBe(1)
    expect(ranksAt({ ...c, skillIncreases: { 3: 'Survival', 7: 'Survival' } }, entries).Survival).toBe(3)
    expect(ranksAt({ ...c, rankOverrides: { Survival: 0 } }, entries).Survival).toBe(1)
    expect(additionalSkillCount(c, entries)).toBe(additionalSkillCount(base, entries))
    expect(automaticFeatGrants(c, entries)).toContainEqual({ name: 'Terrain Expertise', source: 'Pioneer Human', level: 1 })
    expect(automaticFeatGrants({ ...c, pioneerTerrain: 'Arctic' }, entries))
      .toContainEqual({ name: 'Terrain Expertise', choice: 'Arctic', source: 'Pioneer Human', level: 1 })
    const terrain = entry('feat', 'Terrain Expertise', { prerequisite: 'Trained in Survival' }, 1, ['General', 'Skill'])
    const target = entry('feat', 'Terrain Follow-up', { prerequisite: 'Terrain Expertise; Trained in Survival' })
    expect(featPrerequisiteChecker(c, [...entries, terrain, target])(target)).toEqual({ missing: [], manual: [] })
    const other = { ...c, heritage: 'Versatile Human' }
    expect(ranksAt(other, entries).Survival ?? 0).toBe(0)
    expect(automaticFeatGrants(other, entries)).not.toContainEqual(expect.objectContaining({ name: 'Terrain Expertise' }))
  })

  it('gives exactly one replacement training pick when class, background, or both also grant Survival', () => {
    const ranger = entry('class', 'Ranger', { skill_proficiency: 'Trained in Nature, Trained in Survival, Trained in a number of additional skills equal to 4 plus your Intelligence modifier' })
    const hunter = entry('background', 'Hunter', { skill: 'Survival' })
    const data = [...entries.filter(entry => entry.name !== 'Ranger'), ranger, hunter]
    for (const [className, background] of [['Ranger', 'Scholar'], ['Wizard', 'Hunter'], ['Ranger', 'Hunter']]) {
      const c: Character = { ...base, className, background, heritage: 'Pioneer Human' }
      expect(additionalSkillCount(c, data) - additionalSkillCount({ ...c, heritage: undefined }, data)).toBe(1)
      expect(skillRankBudget({ ...c, skillPicks: ['Athletics'] }, data).trained).toBe(additionalSkillCount(c, data) - 1)
    }
  })

  it('applies Terrain Expertise only in chosen terrain, supports SF space, and prevents duplicate choices', () => {
    const c: Character = { ...base, systems: ['sf2e'], heritage: 'Pioneer Human', pioneerTerrain: 'Forest',
      activeFeatEffects: ['Terrain Expertise'], feats: [{ name: 'Terrain Expertise', type: 'Skill Feat', level: 1, slot: 'skill:2:0', choice: 'Space' }], level: 7 }
    expect(terrainExpertiseBenefits(c)).toEqual({ terrains: ['Forest', 'Space'], bonus: 1 })
    expect(terrainExpertiseBenefits({ ...c, activeFeatEffects: [] })?.bonus).toBe(0)
    expect(terrainExpertiseBenefits({ ...c, systems: ['pf2e'], heritage: undefined })).toBeUndefined()
    expect(terrainExpertiseBenefits({ ...c, level: 1 })).toEqual({ terrains: ['Forest'], bonus: 1 })
    expect(terrainExpertiseOptions(c)).not.toContain('Forest')
    expect(terrainExpertiseOptions(c)).not.toContain('Space')
    expect(terrainExpertiseOptions(c, 'pioneer')).toContain('Forest')
    expect(terrainExpertiseOptions(c, 0)).toContain('Space')
    expect(terrainExpertiseBenefits(JSON.parse(JSON.stringify(c)))).toEqual(terrainExpertiseBenefits(c))
  })

  it('grants ancestry-specific Ancestral Skills training and replacement choices for class/background overlaps', () => {
    const feat = mapAonHit({ _id: 'human-ancestral-skills', _source: {
      category: 'feat', name: 'Ancestral Skills', level: 1, trait: ['Human'],
      markdown: "**[Option(s)](/feats/1046-ancestral-skills)**: [Diplomacy](/skills/7-diplomacy), [Society](/skills/16-society)",
    } }, 'sf2e')!
    const data = [
      { ...feat, id: 'elf-skills', traits: ['Elf'], description: 'Option(s): Arcana, Nature' }, feat,
      entry('class', 'Wizard', { skill_proficiency: 'Trained in Society, Trained in a number of additional skills equal to 2 plus your Intelligence modifier' }),
      entry('background', 'Envoy', { skill: 'Diplomacy' }),
    ]
    const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Human', background: 'Envoy',
      feats: [{ name: feat.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
    expect(ancestralSkills(c, data)).toEqual(['Diplomacy', 'Society'])
    expect(ranksAt(c, data)).toMatchObject({ Diplomacy: 1, Society: 1, 'Human Lore': 1 })
    expect(additionalSkillCount(c, data)).toBe(4)
    expect(additionalSkillCount({ ...c, feats: [] }, data)).toBe(2)
    const later = { ...c, level: 5, className: undefined, background: undefined,
      feats: [{ ...c.feats[0], slot: 'ancestry:5:0' }] }
    expect(ranksAt(later, data, 5).Diplomacy ?? 0).toBe(0)
    expect(ranksAt({ ...later, level: 4 }, data).Diplomacy ?? 0).toBe(0)
    expect(ranksAt({ ...later, skillIncreases: { 3: 'Diplomacy' } }, data).Diplomacy).toBe(1)
    expect(ranksAt({ ...later, level: 7, skillIncreases: { 7: 'Diplomacy' } }, data).Diplomacy).toBe(2)
    expect(ranksAt({ ...later, rankOverrides: { Diplomacy: 0 } }, data).Diplomacy).toBe(1)
    expect(ancestralSkills({ ...c, ancestry: 'Elf' }, data)).toEqual(['Arcana', 'Nature'])
    expect(ancestralSkills({ ...c, systems: ['pf2e'] }, data)).toEqual([])
    const updated = data.map(entry => entry.id === feat.id ? { ...entry, description: 'Option(s): Medicine, Survival' } : entry)
    expect(ancestralSkills(c, updated)).toEqual(['Medicine', 'Survival'])
    expect(ancestralSkills(c, updated.map(entry => entry.id === feat.id ? { ...entry, deleted: true } : entry))).toEqual([])
  })

  it('applies favored-terrain movement only in that terrain with Unimpeded Journey and preserves Terrain Master overrides', ({ onTestFinished }) => {
    const previous = getSettings().championFormNoFlight
    onTestFinished(() => updateSettings({ championFormNoFlight: previous }))
    updateSettings({ championFormNoFlight: false })
    const favored = { name: 'Favored Terrain', type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Plains' }
    const c: Character = { ...base, className: 'Ranger', level: 11,
      feats: [favored, { name: 'Fleet', type: 'General Feat', level: 1, slot: 'general:3:0' }],
      activeFeatEffects: ['Favored Terrain'] }
    expect(speed(c, [])).toBe(40)
    expect(speed({ ...c, level: 10 }, [])).toBe(30)
    expect(speed({ ...c, activeFeatEffects: [] }, [])).toBe(30)
    expect(speed({ ...c, className: 'Wizard' }, [])).toBe(30)
    const master = { ...c, feats: [...c.feats, { name: 'Terrain Master', type: 'Class Feat', level: 8, slot: 'class:8:0' }],
      favoredTerrain: 'Forest' }
    expect(movementSpeeds(JSON.parse(JSON.stringify(master)), [])).toEqual([
      { name: 'Land', feet: 30 }, { name: 'Climb', feet: 30, source: 'Favored Terrain (Forest)' },
    ])
    expect(speed({ ...master, favoredTerrain: undefined }, [])).toBe(40)
    expect(speed({ ...master, favoredTerrain: undefined, activeFeatEffects: [] }, [])).toBe(40)
    expect(speed({ ...c, favoredTerrain: 'Forest' }, [])).toBe(40)
    const aquatic = { ...c, feats: [{ ...favored, choice: 'Aquatic' }, c.feats[1]] }
    expect(movementSpeeds(aquatic, [])[1]).toMatchObject({ name: 'Swim', feet: 30 })
    expect(movementSpeeds({ ...aquatic, feats: [...aquatic.feats, { name: 'Natural Swimmer', type: 'Ancestry Feat', level: 1 }] }, [])[1])
      .toMatchObject({ name: 'Swim', feet: 25 })
    const sky = { ...c, feats: [{ ...favored, choice: 'Sky' }, c.feats[1]] }
    expect(movementSpeeds(sky, [])).toHaveLength(1)
    const flying: Character = { ...sky, animalFeature: 'Wings', activeSpells: ['Animal Feature', 'Canopy Crawler'],
      spells: [{ name: 'Canopy Crawler', rank: 2, cantrip: false }],
      feats: [...sky.feats, { name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' }] }
    expect(movementSpeeds(flying, []).map(({ name, feet }) => ({ name, feet }))).toEqual([
      { name: 'Land', feet: 30 }, { name: 'Climb', feet: 40 }, { name: 'Fly', feet: 40 },
    ])
  })

  it('grants Stormwind Flight Speed only while the known spell is active', () => {
    const c: Character = { ...base, level: 8, spells: [{ name: 'Stormwind Flight', rank: 4, cantrip: false }],
      activeSpells: ['Stormwind Flight'], feats: [{ name: 'Fleet', type: 'General Feat', level: 1 }] }
    expect(movementSpeeds(c, [])).toContainEqual({ name: 'Fly', feet: 30, source: 'Stormwind Flight' })
    expect(movementSpeeds({ ...c, activeSpells: [] }, [])).toHaveLength(1)
    expect(movementSpeeds({ ...c, spells: [] }, [])).toHaveLength(1)
  })

  it.each([
    { source: 'Greenwatch Initiate', skill: 'Survival', grants: ['Experienced Tracker', 'Survey Wildlife'] },
    { source: 'Greywatch Initiate', skill: 'Deception', grants: ['Face in the Crowd', 'Lengthy Diversion'] },
    { source: 'Blackwatch Initiate', skill: 'Occultism', grants: ['Oddity Identification', 'Reveal True Name'] },
    { source: 'Palewatch Initiate', skill: 'Religion', grants: ["Pilgrim's Token", 'Student of the Canon'] },
    { source: 'Magewatch Initiate', skill: 'Arcana', grants: ['Arcane Sense', 'Quick Identification'] },
  ])('applies $source expert $skill at acquisition and preserves later increases and feat grants', ({ source, skill, grants }) => {
    const initiate = { name: source, type: 'Class Feat', level: 4, slot: 'class:4:0' }
    const c: Character = { ...base, level: 7, skillPicks: [skill], feats: [initiate] }
    expect(ranksAt(c, entries)[skill]).toBe(2)
    expect(ranksAt(c, entries, 4)[skill]).toBe(1)
    expect(ranksAt({ ...c, skillIncreases: { 3: skill } }, entries)[skill]).toBe(2)
    expect(ranksAt({ ...c, skillIncreases: { 7: skill } }, entries)[skill]).toBe(3)
    expect(ranksAt({ ...c, rankOverrides: { [skill]: 0 } }, entries)[skill]).toBe(2)
    expect(automaticFeatGrants(c, entries)).toEqual([
      { name: grants[0], source, level: 4 }, { name: grants[1], source, level: 4 },
    ])
    const dependent = entry('feat', 'Dependent', { prerequisite: `expert in ${skill}; ${grants[0]}` }, 6, ['Ranger'])
    expect(featPrerequisiteChecker(c, [...entries, dependent])(dependent)).toEqual({ missing: [], manual: [] })
    expect(automaticFeatGrants({ ...c, level: 3 }, entries)).toEqual([])
    expect(ranksAt({ ...c, level: 3 }, entries)[skill]).toBe(1)
    expect(ranksAt({ ...c, feats: [] }, entries)[skill]).toBe(1)
  })

  it('dates Greywatch training and duplicate feat replacements by actual acquisition', () => {
    const face = entry('feat', 'Face in the Crowd', {}, 1, ['General', 'Skill'])
    const lengthy = entry('feat', 'Lengthy Diversion', {}, 1, ['General', 'Skill'])
    const c: Character = { ...base, level: 9, skillPicks: ['Deception'], feats: [
      { name: 'Greywatch Initiate', type: 'Class Feat', level: 4, slot: 'class:8:0' },
      { name: face.name, type: 'Skill Feat', level: 1, slot: 'skill:2:0' },
    ], skillIncreases: { 9: 'Deception' } }
    const data = [...entries, face, lengthy]
    const before = JSON.stringify(c)
    expect(ranksAt(c, data, 8).Deception).toBe(1)
    expect(ranksAt(c, data, 9).Deception).toBe(2)
    expect(ranksAt(c, data).Deception).toBe(3)
    expect(automaticFeatGrants(c, data)).toEqual([
      { name: face.name, source: 'Greywatch Initiate', level: 8 },
      { name: lengthy.name, source: 'Greywatch Initiate', level: 8 },
    ])
    expect(plannedSlots(c, data).filter(slot => slot.redundantFeat)).toEqual([
      expect.objectContaining({ category: 'skill', level: 8, redundantFeat: face.name, grantedBy: 'Greywatch Initiate' }),
    ])
    expect(plannedSlots({ ...c, level: 7 }, data).some(slot => slot.redundantFeat)).toBe(false)
    expect(JSON.stringify(c)).toBe(before)
  })

  it.each([[3, 1], [4, 2], [5, 4], [6, 5], [7, 7], [15, 15]])('scales Untrained Improvisation at level %i without granting trained ranks', (level, bonus) => {
    const feat = { name: 'Untrained Improvisation', type: 'General Feat', level: 3, slot: 'general:3:0' }
    const c = { ...base, level, feats: [feat] }
    expect(untrainedSkillProficiency(c)).toEqual({ bonus, source: feat.name, trainedActions: false })
    expect(ranksAt(c, entries).Occultism ?? 0).toBe(0)
    expect(untrainedSkillProficiency({ ...c, level: 2 })).toBeUndefined()
    expect(untrainedSkillProficiency({ ...c, feats: [] })).toBeUndefined()
  })

  it('grants Clever Improviser and Snarecrafter automatic feats at acquisition and does not duplicate them in pickers', () => {
    const clever = { name: 'Clever Improviser', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' }
    const snare = { name: 'Snarecrafter Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:g99' }
    const c: Character = { ...base, level: 5, feats: [clever, snare] }
    const data = [entry('feat', 'Untrained Improvisation', {}, 3, ['General']), entry('feat', 'Snare Crafting', {}, 1, ['General', 'Skill'])]
    expect(automaticFeatGrants(c, data)).toEqual([
      { name: 'Untrained Improvisation', source: clever.name, level: 5 }, { name: 'Snare Crafting', source: snare.name, level: 2 },
    ])
    expect(untrainedSkillProficiency(c)).toEqual({ bonus: 4, source: clever.name, trainedActions: true })
    expect(eligibleFeats(data, c, { key: 'general:3:0', category: 'general', level: 3 }).map(feat => feat.name))
      .toEqual(['Untrained Improvisation'])
    expect(eligibleFeats(data, c, { key: 'general:7:0', category: 'general', level: 7 })).toEqual([])
    expect(automaticFeatGrants({ ...c, level: 1 }, data)).toEqual([])
  })

  it('adds Linguistic Prodigy languages and one per Multilingual without losing Society-based scaling', () => {
    const c = { ...base, level: 15, feats: [
      { name: 'Linguistic Prodigy', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
      { name: 'Multilingual', type: 'Skill Feat', level: 1, slot: 'skill:2:0' },
      { name: 'Multilingual', type: 'Skill Feat', level: 1, slot: 'skill:16:0' },
    ] }
    expect(languageAllowance(c, entries).slots).toBe(6)
    expect(languageAllowance({ ...c, rankOverrides: { Society: 4 } }, entries).slots).toBe(8)
    expect(languageAllowance({ ...c, level: 16, rankOverrides: { Society: 4 } }, entries).slots).toBe(13)
    expect(languageAllowance({ ...c, feats: c.feats.slice(1) }, entries).slots).toBe(3)
  })

  it('does not make Natural Skill training slots available before the feat is acquired', () => {
    const feat = { name: 'Natural Skill', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' }
    const c = { ...base, level: 5, feats: [feat] }
    expect(additionalSkillCount(c, entries)).toBe(additionalSkillCount({ ...c, feats: [] }, entries) + 2)
    expect(additionalSkillCount({ ...c, level: 4 }, entries)).toBe(additionalSkillCount({ ...c, level: 4, feats: [] }, entries))
  })

  it('gives Wasteland Warrior both scaling resistances without activating future selections', () => {
    const feat = { name: 'Wasteland Warrior', type: 'Ancestry Feat', level: 13, slot: 'ancestry:13:0' }
    const c = { ...base, level: 13, feats: [feat] }
    expect(resistances(c, entries)).toEqual([
      { damage: 'Cold', value: 6, source: feat.name }, { damage: 'Fire', value: 6, source: feat.name },
    ])
    expect(resistances({ ...c, level: 20 }, entries).map(resistance => resistance.value)).toEqual([10, 10])
    expect(resistances({ ...c, level: 12 }, entries)).toEqual([])
    expect(resistances({ ...c, feats: [] }, entries)).toEqual([])
  })

  it('grants Pain Tolerance mental resistance only after taking the feat', () => {
    const feat = { name: 'Pain Tolerance', type: 'Class Feat', level: 6, slot: 'class:6:0' }
    const c = { ...base, level: 7, feats: [feat] }
    expect(resistances(c, entries)).toContainEqual({ damage: 'Mental', value: 3, source: feat.name })
    expect(resistances({ ...c, level: 20 }, entries)).toContainEqual({ damage: 'Mental', value: 10, source: feat.name })
    expect(resistances({ ...c, level: 5 }, entries)).not.toContainEqual(expect.objectContaining({ source: feat.name }))
    expect(resistances({ ...c, feats: [] }, entries)).not.toContainEqual(expect.objectContaining({ source: feat.name }))
    const catalog = [...entries, entry('feat', feat.name, { resistances: 'mental=half' }, 6)]
    expect(resistances(c, catalog).filter(resistance => resistance.source === feat.name))
      .toEqual([{ damage: 'Mental', value: 3, source: feat.name }])
  })

  const wizard = entry('class', 'Wizard', {
    attack_proficiency: 'Trained in simple weapons, Trained in unarmed attacks',
    defense_proficiency: 'Untrained in all armor, Trained in unarmored defense',
  })
  const ranger = entry('class', 'Ranger', {
    attack_proficiency: 'Trained in simple weapons, Trained in martial weapons, Trained in unarmed attacks',
    defense_proficiency: 'Trained in light armor, Trained in medium armor, Trained in unarmored defense',
  })
  const selected = (name: string, level = 1, choice?: string, slot = `general:${level}:0`) =>
    ({ name, type: 'General Feat', level: 1, slot, choice })
  const weapon = (name: string, category: string) => entry('weapon', name, { weapon_category: category, damage: '1d8 slashing' })
  const attack = (c: Character, name: string, data: ContentEntry[]) =>
    weaponAttack(c, data, { id: name, name, potency: 0, striking: 0, runes: [] })

  it('grants successive armor types, scales only those types, and restores saved benefits after leveling back up', () => {
    const feats = [selected('Armor Proficiency'), selected('Armor Proficiency', 3)]
    const c = { ...base, level: 13, feats }
    expect(armorRanks(c, [wizard])).toEqual({ Light: 2, Medium: 2, Heavy: 0, Unarmored: 1 })
    expect(armorRanks({ ...c, level: 12 }, [wizard])).toEqual({ Light: 1, Medium: 1, Heavy: 0, Unarmored: 1 })
    expect(armorRanks({ ...c, level: 1 }, [wizard])).toEqual({ Light: 1, Medium: 0, Heavy: 0, Unarmored: 1 })
    expect(armorRanks({ ...c, className: 'Ranger', feats: feats.slice(0, 1) }, [ranger]))
      .toEqual({ Light: 1, Medium: 1, Heavy: 2, Unarmored: 1 })
    const leather = entry('armor', 'Leather Armor', { armor_category: 'Light', ac_bonus: 1 })
    const worn = { ...c, armors: [{ id: 'armor', name: leather.name, potency: 0, resilient: 0, runes: [], worn: true }] }
    expect(armorClass(worn, [wizard, leather]) - armorClass({ ...worn, feats: [] }, [wizard, leather])).toBe(17)
    expect(armorRanks({ ...c, feats: [] }, [wizard]).Light).toBe(0)
    expect(c.feats).toEqual(feats)
  })

  it('recognizes all-armor class training and never reduces higher class proficiency', () => {
    const champion = entry('class', 'Champion', { defense_proficiency: 'Trained in all armor, Trained in unarmored defense' })
    expect(armorRanks({ ...base, className: 'Champion' }, [champion]))
      .toEqual({ Light: 1, Medium: 1, Heavy: 1, Unarmored: 1 })
    const mastery = { ...entry('classFeature', 'Armor Mastery', { class: 'Wizard' }, 13),
      description: 'Your proficiency ranks for light armor and unarmored defense increase to master.' }
    expect(armorRanks({ ...base, level: 13, feats: [selected('Armor Proficiency')] }, [wizard, mastery]).Light).toBe(3)
  })

  it('grants martial weapons first, then only the chosen advanced weapons, with level-11 scaling', () => {
    const data = [wizard, ranger, weapon('Longsword', 'Martial'), weapon('Falcata', 'Advanced'), weapon('Dueling Sword', 'Advanced')]
    const feats = [selected('Weapon Proficiency'), selected('Weapon Proficiency', 3, 'Falcata')]
    const c = { ...base, level: 11, feats }
    expect(weaponRanks(c, data)).toMatchObject({ Simple: 1, Martial: 2, Advanced: 0 })
    expect(attack(c, 'Longsword', data).rank).toBe(2)
    expect(attack(c, 'Falcata', data).rank).toBe(2)
    expect(attack(c, 'Dueling Sword', data).rank).toBe(0)
    expect(attack({ ...c, level: 10 }, 'Falcata', data).rank).toBe(1)
    expect(attack({ ...c, level: 2 }, 'Falcata', data).rank).toBe(0)
    expect(attack({ ...c, feats: [] }, 'Longsword', data).rank).toBe(0)
    expect(attack({ ...c, className: 'Ranger', feats: [selected('Weapon Proficiency', 3, 'Falcata')] }, 'Falcata', data).rank).toBe(2)
    expect(featChoiceOptions('Weapon Proficiency', { ...base, className: 'Ranger' }, data, 'general:3:0'))
      .toEqual(['Dueling Sword', 'Falcata'])
    expect(featChoiceOptions('Weapon Proficiency', base, data, 'general:1:0')).toBeUndefined()
  })

  it('keeps the original martial grant when the class later gains martial weapon proficiency', () => {
    const expertise = { ...entry('classFeature', 'Martial Expertise', { class: 'Wizard' }, 7),
      description: 'Your proficiency rank for martial weapons increases to expert.' }
    const c = { ...base, level: 11, feats: [selected('Weapon Proficiency', 3)] }
    expect(weaponRanks(c, [wizard, expertise]).Martial).toBe(2)
    expect(featChoiceOptions('Weapon Proficiency', c, [wizard, expertise], 'general:3:0')).toBeUndefined()
  })

  it('grants and scales each Additional Lore independently of optional house rules and paid skill increases', () => {
    updateSettings({ autoLores: false })
    const feats = [selected('Additional Lore', 1, 'Sailing'), selected('Additional Lore', 3, 'Warfare Lore')]
    const c = { ...base, feats, background: undefined }
    for (const [level, rank] of [[1, 1], [2, 1], [3, 2], [6, 2], [7, 3], [14, 3], [15, 4], [20, 4]]) {
      const character = { ...c, level }
      expect(ranksAt(character, entries)['Sailing Lore']).toBe(rank)
      expect(ranksAt(character, entries)['Warfare Lore']).toBe(level < 3 ? undefined : rank)
      expect(skillRankBudget(character, entries)).toEqual(skillRankBudget({ ...character, feats: [] }, entries))
    }
    expect(featLores({ ...c, level: 3 }, entries)).toEqual(['Sailing Lore', 'Warfare Lore'])
    expect(ranksAt({ ...c, level: 7 }, entries, 3)['Sailing Lore']).toBe(1)
    expect(ranksAt({ ...c, level: 7 }, entries, 7)['Sailing Lore']).toBe(2)
    expect(ranksAt({ ...c, level: 7, skillIncreases: { 3: 'Sailing Lore' } }, entries)['Sailing Lore']).toBe(3)
    expect(ranksAt({ ...c, feats: [] }, entries)['Sailing Lore']).toBeUndefined()
  })

  it('scales Additional Lore granted by another feat without scaling ordinary background Lore', () => {
    updateSettings({ autoLores: false })
    const dedication = entry('feat', 'Wild Hunter Dedication', { grants_lore: 'Hunting Lore' }, 2)
    const c = { ...base, level: 15, feats: [selected(dedication.name, 2)] }
    expect(ranksAt(c, [...entries, dedication])).toMatchObject({ 'Hunting Lore': 4, 'Academia Lore': 1 })
  })

  it('trains the saved Skill Training choice without granting a second discretionary skill', () => {
    const c = { ...base, level: 3, feats: [selected('Skill Training', 3, 'Stealth')] }
    expect(ranksAt(c, entries).Stealth).toBe(1)
    expect(additionalSkillCount(c, entries)).toBe(additionalSkillCount({ ...c, feats: [] }, entries))
    expect(ranksAt({ ...c, level: 2 }, entries).Stealth).toBeUndefined()
    expect(ranksAt({ ...c, feats: [] }, entries).Stealth).toBeUndefined()
    expect(featChoiceOptions('Skill Training', c, entries, 'general:3:0')).toContain('Stealth')
    expect(featChoiceOptions('Skill Training', c, entries, 'general:3:0')).not.toContain('Arcana')
    expect(ranksAt({ ...c, feats: [selected('Skill Training', 3, 'Fortitude')] }, entries).Fortitude).toBe(0)
  })

  it.each<{ trained: string[]; choice: string; expected: Record<string, number> }>([
    { trained: [], choice: 'Arcana to Trained', expected: { Crafting: 1, Arcana: 1 } },
    { trained: ['Crafting', 'Arcana'], choice: 'Nature to Trained', expected: { Crafting: 2, Arcana: 1, Nature: 1 } },
    { trained: ['Crafting', 'Arcana', 'Nature', 'Occultism', 'Religion'], choice: 'Religion to Expert',
      expected: { Crafting: 2, Arcana: 1, Nature: 1, Occultism: 1, Religion: 2 } },
  ])('applies Scrapper variant $choice from pre-feat skills without spending skill increases', ({ trained, choice, expected }) => {
    const c: Character = { ...base, systems: ['sf2e'], level: 5, ancestry: 'Human', skillPicks: trained,
      feats: [selected('Technomagical Scrapper', 5, choice, 'ancestry:5:0')] }
    expect(featChoiceOptions('Technomagical Scrapper', c, [], 'ancestry:5:0')).toContain(choice)
    expect(ranksAt(JSON.parse(JSON.stringify(c)), [])).toMatchObject(expected)
    expect(skillRankBudget(c, [])).toEqual(skillRankBudget({ ...c, feats: [] }, []))
    expect(ranksAt({ ...c, level: 4 }, []).Crafting ?? 0).toBe(trained.includes('Crafting') ? 1 : 0)
    if (trained.includes('Arcana') && !trained.includes('Religion')) {
      expect(featChoiceOptions('Technomagical Scrapper', c, [], 'ancestry:5:0'))
        .toEqual(['Nature to Trained', 'Occultism to Trained', 'Religion to Trained'])
    }
  })

  it('keeps Scrapper grants at their acquisition level and applies later skill increases after them', () => {
    const c: Character = { ...base, level: 9, skillPicks: ['Arcana', 'Nature', 'Occultism'],
      feats: [selected('Technomagical Scrapper', 5, 'Religion to Trained', 'ancestry:5:0')],
      skillIncreases: { 7: 'Religion', 9: 'Crafting' } }
    expect(featChoiceOptions('Technomagical Scrapper', c, [], 'ancestry:5:0')).toEqual(['Religion to Trained'])
    expect(ranksAt(c, [])).toMatchObject({ Crafting: 2, Religion: 2 })
    expect(ranksAt(c, [], 5).Crafting).toBeUndefined()
    expect(ranksAt(c, [], 6)).toMatchObject({ Crafting: 1, Religion: 1 })
    expect(ranksAt({ ...c, feats: [] }, [])).toMatchObject({ Crafting: 1, Religion: 1 })
    const futureTraining = { ...c, skillIncreases: {},
      feats: [...c.feats, selected('Skill Training', 7, 'Religion')] }
    expect(featChoiceOptions('Technomagical Scrapper', futureTraining, [], 'ancestry:5:0')).toEqual(['Religion to Trained'])
    expect(ranksAt(futureTraining, []).Religion).toBe(1)
  })

  it('honors existing ranks without lowering higher ranks, self-promoting, or accepting unrelated skill variants', () => {
    const c: Character = { ...base, level: 5, feats: [selected('Technomagical Scrapper', 5, 'Nature to Expert', 'ancestry:5:0')],
      rankOverrides: { Crafting: 3, Arcana: 4, Nature: 1, Occultism: 1, Religion: 1 } }
    expect(featChoiceOptions('Technomagical Scrapper', c, [], 'ancestry:5:0'))
      .toEqual(['Nature to Expert', 'Occultism to Expert', 'Religion to Expert'])
    expect(ranksAt(c, [])).toMatchObject({ Crafting: 3, Arcana: 4, Nature: 2, Occultism: 1, Religion: 1 })
    expect(ranksAt({ ...c, feats: [{ ...c.feats[0], choice: 'Fortitude to Expert' }] }, []).Fortitude).toBe(0)
    const allExpert = { ...c, rankOverrides: { Crafting: 3, Arcana: 2, Nature: 2, Occultism: 2, Religion: 2 } }
    expect(featChoiceOptions('Technomagical Scrapper', allExpert, [], 'ancestry:5:0')).toBeUndefined()
    expect(ranksAt(allExpert, [])).toMatchObject({ Crafting: 3, Arcana: 2, Nature: 2 })
  })

  it('grants and scales Ancestral Skills Lore for the current ancestry without requiring the optional Lore house rule', () => {
    updateSettings({ autoLores: false })
    for (const ancestry of ['Human', 'Android', 'Ysoki']) {
      const c: Character = { ...base, ancestry, feats: [selected('Ancestral Skills', 1, undefined, 'ancestry:1:0')] }
      for (const [level, rank] of [[1, 1], [3, 2], [7, 3], [15, 4]]) {
        expect(featLores({ ...c, level }, [])).toEqual([`${ancestry} Lore`])
        expect(ranksAt({ ...c, level }, [])[`${ancestry} Lore`]).toBe(rank)
      }
      expect(featLores({ ...c, feats: [] }, [])).toEqual([])
      expect(featLores({ ...c, ancestry: undefined }, [])).toEqual([])
      const later = { ...c, level: 4, feats: [selected('Ancestral Skills', 5, undefined, 'ancestry:5:0')] }
      expect(featLores(later, [])).toEqual([])
      expect(ranksAt({ ...later, level: 5 }, [])[`${ancestry} Lore`]).toBe(2)
    }
  })

  it('grants Ancestral Paragon a first-level ancestry slot at the level it was selected', () => {
    const c = { ...base, level: 7, feats: [selected('Ancestral Paragon', 7)] }
    const slot = plannedSlots(c).find((slot) => slot.key === 'ancestry:1:g3')!
    expect(slot).toMatchObject({ category: 'ancestry', level: 7, maxFeatLevel: 1 })
    const data = [entry('feat', 'Elven Lore', {}, 1, ['Elf']), entry('feat', 'Elven Step', {}, 5, ['Elf'])]
    expect(eligibleFeats(data, c, slot).map((feat) => feat.name)).toEqual(['Elven Lore'])
    expect(plannedSlots({ ...c, level: 6 }).some((s) => s.key === slot.key)).toBe(false)
    expect(plannedSlots({ ...c, feats: [] }).some((s) => s.key === slot.key)).toBe(false)
  })

  it('grants exactly one first-level class feat at Natural Ambition acquisition level', () => {
    const ambition = { name: 'Natural Ambition', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' }
    const c = { ...base, level: 5, feats: [ambition] }
    const slot = plannedSlots(c).find((s) => s.key === 'class:1:g1')!
    const data = [...entries, entry('feat', 'Second-Level Spell', {}, 2, ['Wizard']),
      entry('feat', 'Other Class', {}, 1, ['Ranger']),
      entry('feat', 'Unmet Prerequisite', { prerequisite: 'trained in Occultism' }, 1, ['Wizard'])]
    expect(slot).toMatchObject({ category: 'class', level: 5, maxFeatLevel: 1 })
    expect(plannedSlots(c).filter((s) => s.category === 'class' && s.level === 5)).toEqual([slot])
    expect(plannedSlots(c).filter((s) => s.category === 'class')).toHaveLength(4)
    expect(eligibleFeats(data, c, slot).map((feat) => feat.name)).toEqual(['Counterspell'])
    expect(plannedSlots({ ...c, level: 4 }).some((s) => s.key === slot.key)).toBe(false)
    expect(plannedSlots({ ...c, feats: [] }).some((s) => s.key === slot.key)).toBe(false)
    expect(plannedSlots({ ...c, feats: [] }).some((s) => s.category === 'class' && s.level === 5)).toBe(false)
    expect(plannedSlots({ ...c, extraSlots: [{ category: 'class', level: 5, count: 1 }] })
      .filter((s) => s.category === 'class' && s.level === 5).map((s) => s.key)).toEqual(['class:5:0', 'class:1:g1'])
    const firstLevel = { ...c, level: 1, feats: [{ ...ambition, slot: 'ancestry:1:0' }] }
    expect(plannedSlots(firstLevel).filter((s) => s.category === 'class')).toHaveLength(2)
    expect(plannedSlots({ ...firstLevel, feats: [] }).filter((s) => s.category === 'class')).toHaveLength(1)
  })

  it('grants Shiny Performance or an untrained alternative without increasing ordinary bonuses', () => {
    const shiny = { name: 'Shiny', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    const c = { ...base, systems: ['sf2e'] as Character['systems'], background: undefined, feats: [shiny] }
    expect(ranksAt(c, entries).Performance).toBe(1)
    expect(featChoiceOptions('Shiny', c, entries, shiny.slot)).toBeUndefined()
    const trained = { ...c, skillPicks: ['Performance'], feats: [{ ...shiny, choice: 'Stealth' }] }
    expect(featChoiceOptions('Shiny', trained, entries, shiny.slot)).toContain('Stealth')
    expect(featChoiceOptions('Shiny', trained, entries, shiny.slot)).not.toContain('Performance')
    expect(ranksAt(trained, entries).Stealth).toBe(1)
    expect(ranksAt({ ...trained, feats: [{ ...shiny, choice: 'Performance' }] }, entries).Stealth).toBeUndefined()
    expect(ranksAt({ ...c, feats: [] }, entries).Performance).toBeUndefined()
  })

  it('offers only common or accessible Adopted Ancestry choices without losing saved choices', () => {
    const common = entry('ancestry', 'Dwarf')
    const uncommon = entry('ancestry', 'Ratfolk', {}, 1, ['Uncommon'])
    const rare = entry('ancestry', 'Automaton', { rarity: 'rare' })
    const accessed = entry('ancestry', 'Accessed Ancestry', { rarity: 'uncommon', access: 'Member of the Knights of Lastwall' })
    const sfOnly = { ...entry('ancestry', 'Shirren'), systems: ['sf2e' as const] }
    const deleted = { ...entry('ancestry', 'Deleted Ancestry'), deleted: true }
    const heritages = ['Aiuvarin', 'Dromaar', 'Borai', 'Corpsefolk', 'Cyborg', 'Gap-touched', 'Prismeni', 'Xenometric Android']
      .map(name => entry('ancestry', name))
    const data = [common, uncommon, rare, accessed, sfOnly, deleted, ...heritages, entry('ancestry', base.ancestry!)]
    const c = { ...base, feats: [selected('Adopted Ancestry', 3, rare.name)] }
    expect(featChoiceOptions('Adopted Ancestry', c, data, 'general:3:0')).toEqual(['Dwarf'])
    expect(featChoiceOptions('Adopted Ancestry', { ...c, featAccessOverrides: [rare.id] }, data, 'general:3:0'))
      .toEqual(['Automaton', 'Dwarf'])
    expect(featChoiceOptions('Adopted Ancestry', { ...c, achievements: ['Member of the Knights of Lastwall'] }, data, 'general:3:0'))
      .toEqual(['Accessed Ancestry', 'Dwarf'])
    expect(c.feats[0].choice).toBe(rare.name)
  })

  it('unlocks only the adopted ancestry alongside the original ancestry without losing saved choices on deleveling', () => {
    const data = [
      entry('ancestry', 'Elf'), entry('ancestry', 'Human'), entry('ancestry', 'Dwarf'),
      entry('feat', 'Elven Lore', {}, 1, ['Elf']),
      entry('feat', 'Natural Ambition', {}, 1, ['Human']),
      entry('feat', 'Dwarven Lore', {}, 1, ['Dwarf']),
    ]
    const c = { ...base, level: 5, feats: [selected('Adopted Ancestry', 3, 'Human')] }
    const slot = { key: 'ancestry:5:0', category: 'ancestry' as const, level: 5 }
    expect(eligibleFeats(data, c, slot).map((feat) => feat.name)).toEqual(['Elven Lore', 'Natural Ambition'])
    expect(eligibleFeats(data, { ...c, level: 20 }, { ...slot, level: 1 }).map((feat) => feat.name)).toEqual(['Elven Lore'])
    expect(eligibleFeats(data, { ...c, level: 2 }, { ...slot, level: 1 }).map((feat) => feat.name)).toEqual(['Elven Lore'])
    expect(eligibleFeats(data, { ...c, feats: [] }, slot).map((feat) => feat.name)).toEqual(['Elven Lore'])
    expect(featChoiceOptions('Adopted Ancestry', c, data, 'general:3:0')).toEqual(['Dwarf', 'Human'])
    expect(c.feats[0].choice).toBe('Human')
  })

  it('grants Social Chameleon only Adopted Ancestry and a common level-1 feat from that ancestry', () => {
    const c: Character = { ...base, ancestry: 'Human', level: 5, systems: ['pf2e', 'sf2e'],
      feats: [{ name: 'Social Chameleon', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' }] }
    const data = [
      entry('ancestry', 'Human'), entry('ancestry', 'Elf'), entry('ancestry', 'Dwarf'),
      entry('feat', 'Adopted Ancestry', {}, 1, ['General']),
      entry('feat', 'Other General', {}, 1, ['General']),
      entry('feat', 'Human Feat', {}, 1, ['Human']),
      entry('feat', 'Elf Feat', {}, 1, ['Elf']),
      entry('feat', 'Dwarf Feat', {}, 1, ['Dwarf']),
      entry('feat', 'Higher Elf Feat', {}, 5, ['Elf']),
      entry('feat', 'Uncommon Elf Feat', {}, 1, ['Elf', 'Uncommon']),
      entry('feat', 'Rare Elf Feat', { rarity: 'Rare' }, 1, ['Elf']),
    ]
    const grants = plannedSlots(c).filter(slot => slot.grantedBy === 'Social Chameleon')
    expect(grants).toHaveLength(2)
    expect(grants.map(slot => slot.level)).toEqual([5, 5])
    expect(eligibleFeats(data, c, grants.find(slot => slot.category === 'general')!).map(feat => feat.name)).toEqual(['Adopted Ancestry'])
    expect(eligibleFeats(data, c, grants.find(slot => slot.category === 'ancestry')!)).toEqual([])
    const adopted: Character = { ...c, feats: [...c.feats,
      { name: 'Adopted Ancestry', type: 'General Feat', level: 1, takenLevel: 5,
        slot: 'general:1:social-chameleon:ancestry:5:0', choice: 'Elf' }] }
    const ancestry = plannedSlots(adopted).find(slot => slot.grantedBy === 'Social Chameleon' && slot.category === 'ancestry')!
    expect(eligibleFeats(data, adopted, ancestry).map(feat => feat.name)).toEqual(['Elf Feat'])
    expect(eligibleFeats(data, { ...adopted, level: 20 }, { key: 'ancestry:1:0', category: 'ancestry', level: 1 })
      .map(feat => feat.name)).toEqual(['Human Feat'])
    expect(eligibleFeats(data, adopted, { key: 'ancestry:5:1', category: 'ancestry', level: 5 }).map(feat => feat.name))
      .toContain('Higher Elf Feat')
    expect(plannedSlots({ ...adopted, level: 4 }).some(slot => slot.grantedBy === 'Social Chameleon')).toBe(false)
    expect(plannedSlots({ ...adopted, feats: adopted.feats.slice(1) }).some(slot => slot.grantedBy === 'Social Chameleon')).toBe(false)
  })

  it('scales each Multilingual selection at master and legendary Society, not just character level', () => {
    const feats = [selected('Multilingual'), selected('Multilingual', 3)]
    const c = { ...base, feats }
    for (const [society, slots] of [[0, 5], [2, 5], [3, 7], [4, 9]]) {
      expect(languageAllowance({ ...c, level: 15, rankOverrides: { Society: society } }, entries).slots).toBe(slots)
    }
    expect(languageAllowance({ ...c, level: 1 }, entries).slots).toBe(3)
    expect(languageAllowance({ ...c, level: 15, feats: [] }, entries).slots).toBe(1)
  })
})

describe('ancestryLabel', () => {
  it('does not repeat an ancestry already in the heritage name', () => {
    expect(ancestryLabel('Human', 'Pioneer Human')).toBe('Pioneer Human')
    expect(ancestryLabel('Human', 'Pioneer human')).toBe('Pioneer human')
    expect(ancestryLabel('Human', 'Winterborn')).toBe('Winterborn Human')
    expect(ancestryLabel('Human', 'Humanity')).toBe('Humanity Human')
  })

  describe('class labels', () => {
    it.each([
      ['Ranger', 'Outwit', 'Outwit Edge Ranger'],
      ['Rogue', 'Thief', 'Thief Racket Rogue'],
      ['Bard', 'Warrior', 'Warrior Muse Bard'],
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
      expect(classLabel(c, data)).toBe('Outwit Edge Ranger')
      expect(classLabel({ ...c, subclass: 'Precision' }, data)).toBe('Precision Edge Ranger')
      expect(classLabel({ ...c, subclass: '' }, data)).toBe('Ranger')
      expect(classLabel({ ...c, className: 'Champion' }, data)).toBe('Champion')
      expect(classLabel({ ...c, imported: undefined, feats: [{ name: "Hunter's Edge", type: 'Class Feature', level: 1, choice: 'Outwit' }] }, data))
        .toBe('Outwit Edge Ranger')
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
    const k = entry('class', 'Test Class', { skill_proficiency: 'Trained in your choice of Acrobatics or Athletics, Trained in a number of additional skills equal to 3 plus your Intelligence modifier' })
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

  it('updates warmed feature results after class, level, or catalog changes', () => {
    const catalog = [
      entry('classFeature', 'Ranger Expertise', { class: 'Ranger' }, 5),
      entry('classFeature', 'Wizard Expertise', { class: 'Wizard' }, 5),
    ]
    const ranger = { ...base, className: 'Ranger', level: 5 }
    expect(classFeatures(catalog, ranger).map(feature => feature.name)).toEqual(['Ranger Expertise'])
    expect(classFeatures(catalog, { ...ranger, className: 'Wizard' }).map(feature => feature.name)).toEqual(['Wizard Expertise'])
    expect(classFeatures(catalog, { ...ranger, level: 4 })).toEqual([])
    const updated = catalog.map(feature => ({ ...feature, level: 6 }))
    expect(classFeatures(updated, ranger)).toEqual([])
    expect(classFeatures(updated, { ...ranger, level: 6 }).map(feature => feature.name)).toEqual(['Ranger Expertise'])
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
    expect(hitPointBonuses({ ...c, feats: [{ name: 'Toughness', type: 'General Feat', level: 1 }] }))
      .toEqual([{ source: 'Toughness', value: c.level }])
    const future = { ...c, feats: [{ name: 'Toughness', type: 'General Feat', level: 1, slot: 'general:7:0' }] }
    expect(maxHp(future, data)).toBe(56)
    expect(hitPointBonuses(future)).toEqual([])
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

  it('uses the selected Current Spell source before removing orphaned archetype feats', () => {
    const archetype = { ...entry('feat', 'Current Spell', { archetype: 'Elementalist' }, 6, ['Archetype']), id: 'archetype-current' }
    const druid = { ...entry('feat', 'Current Spell', { archetype: 'Elementalist' }, 6, ['Druid']), id: 'druid-current' }
    const dedication = entry('feat', 'Elementalist Dedication', { archetype: 'Elementalist' }, 2, ['Archetype', 'Dedication'])
    const selected = { name: 'Current Spell', type: 'Class Feat', level: 6, slot: 'class:6:0' }
    const c: Character = { ...base, className: 'Druid', level: 8, feats: [selected], entryIds: [druid.id] }
    for (const data of [[archetype, druid], [druid, archetype]]) {
      expect(orphanedArchetypeFeats(c, data)).toEqual([])
      expect(orphanedArchetypeFeats({ ...c, entryIds: [] }, data)).toEqual([])
      const archetypeSelection = { ...selected, type: 'Archetype Feat', slot: 'archetype:8:0' }
      const archetypeCharacter = { ...c, feats: [archetypeSelection], entryIds: [archetype.id] }
      expect(orphanedArchetypeFeats(archetypeCharacter, data)).toEqual([archetypeSelection])
      expect(orphanedArchetypeFeats({ ...archetypeCharacter, feats: [
        { name: dedication.name, type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }, archetypeSelection,
      ] }, [...data, dedication])).toEqual([])
    }
  })

  it('lets a house-rule Dedication level keep an extra level 2 Dedication slot', ({ onTestFinished }) => {
    const previous = getSettings()
    onTestFinished(() => updateSettings(previous))
    updateSettings({ freeArchetype: true, rangerSnarecrafter: true })
    const ranger = { ...base, className: 'Ranger', level: 2, extraSlots: [{ category: 'archetype' as const, level: 2, count: 1 }] }
    expect(plannedSlots(ranger).filter((s) => s.category === 'archetype').map((s) => s.key)).toEqual(['archetype:2:0', 'archetype:2:g99', 'archetype:2:g96'])
  })

  it('gives druids focus spells from their order and Order Magic', () => {
    const feat = (name: string, choice?: string) => ({ name, type: 'Class Feat', level: 4, choice })
    const druid = { ...base, level: 4, className: 'Druid', order: 'Leaf', feats: [feat('Order Explorer', 'Storm'), feat('Order Magic')] }
    expect(focusSpells(druid, []).spells.map((s) => s.name)).toEqual(['Cornucopia'])
    expect(orderMagicOptions(druid)).toEqual(['Storm'])
    const chosen = { ...druid, feats: [feat('Order Explorer', 'Storm'), feat('Order Magic', 'Storm')] }
    expect(focusSpells(chosen, []).spells.map((s) => s.name)).toEqual(['Cornucopia', 'Tempest Surge'])
    expect(focusSpells({ ...chosen, className: 'Ranger' }, []).spells).toEqual([])
  })

  it('adds feat-granted focus spells, order-specific advanced spells and focus points', () => {
    const feat = (name: string, data: Record<string, string>): ContentEntry => ({
      id: name, kind: 'feat', name, data, systems: ['pf2e'], source: 'official', level: 1,
      traits: [], description: '', effects: [], updatedAt: 1,
    })
    const entries = [feat('Wild Shape', { grants_focus_spells: 'wild shape' }), feat('Advanced Elemental Spell', { grants_order_spells: 'flame:combustion, stone:stone lance' }), feat('Hedge Prison', { grants_focus_spells: 'hedge prison', grants_focus_point: 'yes' })]
    const f = (name: string) => ({ name, type: 'Class Feat', level: 6 })
    const druid = { ...base, level: 6, className: 'Druid', order: 'Flame', feats: [f('Wild Shape'), f('Advanced Elemental Spell'), f('Hedge Prison')] }
    const r = focusSpells(druid, entries)
    expect(r.spells.map((s) => s.name)).toEqual(['Combustion', 'Hedge Prison', 'Wild Shape', 'Wildfire'])
    expect(r.points).toBe(3)
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
  it('filters untagged PF heritages by ancestry without losing versatile or unusually named choices', () => {
    const list = [
      ...['Human', 'Dwarf', 'Elf', 'Conrasu', 'Ghoran', 'Ratfolk', 'Sprite'].map(name => entry('ancestry', name)),
      ...['Underground Dwarf', 'Rock Dwarf', 'Ancient Elf', 'Skilled Human', 'Versatile Human',
        'Rite of Light', 'Ancient Ash', 'Deep Rat', 'Dijiang', 'Half-Elf', 'Dragonblood', 'Aiuvarin', 'Changeling'].map(name => entry('heritage', name)),
      { ...entry('heritage', 'Custom Unrestricted'), source: 'homebrew' as const },
      entry('heritage', 'Unclassified Official'),
    ]
    expect(heritagesFor(list, 'Human').map(entry => entry.name).sort()).toEqual([
      'Aiuvarin', 'Changeling', 'Custom Unrestricted', 'Dragonblood', 'Half-Elf', 'Skilled Human', 'Versatile Human',
    ])
    for (const [ancestry, name] of [['Dwarf', 'Rock Dwarf'], ['Conrasu', 'Rite of Light'], ['Ghoran', 'Ancient Ash'],
      ['Ratfolk', 'Deep Rat'], ['Sprite', 'Dijiang']]) {
      expect(heritagesFor(list, ancestry).map(entry => entry.name)).toContain(name)
    }
    expect(heritagesFor(list, 'Elf').map(entry => entry.name)).not.toContain('Half-Elf')
    expect(heritagesFor([{ ...entry('heritage', 'Skilled Human'), deleted: true }], 'Human')).toEqual([])
  })

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

  it('offers the linked Starfinder Cyborg heritage as versatile, with its ancestry feats', () => {
    const cyborg = mapAonHit({ _id: 'ancestries--66-cyborg--heritages--355-cyborg',
      _source: { category: 'heritage', name: 'Cyborg', url: '/ancestries/66-cyborg/heritages/355-cyborg' } }, 'sf2e')!
    const frame = { ...entry('feat', 'Gg-os Frame', {}, 1, ['Cyborg']), systems: ['sf2e' as const] }
    const list = [cyborg, frame, entry('heritage', 'Test-Subject Ysoki', { ancestry: 'ysoki' })]
    expect(cyborg.data.ancestry).toBe('cyborg')
    expect(isVersatileHeritage(cyborg)).toBe(true)
    for (const ancestry of ['Ysoki', 'Human', 'Elf']) {
      expect(heritagesFor(list, ancestry)).toContain(cyborg)
      const character: Character = { ...base, systems: ['sf2e'], ancestry, heritage: 'Cyborg' }
      expect(eligibleFeats(list, character, { key: 'ancestry:1:0', category: 'ancestry', level: 1 })).toContain(frame)
    }
    expect(heritagesFor(list, 'Human').map(heritage => heritage.name)).not.toContain('Test-Subject Ysoki')
  })

  it('allows only one first-level lineage across ancestry and heritage, retaining saved selections', () => {
    const frame = { ...entry('feat', 'Gg-os Frame', {}, 1, ['Cyborg', 'Lineage']), systems: ['sf2e' as const] }
    const thresher = { ...entry('feat', 'Thresher Ko-1 Frame', {}, 1, ['Cyborg', 'Lineage']), systems: ['sf2e' as const] }
    const ancestry = { ...entry('feat', 'Ancestry Lineage', {}, 1, ['Ysoki', 'Lineage']), systems: ['sf2e' as const] }
    const list = [frame, thresher, ancestry]
    const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Cyborg', level: 5 }
    const first = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
    const second = { key: 'ancestry:1:1', category: 'ancestry' as const, level: 1 }
    const later = { key: 'ancestry:5:0', category: 'ancestry' as const, level: 5 }
    expect(eligibleFeats(list, c, first)).toEqual(expect.arrayContaining(list))
    expect(eligibleFeats(list, c, later)).not.toContain(frame)
    const chosen = { ...c, feats: [{ name: frame.name, type: 'Ancestry Feat', level: 1, slot: first.key }] }
    expect(eligibleFeats(list, chosen, second)).not.toContain(thresher)
    expect(eligibleFeats(list, chosen, second)).not.toContain(ancestry)
    expect(eligibleFeats(list, chosen, first)).toContain(frame)
    const legacy = { ...c, feats: [{ name: frame.name, type: 'Ancestry Feat', level: 1, slot: later.key }] }
    expect(eligibleFeats(list, legacy, later)).toContain(frame)
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
    const previous = getSettings().fighterPhysicalSkills
    try {
      updateSettings({ fighterPhysicalSkills: false })
      expect(classSkills(fighter).choices).toEqual(['Acrobatics', 'Athletics'])
      const c = { ...base, className: 'Fighter', classSkill: 'Athletics' }
      expect(ranksAt(c, [fighter]).Athletics).toBe(1)
      expect(ranksAt(c, [fighter]).Acrobatics ?? 0).toBe(0)
    } finally { updateSettings({ fighterPhysicalSkills: previous }) }
  })

  it('grants Fighters both physical skills without spending choices and restores saved training when disabled', () => {
    const fighter = entry('class', 'Fighter', { skill_proficiency: 'Trained in your choice of Acrobatics or Athletics, Trained in a number of additional skills equal to 3 plus your Intelligence modifier' })
    const c = { ...base, className: 'Fighter', classSkill: 'Athletics', skillPicks: ['Acrobatics', 'Stealth'] }
    const before = JSON.stringify(c)
    const previous = getSettings()
    try {
      updateSettings({ fighterPhysicalSkills: true, autoClassSkills: false })
      expect(classSkills(fighter)).toEqual({ fixed: ['Acrobatics', 'Athletics'], choices: [], additional: 3 })
      expect(ranksAt({ ...c, skillPicks: [] }, [fighter])).toMatchObject({ Acrobatics: 1, Athletics: 1 })
      expect(skillRankBudget(c, [fighter]).trained).toBe(2)
      updateSettings({ autoClassSkills: true })
      expect(ranksAt({ ...c, level: 7 }, [fighter])).toMatchObject({ Acrobatics: 3, Athletics: 3 })
      updateSettings({ fighterPhysicalSkills: false, autoClassSkills: false })
      expect(ranksAt({ ...c, skillPicks: [] }, [fighter])).toMatchObject({ Athletics: 1 })
      expect(ranksAt({ ...c, skillPicks: [] }, [fighter]).Acrobatics ?? 0).toBe(0)
      expect(skillRankBudget(c, [fighter]).trained).toBe(1)
      expect(JSON.stringify(c)).toBe(before)
    } finally { updateSettings(previous) }
  })
})

describe('Order Explorer', () => {
  it('grants explored order skills only while the house rule and feat are active', () => {
    const druid = entry('class', 'Druid', { skill_proficiency: 'Trained in Nature' })
    const c = { ...base, level: 10, className: 'Druid', order: 'Animal', feats: [
      { name: 'Order Explorer', type: 'class', level: 2, choice: 'Storm' },
      { name: 'Order Explorer', type: 'class', level: 4, choice: 'Wild' },
    ] }
    const previous = getSettings()
    try {
      updateSettings({ orderExplorerSkills: true, autoClassSkills: false })
      expect(ranksAt(c, [druid])).toMatchObject({ Athletics: 1, Acrobatics: 1, Intimidation: 1 })
      expect(ranksAt({ ...c, level: 1 }, [druid]).Acrobatics ?? 0).toBe(0)
      expect(ranksAt(c, [druid], 4).Intimidation ?? 0).toBe(0)
      expect(ranksAt({ ...c, className: 'Ranger' }, [druid]).Intimidation ?? 0).toBe(0)
      updateSettings({ autoClassSkills: true })
      expect(ranksAt(c, [druid])).toMatchObject({ Athletics: 3, Acrobatics: 3, Intimidation: 3 })
      updateSettings({ orderExplorerSkills: false, autoClassSkills: false })
      expect(ranksAt(c, [druid]).Acrobatics ?? 0).toBe(0)
      expect(ranksAt(c, [druid]).Intimidation ?? 0).toBe(0)
      expect(ranksAt({ ...c, order: 'Wave' }, [druid]).Medicine).toBe(1)
    } finally { updateSettings(previous) }
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
  it('applies Hellknight Preferment only to Hellknight armor, with +1 resistance, expert Intimidation and a circumstance bonus', () => {
    const plate = { ...entry('armorGroup', 'Plate'), description: 'Plate armor.' }
    const hellknight = entry('armor', 'Hellknight Plate', { armor_group: 'Plate', armor_category: 'Heavy' })
    const full = entry('armor', 'Full Plate', { armor_group: 'Plate', armor_category: 'Heavy' })
    const preferment = entry('feat', 'Hellknight Preferment', { grants_armor_specialization: 'yes' })
    const wear = (name: string) => ({ ...base, level: 7, feats: [{ name: 'Hellknight Preferment', type: 'Archetype Feat', level: 6 }],
      armors: [{ id: 'a', name, worn: true, potency: 0, resilient: 0, runes: [] }] } as Character)
    const all = [plate, hellknight, full, preferment]
    expect(armorSpecialization(wear('Hellknight Plate'), all)?.benefit).toEqual({ kind: 'resistance', damage: 'Slashing', value: 3 })
    expect(armorSpecialization(wear('Full Plate'), all)).toBeUndefined()
    expect(ranksAt(wear('Full Plate'), all).Intimidation).toBe(2)
  })
})

describe('feat-granted slots', () => {
  it('calculates Bulk from Strength and active stacking feat bonuses without applying future feats', () => {
    const data = [
      { ...entry('feat', 'Hardy Traveler', {}, 9), description: 'Friends help. Increase your maximum and encumbered Bulk limits by 1.' },
      { ...entry('feat', 'Hefty Hauler'), description: 'Increase your maximum and encumbered Bulk limits by 2.' },
    ]
    const c: Character = { ...base, level: 9, abilities: { ...base.abilities, str: 14 },
      feats: data.map(feat => ({ name: feat.name, type: 'General Feat', level: feat.level })) }
    expect(bulkLimits(c, data)).toMatchObject({ encumbered: 10, maximum: 15 })
    expect(bulkLimits({ ...c, level: 8 }, data)).toMatchObject({ encumbered: 9, maximum: 14 })
    expect(bulkLimits({ ...c, feats: [] }, data)).toMatchObject({ encumbered: 7, maximum: 12 })
    expect(bulkLimits({ ...c, feats: [...c.feats, c.feats[0]] }, data)).toMatchObject({ encumbered: 10, maximum: 15 })
  })

  it.each([['Tiny', 2, 5], ['Large', 10, 20], ['Huge', 20, 40], ['Gargantuan', 40, 80]])(
    'adjusts and rounds Bulk limits for %s ancestry size', (size, encumbered, maximum) => {
      const ancestry = entry('ancestry', 'Sized Ancestry', { size })
      expect(bulkLimits({ ...base, ancestry: ancestry.name, abilities: { ...base.abilities, str: 10 } }, [ancestry]))
        .toMatchObject({ encumbered, maximum })
    })

  it('applies conditional carrying feats only while raging and Soldier Constitution bonuses only for Walking Armory', () => {
    const c: Character = { ...base, level: 9, abilities: { ...base.abilities, str: 14, con: 16 },
      feats: [{ name: 'Adrenaline Rush', type: 'Class Feat', level: 1 }] }
    expect(bulkLimits(c, [])).toMatchObject({ encumbered: 7, maximum: 12 })
    expect(bulkLimits({ ...c, raging: true }, [])).toMatchObject({ encumbered: 9, maximum: 14 })
    const feature = entry('classFeature', 'Walking Armory', { class: 'Soldier' })
    expect(bulkLimits({ ...c, className: 'Soldier' }, [feature])).toMatchObject({ encumbered: 9, maximum: 15 })
    expect(bulkLimits(c, [feature])).toMatchObject({ encumbered: 7, maximum: 12 })
  })

  it('counts Talon Transporter granted Hefty Hauler once, and grants the additional bonus only when Hefty Hauler was already taken', () => {
    const data = [{ ...entry('feat', 'Hefty Hauler', {}, 1, ['General', 'Skill']), description: 'Increase your maximum and encumbered Bulk limits by 2.' }]
    const talon = { name: 'Talon Transporter', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' }
    const c: Character = { ...base, level: 13, abilities: { ...base.abilities, str: 10 }, feats: [talon] }
    expect(automaticFeatGrants(c, data)).toContainEqual({ name: 'Hefty Hauler', source: talon.name, level: 9 })
    expect(bulkLimits(c, data)).toMatchObject({ encumbered: 7, maximum: 12 })
    expect(eligibleFeats(data, c, { key: 'general:11:0', category: 'general', level: 11 })).not.toContain(data[0])
    const prior = { ...c, feats: [{ name: 'Hefty Hauler', type: 'Skill Feat', level: 1, slot: 'skill:2:0' }, talon] }
    expect(automaticFeatGrants(prior, data).some(feat => feat.name === 'Hefty Hauler')).toBe(false)
    expect(bulkLimits(prior, data)).toMatchObject({ encumbered: 9, maximum: 14 })
  })

  it('limits each training feat once by default, allows repeats when disabled, and preserves saved copies', () => {
    expect(getSettings().singleTrainingFeats).toBe(true)
    const data = ['General Training', 'Advanced General Training'].map(name =>
      entry('feat', name, { repeatable: true }, 1, ['Human']))
    const slot = { key: 'ancestry:17:0', category: 'ancestry' as const, level: 17 }
    try {
      for (const chosen of data) {
        const c: Character = { ...base, level: 17, ancestry: 'Human',
          feats: [{ name: chosen.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:13:0' }] }
        updateSettings({ singleTrainingFeats: true })
        expect(eligibleFeats(data, c, slot)).not.toContain(chosen)
        expect(eligibleFeats(data, c, slot)).toContain(data.find(feat => feat !== chosen))
        expect(eligibleFeats(data, c, { ...slot, key: 'ancestry:13:0', level: 13 })).toContain(chosen)
        updateSettings({ singleTrainingFeats: false })
        expect(eligibleFeats(data, c, slot)).toContain(chosen)
        const duplicated = { ...c, feats: [...c.feats, { ...c.feats[0], slot: 'ancestry:17:0' }] }
        const saved = JSON.stringify(duplicated)
        const slots = plannedSlots(duplicated)
        updateSettings({ singleTrainingFeats: true })
        expect(JSON.stringify(duplicated)).toBe(saved)
        expect(plannedSlots(duplicated)).toEqual(slots)
      }
    } finally { updateSettings({ singleTrainingFeats: true }) }
  })

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
  it('derives Raging Intimidation grants only when level and skill prerequisites are met, independently of Rage', () => {
    const c: Character = { ...base, className: 'Barbarian', level: 15, skillPicks: ['Intimidation'],
      rankOverrides: { Intimidation: 4 }, feats: [{ name: 'Raging Intimidation', type: 'Class Feat', level: 1, slot: 'class:1:0' }] }
    const original = JSON.stringify(c)
    const glare = { name: 'Intimidating Glare', source: 'Raging Intimidation', level: 1 }
    const scare = { name: 'Scare to Death', source: 'Raging Intimidation', level: 15 }
    expect(automaticFeatGrants(c, [])).toEqual([glare, scare])
    expect(automaticFeatGrants({ ...c, raging: true }, [])).toEqual([glare, scare])
    expect(automaticFeatGrants({ ...c, level: 14 }, [])).toEqual([glare])
    expect(automaticFeatGrants({ ...c, rankOverrides: { Intimidation: 3 } }, [])).toEqual([glare])
    expect(automaticFeatGrants({ ...c, skillPicks: [], rankOverrides: {} }, [])).toEqual([])
    expect(automaticFeatGrants({ ...c, feats: [] }, [])).toEqual([])
    expect(automaticFeatGrants({ ...c, level: 7, feats: [{ ...c.feats[0], slot: 'class:8:0' }] }, [])).toEqual([])
    expect(JSON.stringify(c)).toBe(original)
  })

  it('dates granted feats by actual acquisition and delayed skill eligibility, not their printed feat level', () => {
    const c: Character = { ...base, level: 17, skillPicks: ['Intimidation'], skillIncreases: {
      3: 'Intimidation', 7: 'Intimidation', 17: 'Intimidation',
    }, feats: [
      { name: 'Clever Improviser', type: 'Ancestry Feat', level: 5, slot: 'ancestry:9:0' },
      { name: 'Greenwatch Initiate', type: 'Class Feat', level: 4, slot: 'class:1:g1', takenLevel: 8 },
      { name: 'Raging Intimidation', type: 'Class Feat', level: 1, slot: 'class:10:0' },
    ] }
    expect(automaticFeatGrants(c, [])).toEqual([
      { name: 'Untrained Improvisation', source: 'Clever Improviser', level: 9 },
      { name: 'Experienced Tracker', source: 'Greenwatch Initiate', level: 8 },
      { name: 'Survey Wildlife', source: 'Greenwatch Initiate', level: 8 },
      { name: 'Intimidating Glare', source: 'Raging Intimidation', level: 10 },
      { name: 'Scare to Death', source: 'Raging Intimidation', level: 17 },
    ])
    expect(automaticFeatGrants({ ...c, level: 7 }, [])).toEqual([])
    expect(automaticFeatGrants(JSON.parse(JSON.stringify(c)), [])).toEqual(automaticFeatGrants(c, []))
  })

  it('recognizes automatic feats in downstream prerequisites at acquisition level and excludes them from pickers', () => {
    const glare = entry('feat', 'Intimidating Glare', { prerequisite: 'trained in Intimidation' }, 1, ['General', 'Skill'])
    const scare = entry('feat', 'Scare to Death', { prerequisite: 'legendary in Intimidation' }, 15, ['General', 'Skill'])
    const dependent = entry('feat', 'Terrifying Howl', { prerequisite: 'Intimidating Glare' }, 10, ['Barbarian'])
    const data = [glare, scare, dependent]
    const c: Character = { ...base, className: 'Barbarian', level: 15, skillPicks: ['Intimidation'], rankOverrides: { Intimidation: 4 },
      feats: [{ name: 'Raging Intimidation', type: 'Class Feat', level: 1 }] }
    expect(featPrerequisiteChecker(c, data)(dependent)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker({ ...c, feats: [{ ...c.feats[0], slot: 'class:12:0' }] }, data, 10)(dependent).missing).toEqual(['Intimidating Glare'])
    expect(eligibleFeats(data, c, { key: 'skill:16:0', category: 'skill', level: 16 })).toEqual([])
    expect(eligibleFeats(data, { ...c, feats: [] }, { key: 'skill:16:0', category: 'skill', level: 16 })).toEqual([glare, scare])
  })

  it('recognizes known Rage-only scent when selecting Nocturnal Senses without making the sense permanent', () => {
    const nocturnal = entry('feat', 'Nocturnal Senses', { prerequisite: 'low-light vision or scent', grants_vision: 'Low-Light Vision' }, 6, ['Barbarian'])
    const c: Character = { ...base, className: 'Barbarian', level: 6,
      feats: [{ name: 'Acute Scent', type: 'Class Feat', level: 2 }] }
    expect(featPrerequisiteChecker(c, [nocturnal])(nocturnal)).toEqual({ missing: [], manual: [] })
    expect(senses(c, [nocturnal])).toEqual([])
    expect(featPrerequisiteChecker({ ...c, feats: [] }, [nocturnal])(nocturnal).missing).toEqual(['low-light vision or scent'])
  })

  it('adds lores and senses from feats', () => {
    const feat = entry('feat', 'Wild Hunter Dedication', { grants_lore: 'Hunting Lore', grants_vision: 'Darkvision' })
    const c = { ...base, level: 8, feats: [{ name: 'Wild Hunter Dedication', type: 'Dedication Feat', level: 8 }] }
    expect(featLores(c, [feat])).toEqual(['Hunting Lore'])
    expect(ranksAt(c, [feat])['Hunting Lore']).toBe(3)
    expect(featLores({ ...c, level: 7 }, [feat])).toEqual([])
    expect(senses(c, [feat])).toEqual([{ value: 'Darkvision', source: 'Wild Hunter Dedication' }])
  })

  it('resolves metadata grants only for relevant feat names and refreshes them with the catalog', () => {
    const grant = entry('feat', 'Custom Lore Grant', { grants_lore: 'Hunting Lore' })
    const unrelated = Array.from({ length: 20 }, (_, index) => entry('feat', `Unrelated ${index}`))
    const catalog = [grant, ...unrelated]
    const c: Character = { ...base, feats: catalog.map(feat => ({ name: feat.name, type: 'General Feat', level: 1 })) }
    const resolve = vi.spyOn(featChoices, 'selectedFeatEntry')
    try {
      expect(featLores(c, catalog)).toEqual(['Hunting Lore'])
      expect(resolve).toHaveBeenCalledTimes(1)
      expect(featLores({ ...c, updatedAt: 1 }, catalog)).toEqual(['Hunting Lore'])
      expect(resolve).toHaveBeenCalledTimes(2)
      expect(featLores(c, [{ ...grant, data: { grants_lore: 'Sailing Lore' } }, ...unrelated])).toEqual(['Sailing Lore'])
      expect(featLores(c, [{ ...grant, deleted: true }, ...unrelated])).toEqual([])
    } finally { resolve.mockRestore() }
  })

  it('keeps indexed metadata grants tied to the enabled and explicitly selected source', () => {
    const original = entry('feat', 'Shared Lore Grant')
    const variant: ContentEntry = { ...original, id: 'sf-lore-grant', systems: ['sf2e'],
      data: { grants_lore: 'Space Lore', grants_vision: 'Darkvision' } }
    const catalog = [original, variant]
    const c: Character = { ...base, systems: ['pf2e', 'sf2e'],
      feats: [{ name: original.name, type: 'General Feat', level: 1, sourceId: original.id }] }
    expect(featLores(c, catalog)).toEqual([])
    const selected: Character = { ...c, feats: [{ ...c.feats[0], sourceId: variant.id }] }
    expect(featLores(selected, catalog)).toEqual(['Space Lore'])
    expect(senses(selected, catalog)).toEqual([{ value: 'Darkvision', source: original.name }])
    expect(featLores({ ...selected, systems: ['pf2e'] }, catalog)).toEqual([])
    expect(featLores({ ...selected, feats: [{ ...selected.feats[0], sourceId: 'missing' }] }, catalog)).toEqual([])
  })
})

describe('armor specialization from feats', () => {
  it('limits Skins of the Slain to its armor groups and categories', () => {
    const feat = entry('feat', 'Skins Of The Slain', { grants_armor_specialization: 'yes', grants_armor_groups: 'leather, skeletal, wood', grants_armor_categories: 'light, medium' })
    const groups = ['Leather', 'Chain'].map((n) => ({ ...entry('armorGroup', n), description: `${n} effect.` }))
    const armors = [entry('armor', 'Leather Armor', { armor_group: 'Leather', armor_category: 'Light' }), entry('armor', 'Chain Mail', { armor_group: 'Chain', armor_category: 'Medium' })]
    const wear = (name: string) => ({ ...base, level: 10, feats: [{ name: feat.name, type: 'Archetype Feat', level: 10 }], armors: [{ id: 'a', name, worn: true, potency: 0, resilient: 0, runes: [] }] }) as Character
    const all = [feat, ...groups, ...armors]
    expect(armorSpecialization(wear('Leather Armor'), all)?.group).toBe('Leather')
    expect(armorSpecialization(wear('Chain Mail'), all)).toBeUndefined()
  })
})

describe('homebrew feat rules', () => {
  it('grants Rangers a separate Cavalier slot without displacing saved choices or requiring Free Archetype', ({ onTestFinished }) => {
    const previous = getSettings()
    onTestFinished(() => updateSettings(previous))
    updateSettings({ rangerCavalier: true, rangerSnarecrafter: false, freeArchetype: true })
    const ranger: Character = { ...base, className: 'Ranger', level: 2,
      feats: [{ name: 'Medic Dedication', type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' }] }
    const before = JSON.stringify(ranger)
    expect(activeHomebrewDedications(ranger)).toContainEqual(expect.objectContaining({
      name: 'Cavalier Dedication', slot: 'archetype:2:g96',
    }))
    const keys = (c = ranger) => plannedSlots(c).map(slot => slot.key)
    expect(keys()).toEqual(expect.arrayContaining(['archetype:2:g96', 'archetype:2:0']))
    expect(unslottedFeats(ranger)).toEqual([])
    expect(keys({ ...ranger, level: 1 })).not.toContain('archetype:2:g96')
    expect(keys({ ...ranger, className: 'Wizard' })).not.toContain('archetype:2:g96')
    updateSettings({ rangerCavalier: false })
    expect(keys()).not.toContain('archetype:2:g96')
    expect(unslottedFeats(ranger)).toEqual([])
    updateSettings({ rangerCavalier: true, freeArchetype: false })
    expect(keys()).toContain('archetype:2:g96')
    expect(keys()).not.toContain('archetype:2:0')
    updateSettings({ rangerSnarecrafter: true })
    expect(keys()).toEqual(expect.arrayContaining(['archetype:2:g96', 'archetype:2:g99']))
    expect(JSON.stringify(ranger)).toBe(before)
  })

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

it('adds only +1 Hardness from Blessed Shield to Scale of Igroon', () => {
  const shield = { id: 'scale', name: 'Scale of Igroon', hardness: 20, hp: 160, damage: 0, raised: false }
  const c: Character = { ...base, className: 'Champion', level: 10, blessing: 'Blessed Shield', shield }
  expect(shieldStats(shield, c)).toEqual({ hardness: 21, hp: 160 })
  expect(shieldStats(shield, { ...c, blessing: 'Blessed Swiftness' })).toEqual({ hardness: 20, hp: 160 })
})

it('allows only one Mortification damage-type variant', () => {
  const variants = ['Bludgeoning', 'Piercing'].map(type => entry('feat', `Mortification (${type})`, { archetype: 'Hellknight' }, 4, ['Archetype']))
  const slot = { key: 'bonus:6:0', category: 'bonus' as const, level: 6 }
  const c: Character = { ...base, level: 6, feats: [{ name: 'Mortification (Bludgeoning)', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' }] }
  expect(eligibleFeats(variants, c, slot, { includeUnmetPrerequisites: true }).map(feat => feat.name)).toEqual([])
  expect(eligibleFeats(variants, { ...c, feats: [] }, slot, { includeUnmetPrerequisites: true }).map(feat => feat.name))
    .toEqual(['Mortification (Bludgeoning)', 'Mortification (Piercing)'])
})

it('grants Infernal Bulwark order resistance and heavy armor training', () => {
  const feat = { name: 'Infernal Bulwark', type: 'Archetype Feat', level: 10, choice: 'Order of the Pyre' }
  const c: Character = { ...base, systems: ['sf2e'], level: 12, feats: [feat] }
  expect(featChoiceOptions('Infernal Bulwark', c, [], '')).toContain('Order of the Crucible')
  expect(armorRanks(c, []).Heavy).toBeGreaterThanOrEqual(1)
})

it('gives Hellknight Dedication mental resistance of 1 plus its archetype feats', () => {
  const dedication = entry('feat', 'Hellknight Dedication', { archetype: 'Hellknight' }, 2, ['Archetype', 'Dedication'])
  dedication.description = 'You gain resistance to mental damage equal to 1 + your number of archetype class feats.'
  const other = entry('feat', 'Diabolic Certitude', { archetype: 'Hellknight' }, 4, ['Archetype'])
  const feats = [{ name: dedication.name, type: 'Archetype Feat', level: 2 }, { name: other.name, type: 'Archetype Feat', level: 4 }]
  const c: Character = { ...base, level: 4, feats: feats.slice(0, 1) }
  expect(resistances(c, [dedication, other]).find(r => r.damage === 'Mental')?.value).toBe(1)
  expect(resistances({ ...c, feats }, [dedication, other]).find(r => r.damage === 'Mental')?.value).toBe(2)
})
