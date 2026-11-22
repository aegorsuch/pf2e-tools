import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, onTestFinished, vi } from 'vitest'
import { FeatSlots, featPickerEligibility } from './FeatSlots'
import { EntryDescription } from './EntryDescription'
import { AutomaticFeatChoice, CarryTheirMemoriesChoice, FeatChoice } from './FeatChoice'
import { mapAonHit } from './aon'
import { eligibleFeats, featChoiceOptions, featPrerequisiteChecker, plannedSlots, ranksAt, unslottedFeats } from './builder'
import { achievementOptions } from './featAccess'
import { automaticFeatChoiceKey, grantedFeatSpells } from './featSpells'
import { getSettings, updateSettings } from './settings'
import * as builder from './builder'
import type { Character, ContentEntry } from './types'
import { homebrewCharacterOptions } from './supplemental'
import { TORAG_BOON_FEAT_SLOT } from './divineIntercessions'

let previousPlanning: boolean
beforeEach(() => {
  previousPlanning = getSettings().planSkillPrerequisites
  updateSettings({ planSkillPrerequisites: false })
  vi.stubGlobal('window', { confirm: vi.fn(() => true) })
})
afterEach(() => {
  updateSettings({ planSkillPrerequisites: previousPlanning })
  vi.unstubAllGlobals()
})

it('reuses feat eligibility while searching, but recomputes for another slot, character or rules', () => {
  const c = emptyRanger()
  const entries: ContentEntry[] = []
  const slot = plannedSlots(c, entries).find(candidate => candidate.category === 'class')!
  const compute = vi.spyOn(builder, 'eligibleFeats')
  try {
    const eligibility = featPickerEligibility(c, entries)
    const first = eligibility(slot)
    expect(eligibility({ ...slot })).toBe(first)
    expect(compute).toHaveBeenCalledTimes(1)
    eligibility({ ...slot, level: slot.level + 2 })
    expect(compute).toHaveBeenCalledTimes(2)
    updateSettings({ planSkillPrerequisites: true })
    eligibility({ ...slot, level: slot.level + 2 })
    expect(compute).toHaveBeenCalledTimes(3)
    featPickerEligibility({ ...c, level: c.level + 1 }, entries)(slot)
    expect(compute).toHaveBeenCalledTimes(4)
  } finally {
    compute.mockRestore()
  }
})

it.each([
  ["Pilgrim's Token", 'Trained in Religion; follower of a specific religion'],
  ['Sanctify Water', 'Expert in Religion; you follow a deity with “holy” or “unholy” sanctification'],
  ['Exhort the Faithful', 'Expert in Religion; follower of a specific religion'],
  ['Battle Prayer', 'Master in Religion; you follow a deity'],
  ['Sacred Defense', 'Master in Religion; you follow a deity'],
])('hides removed %s prerequisites in the feat description', (name, prerequisite) => {
  const entry = mapAonHit({ _id: name, _source: { category: 'feat', name, level: 2, trait: ['General', 'Skill'],
    prerequisite, markdown: `**Prerequisites**\n${prerequisite}\n\n---\n\nFeat benefit.` } }, 'pf2e')!
  const markup = renderToStaticMarkup(<EntryDescription name={name} entry={entry} />)
  expect(markup).not.toContain('Prerequisites')
  expect(markup).toContain('Feat benefit.')
})

it('hides Religious Talisman prerequisites in Starfinder feat description', () => {
  const prerequisite = 'Master in Religion; follower of a specific religion'
  const entry = mapAonHit({ _id: 'talisman', _source: { category: 'feat', name: 'Religious Talisman', level: 7,
    trait: ['General', 'Skill'], prerequisite, markdown: `**Prerequisites**\n${prerequisite}\n\n---\n\nFeat benefit.` } }, 'sf2e')!
  const markup = renderToStaticMarkup(<EntryDescription name={entry.name} entry={entry} />)
  expect(markup).not.toContain('Prerequisites')
  expect(markup).toContain('Feat benefit.')
})

it('shows Seek Injustice three-action icon inside its feat button without trackers', () => {
  const training: ContentEntry = { id: 'advanced-order', name: 'Advanced Order Training', level: 12, systems: ['pf2e'],
    kind: 'feat', source: 'official', traits: ['Archetype'], data: {}, description: 'Gain your greater order benefit.', effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), level: 12, dailyAbilityUses: { 'Seek Injustice': true }, activeFeatEffects: ['Seek Injustice'], feats: [
    { name: 'Hellknight Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0', choice: 'Order of the Scourge' },
    { name: training.name, type: 'Archetype Feat', level: 12, slot: 'archetype:12:0' },
  ] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[training]} categories={['archetype']} save={() => {}} />)
  expect(markup).toContain('Seek Injustice (Order of the Scourge)')
  expect(markup).toMatch(/<button[^>]*class="feat-name"[^>]*>Advanced Order Training[^<]* <span class="action-cost" aria-label="Three Actions"/)
  expect(markup).not.toContain('Seek Injustice active')
  expect(markup).not.toContain('Seek Injustice use')
  expect(markup).not.toContain('focus-point')
})

it('shows cross-training action cost inside the feat button for the chosen order', () => {
  const training: ContentEntry = { id: 'cross-training', name: 'Order Cross-Training', level: 10, systems: ['pf2e'],
    kind: 'feat', source: 'official', traits: ['Archetype'], data: {}, description: '', effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), level: 12, feats: [
    { name: 'Hellknight Dedication', type: 'Archetype Feat', level: 2, choice: 'Order of the Scourge' },
    { name: training.name, type: 'Archetype Feat', level: 10, slot: 'archetype:10:0', choice: 'Order of the Chain' },
  ] }
  const render = (character: Character) => renderToStaticMarkup(<FeatSlots c={character} entries={[training]} categories={['archetype']} save={() => {}} />)
  expect(render(c)).toMatch(/<button[^>]*class="feat-name"[^>]*>Order Cross-Training[^<]* <span class="action-cost" aria-label="Two Actions"/)
  const passive = { ...c, feats: [c.feats[0], { ...c.feats[1], choice: 'Order of the Rack' }] }
  expect(render(passive)).not.toContain('aria-label="Two Actions"')
  const torrent = { ...c, feats: [c.feats[0], { ...c.feats[1], choice: 'Order of the Torrent' }] }
  expect(render(torrent)).toMatch(/<button[^>]*class="feat-name"[^>]*>Order Cross-Training[^<]* <span class="action-cost" aria-label="Reaction"/)
})

it('counts a fixed background feat once and includes temporary granted skill feats', () => {
  const assurance: ContentEntry = { id: 'assurance-count', systems: ['pf2e', 'sf2e'], kind: 'feat', source: 'official',
    name: 'Assurance', level: 1, traits: ['General', 'Skill'], description: '', data: { repeatable: true }, effects: [], updatedAt: 0 }
  const render = (c: Character) => renderToStaticMarkup(<FeatSlots c={c} entries={[assurance]} categories={['skill']} save={() => {}} />)
  const c: Character = { ...emptyRanger(), level: 20, background: 'Scholar',
    feats: [{ name: 'Assurance', type: 'Skill Feat', level: 1, slot: 'skill:1:scholar', choice: 'Arcana' }] }
  expect(render(c)).toContain('Feat slots 1/11</h4>')
  const memory: Character = { ...emptyRanger(), systems: ['sf2e'], level: 20,
    feats: [{ name: 'Carry Their Memories', type: 'Ancestry Feat', level: 5 }] }
  expect(render(memory)).toContain('Feat slots 1/11</h4>')
  expect(render({ ...memory, feats: [{ ...memory.feats[0], takenLevel: 21 }] })).toContain('Feat slots 0/10</h4>')
})

it('shows fixed heritage-granted ancestry feats in the ancestry feat list', () => {
  const heritage: ContentEntry = { id: 'heritage-grant', name: 'Empty Sky Kitsune', kind: 'heritage', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Kitsune'], description: '', data: {
      ancestry: 'Kitsune', grants_heritage_feats: 'Kitsune Spell Familiarity',
    }, effects: [], updatedAt: 0 }
  const feat: ContentEntry = { id: 'kitsune-spell-familiarity', name: 'Kitsune Spell Familiarity', kind: 'feat',
    source: 'official', systems: ['pf2e'], level: 1, traits: ['Ancestry', 'Kitsune'], description: '', data: {}, effects: [], updatedAt: 0 }
  const daze: ContentEntry = { id: 'daze', name: 'Daze', kind: 'spell', source: 'official', systems: ['pf2e'],
    level: 0, traits: ['Cantrip'], description: '', data: { tradition: 'Divine' }, effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), ancestry: 'Kitsune', heritage: heritage.name,
    automaticFeatChoices: { [automaticFeatChoiceKey(heritage.name, feat.name)]: 'Daze' } }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[heritage, feat, daze]} categories={['ancestry']} save={() => {}} />)
  expect(markup).toContain('Kitsune Spell Familiarity')
  expect(markup).toContain('Empty Sky Kitsune')
  expect(markup).toContain('aria-label="Kitsune Spell Familiarity spell"')
  expect(markup).toContain('<option value="Daze" selected="">Daze</option>')
})

it('shows terrain selection for a heritage-granted Terrain Expertise feat', () => {
  const heritage = mapAonHit({ _id: 'heritage-deep-orc', _source: {
    category: 'heritage', name: 'Deep Orc', trait: ['Orc'],
    markdown: 'You gain the [Terrain Expertise](/Feats.aspx?ID=5223) skill feat.',
  } }, 'pf2e')!
  const c: Character = { ...emptyRanger(), ancestry: 'Orc', heritage: heritage.name,
    automaticFeatChoices: { [automaticFeatChoiceKey(heritage.name, 'Terrain Expertise')]: 'Underground' } }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[heritage]} categories={['skill']} save={() => {}} />)

  expect(markup).toContain('Terrain Expertise')
  expect(markup).toContain('aria-label="Terrain Expertise terrain"')
  expect(markup).toContain('<option selected="">Underground</option>')
})

it('shows editable Lore choice for a heritage-granted Additional Lore feat', () => {
  const heritage = mapAonHit({ _id: 'heritage-sage-jotunborn', _source: {
    category: 'heritage', name: 'Sage Jotunborn', trait: ['Jotunborn'],
    markdown: 'You gain the [Additional Lore](/Feats.aspx?ID=5114) general feat for a lore skill of your choice.',
  } }, 'pf2e')!
  const c: Character = { ...emptyRanger(), ancestry: 'Jotunborn', heritage: heritage.name,
    automaticFeatChoices: { [automaticFeatChoiceKey(heritage.name, 'Additional Lore')]: 'Sailing' } }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[heritage]} categories={['skill']} save={() => {}} />)

  expect(markup).toContain('Additional Lore')
  expect(markup).toContain('aria-label="Sage Jotunborn Additional Lore subcategory"')
  expect(markup).toContain('value="Sailing"')
})

it('renders two separately saved Damaya Self-Perfection Lore choices', () => {
  let c: Character = { ...emptyRanger(), systems: ['sf2e'], level: 17, ancestry: 'Lashunta',
    heritage: 'Damaya Lashunta', feats: [{ name: 'Damaya Self-Perfection', type: 'Ancestry Feat', level: 17, slot: 'ancestry:17:0' }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const keys = [1, 2].map(index => automaticFeatChoiceKey('Damaya Self-Perfection', 'Additional Lore', `ancestry:17:0:${index}`))
  const render = () => renderToStaticMarkup(<FeatSlots c={c} entries={[]} categories={['skill']} save={save} />)
  expect(render()).toContain('aria-label="Damaya Self-Perfection Additional Lore subcategory 1"')
  expect(render()).toContain('aria-label="Damaya Self-Perfection Additional Lore subcategory 2"')
  expect(render()).toContain('Legendary Professional')
  const saveChoice = (index: number, value: string) => {
    const control = AutomaticFeatChoice({ c, entries: [], save, name: 'Additional Lore',
      source: 'Damaya Self-Perfection', choiceKey: keys[index], choiceIndex: index + 1 })
    const input = Children.toArray(control!.props.children).find(child => isValidElement(child) && child.type === 'input')
    if (!isValidElement<{ onBlur: (event: unknown) => void }>(input)) throw new Error('Missing Lore input')
    const target = { value, setCustomValidity: vi.fn(), reportValidity: vi.fn() }
    input.props.onBlur({ target })
    return target
  }
  saveChoice(0, 'Engineering')
  const duplicate = saveChoice(1, 'engineering Lore')
  expect(duplicate.setCustomValidity).toHaveBeenCalledWith('Choose a different Lore subcategory.')
  expect(c.automaticFeatChoices?.[keys[1]]).toBeUndefined()
  saveChoice(1, 'Warfare')
  expect(c.automaticFeatChoices).toMatchObject({ [keys[0]]: 'Engineering', [keys[1]]: 'Warfare' })
  expect(ranksAt(c, [])).toMatchObject({ 'Engineering Lore': 4, 'Warfare Lore': 4 })
})

it('uses Iruxi Armaments variants without a trailing selector', () => {
  const c: Character = { ...emptyRanger(), ancestry: 'Lizardfolk', feats: [
    { name: 'Iruxi Armaments', type: 'Ancestry Feat', level: 1, choice: 'Claws' },
  ] }
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[]} save={() => {}} index={0} />)).toBe('')
})

it.each(['Nature, Astrology Lore', 'Nature, Lizardfolk Lore', 'Occultism, Astrology Lore', 'Occultism, Lizardfolk Lore'])(
  'selects Lizardfolk Lore (%s) without separate controls', choice => {
    const feat: ContentEntry = { id: 'lizardfolk-lore', name: 'Lizardfolk Lore', kind: 'feat', source: 'official',
      systems: ['pf2e'], level: 1, traits: ['Lizardfolk'], description: '', data: {}, effects: [], updatedAt: 0 }
    let c: Character = { ...emptyRanger(), ancestry: 'Lizardfolk', level: 1 }
    const tree = () => FeatSlots({ c, entries: [feat], categories: ['ancestry'], save: patch => { c = { ...c, ...patch } },
      search: { 'ancestry:1:0:open': '1' }, onSearch: () => {} })
    const label = `Lizardfolk Lore (${choice})`
    expect(renderToStaticMarkup(tree())).toContain(label)
    findButton(tree(), `L01 Ancestry: ${label}`)!()
    c = JSON.parse(JSON.stringify(c))
    expect(c.feats[0].choice).toBe(choice)
    expect(renderToStaticMarkup(tree())).toContain(label)
    expect(renderToStaticMarkup(<FeatChoice c={c} entries={[feat]} save={() => {}} index={0} />)).toBe('')
  },
)

it('selects Gnome Obsession Lore in the feat picker and shows both granted feats', () => {
  const feat: ContentEntry = { id: 'gnome-obsession', name: 'Gnome Obsession', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Gnome'], description: '', data: {}, effects: [], updatedAt: 0 }
  let c: Character = { ...emptyRanger(), ancestry: 'Gnome', level: 1 }
  const tree = () => FeatSlots({ c, entries: [feat], categories: ['ancestry'], save: patch => { c = { ...c, ...patch } },
    search: { 'ancestry:1:0:open': '1' }, onSearch: () => {} })
  expect(renderToStaticMarkup(tree())).toContain('Gnome Obsession (Circus Lore)')
  findButton(tree(), 'L01 Ancestry: Gnome Obsession (Circus Lore)')!()
  expect(c.feats[0].choice).toBe('Circus Lore')
  expect(ranksAt(c, [feat])['Circus Lore']).toBe(1)
  const skillFeats = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} categories={['skill']} save={() => {}} />)
  expect(skillFeats).toContain('Additional Lore (Circus)')
  expect(skillFeats).toContain('Assurance (Circus Lore)')
})

it('clears selected skill prerequisite warnings while planning without changing character skills', () => {
  const c: Character = { ...emptyRanger(), level: 20,
    skillPicks: ['Athletics'], skillIncreases: { 15: 'Athletics' },
    feats: [{ name: 'Nimble Athlete', type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
  const entries = homebrewCharacterOptions([])
  const before = JSON.stringify(c)
  const save = vi.fn()
  const render = () => renderToStaticMarkup(<FeatSlots c={c} entries={entries} save={save} categories={['class']} />)
  expect(render()).toContain('Prerequisites unmet: expert in Athletics')
  updateSettings({ planSkillPrerequisites: true })
  expect(render()).not.toContain('Prerequisites unmet: expert in Athletics')
  expect(renderToStaticMarkup(<FeatSlots c={{ ...c, skillIncreases: {} }} entries={entries} save={save} categories={['class']} />))
    .toContain('Prerequisites unmet: expert in Athletics')
  updateSettings({ planSkillPrerequisites: false })
  expect(render()).toContain('Prerequisites unmet: expert in Athletics')
  expect(save).not.toHaveBeenCalled()
  expect(JSON.stringify(c)).toBe(before)
})

it('hides Lead the Pack in the feat picker while the single companion rule is enabled', () => {
  const previous = getSettings().singleAnimalCompanion
  const feat: ContentEntry = { id: 'lead-the-pack', name: 'Lead the Pack', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 16, traits: ['Archetype'], description: '', data: {}, effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), level: 16 }
  const save = vi.fn()
  const tree = () => FeatSlots({ c, entries: [feat], save, categories: ['archetype'],
    search: { 'archetype:16:0:open': '1' } })
  const label = 'L16 Dedication: Lead the Pack'
  try {
    updateSettings({ singleAnimalCompanion: true })
    expect(renderToStaticMarkup(tree())).not.toContain(`aria-label="${label}`)
    expect(findButton(tree(), label)).toBeUndefined()
    expect(save).not.toHaveBeenCalled()
    updateSettings({ singleAnimalCompanion: false })
    expect(renderToStaticMarkup(tree())).toContain(`aria-label="${label}">`)
  } finally { updateSettings({ singleAnimalCompanion: previous }) }
})

it.each([undefined, 'Dermal Plating'])('uses Augmented Body only as extra implant capacity, ignoring legacy choice %s', choice => {
  const entry: ContentEntry = { id: 'augmented-body', name: 'Augmented Body', kind: 'feat', systems: ['sf2e'],
    source: 'official', level: 1, traits: ['General'], data: { repeatable: true }, description: '', effects: [], updatedAt: 1 }
  const c: Character = { ...emptyRanger(), systems: ['sf2e'], level: 3,
    feats: [{ name: entry.name, type: 'General Feat', level: 1, slot: 'general:3:0', choice }],
    augmentations: [{ id: 'plating', entryId: 'plating', name: 'Dermal Plating', slot: 'standard' }] }
  const before = JSON.stringify(c)
  const save = vi.fn()
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[entry]} save={save} index={0} />)).toBe('')
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[entry]} save={save} categories={['general']} />)
  expect(markup).not.toContain('Augmented Body (Dermal Plating)')
  expect(builder.augmentationLimit(c)).toBe(5)
  expect(builder.augmentationLimitUsed(c)).toBe(1)
  expect(save).not.toHaveBeenCalled()
  expect(JSON.stringify(c)).toBe(before)
})

it('grants Direwolf Bonded a separate Canny Acumen choice slot with normal proficiency scaling', () => {
  const feat = (name: string): ContentEntry => ({ id: name, systems: ['pf2e'], kind: 'feat', source: 'official',
    name, level: 1, traits: ['General'], description: '', data: {}, effects: [], updatedAt: 0 })
  const entries: ContentEntry[] = [
    { ...feat('Direwolf Bonded'), kind: 'background', source: 'homebrew', data: { feat: 'Canny Acumen, Titan Wrestler' } },
    feat('Canny Acumen'), feat('Toughness'),
  ]
  let c: Character = { ...emptyRanger(), level: 1, background: 'Direwolf Bonded', feats: [] }
  const key = 'general:1:direwolf-bonded'
  const tree = () => FeatSlots({ c, entries, categories: ['general'], save: patch => { c = { ...c, ...patch } } })
  const slot = plannedSlots(c).find(slot => slot.key === key)!
  expect(slot).toMatchObject({ category: 'general', level: 1, grantedFeat: 'Canny Acumen' })
  expect(eligibleFeats(entries, c, slot).map(feat => feat.name)).toEqual(['Canny Acumen'])
  expect(renderToStaticMarkup(tree())).toContain('<option value="" selected="">- empty -</option>')
  const popup = (open: boolean) => FeatSlots({ c, entries, categories: ['general'], save: patch => { c = { ...c, ...patch } },
    search: { [`${key}:open`]: open ? '1' : '' }, onSearch: () => {} })
  expect(renderToStaticMarkup(popup(false))).toContain('aria-haspopup="dialog" aria-expanded="false">- empty -</button>')
  const popupMarkup = renderToStaticMarkup(popup(true))
  expect(popupMarkup).toContain('L01 General: Canny Acumen (Will)')
  expect(popupMarkup).not.toContain('L01 General: Toughness')
  const choose = findSelect(tree(), 'L01 General feat')!
  choose({ target: { value: 'Toughness' } })
  expect(c.feats).toEqual([])
  choose({ target: { value: JSON.stringify(['Canny Acumen', 'Will']) } })
  expect(c.feats).toEqual([expect.objectContaining({ name: 'Canny Acumen', choice: 'Will', slot: key, type: 'General Feat' })])
  c = JSON.parse(JSON.stringify(c))
  expect(ranksAt(c, entries).Will).toBe(2)
  expect(ranksAt({ ...c, level: 17 }, entries).Will).toBe(3)
  expect(renderToStaticMarkup(tree())).toContain('Canny Acumen (Will)')
  expect(renderToStaticMarkup(tree())).not.toContain('background-feat-row')
  expect(plannedSlots({ ...c, dismissedFeatSlots: [key] }).some(slot => slot.key === key)).toBe(true)
  expect(plannedSlots({ ...c, background: 'Other' }).some(slot => slot.key === key)).toBe(false)
  expect(c.extraSlots).toEqual([])
})

