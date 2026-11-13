import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { mapAonHit } from './aon'
import { parseFeatSpellGrants } from './aonQuery'
import { classSpellcasting, eligibleFeats, featChoiceOptions, focusSpells, knowsSpell, movementSpeeds, oakenResilience, ownedWeapons, resistances, weaponAttack } from './builder'
import { grantedWardenSpells } from './featChoices'
import { dailyInnateUses, featSpellOptions, grantedFeatSpells, unresolvedFeatSpells, refocusRecovery } from './featSpells'
import { FocusPointTracker, InnateSpellUses, ResetDailyInnateUses, SpellsSection } from './SpellsSection'
import { ClassFeatures } from './ClassFeatures'
import { WeaponList } from './GearSection'
import { MinionsSection } from './MinionsSection'
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

it('shows champion sanctification and devotion spell choices without a blessing', () => {
  const deity = entry('Patron', 'deity', { divine_font: 'Heal', sanctification: 'holy, unholy' })
  const c: Character = { ...base, level: 1, className: 'Champion', deity: deity.name, devotionSpell: 'Lay on Hands' }
  const spells = renderToStaticMarkup(<SpellsSection c={c} entries={[deity, entry('Lay on Hands', 'spell')]} save={() => {}} />)
  expect(spells).toContain('aria-label="Devotion spell"')
  expect(spells).toContain('Lay on Hands')
  expect(spells).toContain('Devotion Spells')
  expect(spells).not.toContain('Touch of the Void')
  const features = renderToStaticMarkup(<ClassFeatures c={c} entries={[deity]} save={() => {}} />)
  expect(features).toContain('aria-label="Sanctification"')
})

function findUseButton(node: ReactNode, label: string): { disabled?: boolean; onClick: () => void } | undefined {
  let found: { disabled?: boolean; onClick: () => void } | undefined
  Children.forEach(node, child => {
    if (found || !isValidElement<{ children?: ReactNode; 'aria-label'?: string; disabled?: boolean; onClick: () => void }>(child)) return
    if (child.type === 'button' && (child.props['aria-label'] === label || child.props.children === label)) found = child.props
    else found = findUseButton(child.props.children, label)
  })
  return found
}

it('grants Sacral Monarch spells once each per day only within the claimed territory', () => {
  const source = feat('Sacral Monarch', 'While in your territory, you can cast [_banishment_](/Spells.aspx?ID=1448) and [_inevitable disaster_](/Spells.aspx?ID=930) as innate divine spells, each once per day.', 14)
  const spells = ['Banishment', 'Inevitable Disaster'].map(name => ({ ...entry(name, 'spell'), level: 5 }))
  const c: Character = { ...base, level: 14, feats: [taken(source.name, 14)] }
  expect(source.spellGrants).toHaveLength(1)
  const grants = grantedFeatSpells(c, [source, ...spells])
  expect(grants.map(grant => grant.entry.name)).toEqual(['Banishment', 'Inevitable Disaster'])
  expect(grants.every(grant => grant.rank === 5 && grant.rule.frequency === 'once per day'
    && grant.rule.condition === 'Only within your claimed territory')).toBe(true)
  expect(grants[0].usageKey).not.toBe(grants[1].usageKey)
  expect(grantedFeatSpells({ ...c, level: 13 }, [source, ...spells])).toEqual([])
})

it('refocuses one point per ten minutes across saves without resetting spells or daily uses', () => {
  let c: Character = { ...base, activeSpells: ['Animal Feature'], innateSpellUses: { daily: 1 } }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const tree = () => FocusPointTracker({ c, save, points: 3 })
  expect(renderToStaticMarkup(tree()).match(/aria-pressed="true"/g)).toHaveLength(3)
  expect(findUseButton(tree(), 'Refocus')!.disabled).toBe(true)
  findUseButton(tree(), 'Spend focus point 2')!.onClick()
  expect(c.spentFocusPoints).toEqual([1])
  expect(renderToStaticMarkup(tree())).toContain('2 of 3 focus points available')
  findUseButton(tree(), 'Spend focus point 1')!.onClick()
  findUseButton(tree(), 'Spend focus point 3')!.onClick()
  expect(renderToStaticMarkup(tree())).toContain('0 of 3 focus points available')
  expect(renderToStaticMarkup(tree())).not.toContain('aria-pressed="true"')
  findUseButton(tree(), 'Restore focus point 2')!.onClick()
  expect(c.spentFocusPoints).toEqual([0, 2])
  findUseButton(tree(), 'Refocus')!.onClick()
  expect(c.spentFocusPoints).toEqual([2])
  expect(c.focusPointsSpentSinceRefocus).toBe(0)
  findUseButton(tree(), 'Refocus')!.onClick()
  expect(c.spentFocusPoints).toEqual([])
  expect(renderToStaticMarkup(tree()).match(/aria-pressed="true"/g)).toHaveLength(3)
  expect(c.activeSpells).toEqual(['Animal Feature'])
  expect(c.innateSpellUses).toEqual({ daily: 1 })
})

