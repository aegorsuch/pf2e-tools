import type { Character, ContentEntry } from './types'

export interface FeatAccessCheck {
  requirement: string
  automatic: boolean
  approved: boolean
}

function accessEthnicities(access: string) {
  return access.split(/\s+or\s+/i).flatMap((clause) => {
    const name = /^([a-z][a-z' -]*?) ethnicity$/i.exec(clause.trim())?.[1]
    return name && !/\b(?:any|and|you|your|must)\b/i.test(name) ? [name] : []
  })
}

export function ethnicityOptions(entries: ContentEntry[]) {
  return [...new Set(entries.filter(entry => !entry.deleted && entry.kind === 'feat')
    .flatMap(entry => [entry.data.access, entry.data.prerequisite]
      .flatMap(requirement => String(requirement ?? '').split(/[,;]|\s+and\s+/i).flatMap(accessEthnicities)))
    .map(name => name.replace(/\b[a-z]/g, letter => letter.toUpperCase())))]
    .sort((a, b) => a.localeCompare(b))
}

export function featAccess(c: Character, entry: ContentEntry): FeatAccessCheck | undefined {
  const access = String(entry.data.access ?? '').trim().replace(/\s+/g, ' ')
  const rarity = entry.traits.find(trait => /^(uncommon|rare|unique)$/i.test(trait))
    ?? (/^(uncommon|rare|unique)$/i.test(String(entry.data.rarity)) ? String(entry.data.rarity) : undefined)
  if (!access && !rarity) return undefined
  return {
    requirement: access || `${rarity}; no automatic access condition listed`,
    automatic: !!c.ethnicity && accessEthnicities(access).some(name => name.toLowerCase() === c.ethnicity!.trim().toLowerCase()),
    approved: c.featAccessOverrides?.includes(entry.id) ?? false,
  }
}
