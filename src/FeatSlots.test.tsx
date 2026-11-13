import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FeatSlots } from './FeatSlots'
import { mapAonHit } from './aon'
import { plannedSlots, ranksAt, unslottedFeats } from './builder'
import { achievementOptions } from './featAccess'
import type { Character, ContentEntry } from './types'

beforeEach(() => vi.stubGlobal('window', { confirm: vi.fn(() => true) }))
afterEach(() => vi.unstubAllGlobals())

it('keeps Snare Crafting and its grant source inside one description button', () => {
  const c: Character = { ...emptyRanger(), level: 2,
    feats: [{ name: 'Snarecrafter Dedication', type: 'Archetype Feat', level: 2, slot: 'class:2:0' }] }
  const entry: ContentEntry = {
    id: 'snare-crafting', name: 'Snare Crafting', kind: 'feat', systems: ['pf2e'], source: 'official',
    level: 1, traits: ['General', 'Skill'], description: 'Craft snares.', data: {}, effects: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[entry]} save={() => {}} categories={['skill']} />)
  expect(markup).toContain('class="feat-name" aria-haspopup="dialog">Snare Crafting <small>(Snarecrafter Dedication)</small></button>')
  expect(markup).not.toContain('</button><small>(Snarecrafter Dedication)')
})

it('omits section search bars and ignores their stale queries while preserving picker searches', () => {
  const c: Character = { ...emptyRanger(), level: 2 }
  const feats = ['Alpha', 'Beta'].flatMap((name): ContentEntry[] => [{
    id: name, name, level: 1, traits: ['Ranger'], systems: ['pf2e'],
    kind: 'feat', source: 'official', description: '', data: {}, effects: [], updatedAt: 0,
  }, {
    id: `${name}-dedication`, name: `${name} Dedication`, level: 2, traits: ['Archetype', 'Dedication'],
    systems: ['pf2e'], kind: 'feat', source: 'official',
    description: '', data: { archetype: name }, effects: [], updatedAt: 0,
  }])
  const save = vi.fn()
  const classTree = (search: Record<string, string>) => FeatSlots({ c, entries: feats, categories: ['class'],
    title: 'Class Feats', save, search, onSearch: () => {} })
  const isolated = renderToStaticMarkup(classTree({ 'ancestry:query': 'Alpha', 'class:1:0:open': '1' }))
  expect(isolated).toContain('aria-label="L01 Class: Alpha"')
  expect(isolated).toContain('aria-label="L01 Class: Beta"')
  const unfiltered = renderToStaticMarkup(classTree({ 'class:query': '  BETA ', '*': 'unrelated', 'class:1:0:open': '1' }))
  expect(unfiltered.match(/type="search"/g)).toHaveLength(1)
  expect(unfiltered).toContain('aria-label="Search L01 Class feats"')
  expect(unfiltered).toContain('aria-label="L01 Class: Beta"')
  expect(unfiltered).toContain('aria-label="L01 Class: Alpha"')
  expect(renderToStaticMarkup(classTree({ 'class:1:0:query': 'Alpha' }))).not.toContain('type="search"')
  const popup = renderToStaticMarkup(FeatSlots({ c, entries: feats, categories: ['archetype'], save, onSearch: () => {},
    search: { 'archetype:2:0:open': '1', 'archetype:2:0:type': 'dedication', 'archetype:2:0:query': 'beta' } }))
  expect(popup).toContain('aria-label="Search L02 Dedication feats"')
  expect(popup).toContain('L02 Dedication: Beta Dedication')
  expect(popup).not.toContain('L02 Dedication: Alpha Dedication')
  expect(save).not.toHaveBeenCalled()
})

it('keeps Favored Terrain editable in class feats and displays the same restored selection as Offense', () => {
  let c: Character = { ...emptyRanger(), level: 11, favoredTerrain: 'Forest', feats: [
    { name: 'Favored Terrain', type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Plains' },
    { name: 'Terrain Master', type: 'Class Feat', level: 8, slot: 'class:8:0' },
  ] }
  const terrain: ContentEntry = {
    id: 'terrain', name: 'Favored Terrain', kind: 'feat', systems: ['pf2e'], level: 2, traits: ['Ranger'],
    source: 'official', description: '', data: {}, effects: [], updatedAt: 1,
  }
  const tree = () => FeatSlots({ c, entries: [terrain], categories: ['class'], save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain('>Favored Terrain (Forest)</button>')
  expect(renderToStaticMarkup(tree())).not.toContain('aria-label="Favored Terrain terrain"')
})

it('pins prerequisite suggestions before pagination, searches unlocks, and saves only the canonical feat', () => {
  const titan: ContentEntry = {
    id: 'titan', name: 'Titan Wrestler', kind: 'feat', systems: ['pf2e'], level: 1, traits: ['General', 'Skill'],
    source: 'official', description: 'Grapple larger creatures.', data: { prerequisite: 'Trained in Athletics' }, effects: [], updatedAt: 1,
  }
  const target: ContentEntry = { ...titan, id: 'harder', name: 'The Harder They Fall (Ranger)', level: 8,
    traits: ['Ranger'], data: { prerequisite: 'Titan Wrestler' } }
  const fillers = Array.from({ length: 101 }, (_, index): ContentEntry =>
    ({ ...titan, id: `filler-${index}`, name: `A Filler ${index}`, data: {} }))
  const entries = [titan, { ...titan, id: 'titan-sf', systems: ['sf2e'] as ContentEntry['systems'] }, target, ...fillers]
  let c: Character = { ...emptyRanger(), systems: ['pf2e', 'sf2e'], level: 8, skillPicks: ['Athletics'] }
  const search: Record<string, string> = { 'general:3:0:open': '1' }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries, categories: ['general'], save, search, onSearch: (key, text) => { search[key] = text } })
  const label = 'L03 General: Titan Wrestler (Unlocks The Harder They Fall)'
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Suggested prerequisites')
  expect(markup.match(/aria-label="L03 General: Titan Wrestler/g)).toHaveLength(1)
  expect(markup.indexOf(label)).toBeLessThan(markup.indexOf('L03 General: A Filler'))
  expect(markup).toContain('Show more')
  expect(markup).toContain('aria-label="Details: Titan Wrestler"')
  expect(markup).toContain('Grapple larger creatures.')
  search['general:3:0:query'] = 'harder they fall'
  expect(renderToStaticMarkup(tree())).toContain(label)
  expect(renderToStaticMarkup(tree())).not.toContain('L03 General: A Filler')
  c = { ...c, skillPicks: [] }
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${label} * Missing Trained in Athletics" disabled=""`)
  findButton(tree(), `${label} * Missing Trained in Athletics`)!()
  expect(save).not.toHaveBeenCalled()
  c = { ...c, skillPicks: ['Athletics'] }
  search['general:3:0:open'] = '1'
  findButton(tree(), label)!()
  expect(c.feats).toContainEqual({ name: 'Titan Wrestler', type: 'General Feat', level: 1, slot: 'general:3:0' })
  expect(c.entryIds).toContain('titan')
  expect(search['general:3:0:open']).toBe('')
})

it('unlocks Farabellus Flip for either saved Society membership wording but retains Acrobatics and armor requirements', () => {
  const flip: ContentEntry = {
    id: 'flip', name: 'Farabellus Flip', kind: 'feat', systems: ['pf2e'], level: 4,
    traits: ['Ranger', 'Barbarian', 'Fighter', 'Uncommon'], source: 'official', description: '',
    data: { access: 'Member of the Pathfinder Society.', prerequisite: 'Trained in Acrobatics; trained in medium armor' },
    effects: [], updatedAt: 1,
  }
  const ranger: ContentEntry = { ...flip, id: 'ranger', kind: 'class', name: 'Ranger', traits: [], level: 1,
    data: { defense_proficiency: 'Trained in light armor, Trained in medium armor, Trained in unarmored defense' } }
  const c: Character = { ...emptyRanger(), level: 4, skillPicks: ['Acrobatics'] }
  const tree = (character: Character) => <FeatSlots c={character} entries={[flip, ranger]} categories={['class']} save={() => {}} />
  expect(renderToStaticMarkup(tree(c))).toContain('value="Farabellus Flip" disabled=""')
  expect(renderToStaticMarkup(tree(c))).not.toContain('GM approval needed')
  for (const membership of ['member of the pathfinder society', 'A character who is a member of the Pathfinder Society has access to this option.']) {
    const saved: Character = JSON.parse(JSON.stringify({ ...c, achievements: [membership] }))
    const markup = renderToStaticMarkup(tree(saved))
    expect(markup).toContain('Farabellus Flip (Uncommon) * Access: Member of the Pathfinder Society. (met)')
    expect(markup).not.toContain('value="Farabellus Flip" disabled=""')
    expect(renderToStaticMarkup(tree({ ...saved, skillPicks: [] }))).toContain('Missing Trained in Acrobatics')
    expect(renderToStaticMarkup(<FeatSlots c={saved} entries={[flip]} categories={['class']} save={() => {}} />))
      .toContain('Missing trained in medium armor')
  }
})

it('unlocks Wild Hunter through a saved achievement without bypassing level or skill prerequisites', () => {
  const access = 'You\u2019ve trained with or defeated a member of the wild hunt.'
  const wild: ContentEntry = {
    id: 'wild', name: 'Wild Hunter Dedication', level: 8, traits: ['Archetype', 'Dedication', 'Uncommon'],
    systems: ['pf2e'], kind: 'feat', source: 'official', description: '', effects: [], updatedAt: 1,
    data: { archetype: 'Wild Hunter', access,
      prerequisite: 'expert in Perception; Expert in Nature, Expert in Stealth, or Expert in Survival' },
  }
  const key = achievementOptions([wild])[0].key
  const ranger: ContentEntry = { ...wild, id: 'ranger', kind: 'class', name: 'Ranger', level: 1, traits: [],
    data: { perception_proficiency: 'Expert' } }
  let c: Character = { ...emptyRanger(), level: 8, rankOverrides: { Nature: 2 } }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [wild, ranger], categories: ['archetype'], save,
    search: { 'archetype:8:0:open': '1', 'archetype:8:0:type': 'dedication' } })
  const prefix = 'L08 Dedication: Wild Hunter Dedication (Uncommon)'
  const blockedLabel = `${prefix} * Access: ${access}`
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${blockedLabel}" disabled=""`)
  findButton(tree(), blockedLabel)!()
  expect(save).not.toHaveBeenCalled()
  c = JSON.parse(JSON.stringify({ ...c, achievements: [key] }))
  const allowedLabel = `${prefix} * Access: ${access} (met)`
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${allowedLabel}">`)
  findButton(tree(), allowedLabel)!()
  expect(c.feats).toContainEqual({ name: wild.name, type: 'Dedication Feat', level: 8, slot: 'archetype:8:0' })
  const selected = renderToStaticMarkup(tree())
  expect(selected).toContain('Satisfied by checked achievement.')
  expect(selected).not.toContain('Granted by selected ethnicity.')
  c = { ...c, achievements: [] }
  expect(renderToStaticMarkup(tree())).toContain('aria-label="Access information"')
  c = { ...c, feats: [], achievements: [key], rankOverrides: {} }
  expect(renderToStaticMarkup(tree())).toMatch(/aria-label="L08 Dedication: Wild Hunter Dedication[^"]*Missing[^"]*" disabled=""/)
  c = { ...c, level: 6, rankOverrides: { Nature: 2 } }
  expect(renderToStaticMarkup(tree())).not.toContain(prefix)
})

it.each([
  { name: 'Brastlewark Snare Engineering', level: 4, prerequisite: 'Snarecrafter Dedication; Snare Crafting' },
  { name: 'Barricade Snare', level: 6, prerequisite: 'Snarecrafter Dedication' },
])('allows uncommon $name without synthetic access approval but still enforces prerequisites', ({ name, level, prerequisite }) => {
  const dedication: ContentEntry = {
    id: 'snarecrafter', systems: ['pf2e'], kind: 'feat', name: 'Snarecrafter Dedication', level: 2,
    traits: ['Archetype', 'Dedication'], source: 'official', description: '',
    data: { archetype: 'Snarecrafter' }, effects: [], updatedAt: 1,
  }
  const snareFeat: ContentEntry = {
    ...dedication, id: 'snare-feat', name, level, traits: ['Archetype', 'Uncommon'],
    data: { archetype: 'Snarecrafter', prerequisite, rarity: 'uncommon' },
  }
  const crafting: ContentEntry = { ...dedication, id: 'crafting', name: 'Snare Crafting', level: 1, traits: ['General', 'Skill'], data: {} }
  let c: Character = { ...emptyRanger(), level, feats: [
    { name: dedication.name, type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' },
  ] }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [dedication, snareFeat, crafting], categories: ['archetype'],
    search: { [`archetype:${level}:0:open`]: '1' }, save })
  const label = `L${String(level).padStart(2, '0')} Dedication: ${name} (Uncommon)`
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain(`<button type="button" aria-label="${label}">${name} (Uncommon)</button>`)
  expect(markup).not.toContain('no automatic access condition')
  findButton(tree(), label)!()
  expect(c.feats.some(feat => feat.name === name)).toBe(true)
  expect(renderToStaticMarkup(tree())).toContain(`(Level ${level}; Uncommon)`)
  expect(renderToStaticMarkup(tree())).not.toContain('GM approval needed')
  c = { ...c, feats: [] }
  expect(renderToStaticMarkup(tree())).not.toContain(label)
  expect(c.feats).toEqual([])
  expect(save).toHaveBeenCalledTimes(1)
})

