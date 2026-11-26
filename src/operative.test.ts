import { expect, it } from 'vitest'
import snapshot from '../public/data/aon-sf2e.json?raw'
import { mapAonHits } from './aon'
import { armorClass, armorClassBreakdown, boostSlots, classDifficultyClass, eligibleFeats, featChoiceOptions, hasParryWeapon, initiativeBonus, isGrantedSlot, parryValue, plannedSlots, ranksAt, savingThrowBreakdown, speed, subclassSkillGrants, weaponAttack } from './builder'
import type { Character, ContentEntry, OwnedWeapon } from './types'

const hits: Parameters<typeof mapAonHits>[0] = JSON.parse(snapshot)
const entries = mapAonHits(hits.filter(hit => hit._source?.name === 'Operative'
  || hit._source?.class === 'Operative'
  || Array.isArray(hit._source?.class) && hit._source.class.includes('Operative')
  || ['Scope Sight', 'Keep Them In Your Sights', 'Assurance', 'Quick Jump', 'Cat Fall'].includes(String(hit._source?.name))), 'sf2e')
const base: Character = {
  id: 'operative', name: 'Operative', className: 'Operative', subclass: 'Sniper', systems: ['sf2e'], level: 1,
  abilities: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const weapon = (name: string, category: string, traits: string[], ranged: boolean, hands = 1): ContentEntry => ({
  id: name, name, kind: 'weapon', systems: ['sf2e'], source: 'official', level: 1, traits,
  data: { weapon_category: category, weapon_type: ranged ? 'Ranged' : 'Melee', range: ranged ? 60 : 0,
    hands, damage: '1d6 piercing' }, description: '', effects: [], updatedAt: 0,
})
const attack = (c: Character, entry: ContentEntry) => {
  const owned: OwnedWeapon = { id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] }
  return weaponAttack(c, [...entries, entry], owned)
}
const simpleGun = weapon('Simple Gun', 'Simple', ['Tech'], true)
const martialGun = weapon('Martial Gun', 'Martial', ['Analog'], true)
const advancedGun = weapon('Advanced Gun', 'Advanced', ['Tech'], true)
const bow = weapon('Bow', 'Martial', [], true)
const blade = weapon('Blade', 'Martial', ['Agile'], false)
const heavyBlade = weapon('Heavy Blade', 'Martial', ['Agile'], false, 2)

it.each([[1, 2, 1, 1], [5, 3, 2, 1], [13, 4, 3, 2], [19, 4, 4, 2]])(
  'scales guns separately from ordinary weapons at level %i', (level, gun, advanced, normal) => {
    const c = { ...base, level }
    expect(attack(c, simpleGun).rank).toBe(gun)
    expect(attack(c, martialGun).rank).toBe(gun)
    expect(attack(c, advancedGun).rank).toBe(advanced)
    expect(attack(c, bow).rank).toBe(normal)
    expect(attack(c, blade).rank).toBe(normal)
    const striker = { ...c, subclass: 'Striker' }
    expect(attack(striker, simpleGun).rank).toBe(gun)
    expect(attack(striker, martialGun).rank).toBe(normal)
    expect(attack(striker, advancedGun).rank).toBe(advanced)
    expect(attack(striker, blade).rank).toBe(gun)
    expect(attack(striker, heavyBlade).rank).toBe(normal)
  })

it('applies specialization and critical effects while keeping Aim conditional', () => {
  expect(attack({ ...base, level: 4 }, simpleGun).criticalSpecialization).toBe(false)
  const at7 = attack({ ...base, level: 7 }, simpleGun)
  expect(at7.criticalSpecialization).toBe(true)
  expect(at7.damage).toBe('1d6+3 piercing')
  expect(at7.breakdown.notes?.join(' ')).toContain('2d4 precision damage')
  const at17 = attack({ ...base, level: 17 }, simpleGun)
  expect(at17.damage).toBe('1d6+8 piercing')
  expect(at17.breakdown.notes?.join(' ')).toContain('4d4 precision damage')
  expect(at17.breakdown.notes?.join(' ')).toContain('Tactical Barrage')
  expect(attack({ ...base, level: 17 }, blade).breakdown.notes?.join(' ')).not.toContain('Aim:')
  expect(attack({ ...base, level: 17, subclass: 'Striker' }, blade).breakdown.notes?.join(' ')).toContain('Aim:')
  expect(attack({ ...base, level: 17 }, { ...simpleGun, traits: ['Tech', 'Area'] }).breakdown.notes?.join(' ')).not.toContain('Aim:')
})

