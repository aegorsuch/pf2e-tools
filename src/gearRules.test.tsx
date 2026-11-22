import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import {
  activeAnimalFeatures, animalSkinBenefits, armorClass, armorClassBreakdown, armorRanks, armorSpecialization, augmentationLimit, automaticHardlightGrade, blessedArmamentRuneOptions, blessedArmamentTargets, canBeOsteoArmament, canBeWeaponInnovation, canInstallAugmentation, championBlessings, characterSummary, classDifficultyClass, combinationForms, combinationName, defenseSummary, deitySanctification, dinosaurForm, effectiveHandwraps, effectiveWeapon, eligibleFeats, eligibleWeaponRunes, featEffectChange, gearPickerEntries, hasAutomaticWeaponFundamentals, hasParryWeapon, isLockedWeapon, parryValue, savingThrowBreakdown, spellDifficultyClass,
  featChoiceOptions, heritagesFor, initiativeBonus, magicHideChange, maxPropertyRunes, movementSpeeds, ownedArmors, ownedWeapons, plannedSlots, ragingAthleteBenefits, researchedSpellResistance, resistances, senses, signed, speed, weaponAttack, weaponEntry, weaponEquipped,
} from './builder'
import { companionStats } from './companions'
import { ArmorList, Augmentations, Gadgets, SimplePoisons, WeaponList } from './GearSection'
import { ClassFeatures } from './ClassFeatures'
import { SensesAndSpeed, SkillsSection } from './SkillsSection'
import { MinionsSection } from './MinionsSection'
import { SpellsSection } from './SpellsSection'
import { homebrewCharacterOptions, CLAN_DAGGER, CLAN_DAGGER_DEXTERITY, CLAN_PISTOL, GAUNTLET, HAFT_STRIKER_WEAPON, ORC_TUSKS, OVERSIZED_THROW } from './supplemental'
import { getSettings, updateSettings } from './settings'
import { fetchAonHits } from './aonQuery'
import { mapAonHit, mapAonHits } from './aon'
import type { Character, ContentEntry, HardlightGrade, OwnedWeapon } from './types'
import { parryBonus, ringCapacity, ringCount, twinnedDefenseActive } from './builder'
import { canBeGiantWeapon, giantWeaponClumsy, isGiantWeapon, tradecraftTattooBonus } from './builder'
import { GRAPPLING_MODULE, PARRYING_RUNE, SHOVING_MODULE } from './supplemental'
import { groupHomebrew } from './HomebrewList'
import { crocodileBattleForm, insectBattleForm } from './battleForms'
import { activeBattleForm, animalRageFormChange, bulkLimits, classSpellcasting, dragonTransformationChange, giantStatureChange, giantStatureSize, spellActiveChange, thrashDamage } from './builder'

const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Test', level: 10, className: 'Champion', deity: 'Iomedae',
  abilities: { str: 12, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('uses the unpenalized melee attack for Reactive Strike regardless of Rage', () => {
  const weapon: ContentEntry = { id: 'reactive-blade', systems: ['pf2e'], name: 'Reactive Blade', kind: 'weapon',
    source: 'official', level: 0, traits: [], description: '', effects: [], updatedAt: 0,
    data: { damage: '1d8 slashing', weapon_type: 'Melee' } }
  const owned: OwnedWeapon = { id: weapon.id, name: weapon.name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, feats: [{ name: 'Reactive Strike', type: 'Class Feat', level: 6 }] }
  const melee = weaponAttack(c, [weapon], owned)
  expect(melee.breakdown.notes?.join(' ')).toContain(`Reactive Strike: ${signed(melee.attack)}`)
  expect(melee.breakdown.notes?.join(' ')).toContain('Ignore multiple attack penalty')
  const ranged = { ...weapon, data: { ...weapon.data, weapon_type: 'Ranged', range: 60 } }
  expect(weaponAttack(c, [ranged], owned).breakdown.notes?.join(' ')).not.toContain('Reactive Strike')
  expect(weaponAttack({ ...c, level: 5 }, [weapon], owned).breakdown.notes?.join(' ')).not.toContain('Reactive Strike')
})

it('adds active Thruneosaurus support damage to melee strikes at the companion advancement', () => {
  const melee: ContentEntry = { id: 'blade', systems: ['pf2e'], name: 'Blade', kind: 'weapon', source: 'official',
    level: 0, traits: [], description: '', data: { damage: '1d8 slashing', weapon_type: 'Melee' }, effects: [], updatedAt: 0 }
  const ranged: ContentEntry = { ...melee, id: 'bow', name: 'Bow', data: { ...melee.data, weapon_type: 'Ranged', range: 60 } }
  const blade: OwnedWeapon = { id: 'blade', name: 'Blade', potency: 0, striking: 0, runes: [] }
  const bow: OwnedWeapon = { ...blade, id: 'bow', name: 'Bow' }
  const companion = { id: 'thrune', type: 'Thruneosaurus Rex', name: '', supportActive: true }
  const c: Character = { ...base, companions: [companion], weapons: [blade, bow] }
  const entries = [melee, ranged]
  const damage = (character: Character, weapon = blade) => weaponAttack(character, entries, weapon).additionalDamage
  expect(damage(c)).toMatchObject([{ source: 'Thruneosaurus Support Benefit', value: '1d6 persistent fire' }])
  expect(damage(c, bow)).toEqual([])
  for (const choice of ['Nimble', 'Savage']) {
    const advanced = { ...c, feats: [{ name: 'Incredible Companion', type: 'Class Feat', level: 8, choice }] }
    expect(damage(advanced)).toMatchObject([{ value: '2d6 persistent fire' }])
    expect(renderToStaticMarkup(<WeaponList c={advanced} entries={entries} save={() => {}} displayOnly />))
      .toContain('2d6 persistent fire')
  }
  expect(damage({ ...c, companions: [{ ...companion, supportActive: false }] })).toEqual([])
  expect(damage({ ...c, companions: [{ ...companion, type: 'Wolf' }] })).toEqual([])
  expect(damage({ ...c, companions: [] })).toEqual([])
})

it('adds active Riding Drake support damage to strikes while riding and in reach', () => {
  const melee: ContentEntry = { id: 'blade', systems: ['pf2e'], name: 'Blade', kind: 'weapon', source: 'official',
    level: 0, traits: [], description: '', data: { damage: '1d8 slashing', weapon_type: 'Melee' }, effects: [], updatedAt: 0 }
  const ranged: ContentEntry = { ...melee, id: 'bow', name: 'Bow', data: { ...melee.data, weapon_type: 'Ranged', range: 60 } }
  const blade: OwnedWeapon = { id: 'blade', name: 'Blade', potency: 0, striking: 0, runes: [] }
  const bow: OwnedWeapon = { ...blade, id: 'bow', name: 'Bow' }
  const drake = { id: 'drake', type: 'Riding Drake', name: '', supportActive: true }
  const c: Character = { ...base, companions: [drake], weapons: [blade, bow] }
  const entries = [melee, ranged]
  const damage = (character: Character, weapon = blade) => weaponAttack(character, entries, weapon).additionalDamage
  for (const w of [blade, bow]) expect(damage(c, w)).toMatchObject([{ source: 'Riding Drake Support Benefit',
    value: '1d4 fire', note: expect.stringContaining('while riding the drake') }])
  for (const choice of ['Nimble', 'Savage']) {
    const advanced = { ...c, feats: [{ name: 'Incredible Companion', type: 'Class Feat', level: 8, choice }] }
    expect(damage(advanced)).toMatchObject([{ value: '2d4 fire' }])
    expect(renderToStaticMarkup(<WeaponList c={advanced} entries={entries} save={() => {}} displayOnly />)).toContain('2d4 fire')
  }
  expect(damage({ ...c, companions: [{ ...drake, supportActive: false }] })).toEqual([])
  expect(damage({ ...c, companions: [{ ...drake, type: 'Wolf' }] })).toEqual([])
  expect(damage({ ...c, companions: [{ ...drake, id: 'other', type: 'Bear', supportActive: false }, drake],
    feats: [{ name: 'Incredible Companion', type: 'Class Feat', level: 8, choice: 'Nimble' }] }))
    .toMatchObject([{ value: '1d4 fire' }])
})

it.each([
  [16, 'Master', false, false, 3],
  [16, 'Master', true, false, 2],
  [17, 'Expert', false, false, 3],
  [17, 'Master', false, false, 2],
  [17, 'Master', true, false, 1],
  [17, 'Master', true, true, 1],
] as const)('handles Flurry MAP at level %i with %s proficiency, agile=%s and Agile Grace=%s',
  (level, proficiency, agile, grace, step) => {
    const c: Character = { ...base, level, className: 'Ranger', subclass: 'Flurry',
      feats: grace ? [{ name: 'Agile Grace', type: 'Class Feat', level: 10 }] : [],
      weapons: [{ id: 'sword', name: 'Test Sword', potency: 0, striking: 0, runes: [] }] }
    const entries: ContentEntry[] = [{
      id: 'test-sword', name: 'Test Sword', systems: ['pf2e'], kind: 'weapon', source: 'official', level: 0,
      traits: agile ? ['Agile'] : [], description: '', effects: [], updatedAt: 0,
      data: { weapon_category: 'Martial', damage: '1d8 slashing', hands: 1 },
    }, {
      id: 'ranger', name: 'Ranger', systems: ['pf2e'], kind: 'class', source: 'official', level: 1,
      traits: [], description: '', effects: [], updatedAt: 0,
      data: { attack_proficiency: `${proficiency} in martial weapons` },
    }]
    const attack = weaponAttack(c, entries, c.weapons![0])
    expect(attack.multipleAttackPenalties).toEqual(grace ? [0, -3, -6] : agile ? [0, -4, -8] : [0, -5, -10])
    expect(attack.huntedPreyMultipleAttackPenalties).toEqual([0, -step, -2 * step])
    const totals = [0, -step, -2 * step].map(penalty => `+${attack.attack + penalty}`).join('/')
    for (const displayOnly of [false, true]) {
      const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly={displayOnly} />)
      expect(markup).toContain('aria-label="Flurry note"')
      expect(markup).toContain(`Against your hunted prey: ${totals}.`)
    }
    for (const patch of [{ subclass: 'Precision' }, { className: 'Fighter' }])
      expect(weaponAttack({ ...c, ...patch }, entries, c.weapons![0]).huntedPreyMultipleAttackPenalties).toBeUndefined()
    const manifold: Character = { ...c, level: 18, subclass: 'Precision',
      feats: [{ name: 'Manifold Edge', type: 'Class Feat', level: 18, choice: 'Flurry' }] }
    expect(weaponAttack(manifold, entries, c.weapons![0]).huntedPreyMultipleAttackPenalties).toBeDefined()
  })

it('uses Agile MAP for unarmed attacks', () => {
  const fist = ownedWeapons(base, []).find(weapon => weapon.name === 'Fist')!
  expect(weaponAttack(base, [], fist).multipleAttackPenalties).toEqual([0, -4, -8])
})

it.each([
  [undefined, 1],
  [{ potency: 0, striking: 0, runes: [] }, 2],
  [{ potency: 2, striking: 2, runes: [] }, 3],
  [{ potency: 3, striking: 3, runes: [] }, 4],
] as const)('adds Spark Fist with handwraps %j and %i fire damage', (handwraps, dice) => {
  const c: Character = { ...base, className: undefined, level: 5,
    handwraps: handwraps ? { ...handwraps, runes: [...handwraps.runes] } : undefined,
    feats: [{ name: 'Spark Fist', type: 'Ancestry Feat', level: 5 }] }
  const before = JSON.stringify(c)
  const spark = ownedWeapons(c, []).find(weapon => weapon.name === 'Spark Fist')!
  const fist = ownedWeapons(c, []).find(weapon => weapon.name === 'Fist')!
  expect(spark).toBeDefined()
  expect(fist).toBeDefined()
  const attack = weaponAttack(c, [], spark)
  expect(attack.damage).toBe(`${dice}d4+1 bludgeoning`)
  expect(attack.damage).toBe(weaponAttack(c, [], fist).damage)
  expect(attack.traits).not.toContain('Nonlethal')
  expect(weaponAttack(c, [], fist).traits).toContain('Nonlethal')
  expect(attack.additionalDamage).toContainEqual({ source: 'Spark Fist', value: `${dice} fire`,
    note: `Activate with one action, once per minute, until the end of your next turn. Each successful fist Strike also deals ${dice} fire damage to you.` })
  expect(isLockedWeapon(c, spark.name)).toBe(true)
  for (const displayOnly of [true, false]) {
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).toContain('Spark Fist')
    expect(markup.match(/>Fist<\/button>/g)).toHaveLength(1)
    expect(markup).not.toContain('>Spark Fist</button>')
    expect(markup).toContain(`${dice} fire`)
    expect(markup).toContain(`also deals ${dice} fire damage to you`)
    expect(markup).toContain('once per minute')
  }
  expect(ownedWeapons({ ...c, level: 4, weapons: [spark] }, []).some(weapon => weapon.name === spark.name)).toBe(false)
  expect(ownedWeapons({ ...c, feats: [], weapons: [spark] }, []).some(weapon => weapon.name === spark.name)).toBe(false)
  expect(JSON.stringify(c)).toBe(before)
})

it('hides Fist and Iron Fists only while Spark Fist is available', () => {
  const c: Character = { ...base, level: 5, feats: [
    { name: 'Spark Fist', type: 'Ancestry Feat', level: 5 }, { name: 'Iron Fists', type: 'Ancestry Feat', level: 1 }] }
  for (const displayOnly of [false, true]) {
    const render = (character: Character) => renderToStaticMarkup(<WeaponList c={character} entries={[]} save={() => {}} displayOnly={displayOnly} />)
    const active = render(c)
    expect(active.match(/>Fist<\/button>/g)).toHaveLength(1)
    expect(active).not.toContain('>Spark Fist</button>')
    expect(active).not.toContain('>Fists</button>')
    expect(render({ ...c, level: 4 })).toContain('>Fists</button>')
    expect(render({ ...c, feats: [] })).toContain('>Fist</button>')
  }
})

it('retains Iron Fists traits and Cairn Form dice for Spark Fist', () => {
  const cairn: ContentEntry = { id: 'cairn', name: 'Cairn Form', kind: 'spell', systems: ['pf2e'], source: 'official',
    level: 4, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }
  const c: Character = { ...base, level: 19, feats: [
    { name: 'Spark Fist', type: 'Ancestry Feat', level: 5 }, { name: 'Iron Fists', type: 'Ancestry Feat', level: 1 }],
    spells: [{ name: cairn.name, rank: 4, cantrip: false }], activeSpells: [cairn.name] }
  const spark = ownedWeapons(c, [cairn]).find(weapon => weapon.name === 'Spark Fist')!
  const attack = weaponAttack(c, [cairn], spark)
  expect(attack.damage).toBe('4d6+1 bludgeoning')
  expect(attack.traits).toContain('Shove')
  expect(attack.traits).not.toContain('Nonlethal')
  expect(attack.additionalDamage).toContainEqual(expect.objectContaining({ source: 'Spark Fist', value: '4 fire' }))
  expect(attack.criticalNote).toContain('stunned 1')
})

it.each(['Battleglove', 'Tactical Battleglove', 'Magnet-Directed Battleglove', 'Tekko-Kagi'])('optionally adds Finesse to free-hand weapon %s', name => {
  const previous = getSettings().freeHandFinesse
  const entry: ContentEntry = { id: name, systems: ['sf2e'], kind: 'weapon', source: 'official', name,
    level: 1, traits: ['Agile', 'Free-Hand'], description: '', data: { damage: '1d4 bludgeoning',
      weapon_type: 'Melee', weapon_category: 'Simple', hands: '1' }, effects: [], updatedAt: 0 }
  const weapon: OwnedWeapon = { id: name, name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, systems: ['sf2e'], weapons: [weapon] }
  try {
    updateSettings({ freeHandFinesse: true })
    const enabled = weaponAttack(c, [entry], weapon)
    expect(enabled.traits).toContain('Finesse')
    expect(enabled.ability).toBe('dex')
    expect(weaponAttack(c, [{ ...entry, data: { ...entry.data, weapon_type: 'Ranged' } }], weapon).traits).toContain('Finesse')
    expect(weaponAttack(c, [{ ...entry, traits: ['Agile'] }], weapon).traits).not.toContain('Finesse')
    updateSettings({ freeHandFinesse: false })
    const disabled = weaponAttack(c, [entry], weapon)
    expect(disabled.traits).not.toContain('Finesse')
    expect(disabled.ability).toBe('str')
    expect(enabled.attack - disabled.attack).toBe(3)
    expect(enabled.damage).toBe(disabled.damage)
    expect(entry.traits).toEqual(['Agile', 'Free-Hand'])
  } finally { updateSettings({ freeHandFinesse: previous }) }
})

it.each(['Buckler', 'Gauntlet Buckler'])('optionally adds Finesse only to melee attachments on a %s', name => {
  const previous = getSettings().bucklerMeleeFinesse
  const entry: ContentEntry = { id: 'spikes', systems: ['pf2e'], kind: 'weapon', source: 'official', name: 'Shield Spikes',
    level: 0, traits: ['Attached to Shield'], description: '', data: { damage: '1d6 piercing', weapon_type: 'Melee',
      weapon_category: 'Martial', hands: '1' }, effects: [], updatedAt: 0 }
  const attached: OwnedWeapon = { id: 'attachment', name: entry.name, attachedTo: 'buckler', potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, level: 1, shield: { id: 'buckler', name, hardness: 3, hp: 6, damage: 0, raised: false,
    attachedWeapon: attached } }
  try {
    updateSettings({ bucklerMeleeFinesse: true })
    const enabled = weaponAttack(c, [entry], attached)
    expect(enabled.traits).toContain('Finesse')
    expect(weaponAttack({ ...c, shield: { ...c.shield!, name: 'Steel Shield' } }, [entry], attached).traits).not.toContain('Finesse')
    expect(weaponAttack(c, [entry], { ...attached, attachedTo: undefined }).traits).not.toContain('Finesse')
    const ranged = { ...entry, name: 'Shield Pistol', data: { ...entry.data, weapon_type: 'Ranged', range: '20' } }
    const pistol = { ...attached, name: ranged.name }
    expect(weaponAttack({ ...c, shield: { ...c.shield!, attachedWeapon: pistol } }, [ranged], pistol).traits).not.toContain('Finesse')
    const bareBuckler = { ...c, shield: { ...c.shield!, attachedWeapon: undefined } }
    const bash = ownedWeapons(bareBuckler, []).find(weapon => weapon.name === 'Shield Bash')!
    expect(weaponAttack(bareBuckler, [], bash).traits).not.toContain('Finesse')
    updateSettings({ bucklerMeleeFinesse: false })
    const disabled = weaponAttack(c, [entry], attached)
    expect(disabled.traits).not.toContain('Finesse')
    expect(enabled.attack - disabled.attack).toBe(3)
    expect(enabled.damage).toBe(disabled.damage)
    expect(entry.traits).toEqual(['Attached to Shield'])
  } finally { updateSettings({ bucklerMeleeFinesse: previous }) }
})

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
const haftStance = content('feat', 'Haft Striker Stance', {}, 4, ['Fighter', 'Stance'])
const sword = content('weapon', 'Longsword', { damage: '1d8 slashing', hands: 1, weapon_category: 'Martial' })
const deity = content('deity', 'Iomedae', { favored_weapon: 'longsword', sanctification: 'holy', sanctification_required: true })
const main: OwnedWeapon = { id: 'main', name: 'Longsword', potency: 3, striking: 1, runes: [] }

it.each([
  ['Tethered Living Weapon', 'Living Weapon', 'Ranger', 'livingWeapon'],
  ['Tethered Verdant Weapon', 'Verdant Weapon', 'Druid', 'verdantWeapon'],
  ['Tethered Osteo Weapon', 'Osteo Armaments', 'Necromancer', 'osteoArmament'],
  ['Tethered Favored Weapon', undefined, 'Cleric', undefined],
] as const)('adds Tethered to eligible thrown weapons for %s', (featName, sourceFeat, className, tag) => {
  const thrown = content('weapon', 'Javelin',
    { damage: '1d6 piercing', weapon_category: 'Simple', weapon_type: 'Melee', thrown_range: 30 }, 0, ['Thrown 30 feet'])
  const favoredDeity = content('deity', 'Iomedae', { favored_weapon: 'javelin' })
  const necromancer = content('class', 'Necromancer', { attack_proficiency: 'Trained in simple weapons' })
  const feats = [feat(featName, 20), ...(sourceFeat ? [feat(sourceFeat, 1)] : [])]
  const c: Character = { ...base, level: 20, className, feats }
  const entries = [thrown, sword, favoredDeity, necromancer]
  const weapon: OwnedWeapon = { ...main, id: 'javelin', name: thrown.name,
    livingWeapon: tag === 'livingWeapon', verdantWeapon: tag === 'verdantWeapon', osteoArmament: tag === 'osteoArmament' }
  expect(weaponAttack(c, entries, weapon).entry?.traits).toContain('Tethered')
  expect(weaponAttack({ ...c, level: 19 }, entries, weapon).entry?.traits).not.toContain('Tethered')
  expect(weaponAttack(c, entries, { ...weapon, name: sword.name }).entry?.traits).not.toContain('Tethered')
})

it('increases only held melee weapon reach while Reckless Riding Lunge is active and mounted', () => {
  const c: Character = { ...base, level: 8, feats: [feat('Reckless Riding Lunge', 4)],
    companions: [{ id: 'mount', type: 'Horse', name: '' }], mountedCompanionId: 'mount',
    weapons: [main], activeFeatEffects: ['Reckless Riding Lunge'] }
  expect(weaponAttack(c, [sword], main).reach).toBe(10)
  expect(weaponAttack({ ...c, mountedCompanionId: undefined }, [sword], main).reach).toBe(5)
  expect(weaponAttack({ ...c, feats: [] }, [sword], main).reach).toBe(5)
  expect(weaponAttack({ ...c, weapons: [{ ...main, stowed: true }] }, [sword], { ...main, stowed: true }).reach).toBe(5)
  const fist = ownedWeapons(c, [sword]).find(weapon => weapon.name === 'Fist')!
  expect(weaponAttack(c, [sword], fist).reach).toBe(5)
  const bow = content('weapon', 'Bow', { weapon_type: 'Ranged', weapon_category: 'Martial', range: 60 })
  expect(weaponAttack(c, [sword, bow], { ...main, name: 'Bow' }).reach).toBe(0)
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[sword]} save={() => {}} displayOnly />))
    .not.toContain('Reckless Riding Lunge active')
})

it('shows Galloping Launch range only for thrown weapons and an earned feat', () => {
  const javelin = content('weapon', 'Javelin', { weapon_type: 'Melee', weapon_category: 'Simple', thrown_range: 30, damage: '1d6 piercing' }, 0, ['Thrown 30'])
  const c: Character = { ...base, level: 6, feats: [feat('Galloping Launch', 4)],
    weapons: [{ ...main, name: 'Javelin' }] }
  const render = (character: Character) => renderToStaticMarkup(<WeaponList c={character} entries={[javelin]} save={() => {}} displayOnly />)
  expect(render(c)).toContain('range increment 45 feet, or 50 feet')
  expect(render(c)).toContain('mount must have moved closer to your prey')
  expect(render({ ...c, feats: [] })).not.toContain('Galloping Launch')
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [main] }} entries={[sword]} save={() => {}} displayOnly />))
    .not.toContain('Galloping Launch')
})

it("shows Cavalier's Charge as a conditional attack bonus", () => {
  const c: Character = { ...base, level: 4, feats: [feat("Cavalier's Charge", 4)], weapons: [main] }
  const attack = weaponAttack(c, [sword], main)
  expect(attack.breakdown.notes).toContain(`Cavalier's Charge: ${signed(attack.attack + 1)} on the Strike while riding your mount, within reach or the first range increment (+1 circumstance; circumstance bonuses do not stack).`)
  expect(weaponAttack({ ...c, level: 3 }, [sword], main).breakdown.notes?.join('')).not.toContain("Cavalier's Charge")
})
const osteoClass = content('class', 'Champion', { attack_proficiency: 'Trained in simple weapons and martial weapons' })

it.each([
  [4, 1, 1, undefined], [7, 1, 1, undefined], [8, 1, 1, 'Decaying'],
  [10, 2, 1, 'Decaying'], [12, 2, 2, 'Decaying'], [14, 2, 2, 'Decaying'],
  [15, 2, 2, 'Decaying (Greater)'], [16, 3, 2, 'Decaying (Greater)'], [19, 3, 3, 'Decaying (Greater)'],
])('scales Osteo Armaments without material at level %i', (level, potency, striking, decaying) => {
  const c: Character = { ...base, level: Number(level), feats: [feat('Osteo Armaments', 4)] }
  const weapon: OwnedWeapon = { ...main, osteoArmament: true, potency: 0, striking: 0, runes: ['Flaming'], material: 'Cold Iron' }
  expect(effectiveWeapon(c, [sword, osteoClass], weapon)).toMatchObject({
    potency, striking, material: undefined, runes: ['Flaming', ...(decaying ? [decaying] : [])],
  })
  expect(weapon).toMatchObject({ potency: 0, striking: 0, runes: ['Flaming'], material: 'Cold Iron' })
  expect(effectiveWeapon(c, [sword], { ...weapon, osteoArmament: false })).toMatchObject({
    potency: 0, striking: 0, material: expect.stringContaining('Cold Iron'), runes: ['Flaming'],
  })
})

