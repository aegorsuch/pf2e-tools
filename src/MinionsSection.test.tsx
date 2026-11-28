import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactNode } from 'react'
import { afterEach, expect, it, onTestFinished, vi } from 'vitest'
import { CompanionEquipmentSlots, FollowerCards, MinionsContent, MinionsSection, MinionsSummary, ServoShellMinibot, SummonedFiendCard } from './MinionsSection'
import { SearchableSelect } from './SearchableSelect'
import { CaypinAllyToggle, CompanionSpellOptions, CreatureShapeOptions, LashuntaAllyOptions, ShirrenAllyToggle, SpellsSection, SpiritOfTheBeastOptions } from './SpellsSection'
import { activeBattleForm, armorClass, eligibleFeats, featChoiceOptions, featPrerequisiteChecker, movementSpeeds, ownedWeapons, spellActiveChange, summonedMounts } from './builder'
import { familiarAbilityEffects, familiarAbilityUnavailableReason, minionMovementSpeeds } from './familiarAbilities'
import { EntryDescription } from './EntryDescription'
import { DamageRoll } from './SpellDamage'
import { bardingOptions, companionAdvancement, CONSTRUCT_COMPANION_ENTRY, CONSTRUCT_COMPANION_NAME } from './companions'
import { getSettings, updateSettings } from './settings'
import type { Character, ContentEntry } from './types'
import { homebrewCharacterOptions } from './supplemental'
import { featSpellOptions, grantedFeatSpells, unresolvedFeatSpells } from './featSpells'
import { FeatChoice } from './FeatChoice'
import { FeatSlots } from './FeatSlots'
import { normalizeFiends } from './summonedFiends'
import { StatusesContent } from './StatusesSection'

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

function findInput(node: ReactNode, label: string): ((event: { target: { value: string } }) => void) | undefined {
  let found: ((event: { target: { value: string } }) => void) | undefined
  Children.forEach(node, (child) => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = child.type === 'input' && child.props['aria-label'] === label
      ? child.props.onChange as (event: { target: { value: string } }) => void
      : findInput(child.props.children as ReactNode, label)
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

function findButton(node: ReactNode, label: string): (() => void) | undefined {
  let found: (() => void) | undefined
  Children.forEach(node, (child) => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = child.type === 'button' && child.props['aria-label'] === label
      ? child.props.onClick as () => void
      : findButton(child.props.children as ReactNode, label)
  })
  return found
}

function hasOption(node: ReactNode, value: string): boolean {
  let found = false
  Children.forEach(node, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'option' && child.props.value === value || hasOption(child.props.children as ReactNode, value)) found = true
  })
  return found
}

afterEach(() => vi.unstubAllGlobals())

it('opens Spirit of the Beast from its spell action and synchronizes companion aspects', () => {
  const spell: ContentEntry = { id: 'spirit', name: 'Spirit of the Beast', kind: 'spell', systems: ['pf2e'], source: 'official',
    level: 2, traits: ['Focus'], description: '', data: { actions: 'Single Action' }, effects: [], updatedAt: 0 }
  let c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 9,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    spells: [{ name: spell.name, rank: 2, cantrip: false }], companions: [{ id: 'bear', name: 'Bear', type: 'Bear' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const html = () => renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={save} />)
  expect(html().match(/aria-label="Spirit of the Beast options"/g)).toHaveLength(1)
  findSelect(SpiritOfTheBeastOptions({ c, save }), 'Spirit of the Beast aspect on Bear')!({ target: { value: 'Might' } })
  expect(c.companions?.[0].spiritAspect).toBe('Might')
  expect(renderToStaticMarkup(<SpiritOfTheBeastOptions c={c} save={save} companionId="bear" />)).toContain('selected=""')
  findSelect(SpiritOfTheBeastOptions({ c, save, companionId: 'bear' }), 'Spirit of the Beast aspect on Bear')!({ target: { value: '' } })
  expect(c.companions?.[0].spiritAspect).toBeUndefined()
})

it('tracks ServoShell minibot summon, HP, Refocus repair, and permanent feature transplants', () => {
  const commercial: ContentEntry = { id: 'camera-commercial', name: 'Commercial Camera Minibot', kind: 'item',
    systems: ['sf2e'], source: 'official', level: 1, traits: ['Tech'], description: 'Camera feature.',
    data: { item_category: 'Tech Minions', hp: 4, price: 100 }, effects: [], updatedAt: 0 }
  const advanced: ContentEntry = { ...commercial, id: 'camera-advanced', name: 'Advanced Camera Minibot', level: 4,
    data: { ...commercial.data, price: 1100 } }
  let c: Character = { id: 'servoshell', systems: ['sf2e'], name: 'Test', level: 10, className: 'Technomancer',
    technomancerProgrammingLanguage: 'ServoShell',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [{ name: commercial.name, qty: 1 }], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => ServoShellMinibot({ c, entries: [commercial, advanced], save })
  expect(renderToStaticMarkup(tree())).toContain('4 / 14')
  expect(renderToStaticMarkup(<MinionsSummary c={c} entries={[commercial, advanced]} />)).toContain('Personal Minibot')

  findInput(tree(), 'Personal Minibot current HP')!({ target: { value: '6' } })
  findButton(tree(), 'Repair Personal Minibot during Refocus')!()
  expect(c.servoShellMinibot?.currentHp).toBe(14)
  findToggle(tree(), 'Personal Minibot summoned')!({ target: { checked: true } })
  expect(c.servoShellMinibot?.summoned).toBe(true)

  findSelect(tree(), 'Transplant minibot features')!({ target: { value: commercial.id } })
  expect(c.equipment).toEqual([])
  expect(c.servoShellMinibot?.transplantedFeatures).toEqual([commercial.id])
  findButton(tree(), `Pay 1000 credits to upgrade ${commercial.name} to ${advanced.name}`)!()
  expect(c.servoShellMinibot?.transplantedFeatures).toEqual([advanced.id])
})

it('rolls animal companion attack and damage and marks the selected mount', () => {
  const dog: ContentEntry = { id: 'dog', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Riding Dog',
    level: 1, traits: ['Animal'], description: '', data: { size: 'Medium', hp: 8, strength: 3,
      companion_attacks: 'Jaws|1d8 piercing|' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'mounted-dog', name: 'Test', systems: ['pf2e'], level: 4, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Cavalier Dedication', type: 'Archetype Feat', level: 2 }],
    companions: [{ id: 'dog', type: 'Riding Dog', name: 'Bristle' }], mountedCompanionId: 'dog',
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[dog]} save={() => {}} />)
  expect(markup).toContain('Young Riding Dog (Bristle) (Mounted)')
  expect(markup).toContain('aria-label="Roll Bristle Jaws: Attack"')
  expect(markup).toContain('title="Single Action; Attack: 1d20+')
  expect(markup).toContain('aria-label="Roll Bristle Jaws: Damage"')
  expect(markup).toContain('title="Damage: 1d8+')
  expect(markup).not.toContain('aria-label="Mounted on Bristle"')
})

it('opens Sinking Jaws details and rolls its flat piercing damage', () => {
  const cat: ContentEntry = { id: 'cat', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Cat',
    level: 1, traits: ['Animal'], description: '', data: { size: 'Small', hp: 6, strength: 2,
      companion_attacks: 'Jaws|1d8 piercing|' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'sinking-jaws', name: 'Test', systems: ['pf2e'], level: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Sinking Jaws', type: 'Archetype Feat', level: 10 }],
    companions: [{ id: 'cat', type: 'Cat', name: 'Mittens' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[cat]} save={() => {}} />)
  expect(markup).toContain('aria-label="Sinking Jaws details: Sinking Jaws"')
  expect(markup).toContain('aria-label="Roll Sinking Jaws: Damage"')
  expect(markup).toContain('title="Single Action; Damage: 12 piercing"')
  expect(markup).toContain('This companion has a creature grabbed or restrained with its jaws or fangs')
})

it('grants saved followers and permits ancestry selection only with Leader of All', () => {
  const elf: ContentEntry = { id: 'elf', name: 'Elf', kind: 'ancestry', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }
  let c: Character = { id: 'captain', name: 'Test', systems: ['pf2e'], level: 4,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 14 },
    feats: [{ name: 'Captain Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const content = () => FollowerCards({ c, entries: [elf], save })
  expect(renderToStaticMarkup(content())).toContain('Novice')
  expect(findSelect(content(), 'Follower 1 ancestry')).toBeUndefined()
  findSelect(content(), 'Follower 1 type')!({ target: { value: 'Scout' } })
  expect(findInput(content(), 'Follower 1 name')).toBeUndefined()
  expect(c.followers).toEqual([{ type: 'Scout' }])
  c = { ...c, feats: [...c.feats,
    { name: 'Leader of All', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' },
    { name: 'Experienced Follower', type: 'Archetype Feat', level: 4, slot: 'class:4:0' },
    { name: 'Additional Follower', type: 'Archetype Feat', level: 4, slot: 'class:4:1' }] }
  findSelect(content(), 'Follower 1 ancestry')!({ target: { value: 'Elf' } })
  expect(c.followers?.[0].ancestry).toBe('Elf')
  const markup = renderToStaticMarkup(content())
  expect(markup).not.toContain('<label>Type')
  expect(markup).not.toMatch(/<label[^>]*>Ancestry<\/label>/)
  expect(markup).toContain('aria-label="Follower 1 type"')
  expect(markup).toContain('aria-label="Follower 1 ancestry"')
  expect(renderToStaticMarkup(content())).toContain('Experienced')
  expect(findSelect(content(), 'Follower 2 type')).toBeDefined()
  expect(renderToStaticMarkup(<MinionsSummary c={c} />)).toContain('Elf Scout')
  expect(findSelect(FollowerCards({ c: { ...c, level: 1 }, entries: [elf], save }), 'Follower 1 type')).toBeUndefined()
  expect(c.followers?.[0].ancestry).toBe('Elf')
  const withCompanion = { ...c, companions: [{ id: 'wolf', name: '', type: 'Wolf' }] }
  const ordered = renderToStaticMarkup(<MinionsContent c={withCompanion} entries={[elf]} save={save} />)
  expect(ordered.indexOf('<h4>Elf Scout</h4>')).toBeLessThan(ordered.indexOf('<h4>Young Wolf</h4>'))
})

it('alphabetizes individual minions in the summary and sections without follower advancement in titles', () => {
  const c: Character = { id: 'captain', name: 'Test', systems: ['pf2e'], level: 14,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Captain Dedication', type: 'Archetype Feat', level: 2 },
      { name: 'Additional Follower', type: 'Archetype Feat', level: 4 },
      { name: 'Exceptional Follower', type: 'Archetype Feat', level: 14 },
      { name: 'Leader of All', type: 'Archetype Feat', level: 4 }],
    followers: [{ type: 'Sharpshooter', ancestry: 'Orc' }, { type: 'Scout', ancestry: 'Elf' }],
    companions: [{ id: 'wolf', type: 'Wolf', name: '' }, { id: 'bear', type: 'Bear', name: '' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const summary = renderToStaticMarkup(<MinionsSummary c={c} />)
  expect(summary).toContain('Elf Scout, Orc Sharpshooter, Young Bear, Young Wolf')
  expect(summary).not.toContain('Exceptional Orc Sharpshooter')
  const html = renderToStaticMarkup(<MinionsContent c={c} entries={[]} save={() => {}} />)
  const headings = [...html.matchAll(/<h4>([^<]+)<\/h4>/g)].map(match => match[1])
  expect(headings).toEqual(['Elf Scout', 'Orc Sharpshooter', 'Young Bear', 'Young Wolf'])
})

it('shows follower advancement and retains adept choices', () => {
  let c: Character = { id: 'captain', name: 'Test', systems: ['pf2e'], level: 14,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Captain Dedication', type: 'Archetype Feat', level: 2 },
      { name: 'Exceptional Follower', type: 'Archetype Feat', level: 14 }],
    followers: [{ type: 'Sharpshooter', name: 'Old name' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const content = () => FollowerCards({ c, entries: [], save })
  const html = renderToStaticMarkup(content())
  expect(html).toContain('Human Sharpshooter')
  expect(html).not.toContain('Old name')
  expect(html).toContain('3d6+4 piercing')
  expect(html).toContain('Following Shot')
  expect(html).toContain('ignoring concealment')
  findSelect(content(), 'Follower 1 type')!({ target: { value: 'Adept' } })
  const adept = renderToStaticMarkup(content())
  expect(adept).not.toMatch(/<label>Energy \d/)
  expect(adept).toContain('aria-label="Follower 1 energy 2"')
  findSelect(content(), 'Follower 1 adept skill')!({ target: { value: 'Occultism' } })
  findSelect(content(), 'Follower 1 energy 1')!({ target: { value: 'Fire' } })
  findSelect(content(), 'Follower 1 energy 3')!({ target: { value: 'Force' } })
  expect(c.followers?.[0]).toMatchObject({ adeptSkill: 'Occultism', energyTypes: ['Fire', '', 'Force'] })
  expect(renderToStaticMarkup(content())).toContain('fire / force')
  const novice = renderToStaticMarkup(FollowerCards({ c: { ...c, level: 2 }, entries: [], save }))
  expect(novice).not.toContain('Force')
  expect(c.followers?.[0].energyTypes?.[2]).toBe('Force')
})

it('omits Captain companion restrictions from feat details', () => {
  const entry: ContentEntry = { id: 'captain', name: 'Captain Dedication', kind: 'feat', systems: ['pf2e'],
    source: 'official', level: 2, traits: [], data: {}, effects: [], updatedAt: 0,
    description: "Prerequisites Charisma +2; you don't have an animal companion, construct companion, or other companion that functions similarly\n\nSpecial Once you have a follower, you can never take a feat or class feature that grants an animal companion or another companion that prevents you from having an animal companion." }
  const html = renderToStaticMarkup(<EntryDescription name={entry.name} entry={entry} />)
  expect(html).toContain('Charisma +2')
  expect(html).not.toContain('animal companion')
})

it('displays and dismisses a saved summoned fiend', () => {
  const [fiend] = normalizeFiends([{ _id: 'creature-1', _source: {
    name: 'Test Demon', url: '/Monsters.aspx?ID=1', level: 4, rarity: 'common', trait: ['Fiend', 'Demon'],
    hp: 40, ac: 20, strength: 3,
  } }])
  let c: Character = { id: 'fiend', name: 'Test', systems: ['pf2e'], level: 13,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    summonedFiend: JSON.parse(JSON.stringify(fiend)), activeSpells: ['Bless', 'Summon Fiend'] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={save} />)
  expect(markup).toContain('Summoned Test Demon')
  expect(markup).toContain('Hit Points</small><b>40</b>')
  expect(markup).toContain('Armor Class</small><b>20</b>')
  expect(markup).toContain('—')
  expect(renderToStaticMarkup(<MinionsSummary c={c} />)).toContain('Summoned Test Demon')
  const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
  vi.stubGlobal('window', { confirm })
  const dismiss = findButton(SummonedFiendCard({ fiend, activeSpells: c.activeSpells, save }), 'Dismiss summoned Test Demon')!
  dismiss()
  expect(c.summonedFiend).toBeDefined()
  dismiss()
  expect(c.summonedFiend).toBeUndefined()
  expect(c.activeSpells).toEqual(['Bless'])
})

it('protects companions, familiars, pets, followers and summons together', () => {
  const previous = getSettings().protectCompanionAll
  onTestFinished(() => updateSettings({ protectCompanionAll: previous }))
  updateSettings({ protectCompanionAll: true })
  const [summon] = normalizeFiends([{ _id: 'creature-1', _source: {
    name: 'Test Demon', url: '/Monsters.aspx?ID=1', level: 4, rarity: 'common', trait: ['Fiend'], hp: 40, ac: 20,
  } }])
  const bear: ContentEntry = { id: 'bear', name: 'Bear', systems: ['pf2e'], kind: 'companion', source: 'official',
    level: 1, traits: [], description: '', data: { size: 'Small', hp: 8, dexterity: 2 }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 5, className: 'Witch',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Captain Dedication', type: 'Archetype Feat', level: 2 },
      { name: 'Beast Trainer', type: 'Ancestry Feat', level: 1, choice: 'Pet' }],
    spells: [{ name: 'Protect Companion', rank: 0, cantrip: true }],
    companions: [{ id: 'bear', type: 'Bear', name: '' }],
    followers: [{ type: 'Scout' }], pet: { abilities: [] }, summonedFiend: summon,
    summonedPlant: { ...summon, name: 'Unknown AC', ac: undefined },
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const render = (character: Character) => renderToStaticMarkup(<MinionsContent c={character} entries={[bear]} save={() => {}} />)
  const armorClasses = (markup: string) => [...markup.matchAll(/<small>Armor Class<\/small><b>(\d+|—)/g)].map(match => match[1])
  const baseline = armorClasses(render(c))
  const protectedClasses = armorClasses(render({ ...c, activeSpells: ['Protect Companion'] }))
  expect(baseline).toHaveLength(6)
  expect(protectedClasses).toEqual(baseline.map(value => value === '—' ? '—' : String(Number(value) + 1)))
  updateSettings({ protectCompanionAll: false })
  const single = armorClasses(render({ ...c, activeSpells: ['Protect Companion'], protectCompanionId: 'bear' }))
  expect(single.filter((value, index) => value !== baseline[index])).toHaveLength(1)
})

it('displays and dismisses a summoned plant independently from a fiend', () => {
  const [creature] = normalizeFiends([{ _id: 'creature-1', _source: {
    name: 'Test Plant', url: '/Monsters.aspx?ID=1', level: 4, rarity: 'common', trait: ['Fiend', 'Plant'], hp: 40,
  } }])
  let c: Character = { id: 'plant', name: 'Test', systems: ['pf2e'], level: 13,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    summonedPlant: creature, summonedFiend: creature }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(renderToStaticMarkup(<MinionsSummary c={c} />)).toContain('Summoned Test Plant')
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={save} />)).toContain('Hit Points</small><b>40</b>')
  vi.stubGlobal('window', { confirm: () => true })
  findButton(SummonedFiendCard({ fiend: creature, save, plant: true }), 'Dismiss summoned Test Plant')!()
  expect(c.summonedPlant).toBeUndefined()
  expect(c.summonedFiend).toBeDefined()
})

it('toggles the Creature Ally caypin and applies a GM-selected Creature Shape animal form', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  onTestFinished(() => updateSettings({ innateAutoHeighten: previous }))
  const spell = (name: string, level: number, trait: string): ContentEntry => ({
    id: name, name, kind: 'spell', systems: ['sf2e'], source: 'official', level, traits: [trait],
    description: trait === 'Polymorph' ? 'You transform into a battle form.' : '',
    data: { tradition: 'Arcane, Primal', actions: trait === 'Summon' ? 'Three Actions' : 'Two Actions' },
    effects: [], updatedAt: 0,
  })
  const entries = [spell('Summon Animal', 1, 'Summon'), spell('Animal Form', 2, 'Polymorph')]
  let c: Character = { id: 'vesk', name: 'Test', systems: ['sf2e'], level: 17, ancestry: 'Vesk',
    abilities: { str: 10, dex: 80, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Ally', type: 'Ancestry Feat', level: 13, choice: 'Summon Animal' },
      { name: 'Creature Shape', type: 'Ancestry Feat', level: 17, choice: 'Animal Form' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
  expect(markup).toContain('aria-label="Summon Animal options"')
  expect(markup).toContain('aria-label="Animal Form options"')
  const shapeRank = grantedFeatSpells(c, entries).find(grant => grant.source === 'Creature Shape')!.rank
  expect(markup).toContain(`Primal Spell Rank ${shapeRank}`)
  expect(markup).toContain('GM approval required')
  const ally = () => CaypinAllyToggle({ c, save })
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={entries} save={save} />)).not.toContain('Summoned Caypin')
  findToggle(ally(), 'Summoned Caypin active')!({ target: { checked: true } })
  const caypin = renderToStaticMarkup(<MinionsSection c={c} entries={entries} save={save} />)
  expect(caypin).toContain('Summoned Caypin')
  expect(caypin).toContain('Athletics +15')
  expect(caypin).toContain('Appendage Cluster')
  expect(caypin).toContain('2d8+8 piercing')
  expect(renderToStaticMarkup(<MinionsSummary c={c} />)).toContain('Summoned Caypin')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, ancestry: 'Human' }} entries={entries} save={save} />)).not.toContain('Summoned Caypin')
  findToggle(ally(), 'Summoned Caypin active')!({ target: { checked: false } })
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={entries} save={save} />)).not.toContain('Summoned Caypin')
  const normalAC = armorClass(c, entries)
  expect(normalAC).toBeGreaterThan(35)
  const shape = () => CreatureShapeOptions({ c, entries, save, rank: shapeRank })
  findSelect(shape(), 'Caypin battle form')!({ target: { value: 'Bear' } })
  expect(activeBattleForm(c, entries)).toMatchObject({ name: 'Bear', rank: shapeRank, source: 'Creature Shape', temporaryHp: 20 })
  expect(armorClass(c, entries)).toBe(Math.max(normalAC, 35))
  expect(movementSpeeds(c, entries).find(speed => speed.name === 'Land')?.feet).toBe(30)
  expect(ownedWeapons(c, entries).map(weapon => weapon.name)).toEqual(['Bear Jaws', 'Bear Claw'])
  findSelect(shape(), 'Caypin battle form')!({ target: { value: 'Caypin' } })
  expect(activeBattleForm(c, entries)).toMatchObject({ name: 'Caypin', source: 'Creature Shape', speed: 40, swimSpeed: 30,
    attacks: [{ name: 'Caypin Claw', data: expect.objectContaining({ damage: '4d6 slashing' }), traits: expect.arrayContaining(['Agile']) },
      { name: 'Caypin Jaws', data: expect.objectContaining({ damage: '4d8 piercing' }) }] })
  expect(ownedWeapons(c, entries).map(weapon => weapon.name)).toEqual(['Caypin Claw', 'Caypin Jaws'])
  expect(movementSpeeds(c, entries)).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'Land', feet: 40 }), expect.objectContaining({ name: 'Swim', feet: 30 }),
  ]))
  expect(activeBattleForm({ ...c, feats: [] }, entries)).toBeUndefined()
  expect(spellActiveChange(c, 'Dinosaur Form', true).creatureShape).toBeUndefined()
  const dismiss = Children.toArray(shape().props.children).find(child =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === 'button')
  expect(isValidElement<{ onClick: () => void }>(dismiss)).toBe(true)
  if (isValidElement<{ onClick: () => void }>(dismiss)) dismiss.props.onClick()
  expect(activeBattleForm(c, entries)).toBeUndefined()
})

