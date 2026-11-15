import { isValidElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ItemTroubleshoot } from './ItemTroubleshoot'
import type { Character } from './types'

it('tracks item glitching and reduces it with Troubleshoot', () => {
  let c: Character = { id: 'm', name: 'Mechanic', systems: ['sf2e'], className: 'Mechanic', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, feats: [],
    equipment: [{ name: 'Toolkit', qty: 1 }], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const find = (node: ReactNode, type: string): { onChange?: (event: { target: { value: string } }) => void; onClick?: () => void } | undefined => {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = find(child, type)
        if (found) return found
      }
    } else if (isValidElement<{ children?: ReactNode; onChange?: (event: { target: { value: string } }) => void; onClick?: () => void }>(node)) {
      if (node.type === type) return node.props
      return find(node.props.children, type)
    }
    return undefined
  }
  const render = () => ItemTroubleshoot({ c, save: patch => { c = { ...c, ...patch } },
    kind: 'equipment', id: c.equipment[0].mechanicItemId, label: 'Toolkit',
    attach: id => ({ equipment: [{ ...c.equipment[0], mechanicItemId: id }] }) })
  find(render(), 'input')?.onChange?.({ target: { value: '3' } })
  const id = c.equipment[0].mechanicItemId
  expect(id).toBeTruthy()
  expect(c.mechanicGlitching?.[`equipment:${id}`]).toBe(3)
  expect(renderToStaticMarkup(<ItemTroubleshoot c={c} save={() => {}} kind="equipment" id={id} label="Toolkit" />))
    .toContain('Flat check DC 8 when using this item')
  expect(renderToStaticMarkup(<ItemTroubleshoot c={{ ...c, mechanicGlitching: { 'drone:drone': 2 } }}
    save={() => {}} kind="drone" id="drone" label="Drone" creature />))
    .toContain('Flat check DC 7 at the start of each turn')
  find(render(), 'button')?.onClick?.()
  expect(c.mechanicGlitching?.[`equipment:${id}`]).toBe(2)
  find(render(), 'input')?.onChange?.({ target: { value: '0' } })
  expect(c.mechanicGlitching?.[`equipment:${id}`]).toBeUndefined()
})