it('requires active Osteo training and respects advanced-weapon proficiency without recursive attacks', () => {
  const advanced = { ...sword, name: 'Advanced sword', data: { ...sword.data, weapon_category: 'Advanced' } }
  const weapon: OwnedWeapon = { ...main, name: advanced.name, osteoArmament: true, potency: 0, striking: 0 }
  const c = { ...base, feats: [feat('Osteo Armaments', 4)] }
  const entries = [advanced, osteoClass]
  expect(canBeOsteoArmament(c, entries, weapon)).toBe(false)
  expect(effectiveWeapon(c, entries, weapon)).toMatchObject({ potency: 0, striking: 0, runes: [] })
  const trained = { ...c, feats: [...c.feats, feat('Weapon Proficiency', 1, advanced.name)] }
  expect(canBeOsteoArmament(trained, entries, weapon)).toBe(true)
  expect(weaponAttack(trained, entries, weapon).rank).toBe(1)
  expect(effectiveWeapon(trained, entries, weapon)).toMatchObject({ potency: 2, striking: 1, runes: ['Decaying'] })
  expect(canBeOsteoArmament(trained, entries, { ...weapon, attachedTo: 'other' })).toBe(false)
  const future = { ...trained, feats: [{ ...trained.feats[0], takenLevel: 12 }, trained.feats[1]] }
  expect(effectiveWeapon(future, entries, weapon)).toMatchObject({ potency: 0, striking: 0, runes: [] })
})

it('upgrades free Decaying once, preserves purchased runes, and renders damage without a material control', () => {
  const weapon: OwnedWeapon = { ...main, osteoArmament: true, material: 'Cold Iron', runes: ['Decaying', 'Flaming'] }
  const c: Character = { ...base, level: 15, feats: [feat('Osteo Armaments', 4)], weapons: [weapon] }
  const entries = [sword, osteoClass, ...['Decaying', 'Decaying (Greater)', 'Flaming', 'Frost'].map(name =>
    content('item', name, { item_subcategory: 'Weapon Property Runes' }, 8))]
  expect(effectiveWeapon(c, entries, weapon).runes).toEqual(['Flaming', 'Decaying (Greater)'])
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Decaying (Greater)')
  expect(markup).toContain('1d4 void')
  expect(markup).toContain('4d4')
  expect(markup).toContain('void resistance and immunity')
  expect(markup).toContain('aria-label="Add property rune"')
  expect(markup).not.toContain('aria-label="Material"')
  expect(markup).not.toContain('Remove Decaying')
  expect(effectiveWeapon({ ...c, feats: [] }, entries, weapon)).toMatchObject({
    material: 'Cold Iron (Standard-Grade)', runes: ['Decaying', 'Flaming'],
  })
  expect(weapon.runes).toEqual(['Decaying', 'Flaming'])
})

it('preserves purchased Decaying when editing other property runes on an Osteo Armament', () => {
  const weapon = { ...main, osteoArmament: true, runes: ['Decaying', 'Flaming'] }
  let c: Character = { ...base, level: 15, feats: [feat('Osteo Armaments', 4)], weapons: [weapon] }
  const tree = WeaponList({ c, entries: [sword, osteoClass], save: patch => { c = { ...c, ...patch } } })
  const findRunes = (node: ReactNode): ((runes: string[]) => void) | undefined => {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<{ children?: ReactNode; freeRunes?: { source: string }[]; onChange?: (runes: string[]) => void }>(child)) continue
      if (child.props.freeRunes?.some(rune => rune.source === 'Granted by Osteo Armaments')) return child.props.onChange
      const nested = findRunes(child.props.children)
      if (nested) return nested
    }
  }
  findRunes(tree)!(['Flaming', 'Frost'])
  expect(c.weapons?.find(saved => saved.id === weapon.id)?.runes).toEqual(['Flaming', 'Frost', 'Decaying'])
})

it.each([
  [4, 7, 'Large', 25, 15, '1d12+9 piercing', 10],
  [5, 9, 'Huge', 27, 20, '2d12+6 piercing', 15],
  [7, 13, 'Gargantuan', 34, 25, '2d12+15 piercing', 20],
  [10, 20, 'Gargantuan', 41, 25, '2d12+15 piercing', 20],
] as const)('applies Dinosaur Form rank %i to defenses, senses, movement and attacks without altering gear', (rank, level, size, ac, hp, damage, reach) => {
  const spell = content('spell', 'Dinosaur Form', { actions: 'Two Actions' }, 4, ['Polymorph'])
  const c: Character = { ...base, level, spells: [{ name: spell.name, rank, cantrip: false }],
    activeSpells: [spell.name], dinosaurForm: { form: 'Tyrannosaurus', rank }, weapons: [main],
    handwraps: { potency: 3, striking: 3, runes: ['Flaming'] } }
  const entries = [spell, sword]
  const before = JSON.stringify(c.weapons)
  expect(dinosaurForm(c, entries)).toMatchObject({ size, temporaryHp: hp })
  expect(armorClass(c, entries)).toBe(ac)
  expect(movementSpeeds(c, entries)).toEqual([{ name: 'Land', feet: 30, source: 'Dinosaur Form', status: 0 }])
  expect(senses(c, entries)).toEqual(expect.arrayContaining([
    { value: 'Low-light vision', source: 'Dinosaur Form' }, { value: 'Scent (imprecise) 30 feet', source: 'Dinosaur Form' },
  ]))
  const attacks = ownedWeapons(c, entries)
  expect(attacks.map(attack => attack.name)).toEqual(['Tyrannosaurus Jaws', 'Tyrannosaurus Tail'])
  const jaws = weaponAttack(c, entries, attacks[0])
  expect(jaws).toMatchObject({ damage, reach, item: 0, additionalDamage: [] })
  expect(effectiveWeapon(c, entries, attacks[0]).runes).toEqual([])
  const natural = { ...c, activeSpells: [] }
  const ownAttack = weaponAttack(natural, entries, ownedWeapons(natural, entries).find(weapon => weapon.name === 'Fist')!).attack
  expect(jaws.attack).toBe(Math.max(rank >= 7 ? 25 : rank >= 5 ? 18 : 16, ownAttack))
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} part="defense" />)
  expect(defense).toContain(`<small>Temporary Hit Points</small><b>${hp}`)
  expect(defense).toContain(size)
  expect(JSON.stringify(c.weapons)).toBe(before)
  const inventory = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(inventory).toContain('Longsword')
  expect(inventory).not.toContain('Tyrannosaurus Jaws')
  const offense = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly />)
  expect(offense).toContain('Tyrannosaurus Jaws')
  expect(offense).not.toContain('Longsword')
  expect(ownedWeapons(natural, entries).some(weapon => weapon.id === main.id)).toBe(true)
  expect(dinosaurForm({ ...c, spells: [] }, entries)).toBeUndefined()
})

it.each([
  [2, 16, 5, 9, 1, 9, 'Medium', 5, '2d8 piercing'],
  [3, 17, 10, 14, 5, 14, 'Medium', 5, '2d8 piercing'],
  [4, 18, 15, 16, 9, 16, 'Large', 10, '2d8 piercing'],
  [5, 18, 20, 18, 7, 20, 'Huge', 15, '4d8 piercing'],
  [10, 18, 20, 18, 7, 20, 'Huge', 15, '4d8 piercing'],
] as const)('uses the crocodile battle-form statistics at rank %i', (rank, ac, temporaryHp, attack, damageBonus, athletics, size, reach, damage) => {
  const form = crocodileBattleForm(rank, 20)
  expect(form).toMatchObject({ ac: ac + 20, temporaryHp, attack, damageBonus, athletics, size, speed: 25, swimSpeed: 30 })
  expect(form?.attacks[0].data).toMatchObject({ reach, damage })
})

it.each([9, 20])('applies and dismisses crocodile Animal Form without changing equipment at level %i', level => {
  const source: ContentEntry = { ...content('feat', 'Ancestral Form', {}, 9, ['Lizardfolk']),
    spellGrants: [{ kind: 'innate', spells: ['Animal Form'], rank: 3, tradition: 'primal', frequency: 'once per day' }] }
  const spell = content('spell', 'Animal Form', { actions: 'Two Actions' }, 2, ['Polymorph'])
  const dinosaur = content('spell', 'Dinosaur Form', {}, 4)
  const entries = [source, spell, dinosaur, sword]
  const c: Character = { ...base, level, ancestry: 'Lizardfolk', heritage: 'Bakuwa Lizardfolk',
    feats: [{ name: source.name, type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' }],
    activeSpells: ['Animal Form'], weapons: [main], handwraps: { potency: 3, striking: 3, runes: ['Flaming'] },
    spells: [{ name: dinosaur.name, rank: 4, cantrip: false }], dinosaurForm: { form: 'Tyrannosaurus', rank: 4 } }
  const before = JSON.stringify(c)
  expect(activeBattleForm(c, entries)).toMatchObject({ name: 'Crocodile', rank: Math.ceil(level / 2), temporaryHp: 20, size: 'Huge' })
  expect(armorClass(c, entries)).toBe(level + 18)
  expect(movementSpeeds(c, entries)).toEqual([
    { name: 'Land', feet: 25, source: 'Animal Form', status: 0 }, { name: 'Swim', feet: 30, source: 'Animal Form', status: 0 },
  ])
  expect(senses(c, entries)).toEqual(expect.arrayContaining([
    { value: 'Low-light vision', source: 'Animal Form' }, { value: 'Scent (imprecise) 30 feet', source: 'Animal Form' },
  ]))
  const attacks = ownedWeapons(c, entries)
  expect(attacks.map(attack => attack.name)).toEqual(['Crocodile Jaws', 'Crocodile Tail'])
  const normal = { ...c, ...spellActiveChange(c, 'Animal Form', false) }
  const ownAttack = weaponAttack(normal, entries, ownedWeapons(normal, entries).find(weapon => weapon.name === 'Fist')!).attack
  expect(weaponAttack(c, entries, attacks[0])).toMatchObject({ damage: '4d8+7 piercing', reach: 15,
    attack: Math.max(18, ownAttack), item: 0, additionalDamage: [] })
  expect(weaponAttack(c, entries, attacks[1])).toMatchObject({ damage: '2d8+7 bludgeoning', multipleAttackPenalties: [0, -4, -8] })
  expect(effectiveWeapon(c, entries, attacks[0])).toMatchObject({ potency: 0, striking: 0, runes: [] })
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} part="skills" />))
    .toMatch(/class="skill-name">Athletics.*?<b>\+20/)
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} part="defense" />)
  expect(defense).toContain('<small>Temporary Hit Points</small><b>20')
  expect(defense).toContain('hold your breath')
  const inventory = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(inventory).toContain('Longsword')
  expect(inventory).not.toContain('Crocodile Jaws')
  expect(ownedWeapons(normal, entries).some(weapon => weapon.id === main.id)).toBe(true)
  expect(activeBattleForm(normal, entries)).toBeUndefined()
  expect(activeBattleForm({ ...c, feats: [] }, entries)).toBeUndefined()
  const transformed = { ...c, ...spellActiveChange(c, 'Dinosaur Form', true) }
  expect(transformed.activeSpells).toEqual(['Dinosaur Form'])
  expect(activeBattleForm(transformed, entries)?.name).toBe('Tyrannosaurus')
  const untamed = { ...transformed, ...spellActiveChange(transformed, 'Untamed Form', true) }
  expect(untamed.activeSpells).toEqual(['Untamed Form'])
  expect(activeBattleForm(untamed, entries)).toBeUndefined()
  expect(spellActiveChange(untamed, 'Animal Form', true).activeSpells).toEqual(['Animal Form'])
  expect(JSON.stringify(c)).toBe(before)
})

it('switches Dinosaur battle forms, reach, agile attacks, persistent damage and Athletics', () => {
  const spell = content('spell', 'Dinosaur Form', {}, 4)
  const c: Character = { ...base, level: 20, spells: [{ name: spell.name, rank: 10, cantrip: false }],
    activeSpells: [spell.name], dinosaurForm: { form: 'Deinonychus', rank: 10 } }
  const entries = [spell]
  expect(movementSpeeds(c, entries)[0].feet).toBe(40)
  const talon = weaponAttack(c, entries, ownedWeapons(c, entries)[0])
  expect(talon).toMatchObject({ damage: '4d4+15 piercing', multipleAttackPenalties: [0, -4, -8],
    additionalDamage: [{ value: '1 persistent bleed' }], reach: 20 })
  const skills = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} part="skills" />)
  expect(skills).toMatch(/class="skill-name">Athletics.*?<b>\+25/)
  const trained = { ...c, abilities: { ...c.abilities, str: 28 }, rankOverrides: { Athletics: 4 } }
  expect(renderToStaticMarkup(<SkillsSection c={trained} entries={entries} save={() => {}} part="skills" />))
    .toMatch(/class="skill-name">Athletics.*?<b>\+37/)
  const brontosaurus = { ...c, dinosaurForm: { form: 'Brontosaurus', rank: 10 } }
  expect(weaponAttack(brontosaurus, entries, ownedWeapons(brontosaurus, entries)[0]).reach).toBe(25)
  const triceratops = { ...c, dinosaurForm: { form: 'Triceratops', rank: 5 } }
  expect(weaponAttack(triceratops, entries, ownedWeapons(triceratops, entries)[0]))
    .toMatchObject({ damage: '4d8+6 piercing', reach: 15, criticalNote: '1d6 persistent bleed on a critical hit.' })
})

it('applies supported Untamed Form battle statistics and Ferocious Shape without altering equipment', () => {
  const c: Character = { ...base, className: 'Druid', level: 20,
    feats: [feat('Untamed Form', 1), feat('Ferocious Shape', 8)],
    activeSpells: ['Untamed Form'], untamedForm: { form: 'Dinosaur Form', shape: 'tyrannosaurus', rank: 10 },
    weapons: [main], abilities: { ...base.abilities, str: 28 }, rankOverrides: { Athletics: 4 } }
  const entries = [sword]
  expect(activeBattleForm(c, entries)).toMatchObject({ source: 'Untamed Form', name: 'Tyrannosaurus', ac: 41 })
  expect(armorClass(c, entries)).toBe(41)
  expect(ownedWeapons(c, entries).map(weapon => weapon.name)).toEqual(['Tyrannosaurus Jaws', 'Tyrannosaurus Tail'])
  const natural = { ...c, activeSpells: [] }
  const ownAttack = weaponAttack(natural, entries, ownedWeapons(natural, entries).find(weapon => weapon.name === 'Fist')!).attack
  const attack = weaponAttack(c, entries, ownedWeapons(c, entries)[0])
  expect(attack.attack).toBe(ownAttack > 25 ? ownAttack + 2 : 25)
  expect(attack.breakdown.parts.reduce((sum, part) => sum + part.value, 0)).toBe(attack.attack)
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} part="skills" />))
    .toMatch(/class="skill-name">Athletics.*?<b>\+38/)
  expect(c.weapons).toEqual([main])
  expect(activeBattleForm({ ...c, feats: [feat('Untamed Form', 1)] }, entries)).toBeUndefined()
  expect(activeBattleForm({ ...c, activeSpells: [] }, entries)).toBeUndefined()
  expect(activeBattleForm({ ...c, untamedForm: { form: 'Animal Form', shape: 'Crocodile', rank: 10 } }, entries))
    .toMatchObject({ name: 'Crocodile', source: 'Untamed Form', swimSpeed: 30 })
  expect(activeBattleForm({ ...c, untamedForm: { form: 'Animal Form', shape: 'Bear', rank: 10 } }, entries))
    .toMatchObject({ name: 'Bear', source: 'Untamed Form', speed: 30 })
  expect(activeBattleForm({ ...c, untamedForm: { form: 'Animal Form', shape: 'Unknown', rank: 10 } }, entries)).toBeUndefined()
})

it('applies and dismisses Pest Form statistics, weaknesses, and Strike restrictions', () => {
  const c: Character = { ...base, level: 7, spells: [{ name: 'Pest Form', rank: 1, cantrip: false }],
    activeSpells: ['Pest Form'], pestForm: { rank: 1, source: 'Pest Form', flying: true }, weapons: [main] }
  const entries = [sword]
  expect(activeBattleForm(c, entries)).toMatchObject({ size: 'Tiny', ac: 22, athletics: -4, flySpeed: 0 })
  expect(armorClass(c, entries)).toBe(22)
  expect(ownedWeapons(c, entries)).toEqual([])
  expect(movementSpeeds(c, entries)).toEqual([{ name: 'Land', feet: 20, source: 'Pest Form', status: 0 }])
  expect(senses(c, entries)).toEqual(expect.arrayContaining([
    { value: 'Low-light vision', source: 'Pest Form' }, { value: 'Scent (imprecise) 30 feet', source: 'Pest Form' },
  ]))
  const skills = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} part="skills" />)
  expect(skills).toMatch(/class="skill-name">Athletics.*?<b>-4/)
  expect(skills).toMatch(/class="skill-name">Acrobatics.*?<b>\+10/)
  expect(skills).toMatch(/class="skill-name">Stealth.*?<b>\+10/)
  const trained = { ...c, rankOverrides: { Acrobatics: 4, Stealth: 4, Athletics: 4 } }
  const trainedSkills = renderToStaticMarkup(<SkillsSection c={trained} entries={entries} save={() => {}} part="skills" />)
  expect(trainedSkills).toMatch(/class="skill-name">Acrobatics.*?<b>\+19/)
  expect(trainedSkills).toMatch(/class="skill-name">Athletics.*?<b>-4/)
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} part="defense" />)
  expect(defense).toContain('Weakness: Physical 5')
  expect(defense).toContain('Cannot Strike')
  expect(defense).not.toContain('Temporary Hit Points')
  const flying = { ...c, pestForm: { ...c.pestForm!, rank: 4 } }
  expect(movementSpeeds(flying, entries)).toEqual([
    { name: 'Land', feet: 20, source: 'Pest Form', status: 0 },
    { name: 'Fly', feet: 20, source: 'Pest Form', status: 0 },
  ])
  const normal = { ...c, ...spellActiveChange(c, 'Pest Form', false) }
  expect(activeBattleForm(normal, entries)).toBeUndefined()
  expect(ownedWeapons(normal, entries).some(weapon => weapon.id === main.id)).toBe(true)
})

it('applies Ancestral Pest base Speed and swimming only to eligible forms', () => {
  const ancestry = { ...content('ancestry', 'Brenneri', { speed: 30 }), systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Brenneri', feats: [feat('Ancestral Pest', 5)],
    activeSpells: ['Pest Form'], pestForm: { rank: 1, source: 'Ancestral Pest' } }
  expect(movementSpeeds(c, [ancestry])).toEqual([
    { name: 'Land', feet: 30, source: 'Ancestral Pest', status: 0 },
    { name: 'Swim', feet: 20, source: 'Ancestral Pest', status: 0 },
  ])
  expect(movementSpeeds({ ...c, ancestry: 'Lashunta' }, [ancestry]).map(move => move.name)).toEqual(['Land'])
  expect(activeBattleForm({ ...c, ancestry: 'Lashunta' }, [ancestry])).toMatchObject({ name: 'Squox', source: 'Ancestral Pest' })
  expect(movementSpeeds({ ...c, ancestry: 'Entu Colony', pestForm: { ...c.pestForm!, swimming: true } }, [ancestry])
    .map(move => move.name)).toEqual(['Land', 'Swim'])
  expect(activeBattleForm({ ...c, feats: [] }, [ancestry])).toBeUndefined()
})

it('applies Untamed Pest Form and restricts insect shape to non-flying', () => {
  const c: Character = { ...base, className: 'Druid', level: 9, feats: [feat('Untamed Form'), feat('Insect Shape', 6)],
    activeSpells: ['Untamed Form'], untamedForm: { form: 'Pest Form', rank: 5, pestFlying: true }, weapons: [main] }
  expect(activeBattleForm(c, [])).toMatchObject({ source: 'Untamed Form', size: 'Tiny', flySpeed: 20 })
  expect(ownedWeapons(c, [])).toEqual([])
  expect(activeBattleForm({ ...c, untamedForm: { ...c.untamedForm, form: 'Pest Form (Non-flying Insect)' } }, []))
    .toMatchObject({ flySpeed: 0 })
  expect(activeBattleForm({ ...c, feats: [feat('Untamed Form')], untamedForm: {
    ...c.untamedForm, form: 'Pest Form (Non-flying Insect)' } }, [])).toBeUndefined()
})

it('applies animal form movement and attack details across Untamed Form shapes', () => {
  const c: Character = { ...base, className: 'Druid', level: 10, feats: [feat('Untamed Form', 1)],
    activeSpells: ['Untamed Form'], untamedForm: { form: 'Animal Form', shape: 'Snake', rank: 5 } }
  expect(movementSpeeds(c, [])).toEqual([
    { name: 'Land', feet: 20, source: 'Untamed Form', status: 0 },
    { name: 'Swim', feet: 20, source: 'Untamed Form', status: 0 },
    { name: 'Climb', feet: 20, source: 'Untamed Form', status: 0 },
  ])
  expect(weaponAttack(c, [], ownedWeapons(c, [])[0])).toMatchObject({ damage: '4d4+7 piercing',
    additionalDamage: [{ value: '2d6 poison', source: 'Untamed Form' }] })
  const shark = { ...c, untamedForm: { ...c.untamedForm, shape: 'Shark' } }
  expect(movementSpeeds(shark, [])).toEqual([
    { name: 'Land', feet: 0, source: 'Untamed Form', status: 0 },
    { name: 'Swim', feet: 35, source: 'Untamed Form', status: 0 },
  ])
  expect(renderToStaticMarkup(<SkillsSection c={shark} entries={[]} save={() => {}} part="defense" />))
    .toContain('Breathe underwater but not in air.')
})

it('applies Insect Shape battle statistics, senses, persistent poison, and web', () => {
  const c: Character = { ...base, className: 'Druid', level: 10,
    feats: [feat('Untamed Form'), feat('Insect Shape', 6), feat('Ferocious Shape', 8)],
    activeSpells: ['Untamed Form'], untamedForm: { form: 'Insect Form', shape: 'Spider', rank: 5 } }
  const form = activeBattleForm(c, [])
  expect(form).toMatchObject({ name: 'Spider', size: 'Huge', ac: 28, temporaryHp: 20, attack: 18, damageBonus: 2, athletics: 20 })
  expect(movementSpeeds(c, [])).toEqual([
    { name: 'Land', feet: 25, source: 'Untamed Form', status: 0 },
    { name: 'Climb', feet: 25, source: 'Untamed Form', status: 0 },
  ])
  expect(senses(c, []).map(sense => sense.value)).toEqual(expect.arrayContaining(['Low-light vision', 'Darkvision']))
  expect(senses(c, []).map(sense => sense.value)).not.toContain('Scent (imprecise) 30 feet')
  const attacks = ownedWeapons(c, [])
  expect(weaponAttack(c, [], attacks[0])).toMatchObject({ damage: '2d6+2 piercing', reach: 15,
    additionalDamage: [{ value: '2d4 persistent poison', source: 'Untamed Form' }] })
  expect(weaponAttack(c, [], attacks[1])).toMatchObject({ damage: '', reach: 0, range: 20,
    entry: { data: { form_effect: 'A hit immobilizes the target for 1 round or until it Escapes.' } } })
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} displayOnly />))
    .toContain('A hit immobilizes the target for 1 round or until it Escapes.')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="skills" />))
    .toMatch(/class="skill-name">Athletics.*?<b>\+21/)
  expect(activeBattleForm({ ...c, feats: [feat('Untamed Form')] }, [])).toBeUndefined()
  expect(insectBattleForm('Scorpion', 3, 6)).toMatchObject({ attack: 13, athletics: 13, temporaryHp: 10,
    senses: ['Darkvision', 'Tremorsense (imprecise) 60 feet'] })
  expect(insectBattleForm('Centipede', 4, 8)).toMatchObject({ size: 'Large', attack: 16, damageBonus: 6, temporaryHp: 15 })
  expect(insectBattleForm('Mantis', 5, 10)?.senses).toContain('Scent (imprecise) 30 feet')
  expect(insectBattleForm('Beetle', 3, 6)?.attacks[0].data.damage).toBe('2d10 bludgeoning')
  expect(insectBattleForm('Ant', 3, 6)?.climbSpeed).toBe(30)
})

it.each([
  [1, 0, 0, 6], [2, 1, 0, 6], [4, 1, 1, 6], [7, 1, 1, 10], [10, 2, 1, 10],
  [12, 2, 2, 10], [15, 2, 2, 18], [16, 3, 2, 18], [19, 3, 3, 18],
])('scales only the selected Giant weapon and its Rage bonus at level %i', (level, potency, striking, rage) => {
  const blade = content('weapon', 'Bastard Sword', { damage: '1d8 S', hands: 1, weapon_category: 'Martial' }, 0, ['Two-Hand d12'])
  const klass = content('class', 'Barbarian', { attack_proficiency: 'expert in martial weapons' })
  const first: OwnedWeapon = { id: 'first', name: blade.name, potency: 0, striking: 0, material: 'Cold Iron', runes: [], handsHeld: 2 }
  const second = { ...first, id: 'second', material: undefined, stowed: true }
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Giant', level, giantWeaponId: first.id,
    raging: true, abilities: { ...base.abilities, str: 18 }, weapons: [first, second] }
  const entries = [blade, klass]
  const before = JSON.stringify(c)
  expect(effectiveWeapon(c, entries, first)).toMatchObject({ size: 'Large', material: 'Orichalcum', potency, striking })
  expect(effectiveWeapon(c, entries, second)).toEqual(second)
  const specialization = level >= 7 ? level >= 15 ? 4 : 2 : 0
  expect(weaponAttack(c, entries, first)).toMatchObject({ rageDamage: rage, damage: `${1 + striking}d12+${4 + rage + specialization} S` })
  expect(weaponAttack(c, entries, { ...first, handsHeld: 1 }).damage).toBe(`${1 + striking}d8+${4 + rage + specialization} S`)
  expect(weaponAttack({ ...c, raging: false }, entries, first).rageDamage).toBe(0)
  expect(weaponAttack(c, entries, second).rageDamage).toBe(2)
  expect(weaponAttack(c, entries, first).traits).toEqual(['Two-Hand d12'])
  expect(JSON.stringify(c)).toBe(before)
})