it('grants Lashunta Creature Shape as occult Animal Form with two custom creature forms', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  onTestFinished(() => updateSettings({ innateAutoHeighten: previous }))
  const spell: ContentEntry = { id: 'animal-form', name: 'Animal Form', kind: 'spell', systems: ['sf2e'],
    source: 'official', level: 2, traits: ['Polymorph'], description: 'You transform into a battle form.',
    data: { tradition: 'Primal', actions: 'Two Actions' }, effects: [], updatedAt: 0 }
  const entries = [spell]
  let c: Character = { id: 'lashunta', name: 'Test', systems: ['sf2e'], level: 17, ancestry: 'Lashunta',
    abilities: { str: 10, dex: 80, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Shape', type: 'Ancestry Feat', level: 17, slot: 'ancestry:17:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(featChoiceOptions('Creature Shape', c, entries, 'ancestry:17:0')).toBeUndefined()
  expect(featSpellOptions(c, entries, c.feats[0])).toBeUndefined()
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={entries} save={save} index={0} />)).toBe('')
  const legacy = { ...c, feats: [{ ...c.feats[0], choice: 'Dinosaur Form' }] }
  const legacyMarkup = renderToStaticMarkup(<FeatSlots c={legacy} entries={entries} save={save} categories={['ancestry']} />)
  expect(legacyMarkup).not.toContain('Creature Shape (Dinosaur Form)')
  expect(legacyMarkup).not.toContain('Creature Shape spell')
  expect(grantedFeatSpells(legacy, entries)[0].entry.name).toBe('Animal Form')
  expect(featSpellOptions({ ...c, ancestry: 'Vesk' }, entries, c.feats[0])?.map(option => option.name)).toContain('Animal Form')
  expect(grantedFeatSpells(c, entries)).toEqual([expect.objectContaining({ entry: spell, source: 'Creature Shape', rank: 8,
    rule: expect.objectContaining({ tradition: 'occult', frequency: 'once per day', fixedRank: true }) })])
  expect(grantedFeatSpells({ ...c, level: 16 }, entries)).toEqual([])
  expect(unresolvedFeatSpells(c, [])).toContainEqual(expect.objectContaining({ name: 'Animal Form' }))
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
  expect(markup).toContain('Occult Spell Rank 8')
  expect(markup).toContain('aria-label="Creature Shape battle form"')
  expect(markup).toContain('<option>Shotalashu</option>')
  expect(markup).toContain('<option>Squox</option>')
  expect(markup).not.toContain('<option>Bear</option>')
  const shape = () => CreatureShapeOptions({ c, entries, save, rank: 8 })
  const normalAC = armorClass(c, entries)
  findSelect(shape(), 'Creature Shape battle form')!({ target: { value: 'Shotalashu' } })
  expect(activeBattleForm(c, entries)).toMatchObject({ name: 'Shotalashu', source: 'Creature Shape', rank: 8,
    speed: 40, temporaryHp: 20, attacks: [expect.objectContaining({ name: 'Shotalashu Claw',
      data: expect.objectContaining({ damage: '2d10 slashing' }), traits: expect.arrayContaining(['Agile']) })] })
  expect(armorClass(c, entries)).toBe(Math.max(normalAC, 35))
  expect(ownedWeapons(c, entries).map(weapon => weapon.name)).toEqual(['Shotalashu Claw'])
  findSelect(shape(), 'Creature Shape battle form')!({ target: { value: 'Squox' } })
  expect(activeBattleForm(c, entries)).toMatchObject({ name: 'Squox', speed: 25, climbSpeed: 20,
    attacks: [expect.objectContaining({ name: 'Squox Jaws', data: expect.objectContaining({ damage: '4d4 piercing' }) })] })
  expect(movementSpeeds(c, entries)).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'Land', feet: 25 }), expect.objectContaining({ name: 'Climb', feet: 20 }),
  ]))
  expect(activeBattleForm({ ...c, feats: [] }, entries)).toBeUndefined()
  expect(spellActiveChange(c, 'Dinosaur Form', true).creatureShape).toBeUndefined()
})

it('grants Shirren Creature Shape as occult Insect Form using the ant form', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  onTestFinished(() => updateSettings({ innateAutoHeighten: previous }))
  const spell: ContentEntry = { id: 'insect-form', name: 'Insect Form', kind: 'spell', systems: ['sf2e'],
    source: 'official', level: 3, traits: ['Polymorph'], description: 'You transform into a battle form.',
    data: { tradition: 'Primal', actions: 'Two Actions' }, effects: [], updatedAt: 0 }
  const entries = [spell]
  let c: Character = { id: 'shirren', name: 'Test', systems: ['sf2e'], level: 17, ancestry: 'Shirren',
    abilities: { str: 10, dex: 80, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Shape', type: 'Ancestry Feat', level: 17, slot: 'ancestry:17:0', choice: 'Animal Form' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(featChoiceOptions('Creature Shape', c, entries, 'ancestry:17:0')).toBeUndefined()
  expect(featSpellOptions(c, entries, c.feats[0])).toBeUndefined()
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={entries} save={save} index={0} />)).toBe('')
  expect(grantedFeatSpells(c, entries)).toEqual([expect.objectContaining({ entry: spell, source: 'Creature Shape', rank: 8,
    rule: expect.objectContaining({ tradition: 'occult', frequency: 'once per day', fixedRank: true }) })])
  expect(grantedFeatSpells({ ...c, level: 16 }, entries)).toEqual([])
  expect(unresolvedFeatSpells(c, [])).toContainEqual(expect.objectContaining({ name: 'Insect Form' }))
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
  expect(markup).toContain('Occult Spell Rank 8')
  expect(markup).toContain('aria-label="Kucharn form active"')
  expect(markup).not.toContain('aria-label="Kucharn battle form"')
  expect(markup).not.toContain('<option>Bear</option>')
  const normalAC = armorClass(c, entries)
  const shape = () => CreatureShapeOptions({ c, entries, save, rank: 8 })
  findToggle(shape(), 'Kucharn form active')!({ target: { checked: true } })
  expect(activeBattleForm(c, entries)).toMatchObject({ name: 'Ant', source: 'Creature Shape', rank: 8,
    speed: 30, climbSpeed: 30, temporaryHp: 20,
    attacks: [expect.objectContaining({ name: 'Ant Mandibles', data: expect.objectContaining({ damage: '4d6 bludgeoning' }) })] })
  expect(armorClass(c, entries)).toBe(Math.max(normalAC, 35))
  expect(ownedWeapons(c, entries).map(weapon => weapon.name)).toEqual(['Ant Mandibles'])
  expect(activeBattleForm({ ...c, creatureShape: { form: 'Spider', rank: 8 } }, entries)?.name).toBe('Ant')
  expect(activeBattleForm({ ...c, feats: [] }, entries)).toBeUndefined()
  expect(spellActiveChange(c, 'Dinosaur Form', true).activeSpells).not.toContain('Insect Form')
})

it('grants Shirren Creature Ally as occult Summon Animal and summons an emganat', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  onTestFinished(() => updateSettings({ innateAutoHeighten: previous }))
  const spell: ContentEntry = { id: 'summon-animal', name: 'Summon Animal', kind: 'spell', systems: ['sf2e'],
    source: 'official', level: 1, traits: ['Summon'], description: '', data: { tradition: 'Primal', actions: 'Three Actions' },
    effects: [], updatedAt: 0 }
  const entries = [spell]
  let c: Character = { id: 'shirren-ally', name: 'Test', systems: ['sf2e'], level: 13, ancestry: 'Shirren',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Ally', type: 'Ancestry Feat', level: 13, slot: 'ancestry:13:0', choice: 'Summon Dragon' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(featChoiceOptions('Creature Ally', c, entries, 'ancestry:13:0')).toBeUndefined()
  expect(featSpellOptions(c, entries, c.feats[0])).toBeUndefined()
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={entries} save={save} index={0} />)).toBe('')
  expect(grantedFeatSpells(c, entries)).toEqual([expect.objectContaining({ entry: spell, source: 'Creature Ally', rank: 5,
    rule: expect.objectContaining({ tradition: 'occult', frequency: 'once per day', fixedRank: true, condition: 'Kucharn only' }) })])
  expect(grantedFeatSpells({ ...c, level: 12 }, entries)).toEqual([])
  expect(unresolvedFeatSpells(c, [])).toContainEqual(expect.objectContaining({ name: 'Summon Animal' }))
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
  expect(markup).toContain('Occult Spell Rank 5')
  expect(markup).toContain('aria-label="Summoned Kucharn active"')
  expect(markup).toContain('GM approval required')
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={entries} save={save} />)).not.toContain('Summoned Kucharn')
  findToggle(ShirrenAllyToggle({ c, save }), 'Summoned Kucharn active')!({ target: { checked: true } })
  const minions = renderToStaticMarkup(<MinionsSection c={c} entries={entries} save={save} />)
  expect(minions).toContain('Summoned Kucharn')
  expect(minions).toContain('Emganat abilities and statistics')
  expect(minions).toContain('Kucharn')
  expect(minions).toContain('1d8+4 piercing')
  expect(minions).toContain('Resistances acid 5')
  expect(renderToStaticMarkup(<MinionsSummary c={c} />)).toContain('Summoned Kucharn')
  expect(renderToStaticMarkup(<MinionsSummary c={{ ...c, level: 12 }} />)).not.toContain('Summoned Kucharn')
  findToggle(ShirrenAllyToggle({ c, save }), 'Summoned Kucharn active')!({ target: { checked: false } })
  expect(renderToStaticMarkup(<MinionsSummary c={c} />)).not.toContain('Summoned Kucharn')
})

it('grants Lashunta Creature Ally as occult Summon Animal and shows the selected summoned creature', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  onTestFinished(() => updateSettings({ innateAutoHeighten: previous }))
  const spell: ContentEntry = { id: 'summon-animal', name: 'Summon Animal', kind: 'spell', systems: ['sf2e'],
    source: 'official', level: 1, traits: ['Summon'], description: '', data: { tradition: 'Arcane, Primal' },
    effects: [], updatedAt: 0 }
  const entries = [spell]
  let c: Character = { id: 'lashunta', name: 'Test', systems: ['sf2e'], level: 13, ancestry: 'Lashunta',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Ally', type: 'Ancestry Feat', level: 13, slot: 'ancestry:13:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(featChoiceOptions('Creature Ally', c, entries, 'ancestry:13:0')).toBeUndefined()
  expect(featSpellOptions(c, entries, c.feats[0])).toBeUndefined()
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={entries} save={save} index={0} />)).toBe('')
  expect(grantedFeatSpells(c, entries)).toEqual([expect.objectContaining({ entry: spell, source: 'Creature Ally', rank: 5,
    rule: expect.objectContaining({ tradition: 'occult', frequency: 'once per day' }) })])
  expect(grantedFeatSpells({ ...c, level: 12 }, entries)).toEqual([])
  expect(unresolvedFeatSpells(c, [])).toContainEqual(expect.objectContaining({ name: 'Summon Animal' }))
  const spells = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
  expect(spells).toContain('Occult Spell Rank 5')
  expect(spells).toContain('aria-label="Creature Ally summoned creature"')
  const select = () => findSelect(LashuntaAllyOptions({ c, save }), 'Creature Ally summoned creature')!
  const minions = () => renderToStaticMarkup(<MinionsSection c={c} entries={entries} save={save} />)
  select()({ target: { value: 'Squox' } })
  expect(minions()).toContain('Summoned Squox')
  expect(renderToStaticMarkup(<MinionsSummary c={c} />)).toContain('Summoned Squox')
  expect(minions()).toContain('1d4 piercing')
  expect(minions()).toContain('Thievery +6')
  expect(minions()).toContain('Squox Tricks')
  select()({ target: { value: 'Shotalashu' } })
  expect(minions()).toContain('Summoned Shotalashu')
  expect(minions()).toContain('<small>Hit Points</small><b>35</b>')
  expect(minions()).toContain('Survival +7')
  expect(minions()).toContain('Telepathic Pounce')
  expect(minions()).toContain('DC 18 Will save')
  updateSettings({ innateAutoHeighten: true })
  expect(grantedFeatSpells(c, entries)[0].rank).toBe(7)
  expect(minions()).toContain('<span>Level 9</span>')
  expect(minions()).toContain('<small>Hit Points</small><b>160</b>')
  expect(minions()).toContain('DC 28 Will save')
  expect(minions()).toContain('Survival +18')
  expect(minions()).toContain('1d6+14 slashing')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, level: 20 }} entries={entries} save={save} />)).toContain('<span>Level 15</span>')
  expect(renderToStaticMarkup(<MinionsSummary c={c} />)).toContain('Summoned Shotalashu')
  expect(minions()).not.toContain('Summoned Squox')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, level: 12 }} entries={entries} save={save} />)).not.toContain('Summoned Shotalashu')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, ancestry: 'Vesk' }} entries={entries} save={save} />)).not.toContain('Summoned Shotalashu')
  select()({ target: { value: '' } })
  expect(minions()).not.toContain('Summoned Shotalashu')
})

it('summons a scaled cat for Pahtra Creature Ally at the selected spell rank', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  onTestFinished(() => updateSettings({ innateAutoHeighten: previous }))
  const spell: ContentEntry = { id: 'summon-animal', name: 'Summon Animal', kind: 'spell', systems: ['sf2e'],
    source: 'official', level: 1, traits: ['Summon'], description: '', data: { tradition: 'Arcane, Primal' },
    effects: [], updatedAt: 0 }
  const entries = [spell]
  const c: Character = { id: 'pahtra', name: 'Test', systems: ['sf2e'], level: 13, ancestry: 'Pahtra',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Ally', type: 'Ancestry Feat', level: 13, choice: 'Summon Animal' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0, creatureAllyActive: true }
  const minions = (character: Character) => renderToStaticMarkup(<MinionsSection c={character} entries={entries} save={() => {}} />)
  expect(grantedFeatSpells(c, entries)).toContainEqual(expect.objectContaining({ entry: spell, rank: 5,
    rule: expect.objectContaining({ tradition: 'primal', condition: 'Cat only' }) }))
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)).not.toContain('Cat only')
  expect(minions(c)).toContain('Summoned Cat')
  expect(minions(c)).toContain('<span>Level 5</span>')
  expect(minions(c)).toContain('Leopard abilities and statistics')
  expect(minions(c)).toContain('1d10+8 piercing plus Grab')
  expect(minions(c)).toContain('custom scaling')
  expect(renderToStaticMarkup(<MinionsSummary c={c} />)).toContain('Summoned Cat')
  for (const inactive of [{ ...c, creatureAllyActive: false }, { ...c, level: 12 },
    { ...c, feats: [] }, { ...c, ancestry: 'Vesk' },
    { ...c, feats: [{ ...c.feats[0], choice: 'Summon Dragon' }] }]) {
    expect(minions(inactive)).not.toContain('Summoned Cat')
  }
  updateSettings({ innateAutoHeighten: true })
  expect(grantedFeatSpells(c, entries)[0].rank).toBe(7)
  expect(minions(c)).toContain('<span>Level 9</span>')
  expect(minions({ ...c, level: 20 })).toContain('<span>Level 15</span>')
})

it('allows riding only larger current summons and uses their movement modes', () => {
  const c: Character = { id: 'rider', name: 'Test', systems: ['sf2e'], level: 13, ancestry: 'Lashunta',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Creature Ally', type: 'Ancestry Feat', level: 13 }], lashuntaCreatureAlly: 'Shotalashu',
    mountedSummon: 'ally:Shotalashu', equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const ancestry: ContentEntry = { id: 'lashunta', name: 'Lashunta', systems: ['sf2e'], kind: 'ancestry',
    level: 1, traits: [], source: 'official', description: '', data: { size: 'Medium' }, effects: [], updatedAt: 0 }
  expect(summonedMounts(c, [ancestry]).map(mount => mount.name)).toEqual(['Shotalashu'])
  expect(movementSpeeds(c, [ancestry])).toEqual([{ name: 'Land', feet: 40, source: 'Mounted: Shotalashu' }])
  expect(summonedMounts(c, [{ ...ancestry, data: { size: 'Large' } }])).toEqual([])
  expect(movementSpeeds({ ...c, lashuntaCreatureAlly: 'Squox' }, [ancestry])[0].feet).toBe(25)
  expect(summonedMounts({ ...c, lashuntaCreatureAlly: 'Squox' }, [ancestry])).toEqual([])
  const fiend = { id: 'mount', name: 'Demon', level: 5, traits: ['Huge', 'Fiend'], url: '', abilities: [],
    saves: [], senses: '', skills: '', speed: '35 feet, climb 15 feet, fly 40 feet',
    resistances: '', weaknesses: '', attacks: [] }
  expect(movementSpeeds({ ...c, summonedFiend: fiend, mountedSummon: 'fiend:mount' }, [ancestry])).toEqual([
    { name: 'Land', feet: 35, source: 'Mounted: Demon' },
    { name: 'Climb', feet: 15, source: 'Mounted: Demon' },
    { name: 'Fly', feet: 40, source: 'Mounted: Demon' },
  ])
  expect(movementSpeeds({ ...c, summonedUndead: { ...fiend, name: 'Soulbound Ruin', speed: "can't move" },
    mountedSummon: 'undead:mount' }, [ancestry]))
    .toEqual([{ name: 'Land', feet: 0, source: 'Mounted: Soulbound Ruin' }])
})

it('selects one mounted companion for Mounted Parry and shows its AC source', () => {
  const animal: ContentEntry = { ...CONSTRUCT_COMPANION_ENTRY, id: 'bear', name: 'Bear', traits: ['Animal'] }
  const weapon: ContentEntry = { ...animal, id: 'sword', name: 'Sword', kind: 'weapon', traits: ['Parry'],
    data: { weapon_type: 'Melee', hands: 1 } }
  let c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 6, className: 'Champion',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Mounted Parry', type: 'Class Feat', level: 6 }], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    parrying: true, weapons: [{ id: 'sword', name: 'Sword', potency: 0, striking: 0, runes: [] }],
    companions: [{ id: 'a', type: 'Bear', name: 'A' }, { id: 'b', type: 'Bear', name: 'B' }] }
  const entries = [animal, weapon]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const content = () => MinionsContent({ c, entries, save })
  const statuses = () => StatusesContent({ c, entries, save })
  findToggle(statuses(), 'Mounted on A')!({ target: { checked: true } })
  expect(c.mountedCompanionId).toBe('a')
  expect(renderToStaticMarkup(content())).toContain('Mounted Parry')
  findToggle(statuses(), 'Mounted on B')!({ target: { checked: true } })
  expect(c.mountedCompanionId).toBe('b')
  findToggle(statuses(), 'Mounted on B')!({ target: { checked: false } })
  expect(c.mountedCompanionId).toBeUndefined()
  expect(renderToStaticMarkup(MinionsContent({ c: { ...c, feats: [] }, entries, save }))).not.toContain('Mounted on A')
})

it('allows selecting a mount for Mounted Shield and displays its shared AC bonus', () => {
  const animal: ContentEntry = { ...CONSTRUCT_COMPANION_ENTRY, id: 'bear', name: 'Bear', traits: ['Animal'] }
  let c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 6, className: 'Champion',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Mounted Shield', type: 'Archetype Feat', level: 6 }], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    shield: { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: true },
    companions: [{ id: 'a', type: 'Bear', name: 'A' }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const content = () => MinionsContent({ c, entries: [animal], save })
  findToggle(StatusesContent({ c, entries: [animal], save }), 'Mounted on A')!({ target: { checked: true } })
  expect(c.mountedCompanionId).toBe('a')
  expect(renderToStaticMarkup(content())).toContain('+2 Circumstance (Mounted Shield)')
})

it.each(['Cavalier Dedication', 'Born In The Saddle', 'Legendary Rider'])('allows mount selection with %s', name => {
  const animal: ContentEntry = { ...CONSTRUCT_COMPANION_ENTRY, id: 'bear', name: 'Bear', traits: ['Animal'] }
  const c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name, type: 'Archetype Feat', level: 4 }], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'a', type: 'Bear', name: 'A' }] }
  expect(renderToStaticMarkup(StatusesContent({ c, entries: [animal], save: () => {} }))).toContain('Mounted on A')
})

