import type { ContentEntry } from './types'

const GRADES = /^(?:(?:Commercial|Tactical|Advanced|Superior|Elite|Ultimate|Paragon) )| \((?:Commercial|Tactical|Advanced|Superior|Elite|Ultimate|Paragon)\)$/gi

export function isPurchasableMinibot(entry: ContentEntry) {
  if (entry.kind !== 'item' || entry.deleted || !entry.systems.includes('sf2e')) return false
  const categories = [entry.data.item_category, entry.data.item_subcategory, entry.data.equipment_category]
    .filter((value): value is string => typeof value === 'string')
  return /minibot/i.test(entry.name)
    || entry.traits.some(trait => /minibot/i.test(trait))
    || categories.some(category => /minibot|tech minion/i.test(category))
}

export function minibotBaseName(name: string) {
  return name.replace(GRADES, '').trim()
}

export function minibotUpgradeCost(current: ContentEntry, next: ContentEntry) {
  const currentPrice = Number(current.data.price)
  const nextPrice = Number(next.data.price)
  if (!Number.isFinite(currentPrice) || !Number.isFinite(nextPrice) || nextPrice <= currentPrice) return undefined
  return nextPrice - currentPrice
}

export function minibotUpgradeOptions(current: ContentEntry, entries: ContentEntry[]) {
  return entries.filter(entry => isPurchasableMinibot(entry)
    && minibotBaseName(entry.name).toLowerCase() === minibotBaseName(current.name).toLowerCase()
    && entry.level > current.level
    && minibotUpgradeCost(current, entry) !== undefined)
    .sort((a, b) => a.level - b.level || Number(a.data.price) - Number(b.data.price))
}

export function servoShellMinibotMaxHp(level: number) {
  return 4 + Math.max(0, Math.floor(level))
}