it('lists Clever Improviser granted Untrained Improvisation under general feats, not skill feats', () => {
  const c: Character = { ...emptyRanger(), level: 5, feats: [
    { name: 'Clever Improviser', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' },
  ] }
  const entry: ContentEntry = {
    id: 'improvisation', systems: ['pf2e'], kind: 'feat', name: 'Untrained Improvisation', level: 3, traits: ['General'],
    source: 'official', description: '', data: {}, effects: [], updatedAt: 1,
  }
  const props = { c, entries: [entry], save: () => {} }
  const markup = renderToStaticMarkup(<FeatSlots {...props} categories={['general']} />)
  expect(markup).toContain('>Untrained Improvisation <small>(Clever Improviser)</small></button>')
  expect(markup).not.toContain('Granted General Feat')
  expect(markup.indexOf('Level 05')).toBeLessThan(markup.indexOf('>Untrained Improvisation <small>'))
  expect(renderToStaticMarkup(<FeatSlots {...props} categories={['skill']} />)).not.toContain('>Untrained Improvisation <small>')
})

it('interleaves free feats with earned slots at acquisition levels and keeps skill grants in their own section', () => {
  const c: Character = { ...emptyRanger(), level: 9, feats: [
    { name: 'Clever Improviser', type: 'Ancestry Feat', level: 5, slot: 'ancestry:9:0' },
    { name: 'Greenwatch Initiate', type: 'Class Feat', level: 4, slot: 'class:8:0' },
  ] }
  const data: [string, number, string[]][] = [
    ['Untrained Improvisation', 3, ['General']],
    ['Experienced Tracker', 1, ['General', 'Skill']],
    ['Survey Wildlife', 1, ['General', 'Skill']],
  ]
  const entries: ContentEntry[] = data.map(([name, level, traits]) => ({
    id: name, name, level, traits,
    systems: ['pf2e'], kind: 'feat', source: 'official', description: '', data: {}, effects: [], updatedAt: 1,
  }))
  const render = (character: Character, categories: ('general' | 'skill')[]) =>
    renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={() => {}} categories={categories} />)
  const general = render(c, ['general'])
  expect(general).toContain('>Untrained Improvisation <small>(Clever Improviser)</small></button>')
  expect(general).not.toContain('Granted General Feat')
  expect(general).not.toContain('>Experienced Tracker <small>')
  expect(general.indexOf('Clear L07 General')).toBeLessThan(general.indexOf('>Untrained Improvisation <small>'))
  const skill = render(c, ['skill'])
  expect(skill).not.toContain('>Untrained Improvisation <small>')
  expect(skill).not.toContain('Granted Skill Feat')
  expect(skill).toContain('>Experienced Tracker <small>(Greenwatch Initiate)</small></button>')
  expect(skill.indexOf('Clear L06 Skill')).toBeLessThan(skill.indexOf('>Experienced Tracker <small>'))
  expect(skill.indexOf('>Experienced Tracker <small>')).toBeLessThan(skill.indexOf('Clear L08 Skill'))
  expect(skill.match(/>Level 08<\/li>/g)).toHaveLength(1)
  expect(render({ ...c, level: 7 }, ['skill', 'general'])).not.toContain('automatic-feat-row')
  expect(render({ ...c, feats: [] }, ['skill', 'general'])).not.toContain('automatic-feat-row')
})

it('blocks Animal Strength selection until Animal Feature is actually learned as a warden spell', () => {
  let c: Character = { ...emptyRanger(), level: 6, feats: [
    { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'Gravity Weapon' },
  ] }
  const feat: ContentEntry = {
    id: 'strength', systems: ['pf2e'], kind: 'feat', name: 'Animal Strength', level: 6, traits: ['Ranger'],
    source: 'official', description: '', data: { prerequisite: '_animal feature_ warden spell' }, effects: [], updatedAt: 1,
  }
  const data = [feat,
    { ...feat, id: 'gravity', kind: 'spell' as const, name: 'Gravity Weapon', level: 1, data: { warden_spell_tier: 'Initiate' } },
    { ...feat, id: 'animal', kind: 'spell' as const, name: 'Animal Feature', level: 2, data: { warden_spell_tier: 'Advanced' } }]
  const tree = () => FeatSlots({ c, entries: data, save: patch => { c = { ...c, ...patch } }, categories: ['class'] })
  findSelect(tree(), 'L06 Class feat')!({ target: { value: feat.name } })
  expect(c.feats.some(selected => selected.name === feat.name)).toBe(false)
  c = { ...c, feats: [...c.feats, { name: 'Advanced Warden', type: 'Class Feat', level: 4, slot: 'class:4:0', choice: 'Animal Feature' }] }
  findSelect(tree(), 'L06 Class feat')!({ target: { value: feat.name } })
  expect(c.feats.find(selected => selected.name === feat.name)).toMatchObject({ slot: 'class:6:0' })
})

