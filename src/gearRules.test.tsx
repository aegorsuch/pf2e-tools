import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  activeAnimalFeature, blessedArmamentRuneOptions, championBlessings, characterSummary, effectiveWeapon, eligibleFeats,
  featChoiceOptions, heritagesFor, initiativeBonus, maxPropertyRunes, movementSpeeds, ownedWeapons, plannedSlots, resistances, senses, speed, weaponAttack,
} from './builder'
import { companionStats } from './companions'
import { WeaponList } from './GearSection'
import { homebrewCharacterOptions, HAFT_STRIKER_WEAPON, ORC_TUSKS, OVERSIZED_THROW } from './supplemental'
import type { Character, ContentEntry, OwnedWeapon } from './types'

const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Test', level: 10, className: 'Champion', deity: 'Iomedae',
  abilities: { str: 12, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const feat = (name: string, level = 1, choice?: string) => ({ name, level, choice, type: 'Class Feat' })
const content = (kind: ContentEntry['kind'], name: string, data: ContentEntry['data'] = {}, level = 1, traits: string[] = []): ContentEntry =>
  ({ id: name, systems: ['pf2e'], kind, source: 'official', name, data, level, traits, description: '', effects: [], updatedAt: 1 })
const sword = content('weapon', 'Longsword', { damage: '1d8 slashing', hands: 1, weapon_category: 'Martial' })
const deity = content('deity', 'Iomedae', { favored_weapon: 'longsword' })
const main: OwnedWeapon = { id: 'main', name: 'Longsword', potency: 3, striking: 1, runes: [] }

it('gives Orichalcum one extra rune slot without increasing fundamental limits or stacking initiative circumstances', () => {
  for (const potency of [1, 2, 3]) expect(maxPropertyRunes(potency, 'Orichalcum')).toBe(potency + 1)
  expect(maxPropertyRunes(0, 'Orichalcum')).toBe(0)
  const c: Character = { ...base, armors: [{ id: 'a', name: 'Plate', material: 'Orichalcum', potency: 3, resilient: 3, worn: true, runes: [] }] }
  const normal = initiativeBonus({ ...c, armors: [] }, [])
  expect(initiativeBonus(c, [])).toBe(normal + 1)
  expect(initiativeBonus({ ...c, feats: [feat('Incredible Initiative')] }, [])).toBe(normal + 2)
  expect(initiativeBonus({ ...c, armors: c.armors!.map((armor) => ({ ...armor, worn: false })) }, [])).toBe(normal)
})

it('locks eligible Living Weapons to Peachwood without losing dormant Orichalcum configuration', () => {
  const weapon: OwnedWeapon = { ...main, material: 'Orichalcum', livingWeapon: true, runes: ['Flaming', 'Frost', 'Shock', 'Thundering'] }
  const c = { ...base, feats: [feat('Living Weapon')] }
  expect(effectiveWeapon(c, [sword], weapon)).toMatchObject({ material: 'Peachwood (Greater)', runes: ['Flaming', 'Frost', 'Shock', 'Shifting'] })
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
  expect(blessedArmamentRuneOptions(radiant)).toEqual(expect.arrayContaining(['Astral', 'Brilliant', 'Holy']))
  expect(blessedArmamentRuneOptions(radiant)).not.toContain('Unholy')
  expect(blessedArmamentRuneOptions({ ...radiant, level: 9 })).not.toContain('Astral')
  const paragon = { ...radiant, level: 20, feats: [...radiant.feats, feat('Armament Paragon', 20)] }
  expect(blessedArmamentRuneOptions(paragon)).toEqual(expect.arrayContaining(['Fearsome (Greater)', 'Astral (Greater)', 'Brilliant (Greater)']))
  expect(blessedArmamentRuneOptions({ ...paragon, feats: [feat('Armament Paragon', 20)] })).not.toContain('Astral (Greater)')
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

it('applies Jousting only to qualifying selected verdant, living, or favored one-handed melee weapons', () => {
  const c = { ...base, level: 14, feats: ['Favored Weapon Jousting', 'Verdant Weapon Jousting', 'Living Weapon Joust', 'Living Weapon'].map((name) => feat(name)) }
  expect(weaponAttack(c, [sword, deity], main).traits).toContain('Jousting')
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

it.each([[5, 'Low-Grade'], [9, 'Low-Grade'], [10, 'Standard-Grade'], [15, 'Standard-Grade'], [16, 'High-Grade']] as const)('scales locked Cold Iron Tusks material at level %i without granting independent unarmed runes', (level, grade) => {
  const c = { ...base, level, feats: [feat('Cold Iron Tusks', 5)] }
  const tusks = ownedWeapons(c, []).find((weapon) => weapon.name === ORC_TUSKS.name)!
  expect(effectiveWeapon(c, [], tusks)).toMatchObject({ material: `Cold Iron (${grade})`, potency: 0, striking: 0, runes: [] })
  expect(effectiveWeapon({ ...c, handwraps: { potency: 2, striking: 1, runes: ['Flaming'] } }, [], tusks)).toMatchObject({ potency: 2, striking: 1, runes: ['Flaming'] })
  expect(ownedWeapons({ ...c, level: 4 }, []).map((weapon) => weapon.name)).not.toContain('Tusks')
})

it('applies Animal Feature senses, movement, and level gates without changing land Speed', () => {
  const c: Character = { ...base, level: 7, className: 'Ranger', activeSpells: ['Animal Feature'], animalFeature: 'Cat Eyes',
    feats: [feat('Advanced Warden', 4, 'Animal Feature'), feat('Fleet'), feat('Primal Nimbleness')] }
  expect(senses(c, []).map((sense) => sense.value)).toContain('Low-Light Vision')
  expect(senses({ ...c, animalFeature: 'Owl Eyes' }, []).map((sense) => sense.value)).toContain('Darkvision')
  expect(movementSpeeds({ ...c, animalFeature: 'Fish Tail' }, [])).toEqual([{ name: 'Land', feet: 35 }, { name: 'Swim', feet: 35 }])
  expect(movementSpeeds({ ...c, animalFeature: 'Wings' }, [])).toEqual([{ name: 'Land', feet: 35 }, { name: 'Fly', feet: 35 }])
  expect(activeAnimalFeature({ ...c, animalFeature: 'Wings', level: 6 }, [])).toBeUndefined()
  expect(senses({ ...c, activeSpells: [] }, [])).toEqual([])
  expect(movementSpeeds({ ...c, animalFeature: 'Wings', feats: [] }, [])).toEqual([{ name: 'Land', feet: 25 }])
})

it('applies Magic Hide only to the selected companion while the known spell is active', () => {
  const cat = content('companion', 'Cat', { strength: 2, dexterity: 3, constitution: 1, hp: 6, size: 'Small', speed: 35 })
  const c: Character = { ...base, companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Cat', name: 'B' }],
    activeSpells: ['Magic Hide'], magicHideCompanionId: 'b', spells: [{ name: 'Magic Hide', rank: 1, cantrip: false }] }
  const normal = companionStats({ ...c, activeSpells: [] }, [cat], 'Cat')!.ac
  expect(companionStats(c, [cat], 'Cat', undefined, 'a')!.ac).toBe(normal)
  expect(companionStats(c, [cat], 'Cat', undefined, 'b')!.ac).toBe(normal + 1)
  expect(companionStats({ ...c, spells: [] }, [cat], 'Cat', undefined, 'b')!.ac).toBe(normal)
})

it('scales and gates official Oversized Throw and prevents enhancement editing', () => {
  const c = { ...base, className: 'Barbarian', raging: true, weapons: [], feats: [feat('Oversized Throw', 4)] }
  for (const [level, dice] of [[4, 1], [6, 1], [7, 2], [14, 2], [15, 3]]) {
    const character = { ...c, level }
    const weapon = ownedWeapons(character, []).find((weapon) => weapon.id === OVERSIZED_THROW.id)!
    expect(weaponAttack(character, [], weapon)).toMatchObject({ ability: 'dex', range: 20, damage: `${dice}d10+1 bludgeoning`, traits: ['Thrown'] })
  }
  for (const patch of [{ level: 3 }, { raging: false }, { feats: [] }, { className: 'Ranger' }]) {
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
  expect(options.find((entry) => entry.id === 'homebrew:ranger-poison-resistance')?.traits).toEqual(['Ranger'])
  expect(druidPoison.traits).toEqual(['Alchemist', 'Druid'])
})

it('summarizes heritage, ancestry, subclass, and final level without duplicating ancestry', () => {
  const c = { ...base, ancestry: 'Human', heritage: 'Wintertouched Human', className: 'Ranger', subclass: 'Outwit', level: 20 }
  expect(characterSummary(c, [])).toBe('Wintertouched Human Outwit Ranger 20')
  expect(characterSummary({ ...c, heritage: 'Wintertouched' }, [])).toBe('Wintertouched Human Outwit Ranger 20')
})
