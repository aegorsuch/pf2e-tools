import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { CharacterBuilder as Builder, EquipmentSearch } from './CharacterBuilder'
import { Children, isValidElement, type ReactNode } from 'react'
import { mapAonHit } from './aon'
import { fetchAonHits } from './aonQuery'
import { getSettings, updateSettings } from './settings'
import type { Character, ContentEntry } from './types'
import { equipmentGroupName, WORN_EQUIPMENT_GROUPS } from './equipmentGroups'

const content = vi.hoisted(() => ({ entries: [] as ContentEntry[] }))
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => content.entries }))
vi.mock('./DeferredDetails', () => ({ DeferredDetails: ({ children }: { children: ReactNode }) =>
  <details className="character-section">{children}</details> }))
const CharacterBuilder = (props: Omit<Parameters<typeof Builder>[0], 'catalog'>) =>
  <Builder {...props} catalog={content.entries} />

it('shows Test-Subject adaptation options only for the matching heritage', () => {
  content.entries = []
  const c: Character = { id: 'ysoki', systems: ['sf2e'], name: 'Test', level: 1, ancestry: 'Ysoki',
    heritage: 'Test-Subject Ysoki', testSubjectAdaptation: 'Extra Limbs',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('aria-label="Test-Subject adaptation"')
  expect(markup).toContain('<option selected="">Extra Limbs</option>')
  expect(renderToStaticMarkup(<CharacterBuilder character={{ ...c, heritage: undefined }} onClose={() => {}} />))
    .not.toContain('aria-label="Test-Subject adaptation"')
})

it('shows cosmic and biotech traits from Cyborg upgrades instead of tech', () => {
  content.entries = []
  const c: Character = { id: 'cyborg', systems: ['sf2e'], name: 'Test', level: 13, ancestry: 'Ysoki',
    heritage: 'Test-Subject Ysoki', testSubjectAdaptation: 'Cybernetic Augmentation',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Eva Module', type: 'Ancestry Feat', level: 1 },
      { name: 'Biotech Os Upgrade', type: 'Ancestry Feat', level: 9 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('>Biotech trait</a>')
  expect(markup).toContain('>Cosmic trait</a>')
  expect(markup).not.toContain('>Tech trait</a>')
  const original = renderToStaticMarkup(<CharacterBuilder character={{ ...c, feats: [] }} onClose={() => {}} />)
  expect(original).toContain('>Tech trait</a>')
  expect(original).not.toContain('>Biotech trait</a>')
})

it('shows Cyborg traits and its integrated comm unit without the optional house rule', () => {
  const previous = getSettings().cyborgTestSubject
  const c: Character = { id: 'cyborg', systems: ['sf2e'], name: 'Test', level: 1, ancestry: 'Human', heritage: 'Cyborg',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    content.entries = []
    updateSettings({ cyborgTestSubject: false })
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('>Cyborg trait</a>')
    expect(markup).toContain('>Tech trait</a>')
    expect(markup).toContain('Comm Unit')
    expect(markup).toContain('Cyborg; integrated, thought-operated')
    expect(markup).toContain('aria-label="Augmentation capacity">0/8</small>')
    expect(renderToStaticMarkup(<CharacterBuilder character={{ ...c, heritage: undefined }} onClose={() => {}} />))
      .not.toContain('Cyborg; integrated, thought-operated')
  } finally { updateSettings({ cyborgTestSubject: previous }); content.entries = [] }
})

it("keeps Officer's Medical Training grant text out of the Skill Feats summary", () => {
  content.entries = []
  const c: Character = { id: 'officer', systems: ['pf2e'], name: 'Test', level: 1, className: 'Commander',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: "Officer's Medical Training", type: 'Class Feat', level: 1, slot: 'class:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toMatch(/<strong>Skill Feats<\/strong><span>\d+\/\d+<\/span>/)
  expect(markup).not.toContain('Battle Medicine granted')
})

it('shows persisted subclass choices and Starfinder subclass pickers', () => {
  const c: Character = { id: 'choices', systems: ['pf2e'], name: 'Test', level: 1, className: 'Investigator', subclass: 'Empiricism',
    subclassSkillChoices: { 'Investigator:Empiricism': 'Lore', 'Investigator:Empiricism:lore': 'Sailing Lore' },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  content.entries = []
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('aria-label="Methodology skill"')
  expect(markup).toContain('aria-label="Methodology skill specialty"')
  expect(markup).toContain('value="Sailing"')
  const sf = renderToStaticMarkup(<CharacterBuilder character={{ ...c, systems: ['sf2e'], className: 'Envoy', subclass: 'Guns Blazing' }} onClose={() => {}} />)
  expect(sf).toContain('aria-label="Leadership style"')
  expect(sf).toContain('Guns Blazing')
})

it('shows Free Heart background selection in Background only while the feat is active', () => {
  const background: ContentEntry = { id: 'performer', kind: 'background', name: 'Performer', systems: ['pf2e'],
    source: 'official', level: 0, traits: [], description: 'Traveling performer.', data: { skill: 'Performance', feat: 'Fascinating Performance' }, effects: [], updatedAt: 0 }
  content.entries = [background]
  const c: Character = { id: 'free-heart', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Elf',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Free Heart', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'Performer' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    const section = markup.slice(markup.indexOf('<strong>Background</strong>'), markup.indexOf('<strong>Class</strong>'))
    expect(section).toContain('aria-label="Free Heart background"')
    expect(section).toContain('Performer')
    expect(section).toContain('not its attribute boosts')
    expect(renderToStaticMarkup(<CharacterBuilder character={{ ...c, level: 0 }} onClose={() => {}} />))
      .not.toContain('aria-label="Free Heart background"')
  } finally { content.entries = [] }
})

it('labels Rogue subclass as Racket without duplicating an additional Mastermind skill selector', () => {
  const racket: ContentEntry = { id: 'thief', systems: ['pf2e'], kind: 'subclass', source: 'official', name: 'Thief',
    level: 1, traits: [], description: '', data: { class: 'Rogue' }, effects: [], updatedAt: 0 }
  content.entries = [racket]
  const c: Character = { id: 'mastermind', systems: ['pf2e'], name: 'Test', level: 10, className: 'Rogue', subclass: 'Thief',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Mastermind' }],
    rogueRacketSkills: { Mastermind: 'Religion' }, equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('aria-label="Racket"')
    expect(markup).not.toContain('aria-label="Subclass"')
    expect(markup).not.toContain('aria-label="Mastermind racket skill"')
  } finally { content.entries = [] }
})

it('shows armor proficiency badges in Equipment directly above Armor', () => {
  content.entries = []
  const c: Character = {
    id: 'armor-proficiency', systems: ['pf2e'], name: 'Test', level: 1, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  const equipmentStart = markup.indexOf('<strong>Equipment</strong>')
  const armorHeading = markup.indexOf('<h4>Armor</h4>', equipmentStart)
  const proficiency = markup.indexOf('<div class="prof-badges">', equipmentStart)
  const defenseStart = markup.indexOf('<strong>Defense</strong>')
  const deityStart = markup.indexOf('<strong>Deity</strong>')
  expect(proficiency).toBeGreaterThan(equipmentStart)
  expect(proficiency).toBeLessThan(armorHeading)
  expect(markup.slice(defenseStart, deityStart)).not.toContain('class="prof-badges"')
})

it('renders characters with many unrelated feats without blocking editor startup', () => {
  content.entries = []
  const c: Character = {
    id: 'many-feats', systems: ['pf2e'], name: 'Test', level: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: Array.from({ length: 14 }, (_, index) => ({
      name: `Unrelated Feat ${index}`, type: 'General Feat', level: 1,
    })),
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }

  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('<strong>Languages</strong>')
  expect(markup).toContain('1/2: Common')
})

it('shows the paired Bracelet of Empathy while a companion wears its collar', () => {
  const collar: ContentEntry = {
    id: 'empathy-collar', name: 'Collar of Empathy', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 9, traits: ['Companion'], description: '', data: { item_subcategory: 'Companion Items' }, effects: [], updatedAt: 0,
  }
  const worn = (name: string): ContentEntry => ({ ...collar, id: name, name, traits: [], data: { item_category: 'Worn Items' } })
  content.entries = [collar, worn('Azure Boots'), worn('Zephyr Cloak')]
  const c: Character = {
    id: 'empathy', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: 'Zephyr Cloak', qty: 1 }, { name: 'Azure Boots', qty: 1 }], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    companions: [{ id: 'cat', type: 'Cat', name: 'Buddy', equipment: {
      Collar: { entryId: collar.id, name: collar.name, qty: 1 },
    } }],
  }
  try {
    const equipment = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
      .split('<strong>Equipment</strong>')[1].split('<strong>Formulas</strong>')[0]
    expect(equipment).toContain('Bracelet of Empathy')
    expect(equipment.indexOf('Azure Boots')).toBeLessThan(equipment.indexOf('Bracelet of Empathy'))
    expect(equipment.indexOf('Bracelet of Empathy')).toBeLessThan(equipment.indexOf('Zephyr Cloak'))
    expect(equipment).not.toContain('paired with')
    expect(equipment).not.toContain('Paired companion equipment')
    const withoutCollar = { ...c, companions: [{ ...c.companions![0], equipment: undefined }] }
    expect(renderToStaticMarkup(<CharacterBuilder character={withoutCollar} onClose={() => {}} />))
      .not.toContain('Bracelet of Empathy')
  } finally { content.entries = [] }
})

it('imports druidic orders as subclass descriptions without adding a second primary picker', () => {
  const order = mapAonHit({ _id: 'druidic-order-8', _source: { category: 'druidic-order', name: 'Animal',
    markdown: 'Animal order description.' } }, 'pf2e')
  expect(order).toMatchObject({ kind: 'subclass', name: 'Animal', data: { class: 'Druid' }, description: 'Animal order description.' })
  content.entries = [order!]
  const c: Character = { id: 'druid', systems: ['pf2e'], name: 'Test', level: 1, className: 'Druid', order: 'Animal',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('aria-label="Druidic Order"')
    expect(markup).not.toContain('aria-label="Subclass"')
  } finally { content.entries = [] }
})

it('preserves an incompatible saved heritage as disabled rather than selectable or silently erased', () => {
  content.entries = [
    { id: 'human', kind: 'ancestry', name: 'Human' },
    { id: 'dwarf', kind: 'ancestry', name: 'Dwarf' },
    { id: 'underground', kind: 'heritage', name: 'Underground Dwarf' },
  ].map(entry => ({ ...entry, kind: entry.kind as ContentEntry['kind'], systems: ['pf2e'], source: 'official',
    level: 0, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }))
  const c: Character = {
    id: 'heritage-test', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Human', heritage: 'Underground Dwarf',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('Armor Class 10: show breakdown')
    expect(markup).toContain('value="Underground Dwarf" disabled="" selected="">Underground Dwarf (not available for this ancestry)</option>')
    expect(c.heritage).toBe('Underground Dwarf')
  } finally { content.entries = [] }
})

it('restores Pioneer protection and terrain choices and hides them for other heritages', () => {
  const c: Character = {
    id: 'pioneer', systems: ['sf2e'], name: 'Test', level: 1, ancestry: 'Human', heritage: 'Pioneer Human',
    pioneerEnvironment: 'Cold', pioneerTerrain: 'Forest',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={JSON.parse(JSON.stringify(c))} onClose={() => {}} />)
  expect(markup).toContain('aria-label="Pioneer Human environmental protection"')
  expect(markup).toContain('<option selected="">Cold</option>')
  expect(markup).toContain('<option selected="">Forest</option>')
  expect(markup).toContain('Terrain Expertise (Forest) <small>(Pioneer Human)</small></button>')
  const other = renderToStaticMarkup(<CharacterBuilder character={{ ...c, heritage: 'Versatile Human' }} onClose={() => {}} />)
  expect(other).not.toContain('aria-label="Pioneer Human')
  expect(other).not.toContain('Terrain Expertise <small>(Pioneer Human)')
})

it('shows ancestry-specific Lore in Skills and feat-adjusted Bulk limits inside Gear', () => {
  content.entries = ['Ancestral Skills', 'Hardy Traveler'].map(name => ({
    id: name, systems: ['sf2e'], name, kind: 'feat', source: 'official', traits: ['Human'], data: {},
    level: name === 'Hardy Traveler' ? 9 : 1,
    description: name === 'Hardy Traveler' ? 'Increase your maximum and encumbered Bulk limits by 1.' : '',
    effects: [], updatedAt: 1,
  }))
  const c: Character = {
    id: 'human', systems: ['sf2e'], name: 'Test', level: 9, ancestry: 'Human',
    abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: content.entries.map(feat => ({ name: feat.name, type: 'Ancestry Feat', level: feat.level, slot: `ancestry:${feat.level}:0` })),
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    for (const label of ['ancestry', 'heritage', 'background', 'class', 'deity'])
      expect(markup).not.toContain(`aria-label="Search ${label}"`)
    expect(markup).toContain('Human Lore')
    const gear = markup.slice(markup.indexOf('<strong>Equipment</strong>'), markup.indexOf('<strong>Formulas</strong>'))
    expect(gear).toContain('aria-label="Bulk limits"')
    expect(gear).toContain('Encumbered above <b>8</b> Bulk; maximum <b>13</b> Bulk.')
  } finally { content.entries = [] }
})

it('keeps equipment editing separate from offensive attack summaries', () => {
  const c: Character = {
    id: 'equipment', systems: ['pf2e'], name: 'Test', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: 'Arrows', qty: 10 }, { name: 'Bolts', qty: 10 }, { name: 'Bullets', qty: 10 }],
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  const equipment = markup.slice(markup.indexOf('<strong>Equipment</strong>'), markup.indexOf('<strong>Formulas</strong>'))
  const offense = markup.slice(markup.indexOf('<strong>Offense</strong>'), markup.indexOf('<strong>Skill Feats</strong>'))
  expect(equipment).toContain('Add Weapon')
  expect(equipment).toContain('Add Armor')
  for (const name of ['Arrows', 'Bolts', 'Bullets']) expect(equipment).toContain(`<h4>${name}</h4>`)
  expect(offense).toContain('1 Weapon')
  expect(offense).toContain('Fist')
  expect(offense).not.toContain('Add Weapon')
})

it('shows synced inventory counts and shared hand usage in Equipment and Offense headers', () => {
  content.entries = [{ id: 'sword', systems: ['pf2e'], kind: 'weapon', source: 'official', name: 'Sword',
    level: 0, traits: [], description: '', data: { hands: 1, weapon_category: 'Martial', damage: '1d8 slashing' }, effects: [], updatedAt: 0 }]
  const c: Character = {
    id: 'headers', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: 'Rope', qty: 1 }], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    weapons: [{ id: 'sword', name: 'Sword', potency: 0, striking: 0, runes: [] }],
    shield: { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, raised: false, damage: 0 },
  }
  try {
    const render = (character: Character) => renderToStaticMarkup(<CharacterBuilder character={character} onClose={() => {}} />)
    const markup = render(c)
    expect(markup).toContain('<strong>Equipment</strong><span>1 Items, 2/2 Hands</span>')
    expect(markup).toContain('<strong>Offense</strong><span>3 Weapons, 2/2 Hands</span>')
    const unequipped = render({ ...c, shield: { ...c.shield!, equipped: false } })
    expect(unequipped).toContain('<strong>Equipment</strong><span>1 Items, 1/2 Hands</span>')
    expect(unequipped).toContain('<strong>Offense</strong><span>3 Weapons, 1/2 Hands</span>')
    const defense = markup.slice(markup.indexOf('<strong>Defense</strong>'), markup.indexOf('<strong>Deity</strong>'))
    expect(defense).toContain('aria-label="Equipped Steel Shield" checked=""')
  } finally { content.entries = [] }
})

it.each([
  { className: 'Barbarian', dedicationLevel: undefined, visible: true },
  { className: 'Ranger', dedicationLevel: 2, visible: true },
  { className: 'Ranger', dedicationLevel: undefined, visible: false },
  { className: 'Ranger', dedicationLevel: 6, visible: false },
])('puts eligible Rage control in Offense header: $className, dedication $dedicationLevel', ({ className, dedicationLevel, visible }) => {
  content.entries = []
  const c: Character = { id: 'rage-header', systems: ['pf2e'], name: 'Test', level: 4, className, raging: true,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: dedicationLevel === undefined ? [] : [{ name: 'Barbarian Dedication', type: 'Archetype Feat', level: dedicationLevel }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  const offense = markup.slice(markup.indexOf('<strong>Offense</strong>'), markup.indexOf('<strong>Skill Feats</strong>'))
  const header = offense.slice(0, offense.indexOf('</summary>'))
  expect(header.includes('aria-label="Rage active" checked=""')).toBe(visible)
  expect(offense.slice(offense.indexOf('</summary>'))).not.toContain('aria-label="Rage active"')
})

it('orders equipment groups alphabetically and separates grafts and tattoos from other equipment', () => {
  const item = (name: string, category: string): ContentEntry => ({ id: name, name, kind: 'item',
    systems: ['pf2e'], source: 'official', level: 1, traits: [], description: '', data: { item_category: category }, effects: [], updatedAt: 0 })
  content.entries = [item('Caligni Eyes', 'Grafts'), item('Spider Lily', 'Tattoos'), item('Rope', 'Adventuring Gear'),
    { ...item('Black Adder Venom', 'Alchemical Items'), traits: ['Poison', 'Injury'] }]
  const c: Character = { id: 'equipment-order', systems: ['pf2e', 'sf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: ['Poison Weapon', 'Cheek Pouches', 'Gadget Specialist', 'Grenade Specialist', 'Munitions Crafter']
      .map(name => ({ name, type: 'Class Feat', level: 1 })),
    equipment: ['Spider Lily', 'Rope', 'Caligni Eyes', 'Arrows', 'Bolts', 'Bullets', 'Black Adder Venom'].map(name => ({ name, qty: 1 })),
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    const equipment = markup.slice(markup.indexOf('<strong>Equipment</strong>'), markup.indexOf('<strong>Formulas</strong>'))
    const headers = [...equipment.matchAll(/<h4>([^<]+)(?:<small\b[^>]*>[^<]*<\/small>)?<\/h4>/g)].map(match => match[1].trim())
    expect(headers).toEqual(['Armor', 'Arms', 'Arrows', 'Augmentations', 'Backpacks', 'Belt', 'Body', 'Bolts', 'Boots', 'Bracelets', 'Bullets',
      'Chest', 'Cloaks', 'Clothing', 'Eyes', 'Eyewear', 'Face', 'Feet', 'Gadgets', 'Gloves', 'Grafts', 'Grenade Specialist', 'Hands', 'Handwraps', 'Head', 'Headband', 'Headwear',
      'Mask', 'Munitions', 'Neck', 'Necklaces', 'Other equipment', 'Other Worn Items', 'Poisons', 'Rings', 'Shield', 'Shoulders', 'Tattoos', 'Throat', 'Torso', 'Weapons', 'Wrists'])
    expect(equipment.indexOf('<h4>Cheek Pouches')).toBeGreaterThan(equipment.indexOf('<h4>Bullets</h4>'))
    expect(equipment.indexOf('<h4>Cheek Pouches')).toBeLessThan(equipment.indexOf('<h4>Gadgets</h4>'))
    expect(equipment.slice(equipment.indexOf('<h4>Grafts</h4>'), equipment.indexOf('<h4>Handwraps</h4>'))).toContain('Caligni Eyes')
    expect(equipment.slice(equipment.indexOf('<h4>Tattoos</h4>'), equipment.indexOf('<h4>Weapons</h4>'))).toContain('Spider Lily')
    const poisons = equipment.slice(equipment.indexOf('<h4>Poisons</h4>'), equipment.indexOf('<h4>Shield</h4>'))
    expect(poisons).toContain('Black Adder Venom')
    expect(poisons).toContain('Simple injury poisons')
    expect(poisons.indexOf('Black Adder Venom')).toBeLessThan(poisons.indexOf('Simple injury poisons'))
    expect(poisons).toContain('1d4')
    const withoutFeat = renderToStaticMarkup(<CharacterBuilder character={{ ...c, feats: [] }} onClose={() => {}} />)
    const poisonItems = withoutFeat.slice(withoutFeat.indexOf('<h4>Poisons</h4>'), withoutFeat.indexOf('<h4>Shield</h4>'))
    expect(poisonItems).toContain('Black Adder Venom')
    expect(poisonItems).not.toContain('Simple injury poisons')
    expect(equipment).toContain('Add Armor')
    expect(equipment).toContain('Add Shield')
    expect(equipment).toContain('Add Weapon')
  } finally { content.entries = [] }
})

it('keeps empty Equipment categories available with accessible plus controls and lazy searches', () => {
  content.entries = []
  const c: Character = { id: 'empty-equipment', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  for (const category of ['Tattoos', 'Grafts', ...WORN_EQUIPMENT_GROUPS]) {
    expect(markup).toContain(`aria-label="Add ${category}" title="Add ${category}" aria-expanded="false"`)
    expect(markup).not.toContain(`aria-label="Search ${category.toLowerCase()}"`)
  }
  expect(markup).toContain('<h4>Tattoos</h4>')
  expect(markup).toContain('<h4>Grafts</h4>')
  expect(markup).not.toContain('do not impose body-slot limits')
  expect(markup).not.toContain('<h4>Worn Items</h4>')
  expect(c.equipment).toEqual([])
})

it('shows existing equipment stacks without quantity controls', () => {
  content.entries = []
  const c: Character = { id: 'equipment-counts', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: 'Rope', qty: 1 }, { name: 'Arrows', qty: 20 }],
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const before = JSON.stringify(c)
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  const equipment = markup.split('<strong>Equipment</strong>')[1].split('<strong>Formulas</strong>')[0]
  expect(equipment).not.toContain('type="number"')
  expect(equipment).toContain('x20')
  expect(equipment).not.toContain('x1')
  expect(JSON.stringify(c)).toBe(before)
})

it('opens item details from saved equipment names without changing the stack', () => {
  const item: ContentEntry = { id: 'rope', name: 'Rope', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 0, traits: [], description: 'A strong length of braided rope.', data: { url: 'https://2e.aonprd.com/Equipment.aspx?ID=61' },
    effects: [], updatedAt: 0 }
  content.entries = [item]
  const c: Character = { id: 'equipment-details', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: 'Rope', qty: 2 }], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const before = JSON.stringify(c)
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
      .split('<strong>Equipment</strong>')[1].split('<strong>Formulas</strong>')[0]
    expect(markup).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*>Rope<\/button>/)
    expect(markup).toContain(item.description)
    expect(markup).toContain(String(item.data.url))
    expect(markup).toContain('x2')
    expect(JSON.stringify(c)).toBe(before)
  } finally { content.entries = [] }
})

it('lists every tattoo beyond the previous forty-result cutoff', () => {
  const entries = Array.from({ length: 60 }, (_, index): ContentEntry => ({
    id: `tattoo-${index}`, name: `Tattoo ${String(index).padStart(2, '0')}`, kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: ['Tattoo'], description: `Rules for tattoo ${index}.`, data: { item_category: 'Tattoos' }, effects: [], updatedAt: 0,
  }))
  const c: Character = { id: 'all-tattoos', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<EquipmentSearch c={c} entries={entries} save={() => {}} category="Tattoos" />)
  expect([...markup.matchAll(/aria-label="Add Tattoo \d+"/g)]).toHaveLength(60)
  expect(markup).toContain('aria-label="Add Tattoo 59"')
  expect(markup).toContain('Rules for tattoo 59.')
  expect(markup).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*>Tattoo 59<\/button>/)
})

