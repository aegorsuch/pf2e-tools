import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { GearTraits } from './GearTraits'
import type { ContentEntry } from './types'

const trait = (name: string, description: string, systems: ContentEntry['systems'] = ['pf2e']): ContentEntry => ({
  id: `${systems[0]}-${name}`, name, kind: 'trait', source: 'official', systems,
  level: 0, traits: [], description, data: {}, effects: [], updatedAt: 1,
})

it('opens definitions for exact and parameterized gear traits, preferring the longest matching trait name', () => {
  const entries = [trait('Fatal', 'Fatal rules.'), trait('Fatal Aim', 'Fatal Aim rules.'),
    trait('Agile', 'Agile rules.'), trait('Versatile', 'Versatile rules.'), trait('Jousting', 'Jousting rules.')]
  const markup = renderToStaticMarkup(<GearTraits entries={entries} traits={['Agile', 'Fatal Aim d12', 'Versatile P', 'Jousting']} />)
  for (const name of ['Agile', 'Fatal Aim d12', 'Versatile P', 'Jousting']) {
    expect(markup).toContain(`class="gear-trait" aria-haspopup="dialog">${name}</button>`)
  }
  expect(markup).toContain('Fatal Aim rules.')
  expect(markup).not.toContain('Fatal rules.')
  expect(markup).not.toContain('Level 0')
})

it('uses the equipment system definition and reports missing custom definitions instead of inventing rules', () => {
  const entries = [trait('Agile', 'Pathfinder rules.'), trait('Agile', 'Starfinder rules.', ['sf2e'])]
  const markup = renderToStaticMarkup(<GearTraits entries={entries} traits={['Agile', 'Custom Trait']} system="sf2e" />)
  expect(markup).toContain('Starfinder rules.')
  expect(markup).not.toContain('Pathfinder rules.')
  expect(markup).toContain('Description unavailable.')
  expect(markup).toContain('aria-haspopup="dialog">Custom Trait</button>')
})
