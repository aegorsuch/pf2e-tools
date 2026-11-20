import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { armorRanks, beckoningDirgeMaxRank, classSpellcasting, classSpellSlots, eligibleFeats, featPrerequisiteChecker, focusSpells, knowsSpell, necromancerConjurerRank, necromancerDirge, necromancerExtraSlots, necromancerSpellList, subclassOptions, weaponRanks } from './builder'
import { mapAonHit } from './aon'
import { DirgeLearnOptions, DirgeRankButton, SpellsContent, SpellsPanel, SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'

vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useState: vi.fn(react.useState), useMemo: vi.fn(react.useMemo),
    useRef: vi.fn(react.useRef), useId: vi.fn(react.useId) }
})

const base: Character = {
  id: 'necromancer', name: 'Necromancer', className: 'Necromancer', systems: ['pf2e'], level: 1,
  abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const spell = (name: string, level = 1, tradition = 'Occult', traits: string[] = []): ContentEntry => ({
  id: name, name, kind: 'spell', systems: ['pf2e'], source: 'official', level, traits,
  data: { tradition }, description: '', effects: [], updatedAt: 0,
})
const taken = (name: string, level: number) => ({ name, level, type: 'Class Feat' })
const render = (c: Character, entries: ContentEntry[]) =>
  renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => { throw Error('Rendering must preserve saved data') }} />)
const renderAtDirgeRank = (c: Character, entries: ContentEntry[], rank: number, query = '') => {
  for (const value of ['class', c.spellcasting?.tradition ?? '', undefined, true, rank, query])
    vi.mocked(useState).mockReturnValueOnce([value, vi.fn()])
  return render(c, entries)
}
const choices = (html: string, label: string) =>
  new RegExp(`<select aria-label="${label}"[^>]*>([\\s\\S]*?)</select>`).exec(html)?.[1] ?? ''
const learnOptions = (html: string) => /<ul class="dirge-options">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? ''

it.each([
  [1, [5, 1]], [2, [5, 2]], [3, [5, 2, 1]], [6, [5, 2, 2, 2]], [7, [5, 2, 2, 2, 1]],
  [17, [5, ...Array(8).fill(2), 1]], [18, [5, ...Array(9).fill(2)]],
  [19, [5, ...Array(9).fill(2), 1]], [20, [5, ...Array(9).fill(2), 1]],
])('derives Necromancer slots at level %i without manual settings', (level, counts) => {
  expect(Object.values(classSpellSlots({ ...base, level })!)).toEqual(counts)
})

it('gives Mortem Ultimatum its additional rank-ten slot only when acquired', () => {
  const c = { ...base, level: 20, feats: [taken('Mortem Ultimatum', 20), taken('Mortem Ultimatum', 20)] }
  expect(classSpellSlots(c)?.[10]).toBe(2)
  expect(classSpellSlots({ ...c, level: 19 })?.[10]).toBe(1)
  expect(classSpellSlots({ ...c, feats: [taken('Mortem Ultimatum', 21)] })?.[10]).toBe(1)
  expect(classSpellSlots({ ...c, className: 'Druid' })?.[10]).toBe(1)
  expect(classSpellSlots({ ...c, className: 'Wizard' })).toBeUndefined()
})

it.each([[1, 1], [7, 2], [15, 3], [19, 4]])('fixes Occult Intelligence spellcasting at level %i', (level, rank) => {
  expect(classSpellcasting({ ...base, level,
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: {} } }, []))
    .toMatchObject({ traditions: ['Occult'], ability: 'int', rank })
})

it('prepares only learned occult spells plus automatic Harm, while keeping focus spells separate', () => {
  const harm = spell('Harm', 1, 'Divine')
  const fear = spell('Fear')
  const guidance = spell('Guidance', 1, 'Occult', ['Cantrip'])
  const focus = spell('Bone Spear', 1, 'Occult', ['Focus'])
  const entries = [harm, fear, guidance, focus, spell('Arcane Only', 1, 'Arcane'),
    { ...spell('Deleted'), deleted: true }, { ...spell('Other System'), systems: ['sf2e'] as Character['systems'] }]
  const c: Character = { ...base, spells: [fear, guidance, focus].map(entry =>
    ({ name: entry.name, entryId: entry.id, rank: entry.level, cantrip: entry === guidance })) }
  expect(necromancerSpellList(c, entries).map(entry => entry.name)).toEqual(['Fear', 'Guidance', 'Harm'])
  expect(necromancerDirge(base, entries)).toEqual([harm])
  expect(necromancerDirge(c, entries)).toEqual([fear, guidance, harm])
  expect(knowsSpell(base, entries, 'Harm')).toBe(true)
  const html = render(c, entries)
  expect(choices(html, 'Spell Rank 1 slot 1')).toContain('value="Harm"')
  expect(choices(html, 'Spell Rank 1 slot 1')).toContain('value="Fear"')
  expect(choices(html, 'Cantrip slot 1')).toContain('value="Guidance"')
  expect(choices(html, 'Spell Rank 1 slot 1')).not.toContain('Bone Spear')
  expect(choices(render(base, entries), 'Spell Rank 1 slot 1')).not.toContain('value="Fear"')
  expect(html).toContain('aria-label="Search dirge spells"')
  expect(html.indexOf('class="dirge-icon"')).toBeGreaterThan(html.indexOf('class="class-spell-slots"'))
  expect(html).toContain('aria-label="Open Dirge rank 1"')
  expect(html).not.toContain('Spell slots:')
  expect(html).not.toContain('Spell Rank 1 slot 2')
})