it('offers explicit favored-terrain variants and persists the chosen terrain', () => {
  let c: Character = { ...emptyRanger(), level: 2 }
  const feat: ContentEntry = {
    id: 'favored', systems: ['pf2e'], kind: 'feat', name: 'Favored Terrain', level: 2, traits: ['Ranger'],
    source: 'official', description: '', data: {}, effects: [], updatedAt: 1,
  }
  const tree = () => FeatSlots({ c, entries: [feat], save: patch => { c = { ...c, ...patch } }, categories: ['class'] })
  expect(renderToStaticMarkup(tree())).toContain('Favored Terrain (Plains)')
  findSelect(tree(), 'L02 Class feat')!({ target: { value: JSON.stringify([feat.name, 'Ocean']) } })
  expect(c.feats).toEqual([])
  findSelect(tree(), 'L02 Class feat')!({ target: { value: JSON.stringify([feat.name, 'Plains']) } })
  expect(JSON.parse(JSON.stringify(c)).feats).toEqual([
    { name: feat.name, type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Plains' },
  ])
})

it('opens Multitalented directly on multiclass dedications and removes its granted choice with the ancestry feat', () => {
  let c: Character = {
    id: 'multi', systems: ['pf2e'], name: 'Test', level: 9, ancestry: 'Human', className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
    feats: [
      { name: 'Multitalented', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' },
      { name: 'Cavalier Dedication', type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const wizard: ContentEntry = {
    id: 'wizard', systems: ['pf2e'], kind: 'feat', name: 'Wizard Dedication', level: 2,
    traits: ['Archetype', 'Dedication', 'Multiclass'], source: 'official', description: '',
    data: { archetype: 'Wizard', prerequisite: 'Intelligence +2' }, effects: [], updatedAt: 1,
  }
  const entries = [wizard,
    { ...wizard, id: 'medic', name: 'Medic Dedication', traits: ['Archetype', 'Dedication'], data: { archetype: 'Medic' } },
    { ...wizard, id: 'cavalier', name: 'Cavalier Dedication', traits: ['Archetype', 'Dedication'], data: { archetype: 'Cavalier' } }]
  const slot = plannedSlots(c).find(slot => slot.grantedBy === 'Multitalented')!
  const search = { [`${slot.key}:open`]: '1' }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => FeatSlots({ c, entries, save, categories: ['archetype'], search, onSearch: () => {} })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('aria-label="L09 Dedication: Wizard Dedication"')
  expect(markup).not.toContain('aria-label="L09 Dedication: Medic Dedication"')
  expect(markup).not.toContain('role="tablist"')
  findButton(tree(), 'L09 Dedication: Wizard Dedication')!()
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats.find(feat => feat.name === wizard.name)).toMatchObject({ level: 2, slot: slot.key })
  const ancestry = FeatSlots({ c, entries, save, categories: ['ancestry'] })
  findButton(ancestry, 'Clear L09 Ancestry feat selection')!()
  expect(c.feats.map(feat => feat.name)).toEqual(['Cavalier Dedication'])
  expect(c.entryIds).not.toContain(wizard.id)
})

it('offers separate Scrapper skill variants, saves one shared feat, and restores its calculated proficiencies', () => {
  let c: Character = {
    id: 'scrapper', systems: ['sf2e'], name: 'Test', level: 5, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feat: ContentEntry = {
    id: 'scrapper', systems: ['sf2e'], kind: 'feat', name: 'Technomagical Scrapper', level: 5, traits: ['Human'],
    source: 'official', description: 'Crafting and magical skill training.', data: { repeatable: false }, effects: [], updatedAt: 1,
  }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [feat], categories: ['ancestry'], save })
  const markup = renderToStaticMarkup(tree())
  for (const skill of ['Arcana', 'Nature', 'Occultism', 'Religion']) {
    expect(markup).toContain(`Technomagical Scrapper (${skill} to Trained)</option>`)
  }
  expect(markup).not.toContain('value="Technomagical Scrapper"')
  findSelect(tree(), 'L05 Ancestry feat')!({ target: { value: JSON.stringify([feat.name, 'Arcana to Expert']) } })
  expect(save).not.toHaveBeenCalled()
  findSelect(tree(), 'L05 Ancestry feat')!({ target: { value: JSON.stringify([feat.name, 'Arcana to Trained']) } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats).toEqual([{ name: feat.name, type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: 'Arcana to Trained' }])
  expect(c.entryIds).toEqual([feat.id])
  expect(ranksAt(c, [feat])).toMatchObject({ Crafting: 1, Arcana: 1 })
  expect(renderToStaticMarkup(tree())).toContain('>Technomagical Scrapper (Arcana to Trained)</button>')
  c = { ...c, extraSlots: [{ category: 'ancestry', level: 5, count: 1 }] }
  expect(renderToStaticMarkup(tree())).not.toContain('Technomagical Scrapper (Nature to Trained)</option>')
  findButton(tree(), 'Remove L05 Ancestry feat slot 0')!()
  expect(ranksAt(c, [feat]).Crafting).toBeUndefined()
  expect(ranksAt(c, [feat]).Arcana).toBeUndefined()
})

it('gates access separately, ignores stale next-feat approval, preserves saved approvals and clears them on removal', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Human', className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const witch: ContentEntry = {
    id: 'witch', systems: ['pf2e'], kind: 'feat', name: 'Witch Warden', level: 1, traits: ['Human', 'Uncommon'],
    source: 'official', description: 'Ward against curses.', data: { access: 'Kellid ethnicity' }, effects: [], updatedAt: 1,
  }
  const other: ContentEntry = { ...witch, id: 'other', name: 'Other Restricted Feat' }
  const prerequisite: ContentEntry = { ...witch, id: 'strong', name: 'Strong Ward', data: { access: 'Kellid ethnicity', prerequisite: 'Strength +4' } }
  const gloomseer: ContentEntry = { ...witch, id: 'gloomseer', name: 'Gloomseer', traits: ['Human'], data: { prerequisite: 'Nidalese ethnicity' } }
  const dragonSpit: ContentEntry = { ...gloomseer, id: 'dragon-spit', name: 'Dragon Spit', data: { prerequisite: 'Tian-Dan ethnicity' } }
  const search: Record<string, string> = { 'ancestry:1:0:open': '1' }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [witch, other, prerequisite, gloomseer, dragonSpit], categories: ['ancestry'], title: 'Ancestry Feats',
    save, search })
  expect(renderToStaticMarkup(tree())).toContain('<option value="Witch Warden" disabled="">Witch Warden (Uncommon) * Access: Kellid ethnicity')
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: witch.name } })
  expect(save).not.toHaveBeenCalled()
  search['access:ancestry'] = 'approved'
  expect(renderToStaticMarkup(tree())).not.toContain('GM access approval')
  expect(renderToStaticMarkup(tree())).toContain('<option value="Gloomseer" disabled="">Gloomseer * Missing Nidalese ethnicity</option>')
  expect(renderToStaticMarkup(tree())).toContain('<option value="Dragon Spit" disabled="">Dragon Spit * Missing Tian-Dan ethnicity</option>')
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: gloomseer.name } })
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: dragonSpit.name } })
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: prerequisite.name } })
  expect(save).not.toHaveBeenCalled()
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: witch.name } })
  expect(save).not.toHaveBeenCalled()
  c = { ...c, featAccessOverrides: [witch.id] }
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: witch.name } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats[0].name).toBe(witch.name)
  expect(c.featAccessOverrides).toEqual([witch.id])
  const approvedMarkup = renderToStaticMarkup(tree())
  expect(approvedMarkup).toContain('GM approved access.')
  expect(approvedMarkup).not.toContain('class="feat-access-controls"')
  expect(approvedMarkup).toContain('class="feat-name" aria-haspopup="dialog">Witch Warden</button>')
  c = { ...c, ethnicity: 'Ulfen' }
  expect(renderToStaticMarkup(tree())).toContain('Witch Warden')
  findButton(tree(), 'Clear L01 Ancestry feat selection')!()
  expect(c.featAccessOverrides).toEqual([])
  expect(c.feats).toEqual([])
  c = { ...c, ethnicity: 'Kellid' }
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: witch.name } })
  expect(c.feats[0].name).toBe(witch.name)
  expect(c.featAccessOverrides).toEqual([])
  const metMarkup = renderToStaticMarkup(tree())
  expect(metMarkup).not.toContain('class="feat-access-controls"')
  expect(metMarkup).toContain('class="feat-name" aria-haspopup="dialog">Witch Warden</button>')
  expect(metMarkup).toContain('Access: Kellid ethnicity. Granted by selected ethnicity.')
  c = { ...c, ethnicity: 'Ulfen' }
  const missingMarkup = renderToStaticMarkup(tree())
  expect(missingMarkup).toContain('class="feat-access-controls"')
  expect(missingMarkup).toContain('aria-label="Access information"')
  expect(missingMarkup).toContain('Access: Kellid ethnicity</small>')
  expect(missingMarkup).not.toContain('GM approval needed')
  c = { ...c, ethnicity: 'Kellid', feats: [{ ...c.feats[0], name: prerequisite.name }] }
  expect(renderToStaticMarkup(tree())).toContain('aria-label="Prerequisites unmet"')
  c = { ...c, feats: [], ethnicity: 'Nidalese' }
  search['ancestry:1:0:open'] = '1'
  expect(renderToStaticMarkup(tree())).toContain('<option value="Gloomseer">Gloomseer</option>')
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: gloomseer.name } })
  expect(c.feats[0].name).toBe(gloomseer.name)
  c = { ...c, feats: [], ethnicity: 'Tian-Dan' }
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: dragonSpit.name } })
  expect(c.feats[0].name).toBe(dragonSpit.name)
})

