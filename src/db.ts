import Dexie, { type EntityTable } from 'dexie'
import type { Character, ContentEntry } from './types'
import { DISARMING_RUNE, GRAPPLING_RUNE, PARRYING_RUNE, HAFT_STRIKER_WEAPON, HUNTERS_ARROWHEADS, KILLERS_BELT_MAJOR, homebrewCharacterOptions, homebrewCompanions, homebrewWeapons, removeColdIronTusks } from './supplemental'

export const db = new Dexie('2e-builder') as Dexie & {
  characters: EntityTable<Character, 'id'>
  content: EntityTable<ContentEntry, 'id'>
}

db.version(1).stores({
  characters: 'id, *systems, updatedAt',
  content: 'id, *systems, kind, source, updatedAt',
})

export const newId = () => crypto.randomUUID()

export async function ensureSupplementalContent() {
  await db.transaction('rw', db.content, db.characters, async () => {
    const tusks = await db.content.get('homebrew:cold-iron-tusks')
    if (tusks && !tusks.deleted) await removeEntry(tusks.id)
    for (const character of await db.characters.toArray()) {
      const updated = removeColdIronTusks(character)
      if (updated !== character) await db.characters.put({ ...updated, updatedAt: Date.now() })
    }
    if (!await db.content.get(HAFT_STRIKER_WEAPON.id)) await db.content.add(HAFT_STRIKER_WEAPON)
    const hardwood = await db.content.get('homebrew:hardwood-armor-ranger-druid')
    if (hardwood?.source === 'homebrew' && !hardwood.deleted) await removeEntry(hardwood.id)
    const claymore = await db.content.get('homebrew:claymore')
    if (claymore?.source === 'homebrew' && !claymore.deleted && !claymore.data.retired) {
      await db.content.put({ ...claymore, data: { ...claymore.data, retired: true }, updatedAt: Date.now() })
    }
    const bases = await db.content.where('kind').anyOf('companion', 'weapon', 'feat').toArray()
    const groups = await db.content.where('kind').anyOf('weaponGroup', 'armorGroup').toArray()
    const customGear = await db.content.where('source').equals('homebrew').filter(entry =>
      (entry.kind === 'weapon' || entry.kind === 'armor') && typeof entry.data.group === 'string').toArray()
    for (const gear of customGear) {
      const field = gear.kind === 'weapon' ? 'weapon_group' : 'armor_group'
      const group = groups.find(candidate => candidate.id === gear.data.group && candidate.kind === `${gear.kind}Group`)
      if (group && !gear.data[field]) await db.content.put({ ...gear, data: { ...gear.data, [field]: group.name }, updatedAt: Date.now() })
    }
    for (const entry of [DISARMING_RUNE, GRAPPLING_RUNE, PARRYING_RUNE, KILLERS_BELT_MAJOR, ...HUNTERS_ARROWHEADS, ...homebrewCompanions(bases), ...homebrewWeapons(bases), ...homebrewCharacterOptions(bases)]) {
      const existing = await db.content.get(entry.id)
      if (!existing) await db.content.add(entry)
      else if (['homebrew:clawed-gauntlet', 'homebrew:broad-bladed-spear', 'homebrew:seax', DISARMING_RUNE.id, GRAPPLING_RUNE.id, PARRYING_RUNE.id, KILLERS_BELT_MAJOR.id,
        'homebrew:living-weapon-joust', 'homebrew:favored-weapon-jousting', 'homebrew:direwolf-bonded', 'homebrew:rider',
        'homebrew:sarkorian-direwolf', 'homebrew:snow-leopard', 'homebrew:ranger-twinned-defense-stance'].includes(entry.id)
        && existing.updatedAt === 1 && !existing.deleted) await db.content.put(entry)
    }
  })
}

export async function saveEntry(e: ContentEntry) {
  await db.content.put({ ...e, updatedAt: Date.now() })
}

export async function removeEntry(id: string) {
  const e = await db.content.get(id)
  if (e) await db.content.put({ ...e, deleted: true, updatedAt: Date.now() })
}

export async function exportHomebrew(): Promise<string> {
  const all = await db.content.where('source').equals('homebrew').toArray()
  return JSON.stringify(all.filter((e) => !e.deleted && !e.data.retired), null, 2)
}

export async function importHomebrew(json: string) {
  const entries = JSON.parse(json) as ContentEntry[]
  await db.content.bulkPut(
    entries.map((e) => ({ ...e, effects: e.effects ?? [], source: 'homebrew' as const, id: e.id || newId(), updatedAt: Date.now() })),
  )
}
