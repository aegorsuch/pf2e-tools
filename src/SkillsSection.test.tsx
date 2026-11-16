import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { ArmorProficiency, SkillsSection } from './SkillsSection'
import { FeatChoice } from './FeatChoice'
import { armorRanks, defenseSummary, initiativeBonus, ranksAt, skillRankBudget, weaponRanks } from './builder'
import * as builder from './builder'
import type { Character, ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'

const ranger: ContentEntry = {
  id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1,
  traits: [], description: '', effects: [], updatedAt: 0,
  data: {
    skill_proficiency: 'Trained in Nature, Trained in a number of additional skills equal to 4 plus your Intelligence modifier',
    perception_proficiency: 'Trained', fortitude_proficiency: 'Expert', reflex_proficiency: 'Trained', will_proficiency: 'Trained',
  },
}
const feyBound: ContentEntry = {
  id: 'fey-bound', systems: ['pf2e'], kind: 'background', source: 'official', name: 'Fey Bound', level: 1,
  traits: [], description: '', effects: [], updatedAt: 0, data: { skill: 'Fey Lore' },
}
const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('shows Rider as a conditional Nature bonus without increasing ordinary Nature checks', () => {
  const c: Character = { ...base, feats: [{ name: 'Rider', type: 'Class Feat', level: 1 }] }
  const render = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={[ranger]} save={() => {}} />)
  const markup = render(c)
  expect(markup).toContain('+1 circumstance bonus to Command an Animal checks for your own animal companion')
  expect(markup).toContain('Does not apply to other Nature checks.')
  expect(ranksAt(c, [ranger]).Nature).toBe(ranksAt(base, [ranger]).Nature)
  expect(render(base)).not.toContain('Command an Animal checks for your own animal companion')
})

it('grants Underworld Investigator free trained Lore without Additional Lore progression', () => {
  const previous = getSettings().autoLores
  updateSettings({ autoLores: false })
  const feat = { name: 'Underworld Investigator', type: 'Class Feat', level: 1, slot: 'class:1:0' }
  const c: Character = { ...base, feats: [feat] }
  try {
    for (const level of [1, 3, 7, 15, 20]) expect(ranksAt({ ...c, level }, [ranger])['Underworld Lore']).toBe(1)
    expect(skillRankBudget(c, [ranger]).trained).toBe(skillRankBudget(base, [ranger]).trained)
    expect(builder.featLores(c, [ranger])).not.toContain('Underworld Lore')
    expect(builder.automaticFeatGrants(c, [ranger]).some(grant => grant.source === feat.name)).toBe(false)
    expect(ranksAt({ ...c, feats: [] }, [ranger])['Underworld Lore']).toBeUndefined()
    expect(ranksAt({ ...c, systems: ['sf2e'] }, [ranger])['Underworld Lore']).toBeUndefined()
    expect(ranksAt({ ...c, level: 9, feats: [{ ...feat, takenLevel: 9 }] }, [ranger], 9)['Underworld Lore']).toBeUndefined()
    expect(ranksAt({ ...c, level: 3, skillIncreases: { 3: 'Underworld Lore' } }, [ranger])['Underworld Lore']).toBe(2)
    const restored: Character = JSON.parse(JSON.stringify(c))
    const markup = renderToStaticMarkup(<SkillsSection c={restored} entries={[ranger]} save={() => {}} />)
    expect(markup).toContain('Underworld Lore')
    expect(markup).toContain('Underworld Investigator')
    expect(markup).toContain('Free trained Lore; does not use a skill training pick.')
    expect(builder.skillDownload({ ...c, systems: ['pf2e', 'sf2e'],
      feats: [feat, { name: 'Skill Download', type: 'Ancestry Feat', level: 1, choice: 'Underworld Lore' }] }, [ranger]))
      .toEqual({ skill: 'Underworld Lore', rank: 1 })
    updateSettings({ autoLores: true })
    expect(ranksAt({ ...c, level: 7 }, [ranger])['Underworld Lore']).toBe(3)
  } finally { updateSettings({ autoLores: previous }) }
})

it.each(['Orc', 'Human'])('gives Experienced Laborer one free trained Lore for %s', ancestry => {
  const previous = getSettings().autoLores
  updateSettings({ autoLores: false })
  let c: Character = { ...base, systems: ['sf2e'], ancestry, level: 7,
    feats: [
      ...(ancestry === 'Human' ? [{ name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' }] : []),
      { name: 'Experienced Laborer', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
    ] }
  const entries = [{ ...ranger, systems: ['sf2e' as const] }]
  const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
  const change = (value: string) => {
    const input = { value, setCustomValidity: vi.fn(), reportValidity: vi.fn() }
    ;(findInput(tree(), 'Experienced Laborer Lore specialty')!.onBlur as (event: unknown) => void)({ target: input })
    return input
  }
  try {
    expect(renderToStaticMarkup(tree())).toContain('One free trained Lore skill.')
    expect(change('Lore').setCustomValidity).toHaveBeenCalledWith('Enter a Lore specialty, not just Lore.')
    expect(c.feats.at(-1)?.choice).toBeUndefined()
    change('  Mining  Lore ')
    c = JSON.parse(JSON.stringify(c))
    expect(ranksAt(c, entries)['Mining Lore']).toBe(1)
    expect(skillRankBudget(c, entries).trained).toBe(4)
    expect(builder.automaticFeatGrants(c, entries).some(grant => grant.source === 'Experienced Laborer')).toBe(false)
    expect(ranksAt({ ...c, level: 0 }, entries)['Mining Lore'] ?? 0).toBe(0)
    expect(renderToStaticMarkup(tree())).toContain('Gather Information when consulting professionals related to Mining Lore.')
    expect(ranksAt(c, entries).Diplomacy ?? 0).toBe(0)
    c = { ...c, skillIncreases: { 3: 'Mining Lore' } }
    expect(ranksAt(c, entries)['Mining Lore']).toBe(2)
    change('Engineering')
    expect(c.skillIncreases).toEqual({})
    expect(ranksAt(c, entries)['Engineering Lore']).toBe(1)
    expect(ranksAt(c, entries)['Mining Lore'] ?? 0).toBe(0)
    expect(skillRankBudget(c, entries).trained).toBe(4)
    change('')
    expect(builder.experiencedLaborerLore(c)).toBeUndefined()
  } finally { updateSettings({ autoLores: previous }) }
})

function findInput(node: ReactNode, label: string): Record<string, unknown> | undefined {
  let found: Record<string, unknown> | undefined
  Children.forEach(node, child => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = child.type === 'input' && child.props['aria-label'] === label
      ? child.props : findInput(child.props.children as ReactNode, label)
  })
  return found
}

function findSelect(node: ReactNode, label: string): Record<string, unknown> | undefined {
  let found: Record<string, unknown> | undefined
  Children.forEach(node, child => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = child.type === 'select' && child.props['aria-label'] === label
      ? child.props : findSelect(child.props.children as ReactNode, label)
  })
  return found
}

it('shows radioactive protection and tracks the two separate daily abilities', () => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Test-Subject Ysoki',
    testSubjectAdaptation: 'Radioactive', ysokiDailyUses: { contaminate: true, retinalHud: false },
    feats: [{ name: 'Rat Retinal HUD', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
  const offense = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="offense" />)
  expect(offense).toContain('actions/232-contaminate')
  expect(offense).toContain('feats/1217-rat-retinal-hud')
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(defense).toContain('sickened from radiation sickness')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, testSubjectAdaptation: undefined, feats: [] }} entries={[]} save={() => {}} part="offense" />))
    .not.toContain('actions/232-contaminate')
})

