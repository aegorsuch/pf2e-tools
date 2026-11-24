// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { DeferredContent, DeferredDetails } from './DeferredDetails'

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

it('builds deferred content only while open, preserving its state and refreshing it on reopen', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const body = vi.fn((value: string) => <div><span>{value}</span><input aria-label="Draft" defaultValue="initial" /></div>)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = (value: string) => <DeferredDetails><summary>Test</summary>
    <DeferredContent>{() => body(value)}</DeferredContent>
  </DeferredDetails>
  try {
    await act(async () => root.render(render('first')))
    expect(body).not.toHaveBeenCalled()
    const details = container.querySelector('details')!
    await act(async () => { details.open = true; details.dispatchEvent(new Event('toggle')) })
    expect(container.textContent).toContain('first')
    const input = container.querySelector('input')!
    input.value = 'draft'
    await act(async () => { details.open = false; details.dispatchEvent(new Event('toggle')) })
    const calls = body.mock.calls.length
    await act(async () => root.render(render('second')))
    expect(body).toHaveBeenCalledTimes(calls)
    await act(async () => { details.open = true; details.dispatchEvent(new Event('toggle')) })
    expect(container.textContent).toContain('second')
    expect(container.querySelector('input')).toBe(input)
    expect(input.value).toBe('draft')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
