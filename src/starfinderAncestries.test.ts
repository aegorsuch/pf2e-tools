import { expect, it } from 'vitest'
import snapshot from '../public/data/aon-sf2e.json?raw'
import { mapAonHits } from './aon'
import { automaticFeatChoiceKey, dailyInnateUses, featSpellOptions, grantedFeatSpells, unresolvedFeatSpells } from './featSpells'
import { resistances, additionalSkillCount, ancestryFlaws, automaticFeatGrants, boostSlots, computeAbilities, eligibleFeats, featChoiceOptions, featLores, featPrerequisiteChecker, hasParryWeapon, isGrantedSlot, maxHp, movementSpeeds, ownedShields, ownedWeapons, plannedSlots, ranksAt, savingThrowBreakdown, senses, shieldAcBonus, shieldRaisedChange, speed, tailbladeInheritance, totalHandCapacity, weaponAccessSources, weaponAttack } from './builder'
import type { Character, ContentEntry, OwnedWeapon } from './types'
import { getSettings, updateSettings } from './settings'

const hits: Parameters<typeof mapAonHits>[0] = JSON.parse(snapshot)
const entries = mapAonHits(hits.filter(hit => ['Ysoki', 'Vesk', 'Operative', 'Mechanic', 'Soldier'].includes(String(hit._source?.name))
  && ['ancestry', 'class'].includes(String(hit._source?.category)) || hit._source?.name === 'Brutal Anatomy'), 'sf2e')