it('applies Aim feat benefits and conditional bleed without changing base damage', () => {
  const c: Character = { ...base, level: 11, feats: [
    { name: 'Keep Them In Your Sights', type: 'Class Feat', level: 1 },
    { name: 'Devastating Aim', type: 'Class Feat', level: 4 },
    { name: 'Bloody Wounds', type: 'Class Feat', level: 4 },
  ] }
  const result = attack(c, simpleGun)
  expect(result.damage).toBe(attack({ ...c, feats: [] }, simpleGun).damage)
  expect(result.breakdown.notes?.join(' ')).toContain('first or second range increment')
  expect(result.breakdown.notes?.join(' ')).toContain('3d6 precision damage')
  expect(result.breakdown.notes?.join(' ')).toContain('critical hit against your mark deals 3 persistent bleed damage')
  expect(attack({ ...c, level: 3 }, simpleGun).breakdown.notes?.join(' ')).toContain('1d4 precision damage')
  expect(attack({ ...c, subclass: 'Striker' }, blade).breakdown.notes?.join(' ')).toContain('3d6 precision damage')
  const extreme = { ...c, level: 16, feats: [...c.feats, { name: 'Extreme Accuracy', type: 'Class Feat', level: 16 }] }
  expect(attack(extreme, simpleGun).breakdown.notes?.join(' ')).toContain('within the first four range increments')
  expect(attack(extreme, simpleGun).breakdown.notes?.join(' ')).toContain('ignore range penalties')
})

it('shows action details for Operative Aim feats only with eligible weapons', () => {
  const c: Character = { ...base, feats: ['Instinctive Aim', 'Mobile Aim', 'Weakening Shot']
    .map(name => ({ name, type: 'Class Feat', level: 1 })) }
  const notes = attack(c, simpleGun).breakdown.notes?.join(' ')
  expect(notes).toContain('Interact to draw a ranged weapon or Switch Hands, then Aim')
  expect(notes).toContain('Stride, then Aim with this gun')
  expect(notes).toContain('choose clumsy 1 or enfeebled 1')
  const bowNotes = attack(c, bow).breakdown.notes?.join(' ')
  expect(bowNotes).toContain('Instinctive Aim')
  expect(bowNotes).not.toContain('Mobile Aim')
  expect(bowNotes).not.toContain('Weakening Shot')
})

it('shows gun, reaction, and attack-sequence Operative feat rules', () => {
  const c: Character = { ...base, level: 10, feats: [
    'Peek', 'Hampering Shot', 'Disarming Shot', 'Toppling Shot', 'Impeding Shot', 'Muzzle Flash',
    'Hair Trigger', 'Opportune Retort', 'Tactical Swap', 'Twin Draw',
  ].map(name => ({ name, type: 'Class Feat', level: 1 })) }
  const notes = attack(c, simpleGun).breakdown.notes?.join(' ')
  expect(notes).toContain('Peek (1 action): make a ranged Strike, then Take Cover')
  expect(notes).toContain('Hampering Shot (2 actions)')
  expect(notes).toContain('use the same attack roll against Reflex DC to Disarm')
  expect(notes).toContain('push it 5 feet')
  expect(notes).toContain('it is slowed 1')
  expect(notes).toContain('it is dazzled')
  expect(notes).toContain('Hair Trigger: react with a ranged Strike')
  expect(notes).toContain('Opportune Retort: when a creature critically fails')
  expect(notes).toContain('Tactical Swap (1 action, once per round)')
  expect(notes).toContain('Twin Draw (1 action)')
})

