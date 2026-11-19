import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { ArmorProficiency, RageToggle, SensesAndSpeed, SkillsSection, SkillsSummary } from './SkillsSection'
import { FeatChoice } from './FeatChoice'
import { armorRanks, defenseSummary, initiativeBonus, ranksAt, skillRankBudget, weaponRanks } from './builder'
import * as builder from './builder'
import type { Character, ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'
import { KILLERS_BELT_MAJOR } from './supplemental'
import { INITIATE_TRAINING } from './featChoices'

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

it('assigns and refunds Erudite Lore through shared skill buttons without spending training', () => {
  let c: Character = { ...base, systems: ['sf2e'], className: 'Soldier', subclass: 'Erudite Warrior (Society)',
    lores: [{ name: 'Military Lore', rank: 0 }] }
  const tree = () => SkillsSection({ c, entries: [], save: patch => { c = { ...c, ...patch } } })
  const remaining = skillRankBudget(c, []).trained
  expect(renderToStaticMarkup(SkillsSummary({ c, entries: [] }))).toContain('0/1 Trained')
  expect(findButtons(tree()).get('Military Lore Trained')?.disabled).toBe(false)
  ;(findButtons(tree()).get('Military Lore Trained')!.onClick as () => void)()
  expect(c.subclassSkillChoices?.['Soldier:Erudite Warrior:lore']).toBe('Military Lore')
  expect(renderToStaticMarkup(SkillsSummary({ c, entries: [] }))).toContain('1/1 Trained')
  expect(skillRankBudget(c, []).trained).toBe(remaining)
  ;(findButtons(tree()).get('Military Lore Trained')!.onClick as () => void)()
  expect(c.subclassSkillChoices?.['Soldier:Erudite Warrior:lore']).toBe('')
  expect(ranksAt(c, [])['Military Lore']).toBe(0)
})

it('shows Reptile Rider’s conditional Nature bonus and granted Ride feat', () => {
  const c: Character = { ...base, ancestry: 'Lizardfolk',
    feats: [{ name: 'Reptile Rider', type: 'Ancestry Feat', level: 1 }] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  expect(markup).toContain('+4 to Handle an Animal that is a reptile, dinosaur, or similar (+1 circumstance).')
  expect(builder.automaticFeatGrants(c, [ranger])).toContainEqual(
    expect.objectContaining({ name: 'Ride', source: 'Reptile Rider' }))
})

it('uses shared skill buttons for a restricted divine skill without spending unrestricted training', () => {
  const disciple: ContentEntry = { ...feyBound, name: 'Disciple (Zon-Shelyn)', data: {
    skill: 'Zon-Shelyn Lore', background_skill_options: 'Crafting, Intimidation',
  } }
  let c: Character = { ...base, background: disciple.name, skillPicks: ['Athletics', 'Society', 'Survival', 'Medicine'] }
  const entries = [ranger, disciple]
  const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
  const click = (name: string) => {
    const button = findButtons(tree()).get(`${name} Trained`)!
    expect(button.disabled).toBeFalsy()
    ;(button.onClick as () => void)()
  }
  expect(skillRankBudget(c, entries).trained).toBe(0)
  expect(findButtons(tree()).get('Thievery Trained')?.disabled).toBeTruthy()
  expect(renderToStaticMarkup(SkillsSummary({ c, entries }))).toContain('4/5 Trained')
  click('Intimidation')
  expect(c.backgroundSkillChoices).toEqual({ [disciple.name]: 'Intimidation' })
  expect(ranksAt(c, entries).Intimidation).toBe(1)
  expect(ranksAt(c, entries).Crafting ?? 0).toBe(0)
  expect(skillRankBudget(c, entries).trained).toBe(0)
  expect(renderToStaticMarkup(SkillsSummary({ c, entries }))).toContain('5/5 Trained')
  click('Intimidation')
  click('Crafting')
  expect(ranksAt(c, entries).Crafting).toBe(1)
  expect(ranksAt(c, entries).Intimidation ?? 0).toBe(0)
  expect(c.skillPicks).toEqual(['Athletics', 'Society', 'Survival', 'Medicine'])
})

it('refunds duplicated class training when choosing a divine skill already trained by class', () => {
  const disciple: ContentEntry = { ...feyBound, name: 'Disciple (Example)', data: {
    background_skill_options: 'Nature, Crafting',
  } }
  let c = { ...base, background: disciple.name }
  const entries = [ranger, disciple]
  const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
  const choose = () => {
    const button = findButtons(tree()).get('Nature Trained')!
    expect(button.disabled).toBeFalsy()
    ;(button.onClick as () => void)()
  }
  choose()
  expect(skillRankBudget(c, entries).trained).toBe(5)
  choose()
  expect(skillRankBudget(c, entries).trained).toBe(4)
  expect(ranksAt(c, entries).Nature).toBe(1)
})

it('grants a replacement skill and chosen terrain Lore for Scout', () => {
  const klass: ContentEntry = { ...ranger, data: { ...ranger.data,
    skill_proficiency: 'Trained in Nature, Trained in Survival, Trained in a number of additional skills equal to 4 plus your Intelligence modifier' } }
  const scout: ContentEntry = { ...feyBound, name: 'Scout', data: {
    skill: 'Survival, Lore related to one terrain you scouted in (such as Forest Lore or Cavern Lore).',
  } }
  let c: Character = { ...base, background: 'Scout', skillPicks: [] }
  const entries = [klass, scout]
  const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
  expect(skillRankBudget(c, entries).trained).toBe(5)
  expect(skillRankBudget({ ...c, background: undefined }, entries).trained).toBe(4)
  expect(ranksAt(c, entries).Survival).toBe(1)
  const html = renderToStaticMarkup(tree())
  const commonLore = html.match(/<select aria-label="Common Lore"[\s\S]*?<\/select>/)?.[0] ?? ''
  for (const terrain of builder.FAVORED_TERRAINS) {
    expect(html).toContain(`>${terrain} Lore</option>`)
    expect(commonLore).toContain(`>${terrain} Lore</option>`)
  }
  expect(html).not.toContain('aria-label="Scout terrain Lore"')
  const variants = builder.backgroundVariants([scout])
  expect(variants.map(option => option.value)).toEqual(builder.FAVORED_TERRAINS.map(terrain => `Scout (${terrain} Lore)`))
  const selected = variants.find(option => option.value === 'Scout (Forest Lore)')!
  c = { ...c, background: selected.background.name, backgroundTerrainLore: { Scout: selected.terrain! } }
  expect(c.backgroundTerrainLore).toEqual({ Scout: 'Forest' })
  expect(ranksAt(c, entries)['Forest Lore']).toBe(1)
  expect(skillRankBudget(c, entries).trained).toBe(5)
  const restored = JSON.parse(JSON.stringify(c)) as Character
  expect(ranksAt(restored, entries)['Forest Lore']).toBe(1)
  expect(ranksAt({ ...restored, background: undefined }, entries)['Forest Lore']).toBeUndefined()
  expect(renderToStaticMarkup(tree())).toContain('Forest Lore')
})

it('offers clan trades in the general Lore picker in alphabetical order', () => {
  const html = renderToStaticMarkup(<SkillsSection c={base} entries={[ranger]} save={() => {}} />)
  const picker = html.match(/<select aria-label="Common Lore"[\s\S]*?<\/select>/)?.[0] ?? ''
  for (const lore of [...builder.CLAN_LORES, 'Brewing Lore', 'Distilling Lore', 'Traps Lore', 'Locks Lore',
    'Runes Lore', 'Highhelm Lore', 'Mortuary Lore', 'Metallurgy Lore', 'Water Filtration Lore',
    'Aquaculture Lore', 'Lumber Lore', 'Ranching Lore']) {
    expect(picker).toContain(`>${lore}</option>`)
  }
  const labels = [...picker.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(match => match[1]).slice(1)
  expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
})

it('includes current and other characters deity Lore in shared choices without duplicates or already trained Lore', () => {
  const c: Character = { ...base, deity: 'Sarenrae' }
  const choices = (character: Character) => {
    const markup = renderToStaticMarkup(<SkillsSection c={character} entries={[ranger]} save={() => {}}
      deityLores={['Zon-Shelyn Lore', 'sarenrae Lore', 'Abadar Lore']} />)
    const picker = markup.match(/<select aria-label="Common Lore"[\s\S]*?<\/select>/)?.[0] ?? ''
    return [...picker.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(match => match[1]).slice(1)
  }
  const options = choices(c)
  expect(options).toContain('Zon-Shelyn Lore')
  expect(options.filter(name => name.toLowerCase() === 'sarenrae lore')).toHaveLength(0)
  expect(options.filter(name => name === 'Abadar Lore')).toHaveLength(1)
  expect(options).toEqual([...options].sort((a, b) => a.localeCompare(b)))
  expect(choices({ ...c, lores: [{ name: 'Zon-Shelyn Lore', rank: 1 }] })).not.toContain('Zon-Shelyn Lore')
})

it('shows chosen terrain Lore without a separate selector and leaves fixed Lore unchanged', () => {
  const nomad = { ...feyBound, name: 'Nomad',
    data: { skill: 'Survival, Lore related to one terrain you traveled in (such as Desert Lore or Swamp Lore).' } }
  const fixed = { ...feyBound, name: 'Surge Investigator', data: { skill: 'Nature, Occultism, Magical Terrain Lore' } }
  const nomadHtml = renderToStaticMarkup(<SkillsSection c={{ ...base, background: nomad.name,
    backgroundTerrainLore: { Nomad: 'Forest' } }} entries={[ranger, nomad]} save={() => {}} />)
  expect(nomadHtml).not.toContain('aria-label="Nomad terrain Lore"')
  expect(nomadHtml).toContain('Forest Lore')
  const fixedHtml = renderToStaticMarkup(<SkillsSection c={{ ...base, background: fixed.name }} entries={[ranger, fixed]} save={() => {}} />)
  expect(fixedHtml).not.toContain('terrain Lore"')
  expect(ranksAt({ ...base, background: fixed.name }, [ranger, fixed])['Magical Terrain Lore']).toBe(1)
})

it('shows conditional stonework Perception total without a toggle or changing ordinary Perception', () => {
  const c: Character = { ...base, feats: [{ name: "Stonemason's Eye", type: 'Ancestry Feat', level: 1 }],
    activeFeatEffects: ["Stonemason's Eye"] }
  const plain = { ...c, feats: [], activeFeatEffects: [] }
  const total = defenseSummary(plain, [ranger]).perception
  const html = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="senses" />)
  expect(html).not.toContain('Stonework Perception active')
  expect(html).toContain(`${builder.signed(total + 2)} to notice unusual stonework and stonework traps`)
  expect(defenseSummary(c, [ranger]).perception).toBe(total)
  expect(initiativeBonus(c, [ranger])).toBe(initiativeBonus(plain, [ranger]))
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, feats: [{ ...c.feats[0], level: 2 }] }}
    entries={[ranger]} save={() => {}} part="senses" />)).not.toContain('to notice unusual stonework')
  const stacked = { ...c, feats: [...c.feats, { name: 'Superior Sight', type: 'Ancestry Feat', level: 1 }] }
  const stackedHtml = renderToStaticMarkup(<SkillsSection c={stacked} entries={[ranger]} save={() => {}} part="senses" />)
  expect(stackedHtml).toContain(`${builder.signed(total + 2)} to notice unusual stonework and stonework traps`)
})

