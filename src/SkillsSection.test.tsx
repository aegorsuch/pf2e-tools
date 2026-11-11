import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SkillsSection } from './SkillsSection'
import { armorRanks, defenseSummary, ranksAt, weaponRanks } from './builder'
import type { Character, ContentEntry } from './types'

const ranger: ContentEntry = {
  id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1,
  traits: [], description: '', effects: [], updatedAt: 0,
  data: {
    skill_proficiency: 'Trained in Nature, Trained in a number of additional skills equal to 4 plus your Intelligence modifier',
    perception_proficiency: 'Trained', fortitude_proficiency: 'Expert', reflex_proficiency: 'Trained', will_proficiency: 'Trained',
  },
}
const feyBound: ContentEntry = {
  id: 'fey-bound', systems: ['pf2e'], kind: 'background', source: 'official', name: 'Fey Bound', level: 1,
  traits: [], description: '', effects: [], updatedAt: 0, data: { skill: 'Fey Lore' },
}
const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

function findButtons(node: ReactNode) {
  const buttons = new Map<string, Record<string, unknown>>()
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'button') buttons.set(String(child.props['aria-label']), child.props)
    findButtonsInto(child.props.children as ReactNode, buttons)
  })
  return buttons
}

function findButtonsInto(node: ReactNode, buttons: Map<string, Record<string, unknown>>) {
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'button') buttons.set(String(child.props['aria-label']), child.props)
    findButtonsInto(child.props.children as ReactNode, buttons)
  })
}

it('uses skill circles for class picks and shows remaining rank budgets', () => {
  let c: Character = { ...base, level: 5, skillIncreases: { 3: 'Nature' } }
  const entries = [ranger]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
  const markup = renderToStaticMarkup(<SkillsSection {...props()} />)
  expect(markup).not.toContain('Class Skills')
  expect(markup).toContain('<b>T</b>4')
  expect(markup).toContain('<b>E</b>1')

  const buttons = findButtons(SkillsSection(props()))
  const society = buttons.get('Society Trained')
  if (!society) throw new Error('Missing Society trained control')
  ;(society.onClick as () => void)()
  expect(c.skillPicks).toEqual(['Society'])
  expect(renderToStaticMarkup(<SkillsSection {...props()} />)).toContain('<b>T</b>3')
})

it('locks class/background grants and derives defense proficiency without overrides', () => {
  let c: Character = {
    ...base, level: 3, background: 'Fey Bound', skillPicks: ['Society'],
    rankOverrides: { Nature: 0, 'Fey Lore': 0, Perception: 0, Fortitude: 0, Reflex: 4 },
  }
  const entries = [ranger, feyBound]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
  const buttons = findButtons(SkillsSection(props()))
  expect(ranksAt(c, entries)).toMatchObject({ Nature: 1, 'Fey Lore': 1, Perception: 1, Fortitude: 2, Reflex: 1 })

  for (const name of ['Nature', 'Fey Lore']) {
    const trained = buttons.get(`${name} Trained`)
    if (!trained) throw new Error(`Missing ${name} trained control`)
    expect(trained.disabled).toBe(true)
    ;(trained.onClick as () => void)()
  }
  for (const [part, names] of [['offense', ['Perception']], ['defense', ['Fortitude', 'Reflex']]] as const) {
    const partButtons = findButtons(SkillsSection({ ...props(), part }))
    for (const name of names) expect(partButtons.get(`${name} Expert`)?.disabled).toBe(true)
  }
  expect(c.skillPicks).toEqual(['Society'])

  const natureExpert = buttons.get('Nature Expert')
  if (!natureExpert) throw new Error('Missing Nature expert control')
  ;(natureExpert.onClick as () => void)()
  expect(ranksAt(c, entries).Nature).toBe(2)
  expect(c.skillIncreases).toEqual({ 3: 'Nature' })

  c = { ...c, level: 7 }
  const masterButtons = findButtons(SkillsSection(props()))
  const natureMaster = masterButtons.get('Nature Master')
  if (!natureMaster) throw new Error('Missing Nature master control')
  expect(natureMaster.disabled).toBe(false)
  ;(natureMaster.onClick as () => void)()
  expect(ranksAt(c, entries).Nature).toBe(3)
  expect(c.skillIncreases).toEqual({ 3: 'Nature', 7: 'Nature' })
})