it('adds familiar spell benefits without adding Dirge choices or overwriting saved slots', () => {
  const master = (name: string, description: string): ContentEntry => ({
    ...spell(name), kind: 'familiar', description, data: { ability_type: 'Master' },
  })
  const entries = [spell('Harm'), spell('Guidance', 1, 'Occult', ['Cantrip']),
    master('Cantrip Connection', 'You must be able to prepare cantrips or add them to your repertoire.'),
    master('Spell Battery', 'You must be able to cast 4th-rank spells using spell slots.')]
  const c: Character = { ...base, level: 8,
    feats: [taken('Undead Familiar', 1), taken('Enhanced Undead Familiar', 2)],
    familiar: { abilities: ['Cantrip Connection', 'Spell Battery'] },
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 2, slots: {},
      prepared: { 'familiar-cantrip-connection': 'Guidance', 'familiar-spell-battery:1': 'Harm' } },
    spells: [{ name: 'Guidance', entryId: 'Guidance', rank: 1, cantrip: true }],
  }
  const html = render(c, entries)
  expect(html).toContain('aria-label="Cast spell slot rank 1 slot 3"')
  expect(html).toContain('<strong>Spells</strong><span>3/16 spells</span>')
  expect(html).toContain('aria-label="Clear Guidance spell slot"')
  expect(necromancerDirge(c, entries).map(entry => entry.name)).toEqual(['Guidance', 'Harm'])
  const advanced = render({ ...c, level: 9 }, entries)
  expect(advanced).toContain('aria-label="Cast spell slot rank 2 slot 3"')
  expect(c.spellcasting?.prepared?.['familiar-spell-battery:1']).toBe('Harm')
})

it('excludes the Epitaph slot when granting Spell Battery at level 20', () => {
  const battery = { ...spell('Spell Battery'), kind: 'familiar' as const,
    description: 'You must be able to cast 4th-rank spells using spell slots.', data: { ability_type: 'Master' } }
  const c: Character = { ...base, level: 20,
    feats: [taken('Undead Familiar', 1)], familiar: { abilities: ['Spell Battery'] } }
  const html = render(c, [battery, spell('Harm')])
  expect(html).toContain('aria-label="Cast spell slot rank 6 slot 3"')
  expect(html).not.toContain('aria-label="Cast spell slot rank 7 slot 3"')
})

it('uses each prepared slot rank for Grisly Growths damage', () => {
  const growths = { ...spell('Grisly Growths', 5, 'Primal'), data: { tradition: 'Primal', actions: 'Two Actions' } }
  const c: Character = { ...base, level: 13, feats: [taken('Expanded Necromancy', 10)],
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 2, slots: {},
      prepared: { '5:0': growths.id, '7:0': growths.id } } }
  const html = render(c, [growths, spell('Harm')])
  expect(html).toContain('title="Two Actions; Damage: 10d6 piercing"')
  expect(html).toContain('title="Two Actions; Damage: 14d6 piercing"')
})

it('uses prepared slot rank for Grim Tendrils void damage', () => {
  const tendrils = { ...spell('Grim Tendrils'), data: { tradition: 'Occult', actions: 'Two Actions' } }
  const c: Character = { ...base, level: 7,
    spells: [{ name: tendrils.name, entryId: tendrils.id, rank: 1, cantrip: false }],
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 2, slots: {},
      prepared: { '1:0': tendrils.id, '4:0': tendrils.id } } }
  const html = render(c, [tendrils, spell('Harm')])
  expect(html).toContain('title="Two Actions; Damage: 2d4 void"')
  expect(html).toContain('title="Two Actions; Damage: 8d4 void"')
})

it('opens False Vitality controls at each prepared slot rank', () => {
  const vitality = { ...spell('False Vitality', 2), data: { tradition: 'Occult', actions: 'Two Actions' } }
  const c: Character = { ...base, level: 9,
    spells: [{ name: vitality.name, entryId: vitality.id, rank: 2, cantrip: false }],
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 2, slots: {},
      prepared: { '2:0': vitality.id, '5:0': vitality.id } } }
  const html = render(c, [vitality, spell('Harm')])
  expect(html).toContain('False Vitality (Rank 2)</h4>')
  expect(html).toContain('False Vitality (Rank 5)</h4>')
  expect(html.match(/aria-label="False Vitality active"/g)).toHaveLength(3)
})

