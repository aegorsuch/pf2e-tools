import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AbilitiesSection, AbilityBoostChoices } from './AbilitiesSection'
import { computeAbilities, type SectionProps } from './builder'
import type { Character, ContentEntry } from './types'

const entry = (kind: ContentEntry['kind'], name: string, attribute: string): ContentEntry => ({
  id: name, systems: ['pf2e'], kind, source: 'official', name, level: 1, traits: [], description: '',
  data: { attribute }, effects: [], updatedAt: 1,
})

const entries = [
  entry('ancestry', 'Human', 'Two free ability boosts'),
  entry('background', 'Scout', 'Dexterity, Wisdom'),
  entry('class', 'Ranger', 'Dexterity, Strength'),
]

const character: Character = {
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, ancestry: 'Human', background: 'Scout', className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, boosts: {},
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

function findElement(node: ReactNode, predicate: (type: unknown, props: Record<string, unknown>) => boolean): Record<string, unknown> | undefined {
  let result: Record<string, unknown> | undefined
  Children.forEach(node, (child) => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    result = predicate(child.type, child.props) ? child.props : findElement(child.props.children as ReactNode, predicate)
  })
  return result
}

function select(props: SectionProps, groups: string[], label: string) {
  const tree = AbilityBoostChoices({ ...props, groups })
  const found = findElement(tree, (type, p) => type === 'select' && p['aria-label'] === label)
  expect(found).toBeDefined()
  return found as { value: string; onChange: (event: { target: { value: string } }) => void }
}

describe('ability score boost controls', () => {
  it('shows ancestry and background boosts alongside free boosts, without class boosts', () => {
    const markup = renderToStaticMarkup(<AbilitiesSection c={character} entries={entries} save={() => {}} />)
    expect(markup).toContain('Ancestry Boosts')
    expect(markup).toContain('Background Boosts')
    expect(markup).toContain('Free Boosts')
    expect(markup).not.toContain('Class Boost')
  })

  it('shares choices in both directions and keeps other boosts intact', () => {
    let c: Character = { ...character, boosts: { 'free1:0': 'str' } }
    const props = () => ({
      c, entries,
      save: (patch: Partial<Character>) => {
        c = { ...c, ...patch, boosts: patch.boosts ?? c.boosts }
        c.abilities = computeAbilities(c, entries)
      },
    })
    const scoreGroups = ['ancestry', 'background', 'free1']

    select(props(), scoreGroups, 'Ancestry (free)').onChange({ target: { value: 'wis' } })
    expect(select(props(), ['ancestry'], 'Ancestry (free)').value).toBe('wis')
    select(props(), ['ancestry'], 'Ancestry (free)').onChange({ target: { value: 'con' } })
    expect(select(props(), scoreGroups, 'Ancestry (free)').value).toBe('con')

    select(props(), scoreGroups, 'Background').onChange({ target: { value: 'dex' } })
    expect(select(props(), ['background'], 'Background').value).toBe('dex')
    select(props(), ['background'], 'Background').onChange({ target: { value: 'wis' } })
    expect(select(props(), scoreGroups, 'Background').value).toBe('wis')
    expect(c.boosts).toMatchObject({ 'free1:0': 'str', 'ancestry:0': 'con', 'background:0': 'wis' })
    expect(c.abilities).toMatchObject({ str: 12, con: 12, wis: 12 })
  })
})
