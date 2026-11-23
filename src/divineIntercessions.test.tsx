import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { activeFeatsNamed, eligibleFeats, maxHp, plannedSlots, resistances, savingThrowBreakdown, senses, weaponAttack } from './builder'
import { DIVINE_INTERCESSIONS, divineIntercessionWeaknesses, hasDivineIntercession, syncDivineBoonFeats, TORAG_BOON_FEAT_SLOT } from './divineIntercessions'
import { DivineIntercessions } from './intercessionPicker'
import { SensesAndSpeed, SkillsSection } from './SkillsSection'
import { dailyInnateUses, grantedFeatSpells, unresolvedFeatSpells } from './featSpells'
import { SpellsSection } from './SpellsSection'
import { FeatSlots } from './FeatSlots'
import { WeaponList } from './GearSection'
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

it('offers Pharasma boons and shows her moderate boon on Strikes and relevant spells', () => {
  const c: Character = { ...character('Pharasma', { Pharasma: ['moderate-boon'] }), level: 5,
    spells: [{ name: 'Vitality Lash', rank: 1, cantrip: true }, { name: 'Fireball', rank: 3, cantrip: false }] }
  const spell: ContentEntry = { ...deity('Vitality Lash'), kind: 'spell', traits: ['Cantrip'], level: 1 }
  const fire: ContentEntry = { ...deity('Fireball'), kind: 'spell', level: 3 }
  const sword: ContentEntry = { ...deity('Longsword'), kind: 'weapon',
    data: { weapon_category: 'Martial', damage: '1d8 slashing' } }
  const owned = { id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [] }
  const picker = renderToStaticMarkup(<DivineIntercessions deity={deity('Pharasma')} selected={['moderate-boon']} onChange={() => {}} />)
  expect(picker).toContain('Minor Boon')
  expect(picker).toContain('Moderate Boon')
  expect(picker).toContain('Major Boon')
  expect(picker).toContain('checked=""')
  expect(weaponAttack(c, [sword], owned).additionalDamage).toContainEqual(expect.objectContaining({
    source: 'Pharasma (Moderate Boon)', value: '1 vitality vs. undead',
  }))
  expect(weaponAttack(c, [sword], { ...owned, id: 'mechanic:turret' }).additionalDamage).toEqual([])
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[spell, fire]} save={() => {}} />)
  expect(markup).toContain('+3 status')
  expect(markup).toContain('vitality damage against undead or Hit Points restored to living creatures')
  const inactive = { ...c, divineIntercessions: {} }
  expect(weaponAttack(inactive, [sword], owned).additionalDamage).toEqual([])
  expect(renderToStaticMarkup(<SpellsSection c={inactive} entries={[spell, fire]} save={() => {}} />))
    .not.toContain('Pharasma (Moderate Boon)')
  expect(weaponAttack({ ...c, deity: 'Torag' }, [sword], owned).additionalDamage).toEqual([])
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

it('preserves old curse selections without applying hidden fire weakness', () => {
  const c = character('Asmodeus', { Asmodeus: ['minor-curse'] })
  expect(divineIntercessionWeaknesses(c)).toEqual([])
  expect(c.divineIntercessions?.Asmodeus).toEqual(['minor-curse'])
  expect(divineIntercessionWeaknesses({ ...c, deity: 'Erastil' })).toEqual([])
  expect(divineIntercessionWeaknesses(character('Asmodeus'))).toEqual([])
  const defense = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(defense).not.toContain('Asmodeus (Minor Curse)')
})

it('does not apply hidden saved major-curse penalties', () => {
  const c = { ...character('Asmodeus', { Asmodeus: ['major-curse'] }), ancestry: 'Human', className: 'Fighter' }
  const entries: ContentEntry[] = [
    { ...deity('Human'), id: 'human', kind: 'ancestry', data: { hp: 8 } },
    { ...deity('Fighter'), id: 'fighter', kind: 'class', data: { hp: 8 } },
  ]
  expect(maxHp(c, entries)).toBe(maxHp({ ...c, divineIntercessions: undefined }, entries))
  expect(savingThrowBreakdown(c, entries, 'Fortitude').parts)
    .not.toContainEqual({ label: 'Asmodeus Major Curse: drained 4 (condition)', value: -4 })
  expect(savingThrowBreakdown(c, entries, 'Reflex').parts.some(part => part.label.includes('drained'))).toBe(false)
})

