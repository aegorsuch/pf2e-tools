import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, onTestFinished } from 'vitest'
import snapshot from '../public/data/aon-sf2e.json?raw'
import { mapAonHit } from './aon'
import { parseFeatSpellGrants } from './aonQuery'
import { canChangeUntamedForm, classDifficultyClass, classSpellcasting, eligibleFeats, featChoiceOptions, featSelectionPrerequisiteChecker, focusSpells, hitPointBonuses, knowsSpell, maxHp, movementSpeeds, oakenResilience, ownedWeapons, resistances, spellDifficultyClass, untamedFormOptions, weaponAttack } from './builder'
import { grantedWardenSpells } from './featChoices'
import { hellknightTrainingBenefit } from './hellknight'
import { automaticFeatChoiceKey, boneMagicChoiceOptions, dailyInnateUses, featSpellOptions, grantedFeatSpells, unresolvedFeatSpells, refocusRecovery } from './featSpells'
import { AnimalFeatureOptions, BoneShieldActions, CrocodileFormToggle, DevotionSpellChoice, DinosaurFormOptions, EnergizedFont, FalseVitalityActions, FloralRestoration, FocusPointTracker, InnateSpellUses, PestFormActions, PyreResistEnergyActions, SpellsSection, UntamedFormOptions } from './SpellsSection'
import { ClassFeatures } from './ClassFeatures'
import { WeaponList } from './GearSection'
import { MinionsSection } from './MinionsSection'
import { EntryDescription } from './EntryDescription'
import type { Character, ContentEntry } from './types'
import { homebrewCharacterOptions } from './supplemental'
import { getSettings, updateSettings } from './settings'

let previousAutoHeighten: boolean
beforeEach(() => {
  previousAutoHeighten = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
})
afterEach(() => updateSettings({ innateAutoHeighten: previousAutoHeighten }))

function necromancerFascinations() {
  return [['Blood', 'Blood Infusion'], ['Bone', 'Bone Spear'], ['Flesh', 'Dead Weight'], ['Spirit', 'Life Tap']]
    .map(([name, spell]) => mapAonHit({ _id: `grim-fascination-${name}`, _source: {
      category: 'grim-fascination', name, markdown: `**Grave Spell** [${spell}](/Spells.aspx?ID=1)`,
    } }, 'pf2e')!)
}

it('grants lesser, greater, and cross-trained order spells with correct ranks, restrictions, and independent daily uses', () => {
  const entries = ['Locate', 'Summon Fiend', 'Resist Energy', 'Heal', 'Unfettered Movement']
    .map(name => ({ ...entry(name, 'spell'), level: name === 'Summon Fiend' ? 5 : name === 'Locate' ? 3 : name === 'Unfettered Movement' ? 4 : name === 'Resist Energy' ? 2 : 1 }))
  const c: Character = { ...base, level: 12, feats: [taken('Hellknight Dedication', 2, 'Order of the Gate'),
    taken('Order Training', 8, 'Arcane'), taken('Advanced Order Training', 12, 'Occult'),
    taken('Order Cross-Training', 12, 'Order of the Pyre')] }
  const grants = grantedFeatSpells(c, entries)
  expect(grants.map(grant => [grant.entry.name, grant.rank, grant.rule.tradition])).toEqual([
    ['Locate', 3, 'Arcane'], ['Summon Fiend', 6, 'Occult'], ['Resist Energy', 2, 'Divine'],
  ])
  expect(grants[1].rule.condition).toBe('Devils only')
  expect(dailyInnateUses(c, grants[0])?.limit).toBe(1)
  expect(dailyInnateUses(c, grants[2])?.limit).toBe(2)
  expect(new Set(grants.map(grant => grant.usageKey)).size).toBe(3)
  expect(grantedFeatSpells({ ...c, level: 14 }, entries).slice(0, 2).map(grant => grant.rank)).toEqual([5, 7])
  const crossed = { ...c, level: 20, feats: [taken('Hellknight Dedication', 2, 'Order of the Pyre'),
    taken('Order Cross-Training', 12, 'Order of the Gate: Divine')] }
  expect(grantedFeatSpells(crossed, entries)[0].rank).toBe(3)
  expect(hellknightTrainingBenefit(c, 'Order Training', 'Arcane')?.description).toContain('rank 5 at level 14')
  expect(hellknightTrainingBenefit(crossed, 'Order Cross-Training', 'Order of the Gate: Divine')?.description).not.toContain('rank 5')
  const godclaw = { ...c, feats: [taken('Hellknight Dedication', 2, 'Order of the Godclaw'), taken('Advanced Order Training', 12)] }
  updateSettings({ innateAutoHeighten: true })
  expect(grantedFeatSpells(godclaw, entries)[0]).toMatchObject({ rank: 6, rule: { shared: true, fixedRank: true } })
  updateSettings({ innateAutoHeighten: false })
  const torrent = { ...godclaw, feats: [taken('Hellknight Dedication', 2, 'Order of the Torrent'), taken('Advanced Order Training', 12)] }
  expect(grantedFeatSpells(torrent, entries)[0]).toMatchObject({ entry: { name: 'Unfettered Movement' }, rank: 5 })
  expect(unresolvedFeatSpells(c, [])).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'Locate' }), expect.objectContaining({ name: 'Summon Fiend' }), expect.objectContaining({ name: 'Resist Energy' }),
  ]))
})

it('grants chosen Godclaw domain spells through native training or cross-training, without granting other domains', () => {
  const spell = { ...entry('Swear Oath', 'spell', { domain: 'Duty' }, ['Focus']), level: 1 }
  for (const cross of [false, true]) {
    const c: Character = { ...base, level: 12, feats: [
      taken('Hellknight Dedication', 2, cross ? 'Order of the Pyre' : 'Order of the Godclaw'),
      taken(cross ? 'Order Cross-Training' : 'Order Training', cross ? 12 : 8, cross ? 'Order of the Godclaw: Duty' : 'Duty'),
    ] }
    expect(grantedFeatSpells(c, [spell])).toHaveLength(1)
    expect(grantedFeatSpells(c, [spell])[0]).toMatchObject({ entry: { name: spell.name }, rank: 6,
      rule: { kind: 'focus', condition: 'Casting this domain spell grants 12 temporary HP for 1 round.' } })
    const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={() => {}} />)
    expect(markup).not.toContain('Casting this domain spell grants 12 temporary HP for 1 round.')
    expect(markup).not.toContain('aria-label="Swear Oath active"')
    expect(focusSpells(c, [spell])).toMatchObject({ points: 1, spells: [expect.objectContaining({ name: spell.name })] })
    expect(unresolvedFeatSpells(c, [])).toContainEqual(expect.objectContaining({ name: 'Duty domain focus spell' }))
    expect(grantedFeatSpells({ ...c, level: 7 }, [spell])).toEqual([])
  }
})

it('auto-heightens innate grants without changing uses, selections, focus spells, or higher granted ranks', () => {
  const passage = { ...entry('Magic Passage', 'spell'), level: 5 }
  const cairn = { ...entry('Cairn Form', 'spell'), level: 4 }
  const focus = { ...entry('Test Focus', 'spell', {}, ['Focus']), level: 1 }
  const source: ContentEntry = { ...entry('Test Innate Magic', 'feat'), spellGrants: [
    { kind: 'innate', spells: [passage.name], rank: 7, frequency: 'once per day' },
    { kind: 'innate', spells: [cairn.name], rank: 6, frequency: 'twice per day' },
    { kind: 'focus', spells: [focus.name] },
  ] }
  const entries = [passage, cairn, focus, source]
  let c: Character = { ...base, level: 19, feats: [taken(source.name)], activeSpells: [cairn.name] }
  const original = grantedFeatSpells(c, entries)
  const use = dailyInnateUses(c, original.find(grant => grant.entry.name === cairn.name)!)!
  c = { ...c, innateSpellUses: { [use.key]: [0] } }
  const saved = JSON.stringify(c)
  updateSettings({ innateAutoHeighten: true })
  const heightened = grantedFeatSpells(c, entries)
  expect(heightened.filter(grant => grant.rule.kind === 'innate').map(grant => grant.rank)).toEqual([10, 10])
  expect(heightened.find(grant => grant.rule.kind === 'focus')?.rank).toBe(original.find(grant => grant.rule.kind === 'focus')?.rank)
  expect(dailyInnateUses(c, heightened.find(grant => grant.entry.name === cairn.name)!)).toMatchObject({ key: use.key, remaining: 1 })
  expect(resistances(c, entries)).toContainEqual({ damage: 'Physical (except adamantine)', value: 20, source: cairn.name })
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Spell Rank 10')
  expect(grantedFeatSpells({ ...c, level: 9 }, entries).find(grant => grant.entry.name === passage.name)?.rank).toBe(7)
  updateSettings({ innateAutoHeighten: false })
  expect(grantedFeatSpells(c, entries).map(grant => grant.rank)).toEqual(original.map(grant => grant.rank))
  expect(resistances(c, entries)).toContainEqual({ damage: 'Physical (except adamantine)', value: 10, source: cairn.name })
  expect(JSON.stringify(c)).toBe(saved)
})

it('auto-heightens fixed-rank Primal Rampage spells and their effects, restoring source ranks when disabled', () => {
  const rampage = feat('Primal Rampage',
    'You gain [_unfettered movement_](/Spells.aspx?ID=1732) and [_mountain resilience_](/Spells.aspx?ID=1610) as 4th-rank primal innate spells that you can cast once per day.', 13)
  const entries = [rampage, ...['Unfettered Movement', 'Mountain Resilience'].map(name => ({
    ...entry(name, 'spell'), level: 4,
  }))]
  const c: Character = { ...base, level: 20, className: 'Necromancer', ancestry: 'Lizardfolk',
    feats: [taken(rampage.name, 13)], activeSpells: ['Mountain Resilience'] }
  const original = grantedFeatSpells(c, entries)
  expect(original.map(grant => grant.rank)).toEqual([4, 4])
  updateSettings({ innateAutoHeighten: true })
  const heightened = grantedFeatSpells(c, entries)
  expect(heightened.map(grant => grant.rank)).toEqual([10, 10])
  expect(heightened.map(grant => dailyInnateUses(c, grant))).toEqual(original.map(grant => dailyInnateUses(c, grant)))
  expect(resistances(c, entries)).toContainEqual({ damage: 'Physical (except adamantine)', value: 20, source: 'Mountain Resilience' })
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Primal Spell Rank 10')
  expect(markup).not.toContain('Primal Spell Rank 4')
  updateSettings({ innateAutoHeighten: false })
  expect(grantedFeatSpells(c, entries)).toEqual(original)
  expect(resistances(c, entries)).toContainEqual({ damage: 'Physical (except adamantine)', value: 5, source: 'Mountain Resilience' })
})

it('grants Lizardfolk innate spells with fixed ranks and daily use tracking', () => {
  const boneInvestiture = feat('Bone Investiture',
    'You can cast [_dinosaur form_](/Spells.aspx?ID=1) on yourself as a 5th-rank innate spell once per day.', 13)
  const fossilRider = feat('Fossil Rider',
    'You can cast [_mask of terror_](/Spells.aspx?ID=2) on yourself as an innate spell once per day.', 17)
  const spiritualHeadhunter = feat('Spiritual Headhunter',
    'Once before your next daily preparations, you can cast [_talking corpse_](/Spells.aspx?ID=3) as a primal innate spell.', 13)
  const spells = [entry('Dinosaur Form', 'spell'), entry('Mask of Terror', 'spell'), entry('Talking Corpse', 'spell')]
  const c: Character = { ...base, level: 17, ancestry: 'Lizardfolk',
    feats: [taken(boneInvestiture.name, 13), taken(fossilRider.name, 17), taken(spiritualHeadhunter.name, 13)] }
  const grants = grantedFeatSpells(c, [boneInvestiture, fossilRider, spiritualHeadhunter, ...spells])
  expect(grants.map(grant => [grant.entry.name, grant.rank, grant.rule.tradition])).toEqual([
    ['Dinosaur Form', 5, 'primal'], ['Mask of Terror', 1, 'primal'], ['Talking Corpse', 1, 'primal'],
  ])
  expect(grants.every(grant => dailyInnateUses(c, grant)?.limit === 1)).toBe(true)
})

it('applies selected cantrip from the automatically granted Kitsune Spell Familiarity feat', () => {
  const heritage = mapAonHit({ _id: 'heritage-empty-sky-kitsune', _source: {
    category: 'heritage', name: 'Empty Sky Kitsune', trait: ['Kitsune'],
    markdown: 'You gain the [Kitsune Spell Familiarity](/Feats.aspx?ID=2619) ancestry feat.',
  } }, 'pf2e')!
  const spell = { ...entry('Daze', 'spell', { tradition: 'Divine' }, ['Cantrip']), level: 0 }
  const c: Character = { ...base, level: 5, ancestry: 'Kitsune', heritage: heritage.name,
    automaticFeatChoices: { [automaticFeatChoiceKey(heritage.name, 'Kitsune Spell Familiarity')]: 'Daze' } }

  expect(grantedFeatSpells(c, [heritage, spell])).toMatchObject([{
    entry: { name: 'Daze' }, source: 'Empty Sky Kitsune', rank: 3,
    rule: { kind: 'innate', tradition: 'divine', frequency: 'at will', heightened: true },
  }])
})

it('casts and dismisses a selected Dinosaur Form from its two-action control at its actual innate rank', () => {
  const source = feat('Bone Investiture', 'You can cast [_dinosaur form_](/Spells.aspx?ID=1) on yourself as a 5th-rank innate spell once per day.', 13)
  const spell = { ...entry('Dinosaur Form', 'spell', { actions: 'Two Actions', duration: '1 minute' }), level: 4 }
  const entries = [source, spell]
  let c: Character = { ...base, level: 20, feats: [taken(source.name, 13)] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const render = () => renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
  expect(render()).toContain('aria-label="Choose Dinosaur Form"')
  const title = render().match(/<div class="spell-title">[\s\S]*?<\/div>/)?.[0] ?? ''
  expect(title.match(/class="action-cost"/g)).toHaveLength(1)
  expect(title).toMatch(/<button[^>]*aria-label="Choose Dinosaur Form"[^>]*><span class="action-cost" aria-label="Two Actions"/)
  expect(render()).toContain('Primal Spell Rank 5')
  expect(render()).toContain('<small>Range</small>Self')
  expect(render()).toContain('<small>Area/Targets</small>Self')
  expect(render()).not.toContain('Must target yourself')
  updateSettings({ innateAutoHeighten: true })
  expect(render()).toContain('Primal Spell Rank 10')
  const tree = () => DinosaurFormOptions({ c, save, rank: grantedFeatSpells(c, entries)[0].rank })
  const select = (node: ReactNode): ((event: { target: { value: string } }) => void) | undefined => {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<{ children?: ReactNode; onChange?: (event: { target: { value: string } }) => void }>(child)) continue
      if (child.type === 'select') return child.props.onChange
      const nested = select(child.props.children)
      if (nested) return nested
    }
  }
  select(tree())!({ target: { value: 'Not a dinosaur' } })
  expect(c.dinosaurForm).toBeUndefined()
  select(tree())!({ target: { value: 'Tyrannosaurus' } })
  expect(c).toMatchObject({ dinosaurForm: { form: 'Tyrannosaurus', rank: 10 }, activeSpells: ['Dinosaur Form'] })
  c = JSON.parse(JSON.stringify(c)) as Character
  expect(findUseButton(tree(), 'Dismiss Dinosaur Form')?.disabled).toBe(false)
  findUseButton(tree(), 'Dismiss Dinosaur Form')!.onClick()
  expect(c.activeSpells).toEqual([])
  expect(c.dinosaurForm).toBeUndefined()
})

