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
    trait('Agile', 'Agile rules.'), trait('Versatile', 'Versatile rules.'), trait('Jousting', 'Jousting rules.'),
    trait('Volley', 'Volley rules.')]
  const markup = renderToStaticMarkup(<GearTraits entries={entries} traits={['Agile', 'Fatal Aim d12', 'Versatile P', 'Jousting', 'Volley (if beneficial)']} />)
  for (const name of ['Agile', 'Fatal Aim d12', 'Versatile P', 'Jousting', 'Volley (if beneficial)']) {
    expect(markup).toContain(`class="gear-trait" aria-haspopup="dialog">${name}</button>`)
  }
  expect(markup).toContain('Fatal Aim rules.')
  expect(markup).toContain('Volley rules.')
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

it('shows weapon groups alongside traits with the correct system critical specialization', () => {
  const entries = [
    { ...trait('Plasma', 'Pathfinder group.'), kind: 'weaponGroup' as const },
    { ...trait('Plasma', 'Starfinder plasma critical effect.', ['sf2e']), kind: 'weaponGroup' as const },
    trait('Tech', 'Tech rules.', ['sf2e']),
  ]
  const markup = renderToStaticMarkup(<GearTraits entries={entries} traits={['Tech']} weaponGroup="Plasma" system="sf2e" />)
  expect(markup).toContain('aria-haspopup="dialog">Plasma</button>')
  expect(markup).toContain('Starfinder plasma critical effect.')
  expect(markup).not.toContain('Pathfinder group.')
  expect(markup).not.toContain('Level 0')
  expect(markup.indexOf('>Plasma</button>')).toBeLessThan(markup.indexOf('>Tech</button>'))
})

it('uses the Smuggler’s Grip description for its Concealed trait when no trait definition exists', () => {
  const grip = { ...trait("Smuggler's Grip (Tactical)", 'The weapon gains the concealed trait.', ['sf2e']), kind: 'item' as const }
  const markup = renderToStaticMarkup(<GearTraits entries={[grip]} traits={['Concealed']} system="sf2e" />)
  expect(markup).toContain('The weapon gains the concealed trait.')
  expect(markup).not.toContain('Description unavailable.')
})

it('shows Boost as an activation button without losing its rules', () => {
  const markup = renderToStaticMarkup(<GearTraits entries={[trait('Boost', 'Boost rules.', ['sf2e'])]}
    traits={['Boost d4']} system="sf2e" boost={{ active: true, toggle: () => {} }} />)
  expect(markup).toContain('class="gear-trait boost-toggle" aria-pressed="true">Boost d4</button>')
  expect(markup).toContain('aria-label="Details: Boost d4"')
  expect(markup).toContain('Boost rules.')
})
