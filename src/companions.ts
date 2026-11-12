import { byName, canopyCrawlerAffects, companionSpellTarget, deitySanctification, enlargeCompanionSize, featTakenLevel, isMagicHideActive, isSpellActive, proficiencyBonus, signed, type Ability } from './builder'
import { isCompanionAdvancement, isCompanionSpecialization } from './featChoices'
import type { Character, ContentEntry } from './types'

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']
export const MAX_SPECIALIZATIONS = 3

export function faithfulSteedChange(c: Character, entries: ContentEntry[]): Partial<Character> | undefined {
  if (c.faithfulSteedGranted || !c.feats.some((feat) => feat.name === 'Faithful Steed' && feat.level <= c.level)) return
  if (c.companions?.length) return { faithfulSteedGranted: true }
  const horse = entries.find((entry) => entry.kind === 'companion' && entry.name === 'Horse' && !entry.deleted)
  if (!horse) return
  return {
    faithfulSteedGranted: true,
    companions: [{ id: `${c.id}:faithful-steed`, type: horse.name, name: '' }],
  }
}

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
  Auspice: { mods: { int: 2, wis: 1 }, set: { Religion: 2 } },
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

const SKILL_ABILITY: Record<string, Ability> = { Acrobatics: 'dex', Athletics: 'str', Intimidation: 'cha', Religion: 'wis', Stealth: 'dex', Survival: 'wis' }

// Advancement the character's feats give the companion: Mature, Nimble/Savage and up to three specializations
export function companionAdvancement(c: Character) {
  const has = (prefix: string) => c.feats.filter((f) => f.name.startsWith(prefix))
  const advanced = c.feats.filter((feat) => isCompanionAdvancement(feat.name)).map((f) => f.choice).find((v): v is string => v === 'Nimble' || v === 'Savage')
  const specializations = [...new Set(c.feats.filter((feat) => isCompanionSpecialization(feat.name) && feat.level <= c.level)
    .flatMap((f) => (f.choice && (f.choice !== 'Auspice' || f.name === 'Auspicious Mount') ? [f.choice] : [])))].slice(0, MAX_SPECIALIZATIONS)
  return { mature: has('Mature Animal Companion').length > 0 || has('Impressive Mount').length > 0
    || has('Loyal Warhorse').length > 0 || !!advanced, advanced, specializations }
}

export function specializationOptions(c: Character, entries: ContentEntry[], exceptIndex: number) {
  const used = new Set(c.feats.flatMap((f, i) => isCompanionSpecialization(f.name) && i !== exceptIndex && f.choice ? [f.choice] : []))
  const names = new Set([...Object.keys(COMPANION_SPECS), ...entries.filter((e) => e.kind === 'companionSpec').map((e) => e.name)])
  const feat = c.feats[exceptIndex]
  return [...names].filter((n) => !used.has(n) && (n !== 'Auspice' || feat?.name === 'Auspicious Mount' && feat.level <= c.level))
    .sort((a, b) => a.localeCompare(b))
}

const bumpRank = (rank: number) => (rank >= 2 ? 3 : 2)
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

function growSize(size: string) {
  const i = SIZES.indexOf(size)
  return i >= 0 && i <= 2 ? SIZES[i + 1] : size
}