it('applies earned Refocus feats, tracks conditional spending between Refocuses, and excludes Mythic actions', () => {
  const focus = feat("Warden's Focus", 'When you Refocus, you regain all your Focus Points instead of 1.', 12)
  const wellspring = feat('Meditative Wellspring', 'If you have spent at least 3 Focus Points since the last time you Refocused, you recover 3 Focus Points when you Refocus instead of 1.', 18)
  const mythic = feat('Mythic Refocus', 'Spend a Mythic Point; you immediately recover all your Focus Points.', 8)
  const entries = [focus, wellspring, mythic]
  expect(refocusRecovery({ ...base, level: 12, feats: [taken(focus.name, 12)] }, entries, 3, 3)).toBe(3)
  expect(refocusRecovery({ ...base, level: 11, feats: [taken(focus.name, 12)] }, entries, 3, 3)).toBe(1)
  expect(refocusRecovery({ ...base, level: 18, feats: [taken(wellspring.name, 18)], focusPointsSpentSinceRefocus: 2 }, entries, 3, 3)).toBe(1)
  expect(refocusRecovery({ ...base, level: 18, feats: [taken(wellspring.name, 18)], focusPointsSpentSinceRefocus: 3 }, entries, 3, 2)).toBe(3)
  expect(refocusRecovery({ ...base, level: 18, feats: [taken(mythic.name, 8)] }, entries, 3, 3)).toBe(1)
})

it('reads innate frequency from a feat header and resolves legacy Pass Without Trace to Vanishing Tracks', () => {
  const source = mapAonHit({ _id: 'unseen', _source: { name: 'Unseen Passage', category: 'feat',
    markdown: 'Header\n\n**Frequency** once per day\n\n---\n\nYou can cast [pass without trace](/Spells.aspx?ID=215) as an innate primal spell heightened to a spell level equal to half your level rounded up.' } }, 'pf2e')!
  const c = { ...base, level: 9, feats: [taken(source.name)] }
  const spell = entry('Vanishing Tracks', 'spell')
  const [grant] = grantedFeatSpells(c, [source, spell])
  expect(grant).toMatchObject({ entry: spell, source: source.name, rank: 5, rule: { frequency: 'once per day', tradition: 'primal' } })
  expect(dailyInnateUses(c, grant)?.limit).toBe(1)
  expect(unresolvedFeatSpells(c, [source, spell])).toEqual([])
})

it('alphabetizes innate spell names independently of feat selection order', () => {
  const sources = ['Zebra', 'Alpha'].map(name => feat(`${name} Magic`, `You can cast [${name}](/Spells.aspx?ID=1) as an innate primal spell once per day.`))
  const c = { ...base, feats: sources.map(source => taken(source.name)) }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[...sources, entry('Alpha', 'spell'), entry('Zebra', 'spell')]} save={() => {}} />)
  const innate = markup.slice(markup.indexOf('<b>Innate Spells</b>'))
  expect(innate.indexOf('aria-haspopup="dialog">Alpha</button>')).toBeLessThan(innate.indexOf('aria-haspopup="dialog">Zebra</button>'))
})

