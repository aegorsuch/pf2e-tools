import { useMemo } from 'react'
import { EntryDescription } from './EntryDescription'
import type { ContentEntry, GameSystem } from './types'

export const formatTraitLabel = (trait: string) =>
  trait.replace(/(^|,\s*|-)([a-z])/g, (_, prefix: string, letter: string) => prefix + letter.toUpperCase())

export function GearTraits({ traits, entries, system, weaponGroup }: { traits: string[]; entries: ContentEntry[]; system?: GameSystem; weaponGroup?: string }) {
  const definitions = useMemo(() => entries.filter(entry => entry.kind === 'trait' && !entry.deleted)
    .sort((a, b) => b.name.length - a.name.length), [entries])
  const groupName = weaponGroup?.trim()
  const group = groupName ? entries.find(entry => entry.kind === 'weaponGroup' && !entry.deleted
    && (!system || entry.systems.includes(system)) && entry.name.toLowerCase() === groupName.toLowerCase())
    : undefined
  const labels = [...traits.map(trait => ({ name: trait, kind: 'trait' as const })),
    ...(groupName ? [{ name: groupName, kind: 'group' as const }] : [])]
  return <div className="gear-traits">
    {labels.sort((a, b) => a.name.localeCompare(b.name)).map(({ name: trait, kind }) => {
      const name = trait.trim().toLowerCase()
      const matches = (entry: ContentEntry) => name === entry.name.toLowerCase() || name.startsWith(`${entry.name.toLowerCase()} `)
      const entry = kind === 'group' ? group
        : definitions.find(entry => (!system || entry.systems.includes(system)) && matches(entry))
          ?? definitions.find(matches)
          ?? (system === 'sf2e' && name === 'concealed' ? entries.find(entry => entry.kind === 'item'
            && !entry.deleted && entry.systems.includes('sf2e') && /^Smuggler's Grip(?:\s*\(|$)/i.test(entry.name)) : undefined)
      return <EntryDescription key={`${kind}:${trait}`} name={formatTraitLabel(trait)} entry={entry} className="gear-trait" />
    })}
  </div>
}
