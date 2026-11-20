import { activeFeatsNamed, byName, canopyCrawlerAffects, companionSpellTarget, deitySanctification, enlargeCompanionSize, featTakenLevel, isMagicHideActive, isSpellActive, knowsSpell, parryBonus, proficiencyBonus, raisedShieldBonus, shieldRaised, signed, type Ability } from './builder'
import { beastmasterAbilities } from './beastmasterFeats'
import { companionProgressionStage, isCompanionAdvancement, isCompanionSpecialization } from './featChoices'
import type { Character, CompanionEquipment, ContentEntry } from './types'
import { getSettings } from './settings'

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']
const CREATURE_TYPES = new Set([
  'aberration', 'animal', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey',
  'fiend', 'fungus', 'giant', 'humanoid', 'monitor', 'ooze', 'plant', 'undead',
])
export const MAX_SPECIALIZATIONS = 3

export const CONSTRUCT_COMPANION_NAME = 'Construct Companion'
export const CONSTRUCT_COMPANION_ENTRY: ContentEntry = {
  id: 'construct-companion', name: CONSTRUCT_COMPANION_NAME, kind: 'companion', source: 'official',
  systems: ['pf2e'], level: 1, traits: ['Construct', 'Minion'], description: 'Inventor construct companion prototype.',
  data: {
    hp: 10, size: 'Small, Medium', strength: 3, dexterity: 3, constitution: 2, intelligence: -4, wisdom: 1, charisma: 0,
    skill: 'Athletics', speed_raw: '25 feet', sense: 'Low-Light Vision',
    companion_attacks: 'fist|1d8 bludgeoning|agile, finesse;claw|1d6 slashing|agile, finesse',
  },
  effects: [], updatedAt: 0,
}

export const isCompanionEquipmentItem = (entry: ContentEntry) =>
  entry.kind === 'item' && String(entry.data.item_subcategory ?? '').toLowerCase() === 'companion items'

const bardingCatalogs = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()
const bardingFamily = (name: string) => /^Barding(?: \((?:Light|Heavy)[^)]*\))?$/i.test(name)
  ? 'Barding' : name.replace(/^Greater (?=Anti-Dragon Barding$)/i, '')

