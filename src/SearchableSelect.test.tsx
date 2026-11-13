import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SearchableSelect } from './SearchableSelect'
import { searchSelectOptions, selectOptionList } from './searchSelectOptions'

it('searches deity names and epithets while preserving canonical values and saved selections', () => {
  const options = <>
    <option value="">No deity</option>
    <option value="Abadar">Abadar, Master of the First Vault</option>
    <option value="Iomedae">Iomedae, the Inheritor</option>
    <option value="Sarenrae">Sarenrae, the Dawnflower</option>
  </>
  const children = options.props.children
  const result = searchSelectOptions(children, '  INHERITOR  ', 'Abadar')
  const markup = renderToStaticMarkup(<select value="Abadar" onChange={() => {}}>{result.children}</select>)
  expect(result.matches).toBe(1)
  expect(markup).toContain('<option value="">No deity</option>')
  expect(markup).toContain('<option value="Abadar" selected="">')
  expect(markup).toContain('<option value="Iomedae">Iomedae, the Inheritor</option>')
  expect(markup).not.toContain('Sarenrae')
})

it('filters grouped choices without enabling unavailable options or dropping unknown saved values', () => {
  const children = [
    <option key="none" value="">Choose feat</option>,
    <option key="saved" value="old" disabled>Unavailable saved feat</option>,
    <optgroup key="one" label="Level 1">
      <option value="a">Alpha</option>
      <option value="b" disabled>Beta (missing prerequisite)</option>
    </optgroup>,
    <optgroup key="two" label="Level 2"><option value="g">Gamma</option></optgroup>,
  ]
  const filtered = searchSelectOptions(children, 'beta', 'old')
  const markup = renderToStaticMarkup(<select value="old" onChange={() => {}}>{filtered.children}</select>)
  expect(filtered.matches).toBe(1)
  expect(markup).toContain('<option value="old" disabled="" selected="">')
  expect(markup).toContain('<optgroup label="Level 1">')
  expect(markup).toContain('<option value="b" disabled="">Beta')
  expect(markup).not.toContain('Alpha')
  expect(markup).not.toContain('Level 2')
  const empty = searchSelectOptions(children, 'no such feat', 'old')
  expect(empty.matches).toBe(0)
  expect(renderToStaticMarkup(<select value="old" onChange={() => {}}>{empty.children}</select>))
    .toContain('Unavailable saved feat')
})

it('opens large lists through a disabled-aware popup trigger without an external search bar', () => {
  const markup = renderToStaticMarkup(<SearchableSelect label="Background" aria-label="Background" value="Scholar" optionCount={100} disabled>
    <option value="Scholar">Scholar</option>
  </SearchableSelect>)
  expect(markup).not.toContain('type="search"')
  expect(markup).toContain('aria-label="Background" aria-haspopup="dialog" aria-expanded="false" disabled=""')
  expect(markup).toContain('<select aria-label="Background" disabled=""')
  expect(markup).toContain('hidden=""')
  expect(markup).toContain('<option value="Scholar" selected="">')
})

it.each([0, 2, 10, 11])('only uses a popup for long lists with %i choices, excluding the placeholder', count => {
  const markup = renderToStaticMarkup(<SearchableSelect aria-label="Armor material" value="">
    <option value="">Add material</option>
    <optgroup label="Materials">
      {Array.from({ length: count }, (_, index) => <option key={index} value={`material-${index}`}>Material {index}</option>)}
    </optgroup>
  </SearchableSelect>)
  expect(markup).not.toContain('type="search"')
  expect(markup.includes('aria-haspopup="dialog"')).toBe(count > 10)
  expect(markup).toContain('<select aria-label="Armor material"')
})

it('preserves canonical option values, epithets and disabled groups for popup choices', () => {
  expect(selectOptionList(<>
    <option value="">No deity</option>
    <optgroup label="Unavailable" disabled><option value="Abadar">Abadar, Master of the First Vault</option></optgroup>
    <option value="Iomedae" disabled>Iomedae, the Inheritor</option>
  </>)).toEqual([
    { value: '', label: 'No deity', disabled: false, group: undefined },
    { value: 'Abadar', label: 'Abadar, Master of the First Vault', disabled: true, group: 'Unavailable' },
    { value: 'Iomedae', label: 'Iomedae, the Inheritor', disabled: true, group: undefined },
  ])
})
