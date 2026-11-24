import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { protectCompanionTarget, savingThrowBreakdown } from './builder'
import { DeviseAStratagemToggle, StatusesContent, StatusesSummary } from './StatusesSection'
import { ProtectCompanionOptions, ZealousConvictionToggle } from './SpellsSection'
import { fulminatingShotBonus } from './fulminatingShot'
import type { Character, ContentEntry } from './types'

function findToggle(node: ReactNode, label: string): ((event: { target: { checked: boolean } }) => void) | undefined {
  let result: ((event: { target: { checked: boolean } }) => void) | undefined
  Children.forEach(node, child => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    result = child.type === 'input' && child.props['aria-label'] === label
      ? child.props.onChange as typeof result
      : findToggle(child.props.children as ReactNode, label)
  })
  return result
}

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

it('tracks Purify Air within the familiar aura without changing ordinary saves', () => {
  let c: Character = { id: 'purify-air', name: 'Test', systems: ['pf2e'], level: 4, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Leshy Familiar', type: 'Class Feat', level: 1 },
      { name: 'Leshy Familiar Secrets', type: 'Class Feat', level: 4, choice: 'Purify Air' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const baseline = savingThrowBreakdown(c, [], 'Fortitude').total
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).not.toContain('Purify Air')
  findToggle(StatusesContent({ c, entries: [], save }), 'Purify Air status')!({ target: { checked: true } })
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).toContain('Purify Air')
  for (const name of ['Fortitude', 'Reflex', 'Will'] as const) {
    const breakdown = savingThrowBreakdown(c, [], name)
    expect(breakdown.total).toBe(baseline)
    expect(breakdown.notes).toContainEqual(expect.stringContaining('Purify Air: +2 circumstance'))
  }
  c = { ...c, feats: c.feats.map(feat => feat.name === 'Leshy Familiar Secrets' ? { ...feat, choice: 'Verdant Burst' } : feat) }
  expect(findToggle(StatusesContent({ c, entries: [], save }), 'Purify Air status')).toBeUndefined()
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).not.toContain('Purify Air')
  expect(savingThrowBreakdown(c, [], 'Fortitude').notes ?? []).not.toContainEqual(expect.stringContaining('Purify Air'))
  c = { ...c, feats: c.feats.map(feat => feat.name === 'Leshy Familiar Secrets' ? { ...feat, choice: undefined } : feat),
    familiar: { ...c.familiar, leshySecret: 'Purify Air' } }
  expect(findToggle(StatusesContent({ c, entries: [], save }), 'Purify Air status')).toBeTypeOf('function')
  findToggle(StatusesContent({ c, entries: [], save }), 'Purify Air status')!({ target: { checked: false } })
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).not.toContain('Purify Air')
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

it('allows Protect Companion with only a familiar, including Calistria’s wasp', () => {
  let c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 5, className: 'Witch',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    spells: [{ name: 'Protect Companion', rank: 0, cantrip: true }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(protectCompanionTarget(c)?.familiar).toBe('primary')
  findToggle(ProtectCompanionOptions({ c, save }), 'Protect Companion active')!({ target: { checked: true } })
  expect(c.protectCompanionFamiliar).toBe('primary')
  expect(c.activeSpells).toContain('Protect Companion')
  c = { ...c, className: 'Druid', deity: 'Calistria', divineIntercessions: { Calistria: ['moderate-boon'] } }
  expect(protectCompanionTarget(c)?.familiar).toBe('wasp')
  findToggle(ProtectCompanionOptions({ c, save, familiarTarget: 'wasp' }), 'Protect Companion on Wasp Familiar')!
    ({ target: { checked: true } })
  expect(c.protectCompanionFamiliar).toBe('wasp')
})

it('shows Protect Companion details and an action control in statuses', () => {
  const c: Character = { id: 'protect', name: 'Test', systems: ['pf2e'], level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    activeSpells: ['Protect Companion'], companions: [{ id: 'one', type: 'Bear', name: '' }] }
  const spell: ContentEntry = { id: 'protect', name: 'Protect Companion', kind: 'spell', systems: ['pf2e'], source: 'official',
    level: 1, traits: ['Cantrip'], description: 'The target gains a circumstance bonus to AC.',
    data: { actions: 'Single Action' }, effects: [], updatedAt: 0 }
  const html = renderToStaticMarkup(<StatusesContent c={c} entries={[spell]} save={() => {}} />)
  expect(html).toContain('aria-haspopup="dialog">Protect Companion</button>')
  expect(html).toContain('The target gains a circumstance bonus to AC.')
  expect(html).toContain('aria-label="Protect Companion options"')
  expect(html).toContain('aria-label="Single Action"')
  expect(html).toContain('aria-label="Protect Companion active"')
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
  const html = renderToStaticMarkup(<StatusesContent c={c} entries={[entry]} save={save} />)
  expect(html).toContain('aria-haspopup="dialog">Bless</button>')
  expect(html).toContain('aria-label="Bless options"')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[entry]} save={save} />)).not.toContain('Bless')
  change({ target: { checked: true } })
  expect(c.activeSpells).toContain('Bless')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[entry]} save={save} />)).toContain('Bless')
  change({ target: { checked: false } })
  expect(c.activeSpells).not.toContain('Bless')
})

