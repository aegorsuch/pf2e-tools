import { afterEach, expect, it, vi } from 'vitest'
import { AON_IMPORT_VERSION, importFromAon, mapAonHits } from './aon'
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

it('adds identical class copies of Deimatic Display and Ears of the Forest', () => {
  const entries = mapAonHits([{
    _id: 'feat-deimatic-display',
    _source: {
      name: 'Deimatic Display', category: 'feat', level: 8, trait: ['Druid', 'Visual'],
      prerequisite: 'Trained in Intimidation', actions: '1', markdown: 'Deimatic Display rules.',
    },
  }, {
    _id: 'feat-ears-of-the-forest',
    _source: {
      name: 'Ears of the Forest', category: 'feat', level: 8, trait: ['Bard', 'Auditory'],
      prerequisite: 'Zoophonia Muse', markdown: 'Ears of the Forest rules.',
    },
  }], 'pf2e')
  const find = (name: string) => entries.find(entry => entry.name === name)!
  const deimatic = find('Deimatic Display')
  const rangerDeimatic = find('Deimatic Display (Ranger)')
  const ears = find('Ears of the Forest')

  expect(rangerDeimatic).toMatchObject({
    id: 'aon:pf2e:feat-deimatic-display:ranger',
    level: deimatic.level,
    traits: ['Visual', 'Ranger'],
    description: deimatic.description,
    data: deimatic.data,
  })
  for (const targetClass of ['Druid', 'Ranger']) {
    expect(find(`Ears of the Forest (${targetClass})`)).toMatchObject({
      id: `aon:pf2e:feat-ears-of-the-forest:${targetClass.toLowerCase()}`,
      level: ears.level,
      traits: ['Auditory', targetClass],
      description: ears.description,
      data: ears.data,
    })
  }
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
