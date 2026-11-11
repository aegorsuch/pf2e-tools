import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { mapAonHit } from './aon'
import { FeatChoice } from './FeatChoice'
import { FeatSlots } from './FeatSlots'
import { SpellsSection } from './SpellsSection'
import { canSelectWardenFeat, compareFeatSelections, grantedWardenSpells, spellWardenLabel } from './featChoices'
import { eligibleFeats } from './builder'
import { classSpellcasting } from './builder'
import type { Character, ContentEntry } from './types'

const spell = (name: string, tier: string): ContentEntry => ({
  id: name, systems: ['pf2e'], kind: 'spell', source: 'official', name, level: tier === 'Initiate' ? 1 : 2,
  traits: ['Focus', 'Ranger'], description: '', data: { warden_spell_tier: tier }, effects: [], updatedAt: 1,
})
const entries = [spell('Gravity Weapon', 'Initiate'), spell('Heal Companion', 'Initiate'), spell('Animal Feature', 'Advanced')]
const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

function findSelect(node: ReactNode): { onChange: (event: { target: { value: string } }) => void } | undefined {
  let found: { onChange: (event: { target: { value: string } }) => void } | undefined
  Children.forEach(node, (child) => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'select') found = { onChange: child.props.onChange as (event: { target: { value: string } }) => void }
    else found = findSelect(child.props.children as ReactNode)
  })
  return found
}

it('imports repeatability from feat special rules without guessing from summaries', () => {
  const hit = { _id: 'feat-4862', _source: {
    name: 'Initiate Warden', category: 'feat', summary: 'You gain a spell.',
    markdown: '**Special** You can take this feat multiple times, choosing a different initial warden spell each time.',
  } }
  expect(mapAonHit(hit, 'pf2e')?.data.repeatable).toBe(true)
  expect(mapAonHit({ ...hit, _source: { ...hit._source, markdown: '**Special** You can take this ancestry feat multiple times.' } }, 'pf2e')?.data.repeatable).toBe(true)
  expect(mapAonHit({ ...hit, _source: { ...hit._source, markdown: '', summary: 'You can take this feat multiple times.' } }, 'pf2e')?.data.repeatable).toBe(false)
  expect(mapAonHit({ _source: { category: 'spell', name: 'Gravity Weapon', warden_spell_tier: 'Initiate' } }, 'pf2e')?.data.warden_spell_tier).toBe('Initiate')
})

