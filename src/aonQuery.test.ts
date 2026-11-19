import { expect, it } from 'vitest'
import { fetchAonHits, parseCompanion, parseFeatSpellGrants } from './aonQuery'
import { mapAonHit, mapAonHits } from './aon'

it('imports full familiar and master ability rules from the familiar-ability source', async () => {
  const queried: string[] = []
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: { bool: { filter: Array<{ term?: { category?: string } }> } } }
    const category = body.query.bool.filter.find(filter => filter.term)?.term?.category ?? ''
    queried.push(category)
    const hits = category === 'familiar-ability' ? [
      { _id: 'familiar-ability-1', _source: { category, name: 'Flier', summary: 'Short index summary',
        url: '/Familiars.aspx?ID=7', markdown: '**Ability Type** Familiar\n\nIt gains a fly Speed of 25 feet.' } },
      { _id: 'familiar-ability-2', _source: { category, name: 'Spell Battery', summary: 'Short index summary',
        url: '/Familiars.aspx?ID=17', markdown: '**Ability Type** Master\n\nYou gain an additional spell slot.' } },
    ] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const entries = mapAonHits(await fetchAonHits('pf2e', fetchFn), 'pf2e')

  expect(queried).toContain('familiar-ability')
  expect(entries).toMatchObject([
    { kind: 'familiar', name: 'Flier', description: 'It gains a fly Speed of 25 feet.', data: { ability_type: 'Familiar' } },
    { kind: 'familiar', name: 'Spell Battery', description: 'You gain an additional spell slot.', data: { ability_type: 'Master' } },
  ])
})

it('fetches and imports all four grim fascinations with their starting focus spells and thrall rules', async () => {
  const choices = [['Blood', 'Blood Infusion'], ['Bone', 'Bone Spear'], ['Flesh', 'Dead Weight'], ['Spirit', 'Life Tap']]
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: { bool: { filter: { term: { category: string } }[] } } }
    const category = body.query.bool.filter[0].term.category
    const hits = category === 'grim-fascination' ? choices.map(([name, spell]) => ({
      _id: `grim-fascination-${name}`, _source: { category, name,
        markdown: `**Grave Spell** [${spell}](/Spells.aspx?ID=1)\n\n**Thrall Enhancement** Full thrall rules.` },
    })) : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const entries = mapAonHits(await fetchAonHits('pf2e', fetchFn), 'pf2e')
  expect(entries).toHaveLength(4)
  expect(entries.map(entry => [entry.name, entry.data.grants_focus_spells])).toEqual(choices)
  expect(entries.every(entry => entry.kind === 'subclass' && entry.data.class === 'Necromancer'
    && entry.description.includes('Thrall Enhancement Full thrall rules.'))).toBe(true)
})

it.each(['Song of the Soul', 'Deathly Scream', 'Muscle Barrier', 'Necrotic Bomb'])('parses %s as a granted grave focus spell', name => {
  const markdown = `<title>Feat</title>\n\n---\n\nYou learn the [_${name.toLowerCase()}_](/Spells.aspx?ID=1) grave spell.`
  expect(parseFeatSpellGrants(markdown)).toEqual([{ kind: 'focus', spells: [name.toLowerCase()], heightened: true }])
})

it.each([
  ['Bone Investiture', 'You can cast [_dinosaur form_](/Spells.aspx?ID=1) on yourself as a 5th-rank innate spell once per day.',
    { kind: 'innate', spells: ['dinosaur form'], frequency: 'once per day', rank: 5, heightened: false, fixedRank: true, shared: false }],
  ['Fossil Rider', 'You can cast [_mask of terror_](/Spells.aspx?ID=1) on yourself as an innate spell once per day.',
    { kind: 'innate', spells: ['mask of terror'], frequency: 'once per day', heightened: false, shared: false }],
  ['Spiritual Headhunter', 'Once before your next daily preparations, you can cast [_talking corpse_](/Spells.aspx?ID=1) as a primal innate spell.',
    { kind: 'innate', spells: ['talking corpse'], tradition: 'primal', frequency: 'once per day', heightened: false, shared: false }],
])('parses fixed innate spell grants from %s', (_name, text, expected) => {
  expect(parseFeatSpellGrants(`<title>Feat</title>\n\n---\n\n${text}`)).toContainEqual(expected)
})

