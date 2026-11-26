import type { Character, ContentEntry, HardlightGrade, OwnedArmor } from './types'
import { BONY_PLATES_DESCRIPTION } from './grantedArmor'

export function removeColdIronTusks(c: Character): Character {
  const feats = c.feats.filter(feat => feat.name !== 'Cold Iron Tusks')
  const entryIds = c.entryIds.filter(id => id !== 'homebrew:cold-iron-tusks')
  return feats.length === c.feats.length && entryIds.length === c.entryIds.length ? c : { ...c, feats, entryIds }
}

export const GRAPPLING_RUNE: ContentEntry = {
  id: 'homebrew:grappling-rune', systems: ['pf2e'], kind: 'item', source: 'homebrew',
  name: 'Grappling', level: 5, traits: ['Magical', 'Rare'],
  description: 'Etched loops and interlocking lines help this weapon catch and hold foes. Price 140 gp. Usage: etched onto a melee weapon.\n\nThe weapon gains the grapple trait. You can use it to Grapple without a free hand, using its reach and adding its item bonus to attack rolls as an item bonus to the Athletics check. On a critical failure, you can drop the weapon to take the effects of a failure instead.\n\nIf the weapon normally has the grapple trait, you can attempt to Grapple the target as a reaction when you critically hit it with this weapon.',
  data: { item_category: 'Runes', item_subcategory: 'Weapon Property Runes', usage: 'etched onto a melee weapon',
    price: 14000, bulk: 0, rarity: 'rare', sourceBook: 'Homebrew' },
  effects: [], updatedAt: 1,
}

export const DISARMING_RUNE: ContentEntry = {
  ...GRAPPLING_RUNE, id: 'homebrew:disarming-rune', name: 'Disarming',
  description: "Curved markings guide this weapon around an opponent's grip. Price 140 gp. Usage: etched onto a melee weapon.\n\nThe weapon gains the disarm trait. Attempt Disarm with the weapon's reach without needing a free hand, and add its item bonus to attack rolls to the Athletics check. On a critical failure, you may drop the weapon to take a failure instead.",
}

export const SHOVING_RUNE: ContentEntry = {
  ...GRAPPLING_RUNE, id: 'homebrew:shoving-rune', name: 'Shoving',
  description: "Forceful markings help drive opponents back. Price 140 gp. Usage: etched onto a melee weapon.\n\nThe weapon gains the shove trait. Attempt to Shove with the weapon's reach without needing a free hand, and add its item bonus to attack rolls to the Athletics check. On a critical failure, you may drop the weapon to take a failure instead.",
}

export const PARRYING_RUNE: ContentEntry = {
  ...GRAPPLING_RUNE, id: 'homebrew:parrying-rune', name: 'Parrying',
  description: 'Defensive markings guide this weapon into a guarding position. Price 140 gp. Usage: etched onto a melee weapon.\n\nThe weapon gains the parry trait. If you are trained or better with this weapon, you can spend one action while wielding it to gain a +1 circumstance bonus to AC until the start of your next turn. This bonus does not stack with other circumstance bonuses to AC.',
}

export const THROWING_RUNE: ContentEntry = {
  ...GRAPPLING_RUNE, id: 'homebrew:throwing-rune', name: 'Throwing',
  description: 'Usage: etched onto a melee weapon. The weapon gains thrown 20 feet when wielded in one hand, or thrown 10 feet when wielded in two hands. A longer existing thrown range is unchanged. This rune does not return the weapon.',
}

export const GRAPPLING_MODULE: ContentEntry = {
  id: 'homebrew:grappling-module', systems: ['sf2e'], kind: 'item', source: 'homebrew',
  name: 'Grappling Module', level: 8, traits: ['Tech'],
  description: 'This weapon upgrade grants the grapple trait.',
  data: { item_category: 'Upgrades', item_subcategory: 'Weapon Upgrades', usage: 'installed in a melee weapon',
    price: 4500, bulk: 0.1, rarity: 'common', sourceBook: 'Homebrew' },
  effects: [], updatedAt: 1,
}

export const SHOVING_MODULE: ContentEntry = {
  ...GRAPPLING_MODULE, id: 'homebrew:shoving-module', name: 'Shoving Module',
  description: 'This weapon upgrade grants the shove trait.',
}

export const KILLERS_BELT_MAJOR: ContentEntry = {
  id: 'homebrew:killers-belt-major', systems: ['pf2e'], kind: 'item', source: 'homebrew',
  name: "Killer's Belt (Major)", level: 17, traits: ['Invested', 'Magical'],
  description: "Blood-red rubies set in this imposing belt project a fearsome presence. Price 15,000 gp.\n\nWhile wearing and investing this belt, you gain a +3 item bonus to Intimidation checks.\n\nActivate: Bleeding Rubies (one action, manipulate). Frequency: once per day. Requirements: You have a free hand, and your last action dealt damage to an enemy with a Strike or spell attack roll. Crush one of the belt's rubies to cause that enemy to take 3d6 persistent bleed damage. The ruby returns after 24 hours.",
  data: { item_category: 'Worn Items', item_subcategory: 'Other Worn Items', usage: 'worn belt',
    bulk: 0.1, price: 1500000, rarity: 'common', skill: 'Intimidation', sourceBook: 'Homebrew',
    url: 'https://2e.aonprd.com/Equipment.aspx?ID=3968' },
  effects: [{ type: 'bonus', target: 'Intimidation', bonusType: 'item', value: 3 }], updatedAt: 1,
}

export const HUNTERS_ARROWHEADS: ContentEntry[] = [
  { grade: 'Greater', bonus: 2, level: 9, price: 65000 },
  { grade: 'Major', bonus: 3, level: 17, price: 1500000 },
].map(({ grade, bonus, level, price }) => ({
  id: `homebrew:hunters-arrowhead-${grade.toLowerCase()}`, systems: ['pf2e'], kind: 'item', source: 'homebrew',
  name: `Hunter's Arrowhead (${grade})`, level, traits: ['Invested', 'Magical', 'Rare'],
  description: `This stronger charm is a religious symbol of Ketephys. Wear it as a pendant or carry it in a pocket or quiver. Against a creature you have designated with Hunt Prey, gain a +${bonus} item bonus to Survival checks and attack rolls. This item bonus does not stack with weapon potency or other item bonuses.\n\nActivate: Guided Shot (reaction, concentrate). Frequency once per day. Trigger You would miss with a bow attack. Effect Gain a +2 circumstance bonus to that attack roll, potentially turning the miss into a hit. Track this activation manually.`,
  data: { item_category: 'Worn Items', item_subcategory: 'Other Worn Items', usage: 'worn or carried',
    bulk: 0, price, rarity: 'rare', skill: 'Survival', sourceBook: 'Homebrew',
    url: 'https://2e.aonprd.com/Equipment.aspx?ID=2343' },
  effects: [], updatedAt: 1,
}))

export const HAFT_STRIKER_WEAPON: ContentEntry = {
  id: 'supplemental:haft-striker-stance',
  systems: ['pf2e'],
  kind: 'weapon',
  source: 'official',
  name: 'Haft Striker Stance',
  level: 0,
  traits: ['Agile', 'Finesse'],
  description: 'You treat the haft of your wielded weapon as a simple weapon dealing 1d4 bludgeoning damage. The haft is in the club group and has the agile and finesse traits.',
  data: { weapon_category: 'Simple', weapon_group: 'Club', weapon_type: 'Melee', damage: '1d4 bludgeoning', hands: 1 },
  effects: [],
  updatedAt: 1,
}

export const OVERSIZED_THROW: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:oversized-throw', name: 'Oversized Throw',
  traits: ['Thrown'],
  description: 'While raging with a hand free, hurl an object your size or one size smaller that you can lift. It takes the damage it would deal on a successful Strike, regardless of the result. The attack takes two actions and has a 20-foot range increment. Damage dice increase with weapon specialization.',
  data: { weapon_category: 'Simple', weapon_type: 'Ranged', damage: '1d10 bludgeoning', range: 20, hands: '1', actions: 'Two Actions', url: 'https://2e.aonprd.com/Feats.aspx?ID=5818' },
}

export const ATTACHED_WEAPONS: ContentEntry[] = [
  { ...HAFT_STRIKER_WEAPON, id: 'supplemental:bayonet', name: 'Bayonet', traits: ['Agile', 'Attached', 'Finesse'],
    data: { weapon_category: 'Martial', weapon_group: 'Knife', weapon_type: 'Melee', damage: '1d4 piercing', hands: '1 or 2' } },
  { ...HAFT_STRIKER_WEAPON, id: 'supplemental:reinforced-stock', name: 'Reinforced Stock', traits: ['Attached', 'Finesse', 'Two-Hand d8'],
    data: { weapon_category: 'Martial', weapon_group: 'Club', weapon_type: 'Melee', damage: '1d4 bludgeoning', hands: '1 or 2' } },
]

export const SHIELD_BASH: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:shield-bash', name: 'Shield Bash', traits: [],
  description: 'Strike with your shield for 1d4 bludgeoning damage. Shield Bash cannot have weapon runes.',
  data: { weapon_category: 'Martial', weapon_group: 'Shield', weapon_type: 'Melee',
    damage: '1d4 bludgeoning', hands: 1, url: 'https://2e.aonprd.com/Weapons.aspx?ID=395' },
}