it('shows automatic intimidation feats as read-only skill grants without duplicating saved selections', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 15, className: 'Barbarian',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Raging Intimidation', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
    skillPicks: ['Intimidation'], rankOverrides: { Intimidation: 4 },
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = ['Intimidating Glare', 'Scare to Death'].map((name) => ({
    id: name, systems: ['pf2e'], kind: 'feat', name, level: name === 'Scare to Death' ? 15 : 1,
    source: 'official', traits: ['General', 'Skill'], description: `${name} rules.`, data: {}, effects: [], updatedAt: 1,
  }))
  const save = vi.fn()
  const render = (character: Character, categories: ('skill' | 'class')[] = ['skill']) =>
    renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={save} categories={categories} />)
  const markup = render(c)
  expect(markup.match(/class="feat-slot-row automatic-feat-row"/g)).toHaveLength(2)
  expect(markup).toContain('>Intimidating Glare <small>(Raging Intimidation)</small></button>')
  expect(markup).toContain('>Scare to Death <small>(Raging Intimidation)</small></button>')
  expect(markup).toContain('(Raging Intimidation)')
  expect(markup).not.toContain('Remove Intimidating Glare')
  expect(render(c, ['class'])).not.toContain('automatic-feat-row')
  expect(render({ ...c, feats: [] })).not.toContain('automatic-feat-row')
  const manual = { ...c, feats: [...c.feats, { name: 'Intimidating Glare', type: 'Skill Feat', level: 1, slot: 'skill:2:0' }] }
  expect(render(manual).match(/class="feat-slot-row automatic-feat-row"/g)).toHaveLength(1)
  expect(manual.feats).toHaveLength(2)
  expect(save).not.toHaveBeenCalled()
})

function findButton(node: ReactNode, label: string): (() => void) | undefined {
  let result: (() => void) | undefined
  Children.forEach(node, (child) => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'button' && child.props['aria-label'] === label) result = child.props.onClick as () => void
    else result = findButton(child.props.children as ReactNode, label)
  })
  return result
}

function findSelect(node: ReactNode, label: string): ((event: { target: { value: string } }) => void) | undefined {
  let result: ((event: { target: { value: string } }) => void) | undefined
  Children.forEach(node, (child) => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'select' && child.props['aria-label'] === label) result = child.props.onChange as (event: { target: { value: string } }) => void
    else result = findSelect(child.props.children as ReactNode, label)
  })
  return result
}

it('alphabetizes selected feat rows within each level without moving their slot controls', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 2, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Zeal', type: 'Class Feat', level: 1, slot: 'class:1:0' },
      { name: 'Alpha', type: 'Class Feat', level: 1, slot: 'class:1:1' },
      { name: 'Aardvark', type: 'Class Feat', level: 2, slot: 'class:2:0' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], updatedAt: 0,
    extraSlots: [{ category: 'class', level: 1, count: 2 }],
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[]} save={() => {}} categories={['class']} />)
  expect(markup.indexOf('>Alpha</button>')).toBeLessThan(markup.indexOf('>Zeal</button>'))
  expect(markup.indexOf('>Zeal</button>')).toBeLessThan(markup.indexOf('>Aardvark</button>'))
  expect(markup.indexOf('>Zeal</button>')).toBeLessThan(markup.indexOf('Remove L01 Class extra feat slot 2'))
  expect(markup.slice(0, markup.indexOf('>Zeal</button>'))).toContain('Remove L01 Class extra feat slot 1')
  expect(markup.slice(0, markup.indexOf('>Zeal</button>'))).toContain('Add L01 Class feat slot')
  expect(markup.slice(markup.indexOf('>Aardvark</button>'))).toContain('Add L02 Class feat slot')
})

it('prefixes ancestry slots and feat options with zero-padded levels', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 13, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feat: ContentEntry = {
    id: 'feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Natural Ambition', level: 1,
    traits: ['Human'], description: '', data: {}, effects: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['ancestry']} title="Ancestry Feats" />)
  expect(markup).toContain('Ancestry Feats')
  expect(markup).toContain('<details class="character-subsection"><summary>')
  expect(markup).not.toContain('open=""')
  expect(markup).toContain('Level 01')
  expect(markup).toContain('Level 13')
  expect(markup).toContain('aria-label="L13 Ancestry feat"')
  expect(markup).toContain('<option value="Natural Ambition">Natural Ambition</option>')
  expect(markup).toContain('class="feat-slot-list"')
  expect(markup).toContain('class="feat-slot-row"')
  expect((markup.match(/class="feat-slot-row feat-level-start"/g) ?? [])).toHaveLength(0)
  expect((markup.match(/class="feat-level-heading"/g) ?? [])).toHaveLength(4)
})

it('shows the current background skill feat above level-based skill feats', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 2, background: 'Hunter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Quick Draw', type: 'Skill Feat', level: 1, slot: 'skill:2:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = [
    { id: 'hunter', systems: ['pf2e'], kind: 'background', source: 'official', name: 'Hunter', level: 1, traits: [], description: '', data: { feat: 'Survey Wildlife' }, effects: [], updatedAt: 0 },
    { id: 'survey', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Survey Wildlife', level: 1, traits: ['General', 'Skill'], description: '', data: {}, effects: [], updatedAt: 0 },
    { id: 'quick', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Quick Draw', level: 1, traits: [], description: '', data: { actions: 'Single Action' }, effects: [], updatedAt: 0 },
  ]
  const render = (character: Character) => renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={() => {}} categories={['skill']} bare />)
  const markup = render(c)
  expect(markup).not.toContain('Background Skill Feat')
  expect(markup).toContain('Survey Wildlife')
  expect(markup.indexOf('Survey Wildlife')).toBeLessThan(markup.indexOf('Level 02'))
  expect(render({ ...c, background: undefined })).not.toContain('Survey Wildlife')
})

it('includes action symbols in feat choices and shows add control on each level top row', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 2, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = [{
    id: 'quick-draw', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Quick Draw', level: 1,
    traits: ['Ranger'], description: '', data: { actions: 'Single Action' }, effects: [], updatedAt: 0,
  }]
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={entries} save={() => {}} categories={['class']} bare />)
  expect(markup).toContain('Quick Draw ◆')
  expect(markup).not.toContain('class="action-cost"')
  expect((markup.match(/aria-label="Add L\d{2} Class feat slot"/g) ?? [])).toHaveLength(2)
})

it('retains action icons on selected feat names and description headings', () => {
  for (const actions of ['Single Action', 'Two Actions', 'Three Actions', 'Free Action', 'Reaction']) {
    const c: Character = {
      id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      feats: [{ name: 'Action Feat', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
      equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    }
    const feat: ContentEntry = {
      id: 'action-feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Action Feat', level: 1,
      traits: ['Ranger'], description: 'Full feat description.', data: { actions }, effects: [], updatedAt: 0,
    }
    const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['class']} bare />)
    const nameButton = /<button[^>]*class="feat-name"[^>]*>([\s\S]*?)<\/button>/.exec(markup)?.[1]
    const heading = /<h4[^>]*>([\s\S]*?)<\/h4>/.exec(markup)?.[1]
    expect(nameButton).toContain(`class="action-cost" aria-label="${actions}"`)
    expect(heading).toContain(`class="action-cost" aria-label="${actions}"`)
  }
})

it('routes mixed background grants to their own feat sections and hides rows when no feats are granted', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 3, background: 'Mixed Grants',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const base: ContentEntry = {
    id: 'mixed', systems: ['pf2e'], kind: 'background', source: 'official', name: 'Mixed Grants',
    level: 1, traits: [], description: '', data: { feat: 'Toughness, Assurance' }, effects: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = [
    base,
    { ...base, id: 'toughness', kind: 'feat', name: 'Toughness', traits: ['General'], data: {} },
    { ...base, id: 'assurance', kind: 'feat', name: 'Assurance', traits: ['General', 'Skill'], data: {} },
    { ...base, id: 'none', name: 'No Grants', data: {} },
  ]
  const render = (category: 'skill' | 'general', background = c.background) =>
    renderToStaticMarkup(<FeatSlots c={{ ...c, background }} entries={entries} save={() => {}} categories={[category]} bare />)
  const general = render('general')
  expect(general).toContain('Toughness')
  expect(general).not.toContain('Background Skill Feat')
  expect(general.indexOf('Toughness')).toBeLessThan(general.indexOf('L03 General'))
  const skill = render('skill')
  expect(skill).not.toContain('Background Skill Feat')
  expect(skill).toContain('Assurance')
  expect(skill).not.toContain('Toughness')
  for (const category of ['skill', 'general'] as const) {
    expect(render(category, 'No Grants')).not.toContain('Background ')
  }
  const generalOnly = entries.map((entry) => entry.id === 'mixed' ? { ...entry, data: { feat: 'Toughness' } } : entry)
  expect(renderToStaticMarkup(<FeatSlots c={c} entries={generalOnly} save={() => {}} categories={['skill']} bare />))
    .not.toContain('Background Skill Feat')
})

