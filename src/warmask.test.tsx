import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { automaticFeatGrants, ranksAt, warmaskAlternateSkills } from './builder'
import { FeatChoice } from './FeatChoice'
import { dailyInnateUses, grantedFeatSpells } from './featSpells'
import { ArmorList, WarmaskGear } from './GearSection'
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
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[]} index={0} save={() => {}} />)).not.toContain('Alternate trained skill')
})

it('treats the warmask as always worn and attuned while the feat is active', () => {
  const c: Character = { ...base }
  const html = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('+1 item bonus while the feat is active; the mask is always worn and attuned.')
  expect(html).toContain('aria-label="Orc Warmask note"')
  expect(html).toContain('<span class="skill-part"><small>Item</small>+1</span>')
  const gear = renderToStaticMarkup(<WarmaskGear c={c} entries={[]} save={() => {}} />)
  expect(gear).not.toContain('Always worn and attuned while this feat is active')
  expect(gear).not.toContain('negligible Bulk')
  expect(gear).not.toContain('type="checkbox"')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, warmask: { worn: false, attuned: false } }} entries={[]} save={() => {}} />))
    .toContain('+1 item bonus while the feat is active; the mask is always worn and attuned.')
  expect(renderToStaticMarkup(<WarmaskGear c={{ ...c, level: 0 }} entries={[]} save={() => {}} />)).not.toContain('Orc Warmask')
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)).not.toContain('Orc Warmask')
})

it('uses the adopted-Orc Warmask label consistently without renaming the saved feat', () => {
  const c: Character = { ...base, ancestry: 'Human', feats: [
    ...base.feats, { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' },
  ] }
  expect(renderToStaticMarkup(<WarmaskGear c={c} entries={[]} save={() => {}} />))
    .toContain('aria-haspopup="dialog">Warmask</button>')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} />))
    .toContain('aria-label="Warmask note"')
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[]} index={0} save={() => {}} />))
    .toContain('aria-label="Warmask power source"')
  expect(c.feats[0].name).toBe('Orc Warmask')
})

it('grants the chosen daily spell at rank 1 with the warmask tradition and shared daily use', () => {
  const grant = grantedFeatSpells(base, [spell])[0]
  expect(grant).toMatchObject({ entry: { name: 'Fear' }, rank: 1,
    rule: { tradition: 'Divine', frequency: 'once per day', condition: 'Must be wearing your warmask' } })
  expect(dailyInnateUses(base, grant)?.limit).toBe(1)
  expect(grantedFeatSpells({ ...base, feats: base.feats.slice(1) }, [spell])).toEqual([])
  expect(grantedFeatSpells({ ...base, level: 4 }, [spell])).toEqual([])
})

it.each([['The Land', 'Primal', 'Nature'], ['Magic', 'Arcane', 'Arcana']])(
  'personalizes equipment details for %s without changing shared feat rules', (choice, tradition, skill) => {
    const entry: ContentEntry = { ...spell, id: 'mask', name: 'Orc Warmask', kind: 'feat', description: 'Full mask rules.' }
    const c: Character = { ...base, feats: [{ ...base.feats[0], choice }] }
    const markup = renderToStaticMarkup(<WarmaskGear c={c} entries={[entry]} save={() => {}} />)
    const dialog = markup.match(/<dialog\b[\s\S]*?<\/dialog>/)?.[0]
    expect(dialog).toContain(`Power source: ${choice} (${tradition}). +1 item bonus to ${skill} checks.`)
    expect(markup.replace(dialog!, '')).not.toContain('+1 item bonus')
    expect(entry.description).toBe('Full mask rules.')
  },
)
