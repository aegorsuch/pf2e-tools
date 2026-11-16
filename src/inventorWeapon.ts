import { featTakenLevel } from './featChoices'
import type { Character, ContentEntry, OwnedWeapon } from './types'

export type WeaponModificationSlot = 'initial' | 'breakthrough' | 'revolutionary' | 'manifold' | 'basic'
type Tier = 'initial' | 'breakthrough' | 'revolutionary'
export type WeaponModification = { name: string; tier: Tier; note: string }

export const WEAPON_MODIFICATIONS: WeaponModification[] = [
  { name: 'Blunt Shot', tier: 'initial', note: 'Ranged only. Adds Concussive and Ranged Trip.' },
  { name: 'Complex Simplicity', tier: 'initial', note: 'Simple weapons only. Increase the damage die one step and choose two traits: Versatile B, P, or S, or Razing.' },
  { name: 'Dynamic Weighting', tier: 'initial', note: 'One-handed melee only; excludes Agile, Attached, and Free-Hand. Adds Two-Hand with a one-step-higher die and Versatile B; thrown weapons also gain Tethered.' },
  { name: 'Entangling Form', tier: 'initial', note: 'Melee only. Adds Disarm, Grapple, and Trip.' },
  { name: 'Hampering Spikes', tier: 'initial', note: 'Melee only. Adds Hampering, Trip, and Versatile P.' },
  { name: 'Hefty Composition', tier: 'initial', note: 'Melee only. Adds Shove, Razing, and Versatile B.' },
  { name: 'Modular Head', tier: 'initial', note: 'Adds Modular B/P/S; Interact can also add or remove Nonlethal.' },
  { name: 'Pacification Tools', tier: 'initial', note: 'Melee only. Adds Disarm, Hampering, and Nonlethal; choose whether each attack is Nonlethal.' },
  { name: 'Razor Prongs', tier: 'initial', note: 'Melee only. Adds Tearing, Trip, and Versatile S.' },
  { name: 'Segmented Frame', tier: 'initial', note: 'Adds Modular B/P/S. Collapse to light Bulk; while collapsed, gain Concealable.' },
  { name: 'Advanced Design', tier: 'initial', note: 'Use a level 0 advanced weapon you have access to; treat it as martial for proficiency.' },
  { name: 'Advanced Rangefinder', tier: 'breakthrough', note: 'Ranged only. Adds Backstabber and increases range increment by 20 feet.' },
  { name: 'Aerodynamic Construction', tier: 'breakthrough', note: 'Melee only. Adds Sweep and Versatile S.' },
  { name: 'Inconspicuous Appearance', tier: 'breakthrough', note: 'Melee only. Adds Backstabber and Versatile P; also adds Concealable if the weapon has light Bulk.' },
  { name: 'Integrated Gauntlet', tier: 'breakthrough', note: 'One-handed only; excludes Two-Hand and Fatal Aim. Adds Free-Hand.' },
  { name: 'Manifold Alloy', tier: 'breakthrough', note: 'The weapon counts as cold iron and silver.' },
  { name: 'Rope Shot', tier: 'breakthrough', note: 'Ranged only. Adds Climbing and Ranged Trip; thrown weapons also gain Tethered.' },
  { name: 'Tangle Line', tier: 'breakthrough', note: 'Thrown weapons only. Adds Parry, Ranged Trip, and Tethered.' },
  { name: 'Attack Refiner', tier: 'revolutionary', note: 'Adds Backswing and Forceful.' },
  { name: 'Deadly Strike', tier: 'revolutionary', note: 'Adds Deadly d8; if already Deadly, increase its die by up to two sizes, to d12.' },
  { name: 'Enhanced Damage', tier: 'revolutionary', note: 'Increase the weapon damage die one step; does not stack with Complex Simplicity.' },
  { name: 'Extensible Weapon', tier: 'revolutionary', note: 'Melee only. Adds Reach, or increases existing Reach by 10 feet.' },
  { name: 'Impossible Alloy', tier: 'revolutionary', note: 'The weapon counts as all seven skymetals against weaknesses.' },
  { name: 'Momentum Enhancer', tier: 'revolutionary', note: 'Adds Agile; a weapon with Reload can be reloaded once per round as a free action.' },
  { name: 'Omnirange Stabilizers', tier: 'revolutionary', note: 'Ranged only. Removes Volley, or increases range by 50 feet or its base increment, whichever is greater.' },
  { name: 'Rune Capacity', tier: 'revolutionary', note: 'Allows one additional property rune, up to five with Orichalcum.' },
]