it.each([9, 20])('auto-heightens and toggles only the Ancestral Form crocodile at level %i', level => {
  const source = feat('Ancestral Form',
    'You can cast [_animal form_](/Spells.aspx?ID=1440) as a 3rd-rank primal innate spell once per day. You can only target yourself and only take crocodile form.', 9)
  const spell = { ...entry('Animal Form', 'spell', { actions: 'Two Actions', duration: '1 minute' }), level: 2 }
  const entries = [source, spell]
  let c: Character = { ...base, level, ancestry: 'Lizardfolk', heritage: 'Bakuwa Lizardfolk',
    feats: [taken(source.name, 9)], activeSpells: ['Dinosaur Form', 'Shield'] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const grant = grantedFeatSpells(c, entries)[0]
  expect(grant).toMatchObject({ rank: Math.ceil(level / 2), rule: { tradition: 'primal', heightened: true } })
  expect(dailyInnateUses(c, grant)?.limit).toBe(1)
  const render = () => renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
  expect(render()).toContain(`Primal Spell Rank ${Math.ceil(level / 2)}`)
  const title = render().match(/<div class="spell-title">[\s\S]*?<\/div>/)?.[0] ?? ''
  expect(title.match(/class="action-cost"/g)).toHaveLength(1)
  expect(title).toMatch(/<button[^>]*aria-label="Crocodile Form options"[^>]*><span class="action-cost" aria-label="Two Actions"/)
  expect(render()).toContain(`Crocodile Form (Rank ${Math.ceil(level / 2)})`)
  expect(render()).toContain('Huge animal battle form')
  expect(render()).toContain(`AC ${level + 18}; temporary HP 20`)
  expect(render()).toContain('Jaws: 4d8 piercing')
  expect(render()).toContain('Tail: 2d8 bludgeoning (agile), reach 15 feet')
  expect(render()).toContain('<small>Range</small>Self')
  expect(render()).toContain('<small>Area/Targets</small>Self')
  expect(render()).not.toContain('Must target yourself; crocodile form only')
  const toggle = () => CrocodileFormToggle({ c, entries, save })
  const setActive = (checked: boolean) => {
    const input = Children.toArray(toggle().props.children).find(child =>
      isValidElement(child) && child.type === 'input')
    if (!isValidElement<{ onChange: (event: { target: { checked: boolean } }) => void }>(input)) throw Error('Missing toggle')
    input.props.onChange({ target: { checked } })
  }
  setActive(true)
  expect(c.activeSpells).toEqual(['Shield', 'Animal Form'])
  expect(ownedWeapons(c, entries).map(weapon => weapon.name)).toEqual(['Crocodile Jaws', 'Crocodile Tail'])
  c = JSON.parse(JSON.stringify(c)) as Character
  expect(render()).toContain('aria-label="Crocodile Form active" checked=""')
  setActive(false)
  expect(c.activeSpells).toEqual(['Shield'])
  expect(ownedWeapons(c, entries).some(weapon => weapon.name === 'Crocodile Jaws')).toBe(false)
})

it.each([7, 8, 10])('shows Mask of Terror heightened targets at rank %i', rank => {
  const source = feat('Fossil Rider', `You can cast [_mask of terror_](/Spells.aspx?ID=1) on yourself as a ${rank}th-rank innate spell once per day.`, 17)
  const spell = { ...entry('Mask of Terror', 'spell', { range: 30, targets: '1 creature' }), level: 7 }
  const c: Character = { ...base, level: 20, feats: [taken(source.name, 17)] }
  const entries = [source, spell]
  expect(grantedFeatSpells(c, entries)[0]).toMatchObject({ rank, rule: { tradition: 'primal', condition: 'Must target yourself' } })
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain(`<small>Area/Targets</small>${rank >= 8 ? 'Up to 5 creatures' : '1 creature'}`)
  expect(markup).not.toContain('Must target yourself')
})

it.each([['Blood', 'Blood Infusion'], ['Bone', 'Bone Spear'], ['Flesh', 'Dead Weight'], ['Spirit', 'Life Tap']])(
  'grants Necrotic Bomb and the %s fascination spell with two Focus Points at level 1',
  (subclass, name) => {
    const entries = [...necromancerFascinations(), entry('Necromancer', 'class', { tradition: 'Occult', attribute: 'Intelligence' }),
      entry(name, 'spell', {}, ['Focus', 'Necromancer']),
      entry('Necrotic Bomb', 'spell', { actions: 'Two Actions', saving_throw: 'basic Fortitude' }, ['Focus', 'Necromancer'])]
    const c: Character = { ...base, level: 1, className: 'Necromancer', subclass, feats: [] }
    expect(focusSpells(c, entries)).toEqual({ points: 2, spells: [
      { name, source: `${subclass} grim fascination` }, { name: 'Necrotic Bomb', source: 'Grave Spells' },
    ] })
    expect(knowsSpell(c, entries, name)).toBe(true)
    expect(knowsSpell(c, entries, 'Necrotic Bomb')).toBe(true)
    const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
    expect(markup).toContain(name)
    expect(markup).toContain('>Necrotic Bomb</button>')
    expect(markup).not.toContain('Focus Spells Rank')
    expect(focusSpells({ ...c, subclass: '' }, entries)).toEqual({
      points: 1, spells: [{ name: 'Necrotic Bomb', source: 'Grave Spells' }],
    })
    expect(focusSpells({ ...c, className: 'Wizard' }, entries)).toEqual({ points: 0, spells: [] })
    expect(focusSpells({ ...c, systems: ['sf2e'] }, entries)).toEqual({ points: 0, spells: [] })
  })

it('limits Widespread Fascination to other grim fascinations and preserves valid legacy spell selections', () => {
  const widespread = entry('Widespread Fascination', 'feat')
  const spells = [
    entry('Blood Infusion', 'spell', {}, ['Focus', 'Necromancer']),
    entry('Bone Spear', 'spell', {}, ['Focus', 'Necromancer']),
    entry('Dead Weight', 'spell', {}, ['Focus', 'Necromancer']),
    entry('Life Tap', 'spell', {}, ['Focus', 'Necromancer']),
    entry('Create Thrall', 'spell', {}, ['Cantrip', 'Necromancer']),
    entry('Deathly Scream', 'spell', {}, ['Focus', 'Necromancer']),
    entry('Song of the Soul', 'spell', {}, ['Focus', 'Necromancer']),
    { ...entry('Other Focus', 'spell', {}, ['Focus', 'Necromancer']), systems: ['sf2e' as const] },
  ]
  const c: Character = { ...base, level: 8, className: 'Necromancer', subclass: 'Spirit', feats: [
    { name: widespread.name, type: 'Class Feat', level: 4, choice: 'Blood', slot: 'class:4:0' },
    { name: widespread.name, type: 'Class Feat', level: 8, choice: 'Bone Spear', slot: 'class:8:0' },
  ] }
  const entries = [widespread, ...necromancerFascinations(), ...spells]
  expect(c.feats.map(feat => featSpellOptions(c, entries, feat)?.map(spell => spell.name))).toEqual([
    ['Blood Infusion', 'Dead Weight'], ['Bone Spear', 'Dead Weight'],
  ])
  expect(c.feats.map(feat => featChoiceOptions(feat.name, c, entries, feat.slot!))).toEqual([
    ['Blood', 'Flesh'], ['Bone', 'Flesh'],
  ])
  expect(featChoiceOptions(widespread.name, { ...c, subclass: '', feats: [] }, entries, 'class:1:0'))
    .toEqual(['Blood', 'Bone', 'Flesh', 'Spirit'])
  expect(grantedFeatSpells(c, entries).map(grant => grant.entry.name)).toEqual(['Blood Infusion', 'Bone Spear'])
  expect(focusSpells({ ...c, subclass: undefined, feats: [c.feats[0]] }, entries)).toEqual({
    points: 2, spells: [{ name: 'Blood Infusion', source: 'Widespread Fascination' }, { name: 'Necrotic Bomb', source: 'Grave Spells' }],
  })
  expect(focusSpells(c, entries)).toMatchObject({
    points: 3, spells: expect.arrayContaining([expect.objectContaining({ name: 'Blood Infusion' }), expect.objectContaining({ name: 'Bone Spear' }),
      expect.objectContaining({ name: 'Life Tap' }), expect.objectContaining({ name: 'Necrotic Bomb' })]),
  })
  for (const choice of ['Spirit', 'Life Tap', 'Deathly Scream', 'Song of the Soul']) {
    expect(grantedFeatSpells({ ...c, feats: [{ ...c.feats[0], choice }] }, entries)).toEqual([])
  }
  const standalone = ['Deathly Scream', 'Song of the Soul'].map(name =>
    feat(name, `You learn the [${name}](/Spells.aspx?ID=1) grave spell.`, 2))
  const separate = { ...c, feats: standalone.map(source => taken(source.name, 2)) }
  expect(grantedFeatSpells(separate, [...entries, ...standalone]).map(grant => grant.entry.name))
    .toEqual(['Deathly Scream', 'Song of the Soul'])
})

it.each(['int', 'wis', 'cha'] as const)('uses highest %s for innate attacks and DCs and restores source rules when disabled', highest => {
  const grant = feat('Mental Magic', 'You can cast [fear](/Spells.aspx?ID=1) and [ignition](/Spells.aspx?ID=2) as occult innate spells at will.', 5)
  const entries = [grant, entry('Fear', 'spell', { saving_throw: 'Will' }), entry('Ignition', 'spell', { saving_throw: 'AC' }, ['Attack'])]
  const character: Character = { ...base, abilities: { ...base.abilities, int: 10, wis: 10, cha: 10, [highest]: 22 },
    feats: [taken(grant.name, 5)] }
  const previous = getSettings().innateHighestMental
  const render = () => renderToStaticMarkup(<SpellsSection c={character} entries={entries} save={() => {}} />)
  try {
    updateSettings({ innateHighestMental: true })
    expect(render()).toContain('Will DC 23')
    expect(render()).toContain('AC, +13')
    updateSettings({ innateHighestMental: false })
    expect(render()).toContain(`Will DC ${highest === 'cha' ? 23 : 17}`)
    expect(render()).toContain(`AC, +${highest === 'cha' ? 13 : 7}`)
  } finally { updateSettings({ innateHighestMental: previous }) }
})

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

it('shows Halo Light as a heightened divine innate spell without helper text', () => {
  const light = { ...entry('Light', 'spell', {}, ['Cantrip']), level: 1 }
  const c: Character = { ...base, level: 9, feats: [taken('Halo')] }
  expect(grantedFeatSpells(c, [light])).toMatchObject([{ entry: { name: 'Light' }, source: 'Halo', rank: 5,
    rule: { kind: 'innate', tradition: 'divine' } }])
  expect(grantedFeatSpells(c, [light])[0].rule.condition).toBeUndefined()
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[light]} save={() => {}} />)
  expect(markup).toContain('Divine Spell Rank 5')
  expect(markup).toContain('<b>Innate Spells</b>')
  expect(markup).not.toContain('Halo sheds light')
  expect(unresolvedFeatSpells(c, []).map(item => item.name)).toContain('Light')
  expect(grantedFeatSpells({ ...c, feats: [] }, [light])).toEqual([])
  expect(grantedFeatSpells({ ...c, level: 0 }, [light])).toEqual([])
  expect(grantedFeatSpells({ ...c, systems: ['sf2e'] }, [light])).toEqual([])
})

it.each(['Bane', 'Bless'])('grants Extraplanar Supplication %s as a daily divine innate spell', choice => {
  const source = feat('Extraplanar Supplication', 'Choose either bane or bless.', 5)
  const spells = ['Bane', 'Bless'].map(name => entry(name, 'spell'))
  const c: Character = { ...base, level: 5, feats: [taken(source.name, 5, choice)] }
  const entries = [source, ...spells]
  expect(featChoiceOptions(source.name, c, entries, 'ancestry:5:0')).toEqual(['Bane', 'Bless'])
  const grants = grantedFeatSpells(c, entries)
  expect(grants).toHaveLength(1)
  expect(grants[0]).toMatchObject({ entry: { name: choice }, source: source.name, rank: 1,
    rule: { kind: 'innate', tradition: 'divine', frequency: 'once per day', fixedRank: true } })
  expect(dailyInnateUses(c, grants[0])?.limit).toBe(1)
  expect(unresolvedFeatSpells(c, [source])).toMatchObject([{ name: choice }])
  expect(grantedFeatSpells({ ...c, level: 4 }, entries)).toEqual([])
  expect(grantedFeatSpells({ ...c, systems: ['sf2e'] }, entries)).toEqual([])
  expect(grantedFeatSpells({ ...c, feats: [taken(source.name, 5, 'Fear')] }, entries)).toEqual([])
  expect(grantedFeatSpells({ ...c, feats: [taken(source.name, 5)] }, entries)).toEqual([])
})

it.each([
  ['Grimspawn', ['False Vitality', 'See the Unseen']],
  ['Pitborn', ['Paranoia', 'Shatter']],
  ['Hellspawn', ['Invisibility', 'Disguise Magic']],
] as const)('grants Fiendish Magic spells for %s', (lineage, names) => {
  const source = feat('Fiendish Magic', 'Choose two spells.', 9)
  const spells = names.map(name => entry(name, 'spell'))
  const c: Character = { ...base, level: 9, feats: [taken(lineage), taken(source.name, 9)] }
  const grants = grantedFeatSpells(c, [source, ...spells])
  expect(grants.map(grant => grant.entry.name)).toEqual(names)
  expect(grants).toMatchObject(names.map(name => ({ entry: { name }, source: source.name, rank: 2,
    rule: { kind: 'innate', tradition: 'divine', frequency: 'once per day', fixedRank: true } })))
  expect(new Set(grants.map(grant => grant.usageKey)).size).toBe(2)
  expect(grants.map(grant => dailyInnateUses(c, grant)?.limit)).toEqual([1, 1])
  expect(unresolvedFeatSpells(c, [source]).map(item => item.name)).toEqual(names)
  expect(grantedFeatSpells({ ...c, level: 8 }, [source, ...spells])).toEqual([])
  expect(grantedFeatSpells({ ...c, systems: ['sf2e'] }, [source, ...spells])).toEqual([])
  expect(grantedFeatSpells({ ...c, feats: [taken(lineage, 10), taken(source.name, 9)] }, [source, ...spells])).toEqual([])
  expect(grantedFeatSpells({ ...c, feats: [taken(source.name, 9)] }, [source, ...spells])).toEqual([])
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[source, ...spells]} save={() => {}} />)
  for (const name of names) expect(markup).toContain(name)
})

it('uses only the first-level lineage for Fiendish Magic', () => {
  const source = feat('Fiendish Magic', 'Choose two spells.', 9)
  const spells = ['Paranoia', 'Shatter', 'False Vitality', 'See the Unseen'].map(name => entry(name, 'spell'))
  const c: Character = { ...base, level: 9, feats: [taken('Pitborn'), taken('Grimspawn', 5), taken(source.name, 9)] }
  expect(grantedFeatSpells(c, [source, ...spells]).map(grant => grant.entry.name)).toEqual(['Paranoia', 'Shatter'])
  expect(grantedFeatSpells({ ...c, feats: c.feats.filter(feat => feat.name !== 'Pitborn') }, [source, ...spells])
    .map(grant => grant.entry.name)).toEqual([])
  const custom: ContentEntry = { ...entry('Custom Lineage', 'feat'), traits: ['Nephilim', 'Lineage'] }
  const customFirst = { ...c, feats: [taken(custom.name), taken('Pitborn', 5), taken(source.name, 9)] }
  expect(grantedFeatSpells(customFirst, [source, custom, ...spells])).toEqual([])
})

it('shows Shatter damage for Pitborn Fiendish Magic', () => {
  const spell = { ...entry('Shatter', 'spell', { actions: 'Two Actions' }), level: 2 }
  const c: Character = { ...base, level: 9, feats: [taken('Pitborn'), taken('Fiendish Magic', 9)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={() => {}} />)
  expect(markup).toContain('aria-label="Roll Shatter: Damage"')
  expect(markup).toContain('2d10 sonic')
  expect(markup.match(/aria-label="Roll Shatter: Damage"/g)).toHaveLength(1)
})

it.each([
  ['Angelkin', ['Clear Mind', 'Humanoid Form']],
  ['Lawbringer', ['Everlight', 'Share Life']],
  ['Musetouched', ['Revealing Light', 'Sure Footing']],
] as const)('grants Celestial Magic spells for first-level %s', (lineage, names) => {
  const source = feat('Celestial Magic', 'Choose two spells.', 9)
  const spells = names.map(name => entry(name, 'spell'))
  const c: Character = { ...base, level: 9, feats: [taken(lineage), taken(source.name, 9), taken('Pitborn', 5)] }
  const grants = grantedFeatSpells(c, [source, ...spells])
  expect(grants.map(grant => grant.entry.name)).toEqual(names)
  expect(grants).toMatchObject(names.map(name => ({ entry: { name }, rank: 2,
    rule: { kind: 'innate', tradition: 'divine', frequency: 'once per day' } })))
  expect(grants.map(grant => dailyInnateUses(c, grant)?.limit)).toEqual([1, 1])
})

it.each([
  ['Angelkin', 'Summon Celestial'], ['Lawbringer', 'Summon Celestial'], ['Musetouched', 'Summon Celestial'],
  ['Grimspawn', 'Summon Fiend'], ['Hellspawn', 'Summon Fiend'], ['Pitborn', 'Summon Fiend'],
  ['Faultspawn', 'Summon Fiend'], ['Aeonbound', 'Summon Monitor'], ['Battleblooded', 'Summon Monitor'], ['Proteankin', 'Summon Monitor'],
] as const)('grants %s lineage %s from Summon Nephilim Kin', (lineage, name) => {
  const source = feat('Summon Nephilim Kin', 'Summon an extraplanar creature.', 13)
  const spell = { ...entry(name, 'spell'), level: 5 }
  const c: Character = { ...base, level: 13, feats: [taken(lineage), taken('Pitborn', 5), taken(source.name, 13)] }
  const grants = grantedFeatSpells(c, [source, spell])
  expect(grants).toMatchObject([{ entry: { name }, source: source.name, rank: 5,
    rule: { kind: 'innate', tradition: 'divine', frequency: 'once per day', fixedRank: true } }])
  expect(dailyInnateUses(c, grants[0])?.limit).toBe(1)
  expect(unresolvedFeatSpells(c, [source]).map(item => item.name)).toEqual([name])
  expect(featSpellOptions(c, [source, spell], c.feats[2])).toBeUndefined()
  expect(grantedFeatSpells({ ...c, level: 12 }, [source, spell])).toEqual([])
  expect(grantedFeatSpells({ ...c, systems: ['sf2e'] }, [source, spell])).toEqual([])
})

it.each(['Grimspawn', 'Pitborn', 'Hellspawn'])('allows Fiendish Magic with %s prerequisite', lineage => {
  const source: ContentEntry = { ...entry('Fiendish Magic', 'feat'), level: 9, traits: ['Nephilim'],
    data: { prerequisite: 'Grimspawn, Pitborn, Hellspawn, or another lineage feat associated with fiends' } }
  const c: Character = { ...base, level: 9, ancestry: 'Human', heritage: 'Nephilim', feats: [taken(lineage)] }
  expect(eligibleFeats([source], c, { key: 'ancestry:9:0', category: 'ancestry', level: 9 })).toContain(source)
})

it('offers Psychic Talent occult cantrips in Innate Spells and heightens the selected spell', () => {
  const talent = mapAonHit({ _id: 'psychic-talent', _source: { name: 'Psychic Talent', category: 'feat', level: 1,
    trait: ['Lashunta', 'Shirren'], markdown: 'Header\n\n---\n\nChoose one cantrip from the occult spell list. You can cast this cantrip as an occult innate spell at will.' } }, 'sf2e')!
  const occult = entry('Daze', 'spell', { tradition: 'Occult, Divine' }, ['Cantrip'])
  const uncommon = entry('Uncommon Occult', 'spell', { tradition: 'Occult', rarity: 'uncommon' }, ['Cantrip', 'Uncommon'])
  const restricted = entry('Restricted Occult', 'spell', { tradition: 'Occult', access: 'Member of the Hellknights' }, ['Cantrip'])
  const arcane = entry('Arcane Only', 'spell', { tradition: 'Arcane' }, ['Cantrip'])
  const ranked = entry('Occult Rank One', 'spell', { tradition: 'Occult' })
  const focus = entry('Occult Focus', 'spell', { tradition: 'Occult' }, ['Cantrip', 'Focus'])
  const entries = [talent, occult, uncommon, restricted, arcane, ranked, focus]
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Lashunta', level: 7, feats: [taken(talent.name)] }
  expect(featSpellOptions(c, entries, c.feats[0])?.map(spell => spell.name)).toEqual(['Daze', 'Uncommon Occult'])
  expect(grantedFeatSpells(c, entries)).toEqual([])
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Innate Spells')
  expect(markup).toContain('aria-label="Psychic Talent spell"')
  expect(markup).toContain('Occult Spell Rank 4')
  expect(markup).toContain('class="spellbook-row"')
  expect(markup).toContain('0/1 spells')
  expect(markup).toContain('Uncommon Occult')
  expect(markup).not.toContain('Arcane Only')
  expect(markup).not.toContain('Restricted Occult')
  const selected: Character = { ...c, feats: [taken(talent.name, 1, 'Daze')] }
  expect(grantedFeatSpells(selected, entries)).toMatchObject([{ entry: { name: 'Daze' }, source: 'Psychic Talent', rank: 4,
    rule: { kind: 'innate', tradition: 'occult', frequency: 'at will', heightened: true } }])
  const selectedMarkup = renderToStaticMarkup(<SpellsSection c={selected} entries={entries} save={() => {}} />)
  expect(selectedMarkup).toContain('Clear Daze spell slot')
  expect(selectedMarkup).toContain('1 spells')
  expect(selectedMarkup).not.toContain('aria-label="Psychic Talent spell"')
  expect((selectedMarkup.match(/class="innate-spell-row"/g) ?? [])).toHaveLength(1)
  expect(grantedFeatSpells({ ...c, feats: [taken(talent.name, 1, 'Arcane Only')] }, entries)).toEqual([])
  expect(grantedFeatSpells({ ...selected, level: 0 }, entries)).toEqual([])
})

it('provides Psychic Mastery a common rank 2 occult spell slot and daily use', () => {
  const previous = getSettings().innateAutoHeighten
  const occult = { ...entry('Mind Spell', 'spell', { tradition: 'Occult' }), systems: ['sf2e' as const], level: 2 }
  const spells = [occult, { ...occult, name: 'Rare Mind', id: 'rare', traits: ['Rare'] },
    { ...occult, name: 'Uncommon Mind', id: 'uncommon', data: { ...occult.data, rarity: 'uncommon' } },
    { ...occult, name: 'Other Rank', id: 'other-rank', level: 3 },
    { ...occult, name: 'Other Tradition', id: 'other-tradition', data: { tradition: 'Arcane' } },
    { ...occult, name: 'Focus', id: 'focus', traits: ['Focus'] }]
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Lashunta', level: 9,
    feats: [taken('Psychic Mastery', 9)] }
  try {
    updateSettings({ innateAutoHeighten: false })
    expect(featSpellOptions(c, spells, c.feats[0])?.map(spell => spell.name)).toEqual(['Mind Spell'])
    const empty = renderToStaticMarkup(<SpellsSection c={c} entries={spells} save={() => {}} />)
    expect(empty).toContain('Occult Spell Rank 2')
    expect(empty).toContain('aria-label="Psychic Mastery spell"')
    expect(empty).toContain('0/1 spells')
    const selected = { ...c, feats: [taken('Psychic Mastery', 9, 'Mind Spell')] }
    const [grant] = grantedFeatSpells(selected, spells)
    expect(grant).toMatchObject({ source: 'Psychic Mastery', rank: 2,
      rule: { kind: 'innate', tradition: 'occult', frequency: 'once per day' } })
    expect(dailyInnateUses(selected, grant)?.remaining).toBe(1)
    const html = renderToStaticMarkup(<SpellsSection c={selected} entries={spells} save={() => {}} />)
    expect(html).toContain('Clear Mind Spell spell slot')
    expect(html).toContain('1 of 1 uses remaining')
    expect((html.match(/class="innate-spell-row"/g) ?? [])).toHaveLength(1)
    updateSettings({ innateAutoHeighten: true })
    expect(grantedFeatSpells(selected, spells)[0].rank).toBe(5)
  } finally { updateSettings({ innateAutoHeighten: previous }) }
})

it('provides Psychic Paragon a common rank 6 occult spell slot and daily use', () => {
  const previous = getSettings().innateAutoHeighten
  const occult = { ...entry('Occult Six', 'spell', { tradition: 'Occult' }), systems: ['sf2e' as const], level: 6 }
  const spells = [occult, { ...occult, name: 'Rare Six', id: 'rare', traits: ['Rare'] },
    { ...occult, name: 'Other Rank', id: 'other-rank', level: 2 },
    { ...occult, name: 'Other Tradition', id: 'other-tradition', data: { tradition: 'Arcane' } },
    { ...occult, name: 'Focus Six', id: 'focus', traits: ['Focus'] }]
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Lashunta', level: 17,
    feats: [taken('Psychic Paragon', 17)] }
  try {
    updateSettings({ innateAutoHeighten: false })
    expect(featSpellOptions(c, spells, c.feats[0])?.map(spell => spell.name)).toEqual(['Occult Six'])
    const empty = renderToStaticMarkup(<SpellsSection c={c} entries={spells} save={() => {}} />)
    expect(empty).toContain('Occult Spell Rank 6')
    expect(empty).toContain('aria-label="Psychic Paragon spell"')
    const selected = { ...c, feats: [taken('Psychic Paragon', 17, 'Occult Six')] }
    const [grant] = grantedFeatSpells(selected, spells)
    expect(grant).toMatchObject({ source: 'Psychic Paragon', rank: 6,
      rule: { kind: 'innate', tradition: 'occult', frequency: 'once per day' } })
    expect(dailyInnateUses(selected, grant)?.remaining).toBe(1)
    const html = renderToStaticMarkup(<SpellsSection c={selected} entries={spells} save={() => {}} />)
    expect(html).toContain('Clear Occult Six spell slot')
    expect(html).toContain('1 of 1 uses remaining')
    expect((html.match(/class="innate-spell-row"/g) ?? [])).toHaveLength(1)
    expect(grantedFeatSpells({ ...selected, level: 16 }, spells)).toEqual([])
    updateSettings({ innateAutoHeighten: true })
    expect(grantedFeatSpells(selected, spells)[0].rank).toBe(9)
  } finally { updateSettings({ innateAutoHeighten: previous }) }
})