const base: Character = {
  id: 'ancestry', name: 'Test', systems: ['sf2e'], level: 1, ancestry: 'Ysoki', className: 'Operative',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('restricts Vesk Internal Compartment to Enshrined Vesk without restricting Androids', () => {
  const feats = mapAonHits(hits.filter(hit => hit._source?.name === 'Internal Compartment'), 'sf2e')
  const slot = { key: 'ancestry:1:0', category: 'ancestry' as const, level: 1 }
  const vesk = { ...base, ancestry: 'Vesk', heritage: 'Enshrined Vesk' }
  expect(eligibleFeats(feats, vesk, slot).some(feat => feat.traits.includes('Vesk'))).toBe(true)
  expect(eligibleFeats(feats, { ...vesk, heritage: 'Frilled Vesk' }, slot).some(feat => feat.traits.includes('Vesk'))).toBe(false)
  expect(eligibleFeats(feats, { ...base, ancestry: 'Android' }, slot).some(feat => feat.traits.includes('Android'))).toBe(true)
})

it('provides native Ysoki jaws and replaces them for Fierce Ysoki', () => {
  const normal = ownedWeapons(base, entries).find(weapon => weapon.id === 'sf2e:ysoki:jaws')!
  expect(weaponAttack(base, entries, normal)).toMatchObject({ damage: '1d4 piercing', traits: expect.arrayContaining(['Agile', 'Finesse']) })
  const fierce = { ...base, heritage: 'Fierce Ysoki' }
  const jaws = ownedWeapons(fierce, entries).find(weapon => weapon.id === 'sf2e:ysoki:fierce-jaws')!
  expect(weaponAttack(fierce, entries, jaws)).toMatchObject({ damage: '1d8 piercing', traits: expect.arrayContaining(['Grapple']) })
  expect(ownedWeapons(fierce, entries).some(weapon => weapon.id === 'sf2e:ysoki:jaws')).toBe(false)
  expect(maxHp(fierce, entries) - maxHp(base, entries)).toBe(2)
  expect(boostSlots(fierce, entries).find(slot => slot.key === 'ancestry:0')?.fixed).toBe('str')
  expect(ancestryFlaws(fierce, entries)).toEqual(['dex'])
})

it('grants Shirren jaws only with its ancestral unarmed feat', () => {
  const featEntries = mapAonHits(hits.filter(hit => hit._source?.name === 'Ancestral Unarmed Attack'), 'sf2e')
  const shirrenFeat = featEntries.find(entry => entry.kind === 'feat' && entry.traits.includes('Shirren'))!
  const data = [...entries, ...featEntries]
  const shirren = { ...base, ancestry: 'Shirren' }
  expect(ownedWeapons(shirren, data).some(weapon => weapon.id === 'sf2e:shirren:jaws')).toBe(false)
  const selected: Character = { ...shirren, feats: [{ name: shirrenFeat.name, type: 'Ancestry Feat', level: 1, sourceId: shirrenFeat.id }] }
  const jaws = ownedWeapons(selected, data).find(weapon => weapon.id === 'sf2e:shirren:jaws')!
  expect(weaponAttack(selected, data, jaws)).toMatchObject({ damage: '1d6 piercing',
    traits: expect.arrayContaining(['Finesse', 'Unarmed']), criticalSpecialization: false })
  expect(weaponAttack({ ...selected, level: 5 }, data, jaws).criticalSpecialization).toBe(true)
  expect(ownedWeapons({ ...selected, systems: ['pf2e'] }, data).some(weapon => weapon.id === jaws.id)).toBe(false)
  expect(ownedWeapons({ ...selected, feats: [], weapons: [jaws] }, data).some(weapon => weapon.id === jaws.id)).toBe(false)
  const veskFeat = featEntries.find(entry => entry.kind === 'feat' && entry.traits.includes('Vesk'))!
  expect(ownedWeapons({ ...selected, ancestry: 'Vesk', feats: [{ ...selected.feats[0], sourceId: veskFeat.id }] }, data)
    .some(weapon => weapon.id === jaws.id)).toBe(false)
})

it('grants and improves Seismic Sensitivity tremorsense', () => {
  const featEntries = mapAonHits(hits.filter(hit => /^(?:Improved )?Seismic Sensitivity$/.test(String(hit._source?.name))), 'sf2e')
  const c: Character = { ...base, ancestry: 'Shirren', level: 5,
    feats: [{ name: 'Seismic Sensitivity', type: 'Ancestry Feat', level: 5 }] }
  expect(senses(c, featEntries)).toContainEqual({ value: 'Tremorsense (imprecise) 30 feet', source: 'Seismic Sensitivity' })
  expect(senses({ ...c, level: 4 }, featEntries).some(sense => /Tremorsense/i.test(sense.value))).toBe(false)
  const improved = { ...c, level: 13, feats: [...c.feats, { name: 'Improved Seismic Sensitivity', type: 'Ancestry Feat', level: 13 }] }
  expect(senses(improved, featEntries).filter(sense => /Tremorsense/i.test(sense.value))).toEqual([
    { value: 'Tremorsense (imprecise) 120 feet', source: 'Seismic Sensitivity, Improved Seismic Sensitivity' },
  ])
})

it('grants Basic Insectile Flight and improves Winged Shirren flight', () => {
  const catalog = mapAonHits(hits.filter(hit => ['Shirren', 'Winged Shirren', 'Basic Insectile Flight']
    .includes(String(hit._source?.name))), 'sf2e')
  const c: Character = { ...base, ancestry: 'Shirren', level: 9,
    feats: [{ name: 'Basic Insectile Flight', type: 'Ancestry Feat', level: 9 }] }
  expect(movementSpeeds(c, catalog)).toContainEqual({ name: 'Fly', feet: 20, source: 'Basic Insectile Flight' })
  expect(movementSpeeds({ ...c, level: 8 }, catalog).some(movement => movement.name === 'Fly')).toBe(false)
  const winged = { ...c, heritage: 'Winged Shirren' }
  expect(movementSpeeds({ ...winged, level: 8 }, catalog)).toContainEqual({ name: 'Fly', feet: 15, source: 'Winged Shirren' })
  expect(movementSpeeds(winged, catalog).filter(movement => movement.name === 'Fly'))
    .toEqual([{ name: 'Fly', feet: 25, source: 'Basic Insectile Flight' }])
})

it('upgrades Shirren jaws and critical poison with Bug Bite', () => {
  const featEntries = mapAonHits(hits.filter(hit => hit._source?.name === 'Ancestral Unarmed Attack'), 'sf2e')
  const source = featEntries.find(entry => entry.kind === 'feat' && entry.traits.includes('Shirren'))!
  const data = [...entries, ...featEntries]
  const c: Character = { ...base, ancestry: 'Shirren', level: 5, feats: [
    { name: source.name, type: 'Ancestry Feat', level: 1, sourceId: source.id },
    { name: 'Bug Bite', type: 'Ancestry Feat', level: 5 },
  ] }
  const jaws = ownedWeapons(c, data).find(weapon => weapon.id === 'sf2e:shirren:jaws')!
  const attack = weaponAttack(c, data, jaws)
  expect(attack.damage).toMatch(/^2d8/)
  expect(attack.traits).not.toContain('Finesse')
  expect(attack.traits).toContain('Unarmed')
  expect(attack.additionalDamage).toContainEqual(expect.objectContaining({ source: 'Bug Bite',
    value: '2 persistent poison (critical hit)' }))
  const stronger = weaponAttack({ ...c, level: 12 }, data, jaws)
  expect(stronger.damage).toMatch(/^3d8/)
  expect(stronger.additionalDamage).toContainEqual(expect.objectContaining({ source: 'Bug Bite',
    value: '3 persistent poison (critical hit)' }))
  expect(weaponAttack({ ...c, level: 4 }, data, jaws)).toMatchObject({
    damage: expect.stringMatching(/^2d6/), traits: expect.arrayContaining(['Finesse']),
  })
})

it('grants heritage training, duplicate replacement slots and fixed skill feats', () => {
  const shipborn: Character = { ...base, heritage: 'Shipborn Ysoki' }
  expect(ranksAt(shipborn, entries).Piloting).toBe(1)
  expect(ranksAt({ ...base, heritage: 'Listener Ysoki' }, entries).Occultism).toBe(1)
  expect(automaticFeatGrants({ ...base, heritage: 'Tunnel Ysoki' }, entries))
    .toContainEqual({ name: 'Quick Squeeze', source: 'Tunnel Ysoki', level: 1 })
  const mechanic: Character = { ...base, className: 'Mechanic', heritage: 'Akitonian Ysoki' }
  expect(automaticFeatGrants(mechanic, entries)).toContainEqual({ name: 'Quick Repair', source: 'Akitonian Ysoki', level: 1 })
  const soldier: Character = { ...base, className: 'Soldier', ancestry: 'Vesk', heritage: 'Frilled Vesk' }
  expect(ranksAt(soldier, entries).Intimidation).toBe(1)
  expect(additionalSkillCount(soldier, entries)).toBe(additionalSkillCount({ ...soldier, heritage: undefined }, entries) + 1)
})

it('applies Damaya Lashunta ability adjustments, Diplomacy and Additional Lore from the real catalog', () => {
  const catalog = mapAonHits(hits.filter(hit => ['Lashunta', 'Damaya Lashunta'].includes(String(hit._source?.name))
    && ['ancestry', 'heritage'].includes(String(hit._source?.category))), 'sf2e')
  const heritage = catalog.find(entry => entry.name === 'Damaya Lashunta')!
  const c: Character = { ...base, className: undefined, ancestry: 'Lashunta', heritage: heritage.name,
    boosts: { 'ancestry:1': 'int' },
    automaticFeatChoices: { [automaticFeatChoiceKey(heritage.name, 'Additional Lore')]: 'Astronomy' } }
  expect(heritage.data).toMatchObject({ heritage_ability_boosts: 'Intelligence', heritage_ability_flaws: 'Constitution',
    heritage_free_boost_exclusions: 'Intelligence', grants_skill: 'Diplomacy', grants_heritage_feats: 'Additional Lore' })
  expect(boostSlots(c, catalog)).toEqual(expect.arrayContaining([
    expect.objectContaining({ fixed: 'int' }),
    expect.objectContaining({ key: 'ancestry:1', options: expect.not.arrayContaining(['int']) }),
  ]))
  expect(ancestryFlaws(c, catalog)).toContain('con')
  expect(computeAbilities(c, catalog)).toMatchObject({ int: 12, con: 8 })
  expect(ranksAt(c, catalog).Diplomacy).toBe(1)
  expect(automaticFeatGrants(c, catalog)).toContainEqual({ name: 'Additional Lore', source: heritage.name, level: 1 })
  expect(featLores(c, catalog)).toContain('Astronomy Lore')
  for (const [level, rank] of [[1, 1], [3, 2], [7, 3], [15, 4]]) {
    expect(ranksAt({ ...c, level }, catalog)['Astronomy Lore']).toBe(rank)
  }
  const background: ContentEntry = { id: 'envoy-background', name: 'Envoy Background', kind: 'background', systems: ['sf2e'],
    source: 'official', level: 1, traits: [], description: '', data: { skill: 'Diplomacy' }, effects: [], updatedAt: 0 }
  const withBackground = { ...c, background: background.name }
  expect(additionalSkillCount(withBackground, [...catalog, background])
    - additionalSkillCount({ ...withBackground, heritage: undefined }, [...catalog, background])).toBe(1)
})

it('grants two independent advancing lores and Legendary Professional from Damaya Self-Perfection', () => {
  const catalog = mapAonHits(hits.filter(hit => ['Lashunta', 'Damaya Lashunta', 'Damaya Self-Perfection',
    'Additional Lore', 'Legendary Professional'].includes(String(hit._source?.name))), 'sf2e')
  const feat = catalog.find(entry => entry.name === 'Damaya Self-Perfection')!
  const slot = 'ancestry:17:0'
  const key = (index: number) => automaticFeatChoiceKey(feat.name, 'Additional Lore', `${slot}:${index}`)
  const c: Character = { ...base, ancestry: 'Lashunta', heritage: 'Damaya Lashunta', level: 17,
    feats: [{ name: feat.name, sourceId: feat.id, type: 'Ancestry Feat', level: 17, slot }],
    automaticFeatChoices: { [key(1)]: 'Engineering', [key(2)]: 'Warfare' } }
  expect(featPrerequisiteChecker(c, catalog)(feat).missing).toEqual([])
  expect(featPrerequisiteChecker({ ...c, heritage: 'Korasha Lashunta' }, catalog)(feat).missing).toContain('Damaya Lashunta heritage')
  expect(automaticFeatGrants(c, catalog).filter(grant => grant.source === feat.name)).toEqual([
    expect.objectContaining({ name: 'Additional Lore', choiceKey: key(1) }),
    expect.objectContaining({ name: 'Additional Lore', choiceKey: key(2) }),
    expect.objectContaining({ name: 'Legendary Professional' }),
  ])
  expect(featLores(c, catalog)).toEqual(expect.arrayContaining(['Engineering Lore', 'Warfare Lore']))
  expect(ranksAt(c, catalog)).toMatchObject({ 'Engineering Lore': 4, 'Warfare Lore': 4 })
  expect(featLores({ ...c, level: 16 }, catalog)).not.toContain('Engineering Lore')
  expect(automaticFeatGrants({ ...c, level: 16 }, catalog).some(grant => grant.source === feat.name)).toBe(false)
  expect(featLores({ ...c, feats: [] }, catalog)).not.toContain('Warfare Lore')
  expect(featLores(c, catalog)).toContain('Warfare Lore')
})

it('grants doshko training and Vesk weapon familiarity without affecting unrelated weapons', () => {
  const c: Character = { ...base, className: undefined, ancestry: 'Vesk', level: 5,
    feats: [{ name: 'Vesk Weapon Familiarity', type: 'Ancestry Feat', level: 1 }] }
  const doshko: ContentEntry = { id: 'doshko', name: 'Tactical Doshko', kind: 'weapon', systems: ['sf2e'],
    source: 'official', level: 1, traits: [], description: '', effects: [], updatedAt: 0,
    data: { weapon_category: 'Advanced', weapon_type: 'Melee', damage: '1d8 slashing' } }
  const own: OwnedWeapon = { id: doshko.id, name: doshko.name, potency: 0, striking: 0, runes: [] }
  expect(weaponAttack(c, [doshko], own)).toMatchObject({ rank: 1, criticalSpecialization: true })
  const ancestral = { ...doshko, name: 'Vesk Blade', traits: ['Vesk', 'Uncommon'], data: { ...doshko.data, rarity: 'uncommon' } }
  expect(weaponAccessSources(c, [ancestral], ancestral)).toContain('Vesk Weapon Familiarity')
  expect(weaponAttack(c, [doshko], { ...own, name: 'Other Blade' }).criticalSpecialization).toBe(false)
})

it('shows limited telepathy and increases its range for each active Distant Telepath', () => {
  const previous = getSettings().singleDistantTelepath
  updateSettings({ singleDistantTelepath: false })
  try {
  const c: Character = { ...base, ancestry: 'Lashunta', level: 5, feats: [
    { name: 'Distant Telepath', type: 'Ancestry Feat', level: 1 },
    { name: 'Distant Telepath', type: 'Ancestry Feat', level: 1, takenLevel: 5 },
    { name: 'Distant Telepath', type: 'Ancestry Feat', level: 1, takenLevel: 9 },
  ] }
  expect(senses({ ...c, feats: [] }, entries)).toContainEqual({ value: 'Limited Telepathy 30 feet', source: 'Lashunta' })
  expect(senses(c, entries)).toContainEqual({ value: 'Limited Telepathy 60 feet', source: 'Lashunta, Distant Telepath' })
  expect(senses({ ...c, heritage: 'Ascendant Psychic Lashunta' }, entries))
    .toContainEqual({ value: 'Limited Telepathy 150 feet', source: 'Ascendant Psychic Lashunta, Distant Telepath' })
  expect(senses({ ...c, heritage: 'Static Mind Lashunta' }, entries).some(sense => /telepathy/i.test(sense.value))).toBe(false)
  expect(senses({ ...c, ancestry: 'Human', heritage: 'Damai Human' }, entries))
    .toContainEqual({ value: 'Limited Telepathy 60 feet', source: 'Damai Human, Distant Telepath' })
  expect(senses({ ...c, ancestry: 'Worlanisi', heritage: 'Luckless Worlanisi' }, entries)
    .some(sense => /telepathy/i.test(sense.value))).toBe(false)
  expect(senses({ ...c, ancestry: 'Human', heritage: undefined }, entries).some(sense => /telepathy/i.test(sense.value))).toBe(false)
  expect(senses({ ...c, feats: [...c.feats, { name: 'Eyeswide Detective Dedication', type: 'Archetype Feat', level: 2 }] }, entries))
    .toContainEqual({ value: 'Limited Telepathy 90 feet', source: 'Lashunta, Eyeswide Detective Dedication, Distant Telepath' })
  updateSettings({ singleDistantTelepath: true })
  expect(senses(c, entries)).toContainEqual({ value: 'Limited Telepathy 45 feet', source: 'Lashunta, Distant Telepath' })
  } finally { updateSettings({ singleDistantTelepath: previous }) }
})

it('grants Sensitive Antennae thoughtsense and improves its precision at level 9', () => {
  const c: Character = { ...base, ancestry: 'Lashunta', level: 5,
    feats: [{ name: 'Sensitive Antennae', type: 'Ancestry Feat', level: 5 }] }
  const catalog = mapAonHits(hits.filter(hit => hit._source?.name === 'Sensitive Antennae'), 'sf2e')
  expect(senses({ ...c, level: 4 }, catalog).some(sense => /thoughtsense/i.test(sense.value))).toBe(false)
  expect(senses(c, catalog).filter(sense => /thoughtsense/i.test(sense.value)))
    .toEqual([{ value: 'Thoughtsense (vague) 30 feet', source: 'Sensitive Antennae' }])
  expect(senses({ ...c, level: 9 }, catalog).filter(sense => /thoughtsense/i.test(sense.value)))
    .toEqual([{ value: 'Thoughtsense (imprecise) 30 feet', source: 'Sensitive Antennae' }])
})

it('grants Psychic Talent with an occult cantrip from the real catalog', () => {
  const catalog = mapAonHits(hits.filter(hit => ['Psychic Talent', 'Daze'].includes(String(hit._source?.name))), 'sf2e')
  const talent = catalog.find(entry => entry.kind === 'feat' && entry.name === 'Psychic Talent')!
  const c: Character = { ...base, ancestry: 'Lashunta', level: 7,
    feats: [{ name: talent.name, sourceId: talent.id, type: 'Ancestry Feat', level: 1, choice: 'Daze' }] }
  expect(featSpellOptions(c, catalog, c.feats[0])?.map(spell => spell.name)).toContain('Daze')
  expect(grantedFeatSpells(c, catalog)).toMatchObject([{ entry: { name: 'Daze' }, rank: 4,
    rule: { kind: 'innate', tradition: 'occult', frequency: 'at will' } }])
})

it('grants Psychic Investigator spells with independent daily uses', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  try {
    const catalog = mapAonHits(hits.filter(hit => ['Psychic Investigator', 'Psychic Bully', 'Psychic Scholar', 'Psychic Talent', 'Hypercognition', 'Mind Reading']
      .includes(String(hit._source?.name))), 'sf2e')
    const feat = catalog.find(entry => entry.kind === 'feat' && entry.name === 'Psychic Investigator')!
    const c: Character = { ...base, ancestry: 'Lashunta', level: 13,
      feats: [{ name: feat.name, sourceId: feat.id, type: 'Ancestry Feat', level: 13 }] }
    expect(featPrerequisiteChecker(c, catalog)(feat).missing.length).toBeGreaterThan(0)
    for (const name of ['Psychic Bully', 'Psychic Scholar', 'Psychic Talent']) {
      const withPrerequisite = { ...c, feats: [...c.feats, { name, type: 'Ancestry Feat', level: 1 }] }
      expect(featPrerequisiteChecker(withPrerequisite, catalog)(feat).missing).toEqual([])
    }
    const grants = grantedFeatSpells(c, catalog)
    expect(grants.map(grant => [grant.entry.name, grant.rank, grant.rule.tradition, grant.rule.frequency]))
      .toEqual([['Hypercognition', 3, 'occult', 'once per day'], ['Mind Reading', 3, 'occult', 'once per day']])
    expect(grants.map(grant => dailyInnateUses(c, grant)?.remaining)).toEqual([1, 1])
    const spent = { ...c, innateSpellUses: { [grants[0].usageKey]: 1 } }
    expect(grants.map(grant => dailyInnateUses(spent, grant)?.remaining)).toEqual([0, 1])
    expect(grantedFeatSpells({ ...c, level: 12 }, catalog)).toEqual([])
    expect(unresolvedFeatSpells(c, [feat]).map(item => item.name)).toEqual(['Hypercognition', 'Mind Reading'])
    updateSettings({ innateAutoHeighten: true })
    expect(grantedFeatSpells(c, catalog).map(grant => grant.rank)).toEqual([7, 7])
  } finally { updateSettings({ innateAutoHeighten: previous }) }
})

