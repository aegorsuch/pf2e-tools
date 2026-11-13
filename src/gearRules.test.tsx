import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  activeAnimalFeatures, animalSkinBenefits, armorClass, armorClassBreakdown, armorRanks, armorSpecialization, augmentationLimit, automaticHardlightGrade, blessedArmamentRuneOptions, blessedArmamentTargets, canBeWeaponInnovation, canInstallAugmentation, championBlessings, characterSummary, combinationForms, defenseSummary, deitySanctification, effectiveHandwraps, effectiveWeapon, eligibleFeats, eligibleWeaponRunes, featEffectChange, parryValue, savingThrowBreakdown,
  featChoiceOptions, heritagesFor, initiativeBonus, magicHideChange, maxPropertyRunes, movementSpeeds, ownedArmors, ownedWeapons, plannedSlots, ragingAthleteBenefits, researchedSpellResistance, resistances, senses, speed, weaponAttack,
} from './builder'
import { companionStats } from './companions'
import { ArmorList, Augmentations, Gadgets, SimplePoisons, WeaponList } from './GearSection'
import { ClassFeatures } from './ClassFeatures'
import { SkillsSection } from './SkillsSection'
import { MinionsSection } from './MinionsSection'
import { SpellsSection } from './SpellsSection'
import { homebrewCharacterOptions, GAUNTLET, HAFT_STRIKER_WEAPON, ORC_TUSKS, OVERSIZED_THROW } from './supplemental'
import { getSettings, updateSettings } from './settings'
import type { Character, ContentEntry, HardlightGrade, OwnedWeapon } from './types'

const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Test', level: 10, className: 'Champion', deity: 'Iomedae',
  abilities: { str: 12, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('shows Dragonslayer Oath reaction benefits only after acquisition', () => {
  const c: Character = { ...base, level: 10, feats: [{ ...feat('Dragonslayer Oath', 2), slot: 'class:6:0' }] }
  const markup = renderToStaticMarkup(<ClassFeatures c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Dragonslayer Oath (legacy)')
  expect(markup).toContain('resistance 17')
  expect(markup).toContain('only to the corresponding legacy champion reactions')
  expect(renderToStaticMarkup(<ClassFeatures c={{ ...c, level: 5 }} entries={[]} save={() => {}} />))
    .not.toContain('Dragonslayer Oath (legacy)')
})
const feat = (name: string, level = 1, choice?: string) => ({ name, level, choice, type: 'Class Feat' })
const content = (kind: ContentEntry['kind'], name: string, data: ContentEntry['data'] = {}, level = 1, traits: string[] = []): ContentEntry =>
  ({ id: name, systems: ['pf2e'], kind, source: 'official', name, data, level, traits, description: '', effects: [], updatedAt: 1 })
const sword = content('weapon', 'Longsword', { damage: '1d8 slashing', hands: 1, weapon_category: 'Martial' })
const deity = content('deity', 'Iomedae', { favored_weapon: 'longsword', sanctification: 'holy', sanctification_required: true })
const main: OwnedWeapon = { id: 'main', name: 'Longsword', potency: 3, striking: 1, runes: [] }

it('applies Martial Experience to untrained weapons and grants training at level 11', () => {
  const c: Character = { ...base, level: 10, feats: [feat('Martial Experience', 5)] }
  const atTen = weaponAttack(c, [sword], main)
  expect(atTen.rank).toBe(0)
  expect(atTen.prof).toBe(10)
  expect(atTen.breakdown.parts.find(part => part.label === 'Proficiency')?.note).toContain('Martial Experience')
  const atEleven = weaponAttack({ ...c, level: 11 }, [sword], main)
  expect(atEleven.rank).toBe(1)
  expect(atEleven.prof).toBe(13)
  expect(weaponAttack({ ...c, feats: [] }, [sword], main).prof).toBe(0)
})

it('grants Soaring Armor flight only while the innovation is worn and the feat is active', () => {
  const c: Character = { ...base, level: 14, className: 'Inventor', subclass: 'Armor',
    feats: [feat('Soaring Armor', 14)] }
  expect(movementSpeeds(c, [])).toContainEqual({ name: 'Fly', feet: 25, source: 'Soaring Armor' })
  expect(movementSpeeds({ ...c, level: 13 }, []).some(speed => speed.name === 'Fly')).toBe(false)
  expect(movementSpeeds({ ...c, armors: [
    { id: 'granted-armor:inventor', name: 'Power Suit', worn: false, potency: 0, resilient: 0, runes: [] },
    { id: 'ordinary', name: 'Other Armor', worn: true, potency: 0, resilient: 0, runes: [] },
  ] }, []).some(speed => speed.name === 'Fly')).toBe(false)
})

it('tracks Poison Weapon doses and Improved Poison Weapon damage', () => {
  const c: Character = { ...base, level: 8, feats: [feat('Poison Weapon', 4), feat('Improved Poison Weapon', 8)], simplePoisonsSpent: 3 }
  const html = renderToStaticMarkup(<SimplePoisons c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('5/8 remaining; 2d4')
  expect(html).toContain('critically failed attack does not waste')
  expect(renderToStaticMarkup(<SimplePoisons c={{ ...c, level: 7 }} entries={[]} save={() => {}} />)).toContain('4/7 remaining; 1d4')
  expect(renderToStaticMarkup(<SimplePoisons c={{ ...c, feats: [] }} entries={[]} save={() => {}} />)).toBe('')
})

it('lists only known and craftable gadgets for daily preparations', () => {
  const c: Character = { ...base, level: 4, feats: [feat('Gadget Specialist', 4)], gadgetFormulaChoices: ['Little Gadget'] }
  const entries = [content('item', 'Little Gadget', {}, 3, ['Gadget']), content('item', 'Future Gadget', {}, 5, ['Gadget']),
    content('item', 'Unknown Gadget', {}, 1, ['Gadget'])]
  const html = renderToStaticMarkup(<Gadgets c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Prepare 2 temporary gadgets')
  expect(html).toContain('Little Gadget (Level 3)')
  expect(html).not.toContain('Unknown Gadget')
  expect(html).not.toContain('Future Gadget')
  expect(renderToStaticMarkup(<Gadgets c={{ ...c, feats: [] }} entries={entries} save={() => {}} />)).toBe('')
})

it('marks one eligible weapon innovation with scaled fundamentals and locked material', () => {
  const weapon = content('weapon', 'Prototype', { weapon_category: 'Advanced', damage: '1d8 piercing' }, 0)
  const inventor: Character = { ...base, level: 10, className: 'Inventor', subclass: 'Weapon' }
  const item: OwnedWeapon = { id: 'innovation', name: weapon.name, potency: 0, striking: 0, runes: [],
    material: 'Cold Iron (Low-Grade)', inventorInnovation: true }
  expect(canBeWeaponInnovation(inventor, [weapon], item)).toBe(true)
  expect(effectiveWeapon(inventor, [weapon], item)).toMatchObject({ material: 'Orichalcum', potency: 2, striking: 1 })
  expect(effectiveWeapon({ ...inventor, subclass: 'Armor' }, [weapon], item)).toMatchObject({
    material: 'Cold Iron (Standard-Grade)', potency: 0, striking: 0,
  })

  expect(canBeWeaponInnovation(inventor, [{ ...weapon, level: 1 }], item)).toBe(false)
  expect(canBeWeaponInnovation(inventor, [{ ...weapon, traits: ['Rare'] }], item)).toBe(false)
  expect(canBeWeaponInnovation({ ...inventor, gearAccessOverrides: [weapon.id] }, [{ ...weapon, traits: ['Rare'] }], item)).toBe(true)
  const martial = content('class', 'Inventor', { attack_proficiency: 'Trained in martial weapons' })
  expect(weaponAttack(inventor, [weapon, martial], item).rank).toBe(1)
  expect(item.material).toBe('Cold Iron (Low-Grade)')
  expect(renderToStaticMarkup(<WeaponList c={{ ...inventor, weapons: [item] }} entries={[weapon]} save={() => {}} />))
    .toContain('aria-label="Weapon Innovation: Prototype"')
})

it('treats a combination weapon as one choice with shared runes and form-specific effects', () => {
  const melee = content('weapon', 'Hammer Gun (Melee)', { url: 'same', weapon_category: 'Martial', damage: '1d10 slashing' }, 1, ['Combination', 'Uncommon'])
  const ranged = content('weapon', 'Hammer Gun (Ranged)', { url: 'same', weapon_category: 'Martial', weapon_type: 'Ranged', range: 60, damage: '1d6 piercing' }, 1, ['Combination', 'Uncommon'])
  const entries = [melee, ranged]
  const character: Character = { ...base, feats: [{ ...feat('Unconventional Weaponry'), choice: 'Hammer Gun', culturalWeapon: true }] }
  const weapon: OwnedWeapon = { id: 'combo', name: ranged.name, potency: 2, striking: 1, runes: ['Vorpal'] }
  expect(combinationForms(entries, weapon.name)).toHaveLength(2)
  expect(featChoiceOptions('Unconventional Weaponry', character, entries, '')).toEqual(['Hammer Gun'])
  expect(weaponAttack(character, entries, weapon)).toMatchObject({ damage: '2d6 piercing', range: 60, item: 2 })
  expect(weaponAttack(character, entries, { ...weapon, combinationForm: 'Melee' })).toMatchObject({ damage: '2d10+1 slashing', range: 0, item: 2 })
  expect(effectiveWeapon(character, entries, { ...weapon, combinationForm: 'Melee' }).runes).toEqual(['Vorpal'])
  expect(eligibleWeaponRunes(entries, { ...weapon, runes: [] }).map(rune => rune.name)).toContain('Vorpal')
  const html = renderToStaticMarkup(<WeaponList c={{ ...character, weapons: [weapon] }} entries={entries} save={() => {}} />)
  expect(html).toContain('aria-label="Hammer Gun weapon form"')
  expect(combinationForms([melee, { ...ranged, data: { ...ranged.data, url: 'different' } }], melee.name)).toEqual([])
})

it('shows alloyed metal on melee unarmed attacks without overwriting existing materials', () => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Orc', level: 12,
    feats: [feat('Iron Fists'), feat('Alloyed Attacks', 5, 'Silver')] }
  const html = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('Silver Fists')
  expect(html).toContain('melee unarmed attacks have Silver properties')
  expect(featChoiceOptions('Alloyed Attacks', c, [], '')).not.toContain('Adamantine')
  expect(featChoiceOptions('Alloyed Attacks', { ...c, level: 13 }, [], '')).toContain('Adamantine')
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, feats: [feat('Iron Fists'), feat('Alloyed Attacks', 5, 'Adamantine')] }}
    entries={[]} save={() => {}} />)).not.toContain('Adamantine Fists')
})

it('provides both playing-card usages with one shared deck and automatic fundamentals', () => {
  const dagger = content('weapon', 'Dagger', { damage: '1d4 piercing', weapon_category: 'Simple' }, 0)
  const dart = content('weapon', 'Dart', { damage: '1d4 piercing', weapon_category: 'Simple', weapon_type: 'Ranged', range: 20 }, 0)
  const c: Character = { ...base, level: 10, feats: [feat("Fane's Fourberie", 2)],
    playingCardEnhancements: { potency: 0, striking: 0, runes: ['Shifting'] } }
  const weapons = ownedWeapons(c, [dagger, dart]).filter(weapon => weapon.id.startsWith('playing-card:'))
  expect(weapons.map(weapon => weapon.name)).toEqual(['Dagger (Playing Card)', 'Dart (Playing Card)'])
  for (const weapon of weapons) expect(effectiveWeapon(c, [dagger, dart], weapon)).toMatchObject({
    potency: 2, striking: 1, runes: ['Shifting'], material: undefined,
  })
  const holy = content('item', 'Holy', { item_subcategory: 'Weapon Property Runes', usage: 'etched onto a melee weapon' }, 1)
  const withHoly = { ...c, playingCardEnhancements: { potency: 0, striking: 0, runes: ['Holy'] } }
  expect(weaponAttack(withHoly, [dagger, dart, holy], weapons[0]).traits).toContain('Holy')
  expect(weaponAttack(withHoly, [dagger, dart, holy], weapons[1]).traits).not.toContain('Holy')
  const html = renderToStaticMarkup(<WeaponList c={c} entries={[dagger, dart]} save={() => {}} />)
  expect(html).toContain('Material: playing cards')
  expect(html).not.toContain('aria-label="Remove Dagger (Playing Card)"')
  expect(ownedWeapons({ ...c, level: 1 }, [dagger, dart]).some(weapon => weapon.id.startsWith('playing-card:'))).toBe(false)
  expect(c.playingCardEnhancements?.runes).toEqual(['Shifting'])
})

it('tracks augmentation limits and extra slots from earned feats without rewriting installed augmentations', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 9, heritage: 'Synthflesh Verthani',
    feats: [feat('Transgnomanist', 5), feat('Easily Augmented'), feat('Augmented Shell', 9),
      feat('Reconfigurable Frame', 5), feat('Reconfigurable Frame', 5), feat('Augmented Perfection', 17)],
    augmentations: [{ id: 'a', entryId: 'plating', name: 'Dermal Plating', slot: 'body:0' }] }
  const implant = { ...content('item', 'Dermal Plating', { item_category: 'Augmentations' }), id: 'plating', systems: ['sf2e'] as const }
  expect(augmentationLimit(c)).toBe(10)
  const markup = renderToStaticMarkup(<Augmentations c={c} entries={[{ ...implant, systems: ['sf2e'] }]} save={() => {}} />)
  expect(markup).toContain('Implant limit: 0/10')
  expect(markup).toContain('Augmented Body 1 (used)')
  expect(markup).toContain('Dermal Plating')
  expect(c.augmentations?.[0].slot).toBe('body:0')
  expect(renderToStaticMarkup(<Augmentations c={{ ...c, systems: ['pf2e'] }} entries={[]} save={() => {}} />)).toBe('')
})