it('shows Psychic Investigator innate spells with separate daily trackers', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: true })
  try {
    const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Lashunta', level: 13,
      feats: [taken('Psychic Investigator', 13)] }
    const spells = ['Hypercognition', 'Mind Reading'].map(name =>
      ({ ...entry(name, 'spell'), systems: ['sf2e' as const], level: 3 }))
    const html = renderToStaticMarkup(<SpellsSection c={c} entries={spells} save={() => {}} />)
    expect(html).toContain('Hypercognition')
    expect(html).toContain('Mind Reading')
    expect(html).toContain('Occult Spell Rank 7')
    expect((html.match(/1 of 1 uses remaining/g) ?? [])).toHaveLength(2)
  } finally { updateSettings({ innateAutoHeighten: previous }) }
})

it('shows Tectonic Psychic Wall of Fire and Burstmoji with damage rolls', () => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Lashunta', level: 17,
    feats: [taken('Tectonic Psychic', 17)] }
  const spells = ['Wall of Fire', 'Burstmoji'].map(name =>
    ({ ...entry(name, 'spell', { actions: name === 'Burstmoji' ? 'Two Actions' : 'Three Actions' }), systems: ['sf2e' as const], level: 4 }))
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={spells} save={() => {}} />)
  expect(html).toContain('aria-label="Roll Wall of Fire: Damage"')
  expect(html).toContain('aria-label="Roll Burstmoji: Damage and Hazardous terrain"')
  expect((html.match(/1 of 1 uses remaining/g) ?? [])).toHaveLength(2)
  expect(html).not.toContain('Spell data unavailable')
})

it('shows the Burstmoji substitution in Tectonic Psychic details', () => {
  const hit = (JSON.parse(snapshot) as Parameters<typeof mapAonHit>[0][]).find(item => item._source?.name === 'Tectonic Psychic')!
  const feat = mapAonHit(hit, 'sf2e')!
  const html = renderToStaticMarkup(<EntryDescription name={feat.name} entry={feat} />)
  expect(html).toContain('Burstmoji (substituted for uncanny eruption)')
  expect(html).not.toContain('Nethys Note')
})

it('tracks Natural Illusionist alternatives in one daily pool with their specific heightened rank', () => {
  const entries = ['Illusory Disguise', 'Item Facade', 'Ventriloquism'].map(name => entry(name, 'spell'))
  const c: Character = { ...base, level: 7, feats: [taken('Natural Illusionist', 5)] }
  const grants = grantedFeatSpells(c, entries)
  expect(grants).toHaveLength(3)
  expect(grants.every(grant => grant.rule.kind === 'feat' && grant.rule.shared && grant.rank === 2)).toBe(true)
  expect(new Set(grants.map(grant => grant.usageKey)).size).toBe(1)
  const spent = { ...c, innateSpellUses: { [grants[0].usageKey]: [0] } }
  expect(grants.map(grant => dailyInnateUses(spent, grant)?.remaining)).toEqual([0, 0, 0])
  expect(grantedFeatSpells({ ...c, level: 5 }, entries)[0].rank).toBe(1)
  expect(grantedFeatSpells({ ...c, level: 19 }, entries)[0].rank).toBe(8)
  expect(grantedFeatSpells({ ...c, level: 4 }, entries)).toEqual([])
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Feat Spells')
  expect(html).toContain('1 of 1 uses remaining (shared)')
  expect(html).toContain('Tradition and spell DC are not specified')
})

it('adds Tengu Feather Fan spells with Wind God\'s and Thunder God\'s Fan sharing up to three daily activations', () => {
  const entries = [['Gust of Wind', 3], ['Wall of Wind', 3], ['Lightning Bolt', 3]].map(([name]) => entry(name as string, 'spell'))
  const fan = taken('Tengu Feather Fan', 5)
  const names = (c: Character) => grantedFeatSpells(c, entries).map(grant => `${grant.entry.name}:${grant.rank}:${dailyInnateUses(c, grant)?.limit}`)
  expect(names({ ...base, level: 5, feats: [fan] })).toEqual(['Gust of Wind:1:1'])
  expect(names({ ...base, level: 9, feats: [fan, taken("Wind God's Fan", 9)] })).toEqual(['Gust of Wind:1:2', 'Wall of Wind:3:2'])
  expect(names({ ...base, level: 13, feats: [fan, taken("Wind God's Fan", 9), taken("Thunder God's Fan", 13)] }))
    .toEqual(['Gust of Wind:1:3', 'Wall of Wind:3:3', 'Lightning Bolt:5:3'])
  expect(names({ ...base, level: 13, feats: [fan, taken("Thunder God's Fan", 13)] })).toEqual(['Gust of Wind:1:2', 'Lightning Bolt:5:2'])
})

it('grants Hurricane Swing a choice of 6th-rank lightning bolt or gust of wind in one daily pool', () => {
  const entries = ['Lightning Bolt', 'Gust of Wind'].map(name => entry(name, 'spell'))
  const c: Character = { ...base, level: 17, feats: [taken('Hurricane Swing', 17)] }
  const grants = grantedFeatSpells(c, entries)
  expect(grants.map(grant => [grant.entry.name, grant.rank])).toEqual([['Lightning Bolt', 6], ['Gust of Wind', 6]])
  expect(new Set(grants.map(grant => grant.usageKey)).size).toBe(1)
  expect(dailyInnateUses(c, grants[0])?.limit).toBe(1)
})

it('grants Trickster Tengu a choice of 7th-rank aerial form or cursed metamorphosis in one daily pool', () => {
  const entries = ['Aerial Form', 'Cursed Metamorphosis'].map(name => entry(name, 'spell'))
  const grants = grantedFeatSpells({ ...base, level: 17, feats: [taken('Trickster Tengu', 17)] }, entries)
  expect(grants.map(grant => [grant.entry.name, grant.rank])).toEqual([['Aerial Form', 7], ['Cursed Metamorphosis', 7]])
  expect(new Set(grants.map(grant => grant.usageKey)).size).toBe(1)
})

it('grants Great Tengu Form 4th-rank enlarge and fly from one daily use', () => {
  const entries = ['Enlarge', 'Fly'].map(name => entry(name, 'spell'))
  const grants = grantedFeatSpells({ ...base, level: 17, feats: [taken('Great Tengu Form', 17)] }, entries)
  expect(grants.map(grant => [grant.entry.name, grant.rank])).toEqual([['Enlarge', 4], ['Fly', 4]])
  expect(new Set(grants.map(grant => grant.usageKey)).size).toBe(1)
})

it('grants True Shapeshifter one daily class spell with its permitted forms', () => {
  const nature = { ...entry('Nature Incarnate', 'spell', { tradition: 'Primal' }), level: 10 }
  const c: Character = { ...base, className: 'Druid', level: 20, feats: [taken('True Shapeshifter', 20)] }
  const [grant] = grantedFeatSpells(c, [nature])
  expect(grant).toMatchObject({ entry: { name: 'Nature Incarnate' }, rank: 10,
    rule: { kind: 'feat', tradition: 'primal', condition: 'Kaiju form only' } })
  expect(dailyInnateUses(c, grant)?.limit).toBe(1)
  expect(grantedFeatSpells({ ...c, level: 19 }, [nature])).toEqual([])
  expect(grantedFeatSpells({ ...c, feats: [...c.feats, taken('Plant Shape', 18)] }, [nature])[0].rule.condition)
    .toBe('Kaiju or green man form only')
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={[nature]} save={() => {}} />)).toContain('Kaiju form only')
})

it('grants Plant Shape a daily plant form only without Untamed Form', () => {
  const plant = { ...entry('Plant Form', 'spell'), level: 5 }
  const c: Character = { ...base, className: 'Druid', level: 12, feats: [taken('Plant Shape', 10)] }
  const [grant] = grantedFeatSpells(c, [plant])
  expect(grant).toMatchObject({ entry: plant, rank: 6, rule: { kind: 'feat', tradition: 'primal', frequency: 'once per day' } })
  expect(dailyInnateUses(c, grant)?.remaining).toBe(1)
  expect(grantedFeatSpells({ ...c, level: 9 }, [plant])).toEqual([])
  expect(grantedFeatSpells({ ...c, feats: [...c.feats, taken('Untamed Form')] }, [plant])).toEqual([])
  expect(unresolvedFeatSpells(c, [])).toMatchObject([{ name: 'Plant Form' }])
})

it('uses Druid archetype slot progression for Plant Shape rather than the primary class slots', () => {
  const plant = { ...entry('Plant Form', 'spell'), level: 5 }
  const c: Character = { ...base, className: 'Wizard', level: 20,
    feats: [taken('Plant Shape', 10), taken('Basic Druid Spellcasting', 4),
      taken('Expert Druid Spellcasting', 12), taken('Master Druid Spellcasting', 18)] }
  for (const [level, rank] of [[14, 5], [16, 6], [18, 7], [20, 8]] as const) {
    const character = { ...c, level }
    const [grant] = grantedFeatSpells(character, [plant])
    expect(grant.rank).toBe(rank)
    expect(dailyInnateUses(character, grant)?.remaining).toBe(1)
  }
  expect(grantedFeatSpells({ ...c, level: 12 }, [plant])).toEqual([])
  expect(unresolvedFeatSpells({ ...c, level: 12 }, [plant])[0].name).toContain('below 5')
  const basicOnly = { ...c, feats: c.feats.filter(feat => !/^(Expert|Master) Druid Spellcasting$/.test(feat.name)) }
  expect(grantedFeatSpells(basicOnly, [plant])).toEqual([])
  expect(unresolvedFeatSpells({ ...c, feats: [taken('Plant Shape', 10)] }, [plant])[0].name).toContain('unavailable')
})

it('applies Plant and Dragon Shape resistances only while Untamed Form is active', () => {
  const c: Character = { ...base, className: 'Druid', level: 12, feats: [
    taken('Untamed Form'), taken('Plant Shape', 10), taken('Dragon Shape', 12),
  ], dragonShapeResistance: 'bludgeoning', activeSpells: ['Untamed Form'] }
  expect(resistances(c, [])).toEqual(expect.arrayContaining([
    { damage: 'Poison', value: 5, source: 'Plant Shape (polymorphed)' },
    { damage: 'Bludgeoning', value: 5, source: 'Dragon Shape (polymorphed)' },
  ]))
  expect(resistances({ ...c, activeSpells: [] }, [])).toEqual([])
  expect(resistances({ ...c, dragonShapeResistance: undefined }, [])).not.toContainEqual(
    expect.objectContaining({ source: 'Dragon Shape (polymorphed)' }))
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('aria-label="Dragon Shape resistance"')
})

it('tracks Homeward Bound twice weekly with its planar restriction and heritage tradition', () => {
  const teleport = { ...entry('Interplanar Teleport', 'spell'), level: 7 }
  const c: Character = { ...base, level: 17, ancestry: 'Gnome', heritage: 'Wellspring Gnome',
    gnomeHeritageMagic: { tradition: 'Occult' }, feats: [taken('Homeward Bound', 17)] }
  const [grant] = grantedFeatSpells(c, [teleport])
  expect(grant).toMatchObject({ rank: 7, rule: { kind: 'innate', tradition: 'Occult', frequency: 'twice per week',
    condition: 'Only between the First World and the Universe; no planar key required' } })
  expect(dailyInnateUses(c, grant)?.limit).toBe(2)
  expect(dailyInnateUses({ ...c, innateSpellUses: { [grant.usageKey]: [0] } }, grant)?.remaining).toBe(1)
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={[teleport]} save={() => {}} />)).toContain('twice per week')
  expect(grantedFeatSpells({ ...c, level: 16 }, [teleport])).toEqual([])
})

it('applies and clears Pyre Resist Energy selections, including heightened defaults', () => {
  let c: Character = { ...base, level: 12, feats: [
    taken('Hellknight Dedication', 2, 'Order of the Gate'), taken('Order Cross-Training', 12, 'Order of the Pyre'),
  ] }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  type Control = { value?: string | number; onChange: (event: { target: { value: string } }) => void }
  const find = (label: string, rank: number): Control => {
    const search = (node: ReactNode): Control | undefined => {
      for (const child of Children.toArray(node)) {
        if (!isValidElement<{ children?: ReactNode; 'aria-label'?: string } & Control>(child)) continue
        if (child.props['aria-label'] === label) return child.props
        const found = search(child.props.children)
        if (found) return found
      }
    }
    const control = search(PyreResistEnergyActions({ c, save, rank }).props.children)
    if (!control) throw Error(`Missing ${label}`)
    return control
  }
  for (const type of ['acid', 'cold', 'electricity', 'fire', 'sonic']) {
    find('Resist Energy type', 2).onChange({ target: { value: type } })
    expect(resistances(c, [])).toContainEqual({ damage: type[0].toUpperCase() + type.slice(1), value: type === 'fire' ? 12 : 5, source: 'Resist Energy' })
  }
  find('Resist Energy type', 4).onChange({ target: { value: 'cold' } })
  expect(c.pyreResistEnergy).toEqual({ damage: 'cold', value: 10 })
  find('Resist Energy type', 7).onChange({ target: { value: 'fire' } })
  expect(c.pyreResistEnergy).toEqual({ damage: 'fire', value: 15 })
  find('Resist Energy amount', 7).onChange({ target: { value: '5' } })
  expect(resistances(c, [])).not.toContainEqual(expect.objectContaining({ source: 'Resist Energy' }))
  find('Resist Energy amount', 7).onChange({ target: { value: '20' } })
  expect(resistances(c, [])).toContainEqual({ damage: 'Fire', value: 20, source: 'Resist Energy' })
  expect(resistances({ ...c, feats: c.feats.slice(0, 1) }, [])).not.toContainEqual(expect.objectContaining({ source: 'Resist Energy' }))
  expect(resistances({ ...c, feats: [c.feats[0], { ...c.feats[1], choice: 'Order of the Chain' }] }, []))
    .not.toContainEqual(expect.objectContaining({ source: 'Resist Energy' }))
  find('Resist Energy amount', 7).onChange({ target: { value: '' } })
  expect(resistances(c, [])).not.toContainEqual(expect.objectContaining({ source: 'Resist Energy' }))
  find('Resist Energy type', 7).onChange({ target: { value: '' } })
  expect(c.pyreResistEnergy).toBeUndefined()
})

it('renders a clickable Pyre Resist Energy action without its restriction helper text', () => {
  const spell = { ...entry('Resist Energy', 'spell', { actions: 'Two Actions' }), level: 2 }
  const c: Character = { ...base, level: 12, feats: [
    taken('Hellknight Dedication', 2, 'Order of the Chain'), taken('Order Cross-Training', 12, 'Order of the Pyre'),
  ] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={() => {}} />)
  expect(html).toContain('aria-label="Resist Energy type"')
  expect(html).not.toContain('Self only. Fire resistance is at least 12.')
  expect(html.match(/aria-label="Resist Energy options"/g)).toHaveLength(1)
  expect(html).toContain('aria-label="Two Actions"')
})

it('toggles Bone Shield and clears its raised state when ending the spell', () => {
  let c: Character = { ...base, activeSpells: ['Keen Smell', 'Shield'], boneShieldRaised: true }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const spell = entry('Bone Shield', 'spell', { actions: 'Single Action' })
  const toggle = () => {
    const tree = BoneShieldActions({ c, save, rank: 1, entry: spell })
    const label = Children.only(tree.props.children)
    if (!isValidElement<{ children: ReactNode }>(label)) throw Error('Missing toggle')
    const input = Children.toArray(label.props.children).find(child => isValidElement(child) && child.type === 'input')
    if (!isValidElement<{ checked: boolean; onChange: (event: { target: { checked: boolean } }) => void }>(input)) throw Error('Missing input')
    return input.props
  }
  expect(toggle().checked).toBe(false)
  toggle().onChange({ target: { checked: true } })
  expect(c.activeSpells).toEqual(['Keen Smell', 'Bone Shield'])
  expect(c.boneShieldRaised).toBe(false)
  c.boneShieldRaised = true
  expect(toggle().checked).toBe(true)
  toggle().onChange({ target: { checked: false } })
  expect(c.activeSpells).toEqual(['Keen Smell'])
  expect(c.boneShieldRaised).toBe(false)
})

it('toggles False Vitality HP at its cast rank and preserves the effect across saves', () => {
  let c: Character = { ...base, activeSpells: ['Keen Smell'] }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const spell = { ...entry('False Vitality', 'spell', { actions: 'Two Actions' }), level: 2 }
  const initialHp = maxHp(c, [])
  const toggle = (rank: number) => {
    const tree = FalseVitalityActions({ c, save, rank, entry: spell })
    const label = Children.only(tree.props.children)
    if (!isValidElement<{ children: ReactNode }>(label)) throw Error('Missing toggle')
    const input = Children.toArray(label.props.children).find(child => isValidElement(child) && child.type === 'input')
    if (!isValidElement<{ disabled?: boolean; checked: boolean; onChange: (event: { target: { checked: boolean } }) => void }>(input)) throw Error('Missing input')
    return input.props
  }
  expect(toggle(2).checked).toBe(false)
  expect(toggle(1).disabled).toBe(true)
  toggle(2).onChange({ target: { checked: true } })
  expect(maxHp(c, [])).toBe(initialHp + 10)
  expect(hitPointBonuses(c)).toContainEqual({ source: 'False Vitality', value: 10 })
  expect(c.activeSpells).toEqual(['Keen Smell', 'False Vitality'])
  toggle(2).onChange({ target: { checked: false } })
  expect(maxHp(c, [])).toBe(initialHp)
  toggle(6).onChange({ target: { checked: true } })
  expect(maxHp(c, [])).toBe(initialHp + 22)
  expect(c.falseVitalityRank).toBe(6)
  expect(toggle(2).checked).toBe(true)
  expect(maxHp({ ...c, falseVitalityRank: 11 }, [])).toBe(initialHp)
  toggle(2).onChange({ target: { checked: false } })
  expect(c.activeSpells).toEqual(['Keen Smell'])
  expect(c.falseVitalityRank).toBeUndefined()
})

it('offers False Vitality activation at the granted innate rank', () => {
  const vitality = { ...entry('False Vitality', 'spell', { actions: 'Two Actions' }), level: 2 }
  const grant: ContentEntry = { ...entry('Vitality Magic', 'feat'), spellGrants: [
    { kind: 'innate', spells: [vitality.name], rank: 4, tradition: 'Occult' },
  ] }
  const c: Character = { ...base, feats: [taken(grant.name)] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[grant, vitality]} save={() => {}} />)
  expect(html).toContain('False Vitality (Rank 4)</h4>')
  expect(html).toContain('aria-label="False Vitality active"')
})

it('restores an explicit innate Wisdom ability when highest-mental rule is disabled', () => {
  const grant: ContentEntry = { ...entry('Wise Spark', 'feat'), spellGrants: [
    { kind: 'innate', spells: ['Fear'], ability: 'wis', rank: 1, tradition: 'Divine' },
  ] }
  const c: Character = { ...base, abilities: { ...base.abilities, int: 22, wis: 18 }, feats: [taken(grant.name)] }
  const render = () => renderToStaticMarkup(<SpellsSection c={c} entries={[grant, entry('Fear', 'spell', { saving_throw: 'Will' })]} save={() => {}} />)
  const previous = getSettings().innateHighestMental
  try {
    updateSettings({ innateHighestMental: true })
    expect(render()).toContain('Will DC 23')
    updateSettings({ innateHighestMental: false })
    expect(render()).toContain('Will DC 21')
  } finally { updateSettings({ innateHighestMental: previous }) }
})