it.each([false, true])('closes equipment search after adding an item (existing stack: %s)', existing => {
  const item: ContentEntry = { id: 'boots', name: 'Azure Boots', systems: ['pf2e'], kind: 'item', source: 'official',
    level: 1, traits: [], description: '', data: { item_category: 'Worn Items' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'equipment-add', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: existing ? [{ name: item.name, qty: 1, group: 'Feet' }] : [],
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = vi.fn()
  const close = vi.fn()
  function InspectSearch() {
    const tree = EquipmentSearch({ c, entries: [item], save, category: 'Feet', onClose: close })
    const clickAdd = (node: ReactNode): void => {
      Children.forEach(node, child => {
        if (!isValidElement<{ children?: ReactNode; 'aria-label'?: string; onClick?: () => void }>(child)) return
        if (child.props['aria-label'] === 'Add Azure Boots') child.props.onClick!()
        else clickAdd(child.props.children)
      })
    }
    clickAdd(tree)
    return tree
  }
  renderToStaticMarkup(<InspectSearch />)
  expect(save).toHaveBeenCalledWith({ equipment: [{ name: item.name, qty: existing ? 2 : 1, group: 'Feet' }] })
  expect(close).toHaveBeenCalledOnce()
  expect(save.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0])
})

it.each([
  ['Boots of Rings', 'worn gloves', 'Gloves'],
  ['Handwraps of Mighty Blows (+1)', 'worn gloves', 'Handwraps'],
  ['Hardlight Handwraps (Tactical)', 'worn gloves', 'Handwraps'],
  ['Dragon Handwraps', 'worn gloves', 'Handwraps'],
  ['Martial Bands', 'worn handwraps', 'Handwraps'],
  ['Shoes of Speed', 'worn shoes', 'Boots'],
  ['War Bracers', 'worn bracers', 'Bracelets'],
  ['Amulet', 'worn amulet', 'Necklaces'],
  ['Hat', 'worn headwear', 'Headwear'],
  ['Goggles', 'worn eyepiece', 'Eyewear'],
  ['Belt', 'worn belt', 'Belt'],
  ['Robe', 'worn robe', 'Clothing'],
  ['Pack', 'worn backpack', 'Backpacks'],
  ['Azure Boots', '', 'Boots'],
  ['Cloak', 'worn cloak', 'Cloaks'],
  ['Vestment', 'worn vestment', 'Torso'],
  ['Headband of Fortune', 'worn headwear', 'Headband'],
  ['Mask of Eyes', 'worn headwear', 'Mask'],
  ['Goggles', 'worn face', 'Eyewear'],
  ['Scarab', 'worn', 'Throat'],
  ['Phylactery', 'worn', 'Headwear'],
  ['Mystery Charm', 'worn', 'Other Worn Items'],
])('uses worn placement to group %s without interpreting its name as a slot restriction', (name, usage, group) => {
  const entry: ContentEntry = { id: name, name, kind: 'item', systems: ['pf2e'], source: 'homebrew', level: 1,
    traits: [], description: '', data: { item_category: 'Worn Items', usage }, effects: [], updatedAt: 0 }
  expect(equipmentGroupName(entry)).toBe(group)
})

it.each([undefined, 'Gloves', 'Hands'] as const)('separates handwrap inventory and searches from gloves, including saved %s placements', group => {
  const names = ['Handwraps of Mighty Blows (+1)', 'Hardlight Handwraps (Tactical)', 'Dragon Handwraps']
  const entries: ContentEntry[] = [...names, 'Gloves of Storing'].map(name => ({
    id: name, name, kind: 'item', systems: ['pf2e'], source: 'official', level: 1,
    traits: [], description: '', data: { usage: 'worn gloves' }, effects: [], updatedAt: 0,
  }))
  const c: Character = { id: 'handwrap-placement', systems: ['pf2e'], name: 'Test', level: 5, className: 'Fighter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [...names.map(name => ({ name, qty: 1, group })), { name: 'Gloves of Storing', qty: 1 }],
    handwraps: { potency: 1, striking: 1, runes: ['Flaming'] },
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const saved = JSON.stringify(c)
  content.entries = entries
  try {
    const equipment = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
      .split('<strong>Equipment</strong>')[1].split('<strong>Formulas</strong>')[0]
    const gloves = equipment.split('<h4>Gloves</h4>')[1].split('<h4>Hands</h4>')[0]
    const handwraps = equipment.split('<h4>Handwraps</h4>')[1].split('<h4>Head</h4>')[0]
    expect(equipment.match(/<h4>Handwraps<\/h4>/g)).toHaveLength(1)
    expect(gloves).toContain('Gloves of Storing')
    expect(gloves).not.toContain('Handwraps')
    expect(handwraps).toContain('Fundamental runes')
    expect(handwraps).toContain('Flaming')
    const glovesSearch = renderToStaticMarkup(<EquipmentSearch c={c} entries={entries} save={() => {}} category="Gloves" />)
    const handwrapsSearch = renderToStaticMarkup(<EquipmentSearch c={c} entries={entries} save={() => {}} category="Handwraps" />)
    expect(glovesSearch).toContain('Add Gloves of Storing')
    expect(glovesSearch).not.toContain('Handwraps')
    expect(handwrapsSearch).not.toContain('Gloves of Storing')
    for (const name of names) {
      expect(handwraps).toContain(name)
      expect(handwrapsSearch).toContain(`Add ${name}`)
    }
    expect(JSON.stringify(c)).toBe(saved)
  } finally { content.entries = [] }
})

it('places the personalized Warmask only in Mask, with its bonus inside its details', () => {
  const warmask: ContentEntry = { id: 'warmask', name: 'Orc Warmask', kind: 'feat', systems: ['pf2e'], source: 'official',
    level: 1, traits: ['Orc'], description: 'Full warmask rules.', data: {}, effects: [], updatedAt: 0 }
  content.entries = [warmask]
  const c: Character = { id: 'mask-category', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Orc Warmask', type: 'Ancestry Feat', level: 1, choice: 'The Land' },
      { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    const equipment = markup.split('<strong>Equipment</strong>')[1].split('<strong>Formulas</strong>')[0]
    expect(equipment.split('<h4>Armor</h4>')[1].split('<h4>Arms</h4>')[0]).not.toContain('Warmask')
    const mask = equipment.split('<h4>Mask</h4>')[1].split('<h4>Neck</h4>')[0]
    expect(mask).toContain('aria-haspopup="dialog">Warmask</button>')
    expect(mask).toContain('Power source: The Land (Primal). +1 item bonus to Nature checks.')
    expect(mask).toContain(warmask.description)
    expect(mask.replace(/<dialog\b[\s\S]*?<\/dialog>/g, '')).not.toContain('+1 item bonus')
    expect(markup).not.toContain('aria-label="Ring capacity"')
    expect(markup).toContain('aria-label="Rings used">0/10</span>')
  } finally { content.entries = [] }
})

it('keeps existing equipment categories while retaining an explicitly chosen new slot', () => {
  const boots: ContentEntry = { id: 'boots', name: 'Azure Boots', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: 'Boot rules.', data: { usage: 'worn boots' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'equipment-placement', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: boots.name, qty: 1 }, { name: boots.name, qty: 1, group: 'Feet' }],
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  content.entries = [boots]
  try {
    const equipment = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
      .split('<strong>Equipment</strong>')[1].split('<strong>Formulas</strong>')[0]
    expect(equipment.split('<h4>Boots</h4>')[1].split('<h4>Bracelets</h4>')[0]).toContain('Azure Boots')
    expect(equipment.split('<h4>Feet</h4>')[1].split('<h4>Gloves</h4>')[0]).toContain('Azure Boots')
  } finally { content.entries = [] }
})

it.each([undefined, 'Belt', 'Belts', 'Waist'] as const)('merges automatic and saved %s belt placements into Belt without duplicating stacks', group => {
  const belt: ContentEntry = { id: 'silk-belt', name: 'Silk Belt', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: 'Belt rules.', data: { usage: 'worn belt' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'belt-placement', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: belt.name, qty: 1, group }], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = vi.fn()
  function InspectSearch() {
    const tree = EquipmentSearch({ c, entries: [belt], save, category: 'Belt' })
    const clickAdd = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<{ children?: ReactNode; 'aria-label'?: string; onClick?: () => void }>(child)) return
      if (child.props['aria-label'] === 'Add Silk Belt') child.props.onClick!()
      else clickAdd(child.props.children)
    })
    clickAdd(tree)
    return tree
  }
  content.entries = [belt]
  try {
    const equipment = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
      .split('<strong>Equipment</strong>')[1].split('<strong>Formulas</strong>')[0]
    expect(equipment.match(/<h4>Belt<\/h4>/g)).toHaveLength(1)
    expect(equipment).not.toContain('<h4>Belts</h4>')
    expect(equipment).not.toContain('<h4>Waist</h4>')
    expect(equipment.split('<h4>Belt</h4>')[1].split('<h4>Body</h4>')[0]).toContain('Silk Belt')
    renderToStaticMarkup(<InspectSearch />)
    expect(save).toHaveBeenCalledWith({ equipment: [{ ...c.equipment[0], qty: 2 }] })
  } finally { content.entries = [] }
})