it('opens feat status details and action controls', () => {
  const feat: ContentEntry = { id: 'stratagem', name: 'Devise a Stratagem', systems: ['pf2e'], kind: 'classFeature',
    source: 'official', level: 1, traits: [], description: 'Plan an attack.', data: { actions: 'Single Action' },
    effects: [], updatedAt: 1 }
  const c: Character = { id: 'investigator', name: 'Test', systems: ['pf2e'], level: 1, className: 'Investigator',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const html = renderToStaticMarkup(<StatusesContent c={c} entries={[feat]} save={() => {}} />)
  expect(html).toContain('aria-haspopup="dialog">Devise a Stratagem</button>')
  expect(html).toContain('aria-label="Devise a Stratagem options"')
  expect(html).toContain('aria-label="Devise a Stratagem active"')
  expect(html).toContain('Plan an attack.')
})

it('toggles Summon Celestial status and tracks Summon Fiend with its active summon', () => {
  const lineage: ContentEntry = { id: 'angelkin', name: 'Angelkin', systems: ['pf2e'], kind: 'feat',
    source: 'official', level: 1, traits: ['Nephilim', 'Lineage'], description: '', data: {}, effects: [], updatedAt: 1 }
  const feat: ContentEntry = { ...lineage, id: 'summon-nephilim-kin', name: 'Summon Nephilim Kin', level: 13,
    traits: ['Nephilim'] }
  const celestial: ContentEntry = { ...lineage, id: 'summon-celestial', name: 'Summon Celestial', kind: 'spell',
    level: 5, traits: [], data: { actions: 'Three Actions' } }
  const fiend = { id: 'fiend', name: 'Test Fiend', level: 5, traits: ['Fiend'], url: '',
    abilities: [10, 10, 10, 10, 10, 10], saves: [0, 0, 0], senses: '', skills: '', speed: '',
    resistances: '', weaknesses: '', attacks: [] }
  let c: Character = { id: 'summons', name: 'Test', systems: ['pf2e'], level: 13, ancestry: 'Human', heritage: 'Nephilim',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Angelkin', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', sourceId: lineage.id },
      { name: 'Summon Nephilim Kin', type: 'Ancestry Feat', level: 13, slot: 'ancestry:13:0', sourceId: feat.id }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0, summonedFiend: fiend }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const entries = [lineage, feat, celestial]
  const celestialToggle = findToggle(StatusesContent({ c, entries, save }), 'Summon Celestial status')
  const fiendToggle = findToggle(StatusesContent({ c, entries, save }), 'Summon Fiend status')
  if (!celestialToggle || !fiendToggle) throw Error('Missing summon status toggle')
  celestialToggle({ target: { checked: true } })
  expect(c.activeSpells).toContain('Summon Celestial')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={entries} save={save} />)).toContain('Summon Fiend')
})

it('tracks Fulminating Shot element and level-scaled damage in Statuses', () => {
  let c: Character = { id: 'fulminating', name: 'Test', systems: ['pf2e'], level: 12,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [
      { name: 'Fulminating Shot', type: 'Archetype Feat', level: 6 },
    ], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const findControl = (node: ReactNode, tag: string, label: string): {
    onChange: (event: { target: { value?: string; checked?: boolean } }) => void
  } | undefined => {
    let result: { onChange: (event: { target: { value?: string; checked?: boolean } }) => void } | undefined
    Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === tag && child.props['aria-label'] === label)
        result = { onChange: child.props.onChange as (event: { target: { value?: string; checked?: boolean } }) => void }
      else result ??= findControl(child.props.children as ReactNode, tag, label)
    })
    return result
  }
  const select = findControl(StatusesContent({ c, entries: [], save }), 'select', 'Fulminating Shot element')
  if (!select) throw Error('Missing Fulminating Shot element selector')
  select.onChange({ target: { value: 'Fire' } })
  const toggle = findControl(StatusesContent({ c, entries: [], save }), 'input', 'Fulminating Shot status')
  if (!toggle) throw Error('Missing Fulminating Shot status toggle')
  toggle.onChange({ target: { checked: true } })
  expect(fulminatingShotBonus(c)).toBe('2d6 fire')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />))
    .toContain('Fulminating Shot (2d6 fire)')
})

