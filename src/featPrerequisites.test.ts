import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { additionalSkillCount, ancestryFeatTraits, automaticFeatGrants, championDevotionOptions, dailyLongevityRanks, eligibleFeats, featChoiceOptions, featLores, featPrerequisiteChecker, featSelectionPrerequisiteChecker, featTakenLevel, focusSpells, maxHp, movementSpeeds, plannedSlots, ranksAt, resistances, senses, syncOrderExplorerFeats } from './builder'
import { createFeatPrerequisiteChecker, featPrerequisiteSources, featPrerequisiteSuggestions, type PrerequisiteFacts } from './featPrerequisites'
import { mapAonHit } from './aon'
import { getSettings, updateSettings } from './settings'
import * as featChoices from './featChoices'
import * as featSpells from './featSpells'
import type { Character, ContentEntry } from './types'
import { homebrewCharacterOptions } from './supplemental'
import { normalizeConditionalSkillChoices, skillRankBudget } from './builder'

const entry = (kind: ContentEntry['kind'], name: string, data: ContentEntry['data'] = {}, level = 1, traits: string[] = []): ContentEntry =>
  ({ id: `${kind}:${name}`, systems: ['pf2e'], kind, source: 'official', name, data, level, traits, description: '', effects: [], updatedAt: 1 })