it.each([false, true])('includes Giant Rage damage without helper text in weapon displayOnly=%s', displayOnly => {
  const klass = content('class', 'Barbarian', { attack_proficiency: 'expert in martial weapons' })
  const c: Character = { ...base, level: 15, className: 'Barbarian', subclass: 'Giant', raging: true,
    giantWeaponId: main.id, weapons: [main] }
  const html = renderToStaticMarkup(<WeaponList c={c} entries={[sword, klass]} save={() => {}} displayOnly={displayOnly} />)
  expect(html).toContain('Damage 3d8+23 S')
  expect(html).not.toContain('Longsword (Large)')
  expect(effectiveWeapon(c, [sword, klass], main).size).toBe('Large')
  expect(html).not.toContain('Includes +18 Rage damage')
  expect(html).not.toContain('Thrown Strikes require Raging Thrower')
})

it('applies Giant clumsy only while wielding the selected weapon, including outside Rage', () => {
  const blade = { ...sword, name: 'Rapier', traits: ['Finesse'] }
  const weapon = { ...main, name: blade.name, potency: 0, striking: 0 }
  const c: Character = { ...base, level: 1, className: 'Barbarian', subclass: 'Giant Instinct',
    weapons: [weapon], giantWeaponId: weapon.id, raging: false, abilities: { ...base.abilities, str: 10 } }
  const entries = [blade]
  const stowed: Character = { ...c, weapons: [{ ...weapon, stowed: true }] }
  expect(giantWeaponClumsy(c, entries)).toBe(1)
  expect(giantWeaponClumsy(stowed, entries)).toBe(0)
  expect(armorClass(c, entries)).toBe(armorClass(stowed, entries) - 1)
  expect(savingThrowBreakdown(c, entries, 'Reflex').total).toBe(savingThrowBreakdown(stowed, entries, 'Reflex').total - 1)
  expect(savingThrowBreakdown(c, entries, 'Will').total).toBe(savingThrowBreakdown(stowed, entries, 'Will').total)
  expect(weaponAttack(c, entries, weapon).attack).toBe(weaponAttack(stowed, entries, weapon).attack - 1)
  const skills = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} />)
  expect(skills).toContain('class="skill-name">Stealth <b>+3')
  expect(skills).toContain('Giant Instinct: clumsy 1')
  expect(giantWeaponClumsy({ ...c, subclass: 'Fury' }, entries)).toBe(0)
  expect(isGiantWeapon({ ...c, className: 'Fighter' }, entries, weapon)).toBe(false)
  expect(canBeGiantWeapon(c, entries, { ...weapon, name: 'Fist' })).toBe(false)
  expect(canBeGiantWeapon(c, entries, { ...weapon, name: 'Unavailable weapon' })).toBe(false)
})

it('applies the strongest relevant condition penalty to checks, DCs, and Strength damage', () => {
  const klass = content('class', 'Barbarian', { attribute: 'Strength' })
  const c: Character = { ...base, className: 'Barbarian', abilities: { ...base.abilities, str: 18, dex: 18 },
    weapons: [main] }
  const affected = { ...c, conditions: { frightened: 2, sickened: 1, enfeebled: 3 } }
  const normal = defenseSummary(c, [sword, klass])
  const penalized = defenseSummary(affected, [sword, klass])
  expect(penalized.ac).toBe(normal.ac - 2)
  expect(penalized.perception).toBe(normal.perception - 2)
  expect(penalized.fortitude).toBe(normal.fortitude - 2)
  expect(penalized.reflex).toBe(normal.reflex - 2)
  expect(classDifficultyClass(affected, [klass])).toBe(classDifficultyClass(c, [klass])! - 3)
  const weapon = weaponAttack(c, [sword], main)
  const weakened = weaponAttack(affected, [sword], main)
  expect(weakened.attack).toBe(weapon.attack - 3)
  expect(weakened.damage).toBe('2d8+1 slashing')
  const bow = content('weapon', 'Bow', { damage: '1d8 piercing', weapon_type: 'Ranged', range: 60 })
  const ownedBow = { ...main, name: bow.name }
  expect(weaponAttack(affected, [bow], ownedBow).attack).toBe(weaponAttack(c, [bow], ownedBow).attack - 2)
  expect(weaponAttack(affected, [bow], ownedBow).damage).toBe(weaponAttack(c, [bow], ownedBow).damage)
  const druid = content('class', 'Druid', { attribute: 'Wisdom' })
  const caster = { ...c, className: 'Druid' }
  expect(spellDifficultyClass({ ...caster, conditions: affected.conditions }, [druid]))
    .toBe(spellDifficultyClass(caster, [druid])! - 2)
})

it('does not stack frightened or sickened with Giant clumsy', () => {
  const blade = { ...sword, name: 'Rapier', traits: ['Finesse'] }
  const weapon = { ...main, name: blade.name, potency: 0, striking: 0 }
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Giant Instinct',
    weapons: [weapon], giantWeaponId: weapon.id, abilities: { ...base.abilities, str: 10 } }
  const frightened = { ...c, conditions: { frightened: 2, sickened: 1 } }
  expect(armorClass(frightened, [blade])).toBe(armorClass(c, [blade]) - 1)
  expect(savingThrowBreakdown(frightened, [blade], 'Reflex').total).toBe(savingThrowBreakdown(c, [blade], 'Reflex').total - 1)
  expect(weaponAttack(frightened, [blade], weapon).attack).toBe(weaponAttack(c, [blade], weapon).attack - 1)
})

it('chooses the better finesse attack after condition penalties', () => {
  const blade = { ...sword, traits: ['Finesse'] }
  const c: Character = { ...base, abilities: { ...base.abilities, str: 18, dex: 16 },
    conditions: { enfeebled: 3 } }
  const attack = weaponAttack(c, [blade], main)
  expect(attack.ability).toBe('dex')
  expect(attack.attack).toBe(weaponAttack({ ...c, conditions: {}, abilities: { ...c.abilities, str: 16 } }, [blade], main).attack)
  expect(attack.damage).toBe('2d8+1 slashing')
})

it('applies conditions to battle form statistics without counting them twice', () => {
  const c: Character = { ...base, className: 'Druid', level: 10,
    feats: [feat('Untamed Form', 1)], activeSpells: ['Untamed Form'],
    untamedForm: { form: 'Animal Form', shape: 'Bear', rank: 5 } }
  const affected = { ...c, conditions: { frightened: 2, enfeebled: 3 } }
  const attack = weaponAttack(c, [], ownedWeapons(c, [])[0])
  const penalized = weaponAttack(affected, [], ownedWeapons(affected, [])[0])
  expect(armorClass(affected, [])).toBe(armorClass(c, []) - 2)
  expect(penalized.attack).toBe(attack.attack - 3)
  expect(penalized.breakdown.parts.reduce((sum, part) => sum + part.value, 0)).toBe(penalized.attack)
})

it("applies Giant's Lunge to melee weapons and unarmed attacks without reducing existing reach", () => {
  const polearm = content('weapon', 'Test Polearm', { weapon_type: 'Melee', damage: '1d8 piercing', reach: 15 }, 0, ['Reach'])
  const bow = content('weapon', 'Test Bow', { weapon_type: 'Ranged', range: 60, damage: '1d8 piercing' })
  const c: Character = { ...base, level: 14, className: 'Barbarian', raging: true,
    feats: [feat("Giant's Lunge", 14)], activeFeatEffects: ["Giant's Lunge"], weapons: [main] }
  const entries = [sword, polearm, bow]
  const owned = (entry: ContentEntry): OwnedWeapon => ({ id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] })
  const fist = ownedWeapons(c, entries).find(weapon => weapon.name === 'Fist')!
  expect(weaponAttack(c, entries, main).reach).toBe(10)
  expect(weaponAttack(c, entries, fist).reach).toBe(10)
  expect(weaponAttack(c, entries, owned(polearm)).reach).toBe(15)
  expect(weaponAttack(c, entries, owned(bow)).reach).toBe(0)
  expect(weaponAttack({ ...c, raging: false }, entries, main).reach).toBe(5)
  expect(weaponAttack({ ...c, level: 13 }, entries, main).reach).toBe(5)
  expect(weaponAttack({ ...c, activeFeatEffects: [] }, entries, main).reach).toBe(5)
  const markup = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={entries} save={() => {}} part="defense" />)
  expect(markup(c)).not.toContain(`Giant&#x27;s Lunge active`)
  expect(markup({ ...c, raging: false })).not.toContain(`Giant&#x27;s Lunge active`)
})

it("applies Giant's and Titan's Stature size, reach, clumsy, and Rage gating", () => {
  const c: Character = { ...base, level: 14, className: 'Barbarian', subclass: 'Giant', raging: true,
    feats: [feat("Giant's Stature", 6), feat("Titan's Stature", 12), feat("Giant's Lunge", 14)],
    activeFeatEffects: ["Giant's Lunge"], weapons: [main] }
  const large = { ...c, ...giantStatureChange(c, 'Large') }
  const huge = { ...c, ...giantStatureChange(c, 'Huge') }
  expect(giantStatureSize(large, [sword])).toBe('Large')
  expect(giantStatureSize(huge, [sword])).toBe('Huge')
  expect(bulkLimits(huge, [sword]).sizeMultiplier).toBe(4)
  expect(weaponAttack(large, [sword], main).reach).toBe(15)
  expect(weaponAttack(huge, [sword], main).reach).toBe(20)
  expect(armorClass(large, [sword])).toBe(armorClass(c, [sword]) - 1)
  expect(savingThrowBreakdown(huge, [sword], 'Reflex').total).toBe(savingThrowBreakdown(c, [sword], 'Reflex').total - 1)
  const armed = { ...huge, giantWeaponId: main.id }
  expect(giantWeaponClumsy(armed, [sword])).toBe(1)
  expect(effectiveWeapon(armed, [sword], main).size).toBe('Gargantuan')
  expect(giantStatureSize({ ...huge, raging: false }, [sword])).toBeUndefined()
  expect(giantStatureSize({ ...huge, level: 11 }, [sword])).toBeUndefined()
  const naturallyLarge = content('ancestry', 'Large Test', { size: 'Large' })
  expect(giantStatureSize({ ...large, ancestry: naturallyLarge.name }, [naturallyLarge])).toBeUndefined()
  const html = renderToStaticMarkup(<SkillsSection c={huge} entries={[sword]} save={() => {}} part="defense" />)
  expect(html).not.toContain('aria-label="Giant&#x27;s Stature size"')
  expect(html).toContain('<small>Size</small><b>Huge</b>')
  const transformed = { ...large, ...spellActiveChange(large, 'Untamed Form', true) }
  expect(transformed.giantStature).toBeUndefined()
  expect(giantStatureChange({ ...c, activeSpells: ['Untamed Form'] }, 'Large').activeSpells).toEqual([])
})

it('applies chosen Giant raging resistance only from level 9 and while raging', () => {
  const c: Character = { ...base, level: 9, className: 'Barbarian', subclass: 'Giant',
    raging: true, giantRagingResistance: 'Fire', abilities: { ...base.abilities, con: 18 } }
  expect(resistances(c, [])).toEqual([
    { damage: 'Bludgeoning', value: 7, source: 'Raging Resistance' },
    { damage: 'Fire', value: 7, source: 'Raging Resistance' },
  ])
  expect(resistances({ ...c, raging: false }, [])).toEqual([])
  expect(resistances({ ...c, level: 8 }, [])).toEqual([])
  expect(resistances({ ...c, className: 'Fighter' }, [])).toEqual([])
  expect(resistances({ ...c, giantRagingResistance: undefined }, [])).toEqual([
    { damage: 'Bludgeoning', value: 7, source: 'Raging Resistance' },
  ])
})

it.each([[1, 4], [7, 8], [15, 16]])('applies selected Draconic Rage damage at level %i', (level, rage) => {
  const c: Character = { ...base, level, className: 'Barbarian', subclass: 'Dragon', raging: true,
    barbarianDragon: 'Diabolic', draconicRage: true, weapons: [main] }
  const attack = weaponAttack(c, [sword], main)
  expect(attack.rageDamage).toBe(rage)
  expect(attack.additionalDamage).toContainEqual({ source: 'Draconic Rage', value: `${rage} fire`, note: 'Additional damage from Draconic Rage.' })
  expect(attack.damage).toBe(weaponAttack({ ...c, raging: false }, [sword], main).damage)
  const ordinary = weaponAttack({ ...c, draconicRage: false }, [sword], main)
  expect(ordinary.rageDamage).toBe(2)
  expect(ordinary.additionalDamage.some(item => item.source === 'Draconic Rage')).toBe(false)
  if (level >= 9) expect(resistances(c, [sword])).toContainEqual({ damage: 'Fire', value: 3, source: 'Raging Resistance' })
})

it('provides dragon breath damage, action, and class DC for the chosen dragon while raging', () => {
  const barbarian = content('class', 'Barbarian', { attribute: 'Strength' })
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Dragon', level: 8, raging: true,
    barbarianDragon: 'Omen', feats: [feat("Dragon's Rage Breath", 6)] }
  const html = renderToStaticMarkup(<ClassFeatures c={c} entries={[barbarian]} save={() => {}} />)
  expect(html).toContain('8d6 mental')
  expect(html).toContain('30-foot cone; basic Reflex save')
  expect(html).toContain('Occult trait; once per 10 minutes')
  expect(renderToStaticMarkup(<ClassFeatures c={{ ...c, raging: false }} entries={[barbarian]} save={() => {}} />))
    .not.toContain('Roll Dragon&#x27;s Rage Breath')
})

it('applies Ghost Wrangler to fists and Strength skills until its effect ends', () => {
  const c: Character = { ...base, level: 4, className: 'Barbarian', subclass: 'Spirit', raging: true,
    feats: [feat('Ghost Wrangler', 4)], activeFeatEffects: ['Ghost Wrangler'], weapons: [main] }
  const offense = (character: Character) =>
    renderToStaticMarkup(<WeaponList c={character} entries={[sword]} save={() => {}} displayOnly />)
  expect(offense(c)).toContain('Granted by Ghost Wrangler')
  expect(offense({ ...c, activeFeatEffects: [] })).not.toContain('Granted by Ghost Wrangler')
  expect(offense({ ...c, raging: false })).not.toContain('Granted by Ghost Wrangler')
  expect(offense({ ...c, spiritRage: true })).not.toContain('Granted by Ghost Wrangler')
  const skills = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="skills" />)
  expect(skills).toContain('Can use Strength-based skill checks against incorporeal creatures')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />))
    .toContain('aria-label="Ghost Wrangler active" checked=""')
})

it('calculates Thrash damage and exposes Collateral Thrash saves', () => {
  const klass = content('class', 'Barbarian', { attack_proficiency: 'expert in unarmed attacks' })
  const c: Character = { ...base, level: 8, className: 'Barbarian', subclass: 'Fury', raging: true,
    abilities: { ...base.abilities, str: 18 }, feats: [feat('Thrash', 8)] }
  expect(thrashDamage(c, [klass])).toBe(13)
  expect(thrashDamage({ ...c, level: 18 }, [klass])).toBe(21)
  expect(thrashDamage({ ...c, subclass: 'Animal', barbarianAnimal: 'Bear' }, [klass])).toBe(8)
  const html = (character: Character) => renderToStaticMarkup(<ClassFeatures c={character} entries={[klass]} save={() => {}} />)
  expect(html(c)).toContain(`${thrashDamage(c, [klass])} bludgeoning`)
  expect(html(c)).toContain('basic Fortitude save')
  expect(html({ ...c, raging: false })).not.toContain('Roll Thrash')
  const collateral = { ...c, level: 20, feats: [...c.feats, feat('Collateral Thrash', 16), feat('Whirlwind Toss', 18)] }
  expect(html(collateral)).toContain('basic Reflex save')
  expect(html(collateral)).toContain('throws the grabbed creature 10 feet')
})

it('calculates Brutal Bully damage only while raging', () => {
  const c: Character = { ...base, level: 8, className: 'Barbarian', raging: true,
    abilities: { ...base.abilities, str: 18 }, feats: [feat('Brutal Bully', 6)] }
  const render = (character: Character) => renderToStaticMarkup(<ClassFeatures c={character} entries={[]} save={() => {}} />)
  expect(render(c)).toContain('4 bludgeoning')
  expect(render(c)).toContain('Roll Brutal Bully')
  expect(render({ ...c, raging: false })).not.toContain('Roll Brutal Bully')
  expect(render({ ...c, level: 5 })).not.toContain('Roll Brutal Bully')
})

it('applies Barbarian Dedication AC penalty only while its Rage is active', () => {
  const c: Character = { ...base, level: 8, className: 'Fighter',
    feats: [feat('Barbarian Dedication', 2)] }
  const normal = armorClass(c, [])
  const raging = { ...c, raging: true }
  expect(armorClass(raging, [])).toBe(normal - 1)
  expect(armorClassBreakdown(raging, []).parts).toContainEqual({ label: 'Barbarian Dedication: Rage', value: -1 })
  expect(armorClass({ ...raging, feats: [] }, [])).toBe(normal)
  expect(armorClass({ ...raging, className: 'Barbarian' }, [])).toBe(armorClass({ ...c, className: 'Barbarian' }, []))
})

it('calculates thrown melee attacks with Dexterity and Raging Thrower damage', () => {
  const dagger = content('weapon', 'Test Dagger', { weapon_type: 'Melee', damage: '1d4 piercing',
    weapon_category: 'Simple', hands: 1 }, 0, ['Agile', 'Finesse', 'Thrown 10 feet'])
  const weapon = { ...main, id: 'dagger', name: dagger.name, potency: 0, striking: 0 }
  const c: Character = { ...base, level: 4, className: 'Barbarian', subclass: 'Fury', raging: true,
    abilities: { ...base.abilities, str: 18, dex: 12 }, feats: [feat('Raging Thrower')], weapons: [weapon] }
  const previous = getSettings().barbarianIgnoreAgile
  updateSettings({ barbarianIgnoreAgile: false })
  try {
  const melee = weaponAttack(c, [dagger], weapon)
  const thrown = weaponAttack(c, [dagger], weapon, { thrown: true })
  expect(thrown.attack).toBe(melee.attack - 3)
  expect(thrown.range).toBe(10)
  expect(thrown.reach).toBe(0)
  expect(thrown.rageDamage).toBe(1)
  expect(thrown.damage).toBe('1d4+5 piercing')
  expect(weaponAttack({ ...c, feats: [] }, [dagger], weapon, { thrown: true }).damage).toBe('1d4+4 piercing')
  const dragon = { ...c, subclass: 'Dragon', barbarianDragon: 'Diabolic' as const, draconicRage: true }
  expect(weaponAttack(dragon, [dagger], weapon, { thrown: true }).additionalDamage)
    .toContainEqual(expect.objectContaining({ source: 'Draconic Rage', value: '2 fire' }))
  expect(weaponAttack({ ...dragon, feats: [] }, [dagger], weapon, { thrown: true }).additionalDamage)
    .not.toContainEqual(expect.objectContaining({ source: 'Draconic Rage' }))
  const html = renderToStaticMarkup(<WeaponList c={c} entries={[dagger]} save={() => {}} displayOnly />)
  expect(html).toContain('Thrown: Attack')
  expect(html).toContain('Damage 1d4+5 P')
  const calm = renderToStaticMarkup(<WeaponList c={{ ...c, raging: false }} entries={[dagger]} save={() => {}} displayOnly />)
  expect(calm).not.toContain('Thrown: Attack')
  } finally { updateSettings({ barbarianIgnoreAgile: previous }) }
})

it('calculates Perfect Clarity rerolls without stacking Desperate Wrath', () => {
  const c: Character = { ...base, level: 20, className: 'Barbarian', raging: true,
    feats: [feat('Perfect Clarity', 18), feat('Desperate Wrath', 16)], activeFeatEffects: ['Desperate Wrath'] }
  const attack = weaponAttack(c, [sword], main)
  expect(attack.breakdown.notes.join(' ')).toContain(`at ${signed(attack.attack)} (+2 circumstance`)
  const will = savingThrowBreakdown(c, [], 'Will')
  expect(will.notes?.join(' ')).toContain(`at ${signed(will.total + 2)} (+2 circumstance)`)
  expect(weaponAttack({ ...c, raging: false }, [sword], main).breakdown.notes.join(' ')).not.toContain('Perfect Clarity')
  expect(savingThrowBreakdown({ ...c, level: 17 }, [], 'Will').notes?.join(' ') ?? '').not.toContain('Perfect Clarity')
})

it('shows Inured to Alchemy recovery rules without requiring Rage', () => {
  const c: Character = { ...base, level: 4, raging: false, feats: [feat('Inured to Alchemy', 4)] }
  const notes = savingThrowBreakdown(c, [], 'Fortitude').notes?.join(' ') ?? ''
  expect(notes).toContain('successful save reduces the stage by 2')
  expect(notes).toContain('virulent afflictions')
  expect(savingThrowBreakdown({ ...c, level: 3 }, [], 'Fortitude').notes?.join(' ') ?? '')
    .not.toContain('Inured to Alchemy')
})

it('provides Barbarian impact damage actions at their earned levels', () => {
  const c: Character = { ...base, level: 20, className: 'Barbarian', raging: true,
    abilities: { ...base.abilities, str: 20 }, feats: [
      feat('Overpowering Charge', 10), feat('Impressive Landing', 10), feat('Quaking Stomp', 20),
    ] }
  const html = (character: Character) => renderToStaticMarkup(<ClassFeatures c={character} entries={[]} save={() => {}} />)
  expect(html(c)).toContain('Roll Overpowering Charge')
  expect(html(c)).toContain('5 bludgeoning')
  expect(html(c)).toContain('Roll Impressive Landing')
  expect(html(c)).toContain('11d6 bludgeoning')
  expect(html(c)).toContain('60-foot burst within 500 feet')
  expect(html({ ...c, raging: false })).not.toContain('Roll Quaking Stomp')
  expect(html({ ...c, level: 9 })).not.toContain('Roll Impressive Landing')
})

it('shows conditional combat effects only on eligible Barbarian attacks', () => {
  const c: Character = { ...base, level: 20, className: 'Barbarian', raging: true,
    feats: [feat('Brutal Crush', 4), feat('Resounding Blow', 10), feat('Instinctive Strike', 8),
      feat('Furious Grab', 12), feat('Sunder Spell', 12), feat('Sunder Enchantment', 14)] }
  const mace = content('weapon', 'Test Mace', { weapon_type: 'Melee', damage: '1d6 bludgeoning' })
  const fist = ownedWeapons(c, []).find(weapon => weapon.name === 'Fist')!
  const notes = (character: Character, entries: ContentEntry[], weapon: OwnedWeapon) =>
    weaponAttack(character, entries, weapon).breakdown.notes.join(' ')
  const unarmed = notes(c, [], fist)
  expect(unarmed).toContain('Brutal Crush:')
  expect(unarmed).toContain('Instinctive Strike:')
  expect(unarmed).toContain('Furious Grab:')
  expect(unarmed).not.toContain('Resounding Blow:')
  const maceNotes = notes(c, [mace], { ...main, name: mace.name })
  expect(maceNotes).toContain('Resounding Blow:')
  expect(maceNotes).toContain('Sunder Enchantment can instead suppress')
  expect(notes({ ...c, raging: false }, [], fist)).not.toContain('Furious Grab:')
})

it('shows conditional finishing and fear effects on eligible strikes', () => {
  const c: Character = { ...base, level: 20, className: 'Barbarian', raging: true,
    feats: [feat('Furious Finish', 2), feat('Intimidating Strike', 2), feat('Meditate on This!', 14),
      feat('Whirlwind Strike', 14), feat('Cleave', 6), feat('Great Cleave', 10)] }
  const fist = ownedWeapons(c, []).find(weapon => weapon.name === 'Fist')!
  const notes = (character: Character, weapon: OwnedWeapon) => weaponAttack(character, [], weapon).breakdown.notes.join(' ')
  expect(notes(c, fist)).toContain('Furious Finish:')
  expect(notes(c, fist)).toContain('Intimidating Strike:')
  expect(notes(c, fist)).toContain('Meditate on This!:')
  expect(notes(c, fist)).toContain('Whirlwind Strike:')
  expect(notes(c, fist)).toContain('Great Cleave allows further Strikes')
  expect(notes({ ...c, raging: false }, fist)).not.toContain('Furious Finish:')
  expect(notes({ ...c, raging: false }, fist)).not.toContain('Meditate on This!:')
  expect(notes({ ...c, raging: false }, fist)).not.toContain('Cleave:')
  expect(notes({ ...c, raging: false }, fist)).toContain('Whirlwind Strike:')
  expect(notes({ ...c, level: 1 }, fist)).not.toContain('Intimidating Strike:')
})