export const FIST: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:fist', name: 'Fist',
  traits: ['Agile', 'Finesse', 'Nonlethal', 'Unarmed'],
  description: 'A basic fist unarmed attack deals 1d4 bludgeoning damage.',
  data: { weapon_category: 'Unarmed', weapon_group: 'Brawling', weapon_type: 'Melee', damage: '1d4 bludgeoning' },
}

export const IRON_FIST: ContentEntry = {
  ...FIST, id: 'supplemental:iron-fist', name: 'Iron Fist',
  traits: ['Agile', 'Finesse', 'Shove', 'Unarmed'],
  description: 'Iron Fists removes the nonlethal trait from your fist attacks and adds the shove trait.',
}

export const CAIRN_FIST: ContentEntry = {
  ...FIST, id: 'supplemental:cairn-fist', name: 'Fist (Cairn Form)',
  description: 'Cairn Form grants stone fists. On a critical hit, the target must succeed at a Fortitude save against your class DC or become stunned 1 for 1 round.',
  data: { ...FIST.data, damage: '2d6 bludgeoning' },
}

export const SPARK_FIST: ContentEntry = {
  ...FIST, id: 'supplemental:spark-fist', name: 'Spark Fist',
  traits: ['Agile', 'Finesse', 'Unarmed'],
  description: 'Activate with one action, once per minute, until the end of your next turn. Your fist loses nonlethal and deals extra fire damage equal to its weapon damage dice on a successful Strike. Each successful Strike also deals that much fire damage to you.',
  data: { ...FIST.data, actions: 'Single Action', url: 'https://2e.aonprd.com/Feats.aspx?ID=3286' },
}

export const ORC_TUSKS: ContentEntry = {
  ...FIST, id: 'supplemental:orc-tusks', name: 'Tusks',
  traits: ['Finesse', 'Unarmed'],
  description: 'Tusks grants a 1d6 piercing unarmed attack in the brawling group with finesse.',
  data: { ...FIST.data, damage: '1d6 piercing', url: 'https://2e.aonprd.com/Feats.aspx?ID=4519' },
}

export const TENGU_BITE: ContentEntry = {
  ...FIST, id: 'supplemental:tengu-bite', name: 'Beak', systems: ['pf2e'],
  traits: ['Finesse', 'Unarmed'],
  description: 'Your beak is a 1d6 piercing unarmed attack in the brawling group with the finesse trait.',
  data: { ...FIST.data, damage: '1d6 piercing' },
}

export const TENGU_DOGFANG_BITE: ContentEntry = {
  ...TENGU_BITE, id: 'supplemental:tengu-dogfang-bite', traits: ['Finesse', 'Unarmed', 'Versatile S'],
  description: 'Dogfang Bite gives your beak the versatile S trait.',
}

export const IRUXI_CLAWS: ContentEntry = {
  ...FIST, id: 'supplemental:iruxi-claws', name: 'Claws',
  traits: ['Agile', 'Finesse', 'Unarmed', 'Versatile P'],
  description: 'Iruxi Armaments improves your claw unarmed attack to 1d6 slashing damage and adds versatile P.',
  data: { ...FIST.data, weapon_group: 'Brawling', damage: '1d6 slashing' },
}

export const IRUXI_FANGS: ContentEntry = {
  ...FIST, id: 'supplemental:iruxi-fangs', name: 'Fangs',
  traits: ['Unarmed'],
  description: 'Iruxi Armaments grants a fangs unarmed attack dealing 1d8 piercing damage.',
  data: { ...FIST.data, weapon_group: 'Brawling', damage: '1d8 piercing' },
}

export const IRUXI_TAIL: ContentEntry = {
  ...FIST, id: 'supplemental:iruxi-tail', name: 'Tail',
  traits: ['Sweep', 'Unarmed'],
  description: 'Iruxi Armaments grants a tail unarmed attack dealing 1d6 bludgeoning damage with sweep.',
  data: { ...FIST.data, weapon_group: 'Brawling', damage: '1d6 bludgeoning' },
}

export const AUTOMATON_CLAW: ContentEntry = {
  ...FIST, id: 'supplemental:automaton-claw', name: 'Claw', systems: ['pf2e'],
  traits: ['Agile', 'Finesse', 'Unarmed'],
  description: 'Automaton Armament grants a claw unarmed attack dealing 1d4 slashing damage.',
  data: { ...FIST.data, weapon_group: 'Brawling', damage: '1d4 slashing' },
}

const fadrimAttack = (name: string, damage: string, traits: string[]): ContentEntry => ({
  ...FIST, id: `supplemental:first-world-${name.toLowerCase()}`, name, systems: ['pf2e'], traits,
  description: `First World Armaments grants a ${name.toLowerCase()} unarmed attack dealing ${damage} damage.`,
  data: { ...FIST.data, weapon_group: 'Brawling', damage },
})
export const FIRST_WORLD_ARMAMENTS: ContentEntry[] = [
  fadrimAttack('Claw', '1d4 slashing', ['Agile', 'Finesse', 'Unarmed']),
  fadrimAttack('Hoof', '1d6 bludgeoning', ['Finesse', 'Unarmed']),
  fadrimAttack('Horn', '1d6 piercing', ['Finesse', 'Unarmed']),
  fadrimAttack('Jaws', '1d6 piercing', ['Finesse', 'Unarmed']),
]

export const ENERGY_BLAST: ContentEntry = {
  ...FIST, id: 'supplemental:energy-blast', name: 'Energy Blast', systems: ['pf2e'],
  traits: ['Unarmed'],
  description: 'Core Cannon: while in cannon form, a ranged unarmed energy blast dealing fire and force damage.',
  data: { ...FIST.data, weapon_type: 'Ranged', damage: '3d8 fire', range: 120 },
}

export const SKYFIRE_WING: ContentEntry = {
  ...FIST, id: 'supplemental:skyfire-wing', name: 'Wing', systems: ['sf2e'],
  traits: ['Backswing', 'Reach', 'Unarmed'],
  description: 'Skyfire Wings grants a wing unarmed attack dealing fire damage. On a critical hit, the target takes persistent electricity damage.',
  data: { ...FIST.data, damage: '1d8 fire' },
}

export const AUTOMATON_PINCER: ContentEntry = {
  ...FIST, id: 'supplemental:automaton-pincer', name: 'Pincer', systems: ['pf2e'],
  traits: ['Grapple', 'Unarmed'],
  description: 'Automaton Armament grants a pincer unarmed attack dealing 1d6 piercing damage.',
  data: { ...FIST.data, weapon_group: 'Brawling', damage: '1d6 piercing' },
}

export const CLAN_PISTOL: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:clan-pistol', name: 'Clan Pistol',
  traits: ['Concussive', 'Dwarf', 'Fatal d10', 'Uncommon'],
  description: '',
  data: { weapon_category: 'Martial', weapon_group: 'Firearm', weapon_type: 'Ranged', damage: '1d6 piercing',
    range: 80, reload: 1, hands: 1, url: 'https://2e.aonprd.com/Weapons.aspx?ID=197' },
}

export const CLAN_DAGGER: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:clan-dagger', name: 'Clan Dagger',
  traits: ['Agile', 'Dwarf', 'Parry', 'Uncommon', 'Versatile B'],
  description: '',
  data: { weapon_category: 'Simple', weapon_group: 'Knife', weapon_type: 'Melee', damage: '1d4 piercing',
    hands: 1, url: 'https://2e.aonprd.com/Weapons.aspx?ID=368' },
}

export const CLAN_DAGGER_DEXTERITY: ContentEntry = {
  ...CLAN_DAGGER, id: 'supplemental:clan-dagger-dexterity', name: 'Clan Dagger (Dexterity)',
  source: 'homebrew', traits: ['Agile', 'Disarm', 'Dwarf', 'Finesse', 'Parry', 'Uncommon', 'Versatile S'],
  description: 'An orichalcum clan dagger balanced for precise, agile cuts and deft parries. Its fundamental runes improve automatically with its wielder.',
  data: { ...CLAN_DAGGER.data, weapon_category: 'Martial', damage: '1d4 piercing',
    url: 'https://2e.aonprd.com/Weapons.aspx?ID=387' },
}

export const PLASMA_ARRAY: ContentEntry = {
  id: 'homebrew:plasma-array', systems: ['sf2e'], kind: 'weapon', source: 'homebrew',
  name: 'Plasma Array', level: 0, traits: ['Automatic', 'Tech'],
  description: 'Price 60 credits. Damage 1d8 F. Bulk 2. Hands 2. Range 30 feet. Reload 1. One user-selectable upgrade slot remains after the automatic Flaming Module and Shock Module each use a slot. Magazine 10 charges. Expend 1.\n\nA plasma array fires multiple beams of plasma at once. This massive assault rifle has a set of rotating barrels that prevent overheating when spewing auto-fire.',
  data: { weapon_category: 'Martial', weapon_group: 'Plasma', weapon_type: 'Ranged', damage: '1d8 F',
    bulk: 2, hands: 2, range: 30, reload: 1, upgrade_slots: 3, weapon_ammunition: '10 charges',
    price: 60, sourceBook: 'Homebrew' },
  effects: [], updatedAt: 1,
}