it('grants Lush Psychic primal innate spells with independent daily uses', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  try {
    const catalog = mapAonHits(hits.filter(hit => ['Lush Psychic', 'Cellular Stimulant', 'Gentle Landing']
      .includes(String(hit._source?.name))), 'sf2e')
    const lush = catalog.find(entry => entry.kind === 'feat' && entry.name === 'Lush Psychic')!
    const c: Character = { ...base, ancestry: 'Lashunta', level: 5,
      feats: [{ name: lush.name, sourceId: lush.id, type: 'Ancestry Feat', level: 5 }] }
    const grants = grantedFeatSpells(c, catalog)
    expect(grants.map(grant => [grant.entry.name, grant.rank, grant.rule.tradition, grant.rule.frequency]))
      .toEqual([['Cellular Stimulant', 1, 'primal', 'once per day'], ['Gentle Landing', 1, 'primal', 'once per day']])
    expect(grants.map(grant => dailyInnateUses(c, grant)?.remaining)).toEqual([1, 1])
    const spent = { ...c, innateSpellUses: { [grants[0].usageKey]: 1 } }
    expect(grants.map(grant => dailyInnateUses(spent, grant)?.remaining)).toEqual([0, 1])
    expect(grantedFeatSpells({ ...c, level: 4 }, catalog)).toEqual([])
    expect(unresolvedFeatSpells(c, [lush]).map(item => item.name)).toEqual(['Cellular Stimulant', 'Gentle Landing'])
  } finally {
    updateSettings({ innateAutoHeighten: previous })
  }
})

