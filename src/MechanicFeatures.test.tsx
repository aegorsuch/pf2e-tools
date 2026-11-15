import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { MechanicFeatures, mechanicMineState } from './MechanicFeatures'
import { DroneFeatures } from './DroneFeatures'
import { MinionsSection } from './MinionsSection'
import { SkillsSection } from './SkillsSection'
import { magneticLevitatorsActive, movementSpeeds, subclassOptions } from './builder'
import { droneCustomizationSlots, droneStats } from './drone'
import type { Character, ContentEntry } from './types'
import { eligibleFeats, featChoiceOptions, featSelectionPrerequisiteChecker } from './builder'
import { turretWeapon } from './mechanicTurret'
import { WeaponList } from './GearSection'

const mechanic: Character = {
  id: 'm', systems: ['sf2e'], name: 'Mechanic', level: 10, className: 'Mechanic', subclass: 'Mine',
  abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('offers the three official exocortexes and scales mine capacity and DC', () => {
  expect(subclassOptions(mechanic, []).map(entry => entry.name)).toEqual(['Drone', 'Mine', 'Turret'])
  const markup = renderToStaticMarkup(<MechanicFeatures c={mechanic} save={() => {}} />)
  expect(markup).toContain('Mine capacity: 12; disable DC 28')
  expect(renderToStaticMarkup(<MechanicFeatures c={{ ...mechanic, level: 1 }} save={() => {}} />))
    .toContain('Mine capacity: 8; disable DC 17')
  expect(mechanicMineState({ ...mechanic, mechanicMines: { carried: 14, deployed: 5 } }))
    .toEqual({ capacity: 12, carried: 12, deployed: 5 })
  expect(renderToStaticMarkup(<MechanicFeatures c={{ ...mechanic, mechanicMines: { carried: 12, deployed: 1 } }} save={() => {}} />))
    .toContain('Not enough carrying capacity to collect all deployed mines.')
})

it('calculates turret defenses and selected array', () => {
  const turret: Character = { ...mechanic, subclass: 'Turret', mechanicTurretArray: 'Laser Beam' }
  const markup = renderToStaticMarkup(<MechanicFeatures c={turret} save={() => {}} />)
  expect(markup).toContain('fire; range 60 feet')
  expect(markup).toContain('AC 28; HP 70; broken 35; hardness 15')
  expect(markup).toContain('Fortitude and Reflex +18')
  expect(markup).toContain('Manage turret grade, upgrades, and Strikes in Weapons')
  expect(renderToStaticMarkup(<MechanicFeatures c={{ ...turret, className: 'Ranger' }} save={() => {}} />)).toBe('')
})

it('calculates turret grade, weapon proficiency, specialization and active mods without using hands', () => {
  const entry = (name: string, kind: ContentEntry['kind'], level: number, description: string, data: ContentEntry['data']): ContentEntry =>
    ({ id: name, name, kind, level, description, data, source: 'official', systems: ['sf2e'], traits: [], effects: [], updatedAt: 0 })
  const entries = [
    entry('Mechanic', 'class', 1, '', { attack_proficiency: 'Trained in simple weapons, trained in martial weapons, trained in unarmed attacks' }),
    entry('Mechanic Weapon Expertise', 'classFeature', 5,
      'Your proficiency ranks for simple weapons, martial weapons, and unarmed attacks increase to expert.', { class: 'Mechanic' }),
    entry('Mechanic Weapon Mastery', 'classFeature', 13,
      'Your proficiency ranks for simple weapons, martial weapons, and unarmed attacks increase to master.', { class: 'Mechanic' }),
  ]
  const c: Character = { ...mechanic, level: 15, subclass: 'Turret', mechanicTurretArray: 'Laser Beam',
    mechanicTurretGrade: 'Elite', mechanicWeaponMods: { 'mechanic:turret': { pinpointShot: true, longRange: true, damageType: 'cold' } } }
  const turret = turretWeapon(c, entries)!
  expect(turret.attack.attack).toBe(23)
  expect(turret.attack.damage).toBe('3d8+10 cold')
  expect(turret.attack.range).toBe(90)
  expect(turret.entry.data.upgrade_slots).toBe(4)
  const html = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly />)
  expect(html).toContain('Hands used: 0/2')
  expect(html).toContain('Mechanic Turret')
  expect(html).toContain('3d8+10 cold')
  expect(turretWeapon({ ...c, subclass: 'Mine' }, entries)).toBeUndefined()
  expect(turretWeapon({ ...c, mechanicTurretGrade: 'Commercial', mechanicTurretUpgrades: ['a', 'b', 'c'] }, entries)?.weapon.upgrades)
    .toEqual(['a', 'b'])
  expect(turretWeapon({ ...c, mechanicTurretGrade: 'Paragon' }, entries)?.entry.data.upgrade_slots).toBe(5)
})