it('keeps stance-granted Parry checked and non-toggleable without changing saved manual Parry', () => {
  const previous = getSettings()
  updateSettings({ unarmedCountsAsWeapons: true })
  const stance: ContentEntry = { id: 'defense', name: 'Twinned Defense (Fighter)', kind: 'feat',
    systems: ['pf2e'], source: 'official', level: 16, traits: ['Fighter', 'Stance'], description: '', data: {}, effects: [], updatedAt: 0 }
  content.entries = [stance]
  const c: Character = { id: 'stance-parry', systems: ['pf2e'], name: 'Test', level: 16, className: 'Fighter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, parrying: false, activeStance: stance.name,
    feats: [{ name: 'Twin Parry', type: 'Class Feat', level: 4 }, { name: stance.name, type: 'Class Feat', level: 16 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const input = (character: Character) => renderToStaticMarkup(<CharacterBuilder character={character} onClose={() => {}} />)
      .match(/<input[^>]*aria-label="Parry active \(summary\)"[^>]*>/)?.[0]
    expect(input(c)).toContain('checked=""')
    expect(input(c)).toContain('disabled=""')
    expect(input({ ...c, activeStance: undefined })).not.toContain('checked')
    expect(input({ ...c, activeStance: undefined })).not.toContain('disabled')
    expect(c.parrying).toBe(false)
  } finally { updateSettings(previous); content.entries = [] }
})

it.each([9, 10])('allows a tenth ring but blocks additions beyond finger capacity with %i rings', qty => {
  const ring: ContentEntry = { id: 'ring', name: 'Silver Ring', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: 'Ring rules.', data: { usage: 'worn', item_category: 'Worn Items' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'ring-limit', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: ring.name, qty }], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const render = (character: Character) => renderToStaticMarkup(<EquipmentSearch c={character} entries={[ring]} save={() => {}} category="Rings" />)
  const button = render(c).match(/<button[^>]*aria-label="Add Silver Ring"[^>]*>/)?.[0]
  expect(button).toBeDefined()
  expect(button!.includes('disabled=""')).toBe(qty === 10)
  expect(render({ ...c, feats: [{ name: 'Additional Arms', type: 'Ancestry Feat', level: 1 }] })
    .match(/<button[^>]*aria-label="Add Silver Ring"[^>]*>/)?.[0]).not.toContain('disabled')
})

it('formats graded equipment titles and sorts by base name while retaining canonical saved names', () => {
  const greater: ContentEntry = { id: 'greater-belt', name: 'Greater Killer\u2019s Belt', kind: 'item',
    systems: ['pf2e'], source: 'official', level: 9, traits: [], description: 'Greater belt rules.',
    data: { usage: 'worn belt' }, effects: [], updatedAt: 1 }
  const ordinary = { ...greater, id: 'belt', name: "Killer's Belt", level: 4 }
  const url = 'https://2e.aonprd.com/Equipment.aspx?ID=3968'
  ordinary.data = { ...ordinary.data, url }
  ordinary.description = 'Base parent rules.'
  const priced = { ...ordinary, id: 'belt-type', name: 'Killer\u2019s Belt', description: 'Base priced rules.',
    data: { ...ordinary.data, price: 9500 } }
  const amber = { ...greater, id: 'amber', name: 'Amber Belt', level: 1 }
  const c: Character = { id: 'belt-names', systems: ['pf2e'], name: 'Test', level: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: greater.name, qty: 1 }], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  content.entries = [greater, ordinary, amber, priced]
  try {
    const search = renderToStaticMarkup(<EquipmentSearch c={c} entries={content.entries} save={() => {}} category="Belt" />)
    expect(search).toContain('aria-label="Add Killer&#x27;s Belt (Greater)"')
    expect(search.match(/aria-label="Add Killer&#x27;s Belt"/g)).toHaveLength(1)
    expect(search).toContain('Base priced rules.')
    expect(search).not.toContain('Base parent rules.')
    const ownedBase = renderToStaticMarkup(<EquipmentSearch c={{ ...c, equipment: [{ name: ordinary.name, qty: 1 }] }}
      entries={content.entries} save={() => {}} category="Belt" />)
    expect(ownedBase).toContain('Base parent rules.')
    expect(ownedBase).not.toContain('Base priced rules.')
    expect(search.indexOf('>Amber Belt</button>')).toBeLessThan(search.indexOf('>Killer&#x27;s Belt</button>'))
    expect(search.indexOf('>Killer&#x27;s Belt</button>')).toBeLessThan(search.indexOf('>Killer&#x27;s Belt (Greater)</button>'))
    expect(renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />))
      .toContain('aria-haspopup="dialog">Killer&#x27;s Belt (Greater)</button>')
    expect(c.equipment[0].name).toBe(greater.name)
  } finally { content.entries = [] }
})

