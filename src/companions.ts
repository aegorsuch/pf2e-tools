import { byName, proficiencyBonus, signed, type Ability } from './builder'
import type { Character, ContentEntry } from './types'

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']
export const MAX_SPECIALIZATIONS = 3

type Mods = Partial<Record<Ability, number>>
interface Spec {
  mods: Mods
  // Skills raised to expert (or master when already expert) or set to a fixed rank
  bump?: string[]
  set?: Record<string, number>
  speed?: number
}

// Effects of each specialization, from Player Core, Legends and Secrets of Magic
export const COMPANION_SPECS: Record<string, Spec> = {
  Ambusher: { mods: { dex: 1 }, bump: ['Stealth'], set: { Unarmored: 2 } },
  Bully: { mods: { str: 1, cha: 3 }, bump: ['Athletics', 'Intimidation'] },
  Daredevil: { mods: { dex: 1 }, set: { Acrobatics: 3, Unarmored: 2 } },
  'Deep Diver': { mods: { con: 1 }, set: { Athletics: 3 } },
  Racer: { mods: { con: 1 }, set: { Fortitude: 4 }, speed: 10 },
  Shade: { mods: {}, set: { Unarmored: 2 } },
  'Steadfast Strider': { mods: { str: 1 }, set: {} },
  Tracker: { mods: { wis: 1 }, bump: ['Survival'] },
  'Wildfire Scorcher': { mods: { dex: 1 }, set: { Reflex: 4, Unarmored: 2 } },
  'Wind Chaser': { mods: { dex: 1 }, set: { Acrobatics: 3, Reflex: 4, Unarmored: 2 }, speed: 20 },
  Wrecker: { mods: { str: 1 }, set: { Athletics: 3 } },
}

export const ADVANCED_TYPES = ['Nimble', 'Savage'] as const

const SKILL_ABILITY: Record<string, Ability> = { Acrobatics: 'dex', Athletics: 'str', Intimidation: 'cha', Stealth: 'dex', Survival: 'wis' }

// Advancement the character's feats give the companion: Mature, Nimble/Savage and up to three specializations
export function companionAdvancement(c: Character) {
  const has = (prefix: string) => c.feats.filter((f) => f.name.startsWith(prefix))
  const advanced = has('Incredible Companion').map((f) => f.choice).find((v): v is string => v === 'Nimble' || v === 'Savage')
  const specializations = [...new Set(has('Specialized Companion').flatMap((f) => (f.choice ? [f.choice] : [])))].slice(0, MAX_SPECIALIZATIONS)
  return { mature: has('Mature Animal Companion').length > 0 || !!advanced, advanced, specializations }
}

export function specializationOptions(c: Character, entries: ContentEntry[], exceptIndex: number) {
  const used = new Set(c.feats.flatMap((f, i) => f.name.startsWith('Specialized Companion') && i !== exceptIndex && f.choice ? [f.choice] : []))
  const names = new Set([...Object.keys(COMPANION_SPECS), ...entries.filter((e) => e.kind === 'companionSpec').map((e) => e.name)])
  return [...names].filter((n) => !used.has(n)).sort((a, b) => a.localeCompare(b))
}

const bumpRank = (rank: number) => (rank >= 2 ? 3 : 2)
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

function growSize(size: string) {
  const i = SIZES.indexOf(size)
  return i >= 0 && i <= 2 ? SIZES[i + 1] : size
}

