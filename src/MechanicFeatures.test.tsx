import { renderToStaticMarkup } from 'react-dom/server'
import { isValidElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { MechanicFeatures, TurretFeatures, mechanicMineDamage, mechanicMineState } from './MechanicFeatures'
import { DroneFeatures } from './DroneFeatures'
import { MinionsSection, MinionsSummary } from './MinionsSection'
import { SensesAndSpeed, SkillsSection } from './SkillsSection'
import { magneticLevitatorsActive, movementSpeeds, resistances, subclassOptions } from './builder'
import { droneCustomizationSlots, droneForceField, droneStats } from './drone'
import type { Character, ContentEntry } from './types'
import { eligibleFeats, featChoiceOptions, featSelectionLevel, featSelectionPrerequisiteChecker } from './builder'
import { turretArrays, turretWeapon } from './mechanicTurret'
import { ArmorList, GrenadeMods, WeaponList } from './GearSection'
import { droneEquipmentCapacity, droneMountedWeapons, droneWeaponAttack } from './droneEquipmentRules'
import { DroneEquipment } from './DroneEquipment'
import { switchDroneChassis } from './droneChassis'
import { FeatChoice } from './FeatChoice'
import { HighTechMedic } from './HighTechMedic'
import { setEnduringMod } from './mechanicEnduring'
import { mapAonHit } from './aon'
import { featPrerequisiteChecker } from './builder'
import { getSettings, updateSettings } from './settings'

const mechanic: Character = {
  id: 'm', systems: ['sf2e'], name: 'Mechanic', level: 10, className: 'Mechanic', subclass: 'Mine',
  abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('omits Troubleshoot configuration from gear while retaining it for the drone', () => {
  const entry: ContentEntry = { id: 'laser', name: 'Laser', kind: 'weapon', source: 'official', systems: ['sf2e'],
    level: 1, traits: ['Tech'], description: '', data: { weapon_type: 'Ranged', weapon_category: 'Simple', damage: '1d6 fire', range: 60 },
    effects: [], updatedAt: 0 }
  const c: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Agile',
    weapons: [{ id: 'laser', name: 'Laser', potency: 0, striking: 0, runes: [] }] }
  const grenade: ContentEntry = { ...entry, id: 'grenade', name: 'Grenade', kind: 'item' }
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[entry]} save={() => {}} />)).not.toContain('Troubleshoot')
  expect(renderToStaticMarkup(<GrenadeMods c={c} grenade={grenade} itemKey="prepared:0" label="Grenade" save={() => {}} />))
    .not.toContain('Troubleshoot')
  expect(renderToStaticMarkup(<DroneFeatures c={c} entries={[]} save={() => {}} />)).toContain('Troubleshoot')
})

it('applies Protect Companion to the drone only under the all-minions rule', () => {
  const previous = getSettings().protectCompanionAll
  try {
    updateSettings({ protectCompanionAll: true })
    const drone: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Agile',
      spells: [{ name: 'Protect Companion', rank: 0, cantrip: true }], activeSpells: ['Protect Companion'] }
    const base = droneStats({ ...drone, activeSpells: [] })!.ac
    expect(droneStats(drone)!.ac).toBe(base + 1)
    expect(renderToStaticMarkup(<DroneFeatures c={drone} entries={[]} save={() => {}} />)).toContain('Protect Companion')
    updateSettings({ protectCompanionAll: false })
    expect(droneStats(drone)!.ac).toBe(base)
  } finally { updateSettings({ protectCompanionAll: previous }) }
})

