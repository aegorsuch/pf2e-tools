import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { armorClass, armorEntry, armorGauntlet, armorProficiencyRank, armorSpecialization, blessedShieldBenefit, defenseSummary, effectiveWeapon, eligibleFeats, equippedShield, featChoiceOptions, featPrerequisiteChecker, hardwoodShield, inventorBuckler, isLockedWeapon, ownedArmors, ownedWeapons, perceptionItemBonus, shieldChange, shieldEquipChange, shieldMaterial, shieldMaterialOptions, shieldRaisedChange, shieldStats, wornArmor } from './builder'
import { ArmorList, WeaponList } from './GearSection'
import { SkillsSection } from './SkillsSection'
import { ARMIGER_ARMOR_ID, BONY_PLATES_ID, grantedArmorEntries, HARDWOOD_ARMOR_ID, INVENTOR_ARMOR_ID } from './grantedArmor'
import { homebrewCharacterOptions } from './supplemental'
import type { Character, ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'

const base: Character = {
  id: 'armor', systems: ['pf2e'], name: 'Armor test', level: 1,
  abilities: { str: 16, dex: 18, con: 12, int: 14, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const feat = (name: string, choice?: string, level = 1): Character['feats'][number] =>
  ({ name, choice, level, type: 'Ancestry Feat' })
const plateClass = (data: ContentEntry['data']): ContentEntry => ({
  id: 'plate-class', kind: 'class', name: 'Plate Test', systems: ['pf2e'], source: 'official',
  level: 1, traits: [], description: '', data, effects: [], updatedAt: 0,
})

it.each([
  [{ unarmored_proficiency: 'Expert', light_armor_proficiency: 'Trained' }, 'Unarmored', 0, 5, 0, 0, 0, 2, 19],
  [{ unarmored_proficiency: 'Trained', light_armor_proficiency: 'Trained' }, 'Light', 2, 3, -1, 0, 1, 1, 18],
  [{ light_armor_proficiency: 'Expert', medium_armor_proficiency: 'Expert', heavy_armor_proficiency: 'Trained' }, 'Medium', 4, 1, -2, -5, 3, 2, 20],
  [{ unarmored_proficiency: 'Trained', medium_armor_proficiency: 'Trained', heavy_armor_proficiency: 'Trained' }, 'Heavy', 6, 0, -3, -10, 4, 1, 19],
  [{}, 'Unarmored', 0, 5, 0, 0, 0, 0, 14],
] as const)('automatically assigns Bony Plates profile %s as %s without a category choice', (data, category, ac, dex, check, speed, strength, rank, total) => {
  const c: Character = { ...base, ancestry: 'Lizardfolk', heritage: 'Wetlander Lizardfolk',
    className: 'Plate Test', feats: [feat('Bony Plates')] }
  const entries = [plateClass(data)]
  const armor = armorEntry(c, entries, 'Bony Plates')!
  expect(armor).toMatchObject({ id: BONY_PLATES_ID, source: 'homebrew', traits: ['Aquadynamic', 'Comfort'],
    data: { armor_category: category, armor_group: 'Plate', ac, dex_cap: dex, check_penalty: check,
      speed_penalty: speed, strength, attached: true, highest_armor_proficiency: true } })
  expect(armorProficiencyRank(c, entries, armor)).toBe(rank)
  expect(armorClass(c, entries)).toBe(total)
  expect(featChoiceOptions('Bony Plates', c, entries, 'ancestry:1:0')).toBeUndefined()
  expect(armorSpecialization(c, entries)).toBeUndefined()
})

it('reassigns plate categories when class proficiency progresses without storing a category', () => {
  const klass = plateClass({ light_armor_proficiency: 'Trained', medium_armor_proficiency: 'Trained', heavy_armor_proficiency: 'Trained' })
  const expertise: ContentEntry = { ...klass, id: 'expertise', kind: 'classFeature', name: 'Unarmored Expertise', level: 7,
    data: { class: klass.name }, description: 'Your proficiency rank for unarmored defense increases to expert.' }
  const entries = [klass, expertise]
  const c: Character = { ...base, className: klass.name, ancestry: 'Lizardfolk', feats: [feat('Bony Plates')] }
  expect(armorEntry(c, entries, 'Bony Plates')?.data.armor_category).toBe('Heavy')
  expect(armorEntry({ ...c, level: 7 }, entries, 'Bony Plates')?.data.armor_category).toBe('Unarmored')
  expect(armorEntry({ ...c, level: 6 }, entries, 'Bony Plates')?.data.armor_category).toBe('Heavy')
})

it('offers Bony Plates to other Lizardfolk without granting Bakuwa feat eligibility', () => {
  const entries = homebrewCharacterOptions([])
  const plates = entries.find(entry => entry.id === 'homebrew:bony-plates')!
  const c: Character = { ...base, ancestry: 'Lizardfolk', heritage: 'Wetlander Lizardfolk' }
  const slot = { category: 'ancestry' as const, key: 'ancestry:1:0', level: 1 }
  expect(eligibleFeats(entries, c, slot)).toContain(plates)
  expect(eligibleFeats(entries, { ...c, ancestry: 'Human' }, slot)).not.toContain(plates)
  expect(eligibleFeats(entries, { ...c, heritage: 'Bakuwa Lizardfolk' }, slot)).not.toContain(plates)
  const bakuwa: ContentEntry = { ...plates, id: 'bakuwa', kind: 'heritage', name: 'Bakuwa Lizardfolk' }
  const mooneater: ContentEntry = { ...plates, id: 'mooneater', name: 'Mooneater', level: 17,
    data: { prerequisite: 'Bakuwa Lizardfolk heritage' } }
  expect(featPrerequisiteChecker({ ...c, level: 20, feats: [feat('Bony Plates')] }, [...entries, bakuwa, mooneater])(mooneater).missing)
    .toEqual(['Bakuwa Lizardfolk heritage'])
  expect(featPrerequisiteChecker({ ...c, level: 20, heritage: bakuwa.name }, [...entries, bakuwa, mooneater])(mooneater))
    .toEqual({ missing: [], manual: [] })
  expect(grantedArmorEntries({ ...c, feats: [feat('Bony Plates', undefined, 5)] })).toEqual([])
  expect(grantedArmorEntries({ ...c, systems: ['sf2e'], feats: [feat('Bony Plates')] })).toEqual([])
})

it.each([
  [4, 0, 0, [], 0],
  [5, 1, 0, ['Moonweave'], 0],
  [7, 1, 0, ['Moonweave', 'Sunweave'], 1],
  [8, 1, 1, ['Moonweave', 'Sunweave'], 1],
  [11, 2, 1, ['Moonweave', 'Sunweave (Greater)'], 2],
  [12, 2, 1, ['Moonweave', 'Sunweave (Greater)', 'Fortification'], 2],
  [13, 2, 1, ['Moonweave (Greater)', 'Sunweave (Greater)', 'Fortification'], 2],
  [14, 2, 2, ['Moonweave (Greater)', 'Sunweave (Greater)', 'Fortification'], 2],
  [17, 2, 2, ['Moonweave (Major)', 'Sunweave (Greater)', 'Fortification'], 2],
  [18, 3, 2, ['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)'], 3],
  [20, 3, 3, ['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)'], 3],
] as const)('scales plate fundamentals and granted property runes at level %i without persisting grants', (level, potency, resilient, runes, perception) => {
  const c: Character = { ...base, ancestry: 'Lizardfolk', heritage: 'Bakuwa Lizardfolk', className: 'Plate Test', level }
  const entries = [plateClass({ medium_armor_proficiency: 'Trained' })]
  const before = JSON.stringify(c)
  expect(wornArmor(c, entries)).toMatchObject({ id: BONY_PLATES_ID, name: 'Bony Plates', material: undefined, potency, resilient, runes })
  expect(perceptionItemBonus(c, entries)).toBe(perception)
  expect(armorEntry(c, entries, 'Bony Plates')?.data.strength).toBe(level >= 12 ? 4 : 3)
  expect(JSON.stringify(c)).toBe(before)
})

it.each(['Unarmored', 'Light', 'Medium', 'Heavy'] as const)('grants Fortification only to medium or heavy plates, not %s', category => {
  const key = category === 'Unarmored' ? 'unarmored_proficiency' : `${category.toLowerCase()}_armor_proficiency`
  const c: Character = { ...base, className: 'Plate Test', ancestry: 'Lizardfolk', feats: [feat('Bony Plates')], level: 20 }
  const entries = [plateClass({ [key]: 'Master' })]
  expect(wornArmor(c, entries)?.runes.includes('Fortification (Greater)')).toBe(['Medium', 'Heavy'].includes(category))
  const specialization: ContentEntry = { ...entries[0], id: 'spec', kind: 'feat', name: 'Armor Specialization',
    data: { grants_armor_specialization: true } }
  const plate: ContentEntry = { ...specialization, id: 'plate', name: 'Plate', kind: 'armorGroup', data: {} }
  expect(armorSpecialization(c, [...entries, specialization, plate])).toBeUndefined()
  const specialized = armorSpecialization({ ...c, feats: [...c.feats, feat(specialization.name)] }, [...entries, specialization, plate])
  if (category === 'Medium' || category === 'Heavy') {
    expect(specialized?.benefit).toMatchObject({ damage: 'Slashing', value: category === 'Heavy' ? 5 : 4 })
  } else expect(specialized?.benefit).toBeUndefined()
})

it('locks Bakuwa property runes to three proficiency-appropriate automatic families', () => {
  let c: Character = { ...base, ancestry: 'Lizardfolk', heritage: 'Bakuwa Lizardfolk', className: 'Plate Test', level: 20,
    armors: [{ id: BONY_PLATES_ID, name: 'Bakuwa Plates', material: 'Orichalcum', worn: true,
      potency: 2, resilient: 1, runes: ['Shadow', 'Moonweave', 'Fortification'] },
    { id: 'ordinary', name: 'Chain Mail', worn: true, potency: 1, resilient: 1, runes: [] }] }
  const entries = [plateClass({ medium_armor_proficiency: 'Master' })]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => ArmorList({ c, entries, save })
  const card = find(tree(), element => element.type === 'article'
    && !!find(element.props.children as ReactNode, child => child.props.name === 'Bony Plates'))!
  const markup = renderToStaticMarkup(card)
  expect(markup).not.toContain('Material')
  expect(markup).not.toContain('Potency')
  expect(markup).not.toContain('Resilient')
  expect(markup).not.toContain('Remove Moonweave')
  expect(markup).not.toContain('Remove Sunweave')
  expect(markup).not.toContain('Remove Fortification')
  expect(markup).toContain('Granted by Bony Plates')
  expect(markup).not.toContain('aria-label="Add property rune"')
  expect(markup).not.toContain('aria-label="Remove Bony Plates"')
  expect(ownedArmors(c, entries).find(armor => armor.id === 'ordinary')?.worn).toBe(false)
  expect(wornArmor(c, entries)?.runes).toEqual(['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)'])
  expect(c.armors?.find(armor => armor.id === BONY_PLATES_ID)?.runes).toEqual(['Shadow', 'Moonweave', 'Fortification'])
  const unarmored = [plateClass({ unarmored_proficiency: 'Master' })]
  expect(wornArmor(c, unarmored)?.runes).toEqual(['Moonweave (Major)', 'Sunweave (Major)', 'Shadow (Major)'])
  expect(wornArmor({ ...c, heritage: 'Wetlander Lizardfolk', feats: [feat('Bony Plates')] }, entries)?.runes)
    .toEqual(['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)'])
})

it('grants locked Orichalcum Hellknight armor by wearable category and scales fundamentals without replacing owned gear', () => {
  const klass: ContentEntry = { id: 'armiger-class', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger',
    level: 1, traits: [], description: '', effects: [], updatedAt: 0,
    data: { light_armor_proficiency: 'Trained', medium_armor_proficiency: 'Trained' } }
  const c: Character = { ...base, className: 'Ranger', level: 4, feats: [feat('Ardent Armiger', undefined, 4)],
    armors: [{ id: 'ordinary', name: 'Leather', potency: 0, resilient: 0, runes: [], worn: true }] }
  const before = JSON.stringify(c)
  const armor = ownedArmors(c, [klass]).find(armor => armor.id === ARMIGER_ARMOR_ID)!
  expect(armor).toMatchObject({ name: 'Hellknight Breastplate', material: 'Orichalcum', potency: 0, resilient: 0, worn: false })
  const upgraded: Character = { ...c, level: 11, feats: [...c.feats, feat('Armor Proficiency', undefined, 5)],
    armors: [...c.armors!, { ...armor, worn: false, runes: ['Shadow'] }] }
  expect(ownedArmors(upgraded, [klass]).find(armor => armor.id === ARMIGER_ARMOR_ID))
    .toMatchObject({ name: 'Hellknight Plate', potency: 2, resilient: 1, material: 'Orichalcum',
      runes: ['Shadow', 'Moonweave', 'Sunweave (Greater)', 'Advancing'] })
  expect(ownedArmors({ ...upgraded, level: 20 }, [klass]).find(armor => armor.id === ARMIGER_ARMOR_ID))
    .toMatchObject({ potency: 3, resilient: 3 })
  const markup = renderToStaticMarkup(<ArmorList c={upgraded} entries={[klass]} save={() => {}} part="armor" />)
  expect(markup).not.toContain('aria-label="Remove Hellknight Plate"')
  expect(markup).not.toContain('aria-label="Remove Orichalcum material"')
  expect(ownedArmors({ ...c, level: 3 }, [klass]).some(armor => armor.id === ARMIGER_ARMOR_ID)).toBe(false)
  expect(ownedArmors({ ...c, feats: [] }, [klass]).some(armor => armor.id === ARMIGER_ARMOR_ID)).toBe(false)
  expect(ownedArmors(c, []).some(armor => armor.id === ARMIGER_ARMOR_ID)).toBe(false)
  expect(JSON.stringify(c)).toBe(before)
})

it.each([
  [4, []],
  [5, ['Moonweave']],
  [7, ['Moonweave', 'Sunweave']],
  [9, ['Moonweave', 'Sunweave', 'Advancing']],
  [11, ['Moonweave', 'Sunweave (Greater)', 'Advancing']],
  [12, ['Moonweave', 'Sunweave (Greater)', 'Fortification', 'Advancing']],
  [13, ['Moonweave (Greater)', 'Sunweave (Greater)', 'Fortification', 'Advancing']],
  [16, ['Moonweave (Greater)', 'Sunweave (Greater)', 'Fortification', 'Advancing (Greater)']],
  [17, ['Moonweave (Major)', 'Sunweave (Greater)', 'Fortification', 'Advancing (Greater)']],
  [18, ['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)', 'Advancing (Greater)']],
] as const)('scales Ardent Armiger armor runes at level %i', (level, runes) => {
  for (const [proficiency, name, strength, bulk] of [
    ['medium_armor_proficiency', 'Hellknight Breastplate', 3, 2],
    ['heavy_armor_proficiency', 'Hellknight Plate', 4, 4],
  ] as const) {
    const klass = plateClass({ [proficiency]: 'Trained' })
    const c: Character = { ...base, level, className: klass.name, feats: [feat('Ardent Armiger', undefined, 4)] }
    const armor = ownedArmors(c, [klass]).find(item => item.id === ARMIGER_ARMOR_ID)!
    expect(armor.runes).toEqual(runes)
    expect(armorEntry(c, [klass], name, armor.id)?.data).toMatchObject({
      strength: strength + (level >= 12 ? 1 : 0), bulk: bulk + (level >= 12 ? 1 : 0),
    })
    expect(perceptionItemBonus(c, [klass])).toBe(level >= 18 ? 3 : level >= 11 ? 2 : level >= 7 ? 1 : 0)
  }
})

it('keeps granted runes locked and saved duplicates dormant without affecting ordinary Hellknight armor', () => {
  const klass = plateClass({ heavy_armor_proficiency: 'Trained' })
  const plate: ContentEntry = { ...klass, id: 'plate', kind: 'armor', name: 'Hellknight Plate',
    data: { armor_category: 'Heavy', armor_group: 'Plate', strength: 4, bulk: 4, ac: 6 } }
  const saved = { id: ARMIGER_ARMOR_ID, name: plate.name, material: 'Orichalcum' as const,
    worn: false, potency: 0, resilient: 0, runes: ['Moonweave (Greater)', 'Shadow'] }
  const ordinary = { ...saved, id: 'ordinary', worn: true, runes: [] }
  const c: Character = { ...base, level: 12, className: klass.name, feats: [feat('Ardent Armiger', undefined, 4)],
    armors: [saved, ordinary] }
  const all = [klass, plate]
  const granted = ownedArmors(c, all).find(armor => armor.id === ARMIGER_ARMOR_ID)!
  expect(granted.runes).toEqual(['Shadow', 'Moonweave', 'Sunweave (Greater)', 'Fortification', 'Advancing'])
  expect(armorEntry(c, all, plate.name, ordinary.id)?.data).toMatchObject({ strength: 4, bulk: 4 })
  expect(armorEntry(c, all, plate.name, granted.id)?.data).toMatchObject({ strength: 5, bulk: 5 })
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={all} save={() => {}} part="armor" />)
  expect(markup).toContain('Granted by Ardent Armiger')
  expect(markup).not.toContain('aria-label="Remove Moonweave rune"')
  expect(saved.runes).toEqual(['Moonweave (Greater)', 'Shadow'])
  let patch: Partial<Character> = {}
  const tree = ArmorList({ c, entries: all, save: change => { patch = change }, part: 'armor' })
  const toggle = find(tree, element => element.type === 'input' && element.props['aria-label'] === 'Worn Hellknight Plate')!
  ;(toggle.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } })
  expect(patch.armors?.find(armor => armor.id === ARMIGER_ARMOR_ID)?.runes).toEqual(['Shadow', 'Moonweave (Greater)'])
  expect(ownedArmors({ ...c, level: 4 }, all).find(armor => armor.id === ARMIGER_ARMOR_ID)?.runes)
    .toEqual(['Moonweave (Greater)', 'Shadow'])
})

