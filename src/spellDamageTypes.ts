import type { ContentEntry } from './types'

const types = ['acid', 'bleed', 'bludgeoning', 'chaotic', 'cold', 'electricity', 'evil', 'fire', 'force',
  'good', 'lawful', 'mental', 'negative', 'piercing', 'poison', 'positive', 'slashing', 'sonic', 'spirit', 'vitality', 'void']
const typePattern = types.join('|')
const damagePhrase = new RegExp(`\\b(?:${typePattern})(?:\\s*(?:,\\s*(?:and\\s+|or\\s+)?|\\s+(?:and|or)\\s+)(?:persistent\\s+)?(?:${typePattern}))*\\s+damage\\b`, 'gi')
const damageType = new RegExp(`\\b(?:${typePattern})\\b`, 'gi')
const cache = new WeakMap<ContentEntry, string[]>()
const collator = new Intl.Collator(undefined, { sensitivity: 'base' })

export function spellDamageTypes(entry: ContentEntry | undefined): string[] {
  if (!entry) return []
  const cached = cache.get(entry)
  if (cached) return cached
  const found = new Set<string>()
  for (const match of String(entry.data.damage_type ?? '').matchAll(damageType)) found.add(match[0].toLowerCase())
  for (const match of entry.description.matchAll(damagePhrase)) {
    const prefix = entry.description.slice(Math.max(0, match.index - 35), match.index)
    if (/\b(?:resistance|weakness|immunity|immune)\s+(?:\d+\s+)?to\s*$/i.test(prefix)) continue
    for (const type of match[0].matchAll(damageType)) found.add(type[0].toLowerCase())
  }
  const result = [...found].sort()
  cache.set(entry, result)
  return result
}

export function spellDamageLabel(entry: ContentEntry | undefined) {
  const types = spellDamageTypes(entry)
  return types.length ? types.map(type => type[0].toUpperCase() + type.slice(1)).join(', ') : 'Other'
}

export function sortSpellsByDamage<T>(items: readonly T[], spell: (item: T) => ContentEntry | undefined, name: (item: T) => string) {
  return items.map(item => ({ item, damage: spellDamageTypes(spell(item)).join(', '), name: name(item) }))
    .sort((a, b) => Number(!a.damage) - Number(!b.damage)
      || collator.compare(a.damage, b.damage) || collator.compare(a.name, b.name))
    .map(({ item }) => item)
}
