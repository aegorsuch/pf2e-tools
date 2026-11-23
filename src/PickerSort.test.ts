import { expect, it, vi } from 'vitest'
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

it('skips name lookups when levels determine the order', () => {
  const items = [{ name: 'Alpha', level: 2 }, { name: 'Beta', level: 1 }]
  const name = vi.fn((item: typeof items[number]) => item.name)
  expect(sortPickerOptions(items, 'level', name, item => item.level)).toEqual([items[1], items[0]])
  expect(name).not.toHaveBeenCalled()
})

it('sorts spell options by highest base level first so unheightened spells lead', () => {
  const spells = [
    { name: 'Heightened spell', level: 1 },
    { name: 'Unheightened spell', level: 3 },
    { name: 'Other unheightened spell', level: 3 },
  ]
  expect(sortPickerOptions(spells, 'level-desc', spell => spell.name, spell => spell.level).map(spell => spell.name))
    .toEqual(['Other unheightened spell', 'Unheightened spell', 'Heightened spell'])
})