it('enforces normal and feat-granted implant slots while permitting exempt augmentations', () => {
  const implant: ContentEntry = { ...content('item', 'Dermal Plating', { item_category: 'Augmentations', rarity: 'common' }),
    systems: ['sf2e'] }
  const installed = Array.from({ length: 4 }, (_, index) => ({ id: String(index), entryId: String(index), name: `Implant ${index}`, slot: 'standard' }))
  const c: Character = { ...base, systems: ['sf2e'], level: 5, feats: [feat('Transgnomanist', 5), feat('Adapted Augmentations')],
    augmentations: installed }
  expect(canInstallAugmentation(c, implant, 'standard')).toBe(false)
  expect(canInstallAugmentation(c, implant, 'body:0')).toBe(true)
  expect(canInstallAugmentation(c, { ...implant, level: 6 }, 'body:0')).toBe(false)
  expect(canInstallAugmentation(c, { ...implant, level: 2 }, 'adapted')).toBe(false)
  expect(canInstallAugmentation(c, { ...implant, data: { ...implant.data, rarity: 'rare' } }, 'adapted')).toBe(false)
  expect(canInstallAugmentation(c, implant, 'adapted')).toBe(true)
  expect(canInstallAugmentation(c, { ...implant, traits: ['Apex'] }, 'standard')).toBe(true)
  expect(canInstallAugmentation(c, { ...implant, description: "This augmentation doesn't count against your implant limit." }, 'standard')).toBe(true)
  expect(canInstallAugmentation({ ...c, feats: [] }, implant, 'body:0')).toBe(false)
  expect(canInstallAugmentation({ ...c, augmentations: [...installed, { id: 'body', entryId: implant.id, name: implant.name, slot: 'body:0' }] }, implant, 'body:0')).toBe(false)
})
it.each(['Celestial Form', 'Fiendish Form'])('gates %s flight on the house rule and acquisition level without suppressing other flight', name => {
  const previous = getSettings().championFormNoFlight
  const c: Character = { ...base, level: 18, feats: [feat(name, 18)] }
  try {
    updateSettings({ championFormNoFlight: true })
    expect(movementSpeeds(c, [])).toEqual([{ name: 'Land', feet: 25 }])
    const wings: Character = { ...c, activeSpells: ['Animal Feature'], animalFeature: 'Wings',
      feats: [...c.feats, feat('Advanced Warden', 4, 'Animal Feature')] }
    expect(movementSpeeds(wings, [])).toContainEqual({ name: 'Fly', feet: 25, source: 'Animal Feature' })
    updateSettings({ championFormNoFlight: false })
    expect(movementSpeeds(c, [])).toContainEqual({ name: 'Fly', feet: 25, source: name })
    expect(movementSpeeds({ ...c, level: 17 }, [])).toEqual([{ name: 'Land', feet: 25 }])
    expect(movementSpeeds(wings, [])).toContainEqual({ name: 'Fly', feet: 25, source: `Animal Feature, ${name}` })
  } finally { updateSettings({ championFormNoFlight: previous }) }
})

it('treats a shield as raised for active Shield Paragon without changing the saved toggle', () => {
  const shield = { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false }
  const c: Character = { ...base, level: 20, shield, feats: [feat('Shield Paragon', 20)] }
  expect(armorClass(c, [])).toBe(armorClass({ ...c, feats: [] }, []) + 2)
  expect(armorClass({ ...c, level: 19 }, [])).toBe(armorClass({ ...c, level: 19, feats: [] }, []))
  expect(armorClass({ ...c, shield: undefined }, [])).toBe(armorClass({ ...c, shield: undefined, feats: [] }, []))
  expect(c.shield?.raised).toBe(false)
  expect(armorClass({ ...c, feats: [], shield: { ...shield, raised: true } }, [])).toBe(armorClass({ ...c, feats: [] }, []) + 2)
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Always raised by Shield Paragon')
  expect(markup).toMatch(/type="checkbox" disabled="" checked="".*?Raised \(\+2 AC\)/)
})

it.each<[number, number, number, HardlightGrade]>([
  [1, 0, 0, 'Commercial'], [2, 1, 0, 'Tactical'], [3, 1, 0, 'Tactical'],
  [4, 1, 1, 'Advanced'], [9, 1, 1, 'Advanced'], [10, 2, 1, 'Superior'],
  [11, 2, 1, 'Superior'], [12, 2, 2, 'Elite'], [15, 2, 2, 'Elite'],
  [16, 3, 2, 'Ultimate'], [18, 3, 2, 'Ultimate'], [19, 3, 3, 'Paragon'],
])('automatically scales both handwrap types at level %i without changing saved configuration', (level, potency, striking, grade) => {
  for (const kind of [undefined, 'hardlight'] as const) {
    const c: Character = { ...base, level, handwraps: { ...(kind ? { kind, grade: 'Commercial' } : {}), potency: 0, striking: 0, runes: ['Impactful'] } }
    const before = JSON.stringify(c)
    const effective = effectiveHandwraps(c)
    expect(effective).toMatchObject({ potency, striking, runes: ['Impactful'], ...(kind ? { grade } : {}) })
    const fist = ownedWeapons(c, []).find(weapon => weapon.name === 'Fist')!
    expect(effectiveWeapon(c, [], fist)).toMatchObject({ potency, striking })
    expect(JSON.stringify(c)).toBe(before)
  }
  expect(automaticHardlightGrade(level)).toBe(grade)
})

it('preserves stronger saved upgrades without stacking PF values onto hardlight grades', () => {
  const handwraps = { potency: 3, striking: 3, runes: ['Impactful'] }
  expect(effectiveHandwraps({ ...base, level: 2, handwraps })).toEqual(handwraps)
  expect(effectiveHandwraps({ ...base, level: 2, handwraps: { ...handwraps, kind: 'hardlight', grade: 'Elite' } }))
    .toMatchObject({ grade: 'Elite', potency: 2, striking: 2, runes: ['Impactful'] })
  expect(effectiveHandwraps({ ...base, handwraps: undefined })).toBeUndefined()
})

it.each(['Grisantian Hide', 'Grisantian Hide (Standard-Grade)', 'Grisantian Hide (High-Grade)'] as const)(
  'scales saved %s at the armor threshold without rewriting character data', (material) => {
    const c: Character = { ...base, armors: [{ id: 'armor', name: 'Full Plate', material, worn: true, potency: 2, resilient: 2, runes: ['Shadow'] }] }
    const original = JSON.stringify(c)
    for (const level of [18, 19, 18]) {
      const current = { ...c, level }
      const expected = level >= 19 ? 'Grisantian Hide (High-Grade)' : 'Grisantian Hide (Standard-Grade)'
      expect(ownedArmors(current, [])[0]).toMatchObject({ material: expected, potency: 2, resilient: 2, runes: ['Shadow'] })
      expect(effectiveWeapon(current, [], { ...main, id: GAUNTLET.id, name: GAUNTLET.name }).material).toBe(expected)
    }
    expect(JSON.stringify(c)).toBe(original)
  })

it.each([
  ['Peachwood', 17, 'Peachwood (Standard-Grade)'],
  ['Peachwood', 18, 'Peachwood (High-Grade)'],
  ['Peachwood (Greater)', 18, 'Peachwood (High-Grade)'],
  ['Duskwood', 16, 'Duskwood (Standard-Grade)'],
  ['Duskwood', 17, 'Duskwood (High-Grade)'],
  ['Cold Iron (Standard-Grade)', 9, 'Cold Iron (Low-Grade)'],
  ['Cold Iron (Low-Grade)', 10, 'Cold Iron (Standard-Grade)'],
  ['Cold Iron (Standard-Grade)', 16, 'Cold Iron (High-Grade)'],
] as const)('scales ordinary %s weapons at level %i to %s', (material, level, expected) => {
  const weapon = { ...main, material }
  expect(effectiveWeapon({ ...base, level }, [sword], weapon)).toMatchObject({ material: expected, potency: 3, striking: 1 })
  expect(weapon.material).toBe(material)
})

it('uses the armor Duskwood threshold for inherited gauntlets rather than the earlier weapon threshold', () => {
  const c: Character = { ...base, armors: [{ id: 'armor', name: 'Full Plate', material: 'Duskwood', worn: true, potency: 2, resilient: 1, runes: [] }] }
  for (const level of [18, 19]) {
    const current = { ...c, level }
    const expected = level >= 19 ? 'Duskwood (High-Grade)' : 'Duskwood (Standard-Grade)'
    expect(ownedArmors(current, [])[0].material).toBe(expected)
    expect(effectiveWeapon(current, [], { ...main, id: GAUNTLET.id, name: GAUNTLET.name }).material).toBe(expected)
  }
})

it.each([
  ['Wood', 'Medium', 6, 'damage', 'Piercing'], ['Wood', 'Heavy', 8, 'damage', 'Piercing'],
  ['Skeletal', 'Medium', 6, 'resistance', 'Precision'], ['Skeletal', 'Heavy', 8, 'resistance', 'Precision'],
  ['Composite', 'Medium', 4, 'resistance', 'Piercing'], ['Composite', 'Heavy', 5, 'resistance', 'Piercing'],
  ['Leather', 'Medium', 4, 'resistance', 'Bludgeoning'], ['Leather', 'Heavy', 5, 'resistance', 'Bludgeoning'],
  ['Plate', 'Medium', 4, 'resistance', 'Slashing'], ['Plate', 'Heavy', 5, 'resistance', 'Slashing'],
  ['Chain', 'Medium', 7, 'reduction', undefined], ['Chain', 'Heavy', 9, 'reduction', undefined],
] as const)('calculates %s specialization for %s armor without treating retaliation or reduction as resistance', (group, category, value, kind, damage) => {
  const armor = content('armor', 'Test Armor', { armor_group: group, armor_category: category })
  const rule = content('armorGroup', group)
  const grant = content('feat', 'Armor Training', { grants_armor_specialization: true })
  const c: Character = { ...base, className: 'Ranger', feats: [feat(grant.name)],
    armors: [{ id: 'armor', name: armor.name, potency: 3, resilient: 0, worn: true, runes: [] }] }
  const data = [armor, rule, grant]
  expect(armorSpecialization(c, data)?.benefit).toEqual({ value, kind, damage })
  expect(resistances(c, data)).toEqual(kind === 'resistance' ? [{ value, damage, source: `${group} Armor Specialization` }] : [])
  expect(armorSpecialization({ ...c, armors: c.armors!.map(a => ({ ...a, potency: 0 })) }, data)?.benefit?.value).toBe(value - 3)
  expect(resistances({ ...c, feats: [] }, data)).toEqual([])
  expect(armorSpecialization({ ...c, armors: c.armors!.map(a => ({ ...a, worn: false })) }, data)).toBeUndefined()
})

it('gates specialization by class level, feat acquisition level, armor group and category', () => {
  const medium = content('armor', 'Bone Armor', { armor_group: 'Skeletal', armor_category: 'Medium' })
  const heavy = { ...medium, data: { ...medium.data, armor_category: 'Heavy' } }
  const light = { ...medium, data: { ...medium.data, armor_category: 'Light' } }
  const group = content('armorGroup', 'Skeletal')
  const skins = content('feat', 'Skins Of The Slain', {
    grants_armor_specialization: true, grants_armor_groups: 'leather, skeletal, wood', grants_armor_categories: 'light, medium',
  }, 10)
  const feature = { ...content('classFeature', 'Armor Expertise', { class: 'Fighter' }, 11), description: 'You gain the armor specialization effects of medium and heavy armor.' }
  const c: Character = { ...base, className: 'Ranger', level: 13,
    feats: [{ ...feat(skins.name, 10), slot: 'archetype:14:0' }],
    armors: [{ id: 'armor', name: medium.name, potency: 3, resilient: 0, worn: true, runes: [] }] }
  expect(armorSpecialization(c, [medium, group, skins])).toBeUndefined()
  expect(armorSpecialization({ ...c, level: 14 }, [heavy, group, skins])).toBeUndefined()
  expect(armorSpecialization({ ...c, level: 14 }, [light, group, skins])?.summary).toContain('Value not specified for light armor')
  const fighter = { ...c, className: 'Fighter', feats: [], level: 11 }
  expect(resistances(fighter, [medium, group, feature])).toEqual([{ damage: 'Precision', value: 6, source: 'Skeletal Armor Specialization' }])
  expect(armorSpecialization({ ...fighter, level: 10 }, [medium, group, feature])).toBeUndefined()
  expect(armorSpecialization(fighter, [light, group, feature])).toBeUndefined()
})

it.each([
  [1, 0, 0], [2, 1, 0], [3, 1, 0], [4, 1, 1], [9, 1, 1], [10, 2, 1],
  [11, 2, 1], [12, 2, 2], [15, 2, 2], [16, 3, 2], [18, 3, 2], [19, 3, 3],
])('scales deity, Living and Verdant weapons at level %i without changing saved gear', (level, potency, striking) => {
  for (const tag of ['deity', 'living', 'verdant']) {
    const weapon: OwnedWeapon = { ...main, potency: 0, striking: 0, livingWeapon: tag === 'living', verdantWeapon: tag === 'verdant' }
    const c: Character = { ...base, className: tag === 'deity' ? 'Cleric' : 'Ranger', level,
      feats: tag === 'deity' ? [] : [feat(tag === 'living' ? 'Living Weapon' : 'Verdant Weapon')],
      weapons: [weapon] }
    expect(effectiveWeapon(c, [sword, deity], weapon)).toMatchObject({ potency, striking })
    expect(weaponAttack(c, [sword, deity], weapon).damage).toMatch(new RegExp(`^${striking + 1}d8`))
    expect(weapon).toMatchObject({ potency: 0, striking: 0 })
  }
})

