import { activeFeatsNamed, proficiencyBonus } from './builder'
import type { Character, ContentEntry, DroneCustomizationGrade } from './types'

type Customization = {
  name: string
  description: string
  repeatable?: boolean
  choices?: readonly string[]
}

const SKILLS = ['Acrobatics', 'Arcana', 'Athletics', 'Computers', 'Crafting', 'Deception', 'Diplomacy',
  'Intimidation', 'Medicine', 'Nature', 'Occultism', 'Performance', 'Piloting', 'Religion', 'Society',
  'Stealth', 'Survival', 'Thievery'] as const

export const DRONE_CUSTOMIZATIONS: Record<DroneCustomizationGrade, readonly Customization[]> = {
  Commercial: [
    { name: 'Aquatic Adaptation', description: 'Swim Speed 20 feet.' },
    { name: 'Armored Plates', description: '+1 item bonus to AC; +2 for a superior drone.' },
    { name: 'Artificial Personality', description: 'Can attempt Charisma checks and speak Common.' },
    { name: 'Cameras', description: 'View through the drone using a comm unit.' },
    { name: 'Climber', description: 'Climb Speed 20 feet.' },
    { name: 'Flier', description: 'Fly Speed 20 feet.' },
    { name: 'Grounded', description: 'Removes electricity weakness.' },
    { name: 'Integrated Weapon Mount', description: 'One weapon mount; two-handed weapons require two mounts.', repeatable: true },
    { name: 'Light Mounts', description: 'Switchable bright light 20 feet, dim light another 20 feet.' },
    { name: 'Linguistic Upload', description: 'Two additional languages; requires Artificial Personality or Sapient.' },
    { name: 'Manual Dexterity', description: 'Two limbs can perform manipulate actions as hands.' },
    { name: 'Mount', description: 'Gains the mount ability.' },
    { name: 'Nightvision Sensors', description: 'Darkvision.' },
    { name: 'Olfactory Receptors', description: 'Imprecise scent 30 feet.' },
    { name: 'Skill Module', description: 'Trained in one selected skill.', repeatable: true, choices: SKILLS },
    { name: 'Speakers', description: 'Speak through the drone.' },
    { name: 'Upgrade Slot', description: 'One armor upgrade slot.' },
  ],
  Tactical: [
    { name: 'Assistant', description: '+1 circumstance to a shared trained skill when drone is within reach.', choices: SKILLS },
    { name: 'Biotech Healing Circuit', description: 'Can receive healing like a living creature.' },
    { name: 'Burrower', description: 'Burrow Speed 20 feet.' },
    { name: 'Echolocation', description: 'Precise hearing 30 feet.' },
    { name: 'Expertise Module', description: 'Expert in a selected trained skill.', repeatable: true, choices: SKILLS },
    { name: 'Hardened Chassis', description: '+2 HP per level.' },
    { name: 'High Speed', description: 'Increase one Speed to 40 feet.', choices: ['Land', 'Climb', 'Swim', 'Fly', 'Burrow'] },
    { name: 'Network', description: 'Integrated hacking toolkit; use Computers through adjacent drone.' },
    { name: 'Share Charge', description: 'Power battery-operated items from drone reserves.' },
  ],
  Advanced: [
    { name: 'Emergency Repair', description: 'Once per 10 minutes, repair HP equal to level (twice level if superior).' },
    { name: 'Maneuver Module', description: '+1 circumstance to two selected maneuvers; +2 if superior.', repeatable: true,
      choices: ['Disarm', 'Grapple', 'Reposition', 'Shove', 'Trip'] },
    { name: 'Optimized Avoidance', description: 'No damage on successful selected save.', repeatable: true, choices: ['Fortitude', 'Reflex', 'Will'] },
    { name: 'Recharge', description: 'Recharge a touched battery; drone is clumsy 1 for 1 round.' },
    { name: 'Resistant Panels', description: 'Resistance equal to half level rounded up.', repeatable: true,
      choices: ['acid', 'bludgeoning', 'cold', 'fire', 'piercing', 'slashing', 'sonic'] },
    { name: 'Sapient', description: 'Intelligence +0; can use Intelligence, Wisdom, and Charisma actions, speaks Common, loses mental immunity.' },
  ],
  Superior: [
    { name: 'Agility Optimization', description: 'Movement does not trigger reactions; Acrobatics increases to expert or master.' },
    { name: 'Camoflage', description: 'Sneak while observed in a chosen biome; Stealth increases to expert or master.' },
    { name: 'Glow Up', description: 'Charisma +3; Diplomacy increases to expert or master. Requires Artificial Personality or Sapient.' },
    { name: 'Speedster', description: '+10 status bonus to all Speeds.' },
  ],
}