it('sorts prepared spells by name within each rank without changing slot identities', () => {
  const zap = spell('Zap', 1, 'Occult', ['Cantrip'])
  const needle = { ...spell('Needle Darts', 1, 'Occult', ['Cantrip']),
    data: { tradition: 'Occult', actions: 'Two Actions' } }
  const fear = spell('Fear')
  const bane = spell('Bane')
  const entries = [zap, needle, fear, bane, spell('Harm')]
  const c: Character = { ...base, level: 3,
    spells: [zap, needle, fear, bane].map(entry => ({ name: entry.name, entryId: entry.id,
      rank: entry.level, cantrip: entry.traits.includes('Cantrip') })),
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 1, slots: {},
      prepared: { '0:0': 'Zap', '0:2': 'Needle Darts', '1:0': 'Fear', '1:1': 'Bane' },
      spentSlots: ['1:0'] } }
  const before = JSON.stringify(c)
  const html = render(c, entries)
  const slots = html.slice(html.indexOf('class="class-spell-slots"'))
  expect(slots.indexOf('>Needle Darts</button>')).toBeLessThan(slots.indexOf('>Zap</button>'))
  expect(slots.indexOf('>Bane</button>')).toBeLessThan(slots.indexOf('>Fear</button>'))
  expect(slots).toContain('title="Two Actions; Damage: 4d4 piercing"')
  expect(slots).toMatch(/aria-label="Cast spell slot rank 1 slot 1"[^>]*disabled|disabled="" aria-label="Cast spell slot rank 1 slot 1"/)
  expect(slots).toContain('aria-label="Cast spell slot rank 1 slot 2"')
  expect(JSON.stringify(c)).toBe(before)
})

it('orders preparation choices by heightening, then name, and marks selected heightened spells', () => {
  const entries = [spell("Bone Moth's Kiss", 3), spell('Ghost Rush', 3), spell('Blood Runs Cold', 2),
    spell('False Vitality', 2), spell('Grim Tendrils'), spell('Harm', 1, 'Divine'),
    spell('Zap', 1, 'Occult', ['Cantrip'])]
  const c: Character = { ...base, level: 6,
    spells: entries.filter(entry => entry.name !== 'Harm').map(entry => ({
      name: entry.name, entryId: entry.id, rank: entry.level, cantrip: entry.traits.includes('Cantrip'),
    })),
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 1, slots: {},
      prepared: { '3:1': 'False Vitality' } } }
  const html = render(c, entries)
  const options = choices(html, 'Spell Rank 3 slot 1')
  expect(options).toMatch(/>Bone Moth&#x27;s Kiss<\/option>[\s\S]*>Ghost Rush<\/option>[\s\S]*>\+1 Blood Runs Cold<\/option>[\s\S]*>\+1 False Vitality<\/option>[\s\S]*>\+2 Grim Tendrils<\/option>/)
  expect(options).not.toContain('Zap')
  expect(html).toMatch(/<button[^>]*>False Vitality \(\+1\)<\/button>/)
  expect(choices(html, 'Cantrip slot 1')).not.toContain('+')
})

it('shows Execute damage in the prepared Necromancer spell slot', () => {
  const execute = { ...spell('Execute', 7, 'Divine'), data: { tradition: 'Divine', actions: 'Two Actions' } }
  const c: Character = { ...base, level: 13, feats: [taken('Expanded Necromancy', 10)],
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 2, slots: {}, prepared: { '7:0': execute.id } } }
  const html = render(c, [execute, spell('Harm')])
  expect(html).toContain('title="Two Actions; Damage: 70 vitality or void"')
})

it('uses the prepared slot rank for Blood Runs Cold persistent damage', () => {
  const blood = { ...spell('Blood Runs Cold', 2), data: { tradition: 'Occult', actions: 'Two Actions' } }
  const c: Character = { ...base, level: 7, spells: [{ name: blood.name, entryId: blood.id, rank: 2, cantrip: false }],
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 2, slots: {}, prepared: { '4:0': blood.id } } }
  expect(render(c, [blood, spell('Harm')])).toContain('title="Two Actions; Damage: 2d6 persistent cold"')
})

it.each([
  ['Desiccate', 8, 15, 'title="Two Actions; Damage: 10d10 void"'],
  ['Massacre', 9, 17, 'title="Two Actions; Success: 9d6 void"'],
] as const)('shows %s damage in its Necromancer spell slot', (name, rank, level, title) => {
  const entry = { ...spell(name, rank, 'Primal'), data: { tradition: 'Primal', actions: 'Two Actions' } }
  const c: Character = { ...base, level, feats: [taken('Expanded Necromancy', 10)],
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 2, slots: {},
      prepared: { [`${rank}:0`]: entry.id } } }
  expect(render(c, [entry, spell('Harm')])).toContain(title)
})