it.each([
  ['Kashrishi', 'Tough Skin', 'pf2e'],
  ['Automaton', 'Reinforced Chassis', 'pf2e'],
  ['Copaxi', 'Armored Shell', 'sf2e'],
] as const)('applies selected %s body armor feats through Adopted Ancestry', (ancestry, name, system) => {
  const c: Character = { ...base, systems: [system], ancestry: 'Human', feats: [
    { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: ancestry }, feat(name),
  ] }
  const native = grantedArmorEntries({ ...c, ancestry, feats: [feat(name)] })
  const adopted = grantedArmorEntries(c)
  expect(adopted).toHaveLength(1)
  expect(adopted[0].data).toEqual(native[0].data)
  expect(adopted[0].name).toBe(native[0].name)
  expect(grantedArmorEntries({ ...c, level: 0 })).toEqual([])
})
it('does not grant inherited body armor merely from adopting its ancestry', () => {
  const c: Character = { ...base, ancestry: 'Human',
    feats: [{ name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Conrasu' }] }
  expect(grantedArmorEntries(c)).toEqual([])
})

it.each(['Ranger', 'Druid', 'Kineticist'])('grants locked, scaling Hardwood Armor to %s without replacing owned gear', className => {
  const c: Character = { ...base, className, level: 11, feats: [feat('Hardwood Armor')],
    armors: [{ id: 'existing', name: 'Chain Mail', worn: false, potency: 1, resilient: 0, runes: [] }] }
  const armor = ownedArmors(c, []).find(item => item.id === HARDWOOD_ARMOR_ID)
  expect(armor).toMatchObject({ name: className === 'Kineticist' ? 'Hardwood Armor' : 'Wooden Breastplate',
    potency: 2, resilient: 1, material: 'Duskwood (Standard-Grade)' })
  expect(ownedArmors(c, []).some(item => item.id === 'existing')).toBe(true)
  expect(ownedArmors({ ...c, level: 20 }, [])[0]).toMatchObject({ potency: 3, resilient: 3, material: 'Duskwood (High-Grade)' })
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />))
    .not.toContain('aria-label="Remove Duskwood (Standard-Grade) material"')
  expect(ownedArmors({ ...c, feats: [] }, []).some(item => item.id === HARDWOOD_ARMOR_ID)).toBe(false)
  expect(!!hardwoodShield(c)).toBe(className !== 'Ranger')
})

it('preserves ordinary shields while generated hardwood shield is equipped and raised', () => {
  const ordinary = { id: 'ordinary', name: 'Steel Shield', hardness: 5, hp: 20, damage: 2, raised: false }
  let c: Character = { ...base, className: 'Druid', level: 10, feats: [feat('Hardwood Armor')], shield: ordinary }
  expect(equippedShield(c)?.id).toBe('ordinary')
  c = { ...c, hardwoodShield: { equipped: true } }
  expect(hardwoodShield(c)).toMatchObject({ hardness: 6, hp: 24 })
  c = { ...c, ...shieldRaisedChange(c, true) }
  expect(equippedShield(c)).toMatchObject({ id: 'granted-shield:hardwood', raised: true })
  expect(c.shield).toEqual(ordinary)
  expect(equippedShield({ ...c, feats: [] })).toEqual(ordinary)
})

it('applies shield material and reinforcing rune durability without lowering higher base stats', () => {
  const entry: ContentEntry = { id: 'cold-iron', kind: 'item', name: 'Cold Iron Shield (Standard-Grade)', systems: ['pf2e'], source: 'official',
    level: 7, traits: [], data: { item_subcategory: 'Precious Material Shields' },
    description: 'The shield has Hardness 7, HP 28, and BT 14.', effects: [], updatedAt: 0 }
  const buckler = { ...entry, id: 'buckler', name: 'Cold Iron Buckler (Standard-Grade)' }
  const tower = { ...entry, id: 'tower', name: 'Duskwood Tower Shield (High-Grade)' }
  const shield = { id: 'ordinary', name: 'Steel Shield', hardness: 5, hp: 20, damage: 2, raised: false }
  expect(shieldMaterialOptions([entry, buckler, tower], shield, ['pf2e'])).toEqual([entry])
  expect(shieldMaterialOptions([entry, buckler, tower], { ...shield, name: 'Buckler' }, ['pf2e'])).toEqual([buckler])
  expect(shieldMaterialOptions([entry, buckler, tower], { ...shield, name: 'Tower Shield' }, ['pf2e'])).toEqual([tower])
  const material = shieldMaterial(entry)
  expect(material).toEqual({ name: entry.name, hardness: 7, hp: 28 })
  expect(shieldStats({ ...shield, material, reinforcingRune: 'Minor' })).toEqual({ hardness: 8, hp: 64 })
  expect(shieldStats({ ...shield, reinforcingRune: 'Supreme' })).toEqual({ hardness: 12, hp: 128 })
  expect(shieldStats({ ...shield, hardness: 12, hp: 100, reinforcingRune: 'Minor' })).toEqual({ hardness: 12, hp: 100 })
  expect(shieldStats({ ...shield, material: { name: 'Unknown' } })).toEqual({ hardness: 5, hp: 20 })
})

it('saves shield material and runes separately from base stats, including granted shields', () => {
  const entry: ContentEntry = { id: 'cold-iron', kind: 'item', name: 'Cold Iron Shield (Standard-Grade)', systems: ['pf2e'], source: 'official',
    level: 7, traits: [], data: { item_subcategory: 'Precious Material Shields' },
    description: 'The shield has Hardness 7, HP 28, and BT 14.', effects: [], updatedAt: 0 }
  let c: Character = { ...base, className: 'Druid', level: 10, feats: [feat('Hardwood Armor')],
    shield: { id: 'ordinary', name: 'Steel Shield', hardness: 5, hp: 20, damage: 2, raised: false } }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => ArmorList({ c, entries: [entry], save, part: 'shield' })
  const materialPicker = find(tree(), element => element.props['aria-label'] === 'Shield material')
  ;(materialPicker?.props.onChange as (event: unknown) => void)({ target: { value: entry.id } })
  expect(c.shield?.material).toEqual({ name: entry.name, hardness: 7, hp: 28 })
  const runeControls = Children.toArray(tree().props.children)
  expect(runeControls.length).toBeGreaterThan(0)
  const runeControl = find(tree(), element => 'rune' in element.props && typeof element.props.onChange === 'function')
  ;(runeControl?.props.onChange as (rune: string) => void)('Minor')
  expect(c.shield?.reinforcingRune).toBe('Minor')
  expect(c.shield).toMatchObject({ hardness: 5, hp: 20, damage: 2 })
  expect(renderToStaticMarkup(tree())).toContain('Hardness 8; Hit Points 64; Broken Threshold 32.')
  const generatedControl = find(tree(), element => 'rune' in element.props && element.props.rune === undefined
    && typeof element.props.onChange === 'function')
  ;(generatedControl?.props.onChange as (rune: string) => void)('Greater')
  expect(c.hardwoodShield?.reinforcingRune).toBe('Greater')
  expect(shieldStats(hardwoodShield(c)!)).toEqual({ hardness: 11, hp: 104 })
  expect(JSON.parse(JSON.stringify(c)).shield).toEqual(c.shield)
})

it.each([
  [3, 'Minor', 8, 64], [6, 'Minor', 8, 64], [7, 'Lesser', 8, 72],
  [10, 'Moderate', 8, 84], [13, 'Greater', 10, 100],
  [16, 'Major', 10, 104], [19, 'Supreme', 12, 128],
] as const)('automatically applies Blessed Shield at level %i', (level, rune, hardness, hp) => {
  const shield = { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, damage: 2, raised: false }
  const c: Character = { ...base, level, className: 'Champion', blessing: 'Blessed Shield', shield }
  expect(blessedShieldBenefit(c, shield)).toEqual({ rune, hardness: 0 })
  expect(shieldStats(shield, c)).toEqual({ hardness, hp })
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} part="shield" />)
  expect(markup).toContain(`Reinforcing Rune (${rune})`)
  expect(markup).toContain(`Hardness ${hardness}; Hit Points ${hp}; Broken Threshold ${hp / 2}.`)
  expect(markup).toContain('Granted by Blessed Shield')
  expect(markup).not.toContain(`aria-label="Remove Reinforcing Rune (${rune}) rune"`)
  expect(c.shield).toEqual(shield)
  expect(c.shield?.reinforcingRune).toBeUndefined()
})

