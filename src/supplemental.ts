import type { ContentEntry, HardlightGrade } from './types'

export const HAFT_STRIKER_WEAPON: ContentEntry = {
  id: 'supplemental:haft-striker-stance',
  systems: ['pf2e'],
  kind: 'weapon',
  source: 'official',
  name: 'Haft Striker Stance',
  level: 0,
  traits: ['Agile', 'Finesse'],
  description: 'You treat the haft of your wielded weapon as a simple weapon dealing 1d4 bludgeoning damage. The haft is in the club group and has the agile and finesse traits.',
  data: { weapon_category: 'Simple', weapon_group: 'Club', weapon_type: 'Melee', damage: '1d4 bludgeoning' },
  effects: [],
  updatedAt: 1,
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

export const ORC_TUSKS: ContentEntry = {
  ...FIST, id: 'supplemental:orc-tusks', name: 'Tusks',
  traits: ['Finesse', 'Unarmed'],
  description: 'Tusks grants a 1d6 piercing unarmed attack in the brawling group with finesse.',
  data: { ...FIST.data, damage: '1d6 piercing', url: 'https://2e.aonprd.com/Feats.aspx?ID=4519' },
}

export const GAUNTLET: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:full-plate-gauntlet', name: 'Gauntlet',
  traits: ['Agile', 'Free-Hand'],
  description: 'Full plate includes gauntlets that can be used as simple weapons dealing 1d4 bludgeoning damage.',
  data: { weapon_category: 'Simple', weapon_group: 'Brawling', weapon_type: 'Melee', damage: '1d4 bludgeoning' },
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

export const SUPPLEMENTAL_WEAPONS = [HAFT_STRIKER_WEAPON, FIST, IRON_FIST, ORC_TUSKS, ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS, GAUNTLET]

export function homebrewCompanions(entries: ContentEntry[]): ContentEntry[] {
  const variants = [
    { id: 'homebrew:sarkorian-direwolf', name: 'Sarkorian Direwolf', base: 'Isgeri Boarhound', size: 'Large' },
    { id: 'homebrew:snow-leopard', name: 'Snow Leopard', base: 'Cat', size: 'Medium' },
  ]
  return variants.flatMap<ContentEntry>((variant) => {
    const base = entries.find((entry) => entry.kind === 'companion' && entry.source === 'official' && entry.systems.includes('pf2e') && !entry.deleted && entry.name === variant.base)
    if (!base) return []
    return [{
      ...base, id: variant.id, name: variant.name, source: 'homebrew',
      traits: [...new Set([...base.traits, 'Mount'])],
      description: `Based on ${base.name}. Starts ${variant.size} and never grows larger; has the Mount trait.\n\n${base.description}`,
      data: { ...base.data, size: variant.size, mount: true, fixed_size: true },
      // Fresh-device defaults must not supersede synced user edits or deletions.
      updatedAt: 1,
    }]
  })
}