it.each([17, 18])('uses the same Peachwood grade for Living and Verdant tags at level %i', (level) => {
  for (const tag of ['living', 'verdant']) {
    const weapon: OwnedWeapon = { ...main, material: 'Orichalcum', potency: 3, striking: 3,
      livingWeapon: tag === 'living', verdantWeapon: tag === 'verdant' }
    const c: Character = { ...base, className: 'Ranger', level, weapons: [weapon], feats: [feat(tag === 'living' ? 'Living Weapon' : 'Verdant Weapon')] }
    expect(effectiveWeapon(c, [sword], weapon)).toMatchObject({
      material: level < 18 ? 'Peachwood (Standard-Grade)' : 'Peachwood (High-Grade)', potency: 3, striking: 3,
    })
    expect(effectiveWeapon({ ...c, feats: [] }, [sword], weapon).material).toBe('Orichalcum')
    expect(effectiveWeapon(c, [sword], { ...weapon, livingWeapon: false, verdantWeapon: false }).material).toBe('Orichalcum')
    expect(weapon.material).toBe('Orichalcum')
  }
})

it.each([0, 1, 2, 3])('converts armor resilient tier %i directly into its provided gauntlet striking tier', (tier) => {
  const c: Character = { ...base, armors: [{ id: 'plate', name: 'Full Plate', worn: true, potency: tier, resilient: tier, runes: ['Shadow'] }] }
  const gauntlet = ownedWeapons(c, []).find(w => w.id === GAUNTLET.id)!
  expect(effectiveWeapon(c, [], gauntlet)).toMatchObject({ potency: tier, striking: tier, runes: [] })
  expect(weaponAttack(c, [], gauntlet).damage).toMatch(new RegExp(`^${tier + 1}d4`))
  expect(effectiveWeapon(c, [], { ...gauntlet, id: 'purchased', potency: 0, striking: 0 })).toMatchObject({ potency: 0, striking: 0 })
})

it('grants one deity-favored weapon to Champions, Clerics and active Vindicator Rangers', () => {
  for (const className of ['Champion', 'Cleric', 'Ranger']) {
    const c: Character = { ...base, className, weapons: [], feats: className === 'Ranger' ? [feat('Vindicator Dedication', 2)] : [] }
    const granted = ownedWeapons(c, [sword, deity]).filter(w => w.name === sword.name)
    expect(granted).toHaveLength(1)
    expect(effectiveWeapon(c, [sword, deity], granted[0])).toMatchObject({ potency: 2, striking: 1 })
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[sword, deity]} save={() => {}} />)
    expect(markup).toContain('Favored weapon of Iomedae')
    expect(markup).not.toContain('aria-label="Remove Longsword"')
  }
  const ranger = { ...base, className: 'Ranger', weapons: [] }
  expect(ownedWeapons(ranger, [sword, deity]).some(w => w.name === sword.name)).toBe(false)
  expect(ownedWeapons({ ...ranger, level: 1, feats: [feat('Vindicator Dedication', 2)] }, [sword, deity]).some(w => w.name === sword.name)).toBe(false)
})

it('retains dormant deity weapon configuration and keeps purchased duplicates independently removable', () => {
  const c: Character = { ...base, weapons: [] }
  const granted = ownedWeapons(c, [sword, deity]).find(w => w.name === sword.name)!
  const saved = { ...granted, potency: 3, striking: 3, runes: ['Flaming'] }
  const equipped = { ...c, weapons: [{ ...main, id: 'purchased' }, saved] }
  expect(ownedWeapons(equipped, [sword, deity]).filter(w => w.name === sword.name)).toHaveLength(2)
  expect(renderToStaticMarkup(<WeaponList c={equipped} entries={[sword, deity]} save={() => {}} />).match(/aria-label="Remove Longsword"/g)).toHaveLength(1)
  expect(ownedWeapons({ ...equipped, className: 'Fighter' }, [sword, deity]).some(w => w.id === granted.id)).toBe(false)
  expect(ownedWeapons(equipped, [sword, deity]).find(w => w.id === granted.id)).toEqual(saved)
  expect(effectiveWeapon({ ...equipped, level: 2 }, [sword, deity], saved)).toMatchObject({ potency: 3, striking: 3 })
})

it('preserves a favored Fist alongside armor gauntlets and reuses an already-granted favored gauntlet', () => {
  const c: Character = { ...base, level: 19, weapons: [],
    armors: [{ id: 'armor', name: 'Full Plate', worn: true, potency: 1, resilient: 2, runes: [] }] }
  const fistDeity = { ...deity, data: { favored_weapon: 'fist' } }
  const fist = ownedWeapons(c, [fistDeity]).find(w => w.name === 'Fist')!
  expect(fist).toBeDefined()
  expect(effectiveWeapon(c, [fistDeity], fist)).toMatchObject({ potency: 3, striking: 3 })
  expect(effectiveWeapon({ ...c, handwraps: { potency: 3, striking: 3, runes: ['Flaming'] } }, [fistDeity], fist).runes).toEqual(['Flaming'])
  const gauntletDeity = { ...deity, data: { favored_weapon: 'gauntlet' } }
  const gauntlets = ownedWeapons(c, [gauntletDeity]).filter(w => w.name === 'Gauntlet')
  expect(gauntlets).toHaveLength(1)
  expect(effectiveWeapon(c, [gauntletDeity], gauntlets[0])).toMatchObject({ potency: 1, striking: 2 })
})

it.each(['Living Weapon', 'Verdant Weapon'])('does not activate %s upgrades before the granting feat is acquired', (name) => {
  const weapon = { ...main, potency: 0, striking: 0, livingWeapon: name === 'Living Weapon', verdantWeapon: name === 'Verdant Weapon' }
  const c: Character = { ...base, className: 'Ranger', weapons: [weapon], feats: [{ ...feat(name), slot: 'class:12:0' }] }
  expect(effectiveWeapon(c, [sword], weapon)).toMatchObject({ potency: 0, striking: 0 })
  expect(effectiveWeapon(c, [sword], weapon).material).toBeUndefined()
  expect(effectiveWeapon({ ...c, level: 12 }, [sword], weapon)).toMatchObject({ potency: 2, striking: 2, material: 'Peachwood (Standard-Grade)' })
})

it('gives Orichalcum one extra rune slot without increasing fundamental limits or stacking initiative circumstances', () => {
  for (const potency of [1, 2, 3]) expect(maxPropertyRunes(potency, 'Orichalcum')).toBe(potency + 1)
  expect(maxPropertyRunes(0, 'Orichalcum')).toBe(0)
  const c: Character = { ...base, armors: [{ id: 'a', name: 'Plate', material: 'Orichalcum', potency: 3, resilient: 3, worn: true, runes: [] }] }
  const normal = initiativeBonus({ ...c, armors: [] }, [])
  expect(initiativeBonus(c, [])).toBe(normal + 1)
  expect(initiativeBonus({ ...c, feats: [feat('Incredible Initiative')] }, [])).toBe(normal + 2)
  expect(initiativeBonus({ ...c, armors: c.armors!.map((armor) => ({ ...armor, worn: false })) }, [])).toBe(normal)
})

it('locks Wood-group armor to level-scaled Duskwood without changing stored material or non-Wood armor', () => {
  const wood = content('armor', 'Wooden Breastplate', { armor_group: 'Wood' })
  const armor = { id: 'armor', name: wood.name, material: 'Orichalcum' as const, potency: 3, resilient: 2, worn: true, runes: [] }
  const c: Character = { ...base, armors: [armor] }
  for (const [level, material] of [[1, 'Duskwood (Standard-Grade)'], [18, 'Duskwood (Standard-Grade)'], [19, 'Duskwood (High-Grade)']] as const) {
    const character = { ...c, level }
    expect(ownedArmors(character, [wood])[0].material).toBe(material)
    const markup = renderToStaticMarkup(<ArmorList c={character} entries={[wood]} save={() => {}} />)
    expect(markup).toContain(`aria-haspopup="dialog">${material}</button>`)
    expect(markup).not.toContain(`aria-label="Remove ${material} material"`)
    expect(markup).not.toContain('aria-label="Armor material"')
    expect(initiativeBonus(character, [wood])).toBe(initiativeBonus({ ...character, armors: [] }, [wood]))
  }
  expect(c.armors?.[0].material).toBe('Orichalcum')
  const metal = { ...wood, data: { armor_group: 'Plate' } }
  expect(ownedArmors(c, [metal])[0].material).toBe('Orichalcum')
  expect(ownedArmors({ ...c, armors: undefined, equipment: [{ name: wood.name, qty: 1 }] }, [wood])[0].material)
    .toBe('Duskwood (Standard-Grade)')
})

it('automatically chooses the deity-favored armament without requiring another weapon selection', () => {
  const c: Character = { ...base, weapons: [main], blessing: 'Blessed Armament' }
  expect(weaponAttack(c, [sword, deity], main).criticalSpecialization).toBe(true)
  const markup = renderToStaticMarkup(<ClassFeatures c={c} entries={[sword, deity]} save={() => {}} />)
  expect(markup).toContain('Blessed armament: Longsword')
  expect(markup).not.toContain('aria-label="Blessed armament"')
  expect(markup).not.toContain('Choose favored weapon')
  expect(markup).not.toContain('aria-label="Blessed armament rune" disabled')
  const second = { ...main, id: 'second' }
  const multiple = { ...c, weapons: [main, second] }
  expect(weaponAttack(multiple, [sword, deity], main).criticalSpecialization).toBe(true)
  expect(weaponAttack(multiple, [sword, deity], second).criticalSpecialization).toBe(false)
  expect(weaponAttack({ ...multiple, blessedArmament: { weaponId: second.id, rune: 'Ghost Touch' } }, [sword, deity], second).criticalSpecialization).toBe(true)
})

it('removes irrelevant active toggles while retaining their spell descriptions and damage rolls', () => {
  const names = ["Ranger's Bramble", 'Ephemeral Tracking', "Hunter's Vision"]
  const entries = names.map((name) => content('spell', name, { duration: 60 }))
  const c: Character = { ...base, className: 'Ranger', spells: names.map((name) => ({ name, rank: 3, cantrip: false })) }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  for (const name of names) {
    expect(markup).not.toContain(`aria-label="${name.replaceAll("'", '&#x27;')} active"`)
    expect(markup).toContain(name.replaceAll("'", '&#x27;'))
  }
  expect(markup).toContain('Critical failure: 4d4 persistent bleed')
})

it('locks eligible Living Weapons to Peachwood without losing dormant Orichalcum configuration', () => {
  const weapon: OwnedWeapon = { ...main, material: 'Orichalcum', livingWeapon: true, runes: ['Flaming', 'Frost', 'Shock', 'Thundering'] }
  const c = { ...base, feats: [feat('Living Weapon')] }
  expect(effectiveWeapon(c, [sword], weapon)).toMatchObject({ material: 'Peachwood (Standard-Grade)', runes: ['Flaming', 'Frost', 'Shock', 'Shifting'] })
  expect(effectiveWeapon(c, [sword], { ...weapon, livingWeapon: false })).toMatchObject({ material: 'Orichalcum', runes: weapon.runes })
  expect(effectiveWeapon(c, [{ ...sword, traits: ['Free-Hand'] }], weapon).material).toBe('Orichalcum')
  expect(weapon.runes).toHaveLength(4)
  for (const runes of [['Shifting', 'Flaming', 'Frost', 'Shock'], ['Flaming', 'Frost', 'Shock', 'Shifting']]) {
    const shifting = { ...weapon, runes }
    expect(effectiveWeapon(c, [sword], shifting).runes).toEqual(['Flaming', 'Frost', 'Shock', 'Shifting'])
    const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [shifting] }} entries={[sword]} save={() => {}} />)
    expect(markup).toContain('title="Granted by Living Weapon"')
    expect(markup).not.toContain('aria-label="Remove Shifting rune"')
  }
})

it('grants one Blessed Armament rune beyond full normal capacity only to the selected favored weapon', () => {
  const weapon: OwnedWeapon = { ...main, material: 'Orichalcum', runes: ['Flaming', 'Frost', 'Shock', 'Thundering'] }
  const c: Character = { ...base, blessing: 'Blessed Armament', blessedArmament: { weaponId: weapon.id, rune: 'Ghost Touch' } }
  expect(effectiveWeapon(c, [sword, deity], weapon).runes).toEqual([...weapon.runes, 'Ghost Touch'])
  expect(weaponAttack(c, [sword, deity], weapon).criticalSpecialization).toBe(true)
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={[sword, deity]} save={() => {}} />))
    .not.toContain('Critical specialization granted by Blessed Armament.')
  expect(effectiveWeapon({ ...c, deity: undefined }, [sword, deity], weapon).runes).toEqual(weapon.runes)
  expect(effectiveWeapon(c, [sword, deity], { ...weapon, id: 'other' }).runes).toEqual(weapon.runes)
  expect(effectiveWeapon({ ...c, level: 2 }, [sword, deity], weapon).runes).toEqual(weapon.runes)
  const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={[sword, deity]} save={() => {}} />)
  expect(markup).toContain('title="Granted by Blessed Armament"')
  expect(markup).not.toContain('aria-label="Remove Ghost Touch rune"')
  expect(markup).not.toContain('slashing + Flaming, Frost, Ghost Touch')
})