it("shows Officer's Medical Training using the better Medicine ability and its replacement skill", () => {
  const background: ContentEntry = { ...feyBound, name: 'Medic', data: { skill: 'Medicine' } }
  const c: Character = { ...base, background: 'Medic', abilities: { ...base.abilities, int: 18, wis: 12 },
    feats: [{ name: "Officer's Medical Training", type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'Sailing Lore' }],
    lores: [{ name: 'Sailing Lore', rank: 0 }] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[background, ranger]} save={() => {}} />)
  expect(markup).toContain('Sailing Lore')
  expect(markup).toContain('You can use Intelligence instead of Wisdom for Medicine checks.')
  expect(markup).toMatch(/skill-name">Medicine <b>\+7/)
  expect(ranksAt(c, [background, ranger])['Sailing Lore']).toBe(1)
  const choice = renderToStaticMarkup(<FeatChoice c={c} entries={[background, ranger]} save={() => {}} index={0} />)
  expect(choice).not.toContain('replacement skill')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, lores: [] }} entries={[background, ranger]} save={() => {}} />))
    .toContain('Sailing Lore')
  const betterWisdom = { ...c, abilities: { ...c.abilities, int: 10, wis: 18 } }
  expect(renderToStaticMarkup(<SkillsSection c={betterWisdom} entries={[background, ranger]} save={() => {}} />))
    .toMatch(/skill-name">Medicine <b>\+7/)
})

it('shows Pain Tolerance resistance and conditional save bonus without increasing ordinary saves', () => {
  const c: Character = { ...base, level: 7, feats: [{ name: 'Pain Tolerance', type: 'Class Feat', level: 6, slot: 'class:6:0' }] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="defense" />)
  expect(markup).toContain('Mental 3 (Pain Tolerance)')
  expect(markup).toContain('+1 circumstance bonus against effects that would make you clumsy, drained, or enfeebled.')
  expect(defenseSummary(c, [ranger])).toEqual(defenseSummary({ ...c, feats: [] }, [ranger]))
  const before = renderToStaticMarkup(<SkillsSection c={{ ...c, level: 5 }} entries={[ranger]} save={() => {}} part="defense" />)
  expect(before).not.toContain('Pain Tolerance')
})

it('shows Ysoki conditional bonuses without applying them to ordinary totals', () => {
  const c: Character = { ...base, level: 7, feats: ['Radiation Resistant', 'Tinkering Fingers', 'Extended Family']
    .map(name => ({ name, type: 'Ancestry Feat', level: 1 })) }
  const skills = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="defense" />)
  expect(skills).toContain('Repair without a toolkit without the penalty')
  expect(skills).toContain('Make an Impression or Request against ysoki')
  expect(defense).toContain('Poison (radiation only) 7')
  expect(defense).toContain('+1 circumstance bonus to Fortitude saves against radiation effects.')
  expect(defenseSummary(c, [ranger])).toEqual(defenseSummary({ ...c, feats: [] }, [ranger]))
})

it('displays Skill Download temporarily without changing permanent proficiency', () => {
  const c: Character = { ...base, level: 17, feats: [{ name: 'Skill Download', type: 'Ancestry Feat', level: 1, choice: 'Acrobatics' }] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  expect(markup).not.toContain('Skill Download skill')
  expect(markup).toContain('title="Skill Download: temporary proficiency"')
  expect(markup).toContain('Temporary proficiency until daily preparations')
  expect(markup).toMatch(/skill-name">Acrobatics <b>\+23/)
  expect(ranksAt(c, [ranger]).Acrobatics ?? 0).toBe(0)
  expect(builder.skillDownload({ ...c, level: 9 }, [ranger])).toEqual({ skill: 'Acrobatics', rank: 2 })
  expect(builder.skillDownload({ ...c, level: 1 }, [ranger])).toEqual({ skill: 'Acrobatics', rank: 1 })
  expect(builder.skillDownload({ ...c, feats: [] }, [ranger])).toBeUndefined()
})

it('tracks Cyborg daily uses and displays Machine Heart recovery at the current level', () => {
  const c: Character = { ...base, level: 17, dailyFeatUses: { 'Machine Heart': true, 'Sensor Mask': true },
    feats: [{ name: 'Machine Heart', type: 'Ancestry Feat', level: 17 },
      { name: 'Sensor Mask', type: 'Ancestry Feat', level: 9 },
      { name: 'Fire Crystal Beam', type: 'Ancestry Feat', level: 17 }] }
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(defense).toContain('Machine Heart used')
  expect(defense).toContain('regain 17 Hit Points')
  const offense = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="offense" />)
  expect(offense).toContain('Sensor Mask used')
  expect(offense).toContain('Fire Crystal Beam used')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, level: 8 }} entries={[]} save={() => {}} part="offense" />))
    .not.toContain('Sensor Mask used')
})

it('tracks hourly Ysoki and Cyborg actions without granting them below their feat level', () => {
  const c: Character = { ...base, level: 13, hourlyFeatUses: { 'Uncanny Dash': true }, feats: [
    { name: 'Uncanny Dash', type: 'Ancestry Feat', level: 9 },
    { name: "Grandmother's Curse", type: 'Ancestry Feat', level: 9 },
    { name: 'Wormhole Warren', type: 'Ancestry Feat', level: 17 },
  ] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="offense" />)
  expect(markup).toContain('Uncanny Dash used')
  expect(markup).toContain('Grandmother&#x27;s Curse used')
  expect(markup).toContain('Once per hour. Clear after an hour has passed.')
  expect(markup).not.toContain('Wormhole Warren used')
})

it('allows permanent training in a downloaded skill without treating temporary rank as an increase', () => {
  let c: Character = { ...base, level: 9, skillPicks: [], feats: [
    { name: 'Skill Download', type: 'Ancestry Feat', level: 1, choice: 'Acrobatics' },
  ] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(findButtons(tree()).get('Acrobatics Expert')!.disabled).toBe(false)
  ;(findButtons(tree()).get('Acrobatics Trained')!.onClick as () => void)()
  expect(c.skillPicks).toContain('Acrobatics')
  expect(ranksAt(c, [ranger]).Acrobatics).toBe(1)
  expect(findButtons(tree()).get('Acrobatics Expert')!.disabled).toBe(false)
})

it('shows subclass-granted Lore as a trained skill without an Additional Lore feat', () => {
  const c: Character = { ...base, className: 'Investigator', subclass: 'Empiricism',
    subclassSkillChoices: { 'Investigator:Empiricism': 'Lore', 'Investigator:Empiricism:lore': 'Sailing Lore' } }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Sailing Lore')
  expect(ranksAt(c, [])['Sailing Lore']).toBe(1)
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, subclass: 'Forensic Medicine' }} entries={[]} save={() => {}} />))
    .not.toContain('aria-label="Sailing Lore proficiency"')
})

it('applies clan dagger filigree skill bonuses and marks conditional bonuses separately', () => {
  const c: Character = { ...base, level: 11,
    weapons: [{ id: 'dagger', name: 'Clan Dagger', potency: 0, striking: 0, runes: [], stowed: true }] }
  const render = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={[ranger]} save={() => {}} />)
  const markup = render(c)
  expect(markup).toMatch(/skill-name">Athletics <b>\+2/)
  expect(markup).toMatch(/skill-name">Diplomacy <b>\+2/)
  expect(markup).toMatch(/skill-name">Society <b>\+2/)
  expect(markup).toContain('+2 item bonus to Coerce.')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="offense" />))
    .toContain('+2 item bonus to Sense Motive.')
  expect(render({ ...c, level: 4 })).not.toContain('Clan dagger filigree')
  expect(render({ ...c, weapons: [] })).not.toContain('Clan dagger filigree')
})

it('skips skill allocation calculations in offense and defense', () => {
  const budget = vi.spyOn(builder, 'skillRankBudget')
  try {
    for (const part of ['offense', 'defense'] as const) {
      renderToStaticMarkup(<SkillsSection c={base} entries={[ranger]} save={() => {}} part={part} />)
    }
    expect(budget).not.toHaveBeenCalled()
    renderToStaticMarkup(<SkillsSection c={base} entries={[ranger]} save={() => {}} />)
    expect(budget).toHaveBeenCalled()
  } finally {
    budget.mockRestore()
  }
})

it('keeps the primary Mastermind skill choice in Skills', () => {
  const c: Character = { ...base, className: 'Rogue', subclass: 'Mastermind', rogueRacketSkills: { Mastermind: 'Religion' } }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('aria-label="Mastermind racket skill"')
  expect(markup).toContain('<option selected="">Religion</option>')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />))
    .not.toContain('aria-label="Mastermind racket skill"')
})