const familiarAbility = (name: string, description: string, abilityType = 'Familiar'): ContentEntry => ({
  id: `familiar:${name}`, systems: ['pf2e'], name, kind: 'familiar', source: 'official', level: 1,
  traits: [], description, data: { ability_type: abilityType }, effects: [], updatedAt: 0,
})
const familiarEntries = [
  familiarAbility('Amphibious', 'It gains a swim Speed of 25 feet.'),
  familiarAbility('Burrower', 'It gains a burrow Speed of 5 feet.'),
  familiarAbility('Climber', 'It gains a climb Speed of 25 feet.'),
  familiarAbility('Darkvision', 'It gains darkvision.'),
  familiarAbility('Echolocation', 'It can use hearing as a precise sense within 20 feet.'),
  familiarAbility('Fast Movement', 'Increase one of the familiar’s Speeds from 25 feet to 40 feet.'),
  familiarAbility('Flier', 'It gains a fly Speed of 25 feet.'),
  familiarAbility('Resistance', 'Choose two types; your familiar gains resistance equal to half your level.'),
  familiarAbility('Greater Resistance', 'Your familiar must have the resistance ability to select this.'),
  familiarAbility('Major Resistance', 'Your familiar must have the greater resistance ability and you must be at least 8th level.'),
  familiarAbility('Scent', 'It gains scent (imprecise, 30 feet).'),
  familiarAbility('Skilled', 'Choose a skill. Your familiar’s modifier is equal to your level plus your key spellcasting ability modifier. You can select this ability repeatedly, choosing a different skill each time.'),
  familiarAbility('Tough', 'Your familiar’s maximum Hit Points increase by 2 per level.'),
  familiarAbility('Tremorsense', 'It gains imprecise tremorsense with a range of 30 feet.'),
  familiarAbility('Wavesense', 'It gains imprecise wavesense with a range of 30 feet.'),
  familiarAbility('Dragon', 'Your familiar has the dragon trait instead of the animal trait.'),
  familiarAbility('Restorative Familiar', 'Once per day, your familiar can heal you.', 'Master'),
  familiarAbility('Constructed', 'Your aeon wyrd is immune to bleed and poison.'),
]

it('applies familiar ability prerequisites, movement, senses, skills, resistance, and HP', () => {
  const c: Character = { id: 'abilities', name: 'Test', systems: ['pf2e'], level: 8, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, feats: [], equipment: [],
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const familiar = familiarAbilityEffects(['Tough', 'Amphibious', 'Fast Movement', 'Echolocation', 'Resistance', 'Greater Resistance', 'Major Resistance', 'Skilled'],
    c.level, { fastMovement: 'Swim', resistance: ['fire', 'cold'], skilled: ['Arcana'] }, 4)
  expect(familiar).toMatchObject({
    hitPoints: 56,
    speeds: [{ movement: 'Land', feet: 40 }, { movement: 'Swim', feet: 40 }],
    senses: ['Hearing (precise, 20 feet)'],
    resistances: [{ damage: 'fire', value: 8 }, { damage: 'cold', value: 8 }],
    skilled: [{ skill: 'Arcana', modifier: 12 }],
  })
  expect(familiarAbilityUnavailableReason(familiarEntries.find(entry => entry.name === 'Greater Resistance')!, c,
    ['Resistance'])).toBeUndefined()
  expect(familiarAbilityUnavailableReason(familiarEntries.find(entry => entry.name === 'Major Resistance')!, c,
    ['Resistance'])).toBe('Requires the greater resistance familiar ability.')
  expect(familiarAbilityUnavailableReason(familiarEntries.find(entry => entry.name === 'Dragon')!, c, [], true))
    .toContain('cannot select an ability that changes its trait')
})

it('shows a plain Mount label only when eligible, without Rider helper text or character changes', () => {
  const c: Character = {
    id: 'rider', systems: ['pf2e'], name: 'Test', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Rider', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'bird', type: 'Bird', name: '' }],
  }
  const bird: ContentEntry = {
    id: 'bird', systems: ['pf2e'], name: 'Bird', kind: 'companion', source: 'official', level: 1,
    traits: ['Animal'], description: '', effects: [], updatedAt: 0,
    data: { size: 'Small', hp: 4, strength: 2, dexterity: 3, constitution: 1, intelligence: -4,
      wisdom: 2, charisma: 0, speed_raw: '10 feet, fly 60 feet', companion_support: 'Distract your foes.' },
  }
  const before = JSON.stringify(c)
  const render = (character = c, entry = bird) => renderToStaticMarkup(<MinionsContent c={character} entries={[entry]} save={() => {}} />)
  expect(render()).not.toContain('full mount special ability')
  expect(render()).not.toContain('move and Support you on the same turn')
  expect(render()).toContain('<h5>Special</h5><div>None</div>')
  expect(render()).toContain('<span>Animal</span><span>Minion</span>')
  const plant = render(c, { ...bird, traits: ['Plant', 'Minion'] })
  expect(plant).toContain('<span>Minion</span><span>Plant</span>')
  expect(plant).not.toContain('<span>Animal</span>')
  const large = render(c, { ...bird, data: { ...bird.data, size: 'Large' } })
  expect(large).toContain('<h5>Special</h5><div>Mount</div>')
  expect(large).not.toContain('<span>Mount</span>')
  expect(large).not.toContain('full mount special ability')
  expect(render({ ...c, feats: [] })).not.toContain('it can move and Support you on the same turn')
  expect(render(c, { ...bird, data: { ...bird.data, mount: true } })).toContain('<h5>Special</h5><div>Mount</div>')
  expect(render(c, { ...bird, data: { ...bird.data, mount: true } })).not.toContain('it can move and Support you on the same turn')
  expect(JSON.stringify(c)).toBe(before)
})

it('opens Special summaries by name without asterisks and capitalizes attack labels without changing saved data', () => {
  const c: Character = {
    id: 'specials', systems: ['pf2e'], name: 'Test', level: 20, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Beastmaster Bond', type: 'Dedication Feat', level: 4 },
      { name: 'Heightened Instincts', type: 'Dedication Feat', level: 18 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'horse', type: 'Horse', name: '' }],
  }
  const horse: ContentEntry = {
    id: 'horse', systems: ['pf2e'], name: 'Horse', kind: 'companion', source: 'official', level: 1,
    traits: ['Animal'], description: '', effects: [], updatedAt: 0,
    data: { size: 'Medium', hp: 8, companion_attacks: 'hoof|1d6 bludgeoning|agile, finesse;tail lash|1d4 bludgeoning|' },
  }
  const instincts: ContentEntry = { ...horse, id: 'instincts', name: 'Heightened Instincts', kind: 'feat',
    description: 'Succeeding at a save improves the result.', data: {}, level: 18 }
  const before = JSON.stringify({ c, horse })
  const markup = renderToStaticMarkup(<MinionsContent c={c} entries={[horse, instincts]} save={() => {}} />)
  const special = markup.slice(markup.indexOf('<h5>Special</h5>'), markup.indexOf('<h5>Speed</h5>'))
  for (const name of ['Beastmaster Bond', 'Heightened Instincts'])
    expect(special).toContain(`aria-haspopup="dialog">${name}</button>`)
  expect(special).toContain('Communicate telepathically with this animal companion within 100 feet.')
  expect(special).toContain('Succeeding at a save improves the result.')
  expect(special).not.toContain('source-note-trigger')
  expect(special).not.toContain('Description unavailable')
  expect(markup).toContain('<b>Hoof</b>')
  expect(markup).toContain('(Agile, Finesse)')
  expect(markup).toContain('<b>Tail Lash</b>')
  expect(markup).not.toContain('<b>hoof</b>')
  expect(JSON.stringify({ c, horse })).toBe(before)
})

it('lists companion types in the type picker once a companion is chosen', () => {
  const horse: ContentEntry = { id: 'horse', systems: ['pf2e'], name: 'Horse', kind: 'companion', source: 'official', level: 1,
    traits: ['Animal'], description: '', effects: [], updatedAt: 0, data: { size: 'Medium', hp: 8 } }
  const c: Character = {
    id: 'steed', systems: ['pf2e'], name: 'Test', level: 1, className: 'Champion',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Faithful Steed', type: 'Class Feat', level: 1 }], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'first', type: 'Horse', name: '' }],
  }
  const markup = renderToStaticMarkup(<MinionsContent c={c} entries={[horse]} save={() => {}} />)
  expect(markup).toContain('<option value="Horse"')
})

it('removes companion and familiar naming controls without erasing saved names', () => {
  let c: Character = {
    id: 'named-companions', systems: ['pf2e'], name: 'Test', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'first', type: 'Badger', name: '', supportActive: true },
      { id: 'second', type: 'Cat', name: 'Whiskers' }],
  }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const tree = () => MinionsContent({ c, entries: [], save })
  expect(findInput(tree(), 'Companion name')).toBeUndefined()
  expect(renderToStaticMarkup(tree())).not.toContain('aria-label="Companion name"')
  findSelect(tree(), 'Companion type')!({ target: { value: 'Riding Badger' } })
  expect(c.companions?.[0]).toMatchObject({ id: 'first', type: 'Riding Badger', name: '', supportActive: false })
  expect(c.companions?.[1].name).toBe('Whiskers')
  c = { ...c, className: 'Witch', familiar: { name: 'Saved familiar' },
    companions: [{ id: 'construct', type: CONSTRUCT_COMPANION_NAME, name: 'Saved' }] }
  const markup = renderToStaticMarkup(tree())
  expect(markup).not.toContain('aria-label="Companion name"')
  expect(markup).not.toContain('aria-label="Familiar name"')
  expect(c.companions?.[0].name).toBe('Saved')
  expect(c.familiar?.name).toBe('Saved familiar')
})

it('shows the built-in Calligraphy Wyrm picker, header, granted abilities and actions for a Wizard familiar', () => {
  const c: Character = {
    id: 'wyrm', systems: ['pf2e'], name: 'Test', level: 8, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }, { name: 'Incredible Familiar', type: 'Class Feat', level: 8 },
      { name: 'Improved Familiar', type: 'Class Feat', level: 6 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { specificFamiliar: 'Calligraphy Wyrm' },
    featAccessOverrides: ['fallback:specific-familiar:calligraphy-wyrm'],
  }
  const markup = renderToStaticMarkup(MinionsContent({ c, entries: [], save: () => {} }))
  expect(markup).toContain('Calligraphy Wyrm')
  expect(markup).not.toContain('Calligraphy Wyrm (4 abilities)')
  expect(markup).toContain('aria-label="Specific familiar"')
  expect(markup).toContain('Manual Dexterity')
  expect(markup).toContain('Ink Spray')
  expect(markup).toContain('know-it-alls')
  expect(markup).toContain('towers of Cobyslarni')
})

it('shows Squox specific familiar grants and Squox Tricks for a Starfinder Technomancer', () => {
  const c: Character = {
    id: 'squox-familiar', systems: ['sf2e'], name: 'Test', level: 5, className: 'Technomancer',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { specificFamiliar: 'Squox', abilities: [] },
  }
  const markup = renderToStaticMarkup(MinionsContent({ c, entries: [], save: () => {} }))
  expect(markup).toContain('<h4>Squox Familiar</h4> (3/3)')
  expect(markup).toContain('Scent (imprecise, 30 feet)')
  expect(markup).toContain('Climb 25 feet')
  expect(markup).toContain('<h5>Skills</h5><div>Acrobatics +9 (T)</div>')
  expect(markup).toContain('Squox Tricks')
  expect(markup).toContain('Disarm or Trip with its tail')
})

it('shows Beastmaster Bond range based on Nature proficiency only for animal companions', () => {
  const c: Character = {
    id: 'bond', systems: ['pf2e'], name: 'Test', level: 15, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Beastmaster Bond', type: 'Archetype Feat', level: 8 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'bird', type: 'Bird', name: '' }],
  }
  const bird: ContentEntry = {
    id: 'bird', systems: ['pf2e'], name: 'Bird', kind: 'companion', source: 'official', level: 1,
    traits: ['Animal'], description: '', effects: [], updatedAt: 0, data: { size: 'Small' },
  }
  const render = (character: Character) => renderToStaticMarkup(<MinionsContent c={character} entries={[bird]} save={() => {}} />)
  expect(render(c)).toContain('telepathically with this animal companion within 100 feet')
  expect(render({ ...c, rankOverrides: { Nature: 4 } })).toContain('telepathically with this animal companion anywhere on the planet')
  expect(render({ ...c, level: 7 })).not.toContain('Beastmaster Bond note')
  expect(render({ ...c, feats: [] })).not.toContain('Beastmaster Bond note')
  const construct = { ...c, companions: [{ id: 'construct', type: CONSTRUCT_COMPANION_NAME, name: '' }] }
  const constructHtml = renderToStaticMarkup(<MinionsContent c={construct} entries={[CONSTRUCT_COMPANION_ENTRY]} save={() => {}} />)
  expect(constructHtml).not.toContain('Beastmaster Bond note')
})

it.each(['Small', 'Medium'])('hides legacy homebrew starting-size prose without modifying saved entries: %s', size => {
  const c: Character = {
    id: 'legacy-companion', systems: ['pf2e'], name: 'Test', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'cat', type: 'Snow Leopard', name: '' }],
  }
  const entry: ContentEntry = {
    id: 'homebrew:snow-leopard', systems: ['pf2e'], name: 'Snow Leopard', kind: 'companion',
    source: 'homebrew', level: 1, traits: [], description: `Custom companion description.\n\nStarts ${size}.`,
    effects: [], updatedAt: 10, data: { size },
  }
  const before = JSON.stringify(entry)
  const render = (companion = entry) => renderToStaticMarkup(<MinionsContent c={c} entries={[companion]} save={() => {}} />)
  const markup = render()
  expect(markup).toContain('Custom companion description.')
  expect(markup).not.toContain(`Starts ${size}.`)
  expect(markup).toContain(`<span>${size}</span>`)
  expect(render({ ...entry, source: 'official' })).toContain(`Starts ${size}.`)
  expect(JSON.stringify(entry)).toBe(before)
})

it('shows granted Ferocity on each eligible minion without consuming familiar or pet choices', () => {
  const c: Character = {
    id: 'ferocious-minions', systems: ['pf2e'], name: 'Test', level: 13, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Ferocious Beasts', type: 'Ancestry Feat', level: 13 },
      { name: 'Undying Ferocity', type: 'Ancestry Feat', level: 9 },
      { name: 'Familiar', type: 'Class Feat', level: 1 },
      { name: 'Pet', type: 'General Feat', level: 1 },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'wolf', type: 'Wolf', name: '' }, { id: 'wolf-2', type: 'Wolf', name: '' },
      { id: 'construct', type: CONSTRUCT_COMPANION_NAME, name: '' }],
    familiar: { abilities: ['Flier'] }, pet: { abilities: ['Climber'] },
  }
  const wolf: ContentEntry = {
    id: 'wolf', systems: ['pf2e'], name: 'Wolf', kind: 'companion', source: 'official', level: 1,
    traits: ['Animal'], description: '', effects: [], updatedAt: 0, data: { size: 'Medium', hp: 6 },
  }
  const entries = [wolf, CONSTRUCT_COMPANION_ENTRY]
  const before = JSON.stringify(c)
  const render = (character = c) => renderToStaticMarkup(<MinionsContent c={character} entries={entries} save={() => {}} />)
  const html = render()
  expect(html.match(/aria-label="Orc Ferocity"/g)).toHaveLength(4)
  expect(html).not.toContain('aria-label="Ferocious Beasts note"')
  expect(html).not.toContain('aria-label="Undying Ferocity note"')
  expect(html).not.toContain('Ferocious Beasts also grants')
  expect(html).not.toContain('Grants Orc Ferocity and one reaction')
  expect(html.match(/Gain 13 temporary HP when using Orc Ferocity/g)).toHaveLength(4)
  expect(html).toContain('Once per day, when reduced to 0 HP but not immediately killed, remain at 1 HP')
  expect(html).toContain('wounded increases by 1')
  expect(html).toContain('One reaction per round, usable only for Orc Ferocity')
  expect(html.match(/One reaction per round, usable only for Orc Ferocity\. Gain 13 temporary HP when using Orc Ferocity\.<\/p>/g)).toHaveLength(4)
  expect(html).toContain('aria-label="Reaction"')
  expect(html).toContain('</h4> (1/2)')
  expect(html).toContain('>Climber</button>')
  const adopted = render({ ...c, ancestry: 'Human', feats: [
    ...c.feats, { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' },
  ] })
  expect(adopted.match(/aria-label="Ferocity"/g)).toHaveLength(4)
  expect(adopted).toContain('Gain 13 temporary HP when using Ferocity')
  expect(adopted).not.toContain('Orc Ferocity')
  const level20 = render({ ...c, level: 20, ancestry: 'Human', feats: [
    ...c.feats, { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' },
  ] })
  expect(level20.match(/One reaction per round, usable only for Ferocity\. Gain 20 temporary HP when using Ferocity\.<\/p>/g)).toHaveLength(4)
  expect(render({ ...c, feats: c.feats.filter(feat => feat.name !== 'Undying Ferocity') })).not.toContain('temporary HP')
  expect(render({ ...c, level: 12 })).not.toContain('aria-label="Orc Ferocity"')
  expect(render({ ...c, feats: c.feats.filter(feat => feat.name !== 'Ferocious Beasts') })).not.toContain('aria-label="Orc Ferocity"')
  expect(JSON.stringify(c)).toBe(before)
})

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
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={familiarEntries} save={() => {}} />)
  expect(html).toContain('Savage Cat')
  expect(html).toContain('<option value="Savage" selected="">Savage</option>')
  expect(html).not.toContain('<option value="Nimble" selected="">Nimble</option>')
})

it('shows feat-granted familiar choices and a separate aquatic pet with bonus abilities', () => {
  const previous = getSettings()
  onTestFinished(() => updateSettings(previous))
  updateSettings({ aquaticPetFamiliar: false })
  const c: Character = {
    id: 'minions', systems: ['pf2e'], name: 'Test', level: 8, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: ['Leshy Familiar', 'Enhanced Familiar', 'Friend of the Sea'].map(name => ({ name, type: 'Class Feat', level: 1 })),
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { leshyAbility: 'Fungus', abilities: ['Flier'] }, pet: { abilities: ['Climber'] },
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={familiarEntries} save={() => {}} />)
  expect(html).toContain('Leshy Familiar')
  expect(html).toContain('</h4> (2/5)')
  expect(html).toContain('aria-haspopup="dialog">Leshy Familiar (Fungus)</button>')
  expect(html).toContain('Aquatic Pet')
  expect(html).toContain('<small>Hit Points</small><b>56</b>')
  expect(html).toContain('aria-haspopup="dialog">Darkvision</button>')
  expect(html).toContain('aria-haspopup="dialog">Tough</button>')
  expect(html).toContain('aria-label="Remove Pet ability 1"')
  expect(html).not.toContain('Remove Pet ability 2')
  expect(html).toContain('aria-label="Pet ability"')
  expect(html).toContain('Swim 25 feet, Climb 25 feet')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, feats: [] }} entries={[]} save={() => {}} />)).not.toContain('Leshy Familiar')
})

