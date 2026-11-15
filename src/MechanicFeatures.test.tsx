import { renderToStaticMarkup } from 'react-dom/server'
import { isValidElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { MechanicFeatures, mechanicMineDamage, mechanicMineState } from './MechanicFeatures'
import { DroneFeatures } from './DroneFeatures'
import { MinionsSection } from './MinionsSection'
import { SkillsSection } from './SkillsSection'
import { magneticLevitatorsActive, movementSpeeds, resistances, subclassOptions } from './builder'
import { droneCustomizationSlots, droneForceField, droneStats } from './drone'
import type { Character, ContentEntry } from './types'
import { eligibleFeats, featChoiceOptions, featSelectionPrerequisiteChecker } from './builder'
import { turretWeapon } from './mechanicTurret'
import { ArmorList, WeaponList } from './GearSection'
import { droneEquipmentCapacity, droneMountedWeapons, droneWeaponAttack } from './droneEquipmentRules'
import { DroneEquipment } from './DroneEquipment'
import { switchDroneChassis } from './droneChassis'
import { FeatChoice } from './FeatChoice'
import { HighTechMedic } from './HighTechMedic'
import { setEnduringMod } from './mechanicEnduring'

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

it('shows mechanic mod progression at the appropriate levels', () => {
  const html = (level: number) => renderToStaticMarkup(<MechanicFeatures c={{ ...mechanic, level }} save={() => {}} />)
  expect(html(8)).not.toContain('Remote Mods:')
  expect(html(9)).toContain('within 60 feet')
  expect(html(13)).toContain('Enduring Mod')
  expect(html(15)).toContain('within 150 feet')
  expect(html(15)).toContain('Manifold Mods')
  expect(html(19)).toContain('Instant Mods')
})

it('activates and replaces an enduring mod without removing unrelated mods', () => {
  const c: Character = { ...mechanic, level: 13,
    mechanicWeaponMods: { sword: { incapacitant: true, bunkerBuster: true } },
    mechanicGrenadeMods: { 'prepared:0': { longRange: true } } }
  const weapon = { ...c, ...setEnduringMod(c, { kind: 'weapon', item: 'sword', mod: 'incapacitant', label: 'Sword' }) }
  expect(weapon.mechanicWeaponMods?.sword).toMatchObject({ incapacitant: true, bunkerBuster: true })
  const grenade = { ...weapon, ...setEnduringMod(weapon,
    { kind: 'grenade', item: 'prepared:0', mod: 'bigBoom', label: 'Prepared grenade 1' }) }
  expect(grenade.mechanicWeaponMods?.sword).toMatchObject({ incapacitant: false, bunkerBuster: true })
  expect(grenade.mechanicGrenadeMods?.['prepared:0']).toMatchObject({ bigBoom: true, longRange: true })
  const cleared = { ...grenade, ...setEnduringMod(grenade) }
  expect(cleared.mechanicGrenadeMods?.['prepared:0']).toMatchObject({ bigBoom: false, longRange: true })
  expect(cleared.mechanicEnduringMod).toBeUndefined()
  expect(renderToStaticMarkup(<MechanicFeatures c={grenade} save={() => {}} />)).toContain('Enduring item: Prepared grenade 1')
  const levitating = { ...grenade, ...setEnduringMod(grenade,
    { kind: 'armor', item: 'mechanic:drone', mod: 'magneticLevitators', label: 'Drone' }) }
  expect(levitating.mechanicGrenadeMods?.['prepared:0']?.bigBoom).toBe(false)
  expect(levitating.mechanicArmorMods?.['mechanic:drone']?.magneticLevitators).toBe(true)
  const drone = { ...levitating, ...setEnduringMod(levitating,
    { kind: 'drone', item: 'mechanic:drone', mod: 'killbot', label: 'Drone' }) }
  expect(drone.mechanicArmorMods?.['mechanic:drone']?.magneticLevitators).toBe(false)
  expect(drone.mechanicDroneKillbotActive).toBe(true)
  expect({ ...drone, ...setEnduringMod(drone) }).toMatchObject({ mechanicDroneKillbotActive: false })
  const energy = { ...drone, ...setEnduringMod(drone,
    { kind: 'armor', item: 'mechanic:drone', mod: 'energyNeutralizer', value: ['fire', 'cold'], label: 'Drone' }) }
  expect(energy.mechanicDroneKillbotActive).toBe(false)
  expect(energy.mechanicArmorMods?.['mechanic:drone']?.energyNeutralizer).toEqual(['fire', 'cold'])
  const configured = { ...energy, ...setEnduringMod(energy,
    { kind: 'weapon', item: 'sword', mod: 'damageType', value: 'piercing', label: 'Sword' }) }
  expect(configured.mechanicArmorMods?.['mechanic:drone']?.energyNeutralizer).toEqual([])
  expect(configured.mechanicWeaponMods?.sword?.damageType).toBe('piercing')
  expect({ ...configured, ...setEnduringMod(configured) }.mechanicWeaponMods?.sword?.damageType).toBeUndefined()
  const withItems: Character = { ...configured, equipment: [{ name: 'Rope', qty: 1 }, { name: 'Medpatch', qty: 2 }] }
  const medic = { ...withItems, ...setEnduringMod(withItems, {
    kind: 'medic', item: 'medic-1', mod: 'Restorative Boost', label: 'Medpatch', index: 1,
  }) }
  expect(medic.equipment[1]).toMatchObject({ mechanicItemId: 'medic-1', mechanicMedicMods: ['Restorative Boost'] })
  const reordered = { ...medic, equipment: [...medic.equipment].reverse() }
  expect({ ...reordered, ...setEnduringMod(reordered) }.equipment[0].mechanicMedicMods).toEqual([])
  const exo = { ...reordered, ...setEnduringMod(reordered, {
    kind: 'exo', item: 'mechanic:exo', mod: 'debilitation', value: ['Dazzled'], label: 'Drone',
  }) }
  expect(exo.equipment[0].mechanicMedicMods).toEqual([])
  expect(exo.mechanicExocortexDebilitation).toEqual(['Dazzled'])
  expect({ ...exo, ...setEnduringMod(exo) }.mechanicExocortexDebilitation).toEqual([])
})

it('preserves an enduring mine when deploying and collecting it, and clears it when detonated', () => {
  let c: Character = { ...mechanic, level: 13, mechanicMines: { carried: 2, deployed: 0 } }
  c = { ...c, ...setEnduringMod(c, { kind: 'mine', item: 'mechanic:mine', mod: 'bigBoom', label: 'Mine' }) }
  const findButton = (node: ReactNode, text: string): (() => void) | undefined => {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findButton(child, text)
        if (found) return found
      }
    } else if (isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) {
      const label = Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children
      if (node.type === 'button' && label === text) return node.props.onClick
      return findButton(node.props.children, text)
    }
    return undefined
  }
  const click = (text: string) => {
    const root = MechanicFeatures({ c, save: patch => { c = { ...c, ...patch } } })
    const action = findButton(root, text)
    expect(action).toBeDefined()
    action?.()
  }
  click('Deploy enduring mine')
  expect(c.mechanicMines).toEqual({ carried: 1, deployed: 1 })
  expect(c.mechanicDeployedMines?.[0]).toMatchObject({ enduring: true, bigBoom: true })
  expect(c.mechanicEnduringMine).toBeUndefined()
  c = { ...c, mechanicDeployedMines: [{ ...c.mechanicDeployedMines?.[0], id: 'mine-1' }],
    mechanicGlitching: { 'mine:mine-1': 2 } }
  click('Collect mines')
  expect(c.mechanicMines).toEqual({ carried: 2, deployed: 0 })
  expect(c.mechanicEnduringMine).toMatchObject({ enduring: true, bigBoom: true })
  click('Deploy enduring mine')
  expect(c.mechanicDeployedMines?.[0].id).toBe('mine-1')
  const deployed = { ...c, ...setEnduringMod(c,
    { kind: 'weapon', item: 'sword', mod: 'incapacitant', label: 'Sword' }) }
  expect(deployed.mechanicDeployedMines?.[0]).toMatchObject({ enduring: false, bigBoom: false })
  click('Detonate mine 1')
  expect(c.mechanicMines).toEqual({ carried: 1, deployed: 0 })
  expect(c.mechanicEnduringMod).toBeUndefined()
  expect(c.mechanicGlitching?.['mine:mine-1']).toBeUndefined()
  c = { ...c, ...setEnduringMod(c, { kind: 'mine', item: 'mechanic:mine',
    mod: 'damageType', value: 'slashing', label: 'Mine' }) }
  expect(c.mechanicEnduringMine).toMatchObject({ baseDamage: 'piercing', damageType: 'slashing' })
  expect(mechanicMineDamage(c, c.mechanicEnduringMine ?? {})).toMatchObject({ damage: '8d6 slashing' })
  click('Deploy enduring mine')
  const normal = { ...c, ...setEnduringMod(c) }
  expect(normal.mechanicDeployedMines?.[0]).toMatchObject({ enduring: false, baseDamage: 'piercing', damageType: undefined })
  const special = { ...normal, ...setEnduringMod(normal, { kind: 'mine', item: 'mechanic:mine',
    mod: 'debilitation', value: ['Dazzled', 'Clumsy'], label: 'Mine' }) }
  expect(special.mechanicEnduringMine?.debilitation).toEqual(['Dazzled', 'Clumsy'])
  expect({ ...special, ...setEnduringMod(special) }.mechanicEnduringMine).toBeUndefined()
  const medicMine = { ...normal, ...setEnduringMod(normal, { kind: 'mine', item: 'mechanic:mine',
    mod: 'medicMods', value: 'Restorative Boost', label: 'Mine' }) }
  expect(medicMine.mechanicEnduringMine?.medicMods).toEqual(['Restorative Boost'])
  expect(medicMine.mechanicEnduringMine?.healing).toBeUndefined()
})

