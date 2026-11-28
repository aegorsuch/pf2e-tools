import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { animistApparitionSlots, classExtraSlots, classRepertoireRows, classSpellcasting, classSpellSlots, eligibleFeats, knowsSpell,
  languageAllowance } from './builder'
import { AnimistApparitionSpells, SpellsSection } from './SpellsSection'
import { SearchableSelect } from './SearchableSelect'
import { homebrewCharacterOptions } from './supplemental'
import { TECHNOMANCER_LANGUAGE_RULES } from './technomancer'
import type { Character, ContentEntry } from './types'

const base: Character = {
  id: 'caster', name: 'Caster', className: 'Bard', systems: ['pf2e'], level: 1,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const baseEntry = (name: string): ContentEntry => ({
  id: name, name, kind: 'class', systems: ['pf2e'], source: 'official', level: 1, traits: [],
  data: {}, description: '', effects: [], updatedAt: 0,
})
const findElement = (node: ReactNode, type: unknown, label: string): ReactElement<Record<string, unknown>> | undefined => {
  let found: ReactElement<Record<string, unknown>> | undefined
  Children.forEach(node, child => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = child.type === type && child.props['aria-label'] === label
      ? child : findElement(child.props.children as ReactNode, type, label)
  })
  return found
}

it.each([
  ['Champion', 'Divine Warrior', 'Divine', 'cha'],
  ['Ranger', 'Primal Warrior', 'Primal', 'wis'],
] as const)('adds fixed %s class cantrips through %s', (className, name, tradition, ability) => {
  const feat = homebrewCharacterOptions([]).find(entry => entry.name === name)!
  const spell = (spellName: string, spellTradition: string, traits = ['Cantrip']): ContentEntry => ({
    id: spellName, name: spellName, kind: 'spell', systems: ['pf2e'], source: 'official', level: 1,
    traits, data: { tradition: spellTradition }, description: '', effects: [], updatedAt: 0,
  })
  const entries = [feat, spell('Guidance', 'Divine, Primal'), spell('Test Cantrip', tradition), spell('Bramble Bush', 'Primal'),
    spell('Protect Companion', 'Divine, Primal'), spell('Divine Lance', 'Divine'),
    spell('Other Tradition', tradition === 'Divine' ? 'Primal' : 'Divine'),
    spell('Focus Cantrip', tradition, ['Cantrip', 'Focus']), spell('Ranked Spell', tradition, [])]
  const c: Character = { ...base, className, level: 5, abilities: { ...base.abilities, wis: 16 },
    feats: [{ name, type: 'Class Feat', level: 1, sourceId: feat.id, slot: 'class:1:0' }] }
  expect(eligibleFeats(entries, { ...c, feats: [] }, { key: 'class:1:0', category: 'class', level: 1 })).toContain(feat)
  expect(classSpellSlots(c)).toEqual({ 0: 2 })
  expect(classSpellcasting(c, entries)).toMatchObject({ traditions: [tradition], ability })
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Class Spells')
  expect(html).toContain('Protect Companion')
  expect(html).toContain('aria-label="Protect Companion options"')
  expect(html).not.toContain('Clear Protect Companion spell slot')
  if (name === 'Primal Warrior') {
    expect(html).toContain('Bramble Bush')
    expect(html).toContain('5-foot cube')
    expect(html).not.toContain('Cantrip slot 1')
    expect(html).not.toContain('Clear Bramble Bush spell slot')
  } else {
    expect(html).toContain('Divine Lance')
    expect(html).not.toContain('Clear Divine Lance spell slot')
    expect(html).not.toContain('Cantrip slot 1')
    expect(html).not.toContain('Cantrip slot 2')
  }
  expect(html).not.toContain('Other Tradition')
  expect(html).not.toContain('Focus Cantrip')
  expect(html).not.toContain('Ranked Spell')
  expect(html).toContain(`${tradition} DC ${ability === 'cha' ? 21 : 20}`)
  const selected: Character = { ...c, spellcasting: { ability, tradition, rank: 1, slots: {},
    prepared: { '0:0': 'Guidance', '0:1': 'Test Cantrip' } } }
  expect(knowsSpell(selected, entries, 'Protect Companion')).toBe(true)
  expect(knowsSpell(selected, entries, 'Guidance')).toBe(false)
  expect(knowsSpell(selected, entries, 'Bramble Bush')).toBe(name === 'Primal Warrior')
  expect(knowsSpell(selected, entries, 'Test Cantrip')).toBe(false)
  expect(knowsSpell({ ...selected, feats: [] }, entries, 'Guidance')).toBe(false)
  const selectedHtml = renderToStaticMarkup(<SpellsSection c={selected} entries={entries} save={() => {}} />)
  expect(selectedHtml).toContain('Cantrips (Heightened Level 3)')
  expect(selectedHtml).not.toContain('Clear Protect Companion spell slot')
  expect(selectedHtml).not.toContain('Clear Guidance spell slot')
  if (name === 'Divine Warrior') expect(selectedHtml).not.toContain('Clear Divine Lance spell slot')
  expect(classSpellSlots({ ...c, feats: [] })).toBeUndefined()
  expect(classSpellSlots({ ...c, level: 0 })).toEqual({})
  if (name === 'Primal Warrior') {
    expect(languageAllowance(c, entries).locked).toContain('Wildsong')
    expect(languageAllowance({ ...c, level: 0 }, entries).locked).not.toContain('Wildsong')
  }
})

