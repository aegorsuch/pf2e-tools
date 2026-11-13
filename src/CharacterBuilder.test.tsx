import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { CharacterBuilder as Builder } from './CharacterBuilder'
import type { ReactNode } from 'react'
import { mapAonHit } from './aon'
import { fetchAonHits } from './aonQuery'
import type { Character, ContentEntry } from './types'

const content = vi.hoisted(() => ({ entries: [] as ContentEntry[] }))
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => content.entries }))
vi.mock('./DeferredDetails', () => ({ DeferredDetails: ({ children }: { children: ReactNode }) =>
  <details className="character-section">{children}</details> }))
const CharacterBuilder = (props: Omit<Parameters<typeof Builder>[0], 'catalog'>) =>
  <Builder {...props} catalog={content.entries} />

it('shows Free Heart background selection in Background only while the feat is active', () => {
  const background: ContentEntry = { id: 'performer', kind: 'background', name: 'Performer', systems: ['pf2e'],
    source: 'official', level: 0, traits: [], description: 'Traveling performer.', data: { skill: 'Performance', feat: 'Fascinating Performance' }, effects: [], updatedAt: 0 }
  content.entries = [background]
  const c: Character = { id: 'free-heart', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Elf',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Free Heart', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'Performer' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    const section = markup.slice(markup.indexOf('<strong>Background</strong>'), markup.indexOf('<strong>Class</strong>'))
    expect(section).toContain('aria-label="Free Heart background"')
    expect(section).toContain('Performer')
    expect(section).toContain('not its attribute boosts')
    expect(renderToStaticMarkup(<CharacterBuilder character={{ ...c, level: 0 }} onClose={() => {}} />))
      .not.toContain('aria-label="Free Heart background"')
  } finally { content.entries = [] }
})

it('labels Rogue subclass as Racket without duplicating an additional Mastermind skill selector', () => {
  const racket: ContentEntry = { id: 'thief', systems: ['pf2e'], kind: 'subclass', source: 'official', name: 'Thief',
    level: 1, traits: [], description: '', data: { class: 'Rogue' }, effects: [], updatedAt: 0 }
  content.entries = [racket]
  const c: Character = { id: 'mastermind', systems: ['pf2e'], name: 'Test', level: 10, className: 'Rogue', subclass: 'Thief',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Mastermind' }],
    rogueRacketSkills: { Mastermind: 'Religion' }, equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('aria-label="Racket"')
    expect(markup).not.toContain('aria-label="Subclass"')
    expect(markup).not.toContain('aria-label="Mastermind racket skill"')
  } finally { content.entries = [] }
})

it('imports druidic orders as subclass descriptions without adding a second primary picker', () => {
  const order = mapAonHit({ _id: 'druidic-order-8', _source: { category: 'druidic-order', name: 'Animal',
    markdown: 'Animal order description.' } }, 'pf2e')
  expect(order).toMatchObject({ kind: 'subclass', name: 'Animal', data: { class: 'Druid' }, description: 'Animal order description.' })
  content.entries = [order!]
  const c: Character = { id: 'druid', systems: ['pf2e'], name: 'Test', level: 1, className: 'Druid', order: 'Animal',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('aria-label="Druidic Order"')
    expect(markup).not.toContain('aria-label="Subclass"')
  } finally { content.entries = [] }
})

it('preserves an incompatible saved heritage as disabled rather than selectable or silently erased', () => {
  content.entries = [
    { id: 'human', kind: 'ancestry', name: 'Human' },
    { id: 'dwarf', kind: 'ancestry', name: 'Dwarf' },
    { id: 'underground', kind: 'heritage', name: 'Underground Dwarf' },
  ].map(entry => ({ ...entry, kind: entry.kind as ContentEntry['kind'], systems: ['pf2e'], source: 'official',
    level: 0, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }))
  const c: Character = {
    id: 'heritage-test', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Human', heritage: 'Underground Dwarf',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('Armor Class 10: show breakdown')
    expect(markup).toContain('value="Underground Dwarf" disabled="" selected="">Underground Dwarf (not available for this ancestry)</option>')
    expect(c.heritage).toBe('Underground Dwarf')
  } finally { content.entries = [] }
})

