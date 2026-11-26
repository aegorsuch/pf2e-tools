import { expect, it } from 'vitest'
import { weaponBoostDamage } from './weaponBoost'
import { FIST } from './supplemental'
import type { ContentEntry } from './types'

it.each([
  ['Plasma Caster', '1d10'],
  ['Tactical Plasma Caster', '1d10'],
  ['Advanced Plasma Caster', '2d10'],
  ['Superior Plasma Caster', '2d10'],
  ['Elite Plasma Caster', '3d10'],
  ['Ultimate Plasma Caster', '3d10'],
  ['Paragon Plasma Caster', '4d10'],
])('uses weapon grade for %s Boost damage', (name, damage) => {
  const weapon: ContentEntry = { id: name, name, systems: ['sf2e'], kind: 'weapon', source: 'official',
    level: 1, traits: ['Boost d10'], description: '', data: {}, effects: [], updatedAt: 0 }
  expect(weaponBoostDamage(weapon, weapon.traits)).toBe(damage)
  expect(weaponBoostDamage(weapon, ['Boost'])).toBeUndefined()
})

it('supports Starfinder Boost traits inherited by supplemental unarmed attacks', () => {
  expect(weaponBoostDamage(FIST, ['Unarmed', 'Boost d4'])).toBe('1d4')
  expect(weaponBoostDamage({ ...FIST, name: 'Fist of the Elite' }, ['Boost d4'])).toBe('1d4')
})