it('shows selectable intercessions with official source links and explicit unavailable states', () => {
  const markup = renderToStaticMarkup(<DivineIntercessions deity={deity('Torag')}
    selected={['major-boon']} onChange={() => {}} />)
  expect(markup).toContain('Major Boon')
  expect(markup).toContain('checked=""')
  expect(markup).toContain('Minor Boon:</strong> Once,')
  expect(markup).not.toContain('Curse')
  expect(markup).not.toContain('Track only;')
  expect(markup).toContain('https://2e.aonprd.com/Deities.aspx?ID=294')

  for (const name of ['Green Faith', 'Lao Shu Po']) {
    const section = DIVINE_INTERCESSIONS[name]
    expect(section.unavailable).toMatch(/intercessions/)
    expect(renderToStaticMarkup(<DivineIntercessions deity={deity(name)} selected={[]} onChange={() => {}} />))
      .toContain(section.unavailable)
  }
})

it('marks longbow Volley as beneficial-only with Erastil and restores normal range and Volley when inactive', () => {
  const longbow: ContentEntry = { ...deity('Composite Longbow'), kind: 'weapon',
    traits: ['Volley 30 ft.', 'Propulsive'], data: { range: 100, weapon_type: 'Ranged', damage: '1d8 piercing' } }
  const shortbow = { ...longbow, name: 'Shortbow', traits: [], data: { ...longbow.data, range: 60 } }
  const entries = [longbow, shortbow]
  const c = character('Erastil', { Erastil: ['moderate-boon'] })
  const bow = { id: 'bow', name: longbow.name, potency: 0, striking: 0, runes: [] }
  expect(weaponAttack(c, entries, bow)).toMatchObject({ range: 200, traits: ['Propulsive', 'Volley (if beneficial)'] })
  expect(weaponAttack(c, entries, { ...bow, name: shortbow.name }).range).toBe(60)
  for (const inactive of [{ ...c, deity: 'Torag' }, { ...c, divineIntercessions: {} }]) {
    expect(weaponAttack(inactive, entries, bow).range).toBe(100)
    expect(weaponAttack(inactive, entries, bow).traits).toContain('Volley 30 ft.')
  }
  expect(longbow.data.range).toBe(100)
  expect(longbow.traits).toContain('Volley 30 ft.')
})

it('grants Erastil Speak with Plants only while his major boon is active, without inventing a frequency', () => {
  const spell: ContentEntry = { ...deity('Speak with Plants'), kind: 'spell', level: 3, data: { duration: 3600 } }
  const entries = [spell, deity('Erastil')]
  const c = character('Erastil', { Erastil: ['major-boon'] })
  expect(grantedFeatSpells(c, entries)).toMatchObject([{ entry: { name: 'Speak with Plants' },
    rank: 4, source: 'Erastil (Major Boon)', rule: { kind: 'innate', tradition: 'divine' } }])
  expect(grantedFeatSpells(c, entries)[0].rule.frequency).toBeUndefined()
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Speak with Plants')
  expect(html).toContain('<small>Duration</small>8 hours')
  expect(html).toContain('<small>Range</small>Self')
  expect(html).toContain('<small>Area/Targets</small>Self')
  expect(html).not.toContain('aria-label="Speak with Plants active"')
  expect(grantedFeatSpells({ ...c, deity: 'Torag' }, entries)).toEqual([])
  expect(grantedFeatSpells({ ...c, divineIntercessions: {} }, entries)).toEqual([])
  expect(unresolvedFeatSpells(c, [{ ...spell, deleted: true }])).toMatchObject([
    { name: 'Speak with Plants', sourceName: 'Erastil (Major Boon)' },
  ])
})

it.each(['Bastard Sword', 'Greatsword'])('grants Forceful to %s only with Gorum moderate boon', name => {
  const sword: ContentEntry = { ...deity(name), kind: 'weapon',
    data: { weapon_type: 'Melee', damage: '1d12 slashing', hands: 2 } }
  const other = { ...sword, name: 'Longsword' }
  const entries = [sword, other]
  const c = character('Gorum', { Gorum: ['moderate-boon'] })
  const weapon = { id: 'sword', name, potency: 0, striking: 0, runes: [] }
  expect(weaponAttack(c, entries, weapon).traits).toContain('Forceful')
  expect(weaponAttack(c, entries, { ...weapon, name: other.name }).traits).not.toContain('Forceful')
  for (const inactive of [{ ...c, deity: 'Erastil' }, { ...c, divineIntercessions: {} }])
    expect(weaponAttack(inactive, entries, weapon).traits).not.toContain('Forceful')
  expect(sword.traits).toEqual([])
})