it('keeps large background and deity catalogs searchable before lazy choices are populated', () => {
  content.entries = (['background', 'deity'] as const).flatMap(kind => Array.from({ length: 11 }, (_, index): ContentEntry => ({
    id: `${kind}-${index}`, name: `${kind} ${index}`, kind, systems: ['pf2e'], source: 'official',
    level: 0, traits: [], description: '', data: {}, effects: [], updatedAt: 0,
  })))
  const c: Character = {
    id: 'large-catalog', name: 'Test', systems: ['pf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('aria-label="Background" aria-haspopup="dialog"')
    expect(markup).toContain('aria-label="Deity" aria-haspopup="dialog"')
    expect(markup).not.toContain('aria-label="Search background"')
    expect(markup).not.toContain('aria-label="Search deity"')
    expect(markup).not.toContain('aria-label="Search heritage"')
  } finally { content.entries = [] }
})

it('retains official access metadata and shows saved ethnicity without changing ancestry or heritage', async () => {
  const fetchFn: typeof fetch = async (_url, init) => {
    expect(JSON.parse(String(init?.body))._source).toContain('access')
    return new Response(JSON.stringify({ hits: { hits: String(init?.body).includes('"category":"feat"')
      ? [{ _id: 'feat-949', _source: { category: 'feat', name: 'Witch Warden', access: 'Kellid ethnicity', trait: ['Human', 'Uncommon'] } }] : [] } }))
  }
  const mapped = mapAonHit((await fetchAonHits('pf2e', fetchFn))[0], 'pf2e')
  if (!mapped) throw new Error('Missing access mapping')
  expect(mapped.data.access).toBe('Kellid ethnicity')
  content.entries = [mapped, { ...mapped, id: 'dwarf', name: 'Avenge in Glory', traits: ['Dwarf'], data: { access: 'mountain dwarf ethnicity' } }]
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Human', heritage: 'Versatile Human', ethnicity: 'Kellid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const saved: Character = JSON.parse(JSON.stringify(c))
    const markup = renderToStaticMarkup(<CharacterBuilder character={saved} onClose={() => {}} />)
    expect(markup).toContain('aria-label="Ethnicity"')
    expect(markup).toContain('<option selected="">Kellid</option>')
    const ethnicity = markup.match(/<select[^>]*aria-label="Ethnicity"[^>]*>[\s\S]*?<\/select>/)?.[0]
    expect(ethnicity).not.toContain('Mountain Dwarf')
    expect(markup).toContain('Access does not replace prerequisites.')
    expect(saved).toMatchObject({ ancestry: 'Human', heritage: 'Versatile Human', ethnicity: 'Kellid' })
    const changed = renderToStaticMarkup(<CharacterBuilder character={{ ...saved, ancestry: 'Dwarf' }} onClose={() => {}} />)
    const dwarfEthnicity = changed.match(/<select[^>]*aria-label="Ethnicity"[^>]*>[\s\S]*?<\/select>/)?.[0]
    expect(dwarfEthnicity).toContain('Mountain Dwarf')
    expect(dwarfEthnicity).toContain('disabled=""')
    expect(dwarfEthnicity).toContain('Kellid (not available for Dwarf)')
    expect(renderToStaticMarkup(<CharacterBuilder character={{ ...saved, ancestry: undefined }} onClose={() => {}} />))
      .toContain('aria-label="Ethnicity" disabled=""')
  } finally { content.entries = [] }
})

