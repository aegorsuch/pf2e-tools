import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { MinionsContent, MinionsSection } from './MinionsSection'
import { SearchableSelect } from './SearchableSelect'
import { CompanionSpellOptions, SpellsSection } from './SpellsSection'
import { armorClass } from './builder'
import type { Character, ContentEntry } from './types'

function findSelect(node: ReactNode, label: string): ((event: { target: { value: string } }) => void) | undefined {
  let found: ((event: { target: { value: string } }) => void) | undefined
  Children.forEach(node, (child) => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = (child.type === 'select' || child.type === SearchableSelect) && child.props['aria-label'] === label
      ? child.props.onChange as (event: { target: { value: string } }) => void
      : findSelect(child.props.children as ReactNode, label)
  })
  return found
}

function findToggle(node: ReactNode, label: string): ((event: { target: { checked: boolean } }) => void) | undefined {
  let found: ((event: { target: { checked: boolean } }) => void) | undefined
  Children.forEach(node, (child) => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = child.type === 'input' && child.props['aria-label'] === label
      ? child.props.onChange as (event: { target: { checked: boolean } }) => void
      : findToggle(child.props.children as ReactNode, label)
  })
  return found
}

it('shows one advancement choice and summarizes companion type and stage', () => {
  const c: Character = {
    id: 'companion', systems: ['pf2e'], name: 'Test', level: 10, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Incredible Companion', type: 'Class Feat', level: 8, choice: 'Nimble' },
      { name: 'Incredible Mount', type: 'Class Feat', level: 8 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'snow', type: 'Snow Leopard', name: '' }],
  }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Nimble Snow Leopard')
  expect(markup.match(/aria-label="Companion advancement"/g)).toHaveLength(1)
})

it('shows the same advancement used for companion stats when multiple feats have saved choices', () => {
  const c: Character = {
    id: 'companion', systems: ['pf2e'], name: 'Test', level: 10, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Incredible Companion', type: 'Class Feat', level: 8, choice: 'Savage' },
      { name: 'Incredible Mount', type: 'Class Feat', level: 8, choice: 'Nimble' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'cat', type: 'Cat', name: '' }],
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('Savage Cat')
  expect(html).toContain('<option value="Savage" selected="">Savage</option>')
  expect(html).not.toContain('<option value="Nimble" selected="">Nimble</option>')
})

it('shows feat-granted familiar choices and a separate aquatic pet with bonus abilities', () => {
  const c: Character = {
    id: 'minions', systems: ['pf2e'], name: 'Test', level: 8, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: ['Leshy Familiar', 'Enhanced Familiar', 'Friend of the Sea'].map(name => ({ name, type: 'Class Feat', level: 1 })),
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { leshyAbility: 'Fungus', abilities: ['Flier'] }, pet: { abilities: ['Climber'] },
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('Leshy Familiar')
  expect(html).toContain('Daily familiar or master abilities (1/4)')
  expect(html).toContain('Leshy familiar granted ability')
  expect(html).toContain('Aquatic Pet')
  expect(html).toContain('HP 56')
  expect(html).toContain('Darkvision and Tough')
  expect(html).toContain('Climb Speed 25 feet.')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, feats: [] }} entries={[]} save={() => {}} />)).not.toContain('Leshy Familiar')
})

