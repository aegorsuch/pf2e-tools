import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { MechanicFeatures } from './MechanicFeatures'
import { subclassOptions } from './builder'
import type { Character } from './types'

const mechanic: Character = {
  id: 'm', systems: ['sf2e'], name: 'Mechanic', level: 10, className: 'Mechanic', subclass: 'Mine',
  abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('offers the three official exocortexes and scales mine capacity and DC', () => {
  expect(subclassOptions(mechanic, []).map(entry => entry.name)).toEqual(['Drone', 'Mine', 'Turret'])
  const markup = renderToStaticMarkup(<MechanicFeatures c={mechanic} save={() => {}} />)
  expect(markup).toContain('Mine capacity: 12; disable DC 28')
  expect(renderToStaticMarkup(<MechanicFeatures c={{ ...mechanic, level: 1 }} save={() => {}} />))
    .toContain('Mine capacity: 8; disable DC 17')
})

it('calculates turret defenses and selected commercial array without granting unsupported upgrades', () => {
  const turret: Character = { ...mechanic, subclass: 'Turret', mechanicTurretArray: 'Laser Beam' }
  const markup = renderToStaticMarkup(<MechanicFeatures c={turret} save={() => {}} />)
  expect(markup).toContain('1d8 fire; range 60 feet')
  expect(markup).toContain('AC 28; HP 70; broken 35; hardness 15')
  expect(markup).toContain('Fortitude and Reflex +18')
  expect(markup).toContain('not yet automated')
  expect(renderToStaticMarkup(<MechanicFeatures c={{ ...turret, className: 'Ranger' }} save={() => {}} />)).toBe('')
})