it('automatically refunds redundant training while preserving conditional alternate grants', () => {
  const c: Character = { ...base, level: 5, skillPicks: ['Nature', 'Survival'] }
  expect(skillRankBudget(c, [ranger]).trained).toBe(3)
  expect(skillRankBudget({ ...c, className: undefined }, [ranger]).trained).toBe(0)
  const sf: Character = { ...base, systems: ['sf2e'], ancestry: 'Elf', skillPicks: ['Society'], feats: [
    { name: 'Cite the Deep Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'Medicine' },
  ] }
  const sfRanger: ContentEntry = { ...ranger, systems: ['sf2e'] }
  expect(skillRankBudget(sf, [sfRanger]).trained).toBe(3)
  expect(ranksAt(sf, [sfRanger]).Medicine).toBe(1)
  expect(skillRankBudget({ ...sf, feats: [] }, [sfRanger]).trained).toBe(3)
})

it('grants elf feat skills or provides replacement training in Skills without double counting', () => {
  const feats = ['Cite the Deep Lore', "Diplomat's Facade"].map(name =>
    ({ name, type: 'Ancestry Feat', level: 1, slot: `ancestry:1:${name}` }))
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Elf', feats }
  const sfRanger: ContentEntry = { ...ranger, systems: ['sf2e'] }
  expect(ranksAt(c, [sfRanger])).toMatchObject({ Society: 1, Deception: 1 })
  expect(skillRankBudget(c, [sfRanger]).trained).toBe(4)
  const background: ContentEntry = { ...feyBound, systems: ['sf2e'], name: 'Diplomat', data: { skill: 'Society, Deception' } }
  const duplicates = { ...c, background: background.name }
  expect(skillRankBudget(duplicates, [sfRanger, background]).trained).toBe(6)
  expect(skillRankBudget({ ...c, skillPicks: ['Society', 'Deception'] }, [sfRanger]).trained).toBe(4)
  expect(skillRankBudget({ ...duplicates, skillPicks: ['Acrobatics', 'Medicine'] }, [sfRanger, background]).trained).toBe(4)
  expect(skillRankBudget({ ...duplicates, level: 0 }, [sfRanger, background]).trained).toBe(4)
  let edited = duplicates
  const tree = () => SkillsSection({ c: edited, entries: [sfRanger, background], save: patch => { edited = { ...edited, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain('<b>T</b>6')
  ;(findButtons(tree()).get('Acrobatics Trained')!.onClick as () => void)()
  ;(findButtons(tree()).get('Medicine Trained')!.onClick as () => void)()
  expect(edited.skillPicks).toEqual(['Acrobatics', 'Medicine'])
  expect(renderToStaticMarkup(tree())).toContain('<b>T</b>4')
})

it.each([
  ['Broken Hand Technique', 'Athletics', 'sf2e', 'Orc'],
  ['Spelunker', 'Acrobatics', 'sf2e', 'Orc'],
  ['Cite the Deep Lore', 'Society', 'sf2e', 'Elf'],
  ["Diplomat's Facade", 'Deception', 'sf2e', 'Elf'],
  ['Eye for Treasure', 'Crafting', 'pf2e', 'Dwarf'],
  ["Officer's Medical Training", 'Medicine', 'pf2e', 'Human'],
  ['Shiny', 'Performance', 'sf2e', 'Human'],
] as const)('puts %s replacement training in Skills', (name, skill, system, ancestry) => {
  const klass: ContentEntry = { ...ranger, systems: [system] }
  const background: ContentEntry = { ...feyBound, systems: [system], name: 'Training', data: { skill } }
  const feat = { name, type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
  const untrained: Character = { ...base, systems: [system], ancestry, feats: [feat] }
  expect(ranksAt(untrained, [klass])[skill]).toBe(1)
  expect(skillRankBudget(untrained, [klass]).trained).toBe(4)
  expect(skillRankBudget({ ...untrained, skillPicks: [skill] }, [klass]).trained).toBe(4)
  let c: Character = { ...untrained, background: 'Training' }
  const entries = [klass, background]
  expect(skillRankBudget(c, entries).trained).toBe(5)
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={entries} index={0} save={() => {}} />)).toBe('')
  const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
  ;(findButtons(tree()).get('Thievery Trained')!.onClick as () => void)()
  expect(c.skillPicks).toEqual(['Thievery'])
  expect(ranksAt(c, entries).Thievery).toBe(1)
  expect(skillRankBudget(c, entries).trained).toBe(4)
  expect(skillRankBudget({ ...c, level: 0 }, entries).trained).toBe(3)
})

it('adds Spelunker replacement training through Adopted Ancestry in Skills', () => {
  const klass: ContentEntry = { ...ranger, systems: ['sf2e'] }
  const background: ContentEntry = { ...feyBound, systems: ['sf2e'], name: 'Training', data: { skill: 'Acrobatics' } }
  let c: Character = { ...base, systems: ['sf2e'], ancestry: 'Human',
    feats: [
      { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' },
      { name: 'Spelunker', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
    ] }
  expect(ranksAt(c, [klass]).Acrobatics).toBe(1)
  expect(skillRankBudget(c, [klass]).trained).toBe(4)
  c = { ...c, background: 'Training' }
  const entries = [klass, background]
  expect(skillRankBudget(c, entries).trained).toBe(5)
  const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
  ;(findButtons(tree()).get('Thievery Trained')!.onClick as () => void)()
  expect(c.skillPicks).toEqual(['Thievery'])
  expect(ranksAt(c, entries).Thievery).toBe(1)
  expect(skillRankBudget(c, entries).trained).toBe(4)
})

it('migrates saved replacement skills into ordinary picks when editing Skills', () => {
  const klass: ContentEntry = { ...ranger, systems: ['sf2e'] }
  let c: Character = { ...base, systems: ['sf2e'], ancestry: 'Orc', skillPicks: ['Athletics'],
    feats: [{ name: 'Broken Hand Technique', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice: 'Medicine' }] }
  const tree = () => SkillsSection({ c, entries: [klass], save: patch => { c = { ...c, ...patch } } })
  expect(findButtons(tree()).get('Medicine Trained')?.['aria-pressed']).toBe(true)
  ;(findButtons(tree()).get('Medicine Trained')!.onClick as () => void)()
  expect(c.feats[0].choice).toBeUndefined()
  expect(c.skillPicks).toEqual(['Athletics'])
  expect(ranksAt(c, [klass]).Medicine ?? 0).toBe(0)
  expect(skillRankBudget(c, [klass]).trained).toBe(4)
})

it('consolidates multiple Dwarven Lore replacements without losing saved choices', () => {
  const background: ContentEntry = { ...feyBound, name: 'Training', data: { skill: 'Crafting, Religion' } }
  let c: Character = { ...base, ancestry: 'Dwarf', background: 'Training',
    feats: [{ name: 'Dwarven Lore', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', replacements: ['Society', 'Athletics'] }] }
  const entries = [ranger, background]
  const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
  expect(findButtons(tree()).get('Society Trained')?.['aria-pressed']).toBe(true)
  expect(findButtons(tree()).get('Athletics Trained')?.['aria-pressed']).toBe(true)
  ;(findButtons(tree()).get('Thievery Trained')!.onClick as () => void)()
  expect(c.feats[0].replacements).toBeUndefined()
  expect(c.skillPicks).toEqual(['Society', 'Athletics', 'Thievery'])
  expect(skillRankBudget(c, entries).trained).toBe(3)
})

it('preserves saved Lore and warmask replacement training when Skills are edited', () => {
  const background: ContentEntry = { ...feyBound, name: 'Medic', data: { skill: 'Medicine' } }
  let officer: Character = { ...base, background: 'Medic', feats: [
    { name: "Officer's Medical Training", type: 'Class Feat', level: 1, choice: 'Sailing Lore' },
  ] }
  const officerTree = () => SkillsSection({ c: officer, entries: [ranger, background], save: patch => { officer = { ...officer, ...patch } } })
  expect(findButtons(officerTree()).get('Sailing Lore Trained')?.['aria-pressed']).toBe(true)
  ;(findButtons(officerTree()).get('Thievery Trained')!.onClick as () => void)()
  expect(officer.feats[0].choice).toBeUndefined()
  expect(officer.skillPicks).toEqual(['Sailing Lore', 'Thievery'])
  expect(officer.lores).toContainEqual({ name: 'Sailing Lore', rank: 0 })
  expect(ranksAt(officer, [ranger, background])['Sailing Lore']).toBe(1)

  let orc: Character = { ...base, ancestry: 'Orc', skillPicks: ['Religion'], warmask: { alternateSkill: 'Medicine' },
    feats: [{ name: 'Orc Warmask', type: 'Ancestry Feat', level: 1, choice: 'The Gods' }] }
  const warmaskTree = () => SkillsSection({ c: orc, entries: [ranger], save: patch => { orc = { ...orc, ...patch } } })
  ;(findButtons(warmaskTree()).get('Thievery Trained')!.onClick as () => void)()
  expect(orc.feats[0].choice).toBe('The Gods')
  expect(orc.warmask?.alternateSkill).toBeUndefined()
  expect(orc.skillPicks).toEqual(['Religion', 'Medicine', 'Thievery'])
  expect(ranksAt(orc, [ranger]).Medicine).toBe(1)
})

it('keeps replacement training available for stale saved choices', () => {
  const background: ContentEntry = { ...feyBound, name: 'Medic', data: { skill: 'Medicine, Society' } }
  const c: Character = { ...base, background: 'Medic', feats: [
    { name: "Officer's Medical Training", type: 'Class Feat', level: 1, choice: 'Society' },
  ] }
  expect(skillRankBudget(c, [ranger, background]).trained).toBe(5)
})

it("uses regular skill controls for both Officer's Education selections", () => {
  let c: Character = { ...base, level: 12, skillPicks: ['Athletics', 'Society'],
    feats: [
      { name: "Officer's Education", type: 'Class Feat', level: 8, slot: 'class:8:0' },
      { name: "Officer's Education", type: 'Class Feat', level: 8, slot: 'class:12:0' },
    ] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(skillRankBudget(c, [ranger])).toMatchObject({ trained: 6, expert: 4 })
  ;(findButtons(tree()).get('Medicine Trained')!.onClick as () => void)()
  ;(findButtons(tree()).get('Athletics Expert')!.onClick as () => void)()
  ;(findButtons(tree()).get('Society Expert')!.onClick as () => void)()
  expect(c.skillIncreases).toMatchObject({
    'officer-education:class:8:0': 'Athletics', 'officer-education:class:12:0': 'Society',
  })
  expect(ranksAt(c, [ranger])).toMatchObject({ Athletics: 2, Society: 2, Medicine: 1 })
  ;(findButtons(tree()).get('Athletics Expert')!.onClick as () => void)()
  expect(ranksAt(c, [ranger]).Athletics).toBe(1)
  expect(skillRankBudget(c, [ranger]).expert).toBe(3)
})

it("spends Mechanic's Ingenuity increases through the ordinary skill array", () => {
  const mechanic: ContentEntry = { ...ranger, name: 'Mechanic', systems: ['sf2e'],
    data: { skill_proficiency: 'Trained in Computers, Trained in Crafting, Trained in a number of additional skills equal to 2 plus your Intelligence modifier' } }
  let c: Character = { ...base, systems: ['sf2e'], className: 'Mechanic', level: 7, skillPicks: ['Athletics'] }
  const tree = () => SkillsSection({ c, entries: [mechanic], save: patch => { c = { ...c, ...patch } } })
  ;(findButtons(tree()).get('Computers Expert')!.onClick as () => void)()
  ;(findButtons(tree()).get('Computers Master')!.onClick as () => void)()
  ;(findButtons(tree()).get('Athletics Expert')!.onClick as () => void)()
  expect(c.skillIncreases).toMatchObject({ 'mechanic-ingenuity:3': 'Computers', 'mechanic-ingenuity:7': 'Computers', 3: 'Athletics' })
  expect(ranksAt(c, [mechanic])).toMatchObject({ Computers: 3, Crafting: 1, Athletics: 2 })
  expect(ranksAt({ ...c, level: 2 }, [mechanic])).toMatchObject({ Computers: 1, Crafting: 1 })
  expect(ranksAt({ ...c, className: 'Ranger' }, [mechanic]).Computers ?? 0).toBe(0)
  ;(findButtons(tree()).get('Computers Master')!.onClick as () => void)()
  expect(c.skillIncreases?.['mechanic-ingenuity:7']).toBeUndefined()
})

it('adds regular trained and expert selections for longevity feats', () => {
  let c: Character = { ...base, level: 9, ancestry: 'Elf', skillPicks: ['Athletics'],
    feats: [
      { name: 'Ancestral Longevity', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' },
      { name: 'Expert Longevity', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' },
    ] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(skillRankBudget(c, [ranger])).toMatchObject({ trained: 4, expert: 3 })
  expect(renderToStaticMarkup(tree())).not.toContain('Daily T')
  expect(renderToStaticMarkup(tree())).not.toContain('Daily E')
  ;(findButtons(tree()).get('Society Trained')!.onClick as () => void)()
  ;(findButtons(tree()).get('Society Expert')!.onClick as () => void)()
  expect(ranksAt(c, [ranger]).Society).toBe(2)
  expect(c.skillIncreases?.[builder.LONGEVITY_EXPERT_SLOT]).toBe('Society')
  expect(skillRankBudget(c, [ranger])).toMatchObject({ trained: 3, expert: 2 })
  ;(findButtons(tree()).get('Society Expert')!.onClick as () => void)()
  expect(ranksAt(c, [ranger]).Society).toBe(1)
  expect(skillRankBudget(c, [ranger]).expert).toBe(3)
  expect(skillRankBudget({ ...c, level: 4 }, [ranger]).trained).toBe(2)
  expect(skillRankBudget({ ...c, level: 8 }, [ranger]).expert).toBe(2)
})

it('preserves legacy longevity choices and migrates them when editing skills', () => {
  let c: Character = { ...base, level: 9, ancestry: 'Elf', skillPicks: ['Athletics'],
    feats: [
      { name: 'Ancestral Longevity', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: 'Acrobatics' },
      { name: 'Expert Longevity', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0', choice: 'Athletics' },
    ] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(ranksAt(c, [ranger])).toMatchObject({ Acrobatics: 1, Athletics: 2 })
  expect(skillRankBudget(c, [ranger])).toMatchObject({ trained: 3, expert: 2 })
  expect(findButtons(tree()).get('Acrobatics Trained')?.['aria-pressed']).toBe(true)
  expect(findButtons(tree()).get('Athletics Expert')?.['aria-pressed']).toBe(true)
  ;(findButtons(tree()).get('Medicine Trained')!.onClick as () => void)()
  expect(c.feats.map(feat => feat.choice)).toEqual([undefined, undefined])
  expect(c.skillPicks).toEqual(['Athletics', 'Acrobatics', 'Medicine'])
  expect(c.skillIncreases?.[builder.LONGEVITY_EXPERT_SLOT]).toBe('Athletics')
  expect(ranksAt(c, [ranger])).toMatchObject({ Acrobatics: 1, Athletics: 2, Medicine: 1 })
})

it('uses the extra expert selection before later master increases without granting master itself', () => {
  let c: Character = { ...base, level: 9, ancestry: 'Elf', skillPicks: ['Athletics', 'Society', 'Medicine'],
    skillIncreases: { 3: 'Athletics', 5: 'Society', 7: 'Medicine' }, feats: [
      { name: 'Ancestral Longevity', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' },
      { name: 'Expert Longevity', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' },
    ] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(findButtons(tree()).get('Nature Master')?.disabled).toBe(false)
  ;(findButtons(tree()).get('Nature Master')!.onClick as () => void)()
  expect(c.skillIncreases).toMatchObject({ [builder.LONGEVITY_EXPERT_SLOT]: 'Nature', 9: 'Nature' })
  expect(ranksAt(c, [ranger]).Nature).toBe(3)
  expect(ranksAt({ ...c, level: 8 }, [ranger]).Nature).toBe(1)
  expect(skillRankBudget(c, [ranger])).toMatchObject({ expert: 0, master: 0 })
})

it('restores spent training when overlapping grants disappear without removing saved picks', () => {
  const c: Character = { ...base, level: 5, skillPicks: ['Nature', 'Society', 'Survival'] }
  const background: ContentEntry = { ...feyBound, name: 'Scholar', data: { skill: 'Society' } }
  expect(skillRankBudget({ ...c, background: background.name }, [ranger, background]).trained).toBe(3)
  expect(skillRankBudget({ ...c, background: undefined }, [ranger, background]).trained).toBe(2)
  expect(skillRankBudget({ ...c, className: undefined, background: background.name }, [ranger, background]).trained).toBe(0)
  expect(c.skillPicks).toEqual(['Nature', 'Society', 'Survival'])
})

it('shows Toughness contribution next to expanded Defense HP without changing the total', () => {
  const c: Character = { ...base, level: 20, ancestry: 'Human', abilities: { ...base.abilities, con: 20 },
    feats: [{ name: 'Toughness', type: 'General Feat', level: 1, slot: 'general:3:0' }] }
  const entries: ContentEntry[] = [{ ...ranger, data: { ...ranger.data, hp: 10 } },
    { ...ranger, id: 'human', kind: 'ancestry', name: 'Human', data: { hp: 8 } }]
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} part="defense" />)
  expect(markup).toContain('328<small> (+20 Toughness)</small>')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, feats: [] }} entries={entries} save={() => {}} part="defense" />))
    .not.toContain('Toughness')
})

it('shows only the highest resistance for each damage type', () => {
  const fire5: ContentEntry = { ...ranger, id: 'fire5', kind: 'feat', name: 'Fire Guard', data: { resistances: 'fire=5' } }
  const fire10: ContentEntry = { ...fire5, id: 'fire10', name: 'Fire Ward', data: { resistances: 'fire=10' } }
  const c: Character = { ...base, feats: [fire5, fire10].map(entry => ({ name: entry.name, type: 'Ancestry Feat', level: 1 })) }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[fire5, fire10]} save={() => {}} part="defense" />)
  expect(markup).toContain('Fire 10 (Fire Ward)')
  expect(markup).not.toContain('Fire 5 (Fire Guard)')
})

it('keeps Pioneer training fixed, refunds redundant picks, and notes conditional Terrain Expertise on Survival', () => {
  let c: Character = { ...base, systems: ['sf2e'], level: 7, heritage: 'Pioneer Human', pioneerTerrain: 'Forest',
    skillPicks: ['Survival'], activeFeatEffects: ['Terrain Expertise'] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain('Survival <b>+9')
  expect(renderToStaticMarkup(tree())).toContain('+1 circumstance bonus to Survival in Forest terrain')
  expect(renderToStaticMarkup(tree())).not.toContain('Terrain Expertise active')
  expect(findButtons(tree()).get('Survival Trained')?.disabled).toBe(false)
  ;(findButtons(tree()).get('Survival Trained')!.onClick as () => void)()
  expect(c.skillPicks).toEqual([])
  expect(ranksAt(c, [ranger]).Survival).toBe(1)
  expect(findButtons(tree()).get('Survival Trained')?.disabled).toBe(true)
  c = { ...c, activeFeatEffects: [] }
  expect(renderToStaticMarkup(tree())).toContain('Survival <b>+9')
  c = { ...c, pioneerEnvironment: 'Heat' }
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="defense" />)
  expect(defense).toContain('heat environmental effects are one step less extreme')
  expect(defense).toContain('This is not damage resistance')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, heritage: undefined }} entries={[ranger]} save={() => {}} part="defense" />))
    .not.toContain('environmental effects')
})

it('shows Wasteland Survival substitution and only qualifies Master-or-lower hazard requirements at Master', () => {
  const c: Character = { ...base, level: 13, heritage: 'Pioneer Human',
    feats: [{ name: 'Wasteland Warrior', type: 'Ancestry Feat', level: 13, slot: 'ancestry:13:0' }] }
  const render = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={[ranger]} save={() => {}} />)
  expect(render(c)).toContain('using Survival instead of Athletics or Thievery')
  expect(render(c)).toContain('At Master Survival, you qualify')
  expect(render({ ...c, rankOverrides: { Survival: 3 } })).toContain('Master Survival satisfies')
  expect(render({ ...c, rankOverrides: { Survival: 4 } })).toContain('but not Legendary')
  expect(render({ ...c, level: 12 })).not.toContain('Wasteland Warrior')
})

it('applies Clever Improviser only to untrained skills while leaving ranks, trained skills, Perception and saves unchanged', () => {
  const c: Character = { ...base, level: 5, feats: [
    { name: 'Clever Improviser', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' },
  ] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  expect(markup).toContain('Deception <b>+4</b>')
  expect(markup).toContain('Nature <b>+7</b>')
  expect(markup).toContain('your proficiency rank remains untrained')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="defense" />))
    .toContain('Fortitude +9: show breakdown')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="offense" />))
    .toContain('Perception <b>+7</b>')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, level: 4 }} entries={[ranger]} save={() => {}} />))
    .toContain('Deception <b>+0</b>')
})