it('grants Scholar exactly one persistent skill slot restricted to trained Assurance variants', () => {
  const assurance: ContentEntry = { id: 'assurance', name: 'Assurance', kind: 'feat', systems: ['pf2e'],
    source: 'official', level: 1, traits: ['General', 'Skill'], description: '',
    data: { repeatable: true }, effects: [], updatedAt: 0 }
  const entries: ContentEntry[] = [
    { ...assurance, id: 'scholar', name: 'Scholar', kind: 'background', traits: [],
      data: { feat: 'Assurance', skill: 'Arcana, Academia Lore' } },
    assurance, { ...assurance, id: 'other', name: 'Other Skill', data: {} },
  ]
  let c: Character = { ...emptyRanger(), level: 1, background: 'Scholar' }
  const tree = () => FeatSlots({ c, entries, categories: ['skill'], save: patch => { c = { ...c, ...patch } } })
  const key = 'skill:1:scholar'
  const slot = plannedSlots(c, entries).find(slot => slot.key === key)!
  expect(slot).toMatchObject({ category: 'skill', level: 1, grantedBy: 'Scholar', grantedFeat: 'Assurance' })
  expect(eligibleFeats(entries, c, slot).map(feat => feat.name)).toEqual(['Assurance'])
  const choose = findSelect(tree(), 'L01 Skill feat')!
  choose({ target: { value: 'Other Skill' } })
  choose({ target: { value: JSON.stringify(['Assurance', 'Stealth']) } })
  expect(c.feats).toEqual([])
  choose({ target: { value: JSON.stringify(['Assurance', 'Arcana']) } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats).toEqual([expect.objectContaining({ name: 'Assurance', choice: 'Arcana', slot: key })])
  expect(renderToStaticMarkup(tree())).toContain('Assurance (Arcana)')
  expect(renderToStaticMarkup(tree())).not.toContain('background-feat-row')
  expect(renderToStaticMarkup(tree())).not.toContain('aria-label="Assurance choice"')
  findButton(tree(), 'Clear L01 Skill feat selection')!()
  expect(c.feats).toEqual([])
  expect(plannedSlots({ ...c, dismissedFeatSlots: [key] }, entries).filter(slot => slot.key === key)).toHaveLength(1)
  expect(plannedSlots({ ...c, background: 'Scout' }, entries).some(slot => slot.key === key)).toBe(false)
  expect(c.extraSlots).toEqual([])
})

it('picks researched spell resistance combinations as variants and restores saved tradition order', () => {
  const feat: ContentEntry = { id: 'researched', name: 'Researched Spell Resistance', kind: 'feat', systems: ['pf2e'],
    source: 'homebrew', level: 13, traits: ['Dwarf'], description: '', data: {}, effects: [], updatedAt: 0 }
  let c: Character = { ...emptyRanger(), ancestry: 'Dwarf', level: 13, rankOverrides: { Arcana: 3, Nature: 1 } }
  const tree = () => FeatSlots({ c, entries: [feat], categories: ['ancestry'], save: patch => { c = { ...c, ...patch } } })
  const choose = findSelect(tree(), 'L13 Ancestry feat')!
  expect(renderToStaticMarkup(tree())).toContain('Researched Spell Resistance (Arcane, Primal)')
  choose({ target: { value: JSON.stringify([feat.name, 'Primal']) } })
  expect(c.feats).toEqual([])
  choose({ target: { value: JSON.stringify([feat.name, 'Arcane, Primal']) } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats).toEqual([expect.objectContaining({ name: feat.name, choice: 'Arcane, Primal', slot: 'ancestry:13:0' })])
  expect(builder.researchedSpellResistance(c, [feat])?.traditions).toEqual(['Arcane', 'Primal'])
  expect(renderToStaticMarkup(tree())).not.toContain('Researched Spell Resistance tradition')
  expect(renderToStaticMarkup(tree())).not.toContain('First tradition requires Expert')
})

it('saves and reloads a level-five duplicate Titan Wrestler replacement, and cleans it up with its source', () => {
  const feat = (name: string, traits = ['General', 'Skill']): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits, description: '', data: {}, effects: [], updatedAt: 0,
  })
  const entries: ContentEntry[] = [
    { ...feat('Direwolf Bonded'), kind: 'background', data: { feat: 'Canny Acumen, Titan Wrestler' } },
    feat('Titan Wrestler'), feat('Replacement Skill'), feat('Canny Acumen', ['General']),
    { ...feat('Broken Hand Technique', ['Human']), systems: ['sf2e'] },
    feat('Keep Skill'),
  ]
  let c: Character = { ...emptyRanger(), systems: ['pf2e', 'sf2e'], level: 5, background: 'Direwolf Bonded', feats: [
    { name: 'Broken Hand Technique', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' },
    { name: 'Keep Skill', type: 'Skill Feat', level: 1, slot: 'skill:2:0' },
    { name: 'Canny Acumen', type: 'General Feat', level: 1, choice: 'Will', slot: 'general:1:direwolf-bonded' },
  ], entryIds: ['Broken Hand Technique', 'Keep Skill', 'Canny Acumen'] }
  const tree = (categories: Array<'skill' | 'ancestry'> = ['skill']) =>
    FeatSlots({ c, entries, categories, save: patch => { c = { ...c, ...patch } } })
  const [slot] = plannedSlots(c, entries).filter(slot => slot.redundantFeat)
  expect(slot).toMatchObject({ level: 5, category: 'skill' })
  expect(renderToStaticMarkup(tree())).toContain('Empty (Broken Hand Technique)')
  expect(renderToStaticMarkup(tree())).not.toContain('Duplicate Titan Wrestler')
  findSelect(tree(), 'L05 Skill feat')!({ target: { value: 'Titan Wrestler' } })
  expect(c.feats.some(feat => feat.slot === slot.key)).toBe(false)
  findSelect(tree(), 'L05 Skill feat')!({ target: { value: 'Replacement Skill' } })
  c = JSON.parse(JSON.stringify(c))
  const selected = c.feats.find(feat => feat.slot === slot.key)!
  expect(selected).toMatchObject({ name: 'Replacement Skill', type: 'Skill Feat', slot: slot.key })
  expect(builder.featTakenLevel(selected)).toBe(5)
  expect(renderToStaticMarkup(tree())).toContain('Replacement Skill')
  expect(unslottedFeats(c, entries)).not.toContainEqual(selected)
  expect(unslottedFeats({ ...c, level: 4 }, entries)).not.toContainEqual(selected)
  expect(unslottedFeats({ ...c, background: undefined }, entries)).toContainEqual(selected)
  findButton(tree(), 'Clear L05 Skill feat selection')!()
  expect(c.feats.some(feat => feat.slot === slot.key)).toBe(false)
  expect(plannedSlots(c, entries).some(replacement => replacement.key === slot.key)).toBe(true)
  findSelect(tree(), 'L05 Skill feat')!({ target: { value: 'Replacement Skill' } })
  findButton(tree(['ancestry']), 'Clear L05 Ancestry feat selection')!()
  expect(c.feats.map(feat => feat.name)).toEqual(['Keep Skill', 'Canny Acumen'])
  expect(c.entryIds).toEqual(['Keep Skill', 'Canny Acumen'])
  expect(plannedSlots(c, entries).some(replacement => replacement.redundantFeat)).toBe(false)
})

it('keeps chained Orc Kinship labels shortened in the picker and saved feat without changing identity', () => {
  const source: ContentEntry = { id: 'orc-ferocity', name: 'Orc Ferocity', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 1, traits: ['Orc'], description: 'Orc Ferocity rules.', data: {}, effects: [], updatedAt: 0 }
  let c: Character = { ...emptyRanger(), ancestry: 'Human', level: 9, feats: [
    { name: 'Social Chameleon', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' },
    { name: 'Adopted Ancestry', type: 'General Feat', level: 1, takenLevel: 5, choice: 'Dwarf',
      slot: 'general:1:social-chameleon:ancestry:5:0' },
    { name: 'Orc Kinship', type: 'Ancestry Feat', level: 1, takenLevel: 5,
      slot: 'ancestry:1:social-chameleon:ancestry:5:0' },
  ] }
  const before = JSON.stringify(source)
  const tree = () => FeatSlots({ c, entries: [source], categories: ['ancestry'],
    search: { 'ancestry:9:0:open': '1', 'ancestry:9:0:query': 'ferocity' }, onSearch: () => {},
    save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain('L09 Ancestry: Ferocity')
  findButton(tree(), 'L09 Ancestry: Ferocity')!()
  expect(c.feats.find(feat => feat.name === source.name)).toMatchObject({
    name: 'Orc Ferocity', sourceId: source.id, slot: 'ancestry:9:0',
  })
  c = JSON.parse(JSON.stringify(c))
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('>Ferocity</button>')
  expect(markup).not.toContain('>Orc Ferocity</button>')
  expect(JSON.stringify(source)).toBe(before)
})

it('searches adopted Orc Tusks as Teeth while saving and reloading canonical feat identity', () => {
  const tusks: ContentEntry = { id: 'aon:pf2e:feat-4519', name: 'Tusks', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 1, traits: ['Orc'], description: 'Your tusks deal 1d6 piercing damage. Each tusk has finesse and unarmed traits.',
    data: {}, effects: [], updatedAt: 0 }
  let c: Character = { ...emptyRanger(), ancestry: 'Human', level: 1, feats: [
    { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' },
  ] }
  const source = JSON.stringify(tusks)
  const tree = () => FeatSlots({ c, entries: [tusks], categories: ['ancestry'],
    search: { 'ancestry:1:0:open': '1', 'ancestry:1:0:query': 'teeth' }, onSearch: () => {},
    save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain('L01 Ancestry: Teeth')
  findButton(tree(), 'L01 Ancestry: Teeth')!()
  expect(c.feats.find(feat => feat.name === 'Tusks')).toMatchObject({
    name: 'Tusks', sourceId: tusks.id, slot: 'ancestry:1:0',
  })
  c = JSON.parse(JSON.stringify(c))
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('>Teeth<')
  expect(markup).toContain('Your teeth deal 1d6 piercing damage. Each tooth has finesse and unarmed traits.')
  expect(JSON.stringify(tusks)).toBe(source)
})

it.each(['Cold Iron', 'Silver', 'Adamantine'])('keeps %s material off base feat names and dialog titles', material => {
  const feat = (name: string): ContentEntry => ({ id: name, name, kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 1, traits: ['Orc'], description: `${name} rules.`, data: {}, effects: [], updatedAt: 0 })
  const c: Character = { ...emptyRanger(), ancestry: 'Human', level: 13, extraSlots: [{ category: 'ancestry', level: 1, count: 1 }], feats: [
    { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' },
    { name: 'Tusks', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
    { name: 'Iron Fists', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:1' },
    { name: 'Alloyed Attacks', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: material },
  ] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat('Tusks'), feat('Iron Fists')]} categories={['ancestry']} save={() => {}} />)
  expect(markup).toContain('>Teeth<')
  expect(markup).toContain('>Iron Fists<')
  expect(markup).not.toContain(`${material} Teeth`)
  expect(markup).not.toContain(`${material} Iron Fists`)
})

it('reuses selected prerequisite checks for empty slots and invalidates changed rules, settings and content', () => {
  const source: ContentEntry = { id: 'target', name: 'Target', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 1, traits: ['Ranger'], description: '', data: { prerequisite: 'Strength +4' }, effects: [], updatedAt: 0 }
  let entries = [source]
  let c: Character = { ...emptyRanger(), feats: [{ name: source.name, type: 'Class Feat', level: 1, slot: 'class:1:0' }] }
  const check = vi.spyOn(builder, 'featSelectionPrerequisiteChecker')
  const previous = getSettings().autoLores
  const render = () => renderToStaticMarkup(<FeatSlots c={c} entries={entries} categories={['class']} save={() => {}} onSearch={() => {}} />)
  try {
    render()
    expect(check).toHaveBeenCalledTimes(1)
    c = JSON.parse(JSON.stringify({ ...c, extraSlots: [{ category: 'class', level: 1, count: 1 }], dismissedFeatSlots: [], updatedAt: 1 }))
    render()
    expect(check).toHaveBeenCalledTimes(1)
    c = { ...c, abilities: { ...c.abilities, str: 18 } }
    render()
    expect(check).toHaveBeenCalledTimes(2)
    updateSettings({ autoLores: !previous })
    render()
    expect(check).toHaveBeenCalledTimes(3)
    entries = [{ ...source, data: { prerequisite: 'Dexterity +4' } }]
    render()
    expect(check).toHaveBeenCalledTimes(4)
  } finally { check.mockRestore(); updateSettings({ autoLores: previous }) }
})

it('keeps a saved adopted ancestry disabled only for an unmet specific Access requirement', () => {
  const ancestry: ContentEntry = { id: 'automaton', name: 'Automaton', kind: 'ancestry', source: 'official', systems: ['pf2e'],
    level: 1, traits: ['Rare'], description: '', data: { access: 'Kellid ethnicity' }, effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), ancestry: 'Human', feats: [
    { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: ancestry.name },
  ] }
  const save = vi.fn()
  const render = (character = c, entry = ancestry) => renderToStaticMarkup(<FeatChoice c={character} entries={[entry]} save={save} index={0} />)
  const markup = render()
  expect(markup).toContain('Ancestry: Automaton (unavailable)')
  expect(markup).toMatch(/<option[^>]*disabled=""[^>]*value="Automaton"/)
  expect(markup).toContain('Saved ancestry is unavailable.')
  const approved = render({ ...c, featAccessOverrides: [ancestry.id] })
  expect(approved).not.toContain('(unavailable)')
  expect(approved).not.toContain('Saved ancestry is unavailable.')
  expect(render(c, { ...ancestry, data: {} })).not.toContain('(unavailable)')
  expect(save).not.toHaveBeenCalled()
  expect(c.feats[0].choice).toBe(ancestry.name)
})

it('shows one Additional Lore per skill and prefers the specific ancestry source', () => {
  const c: Character = { ...emptyRanger(), systems: ['sf2e'], ancestry: 'Ysoki', level: 7,
    feats: [
      { name: 'Ancestral Skills', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
      { name: 'Ysoki Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' },
      { name: "Grandmother's Lore", type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:1' },
    ] }
  for (const feats of [c.feats, [...c.feats].reverse()]) {
    const markup = renderToStaticMarkup(<FeatSlots c={{ ...c, feats }} entries={[]} categories={['skill']} save={() => {}} />)
    expect(markup.match(/>Additional Lore \(Ysoki\) <small>/g)).toHaveLength(1)
    expect(markup).toContain('Additional Lore (Lao Shu Po)')
    expect(markup).toContain('Ysoki Lore')
    expect(markup).not.toContain('Ancestral Skills')
  }
  const earlier = renderToStaticMarkup(<FeatSlots c={{ ...c, level: 1 }} entries={[]} categories={['skill']} save={() => {}} />)
  expect(earlier).toContain('Additional Lore (Ysoki)')
  expect(earlier).toContain('Ancestral Skills')
})

it('labels fixed ancestral cantrips and creature speech without extra choices', () => {
  const cantrip = mapAonHit({ _id: 'ysoki-cantrip', _source: { name: 'Ancestral Cantrip', category: 'feat', level: 1,
    trait: ['Ysoki'], markdown: 'Header\n\n---\n\n**[Option(s)](/feats/1)**: occult; _[seek the stars](/spells/1)_' } }, 'sf2e')!
  const speech = mapAonHit({ _id: 'ysoki-speech', _source: { name: 'Creature Speech', category: 'feat', level: 1,
    trait: ['Ysoki'], markdown: 'Header\n\n---\n\n**[Option(s)](/feats/1)**: rodents' } }, 'sf2e')!
  const c: Character = { ...emptyRanger(), systems: ['sf2e'], ancestry: 'Ysoki', level: 1,
    feats: [{ name: 'Creature Speech', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[cantrip, speech]} categories={['ancestry']} save={() => {}} />)
  expect(markup).toContain('Creature Speech (Rats)')
  expect(renderToStaticMarkup(<FeatSlots c={{ ...c, feats: [] }} entries={[cantrip, speech]} categories={['ancestry']} save={() => {}} />))
    .toContain('Ancestral Cantrip (Seek The Stars)')
  const selected = { ...c, feats: [{ ...c.feats[0], name: 'Ancestral Cantrip' }] }
  expect(renderToStaticMarkup(<FeatSlots c={selected} entries={[cantrip, speech]} categories={['ancestry']} save={() => {}} />))
    .toContain('Ancestral Cantrip (Seek The Stars)')
  const adopted: Character = { ...c, ancestry: 'Human', feats: [
    { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Ysoki' },
    { ...c.feats[0], sourceId: speech.id },
  ] }
  expect(renderToStaticMarkup(<FeatSlots c={adopted} entries={[cantrip, speech]} categories={['ancestry']} save={() => {}} />))
    .toContain('Creature Speech (Rats)')
})

it("keeps Officer's Education general slots tied to their source feats", () => {
  const education: ContentEntry = { id: 'education', name: "Officer's Education", kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 8, traits: ['Commander'], description: '', data: { repeatable: true }, effects: [], updatedAt: 0 }
  const general: ContentEntry = { ...education, id: 'general', name: 'Advanced General', level: 7, traits: ['General'], data: {} }
  let c: Character = { ...emptyRanger(), className: 'Commander', level: 12, feats: [
    { name: education.name, type: 'Class Feat', level: 8, slot: 'class:8:0' },
    { name: education.name, type: 'Class Feat', level: 8, slot: 'class:12:0' },
  ] }
  const tree = (categories: ('class' | 'general')[]) => FeatSlots({ c, entries: [education, general], categories,
    save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree(['class']))).not.toContain("Officer's Education choice")
  findSelect(tree(['general']), 'L08 General feat')!({ target: { value: general.name } })
  expect(c.feats.find(feat => feat.name === general.name)).toMatchObject({
    slot: 'general:1:officer-education:class:8:0', takenLevel: 8,
  })
  findButton(tree(['class']), 'Clear L08 Class feat selection')!()
  expect(c.feats.map(feat => feat.name)).toEqual([education.name])
  expect(plannedSlots(c).filter(slot => slot.grantedBy === education.name).map(slot => slot.level)).toEqual([12])
})

it('persists Social Chameleon choices in normal feat sections and clears dependent grants', () => {
  const previous = getSettings().disableAdoptedAncestry
  onTestFinished(() => updateSettings({ disableAdoptedAncestry: previous }))
  updateSettings({ disableAdoptedAncestry: false })
  const chameleon: ContentEntry = { id: 'chameleon', name: 'Social Chameleon', kind: 'feat', source: 'official',
    systems: ['sf2e'], level: 5, traits: ['Human'], description: '', data: {}, effects: [], updatedAt: 0 }
  const adopted: ContentEntry = { ...chameleon, id: 'adopted', name: 'Adopted Ancestry', level: 1, traits: ['General'] }
  const elf: ContentEntry = { ...chameleon, id: 'elf', kind: 'ancestry', name: 'Elf', level: 1, traits: [] }
  const elfFeat: ContentEntry = { ...chameleon, id: 'elf-feat', name: 'Elf Training', level: 1, traits: ['Elf'] }
  const entries = [chameleon, adopted, elf, elfFeat]
  let c: Character = { ...emptyRanger(), ancestry: 'Human', systems: ['sf2e'], level: 5,
    feats: [{ name: chameleon.name, type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' }] }
  const tree = (categories: ('ancestry' | 'general' | 'skill')[]) => FeatSlots({ c, entries, categories,
    save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree(['general']))).not.toContain('Social Chameleon: choose Adopted Ancestry.')
  expect(renderToStaticMarkup(tree(['ancestry']))).not.toContain('Choose Adopted Ancestry in General Feats first.')
  expect(renderToStaticMarkup(tree(['skill']))).not.toContain('Social Chameleon')
  findSelect(tree(['general']), 'L05 General feat')!({ target: { value: JSON.stringify(['Adopted Ancestry', 'Elf']) } })
  expect(c.feats.find(feat => feat.name === adopted.name)).toMatchObject({
    type: 'General Feat', choice: 'Elf', takenLevel: 5, slot: 'general:1:social-chameleon:ancestry:5:0',
  })

  expect(renderToStaticMarkup(tree(['ancestry']))).not.toContain('Social Chameleon: common level-1 Elf feat.')
  findSelect(tree(['ancestry']), 'L05 Ancestry feat')!({ target: { value: elfFeat.name } })
  expect(c.feats.find(feat => feat.name === elfFeat.name)).toMatchObject({
    type: 'Ancestry Feat', takenLevel: 5, slot: 'ancestry:1:social-chameleon:ancestry:5:0',
  })
  c = JSON.parse(JSON.stringify(c)) as Character
  expect(renderToStaticMarkup(tree(['general']))).toContain('Adopted Ancestry (Elf)')
  expect(renderToStaticMarkup(tree(['general']))).not.toContain('(Social Chameleon)')
  expect(renderToStaticMarkup(tree(['ancestry']))).toContain('Elf Training')
  expect(renderToStaticMarkup(tree(['ancestry']))).not.toContain('(Social Chameleon)')
  findButton(tree(['general']), 'Clear L05 General feat selection')!()
  expect(c.feats.map(feat => feat.name)).toEqual([chameleon.name])
  expect(c.entryIds).not.toContain(elfFeat.id)
  findSelect(tree(['general']), 'L05 General feat')!({ target: { value: JSON.stringify(['Adopted Ancestry', 'Elf']) } })
  findSelect(tree(['ancestry']), 'L05 Ancestry feat')!({ target: { value: elfFeat.name } })
  findButton(tree(['ancestry']), 'Remove L05 Ancestry feat slot 0')!()
  expect(c.feats).toEqual([])
  expect(c.entryIds).not.toContain(adopted.id)
  expect(c.entryIds).not.toContain(elfFeat.id)
  expect(plannedSlots(c).some(slot => slot.grantedBy === chameleon.name)).toBe(false)
})

it('selects and replaces In Another Life ancestry feats and removes the grant with its source', () => {
  const source: ContentEntry = { id: 'another-life', name: 'In Another Life', kind: 'feat', source: 'official',
    systems: ['sf2e'], level: 12, traits: ['Witchwarper'], description: '', data: {}, effects: [], updatedAt: 0 }
  const first: ContentEntry = { ...source, id: 'human-first', name: 'Human First', level: 1, traits: ['Human'] }
  const second: ContentEntry = { ...first, id: 'human-second', name: 'Human Second' }
  let c: Character = { ...emptyRanger(), systems: ['sf2e'], className: 'Witchwarper', ancestry: 'Human', level: 12,
    feats: [{ name: source.name, type: 'Class Feat', level: 12, slot: 'class:12:0' }] }
  const tree = (categories: ('ancestry' | 'class')[]) => FeatSlots({ c, entries: [source, first, second], categories,
    save: patch => { c = { ...c, ...patch } } })
  findSelect(tree(['ancestry']), 'L12 Ancestry feat')!({ target: { value: first.name } })
  expect(c.feats.find(feat => feat.name === first.name)).toMatchObject({ slot: 'ancestry:1:in-another-life', takenLevel: 12 })
  findButton(tree(['ancestry']), 'Clear L12 Ancestry feat selection')!()
  findSelect(tree(['ancestry']), 'L12 Ancestry feat')!({ target: { value: second.name } })
  expect(c.feats.some(feat => feat.name === first.name)).toBe(false)
  expect(c.feats.some(feat => feat.name === second.name)).toBe(true)
  findButton(tree(['class']), 'Clear L12 Class feat selection')!()
  expect(c.feats).toEqual([])
})

it("shows Battle Medicine granted by Officer's Medical Training", () => {
  const battleMedicine: ContentEntry = { id: 'feat-5125', name: 'Battle Medicine', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['General', 'Healing', 'Manipulate', 'Skill'],
    description: 'Patch up wounds in combat.', data: {}, effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), className: 'Commander', level: 1,
    feats: [{ name: "Officer's Medical Training", type: 'Class Feat', level: 1, slot: 'class:1:0' }] }
  const entries = [battleMedicine]
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={entries} categories={['skill']} save={() => {}} />)
  expect(markup).toContain('Battle Medicine')
  expect(markup).toContain('Officer&#x27;s Medical Training')
  expect(markup).toContain(battleMedicine.description)
  const source = renderToStaticMarkup(<FeatSlots c={c} entries={entries} categories={['class']} save={() => {}} />)
  expect(source).not.toContain('Battle Medicine')
  const selected: Character = { ...c, feats: [...c.feats, { name: 'Battle Medicine', type: 'Skill Feat', level: 1, slot: 'skill:1:0' }] }
  const selectedMarkup = renderToStaticMarkup(<FeatSlots c={selected} entries={entries} categories={['skill']} save={() => {}} />)
  expect(selectedMarkup).not.toContain('automatic-feat-row')
})

it('hides removal for an automatic Order Explorer feat but preserves alternative choices', () => {
  const fire: ContentEntry = { id: 'fire-lung', name: 'Fire Lung', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Druid'], description: '', data: { prerequisite: 'flame order' }, effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), className: 'Druid', order: 'Animal', level: 2,
    feats: [{ name: 'Order Explorer', type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Flame' },
      { name: 'Fire Lung', type: 'Class Feat', level: 1, takenLevel: 2, slot: 'class:1:order-explorer:class:2:0' }] }
  const row = (entries: ContentEntry[]) => {
    const markup = renderToStaticMarkup(<FeatSlots c={c} entries={entries} categories={['class']} save={() => {}} />)
    return markup.match(/<li class="feat-slot-row[^"]*">(?:(?!<\/li>)[\s\S])*Fire Lung(?:(?!<\/li>)[\s\S])*<\/li>/)?.[0] ?? ''
  }
  expect(row([fire])).toContain('Fire Lung')
  expect(row([fire])).not.toContain('Clear L02 Class feat selection')
  expect(row([fire, { ...fire, id: 'other', name: 'Other Flame Feat' }])).toContain('Clear L02 Class feat selection')
})

it('lists the second Ubiquitous Gadgets selection at level 14', () => {
  const ubiquitous: ContentEntry = { id: 'ubiquitous-gadgets', name: 'Ubiquitous Gadgets', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 8, traits: ['Inventor'], description: '', data: { prerequisite: 'Gadget Specialist' }, effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), className: 'Inventor', level: 14, feats: [
    { name: 'Gadget Specialist', type: 'Class Feat', level: 4, slot: 'class:4:0' },
    { name: 'Ubiquitous Gadgets', type: 'Class Feat', level: 8, slot: 'class:8:0' },
  ] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[ubiquitous]} categories={['class']} save={() => {}}
    search={{ 'class:14:0:open': '1' }} onSearch={() => {}} />)
  expect(markup).toContain('<li class="feat-modal-level">L14</li>')
  expect(markup).not.toContain('<li class="feat-modal-level">L08</li>')
})

it('selects Free Heart without choosing a background in the feat picker', () => {
  const feat: ContentEntry = { id: 'free-heart', name: 'Free Heart', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Elf'], description: '', data: {}, effects: [], updatedAt: 0 }
  const background: ContentEntry = { ...feat, id: 'performer', name: 'Performer', kind: 'background', traits: [] }
  let c: Character = { ...emptyRanger(), ancestry: 'Elf', level: 1 }
  const tree = () => FeatSlots({ c, entries: [feat, background], categories: ['ancestry'], save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain('>Free Heart</option>')
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: 'Free Heart' } })
  expect(c.feats[0]).toMatchObject({ name: 'Free Heart' })
  expect(c.feats[0].choice).toBeUndefined()
  expect(renderToStaticMarkup(tree())).not.toContain('aria-label="Free Heart background"')
})

it('does not show a damage choice for Elemental Wrath, including old saved choices', () => {
  const feat: ContentEntry = { id: 'elemental-wrath', name: 'Elemental Wrath', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Elf'], description: '', data: {}, effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), ancestry: 'Elf', level: 1,
    feats: [{ name: feat.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'Fire' }] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} categories={['ancestry']} save={() => {}} />)
  expect(markup).not.toContain('Elemental Wrath (Fire)')
  expect(markup).not.toContain('Elemental Wrath damage type')
  expect(markup).toContain('grants Caustic Blast with its normal acid damage')
})

it('does not show an Elf ancestral weapon familiarity choice even with repeatable namesakes and saved choices', () => {
  const elf: ContentEntry = { id: 'elf-familiarity', name: 'Ancestral Weapon Familiarity', kind: 'feat', source: 'official',
    systems: ['sf2e'], level: 1, traits: ['Elf'], description: '', data: {}, effects: [], updatedAt: 0 }
  const astrazoan: ContentEntry = { ...elf, id: 'astrazoan-familiarity', traits: ['Astrazoan'], data: { repeatable: true } }
  const c: Character = { ...emptyRanger(), systems: ['sf2e'], ancestry: 'Elf', level: 1,
    feats: [{ name: elf.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'all bows' }] }
  const entries = [elf, astrazoan]
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={entries} save={() => {}} index={0} />)).toBe('')
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={entries} categories={['ancestry']} save={() => {}} />)
  expect(markup).not.toContain('Ancestral Weapon Familiarity (all bows)')
  expect(markup).not.toContain('aria-label="Ancestral Weapon Familiarity choice"')
  expect(renderToStaticMarkup(<FeatChoice c={{ ...c, ancestry: 'Astrazoan' }} entries={entries} save={() => {}} index={0} />))
    .toContain('aria-label="Ancestral Weapon Familiarity choice"')
})

it('does not request or display a choice for repeatable Distant Telepath', () => {
  const feat: ContentEntry = { id: 'distant-telepath', name: 'Distant Telepath', kind: 'feat', source: 'official',
    systems: ['sf2e'], level: 1, traits: ['Lashunta'], description: '', data: { repeatable: true }, effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), systems: ['sf2e'], ancestry: 'Lashunta', level: 5,
    feats: [{ name: feat.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'old choice' }] }
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[feat]} save={() => {}} index={0} />)).toBe('')
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} categories={['ancestry']} save={() => {}} />)
  expect(markup).not.toContain('Distant Telepath (old choice)')
  expect(markup).not.toContain('aria-label="Distant Telepath choice"')
})

it('hides weapon choices for adopted Dwarf familiarity despite repeatable namesakes', () => {
  const dwarf: ContentEntry = { id: 'dwarf-familiarity', name: 'Ancestral Weapon Familiarity', kind: 'feat', source: 'official',
    systems: ['sf2e'], level: 1, traits: ['Dwarf'], description: 'Option(s): artillery laser, hammer', data: {}, effects: [], updatedAt: 0 }
  const astrazoan: ContentEntry = { ...dwarf, id: 'astrazoan-familiarity', traits: ['Astrazoan'], data: { repeatable: true } }
  const c: Character = { ...emptyRanger(), systems: ['sf2e'], ancestry: 'Human', level: 5, feats: [
    { name: 'Adopted Ancestry', type: 'General Feat', level: 1, takenLevel: 5, choice: 'Dwarf' },
    { name: dwarf.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0', sourceId: dwarf.id, choice: 'Artillery Laser' },
  ] }
  const entries = [astrazoan, dwarf]
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={entries} save={() => {}} index={1} />)).toBe('')
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={entries} categories={['ancestry']} save={() => {}} />)
  expect(markup).not.toContain('Ancestral Weapon Familiarity (Artillery Laser)')
  expect(markup).not.toContain('aria-label="Ancestral Weapon Familiarity choice"')
})

