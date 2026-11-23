import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { activeStance, availableStances, intensifiedElementDamage, starfinderArmorPenalties, temporaryHpGrant, tenaciousStanceHasArmor } from './builder'
import { EntryDescription } from './EntryDescription'
import { featDisplayName } from './featChoices'
import { FeatSlots } from './FeatSlots'
import { StancesContent, StancesSummary } from './StancesSection'
import { SpellsSection } from './SpellsSection'
import { getSettings, updateSettings } from './settings'
import type { Character, ContentEntry } from './types'

const stance = (name: string, level = 1, traits = ['Stance']): ContentEntry => ({
  id: name, name, level, traits, kind: 'feat', systems: ['pf2e'], source: 'official',
  description: `Rules for ${name}.`, data: {}, effects: [], updatedAt: 0,
})
const base: Character = {
  id: 'stances', systems: ['pf2e'], name: 'Test', level: 16, className: 'Fighter',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const learn = (entry: ContentEntry): Character['feats'][number] => ({
  name: entry.name, type: 'Class Feat', level: entry.level, sourceId: entry.id,
})

it('summarizes available stance count and the active stance without counting future selections', () => {
  const entries = [stance('Foeseeker Stance'), stance('Tiger Stance'), stance('Future Stance', 18)]
  const c = { ...base, feats: entries.map(learn) }
  const render = (character: Character) => renderToStaticMarkup(<StancesSummary c={character} entries={entries} save={() => {}} />)
  expect(render(c)).toContain('2, None Active')
  expect(render({ ...c, activeStance: 'Foeseeker Stance' })).toContain('2, Foeseeker Stance Active')
  expect(render({ ...c, activeStance: 'Future Stance' })).toContain('2, None Active')
})

it('lists learned stances once in display order, rejecting future, deleted and wrong-source selections', () => {
  const entries = [stance('Zebra Stance'), stance('Air Shroud'), stance('Future Stance', 18),
    stance('Never Learned'), stance('Stance Savant', 1, ['Fighter']),
    { ...stance('Deleted Stance'), deleted: true }, { ...stance('SF Stance'), systems: ['sf2e'] as const },
    stance('Missing Source')]
  const catalog: ContentEntry[] = entries.map(entry => ({ ...entry, systems: [...entry.systems] }))
  const c: Character = { ...base, activeStance: 'Future Stance',
    feats: [...catalog.filter(entry => entry.name !== 'Never Learned').map(learn), learn(catalog[1])]
      .map(feat => feat.name === 'Missing Source' ? { ...feat, sourceId: 'missing' } : feat) }
  expect(availableStances(c, catalog).map(entry => featDisplayName(entry))).toEqual(['Air Shroud Stance', 'Zebra Stance'])
  expect(activeStance(c, catalog)).toBeUndefined()
})

it('deduplicates equivalent Fighter and Ranger stance titles without losing saved activation', () => {
  const entries = [stance('Twinned Defense Stance', 16, ['Ranger', 'Stance']),
    stance('Twinned Defense (Fighter)', 16, ['Fighter', 'Stance'])]
  const c: Character = { ...base, feats: entries.map(learn), activeStance: entries[1].name }
  expect(availableStances(c, entries)).toEqual([entries[1]])
  expect(activeStance(c, entries)).toBe(entries[1])
})

it('saves one active stance, switches stances and allows leaving without changing learned feats', () => {
  const entries = [stance('Zebra Stance'), stance('Air Shroud')]
  let c: Character = { ...base, feats: entries.map(learn) }
  const original = JSON.stringify(c.feats)
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const controls = () => {
    const inputs: { checked: boolean; onChange: () => void }[] = []
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<{ children?: ReactNode; checked: boolean; onChange: () => void }>(child)) return
      if (child.type === 'input') inputs.push(child.props)
      visit(child.props.children)
    })
    visit(StancesContent({ c, entries, save }))
    return inputs
  }
  expect(controls().map(input => input.checked)).toEqual([true, false, false])
  controls()[1].onChange()
  expect(save).toHaveBeenLastCalledWith({ activeStance: 'Air Shroud' })
  expect(controls().map(input => input.checked)).toEqual([false, true, false])
  controls()[2].onChange()
  expect(save).toHaveBeenLastCalledWith({ activeStance: 'Zebra Stance' })
  expect(controls().map(input => input.checked)).toEqual([false, false, true])
  controls()[0].onChange()
  expect(c.activeStance).toBeUndefined()
  expect(JSON.stringify(c.feats)).toBe(original)
})