const slotTier: Record<WeaponModificationSlot, number> = {
  initial: 0, breakthrough: 1, revolutionary: 2, manifold: 0, basic: 0,
}
const modificationTier: Record<Tier, number> = { initial: 0, breakthrough: 1, revolutionary: 2 }
const complexTraits = ['Razing', 'Versatile B', 'Versatile P', 'Versatile S']

function activeFeat(c: Character, name: string) {
  return c.feats.some(feat => feat.name === name && featTakenLevel(feat) <= c.level)
}

function canUseModification(name: string, weapon?: ContentEntry) {
  if (!weapon) return false
  const category = String(weapon.data.weapon_category ?? '').toLowerCase()
  const ranged = /ranged/i.test(String(weapon.data.weapon_type ?? '')) || Number(weapon.data.range) > 0
  const traits = (weapon.traits ?? []).map(trait => trait.toLowerCase())
  const has = (trait: RegExp) => traits.some(value => trait.test(value))
  const melee = !ranged
  const thrown = has(/^thrown(?:\s|$)/)
  const oneHanded = Number(weapon.data.hands) === 1
  switch (name) {
    case 'Blunt Shot':
    case 'Advanced Rangefinder':
    case 'Rope Shot':
    case 'Omnirange Stabilizers':
      return ranged
    case 'Complex Simplicity':
      return category === 'simple'
    case 'Dynamic Weighting':
      return melee && oneHanded && !has(/^agile$/) && !has(/^attached\b/) && !has(/^free-hand\b/)
    case 'Entangling Form':
    case 'Hampering Spikes':
    case 'Hefty Composition':
    case 'Pacification Tools':
    case 'Razor Prongs':
    case 'Aerodynamic Construction':
    case 'Inconspicuous Appearance':
    case 'Extensible Weapon':
      return melee
    case 'Integrated Gauntlet':
      return oneHanded && !has(/^two-hand\b/) && !has(/^fatal aim\b/)
    case 'Tangle Line':
      return thrown
    default:
      return true
  }
}

export function weaponModificationSlots(c: Character, weapon: OwnedWeapon, entry?: ContentEntry): WeaponModificationSlot[] {
  if (!c.systems.includes('pf2e') || !weapon.inventorInnovation) return []
  const slots: WeaponModificationSlot[] = []
  if (c.className === 'Inventor') {
    if (String(entry?.data.weapon_category ?? '').toLowerCase() !== 'advanced') slots.push('initial')
    if (c.level >= 7) slots.push('breakthrough')
    if (c.level >= 15) slots.push('revolutionary')
    if (activeFeat(c, 'Manifold Modifications')) slots.push('manifold')
  }
  if (activeFeat(c, 'Basic Modification')) slots.push('basic')
  return slots
}

export function weaponModificationOptions(
  c: Character, weapon: OwnedWeapon, entry: ContentEntry | undefined, slot: WeaponModificationSlot,
): WeaponModification[] {
  if (!c.systems.includes('pf2e') || !weapon.inventorInnovation) return []
  const current = weapon.inventorModifications?.[slot]
  const selected = new Set(Object.entries(weapon.inventorModifications ?? {})
    .filter(([key, name]) => key !== slot && typeof name === 'string').map(([, name]) => name as string))
  const hasComplexSimplicity = [...selected].includes('Complex Simplicity')
    || current === 'Complex Simplicity'
  const hasEnhancedDamage = [...selected].includes('Enhanced Damage')
    || current === 'Enhanced Damage'
  return WEAPON_MODIFICATIONS.filter(option => modificationTier[option.tier] <= slotTier[slot]
    && canUseModification(option.name, entry)
    && (option.name === current || !selected.has(option.name))
    && !(option.name === 'Complex Simplicity' && hasEnhancedDamage)
    && !(option.name === 'Enhanced Damage' && hasComplexSimplicity))
}

export function hasWeaponRuneCapacity(c: Character, weapon: OwnedWeapon, entry?: ContentEntry) {
  return weaponModificationSlots(c, weapon, entry).some(slot =>
    weapon.inventorModifications?.[slot] === 'Rune Capacity'
    && weaponModificationOptions(c, weapon, entry, slot).some(option => option.name === 'Rune Capacity'))
}

export function complexSimplicityTraits() {
  return [...complexTraits]
}

