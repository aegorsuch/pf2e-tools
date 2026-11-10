import { newId } from './db'
import type { Character } from './types'

type Json = Record<string, unknown>
const ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : Number.isFinite(+(v as string)) && v !== '' && v != null ? +(v as string) : d)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

// Accepts the JSON from Pathbuilder 2e (Menu > Export JSON), with or without the { success, build } wrapper.
export function parsePathbuilder(json: string): Character {
  const parsed = JSON.parse(json) as Json
  const build = (parsed.build ?? parsed) as Json
  if (!build || typeof build !== 'object' || !('name' in build) || !('abilities' in build)) {
    throw new Error('Not a Pathbuilder 2e character export')
  }
  const ab = (build.abilities ?? {}) as Json
  const abilities = Object.fromEntries(ABILS.map((a) => [a, num(ab[a], 10)])) as Character['abilities']

  // Pathbuilder feats: [name, choice|null, type, level, ...]
  const feats = arr(build.feats).flatMap((f) => {
    const row = arr(f)
    const name = str(row[0])
    return name ? [{ name, choice: str(row[1]), type: str(row[2]) ?? 'Feat', level: num(row[3], 1) }] : []
  })
  const equipment = arr(build.equipment).flatMap((e) => {
    const row = arr(e)
    const name = str(row[0])
    return name ? [{ name, qty: num(row[1], 1) }] : []
  })
  const extraGear = [...arr(build.weapons), ...arr(build.armor)].flatMap((g) => {
    const o = g as Json
    const name = str(o?.display) ?? str(o?.name)
    return name ? [{ name, qty: num(o.qty, 1) }] : []
  })
  const lores = arr(build.lores).flatMap((l) => {
    const row = arr(l)
    const name = str(row[0])
    return name ? [{ name, rank: num(row[1]) }] : []
  })

  const unmapped = ['proficiencies', 'spellCasters', 'formula', 'pets', 'acTotal', 'attributes', 'specials', 'mods']
    .filter((k) => build[k] != null && (!Array.isArray(build[k]) || (build[k] as unknown[]).length > 0))

  return {
    id: newId(),
    systems: ['pf2e'],
    name: str(build.name) ?? 'Imported character',
    level: num(build.level, 1),
    ancestry: str(build.ancestry),
    className: str(build.class),
    heritage: str(build.heritage),
    background: str(build.background),
    deity: str(build.deity),
    abilities,
    feats,
    equipment: [...equipment, ...extraGear],
    lores,
    languages: arr(build.languages).filter((l): l is string => typeof l === 'string'),
    entryIds: [],
    extraSlots: [],
    imported: { source: 'pathbuilder', raw: parsed, unmapped },
    updatedAt: Date.now(),
  }
}
