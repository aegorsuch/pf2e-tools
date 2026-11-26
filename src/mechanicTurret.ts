import { activeFeatsNamed, automaticHardlightGrade, mechanicExocortexes, weaponAttack } from './builder'
import { HARDLIGHT_GRADES } from './supplemental'
import { getSettings } from './settings'
import type { Character, ContentEntry, HardlightGrade, OwnedWeapon } from './types'

export const TURRET_ARRAYS = {
  Chaingun: { damage: 'piercing', range: 90, trait: 'Analog', group: 'Projectile' },
  Disintegrator: { damage: 'acid', range: 60, trait: 'Tech', group: 'Corrosive' },
  'Laser Beam': { damage: 'fire', range: 60, trait: 'Tech', group: 'Laser' },
  Plasma: { damage: 'fire', range: 60, trait: 'Tech', group: 'Plasma' },
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
function extraArraysForFeat(c: Character, feat: Character['feats'][number], index: number) {
  const selected = feat.choice ? feat.choice.split(' + ') : (c.mechanicTurretExtraArrays ?? []).slice(index * 2, index * 2 + 2)
  return selected.filter((name): name is keyof typeof EXTRA_TURRET_ARRAYS => !!name && EXTRA_TURRET_NAMES.includes(name as keyof typeof EXTRA_TURRET_ARRAYS))
}

export function expansiveArrayChoices(c: Character, excludedIndex: number) {
  const feats = c.feats.filter(feat => feat.name === 'Expansive Array')
  const used = new Set(feats.flatMap((feat, index) =>
    c.feats.indexOf(feat) === excludedIndex ? [] : extraArraysForFeat(c, feat, index)))
  const available = EXTRA_TURRET_NAMES.filter(name => !used.has(name))
  return available.flatMap((name, index) => available.slice(index + 1).map(other => `${name} + ${other}`))
}

export function turretArrays(c: Character) {
  const feats = c.feats.filter(feat => feat.name === 'Expansive Array')
  const active = new Set(activeFeatsNamed(c, 'Expansive Array'))
  const selected = feats.filter(feat => active.has(feat)).slice(0, 2)
    .flatMap(feat => extraArraysForFeat(c, feat, feats.indexOf(feat)))
  return [...TURRET_NAMES.filter(name => name !== 'Plasma' || getSettings().plasmaTurret), ...new Set(selected)]
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
  const saved = c.mechanicTurretGrade && TURRET_GRADES.includes(c.mechanicTurretGrade) ? c.mechanicTurretGrade : 'Commercial'
  const grade = TURRET_GRADES[Math.max(TURRET_GRADES.indexOf(saved), TURRET_GRADES.indexOf(automaticHardlightGrade(c.level)))]
  const { potency, striking, upgrades } = HARDLIGHT_GRADES[grade]
  const entry: ContentEntry = {
    id: 'mechanic:turret', name: 'Mechanic Turret', kind: 'weapon',
    source: c.mechanicTurretArray === 'Plasma' ? 'homebrew' : 'official', systems: ['sf2e'],
    level: c.level, traits: [array.trait], description: '', effects: [], updatedAt: 0,
    data: { weapon_category: 'Martial', weapon_type: 'Ranged', weapon_group: array.group, turret_array: c.mechanicTurretArray ?? '',
      damage: `${1 + striking}d8 ${array.damage}`, range: array.range, weapon_tracking: potency,
      upgrade_slots: 1 + upgrades, hands: 0 },
  }
  const weapon: OwnedWeapon = { id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [],
    upgrades: (c.mechanicTurretUpgrades ?? []).slice(0, 1 + upgrades) }
  const attack = weaponAttack(c, [...entries, entry], weapon)
  return { entry, weapon, attack, grade }
}