it('shows only spell categories the character has, and no spell section without spells', () => {
  const html = render(base, [spell('Harm')])
  expect(html).toContain('aria-pressed="true">Class Spells</button>')
  for (const label of ['Innate Spells', 'Item Spells', 'Rituals'])
    expect(html).not.toContain(`>${label}</button>`)
  const champion = render({ ...base, className: 'Champion' }, [])
  expect(champion).not.toContain('>Class Spells</button>')
  expect(champion).toContain('aria-pressed="true">Focus Spells</button>')
  for (const className of ['Monk', 'Ranger', 'Fighter'])
    expect(renderToStaticMarkup(<SpellsPanel c={{ ...base, className }} entries={[]} save={() => {}} />)).toBe('')
})

it('hides class spells for focus-only classes', () => {
  expect(render({ ...base, className: 'Druid' }, [])).toContain('aria-pressed="true">Class Spells</button>')
  expect(render({ ...base, className: 'Champion', spellcasting: {
    ability: 'cha', tradition: 'Divine', rank: 1, slots: { 1: 2 },
  } }, [])).not.toContain('>Class Spells</button>')
  expect(render({ ...base, className: 'Champion', spells: [{ name: 'Fear', rank: 1, cantrip: false }] }, [spell('Fear')]))
    .toContain('aria-pressed="true">Class Spells</button>')
})

it('shows ritual tab for known or feat-granted rituals and falls back when none remain', () => {
  const creator: ContentEntry = { ...spell('Undead Creator'), kind: 'feat', ritualGrants: ['Create Undead'] }
  const champion = { ...base, className: 'Champion' }
  expect(render({ ...champion, rituals: ['Awaken Animal'] }, [])).toContain('>Rituals</button>')
  expect(render({ ...champion, feats: [taken('Undead Creator', 1)] }, [creator])).toContain('>Rituals</button>')
  expect(render({ ...champion, feats: [taken('Undead Creator', 2)] }, [creator])).not.toContain('>Rituals</button>')
  vi.mocked(useState).mockReturnValueOnce(['rituals', vi.fn()])
  expect(render(champion, [])).toContain('aria-pressed="true">Focus Spells</button>')
})

it('shows the same tradition and spellcasting DC in class and focus tabs', () => {
  const c: Character = { ...base, level: 20, abilities: { ...base.abilities, int: 22 } }
  const html = render(c, [spell('Harm')])
  expect(html.match(/Occult DC 44 <small>\(Attack \+34\)<\/small>/g)).toHaveLength(2)
  expect(html.match(/Spellcasting proficiency: Legendary/g)).toHaveLength(2)
  expect(html).not.toContain('Occult tradition')
  expect(html).not.toContain('Class Spell Slots')
})

it('groups learned dirge spells by cantrip and spell rank', () => {
  const guidance = spell('Guidance', 1, 'Occult', ['Cantrip'])
  const fear = spell('Fear')
  const blindness = spell('Blindness', 2)
  const c: Character = { ...base, level: 3, spells: [guidance, fear, blindness].map(entry =>
    ({ name: entry.name, entryId: entry.id, rank: entry.level, cantrip: entry === guidance })) }
  const html = render(c, [guidance, fear, blindness, spell('Harm')])
  const dirge = html.slice(html.indexOf('class="entry-dialog dirge-dialog"'), html.indexOf('class="class-spell-slots"'))
  expect(dirge).toMatch(/<h5>Cantrips<\/h5>[\s\S]*?>Guidance<\/button>/)
  expect(dirge).toMatch(/<h5>Rank 1<\/h5>[\s\S]*?>Fear<\/button>/)
  expect(dirge).toMatch(/<h5>Rank 2<\/h5>[\s\S]*?>Blindness<\/button>/)
})

it('offers a Dirge shortcut at each available spell rank', () => {
  const c: Character = { ...base, level: 5 }
  const html = render(c, [spell('Harm')])
  for (const label of ['Open Dirge cantrips', 'Open Dirge rank 1', 'Open Dirge rank 2', 'Open Dirge rank 3'])
    expect(html).toContain(`aria-label="${label}"`)
  expect(html).not.toContain('aria-label="Open Dirge rank 4"')
  const open = vi.fn()
  const button = DirgeRankButton({ rank: 3, onOpen: open })
  button.props.onClick()
  expect(open).toHaveBeenCalledWith(3)
})