it('shows and searches distinct Versatile Rogue racket options', () => {
  const feat: ContentEntry = { id: 'versatile', name: 'Versatile Rogue', kind: 'feat', source: 'homebrew',
    systems: ['pf2e'], level: 10, traits: ['Rogue'], description: '', data: { repeatable: true }, effects: [], updatedAt: 0 }
  let c: Character = { ...emptyRanger(), className: 'Rogue', subclass: 'Thief', level: 10 }
  const racket: ContentEntry = { ...feat, id: 'ruffian', kind: 'subclass', name: 'Ruffian',
    description: 'Ruffian racket benefits.', data: { class: 'Rogue' } }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => FeatSlots({ c, entries: [feat, racket], categories: ['class'], save,
    search: { 'class:10:0:open': '1', 'class:10:0:query': 'ruffian' }, onSearch: () => {} })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('L10 Class: Versatile Rogue (Ruffian)')
  expect(markup).toContain('Ruffian racket benefits.')
  expect(markup).not.toContain('L10 Class: Versatile Rogue (Scoundrel)')
  findButton(tree(), 'L10 Class: Versatile Rogue (Ruffian)')!()
  expect(c.feats[0]).toMatchObject({ name: 'Versatile Rogue', choice: 'Ruffian', slot: 'class:10:0' })
  expect(renderToStaticMarkup(tree())).toContain('Ruffian racket benefits.')
})

it.each([
  { name: 'Unconventional Weaponry', count: 2 },
  { name: 'Unconventional Weaponry', count: 12 },
  { name: 'Adopted Ancestry', count: 2 },
  { name: 'Adopted Ancestry', count: 12 },
])('collapses $name ($count choices) while keeping variants searchable and selectable', ({ name, count }) => {
  if (name === 'Adopted Ancestry') {
    const previous = getSettings().disableAdoptedAncestry
    onTestFinished(() => updateSettings({ disableAdoptedAncestry: previous }))
    updateSettings({ disableAdoptedAncestry: false })
  }
  const weaponry = name === 'Unconventional Weaponry'
  const category = weaponry ? 'ancestry' : 'general'
  const level = weaponry ? 1 : 3
  const label = weaponry ? 'L01 Ancestry' : 'L03 General'
  const key = `${category}:${level}:0`
  const feat: ContentEntry = { id: 'choices', name, kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 1, traits: [weaponry ? 'Human' : 'General'], description: '', data: {}, effects: [], updatedAt: 0 }
  const entries: ContentEntry[] = [feat, ...Array.from({ length: count }, (_, i): ContentEntry => ({
    ...feat, id: `choice-${i}`, name: `Choice ${String(i + 1).padStart(2, '0')}`,
    kind: weaponry ? 'weapon' : 'ancestry', traits: [], data: weaponry ? { weapon_category: 'Martial' } : {},
  }))]
  let c: Character = { ...emptyRanger(), ancestry: 'Human', level }
  const tree = (query = '') => FeatSlots({ c, entries, categories: [category], save: patch => { c = { ...c, ...patch } },
    search: { [`${key}:open`]: '1', [`${key}:query`]: query }, onSearch: () => {} })
  expect(renderToStaticMarkup(tree())).toContain(`<details class="feat-variant-group"><summary>${name} (${count} choices)</summary>`)
  expect(renderToStaticMarkup(tree(name))).toContain(`<details class="feat-variant-group"><summary>${name} (${count} choices)</summary>`)
  expect(renderToStaticMarkup(tree('choice'))).toContain('<details class="feat-variant-group" open="">')
  const filtered = renderToStaticMarkup(tree('choice 02'))
  expect(filtered).toContain(`aria-label="${label}: ${name} (Choice 02)"`)
  expect(filtered).not.toContain(`aria-label="${label}: ${name} (Choice 01)"`)
  expect(filtered).not.toContain('feat-variant-group')
  findButton(tree('choice 02'), `${label}: ${name} (Choice 02)`)!()
  expect(c.feats).toContainEqual(expect.objectContaining({ name, choice: 'Choice 02', slot: key }))
})

it('offers Mastermind skill variants and saves the chosen skill with its racket', () => {
  const feat: ContentEntry = { id: 'versatile', name: 'Versatile Rogue', kind: 'feat', source: 'homebrew',
    systems: ['pf2e'], level: 10, traits: ['Rogue'], description: '', data: { repeatable: true }, effects: [], updatedAt: 0 }
  const racket: ContentEntry = { ...feat, id: 'mastermind', kind: 'subclass', name: 'Mastermind',
    description: 'Mastermind racket benefits.', data: { class: 'Rogue' } }
  let c: Character = { ...emptyRanger(), className: 'Rogue', subclass: 'Thief', level: 10 }
  const entries = [feat, racket]
  const tree = (query = '') => FeatSlots({ c, entries, categories: ['class'], save: patch => { c = { ...c, ...patch } },
    search: { 'class:10:0:open': '1', 'class:10:0:query': query }, onSearch: () => {} })
  const settings = getSettings()
  try {
    updateSettings({ autoClassSkills: true })
    for (const skill of ['Arcana', 'Nature', 'Occultism', 'Religion']) {
      c = { ...c, feats: [] }
      const markup = renderToStaticMarkup(tree())
      expect(markup).toContain(`L10 Class: Versatile Rogue (Mastermind - ${skill})`)
      expect(renderToStaticMarkup(tree(skill.toLowerCase()))).toContain(`L10 Class: Versatile Rogue (Mastermind - ${skill})`)
      findButton(tree(), `L10 Class: Versatile Rogue (Mastermind - ${skill})`)!()
      expect(c.feats[0]).toMatchObject({ name: feat.name, choice: 'Mastermind' })
      expect(c.rogueRacketSkills?.Mastermind).toBe(skill)
      expect(ranksAt(c, entries)[skill]).toBe(3)
      expect(plannedSlots(c)).toContainEqual(expect.objectContaining({ category: 'skill', grantedBy: 'Versatile Rogue' }))
      expect(renderToStaticMarkup(tree())).toContain(`Versatile Rogue (Mastermind - ${skill})`)
      expect(renderToStaticMarkup(tree())).toContain('Mastermind racket benefits.')
      expect(featPrerequisiteChecker(c, entries)({ ...feat, data: { prerequisite: 'mastermind racket' } }).missing).toEqual([])
    }
    const legacy = { ...c, rogueRacketSkills: undefined }
    expect(renderToStaticMarkup(<FeatSlots c={legacy} entries={entries} categories={['class']} save={() => {}} />))
      .toContain('Versatile Rogue (Mastermind)')
    expect(ranksAt(legacy, entries).Society).toBe(3)
  } finally { updateSettings(settings) }
})

it.each([
  ['Aringeld', 'Steelhilt', 'Diplomacy, Society, Mercantile Lore'],
  ['Breakiron', 'Steelhilt', 'Crafting, Survival, Alchemy Lore'],
  ['Ertubur', 'Steelhilt', 'Medicine, Religion, Mortuary Lore'],
  ['Felltree', 'Ironhilt', 'Athletics, Survival, Lumber Lore'],
  ['Firecask', 'Goldhilt', 'Crafting, Nature, Alcohol Lore'],
  ['Gelderon', 'Ironhilt', 'Athletics, Nature, Farming Lore'],
  ['Grimmark', 'Steelhilt', 'Crafting, Society, Architecture Lore'],
  ['Ironfist', 'Steelhilt', 'Crafting, Medicine, Smelting Lore'],
  ['Lasthall', 'Ironhilt', 'Society, Survival, Highhelm Lore'],
  ['Molgrade', 'Goldhilt', 'Crafting, Thievery, Smithing Lore'],
  ['Oriddus', 'Goldhilt', 'Religion, Society, Dwarven Pantheon Lore'],
  ['Pearlcask', 'Steelhilt', 'Crafting, Nature, Aquaculture Lore'],
  ['Runebinder', 'Goldhilt', 'Arcana, Occultism, Academia Lore'],
  ['Stonefist', 'Steelhilt', 'Athletics, Intimidation, Warfare Lore'],
  ['Tolorr', 'Goldhilt', 'Diplomacy, Society, Library Lore'],
  ['Vanderholl', 'Ironhilt', 'Athletics, Crafting, Labor Lore'],
])('shows %s Clan Lore training in variants and saved selections', (clan, hilt, training) => {
  const feat: ContentEntry = { id: 'clan-lore', name: 'Clan Lore', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Dwarf'], description: '', data: {}, effects: [], updatedAt: 0 }
  let c: Character = { ...emptyRanger(), ancestry: 'Dwarf', level: 1 }
  const tree = () => FeatSlots({ c, entries: [feat], categories: ['ancestry'], save: patch => { c = { ...c, ...patch } },
    search: { 'ancestry:1:0:open': '1' }, onSearch: () => {} })
  const label = `Clan Lore (${hilt}, ${clan}: ${training})`
  expect(renderToStaticMarkup(tree())).toContain(label)
  findButton(tree(), `L01 Ancestry: ${label}`)!()
  expect(c.feats[0].choice).toBe(clan)
  for (const skill of training.split(', ')) expect(ranksAt(c, [feat])[skill]).toBe(1)
  expect(renderToStaticMarkup(tree())).toContain(label)
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[feat]} save={() => {}} index={0} />))
    .toContain(`<option value="${clan}" selected="">${hilt}, ${clan}: ${training}</option>`)
})

it.each([
  'Engineering Lore, Explosive Lore',
  'Engineering Lore, Firearm Lore',
  'Explosive Lore, Firearm Lore',
])('selects and persists Dongun Education (%s) without separate choice controls', choice => {
  const feat: ContentEntry = { id: 'dongun-education', name: 'Dongun Education', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Dwarf'], description: '', data: {}, effects: [], updatedAt: 0 }
  let c: Character = { ...emptyRanger(), ancestry: 'Dwarf', level: 1 }
  const tree = () => FeatSlots({ c, entries: [feat], categories: ['ancestry'], save: patch => { c = { ...c, ...patch } },
    search: { 'ancestry:1:0:open': '1' }, onSearch: () => {} })
  const label = `Dongun Education (${choice})`
  expect(renderToStaticMarkup(tree())).toContain(label)
  findButton(tree(), `L01 Ancestry: ${label}`)!()
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats[0]).toMatchObject({ name: feat.name, choice })
  for (const lore of choice.split(', ')) expect(ranksAt(c, [feat])[lore]).toBe(1)
  expect(renderToStaticMarkup(tree())).toContain(label)
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[feat]} save={() => {}} index={0} />)).toBe('')
})

it('offers and saves every Favored Prey variant', () => {
  const prey: ContentEntry = { id: 'prey', name: 'Favored Prey', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 4, traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 0 }
  let c: Character = { ...emptyRanger(), level: 4 }
  const tree = () => FeatSlots({ c, entries: [prey], categories: ['class'], save: patch => { c = { ...c, ...patch } },
    search: { 'class:4:0:open': '1' }, onSearch: () => {} })
  for (const choice of ['Animals', 'Beasts', 'Dragons', 'Fungi and Plants']) {
    c = { ...c, feats: [] }
    expect(renderToStaticMarkup(tree())).toContain(`L04 Class: Favored Prey (${choice})`)
    findButton(tree(), `L04 Class: Favored Prey (${choice})`)!()
    expect(c.feats).toContainEqual(expect.objectContaining({ name: 'Favored Prey', choice }))
    expect(renderToStaticMarkup(tree())).toContain(`Favored Prey (${choice})`)
  }
})

it('keeps Torag boon slot and source tag when clearing its selected feat, including stale slot dismissals', () => {
  const dwarf: ContentEntry = { id: 'dwarf-feat', name: 'Unburdened Iron', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Dwarf'], description: '', data: {}, effects: [], updatedAt: 0 }
  const human: ContentEntry = { ...dwarf, id: 'human-feat', name: 'Human Feat', traits: ['Human'] }
  const regular = { name: human.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
  let c: Character = { ...emptyRanger(), deity: 'Torag', divineIntercessions: { Torag: ['moderate-boon'] },
    entryIds: [human.id, dwarf.id], dismissedFeatSlots: [TORAG_BOON_FEAT_SLOT],
    extraSlots: [{ category: 'ancestry', level: 1, count: 1 }],
    feats: [regular, { name: dwarf.name, type: 'Ancestry Feat', level: 1, slot: TORAG_BOON_FEAT_SLOT, sourceId: dwarf.id }] }
  const entries = [human, dwarf]
  const tree = () => FeatSlots({ c, entries, categories: ['ancestry'], save: patch => { c = { ...c, ...patch } } })
  expect(plannedSlots(c, entries).some(slot => slot.key === TORAG_BOON_FEAT_SLOT)).toBe(true)
  expect(renderToStaticMarkup(tree())).toContain('<small>(Torag boon)</small>')
  expect(findButton(tree(), 'Remove L01 Ancestry feat slot torag-moderate-boon')).toBeUndefined()
  const clear = findButton(tree(), 'Clear L01 Ancestry feat selection')!
  expect(clear).toBeDefined()
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  clear()
  expect(c.feats).toHaveLength(2)
  clear()
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats).toEqual([regular])
  expect(c.entryIds).toEqual([human.id])
  expect(c.extraSlots).toEqual([{ category: 'ancestry', level: 1, count: 1 }])
  expect(c.dismissedFeatSlots).not.toContain(TORAG_BOON_FEAT_SLOT)
  expect(plannedSlots(c, entries).filter(slot => slot.key === TORAG_BOON_FEAT_SLOT)).toHaveLength(1)
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Empty (Torag boon)')
  expect(markup).toContain('aria-label="Clear L01 Ancestry feat selection" title="Clear selection" disabled=""')
})

it('keeps Versatile Rogue and Eldritch Trickster granted slots while allowing their selections to be cleared', () => {
  let c: Character = { ...emptyRanger(), className: 'Rogue', subclass: 'Thief', level: 10,
    extraSlots: [{ category: 'skill', level: 10, count: 1 }, { category: 'archetype', level: 10, count: 1 }],
    feats: [{ name: 'Versatile Rogue', type: 'Class Feat', level: 10, slot: 'class:10:0', choice: 'Eldritch Trickster' }] }
  const grants = plannedSlots(c).filter(slot => slot.grantedBy === 'Versatile Rogue' || slot.grantedBy === 'Eldritch Trickster')
  expect(grants).toHaveLength(2)
  c = { ...c, dismissedFeatSlots: grants.map(slot => slot.key), feats: [...c.feats,
    ...grants.map(slot => ({ name: slot.category === 'skill' ? 'Assurance' : 'Wizard Dedication',
      type: slot.category === 'skill' ? 'Skill Feat' : 'Dedication Feat', level: 1, slot: slot.key, takenLevel: 10 }))] }
  expect(plannedSlots(c).filter(slot => grants.some(grant => grant.key === slot.key))).toHaveLength(2)
  const tree = (category: 'skill' | 'archetype') => FeatSlots({ c, entries: [], categories: [category],
    save: patch => { c = { ...c, ...patch } } })
  findButton(tree('skill'), 'Clear L10 Skill feat selection')!()
  expect(c.feats.some(feat => feat.name === 'Assurance')).toBe(false)
  expect(plannedSlots(c).some(slot => slot.key === grants[0].key)).toBe(true)
  findButton(tree('archetype'), 'Clear L10 Dedication feat selection')!()
  expect(c.feats.some(feat => feat.name === 'Wizard Dedication')).toBe(false)
  expect(plannedSlots(c).some(slot => slot.key === grants[1].key)).toBe(true)
  expect(renderToStaticMarkup(tree('archetype'))).toContain('aria-label="Clear L10 Dedication feat selection" title="Clear selection" disabled=""')
  const search = { [`${grants[1].key}:open`]: '1' }
  expect(renderToStaticMarkup(<FeatSlots c={c} entries={[]} categories={['archetype']} save={() => {}} search={search} onSearch={() => {}} />))
    .not.toContain('aria-label="L10 Dedication N/A"')
})

it.each([
  ['Order Explorer', 'Druid', 'Wild', 'Untamed'],
  ['Multifarious Muse', 'Bard', 'Maestro', 'Maestro'],
  ['Second Innovation', 'Inventor', 'Armor', 'Armor'],
  ['Third Innovation', 'Inventor', 'Weapon', 'Weapon'],
])('shows selected subclass description for %s', (name, className, choice, subclassName) => {
  const feat: ContentEntry = { id: name, name, kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 2, traits: [className], description: 'Feat details.', data: {}, effects: [], updatedAt: 0 }
  const subclass: ContentEntry = { ...feat, id: 'subclass', kind: 'subclass', name: subclassName,
    description: `${subclassName} description.`, data: { class: className } }
  const c: Character = { ...emptyRanger(), className, level: 2, feats: [
    { name, type: 'Class Feat', level: 2, slot: 'class:2:0', choice },
  ] }
  expect(renderToStaticMarkup(<FeatSlots c={c} entries={[feat, subclass]} categories={['class']} save={() => {}} />))
    .toContain(`${subclassName} description.`)
})

it('offers additional Bard muses as distinct options', () => {
  const feat: ContentEntry = { id: 'multifarious', name: 'Multifarious Muse', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 2, traits: ['Bard'], description: '', data: { repeatable: true }, effects: [], updatedAt: 0 }
  const muse = (name: string): ContentEntry => ({ ...feat, id: name, name, kind: 'subclass',
    description: `${name} muse description.`, data: { class: 'Bard' } })
  let c: Character = { ...emptyRanger(), className: 'Bard', subclass: 'Maestro', level: 2 }
  const tree = () => FeatSlots({ c, entries: [feat, muse('Maestro'), muse('Polymath')], categories: ['class'],
    save: patch => { c = { ...c, ...patch } } })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Multifarious Muse (Polymath)')
  expect(markup).not.toContain('Multifarious Muse (Maestro)')
  findSelect(tree(), 'L02 Class feat')!({ target: { value: JSON.stringify([feat.name, 'Polymath']) } })
  expect(c.feats[0]).toMatchObject({ name: feat.name, choice: 'Polymath' })
  expect(renderToStaticMarkup(tree())).toContain('Polymath muse description.')
})

it('offers only four named Widespread Fascination variants, excluding the primary fascination and other selections', () => {
  const feat: ContentEntry = { id: 'widespread', name: 'Widespread Fascination', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Necromancer'], description: '', data: { repeatable: true }, effects: [], updatedAt: 0 }
  const fascinations = [['Blood', 'Blood Infusion'], ['Bone', 'Bone Spear'], ['Flesh', 'Dead Weight'], ['Spirit', 'Life Tap']]
    .map(([name, spell]): ContentEntry => ({ ...feat, id: name, name, kind: 'subclass',
      data: { class: 'Necromancer', grants_focus_spells: spell } }))
  const spells = [...fascinations.map(fascination => String(fascination.data.grants_focus_spells)), 'Deathly Scream', 'Song of the Soul']
    .map((name): ContentEntry => ({ ...feat, id: name, name, kind: 'spell', traits: ['Necromancer', 'Focus'], data: {} }))
  const entries = [feat, ...fascinations, ...spells]
  let c: Character = { ...emptyRanger(), className: 'Necromancer', level: 8 }
  const tree = () => FeatSlots({ c, entries, categories: ['class'], save: patch => { c = { ...c, ...patch } } })
  const markup = renderToStaticMarkup(tree())
  for (const name of ['Blood', 'Bone', 'Flesh', 'Spirit']) expect(markup).toContain(`Widespread Fascination (${name})`)
  for (const name of spells.map(spell => spell.name)) expect(markup).not.toContain(`Widespread Fascination (${name})`)
  c = { ...c, subclass: 'Bone' }
  expect(renderToStaticMarkup(tree())).not.toContain('Widespread Fascination (Bone)')
  findSelect(tree(), 'L02 Class feat')!({ target: { value: JSON.stringify([feat.name, 'Flesh']) } })
  c = JSON.parse(JSON.stringify(c)) as Character
  expect(c.feats[0]).toMatchObject({ name: feat.name, choice: 'Flesh' })
  expect(grantedFeatSpells(c, entries)).toMatchObject([{ entry: { name: 'Dead Weight' } }])
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={entries} save={() => {}} index={0} />)).toBe('')
  expect(featChoiceOptions(feat.name, c, entries, 'class:4:0')).toEqual(['Blood', 'Spirit'])
  c = { ...c, feats: [{ ...c.feats[0], choice: 'Dead Weight' }] }
  expect(renderToStaticMarkup(tree())).toContain('Widespread Fascination (Flesh)')
  expect(renderToStaticMarkup(tree())).not.toContain('Saved Widespread Fascination choice is unavailable')
  c = { ...c, feats: [{ ...c.feats[0], choice: 'Deathly Scream' }] }
  expect(renderToStaticMarkup(tree())).toContain('Saved Widespread Fascination choice is unavailable')
  expect(grantedFeatSpells(c, entries)).toEqual([])
})

