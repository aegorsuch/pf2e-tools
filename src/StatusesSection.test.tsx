import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, onTestFinished } from 'vitest'
import { activeBattleForm, favoredTerrainBenefits, movementSpeeds, protectCompanionApplies, protectCompanionTarget, savingThrowBreakdown, temporaryHpGrant } from './builder'
import { DeviseAStratagemToggle, HuntPreyToggle, StatusesContent, StatusesSummary } from './StatusesSection'
import { ProtectCompanionOptions, SpiritOfTheBeastOptions, ZealousConvictionToggle } from './SpellsSection'
import { SearchableSelect } from './SearchableSelect'
import { fulminatingShotBonus } from './fulminatingShot'
import type { Character, ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'
import { ANCESTRAL_AVATAR } from './battleForms'
import { FavoredTerrainSelector, SkillsSection } from './SkillsSection'

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

function findButton(node: ReactNode, label: string): (() => void) | undefined {
  let result: (() => void) | undefined
  Children.forEach(node, child => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    result = child.type === 'button' && child.props['aria-label'] === label
      ? () => (child.props.onClick as (event: { preventDefault: () => void; stopPropagation: () => void }) => void)(
        { preventDefault() {}, stopPropagation() {} })
      : findButton(child.props.children as ReactNode, label)
  })
  return result
}

function findSelect(node: ReactNode, label: string): ((event: { target: { value: string } }) => void) | undefined {
  let result: ((event: { target: { value: string } }) => void) | undefined
  Children.forEach(node, child => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    result = (child.type === 'select' || child.type === SearchableSelect) && child.props['aria-label'] === label
      ? child.props.onChange as typeof result
      : findSelect(child.props.children as ReactNode, label)
  })
  return result
}