// Tech Core and Galactic Ancestries selection prerequisites; action Requirements are not feat prerequisites.
const mechanicFeatRules = [
  ['Commercial Customization', 1, 'drone exocortex', 'Drone'],
  ['Critical Explosion', 1, 'mine exocortex', 'Mine'],
  ['Explosive Shot', 1, '', 'Any'],
  ['High-tech Medic', 1, '', 'Any'],
  ['Shielded Turret', 1, 'turret exocortex', 'Turret'],
  ['Spontaneous Crafting', 1, 'Trained in Crafting', 'Any'],
  ['Area Denial Turret', 2, 'turret exocortex', 'Turret'],
  ['Coordinated Fire', 2, 'drone exocortex or turret exocortex', 'Drone,Turret'],
  ['Grenade Specialist', 2, '', 'Any'],
  ['Healing Mines', 2, 'mine exocortex', 'Mine'],
  ['Hunker Down', 2, '', 'Any'],
  ['Instant Deployment', 2, '', 'Any'],
  ['Mobile Deployment', 2, 'mine exocortex or turret exocortex', 'Mine,Turret'],
  ['Double Detonation', 4, 'mine exocortex', 'Mine'],
  ['Energy Neutralizer', 4, '', 'Any'],
  ['Self-destruct', 4, 'turret exocortex', 'Turret'],
  ['Tactical Drone', 4, 'drone exocortex', 'Drone'],
  ['Transmutative Casing', 4, '', 'Any'],
  ['Boosting The Basics', 6, '', 'Any'],
  ['Debilitating Exocortex', 6, '', 'Any'],
  ['Exocortex Experimenter', 6, '', 'Any'],
  ['Maneuvering Mines', 6, 'mine exocortex', 'Mine'],
  ['Tactical Customization', 6, 'Tactical Drone', 'Drone'],
  ['Tactical Team-up', 6, 'turret exocortex', 'Turret'],
  ['Activate Targeting System', 8, '', 'Any'],
  ['Advanced Drone', 8, 'Tactical Drone', 'Drone'],
  ['Auto Target', 8, 'drone exocortex or turret exocortex', 'Drone,Turret'],
  ['Deploy Motion Dampener', 8, '', 'Any'],
  ['Double Deployment', 8, 'mine exocortex', 'Mine'],
  ['Expansive Array', 8, 'turret exocortex', 'Turret'],
  ['Instant Install', 8, '', 'Any'],
  ['Plentiful Grenades', 8, 'Grenade Specialist', 'Any'],
  ['Advanced Customization', 10, 'Advanced Drone', 'Drone'],
  ['Deploy Bunker', 10, 'drone exocortex or turret exocortex', 'Drone,Turret'],
  ['Energy Expulsion', 10, 'turret exocortex', 'Turret'],
  ['Improved Debilitating Exocortex', 10, 'Debilitating Exocortex', 'Any'],
  ['Parallel Deployment', 10, 'Exocortex Experimenter; mine exocortex; turret exocortex', 'None'],
  ['Parallel Reposition', 10, 'Exocortex Experimenter; drone exocortex', 'None'],
  ['Proximity Alert Mines', 10, 'mine exocortex', 'Mine'],
  ['Steady Modifications', 10, '', 'Any'],
  ['Advanced Transmutative Casing', 12, 'Transmutative Casing', 'Any'],
  ['Enhanced Energy Neutralizer', 12, 'Energy Neutralizer', 'Any'],
  ['Glitch Pulse', 12, '', 'Any'],
  ['Impressive Healing Mines', 12, 'Healing Mines', 'Any'],
  ['Advanced Targeting System', 14, 'Activate Targeting System', 'Any'],
  ['Double Debilitating Exocortex', 14, 'Improved Debilitating Exocortex', 'Any'],
  ['Redeploy Munitions', 14, 'mine exocortex', 'Mine'],
  ['Shaped Blast', 14, '', 'Any'],
  ['Superior Drone', 14, 'Advanced Drone', 'Drone'],
  ['Exploitive Assault', 16, '', 'Any'],
  ['Foolproof Debilitations', 16, 'Debilitating Exocortex', 'Any'],
  ['Superior Customization', 16, 'Superior Drone', 'Drone'],
  ['Superior Transmutative Casing', 16, 'Transmutative Casing', 'Any'],
  ['Automated Exocortex', 18, '', 'Any'],
  ['Extra Enduring Mods', 18, '', 'Any'],
  ['Apocalyptic Explosions', 20, '', 'Any'],
  ['Auto Loop', 20, '', 'Any'],
  ['Multitasker', 20, '', 'Any'],
  ['High Voltage', 1, 'drone exocortex', 'Drone'],
  ['Kinetic Resonator', 10, '', 'Any'],
  ['Rocket Boosters', 10, 'drone exocortex', 'Drone'],
  ['Spinning Blades', 12, 'drone exocortex', 'Drone'],
  ['Convertible Chassis', 18, 'drone exocortex', 'Drone'],
] as const
const mechanicFeatCatalog: ContentEntry[] = mechanicFeatRules.map(([name, level, prerequisite]) => ({
  id: `mechanic:${name}`, name, level, kind: 'feat', source: 'official', systems: ['sf2e'],
  traits: ['Mechanic'], data: { prerequisite }, description: '', effects: [], updatedAt: 0,
}))