it('keeps exact spell names, aliases, systems and refreshed content correct with indexed grants', () => {
  const source: ContentEntry = { ...entry('Quiet Steps', 'feat'), spellGrants: [
    { kind: 'innate', spells: ['Pass Without Trace'], heightened: true },
  ] }
  const alias: ContentEntry = { ...entry('Vanishing Tracks', 'spell'), id: 'pf-alias', systems: ['pf2e'] }
  const sfAlias: ContentEntry = { ...alias, id: 'sf-alias', systems: ['sf2e'] }
  const exact: ContentEntry = { ...alias, id: 'exact', name: 'Pass Without Trace' }
  const catalog = [source, sfAlias, alias, exact]
  const c: Character = { ...base, systems: ['pf2e'], feats: [taken(source.name)] }
  expect(grantedFeatSpells(c, catalog).map(grant => grant.entry.id)).toEqual([exact.id])
  expect(grantedFeatSpells({ ...c, systems: ['sf2e'] }, catalog).map(grant => grant.entry.id)).toEqual([sfAlias.id])
  expect(unresolvedFeatSpells(c, catalog)).toEqual([])
  const refreshed = [source, sfAlias, alias, { ...exact, deleted: true }]
  expect(grantedFeatSpells(c, refreshed).map(grant => grant.entry.id)).toEqual([alias.id])
  expect(unresolvedFeatSpells(c, [source, { ...alias, deleted: true }]).map(grant => grant.name)).toEqual(['Pass Without Trace'])
})

it('grants Bone Caller phantom steed through its remastered Marvelous Mount name', () => {
  const boneCaller: ContentEntry = { ...entry('Bone Caller', 'feat'), spellGrants: [
    { kind: 'innate', spells: ['animal messenger', 'phantom steed'], tradition: 'primal', frequency: 'once per day' },
  ] }
  const messenger = entry('Animal Messenger', 'spell')
  const mount = entry('Marvelous Mount', 'spell')
  const c: Character = { ...base, level: 9, feats: [taken(boneCaller.name, 9)] }
  expect(grantedFeatSpells(c, [boneCaller, messenger, mount]).map(grant => grant.entry.name))
    .toEqual(['Animal Messenger', 'Marvelous Mount'])
})

it('offers As Mutable as Nature only after acquiring the ability to cast Untamed Form', () => {
  const mutable = homebrewCharacterOptions([]).find(entry => entry.name === 'As Mutable as Nature')!
  const c: Character = { ...base, className: 'Druid', order: 'Untamed', level: 20,
    feats: [{ ...taken('Untamed Form'), type: 'Class Feat', slot: 'class:10:0' }] }
  const slot = { category: 'class' as const, level: 12, key: 'class:12:0' }
  expect(eligibleFeats([mutable], c, slot)).toContain(mutable)
  expect(eligibleFeats([mutable], c, { ...slot, level: 10 })).not.toContain(mutable)
  expect(eligibleFeats([mutable], { ...c, feats: [] }, slot)).not.toContain(mutable)
  expect(eligibleFeats([mutable], { ...c, feats: [], spells: [
    { name: 'Untamed Form', rank: 6, cantrip: false },
  ] }, slot)).toContain(mutable)
  expect(eligibleFeats([mutable], { ...c, feats: [], spells: [
    { name: 'Untamed Shift', rank: 6, cantrip: false },
  ] }, slot)).not.toContain(mutable)
  expect(featSelectionPrerequisiteChecker({ ...c, feats: [
    { ...c.feats[0], slot: 'class:14:0' },
  ] }, [mutable], slot)(mutable)).toEqual({ missing: [], manual: [] })
  expect(mutable.data).toMatchObject({ actions: 'Single Action', class: 'Druid' })
})

it('limits Untamed Form lists by cast rank, shape feats and acquisition level', () => {
  const c: Character = { ...base, level: 12, feats: [
    taken('Untamed Form'), taken('Insect Shape', 6), taken('Soaring Shape', 8),
    taken('Dragon Shape', 12), taken('Monstrosity Shape', 16),
  ] }
  const names = (character: Character) => untamedFormOptions(character).map(option => option.name)
  expect(names(c)).toEqual(expect.arrayContaining(['Animal Form', 'Insect Form', 'Aerial Form (Bat or Bird)',
    'Aerial Form (Wasp)', 'Dragon Form']))
  expect(names(c)).not.toContain('Dinosaur Form')
  expect(names(c)).not.toContain('Aerial Form (Pterosaur)')
  expect(names(c).some(name => name.startsWith('Monstrosity Form'))).toBe(false)
  expect(names({ ...c, level: 11 })).not.toContain('Dragon Form')
  const controlled = { ...c, feats: [...c.feats, taken('Form Control', 4)], untamedForm: { rank: 4 } }
  expect(names(controlled)).not.toContain('Dragon Form')
  expect(untamedFormOptions(controlled).find(option => option.name === 'Animal Form')?.duration).toBe('1 hour')
  expect(untamedFormOptions({ ...controlled, level: 18, untamedForm: { rank: 7 },
    feats: [...controlled.feats, taken('Perfect Form Control', 18)] })[0].duration).toBe('unlimited')
  expect(names({ ...c, untamedForm: { rank: 2 } })).toContain('Dragon Form')
  expect(names({ ...c, feats: [...c.feats, taken('Ferocious Shape', 8)] })).toContain('Aerial Form (Pterosaur)')
  expect(names({ ...c, level: 16 })).toContain('Monstrosity Form (Phoenix)')
  expect(names({ ...c, level: 16, feats: c.feats.filter(feat => feat.name !== 'Soaring Shape') }))
    .not.toContain('Monstrosity Form (Phoenix)')
})

it('persists one-action form changes without recasting, restoring focus, or resetting the original duration', () => {
  let c: Character = { ...base, className: 'Druid', level: 12,
    feats: [taken('Untamed Form'), taken('As Mutable as Nature', 12), taken('Insect Shape', 6)],
    activeSpells: ['Untamed Form'], spentFocusPoints: [0],
    untamedForm: { form: 'Animal Form', shape: 'Bear', rank: 6, originalDuration: '1 minute' } }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const controls = () => UntamedFormOptions({ c, entries: [], save })
  type Control = { disabled?: boolean; value?: unknown; onChange: (event: { target: { value: string } }) => void }
  const find = (label: string, node: ReactNode = controls()): Control | undefined => {
    let found: Control | undefined
    Children.forEach(node, child => {
      if (found || !isValidElement<{ children?: ReactNode; 'aria-label'?: string } & Control>(child)) return
      found = child.props['aria-label'] === label ? child.props
        : child.props.children !== undefined ? find(label, child.props.children) : undefined
    })
    return found
  }
  expect(canChangeUntamedForm(c, [])).toBe(true)
  expect(find('Untamed Form cast rank')?.disabled).toBe(true)
  find('Untamed Form list')!.onChange({ target: { value: 'Insect Form' } })
  expect(c.untamedForm).toEqual({ form: 'Insect Form', shape: undefined, rank: 6, originalDuration: '1 minute' })
  find('Untamed Form shape')!.onChange({ target: { value: 'Mantis' } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.untamedForm?.shape).toBe('Mantis')
  expect(c.spentFocusPoints).toEqual([0])
  expect(c.activeSpells).toEqual(['Untamed Form'])
  find('Untamed Form list')!.onChange({ target: { value: 'Pest Form' } })
  expect(c.untamedForm?.originalDuration).toBe('1 minute')
  find('Untamed Form list')!.onChange({ target: { value: 'Dragon Form' } })
  expect(c.untamedForm?.form).toBe('Pest Form')
  expect(renderToStaticMarkup(controls())).toContain('Each form change costs 1 action.')
  for (const originalDuration of ['10 minutes', '24 hours', '1 hour', 'unlimited'] as const) {
    c = { ...c, untamedForm: { ...c.untamedForm, originalDuration } }
    expect(canChangeUntamedForm(c, [])).toBe(false)
    expect(find('Untamed Form list')?.disabled).toBe(true)
    find('Untamed Form list')!.onChange({ target: { value: 'Animal Form' } })
    expect(c.untamedForm?.form).toBe('Pest Form')
  }
  c = { ...c, untamedForm: { form: 'Animal Form', originalDuration: '1 minute' }, level: 11 }
  expect(canChangeUntamedForm(c, [])).toBe(false)
  c = { ...c, level: 12, activeSpells: [] }
  expect(canChangeUntamedForm(c, [])).toBe(false)
  find('Untamed Form list')!.onChange({ target: { value: 'Pest Form' } })
  expect(c.untamedForm?.originalDuration).toBe('10 minutes')
  find('Untamed Form list')!.onChange({ target: { value: 'Pest Form (Non-flying Insect)' } })
  expect(c.untamedForm?.originalDuration).toBe('24 hours')
  c = { ...c, activeSpells: ['Untamed Form'], feats: c.feats.filter(feat => feat.name !== 'Untamed Form'),
    untamedForm: { originalDuration: '1 minute' } }
  expect(canChangeUntamedForm(c, [])).toBe(false)
})

it('grants Mortal Heart its modified eighth-rank innate spell once daily', () => {
  const renewal = entry('Moment of Renewal', 'spell')
  const c: Character = { ...base, level: 17, feats: [taken('Mortal Heart', 17)] }
  expect(grantedFeatSpells(c, [renewal])).toMatchObject([{
    entry: renewal, rank: 8, rule: { tradition: 'primal', frequency: 'once per day',
      condition: 'Up to six living creatures within 100 feet who can hear you, including yourself' },
  }])
  expect(grantedFeatSpells({ ...c, level: 16 }, [renewal])).toEqual([])
})

it("grants Grandmother's Favorite with an explicitly labeled Pathfinder reference when Starfinder data is missing", () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 17, feats: [taken("Grandmother's Favorite", 17)] }
  const [grant] = grantedFeatSpells(c, [])
  expect(grant).toMatchObject({ entry: { name: 'Divine Decree', data: { url: 'https://2e.aonprd.com/Spells.aspx?ID=1495' } },
    rank: 7, rule: { tradition: 'divine', frequency: 'once per day', condition: expect.stringContaining('Pathfinder reference') } })
  expect(dailyInnateUses(c, grant)?.limit).toBe(1)
  expect(unresolvedFeatSpells(c, [])).toEqual([])
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('aria-label="Roll Divine Decree: Damage"')
  expect(markup).toContain('7d10 spirit')
  expect(markup.match(/aria-label="Roll Divine Decree: Damage"/g)).toHaveLength(1)
  const sfSpell = { ...entry('Divine Decree', 'spell'), systems: ['sf2e' as const] }
  expect(grantedFeatSpells(c, [sfSpell])[0].entry).toBe(sfSpell)
  expect(grantedFeatSpells({ ...c, level: 16 }, [])).toEqual([])
})

it("grants Heroism from Heroes' Call as a third-rank daily innate occult spell", () => {
  const source = feat("Heroes' Call", 'The songs of ancient heroes echo through your mind. You gain [_heroism_](Spells.aspx?ID=149) as a 3rd-level innate occult spell that you can cast once per day.', 9)
  const heroism = entry('Heroism', 'spell', { duration: '10 minutes' })
  const c: Character = { ...base, level: 9, ancestry: 'Dwarf', feats: [taken("Heroes' Call", 9)] }
  expect(source.spellGrants).toMatchObject([{ kind: 'innate', spells: ['heroism'], rank: 3, tradition: 'occult', frequency: 'once per day' }])
  expect(grantedFeatSpells(c, [source, heroism])).toMatchObject([{
    entry: heroism,
    source: "Heroes' Call",
    rank: 3,
    rule: { kind: 'innate', tradition: 'occult', frequency: 'once per day' },
  }])
})

it('provides Heroic Presence as a once-daily rank 6 Zealous Conviction effect', () => {
  const spell = { ...entry('Zealous Conviction', 'spell', { actions: 'Two Actions' }), level: 6 }
  const c: Character = { ...base, systems: ['pf2e'], level: 17, feats: [taken('Heroic Presence', 17)] }
  updateSettings({ innateAutoHeighten: true })
  const [grant] = grantedFeatSpells(c, [spell])
  expect(grant).toMatchObject({ entry: spell, source: 'Heroic Presence', rank: 6,
    rule: { kind: 'feat', frequency: 'once per day' } })
  expect(dailyInnateUses(c, grant)?.limit).toBe(1)
  expect(unresolvedFeatSpells(c, [])).toMatchObject([{ name: 'Zealous Conviction' }])
  expect(grantedFeatSpells({ ...c, level: 16 }, [spell])).toEqual([])
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={() => {}} />)
  expect(markup).toContain('aria-label="Single Action"')
  expect(markup).toContain('A repugnant command immediately ends the effect on that target.')
})

it.each([
  ["Stonegate", 'You gain [_magic passage_](Spells.aspx?ID=1591) as a 7th-rank divine innate spell that you can cast once per day.',
    'Magic Passage', 7, 'divine', 'once per day', 'pf2e'],
  ['Clan Crystal Form', 'You can cast [_cairn form_](/spells/26-cairn-form) twice per day as a 6th-rank primal innate spell.',
    'Cairn Form', 6, 'primal', 'twice per day', 'sf2e'],
])('%s adds its innate spell grant', (name, text, spellName, rank, tradition, frequency, system) => {
  const source = mapAonHit({
    _id: name, _source: { name, category: 'feat', level: 17, trait: ['Dwarf'], markdown: `Header\n\n---\n\n${text}` },
  }, system as 'pf2e' | 'sf2e')!
  const spell = { ...entry(spellName, 'spell'), systems: [system as 'pf2e' | 'sf2e'] }
  const c: Character = { ...base, systems: [system as 'pf2e' | 'sf2e'], level: 17, ancestry: 'Dwarf', feats: [taken(name, 17)] }
  expect(source.spellGrants).toMatchObject([{ kind: 'innate', spells: [spellName.toLowerCase()], rank, tradition, frequency }])
  expect(grantedFeatSpells(c, [source, spell])).toMatchObject([{
    entry: spell, source: name, rank, rule: { kind: 'innate', tradition, frequency },
  }])
})

it('shows champion sanctification and devotion spell choices without a blessing', () => {
  const deity = entry('Patron', 'deity', { divine_font: 'Heal', sanctification: 'holy, unholy' })
  const c: Character = { ...base, level: 1, className: 'Champion', deity: deity.name, devotionSpell: 'Lay on Hands' }
  const spells = renderToStaticMarkup(<SpellsSection c={c} entries={[deity, entry('Lay on Hands', 'spell')]} save={() => {}} />)
  expect(spells).toContain('aria-label="Devotion spell"')
  expect(spells).toContain('Lay on Hands')
  expect(spells).not.toContain('Devotion Spells')
  expect(spells).not.toContain('Touch of the Void')
  const features = renderToStaticMarkup(<ClassFeatures c={c} entries={[deity]} save={() => {}} />)
  expect(features).toContain('aria-label="Sanctification"')
  expect(features).not.toContain('aria-label="Devotion spell"')
})

it('gives champions a focus point before choosing their devotion spell and saves the chosen spell', () => {
  const deity = entry('Patron', 'deity', { divine_font: 'Harm, Heal' })
  let c: Character = { ...base, level: 1, className: 'Champion', deity: deity.name }
  const entries = [deity, entry('Lay on Hands', 'spell'), entry('Touch of the Void', 'spell'), entry('Shields of the Spirit', 'spell')]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(focusSpells(c, entries)).toEqual({ spells: [], points: 1 })
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
  expect(html).toContain('Choose devotion spell')
  expect(html).toContain('1 of 1 focus points available')
  const tree = DevotionSpellChoice({ c, entries, save })!
  const findSelect = (node: ReactNode): ((event: { target: { value: string } }) => void) | undefined => {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<{ children?: ReactNode; 'aria-label'?: string; onChange?: (event: { target: { value: string } }) => void }>(child)) continue
      if (child.props['aria-label'] === 'Devotion spell') return child.props.onChange
      const found = findSelect(child.props.children)
      if (found) return found
    }
  }
  findSelect(tree)!({ target: { value: 'Lay on Hands' } })
  expect(c.devotionSpell).toBe('Lay on Hands')
  expect(focusSpells(c, entries)).toEqual({ spells: [{ name: 'Lay on Hands', source: 'Devotion Spells' }], points: 1 })
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)).toContain('Lay on Hands')
  expect(JSON.parse(JSON.stringify(c)).devotionSpell).toBe('Lay on Hands')
})