it('applies Magnetic Levitators only while its armor is worn', () => {
  const c: Character = { ...mechanic, armors: [{ id: 'armor', name: 'Armor', potency: 0, resilient: 0, runes: [], worn: true }],
    mechanicArmorMods: { armor: { magneticLevitators: true } } }
  expect(magneticLevitatorsActive(c, [])).toBe(true)
  expect(movementSpeeds(c, [])).toContainEqual({ name: 'Fly', feet: 10, source: 'Magnetic Levitators' })
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="offense" />))
    .toContain('hover; Magnetic Levitators')
  expect(movementSpeeds({ ...c, armors: [{ ...c.armors![0], worn: false }] }, [])).not.toContainEqual(
    expect.objectContaining({ source: 'Magnetic Levitators' }))
})

it('grants customization slots once per drone grade plus repeatable customization feats', () => {
  const c: Character = { ...mechanic, level: 16, subclass: 'Drone', mechanicDroneChassis: 'Agile', feats: [
    { name: 'Commercial Customization', type: 'Class Feat', level: 1 },
    { name: 'Tactical Drone', type: 'Class Feat', level: 4 },
    { name: 'Tactical Customization', type: 'Class Feat', level: 6 },
    { name: 'Advanced Drone', type: 'Class Feat', level: 8, choice: 'Burly' },
    { name: 'Advanced Customization', type: 'Class Feat', level: 10 },
    { name: 'Superior Drone', type: 'Class Feat', level: 14, choice: 'Ambusher' },
    { name: 'Superior Drone', type: 'Class Feat', level: 14, choice: 'Bully', slot: 'class:16:0' },
    { name: 'Superior Customization', type: 'Class Feat', level: 16 },
  ] }
  expect(droneCustomizationSlots(c)).toEqual({ Commercial: 4, Tactical: 3, Advanced: 3, Superior: 3 })
  expect(droneCustomizationSlots({ ...c, level: 3 })).toEqual({ Commercial: 4, Tactical: 0, Advanced: 0, Superior: 0 })
  expect(droneCustomizationSlots({ ...c, subclass: 'Turret' })).toBeUndefined()
  const markup = renderToStaticMarkup(<DroneFeatures c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Commercial customizations (4)')
  expect(markup).toContain('Superior customizations (3)')
  expect(markup).toContain('Integrated Weapon Mount')
  expect(markup).toContain('Hardened Chassis')
  expect(markup).toContain('Resistant Panels')
  expect(markup).toContain('Speedster')
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)).toContain('Drone exocortex')
})

it('applies the drone Assistant circumstance bonus only while in reach and both are trained', () => {
  const c: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Agile', mechanicDroneAssistantActive: true,
    rankOverrides: { Computers: 1 }, feats: [{ name: 'Tactical Drone', type: 'Class Feat', level: 4 }],
    mechanicDroneCustomizations: {
      Commercial: [{ name: 'Skill Module', choice: 'Computers' }],
      Tactical: [{ name: 'Assistant', choice: 'Computers' }],
    } }
  const html = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={[]} save={() => {}} />)
  expect(html(c)).toContain('Drone Assistant')
  expect(html({ ...c, mechanicDroneAssistantActive: false })).not.toContain('Drone Assistant')
  expect(html({ ...c, mechanicDroneCustomizations: { Tactical: [{ name: 'Assistant', choice: 'Computers' }] } }))
    .not.toContain('Drone Assistant')
})

it('restricts drone customization choices to valid distinct skills, maneuvers and existing speeds', () => {
  const c: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Powerful', rankOverrides: { Computers: 1 },
    feats: [{ name: 'Tactical Drone', type: 'Class Feat', level: 4 },
      { name: 'Advanced Drone', type: 'Class Feat', level: 8, choice: 'Burly' }],
    mechanicDroneCustomizations: {
      Commercial: [{ name: 'Skill Module', choice: 'Computers' }, { name: 'Skill Module' }],
      Tactical: [{ name: 'Assistant' }, { name: 'High Speed' }],
      Advanced: [{ name: 'Maneuver Module', choice: 'Trip', choice2: 'Shove' }, { name: 'Maneuver Module' }],
    } }
  const html = renderToStaticMarkup(<DroneFeatures c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('<option disabled="">Computers</option>')
  expect(html).toContain('<option disabled="">Fly</option>')
  expect(html).toContain('<option disabled="">Trip</option>')
  expect(html).toContain('<option value="Linguistic Upload" disabled="">Linguistic Upload</option>')
})