it('grants each First World Adept spell once daily at rank two', () => {
  const source = feat('First World Adept', 'You gain [invisibility](/Spells.aspx?ID=164) and [revealing light](/Spells.aspx?ID=1653) as 2nd-rank primal innate spells. You can cast each of these primal innate spells once per day.', 9)
  const c = { ...base, level: 9, feats: [taken(source.name, 9)] }
  const grants = grantedFeatSpells(c, [source, entry('Invisibility', 'spell'), entry('Revealing Light', 'spell')])
  expect(grants.map(grant => [grant.entry.name, grant.rank, grant.rule.tradition, dailyInnateUses(c, grant)?.limit]))
    .toEqual([['Invisibility', 2, 'primal', 1], ['Revealing Light', 2, 'primal', 1]])
  expect(dailyInnateUses(c, grants[0])?.key).not.toBe(dailyInnateUses(c, grants[1])?.key)
})

it('heightens Grown of Oak automatically for the character and leshy familiar', () => {
  const grown = feat('Grown of Oak', 'You can cast [oaken resilience](/Spells.aspx?ID=1617) at will as an innate primal spell with a spell rank one lower than the highest rank of spells you can cast.', 6)
  const spell = { ...entry('Oaken Resilience', 'spell', { duration: '10 minutes' }), level: 2 }
  const entries = [grown, spell]
  const c: Character = { ...base, level: 10, className: 'Druid',
    feats: [taken(grown.name, 6), taken('Leshy Familiar')], activeSpells: ['Oaken Resilience'],
    oakenResilienceRank: 2, familiar: { oakenResilienceActive: false, oakenResilienceRank: 2 } }
  expect(grantedFeatSpells(c, entries)).toMatchObject([{ entry: spell, rank: 4, rule: { frequency: 'at will', tradition: 'primal' } }])
  expect(oakenResilience(c, entries)).toEqual({ rank: 4, resistance: 4, fireWeakness: 6 })
  expect(resistances(c, entries)).toEqual([
    { damage: 'Bludgeoning', value: 4, source: spell.name },
    { damage: 'Piercing', value: 4, source: spell.name },
  ])
  expect(oakenResilience({ ...c, level: 18 }, entries)).toEqual({ rank: 8, resistance: 8, fireWeakness: 12 })
  expect(oakenResilience({ ...c, activeSpells: [] }, entries)).toBeUndefined()
  expect(oakenResilience({ ...c, feats: [] }, entries)).toBeUndefined()
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Cast rank 4 (Grown of Oak)')
  expect(html).not.toContain('Oaken Resilience cast rank')
  expect(html).toContain('Active on you')
  const minions = (character: Character) => renderToStaticMarkup(<MinionsSection c={character} entries={entries} save={() => {}} />)
  expect(minions(c)).toContain('Bludgeoning and piercing resistance 4; fire weakness 6')
  expect(minions({ ...c, level: 18 })).toContain('Bludgeoning and piercing resistance 8; fire weakness 12')
  expect(minions({ ...c, activeSpells: [] })).not.toContain('Bludgeoning and piercing resistance')
  expect(minions(c)).not.toContain('Oaken Resilience active on leshy familiar')
  expect(unresolvedFeatSpells(c, [grown])).toMatchObject([{ name: 'Oaken Resilience' }])
})

it('keeps manual cast rank for Oaken Resilience without Grown of Oak', () => {
  const c: Character = { ...base, spells: [{ name: 'Oaken Resilience', rank: 2, cantrip: false }],
    activeSpells: ['Oaken Resilience'], oakenResilienceRank: 6 }
  expect(oakenResilience(c, [])).toEqual({ rank: 6, resistance: 6, fireWeakness: 9 })
  expect(oakenResilience({ ...c, oakenResilienceRank: 11 }, [])).toBeUndefined()
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)).toContain('Oaken Resilience cast rank')
})

it('grants only the chosen Touch of the Sea cantrip', () => {
  const source = feat('Touch of the Sea', 'Choose either gale blast or spout.', 1)
  const spells = ['Gale Blast', 'Spout', 'Light'].map(name => entry(name, 'spell', {}, ['Cantrip']))
  const c: Character = { ...base, level: 7, feats: [taken(source.name, 1, 'Spout')] }
  expect(featSpellOptions(c, [source, ...spells], c.feats[0])?.map(spell => spell.name)).toEqual(['Gale Blast', 'Spout'])
  expect(grantedFeatSpells(c, [source, ...spells])).toMatchObject([{ entry: spells[1], rank: 4, rule: { frequency: 'at will', tradition: 'primal' } }])
  expect(grantedFeatSpells({ ...c, feats: [taken(source.name, 1, 'Light')] }, [source, ...spells])).toEqual([])
})