it.each([false, true])('shows Eye for Treasure as a conditional Crafting total despite saved active state %s', active => {
  const c: Character = { ...base, abilities: { ...base.abilities, int: 14 },
    feats: [{ name: 'Eye for Treasure', type: 'Ancestry Feat', level: 1 }],
    activeFeatEffects: active ? ['Eye for Treasure'] : [] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  expect(markup).toContain('Crafting <b>+5<button')
  expect(markup).toContain('aria-label="Eye for Treasure note"')
  expect(markup).toContain('+6 to Recall Knowledge using Crafting (+1 circumstance; circumstance bonuses do not stack).')
  expect(markup).not.toContain('<small>Circumstance</small>+1')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="offense" />))
    .not.toContain('Crafting Recall Knowledge active')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, feats: [{ ...c.feats[0], level: 2 }] }}
    entries={[ranger]} save={() => {}} />)).not.toContain('aria-label="Eye for Treasure note"')
})

it('shows Hellknight Preferment at the Intimidation total instead of a separate circumstance column', () => {
  const plate: ContentEntry = { ...ranger, id: 'hellknight', kind: 'armor', name: 'Hellknight Plate',
    data: { armor_category: 'Heavy', armor_group: 'Plate' } }
  const c: Character = { ...base, level: 7, feats: [{ name: 'Hellknight Preferment', type: 'Archetype Feat', level: 6 }],
    armors: [{ id: 'armor', name: plate.name, worn: true, potency: 0, resilient: 0, runes: [] }] }
  const render = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={[ranger, plate]} save={() => {}} />)
  const markup = render(c)
  expect(markup).toContain('Intimidation <b>+12<button')
  expect(markup).toContain('aria-label="Hellknight Preferment note"')
  expect(markup).toContain('+1 circumstance bonus to Intimidation while wearing Hellknight armor.')
  expect(markup).not.toContain('<small>Circumstance</small>+1')
  const notWorn = render({ ...c, armors: [{ ...c.armors![0], worn: false }] })
  expect(notWorn).toContain('Intimidation <b>+11')
  expect(notWorn).not.toContain('aria-label="Hellknight Preferment note"')
})

it('summarizes used/total skill allocations, including exchanged tokens and temporary Skill Download', () => {
  const klass = { ...ranger, data: { ...ranger.data,
    skill_proficiency: 'Trained in Nature, Trained in a number of additional skills equal to 5 plus your Intelligence modifier' } }
  let c: Character = { ...base, level: 5, skillPicks: ['Athletics', 'Acrobatics', 'Crafting'], skillIncreases: { 3: 'Athletics' } }
  const render = () => renderToStaticMarkup(<SkillsSummary c={c} entries={[klass]} />)
  expect(render()).toContain('3/5 Trained, 1/2 Expert, 0/0 Master, 0/0 Legendary')
  const previous = getSettings().skillTokenConversion
  try {
    updateSettings({ skillTokenConversion: true })
    c = { ...c, skillTokenUpgrades: builder.skillTokenPurchase(c, [klass], 'Acrobatics', 2, true) }
    expect(c.skillTokenUpgrades).toHaveLength(1)
    expect(render()).toContain('5/5 Trained, 1/2 Expert')
    updateSettings({ skillTokenConversion: false })
    expect(render()).toContain('3/5 Trained, 1/2 Expert')
  } finally { updateSettings({ skillTokenConversion: previous }) }
  c = { ...c, skillTokenUpgrades: undefined, feats: [{ name: 'Skill Download', type: 'Ancestry Feat', level: 1 }] }
  expect(render()).toContain('3/6 Trained')
  c = { ...c, feats: [{ ...c.feats[0], choice: 'Deception' }] }
  expect(render()).toContain('4/6 Trained')
})

it('shows Blast Resistance save upgrades alongside fire and sonic resistance only after acquisition', () => {
  const c: Character = { ...base, level: 5, feats: [{ name: 'Blast Resistance', type: 'Ancestry Feat', level: 5 }] }
  const note = 'Against an effect that causes dazzled or deafened, a successful saving throw becomes a critical success.'
  const html = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="defense" />)
  expect(html.match(/aria-label="Blast Resistance note"/g)).toHaveLength(5)
  expect(html).toContain(note)
  expect(builder.resistances(c, [ranger])).toEqual([
    { damage: 'Fire', value: 3, source: 'Blast Resistance' },
    { damage: 'Sonic', value: 3, source: 'Blast Resistance' },
  ])
  for (const inactive of [{ ...c, level: 4 }, { ...c, feats: [] }]) {
    expect(builder.resistances(inactive, [ranger])).toEqual([])
    expect(renderToStaticMarkup(<SkillsSection c={inactive} entries={[ranger]} save={() => {}} part="defense" />))
      .not.toContain(note)
  }
})

it.each([undefined, 'Darkvision'])('always shows Senses, including when ancestry vision is %s', vision => {
  const ancestry: ContentEntry = { ...ranger, id: 'ancestry', kind: 'ancestry', name: 'Test ancestry', data: vision ? { vision } : {} }
  const html = renderToStaticMarkup(<SensesAndSpeed c={{ ...base, ancestry: ancestry.name }} entries={[ancestry]}
    save={() => {}} />)
  expect(html).toContain(vision ? 'Senses: <span>Darkvision<button' : 'Senses: No special senses')
  if (vision) {
    expect(html).toContain('aria-label="Test ancestry note"')
    expect(html).not.toContain('No special senses')
  }
})