it('uses +1 Hardness for matching reinforcement or sturdy shields without stacking free runes', () => {
  const shield = { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false, reinforcingRune: 'Moderate' as const }
  const c: Character = { ...base, level: 10, className: 'Champion', blessing: 'Blessed Shield', shield }
  expect(shieldStats(shield, c)).toEqual({ hardness: 9, hp: 84 })
  const sturdy = { ...shield, name: 'Sturdy Shield (Moderate)', hardness: 13, hp: 104, reinforcingRune: undefined }
  expect(shieldStats(sturdy, { ...c, shield: sturdy })).toEqual({ hardness: 14, hp: 104 })
  expect(shieldStats({ ...sturdy, name: 'Sturdy Shield (Lesser)', hardness: 10, hp: 80 }, c)).toEqual({ hardness: 13, hp: 104 })
  expect(shieldStats({ ...shield, reinforcingRune: 'Supreme' }, c)).toEqual({ hardness: 12, hp: 128 })
  expect(shieldStats({ ...shield, reinforcingRune: 'Minor' }, c)).toEqual({ hardness: 8, hp: 84 })
})

it('applies selected extra blessings only when available and to the wielded shield', () => {
  const shield = { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false }
  const c: Character = { ...base, level: 8, className: 'Champion', blessing: 'Blessed Armament', shield,
    feats: [{ name: 'Second Blessing', level: 8, type: 'Class Feat', choice: 'Blessed Shield' }] }
  expect(shieldStats(shield, c)).toEqual({ hardness: 8, hp: 72 })
  expect(shieldStats(shield, { ...c, level: 7 })).toEqual({ hardness: 5, hp: 20 })
  expect(shieldStats(shield, { ...c, className: 'Fighter' })).toEqual({ hardness: 5, hp: 20 })
  expect(shieldStats(shield, { ...c, feats: [] })).toEqual({ hardness: 5, hp: 20 })
  expect(shieldStats({ ...shield, id: 'unequipped' }, c)).toEqual({ hardness: 5, hp: 20 })
})

