import { expect, it } from 'vitest'
import { fatalMethodGrants, fatalMethodOptions, selectedFatalMethod } from './fatalMethods'
import { mapAonHit } from './aon'
import type { Character } from './types'

const character: Character = {
  id: 'test', systems: ['pf2e'], name: 'Test', level: 1, className: 'Necromancer',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('imports fatal methods separately from grim fascinations and falls back when absent from the snapshot', () => {
  const reaper = mapAonHit({ _id: 'fatal-method-2', _source: {
    category: 'fatal-method', name: 'Reaper', markdown: 'Full Reaper rules.', url: '/FatalMethods.aspx?ID=2',
  } }, 'pf2e')!
  expect(reaper).toMatchObject({ kind: 'subclass', data: { class: 'Necromancer', subclass_type: 'fatal-method' }, description: 'Full Reaper rules.' })
  expect(fatalMethodOptions([reaper]).map(entry => entry.name)).toEqual(['Puppeteer', 'Reaper'])
  expect(fatalMethodOptions([reaper])[1]).toBe(reaper)
})

it('only grants method abilities for a selected necromancer method', () => {
  expect(fatalMethodGrants(character)).toEqual({ method: undefined, features: [], martialWeapons: 0, mediumArmor: 0 })
  const puppeteer = { ...character, fatalMethod: 'Puppeteer' as const }
  expect(fatalMethodGrants(puppeteer)).toEqual({
    method: 'Puppeteer', features: ['Consume Thrall', 'Thrall Proliferation'], martialWeapons: 0, mediumArmor: 0,
  })
  expect(selectedFatalMethod({ ...puppeteer, className: 'Wizard' })).toBeUndefined()
  expect(fatalMethodGrants({ ...puppeteer, className: 'Wizard' }).features).toEqual([])
})

it.each([[1, 1, 1], [10, 1, 1], [11, 2, 1], [12, 2, 1], [13, 2, 2], [20, 2, 2]])(
  'grants Reaper ranks at level %i', (level, martialWeapons, mediumArmor) => {
    expect(fatalMethodGrants({ ...character, level, fatalMethod: 'Reaper' })).toEqual({
      method: 'Reaper', features: ["Reaper's Edge", 'Thrall Teamwork'], martialWeapons, mediumArmor,
    })
  },
)