it('grants Tectonic Psychic Wall of Fire and Burstmoji as separate innate spells', () => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  try {
    const catalog = mapAonHits(hits.filter(hit => ['Tectonic Psychic', 'Wall of Fire', 'Burstmoji']
      .includes(String(hit._source?.name))), 'sf2e')
    const feat = catalog.find(entry => entry.kind === 'feat' && entry.name === 'Tectonic Psychic')!
    const c: Character = { ...base, ancestry: 'Lashunta', level: 17,
      feats: [{ name: feat.name, sourceId: feat.id, type: 'Ancestry Feat', level: 17 }] }
    const grants = grantedFeatSpells(c, catalog)
    expect(grants.map(grant => [grant.entry.name, grant.rank, grant.rule.tradition, grant.rule.frequency]))
      .toEqual([['Wall of Fire', 7, 'primal', 'once per day'], ['Burstmoji', 7, 'primal', 'once per day']])
    expect(grants.map(grant => dailyInnateUses(c, grant)?.remaining)).toEqual([1, 1])
    const spent = { ...c, innateSpellUses: { [grants[0].usageKey]: 1 } }
    expect(grants.map(grant => dailyInnateUses(spent, grant)?.remaining)).toEqual([0, 1])
    expect(unresolvedFeatSpells(c, catalog)).toEqual([])
    expect(unresolvedFeatSpells(c, catalog.filter(entry => entry.name !== 'Burstmoji')).map(item => item.name)).toEqual(['Burstmoji'])
    expect(grantedFeatSpells({ ...c, level: 16 }, catalog)).toEqual([])
    updateSettings({ innateAutoHeighten: true })
    expect(grantedFeatSpells(c, catalog).map(grant => grant.rank)).toEqual([9, 9])
  } finally { updateSettings({ innateAutoHeighten: previous }) }
})