export function companionStats(c: Character, entries: ContentEntry[], type: string, advancement = { mature: false, advanced: undefined as string | undefined, specializations: [] as string[] }, companionId = c.companions?.[0]?.id) {
  const entry = byName(entries, 'companion', type)
  if (!entry) return undefined
  const { mature, advanced, specializations } = advancement
  const auspice = specializations.includes('Auspice')
  const servitor = auspice ? c.companions?.find((companion) => companion.id === companionId)?.auspiceServitor : undefined
  const auspiceTraits = servitor === 'Celestial' ? ['Celestial', 'Holy'] : servitor === 'Fiend' ? ['Fiend', 'Unholy'] : servitor === 'Monitor' ? ['Monitor'] : []
  const firstCompanion = companionId !== undefined && companionId === c.companions?.[0]?.id
  const has = (name: string) => firstCompanion && c.feats.some((feat) => feat.name === name && featTakenLevel(feat) <= c.level)
  const sanctification = c.className === 'Champion' && has('Faithful Steed') ? deitySanctification(c, entries).selected : undefined
  const steedTraits = sanctification ? [sanctification] : []
  const grantedTraits = [...new Set([...auspiceTraits, ...steedTraits])]
  const weakness = servitor === 'Celestial' ? 'Unholy 5' : servitor === 'Fiend' ? 'Holy 5' : undefined
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
  const hp = num(d.hp) + (6 + mods.con) * level + (auspice ? (level >= 20 ? 30 : level >= 18 ? 25 : 20) + (weakness ? 5 : 0) : 0)
  const baseSize = String(d.size ?? '').split(',')[0].trim()
  const naturalSize = mature && baseSize && d.fixed_size !== true ? growSize(baseSize) : baseSize
  const enlargedSize = enlargeCompanionSize(c, naturalSize)
  const enlarge = c.level >= 3 && companionId !== undefined
    && companionId === companionSpellTarget(c, c.enlargeCompanionId) && isSpellActive(c, entries, 'Enlarge Companion')
    && SIZES.indexOf(naturalSize) >= 0 && SIZES.indexOf(naturalSize) < SIZES.indexOf(enlargedSize)
    ? { size: enlargedSize, damage: enlargedSize === 'Huge' ? 4 : 2,
      reachIncrease: (enlargedSize === 'Huge' ? 10 : 5) + (naturalSize === 'Tiny' ? 5 : 0) } : undefined
  const clumsy = enlarge ? 1 : 0
  const total = (k: string, ability: Ability) => mods[ability] + prof(k) - (ability === 'dex' ? clumsy : 0)
  const size = enlarge?.size ?? naturalSize
  const flat = (advanced === 'Savage' ? 3 : advanced === 'Nimble' ? 2 : 0)

  const attacks = String(d.companion_attacks ?? '').split(';').filter(Boolean).map((a) => {
    const [name, damage = '', traits = ''] = a.split('|')
    const m = /^(\d+)d(\d+)\s*(.*)$/.exec(damage)
    const finesse = /agile|finesse/.test(traits)
    const ability: Ability = finesse && mods.dex > mods.str ? 'dex' : 'str'
    const ranged = /\branged\b|\brange(?: increment)?\s+\d+/i.test(traits)
    const bonus = mods[ability] + flat + (!ranged ? enlarge?.damage ?? 0 : 0)
    const text = m ? `${mature ? +m[1] * 2 : m[1]}d${m[2]}${bonus ? signed(bonus) : ''} ${m[3]}`.trim() : damage
    const strikeTraits = [traits, ...steedTraits.filter((trait) => !traits.split(',').some((value) => value.trim().toLowerCase() === trait.toLowerCase()))]
      .filter(Boolean).join(', ')
    return { name, traits: strikeTraits, attack: mods[ability] + proficiencyBonus(1, level) - (ability === 'dex' ? clumsy : 0),
      damage: text, dexterityBased: ability === 'dex', ranged }
  })

  const speedRaw = String(d.speed_raw ?? (d.speed ? `${d.speed} feet` : ''))
  const speedBonuses = specializations.flatMap((source) => {
    const feet = COMPANION_SPECS[source]?.speed
    return feet ? [{ source, feet }] : []
  })
  const chiardmar = type === 'Horse' && has('Chiardmar Steed')
  if (chiardmar) speedBonuses.push({ source: 'Chiardmar Steed', feet: 5 })
  const speedBonus = speedBonuses.reduce((sum, bonus) => sum + bonus.feet, 0)
  let speed = speedBonus ? speedRaw.replace(/^\d+/, (n) => String(+n + speedBonus)) : speedRaw
  if (auspice) {
    const land = Number(/^\d+/.exec(speed)?.[0])
    if (land > 0) {
      const fly = /\bfly\s+(\d+)\s*(?:feet|ft)\b/i.exec(speed)
      speed = fly ? speed.replace(fly[0], `fly ${Math.max(land, Number(fly[1]))} feet`) : `${speed}, fly ${land} feet`
    }
  }
  const canopyCrawler = companionId !== undefined && canopyCrawlerAffects(c, entries, companionId)
  if (canopyCrawler) {
    const speeds = [...speed.matchAll(/(\d+)\s*(?:feet|ft)\b/gi)].map((match) => +match[1])
    const highest = Math.max(0, ...speeds)
    if (highest > 0) speed = /\bclimb\s+\d+\s*(?:feet|ft)\b/i.test(speed)
      ? speed.replace(/\bclimb\s+\d+\s*(?:feet|ft)\b/i, `climb ${highest} feet`) : `${speed}${speed ? ', ' : ''}climb ${highest} feet`
  }

  const skills = Object.entries(rank)
    .filter(([k, r]) => r > 0 && (k in SKILL_ABILITY || typeSkills.includes(k)))
    .map(([k]) => ({ name: k, rank: rank[k], bonus: total(k, SKILL_ABILITY[k] ?? 'wis'),
      clumsy: SKILL_ABILITY[k] === 'dex' && !!clumsy }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const magicHide = companionId !== undefined && isMagicHideActive(c, entries, companionId) ? 1 : 0
  return {
    entry, level, size, naturalSize, mods, hp, speed, speedBonuses, skills, attacks, auspice, auspiceTraits, grantedTraits, weakness,
    ignoreDifficultTerrain: chiardmar ? 10 : 0,
    ac: 10 + mods.dex + prof('Unarmored') + magicHide - clumsy,
    magicHide, canopyCrawler, enlarge, clumsy,
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
