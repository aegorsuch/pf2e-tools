import { parseClericSpells, parseDeityAbout, parseFeatLanguages } from './aonQuery'
import { mapAonHit } from './aon'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import * as featChoices from './featChoices'
import { ancestralSkills, movementSpeeds, armorRanks, weaponRanks, featChoiceOptions, armorSpecialization, autoClassSkills, automaticFeatGrants, bulkLimits, classLabel, characterAncestryLabel, characterSummary, subclassOptions, subclassSkillChoice, subclassSkillGrants, selectedSubclass, investigatorSkillfulLessonSkills, availableOrders, featLores, trainedFeatLores, senses, additionalSkillCount, ancestryLabel, armorClass, boostSlots, cannyAcumenOptions, classFeatures, classSkills, computeAbilities, baseItems, eligibleFeats, featPrerequisiteChecker, isMagicItem, isVersatileHeritage, heritagesFor, languageAllowance, languageGroups, maxHp, normalizeConditionalSkillChoices, orphanedArchetypeFeats, focusSpells, orderMagicOptions, propertyRunes, resistances, savingThrowBreakdown, starfinderArmorPenalties, untrainedSkillProficiency, unslottedFeats, speed, initiativeBonus, perceptionCircumstance, plannedSlots, ranksAt, skillRankBudget, weaponAttack, activeFeatsNamed, precisionEdgeDamageDice, enlargedChassisSize, giantWeaponClumsy, giantClumsySource, unconventionalWeaponChoice, weaponAccessSources, spellRemovalChange, syncClassArchetypeDedication, warriorLegendWeakness, parryValue, temporaryHpGrant } from './builder'
import { getSettings, updateSettings } from './settings'
import { automaticFeatChoiceKey, coreAttunementOptions, grantedFeatSpells } from './featSpells'
import { apexSkillBonus, shieldStats, activeHomebrewDedications, homebrewDedication, hitPointBonuses, terrainExpertiseBenefits, terrainExpertiseOptions, normalizeGrantedSkillSpending } from './builder'
import { characterClassSkills, classExtraSlots, classRepertoireRows, classSpellSlots, classSpellcasting, wizardSchoolBookSpells } from './builder'
import { hasRemainingFeatSelections } from './builder'
import { homebrewCharacterOptions } from './supplemental'
import { maxEtchedRunes, runicRepertoireSize } from './runesmithRunes'
import { STARFINDER_SUBCLASSES } from './starfinderSubclasses'
import { GREATER_CROSS_PLATFORM_APPLICATION_FEAT, TECHNOMANCER_LANGUAGE_RULES, TECHNOMANCER_PROGRAMMING_LANGUAGES,
  VERSATILE_FIRMWARE_FEAT } from './technomancer'
import type { Character, ContentEntry } from './types'