it('groups feat options by level, alphabetically within each level', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 4, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = [
    { id: 'zeal', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Zeal', level: 1, traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 0 },
    { id: 'alpha', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Alpha', level: 1, traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 0 },
    { id: 'middle', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Middle', level: 2, traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 0 },
  ]
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={entries} save={() => {}} categories={['class']} />)
  expect(markup.indexOf('<optgroup label="L01">')).toBeLessThan(markup.indexOf('<optgroup label="L02">'))
  expect(markup.indexOf('>Alpha</option>')).toBeLessThan(markup.indexOf('>Zeal</option>'))
  expect(markup).toContain('<optgroup label="L02"><option value="Middle">Middle</option></optgroup>')
})

it('does not offer or accept duplicate blessings, including when no distinct choice remains', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 8, className: 'Champion', blessing: 'Blessed Armament',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entry: ContentEntry = { id: 'second', name: 'Second Blessing', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 8, traits: ['Champion'], description: '', data: {}, effects: [], updatedAt: 1 }
  const tree = () => FeatSlots({ c, entries: [entry], save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  expect(renderToStaticMarkup(tree())).not.toContain('Second Blessing (Blessed Armament)')
  expect(renderToStaticMarkup(tree())).toContain('Second Blessing (Blessed Shield)')
  const choose = findSelect(tree(), 'L08 Class feat')
  if (!choose) throw new Error('Missing level 8 feat picker')
  choose({ target: { value: JSON.stringify(['Second Blessing', 'Blessed Armament']) } })
  expect(c.feats).toEqual([])
  choose({ target: { value: JSON.stringify(['Second Blessing', 'Blessed Shield']) } })
  expect(c.feats[0]).toMatchObject({ name: 'Second Blessing', choice: 'Blessed Shield' })
  c = { ...c, feats: ['Blessed Shield', 'Blessed Swiftness'].map((name) => ({ name, type: 'Class Feat', level: 1 })) }
  expect(renderToStaticMarkup(tree())).not.toContain('>Second Blessing')
})

it('shows only distinct domains granted by the selected deity in the feat picker', () => {
  let c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 1, className: 'Champion', deity: 'Chosen',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const feat: ContentEntry = { id: 'domain', kind: 'feat', name: "Deity's Domain", level: 1, traits: ['Champion'],
    source: 'official', systems: ['pf2e'], description: '', data: {}, effects: [], updatedAt: 0 }
  const entries: ContentEntry[] = [feat,
    { ...feat, id: 'chosen', name: 'Chosen', kind: 'deity', data: { domain_primary: 'Zeal, Water, water,  Water ' } },
    { ...feat, id: 'other', name: 'Other', kind: 'deity', data: { domain_primary: 'Fire' } }]
  const tree = () => FeatSlots({ c, entries, save: patch => { c = { ...c, ...patch } }, categories: ['class'] })
  const markup = renderToStaticMarkup(tree())
  expect(markup).not.toContain('Deity&#x27;s Domain (Fire)')
  expect(markup).toContain('>Deity&#x27;s Domain (Zeal)</option>')
  expect(markup.match(/>Deity&#x27;s Domain \(Water\)<\/option>/g)).toHaveLength(1)
  const choose = findSelect(tree(), 'L01 Class feat')!
  choose({ target: { value: JSON.stringify(["Deity's Domain", 'Fire']) } })
  expect(c.feats).toEqual([])
  choose({ target: { value: JSON.stringify(["Deity's Domain", 'Water']) } })
  expect(c.feats[0].choice).toBe('Water')
  c = { ...c, deity: 'Other' }
  expect(renderToStaticMarkup(tree())).toContain('Water (unavailable)')
  expect(c.feats[0].choice).toBe('Water')
  c = { ...c, deity: undefined, feats: [] }
  expect(renderToStaticMarkup(tree())).not.toContain('Deity&#x27;s Domain (')
})

it('lists each domain spell in its picker and selected feat descriptions', () => {
  const c: Character = { ...emptyRanger(), className: 'Champion', deity: 'Gozreh', level: 8 }
  const domain: ContentEntry = { id: 'domain', kind: 'feat', name: "Deity's Domain", level: 1, traits: ['Champion'],
    source: 'official', systems: ['pf2e'], description: 'Choose a domain.', data: {}, effects: [], updatedAt: 0 }
  const advanced: ContentEntry = { ...domain, id: 'advanced', name: "Advanced Deity's Domain", level: 8 }
  const entries: ContentEntry[] = [domain, advanced,
    { ...domain, id: 'gozreh', name: 'Gozreh', kind: 'deity', data: { domain_primary: 'Water, Air' } },
    { ...domain, id: 'tidal', name: 'Tidal Surge', kind: 'spell', traits: ['Focus'], data: { domain: 'Water' } },
    { ...domain, id: 'downpour', name: 'Downpour', kind: 'spell', traits: ['Focus'], level: 4, data: { domain: 'Water' } }]
  const popup = (character: Character, slot: string) => renderToStaticMarkup(<FeatSlots c={character} entries={entries}
    save={() => {}} categories={['class']} search={{ [`${slot}:open`]: '1' }} onSearch={() => {}} />)
  const initial = popup(c, 'class:1:0')
  expect(initial).toContain('Details: Deity&#x27;s Domain (Water)')
  expect(initial).toContain('Granted focus spell: Tidal Surge.')
  expect(initial).toContain('Domain spell data unavailable.')
  const selected: Character = { ...c, feats: [{ name: domain.name, type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'Water' }] }
  const next = popup(selected, 'class:8:0')
  expect(next).toContain('Granted focus spell: Tidal Surge.')
  expect(next).toContain('Details: Advanced Deity&#x27;s Domain (Water)')
  expect(next).toContain('Granted focus spell: Downpour.')
})

it('links imported leads-to feats inside feat descriptions and marks unavailable targets', () => {
  const source = mapAonHit({ _id: 'source', _source: { category: 'feat', name: 'Sacral Lord', level: 4,
    trait: ['Champion'], markdown: 'Rules.\n\n<title level="2">Sacral Lord leads to...</title>\n[Sacral Monarch](/Feats.aspx?ID=8479), [Missing Feat](/Feats.aspx?ID=999)' } }, 'pf2e')!
  const target = mapAonHit({ _id: 'target', _source: { category: 'feat', name: 'Sacral Monarch', level: 8,
    trait: ['Champion'], url: '/Feats.aspx?ID=8479', markdown: 'Monarch rules.' } }, 'pf2e')!
  const c: Character = { ...emptyRanger(), className: 'Champion', level: 4,
    feats: [{ name: source.name, type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[source, target]} save={() => {}} categories={['class']} />)
  expect(markup).toContain('Leads to: <span><button type="button">Sacral Monarch</button></span>')
  expect(markup).toContain('Missing Feat (unavailable)')
  expect(markup).not.toContain('Sacral Lord leads to... Sacral Monarch')
})

it('allows repeatable feats in multiple slots and retains their entry link until the final copy is removed', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [],
    extraSlots: [{ category: 'class', level: 1, count: 1 }], updatedAt: 0,
  }
  const entries: ContentEntry[] = [{
    id: 'warden', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Initiate Warden', level: 1,
    traits: ['Ranger'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }, {
    id: 'spell-one', systems: ['pf2e'], kind: 'spell', source: 'official', name: 'Spell One', level: 1,
    traits: ['Focus', 'Ranger'], description: '', data: { warden_spell_tier: 'Initiate' }, effects: [], updatedAt: 1,
  }, {
    id: 'spell-two', systems: ['pf2e'], kind: 'spell', source: 'official', name: 'Spell Two', level: 1,
    traits: ['Focus', 'Ranger'], description: '', data: { warden_spell_tier: 'Initiate' }, effects: [], updatedAt: 1,
  }]
  const tree = () => FeatSlots({ c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  const select = () => findSelect(tree(), 'L01 Class feat')
  const chooseFirst = select()
  if (!chooseFirst) throw new Error('Missing first slot')
  chooseFirst({ target: { value: JSON.stringify(['Initiate Warden', 'Spell One']) } })
  const removeExtra = findButton(tree(), 'Remove L01 Class extra feat slot 1')
  expect(removeExtra).toBeDefined()
  const chooseExtra = (() => {
    let selects: Array<(event: { target: { value: string } }) => void> = []
    const visit = (node: ReactNode) => Children.forEach(node, (child) => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'select' && child.props['aria-label'] === 'L01 Class feat') selects.push(child.props.onChange as (event: { target: { value: string } }) => void)
      visit(child.props.children as ReactNode)
    })
    visit(tree())
    return selects[0]
  })()
  if (!chooseExtra) throw new Error('Missing extra slot')
  chooseExtra({ target: { value: JSON.stringify(['Initiate Warden', 'Spell Two']) } })
  expect(c.feats).toHaveLength(2)
  expect(c.entryIds).toEqual(['warden'])
  expect(c.feats.map((feat) => feat.choice)).toEqual(['Spell One', 'Spell Two'])
  const remove = findButton(tree(), 'Remove L01 Class extra feat slot 1')
  if (!remove) throw new Error('Missing remove button')
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  remove()
  expect(c.feats).toHaveLength(2)
  expect(c.extraSlots).toHaveLength(1)
  remove()
  expect(c.feats).toHaveLength(1)
  expect(c.entryIds).toEqual(['warden'])
  const clear = findButton(tree(), 'Clear L01 Class feat selection')
  if (!clear) throw new Error('Missing clear button')
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  clear()
  expect(c.feats).toHaveLength(1)
  clear()
  expect(c.feats).toEqual([])
  expect(c.entryIds).toEqual([])
  expect(plannedSlots(c).filter((slot) => slot.category === 'class' && slot.level === 1)).toHaveLength(1)
})

it('adds slots beside a selected feat and removes only the chosen extra slot', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, ancestry: 'Human', className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'First', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: ['first', 'second', 'third'], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = ['First', 'Second', 'Third'].map((name) => ({
    id: name.toLowerCase(), systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 0,
  }))
  const tree = () => FeatSlots({ c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  const add = () => {
    const action = findButton(tree(), 'Add L01 Class feat slot')
    if (!action) throw new Error('Missing add button')
    action()
  }
  add()
  add()
  expect(c.extraSlots).toEqual([{ category: 'class', level: 1, count: 1 }, { category: 'class', level: 1, count: 1 }])
  expect(plannedSlots(c).filter((s) => s.category === 'class').map((s) => s.key)).toEqual(['class:1:0', 'class:1:1', 'class:1:2'])
  c.feats.push(
    { name: 'Second', type: 'Class Feat', level: 1, slot: 'class:1:1' },
    { name: 'Third', type: 'Class Feat', level: 1, slot: 'class:1:2' },
  )
  const remove = findButton(tree(), 'Remove L01 Class extra feat slot 1')
  if (!remove) throw new Error('Missing remove button')
  remove()
  expect(c.extraSlots).toEqual([{ category: 'class', level: 1, count: 1 }])
  expect(c.feats).toEqual([
    { name: 'First', type: 'Class Feat', level: 1, slot: 'class:1:0' },
    { name: 'Third', type: 'Class Feat', level: 1, slot: 'class:1:1' },
  ])
  expect(c.entryIds).toEqual(['first', 'third'])
})

it('removes existing counted extras without changing other slots', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 3,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Extra', type: 'Bonus Feat', level: 1, slot: 'bonus:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], updatedAt: 0,
    extraSlots: [{ category: 'bonus', level: 1, count: 2 }, { category: 'class', level: 1, count: 1 }],
  }
  const tree = FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['bonus'] })
  const remove = findButton(tree, 'Remove L01 Bonus extra feat slot 0')
  if (!remove) throw new Error('Missing remove button')
  remove()
  expect(c.extraSlots).toEqual([{ category: 'bonus', level: 1, count: 1 }, { category: 'class', level: 1, count: 1 }])
  expect(c.feats).toEqual([])
})

