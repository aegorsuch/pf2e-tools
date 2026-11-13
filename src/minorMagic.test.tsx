import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { knowsSpell } from './builder'
import { minorMagicOptions, minorMagicSpells } from './minorMagic'
import { SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'

const spell = (name: string, tradition: string, traits = ['Cantrip']): ContentEntry => ({
  id: name, name, kind: 'spell', systems: ['pf2e'], source: 'official', level: 1,
  traits, description: '', data: { tradition }, effects: [], updatedAt: 0,
})
const entries = [spell('Light', 'Divine, Occult'), spell('Daze', 'Occult'), spell('Rare Mind', 'Occult', ['Cantrip', 'Rare']),
  spell('Fireball', 'Occult', ['Fire'])]
const c: Character = { id: 'c', systems: ['pf2e'], name: 'Rogue', className: 'Rogue', level: 6,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 14 },
  feats: [{ name: 'Minor Magic', type: 'Class Feat', level: 2 }],
  minorMagic: { tradition: 'Occult', cantrips: { Occult: ['Light', 'Daze'], Divine: ['Light'] } },
  equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }

it('grants two distinct eligible cantrips and retains dormant tradition choices', () => {
  expect(minorMagicOptions(c, entries).map(entry => entry.name)).toEqual(['Daze', 'Light'])
  expect(minorMagicSpells(c, entries).map(entry => entry.name)).toEqual(['Light', 'Daze'])
  expect(knowsSpell(c, entries, 'Daze')).toBe(true)
  expect(minorMagicSpells({ ...c, minorMagic: { ...c.minorMagic, tradition: 'Divine' } }, entries).map(entry => entry.name)).toEqual(['Light'])
  expect(minorMagicSpells({ ...c, level: 1 }, entries)).toEqual([])
  expect(c.minorMagic?.cantrips?.Occult).toEqual(['Light', 'Daze'])
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Minor Magic cantrip 2')
  expect(html).toContain('rank 3 Occult')
  expect(html).toContain('DC 20')
})