it('grants Tenacious Stance at the dedication level, including the dwarf house rule', () => {
  const dedication = stance('Stalwart Defender Dedication', 2, ['Dedication'])
  const c = { ...base, level: 2, feats: [learn(dedication)] }
  expect(availableStances(c, [dedication]).map(entry => entry.name)).toContain('Tenacious Stance')
  expect(availableStances({ ...c, level: 1 }, [dedication])).toEqual([])
  expect(availableStances({ ...c, systems: ['sf2e'] }, [dedication])).toEqual([])
  const previous = getSettings().dwarfStalwartDefender
  try {
    updateSettings({ dwarfStalwartDefender: true })
    expect(availableStances({ ...c, ancestry: 'Dwarf', feats: [] }, []).map(entry => entry.name)).toContain('Tenacious Stance')
    expect(availableStances({ ...c, ancestry: 'Dwarf', feats: [], level: 1 }, [])).toEqual([])
  } finally { updateSettings({ dwarfStalwartDefender: previous }) }
})

it('requires armor and tracks Tenacious Stance temporary HP immunity across reentry', () => {
  const dedication = stance('Stalwart Defender Dedication', 2, ['Dedication'])
  const armor: ContentEntry = { ...stance('Test Plate'), kind: 'armor',
    data: { armor_category: 'Heavy', strength: 18, check_penalty: -3, speed_penalty: -10 } }
  const entries = [dedication, armor]
  let c: Character = { ...base, level: 5, abilities: { ...base.abilities, str: 18 }, feats: [learn(dedication)] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  type Props = { children?: ReactNode; 'aria-label'?: string; disabled?: boolean; onChange?: (event: { target: { checked: boolean } }) => void }
  const find = (label: string) => {
    let result: Props | undefined
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<Props>(child)) return
      if (child.props['aria-label'] === label) result = child.props
      visit(child.props.children)
    })
    visit(StancesContent({ c, entries, save }))
    if (!result) throw new Error(`Missing ${label}`)
    return result
  }
  const event = { target: { checked: false } }
  expect(find('Use Tenacious Stance').disabled).toBe(true)
  c = { ...c, armors: [{ id: 'armor', name: armor.name, potency: 0, resilient: 0, runes: [], worn: true }] }
  expect(find('Use Tenacious Stance').disabled).toBe(false)
  expect(tenaciousStanceHasArmor(c, [{ ...armor, data: { armor_category: 'Unarmored' } }])).toBe(false)
  expect(starfinderArmorPenalties(c, entries)).toEqual({ check: 0, speed: -5 })
  find('Use Tenacious Stance').onChange!(event)
  expect(temporaryHpGrant(c, entries)?.value).toBe(2)
  expect(starfinderArmorPenalties(c, entries)).toEqual({ check: -3, speed: -10 })
  const sfArmor: ContentEntry = { ...armor, systems: ['sf2e'], data: { ...armor.data, strength: 4 } }
  const mixed: Character = { ...c, systems: ['pf2e', 'sf2e'], abilities: { ...c.abilities, str: 18 } }
  expect(starfinderArmorPenalties(mixed, [sfArmor])).toEqual({ check: -3, speed: -10 })
  expect(starfinderArmorPenalties({ ...mixed, className: 'Soldier', abilities: { ...mixed.abilities, con: 18 } }, [sfArmor]))
    .toEqual({ check: 0, speed: -5 })
  const none = () => {
    const root = StancesContent({ c, entries, save })
    let handler: (() => void) | undefined
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<{ children?: ReactNode; type?: string; 'aria-label'?: string; onChange?: () => void }>(child)) return
      if (child.type === 'input' && !child.props['aria-label'] && !handler) handler = child.props.onChange
      visit(child.props.children)
    })
    visit(root)
    if (!handler) throw new Error('Missing None control')
    handler()
  }
  none()
  expect(temporaryHpGrant(c, entries)).toBeUndefined()
  expect(c.tenaciousStanceHpImmune).toBe(true)
  find('Use Tenacious Stance').onChange!(event)
  expect(temporaryHpGrant(c, entries)).toBeUndefined()
  find('Tenacious Stance temporary HP immunity').onChange!(event)
  expect(temporaryHpGrant(c, entries)).toBeUndefined()
  none()
  find('Tenacious Stance temporary HP immunity').onChange!(event)
  find('Use Tenacious Stance').onChange!(event)
  expect(temporaryHpGrant(c, entries)?.value).toBe(2)
  expect(temporaryHpGrant({ ...c, armors: [] }, entries)).toBeUndefined()
})