it('preserves legacy and qualified Shobhad selections in the weapon selector', () => {
  const pf: ContentEntry = { id: 'pf', name: 'Shobhad Longrifle', kind: 'weapon', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: '', data: { weapon_category: 'Martial', rarity: 'rare' }, effects: [], updatedAt: 0 }
  const sf: ContentEntry = { ...pf, id: 'sf', systems: ['sf2e'], data: { weapon_category: 'Martial', rarity: 'common' } }
  const c: Character = { ...emptyRanger(), systems: ['pf2e', 'sf2e'],
    feats: [{ name: 'Unconventional Weaponry', type: 'Ancestry Feat', level: 1, choice: 'Shobhad Longrifle' }] }
  for (const [choice, entries] of [
    ['Shobhad Longrifle', [sf, pf]],
    ['Shobhad Longrifle (Starfinder)', [sf]],
    ['Shobhad Longrifle (Pathfinder)', [pf]],
  ] as const) {
    const markup = renderToStaticMarkup(<FeatChoice c={{ ...c, feats: [{ ...c.feats[0], choice }] }}
      entries={[...entries]} save={() => {}} index={0} />)
    expect(markup).toContain(`<option selected="">${choice}</option>`)
    expect(markup).not.toContain(`<option disabled="">${choice}</option>`)
  }
})

it('provides a daily Assurance choice in Skill Feats at the level Carry Their Memories was selected', () => {
  let c: Character = { ...emptyRanger(), systems: ['sf2e'], level: 9, skillPicks: ['Athletics', 'Society'],
    feats: [{ name: 'Carry Their Memories', type: 'Ancestry Feat', level: 5, slot: 'ancestry:9:0' }] }
  const assurance: ContentEntry = { id: 'assurance', name: 'Assurance', kind: 'feat', systems: ['sf2e'],
    source: 'official', level: 1, traits: ['General', 'Skill'], description: '', data: {}, effects: [], updatedAt: 0 }
  const target: ContentEntry = { ...assurance, id: 'target', name: 'Target', data: { prerequisite: 'Assurance' } }
  const tree = () => FeatSlots({ c, entries: [assurance], save: patch => { c = { ...c, ...patch } }, categories: ['skill'] })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Carry Their Memories (temporary)')
  expect(markup).toContain('aria-label="Carry Their Memories daily Assurance skill"')
  expect(markup.indexOf('Level 09')).toBeLessThan(markup.indexOf('Carry Their Memories (temporary)'))
  expect(markup.indexOf('Carry Their Memories (temporary)')).toBeLessThan(markup.indexOf('Level 10') === -1 ? markup.length : markup.indexOf('Level 10'))
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[assurance]} save={() => {}} index={0} />)).toBe('')
  findSelect(CarryTheirMemoriesChoice({ c, entries: [assurance], save: patch => { c = { ...c, ...patch } }, index: 0 }), 'Carry Their Memories daily Assurance skill')!
    ({ target: { value: 'Athletics' } })
  expect(c.feats[0].choice).toBe('Athletics')
  expect(featPrerequisiteChecker(c, [assurance, target])(target).missing).toContain('Assurance')
  const stale = renderToStaticMarkup(<FeatSlots c={{ ...c, skillPicks: [] }} entries={[assurance]} save={() => {}} categories={['skill']} />)
  expect(stale).toContain('<option disabled="" selected="">Athletics</option>')
  expect(renderToStaticMarkup(<FeatSlots c={{ ...c, level: 8 }} entries={[assurance]} save={() => {}} categories={['skill']} />))
    .not.toContain('Carry Their Memories (temporary)')
  const withLore: Character = { ...c, feats: [...c.feats, { name: 'Additional Lore', type: 'Skill Feat', level: 1, choice: 'Sailing' }],
    lores: [{ name: 'Untrained Lore', rank: 0 }] }
  const loreMarkup = renderToStaticMarkup(<CarryTheirMemoriesChoice c={withLore} entries={[assurance]} save={() => {}} index={0} />)
  expect(loreMarkup).toContain('<option>Sailing Lore</option>')
  expect(loreMarkup).not.toContain('<option>Untrained Lore</option>')
})

it.each(['Gale Blast', 'Spout'])('offers Touch of the Sea (%s) as a distinct ancestry feat', spell => {
  const source: ContentEntry = { id: 'sea', name: 'Touch of the Sea', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Elf'], description: '', data: {}, effects: [], updatedAt: 0 }
  let c: Character = { ...emptyRanger(), ancestry: 'Elf', level: 1 }
  const tree = () => FeatSlots({ c, entries: [source], save: patch => { c = { ...c, ...patch } }, categories: ['ancestry'] })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Touch of the Sea (Gale Blast)')
  expect(markup).toContain('Touch of the Sea (Spout)')
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: JSON.stringify([source.name, spell]) } })
  expect(c.feats[0]).toMatchObject({ name: source.name, choice: spell })
  expect(renderToStaticMarkup(tree())).toContain(`Touch of the Sea (${spell})`)
})

it('saves Bone Magic spell and tradition in one variant and grants the selected spell without a second selector', () => {
  const source: ContentEntry = { id: 'bone-magic', name: 'Bone Magic', kind: 'feat', source: 'official',
    systems: ['pf2e'], level: 1, traits: ['Lizardfolk'], description: '', data: {}, effects: [], updatedAt: 0 }
  const voidWarp: ContentEntry = { ...source, id: 'void-warp', name: 'Void Warp', kind: 'spell',
    traits: ['Cantrip'], data: { tradition: 'Arcane, Divine, Occult' } }
  const shared = { ...voidWarp, id: 'shared-cantrip', name: 'Shared Cantrip', data: { tradition: 'Occult, Primal' } }
  const entries = [source, voidWarp, { ...voidWarp, id: 'legacy-void-warp' }, shared]
  let c: Character = { ...emptyRanger(), ancestry: 'Lizardfolk', level: 20 }
  const tree = () => FeatSlots({ c, entries, save: patch => { c = { ...c, ...patch } }, categories: ['ancestry'] })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Bone Magic (Primal: Void Warp)')
  expect(markup).not.toContain('Bone Magic (Occult: Void Warp)')
  expect(markup).toContain('Bone Magic (Occult: Shared Cantrip)')
  expect(markup).toContain('Bone Magic (Primal: Shared Cantrip)')
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: JSON.stringify([source.name, 'primal|Void Warp']) } })
  c = JSON.parse(JSON.stringify(c)) as Character
  expect(c.feats[0]).toMatchObject({ name: source.name, choice: 'primal|Void Warp' })
  expect(grantedFeatSpells(c, entries)).toMatchObject([{ entry: { name: 'Void Warp' }, rank: 10, rule: { tradition: 'primal' } }])
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={entries} save={() => {}} index={0} />)).toBe('')
  expect(renderToStaticMarkup(tree())).not.toContain('Bone Magic tradition and cantrip')
  for (const choice of ['Void Warp', 'occult|Void Warp']) {
    const saved = { ...c, feats: [{ ...c.feats[0], choice }] }
    expect(grantedFeatSpells(saved, entries))
      .toMatchObject([{ entry: { name: 'Void Warp' }, rank: 10, rule: { tradition: 'primal' } }])
    expect(renderToStaticMarkup(<FeatSlots c={saved} entries={entries} save={() => {}} categories={['ancestry']} />))
      .not.toContain('Bone Magic (Occult: Void Warp)')
  }
  expect(grantedFeatSpells({ ...c, feats: [{ ...c.feats[0], choice: 'arcane|Void Warp' }] }, entries)).toEqual([])
  expect(grantedFeatSpells({ ...c, feats: [{ ...c.feats[0], choice: 'Shared Cantrip' }] }, entries)).toEqual([])
})

it.each(['listed', 'any'])('offers separate Ancestral Cantrip spell variants for %s choices', mode => {
  const cantrip = mapAonHit({ _id: 'dwarf-cantrip', _source: { name: 'Ancestral Cantrip', category: 'feat', level: 1, trait: ['Dwarf'],
    markdown: `Header\n\n---\n\nChoose one cantrip.<br/><br/>**[Option(s)](/feats/1)**: primal; ${mode === 'listed'
      ? '_[seek the stars](/spells/1)_, or _[shield](/spells/2)_' : 'any primal cantrip'}` } }, 'sf2e')!
  const spells: ContentEntry[] = ['Shield', 'Seek The Stars', 'Uncommon Cantrip', 'Arcane Cantrip'].map(name => ({
    id: name, name, kind: 'spell', systems: ['sf2e'], source: 'official', level: 1,
    traits: ['Cantrip', ...(name === 'Uncommon Cantrip' ? ['Uncommon'] : [])],
    description: '', data: { tradition: name === 'Arcane Cantrip' ? 'Arcane' : 'Primal' }, effects: [], updatedAt: 0,
  }))
  let c: Character = { ...emptyRanger(), systems: ['sf2e'], ancestry: 'Human', level: 5, feats: [
    { name: 'Adopted Ancestry', type: 'General Feat', level: 1, takenLevel: 5, slot: 'general:5:0', choice: 'Dwarf' },
  ] }
  const entries = [cantrip, ...spells]
  const tree = () => FeatSlots({ c, entries, categories: ['ancestry'], save: patch => { c = { ...c, ...patch } } })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Ancestral Cantrip (Seek The Stars)')
  expect(markup).toContain('Ancestral Cantrip (Shield)')
  expect(markup).not.toContain('Ancestral Cantrip (Uncommon Cantrip)')
  expect(markup).not.toContain('Ancestral Cantrip (Arcane Cantrip)')
  const early = markup.slice(markup.indexOf('aria-label="L01 Ancestry feat"')).split('</select>')[0]
  expect(early).not.toContain('Ancestral Cantrip')
  findSelect(tree(), 'L05 Ancestry feat')!({ target: { value: JSON.stringify([cantrip.name, 'Shield']) } })
  c = JSON.parse(JSON.stringify(c)) as Character
  expect(c.feats.find(feat => feat.name === cantrip.name)).toMatchObject({ choice: 'Shield', slot: 'ancestry:5:0' })
  expect(grantedFeatSpells(c, entries)).toMatchObject([{ entry: { name: 'Shield' }, rank: 3,
    rule: { tradition: 'primal', frequency: 'at will' } }])
  expect(renderToStaticMarkup(tree())).toContain('Ancestral Cantrip (Shield)')
})

it('keeps ordinary and heritage-only Ancestral Magic spell variants distinct', () => {
  const ordinary = mapAonHit({ _id: 'dwarf-magic', _source: { name: 'Ancestral Magic', category: 'feat', level: 5, trait: ['Dwarf'],
    markdown: 'Header\n\n---\n\nChoose a spell.<br/><br/>**[Option(s)](/feats/1)**: primal; 1st _[pummeling rubble](/spells/1)_' } }, 'sf2e')!
  const questbound = mapAonHit({ _id: 'questbound-magic', _source: { name: 'Ancestral Magic', category: 'feat', level: 5, trait: ['Dwarf'],
    markdown: 'Header\n\n---\n\nChoose a spell.<br/><br/>**[Option(s)](/feats/1)**: [[questbound dwarf](/heritages/1) heritage only] divine; 1st _[dream of home](/spells/2)_' } }, 'sf2e')!
  const spells: ContentEntry[] = ['Pummeling Rubble', 'Dream of Home'].map(name => ({
    id: name, name, kind: 'spell', systems: ['sf2e'], source: 'official', level: 1, traits: [],
    description: '', data: {}, effects: [], updatedAt: 0,
  }))
  const entries = [questbound, ordinary, ...spells]
  let c: Character = { ...emptyRanger(), ancestry: 'Dwarf', systems: ['sf2e'], level: 5 }
  const tree = () => FeatSlots({ c, entries, categories: ['ancestry'], save: patch => { c = { ...c, ...patch } } })
  let markup = renderToStaticMarkup(tree())
  expect(markup.match(/Ancestral Magic \(Pummeling Rubble\)/g)).toHaveLength(1)
  expect(markup).not.toContain('Ancestral Magic (Dream of Home)')
  c = { ...c, heritage: 'Questbound Dwarf' }
  markup = renderToStaticMarkup(tree())
  expect(markup.match(/Ancestral Magic \(Pummeling Rubble\)/g)).toHaveLength(1)
  expect(markup.match(/Ancestral Magic \(Dream of Home\)/g)).toHaveLength(1)
  findSelect(tree(), 'L05 Ancestry feat')!({ target: { value: JSON.stringify([ordinary.name, 'Dream of Home']) } })
  c = JSON.parse(JSON.stringify(c)) as Character
  expect(c.feats[0]).toMatchObject({ name: ordinary.name, choice: 'Dream of Home', sourceId: questbound.id })
  expect(grantedFeatSpells(c, entries)).toMatchObject([{ entry: { name: 'Dream of Home' },
    rule: { tradition: 'divine', frequency: 'once per day' } }])
})

it('offers Ancestral Magic variants at the slot rank and saves their spell grants', () => {
  const magic = mapAonHit({ _id: 'elf-magic', _source: { name: 'Ancestral Magic', category: 'feat', level: 5, trait: ['Elf'],
    markdown: 'Header\n\n---\n\nChoose a spell.<br/><br/>**[Option(s)](/feats/1)**: primal; 1st _[wisp ally](/spells/1)_; 2nd _[verdant code](/spells/2)_; 3rd _[discharge](/spells/3)_; 5th _[overload systems](/spells/4)_\n\n**Special** You can select this feat more than once.' } }, 'sf2e')!
  const spells: ContentEntry[] = ['Wisp Ally', 'Verdant Code', 'Discharge', 'Overload Systems'].map(name => ({
    id: name, name, kind: 'spell', systems: ['sf2e'], source: 'official', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 0,
  }))
  let c: Character = { ...emptyRanger(), systems: ['sf2e'], ancestry: 'Elf', level: 13,
    feats: [{ name: magic.name, type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: 'Wisp Ally' }] }
  const entries = [magic, ...spells]
  const tree = () => FeatSlots({ c, entries, categories: ['ancestry'], save: patch => { c = { ...c, ...patch } } })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Ancestral Magic (Verdant Code)')
  expect(markup).toContain('Ancestral Magic (Discharge)')
  expect(markup).toContain('Ancestral Magic (Overload Systems)')
  const atNine = renderToStaticMarkup(<FeatSlots c={{ ...c, level: 9 }} entries={entries} categories={['ancestry']} save={() => {}} />)
  expect(atNine).toContain('Ancestral Magic (Discharge)')
  expect(atNine).not.toContain('Ancestral Magic (Overload Systems)')
  const ninthPicker = atNine.slice(atNine.indexOf('aria-label="L09 Ancestry feat"')).split('</select>')[0]
  expect(ninthPicker).toMatch(/<optgroup label="L09">[^]*Ancestral Magic \(Discharge\)/)
  const thirteenthPicker = markup.slice(markup.indexOf('aria-label="L13 Ancestry feat"')).split('</select>')[0]
  expect(thirteenthPicker).toMatch(/<optgroup label="L13">[^]*Ancestral Magic \(Overload Systems\)/)
  findSelect(tree(), 'L09 Ancestry feat')!({ target: { value: JSON.stringify([magic.name, 'Verdant Code']) } })
  expect(c.feats.find(feat => feat.slot === 'ancestry:9:0')).toMatchObject({ name: magic.name, choice: 'Verdant Code' })
  expect(grantedFeatSpells(c, entries).map(grant => [grant.entry.name, grant.rank]))
    .toEqual([['Wisp Ally', 7], ['Verdant Code', 7]])
  expect(renderToStaticMarkup(tree())).toContain('Ancestral Magic (Verdant Code)')
})

it('lists Ysoki Ancestral Magic at level nine, when Irradiate becomes available', () => {
  const magic = mapAonHit({ _id: 'ysoki-magic', _source: { name: 'Ancestral Magic', category: 'feat', level: 5, trait: ['Ysoki'],
    markdown: 'Header\n\n---\n\nChoose a spell.<br/><br/>**[Option(s)](/feats/1)**: occult; **3rd** _[irradiate](/spells/166-irradiate)_\n\n**Special** You can select this feat more than once.' } }, 'sf2e')!
  const irradiate: ContentEntry = { id: 'irradiate', name: 'Irradiate', kind: 'spell', systems: ['sf2e'], source: 'official',
    level: 3, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), systems: ['sf2e'], ancestry: 'Ysoki', level: 9 }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[magic, irradiate]} categories={['ancestry']} save={() => {}} />)
  const fifthPicker = markup.slice(markup.indexOf('aria-label="L05 Ancestry feat"')).split('</select>')[0]
  const ninthPicker = markup.slice(markup.indexOf('aria-label="L09 Ancestry feat"')).split('</select>')[0]
  expect(fifthPicker).not.toContain('Ancestral Magic')
  expect(ninthPicker).toMatch(/<optgroup label="L09">[^]*Ancestral Magic \(Irradiate\)/)
})

it.each([['Adaptive Visual Receptors', 1], ['Additional Arms', 9]])('does not request or display a choice for repeatable %s', (name, level) => {
  const receptors: ContentEntry = { id: 'receptors', name, kind: 'feat',
    systems: ['sf2e'], source: 'official', level, traits: ['Cyborg'], description: '',
    data: { repeatable: true }, effects: [], updatedAt: 0 }
  const c: Character = { ...emptyRanger(), systems: ['sf2e'], heritage: 'Cyborg', level: 13, feats: [
    { name: receptors.name, type: 'Ancestry Feat', level, slot: `ancestry:${level}:0`, choice: 'old choice' },
    { name: receptors.name, type: 'Ancestry Feat', level, slot: 'ancestry:13:0' },
  ] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[receptors]} categories={['ancestry']} save={() => {}} />)
  expect(markup).not.toContain(`${name} choice`)
  expect(markup).not.toContain('old choice')
})

it('keeps Snare Crafting and its grant source inside one description button', () => {
  const c: Character = { ...emptyRanger(), level: 2,
    feats: [{ name: 'Snarecrafter Dedication', type: 'Archetype Feat', level: 2, slot: 'class:2:0' }] }
  const entry: ContentEntry = {
    id: 'snare-crafting', name: 'Snare Crafting', kind: 'feat', systems: ['pf2e'], source: 'official',
    level: 1, traits: ['General', 'Skill'], description: 'Craft snares.', data: {}, effects: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[entry]} save={() => {}} categories={['skill']} />)
  expect(markup).toContain('class="feat-name" aria-haspopup="dialog">Snare Crafting <small>(Snarecrafter Dedication)</small></button>')
  expect(markup).not.toContain('</button><small>(Snarecrafter Dedication)')
})

it('omits section search bars and ignores their stale queries while preserving picker searches', () => {
  const c: Character = { ...emptyRanger(), level: 2 }
  const feats = ['Alpha', 'Beta'].flatMap((name): ContentEntry[] => [{
    id: name, name, level: 1, traits: ['Ranger'], systems: ['pf2e'],
    kind: 'feat', source: 'official', description: '', data: {}, effects: [], updatedAt: 0,
  }, {
    id: `${name}-dedication`, name: `${name} Dedication`, level: 2, traits: ['Archetype', 'Dedication'],
    systems: ['pf2e'], kind: 'feat', source: 'official',
    description: '', data: { archetype: name }, effects: [], updatedAt: 0,
  }])
  const save = vi.fn()
  const classTree = (search: Record<string, string>) => FeatSlots({ c, entries: feats, categories: ['class'],
    title: 'Class Feats', save, search, onSearch: () => {} })
  const isolated = renderToStaticMarkup(classTree({ 'ancestry:query': 'Alpha', 'class:1:0:open': '1' }))
  expect(isolated).toContain('aria-label="L01 Class: Alpha"')
  expect(isolated).toContain('aria-label="L01 Class: Beta"')
  const unfiltered = renderToStaticMarkup(classTree({ 'class:query': '  BETA ', '*': 'unrelated', 'class:1:0:open': '1' }))
  expect(unfiltered.match(/type="search"/g)).toHaveLength(1)
  expect(unfiltered).toContain('aria-label="Search L01 Class feats"')
  expect(unfiltered).toContain('aria-label="L01 Class: Beta"')
  expect(unfiltered).toContain('aria-label="L01 Class: Alpha"')
  expect(renderToStaticMarkup(classTree({ 'class:1:0:query': 'Alpha' }))).not.toContain('type="search"')
  const popup = renderToStaticMarkup(FeatSlots({ c, entries: feats, categories: ['archetype'], save, onSearch: () => {},
    search: { 'archetype:2:0:open': '1', 'archetype:2:0:type': 'dedication', 'archetype:2:0:query': 'beta' } }))
  expect(popup).toContain('aria-label="Search L02 Dedication feats"')
  expect(popup).toContain('L02 Dedication: Beta Dedication')
  expect(popup).not.toContain('L02 Dedication: Alpha Dedication')
  expect(save).not.toHaveBeenCalled()
})

it('filters skill feats by declared skill, combines search, and keeps filters separate from saved selections', () => {
  const feat = (name: string, data: ContentEntry['data']): ContentEntry => ({
    id: name, name, data, kind: 'feat', systems: ['pf2e'], level: 1, traits: ['General', 'Skill'],
    source: 'official', description: '', effects: [], updatedAt: 0,
  })
  const entries = [
    feat('Titan Wrestler', { skill: 'Athletics, Athletics', prerequisite: 'Trained in Athletics' }),
    feat('Shared Technique', { skill: 'Acrobatics, Athletics' }),
    feat('Battle Medicine', { skill: 'Medicine', prerequisite: 'Trained in Medicine' }),
    feat('Acrobatic Performer', { skill: 'Acrobatics' }),
    feat('Homebrew Climber', { prerequisite: 'trained in Athletics' }),
    feat('Assurance', { prerequisite: 'trained in at least one skill' }),
  ]
  const c: Character = { ...emptyRanger(), level: 2, skillPicks: ['Athletics'] }
  const before = JSON.stringify(c)
  const save = vi.fn()
  const search: Record<string, string> = { 'skill:2:0:open': '1', 'skill:2:0:skill': 'Athletics', 'skill:2:0:limit': '200' }
  const tree = () => FeatSlots({ c, entries, categories: ['skill'], save, search,
    onSearch: (key, value) => { search[key] = value } })
  const html = renderToStaticMarkup(tree())
  for (const name of ['Titan Wrestler', 'Shared Technique', 'Homebrew Climber', 'Assurance']) {
    expect(html).toContain(`aria-label="L02 Skill: ${name}`)
  }
  expect(html).not.toContain('aria-label="L02 Skill: Battle Medicine')
  expect(html).not.toContain('aria-label="L02 Skill: Acrobatic Performer')
  expect(html).not.toContain('<option>Computers</option>')
  expect(html).toContain('<option>Lore</option>')
  search['skill:2:0:query'] = 'wrestler'
  expect(renderToStaticMarkup(tree())).toContain('aria-label="L02 Skill: Titan Wrestler"')
  expect(renderToStaticMarkup(tree())).not.toContain('aria-label="L02 Skill: Shared Technique')
  findSelect(tree(), 'Filter L02 Skill feats by skill')!({ target: { value: 'Medicine' } })
  expect(search['skill:2:0:limit']).toBe('')
  expect(renderToStaticMarkup(tree())).toContain('No matching feats.')
  search['skill:2:0:query'] = ''
  expect(renderToStaticMarkup(tree())).toContain('L02 Skill: Battle Medicine * Missing Trained in Medicine')
  expect(save).not.toHaveBeenCalled()
  expect(JSON.stringify(c)).toBe(before)
  findSelect(tree(), 'Filter L02 Skill feats by skill')!({ target: { value: '' } })
  expect(renderToStaticMarkup(tree())).toContain('aria-label="L02 Skill: Shared Technique')
  findButton(tree(), 'L02 Skill: Titan Wrestler')!()
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    feats: [expect.objectContaining({ name: 'Titan Wrestler', slot: 'skill:2:0' })],
  }))
})

