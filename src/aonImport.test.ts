import { afterEach, expect, it, vi } from 'vitest'
import { AON_IMPORT_VERSION, importFromAon, mapAonHits } from './aon'
import { eligibleFeats } from './builder'
import { groupHomebrew } from './HomebrewList'
import { homebrewCharacterOptions, migrateCopiedFeats } from './supplemental'
import type { Character } from './types'
import sf2eSnapshot from '../public/data/aon-sf2e.json?raw'

const stored = vi.hoisted(() => ({ bulkPut: vi.fn() }))
vi.mock('./db', () => ({
  db: { content: {
    where: () => ({ startsWith: () => ({ filter: () => ({ toArray: async () => [] }) }) }),
    bulkPut: stored.bulkPut,
  } },
  ensureSupplementalContent: async () => {},
}))
afterEach(() => vi.unstubAllGlobals())

it('imports actual SF2e armor grade AC, upgrade slots, and resilient bonuses from improvement tables', () => {
  const hits: Parameters<typeof mapAonHits>[0] = JSON.parse(sf2eSnapshot)
  const entries = mapAonHits(hits.filter(hit => ['Armored Coat', 'Tactical Armored Coat',
    'Advanced Carvesong', 'Elite Carvesong'].includes(String(hit._source?.name))), 'sf2e')
  expect(entries.find(entry => entry.name === 'Armored Coat')?.data)
    .toMatchObject({ ac: 2, armor_grade: 'Commercial', upgrade_slots: 1, grade_save_bonus: 0 })
  expect(entries.find(entry => entry.name === 'Tactical Armored Coat')?.data)
    .toMatchObject({ ac: 3, armor_grade: 'Tactical', upgrade_slots: 2, grade_save_bonus: 0 })
  expect(entries.find(entry => entry.name === 'Advanced Carvesong')?.data)
    .toMatchObject({ ac: 3, armor_grade: 'Advanced', upgrade_slots: 1, grade_save_bonus: 1 })
  expect(entries.find(entry => entry.name === 'Elite Carvesong')?.data)
    .toMatchObject({ ac: 4, armor_grade: 'Elite', upgrade_slots: 2, grade_save_bonus: 2 })
})

it('imports fresh versioned snapshots rather than marking stale runtime-cached summaries as current', async () => {
  const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'https://example.com')
    return new Response(JSON.stringify([{ _id: 'human', _source: {
      name: 'Human', category: 'ancestry', summary: 'Old summary.',
      ...(url.searchParams.get('v') === AON_IMPORT_VERSION ? { about: 'Complete new introduction.' } : {}),
    } }]), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchFn)
  expect(await importFromAon('pf2e')).toBe(1)
  expect(fetchFn).toHaveBeenCalledTimes(1)
  expect(new URL(String(fetchFn.mock.calls[0][0]), 'https://example.com').searchParams.get('v')).toBe(AON_IMPORT_VERSION)
  expect(stored.bulkPut).toHaveBeenCalledWith([expect.objectContaining({ description: 'Complete new introduction.' })])
})

it('imports feat-granted natural weapons with damage, traits, range, and feat source', () => {
  const entries = mapAonHits([{
      _id: 'pf2e-feat-hard-tail',
      _source: {
        name: 'Hard Tail', category: 'feat', trait: ['Ganzi'], level: 1,
        markdown: 'You gain a tail unarmed attack that deals 1d6 bludgeoning damage and has the agile, finesse, and unarmed traits.',
      },
    }, {
      _id: 'pf2e-feat-scalding-spit',
      _source: {
        name: 'Scalding Spit', category: 'feat', trait: ['Dragonblood'], level: 5,
        markdown: 'You gain a boiling spit ranged unarmed attack with a range increment of 30 feet that deals 1d6 fire damage.',
      },
    }], 'pf2e')
  const tail = entries.find(entry => entry.name === 'Tail')!
  expect(tail.data).toMatchObject({
    weapon_category: 'Unarmed', weapon_type: 'Melee', damage: '1d6 bludgeoning',
    granted_by_feat: 'Hard Tail', granted_by_feat_choice: 'tail',
  })
  expect(tail.traits).toEqual(expect.arrayContaining(['Agile', 'Finesse', 'Unarmed']))
  const spit = entries.find(entry => entry.name === 'Boiling Spit')!
  expect(spit.data).toMatchObject({
    weapon_type: 'Ranged', damage: '1d6 fire', range: 30,
    granted_by_feat: 'Scalding Spit',
  })
})