it('preserves personal statistics and attacks in Animal Rage, including frog tongue reach', () => {
  const c: Character = { ...base, level: 8, className: 'Barbarian', subclass: 'Animal', raging: true,
    barbarianAnimal: 'Frog', feats: [feat('Animal Rage', 8)], weapons: [main],
    handwraps: { potency: 1, striking: 1, runes: [] }, activeSpells: ['Dinosaur Form'] }
  const form = { ...c, ...animalRageFormChange(c, true) }
  const entries = [sword]
  expect(activeBattleForm(form, entries)).toMatchObject({ name: 'Frog', source: 'Animal Rage', size: 'Medium' })
  expect(form.activeSpells).toEqual([])
  expect(armorClass(form, entries)).toBe(armorClass({ ...form, animalRageForm: false }, entries))
  expect(movementSpeeds(form, entries)).toEqual(movementSpeeds({ ...form, animalRageForm: false }, entries))
  expect(senses(form, entries)).toEqual(expect.arrayContaining([
    expect.objectContaining({ value: 'Low-light vision', source: 'Animal Rage' }),
    expect.objectContaining({ value: 'Scent (imprecise) 30 feet', source: 'Animal Rage' }),
  ]))
  const weapons = ownedWeapons(form, entries)
  expect(weapons.some(weapon => weapon.name === 'Longsword')).toBe(false)
  const tongue = weapons.find(weapon => weapon.id === 'bestial:Frog:Tongue')!
  const ownTongue = weaponAttack({ ...form, animalRageForm: false }, entries, tongue)
  expect(weaponAttack(form, entries, tongue)).toMatchObject({ reach: 15, attack: ownTongue.attack,
    damage: ownTongue.damage, item: ownTongue.item })
  const defense = renderToStaticMarkup(<SkillsSection c={form} entries={entries} save={() => {}} part="defense" />)
  expect(defense).toContain('retain constant gear abilities')
  expect(defense).not.toContain('<small>Temporary Hit Points</small>')
  expect(spellActiveChange(form, 'Untamed Form', true).animalRageForm).toBe(false)
  expect(dragonTransformationChange(form, 'Omen').animalRageForm).toBe(false)
  expect(featEffectChange(form, 'Verdant Metamorphosis', true).animalRageForm).toBe(false)
  expect(activeBattleForm({ ...form, raging: false }, entries)).toBeUndefined()
  expect(activeBattleForm({ ...form, feats: [] }, entries)).toBeUndefined()
  expect(activeBattleForm({ ...form, ...animalRageFormChange(form, false) }, entries)).toBeUndefined()
})

it.each([16, 18])('applies Dragon Transformation using own defenses and Rage at level %i', level => {
  const klass = content('class', 'Barbarian', { attack_proficiency: 'expert in unarmed attacks', attribute: 'Strength' })
  const normal: Character = { ...base, className: 'Barbarian', subclass: 'Dragon', level, raging: true,
    barbarianDragon: 'Diabolic', draconicRage: true, feats: [feat('Dragon Transformation', 16), feat('Reinforced Skeleton', 1)],
    abilities: { ...base.abilities, str: 20 }, weapons: [main], activeSpells: ['Dinosaur Form', 'Athletic Rush'],
    giantStature: 'Large', activeFeatEffects: ['Verdant Metamorphosis'] }
  const c = { ...normal, ...dragonTransformationChange(normal, 'Horned') }
  const entries = [klass, sword]
  expect(c.activeSpells).toEqual(['Athletic Rush'])
  expect(c.giantStature).toBeUndefined()
  expect(c.activeFeatEffects).toEqual([])
  expect(activeBattleForm(c, entries)).toMatchObject({ name: 'Horned', size: 'Large', temporaryHp: 10, athletics: 23 })
  expect(armorClass(c, entries)).toBe(armorClass({ ...c, dragonTransformation: undefined }, entries))
  expect(movementSpeeds(c, entries)).toEqual(expect.arrayContaining([
    { name: 'Swim', feet: 65, source: 'Dragon Transformation', status: 5 },
    { name: 'Fly', feet: level >= 18 ? 120 : 105, source: 'Dragon Transformation', status: level >= 18 ? 20 : 5 },
  ]))
  expect(senses(c, entries).map(item => item.value)).toEqual(expect.arrayContaining(['Darkvision', 'Scent (imprecise) 60 feet']))
  expect(resistances(c, entries)).toContainEqual({ damage: 'Poison', value: 10, source: 'Dragon Transformation' })
  const attacks = ownedWeapons(c, entries)
  expect(attacks.map(attack => attack.name)).toEqual(['Dragon Jaws', 'Dragon Claw', 'Dragon Tail'])
  const jaws = weaponAttack(c, entries, attacks[0])
  const fist = ownedWeapons({ ...c, dragonTransformation: undefined }, entries).find(weapon => weapon.name === 'Fist')!
  expect(jaws.attack).toBe(weaponAttack({ ...c, dragonTransformation: undefined }, entries, fist).attack)
  expect(jaws.damage).toBe(`2d12+${level >= 18 ? 12 : 6} piercing`)
  expect(jaws.additionalDamage).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'Draconic Rage', value: '16 fire' }),
    expect.objectContaining({ source: 'Dragon Transformation', value: '2d6 poison' }),
  ]))
  expect(weaponAttack(c, entries, attacks[2]).reach).toBe(10)
  const html = renderToStaticMarkup(<ClassFeatures c={c} entries={entries} save={() => {}} />)
  expect(html).toContain(level >= 18 ? '10d6+14 poison' : '10d6 poison')
  expect(html).toContain('30-foot cone; basic Fortitude save')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} part="defense" />)).toContain('Gain the dragon trait')
  expect(activeBattleForm({ ...c, raging: false }, entries)).toBeUndefined()
  expect(weaponAttack({ ...c, raging: false }, entries, attacks[0]).rageDamage).toBe(0)
  expect(activeBattleForm({ ...c, feats: [] }, entries)).toBeUndefined()
  expect(spellActiveChange(c, 'Untamed Form', true).dragonTransformation).toBeUndefined()
  expect(featEffectChange(c, 'Verdant Metamorphosis', true).dragonTransformation).toBeUndefined()
  expect(giantStatureChange(c, 'Large').dragonTransformation).toBeUndefined()
  expect(activeBattleForm({ ...c, ...dragonTransformationChange(c, undefined) }, entries)).toBeUndefined()
})

it('halves Draconic Rage for agile attacks and requires Raging Thrower for thrown attacks', () => {
  const agile = { ...sword, traits: ['Agile'] }
  const thrown = content('weapon', 'Test Javelin', { weapon_type: 'Ranged', damage: '1d6 piercing', range: 30 }, 0, ['Thrown'])
  const c: Character = { ...base, level: 7, className: 'Barbarian', subclass: 'Dragon', raging: true,
    barbarianDragon: 'Diabolic', draconicRage: true }
  const weapon = { ...main, id: thrown.id, name: thrown.name }
  const previous = getSettings().barbarianIgnoreAgile
  try {
    updateSettings({ barbarianIgnoreAgile: false })
    expect(weaponAttack(c, [agile], main).rageDamage).toBe(4)
    expect(weaponAttack(c, [thrown], weapon).rageDamage).toBe(0)
    expect(weaponAttack({ ...c, feats: [feat('Raging Thrower')] }, [thrown], weapon).rageDamage).toBe(8)
  } finally { updateSettings({ barbarianIgnoreAgile: previous }) }
})

it.each([[1, 4], [7, 6], [15, 12]])('applies Elemental Rage and Elemental Evolution at level %i', (level, rage) => {
  const c: Character = { ...base, level, className: 'Barbarian', subclass: 'Elemental', raging: true,
    barbarianElement: 'Air', elementalDamage: 'electricity', feats: [feat('Elemental Evolution', 2, 'Cold')] }
  const attack = weaponAttack(c, [sword], main)
  expect(attack.additionalDamage).toContainEqual({ source: 'Elemental Rage', value: `${rage} electricity`, note: 'Additional damage from Elemental Rage.' })
  expect(attack.damage).toBe(weaponAttack({ ...c, raging: false }, [sword], main).damage)
  expect(featChoiceOptions('Elemental Evolution', c, [], '')).toEqual(['Slashing', 'Cold'])
  if (level >= 2) {
    const evolved = weaponAttack({ ...c, elementalUseEvolution: true }, [sword], main)
    expect(evolved.additionalDamage).toContainEqual({ source: 'Elemental Rage', value: `${rage} cold`, note: 'Additional damage from Elemental Rage.' })
  }
  expect(weaponAttack({ ...c, elementalDamage: 'fire' }, [sword], main).rageDamage).toBe(2)
})

it('provides Elemental Explosion with selected damage and a once-per-Rage roll', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Elemental', level: 8, raging: true,
    barbarianElement: 'Water', elementalDamage: 'cold', feats: [feat('Elemental Explosion', 6)] }
  const html = (character: Character) => renderToStaticMarkup(<ClassFeatures c={character} entries={[]} save={() => {}} />)
  expect(html(c)).toContain('8d8 cold')
  expect(html(c)).toContain('15-foot emanation; basic Reflex save')
  expect(html({ ...c, elementalExplosionUsed: true })).toContain('disabled="" class="spell-action-button"')
  expect(html({ ...c, raging: false })).not.toContain('Roll Elemental Explosion')
  expect(resistances({ ...c, level: 9 }, []).some(resistance => resistance.damage.includes('Water') && resistance.value === 3)).toBe(true)
})

it('grants animal instinct piercing and slashing resistance only while raging at level 9', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Animal', level: 9, raging: true,
    abilities: { ...base.abilities, con: 16 } }
  const ragingResistance = (character: Character) => resistances(character, [])
    .filter(resistance => resistance.source === 'Raging Resistance')
  expect(ragingResistance(c)).toEqual([
    { damage: 'Piercing', value: 6, source: 'Raging Resistance' },
    { damage: 'Slashing', value: 6, source: 'Raging Resistance' },
  ])
  expect(ragingResistance({ ...c, level: 8 })).toEqual([])
  expect(ragingResistance({ ...c, raging: false })).toEqual([])
})

it.each([[1, 'd10', 'd6', 2], [7, 'd12', 'd8', 5], [15, 'd12', 'd8', 12]])(
  'grants and scales selected bestial attacks at level %i', (level, jawsDie, clawDie, rage) => {
    const previous = getSettings().barbarianIgnoreAgile
    updateSettings({ barbarianIgnoreAgile: false })
    try {
    const c: Character = { ...base, className: 'Barbarian', subclass: 'Animal', level, raging: true,
      barbarianAnimal: 'Bear', feats: [feat('Animalistic Brutality', 8)], animalisticBrutality: { attack: 'bestial:Bear:Jaws', trait: 'Parry' } }
    const weapons = ownedWeapons(c, [])
    const jaws = weapons.find(weapon => weapon.id === 'bestial:Bear:Jaws')!
    const claw = weapons.find(weapon => weapon.id === 'bestial:Bear:Claw')!
    expect(weaponAttack(c, [], jaws).damage).toContain(jawsDie)
    expect(weaponAttack(c, [], claw).damage).toContain(clawDie)
    expect(weaponAttack(c, [], jaws).rageDamage).toBe(rage)
    expect(weaponAttack(c, [], claw).rageDamage).toBe(Math.floor(rage / 2))
    expect(weaponAttack(c, [], jaws).traits.includes('Parry')).toBe(level >= 8)
    expect(weaponAttack(c, [], claw).traits).not.toContain('Parry')
    expect(ownedWeapons({ ...c, raging: false }, []).some(weapon => weapon.id.startsWith('bestial:'))).toBe(false)
    expect(ownedWeapons({ ...c, barbarianAnimal: 'Wolf' }, []).some(weapon => weapon.id === jaws.id)).toBe(false)
    } finally { updateSettings({ barbarianIgnoreAgile: previous }) }
  })

it('provides spider web and venomous bestial attacks', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Animal', level: 10, raging: true, barbarianAnimal: 'Spider' }
  const weapons = ownedWeapons(c, [])
  const fangs = weaponAttack(c, [], weapons.find(weapon => weapon.id === 'bestial:Spider:Fangs')!)
  const web = weaponAttack(c, [], weapons.find(weapon => weapon.id === 'bestial:Spider:Web')!)
  expect(fangs.additionalDamage).toContainEqual(expect.objectContaining({ source: 'Venomous', value: '1 persistent poison' }))
  expect(web.range).toBe(15)
  expect(web.damage).toBe('')
  expect(web.breakdown.notes.join(' ')).toContain('immobilizes')
})

it.each([[1, 3], [7, 7], [15, 13]])('applies Spirit Rage damage at level %i', (level, rage) => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Spirit', level, raging: true, spiritRage: true }
  const attack = weaponAttack(c, [sword], main)
  expect(attack.additionalDamage).toContainEqual({ source: 'Spirit Rage', value: `${rage} spirit`,
    note: 'The attack gains ghost touch while using Spirit Rage.' })
  expect(attack.damage).toBe(weaponAttack({ ...c, raging: false }, [sword], main).damage)
  expect(weaponAttack({ ...c, spiritRage: false }, [sword], main).rageDamage).toBe(2)
})

it('shows Spirit Rage ghost touch on attacks only while active', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Spirit', level: 8, raging: true,
    spiritRage: true, weapons: [main] }
  const html = (character: Character) => renderToStaticMarkup(<WeaponList c={character} entries={[sword]} save={() => {}} displayOnly />)
  expect(html(c)).toContain('Granted by Spirit Rage')
  expect(html({ ...c, spiritRage: false })).not.toContain('Granted by Spirit Rage')
  expect(html({ ...c, raging: false })).not.toContain('Granted by Spirit Rage')
})

it('gates fury, spirit and superstition raging resistance and superstition conditional bonuses', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Superstition', level: 9, raging: true,
    superstitionTraditions: 'Arcane and Primal' }
  const resistance = (character: Character) => resistances(character, []).filter(item => item.source === 'Raging Resistance')
  expect(resistance(c)).toEqual([{ damage: 'Damage from Arcane and Primal spells', value: 3, source: 'Raging Resistance' }])
  expect(resistance({ ...c, subclass: 'Fury' })[0].damage).toContain('Physical damage from weapons')
  expect(resistance({ ...c, subclass: 'Spirit' }).map(item => item.damage)).toEqual(['Void', 'Damage from undead attacks and abilities'])
  expect(resistance({ ...c, raging: false })).toEqual([])
  expect(resistance({ ...c, level: 8 })).toEqual([])
  expect(savingThrowBreakdown(c, [], 'Will').notes?.join(' ')).toContain('against magic')
  const attack = weaponAttack(c, [sword], main)
  expect(attack.rageDamage).toBe(7)
  expect(attack.breakdown.notes.join(' ')).toContain('Rage damage is 8')
})

it('applies Unstoppable Juggernaut all-damage resistance and improves instinct resistance', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Animal', level: 20, raging: true,
    abilities: { ...base.abilities, con: 18 }, feats: [feat('Unstoppable Juggernaut', 20)] }
  const values = (character: Character) => resistances(character, [])
  expect(values(c)).toContainEqual({ damage: 'All damage', value: 7, source: 'Unstoppable Juggernaut' })
  expect(values(c)).toContainEqual({ damage: 'Piercing', value: 12, source: 'Raging Resistance' })
  expect(values({ ...c, raging: false })).toContainEqual({ damage: 'All damage', value: 7, source: 'Unstoppable Juggernaut' })
  expect(values({ ...c, raging: false }).some(item => item.source === 'Raging Resistance')).toBe(false)
  expect(values({ ...c, level: 19 }).some(item => item.source === 'Unstoppable Juggernaut')).toBe(false)
})

it('applies activated Desperate Wrath and Come and Get Me to defenses and attacks', () => {
  const c: Character = { ...base, className: 'Barbarian', level: 20, raging: true,
    feats: [feat('Desperate Wrath', 16), feat('Come and Get Me', 10)],
    activeFeatEffects: ['Desperate Wrath', 'Come and Get Me'] }
  const inactive = { ...c, activeFeatEffects: [] }
  expect(armorClass(c, [sword])).toBe(armorClass(inactive, [sword]) - 3)
  for (const name of ['Fortitude', 'Reflex', 'Will'] as const)
    expect(savingThrowBreakdown(c, [], name).total).toBe(savingThrowBreakdown(inactive, [], name).total - 1)
  expect(weaponAttack(c, [sword], main).attack).toBe(weaponAttack(inactive, [sword], main).attack + 2)
  expect(armorClass({ ...c, raging: false }, [])).toBe(armorClass({ ...inactive, raging: false }, []))
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(markup).toContain('Damage rolls against you gain +2 circumstance')
})

it("shows Spirits' Interference only when activated during Rage", () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Spirit', level: 8, raging: true,
    feats: [feat("Spirits' Interference", 6)], activeFeatEffects: ["Spirits' Interference"] }
  const html = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={[]} save={() => {}} part="defense" />)
  expect(html(c)).toContain('Ranged attacks against you require a successful DC 5 flat check')
  expect(html({ ...c, activeFeatEffects: [] })).not.toContain('Ranged attacks against you require a successful DC 5 flat check')
  expect(html({ ...c, raging: false })).not.toContain('Ranged attacks against you require a successful DC 5 flat check')
})

it('shows level-scaled conditional Barbarian strike effects on eligible attacks', () => {
  const c: Character = { ...base, className: 'Barbarian', level: 16, raging: true,
    feats: [feat('Rip and Tear', 4), feat('Impaling Thrust', 14), feat('Sunder Spell', 12)] }
  const piercing = { ...sword, data: { ...sword.data, damage: '1d8 piercing' } }
  const notes = weaponAttack(c, [piercing], main).breakdown.notes.join(' ')
  expect(notes).toContain('rank 8')
  expect(notes).toMatch(/takes \d+ persistent bleed/)
  expect(notes).not.toContain('Rip and Tear')
  const unarmed = ownedWeapons(c, []).find(weapon => weapon.name === 'Fist')!
  const unarmedNotes = weaponAttack(c, [], unarmed).breakdown.notes.join(' ')
  expect(unarmedNotes).toContain('2d6 persistent bleed')
  expect(unarmedNotes).not.toContain('Impaling Thrust')
  expect(weaponAttack({ ...c, level: 3 }, [], unarmed).breakdown.notes.join(' ')).not.toContain('Rip and Tear')
})

it('offers Scouring Rage using the chosen instinct damage type once per Rage', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Spirit', level: 10, raging: true, spiritRage: true,
    feats: [feat('Scouring Rage', 6)] }
  const html = (character: Character) => renderToStaticMarkup(<ClassFeatures c={character} entries={[]} save={() => {}} />)
  expect(html(c)).toContain('10 spirit')
  expect(html(c)).toContain('basic Fortitude save')
  expect(html({ ...c, scouringRageUsed: true })).toContain('disabled="" class="spell-action-button"')
  expect(html({ ...c, spiritRage: false })).toContain('Scouring Rage damage type')
  expect(html({ ...c, spiritRage: false, scouringRageDamage: 'slashing' })).toContain('10 slashing')
})

it("offers Spirit's Wrath with Constitution damage only while raging", () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Spirit', level: 12, raging: true,
    abilities: { ...base.abilities, str: 18, con: 8 }, feats: [feat("Spirit's Wrath", 12)] }
  const html = (character: Character) => renderToStaticMarkup(<ClassFeatures c={character} entries={[]} save={() => {}} />)
  expect(html(c)).toContain('4d8-1 spirit')
  expect(html(c)).toContain('120 feet')
  expect(html({ ...c, raging: false })).not.toContain("Roll Spirit&#x27;s Wrath")
})

it('keeps Rage off ordinary ranged Strikes and halves Agile damage only without the house rule', () => {
  const agile = { ...sword, traits: ['Agile'] }
  const thrown = content('weapon', 'Javelin', { weapon_type: 'Ranged', damage: '1d6 P', hands: 1 }, 0, ['Thrown'])
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Giant', raging: true, weapons: [main] }
  const previous = getSettings().barbarianIgnoreAgile
  try {
    updateSettings({ barbarianIgnoreAgile: false })
    expect(weaponAttack(c, [agile], main).rageDamage).toBe(1)
    expect(weaponAttack(c, [agile], main).multipleAttackPenalties).toEqual([0, -4, -8])
    updateSettings({ barbarianIgnoreAgile: true })
    expect(weaponAttack(c, [agile], main).rageDamage).toBe(2)
    expect(weaponAttack(c, [agile], main).multipleAttackPenalties).toEqual([0, -5, -10])
    const javelin = { ...main, name: thrown.name }
    expect(weaponAttack(c, [thrown], javelin).rageDamage).toBe(0)
    expect(weaponAttack({ ...c, feats: [feat('Raging Thrower')] }, [thrown], javelin).rageDamage).toBe(2)
    expect(weaponAttack({ ...c, className: 'Fighter' }, [sword], main).rageDamage).toBe(0)
  } finally { updateSettings({ barbarianIgnoreAgile: previous }) }
})

it('makes Parrying optional and applies its AC bonus through the existing Parry switch', () => {
  const weapon = { ...main, runes: ['Parrying'] }
  const klass = content('class', 'Fighter', { attack_proficiency: 'trained in martial weapons' })
  const c: Character = { ...base, className: 'Fighter', weapons: [weapon] }
  const entries = [sword, klass, PARRYING_RUNE]
  expect(weaponAttack(c, entries, weapon).traits).toContain('Parry')
  expect(weaponAttack(c, entries, main).traits).not.toContain('Parry')
  expect(hasParryWeapon(c, entries)).toBe(true)
  expect(armorClass({ ...c, parrying: true }, entries)).toBe(armorClass(c, entries) + 1)
  const ranged = { ...sword, data: { ...sword.data, weapon_type: 'Ranged' } }
  expect(weaponAttack(c, [ranged, klass, PARRYING_RUNE], weapon).traits).not.toContain('Parry')
  expect(hasParryWeapon(c, [ranged, klass, PARRYING_RUNE])).toBe(false)
  expect(hasParryWeapon({ ...c, className: undefined }, entries)).toBe(false)
  expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly />))
    .not.toMatch(/Damage[^<]*Parrying/)
})

it('activates Parrying only on the melee form of a combination weapon', () => {
  const melee = { ...sword, name: 'Combination (Melee)', traits: ['Combination'],
    data: { ...sword.data, weapon_type: 'Melee', url: 'combination' } }
  const ranged = { ...melee, name: 'Combination (Ranged)', data: { ...melee.data, weapon_type: 'Ranged' } }
  const weapon: OwnedWeapon = { ...main, name: ranged.name, combinationForm: 'Melee', runes: ['Parrying'] }
  const klass = content('class', 'Fighter', { attack_proficiency: 'trained in martial weapons' })
  const c: Character = { ...base, className: 'Fighter', weapons: [weapon] }
  const entries = [melee, ranged, klass, PARRYING_RUNE]
  expect(hasParryWeapon(c, entries)).toBe(true)
  expect(hasParryWeapon({ ...c, weapons: [{ ...weapon, combinationForm: 'Ranged' }] }, entries)).toBe(false)
})

it.each([[1, 3], [7, 7], [15, 13]])('uses Fury Rage damage %i without granting oversized weapon benefits', (level, rage) => {
  const c: Character = { ...base, level, className: 'Barbarian', subclass: 'Fury', raging: true }
  expect(weaponAttack(c, [sword], main).rageDamage).toBe(rage)
  expect(effectiveWeapon(c, [sword], main)).not.toHaveProperty('size')
})

it.each([
  ['Claymore', '1d8 slashing', '2d8+1 slashing'],
  ['Broad-Bladed Spear', '1d6 P', '2d6+1 P'],
])('hides retired %s from new picks and homebrew without breaking owned weapon statistics', (name, damage, expected) => {
  const retired = { ...sword, id: `homebrew:${name.toLowerCase().replaceAll(' ', '-')}`, name, source: 'homebrew' as const,
    data: { ...sword.data, damage, retired: true } }
  expect(gearPickerEntries([sword, retired], 'weapon').map(entry => entry.name)).toEqual(['Longsword'])
  expect(groupHomebrew([retired])).toEqual([])
  expect(weaponAttack(base, [retired], { ...main, name }).damage).toBe(expected)
})

it.each([['Tradecraft Tattoo', 2], ['Tradecraft Tattoo (Greater)', 3]] as const)(
  'applies %s only to the Crafting item column without helper text', (name, bonus) => {
    const item = content('item', name, { usage: 'tattooed on the body', item_category: 'Tattoos' })
    const c: Character = { ...base, equipment: [{ name, qty: 1, group: 'Tattoos' }] }
    expect(tradecraftTattooBonus(c, [item])?.value).toBe(bonus)
    const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[item]} save={() => {}} />)
    const crafting = markup.split('class="skill-name">Crafting ')[1].split('role="row"')[0]
    expect(crafting).toContain(`<small>Item</small>+${bonus}`)
    expect(markup).not.toContain('Tradecraft Tattoo')
    expect(markup).not.toContain('Earn Income')
    expect(tradecraftTattooBonus({ ...c, equipment: [{ name, qty: 0 }] }, [item])).toBeUndefined()
    expect(tradecraftTattooBonus(c, [{ ...item, deleted: true }])).toBeUndefined()
  })

it('uses only the highest owned Tradecraft grade without stacking tattoo copies', () => {
  const lesser = content('item', 'Tradecraft Tattoo')
  const greater = content('item', 'Tradecraft Tattoo (Greater)')
  const c: Character = { ...base, equipment: [{ name: lesser.name, qty: 2 }, { name: greater.name, qty: 1 }] }
  expect(tradecraftTattooBonus(c, [lesser, greater])?.value).toBe(3)
})

it.each([[4, -3], [6, -2], [8, -1], [10, 0], [12, 0], [16, 1]] as const)(
  'uses full negative Strength and half positive Strength for propulsive damage (Strength %s)', (strength, bonus) => {
    const bow = content('weapon', 'Composite Bow', {
      damage: '1d8 piercing', hands: 2, weapon_type: 'Ranged', range: 100,
    }, 0, ['Propulsive'])
    const c = { ...base, abilities: { ...base.abilities, str: strength } }
    expect(weaponAttack(c, [bow], { ...main, name: bow.name }).damage)
      .toBe(`2d8${bonus > 0 ? '+' : ''}${bonus || ''} piercing`)
  })

it('alphabetizes weapon traits including rune-granted traits without mutating catalog data', () => {
  const weapon = { ...sword, traits: ['Versatile P', 'Agile', 'Finesse'] }
  const traits = weaponAttack(base, [weapon], { ...main, runes: ['Holy'] }).traits
  expect(traits).toEqual(['Agile', 'Finesse', 'Holy', 'Versatile P'])
  expect(weapon.traits).toEqual(['Versatile P', 'Agile', 'Finesse'])
})