it('alphabetizes chosen Pet abilities with non-removable Friend of the Sea grants', () => {
  const previous = getSettings()
  onTestFinished(() => updateSettings(previous))
  updateSettings({ aquaticPetFamiliar: false })
  const c: Character = {
    id: 'minions', systems: ['pf2e'], name: 'Test', level: 8, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Friend of the Sea', type: 'Class Feat', level: 1 },
      { name: 'Enhanced Familiar', type: 'Class Feat', level: 4 },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    pet: { abilities: ['Fast Movement', 'Amphibious', 'Darkvision', 'Tough'] },
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={familiarEntries} save={() => {}} />)
  expect(html.match(/aria-haspopup="dialog">Darkvision<\/button>/g)).toHaveLength(1)
  expect(html.match(/aria-haspopup="dialog">Tough<\/button>/g)).toHaveLength(1)
  const special = html.slice(html.indexOf('<h5>Special</h5>'), html.indexOf('<h5>Speed</h5>'))
  const positions = ['Amphibious', 'Darkvision', 'Fast Movement', 'Tough']
    .map(ability => special.indexOf(`>${ability}</button>`))
  expect(positions.every(position => position >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
  expect(html).toContain('aria-label="Remove Pet ability 1"')
  expect(html).toContain('aria-label="Remove Pet ability 2"')
  expect(html).not.toContain('Remove Pet ability 3')
  expect(html).not.toContain('Remove Pet ability 4')
})

it('treats the aquatic pet as an independent familiar while preserving legacy abilities', () => {
  const previous = getSettings()
  onTestFinished(() => updateSettings(previous))
  updateSettings({ aquaticPetFamiliar: true })
  vi.stubGlobal('window', { confirm: () => true })
  let c: Character = {
    id: 'aquatic-familiar', systems: ['pf2e'], name: 'Test', level: 8, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
    feats: ['Leshy Familiar', 'Friend of the Sea'].map(name => ({ name, type: 'Class Feat', level: 1 })),
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { abilities: ['Flier'] },
    pet: { name: 'Fish', abilities: ['Darkvision', 'Tough', '', 'Climber'], fastMovement: 'Swim' },
  }
  const tree = () => MinionsContent({ c, entries: familiarEntries, save: patch => { c = { ...c, ...patch } } })
  let html = renderToStaticMarkup(tree())
  expect(html).toContain('Aquatic Pet')
  const aquatic = html.split('data-minion-name="Aquatic Pet"')[1].split('</details>')[0]
  expect(aquatic).toContain('class="familiar-abilities"')
  expect(aquatic).toContain('<optgroup label="Familiar">')
  expect(aquatic).toContain('<optgroup label="Master">')
  expect(aquatic).not.toContain('aria-label="Specific familiar"')
  expect(renderToStaticMarkup(<MinionsSummary c={c} entries={familiarEntries} />)).toContain('Aquatic Pet (3/4)')
  expect(html).toContain('<small>Hit Points</small><b>56</b>')
  expect(html).toContain('Swim 25 feet, Climb 25 feet')
  expect(html).toContain('aria-label="Aquatic pet ability"')
  findSelect(tree(), 'Aquatic pet ability')!({ target: { value: 'familiar:Fast Movement' } })
  expect(c.pet?.abilities).toEqual(['Darkvision', 'Tough', 'Fast Movement', 'Climber'])
  expect(c.familiar?.abilities).toEqual(['Flier'])
  html = renderToStaticMarkup(tree())
  expect(html).toContain('Swim 40 feet')
  expect(html).not.toContain('aria-label="Aquatic pet ability"')
  findButton(tree(), 'Remove Aquatic pet ability 3')!()
  expect(c.pet?.abilities).toEqual(['Darkvision', 'Tough', 'Climber'])
  findSelect(tree(), 'Aquatic pet ability')!({ target: { value: 'familiar:Flier' } })
  expect(c.pet?.abilities).toEqual(['Darkvision', 'Tough', 'Climber', 'Flier'])
  expect(c.pet?.name).toBe('Fish')
  updateSettings({ aquaticPetFamiliar: false })
  expect(renderToStaticMarkup(tree())).toContain('aria-label="Remove Pet ability')
})

it('combines Calistria’s wasp and aquatic pet into one familiar with shared ability slots', () => {
  const previous = getSettings()
  onTestFinished(() => updateSettings(previous))
  updateSettings({ aquaticPetFamiliar: true, combineWaspAndAquaticFamiliar: true })
  let c: Character = {
    id: 'combined-familiar', systems: ['pf2e'], name: 'Test', level: 8, deity: 'Calistria',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
    feats: [{ name: 'Friend of the Sea', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    divineIntercessions: { Calistria: ['moderate-boon'] },
    waspFamiliar: { abilities: ['Resistance'] },
    pet: { name: 'Fish', abilities: ['Darkvision', 'Tough', 'Climber'] },
  }
  const tree = () => MinionsContent({ c, entries: familiarEntries, save: patch => { c = { ...c, ...patch } } })
  let html = renderToStaticMarkup(tree())
  expect(html).toContain('<h4>Wasp Familiar</h4> (2/6)')
  expect(html).not.toContain('<h4>Combined Familiar</h4>')
  expect(html).not.toContain('<h4>Aquatic Pet</h4>')
  expect(html).toContain('aria-haspopup="dialog">Burrower</button>')
  expect(html).toContain('aria-haspopup="dialog">Flier</button>')
  const specialSection = html.indexOf('<h5>Special</h5>')
  expect(specialSection).toBeGreaterThanOrEqual(0)
  expect(html.indexOf('aria-haspopup="dialog">Burrower</button>')).toBeGreaterThan(specialSection)
  expect(html.indexOf('aria-haspopup="dialog">Flier</button>')).toBeGreaterThan(specialSection)
  findSelect(tree(), 'Wasp familiar ability')!({ target: { value: 'familiar:Fast Movement' } })
  expect(c.waspFamiliar?.abilities).toEqual(['Resistance', 'Fast Movement'])
  findSelect(tree(), 'Wasp familiar ability')!({ target: { value: 'familiar:Echolocation' } })
  expect(c.waspFamiliar?.abilities).toEqual(['Resistance', 'Fast Movement', 'Echolocation'])
  findSelect(tree(), 'Wasp familiar ability')!({ target: { value: 'familiar:Scent' } })
  expect(c.waspFamiliar?.abilities).toEqual(['Resistance', 'Fast Movement', 'Echolocation', 'Scent'])
  findSelect(tree(), 'Wasp familiar ability')!({ target: { value: 'familiar:Amphibious' } })
  html = renderToStaticMarkup(tree())
  expect(c.pet?.abilities).toEqual(['Darkvision', 'Tough', 'Climber', 'Amphibious'])
  expect(html).toContain('<h4>Wasp Familiar</h4> (6/6)')

  updateSettings({ combineWaspAndAquaticFamiliar: false })
  html = renderToStaticMarkup(tree())
  expect(html).toContain('<h4>Wasp Familiar</h4>')
  expect(html).toContain('<h4>Aquatic Pet</h4>')
  expect(c.waspFamiliar?.abilities).toEqual(['Resistance', 'Fast Movement', 'Echolocation', 'Scent'])
  expect(c.pet?.abilities).toEqual(['Darkvision', 'Tough', 'Climber', 'Amphibious'])
})

it.each(['Pet', 'Familiar'])('shows %s defenses without the owner’s status penalties', name => {
  const c: Character = { id: 'minion-defenses', name: 'Test', systems: ['pf2e'], level: 8, className: 'Wizard',
    abilities: { str: 10, dex: 14, con: 16, int: 18, wis: 12, cha: 10 },
    feats: [{ name, type: name === 'Pet' ? 'General Feat' : 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    conditions: { frightened: 2 } }
  const wizard: ContentEntry = { id: 'wizard', name: 'Wizard', kind: 'class', source: 'official', systems: ['pf2e'],
    level: 1, traits: [], description: '', effects: [], updatedAt: 0,
    data: { fortitude_proficiency: 'Trained', reflex_proficiency: 'Trained', will_proficiency: 'Expert' } }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[wizard]} save={() => {}} />)
  expect(html).toContain('<small>Armor Class</small><b>12</b>')
  expect(html).toContain('<small>Fortitude</small>+13')
  expect(html).toContain('<small>Reflex</small>+12')
  expect(html).toContain('<small>Will</small>+13')
})

it('shows clickable undead familiar rules and one daily ability', () => {
  const c: Character = {
    id: 'undead-familiar', systems: ['pf2e'], name: 'Test', level: 1, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Undead Familiar', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { abilities: ['Flier', 'Tough'] },
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={familiarEntries} save={() => {}} />)
  expect(html).toContain('<h4>Undead Familiar</h4>')
  expect(html).toContain('aria-haspopup="dialog">Undead</button>')
  expect(html).toContain('Immune to bleed, death effects, disease, mental, and poison.')
  expect(html).toContain('change its trait, such as Construct or Dragon.')
  expect(html).toContain('Can be targeted by spells and abilities that target your thralls.')
  expect(html).toContain('If destroyed, can be raised during next daily preparations.')
  expect(html).toContain('</h4> (1/1)')
  expect(html).toContain('aria-label="Remove Undead familiar ability 1"')
  expect(html).not.toContain('aria-label="Undead familiar name"')
})

it('gives an Animist Spirit Familiar the Spirit Familiar specific familiar without manifestation controls', () => {
  const c: Character = {
    id: 'animist-spirit-familiar', systems: ['pf2e'], name: 'Test', level: 1, className: 'Animist',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
    feats: [{ name: 'Spirit Familiar (Animist)', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { name: 'Battle Spirit', abilities: ['Flier'] },
  }
  const html = renderToStaticMarkup(MinionsContent({ c, entries: familiarEntries, save: () => {} }))
  expect(html).toContain('<h4>Spirit Familiar</h4>')
  expect(html).not.toContain('aria-label="Specific familiar"')
  expect(html).toContain('aria-label="Remove Spirit familiar ability 1"')
  expect(html).not.toMatch(/Apparition|Manifested after daily preparations|Spirit familiar manifested/)
})

it('selects, details, removes, and applies familiar abilities without exposing stored names', () => {
  const confirm = vi.fn(() => true)
  vi.stubGlobal('window', { confirm })
  let c: Character = {
    id: 'ability-picker', systems: ['pf2e'], name: 'Test', level: 8, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }, { name: 'Enhanced Familiar', type: 'Class Feat', level: 2 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { name: 'Kept in storage', abilities: [], abilityOptions: { fastMovement: 'Fly' } },
    spellcasting: { ability: 'int', tradition: 'Arcane', rank: 4, slots: { 1: 2, 2: 2, 3: 2, 4: 1 } },
  }
  const tree = () => MinionsContent({ c, entries: familiarEntries, save: patch => { c = { ...c, ...patch } } })
  const choose = (name: string) => {
    const change = findSelect(tree(), 'Familiar ability')
    if (!change) throw new Error('Missing familiar ability selector')
    change({ target: { value: `familiar:${name}` } })
  }

  expect(findInput(tree(), 'Familiar name')).toBeUndefined()
  choose('Flier')
  choose('Tough')
  choose('Fast Movement')
  let html = renderToStaticMarkup(tree())
  expect(c.familiar?.abilities).toEqual(['Flier', 'Tough', 'Fast Movement'])
  expect(html).toContain('</h4> (3/4)')
  expect(html).not.toContain('Roll Restorative Familiar')
  const saved = c
  c = { ...c, familiar: { ...c.familiar!, abilities: ['Flier', 'Restorative Familiar'] } }
  html = renderToStaticMarkup(tree())
  expect(html).toContain('aria-label="Roll Restorative Familiar: Healing"')
  expect(html).toContain('4d8')
  c = { ...c, className: 'Witch', level: 11, feats: [{ name: 'Stitched Familiar', type: 'Class Feat', level: 8 }, { name: 'Spirit Familiar (Witch)', type: 'Class Feat', level: 8 }] }
  html = renderToStaticMarkup(tree())
  expect(html).toContain('aria-label="Roll Stitching Strike: Damage"')
  expect(html).toContain('aria-label="Roll Shed Spirit: Damage"')
  expect(html).toContain('10d6')
  c = { ...c, level: 18, feats: [{ name: 'Patron’s Claim', type: 'Class Feat', level: 18 }] }
  expect(renderToStaticMarkup(tree())).toContain('aria-label="Roll Patron’s Claim: Damage"')
  c = { ...c, level: 14, feats: [{ name: 'Rites of Transfiguration', type: 'Class Feat', level: 14 }] }
  const spell = { id: 'cm', systems: ['pf2e'], kind: 'spell', source: 'official', name: 'Cursed Metamorphosis', level: 6, traits: [], description: 'Polymorph.', data: {}, effects: [], updatedAt: 0 } as unknown as ContentEntry
  html = renderToStaticMarkup(MinionsContent({ c, entries: [...familiarEntries, spell], save: () => {} }))
  expect(html).toContain('<h5>Spells</h5>')
  expect(html).toContain('aria-haspopup="dialog">Cursed Metamorphosis</button>')
  c = saved
  html = renderToStaticMarkup(tree())
  expect(html).toContain('<small>Hit Points</small><b>56</b>')
  expect(html).toContain('Fly 40 feet')
  expect(html).toContain('Your familiar’s maximum Hit Points increase by 2 per level.')
  expect(html).toContain('aria-label="Remove Familiar ability 2"')
  expect(html.indexOf('aria-haspopup="dialog">Fast Movement</button>'))
    .toBeLessThan(html.indexOf('aria-haspopup="dialog">Flier</button>'))
  expect(html.indexOf('aria-haspopup="dialog">Flier</button>'))
    .toBeLessThan(html.indexOf('aria-haspopup="dialog">Tough</button>'))

  findButton(tree(), 'Remove Familiar ability 2')?.()
  html = renderToStaticMarkup(tree())
  expect(confirm).toHaveBeenCalledWith('Remove familiar ability "Tough"?')
  expect(c.familiar?.abilities).toEqual(['Flier', 'Fast Movement'])
  expect(c.familiar?.name).toBe('Kept in storage')
  expect(html).toContain('<small>Hit Points</small><b>40</b>')
})

it('groups familiar and master options without showing pet abilities', () => {
  const c: Character = {
    id: 'grouped-familiar', systems: ['pf2e'], name: 'Test', level: 8, className: 'Witch',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    spellcasting: { ability: 'int', tradition: 'Arcane', rank: 4, slots: { 4: 1 } },
  }
  const petFlier = { ...familiarAbility('Flier', '', 'Pet'), id: 'pet:flier' }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[
    petFlier, familiarAbility('Flier', 'Fly speed.'), familiarAbility('Spell Battery', '', 'Master'),
  ]} save={() => {}} />)
  expect(html).toContain('<optgroup label="Familiar"><option value="familiar:Flier">Flier</option></optgroup>')
  expect(html).toContain('<optgroup label="Master"><option value="familiar:Spell Battery">Spell Battery</option></optgroup>')
  expect(html).not.toContain('pet:flier')
  expect(html).toContain('<option value="" selected="">+</option>')
})

it('shows specific familiar grants alongside choices without removal controls and counts repeated Skilled grants', () => {
  let c: Character = {
    id: 'specific-familiar', systems: ['pf2e'], name: 'Test', level: 12, className: 'Witch',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Incredible Familiar', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { abilities: ['Tough', 'Climber', 'Amphibious', 'Echolocation', 'Wavesense'] },
    spellcasting: { ability: 'int', tradition: 'Arcane', rank: 9, slots: { 9: 1 } },
  }
  const wyrm: ContentEntry = { ...familiarAbility('Calligraphy Wyrm', 'Curious dragons seek lore.\n\nThey can be know-it-alls.'), data: {
    ability_type: 'Specific Familiar', required_abilities: 6, access: 'affiliation with Cobyslarni or the Pathfinder Society',
    granted_abilities: 'Darkvision, Flier, Manual Dexterity, Scent, Skilled (Arcana, Society), Speech',
  } }
  const ink: ContentEntry = { ...familiarAbility('Ink Spray', 'Splatter ink. Critical Success The creature is unaffected. Failure It is blinded.',
    'Specific Familiar - Calligraphy Wyrm'), data: { ability_type: 'Specific Familiar - Calligraphy Wyrm', actions: 'Single Action', sourceBook: 'Rival Academies' } }
  const entries = [...familiarEntries, familiarAbility('Manual Dexterity', ''), familiarAbility('Speech', ''), wyrm, ink]
  const tree = () => MinionsContent({ c, entries, save: patch => { c = { ...c, ...patch } } })
  findSelect(tree(), 'Specific familiar')!({ target: { value: 'Calligraphy Wyrm' } })
  expect(renderToStaticMarkup(tree())).not.toContain('<h4>Calligraphy Wyrm</h4>')
  expect(renderToStaticMarkup(<MinionsSummary c={c} entries={entries} />)).toContain('Familiar (5/10)')
  c = { ...c, achievements: ['Trained with the Pathfinder Society'] }
  let html = renderToStaticMarkup(tree())
  expect(html).toContain('<h4>Calligraphy Wyrm Familiar</h4> (11/11)')
  expect(html).not.toContain('GM approved access: Calligraphy Wyrm')
  expect(renderToStaticMarkup(<MinionsSummary c={c} entries={entries} />)).toContain('Calligraphy Wyrm Familiar (11/11)')
  const reduced = { ...c, level: 1, familiar: { ...c.familiar, abilities: ['Tough', 'Climber'] } }
  expect(renderToStaticMarkup(<MinionsSummary c={reduced} entries={entries} />)).toContain('Calligraphy Wyrm Familiar (9/9)')
  c = { ...c, achievements: [] }
  findToggle(tree(), 'GM approved access: Calligraphy Wyrm')!({ target: { checked: true } })
  html = renderToStaticMarkup(tree())
  expect(html).toContain('<h4>Calligraphy Wyrm Familiar</h4> (11/11)')
  expect(html).toContain('Skilled (Arcana, Society)')
  for (const grant of ['Darkvision', 'Dragon', 'Flier', 'Manual Dexterity', 'Scent', 'Skilled (Arcana, Society)', 'Speech']) {
    const card = html.split('<div class="familiar-ability">').find(part => part.includes(`>${grant}<`))
    expect(card).toBeDefined()
    expect(card).not.toContain('aria-label="Remove Familiar ability')
  }
  expect(html).toContain('Curious dragons seek lore.')
  expect(html).toContain('They can be know-it-alls.')
  expect(html).toContain('Ink Spray')
  expect(html).toContain('aria-label="Single Action"')
  expect(html).toContain('<div>Arcana +16 (T)</div><div>Society +16 (T)</div>')
  expect(html).toContain('Scent (imprecise, 30 feet)')
  expect(html).toContain('Fly 25 feet')
  expect(html.match(/aria-label="Remove Familiar ability \d+"/g)).toHaveLength(5)
  expect(html).toContain('(inactive)')
  findSelect(tree(), 'Specific familiar')!({ target: { value: '' } })
  html = renderToStaticMarkup(tree())
  expect(html).toContain('<h4>Witch&#x27;s Familiar</h4> (5/10)')
  expect(c.familiar?.abilities).toHaveLength(5)
})

it('shows the selected Witch patron ability as granted and reserves its familiar slot', () => {
  const c: Character = {
    id: 'witch-patron', systems: ['pf2e'], name: 'Test', level: 1, className: 'Witch', subclass: 'Wilding Steward',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const patron: ContentEntry = {
    ...familiarAbility('Wilding Steward', ''), id: 'patron:wilding-steward', kind: 'subclass',
    data: { class: 'Witch', grants_familiar_ability: 'Familiar of Keen Senses',
      familiar_ability_description: 'Your familiar gains scent or tremorsense after you Cast or Sustain a hex.' },
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[patron]} save={() => {}} />)

  expect(html).toContain('<h4>Witch&#x27;s Familiar</h4> (1/4)')
  expect(html).not.toContain('Patron familiar ability')
  expect(html).toContain('aria-haspopup="dialog">Familiar of Keen Senses</button>')
  expect(html).not.toContain('Remove Familiar ability')
  expect(html).not.toContain('One ability must be your patron')
})

it('shows feat-selected familiar abilities and Witch activities as locked cards', () => {
  const c: Character = {
    id: 'witch-emissary', systems: ['pf2e'], name: 'Test', level: 18, className: 'Witch',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Divine Emissary', type: 'Class Feat', level: 6, choice: 'Medic' },
      { name: 'Spirit Familiar (Witch)', type: 'Class Feat', level: 8 },
      { name: 'Patron’s Claim', type: 'Class Feat', level: 18 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { abilities: ['Medic', 'Tough'] },
  }
  const spirit = { ...familiarAbility('Spirit Familiar (Witch)', 'Your familiar gains Shed Spirit.'), kind: 'feat' as const }
  const claim = { ...familiarAbility('Patron’s Claim', 'Your familiar gains Patron’s Claim.'), kind: 'feat' as const }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[...familiarEntries, spirit, claim]} save={() => {}} />)
  expect(html).toContain('Witch&#x27;s Familiar (2/8)')
  expect(html.match(/aria-haspopup="dialog">Medic<\/button>/g)).toHaveLength(1)
  expect(html).toContain('aria-label="Roll Medic: Healing"')
  expect(html).toContain('7d8')
  expect(html).toContain('aria-haspopup="dialog">Shed Spirit</button>')
  expect(html).toContain('aria-haspopup="dialog">Patron’s Claim</button>')
  expect(html.match(/aria-label="Remove Familiar ability \d+"/g)).toHaveLength(1)
  const radiant = { ...c, feats: c.feats.map(feat => feat.name === 'Divine Emissary' ? { ...feat, choice: 'Radiant' } : feat),
    familiar: { abilities: [] } }
  const radiantHtml = renderToStaticMarkup(<MinionsSection c={radiant} entries={familiarEntries} save={() => {}} />)
  expect(radiantHtml).toContain('evil 9')
  expect(radiantHtml).toContain('negative 9')
})

it('tracks Medic and Restorative Familiar daily uses independently', () => {
  let c: Character = {
    id: 'familiar-daily', systems: ['pf2e'], name: 'Test', level: 8, className: 'Witch',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Divine Emissary', type: 'Class Feat', level: 6, choice: 'Medic' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { abilities: ['Restorative Familiar'] },
    spellcasting: { ability: 'int', tradition: 'Arcane', rank: 4, slots: { 3: 1, 4: 1 } },
  }
  const tree = () => MinionsContent({ c, entries: familiarEntries, save: patch => { c = { ...c, ...patch } } })
  const html = () => renderToStaticMarkup(tree())
  expect(html().match(/aria-label="1 of 1 uses remaining"/g)).toHaveLength(2)
  findButton(tree(), 'Spend Familiar Medic use 1')!()
  expect(c.familiar?.dailyUses).toEqual({ Medic: true })
  expect(html()).toContain('aria-label="Restore Familiar Medic use 1"')
  findButton(tree(), 'Spend Familiar Restorative Familiar use 1')!()
  expect(c.familiar?.dailyUses).toEqual({ Medic: true, 'Restorative Familiar': true })
  expect(html().match(/aria-label="0 of 1 uses remaining"/g)).toHaveLength(2)
  findButton(tree(), 'Restore Familiar Medic use 1')!()
  expect(c.familiar?.dailyUses).toEqual({ Medic: false, 'Restorative Familiar': true })
  c = { ...c, feats: [{ ...c.feats[0], choice: undefined }], familiar: { abilities: ['Medic'] } }
  findButton(tree(), 'Spend Familiar Medic use 1')!()
  expect(c.familiar?.dailyUses).toEqual({ Medic: true })
  c = { ...c, className: 'Druid', feats: [], deity: 'Calistria', divineIntercessions: { Calistria: ['moderate-boon'] },
    waspFamiliar: { abilities: ['Restorative Familiar'] } }
  findButton(tree(), 'Spend Wasp familiar Restorative Familiar use 1')!()
  expect(c.waspFamiliar?.dailyUses).toEqual({ 'Restorative Familiar': true })
  expect(c.familiar?.dailyUses).toEqual({ Medic: true })
})

it('shows Nine-Tailed Fox and its locked Scent alongside selected abilities', () => {
  const c: Character = {
    id: 'fox', systems: ['pf2e'], name: 'Test', level: 1, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { specificFamiliar: 'Nine-Tailed Fox', abilities: ['Tough'] },
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={familiarEntries} save={() => {}} />)
  expect(html).toContain('Nine-Tailed Fox Familiar (2/2)')
  expect(html).toContain('<h4>Nine-Tailed Fox Familiar</h4> (2/2)')
  expect(c.familiar?.specificFamiliar).toBe('Nine-Tailed Fox')
  expect(html).toContain('aria-haspopup="dialog">Scent</button>')
  expect(html).toContain('Scent (imprecise, 30 feet)')
  expect(html.match(/aria-label="Remove Familiar ability \d+"/g)).toHaveLength(1)
})

it('locks Glyph Familiar and shows its granted abilities in the familiar list', () => {
  const c: Character = {
    id: 'glyph', systems: ['pf2e'], name: 'Test', level: 1, className: 'Runesmith',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Glyph Familiar', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { specificFamiliar: 'Nine-Tailed Fox', abilities: ['Scent'] },
  }
  const entries = [...familiarEntries, familiarAbility('Construct', 'Your familiar has the construct trait.')]
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('<h4>Glyph Familiar</h4> (4/4)')
  expect(html).not.toContain('aria-label="Specific familiar"')
  for (const name of ['Construct', 'Flier', 'Tough', 'Scent']) {
    expect(html).toContain(`aria-haspopup="dialog">${name}</button>`)
  }
  expect(html.match(/aria-label="Remove Glyph familiar ability \d+"/g)).toHaveLength(1)
  expect(c.familiar?.specificFamiliar).toBe('Nine-Tailed Fox')
})

it('shows Leshy Familiar variants chosen on the feat without duplicate picker choices', () => {
  let c: Character = {
    id: 'leshy-form', systems: ['pf2e'], name: 'Test', level: 1, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
    feats: [{ name: 'Leshy Familiar', type: 'Class Feat', level: 1, choice: 'Fungus' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { specificFamiliar: 'Nine-Tailed Fox', leshyAbility: 'Fungus', abilities: ['Tough', 'Flier'] },
  }
  const tree = () => MinionsContent({ c, entries: familiarEntries, save: patch => { c = { ...c, ...patch } } })
  let html = renderToStaticMarkup(tree())
  expect(html).toContain('<h4>Leshy Familiar</h4> (3/3)')
  expect(renderToStaticMarkup(<MinionsSummary c={c} entries={familiarEntries} />)).toContain('Leshy Familiar (3/3)')
  expect(html).not.toContain('aria-label="Specific familiar"')
  expect(html).toContain('aria-haspopup="dialog">Leshy Familiar (Fungus)</button>')
  expect(findSelect(tree(), 'Leshy familiar ability')).toBeUndefined()
  c = { ...c, feats: [{ ...c.feats[0], choice: 'Plant' }] }
  expect(c.familiar?.leshyAbility).toBe('Fungus')
  html = renderToStaticMarkup(tree())
  expect(html).toContain('<h4>Leshy Familiar</h4> (3/3)')
  expect(renderToStaticMarkup(<MinionsSummary c={c} entries={familiarEntries} />)).toContain('Leshy Familiar (3/3)')
  expect(html).toContain('aria-haspopup="dialog">Leshy Familiar (Plant)</button>')
  expect(html).not.toContain('aria-haspopup="dialog">Leshy Familiar (Fungus)</button>')
  expect(html.match(/aria-label="Remove Leshy familiar ability \d+"/g)).toHaveLength(2)
})

it('keeps Divine Emissary choices on the feat without a duplicate familiar picker', () => {
  let c: Character = {
    id: 'emissary-switch', systems: ['pf2e'], name: 'Test', level: 6, className: 'Witch',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Divine Emissary', type: 'Class Feat', level: 6 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { abilities: ['Tough', 'Flier', 'Climber', 'Amphibious', 'Scent', 'Luminous'] },
  }
  const tree = () => MinionsContent({ c, entries: familiarEntries, save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain('aria-haspopup="dialog">Luminous</button>')
  expect(findSelect(tree(), 'Familiar ability')).toBeUndefined()
  c = { ...c, familiar: { abilities: [] } }
  expect(hasOption(tree(), 'familiar:Flier')).toBe(true)
  expect(hasOption(tree(), 'divine-emissary:radiant')).toBe(false)
  findSelect(tree(), 'Familiar ability')!({ target: { value: 'divine-emissary:radiant' } })
  expect(c.feats[0].choice).toBeUndefined()
  c = { ...c, familiar: { abilities: ['Tough', 'Flier', 'Climber', 'Amphibious', 'Scent', 'Luminous'] } }
  c = { ...c, feats: [{ ...c.feats[0], choice: 'Radiant' }] }
  expect(c.familiar?.abilities).toContain('Luminous')
  const html = renderToStaticMarkup(tree())
  expect(html).toContain('aria-haspopup="dialog">Radiant</button>')
  expect(html).not.toContain('aria-haspopup="dialog">Luminous</button>')
  expect(html).toContain('evil 3')
  expect(html).toContain('negative 3')
})

it('offers usable generic familiar abilities and applies Necromancer spellcasting without saved slots', () => {
  let c: Character = { id: 'necro-familiar', name: 'Test', systems: ['pf2e'], level: 11, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Undead Familiar', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const specific = familiarAbility('Infernal Temptation', '', 'Specific Familiar - Imp')
  const entries = [...familiarEntries, specific]
  const tree = () => MinionsContent({ c, entries, save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).not.toContain('value="familiar:Infernal Temptation"')
  findSelect(tree(), 'Undead familiar ability')?.({ target: { value: specific.id } })
  expect(c.familiar?.abilities).toBeUndefined()
  findSelect(tree(), 'Undead familiar ability')?.({ target: { value: 'familiar:Skilled' } })
  expect(c.familiar?.abilities).toEqual(['Skilled'])
  findSelect(tree(), 'Undead familiar Skilled ability 1')?.({ target: { value: 'Occultism' } })
  expect(renderToStaticMarkup(tree())).toContain('Occultism +15 (T)')
})

it('keeps saved trait-changing choices dormant and unavailable for an undead familiar', () => {
  const c: Character = {
    id: 'undead-restrictions', systems: ['pf2e'], name: 'Test', level: 8, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Undead Familiar', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { name: 'Saved', abilities: ['Dragon'] },
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={familiarEntries} save={() => {}} />)
  expect(html).toContain('</h4> (1/1)')
  expect(html).toContain('Dragon')
  expect(html).toContain('title="An undead familiar cannot select an ability that changes its trait."')
  expect(html).not.toContain('value="familiar:Dragon"')
  expect(html).not.toContain('value="familiar:Constructed"')
  expect(c.familiar?.abilities).toEqual(['Dragon'])
})

it('creates a familiar record for Crocodile’s Twin', () => {
  const c: Character = {
    id: 'crocodile-twin', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Lizardfolk', heritage: 'Bakuwa Lizardfolk',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: "Crocodile's Twin", type: 'Ancestry Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('Crocodile Familiar')
  expect(html).toContain('Tiny crocodile familiar granted by Crocodile&#x27;s Twin.')
  expect(html).toContain('</h4> (0/2)')
  expect(html).toContain('aria-label="Crocodile familiar ability"')
})

it('raises undead familiar ability limit to three with Enhanced Undead Familiar', () => {
  const c: Character = {
    id: 'enhanced-undead-familiar', systems: ['pf2e'], name: 'Test', level: 2, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: ['Undead Familiar', 'Enhanced Undead Familiar'].map(name => ({ name, type: 'Class Feat', level: 1 })),
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { abilities: ['Flier', 'Tough', 'Darkvision', 'Climber'] },
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('</h4> (3/3)')
  expect(html).toContain('aria-label="Remove Undead familiar ability 3"')
  expect(html).toContain('aria-label="Remove Undead familiar ability 4"')
  expect(html).toContain('(inactive)')
})

it('offers Incredible Undead Familiar with its prerequisite and activates five choices at level 10', () => {
  const feat = homebrewCharacterOptions([]).find(entry => entry.name === 'Incredible Undead Familiar')!
  const prerequisite: ContentEntry = { ...feat, id: 'enhanced-undead', name: 'Enhanced Undead Familiar', level: 2,
    source: 'official', data: { class: 'Necromancer', prerequisite: 'Undead Familiar' } }
  const undead: ContentEntry = { ...prerequisite, id: 'undead', name: 'Undead Familiar', level: 1, data: { class: 'Necromancer' } }
  const entries = [feat, prerequisite, undead, ...familiarEntries]
  const c: Character = { id: 'incredible-undead', systems: ['pf2e'], name: 'Test', level: 10, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, equipment: [], lores: [], languages: [],
    entryIds: [], extraSlots: [], updatedAt: 0,
    feats: [{ name: 'Undead Familiar', type: 'Class Feat', level: 1 },
      { name: 'Enhanced Undead Familiar', type: 'Class Feat', level: 2 }],
    familiar: { abilities: ['Flier', 'Tough', 'Darkvision', 'Climber', 'Scent'] } }
  const slot = { key: 'class:10:0', category: 'class' as const, level: 10 }
  expect(eligibleFeats(entries, c, slot)).toContain(feat)
  expect(featPrerequisiteChecker({ ...c, feats: [c.feats[0]] }, entries)(feat).missing)
    .toContain('Enhanced Undead Familiar')
  expect(eligibleFeats(entries, c, { ...slot, level: 8 })).not.toContain(feat)
  const selected = { ...c, feats: [...c.feats, { name: feat.name, type: 'Class Feat', level: 10 }] }
  expect(renderToStaticMarkup(<MinionsSection c={selected} entries={entries} save={() => {}} />))
    .toContain('<h4>Undead Familiar</h4> (5/5)')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...selected, level: 9 }} entries={entries} save={() => {}} />))
    .toContain('<h4>Undead Familiar</h4> (3/3)')
})

it.each([
  ['Necromancer', 'Undead Familiar', 'Undead Familiar', 1],
  ['Witch', undefined, 'Witch&#x27;s Familiar', 4],
  ['Wizard', 'Familiar', 'Familiar', 2],
  ['Druid', 'Leshy Familiar', 'Leshy Familiar', 3],
] as const)('prioritizes %s class familiar over Crocodile’s Twin without duplicating familiars or changing saved choices', (className, classFeat, label, abilities) => {
  const c: Character = {
    id: 'class-familiar', systems: ['pf2e'], name: 'Test', level: 1, className,
    ancestry: 'Lizardfolk', heritage: 'Bakuwa Lizardfolk',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: "Crocodile's Twin", type: 'Ancestry Feat', level: 1 },
      ...(classFeat ? [{ name: classFeat, type: 'Class Feat', level: 1 }] : [])],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { name: 'Companion', abilities: ['Flier', 'Tough'] },
  }
  const before = JSON.stringify(c)
  const save = vi.fn()
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={save} />)
  expect(html).toContain(`<h4>${label}</h4>`)
  expect(html.match(/<h4>(?:Undead |Leshy |Crocodile |Witch&#x27;s )?Familiar<\/h4>/g)).toHaveLength(1)
  expect(html).not.toContain('Crocodile Familiar')
  expect(html).not.toContain('Tiny crocodile familiar')
  expect(html).toContain(`</h4> (${Math.min(2, abilities)}/${abilities})`)
  expect(JSON.stringify(c)).toBe(before)
  expect(save).not.toHaveBeenCalled()
})

it('keeps the ancestry familiar until the class familiar feat is active', () => {
  const c: Character = {
    id: 'future-familiar', systems: ['pf2e'], name: 'Test', level: 1, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: "Crocodile's Twin", type: 'Ancestry Feat', level: 1 },
      { name: 'Undead Familiar', type: 'Class Feat', level: 1, takenLevel: 5 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const render = (c: Character) => renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(render(c)).toContain('<h4>Crocodile Familiar</h4>')
  expect(render({ ...c, level: 5 })).toContain('<h4>Undead Familiar</h4>')
  expect(render({ ...c, level: 5 })).not.toContain('Crocodile Familiar')
})

it('keeps only the primary class familiar traits when multiple classes grant familiars', () => {
  const c: Character = {
    id: 'multiclass-familiar', systems: ['pf2e'], name: 'Test', level: 10, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: ['Undead Familiar', 'Leshy Familiar', 'Leshy Familiar Secrets'].map(name => ({ name, type: 'Class Feat', level: 1 })),
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const render = (c: Character) => renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(render(c)).toContain('<h4>Undead Familiar</h4>')
  expect(render(c)).not.toContain('Leshy familiar granted ability')
  expect(render(c)).not.toContain('Leshy Familiar Secrets ability')
  expect(render({ ...c, className: 'Druid' })).toContain('<h4>Leshy Familiar</h4>')
  expect(render({ ...c, className: 'Druid' })).not.toContain('aria-haspopup="dialog">Undead</button>')
})

it('keeps one familiar while preserving dormant Calistria wasp choices', () => {
  let c: Character = {
    id: 'wasp', systems: ['pf2e'], name: 'Test', level: 8, className: 'Druid', deity: 'Calistria',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Leshy Familiar', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { name: 'Leaf', leshyAbility: 'Fungus', abilities: ['Tough', 'Climber'] },
    divineIntercessions: { Calistria: ['moderate-boon'] },
  }
  let saves = 0
  const tree = () => MinionsContent({ c, entries: familiarEntries, save: patch => { saves++; c = { ...c, ...patch } } })
  const markup = () => renderToStaticMarkup(<MinionsSection c={c} entries={familiarEntries} save={() => { saves++ }} />)
  const before = JSON.stringify(c.familiar)
  let html = markup()
  expect(saves).toBe(0)
  expect(html).toContain('<h4>Leshy Familiar</h4>')
  expect(html).not.toContain('Wasp Familiar')
  expect(html).not.toContain('Burrower')
  expect(html).toContain('aria-haspopup="dialog">Leshy Familiar (Fungus)</button>')
  expect(html).toContain('<small>Hit Points</small><b>56</b>')
  expect(html).not.toContain('(includes Tough)')
  c = { ...c, feats: [] }
  html = markup()
  expect(html).toContain('</h4> (0/2)')
  expect(html).toContain('aria-haspopup="dialog">Burrower</button>')
  expect(html).toContain('aria-haspopup="dialog">Flier</button>')
  expect(html).toContain('<small>Hit Points</small><b>40</b>')
  expect(findInput(tree(), 'Wasp familiar name')).toBeUndefined()
  findSelect(tree(), 'Wasp familiar ability')?.({ target: { value: 'familiar:Flier' } })
  findSelect(tree(), 'Wasp familiar ability')?.({ target: { value: 'familiar:Tough' } })
  expect(c.waspFamiliar).toEqual({ abilities: ['Flier', 'Tough'] })
  expect(JSON.stringify(c.familiar)).toBe(before)
  html = markup()
  expect(html).toContain('</h4> (2/2)')
  expect(html.match(/fly Speed of 25 feet/g)).toHaveLength(1)

  c = { ...c, feats: [{ name: 'Leshy Familiar', type: 'Class Feat', level: 1 }] }
  expect(markup()).not.toContain('Wasp Familiar')
  expect(c.waspFamiliar?.name).toBeUndefined()
  c = { ...c, divineIntercessions: { Calistria: [] } }
  html = markup()
  expect(html).not.toContain('Wasp Familiar')
  expect(html).not.toContain('Burrower: Burrow Speed')
  expect(c.waspFamiliar?.name).toBeUndefined()
  expect(JSON.stringify(c.familiar)).toBe(before)
  c = { ...c, divineIntercessions: { Calistria: ['moderate-boon'] }, deity: 'Erastil' }
  expect(markup()).not.toContain('Wasp Familiar')
  c = { ...c, deity: 'Calistria', feats: [] }
  html = markup()
  expect(html).toContain('Wasp Familiar')
  expect(html).not.toContain('aria-label="Wasp familiar name"')
  expect(html).toContain('</h4> (2/2)')
  expect(html).not.toContain('Leshy Familiar')
  expect(JSON.stringify(c.familiar)).toBe(before)
  c = { ...c, divineIntercessions: { Calistria: [] } }
  expect(markup()).not.toContain('aria-label="Wasp familiar name"')
  expect(markup()).not.toContain('aria-label="Familiar name"')
  expect(c.waspFamiliar?.abilities).toEqual(['Flier', 'Tough'])
})

it('selects alphabetized companion equipment and allows multiple Other items', () => {
  const confirm = vi.fn(() => true)
  vi.stubGlobal('window', { confirm })
  let c: Character = {
    id: 'equipped-companion', systems: ['pf2e'], name: 'Test', level: 4, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'cat', type: 'Cat', name: 'Buddy', equipment: {
      Other: { entryId: 'tassel', name: 'Steadyfoot Tassel', qty: 1 },
    } }],
  }
  const item = (id: string, name: string, subcategory = 'Companion Items'): ContentEntry => ({
    id, name, kind: 'item', systems: ['pf2e'], source: 'official', level: 1, traits: [],
    description: `Rules for ${name}.`, data: { item_subcategory: subcategory }, effects: [], updatedAt: 0,
  })
  const entries = [
    item('collar-z', 'Collar of Vigor'), item('collar-a', 'Collar of Empathy'),
    item('shoes', 'Alacritous Horseshoes (Greater)'), item('saddle', 'Mature Animal Saddle'),
    item('barding', 'Barding (Light)'), item('anti-dragon', 'Anti-Dragon Barding'),
    item('anti-dragon-duplicate', 'Anti-Dragon Barding'), item('tassel', 'Steadyfoot Tassel'),
    item('statuette', 'Hosteling Statuette'), item('wrong-category', 'Barding of Protection', 'Other Worn Items'),
    item('irrelevant', 'Rope'),
  ]
  const tree = () => CompanionEquipmentSlots({ c, companion: c.companions![0], entries,
    save: patch => { c = { ...c, ...patch } } })
  const bardingOptionsForCompanion = bardingOptions(entries, c.level, 'Medium')
  const lightBarding = bardingOptionsForCompanion.find(entry => entry.name === 'Barding (Light)')!
  const heavyBarding = bardingOptionsForCompanion.find(entry => entry.name === 'Barding (Heavy)')!
  expect(findSelect(tree(), 'Buddy Barding equipment')).toBeTypeOf('function')
  findSelect(tree(), 'Buddy Barding equipment')!({ target: { value: lightBarding.id } })
  expect(c.companions?.[0].equipment?.Barding).toMatchObject({ entryId: lightBarding.id, name: 'Barding (Light)' })
  expect(renderToStaticMarkup(tree())).toContain('>Barding (Light)</button>')
  findSelect(tree(), 'Buddy Barding equipment')!({ target: { value: heavyBarding.id } })
  expect(c.companions?.[0].equipment?.Barding).toMatchObject({ entryId: heavyBarding.id, name: 'Barding (Heavy)' })
  const collarSelect = findSelect(tree(), 'Buddy Collar equipment')
  if (!collarSelect) throw new Error('Missing companion collar slot')
  const emptyMarkup = renderToStaticMarkup(tree())
  expect(emptyMarkup.indexOf('Collar of Empathy')).toBeLessThan(emptyMarkup.indexOf('Collar of Vigor'))
  collarSelect({ target: { value: 'collar-a' } })
  expect(c.companions?.[0].equipment?.Collar).toEqual({ entryId: 'collar-a', name: 'Collar of Empathy', qty: 1 })
  const markup = renderToStaticMarkup(tree())
  expect(markup).not.toContain('Qty ')
  expect(findButton(tree(), 'Increase Collar quantity')).toBeUndefined()
  expect(findSelect(tree(), 'Buddy Collar equipment')).toBeUndefined()
  expect(markup).not.toContain('Collar of Vigor')
  expect(markup).toContain('<option value="" selected="">Choose other equipment...</option>')
  expect(markup).toContain('aria-label="Remove Buddy Other: Steadyfoot Tassel"')
  expect(markup).toContain('aria-label="Buddy Add other equipment"')
  for (const name of ['Collar of Empathy', 'Steadyfoot Tassel']) {
    expect(markup).toContain(`aria-haspopup="dialog">${name}</button>`)
    expect(markup).toContain(`Rules for ${name}.`)
  }
  expect(markup).toContain('<div class="rune"><button type="button" aria-haspopup="dialog">Collar of Empathy</button>')
  expect(markup).not.toContain('type="checkbox"')
  expect(markup).not.toContain('Buddy Harness equipment')
  expect(markup).not.toContain('Buddy Head equipment')
  expect(markup.match(/>Anti-Dragon Barding \(Light\)<\/option>/g)).toHaveLength(1)
  expect(markup.match(/>Anti-Dragon Barding \(Heavy\)<\/option>/g)).toHaveLength(1)
  expect(markup).not.toContain('wrong-category')
  expect(markup).not.toContain('<option value="irrelevant">Rope</option>')
  const clear = findButton(tree(), 'Remove Buddy Collar: Collar of Empathy')
  if (!clear) throw new Error('Missing companion equipment clear control')
  confirm.mockReturnValueOnce(false)
  clear()
  expect(c.companions?.[0].equipment?.Collar?.entryId).toBe('collar-a')
  clear()
  expect(c.companions?.[0].equipment?.Collar).toBeUndefined()
  expect(findSelect(tree(), 'Buddy Collar equipment')).toBeDefined()

  const statuette = findSelect(tree(), 'Buddy Add other equipment')
  if (!statuette) throw new Error('Missing Hosteling Statuette choice')
  statuette({ target: { value: 'statuette' } })
  expect(c.companions?.[0].equipment?.Other).toEqual([
    { entryId: 'statuette', name: 'Hosteling Statuette', qty: 1 },
    { entryId: 'tassel', name: 'Steadyfoot Tassel', qty: 1 },
  ])
  const removeTassel = findButton(tree(), 'Remove Buddy Other: Steadyfoot Tassel')
  removeTassel?.()
  expect(c.companions?.[0].equipment?.Other).toEqual([
    { entryId: 'statuette', name: 'Hosteling Statuette', qty: 1 },
  ])
})

it('makes Badger Rage actionable and tracks it only on Badger companions', () => {
  const badger: ContentEntry = { id: 'badger', systems: ['pf2e'], name: 'Badger', kind: 'companion', source: 'official',
    level: 1, traits: ['Animal'], description: '', effects: [], updatedAt: 0,
    data: { size: 'Small', hp: 8, strength: 2, dexterity: 1, constitution: 2, intelligence: -4, wisdom: 2,
      charisma: 0, speed_raw: '25 feet, burrow 10 feet, climb 10 feet', skill: 'Survival',
      companion_maneuver: 'Badger Rage', companion_maneuver_actions: 'Single Action',
      companion_maneuver_traits: 'Concentrate, Emotion, Mental',
      companion_maneuver_requirements: "The badger isn't fatigued or raging.",
      companion_maneuver_description: 'The badger enters a state of pure rage that lasts for 1 minute.' },
  }
  const cat: ContentEntry = { ...badger, id: 'cat', name: 'Cat', data: { ...badger.data, companion_maneuver: '' } }
  let c: Character = { id: 'badger-rage', systems: ['pf2e'], name: 'Test', level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'badger', name: 'Bristle', type: 'Badger' }, { id: 'cat', name: 'Mittens', type: 'Cat' }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => MinionsContent({ c, entries: [badger, cat], save })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('aria-label="Badger Rage (Bristle) options"')
  expect(markup).toContain('aria-label="Badger Rage on Bristle active"')
  expect(markup).not.toContain('Badger Rage on Mittens')
  findToggle(tree(), 'Badger Rage on Bristle active')!({ target: { checked: true } })
  expect(c.companions?.[0].badgerRageActive).toBe(true)
  expect(c.companions?.[1].badgerRageActive).toBeUndefined()
})

it('shows a pet only when Beast Trainer grants Pet', () => {
  const c: Character = {
    id: 'trainer', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Beast Trainer', type: 'Ancestry Feat', level: 1, choice: 'Pet' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)).toContain('<h4>Pet</h4>')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, feats: [{ ...c.feats[0], choice: 'Train Animal' }] }} entries={[]} save={() => {}} />))
    .not.toContain('<h4>Pet</h4>')
})

it('applies Fast Movement to pet Speeds without exposing the pet name or redundant ability notes', () => {
  let c: Character = {
    id: 'pet-speed', systems: ['pf2e'], name: 'Test', level: 4,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Beast Trainer', type: 'Ancestry Feat', level: 1, choice: 'Pet' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    pet: { name: 'Saved name', abilities: ['Fast Movement', 'Tough'] },
  }
  const tree = () => MinionsContent({ c, entries: [], save: patch => { c = { ...c, ...patch } } })
  let html = renderToStaticMarkup(tree())
  expect(html).toContain('<small>Hit Points</small><b>28</b>')
  expect(html).toContain('<h5>Speed</h5><div>40 feet</div>')
  expect(html).not.toContain('aria-label="Pet name"')
  expect(html).not.toContain('Increase one 25-foot Speed')
  expect(html).not.toContain('Maximum HP increases by 2 per level')
  expect(findSelect(tree(), 'Pet Fast Movement speed')).toBeUndefined()
  expect(c.pet?.name).toBe('Saved name')

  c = { ...c, pet: { ...c.pet, aquatic: true } }
  expect(renderToStaticMarkup(tree())).toContain('<h5>Speed</h5><div>Swim 40 feet</div>')
  c = { ...c, pet: { ...c.pet, aquatic: false, abilities: ['Fast Movement', 'Flier'] } }
  findSelect(tree(), 'Pet Fast Movement speed')!({ target: { value: 'Fly' } })
  html = renderToStaticMarkup(tree())
  expect(html).toContain('<h5>Speed</h5><div>25 feet, Fly 40 feet</div>')
  expect(c.pet?.name).toBe('Saved name')
  c = { ...c, pet: { ...c.pet, abilities: ['Tough'] } }
  expect(renderToStaticMarkup(tree())).toContain('<h5>Speed</h5><div>25 feet</div>')
})

it('adds and removes pet abilities from compact choices while preserving other saved data', () => {
  const confirm = vi.fn(() => true)
  vi.stubGlobal('window', { confirm })
  let c: Character = {
    id: 'pet-choices', systems: ['pf2e'], name: 'Test', level: 4,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Beast Trainer', type: 'Ancestry Feat', level: 1, choice: 'Pet' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    pet: { name: 'Saved', abilities: ['', 'Flier'], fastMovement: 'Fly' },
  }
  const tree = () => MinionsContent({ c, entries: familiarEntries, save: patch => { c = { ...c, ...patch } } })
  const initial = renderToStaticMarkup(tree())
  expect(initial).toContain('class="gear-card"')
  expect(initial).toContain('<h5>Defenses</h5>')
  expect(initial).toContain('<h5>Senses</h5>')
  expect(initial).toContain('<h5>Special</h5>')
  expect(initial).toContain('<h5>Speed</h5>')
  expect(initial).not.toContain('Pet ability 1</label>')
  findSelect(tree(), 'Pet ability')!({ target: { value: 'Fast Movement' } })
  expect(c.pet?.abilities).toEqual(['Fast Movement', 'Flier'])
  expect(findSelect(tree(), 'Pet ability')).toBeUndefined()
  expect(renderToStaticMarkup(tree())).toContain('Fly 40 feet')
  findButton(tree(), 'Remove Pet ability 1')!()
  expect(confirm).toHaveBeenCalledWith('Remove pet ability "Fast Movement"?')
  expect(c.pet).toMatchObject({ name: 'Saved', abilities: ['', 'Flier'], fastMovement: 'Fly' })
  findSelect(tree(), 'Pet ability')!({ target: { value: 'Flier' } })
  expect(c.pet?.abilities).toEqual(['', 'Flier'])
})

it('applies familiar Fast Movement to valid speeds and keeps amphibious movement equal', () => {
  const c: Character = {
    id: 'familiar-speed', systems: ['pf2e'], name: 'Test', level: 4, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { abilities: ['Fast Movement', 'Amphibious'], abilityOptions: { fastMovement: 'Fly' } },
  }
  const html = renderToStaticMarkup(<MinionsContent c={c} entries={familiarEntries} save={() => {}} />)
  expect(html).toContain('40 feet, Swim 40 feet')
  expect(html).not.toContain('Familiar Fast Movement speed')
})

it('applies Fast Movement to all familiar speeds without changing pets, and restores the saved selection when disabled', () => {
  const previous = getSettings()
  onTestFinished(() => updateSettings(previous))
  const c: Character = {
    id: 'all-familiar-speeds', systems: ['pf2e'], name: 'Test', level: 8, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }, { name: 'Enhanced Familiar', type: 'Class Feat', level: 2 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    familiar: { abilities: ['Fast Movement', 'Burrower', 'Flier'], abilityOptions: { fastMovement: 'Fly' } },
  }
  updateSettings({ familiarFastMovementAllSpeeds: true })
  const render = () => renderToStaticMarkup(<MinionsContent c={c} entries={familiarEntries} save={() => {}} />)
  expect(render()).toContain('40 feet, Burrow 20 feet, Fly 40 feet')
  expect(render()).not.toContain('Familiar Fast Movement speed')
  expect(minionMovementSpeeds(['Fast Movement', 'Flier'], 'Fly'))
    .toEqual([{ movement: 'Land', feet: 25 }, { movement: 'Fly', feet: 40 }])
  updateSettings({ familiarFastMovementAllSpeeds: false })
  expect(render()).toContain('25 feet, Burrow 5 feet, Fly 40 feet')
  expect(render()).toContain('Familiar Fast Movement speed')
  expect(c.familiar?.abilityOptions?.fastMovement).toBe('Fly')
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
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={familiarEntries} save={() => {}} />)
  expect(markup).toContain('<small>Hit Points</small><b>56</b>')
  expect(markup).toContain('<h5>Speed</h5><div>25 feet, Climb 25 feet, Fly 25 feet</div>')
  expect(markup).toContain('fly Speed of 25 feet')
  expect(markup).toContain('climb Speed of 25 feet')
  const reduced = renderToStaticMarkup(<MinionsSection c={{ ...c, feats: c.feats.slice(0, 1) }} entries={familiarEntries} save={() => {}} />)
  expect(reduced).toContain('<small>Hit Points</small><b>40</b>')
  expect(reduced).toContain('climb Speed of 25 feet')
  expect(reduced).toContain('(inactive)')
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
  const tree = () => MinionsContent({ c, entries: familiarEntries, save: patch => { c = { ...c, ...patch } } })
  expect(hasOption(tree(), 'leshy-familiar:plant')).toBe(false)
  expect(hasOption(tree(), 'leshy-secret:verdant burst')).toBe(false)
  expect(hasOption(tree(), 'familiar:Flier')).toBe(true)
  findSelect(tree(), 'Leshy familiar ability')!({ target: { value: 'leshy-secret:verdant burst' } })
  expect(c.feats[1].choice).toBeUndefined()
  findSelect(tree(), 'Leshy familiar ability')!({ target: { value: 'familiar:Flier' } })
  expect(c.familiar?.abilities).toEqual(['Flier'])
  c = { ...c, feats: c.feats.map(feat => feat.name === 'Leshy Familiar Secrets' ? { ...feat, choice: 'Verdant Burst' } : feat) }
  expect(renderToStaticMarkup(tree())).toContain('three-action Heal at rank 1')
  expect(renderToStaticMarkup(tree())).toContain('aria-label="Roll Verdant Burst: Healing and Additional plant healing"')
  expect(renderToStaticMarkup(tree())).toContain('Healing: 1d8 HP; Additional plant healing: 2 HP')
  expect(renderToStaticMarkup(MinionsContent({ c: { ...c, level: 10 }, entries: familiarEntries, save: () => {} })))
    .toContain('Healing: 4d8 HP; Additional plant healing: 8 HP')
  c = { ...c, className: 'Ranger' }
  expect(renderToStaticMarkup(tree())).toContain('Verdant Burst requires a 2nd-rank spell slot')
  expect(renderToStaticMarkup(tree())).not.toContain('Roll Verdant Burst')
  c = { ...c, feats: c.feats.map(feat => feat.name === 'Leshy Familiar Secrets' ? { ...feat, choice: 'Purify Air' } : feat) }
  expect(renderToStaticMarkup(tree())).toContain('+2 circumstance to saves against inhaled poison')
  c = { ...c, feats: c.feats.slice(0, 1) }
  expect(renderToStaticMarkup(tree())).not.toContain('+2 circumstance to saves against inhaled poison')
})

it('uses full companion stat names, omits redundant level, and keeps AC adjustment sources inside its popover', () => {
  const c: Character = {
    id: 'labels', systems: ['pf2e'], name: 'Test', level: 7, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'cat', type: 'Cat', name: '' }], activeSpells: ['Magic Hide', 'Enlarge Companion'],
    enlargeCompanionId: 'cat',
    spells: [{ name: 'Magic Hide', rank: 1, cantrip: false }, { name: 'Enlarge Companion', rank: 2, cantrip: false }],
  }
  const cat: ContentEntry = {
    id: 'cat', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Cat', level: 1,
    traits: [], description: '', data: {
      size: 'Medium', hp: 6, skill: 'Athletics, Stealth', companion_attacks: 'Jaws|1d8 piercing|',
    }, effects: [], updatedAt: 1,
  }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[cat]} save={() => {}} />)
  for (const label of ['Hit Points', 'Armor Class', 'Fortitude', 'Reflex', 'Strength', 'Dexterity',
    'Constitution', 'Intelligence', 'Wisdom', 'Charisma']) expect(markup).toContain(`<small>${label}</small>`)
  for (const label of ['Level', 'HP', 'AC', 'Fort', 'Ref', 'Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'])
    expect(markup).not.toContain(`<small>${label}</small>`)
  expect(markup).toContain('aria-label="Magic Hide, Enlarge Companion note"')
  expect(markup).not.toContain('</button> (Magic Hide, Enlarge Companion)')
  expect(markup).not.toContain('</button> (Enlarge Companion)')
  expect(markup).toContain('+1 Status (Magic Hide); -1 Status (clumsy 1; Enlarge Companion)')
  const skillsStart = markup.indexOf('<h5>Skills</h5>')
  expect(markup.slice(skillsStart)).not.toContain('</button> (Enlarge Companion)')
  const attacksStart = markup.indexOf('<h5>Attacks')
  const defensesStart = markup.indexOf('<h5>Defenses</h5>')
  expect(markup.slice(attacksStart, defensesStart)).not.toContain('</button> (Enlarge Companion)')
  expect(markup).toContain('<h5>Attacks (Reach 15 feet)')
  expect(markup).not.toContain('<small>Reach bonus</small>')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, level: 6 }} entries={[cat]} save={() => {}} />))
    .toContain('<h5>Attacks (Reach 10 feet)')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, level: 6 }} entries={[{
    ...cat, data: { ...cat.data, size: 'Tiny' },
  }]} save={() => {}} />)).toContain('<h5>Attacks (Reach 10 feet)')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, activeSpells: [] }} entries={[cat]} save={() => {}} />))
    .toContain('<h5>Attacks</h5>')
})

