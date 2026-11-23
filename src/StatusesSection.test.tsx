import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { savingThrowBreakdown } from './builder'
import { DeviseAStratagemToggle, StatusesContent, StatusesSummary } from './StatusesSection'
import { ProtectCompanionOptions, ZealousConvictionToggle } from './SpellsSection'
import type { Character, ContentEntry } from './types'

it('synchronizes condition and Zealous Conviction state with character statistics', () => {
  let c: Character = { id: 'statuses', name: 'Test', systems: ['pf2e'], level: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  function findInput(node: ReactNode, label: string): ((event: { target: { value: string } }) => void) | undefined {
    let result: ((event: { target: { value: string } }) => void) | undefined
    Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'input' && child.props['aria-label'] === label)
        result = child.props.onChange as typeof result
      else result ??= findInput(child.props.children as ReactNode, label)
    })

    return result
  }
  const baseline = savingThrowBreakdown(c, [], 'Will').total
  findInput(StatusesContent({ c, entries: [], save }), 'Frightened status')!({ target: { value: '2' } })
  expect(c.conditions?.frightened).toBe(2)
  expect(savingThrowBreakdown(c, [], 'Will').total).toBe(baseline - 2)
  const toggle = ZealousConvictionToggle({ c, save, rank: 10 })
  expect(renderToStaticMarkup(toggle)).toContain('> Zealous Conviction</label>')
  const input = Children.toArray(toggle.props.children).find(child => isValidElement(child) && child.type === 'input')
  if (!isValidElement<{ onChange: (event: { target: { checked: boolean } }) => void }>(input)) throw Error('Missing toggle')
  input.props.onChange({ target: { checked: true } })
  expect(c.zealousConvictionRank).toBe(10)
  const summary = renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)
  expect(summary).toContain('Frightened 2')
  expect(summary).toContain('Zealous Conviction')
  input.props.onChange({ target: { checked: false } })
  expect(c.zealousConvictionRank).toBeUndefined()
})

it('synchronizes Protect Companion target and active state', () => {
  let c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'one', name: 'One', type: 'Bear' }, { id: 'two', name: 'Two', type: 'Bear' }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const toggle = ProtectCompanionOptions({ c, save, companionId: 'two' })
  const label = Children.toArray(toggle.props.children).find(child => isValidElement(child) && child.type === 'label')
  if (!isValidElement<{ children: ReactNode }>(label)) throw Error('Missing label')
  const input = Children.toArray(label.props.children).find(child => isValidElement(child) && child.type === 'input')
  if (!isValidElement<{ onChange: (event: { target: { checked: boolean } }) => void }>(input)) throw Error('Missing toggle')
  input.props.onChange({ target: { checked: true } })
  expect(c.protectCompanionId).toBe('two')
  expect(c.activeSpells).toContain('Protect Companion')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).toContain('Protect Companion')
  input.props.onChange({ target: { checked: false } })
  expect(c.activeSpells).not.toContain('Protect Companion')
})

it('tracks Bless in Statuses and summary', () => {
  const entry: ContentEntry = { id: 'bless', name: 'Bless', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 1, traits: [], description: '', data: { actions: 'Two Actions', tradition: 'Divine' },
    effects: [], updatedAt: 1 }
  let c: Character = { id: 'bless', name: 'Test', systems: ['pf2e'], level: 3,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    spells: [{ name: 'Bless', rank: 1, cantrip: false }],
  }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const findBlessChange = (node: ReactNode): ((event: { target: { checked: boolean } }) => void) | undefined => {
    let result: ((event: { target: { checked: boolean } }) => void) | undefined
    Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'input' && child.props['aria-label'] === 'Bless status')
        result = child.props.onChange as typeof result
      else result ??= findBlessChange(child.props.children as ReactNode)
    })
    return result
  }
  const change = findBlessChange(StatusesContent({ c, entries: [entry], save }))
  if (!change) throw Error('Missing Bless status toggle')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[entry]} save={save} />)).not.toContain('Bless')
  change({ target: { checked: true } })
  expect(c.activeSpells).toContain('Bless')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[entry]} save={save} />)).toContain('Bless')
  change({ target: { checked: false } })
  expect(c.activeSpells).not.toContain('Bless')
})