export function companionStats(c: Character, entries: ContentEntry[], type: string, advancement = { mature: false, advanced: undefined as string | undefined, specializations: [] as string[] }) {
  const entry = byName(entries, 'companion', type)
  if (!entry) return undefined
  const { mature, advanced, specializations } = advancement
  const d = entry.data
  const mods: Record<Ability, number> = { str: num(d.strength), dex: num(d.dexterity), con: num(d.constitution), int: num(d.intelligence), wis: num(d.wisdom), cha: num(d.charisma) }
  const add = (m: Mods) => { for (const [k, v] of Object.entries(m)) mods[k as Ability] += v }
  if (mature) add({ str: 1, dex: 1, con: 1, wis: 1 })
  if (advanced === 'Nimble') add({ dex: 2, str: 1, con: 1, wis: 1 })
  if (advanced === 'Savage') add({ str: 2, dex: 1, con: 1, wis: 1 })
  const specs = specializations.flatMap((s) => (COMPANION_SPECS[s] ? [COMPANION_SPECS[s]] : []))
  for (const s of specs) add(s.mods)

  const typeSkills = String(d.skill ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const rank: Record<string, number> = { Acrobatics: 1, Athletics: 1, Unarmored: 1, Perception: mature ? 2 : 1, Fortitude: mature ? 2 : 1, Reflex: mature ? 2 : 1, Will: mature ? 2 : 1 }
  for (const s of typeSkills) rank[s] = 1
  if (mature) for (const s of ['Intimidation', 'Stealth', 'Survival']) rank[s] = rank[s] ? 2 : 1
  if (advanced === 'Nimble') rank.Acrobatics = Math.max(rank.Acrobatics, 2)
  if (advanced === 'Savage') rank.Athletics = Math.max(rank.Athletics, 2)
  for (const s of specs) {
    for (const k of s.bump ?? []) rank[k] = bumpRank(rank[k] ?? 0)
    for (const [k, v] of Object.entries(s.set ?? {})) rank[k] = Math.max(rank[k] ?? 0, v)
  }

  const level = c.level
  const prof = (k: string) => proficiencyBonus(rank[k] ?? 0, level)
  const total = (k: string, ability: Ability) => mods[ability] + prof(k)
  const hp = num(d.hp) + (6 + mods.con) * level
  const baseSize = String(d.size ?? '').split(',')[0].trim()
  const size = mature && baseSize ? growSize(baseSize) : baseSize
  const flat = (advanced === 'Savage' ? 3 : advanced === 'Nimble' ? 2 : 0)

  const attacks = String(d.companion_attacks ?? '').split(';').filter(Boolean).map((a) => {
    const [name, damage = '', traits = ''] = a.split('|')
    const m = /^(\d+)d(\d+)\s*(.*)$/.exec(damage)
    const finesse = /agile|finesse/.test(traits)
    const ability: Ability = finesse && mods.dex > mods.str ? 'dex' : 'str'
    const bonus = mods[ability] + flat
    const text = m ? `${mature ? +m[1] * 2 : m[1]}d${m[2]}${bonus ? signed(bonus) : ''} ${m[3]}`.trim() : damage
    return { name, traits, attack: mods[ability] + proficiencyBonus(1, level), damage: text }
  })

  const speedRaw = String(d.speed_raw ?? (d.speed ? `${d.speed} feet` : ''))
  const speedBonus = specs.reduce((n, s) => n + (s.speed ?? 0), 0)
  const speed = speedBonus ? speedRaw.replace(/^\d+/, (n) => String(+n + speedBonus)) : speedRaw

  const skills = Object.entries(rank)
    .filter(([k, r]) => r > 0 && (k in SKILL_ABILITY || typeSkills.includes(k)))
    .map(([k]) => ({ name: k, rank: rank[k], bonus: total(k, SKILL_ABILITY[k] ?? 'wis') }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    entry, level, size, mods, hp, speed, skills, attacks,
    ac: 10 + mods.dex + prof('Unarmored'),
    perception: total('Perception', 'wis'),
    fortitude: total('Fortitude', 'con'),
    reflex: total('Reflex', 'dex'),
    will: total('Will', 'wis'),
    senses: String(d.sense ?? ''),
    support: String(d.companion_support ?? ''),
    maneuver: String(d.companion_maneuver ?? ''),
    mount: d.mount === true,
  }
}