it('restores Pioneer protection and terrain choices and hides them for other heritages', () => {
  const c: Character = {
    id: 'pioneer', systems: ['sf2e'], name: 'Test', level: 1, ancestry: 'Human', heritage: 'Pioneer Human',
    pioneerEnvironment: 'Cold', pioneerTerrain: 'Forest',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={JSON.parse(JSON.stringify(c))} onClose={() => {}} />)
  expect(markup).toContain('aria-label="Pioneer Human environmental protection"')
  expect(markup).toContain('<option selected="">Cold</option>')
  expect(markup).toContain('<option selected="">Forest</option>')
  expect(markup).toContain('Terrain Expertise <small>(Pioneer Human)</small></button>')
  const other = renderToStaticMarkup(<CharacterBuilder character={{ ...c, heritage: 'Versatile Human' }} onClose={() => {}} />)
  expect(other).not.toContain('aria-label="Pioneer Human')
  expect(other).not.toContain('Terrain Expertise <small>(Pioneer Human)')
})

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
    const gear = markup.slice(markup.indexOf('<strong>Equipment</strong>'), markup.indexOf('<strong>Formulas</strong>'))
    expect(gear).toContain('aria-label="Bulk limits"')
    expect(gear).toContain('Encumbered above <b>8</b> Bulk; maximum <b>13</b> Bulk.')
  } finally { content.entries = [] }
})

it('keeps equipment editing separate from offensive attack summaries', () => {
  const c: Character = {
    id: 'equipment', systems: ['pf2e'], name: 'Test', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: 'Arrows', qty: 10 }, { name: 'Bolts', qty: 10 }, { name: 'Bullets', qty: 10 }],
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  const equipment = markup.slice(markup.indexOf('<strong>Equipment</strong>'), markup.indexOf('<strong>Formulas</strong>'))
  const offense = markup.slice(markup.indexOf('<strong>Offense</strong>'), markup.indexOf('<strong>Skill Feats</strong>'))
  expect(equipment).toContain('Add Weapon')
  expect(equipment).toContain('Add Armor')
  for (const name of ['Arrows', 'Bolts', 'Bullets']) expect(equipment).toContain(`<h4>${name}</h4>`)
  expect(offense).toContain('1 Weapon')
  expect(offense).toContain('Fist')
  expect(offense).not.toContain('Add Weapon')
})