it('deduplicates granted and saved dirge spells while keeping learned spells alphabetized by rank', () => {
  const harm = spell('Harm', 1, 'Divine')
  const summon = spell('Summon Undead')
  const fear = spell('Fear')
  const entries = [harm, { ...harm, id: 'alternate-harm' }, summon, { ...summon, id: 'alternate-summon' }, fear]
  const c: Character = { ...base, level: 6, fatalMethod: 'Puppeteer', feats: [taken('Conjurer of Corpses', 6)],
    spells: [
      { name: 'Summon Undead', entryId: summon.id, rank: 1, cantrip: false },
      { name: 'Harm', entryId: harm.id, rank: 1, cantrip: false },
      { name: 'Fear', entryId: fear.id, rank: 1, cantrip: false },
      { name: 'Harm', entryId: 'alternate-harm', rank: 1, cantrip: false },
      { name: 'Summon Undead', entryId: 'alternate-summon', rank: 1, cantrip: false },
    ] }
  expect(necromancerDirge({ ...c, spells: [] }, entries).map(entry => entry.name)).toEqual(['Harm', 'Summon Undead'])
  expect(necromancerDirge({ ...c, spells: [c.spells![3]] }, entries).find(entry => entry.name === 'Harm')?.id)
    .toBe('alternate-harm')
  expect(necromancerDirge(c, entries).map(entry => entry.name)).toEqual(['Fear', 'Harm', 'Summon Undead'])
  const html = render(c, entries)
  const dirge = html.slice(html.indexOf('class="entry-dialog dirge-dialog"'), html.indexOf('class="class-spell-slots"'))
  expect(dirge.match(/>Harm<\/button>/g)).toHaveLength(1)
  expect(dirge.match(/>Summon Undead<\/button>/g)).toHaveLength(1)
  expect(dirge.indexOf('>Fear</button>')).toBeLessThan(dirge.indexOf('>Harm</button>'))
  expect(dirge.indexOf('>Harm</button>')).toBeLessThan(dirge.indexOf('>Summon Undead</button>'))
})

it('filters learned and learnable dirge spells by the selected rank', () => {
  const entries = [spell('Zap', 1, 'Occult', ['Cantrip']), spell('Slow', 3), spell('Fear'), spell('Blindness', 2),
    spell('Aid', 1, 'Occult', ['Cantrip']), spell('Bane'), spell('Blur', 2), spell('Harm', 1, 'Divine')]
  const c: Character = { ...base, level: 5, spells: [{ name: 'Fear', entryId: 'Fear', rank: 1, cantrip: false }] }
  const cantrips = renderAtDirgeRank(c, entries, 0)
  expect(cantrips).toContain('aria-label="Cantrips" aria-pressed="true"')
  expect(cantrips).toContain('aria-label="Rank 10" aria-pressed="false"')
  expect(learnOptions(cantrips)).toMatch(/aria-label="Learn Aid"[\s\S]*aria-label="Learn Zap"/)
  expect(cantrips).toContain('<div class="dirge-rank" hidden=""><section class="innate-spell-group"><h5>Rank 1</h5>')
  const rank1 = renderAtDirgeRank(c, entries, 1)
  expect(rank1).toContain('aria-label="Rank 1" aria-pressed="true"')
  expect(rank1).toContain('<div class="dirge-rank"><section class="innate-spell-group"><h5>Rank 1</h5>')
  expect(learnOptions(rank1)).toContain('aria-label="Learn Bane"')
  expect(learnOptions(rank1)).not.toContain('aria-label="Learn Aid"')
  expect(learnOptions(rank1)).not.toContain('aria-label="Learn Blur"')
  const rank2 = learnOptions(renderAtDirgeRank(c, entries, 2))
  expect(rank2).toMatch(/aria-label="Learn Blindness"[\s\S]*aria-label="Learn Blur"/)
  expect(learnOptions(renderAtDirgeRank(c, entries, 3))).toContain('aria-label="Learn Slow"')
  expect(learnOptions(renderAtDirgeRank(c, entries, 10))).not.toContain('aria-label="Learn Slow"')
  expect(learnOptions(renderAtDirgeRank(c, entries, 2, 'blu'))).toContain('aria-label="Learn Blur"')
  expect(learnOptions(renderAtDirgeRank(c, entries, 2, 'blu'))).not.toContain('aria-label="Learn Blindness"')
})

it('learns accessible, current-rank occult spells rather than granting the entire tradition', () => {
  const entries = [spell('Fear'), spell('Rare Magic', 1, 'Occult', ['Rare']),
    spell('Harm', 1, 'Divine'), spell('Arcane Only', 1, 'Arcane'), spell('Higher Rank', 2),
    { ...spell('Restricted Magic'), data: { tradition: 'Occult', access: 'Kellid ethnicity' } }]
  const html = renderAtDirgeRank(base, entries, 1)
  const learn = learnOptions(html)
  expect(learn).toContain('aria-label="Learn Fear"')
  expect(learn).toContain('aria-label="Learn Rare Magic"')
  for (const name of ['Harm', 'Arcane Only', 'Higher Rank', 'Restricted Magic']) expect(learn).not.toContain(`aria-label="Learn ${name}"`)
  expect(learnOptions(renderAtDirgeRank({ ...base, ethnicity: 'Kellid' }, entries, 1))).toContain('aria-label="Learn Restricted Magic"')
})

