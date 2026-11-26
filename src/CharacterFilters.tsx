import { SearchableSelect } from './SearchableSelect'
import type { Character, ContentEntry, GameSystem } from './types'

export type CharacterFilterValues = { ancestry: string; className: string }

export const filterCharacters = (characters: Character[], filters: CharacterFilterValues) =>
  characters.filter(character => (!filters.ancestry || character.ancestry === filters.ancestry)
    && (!filters.className || character.className === filters.className))

export function CharacterFilters({ characters, entries = [], filters, onChange }: {
  characters: Character[]
  entries?: ContentEntry[]
  filters: CharacterFilterValues
  onChange: (filters: CharacterFilterValues) => void
}) {
  return <>{(['ancestry', 'className'] as const).map(field => {
    const options = [...new Set([...characters.map(character => character[field]), filters[field]]
      .filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b))
    const label = field === 'ancestry' ? 'ancestry' : 'class'
    const systems = (name: string): GameSystem[] => {
      const classes = entries.filter(entry => entry.kind === 'class' && entry.name === name && !entry.deleted)
      return [...new Set((classes.length ? classes : characters.filter(character => character.className === name))
        .flatMap(item => item.systems))]
    }
    return <SearchableSelect key={field} aria-label={`Filter characters by ${label}`} alwaysSearchable
      optionSystems={field === 'className' ? systems : undefined}
      value={filters[field]} onChange={event => onChange({ ...filters, [field]: event.target.value })}>
      <option value="">All {field === 'ancestry' ? 'ancestries' : 'classes'}</option>
      {options.map(value => <option key={value} value={value}>{value}</option>)}
    </SearchableSelect>
  })}</>
}
