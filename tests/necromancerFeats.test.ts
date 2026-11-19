import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { mapAonHits } from '../src/aon'
import type { Hit } from '../src/aonQuery'
import { eligibleFeats, featChoiceOptions } from '../src/builder'
import { FeatSlots } from '../src/FeatSlots'
import type { Character } from '../src/types'

const snapshot = join('public', 'data', 'aon-pf2e.json')

it.skipIf(!existsSync(snapshot))('offers imported level-two Necromancer feats when their prerequisites are met', () => {
  const hits = JSON.parse(readFileSync(snapshot, 'utf8')) as Hit[]
  const entries = mapAonHits(hits, 'pf2e')
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
  for (const level of [2, 20]) {
    const markup = renderToStaticMarkup(createElement(FeatSlots, {
      c: { ...character, level }, entries, categories: ['class'], save: () => {},
      search: { 'class:2:0:open': '1' }, onSearch: () => {},
    }))
    for (const name of ['Deathly Scream', 'Muscle Barrier', 'Song of the Soul']) {
      expect(markup).toContain(`L02 Class: ${name}`)
    }
  }
})
