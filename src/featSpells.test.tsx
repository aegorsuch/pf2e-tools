import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { mapAonHit } from './aon'
import { parseFeatSpellGrants } from './aonQuery'
import { classSpellcasting, focusSpells, knowsSpell } from './builder'
import { grantedWardenSpells } from './featChoices'
import { dailyInnateUses, featSpellOptions, grantedFeatSpells } from './featSpells'
import { InnateSpellUses, ResetDailyInnateUses, SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'

const base: Character = {
  id: 'c', systems: ['pf2e', 'sf2e'], name: 'Test', level: 5, className: 'Fighter',
  abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 16, cha: 14 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const entry = (name: string, kind: ContentEntry['kind'], data: ContentEntry['data'] = {}, traits: string[] = []): ContentEntry =>
  ({ id: name, systems: ['pf2e', 'sf2e'], name, kind, data, traits, level: 1, source: 'official', description: '', effects: [], updatedAt: 1 })
const feat = (name: string, markdown: string, level = 1) => mapAonHit({
  _id: name, _source: { name, category: 'feat', level, markdown: `Header\n\n---\n\n${markdown}` },
}, 'pf2e')!
const taken = (name: string, level = 1, choice?: string) => ({ name, type: 'Ancestry Feat', level, choice })

function findUseButton(node: ReactNode, label: string): { disabled?: boolean; onClick: () => void } | undefined {
  let found: { disabled?: boolean; onClick: () => void } | undefined
  Children.forEach(node, child => {
    if (found || !isValidElement<{ children?: ReactNode; 'aria-label'?: string; disabled?: boolean; onClick: () => void }>(child)) return
    if (child.type === 'button' && (child.props['aria-label'] === label || child.props.children === label)) found = child.props
    else found = findUseButton(child.props.children, label)
  })
  return found
}

it('persists spent daily uses, blocks overspending, undoes use and resets without ending active spells', () => {
  const source = feat('Daily Magic', 'You can cast [invisibility](/Spells.aspx?ID=1) as a 2nd-rank arcane innate spell twice per day.')
  const entries = [source, entry('Invisibility', 'spell')]
  let c: Character = { ...base, feats: [taken(source.name)], activeSpells: ['Invisibility'],
    innateSpellUses: { 'another pool': 1 } }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const grant = () => grantedFeatSpells(c, entries)[0]
  const tree = () => InnateSpellUses({ c, save, grant: grant() })
  const use = () => findUseButton(tree(), 'Use Invisibility (Daily Magic)')!
  const undo = () => findUseButton(tree(), 'Undo use of Invisibility (Daily Magic)')!
  expect(undo().disabled).toBe(true)
  undo().onClick()
  expect(dailyInnateUses(c, grant())?.used).toBe(0)
  use().onClick()
  expect(dailyInnateUses(c, grant())).toMatchObject({ used: 1, remaining: 1 })
  expect(c.innateSpellUses?.['another pool']).toBe(1)
  use().onClick()
  expect(use().disabled).toBe(true)
  use().onClick()
  expect(dailyInnateUses(c, grant())).toMatchObject({ used: 2, remaining: 0 })
  expect(renderToStaticMarkup(tree())).toContain('0/2 uses remaining')
  undo().onClick()
  expect(dailyInnateUses(c, grant())).toMatchObject({ used: 1, remaining: 1 })
  findUseButton(ResetDailyInnateUses({ c, save }), 'Reset daily innate uses')!.onClick()
  expect(dailyInnateUses(c, grant())).toMatchObject({ used: 0, remaining: 2 })
  expect(c.innateSpellUses).toEqual({})
  expect(c.activeSpells).toEqual(['Invisibility'])
  expect(findUseButton(ResetDailyInnateUses({ c, save }), 'Reset daily innate uses')!.disabled).toBe(true)
})

it('shares alternative daily spells but keeps each-spell and different-source pools independent', () => {
  const shared = feat('Shared Magic', 'Once per day, you can cast either [calm emotions](/Spells.aspx?ID=1) or [sanctuary](/Spells.aspx?ID=2) as an innate occult spell.')
  const separate = feat('Separate Magic', 'You can cast [calm emotions](/Spells.aspx?ID=1) and [sanctuary](/Spells.aspx?ID=2) as occult innate spells once per day each.')
  const entries = [shared, separate, entry('Calm Emotions', 'spell'), entry('Sanctuary', 'spell')]
  let c: Character = { ...base, feats: [taken(shared.name), taken(separate.name)] }
  const grants = grantedFeatSpells(c, entries)
  expect(grants).toHaveLength(4)
  const [first, alternative, independent, otherIndependent] = grants
  const uses = dailyInnateUses(c, first)!
  c = { ...c, innateSpellUses: { [uses.key]: 1 } }
  expect(dailyInnateUses(c, alternative)).toMatchObject({ key: uses.key, remaining: 0 })
  expect(dailyInnateUses(c, independent)?.remaining).toBe(1)
  expect(dailyInnateUses(c, independent)?.key).not.toBe(dailyInnateUses(c, otherIndependent)?.key)
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />))
    .toContain('0/1 uses remaining (shared)')
})

