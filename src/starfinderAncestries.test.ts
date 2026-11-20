import { expect, it } from 'vitest'
import snapshot from '../public/data/aon-sf2e.json?raw'
import { mapAonHits } from './aon'
import { additionalSkillCount, ancestryFlaws, automaticFeatGrants, boostSlots, eligibleFeats, featChoiceOptions, isGrantedSlot, maxHp, movementSpeeds, ownedWeapons, plannedSlots, ranksAt, senses, speed, totalHandCapacity, weaponAccessSources, weaponAttack } from './builder'
import type { Character, ContentEntry, OwnedWeapon } from './types'

const hits: Parameters<typeof mapAonHits>[0] = JSON.parse(snapshot)
const entries = mapAonHits(hits.filter(hit => ['Ysoki', 'Vesk', 'Operative', 'Mechanic', 'Soldier'].includes(String(hit._source?.name))
  && ['ancestry', 'class'].includes(String(hit._source?.category)) || hit._source?.name === 'Brutal Anatomy'), 'sf2e')
const base: Character = {
  id: 'ancestry', name: 'Test', systems: ['sf2e'], level: 1, ancestry: 'Ysoki', className: 'Operative',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('provides native Ysoki jaws and replaces them for Fierce Ysoki', () => {
  const normal = ownedWeapons(base, entries).find(weapon => weapon.name === 'Ysoki Jaws')!
  expect(weaponAttack(base, entries, normal)).toMatchObject({ damage: '1d4 piercing', traits: expect.arrayContaining(['Agile', 'Finesse']) })
  const fierce = { ...base, heritage: 'Fierce Ysoki' }
  const jaws = ownedWeapons(fierce, entries).find(weapon => weapon.name === 'Fierce Ysoki Jaws')!
  expect(weaponAttack(fierce, entries, jaws)).toMatchObject({ damage: '1d8 piercing', traits: expect.arrayContaining(['Grapple']) })
  expect(ownedWeapons(fierce, entries).some(weapon => weapon.name === 'Ysoki Jaws')).toBe(false)
  expect(maxHp(fierce, entries) - maxHp(base, entries)).toBe(2)
  expect(boostSlots(fierce, entries).find(slot => slot.key === 'ancestry:0')?.fixed).toBe('str')
  expect(ancestryFlaws(fierce, entries)).toEqual(['dex'])
})

it('grants heritage training, duplicate replacement slots and fixed skill feats', () => {
  const shipborn: Character = { ...base, heritage: 'Shipborn Ysoki' }
  expect(ranksAt(shipborn, entries).Piloting).toBe(1)
  expect(ranksAt({ ...base, heritage: 'Listener Ysoki' }, entries).Occultism).toBe(1)
  expect(automaticFeatGrants({ ...base, heritage: 'Tunnel Ysoki' }, entries))
    .toContainEqual({ name: 'Quick Squeeze', source: 'Tunnel Ysoki', level: 1 })
  const mechanic: Character = { ...base, className: 'Mechanic', heritage: 'Akitonian Ysoki' }
  expect(automaticFeatGrants(mechanic, entries)).toContainEqual({ name: 'Quick Repair', source: 'Akitonian Ysoki', level: 1 })
  const soldier: Character = { ...base, className: 'Soldier', ancestry: 'Vesk', heritage: 'Frilled Vesk' }
  expect(ranksAt(soldier, entries).Intimidation).toBe(1)
  expect(additionalSkillCount(soldier, entries)).toBe(additionalSkillCount({ ...soldier, heritage: undefined }, entries) + 1)
})

it('grants doshko training and Vesk weapon familiarity without affecting unrelated weapons', () => {
  const c: Character = { ...base, className: undefined, ancestry: 'Vesk', level: 5,
    feats: [{ name: 'Vesk Weapon Familiarity', type: 'Ancestry Feat', level: 1 }] }
  const doshko: ContentEntry = { id: 'doshko', name: 'Tactical Doshko', kind: 'weapon', systems: ['sf2e'],
    source: 'official', level: 1, traits: [], description: '', effects: [], updatedAt: 0,
    data: { weapon_category: 'Advanced', weapon_type: 'Melee', damage: '1d8 slashing' } }
  const own: OwnedWeapon = { id: doshko.id, name: doshko.name, potency: 0, striking: 0, runes: [] }
  expect(weaponAttack(c, [doshko], own)).toMatchObject({ rank: 1, criticalSpecialization: true })
  const ancestral = { ...doshko, name: 'Vesk Blade', traits: ['Vesk', 'Uncommon'], data: { ...doshko.data, rarity: 'uncommon' } }
  expect(weaponAccessSources(c, [ancestral], ancestral)).toContain('Vesk Weapon Familiarity')
  expect(weaponAttack(c, [doshko], { ...own, name: 'Other Blade' }).criticalSpecialization).toBe(false)
})

it('provides Warblood Vesk two distinct Brutal Anatomy choices and attacks', () => {
  const c: Character = { ...base, ancestry: 'Vesk', heritage: 'Warblood Vesk', level: 5 }
  const slots = plannedSlots(c, entries).filter(slot => slot.grantedBy === 'Warblood Vesk')
  expect(slots).toHaveLength(2)
  expect(slots.every(slot => isGrantedSlot(slot.key))).toBe(true)
  expect(eligibleFeats(entries, c, slots[0]).map(feat => feat.name)).toEqual(['Brutal Anatomy'])
  const selected: Character = { ...c, feats: [{ name: 'Brutal Anatomy', choice: 'Claw',
    type: 'Ancestry Feat', level: 1, slot: slots[0].key }] }
  expect(featChoiceOptions('Brutal Anatomy', selected, entries, slots[1].key)).toEqual(['Jaws', 'Tail'])
  expect(eligibleFeats(entries, selected, slots[1]).map(feat => feat.name)).toEqual(['Brutal Anatomy'])
  const claw = ownedWeapons(selected, entries).find(weapon => weapon.name === 'Vesk Claw')!
  expect(weaponAttack(selected, entries, claw)).toMatchObject({ damage: expect.stringMatching(/d6 slashing/), criticalSpecialization: true,
    traits: expect.arrayContaining(['Agile', 'Finesse']) })
  expect(weaponAttack({ ...selected, level: 4 }, entries, claw).criticalSpecialization).toBe(false)
})

it('applies heritage senses and Vesk movement and tail without stacking duplicate tails', () => {
  expect(senses({ ...base, heritage: 'Deep Ysoki' }, entries).map(sense => sense.value)).toContain('Darkvision')
  expect(senses({ ...base, heritage: 'Longsnout Ysoki' }, entries).map(sense => sense.value)).toContain('Scent (imprecise) 30 feet')
  const vesk = { ...base, ancestry: 'Vesk' }
  expect(senses({ ...vesk, heritage: 'Nightstalker Vesk' }, entries).map(sense => sense.value)).toContain('Darkvision')
  expect(speed({ ...vesk, heritage: 'Briskwander Vesk' }, entries)).toBe(25)
  const swimmer = { ...vesk, heritage: 'Wavecrested Vesk', level: 16 }
  expect(movementSpeeds(swimmer, entries)).toContainEqual(expect.objectContaining({ name: 'Swim', feet: 30 }))
  const climber = { ...vesk, heritage: 'Horizon Seeker Vesk', feats: [
    { name: 'Prehensile Limbs', type: 'Ancestry Feat', level: 5 }] }
  expect(totalHandCapacity({ ...climber, level: 5 })).toBe(3)
  expect(movementSpeeds(climber, entries)).toContainEqual(expect.objectContaining({ name: 'Climb', feet: 20 }))
})
