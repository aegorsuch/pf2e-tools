import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { savingThrowBreakdown } from './builder'
import { StatusesContent, StatusesSummary } from './StatusesSection'
import { ProtectCompanionOptions, ZealousConvictionToggle } from './SpellsSection'
import type { Character } from './types'

it('synchronizes condition and Zealous Conviction state with character statistics', () => {
  let c: Character = { id: 'statuses', name: 'Test', systems: ['pf2e'], level: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  function findInput(node: ReactNode, label: string): ((event: { target: { value: string } }) => void) | undefined {
    let result: ((event: { target: { value: string } }) => void) | undefined
    Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'input' && child.props['aria-label'] === label)
        result = child.props.onChange as typeof result
      else result ??= findInput(child.props.children as ReactNode, label)
    })

    return result
  }
  const baseline = savingThrowBreakdown(c, [], 'Will').total
  findInput(StatusesContent({ c, entries: [], save }), 'Frightened status')!({ target: { value: '2' } })
  expect(c.conditions?.frightened).toBe(2)
  expect(savingThrowBreakdown(c, [], 'Will').total).toBe(baseline - 2)
  const toggle = ZealousConvictionToggle({ c, save, rank: 10 })
  const input = Children.toArray(toggle.props.children).find(child => isValidElement(child) && child.type === 'input')
  if (!isValidElement<{ onChange: (event: { target: { checked: boolean } }) => void }>(input)) throw Error('Missing toggle')
  input.props.onChange({ target: { checked: true } })
  expect(c.zealousConvictionRank).toBe(10)
  const summary = renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)
  expect(summary).toContain('Frightened 2')
  expect(summary).toContain('Zealous Conviction')
  input.props.onChange({ target: { checked: false } })
  expect(c.zealousConvictionRank).toBeUndefined()
})

it('synchronizes Protect Companion target and active state', () => {
  let c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'one', name: 'One', type: 'Bear' }, { id: 'two', name: 'Two', type: 'Bear' }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const toggle = ProtectCompanionOptions({ c, save, companionId: 'two' })
  const label = Children.toArray(toggle.props.children).find(child => isValidElement(child) && child.type === 'label')
  if (!isValidElement<{ children: ReactNode }>(label)) throw Error('Missing label')
  const input = Children.toArray(label.props.children).find(child => isValidElement(child) && child.type === 'input')
  if (!isValidElement<{ onChange: (event: { target: { checked: boolean } }) => void }>(input)) throw Error('Missing toggle')
  input.props.onChange({ target: { checked: true } })
  expect(c.protectCompanionId).toBe('two')
  expect(c.activeSpells).toContain('Protect Companion')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).toContain('Protect Companion')
  input.props.onChange({ target: { checked: false } })
  expect(c.activeSpells).not.toContain('Protect Companion')
})