it('shows situational ancestry effects only while their feats are active without changing ordinary defenses', () => {
  const feats = [
    { name: 'Scar-Thick Skin', type: 'Ancestry Feat', level: 5 },
    { name: 'Athletic Might', type: 'Ancestry Feat', level: 5 },
    { name: 'Haughty Obstinacy', type: 'Ancestry Feat', level: 1 },
    { name: 'Sense Allies', type: 'Ancestry Feat', level: 5 },
    { name: 'Stubborn Persistence', type: 'Ancestry Feat', level: 13 },
  ]
  const c: Character = { ...base, level: 13, feats }
  const before = JSON.stringify(c)
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="defense" />)
  const skills = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  const senses = renderToStaticMarkup(<SensesAndSpeed c={c} entries={[ranger]} save={() => {}} />)
  expect(defense).toContain('DC 10, or DC 5 with especially appropriate assistance')
  expect(defense).toContain('DC 17 flat check')
  expect(defense).toContain('mental effects that directly control your actions')
  expect(skills).toContain('check to Climb or Swim, a success becomes a critical success')
  expect(skills).toContain('failure to Coerce you becomes a critical failure')
  expect(senses).toContain('DC 5 flat check to target a hidden willing ally within 60 feet')
  expect(defenseSummary(c, [ranger])).toEqual(defenseSummary({ ...c, feats: [] }, [ranger]))
  expect(JSON.stringify(c)).toBe(before)
  const disabled = { ...c, level: 4 }
  expect(renderToStaticMarkup(<SkillsSection c={disabled} entries={[ranger]} save={() => {}} part="defense" />))
    .not.toContain('Scar-Thick Skin note')
  expect(renderToStaticMarkup(<SkillsSection c={disabled} entries={[ranger]} save={() => {}} />))
    .not.toContain('Athletic Might note')
  expect(renderToStaticMarkup(<SensesAndSpeed c={disabled} entries={[ranger]} save={() => {}} />))
    .not.toContain('Sense Allies note')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, feats: [] }} entries={[ranger]} save={() => {}} part="defense" />))
    .not.toContain('Stubborn Persistence note')
})

it("shows Cavalier's Banner's conditional Will save and DC without changing ordinary defenses", () => {
  const c: Character = { ...base, level: 4, feats: [{ name: "Cavalier's Banner", type: 'Archetype Feat', level: 4 }] }
  const html = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="defense" />)
  expect(html).toContain("Cavalier&#x27;s Banner note")
  expect(html).toContain('DC 17 against fear while within 30 feet')
  expect(html).toContain('applies to allies too')
  expect(defenseSummary(c, [ranger])).toEqual(defenseSummary({ ...c, feats: [] }, [ranger]))
  const future = renderToStaticMarkup(<SkillsSection c={{ ...c, level: 3 }} entries={[ranger]} save={() => {}} part="defense" />)
  expect(future).not.toContain("Cavalier&#x27;s Banner note")
})

it('saves Rage state through the shared toggle and isolates summary clicks', () => {
  let c: Character = { ...base, className: 'Barbarian' }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  for (const checked of [true, false]) {
    const toggle = RageToggle({ c, save })!
    const input = Children.toArray(toggle.props.children).find(child => isValidElement(child) && child.type === 'input')
    if (!isValidElement<{ onChange: (event: { target: { checked: boolean } }) => void }>(input)) throw new Error('Missing Rage input')
    input.props.onChange({ target: { checked } })
    expect(c.raging).toBe(checked)
    expect(renderToStaticMarkup(<RageToggle c={c} save={save} summary />).includes('checked=""')).toBe(checked)
  }
  const stopPropagation = vi.fn()
  RageToggle({ c, save, summary: true })!.props.onClick({ stopPropagation })
  expect(stopPropagation).toHaveBeenCalledOnce()
})

it.each<{ level: number; current: number; target: number; rank: string; increases: Record<string, string>; payment: string[] }>([
  { level: 3, current: 1, target: 2, rank: 'Expert', increases: { 3: 'Nature' }, payment: ['trained:0', 'trained:1'] },
  { level: 7, current: 2, target: 3, rank: 'Master', increases: { 7: 'Nature' }, payment: ['3', '5'] },
  { level: 15, current: 3, target: 4, rank: 'Legendary',
    increases: { 3: 'Nature', 5: 'Acrobatics', 11: 'Nature', 13: 'Acrobatics', 15: 'Nature' }, payment: ['7', '9'] },
])('automatically combines tokens when clicking $rank without a separate conversion form', ({ level, current, target, rank, increases, payment }) => {
  let c: Character = { ...base, level, rankOverrides: { Athletics: current }, skillPicks: ['Athletics', 'Acrobatics'],
    skillIncreases: increases }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  const button = findButtons(tree()).get(`Athletics ${rank}`)!
  expect(button.disabled).toBeFalsy()
  ;(button.onClick as () => void)()
  expect(ranksAt(c, [ranger]).Athletics).toBe(target)
  expect(c.skillTokenUpgrades?.at(-1)?.payment).toEqual(payment)
  expect(c.skillIncreases).toEqual(increases)
  expect(c.skillPicks).toEqual(['Athletics', 'Acrobatics'])
  const html = renderToStaticMarkup(tree())
  expect(html).not.toContain('Skill token rules')
  expect(html).not.toContain('Two unused Trained choices')
  expect(html).not.toContain('Converted skill upgrades')
  expect(html).not.toContain('Convert and upgrade')
  expect(html).not.toContain('Skill token upgrade"')
})

it('converts training recursively at 2:1, persists purchases and refunds them without removing original ranks', () => {
  const klass = { ...ranger, data: { ...ranger.data,
    skill_proficiency: 'Trained in Nature, Trained in a number of additional skills equal to 20 plus your Intelligence modifier' } }
  const entries = [klass]
  let c: Character = { ...base, level: 15, skillPicks: ['Athletics', 'Acrobatics', 'Stealth', 'Deception'],
    skillIncreases: { 3: 'Nature', 5: 'Acrobatics', 7: 'Nature', 9: 'Acrobatics', 11: 'Stealth', 13: 'Deception', 15: 'Nature' } }
  const before = JSON.stringify(c)
  const available = skillRankBudget(c, entries).trained
  for (const [rank, spent] of [[2, 2], [3, 6], [4, 14]]) {
    const purchases = builder.skillTokenPurchase(c, entries, 'Athletics', rank, true)
    expect(purchases).toBeDefined()
    c = JSON.parse(JSON.stringify({ ...c, skillTokenUpgrades: purchases }))
    expect(ranksAt(c, entries).Athletics).toBe(rank)
    expect(skillRankBudget(c, entries).trained).toBe(available - spent)
  }
  expect(c.skillIncreases).toEqual(JSON.parse(before).skillIncreases)
  expect(ranksAt(c, entries, 15).Athletics).toBe(1)
  const previous = getSettings().skillTokenConversion
  try {
    updateSettings({ skillTokenConversion: false })
    expect(ranksAt(c, entries).Athletics).toBe(1)
    expect(skillRankBudget(c, entries).trained).toBe(available)
    updateSettings({ skillTokenConversion: true })
    expect(ranksAt(c, entries).Athletics).toBe(4)
  } finally { updateSettings({ skillTokenConversion: previous }) }
  const confirm = vi.fn(() => false)
  vi.stubGlobal('window', { confirm })
  try {
    const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
    const refund = () => (findButtons(tree()).get('Athletics Trained')!.onClick as () => void)()
    refund()
    expect(ranksAt(c, entries).Athletics).toBe(4)
    confirm.mockReturnValue(true)
    refund()
    expect(c.skillTokenUpgrades).toEqual([])
    expect(ranksAt(c, entries).Athletics).toBe(1)
    expect(skillRankBudget(c, entries).trained).toBe(available)
    expect(c.skillPicks).toEqual(JSON.parse(before).skillPicks)
  } finally { vi.unstubAllGlobals() }
})

it('refunds converted ranks through the rank buttons, keeping original allocations and honoring cancellation', () => {
  const klass = { ...ranger, data: { ...ranger.data,
    skill_proficiency: 'Trained in Nature, Trained in a number of additional skills equal to 20 plus your Intelligence modifier' } }
  const entries = [klass]
  let c: Character = { ...base, level: 7, skillPicks: ['Athletics', 'Acrobatics'],
    skillIncreases: { 3: 'Nature', 5: 'Acrobatics', 7: 'Nature' } }
  const original = JSON.parse(JSON.stringify(c)) as Character
  const initialBudget = skillRankBudget(c, entries).trained
  c = { ...c, skillTokenUpgrades: builder.skillTokenPurchase(c, entries, 'Athletics', 3, true) }
  const confirm = vi.fn(() => false)
  vi.stubGlobal('window', { confirm })
  try {
    const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
    const click = (rank: string) => {
      const button = findButtons(tree()).get(`Athletics ${rank}`)!
      expect(button.disabled).toBeFalsy()
      ;(button.onClick as () => void)()
    }
    click('Master')
    expect(ranksAt(c, entries).Athletics).toBe(3)
    confirm.mockReturnValue(true)
    click('Master')
    expect(ranksAt(c, entries).Athletics).toBe(2)
    expect(skillRankBudget(c, entries).trained).toBe(initialBudget - 2)
    click('Expert')
    expect(ranksAt(c, entries).Athletics).toBe(1)
    expect(c.skillTokenUpgrades).toEqual([])
    expect(skillRankBudget(c, entries).trained).toBe(initialBudget)
    expect(c.skillPicks).toEqual(original.skillPicks)
    expect(c.skillIncreases).toEqual(original.skillIncreases)
  } finally { vi.unstubAllGlobals() }
})