it.each(mechanicFeatRules)('checks the printed prerequisites and acquisition level for %s', (name, level, _prerequisite, allowed) => {
  const feat = mechanicFeatCatalog.find(feat => feat.name === name)!
  const slot = { category: 'class' as const, level, key: `class:${level}:audit` }
  for (const subclass of ['Drone', 'Mine', 'Turret']) {
    const c: Character = { ...mechanic, level: 20, subclass, rankOverrides: { Crafting: 1 },
      mechanicDroneBaseChassis: 'Powerful',
      feats: mechanicFeatCatalog.filter(entry => entry.level < level && entry.name !== 'Exocortex Experimenter')
        .map(entry => ({ name: entry.name, type: 'Class Feat', level: entry.level, slot: `class:${entry.level}:${entry.name}` })) }
    const expected = allowed === 'Any' || allowed.split(',').includes(subclass)
    const result = featSelectionPrerequisiteChecker(c, mechanicFeatCatalog, slot)(feat)
    expect(result.manual, `${name}, ${subclass}: unresolved prerequisite`).toEqual([])
    expect(result.missing.length === 0, `${name}, ${subclass}`).toBe(expected)
    expect(eligibleFeats(mechanicFeatCatalog, c, slot).includes(feat), `${name}, ${subclass}: picker`).toBe(expected)
    expect(eligibleFeats(mechanicFeatCatalog, c, { ...slot, level: level - 1 }).includes(feat)).toBe(false)
  }
})

it.each(mechanicFeatRules.filter(([, , prerequisite]) => !!prerequisite))(
  'does not waive prerequisite ownership for %s', (name, level) => {
    const feat = mechanicFeatCatalog.find(feat => feat.name === name)!
    const c = { ...mechanic, subclass: undefined, feats: [], rankOverrides: { Crafting: 0 } }
    const result = featPrerequisiteChecker(c, mechanicFeatCatalog, level)(feat)
    expect(result.manual).toEqual([])
    expect(result.missing.length).toBeGreaterThan(0)
  })

it('recognizes repeatable feats described as selectable a second time', () => {
  for (const verb of ['take', 'select']) {
    const feat = mapAonHit({ _id: verb, _source: { category: 'feat', name: 'Expansive Array', level: 8,
      trait: ['Mechanic'], markdown: `**Special** You can ${verb} this feat a second time.` } }, 'sf2e')
    expect(feat?.data.repeatable).toBe(true)
  }
})

it('enforces secondary exocortex choices and their acquisition levels through prerequisite chains', () => {
  const c: Character = { ...mechanic, level: 20, subclass: 'Mine', feats: [
    { name: 'Exocortex Experimenter', type: 'Class Feat', level: 6, slot: 'class:6:0', choice: 'Drone' },
    { name: 'Tactical Drone', type: 'Class Feat', level: 4, slot: 'class:8:0' },
    { name: 'Advanced Drone', type: 'Class Feat', level: 8, slot: 'class:10:0', choice: 'Burly' },
    { name: 'Exocortex Experimenter', type: 'Class Feat', level: 6, slot: 'class:12:0', choice: 'Turret' },
  ] }
  const check = (name: string, level: number, character = c) => featPrerequisiteChecker(character, mechanicFeatCatalog, level)(
    mechanicFeatCatalog.find(feat => feat.name === name)!)
  expect(featSelectionPrerequisiteChecker(c, mechanicFeatCatalog, { category: 'class', level: 5, key: 'class:5:audit' })(
    mechanicFeatCatalog.find(feat => feat.name === 'Commercial Customization')!)).toEqual({ missing: [], manual: [] })
  expect(check('Commercial Customization', 5).missing).toEqual(['drone exocortex'])
  expect(check('Commercial Customization', 6)).toEqual({ missing: [], manual: [] })
  expect(check('Advanced Customization', 12)).toEqual({ missing: [], manual: [] })
  expect(check('Parallel Deployment', 10).missing).toEqual(['turret exocortex'])
  expect(check('Parallel Deployment', 12)).toEqual({ missing: [], manual: [] })
  expect(check('Parallel Reposition', 10)).toEqual({ missing: [], manual: [] })
  expect(check('Advanced Customization', 12, { ...c, feats: c.feats.map(feat =>
    feat.name === 'Tactical Drone' ? { ...feat, slot: 'class:4:0' } : feat) }).missing).toEqual(['drone exocortex'])
  for (const choice of ['Mine', 'invalid', undefined]) {
    expect(check('Commercial Customization', 10, { ...c, feats: c.feats.map(feat =>
      feat.slot === 'class:6:0' ? { ...feat, choice } : feat) }).missing).toEqual(['drone exocortex'])
  }
  const tooEarly = { ...c, feats: c.feats.map(feat => feat.slot === 'class:12:0' ? { ...feat, slot: 'class:10:0' } : feat) }
  expect(check('Parallel Deployment', 12, tooEarly).missing).toEqual(['turret exocortex'])
  expect(check('Parallel Deployment', 12, { ...c, className: 'Inventor' }).missing).toContain('mine exocortex')
  expect(featChoiceOptions('Exocortex Experimenter', c, [], 'class:6:0')).toEqual(['Drone'])
  expect(featChoiceOptions('Exocortex Experimenter', c, [], 'class:12:0')).toEqual(['Turret'])
  const markup = renderToStaticMarkup(<FeatChoice c={c} entries={mechanicFeatCatalog} save={() => {}} index={0} />)
  expect(markup).toBe('')
})

