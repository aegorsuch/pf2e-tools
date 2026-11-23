import { useMemo } from 'react'
import { EntryDescription } from './EntryDescription'
import type { ContentEntry, GameSystem } from './types'

export const formatTraitLabel = (trait: string) =>
  trait.replace(/(^|,\s*|-)([a-z])/g, (_, prefix: string, letter: string) => prefix + letter.toUpperCase())

export function GearTraits({ traits, entries, system }: { traits: string[]; entries: ContentEntry[]; system?: GameSystem }) {
  const definitions = useMemo(() => entries.filter(entry => entry.kind === 'trait' && !entry.deleted)
    .sort((a, b) => b.name.length - a.name.length), [entries])
  return <div className="gear-traits">
    {[...traits].sort((a, b) => a.localeCompare(b)).map(trait => {
      const name = trait.trim().toLowerCase()
      const matches = (entry: ContentEntry) => name === entry.name.toLowerCase() || name.startsWith(`${entry.name.toLowerCase()} `)
      const entry = definitions.find(entry => (!system || entry.systems.includes(system)) && matches(entry))
        ?? definitions.find(matches)
      return <EntryDescription key={trait} name={formatTraitLabel(trait)} entry={entry} className="gear-trait" />
    })}
  </div>
}