it('retains full material, rune and ordinary equipment rules through snapshot fetching and mapping', async () => {
  const sources = [
    { name: 'Peachwood Weapon', item_subcategory: 'Precious Material Weapons' },
    { name: 'Grisantian Pelt Armor', item_subcategory: 'Precious Material Armor' },
    { name: 'Peachwood', item_category: 'Materials' },
    { name: 'Flaming', item_subcategory: 'Weapon Property Runes' },
    { name: 'Rope', item_subcategory: 'Adventuring Gear' },
  ]
  const fetchFn: typeof fetch = async (_url, init) => new Response(JSON.stringify({
    hits: { hits: String(init?.body).includes('"category":"equipment"') ? sources.map((source) => ({
      _id: source.name, _source: { category: 'equipment', ...source, summary: 'Short summary.', markdown: 'Full rules.\n\nAdditional benefit.' },
    })) : [] },
  }))
  const hits = await fetchAonHits('pf2e', fetchFn)
  expect(hits).toHaveLength(5)
  for (const hit of hits) {
    expect(hit._source?.markdown).toContain('Additional benefit.')
    expect(mapAonHit(hit, 'pf2e')?.description).toBe('Full rules.\n\nAdditional benefit.')
  }
})

it('alphabetizes collapsible main sections without showing other feat slots', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  const headings = [...markup.matchAll(/<summary class="character-section-summary"><strong>([^<]+)<\/strong>/g)]
    .map((match) => match[1])
  expect(headings).toEqual([
    'Ability Scores', 'Ancestry', 'Background', 'Class', 'Dedications', 'Defense', 'Deity', 'Equipment', 'Formulas',
    'General Feats', 'Languages', 'Minions', 'Offense', 'Senses and Speed', 'Skill Feats', 'Skills', 'Spells', 'Stances',
  ])
  expect(markup.match(/<details class="character-section">/g)).toHaveLength(headings.length)
  expect(markup).not.toContain('Other Feat Slots')
  expect(markup).not.toContain('Skills &amp; proficiencies')
  const offense = markup.slice(markup.indexOf('<strong>Offense</strong>'), markup.indexOf('<strong>Senses and Speed</strong>'))
  const senses = markup.slice(markup.indexOf('<strong>Senses and Speed</strong>'), markup.indexOf('<strong>Skill Feats</strong>'))
  expect(offense).not.toContain('Senses:')
  expect(offense).not.toContain('Speed:')
  expect(offense).not.toContain('skill-name">Perception')
  expect(senses).toContain('skill-name">Perception')
  expect(senses).toContain('Senses: No special senses')
  expect(senses).toContain('Speed:')
  const classSection = markup.slice(markup.indexOf('<strong>Class</strong>'), markup.indexOf('<strong>Dedications</strong>'))
  expect(classSection).toContain('aria-label="Character level"')
  expect(markup.slice(0, markup.indexOf('<strong>Class</strong>'))).not.toContain('aria-label="Character level"')
  const background = markup.slice(markup.indexOf('<strong>Background</strong>'), markup.indexOf('<strong>Class</strong>'))
  expect(background).toContain('<h4>Achievements</h4>')
})