it('lists copied class feats as homebrew without changing official feats', () => {
  const entries = mapAonHits([{
    _id: 'feat-4733',
    _source: {
      name: 'Deimatic Display', category: 'feat', level: 8, trait: ['Druid', 'Visual'],
      prerequisite: 'Trained in Intimidation', actions: '1', markdown: 'Deimatic Display rules.',
    },
  }, {
    _id: 'feat-5418',
    _source: {
      name: 'Ears of the Forest', category: 'feat', level: 8, trait: ['Bard', 'Auditory'],
      prerequisite: 'Zoophonia Muse', markdown: '**Prerequisites**\n[zoophonia muse](/Muses.aspx?ID=9)\n\nEars of the Forest rules.',
    },
  }, { _id: 'feat-4602', _source: {
    name: 'Steady Spellcasting', category: 'feat', level: 6, trait: ['Bard', 'Druid', 'Wizard'],
    archetype: ['Hellknight'], markdown: 'If a reaction would disrupt your spellcasting action, attempt a DC 15 flat check.',
  } }], 'pf2e')
  const copies = homebrewCharacterOptions(entries).filter(entry => [
    'homebrew:deimatic-display-ranger', 'homebrew:ears-of-the-forest-druid',
    'homebrew:ears-of-the-forest-ranger', 'homebrew:steady-spellcasting-ranger-champion',
  ].includes(entry.id))
  expect(copies).toHaveLength(4)
  expect(entries[0].traits).toEqual(['Druid', 'Visual'])
  expect(entries[2].traits).toEqual(['Bard', 'Druid', 'Wizard'])
  expect(copies[0]).toMatchObject({ name: 'Deimatic Display (Ranger)', source: 'homebrew', level: 8,
    description: entries[0].description, traits: ['Visual', 'Ranger'], data: { prerequisite: 'Trained in Intimidation', class: 'Ranger' } })
  expect(entries[1].data.prerequisite).toBe('Zoophonia Muse')
  expect(entries[1].description).toContain('Prerequisites zoophonia muse')
  expect(copies[1]).toMatchObject({ name: 'Ears of the Forest (Druid)', description: 'Ears of the Forest rules.',
    traits: ['Auditory', 'Druid'], data: { class: 'Druid' } })
  expect(copies[2]).toMatchObject({ name: 'Ears of the Forest (Ranger)', description: 'Ears of the Forest rules.',
    traits: ['Auditory', 'Ranger'], data: { class: 'Ranger' } })
  expect(copies[1].data.prerequisite).toBeUndefined()
  expect(copies[2].data.prerequisite).toBeUndefined()
  const steady = copies[3]
  expect(steady).toMatchObject({ name: 'Steady Spellcasting', level: 6, traits: ['Ranger', 'Champion'],
    description: entries[2].description, data: { class: 'Ranger, Champion' } })
  expect(steady.data.archetype).toBeUndefined()
  const groups = groupHomebrew(copies)
  expect(groups.find(group => group.name === 'Ranger Feats')?.entries.map(entry => entry.name))
    .toEqual(expect.arrayContaining(['Deimatic Display (Ranger)', 'Ears of the Forest (Ranger)', 'Steady Spellcasting']))
  expect(groups.find(group => group.name === 'Druid Feats')?.entries.map(entry => entry.name)).toContain('Ears of the Forest (Druid)')
  expect(groups.find(group => group.name === 'Champion Feats')?.entries.map(entry => entry.name)).toContain('Steady Spellcasting')
  const base: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 6,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  for (const className of ['Ranger', 'Champion', 'Druid']) {
    const expected = className === 'Druid' ? entries[2] : steady
    expect(eligibleFeats([...entries, ...copies], { ...base, className }, { key: 'class:6:0', category: 'class', level: 6 })).toContain(expected)
    expect(eligibleFeats([steady], { ...base, className }, { key: 'class:4:0', category: 'class', level: 4 })).not.toContain(steady)
  }
  expect(eligibleFeats([steady], { ...base, className: 'Fighter' },
    { key: 'class:6:0', category: 'class', level: 6 })).not.toContain(steady)
  for (const [index, className] of [[1, 'Druid'], [2, 'Ranger']] as const) {
    expect(eligibleFeats([...entries, ...copies], { ...base, level: 8, className },
      { key: 'class:8:0', category: 'class', level: 8 })).toContain(copies[index])
  }
})