it.each([
  { source: 'Greenwatch Initiate', skill: 'Survival' },
  { source: 'Greywatch Initiate', skill: 'Deception' },
])('spends later skill increases after $source without using earlier increases', ({ source, skill }) => {
  let c: Character = { ...base, level: 7, skillPicks: [skill],
    feats: [{ name: source, type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(ranksAt(c, [ranger])[skill]).toBe(2)
  expect(renderToStaticMarkup(tree())).not.toContain(source)
  ;(findButtons(tree()).get(`${skill} Master`)!.onClick as () => void)()
  expect(c.skillIncreases).toEqual({ 7: skill })
  expect(ranksAt(c, [ranger])[skill]).toBe(3)
})

it('keeps Ancestral Skills training fixed, refunds redundant picks and spends only later increases', () => {
  const feat: ContentEntry = { ...ranger, id: 'ancestral-skills', systems: ['sf2e'], kind: 'feat',
    name: 'Ancestral Skills', traits: ['Human'], data: {}, description: 'Option(s): Diplomacy, Society' }
  let c: Character = { ...base, systems: ['sf2e'], ancestry: 'Human', level: 5, skillPicks: ['Society'],
    feats: [{ name: feat.name, level: 1, type: 'Ancestry Feat', slot: 'ancestry:5:0' }] }
  const tree = () => SkillsSection({ c, entries: [ranger, feat], save: patch => { c = { ...c, ...patch } } })
  expect(findButtons(tree()).get('Diplomacy Trained')?.disabled).toBe(true)
  expect(findButtons(tree()).get('Diplomacy Expert')?.disabled).toBe(true)
  expect(findButtons(tree()).get('Society Trained')?.disabled).toBe(false)
  ;(findButtons(tree()).get('Society Trained')!.onClick as () => void)()
  expect(c.skillPicks).toEqual([])
  expect(ranksAt(c, [ranger, feat]).Society).toBe(1)
  c = { ...c, level: 7 }
  ;(findButtons(tree()).get('Diplomacy Expert')!.onClick as () => void)()
  expect(c.skillIncreases).toEqual({ 7: 'Diplomacy' })
})

it('keeps Offense terrain synchronized without a redundant feat selector and applies Terrain Master automatically', () => {
  let c: Character = { ...base, level: 11, feats: [
    { name: 'Favored Terrain', type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Plains' },
    { name: 'Terrain Master', type: 'Class Feat', level: 8, slot: 'class:8:0' },
  ] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } }, part: 'offense' })
  const controls = new Map<string, Record<string, unknown>>()
  const walk = (node: ReactNode) => {
    Children.forEach(node, child => {
      if (!isValidElement<Record<string, unknown>>(child)) return
      if (typeof child.type === 'function' && child.type.name === 'FeatEffectToggle') {
        walk((child.type as (props: Record<string, unknown>) => ReactNode)(child.props))
        return
      }
      if (typeof child.props['aria-label'] === 'string') controls.set(child.props['aria-label'], child.props)
      walk(child.props.children as ReactNode)
    })
  }
  walk(tree())
  expect(controls.get('Favored Terrain')!.value).toBe('Plains')
  expect(controls.has('In favored terrain')).toBe(false)
  expect(renderToStaticMarkup(tree())).not.toContain('>Original terrain</option>')
  expect(renderToStaticMarkup(tree())).not.toContain('Terrain Master: choose after')
  ;(controls.get('Favored Terrain')!.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Aquatic' } })
  c = JSON.parse(JSON.stringify(c))
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Favored Terrain (Aquatic)')
  expect(markup).toContain('Swim 25 ft.')
  expect(markup).toContain('ignore non-magical difficult terrain')
  expect(c.feats[0].choice).toBe('Aquatic')
  const featTree = () => FeatChoice({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } }, index: 0 })
  expect(featTree()).toBeNull()
  walk(tree())
  ;(controls.get('Favored Terrain')!.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Plains' } })
  walk(tree())
  expect(controls.get('Favored Terrain')!.value).toBe('Plains')
  expect(c.favoredTerrain).toBeUndefined()
  expect(renderToStaticMarkup(tree())).toContain('35 ft.')
  c = { ...c, favoredTerrain: 'Forest' }
  walk(tree())
  expect(controls.get('Favored Terrain')!.value).toBe('Forest')
  ;(controls.get('Favored Terrain')!.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Desert' } })
  expect(c.feats[0].choice).toBe('Desert')
  expect(c.favoredTerrain).toBeUndefined()
  const beforeMaster = renderToStaticMarkup(<SkillsSection c={{ ...c, level: 7 }} entries={[ranger]} save={() => {}} part="offense" />)
  expect(beforeMaster).not.toContain('aria-label="Favored Terrain"')
  expect(beforeMaster).toContain('aria-label="In favored terrain"')
  expect(beforeMaster).not.toContain('ignore non-magical difficult terrain')
})

it('allocates paid increases after Scrapper grants instead of spending earlier increases and invalidating the variant', () => {
  let c: Character = { ...base, level: 5, skillPicks: ['Crafting'],
    feats: [{ name: 'Technomagical Scrapper', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: 'Occultism to Trained' }] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(findButtons(tree()).get('Occultism Expert')?.disabled).toBe(true)
  c = { ...c, level: 7 }
  expect(findButtons(tree()).get('Occultism Expert')?.disabled).toBe(false)
  ;(findButtons(tree()).get('Occultism Expert')!.onClick as () => void)()
  expect(c.skillIncreases).toEqual({ 7: 'Occultism' })
  expect(ranksAt(c, [ranger])).toMatchObject({ Occultism: 2, Crafting: 2 })
  expect(c.feats[0].choice).toBe('Occultism to Trained')
  c = { ...c, skillIncreases: {} }
  ;(findButtons(tree()).get('Crafting Master')!.onClick as () => void)()
  expect(c.skillIncreases).toEqual({ 7: 'Crafting' })
  expect(ranksAt(c, [ranger]).Crafting).toBe(3)
})

it.each([
  ['Sunweave', 1], ['Greater Sunweave', 2], ['Sunweave (Greater)', 2],
  ['Major Sunweave', 3], ['Sunweave (Major)', 3], ['Moonweave', 0],
])('applies %s to worn-armor Perception, item breakdown, and initiative', (rune, bonus) => {
  const c: Character = { ...base, armors: [{ id: 'armor', name: 'Armor', worn: true, potency: 0, resilient: 1, runes: [rune] }] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="offense" />)
  expect(markup).toContain(`Perception <b>+${3 + bonus}</b>`)
  expect(markup).toContain(`<small>Item</small>+${bonus}`)
  expect(defenseSummary(c, [ranger]).perception).toBe(3 + bonus)
  expect(initiativeBonus(c, [ranger])).toBe(3 + bonus)
  expect(defenseSummary({ ...c, armors: [{ ...c.armors![0], worn: false }] }, [ranger]).perception).toBe(3)
})

it('does not stack multiple Sunweave item bonuses', () => {
  const c: Character = { ...base, armors: [{ id: 'armor', name: 'Armor', worn: true, potency: 0, resilient: 0,
    runes: ['Sunweave', 'Sunweave (Major)', 'Greater Sunweave'] }] }
  expect(defenseSummary(c, [ranger]).perception).toBe(6)
})

it('adds and marks Imitate Fauna status bonus only while the known spell is active', () => {
  const c: Character = { ...base, spells: [{ name: 'Imitate Fauna', rank: 2, cantrip: false }], activeSpells: ['Imitate Fauna'] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  expect(markup).toMatch(/Deception <b>\+4<button[^>]*>\*<\/button><span/)
  expect(markup).toMatch(/role="note">\+4 status bonus when using Impersonate as an animal\. \(Imitate Fauna\)<\/span>/)
  expect(markup).toContain('aria-label="Imitate Fauna note"')
  expect(markup).toContain('popover="auto"')
  for (const patch of [{ activeSpells: [] }, { spells: [] }]) {
    const inactive = renderToStaticMarkup(<SkillsSection c={{ ...c, ...patch }} entries={[ranger]} save={() => {}} />)
    expect(inactive).toContain('Deception <b>+0</b>')
    expect(inactive).not.toContain('Imitate Fauna note')
  }
})

it('marks Shiny Aid bonuses without adding them to ordinary skill totals', () => {
  const c: Character = { ...base, systems: ['sf2e'], feats: [{ name: 'Shiny', type: 'Ancestry Feat', level: 1 }] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  expect(markup).toMatch(/Deception <b>\+0<button[^>]*>\*<\/button><span/)
  expect(markup).toMatch(/Performance <b>\+3<button[^>]*>\*<\/button><span/)
  expect(markup).not.toContain('</button> (Shiny)')
  expect(markup).toMatch(/role="note">\+3 circumstance bonus only when using Aid for this skill\. \(Shiny\)<\/span>/)
  expect(markup.match(/\+3 circumstance bonus only when using Aid for this skill\./g)).toHaveLength(8)
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, feats: [] }} entries={[ranger]} save={() => {}} />))
    .not.toContain('Shiny note')
})

it('shows speed bonus sources but omits redundant Initiative helper', () => {
  const c: Character = { ...base, feats: ['Fleet', 'Primal Nimbleness', 'Incredible Initiative']
    .map((name) => ({ name, type: 'General Feat', level: 1 })) }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="offense" />)
  expect(markup).toContain('35 ft. (+5 Fleet, +5 Primal Nimbleness)')
  expect(markup).not.toContain('Initiative:')
  expect(initiativeBonus(c, [ranger])).toBe(5)
})

