import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, onTestFinished, vi } from 'vitest'
import { CharacterBuilder as Builder, ClassPick, EquipmentSearch } from './CharacterBuilder'
import { Children, isValidElement, type ChangeEvent, type ReactNode } from 'react'
import { mapAonHit } from './aon'
import { fetchAonHits } from './aonQuery'
import { getSettings, updateSettings } from './settings'
import type { Character, ContentEntry } from './types'
import { equipmentGroupName, WORN_EQUIPMENT_GROUPS } from './equipmentGroups'
import * as equipmentGroups from './equipmentGroups'
import { classArchetypeSlotViews, FeatSlots } from './FeatSlots'
import { FeatChoice } from './FeatChoice'
import { GREATER_CROSS_PLATFORM_APPLICATION_FEAT, VERSATILE_FIRMWARE_FEAT } from './technomancer'
import { SearchableSelect } from './SearchableSelect'
import { WitchwarperAnchor } from './WitchwarperFeatures'
import { armorClass, classDifficultyClass, classLabel, isSpellActive, orphanedArchetypeFeats, plannedSlots, spellActiveChange, subclassOptions, syncClassArchetypeDedication, warriorLegendWeakness } from './builder'
import snapshot from '../public/data/aon-pf2e.json?raw'
import { GearSystemFilter } from './GearSystemFilter'
import type { GearSystem } from './gearSystem'
import { SkillsSection } from './SkillsSection'
import { processCharacterPicture } from './characterPictureData'

const content = vi.hoisted(() => ({ entries: [] as ContentEntry[] }))
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => content.entries }))
vi.mock('./DeferredDetails', () => ({
  DeferredDetails: ({ children, className = 'character-section' }: { children: ReactNode; className?: string }) =>
    <details className={className}>{children}</details>,
  DeferredContent: ({ children }: { children: () => ReactNode }) => children(),
}))
const CharacterBuilder = (props: Omit<Parameters<typeof Builder>[0], 'catalog'>) =>
  <Builder {...props} catalog={content.entries} />