it('excludes a feat-granted spell from class spell choices', () => {
  const grant: ContentEntry = { ...baseEntry('Tangle Vine Grant'), id: 'tangle-vine-grant', kind: 'feat',
    spellGrants: [{ kind: 'innate', spells: ['Tangle Vine'], tradition: 'primal', frequency: 'at will', heightened: true }] }
  const tangleVine: ContentEntry = { ...baseEntry('Tangle Vine'), id: 'tangle-vine', kind: 'spell',
    traits: ['Cantrip'], data: { tradition: 'Primal' } }
  const c: Character = { ...base, className: 'Druid', level: 1,
    feats: [{ name: grant.name, type: 'Ancestry Feat', level: 1, sourceId: grant.id, slot: 'ancestry:1:0' }] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[grant, tangleVine]} save={() => {}} />)
  const cantripPicker = /<select[^>]*aria-label="Cantrip slot 1"[\s\S]*?<\/select>/.exec(html)?.[0]
  expect(cantripPicker).toBeDefined()
  expect(cantripPicker).not.toContain('Tangle Vine')
})

it.each([
  ['Bard', 1, { 0: 5, 1: 2 }],
  ['Bard', 3, { 0: 5, 1: 3, 2: 2 }],
  ['Cleric', 1, { 0: 5, 1: 6 }],
  ['Druid', 1, { 0: 5, 1: 2 }],
  ['Witch', 2, { 0: 5, 1: 3 }],
  ['Wizard', 19, { 0: 6, 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 1 }],
  ['Oracle', 1, { 0: 5, 1: 3 }],
  ['Sorcerer', 3, { 0: 5, 1: 4, 2: 3 }],
  ['Magus', 3, { 0: 5, 1: 2, 2: 1 }],
  ['Summoner', 1, { 0: 5, 1: 1 }],
  ['Psychic', 3, { 0: 6, 1: 2, 2: 1 }],
  ['Animist', 19, { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2 }],
])('derives %s slot progression at level %i without saved slot counts', (className, level, expected) => {
  expect(classSpellSlots({ ...base, className, level })).toEqual(expected)
})

it.each([
  [1, { 0: 2, 1: 1 }],
  [7, { 0: 3, 1: 1, 2: 1, 3: 1, 4: 1 }],
  [10, { 0: 3, 1: 2, 2: 2, 3: 2, 4: 1, 5: 1 }],
  [19, { 0: 4, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 1, 10: 1 }],
])('derives Animist apparition spell slots at level %i', (level, expected) => {
  expect(animistApparitionSlots({ ...base, className: 'Animist', level })).toEqual(expected)
})

