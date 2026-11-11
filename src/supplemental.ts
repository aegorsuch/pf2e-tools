import type { ContentEntry } from './types'

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

export const SUPPLEMENTAL_WEAPONS = [HAFT_STRIKER_WEAPON, FIST, IRON_FIST, ORC_TUSKS, ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS]