it('preserves a collected ordinary mine and its glitching state when redeployed', () => {
  let c: Character = { ...mechanic, mechanicMines: { carried: 0, deployed: 1 },
    mechanicDeployedMines: [{ id: 'mine-2', bigBoom: true }], mechanicGlitching: { 'mine:mine-2': 2 } }
  const click = (text: string) => {
    const root = MechanicFeatures({ c, save: patch => { c = { ...c, ...patch } } })
    const find = (node: ReactNode): (() => void) | undefined => {
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = find(child)
          if (found) return found
        }
      } else if (isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) {
        if (node.type === 'button' && node.props.children === text) return node.props.onClick
        return find(node.props.children)
      }
      return undefined
    }
    const action = find(root)
    expect(action).toBeDefined()
    action?.()
  }
  click('Collect mines')
  click('Deploy mine')
  expect(c.mechanicDeployedMines?.[0]).toMatchObject({ id: 'mine-2', bigBoom: true })
  expect(c.mechanicGlitching?.['mine:mine-2']).toBe(2)
  click('Collect mines')
  c = { ...c, mechanicGlitching: { ...c.mechanicGlitching, 'weapon:other': 1 } }
  click('Daily preparations')
  expect(c.mechanicCarriedMines).toEqual([])
  expect(c.mechanicGlitching).toEqual({ 'weapon:other': 1 })
})