it('keeps Animist prepared spells separate from spontaneous apparition spells', () => {
  const spell = (id: string, name: string, level: number, tradition: string, traits: string[] = []) => ({
    ...baseEntry(name), id, kind: 'spell' as const, level, traits, data: { tradition },
  })
  const entries = [ { ...baseEntry('Animist'), data: { tradition: 'Divine' } },
    spell('guidance', 'Guidance', 1, 'Divine', ['Cantrip']),
    spell('arcane-spell', 'Arcane Apparition Spell', 1, 'Arcane'),
    spell('divine-spell', 'Divine Prepared Spell', 1, 'Divine') ]
  let c: Character = { ...base, className: 'Animist', level: 1, abilities: { ...base.abilities, wis: 18 } }
  const save = (patch: Partial<Character>) => {
    if (patch.spellcasting) c = { ...c, spellcasting: {
      ...(c.spellcasting ?? { ability: 'wis', tradition: 'Divine', rank: 1, slots: {} }),
      ...patch.spellcasting,
    } }
    else c = { ...c, ...patch }
  }
  expect(classSpellSlots(c)).toEqual({ 0: 2, 1: 1 })
  expect(animistApparitionSlots(c)).toEqual({ 0: 2, 1: 1 })
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Apparition Spellcasting')
  expect(markup).toContain('Apparition Spell Rank 1')
  expect(markup).toContain('Divine Prepared Spell')
  expect(markup).toContain('Arcane Apparition Spell (Rank 1)')
  expect(markup).not.toContain('Arcane Apparition Spell</option>')

  const add = findElement(AnimistApparitionSpells({ c, entries, save }), SearchableSelect, 'Add apparition spell')
  if (!isValidElement<{ onChange: (event: { target: { value: string } }) => void }>(add)) throw new Error('Missing apparition spell picker')
  add.props.onChange({ target: { value: 'arcane-spell' } })
  expect(c.spellcasting?.apparitionRepertoire).toEqual(['arcane-spell'])

  const slot = findElement(AnimistApparitionSpells({ c, entries, save }), SearchableSelect, 'Apparition spell rank 1 slot 1')
  if (!isValidElement<{ onChange: (event: { target: { value: string } }) => void }>(slot)) throw new Error('Missing apparition slot picker')
  slot.props.onChange({ target: { value: 'arcane-spell' } })
  expect(c.spellcasting?.apparitionSlots?.['apparition:1:0']).toBe('arcane-spell')
})

it.each([
  ['Mystic', 1, { 0: 5, 1: 3 }],
  ['Mystic', 3, { 0: 5, 1: 4, 2: 3 }],
  ['Technomancer', 1, { 0: 5, 1: 2 }],
  ['Technomancer', 3, { 0: 5, 1: 3, 2: 2 }],
])('derives Starfinder %s slots at level %i', (className, level, expected) => {
  expect(classSpellSlots({ ...base, systems: ['sf2e'], className, level })).toEqual(expected)
})

it.each([
  ['Mystic', 4],
  ['Technomancer', 3],
])('adds the Starfinder rank-10 slot for %s at level 19', (className, slotsPerRank) => {
  const slots = classSpellSlots({ ...base, systems: ['sf2e'], className, level: 19 })!
  expect(slots[9]).toBe(slotsPerRank)
  expect(slots[10]).toBe(1)
})

it('derives Mystic connection tradition and caster ability from selected class', () => {
  const c: Character = { ...base, systems: ['sf2e'], className: 'Mystic', subclass: 'Elemental', level: 7 }
  expect(classSpellcasting(c, [])).toEqual({ traditions: ['Primal'], rank: 2, ability: 'wis' })
  expect(classSpellcasting({ ...c, subclass: 'Shadow' }, [])?.traditions).toEqual(['Divine'])
  expect(classSpellcasting({ ...c, className: 'Technomancer', subclass: '' }, []))
    .toMatchObject({ traditions: ['Arcane'], ability: 'int' })
})