it.each([[7, 2, 3, ['3', '5']], [15, 3, 4, ['7', '9']]] as const)(
  'spends unused higher-tier tokens at level %i without trading away the existing rank', (level, current, target, payment) => {
    const c: Character = { ...base, level, rankOverrides: { Athletics: current } }
    const purchases = builder.skillTokenPurchase(c, [ranger], 'Athletics', target, true)!
    expect(purchases.at(-1)?.payment).toEqual(payment)
    const upgraded = { ...c, skillTokenUpgrades: purchases }
    expect(ranksAt(upgraded, [ranger]).Athletics).toBe(target)
    expect(c.rankOverrides?.Athletics).toBe(current)
    expect(builder.skillTokenPurchase({ ...c, level: target === 4 ? 14 : 6 }, [ranger], 'Athletics', target, true))
      .toBeUndefined()
    expect(builder.skillTokenPurchase(c, [ranger], 'Perception', target, true)).toBeUndefined()
  })

it('prevents double spending, missing funding and temporary Skill Download ranks from creating permanent purchases', () => {
  const c: Character = { ...base, level: 3, skillPicks: ['Athletics', 'Acrobatics'] }
  const purchases = builder.skillTokenPurchase(c, [ranger], 'Athletics', 2, true)!
  const upgraded = { ...c, skillTokenUpgrades: purchases }
  expect(builder.skillTokenPurchase(upgraded, [ranger], 'Acrobatics', 2, true)).toBeUndefined()
  const duplicate = { ...upgraded, skillTokenUpgrades: [...purchases, { ...purchases[0], skill: 'Acrobatics' }] }
  expect(builder.skillTokenState(duplicate, [ranger]).inactive).toHaveLength(1)
  expect(ranksAt(duplicate, [ranger])).toMatchObject({ Athletics: 2, Acrobatics: 1 })
  const spentElsewhere = { ...upgraded, skillPicks: [...c.skillPicks!, 'Deception', 'Medicine'] }
  expect(ranksAt(spentElsewhere, [ranger]).Athletics).toBe(1)
  expect(renderToStaticMarkup(<SkillsSection c={spentElsewhere} entries={[ranger]} save={() => {}} />))
    .toContain('Payment unavailable')
  const downloaded: Character = { ...base, level: 17, feats: [
    { name: 'Skill Download', type: 'Ancestry Feat', level: 1, choice: 'Athletics' },
  ] }
  expect(builder.skillTokenPurchase(downloaded, [ranger], 'Athletics', 4)).toBeUndefined()
})

it('keeps restricted Mechanic tokens restricted when combining them', () => {
  const c: Character = { ...base, systems: ['sf2e'], className: 'Mechanic', level: 7,
    rankOverrides: { Athletics: 2, Computers: 2 }, skillPicks: ['Athletics', 'Computers', 'Deception', 'Medicine'],
    skillIncreases: { 3: 'Nature', 7: 'Nature', 'mechanic-ingenuity:7': 'Computers' } }
  expect(builder.skillTokenPurchase(c, [ranger], 'Athletics', 3, true)).toBeUndefined()
  const purchases = builder.skillTokenPurchase(c, [ranger], 'Computers', 3, true)!
  expect(purchases.at(-1)?.payment.slice().sort()).toEqual(['5', 'mechanic-ingenuity:3'])
  expect(ranksAt({ ...c, skillTokenUpgrades: purchases }, [ranger]).Computers).toBe(3)
})

it('puts selected feat requirements on their exact rank buttons without granting proficiency', () => {
  const feat: ContentEntry = { ...ranger, id: 'nimble', kind: 'feat', name: 'Nimble Athlete', level: 4,
    traits: ['Ranger'], data: { prerequisite: 'expert in Athletics or Acrobatics' } }
  const ancestry = { ...feat, id: 'ancestry-study', name: 'Ancestral Study', traits: ['Human'],
    data: { prerequisite: 'trained in Arcana, master in Society' } }
  const archetype = { ...feat, id: 'archetype-study', name: 'Archetype Study', traits: ['Archetype'],
    data: { prerequisite: 'expert in Stealth' } }
  const excluded = ['Skill', 'General', 'Dedication'].map(category => ({ ...feat,
    id: category, name: `${category} Study`, traits: [category], data: { prerequisite: 'master in Athletics' } }))
  const c: Character = { ...base, level: 20, ancestry: 'Human', feats: [
    { name: feat.name, type: 'Class Feat', level: 4, slot: 'class:4:0' },
    { name: ancestry.name, type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' },
    { name: archetype.name, type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' },
    ...excluded.map(entry => ({ name: entry.name, type: `${entry.traits[0]} Feat`, level: 1,
      slot: `${entry.traits[0] === 'Dedication' ? 'archetype' : entry.traits[0].toLowerCase()}:1:0` })),
  ] }
  const entries = [ranger, feat, ancestry, archetype, ...excluded]
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('aria-label="Athletics Expert prerequisites note"')
  expect(markup).toContain('aria-label="Acrobatics Expert prerequisites note"')
  expect(markup).toContain('aria-label="Arcana Trained prerequisites note"')
  expect(markup).toContain('aria-label="Society Master prerequisites note"')
  expect(markup).toContain('aria-label="Stealth Expert prerequisites note"')
  expect(markup).not.toContain('aria-label="Athletics Master prerequisites note"')
  expect(markup).toContain('Nimble Athlete: expert in Athletics or Acrobatics')
  expect(markup).toContain('Current rank: Untrained')
  expect(ranksAt(c, entries).Athletics ?? 0).toBe(0)
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, level: 3 }} entries={entries} save={() => {}} />))
    .not.toContain('prerequisites note')
})