it('shows defense summary context toggles only for equipped shields or parry weapons', () => {
  content.entries = [{ id: 'feat:parry', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Parry Expert',
    level: 1, traits: ['Ranger'], description: 'The circumstance bonus to AC from your parry trait increases to +2.', data: {}, effects: [], updatedAt: 0 }]
  const baseCharacter: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const plain = renderToStaticMarkup(<CharacterBuilder character={baseCharacter} onClose={() => {}} />)
    expect(plain).not.toContain('Raise Shield (summary)')
    expect(plain).not.toContain('Parry active (summary)')
    const shielded = renderToStaticMarkup(<CharacterBuilder character={{ ...baseCharacter, shield: { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false } }} onClose={() => {}} />)
    expect(shielded).toContain('Raise Shield (summary)')
    const buckler = renderToStaticMarkup(<CharacterBuilder character={{ ...baseCharacter, shield: { id: 'b', name: 'Buckler', hardness: 3, hp: 6, damage: 0, raised: false } }} onClose={() => {}} />)
    expect(buckler).toContain('aria-label="Raise Buckler (summary)"')
    expect(buckler).toContain('Raise Buckler (+1 AC)')
    const locked = renderToStaticMarkup(<CharacterBuilder character={{ ...baseCharacter, level: 20,
      feats: [{ name: 'Shield Paragon', type: 'Class Feat', level: 20 }],
      shield: { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false } }} onClose={() => {}} />)
    expect(locked).toMatch(/aria-label="Raise Shield \(summary\)" disabled="" checked=""/)
    expect(locked).toContain('Always raised by Shield Paragon')
    const parryFeat = { ...baseCharacter, feats: [{ name: 'Parry Expert', type: 'Class Feat', level: 1 }] }
    expect(renderToStaticMarkup(<CharacterBuilder character={parryFeat} onClose={() => {}} />)).not.toContain('Parry active (summary)')
    const parryWeapon: ContentEntry = { id: 'weapon:parry', systems: ['pf2e'], kind: 'weapon', source: 'official',
      name: 'Parrying Rapier', level: 1, traits: ['Parry'], description: '', data: { weapon_category: 'Martial', hands: 1 },
      effects: [], updatedAt: 0 }
    content.entries = [...content.entries, parryWeapon]
    const equipped = renderToStaticMarkup(<CharacterBuilder character={{ ...parryFeat,
      weapons: [{ id: 'parry', name: parryWeapon.name, potency: 0, striking: 0, runes: [] }] }} onClose={() => {}} />)
    expect(equipped).toContain('Parry active (summary)')
    const stowed = renderToStaticMarkup(<CharacterBuilder character={{ ...parryFeat,
      weapons: [{ id: 'parry', name: parryWeapon.name, potency: 0, striking: 0, runes: [], stowed: true }] }} onClose={() => {}} />)
    expect(stowed).not.toContain('Parry active (summary)')
  } finally { content.entries = [] }
})

