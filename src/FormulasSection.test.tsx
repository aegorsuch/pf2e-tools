import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { FormulasSection } from './FormulasSection'
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
  expect(markup).toContain('Choose four common 1st-level snare formulas')
  expect(markup).toContain('Spike Snare (Level 1)')
  expect(markup).not.toContain('Rare Snare (Level 1)')
  expect(markup).not.toContain('High Snare (Level 5)')
  expect(markup).toContain('Low Snare (Level 4)')
  expect(markup).toContain('You must have access to each formula')
  expect(knownFormulas({ ...character, brastlewarkFormulaMode: undefined }, entries).map(formula => formula.name))
    .toEqual(['Alarm Snare'])
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
  expect(html).toContain('level 3 or lower')
  expect(html).toContain('level 7 or lower')
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
  expect(prepared).toContain('Prepare 8 temporary grenades')
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
  expect(renderToStaticMarkup(<GrenadeSpecialist c={{ ...character, level: 4 }} entries={[grenade]} save={() => {}} />))
    .not.toContain('Damage type: slashing')
  const enduring = { ...character, level: 13,
    mechanicEnduringMod: { kind: 'grenade' as const, item: 'prepared:0', mod: 'bigBoom', label: 'Prepared grenade 1' } }
  const enduringHtml = renderToStaticMarkup(<GrenadeSpecialist c={enduring} entries={[grenade]} save={() => {}} />)
  expect(enduringHtml).toContain('Enduring mod: Prepared grenade 1')
  expect(enduringHtml).toContain('<option value="bigBoom" selected="">Big Boom</option>')
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
  expect(formulas).toContain('four 1st-level common or uncommon bombs or alchemical ammunition formulas')
  expect(formulas).toContain('2/4 feat choices')
  expect(formulas).toContain(`${ammunition.name} (Level 1)`)
  expect(formulas).not.toContain('Rare Bomb (Level 1)')
  expect(formulas).not.toContain('Greater Alchemical Ammunition (Level 2)')
  expect(renderToStaticMarkup(<FormulasSection c={{ ...character, munitionsFormulaChoices: [bomb.name, bomb.name] }}
    entries={catalog} save={() => {}} />))
    .toMatch(/<option value="Bottled Lightning" disabled="" selected="">Bottled Lightning \(unavailable\)<\/option>/)
  const preparation = renderToStaticMarkup(<MunitionsCrafter c={character} entries={catalog} save={() => {}} />)
  expect(preparation).toContain('Prepare 6 temporary consumables of your level or lower')
  expect(preparation).toContain('4 rounds')
  expect(preparation).toContain(`${powder.name} (Level 0; 4 rounds)`)
  expect(preparation).toContain('Bottled Lightning (Level 1; 1 item)')
  expect(preparation).not.toContain('Black Powder Horn')
  expect(preparation).not.toContain('Black Powder Keg')
  expect(preparation).not.toContain('Firearm Ammunition')
})