it('adds spells with inline plus buttons without opening another picker', () => {
  const fear = spell('Fear')
  const bane = spell('Bane')
  const learned: string[] = []
  const tree = DirgeLearnOptions({ options: [bane, fear], onLearn: entry => learned.push(entry.name) })
  const buttons: Array<() => void> = []
  const visit = (node: ReactNode) => Children.forEach(node, child => {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) return
    if (child.type === 'button' && child.props.onClick) buttons.push(child.props.onClick)
    visit(child.props.children)
  })
  visit(tree)
  buttons.forEach(click => click())
  expect(learned).toEqual(['Bane', 'Fear'])
  const html = renderToStaticMarkup(tree)
  expect(html).not.toContain('role="dialog"')
  expect(html).toContain('aria-label="Learn Bane"')
  expect(html).toContain('aria-label="Learn Fear"')
  expect(html).toContain('aria-haspopup="dialog">Bane</button>')
  expect(html).toContain('aria-haspopup="dialog">Fear</button>')
})

it('keeps the Dirge editor open when a nested spell description closes', () => {
  const setOpen = vi.fn()
  vi.mocked(useState).mockReturnValueOnce(['class', vi.fn()]).mockReturnValueOnce(['', vi.fn()])
    .mockReturnValueOnce([undefined, vi.fn()]).mockReturnValueOnce([true, setOpen])
    .mockReturnValueOnce([1, vi.fn()]).mockReturnValueOnce(['fear', vi.fn()])
  vi.mocked(useMemo).mockImplementation(fn => fn())
  vi.mocked(useRef).mockReturnValue({ current: null })
  vi.mocked(useId).mockReturnValue('dirge')
  try {
    const tree = SpellsContent({ c: base, entries: [spell('Fear')], save: () => {} })
    let close: ((event: { target: object; currentTarget: object }) => void) | undefined
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<{ className?: string; onClose?: typeof close; children?: ReactNode }>(child)) return
      if (child.type === 'dialog' && child.props.className === 'entry-dialog dirge-dialog') close = child.props.onClose
      visit(child.props.children)
    })
    visit(tree)
    expect(close).toBeDefined()
    const dirge = {}
    close!({ target: {}, currentTarget: dirge })
    expect(setOpen).not.toHaveBeenCalled()
    close!({ target: dirge, currentTarget: dirge })
    expect(setOpen).toHaveBeenCalledWith(false)
  } finally {
    vi.mocked(useMemo).mockReset()
    vi.mocked(useRef).mockReset()
    vi.mocked(useId).mockReset()
    vi.mocked(useState).mockReset()
  }
})

it('offers Bone Shield activation from its prepared slot', () => {
  const bone = { ...spell('Bone Shield'), data: { tradition: 'Occult', actions: 'Single Action' } }
  const c: Character = { ...base, spells: [{ name: bone.name, entryId: bone.id, rank: 1, cantrip: false }],
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 1, slots: {}, prepared: { '1:0': bone.id } } }
  const html = render(c, [bone, spell('Harm', 1, 'Divine')])
  expect(html).toContain('aria-label="Bone Shield options"')
  expect(html).toContain('aria-label="Bone Shield active"')
  expect(html).toContain('aria-label="Single Action"')
})

it('retains and heightens legacy dirge selections without mutating saved manual settings', () => {
  const fear = { ...spell('Fear'), id: 'canonical-fear' }
  const c: Character = { ...base, level: 7, spells: [{ name: 'Fear', rank: 1, cantrip: false }],
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 4, slots: { 1: 9, 10: 5 },
      prepared: { '4:0': 'Fear', '10:0': 'Dormant' }, spentSlots: ['4:0', '10:0'] } }
  const before = JSON.stringify(c)
  const html = render(c, [fear])
  expect(html).toContain('aria-label="Clear Fear spell slot"')
  expect(html).toContain('disabled="" aria-label="Cast spell slot rank 4 slot 1"')
  expect(html).toContain('aria-label="Reset class spell slots"')
  expect(html).not.toContain('Spell Rank 10 slot')
  expect(JSON.stringify(c)).toBe(before)
})

it.each([[6, 3, 3], [7, 4, 2], [18, 9, 3], [19, 9, 3], [20, 9, 3]])(
  'prepares Summon Undead in one locked Conjurer slot at level %i', (level, rank, count) => {
    const c: Character = { ...base, level, fatalMethod: 'Puppeteer', feats: [taken('Conjurer of Corpses', 6)],
      spellcasting: { ability: 'int', tradition: 'Occult', rank: 1, slots: {}, spentSlots: ['conjurer-of-corpses'] } }
    const summon = spell('Summon Undead', 1, 'Arcane, Divine, Occult')
    const entries = [summon, spell('Fear')]
    expect(necromancerConjurerRank(c)).toBe(rank)
    expect(classSpellSlots(c)?.[rank]).toBe(count)
    expect(classSpellSlots(c)?.[10]).toBe(level >= 19 ? 1 : undefined)
    expect(necromancerDirge(c, entries)).toEqual([summon])
    expect(knowsSpell(c, entries, summon.name)).toBe(true)
    const html = render(c, entries)
    expect(html).toContain('title="Conjurer of Corpses"')
    expect(html).not.toContain('aria-label="Clear Summon Undead spell slot"')
    expect(html).toContain(`disabled="" aria-label="Cast spell slot rank ${rank} slot ${count}"`)
  },
)