it('grants Caustic Blast automatically for Elemental Wrath regardless of legacy damage choice', () => {
  const source = feat('Elemental Wrath', 'Choose acid, cold, electricity, or fire.', 1)
  const spell = { ...entry('Caustic Blast', 'spell', {}, ['Cantrip', 'Acid']), description: 'Deal acid damage.' }
  const c: Character = { ...base, level: 5, feats: [taken(source.name)] }
  const grant = grantedFeatSpells(c, [source, spell])[0]
  expect(grant).toMatchObject({ rank: 3, entry: spell, rule: { tradition: 'primal', frequency: 'at will' } })
  expect(spell.traits).toEqual(['Cantrip', 'Acid'])
  expect(grantedFeatSpells({ ...c, feats: [taken(source.name, 1, 'Fire')] }, [source, spell])[0].entry).toEqual(spell)
  expect(grantedFeatSpells({ ...c, level: 0 }, [source, spell])).toEqual([])
  expect(unresolvedFeatSpells(c, [source])).toMatchObject([{ name: 'Caustic Blast' }])
})

it('applies Untamed Shift selected effects, attack runes, heightening, and form resistance', () => {
  const c: Character = { ...base, className: 'Druid', order: 'Wild', level: 11,
    feats: [taken('Untamed Form'), taken('Elemental Shape', 10), taken('Soaring Shape', 8)],
    handwraps: { potency: 2, striking: 1, runes: [] },
    activeSpells: ['Untamed Shift', 'Untamed Form'], untamedShiftEffects: ['Claws', 'Elemental', 'Wings'] }
  expect(focusSpells(c, []).spells.map(spell => spell.name)).toEqual(expect.arrayContaining(['Untamed Shift', 'Untamed Form']))
  const claw = ownedWeapons(c, []).find(weapon => weapon.name === 'Untamed Claws')!
  expect(weaponAttack(c, [], claw)).toMatchObject({ item: 2, damage: '2d6 slashing' })
  expect(resistances(c, [])).toEqual(expect.arrayContaining([
    { damage: 'Critical hits', value: 5, source: 'Untamed Shift' },
    { damage: 'Precision', value: 5, source: 'Untamed Shift' },
    { damage: 'Fire', value: 5, source: 'Elemental Shape (polymorphed)' },
  ]))
  expect(movementSpeeds(c, []).some(speed => speed.name === 'Fly')).toBe(false)
  expect(movementSpeeds({ ...c, level: 19 }, [])).toContainEqual({ name: 'Fly', feet: 30, source: 'Untamed Shift' })
  const shifted = { ...c, activeSpells: [] }
  expect(ownedWeapons(shifted, []).some(weapon => weapon.name === 'Untamed Claws')).toBe(false)
  expect(resistances(shifted, [])).toEqual([])
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('Untamed Shift: Claws')
  expect(html).not.toContain('Wings require casting with two actions')
  for (const displayOnly of [false, true]) {
    const weapons = renderToStaticMarkup(<WeaponList c={{ ...c, level: 19 }} entries={[]} save={() => {}} displayOnly={displayOnly} />)
    expect(weapons).toContain('<strong>Claws</strong>')
    expect(weapons).toContain(' + 4d6 persistent bleed')
    expect(weapons).not.toContain('on a hit (Untamed Shift)')
  }
})

it('grants Life Preserver and A Different Sort of Fey innate spells', () => {
  const life = feat('Life Preserver', 'You can cast [life seal](/spells/171-life-seal) once per day as a 3rd-rank primal innate spell. You can target only yourself, but the duration increases to 10 minutes.', 9)
  const fey = feat('A Different Sort of Fey', 'You can cast [discharge](/spells/66-discharge), [electrotether](/spells/87-electrotether), and [irradiate](/spells/166-irradiate) once per day each as 3rd-rank primal innate spells.', 13)
  const spells = ['Life Seal', 'Discharge', 'Electrotether', 'Irradiate'].map(name => entry(name, 'spell'))
  const c = { ...base, level: 13, feats: [taken(life.name, 9), taken(fey.name, 13)] }
  const grants = grantedFeatSpells(c, [life, fey, ...spells])
  expect(grants.map(grant => grant.entry.name)).toEqual(spells.map(spell => spell.name))
  expect(grants.every(grant => grant.rank === 3 && dailyInnateUses(c, grant)?.limit === 1)).toBe(true)
  expect(new Set(grants.map(grant => dailyInnateUses(c, grant)?.key)).size).toBe(4)
})