it('lets Avenger characters switch existing Occult spell slots to Divine', () => {
  const avenger: ContentEntry = { ...baseEntry('Avenger'), kind: 'subclass', data: { class: 'Rogue' } }
  const c: Character = { ...base, className: 'Rogue', subclass: 'Avenger',
    spellcasting: { ability: 'cha', tradition: 'Occult', rank: 1, slots: { 1: 1 } } }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[avenger]} save={() => {}} />)
  expect(html).toContain('<option selected="">Occult</option>')
  expect(html).toContain('<option>Divine</option>')
})

it('scales Bloodrager spell attack and DC proficiency with active spellcasting feats', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', level: 20,
    feats: [
      { name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, choice: 'Divine' },
      { name: 'Surging Blood Magic', type: 'Class Feat', level: 12 },
      { name: 'Exultant Blood Magic', type: 'Class Feat', level: 18 },
    ] }
  expect(classSpellcasting({ ...c, level: 1 }, [])).toBeUndefined()
  expect(classSpellcasting({ ...c, level: 11 }, [])).toEqual({ traditions: ['Divine'], ability: 'cha', rank: 1 })
  expect(classSpellcasting({ ...c, level: 12 }, [])).toEqual({ traditions: ['Divine'], ability: 'cha', rank: 2 })
  expect(classSpellcasting({ ...c, level: 18 }, [])).toEqual({ traditions: ['Divine'], ability: 'cha', rank: 3 })
  expect(classSpellcasting({ ...c, feats: c.feats.slice(0, 1) }, [])?.rank).toBe(1)
  expect(classSpellcasting({ ...c, systems: ['sf2e'] }, [])).toBeUndefined()
})

it('derives Bloodrager cantrips, spellcasting slots and repertoire from active feats', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', level: 20,
    feats: [
      { name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, choice: 'Divine' },
      { name: 'Rising Blood Magic', type: 'Class Feat', level: 4 },
      { name: 'Surging Blood Magic', type: 'Class Feat', level: 12 },
      { name: 'Exultant Blood Magic', type: 'Class Feat', level: 18 },
    ] }
  expect(classSpellSlots({ ...c, level: 1 })).toBeUndefined()
  expect(classSpellSlots({ ...c, level: 2 })).toEqual({ 0: 2 })
  expect(classSpellSlots({ ...c, level: 6 })).toEqual({ 0: 2, 1: 1, 2: 1 })
  expect(classSpellSlots({ ...c, level: 12 })).toEqual({ 0: 2, 1: 1, 2: 1, 3: 1 })
  expect(classSpellSlots(c)).toEqual({ 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2 })
  expect(classRepertoireRows(c)).toEqual({ 0: 2, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 })
  expect(classSpellSlots({ ...c, feats: c.feats.slice(0, 1) })).toEqual({ 0: 2 })
  expect(classSpellSlots({ ...c, systems: ['sf2e'] })).toBeUndefined()
})

it('offers Bloodrager repertoire spells from the chosen tradition without manual spell setup', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', level: 8,
    feats: [
      { name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, choice: 'Divine' },
      { name: 'Rising Blood Magic', type: 'Class Feat', level: 4 },
    ] }
  const spell = (name: string, tradition: string, cantrip = false, traits: string[] = []): ContentEntry => ({
    id: name, name, kind: 'spell', systems: ['pf2e'], source: 'official', level: 1,
    traits: [...(cantrip ? ['Cantrip', 'Attack'] : []), ...traits], data: { tradition }, description: '', effects: [], updatedAt: 0,
  })
  const entries = [spell('Divine Cantrip', 'Divine', true), spell('Divine Spell', 'Divine'),
    spell('Flense', 'Arcane, Divine', false, ['Uncommon']),
    spell('Bone Flense', 'Arcane, Divine, Primal', false, ['Rare']), spell('Arcane Spell', 'Arcane')]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Cantrip slot 1')
  expect(html).toContain('Cantrip slot 2')
  expect(html).toContain('Spell Rank 1 slot 1')
  expect(html).toContain('Divine Cantrip')
  expect(html).toContain('Divine Spell')
  expect(html).toContain('Flense')
  expect(html).toContain('Bone Flense')
  expect(html).not.toContain('Arcane Spell')
  expect(html).not.toContain('Spell slots:')
})