it('scales mine damage and area, including per-mine modifications', () => {
  expect(mechanicMineDamage({ ...mechanic, level: 1 }, {})).toMatchObject({ damage: '2d6 fire', radius: 10 })
  expect(mechanicMineDamage({ ...mechanic, level: 10 },
    { baseDamage: 'piercing', damageType: 'slashing', bigBoom: true, targeting: true }))
    .toMatchObject({ damage: '6d6+4 slashing', radius: 20 })
  expect(mechanicMineDamage({ ...mechanic, level: 15 }, {})).toMatchObject({ damage: '9d6 fire', radius: 20 })
  expect(mechanicMineDamage({ ...mechanic, level: 4 }, { damageType: 'cold' }).damage).toBe('3d6 fire')
  const c: Character = { ...mechanic, mechanicMines: { carried: 9, deployed: 2 },
    mechanicDeployedMines: [{ bigBoom: true }, { baseDamage: 'piercing', targeting: true }] }
  const html = renderToStaticMarkup(<MechanicFeatures c={c} save={() => {}} />)
  expect(html).toContain('6d6 fire; basic Reflex DC 28; 20-foot burst')
  expect(html).toContain('6d6+4 piercing; basic Reflex DC 28; 15-foot burst')
  expect(html).toContain('Detonate mine 2')
  expect(renderToStaticMarkup(<MechanicFeatures c={{ ...c, mechanicDeployedMines: undefined }} save={() => {}} />))
    .toContain('Mine 2')
})