it('toggles Entrench Melee from Statuses and summarizes it while active', () => {
  const armor: ContentEntry = { id: 'bastion', name: 'Immortal Bastion Plate', systems: ['pf2e'], kind: 'armor',
    source: 'official', level: 10, traits: [], description: '', data: { ac: 6, armor_category: 'Heavy' },
    effects: [], updatedAt: 1 }
  const fighter: ContentEntry = { id: 'fighter', name: 'Fighter', systems: ['pf2e'], kind: 'class',
    source: 'official', level: 0, traits: [], description: '', data: { heavy_armor_proficiency: 'Trained' },
    effects: [], updatedAt: 1 }
  let c: Character = { id: 'bastion-status', name: 'Test', systems: ['pf2e'], level: 10, className: 'Fighter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], armors: [{ id: 'bastion', name: armor.name, potency: 0, resilient: 0, runes: [], worn: true }],
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const entries = [armor, fighter]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const markup = renderToStaticMarkup(<StatusesContent c={c} entries={entries} save={save} />)
  expect(markup).toContain('Entrench Melee: Immortal Bastion Plate')
  const findChange = (node: ReactNode): ((event: { target: { checked: boolean } }) => void) | undefined => {
    let result: ((event: { target: { checked: boolean } }) => void) | undefined
    Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'input' && child.props['aria-label'] === 'Entrench Melee: Immortal Bastion Plate status')
        result = child.props.onChange as typeof result
      else result ??= findChange(child.props.children as ReactNode)
    })
    return result
  }
  const change = findChange(StatusesContent({ c, entries, save }))
  if (!change) throw Error('Missing Entrench Melee status toggle')
  change({ target: { checked: true } })
  expect(c.armors?.[0].entrenchMeleeActive).toBe(true)
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={entries} save={save} />)).toContain('Entrench Melee')
  change({ target: { checked: false } })
  expect(c.armors?.[0].entrenchMeleeActive).toBe(false)
})

it('toggles Devise a Stratagem from the class summary and Statuses', () => {
  let c: Character = { id: 'investigator', name: 'Test', systems: ['pf2e'], level: 1, className: 'Investigator',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  function findToggle(node: ReactNode): ((event: { target: { checked: boolean } }) => void) | undefined {
    let result: ((event: { target: { checked: boolean } }) => void) | undefined
    Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'input' && child.props['aria-label'] === 'Devise a Stratagem active')
        result = child.props.onChange as typeof result
      else result ??= findToggle(child.props.children as ReactNode)
    })

    return result
  }
  const summaryToggle = DeviseAStratagemToggle({ c, save, summary: true })
  expect(summaryToggle).not.toBeNull()
  const summaryChange = findToggle(summaryToggle)
  if (!summaryChange) throw Error('Missing class toggle')
  summaryChange({ target: { checked: true } })
  expect(c.deviseAStratagemActive).toBe(true)
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).toContain('Devise a Stratagem')
  expect(renderToStaticMarkup(<StatusesContent c={c} entries={[]} save={save} />)).toContain('Devise a Stratagem')
  const statusChange = findToggle(DeviseAStratagemToggle({ c, save }))
  if (!statusChange) throw Error('Missing status toggle')
  statusChange({ target: { checked: false } })
  expect(c.deviseAStratagemActive).toBe(false)
  expect(DeviseAStratagemToggle({ c: { ...c, className: 'Ranger' }, save })).toBeNull()
})

it.each([
  { className: 'Rogue', subclass: 'Thief' },
  { className: 'Rogue', subclass: 'Avenger' },
])('shows Poison Weapon doses in Statuses for $subclass', ({ className, subclass }) => {
  const c: Character = { id: 'poison-status', name: 'Test', systems: ['pf2e'], level: 8, className, subclass,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [
      { name: 'Poison Weapon', type: 'Class Feat', level: 4 },
    ], simplePoisonsSpent: 3, equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const content = renderToStaticMarkup(<StatusesContent c={c} entries={[]} save={() => {}} />)
  expect(content).toContain('Poison Weapon')
  expect(content).toContain('aria-label="Restore poison use 1"')
  expect(content).not.toContain('poison damage')
  expect(content).not.toContain('remaining')
  const summary = renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={() => {}} />)
  expect(summary).not.toContain('Simple poisons')
  expect(summary).not.toContain('Poison Weapon')
  expect(renderToStaticMarkup(<StatusesSummary c={{ ...c, poisonWeaponActive: true }} entries={[]} save={() => {}} />))
    .toContain('Poison Weapon')
})

it('renders each available status in its own alphabetical row', () => {
  const c: Character = { id: 'statuses', name: 'Test', systems: ['pf2e'], level: 20, className: 'Barbarian',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    activeSpells: ['Tailwind', 'Protect Companion', 'Enduring Might'], zealousConvictionRank: 9,
    companions: [{ id: 'bear', name: 'Bear', type: 'Bear' }] }
  const markup = renderToStaticMarkup(<StatusesContent c={c} entries={[]} save={() => {}} />)
  expect(markup.match(/class="status-row"/g)).toHaveLength(9)
  const labels = ['Active stance', 'Enduring Might status', 'Enfeebled status', 'Frightened status',
    'Protect Companion active', 'Rage active (defense)', 'Sickened status', 'Tailwind status', 'Zealous Conviction active on self']
  const positions = labels.map(label => markup.indexOf(label))
  expect(positions.every(position => position >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
  const summary = renderToStaticMarkup(<StatusesSummary c={{ ...c, raging: true, conditions: { frightened: 2, enfeebled: 1 } }} entries={[]} save={() => {}} />)
  expect(summary).toContain('Enduring Might, Enfeebled 1, Frightened 2, Protect Companion, Rage, Tailwind, Zealous Conviction')
})