it('retains saved devotion choices while deity data loads and reports an invalid font', () => {
  const c: Character = { ...base, level: 1, className: 'Champion', deity: 'Patron', devotionSpell: 'Lay on Hands' }
  expect(focusSpells(c, []).spells).toMatchObject([{ source: 'Devotion Spells' }])
  expect(renderToStaticMarkup(<DevotionSpellChoice c={c} entries={[]} save={() => {}} />)).toContain('Deity data unavailable')
  const harmDeity = entry('Patron', 'deity', { divine_font: 'Harm' })
  const html = renderToStaticMarkup(<DevotionSpellChoice c={c} entries={[harmDeity]} save={() => {}} />)
  expect(html).toContain('Lay on Hands (unavailable)')
  expect(html).toContain('not available from this deity')
  expect(html).toContain('Touch of the Void')
  expect(focusSpells(c, [harmDeity])).toEqual({ spells: [], points: 1 })
  expect(c.devotionSpell).toBe('Lay on Hands')
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

it('restores focus dots individually across saves without a Refocus button or resetting spells or daily uses', () => {
  let c: Character = { ...base, activeSpells: ['Animal Feature'], innateSpellUses: { daily: 1 } }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const tree = () => FocusPointTracker({ c, save, points: 3 })
  expect(renderToStaticMarkup(tree()).match(/aria-pressed="true"/g)).toHaveLength(3)
  expect(findUseButton(tree(), 'Refocus')).toBeUndefined()
  findUseButton(tree(), 'Spend focus point 2')!.onClick()
  expect(c.spentFocusPoints).toEqual([1])
  expect(renderToStaticMarkup(tree())).toContain('2 of 3 focus points available')
  findUseButton(tree(), 'Spend focus point 1')!.onClick()
  findUseButton(tree(), 'Spend focus point 3')!.onClick()
  expect(renderToStaticMarkup(tree())).toContain('0 of 3 focus points available')
  expect(renderToStaticMarkup(tree())).not.toContain('aria-pressed="true"')
  findUseButton(tree(), 'Restore focus point 2')!.onClick()
  expect(c.spentFocusPoints).toEqual([0, 2])
  findUseButton(tree(), 'Restore focus point 1')!.onClick()
  expect(c.spentFocusPoints).toEqual([2])
  findUseButton(tree(), 'Restore focus point 3')!.onClick()
  expect(c.spentFocusPoints).toEqual([])
  expect(c.focusPointsSpentSinceRefocus).toBe(0)
  expect(renderToStaticMarkup(tree()).match(/aria-pressed="true"/g)).toHaveLength(3)
  expect(c.activeSpells).toEqual(['Animal Feature'])
  expect(c.innateSpellUses).toEqual({ daily: 1 })
})

it('uses Energized Font once daily to restore one focus point without resetting Refocus history', () => {
  let c: Character = { ...base, level: 5, feats: [taken('Energized Font', 5)], spentFocusPoints: [0, 2],
    focusPointsSpentSinceRefocus: 3 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => EnergizedFont({ c, save, points: 3 })
  expect(findUseButton(tree(), 'Use Energized Font')?.disabled).toBe(false)
  findUseButton(tree(), 'Use Energized Font')!.onClick()
  expect(c.spentFocusPoints).toEqual([2])
  expect(c.focusPointsSpentSinceRefocus).toBe(3)
  expect(c.dailyFeatUses?.['Energized Font']).toBe(true)
  expect(findUseButton(tree(), 'Use Energized Font')?.disabled).toBe(true)
  expect(EnergizedFont({ c: { ...c, level: 4 }, save, points: 3 })).toBeNull()
  expect(EnergizedFont({ c, save, points: 0 })).toBeNull()
})

it("uses Damoritosh's Claw once daily to restore a spent focus point", () => {
  let c: Character = { ...base, systems: ['sf2e'], ancestry: 'Vesk', level: 13,
    feats: [taken("Damoritosh's Claw", 13)], spentFocusPoints: [1], focusPointsSpentSinceRefocus: 2 }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => FocusPointTracker({ c, save, points: 2 })
  expect(findUseButton(tree(), "Use Damoritosh's Claw")?.disabled).toBe(false)
  findUseButton(tree(), "Use Damoritosh's Claw")!.onClick()
  expect(c.spentFocusPoints).toEqual([])
  expect(c.focusPointsSpentSinceRefocus).toBe(2)
  expect(c.dailyFeatUses?.["Damoritosh's Claw"]).toBe(true)
  expect(findUseButton(tree(), "Use Damoritosh's Claw")?.disabled).toBe(true)
})

it('uses Floral Restoration once daily, restores focus if spent, and scales healing', () => {
  let c: Character = { ...base, level: 9, feats: [taken('Floral Restoration', 8)], spentFocusPoints: [0, 2] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => FloralRestoration({ c, save, points: 3 })
  expect(renderToStaticMarkup(tree())).toContain('5d8 HP')
  findUseButton(tree(), 'Use Floral Restoration')!.onClick()
  expect(c.spentFocusPoints).toEqual([2])
  expect(c.focusPointsSpentSinceRefocus).toBe(2)
  expect(findUseButton(tree(), 'Use Floral Restoration')?.disabled).toBe(true)
  expect(c.dailyFeatUses?.['Floral Restoration']).toBe(true)
  c = { ...c, level: 20, spentFocusPoints: [], dailyFeatUses: {} }
  expect(renderToStaticMarkup(tree())).toContain('10d8 HP')
  findUseButton(tree(), 'Use Floral Restoration')!.onClick()
  expect(c.dailyFeatUses?.['Floral Restoration']).toBe(true)
  expect(FloralRestoration({ c: { ...c, level: 7 }, save, points: 3 })).toBeNull()
})

it('applies earned Refocus feats, tracks conditional spending between Refocuses, and excludes Mythic actions', () => {
  const focus = feat("Warden's Focus", 'When you Refocus, you regain all your Focus Points instead of 1.', 12)
  const wellspring = feat('Meditative Wellspring', 'If you have spent at least 3 Focus Points since the last time you Refocused, you recover 3 Focus Points when you Refocus instead of 1.', 18)
  const graveFocus = feat('Grave Focus', 'Whenever you Refocus, completely refill your focus pool.', 12)
  const mythic = feat('Mythic Refocus', 'Spend a Mythic Point; you immediately recover all your Focus Points.', 8)
  const entries = [focus, wellspring, graveFocus, mythic]
  expect(refocusRecovery({ ...base, level: 12, feats: [taken(focus.name, 12)] }, entries, 3, 3)).toBe(3)
  expect(refocusRecovery({ ...base, level: 11, feats: [taken(focus.name, 12)] }, entries, 3, 3)).toBe(1)
  expect(refocusRecovery({ ...base, level: 18, feats: [taken(wellspring.name, 18)], focusPointsSpentSinceRefocus: 2 }, entries, 3, 3)).toBe(1)
  expect(refocusRecovery({ ...base, level: 18, feats: [taken(wellspring.name, 18)], focusPointsSpentSinceRefocus: 3 }, entries, 3, 2)).toBe(3)
  expect(refocusRecovery({ ...base, level: 12, className: 'Necromancer', feats: [taken(graveFocus.name, 12)] }, entries, 3, 3)).toBe(3)
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
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[...sources,
    entry('Alpha', 'spell', { duration: '1 minute', range: '30 feet', saving_throw: 'Reflex', area: 'one creature' }),
    entry('Zebra', 'spell')]} save={() => {}} />)
  const innate = markup.slice(markup.indexOf('<b>Innate Spells</b>'))
  expect(innate).toContain('Primal Spell Rank 1')
  expect(innate).toContain('Duration')
  expect(innate).toContain('1 minute')
  expect(innate).toContain('30 feet')
  expect(innate).toContain('Reflex')
  expect(innate).toContain('One creature')
  expect(innate).toContain('>Spell</span>')
  expect(innate.match(/>Spell<\/span>/g)).toHaveLength(1)
  const firstRow = innate.match(/<li class="innate-spell-row">([\s\S]*?)<\/li>/)?.[1] ?? ''
  expect(firstRow.slice(0, firstRow.indexOf('<span><small>Duration')))
    .toContain('aria-label="Spend Alpha (Alpha Magic) use 1"')
  expect(firstRow).not.toContain('aria-haspopup="dialog">Alpha Magic</button>')
  expect(innate.indexOf('aria-haspopup="dialog">Alpha</button>')).toBeLessThan(innate.indexOf('aria-haspopup="dialog">Zebra</button>'))
})

it('grants Sure Strike from the Android Advanced Targeting System feat only', () => {
  const entries = [entry('Sure Strike', 'spell')]
  const android: Character = { ...base, ancestry: 'Android', feats: [taken('Advanced Targeting System')] }
  expect(grantedFeatSpells(android, entries).map(grant => [grant.entry.name, grant.rank, grant.rule.tradition, grant.rule.frequency]))
    .toEqual([['Sure Strike', 1, 'arcane', 'once per day']])
  expect(grantedFeatSpells({ ...android, ancestry: 'Human' }, entries)).toEqual([])
})

it('grants Pest Form at will from Ancestral Pest without helper text', () => {
  const spell = { ...entry('Pest Form', 'spell'), systems: ['sf2e' as const] }
  const pahtra: Character = { ...base, systems: ['sf2e'], ancestry: 'Pahtra', feats: [taken('Ancestral Pest')] }
  const grants = grantedFeatSpells(pahtra, [spell])
  expect(grants.map(grant => [grant.entry.name, grant.rank, grant.rule.tradition, grant.rule.frequency]))
    .toEqual([['Pest Form', 1, 'primal', 'at will']])
  expect(grantedFeatSpells({ ...pahtra, ancestry: 'Lashunta' }, [spell])[0].rule.tradition).toBe('primal')
  const markup = renderToStaticMarkup(<SpellsSection c={pahtra} entries={[spell]} save={() => {}} />)
  expect(markup).toContain('aria-label="Ancestral Pest active"')
  expect(markup).toContain('Primal Spell Rank 1')
  expect(markup).not.toContain('transform only into your chosen tiny animal')
  const lashunta = { ...pahtra, ancestry: 'Lashunta' }
  const lashuntaMarkup = renderToStaticMarkup(<SpellsSection c={lashunta} entries={[spell]} save={() => {}} />)
  expect(lashuntaMarkup).toContain('Squox form')
  expect(grantedFeatSpells({ ...pahtra, feats: [] }, [spell])).toEqual([])
})

it('activates and dismisses Pest Form with its chosen cast rank and flying form', () => {
  let c: Character = { ...base, activeSpells: ['Dinosaur Form'] }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  type Control = { checked?: boolean; disabled?: boolean; onChange: (event: { target: { checked: boolean } }) => void }
  const search = (label: string, node: ReactNode): Control | undefined => {
    let found: Control | undefined
    Children.forEach(node, child => {
      if (found || !isValidElement<{ children?: ReactNode; 'aria-label'?: string } & Control>(child)) return
      found = child.props['aria-label'] === label ? child.props : search(label, child.props.children)
    })
    return found
  }
  const find = (label: string) => search(label, PestFormActions({ c, save, rank: 4 }))
  find('Pest Form flying')!.onChange({ target: { checked: true } })
  expect(c.pestForm).toMatchObject({ rank: 4, flying: true })
  find('Pest Form active')!.onChange({ target: { checked: true } })
  expect(c.activeSpells).toEqual(['Pest Form'])
  expect(movementSpeeds(c, []).map(move => move.name)).toEqual(['Land', 'Fly'])
  expect(find('Pest Form flying')?.disabled).toBe(true)
  find('Pest Form active')!.onChange({ target: { checked: false } })
  expect(c.activeSpells).toEqual([])
  expect(c.pestForm).toBeUndefined()
})

it('shows original duration units, touch range and Sure Strike self-targeting without an Invisibility toggle', () => {
  const spells = [
    entry('Invisibility', 'spell', { duration: 600, duration_text: '10 minutes', range: 0, range_text: 'touch', target: '1 creature' }),
    entry('Sure Strike', 'spell', { duration_text: 'until the end of your turn' }),
    entry('Mindlink', 'spell', { range: 0, target: '1 willing creature' }),
    entry('Legacy Buff', 'spell', { duration: 60, range: 30 }),
    entry('Variable Spell', 'spell', { duration_text: 'varies', target: 'up to 10 creatures' }),
  ]
  const source: ContentEntry = { ...entry('Innate Magic', 'feat'),
    spellGrants: [{ kind: 'innate', spells: spells.map(spell => spell.name), rank: 2, tradition: 'arcane', frequency: 'once per day' }] }
  const c: Character = { ...base, feats: [taken(source.name)], activeSpells: ['Invisibility'] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[source, ...spells]} save={() => {}} />)
  for (const value of ['10 minutes', '1 minute', 'Touch', '30 feet', 'Self', 'Until the end of your turn']) {
    expect(markup).toContain(`>${value}</span>`)
  }
  expect(markup).not.toContain('>600</span>')
  expect(markup).not.toContain('>0</span>')
  expect(markup).toContain('<small>Duration</small>Varies')
  expect(markup).toContain('<small>Area/Targets</small>Up to 10 creatures')
  expect(markup).not.toContain('aria-label="Invisibility active"')
  expect(markup).toContain('aria-label="Spend Invisibility (Innate Magic) use 1"')
  expect(c.activeSpells).toEqual(['Invisibility'])
})

it('shows Instant for spells without a listed duration while preserving explicit durations', () => {
  const spells = [
    entry('Unlisted Duration', 'spell'),
    entry('Zero Duration', 'spell', { duration: 0 }),
    entry('Blank Duration', 'spell', { duration_text: '  ' }),
    entry('Varied Duration', 'spell', { duration_text: 'varies' }),
    entry('Timed Duration', 'spell', { duration: 60 }),
  ]
  const source: ContentEntry = { ...entry('Duration Magic', 'feat'),
    spellGrants: [{ kind: 'innate', spells: spells.map(spell => spell.name), rank: 2, tradition: 'arcane', frequency: 'once per day' }] }
  const c: Character = { ...base, feats: [taken(source.name)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[source, ...spells]} save={() => {}} />)
  expect(markup.match(/<small>Duration<\/small>Instant/g)).toHaveLength(3)
  expect(markup).toContain('<small>Duration</small>Varies')
  expect(markup).toContain('<small>Duration</small>1 minute')
})

it('sorts innate ranks numerically ascending within each tradition', () => {
  const sources: ContentEntry[] = [10, 2, 1].map(rank => ({
    ...entry(`Primal Magic ${rank}`, 'feat'),
    spellGrants: [{ kind: 'innate', spells: [`Primal Spell ${rank}`], rank, tradition: 'primal' }],
  }))
  sources.push({ ...entry('Arcane Magic', 'feat'),
    spellGrants: [{ kind: 'innate', spells: ['Arcane Spell'], rank: 10, tradition: 'arcane' }] })
  const spells = ['Primal Spell 10', 'Primal Spell 2', 'Primal Spell 1', 'Arcane Spell'].map(name => entry(name, 'spell'))
  const c: Character = { ...base, level: 20, feats: sources.map(source => taken(source.name)) }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[...sources, ...spells]} save={() => {}} />)
  const innate = markup.slice(markup.indexOf('<b>Innate Spells</b>'))
  expect([...innate.matchAll(/<h5>([^<]+ Spell Rank \d+)<\/h5>/g)].map(match => match[1])).toEqual([
    'Arcane Spell Rank 10', 'Primal Spell Rank 1', 'Primal Spell Rank 2', 'Primal Spell Rank 10',
  ])
})

it('renders prepared class spell slots with slot selection, metadata, casting, and daily reset controls', () => {
  const wizard = entry('Wizard', 'class', { tradition: 'Arcane' })
  const electricArc = entry('Electric Arc', 'spell', { tradition: 'Arcane', duration: 'Instantaneous', range: '30 feet', saving_throw: 'basic Reflex', targets: '1 or 2 creatures' })
  const haste = entry('Haste', 'spell', { tradition: 'Arcane', duration: '1 minute', range: '30 feet', saving_throw: '—', targets: '1 creature' })
  const c: Character = {
    ...base,
    level: 5,
    className: 'Wizard',
    spellcasting: { ability: 'int', tradition: 'Arcane', rank: 1, slots: { 0: 1, 3: 1 },
      prepared: { '0:0': 'electric-arc', '3:0': 'haste' }, spentSlots: ['3:0'] },
    spells: [
      { name: electricArc.name, rank: 1, cantrip: true, entryId: 'electric-arc' },
      { name: haste.name, rank: 3, cantrip: false, entryId: 'haste' },
    ],
  }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[
    { ...wizard, id: 'wizard' }, { ...electricArc, id: 'electric-arc' }, { ...haste, id: 'haste' },
  ]} save={() => {}} />)
  expect(html).not.toContain('Class Spell Slots')
  expect(html).toContain('Cantrips (Heightened Level 3)')
  expect(html).toContain('Spell Rank 3')
  expect(html).toContain('aria-label="Clear Electric Arc spell slot"')
  expect(html).toContain('aria-label="Clear Haste spell slot"')
  expect(html).toContain('disabled="" aria-label="Cast spell slot rank 3 slot 1"')
  expect(html).toContain('aria-label="Reset class spell slots"')
  expect(html).toContain('1 minute')
  expect(html).toContain('Basic Reflex')
  expect(html).toContain('1 creature')
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
  expect(html).toContain('Cast rank 4')
  expect(html).not.toContain('Cast rank 4 (Grown of Oak)')
  expect(html).not.toContain('Oaken Resilience cast rank')
  expect(html).not.toContain('Active on you')
  expect(html).not.toContain('at will;')
  expect(html).not.toContain('Targets you and your leshy familiar')
  expect(html).toContain('aria-label="Oaken Resilience active"')
  const minions = (character: Character) => renderToStaticMarkup(<MinionsSection c={character} entries={entries} save={() => {}} />)
  expect(minions(c)).toContain('Bludgeoning and piercing resistance 4; fire weakness 6')
  expect(minions({ ...c, level: 18 })).toContain('Bludgeoning and piercing resistance 8; fire weakness 12')
  expect(minions({ ...c, activeSpells: [] })).not.toContain('Bludgeoning and piercing resistance')
  expect(minions(c)).not.toContain('Oaken Resilience active on leshy familiar')
  expect(unresolvedFeatSpells(c, [grown])).toMatchObject([{ name: 'Oaken Resilience' }])
})

it('uses Cornucopia for Leaf order and legacy Goodberry grants and saved selections', () => {
  const cornucopia = { ...entry('Cornucopia', 'spell', { duration: '10 minutes' }, ['Focus', 'Druid']), level: 1 }
  const legacy = feat('Legacy Leaf Magic', 'You learn the [goodberry](/Spells.aspx?ID=473) order spell.')
  const entries = [cornucopia, legacy]
  const c: Character = { ...base, level: 3, className: 'Druid', order: 'Leaf',
    spells: [{ name: 'Goodberry', entryId: 'legacy-goodberry', rank: 1, cantrip: false }] }
  const before = JSON.stringify(c)
  expect(focusSpells(c, entries).spells).toEqual([{ name: 'Cornucopia', source: 'Leaf Order' }])
  expect(grantedFeatSpells({ ...c, feats: [taken(legacy.name)] }, entries)).toMatchObject([{ entry: cornucopia }])
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Cornucopia')
  expect(html).not.toContain('Goodberry')
  expect(html).toContain('10 minutes')
  expect(JSON.stringify(c)).toBe(before)
})

it('learns Apex Companion from its order-spell feat and removes access when the source becomes unavailable', () => {
  const apex = feat('Apex Companion', 'You learn the [_apex companion_](/Spells.aspx?ID=562) order spell. Increase the number of Focus Points in your focus pool by 1.', 20)
  const spell = { ...entry('Apex Companion', 'spell', {}, ['Druid', 'Focus', 'Uncommon']), level: 10 }
  const entries = [apex, spell]
  const c: Character = { ...base, level: 20, className: 'Druid', feats: [taken(apex.name, 20)] }
  expect(grantedFeatSpells(c, entries)).toMatchObject([{ entry: spell, rule: { kind: 'focus' } }])
  expect(focusSpells(c, entries)).toMatchObject({ points: 1, spells: [{ name: spell.name }] })
  expect(knowsSpell(c, entries, spell.name)).toBe(true)
  expect(knowsSpell({ ...c, level: 19 }, entries, spell.name)).toBe(false)
  expect(knowsSpell({ ...c, feats: [] }, entries, spell.name)).toBe(false)
})

it('removes bottom spell search without removing prepared spell selectors', () => {
  const c: Character = { ...base, className: 'Druid', level: 3 }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(html).not.toContain('Search spells')
  expect(html).not.toContain('Filter spells by tradition')
  expect(html).toContain('aria-label="Cantrip slot 1"')
  expect(html).toContain('aria-label="Spell Rank 1 slot 1"')
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
  const previous = getSettings().championFormNoFlight
  onTestFinished(() => updateSettings({ championFormNoFlight: previous }))
  updateSettings({ championFormNoFlight: false })
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
  expect(html).toContain('aria-label="Untamed Shift: Wings"')
  expect(html).toContain('aria-label="Choose Untamed Shift effects"')
  expect(html).toContain('aria-label="Single Action to Two Actions"')
  expect(html.replace(/<dialog\b[\s\S]*?<\/dialog>/g, '')).not.toContain('Untamed Shift: choose')
  expect(html).not.toContain('Wings require casting with two actions')
  for (const displayOnly of [false, true]) {
    const weapons = renderToStaticMarkup(<WeaponList c={{ ...c, level: 19 }} entries={[]} save={() => {}} displayOnly={displayOnly} />)
    expect(weapons).toContain('aria-haspopup="dialog">Claws</button>')
    expect(weapons).toContain(' + 4d6 persistent bleed')
    expect(weapons).not.toContain('on a hit (Untamed Shift)')
  }
})

it('hides Untamed Shift Wings without consuming an effect slot or suppressing Stormwind Flight', () => {
  const previous = getSettings().championFormNoFlight
  onTestFinished(() => updateSettings({ championFormNoFlight: previous }))
  updateSettings({ championFormNoFlight: true })
  const c: Character = { ...base, className: 'Druid', order: 'Wild', level: 11,
    feats: [taken('Untamed Form'), taken('Elemental Shape', 10), taken('Soaring Shape', 8)],
    spells: [{ name: 'Stormwind Flight', rank: 4, cantrip: false }],
    activeSpells: ['Untamed Shift', 'Stormwind Flight'], untamedShiftEffects: ['Wings', 'Claws', 'Elemental'] }
  const before = JSON.stringify(c)
  expect(movementSpeeds(c, []).filter(speed => speed.name === 'Fly')).toEqual([
    { name: 'Fly', feet: 25, source: 'Stormwind Flight' },
  ])
  expect(resistances(c, [])).toContainEqual({ damage: 'Critical hits', value: 5, source: 'Untamed Shift' })
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('aria-label="Untamed Shift: Claws" checked=""')
  expect(html).not.toContain('aria-label="Untamed Shift: Wings"')
  expect(JSON.stringify(c)).toBe(before)
})

it('puts saved Untamed Form settings and active toggle behind the two-action button', () => {
  const c: Character = { ...base, className: 'Druid', order: 'Wild', level: 20,
    feats: [taken('Untamed Form'), taken('Dragon Shape', 12)],
    activeSpells: ['Untamed Form'], spentFocusPoints: [0],
    untamedForm: { rank: 10, form: 'Dragon Form', shape: 'Red Dragon', originalDuration: 'unlimited' } }
  const spell = entry('Untamed Form', 'spell', { actions: 'Two Actions' }, ['Focus'])
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]}
    save={() => { throw Error('Rendering must preserve saved spell state') }} />)
  const trigger = html.match(/<button[^>]*aria-label="Configure Untamed Form"[^>]*aria-controls="([^"]+)"[^>]*>[\s\S]*?<\/button>/)
  expect(trigger?.[0]).toContain('aria-label="Two Actions"')
  const dialog = html.match(/<dialog\b[^>]*>[\s\S]*?<\/dialog>/g)
    ?.find(markup => markup.startsWith(`<dialog id="${trigger?.[1]}"`))
  const options = html.match(/<fieldset class="col"><legend>Untamed Form<\/legend>[\s\S]*?<\/fieldset>/)?.[0]
  expect(options).toBeDefined()
  expect(dialog).toContain(options!)
  expect(options).toContain('aria-label="Untamed Form cast rank" disabled=""')
  expect(options).toContain('aria-label="Untamed Form shape" disabled="" value="Red Dragon"')
  expect(options).toContain('selected="">unlimited</option>')
  expect(dialog).toContain('aria-label="Untamed Form active" checked=""')
  expect(html.replace(/<dialog\b[\s\S]*?<\/dialog>/g, '')).not.toContain('aria-label="Untamed Form active"')
})

