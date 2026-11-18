import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SourceNote } from './Info'

it.each(['Giant Instinct: clumsy 1', 'Haughty Obstinacy'])('keeps %s details clickable without an inline helper label', source => {
  const markup = renderToStaticMarkup(<SourceNote source={source} note="Conditional effect." />)
  expect(markup).toContain(`aria-label="${source} note"`)
  expect(markup).toContain('role="note">Conditional effect.')
  expect(markup).not.toContain(`>*</button> (${source})`)
})