it.each([
  ['Earth', 'acid', 'water creatures'],
  ['Fire', 'fire', 'metal creatures and primarily metallic constructs'],
  ['Metal', 'electricity', 'wood or plant creatures and constructs primarily made of wood or plant matter'],
  ['Water', 'sonic', 'fire creatures'],
  ['Wood', 'cold', 'earth creatures and constructs primarily made of rock or earth'],
] as const)('limits %s medicine damage to its specified targets', (element, type, targets) => {
  const entry = stance('Intensified Element Stance', 6)
  const c: Character = { ...base, feats: [learn(entry)], activeStance: entry.name,
    intensifiedElement: { element, used: true, legendary: true } }
  expect(intensifiedElementDamage(c, [entry])).toEqual({ dice: 2, type, targets })
  expect(intensifiedElementDamage({ ...c, activeStance: undefined }, [entry])).toBeUndefined()
  expect(intensifiedElementDamage({ ...c, feats: [] }, [entry])).toBeUndefined()
  expect(intensifiedElementDamage({ ...c, level: 5 }, [entry])).toBeUndefined()
  expect(intensifiedElementDamage({ ...c, intensifiedElement: { element, used: true } }, [entry])?.dice).toBe(1)
})

it('expends prepared medicine on entry and prevents reuse until reset', () => {
  const entry = stance('Intensified Element Stance', 6)
  let c: Character = { ...base, feats: [learn(entry)] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  type Props = { children?: ReactNode; 'aria-label'?: string; disabled?: boolean; onChange?: (event: { target: { value: string; checked: boolean } }) => void }
  const find = (label: string) => {
    let found: Props | undefined
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<Props>(child)) return
      if (child.props['aria-label'] === label) found = child.props
      visit(child.props.children)
    })
    visit(StancesContent({ c, entries: [entry], save }))
    if (!found) throw new Error(`Missing ${label}`)
    return found
  }
  const input = (value: string, checked = false) => ({ target: { value, checked } })
  expect(find('Use Intensified Element Stance').disabled).toBe(true)
  find('Intensified Element Stance medicine').onChange!(input('Water'))
  find('Legendary elemental medicine').onChange!(input('', true))
  find('Use Intensified Element Stance').onChange!(input(''))
  expect(c.intensifiedElement).toEqual({ element: 'Water', legendary: true, used: true })
  expect(intensifiedElementDamage(c, [entry])).toEqual({ dice: 2, type: 'sonic', targets: 'fire creatures' })
  c = { ...c, activeStance: undefined }
  expect(find('Use Intensified Element Stance').disabled).toBe(true)
  find('Elemental medicine expended').onChange!(input('', false))
  expect(find('Use Intensified Element Stance').disabled).toBe(false)
})

it('offers a separate conditional damage roll for damaging spells', () => {
  const entry = stance('Intensified Element Stance', 6)
  const c: Character = { ...base, className: 'Druid', feats: [learn(entry)], activeStance: entry.name,
    intensifiedElement: { element: 'Fire', used: true, legendary: true } }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[entry]} save={() => {}} />)
  expect(html).toContain('Conditional spell damage: 2d6 fire')
  expect(html).toContain('damaging spells against metal creatures and primarily metallic constructs')
})

it.each([
  ['Twinned Defense (Fighter)', ['Fighter', 'Stance'], 'Twinned Defense Stance'],
  ['Ricochet Stance (Rogue)', ['Rogue', 'Stance'], 'Ricochet Stance'],
  ['Air Shroud', ['Stance'], 'Air Shroud Stance'],
  ['Tiger Stance', ['Stance'], 'Tiger Stance'],
  ['Stance Savant', ['Fighter'], 'Stance Savant'],
])('uses clear stance titles for %s without renaming stored content', (name, traits, expected) => {
  const entry = stance(name, 1, traits)
  const before = JSON.stringify(entry)
  const markup = renderToStaticMarkup(<EntryDescription entry={entry} name={entry.name} />)
  expect(featDisplayName(entry)).toBe(expected)
  expect(featDisplayName(entry, expected)).toBe(expected)
  expect(markup).toContain(`aria-haspopup="dialog">${expected}</button>`)
  expect(markup).toContain(`tabindex="-1">${expected}<small>`)
  expect(markup).toContain(entry.description)
  expect(JSON.stringify(entry)).toBe(before)
})

it('searches and displays the renamed Fighter feat using its canonical saved selection', () => {
  const entry = stance('Twinned Defense (Fighter)', 16, ['Fighter', 'Stance'])
  const c: Character = { ...base, feats: [{ ...learn(entry), slot: 'class:16:0' }] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[entry]} save={() => {}} categories={['class']}
    search={{ 'class:16:0:open': '1', 'class:16:0:query': 'twinned defense stance' }} onSearch={() => {}} />)
  expect(markup).toContain('L16 Class: Twinned Defense Stance')
  expect(markup).toContain('aria-haspopup="dialog">Twinned Defense Stance</button>')
  expect(c.feats[0].name).toBe(entry.name)
})