it('uses Starfinder weapon grades rather than saved Pathfinder runes', () => {
  const laser = { ...content('weapon', 'Advanced Laser Pistol', {
    damage: '2d6 F', hands: 1, weapon_type: 'Ranged', range: 40, upgrade_slots: 2, weapon_tracking: 1,
  }, 4, ['Tech']), systems: ['sf2e' as const] }
  const weapon: OwnedWeapon = { id: 'laser', name: laser.name, potency: 3, striking: 2, runes: ['Flaming'] }
  const c: Character = { ...base, systems: ['sf2e'], weapons: [weapon] }
  expect(weaponAttack(c, [laser], weapon)).toMatchObject({ item: 1, damage: '2d6 F', traits: ['Tech'] })
  expect(effectiveWeapon(c, [laser], weapon).runes).toEqual([])
  expect(weapon.runes).toEqual(['Flaming'])
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[laser]} save={() => {}} />)
  expect(markup).not.toContain('Upgrade slots:')
  expect(markup).toContain('Saved runes are inactive')
  expect(markup).not.toContain('aria-label="Add property rune"')
})

it('automatically enhances Starfinder weapon grades without changing saved gear', () => {
  const pistol = { ...content('weapon', 'Rotating Pistol', {
    damage: '1d6 P', hands: 1, weapon_type: 'Ranged', weapon_category: 'Martial', upgrade_slots: 1,
    weapon_tracking: 0, url: 'rotating-pistol',
  }, 0, ['Analog']), systems: ['sf2e' as const] }
  const tactical = { ...pistol, id: 'tactical', name: 'Tactical Rotating Pistol', level: 2,
    data: { ...pistol.data, weapon_tracking: 1 } }
  const advanced = { ...pistol, id: 'advanced', name: 'Advanced Rotating Pistol', level: 4,
    data: { ...pistol.data, damage: '2d6 P', weapon_tracking: 1, upgrade_slots: 2 } }
  const weapon: OwnedWeapon = { id: 'pistol', name: pistol.name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, systems: ['sf2e'], level: 1, weapons: [weapon] }
  const entries = [pistol, tactical, advanced]
  expect(weaponAttack(c, entries, weapon)).toMatchObject({ damage: '1d6 P', item: 0 })
  expect(weaponAttack({ ...c, level: 2 }, entries, weapon)).toMatchObject({ damage: '1d6 P', item: 1 })
  expect(weaponAttack({ ...c, level: 4 }, entries, weapon)).toMatchObject({ damage: '2d6 P', item: 1, entry: { data: { upgrade_slots: 2 } } })
  expect(effectiveWeapon({ ...c, level: 1 }, entries, { ...weapon, name: advanced.name }).name).toBe(advanced.name)
  expect(effectiveWeapon({ ...c, level: 4, systems: ['pf2e'] }, entries, weapon).name).toBe(pistol.name)
  expect(weapon.name).toBe(pistol.name)
})

it('applies active mechanic weapon mods only to eligible weapons and damage types', () => {
  const laser = { ...content('weapon', 'Laser', {
    damage: '1d6 F', hands: 1, weapon_type: 'Ranged', range: 60, weapon_category: 'Simple', upgrade_slots: 1,
  }, 1, ['Tech']), systems: ['sf2e' as const] }
  const weapon: OwnedWeapon = { id: 'laser', name: laser.name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, className: 'Mechanic', systems: ['sf2e'], level: 5, weapons: [weapon],
    mechanicWeaponMods: { laser: { incapacitant: true, longRange: true, bunkerBuster: true, damageType: 'cold' } } }
  expect(weaponAttack(c, [laser], weapon)).toMatchObject({ damage: '1d6 cold', range: 90, traits: ['Nonlethal', 'Tech'] })
  expect(weaponAttack({ ...c, level: 4 }, [laser], weapon).damage).toBe('1d6 F')
  expect(weaponAttack({ ...c, className: 'Soldier' }, [laser], weapon)).toMatchObject({ damage: '1d6 F', range: 60, traits: ['Tech'] })
  expect(weaponAttack({ ...c, mechanicWeaponMods: { laser: { damageType: 'slashing' } } }, [laser], weapon).damage).toBe('1d6 F')
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[laser]} save={() => {}} displayOnly />)
  expect(markup).toContain('Long-range Propulsors')
  expect(markup).toContain('+5 damage to objects, structures, vehicles, and creatures with Hardness.')
  const improved: Character = { ...c, level: 6, feats: [{ name: 'Boosting The Basics', type: 'Class Feat', level: 6 }] }
  expect(weaponAttack(improved, [laser], weapon).range).toBe(120)
  const improvedMarkup = renderToStaticMarkup(<WeaponList c={improved} entries={[laser]} save={() => {}} displayOnly />)
  expect(improvedMarkup).toContain('+10 damage to objects')
  expect(improvedMarkup).toContain('critically hit or critically failing their save become frightened 1')
})

it('applies hardlight upgrades to fists and other unarmed attacks, including tactical parry', () => {
  const grid = { ...content('item', 'Protection Grid (Tactical)', { item_subcategory: 'Weapon Upgrades' }, 17),
    id: 'grid', systems: ['sf2e' as const], description: 'The weapon gains parry; the circumstance bonus increases to +2.' }
  const fire = { ...content('item', 'Flaming Module (Commercial)', { item_subcategory: 'Weapon Upgrades' }, 8),
    id: 'fire', systems: ['sf2e' as const], description: 'Deals 1d6 fire and 1d10 persistent fire on a critical hit.' }
  const claws = content('weapon', 'Claws', { weapon_category: 'Unarmed', damage: '1d6 slashing', hands: 0 }, 1, ['Unarmed'])
  const claw: OwnedWeapon = { id: 'claw', name: claws.name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, systems: ['sf2e'], level: 17, parrying: true, weapons: [claw],
    handwraps: { kind: 'hardlight', grade: 'Ultimate', potency: 0, striking: 0, runes: [], upgrades: ['grid', 'fire'] } }
  const entries = [grid, fire, claws]
  const fistCharacter = { ...c, weapons: [] }
  const fist = ownedWeapons(fistCharacter, entries).find(weapon => weapon.name === 'Fist')!
  for (const [character, weapon] of [[fistCharacter, fist], [c, claw]] as const) {
    expect(weaponAttack(character, entries, weapon).traits).toContain('Parry')
    expect(weaponAttack(character, entries, weapon).upgrades.map(upgrade => upgrade.name)).toEqual([grid.name, fire.name])
    const markup = renderToStaticMarkup(<WeaponList c={character} entries={entries} save={() => {}} displayOnly />)
    expect(markup).toContain('1d6 fire')
    expect(markup).toContain('Flaming Module (Commercial)')
    expect(markup).toContain('1d10 persistent fire')
  }
  expect(hasParryWeapon(c, entries)).toBe(true)
  expect(parryValue(c, entries)).toBe(2)
  expect(armorClass(c, entries) - armorClass({ ...c, parrying: false }, entries)).toBe(2)
  const normalWraps = { ...fistCharacter, handwraps: { ...c.handwraps!, kind: undefined } }
  expect(weaponAttack(normalWraps, entries, fist).upgrades).toEqual([])
  expect(hasParryWeapon(normalWraps, entries)).toBe(false)
})

it('applies grapple and shove modules only to eligible upgraded attacks', () => {
  const blade = { ...content('weapon', 'Tech Blade', { weapon_category: 'Martial', weapon_type: 'Melee',
    damage: '1d6 slashing', upgrade_slots: 2 }, 1, ['Tech', 'Grapple']), systems: ['sf2e' as const] }
  const w: OwnedWeapon = { id: 'blade', name: blade.name, potency: 0, striking: 0, runes: [],
    upgrades: [GRAPPLING_MODULE.id, SHOVING_MODULE.id] }
  const entries = [blade, GRAPPLING_MODULE, SHOVING_MODULE]
  const c: Character = { ...base, systems: ['sf2e'], weapons: [w] }
  expect(weaponAttack(c, entries, w).traits.filter(t => t === 'Grapple')).toEqual(['Grapple'])
  expect(weaponAttack(c, entries, w).traits).toContain('Shove')
  expect(weaponAttack(c, entries, { ...w, upgrades: [] }).traits).not.toContain('Shove')
  const ranged = { ...blade, traits: ['Tech'], data: { ...blade.data, weapon_type: 'Ranged', range: 30 } }
  expect(weaponAttack(c, [ranged, ...entries.slice(1)], w).traits).not.toContain('Grapple')
  expect(weaponAttack(c, [ranged, ...entries.slice(1)], w).traits).not.toContain('Shove')
  const withWraps: Character = { ...c, weapons: [], handwraps: { kind: 'hardlight', grade: 'Elite',
    potency: 0, striking: 0, runes: [], upgrades: [GRAPPLING_MODULE.id, SHOVING_MODULE.id] } }
  const fist = ownedWeapons(withWraps, entries).find(attack => attack.name === 'Fist')!
  expect(weaponAttack(withWraps, entries, fist).traits).toEqual(expect.arrayContaining(['Grapple', 'Shove']))
  expect(weaponAttack({ ...withWraps, handwraps: undefined }, entries, fist).traits).not.toContain('Grapple')
})

it('uses only an equipped upgraded weapon for Protection Grid parry', () => {
  const grid = { ...content('item', 'Protection Grid (Commercial)', { item_subcategory: 'Weapon Upgrades' }, 8),
    id: 'grid', systems: ['sf2e' as const] }
  const blade = { ...content('weapon', 'Tech Blade', { weapon_category: 'Martial', hands: 1, damage: '1d6 slashing' }, 1, ['Tech']),
    systems: ['sf2e' as const] }
  const weapon: OwnedWeapon = { id: 'blade', name: blade.name, potency: 0, striking: 0, runes: [], upgrades: ['grid'] }
  const c: Character = { ...base, systems: ['sf2e'], weapons: [weapon] }
  expect(weaponAttack(c, [blade, grid], weapon).traits).toContain('Parry')
  expect(parryValue(c, [blade, grid])).toBe(1)
  expect(hasParryWeapon({ ...c, weapons: [{ ...weapon, stowed: true }] }, [blade, grid])).toBe(false)
})

it.each(['Battleglove', 'Gauntlet', 'Spiked Gauntlet'])('inherits unarmed traits and tactical grid parry for %s', name => {
  const grid = { ...content('item', 'Protection Grid (Tactical)', { item_subcategory: 'Weapon Upgrades' }, 17),
    id: 'grid', systems: ['sf2e' as const] }
  const glove = { ...content('weapon', name, { weapon_category: 'Simple', weapon_type: 'Melee', hands: 1,
    damage: '1d4 B', upgrade_slots: 1 }, 0, ['Agile', 'Free-Hand', 'Analog']), systems: ['sf2e' as const] }
  const weapon: OwnedWeapon = { id: 'glove', name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, systems: ['sf2e'], level: 17, parrying: true, weapons: [weapon],
    handwraps: { kind: 'hardlight', grade: 'Ultimate', potency: 0, striking: 0, runes: [], upgrades: [grid.id] } }
  const entries = [glove, grid]
  expect(weaponAttack(c, entries, weapon).traits).toContain('Parry')
  expect(hasParryWeapon(c, entries)).toBe(true)
  expect(parryValue(c, entries)).toBe(2)
  expect(armorClass(c, entries) - armorClass({ ...c, parrying: false }, entries)).toBe(2)
  expect(weaponAttack({ ...c, handwraps: undefined }, entries, weapon).traits).not.toContain('Parry')
  expect(hasParryWeapon({ ...c, handwraps: undefined }, entries)).toBe(false)
})

it('shows loudener damage and merciful restrictions on hardlight attacks', () => {
  const upgrades = ['Loudener (Tactical)', 'Merciful', 'Flaming Module (Commercial)'].map(name => ({
    ...content('item', name, { item_subcategory: 'Weapon Upgrades' }, 8), systems: ['sf2e' as const],
    description: name === 'Merciful' ? 'Persistent damage is negated and attacks cannot be lethal.' : 'Deals 1d6 sonic damage.',
  }))
  const c: Character = { ...base, systems: ['sf2e'], handwraps: {
    kind: 'hardlight', grade: 'Elite', potency: 0, striking: 0, runes: [], upgrades: upgrades.map(upgrade => upgrade.id),
  } }
  const fist = ownedWeapons(c, upgrades).find(weapon => weapon.name === 'Fist')!
  expect(weaponAttack(c, upgrades, fist).traits.filter(trait => trait === 'Nonlethal')).toEqual(['Nonlethal'])
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={upgrades} save={() => {}} displayOnly />)
  expect(markup).toContain('1d6 sonic')
  expect(markup).toContain('Persistent damage is negated')
})

it('shows upgrade names without inline helper text on unarmed attacks', () => {
  const upgrades = ['Fear Projector (Tactical)', 'Entropic Destabilizer (Tactical)', 'Quicklock'].map(name => ({
    ...content('item', name, { item_subcategory: 'Weapon Upgrades' }, 8), systems: ['sf2e' as const],
  }))
  const c: Character = { ...base, systems: ['sf2e'], handwraps: {
    kind: 'hardlight', grade: 'Paragon', potency: 0, striking: 0, runes: [], upgrades: upgrades.map(upgrade => upgrade.id),
  } }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={upgrades} save={() => {}} displayOnly />)
  expect(markup).toContain('1d4 void')
  expect(markup).toContain('Fear Projector (Tactical)')
  expect(markup).toContain('Quicklock')
  expect(markup).not.toContain('Critical hit: frightened 2.')
  expect(markup).not.toContain('the extra action can only Strike with this weapon')
})

it('shows sight bonuses only as conditional Perception notes while wielded', () => {
  const sight = { ...content('item', 'Truesight Sight (Tactical)', { item_subcategory: 'Weapon Upgrades' }, 13),
    systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], handwraps: {
    kind: 'hardlight', grade: 'Superior', potency: 0, striking: 0, runes: [], upgrades: [sight.id],
  } }
  const without = { ...c, handwraps: undefined }
  expect(defenseSummary(c, [sight]).perception).toBe(defenseSummary(without, [sight]).perception)
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[sight]} save={() => {}} part="senses" />)
  expect(markup).toContain('to visual Seek checks through the sight (+2 item bonus')
  expect(renderToStaticMarkup(<SkillsSection c={without} entries={[sight]} save={() => {}} part="senses" />))
    .not.toContain('Truesight Sight (Tactical) note')
})

it('applies Starfinder armor penalties and Thresher strength relief to skills and speeds', () => {
  const armor = { ...content('armor', 'Heavy Armor', { armor_category: 'Heavy', strength: 3,
    check_penalty: -2, speed_penalty: '-10 ft.' }, 0, ['Tech']), systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], level: 1, feats: [feat('Natural Swimmer')],
    armors: [{ id: 'armor', name: armor.name, worn: true, potency: 0, resilient: 0, runes: [] }] }
  expect(speed(c, [armor])).toBe(15)
  expect(movementSpeeds(c, [armor]).find(move => move.name === 'Swim')?.feet).toBe(5)
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[armor]} save={() => {}} />))
    .toContain('-2 to Strength and Dexterity skill checks and DCs, except actions with the attack trait.')
  const frame = { ...c, feats: [...c.feats, feat('Thresher Ko-1 Frame')] }
  expect(speed(frame, [armor])).toBe(20)
  expect(movementSpeeds(frame, [armor]).find(move => move.name === 'Swim')?.feet).toBe(10)
  expect(renderToStaticMarkup(<SkillsSection c={frame} entries={[armor]} save={() => {}} />))
    .not.toContain('Armor check penalty')
})

it('shows Uncanny Dash as conditional speed totals without persisting an active toggle', () => {
  const c: Character = { ...base, level: 11, className: 'Ranger', systems: ['sf2e'],
    feats: [feat('Gg-os Frame'), feat('Uncanny Dash', 9), feat('Natural Swimmer'), { ...feat('Favored Terrain'), choice: 'Plains' }],
    activeFeatEffects: ['Uncanny Dash', 'Favored Terrain'] }
  expect(speed(c, [])).toBe(40)
  expect(movementSpeeds(c, []).find(move => move.name === 'Swim')?.feet).toBe(15)
  expect(speed({ ...c, activeFeatEffects: ['Favored Terrain'] }, [])).toBe(40)
  expect(movementSpeeds({ ...c, activeFeatEffects: ['Favored Terrain'] }, []).find(move => move.name === 'Swim')?.feet).toBe(15)
  expect(speed(c, [], { includeUncannyDash: true })).toBe(40)
  expect(movementSpeeds(c, [], { includeUncannyDash: true }).find(move => move.name === 'Swim')?.feet).toBe(25)
  const aquatic = { ...c, feats: c.feats.map(f => f.name === 'Favored Terrain' ? { ...f, choice: 'Aquatic' } : f) }
  expect(movementSpeeds(aquatic, [], { includeUncannyDash: true }).find(move => move.name === 'Swim')?.feet).toBe(25)
  expect(movementSpeeds({ ...aquatic, activeFeatEffects: ['Favored Terrain'] }, []).find(move => move.name === 'Swim')?.feet).toBe(25)
})

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
  expect(movementSpeeds(c, [])).toContainEqual({ name: 'Fly', feet: 20, source: 'Soaring Armor' })
  expect(movementSpeeds({ ...c, abilities: { ...c.abilities, str: 16 } }, []))
    .toContainEqual({ name: 'Fly', feet: 25, source: 'Soaring Armor' })
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
  const deadly = { ...c, level: 12, feats: [...c.feats, feat('Deadly Poison Weapon', 12)] }
  const deadlyHtml = renderToStaticMarkup(<SimplePoisons c={deadly} entries={[]} save={() => {}} />)
  expect(deadlyHtml).toContain('9/12 remaining; 4d4')
  expect(deadlyHtml).toContain('up to your class DC')
  expect(renderToStaticMarkup(<SimplePoisons c={{ ...deadly, level: 11 }} entries={[]} save={() => {}} />)).toContain('8/11 remaining; 2d4')
  expect(renderToStaticMarkup(<SimplePoisons c={{ ...c, level: 7 }} entries={[]} save={() => {}} />)).toContain('4/7 remaining; 1d4')
  expect(renderToStaticMarkup(<SimplePoisons c={{ ...c, feats: [] }} entries={[]} save={() => {}} />)).toBe('')
})

it('lists only known and craftable gadgets for daily preparations', () => {
  const c: Character = { ...base, level: 4, feats: [feat('Gadget Specialist', 4)], gadgetFormulaChoices: ['Little Gadget'] }
  const entries = [content('item', 'Little Gadget', {}, 3, ['Gadget']), content('item', 'Future Gadget', {}, 5, ['Gadget']),
    content('item', 'Unknown Gadget', {}, 1, ['Gadget'])]
  const html = renderToStaticMarkup(<Gadgets c={c} entries={entries} save={() => {}} />)
  expect(html.match(/aria-label="Prepared gadget \d"/g)).toHaveLength(2)
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
  expect(canBeWeaponInnovation(inventor, [{ ...weapon, traits: ['Rare'] }], item)).toBe(true)
  const restricted = { ...weapon, traits: ['Rare'], data: { ...weapon.data, access: 'Kellid ethnicity' } }
  expect(canBeWeaponInnovation(inventor, [restricted], item)).toBe(false)
  expect(canBeWeaponInnovation({ ...inventor, ethnicity: 'Kellid' }, [restricted], item)).toBe(true)
  expect(canBeWeaponInnovation({ ...inventor, gearAccessOverrides: [weapon.id] }, [restricted], item)).toBe(true)
  const martial = content('class', 'Inventor', { attack_proficiency: 'Trained in martial weapons' })
  expect(weaponAttack(inventor, [weapon, martial], item).rank).toBe(1)
  expect(item.material).toBe('Cold Iron (Low-Grade)')
  expect(renderToStaticMarkup(<WeaponList c={{ ...inventor, weapons: [item] }} entries={[weapon]} save={() => {}} />))
    .toContain('aria-label="Weapon Innovation: Prototype"')
})

it('shows only selected combination form with shared runes, modifications, and innovation state', () => {
  const melee = content('weapon', 'Hammer Gun (Melee)', { url: 'same', weapon_category: 'Martial', damage: '1d10 slashing' }, 0, ['Combination', 'Uncommon'])
  const ranged = content('weapon', 'Hammer Gun (Ranged)', { url: 'same', weapon_category: 'Martial', weapon_type: 'Ranged', range: 60, damage: '1d6 piercing' }, 0, ['Combination', 'Uncommon'])
  const impossibleRune = content('item', 'Impossible', { item_subcategory: 'Weapon Property Runes', usage: 'etched onto a ranged weapon' })
  const vorpalRune = content('item', 'Vorpal', { item_subcategory: 'Weapon Property Runes', usage: 'etched onto a slashing melee weapon' })
  const entries = [melee, ranged, impossibleRune, vorpalRune]
  const character: Character = { ...base, className: 'Inventor', subclass: 'Weapon', level: 15,
    feats: [{ ...feat('Unconventional Weaponry'), choice: 'Hammer Gun', culturalWeapon: true }] }
  const weapon: OwnedWeapon = { id: 'combo', name: ranged.name, potency: 2, striking: 1, runes: ['Vorpal', 'Impossible'], inventorInnovation: true }
  expect(combinationForms(entries, weapon.name)).toHaveLength(2)
  expect(featChoiceOptions('Unconventional Weaponry', character, entries, '')).toEqual(['Hammer Gun'])
  expect(weaponAttack(character, entries, weapon)).toMatchObject({ damage: '3d6 piercing', range: 120, item: 2 })
  expect(weaponAttack(character, entries, { ...weapon, combinationForm: 'Melee' })).toMatchObject({ damage: '3d10+1 slashing', range: 0, item: 2 })
  expect(effectiveWeapon(character, entries, { ...weapon, combinationForm: 'Melee' }).runes).toEqual(['Vorpal'])
  expect(eligibleWeaponRunes(entries, { ...weapon, runes: [] }).map(rune => rune.name)).toContain('Vorpal')
  const html = renderToStaticMarkup(<WeaponList c={{ ...character, weapons: [weapon] }} entries={entries} save={() => {}} />)
  expect(html).toContain('Ranged: Attack')
  expect(html).not.toContain('Melee: Attack')
  expect(html).toContain('aria-label="Combination form: Hammer Gun"')
  expect(html).toContain('Extensible Weapon')
  expect(html).toContain('Omnirange Stabilizers')
  const summary = html.match(/<summary>(.*?)<\/summary>/)?.[1] ?? ''
  expect(summary).not.toContain('Impossible')
  expect(combinationForms([melee, { ...ranged, data: { ...ranged.data, url: 'different' } }], melee.name)).toEqual([])
})

it('adds Hammer Multipistol as a custom copy of both Mace Multipistol forms', () => {
  const melee = content('weapon', 'Mace Multipistol (Melee)', { url: 'mace-multipistol', weapon_category: 'Martial', damage: '1d6 bludgeoning' }, 0, ['Combination'])
  const ranged = content('weapon', 'Mace Multipistol (Ranged)', { url: 'mace-multipistol', weapon_category: 'Martial',
    weapon_type: 'Ranged', range: 20, damage: '1d6 bludgeoning' }, 0, ['Combination'])
  const entries = [melee, ranged]
  const copies = gearPickerEntries(entries, 'weapon').filter(entry => entry.name.startsWith('Hammer Multipistol'))
  expect(copies).toHaveLength(2)
  expect(copies.map(entry => combinationName(entries, entry.name))).toEqual(['Hammer Multipistol', 'Hammer Multipistol'])
  expect(copies[0]).toMatchObject({ source: 'homebrew' })
  expect(copies.every(copy => copy.description.includes('reinforced hammer head') && !/copy of/i.test(copy.description))).toBe(true)
  expect(weaponEntry(entries, copies[0].name)?.data).toEqual(melee.data)
  expect(combinationForms(entries, copies[0].name)).toHaveLength(2)
})

it.each([false, true])('shows Alloyed Attacks as a locked material without renaming unarmed attacks (offense: %s)', displayOnly => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Orc', level: 12,
    feats: [feat('Iron Fists'), feat('Alloyed Attacks', 5, 'Silver')] }
  const html = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} displayOnly={displayOnly} />)
  expect(html).toContain('aria-haspopup="dialog">Fists</button>')
  expect(html).not.toContain('Silver Fists')
  expect(html.includes('>Material</span>')).toBe(!displayOnly)
  expect(html.includes('>Silver</button>')).toBe(!displayOnly)
  expect(html).not.toContain('melee unarmed attacks have')
  expect(html).not.toContain('aria-label="Remove Silver material"')
  expect(html).not.toContain('aria-label="Weapon material"')
  expect(featChoiceOptions('Alloyed Attacks', c, [], '')).not.toContain('Adamantine')
  expect(featChoiceOptions('Alloyed Attacks', { ...c, level: 13 }, [], '')).toContain('Adamantine')
  const invalid = renderToStaticMarkup(<WeaponList c={{ ...c, feats: [feat('Iron Fists'), feat('Alloyed Attacks', 5, 'Adamantine')] }}
    entries={[]} save={() => {}} displayOnly={displayOnly} />)
  expect(invalid).not.toContain('Adamantine Fists')
  expect(invalid).not.toContain('>Adamantine</button>')
})

it.each(['Cold Iron', 'Silver', 'Adamantine'])('keeps adopted Orc attack labels unchanged with %s properties', material => {
  const c: Character = { ...base, ancestry: 'Human', level: 13, feats: [
    feat('Adopted Ancestry', 1, 'Orc'), feat('Tusks'), feat('Alloyed Attacks', 5, material),
  ] }
  const tusks = ownedWeapons(c, []).find(weapon => weapon.name === 'Tusks')!
  const before = JSON.stringify(c)
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('aria-haspopup="dialog">Teeth</button>')
  expect(markup).not.toContain(`aria-haspopup="dialog">${material} Teeth</button>`)
  expect(markup).toContain(`>${material}</button>`)
  expect(markup).not.toContain('melee unarmed attacks have')
  expect(tusks.name).toBe('Tusks')
  expect(weaponAttack(c, [], tusks).damage).toBe(weaponAttack({ ...c, ancestry: 'Orc' }, [], tusks).damage)
  expect(JSON.stringify(c)).toBe(before)
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, level: 12 }} entries={[]} save={() => {}} />))
    .toContain('aria-haspopup="dialog">Teeth</button>')
})