it('copies Instinctive Support to Ranger, Champion, and Bard without changing the Druid original', () => {
  const [original, companion, faithfulSteed] = mapAonHits([{
    _id: 'feat-4731', _source: { name: 'Instinctive Support', category: 'feat', level: 6, trait: ['Druid'],
      prerequisite: 'Animal Companion', actions: 'Free Action',
      markdown: 'Trigger: Cast a non-cantrip spell targeting only your animal companion. The companion gains its actions; one must be Support.' },
  }, {
    _id: 'companion-feat', _source: { name: 'Animal Companion', category: 'feat', level: 1,
      trait: ['Druid', 'Ranger', 'Champion', 'Bard'], markdown: 'You gain an animal companion.' },
  }, {
    _id: 'faithful-steed', _source: { name: 'Faithful Steed', category: 'feat', level: 2,
      trait: ['Champion'], markdown: 'You gain an animal companion.' },
  }], 'pf2e')
  const copy = homebrewCharacterOptions([original, companion]).find(entry => entry.id === 'homebrew:instinctive-support')!
  expect(copy).toMatchObject({ name: original.name, level: 6, source: 'homebrew', description: original.description,
    traits: ['Ranger', 'Champion', 'Bard'], data: { class: 'Ranger, Champion, Bard', prerequisite: 'Animal Companion or Faithful Steed' } })
  expect(copy.data.actions).toBe(original.data.actions)
  expect(original.traits).toEqual(['Druid'])
  const groups = groupHomebrew([original, companion, copy])
  const slot = { key: 'class:6:0', category: 'class' as const, level: 6 }
  const base: Character = { id: 'c', systems: ['pf2e'], name: 'Test', level: 6,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: 'Animal Companion', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  for (const className of ['Ranger', 'Champion', 'Bard']) {
    expect(groups.find(group => group.name === `${className} Feats`)?.entries).toContain(copy)
    expect(eligibleFeats([original, companion, faithfulSteed, copy], { ...base, className }, slot)).toContain(copy)
    expect(eligibleFeats([original, companion, faithfulSteed, copy], { ...base, className, feats: [] }, slot)).not.toContain(copy)
  }
  expect(eligibleFeats([original, companion, copy], { ...base, className: 'Druid' }, slot)).toContain(original)
  expect(eligibleFeats([original, companion, faithfulSteed, copy], { ...base, className: 'Champion',
    feats: [{ name: 'Faithful Steed', type: 'Class Feat', level: 2, slot: 'class:2:0' }] }, slot)).toContain(copy)
  expect(eligibleFeats([original, companion, copy], { ...base, className: 'Fighter' }, slot)).not.toContain(copy)
})

it('preserves existing copied feat selections when moving them to homebrew', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Test', level: 8, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [
      { name: 'Deimatic Display (Ranger)', type: 'Class Feat', level: 8, sourceId: 'aon:pf2e:feat-4733:ranger' },
      { name: 'Ears of the Forest (Ranger)', type: 'Class Feat', level: 8, sourceId: 'aon:pf2e:feat-5418:ranger' },
      { name: 'Steady Spellcasting', type: 'Class Feat', level: 6, slot: 'class:6:0', sourceId: 'aon:pf2e:feat-4602' },
    ],
    equipment: [], lores: [], languages: [], entryIds: ['aon:pf2e:feat-4733:ranger', 'aon:pf2e:feat-4602'], extraSlots: [], updatedAt: 0,
  }
  const migrated = migrateCopiedFeats(c)
  expect(migrated.feats.map(feat => feat.sourceId)).toEqual([
    'homebrew:deimatic-display-ranger', 'homebrew:ears-of-the-forest-ranger', 'homebrew:steady-spellcasting-ranger-champion',
  ])
  expect(migrated.entryIds).toEqual(['homebrew:deimatic-display-ranger', 'homebrew:steady-spellcasting-ranger-champion'])
  expect(migrateCopiedFeats(migrated)).toBe(migrated)
  const druid = { ...c, className: 'Druid', feats: [c.feats[2]], entryIds: ['aon:pf2e:feat-4602'] }
  expect(migrateCopiedFeats(druid)).toBe(druid)
})

it('imports a Witch patron’s mandatory familiar ability separately from patron text', () => {
  const [patron] = mapAonHits([{
    _id: 'patron-wilding-steward',
    _source: {
      name: 'Wilding Steward', category: 'patron', level: 1,
      markdown: '<column>\n**Familiar of Keen Senses** Your familiar gains your choice of scent or tremorsense.\n</column>',
    },
  }], 'pf2e')

  expect(patron).toMatchObject({
    kind: 'subclass',
    data: {
      class: 'Witch',
      grants_familiar_ability: 'Familiar of Keen Senses',
      familiar_ability_description: 'Your familiar gains your choice of scent or tremorsense.',
    },
  })
})
