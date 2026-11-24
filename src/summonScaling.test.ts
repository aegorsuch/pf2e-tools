import { expect, it, onTestFinished } from 'vitest'
import { getSettings, updateSettings } from './settings'
import { scaledSummon } from './summonScaling'
import type { Character } from './types'
import type { SummonedFiend } from './summonedFiends'

it('scales only summons cast from innate spells while auto-heightening is enabled', () => {
  const previous = getSettings().innateAutoHeighten
  onTestFinished(() => updateSettings({ innateAutoHeighten: previous }))
  const creature: SummonedFiend = { id: 'fiend', name: 'Test', level: 2, traits: ['Large', 'Fiend'], url: '',
    abilities: [2, 4, 2, -3, 3, 2], hp: 35, ac: 18, saves: [8, 10, 11], perception: 9,
    senses: '', skills: 'Athletics +8, Stealth +8', speed: '40 feet',
    resistances: '', weaknesses: '', attacks: ['claw +10 (agile), — 1d6+2 slashing plus 1d4 mental'] }
  const c: Character = { id: 'c', name: 'Test', systems: ['pf2e'], level: 13,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    summonInnateRanks: { fiend: 5 } }
  updateSettings({ innateAutoHeighten: true })
  expect(scaledSummon(c, 'fiend', creature)).toMatchObject({ level: 9, hp: 160, ac: 28,
    perception: 19, saves: [18, 20, 21], skills: 'Athletics +19, Stealth +19',
    attacks: ['claw +20 (agile), — 1d6+14 slashing plus 1d4 mental'] })
  expect(scaledSummon({ ...c, summonInnateRanks: undefined }, 'fiend', creature)).toEqual(creature)
  expect(scaledSummon(c, 'undead', creature)).toEqual(creature)
  expect(scaledSummon(c, 'fiend', { ...creature, level: 12 })).toMatchObject({ level: 12, hp: 35 })
  updateSettings({ innateAutoHeighten: false })
  expect(scaledSummon(c, 'fiend', creature)).toEqual(creature)
})