it('keeps Alloyed properties and normal tusks without the retired Cold Iron material', () => {
  const c = { ...base, ancestry: 'Human', feats: [
    feat('Adopted Ancestry', 1, 'Orc'), feat('Tusks'), feat('Cold Iron Tusks', 5), feat('Alloyed Attacks', 5, 'Silver'),
  ] }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('aria-haspopup="dialog">Teeth</button>')
  expect(markup).not.toContain('aria-haspopup="dialog">Cold Iron Teeth</button>')
  expect(markup).toContain('>Silver</button>')
  expect(markup).not.toContain('melee unarmed attacks have')
  expect(markup).not.toContain('Granted by Cold Iron Teeth')
})

it('provides both playing-card usages with one shared deck and automatic fundamentals', () => {
  const dagger = content('weapon', 'Dagger', { damage: '1d4 piercing', weapon_category: 'Simple' }, 0)
  const dart = content('weapon', 'Dart', { damage: '1d4 piercing', weapon_category: 'Simple', weapon_type: 'Ranged', range: 20 }, 0)
  const c: Character = { ...base, level: 10, feats: [feat("Fane's Fourberie", 2)], activeStance: "Fane's Fourberie",
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

it('imports thrown range and applies Strong Arm to playing card daggers', async () => {
  const fetchFn: typeof fetch = async (_url, init) => new Response(JSON.stringify({ hits: { hits:
    String(init?.body).includes('"category":"weapon"') ? [{ _id: 'weapon-358', _source: {
      name: 'Dagger', category: 'weapon', level: 0, trait: ['Agile', 'Finesse', 'Thrown', 'Versatile'],
      weapon_type: 'Melee', damage: '1d4 P',
      markdown: '<traits>\n<trait label="Thrown 10 ft." url="/Traits.aspx?ID=195" />\n</traits>',
    } }] : [] } }))
  const hit = (await fetchAonHits('pf2e', fetchFn))[0]
  expect(hit._source?.markdown).toContain('Thrown 10 ft.')
  const dagger = mapAonHit(hit, 'pf2e')!
  expect(dagger.data.thrown_range).toBe(10)
  const c: Character = { ...base, feats: [feat("Fane's Fourberie", 2), feat('Strong Arm', 2)], activeStance: "Fane's Fourberie" }
  const card = ownedWeapons(c, [dagger]).find(weapon => weapon.name === 'Dagger (Playing Card)')!
  expect(weaponAttack(c, [dagger], card)).toMatchObject({ thrownRange: 20, range: 0, ability: 'dex' })
  expect(weaponAttack({ ...c, feats: [c.feats[0]] }, [dagger], card).thrownRange).toBe(10)
  const html = renderToStaticMarkup(<WeaponList c={c} entries={[dagger]} save={() => {}} />)
  expect(html).toContain('<small>Thrown range</small><b>20 feet</b>')
  expect(html).not.toContain('+10 feet (Strong Arm)')
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[dagger]} save={() => {}} displayOnly />))
    .toContain('Thrown range 20 feet')
  const parameterized = { ...dagger, traits: ['Thrown 30 feet'], data: { ...dagger.data, thrown_range: 0 } }
  expect(weaponAttack(c, [parameterized], card).thrownRange).toBe(40)
})

it('adds granted Augmented Body capacity to the normal limit without rewriting installed augmentations', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 9, heritage: 'Synthflesh Verthani',
    feats: [feat('Transgnomanist', 5), feat('Easily Augmented'), feat('Augmented Shell', 9),
      feat('Reconfigurable Frame', 5), feat('Reconfigurable Frame', 5), feat('Augmented Perfection', 17)],
    augmentations: [{ id: 'a', entryId: 'plating', name: 'Dermal Plating', slot: 'body:0' }] }
  const implant = { ...content('item', 'Dermal Plating', { item_category: 'Augmentations' }), id: 'plating', systems: ['sf2e'] as const }
  const saved = JSON.stringify(c)
  expect(augmentationLimit(c)).toBe(11)
  const markup = renderToStaticMarkup(<Augmentations c={c} entries={[{ ...implant, systems: ['sf2e'] }]} save={() => {}} />)
  expect(markup).toContain('aria-label="Augmentation capacity">1/11</small>')
  expect(markup).not.toContain('Augmented Body')
  expect(markup).not.toContain('source unavailable')
  expect(markup).toContain('Dermal Plating')
  expect(c.augmentations?.[0].slot).toBe('body:0')
  expect(JSON.stringify(c)).toBe(saved)
  expect(renderToStaticMarkup(<Augmentations c={{ ...c, systems: ['pf2e'] }} entries={[]} save={() => {}} />)).toBe('')
})

it('adds one normal implant per active Augmented Body acquisition', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 4, feats: [
    { ...feat('Augmented Body'), takenLevel: 5 }, { ...feat('Augmented Body'), slot: 'general:9:0' },
  ] }
  expect(augmentationLimit(c)).toBe(4)
  expect(augmentationLimit({ ...c, level: 5 })).toBe(5)
  expect(augmentationLimit({ ...c, level: 9 })).toBe(6)
})

it('keeps Augmented Dedication implant increases alongside its granted Augmented Body capacity', () => {
  const c: Character = { ...base, systems: ['sf2e'], feats: [feat('Augmented Dedication', 2)] }
  expect(augmentationLimit(c)).toBe(7)
})

it('increases Cyborg implant limit independently of the Test-Subject house rule', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 9, heritage: 'Cyborg',
    feats: [feat('Reconfigurable Frame', 5)] }
  const previous = getSettings().cyborgTestSubject
  try {
    updateSettings({ cyborgTestSubject: false })
    expect(augmentationLimit(c)).toBe(9)
    const installed = Array.from({ length: 8 }, (_, index) => ({ id: String(index), entryId: String(index), name: `Implant ${index}`, slot: 'standard' }))
    const implant: ContentEntry = { ...content('item', 'Implant', { item_category: 'Augmentations' }), systems: ['sf2e'] }
    expect(canInstallAugmentation({ ...c, augmentations: installed }, implant, 'standard')).toBe(true)
    expect(canInstallAugmentation({ ...c, augmentations: [...installed, { ...installed[0], id: '9' }] }, implant, 'standard')).toBe(false)
    expect(augmentationLimit({ ...c, heritage: undefined })).toBe(5)
    expect(augmentationLimit({ ...c, systems: ['pf2e'] })).toBe(5)
  } finally { updateSettings({ cyborgTestSubject: previous }) }
})

it('adds Adapted Augmentations to normal capacity and counts legacy adapted implants without special slots', () => {
  const implant: ContentEntry = { ...content('item', 'Dermal Plating', { item_category: 'Augmentations', rarity: 'common' }),
    systems: ['sf2e'] }
  const installed = Array.from({ length: 4 }, (_, index) => ({ id: String(index), entryId: String(index), name: `Implant ${index}`, slot: 'standard' }))
  const c: Character = { ...base, systems: ['sf2e'], level: 5, feats: [feat('Transgnomanist', 5), feat('Adapted Augmentations')],
    augmentations: installed }
  expect(augmentationLimit(c)).toBe(6)
  expect(canInstallAugmentation(c, implant, 'standard')).toBe(true)
  expect(canInstallAugmentation(c, implant, 'body:0')).toBe(false)
  expect(canInstallAugmentation(c, { ...implant, level: 6 }, 'body:0')).toBe(false)
  expect(canInstallAugmentation(c, { ...implant, level: 2 }, 'adapted')).toBe(false)
  expect(canInstallAugmentation(c, { ...implant, data: { ...implant.data, rarity: 'rare' } }, 'adapted')).toBe(false)
  expect(canInstallAugmentation(c, implant, 'adapted')).toBe(false)
  const full = { ...c, augmentations: [...installed,
    { id: 'legacy-body', entryId: implant.id, name: implant.name, slot: 'body:0' },
    { id: 'legacy-adapted', entryId: implant.id, name: implant.name, slot: 'adapted' }] }
  expect(canInstallAugmentation(full, implant, 'standard')).toBe(false)
  expect(canInstallAugmentation(full, { ...implant, traits: ['Apex'] }, 'standard')).toBe(true)
  expect(canInstallAugmentation(full, { ...implant, description: "This augmentation doesn't count against your implant limit." }, 'standard')).toBe(true)
  const markup = renderToStaticMarkup(<Augmentations c={full} entries={[implant]} save={() => {}} />)
  expect(markup).toContain('aria-label="Augmentation capacity">6/6</small>')
  expect(markup).not.toContain('Augmentation implant slot')
  expect(markup).not.toContain('(Adapted Augmentations)')
  expect(markup).not.toContain('Augmented Body')
  const reduced = { ...full, feats: [] }
  expect(renderToStaticMarkup(<Augmentations c={reduced} entries={[implant]} save={() => {}} />))
    .toContain('Installed augmentations exceed your current implant limit.')
  expect(reduced.augmentations).toEqual(full.augmentations)
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
    expect(movementSpeeds(wings, [])).toEqual([{ name: 'Land', feet: 25 }])
    const stormwind: Character = { ...wings, spells: [{ name: 'Stormwind Flight', rank: 4, cantrip: false }],
      activeSpells: ['Animal Feature', 'Stormwind Flight'] }
    expect(movementSpeeds(stormwind, [])).toContainEqual({ name: 'Fly', feet: 25, source: 'Stormwind Flight' })
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

it.each(['Buckler', 'Gauntlet Buckler'])('uses %s AC bonus when raised', name => {
  const shieldEntry = content('shield', name, { ac: 1 })
  const shield = { id: 's', name, hardness: 3, hp: 6, damage: 0, raised: true }
  const c: Character = { ...base, shield }
  expect(armorClass(c, [shieldEntry])).toBe(armorClass({ ...c, shield: undefined }, [shieldEntry]) + 1)
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[shieldEntry]} save={() => {}} />)).toContain('Raise Buckler (+1 AC)')
  expect(armorClass(c, [])).toBe(armorClass({ ...c, shield: undefined }, []) + 1)
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)).toContain('Raise Buckler (+1 AC)')
  const elegant = { ...c, feats: [feat('Elegant Buckler', 1)] }
  const unraised = { ...elegant, shield: { ...shield, raised: false } }
  expect(armorClass(elegant, [shieldEntry])).toBe(armorClass(unraised, [shieldEntry]) + 2)
  expect(renderToStaticMarkup(<ArmorList c={elegant} entries={[shieldEntry]} save={() => {}} />)).toContain('Raise Buckler (+2 AC)')
  expect(armorClass({ ...elegant, feats: [{ ...elegant.feats[0], takenLevel: 11 }] }, [shieldEntry])).toBe(armorClass(c, [shieldEntry]))
  expect(armorClass({ ...elegant, shield: { ...shield, name: 'Steel Shield' } }, [])).toBe(armorClass(unraised, []) + 2)
})

it('hides shield base durability while keeping calculated durability visible', () => {
  const c: Character = { ...base, shield: { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false } }
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('Base Hardness')
  expect(markup).not.toContain('Base Hit Points')
  expect(markup).toContain('Hardness 5; Hit Points 20; Broken Threshold 10.')
})

it.each<[number, number, number, HardlightGrade]>([
  [1, 0, 0, 'Commercial'], [2, 1, 0, 'Tactical'], [3, 1, 0, 'Tactical'],
  [4, 1, 1, 'Advanced'], [9, 1, 1, 'Advanced'], [10, 2, 1, 'Superior'],
  [11, 2, 1, 'Superior'], [12, 2, 2, 'Elite'], [15, 2, 2, 'Elite'],
  [16, 3, 2, 'Ultimate'], [18, 3, 2, 'Ultimate'], [19, 3, 3, 'Paragon'],
])('automatically scales both handwrap types at level %i without changing saved configuration', (level, potency, striking, grade) => {
  const free = ['Grievous', 'Grappling', 'Shoving']
  for (const kind of [undefined, 'hardlight'] as const) {
    const c: Character = { ...base, level, handwraps: { ...(kind ? { kind, grade: 'Commercial' } : {}), potency: 0, striking: 0, runes: ['Impactful'] } }
    const before = JSON.stringify(c)
    const effective = effectiveHandwraps(c)
    expect(effective).toMatchObject({ potency, striking, runes: kind || !potency ? ['Impactful'] : free.slice(0, potency), ...(kind ? { grade } : {}) })
    const fist = ownedWeapons(c, []).find(weapon => weapon.name === 'Fist')!
    expect(effectiveWeapon(c, [], fist)).toMatchObject({ potency, striking })
    expect(JSON.stringify(c)).toBe(before)
    const granted: Character = { ...c, systems: kind ? ['sf2e'] : ['pf2e'], handwraps: undefined }
    expect(effectiveHandwraps(granted)).toMatchObject({ potency, striking, ...(kind ? { kind, grade } : {}) })
    expect(effectiveWeapon(granted, [], fist)).toMatchObject({ potency, striking })
    expect(granted.handwraps).toBeUndefined()
  }
  expect(automaticHardlightGrade(level)).toBe(grade)
})

it('gives Handwraps of Mighty Blows automatic property runes by potency', () => {
  for (const [level, runes] of [[2, ['Grievous']], [10, ['Grievous', 'Grappling']], [16, ['Grievous', 'Grappling', 'Shoving']]] as const) {
    expect(effectiveHandwraps({ ...base, level, handwraps: undefined })?.runes).toEqual(runes)
  }
})

it('chooses automatic handwraps from class metadata with both systems enabled, including homebrew classes', () => {
  const fighter = content('class', 'Fighter')
  const mechanic: ContentEntry = { ...content('class', 'Mechanic'), systems: ['sf2e'] }
  const custom: ContentEntry = { ...mechanic, id: 'custom-class', name: 'Custom Starfinder Class', source: 'homebrew' }
  const entries = [fighter, mechanic, custom]
  for (const klass of entries) {
    const c: Character = { ...base, systems: ['pf2e', 'sf2e'], className: klass.name, level: 12 }
    const before = JSON.stringify(c)
    const wraps = effectiveHandwraps(c, entries)!
    expect(wraps).toMatchObject({ potency: 2, striking: 2, runes: klass === fighter ? ['Grievous', 'Grappling'] : [] })
    expect(wraps.kind).toBe(klass === fighter ? undefined : 'hardlight')
    expect(wraps.grade).toBe(klass === fighter ? undefined : 'Elite')
    const fist = ownedWeapons(c, entries).find(weapon => weapon.name === 'Fist')!
    expect(effectiveWeapon(c, entries, fist)).toMatchObject({ potency: 2, striking: 2 })
    expect(JSON.stringify(c)).toBe(before)
  }
  expect(effectiveHandwraps({ ...base, systems: ['pf2e', 'sf2e'], className: undefined }, entries)).toBeUndefined()
})

it('preserves stronger saved upgrades without stacking PF values onto hardlight grades', () => {
  const handwraps = { potency: 3, striking: 3, runes: ['Impactful'] }
  expect(effectiveHandwraps({ ...base, level: 2, handwraps })).toEqual({ ...handwraps, runes: ['Grievous', 'Grappling', 'Shoving'] })
  expect(effectiveHandwraps({ ...base, level: 2, handwraps: { ...handwraps, kind: 'hardlight', grade: 'Elite' } }))
    .toMatchObject({ grade: 'Elite', potency: 2, striking: 2, runes: ['Impactful'] })
  expect(effectiveHandwraps({ ...base, handwraps: undefined })).toMatchObject({ potency: 2, striking: 1, runes: ['Grievous', 'Grappling'] })
  expect(effectiveHandwraps({ ...base, className: undefined, handwraps: undefined })).toBeUndefined()
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

it('keeps favored weapon benefits without forcing Champions, Clerics or Vindicators to own one', () => {
  for (const className of ['Champion', 'Cleric', 'Ranger']) {
    const c: Character = { ...base, className, weapons: [], feats: className === 'Ranger' ? [feat('Vindicator Dedication', 2)] : [] }
    const granted = ownedWeapons(c, [sword, deity]).filter(w => w.name === sword.name)
    expect(granted).toHaveLength(0)
    const owned = { ...main, potency: 0, striking: 0 }
    const equipped = { ...c, weapons: [owned] }
    expect(effectiveWeapon(equipped, [sword, deity], owned)).toMatchObject({ potency: 2, striking: 1 })
    const markup = renderToStaticMarkup(<WeaponList c={equipped} entries={[sword, deity]} save={() => {}} />)
    expect(markup).not.toContain('Favored weapon of Iomedae')
    expect(markup).toContain('aria-label="Remove Longsword"')
  }
  const ranger = { ...base, className: 'Ranger', weapons: [] }
  expect(ownedWeapons(ranger, [sword, deity]).some(w => w.name === sword.name)).toBe(false)
  expect(ownedWeapons({ ...ranger, level: 1, feats: [feat('Vindicator Dedication', 2)] }, [sword, deity]).some(w => w.name === sword.name)).toBe(false)
})

it('retains legacy deity weapons as removable inventory across class changes', () => {
  const c: Character = { ...base, weapons: [] }
  const granted = { ...main, id: `deity-weapon:${sword.id}` }
  const saved = { ...granted, potency: 3, striking: 3, runes: ['Flaming'] }
  const equipped = { ...c, weapons: [{ ...main, id: 'purchased' }, saved] }
  expect(ownedWeapons(equipped, [sword, deity]).filter(w => w.name === sword.name)).toHaveLength(2)
  expect(renderToStaticMarkup(<WeaponList c={equipped} entries={[sword, deity]} save={() => {}} />).match(/aria-label="Remove Longsword"/g)).toHaveLength(2)
  expect(ownedWeapons({ ...equipped, className: 'Fighter' }, [sword, deity]).some(w => w.id === granted.id)).toBe(true)
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
  expect(effectiveWeapon({ ...c, handwraps: { potency: 3, striking: 3, runes: ['Flaming'] } }, [fistDeity], fist).runes).toEqual(['Grievous', 'Grappling', 'Shoving'])
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
  expect(maxPropertyRunes(3, 'Orichalcum', true)).toBe(5)
  expect(maxPropertyRunes(3, undefined, true)).toBe(4)
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
  const names = ["Ranger's Bramble", 'Ephemeral Tracking', "Hunter's Vision", 'Invisibility', 'Gluttonous Growth', 'Pack Breaker']
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

it('offers Tethered weapon feats at level twenty for their source features', () => {
  const tetheredFeats = homebrewCharacterOptions([])
  const living = content('feat', 'Living Weapon', { class: 'Ranger' }, 1, ['Ranger'])
  const dedication = content('feat', 'Wild Hunter Dedication', { archetype: 'Wild Hunter' }, 2, ['Archetype', 'Dedication'])
  const verdant = content('feat', 'Verdant Weapon', { class: 'Druid' }, 1, ['Druid'])
  const osteo = content('feat', 'Osteo Armaments', { class: 'Necromancer' }, 4, ['Necromancer'])
  const entries = [...tetheredFeats, living, dedication, verdant, osteo]
  const check = (name: string, c: Character, category: 'class' | 'archetype') => {
    const featEntry = tetheredFeats.find(entry => entry.name === name)!
    const slot = { key: `${category}:20:0`, category, level: 20 }
    expect(eligibleFeats(entries, c, slot)).toContain(featEntry)
    expect(eligibleFeats(entries, { ...c, level: 19 }, { ...slot, key: `${category}:18:0`, level: 18 })).not.toContain(featEntry)
  }
  check('Tethered Living Weapon', { ...base, level: 20, className: 'Ranger',
    feats: [feat('Living Weapon', 1), feat('Wild Hunter Dedication', 2)] }, 'archetype')
  check('Tethered Verdant Weapon', { ...base, level: 20, className: 'Druid', feats: [feat('Verdant Weapon', 1)] }, 'class')
  check('Tethered Osteo Weapon', { ...base, level: 20, className: 'Necromancer', feats: [feat('Osteo Armaments', 4)] }, 'class')
  for (const className of ['Champion', 'Cleric']) {
    check('Tethered Favored Weapon', { ...base, level: 20, className }, 'class')
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
  const c: Character = { ...base, activeStance: haftStance.name, level: 14, weapons: [weapon], feats: [
    feat('Wild Hunter Dedication', 2), feat('Living Weapon', 8), feat('Pristine Living Weapon', 14), feat('Haft Striker Stance', 4),
  ] }
  const ordinary = { ...weapon, id: 'ordinary', livingWeapon: false }
  const entries = [polearm, haftStance]
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
  expect(markup).toMatch(/Material<button[^>]*>\*<\/button>/)
  expect(markup).not.toContain('Damage 2d8+1 S + 1d6')
})

it('applies Pristine Weapon only to the selected verdant weapon and inherited haft strike', () => {
  const polearm = content('weapon', 'Glaive', { hands: 2, weapon_group: 'Polearm', damage: '1d8 slashing' })
  const weapon = { ...main, name: polearm.name, verdantWeapon: true }
  const c: Character = { ...base, level: 10, activeStance: haftStance.name, weapons: [weapon], feats: [
    feat('Verdant Weapon', 1), feat('Pristine Weapon', 10), feat('Haft Striker Stance', 4),
  ] }
  const entries = [polearm, haftStance]
  const haft = ownedWeapons(c, entries).find((w) => w.name === HAFT_STRIKER_WEAPON.name)!
  for (const strike of [weapon, haft]) {
    expect(weaponAttack(c, entries, strike).pristineWeapon).toBe(true)
    expect(weaponAttack(c, entries, strike).damage).not.toContain('bleed')
  }
  expect(weaponAttack(c, entries, { ...weapon, verdantWeapon: false }).pristineWeapon).toBe(false)
  expect(weaponAttack({ ...c, level: 9 }, entries, weapon).pristineWeapon).toBe(false)
  expect(weaponAttack({ ...c, feats: c.feats.filter(f => f.name !== 'Verdant Weapon') }, entries, weapon).pristineWeapon).toBe(false)
  expect(weaponAttack({ ...c, systems: ['sf2e'] }, entries, weapon).pristineWeapon).toBe(false)
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Pristine Weapon: treated as cold iron and silver.')
  expect(markup).toContain('Critical hit against a creature with a weakness to cold iron or silver: 1d6 persistent bleed.')
})

it('shows Fire Resistance saves as conditional without changing base saves', () => {
  const fire = { ...content('feat', 'Fire Resistance', { resistances: 'fire=half' }, 4, ['Druid']) }
  const c: Character = { ...base, level: 10, feats: [feat('Fire Resistance', 4)] }
  expect(resistances(c, [fire])).toContainEqual({ damage: 'Fire', value: 5, source: 'Fire Resistance' })
  for (const save of ['Fortitude', 'Reflex', 'Will'] as const) {
    const result = savingThrowBreakdown(c, [fire], save)
    expect(result.total).toBe(savingThrowBreakdown({ ...c, feats: [] }, [fire], save).total)
    expect(result.notes).toContain('Fire Resistance: +1 circumstance against fire effects; circumstance bonuses do not stack.')
    expect(savingThrowBreakdown({ ...c, level: 3 }, [fire], save).notes ?? []).not.toContain(
      'Fire Resistance: +1 circumstance against fire effects; circumstance bonuses do not stack.')
  }
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

it('adds Weapon Innovation Jousting only to an active, qualifying one-handed melee innovation', () => {
  const entry = { ...sword, level: 0 }
  const innovation = { ...main, inventorInnovation: true }
  const c: Character = { ...base, className: 'Inventor', subclass: 'Weapon', level: 10,
    weapons: [innovation], feats: [feat('Weapon Innovation Jousting', 4)] }
  expect(weaponAttack(c, [entry], innovation).traits).toContain('Jousting')
  expect(weaponAttack(c, [entry], { ...innovation, inventorInnovation: false }).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, subclass: 'Armor' }, [entry], innovation).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, feats: [] }, [entry], innovation).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, level: 3 }, [entry], innovation).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, feats: [{ ...c.feats[0], takenLevel: 12 }] }, [entry], innovation).traits).not.toContain('Jousting')
  expect(weaponAttack(c, [{ ...entry, data: { ...entry.data, hands: 2 } }], innovation).traits).not.toContain('Jousting')
  expect(weaponAttack(c, [{ ...entry, data: { ...entry.data, weapon_type: 'Ranged', range: 20 } }], innovation).traits).not.toContain('Jousting')
})

it('grants Living Weapon Joust to the one-handed haft attack, not its two-handed source', () => {
  const spear = content('weapon', "Dancer's Spear", { hands: 2, weapon_group: 'Spear', damage: '1d6 piercing' })
  const source = { ...main, name: spear.name, livingWeapon: true }
  const c: Character = { ...base, activeStance: haftStance.name, level: 14, weapons: [source], feats: [
    feat('Living Weapon', 8), feat('Living Weapon Joust', 14), feat('Haft Striker Stance', 4),
  ] }
  const legacyHaft = { ...HAFT_STRIKER_WEAPON, data: { weapon_category: 'Simple', weapon_group: 'Club', weapon_type: 'Melee', damage: '1d4 bludgeoning' } }
  const entries = [spear, legacyHaft, haftStance]
  const haft = ownedWeapons(c, entries).find(weapon => weapon.name === HAFT_STRIKER_WEAPON.name)!
  expect(weaponAttack(c, entries, haft).entry?.data.hands).toBe(1)
  expect(weaponAttack(c, entries, haft).traits).toContain('Jousting')
  expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />))
    .toContain('class="gear-trait" aria-haspopup="dialog">Jousting</button>')
  expect(weaponAttack(c, entries, source).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, level: 13 }, entries, haft).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, feats: c.feats.filter(feat => feat.name !== 'Living Weapon Joust') }, entries, haft).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, weapons: [{ ...source, livingWeapon: false }] }, entries, haft).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, weapons: [] }, entries, haft).traits).not.toContain('Jousting')
})