it('imports ritual entries and feat-granted rituals', () => {
  const feat = mapAonHit({ _id: 'feat-9105', _source: { name: 'Undead Creator', category: 'feat', level: 2,
    markdown: '<title>Undead Creator</title>\n\n---\n\nYou learn the [_create undead_](/Rituals.aspx?ID=117) ritual.' } }, 'pf2e')
  const ritual = mapAonHit({ _id: 'ritual-117', _source: { name: 'Create Undead', category: 'ritual', level: 2,
    trait: ['Uncommon', 'Unholy'], url: '/Rituals.aspx?ID=117', cast: '1 day', cost: 'black onyx',
    markdown: '**Cast** 1 day\n\n---\n\nYou transform the target.' } }, 'pf2e')
  expect(feat?.ritualGrants).toEqual(['create undead'])
  expect(ritual).toMatchObject({
    kind: 'ritual', name: 'Create Undead', level: 2, traits: ['Uncommon', 'Unholy'],
    data: { cast: '1 day', cost: 'black onyx', url: 'https://2e.aonprd.com/Rituals.aspx?ID=117' },
  })
  expect(ritual?.description).toContain('Cast 1 day')
})

it('retains exact table blocks and their named options for personalized feat descriptions', () => {
  const entry = mapAonHit({ _id: 'choices', _source: { name: 'Choice Feat', category: 'feat',
    markdown: 'Rules before.\n\n<table><tr><th>Style</th><th>Benefit</th></tr>\n\n'
      + '<tr><td>Power</td><td>[Athletics](/Skills.aspx?ID=3)</td></tr>'
      + '<tr><td>Focus</td><td>Arcana</td></tr></table>\n\nShared restrictions after.',
  } }, 'pf2e')!
  expect(entry.choiceDescriptions).toEqual([{
    text: 'Style Benefit\n\nPower Athletics Focus Arcana',
    options: { Power: 'Athletics', Focus: 'Arcana' },
  }])
  expect(entry.description).toContain(entry.choiceDescriptions![0].text)
  expect(entry.description).toContain('Shared restrictions after.')
})

it.each([
  '<ul><li>**Power** Athletics</li><li>**Focus** Arcana</li><li>Shared restriction.</li></ul>',
  '<table><tr><td>Power</td><td>Athletics</td></tr><tr><td>Focus</td><td>Arcana</td></tr><tr><td colspan="2">Shared restriction.</td></tr></table>',
])('does not make mixed rules and options into a replaceable choice block', markdown => {
  const entry = mapAonHit({ _id: 'mixed', _source: { name: 'Mixed Rules', category: 'feat', markdown } }, 'pf2e')
  expect(entry?.choiceDescriptions).toBeUndefined()
  expect(entry?.description).toContain('Shared restriction.')
})

it('preserves alternative divine skills even when the index lists only one', async () => {
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: { bool: { filter: Array<{ term?: { category?: string } }> } } }
    const category = body.query.bool.filter.find(filter => filter.term)?.term?.category
    const hits = category === 'deity' ? [{ _id: 'example', _source: {
      name: 'Example deity', category, skill: ['Crafting'], attribute: ['Constitution', 'Charisma'],
      markdown: '**Divine Skill** [Crafting](/skills/5-crafting) or [Intimidation](/skills/8-intimidation)\n\n**Domains** creation',
    } }] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const hits = await fetchAonHits('sf2e', fetchFn)
  expect(mapAonHits(hits, 'sf2e')[0].data.skill).toBe('Crafting, Intimidation')
})