it('expands Blessed Armament choices through the required feats, levels, and sanctification', () => {
  const radiant: Character = { ...base, sanctification: 'Holy', feats: [feat('Radiant Armament', 10)] }
  expect(blessedArmamentRuneOptions(base)).not.toContain('Astral')
  expect(blessedArmamentRuneOptions(radiant, [deity])).toEqual(expect.arrayContaining(['Astral', 'Brilliant', 'Holy']))
  expect(blessedArmamentRuneOptions(radiant)).not.toContain('Unholy')
  expect(blessedArmamentRuneOptions({ ...radiant, level: 9 })).not.toContain('Astral')
  const paragon = { ...radiant, level: 20, feats: [...radiant.feats, feat('Armament Paragon', 20)] }
  expect(blessedArmamentRuneOptions(paragon)).toEqual(expect.arrayContaining(['Fearsome (Greater)', 'Astral (Greater)', 'Brilliant (Greater)']))
  expect(blessedArmamentRuneOptions({ ...paragon, feats: [feat('Armament Paragon', 20)] })).not.toContain('Astral (Greater)')
})

it('locks required deity sanctification, restricts optional choices, and deactivates incompatible saved runes', () => {
  const c: Character = { ...base, sanctification: 'Unholy', blessing: 'Blessed Armament',
    feats: [feat('Radiant Armament', 10)], weapons: [main, { ...main, id: 'bow', name: 'Longbow' }],
    blessedArmament: { weaponId: main.id, rune: 'Holy' } }
  expect(deitySanctification(c, [deity])).toEqual({ options: ['Holy'], required: 'Holy', selected: 'Holy' })
  expect(blessedArmamentRuneOptions(c, [deity])).toContain('Holy')
  expect(blessedArmamentRuneOptions(c, [deity])).not.toContain('Unholy')
  expect(effectiveWeapon(c, [sword, deity], main).runes).toContain('Holy')
  expect(blessedArmamentTargets(c, [sword, deity]).map((weapon) => weapon.id)).toEqual([main.id])
  const markup = renderToStaticMarkup(<ClassFeatures c={c} entries={[sword, deity]} save={() => {}} />)
  expect(markup).toContain('<select aria-label="Sanctification" disabled=""><option selected="">Holy</option></select>')
  expect(markup).not.toContain('>Longbow</option>')
  const optional = { ...deity, data: { ...deity.data, sanctification_required: false } }
  expect(deitySanctification(c, [optional]).selected).toBeUndefined()
  expect(deitySanctification({ ...c, sanctification: 'Holy' }, [optional]).selected).toBe('Holy')
  expect(effectiveWeapon(c, [sword, optional], main).runes).not.toContain('Holy')
  const neutral = { ...deity, data: { favored_weapon: 'longsword' } }
  expect(deitySanctification(c, [neutral]).options).toEqual([])
  const both = { ...deity, data: { ...deity.data, sanctification: 'holy, unholy', sanctification_required: false } }
  expect(deitySanctification(c, [both]).selected).toBe('Unholy')
  expect(effectiveWeapon(c, [sword, both], main).runes).not.toContain('Holy')
})

it('requires Second Blessing for Third Blessing and prevents duplicate blessing choices', () => {
  const c: Character = { ...base, level: 16, blessing: 'Blessed Shield', feats: [
    { ...feat('Second Blessing', 8, 'Blessed Armament'), slot: 'class:8:0' },
    { ...feat('Third Blessing', 16, 'Blessed Swiftness'), slot: 'class:16:0' },
  ] }
  const options = homebrewCharacterOptions([])
  const slot = plannedSlots(c).find((slot) => slot.category === 'class' && slot.level === 16)!
  expect(eligibleFeats(options, { ...c, feats: [] }, slot).map((entry) => entry.name)).not.toContain('Third Blessing')
  expect(eligibleFeats(options, { ...c, feats: c.feats.slice(0, 1) }, slot).map((entry) => entry.name)).toContain('Third Blessing')
  expect(featChoiceOptions('Third Blessing', c, [], 'class:16:0')).toEqual(['Blessed Swiftness'])
  expect(championBlessings(c)).toEqual(['Blessed Shield', 'Blessed Armament', 'Blessed Swiftness'])
  expect(championBlessings({ ...c, feats: c.feats.slice(1) })).toEqual(['Blessed Shield'])
  expect(effectiveWeapon({ ...c, blessedArmament: { weaponId: main.id, rune: 'Ghost Touch' } }, [sword, deity], main).runes).toEqual(['Ghost Touch'])
})

it('offers distinct additional innovations at levels 8 and 16 and requires Second Innovation for Third', () => {
  const innovations = ['Weapon', 'Construct', 'Armor'].map((name) => content('subclass', name, { class: 'Inventor' }))
  const entries = [...homebrewCharacterOptions([]), ...innovations]
  const c: Character = { ...base, className: 'Inventor', subclass: 'Construct', level: 16,
    feats: [{ ...feat('Second Innovation', 8, 'Armor'), slot: 'class:8:0' }] }
  const slot = plannedSlots(c).find((slot) => slot.category === 'class' && slot.level === 16)!
  expect(entries.find((entry) => entry.name === 'Second Innovation')).toMatchObject({ level: 8, traits: ['Inventor'], source: 'homebrew' })
  expect(entries.find((entry) => entry.name === 'Third Innovation')).toMatchObject({ level: 16, data: { prerequisite: 'Second Innovation' } })
  expect(featChoiceOptions('Second Innovation', { ...c, feats: [] }, entries, 'class:8:0')).toEqual(['Armor', 'Weapon'])
  expect(featChoiceOptions('Third Innovation', c, entries, slot.key)).toEqual(['Weapon'])
  expect(eligibleFeats(entries, c, slot).map((entry) => entry.name)).toContain('Third Innovation')
  expect(eligibleFeats(entries, { ...c, feats: [] }, slot).map((entry) => entry.name)).not.toContain('Third Innovation')
  expect(eligibleFeats(entries, { ...c, feats: [{ ...feat('Second Innovation', 18), slot: 'class:18:0' }] }, slot).map((entry) => entry.name)).not.toContain('Third Innovation')
  expect(featChoiceOptions('Third Innovation', { ...c, feats: [...c.feats, { ...feat('Third Innovation', 16, 'Weapon'), slot: slot.key }] }, entries, slot.key)).toEqual(['Weapon'])
})

it('offers Impaling Throw as a level-one Ranger action with its embedded-weapon rules', () => {
  const entries = homebrewCharacterOptions([])
  const c: Character = { ...base, className: 'Ranger', level: 1 }
  const slot = plannedSlots(c).find((slot) => slot.category === 'class' && slot.level === 1)!
  const impaling = eligibleFeats(entries, c, slot).find((entry) => entry.name === 'Impaling Throw')!
  expect(impaling).toMatchObject({ level: 1, source: 'homebrew', traits: ['Flourish', 'Ranger', '3rd Party'],
    data: { class: 'Ranger', actions: 'Single Action' } })
  expect(impaling.description).toContain('Athletics or Medicine skill check against your class DC')
  expect(impaling.description).toContain('clumsy 1')
  expect(impaling.description).toContain('weapons without the thrown trait that deal piercing damage')
  expect(eligibleFeats(entries, base, slot).map((entry) => entry.name)).not.toContain('Impaling Throw')
})

it('offers Impaled Takedown at level four without inventing an Impaling Throw prerequisite', () => {
  const entries = homebrewCharacterOptions([])
  const c: Character = { ...base, className: 'Ranger', level: 4 }
  const slot = plannedSlots(c).find((slot) => slot.category === 'class' && slot.level === 4)!
  const takedown = eligibleFeats(entries, c, slot).find((entry) => entry.name === 'Impaled Takedown')!
  expect(takedown).toMatchObject({ level: 4, source: 'homebrew', traits: ['Flourish', 'Ranger', '3rd Party'],
    data: { class: 'Ranger', actions: 'Single Action' } })
  expect(takedown.description).toContain('Shove or Trip')
  expect(takedown.description).toContain('off-guard to your next strike')
  expect(takedown.description).toContain('clumsy 2 until the weapon is removed')
  expect(takedown.data.prerequisite).toBeUndefined()
  expect(eligibleFeats(entries, c, { ...slot, level: 2 }).map((entry) => entry.name)).not.toContain(takedown.name)
  expect(eligibleFeats(entries, base, slot).map((entry) => entry.name)).not.toContain(takedown.name)
})

it('copies Deadly Simplicity for Champion and offers it only with a trained simple or unarmed favored weapon', () => {
  const official = content('feat', 'Deadly Simplicity', { class: 'Cleric',
    prerequisite: "deity with a simple or unarmed attack favored weapon, trained with your deity's favored weapon" }, 1, ['Cleric'])
  const champion = content('class', 'Champion', { attack_proficiency: 'Trained in simple weapons' })
  const staff = content('weapon', 'Staff', { weapon_category: 'Simple', damage: '1d4 bludgeoning' })
  const staffDeity = { ...deity, data: { favored_weapon: 'staff' } }
  const entries = [official, champion, staff, staffDeity, ...homebrewCharacterOptions([official])]
  const copy = entries.find((entry) => entry.id === 'homebrew:champion-deadly-simplicity')!
  expect(copy).toMatchObject({ name: official.name, level: 1, source: 'homebrew', traits: ['Champion'],
    data: { class: 'Champion', prerequisite: official.data.prerequisite } })
  expect(official.traits).toEqual(['Cleric'])
  const slot = plannedSlots(base).find((slot) => slot.category === 'class' && slot.level === 1)!
  expect(eligibleFeats(entries, base, slot).map((entry) => entry.id)).toContain(copy.id)
  expect(eligibleFeats(entries.filter((entry) => entry !== champion), base, slot).map((entry) => entry.id)).not.toContain(copy.id)
  expect(eligibleFeats(entries, { ...base, deity: undefined }, slot).map((entry) => entry.id)).not.toContain(copy.id)
  expect(eligibleFeats([official, champion, sword, deity, copy], base, slot).map((entry) => entry.id)).not.toContain(copy.id)
  const irori = { ...deity, data: { favored_weapon: 'fist' } }
  expect(eligibleFeats([official, champion, irori, copy], base, slot).map((entry) => entry.id)).toContain(copy.id)
})

it('increases all Deadly Simplicity simple weapon dice by one step, retaining striking and flat damage', () => {
  const champion = content('class', 'Champion', { attack_proficiency: 'Trained in simple weapons, Trained in martial weapons' })
  const staffDeity = { ...deity, data: { favored_weapon: 'staff' } }
  const c: Character = { ...base, feats: [feat('Deadly Simplicity')] }
  const weapon = { ...main, name: 'Staff', striking: 3 }
  for (const [before, after] of [[4, 6], [6, 8], [8, 10], [10, 12], [12, 12]]) {
    const staff = content('weapon', 'Staff', { weapon_category: 'Simple', damage: `1d${before} bludgeoning` })
    const entries = [champion, staffDeity, staff]
    expect(weaponAttack(c, entries, weapon).damage).toBe(`4d${after}+1 bludgeoning`)
    for (const patch of [{ feats: [] }, { deity: undefined }])
      expect(weaponAttack({ ...c, ...patch }, entries, weapon).damage).toBe(`4d${before}+1 bludgeoning`)
    expect(weaponAttack(c, [staffDeity, staff], weapon).damage).toBe(`4d${before}+1 bludgeoning`)
    const unrelated = { ...staffDeity, data: { favored_weapon: 'club' } }
    expect(weaponAttack(c, [champion, unrelated, staff], weapon).damage).toBe(`4d${before}+1 bludgeoning`)
    const martial = { ...staff, data: { ...staff.data, weapon_category: 'Martial' } }
    expect(weaponAttack(c, [champion, staffDeity, martial], weapon).damage).toBe(`4d${before}+1 bludgeoning`)
  }
  const staff = content('weapon', 'Staff', { weapon_category: 'Simple', damage: '1d4 bludgeoning' })
  const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={[champion, staffDeity, staff]} save={() => {}} />)
  expect(markup).toContain('Damage 4d6+1 B')
})

it('caps Deadly Simplicity favored unarmed improvements at d6 without shrinking larger attacks', () => {
  const c: Character = { ...base, feats: [feat('Deadly Simplicity')], handwraps: { potency: 1, striking: 2, runes: [] } }
  for (const [before, after] of [[4, 6], [6, 6], [8, 8]]) {
    const attack = content('weapon', 'Divine Claw', { weapon_category: 'Unarmed', damage: `1d${before} slashing` }, 0, ['Unarmed'])
    const favored = { ...deity, data: { favored_weapon: 'divine claw' } }
    const weapon = { ...main, name: attack.name }
    expect(weaponAttack(c, [attack, favored], weapon).damage).toBe(`3d${after}+1 slashing`)
    expect(weaponAttack({ ...c, feats: [] }, [attack, favored], weapon).damage).toBe(`3d${before}+1 slashing`)
  }
})