it('keeps Bloodrager casting slots independent from repertoire and requires an attack cantrip', () => {
  const c: Character = { ...base, className: 'Barbarian', subclass: 'Bloodrager', level: 18,
    feats: [
      { name: 'Bloodrager Dedication', type: 'Class Feat', level: 2, choice: 'Divine' },
      { name: 'Rising Blood Magic', type: 'Class Feat', level: 4 },
      { name: 'Surging Blood Magic', type: 'Class Feat', level: 12 },
      { name: 'Exultant Blood Magic', type: 'Class Feat', level: 18 },
    ],
    spellcasting: { ability: 'cha', tradition: 'Divine', rank: 3, slots: {},
      prepared: { '0:0': 'Guidance', '1:0': 'Fear' }, spentSlots: ['1:0'] } }
  const spell = (name: string, traits: string[]): ContentEntry => ({
    id: name, name, kind: 'spell', systems: ['pf2e'], source: 'official', level: 1,
    traits, data: { tradition: 'Divine' }, description: '', effects: [], updatedAt: 0,
  })
  const entries = [spell('Guidance', ['Cantrip']), spell('Light', ['Cantrip']), spell('Divine Lance', ['Cantrip', 'Attack']), spell('Fear', [])]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Divine Lance')
  expect(html).not.toContain('>Light</option>')
  expect(html).toContain('aria-label="Cast spell slot rank 1 slot 1"')
  expect(html).not.toContain('disabled="" aria-label="Cast spell slot rank 1 slot 1"')
  const exhausted = renderToStaticMarkup(<SpellsSection c={{ ...c, spellcasting: { ...c.spellcasting!, spentSlots: ['1:0', '1:1'] } }}
    entries={entries} save={() => {}} />)
  expect(exhausted).toContain('disabled="" aria-label="Cast spell slot rank 1 slot 1"')
})

it('renders automatically computed slots without manual slot controls or saved spellcasting data', () => {
  const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 3 }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('Spell Rank 1 slot 1')
  expect(html).toContain('Spell Rank 2 slot 2')
  expect(html).not.toContain('Spell slots:')
  expect(html).not.toContain('type="number"')
})

it('shows selected spell slots and combines slot increase sources under one note', () => {
  const c: Character = { ...base, level: 2, feats: [
    { name: 'Cantrip Expansion', type: 'Class Feat', level: 2 },
    { name: 'Familiar', type: 'Class Feat', level: 1 },
  ], familiar: { abilities: ['Cantrip Connection'] },
    spellcasting: { ability: 'cha', tradition: 'Occult', rank: 1, slots: {}, spentSlots: ['1:0'],
      prepared: { '1:0': 'Selected Spell' } } }
  const cantripConnection: ContentEntry = { ...baseEntry('Cantrip Connection'), kind: 'familiar',
    data: { ability_type: 'Master' }, description: 'You must be able to prepare cantrips or add them to your repertoire.' }
  const selectedSpell: ContentEntry = { ...baseEntry('Selected Spell'), kind: 'spell', level: 1, data: { tradition: 'Occult' } }
  const entries = [{ ...baseEntry('Bard'), data: { tradition: 'Occult' } }, cantripConnection, selectedSpell]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Cantrips (Heightened Level 1) (0/8)')
  expect(html).toContain('Spell Rank 1 (1/3)')
  expect(html).toContain('title="+2 Cantrip Expansion; +1 Cantrip Connection (Cantrip slots)"')
  expect(html).toContain('aria-label="Cantrip slots note"')
})