it('shows available Fighter and ancestry skill requirements before selection and only includes owned archetypes', () => {
  const feat: ContentEntry = { ...ranger, kind: 'feat', id: 'flip', name: 'Farabellus Flip', level: 4, traits: ['Fighter'],
    data: { prerequisite: 'trained in Acrobatics; trained in medium armor' } }
  const entries: ContentEntry[] = [
    feat,
    { ...feat, id: 'display', name: 'Dazzling Display', data: { prerequisite: 'expert in Intimidation' } },
    { ...feat, id: 'ancestry', name: 'Human Acrobat', traits: ['Human'], data: { prerequisite: 'master in Acrobatics' } },
    { ...feat, id: 'medic', name: 'Medic Dedication', level: 2, traits: ['Archetype', 'Dedication'],
      data: { archetype: 'Medic', prerequisite: 'trained in Religion' } },
    { ...feat, id: 'medicine', name: 'Medic Training', traits: ['Archetype'],
      data: { archetype: 'Medic', prerequisite: 'master in Medicine' } },
    { ...feat, id: 'assassin', name: 'Assassin Training', traits: ['Archetype'],
      data: { archetype: 'Assassin', prerequisite: 'master in Stealth' } },
    { ...feat, id: 'wizard', name: 'Wizard Study', traits: ['Wizard'], data: { prerequisite: 'expert in Arcana' } },
    { ...feat, id: 'future', name: 'Future Fighter', level: 20, data: { prerequisite: 'legendary in Nature' } },
    { ...feat, id: 'skill', name: 'Fighter Skill', traits: ['Fighter', 'Skill'], data: { prerequisite: 'master in Crafting' } },
    { ...feat, id: 'general', name: 'Fighter General', traits: ['Fighter', 'General'], data: { prerequisite: 'master in Society' } },
  ]
  const c: Character = { ...base, level: 10, className: 'Fighter', ancestry: 'Human' }
  const render = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={entries} save={() => {}} />)
  const markup = render(c)
  for (const rank of ['Acrobatics Trained', 'Acrobatics Master', 'Intimidation Expert']) {
    expect(markup).toContain(`aria-label="${rank} prerequisites note"`)
  }
  for (const rank of ['Medicine Master', 'Stealth Master', 'Arcana Expert', 'Nature Legendary', 'Crafting Master', 'Society Master', 'Religion Trained']) {
    expect(markup).not.toContain(`aria-label="${rank} prerequisites note"`)
  }
  const owned = { ...c, feats: [{ name: 'Medic Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }] }
  expect(render(owned)).toContain('aria-label="Medicine Master prerequisites note"')
  expect(ranksAt(c, entries).Acrobatics ?? 0).toBe(0)
  expect(c.feats).toEqual([])
})

it('shows archetype skill feat rank requirements before and after selection', () => {
  const dedication: ContentEntry = { ...ranger, kind: 'feat', id: 'cavalier', name: 'Cavalier Dedication', level: 2,
    traits: ['Archetype', 'Dedication'], data: { archetype: 'Cavalier' } }
  const quick: ContentEntry = { ...dedication, id: 'quick', name: 'Quick Mount', level: 4, traits: ['Archetype', 'Skill'],
    data: { archetype: 'Cavalier, Mammoth Lord', prerequisite: 'Cavalier Dedication; Expert in Nature' } }
  const entries = [ranger, dedication, quick]
  const c: Character = { ...base, level: 6, feats: [
    { name: dedication.name, type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' },
  ] }
  const render = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={entries} save={() => {}} />)
  expect(render({ ...c, feats: [] })).not.toContain('Quick Mount: Cavalier Dedication; Expert in Nature')
  expect(render(c)).toContain('aria-label="Nature Expert prerequisites note"')
  expect(render(c)).toContain('Quick Mount: Cavalier Dedication; Expert in Nature')
  const selected: Character = { ...c, feats: [...c.feats,
    { name: quick.name, type: 'Skill Feat', level: 4, slot: 'skill:4:0' }] }
  expect(render(selected)).toContain('Quick Mount: Cavalier Dedication; Expert in Nature')
  expect(render({ ...selected, level: 3 })).not.toContain('Quick Mount: Cavalier Dedication; Expert in Nature')
})

it('applies only the highest owned Killer belt bonus and removes it when gear is removed', () => {
  const ordinary: ContentEntry = { ...KILLERS_BELT_MAJOR, id: 'ordinary-belt', name: "Killer's Belt",
    source: 'official', level: 4, effects: [] }
  const greater: ContentEntry = { ...ordinary, id: 'greater-belt', name: 'Greater Killer\u2019s Belt', level: 9 }
  const entries = [ranger, ordinary, greater, KILLERS_BELT_MAJOR]
  for (const [belt, value] of [[ordinary, 1], [greater, 2], [KILLERS_BELT_MAJOR, 3]] as const) {
    const c = { ...base, equipment: [{ name: ordinary.name, qty: 1 }, { name: belt.name, qty: 2 }] }
    expect(builder.killerBeltBonus(c, entries)?.value).toBe(value)
    const markup = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} />)
    const intimidation = markup.split('class="skill-name">Intimidation')[1].split('class="skill-name">')[0]
    expect(intimidation).toContain(`<b>+${value}`)
    expect(intimidation).not.toContain('item bonuses do not stack')
  }
  expect(builder.killerBeltBonus(base, entries)).toBeUndefined()
  expect(builder.killerBeltBonus({ ...base, equipment: [{ name: greater.name, qty: 0 }] }, entries)).toBeUndefined()
  expect(builder.killerBeltBonus({ ...base, equipment: [{ name: greater.name, qty: 1 }] },
    [{ ...greater, deleted: true }])).toBeUndefined()
})

it('applies the Voyager pack Survival item bonus without a source label or stacking copies and conditional item bonuses', () => {
  const pack: ContentEntry = { ...KILLERS_BELT_MAJOR, id: 'voyager', name: "Voyager's Pack", source: 'official', effects: [] }
  const arrowhead: ContentEntry = { ...pack, id: 'arrowhead', name: "Hunter's Arrowhead (Major)" }
  const entries = [ranger, pack, arrowhead]
  const c: Character = { ...base, equipment: [{ name: pack.name, qty: 2 }, { name: arrowhead.name, qty: 1 }] }
  const row = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={entries} save={() => {}} />)
    .split('class="skill-name">Survival')[1].split('class="skill-name">')[0]
  const withoutPack = { ...c, equipment: c.equipment.filter(item => item.name !== pack.name) }
  const ordinaryTotal = Number(/<b>\+?(-?\d+)/.exec(row(withoutPack))![1])
  const markup = row(c)
  expect(markup).toContain(`<b>+${ordinaryTotal + 3}`)
  expect(markup).toContain(`Survival +${ordinaryTotal + 3} against your Hunt Prey target`)
  expect(markup).not.toContain(pack.name)
  expect(builder.voyagerPackBonus(withoutPack, entries)).toBeUndefined()
  expect(builder.voyagerPackBonus({ ...c, equipment: [{ name: pack.name, qty: 0 }] }, entries)).toBeUndefined()
  expect(builder.voyagerPackBonus(c, [{ ...pack, deleted: true }])).toBeUndefined()
  expect(builder.voyagerPackBonus(c, [{ ...pack, systems: ['sf2e'] }])).toBeUndefined()
})

it('shows Rider as a conditional Nature bonus without increasing ordinary Nature checks', () => {
  const c: Character = { ...base, feats: [{ name: 'Rider', type: 'Class Feat', level: 1 }] }
  const render = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={[ranger]} save={() => {}} />)
  const markup = render(c)
  expect(markup).toContain('+4 to Command an Animal checks for your own animal companion, if a check is required.')
  expect(ranksAt(c, [ranger]).Nature).toBe(ranksAt(base, [ranger]).Nature)
  expect(render(base)).not.toContain('Command an Animal checks for your own animal companion')
})

it.each([[12, 18, 'Dexterity', 12], [20, 12, 'Strength', 13], [18, 18, 'Strength', 12]] as const)(
  'uses the higher Athletics ability with Nimble Athlete (Str %i, Dex %i)', (str, dex, ability, total) => {
    const c: Character = { ...base, level: 4, abilities: { ...base.abilities, str, dex },
      rankOverrides: { Athletics: 2 }, feats: [{ name: 'Nimble Athlete', type: 'Class Feat', level: 4 }] }
    const row = (character: Character) =>
      renderToStaticMarkup(<SkillsSection c={character} entries={[ranger]} save={() => {}} />)
        .split('class="skill-name">Athletics')[1].split('class="skill-name">')[0]
    const markup = row(c)
    expect(markup).toContain(`<b>+${total}`)
    expect(markup).toContain(`<small>${ability}</small>`)
    expect(markup).not.toContain('Uses the higher of Strength or Dexterity')
    expect(row({ ...c, feats: [] })).toContain('<small>Strength</small>')
    expect(row({ ...c, feats: [{ ...c.feats[0], takenLevel: 6 }] })).toContain('<small>Strength</small>')
    expect(row({ ...c, level: 3 })).not.toContain('Nimble Athlete note')
    expect(c.abilities).toEqual({ ...base.abilities, str, dex })
  })

it.each([['Wildwood Ink', 1], ['Greater Wildwood Ink', 2], ['Wildwood Ink (Major)', 3]] as const)(
  'applies %s Stealth and shows the full forest total in a clickable note', (name, value) => {
    const ink: ContentEntry = { ...KILLERS_BELT_MAJOR, id: name, name, effects: [] }
    const entries = [ranger, ink]
    const c: Character = { ...base, abilities: { ...base.abilities, dex: 18 },
      skillPicks: ['Stealth'], equipment: [{ name, qty: 1 }] }
    const render = (character: Character, catalog = entries) =>
      renderToStaticMarkup(<SkillsSection c={character} entries={catalog} save={() => {}} />)
        .split('class="skill-name">Stealth')[1].split('class="skill-name">')[0]
    const normal = 7 + value
    const markup = render(c)
    expect(markup).toContain(`<b>+${normal}`)
    expect(markup).toContain(`aria-label="${builder.wildwoodInkBonus(c, entries)!.source} note"`)
    expect(markup).toMatch(/popoverTarget|popovertarget/)
    expect(markup).toContain(`Stealth +${normal + 1} in forests (${builder.wildwoodInkBonus(c, entries)!.source})`)
    expect(render({ ...c, equipment: [{ name, qty: 0 }] })).toContain('<b>+7')
    expect(render(c, [ranger, { ...ink, deleted: true }])).toContain('<b>+7')
    expect(render({ ...c, systems: ['sf2e'] })).not.toContain('in forests')
    const duplicate = { ...c, equipment: [{ name, qty: 2 }, { name, qty: 1 }] }
    expect(render(duplicate)).toContain(`<b>+${normal}`)
  })

