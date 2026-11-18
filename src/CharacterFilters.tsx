import { SearchableSelect } from './SearchableSelect'
import type { Character } from './types'

export type CharacterFilterValues = { ancestry: string; className: string }

export const filterCharacters = (characters: Character[], filters: CharacterFilterValues) =>
  characters.filter(character => (!filters.ancestry || character.ancestry === filters.ancestry)
    && (!filters.className || character.className === filters.className))

export function CharacterFilters({ characters, filters, onChange }: {
  characters: Character[]
  filters: CharacterFilterValues
  onChange: (filters: CharacterFilterValues) => void
}) {
  return <>{(['ancestry', 'className'] as const).map(field => {
    const options = [...new Set([...characters.map(character => character[field]), filters[field]]
      .filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b))
    const label = field === 'ancestry' ? 'ancestry' : 'class'
    return <SearchableSelect key={field} aria-label={`Filter characters by ${label}`} alwaysSearchable
      value={filters[field]} onChange={event => onChange({ ...filters, [field]: event.target.value })}>
      <option value="">All {field === 'ancestry' ? 'ancestries' : 'classes'}</option>
      {options.map(value => <option key={value} value={value}>{value}</option>)}
    </SearchableSelect>
  })}</>
}
