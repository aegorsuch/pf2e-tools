export type PickerSortOrder = 'name' | 'level'

export function sortPickerOptions<T>(items: readonly T[], order: PickerSortOrder,
  name: (item: T) => string, level: (item: T) => number | undefined): T[] {
  return [...items].sort((a, b) => {
    const byName = name(a).localeCompare(name(b), undefined, { sensitivity: 'base' })
    if (order === 'name') return byName
    const aLevel = level(a) ?? Infinity
    const bLevel = level(b) ?? Infinity
    return (aLevel === bLevel ? 0 : aLevel - bLevel) || byName
  })
}

export function PickerSort({ value, onChange, label = 'Sort by' }: {
  value: PickerSortOrder; onChange: (value: PickerSortOrder) => void; label?: string
}) {
  return <label>Sort by{' '}
    <select aria-label={label} value={value} onChange={event => {
      if (event.target.value === 'name' || event.target.value === 'level') onChange(event.target.value)
    }}>
      <option value="name">Alphabetical</option>
      <option value="level">Level</option>
    </select>
  </label>
}