it('shows Vesk critical-miss recovery without changing Strike statistics', () => {
  const c: Character = { ...base, ancestry: 'Vesk', level: 13, feats: [
    { name: 'Overcome Shame', type: 'Ancestry Feat', level: 13 },
  ] }
  const result = attack(c, simpleGun)
  expect(result.breakdown.notes?.join(' ')).toContain('reroll your next Strike before the end of your turn')
  expect(result.damage).toBe(attack({ ...c, feats: [] }, simpleGun).damage)
})

it('keeps Danger Awareness bonuses conditional', () => {
  const c: Character = { ...base, level: 2, feats: [{ name: 'Danger Awareness', type: 'Class Feat', level: 2 }] }
  expect(armorClassBreakdown(c, entries).notes?.join(' ')).toContain('attacks from traps and hidden')
  expect(savingThrowBreakdown(c, entries, 'Reflex').notes?.join(' ')).toContain('against traps')
  expect(armorClass(c, entries)).toBe(armorClass({ ...c, feats: [] }, entries))
})

it('shows Elusive Target as a conditional reaction without changing AC', () => {
  const c: Character = { ...base, feats: [{ name: 'Elusive Target', type: 'Class Feat', level: 1 }] }
  expect(armorClassBreakdown(c, entries).notes?.join(' ')).toContain('when a Strike targeting you fails, react to Step')
  expect(armorClass(c, entries)).toBe(armorClass({ ...c, feats: [] }, entries))
})

it('grants gun parry and improves an existing parry only while wielded', () => {
  const own: OwnedWeapon = { id: simpleGun.id, name: simpleGun.name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, level: 2, feats: [{ name: 'Defensive Gunner', type: 'Class Feat', level: 2 }], weapons: [own] }
  const data = [...entries, simpleGun]
  expect(weaponAttack(c, data, own).traits).toContain('Parry')
  expect(hasParryWeapon(c, data)).toBe(true)
  expect(parryValue(c, data)).toBe(1)
  expect(armorClass({ ...c, parrying: true }, data) - armorClass(c, data)).toBe(1)
  expect(parryValue(c, [...entries, { ...simpleGun, traits: ['Tech', 'Parry'] }])).toBe(2)
  expect(parryValue({ ...c, weapons: [{ ...own, stowed: true }] }, data)).toBe(0)
  const bowOwned = { ...own, id: bow.id, name: bow.name }
  expect(parryValue({ ...c, weapons: [bowOwned] }, [...entries, bow])).toBe(0)
})

it('grants gun parry to two-handed firearms identified by weapon group', () => {
  const rifle = { ...weapon('Rifle', 'Martial', ['Concussive'], true, 2), data: { ...weapon('Rifle', 'Martial', [], true, 2).data, weapon_group: 'Firearm' } }
  const own: OwnedWeapon = { id: rifle.id, name: rifle.name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, level: 2, feats: [{ name: 'Defensive Gunner', type: 'Class Feat', level: 2 }], weapons: [own] }
  expect(hasParryWeapon(c, [...entries, rifle])).toBe(true)
  expect(parryValue(c, [...entries, rifle])).toBe(1)
})

it('grants agile only to wielded simple guns while wielding two', () => {
  const first: OwnedWeapon = { id: 'one', name: simpleGun.name, potency: 0, striking: 0, runes: [] }
  const second: OwnedWeapon = { ...first, id: 'two' }
  const c: Character = { ...base, level: 8, feats: [{ name: 'Twin Shooter', type: 'Class Feat', level: 8 }], weapons: [first, second] }
  const data = [...entries, simpleGun]
  expect(weaponAttack(c, data, first)).toMatchObject({ traits: expect.arrayContaining(['Agile']), multipleAttackPenalties: [0, -4, -8] })
  expect(weaponAttack({ ...c, weapons: [first, { ...second, stowed: true }] }, data, first).traits).not.toContain('Agile')
  const other = { ...second, name: martialGun.name }
  expect(weaponAttack({ ...c, weapons: [first, other] }, [...data, martialGun], first).traits).not.toContain('Agile')
})

