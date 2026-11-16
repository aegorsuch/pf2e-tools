import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { maxHp, resistances, savingThrowBreakdown, senses } from './builder'
import { DIVINE_INTERCESSIONS, divineIntercessionWeaknesses, hasDivineIntercession } from './divineIntercessions'
import { DivineIntercessions } from './intercessionPicker'
import { SkillsSection } from './SkillsSection'
import type { Character, ContentEntry } from './types'

const character = (deity?: string, divineIntercessions?: Character['divineIntercessions']): Character => ({
  id: 'intercessions', systems: ['pf2e'], name: 'Test', level: 1, deity,
  divineIntercessions, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
})

const deity = (name: string): ContentEntry => ({
  id: name, systems: ['pf2e'], kind: 'deity', source: 'official', name, level: 0,
  traits: [], description: '', data: {}, effects: [], updatedAt: 0,
})

it('retains per-deity selections but applies the automated boon only for the current deity', () => {
  const c = character('Asmodeus', { Asmodeus: ['moderate-boon'], Erastil: ['minor-boon'] })
  expect(hasDivineIntercession(c, 'Asmodeus', 'moderate-boon')).toBe(true)
  expect(resistances(c, [])).toContainEqual({ damage: 'Fire', value: 5, source: 'Asmodeus (Moderate Boon)' })
  expect(senses(c, [])).toContainEqual({ value: 'Darkvision', source: 'Asmodeus (Moderate Boon)' })

  const changedDeity = { ...c, deity: 'Erastil' }
  expect(hasDivineIntercession(changedDeity, 'Asmodeus', 'moderate-boon')).toBe(false)
  expect(changedDeity.divineIntercessions?.Asmodeus).toContain('moderate-boon')
  expect(resistances(changedDeity, [])).toEqual([])
  expect(senses(changedDeity, [])).toEqual([])
})

it('derives Asmodeus’s unconditional fire weakness only while his minor curse is selected', () => {
  const c = character('Asmodeus', { Asmodeus: ['minor-curse'] })
  expect(divineIntercessionWeaknesses(c)).toEqual([
    { damage: 'Fire', value: 5, source: 'Asmodeus (Minor Curse)' },
  ])
  expect(divineIntercessionWeaknesses({ ...c, deity: 'Erastil' })).toEqual([])
  expect(divineIntercessionWeaknesses(character('Asmodeus'))).toEqual([])
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(defense).toContain('Weaknesses: Fire 5 (Asmodeus (Minor Curse))')
})

it('applies Asmodeus’s permanent drained 4 to maximum HP and Fortitude only', () => {
  const c = { ...character('Asmodeus', { Asmodeus: ['major-curse'] }), ancestry: 'Human', className: 'Fighter' }
  const entries: ContentEntry[] = [
    { ...deity('Human'), id: 'human', kind: 'ancestry', data: { hp: 8 } },
    { ...deity('Fighter'), id: 'fighter', kind: 'class', data: { hp: 8 } },
  ]
  expect(maxHp(c, entries)).toBe(maxHp({ ...c, divineIntercessions: undefined }, entries) - 4)
  expect(savingThrowBreakdown(c, entries, 'Fortitude').parts)
    .toContainEqual({ label: 'Asmodeus Major Curse: drained 4 (condition)', value: -4 })
  expect(savingThrowBreakdown(c, entries, 'Reflex').parts.some(part => part.label.includes('drained'))).toBe(false)
})

it('shows selectable intercessions with official source links and explicit unavailable states', () => {
  const markup = renderToStaticMarkup(<DivineIntercessions deity={deity('Torag')}
    selected={['major-boon']} onChange={() => {}} />)
  expect(markup).toContain('Major Boon')
  expect(markup).toContain('checked=""')
  expect(markup).toContain('Track only; apply this effect and its duration or conditions manually.')
  expect(markup).toContain('https://2e.aonprd.com/Deities.aspx?ID=294')

  for (const name of ['Green Faith', 'Lao Shu Po']) {
    const section = DIVINE_INTERCESSIONS[name]
    expect(section.unavailable).toMatch(/intercessions/)
    expect(renderToStaticMarkup(<DivineIntercessions deity={deity(name)} selected={[]} onChange={() => {}} />))
      .toContain(section.unavailable)
  }
})
