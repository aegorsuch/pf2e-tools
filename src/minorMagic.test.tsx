import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, onTestFinished } from 'vitest'
import { featPrerequisiteChecker, knowsSpell } from './builder'
import { mapAonHit } from './aon'
import { minorMagicOptions, minorMagicSpells } from './minorMagic'
import { SpellsSection } from './SpellsSection'
import { dailyInnateUses, gnomeHeritageCantripOptions, grantedFeatSpells, mageAutomatonOptions } from './featSpells'
import type { Character, ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'

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
  expect(html).toContain('Class Spells')
  expect(html).toContain('Minor Magic · Cantrips (Heightened Level 3)')
  expect(html).not.toContain('Innate Spells')
  expect(html).toContain('Clear Light spell slot')
  expect(html).toContain('Clear Daze spell slot')
  expect(html).toContain('2 spells')
  expect(html).toContain('DC 20')
  const empty = renderToStaticMarkup(<SpellsSection c={{ ...c, minorMagic: { tradition: 'Occult' } }} entries={entries} save={() => {}} />)
  expect(empty).toContain('aria-label="Minor Magic cantrip 1"')
  expect(empty).toContain('aria-label="Minor Magic cantrip 2"')
  expect(empty).toContain('0/2 spells')
})

it('alphabetizes merged Minor Magic and Cleric Dedication cantrips together', () => {
  const catalog = ['Bane Light', 'Daze Light', 'Gentle Light', 'Zealous Light']
    .map(name => spell(name, 'Divine'))
  const chosen: Character = { ...c, level: 10, subclass: 'Avenger',
    feats: [...c.feats,
      { name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Eldritch Trickster' },
      { name: 'Cleric Dedication', type: 'Archetype Feat', level: 2, takenLevel: 10, slot: 'archetype:1:eldritch-trickster:class:10:0' }],
    minorMagic: { cantrips: { Divine: ['Zealous Light', 'Daze Light'] } },
    spellcasting: { ability: 'wis', tradition: 'Divine', rank: 1, slots: {},
      prepared: { '0:0': 'Gentle Light', '0:1': 'Bane Light' } } }
  const html = renderToStaticMarkup(<SpellsSection c={chosen} entries={catalog} save={() => {}} />)
  const positions = catalog.map(entry => html.indexOf(`aria-label="Clear ${entry.name} spell slot"`))
  expect(positions.every(position => position >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
  expect(chosen.spellcasting?.prepared).toEqual({ '0:0': 'Gentle Light', '0:1': 'Bane Light' })
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

it('tracks gnome heritage cantrips and converts ancestry magic to the wellspring tradition', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  onTestFinished(() => updateSettings({ innateAutoHeighten: previous }))
  const firstWorld = mapAonHit({ _id: 'first-world', _source: { name: 'First World Magic', category: 'feat', level: 1, trait: ['Gnome'],
    markdown: 'Header\n\n---\n\nChoose one cantrip from the [primal](/SpellLists.aspx?Tradition=4) spell list. You can cast this spell as a primal innate spell at will.' } }, 'pf2e')!
  const cautious: ContentEntry = { ...spell('Cautious Curiosity', ''), kind: 'feat', traits: ['Gnome'], level: 9,
    data: { prerequisite: 'at least one arcane or occult innate spell gained from a gnome heritage or gnome ancestry feat' } }
  const catalog = [spell('Light', 'Arcane, Occult, Primal'), spell('Daze', 'Occult'),
    spell('Disguise Magic', 'Arcane, Occult', []), spell('Silence', 'Divine, Occult', []), firstWorld, cautious]
  const gnome: Character = { ...c, ancestry: 'Gnome', heritage: 'Wellspring Gnome', level: 9,
    feats: [{ name: 'First World Magic', type: 'Ancestry Feat', level: 1, choice: 'Light' },
      { name: cautious.name, type: 'Ancestry Feat', level: 9 }],
    gnomeHeritageMagic: { tradition: 'Occult', cantrips: { Occult: 'Daze', Arcane: 'Light', Primal: 'Light' } } }
  expect(gnomeHeritageCantripOptions(gnome, catalog).map(item => item.name)).toEqual(['Daze', 'Light'])
  const grants = grantedFeatSpells(gnome, catalog)
  expect(grants.map(grant => [grant.entry.name, grant.rule.tradition, grant.rank])).toEqual([
    ['Daze', 'Occult', 5], ['Light', 'Occult', 5], ['Disguise Magic', 'Occult', 2], ['Silence', 'Occult', 2],
  ])
  expect(dailyInnateUses(gnome, grants[2])?.key).not.toBe(dailyInnateUses(gnome, grants[3])?.key)
  expect(grants[2].rule.condition).toBe('Must target yourself')
  expect(featPrerequisiteChecker(gnome, catalog, 9, 1)(cautious).missing).toEqual([])
  const noTradition = { ...gnome, gnomeHeritageMagic: undefined }
  expect(grantedFeatSpells(noTradition, catalog)).toEqual([])
  expect(featPrerequisiteChecker(noTradition, catalog, 9, 1)(cautious).missing).toHaveLength(1)
  expect(grantedFeatSpells({ ...gnome, gnomeHeritageMagic: { ...gnome.gnomeHeritageMagic, tradition: 'Divine' } }, catalog)
    .some(grant => grant.source === cautious.name)).toBe(false)
  const fey = { ...gnome, heritage: 'Fey-touched Gnome', feats: [],
    gnomeHeritageMagic: { cantrips: { Primal: 'Light' } } }
  expect(grantedFeatSpells(fey, catalog)).toMatchObject([{ entry: { name: 'Light' }, rule: { tradition: 'Primal' }, rank: 5 }])
  const html = renderToStaticMarkup(<SpellsSection c={gnome} entries={catalog} save={() => {}} />)
  expect(html).toContain('aria-label="Wellspring Gnome tradition"')
  expect(html).toContain('aria-label="Wellspring Gnome cantrip"')
  expect(html).toContain('Clear Light spell slot')
  expect(html).not.toContain('aria-label="First World Magic spell"')
  expect(html).toContain('Disguise Magic')
  expect(html).toContain('Silence')
  const empty = { ...gnome, feats: [{ ...gnome.feats[0], choice: undefined }] }
  const emptyHtml = renderToStaticMarkup(<SpellsSection c={empty} entries={catalog} save={() => {}} />)
  expect(emptyHtml).toContain('aria-label="First World Magic spell"')
  expect(emptyHtml).toContain('Occult Spell Rank 5')
})