it('shows a pet only when Beast Trainer grants Pet', () => {
  const c: Character = {
    id: 'trainer', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Beast Trainer', type: 'Ancestry Feat', level: 1, choice: 'Pet' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)).toContain('aria-label="Pet name"')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, feats: [{ ...c.feats[0], choice: 'Train Animal' }] }} entries={[]} save={() => {}} />))
    .not.toContain('aria-label="Pet name"')
})

it('applies active familiar Tough and displays recognized daily ability effects', () => {
  const c: Character = {
    id: 'familiar', systems: ['pf2e'], name: 'Test', level: 8, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Leshy Familiar', type: 'Class Feat', level: 1 },
      { name: 'Enhanced Familiar', type: 'Class Feat', level: 2 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { abilities: ['Flier', '', 'tough', 'Climber'] },
  }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('<small>Hit Points</small> <b>56</b> (includes Tough)')
  expect(markup).toContain('Flier: Fly Speed 25 feet.')
  expect(markup).toContain('Climber: Climb Speed 25 feet.')
  const reduced = renderToStaticMarkup(<MinionsSection c={{ ...c, feats: c.feats.slice(0, 1) }} entries={[]} save={() => {}} />)
  expect(reduced).toContain('<small>Hit Points</small> <b>40</b>')
  expect(reduced).not.toContain('Climber: Climb Speed 25 feet.')
  expect(c.familiar?.abilities).toEqual(['Flier', '', 'tough', 'Climber'])
})

it('does not apply the owner’s raised shield bonus to familiar AC', () => {
  const c: Character = {
    id: 'familiar-defense', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    shield: { id: 'shield', name: 'Shield', raised: true, hardness: 5, hp: 20, damage: 0 },
  }
  expect(armorClass(c, [])).toBe(14)
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('<small>Armor Class</small><b>12</b>')
  expect(markup).toContain('<small>Fortitude</small>+1')
})

it('provides one extra Leshy Familiar Secrets ability and requires second-rank spell slots for Verdant Burst', () => {
  let c: Character = {
    id: 'leshy', systems: ['pf2e'], name: 'Test', level: 4, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Leshy Familiar', type: 'Class Feat', level: 1 }, { name: 'Leshy Familiar Secrets', type: 'Class Feat', level: 4 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const tree = () => MinionsContent({ c, entries: [], save: patch => { c = { ...c, ...patch } } })
  findSelect(tree(), 'Leshy Familiar Secrets ability')?.({ target: { value: 'Verdant Burst' } })
  expect(c.familiar?.leshySecret).toBe('Verdant Burst')
  expect(renderToStaticMarkup(tree())).toContain('three-action Heal at rank 1')
  c = { ...c, className: 'Ranger' }
  expect(renderToStaticMarkup(tree())).toContain('Verdant Burst requires a 2nd-rank spell slot')
  findSelect(tree(), 'Leshy Familiar Secrets ability')?.({ target: { value: 'Purify Air' } })
  expect(renderToStaticMarkup(tree())).toContain('+2 circumstance to saves against inhaled effects')
  c = { ...c, feats: c.feats.slice(0, 1) }
  expect(renderToStaticMarkup(tree())).not.toContain('Leshy Familiar Secrets ability')
  expect(c.familiar?.leshySecret).toBe('Purify Air')
})

it('uses full companion stat names, omits redundant level, and keeps AC adjustment sources inside its popover', () => {
  const c: Character = {
    id: 'labels', systems: ['pf2e'], name: 'Test', level: 7, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'cat', type: 'Cat', name: '' }], activeSpells: ['Magic Hide', 'Enlarge Companion'],
    spells: [{ name: 'Magic Hide', rank: 1, cantrip: false }, { name: 'Enlarge Companion', rank: 2, cantrip: false }],
  }
  const cat: ContentEntry = {
    id: 'cat', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Cat', level: 1,
    traits: [], description: '', data: { size: 'Medium', hp: 6 }, effects: [], updatedAt: 1,
  }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[cat]} save={() => {}} />)
  for (const label of ['Hit Points', 'Armor Class', 'Fortitude', 'Reflex', 'Strength', 'Dexterity',
    'Constitution', 'Intelligence', 'Wisdom', 'Charisma']) expect(markup).toContain(`<small>${label}</small>`)
  for (const label of ['Level', 'HP', 'AC', 'Fort', 'Ref', 'Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'])
    expect(markup).not.toContain(`<small>${label}</small>`)
  expect(markup).toContain('aria-label="Magic Hide, Enlarge Companion note"')
  expect(markup).not.toContain('</button> (Magic Hide, Enlarge Companion)')
  expect(markup).toContain('+1 Status (Magic Hide); -1 Status (clumsy 1; Enlarge Companion)')
})