it('loads legacy deity alignment without guessing from sanctification or adding legacy entries', async () => {
  const deities = [
    { _id: 'iomedae', _source: { category: 'deity', name: 'Iomedae', sanctification: ['holy'], legacy_id: ['good'] } },
    { _id: 'calistria', _source: { category: 'deity', name: 'Calistria', sanctification: ['holy', 'unholy'], legacy_id: ['neutral'] } },
    { _id: 'asmodeus', _source: { category: 'deity', name: 'Asmodeus', sanctification: ['unholy'], legacy_id: ['evil'] } },
    { _id: 'unknown', _source: { category: 'deity', name: 'Unknown', legacy_id: ['missing'] } },
    { _id: 'current', _source: { category: 'deity', name: 'Current', alignment: 'CG', legacy_id: ['evil'] } },
  ]
  const legacy = [
    { _id: 'good', _source: { alignment: 'LG' } },
    { _id: 'neutral', _source: { alignment: 'CN' } },
    { _id: 'evil', _source: { alignment: 'LE' } },
  ]
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: { ids?: { values: string[] }; bool?: { filter: { term: { category: string } }[] } }
    }
    const hits = body.query.ids ? legacy : body.query.bool?.filter[0].term.category === 'deity' ? deities : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const entries = mapAonHits(await fetchAonHits('pf2e', fetchFn), 'pf2e')
  expect(entries.map(entry => [entry.name, entry.data.alignment]))
    .toEqual([['Iomedae', 'LG'], ['Calistria', 'CN'], ['Asmodeus', 'LE'], ['Unknown', undefined], ['Current', 'CG']])
})

it('preserves spell duration and range wording without changing their indexed numeric values', () => {
  const entry = mapAonHit({ _id: 'invisibility', _source: {
    name: 'Invisibility', category: 'spell', duration: 600, range: 0,
    markdown: '**Range** touch\n\n**Duration** 10 minutes\n\n---\n\nRules.\n\n**Duration** 1 minute when heightened.',
  } }, 'pf2e')
  expect(entry?.data).toMatchObject({ duration: 600, range: 0, duration_text: '10 minutes', range_text: 'touch' })
  expect(mapAonHit({ _id: 'sure-strike', _source: { name: 'Sure Strike', category: 'spell',
    markdown: '**Duration** until the end of your turn\n\n---\n\nRules.' } }, 'pf2e')?.data.duration_text)
    .toBe('until the end of your turn')
})

it('preserves artifact activation action costs even for unnamed abilities and variable spell costs', () => {
  const entry = mapAonHit({ _id: 'artifact-actions', _source: {
    name: 'Artifact actions', category: 'equipment', trait: ['Artifact'],
    markdown: '**Activate** <actions string="Reaction" /> Trigger A hit.\n\n'
      + '**Activate\u2014Spell** <actions string="" /> Effect Cast a Spell.\n\n'
      + '**Activate** <actions string="Two Actions" /> Effect A power.',
  } }, 'pf2e')
  expect(entry?.data.artifact_activation_actions).toBe('Reaction;;Two Actions')
  expect(entry?.description).toContain('Activate\u2014Spell')
})

it('retains the two legacy alignment runes referenced by artifacts without enabling unrelated legacy equipment', async () => {
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
  expect(queries.find(query => query.category === 'equipment')?.mustNot).toContainEqual({
    bool: { filter: [{ exists: { field: 'remaster_id' } }], must_not: [{ ids: { values: ['equipment-290', 'equipment-291'] } }] },
  })
  expect(mapAonHit({ _id: 'equipment-290', _source: { name: 'Anarchic', category: 'equipment',
    url: '/Equipment.aspx?ID=290' } }, 'pf2e')?.data.url).toBe('https://2e.aonprd.com/Equipment.aspx?ID=290&NoRedirect=1')
})

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

it.each(['pf2e', 'sf2e'] as const)('retains the complete %s ancestry introduction without unrelated page sections', async system => {
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: { bool: { filter: Array<{ term?: { category?: string } }> } } }
    const category = body.query.bool.filter.find(filter => filter.term)?.term?.category
    const hits = category === 'ancestry' ? [{
      _id: 'example', _source: { category, name: 'Example', summary: 'Truncated...',
        markdown: '<title level="1">Example</title>\n<column>\n**Source** Core pg. 10\n\n'
          + '_Full introductory paragraph._\n\nSecond paragraph with [linked text](/example).\n\n'
          + '</column>\n<title level="2">You Might...</title>\nUnrelated suggestions.\n<title level="2">Society</title>\nUnrelated society text.' },
    }] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const hits = await fetchAonHits(system, fetchFn)
  expect(hits[0]._source?.markdown).toBeUndefined()
  expect(mapAonHits(hits, system)[0].description)
    .toBe('Full introductory paragraph. Second paragraph with linked text.')
  expect(mapAonHit({ _id: 'older', _source: { category: 'ancestry', name: 'Older', summary: 'Existing summary.' } }, system)?.description)
    .toBe('Existing summary.')
})