it('gives Torag one first-level Dwarf ancestry slot without opening Dwarf feats in normal slots', () => {
  const c = { ...character('Torag', { Torag: ['moderate-boon'] }), ancestry: 'Human' }
  const dwarf: ContentEntry = { ...deity('Unburdened Iron'), kind: 'feat', level: 1, traits: ['Dwarf'] }
  const human = { ...dwarf, name: 'Human Feat', id: 'human-feat', traits: ['Human'] }
  const entries = [dwarf, human, { ...dwarf, name: 'Future Dwarf Feat', id: 'future', level: 5 }]
  const slots = plannedSlots(c, entries)
  const boon = slots.find(slot => slot.key === TORAG_BOON_FEAT_SLOT)!
  expect(boon).toMatchObject({ category: 'ancestry', level: 1, grantedAncestry: 'Dwarf' })
  expect(eligibleFeats(entries, c, boon).map(entry => entry.name)).toEqual(['Unburdened Iron'])
  const normal = slots.find(slot => slot.category === 'ancestry' && slot.key !== boon.key)!
  expect(eligibleFeats(entries, c, normal).map(entry => entry.name)).toEqual(['Human Feat'])
  expect(plannedSlots({ ...c, divineIntercessions: {} }, entries).some(slot => slot.key === boon.key)).toBe(false)
  expect(renderToStaticMarkup(<FeatSlots c={c} entries={entries} save={() => {}} categories={['ancestry']} />))
    .toContain('Empty (Torag boon)')
})

it.each(['uncheck', 'change-deity'])('suspends and restores Torag feat choices after %s without losing saved metadata', action => {
  const chosen: Character['feats'][number] = {
    name: 'Unburdened Iron', type: 'Ancestry Feat', level: 1, slot: TORAG_BOON_FEAT_SLOT,
    sourceId: 'iron', choice: 'Saved option',
  }
  const regular: Character['feats'][number] = { name: 'Regular Feat', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }
  const c = { ...character('Torag', { Torag: ['moderate-boon'] }), feats: [regular, chosen] }
  const disabled = action === 'uncheck' ? { ...c, divineIntercessions: { Torag: [] } } : { ...c, deity: 'Erastil' }
  const inactive = { ...disabled, ...syncDivineBoonFeats(disabled) }
  expect(inactive.feats).toEqual([regular])
  expect(activeFeatsNamed(inactive, chosen.name)).toEqual([])
  expect(inactive.inactiveDivineBoonFeats).toEqual([chosen])
  expect(syncDivineBoonFeats(inactive)).toEqual({})
  const restored = { ...JSON.parse(JSON.stringify(inactive)), deity: 'Torag', divineIntercessions: c.divineIntercessions } as Character
  const active = { ...restored, ...syncDivineBoonFeats(restored) }
  expect(active.feats).toEqual([regular, chosen])
  expect(active.inactiveDivineBoonFeats).toEqual([])
  expect(syncDivineBoonFeats(active)).toEqual({})
})

it('adds Iomedae major-boon status bonus only to held longsword attacks, not damage or other weapons', () => {
  const sword: ContentEntry = { ...deity('Longsword'), kind: 'weapon',
    data: { weapon_type: 'Melee', damage: '1d8 slashing', hands: 1 } }
  const other = { ...sword, name: 'Shortsword' }
  const entries = [sword, other]
  const c = character('Iomedae', { Iomedae: ['major-boon'] })
  const weapon = { id: 'sword', name: sword.name, potency: 3, striking: 1, runes: [] }
  const ordinary = weaponAttack({ ...c, divineIntercessions: {} }, entries, weapon)
  const blessed = weaponAttack(c, entries, weapon)
  expect(blessed.attack).toBe(ordinary.attack + 2)
  expect(blessed.breakdown.total).toBe(blessed.attack)
  expect(blessed.breakdown.parts).toContainEqual({ label: 'Iomedae (Major Boon) (status)', value: 2 })
  expect(blessed.damage).toBe(ordinary.damage)
  expect(weaponAttack(c, entries, { ...weapon, name: other.name }).attack).toBe(ordinary.attack)
  expect(weaponAttack(c, entries, { ...weapon, stowed: true }).attack).toBe(ordinary.attack)
  expect(weaponAttack({ ...c, deity: 'Torag' }, entries, weapon).attack).toBe(ordinary.attack)
})

it('adds Cayden fear-save guidance and upgrades critical failures only with acquired fighter Bravery', () => {
  const c = { ...character('Cayden Cailean', { 'Cayden Cailean': ['moderate-boon'] }), className: 'Fighter', level: 3 }
  const bravery: ContentEntry = { ...deity('Bravery'), kind: 'classFeature', level: 3, data: { class: 'Fighter' } }
  const render = (character: Character, entries: ContentEntry[] = []) =>
    renderToStaticMarkup(<SkillsSection c={character} entries={entries} save={() => {}} part="defense" />)
  expect(render(c)).toContain('Against fear effects, a success becomes a critical success.')
  expect(render(c)).not.toContain('With fighter Bravery')
  expect(render(c, [bravery])).toContain('With fighter Bravery, a critical failure becomes a failure.')
  expect(render({ ...c, level: 2 }, [bravery])).not.toContain('With fighter Bravery')
  expect(render({ ...c, deity: 'Torag' }, [bravery])).not.toContain('Against fear effects')
  const inactive = { ...c, divineIntercessions: {} }
  expect(savingThrowBreakdown(c, [], 'Will').total).toBe(savingThrowBreakdown(inactive, [], 'Will').total)
})