const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Prerequisite test', level: 20, className: 'Barbarian', subclass: 'Fury',
  abilities: { str: 14, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const selected = (name: string, level = 1) => ({ name, type: 'Class Feat', level: 1, slot: `class:${level}:0` })
const target = (prerequisite: string) => entry('feat', 'Target', { prerequisite }, 1, ['Barbarian'])
const check = (prerequisite: string, c = base, entries: ContentEntry[] = [], level = c.level) =>
  featPrerequisiteChecker(c, entries, level)(target(prerequisite))

it('checks Kijimuna or primal magic from a gnome heritage or feat', () => {
  const prerequisite = 'Kijimuna Gnome heritage or at least one primal innate spell from a gnome heritage or feat'
  const magic = mapAonHit({ _id: 'first-world', _source: { name: 'First World Magic', category: 'feat', level: 1, trait: ['Gnome'],
    markdown: 'Header\n\n---\n\nChoose one cantrip from the [primal](/SpellLists.aspx?Tradition=4) spell list. You can cast this cantrip as an innate spell at will.' } }, 'pf2e')!
  const light = entry('spell', 'Light', { tradition: 'primal' }, 1, ['Cantrip'])
  const heritage = { ...entry('heritage', 'Fey-Touched Gnome'), description: 'You can cast this spell as a primal innate spell at will.' }
  const otherMagic = { ...magic, id: 'other', name: 'Other Magic', traits: ['Elf'] }
  const c: Character = { ...base, ancestry: 'Gnome', level: 13,
    feats: [{ ...selected(magic.name, 1), type: 'Ancestry Feat', choice: light.name }] }
  const entries = [magic, otherMagic, light, heritage]
  for (const name of ['Arboreal Conversationalist', 'Kijimuna Whistle']) {
    const feat = entry('feat', name, { prerequisite }, 13, ['Gnome'])
    const result = (character: Character) => featPrerequisiteChecker(character, [...entries, feat])(feat)
    expect(result(c)).toEqual({ missing: [], manual: [] })
    expect(result({ ...c, feats: [], heritage: 'Kijimuna Gnome' })).toEqual({ missing: [], manual: [] })
    expect(result({ ...c, feats: [], heritage: heritage.name })).toEqual({ missing: [], manual: [] })
    expect(result({ ...c, feats: [] }).missing).toHaveLength(1)
    expect(result({ ...c, feats: [{ ...c.feats[0], name: otherMagic.name }] }).missing).toHaveLength(1)
    expect(result({ ...c, feats: [{ ...c.feats[0], choice: undefined }] }).missing).toHaveLength(1)
  }
})

it('checks Energized Font against actual Gnome innate and focus spell traditions', () => {
  const prerequisite = 'focus pool; at least one innate spell from a gnome heritage or ancestry feat that shares a tradition with at least one of your focus spells'
  const font = entry('feat', 'Energized Font', { prerequisite }, 5, ['Gnome'])
  const magic = mapAonHit({ _id: 'first-world', _source: { name: 'First World Magic', category: 'feat', level: 1, trait: ['Gnome'],
    markdown: 'Header\n\n---\n\nChoose one cantrip from the [primal](/SpellLists.aspx?Tradition=4) spell list. You can cast this cantrip as an innate spell at will.' } }, 'pf2e')!
  const light = entry('spell', 'Light', { tradition: 'primal' }, 1, ['Cantrip'])
  const c: Character = { ...base, ancestry: 'Gnome', className: 'Druid', order: 'Leaf', level: 5,
    feats: [{ ...selected(magic.name), type: 'Ancestry Feat', choice: light.name }] }
  const entries = [font, magic, light]
  const result = (character: Character) => featPrerequisiteChecker(character, entries)(font)
  expect(result(c)).toEqual({ missing: [], manual: [] })
  expect(result({ ...c, feats: [] }).missing).toContain(prerequisite.split('; ')[1])
  expect(result({ ...c, feats: [{ ...c.feats[0], choice: undefined }] }).missing).toContain(prerequisite.split('; ')[1])
  expect(result({ ...c, heritage: 'Wellspring Gnome', gnomeHeritageMagic: { tradition: 'Occult' } }).missing)
    .toContain(prerequisite.split('; ')[1])
  expect(result({ ...c, order: undefined, className: 'Fighter' }).missing).toContain('focus pool')
  const otherMagic = { ...magic, traits: ['Elf'] }
  expect(featPrerequisiteChecker(c, [font, otherMagic, light])(font).missing).toContain(prerequisite.split('; ')[1])
  const unknownFocus = entry('feat', 'Unknown Focus', { grants_focus_spells: 'Unknown Spell' })
  expect(featPrerequisiteChecker({ ...c, className: 'Fighter', order: undefined,
    feats: [...c.feats, selected(unknownFocus.name)] }, [...entries, unknownFocus])(font).manual)
    .toContain(prerequisite.split('; ')[1])
})

it.each(['Disarming Intercept', 'Intercept Attack'])('recognizes Guardian class action prerequisite %s', prerequisite => {
  const interceptor = entry('feat', 'Energy Interceptor', { prerequisite }, 2, ['Guardian'])
  expect(featPrerequisiteChecker({ ...base, className: 'Guardian' }, [interceptor])(interceptor))
    .toEqual({ missing: [], manual: [] })
  expect(featPrerequisiteChecker({ ...base, className: 'Fighter' }, [interceptor])(interceptor).missing)
    .toEqual([prerequisite])
})

it('qualifies Signifer through class spellcasting or class focus spells, not item or archetype-only spells', () => {
  const signifer = entry('feat', 'Hellknight Signifer Preferment', { prerequisite: 'you have a spellcasting class feature.' })
  const wizard = entry('class', 'Wizard', { tradition: 'Arcane' })
  const focus = entry('feat', 'Class Focus Magic', { grants_focus_spells: 'Test Focus' })
  const entries = [signifer, wizard, focus]
  for (const className of ['Wizard', 'Druid', 'Champion']) {
    expect(featPrerequisiteChecker({ ...base, className }, entries)(signifer)).toEqual({ missing: [], manual: [] })
  }
  const ranger = { ...base, className: 'Ranger', feats: [selected(focus.name, 1)] }
  expect(featPrerequisiteChecker(ranger, entries)(signifer)).toEqual({ missing: [], manual: [] })
  expect(check('spellcasting class feature', ranger, entries).missing).toHaveLength(1)
  const fromArchetype = { ...ranger, className: 'Fighter',
    feats: [{ ...ranger.feats[0], type: 'Archetype Feat', slot: 'archetype:2:0' }] }
  for (const c of [fromArchetype, { ...base, className: 'Fighter', spells: [{ name: 'Light', rank: 1, cantrip: true }] }]) {
    expect(featPrerequisiteChecker(c, entries)(signifer).missing).toHaveLength(1)
  }
  expect(featPrerequisiteChecker({ ...ranger, feats: [selected(focus.name, 8)] }, entries, 6)(signifer).missing).toHaveLength(1)
})

it('does not let Consult the Stars satisfy permanent skill prerequisites', () => {
  const consult: Character = { ...base, feats: [{ ...selected('Consult the Stars'), choice: 'Deception' }] }
  expect(check('trained in Deception', consult).missing).not.toEqual([])
})

it('recognizes Laws of Mortality for Godless Healing and Mortal Healing without bypassing other prerequisites', () => {
  const battle = entry('feat', 'Battle Medicine', {}, 1, ['General', 'Skill'])
  const godless = entry('feat', 'Godless Healing', { prerequisite: 'Battle Medicine; can’t have a patron deity' }, 2, ['General', 'Skill'])
  const mortal = entry('feat', 'Mortal Healing', { prerequisite: 'Expert in Medicine; you follow the Laws of Mortality' }, 2, ['General', 'Skill'])
  const entries = [battle, godless, mortal]
  const c: Character = { ...base, level: 5, deity: 'Laws of Mortality', skillPicks: ['Medicine'],
    skillIncreases: { 3: 'Medicine' }, feats: [selected('Battle Medicine')] }
  const checkFeat = (character: Character, feat: ContentEntry) => featPrerequisiteChecker(character, entries)(feat)
  expect(checkFeat(c, godless)).toEqual({ missing: [], manual: [] })
  expect(checkFeat(c, mortal)).toEqual({ missing: [], manual: [] })
  expect(checkFeat({ ...c, feats: [] }, godless).missing).toEqual(['Battle Medicine'])
  expect(checkFeat({ ...c, skillIncreases: {} }, mortal).missing).toEqual(['Expert in Medicine'])
  for (const deity of [undefined, 'Iomedae']) {
    expect(checkFeat({ ...c, deity }, godless).manual).toEqual(['can’t have a patron deity'])
    expect(checkFeat({ ...c, deity }, mortal).manual).toEqual(['you follow the Laws of Mortality'])
  }
})

it('omits Numb to Death narrative verification while retaining Diehard and other prerequisites', () => {
  const diehard = entry('feat', 'Diehard', {}, 1, ['General'])
  const numb = entry('feat', 'Numb to Death', { prerequisite: 'Diehard; you have died at least once; trained in Medicine' }, 7, ['General'])
  const dependent = entry('feat', 'Deathly Follow-up', { prerequisite: 'Numb to Death' }, 9, ['General'])
  const entries = [diehard, numb, dependent]
  const c: Character = { ...base, level: 9, feats: [selected('Diehard')], skillPicks: ['Medicine'] }
  expect(featPrerequisiteChecker(c, entries)(numb)).toEqual({ missing: [], manual: [] })
  expect(featPrerequisiteChecker({ ...c, feats: [] }, entries)(numb).missing).toEqual(['Diehard'])
  expect(featPrerequisiteChecker({ ...c, skillPicks: [] }, entries)(numb).missing).toEqual(['trained in Medicine'])
  expect(featPrerequisiteChecker({ ...c, feats: [...c.feats, selected('Numb to Death', 7)] }, entries)(dependent))
    .toEqual({ missing: [], manual: [] })
  expect(check('you have died at least once', c, entries).manual).toEqual(['you have died at least once'])
})

it.each([
  ["Pilgrim's Token", 'Trained in Religion; follower of a specific religion', 'Trained in Religion'],
  ['Sanctify Water', 'Expert in Religion; you follow a deity with “holy” or “unholy” sanctification', 'Expert in Religion'],
  ['Exhort the Faithful', 'Expert in Religion; follower of a specific religion', 'Expert in Religion'],
  ['Battle Prayer', 'Master in Religion; you follow a deity', 'Master in Religion'],
  ['Sacred Defense', 'Master in Religion; you follow a deity', 'Master in Religion'],
])('removes %s prerequisites without changing other feats', (name, prerequisite, skillRequirement) => {
  const feat = entry('feat', name, { prerequisite }, 1, ['General', 'Skill'])
  const other = entry('feat', 'Other Feat', { prerequisite }, 1, ['General', 'Skill'])
  const c: Character = { ...base, level: 1, className: 'Fighter', deity: undefined, skillPicks: [] }
  const checkFeat = featPrerequisiteChecker(c, [feat, other])
  expect(checkFeat(feat)).toEqual({ missing: [], manual: [] })
  expect(checkFeat(other).missing).toContain(skillRequirement)
  expect(checkFeat(other).manual).toHaveLength(1)
})

it('removes Religious Talisman prerequisites for Starfinder characters', () => {
  const talisman: ContentEntry = { ...entry('feat', 'Religious Talisman',
    { prerequisite: 'Master in Religion; follower of a specific religion' }, 7, ['General', 'Skill']), systems: ['sf2e'] }
  const c: Character = { ...base, systems: ['sf2e'], deity: undefined, skillPicks: [] }
  expect(featPrerequisiteChecker(c, [talisman])(talisman)).toEqual({ missing: [], manual: [] })
})

it('checks swim-Speed prerequisites against automatically calculated movement', () => {
  const swimmer: Character = { ...base, level: 4, className: 'Druid', feats: [selected('Natural Swimmer', 4)] }
  expect(check('You have a swim Speed', swimmer)).toEqual({ missing: [], manual: [] })
  expect(check('You have a swim Speed', { ...swimmer, feats: [] }).missing).not.toEqual([])
})

it('qualifies Wetlander Lizardfolk for Marsh Runner through its swim Speed', () => {
  const marshRunner = entry('feat', 'Marsh Runner', { prerequisite: 'You have a swim Speed' })
  const wetlander: Character = { ...base, ancestry: 'Lizardfolk', heritage: 'Wetlander Lizardfolk' }
  const heritage = entry('heritage', 'Wetlander Lizardfolk')

  expect(featPrerequisiteChecker(wetlander, [heritage, marshRunner])(marshRunner)).toEqual({ missing: [], manual: [] })
})

it('plans feat-derived prerequisites only from selected build feats without activating future benefits', () => {
  const swimmer = entry('feat', 'Swift Swimmer', {}, 5, ['Lizardfolk'])
  const marsh = entry('feat', 'Marsh Runner', { prerequisite: 'You have a swim Speed' }, 1, ['Lizardfolk'])
  const entries = [swimmer, marsh]
  const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
  const c: Character = { ...base, level: 1, ancestry: 'Lizardfolk', heritage: 'Bakuwa Lizardfolk',
    feats: [{ ...selected(swimmer.name, 5), type: 'Ancestry Feat', slot: 'ancestry:5:0' }] }
  const saved = JSON.stringify(c)
  expect(movementSpeeds(c, entries).some(speed => speed.name === 'Swim')).toBe(false)
  expect(featPrerequisiteChecker(c, entries)(marsh).missing).toEqual(['You have a swim Speed'])
  expect(featSelectionPrerequisiteChecker(c, entries, slot)(marsh)).toEqual({ missing: [], manual: [] })
  expect(eligibleFeats(entries, c, slot)).toContain(marsh)
  expect(eligibleFeats(entries, { ...c, feats: [] }, slot)).not.toContain(marsh)
  expect(eligibleFeats(entries, { ...c, feats: [{ ...c.feats[0], slot: slot.key }] }, slot)).not.toContain(marsh)
  expect(JSON.stringify(c)).toBe(saved)
})

it('grants Ride from Reptile Rider', () => {
  const c: Character = { ...base, feats: [selected('Reptile Rider')] }
  expect(automaticFeatGrants(c, [])).toContainEqual({ name: 'Ride', source: 'Reptile Rider', level: 1 })
})

it('keeps Hallowed Dead and Unholy Dead mutually exclusive without a prerequisite warning', () => {
  const feats = ['Hallowed Dead', 'Unholy Dead'].map(name => entry('feat', name))
  const c: Character = { ...base, feats: [selected('Hallowed Dead')] }
  const slot = { key: 'class:2:0', category: 'class' as const, level: 2 }
  const unholyDead = feats.find(feat => feat.name === 'Unholy Dead')!
  expect(eligibleFeats(feats, c, slot, { includeUnmetPrerequisites: true })).not.toContain(unholyDead)
  expect(featSelectionPrerequisiteChecker(c, feats, slot)(unholyDead)).toEqual({ missing: [], manual: [] })
})

it.each(['The Hallowed Dead', 'Hallowed Dead'])('checks only possession of %s for Hallowed Earth', name => {
  const hallowed = entry('feat', name, { prerequisite: "You aren't unholy." }, 1, ['Necromancer'])
  const earth = entry('feat', 'Hallowed Earth', { prerequisite: 'The Hallowed Dead' }, 6, ['Necromancer'])
  const entries = [hallowed, earth]
  const c: Character = { ...base, className: 'Necromancer', level: 8, feats: [selected(name)] }
  expect(featPrerequisiteChecker(c, entries)(earth)).toEqual({ missing: [], manual: [] })
  expect(featPrerequisiteChecker({ ...c, feats: [] }, entries)(earth).missing).toEqual(['The Hallowed Dead'])
  expect(featPrerequisiteChecker({ ...c, feats: [selected(name, 8)] }, entries, 6)(earth).missing).toEqual(['The Hallowed Dead'])
  expect(featPrerequisiteChecker(c, entries)(hallowed)).toEqual({ missing: [], manual: [] })
})

it.each([
  ['The Unholy Dead', 'holy', 'Holy', 'The Hallowed Dead'],
  ['The Hallowed Dead', 'unholy', 'Unholy', 'The Unholy Dead'],
] as const)('automatically checks %s against actual sanctification and opposing feat grants', (name, forbidden, sanctification, opposing) => {
  const prerequisite = `You aren\u2019t ${forbidden}.`
  const feat = entry('feat', name, { prerequisite }, 1, ['Necromancer'])
  const c: Character = { ...base, className: 'Necromancer', level: 1 }
  const slot = { key: 'class:1:0', category: 'class' as const, level: 1 }
  expect(featSelectionPrerequisiteChecker(c, [feat], slot)(feat)).toEqual({ missing: [], manual: [] })
  expect(eligibleFeats([feat], c, slot)).toContain(feat)
  expect(featPrerequisiteChecker({ ...c, sanctification }, [feat])(feat))
    .toEqual({ missing: [prerequisite], manual: [] })
  for (const granted of [opposing, opposing.replace(/^The /, '')]) {
    const character = { ...c, feats: [{ ...selected(granted), slot: 'bonus:1:0' }] }
    expect(featPrerequisiteChecker(character, [feat])(feat)).toEqual({ missing: [prerequisite], manual: [] })
    expect(eligibleFeats([feat], character, slot, { includeUnmetPrerequisites: true })).not.toContain(feat)
  }
  const future = { ...c, feats: [selected(opposing, 8)] }
  expect(featPrerequisiteChecker(future, [feat])(feat)).toEqual({ missing: [], manual: [] })
  expect(eligibleFeats([feat], future, slot, { includeUnmetPrerequisites: true })).not.toContain(feat)
  const self = { ...c, feats: [{ ...selected(name), slot: slot.key }] }
  expect(featSelectionPrerequisiteChecker(self, [feat], slot)(feat)).toEqual({ missing: [], manual: [] })
})

it('checks Soul Thief against selected or feat-granted unholy sanctification', () => {
  const soulThief = entry('feat', 'Soul Thief', { prerequisite: 'You are unholy.' }, 20, ['Necromancer', 'Unholy'])
  const unholy = entry('feat', 'The Unholy Dead', { prerequisite: "You aren't holy." }, 1, ['Necromancer'])
  const entries = [soulThief, unholy]
  const c: Character = { ...base, className: 'Necromancer', level: 20 }
  expect(featPrerequisiteChecker(c, entries)(soulThief)).toEqual({ missing: ['You are unholy.'], manual: [] })
  expect(featPrerequisiteChecker({ ...c, sanctification: 'Unholy' }, entries)(soulThief))
    .toEqual({ missing: [], manual: [] })
  for (const name of ['The Unholy Dead', 'Unholy Dead']) {
    expect(featPrerequisiteChecker({ ...c, feats: [selected(name)] }, entries)(soulThief))
      .toEqual({ missing: [], manual: [] })
  }
  expect(featPrerequisiteChecker({ ...c, sanctification: 'Holy' }, entries)(soulThief).missing)
    .toEqual(['You are unholy.'])
})

it.each(['Hellknight Preferment', 'Hellknight Signifer Preferment', 'Hellknight-Errant'])(
  'makes %s exclusive with both other preferment paths, even when browsing unmet prerequisites', name => {
    const feats = ['Hellknight Preferment', 'Hellknight Signifer Preferment', 'Hellknight-Errant']
      .map(name => entry('feat', name, {}, 6, ['Archetype']))
    const c = { ...base, feats: [{ ...selected(name, 6), slot: 'bonus:6:0' }] }
    const slot = { key: 'bonus:12:0', category: 'bonus' as const, level: 12 }
    for (const includeUnmetPrerequisites of [false, true]) {
      expect(eligibleFeats(feats, c, slot, { includeUnmetPrerequisites })).toEqual([])
    }
    expect(featSelectionPrerequisiteChecker(c, feats, { ...slot, key: 'bonus:6:0', level: 6 })(feats.find(feat => feat.name === name)!).missing).toEqual([])
    for (const other of feats.filter(feat => feat.name !== name)) {
      expect(featSelectionPrerequisiteChecker(c, feats, slot)(other).missing.join(' ')).toContain(`cannot be combined with ${name}`)
    }
  })

it('does not recalculate spell grants for unrelated feat and attribute prerequisites', () => {
  const c: Character = { ...base, feats: [selected('Orc Ferocity')] }
  const grants = vi.spyOn(featSpells, 'grantedFeatSpells')
  try {
    expect(check('Orc Ferocity; Strength +2', c, [entry('feat', 'Orc Ferocity')])).toEqual({ missing: [], manual: [] })
    expect(grants).not.toHaveBeenCalled()
    expect(check('focus pool', { ...c, className: 'Champion' })).toEqual({ missing: [], manual: [] })
    expect(grants).toHaveBeenCalled()
  } finally { grants.mockRestore() }
})

it('grants Earned Glory Performance and Impressive Performance only after its taken level', () => {
  const feat = { name: 'Earned Glory', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' }
  const c: Character = { ...base, level: 5, ancestry: 'Human', heritage: 'Aiuvarin', feats: [feat] }
  expect(ranksAt(c, []).Performance).toBe(1)
  expect(automaticFeatGrants(c, [])).toContainEqual({ name: 'Impressive Performance', source: 'Earned Glory', level: 5 })
  expect(additionalSkillCount(c, [])).toBe(additionalSkillCount({ ...c, feats: [] }, []))
  const earlier = { ...c, level: 4 }
  expect(ranksAt(earlier, []).Performance ?? 0).toBe(0)
  expect(automaticFeatGrants(earlier, []).some(grant => grant.source === 'Earned Glory')).toBe(false)
  expect(ranksAt({ ...c, systems: ['sf2e'] }, []).Performance ?? 0).toBe(0)
})

it('recognizes the additional Elf Atavism heritage for prerequisites without discarding Aiuvarin', () => {
  const heritage = entry('heritage', 'Arctic Elf', { ancestry: 'Elf' })
  const c: Character = { ...base, ancestry: 'Human', heritage: 'Aiuvarin',
    feats: [{ name: 'Elf Atavism', type: 'Ancestry Feat', level: 1, choice: 'Arctic Elf' }] }
  expect(check('Arctic Elf heritage', c, [heritage])).toEqual({ missing: [], manual: [] })
  expect(check('Arctic Elf heritage', { ...c, feats: [] }, [heritage]).missing).not.toEqual([])
  expect(check('Arctic Elf heritage', { ...c, feats: [{ ...c.feats[0], takenLevel: 21 }] }, [heritage]).missing).not.toEqual([])
})

it.each<[string, string, string | undefined]>([
  ['Round Ears', 'Deception', undefined],
  ['Sociable', 'Diplomacy', 'Hobnobber'],
])('automates %s training, duplicate replacement tokens and its skill feat', (name, skill, bonus) => {
  const c: Character = { ...base, level: 1, feats: [{ name, type: 'Ancestry Feat', level: 1 }] }
  expect(ranksAt(c, [])[skill]).toBe(1)
  expect(automaticFeatGrants(c, [])).toEqual(bonus ? [{ name: bonus, source: name, level: 1 }] : [])
  const background = entry('background', 'Socialite', { skill })
  const duplicate = { ...c, background: background.name }
  expect(additionalSkillCount(duplicate, [background])).toBe(additionalSkillCount({ ...duplicate, feats: [] }, [background]) + 1)
  expect(skillRankBudget(duplicate, [background]).trained).toBe(1)
  expect(ranksAt({ ...duplicate, skillPicks: ['Crafting'] }, [background])).toMatchObject({ [skill]: 1, Crafting: 1 })
  const earlier = { ...c, feats: [{ ...c.feats[0], takenLevel: 5 }] }
  expect(ranksAt(earlier, [])[skill] ?? 0).toBe(0)
  expect(automaticFeatGrants(earlier, [])).toEqual([])
})

it.each(['class', 'background'] as const)('adds one reusable trained slot when Earned Glory duplicates %s Performance', source => {
  const entries = [entry('class', 'Bard', { skill_proficiency: source === 'class'
    ? 'Trained in Performance, Trained in a number of additional skills equal to 4 plus your Intelligence modifier'
    : 'Trained in a number of additional skills equal to 4 plus your Intelligence modifier' }),
  entry('background', 'Performer', { skill: 'Performance' })]
  const c: Character = { ...base, level: 1, className: 'Bard', background: source === 'background' ? 'Performer' : undefined,
    feats: [{ name: 'Earned Glory', type: 'Ancestry Feat', level: 1 }] }
  expect(additionalSkillCount(c, entries)).toBe(5)
  expect(skillRankBudget(c, entries).trained).toBe(5)
  const spent = { ...c, skillPicks: ['Diplomacy'] }
  expect(ranksAt(spent, entries)).toMatchObject({ Performance: 1, Diplomacy: 1 })
  expect(skillRankBudget(spent, entries).trained).toBe(4)
  const legacy = normalizeConditionalSkillChoices({ ...c, feats: [{ ...c.feats[0], choice: 'Diplomacy' }] }, entries)
  expect(legacy.feats[0].choice).toBeUndefined()
  expect(legacy.skillPicks).toEqual(['Diplomacy'])
  expect(skillRankBudget(legacy, entries).trained).toBe(4)
  expect(ranksAt(legacy, entries)).toMatchObject({ Performance: 1, Diplomacy: 1 })
})

it.each(['Champion', 'Fighter', 'Gunslinger', 'Monk', 'Operative', 'Ranger', 'Rogue', 'Swashbuckler'])(
  'offers Nimble Athlete only with actual expert Athletics for %s', className => {
    const feat = homebrewCharacterOptions([]).find(entry => entry.name === 'Nimble Athlete')!
    const c: Character = { ...base, systems: [className === 'Operative' ? 'sf2e' : 'pf2e'],
      className, level: 4, rankOverrides: { Athletics: 2 } }
    const slot = { key: 'class:4:0', category: 'class' as const, level: 4 }
    expect(eligibleFeats([feat], c, slot)).toContain(feat)
    expect(eligibleFeats([feat], { ...c, rankOverrides: {} }, slot)).not.toContain(feat)
    expect(eligibleFeats([feat], c, { ...slot, level: 2 })).not.toContain(feat)
    expect(eligibleFeats([feat], { ...c, className: 'Wizard' }, slot)).not.toContain(feat)
    expect(eligibleFeats([feat], c, { ...slot, category: 'general' })).not.toContain(feat)
  })

it.each([
  ['expert in Athletics', true],
  ['expert in Athletics and Stealth', false],
  ['master in Athletics', false],
  ['trained in Stealth', false],
  ['expert in Sailing Lore', true],
  ['trained in Warfare Lore', false],
  ['expert in one Lore skill', true],
  ['master in one Lore skill', false],
  ['expert in any skill', true],
  ['master in any skill', false],
] as const)('uses actual final-build ranks for %s in earlier slots', (prerequisite, allowed) => {
  const feat = target(prerequisite)
  const c: Character = { ...base, skillPicks: ['Athletics'], skillIncreases: { 15: 'Athletics', 17: 'Sailing Lore' },
    lores: [{ name: 'Sailing Lore', rank: 1 }] }
  const slot = { key: 'class:4:0', category: 'class' as const, level: 4 }
  const before = JSON.stringify(c)
  expect(ranksAt({ ...c, level: 4 }, []).Athletics).toBe(1)
  expect(ranksAt(c, [])).toMatchObject({ Athletics: 2, 'Sailing Lore': 2 })
  expect(eligibleFeats([feat], c, slot).includes(feat)).toBe(allowed)
  expect(JSON.stringify(c)).toBe(before)
})

it.each([['Greywatch', 'Deception'], ['Blackwatch', 'Occultism'], ['Palewatch', 'Religion'], ['Magewatch', 'Arcana']])('does not let %s Initiate qualify through its own skill grant', (watch, skill) => {
  const feat = homebrewCharacterOptions([]).find(entry => entry.name === `${watch} Initiate`)!
  const c: Character = { ...base, className: 'Ranger',
    feats: [{ name: feat.name, type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
  const slot = { key: 'class:4:0', category: 'class' as const, level: 4 }
  expect(ranksAt(c, [feat])[skill]).toBe(2)
  expect(featSelectionPrerequisiteChecker(c, [feat], slot)(feat).missing).toContain(`Trained in ${skill}`)
})

it('uses later allocated skills only in planning mode and leaves other prerequisites strict', () => {
  const previous = getSettings().planSkillPrerequisites
  const c: Character = { ...base, className: 'Ranger', level: 20,
    skillPicks: ['Athletics'], skillIncreases: { 15: 'Athletics' } }
  const nimble = homebrewCharacterOptions([]).find(entry => entry.name === 'Nimble Athlete')!
  const slot = { key: 'class:4:0', category: 'class' as const, level: 4 }
  try {
    updateSettings({ planSkillPrerequisites: true })
    expect(featSelectionPrerequisiteChecker(c, [nimble], slot)(nimble).missing).toEqual([])
    for (const prerequisite of ['legendary in Perception', 'legendary in Fortitude', 'legendary in heavy armor',
      'legendary with martial weapons', 'Strength +4', 'Living Weapon']) {
      expect(featSelectionPrerequisiteChecker(c, [entry('feat', 'Living Weapon')], slot)(target(prerequisite)).missing.length,
        prerequisite).toBeGreaterThan(0)
    }
    expect(featSelectionPrerequisiteChecker({ ...c, level: 2 }, [nimble], slot)(nimble).missing).toContain('expert in Athletics')
    expect(featSelectionPrerequisiteChecker({ ...c, level: 14 }, [nimble], slot)(nimble).missing).toContain('expert in Athletics')
    expect(featSelectionPrerequisiteChecker({ ...c, level: 15 }, [nimble], slot)(nimble).missing).toEqual([])
    updateSettings({ planSkillPrerequisites: false })
    expect(featSelectionPrerequisiteChecker(c, [nimble], slot)(nimble).missing).toContain('expert in Athletics')
    expect(featSelectionPrerequisiteChecker({ ...c, feats: [selected('Swift Swimmer', 9)] }, [nimble], slot)(nimble).missing)
      .toContain('expert in Athletics')
    expect(featSelectionPrerequisiteChecker({ ...c, rankOverrides: { Athletics: 2 } }, [nimble], slot)(nimble).missing).toEqual([])
  } finally { updateSettings({ planSkillPrerequisites: previous }) }
})

it('does not evaluate skill ranks for feat references or armor and weapon prerequisites', () => {
  const ranks = vi.fn(() => ({ Crafting: 1 }))
  const facts: PrerequisiteFacts = {
    className: 'Barbarian', additionalSubclasses: [], orders: [], features: [], senses: [],
    feats: [{ name: 'Earlier Feat', level: 1, category: 'class' }], abilities: base.abilities,
    armor: { Light: 1 }, weapons: { Martial: 1 }, get ranks() { return ranks() },
  }
  const earlier = entry('feat', 'Earlier Feat', { prerequisite: 'Level 1' }, 1, ['Barbarian'])
  const checker = createFeatPrerequisiteChecker([earlier], { level: 3, entryIds: [], knownOrders: [], facts: () => facts })
  for (const prerequisite of ['Earlier Feat', 'trained in light armor', 'trained with martial weapons']) {
    expect(checker(target(prerequisite)).missing).toEqual([])
  }
  expect(ranks).not.toHaveBeenCalled()
  expect(checker(target('trained in Crafting')).missing).toEqual([])
  expect(ranks).toHaveBeenCalled()
})

it.each(['Cyborg', 'SRO'])('limits Additional Arms for %s while preserving its current slot and the opt-out', trait => {
  const previous = getSettings().singleAdditionalArms
  const arms = { ...entry('feat', 'Additional Arms', { repeatable: true }, 9, [trait]), systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: trait === 'SRO' ? trait : 'Human',
    heritage: trait === 'Cyborg' ? trait : undefined,
    feats: [{ name: arms.name, type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' }] }
  const slot = { key: 'ancestry:13:0', category: 'ancestry' as const, level: 13 }
  try {
    updateSettings({ singleAdditionalArms: true })
    expect(eligibleFeats([arms], { ...c, feats: [] }, slot)).toContain(arms)
    expect(eligibleFeats([arms], c, slot, { includeUnmetPrerequisites: true })).not.toContain(arms)
    expect(eligibleFeats([arms], c, { ...slot, key: 'ancestry:9:0', level: 9 })).toContain(arms)
    expect(featSelectionPrerequisiteChecker(c, [arms], slot)(arms).missing.join()).toContain('only be selected once')
    updateSettings({ singleAdditionalArms: false })
    expect(eligibleFeats([arms], c, slot)).toContain(arms)
    expect(featSelectionPrerequisiteChecker(c, [arms], slot)(arms).missing).toEqual([])
  } finally { updateSettings({ singleAdditionalArms: previous }) }
})

it.each(['Machine Heart', 'Mortal Heart'])('optionally excludes the other Cyborg heart after %s', name => {
  const previous = getSettings().exclusiveCyborgHearts
  const data = ['Machine Heart', 'Mortal Heart'].map(name =>
    ({ ...entry('feat', name, {}, 17, ['Cyborg']), systems: ['sf2e' as const] }))
  const other = data.find(feat => feat.name !== name)!
  const selected = data.find(feat => feat.name === name)!
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Human', heritage: 'Cyborg',
    feats: [{ name, type: 'Ancestry Feat', level: 17, slot: 'ancestry:17:0' }] }
  const slot = { key: 'ancestry:19:0', category: 'ancestry' as const, level: 19 }
  try {
    updateSettings({ exclusiveCyborgHearts: true })
    expect(eligibleFeats(data, c, slot, { includeUnmetPrerequisites: true })).not.toContain(other)
    expect(eligibleFeats(data, c, { ...slot, key: 'ancestry:17:0', level: 17 })).toContain(selected)
    expect(featSelectionPrerequisiteChecker(c, data, slot)(other).missing.join()).toContain('cannot be combined')
    updateSettings({ exclusiveCyborgHearts: false })
    expect(eligibleFeats(data, c, slot)).toContain(other)
    expect(featSelectionPrerequisiteChecker(c, data, slot)(other).missing).toEqual([])
  } finally { updateSettings({ exclusiveCyborgHearts: previous }) }
})

it('plans Enhanced Senses from selected sense-granting feats but never its own effects', () => {
  const feat = { ...entry('feat', 'Enhanced Senses', { prerequisite: 'a sense with a listed range' }, 1, ['Ysoki']),
    systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Ysoki',
    feats: [{ name: 'Enhanced Olfactory System', type: 'Ancestry Feat', level: 1, slot: 'ancestry:5:0' }] }
  const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
  expect(featSelectionPrerequisiteChecker(c, [feat], slot)(feat))
    .toEqual({ missing: [], manual: [] })
  expect(eligibleFeats([feat], c, slot)).toContain(feat)
  expect(eligibleFeats([feat], { ...c, feats: [] }, slot)).not.toContain(feat)
  expect(featSelectionPrerequisiteChecker(c, [feat], { ...slot, level: 5 })(feat))
    .toEqual({ missing: [], manual: [] })
  const self = { ...feat, data: { ...feat.data, grants_vision: 'Scent (imprecise) 30 feet' } }
  expect(featSelectionPrerequisiteChecker({ ...c, feats: [
    { name: feat.name, type: 'Ancestry Feat', level: 1, slot: slot.key },
  ] }, [self], slot)(self)).toEqual({ missing: ['a sense with a listed range'], manual: [] })
})

it.each([
  ['Low-Light Vision', false], ['Darkvision', false], ['Limited Telepathy 30 feet', false],
  ['Scent (imprecise) 30 feet', true], ['Lifesense (precise) 60 feet', true],
  ['Tremorsense (imprecise) 0 feet', false],
])('recognizes a listed sense range for %s', (vision, qualifies) => {
  const c = { ...base, ancestry: 'Test' }
  expect(check('a sense with a listed range', c, [entry('ancestry', 'Test', { vision })]))
    .toEqual({ missing: qualifies ? [] : ['a sense with a listed range'], manual: [] })
})

it.each([
  ['Maraquoi', 'Dermal Hearing', 30], ['Moyishuu', 'Emotionsense', 20], ['Talphi', 'Scent', 30],
] as const)('uses the native %s sense for Enhanced Senses without granting adopted physiology', (ancestry, sense, feet) => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry, level: 1, feats: [] }
  expect(check('a sense with a listed range', c)).toEqual({ missing: [], manual: [] })
  expect(senses({ ...c, feats: [{ name: 'Enhanced Senses', type: 'Ancestry Feat', level: 1 }] }, []))
    .toContainEqual({ value: `${sense} (imprecise) ${feet + 30} feet`, source: `${ancestry}, Enhanced Senses` })
  expect(check('a sense with a listed range', { ...c, ancestry: 'Human',
    feats: [{ name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: ancestry }] }).missing)
    .toEqual(['a sense with a listed range'])
})

it('requires the Acid Quake heritage for the restricted Fonqugon Enhanced Senses source', () => {
  const feat = { ...entry('feat', 'Enhanced Senses', { prerequisite: 'a sense with a listed range' }, 1, ['Fonqugon']),
    systems: ['sf2e' as const], description: 'Option(s): acid quake fonqugon heritage only' }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Fonqugon', heritage: 'Acid Quake Fonqugon', level: 1, feats: [] }
  const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
  expect(featSelectionPrerequisiteChecker(c, [feat], slot)(feat)).toEqual({ missing: [], manual: [] })
  expect(featSelectionPrerequisiteChecker({ ...c, heritage: 'Cyborg',
    feats: [{ name: 'Enhanced Olfactory System', type: 'Ancestry Feat', level: 1 }] }, [feat], slot)(feat).missing)
    .toEqual(['acid quake fonqugon heritage'])
})

it('defers compound-name matching regex creation during feat source lookup', () => {
  const entries = [entry('feat', 'Alpha and Beta', {}, 1, ['General'])]
  const NativeRegExp = globalThis.RegExp
  class GuardedRegExp extends NativeRegExp {
    constructor(pattern: string | RegExp, flags?: string) {
      if (typeof pattern === 'string' && pattern.startsWith('(^|[^a-z0-9])')) {
        throw new Error('Compound-name matcher should not be needed for source lookup')
      }
      super(pattern, flags)
    }
  }
  vi.stubGlobal('RegExp', GuardedRegExp)
  try {
    expect(featPrerequisiteSources(entries, { name: 'Alpha and Beta', entryIds: [], category: 'general' })).toEqual(entries)
  } finally {
    vi.unstubAllGlobals()
  }
})

it('checks champion blessing prerequisites at the feat selection level', () => {
  const c: Character = { ...base, className: 'Champion', blessing: 'Blessed Shield',
    feats: [{ ...selected('Second Blessing', 8), choice: 'Blessed Armament' }] }
  expect(check('blessed shield', c, [], 2).missing).toEqual(['blessed shield'])
  expect(check('blessed shield', c, [], 3).missing).toEqual([])
  expect(check('blessed armament', c, [], 7).missing).toEqual(['blessed armament'])
  expect(check('blessed armament', c, [], 8).missing).toEqual([])
  expect(check('blessed swiftness', c).missing).toEqual(['blessed swiftness'])
})

it('grants trained Crafting from Munitions Crafter without lowering existing proficiency', () => {
  const c: Character = { ...base, className: 'Gunslinger', level: 1, feats: [selected('Munitions Crafter')] }
  expect(ranksAt(c, []).Crafting).toBe(1)
  expect(ranksAt({ ...c, rankOverrides: { Crafting: 3 } }, []).Crafting).toBe(3)
  expect(ranksAt({ ...c, level: 0 }, []).Crafting).toBeUndefined()
})

it("grants Officer's Medical Training skills and Battle Medicine at the feat's level", () => {
  const name = "Officer's Medical Training"
  const c: Character = { ...base, className: 'Commander', level: 1, feats: [selected(name)] }
  expect(ranksAt(c, []).Medicine).toBe(1)
  expect(automaticFeatGrants(c, [])).toContainEqual({ name: 'Battle Medicine', source: name, level: 1 })
  expect(check('Battle Medicine', c)).toEqual({ missing: [], manual: [] })
  expect(ranksAt({ ...c, level: 0 }, []).Medicine ?? 0).toBe(0)
  expect(automaticFeatGrants({ ...c, level: 0 }, []).some(grant => grant.name === 'Battle Medicine')).toBe(false)

  const healer = entry('background', 'Healer', { skill: 'Medicine' })
  const already = { ...c, background: 'Healer', feats: [{ ...c.feats[0], choice: 'Society' }] }
  expect(featChoiceOptions(name, already, [healer], 'class:1:0', 0)).toContain('Society')
  expect(featChoiceOptions(name, already, [healer], 'class:1:0', 0)).not.toContain('Medicine')
  expect(ranksAt(already, [healer])).toMatchObject({ Medicine: 1, Society: 1 })
  expect(ranksAt({ ...already, feats: [{ ...already.feats[0], choice: 'Medicine' }] }, [healer]).Society ?? 0).toBe(0)
  expect(ranksAt({ ...already, feats: [] }, [healer]).Society ?? 0).toBe(0)

  const lore = { ...already, lores: [{ name: 'Sailing Lore', rank: 0 }], feats: [{ ...already.feats[0], choice: 'Sailing Lore' }] }
  expect(featChoiceOptions(name, lore, [healer], 'class:1:0', 0)).toContain('Sailing Lore')
  expect(ranksAt(lore, [healer])['Sailing Lore']).toBe(1)
  expect(ranksAt({ ...lore, lores: [] }, [healer])['Sailing Lore']).toBe(1)
  const previous = getSettings()
  try {
    updateSettings({ autoLores: true, autoClassSkills: false })
    expect(ranksAt({ ...lore, level: 7, lores: [] }, [healer])['Sailing Lore']).toBe(3)
  } finally { updateSettings(previous) }
})

it('grants Shield Block from matching class features or the Warpriest doctrine', () => {
  const classes = ['Champion', 'Fighter', 'Druid', 'Inventor', 'Exemplar', 'Commander', 'Guardian', 'Runesmith']
  const features = classes.map(name => ({ ...entry('classFeature', 'Shield Block', { class: name }), id: `shield:${name}` }))
  for (const className of classes) {
    const c = { ...base, level: 1, className }
    expect(automaticFeatGrants(c, features)).toContainEqual({ name: 'Shield Block', source: className, level: 1 })
    expect(check('Shield Block', c, features)).toEqual({ missing: [], manual: [] })
    expect(automaticFeatGrants({ ...c, level: 0 }, features)).not.toContainEqual(expect.objectContaining({ name: 'Shield Block' }))
  }
  const cleric = { ...base, level: 1, className: 'Cleric', subclass: 'Warpriest' }
  expect(automaticFeatGrants(cleric, features)).toContainEqual({ name: 'Shield Block', source: 'Warpriest', level: 1 })
  expect(check('Shield Block', cleric, features)).toEqual({ missing: [], manual: [] })
  expect(automaticFeatGrants({ ...cleric, subclass: 'Cloistered Cleric' }, features))
    .not.toContainEqual(expect.objectContaining({ name: 'Shield Block' }))
  expect(automaticFeatGrants({ ...cleric, systems: ['sf2e'] }, features))
    .not.toContainEqual(expect.objectContaining({ name: 'Shield Block' }))
  const fighter = { ...base, level: 1, className: 'Fighter' }
  const feature = features.find(item => item.data.class === 'Fighter')!
  expect(automaticFeatGrants(fighter, [{ ...feature, id: 'foreign', systems: ['sf2e'] }, feature]))
    .toContainEqual({ name: 'Shield Block', source: 'Fighter', level: 1 })
})

it("recognizes simple-weapon training for Clan's Edge's clan dagger prerequisite", () => {
  const wizard = entry('class', 'Wizard', { attack_proficiency: 'Trained in simple weapons' })
  const clanEdge = entry('feat', "Clan's Edge", { prerequisite: 'Trained in clan daggers' }, 1, ['Dwarf'])
  const dwarf = { ...base, className: 'Wizard', ancestry: 'Dwarf', level: 1 }
  expect(featPrerequisiteChecker(dwarf, [wizard, clanEdge])(clanEdge)).toEqual({ missing: [], manual: [] })
  expect(featPrerequisiteChecker({ ...dwarf, className: 'Witch' }, [clanEdge])(clanEdge))
    .toEqual({ missing: ['Trained in clan daggers'], manual: [] })
})

it('checks champion sanctification and devotion spell prerequisites from actual choices', () => {
  const deity = entry('deity', 'Patron', { divine_font: 'Heal', sanctification: 'holy, unholy' })
  const c: Character = { ...base, className: 'Champion', deity: deity.name, sanctification: 'Holy', devotionSpell: 'Lay on Hands' }
  const entries = [deity]
  expect(championDevotionOptions(c, entries)).toEqual(['Shields of the Spirit', 'Lay on Hands'])
  expect(focusSpells(c, entries)).toMatchObject({ points: 1, spells: [{ name: 'Lay On Hands', source: 'Devotion Spells' }] })
  expect(check('holy', c, entries).missing).toEqual([])
  expect(check('unholy', c, entries).missing).toEqual(['unholy'])
  expect(check("you aren't unholy", c, entries).missing).toEqual([])
  expect(check('devotion spell (_lay on hands_)', c, entries).missing).toEqual([])
  expect(check('_touch of the void_', c, entries).missing).toEqual(['_touch of the void_'])
  expect(check('holy', c).manual).toEqual(['holy'])
  const unsanctified = { ...c, sanctification: undefined, devotionSpell: 'Touch of the Void' as const }
  expect(check('holy', unsanctified, entries).missing).toEqual(['holy'])
  expect(focusSpells(unsanctified, entries).spells).toEqual([])
  expect(check('champion’s aura', c, entries).missing).toEqual([])
  const justice = { ...c, subclass: 'Justice' }
  const resistance = 'champion’s reaction that grants an ally resistance to an enemy’s damage (including the grandeur, justice, liberation, and redemption causes)'
  const strike = 'champion’s reaction that grants extra damage with your Strikes (including the desecration, iniquity, and obedience causes)'
  expect(check(resistance, justice, entries).missing).toEqual([])
  expect(check(strike, justice, entries).missing).toEqual([strike])
  expect(check(resistance, { ...c, subclass: 'Iniquity' }, entries).missing).toEqual([resistance])
  expect(check(resistance, c, entries).manual).toEqual([resistance])
  const oath = entry('feat', 'Oath', {}, 2, ['Champion', 'Oath'])
  const sworn = { ...c, feats: [selected('Oath', 2)] }
  expect(check('Any feat with the oath trait', sworn, [oath], 1).missing).toHaveLength(1)
  expect(check('Any feat with the oath trait', sworn, [oath], 2).missing).toEqual([])
})

it.each(['Champion', 'Cleric'])('checks Holy Light against the %s deity rather than personal sanctification', className => {
  const holyLight = entry('feat', 'Holy Light', { prerequisite: 'you follow a good-aligned deity' }, 10, ['Champion', 'Cleric'])
  const c: Character = { ...base, className, deity: 'Patron', sanctification: 'Holy' }
  const slot = { key: 'class:10:0', category: 'class' as const, level: 10 }
  for (const alignment of ['LG', 'NG', 'CG', 'LE', 'NE', 'CE', 'LN', 'N', 'CN']) {
    const deity = entry('deity', c.deity!, { alignment, sanctification: 'holy, unholy' })
    const entries = [deity, holyLight]
    const allowed = alignment.endsWith('G')
    expect(featPrerequisiteChecker(c, entries)(holyLight))
      .toEqual({ missing: allowed ? [] : ['you follow a good-aligned deity'], manual: [] })
    expect(eligibleFeats(entries, c, slot).includes(holyLight)).toBe(allowed)
    expect(eligibleFeats(entries, { ...c, sanctification: undefined }, slot).includes(holyLight)).toBe(allowed)
  }
  expect(featPrerequisiteChecker({ ...c, deity: undefined }, [holyLight])(holyLight).missing)
    .toEqual(['you follow a good-aligned deity'])
  expect(featPrerequisiteChecker(c, [holyLight])(holyLight))
    .toEqual({ missing: [], manual: ['you follow a good-aligned deity'] })
})

it('requires Fiendsbane Oath and its good tenets for Banishing Blow', () => {
  const oath = entry('feat', 'Fiendsbane Oath', { prerequisite: 'tenets of good' }, 2, ['Champion', 'Oath'])
  const blow = entry('feat', 'Banishing Blow', { prerequisite: oath.name }, 20, ['Champion'])
  const entries = [oath, blow]
  const c: Character = { ...base, className: 'Champion', subclass: 'Justice', feats: [selected(oath.name, 2)] }
  const slot = { key: 'class:20:0', category: 'class' as const, level: 20 }
  expect(eligibleFeats(entries, c, slot)).toContain(blow)
  expect(featPrerequisiteChecker({ ...c, feats: [] }, entries)(blow))
    .toEqual({ missing: [oath.name], manual: [] })
  for (const subclass of ['Obedience', 'Tyrant']) {
    const tyrant = { ...c, subclass, legacyTenetsOfGood: true }
    expect(featPrerequisiteChecker(tyrant, entries)(blow)).toEqual({ missing: ['tenets of good'], manual: [] })
    expect(eligibleFeats(entries, tyrant, slot)).not.toContain(blow)
  }
})

it.each([
  ['Lasting Doubt', 'redeemer cause', 'Redemption', 'Redeemer'],
  ['Liberating Stride', 'liberator cause', 'Liberation', 'Liberator'],
])('checks %s automatically for remastered and legacy Champion causes', (name, prerequisite, remastered, legacy) => {
  const feat = entry('feat', name, { prerequisite }, 12, ['Champion'])
  const evaluate = (className: string, subclass?: string) =>
    featPrerequisiteChecker({ ...base, className, subclass }, [feat])(feat)
  for (const cause of [remastered, legacy]) expect(evaluate('Champion', cause)).toEqual({ missing: [], manual: [] })
  for (const cause of ['Justice', 'Grandeur', 'Redemption', 'Liberation', undefined].filter(cause => cause !== remastered))
    expect(evaluate('Champion', cause)).toEqual({ missing: [prerequisite], manual: [] })
  expect(evaluate('Fighter', remastered)).toEqual({ missing: [prerequisite], manual: [] })
})

it('treats Reactive Strike as the legacy Attack of Opportunity prerequisite at its acquisition level', () => {
  const reactive = entry('feat', 'Reactive Strike', {}, 6, ['Champion'])
  const stance = entry('feat', 'Impassable Wall Stance', { prerequisite: 'Attack of Opportunity' }, 8, ['Champion'])
  const fighterStrike = entry('classFeature', 'Reactive Strike', { class: 'Fighter' }, 1)
  const entries = [reactive, stance, fighterStrike]
  const champion: Character = { ...base, className: 'Champion', feats: [selected('Reactive Strike', 6)] }
  expect(featPrerequisiteChecker(champion, entries, 8)(stance)).toEqual({ missing: [], manual: [] })
  expect(featPrerequisiteChecker(champion, entries, 5)(stance).missing).toEqual(['Attack of Opportunity'])
  expect(featPrerequisiteChecker({ ...champion, feats: [] }, entries, 8)(stance).missing).toEqual(['Attack of Opportunity'])
  expect(featPrerequisiteChecker({ ...base, className: 'Fighter', feats: [] }, entries, 8)(stance))
    .toEqual({ missing: [], manual: [] })
})

it('maps Champion causes to Tenets of Good and Evil prerequisites', () => {
  const c: Character = { ...base, className: 'Champion', subclass: 'Justice' }
  const good = entry('feat', 'Esoteric Oath', { prerequisite: 'tenets of good' }, 2, ['Champion', 'Oath'])
  const evil = entry('feat', 'Evil Oath', { prerequisite: 'tenets of evil' }, 2, ['Champion', 'Oath'])
  const evaluate = (character: Character, feat: ContentEntry, level = character.level) =>
    featPrerequisiteChecker(character, [feat], level)(feat)
  for (const cause of ['Justice', 'Grandeur', 'Liberation', 'Redemption', 'Paladin', 'Redeemer', 'Liberator']) {
    expect(evaluate({ ...c, subclass: cause }, good)).toEqual({ missing: [], manual: [] })
    expect(evaluate({ ...c, subclass: cause }, evil)).toEqual({ missing: ['tenets of evil'], manual: [] })
  }
  for (const cause of ['Desecration', 'Iniquity', 'Obedience', 'Desecrator', 'Antipaladin', 'Tyrant']) {
    expect(evaluate({ ...c, subclass: cause }, evil)).toEqual({ missing: [], manual: [] })
    expect(evaluate({ ...c, subclass: cause }, good)).toEqual({ missing: ['tenets of good'], manual: [] })
  }
  expect(evaluate({ ...c, subclass: undefined }, good)).toEqual({ missing: [], manual: ['tenets of good'] })
  expect(evaluate({ ...c, subclass: undefined, legacyTenetsOfGood: true }, good)).toEqual({ missing: [], manual: [] })
  expect(evaluate({ ...c, legacyTenetsOfGood: true }, good, 0)).toEqual({ missing: [], manual: ['tenets of good'] })
  expect(evaluate({ ...c, className: 'Fighter', legacyTenetsOfGood: true }, good)).toEqual({ missing: [], manual: ['tenets of good'] })
  expect(evaluate(JSON.parse(JSON.stringify({ ...c, subclass: undefined, legacyTenetsOfGood: true })), good))
    .toEqual({ missing: [], manual: [] })
})

it('requires a master skill for Exceptional Artisan and restricts its bonus feat to the selected skill', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 9, ancestry: 'Orc', rankOverrides: { Crafting: 3 },
    feats: [{ name: 'Exceptional Artisan', type: 'Ancestry Feat', level: 9, choice: 'Crafting', slot: 'ancestry:9:0' }] }
  expect(check('master in at least one skill', c).missing).toEqual([])
  expect(check('master in at least one skill', { ...c, rankOverrides: {} }).missing).toHaveLength(1)
  expect(featChoiceOptions('Exceptional Artisan', c, [], c.feats[0].slot!)).toEqual(['Crafting'])
  expect(automaticFeatGrants(c, [])).toContainEqual({ name: 'Assurance', source: 'Exceptional Artisan (Crafting)', level: 9 })
  const slot = plannedSlots(c).find(candidate => candidate.grantedBy === 'Exceptional Artisan')!
  const skillFeat = (name: string, skill: string): ContentEntry => ({ ...entry('feat', name, { skill }, 1, ['General', 'Skill']), systems: ['sf2e'] })
  expect(eligibleFeats([skillFeat('Quick Repair', 'Crafting'), skillFeat('Quick Squeeze', 'Acrobatics')], c, slot)
    .map(feat => feat.name)).toEqual(['Quick Repair'])
  expect(eligibleFeats([skillFeat('Quick Repair', 'Crafting')], { ...c, rankOverrides: {} }, slot)).toEqual([])
})

it('grants both prescient feats at the level Predictive Purchase is taken', () => {
  const c: Character = { ...base, level: 10, feats: [selected('Predictive Purchase', 10)] }
  expect(automaticFeatGrants(c, [])).toEqual(expect.arrayContaining([
    { name: 'Prescient Planner', source: 'Predictive Purchase', level: 10 },
    { name: 'Prescient Consumable', source: 'Predictive Purchase', level: 10 },
  ]))
  expect(automaticFeatGrants({ ...c, level: 9 }, [])).toEqual([])
})

it('enforces the Rogue sneak attack dice prerequisite at the selection level', () => {
  const c: Character = { ...base, className: 'Rogue' }
  expect(check('sneak attack 2d6', c, [], 4).missing).toEqual(['sneak attack 2d6'])
  expect(check('sneak attack 2d6', c, [], 5).missing).toEqual([])
})

it('checks proficiency in sawtooth sabers, including weapon familiarity', () => {
  const saber = entry('weapon', 'Sawtooth Saber', { weapon_category: 'Advanced' }, 0)
  const rogue = entry('class', 'Rogue', { attack_proficiency: 'Trained in martial weapons' })
  const c: Character = { ...base, className: 'Rogue', level: 8 }
  expect(check('trained in sawtooth sabers', c, [saber, rogue]).missing).toEqual(['trained in sawtooth sabers'])
  const trained = { ...c, feats: [{ ...selected('Weapon Proficiency'), choice: 'Sawtooth Saber' }] }
  expect(check('trained in sawtooth sabers', trained, [saber, rogue]).missing).toEqual([])
  expect(check('trained in sawtooth sabers', c, [rogue]).manual).toEqual(['trained in sawtooth sabers'])
})

it('checks proficiency in a selected Hellknight order favored weapon without requiring ownership', () => {
  const weapons = [
    entry('weapon', 'Mace', { weapon_category: 'Simple' }, 0),
    entry('weapon', 'Whip', { weapon_category: 'Martial' }, 0),
    entry('weapon', 'Scourge', { weapon_category: 'Martial' }, 0),
    entry('weapon', 'Flail', { weapon_category: 'Martial' }, 0),
    entry('weapon', 'Spiked Chain', { weapon_category: 'Martial' }, 0),
  ]
  const wizard = entry('class', 'Wizard', { attack_proficiency: 'Expert in simple weapons, Trained in martial weapons' })
  const dedication = { name: 'Hellknight Dedication', type: 'Archetype Feat', level: 2, choice: 'Order of the Scourge' }
  const c: Character = { ...base, className: 'Wizard', level: 12, feats: [dedication], weapons: [] }
  const requirement = "expert in at least one of your order's favored weapons"
  expect(check(requirement, c, [wizard, ...weapons])).toEqual({ missing: [], manual: [] })
  const chain = { ...c, feats: [{ ...dedication, choice: 'Order of the Chain' }] }
  expect(check(requirement, chain, [wizard, ...weapons]).missing).toEqual([requirement])
  expect(check("trained in your order's favored weapon", chain, [wizard, ...weapons])).toEqual({ missing: [], manual: [] })
  expect(check(requirement, c, [wizard, ...weapons.filter(weapon => weapon.name !== 'Mace')]).manual).toEqual([requirement])
  expect(check(requirement, { ...c, feats: [] }, [wizard, ...weapons]).manual).toEqual([requirement])
  expect(check(requirement, { ...c, feats: [{ ...dedication, choice: 'Order of the Crucible' }] }, [wizard, ...weapons]).manual).toEqual([requirement])
  expect(check(requirement, { ...c, level: 1 }, [wizard, ...weapons]).manual).toEqual([requirement])
})

it('grants Free Heart background skills and feat without its attribute boosts', () => {
  const background = entry('background', 'Performer', { skill: 'Performance, Theater Lore', feat: 'Fascinating Performance', ability: 'Charisma' })
  const rare = entry('background', 'Secret', { rarity: 'rare' })
  const klass = entry('class', 'Bard', { skill_proficiency: 'Trained in Performance' })
  const c: Character = { ...base, level: 1, className: 'Bard', ancestry: 'Elf',
    feats: [{ ...selected('Free Heart'), choice: 'Performer' }] }
  const entries = [background, rare, klass]
  expect(featChoiceOptions('Free Heart', c, entries, '')).toEqual(['Performer'])
  expect(ranksAt(c, entries)).toMatchObject({ Performance: 1, 'Theater Lore': 1 })
  expect(automaticFeatGrants(c, entries)).toContainEqual({ name: 'Fascinating Performance', source: 'Free Heart (Performer)', level: 1 })
  expect(additionalSkillCount(c, entries)).toBe(additionalSkillCount({ ...c, feats: [] }, entries) + 1)
  expect(ranksAt({ ...c, level: 0 }, entries)['Theater Lore']).toBeUndefined()
})

it('preserves legacy longevity choices as regular proficiency for prerequisites', () => {
  const c: Character = { ...base, level: 9, ancestry: 'Elf', skillPicks: ['Athletics'], feats: [
    { ...selected('Ancestral Longevity', 5), choice: 'Acrobatics' },
    { ...selected('Expert Longevity', 9), choice: 'Athletics' },
  ] }
  expect(dailyLongevityRanks(c, [])).toMatchObject({ Acrobatics: 1, Athletics: 2 })
  expect(ranksAt(c, []).Acrobatics).toBe(1)
  expect(check('trained in Acrobatics', c).missing).toEqual([])
  expect(check('expert in Athletics', c).missing).toEqual([])
  expect(ranksAt(c, [], 5).Acrobatics).toBeUndefined()
  expect(ranksAt(c, [], 9).Athletics).toBe(1)
  expect(dailyLongevityRanks({ ...c, level: 8 }, []).Athletics).toBe(1)
  expect(dailyLongevityRanks({ ...c, feats: [c.feats[1]] }, []).Athletics).toBe(1)
})

it.each(['Celestial Form', 'Fiendish Form'])('%s grants darkvision even when flight is disabled', name => {
  const c: Character = { ...base, level: 18, feats: [selected(name, 18)] }
  expect(senses(c, [])).toContainEqual({ value: 'Darkvision', source: name })
  expect(senses({ ...c, level: 17 }, [])).toEqual([])
})

it('grants Greater Darkvision from Defy the Darkness', () => {
  const c: Character = { ...base, ancestry: 'Dwarf', level: 5, feats: [selected('Defy the Darkness', 5)] }
  const sensesForCharacter = senses(c, [])
  expect(sensesForCharacter).toContainEqual({ value: 'Greater Darkvision', source: 'Defy the Darkness' })
  expect(sensesForCharacter).not.toContainEqual(expect.objectContaining({ value: 'Darkvision' }))
})

it('grants Adopted Ancestry (Orc) from Orc Kinship and applies Orc ancestry feat access', () => {
  const c: Character = { ...base, ancestry: 'Dwarf', level: 1, feats: [selected('Orc Kinship', 1)] }
  expect(automaticFeatGrants(c, [])).toContainEqual({
    name: 'Adopted Ancestry', choice: 'Orc', source: 'Orc Kinship', level: 1,
  })
  expect(ancestryFeatTraits(c)).toContain('orc')
  expect(ancestryFeatTraits({ ...c, level: 0 })).not.toContain('orc')
})

it('suggests exact General and Skill feat prerequisites for this class and ancestry without confusing longer feat names', () => {
  const titan = entry('feat', 'Titan Wrestler', {}, 1, ['General', 'Skill'])
  const diehard = entry('feat', 'Diehard', {}, 1, ['General'])
  const advanced = entry('feat', 'Greater Titan Wrestler', {}, 8, ['Fighter'])
  const data = [
    titan, diehard, advanced,
    entry('feat', 'The Harder They Fall (Ranger)', { prerequisite: 'Titan Wrestler' }, 8, ['Ranger']),
    entry('feat', 'Ancestral Resolve', { prerequisite: 'Diehard; expert in Survival' }, 9, ['Human']),
    entry('feat', 'Adopted Resolve', { prerequisite: 'Diehard' }, 9, ['Dwarf']),
    entry('feat', 'Other Class', { prerequisite: 'Titan Wrestler' }, 8, ['Rogue']),
    entry('feat', 'Not the Same Prerequisite', { prerequisite: advanced.name }, 10, ['Ranger']),
    { ...entry('feat', 'Deleted', { prerequisite: 'Titan Wrestler' }, 1, ['Ranger']), deleted: true },
    entry('feat', 'Descriptive Mention', {}, 1, ['Ranger']),
  ]
  data[data.length - 1].description = 'Titan Wrestler is useful but not required.'
  const context = { className: 'Ranger', ancestryTraits: ['Human'] }
  const suggestions = featPrerequisiteSuggestions(data, context)
  expect(suggestions.get(titan.name)).toEqual(['The Harder They Fall (Ranger)'])
  expect(suggestions.get(diehard.name)).toEqual(['Ancestral Resolve'])
  expect(suggestions.has(advanced.name)).toBe(false)
  expect(featPrerequisiteSuggestions(data, { ...context, ancestryTraits: ['Dwarf'] }).get(diehard.name)).toEqual(['Adopted Resolve'])
  expect(featPrerequisiteSuggestions(data, { ...context, className: 'Rogue' }).get(titan.name)).toEqual(['Other Class'])
  expect(featPrerequisiteSuggestions(data, { ...context, knownFeats: ['Titan Wrestler'] }).has(titan.name)).toBe(false)
})

describe('shared prerequisite enforcement', () => {
  let previousPlanning: boolean
  beforeEach(() => {
    previousPlanning = getSettings().planSkillPrerequisites
    updateSettings({ planSkillPrerequisites: false })
  })
  afterEach(() => updateSettings({ planSkillPrerequisites: previousPlanning }))
  it('does not resolve ancestry skill sources for unrelated selected feats', () => {
    const character: Character = { ...base, systems: ['sf2e'], ancestry: 'Human',
      feats: Array.from({ length: 100 }, (_, index) => selected(`Unrelated feat ${index}`)) }
    const source = vi.spyOn(featChoices, 'selectedFeatEntry')
    try {
      automaticFeatGrants(character, [])
      expect(source.mock.calls.filter(([, , name]) => name.startsWith('Unrelated feat'))).toHaveLength(0)
    } finally { source.mockRestore() }
  })
  it.each(['Orc', 'Human'])('resolves the legacy selected Orc Rugged Survivalist in a mixed catalog for %s', ancestry => {
    const pathfinder = entry('feat', 'Rugged Survivalist', { archetype: 'Swordmaster' }, 7, ['Archetype', 'Skill'])
    const starfinder: ContentEntry = { ...pathfinder, id: 'sf-rugged', systems: ['sf2e'], traits: ['Orc'], level: 9 }
    const character: Character = { ...base, systems: ['pf2e', 'sf2e'], ancestry, entryIds: [starfinder.id],
      feats: [
        ...(ancestry === 'Human' ? [{ name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' }] : []),
        { name: 'Rugged Survivalist', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' },
      ] }
    expect(automaticFeatGrants(character, [pathfinder, starfinder]))
      .toContainEqual({ name: 'Forager', source: 'Rugged Survivalist', level: 9 })
    expect(automaticFeatGrants({ ...character, entryIds: [pathfinder.id] }, [pathfinder, starfinder])
      .some(grant => grant.name === 'Forager')).toBe(false)
  })
  it.each([
    ['Cite the Deep Lore', 'Society', 'Blend In', 'Elf'],
    ["Diplomat's Facade", 'Deception', 'Lie to Me', 'Elf'],
    ['Broken Hand Technique', 'Athletics', 'Titan Wrestler', 'Orc'],
    ['Spelunker', 'Acrobatics', 'Quick Squeeze', 'Orc'],
    ['Rugged Survivalist', 'Survival', 'Forager', 'Orc'],
  ])('keeps %s effects available through Adopted Ancestry', (name, skill, bonus, ancestry) => {
    const character: Character = { ...base, systems: ['sf2e'], ancestry: 'Human',
      feats: [{ name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: ancestry }, selected(name)] }
    if (name !== 'Rugged Survivalist') expect(ranksAt(character, [])[skill]).toBe(1)
    expect(automaticFeatGrants(character, [])).toContainEqual({ name: bonus, source: name, level: 1 })
  })
  it('uses the selected adopted Ancestral Skills variant for skills and ancestry Lore', () => {
    const native = { ...entry('feat', 'Ancestral Skills', {}, 1, ['Human']), id: 'human-skills',
      systems: ['sf2e' as const], description: 'Option(s): Diplomacy, Society' }
    const adopted = { ...native, id: 'elf-skills', traits: ['Elf'], description: 'Option(s): Arcana, Nature' }
    const character: Character = { ...base, systems: ['sf2e'], ancestry: 'Human', entryIds: [adopted.id],
      feats: [
        { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Elf' },
        { name: 'Ancestral Skills', type: 'Ancestry Feat', level: 1, sourceId: adopted.id },
      ] }
    const entries = [native, adopted]
    expect(ranksAt(character, entries)).toMatchObject({ Arcana: 1, Nature: 1, 'Elf Lore': 4 })
    expect(ranksAt(character, entries).Diplomacy ?? 0).toBe(0)
    expect(featLores(character, entries)).toEqual(['Elf Lore'])
    expect(automaticFeatGrants(character, entries)).toContainEqual({
      name: 'Additional Lore', choice: 'Elf', source: 'Ancestral Skills', level: 1,
    })
    const legacy = { ...character, feats: character.feats.map(feat => ({ ...feat, sourceId: undefined })) }
    expect(featLores(legacy, entries)).toEqual(['Elf Lore'])
    const lore = { ...adopted, name: 'Elven Lore', id: 'elven-lore',
      description: 'You become trained in Arcana and Nature. You gain the Additional Lore general feat for Elf Lore.' }
    const withLore = { ...character, feats: [...character.feats.filter(feat => feat.name !== 'Ancestral Skills'), selected(lore.name)] }
    expect(ranksAt(withLore, [native, adopted, lore])).toMatchObject({ Arcana: 1, Nature: 1, 'Elf Lore': 4 })
    const eligible = eligibleFeats([native, adopted, lore], { ...withLore, feats: withLore.feats.slice(0, 1) },
      { key: 'ancestry:1:0', category: 'ancestry', level: 1 })
    expect(eligible).toContain(native)
    expect(eligible).not.toContain(adopted)
  })
  it('applies adopted climb and the selected burrowing variant without granting native ancestry statistics', () => {
    const slow = { ...entry('feat', 'Burrowing Specialist', {}, 9, ['Ysoki']), id: 'ysoki-burrow',
      systems: ['sf2e' as const], description: 'Option(s): 10 feet' }
    const fast = { ...slow, id: 'talphi-burrow', traits: ['Talphi'], description: 'Option(s): 25 feet' }
    const character: Character = { ...base, systems: ['pf2e', 'sf2e'], ancestry: 'Human',
      feats: [
        { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Elf' },
        { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Talphi' },
        { name: 'Tree Climber', type: 'Ancestry Feat', level: 1 },
        { name: 'Burrowing Specialist', type: 'Ancestry Feat', level: 9, sourceId: fast.id },
      ] }
    expect(movementSpeeds(character, [slow, fast])).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Climb', feet: 10, source: 'Tree Climber' }),
      expect.objectContaining({ name: 'Burrow', feet: 25, source: 'Burrowing Specialist' }),
    ]))
    expect(senses({ ...character, feats: character.feats.slice(0, 2) }, [])).toEqual([])
  })
  it('grants fixed resistances from ancestry feats', () => {
    const character: Character = { ...base, level: 10, feats: [{ name: 'Skeletal Resistance', type: 'Ancestry Feat', level: 9 }] }
    expect(resistances(character, [])).toEqual(expect.arrayContaining([
      expect.objectContaining({ damage: 'Slashing', value: 2, source: 'Skeletal Resistance' }),
    ]))
  })
  it('grants passive ancestry movement Speeds', () => {
    const character: Character = { ...base, feats: [
      { name: 'Cave Climber', type: 'Ancestry Feat', level: 9 }, { name: 'Warren Digger', type: 'Ancestry Feat', level: 13 },
      { name: 'Fledgling Flight', type: 'Ancestry Feat', level: 1 }, { name: 'Full Flight', type: 'Ancestry Feat', level: 9 },
    ], level: 13 }
    expect(movementSpeeds(character, [])).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Climb', feet: 10 }), expect.objectContaining({ name: 'Burrow', feet: 15 }),
      expect.objectContaining({ name: 'Fly', feet: 25 }),
    ]))
  })
  it('grants flight from Dragon\'s Rage Wings only while raging', () => {
    const character: Character = { ...base, level: 12, feats: [{ name: "Dragon's Rage Wings", type: 'Class Feat', level: 12 }] }
    expect(movementSpeeds(character, []).some(s => s.name === 'Fly')).toBe(false)
    expect(movementSpeeds({ ...character, raging: true }, []).some(s => s.source === "Dragon's Rage Wings")).toBe(false)
    expect(movementSpeeds({ ...character, raging: true, activeFeatEffects: ["Dragon's Rage Wings"] }, [])
      .some(s => s.source === "Dragon's Rage Wings")).toBe(true)
    expect(movementSpeeds({ ...character, raging: false, activeFeatEffects: ["Dragon's Rage Wings"] }, [])
      .some(s => s.source === "Dragon's Rage Wings")).toBe(false)
  })
  it('grants half-Speed climb and swim from Flamboyant Athlete', () => {
    const character: Character = { ...base, level: 2, feats: [{ name: 'Flamboyant Athlete', type: 'Class Feat', level: 2 }] }
    const speeds = movementSpeeds(character, [])
    expect(speeds.filter(s => s.source === 'Flamboyant Athlete').map(s => s.name)).toEqual(['Climb', 'Swim'])
  })
  it.each(['Adopted Ancestry', 'Dromaar'])('grants Orc Spelunker benefits through %s', access => {
    const character: Character = { ...base, systems: ['sf2e'], ancestry: 'Human',
      heritage: access === 'Dromaar' ? 'Dromaar' : undefined,
      feats: [...(access === 'Adopted Ancestry'
        ? [{ name: access, type: 'General Feat', level: 1, choice: 'Orc' }] : []), selected('Spelunker')] }
    expect(ranksAt(character, []).Acrobatics).toBe(1)
    expect(automaticFeatGrants(character, [])).toContainEqual({ name: 'Quick Squeeze', source: 'Spelunker', level: 1 })
    expect(automaticFeatGrants({ ...character, level: 0 }, []).some(grant => grant.source === 'Spelunker')).toBe(false)
  })
  it('does not confuse Shisk Spelunker with Orc Spelunker in a mixed-system character', () => {
    const character: Character = { ...base, systems: ['pf2e', 'sf2e'], ancestry: 'Shisk', feats: [selected('Spelunker')] }
    expect(ranksAt(character, []).Acrobatics ?? 0).toBe(0)
    expect(automaticFeatGrants(character, []).some(grant => grant.source === 'Spelunker')).toBe(false)
  })
  it.each(['Spelunker', 'Rugged Survivalist'])('preserves the selected Pathfinder %s variant when Starfinder is also enabled', name => {
    const source = entry('feat', name, {}, 1, name === 'Spelunker' ? ['Shisk'] : ['Archetype', 'Skill'])
    const character: Character = { ...base, systems: ['pf2e', 'sf2e'], ancestry: 'Orc',
      feats: [
        { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Shisk' },
        { name, type: 'Ancestry Feat', level: 1, sourceId: source.id },
      ] }
    expect(automaticFeatGrants(character, [source]).some(grant => grant.source === name)).toBe(false)
    expect(ranksAt(character, [source]).Acrobatics ?? 0).toBe(0)
  })
  it.each([
    ['Cite the Deep Lore', 'Society', 'Blend In', 'Elf'],
    ["Diplomat's Facade", 'Deception', 'Lie to Me', 'Elf'],
    ['Broken Hand Technique', 'Athletics', 'Titan Wrestler', 'Orc'],
    ['Spelunker', 'Acrobatics', 'Quick Squeeze', 'Orc'],
  ])('grants %s skill and feat, with an alternate when already trained', (name, skill, bonus, ancestry) => {
    const character: Character = { ...base, systems: ['sf2e'], ancestry, feats: [selected(name)] }
    expect(ranksAt(character, [])[skill]).toBe(1)
    expect(automaticFeatGrants(character, [])).toContainEqual({ name: bonus, source: name, level: 1 })
    const duplicate = { ...character, skillPicks: [skill], feats: [{ ...character.feats[0], choice: 'Medicine' }] }
    expect(featChoiceOptions(name, duplicate, [], 'class:1:0', 0)).toContain('Medicine')
    expect(ranksAt(duplicate, []).Medicine).toBe(1)
    expect(automaticFeatGrants({ ...character, systems: ['pf2e'] }, []).some(grant => grant.source === name)).toBe(false)
  })
  it('grants Hold-Scarred Orc ancestry HP and Diehard', () => {
    const orc: Character = { ...base, level: 1, ancestry: 'Orc', heritage: 'Hold-Scarred Orc' }
    const ancestry = entry('ancestry', 'Orc', { hp: 10 })
    expect(maxHp(orc, [ancestry])).toBe(12)
    expect(automaticFeatGrants(orc, [])).toContainEqual({ name: 'Diehard', source: 'Hold-Scarred Orc', level: 1 })
    expect(check('Diehard', orc).missing).toEqual([])
    expect(maxHp({ ...orc, heritage: undefined }, [ancestry])).toBe(10)
  })
  it('grants Forager from the Starfinder Orc Rugged Survivalist, not the Pathfinder archetype', () => {
    const orc: Character = { ...base, systems: ['sf2e'], ancestry: 'Orc', feats: [selected('Rugged Survivalist', 9)] }
    expect(automaticFeatGrants(orc, [])).toContainEqual({ name: 'Forager', source: 'Rugged Survivalist', level: 9 })
    expect(automaticFeatGrants({ ...orc, level: 8 }, [])).toEqual([])
    expect(automaticFeatGrants({ ...orc, systems: ['pf2e'] }, [])).toEqual([])
  })
  it('hides redundant Orc ancestral unarmed attack when Tusks or Iron Fists is already selected', () => {
    const feat: ContentEntry = { ...entry('feat', 'Ancestral Unarmed Attack', {}, 1, ['Orc']), systems: ['sf2e'] }
    const orc: Character = { ...base, systems: ['sf2e'], ancestry: 'Orc', level: 5 }
    const slot = { category: 'ancestry' as const, key: 'ancestry:5:0', level: 5 }
    expect(eligibleFeats([feat], { ...orc, feats: [] }, slot)).toEqual([feat])
    expect(eligibleFeats([feat], { ...orc, feats: [selected('Tusks')] }, slot)).toEqual([])
    expect(eligibleFeats([feat], { ...orc, feats: [selected('Iron Fists')] }, slot)).toEqual([])
  })
  it('hides available redundant attack feats for native and adopted Orcs but preserves a saved broad choice', () => {
    const broad = { ...entry('feat', 'Ancestral Unarmed Attack', {}, 1, ['Orc']), systems: ['sf2e' as const] }
    const tusks = entry('feat', 'Tusks', {}, 1, ['Orc'])
    const slot = { category: 'ancestry' as const, key: 'ancestry:1:0', level: 1 }
    const orc: Character = { ...base, systems: ['pf2e', 'sf2e'], ancestry: 'Orc', level: 1 }
    expect(eligibleFeats([broad, tusks], orc, slot)).toEqual([tusks])
    const adopted = { ...orc, ancestry: 'Human', feats: [{ ...selected('Adopted Ancestry'), choice: 'Orc' }] }
    expect(eligibleFeats([broad, tusks], adopted, slot)).toEqual([tusks])
    expect(eligibleFeats([broad, tusks], { ...orc, systems: ['sf2e'] }, slot)).toContain(broad)
    expect(eligibleFeats([broad, tusks], { ...orc, feats: [
      { name: broad.name, type: 'Ancestry Feat', level: 1, slot: slot.key, sourceId: broad.id },
    ] }, slot)).toContain(broad)
  })
  it.each([
    ['Orc', 'Tusks'], ['Orc', 'Iron Fists'], ['Barathu', 'Tentacle Whip'], ['Pahtra', 'Predatory'], ['Vesk', 'Brutal Anatomy'],
  ])('recognizes %s %s as an ancestral unarmed attack prerequisite', (ancestry, name) => {
    const source = entry('feat', name, {}, 1, [ancestry])
    const broad = entry('feat', 'Ancestral Unarmed Attack', {}, 1, [ancestry])
    const c = { ...base, ancestry, feats: [selected(name)] }
    expect(check('Ancestral Unarmed Attack', c, [source, broad]).missing).toEqual([])
    expect(check('Ancestral Unarmed Attack', { ...c, level: 5, feats: [selected(name, 9)] }, [source, broad]).missing).not.toEqual([])
  })
  it('validates specific attack heritage requirements and excludes dependent upgrades from aliases', () => {
    const broad = entry('feat', 'Ancestral Unarmed Attack')
    const fang = entry('feat', 'Fang Sharpener', { prerequisite: 'Irongut Goblin or Razortooth Goblin' }, 1, ['Goblin'])
    const irongut = entry('heritage', 'Irongut Goblin', {}, 1, ['Goblin'])
    const razortooth = entry('heritage', 'Razortooth Goblin', {}, 1, ['Goblin'])
    const goblin = { ...base, ancestry: 'Goblin', feats: [selected(fang.name)] }
    expect(check('Ancestral Unarmed Attack', goblin, [broad, fang, irongut, razortooth]).missing).not.toEqual([])
    expect(check('Ancestral Unarmed Attack', { ...goblin, heritage: irongut.name }, [broad, fang, irongut, razortooth]).missing).toEqual([])
    const upgrade = entry('feat', 'Bug Bite', { prerequisite: 'Ancestral Unarmed Attack' }, 1, ['Shirren'])
    expect(check('Ancestral Unarmed Attack', { ...base, ancestry: 'Shirren', feats: [selected(upgrade.name)] }, [broad, upgrade]).missing)
      .not.toEqual([])
  })
  it('allows Dromaar to select Orc ancestry feats such as Iron Fists', () => {
    const ironFists = entry('feat', 'Iron Fists', {}, 1, ['Orc'])
    const slot = { category: 'ancestry' as const, key: 'ancestry:1:0', level: 1 }
    const dromaarHuman: Character = { ...base, ancestry: 'Human', heritage: 'Dromaar', level: 1 }
    expect(eligibleFeats([ironFists], dromaarHuman, slot)).toEqual([ironFists])
    expect(eligibleFeats([ironFists], { ...dromaarHuman, heritage: undefined }, slot)).toEqual([])
  })
  it('grants Beast Trainer and Hold Mark choices only at their acquisition levels', () => {
    const orc: Character = { ...base, ancestry: 'Orc', feats: [
      { ...selected('Beast Trainer', 5), choice: 'Pet' },
      { ...selected('Hold Mark', 9), choice: 'Empty Hand' },
    ] }
    expect(ranksAt(orc, []).Nature).toBe(1)
    expect(ranksAt(orc, []).Intimidation).toBe(1)
    expect(automaticFeatGrants(orc, [])).toContainEqual({ name: 'Pet', source: 'Beast Trainer', level: 5 })
    expect(ranksAt({ ...orc, level: 4 }, []).Nature ?? 0).toBe(0)
    expect(ranksAt({ ...orc, level: 8 }, []).Intimidation ?? 0).toBe(0)
    expect(automaticFeatGrants({ ...orc, feats: [{ ...orc.feats[0], choice: 'Train Animal' }] }, []))
      .toContainEqual({ name: 'Train Animal', source: 'Beast Trainer', level: 5 })
    expect(automaticFeatGrants({ ...orc, feats: [{ ...orc.feats[0], choice: undefined }] }, [])).toEqual([])
  })
  it('requires a prior primal innate spell for First World Adept and a familiar for familiar feats', () => {
    const source = mapAonHit({ _id: 'first-world', _source: { name: 'First World Magic', category: 'feat', level: 1, trait: ['Gnome'],
      markdown: 'Header\n\n---\n\nChoose one cantrip from the [primal](/SpellLists.aspx?Tradition=4) spell list. You can cast this cantrip as an innate spell at will.' } }, 'pf2e')!
    const spell = entry('spell', 'Light', { tradition: 'primal' }, 1, ['Cantrip'])
    const gnome: Character = { ...base, className: 'Ranger', ancestry: 'Gnome', level: 9,
      feats: [{ ...selected(source.name, 1), type: 'Ancestry Feat', choice: spell.name }] }
    expect(check('at least one primal innate spell', gnome, [source, spell]).missing).toEqual([])
    expect(check('at least one primal innate spell', { ...gnome, feats: [] }, [source, spell]).missing).toHaveLength(1)
    expect(check('at least one primal innate spell', { ...gnome, feats: [{ ...gnome.feats[0], choice: undefined }] }, [source, spell]).missing).toHaveLength(1)
    expect(check('a familiar', gnome).missing).toHaveLength(1)
    expect(check('a familiar', { ...gnome, feats: [selected('Animal Accomplice')] }).missing).toEqual([])
  })
  it('requires limited telepathy for Distant Telepath', () => {
    const elf: Character = { ...base, systems: ['sf2e'], ancestry: 'Elf', heritage: 'Asanan Elf' }
    expect(check('limited telepathy', elf).missing).toEqual([])
    expect(check('limited telepathy', { ...elf, heritage: 'Other Elf' }).missing).toEqual(['limited telepathy'])
    expect(check('limited telepathy', { ...elf, ancestry: 'Lashunta', heritage: undefined }).missing).toEqual([])
    expect(check('limited telepathy', { ...elf, systems: ['pf2e'] }).missing).toEqual(['limited telepathy'])
  })
  it('requires a construct companion for No! No! I Created You!', () => {
    const inventor: Character = { ...base, className: 'Inventor', subclass: 'Construct' }
    expect(check('construct companion', inventor).missing).toEqual([])
    expect(check('construct companion', { ...inventor, subclass: 'Armor' }).missing).toEqual(['construct companion'])
    expect(check('construct companion', { ...inventor, subclass: 'Armor', feats: [{ ...selected('Second Innovation', 8), choice: 'Construct' }] }, [], 7).missing).toEqual(['construct companion'])
    expect(check('construct companion', { ...inventor, subclass: 'Armor', feats: [{ ...selected('Second Innovation', 8), choice: 'Construct' }] }).missing).toEqual([])
  })
  it('permits a second Ubiquitous Gadgets only at level 14 or later', () => {
    const gadget = entry('feat', 'Ubiquitous Gadgets', { prerequisite: 'Gadget Specialist' }, 8, ['Inventor'])
    const inventor: Character = { ...base, className: 'Inventor', level: 16,
      feats: [selected('Gadget Specialist', 4), selected('Ubiquitous Gadgets', 8)] }
    const slot = (level: number) => ({ key: `class:${level}:0`, category: 'class' as const, level })
    expect(eligibleFeats([gadget], inventor, slot(12))).toEqual([])
    expect(eligibleFeats([gadget], inventor, slot(14))).toEqual([gadget])
    expect(eligibleFeats([gadget], { ...inventor, feats: [...inventor.feats, selected('Ubiquitous Gadgets', 14)] }, slot(16))).toEqual([])
  })
  it('grants each Order Explorer a first-level feat from its chosen order at the acquisition level', () => {
    const animal = entry('feat', 'Animal Companion', { prerequisite: 'animal order' }, 1, ['Druid'])
    const flame = entry('feat', 'Leshy Familiar', { prerequisite: 'leaf order' }, 1, ['Druid'])
    const general = entry('feat', 'Other Druid Feat', {}, 1, ['Druid'])
    const c: Character = { ...base, className: 'Druid', order: 'Storm', level: 4, feats: [
      { ...selected('Order Explorer', 2), choice: 'Animal' },
      { ...selected('Order Explorer', 4), choice: 'Leaf' },
    ] }
    const slots = plannedSlots(c).filter(slot => slot.grantedBy === 'Order Explorer')
    expect(slots.map(slot => [slot.level, slot.maxFeatLevel, slot.grantedOrder])).toEqual([[2, 1, 'Animal'], [4, 1, 'Leaf']])
    expect(eligibleFeats([animal, flame, general], c, slots[0])).toEqual([animal])
    expect(eligibleFeats([animal, flame, general], c, slots[1])).toEqual([flame])
    const untamed = entry('feat', 'Untamed Form', { prerequisite: 'untamed order' }, 1, ['Druid'])
    const wild = { ...c, feats: [{ ...selected('Order Explorer', 2), choice: 'Wild' }] }
    expect(eligibleFeats([untamed], wild, plannedSlots(wild).find(slot => slot.grantedBy === 'Order Explorer')!)).toEqual([untamed])
    expect(plannedSlots({ ...c, level: 1 }).filter(slot => slot.grantedBy === 'Order Explorer')).toEqual([])
  })
  it.each([
    ['Animal', 'Animal Companion', 'animal'], ['Flame', 'Fire Lung', 'flame'],
    ['Leaf', 'Leshy Familiar', 'leaf'], ['Stone', 'Steadying Stone', 'stone'],
    ['Storm', 'Storm Born', 'storm'], ['Wave', 'Shore Step', 'wave'], ['Wild', 'Untamed Form', 'untamed'],
  ])('automatically selects the available %s order feat', (order, name, prerequisite) => {
    const feat = entry('feat', name, { prerequisite: `${prerequisite} order` }, 1, ['Druid'])
    const c: Character = { ...base, className: 'Druid', order: 'Leaf', level: 4, feats: [
      { ...selected('Order Explorer', 2), choice: order },
    ] }
    const patch = syncOrderExplorerFeats(c, [feat])!
    const granted = patch.feats!.find(selectedFeat => selectedFeat.name === name)
    expect(granted).toMatchObject({ name, takenLevel: 2, slot: 'class:1:order-explorer:class:2:0' })
    expect(patch.entryIds).toContain(feat.id)
    expect(syncOrderExplorerFeats({ ...c, ...patch }, [feat])).toBeUndefined()
    expect(syncOrderExplorerFeats({ ...c, level: 1 }, [feat])).toBeUndefined()
  })

  it('updates old order selections when the order changes, but leaves genuine alternatives to the user', () => {
    const fire = entry('feat', 'Fire Lung', { prerequisite: 'flame order' }, 1, ['Druid'])
    const wave = entry('feat', 'Shore Step', { prerequisite: 'wave order' }, 1, ['Druid'])
    const anotherWave = entry('feat', 'Another Wave Feat', { prerequisite: 'wave order' }, 1, ['Druid'])
    const slot = 'class:1:order-explorer:class:2:0'
    const c: Character = { ...base, className: 'Druid', order: 'Animal', level: 4,
      feats: [{ ...selected('Order Explorer', 2), choice: 'Wave' }, { ...selected('Fire Lung'), slot, takenLevel: 2 }],
      entryIds: [fire.id] }
    expect(syncOrderExplorerFeats(c, [])).toBeUndefined()
    const patch = syncOrderExplorerFeats(c, [fire, wave])!
    expect(patch.feats!.map(feat => feat.name)).toEqual(['Order Explorer', 'Shore Step'])
    expect(patch.entryIds).toEqual([wave.id])
    const multiple = syncOrderExplorerFeats(c, [fire, wave, anotherWave])!
    expect(multiple.feats!.map(feat => feat.name)).toEqual(['Order Explorer'])
    expect(syncOrderExplorerFeats({ ...c, feats: [...c.feats.slice(0, 1), { ...selected('Shore Step'), slot }] },
      [fire, wave, anotherWave])).toBeUndefined()
  })
  it.each([
    ['Ranger', 'Snarecrafter Dedication', 'Snarecrafter', 'rangerSnarecrafter', 'archetype:2:g99'],
    ['Champion', 'Cavalier Dedication', 'Cavalier', 'championCavalier', 'archetype:2:g98'],
    ['Druid', 'Cavalier Dedication', 'Cavalier', 'druidCavalier', 'archetype:2:g97'],
    ['Ranger', 'Cavalier Dedication', 'Cavalier', 'rangerCavalier', 'archetype:2:g96'],
  ] as const)('exempts only the active locked %s dedication from the dedication lock', (className, name, archetype, setting, lockedSlot) => {
    const previous = getSettings()[setting]
    const previousMinimums = getSettings().ignoreArchetypeFeatMinimums
    updateSettings({ ignoreArchetypeFeatMinimums: false })
    const dedication = entry('feat', name, { archetype }, 2, ['Archetype', 'Dedication'])
    const followup = entry('feat', 'Archetype Training', { archetype }, 4, ['Archetype'])
    const medic = entry('feat', 'Medic Dedication', { archetype: 'Medic', prerequisite: 'trained in Medicine' }, 2, ['Archetype', 'Dedication'])
    const wizard = entry('feat', 'Wizard Dedication', { archetype: 'Wizard' }, 2, ['Archetype', 'Dedication'])
    const data = [dedication, followup, medic, wizard]
    const c: Character = { ...base, className, level: 6, skillPicks: ['Medicine'],
      feats: [{ ...selected(name, 2), slot: lockedSlot }] }
    const slot = { key: 'archetype:4:0', category: 'archetype' as const, level: 4 }
    try {
      updateSettings({ [setting]: true })
      expect(featSelectionPrerequisiteChecker(c, data, slot)(medic).missing).toEqual([])
      expect(featSelectionPrerequisiteChecker(c, data, slot)(followup).missing).toEqual([])
      expect(featSelectionPrerequisiteChecker({ ...c, skillPicks: [] }, data, slot)(medic).missing).toContain('trained in Medicine')
      const withMedic = { ...c, feats: [...c.feats, { ...selected(medic.name, 4), slot: 'archetype:4:0' }] }
      expect(featSelectionPrerequisiteChecker(withMedic, data, { ...slot, key: 'archetype:6:0', level: 6 })(wizard).missing)
        .toContain('2 more Medic archetype feats before another dedication')
      expect(featSelectionPrerequisiteChecker({ ...c, feats: [{ ...c.feats[0], slot: 'archetype:2:0' }] }, data, slot)(medic).missing)
        .toContain(`2 more ${archetype} archetype feats before another dedication`)
      updateSettings({ [setting]: false })
      expect(featSelectionPrerequisiteChecker(c, data, slot)(medic).missing)
        .toContain(`2 more ${archetype} archetype feats before another dedication`)
    } finally { updateSettings({ [setting]: previous, ignoreArchetypeFeatMinimums: previousMinimums }) }
  })

  it('requires actual warden spells, specific warden choices, and acquisition-level availability', () => {
    const natural = entry('feat', 'Natural Conduit', { prerequisite: 'warden spells' }, 4, ['Ranger'])
    const strength = entry('feat', 'Animal Strength', { prerequisite: '_animal feature_ warden spell' }, 6, ['Ranger'])
    const gravity = entry('spell', 'Gravity Weapon', { warden_spell_tier: 'Initiate' }, 1, ['Focus', 'Ranger'])
    const animal = entry('spell', 'Animal Feature', { warden_spell_tier: 'Advanced' }, 2, ['Focus', 'Ranger'])
    const data = [natural, strength, gravity, animal, entry('feat', 'Unrelated Focus', { grants_focus_spells: 'Other Spell' })]
    const c: Character = { ...base, className: 'Ranger', level: 8,
      feats: [{ ...selected('Initiate Warden', 1), choice: gravity.name }] }
    expect(featPrerequisiteChecker({ ...c, feats: [] }, data)(natural)).toEqual({ missing: ['warden spells'], manual: [] })
    expect(featPrerequisiteChecker({ ...c, feats: [selected('Unrelated Focus')] }, data)(natural).missing).toEqual(['warden spells'])
    expect(featPrerequisiteChecker(c, data)(natural)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(c, data)(strength)).toEqual({ missing: ['_animal feature_ warden spell'], manual: [] })
    const learned = { ...c, feats: [...c.feats, { ...selected('Advanced Warden', 4), choice: animal.name }] }
    expect(featPrerequisiteChecker(learned, data, 6)(strength)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(learned, data, 3)(strength).missing).toEqual(['_animal feature_ warden spell'])
    expect(featPrerequisiteChecker({ ...c, feats: [selected('Initiate Warden')] }, data)(natural).missing).toEqual(['warden spells'])
  })

  it('enforces animal-companion and bare hunter-edge capabilities instead of treating absent capabilities as manual', () => {
    const companion = target('an animal companion')
    const manifold = target("hunter's edge, masterful hunter")
    const edge = entry('classFeature', "Hunter's Edge", { class: 'Ranger' })
    const hunter = entry('classFeature', 'Masterful Hunter', { class: 'Ranger' }, 17)
    const data = [companion, manifold, edge, hunter]
    const c: Character = { ...base, className: 'Ranger', level: 18 }
    expect(featPrerequisiteChecker(c, data)(companion)).toEqual({ missing: ['an animal companion'], manual: [] })
    expect(featPrerequisiteChecker({ ...c, companions: [{ id: 'bear', name: '', type: 'Bear' }] }, data)(companion)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(c, data)(manifold)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(c, data, 16)(manifold)).toEqual({ missing: ['masterful hunter'], manual: [] })
    expect(featPrerequisiteChecker({ ...c, className: 'Fighter' }, data)(manifold).missing).toEqual(["hunter's edge", 'masterful hunter'])
  })

  it('accepts a faithful steed for Ferocious Beasts without requiring the Animal Companion feat', () => {
    const beasts = entry('feat', 'Ferocious Beasts', {
      prerequisite: 'Bonded Animal, animal companion, or Pet; Orc Ferocity',
    }, 13, ['Orc'])
    const data = [beasts, ...['Bonded Animal', 'Animal Companion', 'Pet', 'Orc Ferocity', 'Faithful Steed']
      .map(name => entry('feat', name))]
    const ferocity = { ...selected('Orc Ferocity'), type: 'Ancestry Feat', slot: 'ancestry:1:0' }
    const c: Character = { ...base, className: 'Champion', ancestry: 'Orc', level: 13,
      feats: [ferocity, selected('Faithful Steed')], companions: [{ id: 'steed', name: '', type: 'Horse' }] }
    const slot = { category: 'ancestry' as const, level: 13, key: 'ancestry:13:0' }
    expect(featSelectionPrerequisiteChecker(c, data, slot)(beasts)).toEqual({ missing: [], manual: [] })
    expect(featSelectionPrerequisiteChecker({ ...c, companions: [] }, data, slot)(beasts).missing)
      .toContain('Bonded Animal, animal companion, or Pet')
    expect(featSelectionPrerequisiteChecker({ ...c, feats: [selected('Faithful Steed')] }, data, slot)(beasts))
      .toEqual({ missing: ['Orc Ferocity'], manual: [] })
    expect(featPrerequisiteChecker(c, data)(target('Animal Companion'))).toEqual({ missing: ['Animal Companion'], manual: [] })
    for (const name of ['Bonded Animal', 'Pet']) {
      expect(featSelectionPrerequisiteChecker({ ...c, companions: [], feats: [ferocity, selected(name)] }, data, slot)(beasts))
        .toEqual({ missing: [], manual: [] })
    }
  })

  it('allows Rangers to substitute Survival only for Snarecrafter archetype Crafting prerequisites, including prerequisite chains', () => {
    const dedication = entry('feat', 'Snarecrafter Dedication', { archetype: 'Snarecrafter', prerequisite: 'trained in Crafting' }, 2, ['Archetype', 'Dedication'])
    const snares = entry('feat', 'Powerful Snares', { archetype: 'Snarecrafter', prerequisite: 'master in Crafting; Snarecrafter Dedication' }, 8, ['Archetype'])
    const unrelated = entry('feat', 'Other Craft', { prerequisite: 'master in Crafting' }, 8, ['Ranger'])
    const data = [dedication, snares, unrelated]
    const c: Character = { ...base, className: 'Ranger', level: 8, rankOverrides: { Survival: 3 },
      feats: [{ ...selected(dedication.name, 2), type: 'Archetype Feat', slot: 'archetype:2:0' }] }
    expect(featPrerequisiteChecker(c, data)(snares)).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(c, data)({ ...snares, data: { ...snares.data,
      prerequisite: '[Ranger] master in Crafting; Snarecrafter Dedication' } })).toEqual({ missing: [], manual: [] })
    expect(featPrerequisiteChecker(c, data)(unrelated).missing).toEqual(['master in Crafting'])
    expect(featPrerequisiteChecker({ ...c, className: 'Fighter' }, data)(snares).missing).toContain('master in Crafting')
    expect(featPrerequisiteChecker({ ...c, rankOverrides: { Survival: 2 } }, data)(snares).missing).toEqual(['master in Crafting'])
    expect(featPrerequisiteChecker({ ...c, feats: [] }, data)(snares).missing).toEqual(['Snarecrafter Dedication'])
  })

  it('grants Multitalented only second-level multiclass dedications, bypassing dedication locks but preserving other prerequisites', () => {
    const previous = getSettings().ignoreArchetypeFeatMinimums
    onTestFinished(() => updateSettings({ ignoreArchetypeFeatMinimums: previous }))
    updateSettings({ ignoreArchetypeFeatMinimums: false })
    const cavalier = entry('feat', 'Cavalier Dedication', { archetype: 'Cavalier' }, 2, ['Archetype', 'Dedication'])
    const wizard = entry('feat', 'Wizard Dedication', { archetype: 'Wizard', prerequisite: 'Intelligence +2; trained in Arcana' }, 2,
      ['Archetype', 'Dedication', 'Multiclass'])
    const ownClass = entry('feat', 'Barbarian Dedication', { archetype: 'Barbarian' }, 2, ['Archetype', 'Dedication', 'Multiclass'])
    const medic = entry('feat', 'Medic Dedication', { archetype: 'Medic' }, 2, ['Archetype', 'Dedication'])
    const highLevel = entry('feat', 'High Dedication', { archetype: 'High' }, 4, ['Archetype', 'Dedication', 'Multiclass'])
    const nonDedication = entry('feat', 'Other Archetype Feat', { archetype: 'Wizard' }, 2, ['Archetype', 'Multiclass'])
    const data = [cavalier, wizard, ownClass, medic, highLevel, nonDedication]
    const c: Character = { ...base, level: 9, ancestry: 'Human', skillPicks: ['Arcana'],
      feats: [
        { name: cavalier.name, type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' },
        { name: 'Multitalented', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' },
      ] }
    const slot = plannedSlots(c).find(slot => slot.grantedBy === 'Multitalented')!
    expect(slot).toMatchObject({ category: 'archetype', level: 9, maxFeatLevel: 2 })
    expect(featTakenLevel({ name: wizard.name, type: 'Dedication Feat', level: 2, slot: slot.key })).toBe(9)
    expect(featSelectionPrerequisiteChecker(c, data, slot)(wizard).missing).toEqual(['Intelligence +2'])
    const aiuvarin = { ...c, heritage: 'Aiuvarin' }
    expect(eligibleFeats(data, aiuvarin, slot).map(feat => feat.name)).toEqual([wizard.name])
    expect(featSelectionPrerequisiteChecker({ ...aiuvarin, skillPicks: [] }, data, slot)(wizard).missing).toEqual(['trained in Arcana'])
    const normal = { key: 'archetype:8:0', category: 'archetype' as const, level: 8 }
    expect(featSelectionPrerequisiteChecker(aiuvarin, data, normal)(wizard).missing).toContain('Intelligence +2')
    expect(featSelectionPrerequisiteChecker(aiuvarin, data, normal)(wizard).missing)
      .toContain('2 more Cavalier archetype feats before another dedication')
    expect(eligibleFeats(data, { ...c, abilities: { ...c.abilities, int: 14 } }, slot)).toContain(wizard)
    expect(plannedSlots({ ...c, level: 8 }).some(slot => slot.grantedBy === 'Multitalented')).toBe(false)
    expect(plannedSlots({ ...c, feats: c.feats.slice(0, 1) }).some(slot => slot.grantedBy === 'Multitalented')).toBe(false)
  })

  it('enforces Adapted Cantrip, Adaptive Adept, and Inner Wellspring at selection level', () => {
    const cantrip = entry('feat', 'Adapted Cantrip', { prerequisite: 'spellcasting class feature' }, 1, ['Human'])
    const adept = entry('feat', 'Adaptive Adept', { prerequisite: 'Adapted Cantrip; can cast 3rd-rank spells' }, 5, ['Human'])
    const inner = entry('feat', 'Inner Wellspring', { prerequisite: 'focus pool' }, 13, ['Human'])
    const wizard = entry('class', 'Wizard', { tradition: 'Arcane' })
    const focus = entry('feat', 'Focus Grant', { grants_focus_spells: 'Focus Spell' })
    const mystic = entry('classFeature', 'Mystic Spellcasting', { class: 'Mystic' })
    const data = [cantrip, adept, inner, wizard, focus, mystic]
    const c = { ...base, ancestry: 'Human', level: 13, className: 'Fighter' }
    const first = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
    const fifth = { key: 'ancestry:5:0', category: 'ancestry' as const, level: 5 }
    const thirteenth = { key: 'ancestry:13:0', category: 'ancestry' as const, level: 13 }
    expect(eligibleFeats(data, c, first)).not.toContain(cantrip)
    expect(eligibleFeats(data, { ...c, className: 'Mystic' }, first)).toContain(cantrip)
    expect(eligibleFeats(data, c, thirteenth)).not.toContain(inner)
    expect(eligibleFeats(data, { ...c, feats: [selected('Focus Grant', 2)] }, thirteenth)).toContain(inner)
    const caster = { ...c, className: 'Wizard', feats: [{ ...selected('Adapted Cantrip', 1), slot: 'ancestry:1:0' }] }
    expect(eligibleFeats(data, caster, fifth)).toContain(adept)
    expect(featPrerequisiteChecker(caster, data, 4)(adept).missing).toContain('can cast 3rd-rank spells')
    expect(eligibleFeats(data, { ...caster, feats: [] }, fifth)).not.toContain(adept)
    expect(eligibleFeats(data, { ...caster, className: 'Fighter' }, fifth)).not.toContain(adept)
    expect(check('can cast 3rd-level spells', caster, data, 5).missing).toEqual([])
  })
  it.each([['Gloomseer', 'Nidalese'], ['Dragon Spit', 'Tian-Dan'], ['Wavetouched Paragon', 'Bonuwat']])('enforces %s ethnicity as a prerequisite, not overridable access', (name, ethnicity) => {
    const feat = entry('feat', name, { prerequisite: `${ethnicity} ethnicity` }, 1, ['Human'])
    const c: Character = { ...base, level: 1, ancestry: 'Human', featAccessOverrides: [feat.id] }
    const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
    for (const ethnicity of [undefined, 'Kellid']) {
      const character = { ...c, ethnicity }
      expect(featSelectionPrerequisiteChecker(character, [feat], slot)(feat)).toEqual({ missing: [String(feat.data.prerequisite)], manual: [] })
      expect(eligibleFeats([feat], character, slot)).not.toContain(feat)
    }
    expect(featSelectionPrerequisiteChecker({ ...c, ethnicity: ethnicity.toLowerCase() }, [feat], slot)(feat)).toEqual({ missing: [], manual: [] })
    expect(eligibleFeats([feat], { ...c, ethnicity }, slot)).toContain(feat)
    expect(check(`${ethnicity} ethnicity or Kellid ethnicity`, { ...c, ethnicity: 'Kellid' })).toEqual({ missing: [], manual: [] })
  })

  it.each([
    ['Grondaksen (Underground)', 'underground dwarf'],
    ['Holtaksen (Mountain)', 'mountain dwarf'],
    ['Ergaksen (Surface)', 'surface dwarf'],
  ])('retains existing dwarf ethnicity prerequisites for %s', (ethnicity, legacy) => {
    expect(check(`${legacy} ethnicity`, { ...base, ancestry: 'Dwarf', ethnicity })).toEqual({ missing: [], manual: [] })
    expect(check(`${ethnicity} ethnicity`, { ...base, ancestry: 'Dwarf', ethnicity: legacy })).toEqual({ missing: [], manual: [] })
    expect(check(`${legacy} ethnicity`, { ...base, ancestry: 'Dwarf', ethnicity: 'Kellid' }).missing).toEqual([`${legacy} ethnicity`])
  })

  it('combines ethnicity alternatives with other required prerequisites', () => {
    const alternatives = 'Garundi ethnicity, Mauxi ethnicity, or Tian-Yae ethnicity'
    expect(check(alternatives, { ...base, ethnicity: 'Mauxi' })).toEqual({ missing: [], manual: [] })
    expect(check(alternatives, { ...base, ethnicity: 'Kellid' })).toEqual({ missing: [alternatives], manual: [] })
    expect(check('Nidalese ethnicity; Strength +3', { ...base, ethnicity: 'Nidalese' })).toEqual({ missing: ['Strength +3'], manual: [] })
    expect(check('Nidalese ethnicity; Strength +3', { ...base, ethnicity: 'Kellid', abilities: { ...base.abilities, str: 16 } }))
      .toEqual({ missing: ['Nidalese ethnicity'], manual: [] })
  })

  it('toggles dedication feat minimums without bypassing other prerequisites', () => {
    const previous = getSettings().ignoreArchetypeFeatMinimums
    onTestFinished(() => updateSettings({ ignoreArchetypeFeatMinimums: previous }))
    const hellknight = entry('feat', 'Hellknight Dedication', { archetype: 'Hellknight' }, 2, ['Archetype', 'Dedication'])
    const medic = entry('feat', 'Medic Dedication', { archetype: 'Medic', prerequisite: 'trained in Medicine' }, 2, ['Archetype', 'Dedication'])
    const medicFeat = entry('feat', 'Medic Training', { archetype: 'Medic' }, 4, ['Archetype'])
    const c: Character = { ...base, level: 6, feats: [selected(hellknight.name, 2)] }
    const data = [hellknight, medic, medicFeat]
    const slot = { key: 'archetype:6:0', category: 'archetype' as const, level: 6 }
    updateSettings({ ignoreArchetypeFeatMinimums: true })
    expect(featSelectionPrerequisiteChecker(c, data, slot)(medic).missing).toEqual(['trained in Medicine'])
    expect(featSelectionPrerequisiteChecker({ ...c, skillPicks: ['Medicine'] }, data, slot)(medic).missing).toEqual([])
    expect(featSelectionPrerequisiteChecker(c, data, slot)(medicFeat).missing).toContain('Medic Dedication')
    updateSettings({ ignoreArchetypeFeatMinimums: false })
    expect(featSelectionPrerequisiteChecker({ ...c, skillPicks: ['Medicine'] }, data, slot)(medic).missing)
      .toContain('2 more Hellknight archetype feats before another dedication')
  })

  it('explains dedication locks while allowing pickers to include unmet options', () => {
    const previous = getSettings().ignoreArchetypeFeatMinimums
    onTestFinished(() => updateSettings({ ignoreArchetypeFeatMinimums: previous }))
    updateSettings({ ignoreArchetypeFeatMinimums: false })
    const dedication = entry('feat', 'Cavalier Dedication', { archetype: 'Cavalier' }, 2, ['Archetype', 'Dedication'])
    const other = entry('feat', 'Defend Mount', { archetype: 'Cavalier' }, 4, ['Archetype'])
    const medic = entry('feat', 'Medic Dedication', { archetype: 'Medic' }, 2, ['Archetype', 'Dedication'])
    const c: Character = { ...base, level: 6, feats: [selected(dedication.name, 2), selected(other.name, 4)] }
    const data = [dedication, other, medic]
    const slot = { key: 'archetype:6:0', category: 'archetype' as const, level: 6 }
    expect(featSelectionPrerequisiteChecker(c, data, slot)(medic).missing).toEqual(['1 more Cavalier archetype feat before another dedication'])
    expect(eligibleFeats(data, c, slot)).not.toContain(medic)
    expect(eligibleFeats(data, c, slot, { includeUnmetPrerequisites: true })).toContain(medic)
  })

  it('explains required companion types without leaving a redundant manual warning', () => {
    const steed = entry('feat', 'Chiardmar Steed', { prerequisite: 'horse animal companion' }, 6, ['Ranger'])
    const c: Character = { ...base, className: 'Ranger', level: 6 }
    const slot = { key: 'class:6:0', category: 'class' as const, level: 6 }
    expect(featSelectionPrerequisiteChecker(c, [steed], slot)(steed)).toEqual({ missing: ['horse animal companion'], manual: [] })
    expect(featSelectionPrerequisiteChecker({ ...c, companions: [{ id: 'horse', type: 'Horse', name: 'Horse' }] }, [steed], slot)(steed))
      .toEqual({ missing: [], manual: [] })
    expect(eligibleFeats([steed], c, slot, { includeUnmetPrerequisites: true })).toContain(steed)
  })

  it('plans selected feat chains while enforcing their prerequisites and self-exclusion', () => {
    const giant = entry('subclass', 'Giant', { class: 'Barbarian' })
    const parent = entry('feat', "Giant's Stature", { prerequisite: 'Giant instinct' }, 6, ['Barbarian'])
    const child = entry('feat', "Titan's Stature", { prerequisite: "Giant's Stature" }, 12, ['Barbarian'])
    const data = [giant, parent, child]
    const slot = { key: 'class:12:0', category: 'class' as const, level: 12 }
    const c = { ...base, subclass: 'Giant', feats: [selected(parent.name, 6)] }
    expect(eligibleFeats(data, base, slot)).not.toContain(child)
    expect(eligibleFeats(data, c, slot)).toContain(child)
    expect(eligibleFeats(data, { ...c, subclass: 'Fury' }, slot)).not.toContain(child)
    expect(eligibleFeats(data, { ...c, feats: [selected(parent.name, 14)] }, slot)).toContain(child)
    expect(featPrerequisiteChecker(c, data, 12, 0)(child).missing).toEqual([parent.name])
    expect(c.feats).toEqual([selected(parent.name, 6)])
  })

  it.each([
    ['Barbarian', 'Animal', 'instinct'], ['Bard', 'Maestro', 'muse'],
    ['Cleric', 'Warpriest', 'doctrine'], ['Rogue', 'Ruffian', 'racket'],
    ['Sorcerer', 'Angelic', 'bloodline'], ['Witch', 'Resentment', 'patron'],
    ['Alchemist', 'Bomber', 'research field'], ['Champion', 'Justice', 'cause'],
    ['Oracle', 'Battle', 'mystery'], ['Investigator', 'Empiricism', 'methodology'],
    ['Inventor', 'Armor', 'innovation'], ['Gunslinger', 'Pistolero', 'way'],
    ['Magus', 'Laughing Shadow', 'hybrid study'], ['Psychic', 'The Tangible Dream', 'conscious mind'],
    ['Animist', 'Medium', 'practice'], ['Summoner', 'Dragon', 'eidolon'],
    ['Swashbuckler', 'Fencer', 'style'], ['Wizard', 'School of Battle Magic', 'arcane school'],
    ['Ranger', 'Precision', "hunter's edge"],
  ])('checks %s specialization requirements using the same evaluator', (className, subclass, role) => {
    const data = [entry('subclass', subclass, { class: className })]
    const prerequisite = `${subclass} ${role}`
    expect(check(prerequisite, { ...base, className, subclass }, data)).toEqual({ missing: [], manual: [] })
    expect(check(prerequisite, { ...base, className, subclass: 'Other' }, data).missing).toEqual([prerequisite])
  })

  it('recognizes additional druid orders, Untamed/Wild naming, and class-qualified prerequisites', () => {
    const c = { ...base, className: 'Druid', order: 'Storm', subclass: undefined,
      feats: [{ ...selected('Order Explorer', 2), choice: 'Wild' }] }
    expect(check('animal instinct or untamed order', c, [entry('subclass', 'Animal', { class: 'Barbarian' })])).toEqual({ missing: [], manual: [] })
    expect(check('animal order', c).missing).toEqual(['animal order'])
    expect(check('[Druid] animal order', { ...c, order: 'Animal' }).missing).toEqual([])
    expect(check('[Druid] animal order', { ...base, className: 'Ranger' }).missing).toEqual([])
    expect(check('[Druid] animal order', c).missing).toEqual(['animal order'])
  })

  it('counts automatic muse feats, additional muses, animal-order companions, and modeled spellcasting', () => {
    const muse = { ...entry('subclass', 'Maestro', { class: 'Bard' }),
      description: 'Muse Feat Lingering Composition\n\nMuse Spell soothe' }
    const enigma = entry('subclass', 'Enigma', { class: 'Bard' })
    const data = [muse, enigma, entry('feat', 'Lingering Composition'), entry('feat', 'Animal Companion'),
      entry('class', 'Bard', { tradition: 'Occult' })]
    const bard: Character = { ...base, className: 'Bard', subclass: 'Enigma',
      feats: [{ ...selected('Multifarious Muse', 2), choice: 'Maestro' }] }
    expect(check('maestro muse; Lingering Composition; spellcasting class feature', bard, data))
      .toEqual({ missing: [], manual: [] })
    expect(check('Lingering Composition', { ...bard, feats: [] }, data).missing).toHaveLength(1)
    expect(check('Animal Companion', { ...base, className: 'Druid', order: 'Animal' }, data)).toEqual({ missing: [], manual: [] })
    expect(check('ability to cast spells', bard, data)).toEqual({ missing: [], manual: [] })
  })

  it.each([
    ['pf2e', 'Lizardfolk', 'Cloudleaper Lizardfolk', 'Iruxi Glide'],
    ['pf2e', 'Tengu', 'Wavediver Tengu', 'Waxed Feathers'],
    ['pf2e', 'Leshy', 'Pine Leshy', 'Towering Growth'],
    ['sf2e', 'Vesk', 'Fork-Tongued Vesk', 'Venomous Cocktail'],
    ['sf2e', 'Lashunta', 'Damaya Lashunta', 'Psychic Scholar'],
    ['sf2e', 'Android', 'Hellforged Android', 'Hardened Plates'],
  ] as const)('checks %s %s ancestry feat heritage prerequisites', (system, ancestry, heritage, name) => {
    const data = [
      { ...entry('heritage', heritage), systems: [system] },
      { ...entry('feat', name, { prerequisite: `${heritage} heritage` }, 1, [ancestry]), systems: [system] },
    ]
    const c: Character = { ...base, systems: [system], ancestry, heritage }
    const slot = { key: 'ancestry:5:0', category: 'ancestry' as const, level: 5 }
    expect(eligibleFeats(data, c, slot)).toContain(data[1])
    expect(eligibleFeats(data, { ...c, heritage: 'Different heritage' }, slot)).not.toContain(data[1])
    expect(eligibleFeats(data, { ...c, ancestry: 'Human' }, slot)).not.toContain(data[1])
  })

  it('enforces Wandering Heart environmental heritage requirements without guessing unknown heritages', () => {
    const prerequisite = 'Arctic Elf, Cavern Elf, Desert Elf, Woodland Elf, or any other elf heritage based on adapting to an environment'
    for (const heritage of ['Arctic Elf', 'Cavern Elf', 'Desert Elf', 'Woodland Elf', 'Aquatic Elf']) {
      expect(check(prerequisite, { ...base, ancestry: 'Elf', heritage })).toEqual({ missing: [], manual: [] })
    }
    for (const heritage of ['Ancient Elf', 'Seer Elf', 'Whisper Elf', undefined]) {
      expect(check(prerequisite, { ...base, ancestry: 'Elf', heritage }).missing).toEqual([prerequisite])
    }
    expect(check(prerequisite, { ...base, ancestry: 'Elf', heritage: 'Unrecognized Elf' }))
      .toEqual({ missing: [], manual: [prerequisite] })
    const feat = entry('feat', 'Wandering Heart', { prerequisite }, 13, ['Elf'])
    const slot = { key: 'ancestry:13:0', category: 'ancestry' as const, level: 13 }
    const elf = { ...base, level: 13, ancestry: 'Elf' }
    expect(eligibleFeats([feat], { ...elf, heritage: 'Woodland Elf' }, slot)).toContain(feat)
    expect(eligibleFeats([feat], { ...elf, heritage: 'Ancient Elf' }, slot)).not.toContain(feat)
  })

  it('restricts Otherworldly Magic to Elf ancestry without inventing a prerequisite', () => {
    const feat = entry('feat', 'Otherworldly Magic', {}, 1, ['Elf'])
    const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
    expect(eligibleFeats([feat], { ...base, ancestry: 'Elf' }, slot)).toContain(feat)
    expect(eligibleFeats([feat], { ...base, ancestry: 'Human' }, slot)).not.toContain(feat)
  })

  it('handles AND, OR, parentheses, Oxford lists, and inherited rank or specialization wording', () => {
    const data = [entry('feat', 'Cleave'), entry('feat', 'Knockback'), entry('feat', 'Thrash'),
      ...['Armor', 'Construct', 'Weapon'].map((name) => entry('subclass', name, { class: 'Inventor' }))]
    const c = { ...base, skillPicks: ['Athletics', 'Nature'], feats: [selected('Cleave')],
      skillIncreases: { 3: 'Athletics', 5: 'Nature' } }
    expect(check('Cleave; (Knockback or Thrash)', c, data).missing).toEqual(['Knockback or Thrash'])
    expect(check('Cleave or Knockback', c, data).missing).toEqual([])
    expect(check('Cleave; expert in Athletics and Nature', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('Trained in Arcana, Occultism, or Religion', c, data).missing).toHaveLength(1)
    expect(check('Trained in Arcana, Nature, Occultism, or Religion', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('armor, construct, or weapon innovation', { ...base, className: 'Inventor', subclass: 'Armor' }, data)).toEqual({ missing: [], manual: [] })
    expect(check('armor, construct, or weapon innovation', { ...base, className: 'Inventor', subclass: 'Other' }, data).missing).toHaveLength(1)
  })

  it('does not split conjunctions or commas inside known feat names', () => {
    const names = ['Come and Get Me', 'Poisoned Sticks and Stones', 'Ready, Set, Go']
    const data = names.map((name) => entry('feat', name))
    const c = { ...base, feats: names.map((name, i) => selected(name, i + 1)) }
    expect(check('Come and Get Me; Poisoned Sticks and Stones', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('Come and Get Me and Ready, Set, Go', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('Come and Get Me and Ready, Set, Go', { ...c, feats: [c.feats[0]] }, data).missing).toEqual(['Ready, Set, Go'])
  })

  it.each([
    ['Trained in Medicine or Tian Xia Lore', 'Medicine', 'Tian Xia Lore', 1],
    ['Expert in Crafting or Cooking Lore', 'Crafting', 'Cooking Lore', 2],
    ['Expert in Religion or Expert in Undead Lore', 'Religion', 'Undead Lore', 2],
    ['Master in Crafting, Master in Medicine, or Herbalism Lore', 'Medicine', 'Herbalism Lore', 3],
  ] as const)('accepts either qualified skill in %s without treating the whole expression as a Lore name', (prerequisite, skill, lore, rank) => {
    const c: Character = { ...base, skillPicks: [skill],
      skillIncreases: Object.fromEntries([3, 7].slice(0, rank - 1).map((level) => [level, skill])) }
    expect(check(prerequisite, c)).toEqual({ missing: [], manual: [] })
    expect(check(prerequisite, { ...base, lores: [{ name: lore, rank }] })).toEqual({ missing: [], manual: [] })
    expect(check(prerequisite).missing).toHaveLength(1)
  })

  it('resolves named ancestry feat prerequisites using their ancestry source rather than another same-named feat', () => {
    const ancestry = entry('feat', 'Draconic Scent', {}, 1, ['Dragonblood'])
    const archetype = { ...entry('feat', 'Draconic Scent', { prerequisite: 'Dragon Disciple Dedication' }, 1, ['Archetype']),
      id: 'archetype:scent' }
    const c: Character = { ...base, ancestry: 'Human', heritage: 'Dragonblood',
      feats: [{ ...selected('Draconic Scent'), type: 'Ancestry Feat', slot: 'ancestry:1:0' }] }
    expect(check('Draconic Scent', c, [archetype, ancestry, entry('feat', 'Dragon Disciple Dedication')]))
      .toEqual({ missing: [], manual: [] })
  })

  it('allows ancestry feats granted by a versatile heritage without granting access to other heritages', () => {
    const feat = entry('feat', 'Draconic Scent', {}, 1, ['Dragonblood'])
    const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
    expect(eligibleFeats([feat], { ...base, ancestry: 'Human', heritage: 'Dragonblood' }, slot)).toContain(feat)
    expect(eligibleFeats([feat], { ...base, ancestry: 'Human', heritage: 'Aiuvarin' }, slot)).not.toContain(feat)
  })

  it('uses level-appropriate skill ranks, abilities, class features, and background-granted feats', () => {
    const c: Character = { ...base, skillPicks: ['Athletics'], skillIncreases: { 3: 'Athletics', 7: 'Athletics' } }
    expect(check('master in Athletics', c, [], 6).missing).toHaveLength(1)
    expect(check('master in Athletics', c, [], 7).missing).toHaveLength(0)
    expect(check('Strength +2; Dexterity 12', c).missing).toEqual([])
    expect(check('Intelligence +1', c).missing).toEqual(['Intelligence +1'])
    const data = [entry('classFeature', 'Weapon Specialization', { class: 'Barbarian' }, 7),
      entry('feat', 'Shield Block'), entry('background', 'Guard', { feat: 'Shield Block' })]
    expect(check('weapon specialization', c, data, 6).missing).toHaveLength(1)
    expect(check('weapon specialization', c, data, 7).missing).toHaveLength(0)
    expect(check('Shield Block', { ...c, background: 'Guard' }, data)).toEqual({ missing: [], manual: [] })
  })

  it('checks armor, weapons, saves, Lore, and senses without treating unknown qualifications as satisfied', () => {
    const klass = entry('class', 'Barbarian', {
      attack_proficiency: 'Trained in martial weapons', defense_proficiency: 'Trained in medium armor',
      fortitude_proficiency: 'Expert',
    })
    const c = { ...base, ancestry: 'Elf', lores: [{ name: 'Warfare Lore', rank: 3 }] }
    const data = [klass, entry('ancestry', 'Elf', { vision: 'Low-Light Vision' })]
    expect(check('trained in medium armor and martial weapons; expert in Fortitude saves', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('master in one or more Lore skills', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('trained in Astrology Lore or trained in Occultism', c, data).missing).toHaveLength(1)
    expect(check('low-light vision or scent', c, data)).toEqual({ missing: [], manual: [] })
    expect(check('you have permanent wings', c, data)).toEqual({ missing: [], manual: ['you have permanent wings'] })
    expect(check('trained in a skill with the Recall Knowledge action', c, data).manual).toHaveLength(1)
    expect(check('Cleave or a special blessing from your GM', c, [...data, entry('feat', 'Cleave')]))
      .toEqual({ missing: [], manual: ['Cleave or a special blessing from your GM'] })
  })

  it('reports cyclic dependencies and ambiguous source versions rather than accepting them', () => {
    const a = entry('feat', 'First', { prerequisite: 'Second' })
    const b = entry('feat', 'Second', { prerequisite: 'First' })
    const c = { ...base, feats: [selected('First'), selected('Second')] }
    expect(check('First', c, [a, b]).missing.join()).toContain('Circular prerequisite')
    const variant = { ...a, id: 'variant', data: { prerequisite: 'Third' } }
    expect(check('First', c, [a, variant]).manual).toEqual(['Verify source version of First'])
    expect(check('First', { ...c, entryIds: ['variant'] }, [a, variant, entry('feat', 'Third')]).missing).toEqual(['Third'])
  })
})

it('treats Hellknight plate proficiency prerequisites as heavy armor', () => {
  const c = { ...base, className: 'Fighter' }
  for (const text of ['trained in Hellknight plate', 'expert in Hellknight half plate or Hellknight plate']) {
    expect(check(text, c).manual).toEqual([])
  }
})

it('does not ask to verify Hellknight Test membership prerequisites', () => {
  expect(check('passed the Hellknight Test', base).manual).toEqual([])
})
