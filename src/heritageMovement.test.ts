import { expect, it } from 'vitest'
import { mapAonHit, mapAonHits } from './aon'
import { additionalSkillCount, automaticFeatGrants, canUseGiantStature, isLockedWeapon, languageAllowance, maxHp, movementSpeeds, ownedWeapons, ranksAt, resistances, senses, speed, weaponAttack } from './builder'
import type { Character } from './types'

const character = (system: 'pf2e' | 'sf2e', ancestry: string, heritage: string): Character => ({
  id: 'heritage-speed',
  name: 'Test',
  systems: [system],
  level: 1,
  ancestry,
  heritage,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [],
  equipment: [],
  lores: [],
  languages: [],
  entryIds: [],
  extraSlots: [],
  updatedAt: 0,
})

const ancestry = (system: 'pf2e' | 'sf2e', name: string, feet: number, hp = 6) => mapAonHit({
  _id: `ancestry-${name}`,
  _source: { category: 'ancestry', name, hp, speed: { land: feet } },
}, system)!

const heritage = (system: 'pf2e' | 'sf2e', parent: string, name: string, markdown: string, hp?: number) => mapAonHit({
  _id: `ancestries--1-${parent.toLowerCase()}--heritages--1-${name.toLowerCase().replaceAll(' ', '-')}`,
  _source: { category: 'heritage', name, trait: [parent], markdown, ...(hp === undefined ? {} : { hp }) },
}, system)!

it('applies heritage land reductions and fixed swim speeds', () => {
  const leshy = ancestry('pf2e', 'Leshy', 25)
  const seaweed = heritage('pf2e', 'Leshy', 'Seaweed Leshy',
    'You gain a swim Speed of 20 feet. Your land Speed is reduced by 5 feet (to 20 feet for most seaweed leshies).')
  const c = character('pf2e', 'Leshy', 'Seaweed Leshy')

  expect(speed(c, [leshy, seaweed])).toBe(20)
  expect(movementSpeeds(c, [leshy, seaweed])).toContainEqual(
    expect.objectContaining({ name: 'Swim', feet: 20, source: 'Seaweed Leshy' }),
  )
})

it('uses heritage size overrides instead of ancestry size', () => {
  const minotaur = mapAonHit({
    _id: 'ancestry-minotaur',
    _source: { category: 'ancestry', name: 'Minotaur', size: 'Large' },
  }, 'pf2e')!
  const littlehorn = heritage('pf2e', 'Minotaur', 'Littlehorn Minotaur',
    'Your size is Medium instead of Large.')
  const c = { ...character('pf2e', 'Minotaur', 'Littlehorn Minotaur'), level: 10, raging: true,
    feats: [{ name: "Giant's Stature", type: 'Class Feat', level: 6, slot: 'class:6:0' }] }

  expect(littlehorn.data.size).toBe('Medium')
  expect(canUseGiantStature(c, [minotaur, littlehorn])).toBe(true)
})

it('applies heritage resistance that scales with half character level', () => {
  const wintertouched = heritage('pf2e', 'Human', 'Wintertouched Human',
    'You gain cold resistance equal to half your level (minimum 1).')
  const c = { ...character('pf2e', 'Human', 'Wintertouched Human'), level: 8 }
  expect(wintertouched.data.resistances).toBe('cold=half')
  expect(resistances(c, [wintertouched])).toContainEqual({ damage: 'Cold', value: 4, source: 'Wintertouched Human' })

  const conditional = heritage('sf2e', 'Kalo', 'Electric Kalo',
    'If you cast this spell with only 1 target, you gain electricity resistance equal to half your level.')
  expect(conditional.data.resistances).toBeUndefined()
})

it('applies heritage fixed languages and level-based language choices', () => {
  const clanKindred = heritage('sf2e', 'Orc', 'Clan Kindred Orc',
    'You learn Dwarven as an additional language.')
  const fixed = languageAllowance(character('sf2e', 'Orc', 'Clan Kindred Orc'), [clanKindred])
  expect(fixed.locked).toContain('Dwarven')
  expect(fixed.sources.dwarven).toBe('Clan Kindred Orc')

  const exiled = heritage('sf2e', 'Elebrian', 'Exiled Elebrian',
    'You learn any regional language of your choice. You learn another regional language at 5th level, and again at 13th level.')
  const exiledCharacter = character('sf2e', 'Elebrian', 'Exiled Elebrian')
  expect(exiled.data.grants_language_slots).toBe('1:1;5:1;13:1')
  expect(languageAllowance({ ...exiledCharacter, level: 8 }, [exiled]).slots).toBe(3)
  expect(languageAllowance({ ...exiledCharacter, level: 13 }, [exiled]).slots).toBe(4)

  const polyglot = heritage('pf2e', 'Android', 'Polyglot Android',
    'You learn two new languages. If you select the Multilingual feat, you learn three new languages instead of two.')
  const polyglotCharacter = character('pf2e', 'Android', 'Polyglot Android')
  expect(polyglot.data.grants_language_slots).toBe('1:2')
  expect(languageAllowance(polyglotCharacter, [polyglot]).slots).toBe(3)
  expect(languageAllowance({ ...polyglotCharacter,
    feats: [{ name: 'Multilingual', type: 'General Feat', level: 1, slot: 'general:1:0' }] }, [polyglot]).slots).toBe(6)
})

