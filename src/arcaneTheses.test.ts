import { expect, it, onTestFinished } from 'vitest'
import { featChoiceOptions, eligibleFeats, plannedSlots } from './builder'
import { familiarSelection } from './familiarAbilities'
import { getSettings, updateSettings } from './settings'
import { hasArcaneThesis, VERSATILE_THESIS_FEAT } from './arcaneTheses'
import type { Character, ContentEntry } from './types'

it('offers only unused theses as repeatable high-level Wizard feat variants', () => {
  const previous = getSettings()
  onTestFinished(() => updateSettings(previous))
  updateSettings({ wizardVersatileThesis: true })
  const c: Character = { id: 'wizard', name: 'Test', systems: ['pf2e'], className: 'Wizard', level: 20,
    arcaneThesis: 'Spell Blending', abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Versatile Thesis', type: 'Class Feat', level: 16, slot: 'class:16:0', choice: 'Staff Nexus' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const entries = [VERSATILE_THESIS_FEAT]
  const slot = { key: 'class:18:0', category: 'class' as const, level: 18 }
  expect(featChoiceOptions('Versatile Thesis', c, entries, slot.key)).toEqual([
    'Improved Familiar Attunement', 'Metamagical Experimentation', 'Spell Substitution',
  ])
  expect(featChoiceOptions('Versatile Thesis', c, entries, 'class:16:0')).toContain('Staff Nexus')
  expect(eligibleFeats(entries, c, slot)).toContain(VERSATILE_THESIS_FEAT)
  expect(eligibleFeats(entries, c, { ...slot, key: 'class:14:0', level: 14 })).not.toContain(VERSATILE_THESIS_FEAT)
  const all = { ...c, feats: [...c.feats, ...['Improved Familiar Attunement', 'Metamagical Experimentation', 'Spell Substitution']
    .map(choice => ({ name: 'Versatile Thesis', type: 'Class Feat', level: 18, choice }))] }
  expect(eligibleFeats(entries, all, { ...slot, key: 'class:20:0', level: 20 })).not.toContain(VERSATILE_THESIS_FEAT)
  expect(eligibleFeats(entries, { ...c, className: 'Ranger' }, slot)).not.toContain(VERSATILE_THESIS_FEAT)
  updateSettings({ wizardVersatileThesis: false })
  expect(eligibleFeats(entries, c, slot)).not.toContain(VERSATILE_THESIS_FEAT)
  expect(hasArcaneThesis(c, 'Staff Nexus')).toBe(false)
  expect(hasArcaneThesis(c, 'Spell Blending')).toBe(true)
})

it('activates extra thesis benefits only at the feat level and grants the correct metamagic slot', () => {
  const previous = getSettings()
  onTestFinished(() => updateSettings(previous))
  updateSettings({ wizardVersatileThesis: true })
  const c: Character = { id: 'wizard', name: 'Test', systems: ['pf2e'], className: 'Wizard', level: 16,
    arcaneThesis: 'Spell Blending', abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Versatile Thesis', type: 'Class Feat', level: 16, slot: 'class:16:0', choice: 'Improved Familiar Attunement' },
      { name: 'Versatile Thesis', type: 'Class Feat', level: 18, slot: 'class:18:0', choice: 'Metamagical Experimentation' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  expect(familiarSelection(c).familiar).toBe(true)
  expect(familiarSelection(c).dailyAbilityLimit).toBe(5)
  expect(familiarSelection({ ...c, level: 15 }).familiar).toBe(false)
  expect(plannedSlots(c).some(slot => slot.grantedBy === 'Versatile Thesis')).toBe(false)
  const advanced = { ...c, level: 18 }
  const slot = plannedSlots(advanced).find(slot => slot.grantedBy === 'Versatile Thesis')!
  expect(slot).toMatchObject({ level: 18, maxFeatLevel: 1 })
  const makeFeat = (name: string, level: number, traits: string[]): ContentEntry => ({
    id: name, name, level, traits: ['Wizard', ...traits], systems: ['pf2e'], kind: 'feat',
    source: 'official', description: '', data: {}, effects: [], updatedAt: 0,
  })
  const feats = [makeFeat('Metamagic Test', 1, ['Metamagic']), makeFeat('Spellshape Test', 1, ['Spellshape']),
    makeFeat('Other Test', 1, []), makeFeat('High Test', 2, ['Metamagic'])]
  expect(eligibleFeats(feats, advanced, slot).map(feat => feat.name)).toEqual(['Metamagic Test', 'Spellshape Test'])
  updateSettings({ wizardVersatileThesis: false })
  expect(familiarSelection(advanced).familiar).toBe(false)
  expect(plannedSlots(advanced).some(item => item.grantedBy === 'Versatile Thesis')).toBe(false)
})