it('keeps extra slots next to their matching standard slot', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], updatedAt: 0,
    extraSlots: [{ category: 'ancestry', level: 1, count: 2 }, { category: 'class', level: 1, count: 1 }],
  }
  expect(plannedSlots(c).map((s) => s.key)).toEqual([
    'ancestry:1:0', 'ancestry:1:1', 'ancestry:1:2', 'class:1:0', 'class:1:1',
  ])
})

it('keeps an existing Advanced General Training choice selected under level 09', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 9, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Advanced General Training', type: 'Ancestry Feat', level: 13, slot: 'ancestry:9:0' },
      { name: 'Fleet', type: 'General Feat', level: 1, slot: 'general:7:g2' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[]} save={() => {}} categories={['general']} />)
  expect(markup).toContain('aria-haspopup="dialog">Fleet</button>')
  expect(markup.indexOf('Level 09')).toBeLessThan(markup.indexOf('>Fleet</button>'))
  expect(markup).toContain('aria-label="Clear L09 General feat selection"')
})

it('opens Living Weapon details from its name instead of a separate summary or inline choice', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Living Weapon', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feat: ContentEntry = {
    id: 'living-weapon', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Living Weapon', level: 1,
    traits: ['Ranger'], description: 'Living Weapon rules summary.', data: { repeatable: true }, effects: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['class']} />)
  expect(markup).toContain('aria-haspopup="dialog">Living Weapon</button>')
  expect(markup).toContain('<dialog')
  expect(markup).toContain(feat.description)
  expect(markup).not.toContain('<summary>Change</summary>')
  expect(markup).toContain('aria-label="Clear L01 Class feat selection"')
  expect(markup).not.toContain('Summary')
  expect(markup).not.toContain('Living Weapon choice')
})

const emptyRanger = (): Character => ({
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
})

it('preserves dormant Ancestral Paragon choices during edits and removes the child only when its granting feat is removed', () => {
  let c: Character = { ...emptyRanger(), ancestry: 'Elf',
    feats: [
      { name: 'Ancestral Paragon', type: 'General Feat', level: 3, slot: 'general:3:0' },
      { name: 'Elven Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:g3' },
      { name: 'Class Choice', type: 'Class Feat', level: 1, slot: 'class:1:0' },
    ],
  }
  const tree = (categories: ('class' | 'general')[]) => FeatSlots({ c, categories, entries: [], save: (patch) => { c = { ...c, ...patch } } })
  findButton(tree(['class']), 'Clear L01 Class feat selection')!()
  expect(c.feats.map((feat) => feat.name)).toEqual(['Ancestral Paragon', 'Elven Lore'])
  expect(plannedSlots(c).some((slot) => slot.key === 'ancestry:1:g3')).toBe(false)
  c = JSON.parse(JSON.stringify({ ...c, level: 3 }))
  expect(plannedSlots(c).find((slot) => slot.key === 'ancestry:1:g3')).toMatchObject({ level: 3, maxFeatLevel: 1 })
  findButton(tree(['general']), 'Clear L03 General feat selection')!()
  expect(c.feats).toEqual([])
})