it('syncs companion spell toggles in both directions, persists targets, and gates heightened choices', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 6, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    activeSpells: ['Keen Smell'],
    companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Cat', name: 'B' }],
    spells: ['Canopy Crawler', 'Enlarge Companion'].map((name) => ({ name, rank: 2, cantrip: false })),
  }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  for (const name of ['Canopy Crawler', 'Enlarge Companion'] as const) {
    c = { ...c, level: name === 'Canopy Crawler' ? 9 : 6 }
    const component = (companionId?: string) => CompanionSpellOptions({ c, entries: [], save, name, companionId })
    const on = findToggle(component('b'), `${name} on B`)
    if (!on) throw new Error('Missing companion spell toggle')
    on({ target: { checked: true } })
    expect(c.activeSpells).toContain(name)
    expect(c.activeSpells).toContain('Keen Smell')
    const spells = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={save} />)
    expect(spells).toContain(`aria-label="${name} active" checked=""`)
    expect(renderToStaticMarkup(component('a'))).not.toContain('checked=""')
    const off = findToggle(component(), `${name} active`)
    if (!off) throw new Error('Missing spell list toggle')
    off({ target: { checked: false } })
    expect(renderToStaticMarkup(component('b'))).not.toContain('checked=""')
    const spellOn = findToggle(component(), `${name} active`)
    if (!spellOn) throw new Error('Missing spell list toggle')
    spellOn({ target: { checked: true } })
    expect(renderToStaticMarkup(component('b'))).toContain('checked=""')
  }
  expect(c.canopyCrawlerCompanionId).toBe('b')
  expect(c.enlargeCompanionId).toBe('b')
  const select = (name: 'Canopy Crawler' | 'Enlarge Companion', label: string, value: string) => {
    const change = findSelect(CompanionSpellOptions({ c, entries: [], save, name }), label)
    if (!change) throw new Error('Missing companion spell choice')
    change({ target: { value } })
  }
  expect(findSelect(CompanionSpellOptions({ c, entries: [], save, name: 'Enlarge Companion' }), 'Enlarge Companion size')).toBeUndefined()
  expect(c.enlargeCompanionSize).toBeUndefined()
  c = { ...c, level: 7, enlargeCompanionSize: 'Huge' }
  expect(renderToStaticMarkup(<CompanionSpellOptions c={c} entries={[]} save={save} name="Enlarge Companion" />))
    .not.toContain('Size')
  expect(c.enlargeCompanionSize).toBe('Huge')
  expect(renderToStaticMarkup(<CompanionSpellOptions c={c} entries={[]} save={save} name="Canopy Crawler" />))
    .not.toContain('Canopy Crawler target')
  c = { ...c, level: 9 }
  select('Canopy Crawler', 'Canopy Crawler companion', 'a')
  expect(c.canopyCrawlerCompanionId).toBe('a')
  select('Canopy Crawler', 'Canopy Crawler companion', 'invalid')
  expect(c.canopyCrawlerCompanionId).toBe('a')
  c = { ...c, level: 6 }
  expect(renderToStaticMarkup(<CompanionSpellOptions c={c} entries={[]} save={save} name="Enlarge Companion" />))
    .not.toContain('Enlarge Companion size')
  expect(c.enlargeCompanionSize).toBe('Huge')
})

