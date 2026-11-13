import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { SkillsSection } from './SkillsSection'
import { FeatChoice } from './FeatChoice'
import { armorRanks, defenseSummary, initiativeBonus, ranksAt, skillRankBudget, weaponRanks } from './builder'
import * as builder from './builder'
import type { Character, ContentEntry } from './types'

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

it('spends later skill increases after Greenwatch training without upgrading Survival from an earlier increase', () => {
  let c: Character = { ...base, level: 7, skillPicks: ['Survival'],
    feats: [{ name: 'Greenwatch Initiate', type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(ranksAt(c, [ranger]).Survival).toBe(2)
  ;(findButtons(tree()).get('Survival Master')!.onClick as () => void)()
  expect(c.skillIncreases).toEqual({ 7: 'Survival' })
  expect(ranksAt(c, [ranger]).Survival).toBe(3)
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

it('shows weapon and armor proficiency badges from class text and features', () => {
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
  expect(renderToStaticMarkup(<SkillsSection {...props} part="offense" />)).not.toContain('Initiative bonus')
  expect(renderToStaticMarkup(<SkillsSection {...props} part="defense" />)).toContain('Unarmored')
})