it('does not recreate retired Hardwood Armor homebrew or modify the official feat', () => {
  const original: ContentEntry = { id: 'hardwood', kind: 'feat', name: 'Hardwood Armor', systems: ['pf2e'], source: 'official',
    level: 1, traits: ['Impulse', 'Kineticist', 'Wood', 'Primal'], data: {}, description: '', effects: [], updatedAt: 0 }
  expect(homebrewCharacterOptions([original]).some(entry => entry.name === 'Hardwood Armor')).toBe(false)
  expect(original).toMatchObject({ source: 'official', traits: ['Impulse', 'Kineticist', 'Wood', 'Primal'] })
})

function find(node: ReactNode, predicate: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Record<string, unknown>>(child)) continue
    if (predicate(child)) return child
    const found = find(child.props.children as ReactNode, predicate)
    if (found) return found
  }
}

it.each([
  ['Automaton', undefined, 'Reinforced Chassis', 'Reinforced Chassis'],
  ['Conrasu', 'Rite of Reinforcement', undefined, 'Reinforced Exoskeleton'],
  ['Kashrishi', 'Lethoci', 'Tough Skin', 'Tough Skin'],
  ['Surki', 'Hardshell Surki', undefined, 'Hardshell Carapace'],
  ['Nagaji', 'Titan Nagaji', undefined, 'Titan Scales'],
] as const)('automatically equips attached armor for %s without modifying saved data', (ancestry, heritage, name, armorName) => {
  const c: Character = { ...base, ancestry, heritage, feats: name ? [feat(name)] : [] }
  const original = JSON.stringify(c)
  expect(ownedArmors(c, [])).toHaveLength(1)
  expect(wornArmor(c)).toMatchObject({ name: armorName, worn: true })
  expect(armorEntry(c, [], armorName)?.data).toMatchObject({ attached: true, armor_category: 'Medium', armor_group: 'Plate', dex_cap: 1 })
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('aria-label="Armor material"')
  expect(markup).not.toContain(`aria-label="Remove ${armorName}"`)
  expect(JSON.stringify(c)).toBe(original)
})