export function weaponWithModifications(c: Character, weapon: OwnedWeapon, entry?: ContentEntry) {
  if (!entry) return entry
  const selected = weaponModificationSlots(c, weapon, entry).flatMap(slot => {
    const name = weapon.inventorModifications?.[slot]
    return name ? weaponModificationOptions(c, weapon, entry, slot).filter(option => option.name === name) : []
  }).map(option => option.name)
  if (!selected.length) return entry
  const traits = [...entry.traits]
  const addTraits: Record<string, string[]> = {
    'Blunt Shot': ['Concussive', 'Ranged Trip'],
    'Dynamic Weighting': ['Versatile B', ...(entry.traits.some(trait => /^thrown\b/i.test(trait)) ? ['Tethered'] : [])],
    'Entangling Form': ['Disarm', 'Grapple', 'Trip'],
    'Hampering Spikes': ['Hampering', 'Trip', 'Versatile P'],
    'Hefty Composition': ['Shove', 'Razing', 'Versatile B'],
    'Modular Head': ['Modular B/P/S'],
    'Pacification Tools': ['Disarm', 'Hampering', 'Nonlethal'],
    'Razor Prongs': ['Tearing', 'Trip', 'Versatile S'],
    'Advanced Rangefinder': ['Backstabber'],
    'Aerodynamic Construction': ['Sweep', 'Versatile S'],
    'Inconspicuous Appearance': ['Backstabber', 'Versatile P'],
    'Integrated Gauntlet': ['Free-Hand'],
    'Rope Shot': ['Climbing', 'Ranged Trip', ...(entry.traits.some(trait => /^thrown\b/i.test(trait)) ? ['Tethered'] : [])],
    'Tangle Line': ['Parry', 'Ranged Trip', 'Tethered'],
    'Attack Refiner': ['Backswing', 'Forceful'],
    'Momentum Enhancer': ['Agile'],
    'Extensible Weapon': ['Reach 10 feet'],
  }
  for (const name of selected) {
    for (const trait of addTraits[name] ?? []) {
      if (!traits.some(existing => existing.toLowerCase() === trait.toLowerCase())) traits.push(trait)
    }
  }
  const damage = String(entry.data.damage ?? '')
  const damageMatch = /^(\d+d)(4|6|8|10|12)(.*)$/i.exec(damage)
  const selectedComplexTraits = selected.includes('Complex Simplicity')
    ? (weapon.inventorModifications?.complexSimplicityTraits ?? []).filter(trait => complexTraits.includes(trait)) : []
  const complexSimplicityComplete = selectedComplexTraits.length === 2 && new Set(selectedComplexTraits).size === 2
  const increasesDamage = selected.includes('Enhanced Damage') || complexSimplicityComplete
  const nextDie: Record<string, string> = { '4': '6', '6': '8', '8': '10', '10': '12', '12': '12' }
  const modifiedDamage = damageMatch && increasesDamage
    ? `${damageMatch[1]}${nextDie[damageMatch[2]]}${damageMatch[3]}` : damage
  if (increasesDamage) {
    for (let index = 0; index < traits.length; index++) {
      const twoHand = /^two-hand\s+(?:1)?d(4|6|8|10|12)$/i.exec(traits[index].trim())
      if (twoHand) traits[index] = `Two-Hand d${nextDie[twoHand[1]]}`
    }
  }
  if (selected.includes('Dynamic Weighting')) {
    const modifiedDie = /^(\d+d)(4|6|8|10|12)/i.exec(modifiedDamage)?.[2]
    if (modifiedDie) {
      const existingDie = traits.map(trait => /^two-hand\s+(?:1)?d(4|6|8|10|12)$/i.exec(trait.trim())?.[1]).find(Boolean)
      const die = Math.max(Number(nextDie[modifiedDie]), Number(existingDie ?? 0))
      for (let index = traits.length - 1; index >= 0; index--) {
        if (/^two-hand\b/i.test(traits[index])) traits.splice(index, 1)
      }
      traits.push(`Two-Hand d${die}`)
    }
  }
  for (const trait of complexSimplicityComplete ? selectedComplexTraits : []) {
    if (!traits.some(existing => existing.toLowerCase() === trait.toLowerCase())) traits.push(trait)
  }
  const baseRange = Number(entry.data.range) || 0
  const range = selected.includes('Advanced Rangefinder') ? baseRange + 20
    : selected.includes('Omnirange Stabilizers') ? baseRange + Math.max(50, baseRange) : baseRange
  return {
    ...entry,
    traits,
    data: {
      ...entry.data,
      damage: modifiedDamage,
      ...(range ? { range } : {}),
    },
  }
}
