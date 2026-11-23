import { expect, it } from 'vitest'
import { sortPickerOptions } from './PickerSort'

it.each(['name', 'level'] as const)('preserves locale ordering and stable ties when sorting by %s', order => {
  const items = [
    { name: 'Éclair', level: 2 },
    { name: 'Alpha', level: undefined },
    { name: 'eclair', level: 2 },
    { name: 'Beta', level: 1 },
    { name: 'alpha', level: undefined },
  ]
  const expected = [...items].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    if (order === 'name') return byName
    const aLevel = a.level ?? Infinity
    const bLevel = b.level ?? Infinity
    return (aLevel === bLevel ? 0 : aLevel - bLevel) || byName
  })
  expect(sortPickerOptions(items, order, item => item.name, item => item.level)).toEqual(expected)
  expect(items.map(item => item.name)).toEqual(['Éclair', 'Alpha', 'eclair', 'Beta', 'alpha'])
})
