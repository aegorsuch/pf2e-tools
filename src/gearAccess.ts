import { activeFeatsNamed, weaponAccessSources } from './builder'
import { featAccess, featRarity } from './featAccess'
import type { Character, ContentEntry } from './types'

export function gearAccess(c: Character, entries: ContentEntry[], entry: ContentEntry) {
  const rarity = featRarity(entry)
  const explicit = featAccess(c, entry)
  if (!rarity && !explicit) return undefined
  const historian = c.systems.includes('pf2e') && entry.systems.includes('pf2e')
    && featRarity(entry) === 'Uncommon'
    && ['orc', 'tattoo'].every(trait => entry.traits.some(value => value.toLowerCase() === trait))
    && entry.traits.some(value => ['magical', 'arcane', 'divine', 'occult', 'primal'].includes(value.toLowerCase()))
    && activeFeatsNamed(c, 'Tattooed Historian Dedication').length > 0
  const sources = [...(entry.kind === 'weapon' ? weaponAccessSources(c, entries, entry) : []),
    ...(historian ? ['Tattooed Historian Dedication'] : [])]
  const original = entry.data.named_weapon_source
    ? entries.find(candidate => candidate.kind === 'item' && candidate.name === entry.data.named_weapon_source) : undefined
  return {
    requirement: explicit?.requirement ?? '',
    automatic: !explicit || explicit.automatic || sources.length > 0,
    approved: c.gearAccessOverrides?.some(id => id === entry.id
      || !!original && (id === original.id || id.startsWith(`${original.id}:`))) ?? false,
    sources,
  }
}
