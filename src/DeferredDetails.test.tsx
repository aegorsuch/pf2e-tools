import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { DeferredDetails } from './DeferredDetails'

it('renders the summary without mounting the closed section body', () => {
  const body = vi.fn(() => <div>Expensive body</div>)
  const Body = body
  const markup = renderToStaticMarkup(<DeferredDetails>
    <summary>Equipment</summary>
    <Body />
  </DeferredDetails>)
  expect(markup).toContain('<summary>Equipment</summary>')
  expect(markup).not.toContain('Expensive body')
  expect(body).not.toHaveBeenCalled()
})