it('grants Angelkin its Empyrean language and Multilingual feat', () => {
  const angelkin = mapAonHit({
    _id: 'feat-angelkin',
    _source: {
      category: 'feat',
      name: 'Angelkin',
      level: 1,
      trait: ['Nephilim', 'Lineage'],
      markdown: 'You descend from an angel. You gain the trained proficiency rank in Society. You know the [Empyrean](/Languages.aspx?ID=115) language, and you gain the [Multilingual](/Feats.aspx?ID=814) skill feat.',
    },
  }, 'pf2e')!
  const multilingual = { name: 'Angelkin', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', sourceId: angelkin.id }
  const c = { ...character('pf2e', 'Human', 'Nephilim'), feats: [multilingual] }
  const empyrean = mapAonHit({ _id: 'language-empyrean', _source: { category: 'language', name: 'Empyrean' } }, 'pf2e')!

  expect(angelkin.data.grants_languages).toBe('Empyrean')
  expect(automaticFeatGrants(c, [angelkin, empyrean])).toContainEqual({
    name: 'Multilingual', source: 'Angelkin', level: 1,
  })
  expect(languageAllowance(c, [angelkin, empyrean])).toMatchObject({
    locked: expect.arrayContaining(['Empyrean']),
    slots: 3,
  })
})

it('adds explicit heritage unarmed attacks as locked character weapons', () => {
  const entries = mapAonHits([{
    _id: 'ancestries--1-kitsune--heritages--1-earthly-wilds',
    _source: {
      category: 'heritage',
      name: 'Earthly Wilds Kitsune',
      trait: ['Kitsune'],
      markdown: 'You gain a jaws unarmed attack that deals 1d6 piercing damage. Your jaws are in the brawling group and have the finesse and unarmed traits.',
    },
  }], 'pf2e')
  const c = character('pf2e', 'Kitsune', 'Earthly Wilds Kitsune')
  const attack = ownedWeapons(c, entries).find(weapon => weapon.name === 'Earthly Wilds Kitsune Jaws')

  expect(attack).toBeDefined()
  expect(isLockedWeapon(c, attack!.name, entries, attack!.id)).toBe(true)
  expect(weaponAttack(c, entries, attack!).entry?.data.damage).toBe('1d6 piercing')
  expect(entries.find(entry => entry.id === attack!.id)?.traits).toEqual(['Finesse', 'Unarmed'])

  const rangedEntries = mapAonHits([{
    _id: 'ancestries--1-azarketi--heritages--1-spined',
    _source: {
      category: 'heritage',
      name: 'Spined Azarketi',
      trait: ['Azarketi'],
      markdown: 'You have a spine ranged unarmed attack with the unarmed trait that deals 1d4 poison damage, has a range increment of 10 feet, and is in the dart weapon group.',
    },
  }], 'pf2e')
  const ranged = rangedEntries.find(entry => entry.data.granted_by_heritage === 'Spined Azarketi')!
  expect(ranged.data).toMatchObject({ weapon_type: 'Ranged', weapon_group: 'Dart', range: 10, damage: '1d4 poison' })

  const meleeEntries = mapAonHits([{
    _id: 'ancestries--1-athamaru--heritages--1-quilled',
    _source: {
      category: 'heritage',
      name: 'Quilled Athamaru',
      trait: ['Athamaru'],
      markdown: 'You gain a quills melee unarmed attack that deals 1d6 piercing damage.',
    },
  }], 'pf2e')
  expect(meleeEntries.find(entry => entry.data.granted_by_heritage === 'Quilled Athamaru')?.data)
    .toMatchObject({ weapon_type: 'Melee', damage: '1d6 piercing' })

  const standardizedEntries = mapAonHits([{
    _id: 'ancestries--1-leshy--heritages--1-ksarik',
    _source: {
      category: 'heritage',
      name: 'Ksarik Leshy',
      trait: ['Leshy'],
      markdown: 'You gain the [Ancestral Unarmed Attack](/feats/1047-ancestral-unarmed-attack) (tentacle, 1d4 bludgeoning [agile, finesse, grapple, trip, unarmed], brawling weapon group) standardized ancestry feat.',
    },
  }], 'sf2e')
  const tentacles = standardizedEntries.find(entry => entry.data.granted_by_heritage === 'Ksarik Leshy')
  expect(tentacles).toMatchObject({ name: 'Ksarik Leshy Tentacle', traits: ['Agile', 'Finesse', 'Grapple', 'Trip', 'Unarmed'] })
  expect(tentacles?.data).toMatchObject({ weapon_category: 'Unarmed', damage: '1d4 bludgeoning', weapon_group: 'Brawling' })
  expect(automaticFeatGrants(character('sf2e', 'Leshy', 'Ksarik Leshy'), standardizedEntries))
    .not.toContainEqual(expect.objectContaining({ name: 'Ancestral Unarmed Attack (tentacle)' }))
})

it('uses imported heritage HP instead of relying on name-specific overrides', () => {
  const centaur = ancestry('pf2e', 'Centaur', 25)
  const stoutheart = heritage('pf2e', 'Centaur', 'Stoutheart Centaur', '', 10)
  expect(maxHp(character('pf2e', 'Centaur', 'Stoutheart Centaur'), [centaur, stoutheart])).toBe(10)
})

it('applies heritage skill training from imported rules for both systems', () => {
  const dwarf = ancestry('pf2e', 'Dwarf', 20)
  const anvil = heritage('pf2e', 'Dwarf', 'Anvil Dwarf', 'You become trained in Crafting.')
  const c = character('pf2e', 'Dwarf', 'Anvil Dwarf')
  expect(ranksAt(c, [dwarf, anvil]).Crafting).toBe(1)

  const alchemist = { ...mapAonHit({
    _id: 'class-alchemist',
    _source: { category: 'class', name: 'Alchemist', skill_proficiency: 'Trained in Crafting' },
  }, 'pf2e')! }
  expect(additionalSkillCount({ ...c, className: 'Alchemist' }, [dwarf, anvil, alchemist])).toBe(1)

  const ysoki = ancestry('sf2e', 'Ysoki', 25)
  const shipborn = heritage('sf2e', 'Ysoki', 'Shipborn Ysoki', 'You become trained in Piloting.')
  expect(ranksAt(character('sf2e', 'Ysoki', 'Shipborn Ysoki'), [ysoki, shipborn]).Piloting).toBe(1)
})

it('imports fixed heritage feat grants without mistaking ancestry feat access for a grant', () => {
  const tailed = heritage('pf2e', 'Goblin', 'Tailed Goblin',
    'You gain [Combat Climber](/Feats.aspx?ID=768) as a bonus feat. You can choose from goblin feats whenever you gain an ancestry feat.')
  const grant = { name: 'Combat Climber', source: 'Tailed Goblin', level: 1 }
  expect(tailed.data.grants_heritage_feats).toBe('Combat Climber')
  expect(automaticFeatGrants(character('pf2e', 'Goblin', 'Tailed Goblin'), [tailed])).toContainEqual(grant)

  const pathfinder = heritage('sf2e', 'Kasatha', 'Kasath Survivalist',
    'You gain the [Feather Step](/feats/1-feather-step) skill feat.')
  expect(automaticFeatGrants(character('sf2e', 'Kasatha', 'Kasath Survivalist'), [pathfinder]))
    .toContainEqual({ name: 'Feather Step', source: 'Kasath Survivalist', level: 1 })

  const conditional = heritage('sf2e', 'Ysoki', 'Akitonian Ysoki',
    'If you are trained in Crafting, you gain [Quick Repair](/feats/1-quick-repair) as a skill feat.')
  expect(conditional.data.grants_heritage_feats).toBeUndefined()

  const tunnel = heritage('sf2e', 'Ysoki', 'Tunnel Ysoki',
    'You gain the [Quick Squeeze](/feats/1-quick-squeeze) skill feat.')
  expect(automaticFeatGrants(character('sf2e', 'Ysoki', 'Tunnel Ysoki'), [tunnel])
    .filter(grant => grant.name === 'Quick Squeeze' && grant.source === 'Tunnel Ysoki')).toHaveLength(1)
})

it('applies Starfinder heritage fly speeds and base-speed-derived climb speeds', () => {
  const bantrid = ancestry('sf2e', 'Bantrid', 25)
  const winged = heritage('sf2e', 'Bantrid', 'Winged Bantrid',
    'Your Speed is 20 feet, and you gain a 20-foot fly Speed.')
  const wingedCharacter = character('sf2e', 'Bantrid', 'Winged Bantrid')
  expect(speed(wingedCharacter, [bantrid, winged])).toBe(20)
  expect(movementSpeeds(wingedCharacter, [bantrid, winged])).toContainEqual(
    expect.objectContaining({ name: 'Fly', feet: 20, source: 'Winged Bantrid' }),
  )

  const skittermander = ancestry('sf2e', 'Skittermander', 30)
  const scrabbler = heritage('sf2e', 'Skittermander', 'Scrabbler Skittermander',
    'You gain a climb Speed equal to your base Speed.')
  expect(movementSpeeds(character('sf2e', 'Skittermander', 'Scrabbler Skittermander'),
    [skittermander, scrabbler])).toContainEqual(
    expect.objectContaining({ name: 'Climb', feet: 30, source: 'Scrabbler Skittermander' }),
  )
})

it('adds precise senses granted by heritage rules', () => {
  const entu = ancestry('sf2e', 'Entu Colony', 25)
  const squentu = heritage('sf2e', 'Entu Colony', 'Squentu',
    'You gain precise scent with a range of 30 feet.')
  expect(senses(character('sf2e', 'Entu Colony', 'Squentu'), [entu, squentu]).map(sense => sense.value))
    .toContain('Scent (precise) 30 feet')
})
