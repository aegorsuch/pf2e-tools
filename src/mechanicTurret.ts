import { activeFeatsNamed, mechanicExocortexes, weaponAttack } from './builder'
import { HARDLIGHT_GRADES } from './supplemental'
import type { Character, ContentEntry, HardlightGrade, OwnedWeapon } from './types'

export const TURRET_ARRAYS = {
  Chaingun: { damage: 'piercing', range: 90, trait: 'Analog', group: 'Projectile' },
  Disintegrator: { damage: 'acid', range: 60, trait: 'Tech', group: 'Corrosive' },
  'Laser Beam': { damage: 'fire', range: 60, trait: 'Tech', group: 'Laser' },
  Thunderclap: { damage: 'sonic', range: 60, trait: 'Tech', group: 'Sonic' },
  'Volt Thrower': { damage: 'electricity', range: 60, trait: 'Tech', group: 'Shock' },
  'Zero Emitter': { damage: 'cold', range: 60, trait: 'Tech', group: 'Cryo' },
} as const
export const TURRET_NAMES = Object.keys(TURRET_ARRAYS) as Array<keyof typeof TURRET_ARRAYS>
export const EXTRA_TURRET_ARRAYS = {
  'Mental Array': { damage: 'mental', range: 60, trait: 'Tech', group: 'Mental' },
  'Poison Array': { damage: 'poison', range: 60, trait: 'Tech', group: 'Dart' },
  'Vitality Array': { damage: 'vitality', range: 60, trait: 'Tech', group: 'Laser' },
  'Void Array': { damage: 'void', range: 60, trait: 'Tech', group: 'Void' },
} as const
export const EXTRA_TURRET_NAMES = Object.keys(EXTRA_TURRET_ARRAYS) as Array<keyof typeof EXTRA_TURRET_ARRAYS>
const ALL_TURRET_ARRAYS = { ...TURRET_ARRAYS, ...EXTRA_TURRET_ARRAYS }
export function turretArrays(c: Character) {
  const slots = Math.min(4, activeFeatsNamed(c, 'Expansive Array').length * 2)
  const selected = (c.mechanicTurretExtraArrays ?? []).slice(0, slots)
    .filter((name): name is keyof typeof EXTRA_TURRET_ARRAYS => !!name && EXTRA_TURRET_NAMES.includes(name))
  return [...TURRET_NAMES, ...new Set(selected)]
}
export function turretArray(c: Character) {
  const name = c.mechanicTurretArray
  if (!name || !turretArrays(c).some(candidate => candidate === name)) return undefined
  return ALL_TURRET_ARRAYS[name]
}
export const TURRET_GRADES = Object.keys(HARDLIGHT_GRADES) as HardlightGrade[]

export function turretWeapon(c: Character, entries: ContentEntry[]) {
  if (!c.systems.includes('sf2e') || !mechanicExocortexes(c).includes('Turret')) return undefined
  const array = turretArray(c)
  if (!array) return undefined
  const grade = c.mechanicTurretGrade && TURRET_GRADES.includes(c.mechanicTurretGrade) ? c.mechanicTurretGrade : 'Commercial'
  const { potency, striking, upgrades } = HARDLIGHT_GRADES[grade]
  const entry: ContentEntry = {
    id: 'mechanic:turret', name: 'Mechanic Turret', kind: 'weapon', source: 'official', systems: ['sf2e'],
    level: c.level, traits: [array.trait], description: '', effects: [], updatedAt: 0,
    data: { weapon_category: 'Martial', weapon_type: 'Ranged', weapon_group: array.group,
      damage: `${1 + striking}d8 ${array.damage}`, range: array.range, weapon_tracking: potency,
      upgrade_slots: 1 + upgrades, hands: 0 },
  }
  const weapon: OwnedWeapon = { id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [],
    upgrades: (c.mechanicTurretUpgrades ?? []).slice(0, 1 + upgrades) }
  const attack = weaponAttack(c, [...entries, entry], weapon)
  return { entry, weapon, attack, grade }
}