it('does not track at-will or focus spells and retains uses across heightening and feat order changes', () => {
  const daily = feat('Daily Magic', 'You can cast [heal](/Spells.aspx?ID=1) as a divine innate spell once per day. This spell is heightened to half your level, rounded up.')
  const atWill = feat('Unlimited Magic', 'You can cast [light](/Spells.aspx?ID=2) as an arcane innate spell at will.')
  const focus = feat('Focus Magic', 'You gain [fire ray](/Spells.aspx?ID=3) as a focus spell.')
  const entries = [daily, atWill, focus, entry('Heal', 'spell'), entry('Light', 'spell'), entry('Fire Ray', 'spell', {}, ['Focus'])]
  let c: Character = { ...base, feats: [taken(daily.name), taken(atWill.name), taken(focus.name)] }
  const grants = grantedFeatSpells(c, entries)
  expect(dailyInnateUses(c, grants[1])).toBeUndefined()
  expect(dailyInnateUses(c, grants[2])).toBeUndefined()
  expect(InnateSpellUses({ c, grant: grants[1], save: () => {} })).toBeNull()
  const uses = dailyInnateUses(c, grants[0])!
  c = JSON.parse(JSON.stringify({ ...c, level: 10, feats: [...c.feats].reverse(), innateSpellUses: { [uses.key]: 1 } }))
  const heightened = grantedFeatSpells(c, entries).find(grant => grant.source === daily.name)!
  expect(heightened.rank).toBe(5)
  expect(dailyInnateUses(c, heightened)).toMatchObject({ key: uses.key, used: 1, remaining: 0 })
})

it('grants Forgotten in the Crowd rank-two Invisibility and doubles its frequency only with active Face in the Crowd', () => {
  const source = feat('Forgotten in the Crowd',
    'You can leverage your forgettable appearance to escape your pursuers. You gain _[invisibility](/spells/165-invisibility)_ as a 2nd-rank arcane innate spell once per day, targeting yourself only.\n\n**Special** If you have the [Face in the Crowd](/feats/800-face-in-the-crowd) skill feat, you can cast _[invisibility](/spells/165-invisibility)_ twice per day instead of once per day.', 9)
  const data = [source, { ...entry('Invisibility', 'spell'), level: 2 }]
  const c = { ...base, level: 9, feats: [taken(source.name, 9)] }
  expect(grantedFeatSpells(c, data)).toMatchObject([{ rank: 2, rule: { tradition: 'arcane', frequency: 'once per day' } }])
  const uses = dailyInnateUses(c, grantedFeatSpells(c, data)[0])!
  const spent = { ...c, innateSpellUses: { [uses.key]: 1 } }
  expect(dailyInnateUses(spent, grantedFeatSpells(spent, data)[0])?.remaining).toBe(0)
  const enhanced = { ...c, feats: [...c.feats, taken('Face in the Crowd', 1)] }
  expect(dailyInnateUses({ ...enhanced, innateSpellUses: spent.innateSpellUses }, grantedFeatSpells(enhanced, data)[0]))
    .toMatchObject({ key: uses.key, used: 1, limit: 2, remaining: 1 })
  expect(grantedFeatSpells(enhanced, data)).toMatchObject([{ rank: 2, rule: { frequency: 'twice per day' } }])
  expect(renderToStaticMarkup(<SpellsSection c={enhanced} entries={data} save={() => {}} />))
    .toContain('rank 2 arcane; twice per day')
  expect(grantedFeatSpells({ ...enhanced, level: 20 }, data)[0].rank).toBe(2)
  expect(grantedFeatSpells({ ...c, feats: [...c.feats, taken('Face in the Crowd', 10)] }, data)[0].rule.frequency).toBe('once per day')
  expect(grantedFeatSpells({ ...c, level: 8 }, data)).toEqual([])
  expect(grantedFeatSpells(c, data)[0].rule.frequency).toBe('once per day')
  expect(source.spellGrants?.[0].frequency).toBe('once per day')
})

