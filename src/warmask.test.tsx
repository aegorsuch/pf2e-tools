import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { automaticFeatGrants, ranksAt, warmaskAlternateSkills } from './builder'
import { FeatChoice } from './FeatChoice'
import { dailyInnateUses, grantedFeatSpells } from './featSpells'
import { ArmorList } from './GearSection'
import { SkillsSection } from './SkillsSection'
import type { Character, ContentEntry } from './types'

const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Test', level: 5, ancestry: 'Orc',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [{ name: 'Orc Warmask', type: 'Ancestry Feat', level: 1, choice: 'The Gods' },
    { name: 'Mask of Power', type: 'Ancestry Feat', level: 5, choice: 'Fear' }],
  equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const spell: ContentEntry = {
  id: 'fear', name: 'Fear', kind: 'spell', systems: ['pf2e'], level: 1, source: 'official',
  traits: [], description: '', data: {}, effects: [], updatedAt: 0,
}

it('grants warmask training and feat, with an alternate when already trained', () => {
  expect(ranksAt(base, []).Religion).toBe(1)
  expect(automaticFeatGrants(base, [])).toContainEqual({ name: 'Dubious Knowledge', source: 'Orc Warmask', level: 1 })
  const c: Character = { ...base, skillPicks: ['Religion'], warmask: { alternateSkill: 'Nature' } }
  expect(warmaskAlternateSkills(c, [], 0)).toContain('Nature')
  expect(ranksAt(c, []).Nature).toBe(1)
  expect(ranksAt({ ...c, level: 0 }, []).Nature).toBeUndefined()
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[]} index={0} save={() => {}} />)).toContain('Alternate trained skill')
})

it('applies the worn and attuned bonus and preserves mask state while feat is inactive', () => {
  const c: Character = { ...base, warmask: { worn: true, attuned: true } }
  const html = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('+1 item bonus while worn and attuned')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, warmask: { ...c.warmask, worn: false } }} entries={[]} save={() => {}} />))
    .not.toContain('+1 item bonus while worn and attuned')
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)).toContain('Orc Warmask')
  expect(renderToStaticMarkup(<ArmorList c={{ ...c, level: 0 }} entries={[]} save={() => {}} />)).not.toContain('Orc Warmask')
  expect(c.warmask).toEqual({ worn: true, attuned: true })
})

it('grants the chosen daily spell at rank 1 with the warmask tradition and shared daily use', () => {
  const grant = grantedFeatSpells(base, [spell])[0]
  expect(grant).toMatchObject({ entry: { name: 'Fear' }, rank: 1,
    rule: { tradition: 'Divine', frequency: 'once per day', condition: 'Must be wearing your warmask' } })
  expect(dailyInnateUses(base, grant)?.limit).toBe(1)
  expect(grantedFeatSpells({ ...base, feats: base.feats.slice(1) }, [spell])).toEqual([])
  expect(grantedFeatSpells({ ...base, level: 4 }, [spell])).toEqual([])
})