it('requires Living Weapon and Wild Hunter Dedication for Pristine Living Weapon at level fourteen', () => {
  const dedication = content('feat', 'Wild Hunter Dedication', { archetype: 'Wild Hunter' }, 2, ['Archetype', 'Dedication'])
  const entries = [...homebrewCharacterOptions([]), dedication]
  const c: Character = { ...base, level: 14, feats: [feat('Wild Hunter Dedication', 2), feat('Living Weapon', 8)] }
  const slot = { key: 'archetype:14:0', level: 14, category: 'archetype' as const }
  expect(eligibleFeats(entries, c, slot).map((entry) => entry.name)).toContain('Pristine Living Weapon')
  const pristine = entries.find((entry) => entry.name === 'Pristine Living Weapon')!
  expect(pristine).toMatchObject({ level: 14, traits: ['Archetype'],
    data: { archetype: 'Wild Hunter', prerequisite: 'Living Weapon, Wild Hunter Dedication' } })
  expect(pristine.description).not.toContain('verdant')
  for (const feats of [[], c.feats.slice(0, 1), c.feats.slice(1), [c.feats[0], feat('Living Weapon', 16)]])
    expect(eligibleFeats(entries, { ...c, feats }, slot).map((entry) => entry.name)).not.toContain(pristine.name)
  expect(eligibleFeats(entries, c, { ...slot, level: 12 }).map((entry) => entry.name)).not.toContain(pristine.name)
})

it('treats Living Weapons and inherited haft strikes as cold iron and silver without adding unconditional bleed', () => {
  const polearm = content('weapon', 'Glaive', { hands: 2, weapon_group: 'Polearm', damage: '1d8 slashing' })
  const weapon = { ...main, name: polearm.name, livingWeapon: true }
  const c: Character = { ...base, level: 14, weapons: [weapon], feats: [
    feat('Wild Hunter Dedication', 2), feat('Living Weapon', 8), feat('Pristine Living Weapon', 14), feat('Haft Striker Stance', 4),
  ] }
  const ordinary = { ...weapon, id: 'ordinary', livingWeapon: false }
  const entries = [polearm]
  const haft = ownedWeapons(c, entries).find((weapon) => weapon.name === HAFT_STRIKER_WEAPON.name)!
  for (const strike of [weapon, haft]) {
    const attack = weaponAttack(c, entries, strike)
    expect(attack.pristineLivingWeapon).toBe(true)
    expect(attack.damage).not.toContain('bleed')
    expect(effectiveWeapon(c, entries, strike).material).toBe('Peachwood (Standard-Grade)')
  }
  expect(weaponAttack(c, entries, ordinary).pristineLivingWeapon).toBe(false)
  for (const missing of ['Wild Hunter Dedication', 'Living Weapon', 'Pristine Living Weapon']) {
    expect(weaponAttack({ ...c, feats: c.feats.filter((feat) => feat.name !== missing) }, entries, weapon).pristineLivingWeapon).toBe(false)
  }
  expect(weaponAttack({ ...c, level: 13 }, entries, weapon).pristineLivingWeapon).toBe(false)
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('treated as cold iron and silver')
  expect(markup).toContain('Critical hit against a creature with a weakness to cold iron or silver: 1d6 persistent bleed.')
  expect(markup).toMatch(/Material<button[^>]*>\*<\/button> \(Pristine Living Weapon\)/)
  expect(markup).not.toContain('Damage 2d8+1 S + 1d6')
})

it('excludes separately owned blessing grants as well as the primary blessing', () => {
  const c: Character = { ...base, blessing: 'Blessed Shield', feats: [feat('Blessed Armament')] }
  expect(featChoiceOptions('Second Blessing', c, [], 'class:8:0')).toEqual(['Blessed Swiftness'])
  expect(featChoiceOptions('Second Blessing', { ...c, feats: [...c.feats, feat('Blessed Swiftness')] }, [], 'class:8:0')).toEqual([])
})

it('applies Jousting only to qualifying selected verdant, living, or favored one-handed melee weapons', () => {
  const c = { ...base, level: 14, feats: ['Favored Weapon Jousting', 'Verdant Weapon Jousting', 'Living Weapon Joust', 'Living Weapon'].map((name) => feat(name)) }
  expect(weaponAttack(c, [sword, deity], main).traits).toContain('Jousting')
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [main] }} entries={[sword, deity]} save={() => {}} />))
    .not.toContain('Jousting while riding')
  const other = { ...main, name: 'Other' }
  const otherEntry = { ...sword, name: 'Other' }
  expect(weaponAttack(c, [otherEntry, deity], other).traits).not.toContain('Jousting')
  expect(weaponAttack(c, [otherEntry, deity], { ...other, verdantWeapon: true }).traits).toContain('Jousting')
  expect(weaponAttack(c, [otherEntry, deity], { ...other, livingWeapon: true }).traits).toContain('Jousting')
  expect(weaponAttack({ ...c, level: 13 }, [otherEntry, deity], { ...other, livingWeapon: true }).traits).not.toContain('Jousting')
  const nonJousting: ContentEntry['data'][] = [{ hands: 2 }, { hands: 1, weapon_type: 'Ranged', range: 20 }]
  for (const data of nonJousting) {
    expect(weaponAttack(c, [{ ...sword, data: { ...sword.data, ...data } }, deity], { ...main, livingWeapon: true, verdantWeapon: true }).traits).not.toContain('Jousting')
  }
})

it('grants Living Weapon Joust to the one-handed haft attack, not its two-handed source', () => {
  const spear = content('weapon', "Dancer's Spear", { hands: 2, weapon_group: 'Spear', damage: '1d6 piercing' })
  const source = { ...main, name: spear.name, livingWeapon: true }
  const c: Character = { ...base, level: 14, weapons: [source], feats: [
    feat('Living Weapon', 8), feat('Living Weapon Joust', 14), feat('Haft Striker Stance', 4),
  ] }
  const legacyHaft = { ...HAFT_STRIKER_WEAPON, data: { weapon_category: 'Simple', weapon_group: 'Club', weapon_type: 'Melee', damage: '1d4 bludgeoning' } }
  const entries = [spear, legacyHaft]
  const haft = ownedWeapons(c, entries).find(weapon => weapon.name === HAFT_STRIKER_WEAPON.name)!
  expect(weaponAttack(c, entries, haft).entry?.data.hands).toBe(1)
  expect(weaponAttack(c, entries, haft).traits).toContain('Jousting')
  expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />))
    .toContain('class="gear-trait" aria-haspopup="dialog">Jousting</button>')
  expect(weaponAttack(c, [spear], source).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, level: 13 }, [spear], haft).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, feats: c.feats.filter(feat => feat.name !== 'Living Weapon Joust') }, [spear], haft).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, weapons: [{ ...source, livingWeapon: false }] }, [spear], haft).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, weapons: [] }, [spear], haft).traits).not.toContain('Jousting')
})

it.each(['Verdant Weapon Jousting', 'Favored Weapon Jousting'])('uses the selected haft source for %s', name => {
  const spear = content('weapon', 'Spear', { hands: 2, weapon_group: 'Spear', damage: '1d6 piercing' })
  const source = { ...main, name: spear.name, verdantWeapon: name === 'Verdant Weapon Jousting' }
  const c: Character = { ...base, level: 10, weapons: [source],
    feats: [feat(name, 4), feat('Haft Striker Stance', 4)] }
  const patron = { ...deity, data: { ...deity.data, favored_weapon: spear.name } }
  const entries = [spear, patron]
  const haft = ownedWeapons(c, entries).find(weapon => weapon.name === HAFT_STRIKER_WEAPON.name)!
  expect(weaponAttack(c, entries, haft).traits).toContain('Jousting')
  expect(weaponAttack(c, entries, source).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, feats: c.feats.filter(feat => feat.name !== name) }, entries, haft).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, level: 3 }, entries, haft).traits).not.toContain('Jousting')
})

it.each([[5, 'Low-Grade'], [9, 'Low-Grade'], [10, 'Standard-Grade'], [15, 'Standard-Grade'], [16, 'High-Grade']] as const)('scales locked Cold Iron Tusks material at level %i without granting independent unarmed runes', (level, grade) => {
  const c = { ...base, level, feats: [feat('Cold Iron Tusks', 5)] }
  const tusks = ownedWeapons(c, []).find((weapon) => weapon.name === ORC_TUSKS.name)!
  expect(effectiveWeapon(c, [], tusks)).toMatchObject({ material: `Cold Iron (${grade})`, potency: 0, striking: 0, runes: [] })
  expect(effectiveWeapon({ ...c, handwraps: { potency: 2, striking: 1, runes: ['Flaming'] } }, [], tusks))
    .toMatchObject({ potency: level >= 16 ? 3 : 2, striking: level >= 12 ? 2 : 1, runes: ['Flaming'] })
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain(`aria-haspopup="dialog">Cold Iron (${grade})</button>`)
  expect(markup).not.toContain(`aria-label="Remove Cold Iron (${grade}) material"`)
  expect(markup).not.toContain('Configure unarmed potency')
  expect(markup).not.toContain('locked by Cold Iron Tusks')
  expect(ownedWeapons({ ...c, level: 4 }, []).map((weapon) => weapon.name)).not.toContain('Tusks')
})

it('applies Animal Feature senses, movement, and level gates without changing land Speed', () => {
  const c: Character = { ...base, level: 7, className: 'Ranger', activeSpells: ['Animal Feature'], animalFeature: 'Cat Eyes',
    feats: [feat('Advanced Warden', 4, 'Animal Feature'), feat('Fleet'), feat('Primal Nimbleness')] }
  expect(senses(c, []).map((sense) => sense.value)).toContain('Low-Light Vision')
  expect(senses({ ...c, animalFeature: 'Owl Eyes' }, []).map((sense) => sense.value)).toContain('Darkvision')
  expect(movementSpeeds({ ...c, animalFeature: 'Fish Tail' }, [])).toEqual([{ name: 'Land', feet: 35 }, { name: 'Swim', feet: 35, source: 'Animal Feature' }])
  expect(movementSpeeds({ ...c, animalFeature: 'Wings' }, [])).toEqual([{ name: 'Land', feet: 35 }, { name: 'Fly', feet: 35, source: 'Animal Feature' }])
  expect(activeAnimalFeatures({ ...c, animalFeature: 'Wings', level: 6 }, [])).toEqual([])
  expect(senses({ ...c, activeSpells: [] }, [])).toEqual([])
  expect(movementSpeeds({ ...c, animalFeature: 'Wings', feats: [] }, [])).toEqual([{ name: 'Land', feet: 25 }])
})

it('gates Barbarian senses on Rage and acquisition level without granting Nocturnal Senses low-light vision', () => {
  const nocturnal = content('feat', 'Nocturnal Senses', { grants_vision: 'Low-Light Vision' }, 6, ['Barbarian'])
  const elf = content('ancestry', 'Elf', { vision: 'Low-Light Vision' })
  const c: Character = { ...base, className: 'Barbarian', level: 6, raging: true,
    feats: [feat('Acute Scent', 2), feat('Nocturnal Senses', 6)] }
  expect(senses(c, [nocturnal])).toEqual([{ value: 'Scent (imprecise) 60 feet', source: 'Nocturnal Senses' }])
  expect(senses({ ...c, raging: false }, [nocturnal])).toEqual([])
  expect(senses({ ...c, feats: [feat('Nocturnal Senses', 6)] }, [nocturnal])).toEqual([])
  expect(senses({ ...c, level: 5 }, [nocturnal])).toEqual([{ value: 'Scent (imprecise) 30 feet', source: 'Acute Scent' }])
  expect(senses({ ...c, ancestry: 'Elf' }, [nocturnal, elf])).toContainEqual({ value: 'Darkvision', source: 'Nocturnal Senses' })
  expect(senses({ ...c, ancestry: 'Elf', raging: false }, [nocturnal, elf])).toEqual([{ value: 'Low-Light Vision', source: 'Elf' }])
  const delayed = { ...c, feats: [{ ...feat('Acute Vision'), slot: 'class:8:0' }] }
  expect(senses(delayed, [])).toEqual([])
  expect(senses({ ...delayed, level: 8 }, [])).toEqual([{ value: 'Darkvision', source: 'Acute Vision' }])
  expect(senses({ ...delayed, level: 8, raging: false }, [])).toEqual([])
})

it('keeps only the strongest imprecise scent when Rage feats overlap Keen Smell', () => {
  const c: Character = { ...base, level: 6, raging: true, activeSpells: ['Keen Smell'],
    spells: [{ name: 'Keen Smell', rank: 1, cantrip: false }],
    feats: [feat('Acute Scent', 2), feat('Nocturnal Senses', 6)] }
  expect(senses(c, [])).toEqual([{ value: 'Scent (imprecise) 60 feet', source: 'Keen Smell' }])
  expect(senses({ ...c, activeSpells: [] }, [])).toEqual([{ value: 'Scent (imprecise) 60 feet', source: 'Nocturnal Senses' }])
})

it('grants Natural Swimmer its swim Speed without reducing existing swimming or spending land Speed', () => {
  const c: Character = { ...base, className: 'Druid', level: 4, feats: [feat('Natural Swimmer', 4)] }
  expect(movementSpeeds(c, [])).toEqual([{ name: 'Land', feet: 25 }, { name: 'Swim', feet: 15, source: 'Natural Swimmer' }])
  expect(movementSpeeds({ ...c, level: 3 }, [])).toEqual([{ name: 'Land', feet: 25 }])
  expect(movementSpeeds({ ...c, level: 7, activeSpells: ['Animal Feature'], animalFeature: 'Fish Tail',
    spells: [{ name: 'Animal Feature', rank: 2, cantrip: false }] }, [])).toEqual([
    { name: 'Land', feet: 25 }, { name: 'Swim', feet: 25, source: 'Animal Feature' },
  ])
})