it('grants current deity Lore without spending training and removes only its automatic grant', () => {
  const previous = getSettings()
  const entries = [ranger]
  const c: Character = { ...base, deity: 'Iomedae' }
  const download: Character = { ...c, systems: ['pf2e', 'sf2e'],
    feats: [{ name: 'Skill Download', type: 'Ancestry Feat', level: 1, choice: 'Iomedae Lore' }] }
  const saved = JSON.stringify(c)
  try {
    updateSettings({ deityLore: true, autoLores: false })
    for (const level of [1, 3, 7, 15, 20]) expect(ranksAt({ ...c, level }, entries)['Iomedae Lore']).toBe(1)
    expect(skillRankBudget(c, entries)).toEqual(skillRankBudget(base, entries))
    expect(builder.skillDownload(download, entries)).toEqual({ skill: 'Iomedae Lore', rank: 1 })
    expect(ranksAt({ ...c, level: 3, skillIncreases: { 3: 'Iomedae Lore' } }, entries)['Iomedae Lore']).toBe(2)
    const buttons = findButtons(SkillsSection({ c, entries, save: () => {} }))
    expect(buttons.has('Iomedae Lore Trained')).toBe(true)
    expect(buttons.get('Iomedae Lore Trained')?.disabled).toBe(true)
    for (const deity of [undefined, '', '   ']) {
      expect(builder.deityGrantedLores({ ...c, deity })).toEqual([])
      expect(ranksAt({ ...c, deity }, entries)['Iomedae Lore']).toBeUndefined()
    }
    const changed = ranksAt({ ...c, deity: 'Sarenrae' }, entries)
    expect(changed['Iomedae Lore']).toBeUndefined()
    expect(changed['Sarenrae Lore']).toBe(1)
    const manual: Character = { ...c, level: 3, lores: [{ name: 'Iomedae Lore', rank: 2 }] }
    expect(ranksAt({ ...manual, deity: undefined }, entries)['Iomedae Lore']).toBe(2)
    expect(JSON.stringify(c)).toBe(saved)
    updateSettings({ autoLores: true })
    expect(ranksAt({ ...c, level: 7 }, entries)['Iomedae Lore']).toBe(3)
    updateSettings({ deityLore: false })
    expect(ranksAt(c, entries)['Iomedae Lore']).toBeUndefined()
    expect(builder.skillDownload(download, entries)).toBeUndefined()
    expect(ranksAt(manual, entries)['Iomedae Lore']).toBe(2)
    expect(findButtons(SkillsSection({ c, entries, save: () => {} })).has('Iomedae Lore Trained')).toBe(false)
  } finally { updateSettings(previous) }
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

it.each(['Orc', 'Human'])('adds Experienced Laborer to the regular trained skill array for %s', ancestry => {
  const previous = getSettings().autoLores
  updateSettings({ autoLores: false })
  const c: Character = { ...base, systems: ['sf2e'], ancestry, level: 7,
    feats: [
      ...(ancestry === 'Human' ? [{ name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' }] : []),
      { name: 'Experienced Laborer', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' },
    ] }
  const entries = [{ ...ranger, systems: ['sf2e' as const] }]
  try {
    const markup = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} />)
    expect(markup).not.toContain('Experienced Laborer Lore specialty')
    expect(markup).not.toContain('One free trained Lore skill.')
    expect(skillRankBudget(c, entries).trained).toBe(5)
    expect(builder.automaticFeatGrants(c, entries).some(grant => grant.source === 'Experienced Laborer')).toBe(false)
    const trained: Character = { ...c, skillPicks: ['Diplomacy'] }
    expect(ranksAt(trained, entries).Diplomacy).toBe(1)
    expect(skillRankBudget(trained, entries).trained).toBe(4)
    expect(skillRankBudget({ ...c, level: 0 }, entries).trained).toBe(4)
    expect(skillRankBudget({ ...c, systems: ['pf2e'] }, entries).trained).toBe(4)
    expect(skillRankBudget({ ...c, level: 8, feats: [{ ...c.feats.at(-1)!, takenLevel: 9 }] }, entries).trained).toBe(4)
  } finally { updateSettings({ autoLores: previous }) }
})

it('preserves a saved Experienced Laborer Lore as an ordinary trained pick', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 7, lores: [{ name: 'mining Lore', rank: 0 }],
    feats: [{ name: 'Experienced Laborer', type: 'Ancestry Feat', level: 1, choice: '  Mining  Lore ' }],
    skillIncreases: { 3: 'mining Lore' } }
  const entries = [{ ...ranger, systems: ['sf2e' as const] }]
  const normalized = builder.normalizeConditionalSkillChoices(c, entries)
  expect(normalized.feats[0].choice).toBeUndefined()
  expect(normalized.skillPicks).toEqual(['mining Lore'])
  expect(normalized.lores).toEqual(c.lores)
  expect(normalized.skillIncreases).toEqual(c.skillIncreases)
  expect(ranksAt(c, entries)['mining Lore']).toBe(2)
  expect(skillRankBudget(c, entries).trained).toBe(4)
  expect(builder.normalizeConditionalSkillChoices(normalized, entries)).toBe(normalized)
  expect(c.feats[0].choice).toBe('  Mining  Lore ')
  expect(skillRankBudget({ ...normalized, skillPicks: [] }, entries).trained).toBe(5)
})

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
  expect(markup).toContain('Mental 3<button')
  expect(markup).toContain('aria-label="Pain Tolerance note"')
  expect(markup).toContain('+12 against effects that would make you clumsy, drained, or enfeebled (+1 circumstance).')
  expect(defenseSummary(c, [ranger])).toEqual(defenseSummary({ ...c, feats: [] }, [ranger]))
  const before = renderToStaticMarkup(<SkillsSection c={{ ...c, level: 5 }} entries={[ranger]} save={() => {}} part="defense" />)
  expect(before).not.toContain('Pain Tolerance')
})

it('shows Round Ears and Earned Glory conditions without applying Impersonate bonuses to ordinary Deception', () => {
  const c: Character = { ...base, feats: ['Round Ears', 'Earned Glory'].map(name =>
    ({ name, type: 'Ancestry Feat', level: 1 })) }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  expect(markup).toContain('to Impersonate someone who is not aiuvarin (+4 circumstance)')
  expect(markup).toContain('critical failure becomes a failure (Impressive Performance)')
  expect(markup).toMatch(/skill-name">Deception <b>\+3/)
})

it('shows Ysoki conditional bonuses without applying them to ordinary totals', () => {
  const c: Character = { ...base, level: 7, feats: ['Radiation Resistant', 'Tinkering Fingers', 'Extended Family']
    .map(name => ({ name, type: 'Ancestry Feat', level: 1 })) }
  const skills = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="defense" />)
  expect(skills).toContain('Repair without a toolkit without the penalty')
  expect(skills).toContain('Make an Impression or Request against ysoki')
  expect(defense).toContain('Poison (radiation only) 7')
  expect(defense).toContain('+12 against radiation effects (+1 circumstance).')
  expect(defenseSummary(c, [ranger])).toEqual(defenseSummary({ ...c, feats: [] }, [ranger]))
})

it('shows situational feat bonuses with totals without changing ordinary totals', () => {
  const c: Character = { ...base, level: 7, feats: ['Diamond Soul', 'Elven Verve', 'Elven Instincts']
    .map(name => ({ name, type: 'Ancestry Feat', level: 1 })) }
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="defense" />)
  const plain = defenseSummary({ ...c, feats: [] }, [ranger])
  expect(defense).toContain('against magic (+1 status).')
  expect(defense).toContain('immobilized, paralyzed, or slowed conditions (+1 circumstance).')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="senses" />)).toContain('on Perception checks attempted as initiative rolls (+2 circumstance).')
  expect(defenseSummary(c, [ranger])).toEqual(plain)
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
  expect(markup).toContain('to Coerce (+2 item bonus).')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="senses" />))
    .toContain('to Sense Motive (+2 item bonus).')
  expect(render({ ...c, level: 4 })).not.toContain('Clan dagger filigree')
  expect(render({ ...c, weapons: [] })).not.toContain('Clan dagger filigree')
})