it.each([
  ['Incredible Companion', 'Specialized Companion'],
  ['Incredible Mount', 'Specialized Mount'],
  ['Imposing Destrier', 'Specialized Mount'],
])('places %s and %s choices on the companion card', (advanced, specialized) => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: advanced, type: 'Class Feat', level: 8, choice: 'Nimble' },
      { name: specialized, type: 'Class Feat', level: 10, choice: 'Ambusher' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'wolf', name: 'Wolf', type: 'Wolf' }],
  }
  const wolf: ContentEntry = {
    id: 'wolf', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Wolf', level: 1,
    traits: [], description: '', data: { strength: 2, dexterity: 2, constitution: 2, intelligence: -4, wisdom: 1, charisma: 0, hp: 8, size: 'Medium', speed: 35, companion_attacks: 'Jaws|1d8 piercing|' },
    effects: [], updatedAt: 0,
  }

  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[wolf]} save={() => {}} />)

  expect(markup).toContain('aria-label="Companion advancement"')
  expect(markup).toContain('aria-label="Companion specialization 2"')
  expect(markup).toContain('<option value="Nimble" selected="">Nimble</option>')
  expect(markup).toContain('<option value="Ambusher" selected="">Ambusher</option>')
  expect(markup).not.toContain(advanced)
  expect(markup).not.toContain(specialized)
  expect(markup).not.toContain('Add animal companion')
  expect(markup).toContain('aria-label="Companion type"')
  expect(markup).not.toContain('aria-label="Remove Wolf"')
  expect(markup).not.toContain('aria-label="Companion name"')
  expect(markup).toContain('<strong>Wolf</strong>')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, feats: [], companions: [] }} entries={[wolf]} save={() => {}} />))
    .not.toContain('Add animal companion')
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const choose = findSelect(MinionsContent({ c, entries: [wolf], save }), 'Companion specialization 2')
  if (!choose) throw new Error('Missing specialization dropdown')
  choose({ target: { value: 'Racer' } })
  expect(c.feats[1]).toMatchObject({ name: specialized, choice: 'Racer' })
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={[wolf]} save={save} />)).toContain('<span>Racer</span>')
  c = { ...c, feats: [...c.feats].reverse() }
  const reordered = renderToStaticMarkup(<MinionsSection c={c} entries={[wolf]} save={save} />)
  expect(reordered.indexOf('aria-label="Companion advancement"')).toBeLessThan(reordered.indexOf('aria-label="Companion specialization 1"'))
  const advance = findSelect(MinionsContent({ c, entries: [wolf], save }), 'Companion advancement')
  if (!advance) throw new Error('Missing advancement dropdown')
  advance({ target: { value: 'Savage' } })
  expect(c.feats[1]).toMatchObject({ name: advanced, choice: 'Savage' })
  expect(c.feats[0]).toMatchObject({ name: specialized, choice: 'Racer' })
  c = { ...c, feats: [...c.feats,
    { name: specialized, type: 'Class Feat', level: 10, choice: 'Wrecker' },
    { name: specialized, type: 'Class Feat', level: 10, choice: 'Ambusher' },
  ] }
  const sorted = renderToStaticMarkup(<MinionsSection c={c} entries={[wolf]} save={save} />)
  expect(sorted.indexOf('aria-label="Companion advancement"')).toBeLessThan(sorted.indexOf('aria-label="Companion specialization 4"'))
  expect(sorted.indexOf('aria-label="Companion specialization 4"')).toBeLessThan(sorted.indexOf('aria-label="Companion specialization 1"'))
  expect(sorted.indexOf('aria-label="Companion specialization 1"')).toBeLessThan(sorted.indexOf('aria-label="Companion specialization 3"'))
  expect(sorted.indexOf('<span>Ambusher</span>')).toBeLessThan(sorted.indexOf('<span>Racer</span>'))
  expect(sorted.indexOf('<span>Racer</span>')).toBeLessThan(sorted.indexOf('<span>Wrecker</span>'))
  const changeFirst = findSelect(MinionsContent({ c, entries: [wolf], save }), 'Companion specialization 4')
  if (!changeFirst) throw new Error('Missing alphabetized specialization')
  changeFirst({ target: { value: 'Bully' } })
  expect(c.feats[3]).toMatchObject({ name: specialized, choice: 'Bully' })
  expect(c.feats[0]).toMatchObject({ name: specialized, choice: 'Racer' })
})

it('lets a Champion choose or replace Faithful Steed without a rename field', () => {
  let c: Character = {
    id: 'champion', systems: ['pf2e'], name: 'Test', level: 1, className: 'Champion',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Faithful Steed', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [], faithfulSteedGranted: true,
  }
  const horse: ContentEntry = {
    id: 'horse', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Horse', level: 1,
    traits: [], description: '', data: { size: 'Large', mount: true }, effects: [], updatedAt: 1,
  }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const select = findSelect(MinionsContent({ c, entries: [horse], save }), 'Choose Faithful Steed')
  if (!select) throw new Error('Missing Faithful Steed selection')
  select({ target: { value: 'invalid' } })
  expect(c.companions).toEqual([])
  select({ target: { value: 'Horse' } })
  expect(c.companions).toMatchObject([{ type: 'Horse', name: '' }])
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[horse]} save={save} />)
  expect(markup).toContain('Animal Companions (1)')
  expect(markup).toContain('aria-label="Companion type"')
  expect(markup).not.toContain('Choose Faithful Steed')
  expect(markup).not.toContain('aria-label="Companion name"')
})