it('checks only selected Healing Mines for Impressive Healing Mines', () => {
  const c: Character = { ...mechanic, level: 12, subclass: 'Turret', feats: [
    { name: 'Exocortex Experimenter', type: 'Class Feat', level: 6, slot: 'class:6:0', choice: 'Mine' },
    { name: 'Healing Mines', type: 'Class Feat', level: 2, slot: 'class:8:0' },
  ] }
  const impressive = mechanicFeatCatalog.find(feat => feat.name === 'Impressive Healing Mines')!
  const slot = { category: 'class' as const, level: 12, key: 'class:12:0' }
  expect(featSelectionPrerequisiteChecker(c, mechanicFeatCatalog, slot)(impressive)).toEqual({ missing: [], manual: [] })
  expect(eligibleFeats(mechanicFeatCatalog, c, slot)).toContain(impressive)
  expect(eligibleFeats(mechanicFeatCatalog, { ...c, feats: c.feats.slice(0, 1) }, slot)).not.toContain(impressive)
  const earlierHealing = { ...c, feats: c.feats.map(feat =>
    feat.name === 'Healing Mines' ? { ...feat, slot: 'class:4:0' } : feat) }
  expect(featSelectionPrerequisiteChecker(earlierHealing, mechanicFeatCatalog, slot)(impressive)).toEqual({ missing: [], manual: [] })
  expect(eligibleFeats(mechanicFeatCatalog, earlierHealing, slot)).toContain(impressive)
  expect(featSelectionPrerequisiteChecker({ ...earlierHealing, feats: earlierHealing.feats.slice(1) },
    mechanicFeatCatalog, slot)(impressive)).toEqual({ missing: [], manual: [] })
  expect(featSelectionPrerequisiteChecker({ ...earlierHealing, feats: [] },
    mechanicFeatCatalog, slot)(impressive).missing).toEqual(['Healing Mines'])
  const healing = mechanicFeatCatalog.find(feat => feat.name === 'Healing Mines')!
  expect(featPrerequisiteChecker(earlierHealing, mechanicFeatCatalog, 4)(healing).missing).toEqual(['mine exocortex'])
  expect(renderToStaticMarkup(<MechanicFeatures c={c} save={() => {}} />)).toContain('Mine capacity')
})

it.each([
  ['Exocortex Experimenter', 6, 12], ['Expansive Array', 8, 8],
] as const)('limits %s to two selections and gates its second selection', (name, firstLevel, secondLevel) => {
  const feat = mechanicFeatCatalog.find(feat => feat.name === name)!
  const c: Character = { ...mechanic, level: 20, subclass: name === 'Expansive Array' ? 'Turret' : 'Mine',
    feats: [{ name, type: 'Class Feat', level: firstLevel, slot: `class:${firstLevel}:0`, choice: 'Drone' }] }
  const slot = { category: 'class' as const, level: secondLevel, key: `class:${secondLevel}:extra:1` }
  if (secondLevel > firstLevel) {
    expect(eligibleFeats([feat], c, { ...slot, level: secondLevel - 1 })).not.toContain(feat)
  }
  expect(eligibleFeats([feat], c, slot)).toContain(feat)
  const twice = { ...c, feats: [...c.feats, { name, type: 'Class Feat', level: firstLevel, slot: slot.key, choice: 'Turret' }] }
  expect(eligibleFeats([feat], twice, { ...slot, level: 20, key: 'class:20:audit' })).not.toContain(feat)
  expect(eligibleFeats([feat], twice, slot)).toContain(feat)
})

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
  const html = (character: Character) => renderToStaticMarkup(<TurretFeatures c={character} entries={[]} save={() => {}} />)
  expect(html(c)).toContain('Clumsy 2 and Suppressed')
  expect(html(c)).toContain('enemies must critically succeed')
  expect(html({ ...c, level: 10 })).toContain('Clumsy 1')
  expect(html({ ...c, level: 5 })).not.toContain('Debilitating Exocortex (Modify)')
})

it('calculates turret defenses and selected array', () => {
  const turret: Character = { ...mechanic, subclass: 'Turret', mechanicTurretArray: 'Laser Beam' }
  const markup = renderToStaticMarkup(<TurretFeatures c={turret} entries={[]} save={() => {}} />)
  expect(markup).toContain('fire; range 60 feet')
  expect(markup).toContain('AC 28; HP 70; broken 35; hardness 15')
  expect(markup).toContain('Fortitude and Reflex +18')
  expect(markup).not.toContain('Manage turret grade, upgrades, and Strikes in Weapons')
  expect(renderToStaticMarkup(<TurretFeatures c={{ ...turret, className: 'Ranger' }} entries={[]} save={() => {}} />)).toBe('')
})