export const SUPERIOR_DATAJACK: ContentEntry = {
  id: 'homebrew:superior-datajack', systems: ['sf2e'], kind: 'item', source: 'homebrew',
  name: 'Datajack (Superior)', level: 15, traits: ['Tech'],
  description: 'This datajack connects computers and digital storage devices directly to your nervous system. You gain a +3 item bonus to Computers checks when accessing a system with this datajack.',
  data: { item_category: 'Augmentations', item_subcategory: 'Cybernetics', sourceBook: 'Homebrew' },
  effects: [], updatedAt: 1,
}

export const PILOTING_INTERFACES: ContentEntry[] = [
  { grade: 'Commercial', level: 5, price: 1600, bonus: 1 },
  { grade: 'Tactical', level: 11, price: 13000, bonus: 2 },
  { grade: 'Advanced', level: 17, price: 140000, bonus: 3 },
].map(({ grade, level, price, bonus }) => ({
  id: `homebrew:piloting-interface-${grade.toLowerCase()}`, systems: ['sf2e'], kind: 'item', source: 'homebrew',
  name: `Piloting Interface (${grade})`, level, traits: ['Tech'],
  description: `This cybernetic interface connects your nervous system to a vehicle's controls. You gain a +${bonus} item bonus to Piloting checks. Once per day, you can Take Control as a free action unless it normally takes multiple actions; you can do so no more than once per turn.${grade !== 'Commercial' ? ' You ignore the usual Piloting penalties for Stunt and the three-action Drive.' : ''}`,
  data: { item_category: 'Augmentations', item_subcategory: 'Cybernetics', sourceBook: 'Homebrew', price, piloting_item_bonus: bonus, item_daily_uses: true },
  effects: [], updatedAt: 1,
}))

export const ADVANCED_PILOTING_INSTRUMENTS: ContentEntry = {
  id: 'homebrew:piloting-instruments-advanced', systems: ['sf2e'], kind: 'item', source: 'homebrew',
  name: 'Piloting Instruments (Advanced)', level: 17, traits: ['Tech'],
  description: 'These armor-mounted instruments connect to your vehicle. You gain a +3 item bonus to Piloting checks. Once per turn, you can Take Control as a free action unless it normally takes multiple actions. You ignore the usual Piloting penalties for Stunt and the three-action Drive.',
  data: { item_category: 'Upgrades', item_subcategory: 'Armor Upgrades', sourceBook: 'Homebrew', price: 140000, bulk: 1 },
  effects: [], updatedAt: 1,
}

export const GAUNTLET: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:full-plate-gauntlet', name: 'Gauntlet',
  traits: ['Agile', 'Free-Hand'],
  description: 'Full plate, half plate, Hellknight plate, and splint mail include gauntlets that can be used as simple weapons dealing 1d4 bludgeoning damage.',
  data: { weapon_category: 'Simple', weapon_group: 'Brawling', weapon_type: 'Melee', damage: '1d4 bludgeoning' },
}

export const ARMOR_GAUNTLETS: NonNullable<OwnedArmor['gauntlet']>[] = ['Gauntlet', 'Spiked Gauntlet', 'Bladed Gauntlet', 'Clawed Gauntlet']

const homebrewFeat = (id: string, name: string, level: number, traits: string[], description: string, data: ContentEntry['data'] = {}): ContentEntry => ({
  id: `homebrew:${id}`, systems: ['pf2e'], kind: 'feat', source: 'homebrew', name, level, traits, description, data, effects: [], updatedAt: 1,
})

export const PERSISTENT_SPELLS = [
  { name: 'Keen Smell', level: 6 },
  { name: 'Canopy Crawler', level: 8 },
  { name: 'Animal Feature', level: 8 },
  { name: 'Magic Hide', level: 10 },
  { name: 'Gravity Weapon', level: 14 },
  { name: 'Enlarge Companion', level: 18 },
] as const

const COPIED_FEAT_IDS: Record<string, string> = {
  'aon:pf2e:feat-4733:ranger': 'homebrew:deimatic-display-ranger',
  'aon:pf2e:feat-5418:druid': 'homebrew:ears-of-the-forest-druid',
  'aon:pf2e:feat-5418:ranger': 'homebrew:ears-of-the-forest-ranger',
}

export function migrateCopiedFeats(c: Character): Character {
  const steadyId = 'homebrew:steady-spellcasting-ranger-champion'
  const steadySelected = ['Ranger', 'Champion'].includes(c.className ?? '') && c.feats.some(feat =>
    feat.name === 'Steady Spellcasting' && feat.type === 'Class Feat'
    && (!feat.slot || feat.slot.startsWith('class:'))
    && (!feat.sourceId || feat.sourceId === 'aon:pf2e:feat-4602'))
  const feats = c.feats.map(feat => {
    const mapped = feat.sourceId && COPIED_FEAT_IDS[feat.sourceId]
    if (mapped) return { ...feat, sourceId: mapped }
    if (steadySelected && feat.name === 'Steady Spellcasting' && feat.type === 'Class Feat'
      && (!feat.slot || feat.slot.startsWith('class:'))
      && (!feat.sourceId || feat.sourceId === 'aon:pf2e:feat-4602')) return { ...feat, sourceId: steadyId }
    return feat
  })
  const entryIds = c.entryIds.map(id => COPIED_FEAT_IDS[id] ?? (steadySelected && id === 'aon:pf2e:feat-4602' ? steadyId : id))
  return feats.some((feat, i) => feat !== c.feats[i]) || entryIds.some((id, i) => id !== c.entryIds[i])
    ? { ...c, feats, entryIds } : c
}

export function migrateMobileHunt(c: Character): Character {
  const feats = c.feats.map(feat => feat.name === 'Mobile Hunter'
    && feat.type === 'Class Feat' && (!feat.sourceId || feat.sourceId === 'homebrew:mobile-hunter')
    && (!feat.slot || feat.slot.startsWith('class:'))
    ? { ...feat, name: 'Mobile Hunt' } : feat)
  return feats.some((feat, index) => feat !== c.feats[index]) ? { ...c, feats } : c
}

