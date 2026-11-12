import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { CharacterBuilder } from './CharacterBuilder'
import { mapAonHit } from './aon'
import { fetchAonHits } from './aonQuery'
import type { Character, ContentEntry } from './types'

const content = vi.hoisted(() => ({ entries: [] as ContentEntry[] }))
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => content.entries }))

it('retains official access metadata and shows saved ethnicity without changing ancestry or heritage', async () => {
  const fetchFn: typeof fetch = async (_url, init) => {
    expect(JSON.parse(String(init?.body))._source).toContain('access')
    return new Response(JSON.stringify({ hits: { hits: String(init?.body).includes('"category":"feat"')
      ? [{ _id: 'feat-949', _source: { category: 'feat', name: 'Witch Warden', access: 'Kellid ethnicity', trait: ['Human', 'Uncommon'] } }] : [] } }))
  }
  const mapped = mapAonHit((await fetchAonHits('pf2e', fetchFn))[0], 'pf2e')
  if (!mapped) throw new Error('Missing access mapping')
  expect(mapped.data.access).toBe('Kellid ethnicity')
  content.entries = [mapped]
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
    expect(markup).toContain('Access does not replace prerequisites.')
    expect(saved).toMatchObject({ ancestry: 'Human', heritage: 'Versatile Human', ethnicity: 'Kellid' })
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
  if (className === 'Barbarian') expect(markup).toContain('<label>Instinct')
  if (className === 'Inventor') expect(markup).toContain('<label>Innovation')
  content.entries = []
})