it('tracks temporary Magic Warrior Mask flight and resistance effects', () => {
  let c: Character = { id: 'magic-warrior-status', name: 'Test', systems: ['pf2e'], level: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [
      { name: 'Sky Master Mask', type: 'Archetype Feat', level: 20 },
      { name: 'Thick Hide Mask', type: 'Archetype Feat', level: 20 },
    ], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const findInput = (node: ReactNode, label: string): {
    onChange: (event: { target: { checked: boolean } }) => void
  } | undefined => {
    let result: { onChange: (event: { target: { checked: boolean } }) => void } | undefined
    Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'input' && child.props['aria-label'] === label)
        result = { onChange: child.props.onChange as (event: { target: { checked: boolean } }) => void }
      else result ??= findInput(child.props.children as ReactNode, label)
    })
    return result
  }
  const flight = findInput(StatusesContent({ c, entries: [], save }), 'Sky Master Mask doubled flight')
  if (!flight) throw Error('Missing Sky Master Mask status control')
  flight.onChange({ target: { checked: true } })
  const resistance = findInput(StatusesContent({ c, entries: [], save }), 'Thick Hide Mask resistance active')
  if (!resistance) throw Error('Missing Thick Hide Mask status control')
  resistance.onChange({ target: { checked: true } })
  expect(c.activeFeatEffects).toEqual(['Sky Master Mask', 'Thick Hide Mask'])
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
  expect(content).toContain('aria-label="Poison Weapon uses remaining">5/8</output>')
  expect(content).not.toContain('Spend poison use')
  expect(content).not.toContain('poison damage')
  const summary = renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={() => {}} />)
  expect(summary).not.toContain('Simple poisons')
  expect(summary).toContain('Poison Weapon 5/8')
  expect(renderToStaticMarkup(<StatusesSummary c={{ ...c, poisonWeaponActive: true }} entries={[]} save={() => {}} />))
    .toContain('Poison Weapon 5/8 (active)')
})

it('renders each available status in its own alphabetical row', () => {
  const c: Character = { id: 'statuses', name: 'Test', systems: ['pf2e'], level: 20, className: 'Barbarian',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    activeSpells: ['Tailwind', 'Protect Companion', 'Enduring Might'], zealousConvictionRank: 9,
    companions: [{ id: 'bear', name: 'Bear', type: 'Bear' }] }
  const markup = renderToStaticMarkup(<StatusesContent c={c} entries={[]} save={() => {}} />)
  expect(markup.match(/class="status-row"/g)).toHaveLength(10)
  const labels = ['Active stance', 'Doomed status', 'Enduring Might status', 'Enfeebled status', 'Frightened status',
    'Protect Companion active', 'Rage active (defense)', 'Sickened status', 'Tailwind status', 'Zealous Conviction active on self']
  const positions = labels.map(label => markup.indexOf(label))
  expect(positions.every(position => position >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
  const summary = renderToStaticMarkup(<StatusesSummary c={{ ...c, raging: true, conditions: { frightened: 2, enfeebled: 1 } }} entries={[]} save={() => {}} />)
  expect(summary).toContain('Enduring Might, Enfeebled 1, Frightened 2, Protect Companion, Rage, Tailwind, Zealous Conviction')
})

it('lists raised shield, Shield cantrip, Bone Shield and Parry in Statuses', () => {
  const spell = (name: string, traits: string[] = []): ContentEntry => ({ id: name, systems: ['pf2e'], kind: 'spell', source: 'official',
    name, level: 1, traits, description: '', data: {}, effects: [], updatedAt: 0 })
  const c: Character = { id: 'def', name: 'Test', systems: ['pf2e'], level: 1, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [], equipment: [], lores: [], languages: [],
    entryIds: [], extraSlots: [], updatedAt: 0, spells: [{ name: 'Shield', rank: 1, cantrip: true }] }
  const entries = [spell('Shield', ['Cantrip'])]
  const save = () => {}
  expect(findToggle(StatusesContent({ c, entries, save }), 'Raise Shield Cantrip status')).toBeTypeOf('function')
  const active = { ...c, activeSpells: ['Shield'] }
  expect(renderToStaticMarkup(StatusesSummary({ c: active, entries, save }))).toContain('Raise Shield Cantrip')
  const bone = { ...c, activeSpells: ['Bone Shield'], boneShieldRaised: true }
  expect(findToggle(StatusesContent({ c: bone, entries, save }), 'Raise Bone Shield status')).toBeTypeOf('function')
  expect(renderToStaticMarkup(StatusesSummary({ c: bone, entries, save }))).toContain('Raise Bone Shield')
})