it('offers the homebrew plasma turret with scaling damage and upgrade modules', () => {
  const previous = getSettings()
  const c: Character = { ...mechanic, level: 15, subclass: 'Turret', mechanicTurretArray: 'Plasma' }
  const modules: ContentEntry[] = ['Flaming', 'Shock'].map(name => ({
    id: name, name: `${name} Module (Tactical)`, kind: 'item', systems: ['sf2e'], source: 'official',
    level: 15, traits: [], description: '', data: { item_subcategory: 'Weapon Upgrades' }, effects: [], updatedAt: 0,
  }))
  try {
    updateSettings({ plasmaTurret: true, automaticSfWeaponUpgrades: true })
    expect(turretArrays(c)).toContain('Plasma')
    expect(turretWeapon(c, modules)?.entry.data).toMatchObject({ damage: '3d8 fire', weapon_group: 'Plasma', range: 60 })
    expect(turretWeapon(c, modules)?.attack.upgrades.map(upgrade => upgrade.name)).toEqual([
      'Flaming Module (Tactical)', 'Shock Module (Tactical)',
    ])
    expect(renderToStaticMarkup(<TurretFeatures c={c} entries={modules} save={() => {}} />)).toContain('>Plasma</option>')
    updateSettings({ plasmaTurret: false })
    expect(turretArrays(c)).not.toContain('Plasma')
    expect(turretWeapon(c, modules)).toBeUndefined()
    expect(renderToStaticMarkup(<TurretFeatures c={c} entries={modules} save={() => {}} />)).toContain('Plasma (unavailable)')
  } finally { updateSettings({ plasmaTurret: previous.plasmaTurret, automaticSfWeaponUpgrades: previous.automaticSfWeaponUpgrades }) }
})

it.each([[1, 'Commercial'], [2, 'Tactical'], [4, 'Advanced'], [10, 'Superior'],
  [12, 'Elite'], [16, 'Ultimate'], [19, 'Paragon']] as const)(
  'automatically upgrades the turret grade at level %i', (level, grade) => {
    const c: Character = { ...mechanic, level, subclass: 'Turret', mechanicTurretArray: 'Laser Beam',
      mechanicTurretGrade: 'Commercial' }
    expect(turretWeapon(c, [])?.grade).toBe(grade)
    expect(turretWeapon({ ...c, mechanicTurretGrade: 'Paragon' }, [])?.grade).toBe('Paragon')
  })

it('adds the matching turret module only when a slot is available', () => {
  const previous = getSettings().automaticSfWeaponUpgrades
  const modules: ContentEntry[] = ['Flaming', 'Acid', 'Shock', 'Frost'].flatMap(name => [8, 15].map(level => ({
    id: `${name}-${level}`, name: `${name} Module (${level === 8 ? 'Commercial' : 'Tactical'})`,
    kind: 'item' as const, systems: ['sf2e' as const], source: 'official' as const, level, traits: [],
    description: '', data: { item_subcategory: 'Weapon Upgrades' }, effects: [], updatedAt: 0,
  })))
  modules.push(...[8, 15].map(level => ({
    id: `Loudener-${level}`, name: `Loudener (${level === 8 ? 'Commercial' : 'Tactical'})`,
    kind: 'item' as const, systems: ['sf2e' as const], source: 'official' as const, level, traits: [],
    description: '', data: { item_subcategory: 'Weapon Upgrades' }, effects: [], updatedAt: 0,
  })))
  const c: Character = { ...mechanic, level: 15, subclass: 'Turret', mechanicTurretArray: 'Laser Beam' }
  try {
    updateSettings({ automaticSfWeaponUpgrades: true })
    for (const [array, name] of [['Laser Beam', 'Flaming'], ['Disintegrator', 'Acid'],
      ['Volt Thrower', 'Shock'], ['Zero Emitter', 'Frost']] as const) {
      expect(turretWeapon({ ...c, mechanicTurretArray: array }, modules)?.attack.upgrades.map(item => item.name))
        .toEqual([`${name} Module (Tactical)`])
    }
    expect(turretWeapon({ ...c, level: 7 }, modules)?.attack.upgrades).toEqual([])
    expect(turretWeapon({ ...c, mechanicTurretUpgrades: ['a', 'b', 'c', 'd'] }, modules)?.attack.upgrades).toEqual([])
    expect(renderToStaticMarkup(<WeaponList c={c} entries={modules} save={() => {}} />)).toContain('Flaming Module (Tactical)')
    const thunderclap = { ...c, mechanicTurretArray: 'Thunderclap' as const }
    expect(turretWeapon({ ...thunderclap, level: 7 }, modules)?.attack.upgrades).toEqual([])
    expect(turretWeapon({ ...thunderclap, level: 8 }, modules)?.attack.upgrades.map(item => item.name))
      .toEqual(['Loudener (Commercial)'])
    expect(turretWeapon(thunderclap, modules)?.attack.upgrades.map(item => item.name)).toEqual(['Loudener (Tactical)'])
    expect(turretWeapon({ ...thunderclap, mechanicTurretUpgrades: ['Loudener-8'] }, modules)?.attack.upgrades.map(item => item.name))
      .toEqual(['Loudener (Tactical)'])
    expect(turretWeapon({ ...thunderclap, mechanicTurretUpgrades: ['a', 'b', 'c', 'd'] }, modules)?.attack.upgrades).toEqual([])
    expect(renderToStaticMarkup(<WeaponList c={thunderclap} entries={modules} save={() => {}} displayOnly />))
      .toContain('1d6 sonic')
    updateSettings({ automaticSfWeaponUpgrades: false })
    expect(turretWeapon(c, modules)?.attack.upgrades).toEqual([])
    expect(turretWeapon(thunderclap, modules)?.attack.upgrades).toEqual([])
  } finally { updateSettings({ automaticSfWeaponUpgrades: previous }) }
})