it('labels genuinely different editions and saves the selected skill feat source', () => {
  const pf: ContentEntry = { id: 'pf-seasoned', name: 'Seasoned', data: {}, kind: 'feat', systems: ['pf2e'],
    level: 1, traits: ['General', 'Skill'], source: 'official', description: 'Craft potions and elixirs.', effects: [], updatedAt: 0 }
  const sf: ContentEntry = { ...pf, id: 'sf-seasoned', systems: ['sf2e'], description: 'Craft serums.' }
  const c: Character = { ...emptyRanger(), systems: ['pf2e', 'sf2e'], level: 2 }
  const save = vi.fn()
  const tree = () => FeatSlots({ c, entries: [pf, sf], categories: ['skill'], save,
    search: { 'skill:2:0:open': '1' }, onSearch: () => {} })
  expect(renderToStaticMarkup(tree())).toContain('aria-label="L02 Skill: Seasoned (PF2e)"')
  expect(renderToStaticMarkup(tree())).toContain('aria-label="L02 Skill: Seasoned (SF2e)"')
  findButton(tree(), 'L02 Skill: Seasoned (SF2e)')!()
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    feats: [expect.objectContaining({ name: 'Seasoned', sourceId: sf.id, slot: 'skill:2:0' })],
    entryIds: [sf.id],
  }))
})

it('filters Lore, knowledge skills and prerequisite feat chains without leaking filters between slots', () => {
  const feat = (name: string, data: ContentEntry['data'] = {}): ContentEntry => ({
    id: name, name, data, kind: 'feat', systems: ['sf2e'], level: 1, traits: ['General', 'Skill'],
    source: 'official', description: '', effects: [], updatedAt: 0,
  })
  const entries = [
    feat('Additional Lore'), feat('Dubious Knowledge', { prerequisite: 'trained in a skill with the Recall Knowledge action' }),
    feat('Battle Medicine', { skill: 'Medicine' }), feat('Godless Healing', { prerequisite: 'Battle Medicine' }),
    feat('Computer Trick', { skill: 'Computers' }), feat('Piloting Trick', { skill: 'Piloting' }),
    feat('Cycle One', { prerequisite: 'Cycle Two' }), feat('Cycle Two', { prerequisite: 'Cycle One' }),
  ]
  const c: Character = { ...emptyRanger(), systems: ['pf2e', 'sf2e'], level: 4 }
  const search: Record<string, string> = { 'skill:2:0:open': '1', 'skill:2:0:skill': 'Lore', 'skill:4:0:skill': 'Piloting' }
  const render = () => renderToStaticMarkup(<FeatSlots c={c} entries={entries} categories={['skill']} save={() => {}} search={search} onSearch={() => {}} />)
  expect(render()).toContain('aria-label="L02 Skill: Additional Lore')
  expect(render()).toContain('aria-label="L02 Skill: Dubious Knowledge')
  expect(render()).not.toContain('aria-label="L02 Skill: Computer Trick')
  expect(render()).toContain('<option>Computers</option>')
  expect(render()).toContain('<option>Piloting</option>')
  search['skill:2:0:skill'] = 'Medicine'
  expect(render()).toContain('aria-label="L02 Skill: Godless Healing')
  expect(render()).not.toContain('aria-label="L02 Skill: Additional Lore')
  search['skill:2:0:open'] = ''
  search['skill:4:0:open'] = '1'
  expect(render()).toContain('aria-label="L04 Skill: Piloting Trick')
  expect(render()).not.toContain('aria-label="L04 Skill: Battle Medicine')
})

it('limits Skill Training variants to the filtered untrained skill', () => {
  const training: ContentEntry = {
    id: 'training', name: 'Skill Training', data: {}, kind: 'feat', systems: ['pf2e'], level: 1,
    traits: ['General', 'Skill'], source: 'official', description: '', effects: [], updatedAt: 0,
  }
  const c: Character = { ...emptyRanger(), level: 2 }
  const render = (character = c) => renderToStaticMarkup(<FeatSlots c={character} entries={[training]} categories={['skill']}
    save={() => {}} search={{ 'skill:2:0:open': '1', 'skill:2:0:skill': 'Medicine' }} onSearch={() => {}} />)
  expect(render()).toContain('aria-label="L02 Skill: Skill Training (Medicine)"')
  expect(render()).not.toContain('Skill Training (Athletics)')
  expect(render({ ...c, skillPicks: ['Medicine'] })).toContain('No matching feats.')
})

it('keeps Favored Terrain editable in class feats and displays the same restored selection as Offense', () => {
  let c: Character = { ...emptyRanger(), level: 11, favoredTerrain: 'Forest', feats: [
    { name: 'Favored Terrain', type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Plains' },
    { name: 'Terrain Master', type: 'Class Feat', level: 8, slot: 'class:8:0' },
  ] }
  const terrain: ContentEntry = {
    id: 'terrain', name: 'Favored Terrain', kind: 'feat', systems: ['pf2e'], level: 2, traits: ['Ranger'],
    source: 'official', description: '', data: {}, effects: [], updatedAt: 1,
  }
  const tree = () => FeatSlots({ c, entries: [terrain], categories: ['class'], save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain('>Favored Terrain (Forest)</button>')
  expect(renderToStaticMarkup(tree())).not.toContain('aria-label="Favored Terrain terrain"')
})

it('pins prerequisite suggestions before pagination, searches unlocks, and saves only the canonical feat', () => {
  const titan: ContentEntry = {
    id: 'titan', name: 'Titan Wrestler', kind: 'feat', systems: ['pf2e'], level: 1, traits: ['General', 'Skill'],
    source: 'official', description: 'Grapple larger creatures.', data: { prerequisite: 'Trained in Athletics' }, effects: [], updatedAt: 1,
  }
  const target: ContentEntry = { ...titan, id: 'harder', name: 'The Harder They Fall (Ranger)', level: 8,
    traits: ['Ranger'], data: { prerequisite: 'Titan Wrestler' } }
  const fillers = Array.from({ length: 101 }, (_, index): ContentEntry =>
    ({ ...titan, id: `filler-${index}`, name: `A Filler ${index}`, data: {} }))
  const entries = [titan, { ...titan, id: 'titan-sf', systems: ['sf2e'] as ContentEntry['systems'] }, target, ...fillers]
  let c: Character = { ...emptyRanger(), systems: ['pf2e', 'sf2e'], level: 8, skillPicks: ['Athletics'] }
  const search: Record<string, string> = { 'general:3:0:open': '1' }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries, categories: ['general'], save, search, onSearch: (key, text) => { search[key] = text } })
  const label = 'L03 General: Titan Wrestler (Unlocks The Harder They Fall)'
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Suggested prerequisites')
  expect(markup.match(/aria-label="L03 General: Titan Wrestler/g)).toHaveLength(1)
  expect(markup.indexOf(label)).toBeLessThan(markup.indexOf('L03 General: A Filler'))
  expect(markup).toContain('Show more')
  expect(markup).toContain('aria-label="Details: Titan Wrestler"')
  expect(markup).toContain('Grapple larger creatures.')
  search['general:3:0:sort'] = 'name'
  const alphabetical = renderToStaticMarkup(tree())
  expect(alphabetical.indexOf('L03 General: A Filler')).toBeLessThan(alphabetical.indexOf('Show more'))
  expect(alphabetical).not.toContain(label)
  search['general:3:0:sort'] = 'level'
  search['general:3:0:limit'] = '200'
  const byLevel = renderToStaticMarkup(tree())
  expect(byLevel.indexOf('L03 General: A Filler')).toBeLessThan(byLevel.indexOf(label))
  search['general:3:0:query'] = 'harder they fall'
  expect(renderToStaticMarkup(tree())).toContain(label)
  expect(renderToStaticMarkup(tree())).not.toContain('L03 General: A Filler')
  c = { ...c, skillPicks: [] }
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${label} * Missing Trained in Athletics" disabled=""`)
  findButton(tree(), `${label} * Missing Trained in Athletics`)!()
  expect(save).not.toHaveBeenCalled()
  c = { ...c, skillPicks: ['Athletics'] }
  search['general:3:0:open'] = '1'
  findButton(tree(), label)!()
  expect(c.feats).toContainEqual({ name: 'Titan Wrestler', type: 'General Feat', level: 1, slot: 'general:3:0', sourceId: 'titan' })
  expect(c.entryIds).toContain('titan')
  expect(search['general:3:0:open']).toBe('')
})

it('unlocks Farabellus Flip for either saved Society membership wording but retains Acrobatics and armor requirements', () => {
  const flip: ContentEntry = {
    id: 'flip', name: 'Farabellus Flip', kind: 'feat', systems: ['pf2e'], level: 4,
    traits: ['Ranger', 'Barbarian', 'Fighter', 'Uncommon'], source: 'official', description: '',
    data: { access: 'Member of the Pathfinder Society.', prerequisite: 'Trained in Acrobatics; trained in medium armor' },
    effects: [], updatedAt: 1,
  }
  const ranger: ContentEntry = { ...flip, id: 'ranger', kind: 'class', name: 'Ranger', traits: [], level: 1,
    data: { defense_proficiency: 'Trained in light armor, Trained in medium armor, Trained in unarmored defense' } }
  const c: Character = { ...emptyRanger(), level: 4, skillPicks: ['Acrobatics'] }
  const tree = (character: Character) => <FeatSlots c={character} entries={[flip, ranger]} categories={['class']} save={() => {}} />
  expect(renderToStaticMarkup(tree(c))).toContain('value="Farabellus Flip" disabled=""')
  expect(renderToStaticMarkup(tree(c))).not.toContain('GM approval needed')
  for (const membership of ['member of the pathfinder society', 'A character who is a member of the Pathfinder Society has access to this option.']) {
    const saved: Character = JSON.parse(JSON.stringify({ ...c, achievements: [membership] }))
    const markup = renderToStaticMarkup(tree(saved))
    expect(markup).toContain('Farabellus Flip (Uncommon)')
    expect(markup).not.toContain('Access: Member of the Pathfinder Society. (met)')
    expect(markup).not.toContain('value="Farabellus Flip" disabled=""')
    expect(renderToStaticMarkup(tree({ ...saved, skillPicks: [] }))).toContain('Missing Trained in Acrobatics')
    expect(renderToStaticMarkup(<FeatSlots c={saved} entries={[flip]} categories={['class']} save={() => {}} />))
      .toContain('Missing trained in medium armor')
  }
})

it('unlocks Wild Hunter through a saved achievement without bypassing level or skill prerequisites', () => {
  const access = 'You\u2019ve trained with or defeated a member of the wild hunt.'
  const wild: ContentEntry = {
    id: 'wild', name: 'Wild Hunter Dedication', level: 8, traits: ['Archetype', 'Dedication', 'Uncommon'],
    systems: ['pf2e'], kind: 'feat', source: 'official', description: '', effects: [], updatedAt: 1,
    data: { archetype: 'Wild Hunter', access,
      prerequisite: 'expert in Perception; Expert in Nature, Expert in Stealth, or Expert in Survival' },
  }
  const key = achievementOptions([wild])[0].key
  const ranger: ContentEntry = { ...wild, id: 'ranger', kind: 'class', name: 'Ranger', level: 1, traits: [],
    data: { perception_proficiency: 'Expert' } }
  let c: Character = { ...emptyRanger(), level: 8, rankOverrides: { Nature: 2 } }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [wild, ranger], categories: ['archetype'], save,
    search: { 'archetype:8:0:open': '1', 'archetype:8:0:type': 'dedication' } })
  const prefix = 'L08 Dedication: Wild Hunter Dedication (Uncommon)'
  const blockedLabel = `${prefix} * Access: ${access}`
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${blockedLabel}" disabled=""`)
  findButton(tree(), blockedLabel)!()
  expect(save).not.toHaveBeenCalled()
  c = JSON.parse(JSON.stringify({ ...c, achievements: [key] }))
  const allowedLabel = prefix
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${allowedLabel}">`)
  findButton(tree(), allowedLabel)!()
  expect(c.feats).toContainEqual({ name: wild.name, type: 'Dedication Feat', level: 8, slot: 'archetype:8:0' })
  const selected = renderToStaticMarkup(tree())
  expect(selected).not.toContain('Satisfied by checked achievement.')
  expect(selected).not.toContain('Access does not replace prerequisites.')
  expect(selected).not.toContain('Granted by selected ethnicity.')
  c = { ...c, achievements: [] }
  expect(renderToStaticMarkup(tree())).toContain('aria-label="Access information"')
  c = { ...c, feats: [], achievements: [key], rankOverrides: {} }
  expect(renderToStaticMarkup(tree())).toMatch(/aria-label="L08 Dedication: Wild Hunter Dedication[^"]*Missing[^"]*" disabled=""/)
  c = { ...c, level: 6, rankOverrides: { Nature: 2 } }
  expect(renderToStaticMarkup(tree())).not.toContain(prefix)
})

it.each([
  { name: 'Brastlewark Snare Engineering', level: 4, prerequisite: 'Snarecrafter Dedication; Snare Crafting' },
  { name: 'Barricade Snare', level: 6, prerequisite: 'Snarecrafter Dedication' },
])('allows uncommon $name without synthetic access approval but still enforces prerequisites', ({ name, level, prerequisite }) => {
  const dedication: ContentEntry = {
    id: 'snarecrafter', systems: ['pf2e'], kind: 'feat', name: 'Snarecrafter Dedication', level: 2,
    traits: ['Archetype', 'Dedication'], source: 'official', description: '',
    data: { archetype: 'Snarecrafter' }, effects: [], updatedAt: 1,
  }
  const snareFeat: ContentEntry = {
    ...dedication, id: 'snare-feat', name, level, traits: ['Archetype', 'Uncommon'],
    data: { archetype: 'Snarecrafter', prerequisite, rarity: 'uncommon' },
  }
  const crafting: ContentEntry = { ...dedication, id: 'crafting', name: 'Snare Crafting', level: 1, traits: ['General', 'Skill'], data: {} }
  let c: Character = { ...emptyRanger(), level, feats: [
    { name: dedication.name, type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' },
  ] }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [dedication, snareFeat, crafting], categories: ['archetype'],
    search: { [`archetype:${level}:0:open`]: '1' }, save })
  const label = `L${String(level).padStart(2, '0')} Dedication: ${name} (Uncommon)`
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain(`<button type="button" aria-label="${label}">${name} (Uncommon)</button>`)
  expect(markup).not.toContain('no automatic access condition')
  findButton(tree(), label)!()
  expect(c.feats.some(feat => feat.name === name)).toBe(true)
  expect(renderToStaticMarkup(tree())).toContain(`(Level ${level}; Uncommon)`)
  expect(renderToStaticMarkup(tree())).not.toContain('GM approval needed')
  c = { ...c, feats: [] }
  expect(renderToStaticMarkup(tree())).not.toContain(label)
  expect(c.feats).toEqual([])
  expect(save).toHaveBeenCalledTimes(1)
})

it('lists Clever Improviser granted Untrained Improvisation under general feats, not skill feats', () => {
  const c: Character = { ...emptyRanger(), level: 5, feats: [
    { name: 'Clever Improviser', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' },
  ] }
  const entry: ContentEntry = {
    id: 'improvisation', systems: ['pf2e'], kind: 'feat', name: 'Untrained Improvisation', level: 3, traits: ['General'],
    source: 'official', description: '', data: {}, effects: [], updatedAt: 1,
  }
  const props = { c, entries: [entry], save: () => {} }
  const markup = renderToStaticMarkup(<FeatSlots {...props} categories={['general']} />)
  expect(markup).toContain('>Untrained Improvisation <small>(Clever Improviser)</small></button>')
  expect(markup).not.toContain('Granted General Feat')
  expect(markup.indexOf('Level 05')).toBeLessThan(markup.indexOf('>Untrained Improvisation <small>'))
  expect(renderToStaticMarkup(<FeatSlots {...props} categories={['skill']} />)).not.toContain('>Untrained Improvisation <small>')
})

it('interleaves free feats with earned slots at acquisition levels and keeps skill grants in their own section', () => {
  const c: Character = { ...emptyRanger(), level: 9, feats: [
    { name: 'Clever Improviser', type: 'Ancestry Feat', level: 5, slot: 'ancestry:9:0' },
    { name: 'Greenwatch Initiate', type: 'Class Feat', level: 4, slot: 'class:8:0' },
  ] }
  const data: [string, number, string[]][] = [
    ['Untrained Improvisation', 3, ['General']],
    ['Experienced Tracker', 1, ['General', 'Skill']],
    ['Survey Wildlife', 1, ['General', 'Skill']],
  ]
  const entries: ContentEntry[] = data.map(([name, level, traits]) => ({
    id: name, name, level, traits,
    systems: ['pf2e'], kind: 'feat', source: 'official', description: '', data: {}, effects: [], updatedAt: 1,
  }))
  const render = (character: Character, categories: ('general' | 'skill')[]) =>
    renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={() => {}} categories={categories} />)
  const general = render(c, ['general'])
  expect(general).toContain('>Untrained Improvisation <small>(Clever Improviser)</small></button>')
  expect(general).not.toContain('Granted General Feat')
  expect(general).not.toContain('>Experienced Tracker <small>')
  expect(general.indexOf('Clear L07 General')).toBeLessThan(general.indexOf('>Untrained Improvisation <small>'))
  const skill = render(c, ['skill'])
  expect(skill).not.toContain('>Untrained Improvisation <small>')
  expect(skill).not.toContain('Granted Skill Feat')
  expect(skill).toContain('>Experienced Tracker <small>(Greenwatch Initiate)</small></button>')
  expect(skill.indexOf('Clear L06 Skill')).toBeLessThan(skill.indexOf('>Experienced Tracker <small>'))
  expect(skill.indexOf('>Experienced Tracker <small>')).toBeLessThan(skill.indexOf('Clear L08 Skill'))
  expect(skill.match(/>Level 08<\/li>/g)).toHaveLength(1)
  expect(render({ ...c, level: 7 }, ['skill', 'general'])).not.toContain('automatic-feat-row')
  expect(render({ ...c, feats: [] }, ['skill', 'general'])).not.toContain('automatic-feat-row')
})

it('blocks Animal Strength selection until Animal Feature is actually learned as a warden spell', () => {
  let c: Character = { ...emptyRanger(), level: 6, feats: [
    { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'Gravity Weapon' },
  ] }
  const feat: ContentEntry = {
    id: 'strength', systems: ['pf2e'], kind: 'feat', name: 'Animal Strength', level: 6, traits: ['Ranger'],
    source: 'official', description: '', data: { prerequisite: '_animal feature_ warden spell' }, effects: [], updatedAt: 1,
  }
  const data = [feat,
    { ...feat, id: 'gravity', kind: 'spell' as const, name: 'Gravity Weapon', level: 1, data: { warden_spell_tier: 'Initiate' } },
    { ...feat, id: 'animal', kind: 'spell' as const, name: 'Animal Feature', level: 2, data: { warden_spell_tier: 'Advanced' } }]
  const tree = () => FeatSlots({ c, entries: data, save: patch => { c = { ...c, ...patch } }, categories: ['class'] })
  findSelect(tree(), 'L06 Class feat')!({ target: { value: feat.name } })
  expect(c.feats.some(selected => selected.name === feat.name)).toBe(false)
  c = { ...c, feats: [...c.feats, { name: 'Advanced Warden', type: 'Class Feat', level: 4, slot: 'class:4:0', choice: 'Animal Feature' }] }
  findSelect(tree(), 'L06 Class feat')!({ target: { value: feat.name } })
  expect(c.feats.find(selected => selected.name === feat.name)).toMatchObject({ slot: 'class:6:0' })
})

it('selects Exocortex Experimenter variants without a separate choice control and preserves saved choices', () => {
  const feat: ContentEntry = {
    id: 'experimenter', systems: ['sf2e'], kind: 'feat', name: 'Exocortex Experimenter', level: 6,
    traits: ['Mechanic'], source: 'official', description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }
  let c: Character = { ...emptyRanger(), systems: ['sf2e'], className: 'Mechanic', subclass: 'Drone', level: 12,
    feats: [{ name: feat.name, type: 'Class Feat', level: 6, slot: 'class:6:0' }] }
  let search: Record<string, string> = { 'class:6:0:open': '1' }
  const tree = () => FeatSlots({ c, entries: [feat], save: patch => { c = { ...c, ...patch } },
    categories: ['class'], search, onSearch: () => {} })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('aria-label="L06 Class: Exocortex Experimenter (Mine)"')
  expect(markup).toContain('aria-label="L06 Class: Exocortex Experimenter (Turret)"')
  expect(markup).not.toContain('aria-label="L06 Class: Exocortex Experimenter (Drone)"')
  expect(markup).not.toContain('aria-label="Exocortex Experimenter choice"')
  findButton(tree(), 'L06 Class: Exocortex Experimenter (Mine)')!()
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats.find(selected => selected.slot === 'class:6:0')).toMatchObject({ name: feat.name, choice: 'Mine' })
  expect(renderToStaticMarkup(tree())).toContain('>Exocortex Experimenter (Mine)</button>')
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[feat]} save={() => {}} index={0} />)).toBe('')
  search = { 'class:12:0:open': '1' }
  const second = renderToStaticMarkup(tree())
  expect(second).toContain('aria-label="L12 Class: Exocortex Experimenter (Turret)"')
  expect(second).not.toContain('aria-label="L12 Class: Exocortex Experimenter (Mine)"')
  expect(second).not.toContain('aria-label="L12 Class: Exocortex Experimenter (Drone)"')
  findButton(tree(), 'L12 Class: Exocortex Experimenter (Turret)')!()
  expect(c.feats.map(selected => selected.choice)).toEqual(['Mine', 'Turret'])
})