it('applies Lashunta ancestral weapon familiarity to every grade of its listed weapons', () => {
  const catalog = mapAonHits(hits.filter(hit => hit._source?.name === 'Ancestral Weapon Familiarity'
    || /\b(?:seeker rifle|shuriken drone|singing spear|laser rifle)\b/i.test(String(hit._source?.name))), 'sf2e')
  const source = catalog.find(entry => entry.name === 'Ancestral Weapon Familiarity' && entry.traits.includes('Lashunta'))!
  const wizard: ContentEntry = { id: 'wizard', name: 'Wizard', kind: 'class', source: 'official', systems: ['sf2e'],
    level: 1, traits: [], description: '', data: { attack_proficiency: 'Expert in simple weapons, Trained in martial weapons' },
    effects: [], updatedAt: 0 }
  const allEntries = [...catalog, wizard]
  const c: Character = { ...base, level: 5, ancestry: 'Lashunta', className: 'Wizard',
    feats: [{ name: source.name, sourceId: source.id, type: 'Ancestry Feat', level: 1 }] }
  for (const name of ['Shuriken Drone', 'Singing Spear', 'Seeker Rifle']) {
    const weapon: OwnedWeapon = { id: name, name, potency: 0, striking: 0, runes: [] }
    const tactical = { ...weapon, name: `Tactical ${name}` }
    expect(weaponAttack({ ...c, level: 1 }, allEntries, weapon).rank).toBe(2)
    expect(weaponAttack(c, allEntries, weapon)).toMatchObject({ rank: 2, criticalSpecialization: true })
    expect(weaponAttack(c, allEntries, tactical)).toMatchObject({ rank: 2, criticalSpecialization: true })
    if (name !== 'Seeker Rifle') expect(weaponAttack({ ...c, feats: [] }, allEntries, weapon).rank).toBe(1)
    if (name !== 'Seeker Rifle') expect(weaponAttack({ ...c, ancestry: 'Vesk' }, allEntries, weapon).rank).toBe(1)
    expect(weaponAttack({ ...c, feats: [] }, allEntries, weapon).criticalSpecialization).toBe(false)
    expect(weaponAttack({ ...c, level: 4 }, allEntries, weapon).criticalSpecialization).toBe(false)
    expect(weaponAttack({ ...c, level: 20 }, allEntries, weapon)).toMatchObject({ rank: 2, criticalSpecialization: true })
  }
  const other: OwnedWeapon = { id: 'other', name: 'Laser Rifle', potency: 0, striking: 0, runes: [] }
  expect(weaponAttack(c, allEntries, other).rank).toBe(weaponAttack({ ...c, feats: [] }, allEntries, other).rank)
  expect(weaponAttack(c, allEntries, other).criticalSpecialization).toBe(false)
})

it('provides Warblood Vesk two distinct Brutal Anatomy choices and attacks', () => {
  const c: Character = { ...base, ancestry: 'Vesk', heritage: 'Warblood Vesk', level: 5 }
  const slots = plannedSlots(c, entries).filter(slot => slot.grantedBy === 'Warblood Vesk')
  expect(slots).toHaveLength(2)
  expect(slots.every(slot => isGrantedSlot(slot.key))).toBe(true)
  expect(eligibleFeats(entries, c, slots[0]).map(feat => feat.name)).toEqual(['Brutal Anatomy'])
  const selected: Character = { ...c, feats: [{ name: 'Brutal Anatomy', choice: 'Claw',
    type: 'Ancestry Feat', level: 1, slot: slots[0].key }] }
  expect(featChoiceOptions('Brutal Anatomy', selected, entries, slots[1].key)).toEqual(['Jaws', 'Tail'])
  expect(eligibleFeats(entries, selected, slots[1]).map(feat => feat.name)).toEqual(['Brutal Anatomy'])
  const claw = ownedWeapons(selected, entries).find(weapon => weapon.id === 'sf2e:vesk:claw')!
  expect(weaponAttack(selected, entries, claw)).toMatchObject({ damage: expect.stringMatching(/d6 slashing/), criticalSpecialization: true,
    traits: expect.arrayContaining(['Agile', 'Finesse']) })
  expect(weaponAttack({ ...selected, level: 4 }, entries, claw).criticalSpecialization).toBe(false)
})

it('does not duplicate Brutal Anatomy attacks from imported feat entries', () => {
  const c: Character = { ...base, ancestry: 'Vesk', className: 'Soldier', level: 10,
    feats: ['Claw', 'Jaws', 'Tail'].map(choice => ({ name: 'Brutal Anatomy', choice, type: 'Ancestry Feat', level: 1 })),
    weapons: ['Claw', 'Jaws', 'Tail'].map(name => ({ id: `old-${name}`, name, potency: 0, striking: 0, runes: [] })) }
  const attacks = ownedWeapons(c, entries).filter(weapon => /(?:claw|jaws|tail)/i.test(weapon.name))
  expect(attacks.map(weapon => weapon.name).sort()).toEqual(['Claw', 'Jaws', 'Tail'])
})

it('inherits the Vesk tail on a newly added graded Tailblade from the real catalog', () => {
  const blades = mapAonHits(hits.filter(hit => /\btailblade\b/i.test(String(hit._source?.name))), 'sf2e')
  const blade: OwnedWeapon = { id: 'blade', name: 'Tailblade', potency: 0, striking: 0, runes: [], stowed: true }
  const c: Character = { ...base, ancestry: 'Vesk', className: 'Soldier', level: 20,
    feats: [{ name: 'Brutal Anatomy', choice: 'Tail', type: 'Ancestry Feat', level: 1 }], weapons: [blade] }
  const allEntries = [...entries, ...blades]
  expect(weaponAttack(c, allEntries, blade).traits).toEqual(expect.arrayContaining(['Sweep', 'Trip', 'Versatile B']))
  expect(tailbladeInheritance(c, allEntries, blade).replacedTailIds).toContain('sf2e:vesk:tail')
  expect(weaponAttack(c, allEntries, blade).damage).toContain('4d4')
})

it.each(['Pulse Gauntlet', 'Crimson Claw'])('inherits fist and claw traits for graded %s', name => {
  const weapons = mapAonHits(hits.filter(hit => new RegExp(`\\b${name}\\b`, 'i').test(String(hit._source?.name))), 'sf2e')
  const claw: ContentEntry = { id: 'natural-claw', name: 'Natural Claw', kind: 'weapon', systems: ['sf2e'], source: 'official',
    level: 1, traits: ['Unarmed', 'Parry', 'Trip'], description: '', effects: [], updatedAt: 0,
    data: { weapon_category: 'Unarmed', weapon_type: 'Melee', damage: '1d6 slashing', granted_by_feat: 'Natural Claw' } }
  const tail: ContentEntry = { ...claw, id: 'natural-tail', name: 'Natural Tail', traits: ['Unarmed', 'Sweep'],
    data: { ...claw.data, granted_by_feat: 'Natural Tail' } }
  const owned: OwnedWeapon = { id: 'weapon', name, potency: 0, striking: 0, runes: [], stowed: true }
  const c: Character = { ...base, level: 20, className: 'Soldier', weapons: [owned],
    feats: [{ name: 'Natural Claw', type: 'Ancestry Feat', level: 1 }, { name: 'Natural Tail', type: 'Ancestry Feat', level: 1 }] }
  const allEntries = [...weapons, claw, tail]
  for (const weaponMode of name === 'Crimson Claw' ? ['mode-1', 'mode-2'] : [undefined]) {
    const attack = weaponAttack(c, allEntries, { ...owned, weaponMode })
    expect(attack.traits).toEqual(expect.arrayContaining([
      'Parry', 'Trip', 'Versatile S', ...(name === 'Pulse Gauntlet' ? ['Versatile B'] : []),
    ]))
    expect(attack.traits).not.toContain('Unarmed')
    expect(attack.traits).not.toContain('Nonlethal')
    expect(attack.traits).not.toContain('Sweep')
    if (name === 'Crimson Claw') expect(attack.damage).toMatch(weaponMode === 'mode-1' ? /^4d4 fire/ : /^4d6 slashing/)
    else expect(attack.damage).toMatch(/^4d4/)
  }
  expect(hasParryWeapon(c, allEntries)).toBe(true)
  const withoutClaw = { ...c, feats: [] }
  if (name === 'Pulse Gauntlet') expect(weaponAttack(withoutClaw, allEntries, owned).traits).toContain('Versatile B')
  expect(weaponAttack(withoutClaw, allEntries, owned).traits).not.toContain('Parry')
  if (name === 'Crimson Claw') expect(ownedWeapons(withoutClaw, allEntries).map(weapon => weapon.name)).not.toContain('Fists')
  expect(weaponAttack({ ...c, level: 1, feats: [{ name: 'Natural Claw', type: 'Ancestry Feat', level: 5 }] },
    allEntries, owned).traits).not.toContain('Parry')
  expect(ownedWeapons(c, allEntries).map(weapon => weapon.name)).toContain('Natural Claw')
})