it('shows alphabetical companion status controls and groups action costs, maneuver rules, and descriptions', () => {
  const c: Character = {
    id: 'actions', systems: ['pf2e'], name: 'Test', level: 16, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Faithful Steed', type: 'Class Feat', level: 1 },
      { name: 'Pale Horse', type: 'Class Feat', level: 12 },
      { name: 'Primal Howl', type: 'Class Feat', level: 8 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'cat', type: 'Cat', name: '' }],
    spells: ['Canopy Crawler', 'Enlarge Companion', 'Magic Hide'].map(name => ({ name, rank: 2, cantrip: false })),
  }
  const cat: ContentEntry = {
    id: 'cat', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Cat', level: 1,
    traits: [], description: 'A pale-furred mountain cat. Starts Small.', data: {
      size: 'Medium', hp: 6, companion_attacks: 'Jaws|1d8 piercing|;Claws|1d6 slashing|agile',
      companion_support: 'The cat distracts its target.',
      companion_maneuver: 'Bear Hug', companion_maneuver_actions: 'Two Actions',
      companion_maneuver_traits: 'Flourish',
      companion_maneuver_requirements: 'The cat has a creature grabbed.',
      companion_maneuver_description: 'The cat crushes a grabbed creature.',
    }, effects: [], updatedAt: 1,
  }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[cat]} save={() => {}} />)
  expect(markup).toContain('<h4>Young Cat</h4>')
  expect(markup).not.toContain('Companions (1)')
  expect(markup.indexOf('Canopy Crawler')).toBeLessThan(markup.indexOf('Enlarge Companion'))
  expect(markup.indexOf('Enlarge Companion')).toBeLessThan(markup.indexOf('Pale Horse'))
  expect(markup).not.toContain('aria-label="Magic Hide on Cat"')
  expect(markup).not.toContain('Actions and maneuvers')
  expect(markup).toContain('<h5>Attacks</h5>')
  expect(markup).toContain('<h5>Maneuvers</h5>')
  const headings = [...markup.matchAll(/<h5>([^<]+)<\/h5>/g)].map(match => match[1])
  expect(headings).toEqual([...headings].sort((a, b) => a.localeCompare(b)))
  expect(headings).toContain('Equipment')
  expect(markup).not.toContain('<strong>Cat</strong>')
  const defenses = markup.slice(markup.indexOf('<h5>Defenses</h5>'), markup.indexOf('<h5>Equipment</h5>'))
  for (const name of ['Armor Class', 'Fortitude', 'Reflex', 'Will']) expect(defenses).toContain(`<small>${name}</small>`)
  expect(defenses).not.toContain('Perception')
  const senses = markup.slice(markup.indexOf('<h5>Senses</h5>'), markup.indexOf('<h5>Skills</h5>'))
  expect(senses).toContain('<small>Perception</small>')
  expect(markup.indexOf('<h5>Skills</h5>')).toBeLessThan(markup.indexOf('<b>Support Benefit</b>'))
  expect(markup.indexOf('<h5>Skills</h5>')).toBeLessThan(markup.indexOf('<h5>Special</h5>'))
  expect(markup.indexOf('<h5>Special</h5>')).toBeLessThan(markup.indexOf('<h5>Speed</h5>'))
  expect(markup).toContain('<span>Animal</span><span>Medium</span><span>Minion</span>')
  const skills = markup.slice(markup.indexOf('<h5>Skills</h5>'), markup.indexOf('<h5>Speed</h5>'))
  expect(skills).toContain('<div>Acrobatics +18 (T)</div>')
  expect(skills).toContain('<div>Athletics +18 (T)</div>')
  expect(markup).toContain('aria-label="Single Action"')
  expect(markup).toContain('aria-label="Two Actions"')
  expect(markup).not.toContain('class="companion-maneuver-card"')
  expect(markup).toContain('<b>Bear Hug</b><small>(Flourish)</small>')
  expect(markup).toContain('Requirements:</strong> The cat has a creature grabbed.')
  expect(markup).toContain('The cat crushes a grabbed creature.')
  expect(markup.indexOf('<b>Claws</b>')).toBeLessThan(markup.indexOf('<b>Jaws</b>'))
  expect(markup.indexOf('<b>Bear Hug</b>')).toBeLessThan(markup.indexOf('<b>Primal Howl</b>'))
  expect(markup.indexOf('<b>Primal Howl</b>')).toBeLessThan(markup.indexOf('<b>Support Benefit</b>'))
  expect(markup.match(/<b>Primal Howl<\/b>/g)).toHaveLength(1)
  expect(markup).not.toContain('Advanced maneuver')
  expect(markup).toContain('</header><p class="companion-description">A pale-furred mountain cat. Starts Small.</p>')
  expect(markup).not.toContain('<summary>About</summary>')
})