it('applies healing mine progression only when the granting feats are active', () => {
  const c: Character = { ...mechanic, level: 12, feats: [
    { name: 'Healing Mines', type: 'Class Feat', level: 2 },
    { name: 'Impressive Healing Mines', type: 'Class Feat', level: 12 },
  ], mechanicMines: { carried: 0, deployed: 1 }, mechanicDeployedMines: [{ healing: true }] }
  const html = (character: Character) => renderToStaticMarkup(<MechanicFeatures c={character} save={() => {}} />)
  expect(html(c)).toContain('Heals 7d6+4 HP; no save')
  expect(html({ ...c, level: 7 })).toContain('Heals 5 HP; no save')
  expect(html({ ...c, feats: [] })).not.toContain('Heals')
})

it('scales debilitating exocortex condition choices and saving throws', () => {
  const c: Character = { ...mechanic, level: 16, subclass: 'Turret', mechanicExocortexDebilitation: ['Clumsy', 'Suppressed'],
    feats: [
      { name: 'Debilitating Exocortex', type: 'Class Feat', level: 6 },
      { name: 'Improved Debilitating Exocortex', type: 'Class Feat', level: 10 },
      { name: 'Double Debilitating Exocortex', type: 'Class Feat', level: 14 },
      { name: 'Foolproof Debilitations', type: 'Class Feat', level: 16 },
    ] }
  const html = (character: Character) => renderToStaticMarkup(<MechanicFeatures c={character} save={() => {}} />)
  expect(html(c)).toContain('Clumsy 2 and Suppressed')
  expect(html(c)).toContain('enemies must critically succeed')
  expect(html({ ...c, level: 10 })).toContain('Clumsy 1')
  expect(html({ ...c, level: 5 })).not.toContain('Debilitating Exocortex (Modify)')
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
  const explosive = { ...c, feats: [{ name: 'Explosive Shot', type: 'Class Feat', level: 1 }],
    mechanicWeaponMods: { 'mechanic:turret': { explosiveShot: true, damageType: 'cold' as const } } }
  expect(renderToStaticMarkup(<WeaponList c={explosive} entries={entries} save={() => {}} displayOnly />))
    .toContain('3 cold splash')
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
  const drone: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Powerful',
    mechanicArmorMods: { 'mechanic:drone': { magneticLevitators: true } } }
  expect(droneStats(drone)?.speed.Fly).toBe(10)
  expect(renderToStaticMarkup(<DroneFeatures c={drone} entries={[]} save={() => {}} />)).toContain('Land Speed gains hover')
  expect(droneStats({ ...drone, mechanicDroneCustomizations: { Commercial: [{ name: 'Flier' }] } })?.speed.Fly).toBe(20)
})

it('applies Energy Neutralizer only to worn armor, scaling its choices and resistance', () => {
  const c: Character = { ...mechanic, armors: [{ id: 'armor', name: 'Armor', potency: 0, resilient: 0, runes: [], worn: true }],
    feats: [{ name: 'Energy Neutralizer', type: 'Class Feat', level: 4 }],
    mechanicArmorMods: { armor: { energyNeutralizer: ['fire', 'cold', 'sonic'] } } }
  expect(resistances(c, []).filter(item => item.source === 'Energy Neutralizer')).toEqual([
    { damage: 'Fire', value: 4, source: 'Energy Neutralizer' },
    { damage: 'Cold', value: 4, source: 'Energy Neutralizer' },
  ])
  expect(resistances({ ...c, level: 15, feats: [...c.feats,
    { name: 'Enhanced Energy Neutralizer', type: 'Class Feat', level: 10 }] }, [])
    .filter(item => item.source === 'Energy Neutralizer')).toHaveLength(3)
  expect(resistances({ ...c, armors: [{ ...c.armors![0], worn: false }] }, [])).toEqual([])
  const html = renderToStaticMarkup(<ArmorList c={{ ...c, level: 4 }} entries={[]} save={() => {}} />)
  expect(html).toContain('<option>cold</option>')
  const drone: Character = { ...c, subclass: 'Drone', mechanicDroneChassis: 'Powerful',
    feats: [...c.feats, { name: 'Tactical Drone', type: 'Class Feat', level: 4 },
      { name: 'Advanced Drone', type: 'Class Feat', level: 8, choice: 'Burly' }],
    mechanicDroneCustomizations: { Advanced: [{ name: 'Resistant Panels', choice: 'fire' }] },
    mechanicArmorMods: { 'mechanic:drone': { energyNeutralizer: ['fire', 'cold'] } } }
  expect(droneStats(drone)?.resistances).toContainEqual({ damage: 'fire', value: 5, source: 'Resistant Panels' })
  expect(droneStats(drone)?.resistances).toContainEqual({ damage: 'cold', value: 4, source: 'Energy Neutralizer' })
  const enhanced = { ...drone, feats: [...drone.feats, { name: 'Enhanced Energy Neutralizer', type: 'Class Feat', level: 10 }] }
  expect(droneStats(enhanced)?.resistances).toContainEqual({ damage: 'fire', value: 10, source: 'Energy Neutralizer' })
})