it('shows Cayden major boon on movement without claiming immunity or changing speed', () => {
  const c = character('Cayden Cailean', { 'Cayden Cailean': ['major-boon'] })
  expect(renderToStaticMarkup(<SensesAndSpeed c={c} entries={[]} save={() => {}} />))
    .toContain('end one effect making you immobilized as a free action')
})

it('grants Kazutal modern Liminal Doorway once per day and preserves spent uses when re-enabled', () => {
  const spell: ContentEntry = { ...deity('Liminal Doorway'), kind: 'spell', level: 4 }
  const c = character('Kazutal', { Kazutal: ['moderate-boon'] })
  const grant = grantedFeatSpells(c, [spell])[0]
  expect(grant).toMatchObject({ entry: { name: 'Liminal Doorway' }, rank: 4,
    rule: { kind: 'innate', tradition: 'divine', frequency: 'once per day' } })
  expect(dailyInnateUses(c, grant)).toMatchObject({ remaining: 1, limit: 1 })
  const spent = { ...c, innateSpellUses: { [grant.usageKey]: 1 } }
  expect(dailyInnateUses(JSON.parse(JSON.stringify(spent)), grantedFeatSpells(spent, [spell])[0])?.remaining).toBe(0)
  expect(grantedFeatSpells({ ...spent, divineIntercessions: {} }, [spell])).toEqual([])
  expect(grantedFeatSpells({ ...spent, deity: 'Torag' }, [spell])).toEqual([])
  expect(unresolvedFeatSpells(c, [])).toMatchObject([{ name: 'Liminal Doorway', sourceName: 'Kazutal (Moderate Boon)' }])
})

it('keeps Kazutal Aid and Sarenrae Request improvements conditional, without inflating ordinary skills', () => {
  for (const [name, text] of [['Kazutal', 'Applies only to Aid, not ordinary checks.'],
    ['Sarenrae', 'Request: a success becomes a critical success.']]) {
    const c = character(name, { [name]: ['major-boon'] })
    const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} />)
    expect(markup).toContain(text)
    expect(renderToStaticMarkup(<SkillsSection c={{ ...c, divineIntercessions: {} }} entries={[]} save={() => {}} />))
      .not.toContain(text)
  }
})

it('adds Sarenrae fire damage alongside existing runes in both attack views, including unarmed attacks', () => {
  const sword: ContentEntry = { ...deity('Longsword'), kind: 'weapon',
    data: { weapon_type: 'Melee', damage: '1d8 slashing', hands: 1 } }
  const weapon = { id: 'sword', name: sword.name, potency: 0, striking: 0, runes: ['Flaming'] }
  const c = { ...character('Sarenrae', { Sarenrae: ['moderate-boon'] }), weapons: [weapon] }
  const entries = [sword]
  for (const name of [sword.name, 'Fist']) {
    const attack = weaponAttack(c, entries, { ...weapon, name })
    expect(attack.additionalDamage).toEqual([{ source: 'Sarenrae (Moderate Boon)', value: '1d6 fire',
      note: 'This additional fire damage ignores fire resistance.' }])
    expect(weaponAttack({ ...c, deity: 'Torag' }, entries, { ...weapon, name }).additionalDamage).toEqual([])
  }
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).toContain('This additional fire damage ignores fire resistance.')
    expect(markup).toContain('Sarenrae (Moderate Boon)')
    expect(markup.match(/1d6 fire/g)?.length).toBeGreaterThanOrEqual(2)
  }
})

it('does not show Sarenrae weapon damage as a spell bonus', () => {
  const grant: ContentEntry = { ...deity('Granted Spells'), kind: 'feat',
    spellGrants: [{ kind: 'innate', spells: ['Test Spell'], tradition: 'divine' }] }
  const c = { ...character('Sarenrae', { Sarenrae: ['moderate-boon'] }),
    feats: [{ name: grant.name, type: 'Ancestry Feat', level: 1 }] }
  const spell: ContentEntry = { ...deity('Test Spell'), kind: 'spell', level: 1 }
  const render = (entry: ContentEntry) => renderToStaticMarkup(<SpellsSection c={c} entries={[grant, entry]} save={() => {}} />)
  expect(render({ ...spell, traits: ['Attack'] })).not.toContain('This additional fire damage ignores fire resistance.')
  expect(render({ ...spell, data: { saving_throw: 'Will' } })).not.toContain('This additional fire damage ignores fire resistance.')
  expect(render(spell)).not.toContain('This additional fire damage ignores fire resistance.')
})