it('recognizes the truncated order-spell grant in Impaling Briars source data', () => {
  const raw = 'Header\n\n---\n\nYou can fill an area with devastating briars. You gain the [_impaling briars_](/Spells.aspx?ID=1857) order.'
  expect(parseFeatSpellGrants(raw)).toEqual([{ kind: 'focus', spells: ['impaling briars'], heightened: true, tradition: undefined }])
})

it('grants the selected ancestry-specific cantrip at will and heightens it', () => {
  const source = mapAonHit({ _id: 'gnome-cantrip', _source: { name: 'Ancestral Cantrip', category: 'feat', level: 1, trait: ['Gnome'],
    markdown: 'Header\n\n---\n\nChoose one cantrip.<br/><br/>**[Option(s)](/feats/1)**: primal; _[adhere](/spells/1)_' } }, 'sf2e')!
  const adhere = { ...entry('Adhere', 'spell', { tradition: 'Primal' }, ['Cantrip']), systems: ['sf2e' as const] }
  const other = { ...entry('Light', 'spell', { tradition: 'Primal' }, ['Cantrip']), systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Gnome', level: 7, feats: [taken(source.name, 1, 'Adhere')] }
  expect(featSpellOptions(c, [source, adhere, other], c.feats[0])).toEqual([adhere])
  expect(grantedFeatSpells(c, [source, adhere, other])).toMatchObject([{ entry: adhere, rank: 4, rule: { tradition: 'primal', frequency: 'at will' } }])
  expect(grantedFeatSpells({ ...c, feats: [taken(source.name, 1, 'Light')] }, [source, adhere, other])).toEqual([])
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={[source, adhere]} save={() => {}} />)).toContain('Ancestral Cantrip spell')
})

it('allows listed ancestral cantrips when the source omits a tradition without inventing one', () => {
  const source = mapAonHit({ _id: 'urog-cantrip', _source: { name: 'Ancestral Cantrip', category: 'feat', level: 1, trait: ['Urog'],
    markdown: 'Header\n\n---\n\nChoose one cantrip.<br/><br/>**[Option(s)](/feats/1)**: _[guidance](/spells/1)_, or _[measure](/spells/2)_' } }, 'sf2e')!
  const guidance = { ...entry('Guidance', 'spell', {}, ['Cantrip']), systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Urog', feats: [taken(source.name, 1, 'Guidance')] }
  expect(featSpellOptions(c, [source, guidance], c.feats[0])).toEqual([guidance])
  expect(grantedFeatSpells(c, [source, guidance])[0].rule).toMatchObject({
    tradition: undefined, condition: 'Tradition not specified in ancestry source; verify with GM',
  })
})

it('selects only unused ancestry spells at the feat slot rank and grants the correct innate rank', () => {
  const magic = mapAonHit({ _id: 'gnome-magic', _source: { name: 'Ancestral Magic', category: 'feat', level: 5, trait: ['Gnome'],
    markdown: 'Header\n\n---\n\nChoose a spell.<br/><br/>**[Option(s)](/feats/1)**: primal; 1st _[charm](/spells/1)_; 2nd _[invisibility](/spells/2)_; 3rd _[veil of privacy](/spells/3)_\n\n**Special** You can select this feat more than once.' } }, 'sf2e')!
  const spells = ['Charm', 'Invisibility', 'Veil of Privacy'].map(name => entry(name, 'spell'))
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Gnome', level: 9,
    feats: [{ ...taken(magic.name, 5, 'Charm'), slot: 'ancestry:5:0' }] }
  expect(featChoiceOptions('Ancestral Magic', c, [magic, ...spells], 'ancestry:9:0')).toBeUndefined()
  expect(featChoiceOptions('First World Magic', c, [magic, ...spells], 'ancestry:1:0')).toBeUndefined()
  const slot = { key: 'ancestry:9:0', category: 'ancestry' as const, level: 9 }
  expect(eligibleFeats([magic, ...spells], c, slot)).toContain(magic)
  const second = { ...taken(magic.name, 5, 'Invisibility'), slot: slot.key }
  const two = { ...c, feats: [...c.feats, second] }
  expect(featSpellOptions(two, [magic, ...spells], second)?.map(spell => spell.name)).toEqual(['Invisibility', 'Veil of Privacy'])
  expect(grantedFeatSpells(two, [magic, ...spells]).map(grant => [grant.entry.name, grant.rank, grant.rule.tradition]))
    .toEqual([['Charm', 1, 'primal'], ['Invisibility', 3, 'primal']])
  const allUsed = { ...c, feats: [...c.feats, { ...second, choice: 'Invisibility', slot: 'ancestry:9:0' },
    { ...second, choice: 'Veil of Privacy', slot: 'ancestry:13:0' }], level: 17 }
  expect(eligibleFeats([magic, ...spells], allUsed, { ...slot, key: 'ancestry:17:0', level: 17 })).not.toContain(magic)
  const markup = renderToStaticMarkup(<SpellsSection c={two} entries={[magic, ...spells]} save={() => {}} />)
  expect(markup).toContain('Ancestral Magic spell')
})