it.each([
  { className: 'Druid', level: 20, dc: 44, dice: 10 },
  { className: 'Druid', level: 19, dc: 43, dice: 9 },
  { className: 'Ranger', level: 20, dc: 42, dice: 10 },
])('resolves $className spell DC $dc and rolls $dice dice from Primal Howl at level $level', ({ className, level, dc, dice }) => {
  const c: Character = { id: 'howl', systems: ['pf2e'], name: 'Test', className, level,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 22, cha: 10 },
    feats: [{ name: 'Primal Howl', type: 'Class Feat', level: 8 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'cat', type: 'Cat', name: '' }] }
  const cat: ContentEntry = { id: 'cat', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Cat', level: 1,
    traits: ['Animal'], description: 'Uses your spell DC.', effects: [], updatedAt: 0,
    data: { size: 'Small', hp: 6, companion_maneuver: 'Test Maneuver',
      companion_maneuver_actions: 'One Action', companion_maneuver_description: 'Save against your spellcasting DC.',
      companion_support: 'Uses your spell DC.' } }
  const mastery: ContentEntry = { ...cat, id: 'ranger-mastery', kind: 'classFeature', name: 'Master Warden', level: 17,
    data: { class: 'Ranger' }, description: 'Your proficiency rank in spell DCs increases to master.' }
  const entries = [cat, mastery]
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain(`basic Fortitude save against DC ${dc}`)
  expect(html).toContain(`Save against DC ${dc}`)
  expect(html).not.toMatch(/your spell(?:casting)? DC/i)
  expect(html).toContain('aria-label="Roll Primal Howl: Damage"')
  expect(html).toContain(`title="Two Actions; Damage: ${dice}d6 sonic"`)
  expect(html.match(/aria-label="Roll Primal Howl: Damage"/g)).toHaveLength(1)
  const findHowl = (node: ReactNode): boolean => Children.toArray(node).some(child =>
    isValidElement<Record<string, unknown>>(child) && (child.type === DamageRoll && child.props.name === 'Primal Howl'
      ? child.props.toggleResult === true : findHowl(child.props.children as ReactNode)))
  expect(findHowl(MinionsContent({ c, entries, save: () => {} }))).toBe(true)
  expect(html).not.toContain('Roll Test Maneuver')
  const details = renderToStaticMarkup(<EntryDescription character={c} entries={entries} name={cat.name} entry={cat} />)
  expect(details).toContain(`Uses DC ${dc}.`)
  expect(details).not.toContain('your spell DC')
  const unknown = renderToStaticMarkup(<MinionsSection c={{ ...c, className: undefined }} entries={entries} save={() => {}} />)
  expect(unknown).toContain('basic Fortitude save against spell DC (unavailable)')
})

it.each([[8, 4], [19, 9], [20, 10]])('rolls Hellfire Gaze at companion level %i', (level, dice) => {
  const c: Character = { id: 'thrune', systems: ['pf2e'], name: 'Test', level,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'thrune', type: 'Thruneosaurus Rex', name: '' }] }
  const companion: ContentEntry = { ...CONSTRUCT_COMPANION_ENTRY, id: 'thrune', name: 'Thruneosaurus Rex',
    traits: ['Beast'], data: { size: 'Medium', hp: 6, companion_maneuver: 'Hellfire Gaze',
      companion_maneuver_actions: 'Two Actions', companion_maneuver_description: 'Basic Reflex save.' } }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[companion]} save={() => {}} />)
  expect(markup).toContain('aria-label="Roll Hellfire Gaze: Damage"')
  expect(markup).toContain('>Mount<')
  expect(markup).toContain(`title="Two Actions; Damage: ${dice}d6 fire"`)
})

