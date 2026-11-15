import { activeFeatsNamed, isRanged, weaponEntry, weaponHands } from './builder'
import type { Character, ContentEntry, OwnedWeapon } from './types'

function itemBulk(entry?: ContentEntry) {
  const bulk = entry?.data.bulk
  return typeof bulk === 'number' && Number.isFinite(bulk) && bulk >= 0 ? bulk : undefined
}

function equipmentEntry(entries: ContentEntry[], name: string) {
  return entries.find(entry => entry.kind === 'item' && entry.name === name)
    ?? entries.find(entry => (entry.kind === 'weapon' || entry.kind === 'armor') && entry.name === name)
}

function cheekHolsterEligible(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const entry = weaponEntry(entries, weapon.name)
  const hands = weaponHands(entries, { ...weapon, handsHeld: 1 })
  const bulk = itemBulk(entry)
  const big = activeFeatsNamed(c, 'Big Mouth').length > 0
  return !!activeFeatsNamed(c, 'Cheek Holster').length && !!entry && isRanged(entry)
    && !entry.traits.some(trait => /^thrown$/i.test(trait)) && !/^crossbow$/i.test(String(entry.data.weapon_group))
    && !!hands && hands <= (big ? 2 : 1) && bulk !== undefined && bulk <= (big ? 2 : 1)
}

export function cheekPouchStatus(c: Character, entries: ContentEntry[]) {
  const portal = activeFeatsNamed(c, 'Interdimensional Cheek Portal').length > 0
  const big = activeFeatsNamed(c, 'Big Mouth').length > 0
  const items = c.equipment.filter(item => (item.cheekQty ?? 0) > 0)
    .map(item => ({ name: item.name, qty: item.cheekQty ?? 0, bulk: itemBulk(equipmentEntry(entries, item.name)), holstered: false,
      invalidQuantity: !Number.isInteger(item.cheekQty) || (item.cheekQty ?? 0) > item.qty
        || (item.cheekPreparedQty ?? 0) > (item.cheekQty ?? 0) }))
  const weapons = (c.weapons ?? []).filter(weapon => weapon.cheekStored)
    .map(weapon => ({ name: weapon.name, qty: 1, bulk: itemBulk(weaponEntry(entries, weapon.name)), holstered: !!weapon.cheekHolstered,
      invalidQuantity: !!weapon.cheekHolstered && !cheekHolsterEligible(c, entries, weapon) }))
  const stored = [...items, ...weapons]
  const count = stored.reduce((sum, item) => sum + item.qty, 0)
  const bulk = stored.reduce((sum, item) => sum + (item.bulk ?? 0) * item.qty, 0)
  const missingBulk = stored.some(item => item.bulk === undefined)
  const invalid = stored.some(item => item.invalidQuantity)
  const holstered = weapons.filter(item => item.holstered)
  const limit = portal ? 10 : big ? Math.max(1, ...holstered.map(item => item.bulk ?? 0)) : undefined
  const overLimit = holstered.length > 1 || (limit === undefined
    ? count > 4 || stored.some(item => item.bulk !== undefined && item.bulk > (item.holstered ? 1 : 0.1))
    : bulk > limit + 1e-9)
  const hasPouches = activeFeatsNamed(c, 'Cheek Pouches').length > 0
  return { stored, count, bulk, missingBulk, invalid, overLimit, hasPouches, portal, limit }
}

export function storeCheekItem(c: Character, entries: ContentEntry[], picked: string, prepare = false):
  { patch: Partial<Character> } | { error: string } {
  const selection = /^e:(\d+):(.+)$/.exec(picked)
  const equipmentIndex = selection ? Number(selection[1]) : -1
  const weaponId = picked.startsWith('w:') ? picked.slice(2) : ''
  const candidate = Number.isInteger(equipmentIndex) && equipmentIndex >= 0 ? c.equipment[equipmentIndex] : undefined
  const item = candidate && encodeURIComponent(candidate.name) === selection?.[2] ? candidate : undefined
  const weapons = c.weapons ?? []
  const weapon = weapons.find(candidate => candidate.id === weaponId)
  if (!cheekPouchStatus(c, entries).hasPouches) return { error: 'Cheek Pouches unavailable.' }
  if ((!item || (item.cheekQty ?? 0) >= item.qty) && (!weapon || weapon.cheekStored || weapon.attachedTo
    || c.equipment.some(existing => weapon.id === `eq-${existing.name}`)
    || (weaponHands(entries, weapon) ?? 0) === 0)) return { error: 'Choose an available item.' }
  if (prepare && item && (!activeFeatsNamed(c, 'Explosive Surprise').length
    || !equipmentEntry(entries, item.name)?.traits.some(trait => /^grenade$/i.test(trait))))
    return { error: 'Only grenades can be prepared with Explosive Surprise.' }
  if (prepare && weapon && !cheekHolsterEligible(c, entries, weapon))
    return { error: 'Cheek Holster requires an eligible firearm with known hands and Bulk.' }
  const equipment = item ? c.equipment.map((existing, index) => index === equipmentIndex
    ? { ...existing, cheekQty: (existing.cheekQty ?? 0) + 1,
      ...(prepare ? { cheekPreparedQty: (existing.cheekPreparedQty ?? 0) + 1 } : {}) } : existing) : c.equipment
  const nextWeapons = weapon ? weapons.map(existing => existing.id === weapon.id
    ? { ...existing, cheekStored: true, cheekHolstered: prepare, stowed: true } : existing) : weapons
  const next = cheekPouchStatus({ ...c, equipment, ...(weapon ? { weapons: nextWeapons } : {}) }, entries)
  if (next.missingBulk || next.invalid || next.overLimit) return {
    error: next.missingBulk ? 'Bulk unavailable; sync item data before storing.'
      : next.invalid ? 'Stored item or quantity is no longer eligible.' : 'Item exceeds cheek pouch capacity.',
  }
  return { patch: { equipment, ...(weapon ? { weapons: nextWeapons } : {}),
    ...(weapon && c.hardpointWeaponId === weapon.id ? { hardpointWeaponId: undefined } : {}) } }
}