it('shows calculated armor specialization with its source and clickable full rules', () => {
  const armor: ContentEntry = {
    ...ranger, id: 'wooden-breastplate', kind: 'armor', name: 'Wooden Breastplate',
    data: { armor_group: 'Wood', armor_category: 'Medium' },
  }
  const group: ContentEntry = {
    ...ranger, id: 'wood', kind: 'armorGroup', name: 'Wood',
    description: 'Wood armor splinters, protecting you from critical hits.', data: {},
  }
  const feat: ContentEntry = {
    ...ranger, id: 'skins', kind: 'feat', name: 'Skins of the Slain',
    data: { grants_armor_specialization: true, grants_armor_groups: 'Wood' },
  }
  const c: Character = {
    ...base,
    feats: [{ name: feat.name, type: 'Class Feat', level: 1 }],
    armors: [{ id: 'armor', name: armor.name, worn: true, potency: 3, resilient: 0, runes: [] }],
  }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger, armor, group, feat]} save={() => {}} part="defense" />)
  expect(markup).toMatch(/Armor Specialization: Wood, 6 Piercing Damage<button[^>]*>\*<\/button> \(Wooden Breastplate via Skins of the Slain feat\)/)
  expect(markup).toContain(group.description)
  expect(markup).toContain('popover="auto"')
})