it('changes favored terrain from statuses only after gaining Terrain Master', () => {
  let c: Character = { id: 'terrain-status', name: 'Test', systems: ['pf2e'], level: 11, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Favored Terrain', type: 'Class Feat', level: 2, choice: 'Plains' },
      { name: 'Terrain Master', type: 'Class Feat', level: 8 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const render = () => renderToStaticMarkup(<StatusesContent c={c} entries={[]} save={save} />)
  expect(render()).toContain('aria-label="Favored Terrain status terrain"')
  expect(render()).not.toContain('aria-label="Favored Terrain options"')
  expect(render()).not.toMatch(/Favored Terrain<\/button>\s*<label>Favored Terrain/)
  expect(render()).toMatch(/aria-label="Favored Terrain status" disabled="" checked=""/)
  const selector = FavoredTerrainSelector({ c, save, status: true })!
  const select = Children.toArray(selector.props.children).find(child => isValidElement(child) && child.type === 'select')
  if (!isValidElement<{ onChange: (event: { target: { value: string } }) => void }>(select)) throw Error('Missing terrain selector')
  select.props.onChange({ target: { value: 'Aquatic' } })
  expect(favoredTerrainBenefits(c, [])?.terrain).toBe('Aquatic')
  expect(render()).toContain('<option selected="">Aquatic</option>')
  c = { ...c, favoredTerrain: 'Forest' }
  expect(render()).toContain('<option selected="">Forest</option>')
  c = { ...c, favoredTerrain: undefined, feats: c.feats.map(feat =>
    feat.name === 'Favored Terrain' ? { ...feat, choice: 'Invalid' } : feat) }
  expect(render()).toContain('<option value="" selected="">Choose terrain</option>')
  c = { ...c, feats: c.feats.map(feat => feat.name === 'Favored Terrain' ? { ...feat, choice: undefined } : feat) }
  expect(render()).toContain('<option value="" selected="">Choose terrain</option>')
  c = { ...c, level: 7 }
  expect(render()).not.toContain('aria-label="Favored Terrain status terrain"')
  expect(render()).not.toMatch(/aria-label="Favored Terrain status"[^>]*disabled/)
  c = { ...c, level: 11, feats: c.feats.filter(feat => feat.name !== 'Favored Terrain') }
  expect(render()).not.toContain('aria-label="Favored Terrain status terrain"')
})

it('switches Crimson Claw between Fire and Slashing from Statuses', () => {
  let c: Character = { id: 'crimson-status', name: 'Test', systems: ['sf2e'], level: 1, feats: [],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    weapons: [{ id: 'crimson-claw', name: 'Crimson Claw', potency: 0, striking: 0, runes: [] }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const entry: ContentEntry = { id: 'crimson-claw', name: 'Crimson Claw', systems: ['sf2e'], kind: 'weapon',
    source: 'official', level: 1, traits: [], description: '', effects: [], updatedAt: 0,
    data: { damage: '2d6 fire', hands: 1, weapon_type: 'Melee', weapon_category: 'Advanced' },
    weaponModes: [
      { id: 'mode-1', damageType: 'fire', traits: ['Powered'] },
      { id: 'mode-2', damageType: 'slashing', traits: ['Analog'] },
    ] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const toggle = findToggle(StatusesContent({ c, entries: [entry], save }), 'Crimson Claw mode status: Crimson Claw')!
  toggle({ target: { checked: false } })
  expect(c.weapons![0].weaponMode).toBe('mode-2')
  expect(renderToStaticMarkup(<StatusesContent c={c} entries={[entry]} save={save} />))
    .toContain('Crimson Claw: Slashing')
})

it.each([['Ranger', undefined], ['Ranger', 'Vindication'], ['Rogue', 'Avenger']] as const)(
  'shows Hunt Prey rules and retains the status toggle for %s', (className, subclass) => {
    let c: Character = { id: 'hunt-prey', name: 'Test', systems: ['pf2e'], level: 4, className, subclass,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
      equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
    const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
    const tree = () => HuntPreyToggle({ c, entries: [], save })
    const markup = renderToStaticMarkup(tree())
    expect(markup).toContain('aria-haspopup="dialog">Hunt Prey')
    expect(markup).toContain('Survival checks to Track it')
    expect(markup).toContain('until your next daily preparations')
    const header = renderToStaticMarkup(<HuntPreyToggle c={c} entries={[]} save={save} summary />)
    expect(header).toContain('aria-haspopup="dialog">Hunt Prey')
    expect(header).toContain('Survival checks to Track it')
    findToggle(tree(), 'Hunt Prey active')!({ target: { checked: true } })
    expect(c.huntPreyActive).toBe(true)
    expect(renderToStaticMarkup(tree())).toMatch(/aria-label="Hunt Prey active" checked=""/)
    findToggle(tree(), 'Hunt Prey active')!({ target: { checked: false } })
    expect(c.huntPreyActive).toBe(false)
  })

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

it('applies cursed weakness doomed only when its damage is reported', () => {
  let c: Character = { id: 'warrior', name: 'Test', systems: ['pf2e'], level: 1, className: 'Fighter',
    subclass: 'Warrior of Legend', warriorLegendDamageType: 'Piercing',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const button = () => {
    let result: { onClick: () => void; disabled?: boolean } | undefined
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'button' && child.props['aria-label'] === 'Took piercing damage')
        result = child.props as typeof result
      else visit(child.props.children as ReactNode)
    })
    visit(StatusesContent({ c, entries: [], save }))
    return result
  }
  for (const doomed of [0, 1, 2, 3]) {
    c = { ...c, conditions: { doomed, frightened: 1 } }
    expect(button()?.disabled).toBe(doomed >= 2)
    button()!.onClick()
    expect(c.conditions).toEqual({ doomed: Math.max(doomed, 2), frightened: 1 })
  }
  c = { ...c, subclass: undefined }
  expect(button()).toBeUndefined()
})

it('shows clickable Heroic Defiance and Zealous Conviction with status checkboxes', () => {
  const entry = (kind: 'feat' | 'spell', name: string): ContentEntry => ({
    id: name, name, kind, systems: ['pf2e'], source: 'official', level: 1, traits: [],
    description: `${name} rules`, data: { actions: kind === 'feat' ? 'Reaction' : 'Two Actions' }, effects: [], updatedAt: 0,
  })
  const entries = [entry('feat', 'Heroic Defiance'), entry('feat', 'Heroic Presence'), entry('spell', 'Zealous Conviction')]
  let c: Character = { id: 'heroic-status', name: 'Test', systems: ['pf2e'], level: 20, className: 'Fighter',
    subclass: 'Warrior of Legend', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Heroic Defiance', type: 'Class Feat', level: 4 },
      { name: 'Heroic Presence', type: 'Class Feat', level: 12 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => StatusesContent({ c, entries, save })
  const markup = renderToStaticMarkup(tree())
  for (const name of ['Heroic Defiance', 'Zealous Conviction']) {
    expect(markup).toContain(`aria-haspopup="dialog">${name}</button>`)
    expect(markup).toContain(`aria-label="${name} options"`)
  }
  findToggle(tree(), 'Heroic Defiance active')!({ target: { checked: true } })
  findToggle(tree(), 'Zealous Conviction active on self')!({ target: { checked: true } })
  expect(c.activeFeatEffects).toContain('Heroic Defiance')
  expect(c.zealousConvictionRank).toBe(10)
  expect(renderToStaticMarkup(tree())).toMatch(/aria-label="Heroic Defiance active" checked=""/)
  expect(renderToStaticMarkup(tree())).toMatch(/aria-label="Zealous Conviction active on self" checked=""/)
  findToggle(tree(), 'Heroic Defiance active')!({ target: { checked: false } })
  findToggle(tree(), 'Zealous Conviction active on self')!({ target: { checked: false } })
  expect(c.activeFeatEffects).not.toContain('Heroic Defiance')
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
  const html = renderToStaticMarkup(<StatusesContent c={c} entries={[]} save={save} />)
  expect(html).toContain('aria-haspopup="dialog">Purify Air</button>')
  expect(html).toContain('Recycles air for one Medium creature')
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

it('includes Harden Flesh in the active summary only while the feat is active', () => {
  const c: Character = { id: 'druid', name: 'Test', systems: ['pf2e'], level: 10, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Harden Flesh', type: 'Class Feat', level: 10 }], hardenFleshActive: true,
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={() => {}} />)).toContain('Harden Flesh')
  expect(renderToStaticMarkup(<StatusesSummary c={{ ...c, feats: [] }} entries={[]} save={() => {}} />)).not.toContain('Harden Flesh')
  expect(renderToStaticMarkup(<StatusesSummary c={{ ...c, hardenFleshActive: false }} entries={[]} save={() => {}} />)).not.toContain('Harden Flesh')
})

it('toggles Ancestral Embrace Avatar in statuses and reports its active form', () => {
  let c: Character = { id: 'avatar', name: 'Test', systems: ['pf2e'], level: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    armors: [{ id: 'armor', name: 'Ancestral Embrace Hide Armor', worn: true, potency: 0, resilient: 0, runes: [] }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const content = () => StatusesContent({ c, entries: [], save })
  expect(renderToStaticMarkup(content())).toContain('aria-label="Avatar status"')
  findToggle(content(), 'Avatar status')!({ target: { checked: true } })
  expect(activeBattleForm(c, [])).toMatchObject({ source: ANCESTRAL_AVATAR, speed: 70, ac: 45, attack: 33 })
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).toContain('>Avatar</span>')
  findToggle(content(), 'Avatar status')!({ target: { checked: false } })
  expect(activeBattleForm(c, [])).toBeUndefined()
  c = { ...c, activeSpells: [ANCESTRAL_AVATAR], armors: [{ ...c.armors![0], worn: false }] }
  expect(renderToStaticMarkup(content())).not.toContain('aria-label="Avatar status"')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).not.toContain('Avatar')
})

it('synchronizes Protect Companion target and active state', () => {
  const previous = getSettings().protectCompanionAll
  onTestFinished(() => updateSettings({ protectCompanionAll: previous }))
  updateSettings({ protectCompanionAll: false })
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
  const previous = getSettings().protectCompanionAll
  onTestFinished(() => updateSettings({ protectCompanionAll: previous }))
  updateSettings({ protectCompanionAll: false })
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

it('activates Protect Companion without a selectable target and preserves its saved target', () => {
  const previous = getSettings().protectCompanionAll
  onTestFinished(() => updateSettings({ protectCompanionAll: previous }))
  updateSettings({ protectCompanionAll: true })
  let c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    spells: [{ name: 'Protect Companion', rank: 0, cantrip: true }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    protectCompanionId: 'bear' }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(renderToStaticMarkup(<ProtectCompanionOptions c={c} save={save} />)).not.toContain('disabled=""')
  findToggle(ProtectCompanionOptions({ c, save }), 'Protect Companion active')!({ target: { checked: true } })
  expect(c.protectCompanionId).toBe('bear')
  expect(protectCompanionApplies(c, [])).toBe(true)
  c = { ...c, companions: [{ id: 'bear', name: 'Bear', type: 'Bear' }, { id: 'wolf', name: 'Wolf', type: 'Wolf' }] }
  expect(renderToStaticMarkup(<ProtectCompanionOptions c={c} save={save} />)).not.toContain('Protect Companion target')
  expect(protectCompanionApplies(c, [], { companionId: 'wolf' })).toBe(true)
  updateSettings({ protectCompanionAll: false })
  expect(protectCompanionApplies(c, [], { companionId: 'bear' })).toBe(true)
  expect(protectCompanionApplies(c, [], { companionId: 'wolf' })).toBe(false)
  expect(protectCompanionApplies(c, [])).toBe(false)
  expect(renderToStaticMarkup(<ProtectCompanionOptions c={c} save={save} />)).toContain('Protect Companion target')
  updateSettings({ protectCompanionAll: true })
  expect(protectCompanionApplies(c, [], { companionId: 'wolf' })).toBe(true)
  expect(protectCompanionApplies({ ...c, spells: [] }, [])).toBe(false)
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
  const fiendToggle = findToggle(StatusesContent({ c, entries, save }), 'Summon Fiend status')
  if (!fiendToggle) throw Error('Missing summon status toggle')
  const castToggle = findToggle(StatusesContent({ c, entries, save }), 'Summon Celestial status')
  if (!castToggle) throw Error('Missing cast Summon Celestial status toggle')
  castToggle({ target: { checked: true } })
  expect(c.activeSpells).toContain('Summon Celestial')
  c = { ...c, summonedFiend: { ...fiend, traits: ['Celestial'] } }
  const celestialToggle = findToggle(StatusesContent({ c, entries, save }), 'Summon Celestial status')
  if (!celestialToggle) throw Error('Missing celestial status toggle')
  c = { ...c, summonedFiend: fiend }
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
  expect(markup).toContain('aria-haspopup="dialog">Entrench Melee</button>')
  expect(markup).toContain('a +2 circumstance bonus to AC against melee attacks until the start of your next turn')
  expect(markup).toContain('aria-label="Entrench Melee options"')
  expect(markup).toContain('aria-label="Single Action"')
  expect(markup).not.toContain('Entrench Melee: Immortal Bastion Plate')
  findToggle(StatusesContent({ c, entries, save }), 'Entrench Melee active: Immortal Bastion Plate')!({ target: { checked: true } })
  expect(c.armors?.[0].entrenchMeleeActive).toBe(true)
  const summary = StatusesSummary({ c, entries, save })
  expect(renderToStaticMarkup(summary)).toContain('Entrench Melee')
  findButton(summary, 'Entrench Melee')!()
  expect(c.armors?.[0].entrenchMeleeActive).toBe(false)
})

it('toggles Parry with one control that includes its AC bonus', () => {
  const weapon: ContentEntry = { id: 'parrying-weapon', name: 'Parrying Weapon', systems: ['pf2e'], kind: 'weapon',
    source: 'official', level: 1, traits: ['Parry'], description: '', data: { weapon_type: 'Melee', hands: 2 },
    effects: [], updatedAt: 1 }
  let c: Character = { id: 'parry-status', name: 'Test', systems: ['pf2e'], level: 2, className: 'Fighter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Raise Haft', type: 'Class Feat', level: 2 }],
    equipment: [], weapons: [{ id: weapon.id, name: weapon.name, potency: 0, striking: 0, runes: [] }],
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const content = StatusesContent({ c, entries: [weapon], save })
  const markup = renderToStaticMarkup(content)
  expect(markup).toContain('aria-label="Parry active"')
  expect(markup).toContain('aria-label="Single Action"')
  expect(markup).toContain('(+2 AC)')
  expect(markup).not.toContain('✓')
  findToggle(content, 'Parry active')!({ target: { checked: true } })
  expect(c.parrying).toBe(true)
  const activeMarkup = renderToStaticMarkup(StatusesContent({ c, entries: [weapon], save }))
  expect(activeMarkup).toContain('aria-label="Parry active" checked=""')
})

it('locks Parry on for Whirlwind Stance while wielding a parry staff', () => {
  const stance: ContentEntry = { id: 'whirlwind', name: 'Whirlwind Stance', systems: ['pf2e'], kind: 'feat',
    source: 'official', level: 10, traits: ['Archetype', 'Flourish', 'Stance'],
    description: 'You gain a +2 circumstance bonus to AC while in this stance.', data: {}, effects: [], updatedAt: 0 }
  const staff: ContentEntry = { id: 'staff', name: 'Bo Staff', systems: ['pf2e'], kind: 'weapon',
    source: 'official', level: 1, traits: ['Parry'], description: '', data: { weapon_type: 'Melee', hands: 2 },
    effects: [], updatedAt: 0 }
  const c: Character = { id: 'whirlwind-status', name: 'Test', systems: ['pf2e'], level: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: stance.name, type: 'Archetype Feat', level: 10 }], activeStance: stance.name,
    weapons: [{ id: staff.id, name: staff.name, potency: 0, striking: 0, runes: [] }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<StatusesContent c={c} entries={[stance, staff]} save={() => {}} />)
  expect(markup).toMatch(/aria-label="Parry active" disabled="" checked=""/)
  expect(markup).toContain('aria-label="Parry options"')
  expect(markup).toContain('Current bonus: +2 circumstance bonus to AC')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[stance, staff]} save={() => {}} />))
    .toContain('Parry')
})

it('locks Parry on for Whirlwind Stance with a parry spear under the spear house rule', () => {
  const stance: ContentEntry = { id: 'whirlwind-spear', name: 'Whirlwind Stance', systems: ['pf2e'], kind: 'feat',
    source: 'official', level: 10, traits: ['Archetype', 'Flourish', 'Stance'], description: '', data: {}, effects: [], updatedAt: 0 }
  const spear: ContentEntry = { id: 'spear', name: 'Spear', systems: ['pf2e'], kind: 'weapon',
    source: 'official', level: 1, traits: ['Parry'], description: '',
    data: { weapon_type: 'Melee', weapon_group: 'Spear', hands: 2 }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'whirlwind-spear-status', name: 'Test', systems: ['pf2e'], level: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: stance.name, type: 'Archetype Feat', level: 10 }], activeStance: stance.name,
    weapons: [{ id: spear.id, name: spear.name, potency: 0, striking: 0, runes: [] }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const previous = getSettings().staffAcrobatSpear
  try {
    updateSettings({ staffAcrobatSpear: true })
    const markup = renderToStaticMarkup(<StatusesContent c={c} entries={[stance, spear]} save={() => {}} />)
    expect(markup).toMatch(/aria-label="Parry active" disabled="" checked=""/)
  } finally {
    updateSettings({ staffAcrobatSpear: previous })
  }
})

it('makes active spells and Rage clickable in the status header', () => {
  const content = (name: string, kind: ContentEntry['kind']): ContentEntry => ({
    id: name, name, systems: ['pf2e'], kind, source: 'official', level: 1, traits: [],
    description: `${name} rules.`, data: {}, effects: [], updatedAt: 0,
  })
  const entries = [
    content('Rage', 'classFeature'), content('Oaken Resilience', 'spell'),
    content('Zealous Conviction', 'spell'), content('Avatar', 'spell'),
  ]
  const c: Character = { id: 'status-learn-more', name: 'Test', systems: ['pf2e'], level: 10, className: 'Barbarian',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [], raging: true,
    activeSpells: ['Oaken Resilience', 'Avatar'], zealousConvictionRank: 5,
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<StatusesSummary c={c} entries={entries} save={() => {}} />)
  for (const name of ['Rage', 'Oaken Resilience', 'Zealous Conviction', 'Avatar']) {
    expect(markup).toContain(`aria-haspopup="dialog">${name}</button>`)
  }
})

it('deactivates selected Statuses from the summary header', () => {
  let c: Character = { id: 'status-header', name: 'Test', systems: ['pf2e'], level: 10, className: 'Fighter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Stalwart Defender Dedication', type: 'Class Feat', level: 2 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    activeSpells: ['Cairn Form', 'Mountain Resilience'], activeStance: 'Tenacious Stance' }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  for (const name of ['Cairn Form', 'Mountain Resilience']) {
    const button = findButton(StatusesSummary({ c, entries: [], save }), name)
    expect(button).toBeTypeOf('function')
    button!()
    expect(c.activeSpells).not.toContain(name)
  }
  const stance = findButton(StatusesSummary({ c, entries: [], save }), 'Tenacious Stance')
  expect(stance).toBeTypeOf('function')
  stance!()
  expect(c.activeStance).toBeUndefined()
})

it('tracks Badger Rage in Statuses on Badger companions only', () => {
  let c: Character = { id: 'badger-status', name: 'Test', systems: ['pf2e'], level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'badger', name: 'Bristle', type: 'Badger' }, { id: 'horse', name: 'Buddy', type: 'Horse' }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const content = StatusesContent({ c, entries: [], save })
  const markup = renderToStaticMarkup(content)
  expect(markup).toContain('aria-label="Badger Rage on Bristle"')
  expect(markup).toContain('aria-label="Single Action"')
  expect(markup).toContain('Badger Rage</button>')
  expect(renderToStaticMarkup(content)).not.toContain('Badger Rage on Buddy')
  findButton(content, 'Badger Rage on Bristle')!()
  expect(c.companions?.[0].badgerRageActive).toBe(true)
  expect(c.companions?.[1].badgerRageActive).toBeUndefined()
  const summary = StatusesSummary({ c, entries: [], save })
  expect(renderToStaticMarkup(summary)).toContain('Badger Rage (Bristle)</button>')
  findButton(summary, 'Badger Rage (Bristle)')!()
  expect(c.companions?.[0].badgerRageActive).toBe(false)
})

it('shows Mounted and Spirit of the Beast in Statuses for eligible companions', () => {
  const spell: ContentEntry = { id: 'spirit', name: 'Spirit of the Beast', kind: 'spell', systems: ['pf2e'],
    source: 'official', level: 2, traits: ['Focus'], description: '', data: { actions: 'Single Action' }, effects: [], updatedAt: 0 }
  let c: Character = { id: 'companion-statuses', name: 'Test', systems: ['pf2e'], level: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Cavalier Dedication', type: 'Archetype Feat', level: 2 }],
    spells: [{ name: spell.name, rank: 2, cantrip: false }],
    companions: [{ id: 'bear', type: 'Bear', name: 'Bristle' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const entries = [spell]
  const content = () => StatusesContent({ c, entries, save })
  expect(renderToStaticMarkup(content())).toContain('aria-label="Mounted on Bristle"')
  expect(renderToStaticMarkup(content())).toContain('aria-label="Spirit of the Beast aspect on Bristle"')
  findToggle(content(), 'Mounted on Bristle')!({ target: { checked: true } })
  expect(c.mountedCompanionId).toBe('bear')
  expect(renderToStaticMarkup(<StatusesSummary c={c} entries={entries} save={save} />))
    .toContain('Mounted (Bristle)</button>')
  findButton(StatusesSummary({ c, entries, save }), 'Mounted (Bristle)')!()
  expect(c.mountedCompanionId).toBeUndefined()

  expect(renderToStaticMarkup(SpiritOfTheBeastOptions({ c, save, companionId: 'bear' })))
    .toContain('aria-label="Spirit of the Beast aspect on Bristle"')
  findSelect(SpiritOfTheBeastOptions({ c, save, companionId: 'bear' }), 'Spirit of the Beast aspect on Bristle')!
    ({ target: { value: 'Might' } })
  expect(c.companions?.[0].spiritAspect).toBe('Might')
  const summary = StatusesSummary({ c, entries, save })
  expect(renderToStaticMarkup(summary)).toContain('Spirit of the Beast (Bristle: Aspect of Might)</button>')
  findButton(summary, 'Spirit of the Beast (Bristle: Aspect of Might)')!()
  expect(c.companions?.[0].spiritAspect).toBeUndefined()
  expect(renderToStaticMarkup(StatusesContent({ c: { ...c, spells: [] }, entries, save })))
    .not.toContain('Spirit of the Beast aspect on Bristle')
})

it('shows Heroism in Statuses with a clickable two-action icon', () => {
  let c: Character = { id: 'heroism-status', name: 'Test', systems: ['pf2e'], level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    spells: [{ name: 'Heroism', rank: 3, cantrip: false }] }
  const heroism: ContentEntry = { id: 'heroism', name: 'Heroism', systems: ['pf2e'], kind: 'spell',
    source: 'official', level: 3, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const content = StatusesContent({ c, entries: [heroism], save })
  const markup = renderToStaticMarkup(content)
  expect(markup).toContain('aria-label="Heroism options"')
  expect(markup).toContain('aria-label="Two Actions"')
  findToggle(content, 'Heroism status')!({ target: { checked: true } })
  expect(c.activeSpells).toContain('Heroism')
})

it.each(['Breastplate of the Mountain', 'Full Plate of the Mountain', 'Bastion Plate of the Mountain'])(
  'tracks %s poison immunity through use, removal, and daily preparations', name => {
    let c: Character = { id: 'mountain', name: 'Test', systems: ['pf2e'], level: 20,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
      equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
      armors: [{ id: 'mountain', name, worn: true, potency: 0, resilient: 0, runes: ['Custom Rune'] }] }
    const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
    const content = () => StatusesContent({ c, entries: [], save })
    const label = `Poison immunity: ${name} status`
    findToggle(content(), label)!({ target: { checked: true } })
    expect(c.armors?.[0]).toMatchObject({ mountainPoisonImmunityActive: true, mountainPoisonImmunityUsed: true, runes: ['Custom Rune'] })
    expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).toContain('Poison Immunity')
    expect(renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={save} part="defense" />)).toContain('Immunity: Poison')
    c = { ...c, armors: c.armors!.map(armor => ({ ...armor, worn: false })) }
    expect(renderToStaticMarkup(content())).toContain('checked=""')
    findToggle(content(), label)!({ target: { checked: false } })
    expect(renderToStaticMarkup(content())).toContain(`aria-label="${label}" disabled=""`)
    expect(renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={save} part="defense" />)).not.toContain('Immunity: Poison')
    c = { ...c, armors: c.armors!.map(armor => ({ ...armor, worn: true })) }
    expect(renderToStaticMarkup(content())).toContain(`aria-label="${label}" disabled=""`)
    let reset: (() => void) | undefined
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'button' && child.props['aria-label'] === `Reset ${name} poison immunity`)
        reset = child.props.onClick as () => void
      else visit(child.props.children as ReactNode)
    })
    visit(content())
    expect(reset).toBeTypeOf('function')
    reset!()
    expect(c.armors?.[0]).toMatchObject({ mountainPoisonImmunityUsed: false, mountainPoisonImmunityActive: false })
    expect(renderToStaticMarkup(content())).not.toContain(`aria-label="${label}" disabled=""`)
  })

it.each(['Incendiary Breastplate', 'Incendiary Full Plate', 'Incendiary Bastion Plate'])(
  'tracks %s Living Flame activation and daily use', name => {
    let c: Character = { id: 'flame', name: 'Test', systems: ['pf2e'], level: 20,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
      equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
      armors: [{ id: 'flame', name, worn: true, potency: 0, resilient: 0, runes: ['Custom Rune'] }] }
    const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
    const content = () => StatusesContent({ c, entries: [], save })
    const label = `Living Flame: ${name} status`
    findToggle(content(), label)!({ target: { checked: true } })
    expect(c.armors?.[0]).toMatchObject({ livingFlameActive: true, livingFlameUsed: true, runes: ['Custom Rune'] })
    expect(renderToStaticMarkup(<StatusesSummary c={c} entries={[]} save={save} />)).toContain('Living Flame')
    const html = renderToStaticMarkup(content())
    expect(html).toContain('aria-label="Living Flame options"')
    expect(html).toContain('>Living Flame</button>')
    expect(html).not.toContain(`>Living Flame: ${name}</button>`)
    expect(html).toContain('aria-label="Roll Living Flame: Damage"')
    expect(html).toContain(`aria-label="Restore ${name} Living Flame use 1"`)
    expect(html).not.toContain('Daily preparations')
    let reset: (() => void) | undefined
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'button' && child.props['aria-label'] === `Restore ${name} Living Flame use 1`)
        reset = child.props.onClick as () => void
      else visit(child.props.children as ReactNode)
    })
    visit(content())
    expect(reset).toBeTypeOf('function')
    reset!()
    expect(c.armors?.[0]).toMatchObject({ livingFlameUsed: false, livingFlameActive: true })
    findToggle(content(), label)!({ target: { checked: false } })
    expect(c.armors?.[0]).toMatchObject({ livingFlameUsed: false, livingFlameActive: false })
    expect(renderToStaticMarkup(content())).toContain(`aria-label="Spend ${name} Living Flame use 1"`)
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
  let saved: Partial<Character> = {}
  const save = (change: Partial<Character>) => { saved = { ...saved, ...change } }
  const content = StatusesContent({ c, entries, save })
  const cantripToggle = findToggle(content, 'Raise Shield Cantrip status')
  expect(cantripToggle).toBeTypeOf('function')
  expect(findToggle(content, 'Shield status')).toBeUndefined()
  cantripToggle!({ target: { checked: true } })
  expect(saved.activeSpells).toEqual(['Shield'])
  const active = { ...c, activeSpells: ['Shield'] }
  const summary = renderToStaticMarkup(StatusesSummary({ c: active, entries, save }))
  expect(summary).toContain('Raise Shield Cantrip (+1 AC)')
  expect(summary.match(/Shield/g)).toHaveLength(1)
  const bone = { ...c, activeSpells: ['Bone Shield'], boneShieldRaised: true }
  expect(findToggle(StatusesContent({ c: bone, entries, save }), 'Raise Bone Shield status')).toBeTypeOf('function')
  expect(renderToStaticMarkup(StatusesSummary({ c: bone, entries, save }))).toContain('Raise Bone Shield')
})