it('skips skill allocation calculations in offense and defense', () => {
  const budget = vi.spyOn(builder, 'skillRankBudget')
  try {
    for (const part of ['offense', 'defense', 'senses'] as const) {
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

it('keeps Toughness contribution in a note without changing the HP total', () => {
  const c: Character = { ...base, level: 20, ancestry: 'Human', abilities: { ...base.abilities, con: 20 },
    feats: [{ name: 'Toughness', type: 'General Feat', level: 1, slot: 'general:3:0' }] }
  const entries: ContentEntry[] = [{ ...ranger, data: { ...ranger.data, hp: 10 } },
    { ...ranger, id: 'human', kind: 'ancestry', name: 'Human', data: { hp: 8 } }]
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={entries} save={() => {}} part="defense" />)
  expect(markup).toContain('328<button')
  expect(markup).toContain('aria-label="Hit Points note"')
  expect(markup).toContain('+20 Toughness (Hit Points)')
  expect(markup).not.toContain('<small> (+20 Toughness)</small>')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, feats: [] }} entries={entries} save={() => {}} part="defense" />))
    .not.toContain('Toughness')
})

it('shows only the highest resistance for each damage type', () => {
  const fire5: ContentEntry = { ...ranger, id: 'fire5', kind: 'feat', name: 'Fire Guard', data: { resistances: 'fire=5' } }
  const fire10: ContentEntry = { ...fire5, id: 'fire10', name: 'Fire Ward', data: { resistances: 'fire=10' } }
  const c: Character = { ...base, feats: [fire5, fire10].map(entry => ({ name: entry.name, type: 'Ancestry Feat', level: 1 })) }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[fire5, fire10]} save={() => {}} part="defense" />)
  expect(markup).toContain('Fire 10<button')
  expect(markup).toContain('aria-label="Fire Ward note"')
  expect(markup).not.toContain('Fire Guard')
})

it('keeps Pioneer training fixed, refunds redundant picks, and notes conditional Terrain Expertise on Survival', () => {
  let c: Character = { ...base, systems: ['sf2e'], level: 7, heritage: 'Pioneer Human', pioneerTerrain: 'Forest',
    skillPicks: ['Survival'], activeFeatEffects: ['Terrain Expertise'] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain('Survival <b>+9')
  expect(renderToStaticMarkup(tree())).toContain('+10 to Survival in Forest terrain')
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
  expect(markup).not.toContain('your proficiency rank remains untrained')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="defense" />))
    .toContain('Fortitude +9: show breakdown')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="senses" />))
    .toContain('Perception <b>+7</b>')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, level: 4 }} entries={[ranger]} save={() => {}} />))
    .toContain('Deception <b>+0</b>')
})

it.each([
  { source: 'Greenwatch Initiate', skill: 'Survival' },
  { source: 'Greywatch Initiate', skill: 'Deception' },
  { source: 'Blackwatch Initiate', skill: 'Occultism' },
  { source: 'Palewatch Initiate', skill: 'Religion' },
  { source: 'Magewatch Initiate', skill: 'Arcana' },
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

it.each(Object.entries(INITIATE_TRAINING))('returns redundant Expert spending from %s while preserving Master and allowing reuse', (source, training) => {
  const skill = training.skill
  let c: Character = { ...base, level: 7, skillPicks: [skill, 'Athletics'],
    skillIncreases: { 3: skill, 5: 'Nature', 7: skill },
    feats: [{ name: source, type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
  const before = JSON.stringify(c)
  expect(skillRankBudget(c, [ranger]).expert).toBe(1)
  expect(ranksAt(c, [ranger])[skill]).toBe(3)
  expect(builder.normalizeGrantedSkillSpending(c, [ranger]).skillIncreases).toEqual({ 5: 'Nature', 7: skill })
  expect(JSON.stringify(c)).toBe(before)
  expect(skillRankBudget({ ...c, feats: [] }, [ranger]).expert).toBe(0)
  expect(skillRankBudget({ ...c, level: 3 }, [ranger]).expert).toBe(0)
  const tree = SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  ;(findButtons(tree).get('Athletics Expert')!.onClick as () => void)()
  expect(c.skillIncreases).toEqual({ 3: 'Athletics', 5: 'Nature', 7: skill })
  expect(ranksAt(c, [ranger])).toMatchObject({ [skill]: 3, Athletics: 2 })
  expect(skillRankBudget(c, [ranger]).expert).toBe(0)
})

it('returns converted Expert payments without refunding Master, preserves saved intent and reuses the actual tokens', () => {
  const klass = { ...ranger, data: { ...ranger.data,
    skill_proficiency: 'Trained in Nature, Trained in a number of additional skills equal to 20 plus your Intelligence modifier' } }
  const entries = [klass]
  let c: Character = { ...base, level: 3, skillPicks: ['Occultism', 'Athletics', 'Survival'], skillIncreases: { 3: 'Nature' } }
  c = { ...c, skillTokenUpgrades: builder.skillTokenPurchase(c, entries, 'Occultism', 2, true) }
  const payment = c.skillTokenUpgrades![0].payment
  c = { ...c, level: 7, skillIncreases: { ...c.skillIncreases, 5: 'Survival', 7: 'Nature' } }
  c = { ...c, skillTokenUpgrades: builder.skillTokenPurchase(c, entries, 'Occultism', 3, true) }
  const paid = c
  c = { ...c, feats: [{ name: 'Blackwatch Initiate', type: 'Class Feat', level: 4, slot: 'class:4:0' }] }
  const before = JSON.stringify(c)
  const normalized = builder.normalizeGrantedSkillSpending(c, entries)
  expect(normalized.skillTokenUpgrades?.map(purchase => purchase.rank)).toEqual([3])
  expect(builder.skillTokenState(c, entries).inactive).toEqual([])
  expect(ranksAt(c, entries).Occultism).toBe(3)
  expect(skillRankBudget(c, entries).trained).toBe(skillRankBudget({ ...c, skillTokenUpgrades: [] }, entries).trained - 4)
  expect(JSON.stringify(c)).toBe(before)
  expect(builder.normalizeGrantedSkillSpending({ ...c, feats: [] }, entries).skillTokenUpgrades).toEqual(paid.skillTokenUpgrades)
  expect(builder.normalizeGrantedSkillSpending({ ...c, level: 8, feats: [{ ...c.feats[0], takenLevel: 8 }] }, entries).skillTokenUpgrades)
    .toEqual(paid.skillTokenUpgrades)
  const conversion = getSettings().skillTokenConversion
  try {
    updateSettings({ skillTokenConversion: false })
    expect(builder.normalizeGrantedSkillSpending(c, entries).skillTokenUpgrades).toEqual(paid.skillTokenUpgrades)
  } finally { updateSettings({ skillTokenConversion: conversion }) }
  const tree = SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
  ;(findButtons(tree).get('Athletics Expert')!.onClick as () => void)()
  expect(c.skillTokenUpgrades?.find(purchase => purchase.skill === 'Athletics')?.payment).toEqual(payment)
  expect(c.skillTokenUpgrades?.some(purchase => purchase.skill === 'Occultism' && purchase.rank === 2)).toBe(false)
  expect(ranksAt(c, entries)).toMatchObject({ Occultism: 3, Athletics: 2 })
})

it.each([false, true])('preserves earlier skill prerequisites when final-rank planning is %s', finalRanks => {
  const previous = getSettings().planSkillPrerequisites
  const prerequisite: ContentEntry = { ...ranger, id: 'expert-feat', kind: 'feat', name: 'Expert Test',
    data: { prerequisite: 'Expert in Occultism' } }
  const c: Character = { ...base, level: 8, skillPicks: ['Occultism'], skillIncreases: { 3: 'Occultism' },
    feats: [{ name: prerequisite.name, type: 'Skill Feat', level: 6 },
      { name: 'Blackwatch Initiate', type: 'Class Feat', level: 8, takenLevel: 8 }] }
  try {
    updateSettings({ planSkillPrerequisites: finalRanks })
    expect(builder.normalizeGrantedSkillSpending(c, [ranger, prerequisite]).skillIncreases)
      .toEqual(finalRanks ? {} : { 3: 'Occultism' })
  } finally { updateSettings({ planSkillPrerequisites: previous }) }
})

it('keeps Ancestral Skills training fixed, refunds redundant picks and spends only later increases', () => {
  const feat: ContentEntry = { ...ranger, id: 'ancestral-skills', systems: ['sf2e'], kind: 'feat',
    name: 'Ancestral Skills', traits: ['Human'], data: {}, description: 'Option(s): Diplomacy, Society' }
  let c: Character = { ...base, systems: ['sf2e'], ancestry: 'Human', level: 5, skillPicks: ['Society'],
    feats: [{ name: feat.name, level: 1, type: 'Ancestry Feat', slot: 'ancestry:5:0' }] }
  const tree = () => SkillsSection({ c, entries: [ranger, feat], save: patch => { c = { ...c, ...patch } } })
  expect(findButtons(tree()).get('Diplomacy Trained')?.disabled).toBe(true)
  expect(findButtons(tree()).get('Diplomacy Expert')?.disabled).toBe(false)
  expect(findButtons(tree()).get('Society Trained')?.disabled).toBe(false)
  ;(findButtons(tree()).get('Society Trained')!.onClick as () => void)()
  expect(c.skillPicks).toEqual([])
  expect(ranksAt(c, [ranger, feat]).Society).toBe(1)
  c = { ...c, level: 7 }
  ;(findButtons(tree()).get('Diplomacy Expert')!.onClick as () => void)()
  expect(c.skillIncreases).toEqual({ 7: 'Diplomacy' })
})

it('keeps movement terrain synchronized without a redundant feat selector and applies Terrain Master automatically', () => {
  let c: Character = { ...base, level: 11, feats: [
    { name: 'Favored Terrain', type: 'Class Feat', level: 2, slot: 'class:2:0', choice: 'Plains' },
    { name: 'Terrain Master', type: 'Class Feat', level: 8, slot: 'class:8:0' },
  ] }
  const tree = () => SensesAndSpeed({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
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
  const beforeMaster = renderToStaticMarkup(<SensesAndSpeed c={{ ...c, level: 7 }} entries={[ranger]} save={() => {}} />)
  expect(beforeMaster).not.toContain('aria-label="Favored Terrain"')
  expect(beforeMaster).toContain('aria-label="In favored terrain"')
  expect(beforeMaster).not.toContain('ignore non-magical difficult terrain')
})

it('allocates paid increases after Scrapper grants instead of spending earlier increases and invalidating the variant', () => {
  let c: Character = { ...base, level: 5, skillPicks: ['Crafting'],
    feats: [{ name: 'Technomagical Scrapper', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: 'Occultism to Trained' }] }
  const tree = () => SkillsSection({ c, entries: [ranger], save: patch => { c = { ...c, ...patch } } })
  expect(findButtons(tree()).get('Occultism Expert')?.disabled).toBe(false)
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
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} part="senses" />)
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

it('applies Athletic Rush to Athletics and Speed only while the known spell is active', () => {
  const c: Character = { ...base, spells: [{ name: 'Athletic Rush', rank: 1, cantrip: false }],
    activeSpells: ['Athletic Rush'], feats: [{ name: 'Fleet', type: 'General Feat', level: 1 }] }
  const render = (character: Character) => renderToStaticMarkup(<>
    <SkillsSection c={character} entries={[ranger]} save={() => {}} />
    <SensesAndSpeed c={character} entries={[ranger]} save={() => {}} />
  </>)
  const markup = render(c)
  expect(markup).toMatch(/Athletics <b>\+2<button[^>]*>\*<\/button><span/)
  expect(markup).toContain('aria-label="Athletic Rush note"')
  expect(markup).toContain('+10 Athletic Rush (status)')
  expect(builder.speed(c, [ranger])).toBe(40)
  expect(markup).toContain('Deception <b>+0</b>')
  for (const patch of [{ activeSpells: [] }, { spells: [] }]) {
    const inactive = { ...c, ...patch }
    expect(render(inactive)).toContain('Athletics <b>+0</b>')
    expect(render(inactive)).not.toContain('Athletic Rush note')
    expect(builder.speed(inactive, [ranger])).toBe(30)
  }
})

it('marks Shiny Aid bonuses without adding them to ordinary skill totals', () => {
  const c: Character = { ...base, systems: ['sf2e'], feats: [{ name: 'Shiny', type: 'Ancestry Feat', level: 1 }] }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ranger]} save={() => {}} />)
  expect(markup).toMatch(/Deception <b>\+0<button[^>]*>\*<\/button><span/)
  expect(markup).toMatch(/Performance <b>\+3<button[^>]*>\*<\/button><span/)
  expect(markup).not.toContain('</button> (Shiny)')
  expect(markup).toContain('Deception +3 when using Aid. (Shiny)')
  expect(markup).toContain('Performance +6 when using Aid. (Shiny)')
  expect(markup.match(/when using Aid\./g)).toHaveLength(8)
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, feats: [] }} entries={[ranger]} save={() => {}} />))
    .not.toContain('Shiny note')
})