it.each([
  [1, 0, 0, 3], [5, 1, 0, 4], [8, 1, 1, 4], [11, 2, 1, 5],
  [14, 2, 2, 5], [18, 3, 2, 5], [20, 3, 3, 5],
])('scales chassis fundamentals and base AC at level %i with locked Orichalcum', (level, potency, resilient, ac) => {
  const c: Character = { ...base, ancestry: 'Automaton', feats: [feat('Reinforced Chassis')], level }
  expect(wornArmor(c)).toMatchObject({ material: 'Orichalcum', potency, resilient })
  expect(grantedArmorEntries(c)[0].data.ac).toBe(ac)
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('>Orichalcum</button>')
  expect(markup).not.toContain('Remove Orichalcum material')
})

it('uses body armor AC, Dexterity cap, and actual medium armor proficiency', () => {
  const c: Character = { ...base, level: 10, className: 'Fighter', ancestry: 'Nagaji', heritage: 'Titan Nagaji' }
  const fighter: ContentEntry = {
    id: 'fighter', kind: 'class', name: 'Fighter', systems: ['pf2e'], source: 'official', level: 0,
    description: '', traits: [], data: { medium_armor_proficiency: 'Expert' }, effects: [], updatedAt: 0,
  }
  expect(armorClass(c, [fighter])).toBe(30)
})

