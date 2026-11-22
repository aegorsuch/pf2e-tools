import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { FormulaSearch, FormulasContent, FormulasSection, FormulasSummary } from './FormulasSection'
import * as builder from './builder'
import { GrenadeSpecialist, MunitionsCrafter } from './GearSection'
import { BLACK_POWDER_FORMULA, gadgetLimits, grenadeLimits, knownFormulas, munitionsLimits, snareAdvancements, updateFormulaChoice } from './formulas'
import type { Character, ContentEntry } from './types'

const c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 4, className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
const item = (name: string, level: number, traits: string[], data: ContentEntry['data'] = {}): ContentEntry => ({
  id: name, name, kind: 'item', level, traits, systems: ['pf2e'], source: 'official', description: '', data, effects: [], updatedAt: 0,
})
const entries = [
  item('Alarm Snare', 1, ['Snare']), item('Spike Snare', 1, ['Snare']),
  item('Rare Snare', 1, ['Snare', 'Rare']), item('High Snare', 5, ['Snare', 'Magical', 'Uncommon']),
  item('Low Snare', 4, ['Snare', 'Magical', 'Uncommon']),
  item('Pit Illusion Snare', 3, ['Snare', 'Magical', 'Uncommon']),
  item('Shadow Cloak Snare', 4, ['Snare', 'Magical', 'Uncommon']),
]
const dedication = { name: 'Snarecrafter Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }
const brastlewark = { name: 'Brastlewark Snare Engineering', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' }

it('searches and adds formulas without recalculating other formula grants', () => {
  const searchItems = [item('Alarm Snare', 1, ['Snare']), item('Spike Snare', 1, ['Snare']),
    item('Restricted Snare', 1, ['Snare'], { access: 'Kellid ethnicity' })]
  const save = vi.fn()
  const ranks = vi.spyOn(builder, 'ranksAt')
  let typed = false
  let added = false
  const find = (node: ReactNode, predicate: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined => {
    let result: ReactElement<Record<string, unknown>> | undefined
    Children.forEach(node, child => {
      if (result || !isValidElement<Record<string, unknown>>(child)) return
      result = predicate(child) ? child : find(child.props.children as ReactNode, predicate)
    })
    return result
  }
  function InspectSearch() {
    const tree = FormulaSearch({ c, items: searchItems, knownKeys: new Set(['alarm snare']), allowRestricted: false, save })
    const input = find(tree, element => element.type === 'input')
    if (!typed) {
      typed = true
      ;(input!.props.onChange as (event: unknown) => void)({ target: { value: 'snare' } })
    } else if (input?.props.value === 'snare' && !added) {
      const add = find(tree, element => element.props['aria-label'] === 'Add Spike Snare formula')
      expect(add).toBeDefined()
      expect(find(tree, element => element.props['aria-label'] === 'Add Alarm Snare formula')).toBeUndefined()
      expect(find(tree, element => element.props['aria-label'] === 'Add Restricted Snare formula')).toBeUndefined()
      added = true
      ;(add!.props.onClick as () => void)()
    }
    return tree
  }
  try {
    renderToStaticMarkup(<InspectSearch />)
    expect(save).toHaveBeenCalledWith({ formulas: ['Spike Snare'] })
    expect(ranks).not.toHaveBeenCalled()
  } finally { ranks.mockRestore() }
})

it('evaluates each proficiency level once per formula summary or editor render', () => {
  const character: Character = { ...c, level: 8, feats: [dedication], skillPicks: ['Survival'],
    skillIncreases: { 3: 'Survival', 7: 'Survival' },
    snareAdvancementFormulaChoices: ['Spike Snare', '', '', 'Low Snare'] }
  const ranks = vi.spyOn(builder, 'ranksAt')
  try {
    const summary = renderToStaticMarkup(<FormulasSummary c={character} entries={entries} />)
    expect(summary).toContain('2 known; 2/10 feat choices')
    expect(ranks.mock.calls.map(([character]) => character.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    ranks.mockClear()
    const editor = renderToStaticMarkup(<FormulasContent c={character} entries={entries} save={() => {}} />)
    expect(editor).toContain('Master snare formula 1')
    expect(ranks.mock.calls.map(([character]) => character.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  } finally { ranks.mockRestore() }
})

it('does not count proficiency earned before a late dedication as a new formula grant', () => {
  const character: Character = { ...c, level: 16, feats: [{ ...dedication, takenLevel: 8 }],
    skillPicks: ['Survival'], skillIncreases: { 3: 'Survival', 7: 'Survival', 15: 'Survival' } }
  expect(snareAdvancements(character, entries)).toEqual([{ rank: 4, level: 15 }])
  expect(snareAdvancements({ ...character, level: 14 }, entries)).toEqual([])
})

it('preserves dormant choices and fills gaps when selecting a later formula slot', () => {
  const choices = updateFormulaChoice([], 3, 'Low Snare')
  expect(JSON.parse(JSON.stringify(choices))).toEqual(['', '', '', 'Low Snare'])
  expect(updateFormulaChoice(choices, 0, 'Spike Snare')).toEqual(['Spike Snare', '', '', 'Low Snare'])
  const character: Character = { ...c, level: 8, feats: [dedication], skillPicks: ['Survival'],
    skillIncreases: { 3: 'Survival', 7: 'Survival' }, snareAdvancementFormulaChoices: choices }
  expect(knownFormulas(JSON.parse(JSON.stringify(character)), entries))
    .toContainEqual({ name: 'Low Snare', source: 'Snarecrafter Dedication' })
  const legacy: Character = { ...character, snareAdvancementFormulaChoices: JSON.parse('[null,null,null,"Low Snare"]') }
  expect(knownFormulas(legacy, entries)).toContainEqual({ name: 'Low Snare', source: 'Snarecrafter Dedication' })
})

it('retains user choices and derives formulas only while their granting feats are active', () => {
  const character: Character = { ...c, feats: [dedication, brastlewark], formulas: ['Alarm Snare', 'Rope'],
    snareFormulaChoices: ['Spike Snare'], brastlewarkFormulaMode: 'standard' }
  expect(knownFormulas(character, entries)).toEqual([
    { name: 'Alarm Snare', source: 'Other' },
    { name: 'Pit Illusion Snare', source: 'Brastlewark Snare Engineering' },
    { name: 'Rope', source: 'Other' },
    { name: 'Shadow Cloak Snare', source: 'Brastlewark Snare Engineering' },
    { name: 'Spike Snare', source: 'Snare Crafting' },
  ])
  expect(knownFormulas({ ...character, level: 1 }, entries)).toEqual([
    { name: 'Alarm Snare', source: 'Other' }, { name: 'Rope', source: 'Other' },
  ])
  expect(knownFormulas(JSON.parse(JSON.stringify(character)), entries)).toEqual(knownFormulas(character, entries))
})

it('offers only eligible initial and alternative snares without inventing Brastlewark choices', () => {
  const character: Character = { ...c, level: 6, feats: [dedication, brastlewark], snareFormulaChoices: ['Alarm Snare'],
    brastlewarkFormulaMode: 'other' }
  const markup = renderToStaticMarkup(<FormulasSection c={character} entries={entries} save={() => {}} />)
  expect(markup.match(/aria-label="Snare Crafting formula \d"/g)).toHaveLength(4)
  expect(markup).not.toContain('Choose four common 1st-level snare formulas')
  expect(markup).toContain('Spike Snare (Level 1)')
  expect(markup).not.toContain('Rare Snare (Level 1)')
  expect(markup).not.toContain('High Snare (Level 5)')
  expect(markup).toContain('Low Snare (Level 4)')
  expect(markup).not.toContain('You must have access to each formula')
  expect(knownFormulas({ ...character, brastlewarkFormulaMode: undefined }, entries).map(formula => formula.name))
    .toEqual(['Alarm Snare'])
})

it('allows formula Access by default without bypassing specific requirements or grant restrictions', () => {
  const restricted = item('Restricted Snare', 1, ['Snare'], { access: 'Kellid ethnicity' })
  const catalog = [...entries, restricted]
  const character: Character = { ...c, feats: [dedication], skillPicks: ['Survival'], skillIncreases: { 3: 'Survival' } }
  const render = (ethnicity?: string) => renderToStaticMarkup(<FormulasSection c={{ ...character, ethnicity }}
    entries={catalog} save={() => {}} />)
  const markup = render()
  const expert = /<select aria-label="Expert snare formula 1"[^>]*>([\s\S]*?)<\/select>/.exec(markup)?.[1]
  expect(expert).toBeDefined()
  expect(expert).toContain('Rare Snare')
  expect(expert).not.toContain('Restricted Snare')
  expect(expert).not.toContain('High Snare')
  expect(render('Kellid')).toContain('Restricted Snare')
})

it('grants snare formula choices when relevant proficiency increases after dedication', () => {
  const character: Character = { ...c, level: 8, feats: [dedication], skillPicks: ['Survival'],
    skillIncreases: { 3: 'Survival', 7: 'Survival' },
    snareAdvancementFormulaChoices: ['Spike Snare', '', '', 'Low Snare'] }
  expect(snareAdvancements(character, entries)).toEqual([{ rank: 2, level: 3 }, { rank: 3, level: 7 }])
  expect(knownFormulas(character, entries)).toContainEqual({ name: 'Spike Snare', source: 'Snarecrafter Dedication' })
  expect(knownFormulas({ ...character, level: 4 }, entries).map(formula => formula.name)).not.toContain('Low Snare')
  const html = renderToStaticMarkup(<FormulasSection c={character} entries={entries} save={() => {}} />)
  expect(html).toContain('Expert snare formula 1')
  expect(html).toContain('Master snare formula 1')
  expect(html.match(/aria-label="Expert snare formula \d"/g)).toHaveLength(3)
  expect(html.match(/aria-label="Master snare formula \d"/g)).toHaveLength(3)
  expect(snareAdvancements({ ...character, className: 'Fighter' }, entries)).toEqual([])
  expect(character.snareAdvancementFormulaChoices?.[3]).toBe('Low Snare')
})

it('tracks gadget formula and daily preparation limits without deleting dormant choices', () => {
  const gadget = item('Clockwork Goggles', 3, ['Gadget', 'Uncommon'])
  const character: Character = { ...c, level: 14, rankOverrides: { Crafting: 3 },
    feats: [{ name: 'Gadget Specialist', type: 'Class Feat', level: 4 },
      { name: 'Ubiquitous Gadgets', type: 'Class Feat', level: 8 },
      { name: 'Ubiquitous Gadgets', type: 'Class Feat', level: 8, slot: 'class:14:0' }],
    gadgetFormulaChoices: [gadget.name, '', '', '', '', 'Stored'], gadgetPreparations: [gadget.name] }
  expect(gadgetLimits(character, [gadget])).toEqual({ formulas: 6, prepared: 7 })
  expect(knownFormulas(character, [gadget])).toContainEqual({ name: gadget.name, source: 'Gadget Specialist' })
  const markup = renderToStaticMarkup(<FormulasSection c={character} entries={[gadget]} save={() => {}} />)
  expect(markup).toContain('Gadget formula 6')
  expect(markup).toContain('2/6 feat choices')
  expect(gadgetLimits({ ...character, rankOverrides: { Crafting: 4 } }, [gadget])).toEqual({ formulas: 9, prepared: 8 })
  expect(knownFormulas({ ...character, rankOverrides: { Crafting: 2 } }, [gadget]).map(formula => formula.name)).not.toContain('Stored')
  expect(character.gadgetFormulaChoices?.[5]).toBe('Stored')
})

it('grants common grenade formulas and scales daily grenades with Crafting and Plentiful Grenades', () => {
  const grenade = { ...item('Frag Grenade', 1, ['Grenade']), systems: ['sf2e' as const] }
  const high = { ...item('High Grenade', 15, ['Grenade']), systems: ['sf2e' as const] }
  const uncommon = { ...item('Rare Grenade', 1, ['Grenade', 'Rare']), systems: ['sf2e' as const] }
  const catalog = [grenade, high, uncommon]
  const character: Character = { ...c, systems: ['sf2e'], className: 'Mechanic', level: 14, rankOverrides: { Crafting: 3 },
    feats: [{ name: 'Grenade Specialist', type: 'Class Feat', level: 2 },
      { name: 'Plentiful Grenades', type: 'Class Feat', level: 8, slot: 'class:8:0' },
      { name: 'Plentiful Grenades', type: 'Class Feat', level: 8, slot: 'class:14:0' }],
    grenadeFormulaChoices: [grenade.name, high.name], grenadePreparations: [grenade.name], grenadeUsed: [true] }
  expect(grenadeLimits(character, catalog)).toEqual({ formulas: 2, prepared: 8 })
  expect(grenadeLimits({ ...character, rankOverrides: { Crafting: 4 } }, catalog)?.prepared).toBe(10)
  expect(grenadeLimits({ ...character, level: 7, rankOverrides: { Crafting: 2 } }, catalog)?.prepared).toBe(3)
  expect(knownFormulas(character, catalog)).toContainEqual({ name: grenade.name, source: 'Grenade Specialist' })
  expect(knownFormulas({ ...character, level: 1 }, catalog)).toEqual([])
  const formulas = renderToStaticMarkup(<FormulasSection c={character} entries={catalog} save={() => {}} />)
  expect(formulas).toContain('Grenade formula 2')
  expect(formulas).not.toContain('Rare Grenade (Level 1)')
  const prepared = renderToStaticMarkup(<GrenadeSpecialist c={character} entries={catalog} save={() => {}} />)
  expect(prepared.match(/aria-label="Prepared grenade \d"/g)).toHaveLength(8)
  expect(prepared).toContain('Frag Grenade (Level 1)')
  expect(prepared).not.toContain('High Grenade (Level 15)')
})

it('shows active grenade modifications with the correct range, radius and damage type', () => {
  const grenade: ContentEntry = { ...item('Frag Grenade', 1, ['Grenade']), systems: ['sf2e'],
    description: 'The burst radius is 5 feet, and the piercing damage is 1d8.' }
  const character: Character = { ...c, systems: ['sf2e'], className: 'Mechanic', level: 5,
    feats: [{ name: 'Grenade Specialist', type: 'Class Feat', level: 2 }],
    grenadeFormulaChoices: [grenade.name], grenadePreparations: [grenade.name],
    mechanicGrenadeMods: { 'prepared:0': { bigBoom: true, longRange: true, damageType: 'slashing', incapacitant: true } } }
  const html = renderToStaticMarkup(<GrenadeSpecialist c={character} entries={[grenade]} save={() => {}} />)
  expect(html).toContain('Thrown range 100 feet')
  expect(html).toContain('Burst radius 10 feet')
  expect(html).toContain('Damage type: slashing')
  expect(html).toContain('Nonlethal.')
  const apocalyptic = { ...character, level: 20, feats: [...character.feats,
    { name: 'Apocalyptic Explosions', type: 'Class Feat', level: 20 }] }
  expect(renderToStaticMarkup(<GrenadeSpecialist c={apocalyptic} entries={[grenade]} save={() => {}} />))
    .toContain('Apocalyptic Explosions doubles the grenade area.')
  expect(renderToStaticMarkup(<GrenadeSpecialist c={{ ...character, level: 4 }} entries={[grenade]} save={() => {}} />))
    .not.toContain('Damage type: slashing')
  const enduring = { ...character, level: 13,
    mechanicEnduringMod: { kind: 'grenade' as const, item: 'prepared:0', mod: 'bigBoom', label: 'Prepared grenade 1' } }
  const enduringHtml = renderToStaticMarkup(<GrenadeSpecialist c={enduring} entries={[grenade]} save={() => {}} />)
  expect(enduringHtml).toContain('Enduring mod: Prepared grenade 1')
  expect(enduringHtml).toContain('<option value="bigBoom" selected="">Big Boom</option>')
})

it('clears glitching from freshly prepared grenades even when no grenade was used', () => {
  const grenade = { ...item('Frag Grenade', 1, ['Grenade']), systems: ['sf2e' as const] }
  let character: Character = { ...c, systems: ['sf2e'], className: 'Mechanic', level: 5,
    feats: [{ name: 'Grenade Specialist', type: 'Class Feat', level: 2 }],
    grenadeFormulaChoices: [grenade.name], grenadePreparations: [grenade.name],
    mechanicGlitching: { 'grenade:prepared:0': 2, 'weapon:other': 1 } }
  const find = (node: ReactNode): { disabled?: boolean; onClick?: () => void } | undefined => {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = find(child)
        if (found) return found
      }
    } else if (isValidElement<{ children?: ReactNode; disabled?: boolean; onClick?: () => void }>(node)) {
      if (node.type === 'button' && node.props.children === 'Daily preparations') return node.props
      return find(node.props.children)
    }
    return undefined
  }
  const button = find(GrenadeSpecialist({ c: character, entries: [grenade], save: patch => { character = { ...character, ...patch } } }))
  expect(button?.disabled).toBe(false)
  button?.onClick?.()
  expect(character.mechanicGlitching).toEqual({ 'weapon:other': 1 })
})

it('adds Munitions Crafter formulas and prepares bombs or ammunition in daily batches', () => {
  const powder = item(BLACK_POWDER_FORMULA, 0, ['Alchemical', 'Consumable'])
  const bomb = item('Bottled Lightning', 1, ['Alchemical', 'Bomb'])
  const ammunition: ContentEntry = { ...item('Alchemical Ammunition (10 rounds)', 1, ['Alchemical', 'Consumable', 'Uncommon'],
    { weapon_category: 'Ammunition' }), kind: 'weapon' }
  const rareBomb = item('Rare Bomb', 1, ['Alchemical', 'Bomb', 'Rare'])
  const highLevelAmmo = item('Greater Alchemical Ammunition', 2, ['Alchemical', 'Consumable'],
    { weapon_category: 'Ammunition' })
  const firearmAmmo = item('Firearm Ammunition (10 rounds)', 1, ['Ammunition'], { weapon_category: 'Ammunition' })
  const horn = item('Black Powder Horn', 1, ['Alchemical', 'Consumable'])
  const keg = item('Black Powder Keg', 1, ['Alchemical', 'Consumable'])
  const catalog = [powder, bomb, ammunition, rareBomb, highLevelAmmo, firearmAmmo, horn, keg]
  const munitionsFeat = { name: 'Munitions Crafter', type: 'Class Feat', level: 1, slot: 'class:1:0' }
  const character: Character = { ...c, className: 'Gunslinger', level: 4, feats: [munitionsFeat],
    munitionsFormulaChoices: [bomb.name, ammunition.name], munitionsPreparations: [ammunition.name, bomb.name, powder.name],
    munitionsUsed: [true] }
  expect(munitionsLimits(character)).toEqual({ formulaChoices: 4, prepared: 6 })
  expect(knownFormulas(character, catalog)).toEqual([
    { name: ammunition.name, source: 'Munitions Crafter' },
    { name: powder.name, source: 'Munitions Crafter' },
    { name: bomb.name, source: 'Munitions Crafter' },
  ])
  const formulas = renderToStaticMarkup(<FormulasSection c={character} entries={catalog} save={() => {}} />)
  expect(formulas.match(/aria-label="Munitions Crafter formula \d"/g)).toHaveLength(4)
  expect(formulas).toContain('2/4 feat choices')
  expect(formulas).toContain(`${ammunition.name} (Level 1)`)
  expect(formulas).not.toContain('Rare Bomb (Level 1)')
  expect(formulas).not.toContain('Greater Alchemical Ammunition (Level 2)')
  expect(renderToStaticMarkup(<FormulasSection c={{ ...character, munitionsFormulaChoices: [bomb.name, bomb.name] }}
    entries={catalog} save={() => {}} />))
    .toMatch(/<option value="Bottled Lightning" disabled="" selected="">Bottled Lightning \(unavailable\)<\/option>/)
  const preparation = renderToStaticMarkup(<MunitionsCrafter c={character} entries={catalog} save={() => {}} />)
  expect(preparation.match(/aria-label="Prepared munition \d"/g)).toHaveLength(6)
  expect(preparation).toContain('4 rounds')
  expect(preparation).toContain(`${powder.name} (Level 0; 4 rounds)`)
  expect(preparation).toContain('Bottled Lightning (Level 1; 1 item)')
  expect(preparation).not.toContain('Black Powder Horn')
  expect(preparation).not.toContain('Black Powder Keg')
  expect(preparation).not.toContain('Firearm Ammunition')
})

it('Cauldron grants four 1st-level oil or potion formulas plus one every even level from 4', () => {
  const witch: Character = { ...c, className: 'Witch', level: 6, feats: [{ name: 'Cauldron', type: 'Class Feat', level: 1 }],
    cauldronFormulaChoices: ['Minor Healing Potion', '', '', '', 'Potion of Swiftness'] }
  const catalog = [item('Minor Healing Potion', 1, ['Potion', 'Consumable']), item('Potion of Swiftness', 4, ['Potion']),
    item('Rare Oil', 1, ['Oil', 'Rare']), item('Lesser Potion', 6, ['Potion'])]
  expect(builder.featTakenLevel(witch.feats[0])).toBe(1)
  expect(knownFormulas(witch, catalog)).toEqual([{ name: 'Minor Healing Potion', source: 'Cauldron' },
    { name: 'Potion of Swiftness', source: 'Cauldron' }])
  const markup = renderToStaticMarkup(<FormulasContent c={witch} entries={catalog} save={() => {}} />)
  expect(markup).toContain('Cauldron level 6 formula 1')
  expect(markup).toContain('Cauldron level 1 formula 4')
  expect(markup).not.toContain('Rare Oil')
  expect(renderToStaticMarkup(<FormulasSummary c={witch} entries={catalog} />)).toContain('2/6 feat choices')
})