it('offers explicit favored-terrain variants and persists the chosen terrain', () => {
  let c: Character = { ...emptyRanger(), level: 2 }
  const feat: ContentEntry = {
    id: 'favored', systems: ['pf2e'], kind: 'feat', name: 'Favored Terrain', level: 2, traits: ['Ranger'],
    source: 'official', description: '', data: {}, effects: [], updatedAt: 1,
  }
  const tree = () => FeatSlots({ c, entries: [feat], save: patch => { c = { ...c, ...patch } }, categories: ['class'] })
  expect(renderToStaticMarkup(tree())).toContain('Favored Terrain (Plains)')
  findSelect(tree(), 'L02 Class feat')!({ target: { value: JSON.stringify([feat.name, 'Ocean']) } })
  expect(c.feats).toEqual([])
  findSelect(tree(), 'L02 Class feat')!({ target: { value: JSON.stringify([feat.name, 'Plains']) } })
  expect(JSON.parse(JSON.stringify(c)).feats).toEqual([
    { name: feat.name, type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Plains' },
  ])
})

it('opens Multitalented directly on multiclass dedications and removes its granted choice with the ancestry feat', () => {
  let c: Character = {
    id: 'multi', systems: ['pf2e'], name: 'Test', level: 9, ancestry: 'Human', className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
    feats: [
      { name: 'Multitalented', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' },
      { name: 'Cavalier Dedication', type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const wizard: ContentEntry = {
    id: 'wizard', systems: ['pf2e'], kind: 'feat', name: 'Wizard Dedication', level: 2,
    traits: ['Archetype', 'Dedication', 'Multiclass'], source: 'official', description: '',
    data: { archetype: 'Wizard', prerequisite: 'Intelligence +2' }, effects: [], updatedAt: 1,
  }
  const entries = [wizard,
    { ...wizard, id: 'medic', name: 'Medic Dedication', traits: ['Archetype', 'Dedication'], data: { archetype: 'Medic' } },
    { ...wizard, id: 'cavalier', name: 'Cavalier Dedication', traits: ['Archetype', 'Dedication'], data: { archetype: 'Cavalier' } }]
  const slot = plannedSlots(c).find(slot => slot.grantedBy === 'Multitalented')!
  const search = { [`${slot.key}:open`]: '1' }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => FeatSlots({ c, entries, save, categories: ['archetype'], search, onSearch: () => {} })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('aria-label="L09 Dedication: Wizard Dedication"')
  expect(markup).not.toContain('aria-label="L09 Dedication: Medic Dedication"')
  expect(markup).not.toContain('role="tablist"')
  findButton(tree(), 'L09 Dedication: Wizard Dedication')!()
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats.find(feat => feat.name === wizard.name)).toMatchObject({ level: 2, slot: slot.key })
  const ancestry = FeatSlots({ c, entries, save, categories: ['ancestry'] })
  findButton(ancestry, 'Clear L09 Ancestry feat selection')!()
  expect(c.feats.map(feat => feat.name)).toEqual(['Cavalier Dedication'])
  expect(c.entryIds).not.toContain(wizard.id)
})

it('offers separate Scrapper skill variants, saves one shared feat, and restores its calculated proficiencies', () => {
  let c: Character = {
    id: 'scrapper', systems: ['sf2e'], name: 'Test', level: 5, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feat: ContentEntry = {
    id: 'scrapper', systems: ['sf2e'], kind: 'feat', name: 'Technomagical Scrapper', level: 5, traits: ['Human'],
    source: 'official', description: 'Crafting and magical skill training.', data: { repeatable: false }, effects: [], updatedAt: 1,
  }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [feat], categories: ['ancestry'], save })
  const markup = renderToStaticMarkup(tree())
  for (const skill of ['Arcana', 'Nature', 'Occultism', 'Religion']) {
    expect(markup).toContain(`Technomagical Scrapper (${skill} to Trained)</option>`)
  }
  expect(markup).not.toContain('value="Technomagical Scrapper"')
  findSelect(tree(), 'L05 Ancestry feat')!({ target: { value: JSON.stringify([feat.name, 'Arcana to Expert']) } })
  expect(save).not.toHaveBeenCalled()
  findSelect(tree(), 'L05 Ancestry feat')!({ target: { value: JSON.stringify([feat.name, 'Arcana to Trained']) } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats).toEqual([{ name: feat.name, type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', sourceId: feat.id, choice: 'Arcana to Trained' }])
  expect(c.entryIds).toEqual([feat.id])
  expect(ranksAt(c, [feat])).toMatchObject({ Crafting: 1, Arcana: 1 })
  expect(renderToStaticMarkup(tree())).toContain('>Technomagical Scrapper (Arcana to Trained)</button>')
  c = { ...c, extraSlots: [{ category: 'ancestry', level: 5, count: 1 }] }
  expect(renderToStaticMarkup(tree())).not.toContain('Technomagical Scrapper (Nature to Trained)</option>')
  findButton(tree(), 'Remove L05 Ancestry feat slot 0')!()
  expect(ranksAt(c, [feat]).Crafting).toBeUndefined()
  expect(ranksAt(c, [feat]).Arcana).toBeUndefined()
})

it('gates access separately, ignores stale next-feat approval, preserves saved approvals and clears them on removal', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 1, ancestry: 'Human', className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const witch: ContentEntry = {
    id: 'witch', systems: ['pf2e'], kind: 'feat', name: 'Witch Warden', level: 1, traits: ['Human', 'Uncommon'],
    source: 'official', description: 'Ward against curses.', data: { access: 'Kellid ethnicity' }, effects: [], updatedAt: 1,
  }
  const other: ContentEntry = { ...witch, id: 'other', name: 'Other Restricted Feat' }
  const prerequisite: ContentEntry = { ...witch, id: 'strong', name: 'Strong Ward', data: { access: 'Kellid ethnicity', prerequisite: 'Strength +4' } }
  const gloomseer: ContentEntry = { ...witch, id: 'gloomseer', name: 'Gloomseer', traits: ['Human'], data: { prerequisite: 'Nidalese ethnicity' } }
  const dragonSpit: ContentEntry = { ...gloomseer, id: 'dragon-spit', name: 'Dragon Spit', data: { prerequisite: 'Tian-Dan ethnicity' } }
  const search: Record<string, string> = { 'ancestry:1:0:open': '1' }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [witch, other, prerequisite, gloomseer, dragonSpit], categories: ['ancestry'], title: 'Ancestry Feats',
    save, search })
  expect(renderToStaticMarkup(tree())).toContain('<option value="Witch Warden" disabled="">Witch Warden (Uncommon) * Access: Kellid ethnicity')
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: witch.name } })
  expect(save).not.toHaveBeenCalled()
  search['access:ancestry'] = 'approved'
  expect(renderToStaticMarkup(tree())).not.toContain('GM access approval')
  expect(renderToStaticMarkup(tree())).toContain('<option value="Gloomseer" disabled="">Gloomseer * Missing Nidalese ethnicity</option>')
  expect(renderToStaticMarkup(tree())).toContain('<option value="Dragon Spit" disabled="">Dragon Spit * Missing Tian-Dan ethnicity</option>')
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: gloomseer.name } })
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: dragonSpit.name } })
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: prerequisite.name } })
  expect(save).not.toHaveBeenCalled()
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: witch.name } })
  expect(save).not.toHaveBeenCalled()
  c = { ...c, featAccessOverrides: [witch.id] }
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: witch.name } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats[0].name).toBe(witch.name)
  expect(c.featAccessOverrides).toEqual([witch.id])
  const approvedMarkup = renderToStaticMarkup(tree())
  expect(approvedMarkup).not.toContain('GM approved access.')
  expect(approvedMarkup).not.toContain('Access does not replace prerequisites.')
  expect(approvedMarkup).not.toContain('class="feat-access-controls"')
  expect(approvedMarkup).toContain('class="feat-name" aria-haspopup="dialog">Witch Warden</button>')
  c = { ...c, ethnicity: 'Ulfen' }
  expect(renderToStaticMarkup(tree())).toContain('Witch Warden')
  findButton(tree(), 'Clear L01 Ancestry feat selection')!()
  expect(c.featAccessOverrides).toEqual([])
  expect(c.feats).toEqual([])
  c = { ...c, ethnicity: 'Kellid' }
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: witch.name } })
  expect(c.feats[0].name).toBe(witch.name)
  expect(c.featAccessOverrides).toEqual([])
  const metMarkup = renderToStaticMarkup(tree())
  expect(metMarkup).not.toContain('class="feat-access-controls"')
  expect(metMarkup).toContain('class="feat-name" aria-haspopup="dialog">Witch Warden</button>')
  expect(metMarkup).not.toContain('Granted by selected ethnicity.')
  expect(metMarkup).not.toContain('Access does not replace prerequisites.')
  c = { ...c, ethnicity: 'Ulfen' }
  const missingMarkup = renderToStaticMarkup(tree())
  expect(missingMarkup).toContain('class="feat-access-controls"')
  expect(missingMarkup).toContain('aria-label="Access information"')
  expect(missingMarkup).toContain('Access: Kellid ethnicity</small>')
  expect(missingMarkup).toContain('Access not established; GM permission required.')
  expect(missingMarkup).not.toContain('GM approval needed')
  c = { ...c, ethnicity: 'Kellid', feats: [{ ...c.feats[0], name: prerequisite.name }] }
  expect(renderToStaticMarkup(tree())).toContain('aria-label="Prerequisites unmet"')
  c = { ...c, feats: [], ethnicity: 'Nidalese' }
  search['ancestry:1:0:open'] = '1'
  expect(renderToStaticMarkup(tree())).toContain('<option value="Gloomseer">Gloomseer</option>')
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: gloomseer.name } })
  expect(c.feats[0].name).toBe(gloomseer.name)
  c = { ...c, feats: [], ethnicity: 'Tian-Dan' }
  findSelect(tree(), 'L01 Ancestry feat')!({ target: { value: dragonSpit.name } })
  expect(c.feats[0].name).toBe(dragonSpit.name)
})

it('shows automatic intimidation feats as read-only skill grants without duplicating saved selections', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 15, className: 'Barbarian',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Raging Intimidation', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
    skillPicks: ['Intimidation'], rankOverrides: { Intimidation: 4 },
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = ['Intimidating Glare', 'Scare to Death'].map((name) => ({
    id: name, systems: ['pf2e'], kind: 'feat', name, level: name === 'Scare to Death' ? 15 : 1,
    source: 'official', traits: ['General', 'Skill'], description: `${name} rules.`, data: {}, effects: [], updatedAt: 1,
  }))
  const save = vi.fn()
  const render = (character: Character, categories: ('skill' | 'class')[] = ['skill']) =>
    renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={save} categories={categories} />)
  const markup = render(c)
  expect(markup.match(/class="feat-slot-row automatic-feat-row"/g)).toHaveLength(2)
  expect(markup).toContain('>Intimidating Glare <small>(Raging Intimidation)</small></button>')
  expect(markup).toContain('>Scare to Death <small>(Raging Intimidation)</small></button>')
  expect(markup).toContain('(Raging Intimidation)')
  expect(markup).not.toContain('Remove Intimidating Glare')
  expect(render(c, ['class'])).not.toContain('automatic-feat-row')
  expect(render({ ...c, feats: [] })).not.toContain('automatic-feat-row')
  const manual = { ...c, feats: [...c.feats, { name: 'Intimidating Glare', type: 'Skill Feat', level: 1, slot: 'skill:2:0' }] }
  expect(render(manual).match(/class="feat-slot-row automatic-feat-row"/g)).toHaveLength(1)
  expect(manual.feats).toHaveLength(2)
  expect(save).not.toHaveBeenCalled()
})

function findButton(node: ReactNode, label: string): (() => void) | undefined {
  let result: (() => void) | undefined
  Children.forEach(node, (child) => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'button' && child.props['aria-label'] === label) result = child.props.onClick as () => void
    else result = findButton(child.props.children as ReactNode, label)
  })
  return result
}

function findSelect(node: ReactNode, label: string): ((event: { target: { value: string } }) => void) | undefined {
  let result: ((event: { target: { value: string } }) => void) | undefined
  Children.forEach(node, (child) => {
    if (result || !isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'select' && child.props['aria-label'] === label) result = child.props.onChange as (event: { target: { value: string } }) => void
    else result = findSelect(child.props.children as ReactNode, label)
  })
  return result
}

it('alphabetizes selected feat rows within each level without moving their slot controls', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 2, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Zeal', type: 'Class Feat', level: 1, slot: 'class:1:0' },
      { name: 'Alpha', type: 'Class Feat', level: 1, slot: 'class:1:1' },
      { name: 'Aardvark', type: 'Class Feat', level: 2, slot: 'class:2:0' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], updatedAt: 0,
    extraSlots: [{ category: 'class', level: 1, count: 2 }],
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[]} save={() => {}} categories={['class']} />)
  expect(markup.indexOf('>Alpha</button>')).toBeLessThan(markup.indexOf('>Zeal</button>'))
  expect(markup.indexOf('>Zeal</button>')).toBeLessThan(markup.indexOf('>Aardvark</button>'))
  expect(markup.indexOf('>Zeal</button>')).toBeLessThan(markup.indexOf('Remove L01 Class extra feat slot 2'))
  expect(markup.slice(0, markup.indexOf('>Zeal</button>'))).toContain('Remove L01 Class extra feat slot 1')
  const levelOneRows = [...markup.matchAll(/<li class="feat-slot-row[^"]*">[\s\S]*?<\/li>/g)]
    .map(match => match[0]).filter(row => row.includes('L01 Class'))
  expect(levelOneRows).toHaveLength(3)
  expect(levelOneRows.at(-1)).toContain('Add L01 Class feat slot')
  for (const row of levelOneRows) expect(row).toContain('Add L01 Class feat slot')
  expect(markup.slice(markup.indexOf('>Aardvark</button>'))).toContain('Add L02 Class feat slot')
})

it('lists class-granted Shield Block as a non-removable general feat', () => {
  const c: Character = { ...emptyRanger(), className: 'Champion', level: 1 }
  const feature: ContentEntry = {
    id: 'champion-shield', systems: ['pf2e'], kind: 'classFeature', source: 'official',
    name: 'Shield Block', level: 1, traits: [], description: '', data: { class: 'Champion' }, effects: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feature]} save={() => {}} categories={['general']} />)
  expect(markup).toContain('>Shield Block <small>(Champion)</small></button>')
  expect(markup).toContain('automatic-feat-row')
  expect(markup).toContain('aria-label="Add L01 General feat slot"')
  expect(markup).not.toContain('aria-label="Remove Shield Block"')
  expect(c.feats).toEqual([])

  const feat: ContentEntry = { ...feature, id: 'shield-feat', kind: 'feat', traits: ['General'] }
  const selected: Character = { ...c, level: 3, feats: [{ name: 'Shield Block', type: 'General Feat', level: 1, slot: 'general:3:0' }] }
  const selectedMarkup = renderToStaticMarkup(<FeatSlots c={selected} entries={[feature, feat]} save={() => {}} categories={['general']} />)
  expect(selectedMarkup).not.toContain('automatic-feat-row')
  expect(selectedMarkup).toContain('Shield Block')
  const background: ContentEntry = { ...feature, id: 'background', name: 'Background', kind: 'background', data: { feat: 'Shield Block' } }
  const backgroundMarkup = renderToStaticMarkup(<FeatSlots c={{ ...c, background: 'Background' }}
    entries={[feature, feat, background]} save={() => {}} categories={['general']} />)
  expect(backgroundMarkup).not.toContain('automatic-feat-row')
  expect(backgroundMarkup).toContain('background-feat-row')
  expect(backgroundMarkup).toContain('aria-label="Add L01 General feat slot"')
})

it('lists Close Quarters Whirling Swipe as granted while allowing manual selection for other Soldier styles', () => {
  const whirlingSwipe: ContentEntry = {
    id: 'whirling-swipe', systems: ['sf2e'], kind: 'feat', source: 'official', name: 'Whirling Swipe', level: 1,
    traits: ['Soldier'], description: '', data: {}, effects: [], updatedAt: 0,
  }
  const soldier: Character = { ...emptyRanger(), systems: ['sf2e'], className: 'Soldier', subclass: 'Close Quarters' }
  const markup = renderToStaticMarkup(<FeatSlots c={soldier} entries={[whirlingSwipe]} save={() => {}} categories={['class']} />)
  expect(markup).toContain('>Whirling Swipe <small>(Close Quarters)</small></button>')
  expect(markup).toContain('automatic-feat-row')
  expect(eligibleFeats([whirlingSwipe], soldier, { key: 'class:1:0', category: 'class', level: 1 })).not.toContain(whirlingSwipe)
  expect(eligibleFeats([whirlingSwipe], { ...soldier, subclass: 'Action Hero' },
    { key: 'class:1:0', category: 'class', level: 1 })).toContain(whirlingSwipe)
})

it('alphabetizes skill feats from all sources within their acquisition level', () => {
  const c: Character = { ...emptyRanger(), systems: ['sf2e'], ancestry: 'Elf', level: 2, background: 'Scholar',
    extraSlots: [{ category: 'skill', level: 1, count: 3 }],
    feats: [
      { name: 'Cite the Deep Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
      { name: "Diplomat's Facade", type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:1' },
      { name: 'Zebra', type: 'Skill Feat', level: 1, slot: 'skill:1:0' },
      { name: 'Acrobatics', type: 'Skill Feat', level: 1, slot: 'skill:1:1' },
      { name: 'Assurance', choice: 'Deception', type: 'Skill Feat', level: 1, slot: 'skill:1:scholar' },
      { name: 'Aardvark', type: 'Skill Feat', level: 1, slot: 'skill:2:0' },
    ] }
  const background: ContentEntry = { id: 'scholar', name: 'Scholar', kind: 'background', source: 'official',
    systems: ['sf2e'], level: 1, traits: [], description: '', data: { feat: 'Assurance' }, effects: [], updatedAt: 0 }
  const assurance: ContentEntry = { ...background, id: 'assurance', name: 'Assurance', kind: 'feat',
    traits: ['General', 'Skill'], data: {} }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[background, assurance]} save={() => {}} categories={['skill']} />)
  const names = ['>Acrobatics</button>', '>Assurance (Deception)</button>', '>Blend In <small>',
    '>Lie to Me <small>', '>Zebra</button>', 'aria-label="L01 Skill feat"', '>Aardvark</button>']
  for (const name of names) expect(markup).toContain(name)
  const positions = names.map(name => markup.indexOf(name))
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
  expect(markup.slice(markup.indexOf('>Acrobatics</button>'), markup.indexOf('>Assurance (Deception)</button>')))
    .toContain('Remove L01 Skill extra feat slot 1')
  expect(markup.match(/>Level 01<\/li>/g)).toHaveLength(1)
})

it('prefixes ancestry slots and feat options with zero-padded levels', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 13, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feat: ContentEntry = {
    id: 'feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Natural Ambition', level: 1,
    traits: ['Human'], description: '', data: {}, effects: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['ancestry']} title="Ancestry Feats" />)
  expect(markup).toContain('Ancestry Feats')
  expect(markup).toContain('<details class="character-subsection"><summary>')
  expect(markup).not.toContain('open=""')
  expect(markup).toContain('Level 01')
  expect(markup).toContain('Level 13')
  expect(markup).toContain('aria-label="L13 Ancestry feat"')
  expect(markup).toContain('<option value="Natural Ambition">Natural Ambition</option>')
  expect(markup).toContain('class="feat-slot-list"')
  expect(markup).toContain('class="feat-slot-row"')
  expect((markup.match(/class="feat-slot-row feat-level-start"/g) ?? [])).toHaveLength(0)
  expect((markup.match(/class="feat-level-heading"/g) ?? [])).toHaveLength(4)
})

it('shows the current background skill feat above level-based skill feats', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 2, background: 'Hunter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Quick Draw', type: 'Skill Feat', level: 1, slot: 'skill:2:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = [
    { id: 'hunter', systems: ['pf2e'], kind: 'background', source: 'official', name: 'Hunter', level: 1, traits: [], description: '', data: { feat: 'Survey Wildlife' }, effects: [], updatedAt: 0 },
    { id: 'survey', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Survey Wildlife', level: 1, traits: ['General', 'Skill'], description: '', data: {}, effects: [], updatedAt: 0 },
    { id: 'quick', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Quick Draw', level: 1, traits: [], description: '', data: { actions: 'Single Action' }, effects: [], updatedAt: 0 },
  ]
  const render = (character: Character) => renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={() => {}} categories={['skill']} bare />)
  const markup = render(c)
  expect(markup).not.toContain('Background Skill Feat')
  expect(markup).toContain('Survey Wildlife')
  expect(markup.indexOf('Survey Wildlife')).toBeLessThan(markup.indexOf('Level 02'))
  expect(render({ ...c, background: undefined })).not.toContain('Survey Wildlife')
})

it('includes action symbols in feat choices and shows one add control per level', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 2, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = [{
    id: 'quick-draw', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Quick Draw', level: 1,
    traits: ['Ranger'], description: '', data: { actions: 'Single Action' }, effects: [], updatedAt: 0,
  }]
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={entries} save={() => {}} categories={['class']} bare />)
  expect(markup).toContain('Quick Draw ◆')
  expect(markup).not.toContain('class="action-cost"')
  expect((markup.match(/aria-label="Add L\d{2} Class feat slot"/g) ?? [])).toHaveLength(2)
})

it('retains action icons on selected feat names and description headings', () => {
  for (const actions of ['Single Action', 'Two Actions', 'Three Actions', 'Free Action', 'Reaction']) {
    const c: Character = {
      id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      feats: [{ name: 'Action Feat', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
      equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    }
    const feat: ContentEntry = {
      id: 'action-feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Action Feat', level: 1,
      traits: ['Ranger'], description: 'Full feat description.', data: { actions }, effects: [], updatedAt: 0,
    }
    const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['class']} bare />)
    const nameButton = /<button[^>]*class="feat-name"[^>]*>([\s\S]*?)<\/button>/.exec(markup)?.[1]
    const heading = /<h4[^>]*>([\s\S]*?)<\/h4>/.exec(markup)?.[1]
    expect(nameButton).toContain(`class="action-cost" aria-label="${actions}"`)
    expect(heading).toContain(`class="action-cost" aria-label="${actions}"`)
  }
})

it('routes mixed background grants to their own feat sections and hides rows when no feats are granted', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 3, background: 'Mixed Grants',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const base: ContentEntry = {
    id: 'mixed', systems: ['pf2e'], kind: 'background', source: 'official', name: 'Mixed Grants',
    level: 1, traits: [], description: '', data: { feat: 'Toughness, Assurance' }, effects: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = [
    base,
    { ...base, id: 'toughness', kind: 'feat', name: 'Toughness', traits: ['General'], data: {} },
    { ...base, id: 'assurance', kind: 'feat', name: 'Assurance', traits: ['General', 'Skill'], data: {} },
    { ...base, id: 'none', name: 'No Grants', data: {} },
  ]
  const render = (category: 'skill' | 'general', background = c.background) =>
    renderToStaticMarkup(<FeatSlots c={{ ...c, background }} entries={entries} save={() => {}} categories={[category]} bare />)
  const general = render('general')
  expect(general).toContain('Toughness')
  expect(general).not.toContain('Background Skill Feat')
  expect(general.indexOf('Toughness')).toBeLessThan(general.indexOf('L03 General'))
  const skill = render('skill')
  expect(skill).not.toContain('Background Skill Feat')
  expect(skill).toContain('Assurance')
  expect(skill).not.toContain('Toughness')
  for (const category of ['skill', 'general'] as const) {
    expect(render(category, 'No Grants')).not.toContain('Background ')
  }
  const generalOnly = entries.map((entry) => entry.id === 'mixed' ? { ...entry, data: { feat: 'Toughness' } } : entry)
  expect(renderToStaticMarkup(<FeatSlots c={c} entries={generalOnly} save={() => {}} categories={['skill']} bare />))
    .not.toContain('Background Skill Feat')
})