it('shows the class spell attack modifier for Impaling Briars without an Attack trait', () => {
  const feat = entry('Impaling Briars', 'feat', { grants_focus_spells: 'Impaling Briars' })
  const spell = { ...entry('Impaling Briars', 'spell', { saving_throw: 'Reflex' }, ['Druid', 'Focus']),
    description: 'A foe must attempt a Reflex save. Make a spell attack roll.' }
  const c: Character = { ...base, className: 'Druid', level: 19, abilities: { ...base.abilities, wis: 22 },
    feats: [taken(feat.name, 16)] }
  expect(grantedFeatSpells(c, [feat, spell])).toHaveLength(0)
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[feat, spell]} save={() => {}} />)
  expect(html).toContain('<small>Save</small>AC, +33; Reflex DC 43')
  expect(html).toContain('Reflex DC 43')
})

it('shows Combustion as Instant even with incorrect imported duration', () => {
  const spell = entry('Combustion', 'spell', { duration: 60 }, ['Druid', 'Focus', 'Uncommon'])
  const c = { ...base, className: 'Druid', level: 19, spells: [{ name: spell.name, rank: 8, cantrip: false }] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={() => {}} />)
  expect(html).toContain('<small>Duration</small>Instant')
  expect(html).not.toContain('<small>Duration</small>1 minute')
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
  expect(grantedFeatSpells({ ...c, feats: [taken(source.name, 1, 'Light')] }, [source, adhere, other])).toMatchObject([{ entry: adhere }])
  expect(grantedFeatSpells({ ...c, feats: [taken(source.name)] }, [source, adhere])).toMatchObject([{ entry: adhere }])
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={[source, adhere]} save={() => {}} />)).not.toContain('Ancestral Cantrip spell')
})

it('allows listed ancestral cantrips when the source omits a tradition without inventing one', () => {
  const source = mapAonHit({ _id: 'urog-cantrip', _source: { name: 'Ancestral Cantrip', category: 'feat', level: 1, trait: ['Urog'],
    markdown: 'Header\n\n---\n\nChoose one cantrip.<br/><br/>**[Option(s)](/feats/1)**: _[guidance](/spells/1)_, or _[measure](/spells/2)_' } }, 'sf2e')!
  const guidance = { ...entry('Guidance', 'spell', {}, ['Cantrip']), systems: ['sf2e' as const] }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Urog', feats: [taken(source.name, 1, 'Guidance')] }
  expect(featSpellOptions(c, [source, guidance], c.feats[0])).toEqual([guidance])
  expect(grantedFeatSpells({ ...c, feats: [taken(source.name)] }, [source, guidance])).toEqual([])
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={[source, guidance]} save={() => {}} />)).not.toContain('Ancestral Cantrip spell')
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
  expect(markup).not.toContain('Ancestral Magic spell')
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
  expect(markup).not.toContain('Ancestral Magic spell')
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

it('persists individual daily-use dots and restores them without ending active spells', () => {
  const source = feat('Daily Magic', 'You can cast [invisibility](/Spells.aspx?ID=1) as a 2nd-rank arcane innate spell twice per day.')
  const entries = [source, entry('Invisibility', 'spell')]
  let c: Character = { ...base, feats: [taken(source.name)], activeSpells: ['Invisibility'],
    innateSpellUses: { 'another pool': 1 } }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const grant = () => grantedFeatSpells(c, entries)[0]
  const tree = () => InnateSpellUses({ c, save, grant: grant() })
  const use = (index: number) => findUseButton(tree(), `Spend Invisibility (Daily Magic) use ${index}`)!
  const undo = (index: number) => findUseButton(tree(), `Restore Invisibility (Daily Magic) use ${index}`)!
  expect(undo(1)).toBeUndefined()
  expect(dailyInnateUses(c, grant())?.used).toBe(0)
  use(2).onClick()
  expect(dailyInnateUses(c, grant())).toMatchObject({ spent: [1], used: 1, remaining: 1 })
  expect(c.innateSpellUses?.['another pool']).toBe(1)
  use(1).onClick()
  expect(use(1)).toBeUndefined()
  expect(use(2)).toBeUndefined()
  expect(dailyInnateUses(c, grant())).toMatchObject({ used: 2, remaining: 0 })
  expect(renderToStaticMarkup(tree())).toContain('aria-label="0 of 2 uses remaining"')
  undo(2).onClick()
  expect(dailyInnateUses(c, grant())).toMatchObject({ spent: [0], used: 1, remaining: 1 })
  undo(1).onClick()
  expect(dailyInnateUses(c, grant())).toMatchObject({ used: 0, remaining: 2 })
  expect(c.innateSpellUses?.['another pool']).toBe(1)
  expect(c.activeSpells).toEqual(['Invisibility'])
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)).not.toContain('Reset daily innate uses')
})

it('combines matching daily innate spells without merging their saved use pools', () => {
  const first = feat('First Magic', 'You can cast [invisibility](/Spells.aspx?ID=1) as a 2nd-rank primal innate spell once per day.')
  const second = feat('Second Magic', 'You can cast [invisibility](/Spells.aspx?ID=1) as a 2nd-rank primal innate spell once per day.')
  const entries = [first, second, entry('Invisibility', 'spell')]
  let c: Character = { ...base, feats: [taken(first.name), taken(second.name)] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const grants = () => grantedFeatSpells(c, entries)
  const tracker = () => InnateSpellUses({ c, save, grant: grants()[0], additionalGrants: grants().slice(1) })
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={save} />)
    .match(/aria-haspopup="dialog">Invisibility<\/button>/g)).toHaveLength(1)
  expect(renderToStaticMarkup(tracker())).toContain('2 of 2 uses remaining')
  findUseButton(tracker(), 'Spend Invisibility (Second Magic) use 1')!.onClick()
  expect(dailyInnateUses(c, grants()[0])?.remaining).toBe(1)
  expect(dailyInnateUses(c, grants()[1])?.remaining).toBe(0)
  expect(renderToStaticMarkup(tracker())).toContain('1 of 2 uses remaining')
  findUseButton(tracker(), 'Restore Invisibility (Second Magic) use 1')!.onClick()
  expect(dailyInnateUses(c, grants()[1])?.remaining).toBe(1)
  const differentlyRanked = { ...second, spellGrants: second.spellGrants?.map(rule => ({ ...rule, rank: 4 })) }
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={[first, differentlyRanked, entries[2]]} save={save} />)
    .match(/aria-haspopup="dialog">Invisibility<\/button>/g)).toHaveLength(2)
  const restricted = { ...second, spellGrants: second.spellGrants?.map(rule => ({ ...rule, condition: 'Only at night' })) }
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={[first, restricted, entries[2]]} save={save} />)
    .match(/aria-haspopup="dialog">Invisibility<\/button>/g)).toHaveLength(2)
})

it('grants Kijimuna Whistle as a rank 5 primal innate spell once per day', () => {
  const source = entry('Kijimuna Whistle', 'feat')
  const spell = entry('Summon Plant or Fungus', 'spell')
  const c: Character = { ...base, level: 13, feats: [taken(source.name, 13)] }
  const [grant] = grantedFeatSpells(c, [source, spell])
  expect(grant).toMatchObject({ entry: spell, rank: 5, rule: { tradition: 'primal', frequency: 'once per day',
    fixedRank: true, condition: 'This casting loses the manipulate trait; cast by whistling' } })
  expect(dailyInnateUses(c, grant)?.remaining).toBe(1)
  expect(unresolvedFeatSpells(c, [source])).toMatchObject([{ name: spell.name }])
  expect(grantedFeatSpells({ ...c, level: 12 }, [source, spell])).toEqual([])
})

it('preserves Scarlet Strands free-hand restriction on its innate web', () => {
  const source = feat('Scarlet Strands', 'Once per day, you can cast 4th-rank [web](/Spells.aspx?ID=2045) as an innate primal spell, which takes the form of a crimson fishing net. You must have a hand free to pluck a few strands of your hair that you throw as part of the spell.', 9)
  const spell = entry('Web', 'spell')
  const c: Character = { ...base, level: 9, feats: [taken(source.name, 9)] }
  const [grant] = grantedFeatSpells(c, [source, spell])
  expect(grant).toMatchObject({ entry: spell, rank: 4, rule: { tradition: 'primal', frequency: 'once per day',
    fixedRank: true, condition: 'Requires a free hand to pluck and throw hairs' } })
  expect(dailyInnateUses(c, grant)?.remaining).toBe(1)
  expect(grantedFeatSpells({ ...c, level: 8 }, [source, spell])).toEqual([])
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
    .toContain('aria-label="0 of 1 uses remaining (shared)"')
})

it('preserves legacy spent counts and does not refund uses when a daily allowance shrinks', () => {
  const source = feat('Daily Magic', 'You can cast [invisibility](/Spells.aspx?ID=1) as an arcane innate spell twice per day.')
  const entries = [source, entry('Invisibility', 'spell')]
  const c: Character = { ...base, feats: [taken(source.name)] }
  const grant = grantedFeatSpells(c, entries)[0]
  expect(dailyInnateUses({ ...c, innateSpellUses: { [grant.usageKey]: 1 } }, grant))
    .toMatchObject({ spent: [0], used: 1, remaining: 1 })
  const spent = { ...c, innateSpellUses: { [grant.usageKey]: [1, 1, -1, 0.5] } }
  expect(dailyInnateUses(spent, grant)).toMatchObject({ spent: [1], used: 1, remaining: 1 })
  expect(dailyInnateUses(spent, { ...grant, rule: { ...grant.rule, frequency: 'once per day' } }))
    .toMatchObject({ spent: [0], used: 1, remaining: 0 })
})

it('separates Warden focus and innate spells without showing granting-source links', () => {
  const source: ContentEntry = { ...entry('Daily Magic', 'feat'),
    spellGrants: [{ kind: 'innate', spells: ['Invisibility'], tradition: 'arcane', frequency: 'once per day' }] }
  const c: Character = { ...base, className: 'Ranger', feats: [taken('Initiate Warden', 1, 'Gravity Weapon'), taken(source.name)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[source, entry('Invisibility', 'spell'),
    entry('Gravity Weapon', 'spell', { warden_spell_tier: 'Initiate' })]} save={() => {}} />)
  expect(markup).toContain('<b>Focus Spells</b>')
  expect(markup).toContain('<b>Innate Spells</b>')
  expect(markup).not.toContain('aria-haspopup="dialog">Daily Magic</button>')
  expect(markup).not.toContain('>Refocus</button>')
})

it.each(['Gravity Weapon', 'Keen Smell', 'Animal Feature', "Hunter's Luck"])('shows %s range and targets as Self with missing or zero imported range', name => {
  const tier = ['Animal Feature', "Hunter's Luck"].includes(name) ? 'Advanced' : 'Initiate'
  const c: Character = { ...base, className: 'Ranger', feats: [taken(`${tier} Warden`, tier === 'Advanced' ? 4 : 1, name)] }
  for (const range of [undefined, 0]) {
    const data: ContentEntry['data'] = { warden_spell_tier: tier, targets: 'you' }
    if (range !== undefined) data.range = range
    const html = renderToStaticMarkup(<SpellsSection c={c} entries={[entry(name, 'spell', data)]} save={() => {}} />)
    expect(html).toContain('<small>Range</small>Self')
    expect(html).not.toContain('<small>Range</small>Touch')
    expect(html).toContain('<small>Area/Targets</small>Self')
  }
})

it('shows Pulverizing Wake range as a 15-foot cone', () => {
  const c: Character = { ...base, level: 20, className: 'Ranger', feats: [taken('Peerless Warden', 16, 'Pulverizing Wake')] }
  const spell = entry('Pulverizing Wake', 'spell', { warden_spell_tier: 'Peerless', range: 0, area: '15-foot cone', saving_throw: 'AC' }, ['Attack'])
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={() => {}} />)
  expect(html).toContain('<small>Range</small>15-foot cone')
  expect(html).toContain('<small>Area/Targets</small>1 creature within reach')
  expect(html).toContain('<small>Duration</small>Instant')
  expect(html).not.toContain('Wisdom Attack')
})

it('shows Terrain Transposition as instantaneous rather than copying catalog duration', () => {
  const spell = entry('Terrain Transposition', 'spell', { duration: '1 minute' })
  const html = renderToStaticMarkup(<SpellsSection c={{ ...base, spells: [{ name: spell.name, rank: 5, cantrip: false, entryId: spell.id }] }}
    entries={[spell]} save={() => {}} />)
  expect(html).toContain('<small>Duration</small>Instant')
  expect(html).not.toContain('<small>Duration</small>1 minute')
})

it.each([
  [8, false, '10 minutes', 'Yourself or your animal companion'],
  [9, false, '1 hour', 'Yourself and your animal companion'],
  [14, false, '1 hour', 'Yourself and your animal companion'],
  [9, true, 'Until next daily preparations', 'Yourself and your animal companion'],
] as const)('heightens Canopy Crawler targets and duration at level %i with Persistent %s', (level, persistent, duration, targets) => {
  const spell = entry('Canopy Crawler', 'spell', { duration: 600, range: 0, target: 'yourself or your animal companion' }, ['Focus', 'Ranger'])
  const c: Character = { ...base, level, className: 'Ranger',
    spells: [{ name: spell.name, rank: 2, cantrip: false }],
    feats: persistent ? [taken('Persistent Canopy Crawler', 8)] : [] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={() => {}} />)
  expect(html).toContain(`<small>Duration</small>${duration}`)
  expect(html).toContain(`<small>Area/Targets</small>${targets}`)
  expect(html).toContain('<small>Range</small>Touch')
})

it.each(['focus', 'innate', 'prepared'] as const)('hides Animal Feature choices in an action-icon dialog for %s spells', kind => {
  const spell = entry('Animal Feature', 'spell', { duration: 60, actions: 'Single Action', tradition: 'Arcane' }, ['Focus', 'Ranger'])
  const source: ContentEntry = { ...entry('Animal Gift', 'feat'),
    spellGrants: [{ kind: kind === 'innate' ? 'innate' : 'focus', spells: [spell.name], tradition: 'primal', rank: 2 }] }
  const c: Character = { ...base, className: kind === 'prepared' ? 'Wizard' : 'Ranger', level: 8,
    feats: [taken(source.name), taken('Persistent Animal Feature', 8)], activeSpells: ['Animal Feature'], animalFeatures: ['Claws', 'Jaws'],
    ...(kind === 'prepared' ? { spells: [{ name: spell.name, rank: 2, cantrip: false, entryId: spell.id }],
      spellcasting: { ability: 'int' as const, rank: 1, tradition: 'Arcane', slots: { 2: 1 }, prepared: { '2:0': spell.id } } } : {}) }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[source, spell,
    entry('Wizard', 'class', { tradition: 'Arcane' })]} save={() => {}} />)
  const buttons = [...html.matchAll(/aria-label="Choose Animal Feature effects" aria-haspopup="dialog" aria-controls="([^"]+)"/g)]
  expect(buttons).toHaveLength(kind === 'prepared' ? 2 : 1)
  for (const button of buttons) {
    const dialog = html.match(new RegExp(`<dialog[^>]*id="${button[1]}"[\\s\\S]*?</dialog>`))?.[0]
    expect(dialog).toBeDefined()
    expect(dialog).not.toMatch(/<dialog[^>]*\bopen(?:=|\s|>)/)
    expect(dialog).toContain('aria-label="Animal Feature: Claws" checked=""')
    expect(dialog).toContain('aria-label="Animal Feature: Jaws" checked=""')
    expect(dialog).not.toContain('aria-label="Animal Feature: Wings"')
  }
  const visible = html.replace(/<dialog\b[\s\S]*?<\/dialog>/g, '')
  expect(visible).not.toContain('Animal Feature: choose')
  expect(visible).not.toContain('aria-label="Animal Feature: Claws"')
  expect(visible).toContain('aria-label="Single Action"')
})

it.each([[7, 5], [9, 5], [11, 10], [13, 10], [15, 15], [17, 15], [19, 20]] as const)(
  'scales active Mountain Resilience at level %i to resistance %i', (level, value) => {
    const spell = { ...entry('Mountain Resilience', 'spell'), level: 4 }
    const c: Character = { ...base, level, spells: [{ name: spell.name, rank: 4, cantrip: false }],
      activeSpells: [spell.name] }
    expect(resistances(c, [spell])).toContainEqual({ damage: 'Physical (except adamantine)', value, source: spell.name })
    expect(resistances({ ...c, activeSpells: [] }, [spell])).not.toContainEqual(expect.objectContaining({ source: spell.name }))
    expect(resistances({ ...c, spells: [] }, [spell])).not.toContainEqual(expect.objectContaining({ source: spell.name }))
    const grant: ContentEntry = { ...entry('Mountain Magic', 'feat'),
      spellGrants: [{ kind: 'innate', spells: [spell.name] }] }
    expect(resistances({ ...c, spells: [], feats: [taken(grant.name)] }, [spell, grant]))
      .toContainEqual({ damage: 'Physical (except adamantine)', value: 5, source: spell.name })
  })

it.each([[7, 5, 2], [11, 10, 3], [15, 10, 3], [19, 20, 4]] as const)(
  'applies Cairn Form resistance and fists at level %i', (level, resistance, dice) => {
    const spell = { ...entry('Cairn Form', 'spell'), level: 4 }
    const fighter = entry('Fighter', 'class', { attack_proficiency: 'Master in martial weapons, Trained in unarmed attacks' })
    const specialization = { ...entry('Weapon Specialization', 'classFeature', { class: 'Fighter' }), level: 7 }
    const entries = [spell, fighter, specialization]
    const c: Character = { ...base, level, handwraps: { potency: 2, striking: 2, runes: [] },
      spells: [{ name: spell.name, rank: 4, cantrip: false }], activeSpells: [spell.name] }
    expect(resistances(c, entries)).toContainEqual({ damage: 'Physical (except adamantine)', value: resistance, source: spell.name })
    const fist = ownedWeapons(c, entries).find(weapon => weapon.name === 'Fist (Cairn Form)')!
    expect(fist).toBeDefined()
    const attack = weaponAttack(c, entries, fist)
    expect(attack.rank).toBe(3)
    expect(attack.damage).toBe(`${Math.max(dice, 3)}d6+3 bludgeoning`)
    expect(attack.criticalNote).toContain('stunned 1 for 1 round')
    for (const displayOnly of [false, true]) {
      const html = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly={displayOnly} />)
      expect(html).toContain('Fist (Cairn Form)')
      expect(html).toContain('stunned 1 for 1 round')
    }
    for (const inactive of [{ ...c, activeSpells: [] }, { ...c, spells: [] }]) {
      expect(resistances(inactive, entries)).not.toContainEqual(expect.objectContaining({ source: spell.name }))
      expect(ownedWeapons(inactive, entries).some(weapon => weapon.name === fist.name)).toBe(false)
    }
  })

it('keeps Clan Crystal Form at its fixed sixth rank at higher character levels', () => {
  const spell = { ...entry('Cairn Form', 'spell'), level: 4 }
  const grant: ContentEntry = { ...entry('Clan Crystal Form', 'feat'),
    spellGrants: [{ kind: 'innate', spells: [spell.name], rank: 6, frequency: 'twice per day' }] }
  const c: Character = { ...base, level: 20, feats: [taken(grant.name)], activeSpells: [spell.name] }
  const entries = [spell, grant]
  expect(resistances(c, entries)).toContainEqual({ damage: 'Physical (except adamantine)', value: 10, source: spell.name })
  const fist = ownedWeapons(c, entries).find(weapon => weapon.name === 'Fist (Cairn Form)')!
  expect(weaponAttack(c, entries, fist).damage).toMatch(/^[34]d6/)
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />))
    .toContain('aria-label="Cairn Form active" checked=""')
})

it('puts buff Active toggles in spell action dialogs without duplicates', () => {
  const names = ['Athletic Rush', 'Cairn Form', 'Imitate Fauna', 'Keen Smell', 'Magic Hide', 'Mountain Resilience', 'Oaken Resilience', 'Stormwind Flight', 'Untamed Form']
  const c: Character = { ...base, className: 'Ranger',
    spells: names.map(name => ({ name, rank: 1, cantrip: false })), activeSpells: ['Imitate Fauna', 'Keen Smell'] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={names.map(name => entry(name, 'spell',
    name === 'Oaken Resilience' ? { duration: 60 } : {}))} save={() => {}} />)
  const titles = html.match(/<div class="spell-title">[\s\S]*?<\/div>/g) ?? []
  for (const name of names) {
    const title = titles.find(title => title.includes(`aria-haspopup="dialog">${name}</button>`))
    expect(title).toContain('aria-haspopup="dialog"')
    expect(html.match(new RegExp(`aria-label="${name} active"`, 'g'))).toHaveLength(1)
  }
  const visible = html.replace(/<dialog\b[\s\S]*?<\/dialog>/g, '')
  for (const name of names) expect(visible).not.toContain(`aria-label="${name} active"`)
  expect(html).toContain('aria-label="Imitate Fauna active" checked=""')
  expect(html).toContain('aria-label="Keen Smell active" checked=""')
})