it('selects Skill Training together with its skill through a standard feat slot', () => {
  let c: Character = { ...emptyRanger(), level: 3 }
  const entries: ContentEntry[] = [{
    id: 'skill-training', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Skill Training', level: 1,
    traits: ['General', 'Skill'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }]
  const choose = findSelect(FeatSlots({
    c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['skill'],
  }), 'L02 Skill feat')!
  choose({ target: { value: JSON.stringify(['Skill Training', 'Stealth']) } })
  expect(c.feats).toEqual([{ name: 'Skill Training', type: 'Skill Feat', level: 1, slot: 'skill:2:0', choice: 'Stealth' }])
})

it('blocks unmet feat chains while preserving and flagging existing selections after a prerequisite is removed', () => {
  const entries: ContentEntry[] = [
    { id: 'parent', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Barreling Charge', level: 4, traits: ['Barbarian'], data: {}, description: '', effects: [], updatedAt: 1 },
    { id: 'child', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Overpowering Charge', level: 10, traits: ['Barbarian'], data: { prerequisite: 'Barreling Charge' }, description: '', effects: [], updatedAt: 1 },
  ]
  let c: Character = { ...emptyRanger(), className: 'Barbarian', level: 10, feats: [
    { name: 'Barreling Charge', type: 'Class Feat', level: 4, slot: 'class:4:0' },
    { name: 'Overpowering Charge', type: 'Class Feat', level: 10, slot: 'class:10:0' },
  ] }
  const tree = () => FeatSlots({ c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  expect(renderToStaticMarkup(tree())).not.toContain('Prerequisites unmet')
  findButton(tree(), 'Clear L04 Class feat selection')!()
  expect(c.feats.map((feat) => feat.name)).toEqual(['Overpowering Charge'])
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Prerequisites unmet: Barreling Charge')
  expect(markup).toContain('Overpowering Charge <span role="img" aria-label="Prerequisites unmet">*</span></button>')
  c = { ...c, feats: [] }
  findSelect(tree(), 'L10 Class feat')!({ target: { value: 'Overpowering Charge' } })
  expect(c.feats).toEqual([])
})

it.each([
  ['class', 'Class', 1, ['Barbarian']],
  ['ancestry', 'Ancestry', 1, ['Human']],
  ['skill', 'Skill', 2, ['General', 'Skill']],
  ['general', 'General', 3, ['General']],
] as const)('shows unmet %s feats with their missing skill instead of hiding them', (category, label, level, traits) => {
  const entry: ContentEntry = {
    id: 'target', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Needs Training', level: 1,
    traits: [...traits], data: { prerequisite: 'trained in Athletics' }, description: '', effects: [], updatedAt: 1,
  }
  let c: Character = { ...emptyRanger(), className: 'Barbarian', ancestry: 'Human', level: 3 }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [entry], save, categories: [category] })
  expect(renderToStaticMarkup(tree())).toContain('value="Needs Training" disabled="">Needs Training * Missing trained in Athletics</option>')
  findSelect(tree(), `L0${level} ${label} feat`)!({ target: { value: entry.name } })
  expect(save).not.toHaveBeenCalled()
  c = { ...c, skillPicks: ['Athletics'] }
  expect(renderToStaticMarkup(tree())).toContain('value="Needs Training">Needs Training</option>')
  findSelect(tree(), `L0${level} ${label} feat`)!({ target: { value: entry.name } })
  expect(c.feats).toHaveLength(1)
})

it('lists every confirmed missing prerequisite and updates the label as requirements are met', () => {
  const target: ContentEntry = {
    id: 'target', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Dragon Howl', level: 2,
    traits: ['Barbarian'], data: { prerequisite: 'dragon instinct, trained in Intimidation' }, description: '', effects: [], updatedAt: 1,
  }
  const entries = [target, { ...target, id: 'dragon', kind: 'subclass' as const, name: 'Dragon', data: { class: 'Barbarian' } }]
  const c: Character = { ...emptyRanger(), className: 'Barbarian', subclass: 'Fury', level: 2 }
  const render = (character: Character) => renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={() => {}} categories={['class']} />)
  expect(render(c)).toContain('Dragon Howl * Missing dragon instinct; trained in Intimidation')
  expect(render({ ...c, skillPicks: ['Intimidation'] })).toContain('Dragon Howl * Missing dragon instinct</option>')
  expect(render({ ...c, subclass: 'Dragon', skillPicks: ['Intimidation'] })).toContain('value="Dragon Howl">Dragon Howl</option>')
})

it('hides unowned archetype feats, keeps Dedication choices, and shows other unmet requirements for owned archetypes', () => {
  const child: ContentEntry = {
    id: 'child', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Defend Mount', level: 4,
    traits: ['Archetype'], data: { archetype: 'Cavalier', prerequisite: 'Cavalier Dedication, trained in Athletics' },
    description: '', effects: [], updatedAt: 1,
  }
  const dedication: ContentEntry = { ...child, id: 'dedication', name: 'Cavalier Dedication', level: 2,
    traits: ['Archetype', 'Dedication'], data: { archetype: 'Cavalier' } }
  let c: Character = { ...emptyRanger(), level: 4 }
  const save = vi.fn()
  const tree = (type = 'archetype') => FeatSlots({ c, entries: [dedication, child], save, categories: ['archetype'],
    search: { 'archetype:4:0:open': '1', 'archetype:4:0:type': type } })
  expect(renderToStaticMarkup(tree())).not.toContain(child.name)
  expect(renderToStaticMarkup(tree('dedication'))).toContain('L04 Dedication: Cavalier Dedication')
  c = { ...c, feats: [{ name: dedication.name, type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' }] }
  const label = 'L04 Dedication: Defend Mount * Missing trained in Athletics'
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${label}" disabled=""`)
  findButton(tree(), label)!()
  expect(save).not.toHaveBeenCalled()
  c = { ...c, level: 6, feats: [{ ...c.feats[0], takenLevel: 6, slot: 'archetype:6:0' }] }
  expect(renderToStaticMarkup(tree())).not.toContain(child.name)
})

it('shows missing prerequisites even when the feat currently has no available subchoices', () => {
  const entry: ContentEntry = {
    id: 'third', systems: ['pf2e'], kind: 'feat', source: 'homebrew', name: 'Third Innovation', level: 16,
    traits: ['Inventor'], data: { prerequisite: 'Second Innovation' }, description: '', effects: [], updatedAt: 1,
  }
  const c: Character = { ...emptyRanger(), className: 'Inventor', level: 16 }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[entry]} save={() => {}} categories={['class']} />)
  expect(markup).toContain('value="Third Innovation" disabled="">Third Innovation * Missing Second Innovation</option>')
})

it('marks only the affected feat and shows its missing prerequisites above the description in its dialog', () => {
  const names = ['Draconic Arrogance', 'Moment of Clarity', 'Raging Intimidation', 'Raging Thrower', 'Sudden Charge']
  const entries = names.map<ContentEntry>((name) => ({
    id: name, systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits: ['Barbarian'], data: { prerequisite: name === 'Draconic Arrogance' ? 'dragon instinct' : '' },
    description: `${name} rules text.`, effects: [], updatedAt: 1,
  }))
  entries.push({
    ...entries[0], id: 'dragon', kind: 'subclass', name: 'Dragon', data: { class: 'Barbarian' },
  })
  const c: Character = {
    ...emptyRanger(), className: 'Barbarian', subclass: 'Fury', level: 2,
    feats: names.map((name, index) => ({ name, type: 'Class Feat', level: 1, slot: `class:1:${index}` })),
    extraSlots: [{ category: 'class', level: 1, count: 4 }],
  }
  const render = (character: Character) =>
    renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={() => {}} categories={['class']} />)
  const markup = render(c)
  const rows = markup.match(/<li class="feat-slot-row[^"]*">[\s\S]*?<\/li>/g) ?? []
  const affected = rows.find((row) => row.includes('Draconic Arrogance <span'))
  expect(affected).toBeDefined()
  expect(affected).toContain('aria-label="Prerequisites unmet">*</span></button>')
  const dialog = /<dialog[\s\S]*?<\/dialog>/.exec(affected!)?.[0]
  expect(dialog).toContain('Prerequisites unmet: dragon instinct')
  expect(dialog).toContain('Draconic Arrogance rules text.')
  expect(dialog!.indexOf('Prerequisites unmet')).toBeLessThan(dialog!.indexOf('Draconic Arrogance rules text.'))
  expect(affected!.replace(/<dialog[\s\S]*?<\/dialog>/g, '')).not.toContain('Prerequisites unmet:')
  for (const name of names.slice(1)) {
    const row = rows.find((row) => row.includes(`>${name}</button>`))
    expect(row).toBeDefined()
    expect(row).not.toContain('feat-prerequisite-note')
    expect(row).not.toContain('aria-label="Prerequisites unmet"')
  }
  expect(render({ ...c, subclass: 'Dragon' })).not.toContain('Prerequisites unmet')
})

it('labels narrative prerequisites for manual review instead of claiming they are enforced', () => {
  const feat: ContentEntry = {
    id: 'wings', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Winged Warrior Dedication', level: 1,
    traits: ['General'], data: { prerequisite: 'you have permanent wings' }, description: '', effects: [], updatedAt: 1,
  }
  const c: Character = { ...emptyRanger(), level: 3, feats: [{ name: feat.name, type: 'General Feat', level: 1, slot: 'general:3:0' }] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['general']} />)
  expect(markup).not.toContain('aria-label="Prerequisites unmet"')
  const dialog = /<dialog[\s\S]*?<\/dialog>/.exec(markup)?.[0]
  expect(dialog).toContain('Check prerequisites manually: you have permanent wings')
  expect(markup.replace(/<dialog[\s\S]*?<\/dialog>/g, '')).not.toContain('Check prerequisites manually:')
  expect(markup).not.toContain('Prerequisites unmet')
  expect(renderToStaticMarkup(<FeatSlots c={{ ...c, feats: [] }} entries={[feat]} save={() => {}} categories={['general']} />))
    .toContain('Winged Warrior Dedication (check prerequisites)')
})

it.each([
  ['class', 'Druid', 'Human', 'Current Spell', 'Elementalist Dedication'],
  ['ancestry', 'Ranger', 'Dragonblood', 'Draconic Scent', 'Dragon Disciple Dedication'],
] as const)('uses the selected %s feat source instead of an unrelated archetype with the same name', (category, className, ancestry, name, prerequisite) => {
  const feat: ContentEntry = {
    id: 'selected', systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits: [category === 'class' ? className : ancestry], data: {}, description: 'Selected source.', effects: [], updatedAt: 1,
  }
  const wrong: ContentEntry = { ...feat, id: 'other', traits: ['Archetype'], data: { prerequisite }, description: 'Other source.' }
  const level = category === 'class' ? 20 : 17
  const c: Character = {
    ...emptyRanger(), className, ancestry: category === 'ancestry' ? 'Human' : ancestry,
    heritage: category === 'ancestry' ? ancestry : undefined, level,
    feats: [{ name, type: `${category === 'class' ? 'Class' : 'Ancestry'} Feat`, level: 1, slot: `${category}:${level}:0` }],
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[wrong, feat, { ...feat, id: 'parent', name: prerequisite }]}
    save={() => {}} categories={[category]} />)
  expect(markup).not.toContain('aria-label="Prerequisites unmet"')
  expect(markup).not.toContain('feat-prerequisite-note')
  expect(markup).toContain('Selected source.')
  expect(markup).not.toContain('Other source.')
})

it('preserves an adopted ancestry source and leaves ambiguous versions for manual review instead of inventing a failure', () => {
  const feat: ContentEntry = {
    id: 'shirren', systems: ['sf2e'], kind: 'feat', source: 'official', name: 'Linguistic Prodigy', level: 1,
    traits: ['Shirren'], data: {}, description: 'Shirren source.', effects: [], updatedAt: 1,
  }
  const human: ContentEntry = {
    ...feat, id: 'human', traits: ['Human'], data: { prerequisite: 'Trained in Society' }, description: 'Human source.',
  }
  const c: Character = {
    ...emptyRanger(), systems: ['sf2e'], ancestry: 'Human', level: 5, entryIds: [feat.id],
    feats: [
      { name: 'Adopted Ancestry', type: 'General Feat', level: 1, slot: 'general:3:0', choice: 'Shirren' },
      { name: feat.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' },
    ],
  }
  const render = (character: Character) =>
    renderToStaticMarkup(<FeatSlots c={character} entries={[human, feat]} save={() => {}} categories={['ancestry']} />)
  expect(render(c)).toContain('Shirren source.')
  expect(render(c)).not.toContain('Human source.')
  expect(render(c)).not.toContain('feat-prerequisite-note')
  const ambiguous = render({ ...c, entryIds: [] })
  expect(ambiguous).not.toContain('aria-label="Prerequisites unmet"')
  expect(ambiguous).toContain('Check prerequisites manually: Verify source version of Linguistic Prodigy')
})

it.each(['standard', 'extra'])('removes an empty %s selector without confirmation or losing other selections', (kind) => {
  vi.mocked(window.confirm).mockReturnValue(false)
  let c: Character = { ...emptyRanger(), extraSlots: [{ category: 'class', level: 1, count: 2 }],
    feats: [{ name: 'Keep', type: 'Class Feat', level: 1, slot: 'class:1:2' }] }
  const tree = () => FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  const label = kind === 'standard' ? 'Remove L01 Class feat slot 0' : 'Remove L01 Class extra feat slot 1'
  findButton(tree(), label)!()
  expect(window.confirm).not.toHaveBeenCalled()
  expect(plannedSlots(c).filter((slot) => slot.category === 'class')).toHaveLength(2)
  expect(c.feats.map((feat) => feat.name)).toEqual(['Keep'])
})

it('still confirms selected-feat removals and preserves them when canceled', () => {
  vi.mocked(window.confirm).mockReturnValue(false)
  let c: Character = { ...emptyRanger(), feats: [{ name: 'Keep', type: 'Class Feat', level: 1, slot: 'class:1:0' }] }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [], save, categories: ['class'] })
  findButton(tree(), 'Clear L01 Class feat selection')!()
  expect(window.confirm).toHaveBeenCalledOnce()
  expect(save).not.toHaveBeenCalled()
  expect(c.feats[0].name).toBe('Keep')
})