it.each([[6, 4], [10, 5], [18, 7]])('rolls Riding Tarantula Hair Barrage at companion level %i', (level, dice) => {
  const c: Character = { id: 'tarantula', systems: ['pf2e'], name: 'Test', level,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'tarantula', type: 'Riding Tarantula', name: '' }] }
  const companion: ContentEntry = { ...CONSTRUCT_COMPANION_ENTRY, id: 'tarantula', name: 'Riding Tarantula',
    traits: ['Animal'], data: { size: 'Large', hp: 8, companion_maneuver: 'Hair Barrage',
      companion_maneuver_actions: 'Two Actions', companion_maneuver_description: 'Basic Reflex save.' } }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[companion]} save={() => {}} />)
  expect(markup).toContain('aria-label="Roll Hair Barrage: Damage"')
  expect(markup).toContain(`title="Two Actions; Damage: ${dice}d6 piercing"`)
})

it.each([[2, 1], [8, 4], [19, 9], [20, 10]])('rolls Riding Drake Fire Breath at companion level %i', (level, dice) => {
  const c: Character = { id: 'drake', systems: ['pf2e'], name: 'Test', level,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'drake', type: 'Riding Drake', name: '' }] }
  const drake: ContentEntry = { ...CONSTRUCT_COMPANION_ENTRY, id: 'drake', name: 'Riding Drake',
    traits: ['Dragon'], data: { size: 'Large', hp: 8, companion_maneuver: 'Fire Breath',
      companion_maneuver_actions: 'Two Actions', companion_maneuver_description: 'Basic Reflex save.' } }
  const render = (character: Character, companion = drake) =>
    renderToStaticMarkup(<MinionsSection c={character} entries={[companion]} save={() => {}} />)
  expect(render(c)).toContain('aria-label="Roll Fire Breath: Damage"')
  expect(render(c)).toContain(`title="Two Actions; Damage: ${dice}d6 fire"`)
  expect(render({ ...c, level: 1 })).not.toContain('aria-label="Roll Fire Breath: Damage"')
  expect(render(c, { ...drake, data: { ...drake.data, companion_maneuver: 'Other' } }))
    .not.toContain('aria-label="Roll Fire Breath: Damage"')
})

it('shows horseshoe rules in the Athletics source note instead of beneath Speed', () => {
  const c: Character = {
    id: 'horse-note', systems: ['pf2e'], name: 'Test', level: 8, className: 'Champion',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'horse', type: 'Horse', name: 'Buddy', equipment: {
      Shoes: { entryId: 'shoes', name: 'Alacritous Horseshoes (Greater)', qty: 1 },
    } }],
  }
  const horse: ContentEntry = {
    id: 'horse', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Horse', level: 1,
    traits: [], description: '', data: { size: 'Large', hp: 8, speed_raw: '40 feet', skill: 'Athletics' }, effects: [], updatedAt: 1,
  }
  const shoes: ContentEntry = {
    id: 'shoes', systems: ['pf2e'], kind: 'item', source: 'official', name: 'Alacritous Horseshoes (Greater)', level: 14,
    traits: ['Companion'], description: '', data: { item_subcategory: 'Companion Items' }, effects: [], updatedAt: 1,
  }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[horse, shoes]} save={() => {}} />)
  expect(markup).toContain('aria-label="Alacritous Horseshoes (Greater) note"')
  expect(markup).toContain('to Athletics checks to High Jump and Long Jump (+3 circumstance bonus)')
  expect(markup).toContain('when Leaping, move 5 feet farther horizontally or 3 feet higher vertically')
  expect(markup).not.toContain('<small>Alacritous Horseshoes (Greater):')
})

it('persists Support Benefit activation separately for each companion and resets it when its type changes', () => {
  const cat: ContentEntry = { ...CONSTRUCT_COMPANION_ENTRY, id: 'cat', name: 'Cat', traits: ['Animal'],
    data: { size: 'Small', hp: 6, companion_support: 'Distracts nearby foes.' } }
  const wolf: ContentEntry = { ...cat, id: 'wolf', name: 'Wolf', data: { ...cat.data, companion_support: 'Tears at a foe.' } }
  const entries = [cat, wolf]
  let c: Character = { id: 'support', systems: ['pf2e'], name: 'Test', level: 4, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Wolf', name: 'B' }] }
  const original = JSON.stringify(c)
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const content = () => MinionsContent({ c, entries, save })
  expect(renderToStaticMarkup(content())).toContain('aria-label="Support Benefit on A"')
  expect(JSON.stringify(c)).toBe(original)
  findToggle(content(), 'Support Benefit on A')!({ target: { checked: true } })
  expect(c.companions).toEqual([
    { id: 'a', type: 'Cat', name: 'A', supportActive: true }, { id: 'b', type: 'Wolf', name: 'B' },
  ])
  expect(renderToStaticMarkup(content())).toContain('aria-label="Support Benefit on A" checked=""')
  expect(renderToStaticMarkup(content())).not.toContain('aria-label="Support Benefit on B" checked=""')
  findToggle(content(), 'Support Benefit on A')!({ target: { checked: false } })
  expect(c.companions?.[0].supportActive).toBe(false)
  findToggle(content(), 'Support Benefit on A')!({ target: { checked: true } })
  findSelect(content(), 'Companion type')!({ target: { value: 'Wolf' } })
  expect(c.companions?.[0]).toMatchObject({ type: 'Wolf', supportActive: false })
  expect(renderToStaticMarkup(content())).toContain('Tears at a foe.')
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

it('syncs Apex Companion activation with the chosen companion and exposes its actual effects', () => {
  const animal: ContentEntry = { ...CONSTRUCT_COMPANION_ENTRY, id: 'cat', name: 'Cat', traits: ['Animal'],
    data: { size: 'Small', hp: 8, strength: 3, speed_raw: '30 feet', companion_attacks: 'claw|1d6 slashing|agile' } }
  const spell: ContentEntry = { ...animal, id: 'apex-spell', kind: 'spell', name: 'Apex Companion', level: 10, traits: ['Focus'], data: {} }
  const feat: ContentEntry = { ...spell, id: 'apex-feat', kind: 'feat', level: 20, data: { grants_focus_spells: 'Apex Companion' } }
  const entries = [animal, spell, feat, CONSTRUCT_COMPANION_ENTRY]
  let c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 20, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: feat.name, type: 'Class Feat', level: 20 }], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    activeSpells: ['Enlarge Companion', 'Keen Smell'],
    enlargeCompanionId: 'b',
    companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Cat', name: 'B' }] }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const control = (companionId?: string) => CompanionSpellOptions({ c, entries, save, name: 'Apex Companion', companionId })
  findToggle(control('b'), 'Apex Companion on B')!({ target: { checked: true } })
  expect(c.apexCompanionId).toBe('b')
  expect(c.activeSpells).toEqual(['Keen Smell', 'Apex Companion'])
  expect(renderToStaticMarkup(control('a'))).not.toContain('checked=""')
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={entries} save={save} />)
  expect(markup).not.toContain('aria-label="Apex Companion on B"')
  for (const text of ['<small>Temporary Hit Points</small><b>30</b>', '<h5>Attacks (Reach 15 feet)',
    'Deadly d12', 'Darkvision', 'greater difficult terrain', '40 feet']) expect(markup).toContain(text)
  const spells = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
  expect(spells).toContain('aria-label="Apex Companion active" checked=""')
  findToggle(control(), 'Apex Companion active')!({ target: { checked: false } })
  expect(c.activeSpells).toEqual(['Keen Smell'])
  expect(renderToStaticMarkup(<MinionsSection c={c} entries={entries} save={save} />)).not.toContain('Temporary Hit Points')
  c = { ...c, level: 18 }
  findToggle(control('b'), 'Apex Companion on B')!({ target: { checked: true } })
  expect(c.activeSpells).not.toContain('Apex Companion')
  c = { ...c, level: 20, companions: [{ id: 'b', type: CONSTRUCT_COMPANION_NAME, name: 'B' }] }
  findToggle(control('b'), 'Apex Companion on B')!({ target: { checked: true } })
  expect(c.activeSpells).not.toContain('Apex Companion')
})

it.each([
  ['Incredible Companion', 'Specialized Companion'],
  ['Incredible Mount', 'Specialized Mount'],
  ['Imposing Destrier', 'Specialized Mount'],
  ['Incredible Beastmaster Companion', 'Specialized Beastmaster Companion'],
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
  expect(markup).not.toContain('<strong>Wolf</strong>')
  expect(markup).not.toContain('Wolf (Wolf)')
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

it('lets a Champion choose Faithful Steed without a companion naming field', () => {
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
  expect(markup).toContain('<h4>Young Horse</h4>')
  expect(markup).toContain('aria-label="Companion type"')
  expect(markup).not.toContain('Choose Faithful Steed')
  expect(markup).not.toContain('aria-label="Companion name"')
  expect(c.companions).toMatchObject([{ type: 'Horse', name: '' }])
})

it('hides the Animal Companion section when there is no companion or companion-granting feat', () => {
  const c: Character = {
    id: 'no-companion', systems: ['pf2e'], name: 'Test', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const html = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(html).not.toContain('Animal Companion')
  expect(html).not.toContain('Choose Faithful Steed')
})

it('adds Beastmaster specialization slots beside existing companion specializations without replacing them', () => {
  const wolf: ContentEntry = {
    id: 'wolf', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Wolf', level: 1,
    traits: [], description: '', data: { strength: 2, dexterity: 2, constitution: 2, intelligence: -4, wisdom: 1,
      charisma: 0, hp: 8, size: 'Medium', speed: 35, companion_attacks: 'Jaws|1d8 piercing|' }, effects: [], updatedAt: 0,
  }
  let c: Character = {
    id: 'beastmaster-specializations', systems: ['pf2e'], name: 'Test', level: 16, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Incredible Companion', type: 'Class Feat', level: 6, choice: 'Nimble' },
      { name: 'Specialized Companion', type: 'Class Feat', level: 14, choice: 'Ambusher' },
      { name: 'Specialized Beastmaster Companion', type: 'Archetype Feat', level: 14 },
      { name: 'Specialized Beastmaster Companion', type: 'Archetype Feat', level: 14, takenLevel: 16 },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'wolf', type: 'Wolf', name: '' }],
  }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const tree = () => MinionsContent({ c, entries: [wolf], save })
  for (const index of [2, 3, 4]) expect(findSelect(tree(), `Companion specialization ${index}`)).toBeTypeOf('function')
  expect(findSelect(tree(), 'Companion specialization 5')).toBeUndefined()
  findSelect(tree(), 'Companion specialization 3')!({ target: { value: 'Racer' } })
  findSelect(tree(), 'Companion specialization 4')!({ target: { value: 'Wrecker' } })
  expect(c.feats.map(feat => feat.choice)).toEqual(['Nimble', 'Ambusher', 'Racer', 'Wrecker'])
  expect(companionAdvancement(c).specializations).toEqual(['Ambusher', 'Racer', 'Wrecker'])
  expect(c.companions).toHaveLength(1)
  const earlier = MinionsContent({ c: { ...c, level: 15 }, entries: [wolf], save })
  expect(findSelect(earlier, 'Companion specialization 3')).toBeTypeOf('function')
  expect(findSelect(earlier, 'Companion specialization 4')).toBeUndefined()
})

it('rolls Vicious Rend bleed for qualifying companions, scaling with specialization', () => {
  const cat: ContentEntry = { id: 'cat', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Cat', level: 1,
    traits: [], description: '', data: { size: 'Medium', companion_attacks: 'Claw|1d6 slashing|agile' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'rend', systems: ['pf2e'], name: 'Test', level: 16, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Vicious Rend', type: 'Archetype Feat', level: 10 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'cat', type: 'Cat', name: '' }] }
  const render = (character: Character, companion = cat) => renderToStaticMarkup(<MinionsSection c={character} entries={[companion]} save={() => {}} />)
  expect(render(c)).toContain('aria-label="Roll Vicious Rend: Persistent bleed"')
  expect(render(c)).toContain('Persistent bleed: 1d6 bleed')
  const specialized: Character = { ...c, feats: [...c.feats,
    { name: 'Specialized Companion', type: 'Class Feat', level: 14, choice: 'Ambusher' }] }
  expect(render(specialized)).toContain('Persistent bleed: 2d6 bleed')
  expect(render(c, { ...cat, data: { ...cat.data, companion_attacks: 'Jaws|1d8 piercing|' } })).not.toContain('Roll Vicious Rend')
})

it('alphabetizes companion advancement, size, specializations, and traits together', () => {
  const companion: ContentEntry = {
    id: 'beast', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Beast', level: 1,
    traits: ['Beast', 'Rare'], description: '', data: { size: 'Medium' }, effects: [], updatedAt: 0,
  }
  const c: Character = {
    id: 'badges', systems: ['pf2e'], name: 'Test', level: 20, className: 'Fighter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Incredible Companion', type: 'Class Feat', level: 8, choice: 'Savage' },
      { name: 'Auspicious Mount', type: 'Class Feat', level: 16, choice: 'Auspice' },
      { name: 'Specialized Companion', type: 'Class Feat', level: 14, choice: 'Bully' },
      { name: 'Specialized Beastmaster Companion', type: 'Archetype Feat', level: 16, choice: 'Wrecker' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'beast', type: 'Beast', name: '', auspiceServitor: 'Fiend', auspiceSubtype: 'Devil' }],
  }
  const markup = renderToStaticMarkup(<MinionsSection c={c} entries={[companion]} save={() => {}} />)
  const badges = markup.match(/<div class="gear-traits">([\s\S]*?)<\/div>/)?.[1] ?? ''
  expect([...badges.matchAll(/<span>([^<]+)<\/span>/g)].map(match => match[1]))
    .toEqual(['Auspice', 'Beast', 'Bully', 'Devil', 'Fiend', 'Large', 'Minion', 'Rare', 'Savage', 'Unholy', 'Wrecker'])
})

it('offers Peerless Mascot and its language and banner controls', () => {
  const companion: ContentEntry = { ...CONSTRUCT_COMPANION_ENTRY, id: 'bear', name: 'Bear',
    traits: ['Animal'], data: { size: 'Medium', hp: 6, speed_raw: '35 feet' } }
  let c: Character = { id: 'mascot', systems: ['pf2e'], name: 'Test', level: 20, className: 'Commander',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Peerless Mascot Companion', type: 'Class Feat', level: 16 },
      { name: 'Glorious Banner', type: 'Class Feat', level: 20 }],
    equipment: [], lores: [], languages: ['Dwarven'], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'bear', type: 'Bear', name: '' }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => MinionsContent({ c, entries: [companion], save })
  expect(renderToStaticMarkup(tree())).toContain('<option value="Peerless Mascot">Peerless Mascot</option>')
  findSelect(tree(), 'Companion specialization 1')!({ target: { value: 'Peerless Mascot' } })
  expect(renderToStaticMarkup(tree())).toContain('30-foot aura')
  expect(findSelect(tree(), 'Peerless Mascot language')).toBeTypeOf('function')
  findSelect(tree(), 'Peerless Mascot language')!({ target: { value: 'Dwarven' } })
  expect(c.companions?.[0].mascotLanguage).toBe('Dwarven')
  findToggle(tree(), 'Banner affixed to Bear')!({ target: { checked: true } })
  expect(renderToStaticMarkup(tree())).toContain('100-foot aura')
  expect(renderToStaticMarkup(MinionsContent({ c: { ...c, level: 19 }, entries: [companion], save })))
    .toContain('60-foot aura')
})

it("offers Peerless Mascot on a Commander's Companion with Beastmaster specialization", () => {
  const companion: ContentEntry = { ...CONSTRUCT_COMPANION_ENTRY, id: 'bear', name: 'Bear',
    traits: ['Animal'], data: { size: 'Medium', hp: 6, speed_raw: '35 feet' } }
  let c: Character = { id: 'mascot', systems: ['pf2e'], name: 'Test', level: 16, className: 'Commander',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: "Commander's Companion", type: 'Class Feat', level: 2 },
      { name: 'Specialized Beastmaster Companion', type: 'Archetype Feat', level: 14 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'bear', type: 'Bear', name: '' }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => MinionsContent({ c, entries: [companion], save })
  expect(renderToStaticMarkup(tree())).toContain('<option value="Peerless Mascot">Peerless Mascot</option>')
  findSelect(tree(), 'Companion specialization 2')!({ target: { value: 'Peerless Mascot' } })
  expect(c.feats[1].choice).toBe('Peerless Mascot')
  expect(renderToStaticMarkup(tree())).toContain('30-foot aura')
})

it('grants a Beastmaster Dedication companion and extra companions only with Additional Companion', () => {
  let c: Character = {
    id: 'beastmaster', systems: ['pf2e'], name: 'Test', level: 4, className: 'Fighter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Beastmaster Dedication', type: 'Archetype Feat', level: 2 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0, companions: [],
  }
  const wolf: ContentEntry = {
    id: 'wolf', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Wolf', level: 1,
    traits: [], description: '', data: { size: 'Medium' }, effects: [], updatedAt: 1,
  }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(getSettings().singleAnimalCompanion).toBe(true)
  updateSettings({ singleAnimalCompanion: false })
  findSelect(MinionsContent({ c, entries: [wolf], save }), 'Choose Faithful Steed')?.({ target: { value: 'Wolf' } })
  expect(c.companions).toMatchObject([{ type: 'Wolf' }])
  expect(findSelect(MinionsContent({ c, entries: [wolf], save }), 'Choose additional companion')).toBeUndefined()
  c = { ...c, feats: [...c.feats, { name: 'Additional Companion', type: 'Archetype Feat', level: 4 }] }
  findSelect(MinionsContent({ c, entries: [wolf], save }), 'Choose additional companion')?.({ target: { value: 'Wolf' } })
  expect(c.companions).toHaveLength(2)
  expect(findSelect(MinionsContent({ c, entries: [wolf], save }), 'Choose additional companion')).toBeUndefined()
  updateSettings({ singleAnimalCompanion: true })
  c = { ...c, companions: c.companions!.slice(0, 1), feats: [...c.feats, { name: 'Additional Companion', type: 'Archetype Feat', level: 6 }] }
  expect(findSelect(MinionsContent({ c, entries: [wolf], save }), 'Choose additional companion')).toBeUndefined()
})

it('advances additional Beastmaster companions with independent choices', () => {
  const wolf: ContentEntry = {
    id: 'wolf', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Wolf', level: 1,
    traits: ['Animal'], description: '', data: { size: 'Medium', hp: 6, speed_raw: '35 feet' }, effects: [], updatedAt: 1,
  }
  let c: Character = {
    id: 'beasts', systems: ['pf2e'], name: 'Test', level: 16, className: 'Fighter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Mature Beastmaster Companion', type: 'Archetype Feat', level: 4 },
      { name: 'Incredible Beastmaster Companion', type: 'Archetype Feat', level: 8, choice: 'Nimble' },
      { name: 'Specialized Beastmaster Companion', type: 'Archetype Feat', level: 14, choice: 'Ambusher', slot: 'archetype:14:0' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'one', type: 'Wolf', name: 'First' }, { id: 'two', type: 'Wolf', name: 'Second' }],
  }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => MinionsContent({ c, entries: [wolf], save })
  expect(renderToStaticMarkup(tree())).toContain('Companion advancement: Second')
  findSelect(tree(), 'Companion advancement: Second')!({ target: { value: 'Savage' } })
  findSelect(tree(), 'Companion specialization 3: Second')!({ target: { value: 'Racer' } })
  expect(c.companions?.[1]).toMatchObject({ beastmasterAdvancement: 'Savage',
    beastmasterSpecializations: { 'archetype:14:0': 'Racer' } })
  const html = renderToStaticMarkup(tree())
  expect(html).toContain('<span>Savage</span>')
  expect(html).toContain('<span>Racer</span>')
  expect(html).toContain('<span>Nimble</span>')
  expect(html).toContain('<span>Ambusher</span>')
  c = { ...c, level: 7 }
  expect(renderToStaticMarkup(tree())).not.toContain('Companion advancement: Second')
  expect(renderToStaticMarkup(tree())).not.toContain('<span>Savage</span>')
})