it('offers only active Expansive Arrays and preserves saved choices across level changes', () => {
  const c: Character = { ...mechanic, level: 14, subclass: 'Mine', mechanicTurretArray: 'Void Array',
    mechanicTurretExtraArrays: ['Mental Array', 'Poison Array', 'Vitality Array', 'Void Array'],
    feats: [
      { name: 'Exocortex Experimenter', type: 'Class Feat', level: 6, slot: 'class:6:0', choice: 'Turret' },
      { name: 'Expansive Array', type: 'Class Feat', level: 8, slot: 'class:8:0' },
      { name: 'Expansive Array', type: 'Class Feat', level: 8, slot: 'class:14:0' },
    ] }
  expect(turretArrays(c).slice(-4)).toEqual(c.mechanicTurretExtraArrays)
  expect(turretWeapon(c, [])?.entry.data).toMatchObject({ damage: '3d8 void', weapon_group: 'Void', range: 60 })
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={mechanicFeatCatalog} save={() => {}} index={1} />)).toBe('')
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('data-minion-name="Turret"')
  expect(html).toContain('aria-label="Expansive Array 4"')
  expect(renderToStaticMarkup(<MinionsSummary c={c} entries={[]} />)).toContain('Turret')
  expect(turretArrays({ ...c, level: 10 }).slice(-2)).toEqual(['Mental Array', 'Poison Array'])
  expect(turretWeapon({ ...c, level: 10 }, [])).toBeUndefined()
  expect(renderToStaticMarkup(<TurretFeatures c={{ ...c, level: 5 }} entries={[]} save={() => {}} />)).toBe('')
})

it('applies selected customization feat variants to the drone', () => {
  const c: Character = { ...mechanic, level: 6, subclass: 'Mine', mechanicDroneChassis: 'Powerful',
    feats: [
      { name: 'Exocortex Experimenter', type: 'Class Feat', level: 6, slot: 'class:6:0', choice: 'Drone' },
      { name: 'Commercial Customization', type: 'Class Feat', level: 1, slot: 'class:8:0', choice: 'Flier' },
    ] }
  const later = { ...c, level: 8 }
  expect(droneStats(later)?.speed.Fly).toBe(20)
  expect(droneStats({ ...later, level: 7 })?.speed.Fly).toBeUndefined()
  expect(droneStats({ ...later, feats: later.feats.slice(0, 1) })?.speed.Fly).toBeUndefined()
  expect(droneStats({ ...later, mechanicDroneCustomizations: {
    Commercial: [{ name: 'Grounded' }, { name: '' }, { name: '' }, { name: 'Climber' }],
  } })?.speed.Fly).toBe(20)
  expect(droneStats({ ...later, mechanicDroneCustomizations: {
    Commercial: [{ name: 'Grounded' }, { name: '' }, { name: '' }, { name: 'Climber' }],
  } })?.speed.Climb).toBeUndefined()
})

