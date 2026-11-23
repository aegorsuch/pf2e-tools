import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { automaticFeatGrants, ranksAt, warmaskAlternateSkills } from './builder'
import { FeatChoice } from './FeatChoice'
import { FeatSlots } from './FeatSlots'
import { mapAonHit } from './aon'
import { dailyInnateUses, grantedFeatSpells } from './featSpells'
import { ArmorList, WarmaskGear } from './GearSection'
import { SkillsSection } from './SkillsSection'
import { SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'
import { warmaskItemBonus, WARMASK_SOURCES } from './warmask'

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

it.each(Object.entries(WARMASK_SOURCES))('shows only %s details in the chosen feat and equipment', (choice, source) => {
  const list = '<ul>' + Object.entries(WARMASK_SOURCES).map(([name, { skill, tradition }]) =>
    `<li>**${name}** [${skill}](/Skills.aspx?ID=1), [${tradition.toLowerCase()}](/Traits.aspx?ID=1) tradition</li>`).join('') + '</ul>'
  const entry = mapAonHit({ _id: 'warmask-choices', _source: { name: 'Orc Warmask', category: 'feat', level: 1, trait: ['Orc'],
    markdown: "Warmask rules. Once you select this source, it can't be changed.\n" + list + '\n\nShared mask restrictions.',
  } }, 'pf2e')!
  const before = JSON.stringify(entry)
  const c: Character = { ...base, level: 1, feats: [{ ...base.feats[0], choice, slot: 'ancestry:1:0', sourceId: entry.id }] }
  for (const component of [
    <WarmaskGear c={c} entries={[entry]} save={() => {}} />,
    <FeatSlots c={c} entries={[entry]} save={() => {}} categories={['ancestry']} />,
  ]) {
    const markup = renderToStaticMarkup(component)
    const dialog = [...markup.matchAll(/<dialog\b[\s\S]*?<\/dialog>/g)].find(match => match[0].includes('Warmask rules.'))?.[0]
    expect(dialog).toContain(`${choice}: ${source.skill}, ${source.tradition} Tradition`)
    expect(dialog).toContain('Shared mask restrictions.')
    expect(dialog).toContain('it can&#x27;t be changed.')
    for (const other of Object.keys(WARMASK_SOURCES).filter(name => name !== choice)) expect(dialog).not.toContain(other)
  }
  const preview = renderToStaticMarkup(<FeatSlots c={c} entries={[entry]} save={() => {}} categories={['ancestry']}
    search={{ 'ancestry:1:0:open': '1' }} onSearch={() => {}} />)
  for (const [name, { skill }] of Object.entries(WARMASK_SOURCES)) {
    expect(preview).toContain(`${name}, ${skill}`)
  }
  expect(JSON.stringify(entry)).toBe(before)
})

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
  expect(html).not.toContain('the mask is always worn and attuned')
  expect(html).not.toContain('aria-label="Orc Warmask note"')
  expect(html).toContain('<span class="skill-part"><small>Item</small>+1</span>')
  const gear = renderToStaticMarkup(<WarmaskGear c={c} entries={[]} save={() => {}} />)
  expect(gear).not.toContain('Always worn and attuned while this feat is active')
  expect(gear).not.toContain('negligible Bulk')
  expect(gear).not.toContain('type="checkbox"')
  expect(renderToStaticMarkup(<SkillsSection c={{ ...c, warmask: { worn: false, attuned: false } }} entries={[]} save={() => {}} />))
    .toContain('<span class="skill-part"><small>Item</small>+1</span>')
  expect(renderToStaticMarkup(<WarmaskGear c={{ ...c, level: 0 }} entries={[]} save={() => {}} />)).not.toContain('Orc Warmask')
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)).not.toContain('Orc Warmask')
})

it.each([[8, 1], [9, 2], [16, 2], [17, 3], [20, 3]])('scales the Warmask item bonus at level %i without raising proficiency', (level, bonus) => {
  const c = { ...base, level }
  const before = JSON.stringify(c)
  expect(warmaskItemBonus(c)).toBe(bonus)
  expect(ranksAt(c, []).Religion).toBe(1)
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} />)
  const religion = markup.split('class="skill-name">Religion ')[1].split('role="row"')[0]
  expect(religion).toContain(`<small>Item</small>+${bonus}`)
  const gear = renderToStaticMarkup(<WarmaskGear c={c} entries={[]} save={() => {}} />)
  expect(gear).toContain(`+${bonus} item bonus to Religion checks`)
  expect(JSON.stringify(c)).toBe(before)
})

it('can disable Warmask scaling and grants nothing without an active source', () => {
  const previous = getSettings().warmaskScaling
  try {
    updateSettings({ warmaskScaling: false })
    expect(warmaskItemBonus({ ...base, level: 20 })).toBe(1)
    expect(warmaskItemBonus({ ...base, feats: [] })).toBe(0)
    expect(warmaskItemBonus({ ...base, systems: ['sf2e'] })).toBe(0)
  } finally { updateSettings({ warmaskScaling: previous }) }
})

it('uses the adopted-Orc Warmask label consistently without renaming the saved feat', () => {
  const c: Character = { ...base, ancestry: 'Human', feats: [
    ...base.feats, { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' },
  ] }
  expect(renderToStaticMarkup(<WarmaskGear c={c} entries={[]} save={() => {}} />))
    .toContain('aria-haspopup="dialog">Warmask</button>')
  expect(renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} />))
    .not.toContain('aria-label="Warmask note"')
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[]} index={0} save={() => {}} />))
    .toContain('aria-label="Warmask power source"')
  expect(c.feats[0].name).toBe('Orc Warmask')
})

it('auto-heightens the chosen daily spell with the warmask tradition and shared daily use', () => {
  const grant = grantedFeatSpells(base, [spell])[0]
  expect(grant).toMatchObject({ entry: { name: 'Fear' }, rank: 3,
    rule: { tradition: 'Divine', frequency: 'once per day', condition: 'Must be wearing your warmask' } })
  expect(dailyInnateUses(base, grant)?.limit).toBe(1)
  expect(renderToStaticMarkup(<SpellsSection c={base} entries={[spell]} save={() => {}} />))
    .not.toContain('Must be wearing your warmask')
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