it('sorts all skills with Lore and allows trained and Lore rank increases', () => {
  let c: Character = { ...base, level: 8, background: 'Fey Bound', skillPicks: ['Society'] }
  const entries = [ranger, feyBound]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
  const markup = renderToStaticMarkup(<SkillsSection {...props()} />)
  expect(markup.indexOf('Diplomacy')).toBeLessThan(markup.indexOf('Fey Lore'))
  expect(markup.indexOf('Fey Lore')).toBeLessThan(markup.indexOf('Intimidation'))
  expect(markup).not.toContain('Perception')
  expect(markup).not.toContain('Fortitude')
  const offense = renderToStaticMarkup(<SkillsSection {...props()} part="offense" />)
  expect(offense).toContain('Perception')
  const defense = renderToStaticMarkup(<SkillsSection {...props()} part="defense" />)
  expect(defense.indexOf('Fortitude')).toBeLessThan(defense.indexOf('Reflex'))
  expect(defense.indexOf('Reflex')).toBeLessThan(defense.indexOf('Will'))

  const buttons = findButtons(SkillsSection(props()))
  const acrobatics = buttons.get('Acrobatics Trained')
  const loreExpert = buttons.get('Fey Lore Expert')
  if (!acrobatics || !loreExpert) throw new Error('Missing skill proficiency controls')
  expect(acrobatics.disabled).toBe(false)
  expect(loreExpert.disabled).toBe(false)
  ;(acrobatics.onClick as () => void)()
  ;(loreExpert.onClick as () => void)()
  expect(c.skillPicks).toEqual(['Society', 'Acrobatics'])
  expect(c.skillIncreases).toEqual({ 3: 'Fey Lore' })
  expect(ranksAt(c, entries)['Fey Lore']).toBe(2)
})

it('raises save and Perception ranks from class feature text and summarizes defenses', () => {
  const feature = (name: string, level: number, description: string): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'classFeature', source: 'official', name, level, traits: [],
    description, data: { class: 'Ranger' }, effects: [], updatedAt: 0,
  })
  const entries = [
    ranger,
    feature('Iron Will', 3, 'Your proficiency rank for Will saves increases to expert.'),
    feature('Evasion', 7, 'Your proficiency rank for Reflex saves increases to master.'),
    feature('Juggernaut', 11, 'Your proficiency rank for Fortitude saves increases to master.'),
    feature('Greater Natural Reflexes', 15, 'Your proficiency rank for Reflex saves increases to legendary.'),
    feature('Ranger Expertise', 9, 'Your proficiency rank for your ranger class DC increases to expert.'),
  ]
  const c: Character = { ...base, level: 20 }
  expect(ranksAt(c, entries)).toMatchObject({ Fortitude: 3, Reflex: 4, Will: 2 })
  expect(defenseSummary(c, entries)).toMatchObject({ fortitude: 26, reflex: 28, will: 24 })
})

it('shows weapon and armor proficiency badges from class text and features', () => {
  const klass: ContentEntry = {
    ...ranger,
    data: {
      ...ranger.data,
      attack_proficiency: 'Trained in simple weapons, Trained in martial weapons, Trained in unarmed attacks',
      defense_proficiency: 'Trained in light armor, Trained in medium armor, Trained in unarmored defense',
    },
  }
  const upgrades = (name: string, level: number, description: string): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'classFeature', source: 'official', name, level, traits: [],
    description, data: { class: 'Ranger' }, effects: [], updatedAt: 0,
  })
  const entries = [
    klass,
    upgrades('Weapon Mastery', 13, 'Your proficiency ranks for simple and martial weapons and unarmed attacks increase to master.'),
    upgrades('Medium Armor Expertise', 11, 'Your proficiency ranks for light armor, medium armor, and unarmored defense increase to expert.'),
  ]
  const c: Character = { ...base, level: 13 }
  expect(weaponRanks(c, entries)).toEqual({ Simple: 3, Martial: 3, Advanced: 0, Unarmed: 3 })
  expect(armorRanks(c, entries)).toEqual({ Light: 2, Medium: 2, Heavy: 0, Unarmored: 2 })
  const props = { c, entries, save: () => {} }
  expect(renderToStaticMarkup(<SkillsSection {...props} part="offense" />)).not.toContain('Initiative bonus')
  expect(renderToStaticMarkup(<SkillsSection {...props} part="defense" />)).toContain('Unarmored')
})
