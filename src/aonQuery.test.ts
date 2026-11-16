import { expect, it } from 'vitest'
import { fetchAonHits, parseCompanion } from './aonQuery'
import { mapAonHit, mapAonHits } from './aon'

it('keeps full equipment rules for clickable item descriptions instead of truncated summaries', async () => {
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: { bool: { filter: Array<{ term?: { category?: string } }> } } }
    const category = body.query.bool.filter.find(filter => filter.term)?.term?.category
    const hits = category && ['equipment', 'weapon', 'armor', 'shield'].includes(category)
      ? [{ _id: category, _source: { category, name: `Example ${category}`, summary: 'Truncated summary...',
        markdown: '**Source** Core\n\n<traits>\n\n</traits>\n\nComplete rules, including the activation and its effects.' } }] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const entries = mapAonHits(await fetchAonHits('pf2e', fetchFn), 'pf2e')
  expect(entries).toHaveLength(4)
  for (const entry of entries) {
    expect(entry.description).toContain('Complete rules, including the activation and its effects.')
    expect(entry.description).not.toContain('Truncated summary')
    expect(entry.description).toBe('Source Core\n\nComplete rules, including the activation and its effects.')
  }
})

it('excludes the legacy Ranger snare chain from existing snapshots but keeps remastered snares', () => {
  const legacy = [
    ['feat-506', 'Snare Specialist'], ['feat-509', 'Quick Snares'], ['feat-516', 'Powerful Snares'],
    ['feat-527', 'Lightning Snares'], ['feat-539', 'Ubiquitous Snares'],
    ['feat-1766', 'Snare Hopping'], ['feat-1779', 'Impossible Snares'],
  ].map(([id, name]) => ({ _id: id, _source: { category: 'feat', name, trait: ['Ranger'] } }))
  const current = [
    { _id: 'current-lightning', _source: { category: 'feat', name: 'Lightning Snares', trait: ['Archetype'], archetype: ['Snarecrafter'] } },
    { _id: 'current-dedication', _source: { category: 'feat', name: 'Snarecrafter Dedication', trait: ['Archetype', 'Dedication'] } },
    { _id: 'current-crafting', _source: { category: 'feat', name: 'Snare Crafting', trait: ['General', 'Skill'] } },
  ]
  expect(mapAonHits([...legacy, ...current], 'pf2e').map(entry => entry.name))
    .toEqual(['Lightning Snares', 'Snarecrafter Dedication', 'Snare Crafting'])
  expect(mapAonHits(legacy, 'sf2e')).toHaveLength(legacy.length)
})

it('excludes retired Ranger feats from Pathfinder feat queries only', async () => {
  const queries: Array<{ category?: string; mustNot: unknown[] }> = []
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: { bool: { filter: Array<{ term?: { category?: string } }>; must_not?: unknown[] } }
    }
    queries.push({ category: body.query.bool.filter.find(filter => filter.term)?.term?.category,
      mustNot: body.query.bool.must_not ?? [] })
    return new Response(JSON.stringify({ hits: { hits: [] } }), { status: 200 })
  }
  await fetchAonHits('pf2e', fetchFn)
  const exclusion = { ids: { values: [
    'feat-506', 'feat-509', 'feat-516', 'feat-527', 'feat-539', 'feat-1766', 'feat-1779',
  ] } }
  expect(queries.find(query => query.category === 'feat')?.mustNot).toContainEqual(exclusion)
  expect(queries.filter(query => query.category !== 'feat').every(query =>
    !query.mustNot.some(clause => JSON.stringify(clause) === JSON.stringify(exclusion)))).toBe(true)
  queries.length = 0
  await fetchAonHits('sf2e', fetchFn)
  expect(queries.find(query => query.category === 'feat')?.mustNot).not.toContainEqual(exclusion)
})

it('retains Starfinder weapon upgrade capacity, grade tracking, and ammunition', async () => {
  const markdown = '**Upgrades** 1\n**Ammunition** 10 [charges](/equipment/ammunition/2-batteries)\n'
    + '<table><tr><th>Grade</th><th>Upgrades</th><th>Traits</th></tr>'
    + '<tr><td>Advanced Laser Pistol</td><td>2</td><td>[Tracking +1](/traits/183-tracking)</td></tr></table>'
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: { bool: { filter: Array<{ term?: { category?: string } }> } } }
    const category = body.query.bool.filter.find(filter => filter.term)?.term?.category
    const hits = category === 'weapon' ? [
      { _id: 'base', _source: { category, name: 'Laser Pistol', trait: ['Tech'], markdown } },
      { _id: 'advanced', _source: { category, name: 'Advanced Laser Pistol', trait: ['Tech'], markdown } },
    ] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const hits = await fetchAonHits('sf2e', fetchFn)
  expect(hits.find(hit => hit._id === 'base')?._source).toMatchObject({ upgrade_slots: 1, weapon_ammunition: '10 charges' })
  expect(hits.find(hit => hit._id === 'advanced')?._source).toMatchObject({ upgrade_slots: 2, weapon_tracking: 1 })
})

