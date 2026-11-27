import { expect, it } from 'vitest'
import { plain } from './plain'

it('normalizes whitespace and markup without changing ordinary spaces', () => {
  expect(plain('  [Swift *attack*](/test)\t<actions />\n  deals\u00a0  damage.  '))
    .toBe('Swift attack deals damage.')
  expect(plain('one two   three\tfour\nfive\u2028six\uFEFFseven')).toBe('one two three four five six seven')
  expect(plain(' \t\n\u00a0 ')).toBe('')
})