it('does not activate Conjurer for unselected, future, or mismatched method feats', () => {
  const c: Character = { ...base, level: 6, fatalMethod: 'Puppeteer', feats: [taken('Conjurer of Corpses', 6)] }
  const characters: Character[] = [{ ...c, level: 5 }, { ...c, feats: [] }, { ...c, feats: [taken('Conjurer of Corpses', 8)] },
    { ...c, fatalMethod: 'Reaper' }, { ...c, className: 'Wizard' }]
  for (const character of characters) {
    expect(necromancerConjurerRank(character)).toBeUndefined()
    expect(knowsSpell(character, [], 'Summon Undead')).toBe(false)
  }
})

it('treats the imported Conjurer grant as a learned spell, not an innate or grave focus spell', () => {
  const conjurer = mapAonHit({ _id: 'conjurer', _source: {
    name: 'Conjurer of Corpses', category: 'feat', level: 6, trait: ['Necromancer'],
    markdown: '**Prerequisites** [puppeteer fatal method](/FatalMethods.aspx?ID=1)\n\n---\n\n'
      + 'You learn the [_summon undead_](/Spells.aspx?ID=1706) spell. '
      + 'You gain an additional spell slot each day at your highest level of necromancer spell slots. '
      + 'You can prepare only the _summon undead_ spell in this slot.',
  } }, 'pf2e')!
  const c: Character = { ...base, level: 6, fatalMethod: 'Puppeteer', feats: [taken(conjurer.name, 6)] }
  const summon = spell('Summon Undead')
  expect(necromancerDirge(c, [conjurer, summon])).toEqual([summon])
  expect(focusSpells(c, [conjurer, summon])).toMatchObject({ points: 1 })
  expect(focusSpells(c, [conjurer, summon]).spells).not.toContainEqual(expect.objectContaining({ name: summon.name }))
  expect(render(c, [conjurer, summon])).toContain('title="Conjurer of Corpses"')
})

it.each([
  ['Conjurer of Corpses', 6, 'Puppeteer'],
  ['Beckoning Dirge', 16, 'Puppeteer'],
  ['Bind Heroic Spirit', 6, 'Reaper'],
] as const)('automatically checks %s against Fatal Method independently of Grim Fascination', (name, level, method) => {
  const feat: ContentEntry = { ...spell(name), kind: 'feat', level: Number(level), traits: ['Necromancer'],
    data: { prerequisite: `${String(method).toLowerCase()} fatal method` } }
  const c: Character = { ...base, level, subclass: 'Bone', fatalMethod: method }
  const slot = { key: `class:${level}:0`, category: 'class' as const, level: Number(level) }
  expect(featPrerequisiteChecker(c, [feat])(feat)).toEqual({ missing: [], manual: [] })
  expect(eligibleFeats([feat], c, slot)).toContain(feat)
  const characters: Character[] = [{ ...c, fatalMethod: undefined, subclass: method },
    { ...c, fatalMethod: method === 'Reaper' ? 'Puppeteer' : 'Reaper' }, { ...c, className: 'Wizard' }]
  for (const character of characters) {
    expect(featPrerequisiteChecker(character, [feat])(feat)).toEqual({ missing: [feat.data.prerequisite], manual: [] })
    expect(eligibleFeats([feat], character, slot)).not.toContain(feat)
  }
})

it.each([[1, 1, 1], [11, 2, 1], [13, 2, 2], [20, 2, 2]])(
  'applies Reaper martial weapon and medium armor proficiency at level %i', (level, martial, medium) => {
    const c: Character = { ...base, level, fatalMethod: 'Reaper' }
    expect(weaponRanks(c, []).Martial).toBe(martial)
    expect(armorRanks(c, []).Medium).toBe(medium)
    expect(weaponRanks({ ...c, fatalMethod: 'Puppeteer' }, []).Martial).toBe(0)
    expect(armorRanks({ ...c, className: 'Wizard' }, []).Medium).toBe(0)
  },
)

it.each([
  ['Become as Spirit', 'Spirit'],
  ['Reinforced Skeleton', 'Bone'],
  ['Sanguine Mastery', 'Blood'],
  ['Thick Skin', 'Flesh'],
])('checks %s against the selected grim fascination', (name, fascination) => {
  const feat: ContentEntry = { ...spell(name), kind: 'feat', level: 12, traits: ['Necromancer'],
    data: { prerequisite: `${fascination.toLowerCase()} grim fascination` } }
  const slot = { key: 'class:12:0', category: 'class' as const, level: 12 }
  const c: Character = { ...base, level: 12, subclass: fascination }
  expect(featPrerequisiteChecker(c, [feat])(feat)).toEqual({ missing: [], manual: [] })
  expect(eligibleFeats([feat], c, slot)).toContain(feat)
  for (const other of [undefined, 'Other']) {
    const character = { ...c, subclass: other }
    expect(featPrerequisiteChecker(character, [feat])(feat).missing).toEqual([feat.data.prerequisite])
    expect(eligibleFeats([feat], character, slot)).not.toContain(feat)
  }
  expect(featPrerequisiteChecker({ ...c, className: 'Wizard' }, [feat])(feat).missing).toEqual([feat.data.prerequisite])
})