it('offers Elf Ancestral Magic spells by feat slot and grants them as daily primal innate spells', () => {
  const magic = mapAonHit({ _id: 'elf-magic', _source: { name: 'Ancestral Magic', category: 'feat', level: 5, trait: ['Elf'],
    markdown: "Header\n\n---\n\nYour ancestry has a powerful connection to one or more magical traditions.<br /> Choose one 1st-rank spell from your ancestry's magic entry.<br/><br/>**[Option(s)](/feats/1057-ancestral-magic)**: primal; **1st** _[wisp ally](/spells/365-wisp-ally)_; **2nd** _[verdant code](/spells/339-verdant-code)_; **3rd** _[discharge](/spells/66-discharge)_; **5th** _[overload systems](/spells/207-overload-systems)_\n\n**Special** If you have multiple spells listed for your ancestry, you can select this feat more than once. If you do, you must select a different spell." } }, 'sf2e')!
  const spells = ['Wisp Ally', 'Verdant Code', 'Discharge', 'Overload Systems']
    .map(name => ({ ...entry(name, 'spell'), systems: ['sf2e' as const] }))
  const entries = [magic, ...spells]
  const expected = [
    { level: 5, rank: 1, names: ['Wisp Ally'] },
    { level: 9, rank: 3, names: ['Discharge', 'Verdant Code', 'Wisp Ally'] },
    { level: 13, rank: 5, names: ['Discharge', 'Overload Systems', 'Verdant Code', 'Wisp Ally'] },
    { level: 17, rank: 7, names: ['Discharge', 'Overload Systems', 'Verdant Code', 'Wisp Ally'] },
  ]
  for (const { level, rank, names } of expected) {
    const feat = { ...taken(magic.name, 5, names[0]), slot: `ancestry:${level}:0` }
    const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Elf', level, feats: [feat] }
    expect(featSpellOptions(c, entries, feat)?.map(spell => spell.name)).toEqual(names)
    const [grant] = grantedFeatSpells(c, entries)
    expect(grant).toMatchObject({ entry: { name: names[0] }, rank,
      rule: { kind: 'innate', tradition: 'primal', frequency: 'once per day' } })
    expect(dailyInnateUses(c, grant)?.limit).toBe(1)
  }
  const first = { ...taken(magic.name, 5, 'Wisp Ally'), slot: 'ancestry:5:0' }
  const second = { ...taken(magic.name, 5, 'Verdant Code'), slot: 'ancestry:9:0' }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Elf', level: 9, feats: [first, second] }
  expect(eligibleFeats(entries, { ...c, feats: [first] }, { key: second.slot, category: 'ancestry', level: 9 })).toContain(magic)
  expect(featSpellOptions(c, entries, second)?.map(spell => spell.name)).toEqual(['Discharge', 'Verdant Code'])
  expect(grantedFeatSpells(c, entries).map(grant => [grant.entry.name, grant.rank]))
    .toEqual([['Wisp Ally', 1], ['Verdant Code', 3]])
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Ancestral Magic spell')
  expect(markup).toContain('Verdant Code')
})