it('offers learned Transmutative Casing materials and suppresses unavailable saved choices', () => {
  const c: Character = { ...mechanic, level: 16, subclass: 'Turret', mechanicTurretArray: 'Laser Beam',
    feats: [{ name: 'Transmutative Casing', type: 'Class Feat', level: 4 },
      { name: 'Advanced Transmutative Casing', type: 'Class Feat', level: 12 }],
    mechanicWeaponMods: { 'mechanic:turret': { transmutativeCasing: 'Noqual' } } }
  const html = (character: Character) => renderToStaticMarkup(<WeaponList c={character} entries={[]} save={() => {}} displayOnly />)
  expect(html(c)).toContain('Physical damage uses Noqual')
  expect(html(c)).toContain('Adamantine (standard-grade)')
  expect(html(c)).not.toContain('Hot Siccatite')
  expect(html({ ...c, level: 10 })).not.toContain('Physical damage uses Noqual')
  expect(html({ ...c, level: 3 })).not.toContain('Transmutative Casing')
})

it('shows feat-gated resistance bypass and Glitch Pulse on weapons', () => {
  const c: Character = { ...mechanic, level: 16, subclass: 'Turret', mechanicTurretArray: 'Laser Beam',
    feats: [{ name: 'Glitch Pulse', type: 'Class Feat', level: 12 }, { name: 'Exploitive Assault', type: 'Class Feat', level: 16 }],
    mechanicWeaponMods: { 'mechanic:turret': { exploitiveAssault: 'fire', glitchPulse: true } } }
  const html = (character: Character) => renderToStaticMarkup(<WeaponList c={character} entries={[]} save={() => {}} displayOnly />)
  expect(html(c)).toContain('Ignore 16 fire resistance')
  expect(html(c)).toContain('On a hit, Fortitude DC 34')
  expect(html({ ...c, level: 11 })).not.toContain('Glitch Pulse')
  expect(html({ ...c, level: 11 })).not.toContain('Exploitive Assault')
})