it('shows Mountain Resilience activation and heightened resistance inside its action dialog', () => {
  const spell = { ...entry('Mountain Resilience', 'spell', { actions: 'Two Actions' }), level: 4,
    description: 'Gain resistance. Heightened (+2) Increase resistance by 5.' }
  const c: Character = { ...base, level: 15, spells: [{ name: spell.name, rank: 4, cantrip: false, entryId: spell.id }] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={() => {}} />)
  expect(html).toContain('aria-label="Mountain Resilience options" aria-haspopup="dialog"')
  expect(html).toContain('Mountain Resilience (Rank 8)')
  expect(html).toContain('Resistance 15 to physical damage, except adamantine.')
  expect(html).toContain('Heightened (+2) Increase resistance by 5.')
  expect(html.replace(/<dialog\b[\s\S]*?<\/dialog>/g, '')).not.toContain('aria-label="Mountain Resilience active"')
})

it('toggles Athletic Rush granted by a focus-spell source without a manually selected spell', () => {
  const spell = entry('Athletic Rush', 'spell', {}, ['Focus'])
  const domain = entry('Domain Initiate', 'feat', { grants_focus_spells: spell.name })
  const c: Character = { ...base, feats: [taken(domain.name)], activeSpells: [spell.name] }
  const entries = [spell, domain]
  expect(movementSpeeds(c, entries)).toContainEqual({ name: 'Land', feet: 35 })
  expect(renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />))
    .toContain('aria-label="Athletic Rush active" checked=""')
  expect(movementSpeeds({ ...c, activeSpells: [] }, entries)).toContainEqual({ name: 'Land', feet: 25 })
  expect(movementSpeeds({ ...c, feats: [] }, entries)).toContainEqual({ name: 'Land', feet: 25 })
})

it.each(['Athletic Rush', 'Enduring Might'])('shows Self range and target for %s', name => {
  const spell = entry(name, 'spell', { range: 0 }, ['Focus'])
  const c: Character = { ...base, spells: [{ name, rank: 1, cantrip: false }], activeSpells: [name] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={() => {}} />)
  expect(html).toContain('<small>Range</small>Self')
  expect(html).toContain('<small>Area/Targets</small>Self')
  if (name === 'Athletic Rush') expect(html).toContain('aria-label="Athletic Rush active" checked=""')
})

it('omits Active trackers for spells without automated character effects, regardless of duration or saved state', () => {
  const names = ['Gravity Weapon', 'Warning Stripes', 'Impaling Briars', 'Combustion', 'Unimplemented Buff']
  const c: Character = { ...base, className: 'Ranger', activeSpells: names,
    spells: names.map(name => ({ name, rank: 1, cantrip: false })) }
  const before = JSON.stringify(c)
  const html = renderToStaticMarkup(<SpellsSection c={c}
    entries={names.map(name => entry(name, 'spell', { duration: 'Sustained up to 1 minute' }))}
    save={() => { throw Error('Rendering must preserve saved spell state') }} />)
  for (const name of names) expect(html).not.toContain(`aria-label="${name} active"`)
  expect(JSON.stringify(c)).toBe(before)
  expect(html).toContain('<small>Area/Targets</small>Yourself or your animal companion')
  expect(html).toContain('<small>Range</small>Self or 30 feet')
})

it.each([
  ['Keen Smell', 6], ['Canopy Crawler', 8], ['Animal Feature', 8], ['Magic Hide', 10], ['Gravity Weapon', 14],
  ['Enlarge Companion', 18],
] as const)('shows %s lasting until daily preparations only with its current Persistent feat', (name, level) => {
  const spell = entry(name, 'spell', { duration: 60 }, ['Focus', 'Ranger'])
  const c: Character = { ...base, className: 'Ranger', level,
    spells: [{ name, rank: 1, cantrip: false }], feats: [taken(`Persistent ${name}`, level)] }
  const before = JSON.stringify(c)
  const render = (character: Character) => renderToStaticMarkup(<SpellsSection c={character} entries={[spell]} save={() => {}} />)
  const persistentDuration = '<small>Duration</small>Until next daily preparations'
  expect(render(c)).toContain(persistentDuration)
  expect(render(JSON.parse(before))).toContain(persistentDuration)
  for (const other of [
    { ...c, feats: [] },
    { ...c, level: level - 1 },
    { ...c, feats: [{ ...c.feats[0], takenLevel: level + 1 }] },
    { ...c, feats: [taken('Persistent Unrelated Spell', level)] },
  ]) {
    expect(render(other)).toContain('<small>Duration</small>1 minute')
    expect(render(other)).not.toContain(persistentDuration)
  }
  if (name === 'Animal Feature') expect(render(c)).not.toContain('normal duration.')
  expect(JSON.stringify(c)).toBe(before)
  expect(spell.data.duration).toBe(60)
})

it('hides Animal Feature wings through existing No Flight setting without clearing saved selections', () => {
  const previous = getSettings().championFormNoFlight
  const c: Character = { ...base, level: 20, activeSpells: ['Animal Feature'], animalFeatures: ['Wings', 'Fish Tail'],
    feats: [taken('Persistent Animal Feature', 8)], spells: [{ name: 'Animal Feature', rank: 2, cantrip: false }] }
  const before = JSON.stringify(c)
  const render = () => renderToStaticMarkup(<AnimalFeatureOptions c={c} entries={[]} save={() => {}} />)
  try {
    updateSettings({ championFormNoFlight: true })
    expect(render()).not.toContain('aria-label="Animal Feature: Wings"')
    expect(movementSpeeds(c, []).some(speed => speed.name === 'Fly')).toBe(false)
    expect(movementSpeeds(c, [])).toContainEqual({ name: 'Swim', feet: 25, source: 'Animal Feature' })
    updateSettings({ championFormNoFlight: false })
    expect(render()).toContain('aria-label="Animal Feature: Wings" checked=""')
    expect(movementSpeeds(c, [])).toContainEqual({ name: 'Fly', feet: 25, source: 'Animal Feature' })
    expect(JSON.stringify(c)).toBe(before)
  } finally { updateSettings({ championFormNoFlight: previous }) }
})

it('uses Persistent durations in prepared and innate spell tables too', () => {
  const spell = entry('Gravity Weapon', 'spell', { duration: 60, tradition: 'Arcane' })
  const source: ContentEntry = { ...entry('Innate Gravity', 'feat'),
    spellGrants: [{ kind: 'innate', spells: [spell.name], rank: 1, tradition: 'arcane' }] }
  const c: Character = { ...base, className: 'Wizard', level: 14,
    feats: [taken('Persistent Gravity Weapon', 14), taken(source.name)],
    spells: [{ name: spell.name, rank: 1, cantrip: false, entryId: spell.id }],
    spellcasting: { ability: 'int', rank: 1, slots: { 1: 1 }, tradition: 'Arcane', prepared: { '1:0': spell.id } } }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[entry('Wizard', 'class', { tradition: 'Arcane' }), spell, source]} save={() => {}} />)
  expect(html).toContain('aria-label="Clear Gravity Weapon spell slot"')
  expect(html).toContain('<b>Innate Spells</b>')
  expect(html.match(/<small>Duration<\/small>Until next daily preparations/g)).toHaveLength(3)
})

it.each(['Distracting Decoy', 'Heal Animal', 'Heal Companion', 'Slime Spit', 'Snare Hopping', "Hunter's Luck", 'Soothing Mist', 'Threatening Mimicry'])('shows %s duration as Instant', name => {
  const c: Character = { ...base, className: 'Ranger', feats: [taken('Initiate Warden', 1, name)] }
  for (const duration of [undefined, 0]) {
    const data: ContentEntry['data'] = { warden_spell_tier: 'Initiate' }
    if (duration !== undefined) data.duration = duration
    const html = renderToStaticMarkup(<SpellsSection c={c} entries={[entry(name, 'spell', data)]} save={() => {}} />)
    expect(html).toContain('<small>Duration</small>Instant')
  }
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
  const enhancedMarkup = renderToStaticMarkup(<SpellsSection c={enhanced} entries={data} save={() => {}} />)
  expect(enhancedMarkup).not.toContain('rank 2 arcane; twice per day')
  expect(enhancedMarkup).toContain('aria-label="2 of 2 uses remaining"')
  expect(enhancedMarkup).not.toContain('; rank 2 arcane')
  expect(grantedFeatSpells({ ...enhanced, level: 20 }, data)[0].rank).toBe(2)
  const trained = { ...spent, feats: [...spent.feats, taken('Greywatch Initiate', 4)] }
  expect(dailyInnateUses(trained, grantedFeatSpells(trained, data)[0]))
    .toMatchObject({ key: uses.key, used: 1, limit: 2, remaining: 1 })
  expect(grantedFeatSpells({ ...c, feats: [...c.feats, { ...taken('Greywatch Initiate', 4), takenLevel: 10 }] }, data)[0].rule.frequency)
    .toBe('once per day')
  expect(grantedFeatSpells({ ...c, feats: [...c.feats, taken('Face in the Crowd', 10)] }, data)[0].rule.frequency).toBe('once per day')
  expect(grantedFeatSpells({ ...c, level: 8 }, data)).toEqual([])
  expect(grantedFeatSpells(c, data)[0].rule.frequency).toBe('once per day')
  expect(source.spellGrants?.[0].frequency).toBe('once per day')
})

it('grants Empathetic Connection Mindlink at its fixed rank without irrelevant DC or attack statistics', () => {
  const grant = feat('Empathetic Connection', 'You gain _[mindlink](/spells/188-mindlink)_ as a 1st-rank occult innate spell at-will. The target is temporarily immune for 24 hours.', 5)
  const entries = [grant, entry('Mindlink', 'spell')]
  const character = { ...base, feats: [taken(grant.name, 5)] }
  const spells = grantedFeatSpells(character, entries)
  expect(spells).toMatchObject([{ entry: { name: 'Mindlink' }, rank: 1, rule: { frequency: 'at will', tradition: 'occult' } }])
  const render = (c: Character) => renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(render(character)).not.toContain('Intelligence DC')
  expect(render(character)).toContain('<small>Duration</small>Instant')
  expect(render({ ...character, level: 12 })).not.toContain('Attack +')
  expect(render(character)).not.toContain('target is temporarily immune for 24 hours')
  expect(render(character)).not.toContain('at will')
  expect(spells[0].rule.condition).toContain('24 hours')
  expect(render(character)).not.toContain('Slots per rank')
  expect(grantedFeatSpells({ ...character, level: 4 }, entries)).toEqual([])
  expect(knowsSpell(character, entries, 'Mindlink')).toBe(true)
  expect(knowsSpell({ ...character, feats: [] }, entries, 'Mindlink')).toBe(false)
})

it('grants Imperious Nature Command at rank 7 with its actual DC rule', () => {
  const grant = feat('Imperious Nature', "Your legendary abilities inspire compliance. Once per day, you can cast _[command](/spells/43-command)_ as a 7th-rank occult innate spell using the higher of your class DC or  spell DC. This effect loses the linguistic trait.", 17)
  const expertise = { ...entry('Fighter Expertise', 'classFeature', { class: 'Fighter' }), level: 11,
    description: 'Your proficiency rank for your fighter class DC increases to expert.' }
  const mastery = { ...expertise, id: 'mastery', name: 'Versatile Legend', level: 19,
    description: 'Your proficiency rank for your fighter class DC increases to master.' }
  const entries = [grant, entry('Command', 'spell', { saving_throw: 'Will' }),
    entry('Fighter', 'class', { attribute: 'Strength, Dexterity' }), expertise, mastery]
  const c: Character = { ...base, level: 17, boosts: { class: 'str' }, abilities: { ...base.abilities, str: 26 },
    feats: [taken(grant.name, 17)] }
  expect(grantedFeatSpells(c, entries)).toMatchObject([{ entry: { name: 'Command' }, rank: 7,
    rule: { tradition: 'occult', frequency: 'once per day', dc: 'higher-class-or-spell', condition: 'This effect loses the linguistic trait' } }])
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('DC 39')
  expect(markup).not.toContain('rank 7 occult; once per day')
  expect(markup).not.toContain('use higher of class DC or spell DC')
  expect(markup).not.toContain('Attack +')
  expect(markup).toContain('aria-label="1 of 1 uses remaining"')
  expect(markup).not.toContain('loses the linguistic trait')
  expect(classDifficultyClass(c, entries)).toBe(39)
  expect(classDifficultyClass({ ...c, level: 10 }, entries)).toBe(30)
  expect(classDifficultyClass({ ...c, level: 19 }, entries)).toBe(43)
  expect(classDifficultyClass({ ...c, boosts: { class: 'dex' } }, entries)).toBe(31)
  const spellHigher = renderToStaticMarkup(<SpellsSection c={{ ...c, boosts: { class: 'dex' } }} entries={entries} save={() => {}} />)
  expect(spellHigher).toContain('Will DC 35')
  const unchosen = renderToStaticMarkup(<SpellsSection c={{ ...c, boosts: {} }} entries={entries} save={() => {}} />)
  expect(unchosen).toContain('Class DC unavailable')
  expect(grantedFeatSpells({ ...c, level: 16 }, entries)).toEqual([])
})

it('compares Imperious Nature against class spell DC as well as innate spell DC', () => {
  const grant = feat('Imperious Nature', 'Once per day, you can cast [command](/spells/43-command) as a 7th-rank occult innate spell using the higher of your class DC or spell DC.', 17)
  const master = { ...entry('Master Spellcaster', 'classFeature', { class: 'Wizard' }), level: 15 }
  const entries = [grant, entry('Command', 'spell', { saving_throw: 'Will' }),
    entry('Wizard', 'class', { attribute: 'Intelligence', tradition: 'Arcane' }), master]
  const c: Character = { ...base, className: 'Wizard', level: 17, abilities: { ...base.abilities, int: 24, cha: 10 },
    feats: [taken(grant.name, 17)] }
  const previous = getSettings().innateHighestMental
  try {
    updateSettings({ innateHighestMental: false })
    expect(classDifficultyClass(c, entries)).toBe(36)
    const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
    expect(markup).toContain('DC 40')
  } finally { updateSettings({ innateHighestMental: previous }) }
})

it('applies frightened to both spell attack and save DC displays', () => {
  const grant = feat('Imperious Nature', 'Once per day, you can cast [command](/spells/43-command) as a 7th-rank occult innate spell using the higher of your class DC or spell DC.', 17)
  const master = { ...entry('Master Spellcaster', 'classFeature', { class: 'Wizard' }), level: 15 }
  const entries = [grant, entry('Command', 'spell', { saving_throw: 'Will' }),
    entry('Wizard', 'class', { attribute: 'Intelligence', tradition: 'Arcane' }), master]
  const c: Character = { ...base, className: 'Wizard', level: 17, abilities: { ...base.abilities, int: 24, cha: 10 },
    feats: [taken(grant.name, 17)], conditions: { frightened: 2 } }
  const previous = getSettings().innateHighestMental
  try {
    updateSettings({ innateHighestMental: false })
    const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
    expect(markup).toContain('DC 38')
    expect(markup).toContain('Attack +28')
    expect(markup).toContain('<small>Status</small>-2')
  } finally { updateSettings({ innateHighestMental: previous }) }
})

it.each<{ data: ContentEntry['data']; traits: string[]; description: string; dc: boolean; attack: boolean }>([
  { data: { saving_throw: 'Will' }, traits: [], description: '', dc: true, attack: false },
  { data: { saving_throw: 'AC' }, traits: ['Attack'], description: '', dc: false, attack: true },
  { data: {}, traits: [], description: '', dc: false, attack: false },
  { data: { save: 'basic Reflex' }, traits: ['Attack'], description: '', dc: true, attack: true },
  { data: {}, traits: [], description: 'An unwilling undead target attempts a basic Fortitude save.', dc: true, attack: false },
  { data: {}, traits: [], description: 'Make a ranged spell attack against the target.', dc: false, attack: true },
])('shows only relevant per-spell statistics: $data, $traits, $description', ({ data, traits, description, dc, attack }) => {
  const grant: ContentEntry = { ...entry('Test Magic', 'feat'), spellGrants: [{ kind: 'innate', spells: ['Test Spell'] }] }
  const spell = { ...entry('Test Spell', 'spell', data, traits), description }
  const c: Character = { ...base, feats: [taken(grant.name)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[grant, spell]} save={() => {}} />)
  expect(/(?:Will|Reflex|Fortitude) DC 21/i.test(markup)).toBe(dc)
  expect(markup.includes('AC, +11')).toBe(attack)
})

it.each(['One with Stone', 'Seek the Stars', 'Seek The Stars'])('shows %s range and targets as Self', name => {
  const spell = entry(name, 'spell')
  const grant: ContentEntry = { ...entry('Stonewalker', 'feat'),
    spellGrants: [{ kind: 'innate', spells: [spell.name], frequency: 'once per day' }] }
  const c: Character = { ...base, feats: [taken(grant.name)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[grant, spell]} save={() => {}} />)
  expect(markup).toContain('<small>Range</small>Self')
  expect(markup).toContain('<small>Area/Targets</small>Self')
  if (name.toLowerCase() === 'seek the stars') expect(markup).toContain('<small>Duration</small>Instant')
})

it.each([[9, '1 hour'], [11, '8 hours'], [17, '8 hours']] as const)('heightens Speak with Stones at character level %i', (level, duration) => {
  const spell = { ...entry('Speak with Stones', 'spell', { duration: 3600 }), level: 5 }
  const grant: ContentEntry = { ...entry('Stone Speaker', 'feat'),
    spellGrants: [{ kind: 'innate', spells: [spell.name], frequency: 'once per day', heightened: true }] }
  const c: Character = { ...base, level, feats: [taken(grant.name)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[grant, spell]} save={() => {}} />)
  expect(markup).toContain(`<small>Duration</small>${duration}`)
  expect(markup).toContain('<small>Range</small>Self')
  expect(markup).toContain('<small>Area/Targets</small>Self')
})

it.each([[5, 10], [6, 10], [7, 20], [9, 20]] as const)(
  'shows Magic Passage wall dimensions at spell rank %i', (rank, depth) => {
    const spell = { ...entry('Magic Passage', 'spell'), level: 5 }
    const grant: ContentEntry = { ...entry('Passage Magic', 'feat'),
      spellGrants: [{ kind: 'innate', spells: [spell.name], rank, frequency: 'once per day' }] }
    const c: Character = { ...base, level: 19, feats: [taken(grant.name)] }
    const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[grant, spell]} save={() => {}} />)
    expect(markup).toContain(`<small>Area/Targets</small>5-foot-wide, 10-foot-tall, ${depth}-foot-deep section of wooden, plaster, or stone wall`)
  })

it('adds Stonegate as an independent seventh-rank Magic Passage use without replacing existing uses', () => {
  const spell = { ...entry('Magic Passage', 'spell'), level: 5 }
  const other: ContentEntry = { ...entry('Passage Magic', 'feat'),
    spellGrants: [{ kind: 'innate', spells: [spell.name], rank: 5, frequency: 'once per day' }] }
  const stonegate = feat('Stonegate', 'You gain [_magic passage_](Spells.aspx?ID=1591) as a 7th-rank divine innate spell that you can cast once per day.', 17)
  let c: Character = { ...base, level: 19, feats: [taken(other.name), taken(stonegate.name, 17)] }
  const entries = [spell, other, stonegate]
  const grants = grantedFeatSpells(c, entries)
  expect(grants).toHaveLength(2)
  const existing = grants.find(grant => grant.source === other.name)!
  const added = grants.find(grant => grant.source === stonegate.name)!
  expect(added.rank).toBe(7)
  expect(added.rule.condition).toBe('Only through barriers of earth or stone')
  const uses = dailyInnateUses(c, added)!
  c = { ...c, innateSpellUses: { [uses.key]: [0] } }
  expect(dailyInnateUses(c, added)?.remaining).toBe(0)
  expect(dailyInnateUses(c, existing)?.remaining).toBe(1)
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup.match(/aria-haspopup="dialog">Magic Passage<\/button>/g)).toHaveLength(2)
  expect(markup).toContain('Divine Spell Rank 7')
  expect(markup).toContain('20-foot-deep')
  expect(markup).not.toContain('Only through barriers of earth or stone')
  expect(unresolvedFeatSpells(c, entries)).toEqual([])
})

it('shows Pummeling Rubble as a 15-foot cone when the source area is only numeric', () => {
  const spell = entry('Pummeling Rubble', 'spell', { area: '15' })
  const grant: ContentEntry = { ...entry('Rubble Magic', 'feat'),
    spellGrants: [{ kind: 'innate', spells: [spell.name], frequency: 'once per day' }] }
  const c: Character = { ...base, feats: [taken(grant.name)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[grant, spell]} save={() => {}} />)
  expect(markup).toContain('<small>Area/Targets</small>15-foot cone')
})