it('clarifies armor specialization trigger conditions for Plate and Chain', () => {
  const armorSpecFeat: ContentEntry = {
    ...ranger, id: 'armor-spec', kind: 'feat', name: 'Armor Specialization',
    data: { grants_armor_specialization: true },
  }
  const renderSpecialization = (groupName: string, category: string) => {
    const armor: ContentEntry = {
      ...ranger, id: `armor-${groupName}`, kind: 'armor', name: `${groupName} Armor`,
      data: { armor_group: groupName, armor_category: category },
    }
    const group: ContentEntry = {
      ...ranger, id: `group-${groupName}`, kind: 'armorGroup', name: groupName,
      description: `${groupName} specialization rules.`, data: {},
    }
    const c: Character = {
      ...base, feats: [{ name: armorSpecFeat.name, type: 'Class Feat', level: 1 }],
      armors: [{ id: 'armor', name: armor.name, worn: true, potency: 0, resilient: 0, runes: [] }],
    }
    return renderToStaticMarkup(<SkillsSection c={c} entries={[ranger, armor, group, armorSpecFeat]} save={() => {}} part="defense" />)
  }
  expect(renderSpecialization('Plate', 'Heavy')).toContain('Plate resistance applies to all slashing damage, not only critical hits.')
  expect(renderSpecialization('Chain', 'Heavy')).toContain('Chain reduction applies only when you are critically hit.')
})

