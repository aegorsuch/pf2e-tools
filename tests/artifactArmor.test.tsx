import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { mapAonHit } from '../src/aon'
import type { Hit } from '../src/aonQuery'
import { armorEntry, effectiveArmor, gearPickerEntries, shieldEntry, shieldStats } from '../src/builder'
import { namedArmorAbilities } from '../src/namedArmor'
import type { Character, OwnedArmor, OwnedShield } from '../src/types'

const snapshot = join('public', 'data', 'aon-pf2e.json')
it.skipIf(!existsSync(snapshot))('parses actual canonical armor, shield, and mask sources from the local AoN snapshot', () => {
  const hits = JSON.parse(readFileSync(snapshot, 'utf8')) as Hit[]
  const wanted = new Set(['armor-41', 'armor-43', 'armor-44', 'equipment-2801', 'equipment-2789', 'equipment-2789-2579',
    'equipment-1528', 'equipment-3700', 'equipment-3753', 'equipment-2365', 'equipment-1530'])
  const catalog = hits.filter(hit => wanted.has(hit._id!)).map(hit => mapAonHit(hit, 'pf2e')!).filter(Boolean)
  const character: Character = {
    id: 'armor-source-test', systems: ['pf2e'], name: 'Armor source test', level: 20,
    abilities: { str: 14, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const owned = (name: string): OwnedArmor => ({ id: name, name, potency: 0, resilient: 0, runes: [], worn: true })
  const shield: OwnedShield = { id: 'scale', name: 'Scale of Igroon', hardness: 0, hp: 0, raised: false, damage: 8 }
  const artifact = "Slithermaw's Bane (Artifact)"
  expect(catalog).toHaveLength(wanted.size)
  expect(gearPickerEntries(catalog, 'armor').filter(entry => entry.data.named_armor)).toHaveLength(4)
  expect(effectiveArmor(character, catalog, owned('Ancestral Embrace'))).toMatchObject({ potency: 4, resilient: 3 })
  expect(effectiveArmor(character, catalog, owned(artifact))).toMatchObject({ potency: 3, resilient: 3, runes: ['Fortification (Greater)'] })
  expect(armorEntry(character, catalog, artifact)?.data).toMatchObject({ strength: 2, check_penalty: 0, bulk: 1.1 })
  expect(namedArmorAbilities(armorEntry(character, catalog, artifact)).map(ability => ability.name))
    .toEqual(['Senses', 'Summary', 'Adaptation', 'Calistria’s Sting', 'Purge Toxins'])
  expect(namedArmorAbilities(shieldEntry(catalog, shield.name))).toHaveLength(5)
  expect(namedArmorAbilities(catalog.find(entry => entry.name === 'Shadowed Scale, the Jungle Secret'))).toHaveLength(4)
  expect(shieldStats(shield, character, catalog)).toMatchObject({ hardness: 20, hp: 160 })
})