it('clears Bone Shield activation and raised state when removed', () => {
  const c: Character = { id: 'bone-shield', name: 'Test', systems: ['pf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    activeSpells: ['Bone Shield', 'Shield'], boneShieldRaised: true }
  expect(spellRemovalChange(c, 'Bone Shield')).toEqual({ activeSpells: ['Shield'], boneShieldRaised: false })
})

it('applies Warrior of Legend armor and spear/polearm proficiency rules', () => {
  const fighter = entry('class', 'Fighter', {
    attack_proficiency: 'Trained in simple weapons, Trained in martial weapons',
    defense_proficiency: 'Trained in all armor, Trained in unarmored defense',
  })
  const expertise = { ...entry('classFeature', 'Fighter Weapon Expertise', { class: 'Fighter' }, 5),
    description: 'Your proficiency rank for simple and martial weapons increases to expert.' }
  const mastery = { ...entry('classFeature', 'Weapon Mastery', { class: 'Fighter' }, 13),
    description: 'Your proficiency rank for simple and martial weapons increases to master.' }
  const legend = { ...entry('classFeature', 'Weapon Legend', { class: 'Fighter' }, 19),
    description: 'Your proficiency rank for simple and martial weapons increases to legendary.' }
  const spear = entry('weapon', 'Longspear', {
    weapon_category: 'Martial', weapon_group: 'Polearm', weapon_type: 'Melee', damage: '1d8 piercing', hands: 2,
  })
  const sword = entry('weapon', 'Longsword', {
    weapon_category: 'Martial', weapon_group: 'Swords', weapon_type: 'Melee', damage: '1d8 slashing', hands: 1,
  })
  const shieldBlock = entry('classFeature', 'Shield Block', { class: 'Fighter' })
  const dedication = { name: 'Warrior of Legend Dedication', type: 'Class Feat', level: 2, choice: 'Bludgeoning' }
  const c: Character = { ...base, level: 20, className: 'Fighter', subclass: 'Warrior of Legend',
    conditions: { doomed: 2 }, feats: [dedication] }
  const entries = [fighter, expertise, mastery, legend, spear, sword, shieldBlock]
  const weapon = (name: string) => ({ id: name, name, potency: 0, striking: 0, runes: [] })

  expect(armorRanks(c, [fighter]).Heavy).toBe(0)
  expect(weaponRanks(c, entries).Martial).toBe(2)
  expect(weaponAttack(c, entries, weapon('Longspear'))).toMatchObject({
    rank: 4, damage: expect.stringContaining('+2 piercing'), traits: expect.arrayContaining(['Parry']),
  })
  expect(weaponAttack(c, entries, weapon('Longsword')).rank).toBe(2)
  expect(weaponAttack({ ...c, shield: {
    id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false, equipped: true,
  } }, entries, weapon('Longspear')).traits).not.toContain('Parry')
  expect(featChoiceOptions(dedication.name, c, entries, 'class:2:0'))
    .toEqual(['Bludgeoning', 'Piercing', 'Slashing'])
  expect(resistances(c, entries).some(resistance => resistance.source === dedication.name)).toBe(false)
  expect(resistances({ ...c, feats: [...c.feats, { name: 'Only My Doom May Claim Me', type: 'Class Feat', level: 14 }] }, entries))
    .toContainEqual({ damage: 'Weapon and unarmed attacks except bludgeoning', value: 10, source: 'Only My Doom May Claim Me' })
  expect(warriorLegendWeakness(c, entries)).toEqual({ damage: 'bludgeoning', value: 10 })
  const stance = entry('feat', 'Spear of Doom', {}, 10, ['Stance'])
  const inStance = { ...c, activeStance: stance.name, feats: [...c.feats, { name: stance.name, type: 'Class Feat', level: 10 }] }
  expect(warriorLegendWeakness(inStance, [...entries, stance])).toEqual({ damage: 'bludgeoning', value: 20 })
  expect(characterClassSkills(c, entries).fixed).toEqual(expect.arrayContaining(['Acrobatics', 'Athletics']))
  expect(automaticFeatGrants(c, entries)).toContainEqual(expect.objectContaining({ name: 'Diehard', source: 'Warrior of Legend' }))
  expect(automaticFeatGrants(c, entries).some(grant => grant.name === 'Shield Block')).toBe(false)
  expect(classFeatures(entries, c).some(feature => feature.name === 'Shield Block')).toBe(false)
  const fighterOnly = { ...c, subclass: undefined }
  expect(automaticFeatGrants(fighterOnly, entries)).toContainEqual(expect.objectContaining({ name: 'Shield Block' }))
  expect(classFeatures(entries, fighterOnly).some(feature => feature.name === 'Shield Block')).toBe(true)
  const parrySpear = { ...spear, traits: ['Parry'] }
  expect(parryValue({ ...c, weapons: [weapon('Longspear')] }, [...entries.filter(item => item !== spear), parrySpear])).toBe(2)
  const heroic = { ...c, feats: [...c.feats, { name: 'Heroic Defiance', type: 'Class Feat', level: 4 }], activeFeatEffects: ['Heroic Defiance'] }
  expect(temporaryHpGrant(heroic, entries)?.value).toBe(20)
  expect(savingThrowBreakdown(heroic, entries, 'Will').total).toBe(savingThrowBreakdown(c, entries, 'Will').total + 1)
})

const entry = (kind: ContentEntry['kind'], name: string, data: ContentEntry['data'] = {}, level = 1, traits: string[] = []): ContentEntry => ({
  id: `${kind}:${name}`, systems: ['pf2e'], kind, source: 'official', name, level, traits, description: '', data, effects: [], updatedAt: 1,
})

it('matches named Clawed Gauntlet variants to their Unconventional Weaponry base', () => {
  const claw = entry('weapon', 'Clawed Gauntlet', { weapon_type: 'Melee', weapon_category: 'Martial', damage: '1d4 slashing' }, 1, ['Uncommon'])
  const variant = (prefix: string) => entry('weapon', `${prefix} Clawed Gauntlet`, {
    ...claw.data, named_weapon: true, named_weapon_source: `${prefix} Gauntlet`, named_weapon_base: claw.name,
  }, 11, ['Uncommon'])
  const variants = ['Scalding', 'Corroding', 'Freezing', 'Shocking'].map(variant)
  const entries = [claw, ...variants]
  const feat = { name: 'Unconventional Weaponry', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0',
    choice: claw.name, culturalWeapon: true }
  const c: Character = { ...base, className: 'Wizard', ancestry: 'Human', level: 2, feats: [feat] }
  for (const weapon of variants) expect(unconventionalWeaponChoice(entries, weapon.name)).toBe(claw.name)
  expect(featChoiceOptions(feat.name, c, entries, feat.slot, 0)).toEqual([claw.name])
  expect(weaponAccessSources(c, entries, variants[2])).toContain('Unconventional Weaponry')
})

it('grants Tattooed Historian a trained skill token and preserves legacy choices', () => {
  const feat = { name: 'Tattooed Historian Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }
  const c: Character = { ...base, level: 2, feats: [feat] }
  expect(skillRankBudget(c, []).trained).toBe(skillRankBudget({ ...c, feats: [] }, []).trained + 1)
  const picked = { ...c, feats: [{ ...feat, choice: 'Diplomacy' }] }
  expect(ranksAt(picked, []).Diplomacy).toBe(1)
  expect(ranksAt({ ...picked, level: 1 }, []).Diplomacy ?? 0).toBe(0)
  const background = entry('background', 'Diplomat', { skill: 'Diplomacy' })
  expect(skillRankBudget({ ...c, background: background.name }, [background]).trained)
    .toBe(skillRankBudget({ ...c, background: background.name, feats: [] }, [background]).trained + 1)
  const both = entry('background', 'Performer', { skill: 'Diplomacy, Performance' })
  const trained = { ...c, background: both.name }
  expect(featChoiceOptions(feat.name, trained, [both], feat.slot, 0)).toBeUndefined()
  expect(skillRankBudget(trained, [both]).trained).toBe(skillRankBudget({ ...trained, feats: [] }, [both]).trained + 1)
  expect(ranksAt({ ...trained, skillPicks: ['Crafting'] }, [both])).toMatchObject({ Diplomacy: 1, Performance: 1, Crafting: 1 })
})

it('grants Captain Dedication a trained token and a constrained bonus skill feat', () => {
  const feat = { name: 'Captain Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }
  const c: Character = { ...base, level: 2, feats: [feat] }
  expect(skillRankBudget(c, []).trained).toBe(skillRankBudget({ ...c, feats: [] }, []).trained + 1)
  expect(ranksAt({ ...c, skillPicks: ['Intimidation'] }, []).Intimidation).toBe(1)
  const background = entry('background', 'Leader', { skill: 'Diplomacy, Intimidation' })
  const trained = { ...c, background: background.name }
  expect(skillRankBudget(trained, [background]).trained).toBe(skillRankBudget({ ...trained, feats: [] }, [background]).trained + 1)

  const impression = entry('feat', 'Group Impression', {}, 1, ['Skill'])
  const coercion = entry('feat', 'Group Coercion', {}, 1, ['Skill'])
  const other = entry('feat', 'Other Skill Feat', {}, 1, ['Skill'])
  const entries = [impression, coercion, other]
  const slot = plannedSlots(c, entries).find(s => s.grantedBy === 'Captain Dedication')!
  expect(slot).toMatchObject({ category: 'skill', level: 2, maxFeatLevel: 1 })
  expect(eligibleFeats(entries, c, slot).map(e => e.name).sort()).toEqual(['Group Coercion', 'Group Impression'])
  const both = { ...c, feats: [...c.feats, { name: impression.name, type: 'Skill Feat', level: 1 },
    { name: coercion.name, type: 'Skill Feat', level: 1 }] }
  expect(eligibleFeats(entries, both, slot).map(e => e.name)).toEqual(['Other Skill Feat'])
  expect(plannedSlots({ ...c, level: 1 }, entries).some(s => s.grantedBy === 'Captain Dedication')).toBe(false)
})

it("grants Inscribed with Elders' Deeds a normal first-level ancestry slot", () => {
  const source = { name: "Inscribed with Elders' Deeds", type: 'Archetype Feat', level: 6, slot: 'archetype:6:0' }
  const c: Character = { ...base, level: 6, ancestry: 'Human', feats: [source] }
  const first = entry('feat', 'Orc First', {}, 1, ['Orc'])
  const fifth = entry('feat', 'Orc Fifth', {}, 5, ['Orc'])
  const human = entry('feat', 'Human First', {}, 1, ['Human'])
  const entries = [first, fifth, human]
  const slot = plannedSlots(c, entries).find(item => item.key === 'ancestry:1:elders-deeds')!
  expect(slot).toMatchObject({ level: 1, category: 'ancestry' })
  expect(eligibleFeats(entries, c, slot).map(item => item.name)).toEqual(['Human First'])
  expect(eligibleFeats(entries, { ...c, level: 13 }, slot).map(item => item.name)).toEqual(['Human First'])
  expect(plannedSlots({ ...c, level: 5 }, entries).some(item => item.key === slot.key)).toBe(false)
  expect(plannedSlots({ ...c, feats: [] }, entries).some(item => item.key === slot.key)).toBe(false)
})

it('grants permanent flight at land Speed from Eternal Wings only when active', () => {
  const c: Character = { ...base, systems: ['pf2e'], level: 17,
    feats: [{ name: 'Eternal Wings', type: 'Ancestry Feat', level: 17, takenLevel: 17 }] }
  expect(movementSpeeds(c, [])).toContainEqual({ name: 'Fly', feet: 25, source: 'Eternal Wings' })
  const ancestry = entry('ancestry', 'Fast Ancestry', { speed: 30 })
  expect(movementSpeeds({ ...c, ancestry: ancestry.name }, [ancestry]))
    .toContainEqual({ name: 'Fly', feet: 30, source: 'Eternal Wings' })
  expect(movementSpeeds({ ...c, level: 16 }, []).some(speed => speed.name === 'Fly')).toBe(false)
  expect(movementSpeeds({ ...c, feats: [] }, []).some(speed => speed.name === 'Fly')).toBe(false)
})

it('grants Vindication starting skills and divine warden spell at level 1', () => {
  const ranger = entry('class', 'Ranger', { skill_proficiency: 'Trained in Nature, Trained in Survival, Trained in a number of additional skills equal to 4 plus your Intelligence modifier' })
  const mark = entry('spell', "Vindicator's Mark", {}, 1, ['Focus'])
  const c: Character = { ...base, className: 'Ranger', subclass: 'Vindication', level: 1, feats: [] }
  expect(characterClassSkills(c, [ranger]).fixed).toContain('Religion')
  expect(characterClassSkills(c, [ranger]).fixed).not.toContain('Nature')
  expect(focusSpells(c, [ranger, mark])).toMatchObject({ spells: [{ name: "Vindicator's Mark", source: 'Vindication' }], points: 1 })
  expect(focusSpells(c, [ranger]).spells[0].name).toBe("Vindicator's Mark")
  expect(classSpellcasting(c, [ranger])).toMatchObject({ traditions: ['Divine'], ability: 'wis' })
  expect(classSpellcasting({ ...c, feats: [{ name: 'Primal Warrior', type: 'Class Feat', level: 1 }] }, [ranger]))
    .toMatchObject({ traditions: ['Divine'], ability: 'wis' })
  expect(focusSpells({ ...c, subclass: 'Flurry' }, [ranger]).spells).toEqual([])
  expect(focusSpells({ ...c, level: 0 }, [ranger]).spells).toEqual([])
  expect(focusSpells({ ...c, systems: ['sf2e'] }, [ranger]).spells).toEqual([])
})

it("adds Vindicator's Judgement as a focus spell when its feat is active", () => {
  const judgment = entry('spell', "Vindicator's Judgement", {}, 5, ['Focus'])
  const feat = entry('feat', "Vindicator's Judgement", { archetype: 'Vindicator' }, 10, ['Archetype'])
  const c: Character = { ...base, className: 'Ranger', subclass: 'Vindication', level: 10,
    feats: [{ name: feat.name, type: 'Class Feat', level: 10, slot: 'class:10:0' }] }
  expect(focusSpells(c, [feat, judgment])).toMatchObject({
    spells: expect.arrayContaining([{ name: judgment.name, source: feat.name }]),
    points: 2,
  })
  expect(focusSpells({ ...c, level: 9 }, [feat, judgment]).spells.map(spell => spell.name))
    .not.toContain(judgment.name)
})

it('detects unfilled current feat slots while respecting filled and skipped slots', () => {
  const c: Character = { id: 'remaining', name: 'Remaining', systems: ['pf2e'], level: 2,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const slots = plannedSlots(c)
  expect(hasRemainingFeatSelections(c)).toBe(true)
  const filled = { ...c, feats: slots.map(slot => ({
    name: 'Selected', type: 'Ancestry Feat', level: slot.level, slot: slot.key,
  })) }
  expect(hasRemainingFeatSelections(filled)).toBe(false)
  expect(hasRemainingFeatSelections({ ...filled, feats: filled.feats.slice(1) })).toBe(true)
  expect(hasRemainingFeatSelections({ ...filled, feats: filled.feats.slice(1), skippedFeatSlots: [slots[0].key] })).toBe(false)
  expect(hasRemainingFeatSelections({ ...filled, level: 3 })).toBe(true)
})

it('detects catalog-dependent background feat selections', () => {
  const c: Character = { id: 'background', name: 'Background', systems: ['pf2e'], level: 1, background: 'Scout',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const filled = { ...c, feats: plannedSlots(c).map(slot => ({
    name: 'Selected', type: 'Ancestry Feat', level: slot.level, slot: slot.key,
  })) }
  const catalog = [entry('background', 'Scout', { feat: 'Assurance' }), entry('feat', 'Assurance', { repeatable: true }, 1, ['General', 'Skill'])]
  expect(hasRemainingFeatSelections(filled)).toBe(false)
  expect(hasRemainingFeatSelections(filled, catalog)).toBe(true)
  const backgroundSlot = plannedSlots(filled, catalog).find(slot => slot.grantedFeat === 'Assurance')!
  expect(hasRemainingFeatSelections({ ...filled, feats: [...filled.feats,
    { name: 'Assurance', type: 'Skill Feat', level: 1, slot: backgroundSlot.key }] }, catalog)).toBe(false)
})

it('hides pack-only feats while multiple companions are disabled, including unmet-prerequisite browsing', () => {
  const previous = getSettings().singleAnimalCompanion
  const dedication = entry('feat', 'Beastmaster Dedication', { archetype: 'Beastmaster' }, 2, ['Archetype', 'Dedication'])
  const pack = ['Lead the Pack', 'Pack Takedown'].map(name =>
    entry('feat', name, { archetype: 'Beastmaster' }, 16, ['Archetype']))
  const c: Character = { ...base, className: 'Fighter', level: 20,
    feats: [{ name: dedication.name, type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }] }
  const slot = { key: 'archetype:20:0', category: 'archetype' as const, level: 20 }
  try {
    updateSettings({ singleAnimalCompanion: true })
    for (const includeUnmetPrerequisites of [false, true]) {
      for (const feat of pack) expect(eligibleFeats([dedication, ...pack], c, slot, { includeUnmetPrerequisites })).not.toContain(feat)
    }
    updateSettings({ singleAnimalCompanion: false })
    for (const feat of pack) expect(eligibleFeats([dedication, ...pack], c, slot)).toContain(feat)
  } finally { updateSettings({ singleAnimalCompanion: previous }) }
})

it.each([
  [1, 0, 1], [10, 0, 1], [11, 0, 2], [18, 1, 0],
  [19, 0, 3], [19, 1, 2], [19, 2, 1], [19, 3, 0],
])('tracks Precision Edge damage at level %i after %i successful prey hits', (level, hits, expected) => {
  const c: Character = { ...base, className: 'Ranger', subclass: 'Precision', level, rangerPrecisionHitsThisRound: hits }
  expect(precisionEdgeDamageDice(c)).toBe(expected)
})

it('does not grant Precision Edge damage to other edges, classes, or rulesets', () => {
  expect(precisionEdgeDamageDice({ ...base, className: 'Ranger', subclass: 'Flurry' })).toBe(0)
  expect(precisionEdgeDamageDice({ ...base, className: 'Fighter', subclass: 'Precision' })).toBe(0)
  expect(precisionEdgeDamageDice({ ...base, systems: ['sf2e'], className: 'Ranger', subclass: 'Precision' })).toBe(0)
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

it('computes feat equivalence only for eligible candidates and reuses it across pickers', () => {
  const fighter = entry('feat', 'Fighter Training', {}, 1, ['Fighter', 'Skill'])
  const readRules = vi.fn(() => 'Fighter training rules.')
  Object.defineProperty(fighter, 'comparisonRules', { get: readRules })
  const ranger = entry('feat', 'Ranger Training', {}, 1, ['Ranger'])
  const entries = [fighter, ranger]
  const slot = { key: 'class:1:0', category: 'class' as const, level: 1 }
  const c: Character = { ...base, className: 'Ranger', level: 1 }
  expect(eligibleFeats(entries, c, slot)).toContain(ranger)
  expect(readRules).not.toHaveBeenCalled()
  expect(eligibleFeats(entries, { ...c, className: 'Fighter' }, slot)).toContain(fighter)
  expect(readRules).toHaveBeenCalled()
  const reads = readRules.mock.calls.length
  eligibleFeats(entries, { ...c, className: 'Fighter' }, slot)
  expect(readRules).toHaveBeenCalledTimes(reads)
})

it('refreshes cached automatic grants when house rules change', () => {
  const previous = getSettings().cyborgTestSubject
  const c: Character = { ...base, systems: ['sf2e'], heritage: 'Cyborg', level: 1 }
  const entries: ContentEntry[] = []
  try {
    updateSettings({ cyborgTestSubject: true })
    expect(automaticFeatGrants(c, entries)).toContainEqual(expect.objectContaining({ name: 'Assurance', choice: 'Computers' }))
    updateSettings({ cyborgTestSubject: false })
    expect(automaticFeatGrants(c, entries)).not.toContainEqual(expect.objectContaining({ name: 'Assurance', choice: 'Computers' }))
  } finally { updateSettings({ cyborgTestSubject: previous }) }
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
  const previous = getSettings().disableAncientElfMultitalented
  onTestFinished(() => updateSettings({ disableAncientElfMultitalented: previous }))
  updateSettings({ disableAncientElfMultitalented: false })
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

it('uses Bloodrager starting skills and replaces duplicate background training', () => {
  const barbarian = entry('class', 'Barbarian', {
    skill_proficiency: 'Trained in Athletics, Trained in a number of additional skills equal to 3 plus your Intelligence modifier',
  })

  const healer = entry('background', 'Healer', { skill: 'Medicine' })
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', background: undefined }
  expect(autoClassSkills(c, [barbarian])).toEqual(expect.arrayContaining(['Athletics', 'Medicine']))
  expect(additionalSkillCount(c, [barbarian])).toBe(2)
  expect(additionalSkillCount({ ...c, background: 'Healer' }, [barbarian, healer])).toBe(3)
  expect(autoClassSkills({ ...c, subclass: 'Fury' }, [barbarian])).not.toContain('Medicine')
  expect(additionalSkillCount({ ...c, subclass: 'Fury' }, [barbarian])).toBe(3)
})

it.each([['Arcane', 'Arcana', 'Religion'], ['Divine', 'Religion', 'Arcana']])(
  'scales Bloodrager %s tradition skill for free', (choice, skill, other) => {
    const dedication = { name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, slot: 'class:2:0', choice }
    const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', background: undefined, feats: [dedication] }
    for (const [level, rank] of [[1, 0], [2, 1], [3, 2], [6, 2], [7, 3], [14, 3], [15, 4], [20, 4]]) {
      const ranks = ranksAt({ ...c, level }, [])
      expect(ranks[skill] ?? 0).toBe(rank)
      expect(ranks[other] ?? 0).toBe(0)
    }
    expect(ranksAt({ ...c, level: 15, rankOverrides: { [skill]: 0 } }, [])[skill]).toBe(4)
    expect(ranksAt({ ...c, level: 15, systems: ['sf2e'] }, [])[skill] ?? 0).toBe(0)
  },
)

it('returns a training choice when Bloodrager Dedication duplicates background training', () => {
  const c: Character = { ...base, level: 2, className: 'Barbarian', subclass: 'Bloodrager', background: 'Scholar',
    feats: [{ name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Arcane' }] }
  expect(additionalSkillCount(c, entries)).toBe(additionalSkillCount({ ...c, feats: [] }, entries) + 1)
  expect(ranksAt(c, entries, 2).Arcana).toBe(1)
})

it.each([
  ['Burning Sun', 'Diplomacy'], ["Death's Head", 'Survival'],
  ['Defiled Corpse', 'Religion'], ['Empty Hand', 'Intimidation'],
])('returns a trained skill token when Hold Mark %s duplicates %s', (choice, skill) => {
  const klass = entry('class', 'Ranger', { skill_proficiency: `Trained in ${skill}, Trained in a number of additional skills equal to 4 plus your Intelligence modifier` })
  const hold = { name: 'Hold Mark', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice }
  const c: Character = { ...base, className: 'Ranger', ancestry: 'Orc', level: 1, feats: [hold] }
  const without = { ...c, feats: [] }
  expect(additionalSkillCount(c, [klass])).toBe(additionalSkillCount(without, [klass]) + 1)
  expect(skillRankBudget(c, [klass]).trained).toBe(skillRankBudget(without, [klass]).trained + 1)
  expect(additionalSkillCount({ ...c, level: 0 }, [klass])).toBe(additionalSkillCount({ ...without, level: 0 }, [klass]))
  expect(additionalSkillCount(c, [])).toBe(additionalSkillCount(without, []))
  const flexibleClass = entry('class', 'Ranger', { skill_proficiency: 'Trained in a number of additional skills equal to 4 plus your Intelligence modifier' })
  const trained = { ...c, skillPicks: [skill] }
  expect(skillRankBudget(trained, [flexibleClass]).trained).toBe(skillRankBudget({ ...trained, feats: [] }, [flexibleClass]).trained + 1)
})

it('keeps active feat lookups current across level and selection changes', () => {
  const first = { name: 'Shared Feat', type: 'Class Feat', level: 2, slot: 'class:2:0' }
  const future = { name: 'Shared Feat', type: 'Class Feat', level: 6, slot: 'class:6:0' }
  const c: Character = { ...base, level: 4, feats: [first, future] }
  expect(activeFeatsNamed(c, first.name)).toEqual([first])
  expect(activeFeatsNamed({ ...c, level: 7 }, first.name)).toEqual([first, future])
  expect(activeFeatsNamed({ ...c, feats: [...c.feats, { ...first, slot: 'class:4:0' }] }, first.name))
    .toEqual([first, { ...first, slot: 'class:4:0' }])
})

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

it('applies Jotunborn skill grants, senses, resistance, size, and reach', () => {
  const ancestry = entry('ancestry', 'Jotunborn', { hp: 10, size: 'Large' })
  const eyes = entry('feat', "Jotun's Eyes")
  const heart = entry('feat', "Jotun's Heart")
  const stance = entry('feat', "Jotun's Battle Stance", {}, 1, ['Stance'])
  const grappler = entry('feat', 'Jotunborn Grappler')
  const planar = entry('feat', 'Planar Resilience')
  const sword = entry('weapon', 'Greatsword', {
    weapon_category: 'Martial', weapon_type: 'Melee', weapon_group: 'Sword', damage: '1d12 slashing', hands: 2,
  })
  const entries = [ancestry, eyes, heart, stance, grappler, planar, sword, entry('class', 'Fighter', { hp: 10 })]
  const c: Character = { ...base, ancestry: 'Jotunborn', className: 'Fighter', level: 5,
    activeStance: "Jotun's Battle Stance",
    feats: [
      { name: "Jotun's Eyes", type: 'Ancestry Feat', level: 1 },
      { name: "Jotun's Heart", type: 'Ancestry Feat', level: 5 },
      { name: "Jotun's Battle Stance", type: 'Ancestry Feat', level: 1 },
      { name: 'Jotunborn Grappler', type: 'Ancestry Feat', level: 1 },
      { name: 'Planar Resilience', type: 'Ancestry Feat', level: 1, choice: 'Cold' },
    ] }

  expect(senses(c, entries)).toContainEqual({ value: 'Darkvision', source: "Jotun's Eyes" })
  expect(resistances(c, entries)).toContainEqual({ damage: 'Cold', value: 2, source: 'Planar Resilience' })
  expect(featChoiceOptions('Planar Resilience', c, entries, 'ancestry:1:0')).toEqual(['Cold', 'Fire'])
  expect(bulkLimits(c, entries).size).toBe('Huge')
  expect(maxHp(c, entries)).toBe(65)
  expect(weaponAttack(c, entries, { id: 'sword', name: 'Greatsword', potency: 0, striking: 0, runes: [] }).reach).toBe(15)

  const athlete: Character = { ...base, level: 1,
    feats: [{ name: 'Jotunborn Grappler', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
  expect(ranksAt(athlete, [grappler]).Athletics).toBe(1)
  expect(automaticFeatGrants(athlete, [grappler])).toContainEqual({
    name: 'Titan Wrestler', source: 'Jotunborn Grappler', level: 1,
  })
  const alreadyTrained: Character = { ...athlete, skillPicks: ['Athletics'] }
  const replacement = normalizeConditionalSkillChoices({ ...alreadyTrained,
    feats: [{ ...alreadyTrained.feats[0], choice: 'Arcana' }] }, [grappler])
  expect(replacement.feats[0].choice).toBeUndefined()
  expect(replacement.skillPicks).toContain('Arcana')
  expect(ranksAt(replacement, [grappler]).Arcana).toBe(1)
  expect(ranksAt({ ...athlete, feats: [{ name: "Caretaker's Intuition", type: 'Ancestry Feat', level: 1 }] },
    [entry('feat', "Caretaker's Intuition")]).Nature).toBe(1)
})

it('applies Guardian Dedication armor and skill training, Guardian Resiliency, and Mighty Bulwark', () => {
  const dedication = entry('feat', 'Guardian Dedication', { archetype: 'Guardian' }, 2, ['Archetype', 'Dedication'])
  const shieldWarfare = entry('feat', 'Shield Warfare', { archetype: 'Guardian' }, 4, ['Archetype'])
  const resiliency = entry('feat', 'Guardian Resiliency', { archetype: 'Guardian' }, 4, ['Archetype'])
  const mighty = entry('feat', 'Mighty Bulwark', { archetype: 'Guardian' }, 8, ['Archetype'])
  const elf = entry('ancestry', 'Elf', { hp: 6 })
  const fighter = entry('class', 'Fighter', { hp: 10 })
  const c: Character = { ...base, level: 4, className: 'Fighter',
    feats: [
      { name: 'Guardian Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' },
      { name: 'Shield Warfare', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' },
      { name: 'Guardian Resiliency', type: 'Archetype Feat', level: 4, slot: 'archetype:4:1' },
    ] }
  expect(armorRanks(c, [dedication, fighter])).toMatchObject({ Light: 1, Medium: 1, Heavy: 0 })
  expect(maxHp(c, [dedication, shieldWarfare, resiliency, elf, fighter])).toBe(55)
  expect(hitPointBonuses(c, [dedication, shieldWarfare, resiliency])).toContainEqual({
    source: 'Guardian Resiliency', value: 9,
  })
  const mightyCharacter = { ...c, feats: [...c.feats, { name: 'Mighty Bulwark', type: 'Archetype Feat', level: 4 }] }
  expect(savingThrowBreakdown(mightyCharacter, [dedication, shieldWarfare, resiliency, mighty, fighter], 'Reflex').notes?.join(' '))
    .toContain('Mighty Bulwark: +4 on damaging Reflex saves')
  expect(ranksAt(c, [dedication]).Athletics).toBe(1)
})

it('increases shield weapon damage die with Shield Warfare', () => {
  const warfare = entry('feat', 'Shield Warfare', { archetype: 'Guardian' }, 4, ['Archetype'])
  const shield = entry('weapon', 'Shield Bash', {
    weapon_category: 'Martial', weapon_type: 'Melee', weapon_group: 'Shield', damage: '1d4 bludgeoning', hands: 1,
  })
  const c: Character = { ...base, level: 4, feats: [{ name: 'Shield Warfare', type: 'Archetype Feat', level: 4 }] }
  expect(weaponAttack(c, [warfare, shield], { id: 'bash', name: 'Shield Bash', potency: 0, striking: 0, runes: [] }).damage)
    .toMatch(/^1d6\b/)
})

it.each([false, true])('refunds ordinary increases without calculating unused conversion budgets (empty purchases: %s)', emptyPurchases => {
  const previous = getSettings()
  const unrelated = entry('feat', 'Unrelated Training')
  const data = [...entries, unrelated]
  const c: Character = { ...base, level: 7, skillPicks: ['Occultism'], skillIncreases: { 3: 'Occultism' },
    skillTokenUpgrades: emptyPurchases ? [] : undefined, feats: [
      { name: 'Blackwatch Initiate', type: 'Class Feat', level: 4, slot: 'class:4:0' },
      { name: unrelated.name, type: 'General Feat', level: 1, slot: 'general:3:0' },
    ] }
  const source = vi.spyOn(featChoices, 'selectedFeatEntry')
  try {
    updateSettings({ planSkillPrerequisites: true, autoClassSkills: false, autoLores: false })
    const normalized = normalizeGrantedSkillSpending(c, data)
    expect(normalized.skillIncreases).toEqual({})
    expect(ranksAt(normalized, data).Occultism).toBe(2)
    expect(c.skillIncreases).toEqual({ 3: 'Occultism' })
    expect(source.mock.calls.filter(([, , name]) => name === unrelated.name)).toHaveLength(0)
  } finally {
    source.mockRestore()
    updateSettings(previous)
  }
})

it('applies persistent Lizardfolk and Necromancer feat benefits to defenses, senses, and Speed', () => {
  const c: Character = { ...base, level: 12, ancestry: 'Lizardfolk', feats: [
    { name: 'Reinforced Skeleton', type: 'Class Feat', level: 12, choice: 'Fire, Piercing' },
    { name: 'Sanguine Mastery', type: 'Class Feat', level: 12 },
    { name: 'Become as Spirit', type: 'Class Feat', level: 12 },
    { name: 'Necromantic Lifesense', type: 'Class Feat', level: 10 },
    { name: 'Parthenogenic Hatchling', type: 'Ancestry Feat', level: 1 },
  ] }
  expect(speed(c, [])).toBe(30)
  expect(senses(c, []).some(sense => sense.value === 'Lifesense (imprecise) 30 feet')).toBe(true)
  expect(resistances(c, [])).toEqual(expect.arrayContaining([
    { damage: 'Fire', value: 6, source: 'Reinforced Skeleton' },
    { damage: 'Piercing', value: 6, source: 'Reinforced Skeleton' },
    { damage: 'Bleed', value: 6, source: 'Sanguine Mastery' },
    { damage: 'All damage except force, ghost touch, spirit, and vitality (for 1 round after destroying a thrall)', value: 6, source: 'Become as Spirit' },
  ]))
  expect(savingThrowBreakdown(c, [], 'Fortitude').notes).toContain(
    'Parthenogenic Hatchling +1 circumstance against diseases; a success becomes a critical success. If another ability would improve the save this way, a critical failure becomes a failure instead.')
})

it('scales Stormbreaker electricity shielding with character level', () => {
  const armor = { ...entry('armor', 'Stormbreaker Armor', {
    url: 'stormbreaker', armor_grade: 'Advanced', upgrade_slots: 1,
  }, 10), systems: ['sf2e' as const] }
  const upgrade = (name: string, level: number) => ({
    ...entry('item', name, { item_subcategory: 'Armor Upgrades' }, level),
    systems: ['sf2e' as const],
  })
  const entries = [
    armor, upgrade('Energy Shielding (Commercial)', 8), upgrade('Energy Shielding (Tactical)', 12),
    upgrade('Energy Shielding (Advanced)', 18),
  ]
  const c: Character = { ...base, systems: ['sf2e'], level: 10, armors: [
    { id: armor.id, name: armor.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const shielding = (level: number, grade: string) => resistances({ ...c, level }, entries)
    .find(resistance => resistance.source === `Energy Shielding (${grade}) (Electricity)`)
  expect(shielding(10, 'Commercial')).toEqual({
    damage: 'Electricity', value: 5, source: 'Energy Shielding (Commercial) (Electricity)',
  })
  expect(shielding(12, 'Tactical')).toEqual({
    damage: 'Electricity', value: 10, source: 'Energy Shielding (Tactical) (Electricity)',
  })
  expect(shielding(20, 'Advanced')).toEqual({
    damage: 'Electricity', value: 15, source: 'Energy Shielding (Advanced) (Electricity)',
  })
})

it.each(['acid', 'cold', 'electricity', 'fire'] as const)('applies Energy Shielding resistance to %s', type => {
  const armor = { ...entry('armor', 'Suit', { upgrade_slots: 1 }, 1), systems: ['sf2e' as const] }
  const shielding = { ...entry('item', 'Energy Shielding (Advanced)', { item_subcategory: 'Armor Upgrades' }, 18),
    systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], armors: [{
    id: armor.id, name: armor.name, potency: 0, resilient: 0, runes: [ ],
    upgrades: [shielding.id], energyShieldingTypes: { [shielding.id]: type }, worn: true,
  }] }
  const displayType = `${type[0].toUpperCase()}${type.slice(1)}`
  expect(resistances(c, [armor, shielding])).toContainEqual({
    damage: displayType, value: 15, source: `Energy Shielding (Advanced) (${displayType})`,
  })
})

it('grants apparition sight from Apparition Sense only when the feat is active', () => {
  const c: Character = { ...base, feats: [{ name: 'Apparition Sense', type: 'Class Feat', level: 1 }] }
  expect(senses(c, [])).toContainEqual({
    value: 'Apparition sight (imprecise) 30 feet', source: 'Apparition Sense',
  })
  expect(senses({ ...c, feats: [] }, [])).not.toContainEqual({
    value: 'Apparition sight (imprecise) 30 feet', source: 'Apparition Sense',
  })
})

it.each([
  ['Nature', 'Astrology Lore'], ['Nature', 'Lizardfolk Lore'],
  ['Occultism', 'Astrology Lore'], ['Occultism', 'Lizardfolk Lore'],
])('grants Lizardfolk Lore variant %s and %s', (skill, lore) => {
  const c: Character = { ...base, className: undefined, background: undefined, ancestry: 'Lizardfolk',
    feats: [{ name: 'Lizardfolk Lore', type: 'Ancestry Feat', level: 1, choice: `${skill}, ${lore}` }] }
  expect(featChoiceOptions('Lizardfolk Lore', c, [], 'ancestry:1:0')).toHaveLength(4)
  expect(ranksAt(c, [])).toMatchObject({ Survival: 1, [skill]: 1, [lore]: 1 })
  expect(ranksAt({ ...c, level: 3 }, [])[lore]).toBe(2)
  expect(ranksAt({ ...c, level: 7 }, [])[lore]).toBe(3)
  expect(featLores(c, [])).toContain(lore)
})

it.each(['Diplomacy', 'Intimidation'])('grants Nephilim Lore %s and chosen planar Lore', skill => {
  const feat = { name: 'Nephilim Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: skill }
  const c: Character = { ...base, className: undefined, background: undefined, feats: [feat],
    automaticFeatChoices: { [JSON.stringify(['Nephilim Lore', 'Additional Lore'])]: 'Heaven' } }
  expect(featChoiceOptions(feat.name, c, [], feat.slot)).toEqual(['Diplomacy', 'Intimidation'])
  expect(ranksAt(c, [])).toMatchObject({ Religion: 1, [skill]: 1, 'Heaven Lore': 1 })
  expect(ranksAt({ ...c, level: 7 }, [])['Heaven Lore']).toBe(3)
  expect(automaticFeatGrants(c, [])).toContainEqual({ name: 'Additional Lore', source: feat.name, level: 1 })
  const klass = entry('class', 'Theologian', { skill_proficiency: `Trained in Religion, Trained in ${skill}` })
  const trained = { ...c, className: 'Theologian' }
  expect(additionalSkillCount(trained, [klass]) - additionalSkillCount({ ...trained, feats: [] }, [klass])).toBe(2)
  expect(featLores({ ...c, feats: [] }, [])).not.toContain('Heaven Lore')
})

it.each([
  ['Musetouched', 'Elysium'],
  ['Pitborn', 'Outer Rifts'],
])('locks %s Nephilim Lore to %s Lore', (lineage, plane) => {
  const source = entry('feat', lineage, {}, 1, ['Nephilim', 'Lineage'])
  const c: Character = { ...base, heritage: 'Nephilim', className: undefined, background: undefined,
    feats: [{ name: lineage, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
      { name: 'Nephilim Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:1', choice: 'Diplomacy' }],
    automaticFeatChoices: { [JSON.stringify(['Nephilim Lore', 'Additional Lore'])]: 'Heaven' } }
  expect(featLores(c, [source])).toContain(`${plane} Lore`)
  expect(ranksAt(c, [source])[`${plane} Lore`]).toBe(1)
  expect(ranksAt({ ...c, level: 7 }, [source])[`${plane} Lore`]).toBe(3)
})

it('grants Core Attunement two chosen arcane innate spells once per day', () => {
  const spell = (name: string, level: number, tradition = 'arcane') => ({ ...entry('spell', name, { tradition }, level), traits: [] })
  const spells = [spell('Fear', 1), spell('Mirror Image', 2), spell('Fireball', 3), spell('Heal', 1, 'divine')]
  const feat = { name: 'Core Attunement', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0', choice: 'Fear|Mirror Image' }
  const c: Character = { ...base, level: 9, feats: [feat] }
  expect(coreAttunementOptions(c, spells, 0).map(item => item.name)).toEqual(['Fear'])
  expect(coreAttunementOptions(c, spells, 1).map(item => item.name)).toEqual(['Fear', 'Mirror Image'])
  expect(grantedFeatSpells(c, spells).filter(grant => grant.source === 'Core Attunement').map(grant => grant.entry.name))
    .toEqual(['Fear', 'Mirror Image'])
})

it('grants Backup Runic Enhancement spells in the selected tradition', () => {
  const spell = (name: string, level: number) => ({ ...entry('spell', name, { tradition: 'arcane' }, level), traits: [] })
  const spells = [spell('Sigil', 1), spell('Runic Body', 1)]
  const feat = { name: 'Backup Runic Enhancement', type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'Primal: Runic Body' }
  const c: Character = { ...base, systems: ['pf2e'], level: 5, feats: [feat] }
  expect(grantedFeatSpells(c, spells).filter(grant => grant.source === feat.name)
    .map(grant => [grant.entry.name, grant.rule.tradition, grant.rule.frequency]))
    .toEqual([['Sigil', 'primal', 'at will'], ['Runic Body', 'primal', 'once per day']])
})

it('offers Runic Tattoo the Runesmith runes available at the character level', () => {
  const feat = { name: 'Runic Tattoo', type: 'Class Feat', level: 2, slot: 'class:2:0' }
  const c: Character = { ...base, systems: ['pf2e'], level: 2, feats: [feat] }
  const options = featChoiceOptions(feat.name, c, [], feat.slot)
  expect(options).toContain('Atryl, Rune of Fire')
  expect(featChoiceOptions(feat.name, { ...c, systems: ['sf2e'] }, [], feat.slot)).toBeUndefined()
})

it('applies constant enlarge from Enlarged Chassis', () => {
  const c: Character = { ...base, systems: ['pf2e'], level: 13, feats: [{ name: 'Enlarged Chassis', type: 'Ancestry Feat', level: 13, slot: 'ancestry:13:0' }] }
  expect(enlargedChassisSize(c, [])).toBe('Large')
  expect(giantWeaponClumsy(c, [])).toBe(1)
  expect(giantClumsySource(c, [])).toBe('Enlarged Chassis')
})

it('offers Arcane Locomotion climb and swim variants granting a 20 foot Speed', () => {
  const feat = { name: 'Arcane Locomotion', type: 'Ancestry Feat', level: 13, slot: 'ancestry:13:0', choice: 'Swim' }
  const c: Character = { ...base, systems: ['pf2e'], level: 13, feats: [feat] }
  expect(featChoiceOptions(feat.name, c, [], feat.slot)).toEqual(['Climb', 'Swim'])
  expect(movementSpeeds(c, []).find(speed => speed.name === 'Swim')?.feet).toBe(20)
  expect(movementSpeeds(c, []).some(speed => speed.name === 'Climb')).toBe(false)
})

it.each([
  ['Quick Climb', 'Climb'],
  ['Quick Swim', 'Swim'],
] as const)('grants land-speed %s movement with Legendary Athletics', (feat, mode) => {
  const c: Character = { ...base, level: 20, rankOverrides: { Athletics: 4 },
    feats: [{ name: feat, type: 'Skill Feat', level: 7 }] }
  expect(movementSpeeds(c, [])).toContainEqual({ name: mode, feet: speed(c, []), source: feat })
  expect(movementSpeeds({ ...c, rankOverrides: { Athletics: 3 } }, []).some(move => move.name === mode && move.source === feat))
    .toBe(false)
  expect(movementSpeeds({ ...c, feats: [] }, []).some(move => move.name === mode && move.source === feat)).toBe(false)
})

it('offers Magical Resistance energy variants and grants the selected resistance 5', () => {
  const feat = { name: 'Magical Resistance', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: 'Sonic' }
  const c: Character = { ...base, level: 5, feats: [feat] }
  expect(featChoiceOptions(feat.name, c, [], feat.slot)).toEqual(['Cold', 'Electricity', 'Sonic'])
  expect(resistances(c, []).filter(item => item.source === feat.name)).toEqual([{ damage: 'Sonic', value: 5, source: feat.name }])
})

it('offers Hardened Chassis damage variants and grants the selected resistance 3', () => {
  const feat = { name: 'Hardened Chassis', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: 'Slashing' }
  const c: Character = { ...base, level: 5, feats: [feat] }
  expect(featChoiceOptions(feat.name, c, [], feat.slot)).toEqual(['Bludgeoning', 'Piercing', 'Slashing'])
  expect(resistances(c, []).filter(item => item.source === feat.name))
    .toEqual([{ damage: 'Slashing (except adamantine)', value: 3, source: feat.name }])
})

it('offers all five Nephilim Resistance variants and grants only the selected resistance', () => {
  const choiceFeat = { name: 'Nephilim Resistance', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' }
  const c: Character = { ...base, level: 5, feats: [
    { name: 'Pitborn', type: 'Ancestry Feat', level: 1 }, choiceFeat,
  ] }
  const options = ['Acid', 'Cold', 'Electricity', 'Fire', 'Sonic']
  expect(featChoiceOptions(choiceFeat.name, c, [], choiceFeat.slot)).toEqual(options)
  const imported = entry('feat', choiceFeat.name, { resistances: 'fire=5' }, 5)
  for (const choice of options) {
    const selected = { ...c, feats: [c.feats[0], { ...choiceFeat, choice }] }
    expect(resistances(selected, [imported]).filter(item => item.source === choiceFeat.name))
      .toEqual([{ damage: choice, value: 5, source: choiceFeat.name }])
    expect(resistances({ ...selected, level: 20 }, [imported])).toContainEqual({ damage: choice, value: 5, source: choiceFeat.name })
    expect(resistances({ ...selected, level: 4 }, [imported]).some(item => item.source === choiceFeat.name)).toBe(false)
  }
  expect(resistances(c, [imported]).some(item => item.source === choiceFeat.name)).toBe(false)
  expect(resistances({ ...c, feats: [{ ...choiceFeat, choice: 'Poison' }] }, [imported])
    .some(item => item.source === choiceFeat.name)).toBe(false)
  expect(resistances({ ...c, systems: ['sf2e'], feats: [{ ...choiceFeat, choice: 'Fire' }] }, [imported])
    .some(item => item.source === choiceFeat.name)).toBe(false)
})

it('adds trained slots for repeated Lizardfolk Lore skills and preserves legacy selections', () => {
  const klass = entry('class', 'Ranger', { skill_proficiency: 'Trained in Nature, Trained in Survival' })
  const feat = { name: 'Lizardfolk Lore', type: 'Ancestry Feat', level: 1, choice: 'Nature, Astrology Lore' }
  const c: Character = { ...base, ancestry: 'Lizardfolk', className: 'Ranger', background: undefined, feats: [feat] }
  expect(additionalSkillCount(c, [klass]) - additionalSkillCount({ ...c, feats: [] }, [klass])).toBe(2)
  expect(skillRankBudget(c, [klass]).trained - skillRankBudget({ ...c, feats: [] }, [klass]).trained).toBe(2)
  const occultism = { ...c, feats: [{ ...feat, choice: 'Occultism, Astrology Lore' }] }
  expect(additionalSkillCount(occultism, [klass]) - additionalSkillCount({ ...occultism, feats: [] }, [klass])).toBe(1)
  const legacy = { ...c, feats: [{ ...feat, choice: 'Nature', replacements: ['Astrology Lore', 'Athletics', 'Society'] }] }
  const normalized = normalizeConditionalSkillChoices(legacy, [klass])
  expect(normalized.skillPicks).toEqual(expect.arrayContaining(['Athletics', 'Society']))
  expect(featLores(normalized, [klass])).toContain('Astrology Lore')
  expect(ranksAt(normalized, [klass])).toMatchObject({ Survival: 1, Nature: 1, 'Astrology Lore': 1, Athletics: 1, Society: 1 })
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

it('adds Nimble Feet Speed without stacking other ancestry feat speed increases', () => {
  const nimble = { name: 'Nimble Hooves', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' }
  const c: Character = { ...base, level: 5, feats: [nimble] }
  expect(speed(c, [])).toBe(30)
  expect(speed({ ...c, level: 4 }, [])).toBe(25)
  expect(speed({ ...c, feats: [...c.feats, { name: 'Fleet', type: 'General Feat', level: 1 }] }, [])).toBe(35)
  expect(speed({ ...c, feats: [...c.feats, { name: 'Nimble Elf', type: 'Ancestry Feat', level: 1 }] }, [])).toBe(30)
  expect(speed({ ...c, feats: [...c.feats, { name: 'Primal Nimbleness', type: 'Class Feat', level: 1 }] }, [])).toBe(35)
})

it('offers Energized Spark variants and prevents repeated damage types', () => {
  const spark = entry('feat', 'Energized Spark', {}, 1, ['Exemplar'])
  const first = { name: spark.name, type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'Air (Slashing)' }
  const c: Character = { ...base, className: 'Exemplar', level: 2, feats: [first] }
  const options = featChoiceOptions(spark.name, c, [spark], 'class:2:0')!
  expect(options).toContain('Earth (Bludgeoning)')
  expect(options).toContain('Fire')
  expect(options).not.toContain('Air (Slashing)')
  expect(options).not.toContain('Metal (Slashing)')
  expect(featChoiceOptions(spark.name, c, [spark], first.slot)).toContain('Air (Slashing)')
  expect(eligibleFeats([spark], c, { key: 'class:2:0', category: 'class', level: 2 })).toContain(spark)
})

it('offers Sublime Mobility variants and grants the selected speed', () => {
  const feat = { name: 'Sublime Mobility', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' }
  const c: Character = { ...base, level: 5, feats: [feat] }
  expect(featChoiceOptions(feat.name, c, [], feat.slot)).toEqual(['Climb', 'Swim'])
  for (const choice of ['Climb', 'Swim']) {
    const selected = { ...c, feats: [{ ...feat, choice }] }
    expect(movementSpeeds(selected, [])).toContainEqual({ name: choice, feet: 10, source: feat.name })
    expect(movementSpeeds({ ...selected, level: 4 }, [])).toHaveLength(1)
  }
  expect(movementSpeeds(c, [])).toHaveLength(1)
})

it('gives Halfling Climbing Specialist a 15-foot climb Speed', () => {
  const feat = mapAonHit({ _id: 'cs', _source: { category: 'feat', name: 'Climbing Specialist', level: 5, trait: ['Halfling'],
    markdown: 'x\n---\nYou can climb.<br/><br/>**[Option(s)](/feats/1059-climbing-specialist)**: 15 feet' } }, 'sf2e')!
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Halfling', level: 5,
    feats: [{ name: 'Climbing Specialist', type: 'Ancestry Feat', level: 5 }] }
  expect(movementSpeeds(c, [feat])).toContainEqual(expect.objectContaining({ name: 'Climb', feet: 15 }))
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
  it('grants Gunslinger way skills and scales them only with the class skills house rule', () => {
    const previous = getSettings()
    try {
      const ways = [
        ['Way of the Vanguard', 'Athletics'], ['Way of the Drifter', 'Acrobatics'],
        ['Way of the Sniper', 'Stealth'],
        ['Way of the Spellshot', 'Arcana'], ['Way of the Triggerbrand', 'Thievery'],
      ] as const
      const entries = ways.map(([name, skill]) => entry('subclass', name, { class: 'Gunslinger', skill }))
      const gunslinger = { ...base, background: undefined, className: 'Gunslinger' }
      updateSettings({ autoClassSkills: false })
      for (const [subclass, skill] of ways) {
        const c = { ...gunslinger, level: 15, subclass }
        expect(subclassSkillGrants(c, entries)).toEqual([skill])
        expect(ranksAt(c, entries)[skill]).toBe(1)
      }
      const pistolero = entry('subclass', 'Way of the Pistolero', { class: 'Gunslinger', skill: 'Deception, Intimidation' })
      const pistoleroEntries = [...entries, pistolero]
      const pistoleroCharacter = { ...gunslinger, level: 15, subclass: pistolero.name }
      expect(subclassSkillChoice(pistoleroCharacter, pistoleroEntries)?.options).toEqual(['Deception', 'Intimidation'])
      expect(subclassSkillGrants(pistoleroCharacter, pistoleroEntries)).toEqual([])
      const chosen = { ...pistoleroCharacter, subclassSkillChoices: { 'Gunslinger:Way of the Pistolero': 'Intimidation' } }
      expect(ranksAt(chosen, pistoleroEntries).Intimidation).toBe(1)
      expect(ranksAt(chosen, pistoleroEntries).Deception ?? 0).toBe(0)
      updateSettings({ autoClassSkills: true })
      expect(ranksAt(chosen, pistoleroEntries).Intimidation).toBe(4)
      for (const [level, rank] of [[1, 1], [3, 2], [7, 3], [15, 4]] as const) {
        expect(ranksAt({ ...gunslinger, level, subclass: 'Way of the Vanguard' }, entries).Athletics).toBe(rank)
      }
      expect(subclassSkillGrants({ ...gunslinger, subclass: undefined }, entries)).toEqual([])
    } finally { updateSettings(previous) }
  })

  it('grants distinct additional Gunslinger ways and their selected skills', () => {
    const ways = [
      entry('subclass', 'Way of the Sniper', { class: 'Gunslinger', skill: 'Stealth' }),
      entry('subclass', 'Way of the Vanguard', { class: 'Gunslinger', skill: 'Athletics' }),
      entry('subclass', 'Way of the Pistolero', { class: 'Gunslinger', skill: 'Deception, Intimidation' }),
    ]
    const versatile = { name: 'Versatile Gunslinger', type: 'Class Feat', level: 14, slot: 'class:14:0',
      takenLevel: 14, choice: 'Way of the Vanguard' }
    const gunslinger = { ...base, className: 'Gunslinger', subclass: 'Way of the Sniper', level: 16, feats: [versatile] }
    expect(selectedSubclass({ ...gunslinger, subclass: undefined }, ways)).toBeUndefined()
    expect(subclassSkillGrants(gunslinger, ways)).toEqual(['Stealth', 'Athletics'])
    expect(featChoiceOptions('Versatile Gunslinger', gunslinger, ways, 'class:16:0', -1))
      .toEqual(['Way of the Pistolero'])

    const pistolero = { ...versatile, slot: 'class:16:0', choice: 'Way of the Pistolero' }
    const selected = { ...gunslinger, feats: [versatile, pistolero],
      subclassSkillChoices: { 'Gunslinger:Way of the Pistolero': 'Intimidation' } }
    expect(subclassSkillGrants(selected, ways)).toEqual(['Stealth', 'Athletics', 'Intimidation'])
    expect(featChoiceOptions('Versatile Gunslinger', selected, ways, 'class:18:0', -1)).toEqual([])
  })

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

  it('applies Envoy leadership skills, perks, initiative, and From the Front armor progression', () => {
    const envoy = entry('class', 'Envoy', {
      defense_proficiency: 'Trained in light armor, trained in unarmored defense',
    })
    const lightExpertise = { ...entry('classFeature', 'Light Armor Expertise', { class: 'Envoy' }, 13),
      description: 'Your proficiency rank for light armor and unarmored defense increases to expert.' }
    const lightMastery = { ...entry('classFeature', 'Light Armor Mastery', { class: 'Envoy' }, 19),
      description: 'Your proficiency rank for light armor and unarmored defense increases to master.' }
    const styles = STARFINDER_SUBCLASSES.filter(style => style.data.class === 'Envoy')
    const versatileFeat = homebrewCharacterOptions([]).find(entry => entry.name === 'Versatile Envoy')!
    const entries = [envoy, ...styles, lightExpertise, lightMastery, versatileFeat]
    const versatile: Character['feats'][number] = {
      name: 'Versatile Envoy', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'From the Shadows',
    }
    const c: Character = { ...base, systems: ['sf2e'], className: 'Envoy', subclass: 'From the Front',
      level: 20, feats: [versatile] }

    expect(featChoiceOptions('Versatile Envoy', c, entries, versatile.slot!, 0)).toContain('Guns Blazing')
    expect(featChoiceOptions('Versatile Envoy', c, entries, versatile.slot!, 0)).not.toContain('From the Front')
    const secondPick: Character['feats'][number] = {
      ...versatile, level: 12, slot: 'class:12:0', choice: 'Guns Blazing',
    }
    const repeated = { ...c, feats: [versatile, secondPick] }
    const remainingStyles = featChoiceOptions('Versatile Envoy', repeated, entries, 'class:14:0')!
    expect(remainingStyles).not.toContain('From the Front')
    expect(remainingStyles).not.toContain('From the Shadows')
    expect(remainingStyles).not.toContain('Guns Blazing')
    expect(eligibleFeats(entries, c, { key: 'class:12:0', category: 'class', level: 12 })).toContain(versatileFeat)
    const alreadyChosen = new Set([versatile.choice])
    const allStylesSelected = { ...c, feats: [versatile, ...styles.filter(style =>
      style.name !== 'From the Front' && !alreadyChosen.has(style.name)).map((style, index) => ({
      ...versatile, level: 12 + index * 2, slot: `class:${12 + index * 2}:0`, choice: style.name,
    }))] }
    expect(eligibleFeats(entries, allStylesSelected, { key: 'class:20:0', category: 'class', level: 20 }))
      .not.toContain(versatileFeat)
    expect(subclassSkillGrants(c, entries)).toEqual(['Athletics', 'Stealth'])
    expect(automaticFeatGrants(c, entries)).toContainEqual({
      name: 'Assurance', choice: 'Stealth', source: 'From the Shadows Leadership Perk', level: 10,
    })
    expect(armorRanks({ ...c, level: 1 }, entries).Medium).toBe(1)
    expect(armorRanks({ ...c, level: 13 }, entries).Medium).toBe(2)
    expect(armorRanks({ ...c, level: 19 }, entries).Medium).toBe(3)

    const settings = getSettings()
    try {
      updateSettings({ autoClassSkills: false })
      expect(ranksAt(c, entries).Athletics).toBe(1)
      expect(ranksAt(c, entries).Stealth).toBe(1)
      updateSettings({ autoClassSkills: true })
      expect(ranksAt(c, entries).Athletics).toBe(4)
      expect(ranksAt(c, entries).Stealth).toBe(4)
    } finally { updateSettings(settings) }

    const perks = [
      ['From the Shadows', 'Assurance', 'Stealth'],
      ['Guns Blazing', 'Incredible Initiative', undefined],
      ['In the Spotlight', 'Impressive Performance', undefined],
      ['Infosphere Director', 'Digital Diversion', undefined],
      ['Through Desperate Times', 'Battle Medicine', undefined],
    ] as const
    for (const [style, name, choice] of perks) {
      const character = { ...c, subclass: 'From the Front',
        feats: [{ ...versatile, choice: style }] }
      expect(automaticFeatGrants(character, entries)).toContainEqual({
        name, ...(choice ? { choice } : {}), source: `${style} Leadership Perk`, level: 10,
      })
    }
    const gunsBlazing = { ...c, subclass: 'Guns Blazing', feats: [] }
    const front = { ...gunsBlazing, subclass: 'From the Front' }
    expect(initiativeBonus(gunsBlazing, entries) - initiativeBonus(front, entries)).toBe(2)
  })

  it('lets Versatile Investigator add methodology benefits and only grants an extra skill feat slot when needed', () => {
    const methods = ['Forensic Medicine', 'Empiricism', 'Esoterica']
      .map(name => entry('subclass', name, { class: 'Investigator' }))
    const c: Character = { ...base, level: 10, className: 'Investigator', subclass: 'Forensic Medicine',
      feats: [{ name: 'Versatile Investigator', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Empiricism' }],
      subclassSkillChoices: { 'Investigator:Empiricism': 'Arcana' } }
    expect(featChoiceOptions('Versatile Investigator', c, methods, 'class:10:0', 0)).toEqual(['Empiricism', 'Esoterica'])
    expect(subclassSkillGrants(c, methods)).toEqual(['Medicine', 'Arcana'])
    expect(ranksAt(c, methods)).toMatchObject({ Medicine: 1, Arcana: 1 })
    expect(automaticFeatGrants(c, methods)).toContainEqual({
      name: "That's Odd", source: 'Versatile Investigator (Empiricism)', level: 10,
    })

    expect(automaticFeatGrants({ ...c, subclass: 'Empiricism', feats: [] }, methods)).toContainEqual({
      name: "That's Odd", source: 'Empiricism Methodology', level: 1,
    })
    expect(automaticFeatGrants({ ...c, feats: [] }, methods)).not.toContainEqual(
      expect.objectContaining({ name: "That's Odd" }),
    )
    expect(plannedSlots(c, methods)).toContainEqual(expect.objectContaining({
      key: 'skill:1:versatile-investigator:class:10:0', category: 'skill', level: 10, grantedBy: 'Versatile Investigator',
    }))
    const esoterica: Character = { ...c,
      feats: [{ ...c.feats[0], choice: 'Esoterica' }],
      subclassSkillChoices: { 'Investigator:Esoterica': 'Religion' } }
    expect(automaticFeatGrants(esoterica, methods).filter(grant => grant.name === 'Quick Identification')).toEqual([
      { name: 'Quick Identification', source: 'Versatile Investigator (Esoterica)', level: 10 },
    ])
    expect(plannedSlots(esoterica, methods).filter(slot => slot.key.startsWith('skill:1:versatile-investigator:'))).toEqual([])
  })

  it('adds Rogue skill feats every level and constrains Investigator Skillful Lessons to eligible trained skills', () => {
    const rogue = { ...base, className: 'Rogue', level: 4 }
    expect(plannedSlots(rogue).filter(slot => slot.category === 'skill').map(slot => slot.level)).toEqual([1, 1, 2, 3, 4])
    const investigator: Character = { ...base, className: 'Investigator', subclass: 'Esoterica', level: 5,
      skillPicks: ['Arcana', 'Athletics', 'Medicine'], subclassSkillChoices: { 'Investigator:Esoterica': 'Religion' } }
    const lesson = plannedSlots(investigator).find(slot => slot.grantedBy === "Investigator's Skillful Lessons")!
    const arcana = entry('feat', 'Arcana Lesson', { skill: 'Arcana' }, 1, ['Skill'])
    const athletics = entry('feat', 'Athletics Lesson', { skill: 'Athletics' }, 1, ['Skill'])
    const medicine = entry('feat', 'Medicine Lesson', { skill: 'Medicine' }, 1, ['Skill'])
    expect(investigatorSkillfulLessonSkills(investigator, [])).toEqual(['Religion', 'Arcana', 'Medicine'])
    expect(eligibleFeats([arcana, athletics, medicine], investigator, lesson)).toEqual([arcana, medicine])
  })

  it('does not offer Face in the Crowd before a planned Greywatch Initiate grants it', () => {
    const face = entry('feat', 'Face in the Crowd', {}, 1, ['General', 'Skill'])
    const character: Character = { ...base, className: 'Ranger', level: 2, skillPicks: ['Deception'],
      feats: [{ name: 'Greywatch Initiate', type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
    const slot = { key: 'skill:2:0', category: 'skill' as const, level: 2 }
    expect(eligibleFeats([face], { ...character, feats: [] }, slot)).toContain(face)
    expect(eligibleFeats([face], character, slot)).not.toContain(face)
  })

  it.each([
    ['Alchemical Sciences', ['Alchemical Crafting']],
    ['Empiricism', ["That's Odd"]],
    ['Esoterica', ['Quick Identification']],
    ['Forensic Medicine', ['Forensic Acumen', 'Battle Medicine']],
    ['Interrogation', ['No Cause for Alarm']],
  ])('automatically grants %s methodology feats', (methodology, feats) => {
    const methods = [entry('subclass', methodology, { class: 'Investigator' })]
    const c: Character = { ...base, className: 'Investigator', subclass: methodology }
    expect(automaticFeatGrants(c, methods)).toEqual(expect.arrayContaining(
      feats.map(name => expect.objectContaining({ name, source: `${methodology} Methodology`, level: 1 })),
    ))
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

it('prevents duplicate Domain Initiate domain choices', () => {
  const deity = entry('deity', 'Pharasma', { domain_primary: 'Death, Repose, Truth' })
  const c: Character = { ...base, level: 10, deity: 'Pharasma', feats: [
    { name: 'Domain Initiate', type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Death' },
    { name: 'Domain Initiate', type: 'Class Feat', level: 8, slot: 'class:8:0', choice: 'Repose' },
  ] }
  const options = featChoiceOptions('Domain Initiate', c, [deity], 'class:4:0')
  expect(options).not.toContain('Death')
  expect(options).toContain('Repose')
  expect(featChoiceOptions('Domain Initiate', c, [deity], 'class:2:0')).toContain('Death')
})

describe('official passive feat mechanics', () => {
  it('grants Dwarven Lore and Clan Lore skills and lore, adding a trained token for already-trained skills', () => {
    const dwarvenLore = { name: 'Dwarven Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    const clanLore = { name: 'Clan Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'Breakiron' }
    const dwarf = { ...base, ancestry: 'Dwarf', background: undefined }
    const dwarven = { ...dwarf, feats: [dwarvenLore] }
    expect(ranksAt(dwarven, entries)).toMatchObject({ Crafting: 1, Religion: 1, 'Dwarven Lore': 1 })
    expect(featLores(dwarven, entries)).toContain('Dwarven Lore')

    const clan = { ...dwarf, skillPicks: ['Crafting'], feats: [clanLore] }
    expect(featChoiceOptions('Clan Lore', clan, entries, clanLore.slot, 0)).toContain('Breakiron')
    expect(featLores(clan, entries)).toContain('Alchemy Lore')
    expect(ranksAt(clan, entries)).toMatchObject({ Crafting: 1, Survival: 1 })
  })

  it('grants Stonemason’s Eye and Eye for Treasure mechanics only when their prerequisites apply', () => {
    const stone = { name: "Stonemason's Eye", type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    const treasure = { name: 'Eye for Treasure', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    const untrained = { ...base, background: undefined }
    const stonemason = { ...untrained, feats: [stone] }
    expect(ranksAt(stonemason, entries).Crafting).toBe(1)
    expect(automaticFeatGrants(stonemason, entries)).not.toContainEqual(expect.objectContaining({ name: 'Specialty Crafting' }))
    expect(perceptionCircumstance({ ...stonemason, activeFeatEffects: ["Stonemason's Eye"] }))
      .toBeUndefined()
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

    const face = { name: 'Expressive Face', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    expect(ranksAt({ ...untrained, feats: [face] }, entries).Diplomacy).toBe(1)
    expect(automaticFeatGrants({ ...untrained, feats: [face] }, entries)).toContainEqual({
      name: 'Glad-Hand', source: 'Expressive Face', level: 1,
    })
    const trainedFace = { ...untrained, skillPicks: ['Diplomacy'], feats: [{ ...face, choice: 'Society' }] }
    expect(featChoiceOptions('Expressive Face', trainedFace, entries, face.slot, 0)).toContain('Society')
    expect(ranksAt(trainedFace, entries).Society).toBe(1)
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

  it('adds Skilled Human trained and expert tokens and migrates legacy skill choices', () => {
    const c: Character = { ...base, className: undefined, ancestry: 'Human', heritage: 'Skilled Human',
      skillPicks: [] }
    const withoutGrant = { ...c, heritage: undefined }
    expect(skillRankBudget(c, entries).trained - skillRankBudget(withoutGrant, entries).trained).toBe(1)
    expect(skillRankBudget({ ...c, level: 5 }, entries).expert
      - skillRankBudget({ ...withoutGrant, level: 5 }, entries).expert).toBe(1)

    const legacy = { ...c, skilledHumanSkill: 'Stealth' }
    const migrated = normalizeConditionalSkillChoices(legacy, entries)
    expect(migrated.skillPicks).toContain('Stealth')
    expect(migrated.skilledHumanSkill).toBeUndefined()
    expect(ranksAt(legacy, entries).Stealth).toBe(1)
    expect(ranksAt(migrated, entries).Stealth).toBe(1)

    const hunter = entry('background', 'Hunter', { skill: 'Stealth' })
    const overlapping = { ...legacy, background: 'Hunter' }
    const data = [...entries, hunter]
    expect(additionalSkillCount(overlapping, data) -
      additionalSkillCount({ ...overlapping, heritage: undefined, skilledHumanSkill: undefined }, data)).toBe(1)
    expect(ranksAt(overlapping, data).Stealth).toBe(1)
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

  it('applies the selected terrain for a heritage-granted Terrain Expertise feat', () => {
    const heritage = mapAonHit({ _id: 'heritage-deep-orc', _source: {
      category: 'heritage', name: 'Deep Orc', trait: ['Orc'],
      markdown: 'You gain the [Terrain Expertise](/Feats.aspx?ID=5223) skill feat.',
    } }, 'pf2e')!
    const c: Character = { ...base, ancestry: 'Orc', heritage: heritage.name,
      automaticFeatChoices: { [JSON.stringify([heritage.name, 'Terrain Expertise'])]: 'Underground' } }

    expect(automaticFeatGrants(c, [heritage])).toContainEqual({
      name: 'Terrain Expertise', source: heritage.name, level: 1,
    })
    expect(terrainExpertiseBenefits(c, [heritage])).toEqual({ terrains: ['Underground'], bonus: 0 })
  })

  it('applies the chosen Lore and level scaling for heritage-granted Additional Lore', () => {
    const heritage = mapAonHit({ _id: 'heritage-sage-jotunborn', _source: {
      category: 'heritage', name: 'Sage Jotunborn', trait: ['Jotunborn'],
      markdown: 'You gain the [Additional Lore](/Feats.aspx?ID=5114) general feat for a lore skill of your choice.',
    } }, 'pf2e')!
    const c: Character = { ...base, level: 7, ancestry: 'Jotunborn', heritage: heritage.name,
      automaticFeatChoices: { [JSON.stringify([heritage.name, 'Additional Lore'])]: 'Sailing' } }

    expect(automaticFeatGrants(c, [heritage])).toContainEqual({
      name: 'Additional Lore', source: heritage.name, level: 1,
    })
    expect(featLores(c, [heritage])).toContain('Sailing Lore')
    expect(ranksAt(c, [heritage])['Sailing Lore']).toBe(3)
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

  it('applies Mystic Armor to AC and saves only while active', () => {
    const c: Character = { ...base, level: 12, spells: [{ name: 'Mystic Armor', rank: 6, cantrip: false }], activeSpells: ['Mystic Armor'] }
    const on = armorClass(c, []), off = armorClass({ ...c, activeSpells: [] }, [])
    expect(on - off).toBe(2)
    expect(savingThrowBreakdown(c, [], 'Will').parts.find(part => part.label === 'Mystic Armor (item)')?.value).toBe(1)
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

  it('Eclectic Skill gives untrained skills full level proficiency with trained actions', () => {
    const c = { ...base, level: 8, feats: [{ name: 'Eclectic Skill', type: 'Class Feat', level: 8, slot: 'class:8:0' }] }
    expect(untrainedSkillProficiency(c)).toEqual({ bonus: 8, source: 'Eclectic Skill', trainedActions: true })
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

  it('doubles ranged weapon range increments with Far Shot', () => {
    const bow = entry('weapon', 'Longbow', { weapon_category: 'Martial', weapon_type: 'Ranged', damage: '1d8 piercing', range: 100 })
    const c = { ...base, level: 4, feats: [{ name: 'Far Shot', type: 'Class Feat', level: 4 }] }
    expect(attack(c, 'Longbow', [wizard, bow]).range).toBe(200)
    expect(attack({ ...c, feats: [] }, 'Longbow', [wizard, bow]).range).toBe(100)
  })

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

  it('applies armor training from a heritage-granted Armor Proficiency feat', () => {
    const heritage = mapAonHit({ _id: 'heritage-cataphract-fleshwarp', _source: {
      category: 'heritage', name: 'Cataphract Fleshwarp', trait: ['Fleshwarp'],
      markdown: 'You gain the [Armor Proficiency](/Feats.aspx?ID=788) general feat.',
    } }, 'pf2e')!
    const c: Character = { ...base, ancestry: 'Fleshwarp', heritage: heritage.name }

    expect(automaticFeatGrants(c, [wizard, heritage])).toContainEqual({
      name: 'Armor Proficiency', source: heritage.name, level: 1,
    })
    expect(armorRanks(c, [wizard, heritage])).toMatchObject({ Light: 1, Medium: 0, Heavy: 0 })
    expect(armorRanks({ ...c, level: 13 }, [wizard, heritage])).toMatchObject({ Light: 2, Medium: 0, Heavy: 0 })
  })

  it('applies Toughness HP from a heritage-granted general feat', () => {
    const automaton = entry('ancestry', 'Automaton', { hp: 8 })
    const heritage = mapAonHit({ _id: 'heritage-defensive-automaton', _source: {
      category: 'heritage', name: 'Defensive Automaton', trait: ['Automaton'],
      markdown: 'You gain the [Toughness](/Feats.aspx?ID=855) general feat.',
    } }, 'pf2e')!
    const c: Character = { ...base, level: 5, ancestry: 'Automaton', heritage: heritage.name }

    const withoutGrant = { ...heritage, data: { ...heritage.data, grants_heritage_feats: '' } }
    expect(maxHp(c, [automaton, heritage]) - maxHp(c, [automaton, withoutGrant])).toBe(5)
    expect(hitPointBonuses(c, [automaton, heritage])).toContainEqual({
      source: 'Toughness (Defensive Automaton)', value: 5,
    })
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

  it('offers Advanced Weapon Training weapon groups and trains that group\'s advanced weapons as martial', () => {
    const grouped = (name: string, group: string) => ({ ...weapon(name, 'Advanced'), data: { ...weapon(name, 'Advanced').data, weapon_group: group } })
    const data = [wizard, ranger, grouped('Falcata', 'Sword'), grouped('Dueling Sword', 'Sword'), grouped('Orc Knuckle Dagger', 'Knife'), weapon('Longsword', 'Martial')]
    const fighter = { ...base, className: 'Ranger', level: 6, feats: [selected('Advanced Weapon Training', 6, 'Sword')] }
    expect(featChoiceOptions('Advanced Weapon Training', { ...fighter, feats: [] }, data, 'class:6:0')).toEqual(['Knife', 'Sword'])
    expect(featChoiceOptions('Advanced Weapon Training', fighter, data, 'class:8:0')).toEqual(['Knife'])
    expect(attack(fighter, 'Falcata', data).rank).toBe(attack(fighter, 'Longsword', data).rank)
    expect(attack(fighter, 'Orc Knuckle Dagger', data).rank).toBe(0)
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

  it.each([
    ['Engineering Lore, Explosive Lore', ['Engineering Lore', 'Explosive Lore']],
    ['Engineering Lore, Firearm Lore', ['Engineering Lore', 'Firearm Lore']],
    ['Explosive Lore, Firearm Lore', ['Explosive Lore', 'Firearm Lore']],
  ])('grants and advances Dongun Education variant %s without spending skill increases', (choice, lores) => {
    updateSettings({ autoLores: false })
    const c = { ...base, background: undefined, feats: [selected('Dongun Education', 1, choice)] }
    expect(featChoiceOptions('Dongun Education', c, entries, 'ancestry:1:0')).toContain(choice)
    for (const [level, rank] of [[1, 1], [2, 2], [6, 2], [7, 3], [14, 3], [15, 4], [20, 4]]) {
      const character = { ...c, level }
      expect(featLores(character, entries)).toEqual(lores)
      for (const lore of lores) expect(ranksAt(character, entries)[lore]).toBe(rank)
      expect(skillRankBudget(character, entries)).toEqual(skillRankBudget({ ...character, feats: [] }, entries))
    }
    expect(ranksAt({ ...c, level: 20 }, entries, 2)[lores[0]]).toBe(1)
    expect(ranksAt({ ...c, level: 20 }, entries, 3)[lores[0]]).toBe(2)
    expect(featLores({ ...c, feats: [selected('Dongun Education', 5, choice)], level: 4 }, entries)).toEqual([])
    expect(ranksAt({ ...c, feats: [selected('Dongun Education', 5, choice)], level: 5 }, entries)[lores[0]]).toBe(2)
    expect(ranksAt({ ...c, feats: [] }, entries)[lores[0]]).toBeUndefined()
    expect(featLores({ ...c, feats: [selected('Dongun Education', 1, 'Engineering Lore')] }, entries)).toEqual([])
  })

  it('scales Additional Lore granted by another feat without scaling ordinary background Lore', () => {
    updateSettings({ autoLores: false })
    const dedication = entry('feat', 'Wild Hunter Dedication', { grants_lore: 'Hunting Lore' }, 2)
    const c = { ...base, level: 15, feats: [selected(dedication.name, 2)] }
    expect(ranksAt(c, [...entries, dedication])).toMatchObject({ 'Hunting Lore': 4, 'Academia Lore': 1 })
  })

  it('upgrades Society and grants Field Agent lore choices only when Starfinder Lore was already trained', () => {
    const dedication = selected('Starfinder Field Agent Dedication', 2)
    const choiceKey = automaticFeatChoiceKey(dedication.name, 'Lore Skill')
    const c: Character = { ...base, systems: ['sf2e'], level: 8,
      skillPicks: ['Society'], lores: [{ name: 'Starfinder Lore', rank: 1 }], feats: [dedication] }
    expect(ranksAt({ ...c, feats: [] }, []).Society).toBe(1)
    expect(ranksAt(c, []).Society).toBe(2)
    expect(automaticFeatGrants(c, [])).toContainEqual({
      name: 'Additional Lore', choice: 'Starfinder', source: dedication.name, level: 2,
    })
    expect(featLores(c, [])).toContain('Starfinder Lore')
    const withChoice = { ...c, automaticFeatChoices: { [choiceKey]: 'Underworld' } }
    expect(trainedFeatLores(withChoice, [])).toContainEqual({
      name: 'Underworld Lore', source: dedication.name,
    })
    expect(featLores(withChoice, [])).toContain('Underworld Lore')
    expect(ranksAt(withChoice, [])['Underworld Lore']).toBe(3)
    expect(trainedFeatLores({ ...withChoice, lores: [] }, [])).toEqual([])
    expect(ranksAt({ ...c, className: undefined, skillPicks: [], lores: [] }, []).Society ?? 0).toBe(0)
  })

it('grants Starfinder Field Agent Dedication at level 2 to all supported classes by house rule', () => {
  const previous = getSettings()
  try {
    updateSettings({ envoyFieldAgent: true, mysticFieldAgent: true, mechanicFieldAgent: true,
      operativeFieldAgent: true, solarianFieldAgent: true, soldierFieldAgent: true,
      technomancerFieldAgent: true, witchwarperFieldAgent: true })
    for (const [className, setting] of [
      ['Envoy', 'envoyFieldAgent'], ['Mystic', 'mysticFieldAgent'], ['Mechanic', 'mechanicFieldAgent'],
      ['Operative', 'operativeFieldAgent'], ['Solarian', 'solarianFieldAgent'], ['Soldier', 'soldierFieldAgent'],
      ['Technomancer', 'technomancerFieldAgent'], ['Witchwarper', 'witchwarperFieldAgent'],
    ] as const) {
      const c: Character = { ...base, systems: ['sf2e'], className, level: 2 }
      expect(activeFeatsNamed(c, 'Starfinder Field Agent Dedication')).toMatchObject([{ level: 2 }])
      expect(automaticFeatGrants(c, [])).toContainEqual({
        name: 'Starfinder Field Agent Dedication', source: className, level: 2,
      })
      const trained: Character = { ...c, skillPicks: ['Society'], lores: [{ name: 'Starfinder Lore', rank: 1 }] }
      expect(ranksAt(trained, []).Society).toBe(2)
      expect(automaticFeatGrants(trained, [])).toContainEqual({
        name: 'Additional Lore', choice: 'Starfinder', source: 'Starfinder Field Agent Dedication', level: 2,
      })
      updateSettings({ [setting]: false })
      expect(activeFeatsNamed(c, 'Starfinder Field Agent Dedication')).toEqual([])
    }
  } finally {
    updateSettings(previous)
  }
})

it('keeps Mission Lore trained until Society becomes legendary', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 20,
    skillPicks: ['Society'], rankOverrides: { Society: 1, 'Mission Lore': 4 },
    feats: [{ name: 'Mission Briefing', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' }] }
  expect(featLores(c, [])).toContain('Mission Lore')
  expect(ranksAt(c, [])).toMatchObject({ Society: 1, 'Mission Lore': 1 })
  expect(ranksAt({ ...c, rankOverrides: { Society: 4, 'Mission Lore': 1 } }, []))
    .toMatchObject({ Society: 4, 'Mission Lore': 2 })
  expect(ranksAt({ ...c, feats: [] }, [])['Mission Lore']).toBeUndefined()
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
    const otherTraditionsExpert = { ...c, rankOverrides: { Crafting: 3, Arcana: 1, Nature: 2, Occultism: 2, Religion: 2 } }
    expect(featChoiceOptions('Technomagical Scrapper', otherTraditionsExpert, [], 'ancestry:5:0'))
      .toEqual(['Arcana to Expert'])
    const arcanaTrainedByPick = { ...base, level: 5, skillPicks: ['Arcana'],
      feats: [selected('Technomagical Scrapper', 5, undefined, 'ancestry:5:0')],
      rankOverrides: { Crafting: 3, Nature: 2, Occultism: 2, Religion: 2 } }
    expect(featChoiceOptions('Technomagical Scrapper', arcanaTrainedByPick, [], 'ancestry:5:0'))
      .toEqual(['Arcana to Expert'])
  })

  it('uses Skilled Human training when choosing Technomagical Scrapper variants', () => {
    const c: Character = { ...base, level: 5, ancestry: 'Human', heritage: 'Skilled Human',
      skilledHumanSkill: 'Arcana', skillPicks: [],
      feats: [selected('Technomagical Scrapper', 5, undefined, 'ancestry:5:0')],
      rankOverrides: { Nature: 2, Occultism: 2, Religion: 2 } }
    expect(ranksAt(c, []).Arcana).toBe(1)
    expect(featChoiceOptions('Technomagical Scrapper', c, [], 'ancestry:5:0')).toEqual(['Arcana to Expert'])
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

  it('allows Adopted Ancestry regardless of rarity while enforcing specific Access requirements', () => {
    const previous = getSettings().disableAdoptedAncestry
    onTestFinished(() => updateSettings({ disableAdoptedAncestry: previous }))
    updateSettings({ disableAdoptedAncestry: false })
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
    expect(featChoiceOptions('Adopted Ancestry', c, data, 'general:3:0')).toEqual(['Automaton', 'Dwarf', 'Ratfolk'])
    expect(featChoiceOptions('Adopted Ancestry', { ...c, featAccessOverrides: [rare.id] }, data, 'general:3:0'))
      .toEqual(['Automaton', 'Dwarf', 'Ratfolk'])
    expect(featChoiceOptions('Adopted Ancestry', { ...c, achievements: ['Member of the Knights of Lastwall'] }, data, 'general:3:0'))
      .toEqual(['Accessed Ancestry', 'Automaton', 'Dwarf', 'Ratfolk'])
    expect(c.feats[0].choice).toBe(rare.name)
  })

  it('unlocks only the adopted ancestry alongside the original ancestry without losing saved choices on deleveling', () => {
    const previous = getSettings().disableAdoptedAncestry
    onTestFinished(() => updateSettings({ disableAdoptedAncestry: previous }))
    updateSettings({ disableAdoptedAncestry: false })
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

  it('offers both Human and Elf ancestry feats to Aiuvarin', () => {
    const data = [
      entry('ancestry', 'Human'), entry('ancestry', 'Elf'),
      entry('feat', 'Human Feat', {}, 1, ['Human']),
      entry('feat', 'Elf Feat', {}, 1, ['Elf']),
      entry('feat', 'Dwarf Feat', {}, 1, ['Dwarf']),
    ]
    const c = { ...base, ancestry: 'Human', heritage: 'Aiuvarin', level: 1 }
    expect(eligibleFeats(data, c, { key: 'ancestry:1:0', category: 'ancestry', level: 1 }).map(feat => feat.name).sort())
      .toEqual(['Elf Feat', 'Human Feat'])
  })

  it('grants Social Chameleon only Adopted Ancestry and a common level-1 feat from that ancestry', () => {
    const previous = getSettings().disableAdoptedAncestry
    onTestFinished(() => updateSettings({ disableAdoptedAncestry: previous }))
    updateSettings({ disableAdoptedAncestry: false })
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

  it('grants In Another Life a changeable ancestry feat at the current level', () => {
    const feat = { name: 'In Another Life', type: 'Class Feat', level: 12, slot: 'class:12:0' }
    const c: Character = { ...base, systems: ['pf2e', 'sf2e'], className: 'Witchwarper', ancestry: 'Human', level: 15,
      feats: [feat, { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Elf' },
        { name: 'Human Repeatable', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
    const data = [
      entry('feat', 'Human Choice', {}, 13, ['Human']),
      entry('feat', 'Human Too High', {}, 17, ['Human']),
      entry('feat', 'Human Repeatable', { repeatable: true }, 1, ['Human']),
      entry('feat', 'Elf Choice', {}, 1, ['Elf']),
      entry('feat', 'Human Prerequisite', { prerequisite: 'master in Acrobatics' }, 1, ['Human']),
    ]
    const slot = plannedSlots(c).find(s => s.grantedBy === 'In Another Life')!
    expect(slot).toMatchObject({ category: 'ancestry', level: 15 })
    expect(eligibleFeats(data, c, slot).map(e => e.name)).toEqual(['Human Choice'])
    expect(plannedSlots({ ...c, level: 11 }).some(s => s.grantedBy === 'In Another Life')).toBe(false)
    expect(plannedSlots({ ...c, feats: c.feats.slice(1) }).some(s => s.grantedBy === 'In Another Life')).toBe(false)
    expect(plannedSlots({ ...c, systems: ['pf2e'] }).some(s => s.grantedBy === 'In Another Life')).toBe(false)
    expect(plannedSlots({ ...c, level: 16 }).find(s => s.grantedBy === 'In Another Life')?.key).toBe(slot.key)
  })

  it('toggles both grouped ancestry restrictions independently without changing saved feats', () => {
    const previous = getSettings()
    onTestFinished(() => updateSettings(previous))
    const names = ['Adopted Ancestry', 'Cultural Adaptability', 'Multitalented', 'Orc Kinship', 'Social Chameleon']
    const data = names.map(name => entry('feat', name, {}, 1, ['General']))
    const c: Character = { ...base, level: 9, feats: [
      { name: 'Shield Block', type: 'General Feat', level: 1 },
    ] }
    const saved = JSON.stringify(c)
    const options = () => eligibleFeats(data, c, { key: 'general:9:0', category: 'general', level: 9 })
      .map(feat => feat.name)
    updateSettings({ disableAdoptedAncestry: true, disableAncientElfMultitalented: true })
    expect(options()).toEqual([])
    updateSettings({ disableAdoptedAncestry: false })
    expect(options()).toEqual(['Adopted Ancestry', 'Cultural Adaptability', 'Orc Kinship', 'Social Chameleon'])
    updateSettings({ disableAdoptedAncestry: true, disableAncientElfMultitalented: false })
    expect(options()).toEqual(['Multitalented'])
    updateSettings({ disableAdoptedAncestry: false })
    expect(options()).toEqual(names)
    expect(JSON.stringify(c)).toBe(saved)
  })

  it.each(['Elf Atavism', 'Elven Atavism'])('%s hides only Ancient Elf when its grouped restriction is enabled', name => {
    const previous = getSettings().disableAncientElfMultitalented
    onTestFinished(() => updateSettings({ disableAncientElfMultitalented: previous }))
    const elf = entry('ancestry', 'Elf')
    const ancient = entry('heritage', 'Ancient Elf', {}, 0, ['Elf'])
    const woodland = entry('heritage', 'Woodland Elf', {}, 0, ['Elf'])
    const data = [elf, ancient, woodland]
    const c: Character = { ...base, ancestry: 'Elf', level: 5, heritage: 'Ancient Elf',
      feats: [{ name, type: 'Ancestry Feat', level: 5, choice: 'Ancient Elf' }] }
    const saved = JSON.stringify(c)
    updateSettings({ disableAncientElfMultitalented: true })
    expect(featChoiceOptions(name, c, data, 'ancestry:5:0')).toEqual(['Woodland Elf'])
    updateSettings({ disableAncientElfMultitalented: false })
    expect(featChoiceOptions(name, c, data, 'ancestry:5:0')).toEqual(['Ancient Elf', 'Woodland Elf'])
    expect(JSON.stringify(c)).toBe(saved)
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
    expect(ancestryLabel('Human', 'Nephilim', 'Pitborn')).toBe('Pitborn Human')
    expect(ancestryLabel('Human', 'Nephilim', 'Musetouched')).toBe('Musetouched Human')
  })

  it('uses selected Nephilim lineage in the character label', () => {
    const pitborn: ContentEntry = { ...entry('feat', 'Pitborn'), traits: ['Nephilim', 'Lineage'] }
    const c: Character = { ...base, ancestry: 'Human', heritage: 'Nephilim',
      feats: [{ name: 'Pitborn', type: 'Ancestry Feat', level: 1, sourceId: pitborn.id }] }
    expect(characterAncestryLabel(c, [pitborn])).toBe('Pitborn Human')
    expect(characterSummary(c, [pitborn])).toContain('Pitborn Human')
  })

  it('uses the Nephilim lineage in the label even when feat content is not loaded', () => {
    const c: Character = { ...base, ancestry: 'Human', heritage: 'Nephilim',
      feats: [{ name: 'Musetouched', type: 'Ancestry Feat', level: 1, sourceId: 'missing' }] }
    expect(characterAncestryLabel(c, [])).toBe('Musetouched Human')
  })

  it('uses selected Fadrim lineage in the character label', () => {
    const c: Character = { ...base, ancestry: 'Elf', heritage: 'Fadrim',
      feats: [{ name: 'Trickster Fadrim', type: 'Ancestry Feat', level: 1 }] }
    expect(characterAncestryLabel(c, [])).toBe('Trickster Fadrim Elf')
    expect(ancestryLabel('Fadrim', 'Fadrim', 'Trickster Fadrim')).toBe('Trickster Fadrim')
    expect(characterAncestryLabel({ ...c, level: 0 }, [])).toBe('Fadrim Elf')
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
      ['Oracle', 'Tempest', 'Oracle of the Tempest'],
      ['Investigator', 'Empiricism', 'Investigator of the Empiricism Methodology'],
      ['Sorcerer', 'Imperial', 'Sorcerer of the Imperial Bloodline'],
    ])('labels %s with selected %s specialization', (className, subclass, expected) => {
      expect(classLabel({ ...base, className, subclass, ...(className === 'Druid' ? { order: subclass } : {}) })).toBe(expected)
      expect(classLabel({ ...base, className })).toBe(className)
    })

    it('does not repeat class names in selected subclasses', () => {
      expect(classLabel({ ...base, className: 'Cleric', subclass: 'Cloistered Cleric' })).toBe('Cloistered Cleric')
    })

    it('recognizes Warrior of Legend as a Fighter class archetype and reserves its dedication', () => {
      const character = { ...base, level: 2, className: 'Fighter', subclass: 'Warrior of Legend', feats: [] }
      expect(classLabel(character)).toBe('Warrior of Legend')
      expect(plannedSlots(character).find(slot => slot.grantedBy === 'Warrior of Legend'))
        .toMatchObject({ displayCategory: 'archetype', grantedFeat: 'Warrior of Legend Dedication' })
      expect(plannedSlots(character).filter(slot => slot.key.startsWith('class:2:')).map(slot => slot.grantedFeat))
        .toEqual(['Warrior of Legend Dedication', undefined])
      expect(syncClassArchetypeDedication(character, [])?.feats).toContainEqual({
        name: 'Warrior of Legend Dedication', type: 'Class Feat', level: 2, slot: 'class:2:0',
      })
    })

    it('offers imported Warrior of Legend feats despite source capitalization', () => {
      const dedication = { ...entry('feat', 'Warrior Of Legend Dedication', { archetype: 'Warrior Of Legend', prerequisite: 'Warrior of legend' }, 2, ['Archetype', 'Dedication']), id: 'aon:pf2e:feat-7261' }
      const heroic = entry('feat', 'Heroic Defiance', { archetype: 'Warrior Of Legend', prerequisite: 'Warrior Of Legend Dedication' }, 4, ['Archetype'])
      const sweep = entry('feat', 'Unbalancing Sweep', { archetype: 'Mauler, Warrior Of Legend',
        archetype_levels: 'Mauler:14, Warrior Of Legend:14' }, 12, ['Barbarian', 'Flourish'])
      const entries = [dedication, heroic, sweep]
      const initial: Character = { ...base, level: 20, className: 'Fighter', subclass: 'Warrior of Legend', feats: [] }
      const c = { ...initial, ...syncClassArchetypeDedication(initial, entries) }
      const classSlot = (level: number) => ({ key: `class:${level}:0`, category: 'class' as const, level })
      const archetypeSlot = (level: number) => ({ key: `archetype:${level}:0`, category: 'archetype' as const, level })
      expect(featChoices.selectedFeatEntry(c, entries, 'Warrior of Legend Dedication', dedication.id)).toBe(dedication)
      expect(eligibleFeats(entries, c, classSlot(4))).toContain(heroic)
      expect(eligibleFeats(entries, c, archetypeSlot(4))).toContain(heroic)
      expect(eligibleFeats(entries, c, classSlot(12))).not.toContain(sweep)
      expect(eligibleFeats(entries, c, classSlot(14))).toContain(sweep)
      expect(eligibleFeats(entries, { ...c, feats: [] }, classSlot(14))).not.toContain(heroic)
      const selected = { ...c, feats: [...c.feats, { name: heroic.name, type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
      expect(plannedSlots(selected, entries).find(slot => slot.key === 'class:4:0')).toMatchObject({ displayCategory: 'archetype' })
    })

    it('places Vindicator Dedication in the archetype section', () => {
      const ranger = { ...base, level: 2, className: 'Ranger', subclass: 'Vindication' }
      expect(plannedSlots(ranger).find(slot => slot.grantedBy === 'Vindicator'))
        .toMatchObject({ displayCategory: 'archetype', grantedFeat: 'Vindicator Dedication' })
    })

    it('shows selected Vindicator archetype feats in the archetype section without changing their class slot', () => {
      const domainInitiate = entry('feat', 'Domain Initiate', { archetype: 'Vindicator' }, 4, ['Archetype'])
      const ranger = { ...base, level: 4, className: 'Ranger', subclass: 'Vindication',
        feats: [{ name: domainInitiate.name, type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
      const slot = plannedSlots(ranger, [domainInitiate]).find(item => item.key === 'class:4:0')
      expect(slot).toMatchObject({ category: 'class', displayCategory: 'archetype' })
      expect(plannedSlots({ ...ranger, feats: [] }, [domainInitiate]).find(item => item.key === 'class:4:0'))
        .toMatchObject({ category: 'class' })
    })

    it.each(['Arcane', 'Divine'])('labels Bloodrager by its selected tradition: %s', tradition => {
      const c: Character = { ...base, level: 2, className: 'Barbarian', subclass: 'Bloodrager',
        feats: [{ name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, choice: tradition }] }
      expect(classLabel(c)).toBe(`${tradition} Bloodrager`)
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
  it('lets the Avenger racket choose Strength as a Rogue key attribute', () => {
    const rogue = entry('class', 'Rogue', { attribute: 'Dexterity' })
    const c: Character = { ...base, className: 'Rogue', subclass: 'Avenger', boosts: { class: 'str' } }
    const classBoost = boostSlots(c, [rogue]).find(slot => slot.key === 'class')!
    expect(classBoost.options).toEqual(['dex', 'str'])
    expect(computeAbilities(c, [rogue]).str).toBe(12)
    const versatileAvenger = { ...c, level: 10, subclass: 'Thief', feats: [
      { name: 'Versatile Rogue', type: 'Class Feat', level: 10, choice: 'Avenger' },
    ] }
    expect(boostSlots(versatileAvenger, [rogue]).find(slot => slot.key === 'class')?.options).toEqual(['dex', 'str'])
    expect(boostSlots({ ...c, subclass: 'Thief' }, [rogue]).find(slot => slot.key === 'class')?.options).toBeUndefined()
  })

  it('reaches 21 Intelligence with the Lizardfolk flaw or 22 with alternate ancestry boosts at level 20', () => {
    const lizard = entry('ancestry', 'Lizardfolk', { attribute: 'Strength, Wisdom, Free', attribute_flaw: 'Intelligence' })
    const necromancer = entry('class', 'Necromancer', { attribute: 'Intelligence' })
    const background = entry('background', 'Scholar', { attribute: 'Intelligence' })
    const c: Character = { ...base, level: 20, ancestry: 'Lizardfolk', className: 'Necromancer', background: 'Scholar',
      boosts: { 'ancestry:2': 'int', 'ancestryAlternate:0': 'int', 'background:0': 'int',
        'free1:0': 'int', 'lvl5:0': 'int', 'lvl10:0': 'int', 'lvl15:0': 'int', 'lvl20:0': 'int' } }
    expect(computeAbilities(c, [lizard, necromancer, background]).int).toBe(21)
    expect(computeAbilities({ ...c, alternateAncestryBoosts: true }, [lizard, necromancer, background]).int).toBe(22)
  })

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
    const keys = (level: number) => plannedSlots({ ...base, background: '', level }).map((s) => `${s.category}${s.level}`)
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

  it('adds a trained choice when a deity skill duplicates existing class or background training', () => {
    const champion = entry('class', 'Champion', {
      skill_proficiency: 'Trained in Religion, Trained in one skill determined by your choice of deity, Trained in a number of additional skills equal to 2 plus your Intelligence modifier',
    })
    const deity = entry('deity', 'Damoritosh', { skill: 'Intimidation' })
    const background = entry('background', 'Guard', { skill: 'Intimidation, Athletics' })
    const entries = [champion, deity, background]
    const c = { ...base, className: 'Champion', background: 'Guard', deity: 'Damoritosh', level: 1 }
    expect(autoClassSkills(c, entries)).toContain('Intimidation')
    expect(additionalSkillCount(c, entries)).toBe(additionalSkillCount({ ...c, deity: undefined }, entries) + 1)
    expect(skillRankBudget(c, entries).trained).toBe(skillRankBudget({ ...c, deity: undefined }, entries).trained + 1)
  })

  it('grants the SF2e deity skill to Soldiers and replaces duplicate training with another trained choice', () => {
    const previous = getSettings().sf2eDeitySkills
    const soldier = entry('class', 'Soldier', { skill_proficiency: 'Trained in a number of additional skills equal to 3 plus your Intelligence modifier' })
    const deity = { ...entry('deity', 'Damoritosh', { skill: 'Intimidation' }), systems: ['sf2e' as const] }
    const background = { ...entry('background', 'Guard', { skill: 'Intimidation, Athletics' }), systems: ['sf2e' as const] }
    const entries = [soldier, deity, background]
    const c = { ...base, systems: ['sf2e' as const], className: 'Soldier', background: 'Guard', deity: 'Damoritosh', level: 1 }
    try {
      updateSettings({ sf2eDeitySkills: true })
      expect(autoClassSkills(c, entries)).toContain('Intimidation')
      expect(additionalSkillCount(c, entries)).toBe(additionalSkillCount({ ...c, deity: undefined }, entries) + 1)
      expect(skillRankBudget(c, entries).trained).toBe(skillRankBudget({ ...c, deity: undefined }, entries).trained + 1)
      updateSettings({ sf2eDeitySkills: false })
      expect(autoClassSkills(c, entries)).not.toContain('Intimidation')
    } finally { updateSettings({ sf2eDeitySkills: previous }) }
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
    expect(maxHp({ ...c, feats: [{ name: 'Thick Skin', type: 'Class Feat', level: 1 }, { name: 'Toughness', type: 'General Feat', level: 1 }] }, data)).toBe(66)
    const goblin = [...data, entry('ancestry', 'Goblin', { hp: 6 })]
    const plain = maxHp({ ...c, ancestry: 'Goblin' }, goblin)
    expect(maxHp({ ...c, ancestry: 'Goblin', heritage: 'Unbreakable Goblin' }, goblin)).toBe(plain + 4)
    expect(maxHp({ ...c, ancestry: 'Goblin', heritage: 'Unbreakable Goblin', feats: [{ name: 'Unbreakable-er Goblin', type: 'Ancestry Feat', level: 1 }] }, goblin)).toBe(plain + 14)
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

  it('keeps Wizard Spellcasting feats granted by Spellshot Dedication', () => {
    const spellshot = entry('feat', 'Spellshot Dedication', { archetype: 'Spellshot' }, 2, ['Archetype', 'Dedication'])
    const expert = entry('feat', 'Expert Wizard Spellcasting', { archetype: 'Wizard' }, 12, ['Archetype'])
    const master = entry('feat', 'Master Wizard Spellcasting', { archetype: 'Wizard' }, 18, ['Archetype'])
    const c: Character = { ...base, className: 'Gunslinger', level: 18, feats: [
      { name: spellshot.name, type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' },
      { name: expert.name, type: 'Archetype Feat', level: 12, slot: 'archetype:12:0' },
      { name: master.name, type: 'Archetype Feat', level: 18, slot: 'archetype:18:0' },
    ] }
    expect(orphanedArchetypeFeats(c, [spellshot, expert, master])).toEqual([])
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
    expect(plannedSlots(ranger).filter((s) => s.category === 'archetype').map((s) => s.key)).toEqual(['archetype:2:0', 'archetype:2:g99', 'archetype:2:g96', 'archetype:2:g95'])
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

  it('adds the selected Technomancer language hacks as their feats are taken', () => {
    const entries = TECHNOMANCER_PROGRAMMING_LANGUAGES.flatMap(language => {
      const rules = TECHNOMANCER_LANGUAGE_RULES[language]
      return [rules.initialHack, rules.advancedHack, rules.greaterHack].map(name => ({
        ...entry('spell', name, {}, 1, ['Focus', 'Technomancer']), systems: ['sf2e'] as ContentEntry['systems'],
      }))
    })
    for (const language of TECHNOMANCER_PROGRAMMING_LANGUAGES) {
      const rules = TECHNOMANCER_LANGUAGE_RULES[language]
      const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 10,
        technomancerProgrammingLanguage: language,
        feats: [
          { name: 'Advanced Magic Hack', type: 'Class Feat', level: 6 },
          { name: 'Greater Magic Hack', type: 'Class Feat', level: 10 },
        ] }
      expect(focusSpells(c, entries).spells.map(spell => spell.name)).toEqual(
        [rules.initialHack, rules.advancedHack, rules.greaterHack].sort((a, b) => a.localeCompare(b)))
    }
  })

  it('offers only unused Cross-platform languages and unadvanced language variants', () => {
    const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 16,
      technomancerProgrammingLanguage: 'DPS++', feats: [
        { name: 'Cross-platform Application', type: 'Class Feat', level: 8, choice: 'FORTRUN' },
        { name: 'Cross-platform Application', type: 'Class Feat', level: 10, choice: 'ServoShell' },
        { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 12, choice: 'FORTRUN' },
      ] }
    const featEntries = [
      entry('feat', 'Cross-platform Application', { class: 'Technomancer' }, 8, ['Technomancer']),
      entry('feat', 'Advanced Cross-platform Application', { class: 'Technomancer' }, 12, ['Technomancer']),
    ].map(feat => ({ ...feat, systems: ['sf2e'] as ContentEntry['systems'] }))
    const nextSlot = { key: 'class:14:0', category: 'class' as const, level: 14 }
    expect(featChoiceOptions('Cross-platform Application', c, [], 'class:14:0', -1)).toEqual(['Viper'])
    expect(featChoiceOptions('Cross-platform Application', {
      ...c, technomancerProgrammingLanguage: undefined, feats: [],
    }, [], 'class:8:0', -1)).toEqual([])
    expect(featChoiceOptions('Advanced Cross-platform Application', c, [], 'class:14:0', -1)).toEqual(['ServoShell'])
    expect(featChoiceOptions('Advanced Cross-platform Application', c, [], 'class:12:0', 2))
      .toEqual(['FORTRUN', 'ServoShell'])
    expect(featChoiceOptions('Advanced Cross-platform Application', {
      ...c, technomancerProgrammingLanguage: 'FORTRUN', feats: c.feats.slice(0, 2),
    }, [], 'class:12:0', -1)).toEqual(['ServoShell'])
    expect(eligibleFeats(featEntries, c, nextSlot).map(feat => feat.name))
      .toEqual(['Cross-platform Application', 'Advanced Cross-platform Application'])
    expect(eligibleFeats(featEntries, { ...c, feats: [...c.feats,
      { name: 'Cross-platform Application', type: 'Class Feat', level: 14, choice: 'Viper' }] }, nextSlot)
      .map(feat => feat.name)).not.toContain('Cross-platform Application')
    expect(eligibleFeats(featEntries, { ...c, feats: [...c.feats,
      { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 14, choice: 'ServoShell' },
      { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 16, choice: 'Viper' }] }, nextSlot)
      .map(feat => feat.name)).not.toContain('Advanced Cross-platform Application')
  })

  it('offers unused firmware languages as repeatable Versatile Firmware variants', () => {
    const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 20,
      technomancerProgrammingLanguage: 'DPS++', feats: [
        { name: 'Cross-platform Application', type: 'Class Feat', level: 8, choice: 'FORTRUN' },
        { name: 'Cross-platform Application', type: 'Class Feat', level: 10, choice: 'ServoShell' },
        { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 12, choice: 'FORTRUN' },
        { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 14, choice: 'ServoShell' },
        { name: 'Versatile Firmware', type: 'Class Feat', level: 16, choice: 'FORTRUN' },
      ] }
    const slot = { key: 'class:18:0', category: 'class' as const, level: 18 }
    expect(featChoiceOptions('Versatile Firmware', c, [VERSATILE_FIRMWARE_FEAT], slot.key, -1))
      .toEqual(['ServoShell'])
    expect(featChoiceOptions('Versatile Firmware', c, [VERSATILE_FIRMWARE_FEAT], 'class:16:0', 4))
      .toEqual(['FORTRUN', 'ServoShell'])
    expect(featChoiceOptions('Versatile Firmware', { ...c, feats: c.feats.filter(feat =>
      feat.name !== 'Advanced Cross-platform Application') }, [VERSATILE_FIRMWARE_FEAT], slot.key, -1))
      .toEqual([])
    expect(eligibleFeats([VERSATILE_FIRMWARE_FEAT], c, slot)).toContain(VERSATILE_FIRMWARE_FEAT)
    const allLanguages = { ...c, feats: [...c.feats,
      { name: 'Versatile Firmware', type: 'Class Feat', level: 18, choice: 'ServoShell' }] }
    expect(featChoiceOptions('Versatile Firmware', allLanguages, [VERSATILE_FIRMWARE_FEAT], 'class:20:0', -1))
      .toEqual([])
    expect(eligibleFeats([VERSATILE_FIRMWARE_FEAT], allLanguages, { key: 'class:20:0', category: 'class', level: 20 }))
      .not.toContain(VERSATILE_FIRMWARE_FEAT)
  })

  it('offers Greater Cross-platform Application only for firmware languages and only once per language', () => {
    const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 20,
      technomancerProgrammingLanguage: 'DPS++', feats: [
        { name: 'Cross-platform Application', type: 'Class Feat', level: 8, choice: 'FORTRUN' },
        { name: 'Cross-platform Application', type: 'Class Feat', level: 10, choice: 'ServoShell' },
        { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 12, choice: 'FORTRUN' },
        { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 14, choice: 'ServoShell' },
        { name: 'Versatile Firmware', type: 'Class Feat', level: 16, choice: 'FORTRUN' },
        { name: 'Versatile Firmware', type: 'Class Feat', level: 18, choice: 'ServoShell' },
      ] }
    const slot = { key: 'class:20:0', category: 'class' as const, level: 20 }
    expect(featChoiceOptions('Greater Cross-platform Application', c,
      [VERSATILE_FIRMWARE_FEAT, GREATER_CROSS_PLATFORM_APPLICATION_FEAT], slot.key, -1))
      .toEqual(['FORTRUN', 'ServoShell'])
    expect(eligibleFeats([GREATER_CROSS_PLATFORM_APPLICATION_FEAT], c, slot))
      .toContain(GREATER_CROSS_PLATFORM_APPLICATION_FEAT)
    const used = { ...c, feats: [...c.feats,
      { name: 'Greater Cross-platform Application', type: 'Class Feat', level: 20, choice: 'FORTRUN' }] }
    expect(featChoiceOptions('Greater Cross-platform Application', used,
      [VERSATILE_FIRMWARE_FEAT, GREATER_CROSS_PLATFORM_APPLICATION_FEAT], 'class:20:1', -1))
      .toEqual(['ServoShell'])
    expect(featChoiceOptions('Greater Cross-platform Application', {
      ...used, feats: [...used.feats, { name: 'Greater Cross-platform Application', type: 'Class Feat', level: 20, choice: 'ServoShell' }],
    }, [VERSATILE_FIRMWARE_FEAT, GREATER_CROSS_PLATFORM_APPLICATION_FEAT], 'class:20:2', -1)).toEqual([])
  })

  it('grants the initial and advanced hacks selected through Cross-platform Application feats', () => {
    const entries = TECHNOMANCER_PROGRAMMING_LANGUAGES.flatMap(language => {
      const rules = TECHNOMANCER_LANGUAGE_RULES[language]
      return [rules.initialHack, rules.advancedHack].map(name => ({
        ...entry('spell', name, {}, 1, ['Focus', 'Technomancer']), systems: ['sf2e'] as ContentEntry['systems'],
      }))
    })
    const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 12,
      technomancerProgrammingLanguage: 'DPS++',
      feats: [
        { name: 'Advanced Magic Hack', type: 'Class Feat', level: 6 },
        { name: 'Cross-platform Application', type: 'Class Feat', level: 8, choice: 'FORTRUN' },
        { name: 'Cross-platform Application', type: 'Class Feat', level: 10, choice: 'ServoShell' },
        { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 12, choice: 'FORTRUN' },
      ] }
    const spells = focusSpells(c, entries).spells.map(spell => spell.name)
    expect(spells).toContain(TECHNOMANCER_LANGUAGE_RULES.FORTRUN.initialHack)
    expect(spells).toContain(TECHNOMANCER_LANGUAGE_RULES.ServoShell.initialHack)
    expect(spells).toContain(TECHNOMANCER_LANGUAGE_RULES.FORTRUN.advancedHack)
    expect(spells).not.toContain(TECHNOMANCER_LANGUAGE_RULES.ServoShell.advancedHack)
    const invalidAdvanced = { ...c, feats: [...c.feats,
      { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 12, choice: 'Viper' }] }
    expect(focusSpells(invalidAdvanced, entries).spells.map(spell => spell.name))
      .not.toContain(TECHNOMANCER_LANGUAGE_RULES.Viper.advancedHack)
    const withGreater = { ...c, level: 16, feats: [...c.feats,
      { name: 'Versatile Firmware', type: 'Class Feat', level: 14, choice: 'FORTRUN' },
      { name: 'Greater Cross-platform Application', type: 'Class Feat', level: 16, choice: 'FORTRUN' }] }
    expect(focusSpells(withGreater, entries).spells.map(spell => spell.name))
      .toContain(TECHNOMANCER_LANGUAGE_RULES.FORTRUN.greaterHack)
    expect(focusSpells(withGreater, entries).spells.map(spell => spell.name))
      .not.toContain(TECHNOMANCER_LANGUAGE_RULES.ServoShell.greaterHack)
  })

it('applies Technomancer firmware proficiency transfers to tech weapons and medium armor', () => {
  const technomancer = entry('class', 'Technomancer', {
    attack_proficiency: 'Trained in simple weapons',
    defense_proficiency: 'Trained in light armor, Trained in unarmored defense',
  })
  const simpleExpertise = { ...entry('classFeature', 'Technomancer Weapon Expertise', { class: 'Technomancer' }, 11),
    description: 'Your proficiency rank for simple weapons increases to expert.' }
  const lightArmorExpertise = { ...entry('classFeature', 'Technomancer Armor Expertise', { class: 'Technomancer' }, 13),
    description: 'Your proficiency rank for light armor increases to expert.' }
  const techSimple = { ...entry('weapon', 'Tech Knife', { weapon_category: 'Simple', damage: '1d4 piercing' }, 1, ['Tech']),
    systems: ['sf2e'] as ContentEntry['systems'] }
  const techMartial = { ...entry('weapon', 'Tech Sword', { weapon_category: 'Martial', damage: '1d8 slashing' }, 1, ['Tech']),
    systems: ['sf2e'] as ContentEntry['systems'] }
  const plainMartial = { ...entry('weapon', 'Sword', { weapon_category: 'Martial', damage: '1d8 slashing' }, 1),
    systems: ['sf2e'] as ContentEntry['systems'] }
  const entries = [technomancer, simpleExpertise, lightArmorExpertise, techSimple, techMartial, plainMartial]
    .map(item => ({ ...item, systems: ['sf2e'] as ContentEntry['systems'] }))
  const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 14,
    technomancerProgrammingLanguage: 'DPS++', feats: [
      { name: 'Cross-platform Application', type: 'Class Feat', level: 8, choice: 'FORTRUN' },
      { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 12, choice: 'FORTRUN' },
      { name: 'Versatile Firmware', type: 'Class Feat', level: 14, choice: 'FORTRUN' },
    ] }
  const owned = (name: string) => ({ id: name, name, potency: 0, striking: 0, runes: [] })
  expect(weaponAttack(c, entries, owned('Tech Sword'))).toMatchObject({ rank: 2, criticalSpecialization: true })
  expect(weaponAttack(c, entries, owned('Tech Knife')).criticalSpecialization).toBe(true)
  expect(weaponAttack(c, entries, owned('Sword'))).toMatchObject({ rank: 0, criticalSpecialization: false })
  expect(armorRanks(c, entries)).toMatchObject({ Light: 2, Medium: 2 })
  expect(weaponAttack({ ...c, technomancerProgrammingLanguage: 'Viper' }, entries, owned('Tech Sword')))
    .toMatchObject({ rank: 0, criticalSpecialization: false })
  expect(armorRanks({ ...c, technomancerProgrammingLanguage: 'Viper', feats: [] }, entries).Medium).toBe(0)
})

  it('grants Bard muse feats and focus spells, including additional muses', () => {
    const maestro = entry('subclass', 'Maestro', {
      class: 'Bard', grants_muse_feat: 'Lingering Composition', grants_focus_spells: 'soothe',
    })
    const enigma = entry('subclass', 'Enigma', {
      class: 'Bard', grants_muse_feat: 'Bardic Lore', grants_focus_spells: 'sure strike',
    })
    const bard: Character = { ...base, className: 'Bard', subclass: 'Maestro', level: 2,
      feats: [{ name: 'Multifarious Muse', type: 'Class Feat', level: 2, choice: 'Enigma' }] }
    expect(automaticFeatGrants(bard, [maestro, enigma])).toEqual([
      { name: 'Lingering Composition', source: 'Maestro Muse', level: 1 },
      { name: 'Bardic Lore', source: 'Enigma Muse', level: 2 },
    ])
    expect(focusSpells(bard, [maestro, enigma])).toMatchObject({
      spells: [
        { name: 'Soothe', source: 'Maestro muse' },
        { name: 'Sure Strike', source: 'Enigma muse' },
      ],
      points: 2,
    })
  })

  it('grants an Oracle mystery initial revelation spell and focus point', () => {
    const life = entry('subclass', 'Life', {
      class: 'Oracle', grants_focus_spells: 'vitality lash',
    })
    const oracle: Character = { ...base, className: 'Oracle', subclass: 'Life', level: 1 }
    expect(focusSpells(oracle, [life])).toEqual({
      spells: [{ name: 'Vitality Lash', source: 'Life mystery' }],
      points: 1,
    })
    expect(focusSpells({ ...oracle, level: 0 }, [life])).toEqual({ spells: [], points: 0 })
  })

  it('grants the selected Wizard school initial focus spell and focus point', () => {
    const legacy = entry('subclass', 'Necromancy', { class: 'Wizard', grants_focus_spells: 'call of the grave' })
    const remaster = entry('subclass', 'School of Ars Grammatica', { class: 'Wizard', grants_focus_spells: 'protective wards' })
    const wizard: Character = { ...base, className: 'Wizard', subclass: legacy.name, level: 1, feats: [] }
    expect(focusSpells(wizard, [legacy, remaster])).toEqual({
      spells: [{ name: 'Call Of The Grave', source: 'Necromancy school' }], points: 1,
    })
    expect(focusSpells({ ...wizard, subclass: remaster.name }, [legacy, remaster])).toEqual({
      spells: [{ name: 'Protective Wards', source: 'School of Ars Grammatica school' }], points: 1,
    })
    expect(focusSpells({ ...wizard, subclass: undefined }, [legacy]).spells).toEqual([])
    expect(focusSpells({ ...wizard, level: 0 }, [legacy]).spells).toEqual([])
    expect(focusSpells({ ...wizard, className: 'Oracle' }, [legacy]).spells).toEqual([])
  })

  it.each([
    ['Halfling', 'Halfling Lore', 'Acrobatics', 'Stealth', 'Halfling Lore'],
    ['Tengu', 'Tengu Lore', 'Society', 'Survival', 'Tengu Lore'],
  ])('applies %s Lore skill and Additional Lore grants', (ancestry, name, firstSkill, secondSkill, lore) => {
    const feat = mapAonHit({ _id: name, _source: {
      category: 'feat', name, level: 1, trait: [ancestry],
      markdown: `You gain the trained proficiency rank in [${firstSkill}](/Skills.aspx?ID=1) and [${secondSkill}](/Skills.aspx?ID=2). You also gain the [Additional Lore](/Feats.aspx?ID=1) general feat for [${lore}](/Skills.aspx?ID=3).`,
    } }, 'pf2e')!
    const character: Character = { ...base, ancestry, className: undefined, background: undefined,
      feats: [{ name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
    expect(ranksAt(character, [feat])).toMatchObject({ [firstSkill]: 1, [secondSkill]: 1 })
    expect(automaticFeatGrants(character, [feat])).toContainEqual({
      name: 'Additional Lore', choice: ancestry, source: name, level: 1,
    })
  })

  it('grants Prairie Rider Nature training and a replacement skill when already trained', () => {
    const feat = entry('feat', 'Prairie Rider', {}, 1, ['Halfling'])
    const selection = { name: 'Prairie Rider', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    const character: Character = { ...base, className: undefined, background: undefined, feats: [selection] }
    expect(ranksAt(character, [feat]).Nature).toBe(1)
    const alreadyTrained: Character = { ...character, skillPicks: ['Nature'],
      feats: [{ ...selection, choice: 'Acrobatics' }] }
    expect(ranksAt(alreadyTrained, [feat])).toMatchObject({ Nature: 1, Acrobatics: 1 })
    expect(featChoiceOptions('Prairie Rider', alreadyTrained, [feat], selection.slot, 0)).toContain('Acrobatics')
  })

  it.each([
    ['Adroit Manipulation', 'Thievery'],
    ['Innocuous', 'Deception'],
    ['Magically Melodious', 'Performance'],
  ])('adds a skill token when %s duplicates trained %s', (name, skill) => {
    const sf = name === 'Magically Melodious'
    const feat = { ...entry('feat', name, {}, 1, ['Halfling']), systems: sf ? ['sf2e' as const] : ['pf2e' as const] }
    const klass = entry('class', 'Rogue', { skill_proficiency: `Trained in ${skill}, Trained in additional skills equal to 4` })
    const character: Character = { ...base, systems: [sf ? 'sf2e' : 'pf2e'], ancestry: 'Halfling', className: 'Rogue', background: undefined,
      feats: [{ name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
    expect(additionalSkillCount(character, [feat, klass]) - additionalSkillCount({ ...character, feats: [] }, [klass])).toBe(1)
  })

  it.each([
    ['Innocuous', 'Deception'],
    ['Magically Melodious', 'Performance'],
  ])('keeps a free skill token when %s duplicates a picked skill', (name, skill) => {
    const sf = name === 'Magically Melodious'
    const feat = { ...entry('feat', name, {}, 1, ['Halfling']), systems: sf ? ['sf2e' as const] : ['pf2e' as const] }
    const klass = entry('class', 'Rogue', { skill_proficiency: 'Trained in Stealth, Trained in additional skills equal to 4' })
    const character: Character = { ...base, systems: [sf ? 'sf2e' : 'pf2e'], ancestry: 'Halfling', className: 'Rogue', background: undefined, skillPicks: [skill],
      feats: [{ name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
    const before = skillRankBudget({ ...character, feats: [] }, [klass]).trained
    expect(skillRankBudget(character, [feat, klass]).trained).toBe(before + 1)
  })

  it.each([
    ['Trained in Athletics', 0],
    ['Trained in Acrobatics', 1],
    ['Trained in Acrobatics, Trained in Stealth', 2],
  ])('handles Halfling Lore with %s and %i overlaps', (proficiencies, overlapCount) => {
    const feat = mapAonHit({ _id: 'halfling-lore', _source: {
      category: 'feat', name: 'Halfling Lore', level: 1, trait: ['Halfling'],
      markdown: 'You gain the trained proficiency rank in Acrobatics and Stealth. You also gain the Additional Lore general feat for Halfling Lore.',
    } }, 'pf2e')!
    const klass = entry('class', 'Ranger', { skill_proficiency: proficiencies })
    const selection = { name: 'Halfling Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    const character: Character = { ...base, ancestry: 'Halfling', className: 'Ranger', background: undefined,
      feats: [selection] }
    const withoutFeat = additionalSkillCount({ ...character, feats: [] }, [klass, feat])
    expect(additionalSkillCount(character, [klass, feat]) - withoutFeat).toBe(overlapCount)
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

  it('applies Ponderous armor initiative penalties based on Strength and check penalty', () => {
    const armor: ContentEntry = { ...entry('armor', 'Myrmidon Siegebreaker Plate', {
      armor_category: 'Heavy', armor_group: 'Plate', strength: 2, check_penalty: -2,
    }, 9, ['Ponderous']), systems: ['sf2e'] }
    const owned = { id: 'myrmidon', name: armor.name, potency: 0, resilient: 0, runes: [], worn: true }
    const c: Character = { ...base, systems: ['sf2e'], armors: [owned] }
    const withoutArmor = { ...c, armors: [] }
    expect(initiativeBonus(c, [armor]) - initiativeBonus(withoutArmor, [armor])).toBe(-2)
    expect(initiativeBonus({ ...c, abilities: { ...c.abilities, str: 14 } }, [armor])
      - initiativeBonus(withoutArmor, [armor])).toBe(-1)
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

  it('grants Natural Performer training and a first-level Performance feat slot', () => {
    const performance = entry('feat', 'Fascinating Performance', { skill: 'Performance' }, 1, ['General', 'Skill'])
    const advanced = entry('feat', 'Advanced Performance', { skill: 'Performance' }, 2, ['General', 'Skill'])
    const crafting = entry('feat', 'Specialty Crafting', { skill: 'Crafting' }, 1, ['General', 'Skill'])
    const assurance = entry('feat', 'Assurance', {}, 1, ['General', 'Skill'])
    const entries = [performance, advanced, crafting, assurance]
    const selection = { name: 'Natural Performer', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' }
    const c: Character = { ...base, level: 5, feats: [selection] }
    const slot = plannedSlots(c, entries).find(slot => slot.grantedBy === 'Natural Performer')!
    expect(slot).toMatchObject({ level: 5, maxFeatLevel: 1, grantedSkill: 'Performance' })
    expect(ranksAt(c, entries).Performance).toBe(1)
    expect(eligibleFeats(entries, c, slot)).toEqual(expect.arrayContaining([performance, assurance]))
    expect(eligibleFeats(entries, c, slot)).not.toContain(advanced)
    expect(eligibleFeats(entries, c, slot)).not.toContain(crafting)
    expect(featChoiceOptions('Assurance', c, entries, slot.key)).toEqual(['Performance'])
    expect(plannedSlots({ ...c, level: 4 }, entries).some(slot => slot.grantedBy === 'Natural Performer')).toBe(false)
    expect(plannedSlots({ ...c, systems: ['sf2e'] }, entries).some(slot => slot.grantedBy === 'Natural Performer')).toBe(false)
    const performerClass = entry('class', 'Performer', { skill_proficiency: 'Trained in Performance' })
    const trained = { ...c, className: 'Performer' }
    expect(additionalSkillCount(trained, [performerClass])).toBe(additionalSkillCount({ ...trained, feats: [] }, [performerClass]) + 1)
  })

  it('grants Pitborn Athletics training and a common first-level Athletics skill feat', () => {
    const titan = entry('feat', 'Titan Wrestler', { prerequisite: 'Trained in Athletics' }, 1, ['General', 'Skill'])
    const uncommon = entry('feat', 'Uncommon Athlete', { prerequisite: 'Trained in Athletics' }, 1, ['General', 'Skill', 'Uncommon'])
    const advanced = entry('feat', 'Advanced Athlete', { prerequisite: 'Trained in Athletics' }, 2, ['General', 'Skill'])
    const noPrerequisite = entry('feat', 'Other Athlete', { skill: 'Athletics' }, 1, ['General', 'Skill'])
    const entries = [titan, uncommon, advanced, noPrerequisite]
    const selection = { name: 'Pitborn', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' }
    const c: Character = { ...base, level: 5, feats: [selection] }
    const slot = plannedSlots(c, entries).find(slot => slot.grantedBy === 'Pitborn')!
    expect(slot).toMatchObject({ level: 5, maxFeatLevel: 1, grantedSkill: 'Athletics' })
    expect(ranksAt(c, entries).Athletics).toBe(1)
    expect(eligibleFeats(entries, c, slot)).toEqual([titan])
    expect(plannedSlots({ ...c, level: 4 }, entries).some(s => s.grantedBy === 'Pitborn')).toBe(false)
    expect(plannedSlots({ ...c, feats: [] }, entries).some(s => s.grantedBy === 'Pitborn')).toBe(false)
    expect(plannedSlots({ ...c, systems: ['sf2e'] }, entries).some(s => s.grantedBy === 'Pitborn')).toBe(false)
    expect(plannedSlots({ ...c, dismissedFeatSlots: [slot.key] }, entries)).toContainEqual(slot)
    const athleteClass = entry('class', 'Athlete', { skill_proficiency: 'Trained in Athletics' })
    const trained = { ...c, className: 'Athlete' }
    expect(additionalSkillCount(trained, [athleteClass])).toBe(additionalSkillCount({ ...trained, feats: [] }, [athleteClass]) + 1)
  })

  it('grants Gnome Obsession Lore progression and Assurance for its selected specialty', () => {
    const obsession = { name: 'Gnome Obsession', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'Circus Lore' }
    const c: Character = { ...base, level: 15, ancestry: 'Gnome', feats: [obsession], lores: [{ name: 'Custom Lore', rank: 0 }] }
    const options = featChoiceOptions('Gnome Obsession', c, [], obsession.slot)!
    expect(options).toContain('Circus Lore')
    expect(options).toContain('Custom Lore')
    for (const [level, rank] of [[1, 1], [3, 2], [7, 3], [15, 4]] as const) {
      expect(ranksAt({ ...c, level }, [])['Circus Lore']).toBe(rank)
    }
    expect(automaticFeatGrants(c, [])).toEqual(expect.arrayContaining([
      { name: 'Additional Lore', choice: 'Circus', source: 'Gnome Obsession', level: 1 },
      { name: 'Assurance', choice: 'Circus Lore', source: 'Gnome Obsession', level: 1 },
    ]))
    const changed = { ...c, feats: [{ ...obsession, choice: 'Custom Lore' }] }
    expect(featLores(changed, [])).toContain('Custom Lore')
    expect(featLores(changed, [])).not.toContain('Circus Lore')
    expect(automaticFeatGrants({ ...c, level: 1, feats: [{ ...obsession, slot: 'ancestry:5:0' }] }, []))
      .not.toEqual(expect.arrayContaining([{ name: 'Assurance', choice: 'Circus Lore', source: 'Gnome Obsession', level: 5 }]))
  })

  it('grants Magical Shorthand from the Spellbook Prodigy arcana choice', () => {
    const arcana = { name: 'Basic Arcana', type: 'Class Feat', level: 2, slot: 'class:2:1', choice: 'Spellbook Prodigy' }
    const c: Character = { ...base, className: 'Wizard', level: 2, feats: [arcana] }
    expect(automaticFeatGrants(c, [])).toContainEqual({ name: 'Magical Shorthand', source: 'Spellbook Prodigy', level: 2 })
    expect(automaticFeatGrants({ ...c, level: 1 }, []).some(grant => grant.name === 'Magical Shorthand')).toBe(false)
  })

  it('ranks up Wizard spell proficiency at levels 7, 15 and 19 without class feature data', () => {
    const ranks = [1, 6, 7, 14, 15, 18, 19].map(level =>
      classSpellcasting({ ...base, className: 'Wizard', level }, [entry('class', 'Wizard', { tradition: 'Arcane' })])?.rank)
    expect(ranks).toEqual([1, 1, 2, 2, 3, 3, 4])
  })

  it('adds a school curriculum spell restriction to each Wizard spell rank', () => {
    const school = entry('subclass', 'School of Ars Grammatica', { class: 'Wizard' })
    school.description = 'Curriculum\n\ncantrips: message, sigil; 1st: command, runic weapon; 2nd: dispel magic, translate\n\nSchool Spells\n\ninitial: protective wards'
    const c: Character = { ...base, className: 'Wizard', level: 3, subclass: school.name }
    expect(classExtraSlots(c, [school]).map(extra => [extra.rank, extra.allowedSpells])).toEqual([
      [0, ['Message', 'Sigil']], [1, ['Command', 'Runic Weapon']], [2, ['Dispel Magic', 'Translate']]])
  })

  it('adds school curriculum spells to the Wizard spellbook up to the highest spell rank', () => {
    const school = entry('subclass', 'School of Ars Grammatica', { class: 'Wizard' })
    school.description = 'Curriculum\n\ncantrips: message; 1st: command; 2nd: translate\n\nSchool Spells\n\ninitial: protective wards'
    const spells = ['Message', 'Command', 'Translate'].map(name => ({ ...entry('spell', name, {}), systems: ['pf2e' as const] }))
    const c: Character = { ...base, className: 'Wizard', level: 1, subclass: school.name }
    const added = wizardSchoolBookSpells(c, [school, ...spells])!
    expect(added.map(spell => [spell.name, spell.rank, spell.cantrip])).toEqual([['Message', 0, true], ['Command', 1, false]])
    expect(wizardSchoolBookSpells({ ...c, spells: added }, [school, ...spells])).toBeUndefined()
    expect(wizardSchoolBookSpells({ ...c, level: 3, spells: added }, [school, ...spells])!.map(spell => spell.name))
      .toEqual(['Message', 'Command', 'Translate'])
  })

  it('adds Gnome Polyglot languages and improves each active Multilingual grant', () => {
    const multilingual = [
      { name: 'Multilingual', type: 'Skill Feat', level: 1, slot: 'skill:2:0' },
      { name: 'Multilingual', type: 'Skill Feat', level: 1, slot: 'skill:8:0' },
    ]
    const polyglot = { name: 'Gnome Polyglot', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' }
    const c: Character = { ...base, level: 10, feats: [...multilingual, polyglot] }
    expect(languageAllowance(c, []).slots - languageAllowance({ ...c, feats: multilingual }, []).slots).toBe(5)
    const master = { ...c, rankOverrides: { Society: 4 } }
    expect(languageAllowance(master, []).slots - languageAllowance(c, []).slots).toBe(4)
    const prodigy = { name: 'Linguistic Prodigy', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
    expect(languageAllowance({ ...c, feats: [...c.feats, prodigy] }, []).slots - languageAllowance(c, []).slots).toBe(4)
    expect(languageAllowance({ ...c, level: 3 }, []).slots)
      .toBe(languageAllowance({ ...c, level: 3, feats: multilingual }, []).slots)
    expect(languageAllowance({ ...c, systems: ['sf2e'] }, []).slots)
      .toBe(languageAllowance({ ...c, systems: ['sf2e'], feats: multilingual }, []).slots)
  })
})

describe('languageGroups', () => {
  it('keeps listed speakers and regional languages while including other synced languages', () => {
    const synced = [entry('language', 'Wildsong', { rarity: 'Secret' }), entry('language', 'Elven', { rarity: 'Common' }), entry('language', 'Aklo', { rarity: 'Uncommon' }), entry('language', 'Sussuran', { rarity: 'Secret' }), entry('language', 'Anadi', { rarity: 'Secret' }), entry('language', 'Cyclops', { rarity: 'Uncommon' })]
    expect(Object.keys(languageGroups(synced))).toEqual(['Common', 'Regional', 'Uncommon', 'Secret', 'Rare'])
    expect(languageGroups(synced).Secret.map(([n]) => n)).toEqual(['Wildsong'])
    expect(languageGroups(synced).Rare.map(([n]) => n)).toEqual(['Anadi'])
    expect(languageGroups(synced).Uncommon).toContainEqual(['Sussuran', 'Air elemental creatures, flying creatures'])
    expect(languageGroups(synced).Uncommon).toContainEqual(['Petran', 'Earth elemental creatures'])
    expect(languageGroups(synced).Uncommon).toContainEqual(['Cyclops', 'Cyclopes'])
    expect(languageGroups(synced).Regional).toContainEqual(['Hallit', 'Broken Lands, Eye of Dread, Saga Lands'])
    expect(languageGroups(synced).Regional).toContainEqual(['Iblydosi', 'Iblydos'])
    expect(languageGroups(synced).Regional).toHaveLength(10)
    expect(languageGroups(synced).Common.filter(([n]) => n === 'Elven')).toHaveLength(1)
    expect(Object.keys(languageGroups([]))).toContain('Rare')
  })

  it('shows Starfinder speakers and common or uncommon classifications without duplicating synced languages', () => {
    const synced: ContentEntry[] = [
      { ...entry('language', 'Akitonian', { rarity: 'Common' }), systems: ['sf2e'], description: '' },
      { ...entry('language', 'Orcish', { rarity: 'Uncommon' }), systems: ['sf2e'], description: '' },
    ]
    const groups = languageGroups(synced, ['sf2e'])
    expect(groups.Common).toEqual(expect.arrayContaining([
      ['Common', 'Humans, most citizens of the Pact Worlds'], ['Kasatha', 'Kasathas, inhabitants of Kasath or the Idari'],
      ['Pahtra', 'Pahtras'],
    ]))
    expect(groups.Regional).toEqual(expect.arrayContaining([
      ['Akitonian', 'Akiton (shobhads, ysoki)'],
      ['Brethedan', 'Bretheda, Liavara, and their moons (barathus, kalos, maraquoi)'],
      ['Castrovelian', 'Castrovel (lashuntas and formians)'], ['Diasporan', 'Diaspora (sarcesians)'],
      ['Draconic', 'Triaxus (dragons, dragonkin, ryphorians)'], ['Eoxian', 'Eox (elebrians)'],
      ['Trinary', 'Aballon (anacites, androids)'], ['Vercite', 'Verces (verthani)'],
      ['Vesk', 'Pulonis, the Veskarium (pahtras, vesk)'],
    ]))
    expect(groups.Uncommon).toEqual(expect.arrayContaining([
      ['Aklo', 'Evil fey, otherworldly monsters'], ['Chthonian', 'Demons'], ['Diabolic', 'Devils'],
      ['Empyrean', 'Angels'], ['Muan', 'Wood elemental creatures'], ['Necril', 'Undead'],
      ['Orcish', 'Orcs, dromaars'], ['Petran', 'Earth elemental creatures'], ['Pyric', 'Fire elemental creatures'],
      ['Shadowtongue', 'Netherworld creatures'], ['Sussuran', 'Air elemental creatures, flying creatures'],
      ['Talican', 'Metal elemental creatures'], ['Thalassic', 'Aquatic creatures, water elemental creatures'],
    ]))
    expect(groups.Regional.filter(([name]) => name === 'Akitonian')).toHaveLength(1)
    expect(groups.Common.some(([name]) => name === 'Akitonian' || name === 'Draconic')).toBe(false)
    expect(groups.Common.some(([name]) => name === 'Orcish')).toBe(false)
    const both = languageGroups(synced, ['pf2e', 'sf2e'])
    expect(both.Regional).toContainEqual(['Draconic', 'Dragons, reptilian humanoids; Triaxus (dragons, dragonkin, ryphorians)'])
    expect(both.Common.some(([name]) => name === 'Draconic')).toBe(false)
    expect(both.Common.filter(([name]) => name === 'Orcish')).toHaveLength(1)
    expect(both.Uncommon.some(([name]) => name === 'Orcish')).toBe(false)
    expect(languageGroups([], ['pf2e']).Common.some(([name]) => name === 'Akitonian')).toBe(false)
  })

  it('recognizes Starfinder ancestry languages with and without synced entries', () => {
    for (const entries of [[], [entry('language', 'Elven', { rarity: 'Common' })]]) {
      entries.push({ ...entry('ancestry', 'Kasatha', { language: 'Common, Kasatha' }), systems: ['sf2e'] })
      const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Kasatha' }
      expect(languageAllowance(c, entries).locked).toContain('Kasatha')
      expect(languageAllowance({ ...c, systems: ['pf2e'] }, entries).locked).not.toContain('Kasatha')
    }
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
  it('prevents incompatible steed breeds and hides class feats from archetype slots', () => {
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
      expect(eligibleFeats(data, { ...c, feats: c.feats.slice(0, 1) },
        { key: 'archetype:8:0', category: 'archetype', level: 8 })).toEqual([])
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
    expect(names(has('Wild Hunter Dedication'))).toEqual(['Living Weapon', 'Medic Dedication'])
  })
  it('grants both Commander dedications through their independent house rules', () => {
    const previous = getSettings()
    onTestFinished(() => updateSettings(previous))
    const commander = { ...base, className: 'Commander', level: 2 }
    updateSettings({ commanderBeastmaster: true, commanderCavalier: true, commanderCaptain: false, freeArchetype: true })
    expect(activeHomebrewDedications(commander).map(rule => rule.name)).toEqual(['Beastmaster Dedication', 'Cavalier Dedication'])
    expect(plannedSlots(commander).map(slot => slot.key)).toEqual(expect.arrayContaining(['archetype:2:g93', 'archetype:2:g91']))
    expect(plannedSlots(commander).map(slot => slot.key)).not.toContain('archetype:2:0')
    updateSettings({ commanderCavalier: false })
    expect(activeHomebrewDedications(commander).map(rule => rule.name)).toEqual(['Beastmaster Dedication'])
    updateSettings({ commanderCavalier: true, commanderBeastmaster: false, freeArchetype: false })
    expect(activeHomebrewDedications(commander).map(rule => rule.name)).toEqual(['Cavalier Dedication'])
    expect(activeHomebrewDedications({ ...commander, level: 1 })).toEqual([])
    expect(activeHomebrewDedications({ ...commander, className: 'Fighter' })).toEqual([])
  })
  it('accepts shared Cavalier feats through either dedication and counts them toward dedication requirements', () => {
    const previous = getSettings().ignoreArchetypeFeatMinimums
    onTestFinished(() => updateSettings({ ignoreArchetypeFeatMinimums: previous }))
    updateSettings({ ignoreArchetypeFeatMinimums: false })
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
  it('keeps class feats out of archetype slots when character class can select them', () => {
    const cavalier = entry('feat', 'Cavalier Dedication', { archetype: 'Cavalier' }, 2, ['Archetype', 'Dedication'])
    const launch = entry('feat', 'Galloping Launch', { archetype: 'Cavalier', archetype_levels: 'Cavalier:6' }, 4, ['Ranger'])
    const data = [cavalier, launch]
    const c = { ...has(cavalier.name), className: 'Ranger', level: 6 }
    expect(eligibleFeats(data, c, { key: 'archetype:4:0', category: 'archetype', level: 4 })).not.toContain(launch)
    expect(eligibleFeats(data, c, { key: 'archetype:6:0', category: 'archetype', level: 6 })).not.toContain(launch)
    expect(eligibleFeats(data, { ...c, className: 'Fighter' },
      { key: 'archetype:6:0', category: 'archetype', level: 6 })).toContain(launch)
    const ranger: Character = { ...base, className: 'Ranger', level: 4, feats: [{ name: launch.name, type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
    expect(eligibleFeats(data, ranger, { key: 'class:4:0', category: 'class', level: 4 })).toContain(launch)
    expect(orphanedArchetypeFeats(ranger, data)).toEqual([])
    expect(orphanedArchetypeFeats({ ...ranger, feats: [{ ...ranger.feats[0], slot: 'archetype:6:0' }] }, data).map((feat) => feat.name)).toEqual([launch.name])
  })
  it('hides archetype access when character class already grants the feat', () => {
    const mauler = entry('feat', 'Mauler Dedication', { archetype: 'Mauler' }, 2, ['Archetype', 'Dedication'])
    const sweep = entry('feat', 'Unbalancing Sweep', { archetype: 'Mauler', archetype_levels: 'Mauler:14' },
      12, ['Barbarian', 'Flourish'])
    const data = [mauler, sweep]
    const barbarian = { ...base, className: 'Barbarian', level: 14,
      feats: [{ name: mauler.name, type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' }] }

    expect(eligibleFeats(data, barbarian, { key: 'archetype:14:0', category: 'archetype', level: 14 })).not.toContain(sweep)
    expect(eligibleFeats(data, barbarian, { key: 'class:12:0', category: 'class', level: 12 })).toContain(sweep)
    expect(eligibleFeats(data, { ...barbarian, className: 'Fighter' },
      { key: 'archetype:14:0', category: 'archetype', level: 14 })).toContain(sweep)
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
  it('grants trained armor specialization and increases its value in Tenacious Stance', () => {
    const feat = entry('feat', 'Unshaken in Iron', { grants_armor_specialization: 'yes', grants_armor_categories: 'light' }, 8)
    const fighter = entry('class', 'Fighter', { light_armor_proficiency: 'Trained', medium_armor_proficiency: 'Trained', heavy_armor_proficiency: 'Trained' })
    const wizard = entry('class', 'Wizard', { light_armor_proficiency: 'Trained' })
    const group = entry('armorGroup', 'Plate')
    const heavy = entry('armor', 'Plate', { armor_group: 'Plate', armor_category: 'Heavy', check_penalty: -3, speed_penalty: -10, strength: 18 })
    const medium = { ...heavy, data: { ...heavy.data, armor_category: 'Medium', check_penalty: -2 } }
    const light = { ...heavy, data: { ...heavy.data, armor_category: 'Light' } }
    const data = [feat, fighter, wizard, group, heavy]
    const c: Character = { ...base, level: 8, className: 'Fighter', abilities: { ...base.abilities, str: 18 },
      feats: [{ name: 'Stalwart Defender Dedication', type: 'Archetype Feat', level: 2 },
        { name: feat.name, type: 'Archetype Feat', level: 8 }],
      armors: [{ id: 'armor', name: heavy.name, worn: true, potency: 1, resilient: 0, runes: [] }] }
    expect(armorSpecialization(c, data)?.benefit?.value).toBe(3)
    const active = { ...c, activeStance: 'Tenacious Stance' }
    expect(armorSpecialization(active, data)?.benefit?.value).toBe(6)
    expect(resistances(active, data)).toContainEqual({ damage: 'Slashing', value: 6, source: 'Plate Armor Specialization' })
    expect(armorSpecialization({ ...active, level: 7 }, data)).toBeUndefined()
    expect(armorSpecialization({ ...c, className: 'Wizard' }, data)).toBeUndefined()
    expect(armorSpecialization(c, [feat, fighter, group, medium])?.benefit?.value).toBe(2)
    expect(armorSpecialization(c, [feat, fighter, group, light])?.summary).toContain('Value not specified for light armor')
  })

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

it('grants Mountain Skin armor training and scales only armor categories it grants', () => {
  const fighter = entry('class', 'Fighter', { defense_proficiency: 'Trained in light armor, trained in medium armor' })
  const expert = { ...entry('classFeature', 'Armor Expertise', { class: 'Fighter' }, 11),
    description: 'Your proficiency rank for light armor increases to expert.' }
  const master = { ...entry('classFeature', 'Armor Mastery', { class: 'Fighter' }, 19),
    description: 'Your proficiency rank for light armor increases to master.' }
  const c: Character = { ...base, systems: ['pf2e'], className: 'Fighter', level: 4,
    feats: [{ name: 'Mountain Skin', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' }] }
  const data = [fighter, expert, master]
  expect(armorRanks({ ...c, level: 3 }, data)).toMatchObject({ Medium: 1, Heavy: 0 })
  expect(armorRanks(c, data)).toMatchObject({ Medium: 1, Heavy: 1 })
  expect(armorRanks({ ...c, level: 11 }, data)).toMatchObject({ Light: 2, Medium: 1, Heavy: 2 })
  expect(armorRanks({ ...c, level: 19 }, data)).toMatchObject({ Light: 3, Medium: 1, Heavy: 3 })
  expect(armorRanks({ ...c, level: 19, feats: [] }, data).Heavy).toBe(0)
  const monk = entry('class', 'Monk', { defense_proficiency: 'Trained in unarmored defense' })
  const unarmored = { ...entry('classFeature', 'Unarmored Expertise', { class: 'Monk' }, 11),
    description: 'Your proficiency rank for unarmored defense increases to expert.' }
  expect(armorRanks({ ...c, className: 'Monk', level: 11 }, [monk, unarmored]))
    .toMatchObject({ Unarmored: 2, Medium: 1, Heavy: 1 })
})

describe('homebrew feat rules', () => {
  it('grants Commanders a separate Captain Dedication slot even with a companion', ({ onTestFinished }) => {
    const previous = getSettings()
    onTestFinished(() => updateSettings(previous))
    updateSettings({ commanderCaptain: true, commanderBeastmaster: false, commanderCavalier: false, freeArchetype: true })
    const c: Character = { ...base, className: 'Commander', level: 2,
      feats: [{ name: "Commander's Companion", type: 'Class Feat', level: 2 }],
      companions: [{ id: 'bear', type: 'Bear', name: '' }] }
    expect(activeHomebrewDedications(c)).toContainEqual(expect.objectContaining({
      name: 'Captain Dedication', slot: 'archetype:2:g85', replacesFreeArchetype: false,
    }))
    expect(plannedSlots(c).map(slot => slot.key)).toEqual(expect.arrayContaining(['archetype:2:g85', 'archetype:2:0']))
    expect(plannedSlots({ ...c, level: 1 }).map(slot => slot.key)).not.toContain('archetype:2:g85')
    expect(plannedSlots({ ...c, className: 'Fighter' }).map(slot => slot.key)).not.toContain('archetype:2:g85')
    updateSettings({ commanderCaptain: false })
    expect(plannedSlots(c).map(slot => slot.key)).not.toContain('archetype:2:g85')
    updateSettings({ commanderCaptain: true, freeArchetype: false })
    expect(plannedSlots(c).map(slot => slot.key)).toContain('archetype:2:g85')
  })

  it('grants ancestry dedications at level 2 without replacing Free Archetype', ({ onTestFinished }) => {
    const previous = getSettings()
    onTestFinished(() => updateSettings(previous))
    updateSettings({ orcTattooedHistorian: true, dwarfStalwartDefender: true, freeArchetype: true })
    for (const [ancestry, name, slot] of [
      ['Orc', 'Tattooed Historian Dedication', 'archetype:2:g87'],
      ['Dwarf', 'Stalwart Defender Dedication', 'archetype:2:g86'],
    ]) {
      const character = { ...base, systems: ['pf2e'] as Character['systems'], ancestry, className: 'Fighter', level: 2 }
      expect(activeHomebrewDedications(character)).toContainEqual(expect.objectContaining({ name, slot }))
      expect(plannedSlots(character).map(item => item.key)).toEqual(expect.arrayContaining([slot, 'archetype:2:0']))
      expect(plannedSlots({ ...character, level: 1 }).map(item => item.key)).not.toContain(slot)
      expect(plannedSlots({ ...character, systems: ['sf2e'] }).map(item => item.key)).not.toContain(slot)
      expect(plannedSlots({ ...character, ancestry: 'Human' }).map(item => item.key)).not.toContain(slot)
    }
    updateSettings({ orcTattooedHistorian: false, dwarfStalwartDefender: false, freeArchetype: false })
    expect(activeHomebrewDedications({ ...base, ancestry: 'Orc', className: 'Fighter', level: 2 })).toEqual([])
    expect(activeHomebrewDedications({ ...base, ancestry: 'Dwarf', className: 'Fighter', level: 2 })).toEqual([])
    updateSettings({ orcTattooedHistorian: true })
    expect(plannedSlots({ ...base, systems: ['pf2e'], ancestry: 'Orc', className: 'Fighter', level: 2 }).map(item => item.key))
      .toContain('archetype:2:g87')
  })

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

  it('adds locked Beastmaster Dedication slots for Ranger, Champion, Commander and Druid', ({ onTestFinished }) => {
    const previous = getSettings()
    onTestFinished(() => updateSettings(previous))
    updateSettings({ rangerBeastmaster: true, championBeastmaster: true, commanderBeastmaster: true, druidBeastmaster: true })
    const slot = (className: string, level = 2) => plannedSlots({ ...base, className, level }).find(s => s.key.startsWith('archetype:2:g9') && homebrewDedication(s.key)?.name === 'Beastmaster Dedication')?.key
    expect(slot('Ranger')).toBe('archetype:2:g95')
    expect(slot('Champion')).toBe('archetype:2:g94')
    expect(slot('Commander')).toBe('archetype:2:g93')
    expect(slot('Druid')).toBe('archetype:2:g92')
    expect(slot('Wizard')).toBeUndefined()
    expect(slot('Druid', 1)).toBeUndefined()
    updateSettings({ druidBeastmaster: false })
    expect(slot('Druid')).toBeUndefined()
  })

  it('adds locked Animal Trainer, Beastmaster and Cavalier Dedication slots for Bards at level 2', ({ onTestFinished }) => {
    const previous = getSettings()
    onTestFinished(() => updateSettings(previous))
    updateSettings({ bardAnimalTrainer: true, bardBeastmaster: true, bardCavalier: true })
    const keys = (level: number) => plannedSlots({ ...base, className: 'Bard', level }).map(s => s.key)
    expect(keys(2)).toEqual(expect.arrayContaining(['archetype:2:g90', 'archetype:2:g89', 'archetype:2:g88']))
    expect(keys(1)).not.toContain('archetype:2:g90')
    updateSettings({ bardCavalier: false })
    expect(keys(2)).not.toContain('archetype:2:g88')
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
  const dedication = { ...entry('feat', 'Hellknight Dedication', {}, 2, ['Archetype']), systems: ['sf2e' as const] }
  const feats = [{ name: 'Hellknight Dedication', type: 'Archetype Feat', level: 2, choice: 'Order of the Pyre' },
    { name: 'Infernal Bulwark', type: 'Archetype Feat', level: 10 }]
  const c: Character = { ...base, systems: ['sf2e'], level: 12, feats }
  expect(featChoiceOptions('Hellknight Dedication', c, [dedication], '')).toContain('Order of the Crucible')
  expect(armorRanks(c, []).Heavy).toBeGreaterThanOrEqual(1)
})

it.each([['Untrained', 1], ['Trained', 2], ['Expert', 2], ['Master', 3], ['Legendary', 4]])(
  'limits Infernal Bulwark improvement from %s heavy armor without reducing higher proficiency', (rank, expected) => {
    const c: Character = { ...base, className: 'Fighter', level: 12,
      feats: [{ name: 'Infernal Bulwark', type: 'Archetype Feat', level: 10 }] }
    expect(armorRanks(c, [entry('class', 'Fighter', { heavy_armor_proficiency: rank })]).Heavy).toBe(expected)
  })

it('applies Guardian Mastery armor item bonus to damaging Reflex saves', () => {
  const armor = entry('armor', 'Full Plate', { armor_category: 'Heavy', ac: 6 }, 1, ['Bulwark'])
  const mastery = entry('classFeature', 'Guardian Mastery', { class: 'Guardian' }, 13)
  const c: Character = { ...base, className: 'Guardian', level: 13, abilities: { ...base.abilities, dex: 10 },
    armors: [{ id: 'a', name: armor.name, potency: 1, resilient: 0, runes: [], worn: true }] }
  const notes = savingThrowBreakdown(c, [armor, mastery], 'Reflex', { Reflex: 2 }).notes?.join(' ')
  expect(notes).toContain('Guardian Mastery: +')
  expect(notes).toContain('(+8)')
  expect(savingThrowBreakdown(c, [armor], 'Reflex').notes?.join(' ') ?? '').not.toContain('Guardian Mastery')
  expect(savingThrowBreakdown({ ...c, armors: [] }, [armor, mastery], 'Reflex').notes?.join(' ') ?? '').not.toContain('Guardian Mastery')
})

it('applies Bulwark resistance only while armored and keeps damaging Reflex benefits conditional', () => {
  const armor = entry('armor', 'Breastplate', { armor_category: 'Medium' })
  const c: Character = { ...base, level: 13, abilities: { ...base.abilities, dex: 12 },
    feats: [{ name: 'Hellknight Dedication', type: 'Archetype Feat', level: 2, choice: 'Order of the Pyre' },
      { name: 'Infernal Bulwark', type: 'Archetype Feat', level: 10 }],
    armors: [{ id: 'a', name: armor.name, potency: 0, resilient: 0, runes: [], worn: true }] }
  expect(resistances(c, [armor])).toContainEqual({ damage: 'Fire', value: 6, source: 'Infernal Bulwark (Order of the Pyre)' })
  const reflex = savingThrowBreakdown(c, [armor], 'Reflex', { Reflex: 1 })
  expect(reflex.total).toBe(16)
  expect(reflex.notes?.join(' ')).toContain('+18 on damaging Reflex saves')
  const unarmored = { ...c, armors: [] }
  expect(resistances(unarmored, [armor]).some(resistance => resistance.source.startsWith('Infernal Bulwark'))).toBe(false)
  expect(savingThrowBreakdown(unarmored, [armor], 'Reflex').notes?.join(' ') ?? '').not.toContain('Infernal Bulwark')
  expect(savingThrowBreakdown({ ...c, abilities: { ...c.abilities, dex: 20 } }, [armor], 'Reflex', { Reflex: 1 }).notes?.join(' '))
    .toContain('+20 on damaging Reflex saves')
})

it.each(['pf2e', 'sf2e'] as const)('applies Hellknight Mobility to %s heavy armor only when Strength is met', system => {
  const armor: ContentEntry = { ...entry('armor', 'Test Plate',
    { armor_category: 'Heavy', strength: 4, speed_penalty: -10 }), systems: [system] }
  const c: Character = { ...base, systems: [system], level: 10, abilities: { ...base.abilities, str: 16 },
    feats: [{ name: 'Hellknight Mobility', type: 'Archetype Feat', level: 8 }],
    armors: [{ id: 'a', name: armor.name, potency: 0, resilient: 0, runes: [], worn: true }] }
  expect(starfinderArmorPenalties(c, [armor]).speed).toBe(-10)
  const strong = { ...c, abilities: { ...c.abilities, str: 18 } }
  expect(starfinderArmorPenalties(strong, [armor]).speed).toBe(0)
  expect(starfinderArmorPenalties({ ...strong, feats: [] }, [armor]).speed).toBe(-5)
  expect(speed({ ...strong, feats: [...strong.feats, { name: 'Unburdened Iron', type: 'Ancestry Feat', level: 1 }] }, [armor]))
    .toBe(speed(strong, [armor]) + 5)
})

it('applies Starfinder Mobility Enhancer armor upgrades and augmentations to speeds', () => {
  const armor: ContentEntry = { ...entry('armor', 'Test Plate', { armor_category: 'Heavy', strength: 4, speed_penalty: -10, upgrade_slots: 1 }), systems: ['sf2e'] }
  const upgrade: ContentEntry = { ...entry('item', 'Mobility Enhancer', { item_subcategory: 'Armor Upgrades' }), id: 'enhancer', systems: ['sf2e'] }
  const c: Character = { ...base, systems: ['sf2e'], level: 10, abilities: { ...base.abilities, str: 10 },
    armors: [{ id: 'a', name: armor.name, potency: 0, resilient: 0, runes: [], worn: true, upgrades: ['enhancer'] }] }
  expect(starfinderArmorPenalties({ ...c, armors: [{ ...c.armors![0], upgrades: [] }] }, [armor, upgrade]).speed).toBe(-10)
  expect(starfinderArmorPenalties(c, [armor, upgrade]).speed).toBe(-5)
  const winged: Character = { ...base, systems: ['sf2e'], level: 11, feats: [{ name: 'Basic Insectile Flight', type: 'Ancestry Feat', level: 1 }],
    augmentations: [{ id: 'm', entryId: 'x', name: 'Mobility Enhancer (Tactical)', slot: 'standard' }] }
  expect(movementSpeeds(winged, []).find(move => move.name === 'Fly')?.feet)
    .toBe(movementSpeeds({ ...winged, augmentations: [] }, []).find(move => move.name === 'Fly')!.feet + 10)
})

it('offers Cross-Training order variants once each while preserving edits and spell or domain variants', () => {
  const dedication = { name: 'Hellknight Dedication', type: 'Archetype Feat', level: 2, choice: 'Order of the Pyre' }
  const cross = entry('feat', 'Order Cross-Training', { repeatable: true }, 12, ['Archetype'])
  const c: Character = { ...base, level: 20, feats: [dedication,
    { name: cross.name, type: 'Archetype Feat', level: 12, slot: 'bonus:12:0', choice: 'Order of the Gate: Arcane' }] }
  const options = featChoiceOptions(cross.name, c, [cross], 'bonus:14:0')!
  expect(options).toContain('Order of the Godclaw: Protection')
  expect(options).toContain('Order of the Chain')
  expect(options.some(choice => choice.startsWith('Order of the Gate'))).toBe(false)
  expect(options).not.toContain('Order of the Pyre')
  expect(featChoiceOptions(cross.name, c, [cross], 'bonus:12:0')).toContain('Order of the Gate: Arcane')
  expect(eligibleFeats([cross], c, { key: 'bonus:14:0', category: 'bonus', level: 14 })).toContain(cross)
})

it('applies Nail movement bonuses and ignores stale Scourge activation', () => {
  const c: Character = { ...base, level: 12, feats: [
    { name: 'Hellknight Dedication', type: 'Archetype Feat', level: 2, choice: 'Order of the Nail' },
    { name: 'Order Training', type: 'Archetype Feat', level: 8 },
    { name: 'Natural Swimmer', type: 'Ancestry Feat', level: 1 },
  ] }
  const before = movementSpeeds(c, [])
  const active = { ...c, activeFeatEffects: ['Trailblazing Stride'] }
  expect(movementSpeeds(active, []).map(movement => movement.feet)).toEqual(before.map(movement => movement.feet + 10))
  expect(movementSpeeds({ ...active, feats: [] }, []).find(movement => movement.name === 'Land')?.feet).toBe(25)
  const scourge = { ...c, feats: [{ ...c.feats[0], choice: 'Order of the Scourge' },
    { name: 'Advanced Order Training', type: 'Archetype Feat', level: 12 }], activeFeatEffects: ['Seek Injustice'] }
  expect(senses(scourge, []).some(sense => sense.source === 'Seek Injustice')).toBe(false)
  expect(senses({ ...scourge, level: 11 }, []).some(sense => sense.source === 'Seek Injustice')).toBe(false)
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

describe('apex augmentations', () => {
  const apexAug = (id: string, name: string) => ({ id, entryId: name, name, slot: 'apex' })
  const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const sf = { ...base, systems: ['sf2e' as const], boosts: {}, abilities }

  it('raises only the chosen apex attribute to at least +4 or by 1', () => {
    const c = { ...sf, augmentations: [apexAug('a', 'Muscle Invigorator'), apexAug('b', 'Hypernerves')] }
    expect(computeAbilities(c, []).str).toBe(18)
    expect(computeAbilities({ ...c, apexAugmentationId: 'b' }, [])).toMatchObject({ str: 10, dex: 18 })
    expect(computeAbilities({ ...c, apexAugmentationId: 'none' }, []).str).toBe(10)
    expect(apexSkillBonus(c, 'Athletics')).toBe(3)
    expect(apexSkillBonus(c, 'Acrobatics')).toBe(3)
    expect(apexSkillBonus({ ...c, augmentations: [apexAug('p', 'Presence Intensifier')] }, 'Intimidation')).toBe(2)
  })
})

describe('Bard spellcasting', () => {
  const bard = { id: 'b', name: 'B', className: 'Bard', systems: ['pf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 } as Character
  it.each([[1, [5, 2]], [2, [5, 3]], [3, [5, 3, 2]], [19, [5, ...Array(9).fill(3), 1]]])(
    'derives spontaneous slots at level %i', (level, counts) => {
      expect(Object.values(classSpellSlots({ ...bard, level })!)).toEqual(counts)
    })
  it('adds two cantrips for Cantrip Expansion only once acquired', () => {
    const feats = [{ name: 'Cantrip Expansion', level: 2, type: 'Class Feat' }]
    expect(classSpellSlots({ ...bard, level: 2, feats })?.[0]).toBe(7)
    expect(classSpellSlots({ ...bard, level: 1, feats })?.[0]).toBe(5)
  })
  it('adds Cantrip Expansion cantrips for table-based casters', () => {
    const wizard = { ...bard, className: 'Wizard', level: 2 }
    const base = classSpellSlots(wizard)?.[0]
    expect(classSpellSlots({ ...wizard, feats: [{ name: 'Cantrip Expansion', level: 2, type: 'Class Feat' }] })?.[0]).toBe(base! + 2)
  })
  it('grants Soulsight spiritsense', () => {
    expect(senses({ ...bard, level: 8, feats: [{ name: 'Soulsight', level: 8, type: 'Class Feat' }] }, [])
      .map(sense => sense.value)).toContain('Spiritsense (imprecise) 60 feet')
  })
})

describe('Bard repertoire', () => {
  const bard = { id: 'b', name: 'B', className: 'Bard', systems: ['pf2e'], level: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 } as Character
  const feat = (name: string) => ({ name, level: 1, type: 'Class Feat' })
  it('gives Magnum Opus two rank-ten spells but one slot, and Perfect Encore a second slot', () => {
    expect(classRepertoireRows(bard)?.[10]).toBe(2)
    expect(classSpellSlots(bard)?.[10]).toBe(1)
    expect(classSpellSlots({ ...bard, feats: [feat('Perfect Encore')] })?.[10]).toBe(2)
    expect(classRepertoireRows({ ...bard, level: 18 })?.[10]).toBeUndefined()
  })
  it('adds Deep Lore spells per rank and fixed Faceless Trickster spells without extra slots', () => {
    const c = { ...bard, level: 18, feats: [feat('Deep Lore'), feat('Faceless Trickster')] }
    expect(classRepertoireRows(c)?.[9]).toBe(4)
    expect(classRepertoireRows(c)?.[1]).toBe(5)
    expect(classSpellSlots(c)?.[1]).toBe(3)
    expect(classExtraSlots(c).map(extra => extra.spell)).toEqual(['Pest Form', 'Animal Form'])
  })
})

it('labels Witches by their patron', () => {
  const witch = { id: 'w', name: 'W', className: 'Witch', systems: ['pf2e'], level: 1, subclass: 'The Resentment',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 } as Character
  expect(classLabel(witch)).toBe('Witch of the Resentment')
  expect(classLabel({ ...witch, subclass: "Faith's Flamekeeper" })).toBe("Witch of Faith's Flamekeeper")
})

it('scales the Runesmith repertoire and etched rune limit by level', () => {
  expect([1, 4, 5, 9, 17, 20].map(level => [runicRepertoireSize(level), maxEtchedRunes(level)]))
    .toEqual([[4, 2], [4, 2], [6, 3], [8, 4], [12, 6], [12, 6]])
})