it('preserves ordinary armor and dormant granted configuration when eligibility changes', () => {
  let c: Character = { ...base, level: 11, ancestry: 'Automaton', feats: [feat('Reinforced Chassis')],
    armors: [{ id: 'purchased', name: 'Chain Mail', worn: true, potency: 1, resilient: 1, runes: ['Shadow'] }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(ownedArmors(c, []).find(armor => armor.id === 'purchased')?.worn).toBe(false)
  const bodyCard = find(ArmorList({ c, entries: [], save }), element => element.type === 'article'
    && !!find(element.props.children as ReactNode, child => typeof child.props.name === 'string'
      && child.props.name.includes('Reinforced Chassis')))
  expect(find(bodyCard, element => element.props.label === 'Potency')).toBeUndefined()
  const runes = find(bodyCard, element => Array.isArray(element.props.runes) && typeof element.props.onChange === 'function')
  if (!runes) throw new Error('Missing body armor property runes')
  ;(runes.props.onChange as (value: string[]) => void)(['Shadow'])
  expect(c.armors?.find(armor => armor.id === 'purchased')?.worn).toBe(true)
  c = { ...c, feats: [] }
  expect(ownedArmors(c, [])).toMatchObject([{ id: 'purchased', worn: true }])
  const ordinaryPotency = find(ArmorList({ c, entries: [], save }), element => element.props.label === 'Potency')
  if (!ordinaryPotency) throw new Error('Missing ordinary armor fundamentals')
  ;(ordinaryPotency.props.onChange as (value: number) => void)(2)
  c = { ...c, feats: [feat('Reinforced Chassis')] }
  expect(wornArmor(c)?.potency).toBe(2)
  expect(ownedArmors({ ...c, feats: [feat('Reinforced Chassis', undefined, 12)] }, [])).toHaveLength(1)
  expect(ownedArmors({ ...c, ancestry: 'Human' }, [])).toHaveLength(1)
})

it.each([
  { className: 'Inventor', subclass: 'Armor' },
  { className: 'Inventor', subclass: 'Construct', feats: [feat('Second Innovation', 'Armor', 8)], level: 8 },
  { className: 'Inventor', subclass: 'Weapon', feats: [feat('Third Innovation', 'Armor', 16)], level: 16 },
  { className: 'Fighter', feats: [feat('Inventor Dedication', 'Armor', 2)], level: 2 },
])('grants one selectable Inventor suit through $className innovation ownership', patch => {
  let c: Character = { ...base, ...patch,
    armors: [{ id: INVENTOR_ARMOR_ID, name: 'Power Suit', worn: true, material: 'Orichalcum', potency: 2, resilient: 2, runes: ['Shadow'] }] }
  expect(ownedArmors(c, [])).toMatchObject([{ id: INVENTOR_ARMOR_ID, name: 'Power Suit' }])
  const picker = find(ArmorList({ c, entries: [], save: change => { c = { ...c, ...change } } }),
    element => element.props['aria-label'] === 'Inventor armor suit')
  if (!picker) throw new Error('Missing suit selector')
  ;(picker.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Subterfuge Suit' } })
  c = JSON.parse(JSON.stringify(c))
  expect(ownedArmors(c, [])).toMatchObject([{ id: INVENTOR_ARMOR_ID, name: 'Subterfuge Suit', material: 'Orichalcum', potency: 2, resilient: 2, runes: ['Shadow'] }])
  expect(armorEntry(c, [], 'Subterfuge Suit')?.data).toMatchObject({ ac: 2, dex_cap: 4, armor_group: 'Composite' })
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)).toContain('aria-label="Remove Orichalcum material"')
})

it('does not grant Inventor armor from other innovations or future feats', () => {
  expect(ownedArmors({ ...base, className: 'Inventor', subclass: 'Weapon' }, [])).toHaveLength(0)
  expect(ownedArmors({ ...base, feats: [feat('Inventor Dedication', 'Construct')] }, [])).toHaveLength(0)
  expect(ownedArmors({ ...base, feats: [feat('Inventor Dedication', 'Armor', 2)] }, [])).toHaveLength(0)
})

it('provides the configured gauntlet for a worn Power Suit only', () => {
  const previous = getSettings().inventorArmorGauntlets
  const c: Character = { ...base, className: 'Inventor', subclass: 'Armor',
    armors: [{ id: INVENTOR_ARMOR_ID, name: 'Power Suit', worn: true, potency: 1, resilient: 0, runes: [], gauntlet: 'Clawed Gauntlet' }] }
  try {
    updateSettings({ inventorArmorGauntlets: false })
    expect(armorGauntlet(c, [])).toMatchObject({ name: 'Clawed Gauntlet' })
    expect(armorGauntlet({ ...c, inventorArmorSuit: 'Subterfuge Suit' }, [])).toBeUndefined()
  } finally { updateSettings({ inventorArmorGauntlets: previous }) }
})

it.each([
  [1, 0, 0, 3, 6], [2, 1, 0, 3, 6], [4, 1, 1, 6, 50],
  [12, 2, 2, 6, 70], [19, 3, 3, 10, 114],
])('scales locked Armor Innovation gauntlets at level %s', (level, potency, striking, hardness, hp) => {
  const c: Character = { ...base, className: 'Inventor', subclass: 'Armor', level }
  const gauntlet = ownedWeapons(c, []).find(weapon => weapon.name === 'Bladed Gauntlet')!
  expect(gauntlet).toBeDefined()
  expect(isLockedWeapon(c, gauntlet.name, [], gauntlet.id)).toBe(true)
  expect(effectiveWeapon(c, [], gauntlet)).toMatchObject({ potency, striking })
  expect(shieldStats(inventorBuckler(c)!)).toEqual({ hardness, hp })
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} part="shield" />)
  expect(markup).toContain('Gauntlet Buckler')
  expect(markup).not.toContain('aria-label="Remove Gauntlet Buckler"')
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />))
    .not.toContain('aria-label="Remove Bladed Gauntlet"')
})