it('pads selected spell counts to match the total width', () => {
  const c: Character = { ...base, className: 'Custom', level: 20,
    spellcasting: { ability: 'cha', tradition: 'Occult', rank: 1, slots: { 1: 10, 2: 2 },
      prepared: { '1:0': 'Selected Spell' } } }
  const entries = [{ ...baseEntry('Custom'), data: { tradition: 'Occult' } }]
  const render = (character: Character) => renderToStaticMarkup(<SpellsSection c={character} entries={entries} save={() => {}} />)
  expect(render(c)).toContain('Spell Rank 1 (01/10)')
  expect(render(c)).toContain('Spell Rank 2 (0/2)')
  expect(render({ ...c, spellcasting: { ...c.spellcasting!, prepared: {} } })).toContain('Spell Rank 1 (00/10)')
  const prepared = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`1:${index}`, 'Selected Spell']))
  expect(render({ ...c, spellcasting: { ...c.spellcasting!, prepared } })).toContain('Spell Rank 1 (10/10)')
})

it('adds the selected Technomancer programming language spell cache automatically', () => {
  const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 3,
    technomancerProgrammingLanguage: 'DPS++' }
  const entries = ['Supercharge Weapon', 'Caustic Conversion', 'Electrotether'].map((name, index): ContentEntry => ({
    id: name, name, kind: 'spell', systems: ['sf2e'], source: 'official', level: index + 1,
    traits: [], data: { tradition: 'Arcane' }, description: '', effects: [], updatedAt: 0,
  }))
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Supercharge Weapon')
  expect(html).toContain('Caustic Conversion')
  expect(html).toContain('Electrotether')
})

it('makes the Viper greater hack Supercharge Prism rollable', () => {
  const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 18,
    technomancerProgrammingLanguage: 'Viper',
    feats: [{ name: 'Greater Magic Hack', type: 'Class Feat', level: 18 }] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('Supercharge Prism')
  expect(html).toContain('aria-label="Roll Supercharge Prism: Damage"')
  expect(html).toContain('10d6 force')
  expect(html).toContain('10d6 temporary HP')
  expect(html).toContain('Reflex')
  expect(html).toContain('20-foot line')
})

it('adds Cache Caster as a highest-rank cache-only slot and Root Access as a tenth-rank slot', () => {
  const language = 'DPS++'
  const cacheNames = TECHNOMANCER_LANGUAGE_RULES[language].spellCache
  const cacheCaster: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 14,
    technomancerProgrammingLanguage: language,
    feats: [{ name: 'Cache Caster', type: 'Class Feat', level: 14 }],
    spells: [{ name: 'Outside Cache', entryId: 'outside-cache', rank: 7, cantrip: false }],
    spellcasting: { ability: 'int', tradition: 'Arcane', rank: 1, slots: {}, prepared: { '7:0': 'Outside Cache' } } }
  const entries: ContentEntry[] = [
    ...cacheNames.map((name, index): ContentEntry => ({ ...baseEntry(name), id: `cache-${index}`, kind: 'spell',
      systems: ['sf2e'], level: index + 1, data: { tradition: 'Arcane' } })),
    { ...baseEntry('Outside Cache'), id: 'outside-cache', kind: 'spell', systems: ['sf2e'], level: 7,
      data: { tradition: 'Arcane' } },
  ]
  const baseSlots = classSpellSlots({ ...cacheCaster, feats: [] })!
  const rank = Math.max(...Object.keys(baseSlots).map(Number))
  const extra = classExtraSlots(cacheCaster, entries).find(slot => slot.source === 'Cache Caster')
  expect(extra).toMatchObject({ rank, allowedSpells: cacheNames })
  expect(classSpellSlots(cacheCaster)?.[rank]).toBe(baseSlots[rank] + 1)

  const html = renderToStaticMarkup(<SpellsSection c={cacheCaster} entries={entries} save={() => {}} />)
  const cacheOptions = new RegExp(`<select aria-label="Spell Rank ${rank} slot ${baseSlots[rank] + 1}"[^>]*>([\\s\\S]*?)<\\/select>`)
    .exec(html)?.[1] ?? ''
  expect(cacheOptions).not.toBe('')
  expect(cacheOptions).toContain(cacheNames[rank - 1])
  expect(cacheOptions).not.toContain(cacheNames[7])
  expect(cacheOptions).not.toContain(cacheNames[8])
  expect(cacheOptions).not.toContain('Outside Cache')
  expect(html).toContain(`Spell Rank ${rank} (1/${baseSlots[rank] + 1})`)

  const level20Base: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 20,
    technomancerProgrammingLanguage: language }
  const level20Slots = classSpellSlots(level20Base)!
  const level20: Character = { ...level20Base,
    feats: [{ name: 'Cache Caster', type: 'Class Feat', level: 14 }, { name: 'Root Access', type: 'Class Feat', level: 20 }] }
  expect(classSpellSlots(level20)?.[9]).toBe(level20Slots[9] + 1)
  expect(classSpellSlots(level20)?.[10]).toBe(2)
  expect(classExtraSlots(level20).find(slot => slot.source === 'Cache Caster')?.rank).toBe(9)
})

