import { expect, it } from 'vitest'
import { activeFamiliarAbilities, familiarAbilityCapacity, familiarAbilityEffects, familiarAbilityEntries,
  familiarAbilityUnavailableReason, familiarSelection, familiarSpellBenefits, specificFamiliarGrants, specificFamiliarOptions, specificFamiliarSections } from './familiarAbilities'
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

it('recognizes Animist Spirit Familiar and activates its familiar abilities only while manifested', () => {
  const c: Character = { ...character, className: 'Animist', feats: [
    { name: 'Spirit Familiar (Animist)', type: 'Class Feat', level: 1 },
  ], familiar: { abilities: ['Flier'] } }
  expect(familiarSelection(c)).toMatchObject({ familiar: true, spiritFamiliar: true, dailyAbilityLimit: 2 })
  expect(activeFamiliarAbilities(c, [ability('Flier', '')])).toEqual([])
  const manifested = { ...c, familiar: { ...c.familiar, spiritManifested: true } }
  expect(activeFamiliarAbilities(manifested, [ability('Flier', '')])).toEqual(['Flier'])
  expect(activeFamiliarAbilities({ ...manifested, familiar: { ...manifested.familiar, spiritDestroyed: true } },
    [ability('Flier', '')])).toEqual([])
})

it('reserves one Witch familiar ability for the selected patron', () => {
  const patron: ContentEntry = {
    ...ability('Wilding Steward', ''),
    id: 'patron:wilding-steward',
    kind: 'subclass',
    data: { class: 'Witch', grants_familiar_ability: 'Familiar of Keen Senses',
      familiar_ability_description: 'Your familiar gains scent or tremorsense after you Cast or Sustain a hex.' },
  }
  const abilities = ['Flier', 'Tough', 'Skilled', 'Fast Movement'].map(name => ability(name, ''))
  const witch: Character = { ...character, className: 'Witch', subclass: 'Wilding Steward', level: 1,
    familiar: { abilities: abilities.map(entry => entry.name) } }

  expect(familiarAbilityCapacity(witch, [patron])).toMatchObject({
    dailyAbilityLimit: 4,
    selectableAbilityLimit: 3,
    patronAbility: { name: 'Familiar of Keen Senses', description: expect.stringContaining('scent or tremorsense') },
  })
  expect(activeFamiliarAbilities(witch, [...abilities, patron])).toEqual(['Flier', 'Tough', 'Skilled'])
  expect(familiarAbilityCapacity({ ...witch, subclass: undefined,
    imported: { source: 'pathbuilder', raw: { build: { class: 'Witch', specials: ['Wilding Steward'] } }, unmapped: [] } },
  [patron]).selectableAbilityLimit).toBe(3)
})

it('reserves the Divine Emissary slot for divine emissary abilities', () => {
  const witch: Character = { ...character, className: 'Witch', level: 6,
    feats: [{ name: 'Divine Emissary', type: 'Class Feat', level: 6 }] }
  const entries = familiarAbilityEntries([], witch)
  const get = (name: string) => entries.find(entry => entry.name === name)!
  expect(entries.map(entry => entry.name)).toContain('Erudite')
  expect(familiarAbilityUnavailableReason(get('Erudite'), witch, ['Flier', 'Tough', 'Scent'], false, [])).toBeUndefined()
  expect(familiarAbilityUnavailableReason(ability('Speech', ''), witch, ['Flier', 'Tough', 'Scent', 'Darkvision', 'Climber'], false, [])).toMatch(/Divine Emissary/)
  expect(familiarAbilityUnavailableReason(get('Luminous'), witch, ['Erudite'], false, [])).toMatch(/Only one/)
  expect(familiarAbilityUnavailableReason(get('Erudite'), { ...witch, feats: [] }, [], false, [])).toMatch(/requires/i)
})

it('gives Glyph Familiar one daily ability plus fixed Construct, Flier and Tough', () => {
  const feat = (name: string) => ({ name, type: 'Class Feat', level: 1 })
  const glyph = { ...character, feats: [feat('Glyph Familiar')] }
  expect(familiarAbilityCapacity(glyph, []).dailyAbilityLimit).toBe(1)
  expect(familiarAbilityCapacity({ ...glyph, feats: [...glyph.feats, feat('Enhanced Glyph Familiar')] }, []).dailyAbilityLimit).toBe(2)
  expect(activeFamiliarAbilities(glyph, [])).toEqual(['Construct', 'Flier', 'Tough'])
})

it('activates specific familiar grants only with access and remaining ability capacity', () => {
  const specific = { ...ability('Calligraphy Wyrm', ''), data: { ability_type: 'Specific Familiar',
    required_abilities: 6, access: 'affiliation with Cobyslarni or the Pathfinder Society',
    granted_abilities: 'Darkvision, Flier, Skilled (Arcana, Society)' } }
  const witch: Character = { ...character, className: 'Witch', level: 12,
    feats: [{ name: 'Incredible Familiar', type: 'Class Feat', level: 1 }],
    familiar: { specificFamiliar: specific.name, abilities: ['Tough'] } }
  const entries = [specific, ability('Tough', '')]
  expect(activeFamiliarAbilities(witch, entries)).toEqual(['Tough'])
  const approved = { ...witch, featAccessOverrides: [specific.id] }
  expect(activeFamiliarAbilities(approved, entries)).toEqual(['Tough', 'Darkvision', 'Flier', 'Skilled'])
  expect(activeFamiliarAbilities({ ...approved, level: 1, feats: [] }, entries)).toEqual(['Tough'])
})