it('keeps Fatal Methods out of the Grim Fascination picker', () => {
  const methods: ContentEntry[] = ['Puppeteer', 'Reaper'].map(name => ({
    ...spell(name), kind: 'subclass', data: { class: 'Necromancer', subclass_type: 'fatal-method' },
  }))
  const bone: ContentEntry = { ...spell('Bone'), kind: 'subclass', data: { class: 'Necromancer' } }
  expect(subclassOptions(base, [...methods, bone])).toEqual([bone])
})

it.each([[10, ['Grisly Growths']], [12, ['Grisly Growths']], [13, ['Execute', 'Grisly Growths']],
  [15, ['Desiccate', 'Execute', 'Grisly Growths']], [17, ['Desiccate', 'Execute', 'Grisly Growths', 'Massacre']]])(
  'adds Expanded Necromancy spells to the occult dirge at level %i', (level, names) => {
    const c: Character = { ...base, level: Number(level), feats: [taken('Expanded Necromancy', 10)] }
    const entries = [spell('Grisly Growths', 5, 'Primal'), spell('Execute', 7, 'Divine'),
      spell('Desiccate', 8, 'Primal'), spell('Massacre', 9, 'Arcane')]
    expect(necromancerDirge(c, entries).map(entry => entry.name)).toEqual(names)
    expect(necromancerDirge({ ...c, feats: [] }, entries)).toEqual([])
    expect(necromancerDirge({ ...c, level: 9 }, entries)).toEqual([])
    for (const name of names) expect(knowsSpell(c, entries, String(name))).toBe(true)
  },
)

it('keeps Conjurer and Unholy Resurrection slots independent and capped below Epitaph rank', () => {
  const c: Character = { ...base, level: 20, fatalMethod: 'Puppeteer', feats: [
    taken('Conjurer of Corpses', 6), taken('Unholy Resurrection', 14), taken('Mortem Ultimatum', 20),
  ], spellcasting: { ability: 'int', tradition: 'Occult', rank: 4, slots: {},
    spentSlots: ['conjurer-of-corpses'] } }
  const entries = [spell('Summon Undead'), spell('Raise Dead', 6, 'Divine')]
  expect(classSpellSlots(c)?.[9]).toBe(4)
  expect(classSpellSlots(c)?.[10]).toBe(2)
  expect(necromancerExtraSlots(c).map(slot => [slot.key, slot.rank, slot.spell])).toEqual([
    ['conjurer-of-corpses', 9, 'Summon Undead'], ['unholy-resurrection', 9, 'Raise Dead'],
  ])
  expect(necromancerDirge(c, entries)).toEqual([entries[1], entries[0]])
  const html = render(c, entries)
  expect(html).toContain('title="Conjurer of Corpses"')
  expect(html).toContain('title="Unholy Resurrection"')
  expect(html).toContain('disabled="" aria-label="Cast spell slot rank 9 slot 3"')
  expect(html).not.toContain('disabled="" aria-label="Cast spell slot rank 9 slot 4"')
  expect(necromancerExtraSlots({ ...c, sanctification: 'Holy' })).toHaveLength(1)
  expect(necromancerDirge({ ...c, level: 13 }, entries)).toEqual([entries[0]])
})

it('does not show a separate Beckoning Dirge control in spells or alter saved state', () => {
  const c: Character = { ...base, level: 16, fatalMethod: 'Puppeteer', feats: [taken('Beckoning Dirge', 16)],
    spells: [{ name: 'Fear', rank: 1, cantrip: false, entryId: 'Fear' }],
    spellcasting: { ability: 'int', tradition: 'Occult', rank: 3, slots: {},
      prepared: { '1:0': 'Harm' }, spentSlots: ['1:0'] },
    beckoningDirge: { spell: 'Fear', rank: 7 } }
  const before = JSON.stringify(c)
  const html = render(c, [spell('Fear')])
  expect(html).not.toContain('aria-label="Cast Beckoning Dirge"')
  expect(html).not.toContain('aria-label="Beckoning Dirge spell"')
  expect(JSON.stringify(c)).toBe(before)
  expect(beckoningDirgeMaxRank({ ...c, level: 19 })).toBe(9)
  expect(beckoningDirgeMaxRank({ ...c, fatalMethod: 'Reaper' })).toBeUndefined()
  expect(beckoningDirgeMaxRank({ ...c, level: 15 })).toBeUndefined()
})