it('groups feat options by level, alphabetically within each level', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 4, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = [
    { id: 'zeal', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Zeal', level: 1, traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 0 },
    { id: 'alpha', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Alpha', level: 1, traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 0 },
    { id: 'middle', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Middle', level: 2, traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 0 },
  ]
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={entries} save={() => {}} categories={['class']} />)
  expect(markup.indexOf('<optgroup label="L01">')).toBeLessThan(markup.indexOf('<optgroup label="L02">'))
  expect(markup.indexOf('>Alpha</option>')).toBeLessThan(markup.indexOf('>Zeal</option>'))
  expect(markup).toContain('<optgroup label="L02"><option value="Middle">Middle</option></optgroup>')
})

it('does not offer or accept duplicate blessings, including when no distinct choice remains', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 8, className: 'Champion', blessing: 'Blessed Armament',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const entry: ContentEntry = { id: 'second', name: 'Second Blessing', kind: 'feat', source: 'official', systems: ['pf2e'],
    level: 8, traits: ['Champion'], description: '', data: {}, effects: [], updatedAt: 1 }
  const tree = () => FeatSlots({ c, entries: [entry], save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  expect(renderToStaticMarkup(tree())).not.toContain('Second Blessing (Blessed Armament)')
  expect(renderToStaticMarkup(tree())).toContain('Second Blessing (Blessed Shield)')
  const choose = findSelect(tree(), 'L08 Class feat')
  if (!choose) throw new Error('Missing level 8 feat picker')
  choose({ target: { value: JSON.stringify(['Second Blessing', 'Blessed Armament']) } })
  expect(c.feats).toEqual([])
  choose({ target: { value: JSON.stringify(['Second Blessing', 'Blessed Shield']) } })
  expect(c.feats[0]).toMatchObject({ name: 'Second Blessing', choice: 'Blessed Shield' })
  c = { ...c, feats: ['Blessed Shield', 'Blessed Swiftness'].map((name) => ({ name, type: 'Class Feat', level: 1 })) }
  expect(renderToStaticMarkup(tree())).not.toContain('>Second Blessing')
})

it('shows only distinct domains granted by the selected deity in the feat picker', () => {
  let c: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 1, className: 'Champion', deity: 'Chosen',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const feat: ContentEntry = { id: 'domain', kind: 'feat', name: "Deity's Domain", level: 1, traits: ['Champion'],
    source: 'official', systems: ['pf2e'], description: '', data: {}, effects: [], updatedAt: 0 }
  const entries: ContentEntry[] = [feat,
    { ...feat, id: 'chosen', name: 'Chosen', kind: 'deity', data: { domain_primary: 'Zeal, Water, water,  Water ' } },
    { ...feat, id: 'other', name: 'Other', kind: 'deity', data: { domain_primary: 'Fire' } }]
  const tree = () => FeatSlots({ c, entries, save: patch => { c = { ...c, ...patch } }, categories: ['class'] })
  const markup = renderToStaticMarkup(tree())
  expect(markup).not.toContain('Deity&#x27;s Domain (Fire)')
  expect(markup).toContain('>Deity&#x27;s Domain (Zeal)</option>')
  expect(markup.match(/>Deity&#x27;s Domain \(Water\)<\/option>/g)).toHaveLength(1)
  const choose = findSelect(tree(), 'L01 Class feat')!
  choose({ target: { value: JSON.stringify(["Deity's Domain", 'Fire']) } })
  expect(c.feats).toEqual([])
  choose({ target: { value: JSON.stringify(["Deity's Domain", 'Water']) } })
  expect(c.feats[0].choice).toBe('Water')
  c = { ...c, deity: 'Other' }
  expect(renderToStaticMarkup(tree())).toContain('Water (unavailable)')
  expect(c.feats[0].choice).toBe('Water')
  c = { ...c, deity: undefined, feats: [] }
  expect(renderToStaticMarkup(tree())).not.toContain('Deity&#x27;s Domain (')
})

it('lists each domain spell in its picker and selected feat descriptions', () => {
  const c: Character = { ...emptyRanger(), className: 'Champion', deity: 'Gozreh', level: 8 }
  const domain: ContentEntry = { id: 'domain', kind: 'feat', name: "Deity's Domain", level: 1, traits: ['Champion'],
    source: 'official', systems: ['pf2e'], description: 'Choose a domain.', data: {}, effects: [], updatedAt: 0 }
  const advanced: ContentEntry = { ...domain, id: 'advanced', name: "Advanced Deity's Domain", level: 8 }
  const entries: ContentEntry[] = [domain, advanced,
    { ...domain, id: 'gozreh', name: 'Gozreh', kind: 'deity', data: { domain_primary: 'Water, Air' } },
    { ...domain, id: 'tidal', name: 'Tidal Surge', kind: 'spell', traits: ['Focus'], description: 'You unleash a surge of water that pushes your foe.', data: { domain: 'Water' } },
    { ...domain, id: 'downpour', name: 'Downpour', kind: 'spell', traits: ['Focus'], level: 4, description: 'A rainstorm drenches an area.', data: { domain: 'Water' } }]
  const popup = (character: Character, slot: string) => renderToStaticMarkup(<FeatSlots c={character} entries={entries}
    save={() => {}} categories={['class']} search={{ [`${slot}:open`]: '1' }} onSearch={() => {}} />)
  const initial = popup(c, 'class:1:0')
  expect(initial).toContain('Details: Deity&#x27;s Domain (Water)')
  expect(initial).toContain('Water domain grants focus spell: Tidal Surge: You unleash a surge of water that pushes your foe.')
  expect(initial).toContain('Domain spell data unavailable.')
  const selected: Character = { ...c, feats: [{ name: domain.name, type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'Water' }] }
  const next = popup(selected, 'class:8:0')
  expect(next).toContain('Water domain grants focus spell: Tidal Surge: You unleash a surge of water that pushes your foe.')
  expect(next).toContain('Details: Advanced Deity&#x27;s Domain (Water)')
  expect(next).toContain('Water domain grants focus spell: Downpour: A rainstorm drenches an area.')
})

it('links imported leads-to feats inside feat descriptions and marks unavailable targets', () => {
  const source = mapAonHit({ _id: 'source', _source: { category: 'feat', name: 'Sacral Lord', level: 4,
    trait: ['Champion'], markdown: 'Rules.\n\n<title level="2">Sacral Lord leads to...</title>\n[Sacral Monarch](/Feats.aspx?ID=8479), [Missing Feat](/Feats.aspx?ID=999)' } }, 'pf2e')!
  const target = mapAonHit({ _id: 'target', _source: { category: 'feat', name: 'Sacral Monarch', level: 8,
    trait: ['Champion'], url: '/Feats.aspx?ID=8479', markdown: 'Monarch rules.' } }, 'pf2e')!
  const c: Character = { ...emptyRanger(), className: 'Champion', level: 4,
    feats: [{ name: source.name, type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[source, target]} save={() => {}} categories={['class']} />)
  expect(markup).toContain('Leads to: <span><button type="button">Sacral Monarch</button></span>')
  expect(markup).toContain('Missing Feat (unavailable)')
  expect(markup).not.toContain('Sacral Lord leads to... Sacral Monarch')
})

it('allows repeatable feats in multiple slots and retains their entry link until the final copy is removed', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [],
    extraSlots: [{ category: 'class', level: 1, count: 1 }], updatedAt: 0,
  }
  const entries: ContentEntry[] = [{
    id: 'warden', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Initiate Warden', level: 1,
    traits: ['Ranger'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }, {
    id: 'spell-one', systems: ['pf2e'], kind: 'spell', source: 'official', name: 'Spell One', level: 1,
    traits: ['Focus', 'Ranger'], description: '', data: { warden_spell_tier: 'Initiate' }, effects: [], updatedAt: 1,
  }, {
    id: 'spell-two', systems: ['pf2e'], kind: 'spell', source: 'official', name: 'Spell Two', level: 1,
    traits: ['Focus', 'Ranger'], description: '', data: { warden_spell_tier: 'Initiate' }, effects: [], updatedAt: 1,
  }]
  const tree = () => FeatSlots({ c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  const select = () => findSelect(tree(), 'L01 Class feat')
  const chooseFirst = select()
  if (!chooseFirst) throw new Error('Missing first slot')
  chooseFirst({ target: { value: JSON.stringify(['Initiate Warden', 'Spell One']) } })
  const removeExtra = findButton(tree(), 'Remove L01 Class extra feat slot 1')
  expect(removeExtra).toBeDefined()
  const chooseExtra = (() => {
    let selects: Array<(event: { target: { value: string } }) => void> = []
    const visit = (node: ReactNode) => Children.forEach(node, (child) => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (child.type === 'select' && child.props['aria-label'] === 'L01 Class feat') selects.push(child.props.onChange as (event: { target: { value: string } }) => void)
      visit(child.props.children as ReactNode)
    })
    visit(tree())
    return selects[0]
  })()
  if (!chooseExtra) throw new Error('Missing extra slot')
  chooseExtra({ target: { value: JSON.stringify(['Initiate Warden', 'Spell Two']) } })
  expect(c.feats).toHaveLength(2)
  expect(c.entryIds).toEqual(['warden'])
  expect(c.feats.map((feat) => feat.choice)).toEqual(['Spell One', 'Spell Two'])
  const remove = findButton(tree(), 'Remove L01 Class extra feat slot 1')
  if (!remove) throw new Error('Missing remove button')
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  remove()
  expect(c.feats).toHaveLength(2)
  expect(c.extraSlots).toHaveLength(1)
  remove()
  expect(c.feats).toHaveLength(1)
  expect(c.entryIds).toEqual(['warden'])
  const clear = findButton(tree(), 'Clear L01 Class feat selection')
  if (!clear) throw new Error('Missing clear button')
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  clear()
  expect(c.feats).toHaveLength(1)
  clear()
  expect(c.feats).toEqual([])
  expect(c.entryIds).toEqual([])
  expect(plannedSlots(c).filter((slot) => slot.category === 'class' && slot.level === 1)).toHaveLength(1)
})

it('offers the three distinct Mercy choices and limits the feat to three selections', () => {
  const mercy = mapAonHit({ _id: 'mercy', _source: { category: 'feat', name: 'Mercy', level: 4, trait: ['Champion'],
    prerequisite: ['lay on hands'], markdown: '**Special** You can select this feat up to three times.' } }, 'pf2e')!
  const deity: ContentEntry = { ...mercy, id: 'deity', kind: 'deity', name: 'Patron', data: { divine_font: 'Heal' } }
  const entries = [mercy, deity]
  let c: Character = { ...emptyRanger(), className: 'Champion', level: 10, deity: 'Patron', devotionSpell: 'Lay on Hands' }
  const tree = () => FeatSlots({ c, entries, save: patch => { c = { ...c, ...patch } }, categories: ['class'] })
  expect(mercy.data.repeatable).toBe(true)
  expect(renderToStaticMarkup(tree())).toContain('Mercy (Mercy of the Body)')
  expect(renderToStaticMarkup(tree())).toContain('Mercy (Mercy of Grace)')
  expect(renderToStaticMarkup(tree())).toContain('Mercy (Mercy of the Mind)')
  findSelect(tree(), 'L04 Class feat')!({ target: { value: JSON.stringify(['Mercy', 'Mercy of the Body']) } })
  expect(featChoiceOptions('Mercy', c, entries, 'class:6:0')).toEqual(['Mercy of Grace', 'Mercy of the Mind'])
  findSelect(tree(), 'L06 Class feat')!({ target: { value: JSON.stringify(['Mercy', 'Mercy of Grace']) } })
  findSelect(tree(), 'L08 Class feat')!({ target: { value: JSON.stringify(['Mercy', 'Mercy of the Mind']) } })
  expect(c.feats.map(feat => feat.choice)).toEqual(['Mercy of the Body', 'Mercy of Grace', 'Mercy of the Mind'])
  const slot = plannedSlots(c).find(item => item.key === 'class:10:0')!
  expect(eligibleFeats(entries, c, slot).some(entry => entry.name === 'Mercy')).toBe(false)
  expect(featChoiceOptions('Mercy', c, entries, 'class:4:0')).toEqual(['Mercy of the Body'])
})

it('lets an existing unassigned Mercy choose an unused option without replacing other choices', () => {
  let c: Character = { ...emptyRanger(), className: 'Champion', level: 6, feats: [
    { name: 'Mercy', type: 'Class Feat', level: 4, slot: 'class:4:0' },
    { name: 'Mercy', type: 'Class Feat', level: 4, slot: 'class:6:0', choice: 'Mercy of Grace' },
  ] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const choice = () => FeatChoice({ c, entries: [], save, index: 0 })
  const markup = renderToStaticMarkup(choice())
  expect(markup).toContain('Mercy of the Body')
  expect(markup).toContain('Mercy of the Mind')
  expect(markup).not.toContain('Mercy of Grace')
  findSelect(choice(), 'Mercy choice')!({ target: { value: 'Mercy of the Mind' } })
  expect(c.feats.map(feat => feat.choice)).toEqual(['Mercy of the Mind', 'Mercy of Grace'])
})

it('allows correcting a duplicate Mercy choice without offering already-selected options', () => {
  const c: Character = { ...emptyRanger(), className: 'Champion', level: 8, feats: [
    { name: 'Mercy', type: 'Class Feat', level: 4, slot: 'class:4:0', choice: 'Mercy of the Body' },
    { name: 'Mercy', type: 'Class Feat', level: 6, slot: 'class:6:0', choice: 'Mercy of the Body' },
  ] }
  const mercy: ContentEntry = { id: 'mercy', kind: 'feat', name: 'Mercy', level: 4, traits: ['Champion'],
    source: 'official', systems: ['pf2e'], description: '', data: { repeatable: true }, effects: [], updatedAt: 0 }
  const html = renderToStaticMarkup(<FeatSlots c={c} entries={[mercy]} save={() => {}} categories={['class']} />)
  expect(html).toContain('aria-label="Mercy choice"')
  expect(html).toContain('Mercy of the Body (unavailable)')
  expect(featChoiceOptions('Mercy', c, [mercy], 'class:6:0')).toEqual(['Mercy of Grace', 'Mercy of the Mind'])
})

it('adds slots beside a selected feat and removes only the chosen extra slot', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, ancestry: 'Human', className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'First', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: ['first', 'second', 'third'], extraSlots: [], updatedAt: 0,
  }
  const entries: ContentEntry[] = ['First', 'Second', 'Third'].map((name) => ({
    id: name.toLowerCase(), systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 0,
  }))
  const tree = () => FeatSlots({ c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  const add = () => {
    const action = findButton(tree(), 'Add L01 Class feat slot')
    if (!action) throw new Error('Missing add button')
    action()
  }
  add()
  add()
  expect(c.extraSlots).toEqual([{ category: 'class', level: 1, count: 1 }, { category: 'class', level: 1, count: 1 }])
  expect(plannedSlots(c).filter((s) => s.category === 'class').map((s) => s.key)).toEqual(['class:1:0', 'class:1:1', 'class:1:2'])
  c.feats.push(
    { name: 'Second', type: 'Class Feat', level: 1, slot: 'class:1:1' },
    { name: 'Third', type: 'Class Feat', level: 1, slot: 'class:1:2' },
  )
  const remove = findButton(tree(), 'Remove L01 Class extra feat slot 1')
  if (!remove) throw new Error('Missing remove button')
  remove()
  expect(c.extraSlots).toEqual([{ category: 'class', level: 1, count: 1 }])
  expect(c.feats).toEqual([
    { name: 'First', type: 'Class Feat', level: 1, slot: 'class:1:0' },
    { name: 'Third', type: 'Class Feat', level: 1, slot: 'class:1:1' },
  ])
  expect(c.entryIds).toEqual(['first', 'third'])
})

it('keeps add buttons beside every selected feat and the final empty slot, including granted Champion slots', () => {
  let c: Character = {
    ...emptyRanger(), className: 'Champion', level: 1,
    feats: [
      { name: 'Natural Ambition', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
      { name: 'Alpha', type: 'Class Feat', level: 1, slot: 'class:1:g1' },
      { name: 'Zeal', type: 'Class Feat', level: 1, slot: 'class:1:0' },
    ],
  }
  const tree = () => FeatSlots({ c, entries: [], save: patch => { c = { ...c, ...patch } }, categories: ['class'] })
  expect(renderToStaticMarkup(tree()).match(/aria-label="Add L01 Class feat slot"/g)).toHaveLength(2)
  const add = findButton(tree(), 'Add L01 Class feat slot')
  expect(add).toBeDefined()
  add!()
  expect(plannedSlots(c).filter(slot => slot.category === 'class' && slot.level === 1).map(slot => slot.key))
    .toContain('class:1:1')
  expect(c.feats.map(feat => feat.name)).toEqual(['Natural Ambition', 'Alpha', 'Zeal'])
  expect(renderToStaticMarkup(tree()).match(/aria-label="Add L01 Class feat slot"/g)).toHaveLength(3)
  c = { ...c, extraSlots: [], feats: c.feats.filter(feat => feat.slot !== 'class:1:0') }
  expect(renderToStaticMarkup(tree()).match(/aria-label="Add L01 Class feat slot"/g)).toHaveLength(2)
  c = { ...c, dismissedFeatSlots: ['class:1:0'] }
  expect(renderToStaticMarkup(tree()).match(/aria-label="Add L01 Class feat slot"/g)).toHaveLength(1)
  findButton(tree(), 'Add L01 Class feat slot')!()
  expect(c.dismissedFeatSlots).toEqual([])
})

it('removes existing counted extras without changing other slots', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 3,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Extra', type: 'Bonus Feat', level: 1, slot: 'bonus:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], updatedAt: 0,
    extraSlots: [{ category: 'bonus', level: 1, count: 2 }, { category: 'class', level: 1, count: 1 }],
  }
  const tree = FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['bonus'] })
  const remove = findButton(tree, 'Remove L01 Bonus extra feat slot 0')
  if (!remove) throw new Error('Missing remove button')
  remove()
  expect(c.extraSlots).toEqual([{ category: 'bonus', level: 1, count: 1 }, { category: 'class', level: 1, count: 1 }])
  expect(c.feats).toEqual([])
})

it('keeps extra slots next to their matching standard slot', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], updatedAt: 0,
    extraSlots: [{ category: 'ancestry', level: 1, count: 2 }, { category: 'class', level: 1, count: 1 }],
  }
  expect(plannedSlots(c).map((s) => s.key)).toEqual([
    'ancestry:1:0', 'ancestry:1:1', 'ancestry:1:2', 'class:1:0', 'class:1:1',
  ])
})

it('keeps an existing Advanced General Training choice selected under level 09', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 9, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Advanced General Training', type: 'Ancestry Feat', level: 13, slot: 'ancestry:9:0' },
      { name: 'Fleet', type: 'General Feat', level: 1, slot: 'general:7:g2' },
    ],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[]} save={() => {}} categories={['general']} />)
  expect(markup).toContain('aria-haspopup="dialog">Fleet</button>')
  expect(markup.indexOf('Level 09')).toBeLessThan(markup.indexOf('>Fleet</button>'))
  expect(markup).toContain('aria-label="Clear L09 General feat selection"')
})

it('alphabetizes automatic and selected general feats at the same level', () => {
  const c: Character = { ...emptyRanger(), className: 'Fighter', level: 1, feats: [
    { name: 'General Training', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
    { name: 'Fleet', type: 'General Feat', level: 1, slot: 'general:1:g0' },
  ] }
  const shieldBlock: ContentEntry = { id: 'fighter-shield-block', name: 'Shield Block', kind: 'classFeature', source: 'official',
    systems: ['pf2e'], level: 1, traits: [], description: '', data: { class: 'Fighter' }, effects: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[shieldBlock]} categories={['general']} save={() => {}} />)
  expect(markup.indexOf('>Fleet</button>')).toBeLessThan(markup.indexOf('Shield Block'))
})

it('opens Living Weapon details from its name instead of a separate summary or inline choice', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Living Weapon', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feat: ContentEntry = {
    id: 'living-weapon', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Living Weapon', level: 1,
    traits: ['Ranger'], description: 'Living Weapon rules summary.', data: { repeatable: true }, effects: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['class']} />)
  expect(markup).toContain('aria-haspopup="dialog">Living Weapon</button>')
  expect(markup).toContain('<dialog')
  expect(markup).toContain(feat.description)
  expect(markup).not.toContain('<summary>Change</summary>')
  expect(markup).toContain('aria-label="Clear L01 Class feat selection"')
  expect(markup).not.toContain('Summary')
  expect(markup).not.toContain('Living Weapon choice')
})

const emptyRanger = (): Character => ({
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
})

it.each([
  ["Giant's Lunge", 14],
  ['Desperate Wrath', 16],
  ['Come and Get Me', 10],
  ["Giant's Stature", 6],
] as const)('shows %s controls in an action dialog', (name, level) => {
  const feat: ContentEntry = {
    id: name, systems: ['pf2e'], kind: 'feat', source: 'official', name, level,
    traits: ['Barbarian'], description: '', data: { actions: 'Single Action' }, effects: [], updatedAt: 1,
  }
  const c: Character = {
    ...emptyRanger(), className: 'Barbarian', level: 20, raging: true,
    extraSlots: [{ category: 'class', level: 20, count: 1 }],
    feats: [{ name, type: 'Class Feat', level, slot: 'class:20:0' }],
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['class']} />)
    .replaceAll('&#x27;', "'")
  expect(markup).toContain(`aria-label="${name} options"`)
  expect(markup).toContain('<dialog')
  if (name === "Giant's Stature") expect(markup).toContain('aria-label="Giant\'s Stature size"')
  else expect(markup).toContain(`aria-label="${name} active"`)
})

it('preserves dormant Ancestral Paragon choices during edits and removes the child only when its granting feat is removed', () => {
  let c: Character = { ...emptyRanger(), ancestry: 'Elf',
    feats: [
      { name: 'Ancestral Paragon', type: 'General Feat', level: 3, slot: 'general:3:0' },
      { name: 'Elven Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:g3' },
      { name: 'Class Choice', type: 'Class Feat', level: 1, slot: 'class:1:0' },
    ],
  }
  const tree = (categories: ('class' | 'general')[]) => FeatSlots({ c, categories, entries: [], save: (patch) => { c = { ...c, ...patch } } })
  findButton(tree(['class']), 'Clear L01 Class feat selection')!()
  expect(c.feats.map((feat) => feat.name)).toEqual(['Ancestral Paragon', 'Elven Lore'])
  expect(plannedSlots(c).some((slot) => slot.key === 'ancestry:1:g3')).toBe(false)
  c = JSON.parse(JSON.stringify({ ...c, level: 3 }))
  expect(plannedSlots(c).find((slot) => slot.key === 'ancestry:1:g3')).toMatchObject({ level: 3, maxFeatLevel: 1 })
  findButton(tree(['general']), 'Clear L03 General feat selection')!()
  expect(c.feats).toEqual([])
})

