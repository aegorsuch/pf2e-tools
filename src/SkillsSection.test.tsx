import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ClassSkills, SkillsSection } from './SkillsSection'
import { ranksAt } from './builder'
import type { Character, ContentEntry } from './types'

it('shares class skill choices between class controls and skills section', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = [{
    id: 'wizard', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Wizard', level: 1,
    traits: [], description: '', effects: [], updatedAt: 0,
    data: { skill_proficiency: 'Trained in Arcana, Trained in a number of additional skills equal to 2 plus your Intelligence modifier' },
  }]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
  const find = (node: ReactNode): Record<string, unknown> | undefined => {
    let result: Record<string, unknown> | undefined
    Children.forEach(node, (child) => {
      if (result || !isValidElement<Record<string, unknown>>(child)) return
      result = child.type === 'select' && child.props['aria-label'] === 'Class skill 1'
        ? child.props : find(child.props.children as ReactNode)
    })

    return result
  }
  const pick = find(ClassSkills(props()))
  if (!pick) throw new Error('Missing class skill control')
  const change = pick.onChange as (event: { target: { value: string } }) => void
  change({ target: { value: 'Society' } })
  const markup = renderToStaticMarkup(<SkillsSection {...props()} />)
  expect(markup).toContain('<option selected="">Society</option>')
  expect(markup).toContain('Trained: Arcana')
  expect(markup).toContain('Class Skills')
  expect(c.skillPicks).toEqual(['Society'])
})

it('locks class and background training without blocking higher ranks or optional picks', () => {
      let c: Character = {
        id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger', background: 'Fey Bound',
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
        skillPicks: ['Society'], rankOverrides: { Nature: 0, 'Fey Lore': 0 },
      }
      const entries: ContentEntry[] = [
        {
          id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1,
          traits: [], description: '', effects: [], updatedAt: 0,
          data: { skill_proficiency: 'Trained in Nature, Trained in a number of additional skills equal to 4 plus your Intelligence modifier' },
        },
        {
          id: 'fey-bound', systems: ['pf2e'], kind: 'background', source: 'official', name: 'Fey Bound', level: 1,
          traits: [], description: '', effects: [], updatedAt: 0, data: { skill: 'Fey Lore' },
        },
      ]
      const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
      const buttons = new Map<string, Record<string, unknown>>()
      const collect = (node: ReactNode) => {
        Children.forEach(node, (child) => {
          if (!isValidElement<Record<string, unknown>>(child)) return
          if (child.type === 'button') buttons.set(String(child.props['aria-label']), child.props)
          collect(child.props.children as ReactNode)
        })
      }
      collect(SkillsSection(props()))
      expect(ranksAt(c, entries)).toMatchObject({ Nature: 1, 'Fey Lore': 1 })
      for (const name of ['Nature', 'Fey Lore']) {
        const button = buttons.get(`${name} Trained`)!
        expect(button.disabled).toBe(true)
        const previous = c
        ;(button.onClick as () => void)()
        expect(c).toBe(previous)
      }
      const expert = buttons.get('Nature Expert')!
      expect(expert.disabled).toBe(false)
      ;(expert.onClick as () => void)()
      expect(ranksAt(c, entries).Nature).toBe(2)
      const optional = buttons.get('Society Trained')!
      expect(optional.disabled).toBe(false)
      ;(optional.onClick as () => void)()
      expect(c.skillPicks).toEqual([])
})
