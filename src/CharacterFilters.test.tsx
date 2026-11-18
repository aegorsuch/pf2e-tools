import { Children, isValidElement, type ChangeEvent, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { CharacterFilters, filterCharacters } from './CharacterFilters'
import { SearchableSelect } from './SearchableSelect'
import type { Character } from './types'

const character = (name: string, ancestry?: string, className?: string, heritage?: string, subclass?: string): Character => ({
  id: name, name, ancestry, className, heritage, subclass, systems: ['pf2e'], level: 1,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], lores: [], languages: [], equipment: [], entryIds: [], extraSlots: [], updatedAt: 0,
})
const characters = [
  character('Alex', 'Human', 'Ranger', 'Pioneer Human', 'Outwit'),
  character('Harsk', 'Dwarf', 'Ranger', 'Strong-Blooded Dwarf', 'Precision'),
  character('Amiri', 'Human', 'Barbarian', 'Versatile Human', 'Giant'),
  character('Reaper'),
]

it('combines ancestry and base-class filters without treating heritages or subclasses as separate groups', () => {
  expect(filterCharacters(characters, { ancestry: '', className: '' })).toEqual(characters)
  expect(filterCharacters(characters, { ancestry: 'Human', className: '' }).map(c => c.name)).toEqual(['Alex', 'Amiri'])
  expect(filterCharacters(characters, { ancestry: '', className: 'Ranger' }).map(c => c.name)).toEqual(['Alex', 'Harsk'])
  expect(filterCharacters(characters, { ancestry: 'Human', className: 'Ranger' }).map(c => c.name)).toEqual(['Alex'])
  expect(filterCharacters(characters, { ancestry: 'Dwarf', className: 'Barbarian' })).toEqual([])
  expect(filterCharacters(characters, { ancestry: '', className: '' })).toHaveLength(4)
})

it('renders two filter buttons even with only one available character', () => {
  const markup = renderToStaticMarkup(<CharacterFilters characters={[characters[0]]}
    filters={{ ancestry: '', className: '' }} onChange={() => {}} />)
  expect(markup).toContain('aria-label="Filter characters by ancestry" aria-haspopup="dialog"')
  expect(markup).toContain('aria-label="Filter characters by class" aria-haspopup="dialog"')
  expect(markup).toContain('>All ancestries</button>')
  expect(markup).toContain('>All classes</button>')
})

it('keeps full-roster options alphabetized and allows clearing one filter without clearing the other', () => {
  const filters = { ancestry: 'Human', className: 'Ranger' }
  const onChange = vi.fn()
  const tree = CharacterFilters({ characters, filters, onChange })
  const controls = Children.toArray(tree.props.children).filter((node): node is ReactElement<Parameters<typeof SearchableSelect>[0]> =>
    isValidElement<Parameters<typeof SearchableSelect>[0]>(node) && node.type === SearchableSelect)
  const [ancestry, klass] = controls
  expect(renderToStaticMarkup(ancestry)).toContain('<option value="Dwarf">Dwarf</option><option value="Human" selected="">Human</option>')
  expect(renderToStaticMarkup(klass)).toContain('<option value="Barbarian">Barbarian</option><option value="Ranger" selected="">Ranger</option>')
  ancestry.props.onChange!({ target: { value: '' } } as ChangeEvent<HTMLSelectElement>)
  expect(onChange).toHaveBeenLastCalledWith({ ancestry: '', className: 'Ranger' })
  klass.props.onChange!({ target: { value: 'Barbarian' } } as ChangeEvent<HTMLSelectElement>)
  expect(onChange).toHaveBeenLastCalledWith({ ancestry: 'Human', className: 'Barbarian' })
})