it('tracks High-tech Medic rig capacity and scales medical item mods', () => {
  const c: Character = { ...mechanic, feats: [{ name: 'High-tech Medic', type: 'Class Feat', level: 1 }],
    equipment: [{ name: 'Medpatch', qty: 4, mechanicRigQty: 1, mechanicMedicMods: ['Restorative Boost'] },
      { name: 'Serum', qty: 2, mechanicRigQty: 2 }] }
  const entry: ContentEntry = { id: 'medpatch', name: 'Medpatch', kind: 'item', level: 5, traits: ['Healing'],
    source: 'official', systems: ['sf2e'], description: '', effects: [], updatedAt: 0, data: {} }
  const html = renderToStaticMarkup(<HighTechMedic c={c} save={() => {}} index={0} entry={entry} />)
  expect(html).toContain('max="1"')
  expect(html).toContain('Fast healing 3 for 3 rounds')
  expect(renderToStaticMarkup(<HighTechMedic c={{ ...c, feats: [] }} save={() => {}} index={0} entry={entry} />)).toBe('')
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

it('tracks mounted weapons and armor slots without applying character proficiency or tracking bonuses', () => {
  const weapon = (name: string, hands: number): ContentEntry => ({ id: name, name, kind: 'weapon', level: 4,
    source: 'official', systems: ['sf2e'], traits: ['Tech'], description: '', effects: [], updatedAt: 0,
    data: { weapon_category: 'Martial', weapon_type: 'Ranged', damage: '2d8 fire', range: 60, hands, weapon_tracking: 3, upgrade_slots: 1 } })
  const entries = [weapon('Rifle', 2), weapon('Pistol', 1), { id: 'armor-upgrade', name: 'Armor Upgrade', kind: 'item',
    level: 1, source: 'official', systems: ['sf2e'], traits: [], description: '', effects: [], updatedAt: 0,
    data: { item_subcategory: 'Armor Upgrades' } } satisfies ContentEntry]
  const c: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Powerful',
    feats: [{ name: 'Tactical Drone', type: 'Class Feat', level: 4 }],
    mechanicDroneCustomizations: { Commercial: [{ name: 'Integrated Weapon Mount' }, { name: 'Integrated Weapon Mount' }, { name: 'Upgrade Slot' }] },
    mechanicDroneWeapons: [{ id: 'rifle', name: 'Rifle', potency: 0, striking: 0, runes: [] },
      { id: 'pistol', name: 'Pistol', potency: 0, striking: 0, runes: [] }],
    mechanicDroneArmorUpgrades: ['armor-upgrade'], mechanicDroneKillbotActive: true }
  expect(droneEquipmentCapacity(c)).toEqual({ mounts: 2, armorUpgrades: 1, hands: 0 })
  expect(droneMountedWeapons(c, entries).map(item => item.active)).toEqual([true, false])
  expect(droneWeaponAttack(c, entries, c.mechanicDroneWeapons![0])).toMatchObject({ attack: 14, damage: '2d8+4 fire' })
  expect(droneStats(c)?.attacks[0].damage).toBe('2d8+8 bludgeoning')
  const html = renderToStaticMarkup(<DroneEquipment c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Insufficient weapon mounts')
  expect(html).toContain('Armor Upgrade')
  expect(droneMountedWeapons({ ...c, mechanicDroneCustomizations: { Commercial: [] } }, entries).every(item => !item.active)).toBe(true)
  const handheld: Character = { ...c, mechanicDroneHeldWeaponIds: ['pistol'],
    mechanicDroneCustomizations: { Commercial: [{ name: 'Manual Dexterity' }, { name: 'Integrated Weapon Mount' }] } }
  expect(droneMountedWeapons(handheld, entries).map(item => item.active)).toEqual([false, true])
  expect(renderToStaticMarkup(<DroneEquipment c={handheld} entries={entries} save={() => {}} />)).toContain('Drone hands used: 1/2')
  const visor = { ...entries[2], id: 'visor', name: 'Darkvision Visor' }
  expect(droneStats({ ...c, mechanicDroneArmorUpgrades: ['visor'] }, [...entries, visor])?.senses).toBe('Darkvision')
  expect(droneStats({ ...c, mechanicDroneArmorUpgrades: ['visor'], mechanicDroneCustomizations: { Commercial: [] } }, [...entries, visor])?.senses)
    .toBe('Low-light vision')
  const shielding = { ...entries[2], id: 'shield', name: 'Energy Shielding (Tactical)' }
  const shielded = { ...c, mechanicDroneArmorUpgrades: ['shield'], mechanicDroneEnergyShielding: { shield: 'fire' as const } }
  expect(droneStats(shielded, [...entries, shielding])?.resistances)
    .toContainEqual({ damage: 'fire', value: 10, source: 'Energy Shielding (Tactical)' })
  expect(droneStats({ ...shielded, mechanicDroneCustomizations: { Commercial: [] } }, [...entries, shielding])?.resistances).toEqual([])
  const psychic = { ...entries[2], id: 'psychic', name: 'Psychic Shielding (Advanced)' }
  const protectedDrone = { ...c, mechanicDroneArmorUpgrades: ['psychic'] }
  expect(droneStats(protectedDrone, [...entries, psychic])?.resistances)
    .toContainEqual({ damage: 'mental', value: 15, source: 'Psychic Shielding (Advanced)' })
  expect(droneStats({ ...protectedDrone, mechanicDroneCustomizations: { Commercial: [] } }, [...entries, psychic])?.resistances).toEqual([])
  const defense = { ...entries[2], id: 'defense', name: 'Explosive Defense Unit' }
  expect(droneStats({ ...c, mechanicDroneArmorUpgrades: ['defense'] }, [...entries, defense])?.resistances)
    .toContainEqual({ damage: 'acid, cold, electricity, and fire area damage', value: 2, source: 'Explosive Defense Unit' })
  const sensor = { ...entries[2], id: 'sensor', name: 'Full-spectrum Sensor Suite (Advanced)' }
  const sensingDrone = { ...c, mechanicDroneArmorUpgrades: ['sensor'] }
  expect(droneStats(sensingDrone, [...entries, sensor])).toMatchObject({ scent: true, preciseHearing: true })
  expect(renderToStaticMarkup(<DroneFeatures c={sensingDrone} entries={[...entries, sensor]} save={() => {}} />))
    .toContain('imprecise scent 30 feet, precise hearing 30 feet')
  expect(droneStats({ ...sensingDrone, mechanicDroneCustomizations: { Commercial: [] } }, [...entries, sensor]))
    .toMatchObject({ scent: false, preciseHearing: false })
})

it('tracks an installed drone force field through damage, cooldown, and turn replenishment', () => {
  const field: ContentEntry = { id: 'field', name: 'Force Field (Tactical)', kind: 'item', level: 4,
    source: 'official', systems: ['sf2e'], traits: ['Tech'], description: '', effects: [], updatedAt: 0,
    data: { item_subcategory: 'Armor Upgrades' } }
  expect(droneForceField(field)).toEqual({ hp: 14, recharge: 3, criticalDC: 20 })
  expect(droneForceField({ ...field, name: 'Force Field (Paragon)' })).toEqual({ hp: 42, recharge: 8, criticalDC: 15 })
  let c: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Agile',
    mechanicDroneCustomizations: { Commercial: [{ name: 'Upgrade Slot' }] }, mechanicDroneArmorUpgrades: ['field'] }
  type Props = { children?: ReactNode; type?: string; disabled?: boolean; 'aria-label'?: string
    onChange?: (event: { target: { value: string; checked: boolean } }) => void; onClick?: () => void }
  const find = (node: ReactNode, predicate: (type: unknown, props: Props) => boolean): Props | undefined => {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = find(child, predicate)
        if (found) return found
      }
    } else if (isValidElement<Props>(node)) {
      if (predicate(node.type, node.props)) return node.props
      return find(node.props.children, predicate)
    }
    return undefined
  }
  const render = () => DroneEquipment({ c, entries: [field], save: patch => { c = { ...c, ...patch } } })
  const checkbox = () => find(render(), (type, props) => type === 'input' && props.type === 'checkbox')
  const hp = () => find(render(), (_, props) => props['aria-label'] === 'Drone force field HP')
  const button = (text: string) => find(render(), (type, props) => type === 'button' && props.children === text)
  checkbox()?.onChange?.({ target: { value: '', checked: true } })
  hp()?.onChange?.({ target: { value: '5', checked: false } })
  button('Replenish at start of turn')?.onClick?.()
  expect(c.mechanicDroneForceFields?.field).toEqual({ hp: 8, active: true, coolingDown: false })
  hp()?.onChange?.({ target: { value: '0', checked: false } })
  expect(c.mechanicDroneForceFields?.field).toEqual({ hp: 0, active: false, coolingDown: true })
  expect(checkbox()?.disabled).toBe(true)
  button('10 minutes elapsed')?.onClick?.()
  expect(checkbox()?.disabled).toBe(false)
  const restored = JSON.parse(JSON.stringify(c)) as Character
  expect(restored.mechanicDroneForceFields?.field).toEqual({ hp: 0, active: false, coolingDown: false })
  expect(renderToStaticMarkup(<DroneEquipment c={{ ...c, mechanicDroneCustomizations: { Commercial: [] } }}
    entries={[field]} save={() => {}} />)).not.toContain('Drone force field HP')
})