it('keeps speed bonus sources in a note and omits redundant Initiative helper', () => {
  const c: Character = { ...base, feats: ['Fleet', 'Primal Nimbleness', 'Incredible Initiative']
    .map((name) => ({ name, type: 'General Feat', level: 1 })) }
  const markup = renderToStaticMarkup(<SensesAndSpeed c={c} entries={[ranger]} save={() => {}} />)
  expect(markup).toContain('35 ft.<button')
  expect(markup).toContain('aria-label="Land Speed note"')
  expect(markup).toContain('+5 Fleet; +5 Primal Nimbleness (Land Speed)')
  expect(markup).not.toContain('35 ft. (+5 Fleet')
  expect(markup).not.toContain('Initiative:')
  expect(initiativeBonus(c, [ranger])).toBe(5)
})

it('shows Uncanny Dash speeds in a source note instead of a temporary active toggle', () => {
  const c: Character = { ...base, level: 13, systems: ['sf2e'], feats: [
    { name: 'Gg-os Frame', type: 'Ancestry Feat', level: 1 },
    { name: 'Uncanny Dash', type: 'Ancestry Feat', level: 9 },
  ], activeFeatEffects: ['Uncanny Dash'] }
  const markup = renderToStaticMarkup(<SensesAndSpeed c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('aria-label="Uncanny Dash active"')
  expect(markup).toContain('aria-label="Uncanny Dash note"')
  expect(markup).toContain('During Uncanny Dash, your conditional Speeds are Land 40 feet')
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
  expect(markup).toMatch(/Armor Specialization: Wood, 6 Piercing Damage<button[^>]*>\*<\/button>/)
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

it('grants Consult the Stars one temporary trained skill from eligible key abilities', () => {
  const feat: ContentEntry = { ...ranger, id: 'consult-the-stars', kind: 'feat', name: 'Consult the Stars',
    description: 'You become trained in one skill of your choice.' }
  let c: Character = { ...base, level: 17, feats: [{ name: feat.name, type: 'Ancestry Feat', level: 1 }],
    lores: [{ name: 'Underworld Lore', rank: 0 }] }
  const entries = [ranger, feat]
  const tree = () => SkillsSection({ c, entries, save: patch => { c = { ...c, ...patch } } })
  const before = skillRankBudget(c, entries)
  const buttons = findButtons(tree())
  expect(buttons.get('Deception Trained')?.disabled).toBe(false)
  ;(buttons.get('Deception Trained')!.onClick as () => void)()
  expect(builder.skillDownload(c, entries)).toEqual({ skill: 'Deception', rank: 1 })
  expect(ranksAt(c, entries).Deception ?? 0).toBe(0)
  expect(skillRankBudget(c, entries)).toEqual(before)
  for (const skill of ['Arcana', 'Religion', 'Underworld Lore']) {
    const choice = { ...c, feats: [{ ...c.feats[0], choice: skill }] }
    expect(builder.skillDownload(choice, entries)).toEqual({ skill, rank: 1 })
  }
  for (const skill of ['Acrobatics', 'Athletics']) {
    const choice = { ...c, feats: [{ ...c.feats[0], choice: skill }] }
    expect(builder.skillDownload(choice, entries)).toBeUndefined()
  }
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
    'Academia Lore', 'Abadar Lore', 'Erastil Lore', 'Astral Plane Lore', 'Outer Rifts Lore', 'Pathfinder Society Lore',
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
      found = child.type === 'form' && child.props['aria-label'] === 'Add Lore' ? child.props : findForm(child.props.children as ReactNode)
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
  for (const [part, names] of [['senses', ['Perception']], ['defense', ['Fortitude', 'Reflex']]] as const) {
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
  expect(markup.indexOf('class="skill-name">Diplomacy')).toBeLessThan(markup.indexOf('class="skill-name">Fey Lore'))
  expect(markup.indexOf('class="skill-name">Fey Lore')).toBeLessThan(markup.indexOf('class="skill-name">Intimidation'))
  expect(markup).not.toContain('Perception')
  expect(markup).not.toContain('Fortitude')
  const offense = renderToStaticMarkup(<SkillsSection {...props()} part="offense" />)
  expect(offense).not.toContain('skill-name">Perception')
  expect(renderToStaticMarkup(<SkillsSection {...props()} part="senses" />)).toContain('skill-name">Perception')
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
  expect(renderToStaticMarkup(<SkillsSection {...props} part="defense" />)).toContain('class="prof-badges"')
  expect(renderToStaticMarkup(<ArmorProficiency c={c} entries={entries} />)).toContain('Unarmored')
})