export function bardingOptions(entries: ContentEntry[], level: number, size = 'Medium'): ContentEntry[] {
  let catalog = bardingCatalogs.get(entries)
  if (!catalog) {
    catalog = new Map()
    for (const entry of entries) {
      if (entry.deleted || entry.kind !== 'item' || !entry.systems.includes('pf2e')) continue
      const family = bardingFamily(entry.name)
      if (family !== 'Barding' && (!isCompanionEquipmentItem(entry)
        || !/\bbarding\b/i.test(`${entry.name} ${entry.data.usage ?? ''}`) || /\bsaddle\b/i.test(entry.name))) continue
      const group = catalog.get(family) ?? []
      group.push(entry)
      catalog.set(family, group)
    }
    bardingCatalogs.set(entries, catalog)
  }
  return [...catalog].flatMap(([family, group]) => {
    const root = [...group].sort((a, b) => a.id.localeCompare(b.id))[0]
    return (['Light', 'Heavy'] as const).map(weight => {
      const large = SIZES.indexOf(size) >= SIZES.indexOf('Large')
      const grades = [...group].sort((a, b) => a.level - b.level
        || Number(b.data.price !== undefined) - Number(a.data.price !== undefined))
      const available = grades.filter(entry => entry.level <= level)
      const source = family === 'Barding'
        ? group.find(entry => entry.name === `Barding (${weight}; ${large ? 'Large' : 'Small or Medium'})`) ?? root
        : family === 'Anti-Dragon Barding' ? available.sort((a, b) => b.level - a.level
          || Number(b.data.price !== undefined) - Number(a.data.price !== undefined))[0] ?? grades[0] : root
      const heavy = weight === 'Heavy'
      const ac = heavy ? 3 : 1, dexCap = heavy ? 3 : 5, strength = heavy ? 5 : 3
      let description = source.description
      if (family !== 'Barding') description = description.replace(/\b(?:light|heavy) barding\b/gi, `${weight.toLowerCase()} barding`)
      if (family === 'Anti-Dragon Barding') {
        description = description.split(/\n\n(?:Greater )?Anti-Dragon Barding\n/)[0]
        if (level >= 12) description = description.replace(/\+2 item bonus/g, '+4 item bonus').replace(/\b1d4 piercing/g, '3d4 piercing')
      }
      return {
        ...source, id: `${root.id}:barding:${weight.toLowerCase()}`, name: `${family} (${weight})`,
        level: family === 'Barding' ? heavy ? large ? 3 : 2 : 0 : source.level,
        description: `${description}\n\n${weight} barding: +${ac} item bonus to AC; Dexterity cap +${dexCap}; check penalty ${heavy ? -3 : -1}; Speed penalty ${heavy ? -10 : -5} feet; Strength +${strength}.`,
        data: { ...source.data, item_subcategory: 'Companion Items', barding_family: family, barding_type: weight,
          ac, dex_cap: dexCap, check_penalty: heavy ? -3 : -1, speed_penalty: heavy ? -10 : -5, strength,
          ...(family === 'Barding' ? { price: (heavy ? 2500 : 1000) * (large ? 2 : 1), bulk: (heavy ? 4 : 2) * (large ? 2 : 1) } : {}),
        },
      }
    })
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export function equippedBarding(entries: ContentEntry[], level: number, item: CompanionEquipment, size?: string) {
  const options = bardingOptions(entries, level, size)
  const selected = options.find(entry => entry.id === item.entryId)
  if (selected) return selected
  const legacy = entries.find(entry => entry.id === item.entryId && !entry.deleted)
  return legacy && options.find(entry => entry.data.barding_family === bardingFamily(legacy.name)
    && entry.data.barding_type === (/\bheavy\b/i.test(legacy.name) ? 'Heavy' : 'Light'))
}

export function minionFerocity(c: Character) {
  if (!activeFeatsNamed(c, 'Ferocious Beasts').length) return undefined
  return { temporaryHp: activeFeatsNamed(c, 'Undying Ferocity').length ? c.level : 0 }
}

const HORSESHOE_EFFECTS: Record<string, { speed: number; athletics: number }> = {
  'Alacritous Horseshoes': { speed: 5, athletics: 2 },
  'Alacritous Horseshoes (Greater)': { speed: 10, athletics: 3 },
  'Horseshoes of Speed': { speed: 5, athletics: 2 },
  'Horseshoes of Speed (Greater)': { speed: 10, athletics: 3 },
}

export function hasConstructInnovation(c: Character) {
  const active = c.feats.filter(feat => featTakenLevel(feat) <= c.level)
  return c.className === 'Inventor' && /^construct(?: innovation)?$/i.test(c.subclass ?? '')
    || active.some(feat => ['Inventor Dedication', 'Second Innovation', 'Third Innovation'].includes(feat.name)
      && /^construct(?: innovation)?$/i.test(feat.choice ?? ''))
}

export function constructCompanionChange(c: Character): Partial<Character> | undefined {
  if (!hasConstructInnovation(c) || c.companions?.length) return
  return { companions: [{ id: `${c.id}:construct-companion`, type: CONSTRUCT_COMPANION_NAME, name: '' }] }
}

export function faithfulSteedChange(c: Character, entries: ContentEntry[]): Partial<Character> | undefined {
  if (c.faithfulSteedGranted || !c.feats.some((feat) => feat.name === 'Faithful Steed' && featTakenLevel(feat) <= c.level)) return
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
  'Peerless Mascot': { mods: { int: 2, wis: 1 }, set: { 'Warfare Lore': 2 } },
  Daredevil: { mods: { dex: 1 }, set: { Acrobatics: 3, Unarmored: 2 } },
  'Deep Diver': { mods: { con: 1 }, set: { Athletics: 3, Barding: 2 } },
  Racer: { mods: { con: 1 }, set: { Fortitude: 4 }, speed: 10 },
  Shade: { mods: {}, set: { Unarmored: 2 } },
  'Steadfast Strider': { mods: { str: 1 }, set: { Barding: 2 } },
  Tracker: { mods: { wis: 1 }, bump: ['Survival'] },
  'Wildfire Scorcher': { mods: { dex: 1 }, set: { Reflex: 4, Unarmored: 2 } },
  'Wind Chaser': { mods: { dex: 1 }, set: { Acrobatics: 3, Reflex: 4, Unarmored: 2 }, speed: 20 },
  Wrecker: { mods: { str: 1 }, set: { Athletics: 3 } },
}

export const ADVANCED_TYPES = ['Nimble', 'Savage'] as const

const SKILL_ABILITY: Record<string, Ability> = { Acrobatics: 'dex', Athletics: 'str', Intimidation: 'cha', Religion: 'wis', Stealth: 'dex', Survival: 'wis', 'Warfare Lore': 'int' }

// Advancement the character's feats give the companion: Mature, Nimble/Savage and up to three specializations
export function companionAdvancement(c: Character) {
  const active = c.feats.filter((feat) => featTakenLevel(feat) <= c.level)
  const advanced = active.filter((feat) => isCompanionAdvancement(feat.name)).map((f) => f.choice).find((v): v is string => v === 'Nimble' || v === 'Savage')
  const specializations = [...new Set(active.filter((feat) => isCompanionSpecialization(feat.name))
    .flatMap((f) => (f.choice && (f.choice !== 'Auspice' || f.name === 'Auspicious Mount')
      && (f.choice !== 'Peerless Mascot' || c.className === 'Commander' && f.name === 'Peerless Mascot Companion') ? [f.choice] : [])))].slice(0, MAX_SPECIALIZATIONS)
  return { mature: active.some(feat => companionProgressionStage(feat.name) === 'mature') || !!advanced, advanced, specializations }
}

export function beastmasterSpecializationKey(feat: Character['feats'][number], index: number) {
  return feat.slot ?? `feat:${index}`
}

export function companionAdvancementFor(c: Character, index: number) {
  if (index === 0) return companionAdvancement(c)
  const companion = c.companions?.[index]
  const active = c.feats.filter(feat => featTakenLevel(feat) <= c.level)
  const mature = active.some(feat => feat.name === 'Mature Beastmaster Companion')
  const advanced = mature && active.some(feat => feat.name === 'Incredible Beastmaster Companion')
    ? companion?.beastmasterAdvancement : undefined
  const specializations = advanced ? [...new Set(c.feats.flatMap((feat, featIndex) => {
    if (feat.name !== 'Specialized Beastmaster Companion' || featTakenLevel(feat) > c.level) return []
    const choice = companion?.beastmasterSpecializations?.[beastmasterSpecializationKey(feat, featIndex)]
    return choice && choice !== 'Auspice' && choice !== 'Peerless Mascot' ? [choice] : []
  }))].slice(0, MAX_SPECIALIZATIONS) : []
  return { mature, advanced, specializations }
}

export function constructCompanionAdvancement(c: Character) {
  const active = c.feats.filter(feat => featTakenLevel(feat) <= c.level)
  const advanced = active.find(feat => feat.name === 'Advanced Construct Companion')?.choice
  const validAdvanced = advanced === 'Nimble' || advanced === 'Savage' ? advanced : undefined
  return {
    mature: active.some(feat => feat.name === 'Mature Construct Companion') || !!validAdvanced,
    advanced: validAdvanced,
    specializations: [] as string[],
  }
}

export function specializationOptions(c: Character, entries: ContentEntry[], exceptIndex: number) {
  const used = new Set(c.feats.flatMap((f, i) => isCompanionSpecialization(f.name) && i !== exceptIndex && f.choice ? [f.choice] : []))
  const names = new Set([...Object.keys(COMPANION_SPECS), ...entries.filter((e) => e.kind === 'companionSpec').map((e) => e.name)])
  const feat = c.feats[exceptIndex]
  return [...names].filter((n) => !used.has(n) && (n !== 'Auspice' || feat?.name === 'Auspicious Mount' && featTakenLevel(feat) <= c.level)
    && (n !== 'Peerless Mascot' || c.className === 'Commander' && feat?.name === 'Peerless Mascot Companion' && featTakenLevel(feat) <= c.level))
    .sort((a, b) => a.localeCompare(b))
}

const bumpRank = (rank: number) => (rank >= 2 ? 3 : 2)
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

function growSize(size: string) {
  const i = SIZES.indexOf(size)
  return i >= 0 && i <= 2 ? SIZES[i + 1] : size
}

type SpiritAspect = { save: 'Fortitude' | 'Reflex' | 'Will'; skills: string[]; conditional: Record<string, string> }
const SPIRIT_ASPECTS: Record<'Might' | 'Swiftness' | 'Insight', SpiritAspect> = {
  Might: { save: 'Fortitude', skills: ['Athletics'], conditional: { Intimidation: 'Intimidation checks to Demoralize' } },
  Swiftness: { save: 'Reflex', skills: ['Acrobatics'], conditional: { Stealth: 'Stealth checks to Hide or Sneak' } },
  Insight: { save: 'Will', skills: [], conditional: { Perception: 'Perception checks to Seek',
    Survival: 'Survival checks to Sense Direction or Track' } },
}

export function companionStats(c: Character, entries: ContentEntry[], type: string, advancement = { mature: false, advanced: undefined as string | undefined, specializations: [] as string[] }, companionId = c.companions?.[0]?.id) {
  const entry = byName(entries, 'companion', type)
  if (!entry) return undefined
  const { mature, advanced, specializations } = advancement
  const auspice = specializations.includes('Auspice')
  const peerlessMascot = specializations.includes('Peerless Mascot')
  const companion = c.companions?.find(companion => companion.id === companionId)
  const championSanctification = c.className === 'Champion' ? deitySanctification(c, entries).selected : undefined
  const servitor = !auspice ? undefined : c.className === 'Champion'
    ? championSanctification === 'Holy' ? 'Celestial' : championSanctification === 'Unholy' ? 'Fiend' : 'Monitor'
    : companion?.auspiceServitor
  const subtype = servitor === 'Celestial' && (companion?.auspiceSubtype === 'Angel' || entry.traits.some(trait => trait.toLowerCase() === 'angel'))
    ? 'Angel' : servitor === 'Fiend' && (companion?.auspiceSubtype === 'Devil' || entry.traits.some(trait => trait.toLowerCase() === 'devil'))
      ? 'Devil' : undefined
  const auspiceLanguage = subtype === 'Angel' ? 'Empyrean' : subtype === 'Devil' ? 'Diabolic' : auspice ? companion?.auspiceLanguage?.trim() : undefined
  const auspiceTraits = [...(servitor === 'Celestial' ? ['Celestial', 'Holy'] : servitor === 'Fiend' ? ['Fiend', 'Unholy'] : servitor === 'Monitor' ? ['Monitor'] : []),
    ...(subtype ? [subtype] : [])]
  const firstCompanion = companionId !== undefined && companionId === c.companions?.[0]?.id
  const has = (name: string) => firstCompanion && c.feats.some((feat) => feat.name === name && featTakenLevel(feat) <= c.level)
  const celestialMount = has('Celestial Mount')
  const fiendishMount = has('Fiendish Mount')
  const paleHorseChoice = has('Pale Horse') && has('Faithful Steed')
    ? c.companions?.find(companion => companion.id === companionId)?.paleHorse : undefined
  const paleHorse = paleHorseChoice && ['Fire', 'Poison', 'Void'].includes(paleHorseChoice)
    ? { damage: paleHorseChoice, resistance: 10, retaliation: `${c.level >= 20 ? 3 : c.level >= 16 ? 2 : 1}d6` } : undefined
  const sanctification = has('Faithful Steed') ? championSanctification : undefined
  const steedTraits = sanctification ? [sanctification] : []
  const grantedTraits = [...new Set([...auspiceTraits, ...steedTraits, ...(celestialMount ? ['Celestial'] : []),
    ...(fiendishMount ? ['Fiend'] : []), ...(peerlessMascot ? ['Beast'] : [])])]
  const listedTraits = entry.traits.filter(trait => trait.toLowerCase() !== 'mount')
  const creatureTraits = listedTraits.filter(trait => CREATURE_TYPES.has(trait.toLowerCase()))
  const traits = [...(creatureTraits.length ? creatureTraits : ['Animal']), 'Minion', ...listedTraits, ...grantedTraits]
    .filter((trait, index, all) => all.findIndex(other => other.toLowerCase() === trait.toLowerCase()) === index)
  const weaknesses = [
    ...(celestialMount ? ['Unholy 10'] : servitor === 'Celestial' ? ['Unholy 5'] : []),
    ...(fiendishMount ? ['Holy 10'] : servitor === 'Fiend' ? ['Holy 5'] : []),
  ]
  const weakness = weaknesses.join(', ') || undefined
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
  const stealthyCompanion = has('Stealthy Companion')
  if (stealthyCompanion && specializations.includes('Ambusher')) rank.Stealth = rank.Stealth >= 3 ? 4 : 3

  const level = c.level
  const prof = (k: string) => proficiencyBonus(rank[k] ?? 0, level)
  const hp = num(d.hp) + (6 + mods.con) * level + (auspice ? (level >= 20 ? 30 : level >= 18 ? 25 : 20)
    + (servitor === 'Celestial' || servitor === 'Fiend' ? 5 : 0) : 0) + (celestialMount || fiendishMount ? 40 : 0)
    + (peerlessMascot ? level >= 20 ? 30 : level >= 18 ? 25 : 20 : 0)
  const baseSize = String(d.size ?? '').split(',')[0].trim()
  const naturalSize = mature && baseSize && d.fixed_size !== true ? growSize(baseSize) : baseSize
  const apex = c.level >= 19 && companionId !== undefined
    && companionId === companionSpellTarget(c, c.apexCompanionId) && isSpellActive(c, entries, 'Apex Companion')
    && type !== CONSTRUCT_COMPANION_NAME && !entry.traits.some(trait => ['construct', 'eidolon'].includes(trait.toLowerCase()))
  const enlargedSize = enlargeCompanionSize(c, naturalSize)
  const enlarge = !apex && c.level >= 3 && companionId !== undefined
    && companionId === companionSpellTarget(c, c.enlargeCompanionId) && isSpellActive(c, entries, 'Enlarge Companion')
    && SIZES.indexOf(naturalSize) >= 0 && SIZES.indexOf(naturalSize) < SIZES.indexOf(enlargedSize)
    ? { size: enlargedSize, damage: enlargedSize === 'Huge' ? 4 : 2,
      reachIncrease: (enlargedSize === 'Huge' ? 10 : 5) + (naturalSize === 'Tiny' ? 5 : 0) } : undefined
  const clumsy = enlarge ? 1 : 0
  const total = (k: string, ability: Ability) => mods[ability] + prof(k) - (ability === 'dex' ? clumsy : 0)
  const size = apex ? 'Huge' : enlarge?.size ?? naturalSize
  const riderSizes = String(byName(entries, 'ancestry', c.ancestry)?.data.size ?? 'Medium')
    .match(/tiny|small|medium|large|huge|gargantuan/gi) ?? ['Medium']
  const riderSize = Math.max(...riderSizes.map(value => SIZES.findIndex(candidate => candidate.toLowerCase() === value.toLowerCase())))
  const riderMount = d.mount !== true && !entry.traits.some(trait => ['construct', 'eidolon'].includes(trait.toLowerCase()))
    && c.feats.some(feat => feat.name === 'Rider' && featTakenLevel(feat) <= c.level)
    && SIZES.indexOf(size) > riderSize
  const flat = (advanced === 'Savage' ? 3 : advanced === 'Nimble' ? 2 : 0)

  const rawAttacks = String(d.companion_attacks ?? '').split(';').filter(Boolean)
  const beastmaster = beastmasterAbilities(c, level, mods.str, specializations.length > 0, {
    attacks: rawAttacks.map(attack => { const [name, , traits = ''] = attack.split('|'); return { name, traits } }),
    size: naturalSize, speed: String(d.speed_raw ?? (d.speed ? `${d.speed} feet` : '')),
  })
  if (beastmaster.gust) rawAttacks.push('gust|1d4 bludgeoning|air, propulsive, range 30 feet')
  const attacks = rawAttacks.map((a) => {
    const [name, damage = '', traits = ''] = a.split('|')
    const m = /^(\d+)d(\d+)\s*(.*)$/.exec(damage)
    const finesse = /agile|finesse/.test(traits)
    const ability: Ability = finesse && mods.dex > mods.str ? 'dex' : 'str'
    const ranged = /\branged\b|\brange(?: increment)?\s+\d+/i.test(traits)
    const bonus = mods[ability] + flat + (!ranged ? enlarge?.damage ?? 0 : 0)
    const die = m && apex ? [4, 6, 8, 10, 12].find(die => die > +m[2]) ?? +m[2] : m?.[2]
    const text = m ? `${mature ? +m[1] * 2 : m[1]}d${die}${bonus ? signed(bonus) : ''} ${m[3]}`.trim() : damage
    const apexTraits = apex ? /\bdeadly\s+d\d+\b/i.test(traits)
      ? traits.replace(/\bdeadly\s+d\d+\b/gi, 'Deadly d12') : [traits, 'Deadly d12'].filter(Boolean).join(', ') : traits
    const strikeTraits = [apexTraits, ...steedTraits.filter((trait) => !traits.split(',').some((value) => value.trim().toLowerCase() === trait.toLowerCase()))]
      .filter(Boolean).join(', ')
    return { name, traits: strikeTraits, attack: mods[ability] + proficiencyBonus(1, level) - (ability === 'dex' ? clumsy : 0),
      damage: text, dexterityBased: ability === 'dex', ranged }
  })

  const speedRaw = String(d.speed_raw ?? (d.speed ? `${d.speed} feet` : ''))
  const speedBonuses = specializations.flatMap((source) => {
    const feet = COMPANION_SPECS[source]?.speed
    return feet ? [{ source, feet }] : []
  })
  const barding = companion?.equipment?.Barding && c.systems.includes('pf2e')
    ? equippedBarding(entries, level, companion.equipment.Barding, size) : undefined
  const bardingCheckPenalty = barding && mods.str < num(barding.data.strength) ? num(barding.data.check_penalty) : 0
  const rawBardingSpeedPenalty = barding ? Math.min(0, num(barding.data.speed_penalty)
    + (mods.str >= num(barding.data.strength) ? 5 : 0)) : 0
  const antiDragon = barding?.data.barding_family === 'Anti-Dragon Barding'
    ? { source: barding.name, bonus: level >= 12 ? 4 : 2, damage: level >= 12 ? '3d4' : '1d4' } : undefined
  const shoes = companion?.equipment?.Shoes
  const shoesEntry = shoes && entries.find(entry => entry.id === shoes.entryId && isCompanionEquipmentItem(entry))
  const horseshoes = shoesEntry && HORSESHOE_EFFECTS[shoesEntry.name]
  if (horseshoes && shoesEntry) speedBonuses.push({ source: shoesEntry.name, feet: horseshoes.speed })
  const breed = type === 'Horse' && firstCompanion ? c.feats
    .filter(feat => ['Chiardmar Steed', 'Nidarrmar Steed'].includes(feat.name) && featTakenLevel(feat) <= c.level)
    .sort((a, b) => featTakenLevel(a) - featTakenLevel(b))[0]?.name : undefined
  const chiardmar = breed === 'Chiardmar Steed'
  const nidarrmar = breed === 'Nidarrmar Steed'
  const bardingSpeedPenalty = Math.min(0, rawBardingSpeedPenalty + (nidarrmar ? 10 : 0))
  if (chiardmar) speedBonuses.push({ source: 'Chiardmar Steed', feet: 5 })
  const speedBonus = speedBonuses.reduce((sum, bonus) => sum + bonus.feet, 0)
  let speed = speedBonus ? speedRaw.replace(/^\d+/, (n) => String(+n + speedBonus)) : speedRaw
  if (bardingSpeedPenalty) speed = speed.replace(/(\d+)\s*(feet|ft)\b/gi,
    (_, feet: string, unit: string) => `${Math.max(+feet > 0 ? 5 : 0, +feet + bardingSpeedPenalty)} ${unit}`)
  if (apex) speed = speed.replace(/(\d+)\s*(feet|ft)\b/gi, (_, feet: string, unit: string) => `${+feet + 10} ${unit}`)
  if ((auspice || celestialMount || fiendishMount) && !getSettings().championFormNoFlight) {
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
  if (peerlessMascot) {
    const highest = Math.max(0, ...[...speed.matchAll(/(\d+)\s*(?:feet|ft)\b/gi)].map(match => +match[1]))
    if (highest > 0) {
      speed = speed.replace(/^\d+/, String(highest))
      for (const movement of ['climb', 'swim']) {
        const pattern = new RegExp(`\\b${movement}\\s+\\d+\\s*(?:feet|ft)\\b`, 'i')
        speed = pattern.test(speed) ? speed.replace(pattern, `${movement} ${highest} feet`) : `${speed}, ${movement} ${highest} feet`
      }
    }
  }

  const aspectName = companion?.spiritAspect && knowsSpell(c, entries, 'Spirit of the Beast') ? companion.spiritAspect : undefined
  const aspectRank = Math.ceil(level / 2)
  const aspect = aspectName ? { name: aspectName, bonus: aspectRank >= 8 ? 3 : aspectRank >= 5 ? 2 : 1,
    ...SPIRIT_ASPECTS[aspectName] } : undefined
  const aspectNote = (skill: string, current: number) => aspect?.conditional[skill]
    ? `Aspect of ${aspect.name}: ${signed(current + aspect.bonus)} to ${aspect.conditional[skill]} (+${aspect.bonus} status bonus).` : undefined
  const skills: Array<{ name: string; rank: number; bonus: number; clumsy: boolean; note?: string; noteSource?: string }> = Object.entries(rank)
    .filter(([k, r]) => r > 0 && (k in SKILL_ABILITY || typeSkills.includes(k)))
    .map(([k]) => ({ name: k, rank: rank[k], bonus: total(k, SKILL_ABILITY[k] ?? 'wis') + (aspect?.skills.includes(k) ? aspect.bonus : 0)
      + (['str', 'dex'].includes(SKILL_ABILITY[k]) ? bardingCheckPenalty : 0),
      note: [
        aspect?.skills.includes(k) ? `Aspect of ${aspect.name}: +${aspect.bonus} status bonus.`
          : aspectNote(k, total(k, SKILL_ABILITY[k] ?? 'wis') + (['str', 'dex'].includes(SKILL_ABILITY[k]) ? bardingCheckPenalty : 0)),
        bardingCheckPenalty && ['str', 'dex'].includes(SKILL_ABILITY[k]) ? `${signed(bardingCheckPenalty)} check penalty (${barding?.name}).` : undefined,
      ].filter(Boolean).join(' ') || undefined,
      noteSource: [
        aspect?.skills.includes(k) || aspectNote(k, 0) ? 'Spirit of the Beast' : undefined,
        bardingCheckPenalty && ['str', 'dex'].includes(SKILL_ABILITY[k]) ? barding?.name : undefined,
      ].filter(Boolean).join(', ') || undefined,
      clumsy: SKILL_ABILITY[k] === 'dex' && !!clumsy }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const horseshoeNote = horseshoes && shoesEntry
    ? `${shoesEntry.name}: ${signed(total('Athletics', 'str') + (aspect?.skills.includes('Athletics') ? aspect.bonus : 0) + bardingCheckPenalty + horseshoes.athletics)} to Athletics checks to High Jump and Long Jump (+${horseshoes.athletics} circumstance bonus); when Leaping, move 5 feet farther horizontally or 3 feet higher vertically.`
    : undefined
  const companionSkills = skills.map(skill => skill.name === 'Athletics' && horseshoeNote && shoesEntry
    ? { ...skill, note: [skill.note, horseshoeNote].filter(Boolean).join(' '),
      noteSource: [skill.noteSource, shoesEntry.name].filter(Boolean).join(', ') } : skill)

  const magicHide = companionId !== undefined && isMagicHideActive(c, entries, companionId) ? 1 : 0
  const mountedParry = companion && companionId === c.mountedCompanionId && activeFeatsNamed(c, 'Mounted Parry').length
    ? parryBonus(c, entries) : 0
  const mountedShield = companion && companionId === c.mountedCompanionId && activeFeatsNamed(c, 'Mounted Shield').length
    && shieldRaised(c) ? raisedShieldBonus(c, entries) : 0
  const senses = String(d.sense ?? '')
  const mountSenses = (apex || celestialMount || fiendishMount) && !/\bdarkvision\b/i.test(senses)
    ? [senses, 'Darkvision'].filter(Boolean).join(', ') : senses
  return {
    entry, level, size, naturalSize, mods, hp, speed,
    speedBonuses: [...speedBonuses, ...(rawBardingSpeedPenalty && barding ? [{ source: barding.name, feet: rawBardingSpeedPenalty }] : []),
      ...(nidarrmar && rawBardingSpeedPenalty ? [{ source: 'Nidarrmar Steed', feet: bardingSpeedPenalty - rawBardingSpeedPenalty }] : []),
      ...(apex ? [{ source: 'Apex Companion (status)', feet: 10 }] : [])],
    skills: companionSkills, attacks, traits, auspice, peerlessMascot, servitor, subtype, auspiceLanguage, auspiceTraits, grantedTraits, weakness, paleHorse,
    apex, temporaryHp: apex ? 30 : 0, reach: apex ? 15 : undefined, ignoreAllDifficultTerrain: apex,
    ignoreDifficultTerrain: chiardmar ? 10 : 0, nidarrmar,
    ac: 10 + (barding ? Math.min(mods.dex, num(barding.data.dex_cap)) + proficiencyBonus(rank.Barding ?? 1, level) + num(barding.data.ac)
      : mods.dex + prof('Unarmored')) + magicHide - clumsy + Math.max(mountedParry, mountedShield),
    barding, bardingCheckPenalty, antiDragon,
    magicHide, mountedParry, mountedShield, canopyCrawler, enlarge, clumsy, stealthyCompanion,
    ferocity: type !== CONSTRUCT_COMPANION_NAME && !entry.traits.some(trait => ['construct', 'eidolon'].includes(trait.toLowerCase()))
      ? minionFerocity(c) : undefined,
    primalHowl: has('Primal Howl') ? `${Math.floor(level / 2)}d6` : undefined,
    aspect, perceptionNote: aspectNote('Perception', total('Perception', 'wis')),
    perception: total('Perception', 'wis'),
    fortitude: total('Fortitude', 'con') + (aspect?.save === 'Fortitude' ? aspect.bonus : 0),
    reflex: total('Reflex', 'dex') + (aspect?.save === 'Reflex' ? aspect.bonus : 0),
    will: total('Will', 'wis') + (aspect?.save === 'Will' ? aspect.bonus : 0),
    senses: mountSenses,
    support: String(d.companion_support ?? ''),
    maneuver: String(d.companion_maneuver ?? ''),
    maneuverActions: String(d.companion_maneuver_actions ?? ''),
    maneuverTraits: String(d.companion_maneuver_traits ?? ''),
    maneuverRequirements: String(d.companion_maneuver_requirements ?? ''),
    maneuverDescription: String(d.companion_maneuver_description ?? ''),
    beastmasterManeuvers: beastmaster.maneuvers, beastmasterSpecial: beastmaster.special,
    mount: d.mount === true || riderMount, riderMount,
  }

}
