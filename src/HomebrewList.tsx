import { DeleteIcon, EditIcon } from './Icons'
import { confirmRemoval } from './confirmRemoval'
import { featDisplayName } from './featChoices'
import type { ContentEntry, EntryKind } from './types'

const LABELS: Partial<Record<EntryKind, string>> = {
  ancestry: 'Ancestries', armor: 'Armor', armorGroup: 'Armor Groups', background: 'Backgrounds', class: 'Classes',
  classFeature: 'Class Features', companion: 'Companions', companionAdv: 'Companion Advancements',
  companionSpec: 'Companion Specializations', deity: 'Deities', familiar: 'Familiars', heritage: 'Heritages',
  item: 'Gear', language: 'Languages', shield: 'Shields', spell: 'Spells', subclass: 'Subclasses',
  weapon: 'Weapons', weaponGroup: 'Weapon Groups',
}

export function groupHomebrew(entries: ContentEntry[]) {
  const affiliations = entries.filter((entry) => entry.kind === 'class' || entry.kind === 'ancestry').map((entry) => entry.name)
  const groups = new Map<string, ContentEntry[]>()
  for (const entry of entries.filter((entry) => entry.source === 'homebrew' && !entry.deleted)) {
    const names = entry.kind === 'feat' ? [...new Set([
      ...[entry.data.class, entry.data.ancestry, entry.data.archetype].flatMap((value) => typeof value === 'string' ? value.split(',').map((name) => name.trim()).filter(Boolean) : []),
      ...affiliations.filter((name) => entry.traits.some((trait) => trait.toLowerCase() === name.toLowerCase())),
    ])].map((name) => `${name} Feats`) : []
    if (!names.length) names.push(entry.kind === 'feat'
      ? entry.traits.includes('Skill') ? 'Skill Feats' : entry.traits.includes('General') ? 'General Feats' : entry.traits.includes('Archetype') ? 'Archetype Feats' : 'Other Feats'
      : LABELS[entry.kind] ?? entry.kind)
    for (const name of names) {
      const group = groups.get(name) ?? []
      group.push(entry)
      groups.set(name, group)
    }
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b))
    .map(([name, content]) => ({ name, entries: content.sort((a, b) => featDisplayName(a).localeCompare(featDisplayName(b)) || a.level - b.level) }))
}

export function HomebrewList({ entries, search = '', onEdit, onDelete }: {
  entries: ContentEntry[]
  search?: string
  onEdit: (entry: ContentEntry) => void
  onDelete: (id: string) => void
}) {
  const query = search.trim().toLowerCase()
  const groups = groupHomebrew(entries).map(group => ({
    ...group, entries: query && !group.name.toLowerCase().includes(query)
      ? group.entries.filter(entry => [entry.name, featDisplayName(entry)].some(name => name.toLowerCase().includes(query))) : group.entries,
  })).filter(group => group.entries.length)
  if (query && !groups.length) return <p>No homebrew matches your search.</p>
  return groups.map((group) => (
    <details key={group.name} className="character-subsection homebrew-group" open={query ? true : undefined}>
      <summary><h3>{group.name} ({group.entries.length})</h3></summary>
      <ul className="character-list">
        {group.entries.map((entry) => (
          <li key={entry.id} className="character-row">
            <b>{featDisplayName(entry)}</b>
            <span className="character-actions">
              <button type="button" className="icon-button" title="Edit content" aria-label={`Edit ${featDisplayName(entry)}`} onClick={() => onEdit(entry)}><EditIcon /></button>
              <button type="button" className="icon-button" title="Delete content" aria-label={`Delete ${featDisplayName(entry)}`}
                onClick={() => confirmRemoval(`homebrew "${featDisplayName(entry)}"`, () => onDelete(entry.id))}><DeleteIcon /></button>
            </span>
          </li>
        ))}
      </ul>
    </details>
  ))
}