it('shows official deity epithets in the subtitle and picker while retaining canonical saved names', () => {
  const deity = mapAonHit({ _id: 'deity-285', _source: { category: 'deity', name: 'Iomedae', epithet: 'The Inheritor', skill: ['Intimidation'] } }, 'pf2e')
  if (!deity) throw new Error('Missing deity mapping')
  content.entries = [deity]
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Seelah', level: 1, className: 'Champion', deity: 'Iomedae',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('<strong>Deity</strong><span>Iomedae, the Inheritor</span>')
  expect(markup).toContain('<h4>Iomedae, the Inheritor</h4>')
  expect(markup).toContain('<option value="Iomedae" selected="">Iomedae, the Inheritor</option>')
  expect(c.deity).toBe('Iomedae')
  content.entries = []
  expect(renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />))
    .toContain('<strong>Deity</strong><span>Iomedae</span>')
})

it('shows Grandmother Rat for Lao Shu Po regardless of the enabled official source', () => {
  const pathfinder = mapAonHit({ _id: 'deity-pf', _source: { category: 'deity', name: 'Lao Shu Po', epithet: 'Old Rat Woman' } }, 'pf2e')
  const starfinder = mapAonHit({ _id: 'deity-sf', _source: { category: 'deity', name: 'Lao Shu Po', epithet: 'Grandmother Rat' } }, 'sf2e')
  if (!pathfinder || !starfinder) throw new Error('Missing deity mapping')
  const c: Character = {
    id: 'c', systems: ['pf2e', 'sf2e'], name: 'Test', level: 1, deity: 'Lao Shu Po',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    for (const entries of [[pathfinder], [starfinder], [pathfinder, starfinder], [starfinder, pathfinder]]) {
      content.entries = entries
      const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
      expect(markup).toContain('<strong>Deity</strong><span>Lao Shu Po, Grandmother Rat</span>')
      expect(markup).toContain('<h4>Lao Shu Po, Grandmother Rat</h4>')
      expect(markup).toContain('<option value="Lao Shu Po" selected="">Lao Shu Po, Grandmother Rat</option>')
      expect(markup).not.toContain('Old Rat Woman</span>')
    }
    expect(c.deity).toBe('Lao Shu Po')
  } finally { content.entries = [] }
})