it('retains modular mode traits and damage types and the base weapon minimum grade', async () => {
  const markdown = '<traits><trait label="Modular (A and Razing or V and Deadly d10)" /></traits>'
    + '<title level="2">Mode 1</title><traits><trait label="Tech" /><trait label="Razing" /></traits>\n**Damage** 1d8 A\n'
    + '<title level="2">Mode 2</title><traits><trait label="Tech" /><trait label="Deadly d10" /></traits>\n**Damage** 1d8 V\n'
    + '<title level="2">Improvements</title><table><tr><th>Grade</th><th>Level</th><th>Upgrades</th><th>Traits</th></tr>'
    + '<tr><td>Tactical Reality Ripper</td><td>2</td><td>1</td><td>[Tracking +1](/traits/183-tracking)</td></tr>'
    + '<tr><td>Advanced Reality Ripper</td><td>4</td><td>2</td><td>[Tracking +1](/traits/183-tracking)</td></tr></table>'
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: { bool: { filter: Array<{ term?: { category?: string } }> } } }
    const category = body.query.bool.filter.find(filter => filter.term)?.term?.category
    return new Response(JSON.stringify({ hits: { hits: category === 'weapon' ? [
      { _id: 'ripper', _source: { category, name: 'Reality Ripper', level: 2, trait: ['Tech', 'Modular', 'Razing', 'Deadly'], markdown } },
    ] : [] } }), { status: 200 })
  }
  const hit = (await fetchAonHits('sf2e', fetchFn))[0]
  const mapped = mapAonHit(hit, 'sf2e')!
  expect(mapped.data).toMatchObject({ weapon_tracking: 1, upgrade_slots: 1 })
  expect(mapped.weaponModes).toEqual([
    { id: 'mode-1', damageType: 'acid', traits: ['Tech', 'Razing'] },
    { id: 'mode-2', damageType: 'void', traits: ['Tech', 'Deadly d10'] },
  ])
})

const companionMarkdown = `**Melee** <actions value="Single Action" /> jaws
**Damage** 1d8 piercing
**Support Benefit** The companion distracts its target.
**Advanced Maneuver** Bear Hug <document id="action-2275" />`

it('parses the linked action record for a companion advanced maneuver', () => {
  expect(parseCompanion(companionMarkdown)).toMatchObject({
    attacks: 'jaws|1d8 piercing|',
    support: 'The companion distracts its target.',
    maneuver: 'Bear Hug',
    maneuverActionUrl: '/Actions.aspx?ID=2275',
  })
})

it('loads companion maneuver action costs, requirements, and descriptions from AoN', async () => {
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: { bool: { filter: Array<Record<string, unknown>> } }
    }
    const filters = body.query.bool.filter
    const actionLookup = filters.some(filter => 'terms' in filter)
    const category = filters.map(filter => (filter.term as { category?: string } | undefined)?.category)
      .find(Boolean)
    const hits = actionLookup
      ? [{ _id: 'action-2275', _source: {
          url: '/Actions.aspx?ID=2275', actions: 'Two Actions', trait: ['Flourish'],
        markdown: '**Requirements** The companion has a creature grabbed.\n---\nThe companion crushes the grabbed creature.',
      } }]
      : category === 'animal-companion'
        ? [{ _id: 'bear', _source: { category, markdown: companionMarkdown } }]
        : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }

  const hits = await fetchAonHits('pf2e', fetchFn)
  expect(hits.find(hit => hit._id === 'bear')?._source).toMatchObject({
    companion_maneuver_actions: 'Two Actions',
    companion_maneuver_traits: 'Flourish',
    companion_maneuver_requirements: 'The companion has a creature grabbed.',
    companion_maneuver_description: 'The companion crushes the grabbed creature.',
  })
})

it('preserves weapon versatile damage labels from full AoN traits', async () => {
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: { bool: { filter: Array<{ term?: { category?: string } }> } } }
    const category = body.query.bool.filter.find(filter => filter.term)?.term?.category
    const hits = category === 'weapon' ? [
      { _id: 'dagger', _source: { category, trait: ['Agile', 'Versatile'],
        markdown: '<traits><trait label="Agile" /><trait label="Versatile B" url="/Traits.aspx?ID=1" /></traits>' } },
      { _id: 'other', _source: { category, trait: ['Versatile'], markdown: '<traits><trait label="Versatile S" /></traits>' } },
      { _id: 'combination', _source: { category, name: 'Dagger Pistol (Melee)', trait: ['Versatile'],
        markdown: '<traits><trait label="Combination" /></traits><title level="2">Melee</title>\n<traits><trait label="Versatile S" /></traits><title level="2">Ranged</title>\n<traits><trait label="Versatile B" /></traits>' } },
      { _id: 'stock', _source: { category, trait: ['Attached', 'Two-Hand'],
        markdown: '<traits><trait label="Attached" /><trait label="Two-Hand d8" /></traits>' } },
      { _id: 'katana', _source: { category, trait: ['Two-Hand'],
        markdown: '<traits><trait label="Two-Hand 1d10" url="/Traits.aspx?ID=198" /></traits>' } },
      { _id: 'critical', _source: { category, trait: ['Deadly', 'Fatal', 'Fatal Aim'],
        markdown: '<traits><trait label="Deadly d8" /><trait label="Fatal d12" /><trait label="Fatal Aim 1d10" /></traits>' } },
    ] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const hits = await fetchAonHits('pf2e', fetchFn)
  expect(hits.find(hit => hit._id === 'dagger')?._source?.trait).toEqual(['Agile', 'Versatile B'])
  expect(hits.find(hit => hit._id === 'other')?._source?.trait).toEqual(['Versatile S'])
  expect(hits.find(hit => hit._id === 'combination')?._source?.trait).toEqual(['Versatile S'])
  expect(hits.find(hit => hit._id === 'stock')?._source?.trait).toEqual(['Attached', 'Two-Hand d8'])
  expect(hits.find(hit => hit._id === 'katana')?._source?.trait).toEqual(['Two-Hand d10'])
  expect(hits.find(hit => hit._id === 'critical')?._source?.trait).toEqual(['Deadly d8', 'Fatal d12', 'Fatal Aim d10'])
})