it('calculates drone advancement and selected customization effects', () => {
  const c: Character = { ...mechanic, level: 14, subclass: 'Drone', mechanicDroneChassis: 'Agile', feats: [
    { name: 'Tactical Drone', type: 'Class Feat', level: 4 },
    { name: 'Advanced Drone', type: 'Class Feat', level: 8, choice: 'Burly' },
    { name: 'Superior Drone', type: 'Class Feat', level: 14, choice: 'Ambusher' },
  ], mechanicDroneCustomizations: {
    Commercial: [{ name: 'Armored Plates' }, { name: 'Grounded' }, { name: 'Skill Module', choice: 'Computers' }],
    Tactical: [{ name: 'Hardened Chassis' }, { name: 'Expertise Module', choice: 'Computers' }],
    Superior: [{ name: 'Speedster' }],
  } }
  const stats = droneStats(JSON.parse(JSON.stringify(c)))
  expect(stats).toMatchObject({ ac: 37, hp: 174, electricityWeakness: 0, speed: { Land: 50, Climb: 30 } })
  expect(stats?.attacks[0]).toMatchObject({ attack: 25, damage: '3d6+10 slashing' })
  expect(stats?.skills).toContainEqual({ name: 'Computers', rank: 2, bonus: 16 })
  expect(droneStats({ ...c, level: 3 })?.hp).toBe(30)
})

it('enforces drone prerequisites, feat repetition limits and advancement choices', () => {
  const feat: ContentEntry = { id: 'custom', name: 'Commercial Customization', kind: 'feat', source: 'official',
    systems: ['sf2e'], level: 1, traits: ['Mechanic'], data: { repeatable: true, prerequisite: 'drone exocortex' },
    description: '', effects: [], updatedAt: 0 }
  const c: Character = { ...mechanic, subclass: 'Drone', feats: [] }
  const slot = { category: 'class' as const, level: 2, key: 'class:2:0' }
  expect(featSelectionPrerequisiteChecker(c, [feat], slot)(feat).missing).toEqual([])
  expect(featSelectionPrerequisiteChecker({ ...c, subclass: 'Mine' }, [feat], slot)(feat).missing).toContain('drone exocortex')
  expect(eligibleFeats([feat], c, slot)).toContainEqual(feat)
  const three = { ...c, feats: [1, 2, 4].map(level => ({ name: feat.name, type: 'Class Feat', level, slot: `class:${level}:0` })) }
  expect(eligibleFeats([feat], three, { ...slot, level: 6, key: 'class:6:0' })).not.toContainEqual(feat)
  expect(featChoiceOptions('Advanced Drone', c, [], slot.key)).toEqual(['Burly', 'Deft'])
  expect(featChoiceOptions('Superior Drone', { ...c, feats: [{ name: 'Superior Drone', type: 'Class Feat', level: 14, choice: 'Bully' }] }, [], slot.key))
    .not.toContain('Bully')
})

it('allows Plentiful Grenades twice only from level 14', () => {
  const feat: ContentEntry = { id: 'plentiful', name: 'Plentiful Grenades', kind: 'feat', source: 'official',
    systems: ['sf2e'], level: 8, traits: ['Mechanic'], data: {}, description: '', effects: [], updatedAt: 0 }
  const c: Character = { ...mechanic, level: 16, feats: [
    { name: 'Plentiful Grenades', type: 'Class Feat', level: 8, slot: 'class:8:0' },
  ] }
  const slot = { category: 'class' as const, level: 12, key: 'class:12:0' }
  expect(eligibleFeats([feat], c, slot)).not.toContainEqual(feat)
  expect(eligibleFeats([feat], c, { ...slot, level: 14, key: 'class:14:0' })).toContainEqual(feat)
  const twice = { ...c, feats: [...c.feats, { name: feat.name, type: 'Class Feat', level: 8, slot: 'class:14:0' }] }
  expect(eligibleFeats([feat], twice, { ...slot, level: 16, key: 'class:16:0' })).not.toContainEqual(feat)
})