it.each(['Verdant Weapon Jousting', 'Favored Weapon Jousting', 'Weapon Innovation Jousting'])('uses the selected haft source for %s', name => {
  const spear = content('weapon', 'Spear', { hands: 2, weapon_group: 'Spear', damage: '1d6 piercing' }, 0)
  const source = { ...main, name: spear.name, verdantWeapon: name === 'Verdant Weapon Jousting',
    inventorInnovation: name === 'Weapon Innovation Jousting' }
  const c: Character = { ...base, activeStance: haftStance.name, level: 10, weapons: [source],
    ...(name === 'Weapon Innovation Jousting' ? { className: 'Inventor', subclass: 'Weapon' } : {}),
    feats: [feat(name, 4), feat('Haft Striker Stance', 4)] }
  const patron = { ...deity, data: { ...deity.data, favored_weapon: spear.name } }
  const entries = [spear, patron, haftStance]
  const haft = ownedWeapons(c, entries).find(weapon => weapon.name === HAFT_STRIKER_WEAPON.name)!
  expect(weaponAttack(c, entries, haft).traits).toContain('Jousting')
  expect(weaponAttack(c, entries, source).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, feats: c.feats.filter(feat => feat.name !== name) }, entries, haft).traits).not.toContain('Jousting')
  expect(weaponAttack({ ...c, level: 3 }, entries, haft).traits).not.toContain('Jousting')
})

it('ignores retired Cold Iron Tusks while ordinary Tusks still inherit class handwraps', () => {
  const c = { ...base, level: 20, feats: [feat('Cold Iron Tusks', 5)] }
  expect(ownedWeapons(c, []).some(weapon => weapon.name === ORC_TUSKS.name)).toBe(false)
  const ordinary = { ...c, feats: [...c.feats, feat('Tusks')] }
  const tusks = ownedWeapons(ordinary, []).find(weapon => weapon.name === ORC_TUSKS.name)!
  expect(effectiveWeapon(ordinary, [], tusks)).toMatchObject({ material: undefined, potency: 3, striking: 3 })
})

it('applies Animal Feature senses, movement, and level gates without changing land Speed', () => {
  const c: Character = { ...base, level: 7, className: 'Ranger', activeSpells: ['Animal Feature'], animalFeature: 'Cat Eyes',
    feats: [feat('Advanced Warden', 4, 'Animal Feature'), feat('Fleet'), feat('Primal Nimbleness')] }
  expect(senses(c, []).map((sense) => sense.value)).toContain('Low-Light Vision')
  expect(senses({ ...c, animalFeature: 'Owl Eyes' }, []).map((sense) => sense.value)).toContain('Darkvision')
  expect(movementSpeeds({ ...c, animalFeature: 'Fish Tail' }, [])).toEqual([{ name: 'Land', feet: 35 }, { name: 'Swim', feet: 35, source: 'Animal Feature' }])
  expect(movementSpeeds({ ...c, animalFeature: 'Wings' }, [])).toEqual([{ name: 'Land', feet: 35 }])
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

it('shows Supernatural Senses targeting DCs only while raging with the feat', () => {
  const c: Character = { ...base, className: 'Barbarian', level: 4, raging: true,
    feats: [feat('Acute Scent', 2), feat('Supernatural Senses', 4)] }
  const markup = (character: Character) => renderToStaticMarkup(<SensesAndSpeed c={character} entries={[]} save={() => {}} />)
  expect(markup(c)).toContain('flat check DC is 3 or 9')
  expect(markup({ ...c, raging: false })).not.toContain('Supernatural Senses note')
  expect(markup({ ...c, level: 3 })).not.toContain('Supernatural Senses note')
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
  const markup = renderToStaticMarkup(<SensesAndSpeed c={c} entries={[ancestry]} save={() => {}} />)
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
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="senses" />)
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

it('grants Invulnerable Rager heavy armor proficiency and follows Barbarian medium armor progression', () => {
  const barbarian = content('class', 'Barbarian', { defense_proficiency: 'Trained in light armor, medium armor, and unarmored defense' })
  const expertise = { ...content('classFeature', 'Barbarian Armor Expertise', { class: 'Barbarian' }, 11),
    description: 'Your proficiency ranks for light armor, medium armor, and unarmored defense increase to expert.' }
  const mastery = { ...content('classFeature', 'Barbarian Armor Mastery', { class: 'Barbarian' }, 17),
    description: 'Your proficiency ranks for medium armor increase to master.' }
  const c: Character = { ...base, level: 8, className: 'Barbarian', feats: [feat('Invulnerable Rager', 8)] }
  const data = [barbarian, expertise, mastery]
  expect(armorRanks(c, data).Heavy).toBe(1)
  expect(armorRanks({ ...c, raging: true, level: 11 }, data).Heavy).toBe(2)
  expect(armorRanks({ ...c, level: 17 }, data).Heavy).toBe(3)
  expect(armorRanks({ ...c, level: 7 }, data).Heavy).toBe(0)
  expect(armorRanks({ ...c, level: 17, feats: [] }, data).Heavy).toBe(0)
})

it('shows Barbarian Athletics feat effects only while raging and avoids stacking status bonuses', () => {
  const c: Character = { ...base, level: 8, className: 'Barbarian', raging: true, abilities: { ...base.abilities, str: 18 },
    skillPicks: ['Athletics'], feats: [feat('Adrenaline Rush'), feat('Brutal Bully', 6), feat('Furious Bully', 8)] }
  const markup = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={[]} save={() => {}} part="skills" />)
  expect(markup(c)).toContain('+16 for Athletics attack actions (+2 circumstance')
  expect(markup(c)).toContain('+15 to lift heavy objects, Escape, and Force Open (+1 status')
  expect(markup(c)).toContain('Strength modifier (+4)')
  expect(markup({ ...c, raging: false })).not.toContain('Furious Bully note')
  expect(markup({ ...c, raging: false })).not.toContain('Brutal Bully note')
  expect(markup({ ...c, level: 7 })).not.toContain('Furious Bully note')
  const boosted = { ...c, activeSpells: ['Athletic Rush'], spells: [{ name: 'Athletic Rush', rank: 1, cantrip: false }] }
  expect(markup(boosted)).toContain('+16 to lift heavy objects, Escape, and Force Open (+1 status')
})

it('shows Brutal Critical and Devastator for melee and eligible thrown Strikes', () => {
  const melee = content('weapon', 'Test Sword', { weapon_category: 'Martial', weapon_type: 'Melee', damage: '1d8 slashing' })
  const ranged = content('weapon', 'Test Bow', { weapon_category: 'Martial', weapon_type: 'Ranged', range: 60, damage: '1d8 piercing' })
  const thrown = content('weapon', 'Test Spear', { weapon_category: 'Martial', weapon_type: 'Ranged', range: 20, damage: '1d6 piercing' }, 0, ['Thrown', 'Fatal d10'])
  const devastator = content('classFeature', 'Devastator', { class: 'Barbarian' }, 15)
  const c: Character = { ...base, className: 'Barbarian', level: 18, raging: true,
    feats: [feat('Brutal Critical', 18), feat('Shattering Blows', 16)] }
  const weapon = (entry: ContentEntry) => ({ id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] })
  const notes = (character: Character, entry: ContentEntry, entries = [melee, ranged, devastator]) =>
    weaponAttack(character, entries, weapon(entry)).breakdown.notes ?? []
  expect(notes(c, melee)).toContain('Brutal Critical: on a critical Strike, add 1d8 damage and deal 2d8 persistent bleed.')
  expect(notes(c, melee)).toContain('Devastator: ignore up to 10 resistance to physical damage from this Strike.')
  expect(notes(c, melee)).toContain('Shattering Blows: melee Strike damage ignores the first 10 Hardness of an object.')
  expect(notes(c, melee, [melee])).toContain('Shattering Blows: melee Strike damage ignores the first 5 Hardness of an object.')
  expect(notes({ ...c, raging: false }, melee).some(note => note.startsWith('Shattering Blows:'))).toBe(false)
  expect(notes(c, ranged).some(note => note.startsWith('Brutal Critical:') || note.startsWith('Shattering Blows:'))).toBe(false)
  expect(notes(c, thrown, [thrown, devastator]).some(note => note.startsWith('Brutal Critical:') || note.startsWith('Devastator:'))).toBe(false)
  const thrower = { ...c, feats: [...c.feats, feat('Raging Thrower', 1)] }
  expect(notes(thrower, thrown, [thrown, devastator])).toContain('Brutal Critical: on a critical Strike, add 1d10 damage and deal 2d10 persistent bleed.')
  expect(notes(thrower, thrown, [thrown, devastator])).toContain('Devastator: ignore up to 10 resistance to physical damage from this Strike.')
  expect(notes({ ...thrower, raging: false }, thrown, [thrown, devastator])).toContain('Devastator: ignore up to 10 resistance to physical damage from this Strike.')
  expect(notes({ ...c, level: 17 }, melee).some(note => note.startsWith('Brutal Critical:'))).toBe(false)
})

it('provides conditional Draconic Arrogance saves and tracks Scars of Steel uses', () => {
  const c: Character = { ...base, className: 'Barbarian', level: 4, raging: true,
    abilities: { ...base.abilities, con: 18 }, feats: [feat('Draconic Arrogance'), feat('Scars of Steel', 4)] }
  const save = savingThrowBreakdown(c, [], 'Will')
  expect(save.notes).toContain(`Draconic Arrogance: +${save.total + 2} against emotion effects (+2 status; status bonuses do not stack).`)
  expect((savingThrowBreakdown({ ...c, raging: false }, [], 'Will').notes ?? []).some(note => note.includes('Draconic Arrogance'))).toBe(false)
  const markup = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={[]} save={() => {}} part="defense" />)
  expect(markup(c)).toContain('gain resistance 6')
  expect(markup({ ...c, dailyFeatUses: { 'Scars of Steel': true } }))
    .toContain('aria-label="Scars of Steel used" checked=""')
  expect(markup({ ...c, level: 3 })).not.toContain('Scars of Steel used')
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

it.each([[10, 3], [11, 3], [12, 4], [15, 4], [16, 5], [19, 5], [20, 6]])('applies Harden Flesh resistance %i -> %i only while active', (level, value) => {
  const c: Character = { ...base, className: 'Druid', level, feats: [feat('Harden Flesh', 10)], hardenFleshActive: true }
  expect(resistances(c, [])).toEqual([{ damage: 'Physical (except adamantine)', value, source: 'Harden Flesh' }])
  expect(resistances({ ...c, hardenFleshActive: false }, [])).toEqual([])
  expect(resistances({ ...c, hardenFleshActive: false, activeFeatEffects: ['Harden Flesh'] }, [])).toEqual([])
  expect(resistances({ ...c, level: 9 }, [])).toEqual([])
  expect(resistances({ ...c, feats: [] }, [])).toEqual([])
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(markup).toContain('aria-label="Harden Flesh note"')
  expect(markup).toContain(`resistance ${value} to physical damage except adamantine`)
  expect(markup).toContain('Harden Flesh active')
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

it('keeps Hazard Finder conditional and ignores its legacy toggle for ordinary defenses and initiative', () => {
  const c: Character = { ...base, className: 'Ranger', level: 8, feats: [feat('Hazard Finder', 8)], activeFeatEffects: ['Hazard Finder'] }
  const normal = defenseSummary({ ...c, activeFeatEffects: [] }, [])
  const hazard = defenseSummary(c, [])
  expect(hazard).toEqual(normal)
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
  expect(armorClass({ ...hazard, parrying: false }, [rapier, improved])).toBe(normal)
  expect(parryValue({ ...c, weapons: [] }, [improved])).toBe(0)
})

it('grants Defensive Armaments parry to wielded two-handed firearms and crossbows only', () => {
  const firearm = content('weapon', 'Arquebus', { weapon_category: 'Martial', weapon_group: 'Firearm',
    weapon_type: 'Ranged', range: 150, hands: 2, damage: '1d8 piercing' })
  const crossbow = content('weapon', 'Heavy Crossbow', { weapon_category: 'Martial', weapon_group: 'Crossbow',
    weapon_type: 'Ranged', range: 120, hands: 2, damage: '1d10 piercing' })
  const pistol = content('weapon', 'Clan Pistol', { weapon_category: 'Martial', weapon_group: 'Firearm',
    weapon_type: 'Ranged', range: 80, hands: 1, damage: '1d6 piercing' })
  const defensive = content('feat', 'Defensive Armaments', {}, 2)
  const weapons = [firearm, crossbow, pistol].map((weapon, index) =>
    ({ id: `weapon-${index}`, name: weapon.name, potency: 0, striking: 0, runes: [] }))
  const c: Character = { ...base, level: 2, feats: [feat('Defensive Armaments', 2)], weapons }
  const entries = [firearm, crossbow, pistol, defensive]
  expect(hasParryWeapon(c, entries)).toBe(true)
  expect(weaponAttack(c, entries, weapons[0]).traits).toContain('Parry')
  expect(weaponAttack(c, entries, weapons[1]).traits).toContain('Parry')
  expect(weaponAttack(c, entries, weapons[2]).traits).not.toContain('Parry')
  expect(parryValue(c, entries)).toBe(1)
  expect(hasParryWeapon({ ...c, weapons: [{ ...weapons[0], stowed: true }, weapons[1], weapons[2]] }, entries)).toBe(true)
  expect(hasParryWeapon({ ...c, weapons: [{ ...weapons[0], stowed: true }, { ...weapons[1], stowed: true }, weapons[2]] }, entries)).toBe(false)
  expect(hasParryWeapon({ ...c, feats: [] }, entries)).toBe(false)
})

it('doubles ranged and thrown increments for the Impossible rune', () => {
  const bow = content('weapon', 'Longbow', { weapon_category: 'Martial', weapon_type: 'Ranged', range: 100, damage: '1d8 piercing' })
  const dagger = content('weapon', 'Thrown Dagger', { weapon_category: 'Simple', weapon_type: 'Melee',
    thrown_range: 10, hands: 1, damage: '1d4 piercing' }, 1, ['Thrown 10 feet'])
  expect(weaponAttack(base, [bow], { id: 'bow', name: bow.name, potency: 0, striking: 0, runes: ['Impossible'] }).range).toBe(200)
  expect(weaponAttack(base, [dagger], { id: 'dagger', name: dagger.name, potency: 0, striking: 0, runes: ['Impossible'] }).thrownRange).toBe(20)
  expect(weaponAttack(base, [bow], { id: 'plain', name: bow.name, potency: 0, striking: 0, runes: [] }).range).toBe(100)
})

it('grants a locked Dwarf clan dagger and adds a pistol only with the Clan Pistol feat', () => {
  const ranger = content('class', 'Ranger', { attribute: 'Strength, Dexterity' })
  const entries = [ranger, CLAN_PISTOL, CLAN_DAGGER, CLAN_DAGGER_DEXTERITY]
  const dwarf: Character = { ...base, ancestry: 'Dwarf', className: 'Ranger', level: 12, boosts: { class: 'dex' } }
  const weapons = ownedWeapons(dwarf, entries).filter(weapon => weapon.id.startsWith('granted-weapon:dwarf:'))
  expect(weapons.map(weapon => weapon.name)).toEqual([CLAN_DAGGER_DEXTERITY.name])
  for (const weapon of weapons) {
    expect(weapon.stowed).toBe(true)
    expect(weaponEquipped(dwarf, entries, weapon)).toBe(false)
    expect(isLockedWeapon(dwarf, weapon.name, entries, weapon.id)).toBe(true)
    expect(hasAutomaticWeaponFundamentals(dwarf, entries, weapon)).toBe(true)
    expect(effectiveWeapon(dwarf, entries, weapon)).toMatchObject({ potency: 2, striking: 2, material: 'Orichalcum' })
  }
  expect(weaponEntry(entries, CLAN_DAGGER_DEXTERITY.name)?.traits).toContain('Finesse')
  const strengthDwarf = { ...dwarf, boosts: { class: 'str' as const } }
  expect(ownedWeapons(strengthDwarf, entries).find(weapon => weapon.id.endsWith(':clan-dagger'))?.name).toBe(CLAN_DAGGER.name)
  expect(ownedWeapons({ ...dwarf, ancestry: 'Elf' }, entries).some(weapon => weapon.id.startsWith('granted-weapon:dwarf:'))).toBe(false)
  const pistolDwarf = { ...dwarf, feats: [feat('Clan Pistol', 1)] }
  const pistolWeapons = ownedWeapons(pistolDwarf, entries).filter(weapon => weapon.id.startsWith('granted-weapon:dwarf:'))
  expect(pistolWeapons.map(weapon => weapon.name)).toEqual([CLAN_PISTOL.name, CLAN_DAGGER_DEXTERITY.name])
  expect(pistolWeapons.every(weapon => weapon.stowed)).toBe(true)
  expect(isLockedWeapon(pistolDwarf, CLAN_PISTOL.name, entries, pistolWeapons[0].id)).toBe(true)
  expect(effectiveWeapon(pistolDwarf, entries, pistolWeapons[0])).toMatchObject({ potency: 2, striking: 2, material: 'Orichalcum' })
  for (const stowed of [undefined, false, true]) {
    const saved = { ...pistolDwarf, weapons: pistolWeapons.map(weapon => ({ ...weapon, stowed })) }
    expect(ownedWeapons(saved, entries).filter(weapon => weapon.id.startsWith('granted-weapon:dwarf:'))
      .every(weapon => weaponEquipped(saved, entries, weapon) === !stowed)).toBe(true)
  }
})

it.each([
  [7, []],
  [8, ['Flaming']],
  [9, ['Ashen', 'Flaming']],
  [10, ['Ashen', 'Flaming', 'Impactful']],
  [15, ['Ashen', 'Flaming (Greater)', 'Impactful']],
  [16, ['Ashen (Greater)', 'Flaming (Greater)', 'Impactful']],
  [17, ['Ashen (Greater)', 'Flaming (Greater)', 'Impactful (Greater)']],
  [20, ['Ashen (Greater)', 'Flaming (Greater)', 'Impactful (Greater)', 'Impossible']],
] as const)('scales granted Clan Pistol property runes at level %i', (level, runes) => {
  const c: Character = { ...base, level, feats: [feat('Clan Pistol', 1)] }
  const entries = [CLAN_PISTOL]
  const pistol = ownedWeapons(c, entries).find(weapon => weapon.name === CLAN_PISTOL.name)!
  expect(effectiveWeapon(c, entries, pistol).runes).toEqual(runes)
  expect(weaponAttack(c, entries, pistol).range).toBe(level >= 20 ? 160 : 80)
  const manual = { ...pistol, id: 'independent' }
  expect(effectiveWeapon(c, entries, manual).runes).toEqual([])
  expect(effectiveWeapon({ ...c, feats: [] }, entries, pistol).runes).toEqual([])
})

it('keeps Clan Pistol granted runes locked and retains previously saved runes', () => {
  const entries = [CLAN_PISTOL]
  let c: Character = { ...base, level: 10, feats: [feat('Clan Pistol', 1)] }
  const pistol = ownedWeapons(c, entries).find(weapon => weapon.name === CLAN_PISTOL.name)!
  c = { ...c, weapons: [{ ...pistol, stowed: false, runes: ['Greater Ashen', 'Flaming', 'Shock'] }] }
  const effective = effectiveWeapon(c, entries, c.weapons![0])
  expect(effective.runes).toEqual(['Shock', 'Ashen (Greater)', 'Flaming', 'Impactful'])
  expect(c.weapons![0].runes).toEqual(['Greater Ashen', 'Flaming', 'Shock'])
  const html = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Granted by Clan Pistol')
  expect(html).not.toContain('aria-label="Remove Ashen (Greater) rune"')
  expect(html).not.toContain('aria-label="Remove Flaming rune"')
  const offense = renderToStaticMarkup(<WeaponList c={{ ...c, level: 20 }} entries={entries} save={() => {}} displayOnly />)
  expect(offense).toContain('1d8 persistent fire')
  expect(offense).toContain('1d6 force')
  expect(offense).toContain('160')
})

it('grants adopted Dwarves a clan dagger only while the house rule and adoption are active', () => {
  const old = getSettings()
  try {
    updateSettings({ adoptedDwarfClanDagger: true })
    const ranger = content('class', 'Ranger', { attribute: 'Strength, Dexterity' })
    const entries = [ranger, CLAN_PISTOL, CLAN_DAGGER, CLAN_DAGGER_DEXTERITY]
    const c: Character = { ...base, ancestry: 'Human', className: 'Ranger', level: 5, boosts: { class: 'dex' },
      feats: [{ ...feat('Adopted Ancestry', 1), type: 'General Feat', choice: 'Dwarf', takenLevel: 5 }] }
    const grants = (character: Character) => ownedWeapons(character, entries).filter(weapon => weapon.id.startsWith('granted-weapon:dwarf:'))
    expect(grants(c).map(weapon => weapon.name)).toEqual([CLAN_DAGGER_DEXTERITY.name])
    expect(effectiveWeapon(c, entries, grants(c)[0])).toMatchObject({ potency: 1, striking: 1, material: 'Orichalcum' })
    expect(grants({ ...c, level: 4 })).toEqual([])
    expect(grants({ ...c, feats: [] })).toEqual([])
    const withPistol = { ...c, feats: [...c.feats, { ...feat('Clan Pistol', 1), takenLevel: 7 }] }
    expect(grants(withPistol).map(weapon => weapon.name)).toEqual([CLAN_DAGGER_DEXTERITY.name])
    expect(grants({ ...withPistol, level: 7 }).map(weapon => weapon.name)).toEqual([CLAN_PISTOL.name, CLAN_DAGGER_DEXTERITY.name])
    updateSettings({ adoptedDwarfClanDagger: false })
    expect(grants(c)).toEqual([])
    expect(grants({ ...c, ancestry: 'Dwarf' }).map(weapon => weapon.name)).toEqual([CLAN_DAGGER_DEXTERITY.name])
    expect(grants({ ...withPistol, level: 7 }).map(weapon => weapon.name)).toEqual([CLAN_PISTOL.name])
    const manual = { ...c, weapons: [{ id: 'manual', name: CLAN_DAGGER.name, potency: 1, striking: 1, runes: [] }] }
    expect(ownedWeapons(manual, entries).some(weapon => weapon.id === 'manual')).toBe(true)
  } finally {
    updateSettings(old)
  }
})

it.each([[1, 0, 0], [2, 1, 0], [4, 1, 1], [10, 2, 1], [12, 2, 2], [16, 3, 2], [19, 3, 3]])(
  'automatically upgrades clan weapon fundamentals at level %i', (level, potency, striking) => {
    const c: Character = { ...base, ancestry: 'Elf', level }
    for (const name of [CLAN_DAGGER.name, CLAN_DAGGER_DEXTERITY.name, CLAN_PISTOL.name]) {
      const weapon = { id: name, name, potency: 0, striking: 0, runes: [] }
      expect(effectiveWeapon(c, [], weapon)).toMatchObject({ potency, striking })
      expect(effectiveWeapon(c, [], { ...weapon, potency: 3, striking: 3 })).toMatchObject({ potency: 3, striking: 3 })
    }
  },
)

it.each([false, true])('uses free-hand weapons and available fists for Twin Parry with the unarmed house rule %s', unarmed => {
  const previous = getSettings()
  updateSettings({ unarmedCountsAsWeapons: unarmed })
  try {
    const claw = content('weapon', 'Clawed Gauntlet', { weapon_category: 'Martial', hands: 1, weapon_type: 'Melee', damage: '1d4 slashing' }, 1, ['Parry', 'Free-Hand'])
    const sword = content('weapon', 'Sword', { weapon_category: 'Martial', hands: 1, weapon_type: 'Melee', damage: '1d6 slashing' })
    const twin = { ...content('feat', 'Twin Parry', {}, 4), description: 'You gain a +1 circumstance bonus to AC until the start of your next turn, or a +2 circumstance bonus if either weapon has the parry trait.' }
    const entries = [claw, sword, twin]
    const c: Character = { ...base, className: 'Ranger', level: 4, feats: [feat('Twin Parry', 4)], parrying: true,
      weapons: [{ id: 'a', name: claw.name, potency: 0, striking: 0, runes: [] }, { id: 'b', name: sword.name, potency: 0, striking: 0, runes: [] }] }
    expect(parryValue(c, entries)).toBe(2)
    expect(armorClass(c, entries) - armorClass({ ...c, parrying: false }, entries)).toBe(2)
    const gauntletOnly = { ...c, weapons: [c.weapons![0], { ...c.weapons![1], stowed: true }] }
    expect(ownedWeapons(gauntletOnly, entries).some(weapon => weapon.name === 'Fist')).toBe(false)
    expect(parryValue(gauntletOnly, entries)).toBe(unarmed ? 2 : 1)
    expect(armorClass(gauntletOnly, entries) - armorClass({ ...gauntletOnly, parrying: false }, entries)).toBe(unarmed ? 2 : 1)
    expect(parryValue({ ...c, feats: [] }, entries)).toBe(1)
    const bare = { ...c, weapons: [] }
    expect(hasParryWeapon(bare, entries)).toBe(unarmed)
    expect(parryValue(bare, entries)).toBe(unarmed ? 1 : 0)
    const secondGauntlet = { ...claw, id: 'second-gauntlet', name: 'Second Gauntlet' }
    const pistol = content('weapon', 'Pistol', { weapon_category: 'Martial', hands: 1, weapon_type: 'Ranged', range: 30 })
    const paired: Character = { ...c, weapons: [c.weapons![0], { ...c.weapons![0], id: 'second', name: secondGauntlet.name }] }
    expect(parryValue(paired, [...entries, secondGauntlet])).toBe(2)
    expect(parryValue({ ...paired, weapons: [...paired.weapons!, { ...c.weapons![1], id: 'pistol', name: pistol.name }] },
      [...entries, secondGauntlet, pistol])).toBe(unarmed ? 2 : 1)
    expect(parryValue({ ...c, weapons: [{ ...c.weapons![1], name: pistol.name }] }, [...entries, pistol])).toBe(0)
    const bow = content('weapon', 'Longbow', { weapon_category: 'Martial', hands: '1+', weapon_type: 'Ranged', range: 100 })
    const holdingBow = { ...gauntletOnly, weapons: [c.weapons![0],
      { id: 'bow', name: bow.name, potency: 0, striking: 0, runes: [], handsHeld: 1 as const }] }
    expect(parryValue(holdingBow, [...entries, bow])).toBe(unarmed ? 2 : 1)
    expect(armorClass(holdingBow, [...entries, bow]) - armorClass({ ...holdingBow, parrying: false }, [...entries, bow]))
      .toBe(unarmed ? 2 : 1)
    expect(parryValue({ ...holdingBow, feats: [] }, [...entries, bow])).toBe(1)
    expect(parryValue({ ...holdingBow, level: 3 }, [...entries, bow])).toBe(1)
    expect(twinnedDefenseActive(holdingBow, [...entries, bow])).toBe(false)
    expect(parryBonus({ ...holdingBow, parrying: false }, [...entries, bow])).toBe(0)
    const shootingBow = { ...holdingBow, weapons: holdingBow.weapons.map(weapon => weapon.id === 'bow'
      ? { ...weapon, handsHeld: 2 as const } : weapon) }
    expect(parryValue(shootingBow, [...entries, bow])).toBe(unarmed ? 2 : 1)
    expect(armorClass(shootingBow, [...entries, bow]) - armorClass({ ...shootingBow, parrying: false }, [...entries, bow]))
      .toBe(unarmed ? 2 : 1)
    expect(parryValue({ ...shootingBow, feats: [] }, [...entries, bow])).toBe(1)
    expect(parryBonus({ ...shootingBow, parrying: false }, [...entries, bow])).toBe(0)
    expect(parryValue({ ...shootingBow, weapons: shootingBow.weapons.filter(weapon => weapon.id === 'bow') }, [...entries, bow])).toBe(0)
  } finally {
    updateSettings(previous)
  }
})

it.each(['Twinned Defense (Fighter)', 'Twinned Defense Stance'])('grants continuous Twin Parry only from active, learned %s', name => {
  const previous = getSettings()
  updateSettings({ unarmedCountsAsWeapons: true })
  try {
    const stance = content('feat', name, {}, 16, [name.includes('Fighter') ? 'Fighter' : 'Ranger', 'Stance'])
    const claw = content('weapon', 'Clawed Gauntlet', { weapon_category: 'Martial', hands: 1, weapon_type: 'Melee' }, 1, ['Parry', 'Free-Hand'])
    const entries = [stance, claw]
    const c: Character = { ...base, level: 16, parrying: false, activeStance: name,
      feats: [feat('Twin Parry', 4), feat(name, 16)],
      weapons: [{ id: 'claw', name: claw.name, potency: 0, striking: 0, runes: [] }] }
    const without = { ...c, activeStance: undefined }
    expect(twinnedDefenseActive(c, entries)).toBe(true)
    expect(parryBonus(c, entries)).toBe(2)
    expect(armorClass(c, entries) - armorClass(without, entries)).toBe(2)
    expect(parryBonus({ ...c, parrying: true }, entries)).toBe(2)
    expect(parryBonus({ ...c, activeStance: 'Some Other Stance' }, entries)).toBe(0)
    expect(parryBonus({ ...c, level: 15 }, entries)).toBe(0)
    expect(parryBonus({ ...c, feats: c.feats.slice(0, 1) }, entries)).toBe(0)
    expect(parryBonus(c, [{ ...stance, deleted: true }, claw])).toBe(0)
    updateSettings({ unarmedCountsAsWeapons: false })
    expect(parryBonus(c, entries)).toBe(0)
    const sword = content('weapon', 'Sword', { weapon_category: 'Martial', hands: 1, weapon_type: 'Melee' })
    expect(parryBonus({ ...c, weapons: [...c.weapons!, { id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [] }] },
      [...entries, sword])).toBe(2)
  } finally { updateSettings(previous) }
})

it('scales ring capacity with fingered hands, not prehensile tails, and counts quantities', () => {
  const ring = content('item', 'Ring of Climbing', { item_category: 'Worn Items', usage: 'worn' })
  expect(ringCapacity(base)).toBe(10)
  expect(ringCapacity({ ...base, feats: [feat('Additional Arms', 1)] })).toBe(20)
  expect(ringCapacity({ ...base, feats: [feat('Prehensile Tail', 1)] })).toBe(10)
  expect(ringCapacity(JSON.parse(JSON.stringify({ ...base, ringCapacity: 7 })))).toBe(10)
  expect(ringCapacity(JSON.parse(JSON.stringify({ ...base, ringCapacity: 0 })))).toBe(10)
  expect(ringCount({ ...base, equipment: [{ name: ring.name, qty: 9 }, { name: 'Rope', qty: 20 }] }, [ring])).toBe(9)
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
  expect(save.parts).not.toContainEqual({ label: 'Hazard Finder (circumstance)', value: 1 })
  expect(save.notes?.join(' ')).toContain('Hazard Finder +1 circumstance against hazard effects')
  const strike = weaponAttack(c, entries, { id: 'r', name: 'Rapier', potency: 2, striking: 0, runes: [] })
  expect(strike.breakdown.total).toBe(strike.attack)
  expect(strike.breakdown.parts).toContainEqual({ label: 'Dexterity', value: 4 })
  expect(strike.breakdown.parts).toContainEqual({ label: 'Effective weapon potency (item)', value: 2 })
  expect(strike.breakdown.parts.reduce((sum, part) => sum + part.value, 0)).toBe(strike.attack)
})

it('keeps researched resistance conditional without a toggle or blanket save bonuses from old activation state', () => {
  const c: Character = { ...base, level: 13, rankOverrides: { Arcana: 3, Nature: 1 },
    feats: [{ ...feat('Researched Spell Resistance', 13), choice: 'Arcane, Primal' }],
    activeFeatEffects: ['Researched Spell Resistance'] }
  const normal = defenseSummary({ ...c, activeFeatEffects: [] }, [])
  const active = defenseSummary(c, [])
  expect(researchedSpellResistance(c, [])?.traditions).toEqual(['Arcane', 'Primal'])
  expect(active.fortitude).toBe(normal.fortitude)
  expect(active.reflex).toBe(normal.reflex)
  expect(active.will).toBe(normal.will)
  expect(active.perception).toBe(normal.perception)
  expect(active.ac).toBe(normal.ac)
  const both = { ...c, feats: [...c.feats, feat('Hazard Finder', 8)], activeFeatEffects: [...c.activeFeatEffects!, 'Hazard Finder'] }
  expect(defenseSummary(both, []).reflex).toBe(normal.reflex)
  expect(researchedSpellResistance({ ...c, level: 12 }, [])).toBeUndefined()
  expect(researchedSpellResistance({ ...c, feats: [] }, [])).toBeUndefined()
  expect(researchedSpellResistance({ ...c, rankOverrides: { Arcana: 1, Nature: 1 } }, [])).toBeUndefined()
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(markup).not.toContain('aria-label="Researched spell resistance active"')
  expect(markup).not.toContain('Enable only for a matching effect')
  expect(markup).toContain('against Arcane, Primal spells and effects')
  expect(markup).not.toContain('<small>Circumstance</small>+1')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, activeFeatEffects: [] }} entries={[]} save={() => {}} part="defense" />))
    .not.toContain('<small>Circumstance</small>+1')
})