function findButtons(node: ReactNode) {
  const buttons = new Map<string, Record<string, unknown>>()
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'button') buttons.set(String(child.props['aria-label']), child.props)
    findButtonsInto(child.props.children as ReactNode, buttons)
  })
  return buttons
}

function findButtonsInto(node: ReactNode, buttons: Map<string, Record<string, unknown>>) {
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'button') buttons.set(String(child.props['aria-label']), child.props)
    findButtonsInto(child.props.children as ReactNode, buttons)
  })
}

it.each([[1, 'Trained'], [9, 'Expert'], [17, 'Master']] as const)(
  'assigns and changes Skill Download through the skill array at level %i',
  (level, rank) => {
    const feat: ContentEntry = { ...ranger, id: 'download', kind: 'feat', name: 'Skill Download',
      description: 'During your daily preparations, you become trained in one skill of your choice.' }
    let c: Character = { ...base, level, feats: [{ name: feat.name, type: 'Ancestry Feat', level: 1 }],
      skillPicks: ['Acrobatics', 'Arcana', 'Athletics', 'Crafting'],
      skillIncreases: Object.fromEntries(builder.skillIncreaseLevels({ ...base, level }).map(n => [String(n), 'Nature'])) }
    const entries = [ranger, feat]
    const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
    const before = skillRankBudget(c, entries)
    const click = (label: string) => {
      const button = findButtons(tree()).get(label)!
      expect(button.disabled).toBe(false)
      ;(button.onClick as () => void)()
    }
    click(`Deception ${rank}`)
    expect(builder.skillDownload(c, entries)?.skill).toBe('Deception')
    expect(ranksAt(c, entries).Deception ?? 0).toBe(0)
    expect(skillRankBudget(c, entries)).toEqual(before)
    click(`Diplomacy ${rank}`)
    expect(builder.skillDownload(c, entries)?.skill).toBe('Diplomacy')
    click(`Diplomacy ${rank}`)
    expect(builder.skillDownload(c, entries)).toBeUndefined()
    expect(skillRankBudget(c, entries)).toEqual(before)
  },
)

it('uses Skill Download before permanent selections without spending them', () => {
  const feat: ContentEntry = { ...ranger, id: 'download', kind: 'feat', name: 'Skill Download',
    description: 'During your daily preparations, you become trained in one skill of your choice.' }
  let c: Character = { ...base, feats: [{ name: feat.name, type: 'Ancestry Feat', level: 1 }] }
  const entries = [ranger, feat]
  const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
  expect(skillRankBudget(c, entries).trained).toBe(4)
  ;(findButtons(tree()).get('Acrobatics Trained')!.onClick as () => void)()
  expect(builder.skillDownload(c, entries)?.skill).toBe('Acrobatics')
  expect(skillRankBudget(c, entries).trained).toBe(4)
  ;(findButtons(tree()).get('Athletics Trained')!.onClick as () => void)()
  expect(c.skillPicks).toContain('Athletics')
  expect(skillRankBudget(c, entries).trained).toBe(3)
})

it('gives Subtle Cyborg Deception or an extra skill-array choice when already trained', () => {
  const background: ContentEntry = { ...feyBound, name: 'Deceiver', data: { skill: 'Deception' } }
  const c: Character = { ...base, systems: ['sf2e'], feats: [{ name: 'Subtle Cyborg', type: 'Ancestry Feat', level: 1 }] }
  expect(ranksAt(c, [ranger]).Deception).toBe(1)
  expect(skillRankBudget(c, [ranger]).trained).toBe(4)
  const duplicate = { ...c, background: background.name }
  expect(skillRankBudget(duplicate, [ranger, background]).trained).toBe(5)
  expect(ranksAt({ ...duplicate, skillPicks: ['Diplomacy'] }, [ranger, background]).Diplomacy).toBe(1)
  expect(skillRankBudget({ ...duplicate, skillPicks: ['Diplomacy'] }, [ranger, background]).trained).toBe(4)
})

