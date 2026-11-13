import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { CharacterBuilder } from './CharacterBuilder'
import { mapAonHit } from './aon'
import { fetchAonHits } from './aonQuery'
import type { Character, ContentEntry } from './types'

const content = vi.hoisted(() => ({ entries: [] as ContentEntry[] }))
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => content.entries }))

it('shows ancestry-specific Lore in Skills and feat-adjusted Bulk limits inside Gear', () => {
  content.entries = ['Ancestral Skills', 'Hardy Traveler'].map(name => ({
    id: name, systems: ['sf2e'], name, kind: 'feat', source: 'official', traits: ['Human'], data: {},
    level: name === 'Hardy Traveler' ? 9 : 1,
    description: name === 'Hardy Traveler' ? 'Increase your maximum and encumbered Bulk limits by 1.' : '',
    effects: [], updatedAt: 1,
  }))
  const c: Character = {
    id: 'human', systems: ['sf2e'], name: 'Test', level: 9, ancestry: 'Human',
    abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: content.entries.map(feat => ({ name: feat.name, type: 'Ancestry Feat', level: feat.level, slot: `ancestry:${feat.level}:0` })),
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    for (const label of ['ancestry', 'heritage', 'background', 'class', 'deity'])
      expect(markup).not.toContain(`aria-label="Search ${label}"`)
    expect(markup).toContain('Human Lore')
    const gear = markup.slice(markup.indexOf('<strong>Gear</strong>'), markup.indexOf('<strong>General Feats</strong>'))
    expect(gear).toContain('aria-label="Bulk limits"')
    expect(gear).toContain('Encumbered above <b>8</b> Bulk; maximum <b>13</b> Bulk.')
  } finally { content.entries = [] }
})

it('keeps large background and deity catalogs searchable before lazy choices are populated', () => {
  content.entries = (['background', 'deity'] as const).flatMap(kind => Array.from({ length: 11 }, (_, index): ContentEntry => ({
    id: `${kind}-${index}`, name: `${kind} ${index}`, kind, systems: ['pf2e'], source: 'official',
    level: 0, traits: [], description: '', data: {}, effects: [], updatedAt: 0,
  })))
  const c: Character = {
    id: 'large-catalog', name: 'Test', systems: ['pf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('aria-label="Search background"')
    expect(markup).toContain('aria-label="Search deity"')
    expect(markup).not.toContain('aria-label="Search heritage"')
  } finally { content.entries = [] }
})

it('retains official access metadata and shows saved ethnicity without changing ancestry or heritage', async () => {
  const fetchFn: typeof fetch = async (_url, init) => {
    expect(JSON.parse(String(init?.body))._source).toContain('access')
    return new Response(JSON.stringify({ hits: { hits: String(init?.body).includes('"category":"feat"')
      ? [{ _id: 'feat-949', _source: { category: 'feat', name: 'Witch Warden', access: 'Kellid ethnicity', trait: ['Human', 'Uncommon'] } }] : [] } }))
  }
  const mapped = mapAonHit((await fetchAonHits('pf2e', fetchFn))[0], 'pf2e')
  if (!mapped) throw new Error('Missing access mapping')
  expect(mapped.data.access).toBe('Kellid ethnicity')
  content.entries = [mapped, { ...mapped, id: 'dwarf', name: 'Avenge in Glory', traits: ['Dwarf'], data: { access: 'mountain dwarf ethnicity' } }]
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Human', heritage: 'Versatile Human', ethnicity: 'Kellid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const saved: Character = JSON.parse(JSON.stringify(c))
    const markup = renderToStaticMarkup(<CharacterBuilder character={saved} onClose={() => {}} />)
    expect(markup).toContain('aria-label="Ethnicity"')
    expect(markup).toContain('<option selected="">Kellid</option>')
    const ethnicity = markup.match(/<select[^>]*aria-label="Ethnicity"[^>]*>[\s\S]*?<\/select>/)?.[0]
    expect(ethnicity).not.toContain('Mountain Dwarf')
    expect(markup).toContain('Access does not replace prerequisites.')
    expect(saved).toMatchObject({ ancestry: 'Human', heritage: 'Versatile Human', ethnicity: 'Kellid' })
    const changed = renderToStaticMarkup(<CharacterBuilder character={{ ...saved, ancestry: 'Dwarf' }} onClose={() => {}} />)
    const dwarfEthnicity = changed.match(/<select[^>]*aria-label="Ethnicity"[^>]*>[\s\S]*?<\/select>/)?.[0]
    expect(dwarfEthnicity).toContain('Mountain Dwarf')
    expect(dwarfEthnicity).toContain('disabled=""')
    expect(dwarfEthnicity).toContain('Kellid (not available for Dwarf)')
    expect(renderToStaticMarkup(<CharacterBuilder character={{ ...saved, ancestry: undefined }} onClose={() => {}} />))
      .toContain('aria-label="Ethnicity" disabled=""')
  } finally { content.entries = [] }
})