it('shows suppressed-target attack penalties without changing ordinary attacks', () => {
  const c: Character = { ...base, className: 'Soldier', level: 4,
    feats: [{ name: 'Overwhelming Assault', type: 'Class Feat', level: 4 }] }
  expect(attack(c, simpleGun).multipleAttackPenalties).toEqual([0, -5, -10])
  expect(attack(c, simpleGun).breakdown.notes?.join(' ')).toContain('suppressed targets use a multiple attack penalty of -4/-8')
  expect(attack(c, { ...simpleGun, traits: ['Tech', 'Agile'] }).breakdown.notes?.join(' '))
    .toContain('suppressed targets use a multiple attack penalty of -3/-6')
})

it('grants specialization skill slots and restricts Sniper bonus choices', () => {
  const c = { ...base, level: 15, dismissedFeatSlots: ['skill:1:operative-specialization:3'] }
  const slots = plannedSlots(c, entries)
  const skill = slots.filter(slot => slot.grantedBy === "Operative's Specialization")
  expect(skill.map(slot => [slot.level, slot.grantedSkill])).toEqual([[1, 'Stealth'], [3, 'Stealth'], [7, 'Stealth'], [15, 'Stealth']])
  expect(skill.every(slot => isGrantedSlot(slot.key))).toBe(true)
  const sniper = slots.find(slot => slot.grantedBy === 'Sniper')!
  expect(eligibleFeats(entries, c, sniper).map(feat => feat.name).sort()).toEqual(['Keep Them In Your Sights', 'Scope Sight'])
  expect(ranksAt(c, entries).Stealth).toBeGreaterThanOrEqual(1)
  expect(featChoiceOptions('Assurance', c, entries, skill[0].key)).toEqual(['Stealth'])
  const striker = { ...c, subclass: 'Striker' }
  const strikerSlot = plannedSlots(striker, entries).find(slot => slot.grantedBy === "Operative's Specialization")!
  expect(eligibleFeats(entries, striker, strikerSlot, { includeUnmetPrerequisites: true }).map(feat => feat.name))
    .toContain('Quick Jump')
  expect(eligibleFeats(entries, striker, strikerSlot, { includeUnmetPrerequisites: true }).map(feat => feat.name))
    .not.toContain('Cat Fall')
  expect(plannedSlots({ ...c, subclass: 'Ghost' }, entries).some(slot => slot.grantedBy === 'Sniper')).toBe(false)
})