it('defers unused picker choices while retaining saved values and deity labels', () => {
  content.entries = ([
    ['ancestry', 'Human'], ['ancestry', 'Elf'], ['class', 'Ranger'], ['class', 'Wizard'],
    ['deity', 'Iomedae'], ['deity', 'Abadar'],
  ] as const).map(([kind, name]): ContentEntry => ({
    id: `${kind}:${name}`, systems: ['pf2e'], kind, source: 'official', name, level: 1,
    traits: [], description: '', data: name === 'Iomedae' ? { epithet: 'The Inheritor' } : {},
    effects: [], updatedAt: 0,
  }))
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Human', className: 'Ranger',
    background: 'Missing background', deity: 'Iomedae',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('<option value="Human" selected="">Human</option>')
    expect(markup).toContain('<option value="Ranger" selected="">Ranger</option>')
    expect(markup).toContain('<option value="Iomedae" selected="">Iomedae, the Inheritor</option>')
    expect(markup).toContain('<option value="Missing background" selected="">Missing background</option>')
    for (const name of ['Elf', 'Wizard', 'Abadar']) expect(markup).not.toContain(`<option value="${name}">`)
  } finally { content.entries = [] }
})

it.each([
  ['hunters-edge', 'Ranger', 'Outwit', 'Outwit Edge Ranger'],
  ['cause', 'Champion', 'Justice', 'Champion of Justice'],
  ['instinct', 'Barbarian', 'Giant', 'Giant Instinct Barbarian'],
  ['innovation', 'Inventor', 'Construct', 'Construct Inventor'],
])('imports %s choices and shows selected subclass in the class subtitle', (category, className, name, label) => {
  const subclass = mapAonHit({ _id: 'subclass', _source: { category, name, markdown: 'Full subclass rules.' } }, 'pf2e')
  if (!subclass) throw new Error('Missing subclass mapping')
  expect(subclass).toMatchObject({ kind: 'subclass', data: { class: className }, description: 'Full subclass rules.' })
  content.entries = [subclass]
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className, subclass: name,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain(`<strong>Class</strong><span>${label}, 0/1</span>`)
  expect(markup).toContain(`<option value="${name}" selected="">${name}</option>`)
  if (className === 'Barbarian') expect(markup).toContain('>Instinct</label>')
  if (className === 'Inventor') expect(markup).toContain('>Innovation</label>')
  content.entries = []
})