it('derives Auspice servitor from Champion sanctification only while Auspicious Mount is available', () => {
  let c: Character = {
    id: 'champion', systems: ['pf2e'], name: 'Test', level: 16, className: 'Champion', deity: 'Patron', sanctification: 'Holy',
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
  const deity: ContentEntry = { ...horse, id: 'patron', kind: 'deity', name: 'Patron', data: { sanctification: 'holy, unholy' } }
  const tree = () => MinionsContent({ c, entries: [horse, deity], save })
  expect(renderToStaticMarkup(tree())).toContain('<option value="Auspice">Auspice</option>')
  const choose = findSelect(tree(), 'Companion specialization 1')!
  choose({ target: { value: 'Auspice' } })
  expect(c.feats[0].choice).toBe('Auspice')
  expect(findSelect(tree(), 'Auspice servitor')).toBeUndefined()
  expect(c.companions![0].auspiceServitor).toBeUndefined()
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('<span>Holy</span>')
  expect(markup).toContain('Weakness: Unholy 5')
  expect(markup).not.toContain('fly 40 feet')
  c = { ...c, sanctification: 'Unholy' }
  expect(renderToStaticMarkup(tree())).toContain('<span>Fiend</span>')
  expect(renderToStaticMarkup(tree())).toContain('Weakness: Holy 5')
  findSelect(tree(), 'Auspice servitor type')!({ target: { value: 'Devil' } })
  expect(c.companions![0].auspiceSubtype).toBe('Devil')
  let languageMarkup = renderToStaticMarkup(tree())
  expect(languageMarkup).toContain('<span>Devil</span>')
  expect(languageMarkup).toContain('Language: ')
  expect(languageMarkup).toContain('<summary>Diabolic</summary>')
  expect(languageMarkup).toContain('Speakers: Devils')
  c = { ...c, sanctification: 'Holy' }
  expect(renderToStaticMarkup(tree())).not.toContain('<summary>Diabolic</summary>')
  findSelect(tree(), 'Auspice servitor type')!({ target: { value: 'Angel' } })
  languageMarkup = renderToStaticMarkup(tree())
  expect(languageMarkup).toContain('<span>Angel</span>')
  expect(languageMarkup).toContain('<summary>Empyrean</summary>')
  expect(languageMarkup).toContain('Speakers: Angels and other celestials')
  c = { ...c, sanctification: undefined }
  expect(renderToStaticMarkup(tree())).toContain('<span>Monitor</span>')
  expect(renderToStaticMarkup(tree())).not.toContain('Weakness:')
  expect(renderToStaticMarkup(tree())).not.toContain('<summary>Empyrean</summary>')
  c = { ...c, level: 15 }
  expect(renderToStaticMarkup(tree())).not.toContain('Companion specialization')
  expect(renderToStaticMarkup(tree())).not.toContain('Auspice servitor')
  expect(c.feats[0].choice).toBe('Auspice')
  c = { ...c, level: 16 }
  expect(renderToStaticMarkup(tree())).toContain('<option value="Auspice" selected="">Auspice</option>')
})

it('derives Auspice languages from existing angel and devil companion traits', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 16, className: 'Champion', deity: 'Patron',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Auspicious Mount', type: 'Class Feat', level: 16, choice: 'Auspice' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'mount', type: 'Horse', name: '' }],
  }
  const horse: ContentEntry = {
    id: 'horse', systems: ['pf2e'], kind: 'companion', source: 'official', name: 'Horse', level: 1,
    traits: ['Angel'], description: '', data: { size: 'Large' }, effects: [], updatedAt: 1,
  }
  const deity: ContentEntry = { ...horse, id: 'patron', kind: 'deity', name: 'Patron',
    traits: [], data: { sanctification: 'holy, unholy' } }
  const render = (character: Character, companion: ContentEntry) =>
    renderToStaticMarkup(MinionsContent({ c: character, entries: [companion, deity], save: () => {} }))
  expect(render({ ...c, sanctification: 'Holy' }, horse)).toContain('<summary>Empyrean</summary>')
  expect(render({ ...c, sanctification: 'Unholy' }, { ...horse, traits: ['Devil'] })).toContain('<summary>Diabolic</summary>')
  expect(render({ ...c, sanctification: 'Unholy', level: 15 }, { ...horse, traits: ['Devil'] })).not.toContain('<summary>Diabolic</summary>')
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
  expect(markup).toMatch(/Huge<button[^>]*>\*<\/button><span[^>]*popover="auto"/)
  expect(markup).not.toContain('</button> (Enlarge Companion)')
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

it('shows an active Marvelous Mount in Minions with a Mounted toggle', () => {
  const c: Character = { id: 'mount', name: 'Test', systems: ['pf2e'], level: 4, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [], activeSpells: ['Marvelous Mount'],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(summonedMounts(c, [])).toEqual([expect.objectContaining({ key: 'spell:Marvelous Mount', speed: '40 feet' })])
  const minions = renderToStaticMarkup(<MinionsSection c={c} entries={[]} save={() => {}} />)
  expect(minions).toContain('Marvelous Mount')
  expect(minions).toContain('aria-label="Mounted on Marvelous Mount"')
  expect(renderToStaticMarkup(<MinionsSection c={{ ...c, activeSpells: [] }} entries={[]} save={() => {}} />)).not.toContain('Marvelous Mount')
})

it('lists Iruxi Armaments Fangs once when imported data also grants it', () => {
  const imported: ContentEntry = { id: 'imp', name: 'Fangs', kind: 'weapon', systems: ['pf2e'], source: 'official', level: 0,
    traits: ['Unarmed'], description: '', data: { damage: '1d8 piercing', granted_by_feat: 'Iruxi Armaments', granted_by_feat_choice: 'Fangs' },
    effects: [], updatedAt: 0 }
  const c: Character = { id: 'ir', name: 'Test', systems: ['pf2e'], level: 1, ancestry: 'Lizardfolk',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Iruxi Armaments', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'Fangs' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(ownedWeapons(c, [imported]).filter(weapon => weapon.name === 'Fangs')).toHaveLength(1)
})

it('checks Soldier Synchronization class feature prerequisites and hides the Finely Tuned write-in', () => {
  const sync: ContentEntry = { id: 'ss', name: 'Soldier Synchronization', kind: 'feat', systems: ['sf2e'], source: 'official', level: 4,
    traits: ['Archetype'], description: '', data: { prerequisite: 'Grenadier Dedication; primary target or suppressing fire class features' },
    effects: [], updatedAt: 0 }
  const dedication: ContentEntry = { ...sync, id: 'gd', name: 'Grenadier Dedication', data: {} }
  const c: Character = { id: 'ss', name: 'Test', systems: ['sf2e'], level: 8, className: 'Soldier',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Grenadier Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const check = (character: Character) => featPrerequisiteChecker(character, [sync, dedication], 8)(sync)
  expect(check(c)).toEqual({ missing: [], manual: [] })
  expect(check({ ...c, className: 'Mystic' }).missing).toHaveLength(1)
})

it('adds the razing trait to grenades with Breaching Grenades', async () => {
  const { withBreachingGrenades } = await import('./formulas')
  const grenade: ContentEntry = { id: 'g', name: 'Frag Grenade', kind: 'item', systems: ['sf2e'], source: 'official', level: 1,
    traits: ['Grenade'], description: '', data: {}, effects: [], updatedAt: 0 }
  const c: Character = { id: 'bg', name: 'Test', systems: ['sf2e'], level: 12,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Breaching Grenades', type: 'Archetype Feat', level: 12, slot: 'archetype:12:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(withBreachingGrenades(c, grenade)?.traits).toEqual(['Grenade', 'Razing'])
  expect(withBreachingGrenades({ ...c, feats: [] }, grenade)).toBe(grenade)
})

it('grants a fly Speed and a Wing unarmed attack only while Skyfire Wings is active', () => {
  const c: Character = { id: 'sky', name: 'Test', systems: ['sf2e'], level: 10, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    spells: [{ name: 'Skyfire Wings', rank: 3, cantrip: false }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(ownedWeapons(c, []).some(weapon => weapon.name === 'Wing')).toBe(false)
  expect(movementSpeeds(c, []).some(speed => speed.name === 'Fly')).toBe(false)
  const active = { ...c, activeSpells: ['Skyfire Wings'] }
  expect(ownedWeapons(active, []).some(weapon => weapon.name === 'Wing')).toBe(true)
  expect(movementSpeeds(active, []).find(speed => speed.name === 'Fly')?.feet).toBeGreaterThanOrEqual(20)
})

it('applies a toggled Resist Energy as resistance of the chosen type', async () => {
  const { resistances } = await import('./builder')
  const c: Character = { id: 're', name: 'Test', systems: ['pf2e'], level: 8, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    spells: [{ name: 'Resist Energy', rank: 2, cantrip: false }], resistEnergyType: 'cold',
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(resistances(c, []).some(item => item.source === 'Resist Energy')).toBe(false)
  expect(resistances({ ...c, activeSpells: ['Resist Energy'] }, [])).toContainEqual(
    expect.objectContaining({ damage: 'Cold', value: 10 }))
})

it('does not multiply Skyfire Wings dice by striking', async () => {
  const { weaponAttack, effectiveWeapon } = await import('./builder')
  const c: Character = { id: 'sky2', name: 'Test', systems: ['sf2e'], level: 20, ancestry: 'Human', className: 'Soldier',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    spells: [{ name: 'Skyfire Wings', rank: 3, cantrip: false }], activeSpells: ['Skyfire Wings'],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const wing = effectiveWeapon(c, [], { ...ownedWeapons(c, []).find(weapon => weapon.name === 'Wing')!, striking: 3 })
  expect(weaponAttack(c, [], wing).damage).toMatch(/^4d8/)
  expect(weaponAttack(c, [], wing).additionalDamage.some(item => /^8 persistent/.test(item.value))).toBe(true)
})

it('scales solar weapon core crystals by level and limits orbital crystals to its potency', async () => {
  const { weaponAttack, installedWeaponUpgrades } = await import('./builder')
  const orbital = (id: string, name: string): ContentEntry => ({ id, name, kind: 'item', systems: ['sf2e'], level: 6, source: 'official', traits: [],
    description: '', data: { item_subcategory: 'Orbital Crystal' }, effects: [], updatedAt: 1 } as unknown as ContentEntry)
  const entries = [orbital('o1', 'Gluon (Commercial)'), orbital('o2', 'Cycling')]
  const c: Character = { id: 'sol', name: 'Test', systems: ['sf2e'], level: 12, ancestry: 'Human', className: 'Solarian',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const weapon = ownedWeapons(c, entries).find(item => item.id === 'sf2e:solarian:solar-weapon')!
  expect(weaponAttack(c, entries, weapon)).toMatchObject({ damage: expect.stringMatching(/^3d8/) })
  expect(installedWeaponUpgrades({ ...c, level: 2 }, entries, { ...weapon, upgrades: ['o1', 'o2'] }).map(item => item.id)).toEqual(['o1'])
  expect(installedWeaponUpgrades(c, entries, { ...weapon, upgrades: ['o1', 'o2'] })).toHaveLength(2)
})

it('adds Photon crystal damage only while photon attuned and uses the highest installed grade', async () => {
  const { weaponAttack } = await import('./builder')
  const orbital = (id: string, name: string, level: number): ContentEntry => ({
    id, name, kind: 'item', systems: ['sf2e'], level, source: 'official', traits: [],
    description: '', data: { item_subcategory: 'Orbital Crystal' }, effects: [], updatedAt: 0,
  })
  const entries = [orbital('commercial', 'Photon (Commercial)', 7), orbital('tactical', 'Photon (Tactical)', 14)]
  const c: Character = { id: 'photon', name: 'Test', systems: ['sf2e'], level: 16, className: 'Solarian',
    solarianAttunement: 'Photon', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Twin Weapons', type: 'Class Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const weapons = ownedWeapons(c, entries).filter(item => item.id.startsWith('sf2e:solarian:'))
  expect(weapons).toHaveLength(3)
  for (const weapon of weapons) {
    const installed = { ...weapon, upgrades: ['commercial', 'tactical'] }
    const bonuses = weaponAttack(c, entries, installed).additionalDamage.filter(item => item.source.startsWith('Photon ('))
    expect(bonuses).toEqual([{ source: 'Photon (Tactical)', value: '1d6 fire',
      note: expect.stringContaining('DC 31') }])
    expect(weaponAttack({ ...c, solarianAttunement: 'Graviton' }, entries, installed).additionalDamage
      .some(item => item.source.startsWith('Photon ('))).toBe(false)
  }
})

it('shares orbital crystals between manifestations and preserves legacy crystal selections', async () => {
  const { installedWeaponUpgrades, solarianOrbitalCrystals } = await import('./builder')
  const crystal = (id: string): ContentEntry => ({ id, name: id, kind: 'item', systems: ['sf2e'], level: 7,
    source: 'official', traits: [], description: '', data: { item_subcategory: 'Orbital Crystal' }, effects: [], updatedAt: 0 })
  const entries = [crystal('A'), crystal('B')]
  const c: Character = { id: 'shared', name: 'Test', systems: ['sf2e'], level: 10, className: 'Solarian',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    weapons: [{ id: 'sf2e:solarian:solar-weapon', name: 'Solar Weapon', potency: 0, striking: 0, runes: [], upgrades: ['A'] },
      { id: 'sf2e:solarian:flare', name: 'Solar Flare', potency: 0, striking: 0, runes: [], upgrades: ['B', 'A'] }] }
  const twin = { id: 'sf2e:solarian:twin-weapon', name: 'Twin Solar Weapon', potency: 0, striking: 0, runes: [] }
  expect(solarianOrbitalCrystals(c, twin)).toEqual(['A', 'B'])
  for (const weapon of [...c.weapons!, twin]) {
    expect(installedWeaponUpgrades(c, entries, weapon).map(item => item.id)).toEqual(['A', 'B'])
    expect(installedWeaponUpgrades({ ...c, solarianOrbitalCrystals: ['B'] }, entries, weapon).map(item => item.id)).toEqual(['B'])
    expect(installedWeaponUpgrades({ ...c, solarianOrbitalCrystals: [] }, entries, weapon)).toEqual([])
  }
})

it('automatically scales solar crystals within available shared slots and swaps attunement crystals', async () => {
  const { installedWeaponUpgrades, weaponAttack } = await import('./builder')
  const previous = getSettings().automaticSfWeaponUpgrades
  onTestFinished(() => updateSettings({ automaticSfWeaponUpgrades: previous }))
  updateSettings({ automaticSfWeaponUpgrades: true })
  const crystal = (name: string, level: number): ContentEntry => ({ id: name, name, kind: 'item', systems: ['sf2e'], level,
    source: 'official', traits: [], description: '', data: { item_subcategory: 'Orbital Crystal' }, effects: [], updatedAt: 0 })
  const entries = [crystal('Gluon (Commercial)', 6), crystal('Gluon (Tactical)', 9),
    crystal('Gluon (Advanced)', 12), crystal('Gluon (Superior)', 15),
    crystal('Quasar', 13), crystal('Photon (Commercial)', 7),
    crystal('Photon (Tactical)', 14), crystal('Graviton (Commercial)', 7), crystal('Graviton (Tactical)', 14),
    crystal('Other', 1)]
  const c: Character = { id: 'auto-crystals', name: 'Test', systems: ['sf2e'], level: 16, className: 'Solarian',
    solarianAttunement: 'Photon', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const weapon = ownedWeapons(c, entries).find(item => item.name === 'Solar Weapon')!
  const names = (character: Character) => installedWeaponUpgrades(character, entries, weapon).map(item => item.name)
  expect(names({ ...c, level: 6 })).toEqual(['Gluon (Commercial)'])
  expect(names({ ...c, level: 10 })).toEqual(['Gluon (Tactical)', 'Photon (Commercial)'])
  expect(names({ ...c, level: 13 })).toEqual(['Gluon (Advanced)', 'Quasar'])
  expect(names(c)).toEqual(['Gluon (Superior)', 'Quasar', 'Photon (Tactical)'])
  const graviton = { ...c, solarianAttunement: 'Graviton' as const }
  expect(names(graviton)).toEqual(['Gluon (Superior)', 'Quasar', 'Graviton (Tactical)'])
  expect(weaponAttack(graviton, entries, weapon).additionalDamage).toContainEqual(
    expect.objectContaining({ source: 'Graviton (Tactical)', value: '1d6 bludgeoning' }))
  expect(weaponAttack(graviton, entries, weapon).additionalDamage).toContainEqual(
    expect.objectContaining({ source: 'Gluon (Superior)', value: '1d10 persistent bleed' }))
  expect(names({ ...c, solarianOrbitalCrystals: ['Other'] })).toEqual(['Other', 'Gluon (Superior)', 'Quasar'])
  expect(names({ ...c, solarianOrbitalCrystals: ['Photon (Commercial)'] }))
    .toEqual(['Photon (Tactical)', 'Gluon (Superior)', 'Quasar'])
  updateSettings({ automaticSfWeaponUpgrades: false })
  expect(names(c)).toEqual([])
})

it('gives Kasatha four hands and Skyfire Wings takes one pair', async () => {
  const { totalHandCapacity } = await import('./builder')
  const c: Character = { id: 'ks', name: 'Test', systems: ['sf2e'], level: 6, ancestry: 'Kasatha',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    spells: [{ name: 'Skyfire Wings', rank: 3, cantrip: false }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(totalHandCapacity(c)).toBe(4)
  expect(totalHandCapacity({ ...c, activeSpells: ['Skyfire Wings'] })).toBe(2)
  expect(totalHandCapacity({ ...c, ancestry: 'Human', activeSpells: ['Skyfire Wings'] })).toBe(0)
})

it('shows upgrades on Phase Cutlass and Raptorial Edge', async () => {
  const { weaponEntry, usesWeaponUpgrades } = await import('./builder')
  const cutlass: ContentEntry = { id: 'pc', kind: 'weapon', source: 'official', name: 'Tactical Phase Cutlass', systems: ['sf2e'],
    level: 2, traits: ['Agile'], description: '', data: { weapon_category: 'Martial' }, effects: [], updatedAt: 0 }
  const edge: ContentEntry = { ...cutlass, id: 're', name: 'Raptorial Edge', data: { weapon_category: 'Martial', raptorial_edge: true } }
  expect(usesWeaponUpgrades(weaponEntry([cutlass], cutlass.name))).toBe(true)
  const slots = (entry: ContentEntry, name: string) => weaponEntry([{ ...entry, name }], name, entry.id)?.data.upgrade_slots
  expect(slots(cutlass, 'Phase Cutlass')).toBe(1)
  expect(slots(cutlass, 'Tactical Phase Cutlass')).toBe(2)
  expect(slots(cutlass, 'Paragon Phase Cutlass')).toBe(4)
  expect(slots(edge, 'Raptorial Edge')).toBe(1)
  expect(slots(edge, 'Paragon Raptorial Edge')).toBe(4)
})

it('scales a Plasma Guide from Plasma Caster grades', async () => {
  const { homebrewWeapons } = await import('./supplemental')
  const { weaponAttack } = await import('./builder')
  const caster = (name: string, level: number, damage: string): ContentEntry => ({ id: name, kind: 'weapon', source: 'official',
    name, systems: ['sf2e'], level, traits: ['Tech', 'Boost d6'], description: '', effects: [], updatedAt: 0,
    data: { weapon_category: 'Martial', weapon_group: 'Plasma', weapon_type: 'Ranged', damage, hands: 2, range: 60, reload: 1, upgrade_slots: 2 } })
  const casters = [caster('Plasma Caster', 0, '1d8 F'), caster('Advanced Plasma Caster', 4, '2d8 F')]
  const sniper = homebrewWeapons(casters).find(entry => entry.name === 'Plasma Guide')!
  expect(sniper).toMatchObject({ source: 'homebrew', data: { weapon_group: 'Sniper', range: 120 } })
  expect(homebrewWeapons(casters).find(entry => entry.name === 'Advanced Liminal Plasma Guide')?.description).toContain('Liminal Lock')
  expect(sniper.traits.some(trait => /^boost/i.test(trait))).toBe(false)
  expect(sniper.traits).toEqual(expect.arrayContaining(['Unwieldy', 'Volley 30 ft.']))
  const weapon = { id: sniper.id, name: sniper.name, potency: 0, striking: 0, runes: [] }
  const c = { id: 'p', systems: ['sf2e'], name: 'P', level: 4, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0, weapons: [weapon] } as unknown as Character
  expect(weaponAttack(c, [...casters, ...homebrewWeapons(casters)], weapon).entry?.name).toBe('Advanced Plasma Guide')
})

it('shows the Swarmkeeper swarm card', () => {
  const c: Character = { id: 't', name: 'T', systems: ['pf2e'], level: 8, className: 'Rogue',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Swarmkeeper Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2' },
      { name: 'Mobile Swarm', type: 'Archetype Feat', level: 6, slot: 'archetype:6' }],
    lores: [], equipment: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<MinionsContent c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('data-minion-name="Swarm"')
  expect(markup).toContain('swim 20 feet')
  expect(markup).toContain('physical')
})

it('adds Swarmkeeper feat actions to the swarm card', () => {
  const feat = (name: string, level: number) => ({ name, type: 'Archetype Feat', level, slot: `archetype:${level}:${name}` })
  const c: Character = { id: 't', name: 'T', systems: ['pf2e'], level: 12, className: 'Rogue',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [feat('Swarmkeeper Dedication', 2), feat('Aphet Flash', 4), feat('Pyre Ant Sting', 4), feat('Sportlebore Choke', 8),
      feat('Buzzing Death Cicadas', 12), feat("Weaver's Web", 4), feat('Distracting Bites', 6)],
    lores: [], equipment: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<MinionsContent c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('<b>Aphet Flash</b>')
  expect(markup).toContain('Persistent poison: 3d6 persistent poison')
  expect(markup).toContain('Damage: 6d4 piercing')
  expect(markup).toContain('Damage: 6d4 mental')
  expect(markup).toContain("Weaver&#x27;s Web, Distracting Bites")
})

it('applies Magic Hide and Protect Companion to the Swarmkeeper swarm', () => {
  const c: Character = { id: 't', name: 'T', systems: ['pf2e'], level: 8, className: 'Rogue',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Swarmkeeper Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2' }],
    spells: [{ name: 'Magic Hide', rank: 0, cantrip: true }, { name: 'Protect Companion', rank: 0, cantrip: true }],
    lores: [], equipment: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const ac = (character: Character) => /Armor Class<\/small><b>(\d+)/.exec(renderToStaticMarkup(<MinionsContent c={character} entries={[]} save={() => {}} />))?.[1]
  const base = Number(ac(c))
  expect(Number(ac({ ...c, activeSpells: ['Magic Hide'] }))).toBe(base + 1)
  expect(Number(ac({ ...c, activeSpells: ['Protect Companion'] }))).toBe(base + 1)
  expect(Number(ac({ ...c, spells: [], activeSpells: ['Magic Hide'] }))).toBe(base)
})