it('retains full material and rune rules through snapshot fetching and mapping, without expanding ordinary item summaries', async () => {
  const sources = [
    { name: 'Peachwood Weapon', item_subcategory: 'Precious Material Weapons' },
    { name: 'Grisantian Pelt Armor', item_subcategory: 'Precious Material Armor' },
    { name: 'Peachwood', item_category: 'Materials' },
    { name: 'Flaming', item_subcategory: 'Weapon Property Runes' },
    { name: 'Rope', item_subcategory: 'Adventuring Gear' },
  ]
  const fetchFn: typeof fetch = async (_url, init) => new Response(JSON.stringify({
    hits: { hits: String(init?.body).includes('"category":"equipment"') ? sources.map((source) => ({
      _id: source.name, _source: { category: 'equipment', ...source, summary: 'Short summary.', markdown: 'Full rules.\n\nAdditional benefit.' },
    })) : [] },
  }))
  const hits = await fetchAonHits('pf2e', fetchFn)
  expect(hits).toHaveLength(5)
  for (const hit of hits.slice(0, 4)) {
    expect(hit._source?.markdown).toContain('Additional benefit.')
    expect(mapAonHit(hit, 'pf2e')?.description).toBe('Full rules.\n\nAdditional benefit.')
  }
  expect(hits[4]._source?.markdown).toBeUndefined()
  expect(mapAonHit(hits[4], 'pf2e')?.description).toBe('Short summary.')
})

it('alphabetizes collapsible main sections without showing other feat slots', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  const headings = [...markup.matchAll(/<summary class="character-section-summary"><strong>([^<]+)<\/strong>/g)]
    .map((match) => match[1])
  expect(headings).toEqual([
    'Ability Scores', 'Ancestry', 'Background', 'Class', 'Dedications', 'Defense', 'Deity', 'Gear',
    'General Feats', 'Languages', 'Minions', 'Offense', 'Skill Feats', 'Skills', 'Spells',
  ])
  expect(markup.match(/<details class="character-section">/g)).toHaveLength(headings.length)
  expect(markup).not.toContain('Other Feat Slots')
  expect(markup).not.toContain('Skills &amp; proficiencies')
  const background = markup.slice(markup.indexOf('<strong>Background</strong>'), markup.indexOf('<strong>Class</strong>'))
  expect(background).toContain('<h4>Achievements</h4>')
})

it('shows official deity epithets in the subtitle and picker while retaining canonical saved names', () => {
  const deity = mapAonHit({ _id: 'deity-285', _source: { category: 'deity', name: 'Iomedae', epithet: 'The Inheritor', skill: ['Intimidation'] } }, 'pf2e')
  if (!deity) throw new Error('Missing deity mapping')
  content.entries = [deity]
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Seelah', level: 1, className: 'Champion', deity: 'Iomedae',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('<strong>Deity</strong><span>Iomedae, the Inheritor</span>')
  expect(markup).toContain('<h4>Iomedae, the Inheritor</h4>')
  expect(markup).toContain('<option value="Iomedae" selected="">Iomedae, the Inheritor</option>')
  expect(c.deity).toBe('Iomedae')
  content.entries = []
  expect(renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />))
    .toContain('<strong>Deity</strong><span>Iomedae</span>')
})

it('defers unused picker choices while retaining saved values and deity labels', () => {
  content.entries = ([
    ['ancestry', 'Human'], ['ancestry', 'Elf'], ['class', 'Ranger'], ['class', 'Wizard'],
    ['deity', 'Iomedae'], ['deity', 'Abadar'],
  ] as const).map(([kind, name]): ContentEntry => ({
    id: `${kind}:${name}`, systems: ['pf2e'], kind, source: 'official', name, level: 1,
    traits: [], description: '', data: name === 'Iomedae' ? { epithet: 'The Inheritor' } : {},
    effects: [], updatedAt: 0,
  }))
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Human', className: 'Ranger',
    background: 'Missing background', deity: 'Iomedae',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('<option value="Human" selected="">Human</option>')
    expect(markup).toContain('<option value="Ranger" selected="">Ranger</option>')
    expect(markup).toContain('<option value="Iomedae" selected="">Iomedae, the Inheritor</option>')
    expect(markup).toContain('<option value="Missing background" selected="">Missing background</option>')
    for (const name of ['Elf', 'Wizard', 'Abadar']) expect(markup).not.toContain(`<option value="${name}">`)
  } finally { content.entries = [] }
})

it.each([
  ['hunters-edge', 'Ranger', 'Outwit', 'Outwit Ranger'],
  ['cause', 'Champion', 'Justice', 'Champion of Justice'],
  ['instinct', 'Barbarian', 'Giant', 'Giant Instinct Barbarian'],
  ['innovation', 'Inventor', 'Construct', 'Construct Inventor'],
])('imports %s choices and shows selected subclass in the class subtitle', (category, className, name, label) => {
  const subclass = mapAonHit({ _id: 'subclass', _source: { category, name, markdown: 'Full subclass rules.' } }, 'pf2e')
  if (!subclass) throw new Error('Missing subclass mapping')
  expect(subclass).toMatchObject({ kind: 'subclass', data: { class: className }, description: 'Full subclass rules.' })
  content.entries = [subclass]
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className, subclass: name,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain(`<strong>Class</strong><span>${label}</span>`)
  expect(markup).toContain(`<option value="${name}" selected="">${name}</option>`)
  if (className === 'Barbarian') expect(markup).toContain('>Instinct</label>')
  if (className === 'Inventor') expect(markup).toContain('>Innovation</label>')
  content.entries = []
})