it.each(['once per day', 'twice per day', 'at will', 'once per hour'])('omits redundant %s labels while retaining other limits', frequency => {
  const grant: ContentEntry = { ...entry('Test Magic', 'feat'),
    spellGrants: [{ kind: 'innate', spells: ['Test Spell'], frequency }] }
  const c: Character = { ...base, feats: [taken(grant.name)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[grant, entry('Test Spell', 'spell')]} save={() => {}} />)
  expect(markup.includes(frequency)).toBe(frequency === 'once per hour')
  if (frequency === 'at will') expect(markup).not.toContain('uses remaining')
  if (frequency.endsWith('per day')) {
    const limit = frequency.startsWith('twice') ? 2 : 1
    expect(markup).toContain(`aria-label="${limit} of ${limit} uses remaining"`)
  }
})

it('uses higher class spell proficiency and highest mental attribute for innate spells', () => {
  const grant = feat('Stonewalker', 'You can cast [_one with stone_](/Spells.aspx?ID=1619) as a 3rd-rank divine innate spell once per day.')
  const master = { ...entry('Master Spellcaster', 'classFeature', { class: 'Wizard' }), level: 15 }
  const entries = [grant, entry('One with Stone', 'spell', { saving_throw: 'Fortitude' }), entry('Wizard', 'class', { tradition: 'Arcane' }), master]
  const c = { ...base, className: 'Wizard', level: 15, feats: [taken(grant.name)] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Fortitude DC 35')
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

it('lets Bone Magic select both cantrip and tradition', () => {
  const grant = feat('Bone Magic', 'Choose one cantrip from either the occult spell list or primal spell list.')
  const entries = [grant, entry('Ghost Sound', 'spell', { tradition: 'Occult, Primal' }, ['Cantrip']),
    entry('Occult Cantrip', 'spell', { tradition: 'Occult' }, ['Cantrip']),
    entry('Rare Cantrip', 'spell', { tradition: 'Primal' }, ['Cantrip', 'Rare'])]
  const c = { ...base, feats: [taken(grant.name)] }
  expect(boneMagicChoiceOptions(c, entries, c.feats[0])).toEqual([
    'occult|Ghost Sound', 'primal|Ghost Sound', 'occult|Occult Cantrip',
  ])
  expect(grantedFeatSpells({ ...c, feats: [taken(grant.name, 1, 'primal|Ghost Sound')] }, entries))
    .toMatchObject([{ entry: { name: 'Ghost Sound' }, rule: { tradition: 'primal' }, rank: 3 }])
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
  const entries = [blessed, other, entry('Lay on Hands', 'spell', { saving_throw: 'basic Fortitude' }, ['Focus']), entry('Other Spell', 'spell', {}, ['Focus']), entry('Third Spell', 'spell', {}, ['Focus'])]
  const c = { ...base, feats: [taken(blessed.name), taken(other.name, 6)] }
  expect(focusSpells(c, entries)).toMatchObject({ points: 1, spells: [{ name: 'Lay on Hands' }] })
  expect(focusSpells({ ...c, level: 6 }, entries).points).toBe(3)
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('Basic Fortitude DC 19')
  expect(markup).not.toContain('Attack +9')
  expect(markup).not.toContain('; rank 3 divine')
})

it.each([
  [1, '1 hour', 'Self', 'Self'],
  [2, '8 hours', 'Self', 'Self'],
  [4, '8 hours', '20 feet', 'Up to 10 creatures'],
  [7, '8 hours', '20 feet', 'Up to 10 creatures'],
] as const)('shows rank %i Vanishing Tracks metadata without an Active toggle', (rank, duration, range, targets) => {
  const source: ContentEntry = { ...entry('Trackless Magic', 'feat'),
    spellGrants: [{ kind: 'innate', spells: ['Vanishing Tracks'], rank, tradition: 'primal' }] }
  const spell = entry('Vanishing Tracks', 'spell', { duration: 3600 })
  const c: Character = { ...base, level: 20, feats: [taken(source.name)] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[source, spell]} save={() => {}} />)
  expect(html).toContain(`<small>Duration</small>${duration}`)
  expect(html).toContain(`<small>Range</small>${range}`)
  expect(html).toContain(`<small>Area/Targets</small>${targets}`)
  expect(html).not.toContain('aria-label="Vanishing Tracks active"')
})

it('shows Warden and other focus metadata with class proficiency and source-specific save DCs', () => {
  const source: ContentEntry = { ...entry('Focus Magic', 'feat'),
    spellGrants: [{ kind: 'focus', spells: ['Other Focus'], ability: 'cha' }] }
  const master: ContentEntry = { ...entry('Master Spellcaster', 'classFeature', { class: 'Ranger' }), level: 15 }
  const metadata = { duration: 60, range: 30, saving_throw: 'Will', targets: 'one creature' }
  const entries = [source, master, entry('Warden Test', 'spell', { ...metadata, warden_spell_tier: 'Initiate' }),
    entry('Other Focus', 'spell', metadata, ['Focus'])]
  const c: Character = { ...base, level: 20, className: 'Ranger',
    abilities: { ...base.abilities, wis: 22, cha: 14 },
    feats: [taken('Initiate Warden', 1, 'Warden Test'), taken(source.name)] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('<small>Save</small>Will DC 42')
  expect(html).not.toContain('Focus Spells Rank')
  expect(html).toContain('<small>Save</small>Will DC 38')
  expect(html.match(/<small>Duration<\/small>1 minute/g)).toHaveLength(2)
  expect(html.match(/<small>Range<\/small>30 feet/g)).toHaveLength(2)
  expect(html.match(/<small>Area\/Targets<\/small>One creature/g)).toHaveLength(2)
  expect(html.match(/class="spellbook-columns"/g)).toHaveLength(1)
  expect(html).toContain('<span>Spell</span><span>Duration</span>')
  expect(html.indexOf('aria-haspopup="dialog">Other Focus</button>'))
    .toBeLessThan(html.indexOf('aria-haspopup="dialog">Warden Test</button>'))
})

it.each([
  ['Ranger', 19, undefined],
  ['Champion', 9, undefined],
  ['Wizard', 9, 'occult'],
] as const)('shows %s focus spells without a redundant rank heading', (className, level, tradition) => {
  const source: ContentEntry = { ...entry('Focus Gift', 'feat'),
    spellGrants: [{ kind: 'focus', spells: ['Focus Test'], tradition }] }
  const c: Character = { ...base, className, level, feats: [taken(source.name)] }
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={[source,
    entry('Wizard', 'class', { tradition: 'Arcane' }), entry('Focus Test', 'spell', {}, ['Focus'])]} save={() => {}} />)
  expect(html).toContain('>Focus Test</button>')
  expect(html).not.toContain('Focus Spells Rank')
})

it('uses class DC and selected slot rank for prepared spell metadata', () => {
  const fear = entry('Fear', 'spell', { saving_throw: 'Will', traditions: 'Arcane' })
  const tracks = entry('Vanishing Tracks', 'spell', { duration: 3600, traditions: 'Arcane' })
  const master = { ...entry('Master Spellcaster', 'classFeature', { class: 'Wizard' }), level: 15 }
  const c: Character = { ...base, level: 20, className: 'Wizard', abilities: { ...base.abilities, int: 22 },
    spells: [fear, tracks].map(spell => ({ name: spell.name, rank: 1, cantrip: false, entryId: spell.id })),
    spellcasting: { ability: 'int', tradition: 'Arcane', rank: 1, slots: { 1: 1, 4: 1 },
      prepared: { '1:0': fear.id, '4:0': tracks.id } } }
  const entries = [fear, tracks, master, entry('Wizard', 'class', { attribute: 'Intelligence', tradition: 'Arcane' })]
  const html = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  const rows = html.match(/<li class="spellbook-row">[\s\S]*?<\/li>/g)?.filter(row => !row.includes("Cantrip slot"))
  expect(rows?.[0]).toContain('<small>Save</small>Will DC 42')
  expect(html).toContain('aria-label="Cast spell slot rank 4 slot 1"')
  const tracksRow = rows?.find(row => row.includes('aria-label="Cast spell slot rank 4 slot 1"'))
  expect(tracksRow).toContain('<small>Duration</small>8 hours')
  expect(tracksRow).toContain('<small>Range</small>20 feet')
  expect(tracksRow).toContain('<small>Area/Targets</small>Up to 10 creatures')
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
  expect(focusSpells(c, entries)).toMatchObject({ points: 3, spells: [{ name: 'Downpour' }, { name: 'Tidal Surge' }] })
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('<b>Focus Spells</b>')
  expect(markup).toContain('>Tidal Surge</button>')
  expect(markup).toContain('>Downpour</button>')
  expect(grantedFeatSpells({ ...c, level: 7 }, entries).map(grant => grant.entry.name)).toEqual(['Tidal Surge'])
})

it('lists Sacral Lord cantrips without territorial helper text while preserving their restriction', () => {
  const source = feat('Sacral Lord', 'Claim a defined territory, such as a forest. Within its borders, you can cast [_detect magic_](/Spells.aspx?ID=1485), [_guidance_](/Spells.aspx?ID=1549), and [_sigil_](/Spells.aspx?ID=1673) as innate divine cantrips, and you gain a bonus.')
  const entries = [source, ...['Detect Magic', 'Guidance', 'Sigil'].map(name => entry(name, 'spell', {}, ['Cantrip']))]
  const c: Character = { ...base, level: 4, feats: [taken(source.name, 4)] }
  const grants = grantedFeatSpells(c, entries)
  expect(grants.map(grant => grant.entry.name)).toEqual(['Detect Magic', 'Guidance', 'Sigil'])
  expect(grants).toMatchObject(Array.from({ length: 3 }, () => ({
    rank: 2, rule: { kind: 'innate', tradition: 'divine', frequency: 'at will', condition: 'Only within your claimed territory' },
  })))
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).not.toContain('Only within your claimed territory')
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

it.each(['Song of the Soul', 'Deathly Scream', 'Muscle Barrier'])('offers %s as a class feat granting its Necromancer focus spell', name => {
  const source = mapAonHit({ _id: `feat-${name}`, _source: { name, category: 'feat', level: 2, trait: ['Necromancer'],
    markdown: `<title>${name}</title>\n\n---\n\nYou learn the [_${name.toLowerCase()}_](/Spells.aspx?ID=1) grave spell.` } }, 'pf2e')!
  const spell = entry(name, 'spell', {}, ['Focus', 'Necromancer'])
  const entries = [source, spell]
  const character: Character = { ...base, className: 'Necromancer', level: 2, feats: [taken(name, 2)] }
  expect(grantedFeatSpells(character, entries)).toMatchObject([
    { entry: { name }, source: name, rule: { kind: 'focus', spells: [name.toLowerCase()], heightened: true } },
  ])
  expect(focusSpells(character, entries)).toMatchObject({
    points: 2, spells: expect.arrayContaining([expect.objectContaining({ name }), expect.objectContaining({ name: 'Necrotic Bomb' })]),
  })
  expect(renderToStaticMarkup(<SpellsSection c={character} entries={entries} save={() => {}} />))
    .toContain(`>${name}</button>`)
  expect(eligibleFeats(entries, { ...character, feats: [] }, { key: 'class:2:0', category: 'class', level: 2 })).toContain(source)
})

it('grants Necrotic Bomb through the separate Necrotic Bomber archetype feat', () => {
  const source = feat('Necrotic Bomber', 'You gain the [_necrotic bomb_](/Spells.aspx?ID=2903) grave spell.', 4)
  const spell = entry('Necrotic Bomb', 'spell', {}, ['Focus', 'Necromancer'])
  const entries = [source, spell]
  const c: Character = { ...base, className: 'Fighter', level: 4, feats: [taken(source.name, 4)] }
  expect(grantedFeatSpells(c, entries)).toMatchObject([{ entry: { name: spell.name }, rule: { kind: 'focus' }, rank: 2 }])
  expect(focusSpells(c, entries)).toMatchObject({ points: 1, spells: [expect.objectContaining({ name: spell.name })] })
})

it.each([[1, 1], [6, 1], [7, 2], [14, 2], [15, 3], [18, 3], [19, 4], [20, 4]])(
  'uses Necromancer Intelligence and spell proficiency at level %i', (level, rank) => {
    const entries = [
      entry('Necromancer', 'class', { tradition: 'Occult', attribute: 'Intelligence' }),
      ...[['Expert', 7, 'expert'], ['Master', 15, 'master'], ['Legendary', 19, 'legendary']].map(([name, level, rank]) => ({
        ...entry(`${name} Necromancy`, 'classFeature', { class: 'Necromancer' }), level: Number(level),
        description: `Your proficiency ranks for spell attack modifier and spell DC increase to ${rank}.`,
      })),
      { ...entry('Grave Magic', 'feat'), spellGrants: [{ kind: 'focus' as const, spells: ['Bone Spear', 'Deathly Scream'], heightened: true }] },
      entry('Bone Spear', 'spell', { saving_throw: 'AC' }, ['Focus', 'Necromancer', 'Attack']),
      entry('Deathly Scream', 'spell', { saving_throw: 'Fortitude' }, ['Focus', 'Necromancer']),
    ]
    const c: Character = { ...base, className: 'Necromancer', level, feats: [taken('Grave Magic')],
      spellcasting: { ability: 'cha', tradition: 'Occult', rank: 1, slots: {} } }
    const mod = 4 + level + rank * 2
    expect(classSpellcasting(c, entries)).toEqual({ traditions: ['Occult'], rank, ability: 'int' })
    expect(spellDifficultyClass(c, entries)).toBe(10 + mod)
    const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
    expect(markup).toContain(`AC, +${mod}`)
    expect(markup).toContain(`Fortitude DC ${10 + mod}`)
    expect(markup).not.toContain('Check granting source')
  },
)

it('omits granting-source helper text when a focus spell has no resolved casting attribute', () => {
  const entries = [
    { ...entry('Unknown Magic', 'feat'), spellGrants: [{ kind: 'focus' as const, spells: ['Test Spell'] }] },
    entry('Test Spell', 'spell', { saving_throw: 'Will' }, ['Focus']),
  ]
  const markup = renderToStaticMarkup(<SpellsSection c={{ ...base, feats: [taken('Unknown Magic')] }} entries={entries} save={() => {}} />)
  expect(markup).toContain('Test Spell')
  expect(markup).not.toContain('Check granting source for spellcasting attribute and DC.')
})

it('shows feat-granted and manual rituals as spell rows below focus and innate spells', () => {
  const creator = mapAonHit({ _id: 'feat-9105', _source: { name: 'Undead Creator', category: 'feat', level: 2,
    markdown: '<title>Undead Creator</title>\n\n---\n\nYou learn the [_create undead_](/Rituals.aspx?ID=117) ritual.' } }, 'pf2e')!
  const createUndead = mapAonHit({ _id: 'ritual-117', _source: { name: 'Create Undead', category: 'ritual', level: 2,
    trait: ['Uncommon', 'Unholy'], actions: '1 day', range: 10, target: '1 dead creature',
    url: '/Rituals.aspx?ID=117', markdown: '**Cast** 1 day\n\n---\n\nRitual rules.' } }, 'pf2e')!
  const awakenAnimal = entry('Awaken Animal', 'ritual')
  const magic: ContentEntry = { ...entry('Test Magic', 'feat'), spellGrants: [
    { kind: 'focus', spells: ['Test Focus'] }, { kind: 'innate', spells: ['Fear'], tradition: 'Occult' },
  ] }
  const entries = [creator, createUndead, awakenAnimal, magic, entry('Test Focus', 'spell', {}, ['Focus']), entry('Fear', 'spell')]
  const character: Character = { ...base, className: 'Necromancer', level: 2,
    feats: [taken('Undead Creator', 2), taken(magic.name)], rituals: ['Awaken Animal'] }
  const html = renderToStaticMarkup(<SpellsSection c={character} entries={entries} save={() => {}} />)
  const ritualHeading = html.indexOf('<h5>Rituals</h5>')
  expect(ritualHeading).toBeGreaterThan(html.indexOf('<b>Focus Spells</b>'))
  expect(ritualHeading).toBeGreaterThan(html.indexOf('<b>Innate Spells</b>'))
  const rituals = html.slice(ritualHeading)
  expect(rituals).toContain('class="spellbook-columns"')
  expect(rituals).toContain('aria-haspopup="dialog">Create Undead</button>')
  expect(rituals).not.toContain('Granted by')
  expect(rituals).not.toContain('Add ritual')
  expect(rituals).not.toContain('Choose ritual')
  expect(rituals).toContain('aria-haspopup="dialog">Awaken Animal</button>')
  expect(rituals).toContain('<small>Range</small>10 feet')
  expect(rituals).toContain('<small>Area/Targets</small>1 dead creature')
  expect(rituals).toContain('1 day')
  expect(rituals).toContain('aria-label="Remove ritual Awaken Animal"')
  expect(rituals).not.toContain('aria-label="Remove ritual Create Undead"')
  const empty = renderToStaticMarkup(<SpellsSection c={{ ...character, rituals: [], feats: [] }} entries={entries} save={() => {}} />)
  expect(empty).not.toContain('<h5>Rituals</h5>')
})

it('grants Creature Ally and Creature Shape as daily innate spells from common summon and polymorph spells', () => {
  const spells = [
    entry('Summon Animal', 'spell', { tradition: 'Primal, Arcane' }, ['Summon']),
    entry('Summon Dragon', 'spell', { tradition: 'Arcane' }, ['Summon']),
    entry('Insect Form', 'spell', { tradition: 'Primal' }, ['Polymorph']),
    entry('Disguise', 'spell', { tradition: 'Arcane' }, ['Polymorph']),
  ]
  spells[1].level = 9
  spells[2].description = 'You transform into a battle form.'
  const c: Character = { ...base, systems: ['pf2e'], level: 17, feats: [
    { name: 'Creature Ally', type: 'Ancestry Feat', level: 13, choice: 'Summon Animal' },
    { name: 'Creature Shape', type: 'Ancestry Feat', level: 17, choice: 'Insect Form' },
  ] }
  expect(featSpellOptions(c, spells, c.feats[0])?.map(spell => spell.name)).toEqual(['Summon Animal'])
  expect(featSpellOptions(c, spells, c.feats[1])?.map(spell => spell.name)).toEqual(['Insect Form'])
  expect(grantedFeatSpells(c, spells).map(grant => [grant.entry.name, grant.rank, grant.rule.tradition]))
    .toEqual([['Summon Animal', 5, 'Primal'], ['Insect Form', 8, 'Primal']])
})

it('grants Witch patron hex cantrip, Cackle and chosen lesson hexes as focus spells', () => {
  const hex = (name: string, level: number, lesson?: string) => mapAonHit({ _id: name, _source: { name, category: 'spell', level,
    trait: ['Focus', 'Hex', 'Witch'], markdown: `Header\n\n${lesson ? `**Lesson**\n[${lesson}](/Lessons.aspx?ID=1)\n\n` : ''}---\n\nText` } }, 'pf2e')!
  const patron = mapAonHit({ _id: 'p', _source: { name: 'The Resentment', category: 'patron',
    markdown: 'Header\n\n---\n\n**Lesson of Rage** You gain the [_evil eye_](/Spells.aspx?ID=1) hex cantrip and your familiar learns [_fear_](/Spells.aspx?ID=2).' } }, 'pf2e')!
  const spells = [{ ...hex('Cackle', 1), data: {} }, hex('Veil of Dreams', 1, 'Lesson of Dreams'), hex('Personal Blizzard', 3, 'Lesson of Snow'),
    hex('Curse of Death', 5, 'Lesson of Death'), hex('Evil Eye', 1)]
  expect(patron.data.grants_focus_spells).toBe('evil eye')
  const c: Character = { ...base, className: 'Witch', level: 6, subclass: 'The Resentment', feats: [
    { name: 'Cackle', type: 'Class Feat', level: 1, slot: 'class:1:0' }, { name: 'Basic Lesson', type: 'Class Feat', level: 2, choice: 'Veil of Dreams', slot: 'class:2:0' },
    { name: 'Greater Lesson', type: 'Class Feat', level: 6, choice: 'Personal Blizzard', slot: 'class:6:0' }] }
  const all = [patron, ...spells]
  expect(focusSpells(c, all).spells.map(spell => spell.name)).toEqual(['Cackle', 'Evil Eye', 'Personal Blizzard', 'Veil of Dreams'])
  expect(focusSpells(c, all).points).toBe(3)
  expect(featSpellOptions(c, all, c.feats[1])?.map(spell => spell.name)).toEqual(['Veil of Dreams'])
  expect(featSpellOptions(c, all, c.feats[2])?.map(spell => spell.name)).toEqual(['Personal Blizzard'])
})