it('applies heritage senses and Vesk movement and tail without stacking duplicate tails', () => {
  expect(senses({ ...base, heritage: 'Deep Ysoki' }, entries).map(sense => sense.value)).toContain('Darkvision')
  expect(senses({ ...base, heritage: 'Longsnout Ysoki' }, entries).map(sense => sense.value)).toContain('Scent (imprecise) 30 feet')
  const vesk = { ...base, ancestry: 'Vesk' }
  expect(senses({ ...vesk, heritage: 'Nightstalker Vesk' }, entries).map(sense => sense.value)).toContain('Darkvision')
  expect(speed({ ...vesk, heritage: 'Briskwander Vesk' }, entries)).toBe(25)
  const swimmer = { ...vesk, heritage: 'Wavecrested Vesk', level: 16 }
  expect(movementSpeeds(swimmer, entries)).toContainEqual(expect.objectContaining({ name: 'Swim', feet: 30 }))
  const climber = { ...vesk, heritage: 'Horizon Seeker Vesk', feats: [
    { name: 'Prehensile Limbs', type: 'Ancestry Feat', level: 5 }] }
  expect(totalHandCapacity({ ...climber, level: 5 })).toBe(3)
  expect(movementSpeeds(climber, entries)).toContainEqual(expect.objectContaining({ name: 'Climb', feet: 20 }))
})

it('grants Blood Sense only once the feat is active', () => {
  const c: Character = { ...base, ancestry: 'Vesk', level: 5,
    feats: [{ name: 'Blood Sense', type: 'Ancestry Feat', level: 5 }] }
  const sense = 'Blood sense (imprecise) 30 feet'
  expect(senses(c, entries).map(item => item.value)).toContain(sense)
  expect(senses({ ...c, level: 4 }, entries).map(item => item.value)).not.toContain(sense)
})

it('shows Fearless as a conditional saving throw effect', () => {
  const c: Character = { ...base, ancestry: 'Vesk', feats: [{ name: 'Fearless', type: 'Ancestry Feat', level: 1 }] }
  const result = savingThrowBreakdown(c, entries, 'Will')
  expect(result.notes?.join(' ')).toContain('a successful save against a fear effect becomes a critical success')
  expect(result.total).toBe(savingThrowBreakdown({ ...c, feats: [] }, entries, 'Will').total)
})

it('provides Fork-Tongued Vesk venomous jaws and its special critical damage', () => {
  const c: Character = { ...base, ancestry: 'Vesk', heritage: 'Fork-Tongued Vesk', level: 1 }
  const jaws = ownedWeapons(c, entries).find(weapon => weapon.id === 'sf2e:vesk:venomous-jaws')!
  expect(weaponAttack(c, entries, jaws)).toMatchObject({ damage: expect.stringMatching(/1d4.*poison/),
    traits: expect.arrayContaining(['Grapple', 'Unarmed']), criticalSpecialization: false,
    criticalNote: '1 persistent poison damage on a critical hit.' })
  expect(weaponAttack({ ...c, level: 7 }, entries, jaws).criticalNote).toBe('2 persistent poison damage on a critical hit.')
  expect(ownedWeapons({ ...c, heritage: undefined, weapons: [jaws] }, entries).some(weapon => weapon.id === jaws.id)).toBe(false)
})

it('grants the heightened occult Daze cantrip to Venomthought Vesk', () => {
  const daze = mapAonHits(hits.filter(hit => hit._source?.category === 'spell' && hit._source?.name === 'Daze'), 'sf2e')
  const c: Character = { ...base, ancestry: 'Vesk', heritage: 'Venomthought Vesk', level: 7 }
  expect(grantedFeatSpells(c, [...entries, ...daze])).toContainEqual(expect.objectContaining({
    source: 'Venomthought Vesk', rank: 4, entry: expect.objectContaining({ name: 'Daze' }),
    rule: expect.objectContaining({ kind: 'innate', tradition: 'occult', frequency: 'at will', heightened: true }),
  }))
  expect(unresolvedFeatSpells(c, entries)).toContainEqual(expect.objectContaining({ name: 'Daze', sourceName: 'Venomthought Vesk' }))
  expect(grantedFeatSpells({ ...c, heritage: undefined }, [...entries, ...daze]).some(grant => grant.source === 'Venomthought Vesk')).toBe(false)
})

it('grants the Veskarium logistics feats at the correct level', () => {
  const c: Character = { ...base, ancestry: 'Vesk', level: 9,
    feats: [{ name: 'Veskarium Logistics Specialist', type: 'Ancestry Feat', level: 9 }] }
  expect(automaticFeatGrants(c, entries)).toEqual(expect.arrayContaining([
    { name: 'Prescient Planner', source: 'Veskarium Logistics Specialist', level: 9 },
    { name: 'Prescient Consumable', source: 'Veskarium Logistics Specialist', level: 9 },
  ]))
  expect(automaticFeatGrants({ ...c, level: 8 }, entries).some(grant => grant.source === 'Veskarium Logistics Specialist')).toBe(false)
})