it('selects Skill Training together with its skill through a standard feat slot', () => {
  let c: Character = { ...emptyRanger(), level: 3 }
  const entries: ContentEntry[] = [{
    id: 'skill-training', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Skill Training', level: 1,
    traits: ['General', 'Skill'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }]
  const choose = findSelect(FeatSlots({
    c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['skill'],
  }), 'L02 Skill feat')!
  choose({ target: { value: JSON.stringify(['Skill Training', 'Stealth']) } })
  expect(c.feats).toEqual([{ name: 'Skill Training', type: 'Skill Feat', level: 1, slot: 'skill:2:0', choice: 'Stealth', sourceId: 'skill-training' }])
})

it('blocks unmet feat chains while preserving and flagging existing selections after a prerequisite is removed', () => {
  const entries: ContentEntry[] = [
    { id: 'parent', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Barreling Charge', level: 4, traits: ['Barbarian'], data: {}, description: '', effects: [], updatedAt: 1 },
    { id: 'child', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Overpowering Charge', level: 10, traits: ['Barbarian'], data: { prerequisite: 'Barreling Charge' }, description: '', effects: [], updatedAt: 1 },
  ]
  let c: Character = { ...emptyRanger(), className: 'Barbarian', level: 10, feats: [
    { name: 'Barreling Charge', type: 'Class Feat', level: 4, slot: 'class:4:0' },
    { name: 'Overpowering Charge', type: 'Class Feat', level: 10, slot: 'class:10:0' },
  ] }
  const tree = () => FeatSlots({ c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  expect(renderToStaticMarkup(tree())).not.toContain('Prerequisites unmet')
  findButton(tree(), 'Clear L04 Class feat selection')!()
  expect(c.feats.map((feat) => feat.name)).toEqual(['Overpowering Charge'])
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Prerequisites unmet: Barreling Charge')
  expect(markup).toContain('Overpowering Charge <span role="img" aria-label="Prerequisites unmet">*</span></button>')
  c = { ...c, feats: [] }
  findSelect(tree(), 'L10 Class feat')!({ target: { value: 'Overpowering Charge' } })
  expect(c.feats).toEqual([])
})

it.each([
  ['class', 'Class', 1, ['Barbarian']],
  ['ancestry', 'Ancestry', 1, ['Human']],
  ['skill', 'Skill', 2, ['General', 'Skill']],
  ['general', 'General', 3, ['General']],
] as const)('shows unmet %s feats with their missing skill instead of hiding them', (category, label, level, traits) => {
  const entry: ContentEntry = {
    id: 'target', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Needs Training', level: 1,
    traits: [...traits], data: { prerequisite: 'trained in Athletics' }, description: '', effects: [], updatedAt: 1,
  }
  let c: Character = { ...emptyRanger(), className: 'Barbarian', ancestry: 'Human', level: 3 }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [entry], save, categories: [category] })
  expect(renderToStaticMarkup(tree())).toContain('value="Needs Training" disabled="">Needs Training * Missing trained in Athletics</option>')
  findSelect(tree(), `L0${level} ${label} feat`)!({ target: { value: entry.name } })
  expect(save).not.toHaveBeenCalled()
  c = { ...c, skillPicks: ['Athletics'] }
  expect(renderToStaticMarkup(tree())).toContain('value="Needs Training">Needs Training</option>')
  findSelect(tree(), `L0${level} ${label} feat`)!({ target: { value: entry.name } })
  expect(c.feats).toHaveLength(1)
})

it('lists every confirmed missing prerequisite and updates the label as requirements are met', () => {
  const target: ContentEntry = {
    id: 'target', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Dragon Howl', level: 2,
    traits: ['Barbarian'], data: { prerequisite: 'dragon instinct, trained in Intimidation' }, description: '', effects: [], updatedAt: 1,
  }
  const entries = [target, { ...target, id: 'dragon', kind: 'subclass' as const, name: 'Dragon', data: { class: 'Barbarian' } }]
  const c: Character = { ...emptyRanger(), className: 'Barbarian', subclass: 'Fury', level: 2 }
  const render = (character: Character) => renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={() => {}} categories={['class']} />)
  expect(render(c)).toContain('Dragon Howl * Missing dragon instinct; trained in Intimidation')
  expect(render({ ...c, skillPicks: ['Intimidation'] })).toContain('Dragon Howl * Missing dragon instinct</option>')
  expect(render({ ...c, subclass: 'Dragon', skillPicks: ['Intimidation'] })).toContain('value="Dragon Howl">Dragon Howl</option>')
})

it('hides unowned archetype feats, keeps Dedication choices, and shows other unmet requirements for owned archetypes', () => {
  const child: ContentEntry = {
    id: 'child', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Defend Mount', level: 4,
    traits: ['Archetype'], data: { archetype: 'Cavalier', prerequisite: 'Cavalier Dedication, trained in Athletics' },
    description: '', effects: [], updatedAt: 1,
  }
  const dedication: ContentEntry = { ...child, id: 'dedication', name: 'Cavalier Dedication', level: 2,
    traits: ['Archetype', 'Dedication'], data: { archetype: 'Cavalier' } }
  let c: Character = { ...emptyRanger(), level: 4 }
  const save = vi.fn()
  const tree = (type = 'archetype') => FeatSlots({ c, entries: [dedication, child], save, categories: ['archetype'],
    search: { 'archetype:4:0:open': '1', 'archetype:4:0:type': type } })
  expect(renderToStaticMarkup(tree())).not.toContain(child.name)
  expect(renderToStaticMarkup(tree('dedication'))).toContain('L04 Dedication: Cavalier Dedication')
  c = { ...c, feats: [{ name: dedication.name, type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' }] }
  const label = 'L04 Dedication: Defend Mount * Missing trained in Athletics'
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${label}" disabled=""`)
  findButton(tree(), label)!()
  expect(save).not.toHaveBeenCalled()
  c = { ...c, level: 6, feats: [{ ...c.feats[0], takenLevel: 6, slot: 'archetype:6:0' }] }
  expect(renderToStaticMarkup(tree())).not.toContain(child.name)
})

it('shows missing prerequisites even when the feat currently has no available subchoices', () => {
  const entry: ContentEntry = {
    id: 'third', systems: ['pf2e'], kind: 'feat', source: 'homebrew', name: 'Third Innovation', level: 16,
    traits: ['Inventor'], data: { prerequisite: 'Second Innovation' }, description: '', effects: [], updatedAt: 1,
  }
  const c: Character = { ...emptyRanger(), className: 'Inventor', level: 16 }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[entry]} save={() => {}} categories={['class']} />)
  expect(markup).toContain('value="Third Innovation" disabled="">Third Innovation * Missing Second Innovation</option>')
})

it('marks only the affected feat and shows its missing prerequisites above the description in its dialog', () => {
  const names = ['Draconic Arrogance', 'Moment of Clarity', 'Raging Intimidation', 'Raging Thrower', 'Sudden Charge']
  const entries = names.map<ContentEntry>((name) => ({
    id: name, systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits: ['Barbarian'], data: { prerequisite: name === 'Draconic Arrogance' ? 'dragon instinct' : '' },
    description: `${name} rules text.`, effects: [], updatedAt: 1,
  }))
  entries.push({
    ...entries[0], id: 'dragon', kind: 'subclass', name: 'Dragon', data: { class: 'Barbarian' },
  })
  const c: Character = {
    ...emptyRanger(), className: 'Barbarian', subclass: 'Fury', level: 2,
    feats: names.map((name, index) => ({ name, type: 'Class Feat', level: 1, slot: `class:1:${index}` })),
    extraSlots: [{ category: 'class', level: 1, count: 4 }],
  }
  const render = (character: Character) =>
    renderToStaticMarkup(<FeatSlots c={character} entries={entries} save={() => {}} categories={['class']} />)
  const markup = render(c)
  const rows = markup.match(/<li class="feat-slot-row[^"]*">[\s\S]*?<\/li>/g) ?? []
  const affected = rows.find((row) => row.includes('Draconic Arrogance <span'))
  expect(affected).toBeDefined()
  expect(affected).toContain('aria-label="Prerequisites unmet">*</span></button>')
  const dialog = /<dialog[\s\S]*?<\/dialog>/.exec(affected!)?.[0]
  expect(dialog).toContain('Prerequisites unmet: dragon instinct')
  expect(dialog).toContain('Draconic Arrogance rules text.')
  expect(dialog!.indexOf('Prerequisites unmet')).toBeLessThan(dialog!.indexOf('Draconic Arrogance rules text.'))
  expect(affected!.replace(/<dialog[\s\S]*?<\/dialog>/g, '')).not.toContain('Prerequisites unmet:')
  for (const name of names.slice(1)) {
    const row = rows.find((row) => row.includes(`>${name}</button>`))
    expect(row).toBeDefined()
    expect(row).not.toContain('feat-prerequisite-note')
    expect(row).not.toContain('aria-label="Prerequisites unmet"')
  }
  expect(render({ ...c, subclass: 'Dragon' })).not.toContain('Prerequisites unmet')
})

it('labels narrative prerequisites for manual review instead of claiming they are enforced', () => {
  const feat: ContentEntry = {
    id: 'wings', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Winged Warrior Dedication', level: 1,
    traits: ['General'], data: { prerequisite: 'you have permanent wings' }, description: '', effects: [], updatedAt: 1,
  }
  const c: Character = { ...emptyRanger(), level: 3, feats: [{ name: feat.name, type: 'General Feat', level: 1, slot: 'general:3:0' }] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['general']} />)
  expect(markup).not.toContain('aria-label="Prerequisites unmet"')
  const dialog = /<dialog[\s\S]*?<\/dialog>/.exec(markup)?.[0]
  expect(dialog).toContain('Check prerequisites manually: you have permanent wings')
  expect(markup.replace(/<dialog[\s\S]*?<\/dialog>/g, '')).not.toContain('Check prerequisites manually:')
  expect(markup).not.toContain('Prerequisites unmet')
  expect(renderToStaticMarkup(<FeatSlots c={{ ...c, feats: [] }} entries={[feat]} save={() => {}} categories={['general']} />))
    .toContain('Winged Warrior Dedication (check prerequisites)')
})

it('does not request manual prerequisite review for Numb to Death', () => {
  const diehard: ContentEntry = {
    id: 'diehard', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Diehard', level: 1,
    traits: ['General'], data: {}, description: '', effects: [], updatedAt: 1,
  }
  const numb: ContentEntry = { ...diehard, id: 'numb', name: 'Numb to Death', level: 7,
    data: { prerequisite: 'Diehard; you have died at least once' } }
  const c: Character = { ...emptyRanger(), level: 7,
    feats: [{ name: 'Diehard', type: 'General Feat', level: 3, slot: 'general:3:0' }] }
  const entries = [diehard, numb]
  const available = renderToStaticMarkup(<FeatSlots c={c} entries={entries} save={() => {}} categories={['general']} />)
  expect(available).toContain('Numb to Death')
  expect(available).not.toContain('Numb to Death (check prerequisites)')
  const selected = { ...c, feats: [...c.feats, { name: numb.name, type: 'General Feat', level: 7, slot: 'general:7:0' }] }
  expect(renderToStaticMarkup(<FeatSlots c={selected} entries={entries} save={() => {}} categories={['general']} />))
    .not.toContain('Check prerequisites manually')
})

it.each([
  ['class', 'Druid', 'Human', 'Current Spell', 'Elementalist Dedication'],
  ['ancestry', 'Ranger', 'Dragonblood', 'Draconic Scent', 'Dragon Disciple Dedication'],
] as const)('uses the selected %s feat source instead of an unrelated archetype with the same name', (category, className, ancestry, name, prerequisite) => {
  const feat: ContentEntry = {
    id: 'selected', systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits: [category === 'class' ? className : ancestry], data: {}, description: 'Selected source.', effects: [], updatedAt: 1,
  }
  const wrong: ContentEntry = { ...feat, id: 'other', traits: ['Archetype'], data: { prerequisite }, description: 'Other source.' }
  const level = category === 'class' ? 20 : 17
  const c: Character = {
    ...emptyRanger(), className, ancestry: category === 'ancestry' ? 'Human' : ancestry,
    heritage: category === 'ancestry' ? ancestry : undefined, level,
    feats: [{ name, type: `${category === 'class' ? 'Class' : 'Ancestry'} Feat`, level: 1, slot: `${category}:${level}:0` }],
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[wrong, feat, { ...feat, id: 'parent', name: prerequisite }]}
    save={() => {}} categories={[category]} />)
  expect(markup).not.toContain('aria-label="Prerequisites unmet"')
  expect(markup).not.toContain('feat-prerequisite-note')
  expect(markup).toContain('Selected source.')
  expect(markup).not.toContain('Other source.')
})

it('preserves an adopted ancestry source and leaves ambiguous versions for manual review instead of inventing a failure', () => {
  const feat: ContentEntry = {
    id: 'shirren', systems: ['sf2e'], kind: 'feat', source: 'official', name: 'Linguistic Prodigy', level: 1,
    traits: ['Shirren'], data: {}, description: 'Shirren source.', effects: [], updatedAt: 1,
  }
  const human: ContentEntry = {
    ...feat, id: 'human', traits: ['Human'], data: { prerequisite: 'Trained in Society' }, description: 'Human source.',
  }
  const c: Character = {
    ...emptyRanger(), systems: ['sf2e'], ancestry: 'Human', level: 5, entryIds: [feat.id],
    feats: [
      { name: 'Adopted Ancestry', type: 'General Feat', level: 1, slot: 'general:3:0', choice: 'Shirren' },
      { name: feat.name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' },
    ],
  }
  const render = (character: Character) =>
    renderToStaticMarkup(<FeatSlots c={character} entries={[human, feat]} save={() => {}} categories={['ancestry']} />)
  expect(render(c)).toContain('Shirren source.')
  expect(render(c)).not.toContain('Human source.')
  expect(render(c)).not.toContain('feat-prerequisite-note')
  const ambiguous = render({ ...c, entryIds: [] })
  expect(ambiguous).not.toContain('aria-label="Prerequisites unmet"')
  expect(ambiguous).toContain('Check prerequisites manually: Verify source version of Linguistic Prodigy')
})

it.each(['standard', 'extra'])('removes an empty %s selector without confirmation or losing other selections', (kind) => {
  vi.mocked(window.confirm).mockReturnValue(false)
  let c: Character = { ...emptyRanger(), extraSlots: [{ category: 'class', level: 1, count: 2 }],
    feats: [{ name: 'Keep', type: 'Class Feat', level: 1, slot: 'class:1:2' }] }
  const tree = () => FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  const label = kind === 'standard' ? 'Remove L01 Class feat slot 0' : 'Remove L01 Class extra feat slot 1'
  findButton(tree(), label)!()
  expect(window.confirm).not.toHaveBeenCalled()
  expect(plannedSlots(c).filter((slot) => slot.category === 'class')).toHaveLength(2)
  expect(c.feats.map((feat) => feat.name)).toEqual(['Keep'])
})

it('shows an add-slot control on every visible feat row', () => {
  const c: Character = { ...emptyRanger(), extraSlots: [{ category: 'class', level: 1, count: 1 }],
    feats: [{ name: 'Keep', type: 'Class Feat', level: 1, slot: 'class:1:0' }] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[]} save={() => {}} categories={['class']} />)
  expect(markup.match(/aria-label="Add L01 Class feat slot"/g)).toHaveLength(2)
})

it('still confirms selected-feat removals and preserves them when canceled', () => {
  vi.mocked(window.confirm).mockReturnValue(false)
  let c: Character = { ...emptyRanger(), feats: [{ name: 'Keep', type: 'Class Feat', level: 1, slot: 'class:1:0' }] }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = () => FeatSlots({ c, entries: [], save, categories: ['class'] })
  findButton(tree(), 'Clear L01 Class feat selection')!()
  expect(window.confirm).toHaveBeenCalledOnce()
  expect(save).not.toHaveBeenCalled()
  expect(c.feats[0].name).toBe('Keep')
})

it('removes a standard row among extra slots, clears the final row, and restores a dismissed row with plus', () => {
  let c: Character = {
    ...emptyRanger(), extraSlots: [{ category: 'class', level: 1, count: 1 }],
    feats: [
      { name: 'First', type: 'Class Feat', level: 1, slot: 'class:1:0' },
      { name: 'Second', type: 'Class Feat', level: 1, slot: 'class:1:1' },
    ],
  }
  const tree = () => FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  const remove = findButton(tree(), 'Remove L01 Class feat slot 0')
  if (!remove) throw new Error('Missing standard slot minus')
  remove()
  expect(c.feats.map((feat) => feat.name)).toEqual(['Second'])
  expect(plannedSlots(c).filter((slot) => slot.category === 'class').map((slot) => slot.key)).toEqual(['class:1:1'])
  const clear = findButton(tree(), 'Clear L01 Class feat selection')
  if (!clear) throw new Error('Missing final slot minus')
  clear()
  expect(c.feats).toEqual([])
  expect(c.extraSlots).toEqual([{ category: 'class', level: 1, count: 1 }])
  expect(findSelect(tree(), 'L01 Class feat')).toBeDefined()
  const add = findButton(tree(), 'Add L01 Class feat slot')
  if (!add) throw new Error('Missing plus')
  add()
  expect(c.dismissedFeatSlots).toEqual([])
  expect(plannedSlots(c).filter((slot) => slot.category === 'class')).toHaveLength(2)
})

it('restores a dismissed standard slot when its remaining feat-granted row disappears', () => {
  let c: Character = {
    ...emptyRanger(), dismissedFeatSlots: ['class:1:0'], entryIds: ['ambition', 'child'],
    feats: [
      { name: 'Natural Ambition', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
      { name: 'Child', type: 'Class Feat', level: 1, slot: 'class:1:g1' },
    ],
  }
  const entries: ContentEntry[] = ['Natural Ambition', 'Child'].map((name, i) => ({
    id: i ? 'child' : 'ambition', systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
    traits: [], description: '', data: {}, effects: [], updatedAt: 1,
  }))
  const clear = findButton(FeatSlots({
    c, entries, save: (patch) => { c = { ...c, ...patch } }, categories: ['ancestry'],
  }), 'Clear L01 Ancestry feat selection')
  if (!clear) throw new Error('Missing ancestry minus')
  clear()
  expect(c.feats).toEqual([])
  expect(c.entryIds).toEqual([])
  expect(c.dismissedFeatSlots).toEqual([])
  expect(plannedSlots(c).filter((slot) => slot.category === 'class').map((slot) => slot.key)).toEqual(['class:1:0'])
})

it('records the actual acquisition level for a later Natural Ambition grant', () => {
  let c: Character = { ...emptyRanger(), level: 5, feats: [
    { name: 'Natural Ambition', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' },
  ] }
  const entry: ContentEntry = {
    id: 'class-feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Class Feat', level: 1,
    traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 1,
  }
  const tree = () => FeatSlots({ c, entries: [entry], save: (patch) => { c = { ...c, ...patch } }, categories: ['class'] })
  findSelect(tree(), 'L05 Class feat')!({ target: { value: entry.name } })
  expect(c.feats.find((feat) => feat.name === entry.name)).toMatchObject({ slot: 'class:1:g1', takenLevel: 5 })
  expect(plannedSlots({ ...c, level: 4 }).some((slot) => slot.key === 'class:1:g1')).toBe(false)
  expect(unslottedFeats({ ...c, level: 4 })).not.toContainEqual(c.feats.find((feat) => feat.name === entry.name))
})

it('removes only the Natural Ambition-dependent selection when the feat is removed', () => {
  let c: Character = { ...emptyRanger(), level: 5, feats: [
    { name: 'Natural Ambition', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' },
    { name: 'First Choice', type: 'Class Feat', level: 1, slot: 'class:1:g1', takenLevel: 5 },
    { name: 'Ordinary Choice', type: 'Class Feat', level: 4, slot: 'class:4:0' },
  ] }
  const tree = FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['ancestry'] })
  findButton(tree, 'Clear L05 Ancestry feat selection')!()
  expect(c.feats.map((feat) => feat.name)).toEqual(['Ordinary Choice'])
  expect(plannedSlots(c).filter((slot) => slot.category === 'class' && slot.level === 5)).toEqual([])
})

it('clears N/A without removing the final dedication slot', () => {
  let c: Character = { ...emptyRanger(), className: 'Wizard', level: 2, skippedFeatSlots: ['archetype:2:0'] }
  const tree = () => FeatSlots({ c, entries: [], save: (patch) => { c = { ...c, ...patch } }, categories: ['archetype'] })
  const clear = findButton(tree(), 'Clear L02 Dedication feat selection')
  if (!clear) throw new Error('Missing dedication minus')
  clear()
  expect(c.skippedFeatSlots).toEqual([])
  expect(plannedSlots(c).some((slot) => slot.key === 'archetype:2:0')).toBe(true)
})

it.each([
  { className: 'Ranger', feat: 'Peerless Warden', choice: 'Gluttonous Growth', label: 'Gluttonous Growth' },
  { className: 'Druid', feat: 'Order Explorer', choice: 'Flame', label: 'Flame Order' },
])('selects $feat and its choice together without a second picker', ({ className, feat, choice, label }) => {
  let c: Character = { ...emptyRanger(), className, level: 20, order: className === 'Druid' ? 'Animal' : undefined }
  const entries: ContentEntry[] = [{
    id: 'feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: feat, level: 1,
    traits: [className], description: 'Feat rules.', data: { repeatable: true }, effects: [], updatedAt: 1,
  }, {
    id: 'spell', systems: ['pf2e'], kind: 'spell', source: 'official', name: 'Gluttonous Growth', level: 9,
    traits: ['Ranger', 'Focus'], description: '', data: { warden_spell_tier: 'Peerless' }, effects: [], updatedAt: 1,
  }]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } }, categories: ['class' as const] })
  expect(renderToStaticMarkup(<FeatSlots {...props()} />)).toContain(`${feat} (${label})</option>`)
  const choose = findSelect(FeatSlots(props()), 'L01 Class feat')
  if (!choose) throw new Error('Missing feat picker')
  choose({ target: { value: JSON.stringify([feat, choice]) } })
  expect(c.feats).toEqual([{ name: feat, type: 'Class Feat', level: 1, slot: 'class:1:0', choice }])
  expect(c.entryIds).toEqual(['feat'])
  const markup = renderToStaticMarkup(<FeatSlots {...props()} />)
  expect(markup).toContain(`aria-haspopup="dialog">${feat} (${label})</button>`)
  expect(markup).not.toContain('class="feat-choice"')
})

it('omits the current class suffix while preserving the saved canonical name', () => {
  let c: Character = { ...emptyRanger(), level: 6 }
  const entries: ContentEntry[] = [{
    id: 'companion', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Incredible Companion (Ranger)', level: 6,
    traits: ['Ranger'], description: '', data: {}, effects: [], updatedAt: 1,
  }]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } }, categories: ['class' as const] })
  expect(renderToStaticMarkup(<FeatSlots {...props()} />)).toContain('value="Incredible Companion (Ranger)">Incredible Companion</option>')
  const choose = findSelect(FeatSlots(props()), 'L06 Class feat')
  if (!choose) throw new Error('Missing level six picker')
  choose({ target: { value: 'Incredible Companion (Ranger)' } })
  expect(c.feats[0].name).toBe('Incredible Companion (Ranger)')
  expect(renderToStaticMarkup(<FeatSlots {...props()} />)).toContain('aria-haspopup="dialog">Incredible Companion</button>')
})

it('greys out ineffective Canny Acumen options and refuses their selection', () => {
  let c: Character = { ...emptyRanger(), level: 3 }
  const entries: ContentEntry[] = [{
    id: 'canny', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Canny Acumen', level: 1,
    traits: ['General'], description: '', data: {}, effects: [], updatedAt: 1,
  }, {
    id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1,
    traits: [], description: '', data: { perception_proficiency: 'Expert', will_proficiency: 'Trained' }, effects: [], updatedAt: 1,
  }]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } }, categories: ['general' as const] })
  const markup = renderToStaticMarkup(<FeatSlots {...props()} />)
  expect(markup).toMatch(/<option[^>]*disabled=""[^>]*>Canny Acumen \(Perception - no improvement\)<\/option>/)
  const choose = findSelect(FeatSlots(props()), 'L03 General feat')
  if (!choose) throw new Error('Missing general picker')
  choose({ target: { value: JSON.stringify(['Canny Acumen', 'Perception']) } })
  expect(c.feats).toEqual([])
  choose({ target: { value: JSON.stringify(['Canny Acumen', 'Will']) } })
  expect(c.feats[0]).toMatchObject({ name: 'Canny Acumen', choice: 'Will' })
})

it('allows N/A in ancestry pickers and clears it when a feat is chosen', () => {
  const feat: ContentEntry = { id: 'human-choice', name: 'Human Choice', systems: ['pf2e'], kind: 'feat',
    source: 'official', level: 1, traits: ['Human'], description: '', data: {}, effects: [], updatedAt: 0 }
  let c: Character = { ...emptyRanger(), ancestry: 'Human', level: 1 }
  const search = { 'ancestry:1:0:open': '1' }
  const tree = () => FeatSlots({ c, entries: [feat], categories: ['ancestry'], search, onSearch: () => {},
    save: patch => { c = { ...c, ...patch } } })
  findButton(tree(), 'L01 Ancestry N/A')!()
  expect(c.skippedFeatSlots).toEqual(['ancestry:1:0'])
  expect(c.feats).toEqual([])
  expect(renderToStaticMarkup(tree())).toContain('<span>N/A</span>')
  findButton(tree(), 'L01 Ancestry: Human Choice')!()
  expect(c.skippedFeatSlots).toEqual([])
  expect(c.feats.map(selection => selection.name)).toEqual(['Human Choice'])
  findButton(tree(), 'L01 Ancestry N/A')!()
  expect(c.feats).toEqual([])
  expect(c.entryIds).toEqual([])
  findButton(tree(), 'Clear L01 Ancestry feat selection')!()
  expect(c.skippedFeatSlots).toEqual([])
  const native = () => FeatSlots({ c, entries: [feat], categories: ['ancestry'],
    save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(native())).toContain('<option value="N/A">N/A</option>')
  findSelect(native(), 'L01 Ancestry feat')!({ target: { value: 'N/A' } })
  expect(c.skippedFeatSlots).toEqual(['ancestry:1:0'])
  const complete = { ...c, feats: plannedSlots(c).filter(slot => slot.key !== 'ancestry:1:0')
    .map(slot => ({ name: 'Selected', type: 'Class Feat', level: slot.level, slot: slot.key })) }
  expect(builder.hasRemainingFeatSelections(complete)).toBe(false)
})

it('clears skipped granted ancestry slots when their granting feat is removed', () => {
  let c: Character = { ...emptyRanger(), systems: ['sf2e'], className: 'Witchwarper', ancestry: 'Human', level: 12,
    feats: [{ name: 'In Another Life', type: 'Class Feat', level: 12, slot: 'class:12:0' }] }
  const tree = (categories: ('ancestry' | 'class')[]) => FeatSlots({ c, entries: [], categories,
    search: { 'ancestry:1:in-another-life:open': '1' }, onSearch: () => {}, save: patch => { c = { ...c, ...patch } } })
  findButton(tree(['ancestry']), 'L12 Ancestry N/A')!()
  expect(c.skippedFeatSlots).toEqual(['ancestry:1:in-another-life'])
  findButton(tree(['class']), 'Clear L12 Class feat selection')!()
  expect(c.skippedFeatSlots).toEqual([])
})

it('persists N/A for a dedication slot without creating a feat and allows replacing it', () => {
  let c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 2, className: 'Wizard',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], updatedAt: 0,
    extraSlots: [{ category: 'archetype', level: 2, count: 1 }],
  }
  const feat: ContentEntry = {
    id: 'bard', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Bard Dedication', level: 2,
    traits: ['Archetype', 'Dedication'], description: '', data: { archetype: 'Bard' }, effects: [], updatedAt: 0,
  }
  const tree = () => FeatSlots({
    c, entries: [feat], save: (patch) => { c = { ...c, ...patch } }, categories: ['archetype'],
    search: { 'archetype:2:0:open': '1', 'archetype:2:0:type': 'dedication' }, onSearch: () => {},
  })
  const skip = findButton(tree(), 'L02 Dedication N/A')
  if (!skip) throw new Error('Missing N/A choice')
  skip()
  expect(c.skippedFeatSlots).toEqual(['archetype:2:0'])
  expect(c.feats).toEqual([])
  expect(renderToStaticMarkup(tree())).toContain('<span>N/A</span>')
  const choose = findButton(tree(), 'L02 Dedication: Bard Dedication')
  if (!choose) throw new Error('Missing dedication choice')
  choose()
  expect(c.skippedFeatSlots).toEqual([])
  expect(c.feats.map((f) => f.name)).toEqual(['Bard Dedication'])
  const skipAgain = findButton(tree(), 'L02 Dedication N/A')
  if (!skipAgain) throw new Error('Missing N/A choice')
  skipAgain()
  expect(c.feats).toEqual([])
  expect(c.entryIds).toEqual([])
  const clear = findButton(tree(), 'L02 Dedication clear')
  if (!clear) throw new Error('Missing clear choice')
  clear()
  expect(c.skippedFeatSlots).toEqual([])
})
