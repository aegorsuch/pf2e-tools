import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FeatSlots } from './FeatSlots'
import { plannedSlots } from './builder'
import type { Character, ContentEntry } from './types'

beforeEach(() => vi.stubGlobal('window', { confirm: vi.fn(() => true) }))
afterEach(() => vi.unstubAllGlobals())

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
  expect(markup).toContain('Background Skill Feat')
  expect(markup).toContain('Survey Wildlife')
  expect(markup.indexOf('Background Skill Feat')).toBeLessThan(markup.indexOf('Level 02'))
  expect(render({ ...c, background: undefined })).not.toContain('Background Skill Feat')
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
  expect(general).toContain('Background General Feat')
  expect(general).toContain('Toughness')
  expect(general).not.toContain('Background Skill Feat')
  expect(general.indexOf('Background General Feat')).toBeLessThan(general.indexOf('L03 General'))
  const skill = render('skill')
  expect(skill).toContain('Background Skill Feat')
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