it('grants both gauntlets with either worn suit, preserving saved equipment when switched off', () => {
  const previous = getSettings().inventorArmorGauntlets
  let c: Character = { ...base, level: 10, className: 'Inventor', subclass: 'Armor', inventorArmorSuit: 'Subterfuge Suit',
    shield: { id: 'steel', name: 'Steel Shield', hardness: 5, hp: 20, raised: true, damage: 2 },
    armors: [{ id: INVENTOR_ARMOR_ID, name: 'Subterfuge Suit', worn: true, potency: 0, resilient: 0, runes: [], gauntlet: 'Clawed Gauntlet' }],
    weapons: [{ id: 'blade', name: 'Bladed Gauntlet', potency: 0, striking: 0, runes: ['Ghost Touch'] }] }
  const savedArmor = JSON.stringify(c.armors)
  try {
    updateSettings({ inventorArmorGauntlets: true })
    expect(armorGauntlet(c, [])).toMatchObject({ name: 'Bladed Gauntlet', locked: true })
    expect(ownedWeapons(c, []).filter(weapon => weapon.name === 'Bladed Gauntlet')).toHaveLength(1)
    expect(effectiveWeapon(c, [], c.weapons![0])).toMatchObject({ potency: 2, striking: 1, runes: ['Ghost Touch'] })
    const buckler = inventorBuckler(c)!
    c = { ...c, ...shieldEquipChange(c, buckler, true) }
    c = { ...c, ...shieldRaisedChange(c, true) }
    c = { ...c, ...shieldChange(c, buckler, { damage: 4 }) }
    expect(c.shield).toMatchObject({ equipped: false, raised: false, damage: 2 })
    expect(c.inventorBuckler).toMatchObject({ equipped: true, raised: true, damage: 4 })
    expect(equippedShield(c)?.id).toBe(buckler.id)
    const equipped = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} part="shield" />)
    expect(equipped).toContain('Raise Buckler')
    updateSettings({ inventorArmorGauntlets: false })
    expect(inventorBuckler(c)).toBeUndefined()
    expect(armorGauntlet(c, [])).toBeUndefined()
    expect(JSON.stringify(c.armors)).toBe(savedArmor)
    expect(c.weapons?.[0].runes).toEqual(['Ghost Touch'])
    updateSettings({ inventorArmorGauntlets: true })
    expect(inventorBuckler(c)?.damage).toBe(4)
    expect(inventorBuckler({ ...c, subclass: 'Construct' })).toBeUndefined()
    expect(inventorBuckler({ ...c, armors: c.armors!.map(armor => ({ ...armor, worn: false })) })).toBeUndefined()
  } finally { updateSettings({ inventorArmorGauntlets: previous }) }
})

it.each([
  ['Copaxi', undefined, 'Armored Shell', 'Armored Shell', 3, 1],
  ['Trox', 'Fortified Trox', undefined, 'Fortified Exoskeleton', 4, 1],
  ['Urog', 'Crystal Carapace Urog', undefined, 'Crystal Carapace', 2, 2],
  ['Gnarefuroid', 'Hullborne Gnarefuroid', undefined, 'Hullborne Carapace', 3, 2],
  ['Android', 'Hellforged Android', undefined, 'Hellforged Plates', 5, 0],
  ['Khizar', 'Petrified', undefined, 'Petrified Bark', 4, 1],
  ['Barathu', 'Rugged Explorer Barathu', undefined, 'Rugged Explorer Shell', 2, 2],
  ['Vesk', 'Plated Vesk', undefined, 'Vesk Plates', 3, 1],
] as const)('grants the correct Starfinder %s armor profile', (ancestry, heritage, name, armorName, ac, dexCap) => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry, heritage, feats: name ? [feat(name)] : [] }
  expect(wornArmor(c)?.name).toBe(armorName)
  expect(armorEntry(c, [], armorName)?.data).toMatchObject({ ac, dex_cap: dexCap, attached: true })
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('aria-label="Armor material"')
  expect(markup).not.toContain(`aria-label="Remove ${armorName}"`)
  expect(ownedArmors({ ...c, systems: ['pf2e'] }, [])).toHaveLength(0)
})

it('applies Starfinder heavy armor upgrades only while their feats are active', () => {
  const trox: Character = { ...base, systems: ['sf2e'], ancestry: 'Trox', heritage: 'Fortified Trox', feats: [feat('Heavy Exoskeleton', undefined, 9)], level: 8 }
  expect(grantedArmorEntries(trox)[0].data).toMatchObject({ ac: 5, armor_category: 'Medium' })
  expect(grantedArmorEntries({ ...trox, level: 9 })[0]).toMatchObject({
    data: { ac: 6, armor_category: 'Heavy', speed_penalty: -10, medium_proficiency: true }, traits: ['Bulwark', 'Comfort', 'Exposed', 'Resilient'],
  })
  const android: Character = { ...base, systems: ['sf2e'], ancestry: 'Android', heritage: 'Hellforged Android', feats: [feat('Hardened Plates')] }
  expect(grantedArmorEntries(android)[0]).toMatchObject({
    data: { ac: 6, dex_cap: 0, armor_category: 'Heavy', strength: 4 }, traits: ['Bulwark', 'Comfort'],
  })
})

it('keeps Copaxi armor rune-free, supports Enhanced Shell, and permits eligible flight suits without replacing body armor', () => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Copaxi', level: 20,
    feats: [feat('Armored Shell'), feat('Enhanced Shell', undefined, 5)],
    armors: [
      { id: 'granted-armor:copaxi', name: 'Armored Shell', potency: 3, resilient: 3, runes: ['Shadow'], worn: true },
      { id: 'flight', name: 'Flight Suit', potency: 0, resilient: 0, runes: [], worn: true },
      { id: 'heavy', name: 'Heavy Armor', potency: 0, resilient: 0, runes: [], worn: true },
    ] }
  expect(grantedArmorEntries(c)[0].data).toMatchObject({ ac: 7, upgrade_slots: 5, runes_allowed: false })
  expect(wornArmor(c)).toMatchObject({ name: 'Armored Shell', potency: 0, resilient: 0, runes: [] })
  expect(ownedArmors(c, []).find(armor => armor.id === 'flight')?.worn).toBe(true)
  expect(ownedArmors(c, []).find(armor => armor.id === 'heavy')?.worn).toBe(false)
  expect(c.armors?.[0].runes).toEqual(['Shadow'])
})

