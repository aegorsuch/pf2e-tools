import { expect, it } from 'vitest'
import { familiarAbilityEffects, familiarAbilityEntries, familiarAbilityUnavailableReason, familiarSpellBenefits } from './familiarAbilities'
import type { Character, ContentEntry } from './types'

const character: Character = {
  id: 'familiar-rules', systems: ['pf2e'], name: 'Test', level: 8,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  spellcasting: { ability: 'wis', tradition: 'Primal', rank: 4, slots: { 1: 2, 2: 2, 3: 2, 4: 1 } },
}

const ability = (name: string, description: string): ContentEntry => ({
  id: `familiar:${name}`, systems: ['pf2e'], name, kind: 'familiar', source: 'official', level: 1,
  traits: [], description, data: { ability_type: 'Familiar' }, effects: [], updatedAt: 0,
})

it('excludes pet abilities while retaining familiar and master abilities', () => {
  const flier = ability('Flier', 'Fly speed.')
  const petFlier = { ...flier, id: 'pet:flier', data: { ability_type: 'Pet' } }
  const petOnly = { ...ability('Pet Only', ''), data: { ability_type: 'Pet' } }
  const battery = { ...ability('Spell Battery', ''), data: { ability_type: 'Master' } }
  expect(familiarAbilityEntries([petFlier, battery, petOnly, flier], character)).toEqual([flier, battery])
})

it('derives familiar HP, movement, senses, resistance, and skilled modifiers from selected abilities', () => {
  const effects = familiarAbilityEffects([
    'Tough', 'Amphibious', 'Burrower', 'Climber', 'Flier', 'Fast Movement', 'Darkvision',
    'Scent', 'Echolocation', 'Resistance', 'Greater Resistance', 'Major Resistance', 'Skilled',
  ], 8, { fastMovement: 'Fly', resistance: ['fire', 'cold'], skilled: ['Arcana'] }, 4)

  expect(effects.hitPoints).toBe(56)
  expect(effects.speeds).toEqual([
    { movement: 'Land', feet: 25 }, { movement: 'Swim', feet: 25 }, { movement: 'Burrow', feet: 5 },
    { movement: 'Climb', feet: 25 }, { movement: 'Fly', feet: 40 },
  ])
  expect(effects.senses).toEqual(['Darkvision', 'Scent (imprecise, 30 feet)', 'Hearing (precise, 20 feet)'])
  expect(effects.resistances).toEqual([{ damage: 'fire', value: 8 }, { damage: 'cold', value: 8 }])
  expect(effects.skilled).toEqual([{ skill: 'Arcana', modifier: 12 }])
})

it('enforces explicit ability prerequisites, repeatability, and undead trait restrictions', () => {
  const greater = ability('Greater Resistance', 'Your familiar must have the resistance ability to select this.')
  const major = ability('Major Resistance', 'Your familiar must have the greater resistance ability and you must be at least 8th level.')
  const skilled = ability('Skilled', 'You can select this ability repeatedly, choosing a different skill each time.')
  const dragon = ability('Dragon', 'Your familiar has the dragon trait instead of the animal trait.')
  const constructed = ability('Constructed', 'Your aeon wyrd is immune to bleed.')

  expect(familiarAbilityUnavailableReason(greater, character, [])).toContain('Requires the resistance')
  expect(familiarAbilityUnavailableReason(major, { ...character, level: 7 }, ['Resistance', 'Greater Resistance']))
    .toContain('Requires level 8')
  expect(familiarAbilityUnavailableReason(major, character, ['Resistance', 'Greater Resistance'])).toBeUndefined()
  expect(familiarAbilityUnavailableReason(skilled, character, ['Skilled'])).toBeUndefined()
  expect(familiarAbilityUnavailableReason(ability('Tough', ''), character, ['Tough'])).toContain('already been selected')
  expect(familiarAbilityUnavailableReason(dragon, character, [], true)).toContain('changes its trait')
  expect(familiarAbilityUnavailableReason(constructed, character, [], true)).toContain('changes its trait')
})

it('uses automatic Necromancer spellcasting for familiar ability requirements', () => {
  const necromancer: Character = { ...character, className: 'Necromancer', level: 11, spellcasting: undefined }
  const skilled = ability('Skilled', 'Choose a skill.')
  const spellcasting = ability('Spellcasting', 'You must be able to cast 6th-rank spells using spell slots to select this.')
  expect(familiarAbilityUnavailableReason(skilled, necromancer, [])).toBeUndefined()
  expect(familiarAbilityUnavailableReason(spellcasting, necromancer, [])).toBeUndefined()
  expect(familiarAbilityUnavailableReason(spellcasting, { ...necromancer, level: 9 }, []))
    .toContain('Requires spell slots of rank 6')
})

it('activates spell benefits only for valid familiar choices within the daily limit', () => {
  const entries = [
    { ...ability('Cantrip Connection', 'You must be able to prepare cantrips or add them to your repertoire.'), data: { ability_type: 'Master' } },
    { ...ability('Spell Battery', 'You must be able to cast 4th-rank spells using spell slots.'), data: { ability_type: 'Master' } },
  ]
  const c: Character = { ...character, className: 'Necromancer', level: 8,
    feats: [{ name: 'Undead Familiar', type: 'Class Feat', level: 1 }],
    familiar: { abilities: ['Cantrip Connection', 'Spell Battery'] } }
  const slots = { 0: 5, 1: 2, 4: 2 }
  expect(familiarSpellBenefits(c, entries, slots)).toEqual({ cantrip: true, batteryRank: undefined })
  const enhanced = { ...c, feats: [...c.feats, { name: 'Enhanced Undead Familiar', type: 'Class Feat', level: 2 }] }
  expect(familiarSpellBenefits(enhanced, entries, slots)).toEqual({ cantrip: true, batteryRank: 1 })
  expect(familiarSpellBenefits({ ...enhanced, level: 6 }, entries, { 0: 5, 3: 2 }))
    .toEqual({ cantrip: true, batteryRank: undefined })
  expect(familiarSpellBenefits({ ...enhanced, level: 19 }, entries, { 0: 5, 9: 2, 10: 1 }).batteryRank).toBe(6)
  expect(familiarSpellBenefits({ ...enhanced, feats: [] }, entries, slots))
    .toEqual({ cantrip: false, batteryRank: undefined })
  expect(familiarSpellBenefits(enhanced, [], slots)).toEqual({ cantrip: false, batteryRank: undefined })
  const manual = { ...character, className: 'Wizard', feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }],
    familiar: { abilities: ['Cantrip Connection', 'Spell Battery'] } }
  expect(familiarSpellBenefits(manual, entries, { 0: 5, 1: 2, 4: 1 })).toEqual({ cantrip: true, batteryRank: 1 })
  expect(familiarSpellBenefits({ ...manual, familiar: { abilities: ['Spell Battery', 'Spell Battery'] } }, entries, slots))
    .toEqual({ cantrip: false, batteryRank: undefined })
})