it('selects distinct warden spells per feat and derives grants from current choices', () => {
  let c: Character = { ...base, feats: [
    { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:0' },
    { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:1' },
  ] }
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
  const first = findSelect(FeatChoice({ ...props(), index: 0 }))
  if (!first) throw new Error('Missing first spell selection')
  first.onChange({ target: { value: 'Gravity Weapon' } })
  expect(grantedWardenSpells(c, entries).map((s) => s.name)).toEqual(['Gravity Weapon'])
  const markup = renderToStaticMarkup(<FeatChoice {...props()} index={1} />)
  expect(markup).toContain('Heal Companion')
  expect(markup).not.toContain('Gravity Weapon')
  expect(markup).not.toContain('Animal Feature')
  const second = findSelect(FeatChoice({ ...props(), index: 1 }))
  if (!second) throw new Error('Missing second spell selection')
  second.onChange({ target: { value: 'Heal Companion' } })
  expect(grantedWardenSpells(c, entries).map((s) => s.name)).toEqual(['Gravity Weapon', 'Heal Companion'])
  c = { ...c, feats: c.feats.slice(1) }
  expect(grantedWardenSpells(c, entries).map((s) => s.name)).toEqual(['Heal Companion'])
})

it('hides another Warden feat when all distinct spells are chosen', () => {
  const allSpells = Array.from({ length: 3 }, (_, i) => spell(`Initiate ${i}`, 'Initiate'))
  const initiate: ContentEntry = {
    id: 'initiate', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Initiate Warden', level: 1,
    traits: ['Ranger'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }
  const choices = allSpells.map((s, i) => ({
    name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: `class:1:${i}`, choice: s.name,
  }))
  const c: Character = { ...base, feats: choices }
  expect(canSelectWardenFeat('Initiate Warden', c, [...allSpells, initiate])).toBe(false)
  expect(eligibleFeats([initiate], c, { key: 'class:1:3', category: 'class', level: 1 })).toEqual([])
  const almostFull = { ...c, feats: choices.slice(0, -1) }
  expect(eligibleFeats([initiate, ...allSpells], almostFull, { key: 'class:1:3', category: 'class', level: 1 }))
    .toContainEqual(initiate)
})

it('places Warden spell choices before add and remove slot controls', () => {
  const c: Character = {
    ...base,
    feats: [
      { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'Gravity Weapon' },
      { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:1', choice: 'Heal Companion' },
    ],
    extraSlots: [{ category: 'class', level: 1, count: 1 }],
  }
  const feat: ContentEntry = {
    id: 'initiate', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Initiate Warden', level: 1,
    traits: ['Ranger'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }
  const rows = [...renderToStaticMarkup(<FeatSlots c={c} entries={[feat, ...entries]} save={() => {}} categories={['class']} bare />)
    .matchAll(/<li class="feat-slot-row[^"]*">([\s\S]*?)<\/li>/g)].map((match) => match[1])
  const addRow = rows.find((row) => row.includes('aria-label="Add L01 Class feat slot"'))
  const removeRow = rows.find((row) => row.includes('aria-label="Remove L01 Class extra feat slot 1"'))
  expect(addRow).toBeDefined()
  expect(removeRow).toBeDefined()
  expect(addRow!.indexOf('class="feat-choice"')).toBeLessThan(addRow!.indexOf('aria-label="Add L01 Class feat slot"'))
  expect(removeRow!.indexOf('class="feat-choice"')).toBeLessThan(removeRow!.indexOf('aria-label="Remove L01 Class extra feat slot 1"'))
})

it('shows feat grants once without deleting independently added spells', () => {
  const c: Character = { ...base, feats: [{ name: 'Initiate Warden', type: 'Class Feat', level: 1, choice: 'Gravity Weapon' }],
    spells: [{ name: 'Gravity Weapon', rank: 1, cantrip: false, entryId: 'Gravity Weapon' }] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('<strong>Spells</strong><span>1 spells</span>')
  expect(markup).toContain('Gravity Weapon')
  expect(markup).toContain('<b>Initiate Warden</b>')
  expect(markup).not.toContain('Warden feat')
  expect((markup.match(/Gravity Weapon/g) ?? [])).toHaveLength(1)
  expect(grantedWardenSpells({ ...c, feats: [] }, entries)).toEqual([])
  expect(c.spells).toHaveLength(1)
})

it('shows action icons beside selected spells', () => {
  const c: Character = { ...base, spells: [{ name: 'Gravity Weapon', rank: 1, cantrip: false, entryId: 'Gravity Weapon' }] }
  const spellEntries = entries.map((entry) => entry.name === 'Gravity Weapon'
    ? { ...entry, data: { ...entry.data, actions: 'Single Action' } } : entry)
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={spellEntries} save={() => {}} />)
  expect(markup).toContain('aria-label="Single Action"')
})

it('labels Warden spells in spell listings by tier', () => {
  expect(spellWardenLabel('Initiate')).toBe('Initiate Warden')
  expect(spellWardenLabel('Advanced')).toBe('Advanced Warden')
  expect(spellWardenLabel('Master')).toBe('Master Warden')
  expect(spellWardenLabel('Peerless')).toBe('Peerless Warden')
  expect(spellWardenLabel(undefined)).toBeUndefined()
  const c: Character = { ...base, spells: [{ name: 'Gravity Weapon', rank: 1, cantrip: false, entryId: 'Gravity Weapon' }] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('<b>Initiate Warden</b>')
  expect(markup).not.toContain('<b>Rank 1</b>')
})

it('uses Warden tier headings without changing ordinary spell rank groups', () => {
  const spells = [
    spell('Gluttonous Growth', 'Peerless'),
    { ...spell('Ordinary Spell', ''), data: {}, level: 5 },
  ]
  const c: Character = { ...base, spells: spells.map((s) => ({ name: s.name, rank: 5, cantrip: false, entryId: s.id })) }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={spells} save={() => {}} />)
  expect(markup).toContain('<b>Peerless Warden</b>')
  expect(markup).toContain('<b>Rank 5</b>')
  expect(markup).not.toContain('(Peerless Warden)')
})

it('derives caster status, traditions and spell proficiency from class features', () => {
  const classes: ContentEntry[] = [
    { id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 1 },
    { id: 'wizard', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Wizard', level: 1, traits: [], description: '', data: { tradition: 'Arcane' }, effects: [], updatedAt: 1 },
    { id: 'witch', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Witch', level: 1, traits: [], description: '', data: { tradition: 'Arcane, Divine, Occult, Primal' }, effects: [], updatedAt: 1 },
    { id: 'expert', systems: ['pf2e'], kind: 'classFeature', source: 'official', name: 'Expert Spellcaster', level: 7, traits: [], description: '', data: { class: 'Wizard' }, effects: [], updatedAt: 1 },
    { id: 'master', systems: ['pf2e'], kind: 'classFeature', source: 'official', name: 'Master Spellcaster', level: 15, traits: [], description: '', data: { class: 'Wizard' }, effects: [], updatedAt: 1 },
  ]
  expect(classSpellcasting({ ...base, className: 'Ranger' }, classes)).toBeUndefined()
  expect(classSpellcasting({ ...base, className: 'Wizard', level: 1 }, classes)).toEqual({ traditions: ['Arcane'], rank: 1 })
  expect(classSpellcasting({ ...base, className: 'Wizard', level: 8 }, classes)).toEqual({ traditions: ['Arcane'], rank: 2 })
  expect(classSpellcasting({ ...base, className: 'Wizard', level: 15 }, classes)).toEqual({ traditions: ['Arcane'], rank: 3 })
  expect(classSpellcasting({ ...base, className: 'Witch' }, classes)?.traditions).toEqual(['Arcane', 'Divine', 'Occult', 'Primal'])
})

it('hides manual casting configuration for noncasters and collapses the spell section', () => {
  const ranger = { ...base, className: 'Ranger', spellcasting: { ability: 'wis' as const, tradition: '', rank: 1, slots: {} } }
  const classes: ContentEntry[] = [{
    id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1,
    traits: [], description: '', data: {}, effects: [], updatedAt: 1,
  }]
  const markup = renderToStaticMarkup(<SpellsSection c={ranger} entries={classes} save={() => {}} />)
  expect(markup).toContain('<details class="character-section">')
  expect(markup).toContain('<strong>Spells</strong><span>0 spells</span>')
  expect(markup).not.toContain('Casting ability')
  expect(markup).not.toContain('Slots per rank')
  expect(markup).not.toContain('Spellcasting Trained')
})

it('alphabetizes repeated feat selections by choice, leaving unchosen copies last', () => {
  const selections = [
    { name: 'Initiate Warden', choice: 'Heal Companion' },
    { name: 'Initiate Warden' },
    { name: 'Initiate Warden', choice: 'Gravity Weapon' },
  ]
  expect(selections.sort(compareFeatSelections).map((f) => f.choice)).toEqual(['Gravity Weapon', 'Heal Companion', undefined])
})

it('allows a text choice for other repeatable feats without granting an unrelated spell', () => {
  let c: Character = { ...base, feats: [{ name: 'Order Explorer', type: 'Class Feat', level: 2 }] }
  const feat: ContentEntry = {
    id: 'order', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Order Explorer', level: 2,
    traits: ['Druid'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }
  const tree = FeatChoice({ c, entries: [feat], index: 0, save: (patch) => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree)).toContain('Order Explorer choice')
  if (!isValidElement<{ children: ReactNode }>(tree)) throw new Error('Missing choice field')
  const field = Children.toArray(tree.props.children).find((child) => isValidElement(child) && child.type === 'input')
  if (!isValidElement<{ onBlur: (event: { target: { value: string } }) => void }>(field)) throw new Error('Missing choice input')
  field.props.onBlur({ target: { value: 'Leaf' } })
  expect(c.feats[0].choice).toBe('Leaf')
  expect(grantedWardenSpells(c, [feat])).toEqual([])
})