it('orders equipment groups alphabetically and separates grafts and tattoos from other equipment', () => {
  const item = (name: string, category: string): ContentEntry => ({ id: name, name, kind: 'item',
    systems: ['pf2e'], source: 'official', level: 1, traits: [], description: '', data: { item_category: category }, effects: [], updatedAt: 0 })
  content.entries = [item('Caligni Eyes', 'Grafts'), item('Spider Lily', 'Tattoos'), item('Rope', 'Adventuring Gear'),
    { ...item('Black Adder Venom', 'Alchemical Items'), traits: ['Poison', 'Injury'] }]
  const c: Character = { id: 'equipment-order', systems: ['pf2e', 'sf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Poison Weapon', type: 'Class Feat', level: 1 }],
    equipment: ['Spider Lily', 'Rope', 'Caligni Eyes', 'Arrows', 'Bolts', 'Bullets', 'Black Adder Venom'].map(name => ({ name, qty: 1 })),
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    const equipment = markup.slice(markup.indexOf('<strong>Equipment</strong>'), markup.indexOf('<strong>Formulas</strong>'))
    const headers = [...equipment.matchAll(/<h4>([^<]+)<\/h4>/g)].map(match => match[1])
    expect(headers).toEqual(['Armor', 'Arrows', 'Augmentations', 'Bolts', 'Bullets', 'Grafts',
      'Handwraps', 'Other equipment', 'Poisons', 'Shield', 'Tattoos', 'Weapons'])
    expect(equipment.slice(equipment.indexOf('<h4>Grafts</h4>'), equipment.indexOf('<h4>Handwraps</h4>'))).toContain('Caligni Eyes')
    expect(equipment.slice(equipment.indexOf('<h4>Tattoos</h4>'), equipment.indexOf('<h4>Weapons</h4>'))).toContain('Spider Lily')
    const poisons = equipment.slice(equipment.indexOf('<h4>Poisons</h4>'), equipment.indexOf('<h4>Shield</h4>'))
    expect(poisons).toContain('Black Adder Venom')
    expect(poisons).toContain('Simple injury poisons')
    expect(poisons).toContain('1d4')
    const withoutFeat = renderToStaticMarkup(<CharacterBuilder character={{ ...c, feats: [] }} onClose={() => {}} />)
    const poisonItems = withoutFeat.slice(withoutFeat.indexOf('<h4>Poisons</h4>'), withoutFeat.indexOf('<h4>Shield</h4>'))
    expect(poisonItems).toContain('Black Adder Venom')
    expect(poisonItems).not.toContain('Simple injury poisons')
    expect(equipment).toContain('Add Armor')
    expect(equipment).toContain('Add Shield')
    expect(equipment).toContain('Add Weapon')
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
    expect(markup).toContain('aria-label="Background" aria-haspopup="dialog"')
    expect(markup).toContain('aria-label="Deity" aria-haspopup="dialog"')
    expect(markup).not.toContain('aria-label="Search background"')
    expect(markup).not.toContain('aria-label="Search deity"')
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
    'Ability Scores', 'Ancestry', 'Background', 'Class', 'Dedications', 'Defense', 'Deity', 'Equipment', 'Formulas',
    'General Feats', 'Languages', 'Minions', 'Offense', 'Skill Feats', 'Skills', 'Spells',
  ])
  expect(markup.match(/<details class="character-section">/g)).toHaveLength(headings.length)
  expect(markup).not.toContain('Other Feat Slots')
  expect(markup).not.toContain('Skills &amp; proficiencies')
  const background = markup.slice(markup.indexOf('<strong>Background</strong>'), markup.indexOf('<strong>Class</strong>'))
  expect(background).toContain('<h4>Achievements</h4>')
})

it('shows defense summary context toggles only for equipped shields or parry-capable builds', () => {
  content.entries = [{ id: 'feat:parry', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Parry Expert',
    level: 1, traits: ['Ranger'], description: 'The circumstance bonus to AC from your parry trait increases to +2.', data: {}, effects: [], updatedAt: 0 }]
  const baseCharacter: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const plain = renderToStaticMarkup(<CharacterBuilder character={baseCharacter} onClose={() => {}} />)
    expect(plain).not.toContain('Raise Shield (summary)')
    expect(plain).not.toContain('Parry active (summary)')
    const shielded = renderToStaticMarkup(<CharacterBuilder character={{ ...baseCharacter, shield: { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false } }} onClose={() => {}} />)
    expect(shielded).toContain('Raise Shield (summary)')
    const locked = renderToStaticMarkup(<CharacterBuilder character={{ ...baseCharacter, level: 20,
      feats: [{ name: 'Shield Paragon', type: 'Class Feat', level: 20 }],
      shield: { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false } }} onClose={() => {}} />)
    expect(locked).toMatch(/aria-label="Raise Shield \(summary\)" disabled="" checked=""/)
    expect(locked).toContain('Always raised by Shield Paragon')
    const parry = renderToStaticMarkup(<CharacterBuilder character={{ ...baseCharacter, feats: [{ name: 'Parry Expert', type: 'Class Feat', level: 1 }] }} onClose={() => {}} />)
    expect(parry).toContain('Parry active (summary)')
  } finally { content.entries = [] }
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
  ['hunters-edge', 'Ranger', 'Outwit', 'Outwit Edge Ranger'],
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
  expect(markup).toContain(`<strong>Class</strong><span>${label}, 0/1</span>`)
  expect(markup).toContain(`<option value="${name}" selected="">${name}</option>`)
  if (className === 'Barbarian') expect(markup).toContain('>Instinct</label>')
  if (className === 'Inventor') expect(markup).toContain('>Innovation</label>')
  content.entries = []
})
