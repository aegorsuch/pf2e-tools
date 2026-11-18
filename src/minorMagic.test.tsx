import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { knowsSpell } from './builder'
import { minorMagicOptions, minorMagicSpells } from './minorMagic'
import { SpellsSection } from './SpellsSection'
import { dailyInnateUses, grantedFeatSpells, mageAutomatonOptions } from './featSpells'
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

it('gives Mage Automaton one saved arcane innate cantrip slot with automatic heightening', () => {
  const catalog = [
    spell('Light', 'Arcane, Divine, Occult, Primal'), spell('Daze', 'Arcane, Occult'),
    spell('Heal', 'Divine', ['Healing']), spell('Fireball', 'Arcane', ['Fire']),
    spell('Rare Mind', 'Arcane', ['Cantrip', 'Rare']), spell('Focused Mind', 'Arcane', ['Cantrip', 'Focus']),
    { ...spell('Other System', 'Arcane'), systems: ['sf2e'] as const },
    { ...spell('Deleted', 'Arcane'), deleted: true },
  ].map(entry => ({ ...entry, systems: [...entry.systems] }))
  const mage: Character = { ...c, className: undefined, feats: [], ancestry: 'Automaton', heritage: 'Mage Automaton',
    minorMagic: undefined, mageAutomatonCantrip: 'Light' }
  expect(mageAutomatonOptions(mage, catalog).map(entry => entry.name)).toEqual(['Daze', 'Light'])
  const restored: Character = JSON.parse(JSON.stringify(mage))
  const [grant] = grantedFeatSpells(restored, catalog)
  expect(grantedFeatSpells(restored, catalog)).toHaveLength(1)
  expect(grant).toMatchObject({ source: 'Mage Automaton', rank: 3,
    rule: { kind: 'innate', tradition: 'arcane', frequency: 'at will', heightened: true } })
  expect(dailyInnateUses(restored, grant)).toBeUndefined()
  expect(knowsSpell(restored, catalog, 'Light')).toBe(true)
  expect(grantedFeatSpells({ ...restored, level: 9 }, catalog)[0].rank).toBe(5)
  const html = renderToStaticMarkup(<SpellsSection c={restored} entries={catalog} save={() => {}} />)
  expect(html).toContain('aria-label="Mage Automaton cantrip"')
  expect(html).toContain('<option selected="">Light</option>')
  expect(html).toContain('Arcane Spell Rank 3')
  expect(html).toContain('Innate Spells')
  expect(html).toContain('1 spells')
  expect(renderToStaticMarkup(<SpellsSection c={{ ...mage, mageAutomatonCantrip: undefined }} entries={catalog} save={() => {}} />))
    .toContain('aria-label="Mage Automaton cantrip"')
})

it('disables invalid Mage Automaton selections and stops granting the cantrip when its heritage is inactive', () => {
  const mage: Character = { ...c, className: undefined, feats: [], heritage: 'Mage Automaton', minorMagic: undefined,
    mageAutomatonCantrip: 'Light' }
  const catalog = [spell('Light', 'Arcane'), spell('Fireball', 'Arcane', ['Fire'])]
  for (const inactive of [{ ...mage, heritage: 'Warrior Automaton' }, { ...mage, level: 0 }]) {
    expect(grantedFeatSpells(inactive, catalog)).toEqual([])
    expect(renderToStaticMarkup(<SpellsSection c={inactive} entries={catalog} save={() => {}} />))
      .not.toContain('aria-label="Mage Automaton cantrip"')
    expect(inactive.mageAutomatonCantrip).toBe('Light')
  }
  for (const choice of ['Fireball', 'Missing Spell']) {
    const invalid = { ...mage, mageAutomatonCantrip: choice }
    expect(grantedFeatSpells(invalid, catalog)).toEqual([])
    expect(renderToStaticMarkup(<SpellsSection c={invalid} entries={catalog} save={() => {}} />)).toContain(`${choice} (unavailable)`)
  }
})
