import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { armorRanks, classSpellcasting, classSpellSlots, eligibleFeats, featChoiceOptions, featPrerequisiteChecker, featSelectionPrerequisiteChecker, plannedSlots, ranksAt, spellDifficultyClass, weaponAttack, weaponRanks } from './builder'
import { getSettings, updateSettings } from './settings'
import { WeaponList } from './GearSection'
import { SpellsSection } from './SpellsSection'
import { homebrewCharacterOptions } from './supplemental'
import type { Character, ContentEntry } from './types'

const base: Character = { id: 'rogue', systems: ['pf2e'], name: 'Rogue', className: 'Rogue', subclass: 'Thief', level: 10,
  abilities: { str: 12, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
const rogue: ContentEntry = { id: 'rogue', name: 'Rogue', kind: 'class', source: 'official', systems: ['pf2e'], level: 0,
  traits: [], description: '', data: { light_armor_proficiency: 'Expert' }, effects: [], updatedAt: 0 }
const dagger: ContentEntry = { id: 'dagger', name: 'Dagger', kind: 'weapon', source: 'official', systems: ['pf2e'], level: 0,
  traits: ['Finesse'], description: '', data: { weapon_category: 'Simple', damage: '1d4 piercing' }, effects: [], updatedAt: 0 }

it('grants primary racket skills and thief damage without adding Dexterity to thrown strikes', () => {
  expect(ranksAt(base, [rogue]).Thievery).toBe(1)
  expect(weaponAttack(base, [dagger], { id: 'd', name: 'Dagger', potency: 0, striking: 0, runes: [] }).damage).toBe('2d4+4 piercing')
  const versatileThief = { ...base, subclass: 'Scoundrel',
    feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Thief' }] }
  expect(weaponAttack(versatileThief, [dagger], { id: 'd', name: 'Dagger', potency: 0, striking: 0, runes: [] }).damage)
    .toBe('2d4+4 piercing')
  const versatileAvenger = { ...base, subclass: 'Scoundrel',
    feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Avenger' }] }
  expect(weaponAttack(versatileAvenger, [dagger], { id: 'd', name: 'Dagger', potency: 0, striking: 0, runes: [] }).damage)
    .toBe('2d4+1 piercing')
  const agileOnly = { ...dagger, traits: ['Agile'] }
  expect(weaponAttack(base, [agileOnly], { id: 'd', name: 'Dagger', potency: 0, striking: 0, runes: [] }).damage)
    .toBe('2d4+1 piercing')
  const thrown = { ...dagger, traits: ['Finesse', 'Thrown'], data: { ...dagger.data, weapon_type: 'Ranged' } }
  expect(weaponAttack(base, [thrown], { id: 'd', name: 'Dagger', potency: 0, striking: 0, runes: [] }).damage).toBe('2d4+1 piercing')
})

it('scales Rogue weapon proficiency at levels 5 and 13 from its class features', () => {
  const klass: ContentEntry = { ...rogue, data: { attack_proficiency: 'Trained in simple weapons, Trained in martial weapons, Trained in unarmed attacks' } }
  const tricks: ContentEntry = { ...rogue, id: 'tricks', kind: 'classFeature', name: 'Weapon Tricks', level: 5,
    data: { class: 'Rogue' }, description: 'You gain expert proficiency in simple weapons, martial weapons, and unarmed attacks.' }
  const master: ContentEntry = { ...tricks, id: 'master-tricks', name: 'Master Tricks', level: 13,
    description: 'Your proficiency ranks increase to master for all simple weapons, martial weapons, and unarmed attacks.' }
  const entries = [klass, tricks, master, dagger]
  for (const [level, rank] of [[1, 1], [4, 1], [5, 2], [12, 2], [13, 3], [20, 3]]) {
    const c = { ...base, level }
    expect(weaponRanks(c, entries)).toEqual({ Simple: rank, Martial: rank, Advanced: 0, Unarmed: rank })
    expect(weaponAttack(c, entries, { id: 'd', name: 'Dagger', potency: 0, striking: 0, runes: [] }).rank).toBe(rank)
  }
})

it('auto-scales racket skills despite lower saved overrides, only after acquisition', () => {
  const settings = getSettings()
  try {
    updateSettings({ autoClassSkills: true })
    for (const [level, rank] of [[1, 1], [3, 2], [7, 3], [15, 4]]) {
      expect(ranksAt({ ...base, level, rankOverrides: { Thievery: 1 } }, [rogue]).Thievery).toBe(rank)
    }
    const c: Character = { ...base, level: 15, rankOverrides: { Thievery: 1, Intimidation: 1, Stealth: 2 },
      feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Ruffian' }] }
    expect(ranksAt(c, [rogue])).toMatchObject({ Thievery: 4, Intimidation: 4, Stealth: 2 })
    expect(ranksAt(c, [rogue], 10).Intimidation).toBe(1) // saved override, not the later racket
    expect(ranksAt({ ...c, rankOverrides: {} }, [rogue], 10).Intimidation).toBeUndefined()
    expect(ranksAt(c, [rogue], 11).Intimidation).toBe(3)
    expect(ranksAt({ ...c, rankOverrides: { Thievery: 4 } }, [rogue], 4).Thievery).toBe(4)
    const mastermind: Character = { ...base, level: 15, subclass: 'Scoundrel', rogueRacketSkills: { Mastermind: 'Nature' },
      feats: [{ ...c.feats[0], choice: 'Mastermind' }] }
    expect(ranksAt(mastermind, [rogue])).toMatchObject({ Deception: 4, Diplomacy: 4, Society: 4, Nature: 4 })
    updateSettings({ autoClassSkills: false })
    expect(ranksAt(c, [rogue])).toMatchObject({ Thievery: 1, Intimidation: 1 })
  } finally { updateSettings(settings) }
})

it('checks additional racket prerequisites at the level the feat was acquired', () => {
  const ruffian: ContentEntry = { ...rogue, id: 'ruffian', kind: 'subclass', name: 'Ruffian', data: { class: 'Rogue' } }
  const target: ContentEntry = { ...rogue, id: 'target', kind: 'feat', name: 'Ruffian Feat',
    traits: ['Rogue'], data: { prerequisite: 'ruffian racket' } }
  const c: Character = { ...base, level: 12, feats: [{ name: 'Versatile Rogue', type: 'Class Feat',
    level: 10, slot: 'class:10:0', choice: 'Ruffian' }] }
  expect(featPrerequisiteChecker(c, [ruffian], 9)(target).missing).toEqual(['ruffian racket'])
  expect(featPrerequisiteChecker(c, [ruffian], 10)(target).missing).toEqual([])
  expect(featPrerequisiteChecker({ ...c, level: 9 }, [ruffian])(target).missing).toEqual(['ruffian racket'])
  const brutal: ContentEntry = { ...target, id: 'brutal', name: 'Brutal Beating', level: 2 }
  expect(eligibleFeats([ruffian, brutal], c, { key: 'class:12:0', category: 'class', level: 12 })).toContain(brutal)
  expect(eligibleFeats([ruffian, brutal], c, { key: 'class:8:0', category: 'class', level: 8 })).toContain(brutal)
  expect(eligibleFeats([ruffian, brutal], { ...c, feats: [] }, { key: 'class:8:0', category: 'class', level: 8 })).not.toContain(brutal)
})

it('offers a different repeatable racket and its benefits without an extra skill feat slot', () => {
  const versatile = { name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Ruffian' }
  const c: Character = { ...base, feats: [versatile] }
  expect(homebrewCharacterOptions([]).find(entry => entry.name === versatile.name)?.data.repeatable).toBe(true)
  expect(featChoiceOptions(versatile.name, c, [rogue], 'class:10:0')).toEqual(['Avenger', 'Mastermind', 'Ruffian', 'Scoundrel'])
  expect(ranksAt(c, [rogue]).Intimidation).toBe(1)
  expect(armorRanks(c, [rogue]).Medium).toBe(2)
  expect(plannedSlots(c).filter(slot => slot.category === 'skill').map(slot => slot.level))
    .toEqual(Array.from({ length: c.level }, (_, index) => index + 1))
  expect(plannedSlots(c).some(slot => slot.grantedBy === 'Versatile Rogue')).toBe(false)
  expect(featChoiceOptions(versatile.name, { ...c, feats: [versatile, { ...versatile, slot: 'class:12:0', choice: 'Scoundrel' }] },
    [rogue], 'class:12:0')).toEqual(['Avenger', 'Mastermind', 'Scoundrel'])
  const duplicates = { ...base, level: 20, feats: [
    { ...versatile, choice: 'Thief' }, { ...versatile, slot: 'class:12:0' }, { ...versatile, slot: 'class:14:0' },
  ] }
  expect(plannedSlots(duplicates).some(slot => slot.grantedBy === 'Versatile Rogue')).toBe(false)
})

it('grants Avenger divine skill, medium armor and deity-favored weapon proficiency', () => {
  const deity: ContentEntry = { ...rogue, id: 'deity', kind: 'deity', name: 'Deity',
    data: { skill: 'Religion', favored_weapon: 'Sawtooth Saber' } }
  const saber: ContentEntry = { ...dagger, name: 'Sawtooth Saber', data: { ...dagger.data, weapon_category: 'Advanced' } }
  const c: Character = { ...base, deity: deity.name, feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10,
    slot: 'class:10:0', choice: 'Avenger' }] }
  expect(ranksAt(c, [rogue, deity]).Religion).toBe(1)
  expect(armorRanks(c, [rogue]).Medium).toBe(2)
  expect(weaponAttack(c, [rogue, deity, saber], { id: 'saber', name: saber.name, potency: 0, striking: 0, runes: [] }).rank).toBe(2)
  expect(weaponAttack({ ...c, level: 9 }, [rogue, deity, saber], { id: 'saber', name: saber.name, potency: 0, striking: 0, runes: [] }).rank).toBe(0)
  const withWeapon = { ...c, weapons: [{ id: 'saber', name: saber.name, potency: 0, striking: 0, runes: [] }] }
  const markup = renderToStaticMarkup(createElement(WeaponList, { c: withWeapon, entries: [rogue, deity, saber], save: () => {}, displayOnly: true }))
  expect(markup).toContain('critical specialization applies on a critical hit against an off-guard target')
  expect(markup).toContain('sneak attack applies to your prey')
})

it('trains Intimidation, Religion, and Stealth from the Avenger racket', () => {
  const avenger = { ...base, level: 1, subclass: 'Avenger', deity: undefined }
  expect(ranksAt(avenger, [rogue])).toMatchObject({ Intimidation: 1, Religion: 1, Stealth: 1 })
})

it('auto-scales the Avenger deity skill for primary and additional rackets', () => {
  const deity: ContentEntry = { ...rogue, id: 'deity', kind: 'deity', name: 'Deity', data: { skill: 'Arcana' } }
  const settings = getSettings()
  try {
    updateSettings({ autoClassSkills: true })
    for (const [level, rank] of [[1, 1], [3, 2], [7, 3], [15, 4]]) {
      expect(ranksAt({ ...base, level, subclass: 'Avenger', deity: deity.name }, [rogue, deity]).Arcana).toBe(rank)
    }
    const c: Character = { ...base, level: 15, deity: deity.name, feats: [{ name: 'Versatile Rogue',
      type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Avenger' }] }
    expect(ranksAt(c, [rogue, deity], 10).Arcana).toBeUndefined()
    expect(ranksAt(c, [rogue, deity], 11).Arcana).toBe(3)
    expect(ranksAt(c, [rogue, deity]).Arcana).toBe(4)
    expect(ranksAt({ ...c, deity: undefined }, [rogue, deity]).Arcana).toBeUndefined()
    updateSettings({ autoClassSkills: false })
    expect(ranksAt(c, [rogue, deity]).Arcana).toBe(1)
  } finally { updateSettings(settings) }
})

it('omits Ruffian weapon helper text in both weapon views', () => {
  const c: Character = { ...base, subclass: 'Ruffian' }
  const weapon = (id: string, category: string, damage: string): ContentEntry =>
    ({ ...dagger, id, name: id, data: { weapon_category: category, damage } })
  const entries = [weapon('Simple d8', 'Simple', '1d8 piercing'), weapon('Simple d10', 'Simple', '1d10 piercing'),
    weapon('Martial d6', 'Martial', '1d6 piercing'), weapon('Martial d8', 'Martial', '1d8 piercing')]
  const weapons = entries.map(entry => ({ id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] }))
  for (const displayOnly of [true, false]) {
    const markup = renderToStaticMarkup(createElement(WeaponList, { c: { ...c, weapons }, entries, save: () => {}, displayOnly }))
    expect(markup).not.toContain('Ruffian: this weapon')
    for (const weapon of entries) expect(markup).toContain(weapon.name)
  }
})

it('grants both Mastermind skills only after its skill choice', () => {
  const c = { ...base, subclass: 'Mastermind', rogueRacketSkills: { Mastermind: 'Occultism' } }
  expect(ranksAt(c, [rogue])).toMatchObject({ Society: 1, Occultism: 1 })
  expect(ranksAt({ ...c, rogueRacketSkills: { Mastermind: 'Acrobatics' } }, [rogue]).Acrobatics).toBeUndefined()
})

it('offers Eldritch Trickster with its spellcasting multiclass dedication slot', () => {
  const wizard: ContentEntry = { ...rogue, id: 'wizard', kind: 'feat', name: 'Wizard Dedication', level: 2,
    traits: ['Archetype', 'Dedication', 'Multiclass'], data: { archetype: 'Wizard' } }
  const casting: ContentEntry[] = ['Basic', 'Expert', 'Master'].map(tier => ({ ...wizard, id: tier,
    name: `${tier} Wizard Spellcasting`, traits: ['Archetype'], data: { archetype: 'Wizard' } }))
  const fighter: ContentEntry = { ...wizard, id: 'fighter', name: 'Fighter Dedication', data: { archetype: 'Fighter' } }
  const entries = [rogue, wizard, fighter, ...casting]
  expect(featChoiceOptions('Versatile Rogue', base, entries, 'class:10:0')).toContain('Eldritch Trickster')
  expect(featChoiceOptions('Versatile Rogue', base, entries, 'class:10:0'))
    .toEqual(['Avenger', 'Eldritch Trickster', 'Mastermind', 'Ruffian', 'Scoundrel'])
  const c: Character = { ...base, feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10,
    slot: 'class:10:0', choice: 'Eldritch Trickster' }] }
  const slot = plannedSlots(c).find(candidate => candidate.grantedBy === 'Eldritch Trickster')!
  expect(slot).toMatchObject({ category: 'archetype', level: 10, maxFeatLevel: 2 })
  expect(eligibleFeats(entries, c, slot).map(feat => feat.name)).toEqual(['Wizard Dedication'])
  expect(plannedSlots({ ...c, level: 9 }).some(candidate => candidate.grantedBy === 'Eldritch Trickster')).toBe(false)
  const primary = { ...base, level: 1, subclass: 'Eldritch Trickster' }
  const initialSlot = plannedSlots(primary).find(candidate => candidate.grantedBy === 'Eldritch Trickster')!
  expect(eligibleFeats(entries, primary, initialSlot).map(feat => feat.name)).toEqual(['Wizard Dedication'])
  const magical: ContentEntry = { ...wizard, id: 'magical', name: 'Magical Trickster', level: 4, traits: ['Rogue'], data: {} }
  expect(eligibleFeats([magical], { ...primary, level: 2 }, { key: 'class:2:0', category: 'class', level: 2 }))
    .toContain(magical)
})

it('uses the highest mental attribute for an Avenger’s Versatile Rogue dedication and cleric spells', () => {
  const settings = getSettings()
  const cleric: ContentEntry = { ...rogue, id: 'cleric', kind: 'feat', name: 'Cleric Dedication', level: 2,
    traits: ['Archetype', 'Dedication', 'Multiclass'], data: { archetype: 'Cleric', prerequisite: 'Wisdom +2' } }
  const clericCasting = ['Basic', 'Expert', 'Master'].map(tier => ({ ...cleric, id: tier,
    name: `${tier} Cleric Spellcasting`, traits: ['Archetype'], data: { archetype: 'Cleric' } }))
  const divineLance: ContentEntry = { ...rogue, id: 'divine-lance', kind: 'spell', name: 'Divine Lance', level: 1,
    traits: ['Cantrip', 'Attack'], data: { tradition: 'Divine', actions: 'Two Actions' } }
  const druidClass: ContentEntry = { ...rogue, id: 'druid-class', name: 'Druid', data: { tradition: 'Primal' } }
  const entries = [rogue, cleric, divineLance, druidClass, ...clericCasting]
  const versatile = { name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Eldritch Trickster' }
  const c: Character = { ...base, subclass: 'Avenger', deity: 'Sarenrae', abilities: { ...base.abilities, int: 14, wis: 10, cha: 18 },
    feats: [versatile] }
  const slot = plannedSlots(c).find(candidate => candidate.grantedBy === 'Eldritch Trickster')!
  const chosen: Character = { ...c, feats: [...c.feats, { name: cleric.name, type: 'Archetype Feat', level: 2,
    takenLevel: 10, slot: slot.key }], spellcasting: { ability: 'wis', tradition: 'Divine', rank: 1, slots: {},
    prepared: { '0:0': divineLance.id } } }
  try {
    updateSettings({ avengerEldritchHighestMental: true })
    expect(featSelectionPrerequisiteChecker(c, entries, slot)(cleric).missing).toEqual([])
    expect(featSelectionPrerequisiteChecker({ ...c, abilities: { ...c.abilities, int: 10, cha: 12 } }, entries, slot)(cleric).missing)
      .toContain('Wisdom +2')
    expect(featSelectionPrerequisiteChecker({ ...c, subclass: 'Thief' }, entries, slot)(cleric).missing).toContain('Wisdom +2')
    expect(classSpellSlots(chosen)).toEqual({ 0: 2 })
    expect(classSpellcasting(chosen, entries)).toEqual({ traditions: ['Divine'], ability: 'cha', rank: 1 })
    expect(spellDifficultyClass(chosen, entries)).toBe(26)
    const wizard: Character = { ...chosen, feats: [versatile, { ...chosen.feats[1], name: 'Wizard Dedication' }] }
    expect(classSpellSlots(wizard)).toEqual({ 0: 2 })
    expect(classSpellcasting(wizard, entries)).toEqual({ traditions: ['Arcane'], ability: 'cha', rank: 1 })
    const druid: Character = { ...chosen, feats: [versatile, { ...chosen.feats[1], name: 'Druid Dedication' }],
      spellcasting: { ...chosen.spellcasting!, tradition: 'Primal' } }
    expect(classSpellcasting(druid, entries)).toEqual({ traditions: ['Primal'], ability: 'cha', rank: 1 })
    const newDruid = { ...druid, spellcasting: undefined }
    expect(classSpellcasting(newDruid, entries)).toEqual({ traditions: ['Primal'], ability: 'cha', rank: 1 })
    expect(renderToStaticMarkup(createElement(SpellsSection, { c: newDruid, entries, save: () => {} })))
      .toContain('Spell slots:')
    const markup = renderToStaticMarkup(createElement(SpellsSection, { c: chosen, entries, save: () => {} }))
    expect(markup).toContain('Divine Lance')
    expect(markup).toContain('aria-label="Cantrip slot 2"')
    expect(markup).toContain('<small>Charisma</small>+4')
    const progressed: Character = { ...chosen, level: 12, feats: [...chosen.feats,
      { name: 'Basic Cleric Spellcasting', type: 'Archetype Feat', level: 4, takenLevel: 10 },
      { name: 'Expert Cleric Spellcasting', type: 'Archetype Feat', level: 12 }] }
    expect(classSpellSlots(progressed)).toEqual({ 0: 2, 1: 1, 2: 1, 3: 1, 4: 1 })
    expect(classSpellcasting(progressed, entries)?.rank).toBe(2)
    updateSettings({ avengerEldritchHighestMental: false })
    expect(featSelectionPrerequisiteChecker(c, entries, slot)(cleric).missing).toContain('Wisdom +2')
    expect(classSpellcasting(chosen, entries)?.ability).toBe('wis')
    expect(classSpellcasting(wizard, entries)?.ability).toBe('int')
    expect(classSpellcasting(druid, entries)?.ability).toBe('wis')
    expect(spellDifficultyClass(chosen, entries)).toBe(22)
  } finally { updateSettings(settings) }
})