it('exposes persisted defensive contexts and shows conditional bonuses without changing ordinary saves', () => {
  const c: Character = { ...base, className: 'Ranger', feats: [feat('Hazard Finder', 8)], activeFeatEffects: ['Hazard Finder'] }
  for (const part of ['senses', 'defense'] as const) {
    const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part={part} />)
    expect(markup).not.toContain('Hazard checks active')
    expect(markup).toContain('aria-label="Hazard Finder note"')
    expect(markup).toContain('(Hazard Finder)')
    expect(markup).not.toContain('<small>Circumstance</small>+1')
  }
  const druid: Character = { ...base, className: 'Druid', feats: [feat('Harden Flesh', 10)], hardenFleshActive: true }
  const markup = renderToStaticMarkup(<SkillsSection c={druid} entries={[]} save={() => {}} part="defense" />)
  expect(markup).toContain('Harden Flesh active')
  expect(markup).toContain('aria-label="Harden Flesh note"')
  expect(markup).toContain('Physical (except adamantine) 3')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...druid, feats: [] }} entries={[]} save={() => {}} part="defense" />)).not.toContain('Harden Flesh note')
})

it('keeps movement sources in notes and alphabetizes alternate speeds after land Speed', () => {
  const c: Character = { ...base, level: 9, className: 'Ranger',
    feats: [feat('Persistent Animal Feature', 8), feat('Fleet'), feat('Primal Nimbleness')],
    spells: [{ name: 'Animal Feature', rank: 2, cantrip: false }, { name: 'Canopy Crawler', rank: 2, cantrip: false },
      { name: 'Stormwind Flight', rank: 4, cantrip: false }],
    activeSpells: ['Animal Feature', 'Canopy Crawler', 'Stormwind Flight'], animalFeatures: ['Fish Tail', 'Wings'] }
  const markup = renderToStaticMarkup(<SensesAndSpeed c={c} entries={[]} save={() => {}} />)
  const text = markup.replace(/<span[^>]*class="source-note"[^>]*>[\s\S]*?<\/span>/g, '').replace(/<[^>]*>/g, '')
  expect(text).toContain('Speed: 35 ft.*; Climbing 35 ft.*; Fly 35 ft.*; Swim 35 ft.*')
  for (const source of ['Fleet', 'Primal Nimbleness', 'Canopy Crawler', 'Stormwind Flight', 'Animal Feature']) {
    expect(text).not.toContain(source)
    expect(markup).toContain(source)
  }
  const inactive = renderToStaticMarkup(<SensesAndSpeed c={{ ...c, activeSpells: [] }} entries={[]} save={() => {}} />)
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
  const markup = renderToStaticMarkup(<SensesAndSpeed c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain(`Scent (imprecise) ${range} feet<button`)
  expect(markup).toContain('aria-label="Keen Smell note"')
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
  expect(minions).toMatch(/climb 50 feet<button[^>]*>\*<\/button>/)
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
  expect(markup).toMatch(/Huge<button[^>]*>\*<\/button>/)
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
  for (const patch of [{ level: 3 }, { feats: [] }]) {
    expect(ownedWeapons({ ...c, ...patch }, []).map((weapon) => weapon.name)).not.toContain(OVERSIZED_THROW.name)
  }
  expect(ownedWeapons({ ...c, raging: false }, []).map(weapon => weapon.name)).not.toContain(OVERSIZED_THROW.name)
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('aria-haspopup="dialog">Oversized Throw</button>')
  expect(markup).not.toContain('aria-label="Weapon material"')
  expect(markup).not.toContain('aria-label="Add property rune"')
  expect(markup).not.toContain('aria-label="Remove Oversized Throw"')
})

it('requires simple weapon specialization to increase Oversized Throw dice', () => {
  const c: Character = { ...base, level: 10, className: 'Fighter', raging: true, feats: [feat('Oversized Throw', 4)] }
  const weapon = ownedWeapons(c, []).find(item => item.id === OVERSIZED_THROW.id)!
  const klass = content('class', 'Fighter', { attack_proficiency: 'Trained in simple weapons' })
  const specialization = content('classFeature', 'Weapon Specialization', { class: 'Fighter' }, 7)
  const expert = { ...klass, data: { attack_proficiency: 'Expert in simple weapons' } }
  const greater = content('classFeature', 'Greater Weapon Specialization', { class: 'Fighter' }, 10)
  expect(weaponAttack(c, [klass, specialization], weapon).damage).toMatch(/^1d10/)
  expect(weaponAttack(c, [expert, specialization], weapon).damage).toMatch(/^2d10/)
  expect(weaponAttack(c, [expert, specialization, greater], weapon).damage).toMatch(/^3d10/)
})

it('keeps the remastered Unstoppable Juggernaut without removing unrelated or unavailable legacy feats', () => {
  const hit = (id: string, name: string) => ({ _id: id, _source: { category: 'feat', name } })
  const legacy = hit('feat-1167', 'Unstoppable Juggernaut')
  const remaster = hit('feat-5880', 'Unstoppable Juggernaut')
  const other = hit('feat-123', 'Other Feat')
  expect(mapAonHits([legacy, remaster, other], 'pf2e').map(entry => entry.id))
    .toEqual(['aon:pf2e:feat-5880', 'aon:pf2e:feat-123'])
  expect(mapAonHits([legacy, other], 'pf2e').map(entry => entry.id))
    .toContain('aon:pf2e:feat-1167')
})

it('requires a two-handed hammer, spear, or polearm for Haft Striker and inherits compatible runes from its selected source', () => {
  const spear = content('weapon', 'Spear', { hands: 2, weapon_group: 'Spear', damage: '1d8 piercing' })
  const hammer = content('weapon', 'Hammer', { hands: 2, weapon_group: 'Hammer', damage: '1d12 bludgeoning' })
  const first: OwnedWeapon = { ...main, name: 'Spear', runes: ['Flaming', 'Wounding'] }
  const second: OwnedWeapon = { ...main, id: 'second', name: 'Hammer', potency: 2, striking: 2, runes: ['Frost'] }
  const c = { ...base, activeStance: haftStance.name, weapons: [first, second], feats: [feat('Haft Striker Stance', 4)] }
  const entries = [spear, hammer, haftStance]
  const haft = ownedWeapons(c, entries).find((weapon) => weapon.name === HAFT_STRIKER_WEAPON.name)!
  expect(effectiveWeapon(c, entries, haft)).toMatchObject({ potency: 3, striking: 1, runes: ['Flaming'] })
  expect(effectiveWeapon({ ...c, haftStrikerWeaponId: second.id }, entries, haft)).toMatchObject({ potency: 2, striking: 2, runes: ['Frost'] })
  expect(effectiveWeapon({ ...c, weapons: [{ ...first, runes: ['Holy'] }] }, entries,
    { ...haft, runes: ['Unholy'] }).runes).toEqual(['Holy'])
  const incompatible: ContentEntry['data'][] = [{ hands: 1 }, { weapon_group: 'Club' }, { weapon_type: 'Ranged' }]
  for (const data of incompatible) {
    expect(ownedWeapons({ ...c, weapons: [first] }, [haftStance, { ...spear, data: { ...spear.data, ...data } }]).map((weapon) => weapon.name)).not.toContain(HAFT_STRIKER_WEAPON.name)
  }
  expect(ownedWeapons({ ...c, feats: [] }, entries).map((weapon) => weapon.name)).not.toContain(HAFT_STRIKER_WEAPON.name)
})

it('gives two-handed weapons the Parry trait from Raise Haft and improves existing Parry to +2', () => {
  const weapon = content('weapon', 'Greatsword', { hands: 2, weapon_group: 'Sword', damage: '1d12 slashing' }, 0)
  const raisedHaft = content('feat', 'Raise Haft')
  const wielded: OwnedWeapon = { id: 'greatsword', name: weapon.name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...base, level: 2, weapons: [wielded], feats: [feat('Raise Haft', 2)] }
  const entries = [weapon, raisedHaft]
  expect(hasParryWeapon(c, entries)).toBe(true)
  expect(weaponAttack(c, entries, wielded).traits).toContain('Parry')
  expect(parryValue(c, entries)).toBe(1)
  expect(parryValue({ ...c, weapons: [{ ...wielded, name: 'Parrying Greatsword' }] },
    [content('weapon', 'Parrying Greatsword', { hands: 2, damage: '1d12 slashing' }, 0, ['Parry']), raisedHaft])).toBe(2)
})

it('gives tengu an innate Beak that gains versatile S from Dogfang Bite', () => {
  const c: Character = { ...base, ancestry: 'Tengu', level: 5, feats: [] }
  const bite = ownedWeapons(c, []).filter(weapon => weapon.name === 'Beak')
  expect(bite).toHaveLength(1)
  expect(weaponAttack(c, [], bite[0]).damage).toContain('d6')
  expect(weaponAttack(c, [], bite[0]).traits).toContain('Finesse')
  expect(weaponAttack(c, [], bite[0]).traits).not.toContain('Versatile S')
  const dogfang = { ...c, feats: [feat('Dogfang Bite', 5)] }
  const upgraded = ownedWeapons(dogfang, []).filter(weapon => weapon.name === 'Beak')
  expect(upgraded).toHaveLength(1)
  expect(weaponAttack(dogfang, [], upgraded[0]).traits).toContain('Versatile S')
  expect(ownedWeapons({ ...c, ancestry: 'Human' }, []).some(weapon => weapon.name === 'Beak')).toBe(false)
})

it('adds the selected Iruxi Armaments attack and its ancestry-feat benefits', () => {
  const c: Character = { ...base, ancestry: 'Lizardfolk', level: 13,
    feats: [feat('Iruxi Armaments', 1, 'Fangs'), feat('Iruxi Spirit Strike', 13), feat('Iruxi Unarmed Cunning', 5)] }
  const attacks = ownedWeapons(c, [])
  const fangs = attacks.find(weapon => weapon.name === 'Fangs')!
  const attack = weaponAttack(c, [], fangs)
  expect(attack.damage).toBe('3d8+1 piercing')
  expect(attack.traits).not.toContain('Ghost Touch')
  expect(effectiveWeapon(c, [], fangs).runes).toContain('Ghost Touch')
  const fistEntry = content('weapon', 'Test Fist', { weapon_category: 'Unarmed', damage: '1d4 bludgeoning', hands: 1 }, 0, ['Unarmed'])
  const fist: OwnedWeapon = { id: fistEntry.id, name: fistEntry.name, potency: 0, striking: 0, runes: [] }
  expect(weaponAttack(c, [fistEntry], fist).traits).not.toContain('Ghost Touch')
  expect(effectiveWeapon(c, [fistEntry], fist).runes).toEqual(['Grievous', 'Grappling', 'Ghost Touch'])
  const weapon = content('weapon', 'Shortsword', { damage: '1d6 piercing', hands: 1 }, 0, [])
  const held: OwnedWeapon = { id: weapon.id, name: weapon.name, potency: 0, striking: 0, runes: [] }
  expect(weaponAttack(c, [weapon], held).traits).not.toContain('Ghost Touch')
  expect(effectiveWeapon(c, [weapon], held).runes).not.toContain('Ghost Touch')
  expect(effectiveWeapon({ ...c, level: 12 }, [fistEntry], fist).runes).not.toContain('Ghost Touch')
  const withRune = { ...c, handwraps: { potency: 1, striking: 0, runes: ['Ghost Touch'] } }
  expect(effectiveWeapon(withRune, [fistEntry], fist).runes).toEqual(['Grievous', 'Grappling', 'Ghost Touch'])
  expect(effectiveWeapon({ ...c, ancestry: 'Human' }, [fistEntry], fist).runes).not.toContain('Ghost Touch')
  expect(effectiveWeapon({ ...c, feats: [] }, [fistEntry], fist).runes).not.toContain('Ghost Touch')
  for (const choice of ['Claws', 'Fangs', 'Tail']) {
    const character = { ...c, feats: [feat('Iruxi Armaments', 1, choice), feat('Iruxi Spirit Strike', 13)] }
    const unarmed = ownedWeapons(character, []).find(candidate => candidate.name === choice)!
    expect(effectiveWeapon(character, [], unarmed).runes).toContain('Ghost Touch')
    expect(weaponAttack(character, [], unarmed).traits).not.toContain('Ghost Touch')
  }
  const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [fist] }} entries={[fistEntry]} save={() => {}} />)
  expect(markup).toContain('Granted by Iruxi Spirit Strike')
  expect(markup).not.toContain('aria-label="Remove Ghost Touch rune"')
  expect(attack.criticalSpecialization).toBe(true)
  expect(featChoiceOptions('Iruxi Armaments', c, [], '')).toEqual(['Claws', 'Tail'])
  const twoSelections = { ...c, feats: [...c.feats, feat('Iruxi Armaments', 5, 'Claws')] }
  expect(featChoiceOptions('Iruxi Armaments', twoSelections, [], '', 0)).toEqual(['Fangs', 'Tail'])
  expect(featChoiceOptions('Iruxi Armaments', twoSelections, [], '', 3)).toEqual(['Claws', 'Tail'])
  const threeSelections = { ...twoSelections, feats: [...twoSelections.feats, feat('Iruxi Armaments', 9, 'Tail')] }
  const fourthSelection = { ...threeSelections, feats: [...threeSelections.feats, feat('Iruxi Armaments', 13)] }
  expect(featChoiceOptions('Iruxi Armaments', fourthSelection, [], '', 5)).toEqual([])
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
  expect(markup).toMatch(/>Poison 10<button[^>]*>\*<\/button>/)
  expect(markup).toContain('aria-label="Poison Resistance note"')
  expect(markup).toContain('popover="auto"')
  expect(markup).toContain('+1 status bonus to saving throws against poisons.')
  expect(markup).not.toContain('Saving throws against poisons: +1 status bonus.</small>')
  expect(options.find((entry) => entry.id === 'homebrew:ranger-poison-resistance')?.traits).toEqual(['Ranger'])
  expect(druidPoison.traits).toEqual(['Alchemist', 'Druid'])
})

it('keeps other poison resistance sources in notes without borrowing the feat saving throw note', () => {
  const poison = content('feat', 'Venom Ward', { resistances: 'poison=5' })
  const markup = renderToStaticMarkup(<SkillsSection c={{ ...base, feats: [feat(poison.name)] }}
    entries={[poison]} save={() => {}} part="defense" />)
  expect(markup).toContain('Poison 5<button')
  expect(markup).toContain('aria-label="Venom Ward note"')
  expect(markup).not.toContain('bonus to saving throws against poisons')
})

it.each([
  ['Harden Flesh', 'Resistances: None', 'until the beginning of your next turn'],
  ['Heart of the Kaiju', 'Physical', 'Physical resistance applies only while in kaiju form'],
  ['Primal Aegis', 'Acid', 'Resistance equals your positive Wisdom modifier'],
])('keeps %s condition visible with a clickable note', (name, damage, note) => {
  const c: Character = { ...base, level: 20, abilities: { ...base.abilities, wis: 18 },
    feats: [feat(name)], activeFeatEffects: [name] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(markup).toContain(damage)
  expect(markup).toContain(`aria-label="${name} note"`)
  expect(markup).not.toContain(`*</button> (${name})`)
  expect(markup).toContain(note)
  expect(markup).toContain('popover="auto"')
})

it('summarizes heritage, ancestry, subclass, and final level without duplicating ancestry', () => {
  const c = { ...base, ancestry: 'Human', heritage: 'Wintertouched Human', className: 'Ranger', subclass: 'Outwit', level: 20 }
  expect(characterSummary(c, [])).toBe('Wintertouched Human Outwit Edge Ranger 20')
  expect(characterSummary({ ...c, heritage: 'Wintertouched' }, [])).toBe('Wintertouched Human Outwit Edge Ranger 20')
})

it("adds Witch's Armaments attacks, then upgrades them with Wild Witch's Armaments and the hair feats", () => {
  const witch: Character = { ...base, className: 'Witch', level: 6, feats: [feat("Witch's Armaments", 1, 'Living Hair'), feat("Witch's Armaments", 2, 'Eldritch Nails')] }
  const names = (c: Character) => ownedWeapons(c, []).map(weapon => weapon.name)
  expect(names(witch)).toEqual(expect.arrayContaining(['Hair', 'Nails']))
  expect(names(witch)).not.toContain('Quills')
  const hair = (c: Character) => weaponAttack(c, [], ownedWeapons(c, []).find(weapon => weapon.name === 'Hair')!)
  expect(hair(witch).damage).toContain('d4')
  const upgraded: Character = { ...witch, level: 20, feats: [...witch.feats, feat("Wild Witch's Armaments", 6),
    feat("Syu Tak-Nwa's Deadly Hair", 6), feat("Syu Tak-Nwa's Hexed Locks", 8), feat("Demon's Hair", 20)] }
  expect(names(upgraded)).toContain('Quills')
  expect(hair(upgraded).damage).toContain('d8')
  expect(hair(upgraded).traits).toEqual(expect.arrayContaining(['Grapple', 'Reach', 'Sweep', 'Versatile S']))
})

it('applies the Bloodrager instinct rage damage, bleed, resistances and dedication casting', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', level: 9, raging: true }
  const attack = weaponAttack(c, [sword], main)
  expect(attack.rageDamage).toBe(4)
  expect(attack.additionalDamage).toContainEqual(expect.objectContaining({ source: 'Blood Rage', value: '2 persistent bleed' }))
  expect(weaponAttack({ ...c, level: 15 }, [sword], main).rageDamage).toBe(8)
  expect(resistances(c, []).filter(item => item.source === 'Raging Resistance').map(item => item.damage))
    .toEqual(expect.arrayContaining(['Slashing', 'Persistent bleed']))
  const dedicated = { ...c, feats: [{ ...feat('Bloodrager Dedication', 2), choice: 'Divine' }] }
  expect(classSpellcasting(dedicated, [])).toEqual({ traditions: ['Divine'], rank: 1, ability: 'cha' })
  expect(classSpellcasting(c, [])).toBeUndefined()
})

it('links feat-granted Witch attacks to the granting feat', () => {
  const armaments: ContentEntry = { id: 'wa', systems: ['pf2e'], kind: 'feat', source: 'official', name: "Witch's Armaments", level: 1,
    traits: [], data: {}, description: 'Your nails grow into claws.', effects: [], updatedAt: 0 }
  const c: Character = { ...base, className: 'Witch', level: 1, feats: [feat("Witch's Armaments", 1, 'Eldritch Nails')] }
  const html = renderToStaticMarkup(<WeaponList c={c} entries={[armaments]} save={() => {}} displayOnly />)
  expect(html).toContain('Your nails grow into claws.')
})