it('adds a second specialization skill and its initial feat through Versatile Operative', () => {
  const versatile = { name: 'Versatile Operative', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Ghost' }
  const c: Character = { ...base, level: 15, feats: [versatile] }
  const slot = plannedSlots(c, entries).find(candidate => candidate.grantedBy === 'Versatile Operative')!
  expect(slot).toMatchObject({ key: 'skill:1:versatile-operative:class:10:0', level: 10, grantedSkill: 'Deception' })
  expect(isGrantedSlot(slot.key)).toBe(true)
  expect(featChoiceOptions('Versatile Operative', c, entries, '')).not.toContain('Ghost')
  expect(featChoiceOptions('Versatile Operative', c, entries, '')).not.toContain('Sniper')
  expect(subclassSkillGrants(c, entries)).toEqual(expect.arrayContaining(['Stealth', 'Deception']))
  expect(ranksAt(c, entries).Deception).toBeGreaterThanOrEqual(1)
  expect(featChoiceOptions('Assurance', c, entries, slot.key)).toEqual(['Deception'])
  expect(eligibleFeats(entries, c, slot).map(feat => feat.name)).toContain('Assurance')

  const sniper: Character = { ...base, level: 10, subclass: 'Ghost',
    feats: [{ ...versatile, choice: 'Sniper' }] }
  const bonusSlot = plannedSlots(sniper, entries).find(candidate => candidate.grantedBy === 'Sniper')!
  expect(bonusSlot.key).toBe('class:1:versatile-operative-sniper:class:10:0')
  expect(isGrantedSlot(bonusSlot.key)).toBe(true)
  expect(eligibleFeats(entries, sniper, bonusSlot).map(feat => feat.name).sort())
    .toEqual(['Keep Them In Your Sights', 'Scope Sight'])
})

it('uses Dexterity for class DC and applies speed and initiative progression', () => {
  expect(boostSlots(base, entries).find(slot => slot.key === 'class')?.fixed).toBe('dex')
  expect(classDifficultyClass(base, entries)).toBe(17)
  expect(classDifficultyClass({ ...base, level: 11 }, entries)).toBe(29)
  expect(classDifficultyClass({ ...base, level: 19 }, entries)).toBe(39)
  expect(speed({ ...base, level: 11 }, entries) - speed({ ...base, level: 10 }, entries)).toBe(5)
  expect(speed({ ...base, level: 16 }, entries) - speed({ ...base, level: 10 }, entries)).toBe(10)
  const withStatus = { ...base, level: 11, feats: [{ name: 'Reinforced Skeleton', type: 'Ancestry Feat', level: 1 }] }
  expect(speed(withStatus, entries)).toBe(speed({ ...base, level: 11 }, entries))
  const c = { ...base, level: 7 }
  expect(initiativeBonus(c, entries) - initiativeBonus({ ...c, level: 6 }, entries)).toBe(5)
  expect(initiativeBonus({ ...c, feats: [{ name: 'Incredible Initiative', type: 'General Feat', level: 1 }] }, entries)
    - initiativeBonus(c, entries)).toBe(1)
})

it('applies specialization-specific weapon effects only to eligible weapons', () => {
  const sniper = { ...simpleGun, traits: ['Tech', 'Unwieldy', 'Volley 30 feet'], data: { ...simpleGun.data, weapon_group: 'Sniper' } }
  expect(attack({ ...base, level: 9 }, sniper).traits).not.toContain('Unwieldy')
  expect(attack({ ...base, level: 9 }, sniper).traits).not.toContain('Volley 30 feet')
  expect(attack({ ...base, level: 9, subclass: 'Ghost' }, sniper).traits).toContain('Unwieldy')
  expect(attack({ ...base, level: 9 }, sniper).breakdown.notes?.join(' ')).toContain('first failed ranged Strike')
  expect(attack({ ...base, level: 17, subclass: 'Skirmisher' }, simpleGun).breakdown.notes?.join(' '))
    .toContain('two lowest-rolled weapon damage dice')
  expect(attack({ ...base, level: 17, subclass: 'Skirmisher' }, { ...simpleGun, data: { ...simpleGun.data, hands: 2 } })
    .breakdown.notes?.join(' ')).not.toContain('Skirmisher:')
})

it('gives Mechanics critical specialization only with expert weapons from level five', () => {
  const mechanic = { ...base, className: 'Mechanic', level: 5 }
  const expert: ContentEntry = { ...simpleGun, id: 'mechanic-expertise', name: 'Mechanic Weapon Expertise',
    kind: 'classFeature', level: 5, data: { class: 'Mechanic' },
    description: 'Your proficiency ranks for simple weapons, martial weapons, and unarmed attacks increase to expert.' }
  const owned: OwnedWeapon = { id: simpleGun.id, name: simpleGun.name, potency: 0, striking: 0, runes: [] }
  expect(weaponAttack(mechanic, [expert, simpleGun], owned).criticalSpecialization).toBe(true)
  expect(weaponAttack({ ...mechanic, level: 4 }, [expert, simpleGun], owned).criticalSpecialization).toBe(false)
})

it('allows only Computers or Crafting Assurance in Mechanic ingenuity slots', () => {
  const c: Character = { ...base, className: 'Mechanic', level: 3, skillPicks: ['Computers', 'Crafting', 'Stealth'] }
  const slot = plannedSlots(c, entries).find(item => item.grantedBy === "Mechanic's Ingenuity")!
  expect(eligibleFeats(entries, c, slot, { includeUnmetPrerequisites: true }).map(feat => feat.name)).toContain('Assurance')
  expect(featChoiceOptions('Assurance', c, entries, slot.key)).toEqual(['Computers', 'Crafting'])
})