it('shows glitch compensator protection only while the drone upgrade is active', () => {
  const entry: ContentEntry = { id: 'compensator', name: 'Glitch Compensator', kind: 'item', level: 5,
    source: 'official', systems: ['sf2e'], traits: ['Tech'], description: '', effects: [], updatedAt: 0,
    data: { item_subcategory: 'Armor Upgrades' } }
  const c: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Agile',
    mechanicDroneCustomizations: { Commercial: [{ name: 'Upgrade Slot' }] }, mechanicDroneArmorUpgrades: [entry.id],
    mechanicGlitching: { 'drone:mechanic:drone': 2 } }
  expect(renderToStaticMarkup(<DroneFeatures c={c} entries={[entry]} save={() => {}} />))
    .toContain('Glitch Compensator: critical failures become failures.')
  expect(renderToStaticMarkup(<DroneFeatures c={{ ...c, mechanicDroneCustomizations: { Commercial: [] } }}
    entries={[entry]} save={() => {}} />)).not.toContain('Glitch Compensator: critical failures become failures.')
})

it('uses configured imitated species movement and unarmed attack', () => {
  const c: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Imitator', mechanicDroneSize: 'Small',
    mechanicDroneImitator: { species: 'Wolf', attack: 'Jaws', damageType: 'piercing',
      speed: { Land: 35, Fly: undefined } } }
  const stats = droneStats(c)
  expect(stats?.speed).toEqual({ Land: 35 })
  expect(stats?.attacks[0]).toMatchObject({ name: 'Jaws', damage: '1d4+2 piercing' })
  const html = renderToStaticMarkup(<DroneFeatures c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('Size: Small')
  expect(html).toContain('Wolf')
})