it('adds the Cache Caster slot to flexible Technomancer manual slots', () => {
  const c: Character = { ...base, systems: ['sf2e'], className: 'Technomancer', level: 14,
    technomancerProgrammingLanguage: 'DPS++',
    feats: [{ name: 'Flexible Spellcaster Dedication', type: 'Archetype Feat', level: 2 },
      { name: 'Cache Caster', type: 'Class Feat', level: 14 }],
    spellcasting: { ability: 'int', tradition: 'Arcane', rank: 1,
      slots: { 0: 5, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2 } } }
  expect(classSpellSlots(c)).toBeUndefined()
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('Spell Rank 7 (0/3)')
})

it('adds Cleric Divine Font slots at the highest spell rank, restricted to Heal or Harm', () => {
  const c: Character = { ...base, className: 'Cleric', systems: ['pf2e'], level: 1 }
  const entry = (name: string, kind: ContentEntry['kind'], data: ContentEntry['data']): ContentEntry => ({
    id: name, name, kind, systems: ['pf2e'], source: 'official', level: 1, traits: [],
    data, description: '', effects: [], updatedAt: 0,
  })
  const entries = [
    entry('Cleric', 'class', { tradition: 'Divine', attribute: 'Wisdom' }),
    entry('Heal', 'spell', { tradition: 'Divine' }),
    entry('Harm', 'spell', { tradition: 'Divine' }),
    entry('Fear', 'spell', { tradition: 'Divine' }),
  ]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Spell Rank 1 slot 6')
  expect(html).toContain('value="Heal"')
  expect(html).toContain('value="Harm"')
  expect(html).not.toContain('value="Fear"')
  expect(classSpellSlots({ ...c, level: 5 })?.[3]).toBe(7)
  expect(classSpellSlots({ ...c, level: 15 })?.[8]).toBe(8)
})

it('adds Gouging Claw and Puff of Poison to Calistria Divine spell options only', () => {
  const cantrip = (name: string): ContentEntry => ({
    ...baseEntry(name), id: name, kind: 'spell', level: 1, traits: ['Cantrip'],
    data: { tradition: 'Arcane, Primal' },
  })
  const entries = [
    { ...baseEntry('Cleric'), data: { tradition: 'Divine', attribute: 'Wisdom' } },
    cantrip('Gouging Claw'),
    cantrip('Puff of Poison'),
  ]
  const picker = (deity: string) => {
    const c: Character = { ...base, className: 'Cleric', deity, level: 1 }
    return /<select[^>]*aria-label="Cantrip slot 1"[\s\S]*?<\/select>/
      .exec(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />))?.[0] ?? ''
  }
  const calistria = picker('Calistria')
  expect(calistria).toContain('Gouging Claw')
  expect(calistria).toContain('Puff of Poison')
  expect(picker('Erastil')).not.toContain('Gouging Claw')
  expect(picker('Erastil')).not.toContain('Puff of Poison')
})

