import { expect, it } from 'vitest'
import { fetchAonHits, parseCompanion } from './aonQuery'

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
    ] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const hits = await fetchAonHits('pf2e', fetchFn)
  expect(hits.find(hit => hit._id === 'dagger')?._source?.trait).toEqual(['Agile', 'Versatile B'])
  expect(hits.find(hit => hit._id === 'other')?._source?.trait).toEqual(['Versatile S'])
  expect(hits.find(hit => hit._id === 'combination')?._source?.trait).toEqual(['Versatile S'])
})
