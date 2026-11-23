export type PickerSortOrder = 'name' | 'level'

const pickerNameCollator = new Intl.Collator(undefined, { sensitivity: 'base' })

export function sortPickerOptions<T>(items: readonly T[], order: PickerSortOrder,
  name: (item: T) => string, level: (item: T) => number | undefined): T[] {
  return [...items].sort((a, b) => {
    if (order === 'level') {
      const aLevel = level(a) ?? Infinity
      const bLevel = level(b) ?? Infinity
      const byLevel = aLevel === bLevel ? 0 : aLevel - bLevel
      if (byLevel) return byLevel
    }
    return pickerNameCollator.compare(name(a), name(b))
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