it('grants Empathetic Connection Mindlink at its fixed rank, with scaling innate DC and source restrictions', () => {
  const grant = feat('Empathetic Connection', 'You gain _[mindlink](/spells/188-mindlink)_ as a 1st-rank occult innate spell at-will. The target is temporarily immune for 24 hours.', 5)
  const entries = [grant, entry('Mindlink', 'spell')]
  const character = { ...base, feats: [taken(grant.name, 5)] }
  const spells = grantedFeatSpells(character, entries)
  expect(spells).toMatchObject([{ entry: { name: 'Mindlink' }, rank: 1, rule: { frequency: 'at will', tradition: 'occult' } }])
  const render = (c: Character) => renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(render(character)).toContain('Charisma DC 19, Attack +9')
  expect(render({ ...character, level: 12 })).toContain('Charisma DC 28, Attack +18')
  expect(render(character)).toContain('target is temporarily immune for 24 hours')
  expect(render(character)).not.toContain('Slots per rank')
  expect(grantedFeatSpells({ ...character, level: 4 }, entries)).toEqual([])
  expect(knowsSpell(character, entries, 'Mindlink')).toBe(true)
  expect(knowsSpell({ ...character, feats: [] }, entries, 'Mindlink')).toBe(false)
})

it('grants Imperious Nature Command at rank 7 with its actual DC rule', () => {
  const grant = feat('Imperious Nature', "Your legendary abilities inspire compliance. Once per day, you can cast _[command](/spells/43-command)_ as a 7th-rank occult innate spell using the higher of your class DC or  spell DC. This effect loses the linguistic trait.", 17)
  const entries = [grant, entry('Command', 'spell')]
  const c = { ...base, level: 17, feats: [taken(grant.name, 17)] }
  expect(grantedFeatSpells(c, entries)).toMatchObject([{ entry: { name: 'Command' }, rank: 7,
    rule: { tradition: 'occult', frequency: 'once per day', dc: 'higher-class-or-spell' } }])
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('rank 7 occult; once per day; use higher of class DC or spell DC')
  expect(markup).toContain('loses the linguistic trait')
  expect(grantedFeatSpells({ ...c, level: 16 }, entries)).toEqual([])
})