it('keeps companion spell names and Active checkboxes together before source notes', () => {
  const c: Character = { ...base, className: 'Ranger', spells: [
    { name: 'Canopy Crawler', rank: 2, cantrip: false }, { name: 'Enlarge Companion', rank: 2, cantrip: false },
  ] }
  const entries = ['Canopy Crawler', 'Enlarge Companion'].map(name => entry(name, 'spell', {}, ['Focus', 'Ranger']))
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  for (const name of ['Canopy Crawler', 'Enlarge Companion']) {
    const row = markup.slice(markup.indexOf(`aria-haspopup="dialog">${name}</button>`))
    expect(row.indexOf(`aria-label="${name} active"`)).toBeGreaterThan(0)
    expect(row.indexOf(`aria-label="${name} active"`)).toBeLessThan(row.indexOf('</div>'))
    expect(markup.match(new RegExp(`aria-label="${name} active"`, 'g'))).toHaveLength(1)
  }
})

it('shows only earned focus dots when capacity changes and no tracker without a focus pool', () => {
  const c: Character = { ...base, spentFocusPoints: [2] }
  const markup = renderToStaticMarkup(<FocusPointTracker c={c} save={() => {}} points={1} />)
  expect(markup).toContain('1 of 1 focus points available')
  expect(markup).not.toContain('focus point 2')
  expect(FocusPointTracker({ c, save: () => {}, points: 0 })).toBeNull()
})

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

it('grants Champion domain spells from imported spell data and shows them in focus spells', () => {
  const water = (name: string, level: number) => mapAonHit({ _id: name,
    _source: { name, category: 'spell', level, trait: ['Cleric', 'Focus'], domain: ['Water'] } }, 'pf2e')!
  const entries = [water('Tidal Surge', 1), water('Downpour', 4)]
  const c: Character = { ...base, className: 'Champion', level: 8, feats: [
    { ...taken("Deity's Domain", 1, 'Water'), slot: 'class:1:0' },
    { ...taken("Advanced Deity's Domain", 8, 'Water'), slot: 'class:8:0' },
  ] }
  expect(grantedFeatSpells(c, entries).map(grant => grant.entry.name)).toEqual(['Tidal Surge', 'Downpour'])
  expect(focusSpells(c, entries)).toMatchObject({ points: 2, spells: [{ name: 'Downpour' }, { name: 'Tidal Surge' }] })
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('<b>Focus Spells</b>')
  expect(markup).toContain('>Tidal Surge</button>')
  expect(markup).toContain('>Downpour</button>')
  expect(grantedFeatSpells({ ...c, level: 7 }, entries).map(grant => grant.entry.name)).toEqual(['Tidal Surge'])
})

it('lists Sacral Lord cantrips with their territorial restriction', () => {
  const source = feat('Sacral Lord', 'Claim a defined territory, such as a forest. Within its borders, you can cast [_detect magic_](/Spells.aspx?ID=1485), [_guidance_](/Spells.aspx?ID=1549), and [_sigil_](/Spells.aspx?ID=1673) as innate divine cantrips, and you gain a bonus.')
  const entries = [source, ...['Detect Magic', 'Guidance', 'Sigil'].map(name => entry(name, 'spell', {}, ['Cantrip']))]
  const c: Character = { ...base, level: 4, feats: [taken(source.name, 4)] }
  const grants = grantedFeatSpells(c, entries)
  expect(grants.map(grant => grant.entry.name)).toEqual(['Detect Magic', 'Guidance', 'Sigil'])
  expect(grants).toMatchObject(Array.from({ length: 3 }, () => ({
    rank: 2, rule: { kind: 'innate', tradition: 'divine', frequency: 'at will', condition: 'Only within your claimed territory' },
  })))
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Only within your claimed territory')
  expect(markup).toContain('>Detect Magic</button>')
  expect(markup).toContain('>Guidance</button>')
  expect(markup).toContain('>Sigil</button>')
  expect(grantedFeatSpells({ ...c, level: 3 }, entries)).toEqual([])
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
