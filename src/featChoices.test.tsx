import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { mapAonHit } from './aon'
import { fetchAonHits } from './aonQuery'
import { FeatChoice } from './FeatChoice'
import { FeatSlots } from './FeatSlots'
import { SpellsSection } from './SpellsSection'
import { canSelectWardenFeat, compareFeatSelections, grantedWardenSpells, spellWardenLabel, wardenSpellOptions } from './featChoices'
import { eligibleFeats } from './builder'
import { classSpellcasting, ranksAt, weaponAttack } from './builder'
import type { Character, ContentEntry } from './types'

const spell = (name: string, tier: string): ContentEntry => ({
  id: name, systems: ['pf2e'], kind: 'spell', source: 'official', name, level: tier === 'Initiate' ? 1 : 2,
  traits: ['Focus', 'Ranger'], description: '', data: { warden_spell_tier: tier }, effects: [], updatedAt: 1,
})
const entries = [spell('Gravity Weapon', 'Initiate'), spell('Heal Companion', 'Initiate'), spell('Animal Feature', 'Advanced')]
const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('saves and restores a valid feat spell choice without accepting another tradition', () => {
  const source: ContentEntry = {
    ...entries[0], id: 'magic', kind: 'feat', name: 'Otherworldly Magic', traits: [], data: {},
    spellGrants: [{ kind: 'innate', spells: [], choice: 'cantrip', tradition: 'Arcane', frequency: 'at will', heightened: true }],
  }
  const catalog: ContentEntry[] = [source,
    { ...entries[0], id: 'light', name: 'Light', traits: ['Cantrip'], data: { tradition: 'Arcane' } },
    { ...entries[0], id: 'primal', name: 'Primal Cantrip', traits: ['Cantrip'], data: { tradition: 'Primal' } }]
  let c: Character = { ...base, feats: [{ name: source.name, type: 'Ancestry Feat', level: 1 }] }
  const tree = () => FeatChoice({ c, entries: catalog, index: 0, save: patch => { c = { ...c, ...patch } } })
  findSelect(tree())!.onChange({ target: { value: 'Primal Cantrip' } })
  expect(c.feats[0].choice).toBeUndefined()
  findSelect(tree())!.onChange({ target: { value: 'Light' } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats[0].choice).toBe('Light')
  expect(renderToStaticMarkup(tree())).toContain('<option selected="">Light</option>')
})

it('lets an existing Scrapper choose a calculated skill variant and flags variants invalidated by changed training', () => {
  let c: Character = { ...base, level: 5, ancestry: 'Human',
    feats: [{ name: 'Technomagical Scrapper', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' }] }
  const tree = () => FeatChoice({ c, entries: [], index: 0, save: patch => { c = { ...c, ...patch } } })
  findSelect(tree())!.onChange({ target: { value: 'Arcana to Expert' } })
  expect(c.feats[0].choice).toBeUndefined()
  findSelect(tree())!.onChange({ target: { value: 'Arcana to Trained' } })
  expect(ranksAt(c, [])).toMatchObject({ Crafting: 1, Arcana: 1 })
  c = { ...c, skillPicks: ['Arcana'] }
  expect(renderToStaticMarkup(tree())).toContain('Saved skill variant is unavailable')
  findSelect(tree())!.onChange({ target: { value: 'Nature to Trained' } })
  expect(ranksAt(c, [])).toMatchObject({ Crafting: 1, Arcana: 1, Nature: 1 })
  expect(renderToStaticMarkup(tree())).not.toContain('Saved skill variant is unavailable')
})

function findSelect(node: ReactNode): { onChange: (event: { target: { value: string } }) => void } | undefined {
  let found: { onChange: (event: { target: { value: string } }) => void } | undefined
  Children.forEach(node, (child) => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'select') found = { onChange: child.props.onChange as (event: { target: { value: string } }) => void }
    else found = findSelect(child.props.children as ReactNode)
  })
  return found
}

it.each([
  ['Adopted Ancestry', 'Human', 'ancestry'],
  ['Skill Training', 'Stealth', 'skill'],
  ['Weapon Proficiency', 'Falcata', 'advanced weapon'],
])('saves and restores the mechanical %s choice without changing its slot', (name, choice, label) => {
  const data: ContentEntry[] = [
    { ...entries[0], id: 'human', kind: 'ancestry', name: 'Human', data: {}, traits: [] },
    { ...entries[0], id: 'falcata', kind: 'weapon', name: 'Falcata', data: { weapon_category: 'Advanced', damage: '1d8 slashing' }, traits: [] },
    { ...entries[0], id: 'ranger', kind: 'class', name: 'Ranger', data: { attack_proficiency: 'Trained in martial weapons' }, traits: [] },
  ]
  let c: Character = { ...base, level: 3, ancestry: 'Elf', feats: [
    { name, type: 'General Feat', level: 1, slot: 'general:3:0' },
  ] }
  const tree = () => FeatChoice({ c, entries: data, index: 0, save: (patch) => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${name} ${label}"`)
  findSelect(tree())!.onChange({ target: { value: choice } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats[0]).toMatchObject({ name, choice, slot: 'general:3:0' })
  expect(renderToStaticMarkup(tree())).toContain(`<option selected="">${choice}</option>`)
  if (name === 'Skill Training') expect(ranksAt(c, data).Stealth).toBe(1)
  if (name === 'Weapon Proficiency') {
    expect(weaponAttack(c, data, { id: 'w', name: choice, potency: 0, striking: 0, runes: [] }).rank).toBe(1)
  }
  findSelect(tree())!.onChange({ target: { value: 'Not an available choice' } })
  expect(c.feats[0].choice).toBe(choice)
  findSelect(tree())!.onChange({ target: { value: '' } })
  expect(c.feats[0].choice).toBeUndefined()
})

it('preserves unavailable saved feat choices and hides meaningless proficiency and language choice inputs', () => {
  const c: Character = { ...base, feats: [{ name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Dwarf' }] }
  const markup = renderToStaticMarkup(<FeatChoice c={c} entries={[]} save={() => {}} index={0} />)
  expect(markup).toContain('<option disabled="" value="Dwarf" selected="">Dwarf</option>')
  expect(markup).toContain('physiological requirements need GM approval')
  for (const name of ['Armor Proficiency', 'Ancestral Paragon', 'Multilingual']) {
    const feat = { ...entries[0], name, kind: 'feat' as const, data: { repeatable: true } }
    expect(FeatChoice({ c: { ...base, feats: [{ name, type: 'General Feat', level: 1 }] }, entries: [feat], save: () => {}, index: 0 })).toBeNull()
  }
  const wizard: ContentEntry = { ...entries[0], kind: 'class', name: 'Wizard', data: { attack_proficiency: 'Trained in simple weapons' } }
  expect(FeatChoice({
    c: { ...base, className: 'Wizard', feats: [{ name: 'Weapon Proficiency', type: 'General Feat', level: 1 }] },
    entries: [wizard], save: () => {}, index: 0,
  })).toBeNull()
})

it('saves a named Additional Lore choice and applies its official scaling after reload', () => {
  let c: Character = { ...base, level: 7, feats: [{ name: 'Additional Lore', type: 'Skill Feat', level: 1, slot: 'skill:2:0' }] }
  const tree = FeatChoice({ c, entries: [], index: 0, save: (patch) => { c = { ...c, ...patch } } })
  let blur: ((event: { target: { value: string } }) => void) | undefined
  const walk = (node: ReactNode) => Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'input') blur = child.props.onBlur as typeof blur
    else walk(child.props.children as ReactNode)
  })
  walk(tree)
  expect(blur).toBeDefined()
  blur!({ target: { value: '  Sailing Lore  ' } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats[0]).toMatchObject({ choice: 'Sailing Lore', slot: 'skill:2:0' })
  expect(ranksAt(c, [])['Sailing Lore']).toBe(3)
})

it('imports repeatability from feat special rules without guessing from summaries', () => {
  const hit = { _id: 'feat-4862', _source: {
    name: 'Initiate Warden', category: 'feat', summary: 'You gain a spell.',
    markdown: '**Special** You can take this feat multiple times, choosing a different initial warden spell each time.',
  } }
  expect(mapAonHit(hit, 'pf2e')?.data.repeatable).toBe(true)
  expect(mapAonHit({ ...hit, _source: { ...hit._source, markdown: '**Special** You can take this ancestry feat multiple times.' } }, 'pf2e')?.data.repeatable).toBe(true)
  expect(mapAonHit({ ...hit, _source: { ...hit._source, markdown: '', summary: 'You can take this feat multiple times.' } }, 'pf2e')?.data.repeatable).toBe(false)
  expect(mapAonHit({ _source: { category: 'spell', name: 'Gravity Weapon', warden_spell_tier: 'Initiate' } }, 'pf2e')?.data.warden_spell_tier).toBe('Initiate')
})

it('imports archetype-specific levels for additional class feats', () => {
  const mapped = mapAonHit({ _id: 'launch', _source: {
    name: 'Galloping Launch', category: 'feat', level: 4, trait: ['Ranger'], archetype: ['Cavalier'],
    markdown: '**Archetype** [Cavalier](/Archetypes.aspx?ID=244) (Level 6)\n\nFeat rules.',
  } }, 'pf2e')
  expect(mapped?.level).toBe(4)
  expect(mapped?.data.archetype_levels).toBe('Cavalier:6')
  expect(mapped?.data.archetype).toBe('Cavalier')
})

it('retains full feat, spell, and rune descriptions through snapshot fetching and mapping', async () => {
  const markdown = '**Full rules**\n\n' + 'Long rules paragraph. '.repeat(100) + '\n\nFinal rule must remain.'
  const fetchFn: typeof fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as { query: { bool: { filter: { term: { category: string } }[] } } }
    const category = request.query.bool.filter[0].term.category
    return new Response(JSON.stringify({ hits: { hits: [{
      _id: category,
      _source: { category, name: category, markdown, summary: 'Short summary.', item_subcategory: 'Weapon Property Runes' },
    }] } }), { status: 200 })
  }
  const hits = await fetchAonHits('pf2e', fetchFn)
  for (const category of ['feat', 'spell', 'equipment']) {
    const hit = hits.find((h) => h._id === category)!
    expect(hit._source?.markdown).toBe(markdown)
    const description = mapAonHit(hit, 'pf2e')?.description
    expect(description).toContain('Long rules paragraph. '.repeat(100).trim())
    expect(description).toContain('Final rule must remain.')
    expect(description).not.toContain('Short summary.')
  }
  expect(mapAonHit({ _source: { category: 'feat', name: 'Fallback', summary: 'Available summary.' } }, 'pf2e')?.description)
    .toBe('Available summary.')
})

it('retains whether deity sanctification is required when snapshotting rules', async () => {
  const fetchFn: typeof fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as { query: { bool: { filter: { term: { category: string } }[] } } }
    const category = request.query.bool.filter[0].term.category
    const hits = category === 'deity' ? [
      { _id: 'required', _source: { category, name: 'Required', sanctification: ['holy'], markdown: '**Divine Sanctification**  must choose holy' } },
      { _id: 'optional', _source: { category, name: 'Optional', sanctification: ['holy'], markdown: '**Divine Sanctification**  can choose holy' } },
    ] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const hits = await fetchAonHits('pf2e', fetchFn)
  expect(mapAonHit(hits.find((hit) => hit._id === 'required')!, 'pf2e')?.data.sanctification_required).toBe(true)
  expect(mapAonHit(hits.find((hit) => hit._id === 'optional')!, 'pf2e')?.data.sanctification_required).toBe(false)
})

it('greys out domains outside the selected deity in existing feat choices and rejects them', () => {
  let c: Character = { ...base, className: 'Champion', deity: 'Test Deity',
    feats: [{ name: "Deity's Domain", type: 'Class Feat', level: 1 }] }
  const deity: ContentEntry = { ...entries[0], kind: 'deity', name: 'Test Deity', data: { domain_primary: 'Zeal, Might', domain_alternate: 'Fire' } }
  const other: ContentEntry = { ...deity, id: 'other', name: 'Other Deity', data: { domain_primary: 'Fire, Death' } }
  const props = () => ({ c, entries: [deity, other], save: (patch: Partial<Character>) => { c = { ...c, ...patch } }, index: 0 })
  const markup = renderToStaticMarkup(<FeatChoice {...props()} />)
  expect(markup).toContain('<option disabled="">Fire</option>')
  expect(markup).toContain('<option disabled="">Death</option>')
  expect(markup).toContain('<option>Might</option>')
  expect(markup).toContain('<option>Zeal</option>')
  expect(markup.indexOf('>Death</option>')).toBeLessThan(markup.indexOf('>Fire</option>'))
  const select = findSelect(FeatChoice(props()))
  if (!select) throw new Error('Missing domain picker')
  select.onChange({ target: { value: 'Fire' } })
  expect(c.feats[0].choice).toBeUndefined()
  select.onChange({ target: { value: 'Zeal' } })
  expect(c.feats[0].choice).toBe('Zeal')
  c = { ...c, deity: 'Other Deity' }
  expect(renderToStaticMarkup(<FeatChoice {...props()} />)).toContain('<option disabled="" selected="">Zeal</option>')
})

it('selects distinct warden spells per feat and derives grants from current choices', () => {
  let c: Character = { ...base, feats: [
    { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:0' },
    { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:1' },
  ] }
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
  const first = findSelect(FeatChoice({ ...props(), index: 0 }))
  if (!first) throw new Error('Missing first spell selection')
  first.onChange({ target: { value: 'Gravity Weapon' } })
  expect(grantedWardenSpells(c, entries).map((s) => s.name)).toEqual(['Gravity Weapon'])
  const markup = renderToStaticMarkup(<FeatChoice {...props()} index={1} />)
  expect(markup).toContain('Heal Companion')
  expect(markup).not.toContain('Gravity Weapon')
  expect(markup).not.toContain('Animal Feature')
  const second = findSelect(FeatChoice({ ...props(), index: 1 }))
  if (!second) throw new Error('Missing second spell selection')
  second.onChange({ target: { value: 'Heal Companion' } })
  expect(grantedWardenSpells(c, entries).map((s) => s.name)).toEqual(['Gravity Weapon', 'Heal Companion'])
  c = { ...c, feats: c.feats.slice(1) }
  expect(grantedWardenSpells(c, entries).map((s) => s.name)).toEqual(['Heal Companion'])
})

it('hides another Warden feat when all distinct spells are chosen', () => {
  const allSpells = Array.from({ length: 3 }, (_, i) => spell(`Initiate ${i}`, 'Initiate'))
  const initiate: ContentEntry = {
    id: 'initiate', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Initiate Warden', level: 1,
    traits: ['Ranger'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }
  const choices = allSpells.map((s, i) => ({
    name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: `class:1:${i}`, choice: s.name,
  }))
  const c: Character = { ...base, feats: choices }
  expect(canSelectWardenFeat('Initiate Warden', c, [...allSpells, initiate])).toBe(false)
  expect(eligibleFeats([initiate], c, { key: 'class:1:3', category: 'class', level: 1 })).toEqual([])
  const almostFull = { ...c, feats: choices.slice(0, -1) }
  expect(eligibleFeats([initiate, ...allSpells], almostFull, { key: 'class:1:3', category: 'class', level: 1 }))
    .toContainEqual(initiate)
})

it('places Warden spell choices before add and remove slot controls', () => {
  const c: Character = {
    ...base,
    feats: [
      { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'Gravity Weapon' },
      { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:1', choice: 'Heal Companion' },
    ],
    extraSlots: [{ category: 'class', level: 1, count: 1 }],
  }
  const feat: ContentEntry = {
    id: 'initiate', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Initiate Warden', level: 1,
    traits: ['Ranger'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }
  const rows = [...renderToStaticMarkup(<FeatSlots c={c} entries={[feat, ...entries]} save={() => {}} categories={['class']} bare />)
    .matchAll(/<li class="feat-slot-row[^"]*">([\s\S]*?)<\/li>/g)].map((match) => match[1])
  const addRow = rows.find((row) => row.includes('aria-label="Add L01 Class feat slot"'))
  const removeRow = rows.find((row) => row.includes('aria-label="Remove L01 Class extra feat slot 1"'))
  expect(addRow).toBeDefined()
  expect(removeRow).toBeDefined()
  expect(addRow!.indexOf('class="feat-choice"')).toBeLessThan(addRow!.indexOf('aria-label="Add L01 Class feat slot"'))
  expect(removeRow!.indexOf('class="feat-choice"')).toBeLessThan(removeRow!.indexOf('aria-label="Remove L01 Class extra feat slot 1"'))
})

it('shows feat grants once without deleting independently added spells', () => {
  const c: Character = { ...base, feats: [{ name: 'Initiate Warden', type: 'Class Feat', level: 1, choice: 'Gravity Weapon' }],
    spells: [{ name: 'Gravity Weapon', rank: 1, cantrip: false, entryId: 'Gravity Weapon' }] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('<strong>Spells</strong><span>1 spells</span>')
  expect(markup).toContain('Gravity Weapon')
  expect(markup).toContain('<b>Initiate Warden</b>')
  expect(markup).not.toContain('Warden feat')
  expect((markup.match(/aria-haspopup="dialog">Gravity Weapon<\/button>/g) ?? [])).toHaveLength(1)
  expect(grantedWardenSpells({ ...c, feats: [] }, entries)).toEqual([])
  expect(c.spells).toHaveLength(1)
})

it('shows action icons beside selected spells', () => {
  const c: Character = { ...base, spells: [{ name: 'Gravity Weapon', rank: 1, cantrip: false, entryId: 'Gravity Weapon' }] }
  const spellEntries = entries.map((entry) => entry.name === 'Gravity Weapon'
    ? { ...entry, data: { ...entry.data, actions: 'Single Action' } } : entry)
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={spellEntries} save={() => {}} />)
  expect(markup).toContain('aria-label="Single Action"')
})

it('shows persisted Active toggles for granted buffs and timed spells, not instantaneous spells', () => {
  const c: Character = {
    ...base, level: 8, activeSpells: ['Animal Feature'], feats: [
      { name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' },
      { name: 'Initiate Warden', type: 'Class Feat', level: 1, choice: 'Gravity Weapon' },
      { name: 'Initiate Warden', type: 'Class Feat', level: 1, choice: 'Heal Companion' },
    ],
  }
  const spells = entries.map((entry) => entry.name === 'Gravity Weapon' ? { ...entry, data: { ...entry.data, duration: 60 } } : entry)
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={spells} save={() => {}} />)
  expect(markup).toContain('aria-label="Animal Feature: Claws" checked=""')
  expect(markup).toContain('aria-label="Gravity Weapon active"')
  expect(markup).not.toContain('aria-label="Heal Companion active"')
  expect(renderToStaticMarkup(<SpellsSection c={{ ...c, activeSpells: [] }} entries={spells} save={() => {}} />))
    .not.toContain('aria-label="Animal Feature: Claws" checked=""')
})

it('labels Warden spells in spell listings by tier', () => {
  expect(spellWardenLabel('Initiate')).toBe('Initiate Warden')
  expect(spellWardenLabel('Advanced')).toBe('Advanced Warden')
  expect(spellWardenLabel('Master')).toBe('Master Warden')
  expect(spellWardenLabel('Peerless')).toBe('Peerless Warden')
  expect(spellWardenLabel(undefined)).toBeUndefined()
  const c: Character = { ...base, spells: [{ name: 'Gravity Weapon', rank: 1, cantrip: false, entryId: 'Gravity Weapon' }] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('<b>Initiate Warden</b>')
  expect(markup).not.toContain('<b>Rank 1</b>')
})

it('uses Warden tier headings without changing ordinary spell rank groups', () => {
  const spells = [
    spell('Gluttonous Growth', 'Peerless'),
    { ...spell('Ordinary Spell', ''), data: {}, level: 5 },
  ]
  const c: Character = { ...base, spells: spells.map((s) => ({ name: s.name, rank: 5, cantrip: false, entryId: s.id })) }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={spells} save={() => {}} />)
  expect(markup).toContain('<b>Peerless Warden</b>')
  expect(markup).toContain('<b>Rank 5</b>')
  expect(markup).not.toContain('(Peerless Warden)')
})

it('derives caster status, traditions and spell proficiency from class features', () => {
  const classes: ContentEntry[] = [
    { id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 1 },
    { id: 'wizard', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Wizard', level: 1, traits: [], description: '', data: { tradition: 'Arcane' }, effects: [], updatedAt: 1 },
    { id: 'witch', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Witch', level: 1, traits: [], description: '', data: { tradition: 'Arcane, Divine, Occult, Primal' }, effects: [], updatedAt: 1 },
    { id: 'expert', systems: ['pf2e'], kind: 'classFeature', source: 'official', name: 'Expert Spellcaster', level: 7, traits: [], description: '', data: { class: 'Wizard' }, effects: [], updatedAt: 1 },
    { id: 'master', systems: ['pf2e'], kind: 'classFeature', source: 'official', name: 'Master Spellcaster', level: 15, traits: [], description: '', data: { class: 'Wizard' }, effects: [], updatedAt: 1 },
    { id: 'ranger-expert', systems: ['pf2e'], kind: 'classFeature', source: 'official', name: 'Ranger Expertise', level: 9, traits: [], description: 'Your proficiency rank for your ranger class DC increases to expert.', data: { class: 'Ranger' }, effects: [], updatedAt: 1 },
  ]
  expect(classSpellcasting({ ...base, className: 'Ranger' }, classes)).toEqual({ traditions: [], rank: 1, ability: 'wis' })
  expect(classSpellcasting({ ...base, className: 'Ranger', level: 9 }, classes)).toEqual({ traditions: [], rank: 2, ability: 'wis' })
  expect(classSpellcasting({ ...base, className: 'Wizard', level: 1 }, classes)).toEqual({ traditions: ['Arcane'], rank: 1, ability: 'int' })
  expect(classSpellcasting({ ...base, className: 'Wizard', level: 8 }, classes)).toEqual({ traditions: ['Arcane'], rank: 2, ability: 'int' })
  expect(classSpellcasting({ ...base, className: 'Wizard', level: 15 }, classes)).toEqual({ traditions: ['Arcane'], rank: 3, ability: 'int' })
  expect(classSpellcasting({ ...base, className: 'Witch' }, classes)?.traditions).toEqual(['Arcane', 'Divine', 'Occult', 'Primal'])
})

it('shows spell DC proficiency but no spell slots for focus-only casters', () => {
  const ranger: Character = {
    ...base,
    spellcasting: { ability: 'wis', tradition: '', rank: 1, slots: { 1: 2 } },
    feats: [{ name: 'Gravity Weapon', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
  }
  const classes: ContentEntry[] = [
    { id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 1 },
    { id: 'gravity-feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Gravity Weapon', level: 1, traits: [], description: '', data: { grants_focus_spells: 'Gravity Weapon' }, effects: [], updatedAt: 1 },
    { ...spell('Gravity Weapon', 'Initiate'), description: 'Focus spell description.' },
  ]
  const markup = renderToStaticMarkup(<SpellsSection c={ranger} entries={classes} save={() => {}} />)
  expect(markup).not.toContain('Casting ability: Wisdom')
  expect(markup).toContain('<small>Wisdom</small>')
  expect(markup).toContain('DC 13 <small>(Attack +3)</small>')
  expect(markup).toContain('Spellcasting proficiency: Trained')
  expect(markup).toContain('Gravity Weapon')
  expect(markup).toContain('aria-haspopup="dialog">Gravity Weapon</button>')
  expect(markup).toContain('<p>Focus spell description.</p>')
  expect(markup).not.toContain('Filter spells by tradition')
  expect(markup).not.toContain('Slots per rank')
})

it('retains spell slots for slotted casters such as Druids', () => {
  const c: Character = {
    ...base, className: 'Druid',
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: { 1: 2 } },
  }
  const druid: ContentEntry = {
    id: 'druid', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Druid', level: 1,
    traits: [], description: '', data: { tradition: 'Primal' }, effects: [], updatedAt: 1,
  }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[druid]} save={() => {}} />)
  expect(markup).toContain('Slots per rank')
  expect(markup).toContain('value="2"')
})

it('opens known spells and spell-picker results in description dialogs', () => {
  const c: Character = {
    ...base, className: 'Druid',
    spells: [{ name: 'Heal', rank: 1, cantrip: false, entryId: 'heal' }],
  }
  const heal: ContentEntry = {
    ...spell('Heal', ''), id: 'heal', traits: [], description: 'Healing spell description.',
    data: { tradition: 'Primal', url: 'https://2e.aonprd.com/' },
  }
  const druid: ContentEntry = {
    ...heal, id: 'druid', kind: 'class', name: 'Druid', description: '', data: { tradition: 'Primal' },
  }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[druid, heal]} save={() => {}} />)
  expect(markup.match(/aria-haspopup="dialog">Heal<\/button>/g)).toHaveLength(2)
  expect(markup.match(/<p>Healing spell description.<\/p>/g)).toHaveLength(2)
  expect(markup).toContain('aria-label="Remove Heal"')
  expect(markup).toContain('href="https://2e.aonprd.com/"')
})

it('keeps companion and granted general-feat choices out of feat rows', () => {
  for (const name of ['Incredible Companion', 'Specialized Companion', 'Incredible Mount', 'Specialized Mount', 'General Training', 'Advanced General Training']) {
    const c = { ...base, feats: [{ name, type: 'Class Feat', level: 1 }] }
    const entry: ContentEntry = {
      id: name, systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
      traits: [], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
    }
    expect(renderToStaticMarkup(<FeatChoice c={c} entries={[entry]} save={() => {}} index={0} />)).toBe('')
  }
})

it('hides manual casting configuration for noncasters and collapses the spell section', () => {
  const noncaster = { ...base, className: 'Fighter', spellcasting: { ability: 'wis' as const, tradition: '', rank: 1, slots: {} } }
  const classes: ContentEntry[] = [{
    id: 'fighter', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Fighter', level: 1,
    traits: [], description: '', data: {}, effects: [], updatedAt: 1,
  }]
  const markup = renderToStaticMarkup(<SpellsSection c={noncaster} entries={classes} save={() => {}} />)
  expect(markup).toContain('<details class="character-section">')
  expect(markup).toContain('<strong>Spells</strong><span>0 spells</span>')
  expect(markup).not.toContain('Casting ability')
  expect(markup).not.toContain('Slots per rank')
  expect(markup).not.toContain('Spellcasting Trained')
})

it('alphabetizes repeated feat selections by choice, leaving unchosen copies last', () => {
  const selections = [
    { name: 'Initiate Warden', choice: 'Heal Companion' },
    { name: 'Initiate Warden' },
    { name: 'Initiate Warden', choice: 'Gravity Weapon' },
  ]
  expect(selections.sort(compareFeatSelections).map((f) => f.choice)).toEqual(['Gravity Weapon', 'Heal Companion', undefined])
})

it('allows a text choice for other repeatable feats without granting an unrelated spell', () => {
  let c: Character = { ...base, feats: [{ name: 'Weapon Specialization Tweak', type: 'Class Feat', level: 2 }] }
  const feat: ContentEntry = {
    id: 'order', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Weapon Specialization Tweak', level: 2,
    traits: ['Druid'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }
  const tree = FeatChoice({ c, entries: [feat], index: 0, save: (patch) => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree)).toContain('Weapon Specialization Tweak choice')
  if (!isValidElement<{ children: ReactNode }>(tree)) throw new Error('Missing choice field')
  const field = Children.toArray(tree.props.children).find((child) => isValidElement(child) && child.type === 'input')
  if (!isValidElement<{ onBlur: (event: { target: { value: string } }) => void }>(field)) throw new Error('Missing choice input')
  field.props.onBlur({ target: { value: 'Leaf' } })
  expect(c.feats[0].choice).toBe('Leaf')
  expect(grantedWardenSpells(c, [feat])).toEqual([])
})

it('offers Snare Hopping with the Initiate Warden spells', () => {
  const snare: ContentEntry = { ...spell('Snare Hopping', 'Initiate'), data: {} }
  const options = wardenSpellOptions({ name: 'Initiate Warden', type: 'Class Feat', level: 1 }, [...entries, snare])
  expect(options.map((o) => o.name)).toEqual(['Gravity Weapon', 'Heal Companion', 'Snare Hopping'])
  expect(wardenSpellOptions({ name: 'Advanced Warden', type: 'Class Feat', level: 4 }, [...entries, snare]).map((o) => o.name)).toEqual(['Animal Feature'])
})