it('uses higher class spell proficiency for innate spells, without using the class attribute', () => {
  const grant = feat('Stonewalker', 'You can cast [_one with stone_](/Spells.aspx?ID=1619) as a 3rd-rank divine innate spell once per day.')
  const master = { ...entry('Master Spellcaster', 'classFeature', { class: 'Wizard' }), level: 15 }
  const entries = [grant, entry('One with Stone', 'spell'), entry('Wizard', 'class', { tradition: 'Arcane' }), master]
  const c = { ...base, className: 'Wizard', level: 15, feats: [taken(grant.name)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('rank 3 divine; once per day; Charisma DC 33, Attack +23')
  expect(grantedFeatSpells(c, entries)[0].rank).toBe(3)
})

it('requires a valid chosen cantrip and heightens only that choice', () => {
  const grant = feat('Otherworldly Magic', 'Choose one cantrip from the [arcane](/SpellLists.aspx?Tradition=1) spell list. You can cast this cantrip as an arcane innate spell at will.')
  const entries = [grant, entry('Light', 'spell', { tradition: 'Arcane, Divine' }, ['Cantrip']),
    entry('Primal Cantrip', 'spell', { tradition: 'Primal' }, ['Cantrip']),
    entry('Restricted Cantrip', 'spell', { tradition: 'Arcane' }, ['Cantrip', 'Rare']),
    entry('Ranked Spell', 'spell', { tradition: 'Arcane' })]
  const c = { ...base, feats: [taken(grant.name)] }
  expect(featSpellOptions(c, entries, c.feats[0])?.map(spell => spell.name)).toEqual(['Light'])
  expect(grantedFeatSpells(c, entries)).toEqual([])
  expect(grantedFeatSpells({ ...c, feats: [taken(grant.name, 1, 'Primal Cantrip')] }, entries)).toEqual([])
  expect(grantedFeatSpells({ ...c, feats: [taken(grant.name, 1, 'Light')] }, entries)).toMatchObject([{ rank: 3, entry: { name: 'Light' } }])
})

it('keeps cast-time alternatives on one shared daily grant and rejects conditional or variable grants', () => {
  const rules = parseFeatSpellGrants('Header\n\n---\n\nOnce per day, you can cast either [calm emotions](/Spells.aspx?ID=31) or [sanctuary](/Spells.aspx?ID=266) as an innate occult spell, heightened to half your level rounded up.')
  expect(rules).toMatchObject([{ spells: ['calm emotions', 'sanctuary'], shared: true, frequency: 'once per day', heightened: true }])
  expect(parseFeatSpellGrants('Header\n\n---\n\nWhile transformed, you can cast [fireball](/Spells.aspx?ID=119) as a 3rd-rank innate arcane spell once per day.')).toEqual([])
  expect(parseFeatSpellGrants('Header\n\n---\n\nYou can cast [fireball](/Spells.aspx?ID=119) as a 3rd-rank arcane innate spell once per day. It uses your class DC.')).toEqual([])
  expect(parseFeatSpellGrants('Header\n\n---\n\nYou can cast [guidance](/Spells.aspx?ID=100) as a primal innate spell at will while in a stance.')).toEqual([])
  expect(parseFeatSpellGrants('Header\n\n---\n\nYou can cast [mind reading](/Spells.aspx?ID=100) as an occult innate spell once per day. Use Intelligence if its modifier is higher than Charisma.')).toEqual([])
})

it('surfaces unresolved source spells rather than silently dropping their grants', () => {
  const grant = feat('Old Magic', 'You can cast [missing spell](/Spells.aspx?ID=1) as a 3rd-rank divine innate spell once per day.')
  const c = { ...base, feats: [taken(grant.name)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[grant]} save={() => {}} />)
  expect(markup).toContain('Spell data unavailable: missing spell')
  expect(markup).toContain('Review source rules; this spell is not automated.')
  expect(markup).toContain('aria-haspopup="dialog">Old Magic</button>')
})

it('retains cross-system spell links and scopes separately stated heightening to the named spell', () => {
  const rules = parseFeatSpellGrants('Header\n\n---\n\nYou can cast [augury](/Spells.aspx?ID=1) and [veil of privacy](https://2e.aonprd.com/Spells.aspx?ID=2) as occult innate spells once per day each. You can cast this veil of privacy spell only on an object, and it is heightened to half your level rounded up.')
  expect(rules).toMatchObject([{ spells: ['augury'], heightened: false }, { spells: ['veil of privacy'], heightened: true }])
  expect(parseFeatSpellGrants('Header\n\n---\n\nYou can cast [harm](/Spells.aspx?ID=3) as a divine innate spell once per day. This spell is heightened to half your level, rounded up.'))
    .toMatchObject([{ spells: ['harm'], heightened: true }])
})

it('grants explicit focus spells with source-specific attributes and caps pool by acquired spells', () => {
  const blessed = feat('Blessed One Dedication', 'You gain the [_lay on hands_](/Spells.aspx?ID=2047) devotion spell. Your devotion spells are divine spells. Your spellcasting attribute is Charisma.')
  const other = entry('Other Focus', 'feat', { grants_focus_spells: 'Other Spell, Third Spell' })
  const entries = [blessed, other, entry('Lay on Hands', 'spell', {}, ['Focus']), entry('Other Spell', 'spell', {}, ['Focus']), entry('Third Spell', 'spell', {}, ['Focus'])]
  const c = { ...base, feats: [taken(blessed.name), taken(other.name, 6)] }
  expect(focusSpells(c, entries)).toMatchObject({ points: 1, spells: [{ name: 'Lay on Hands' }] })
  expect(focusSpells({ ...c, level: 6 }, entries).points).toBe(3)
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Charisma DC 19, Attack +9')
  expect(markup).toContain('rank 3 divine')
})

it('grants only selected qi and domain spells, never linked alternatives or future selections', () => {
  const spells = [entry('Inner Upheaval', 'spell', {}, ['Focus', 'Monk']), entry('Qi Rush', 'spell', {}, ['Focus', 'Monk']),
    entry('Fire Ray', 'spell', { domain: 'Fire' }, ['Focus', 'Cleric']),
    { ...entry('Flame Barrier', 'spell', { domain: 'Fire' }, ['Focus', 'Cleric']), level: 4 }]
  const c = { ...base, feats: [taken('Qi Spells', 1, 'Qi Rush'), taken('Domain Initiate', 1, 'Fire'), taken('Advanced Domain', 8, 'Fire')] }
  expect(grantedFeatSpells(c, spells).map(grant => grant.entry.name)).toEqual(['Qi Rush', 'Fire Ray'])
  expect(grantedFeatSpells({ ...c, level: 8 }, spells).map(grant => grant.entry.name)).toEqual(['Qi Rush', 'Fire Ray', 'Flame Barrier'])
  const warden = { ...entry('Gravity Weapon', 'spell', { warden_spell_tier: 'Initiate' }), systems: ['pf2e'] as const }
  const entries: ContentEntry[] = [{ ...warden, systems: [...warden.systems] }]
  expect(grantedWardenSpells({ ...base, feats: [taken('Initiate Warden', 9, 'Gravity Weapon')] }, entries)).toEqual([])
  const choiceFeat = feat('Choose Focus', 'You gain either [inner upheaval](/Spells.aspx?ID=1) or [qi rush](/Spells.aspx?ID=2) as a focus spell.')
  expect(grantedFeatSpells({ ...base, feats: [taken(choiceFeat.name)] }, [choiceFeat, ...spells])).toEqual([])
  expect(grantedFeatSpells({ ...base, feats: [taken(choiceFeat.name, 1, 'Qi Rush')] }, [choiceFeat, ...spells])
    .map(grant => grant.entry.name)).toEqual(['Qi Rush'])
})

it.each(['Champion', 'Monk', 'Ranger'])('scales actual %s spell proficiency independently of armor ranks', className => {
  const expert = { ...entry(`${className} Expertise`, 'classFeature', { class: className }), level: 9,
    description: 'Your proficiency ranks for your class DC, spell attack modifier, and spell DC increase to expert.' }
  const master = { ...entry('Graceful Legend', 'classFeature', { class: className }), level: 17,
    description: 'Your proficiency rank for unarmored defense increases to legendary. Your proficiency in spell attacks and spell DCs increases to master.' }
  const entries = [expert, master]
  expect(classSpellcasting({ ...base, className, level: 8 }, entries)?.rank).toBe(1)
  expect(classSpellcasting({ ...base, className, level: 9 }, entries)?.rank).toBe(2)
  expect(classSpellcasting({ ...base, className, level: 17 }, entries)?.rank).toBe(3)
})
