import { DeleteIcon, EditIcon } from './Icons'
import { confirmRemoval } from './confirmRemoval'
import { featDisplayName } from './featChoices'
import { equipmentDisplayName } from './equipmentGroups'
import type { ContentEntry, EntryKind } from './types'
import { HouseRules, matchingHouseRules } from './HouseRules'

const displayName = (entry: ContentEntry) => ['item', 'weapon', 'armor', 'shield'].includes(entry.kind)
  ? equipmentDisplayName(entry.name) : featDisplayName(entry)

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
  for (const entry of entries.filter((entry) => entry.source === 'homebrew' && !entry.deleted && !entry.data.retired)) {
    const names = entry.kind === 'feat' ? [...new Set([
      ...[entry.data.class, entry.data.ancestry, entry.data.archetype].flatMap((value) => typeof value === 'string' ? value.split(',').map((name) => name.trim()).filter(Boolean) : []),
      ...affiliations.filter((name) => entry.traits.some((trait) => trait.toLowerCase() === name.toLowerCase())),
    ])].map((name) => `${name} Feats`) : []
    if (!names.length) names.push(entry.kind === 'feat'
      ? entry.traits.includes('Skill') ? 'Skill Feats' : entry.traits.includes('General') ? 'General Feats' : entry.traits.includes('Archetype') ? 'Archetype Feats' : 'Other Feats'
      : entry.kind === 'item' && entry.data.item_category === 'Runes' ? 'Runes' : LABELS[entry.kind] ?? entry.kind)
    for (const name of names) {
      const group = groups.get(name) ?? []
      group.push(entry)
      groups.set(name, group)
    }
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b))
    .map(([name, content]) => ({ name, entries: content.sort((a, b) => displayName(a).localeCompare(displayName(b)) || a.level - b.level) }))
}

export function HomebrewList({ entries, search = '', onEdit, onDelete, rulesOpen, onRulesToggle }: {
  entries: ContentEntry[]
  search?: string
  onEdit: (entry: ContentEntry) => void
  onDelete: (id: string) => void
  rulesOpen?: boolean
  onRulesToggle?: (open: boolean) => void
}) {
  const query = search.trim().toLowerCase()
  const groups = groupHomebrew(entries).map(group => ({
    ...group, entries: query && !group.name.toLowerCase().includes(query)
      ? group.entries.filter(entry => [entry.name, displayName(entry)].some(name => name.toLowerCase().includes(query))) : group.entries,
  })).filter(group => group.entries.length)
  if (matchingHouseRules(search).length) groups.push({ name: 'Rules', entries: [] })
  if (query && !groups.length) return <p>No homebrew matches your search.</p>
  return groups.sort((a, b) => a.name.localeCompare(b.name)).map((group) => group.name === 'Rules'
    ? <HouseRules key="Rules" search={search} open={rulesOpen} onToggle={onRulesToggle} /> : (
    <details key={group.name} className="character-subsection homebrew-group" open={query ? true : undefined}>
      <summary><h3>{group.name} ({group.entries.length})</h3></summary>
      <ul className="character-list">
        {group.entries.map((entry) => (
          <li key={entry.id} className="character-row">
            <b>{displayName(entry)}</b>
            <span className="character-actions">
              <button type="button" className="icon-button" title="Edit content" aria-label={`Edit ${displayName(entry)}`} onClick={() => onEdit(entry)}><EditIcon /></button>
              <button type="button" className="icon-button" title="Delete content" aria-label={`Delete ${displayName(entry)}`}
                onClick={() => confirmRemoval(`homebrew "${displayName(entry)}"`, () => onDelete(entry.id))}><DeleteIcon /></button>
            </span>
          </li>
        ))}
      </ul>
    </details>
  ))
}
