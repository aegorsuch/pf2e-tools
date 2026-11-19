import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { mapAonHit } from '../src/aon'
import type { Hit } from '../src/aonQuery'
import { eligibleFeats, featChoiceOptions } from '../src/builder'
import type { Character } from '../src/types'

const snapshot = join('public', 'data', 'aon-pf2e.json')

it.skipIf(!existsSync(snapshot))('offers imported level-two Necromancer feats when their prerequisites are met', () => {
  const hits = JSON.parse(readFileSync(snapshot, 'utf8')) as Hit[]
  const ids = ['feat-4997', 'feat-9098', 'feat-9099', 'feat-9100', 'feat-9101', 'feat-9102',
    'feat-9103', 'feat-9104', 'feat-9105', 'feat-9095', 'class-feature-1289']
  const entries = hits.filter(hit => ids.includes(hit._id ?? '')).map(hit => mapAonHit(hit, 'pf2e')!)
  const character: Character = {
    id: 'necro-test', name: 'Necromancer', className: 'Necromancer', systems: ['pf2e'], level: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    feats: [{ name: 'Undead Familiar', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const choices = eligibleFeats(entries, character, { key: 'class:2:0', category: 'class', level: 2 }).map(entry => entry.name)
  expect(choices).toEqual(expect.arrayContaining(['Conceal Spell', 'Bone Speaker', 'Deathly Scream', 'Draining Strike',
    'Enhanced Undead Familiar', 'Invert Harm', 'Muscle Barrier', 'Song of the Soul', 'Undead Creator']))
  for (const choice of choices) {
    expect(featChoiceOptions(choice, character, entries, 'class:2:0', undefined, 'class')).not.toEqual([])
  }
})