export function droneCustomizationSlots(c: Character) {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e') || c.subclass !== 'Drone') return undefined
  const count = (name: string) => Math.min(3, activeFeatsNamed(c, name).length)
  const tactical = count('Tactical Drone') > 0
  const advanced = tactical && count('Advanced Drone') > 0
  const superior = advanced && count('Superior Drone') > 0
  return {
    Commercial: 3 + count('Commercial Customization'),
    Tactical: tactical ? 2 + count('Tactical Customization') : 0,
    Advanced: advanced ? 2 + count('Advanced Customization') : 0,
    Superior: superior ? 2 + count('Superior Customization') : 0,
  }
}

  const CHASSIS = {
    Agile: { hp: 6, str: 1, dex: 3, con: 2, int: -4, wis: 2, cha: -1, skill: 'Stealth', size: 'Small or Medium',
      speed: { Land: 40, Climb: 20 }, senses: 'Low-light vision', attacks: [{ name: 'Blade', die: 6, damage: 'slashing', finesse: true }] },
    Imitator: { hp: 4, str: 2, dex: 2, con: 2, int: -4, wis: 2, cha: 1, skill: 'Deception', size: 'As imitated creature',
      speed: {}, senses: 'Low-light vision', attacks: [{ name: 'Imitated attack', die: 4, damage: 'varies', finesse: true }] },
    Powerful: { hp: 8, str: 3, dex: 1, con: 2, int: -4, wis: 2, cha: -1, skill: 'Intimidation', size: 'Medium or Large',
      speed: { Land: 30 }, senses: 'Low-light vision', attacks: [{ name: 'Hydraulic fist', die: 8, damage: 'bludgeoning', finesse: false }, { name: 'Serrated blade', die: 8, damage: 'slashing', finesse: false }] },
    Surveillance: { hp: 4, str: 0, dex: 3, con: 1, int: -4, wis: 3, cha: 0, skill: 'Stealth', size: 'Small',
      speed: { Land: 25, Fly: 20 }, senses: 'Darkvision', attacks: [{ name: 'Spark', die: 4, damage: 'electricity', finesse: true, ranged: true }] },
    Tank: { hp: 10, str: 2, dex: 1, con: 3, int: -4, wis: 2, cha: -1, skill: 'Intimidation', size: 'Medium or Large',
      speed: { Land: 20 }, senses: 'Low-light vision', attacks: [{ name: 'Battering ram', die: 6, damage: 'bludgeoning', finesse: false }] },
  } as const

  const SKILL_ABILITIES: Record<string, 'str' | 'dex' | 'int' | 'wis' | 'cha'> = {
    Acrobatics: 'dex', Arcana: 'int', Athletics: 'str', Computers: 'int', Crafting: 'int', Deception: 'cha',
    Diplomacy: 'cha', Intimidation: 'cha', Medicine: 'wis', Nature: 'wis', Occultism: 'int', Performance: 'cha',
    Piloting: 'dex', Religion: 'wis', Society: 'int', Stealth: 'dex', Survival: 'wis', Thievery: 'dex',
  }

  export function droneStats(c: Character, entries: ContentEntry[] = []) {
    const slots = droneCustomizationSlots(c)
    const chassis = c.mechanicDroneChassis && CHASSIS[c.mechanicDroneChassis]
    if (!slots || !chassis) return undefined
    if (c.mechanicDroneBaseChassis && c.mechanicDroneChassis !== c.mechanicDroneBaseChassis
      && !activeFeatsNamed(c, 'Convertible Chassis').some(feat => feat.choice === c.mechanicDroneChassis)) return undefined
    const tactical = slots.Tactical > 0
    const advance = tactical && activeFeatsNamed(c, 'Advanced Drone')[0]?.choice
    const advanced = advance === 'Burly' || advance === 'Deft'
    const specs = advanced ? [...new Set(activeFeatsNamed(c, 'Superior Drone').map(feat => feat.choice)
      .filter((choice): choice is string => !!choice && ['Ambusher', 'Bully', 'Daredevil', 'Racer', 'Tracker', 'Wrecker'].includes(choice)))].slice(0, 3) : []
    const superior = specs.length > 0
    const selected = (Object.keys(slots) as DroneCustomizationGrade[])
      .flatMap(grade => (c.mechanicDroneCustomizations?.[grade] ?? []).slice(0, slots[grade]))
    const has = (name: string) => selected.some(item => item.name === name)
    const mods: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number> = { str: chassis.str, dex: chassis.dex, con: chassis.con, int: chassis.int, wis: chassis.wis, cha: chassis.cha }
    if (tactical) for (const ability of ['str', 'dex', 'con', 'wis'] as const) mods[ability]++
    if (advanced) {
      mods.str += advance === 'Burly' ? 2 : 1
      mods.dex += advance === 'Deft' ? 2 : 1
      mods.con++
      mods.wis++
    }
    if (superior) { mods.dex++; mods.int += 2 }
    if (specs.includes('Ambusher') || specs.includes('Daredevil')) mods.dex += Number(specs.includes('Ambusher')) + Number(specs.includes('Daredevil'))
    if (specs.includes('Bully')) { mods.str++; mods.cha += 3 }
    if (specs.includes('Racer')) mods.con++
    if (specs.includes('Tracker')) mods.wis++
    if (specs.includes('Wrecker')) mods.str++
    if (has('Sapient')) mods.int = 0
    if (has('Glow Up') && (has('Artificial Personality') || has('Sapient'))) mods.cha = 3
    const ranks: Record<string, number> = { Acrobatics: 1, Athletics: 1, [chassis.skill]: 1 }
    if (tactical) for (const skill of ['Intimidation', 'Stealth', 'Survival']) ranks[skill] = ranks[skill] ? 2 : 1
    if (advance === 'Burly') ranks.Athletics = 2
    if (advance === 'Deft') ranks.Acrobatics = 2
    const bump = (skill: string) => { ranks[skill] = (ranks[skill] ?? 0) >= 2 ? 3 : 2 }
    if (specs.includes('Ambusher')) bump('Stealth')
    if (specs.includes('Bully')) { bump('Athletics'); bump('Intimidation') }
    if (specs.includes('Daredevil')) ranks.Acrobatics = 3
    if (specs.includes('Tracker')) bump('Survival')
    if (specs.includes('Wrecker')) ranks.Athletics = 3
    for (const item of selected) if (item.name === 'Skill Module' && item.choice && SKILL_ABILITIES[item.choice] && !ranks[item.choice]) ranks[item.choice] = 1
    for (const item of selected) if (item.name === 'Expertise Module' && item.choice && ranks[item.choice] === 1) ranks[item.choice] = 2
    if (has('Agility Optimization')) bump('Acrobatics')
    if (has('Camoflage')) bump('Stealth')
    if (has('Glow Up') && (has('Artificial Personality') || has('Sapient'))) bump('Diplomacy')
    const unarmored = specs.some(spec => spec === 'Ambusher' || spec === 'Daredevil') ? 2 : 1
    const saveRank = superior ? 3 : tactical ? 2 : 1
    const speed: Record<string, number> = c.mechanicDroneChassis === 'Imitator'
      ? Object.fromEntries(Object.entries(c.mechanicDroneImitator?.speed ?? {})
        .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value > 0))
      : { ...chassis.speed }
    if (has('Aquatic Adaptation')) speed.Swim = Math.max(speed.Swim ?? 0, 20)
    if (has('Climber')) speed.Climb = Math.max(speed.Climb ?? 0, 20)
    if (has('Flier')) speed.Fly = Math.max(speed.Fly ?? 0, 20)
    if (c.mechanicArmorMods?.['mechanic:drone']?.magneticLevitators) speed.Fly = Math.max(speed.Fly ?? 0, 10)
    if (has('Burrower')) speed.Burrow = Math.max(speed.Burrow ?? 0, 20)
    if (activeFeatsNamed(c, 'Rocket Boosters').length) speed.Fly = (speed.Fly ?? 0) >= 20 ? speed.Fly + 5 : 20
    for (const item of selected) if (item.name === 'High Speed' && item.choice && speed[item.choice]) speed[item.choice] = Math.max(speed[item.choice], 40)
    for (const name of Object.keys(speed)) {
      if (has('Speedster') || specs.includes('Racer') && c.mechanicDroneRacerSpeed === name) speed[name] += 10
    }
    const hp = chassis.hp + (6 + mods.con + (has('Hardened Chassis') ? 2 : 0)) * c.level
    const ac = 10 + mods.dex + proficiencyBonus(unarmored, c.level) + (has('Armored Plates') ? superior ? 2 : 1 : 0)
    const attacks = chassis.attacks.map(attack => {
      const ranged = 'ranged' in attack && attack.ranged
      const mod = ranged || attack.finesse && mods.dex > mods.str ? mods.dex : mods.str
      const dice = superior ? 3 : tactical ? 2 : 1
      const flat = (ranged ? 0 : mods.str + (advanced ? advance === 'Burly' ? superior ? 6 : 3 : superior ? 4 : 2 : 0))
        + (c.mechanicDroneKillbotActive ? 2 * dice : 0)
      return { name: c.mechanicDroneChassis === 'Imitator' && c.mechanicDroneImitator?.attack || attack.name,
        attack: mod + proficiencyBonus(superior ? 2 : 1, c.level),
        damage: `${dice}d${attack.die}${flat > 0 ? `+${flat}` : flat < 0 ? flat : ''} ${c.mechanicDroneChassis === 'Imitator' && c.mechanicDroneImitator?.damageType || attack.damage}` }
    })
    const armorUpgradeActive = has('Upgrade Slot') && entries.some(entry => entry.id === c.mechanicDroneArmorUpgrades?.[0]
      && !entry.deleted && entry.kind === 'item' && entry.systems.includes('sf2e')
      && entry.data.item_subcategory === 'Armor Upgrades' && entry.name === 'Darkvision Visor')
    return { chassis, mods, ranks, speed, hp, ac, attacks, specs, superior,
      perception: mods.wis + proficiencyBonus(saveRank, c.level),
      fortitude: mods.con + proficiencyBonus(specs.includes('Racer') ? 4 : saveRank, c.level),
      reflex: mods.dex + proficiencyBonus(saveRank, c.level), will: mods.wis + proficiencyBonus(saveRank, c.level),
      skills: Object.entries(ranks).filter(([name]) => SKILL_ABILITIES[name])
        .map(([name, rank]) => ({ name, rank, bonus: mods[SKILL_ABILITIES[name]] + proficiencyBonus(rank, c.level) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      electricityWeakness: has('Grounded') ? 0 : Math.ceil(c.level / 2),
      senses: has('Nightvision Sensors') || armorUpgradeActive ? 'Darkvision' : chassis.senses,
    }
}
