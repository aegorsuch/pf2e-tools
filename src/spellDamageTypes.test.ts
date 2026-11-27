import { expect, it, vi } from 'vitest'
import snapshot from '../public/data/aon-pf2e.json?raw'
import { mapAonHit } from './aon'
import { sortSpellsByDamage, spellDamageTypes } from './spellDamageTypes'
import type { ContentEntry } from './types'

const catalog = (JSON.parse(snapshot) as Parameters<typeof mapAonHit>[0][])
const entry = (name: string) => mapAonHit(catalog.find(hit =>
  hit._source?.category === 'spell' && hit._source?.name === name)!, 'pf2e')!

it('extracts actual damage types, including multiple types, without treating traits or resistance as damage', () => {
  expect(spellDamageTypes(entry('Fireball'))).toEqual(['fire'])
  expect(spellDamageTypes(entry('Live Wire'))).toEqual(['electricity', 'slashing'])
  expect(spellDamageTypes(entry('Heal'))).toEqual(['vitality'])
  const fireball = entry('Fireball')
  expect(spellDamageTypes({ ...fireball, description: 'You gain resistance 5 to fire damage.' })).toEqual([])
  expect(spellDamageTypes({ ...fireball, description: 'Deals cold or fire damage.' })).toEqual(['cold', 'fire'])
  expect(spellDamageTypes({ ...fireball, description: 'A fire lights the area.', traits: ['Fire'] })).toEqual([])
  expect(spellDamageTypes({ ...fireball, description: '', data: { damage_type: 'Acid, Fire' } })).toEqual(['acid', 'fire'])
})

it('orders damage types alphabetically with name ties and unclassified spells last', () => {
  const fireball = entry('Fireball')
  const frost = { ...fireball, id: 'frost', name: 'Frost', description: 'Deals cold damage.' }
  const blaze = { ...fireball, id: 'blaze', name: 'Blaze' }
  const shield = { ...fireball, id: 'shield', name: 'Shield', description: 'Protects the target.' }
  const results: ContentEntry[] = sortSpellsByDamage([shield, fireball, frost, blaze], spell => spell, spell => spell.name)
  expect(results.map(spell => spell.name)).toEqual(['Frost', 'Blaze', 'Fireball', 'Shield'])
  const lookup = vi.fn((spell: ContentEntry) => spell)
  sortSpellsByDamage([shield, fireball, frost, blaze], lookup, spell => spell.name)
  expect(lookup).toHaveBeenCalledTimes(4)
})