it('uses PF2e spell variants for Rogue Cleric Dedication slots, including Loaner Spell', () => {
  const pf2eVoidWarp: ContentEntry = {
    ...baseEntry('Void Warp'), id: 'void-warp-pf2e', kind: 'spell', level: 1, traits: ['Cantrip'],
    data: { tradition: 'Divine' },
  }
  const sf2eVoidWarp: ContentEntry = {
    ...pf2eVoidWarp, id: 'void-warp-sf2e', systems: ['sf2e'] as ContentEntry['systems'],
  }
  const c: Character = { ...base, className: 'Rogue', systems: ['pf2e', 'sf2e'], level: 10,
    feats: [
      { name: 'Cleric Dedication', type: 'Archetype Feat', level: 2 },
      { name: 'Basic Cleric Spellcasting', type: 'Archetype Feat', level: 4 },
      { name: 'Loaner Spell', type: 'Class Feat', level: 8 },
    ],
    spells: [
      { name: 'Void Warp', rank: 1, cantrip: true, entryId: pf2eVoidWarp.id },
      { name: 'Void Warp', rank: 1, cantrip: true, entryId: sf2eVoidWarp.id },
    ] }
  const entries: ContentEntry[] = [
    { ...baseEntry('Rogue'), systems: ['pf2e'] as ContentEntry['systems'] }, pf2eVoidWarp, sf2eVoidWarp,
  ]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  const cantripPicker = /<select[^>]*aria-label="Cantrip slot 1"[\s\S]*?<\/select>/.exec(html)?.[0] ?? ''
  expect(cantripPicker).toContain('value="void-warp-pf2e"')
  expect(cantripPicker).not.toContain('value="void-warp-sf2e"')
  expect(html).toContain('aria-label="Spell Rank 3 slot 2"')
  expect(html).not.toContain('aria-label="Loaner Spell"')
})

it('keeps flexible prepared casting on manual slot settings', () => {
  const c: Character = { ...base, className: 'Wizard', level: 2,
    feats: [{ name: 'Flexible Spellcaster Dedication', type: 'Class Feat', level: 2 }] }
  expect(classSpellSlots(c)).toBeUndefined()
})

it('Divine Breadth adds cleric archetype slots for any Cleric Dedication', () => {
  const feat = (name: string, slot: string) => ({ name, type: 'Archetype Feat', level: 2, slot })
  const c: Character = { ...base, className: 'Fighter', level: 10, feats: [feat('Cleric Dedication', 'archetype:2:0'),
    feat('Basic Cleric Spellcasting', 'archetype:4:0'), feat('Divine Breadth', 'archetype:8:0')] }
  expect(classSpellSlots({ ...c, feats: c.feats.slice(0, 2) })).toEqual({ 0: 2, 1: 1, 2: 1, 3: 1 })
  expect(classSpellSlots(c)).toEqual({ 0: 2, 1: 2, 2: 1, 3: 1 })
})

it('turns Loaner Spell into an extra slot of up to 3rd rank for a multiclass caster', () => {
  const feat = (name: string, slot: string) => ({ name, type: 'Archetype Feat', level: 2, slot })
  const c: Character = { ...base, className: 'Rogue', level: 10, feats: [feat('Cleric Dedication', 'archetype:2:0'),
    feat('Basic Cleric Spellcasting', 'archetype:4:0'), { name: 'Loaner Spell', type: 'Class Feat', level: 8, slot: 'class:8:0' }] }
  expect(classSpellSlots(c)).toEqual({ 0: 2, 1: 1, 2: 1, 3: 2 })
  expect(classSpellSlots({ ...c, feats: c.feats.slice(0, 2) })).toEqual({ 0: 2, 1: 1, 2: 1, 3: 1 })
})