it('saves Auspice specialization and servitor choices only when Auspicious Mount is available', () => {
  let c: Character = {
    id: 'champion', systems: ['pf2e'], name: 'Test', level: 16, className: 'Champion',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Auspicious Mount', type: 'Class Feat', level: 16 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'horse', type: 'Horse', name: '' }],
  }
  const horse: ContentEntry = {
    id: 'horse', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Horse', level: 1,
    traits: [], description: '', data: { size: 'Large', mount: true, speed: 40 }, effects: [], updatedAt: 1,
  }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const tree = () => MinionsContent({ c, entries: [horse], save })
  expect(renderToStaticMarkup(tree())).toContain('<option value="Auspice">Auspice</option>')
  const choose = findSelect(tree(), 'Companion specialization 1')!
  choose({ target: { value: 'Auspice' } })
  expect(c.feats[0].choice).toBe('Auspice')
  expect(renderToStaticMarkup(tree())).toContain('aria-label="Auspice servitor"')
  findSelect(tree(), 'Auspice servitor')!({ target: { value: 'Celestial' } })
  expect(c.companions![0].auspiceServitor).toBe('Celestial')
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('<span>Holy</span>')
  expect(markup).toContain('Weakness: Unholy 5')
  expect(markup).toContain('fly 40 feet')
  c = { ...c, level: 15 }
  expect(renderToStaticMarkup(tree())).not.toContain('Companion specialization')
  expect(renderToStaticMarkup(tree())).not.toContain('Auspice servitor')
  expect(c.feats[0].choice).toBe('Auspice')
  c = { ...c, level: 16 }
  expect(renderToStaticMarkup(tree())).toContain('<option value="Auspice" selected="">Auspice</option>')
})

it('removes Enlarge size choices for Large companions and disables casting on Huge companions', () => {
  const companion: ContentEntry = {
    id: 'wolf', systems: ['pf2e'], kind: 'companion', source: 'homebrew', name: 'Sarkorian Direwolf', level: 1,
    traits: [], description: '', data: { size: 'Large', fixed_size: true }, effects: [], updatedAt: 1,
  }
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 7, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'wolf', type: companion.name, name: '' }],
    spells: [{ name: 'Enlarge Companion', rank: 2, cantrip: false }], enlargeCompanionSize: 'Large',
  }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const props = () => ({ c, entries: [companion], save, name: 'Enlarge Companion' as const })
  expect(renderToStaticMarkup(<CompanionSpellOptions {...props()} />)).not.toContain('aria-label="Enlarge Companion size"')
  const on = findToggle(CompanionSpellOptions(props()), 'Enlarge Companion active')
  if (!on) throw new Error('Missing Enlarge toggle')
  on({ target: { checked: true } })
  expect(c.activeSpells).toContain('Enlarge Companion')
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[companion]} save={save} />)
  expect(markup).toMatch(/Huge<button[^>]*>\*<\/button> \(Enlarge Companion\)/)
  expect(markup).not.toContain('Size: Huge')
  c = { ...c, level: 6, activeSpells: [] }
  expect(renderToStaticMarkup(<CompanionSpellOptions {...props()} />))
    .toContain('aria-label="Enlarge Companion active" disabled=""')
  for (const size of ['Huge', 'Gargantuan']) {
    const entries = [{ ...companion, data: { ...companion.data, size } }]
    const spells = renderToStaticMarkup(<SpellsSection c={{ ...c, level: 7 }} entries={entries} save={save} />)
    expect(spells).toContain('aria-label="Enlarge Companion active" disabled=""')
    expect(spells).not.toContain('aria-label="Enlarge Companion size"')
  }
})