it('retains full background text and benefits instead of the truncated indexed summary', async () => {
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: { bool: { filter: Array<{ term?: { category?: string } }> } } }
    const category = body.query.bool.filter.find(filter => filter.term)?.term?.category
    const hits = category === 'background' ? [{ _id: 'background', _source: { category, name: 'Example',
      summary: 'You once lived far away...',
      markdown: '<title level="1">Example</title>\n\n**Source** Core pg. 10\n\n</column>\n\n'
        + 'You once lived far away. This is the complete final sentence.\n\nYou gain the [Steady Balance](/Feats.aspx?ID=1) skill feat.',
    } }] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const entries = mapAonHits(await fetchAonHits('pf2e', fetchFn), 'pf2e')
  expect(entries[0].description).toBe('You once lived far away. This is the complete final sentence.\n\nYou gain the Steady Balance skill feat.')
  expect(entries[0].data.full_description).toBe(true)
})

it('keeps only remastered Ultimate Flexibility when both versions are available', () => {
  const legacy = { _id: 'feat-1171', _source: { category: 'feat', name: 'Ultimate Flexibility', trait: ['Fighter', 'Uncommon'] } }
  const current = { _id: 'feat-4858', _source: { category: 'feat', name: 'Ultimate Flexibility', trait: ['Fighter'],
    prerequisite: 'improved flexibility' } }
  for (const hits of [[legacy, current], [current, legacy]]) {
    expect(mapAonHits(hits, 'pf2e')).toMatchObject([
      { id: 'aon:pf2e:feat-4858', data: { prerequisite: 'improved flexibility' } },
    ])
  }
  expect(mapAonHits([legacy], 'pf2e')).toHaveLength(1)
  expect(mapAonHits([legacy, current], 'sf2e')).toHaveLength(2)
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

it('imports full companion introductions while keeping stat blocks separate', async () => {
  const markdown = '<title>Example</title>\n\n**Source** Sample Book\n\nFirst full paragraph.\n\nSecond paragraph.\n\n<column gap="tiny">\n**Size** Small\n</column>'
  const fetchFn: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: { bool: { filter: Array<{ term?: { category?: string } }> } } }
    const category = body.query.bool.filter.find(filter => filter.term)?.term?.category
    const hits = category === 'animal-companion' ? [{ _id: 'example',
      _source: { category, name: 'Example', summary: 'First...', markdown } }] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const entries = mapAonHits(await fetchAonHits('pf2e', fetchFn), 'pf2e')
  expect(entries[0].description).toBe('First full paragraph.\n\nSecond paragraph.')
  expect(mapAonHit({ _source: { category: 'animal-companion', name: 'Example', summary: 'Fallback' } }, 'pf2e')?.description)
    .toBe('Fallback')
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

it('drops the Hellknight order training prerequisite and splits Mortification by damage type', () => {
  const dedication = { _id: 'feat-8812', _source: { category: 'feat', name: 'Hellknight Dedication', archetype: ['Hellknight'],
    prerequisite: 'trained by a Hellknight Order', markdown: '**Prerequisites** trained by a Hellknight Order\n\nRules.' } }
  const mortification = { _id: 'feat-910', _source: { category: 'feat', name: 'Mortification', archetype: ['Hellknight Armiger'],
    prerequisite: 'Hellknight Armiger Dedication' } }
  const entries = mapAonHits([dedication, mortification], 'pf2e')
  expect(entries[0].data.prerequisite).toBeUndefined()
  expect(entries[0].description).not.toMatch(/trained by a Hellknight Order/)
  expect(entries.slice(1).map(entry => [entry.name, entry.data.resistances])).toEqual([
    ['Mortification (Bludgeoning)', 'bludgeoning=hellknight'],
    ['Mortification (Piercing)', 'piercing=hellknight'],
    ['Mortification (Slashing)', 'slashing=hellknight'],
  ])
})
