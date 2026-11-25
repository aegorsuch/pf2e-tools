import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ActionIcon } from './ActionIcon'
import { actionOptionLabel } from './actionCost'
import type { ContentEntry } from './types'

const entry: ContentEntry = {
  id: 'a', systems: ['pf2e'], kind: 'feat', name: 'Action', source: 'official', level: 1,
  traits: [], description: '', data: {}, effects: [], updatedAt: 0,
}

it('shows accessible action icons for AoN action costs and preserves mixed costs', () => {
  for (const [actions, icons] of [
    ['Single Action', 1], ['Two Actions', 1], ['Three Actions', 1],
    ['Free Action', 1], ['Reaction', 1], ['Reaction or Single Action', 2],
  ] as const) {
    const markup = renderToStaticMarkup(<ActionIcon entry={{ ...entry, data: { actions } }} />)
    expect(markup).toContain(`aria-label="${actions}"`)
    expect(markup.match(/<svg/g)).toHaveLength(icons)
    if (actions.includes(' or ')) expect(markup).toContain(' or ')
  }
  expect(renderToStaticMarkup(<ActionIcon entry={{ ...entry, data: { actions: '10 minutes' } }} />)).toBe('')
})

it('renders action costs supplied directly for companion maneuvers', () => {
  const markup = renderToStaticMarkup(<ActionIcon actions="Two Actions" />)
  expect(markup).toContain('aria-label="Two Actions"')
  expect(markup.match(/<svg/g)).toHaveLength(1)
  expect(renderToStaticMarkup(<ActionIcon actions="10 minutes" showOther />)).toBe('10 minutes')
})

it('renders compact 10-minute activity icon without changing accessible cast-time label', () => {
  const markup = renderToStaticMarkup(<ActionIcon actions="10 minutes" showOther compactOther />)
  expect(markup).toContain('aria-label="10 minutes"')
  expect(markup).toContain('<svg')
  expect(markup).toContain('10m')
  expect(markup).not.toContain('>10 minutes<')
})

it('formats picker action costs as inline symbols without redundant text', () => {
  expect(actionOptionLabel('Quick Draw', { ...entry, data: { actions: 'Single Action' } }))
    .toBe('Quick Draw ◆')
  expect(actionOptionLabel('Hunter\'s Aim', { ...entry, data: { actions: 'Two Actions' } }))
    .toBe('Hunter\'s Aim ◆◆')
  expect(actionOptionLabel('Reactive Strike', { ...entry, data: { actions: 'Reaction' } }))
    .toBe('Reactive Strike ↶')
  expect(actionOptionLabel('Long Ritual', { ...entry, data: { actions: '10 minutes' } }))
    .toBe('Long Ritual (10 minutes)')
})