it('gives Raging Athlete full land-Speed climbing and swimming only during Rage and merges overlapping speeds', () => {
  const c: Character = { ...base, className: 'Barbarian', level: 4, raging: true,
    feats: [feat('Raging Athlete', 4), feat('Fleet'), feat('Natural Swimmer', 4)] }
  expect(movementSpeeds(c, [])).toEqual([
    { name: 'Land', feet: 30 }, { name: 'Climb', feet: 30, source: 'Raging Athlete' }, { name: 'Swim', feet: 30, source: 'Raging Athlete' },
  ])
  expect(movementSpeeds({ ...c, raging: false }, [])).toEqual([
    { name: 'Land', feet: 30 }, { name: 'Swim', feet: 15, source: 'Natural Swimmer' },
  ])
  expect(movementSpeeds({ ...c, level: 3 }, [])).toEqual([{ name: 'Land', feet: 30 }])
  const overlap = { ...c, spells: [{ name: 'Canopy Crawler', rank: 2, cantrip: false }], activeSpells: ['Canopy Crawler'] }
  expect(movementSpeeds(overlap, []).filter((movement) => movement.name === 'Climb')).toEqual([
    { name: 'Climb', feet: 30, source: 'Raging Athlete, Canopy Crawler' },
  ])
})

it('does not use future Speed feats to increase current Rage movement or Leap distance', () => {
  const c: Character = { ...base, level: 6, raging: true,
    feats: [feat('Raging Athlete', 4), { ...feat('Fleet'), slot: 'general:7:0' }] }
  expect(movementSpeeds(c, []).map((movement) => movement.feet)).toEqual([25, 25, 25])
  expect(ragingAthleteBenefits(c, [])?.horizontalLeap).toBe(15)
  expect(movementSpeeds({ ...c, level: 7 }, []).map((movement) => movement.feet)).toEqual([30, 30, 30])
  expect(ragingAthleteBenefits({ ...c, level: 7 }, [])?.horizontalLeap).toBe(20)
})

it.each([[14, undefined], [15, 15], [29, 15], [30, 20]])('uses actual Speed %i for Raging Athlete Leap thresholds', (feet, horizontalLeap) => {
  const ancestry = content('ancestry', 'Test ancestry', { speed: feet })
  const c: Character = { ...base, ancestry: ancestry.name, raging: true, feats: [feat('Raging Athlete', 4)] }
  expect(ragingAthleteBenefits(c, [ancestry])).toEqual({ jumpDCAdjustment: -10, longJumpExtra: 10, verticalLeap: 5, horizontalLeap })
  expect(ragingAthleteBenefits({ ...c, raging: false }, [ancestry])).toBeUndefined()
  expect(ragingAthleteBenefits({ ...c, level: 3 }, [ancestry])).toBeUndefined()
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ancestry]} save={() => {}} part="offense" />)
  expect(markup).toContain('Jump DCs -10')
  if (horizontalLeap) expect(markup).toContain(`${horizontalLeap} ft. horizontal`)
})

it('upgrades Superior Sight from other low-light sources, never from its own metadata, with acquisition gating', () => {
  const sight = content('feat', 'Superior Sight', { grants_vision: 'Low-Light Vision' }, 20, ['Ranger'])
  const elf = content('ancestry', 'Elf', { vision: 'Low-Light Vision' })
  const c: Character = { ...base, className: 'Ranger', level: 20, feats: [feat(sight.name, 20)] }
  expect(senses(c, [sight])).toEqual([{ value: 'Low-Light Vision', source: 'Superior Sight' }])
  expect(senses({ ...c, ancestry: 'Elf' }, [sight, elf])).toContainEqual({ value: 'Darkvision', source: 'Superior Sight' })
  expect(senses({ ...c, level: 19 }, [sight])).toEqual([])
  const future = content('feat', 'Later Vision', { grants_vision: 'Darkvision' })
  expect(senses({ ...c, level: 19, feats: [{ ...feat(future.name), slot: 'ancestry:20:0' }] }, [future])).toEqual([])
})

it('applies Superior Sight to Perception and initiative without stacking circumstance bonuses', () => {
  const c: Character = { ...base, className: 'Ranger', level: 20, feats: [feat('Superior Sight', 20)] }
  const normal = defenseSummary({ ...c, feats: [] }, []).perception
  expect(defenseSummary(c, []).perception).toBe(normal + 2)
  expect(initiativeBonus(c, [])).toBe(normal + 2)
  expect(initiativeBonus({ ...c, feats: [...c.feats, feat('Incredible Initiative')] }, [])).toBe(normal + 2)
  expect(defenseSummary({ ...c, level: 19 }, []).perception).toBe(defenseSummary({ ...c, level: 19, feats: [] }, []).perception)
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="offense" />)
  expect(markup).toContain(`Perception <b>${normal + 2 >= 0 ? '+' : ''}${normal + 2}</b>`)
  expect(markup).toContain('<small>Circumstance</small>+2')
})

it('grants Animal Skin expert unarmored proficiency outside Rage, with Rage-only AC and Dexterity cap', () => {
  const barbarian = content('class', 'Barbarian', { defense_proficiency: 'Trained in unarmored defense', medium_armor_proficiency: 'Trained' })
  const greater = content('classFeature', 'Greater Juggernaut', { class: 'Barbarian' }, 13)
  const c: Character = { ...base, level: 6, className: 'Barbarian', feats: [feat('Animal Skin', 6)] }
  const data = [barbarian, greater]
  expect(armorRanks(c, data).Unarmored).toBe(2)
  expect(armorClass(c, data)).toBe(24)
  expect(animalSkinBenefits(c, data)).toBeUndefined()
  expect(armorClass({ ...c, raging: true }, data)).toBe(25)
  expect(animalSkinBenefits({ ...c, raging: true }, data)).toEqual({ itemBonus: 2, dexCap: 3 })
  expect(armorClass({ ...c, level: 13, raging: true }, data)).toBe(33)
  const delayed = { ...c, feats: [{ ...c.feats[0], slot: 'class:8:0' }] }
  expect(armorRanks(delayed, data).Unarmored).toBe(1)
  expect(animalSkinBenefits({ ...delayed, raging: true }, data)).toBeUndefined()
  const mastery = { ...content('classFeature', 'Unarmored Mastery', { class: 'Barbarian' }, 13),
    description: 'Your proficiency rank for unarmored defense increases to master.' }
  expect(armorRanks({ ...c, level: 13 }, [...data, mastery]).Unarmored).toBe(3)
})

it('stacks Animal Skin with explorer clothing potency and shields, but never applies the hide to armor', () => {
  const barbarian = content('class', 'Barbarian', { defense_proficiency: 'Trained in unarmored defense', medium_armor_proficiency: 'Trained' })
  const clothing = content('armor', "Explorer's Clothing", { armor_category: 'Unarmored', ac: 0, dex_cap: 5 })
  const plate = content('armor', 'Breastplate', { armor_category: 'Medium', ac: 4, dex_cap: 1 })
  const armor = { id: 'armor', name: clothing.name, potency: 2, resilient: 0, runes: [], worn: true }
  const c: Character = { ...base, level: 6, className: 'Barbarian', raging: true, feats: [feat('Animal Skin', 6)], armors: [armor] }
  const data = [barbarian, clothing, plate]
  expect(armorClass(c, data)).toBe(27)
  expect(armorClass({ ...c, shield: { id: 's', name: 'Shield', hardness: 5, hp: 20, damage: 0, raised: true } }, data)).toBe(29)
  const armored = { ...c, armors: [{ ...armor, name: plate.name }] }
  expect(animalSkinBenefits(armored, data)).toBeUndefined()
  expect(armorClass(armored, data)).toBe(armorClass({ ...armored, feats: [] }, data))
  const legacy = { ...armored, armors: undefined, equipment: [{ name: plate.name, qty: 1 }] }
  expect(animalSkinBenefits(legacy, data)).toBeUndefined()
  expect(animalSkinBenefits({ ...c, armors: [{ ...armor, name: 'Unknown armor' }] }, data)).toBeUndefined()
})

it('derives Primal Aegis from current Wisdom without granting future, absent or negative resistance', () => {
  const c: Character = { ...base, className: 'Druid', level: 18, abilities: { ...base.abilities, wis: 18 }, feats: [feat('Primal Aegis', 18)] }
  const expected = ['Acid', 'Cold', 'Electricity', 'Fire', 'Vitality', 'Void'].map((damage) => ({ damage, value: 4, source: 'Primal Aegis' }))
  expect(resistances(c, [])).toEqual(expected)
  expect(resistances({ ...c, abilities: { ...c.abilities, wis: 20 } }, []).every((resistance) => resistance.value === 5)).toBe(true)
  expect(resistances({ ...c, abilities: { ...c.abilities, wis: 8 } }, [])).toEqual([])
  expect(resistances({ ...c, level: 17 }, [])).toEqual([])
  expect(resistances({ ...c, feats: [] }, [])).toEqual([])
})

it('alphabetizes resistance types in the Defense display', () => {
  const fire = content('feat', 'Fire Guard', { resistances: 'fire=5' })
  const acid = content('feat', 'Acid Guard', { resistances: 'acid=3' })
  const c = { ...base, feats: [feat(fire.name), feat(acid.name)] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[fire, acid]} save={() => {}} part="defense" />)
  expect(markup.indexOf('Acid 3')).toBeGreaterThan(-1)
  expect(markup.indexOf('Acid 3')).toBeLessThan(markup.indexOf('Fire 5'))
})

it.each([[10, 3], [11, 3], [12, 4], [15, 4], [16, 5], [19, 5], [20, 6]])('activates Harden Flesh resistance %i -> %i with its adamantine exception', (level, value) => {
  const c: Character = { ...base, className: 'Druid', level, feats: [feat('Harden Flesh', 10)], activeFeatEffects: ['Harden Flesh'] }
  expect(resistances(c, [])).toEqual([{ damage: 'Physical (except adamantine)', value, source: 'Harden Flesh' }])
  expect(resistances({ ...c, activeFeatEffects: [] }, [])).toEqual([])
  expect(resistances({ ...c, level: 9 }, [])).toEqual([])
  expect(resistances({ ...c, feats: [] }, [])).toEqual([])
})

it('never treats kaiju form resistance or future feat resistance metadata as permanent', () => {
  const kaiju = content('feat', 'Heart of the Kaiju', { resistances: 'physical=5' }, 20, ['Druid'])
  const poison = content('feat', 'Poison Resistance', { resistances: 'poison=half' }, 2, ['Druid'])
  const c: Character = { ...base, className: 'Druid', level: 20, feats: [feat(kaiju.name, 20)] }
  expect(resistances(c, [kaiju])).toEqual([])
  const active = { ...c, ...featEffectChange(c, kaiju.name, true) }
  expect(resistances(active, [kaiju])).toEqual([{ damage: 'Physical', value: 5, source: kaiju.name }])
  expect(resistances(JSON.parse(JSON.stringify(active)) as Character, [kaiju])).toEqual(resistances(active, [kaiju]))
  expect(resistances({ ...active, level: 19 }, [kaiju])).toEqual([])
  expect(resistances({ ...c, level: 1, feats: [feat(poison.name, 2)] }, [poison])).toEqual([])
  expect(featEffectChange(active, 'Harden Flesh', true).activeFeatEffects).toEqual([kaiju.name, 'Harden Flesh'])
  expect(featEffectChange(active, kaiju.name, true).activeFeatEffects).toEqual([kaiju.name])
  expect(featEffectChange(active, kaiju.name, false).activeFeatEffects).toEqual([])
  expect(c.activeFeatEffects).toBeUndefined()
})

it('limits Hazard Finder to hazard checks, does not stack it with shields, and never boosts initiative', () => {
  const c: Character = { ...base, className: 'Ranger', level: 8, feats: [feat('Hazard Finder', 8)], activeFeatEffects: ['Hazard Finder'] }
  const normal = defenseSummary({ ...c, activeFeatEffects: [] }, [])
  const hazard = defenseSummary(c, [])
  expect(hazard.perception).toBe(normal.perception + 1)
  expect(hazard.ac).toBe(normal.ac + 1)
  expect(hazard.fortitude).toBe(normal.fortitude + 1)
  expect(hazard.reflex).toBe(normal.reflex + 1)
  expect(hazard.will).toBe(normal.will + 1)
  expect(initiativeBonus(c, [])).toBe(normal.perception)
  expect(initiativeBonus({ ...c, feats: [...c.feats, feat('Incredible Initiative')] }, [])).toBe(normal.perception + 2)
  const shield = { id: 's', name: 'Shield', hardness: 5, hp: 20, damage: 0, raised: true }
  expect(armorClass({ ...c, shield }, [])).toBe(armorClass({ ...c, shield, activeFeatEffects: [] }, []))
  const superior = { ...c, level: 20, feats: [...c.feats, feat('Superior Sight', 20)] }
  expect(defenseSummary(superior, []).perception).toBe(defenseSummary({ ...superior, activeFeatEffects: [] }, []).perception)
  expect(initiativeBonus(superior, [])).toBe(defenseSummary(superior, []).perception)
  expect(defenseSummary({ ...c, feats: [] }, [])).toEqual(defenseSummary({ ...c, feats: [], activeFeatEffects: [] }, []))
  expect(defenseSummary({ ...c, level: 7 }, [])).toEqual(defenseSummary({ ...c, level: 7, activeFeatEffects: [] }, []))
})