it('offers one alphabetized Lore list from both sources without already-known Lore', () => {
  const c: Character = { ...base, lores: [{ name: 'sailing Lore', rank: 0 }] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  const list = /<select[^>]*aria-label="Common Lore"[^>]*>([\s\S]*?)<\/select>/.exec(markup)![1]
  const options = [...list.matchAll(/<option value="([^"]+)"/g)].map(match => match[1])
  expect(options).toEqual([...options].sort((a, b) => a.localeCompare(b)))
  expect(new Set(options.map(name => name.toLowerCase())).size).toBe(options.length)
  expect(options).toEqual(expect.arrayContaining([
    'Academia Lore', 'Abadar Lore', 'Astral Plane Lore', 'Outer Rifts Lore', 'Pathfinder Society Lore',
    'Corporate Lore', 'Piracy Lore', 'Necrovite Lore', 'Apostae Lore', 'Heaven Lore',
  ]))
  for (const name of ['Sailing Lore', 'Magic Lore', 'Adventuring Lore', 'Planar Lore']) expect(options).not.toContain(name)
})

it('adds listed or custom Lore, trains it, and removes it using regular skill selections', () => {
  let c: Character = { ...base, level: 5 }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  const findForm = (node: ReactNode): Record<string, unknown> | undefined => {
    let found: Record<string, unknown> | undefined
    Children.forEach(node, child => {
      if (found || !isValidElement<Record<string, unknown>>(child)) return
      found = child.type === 'form' ? child.props : findForm(child.props.children as ReactNode)
    })
    return found
  }
  class Input {
    value = ''
    error = ''
    setCustomValidity(message: string) { this.error = message }
    reportValidity() { return !this.error }
  }
  const input = new Input()
  const form = { elements: { namedItem: () => input }, reset: vi.fn(), closest: () => ({ removeAttribute: vi.fn() }) }
  const confirm = vi.fn(() => true)
  vi.stubGlobal('HTMLInputElement', Input)
  vi.stubGlobal('window', { confirm })
  const submit = (value: string) => {
    input.value = value
    input.error = ''
    ;(findForm(tree())!.onSubmit as (event: unknown) => void)({ preventDefault: () => {}, currentTarget: form })
  }
  try {
    expect(renderToStaticMarkup(tree())).toContain('aria-label="Add Lore skill"')
    submit('  sailing  ')
    expect(c.lores).toEqual([{ name: 'sailing Lore', rank: 0 }])
    expect(skillRankBudget(c, [ranger]).trained).toBe(4)
    expect(renderToStaticMarkup(tree())).toContain('sailing Lore')
    submit('SAILING LORE')
    expect(input.error).toBe('This Lore skill already exists.')
    expect(c.lores).toHaveLength(1)
    submit(' ')
    expect(input.error).toBe('Enter a Lore specialty.')
    ;(findButtons(tree()).get('sailing Lore Trained')!.onClick as () => void)()
    expect(ranksAt(c, [ranger])['sailing Lore']).toBe(1)
    expect(skillRankBudget(c, [ranger]).trained).toBe(3)
    ;(findButtons(tree()).get('sailing Lore Expert')!.onClick as () => void)()
    confirm.mockReturnValueOnce(false)
    ;(findButtons(tree()).get('Remove sailing Lore')!.onClick as () => void)()
    expect(c.lores).toHaveLength(1)
    ;(findButtons(tree()).get('Remove sailing Lore')!.onClick as () => void)()
    expect(c.lores).toEqual([])
    expect(c.skillPicks).toEqual([])
    expect(c.skillIncreases).toEqual({})
    expect(skillRankBudget(c, [ranger]).trained).toBe(4)
    for (const name of ['Academia Lore', 'Corporate Lore']) {
      ;(findSelect(tree(), 'Common Lore')!.onChange as (event: unknown) => void)({
        currentTarget: { value: name, form },
      })
      expect(input.value).toBe(name)
      expect(c.lores).not.toContainEqual({ name, rank: 0 })
      submit(input.value)
      expect(c.lores).toContainEqual({ name, rank: 0 })
      expect(ranksAt(c, [ranger])[name]).toBe(0)
    }
  } finally {
    vi.unstubAllGlobals()
  }
})

it('does not auto-scale custom Lore before it is trained', () => {
  const c: Character = { ...base, level: 7, lores: [{ name: 'Sailing Lore', rank: 0 }] }
  updateSettings({ autoLores: true })
  try {
    expect(ranksAt(c, [ranger])['Sailing Lore']).toBe(0)
    expect(ranksAt({ ...c, skillPicks: ['Sailing Lore'] }, [ranger])['Sailing Lore']).toBe(3)
  } finally {
    updateSettings({ autoLores: false })
  }
})

it('uses skill circles for class picks and shows remaining rank budgets', () => {
  let c: Character = { ...base, level: 5, skillIncreases: { 3: 'Nature' } }
  const entries = [ranger]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
  const markup = renderToStaticMarkup(<SkillsSection {...props()} />)
  expect(markup).not.toContain('Class Skills')
  expect(markup).toContain('<b>T</b>4')
  expect(markup).toContain('<b>E</b>1')

  const buttons = findButtons(SkillsSection(props()))
  const society = buttons.get('Society Trained')
  if (!society) throw new Error('Missing Society trained control')
  ;(society.onClick as () => void)()
  expect(c.skillPicks).toEqual(['Society'])
  expect(renderToStaticMarkup(<SkillsSection {...props()} />)).toContain('<b>T</b>3')
})

it('locks class/background grants and derives defense proficiency without overrides', () => {
  let c: Character = {
    ...base, level: 3, background: 'Fey Bound', skillPicks: ['Society'],
    rankOverrides: { Nature: 0, 'Fey Lore': 0, Perception: 0, Fortitude: 0, Reflex: 4 },
  }
  const entries = [ranger, feyBound]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
  const buttons = findButtons(SkillsSection(props()))
  expect(ranksAt(c, entries)).toMatchObject({ Nature: 1, 'Fey Lore': 1, Perception: 1, Fortitude: 2, Reflex: 1 })

  for (const name of ['Nature', 'Fey Lore']) {
    const trained = buttons.get(`${name} Trained`)
    if (!trained) throw new Error(`Missing ${name} trained control`)
    expect(trained.disabled).toBe(true)
    ;(trained.onClick as () => void)()
  }
  for (const [part, names] of [['offense', ['Perception']], ['defense', ['Fortitude', 'Reflex']]] as const) {
    const partButtons = findButtons(SkillsSection({ ...props(), part }))
    for (const name of names) expect(partButtons.get(`${name} Expert`)?.disabled).toBe(true)
  }
  expect(c.skillPicks).toEqual(['Society'])

  const natureExpert = buttons.get('Nature Expert')
  if (!natureExpert) throw new Error('Missing Nature expert control')
  ;(natureExpert.onClick as () => void)()
  expect(ranksAt(c, entries).Nature).toBe(2)
  expect(c.skillIncreases).toEqual({ 3: 'Nature' })

  c = { ...c, level: 7 }
  const masterButtons = findButtons(SkillsSection(props()))
  const natureMaster = masterButtons.get('Nature Master')
  if (!natureMaster) throw new Error('Missing Nature master control')
  expect(natureMaster.disabled).toBe(false)
  ;(natureMaster.onClick as () => void)()
  expect(ranksAt(c, entries).Nature).toBe(3)
  expect(c.skillIncreases).toEqual({ 3: 'Nature', 7: 'Nature' })
})

it('sorts all skills with Lore and allows trained and Lore rank increases', () => {
  let c: Character = { ...base, level: 8, background: 'Fey Bound', skillPicks: ['Society'] }
  const entries = [ranger, feyBound]
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
  const markup = renderToStaticMarkup(<SkillsSection {...props()} />)
  expect(markup.indexOf('Diplomacy')).toBeLessThan(markup.indexOf('Fey Lore'))
  expect(markup.indexOf('Fey Lore')).toBeLessThan(markup.indexOf('Intimidation'))
  expect(markup).not.toContain('Perception')
  expect(markup).not.toContain('Fortitude')
  const offense = renderToStaticMarkup(<SkillsSection {...props()} part="offense" />)
  expect(offense).toContain('Perception')
  const defense = renderToStaticMarkup(<SkillsSection {...props()} part="defense" />)
  expect(defense.indexOf('Fortitude')).toBeLessThan(defense.indexOf('Reflex'))
  expect(defense.indexOf('Reflex')).toBeLessThan(defense.indexOf('Will'))

  const buttons = findButtons(SkillsSection(props()))
  const acrobatics = buttons.get('Acrobatics Trained')
  const loreExpert = buttons.get('Fey Lore Expert')
  if (!acrobatics || !loreExpert) throw new Error('Missing skill proficiency controls')
  expect(acrobatics.disabled).toBe(false)
  expect(loreExpert.disabled).toBe(false)
  ;(acrobatics.onClick as () => void)()
  ;(loreExpert.onClick as () => void)()
  expect(c.skillPicks).toEqual(['Society', 'Acrobatics'])
  expect(c.skillIncreases).toEqual({ 3: 'Fey Lore' })
  expect(ranksAt(c, entries)['Fey Lore']).toBe(2)
})

it('raises save and Perception ranks from class feature text and summarizes defenses', () => {
  const feature = (name: string, level: number, description: string): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'classFeature', source: 'official', name, level, traits: [],
    description, data: { class: 'Ranger' }, effects: [], updatedAt: 0,
  })
  const entries = [
    ranger,
    feature('Iron Will', 3, 'Your proficiency rank for Will saves increases to expert.'),
    feature('Evasion', 7, 'Your proficiency rank for Reflex saves increases to master.'),
    feature('Juggernaut', 11, 'Your proficiency rank for Fortitude saves increases to master.'),
    feature('Greater Natural Reflexes', 15, 'Your proficiency rank for Reflex saves increases to legendary.'),
    feature('Ranger Expertise', 9, 'Your proficiency rank for your ranger class DC increases to expert.'),
  ]
  const c: Character = { ...base, level: 20 }
  expect(ranksAt(c, entries)).toMatchObject({ Fortitude: 3, Reflex: 4, Will: 2 })
  expect(defenseSummary(c, entries)).toMatchObject({ fortitude: 26, reflex: 28, will: 24 })
})

it('shows weapon proficiency in Offense and armor proficiency in Equipment', () => {
  const klass: ContentEntry = {
    ...ranger,
    data: {
      ...ranger.data,
      attack_proficiency: 'Trained in simple weapons, Trained in martial weapons, Trained in unarmed attacks',
      defense_proficiency: 'Trained in light armor, Trained in medium armor, Trained in unarmored defense',
    },
  }
  const upgrades = (name: string, level: number, description: string): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'classFeature', source: 'official', name, level, traits: [],
    description, data: { class: 'Ranger' }, effects: [], updatedAt: 0,
  })
  const entries = [
    klass,
    upgrades('Weapon Mastery', 13, 'Your proficiency ranks for simple and martial weapons and unarmed attacks increase to master.'),
    upgrades('Medium Armor Expertise', 11, 'Your proficiency ranks for light armor, medium armor, and unarmored defense increase to expert.'),
  ]
  const c: Character = { ...base, level: 13 }
  expect(weaponRanks(c, entries)).toEqual({ Simple: 3, Martial: 3, Advanced: 0, Unarmed: 3 })
  expect(armorRanks(c, entries)).toEqual({ Light: 2, Medium: 2, Heavy: 0, Unarmored: 2 })
  const props = { c, entries, save: () => {} }
  const offense = renderToStaticMarkup(<SkillsSection {...props} part="offense" />)
  expect(offense).not.toContain('Initiative bonus')
  expect(offense).toContain('class="prof-badges"')
  expect(renderToStaticMarkup(<SkillsSection {...props} part="defense" />)).not.toContain('class="prof-badges"')
  expect(renderToStaticMarkup(<ArmorProficiency c={c} entries={entries} />)).toContain('Unarmored')
})
