import type { ContentEntry } from './types'

export type SpellDefense = 'all' | 'ac' | 'save' | 'fortitude' | 'reflex' | 'will'

export function spellResolution(entry: ContentEntry) {
  const defense = ['saving_throw', 'save', 'saving_throw_dc']
    .map(key => entry.data[key]).find(value => value !== undefined && value !== null && String(value).trim())
  const text = `${defense ?? ''} ${[...entry.description.matchAll(/\b(?:Fortitude|Reflex|Will) (?:saving throws?|saves?)\b/gi)].map(match => match[0]).join(' ')}`
  return {
    save: /\b(?:Fortitude|Reflex|Will)\b/i.test(text),
    attack: entry.name !== 'Pulverizing Wake' && (entry.traits.some(trait => /^attack$/i.test(trait))
      || /\b(?:AC|Armor Class)\b/i.test(String(defense ?? ''))
      || /\b(?:make|attempt) (?:a |an )?(?:ranged |melee )?spell attack\b/i.test(entry.description)),
    text,
  }
}

export function matchesSpellDefense(entry: ContentEntry | undefined, filter: SpellDefense) {
  if (filter === 'all') return true
  if (!entry) return false
  const resolution = spellResolution(entry)
  if (filter === 'ac') return resolution.attack
  if (filter === 'save') return resolution.save
  return new RegExp(`\\b${filter}\\b`, 'i').test(resolution.text)
}