it('shows active temporary HP in the collapsed Defense summary', () => {
  content.entries = []
  const c: Character = { id: 'temporary-hp', name: 'Test', systems: ['pf2e'], level: 8, className: 'Barbarian',
    raging: true, abilities: { str: 10, dex: 10, con: 16, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const render = (character: Character) => renderToStaticMarkup(<CharacterBuilder character={character} onClose={() => {}} />)
  expect(render(c)).toMatch(/Hit Points \d+\+11/)
  expect(render({ ...c, raging: false })).not.toMatch(/Hit Points \d+\+/)
})

it('counts and preserves the automatic Starfinder Field Agent Dedication', () => {
  content.entries = [
    { id: 'field-agent-dedication', name: 'Starfinder Field Agent Dedication', kind: 'feat', source: 'official',
      systems: ['sf2e'], level: 2, traits: ['Archetype', 'Dedication'], description: '',
      data: { archetype: 'Starfinder Field Agent' }, effects: [], updatedAt: 0 },
    { id: 'field-agent-feat', name: 'Field Agent Training', kind: 'feat', source: 'official',
      systems: ['sf2e'], level: 4, traits: ['Archetype'], description: '',
      data: { archetype: 'Starfinder Field Agent', prerequisite: 'Starfinder Field Agent Dedication' },
      effects: [], updatedAt: 0 },
  ]
  const previous = getSettings()
  onTestFinished(() => updateSettings(previous))
  updateSettings({ envoyFieldAgent: true })
  const c: Character = { id: 'field-agent', name: 'Test', systems: ['sf2e'], level: 20, className: 'Envoy',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const render = (character: Character) => renderToStaticMarkup(<CharacterBuilder character={character} onClose={() => {}} />)
  expect(render(c)).toContain('<strong>Dedications</strong><span>1/11</span>')

  const withArchetypeFeat = { ...c, feats: [{ name: 'Field Agent Training', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' }] }
  expect(orphanedArchetypeFeats(withArchetypeFeat, content.entries)).toEqual([])
  expect(render(withArchetypeFeat)).toContain('<strong>Dedications</strong><span>2/11</span>')
})

it('shows saved character pictures and rejects unsupported image files', async () => {
  content.entries = []
  const picture = { id: 'portrait-1', name: 'Character portrait', dataUrl: 'data:image/webp;base64,AA==' }
  const c: Character = { id: 'picture-gallery', name: 'Test', systems: ['pf2e'], level: 1,
    picture, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('<strong>Picture</strong><span>Added</span>')
  expect(markup).toContain('aria-label="Character picture"')
  expect(markup).toContain('alt="Character portrait"')
  await expect(processCharacterPicture(new File(['not an image'], 'portrait.svg', { type: 'image/svg+xml' })))
    .rejects.toThrow('Choose a PNG, JPEG, or WebP picture.')
})

it('shows Devise a Stratagem toggle in the Investigator class header and Statuses', () => {
  content.entries = []
  const c: Character = { id: 'investigator-status', name: 'Test', systems: ['pf2e'], level: 1, className: 'Investigator',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup.match(/aria-label="Devise a Stratagem active"/g)).toHaveLength(2)
})

it('shows requested spell and feat effects in Statuses', () => {
  content.entries = []
  const names = ['Animal Feature', 'Bone Shield', 'Canopy Crawler', 'False Vitality', 'Speak with Plants', 'Warning Stripes']
  const c: Character = { id: 'statuses', name: 'Test', systems: ['pf2e'], level: 11, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Favored Terrain', type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Plains' }],
    spells: names.map(name => ({ name, rank: name === 'False Vitality' ? 4 : 1, cantrip: false })), activeFeatEffects: ['Favored Terrain'],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  for (const name of names) expect(markup).toContain(`aria-label="${name} status"`)
  expect(markup).toContain('aria-label="Favored Terrain status"')
  expect(markup).toContain('<strong>Statuses</strong><span>Favored Terrain</span>')
})

it.each([
  { className: 'Ranger', subclass: undefined },
  { className: 'Rogue', subclass: 'Avenger' },
])('shows Hunt Prey toggle in class header and Statuses for $className $subclass', ({ className, subclass }) => {
  content.entries = []
  const c: Character = { id: 'hunt-prey', name: 'Test', systems: ['pf2e'], level: 1, className, subclass,
    huntPreyActive: true, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup.match(/aria-label="Hunt Prey active"[^>]*checked=""/g)).toHaveLength(2)
  expect(markup).toContain('Hunt Prey')
})

it('selects and changes Warrior of Legend weakness through class variants', () => {
  const fighter: ContentEntry = { id: 'fighter', name: 'Fighter', systems: ['pf2e'], kind: 'class',
    source: 'official', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }
  let c: Character = { id: 'warrior', name: 'Test', systems: ['pf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const picker = () => ClassPick({ c, entries: [fighter], options: [fighter], save })
  expect(picker().props.options.map((option: ContentEntry) => option.name)).toEqual(expect.arrayContaining([
    'Fighter (Warrior of Legend (Bludgeoning))', 'Fighter (Warrior of Legend (Piercing))',
    'Fighter (Warrior of Legend (Slashing))',
  ]))
  expect(picker().props.options.map((option: ContentEntry) => option.name)).not.toContain('Fighter (Warrior of Legend)')
  for (const type of ['Bludgeoning', 'Piercing', 'Slashing']) {
    picker().props.onChange(`Fighter (Warrior of Legend (${type}))`)
    expect(warriorLegendWeakness(c, [])?.damage).toBe(type.toLowerCase())
    expect(picker().props.value).toBe(`Fighter (Warrior of Legend (${type}))`)
  }
  picker().props.onChange('Fighter (Warrior of Legend (Piercing))')
  expect(c).toMatchObject({ className: 'Fighter', subclass: 'Warrior of Legend', warriorLegendDamageType: 'Piercing' })
  expect(picker().props.value).toBe('Fighter (Warrior of Legend (Piercing))')
  expect(classLabel(c)).toBe('Warrior of Legend (Piercing)')
  expect(warriorLegendWeakness(c, [])).toEqual({ damage: 'piercing', value: 1 })
  c = { ...c, level: 2, ...syncClassArchetypeDedication({ ...c, level: 2 }, []) }
  expect(c.feats).toContainEqual(expect.objectContaining({ name: 'Warrior of Legend Dedication', choice: 'Piercing' }))
  picker().props.onChange('Fighter (Warrior of Legend (Slashing))')
  expect(c.feats).toContainEqual(expect.objectContaining({ name: 'Warrior of Legend Dedication', choice: 'Slashing' }))
  expect(warriorLegendWeakness(c, [])?.damage).toBe('slashing')
  const legacy = { ...c, warriorLegendDamageType: undefined, feats: c.feats.map(feat => ({ ...feat, choice: 'Bludgeoning' })) }
  expect(ClassPick({ c: legacy, entries: [fighter], options: [fighter], save }).props.value)
    .toBe('Fighter (Warrior of Legend (Bludgeoning))')
  const unchosen = { ...legacy, feats: legacy.feats.map(feat => ({ ...feat, choice: undefined })) }
  expect(ClassPick({ c: unchosen, entries: [fighter], options: [fighter], save }).props.value)
    .toBe('Fighter (Warrior of Legend)')
  content.entries = [fighter, { ...fighter, id: 'dedication', kind: 'feat', name: 'Warrior Of Legend Dedication',
    level: 2, data: { archetype: 'Warrior Of Legend' } }]
  const markup = renderToStaticMarkup(<CharacterBuilder character={unchosen} onClose={() => {}} />)
  expect(markup).not.toContain('aria-label="Cursed Weakness"')
  expect(markup).not.toContain('aria-label="Warrior of Legend Dedication choice"')
})

it('uses the chosen Fighter key attribute for Warrior of Legend class DC', () => {
  const hits: Parameters<typeof mapAonHit>[0][] = JSON.parse(snapshot)
  const entries = ['Fighter', 'Fighter Expertise', 'Versatile Legend'].map(name =>
    mapAonHit(hits.find(hit => hit._source?.name === name
      && ['class', 'class-feature'].includes(String(hit._source?.category)))!, 'pf2e')!)
  const c: Character = { id: 'warrior-dc', name: 'Test', systems: ['pf2e'], level: 20,
    className: 'Fighter', subclass: 'Warrior of Legend', boosts: { class: 'str' },
    abilities: { str: 24, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(classDifficultyClass(c, entries)).toBe(43)
  expect(classDifficultyClass({ ...c, boosts: { class: 'dex' } }, entries)).toBe(39)
  expect(classDifficultyClass({ ...c, boosts: {} }, entries)).toBeUndefined()
  const manual = { ...c, boosts: undefined, classKeyAbility: 'str' as const }
  expect(classDifficultyClass(manual, entries)).toBe(43)
  expect(classDifficultyClass({ ...manual, classKeyAbility: 'dex' }, entries)).toBe(39)
  expect(classDifficultyClass({ ...manual, classKeyAbility: 'wis' }, entries)).toBeUndefined()
  content.entries = entries
  const markup = renderToStaticMarkup(<CharacterBuilder character={manual} onClose={() => {}} />)
  expect(markup).toContain('aria-label="Class key attribute"')
  expect(markup).toContain('<option value="str" selected="">Strength</option>')
  content.entries = []
})

it('offers Warrior of Legend archetype feats only in Dedications while using class slots', () => {
  const hits: Parameters<typeof mapAonHit>[0][] = JSON.parse(snapshot)
  const entries = ['Warrior Of Legend Dedication', 'Clear the Way'].map(name =>
    mapAonHit(hits.find(hit => hit._source?.name === name)!, 'pf2e')!)
  const initial: Character = { id: 'warrior-feats', name: 'Test', systems: ['pf2e'], level: 6,
    className: 'Fighter', subclass: 'Warrior of Legend',
    abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const c = { ...initial, ...syncClassArchetypeDedication(initial, entries) }
  const previous = getSettings().warriorLegendClearTheWay
  try {
    updateSettings({ warriorLegendClearTheWay: true })
    const render = (category: 'class' | 'archetype', character = c) =>
      renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={() => {}} categories={[category]}
        search={{ 'class:6:0:open': '1' }} onSearch={() => {}} />)
    expect(render('class')).not.toContain('L06 Class: Clear the Way')
    expect(render('archetype')).toContain('L06 Dedication: Clear the Way')
    const selected = { ...c, feats: [...c.feats, { name: 'Clear the Way', type: 'Class Feat', level: 6, slot: 'class:6:0' }] }
    expect(plannedSlots(selected, entries).find(slot => slot.key === 'class:6:0')?.displayCategory).toBe('archetype')
    expect(render('class', selected)).not.toContain('Clear the Way')
    expect(render('archetype', selected)).toContain('Clear the Way')
  } finally { updateSettings({ warriorLegendClearTheWay: previous }) }
})

it('does not duplicate Vindicator class slots as dedication slots', () => {
  const hits: Parameters<typeof mapAonHit>[0][] = JSON.parse(snapshot)
  const entries = ['Vindicator Dedication', 'Interrogate'].map(name =>
    mapAonHit(hits.find(hit => hit._source?.name === name)!, 'pf2e')!)
  const initial: Character = { id: 'vindicator-slots', name: 'Test', systems: ['pf2e'], level: 6,
    className: 'Ranger', subclass: 'Vindication',
    abilities: { str: 10, dex: 18, con: 10, int: 10, wis: 14, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const c = { ...initial, ...syncClassArchetypeDedication(initial, entries) }
  const previous = getSettings()
  try {
    updateSettings({ freeArchetype: false, rangerCavalier: false, rangerBeastmaster: false, rangerSnarecrafter: false })
    const slots = plannedSlots(c, entries)
    expect(classArchetypeSlotViews(c, entries, slots)).toEqual([])
    expect(slots.filter(slot => (slot.displayCategory ?? slot.category) === 'archetype').map(slot => slot.key))
      .toEqual(['class:2:0'])
    const render = (category: 'class' | 'archetype', character = c) =>
      renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={() => {}} categories={[category]}
        search={{ 'class:6:0:open': '1' }} onSearch={() => {}} />)
    expect(render('class')).toContain('L06 Class: Interrogate')
    expect(render('archetype')).not.toContain('L06 Dedication: Interrogate')
    const selected = { ...c, feats: [...c.feats, { name: 'Interrogate', type: 'Class Feat', level: 6, slot: 'class:6:0' }] }
    expect(render('archetype', selected)).toContain('Interrogate')
    expect(render('class', selected)).not.toContain('Interrogate')
    updateSettings({ freeArchetype: true })
    expect(plannedSlots(c, entries).filter(slot => slot.category === 'archetype').map(slot => slot.key))
      .toEqual(['archetype:2:0', 'archetype:4:0', 'archetype:6:0'])
    expect(classArchetypeSlotViews(c, entries, plannedSlots(c, entries))).toEqual([])
  } finally { updateSettings(previous) }
})

it('filters equipment by skill item bonuses without treating other bonuses as item bonuses', () => {
  const item: ContentEntry = { id: 'item', name: 'Boots', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: 'Gain a +1 item bonus to Acrobatics and Stealth checks while sneaking.',
    data: { usage: 'worn boots' }, effects: [], updatedAt: 0 }
  expect([...equipmentGroups.equipmentBonusSkills(item)]).toEqual(['Acrobatics', 'Stealth'])
  expect(equipmentGroups.equipmentSkillBonuses(item, 'Acrobatics')).toEqual([1])
  expect(equipmentGroups.equipmentSkillBonuses({ ...item,
    description: 'Gain a +1 item bonus to Acrobatics and a +3 item bonus to Stealth.' }, 'Stealth')).toEqual([3])
  expect(equipmentGroups.equipmentSkillBonuses({ ...item,
    description: 'Gain a +1 circumstance bonus to Stealth checks.' }, 'Stealth')).toEqual([])
  expect([...equipmentGroups.equipmentBonusSkills({ ...item, description: 'Gain a +1 circumstance bonus to Stealth checks.' })]).toEqual([])
  expect([...equipmentGroups.equipmentBonusSkills({ ...item, description: 'Gain a +1 item bonus to Reflex saves, and use Stealth checks.' })]).toEqual([])
  expect([...equipmentGroups.equipmentBonusSkills({ ...item, description: 'Gain a +2 item bonus to Acrobatics and Stealth and a +2 circumstance bonus to AC.' })])
    .toEqual(['Acrobatics', 'Stealth'])
  expect([...equipmentGroups.equipmentBonusSkills({ ...item, description: 'Gain a +1 item bonus to Make an Impression.' })]).toEqual(['Diplomacy'])
  expect([...equipmentGroups.equipmentBonusSkills({ ...item, data: { skill: 'Crafting' },
    description: 'Gain a +1 item bonus to the check.' })]).toEqual(['Crafting'])
  for (const [name, skill] of [
    ['Antigrav Harness (Tactical)', 'Acrobatics'],
    ["Programmer's Plushie (Tactical)", 'Computers'],
  ] as const) {
    const variant: ContentEntry = { ...item, id: name, name, systems: ['sf2e'], data: { skill },
      description: `Gain a +1 item bonus to ${skill} checks.\n\n${name}\n\nSource\n\n---\n\nThe item bonus is +2.` }
    expect([...equipmentGroups.equipmentBonusSkills(variant)]).toEqual([skill])
    expect(equipmentGroups.equipmentSkillBonuses(variant, skill)).toEqual([2])
  }
  const exoskeleton: ContentEntry = { ...item, id: 'exoskeleton', name: 'Ephemeral Exoskeleton', systems: ['sf2e'],
    description: 'You gain a +3 item bonus to Athletics checks.' }
  expect([...equipmentGroups.equipmentBonusSkills(exoskeleton)]).toEqual(['Athletics'])
  expect(equipmentGroups.equipmentSkillBonuses(exoskeleton, 'Athletics')).toEqual([3])
  const c: Character = { id: 'equipment-skill', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  function InspectSearch() {
    const tree = EquipmentSearch({ c, entries: [item, { ...item, id: 'other', name: 'Other Boots',
      description: 'Gain a +1 circumstance bonus to Stealth checks.' }], save: () => {} })
    Children.forEach(tree.props.children, row => {
      if (!isValidElement<{ children?: ReactNode }>(row)) return
      Children.forEach(row.props.children, child => {
        if (!isValidElement<{ children?: ReactNode }>(child) || child.type !== 'label') return
        Children.forEach(child.props.children, select => {
          if (isValidElement<{ 'aria-label'?: string; value?: string; onChange?: (event: unknown) => void }>(select)
            && select.props['aria-label'] === 'Skill item bonus' && select.props.value !== 'Stealth')
            select.props.onChange?.({ target: { value: 'Stealth' } })
        })
      })
    })
    return tree
  }
  const markup = renderToStaticMarkup(<InspectSearch />)
  expect(markup).toContain('Add Boots')
  expect(markup).toContain('(item 1) (+1)')
  expect(markup).not.toContain('Add Other Boots')
})

it('shows skill bonuses for official equipment variants', () => {
  const hits: Parameters<typeof mapAonHit>[0][] = JSON.parse(snapshot)
  for (const [name, skill, bonus] of [
    ['Daredevil Boots', 'Acrobatics', 2], ['Daredevil Boots (Greater)', 'Acrobatics', 3],
    ['Armbands of Athleticism', 'Athletics', 2], ['Armbands of Athleticism (Greater)', 'Athletics', 3],
    ["Voyager's Pack", 'Survival', 3],
    ['Marvelous Medicines', 'Medicine', 2], ['Marvelous Medicines (Greater)', 'Medicine', 3],
  ] as const) {
    const item = mapAonHit(hits.find(hit => hit._source?.name === name)!, 'pf2e')!
    expect(equipmentGroups.equipmentSkillBonuses(item, skill), name).toEqual([bonus])
  }
})

it('offers only skill bonuses present in the equipment section and selected system', () => {
  const boots: ContentEntry = { id: 'boots', name: 'Boots', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: 'Gain a +1 item bonus to Stealth checks.',
    data: { usage: 'worn boots' }, effects: [], updatedAt: 0 }
  const entries: ContentEntry[] = [
    boots,
    { ...boots, id: 'boots-sf', name: 'Starfinder Boots', systems: ['sf2e'], description: 'Gain a +1 item bonus to Piloting checks.' },
    { ...boots, id: 'hat', name: 'Hat', data: { usage: 'worn headwear' }, description: 'Gain a +1 item bonus to Arcana checks.' },
    { ...boots, id: 'gloves', name: 'Gloves', data: { usage: 'worn gloves' }, description: 'Gain a +1 circumstance bonus to Acrobatics checks.' },
  ]
  const c: Character = { id: 'equipment-options', systems: ['pf2e', 'sf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const options = (markup: string) => markup.match(/<select aria-label="Skill item bonus"[\s\S]*?<\/select>/)?.[0] ?? ''
  const both = options(renderToStaticMarkup(<EquipmentSearch c={c} entries={entries} save={() => {}} category="Boots" />))
  expect(both).toContain('>Stealth</option>')
  expect(both).toContain('>Piloting</option>')
  expect(both).not.toContain('>Arcana</option>')
  expect(both).not.toContain('>Acrobatics</option>')
  expect(options(renderToStaticMarkup(<EquipmentSearch c={c} entries={entries} save={() => {}} category="Gloves" />))).toBe('')
  expect(options(renderToStaticMarkup(<EquipmentSearch c={c} entries={entries} save={() => {}} />))).toContain('>Arcana</option>')
  function PathfinderSearch() {
    const tree = EquipmentSearch({ c, entries, save: () => {}, category: 'Boots' })
    Children.forEach(tree.props.children, row => {
      if (!isValidElement<{ children?: ReactNode }>(row)) return
      Children.forEach(row.props.children, child => {
        if (isValidElement<{ value: GearSystem; onChange: (value: GearSystem) => void }>(child)
          && child.type === GearSystemFilter && child.props.value !== 'pf2e') child.props.onChange('pf2e')
      })
    })
    return tree
  }
  const pathfinder = options(renderToStaticMarkup(<PathfinderSearch />))
  expect(pathfinder).toContain('>Stealth</option>')
  expect(pathfinder).not.toContain('>Piloting</option>')
})

it("offers Survival for Voyager's Pack in the backpacks picker", () => {
  const hits: Parameters<typeof mapAonHit>[0][] = JSON.parse(snapshot)
  const pack = mapAonHit(hits.find(hit => hit._source?.name === "Voyager's Pack")!, 'pf2e')!
  const c: Character = { id: 'backpack-options', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(equipmentGroupName(pack)).toBe('Backpacks')
  expect([...equipmentGroups.equipmentBonusSkills(pack)]).toContain('Survival')
  function SurvivalSearch() {
    const tree = EquipmentSearch({ c, entries: [pack], save: () => {}, category: 'Backpacks' })
    Children.forEach(tree.props.children, row => {
      if (!isValidElement<{ children?: ReactNode }>(row)) return
      Children.forEach(row.props.children, child => {
        if (!isValidElement<{ children?: ReactNode }>(child) || child.type !== 'label') return
        Children.forEach(child.props.children, select => {
          if (isValidElement<{ 'aria-label'?: string; value?: string; onChange?: (event: unknown) => void }>(select)
            && select.props['aria-label'] === 'Skill item bonus' && select.props.value !== 'Survival')
            select.props.onChange?.({ target: { value: 'Survival' } })
        })

      })
    })
    return tree
  }
  const markup = renderToStaticMarkup(<SurvivalSearch />)
  expect(markup).toContain('>Survival</option>')
  expect(markup).toContain(`Add Voyager&#x27;s Pack`)
})

it.each([
  ['Daredevil Boots', 'Acrobatics'],
  ['Armbands of Athleticism', 'Athletics'],
])('offers and applies %s skill bonuses, including greater versions', (name, skill) => {
  const hits: Parameters<typeof mapAonHit>[0][] = JSON.parse(snapshot)
  const entries = [name, `${name} (Greater)`].map(itemName =>
    mapAonHit(hits.find(hit => hit._source?.name === itemName)!, 'pf2e')!)
  const c: Character = { id: 'skill-gear', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const picker = renderToStaticMarkup(<EquipmentSearch c={c} entries={entries} save={() => {}} fixedSkill={skill} />)
  expect(picker).toContain(`Add ${name}`)
  expect(picker).toContain(`Add ${name} (Greater)`)
  expect(renderToStaticMarkup(<EquipmentSearch c={c} entries={entries} save={() => {}} fixedSkill="Religion" />))
    .not.toContain(`Add ${name}`)
  const row = (equipment: Character['equipment'], itemEntries = entries) =>
    renderToStaticMarkup(<SkillsSection c={{ ...c, equipment }} entries={itemEntries} save={() => {}} />)
      .split(`class="skill-name">${skill} `)[1].split('role="row"')[0]
  expect(row([])).toContain('<small>Item</small>+0</button>')
  expect(row([{ name, qty: 1 }])).toContain('<small>Item</small>+2</button>')
  expect(row([{ name, qty: 1 }, { name: `${name} (Greater)`, qty: 1 }]))
    .toContain('<small>Item</small>+3</button>')
  expect(row([{ name, qty: 0 }])).toContain('<small>Item</small>+0</button>')
  expect(row([{ name, qty: 1 }], [{ ...entries[0], deleted: true }])).toContain('<small>Item</small>+0</button>')
})

it.each([
  ['Barbarian', 'Bloodrager', 'Bloodrager'],
  ['Ranger', 'Vindicator', 'Vindication'],
  ['Rogue', 'Avenger', 'Avenger'],
  ['Wizard', 'Runelord', 'School of Thassilonian Rune Magic'],
])('selects %s (%s) while retaining the base class and required subclass', (className, name, subclass) => {
  const klass: ContentEntry = { id: className, name: className, systems: ['pf2e'], kind: 'class',
    source: 'official', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }
  const c: Character = { id: 'class', name: 'Test', systems: ['pf2e'], level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = vi.fn()
  const picker = ClassPick({ c, entries: [klass], options: [klass], save })
  expect(picker.props.options.map((option: ContentEntry) => option.name)).toContain(`${className} (${name})`)
  picker.props.onChange(`${className} (${name})`)
  expect(save).toHaveBeenCalledWith({ className, subclass, fatalMethod: undefined })
  const selected = { ...c, className, subclass }
  expect(classLabel(selected)).toBe(name)
  expect(ClassPick({ c: selected, entries: [klass], options: [klass], save }).props.value).toBe(`${className} (${name})`)
  expect(ClassPick({ c: { ...selected, systems: ['sf2e'] }, entries: [klass], options: [klass], save }).props.options)
    .not.toContainEqual(expect.objectContaining({ name: `${className} (${name})` }))
  picker.props.onChange(className)
  expect(save).toHaveBeenLastCalledWith({ className, subclass: '', fatalMethod: undefined })
})

it.each([
  ['Barbarian', 'Bloodrager', 'Instinct'],
  ['Ranger', 'Vindication', 'Hunter&#x27;s Edge'],
  ['Rogue', 'Avenger', 'Racket'],
  ['Wizard', 'School of Thassilonian Rune Magic', 'Subclass'],
])('locks %s subclass when its class archetype is selected', (className, subclass, label) => {
  const entry: ContentEntry = { id: subclass, name: subclass, systems: ['pf2e'], kind: 'subclass',
    source: 'official', level: 1, traits: [], description: '', data: { class: className }, effects: [], updatedAt: 0 }
  content.entries = [entry]
  const c: Character = { id: 'class-lock', name: 'Test', systems: ['pf2e'], level: 1, className, subclass,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toMatch(new RegExp(`<select aria-label="${label}"[^>]*disabled`))
  const normal = renderToStaticMarkup(<CharacterBuilder character={{ ...c, subclass: '' }} onClose={() => {}} />)
  expect(normal).not.toMatch(new RegExp(`<select aria-label="${label}"[^>]*disabled`))
})

it('shows the locked Avenger Dedication under Dedications instead of Class Feats', () => {
  const rogue: ContentEntry = { id: 'rogue', name: 'Rogue', systems: ['pf2e'], kind: 'class',
    source: 'official', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }
  const avenger: ContentEntry = { id: 'avenger', name: 'Avenger', systems: ['pf2e'], kind: 'subclass',
    source: 'official', level: 1, traits: [], description: '', data: { class: 'Rogue' }, effects: [], updatedAt: 0 }
  const dedication: ContentEntry = { id: 'avenger-dedication', name: 'Avenger Dedication', systems: ['pf2e'], kind: 'feat',
    source: 'official', level: 2, traits: ['Archetype', 'Dedication'], description: '', data: { prerequisite: 'Avenger' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'avenger', name: 'Test', systems: ['pf2e'], level: 2, className: 'Rogue', subclass: 'Avenger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: dedication.name, type: 'Class Feat', level: 2, slot: 'class:2:0', sourceId: dedication.id }],
    equipment: [], lores: [], languages: [], entryIds: [rogue.id, avenger.id, dedication.id], extraSlots: [], updatedAt: 0 }
  const entries = [rogue, avenger, dedication]
  const render = (category: 'class' | 'archetype') => renderToStaticMarkup(<FeatSlots c={c} entries={entries} save={() => {}}
    categories={[category]} title={category === 'class' ? 'Class Feats' : 'Dedications'} />)
  expect(render('class')).not.toContain('Avenger Dedication')
  expect(render('archetype')).toContain('Avenger Dedication')
  expect(render('archetype')).toContain('L02 Dedication')
})

it('shows the locked Spellshot Dedication under Dedications instead of Class Feats', () => {
  const gunslinger: ContentEntry = { id: 'gunslinger', name: 'Gunslinger', systems: ['pf2e'], kind: 'class',
    source: 'official', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }
  const spellshotWay: ContentEntry = { id: 'spellshot-way', name: 'Way of the Spellshot', systems: ['pf2e'], kind: 'subclass',
    source: 'official', level: 1, traits: [], description: '', data: { class: 'Gunslinger' }, effects: [], updatedAt: 0 }
  const dedication: ContentEntry = { id: 'spellshot-dedication', name: 'Spellshot Dedication', systems: ['pf2e'], kind: 'feat',
    source: 'official', level: 2, traits: ['Archetype', 'Dedication'], description: '', data: { prerequisite: 'Way of the Spellshot' },
    effects: [], updatedAt: 0 }
  const c: Character = { id: 'spellshot', name: 'Test', systems: ['pf2e'], level: 2, className: 'Gunslinger',
    subclass: 'Way of the Spellshot', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: dedication.name, type: 'Class Feat', level: 2, slot: 'class:2:0', sourceId: dedication.id }],
    equipment: [], lores: [], languages: [], entryIds: [gunslinger.id, spellshotWay.id, dedication.id], extraSlots: [], updatedAt: 0 }
  const entries = [gunslinger, spellshotWay, dedication]
  const render = (category: 'class' | 'archetype') => renderToStaticMarkup(<FeatSlots c={c} entries={entries} save={() => {}}
    categories={[category]} title={category === 'class' ? 'Class Feats' : 'Dedications'} />)
  expect(render('class')).not.toContain('Spellshot Dedication')
  expect(render('archetype')).toContain('Spellshot Dedication')
  expect(render('archetype')).toContain('L02 Dedication')
})

it('counts granted feats alongside filled and empty slots in Skill and General headings', () => {
  const skills = ['Ride', 'Quick Jump', 'Battle Medicine', "Crafter's Appraisal", 'Dubious Knowledge', 'Student of the Canon']
  const feat = (name: string, traits = ['General', 'Skill']): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits, description: '', data: {}, effects: [], updatedAt: 0,
  })
  content.entries = [
    ...skills.map(name => feat(name)), feat('Shield Block', ['General']), feat('Untrained Improvisation', ['General']),
    { ...feat('Study'), kind: 'background', data: { feat: 'Student of the Canon' } },
    { ...feat('Shield Block'), id: 'fighter-shield-block', kind: 'classFeature', data: { class: 'Fighter' } },
  ]
  const c: Character = {
    id: 'grants', systems: ['pf2e'], name: 'Test', level: 20, className: 'Fighter', background: 'Study',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: ['Rider', 'Hydraulic Pistons', "Officer's Medical Training", 'Eye for Treasure', 'Orc Warmask', 'Clever Improviser']
      .map(name => ({ name, type: 'Ancestry Feat', level: 1 })),
    equipment: [], lores: [], languages: [], entryIds: [],
    extraSlots: [{ category: 'skill', level: 1, count: 1 }], updatedAt: 0,
  }
  const before = JSON.stringify(c)
  const render = (character = c) => renderToStaticMarkup(<CharacterBuilder character={character} onClose={() => {}} />)
  const markup = render()
  expect(markup).toContain('<strong>Skill Feats</strong><span>6/17</span>')
  expect(markup).toContain('<strong>General Feats</strong><span>2/7</span>')
  for (const [category, count] of [['skill', '6/17'], ['general', '2/7']] as const) {
    const standalone = renderToStaticMarkup(<FeatSlots c={c} entries={content.entries} categories={[category]} save={() => {}} />)
    expect(standalone).toContain(`Feat slots ${count}</h4>`)
  }
  const selected: Character = { ...c, feats: [...c.feats,
    { name: 'Shield Block', type: 'General Feat', level: 3, slot: 'general:3:0' }] }
  expect(render(selected)).toContain('<strong>General Feats</strong><span>2/6</span>')
  expect(render({ ...c, feats: c.feats.map(feat => ({ ...feat, takenLevel: 21 })) }))
    .toContain('<strong>Skill Feats</strong><span>1/12</span>')
  expect(JSON.stringify(c)).toBe(before)
})

it('lists Steady Balance as a granted skill feat for Uncanny Agility', () => {
  const steady: ContentEntry = { id: 'steady', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Steady Balance', level: 1,
    traits: ['General', 'Skill'], description: '', data: {}, effects: [], updatedAt: 0 }
  content.entries = [steady]
  const c: Character = { id: 'ua', systems: ['pf2e'], name: 'Test', level: 1, className: 'Fighter', ancestry: 'Tengu',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Uncanny Agility', type: 'Ancestry Feat', level: 1 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={content.entries} categories={['skill']} save={() => {}} />)
  expect(markup).toContain('Steady Balance')
})

it('shows Witchwarper anchor selection alongside class choices even without a paradox', () => {
  content.entries = []
  const c: Character = { id: 'anchor', systems: ['sf2e'], name: 'Test', level: 1, className: 'Witchwarper',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const render = (character: Character) => renderToStaticMarkup(<CharacterBuilder character={character} onClose={() => {}} />)
  const markup = render(c)
  expect(markup).toContain('aria-label="Anchor"')
  expect(markup).toContain('>Core Memories</option>')
  expect(markup).toContain('>Focal Point</option>')
  expect(markup).toContain('>Tangible Object</option>')
  expect(markup.indexOf('aria-label="Anchor"')).toBeLessThan(markup.indexOf('Class Features ('))
  expect(render({ ...c, subclass: 'Analyst', witchwarper: { anchor: 'Focal Point' } }))
    .toContain('<option selected="">Focal Point</option>')
  expect(render({ ...c, className: 'Mystic' })).not.toContain('aria-label="Anchor"')
  const save = vi.fn()
  const tree = WitchwarperAnchor({ c: { ...c, witchwarper: { coreMemorySkill: 'Computers' } }, save })!
  const select = Children.toArray(tree.props.children).find(child =>
    isValidElement<Parameters<typeof SearchableSelect>[0]>(child) && child.type === SearchableSelect)
  if (!isValidElement<Parameters<typeof SearchableSelect>[0]>(select)) throw new Error('Anchor selector missing')
  select.props.onChange!({ target: { value: 'Core Memories' } } as ChangeEvent<HTMLSelectElement>)
  expect(save).toHaveBeenCalledWith({ witchwarper: { anchor: 'Core Memories', coreMemorySkill: 'Computers' } })
  select.props.onChange!({ target: { value: '' } } as ChangeEvent<HTMLSelectElement>)
  expect(save).toHaveBeenLastCalledWith({ witchwarper: { anchor: undefined, coreMemorySkill: 'Computers' } })
})

it('keeps deity Lore in the Skills picker and normalizes legacy Acolyte variants', () => {
  content.entries = [{
    id: 'acolyte', systems: ['pf2e'], kind: 'background', source: 'official', name: 'Acolyte', level: 1,
    traits: [], description: 'Trained in Religion and Scribing Lore.', effects: [], updatedAt: 0,
    data: { skill: 'Religion, Scribing Lore', feat: 'Student of the Canon' },
  }]
  const c: Character = {
    id: 'acolyte', systems: ['pf2e'], name: 'Test', level: 1, background: 'Acolyte',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} deityLores={['Zon-Shelyn Lore']} onClose={() => {}} />)
  const picker = markup.match(/<select aria-label="Common Lore"[\s\S]*?<\/select>/)?.[0] ?? ''
  expect(picker).toContain('>Zon-Shelyn Lore</option>')
  const saved = renderToStaticMarkup(<CharacterBuilder character={{ ...c, background: 'Acolyte (Zon-Shelyn Lore)' }}
    onClose={() => {}} />)
  expect(saved).toContain('<option value="Acolyte" selected="">Acolyte</option>')
  expect(saved).toContain('Trained in Religion and Scribing Lore.')
  expect(saved).not.toContain('Acolyte (Zon-Shelyn Lore)')
})

it.each(['Scout', 'Nomad'])('shows saved %s Lore as a background variant without a separate skill picker', name => {
  content.entries = [{
    id: 'scout', systems: ['pf2e'], kind: 'background', source: 'official', name, level: 1,
    traits: [], description: '', effects: [], updatedAt: 0,
    data: { skill: 'Survival, Lore related to one terrain you scouted in (such as Forest Lore or Cavern Lore).' },
  }]
  const c: Character = { id: 'scout', systems: ['pf2e'], name: 'Test', level: 1, background: name,
    backgroundTerrainLore: { [name]: 'Forest' },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain(`<span>${name} (Forest Lore)</span>`)
  expect(markup).toContain(`<option value="${name} (Forest Lore)" selected="">${name} (Forest Lore)</option>`)
  expect(markup).not.toContain(`aria-label="${name} terrain Lore"`)
  expect(renderToStaticMarkup(<CharacterBuilder character={{ ...c, backgroundTerrainLore: undefined }} onClose={() => {}} />))
    .toContain(`<option value="${name}" selected="">${name}</option>`)
})

it('shows background rules inline and keeps ancestry and background boost choices in Ability Scores', () => {
  content.entries = [
    { id: 'human', systems: ['pf2e'], kind: 'ancestry', source: 'official', name: 'Human', level: 1,
      traits: [], description: '', data: { attribute: 'Two free ability boosts' }, effects: [], updatedAt: 0 },
    { id: 'acrobat', systems: ['pf2e'], kind: 'background', source: 'official', name: 'Acrobat', level: 1,
      traits: [], description: 'You earned your pay by performing as an acrobat.', data: {
        attribute: 'Strength or Dexterity, Free', skill: 'Acrobatics, Circus Lore', feat: 'Steady Balance', sourceBook: 'Player Core',
      }, effects: [], updatedAt: 0 },
  ]
  const c: Character = { id: 'background-rules', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Human', background: 'Acrobat',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, boosts: {},
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    const ability = markup.slice(markup.indexOf('<strong>Ability Scores</strong>'), markup.indexOf('<strong>Ancestry</strong>'))
    const ancestry = markup.slice(markup.indexOf('<strong>Ancestry</strong>'), markup.indexOf('<strong>Background</strong>'))
    const background = markup.slice(markup.indexOf('<strong>Background</strong>'), markup.indexOf('<strong>Class</strong>'))
    expect(ability).toContain('Ancestry Boosts')
    expect(ability).toContain('Background Boosts')
    expect(ancestry).not.toContain('Ancestry Boosts')
    expect(background).not.toContain('Background Boosts')
    expect(background).toContain('You earned your pay by performing as an acrobat.')
    expect(background).toContain('Attribute boosts: Strength or Dexterity, Free.')
    expect(background).toContain('Trained skills: Acrobatics, Circus Lore.')
    expect(background).toContain('Granted skill feat: Steady Balance.')
    expect(background).toContain('<small>Player Core</small>')
  } finally { content.entries = [] }
})

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

it('shows selected ancestry and heritage descriptions inline in order without source headers or raw metadata', () => {
  content.entries = [
    { id: 'halfling', systems: ['sf2e'], kind: 'ancestry', source: 'official', name: 'Halfling', level: 0,
      traits: [], description: 'Full ancestry introduction.\n\nComplete final paragraph.', data: { hp: 6, attribute: 'Dexterity, Wisdom, Free' },
      effects: [], updatedAt: 0 },
    { id: 'gutsy', systems: ['sf2e'], kind: 'heritage', source: 'official', name: 'Gutsy Halfling', level: 0,
      traits: ['Halfling'], description: 'Gutsy Halfling\n\nSource Galactic Ancestries pg. 72\n\nComplete heritage benefit.',
      data: {}, effects: [], updatedAt: 0 },
  ]
  const c: Character = { id: 'ancestry-rules', systems: ['sf2e'], name: 'Test', level: 1, ancestry: 'Halfling', heritage: 'Gutsy Halfling',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const section = (character: Character) => {
    const markup = renderToStaticMarkup(<CharacterBuilder character={character} onClose={() => {}} />)
    return markup.slice(markup.indexOf('<strong>Ancestry</strong>'), markup.indexOf('<strong>Background</strong>'))
  }
  try {
    const markup = section(c)
    expect(markup).toContain('<strong>Halfling:</strong> Full ancestry introduction.')
    expect(markup).toContain('<p><strong>Halfling:</strong> Full ancestry introduction. Complete final paragraph.</p>')
    expect(markup).toContain('<strong>Gutsy Halfling:</strong> Complete heritage benefit.')
    expect(markup.indexOf('aria-label="Halfling"')).toBeLessThan(markup.indexOf('aria-label="Gutsy Halfling"'))
    expect(markup).not.toContain('Source Galactic Ancestries')
    expect(markup).not.toContain('hp: 6')
    expect(markup).not.toContain('Attribute Boosts')
    expect(section({ ...c, heritage: undefined })).not.toContain('Complete heritage benefit.')
    expect(section({ ...c, ancestry: undefined, heritage: undefined })).not.toContain('ancestry-entry')
  } finally { content.entries = [] }
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
    expect(markup).not.toContain('Cyborg; integrated, thought-operated')
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
  expect(markup).toContain('aria-label="Methodology"')
  expect(markup).toContain('Empiricism (Lore)')
  expect(markup).not.toContain('aria-label="Methodology skill"')
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
    expect(section).not.toContain('not its attribute boosts')
    expect(renderToStaticMarkup(<CharacterBuilder character={{ ...c, level: 0 }} onClose={() => {}} />))
      .not.toContain('aria-label="Free Heart background"')
  } finally { content.entries = [] }
})

it('labels Rogue subclass as Racket without duplicating the Versatile Rogue Mastermind choice', () => {
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

it('shows Versatile Investigator methodology benefits and skill choices in Class', () => {
  const methods: ContentEntry[] = ['Forensic Medicine', 'Empiricism'].map(name => ({
    id: name, systems: ['pf2e'], kind: 'subclass', source: 'official', name, level: 1,
    traits: [], description: `${name} methodology benefits.`, data: { class: 'Investigator' }, effects: [], updatedAt: 0,
  }))
  content.entries = methods
  const c: Character = { id: 'versatile-investigator', systems: ['pf2e'], name: 'Test', level: 10,
    className: 'Investigator', subclass: 'Forensic Medicine',
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Versatile Investigator', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Empiricism' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('Empiricism methodology (Versatile Investigator)')
    expect(markup).toContain('aria-label="Methodology"')
    expect(markup).toContain('Empiricism (Arcana)')
    expect(markup).not.toContain('aria-label="Empiricism methodology skill"')
  } finally { content.entries = [] }
})

it('shows Versatile Operative specialization choices and selected benefits in Class', () => {
  const feat: ContentEntry = { id: 'homebrew:versatile-operative', systems: ['sf2e'], kind: 'feat', source: 'homebrew',
    name: 'Versatile Operative', level: 10, traits: ['Operative', 'Class'], description: 'Choose a second specialization.',
    data: { class: 'Operative', feat_type: 'class' }, effects: [], updatedAt: 0 }
  const specializations: ContentEntry[] = ['Striker', 'Ghost'].map((name, index): ContentEntry => ({
    id: name, systems: ['sf2e' as const], kind: 'subclass', source: 'official', name, level: 1,
    traits: [], description: `${name} specialization benefits.`,
    data: { class: 'Operative', skill: index === 0 ? 'Athletics' : 'Deception' }, effects: [], updatedAt: 0,
  }))
  content.entries = [feat, ...specializations]
  const c: Character = { id: 'versatile-operative', systems: ['sf2e'], name: 'Test', level: 10,
    className: 'Operative', subclass: 'Striker',
    abilities: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Versatile Operative', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Ghost' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(markup).toContain('Ghost specialization (Versatile Operative)')
    expect(markup).toContain('Ghost specialization benefits.')
    const selecting = renderToStaticMarkup(<CharacterBuilder character={{ ...c, feats: [{ ...c.feats[0], choice: undefined }] }}
      onClose={() => {}} />)
    expect(selecting).toContain('aria-label="Versatile Operative specialization"')
    expect(selecting).toContain('<option>Ghost</option>')
  } finally { content.entries = [] }
})

it('shows armor and weapon proficiency badges in Equipment directly above their headings', () => {
  content.entries = []
  const c: Character = {
    id: 'armor-proficiency', systems: ['pf2e'], name: 'Test', level: 1, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    shield: { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, raised: false, damage: 0 },
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  const equipmentStart = markup.indexOf('<strong>Equipment</strong>')
  const armorHeading = markup.indexOf('<h4>Armor</h4>', equipmentStart)
  const proficiency = markup.indexOf('<div class="prof-badges">', equipmentStart)
  const defenseStart = markup.indexOf('<strong>Defense</strong>')
  const deityStart = markup.indexOf('<strong>Deity</strong>')
  expect(proficiency).toBeGreaterThan(equipmentStart)
  expect(proficiency).toBeLessThan(armorHeading)
  const weaponsHeading = markup.indexOf('<h4>Weapons</h4>', equipmentStart)
  const weaponProficiency = markup.lastIndexOf('<div class="prof-badges">', weaponsHeading)
  expect(weaponProficiency).toBeGreaterThan(armorHeading)
  const weaponBadges = markup.slice(weaponProficiency, weaponsHeading)
  for (const name of ['Advanced', 'Martial', 'Simple', 'Unarmed']) expect(weaponBadges).toContain(name)
  expect(weaponBadges).not.toContain('Unarmored')
  const defense = markup.slice(defenseStart, deityStart)
  expect(defense).toContain('class="prof-badges"')
  expect(defense).toContain('<h4>Armor</h4>')
  expect(defense).toContain('Add Armor')
  expect(defense).toContain('Equipped Steel Shield')
  expect(defense.indexOf('Add Armor')).toBeLessThan(defense.indexOf('Equipped Steel Shield'))
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
    expect(markup).toContain('aria-label="Animal rules"')
    expect(markup).toContain('Animal order description.')
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

it('hides Ancient Elf from heritage choices without erasing a saved heritage', () => {
  const previous = getSettings().disableAncientElfMultitalented
  const elf = { id: 'elf', kind: 'ancestry', name: 'Elf', traits: [] }
  const ancient = { id: 'ancient-elf', kind: 'heritage', name: 'Ancient Elf', traits: ['Elf'] }
  const woodland = { id: 'woodland-elf', kind: 'heritage', name: 'Woodland Elf', traits: ['Elf'] }
  content.entries = [elf, ancient, woodland].map(entry => ({ ...entry, kind: entry.kind as ContentEntry['kind'],
    systems: ['pf2e'], source: 'official', level: 0, traits: entry.traits ?? [], description: '', data: {}, effects: [], updatedAt: 0 }))
  const c: Character = { id: 'ancient-elf-test', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Elf', heritage: 'Ancient Elf',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const before = JSON.stringify(c)
  const heritagePicker = (character: Character) => renderToStaticMarkup(
    <CharacterBuilder character={character} onClose={() => {}} />,
  ).match(/<select[^>]*aria-label="Heritage"[^>]*>[\s\S]*?<\/select>/)?.[0] ?? ''
  try {
    updateSettings({ disableAncientElfMultitalented: true })
    expect(heritagePicker(c))
      .toContain('<option value="Ancient Elf" disabled="" selected="">Ancient Elf (not available for this ancestry)</option>')
    updateSettings({ disableAncientElfMultitalented: false })
    expect(heritagePicker(c)).toContain('<option value="Ancient Elf" selected="">Ancient Elf</option>')
    expect(JSON.stringify(c)).toBe(before)
  } finally {
    updateSettings({ disableAncientElfMultitalented: previous })
    content.entries = []
  }
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

it('offers weapon creation in both Equipment and Offense sections', () => {
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
  expect(offense).toContain('Add Weapon')
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
    expect(markup).toContain('<strong>Equipment</strong><span>3 Items, 2/2 Hands</span>')
    expect(markup).toContain('<strong>Offense</strong><span>3 Weapons, 2/2 Hands</span>')
    const unequipped = render({ ...c, shield: { ...c.shield!, equipped: false } })
    expect(unequipped).toContain('<strong>Equipment</strong><span>3 Items, 1/2 Hands</span>')
    expect(unequipped).toContain('<strong>Offense</strong><span>3 Weapons, 1/2 Hands</span>')
    const defense = markup.slice(markup.indexOf('<strong>Defense</strong>'), markup.indexOf('<strong>Deity</strong>'))
    expect(defense).toContain('aria-label="Equipped Steel Shield" checked=""')
  } finally { content.entries = [] }
})

it('counts owned weapons and armor without counting attached or stance attacks', () => {
  const c: Character = {
    id: 'equipment-count', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    weapons: [
      { id: 'w1', name: 'Sword', potency: 0, striking: 0, runes: [] },
      { id: 'w2', name: 'Spear', potency: 0, striking: 0, runes: [] },
      { id: 'attached:w1', name: 'Bayonet', attachedTo: 'w1', potency: 0, striking: 0, runes: [] },
      { id: 'supplemental:haft-striker-stance', name: 'Haft Striker Stance', potency: 0, striking: 0, runes: [] },
      { id: 'supplemental:fist', name: 'Fist', potency: 0, striking: 0, runes: [] },
      { id: 'sf2e:solarian:solar-weapon', name: 'Solar Weapon', potency: 0, striking: 0, runes: [] },
    ],
    armors: [{ id: 'armor', name: 'Leather Armor', potency: 0, resilient: 0, runes: [], worn: true }],
  }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('<strong>Equipment</strong><span>3 Items,')
})

it('does not count legacy equipment weapons and armor twice', () => {
  content.entries = [
    { id: 'legacy-sword', systems: ['pf2e'], kind: 'weapon', source: 'official', name: 'Sword',
      level: 0, traits: [], description: '', data: { hands: 1 }, effects: [], updatedAt: 0 },
    { id: 'legacy-armor', systems: ['pf2e'], kind: 'armor', source: 'official', name: 'Leather Armor',
      level: 0, traits: [], description: '', data: { ac: 1 }, effects: [], updatedAt: 0 },
  ]
  const c: Character = {
    id: 'legacy-equipment-count', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: 'Sword', qty: 1 }, { name: 'Leather Armor', qty: 1 }],
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  try {
    expect(renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />))
      .toContain('<strong>Equipment</strong><span>2 Items,')
  } finally { content.entries = [] }
})

it.each([
  { className: 'Barbarian', dedicationLevel: undefined, visible: true },
  { className: 'Ranger', dedicationLevel: 2, visible: true },
  { className: 'Ranger', dedicationLevel: undefined, visible: false },
  { className: 'Ranger', dedicationLevel: 6, visible: false },
])('puts eligible Rage control in Class header: $className, dedication $dedicationLevel', ({ className, dedicationLevel, visible }) => {
  content.entries = []
  const c: Character = { id: 'rage-header', systems: ['pf2e'], name: 'Test', level: 4, className, raging: true,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: dedicationLevel === undefined ? [] : [{ name: 'Barbarian Dedication', type: 'Archetype Feat', level: dedicationLevel }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  const classSection = markup.slice(markup.indexOf('<strong>Class</strong>'), markup.indexOf('<strong>Defense</strong>'))
  const classHeader = classSection.slice(0, classSection.indexOf('</summary>'))
  const offense = markup.slice(markup.indexOf('<strong>Offense</strong>'), markup.indexOf('<strong>Skill Feats</strong>'))
  const defense = markup.slice(markup.indexOf('<strong>Defense</strong>'), markup.indexOf('<strong>Deity</strong>'))
  expect(classHeader.includes('aria-label="Rage active" checked=""')).toBe(visible)
  expect(classSection.slice(classSection.indexOf('</summary>'))).not.toContain('aria-label="Rage active"')
  expect(offense).not.toContain('aria-label="Rage active"')
  expect(defense).not.toContain('aria-label="Rage active"')
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
      'Mask', 'Munitions', 'Neck', 'Necklaces', 'Other equipment', 'Other Worn Items', 'Poisons', 'Rings', 'Shield', 'Shoulders', 'Tattoos', 'Throat', 'Toolkits', 'Torso', 'Weapons', 'Wrists'])
    expect(equipment).not.toContain('Cheek Pouches')
    expect(equipment).not.toContain('Store in cheek pouch')
    expect(equipment.slice(equipment.indexOf('<h4>Grafts</h4>'), equipment.indexOf('<h4>Handwraps</h4>'))).toContain('Caligni Eyes')
    expect(equipment.slice(equipment.indexOf('<h4>Tattoos</h4>'), equipment.indexOf('<h4>Weapons</h4>'))).toContain('Spider Lily')
    const poisons = equipment.slice(equipment.indexOf('<h4>Poisons</h4>'), equipment.indexOf('<h4>Shield</h4>'))
    expect(poisons).toContain('Black Adder Venom')
    expect(poisons).toContain('Poison Weapon')
    expect(poisons.indexOf('Black Adder Venom')).toBeLessThan(poisons.indexOf('Poison Weapon'))
    expect(poisons).toContain('aria-label="Poison Weapon uses remaining">1/1</output>')
    const withoutFeat = renderToStaticMarkup(<CharacterBuilder character={{ ...c, feats: [] }} onClose={() => {}} />)
    const poisonItems = withoutFeat.slice(withoutFeat.indexOf('<h4>Poisons</h4>'), withoutFeat.indexOf('<h4>Shield</h4>'))
    expect(poisonItems).toContain('Black Adder Venom')
    expect(poisonItems).not.toContain('Poison Weapon')
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
  for (const category of ['Tattoos', 'Grafts', 'Toolkits', ...WORN_EQUIPMENT_GROUPS]) {
    expect(markup).toContain(`aria-label="Add ${category}" title="Add ${category}" aria-expanded="false"`)
    expect(markup).not.toContain(`aria-label="Search ${category.toLowerCase()}"`)
  }
  expect(markup).toContain('<h4>Tattoos</h4>')
  expect(markup).toContain('<h4>Grafts</h4>')
  expect(markup).not.toContain('do not impose body-slot limits')
  expect(markup).not.toContain('<h4>Worn Items</h4>')
  expect(c.equipment).toEqual([])
})

it('shows a locked Storied Skin tattoo for an active Tattooed Historian without duplicating saved equipment', () => {
  const tattoo: ContentEntry = { id: 'skin', name: 'Storied Skin', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 3, traits: ['Tattoo', 'Magical'], description: 'Living History', data: { item_category: 'Tattoos' }, effects: [], updatedAt: 0 }
  content.entries = [tattoo]
  const c: Character = { id: 'historian', systems: ['pf2e'], name: 'Test', level: 2,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Tattooed Historian Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const render = (character: Character) => {
    const markup = renderToStaticMarkup(<CharacterBuilder character={character} onClose={() => {}} />)
    return markup.slice(markup.indexOf('<h4>Tattoos</h4>'), markup.indexOf('<h4>Throat</h4>'))
  }
  try {
    expect(render(c)).toContain('Storied Skin')
    expect(render(c)).not.toContain('Remove</button>')
    expect(c.equipment).toEqual([])
    expect(render({ ...c, level: 1 })).not.toContain('Storied Skin')
    expect(render({ ...c, feats: [] })).not.toContain('Storied Skin')
    const existing = { ...c, equipment: [{ name: 'Storied Skin', qty: 1 }] }
    expect(render(existing).match(/>Storied Skin<\/button>/g)).toHaveLength(1)
    expect(render(existing)).not.toContain('Remove</button>')
    expect(render({ ...existing, feats: [] })).toContain('Remove</button>')
    const picker = renderToStaticMarkup(<EquipmentSearch c={c} entries={[tattoo]} save={() => {}} category="Tattoos" />)
    expect(picker).toMatch(/aria-label="Add Storied Skin" disabled=""/)
  } finally { content.entries = [] }
})

it('groups existing and selectable toolkits separately from other equipment', () => {
  const item = (name: string): ContentEntry => ({ id: name, name, kind: 'item', systems: ['sf2e'], source: 'official',
    level: 1, traits: [], description: '', data: { item_category: 'Adventuring Gear' }, effects: [], updatedAt: 0 })
  const entries = [item('Hacking Toolkit (Tactical)'), item('Medkit'), item('Rope')]
  const c: Character = { id: 'toolkits', systems: ['sf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [{ name: entries[0].name, qty: 1, group: 'Other equipment' }],
    lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(equipmentGroupName(entries[0], entries[0].name, 'Other equipment')).toBe('Toolkits')
  const search = renderToStaticMarkup(<EquipmentSearch c={c} entries={entries} save={() => {}} category="Toolkits" />)
  expect(search).toContain('Add Hacking Toolkit (Tactical)')
  expect(search).toContain('Add Medkit')
  expect(search).not.toContain('Add Rope')
  content.entries = entries
  try {
    const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    const section = markup.slice(markup.indexOf('<h4>Toolkits</h4>'), markup.indexOf('<h4>Torso</h4>'))
    expect(section).toContain('Hacking Toolkit (Tactical)')
  } finally { content.entries = [] }
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

it('reuses equipment group filtering while typing a search', () => {
  const boots: ContentEntry = { id: 'boots', name: 'Azure Boots', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: '', data: { usage: 'worn boots' }, effects: [], updatedAt: 0 }
  const hat: ContentEntry = { ...boots, id: 'hat', name: 'Azure Hat', data: { usage: 'worn headwear' } }
  const c: Character = { id: 'equipment-search', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const entries = [boots, hat]
  const fits = vi.spyOn(equipmentGroups, 'equipmentFitsGroup')
  function InspectSearch() {
    const tree = EquipmentSearch({ c, entries, save: () => {}, category: 'Boots' })
    const findInput = (node: ReactNode): { value?: string; onChange?: (event: unknown) => void } | undefined => {
      let found: { value?: string; onChange?: (event: unknown) => void } | undefined
      Children.forEach(node, child => {
        if (found || !isValidElement<{ children?: ReactNode; value?: string; onChange?: (event: unknown) => void }>(child)) return
        found = child.type === 'input' ? child.props : findInput(child.props.children)
      })
      return found
    }
    const input = findInput(tree)!
    if (input.value === '') input.onChange!({ target: { value: 'az' } })
    else if (input.value === 'az') input.onChange!({ target: { value: 'azu' } })
    return tree
  }
  try {
    const markup = renderToStaticMarkup(<InspectSearch />)
    expect(markup).toContain('Azure Boots')
    expect(markup).not.toContain('Azure Hat')
    expect(fits).toHaveBeenCalledTimes(2)
  } finally { fits.mockRestore() }
})

it.each([undefined, 'Boots'] as const)('filters equipment by system with category %s', category => {
  const base: ContentEntry = { id: 'pf', name: 'Azure Pathfinder Boots', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: '', data: { usage: 'worn boots' }, effects: [], updatedAt: 0 }
  const entries: ContentEntry[] = [base,
    { ...base, id: 'sf', name: 'Azure Starfinder Boots', systems: ['sf2e'] },
    { ...base, id: 'shared', name: 'Azure Shared Boots', systems: ['pf2e', 'sf2e'] },
    { ...base, id: 'hat', name: 'Azure Pathfinder Hat', data: { usage: 'worn headwear' } },
    { ...base, id: 'other', name: 'Other Boots' },
  ]
  const c: Character = { id: 'systems', systems: ['pf2e', 'sf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const render = (system: GearSystem, systems: Character['systems']) => {
    function InspectSearch() {
      const tree = EquipmentSearch({ c: { ...c, systems }, entries, save: () => {}, category })
      Children.forEach(tree.props.children, row => {
        if (!isValidElement<{ children?: ReactNode }>(row)) return
        Children.forEach(row.props.children, child => {
          if (!isValidElement<Record<string, unknown>>(child)) return
          if (child.type === 'input' && child.props.value !== 'azure')
            (child.props.onChange as (event: unknown) => void)({ target: { value: 'azure' } })
          if (child.type === GearSystemFilter && child.props.value !== system)
            (child.props.onChange as (value: GearSystem) => void)(system)
        })
      })
      return tree
    }
    return renderToStaticMarkup(<InspectSearch />)
  }
  for (const [system, visible] of [
    ['both', ['Azure Pathfinder Boots', 'Azure Starfinder Boots', 'Azure Shared Boots']],
    ['pf2e', ['Azure Pathfinder Boots', 'Azure Shared Boots']],
    ['sf2e', ['Azure Starfinder Boots', 'Azure Shared Boots']],
  ] as const) {
    const markup = render(system, c.systems)
    for (const entry of entries.slice(0, 3)) expect(markup.includes(`aria-label="Add ${entry.name}"`)).toBe(visible.some(name => name === entry.name))
    expect(markup).not.toContain('Add Other Boots')
    expect(markup.includes('Add Azure Pathfinder Hat')).toBe(!category && system !== 'sf2e')
  }
  expect(render('both', ['pf2e'])).not.toContain('Add Azure Starfinder Boots')
  expect(render('sf2e', ['pf2e'])).toContain('No matching')
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
    expect(handwraps).toContain('Potency')
    expect(handwraps).not.toContain('automatically upgrade with character level')
    expect(handwraps).toContain('Grievous')
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

it('grants and locks Shadowed Scale for an active Magic Warrior Mask feat', () => {
  const mask: ContentEntry = { id: 'shadowed-scale', name: 'Shadowed Scale, the Jungle Secret', kind: 'item',
    systems: ['pf2e'], source: 'official', level: 22, traits: ['Artifact'], description: '---\n\nAlways concealed in a jungle.',
    data: { usage: 'worn mask' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'magic-warrior-mask', systems: ['pf2e'], name: 'Test', level: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Cunning Trickster Mask', type: 'Archetype Feat', level: 20 }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  content.entries = [mask]
  try {
    const render = (character: Character) => renderToStaticMarkup(<CharacterBuilder character={character} onClose={() => {}} />)
      .split('<h4>Mask</h4>')[1].split('<h4>Neck</h4>')[0]
    const unlocked = render(c)
    expect(unlocked).toContain('Shadowed Scale, the Jungle Secret')
    expect(unlocked).toContain('Always concealed in a jungle.')
    expect(unlocked).not.toContain('Remove')
    expect(render({ ...c, level: 19 })).not.toContain('Shadowed Scale')
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
    expect(markup).not.toContain('Access does not replace prerequisites.')
    expect(saved).toMatchObject({ ancestry: 'Human', heritage: 'Versatile Human', ethnicity: 'Kellid' })
    const changed = renderToStaticMarkup(<CharacterBuilder character={{ ...saved, ancestry: 'Dwarf' }} onClose={() => {}} />)
    const dwarfEthnicity = changed.match(/<select[^>]*aria-label="Ethnicity"[^>]*>[\s\S]*?<\/select>/)?.[0]
    expect(dwarfEthnicity).toContain('Holtaksen (Mountain)')
    expect(dwarfEthnicity).toContain('disabled=""')
    expect(dwarfEthnicity).toContain('Kellid (not available for Dwarf)')
    expect(renderToStaticMarkup(<CharacterBuilder character={{ ...saved, ancestry: undefined }} onClose={() => {}} />))
      .not.toContain('aria-label="Ethnicity"')
    const unknownAncestry = { ...saved, ancestry: 'Android' }
    expect(renderToStaticMarkup(<CharacterBuilder character={unknownAncestry} onClose={() => {}} />))
      .not.toContain('aria-label="Ethnicity"')
    expect(unknownAncestry.ethnicity).toBe('Kellid')
  } finally { content.entries = [] }
})

it.each([
  ['Mountain Dwarf', 'Holtaksen (Mountain)'],
  ['Underground Dwarf', 'Grondaksen (Underground)'],
  ['Surface Dwarf', 'Ergaksen (Surface)'],
])('displays saved dwarf ethnicity %s as %s without rewriting character', (ethnicity, label) => {
  const c: Character = { id: 'dwarf-ethnicity', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Dwarf', ethnicity,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  const picker = markup.match(/<select[^>]*aria-label="Ethnicity"[^>]*>[\s\S]*?<\/select>/)?.[0]
  expect(picker).toContain(`<option selected="">${label}</option>`)
  expect(picker).not.toContain('not available')
  expect(c.ethnicity).toBe(ethnicity)
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
    'General Feats', 'Languages', 'Minions', 'Offense', 'Picture', 'Senses and Speed', 'Skill Feats', 'Skills', 'Statuses',
  ])
  expect(markup.match(/<details class="character-section">/g)).toHaveLength(headings.length)
  expect(markup).not.toContain('Other Feat Slots')
  expect(markup).not.toContain('Skills &amp; proficiencies')
  const offense = markup.slice(markup.indexOf('<strong>Offense</strong>'), markup.indexOf('<strong>Senses and Speed</strong>'))
  const senses = markup.slice(markup.indexOf('<strong>Senses and Speed</strong>'), markup.indexOf('<strong>Skill Feats</strong>'))
  expect(senses).toContain('<span>No special senses; Speed 25 ft.</span></summary>')
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
    const chitin = renderToStaticMarkup(<CharacterBuilder character={{ ...baseCharacter, systems: ['sf2e'], ancestry: 'Shirren',
      feats: [{ name: 'Chitinous Shield', type: 'Ancestry Feat', level: 1 }] }} onClose={() => {}} />)
    expect(chitin).toContain('aria-label="Raise Chitinous Shield (summary)"')
    expect(chitin).toContain('Raise Chitinous Shield (+2 AC)')
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

it('offers Shield cantrip in Defense and applies its existing non-stacking AC bonus', () => {
  const shield: ContentEntry = { id: 'shield-cantrip', systems: ['pf2e', 'sf2e'], kind: 'spell',
    source: 'official', name: 'Shield', level: 1, traits: ['Cantrip'],
    description: '', data: { tradition: 'Arcane, Occult, Primal' }, effects: [], updatedAt: 0 }
  const base: Character = { id: 'shield-test', name: 'Test', systems: ['pf2e'], level: 1, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: {}, prepared: { '0:2': shield.id } } }
  content.entries = [shield]
  try {
    const render = (c: Character) => renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    const html = render(base)
    expect(html).toContain('aria-label="Raise Shield Cantrip (summary)"')
    const raised = { ...base, ...spellActiveChange(base, 'Shield', true) }
    expect(isSpellActive(raised, content.entries, 'Shield')).toBe(true)
    expect(armorClass(raised, content.entries)).toBe(armorClass(base, content.entries) + 1)
    expect(render(raised)).toMatch(/aria-label="Raise Shield Cantrip \(summary\)" checked=""/)
    expect(isSpellActive({ ...raised, ...spellActiveChange(raised, 'Shield', false) }, content.entries, 'Shield')).toBe(false)
    const equipped = { ...raised, shield: { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: true } }
    expect(armorClass(equipped, content.entries)).toBe(armorClass(base, content.entries) + 2)
    expect(render({ ...base, spellcasting: { ...base.spellcasting!, prepared: { '0:7': shield.id } } }))
      .not.toContain('Raise Shield Cantrip (summary)')
    const familiarAbility: ContentEntry = { ...shield, id: 'cantrip-connection', kind: 'familiar',
      name: 'Cantrip Connection', traits: [], data: { ability_type: 'Master' } }
    content.entries = [shield, familiarAbility]
    const familiar: Character = { ...base, feats: [{ name: 'Familiar', type: 'Class Feat', level: 1 }],
      familiar: { abilities: ['Cantrip Connection'] },
      spellcasting: { ...base.spellcasting!, prepared: { 'familiar-cantrip-connection': shield.id } } }
    expect(render(familiar)).toContain('Raise Shield Cantrip (summary)')
    expect(render({ ...familiar, familiar: { abilities: [] } })).not.toContain('Raise Shield Cantrip (summary)')
    const witchwarper: Character = { ...base, systems: ['sf2e'], className: 'Witchwarper', subclass: 'Analyst',
      boosts: { class: 'int' }, spellcasting: { ability: 'int', tradition: 'Arcane', rank: 1, slots: {}, repertoire: { '0:1': shield.id } } }
    expect(render(witchwarper)).toContain('Raise Shield Cantrip (summary)')
    expect(isSpellActive({ ...witchwarper, activeSpells: ['Shield'] }, content.entries, 'Shield')).toBe(true)
    expect(render({ ...base, spellcasting: undefined })).not.toContain('Raise Shield Cantrip (summary)')
    expect(render({ ...base, spellcasting: undefined, spells: [{ name: 'Shield', rank: 1, cantrip: true }] }))
      .toContain('Raise Shield Cantrip (summary)')
  } finally { content.entries = [] }
})

it('offers Raise Bone Shield while active and applies its non-stacking +2 AC', () => {
  const shield: ContentEntry = { id: 'shield', systems: ['pf2e'], kind: 'spell', source: 'official',
    name: 'Shield', level: 1, traits: ['Cantrip'], description: '', data: {}, effects: [], updatedAt: 0 }
  const bone: ContentEntry = { ...shield, id: 'bone-shield', name: 'Bone Shield', traits: [], data: { actions: 'Single Action' } }
  const base: Character = { id: 'bone-shield-test', name: 'Test', systems: ['pf2e'], level: 1, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    spells: [{ name: 'Shield', rank: 1, cantrip: true }, { name: 'Bone Shield', rank: 1, cantrip: false }] }
  content.entries = [shield, bone]
  try {
    const render = (c: Character) => renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
    expect(render(base)).toContain('Raise Shield Cantrip (summary)')
    expect(render(base)).not.toContain('Raise Bone Shield (summary)')
    const active = { ...base, activeSpells: ['Bone Shield'] }
    expect(render(active)).toContain('Raise Bone Shield (summary)')
    expect(render(active)).not.toContain('Raise Shield Cantrip (summary)')
    expect(armorClass(active, content.entries)).toBe(armorClass(base, content.entries))
    const raised = { ...active, boneShieldRaised: true }
    expect(render(raised)).toMatch(/aria-label="Raise Bone Shield \(summary\)" checked=""/)
    expect(armorClass(raised, content.entries)).toBe(armorClass(base, content.entries) + 2)
    const equipped = { ...raised, shield: { id: 's', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: true } }
    expect(armorClass(equipped, content.entries)).toBe(armorClass(base, content.entries) + 2)
    expect(armorClass({ ...raised, activeSpells: [] }, content.entries)).toBe(armorClass(base, content.entries))
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

it('offers all four Grim Fascinations when adding Necromancer and keeps the selected fascination', () => {
  content.entries = ['Blood', 'Bone', 'Flesh', 'Spirit'].map(name =>
    mapAonHit({ _id: `grim-${name}`, _source: { category: 'grim-fascination', name, markdown: `${name} rules.` } }, 'pf2e')!)
  const c: Character = { id: 'necromancer', systems: ['pf2e'], name: 'Test', level: 1, className: 'Necromancer',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const render = (character = c) => renderToStaticMarkup(<CharacterBuilder character={character} onClose={() => {}} />)
  expect(render()).toContain('aria-label="Grim Fascination"')
  expect(subclassOptions(c, content.entries).map(entry => entry.name)).toEqual(['Blood', 'Bone', 'Flesh', 'Spirit'])
  const saved = render({ ...c, subclass: 'Spirit' })
  expect(saved).toContain('<option value="Spirit" selected="">Spirit</option>')
  expect(saved).toContain('Spirit rules.')
  content.entries = []
})

it('keeps Fatal Method separate from Grim Fascination and displays the persisted choice', () => {
  content.entries = [
    mapAonHit({ _id: 'bone', _source: { category: 'grim-fascination', name: 'Bone', markdown: 'Bone rules.' } }, 'pf2e')!,
    mapAonHit({ _id: 'reaper', _source: { category: 'fatal-method', name: 'Reaper', markdown: 'Reaper rules.' } }, 'pf2e')!,
  ]
  const c: Character = { id: 'necromancer', systems: ['pf2e'], name: 'Test', level: 1, className: 'Necromancer',
    subclass: 'Bone', fatalMethod: 'Reaper',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('aria-label="Grim Fascination"')
  expect(markup).toContain('aria-label="Fatal Method"')
  expect(markup).toContain('<option value="Bone" selected="">Bone</option>')
  expect(markup).toContain('<option value="Reaper" selected="">Reaper</option>')
  expect(markup).toContain('Reaper rules.')
  expect(renderToStaticMarkup(<CharacterBuilder character={{ ...c, className: 'Wizard' }} onClose={() => {}} />))
    .not.toContain('aria-label="Fatal Method"')
  content.entries = []
})

it('selects Technomancer programming languages and Versatile Technomancer language', () => {
  content.entries = []
  const c: Character = { id: 'technomancer', systems: ['sf2e'], name: 'Test', level: 12, className: 'Technomancer',
    technomancerProgrammingLanguage: 'DPS++', abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Versatile Technomancer', type: 'Class Feat', level: 12, slot: 'class:12:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('aria-label="Technomancer Programming Language"')
  expect(markup).toContain('DPS++ programming language benefits')
  expect(markup).toContain('Overclock gear:</strong> Tech weapons')
  const choice = renderToStaticMarkup(<FeatChoice c={c} entries={[]} save={() => {}} index={0} />)
  expect(choice).toContain('Versatile Technomancer programming language')
  expect(choice).toContain('<option value="FORTRUN">FORTRUN</option>')
  expect(choice).not.toContain('<option value="DPS++">DPS++</option>')
  const missingPrimary = renderToStaticMarkup(<FeatChoice c={{ ...c, technomancerProgrammingLanguage: undefined }}
    entries={[]} save={() => {}} index={0} />)
  expect(missingPrimary).toContain('Choose primary programming language first')
  expect(missingPrimary).not.toContain('<option value="FORTRUN">FORTRUN</option>')
  const missingCrossPlatformPrimary = renderToStaticMarkup(<FeatChoice c={{ ...c,
    technomancerProgrammingLanguage: undefined,
    feats: [{ name: 'Cross-platform Application', type: 'Class Feat', level: 8, slot: 'class:8:0' }],
  }} entries={[]} save={() => {}} index={0} />)
  expect(missingCrossPlatformPrimary).toContain('Choose primary programming language first')
  expect(missingCrossPlatformPrimary).not.toContain('<option value="FORTRUN">FORTRUN</option>')
  const crossPlatform = { ...c, feats: [
    { name: 'Cross-platform Application', type: 'Class Feat', level: 8, slot: 'class:8:0', choice: 'FORTRUN' },
    { name: 'Cross-platform Application', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'ServoShell' },
    { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 12, slot: 'class:12:0', choice: 'FORTRUN' },
    { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 14, slot: 'class:14:0' },
  ] }
  const advancedChoice = renderToStaticMarkup(<FeatChoice c={crossPlatform} entries={[]} save={() => {}} index={3} />)
  expect(advancedChoice).toContain('Advanced Cross-platform Application programming language')
  expect(advancedChoice).toContain('<option value="ServoShell">ServoShell</option>')
  expect(advancedChoice).not.toContain('<option value="FORTRUN">FORTRUN</option>')
  const firmwareCharacter = { ...c, level: 20, feats: [
    { name: 'Cross-platform Application', type: 'Class Feat', level: 8, slot: 'class:8:0', choice: 'FORTRUN' },
    { name: 'Cross-platform Application', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'ServoShell' },
    { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 12, slot: 'class:12:0', choice: 'FORTRUN' },
    { name: 'Advanced Cross-platform Application', type: 'Class Feat', level: 14, slot: 'class:14:0', choice: 'ServoShell' },
    { name: 'Versatile Firmware', type: 'Class Feat', level: 16, slot: 'class:16:0', choice: 'FORTRUN' },
    { name: 'Versatile Firmware', type: 'Class Feat', level: 18, slot: 'class:18:0' },
  ] }
  const firmwareChoice = renderToStaticMarkup(<FeatChoice c={firmwareCharacter} entries={[VERSATILE_FIRMWARE_FEAT]}
    save={() => {}} index={5} />)
  expect(firmwareChoice).toContain('Versatile Firmware programming language')
  expect(firmwareChoice).toContain('<option value="ServoShell">ServoShell</option>')
  expect(firmwareChoice).not.toContain('<option value="Viper">Viper</option>')
  expect(firmwareChoice).not.toContain('<option value="FORTRUN">FORTRUN</option>')
  const greaterCharacter = { ...firmwareCharacter, feats: [...firmwareCharacter.feats,
    { name: 'Greater Cross-platform Application', type: 'Class Feat', level: 20, slot: 'class:20:0' }] }
  const greaterChoice = renderToStaticMarkup(<FeatChoice c={greaterCharacter}
    entries={[VERSATILE_FIRMWARE_FEAT, GREATER_CROSS_PLATFORM_APPLICATION_FEAT]} save={() => {}} index={6} />)
  expect(greaterChoice).toContain('Greater Cross-platform Application programming language')
  expect(greaterChoice).toContain('<option value="FORTRUN">FORTRUN</option>')
  expect(greaterChoice).not.toContain('<option value="ServoShell">ServoShell</option>')
  content.entries = []
})

it('shows selected Puppeteer rules and its free action without expanding a description', () => {
  content.entries = []
  const c: Character = { id: 'puppeteer', systems: ['pf2e'], name: 'Test', level: 1, className: 'Necromancer',
    fatalMethod: 'Puppeteer', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<CharacterBuilder character={c} onClose={() => {}} />)
  expect(markup).toContain('aria-label="Puppeteer rules"')
  expect(markup).toContain('<strong>Consume Thrall</strong> <span class="action-cost" aria-label="Free Action"')
  expect(markup).toContain('at least one thrall within 30 feet')
  expect(markup).toContain('only on a grave spell')
  expect(markup).toContain('<strong>Thrall Proliferation</strong>')
  expect(markup).not.toContain('aria-label="Reaper rules"')
  const unselected = renderToStaticMarkup(<CharacterBuilder character={{ ...c, fatalMethod: undefined }} onClose={() => {}} />)
  expect(unselected).not.toContain('aria-label="Puppeteer rules"')
  const reaper = renderToStaticMarkup(<CharacterBuilder character={{ ...c, fatalMethod: 'Reaper' }} onClose={() => {}} />)
  expect(reaper).toContain('aria-label="Reaper rules"')
  expect(reaper).toContain('within your melee reach')
  expect(reaper).not.toContain('aria-label="Puppeteer rules"')
  const otherClass = renderToStaticMarkup(<CharacterBuilder character={{ ...c, className: 'Wizard' }} onClose={() => {}} />)
  expect(otherClass).not.toContain('aria-label="Puppeteer rules"')
})

it.each([
  ['hunters-edge', 'Ranger', 'Outwit', 'Outwit Edge Ranger'],
  ['cause', 'Champion', 'Justice', 'Champion of Justice'],
  ['instinct', 'Barbarian', 'Giant', 'Giant Instinct Barbarian'],
  ['innovation', 'Inventor', 'Construct', 'Construct Inventor'],
  ['grim-fascination', 'Necromancer', 'Bone', 'Bone Necromancer'],
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
  expect(markup).toContain(`aria-label="${name} rules"`)
  expect(markup).toContain('Full subclass rules.')
  if (className === 'Barbarian') expect(markup).toContain('>Instinct</label>')
  if (className === 'Inventor') expect(markup).toContain('>Innovation</label>')
  if (className === 'Necromancer') expect(markup).toContain('>Grim Fascination</label>')
  content.entries = []
})
