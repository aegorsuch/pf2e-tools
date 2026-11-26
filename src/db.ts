import Dexie, { type EntityTable } from 'dexie'
import type { Character, ContentEntry } from './types'
import { normalizeAcolyte } from './backgrounds'

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
  const [supplemental, { sfSpecificWeapons }] = await Promise.all([
    import('./supplemental'),
    import('./sfSpecificWeapons'),
  ])
  const {
    DISARMING_RUNE, GRAPPLING_MODULE, GRAPPLING_RUNE, PARRYING_RUNE, THROWING_RUNE,
    SHOVING_MODULE, SHOVING_RUNE, HAFT_STRIKER_WEAPON, HUNTERS_ARROWHEADS, KILLERS_BELT_MAJOR,
    PLASMA_ARRAY, SUPERIOR_DATAJACK, homebrewCharacterOptions, homebrewCompanions, homebrewWeapons, migrateCopiedFeats, migrateMobileHunt,
    removeColdIronTusks,
  } = supplemental
  await db.transaction('rw', db.content, db.characters, async () => {
    const tusks = await db.content.get('homebrew:cold-iron-tusks')
    if (tusks && !tusks.deleted) await removeEntry(tusks.id)
    const mobileHunter = await db.content.get('homebrew:mobile-hunter')
    for (const character of await db.characters.toArray()) {
      const migrated = migrateCopiedFeats(normalizeAcolyte(removeColdIronTusks(character)))
      const updated = !mobileHunter || mobileHunter.updatedAt === 1 && !mobileHunter.deleted ? migrateMobileHunt(migrated) : migrated
      if (updated !== character) await db.characters.put({ ...updated, updatedAt: Date.now() })
    }
    if (!await db.content.get(HAFT_STRIKER_WEAPON.id)) await db.content.add(HAFT_STRIKER_WEAPON)
    const hardwood = await db.content.get('homebrew:hardwood-armor-ranger-druid')
    if (hardwood?.source === 'homebrew' && !hardwood.deleted) await removeEntry(hardwood.id)
    for (const id of ['homebrew:claymore', 'homebrew:broad-bladed-spear']) {
      const entry = await db.content.get(id)
      if (entry?.source === 'homebrew' && !entry.deleted && !entry.data.retired) {
        await db.content.put({ ...entry, data: { ...entry.data, retired: true }, updatedAt: Date.now() })
      }
    }
    const bases = await db.content.where('kind').anyOf('companion', 'weapon', 'feat').toArray()
    bases.push(...await db.content.where('kind').equals('spell').filter(entry =>
      ['Ignition', 'Tailwind'].includes(entry.name)).toArray())
    const slarp = await db.content.get('aon:sf2e:treasure--235-slarp')
    if (slarp) bases.push(slarp)
    const groups = await db.content.where('kind').anyOf('weaponGroup', 'armorGroup').toArray()
    const specificWeapons = sfSpecificWeapons(bases)
    const customGear = await db.content.where('source').equals('homebrew').filter(entry =>
      (entry.kind === 'weapon' || entry.kind === 'armor') && typeof entry.data.group === 'string').toArray()
    for (const gear of customGear) {
      const field = gear.kind === 'weapon' ? 'weapon_group' : 'armor_group'
      const group = groups.find(candidate => candidate.id === gear.data.group && candidate.kind === `${gear.kind}Group`)
      if (group && !gear.data[field]) await db.content.put({ ...gear, data: { ...gear.data, [field]: group.name }, updatedAt: Date.now() })
    }
    for (const entry of [DISARMING_RUNE, GRAPPLING_RUNE, PARRYING_RUNE, THROWING_RUNE, SHOVING_RUNE, GRAPPLING_MODULE, SHOVING_MODULE, KILLERS_BELT_MAJOR, PLASMA_ARRAY, SUPERIOR_DATAJACK, ...HUNTERS_ARROWHEADS, ...homebrewCompanions(bases), ...homebrewWeapons([...bases, ...specificWeapons]), ...specificWeapons, ...homebrewCharacterOptions(bases)]) {
      const existing = await db.content.get(entry.id)
      if (!existing) await db.content.add(entry)
      else if ((entry.id.startsWith('supplemental:sf2e:') || ['homebrew:clawed-gauntlet', 'homebrew:seax', DISARMING_RUNE.id, GRAPPLING_RUNE.id, PARRYING_RUNE.id, THROWING_RUNE.id, SHOVING_RUNE.id, KILLERS_BELT_MAJOR.id,
        'homebrew:living-weapon-joust', 'homebrew:favored-weapon-jousting', 'homebrew:favored-weapon-symbol',
        'homebrew:favored-weapon-symbol-vindicator', 'homebrew:favored-weapon-symbol-avenger',
        'homebrew:favored-weapon-jousting-vindicator', 'homebrew:favored-weapon-jousting-avenger',
        'homebrew:tethered-favored-weapon-vindicator', 'homebrew:tethered-favored-weapon-avenger',
        'homebrew:tethered-favored-weapon', 'homebrew:direwolf-bonded', 'homebrew:rider',
        'homebrew:sarkorian-direwolf', 'homebrew:snow-leopard', 'homebrew:ranger-twinned-defense-stance',
        'homebrew:avenger-twin-parry', 'homebrew:avenger-twinned-defense-stance',
        'homebrew:ignition-divine', 'homebrew:tailwind-divine',
        'homebrew:persistent-magic-hide', 'homebrew:mobile-hunter', 'homebrew:divine-warrior', 'homebrew:primal-warrior', 'homebrew:instinctive-support',
        'homebrew:ears-of-the-forest-druid', 'homebrew:ears-of-the-forest-ranger', 'homebrew:opening-stance-ranger',
        'homebrew:versatile-envoy', 'homebrew:versatile-operative', PLASMA_ARRAY.id, SUPERIOR_DATAJACK.id].includes(entry.id)
        || entry.id.startsWith('homebrew:laser-focus-rifle') || entry.id.startsWith('homebrew:liminal-focus-rifle'))
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