it('offers specific familiars by required abilities, reduced by Improved Familiar', () => {
  const specific = { ...ability('Imp', 'Required Number of Abilities 6'), data: { ability_type: 'Specific Familiar' } }
  const wizard: Character = { ...character, className: 'Wizard',
    feats: [{ name: 'Enhanced Familiar', type: 'Class Feat', level: 2 }, { name: 'Familiar', type: 'Class Feat', level: 1 }] }
  expect(specificFamiliarOptions(wizard, [specific]).filter(o => o.entry.name === 'Imp').map(o => [o.required, o.available])).toEqual([[6, false]])
  const improved = { ...wizard, feats: [...wizard.feats, { name: 'Improved Familiar', type: 'Archetype Feat', level: 4 }] }
  expect(specificFamiliarOptions(improved, [specific]).filter(o => o.entry.name === 'Imp').map(o => [o.required, o.available])).toEqual([[4, true]])
  const selected = { ...specific, data: { ...specific.data, access: 'GM approval', granted_abilities: 'Flier' } }
  const withFamiliar = { ...improved, familiar: { specificFamiliar: 'Imp', abilities: ['Tough'] } }
  expect(activeFamiliarAbilities(withFamiliar, [selected, ability('Tough', '')])).toEqual(['Tough'])
  expect(activeFamiliarAbilities({ ...withFamiliar, featAccessOverrides: [selected.id] }, [selected, ability('Tough', '')]))
    .toEqual(['Flier'])
})

it('applies granted abilities of the selected specific familiar without using daily slots', () => {
  const wyrm = { ...ability('Calligraphy Wyrm', 'Required Number of Abilities 2\nGranted Abilities darkvision, flier, manual dexterity, scent, skilled (arcana, society), speech\nInk Spray'),
    data: { ability_type: 'Specific Familiar' } }
  expect(specificFamiliarGrants(wyrm)).toEqual({ abilities: ['Darkvision', 'Flier', 'Manual Dexterity', 'Scent', 'Skilled', 'Speech'], skilled: ['Arcana', 'Society'] })
  const wizard: Character = { ...character, className: 'Wizard', familiar: { specificFamiliar: 'Calligraphy Wyrm' },
    feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }] }
  expect(activeFamiliarAbilities(wizard, [wyrm])).toEqual(['Darkvision', 'Flier', 'Manual Dexterity', 'Scent', 'Skilled', 'Speech'])
})

it('offers Calligraphy Wyrm with granted abilities and unique actions without synced data', () => {
  const wizard: Character = { ...character, className: 'Wizard', familiar: { specificFamiliar: 'Calligraphy Wyrm' },
    feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }, { name: 'Incredible Familiar', type: 'Class Feat', level: 8 }] }
  const [wyrm] = specificFamiliarOptions(wizard, [])
  expect(wyrm).toMatchObject({ required: 6, available: true })
  expect(specificFamiliarGrants(wyrm.entry).abilities).toEqual(['Darkvision', 'Flier', 'Manual Dexterity', 'Scent', 'Skilled', 'Speech'])
  const sections = specificFamiliarSections(wyrm.entry)
  expect(sections.summary[0]).toMatch(/^Calligraphy wyrms are curious dragons/)
  expect(sections.summary[1]).toContain('know-it-alls')
  expect(sections.abilities.map(text => text.split(' ')[0])).toEqual(['Ink', 'Stylus'])
})

it('splits a specific familiar into summary and unique actions', () => {
  const wyrm = ability('Calligraphy Wyrm', 'Calligraphy wyrms are curious dragons.\n\nGranted Abilities darkvision, flier, speech\n\nInk Spray Arcane Frequency once per 10 minutes; Effect The wyrm splatters ink.\n\nStylus Claws The wyrm has stylus-shaped claws.')
  expect(specificFamiliarSections(wyrm)).toEqual({ summary: ['Calligraphy wyrms are curious dragons.'],
    abilities: ['Ink Spray Arcane Frequency once per 10 minutes; Effect The wyrm splatters ink.', 'Stylus Claws The wyrm has stylus-shaped claws.'] })
})

it('gives Improved Familiar Attunement a familiar with extra abilities at 6th, 12th and 18th level', () => {
  const wizard: Character = { ...character, className: 'Wizard', arcaneThesis: 'Improved Familiar Attunement' }
  expect([1, 6, 12, 18].map(level => familiarSelection({ ...wizard, level }).dailyAbilityLimit)).toEqual([3, 4, 5, 6])
  expect(familiarSelection(wizard).familiar).toBe(true)
})