export function homebrewCharacterOptions(entries: ContentEntry[]): ContentEntry[] {
  const nimbleClasses = ['Champion', 'Envoy', 'Fighter', 'Gunslinger', 'Monk', 'Operative', 'Ranger', 'Rogue', 'Swashbuckler']
  const guardbreakClasses = ['Champion', 'Cleric', 'Commander', 'Druid', 'Exemplar', 'Fighter', 'Guardian', 'Inventor', 'Runesmith', 'Solarian']
  const poison = entries.find((entry) => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
    && entry.name === 'Poison Resistance' && entry.level === 2 && entry.traits.includes('Druid'))
  const simplicity = entries.find((entry) => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
    && entry.name === 'Deadly Simplicity' && entry.traits.includes('Cleric'))
  const rangerCopies = ['Effortless Concentration', 'Forgotten Presence', 'Timeless Nature'].flatMap(name => {
    const original = entries.find(entry => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
      && entry.name === name && entry.traits.includes('Druid'))
    if (!original) return []
    return [{ ...original, id: `homebrew:ranger-${name.toLowerCase().replaceAll(' ', '-')}`, source: 'homebrew' as const,
      traits: [...original.traits.filter(trait => !['Druid', 'Bard', 'Necromancer', 'Sorcerer', 'Summoner', 'Witch', 'Wizard'].includes(trait)), 'Ranger'],
      data: { ...Object.fromEntries(Object.entries(original.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Ranger' },
      updatedAt: 1 }]
  })
  const strongArm = entries.find(entry => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
    && entry.name === 'Strong Arm' && entry.traits.includes('Rogue'))
  const twinnedDefense = entries.find(entry => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
    && entry.name === 'Twinned Defense (Fighter)' && entry.traits.includes('Fighter'))
  const twinParry = entries.find(entry => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
    && entry.name === 'Twin Parry' && entry.traits.includes('Ranger'))
  const spiritOfTheAlphaDescription = 'Your bond with your companions grants them the full might of the wild. Spirit of the Beast gains a new option, Aspect of the Alpha, which lasts until your next daily preparations. It gives a +3 status bonus from all three aspects at once: Might (Fortitude saves, Athletics and Intimidation), Swiftness (Reflex saves, Acrobatics and Stealth) and Insight (Will saves, Perception and Survival).'
  const divineSpellVariants = ['Ignition', 'Tailwind'].flatMap(name => {
    const spell = entries.find(entry => entry.kind === 'spell' && entry.source === 'official' && !entry.deleted
      && entry.name === name && entry.systems.includes('pf2e'))
    return spell ? [{ ...spell, id: `homebrew:${name.toLowerCase().replaceAll(' ', '-')}-divine`,
      source: 'homebrew' as const, data: { ...spell.data, tradition: 'Divine' }, updatedAt: 1 }] : []
  })
  const copiedClassFeats = [
    { sourceId: 'aon:pf2e:feat-4845', id: 'homebrew:opening-stance-ranger', name: 'Opening Stance (Ranger)', classes: ['Ranger'], oldClasses: ['Fighter'] },
    { sourceId: 'aon:pf2e:feat-4733', id: 'homebrew:deimatic-display-ranger', name: 'Deimatic Display (Ranger)', classes: ['Ranger'], oldClasses: ['Druid'] },
    { sourceId: 'aon:pf2e:feat-5418', id: 'homebrew:ears-of-the-forest-druid', name: 'Ears of the Forest (Druid)', classes: ['Druid'], oldClasses: ['Bard'] },
    { sourceId: 'aon:pf2e:feat-5418', id: 'homebrew:ears-of-the-forest-ranger', name: 'Ears of the Forest (Ranger)', classes: ['Ranger'], oldClasses: ['Bard'] },
    { sourceId: 'aon:pf2e:feat-4602', id: 'homebrew:steady-spellcasting-ranger-champion', name: 'Steady Spellcasting', classes: ['Ranger', 'Champion'],
      oldClasses: ['Bard', 'Cleric', 'Druid', 'Necromancer', 'Oracle', 'Psychic', 'Sorcerer', 'Witch', 'Wizard'] },
    { sourceId: 'aon:pf2e:feat-4731', id: 'homebrew:instinctive-support', name: 'Instinctive Support',
      classes: ['Ranger', 'Champion', 'Bard'], oldClasses: ['Druid'] },
  ].flatMap(({ sourceId, id, name, classes, oldClasses }) => {
    const original = entries.find(entry => entry.id === sourceId && entry.kind === 'feat' && entry.source === 'official' && !entry.deleted)
    if (!original) return []
    const data = Object.fromEntries(Object.entries(original.data).filter(([key, value]) =>
      !['archetype', 'archetype_levels'].includes(key)
      && !(sourceId === 'aon:pf2e:feat-5418' && key === 'prerequisite' && /^zoophonia muse$/i.test(String(value).trim()))))
    const description = sourceId === 'aon:pf2e:feat-5418'
      ? original.description.split('\n\n').filter(part => !/^prerequisites?:?\s+zoophonia muse\.?$/i.test(part.trim())).join('\n\n')
      : original.description
    return [{ ...original, id, name, source: 'homebrew' as const,
      description,
      traits: [...new Set([...original.traits.filter(trait => !oldClasses.includes(trait)), ...classes])],
      data: { ...data, class: classes.join(', '), ...(id === 'homebrew:instinctive-support' ? { prerequisite: 'Animal Companion or Faithful Steed' } : {}) }, updatedAt: 1 }]
  })
  const favoredWeaponSymbol = homebrewFeat('favored-weapon-symbol', 'Favored Weapon Symbol', 1, ['Champion', 'Cleric'],
    "You cultivate a divine conduit within your deity's symbol that can manifest into your deity's favored weapon. You spend 10 minutes focusing divine energy into your deity's symbol, imprinting it with the potential of your deity's favored weapon.\n\nWhen holding or wearing the imprinted holy symbol, you can use an Interact action to cause the divine energy to surge outward, immediately growing the weapon directly from the symbol into your hand. A second Interact action causes the divine matter to swiftly retract back into the holy symbol.\n\nThe favored weapon from your icon can be etched with weapon runes or affixed with talismans as normal, which are safely suppressed when the weapon is retracted inside the symbol.", { class: 'Champion, Cleric' })
  const favoredWeaponJousting = homebrewFeat('favored-weapon-jousting', 'Favored Weapon Jousting', 4, ['Champion', 'Cleric'],
    "You know how to use the favored weapon of your deity while riding your animal companion. If one handed and melee, your deity's favored weapon gains the jousting trait.", { class: 'Champion, Cleric', prerequisite: 'Favored Weapon Symbol' })
  const tetheredFavoredWeapon = homebrewFeat('tethered-favored-weapon', 'Tethered Favored Weapon', 20, ['Champion', 'Cleric'],
    "Your deity's favored weapon gains the Tethered trait if it already has the thrown trait.",
    { class: 'Champion, Cleric' })
  const favoredWeaponVariants = (['Vindicator', 'Avenger'] as const).flatMap(archetype => {
    const className = archetype === 'Vindicator' ? 'Ranger' : 'Rogue'
    const copy = (entry: ContentEntry, prerequisite?: string): ContentEntry => ({
      ...entry,
      id: `${entry.id}-${archetype.toLowerCase()}`,
      name: `${entry.name} (${archetype})`,
      source: 'homebrew',
      traits: [...new Set([...entry.traits.filter(trait => !['Champion', 'Cleric'].includes(trait)), archetype])],
      data: { ...entry.data, class: className, archetype, ...(prerequisite ? { prerequisite } : {}) },
      updatedAt: 1,
    })
    const symbol = copy(favoredWeaponSymbol)
    return [
      symbol,
      copy(favoredWeaponJousting, `Favored Weapon Symbol (${archetype})`),
      copy(tetheredFavoredWeapon),
    ]
  })
  const wizardFamiliarCopies = ['Incredible Familiar', 'Improved Familiar'].flatMap(name => {
    const matches = entries.filter(entry => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted && entry.name === name)
    if (!matches.length || matches.some(entry => entry.traits.includes('Wizard'))) return []
    const original = matches[0]
    return [{ ...original, id: `homebrew:wizard-${name.toLowerCase().replaceAll(' ', '-')}`, source: 'homebrew' as const,
      traits: [...original.traits.filter(trait => !['Archetype', 'Dedication', 'Multiclass'].includes(trait)), 'Wizard'],
      description: original.description.split('\n\n').filter(paragraph => !/^Archetypes?\b/i.test(paragraph)).join('\n\n'),
      data: { ...Object.fromEntries(Object.entries(original.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Wizard' },
      updatedAt: 1 }]
  })
  return [
    ...divineSpellVariants,
    ...rangerCopies,
    ...wizardFamiliarCopies,
    ...copiedClassFeats,
    { ...homebrewFeat('solarian-paragons-guard', "Paragon's Guard", 12, ['Solarian', 'Stance'],
      'Requirements: You are wielding a shield. While in this stance, your shield remains raised.',
      { class: 'Solarian', actions: 'Single Action', requirements: 'You are wielding a shield.' }), systems: ['sf2e'] },
    { ...homebrewFeat('versatile-envoy', 'Versatile Envoy', 10, ['Envoy'],
      'Choose a different Envoy leadership style you do not already have. You gain its associated trained skill and Leadership Perk.\n\nSpecial: You can select this feat multiple times, choosing a different leadership style each time.',
      { class: 'Envoy', repeatable: true }), systems: ['sf2e'] },
    { ...homebrewFeat('versatile-operative', 'Versatile Operative', 10, ['Operative'],
      'Choose a different Operative specialization from the one you selected at 1st level. You gain its associated trained skill and a skill feat for that skill. If you choose Sniper, you also gain its bonus class feat.\n\nSpecial: You can select this feat multiple times, choosing a different specialization each time.',
      { class: 'Operative', repeatable: true }), systems: ['sf2e'] },
    homebrewFeat('bony-plates', 'Bony Plates', 1, ['Lizardfolk'], BONY_PLATES_DESCRIPTION),
    homebrewFeat('incredible-undead-familiar', 'Incredible Undead Familiar', 10, ['Necromancer'],
      'You infuse your undead familiar with even more void energy. You can select five familiar or master abilities each day, instead of three.',
      { class: 'Necromancer', prerequisite: 'Enhanced Undead Familiar' }),
    { ...homebrewFeat('nimble-athlete', 'Nimble Athlete', 4, nimbleClasses,
      'Homebrew class feat. You use the higher of your Strength or Dexterity modifiers for Athletics checks and Athletics DCs. This includes combat maneuvers such as Grapple, Trip, Shove, Disarm, and Reposition, as well as climbing, swimming, and jumping.\n\nThis does not change your damage, carrying capacity, or Strength prerequisites.',
      { class: nimbleClasses.join(', '), prerequisite: 'expert in Athletics' }), systems: ['pf2e', 'sf2e'] },
    { ...homebrewFeat('guardbreak', 'Guardbreak', 4, guardbreakClasses,
      'Prerequisite: Shield Block. Requirements: You are adjacent to an opponent.\n\nRaise your Shield and make an attack roll against the opponent using a shield bash or a melee weapon attached to your shield. On a success, the opponent is off-guard to your next melee Strike. On a critical success, the opponent is off-guard to all your melee attacks until the end of your next turn.',
      { class: guardbreakClasses.join(', '), actions: 'Single Action', prerequisite: 'Shield Block',
        requirements: 'You are adjacent to an opponent.' }), systems: ['pf2e', 'sf2e'] },
    homebrewFeat('desperate-warden', 'Desperate Warden', 1, ['Druid', 'Ranger'],
      "Frequency: once per day. Trigger: You begin your turn and have no Focus Points.\n\nYou call out to primal spirits in a plea for their aid. You gain 1 Focus Point, which you can spend only to cast a warden spell. If you don't spend this Focus Point by the end of this turn, it is lost.",
      { class: 'Druid, Ranger', actions: 'Free Action', frequency: 'once per day',
        trigger: 'You begin your turn and have no Focus Points.' }),
    ...(twinnedDefense ? [{ ...twinnedDefense, id: 'homebrew:ranger-twinned-defense-stance', name: 'Twinned Defense Stance',
      source: 'homebrew' as const, traits: [...twinnedDefense.traits.filter(trait => trait !== 'Fighter'), 'Ranger'],
      description: twinnedDefense.description.replaceAll(twinnedDefense.name, 'Twinned Defense Stance')
        .split('\n\n').filter(paragraph => !/^Archetypes?\b/i.test(paragraph)).join('\n\n'),
      data: { ...Object.fromEntries(Object.entries(twinnedDefense.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Ranger' },
      updatedAt: 1 }] : []),
    ...(twinParry ? [{ ...twinParry, id: 'homebrew:avenger-twin-parry', name: 'Twin Parry (Avenger)',
      source: 'homebrew' as const, traits: [...twinParry.traits.filter(trait => !['Fighter', 'Ranger'].includes(trait)), 'Avenger'],
      data: { ...Object.fromEntries(Object.entries(twinParry.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))),
        class: 'Rogue', archetype: 'Avenger' },
      updatedAt: 1 }] : []),
    ...(twinnedDefense ? [{ ...twinnedDefense, id: 'homebrew:avenger-twinned-defense-stance', name: 'Twinned Defense Stance',
      source: 'homebrew' as const, traits: [...twinnedDefense.traits.filter(trait => trait !== 'Fighter'), 'Avenger'],
      description: twinnedDefense.description.replaceAll(twinnedDefense.name, 'Twinned Defense Stance')
        .replaceAll('Twin Parry', 'Twin Parry (Avenger)')
        .split('\n\n').filter(paragraph => !/^Archetypes?\b/i.test(paragraph)).join('\n\n'),
      data: { ...Object.fromEntries(Object.entries(twinnedDefense.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))),
        class: 'Rogue', archetype: 'Avenger', prerequisite: 'Twin Parry (Avenger)' },
      updatedAt: 1 }] : []),
    homebrewFeat('rider', 'Rider', 1, ['Champion', 'Commander', 'Druid', 'Ranger'],
      "You are especially good at riding animal companions. You gain the Ride general feat. You gain a +1 circumstance bonus to Nature checks to Command an Animal when commanding your own animal companion, if a check is required.\n\nIf you gain an animal companion, it gains the mount special ability while it is at least one size larger than you. This is the full mount special ability: while carrying a rider, it can move and Support you on the same turn and can use its other Speeds, not just its land Speed. This feat does not grant any new Speeds or increase the companion's size.\n\nThis feat does not grant an animal companion and does not apply to construct companions, eidolons, or familiars.",
      { class: 'Champion, Commander, Druid, Ranger' }),
    homebrewFeat('mounted-parry', 'Mounted Parry', 6, ['Archetype'],
      'While mounted, your mount also gains the circumstance bonus to AC from your active parry.',
      { archetype: 'Cavalier', prerequisite: 'Cavalier Dedication' }),
    homebrewFeat('spirit-of-the-alpha', 'Spirit of the Alpha', 20, ['Archetype'],
      spiritOfTheAlphaDescription, { archetype: 'Beastmaster', prerequisite: 'Beastmaster Dedication' }),
    homebrewFeat('spirit-of-the-alpha-druid', 'Spirit of the Alpha', 20, ['Druid'],
      spiritOfTheAlphaDescription, { class: 'Druid' }),
    homebrewFeat('greywatch-initiate', 'Greywatch Initiate', 4, ['Gunslinger', 'Investigator', 'Ranger', 'Rare'],
      "You've received the basic training developed for all Greywatch recruits. You become an expert in Deception and gain the Face in the Crowd and Lengthy Diversion skill feats.",
      { class: 'Gunslinger, Investigator, Ranger', prerequisite: 'Trained in Deception' }),
    homebrewFeat('blackwatch-initiate', 'Blackwatch Initiate', 4, ['Gunslinger', 'Investigator', 'Ranger', 'Rare'],
      "You've received the basic training developed for all Blackwatch recruits. You become an expert in Occultism and gain the Oddity Identification and Reveal True Name skill feats.",
      { class: 'Gunslinger, Investigator, Ranger', prerequisite: 'Trained in Occultism' }),
    homebrewFeat('palewatch-initiate', 'Palewatch Initiate', 4, ['Gunslinger', 'Investigator', 'Ranger', 'Rare'],
      "You've received the basic training developed for all Palewatch recruits. You become an expert in Religion and gain the Pilgrim's Token and Student of the Canon skill feats.",
      { class: 'Gunslinger, Investigator, Ranger', prerequisite: 'Trained in Religion' }),
    homebrewFeat('magewatch-initiate', 'Magewatch Initiate', 4, ['Gunslinger', 'Investigator', 'Ranger', 'Rare'],
      "You've received the basic training developed for all Magewatch recruits. You become an expert in Arcana and gain the Arcane Sense and Quick Identification skill feats.",
      { class: 'Gunslinger, Investigator, Ranger', prerequisite: 'Trained in Arcana' }),
    ...(strongArm ? [{ ...strongArm, id: 'homebrew:strong-arm-ranger-barbarian', source: 'homebrew' as const,
      traits: [...strongArm.traits.filter(trait => trait !== 'Rogue'), 'Ranger', 'Barbarian'],
      data: { ...Object.fromEntries(Object.entries(strongArm.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Ranger, Barbarian' },
      updatedAt: 1 }] : []),
    favoredWeaponJousting,
    tetheredFavoredWeapon,
    homebrewFeat('primal-nimbleness', 'Primal Nimbleness', 1, ['Druid', 'Ranger'],
      'Your muscles are tightly honed. Your Speed increases by 5 feet.', { class: 'Druid, Ranger' }),
    homebrewFeat('divine-insight', 'Divine Insight', 1, ['Cleric', 'Concentrate', 'Fortune'],
      "Trigger: You are either about to roll a Recall Knowledge check using Religion, a Lore skill about your deity, or the Divine Skill of your deity, or you fail or critically fail one of those checks.\nFrequency: Once per hour.\n\nYour deity whispers in your ear some knowledge that lies within you that you thought you had forgotten. If you are about to roll the triggering check, roll twice and take the highest result. If the triggering check was from a failure or critical failure, you may reroll the check and use the new result.\n\nIf you succeed the check, you may gain a +1 circumstance bonus on the next check you make within 1 minute relating to the subject of your Recall Knowledge check, such as an attack roll or skill check against a creature or a skill check with a different skill. You can also apply this bonus to your AC, DCs, and saving throws against the next attack and hostile effect you need to save against. You may not apply this to another Recall Knowledge check.",
      { class: 'Cleric', frequency: 'once per hour',
        trigger: 'You are about to roll or fail or critically fail a Recall Knowledge check using Religion, a Lore skill about your deity, or your deity’s Divine Skill.' }),
    homebrewFeat('divine-strike', 'Divine Strike', 10, ['Cleric'],
      "Prerequisites: Channel Smite or Sacred Strike, expert with your deity's favored weapon.\nRequirements: You are wielding your deity's favored weapon.\nFrequency: Once per day.\n\nYou channel a divine spell into your deity's favored weapon to deliver a combined divine attack. You Cast a Spell that takes 1 or 2 actions to cast and requires a spell attack roll using one of your Cleric spell slots. The effects of the spell don't occur immediately but are imbued into your attack instead. Make a Strike with the required weapon. Your spell is coupled with your attack, using your attack roll result to determine the effects of both the Strike and the spell.",
      { class: 'Cleric', actions: 'Two Actions', prerequisite: "Channel Smite or Sacred Strike, expert with your deity's favored weapon",
        requirements: "You are wielding your deity's favored weapon", frequency: 'once per day' }),
    homebrewFeat('guiding-heal', 'Guiding Heal', 2, ['Cleric', 'Concentrate', 'Spellshape'],
      'Prerequisite: healing font.\n\nWhen focused, your healing grants divine inspiration to your allies. If your next action is to cast the one- or two-action version of heal, the target of the spell also gains a +1 status bonus to AC, saves, and attack rolls until the end of your next turn.',
      { class: 'Cleric', actions: 'Single Action', prerequisite: 'healing font' }),
    homebrewFeat('firearm-ace', 'Firearm Ace', 1, ['Ranger'],
      'Requirements: You are wielding a firearm with reload 1 or higher.\n\nYour deep understanding of the firearm allows you to reload efficiently while moving yourself out of the line of return fire. Either Create a Diversion or Take Cover, then Interact to reload. As normal, you must meet the requirements to Take Cover; you must be prone, benefiting from cover, or near a feature that allows you to Take Cover.',
      { class: 'Ranger', actions: 'Single Action', requirements: 'You are wielding a firearm with reload 1 or higher' }),
    homebrewFeat('shift-ace', 'Shift Ace', 1, ['Ranger'],
      'Requirements: You are carrying a weapon with a shifting rune.\n\nYour deep understanding of weapons allows you to shift a weapon efficiently while moving yourself out of the line of return fire. Either Create a Diversion or Take Cover, then Interact to shift a weapon. As normal, you must meet the requirements to Take Cover; you must be prone, benefiting from cover, or near a feature that allows you to Take Cover.',
      { class: 'Ranger', actions: 'Single Action', requirements: 'You are carrying a weapon with a shifting rune.' }),
    homebrewFeat('weapon-ace', 'Weapon Ace', 1, ['Ranger'],
      'Requirements: You are carrying a sheathed weapon.\n\nYour deep understanding of weapons allows you to draw a weapon efficiently while moving yourself out of the line of return fire. Either Create a Diversion or Take Cover, then Interact to draw a weapon. As normal, you must meet the requirements to Take Cover; you must be prone, benefiting from cover, or near a feature that allows you to Take Cover.',
      { class: 'Ranger', actions: 'Single Action', requirements: 'You are carrying a sheathed weapon.' }),
    homebrewFeat('instinctive-hunt', 'Instinctive Hunt', 1, ['Ranger'],
      'You draw or shift your weapon and designate a single creature as your prey to focus your attacks against that creature. You Interact to draw a weapon, shift your weapon, or Switch Hands and then Hunt Prey.',
      { class: 'Ranger', actions: 'Single Action' }),
    homebrewFeat('mobile-hunter', 'Mobile Hunt', 1, ['Ranger', 'Traversal'],
      "You're rarely still, and you've learned to reliably hunt your target even while moving. You Stride and then Hunt Prey.",
      { class: 'Ranger', actions: 'Single Action' }),
    homebrewFeat('divine-warrior', 'Divine Warrior', 1, ['Champion'],
      'You learn the divine lance and protect companion cantrips. They count as paladin spells for you, and Charisma is your spellcasting ability for them.',
      { class: 'Champion' }),
    homebrewFeat('primal-warrior', 'Primal Warrior', 1, ['Ranger'],
      'You learn the bramble bush and protect companion cantrips. They count as ranger spells for you, and Wisdom is your spellcasting ability for them.\n\nYou learn the Wildsong language, and you are bound by the druid’s anathema.',
      { class: 'Ranger', grants_languages: 'Wildsong' }),
    homebrewFeat('quick-shift', 'Quick Shift', 2, ['Gunslinger', 'Ranger', 'Rogue'],
      'You shift your weapon and attack with the same motion. You Interact to shift a weapon, then Strike with that weapon.',
      { class: 'Gunslinger, Ranger, Rogue', actions: 'Single Action' }),
    homebrewFeat('running-draw', 'Running Draw', 4, ['Ranger'],
      'You can draw your weapon on the move. You Stride, Step, or Sneak, then Interact to draw a weapon.',
      { class: 'Ranger', actions: 'Single Action' }),
    homebrewFeat('running-shift', 'Running Shift', 4, ['Ranger'],
      'You can shift your weapon on the move. You Stride, Step, or Sneak, then Interact to shift a weapon.',
      { class: 'Ranger', actions: 'Single Action' }),
    homebrewFeat('switch-prey', 'Switch Prey', 4, ['Ranger'],
      "Trigger: The creature you're currently hunting gains the dying or unconscious condition.\n\nAs your prey falls, you immediately hone in on the next. You Hunt Prey for a different creature.",
      { class: 'Ranger', actions: 'Free Action', trigger: "The creature you're currently hunting gains the dying or unconscious condition." }),
    homebrewFeat('wardens-draw', "Warden's Draw", 16, ['Ranger'],
      'Frequency: once per round.\nRequirements: Your last action or activity this turn was to cast a warden spell.\n\nYour mastery of magic and weapons allows you to wield both with equal ease. Interact to draw a weapon that is currently sheathed.',
      { class: 'Ranger', actions: 'Free Action', frequency: 'once per round',
        requirements: 'Your last action or activity this turn was to cast a warden spell.' }),
    homebrewFeat('wardens-shift', "Warden's Shift", 16, ['Ranger'],
      'Frequency: once per round.\nRequirements: Your last action or activity this turn was to cast a warden spell.\n\nYour mastery of magic and weapons allows you to wield both with equal ease. Interact to shift a weapon that is currently sheathed.',
      { class: 'Ranger', actions: 'Free Action', frequency: 'once per round',
        requirements: 'Your last action or activity this turn was to cast a warden spell.' }),
    homebrewFeat('prayer-for-aid', 'Prayer for Aid', 2, ['Cleric'],
      'When you prepare to Aid an ally, you may pray to your deity to guide their hand. When you later use the Aid reaction, you may roll Religion instead of the normal skill check. Aiding in this manner adds the divine trait to your Aid reaction and the action used to prepare to Aid. You automatically critically fail to Aid creatures that actively commit anathema to your deity or to Aid actions that your deity would consider anathema.',
      { class: 'Cleric' }),
    homebrewFeat('divine-certitude', 'Divine Certitude', 12, ['Cleric'],
      'Your extensive study of your canon is rewarded by the divine. When you roll a Recall Knowledge check using Religion or the Divine Skill of your deity, you treat failures as successes.',
      { class: 'Cleric', prerequisite: 'Divine Insight' }),
    homebrewFeat('as-mutable-as-nature', 'As Mutable as Nature', 12, ['Druid', '3rd Party'],
      "Prerequisite: You can cast untamed form.\nRequirements: You are currently under the effects of untamed form which has an original duration of 1 minute.\n\nYour shape is as mutable as nature itself, able to shift and change at a moment's notice. You change your form to another that you have access to.",
      { class: 'Druid', actions: 'Single Action', prerequisite: 'You can cast untamed form',
        requirements: 'You are currently under the effects of untamed form which has an original duration of 1 minute.' }),
    homebrewFeat('rapid-shape', 'Rapid Shape', 8, ['Druid'],
      'Prerequisite: You can cast untamed form.\n\nYou take the form of a beast with phenomenal speed. Once per day when you cast untamed form you may do so as a single action instead of the normal two actions.',
      { class: 'Druid', prerequisite: 'You can cast untamed form', frequency: 'once per day' }),
    ...PERSISTENT_SPELLS.map(({ name, level }) => homebrewFeat(`persistent-${name.toLowerCase().replaceAll(' ', '-')}`,
      `Persistent ${name}`, level, ['Ranger'],
      `When you cast ${name}, you can extend its duration to last until the next time you make your daily preparations instead of its normal duration.${name === 'Animal Feature'
        ? ' This extended duration applies to all options except wings.\n\nYou can have multiple Animal Feature effects active at the same time. Each effect must meet the spell rank requirement.' : ''}`,
      { class: 'Ranger', ...(name === 'Magic Hide' ? { archetype: 'Beastmaster' } : {}) })),
    homebrewFeat('impaling-throw', 'Impaling Throw', 1, ['Flourish', 'Ranger', '3rd Party'],
      'Requirements: You are wielding a weapon which does piercing damage with the Thrown trait.\n\nYou know a thorn in the flank of your quarry is an easy quarry to take down. Make a ranged Strike against your prey with the required weapon. If you hit the creature, the weapon stays inside of them instead of dropping to the ground. As long as they leave the weapon in, they are clumsy 1. Removing the weapon requires a single Interact action requiring them to succeed on either an Athletics or Medicine skill check against your class DC.\n\nSpecial: You can use Impaling Throw with improvised weapons that are determined to be appropriate, or when throwing weapons without the thrown trait that deal piercing damage.',
      { class: 'Ranger', actions: 'Single Action', requirements: 'You are wielding a weapon which does piercing damage with the Thrown trait.' }),
    homebrewFeat('impaled-takedown', 'Impaled Takedown', 4, ['Flourish', 'Ranger', '3rd Party'],
      'Requirements: You are adjacent to your Hunted Prey. The prey must have a weapon embedded in them (such as from Impaling Throw), and you must either have a free hand or have just completed a successful melee Strike against them this turn with a piercing weapon.\n\nYou can handle impaled creatures with ease. Taking a hold of the required weapon if necessary, you attempt to Shove or Trip the adjacent hunted prey. For the purposes of this attack you may add any item bonus granted to the weapon via proficiency runes to the check. On a success the creature is also considered off-guard to your next strike and they are clumsy 2 until the weapon is removed.',
      { class: 'Ranger', actions: 'Single Action', requirements: 'Adjacent Hunted Prey with an embedded weapon; free hand or a successful melee piercing Strike against them this turn.' }),
    favoredWeaponSymbol,
    ...favoredWeaponVariants,
    homebrewFeat('verdant-weapon-jousting', 'Verdant Weapon Jousting', 4, ['Druid'],
      'You know how to use your verdant weapon while riding your animal companion. If one handed and melee, your verdant weapon gains the jousting trait.', { class: 'Druid' }),
    homebrewFeat('tethered-verdant-weapon', 'Tethered Verdant Weapon', 20, ['Druid'],
      'Your verdant weapon gains the Tethered trait if it already has the thrown trait.',
      { class: 'Druid', prerequisite: 'Verdant Weapon' }),
    homebrewFeat('weapon-innovation-jousting', 'Weapon Innovation Jousting', 4, ['Inventor'],
      'Your weapon innovation is balanced for mounted combat. Your one-handed melee weapon innovation gains the jousting trait. Its mounted benefits apply while riding a suitable mount, including a construct companion.',
      { class: 'Inventor', prerequisite: 'Weapon innovation' }),
    homebrewFeat('living-weapon-joust', 'Living Weapon Jousting', 14, ['Archetype'],
      'You know how to use your living weapon while riding your animal companion. If one handed and melee, your living weapon gains the jousting trait.', { archetype: 'Wild Hunter' }),
    homebrewFeat('pristine-living-weapon', 'Pristine Living Weapon', 14, ['Archetype'],
      'Prerequisites: Living Weapon, Wild Hunter Dedication.\n\nYour living weapon can cut through the resistances of magical creatures. The weapon is treated as cold iron and silver. If you critically hit a creature that has a weakness to cold iron or silver, the target takes 1d6 persistent bleed damage as the primal energies within your weapon slow its natural healing.',
      { archetype: 'Wild Hunter', prerequisite: 'Living Weapon, Wild Hunter Dedication' }),
    homebrewFeat('tethered-living-weapon', 'Tethered Living Weapon', 20, ['Archetype'],
      'Your living weapon gains the Tethered trait if it already has the thrown trait.',
      { archetype: 'Wild Hunter', prerequisite: 'Living Weapon, Wild Hunter Dedication' }),
    homebrewFeat('tethered-osteo-weapon', 'Tethered Osteo Weapon', 20, ['Necromancer'],
      'Your osteo armament gains the Tethered trait if it already has the thrown trait.',
      { class: 'Necromancer', prerequisite: 'Osteo Armaments' }),
    homebrewFeat('third-blessing', 'Third Blessing', 16, ['Champion'],
      'Your continued service grants you a third boon. Choose a third blessing of the devoted, different from your other blessings, and gain its benefits.',
      { class: 'Champion', prerequisite: 'Second Blessing' }),
    homebrewFeat('second-innovation', 'Second Innovation', 8, ['Inventor'],
      'Choose a second innovation, different from your existing innovation, and gain its benefits.', { class: 'Inventor' }),
    homebrewFeat('third-innovation', 'Third Innovation', 16, ['Inventor'],
      'Choose a third innovation, different from your other innovations, and gain its benefits.',
      { class: 'Inventor', prerequisite: 'Second Innovation' }),
    homebrewFeat('versatile-rogue', 'Versatile Rogue', 10, ['Rogue'],
      "Your street-smart adaptability lets you master more than one style of underhanded work. Choose a rogue's racket you don't already have. You gain its trained skill and special benefits.\n\nSpecial: You do not gain an additional key attribute boost from this racket. You can select this feat multiple times, choosing a different rogue's racket each time.",
      { class: 'Rogue', repeatable: true }),
    homebrewFeat('versatile-investigator', 'Versatile Investigator', 10, ['Investigator'],
      "Your investigative practice draws on more than one methodology. Choose an investigator methodology you don't already have. You gain its trained skill, skill feat, and special benefits.\n\nSpecial: You can select this feat multiple times, choosing a different methodology each time.",
      { class: 'Investigator', repeatable: true }),
    homebrewFeat('versatile-gunslinger', 'Versatile Gunslinger', 14, ['Gunslinger'],
      "Your gunslinging practice draws on more than one way. Choose a gunslinger way you don't already have. You gain its trained skill and special benefits, including benefits that improve as you gain levels.\n\nSpecial: You can select this feat multiple times, choosing a different way each time.",
      { class: 'Gunslinger', repeatable: true }),
    {
      ...homebrewFeat('summertouched-human', 'Summertouched Human', 1, ['Human'],
        'The power of summer flows through you. You gain fire resistance equal to half your level (minimum 1), and you treat environmental heat effects as if they were one step less extreme (incredible heat becomes extreme, extreme heat becomes severe, and so on).',
        { ancestry: 'Human', resistances: 'fire=half' }),
      kind: 'heritage',
    },
    ...(poison ? [{
      ...poison, id: 'homebrew:ranger-poison-resistance', source: 'homebrew' as const,
      traits: ['Ranger'],
      description: 'Your affinity for the natural world grants you protection against some of its dangers. You gain poison resistance equal to half your level, and you gain a +1 status bonus to saving throws against poisons.',
      data: { ...Object.fromEntries(Object.entries(poison.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Ranger', resistances: 'poison=half' }, updatedAt: 1,
    }] : []),
    ...(simplicity ? [{
      ...simplicity, id: 'homebrew:champion-deadly-simplicity', source: 'homebrew' as const,
      traits: ['Champion'],
      data: { ...Object.fromEntries(Object.entries(simplicity.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Champion' },
      updatedAt: 1,
    }] : []),
    {
      ...homebrewFeat('caravan-contortionist', 'Caravan Contortionist', 1, [],
        'You spent your youth traveling with a nomadic caravan troupe, dazzling crowds by folding yourself into tiny crates, slipping through narrow hoops, and performing daring acrobatic stunts. Life on the road taught you how to slip out of tight binds—both literal and figurative—and how traveling performers survive between towns.\n\nChoose two attribute boosts. One must be to Dexterity or Charisma, and one is a free attribute boost.\n\nYou’re trained in the Acrobatics skill and the Caravan Lore skill. You gain the Quick Squeeze skill feat.',
        { attribute: 'Dexterity, Charisma', skill: 'Acrobatics, Caravan Lore', feat: 'Quick Squeeze' }),
      kind: 'background',
    },
    {
      ...homebrewFeat('matanji-demon-hunter', 'Matanji Demon Hunter', 1, [],
        'You learned the Matanji tradition of hunting demons, studying their powers and weaknesses alongside your training for battle.\n\nChoose two attribute boosts: one in Strength or Constitution, and one free boost.\n\nYou are trained in Religion and Demon Lore and gain the Recognize Spell skill feat.',
        { attribute: 'Strength, Constitution', skill: 'Religion, Demon Lore', feat: 'Recognize Spell' }),
      kind: 'background',
    },
    {
      ...homebrewFeat('direwolf-bonded', 'Direwolf Bonded', 1, ['Rare'],
        "You grew up hunting beside a direwolf, learning to read its signals and coordinate your movements. Sarkorian hunters passed down this partnership as a way to track and bring down quarry across their rugged homeland. Playful wrestling with your growing wolf taught you to hold your own against much larger creatures. Greater challenges, distant hunting grounds, or loyalty to your bonded wolf might draw you toward adventure.\n\nChoose two attribute boosts. One must be to Dexterity or Wisdom, and one is a free attribute boost.\n\nYou're trained in Nature and Sarkoris Lore. You gain the Canny Acumen general feat and the Titan Wrestler skill feat.\n\nTrained direwolves can Aid your Nature, Perception, and Survival checks; this benefit also applies to other characters with the Direwolf Bonded background.",
        { attribute: 'Dexterity, Wisdom', skill: 'Nature, Sarkoris Lore', feat: 'Canny Acumen, Titan Wrestler', rarity: 'rare' }),
      kind: 'background',
    },
  ]
}

export const ANIMAL_FEATURES = [
  { name: 'Cat Eyes', rank: 2, effect: 'Low-light vision' },
  { name: 'Claws', rank: 2, effect: '1d6 slashing; agile, finesse, unarmed' },
  { name: 'Fish Tail', rank: 4, effect: 'Swim Speed equal to land Speed' },
  { name: 'Jaws', rank: 2, effect: '1d8 piercing; unarmed' },
  { name: 'Owl Eyes', rank: 4, effect: 'Darkvision' },
  { name: 'Wings', rank: 4, effect: 'Fly Speed equal to land Speed' },
] as const

export function homebrewWeapons(entries: ContentEntry[]): ContentEntry[] {
  const base = entries.find((entry) => entry.id === 'aon:pf2e:weapon-304' && entry.kind === 'weapon' && entry.source === 'official' && !entry.deleted)
  const flyssa = entries.find((entry) => entry.id === 'aon:pf2e:weapon-285' && entry.kind === 'weapon' && entry.source === 'official' && !entry.deleted)
  const laser = entries.filter(entry => entry.kind === 'weapon' && entry.source === 'official' && !entry.deleted
    && entry.systems.includes('sf2e') && /^(?:(?:Commercial|Tactical|Advanced|Superior|Elite|Ultimate|Paragon) )?Laser Pistol$/.test(entry.name))
  const laserRifles = entries.filter(entry => entry.kind === 'weapon' && entry.source === 'official' && !entry.deleted
    && entry.systems.includes('sf2e') && /^(?:(?:Commercial|Tactical|Advanced|Superior|Elite|Ultimate|Paragon) )?Laser Rifle$/.test(entry.name))
  const liminalRifles = entries.filter(entry => entry.kind === 'weapon' && entry.source === 'official' && !entry.deleted
    && entry.systems.includes('sf2e') && /^(?:(?:Commercial|Tactical|Advanced|Superior|Elite|Ultimate|Paragon) )?Liminal Laser Rifle$/.test(entry.name))
  const focusRifles = [...laserRifles, ...liminalRifles].map<ContentEntry>(entry => {
    const liminal = /Liminal Laser Rifle$/.test(entry.name)
    const grade = entry.name.replace(liminal ? /Liminal Laser Rifle$/ : /Laser Rifle$/, '').trim()
    const family = liminal ? 'homebrew:liminal-focus-rifle' : 'homebrew:laser-focus-rifle'
    const focusName = liminal ? 'Liminal Focus Rifle' : 'Laser Focus Rifle'
    return { ...entry, id: `${family}${grade ? `:${grade.toLowerCase()}` : ''}`,
      name: `${grade ? `${grade} ` : ''}${focusName}`, source: 'homebrew' as const,
      traits: [...new Set([...entry.traits, 'Unwieldy', 'Volley 30 ft.'])],
      description: liminal
        ? `Precision lenses focus a Liminal laser beam for long-range attacks.\n\n${entry.description}`
        : 'Precision lenses focus a laser rifle beam for long-range attacks.',
      data: { ...entry.data, weapon_category: 'Martial', weapon_group: 'Sniper', range: 120, range_increment: 120,
        weapon_grade_family: family }, updatedAt: 1 }
  })
  const rapidLaser = laser.map<ContentEntry>(entry => {
    const grade = entry.name.replace(/Laser Pistol$/, '').trim()
    const { url: _url, ...data } = entry.data
    return { ...entry, id: `homebrew:rapid-laser-pistol${grade ? `:${grade.toLowerCase()}` : ''}`,
      name: `${grade ? `${grade} ` : ''}Rapid Laser Pistol`, source: 'homebrew' as const,
      traits: [...new Set([...entry.traits, 'Agile', 'Concealable'])],
      description: 'A compact rapid-fire laser pistol. Its battery holds 6 charges and expends 2 charges per shot.',
      data: { ...data, weapon_category: 'Martial', weapon_ammunition: '6 charges',
        weapon_grade_family: 'homebrew:rapid-laser-pistol' }, updatedAt: 1 }
  })
  const slarp = entries.find(entry => entry.kind === 'item' && entry.name === 'Slarp'
    && entry.source === 'official' && entry.systems.includes('sf2e') && !entry.deleted)
  const advanced = rapidLaser.find(entry => entry.name === 'Advanced Rapid Laser Pistol')
  const slarpRapid = slarp && advanced ? rapidLaser.filter(entry => entry.level >= advanced.level).map(entry => {
    const grade = entry.name.replace(/Rapid Laser Pistol$/, '').trim()
    const baseGrade = grade === 'Advanced'
    const increase = Math.max(0, Number(entry.data.price || 0) - Number(advanced.data.price || 0))
    return { ...entry, id: `homebrew:slarp-rapid-laser-pistol${baseGrade ? '' : `:${grade.toLowerCase()}`}`,
      name: `${baseGrade ? '' : `${grade} `}SLARP Rapid Laser Pistol`,
      traits: [...new Set([...entry.traits, 'Professional (Geology Lore or Physical Science Lore)', 'Razing'])],
      description: "Sampling Laser Analytical Return Protocol analyzes targets. Once per day, after a successful Strike, use a free action to Recall Knowledge about the target's material, Hardness, and resistances using Geology Lore or Physical Science Lore. The battery holds 6 charges and expends 2 per shot.",
      data: { ...entry.data, price: Number(slarp.data.price || 0) + increase, item_subcategory: 'Specific Weapons',
        upgrade_slots: Number(entry.data.upgrade_slots || 0) + 2,
        weapon_grade_family: 'homebrew:slarp-rapid-laser-pistol',
        professional_skills: 'Geology Lore;Physical Science Lore' } }
  }) : []
  return [...(base ? [{
    ...base, id: 'homebrew:clawed-gauntlet', source: 'homebrew' as const, name: 'Clawed Gauntlet',
    traits: base.traits.filter(trait => trait.toLowerCase() !== 'uncommon'),
    data: { ...base.data, rarity: 'common' },
    description: 'Four curved blades mounted over the fist give this close-combat gauntlet the appearance of claws.',
    updatedAt: 1,
  }] : []), ...(flyssa ? [{
    ...flyssa, id: 'homebrew:seax', source: 'homebrew' as const, name: 'Seax',
    description: 'A broad-backed blade with a long cutting edge and a sharp point, carried as both a tool and a close-quarters weapon.',
    updatedAt: 1,
  }] : []), ...focusRifles, ...rapidLaser, ...slarpRapid]
}

export const ANIMAL_FEATURE_CLAWS: ContentEntry = {
  ...FIST, id: 'supplemental:animal-feature-claws', name: 'Claws (Animal Feature)',
  traits: ['Agile', 'Finesse', 'Unarmed'],
  description: 'Animal Feature grants a claw unarmed attack dealing 1d6 slashing damage.',
  data: { ...FIST.data, damage: '1d6 slashing' },
}

export const ANIMAL_FEATURE_JAWS: ContentEntry = {
  ...FIST, id: 'supplemental:animal-feature-jaws', name: 'Jaws (Animal Feature)',
  traits: ['Unarmed'],
  description: 'Animal Feature grants a jaws unarmed attack dealing 1d8 piercing damage.',
  data: { ...FIST.data, damage: '1d8 piercing' },
}

export const UNTAMED_CLAWS: ContentEntry = {
  ...ANIMAL_FEATURE_CLAWS, id: 'supplemental:untamed-claws', name: 'Untamed Claws',
  description: 'Untamed Shift grants agile, finesse claws dealing 1d6 slashing damage. A free hand is required to attack.',
}

export const UNTAMED_JAWS: ContentEntry = {
  ...ANIMAL_FEATURE_JAWS, id: 'supplemental:untamed-jaws', name: 'Untamed Jaws',
  description: 'Untamed Shift grants jaws dealing 1d8 piercing damage.',
}

export const HANDWRAPS: ContentEntry = {
  ...FIST, id: 'supplemental:handwraps', kind: 'item', name: 'Handwraps of Mighty Blows', level: 2,
  traits: ['Invested', 'Magical'],
  description: 'These handwraps carry weapon potency, striking, and property runes. Their benefits apply to your unarmed attacks; property runes apply only to compatible attacks.',
  data: { usage: 'worn gloves' },
}

export const HARDLIGHT_HANDWRAPS: ContentEntry = {
  ...HANDWRAPS, id: 'supplemental:hardlight-handwraps', systems: ['sf2e'], name: 'Hardlight Handwraps', level: 0,
  traits: ['Invested', 'Magical', 'Tech'],
  description: 'Hardlight handwraps enhance unarmed attacks. Their grade determines tracking, damage dice, and upgrade capacity.',
  data: { usage: 'worn gloves', url: 'https://2e.aonsrd.com/treasure/112-hardlight-handwraps' },
}

export const HARDLIGHT_GRADES: Record<HardlightGrade, { potency: number; striking: number; upgrades: number }> = {
  Commercial: { potency: 0, striking: 0, upgrades: 1 },
  Tactical: { potency: 1, striking: 0, upgrades: 1 },
  Advanced: { potency: 1, striking: 1, upgrades: 2 },
  Superior: { potency: 2, striking: 1, upgrades: 2 },
  Elite: { potency: 2, striking: 2, upgrades: 3 },
  Ultimate: { potency: 3, striking: 2, upgrades: 3 },
  Paragon: { potency: 3, striking: 3, upgrades: 4 },
}

export const SUPPLEMENTAL_WEAPONS = [HAFT_STRIKER_WEAPON, OVERSIZED_THROW, FIST, IRON_FIST, CAIRN_FIST, SPARK_FIST, ORC_TUSKS, TENGU_BITE, TENGU_DOGFANG_BITE,
  IRUXI_CLAWS, IRUXI_FANGS, IRUXI_TAIL, AUTOMATON_CLAW, AUTOMATON_PINCER, ...FIRST_WORLD_ARMAMENTS, ENERGY_BLAST, SKYFIRE_WING,
  CLAN_PISTOL, CLAN_DAGGER, CLAN_DAGGER_DEXTERITY, ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS, UNTAMED_CLAWS, UNTAMED_JAWS, GAUNTLET]

export function homebrewCompanions(entries: ContentEntry[]): ContentEntry[] {
  const variants = [
    { id: 'homebrew:riding-badger', name: 'Riding Badger', base: 'Badger', size: 'Small', mount: true,
      description: 'A stocky, sure-footed badger trained to carry a rider. Its strong digging claws and fierce temper serve it above and below ground.' },
    { id: 'homebrew:riding-dog', name: 'Riding Dog', base: 'Wolf', size: 'Medium', mount: true, riding: 'Horse',
      description: 'A large, sturdy hound bred to carry a rider, and the traditional mount of halflings. It keeps the pack tactics of its wild kin while bearing a rider\'s weight.' },
    { id: 'homebrew:sarkorian-direwolf', name: 'Sarkorian Direwolf', base: 'Isgeri Boarhound', size: 'Medium',
      description: "A powerful, keen-nosed direwolf raised among Sarkoris's hunting traditions. It tracks quarry over rough ground and fights alongside its bonded partner." },
    { id: 'homebrew:snow-leopard', name: 'Snow Leopard', base: 'Cat', size: 'Small',
      description: 'A pale-furred mountain cat whose spotted coat blends with snow and stone. It stalks prey with patience, then closes in with a sudden pounce.' },
  ]
  return variants.flatMap<ContentEntry>((variant) => {
    const base = entries.find((entry) => entry.kind === 'companion' && entry.source === 'official' && entry.systems.includes('pf2e') && !entry.deleted && entry.name === variant.base)
    if (!base) return []
    const rename = (text: string) => variant.name === 'Sarkorian Direwolf'
      ? text.replace(/\b(?:Isgeri )?boarhound(s?)\b/gi, (match: string, plural: string) => {
        const noun = plural ? 'direwolves' : 'direwolf'
        return /^[A-Z]/.test(match) ? noun[0].toUpperCase() + noun.slice(1) : noun
      }) : text
    const riding = variant.riding ? entries.find(entry => entry.kind === 'companion' && entry.source === 'official' && entry.systems.includes('pf2e') && !entry.deleted && entry.name === variant.riding) : undefined
    // A riding variant swaps in the mount's rider-oriented support benefit and maneuver
    const ridingRules = riding ? Object.fromEntries(Object.entries(riding.data)
      .filter(([key]) => key === 'companion_support' || key.startsWith('companion_maneuver'))
      .map(([key, value]) => [key, typeof value === 'string' ? value.replace(/\bhorse\b/g, 'dog').replace(/\bHorse\b/g, 'Dog') : value])) : {}
    return [{
      ...base, id: variant.id, name: variant.name, source: 'homebrew',
      traits: base.traits.filter(trait => trait.toLowerCase() !== 'mount'),
      description: variant.description,
      data: Object.fromEntries(Object.entries({ ...base.data, ...ridingRules, size: variant.size, mount: variant.mount ?? false, fixed_size: false })
        .map(([key, value]) => [key, typeof value === 'string' ? rename(value) : value])),
      // Fresh-device defaults must not supersede synced user edits or deletions.
      updatedAt: 1,
    }]
  })
}
