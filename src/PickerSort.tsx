export type PickerSortOrder = 'name' | 'level' | 'level-desc' | 'item-bonus'

const pickerNameCollator = new Intl.Collator(undefined, { sensitivity: 'base' })

export function sortPickerOptions<T>(items: readonly T[], order: PickerSortOrder,
  name: (item: T) => string, level: (item: T) => number | undefined): T[] {
  return [...items].sort((a, b) => {
    if (order === 'level') {
      const aLevel = level(a) ?? Infinity
      const bLevel = level(b) ?? Infinity
      const byLevel = aLevel === bLevel ? 0 : aLevel - bLevel
      if (byLevel) return byLevel
    } else if (order === 'level-desc') {
      const aLevel = level(a)
      const bLevel = level(b)
      if (aLevel === undefined) return bLevel === undefined ? 0 : 1
      if (bLevel === undefined) return -1
      if (aLevel !== bLevel) return bLevel - aLevel
    }
    return pickerNameCollator.compare(name(a), name(b))
  })
}

export function PickerSort({ value, onChange, label = 'Sort by', includeHighestLevel = false, includeItemBonus = false }: {
  value: PickerSortOrder; onChange: (value: PickerSortOrder) => void; label?: string; includeHighestLevel?: boolean; includeItemBonus?: boolean
}) {
  return <label>Sort by{' '}
    <select aria-label={label} value={value}     onChange={event => {
      const next = event.target.value
      if (next === 'name' || next === 'level' || next === 'level-desc' || next === 'item-bonus' && includeItemBonus) onChange(next)
    }}>
      <option value="name">Alphabetical</option>
      <option value="level">Level</option>
      {includeHighestLevel && <option value="level-desc">Highest level</option>}
      {includeItemBonus && <option value="item-bonus">Item bonus</option>}
    </select>
  </label>
}