it('applies parry AC context without stacking with shield or hazard finder, and supports +2 parry feats', () => {
  const rapier = content('weapon', 'Rapier', { weapon_category: 'Martial', trait: 'Parry', hands: 1, damage: '1d6 piercing' })
  const improved = { ...content('feat', 'Parry Expert', {}, 8), description: 'The circumstance bonus to AC from your parry trait increases to +2.' }
  const c: Character = { ...base, className: 'Ranger', level: 10, weapons: [{ id: 'r', name: 'Rapier', potency: 0, striking: 0, runes: [] }],
    feats: [feat('Parry Expert', 8)], parrying: true }
  expect(parryValue(c, [rapier, improved])).toBe(2)
  const normal = armorClass({ ...c, parrying: false }, [rapier, improved])
  expect(armorClass(c, [rapier, improved])).toBe(normal + 2)
  const shield = { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: true }
  expect(armorClass({ ...c, shield }, [rapier, improved])).toBe(normal + 2)
  const hazard = { ...c, feats: [...c.feats, feat('Hazard Finder', 8)], activeFeatEffects: ['Hazard Finder'] }
  expect(armorClass(hazard, [rapier, improved])).toBe(normal + 2)
  expect(armorClass({ ...hazard, parrying: false }, [rapier, improved])).toBe(normal + 1)
})

it('uses +2 for Twin Parry only with two wielded melee weapons and a parry weapon', () => {
  const claw = content('weapon', 'Clawed Gauntlet', { weapon_category: 'Martial', hands: 1, weapon_type: 'Melee', damage: '1d4 slashing' }, 1, ['Parry'])
  const sword = content('weapon', 'Sword', { weapon_category: 'Martial', hands: 1, weapon_type: 'Melee', damage: '1d6 slashing' })
  const c: Character = { ...base, level: 4, feats: [feat('Twin Parry', 4)], parrying: true,
    weapons: [{ id: 'a', name: claw.name, potency: 0, striking: 0, runes: [] }, { id: 'b', name: sword.name, potency: 0, striking: 0, runes: [] }] }
  expect(parryValue(c, [claw, sword])).toBe(2)
  expect(armorClass(c, [claw, sword]) - armorClass({ ...c, parrying: false }, [claw, sword])).toBe(2)
  expect(parryValue({ ...c, weapons: [c.weapons![0], { ...c.weapons![1], stowed: true }] }, [claw, sword])).toBe(1)
  expect(parryValue({ ...c, feats: [] }, [claw, sword])).toBe(1)
})

it('adds Nimble Elf speed and Tree Climber climb speed only when feats are active', () => {
  const elf = content('ancestry', 'Elf', { speed: 30 })
  const c: Character = { ...base, ancestry: 'Elf', level: 9, feats: [feat('Nimble Elf', 1), feat('Tree Climber', 9)] }
  expect(speed(c, [elf])).toBe(35)
  expect(movementSpeeds(c, [elf])).toContainEqual({ name: 'Climb', feet: 10, source: 'Tree Climber' })
  expect(movementSpeeds({ ...c, level: 8 }, [elf])).not.toContainEqual(expect.objectContaining({ source: 'Tree Climber' }))
  expect(speed({ ...c, feats: [] }, [elf])).toBe(30)
})

it('explains calculated AC, saves and attacks with capped Dexterity and non-stacking conditional bonuses', () => {
  const armor = content('armor', 'Plate', { armor_category: 'Heavy', ac: 5, dex_cap: 1 })
  const weapon = content('weapon', 'Rapier', { weapon_category: 'Martial', hands: 1, damage: '1d6 piercing' }, 1, ['Finesse'])
  const c: Character = { ...base, className: 'Ranger', level: 10,
    feats: [feat('Hazard Finder', 8)], activeFeatEffects: ['Hazard Finder'],
    armors: [{ id: 'armor', name: 'Plate', worn: true, potency: 2, resilient: 1, runes: [] }],
    shield: { id: 's', name: 'Shield', hardness: 5, hp: 20, damage: 0, raised: true } }
  const entries = [armor, weapon]
  const ac = armorClassBreakdown(c, entries)
  expect(ac.total).toBe(armorClass(c, entries))
  expect(ac.parts).toContainEqual({ label: 'Dexterity', value: 1, note: 'Modifier +4; cap +1' })
  expect(ac.parts).toContainEqual({ label: 'Raised shield (circumstance)', value: 2 })
  expect(ac.notes?.join(' ')).toContain('Hazard Finder +1')
  const save = savingThrowBreakdown(c, entries, 'Reflex')
  expect(save.total).toBe(defenseSummary(c, entries).reflex)
  expect(save.parts).toContainEqual({ label: 'Plate (resilient or grade)', value: 1 })
  expect(save.parts).toContainEqual({ label: 'Hazard Finder (circumstance)', value: 1 })
  const strike = weaponAttack(c, entries, { id: 'r', name: 'Rapier', potency: 2, striking: 0, runes: [] })
  expect(strike.breakdown.total).toBe(strike.attack)
  expect(strike.breakdown.parts).toContainEqual({ label: 'Dexterity', value: 4 })
  expect(strike.breakdown.parts).toContainEqual({ label: 'Effective weapon potency (item)', value: 2 })
  expect(strike.breakdown.parts.reduce((sum, part) => sum + part.value, 0)).toBe(strike.attack)
})

it('applies researched resistance only in its matching-effect context and never stacks circumstance save bonuses', () => {
  const c: Character = { ...base, level: 13, rankOverrides: { Arcana: 3, Nature: 1 },
    feats: [{ ...feat('Researched Spell Resistance', 13), choice: 'Arcane, Primal' }],
    activeFeatEffects: ['Researched Spell Resistance'] }
  const normal = defenseSummary({ ...c, activeFeatEffects: [] }, [])
  const active = defenseSummary(c, [])
  expect(researchedSpellResistance(c, [])?.traditions).toEqual(['Arcane', 'Primal'])
  expect(active.fortitude).toBe(normal.fortitude + 1)
  expect(active.reflex).toBe(normal.reflex + 1)
  expect(active.will).toBe(normal.will + 1)
  expect(active.perception).toBe(normal.perception)
  expect(active.ac).toBe(normal.ac)
  const both = { ...c, feats: [...c.feats, feat('Hazard Finder', 8)], activeFeatEffects: [...c.activeFeatEffects!, 'Hazard Finder'] }
  expect(defenseSummary(both, []).reflex).toBe(normal.reflex + 1)
  expect(researchedSpellResistance({ ...c, level: 12 }, [])).toBeUndefined()
  expect(researchedSpellResistance({ ...c, feats: [] }, [])).toBeUndefined()
  expect(researchedSpellResistance({ ...c, rankOverrides: { Arcana: 1, Nature: 1 } }, [])).toBeUndefined()
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(markup).toContain('aria-label="Researched spell resistance active" checked=""')
  expect(markup).toContain('only against Arcane, Primal spells and effects')
  expect(markup).toContain('<small>Circumstance</small>+1')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, activeFeatEffects: [] }} entries={[]} save={() => {}} part="defense" />))
    .not.toContain('<small>Circumstance</small>+1')
})

it('exposes persisted defensive contexts and shows conditional bonuses without changing ordinary saves', () => {
  const c: Character = { ...base, className: 'Ranger', feats: [feat('Hazard Finder', 8)], activeFeatEffects: ['Hazard Finder'] }
  for (const part of ['offense', 'defense'] as const) {
    const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part={part} />)
    expect(markup).toContain(`aria-label="Hazard checks active (${part})"`)
    expect(markup).toContain('(Hazard Finder)')
    expect(markup).toContain('<small>Circumstance</small>+1')
  }
  const druid: Character = { ...base, className: 'Druid', feats: [feat('Harden Flesh', 10)], activeFeatEffects: ['Harden Flesh'] }
  const markup = renderToStaticMarkup(<SkillsSection c={druid} entries={[]} save={() => {}} part="defense" />)
  expect(markup).toContain('aria-label="Harden Flesh active"')
  expect(markup).toMatch(/Physical \(except adamantine\) 3<button[^>]*>\*<\/button> \(Harden Flesh\)/)
  expect(renderToStaticMarkup(<SkillsSection c={{ ...druid, feats: [] }} entries={[]} save={() => {}} part="defense" />)).not.toContain('Harden Flesh active')
})

it('shows movement sources inline and alphabetizes alternate speeds after land Speed', () => {
  const c: Character = { ...base, level: 9, className: 'Ranger',
    feats: [feat('Persistent Animal Feature', 8), feat('Fleet'), feat('Primal Nimbleness')],
    spells: [{ name: 'Animal Feature', rank: 2, cantrip: false }, { name: 'Canopy Crawler', rank: 2, cantrip: false }],
    activeSpells: ['Animal Feature', 'Canopy Crawler'], animalFeatures: ['Fish Tail', 'Wings'] }
  const text = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="offense" />).replace(/<[^>]*>/g, '')
  expect(text).toContain('Speed: 35 ft. (+5 Fleet, +5 Primal Nimbleness); Climbing 35 ft. (Canopy Crawler); Fly 35 ft. (Animal Feature); Swim 35 ft. (Animal Feature)')
  const inactive = renderToStaticMarkup(<SkillsSection c={{ ...c, activeSpells: [] }} entries={[]} save={() => {}} part="offense" />)
  expect(inactive).not.toContain('Climbing')
  expect(inactive).not.toContain('(Animal Feature)')
})

it.each([[1, 30], [4, 30], [5, 60], [20, 60]])('adds active Keen Smell scent at level %i with correct focus-spell heightening', (level, range) => {
  const c: Character = { ...base, level, className: 'Ranger', activeSpells: ['Keen Smell'],
    feats: [feat('Initiate Warden', 1, 'Keen Smell')] }
  const expected = { value: `Scent (imprecise) ${range} feet`, source: 'Keen Smell' }
  expect(senses(c, [])).toContainEqual(expected)
  expect(senses(JSON.parse(JSON.stringify(c)) as Character, [])).toContainEqual(expected)
  expect(senses({ ...c, activeSpells: [] }, [])).not.toContainEqual(expected)
  expect(senses({ ...c, feats: [] }, [])).not.toContainEqual(expected)
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="offense" />)
  expect(markup).toContain(`Scent (imprecise) ${range} feet (Keen Smell)`)
})

it('applies Magic Hide only to the selected companion while the known spell is active', () => {
  const cat = content('companion', 'Cat', { strength: 2, dexterity: 3, constitution: 1, hp: 6, size: 'Small', speed: 35 })
  const c: Character = { ...base, companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Cat', name: 'B' }],
    activeSpells: ['Magic Hide'], magicHideCompanionId: 'b', spells: [{ name: 'Magic Hide', rank: 1, cantrip: false }] }
  const normal = companionStats({ ...c, activeSpells: [] }, [cat], 'Cat')!.ac
  expect(companionStats(c, [cat], 'Cat', undefined, 'a')!.ac).toBe(normal)
  expect(companionStats(c, [cat], 'Cat', undefined, 'b')!.ac).toBe(normal + 1)
  expect(companionStats({ ...c, spells: [] }, [cat], 'Cat', undefined, 'b')!.ac).toBe(normal)
  const stale = { ...c, magicHideCompanionId: 'removed-companion' }
  expect(companionStats(stale, [cat], 'Cat', undefined, 'a')!.ac).toBe(normal + 1)
  expect(companionStats(stale, [cat], 'Cat', undefined, 'b')!.ac).toBe(normal)
})

it('syncs Magic Hide across spells and companion controls and marks only the affected AC', () => {
  const cat = content('companion', 'Cat', { strength: 2, dexterity: 3, constitution: 1, hp: 6, size: 'Small', speed: 35 })
  const c: Character = { ...base, companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Cat', name: 'B' }],
    activeSpells: ['Keen Smell'], spells: [{ name: 'Magic Hide', rank: 1, cantrip: false }] }
  for (const active of [true, false]) {
    const changed = { ...c, ...magicHideChange(c, active, 'b') }
    const minions = renderToStaticMarkup(<MinionsSection c={changed} entries={[cat]} save={() => {}} />)
    const spells = renderToStaticMarkup(<SpellsSection c={changed} entries={[cat]} save={() => {}} />)
    expect(minions).toContain(`aria-label="Magic Hide on B"${active ? ' checked=""' : ''}`)
    expect(spells).toContain(`aria-label="Magic Hide active"${active ? ' checked=""' : ''}`)
    expect(minions.match(/title="\+1 Status \(Magic Hide\) \(Magic Hide\)"/g) ?? []).toHaveLength(active ? 1 : 0)
    expect(changed.activeSpells).toContain('Keen Smell')
    if (active) expect(minions).toMatch(/<b>\d+<button[^>]*>\*<\/button><span[^>]*popover="auto"/)
  }
})