it.each([[4, 2], [7, 2], [8, 3], [11, 3], [12, 4], [16, 5], [20, 6]])(
  'scales Self-destruct damage at level %i', (level, dice) => {
    const c: Character = { ...mechanic, level, subclass: 'Turret',
      feats: [{ name: 'Self-destruct', type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
    const html = renderToStaticMarkup(<TurretFeatures c={c} entries={[]} save={() => {}} />)
    expect(html).toContain(`${dice}d6 piercing`)
    expect(html).toContain(`${dice}d6 fire`)
    expect(html).toContain('basic Reflex DC')
    expect(renderToStaticMarkup(<TurretFeatures c={{ ...c, level: 3 }} entries={[]} save={() => {}} />)).not.toContain('Self-destruct')
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
  expect(html).not.toContain('Hands used:')
  expect(html).toContain('Mechanic Turret')
  expect(html).toContain('3d8+10 cold')
  for (const displayOnly of [true, false]) {
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).not.toContain('aria-label="Turret grade"')
    expect(markup).not.toContain('Strike from the deployed turret')
    expect(markup).not.toContain('<small>Laser.</small>')
  }
  expect(turretWeapon({ ...c, subclass: 'Mine' }, entries)).toBeUndefined()
  expect(turretWeapon({ ...c, level: 1, mechanicTurretGrade: 'Commercial', mechanicTurretUpgrades: ['a', 'b', 'c'] }, entries)?.weapon.upgrades)
    .toEqual(['a', 'b'])
  expect(turretWeapon({ ...c, mechanicTurretGrade: 'Paragon' }, entries)?.entry.data.upgrade_slots).toBe(5)
  const explosive = { ...c, feats: [{ name: 'Explosive Shot', type: 'Class Feat', level: 1 }],
    mechanicWeaponMods: { 'mechanic:turret': { explosiveShot: true, damageType: 'cold' as const } } }
  expect(renderToStaticMarkup(<WeaponList c={explosive} entries={entries} save={() => {}} displayOnly />))
    .toContain('3 cold splash')
})

it('alphabetizes the turret with other offense weapons', () => {
  const c: Character = { ...mechanic, subclass: 'Turret', mechanicTurretArray: 'Laser Beam', weapons: [
    { id: 'z', name: 'Zeta Gun', potency: 0, striking: 0, runes: [] },
    { id: 'a', name: 'Alpha Gun', potency: 0, striking: 0, runes: [] },
  ] }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} displayOnly />)
  expect(markup.indexOf('Alpha Gun')).toBeLessThan(markup.indexOf('Mechanic Turret'))
  expect(markup.indexOf('Mechanic Turret')).toBeLessThan(markup.indexOf('Zeta Gun'))
})

it('applies Magnetic Levitators only while its armor is worn', () => {
  const c: Character = { ...mechanic, armors: [{ id: 'armor', name: 'Armor', potency: 0, resilient: 0, runes: [], worn: true }],
    mechanicArmorMods: { armor: { magneticLevitators: true } } }
  expect(magneticLevitatorsActive(c, [])).toBe(true)
  expect(movementSpeeds(c, [])).toContainEqual({ name: 'Fly', feet: 10, source: 'Magnetic Levitators' })
  expect(renderToStaticMarkup(<SensesAndSpeed c={c} entries={[]} save={() => {}} />))
    .toContain(' (hover)')
  expect(movementSpeeds({ ...c, armors: [{ ...c.armors![0], worn: false }] }, [])).not.toContainEqual(
    expect.objectContaining({ source: 'Magnetic Levitators' }))
  const drone: Character = { ...mechanic, subclass: 'Drone', mechanicDroneChassis: 'Powerful',
    mechanicArmorMods: { 'mechanic:drone': { magneticLevitators: true } } }
  expect(droneStats(drone)?.speed.Fly).toBe(10)
  expect(renderToStaticMarkup(<DroneFeatures c={drone} entries={[]} save={() => {}} />)).toContain('Land Speed gains hover')
  expect(droneStats({ ...drone, mechanicDroneCustomizations: { Commercial: [{ name: 'Flier' }] } })?.speed.Fly).toBe(20)
})

it('improves basic mods on mines, worn armor, and drone attacks with Boosting The Basics', () => {
  const feat = { name: 'Boosting The Basics', type: 'Class Feat', level: 6 }
  const c: Character = { ...mechanic, feats: [feat],
    armors: [{ id: 'armor', name: 'Armor', potency: 0, resilient: 0, runes: [], worn: true }],
    mechanicArmorMods: { armor: { magneticLevitators: true } },
    mechanicMines: { carried: 1, deployed: 1 },
    mechanicDeployedMines: [{ bigBoom: true, bunkerBuster: true, incapacitant: true }] }
  expect(mechanicMineDamage(c, c.mechanicDeployedMines![0]).radius).toBe(25)
  expect(movementSpeeds(c, [])).toContainEqual({ name: 'Fly', feet: 20, source: 'Magnetic Levitators' })
  const html = renderToStaticMarkup(<MechanicFeatures c={c} save={() => {}} />)
  expect(html).toContain('+10 damage to objects')
  expect(html).toContain('critically failing their save become frightened 1')
  const drone: Character = { ...c, subclass: 'Drone', mechanicDroneChassis: 'Surveillance',
    mechanicArmorMods: { 'mechanic:drone': { magneticLevitators: true } },
    mechanicWeaponMods: { 'mechanic:drone:Surveillance:0': { longRange: true } } }
  expect(droneStats(drone)?.speed.Fly).toBe(20)
  expect(droneStats(drone)?.attacks[0].range).toBe(90)
  expect(mechanicMineDamage({ ...c, level: 5 }, { bigBoom: true }).radius).toBe(15)
})