it('applies Modify to drone unarmed attacks without altering character weapons', () => {
  const c: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Surveillance',
    feats: [{ name: 'Explosive Shot', type: 'Class Feat', level: 1 }],
    mechanicWeaponMods: { 'mechanic:drone:Surveillance:0': {
      longRange: true, incapacitant: true, damageType: 'cold', explosiveShot: true,
    } } }
  expect(droneStats(c)?.attacks[0]).toMatchObject({ damage: '1d4 cold', range: 60, splash: '1 cold splash', incapacitant: true })
  const html = renderToStaticMarkup(<DroneFeatures c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('1 cold splash')
  expect(html).toContain('range 60 feet')
  expect(html).toContain('Damage customization: Drone Spark (Surveillance)')
  expect(droneStats({ ...c, level: 4 })?.attacks[0].damage).toBe('1d4 electricity')
})

it('preserves independent Convertible Chassis customizations and gates inactive chassis', () => {
  const c: Character = { ...mechanic, level: 20, subclass: 'Drone', mechanicDroneChassis: 'Agile',
    mechanicDroneSize: 'Small', mechanicDroneCustomizations: { Commercial: [{ name: 'Grounded' }] },
    feats: [{ name: 'Convertible Chassis', type: 'Class Feat', level: 18, choice: 'Tank', slot: 'class:18:0' }] }
  expect(featChoiceOptions('Convertible Chassis', c, [], 'class:18:0')).toEqual(['Imitator', 'Powerful', 'Surveillance', 'Tank'])
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[]} index={0} save={() => {}} />)).toContain('Additional chassis')
  const tank = { ...c, ...switchDroneChassis(c, 'Tank'), mechanicDroneCustomizations: { Commercial: [{ name: 'Flier' }] } }
  expect(droneStats(tank)?.speed.Fly).toBe(20)
  expect(droneStats(tank)?.electricityWeakness).toBe(10)
  const agile = { ...tank, ...switchDroneChassis(tank, 'Agile') }
  expect(droneStats(agile)?.electricityWeakness).toBe(0)
  expect(agile.mechanicDroneSize).toBe('Small')
  expect(droneStats({ ...agile, ...switchDroneChassis(agile, 'Tank') })?.speed.Fly).toBe(20)
  expect(droneStats({ ...tank, feats: [] })).toBeUndefined()
  expect(renderToStaticMarkup(<DroneFeatures c={{ ...tank, feats: [] }} entries={[]} save={() => {}} />))
    .toContain('Select an available chassis')
  const repeated = { ...c, feats: [...c.feats, { name: 'Convertible Chassis', type: 'Class Feat', level: 20, choice: 'Powerful', slot: 'class:20:0' }] }
  expect(featChoiceOptions('Convertible Chassis', repeated, [], 'class:20:0')).not.toContain('Tank')
})

it('scales drone feat actions and removes them when their feats are inactive', () => {
  const c: Character = { ...mechanic, level: 14, subclass: 'Drone', mechanicDroneChassis: 'Powerful', feats: [
    { name: 'High Voltage', type: 'Class Feat', level: 1 },
    { name: 'Rocket Boosters', type: 'Class Feat', level: 10 },
    { name: 'Spinning Blades', type: 'Class Feat', level: 12 },
  ] }
  const html = (character: Character) => renderToStaticMarkup(<DroneFeatures c={character} entries={[]} save={() => {}} />)
  expect(html(c)).toContain('7d6 electricity')
  expect(html(c)).toContain('7d6 bludgeoning')
  expect(html(c)).toContain('Reflex DC 32')
  expect(html(c)).toContain('Spin to Win')
  expect(html({ ...c, level: 9 })).not.toContain('Activate Thrusters')
  expect(html({ ...c, level: 9 })).toContain('5d6 electricity')
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