it('targets Canopy Crawler at one creature before rank five and both at rank five, matching highest speed', () => {
  const cat = content('companion', 'Cat', { size: 'Small', speed_raw: '35 feet, fly 50 feet, climb 10 feet' })
  const c: Character = { ...base, level: 8, className: 'Ranger',
    companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Cat', name: 'B' }],
    spells: [{ name: 'Canopy Crawler', rank: 2, cantrip: false }], activeSpells: ['Canopy Crawler'],
    canopyCrawlerCompanionId: 'b', canopyCrawlerTarget: 'Self' }
  const stats = (character: Character, id = 'b') => companionStats(character, [cat], 'Cat', undefined, id)!
  expect(movementSpeeds(c, [])).toContainEqual({ name: 'Climb', feet: 25, source: 'Canopy Crawler' })
  expect(stats(c).speed).toBe('35 feet, fly 50 feet, climb 10 feet')
  const companionOnly: Character = { ...c, canopyCrawlerTarget: 'Companion' }
  expect(movementSpeeds(companionOnly, [])).toContainEqual({ name: 'Climb', feet: 25, source: 'Canopy Crawler' })
  expect(stats(companionOnly).speed).toBe('35 feet, fly 50 feet, climb 10 feet')
  expect(stats(companionOnly, 'a').canopyCrawler).toBe(false)
  expect(stats({ ...companionOnly, level: 9, canopyCrawlerCompanionId: 'removed' }, 'a').canopyCrawler).toBe(true)
  const both: Character = JSON.parse(JSON.stringify({ ...c, level: 9, canopyCrawlerTarget: 'Both' }))
  expect(movementSpeeds(both, [])).toContainEqual({ name: 'Climb', feet: 25, source: 'Canopy Crawler' })
  expect(stats(both).speed).toBe('35 feet, fly 50 feet, climb 50 feet')
  expect(stats({ ...both, canopyCrawlerTarget: 'Self' }).canopyCrawler).toBe(true)
  expect(stats({ ...both, level: 8 }).canopyCrawler).toBe(false)
  for (const patch of [{ activeSpells: [] }, { spells: [] }, { level: 2 }]) {
    expect(movementSpeeds({ ...both, ...patch }, [])).toEqual([{ name: 'Land', feet: 25 }])
    expect(stats({ ...both, ...patch }).speed).toBe(cat.data.speed_raw)
  }
  const minions = renderToStaticMarkup(<MinionsSection c={both} entries={[cat]} save={() => {}} />)
  expect(minions).toContain('aria-label="Canopy Crawler on B" checked=""')
  expect(minions).not.toContain('aria-label="Canopy Crawler on A" checked=""')
  expect(minions).toMatch(/climb 50 feet<button[^>]*>\*<\/button> \(Canopy Crawler\)/)
  const noClimb = { ...cat, data: { ...cat.data, speed_raw: '35 feet, swim 40 feet' } }
  expect(companionStats(both, [noClimb], 'Cat', undefined, 'b')!.speed).toBe('35 feet, swim 40 feet, climb 40 feet')
})

it('enlarges only smaller companions, gating Huge at level seven and applying damage, reach and clumsy', () => {
  const cat = content('companion', 'Cat', { size: 'Small', strength: 2, dexterity: 3, speed: 35,
    companion_attacks: 'jaws|1d8 piercing|;claw|1d6 slashing|finesse;spines|1d4 piercing|ranged, range 30 feet' })
  const c: Character = { ...base, level: 6, companions: [{ id: 'a', name: 'A', type: 'Cat' }, { id: 'b', name: 'B', type: 'Cat' }],
    spells: [{ name: 'Enlarge Companion', rank: 2, cantrip: false }, { name: 'Magic Hide', rank: 1, cantrip: false }],
    activeSpells: ['Enlarge Companion'], enlargeCompanionId: 'b', enlargeCompanionSize: 'Huge' }
  const stats = (character: Character, entry = cat, id = 'b') => companionStats(character, [entry], 'Cat', undefined, id)!
  const normal = stats({ ...c, activeSpells: [] })
  const large = stats(c)
  expect(large).toMatchObject({ size: 'Large', clumsy: 1, enlarge: { damage: 2, reachIncrease: 5 } })
  expect(large.ac).toBe(normal.ac - 1)
  expect(large.reflex).toBe(normal.reflex - 1)
  expect(large.fortitude).toBe(normal.fortitude)
  expect(large.attacks[0]).toMatchObject({ attack: normal.attacks[0].attack, damage: '1d8+4 piercing' })
  expect(large.attacks[1]).toMatchObject({ attack: normal.attacks[1].attack - 1, damage: '1d6+5 slashing' })
  expect(large.attacks[2].damage).toBe(normal.attacks[2].damage)
  expect(large.skills.find((skill) => skill.name === 'Acrobatics')!.bonus)
    .toBe(normal.skills.find((skill) => skill.name === 'Acrobatics')!.bonus - 1)
  expect(stats(c, cat, 'a').enlarge).toBeUndefined()
  expect(stats({ ...c, enlargeCompanionId: 'removed' }, cat, 'a').enlarge).toBeDefined()
  const huge = { ...c, level: 7 }
  expect(stats(huge)).toMatchObject({ size: 'Huge', enlarge: { damage: 4, reachIncrease: 10 } })
  expect(stats({ ...huge, enlargeCompanionSize: 'Large' })).toMatchObject({ size: 'Large', enlarge: { damage: 2 } })
  expect(stats(huge, { ...cat, data: { ...cat.data, size: 'Tiny' } }).enlarge?.reachIncrease).toBe(15)
  expect(stats(c, { ...cat, data: { ...cat.data, size: 'Tiny' } }).enlarge?.reachIncrease).toBe(10)
  expect(stats({ ...c, activeSpells: ['Enlarge Companion', 'Magic Hide'], magicHideCompanionId: 'b' }).ac).toBe(normal.ac)
  for (const patch of [{ activeSpells: [] }, { spells: [] }, { level: 2 }])
    expect(stats({ ...c, ...patch }).enlarge).toBeUndefined()
  const markup = renderToStaticMarkup(<MinionsSection c={huge} entries={[cat]} save={() => {}} />)
  expect(markup).toMatch(/Huge<button[^>]*>\*<\/button> \(Enlarge Companion\)/)
  expect(markup).toContain('+4 status melee damage; +10 feet reach; clumsy 1.')
  expect(markup).toContain('-1 Status (clumsy 1; Enlarge Companion)')
})

it('gives a naturally Large Sarkorian Direwolf no lower-rank Enlarge Companion effects', () => {
  const wolf = content('companion', 'Sarkorian Direwolf', { size: 'Large', fixed_size: true, strength: 2, dexterity: 3,
    speed: 35, companion_attacks: 'jaws|1d8 piercing|' })
  const c: Character = { ...base, level: 6, companions: [{ id: 'wolf', name: '', type: wolf.name }],
    spells: [{ name: 'Enlarge Companion', rank: 2, cantrip: false }], activeSpells: ['Enlarge Companion'], enlargeCompanionSize: 'Large' }
  const stats = (character: Character, entry = wolf) => companionStats(character, [entry], wolf.name)!
  expect(stats(c)).toEqual(stats({ ...c, activeSpells: [] }))
  const huge: Character = JSON.parse(JSON.stringify({ ...c, level: 7, enlargeCompanionSize: 'Huge' }))
  expect(stats(huge)).toMatchObject({ size: 'Huge', enlarge: { damage: 4, reachIncrease: 10 }, clumsy: 1 })
  for (const size of ['Huge', 'Gargantuan']) {
    const entry = { ...wolf, data: { ...wolf.data, size } }
    expect(stats(huge, entry)).toEqual(stats({ ...huge, activeSpells: [] }, entry))
  }
})

it('scales and gates official Oversized Throw and prevents enhancement editing', () => {
  const c = { ...base, className: 'Barbarian', raging: true, weapons: [], feats: [feat('Oversized Throw', 4)] }
  for (const [level, dice] of [[4, 1], [6, 1], [7, 2], [14, 2], [15, 3]]) {
    const character = { ...c, level }
    const weapon = ownedWeapons(character, []).find((weapon) => weapon.id === OVERSIZED_THROW.id)!
    expect(weaponAttack(character, [], weapon)).toMatchObject({ ability: 'dex', range: 20, damage: `${dice}d10+1 bludgeoning`, traits: ['Thrown'] })
  }
  for (const patch of [{ level: 3 }, { raging: false }, { raging: undefined }, { feats: [] }, { className: 'Ranger' }]) {
    expect(ownedWeapons({ ...c, ...patch }, []).map((weapon) => weapon.name)).not.toContain(OVERSIZED_THROW.name)
  }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('<strong>Oversized Throw</strong>')
  expect(markup).not.toContain('aria-label="Weapon material"')
  expect(markup).not.toContain('aria-label="Add property rune"')
  expect(markup).not.toContain('aria-label="Remove Oversized Throw"')
})

it('requires a two-handed hammer, spear, or polearm for Haft Striker and inherits compatible runes from its selected source', () => {
  const spear = content('weapon', 'Spear', { hands: 2, weapon_group: 'Spear', damage: '1d8 piercing' })
  const hammer = content('weapon', 'Hammer', { hands: 2, weapon_group: 'Hammer', damage: '1d12 bludgeoning' })
  const first: OwnedWeapon = { ...main, name: 'Spear', runes: ['Flaming', 'Wounding'] }
  const second: OwnedWeapon = { ...main, id: 'second', name: 'Hammer', potency: 2, striking: 2, runes: ['Frost'] }
  const c = { ...base, weapons: [first, second], feats: [feat('Haft Striker Stance', 4)] }
  const haft = ownedWeapons(c, [spear, hammer]).find((weapon) => weapon.name === HAFT_STRIKER_WEAPON.name)!
  expect(effectiveWeapon(c, [spear, hammer], haft)).toMatchObject({ potency: 3, striking: 1, runes: ['Flaming'] })
  expect(effectiveWeapon({ ...c, haftStrikerWeaponId: second.id }, [spear, hammer], haft)).toMatchObject({ potency: 2, striking: 2, runes: ['Frost'] })
  expect(effectiveWeapon({ ...c, weapons: [{ ...first, runes: ['Holy'] }] }, [spear, hammer],
    { ...haft, runes: ['Unholy'] }).runes).toEqual(['Holy'])
  const incompatible: ContentEntry['data'][] = [{ hands: 1 }, { weapon_group: 'Club' }, { weapon_type: 'Ranged' }]
  for (const data of incompatible) {
    expect(ownedWeapons({ ...c, weapons: [first] }, [{ ...spear, data: { ...spear.data, ...data } }]).map((weapon) => weapon.name)).not.toContain(HAFT_STRIKER_WEAPON.name)
  }
  expect(ownedWeapons({ ...c, feats: [] }, [spear, hammer]).map((weapon) => weapon.name)).not.toContain(HAFT_STRIKER_WEAPON.name)
})

it('makes Primal Nimbleness available to both classes and scales heritage and Ranger poison resistance', () => {
  const druidPoison = content('feat', 'Poison Resistance', { class: 'Druid', archetype: 'Assassin' }, 2, ['Alchemist', 'Druid'])
  const options = homebrewCharacterOptions([druidPoison])
  const nimble = options.find((entry) => entry.name === 'Primal Nimbleness')!
  const slot = plannedSlots({ ...base, className: 'Ranger' }).find((slot) => slot.category === 'class')!
  for (const className of ['Druid', 'Ranger']) {
    const c = { ...base, className, feats: [feat(nimble.name)] }
    expect(eligibleFeats(options, { ...c, feats: [] }, slot).map((entry) => entry.name)).toContain(nimble.name)
    expect(speed(c, [])).toBe(30)
  }
  const heritage = options.find((entry) => entry.kind === 'heritage')!
  expect(heritagesFor(options, 'Human')).toContain(heritage)
  expect(heritagesFor(options, 'Elf')).not.toContain(heritage)
  expect(resistances({ ...base, level: 1, heritage: heritage.name }, options)).toContainEqual({ damage: 'Fire', value: 1, source: heritage.name })
  expect(resistances({ ...base, level: 9, heritage: heritage.name }, options)).toContainEqual({ damage: 'Fire', value: 4, source: heritage.name })
  expect(resistances({ ...base, level: 10, feats: [feat('Poison Resistance', 2)] }, options)).toContainEqual({ damage: 'Poison', value: 5, source: 'Poison Resistance' })
  const markup = renderToStaticMarkup(<SkillsSection c={{ ...base, level: 20, feats: [feat('Poison Resistance', 2)] }}
    entries={options} save={() => {}} part="defense" />)
  expect(markup).toMatch(/>Poison 10<button[^>]*>\*<\/button> \(Poison Resistance\)/)
  expect(markup).toContain('aria-label="Poison Resistance note"')
  expect(markup).toContain('popover="auto"')
  expect(markup).toContain('+1 status bonus to saving throws against poisons.')
  expect(markup).not.toContain('Saving throws against poisons: +1 status bonus.</small>')
  expect(options.find((entry) => entry.id === 'homebrew:ranger-poison-resistance')?.traits).toEqual(['Ranger'])
  expect(druidPoison.traits).toEqual(['Alchemist', 'Druid'])
})

it('keeps other poison resistance sources visible without borrowing the feat saving throw note', () => {
  const poison = content('feat', 'Venom Ward', { resistances: 'poison=5' })
  const markup = renderToStaticMarkup(<SkillsSection c={{ ...base, feats: [feat(poison.name)] }}
    entries={[poison]} save={() => {}} part="defense" />)
  expect(markup).toContain('Poison 5 (Venom Ward)')
  expect(markup).not.toContain('source-note-trigger')
})

it.each([
  ['Harden Flesh', 'Physical (except adamantine)', 'Lasts until the beginning of your next turn'],
  ['Heart of the Kaiju', 'Physical', 'Physical resistance applies only while in kaiju form'],
  ['Primal Aegis', 'Acid', 'Resistance equals your positive Wisdom modifier'],
])('keeps %s visible beside its resistance with a clickable condition note', (name, damage, note) => {
  const c: Character = { ...base, level: 20, abilities: { ...base.abilities, wis: 18 },
    feats: [feat(name)], activeFeatEffects: [name] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(markup).toContain(damage)
  expect(markup).toContain(`aria-label="${name} note"`)
  expect(markup).toContain(`*</button> (${name})`)
  expect(markup).toContain(note)
  expect(markup).toContain('popover="auto"')
})

it('summarizes heritage, ancestry, subclass, and final level without duplicating ancestry', () => {
  const c = { ...base, ancestry: 'Human', heritage: 'Wintertouched Human', className: 'Ranger', subclass: 'Outwit', level: 20 }
  expect(characterSummary(c, [])).toBe('Wintertouched Human Outwit Edge Ranger 20')
  expect(characterSummary({ ...c, heritage: 'Wintertouched' }, [])).toBe('Wintertouched Human Outwit Edge Ranger 20')
})