it('activates armor Jetpack and Force Field from Statuses with movement and HP values', () => {
  const jacket: ContentEntry = { id: 'drifters-jacket', name: "Drifter's Jacket", kind: 'armor', systems: ['sf2e'],
    source: 'official', level: 10, traits: [], description: '', data: { armor_category: 'Light', upgrade_slots: 1 },
    effects: [], updatedAt: 0 }
  const module = (name: string, level: number): ContentEntry => ({ id: name, name, kind: 'item', systems: ['sf2e'],
    source: 'official', level, traits: [], description: '', data: { item_subcategory: 'Armor Upgrades' }, effects: [], updatedAt: 0 })
  const entries = [jacket, module('Jetpack (Tactical)', 19), module('Force Field (Paragon)', 19)]
  let c: Character = { id: 'armor-devices', name: 'Test', systems: ['sf2e'], level: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    armors: [{ id: jacket.id, name: jacket.name, potency: 0, resilient: 0, runes: [], worn: true }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const activateJetpack = findButton(StatusesContent({ c, entries, save }), 'Activate Jetpack (Tactical)')
  expect(activateJetpack).toBeTypeOf('function')
  activateJetpack!()
  expect(c.armors?.[0].activeJetpack).toBe('automatic:jetpack')
  expect(movementSpeeds(c, entries).find(speed => speed.name === 'Fly')).toMatchObject({
    feet: 40, source: 'Jetpack (Tactical)',
  })
  expect(renderToStaticMarkup(StatusesContent({ c, entries, save }))).toContain('aria-label="Dismiss Jetpack (Tactical)"')

  const activateForceField = findButton(StatusesContent({ c, entries, save }), 'Activate Force Field (Paragon)')
  expect(activateForceField).toBeTypeOf('function')
  activateForceField!()
  expect(temporaryHpGrant(c, entries)?.value).toBe(42)
  expect(renderToStaticMarkup(StatusesSummary({ c, entries, save }))).toContain('Force Field (+42 HP)')
  const activeStatuses = renderToStaticMarkup(StatusesContent({ c, entries, save }))
  expect(activeStatuses).toContain('aria-label="Dismiss Force Field (Paragon)"')
  expect(activeStatuses).toContain('<span aria-hidden="true">✓</span>')

  findButton(StatusesContent({ c, entries, save }), 'Dismiss Force Field (Paragon)')!()
  expect(c.armors?.[0].activeForceField).toBe(false)
  expect(temporaryHpGrant(c, entries)).toBeUndefined()
})
