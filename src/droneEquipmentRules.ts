import { isRanged, proficiencyBonus, signed, weaponAttack, weaponCategory, weaponEntry, weaponHands } from './builder'
import { droneCustomizationSlots, droneStats } from './drone'
import type { Character, ContentEntry, OwnedWeapon } from './types'

export function droneEquipmentCapacity(c: Character) {
  const slots = droneCustomizationSlots(c)
  const commercial = slots ? (c.mechanicDroneCustomizations?.Commercial ?? []).slice(0, slots.Commercial) : []
  return {
    mounts: commercial.filter(item => item.name === 'Integrated Weapon Mount').length,
    armorUpgrades: Number(commercial.some(item => item.name === 'Upgrade Slot')),
    hands: commercial.some(item => item.name === 'Manual Dexterity') ? 2 : 0,
  }
}

export function droneMountedWeapons(c: Character, entries: ContentEntry[]) {
  let remaining = droneEquipmentCapacity(c).mounts
  let handsRemaining = droneEquipmentCapacity(c).hands
  return (c.mechanicDroneWeapons ?? []).map(weapon => {
    const entry = weaponEntry(entries, weapon.name)
    const hands = weaponHands(entries, weapon)
    const held = (c.mechanicDroneHeldWeaponIds ?? []).includes(weapon.id)
    const active = !!entry && entry.systems.includes('sf2e') && !!hands && hands <= (held ? handsRemaining : remaining)
    if (active && held) handsRemaining -= hands
    else if (active) remaining -= hands
    return { weapon, entry, hands, active, held }
  })
}

export function droneWeaponAttack(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const stats = droneStats(c, entries)
  if (!stats) return undefined
  const attack = weaponAttack(c, entries, weapon)
  const entry = attack.entry
  if (!entry) return undefined
  const traits = entry.traits.map(trait => trait.toLowerCase())
  const ranged = isRanged(entry)
  const thrown = traits.some(trait => trait.startsWith('thrown'))
  const mod = ranged ? stats.mods.dex : traits.includes('finesse') ? Math.max(stats.mods.dex, stats.mods.str) : stats.mods.str
  const rank = ['Simple', 'Martial'].includes(weaponCategory(entry)) ? stats.superior ? 2 : 1 : 0
  const match = /(\d+)d(\d+)\s*([A-Za-z]+)?/.exec(String(entry.data.damage ?? ''))
  const dice = Number(match?.[1] ?? 0)
  const flat = (!ranged || thrown ? stats.mods.str : traits.includes('propulsive') ? Math.floor(stats.mods.str / 2) : 0)
    + (c.mechanicDroneKillbotActive ? 2 * Math.min(dice, 4) : 0)
  const type = attack.damage.match(/[A-Za-z]+$/)?.[0] ?? String(entry.data.damage_type ?? '')
  return { ...attack, attack: mod + proficiencyBonus(rank, c.level), rank,
    damage: match ? `${dice}d${match[2]}${flat ? signed(flat) : ''}${type ? ` ${type}` : ''}` : '' }
}