it('shows Critical Explosion persistent damage by mine damage type and save result', () => {
  const c: Character = { ...mechanic, feats: [{ name: 'Critical Explosion', type: 'Class Feat', level: 1 }],
    mechanicMines: { carried: 0, deployed: 2 },
    mechanicDeployedMines: [{}, { baseDamage: 'piercing' }] }
  const html = renderToStaticMarkup(<MechanicFeatures c={c} save={() => {}} />)
  expect(html).toContain('1 persistent fire damage; on a critical failure, 4 persistent damage instead')
  expect(html).toContain('1 persistent bleed damage; on a critical failure, 4 persistent damage instead')
  expect(renderToStaticMarkup(<MechanicFeatures c={{ ...c, level: 1, feats: [] }} save={() => {}} />))
    .not.toContain('Critical Explosion:')
  const healing = { ...c, feats: [...c.feats, { name: 'Healing Mines', type: 'Class Feat', level: 2 }],
    mechanicMines: { carried: 0, deployed: 1 }, mechanicDeployedMines: [{ healing: true }] }
  expect(renderToStaticMarkup(<MechanicFeatures c={healing} save={() => {}} />)).not.toContain('Critical Explosion:')
})

it('shows Shielded Turret cover when selected', () => {
  const c: Character = { ...mechanic, subclass: 'Turret', feats: [{ name: 'Shielded Turret', type: 'Class Feat', level: 1 }] }
  expect(renderToStaticMarkup(<TurretFeatures c={c} entries={[]} save={() => {}} />)).toContain('provides standard cover')
  expect(renderToStaticMarkup(<TurretFeatures c={{ ...c, feats: [] }} entries={[]} save={() => {}} />)).not.toContain('provides standard cover')
})

it('shows Apocalyptic Explosions for deployed mines only after the feat is active', () => {
  const c: Character = { ...mechanic, level: 20, feats: [{ name: 'Apocalyptic Explosions', type: 'Class Feat', level: 20 }],
    mechanicMines: { carried: 0, deployed: 1 }, mechanicDeployedMines: [{}] }
  expect(renderToStaticMarkup(<MechanicFeatures c={c} save={() => {}} />)).toContain('Apocalyptic Explosions doubles the area.')
  expect(renderToStaticMarkup(<MechanicFeatures c={{ ...c, level: 19 }} save={() => {}} />)).not.toContain('Apocalyptic Explosions doubles')
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
  expect(html).not.toContain('<option>cold</option>')
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
  expect(html(c)).not.toContain('Transmutative Casing')
  expect(html(c)).not.toContain('Enduring Mod')
})

it('shows feat-gated resistance bypass and Glitch Pulse on weapons', () => {
  const c: Character = { ...mechanic, level: 16, subclass: 'Turret', mechanicTurretArray: 'Laser Beam',
    feats: [{ name: 'Glitch Pulse', type: 'Class Feat', level: 12 }, { name: 'Exploitive Assault', type: 'Class Feat', level: 16 }],
    mechanicWeaponMods: { 'mechanic:turret': { exploitiveAssault: 'fire', glitchPulse: true } } }
  const html = (character: Character) => renderToStaticMarkup(<WeaponList c={character} entries={[]} save={() => {}} displayOnly />)
  expect(html(c)).not.toContain('Glitch Pulse')
  expect(html(c)).not.toContain('Exploitive Assault')
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
  expect(html).not.toContain('Damage customization: Drone Spark (Surveillance)')
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
  expect(featSelectionLevel(feat, c, [feat], 'class', { ...slot, level: 14 })).toBe(14)
  expect(featSelectionLevel(feat, { ...c, feats: [] }, [feat], 'class', slot)).toBe(8)
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[{ ...feat, data: { repeatable: true } }]} save={() => {}} index={0} />)).toBe('')
  const twice = { ...c, feats: [...c.feats, { name: feat.name, type: 'Class Feat', level: 8, slot: 'class:14:0' }] }
  expect(eligibleFeats([feat], twice, { ...slot, level: 16, key: 'class:16:0' })).not.toContainEqual(feat)
})