it('removes a standard row among extra slots, clears the final row, and restores a dismissed row with plus', () => {
  let c: Character = {
    ...emptyRanger(), extraSlots: [{ category: 'class', level: 1, count: 1 }],
    feats: [
      { name: 'First', type: 'Class Feat', level: 1, slot: 'class:1:0' },
      { name: 'Second', type: 'Class Feat', level: 1, slot: 'class:1:1' },
    ],
  }
  const tree = () => FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  const remove = findButton(tree(), 'Remove L01 Class feat slot 0')
  if (!remove) throw new Error('Missing standard slot minus')
  remove()
  expect(c.feats.map((feat) => feat.name)).toEqual(['Second'])
  expect(plannedSlots(c).filter((slot) => slot.category === 'class').map((slot) => slot.key)).toEqual(['class:1:1'])
  const clear = findButton(tree(), 'Clear L01 Class feat selection')
  if (!clear) throw new Error('Missing final slot minus')
  clear()
  expect(c.feats).toEqual([])
  expect(c.extraSlots).toEqual([{ category: 'class', level: 1, count: 1 }])
  expect(findSelect(tree(), 'L01 Class feat')).toBeDefined()
  const add = findButton(tree(), 'Add L01 Class feat slot')
  if (!add) throw new Error('Missing plus')
  add()
  expect(c.dismissedFeatSlots).toEqual([])
  expect(plannedSlots(c).filter((slot) => slot.category === 'class')).toHaveLength(2)
})

it('restores a dismissed standard slot when its remaining feat-granted row disappears', () => {
  let c: Character = {
    ...emptyRanger(), dismissedFeatSlots: ['class:1:0'], entryIds: ['ambition', 'child'],
    feats: [
      { name: 'Natural Ambition', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
      { name: 'Child', type: 'Class Feat', level: 1, slot: 'class:1:g1' },
    ],
  }
  const entries: ContentEntry[] = ['Natural Ambition', 'Child'].map((name, i) => ({
    id: i ? 'child' : 'ambition', systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits: [], description: '', data: {}, effects: [], updatedAt: 1,
  }))
  const clear = findButton(FeatSlots({
    c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['ancestry'],
  }), 'Clear L01 Ancestry feat selection')
  if (!clear) throw new Error('Missing ancestry minus')
  clear()
  expect(c.feats).toEqual([])
  expect(c.entryIds).toEqual([])
  expect(c.dismissedFeatSlots).toEqual([])
  expect(plannedSlots(c).filter((slot) => slot.category === 'class').map((slot) => slot.key)).toEqual(['class:1:0'])
})

it('records the actual acquisition level for a later Natural Ambition grant', () => {
  let c: Character = { ...emptyRanger(), level: 5, feats: [
    { name: 'Natural Ambition', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' },
  ] }
  const entry: ContentEntry = {
    id: 'class-feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Class Feat', level: 1,
    traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 1,
  }
  const tree = () => FeatSlots({ c, entries: [entry], save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  findSelect(tree(), 'L05 Class feat')!({ target: { value: entry.name } })
  expect(c.feats.find((feat) => feat.name === entry.name)).toMatchObject({ slot: 'class:1:g1', takenLevel: 5 })
  expect(plannedSlots({ ...c, level: 4 }).some((slot) => slot.key === 'class:1:g1')).toBe(false)
  expect(unslottedFeats({ ...c, level: 4 })).not.toContainEqual(c.feats.find((feat) => feat.name === entry.name))
})

it('removes only the Natural Ambition-dependent selection when the feat is removed', () => {
  let c: Character = { ...emptyRanger(), level: 5, feats: [
    { name: 'Natural Ambition', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' },
    { name: 'First Choice', type: 'Class Feat', level: 1, slot: 'class:1:g1', takenLevel: 5 },
    { name: 'Ordinary Choice', type: 'Class Feat', level: 4, slot: 'class:4:0' },
  ] }
  const tree = FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['ancestry'] })
  findButton(tree, 'Clear L05 Ancestry feat selection')!()
  expect(c.feats.map((feat) => feat.name)).toEqual(['Ordinary Choice'])
  expect(plannedSlots(c).filter((slot) => slot.category === 'class' && slot.level === 5)).toEqual([])
})

it('clears N/A without removing the final dedication slot', () => {
  let c: Character = { ...emptyRanger(), level: 2, skippedFeatSlots: ['archetype:2:0'] }
  const tree = () => FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['archetype'] })
  const clear = findButton(tree(), 'Clear L02 Dedication feat selection')
  if (!clear) throw new Error('Missing dedication minus')
  clear()
  expect(c.skippedFeatSlots).toEqual([])
  expect(plannedSlots(c).some((slot) => slot.key === 'archetype:2:0')).toBe(true)
})

it.each([
  { className: 'Ranger', feat: 'Peerless Warden', choice: 'Gluttonous Growth', label: 'Gluttonous Growth' },
  { className: 'Druid', feat: 'Order Explorer', choice: 'Flame', label: 'Flame Order' },
])('selects $feat and its choice together without a second picker', ({ className, feat, choice, label }) => {
  let c: Character = { ...emptyRanger(), className, level: 20, order: className === 'Druid' ? 'Animal' : undefined }
  const entries: ContentEntry[] = [{
    id: 'feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: feat, level: 1,
    traits: [className], description: 'Feat rules.', data: { repeatable: true }, effects: [], updatedAt: 1,
  }, {
    id: 'spell', systems: ['pf2e'], kind: 'spell', source: 'official', name: 'Gluttonous Growth', level: 9,
    traits: ['Ranger', 'Focus'], description: '', data: { warden_spell_tier: 'Peerless' }, effects: [], updatedAt: 1,
  }]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } }, categories: ['class' as const] })
  expect(renderToStaticMarkup(<FeatSlots {...props()} />)).toContain(`${feat} (${label})</option>`)
  const choose = findSelect(FeatSlots(props()), 'L01 Class feat')
  if (!choose) throw new Error('Missing feat picker')
  choose({ target: { value: JSON.stringify([feat, choice]) } })
  expect(c.feats).toEqual([{ name: feat, type: 'Class Feat', level: 1, slot: 'class:1:0', choice }])
  expect(c.entryIds).toEqual(['feat'])
  const markup = renderToStaticMarkup(<FeatSlots {...props()} />)
  expect(markup).toContain(`aria-haspopup="dialog">${feat} (${label})</button>`)
  expect(markup).not.toContain('class="feat-choice"')
})

it('omits the current class suffix while preserving the saved canonical name', () => {
  let c: Character = { ...emptyRanger(), level: 6 }
  const entries: ContentEntry[] = [{
    id: 'companion', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Incredible Companion (Ranger)', level: 6,
    traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 1,
  }]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } }, categories: ['class' as const] })
  expect(renderToStaticMarkup(<FeatSlots {...props()} />)).toContain('value="Incredible Companion (Ranger)">Incredible Companion</option>')
  const choose = findSelect(FeatSlots(props()), 'L06 Class feat')
  if (!choose) throw new Error('Missing level six picker')
  choose({ target: { value: 'Incredible Companion (Ranger)' } })
  expect(c.feats[0].name).toBe('Incredible Companion (Ranger)')
  expect(renderToStaticMarkup(<FeatSlots {...props()} />)).toContain('aria-haspopup="dialog">Incredible Companion</button>')
})

it('greys out ineffective Canny Acumen options and refuses their selection', () => {
  let c: Character = { ...emptyRanger(), level: 3 }
  const entries: ContentEntry[] = [{
    id: 'canny', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Canny Acumen', level: 1,
    traits: ['General'], description: '', data: {}, effects: [], updatedAt: 1,
  }, {
    id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1,
    traits: [], description: '', data: { perception_proficiency: 'Expert', will_proficiency: 'Trained' }, effects: [], updatedAt: 1,
  }]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } }, categories: ['general' as const] })
  const markup = renderToStaticMarkup(<FeatSlots {...props()} />)
  expect(markup).toMatch(/<option[^>]*disabled=""[^>]*>Canny Acumen \(Perception - no improvement\)<\/option>/)
  const choose = findSelect(FeatSlots(props()), 'L03 General feat')
  if (!choose) throw new Error('Missing general picker')
  choose({ target: { value: JSON.stringify(['Canny Acumen', 'Perception']) } })
  expect(c.feats).toEqual([])
  choose({ target: { value: JSON.stringify(['Canny Acumen', 'Will']) } })
  expect(c.feats[0]).toMatchObject({ name: 'Canny Acumen', choice: 'Will' })
})

it('persists N/A for a dedication slot without creating a feat and allows replacing it', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 2, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], updatedAt: 0,
    extraSlots: [{ category: 'archetype', level: 2, count: 1 }],
  }
  const feat: ContentEntry = {
    id: 'bard', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Bard Dedication', level: 2,
    traits: ['Archetype', 'Dedication'], description: '', data: { archetype: 'Bard' }, effects: [], updatedAt: 0,
  }
  const tree = () => FeatSlots({
    c, entries: [feat], save: (patch) => { c = { ...c, ...patch } }, categories: ['archetype'],
    search: { 'archetype:2:0:open': '1', 'archetype:2:0:type': 'dedication' }, onSearch: () => {},
  })
  const skip = findButton(tree(), 'L02 Dedication N/A')
  if (!skip) throw new Error('Missing N/A choice')
  skip()
  expect(c.skippedFeatSlots).toEqual(['archetype:2:0'])
  expect(c.feats).toEqual([])
  expect(renderToStaticMarkup(tree())).toContain('<span>N/A</span>')
  const choose = findButton(tree(), 'L02 Dedication: Bard Dedication')
  if (!choose) throw new Error('Missing dedication choice')
  choose()
  expect(c.skippedFeatSlots).toEqual([])
  expect(c.feats.map((f) => f.name)).toEqual(['Bard Dedication'])
  const skipAgain = findButton(tree(), 'L02 Dedication N/A')
  if (!skipAgain) throw new Error('Missing N/A choice')
  skipAgain()
  expect(c.feats).toEqual([])
  expect(c.entryIds).toEqual([])
  const clear = findButton(tree(), 'L02 Dedication clear')
  if (!clear) throw new Error('Missing clear choice')
  clear()
  expect(c.skippedFeatSlots).toEqual([])
})