it('uses explicit shell training without unarmored proficiency, and medium proficiency for Heavy Exoskeleton', () => {
  const caster: ContentEntry = {
    id: 'caster', name: 'Test Class', kind: 'class', systems: ['sf2e'], source: 'official', level: 0,
    description: '', traits: [], data: { unarmored_proficiency: 'Legendary', medium_armor_proficiency: 'Expert', heavy_armor_proficiency: 'Trained' },
    effects: [], updatedAt: 0,
  }
  const c: Character = { ...base, systems: ['sf2e'], className: 'Test Class', ancestry: 'Copaxi', feats: [feat('Armored Shell')] }
  expect(armorClass(c, [caster])).toBe(17)
  expect(armorClass({ ...c, ancestry: 'Trox', heritage: 'Fortified Trox', level: 9, feats: [feat('Heavy Exoskeleton', undefined, 9)] }, [caster])).toBe(30)
  expect(armorClass({ ...c, ancestry: 'Urog', heritage: 'Crystal Carapace Urog', feats: [] }, [caster])).toBe(17)
  expect(armorClass({ ...c, ancestry: 'Android', heritage: 'Hellforged Android', feats: [] }, [caster])).toBe(20)
})

it.each([['Barathu', 'Rugged Explorer Barathu', 2, 4], ['Vesk', 'Plated Vesk', 3, 5]] as const)(
  'combines %s heritage and grade improvements at level 5 without double-counting', (ancestry, heritage, before, after) => {
    const c: Character = { ...base, systems: ['sf2e'], ancestry, heritage, level: 4 }
    expect(grantedArmorEntries(c)[0].data.ac).toBe(before)
    expect(grantedArmorEntries({ ...c, level: 5 })[0].data.ac).toBe(after)
  },
)

it.each([
  [1, 'Commercial', 0, 0, 1], [4, 'Commercial', 0, 0, 1],
  [5, 'Tactical', 1, 0, 2], [7, 'Tactical', 1, 0, 2],
  [8, 'Advanced', 1, 1, 2], [10, 'Advanced', 1, 1, 2],
  [11, 'Superior', 2, 1, 3], [13, 'Superior', 2, 1, 3],
  [14, 'Elite', 2, 2, 3], [17, 'Elite', 2, 2, 3],
  [18, 'Ultimate', 3, 2, 4], [19, 'Ultimate', 3, 2, 4],
  [20, 'Paragon', 3, 3, 4],
] as const)('automatically applies Starfinder grades at level %i without fundamental runes', (level, grade, acBonus, resilient, slots) => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Gnarefuroid', heritage: 'Hullborne Gnarefuroid', level,
    armors: [{ id: 'granted-armor:gnarefuroid', name: 'Hullborne Carapace', potency: 3, resilient: 3, runes: [], worn: true }] }
  expect(wornArmor(c)).toMatchObject({ potency: 0, resilient: 0 })
  expect(grantedArmorEntries(c)[0].data).toMatchObject({
    armor_grade: grade, ac: 3 + acBonus, grade_save_bonus: resilient, upgrade_slots: slots,
  })
  expect(armorClass(c, [])).toBe(15 + acBonus)
  const defenses = defenseSummary(c, [])
  const withoutArmor = defenseSummary({ ...c, heritage: undefined }, [])
  for (const save of ['fortitude', 'reflex', 'will'] as const) expect(defenses[save] - withoutArmor[save]).toBe(resilient)
  expect(defenses.perception).toBe(withoutArmor.perception)
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain(`Grade: ${grade}`)
  expect(markup).not.toContain('(automatic)')
  expect(markup).not.toContain('>SF2e</small>')
  expect(markup).not.toContain('<label>Potency ')
  expect(markup).not.toContain('<label>Resilient ')
  expect(c.armors?.[0]).toMatchObject({ potency: 3, resilient: 3 })
})

it('distinguishes PF2e and SF2e armor progression in mixed-system characters', () => {
  const c: Character = { ...base, systems: ['pf2e', 'sf2e'], level: 20, className: 'Inventor', subclass: 'Armor',
    ancestry: 'Vesk', heritage: 'Plated Vesk' }
  expect(ownedArmors(c, [])).toMatchObject([
    { name: 'Vesk Plates', potency: 0, resilient: 0, worn: true },
    { name: 'Power Suit', potency: 3, resilient: 3, worn: false },
  ])
  expect(grantedArmorEntries(c)).toMatchObject([{ systems: ['sf2e'] }, { systems: ['pf2e'] }])
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('>PF2e</small>')
  expect(markup).not.toContain('>SF2e</small>')
  expect(markup).not.toContain('Grade: Paragon')
  expect(markup).toContain('Armor upgrades cannot be installed on this armor')
  expect(grantedArmorEntries(c)[0].data.upgrade_slots).toBe(0)
})

it('shows native grade saving throw bonuses in defense rows, matching the calculator', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 20, ancestry: 'Gnarefuroid', heritage: 'Hullborne Gnarefuroid' }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(markup).toContain('Fortitude +4: show breakdown')
  expect(markup).toContain('Reflex +7: show breakdown')
  expect(markup).toContain('Will +3: show breakdown')
})

it('uses native grade resilience rather than PF2e potency for Starfinder armor specialization', () => {
  const specialization: ContentEntry = {
    id: 'specialization', name: 'Armor Specialization', kind: 'feat', systems: ['sf2e'], source: 'official',
    level: 1, description: '', traits: [], data: { grants_armor_specialization: true }, effects: [], updatedAt: 0,
  }
  const plate: ContentEntry = { ...specialization, id: 'plate', name: 'Plate', kind: 'armorGroup', data: {} }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Trox', heritage: 'Fortified Trox',
    level: 5, feats: [feat('Armor Specialization')] }
  expect(armorSpecialization(c, [specialization, plate])?.benefit).toMatchObject({ value: 1, damage: 'Slashing' })
  expect(armorSpecialization({ ...c, level: 8 }, [specialization, plate])?.benefit).toMatchObject({ value: 2 })
  expect(armorSpecialization({ ...c, level: 20, feats: [...c.feats, feat('Heavy Exoskeleton', undefined, 9)] }, [specialization, plate])?.benefit).toMatchObject({ value: 5 })
})
