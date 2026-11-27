import type { ContentEntry } from './types'

export function spellTraits(entries: Iterable<ContentEntry>) {
  const traits = new Map<string, string>()
  for (const entry of entries) for (const trait of entry.traits) {
    const label = trait.trim()
    const key = label.toLowerCase()
    if (key && !traits.has(key)) traits.set(key, label)
  }
  return [...traits.entries()].sort((a, b) => a[1].localeCompare(b[1]))
}

export function matchesSpellTrait(entry: ContentEntry | undefined, trait: string) {
  return trait === 'all' || !!entry?.traits.some(value => value.trim().toLowerCase() === trait)
}

export function SpellTraitFilter({ value, traits, onChange }: {
  value: string; traits: [string, string][]; onChange: (value: string) => void
}) {
  return <select aria-label="Spell trait" value={value} onChange={event => onChange(event.target.value)}>
    <option value="all">All traits</option>
    {traits.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    {value !== 'all' && !traits.some(([key]) => key === value) && <option value={value}>{value}</option>}
  </select>
}