it('grants Enshrined Vesk Fortified Monument as a self-only sixth-rank Cairn Form with retaliation', () => {
  const catalog = mapAonHits(hits.filter(hit => ['Fortified Monument', 'Cairn Form'].includes(String(hit._source?.name))), 'sf2e')
  const c: Character = { ...base, ancestry: 'Vesk', heritage: 'Enshrined Vesk', level: 13,
    feats: [{ name: 'Fortified Monument', type: 'Ancestry Feat', level: 13 }] }
  const previous = getSettings().innateAutoHeighten
  try {
    updateSettings({ innateAutoHeighten: false })
    const grant = grantedFeatSpells(c, catalog).find(item => item.source === 'Fortified Monument')!
    expect(grant).toMatchObject({ entry: { name: 'Cairn Form' }, rank: 6,
      rule: { kind: 'innate', tradition: 'divine', frequency: 'twice per day', fixedRank: true,
        condition: expect.stringContaining('Must target yourself') } })
    expect(grant.rule.condition).toContain('takes 8 bludgeoning damage')
    expect(dailyInnateUses(c, grant)?.limit).toBe(2)
    expect(grantedFeatSpells({ ...c, level: 12 }, catalog)).toEqual([])
    expect(grantedFeatSpells({ ...c, heritage: undefined }, catalog)).toEqual([])
  } finally {
    updateSettings({ innateAutoHeighten: previous })
  }
})

it('shows Advantageous Assault conditional damage only for weapons', () => {
  const c: Character = { ...base, ancestry: 'Vesk', level: 13,
    feats: [{ name: 'Advantageous Assault', type: 'Ancestry Feat', level: 13 }] }
  const weapon: ContentEntry = { id: 'blade', name: 'Blade', kind: 'weapon', systems: ['sf2e'], source: 'official',
    level: 1, traits: [], description: '', effects: [], updatedAt: 0,
    data: { weapon_category: 'Simple', weapon_type: 'Melee', damage: '1d6 slashing' } }
  const owned: OwnedWeapon = { id: 'blade', name: 'Blade', potency: 0, striking: 0, runes: [] }
  const result = weaponAttack(c, [weapon], owned)
  expect(result.breakdown.notes?.join(' ')).toContain('a Strike against a frightened or bleeding creature deals +1 circumstance damage')
  const jaws = ownedWeapons({ ...c, heritage: 'Fork-Tongued Vesk' }, entries).find(item => item.id === 'sf2e:vesk:venomous-jaws')!
  expect(weaponAttack(c, entries, jaws).breakdown.notes?.join(' ')).not.toContain('Advantageous Assault')
})

it('grants both Battle Saint spells independently as seventh-rank divine spells', () => {
  const data = mapAonHits(hits.filter(hit => ['Battle Saint', 'Rocket Dash', 'Haste'].includes(String(hit._source?.name))), 'sf2e')
  const c: Character = { ...base, ancestry: 'Vesk', level: 17,
    feats: [{ name: 'Battle Saint', type: 'Ancestry Feat', level: 17 }] }
  const grants = grantedFeatSpells(c, data).filter(grant => grant.source === 'Battle Saint')
  expect(grants.map(grant => grant.entry.name).sort()).toEqual(['Haste', 'Rocket Dash'])
  expect(grants.every(grant => grant.rule.rank === 7 && grant.rule.tradition?.toLowerCase() === 'divine'
    && grant.rule.frequency === 'once per day' && !grant.rule.shared)).toBe(true)
  expect(new Set(grants.map(grant => grant.usageKey)).size).toBe(2)
})

it('applies Android heritage attributes, training, fixed skill feats and Nightvision Adaptation', () => {
  const androidEntries = mapAonHits(hits.filter(hit => ['Android', 'Operative'].includes(String(hit._source?.name))
    && ['ancestry', 'class'].includes(String(hit._source?.category))), 'sf2e')
  const android: Character = { ...base, ancestry: 'Android', level: 2 }
  const heritage = (name: string) => ({ ...android, heritage: name })
  expect(ancestryFlaws(android, androidEntries)).toEqual(['cha'])
  expect(ancestryFlaws(heritage('Biotech Android'), androidEntries)).toEqual(['con'])
  expect(ancestryFlaws(heritage('Electronica Android'), androidEntries)).toEqual(['wis'])
  expect(boostSlots(heritage('Hellforged Android'), androidEntries).find(slot => slot.key === 'ancestry:0')?.fixed).toBe('str')
  expect(boostSlots(heritage('Electronica Android'), androidEntries).find(slot => slot.key === 'ancestry:1')?.fixed).toBe('cha')
  expect(ranksAt(heritage('Artificial Scion Android'), androidEntries).Computers).toBe(1)
  expect(ranksAt(heritage('Biotech Android'), androidEntries).Nature).toBe(1)
  expect(ranksAt(heritage('Electronica Android'), androidEntries).Performance).toBe(1)
  expect(ranksAt(heritage('Replicant Android'), androidEntries).Deception).toBe(1)
  expect(automaticFeatGrants(heritage('Artificial Scion Android'), androidEntries)).toContainEqual({ name: 'Phreaker', source: 'Artificial Scion Android', level: 1 })
  expect(automaticFeatGrants(heritage('Renewed Android'), androidEntries).map(grant => grant.name)).toContain('Dubious Knowledge')
  const nightvision = { ...android, feats: [{ name: 'Nightvision Adaptation', type: 'Ancestry Feat', level: 1 }] }
  expect(senses(nightvision, androidEntries).map(sense => sense.value)).toContain('Darkvision')
})

it('automates Pahtra and Kasatha ancestry feats', () => {
  const names = ['Predatory', 'Climbing Claws', 'Remix World\'s Rhythm', 'Adat Training', 'A Little Piece of Home', 'Pahtra Lore', 'Harmonic Shielding', 'Melodic Adaptation', 'Ancestral Darkvision']
  const feats = mapAonHits(hits.filter(hit => hit._source?.category === 'feat' && names.includes(String(hit._source?.name))
    && (hit._source?.trait as string[] | undefined)?.some(trait => ['Pahtra', 'Kasatha'].includes(trait))), 'sf2e')
  const spells = ['Haste', 'Slow', 'Holographic Memory', 'Void Whispers', 'Verdant Code'].map((name): ContentEntry => ({
    id: name, systems: ['sf2e'], kind: 'spell', source: 'official', name, level: 3, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }))
  const catalog = [...feats, ...spells, ...entries]
  const taken = (name: string, extra: Partial<Character['feats'][number]> = {}) => ({ name, type: 'Ancestry Feat', level: 1, ...extra })
  const pahtra: Character = { ...base, ancestry: 'Pahtra', level: 13, feats: [taken('Predatory', { choice: 'Jaws' }), taken('Climbing Claws'), taken('Pahtra Lore'),
    taken('Harmonic Shielding'), taken('Melodic Adaptation')] }
  const jaws = ownedWeapons(pahtra, catalog).find(weapon => weapon.id === 'sf2e:pahtra:jaws')!
  expect(weaponAttack(pahtra, catalog, jaws)).toMatchObject({ damage: expect.stringMatching(/d6.* piercing/), criticalSpecialization: true,
    traits: expect.arrayContaining(['Finesse', 'Grapple']) })
  expect(ownedWeapons(pahtra, catalog).some(weapon => weapon.id === 'sf2e:pahtra:claw')).toBe(false)
  expect(movementSpeeds(pahtra, catalog)).toContainEqual(expect.objectContaining({ name: 'Climb', feet: speed(pahtra, catalog) }))
  expect(automaticFeatGrants(pahtra, catalog)).toContainEqual(expect.objectContaining({ name: 'Additional Lore', choice: 'Pahtra' }))
  expect(senses(pahtra, catalog)).toEqual(expect.arrayContaining([{ value: 'Darkvision', source: 'Pahtra' }]))
  expect(senses(pahtra, catalog)).toEqual(expect.arrayContaining([{ value: 'Detect magic (30-foot emanation, rank 3)', source: 'Melodic Adaptation' }]))
  expect(resistances(pahtra, catalog)).toContainEqual({ damage: 'Sonic', value: 6, source: 'Harmonic Shielding' })
  expect(savingThrowBreakdown(pahtra, catalog, 'Will').notes?.join(' ')).toContain('a successful save against a sonic effect becomes a critical success')
  expect(eligibleFeats(catalog, pahtra, { key: 'ancestry:13:0', category: 'ancestry', level: 13 }).map(feat => feat.name))
    .not.toContain('Ancestral Darkvision')
  const casters: Character = { ...base, ancestry: 'Kasatha', level: 13,
    feats: [taken('Remix World\'s Rhythm'), taken('Adat Training'), taken('A Little Piece of Home')] }
  expect(grantedFeatSpells(casters, catalog).map(grant => [grant.entry.name, grant.rule.tradition, grant.rule.frequency]).sort()).toEqual([
    ['Haste', 'primal', 'once per day'], ['Holographic Memory', 'divine', 'once per day'], ['Slow', 'primal', 'once per day'],
    ['Verdant Code', 'arcane', 'once per hour'], ['Void Whispers', 'divine', 'once per day']])
})

it('provides Solarian attunement, solar weapons, twin weapons, flare, and Solar Shield', () => {
  const solarian: Character = { ...base, ancestry: 'Human', className: 'Solarian', level: 5,
    solarianAttunement: 'Photon',
    solarianWeapon: { damageType: 'Slashing', weaponGroup: 'Sword' },
    feats: [{ name: 'Twin Weapons', type: 'Class Feat', level: 1 },
      { name: 'Solar Shield', type: 'Class Feat', level: 1 }] }
  const weapons = ownedWeapons(solarian, [])
  expect(weapons.map(weapon => weapon.name)).toEqual(expect.arrayContaining(['Solar Weapon', 'Twin Solar Weapon', 'Solar Flare']))
  const weapon = weapons.find(item => item.name === 'Solar Weapon')!
  const weaponAttackResult = weaponAttack(solarian, [], weapon)
  expect(weaponAttackResult.damage).toBe('1d8 slashing')
  expect(weaponAttackResult.additionalDamage).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'Photon-Attuned', value: '3 fire' }),
  ]))
  const flare = weapons.find(item => item.name === 'Solar Flare')!
  expect(weaponAttack(solarian, [], flare)).toMatchObject({ damage: '1d6 fire', criticalNote: '1d6 persistent fire damage on a critical hit.' })
  expect(automaticFeatGrants(solarian, [])).toContainEqual({ name: 'Shield Block', source: 'Solar Shield', level: 1 })
  const shield = ownedShields(solarian).find(item => item.name === 'Solar Shield')!
  expect(shield).toMatchObject({ hardness: 3, hp: 15, equipped: true })
  expect(shieldAcBonus({ ...solarian, solarianShield: { ...solarian.solarianShield, raised: true } }, [])).toBe(1)
  expect(shieldRaisedChange({ ...solarian, solarianShield: { raised: false } }, true)).toMatchObject({
    solarianShield: expect.objectContaining({ raised: true }),
  })
  expect(ownedWeapons({ ...solarian, solarianAttunement: 'Unattuned' }, []).some(item => item.name === 'Solar Weapon')).toBe(false)

  const extended: Character = { ...solarian, level: 13, solarianAttunement: 'Photon',
    solarianShield: { raised: true },
    feats: [...solarian.feats, { name: 'Distant Flare', type: 'Class Feat', level: 2 },
      { name: 'Propulsive Shield', type: 'Class Feat', level: 8 }] }
  const extendedFlare = ownedWeapons(extended, []).find(item => item.name === 'Solar Flare')!
  expect(weaponAttack(extended, [], extendedFlare)).toMatchObject({
    range: 55,
  })
  expect(weaponAttack(extended, [], extendedFlare).additionalDamage).toContainEqual(expect.objectContaining({
    source: 'Propulsive Shield',
  }))
  expect(speed({ ...extended, feats: [...extended.feats, { name: 'Solar Wind', type: 'Class Feat', level: 8 }] }, [])).toBe(35)
  expect(movementSpeeds({ ...extended, feats: [...extended.feats, { name: 'Defy Gravity', type: 'Class Feat', level: 8 }],
    solarianAttunement: 'Graviton' }, [])).toContainEqual(expect.objectContaining({ name: 'Fly', feet: 25, source: 'Defy Gravity' }))
})

it('grants skill feats, senses and resistances from Pahtra and Kasatha feats', () => {
  const taken = (name: string, extra: Partial<Character['feats'][number]> = {}) => ({ name, type: 'Ancestry Feat', level: 1, ...extra })
  const c: Character = { ...base, ancestry: 'Kasatha', level: 13, feats: [taken('Land Feet First'), taken('Night Eyes'), taken('Well-Connected'),
    taken('Pulonis Softstep'), taken('Electromagnetic Whiskers'), taken('Vibration Whiskers'), taken('Perfectly Balanced'),
    taken('Ancestral Resistance', { choice: 'Fire' })] }
  expect(automaticFeatGrants(c, entries).map(grant => grant.name)).toEqual(expect.arrayContaining(['Cat Fall', 'Terrain Stalker', 'Streetwise', 'Feather Step']))
  expect(senses(c, entries).map(sense => sense.value)).toEqual(expect.arrayContaining(['Electromagnetic sense (imprecise) 15 feet', 'Motion sense (imprecise) 30 feet']))
  expect(resistances(c, entries)).toEqual(expect.arrayContaining([{ damage: 'Cold', value: 5, source: 'Perfectly Balanced' },
    { damage: 'Fire', value: 5, source: 'Perfectly Balanced' }]))
  const trained = { ...base, feats: [taken('Harmonic Sensitivity')], skillPicks: ['Performance'] }
  expect(automaticFeatGrants(trained, entries)).toContainEqual(expect.objectContaining({ name: 'Assurance', choice: 'Performance' }))
})
