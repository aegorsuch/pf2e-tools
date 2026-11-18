import type { Character, ContentEntry, FeatSlot, FeatSlotCategory, HardlightGrade, OwnedArmor, OwnedShield, OwnedWeapon } from './types'
import { INITIATE_TRAINING, alloyedAttackChoice, ancestralUnarmedFeatNames, ancestryFeatTraits, canSelectWardenFeat, companionProgressionStage, featTakenLevel, grantedWardenSpells, hasWardenChoice, isCompanionAdvancement, isCompanionSpecialization, isRepeatableCompanionSpecialization, selectedFeatEntry, wardenSpellOptions, wardenTierOf } from './featChoices'
import { DOMAIN_FEATS, ancestralMagicAvailable, featSpellOptions, grantedFeatSpells } from './featSpells'
import { GODCLAW_DOMAINS, ORDER_TRAINING_FEATS, hellknightBenefitActive, hellknightSkillNotes, hellknightTrainingBenefit, hellknightTrainingBenefits, orderTrainingChoices } from './hellknight'
import { backgroundLoreCount, backgroundLoreOptions, isOpenBackgroundLore } from './backgrounds'
import { familiarityChoiceOptions, uncommonWeapon, weaponFamiliarity } from './weaponFamiliarity'
import { armigerArmorEntry, automaticArmorFundamentals, canWearWithAttachedArmor, grantedArmorEntries, hardwoodHasShield, INVENTOR_ARMOR_ID, isGrantedArmor } from './grantedArmor'
export { INITIATE_TRAINING, ancestryFeatTraits, featTakenLevel, selectedFeatEntry } from './featChoices'
import { getSettings } from './settings'
import { BEASTMASTER_FEATS, beastmasterRequirementMissing } from './beastmasterFeats'
import { companionAdvancement } from './companions'
import { contentAccessGranted, featRarity } from './featAccess'
import { createFeatPrerequisiteChecker, featPrerequisiteSources, type PrerequisiteFacts } from './featPrerequisites'
import { ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS, ANIMAL_FEATURES, ARMOR_GAUNTLETS, ATTACHED_WEAPONS, CAIRN_FIST, CLAN_DAGGER, CLAN_DAGGER_DEXTERITY, CLAN_PISTOL, FIST, GAUNTLET, HAFT_STRIKER_WEAPON, HANDWRAPS, HARDLIGHT_GRADES, IRON_FIST, IRUXI_CLAWS, IRUXI_FANGS, IRUXI_TAIL, ORC_TUSKS, OVERSIZED_THROW, SHIELD_BASH, SPARK_FIST, SUPPLEMENTAL_WEAPONS, UNTAMED_CLAWS, UNTAMED_JAWS } from './supplemental'
import { warmaskSource, WARMASK_SOURCES } from './warmask'
import { armorModifications, armorOverdriveActive, inventorArmorResistances } from './inventorArmor'
import { isNamedArmor, makeNamedArmorEntries, makeNamedShieldEntry, namedArmorEnhancements } from './namedArmor'
import { hasWeaponRuneCapacity, weaponWithModifications } from './inventorWeapon'
import { weaponWithMode } from './weaponModes'
import { minorMagicSpells } from './minorMagic'
import { STARFINDER_SUBCLASSES } from './starfinderSubclasses'
import { eruditeWarrior, isSoldier, soldierStyle } from './soldier'
import { witchwarperParadox, witchwarperSpellcasting, witchwarperSpellSlots } from './witchwarper'
import { DRONE_CHASSIS } from './droneChassis'
import { energyNeutralizerResistances } from './mechanicEnergy'
import { adoptedAncestryText, featDisplayName, isStanceFeat } from './featChoices'
import { equipmentDisplayName, equipmentGroupName } from './equipmentGroups'
import { divineAttackDamage, hasDivineIntercession, TORAG_BOON_FEAT_SLOT } from './divineIntercessions'
import { characterHeritages, elfAtavismOptions, isVersatileHeritage } from './heritages'
import { makeNamedWeaponEntries, namedWeaponBaseName, namedWeaponDamage, namedWeaponEnhancements, withNamedWeaponState } from './namedWeapons'
export { heritagesFor, isVersatileHeritage } from './heritages'

export type Ability = keyof Character['abilities']

export function innateSpellAbility(c: Character, normal: Ability = 'cha'): Ability {
  if (!getSettings().innateHighestMental) return normal
  let best: Ability = ['int', 'wis', 'cha'].includes(normal) ? normal : 'cha'
  for (const ability of ['int', 'wis', 'cha'] as const) {
    if (c.abilities[ability] > c.abilities[best]) best = ability
  }
  return best
}
export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export const ABILITY_LABEL: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

export const abilityMod = (score: number) => Math.floor((score - 10) / 2)
export const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

const num = (v: unknown) => (typeof v === 'number' ? v : Number.isFinite(parseFloat(String(v))) ? parseFloat(String(v)) : 0)

// O(1) lookups: the content list has tens of thousands of entries and these run many times per render
const nameCache = new WeakMap<ContentEntry[], Map<string, ContentEntry>>()
export const byName = (entries: ContentEntry[], kind: ContentEntry['kind'], name?: string) => {
  if (!name) return undefined
  let map = nameCache.get(entries)
  if (!map) {
    map = new Map()
    for (const e of entries) { const k = `${e.kind}\0${e.name}`; if (!map.has(k)) map.set(k, e) }
    nameCache.set(entries, map)
  }
  return map.get(`${kind}\0${name}`)
}

// Level 1 HP = ancestry HP + class HP + Con; each later level adds class HP + Con
// Heritages that replace the ancestry's Hit Points
const HERITAGE_HP: Record<string, number> = {
  'Defensive Automaton': 10, 'Dragonscaled Kobold': 10, 'Great Kholo': 10, 'Mightyfall Kobold': 10, 'Mitflit Gremlin': 8,
  'New Moon Sarangay': 10, 'Root Leshy': 10, 'Stoutheart Centaur': 10, 'Thickskin Tripkee': 8, 'Unbreakable Goblin': 10,
}

// Feats that increase maximum Hit Points by your level
const LEVEL_HP_FEATS = ['Fey Skin', 'Golem Grafter Dedication', 'Gremlin Hide', "Jotun's Heart", "Mountain's Stoutness", 'Scion Transformation',
  'Stonebound Dedication', 'Strength of Eight Legions', 'Thick Skin', 'Toughness']

export function maxHp(c: Character, entries: ContentEntry[]) {
  const heritageHp = c.heritage ? HERITAGE_HP[c.heritage] : undefined
  const ancestry = c.ancestry === 'Orc' && c.heritage === 'Hold-Scarred Orc'
    ? 12 : heritageHp ?? num(byName(entries, 'ancestry', c.ancestry)?.data.hp)
  const cls = num(byName(entries, 'class', c.className)?.data.hp)
  return ancestry + (cls + abilityMod(c.abilities.con)) * c.level
    + hitPointBonuses(c, entries).reduce((total, bonus) => total + bonus.value, 0)
    - (hasDivineIntercession(c, 'Asmodeus', 'major-curse') ? Math.max(1, c.level) * 4 : 0)
}

export function hitPointBonuses(c: Character, entries?: ContentEntry[]) {
  const owned = (name: string) => c.feats.some(feat => feat.name.toLowerCase() === name.toLowerCase() && featTakenLevel(feat) <= c.level)
  const guardianFeatCount = entries ? c.feats.filter(feat => featTakenLevel(feat) <= c.level
    && archetypesOf(selectedFeatEntry(c, entries, feat.name, feat.sourceId)).includes('Guardian')).length : 0
  return [
    ...LEVEL_HP_FEATS.filter(owned).map(source => ({ source, value: c.level })),
    ...(owned('Guardian Resiliency') && guardianFeatCount
      ? [{ source: 'Guardian Resiliency', value: guardianFeatCount * 3 }] : []),
    ...(owned('Unbreakable-er Goblin') ? [{ source: 'Unbreakable-er Goblin', value: 10 }] : []),
  ]
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function ancestryLabel(ancestry?: string, heritage?: string) {
  if (!ancestry) return heritage ?? ''
  if (!heritage) return ancestry
  const includesAncestry = `-${slug(heritage)}-`.includes(`-${slug(ancestry)}-`)
  return includesAncestry ? heritage : `${heritage} ${ancestry}`
}

export const characterSummary = (c: Character, entries: ContentEntry[]) =>
  [ancestryLabel(c.ancestry, c.heritage), classLabel(c, entries), c.level].filter((value) => value !== '').join(' ')

// Best-effort feat category from AoN traits
export function featType(feat: ContentEntry, c: Character) {
  const t = feat.traits.map((x) => x.toLowerCase())
  if (t.includes('general')) return t.includes('skill') ? 'Skill Feat' : 'General Feat'
  if (t.includes('skill')) return 'Skill Feat'
  if (c.ancestry && t.includes(c.ancestry.toLowerCase())) return 'Ancestry Feat'
  if (c.className && t.includes(c.className.toLowerCase())) return 'Class Feat'
  if (t.includes('archetype')) return 'Archetype Feat'
  return 'Feat'
}

export interface SectionProps {
  c: Character
  entries: ContentEntry[]
  save: (patch: Partial<Character>) => void
}

// ---------- Ability boosts ----------

const ABILITY_NAMES: Record<string, Ability> = {
  strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
}

const tokens = (v: unknown) => (typeof v === 'string' ? v.split(',').map((t) => t.trim()).filter(Boolean) : [])
const parseAbilities = (v: unknown) =>
  tokens(v).flatMap((t) => (ABILITY_NAMES[t.toLowerCase()] ? [ABILITY_NAMES[t.toLowerCase()]] : []))
const FREE_BOOST_COUNTS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
}

function ancestryBoosts(v: unknown) {
  return tokens(v).flatMap((token) => {
    const count = /^(one|two|three|four|five|six|\d+) free ability boosts?$/i.exec(token)
    if (!count) return [token]
    const n = FREE_BOOST_COUNTS[count[1].toLowerCase()] ?? Number(count[1])
    return Array.from({ length: n }, () => 'Free')
  })
}

export interface BoostSlot {
  key: string
  label: string
  // Fixed boosts are applied automatically; otherwise the player picks from options (all six when undefined)
  fixed?: Ability
  options?: Ability[]
  group: string
}

export const BOOST_LEVELS = [5, 10, 15, 20]

export function boostSlots(c: Character, entries: ContentEntry[]): BoostSlot[] {
  const slots: BoostSlot[] = []
  const ancestry = byName(entries, 'ancestry', c.ancestry)
  ancestryBoosts(ancestry?.data.attribute).forEach((t, i) => {
    const fixed = ABILITY_NAMES[t.toLowerCase()]
    slots.push({ key: `ancestry:${i}`, label: fixed ? `Ancestry (${t})` : 'Ancestry (free)', fixed, group: 'ancestry' })
  })
  const bg = byName(entries, 'background', c.background)
  if (bg) {
    const opts = parseAbilities(bg.data.attribute)
    slots.push({ key: 'background:0', label: 'Background', options: opts.length ? opts : undefined, group: 'background' })
    slots.push({ key: 'background:1', label: 'Background (free)', group: 'background' })
  }
  const klass = byName(entries, 'class', c.className)
  if (klass) {
    const opts = parseAbilities(klass.data.attribute)
    slots.push({
      key: 'class', label: 'Class key attribute', fixed: opts.length === 1 ? opts[0] : undefined,
      options: opts.length > 1 ? opts : undefined, group: 'class',
    })
  }
  for (let i = 0; i < 4; i++) slots.push({ key: `free1:${i}`, label: 'Level 1 free', group: 'free1' })
  for (const l of BOOST_LEVELS) {
    if (c.level >= l) for (let i = 0; i < 4; i++) slots.push({ key: `lvl${l}:${i}`, label: `Level ${l}`, group: `lvl${l}` })
  }
  return slots
}

export const ancestryFlaws = (c: Character, entries: ContentEntry[]) =>
  parseAbilities(byName(entries, 'ancestry', c.ancestry)?.data.attribute_flaw)

// A boost is +2 below 18, otherwise +1
export function computeAbilities(c: Character, entries: ContentEntry[]): Character['abilities'] {
  const out = Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Character['abilities']
  for (const f of ancestryFlaws(c, entries)) out[f] -= 2
  for (const s of boostSlots(c, entries)) {
    const a = s.fixed ?? c.boosts?.[s.key]
    if (a) out[a] += out[a] < 18 ? 2 : 1
  }
  return out
}

// Within a group, boosting the same ability twice is not allowed
export function duplicateBoosts(c: Character, entries: ContentEntry[]) {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const s of boostSlots(c, entries)) {
    const a = s.fixed ?? c.boosts?.[s.key]
    if (!a) continue
    const id = `${s.group}:${a}`
    if (seen.has(id)) dupes.add(s.key)
    seen.add(id)
  }
  return dupes
}

// ---------- Feat slots ----------

export interface PlannedSlot { key: string; category: FeatSlotCategory; level: number; maxFeatLevel?: number; grantedBy?: string; grantedOrder?: string; grantedSkill?: string; grantedAncestry?: string; grantedFeat?: string; redundantFeat?: string }

const range = (from: number, to: number, step = 1) => {
  const out: number[] = []
  for (let n = from; n <= to; n += step) out.push(n)
  return out
}

// Standard progression; class-specific bonus feats go through extraSlots
const SLOT_RULES: { category: FeatSlotCategory; levels: number[] }[] = [
  { category: 'ancestry', levels: [1, 5, 9, 13, 17] },
  { category: 'class', levels: [1, ...range(2, 20, 2)] },
  { category: 'skill', levels: range(2, 20, 2) },
  { category: 'general', levels: [3, 7, 11, 15, 19] },
]

// Feats that hand out an extra feat; the slot appears while the granting feat is taken
export const GRANTED_SLOTS: Record<string, { category: FeatSlotCategory; level: number }> = {
  'General Training': { category: 'general', level: 1 },
  'Natural Ambition': { category: 'class', level: 1 },
  'Advanced General Training': { category: 'general', level: 7 },
  'Ancestral Paragon': { category: 'ancestry', level: 1 },
  'Multitalented': { category: 'archetype', level: 2 },
}

export const activeFeatsNamed = (c: Character, name: string) => c.feats.filter((feat) => feat.name === name && featTakenLevel(feat) <= c.level)
export const hasCyborgHeritage = (c: Character) => c.level >= 1 && c.systems.includes('sf2e') && c.heritage === 'Cyborg'
export const cyborgTestSubject = (c: Character) => hasCyborgHeritage(c) && getSettings().cyborgTestSubject
export const testSubjectAdaptation = (c: Character) =>
  cyborgTestSubject(c) ? 'Cybernetic Augmentation'
    : c.level >= 1 && c.systems.includes('sf2e') && c.ancestry === 'Ysoki' && c.heritage === 'Test-Subject Ysoki'
      ? c.testSubjectAdaptation : undefined
export function officerEducationSlots(c: Character) {
  let unslotted = 0
  return activeFeatsNamed(c, "Officer's Education").slice(0, 2).map(feat => ({
    key: `officer-education:${feat.slot ?? `unslotted-${unslotted++}`}`,
    level: featTakenLevel(feat),
  }))
}
export const SIGNIFER_SKILLS = ['Arcana', 'Nature', 'Occultism', 'Religion']
export function signiferExpertSlots(c: Character) {
  const feat = activeFeatsNamed(c, 'Hellknight Signifer Preferment')[0]
  return feat ? [{ key: `signifer-preferment:${feat.slot ?? 'unslotted'}`, level: featTakenLevel(feat), skills: SIGNIFER_SKILLS }] : []
}
export function augmentationLimit(c: Character) {
  const count = (name: string) => activeFeatsNamed(c, name).length
  return 4 + 4 * Number(hasCyborgHeritage(c)) + 2 * count('Augmented Shell') + count('Reconfigurable Frame')
    + count('Easily Augmented') * (c.heritage?.toLowerCase() === 'synthflesh verthani' ? 2 : 1)
    + 2 * (count('Augmented Dedication') + count('Augmented Perfection'))
    + count('Augmented Body') + count('Transgnomanist') + count('Augmented Dedication') + count('Adapted Augmentations')
}
export function augmentationLimitUsed(c: Character) {
  // Saved feat-specific slots now count as ordinary implants.
  return (c.augmentations ?? []).filter(item => !['apex', 'exempt'].includes(item.slot)).length
}
export function augmentationExemption(entry: ContentEntry) {
  if (entry.traits.some(trait => trait.toLowerCase() === 'apex')) return 'apex'
  return /\b(?:this|the) augmentation (?:doesn.t|does not) count (?:against|toward|towards) (?:your|the) (?:total )?implant limit\b/i.test(entry.description)
    ? 'exempt' : undefined
}
export function canInstallAugmentation(c: Character, entry: ContentEntry, slot: string) {
  if (entry.kind !== 'item' || entry.deleted || !entry.systems.includes('sf2e')
    || String(entry.data.item_category).toLowerCase() !== 'augmentations') return false
  if (augmentationExemption(entry)) return true
  return slot === 'standard' && augmentationLimitUsed(c) < augmentationLimit(c)
}
export function hardwoodShield(c: Character): OwnedShield | undefined {
  if (!hardwoodHasShield(c)) return undefined
  const increments = Math.floor((c.level - 1) / 3)
  const high = c.level >= 16
  return { id: 'granted-shield:hardwood', name: `Duskwood Shield (${high ? 'High' : 'Standard'}-Grade)`,
    hardness: Math.max(high ? 8 : 5, 3 + increments),
    hp: Math.max(high ? 32 : 20, 12 + 4 * increments),
    damage: c.hardwoodShield?.damage ?? 0, raised: !!c.hardwoodShield?.raised, equipped: c.hardwoodShield?.equipped, reinforcingRune: c.hardwoodShield?.reinforcingRune,
    attachedWeapon: c.hardwoodShield?.attachedWeapon }
}
export const SHIELD_RUNES = {
  Minor: { level: 4, hardness: 3, hp: 44, maxHardness: 8, maxHp: 64 },
  Lesser: { level: 7, hardness: 3, hp: 52, maxHardness: 10, maxHp: 80 },
  Moderate: { level: 10, hardness: 3, hp: 64, maxHardness: 13, maxHp: 104 },
  Greater: { level: 13, hardness: 5, hp: 80, maxHardness: 15, maxHp: 120 },
  Major: { level: 16, hardness: 5, hp: 84, maxHardness: 17, maxHp: 136 },
  Supreme: { level: 19, hardness: 7, hp: 108, maxHardness: 20, maxHp: 160 },
} as const
export function inventorBuckler(c: Character): OwnedShield | undefined {
  if (!getSettings().inventorArmorGauntlets || !ownedArmors(c, []).some(armor => armor.id === INVENTOR_ARMOR_ID && armor.worn)) return undefined
  const automatic = (Object.keys(SHIELD_RUNES) as (keyof typeof SHIELD_RUNES)[])
    .reverse().find(rank => SHIELD_RUNES[rank].level <= c.level)
  const installed = c.inventorBuckler?.reinforcingRune
  return { id: 'granted-shield:inventor', name: 'Gauntlet Buckler', hardness: 3, hp: 6,
    damage: c.inventorBuckler?.damage ?? 0, raised: !!c.inventorBuckler?.raised, equipped: c.inventorBuckler?.equipped,
    reinforcingRune: installed && (!automatic || SHIELD_RUNES[installed].level > SHIELD_RUNES[automatic].level) ? installed : automatic,
    attachedWeapon: c.inventorBuckler?.attachedWeapon }
}
export function ownedShields(c: Character): OwnedShield[] {
  return [c.shield, hardwoodShield(c), inventorBuckler(c)].filter((shield): shield is OwnedShield => !!shield)
}
export function shieldChange(c: Character, shield: OwnedShield,
  patch: Partial<Pick<OwnedShield, 'equipped' | 'raised' | 'damage' | 'reinforcingRune' | 'attachedWeapon'>>): Partial<Character> {
  if (shield.id === 'granted-shield:hardwood') return { hardwoodShield: { ...c.hardwoodShield, ...patch } }
  if (shield.id === 'granted-shield:inventor') return { inventorBuckler: { ...c.inventorBuckler, ...patch } }
  return { shield: { ...shield, ...patch } }
}
type ShieldStatsInput = Pick<OwnedShield, 'hardness' | 'hp' | 'material' | 'reinforcingRune'> & Partial<Pick<OwnedShield, 'id' | 'name'>>

export function shieldAllowsUpgrades(shield: { name?: string }) {
  return shield.name !== 'Scale of Igroon'
}

export function blessedShieldBenefit(c: Character, shield: ShieldStatsInput, entries: ContentEntry[] = []) {
  if (!championBlessings(c).includes('Blessed Shield') || !shield.id || equippedShield(c)?.id !== shield.id) return undefined
  const ranks = Object.keys(SHIELD_RUNES) as (keyof typeof SHIELD_RUNES)[]
  const appropriate = [...ranks].reverse().find(rank => SHIELD_RUNES[rank].level <= c.level) ?? 'Minor'
  const sturdy = /^Sturdy Shield(?: \((Minor|Lesser|Moderate|Greater|Major|Supreme)\))?$/i.exec(shield.name ?? '')
  const sturdyRank = sturdy && ranks.find(rank => rank.toLowerCase() === (sturdy[1] ?? 'Minor').toLowerCase())
  const sturdyLevel = sturdy ? byName(entries, 'item', shield.name)?.level ?? (sturdyRank && SHIELD_RUNES[sturdyRank].level) : undefined
  // Scale of Igroon matches a Supreme sturdy shield (20/160), so it always overlaps the blessing's rune.
  const overlap = !shieldAllowsUpgrades(shield) || shield.reinforcingRune === appropriate || sturdyLevel === SHIELD_RUNES[appropriate].level
  return { rune: overlap ? undefined : appropriate, hardness: overlap ? 1 : 0 }
}

export function shieldStats(shield: ShieldStatsInput, c?: Character, entries: ContentEntry[] = []) {
  const named = shield.name ? makeNamedShieldEntry(entries, shield.name) : undefined
  const material = shieldAllowsUpgrades(shield) ? shield.material : undefined
  const hardness = Math.max(material?.hardness ?? shield.hardness, num(named?.data.hardness))
  const hp = Math.max(material?.hp ?? shield.hp, num(named?.data.hp))
  const blessing = c && blessedShieldBenefit(c, shield, entries)
  const purchased = shieldAllowsUpgrades(shield) && shield.reinforcingRune && SHIELD_RUNES[shield.reinforcingRune]
  const granted = blessing?.rune && SHIELD_RUNES[blessing.rune]
  const rune = granted && (!purchased || granted.level > purchased.level) ? granted : purchased
  return {
    hardness: (rune ? Math.max(hardness, Math.min(hardness + rune.hardness, rune.maxHardness)) : hardness) + (blessing?.hardness ?? 0),
    hp: rune ? Math.max(hp, Math.min(hp + rune.hp, rune.maxHp)) : hp,
  }
}
export function shieldMaterialOptions(entries: ContentEntry[], shield: OwnedShield, systems: Character['systems']) {
  if (!shieldAllowsUpgrades(shield)) return []
  const type = /tower shield/i.test(shield.name) ? 'Tower Shield' : /buckler/i.test(shield.name) ? 'Buckler' : 'Shield'
  return entries.filter(entry => entry.kind === 'item' && !entry.deleted && entry.systems.some(system => systems.includes(system))
    && entry.data.item_subcategory === 'Precious Material Shields'
    && /^.+? (Tower Shield|Buckler|Shield) \((?:Low|Standard|High)-Grade\)$/.exec(entry.name)?.[1] === type)
    .sort((a, b) => a.name.localeCompare(b.name))
}
export function shieldMaterial(entry: ContentEntry): NonNullable<OwnedShield['material']> {
  const stats = /Hardness\s+(\d+).*?\bHP\s+(\d+)/i.exec(entry.description)
  return stats ? { name: entry.name, hardness: Number(stats[1]), hp: Number(stats[2]) } : { name: entry.name }
}
export function equippedShield(c: Character) {
  const generated = ownedShields(c).find(shield => shield.id !== c.shield?.id && (shield.equipped ?? !c.shield))
  return generated ? generated
    : c.shield?.equipped !== false ? c.shield : undefined
}
export function shieldEquipChange(c: Character, shield: OwnedShield, equipped: boolean): Partial<Character> {
  const previous = equippedShield(c)?.id
  const change: Partial<Character> = {}
  for (const current of [shield, ...ownedShields(c).filter(item => item.id !== shield.id)]) {
    const active = current.id === shield.id ? equipped : !equipped && current.id === previous
    Object.assign(change, shieldChange(c, current, { equipped: active, ...(!active ? { raised: false } : {}) }))
  }
  return change
}
export function shieldAcBonus(c: Character, entries: ContentEntry[]) {
  const shield = equippedShield(c)
  if (!shield) return 0
  const entry = entries.find(item => item.kind === 'shield' && (item.id === shield.id || item.name === shield.name))
  const bonus = num(entry?.data.ac)
  const normal = bonus > 0 ? bonus : isBucklerShield(shield.name) ? 1 : 2
  return isBucklerShield(shield.name) && normal === 1 && activeFeatsNamed(c, 'Elegant Buckler').length ? 2 : normal
}
export const isBucklerShield = (name: string) => /buckler/i.test(name)
export function shieldRaisedChange(c: Character, raised: boolean): Partial<Character> {
  const shield = equippedShield(c)
  if (!shield) return {}
  return shieldChange(c, shield, { raised })
}
export const shieldParagonActive = (c: Character) => !!equippedShield(c) && activeFeatsNamed(c, 'Shield Paragon').length > 0
export const shieldRaised = (c: Character) => !!equippedShield(c) && (!!equippedShield(c)?.raised || shieldParagonActive(c))
export const isFeatEffectActive = (c: Character, name: string) =>
  !!activeFeatsNamed(c, name).length && (!!c.activeFeatEffects?.includes(name)
    || name === 'Favored Terrain' && !!activeFeatsNamed(c, 'Terrain Master').length)

export function featEffectChange(c: Character, name: string, active: boolean) {
  return { activeFeatEffects: [...(c.activeFeatEffects ?? []).filter((effect) => effect !== name), ...(active ? [name] : [])] }
}
// House rules grant level-2 dedications in locked slots.
export const HOMEBREW_DEDICATIONS = [
  { setting: 'rangerSnarecrafter', className: 'Ranger', name: 'Snarecrafter Dedication', slot: 'archetype:2:g99', replacesFreeArchetype: true },
  { setting: 'championCavalier', className: 'Champion', name: 'Cavalier Dedication', slot: 'archetype:2:g98', replacesFreeArchetype: true },
  { setting: 'druidCavalier', className: 'Druid', name: 'Cavalier Dedication', slot: 'archetype:2:g97', replacesFreeArchetype: true },
  { setting: 'rangerCavalier', className: 'Ranger', name: 'Cavalier Dedication', slot: 'archetype:2:g96', replacesFreeArchetype: false },
  { setting: 'rangerBeastmaster', className: 'Ranger', name: 'Beastmaster Dedication', slot: 'archetype:2:g95', replacesFreeArchetype: false },
  { setting: 'championBeastmaster', className: 'Champion', name: 'Beastmaster Dedication', slot: 'archetype:2:g94', replacesFreeArchetype: true },
  { setting: 'commanderBeastmaster', className: 'Commander', name: 'Beastmaster Dedication', slot: 'archetype:2:g93', replacesFreeArchetype: true },
  { setting: 'druidBeastmaster', className: 'Druid', name: 'Beastmaster Dedication', slot: 'archetype:2:g92', replacesFreeArchetype: true },
] as const
export const homebrewDedication = (slot: string) => HOMEBREW_DEDICATIONS.find((d) => d.slot === slot)
export const activeHomebrewDedications = (c: Character) =>
  HOMEBREW_DEDICATIONS.filter((d) => getSettings()[d.setting] && c.className === d.className && c.level >= 2)
export const isGrantedSlot = (key: string) => /:g\d+$/.test(key) || key.startsWith('class:1:order-explorer:')
  || key.startsWith('skill:1:versatile-rogue:') || key.startsWith('skill:1:exceptional-artisan:')
  || key.startsWith('skill:1:mechanic-ingenuity:')
  || key.startsWith('archetype:1:eldritch-trickster:') || key.startsWith('general:1:officer-education:')
  || key.startsWith('general:1:social-chameleon:') || key.startsWith('ancestry:1:social-chameleon:')
  || key === 'general:1:direwolf-bonded' || key === 'skill:1:scholar' || key.startsWith('skill:1:background:')
  || key === TORAG_BOON_FEAT_SLOT || key.includes(':redundant:')

export const mechanicIngenuitySlots = (c: Character) =>
  c.className === 'Mechanic' && c.systems.includes('sf2e')
    ? [3, 7, 15].filter(level => level <= c.level).map(level => ({ key: `mechanic-ingenuity:${level}`, level }))
    : []

export function plannedSlots(c: Character, entries: ContentEntry[] = []): PlannedSlot[] {
  const base: FeatSlot[] = [
    ...SLOT_RULES.flatMap((r) => r.levels.map((level) => ({ category: r.category, level, count: 1 }))),
    ...(getSettings().freeArchetype ? [{ category: 'archetype' as const, levels: range(2, 20, 2) }].flatMap((r) => r.levels.map((level) => ({ category: r.category, level, count: level === 2 && activeHomebrewDedications(c).some(rule => rule.replacesFreeArchetype) ? 0 : 1 }))) : []),
    ...c.extraSlots,
  ]
  const slots: PlannedSlot[] = []
  const counters = new Map<string, number>()
  const groupOrder = new Map<string, number>()
  for (const s of base.filter((b) => b.level <= c.level)) {
    for (let i = 0; i < s.count; i++) {
      const id = `${s.category}:${s.level}`
      if (!groupOrder.has(id)) groupOrder.set(id, groupOrder.size)
      const n = counters.get(id) ?? 0
      counters.set(id, n + 1)
      slots.push({ key: `${id}:${n}`, category: s.category, level: s.level })
    }
  }
  if (c.background === 'Direwolf Bonded' && c.level >= 1) {
    if (!groupOrder.has('general:1')) groupOrder.set('general:1', groupOrder.size)
    slots.push({ key: 'general:1:direwolf-bonded', category: 'general', level: 1,
      grantedBy: 'Direwolf Bonded', grantedFeat: 'Canny Acumen' })
  }
  const background = byName(entries, 'background', c.background)
  if ((c.background === 'Scholar' || background?.data.background_base === 'Scholar') && c.level >= 1) {
    if (!groupOrder.has('skill:1')) groupOrder.set('skill:1', groupOrder.size)
    slots.push({ key: 'skill:1:scholar', category: 'skill', level: 1,
      grantedBy: c.background, grantedFeat: 'Assurance' })
  }
  if (background && c.level >= 1) {
    for (const name of tokens(background.data.feat)) {
      if (slots.some(slot => slot.grantedBy === c.background && slot.grantedFeat === name)) continue
      const feat = entries.find(entry => entry.kind === 'feat' && !entry.deleted && entry.name === name
        && entry.systems.some(system => c.systems.includes(system)))
      if (!['Assurance', 'Terrain Expertise'].includes(name) && feat?.data.repeatable !== true && !background.data[`background_choice_${name}`]) continue
      if (!groupOrder.has('skill:1')) groupOrder.set('skill:1', groupOrder.size)
      slots.push({ key: `skill:1:background:${encodeURIComponent(background.name)}:${encodeURIComponent(name)}`,
        category: 'skill', level: 1, grantedBy: background.name, grantedFeat: name })
    }
  }
  if (c.level >= 1 && hasDivineIntercession(c, 'Torag', 'moderate-boon')) {
    if (!groupOrder.has('ancestry:1')) groupOrder.set('ancestry:1', groupOrder.size)
    slots.push({ key: TORAG_BOON_FEAT_SLOT, category: 'ancestry', level: 1, maxFeatLevel: 1,
      grantedBy: 'Torag (Moderate Boon)', grantedAncestry: 'Dwarf' })
  }
  Object.entries(GRANTED_SLOTS).forEach(([name, g], i) => {
    const grantingFeat = c.feats.find((f) => f.name === name)
    if (!grantingFeat) return
    const limited = name === 'Advanced General Training' || name === 'Ancestral Paragon' || name === 'Multitalented' || name === 'Natural Ambition'
    const level = limited ? featTakenLevel(grantingFeat) : g.level
    if (level > c.level) return
    const id = `${g.category}:${name === 'Multitalented' ? level : g.level}`
    const group = `${g.category}:${level}`
    if (!groupOrder.has(group)) groupOrder.set(group, groupOrder.size)
    // Keep saved granted-feat selections attached to their original slot key.
    slots.push({ key: `${id}:g${i}`, category: g.category, level, ...(limited ? { maxFeatLevel: g.level } : {}),
      ...(name === 'Multitalented' ? { grantedBy: name } : {}) })
  })
  let unslottedExplorer = 0
  for (const feat of c.feats) {
    if (feat.name !== 'Order Explorer') continue
    const identity = feat.slot ?? `unslotted-${unslottedExplorer++}`
    const level = featTakenLevel(feat)
    const order = normalizeDruidOrder(feat.choice)
    if (c.className !== 'Druid' || level > c.level || !order || !Object.hasOwn(DRUID_ORDERS, order)) continue
    const group = `class:${level}`
    if (!groupOrder.has(group)) groupOrder.set(group, groupOrder.size)
    slots.push({ key: `class:1:order-explorer:${identity}`, category: 'class', level, maxFeatLevel: 1,
      grantedBy: 'Order Explorer', grantedOrder: order })
  }
  for (const grant of officerEducationSlots(c)) {
    const group = `general:${grant.level}`
    if (!groupOrder.has(group)) groupOrder.set(group, groupOrder.size)
    slots.push({ key: `general:1:${grant.key}`, category: 'general', level: grant.level, grantedBy: "Officer's Education" })
  }
  for (const grant of mechanicIngenuitySlots(c)) {
    const group = `skill:${grant.level}`
    if (!groupOrder.has(group)) groupOrder.set(group, groupOrder.size)
    slots.push({ key: `skill:1:${grant.key}`, category: 'skill', level: grant.level, grantedBy: "Mechanic's Ingenuity" })
  }
  let unslottedChameleon = 0
  for (const feat of activeFeatsNamed(c, 'Social Chameleon')) {
    const identity = feat.slot ?? `unslotted-${unslottedChameleon++}`
    const level = featTakenLevel(feat)
    const generalKey = `general:1:social-chameleon:${identity}`
    const adopted = c.feats.find(feat => feat.slot === generalKey && feat.name === 'Adopted Ancestry')
    for (const category of ['general', 'ancestry'] as const) {
      const group = `${category}:${level}`
      if (!groupOrder.has(group)) groupOrder.set(group, groupOrder.size)
      slots.push({ key: `${category}:1:social-chameleon:${identity}`, category, level, maxFeatLevel: 1,
        grantedBy: 'Social Chameleon', ...(category === 'ancestry' ? { grantedAncestry: adopted?.choice } : {}) })
    }
  }
  for (const feat of c.feats) {
    if (feat.name !== 'Exceptional Artisan' || !feat.choice || featTakenLevel(feat) > c.level) continue
    const level = featTakenLevel(feat)
    const group = `skill:${level}`
    if (!groupOrder.has(group)) groupOrder.set(group, groupOrder.size)
    slots.push({ key: `skill:1:exceptional-artisan:${feat.slot ?? 'unslotted'}`, category: 'skill', level,
      grantedBy: 'Exceptional Artisan', grantedSkill: feat.choice })
  }
  let unslottedRogue = 0
  const takenRackets = new Set([selectedSubclass(c)])
  for (const feat of [...c.feats].sort((a, b) => featTakenLevel(a) - featTakenLevel(b))) {
    if (feat.name !== 'Versatile Rogue') continue
    const identity = feat.slot ?? `unslotted-${unslottedRogue++}`
    const level = featTakenLevel(feat)
    if (c.className !== 'Rogue' || level > c.level || !feat.choice || takenRackets.has(feat.choice)
      || !ROGUE_RACKETS.some(racket => racket === feat.choice)) continue
    takenRackets.add(feat.choice)
    const group = `skill:${level}`
    if (!groupOrder.has(group)) groupOrder.set(group, groupOrder.size)
    slots.push({ key: `skill:1:versatile-rogue:${identity}`, category: 'skill', level, grantedBy: 'Versatile Rogue' })
    if (feat.choice === 'Eldritch Trickster') {
      if (!groupOrder.has(`archetype:${level}`)) groupOrder.set(`archetype:${level}`, groupOrder.size)
      slots.push({ key: `archetype:1:eldritch-trickster:${identity}`, category: 'archetype', level,
        maxFeatLevel: 2, grantedBy: 'Eldritch Trickster' })
    }
  }
  if (c.className === 'Rogue' && c.level >= 1 && selectedSubclass(c) === 'Eldritch Trickster') {
    if (!groupOrder.has('archetype:1')) groupOrder.set('archetype:1', groupOrder.size)
    slots.push({ key: 'archetype:1:eldritch-trickster:primary', category: 'archetype', level: 1,
      maxFeatLevel: 2, grantedBy: 'Eldritch Trickster' })
  }
  for (const d of activeHomebrewDedications(c)) {
    if (!groupOrder.has('archetype:2')) groupOrder.set('archetype:2', groupOrder.size)
    slots.push({ key: d.slot, category: 'archetype', level: 2 })
  }
  for (const slot of redundantFeatSlots(c, entries, slots)) {
    const group = `${slot.category}:${slot.level}`
    if (!groupOrder.has(group)) groupOrder.set(group, groupOrder.size)
    slots.push(slot)
  }
  const visible = slots.filter((slot) => !c.dismissedFeatSlots?.includes(slot.key) || homebrewDedication(slot.key) || !!slot.grantedFeat || !!slot.redundantFeat
    || slot.grantedBy === 'Versatile Rogue' || slot.grantedBy === 'Eldritch Trickster' || slot.grantedBy === 'Order Explorer'
    || slot.grantedBy === "Officer's Education" || slot.grantedBy === "Mechanic's Ingenuity" || slot.grantedBy === 'Social Chameleon' || !!slot.grantedAncestry)
  for (const slot of slots) {
    if (!visible.some((other) => other.category === slot.category && other.level === slot.level)) visible.push(slot)
  }
  return visible.sort((a, b) => a.level - b.level
    || (groupOrder.get(`${a.category}:${a.level}`) ?? 0) - (groupOrder.get(`${b.category}:${b.level}`) ?? 0))
}

function redundantFeatSlots(c: Character, entries: ContentEntry[], slots: PlannedSlot[]): PlannedSlot[] {
  if (!entries.length) return []
  // Replacement selections grant their normal benefits, but cannot create more replacement slots.
  const character = { ...c, feats: c.feats.filter(feat => !feat.slot?.includes(':redundant:')) }
  const background = entries.find(entry => entry.kind === 'background' && !entry.deleted && entry.name === c.background
    && entry.systems.some(system => c.systems.includes(system)))
  const fixedSlots = new Set(slots.filter(slot => slot.grantedFeat).map(slot => slot.key))
  const counts = new Map<string, number>()
  const grants = automaticFeatGrants(character, entries).map(grant => {
    const identity = `${grant.source}:${grant.level}:${grant.name}:${grant.choice ?? ''}`
    const index = counts.get(identity) ?? 0
    counts.set(identity, index + 1)
    return { ...grant, identity: `grant:${identity}:${index}`, granted: true }
  })
  const occurrences = [
    ...character.feats.filter(feat => !feat.slot || !fixedSlots.has(feat.slot)).map((feat, index) => ({
      name: feat.name, source: feat.name, level: featTakenLevel(feat),
      identity: `selection:${feat.slot ?? index}`, granted: false,
    })),
    ...[...new Set(tokens(background?.data.feat))].map(name => ({
      name, source: background!.name, level: 1, identity: `background:${background!.id}:${name}`, granted: true,
    })),
    ...grants,
  ].filter(feat => feat.level <= c.level)
    .sort((a, b) => a.level - b.level || Number(a.granted) - Number(b.granted) || a.identity.localeCompare(b.identity))
  const feats = featByName(entries)
  const seen = new Set<string>()
  const replacements: PlannedSlot[] = []
  for (const occurrence of occurrences) {
    const feat = feats.get(occurrence.name)
    if (!feat || feat.deleted || !feat.systems.some(system => c.systems.includes(system)) || feat.data.repeatable === true) continue
    const type = featType(feat, c)
    const category = type === 'Skill Feat' ? 'skill' : type === 'General Feat' ? 'general' : undefined
    if (!category) continue
    if (seen.has(feat.name) && occurrence.granted) replacements.push({
      key: `${category}:${occurrence.level}:redundant:${encodeURIComponent(occurrence.identity)}`,
      category, level: occurrence.level, grantedBy: occurrence.source, redundantFeat: feat.name,
    })
    seen.add(feat.name)
  }
  return replacements
}

const archetypesOf = (e?: ContentEntry): string[] => {
  const a = e?.data.archetype
  return (Array.isArray(a) ? a : typeof a === 'string' ? a.split(',') : [])
    .flatMap((name) => typeof name === 'string' && name.trim() ? [name.trim()] : [])
}
const isDedication = (e?: ContentEntry) => !!e?.traits.some((t) => t.toLowerCase() === 'dedication')

// Archetype rules: other archetype feats need that archetype's Dedication, and a new Dedication needs
// two other feats from every Dedication already taken
function archetypePrerequisites(c: Character, entries: ContentEntry[], slotKey: string, asArchetype: boolean, ignoreDedicationLock = false) {
  const taken = c.feats.filter((f) => f.slot !== slotKey).flatMap((f) => {
    const entry = byName(entries, 'feat', f.name)
    return entry && archetypesOf(entry).length ? [{ entry, feat: f }] : []
  })
  const dedications = taken.filter(({ entry }) => isDedication(entry))
  const exemptSlots = new Set<string>(activeHomebrewDedications(c).map(rule => rule.slot))
  let availableDedications: ContentEntry[] | undefined
  return (e: ContentEntry) => {
    const archetypes = archetypesOf(e)
    if (!archetypes.length || !asArchetype && !e.traits.some((t) => t.toLowerCase() === 'archetype')) return []
    const shares = (entry: ContentEntry, names = archetypes) => archetypesOf(entry).some((name) => names.includes(name))
    if (!isDedication(e)) {
      if (dedications.some(({ entry }) => shares(entry))) return []
      availableDedications ??= entries.filter((entry) => entry.kind === 'feat' && !entry.deleted && isDedication(entry))
      const names = [...new Set(availableDedications.filter((dedication) => shares(dedication)).map((dedication) => dedication.name))]
      return [names.length ? names.join(' or ') : `${archetypes.join(' or ')} Dedication`]
    }
    if (ignoreDedicationLock) return []
    return dedications.flatMap(({ entry: dedication, feat }) => {
      if (shares(dedication)) return []
      if (feat.slot && exemptSlots.has(feat.slot) && homebrewDedication(feat.slot)?.name === feat.name) return []
      const needed = 2 - taken.filter(({ entry }) => !isDedication(entry) && shares(entry, archetypesOf(dedication))).length
      return needed > 0 ? [`${needed} more ${archetypesOf(dedication).join(' or ')} archetype feat${needed === 1 ? '' : 's'} before another dedication`] : []
    })
  }
}

// Feats sitting in a slot that no longer exists at the current level (e.g. a Free Archetype slot taken over by a
// house rule). Slots above the character's level are kept so lowering the level is reversible.
export function unslottedFeats(c: Character, entries: ContentEntry[] = []) {
  const keys = new Set(plannedSlots(c, entries).map((s) => s.key))
  return c.feats.filter((f) => f.slot && !keys.has(f.slot) && featTakenLevel(f) <= c.level)
}

// Archetype feats whose archetype's Dedication isn't taken (e.g. the Dedication was removed or never picked)
export function orphanedArchetypeFeats(c: Character, entries: ContentEntry[]) {
  const info = c.feats.map(f => ({ f, sources: featPrerequisiteSources(entries, {
    ...c, name: f.name, category: f.slot?.split(':')[0] ?? f.type.toLowerCase().split(' ')[0],
    ancestryTraits: ancestryFeatTraits(c),
  }) }))
  const dedications = new Set(info.flatMap(({ sources }) => sources.flatMap(e => isDedication(e) ? archetypesOf(e) : [])))
  return info.filter(({ f, sources }) => sources.length > 0 && sources.every(e => !isDedication(e) && archetypesOf(e).length
    && (e.traits.some(t => t.toLowerCase() === 'archetype') || f.slot?.startsWith('archetype:'))
    && !archetypesOf(e).some(name => dedications.has(name))))
    .map(({ f }) => f)
}

// Feats only, with lowercased traits, cached per entries array so each picker render skips the full scan
const featNameCache = new WeakMap<ContentEntry[], Map<string, ContentEntry>>()
export function featByName(entries: ContentEntry[]) {
  let map = featNameCache.get(entries)
  if (!map) {
    map = new Map()
    for (const e of entries) if (e.kind === 'feat' && !map.has(e.name)) map.set(e.name, e)
    const jousting = map.get('Living Weapon Jousting')
    if (jousting && !map.has('Living Weapon Joust')) map.set('Living Weapon Joust', jousting)
    featNameCache.set(entries, map)
  }
  return map
}
// Verified shared rules; these core-book copies differ in prose, examples, or cross-references.
const SHARED_SKILL_FEATS: Readonly<Record<string, string>> = Object.fromEntries([
  [5119, '761-arcane-sense'], [5123, '766-bargain-hunter'], [6472, '2679-dirty-trick'],
  [5193, '859-quick-coercion'], [5195, '861-quick-identification'], [3495, '1043-stitch-flesh'],
  [5221, '891-survey-wildlife'], [5228, '900-train-animal'], [5229, '901-trick-magic-item'],
  [5235, '907-virtuosic-performer'], [5122, '765-automatic-knowledge'], [5135, '780-communal-crafting'],
  [5136, '781-confabulator'], [5178, '839-magical-crafting'], [5179, '2688-magical-shorthand'],
  [5207, '875-robust-recovery'], [6459, '2669-aerobatics-mastery'], [5151, '808-foil-senses'],
  [5211, '880-shameless-request'], [5167, '827-legendary-codebreaker'], [5171, '831-legendary-performer'],
  [5172, '832-legendary-professional'], [5173, '833-legendary-sneak'], [5231, '902-unified-theory'],
].flatMap(([pf, sf]) => [[`aon:pf2e:feat-${pf}`, `shared:${sf}`], [`aon:sf2e:feats--${sf}`, `shared:${sf}`]]))

function featEquivalence(entry: ContentEntry, ancestries: Set<string>) {
  const sharedSkill = entry.source === 'official' && entry.traits.some(trait => trait.toLowerCase() === 'skill')
  const sharedRules = sharedSkill ? SHARED_SKILL_FEATS[entry.id] : undefined
  const normalize = (text: string) => text.toLowerCase().replace(/[\u2019\u2018]/g, "'").replace(/\s+/g, ' ').trim()
  const rules = (sharedSkill ? entry.comparisonRules ?? entry.description : entry.description).split(/\n\s*---\s*\n/).at(-1)!.toLowerCase()
    .replace(/[\u2019\u2018]/g, "'").replace(/\b(you|they|we)'ve\b/g, '$1 have').replace(/\b(you|they|we)'re\b/g, '$1 are')
    .replace(/\bthat's\b/g, 'that is').replace(/\(such as [^)]*\)/g, '').replace(/\b[^.\n]* leads to\.\.\.[\s\S]*$/, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()
  const data = Object.entries(entry.data).filter(([key]) => !['url', 'sourceBook'].includes(key))
    .map(([key, value]) => {
      if (!sharedSkill || typeof value !== 'string') return [key, value] as const
      let normalized = normalize(value)
      if (key === 'skill') normalized = [...new Set(value.split(',').map(normalize))].sort().join(', ')
      if (key === 'prerequisite') {
        normalized = normalized.replace(/;/g, ',')
        const rank = /^(trained|expert|master|legendary) in /.exec(normalized)?.[0]
        if (rank) normalized = normalized.replace(new RegExp(`(, |\\bor )${rank}`, 'g'), '$1')
      }
      return [key, normalized] as const
    }).sort(([a], [b]) => a.localeCompare(b))
  const traits = [...new Set(entry.traits.map(trait => trait.toLowerCase())
    .filter(trait => trait !== 'ancestry' && !ancestries.has(trait)
      && !(sharedRules && entry.name === 'Train Animal' && ['downtime', 'manipulate'].includes(trait))))].sort()
  return JSON.stringify([entry.source, entry.name.toLowerCase(), entry.level, traits, data, sharedRules ?? rules, entry.effects, entry.spellGrants ?? []])
}

const featIndexCache = new WeakMap<ContentEntry[], { entry: ContentEntry; traits: Set<string>; equivalence: string }[]>()
function featIndex(entries: ContentEntry[]) {
  let index = featIndexCache.get(entries)
  if (!index) {
    const ancestries = new Set(entries.filter(entry => ['ancestry', 'heritage'].includes(entry.kind)).map(entry => entry.name.toLowerCase()))
    index = entries.filter((e) => e.kind === 'feat' && !e.deleted).sort((a, b) => a.level - b.level || featDisplayName(a).localeCompare(featDisplayName(b))).map((entry) =>
      ({ entry, traits: new Set(entry.traits.map((t) => t.toLowerCase())), equivalence: featEquivalence(entry, ancestries) }))
    featIndexCache.set(entries, index)
  }
  return index
}

export function featSelectionLevel(entry: ContentEntry, c: Character, entries: ContentEntry[], category: FeatSlotCategory,
  slot?: { key: string; level: number }) {
  if (entry.name === 'Ancestral Magic' && category === 'ancestry' && slot) {
    return slot.level >= 17 ? 17 : slot.level >= 13 ? 13 : slot.level >= 9 ? 9 : entry.level
  }
  if (entry.name === 'Ubiquitous Gadgets' && category === 'class' && slot && slot.level >= 14
    && c.feats.filter(feat => feat.name === entry.name && feat.slot !== slot.key && featTakenLevel(feat) <= slot.level).length === 1) return 14
  if (category !== 'archetype' || typeof entry.data.archetype_levels !== 'string') return entry.level
  const dedications = new Set(c.feats.flatMap((feat) => {
    const content = featByName(entries).get(feat.name)
    return isDedication(content) ? archetypesOf(content) : []
  }))
  const levels = new Map(entry.data.archetype_levels.split(', ').map((pair) => {
    const colon = pair.lastIndexOf(':')
    return [pair.slice(0, colon), Number(pair.slice(colon + 1))] as const
  }))
  const available = archetypesOf(entry).filter((name) => dedications.has(name)).map((name) => levels.get(name) ?? entry.level)
  return available.length ? Math.min(...available) : entry.level
}

const EXCLUSIVE_FEAT_GROUPS = [['Chiardmar Steed', 'Nidarrmar Steed'],
  ['Hellknight Preferment', 'Hellknight Signifer Preferment', 'Hellknight-Errant']]
const CYBORG_HEART_FEATS = ['Machine Heart', 'Mortal Heart']
const MECHANIC_EXOCORTEXES = ['Drone', 'Mine', 'Turret']

function mechanicExocortexes(c: Character) {
  if (c.className !== 'Mechanic') return []
  const primary = MECHANIC_EXOCORTEXES.find(name => name.toLowerCase() === c.subclass?.toLowerCase())
  const choices = primary ? [primary] : []
  const experimenter = activeFeatsNamed(c, 'Exocortex Experimenter')
    .filter(feat => featTakenLevel(feat) >= 6).sort((a, b) => featTakenLevel(a) - featTakenLevel(b))
  for (const feat of experimenter) {
    if (choices.length >= 3 || choices.length >= 2 && featTakenLevel(feat) < 12) continue
    const choice = MECHANIC_EXOCORTEXES.find(name => name.toLowerCase() === feat.choice?.toLowerCase())
    if (primary && choice && !choices.includes(choice)) choices.push(choice)
  }
  return choices
}

export function featPrerequisiteChecker(c: Character, entries: ContentEntry[], level = c.level, excludedIndex = -1,
  options: { ignoreAttributePrerequisites?: boolean; planSkillPrerequisites?: boolean } = {}) {
  const facts = new Map<number, PrerequisiteFacts>()
  let buildSkillRanks: PrerequisiteFacts['ranks'] | undefined
  return createFeatPrerequisiteChecker(entries, {
    level: Math.min(c.level, level), entryIds: c.entryIds, knownOrders: Object.keys(DRUID_ORDERS), ...options,
    facts: (atLevel) => {
      const cached = facts.get(atLevel)
      if (cached) return cached
      const character = { ...c, level: Math.min(c.level, atLevel),
        feats: c.feats.filter((feat, index) => index !== excludedIndex && featTakenLevel(feat) <= Math.min(c.level, atLevel)) }
      if (character.boosts) character.abilities = computeAbilities(character, entries)
      let ranks: PrerequisiteFacts['ranks'] | undefined
      let armor: PrerequisiteFacts['armor'] | undefined
      let weapons: PrerequisiteFacts['weapons'] | undefined
      let senseValues: PrerequisiteFacts['senses'] | undefined
      let featureNames: PrerequisiteFacts['features'] | undefined
      let wardenSpells: string[] | undefined
      let focus: ReturnType<typeof focusSpells> | undefined
      let innateGrants: ReturnType<typeof grantedFeatSpells> | undefined
      let casting: boolean | undefined
      let hasFocusPool: boolean | undefined
      const getFocus = () => focus ??= focusSpells(character, entries)
      const getInnateGrants = () => innateGrants ??= grantedFeatSpells(character, entries).filter(grant => grant.rule.kind === 'innate')
      const subclass = selectedSubclass(character, entries)
      const additionalSubclasses = character.feats.flatMap((feat) => feat.choice && (
        character.className === 'Bard' && feat.name === 'Multifarious Muse'
        || character.className === 'Inventor' && ['Second Innovation', 'Third Innovation'].includes(feat.name)
        || character.className === 'Rogue' && feat.name === 'Versatile Rogue' && ROGUE_RACKETS.some(racket => racket === feat.choice)
      ) ? [feat.choice] : [])
      const museFeats = character.className === 'Bard' ? [subclass, ...additionalSubclasses].flatMap((name) => {
        const muse = entries.find((entry) => entry.kind === 'subclass' && entry.data.class === 'Bard' && entry.name === name)
        const feat = /\bMuse Feat\s+(.+?)(?:\s+Muse Spell|$)/i.exec(muse?.description ?? '')?.[1].trim()
        return feat ? [feat] : []
      }) : []
      const features = classFeatures(entries, character)
      const value: PrerequisiteFacts = {
        className: character.className, ancestry: character.ancestry, heritage: character.heritage, ethnicity: character.ethnicity,
        heritages: characterHeritages(character, entries).map(heritage => heritage.name),
        ancestryTraits: ancestryFeatTraits(character),
        subclass, additionalSubclasses, exocortexes: mechanicExocortexes(character),
        orders: character.className === 'Druid' ? [
          character.order ?? subclass ?? '',
          ...character.feats.flatMap((feat) => feat.name === 'Order Explorer' && feat.choice ? [feat.choice] : []),
        ] : [],
        feats: character.feats.map((feat) => ({
          name: feat.name, level: featTakenLevel(feat),
          category: feat.slot?.split(':')[0] ?? feat.type.replace(/ Feat$/, '').toLowerCase(),
        })),
        get features() { return featureNames ??= [...features.map((feature) => feature.name), ...museFeats,
          ...automaticFeatGrants(character, entries).map((feat) => feat.name),
          ...tokens(byName(entries, 'background', character.background)?.data.feat),
          ...(character.className === 'Druid' && (character.order ?? subclass) === 'Animal' ? ['Animal Companion'] : []),
          ...(character.companions?.length ? ['an animal companion'] : []),
        ] },
        get ranks() { return ranks ??= { ...Object.fromEntries(statDefs(character).map((stat) => [stat.name, 0])), ...ranksAt(character, entries) } },
        get buildSkillRanks() {
          if (!options.planSkillPrerequisites) return undefined
          if (!buildSkillRanks) {
            const build = { ...c, feats: c.feats.filter((_feat, index) => index !== excludedIndex) }
            if (build.boosts) build.abilities = computeAbilities(build, entries)
            buildSkillRanks = { ...Object.fromEntries(statDefs(build).map(stat => [stat.name, 0])), ...ranksAt(build, entries) }
          }
          return buildSkillRanks
        },
        get armor() { return armor ??= armorRanks(character, entries) },
        get weapons() { return weapons ??= weaponRanks(character, entries) },
        weaponRank: name => weaponEntry(entries, name) ? weaponAttack(character, entries,
          { id: 'prerequisite', name, potency: 0, striking: 0, runes: [] }).rank : undefined,
        abilities: character.abilities,
        // Prerequisites describe available capabilities, not the current combat toggle.
        get senses() { return senseValues ??= senses({ ...character, raging: true }, entries).map((sense) => sense.value) },
        get spellcastingClassFeature() {
          return casting ??= !!classSpellcasting(character, entries)?.traditions.length
            || features.some(feature => /^(?!(?:expert|master|legendary) )[\w &'’-]+ spellcasting$/i.test(feature.name))
        },
        get classFocusSpells() {
          const focus = getFocus()
          return character.className === 'Champion' && focus.points > 0
            || features.some(feature => /\byou (?:start with|gain) a focus pool\b/i.test(feature.description))
            || character.feats.some(feat => (feat.slot?.startsWith('class:') || !feat.slot && feat.type === 'Class Feat')
              && (focus.spells.some(spell => spell.source === feat.name)
                || hasWardenChoice(feat) && grantedWardenSpells({ ...character, feats: [feat] }, entries).length > 0))
        },
        get maxSpellRank() {
          return Math.max(value.spellcastingClassFeature ? Math.ceil(character.level / 2) : 0,
            ...getInnateGrants().filter(grant => !grant.entry.traits.some(trait => trait.toLowerCase() === 'cantrip'))
              .map(grant => grant.rank), 0)
        },
        get focusPool() {
          return hasFocusPool ??= getFocus().points > 0
            || features.some(feature => /\byou (?:start with|gain) a focus pool\b/i.test(feature.description))
        },
        get canCastSpells() { return !!(value.spellcastingClassFeature || value.focusPool || character.spells?.length) },
        get untamedForm() { return knowsSpell(character, entries, 'Untamed Form') },
        championBlessings: championBlessings(character),
        sanctification: character.className === 'Champion' && byName(entries, 'deity', character.deity)?.data.sanctification
          ? deitySanctification(character, entries).selected ?? 'None' : undefined,
        deityAlignment: character.deity
          ? String(byName(entries, 'deity', character.deity)?.data.alignment ?? '') || undefined : 'None',
        legacyTenetsOfGood: character.className === 'Champion' && !!character.legacyTenetsOfGood,
        get devotionSpells() { return getFocus().spells.map(spell => spell.name) },
        championReaction: character.className === 'Champion' && ['Justice', 'Grandeur', 'Liberation', 'Redemption'].includes(subclass ?? '')
          ? 'protective' : character.className === 'Champion' && ['Desecration', 'Iniquity', 'Obedience'].includes(subclass ?? '')
            ? 'offensive' : undefined,
        familiar: character.className === 'Witch' || character.feats.some(feat => ['Familiar', 'Leshy Familiar', 'Animal Accomplice'].includes(feat.name))
          || hasDivineIntercession(character, 'Calistria', 'moderate-boon'),
        get primalInnateSpell() { return getInnateGrants().some(grant => grant.rule.tradition?.toLowerCase() === 'primal') },
        limitedTelepathy: character.systems.includes('sf2e') && (['Lashunta', 'Shirren', 'Formian', 'Orocoran', 'Urog', 'Worlanisi'].includes(character.ancestry ?? '')
          || character.heritage === 'Asanan Elf' || testSubjectAdaptation(character) === 'Psychic Augmentation')
          || features.some(feature => /\blimited telepathy\b/i.test(`${feature.name} ${feature.description}`))
          || character.feats.some(feat => /\byou (?:gain|have) limited telepathy\b/i.test(byName(entries, 'feat', feat.name)?.description ?? '')),
        constructCompanion: character.className === 'Inventor' && /^construct(?: innovation)?$/i.test(subclass ?? '')
          || character.feats.some(feat => ['Inventor Dedication', 'Second Innovation', 'Third Innovation'].includes(feat.name)
            && /^construct(?: innovation)?$/i.test(feat.choice ?? '')),
        companionTypes: character.companions?.map(companion => companion.type) ?? [],
        get wardenSpells() { return wardenSpells ??= [...new Set([...grantedWardenSpells(character, entries).map(spell => spell.name),
          ...getFocus().spells.filter(spell => {
            const entry = byName(entries, 'spell', spell.name)
            return entry && wardenTierOf(entry)
          }).map(spell => spell.name)])] },
      }
      facts.set(atLevel, value)
      return value
    },
  })
}

export function featSelectionPrerequisiteChecker(c: Character, entries: ContentEntry[], slot: PlannedSlot) {
  const excludedIndex = c.feats.findIndex((feat) => feat.slot === slot.key)
  const level = Math.min(c.level, slot.level)
  const character = { ...c, level, feats: c.feats.filter((feat, index) => index !== excludedIndex && featTakenLevel(feat) <= level) }
  const multitalented = slot.grantedBy === 'Multitalented'
  const check = featPrerequisiteChecker(c, entries, level, excludedIndex, {
    ignoreAttributePrerequisites: multitalented && c.heritage?.trim().toLowerCase() === 'aiuvarin',
    planSkillPrerequisites: getSettings().planSkillPrerequisites,
  })
  const archetype = archetypePrerequisites(character, entries, slot.key, slot.category === 'archetype', multitalented)
  const requirements: Record<string, string[]> = {
    'Third Blessing': ['Second Blessing'], 'Third Innovation': ['Second Innovation'],
    'Pristine Living Weapon': ['Living Weapon', 'Wild Hunter Dedication'],
  }
  return (entry: ContentEntry) => {
    const result = check(entry)
    const missing = [...result.missing, ...archetype(entry),
      ...(requirements[entry.name] ?? []).filter((name) => !character.feats.some((feat) => feat.name === name))]
    for (const group of EXCLUSIVE_FEAT_GROUPS) {
      if (!group.includes(entry.name)) continue
      const other = character.feats.find(feat => feat.name !== entry.name && group.includes(feat.name))
      if (other) missing.push(`${entry.name} cannot be combined with ${other.name}`)
    }
    if (ORDER_TRAINING_FEATS.includes(entry.name)) {
      const selected = c.feats.find(feat => feat.slot === slot.key && feat.name === entry.name)
      const choices = orderTrainingChoices(character, entry.name)
      if (entry.name !== 'Order Cross-Training' && !hellknightTrainingBenefit(character, entry.name)) {
        missing.push('a Hellknight order with a published order benefit')
      } else if (entry.name === 'Order Cross-Training' && selected?.choice && !choices?.includes(selected.choice)) {
        missing.push('a different unused Hellknight order')
      }
    }
    if (/^Side by Side(?: \(|$)/.test(entry.name) && archetypesOf(entry).includes('Beastmaster')
      && character.feats.some(feat => feat.name === 'Beastmaster Dedication')) {
      for (let i = missing.length - 1; i >= 0; i--) if (missing[i] === 'Animal Companion') missing.splice(i, 1)
    }
    const companionRequirement = beastmasterRequirementMissing(character, entries, entry.name)
    if (companionRequirement) missing.push(companionRequirement)
    if (getSettings().singleAnimalCompanion && ['Lead the Pack', 'Pack Takedown'].includes(entry.name)) {
      missing.push('Disable Multiple Animal Companions must be disabled')
    }
    if (getSettings().singleAnimalCompanion
      && ['Incredible Beastmaster Companion', 'Incredible Mount', 'Specialized Beastmaster Companion', 'Specialized Mount'].includes(entry.name)) {
      const advancement = companionAdvancement(character)
      const required = entry.name === 'Incredible Beastmaster Companion' ? 'Mature Beastmaster Companion'
        : entry.name === 'Incredible Mount' ? 'Impressive Mount'
          : entry.name === 'Specialized Beastmaster Companion' ? 'Incredible Beastmaster Companion' : 'Incredible Mount'
      if (entry.name.startsWith('Incredible') ? advancement.mature : advancement.advanced) {
        for (let i = missing.length - 1; i >= 0; i--) if (missing[i] === required) missing.splice(i, 1)
      }
    }
    if (getSettings().singleAdditionalArms && entry.name === 'Additional Arms'
      && character.feats.some(feat => feat.name === entry.name)) {
      missing.push('Additional Arms can only be selected once (house rule)')
    }
    if (getSettings().exclusiveCyborgHearts && CYBORG_HEART_FEATS.includes(entry.name)) {
      const other = CYBORG_HEART_FEATS.find(name => name !== entry.name && character.feats.some(feat => feat.name === name))
      if (other) missing.push(`${entry.name} cannot be combined with ${other} (house rule)`)
    }
    if (entry.name === 'Enhanced Senses') {
      const heritage = /\bOption\(s\):\s*([\w '-]+?) heritage only\b/i.exec(entry.description)?.[1]
      if (heritage && ![heritage.toLowerCase(), `${heritage} ${character.ancestry}`.toLowerCase()]
        .includes(character.heritage?.toLowerCase() ?? '')) missing.push(`${heritage} heritage`)
    }
    if (multitalented && entry.name === `${character.className} Dedication`) missing.push("a multiclass dedication outside your current class")
    let manual = result.manual.filter((requirement) => !(requirements[entry.name] ?? [])
      .some((name) => name.toLowerCase() === requirement.toLowerCase()))
    if (BEASTMASTER_FEATS[entry.name]) manual = manual.filter(requirement => !/^animal companion\b/i.test(requirement))
    if (['Chiardmar Steed', 'Nidarrmar Steed'].includes(entry.name)) {
      if (!character.companions?.some((companion) => companion.type === 'Horse')) missing.push('horse animal companion')
      manual = manual.filter((requirement) => !/^horse animal companion$/i.test(requirement))
    }
    if (entry.name === 'Deadly Simplicity') {
      if (![...entries, ...SUPPLEMENTAL_WEAPONS].some((weapon) => weapon.kind === 'weapon' && !weapon.deleted
        && isDeadlySimplicityWeapon(character, entries, weapon))) missing.push('a deity with a qualifying simple or unarmed favored weapon')
      manual = manual.filter((requirement) => !/^(?:deity with a simple or unarmed attack favored weapon|trained with your deity's favored weapon)$/i.test(requirement))
    }
    return { missing: [...new Set(missing)], manual }
  }
}

// Companion archetypes offer abilities the character may already have from another source.
function duplicatesOwnedAbility(c: Character, entries: ContentEntry[], entry: ContentEntry, slot: PlannedSlot) {
  if (c.feats.some(feat => feat.slot === slot.key && feat.name === entry.name)) return false
  const base = (name: string) => name.replace(/\s*\([^)]*\)$/, '')
  const level = Math.min(c.level, slot.level)
  const owned = [...c.feats.filter(feat => feat.slot !== slot.key && featTakenLevel(feat) <= level),
    ...automaticFeatGrants({ ...c, level, feats: c.feats.filter(feat => feat.slot !== slot.key) }, entries)]
  if (owned.some(feat => base(feat.name) === base(entry.name))) return true
  if (getSettings().singleAnimalCompanion) {
    const advancement = companionAdvancement({ ...c, level, feats: c.feats.filter(feat => feat.slot !== slot.key) })
    if (isCompanionAdvancement(entry.name) && advancement.advanced) return true
    if (/^(?:Mature (?:Animal|Beastmaster) Companion|Impressive Mount)\b/.test(entry.name) && advancement.mature) return true
  }
  if (base(entry.name) !== 'Heal Animal') return false
  return focusSpells({ ...c, level, feats: c.feats.filter(feat => feat.slot !== slot.key) }, entries)
    .spells.some(spell => spell.name === 'Heal Animal')
}

export function eligibleFeats(entries: ContentEntry[], c: Character, slot: PlannedSlot,
  options: { includeUnmetPrerequisites?: boolean } = {}) {
  const wanted: Partial<Record<FeatSlotCategory, string | undefined>> = {
    class: c.className, ancestry: c.ancestry, skill: 'skill', general: 'general', archetype: 'archetype',
  }
  const trait = (slot.category === 'ancestry' ? slot.grantedAncestry ?? wanted.ancestry : wanted[slot.category])?.toLowerCase()
  const ancestryTraits = slot.category === 'ancestry' || slot.category === 'bonus'
    ? slot.grantedAncestry ? [slot.grantedAncestry.toLowerCase()] : ancestryFeatTraits({ ...c, level: Math.min(c.level, slot.level) }) : []
  if (slot.category !== 'bonus' && !trait && !ancestryTraits.length) return []
  const taken = new Set([
    ...c.feats.filter((f) => f.slot !== slot.key).map((f) => f.name === 'Living Weapon Joust' ? 'Living Weapon Jousting' : f.name),
    ...tokens(entries.find(entry => entry.kind === 'background' && !entry.deleted && entry.name === c.background
      && entry.systems.some(system => c.systems.includes(system)))?.data.feat).filter(name => name !== slot.grantedFeat),
    ...automaticFeatGrants({ ...c, level: Math.min(c.level, slot.level),
      feats: c.feats.filter((feat) => feat.slot !== slot.key) }, entries).map((feat) => feat.name),
  ])
  const specializations = c.feats.filter((feat) => feat.slot !== slot.key && isCompanionSpecialization(feat.name)).length
  const generalOnly = slot.category === 'general' && getSettings().generalFeatsOnly
  const classTrait = c.className?.toLowerCase()
  const classCompanionStages = new Set<string>()
  if (getSettings().singleAnimalCompanion && classTrait) {
    for (const { entry, traits } of featIndex(entries)) {
      if (!traits.has(classTrait) || traits.has('archetype') || !entry.systems.some(system => c.systems.includes(system))) continue
      const stage = companionProgressionStage(entry.name)
      if (stage && (stage !== 'specialized' || entry.data.repeatable === true
        || isRepeatableCompanionSpecialization(entry.name))) classCompanionStages.add(stage)
    }
  }
  const orderExplorerOk = availableOrders(c).length > 0
  const artisanSkillEligible = slot.grantedBy !== 'Exceptional Artisan' || !!slot.grantedSkill
    && (ranksAt({ ...c, level: slot.level }, entries)[slot.grantedSkill] ?? 0) >= 3
  const spellcastingDedications = slot.grantedBy === 'Eldritch Trickster' ? eldritchTricksterDedications(entries) : undefined
  const prerequisites = featSelectionPrerequisiteChecker(c, entries, slot)
  const redundantUnarmedTraits = new Set(ancestryTraits.filter(ancestry => {
    const names = new Set(ancestralUnarmedFeatNames([ancestry]))
    return names.size > 0 && (c.feats.some(feat => names.has(feat.name) && feat.slot !== slot.key
      && featTakenLevel(feat) <= Math.min(c.level, slot.level))
      || featIndex(entries).some(({ entry, traits }) => names.has(entry.name) && traits.has(ancestry)
        && entry.systems.some(system => c.systems.includes(system))
        && entry.level <= Math.min(c.level, slot.level) && !prerequisites(entry).missing.length))
  }))
  const ownedArchetype = slot.category === 'archetype' ? archetypePrerequisites({
    ...c, feats: c.feats.filter(feat => featTakenLevel(feat) <= Math.min(c.level, slot.level)),
  }, entries, slot.key, true) : undefined
  const candidates = featIndex(entries)
    .filter(({ entry: e, traits }) => (e.name === 'Magical Trickster' && slot.category === 'class'
      && rogueRackets({ ...c, level: Math.min(c.level, slot.level) }, entries).includes('Eldritch Trickster') ? 2
      : featSelectionLevel(e, c, entries, slot.category, slot)) <= (slot.grantedBy === 'Eldritch Trickster'
      ? slot.maxFeatLevel ?? 2 : Math.min(slot.level, slot.maxFeatLevel ?? slot.level))
      && (slot.category === 'bonus' || !!trait && traits.has(trait) || ancestryTraits.some((ancestry) => traits.has(ancestry))
        || slot.category === 'archetype' && archetypesOf(e).length > 0)
      && !(generalOnly && traits.has('skill'))
      && !(getSettings().disableAdoptedAncestry && ['Adopted Ancestry', 'Orc Kinship', 'Social Chameleon'].includes(e.name))
      && !(getSettings().disableAncientElfMultitalented && ['Ancient Elf', 'Multitalented'].includes(e.name))
      && !(slot.category === 'archetype' && e.source === 'official' && e.name === 'Heal Animal'
        && archetypesOf(e).includes('Beastmaster'))
      && !(getSettings().disableBeastmasterWardenSpells && slot.category === 'archetype'
        && archetypesOf(e).includes('Beastmaster') && hasWardenChoice(e)
        && !wardenSpellOptions(e, entries, true).length)
      && !(classCompanionStages.has(companionProgressionStage(e.name) ?? '') && !traits.has(classTrait ?? '')
        && (traits.has('archetype') || archetypesOf(e).length > 0)
        && !c.feats.some(feat => feat.slot === slot.key && feat.name === e.name && (!feat.sourceId || feat.sourceId === e.id)))
      && (!slot.grantedFeat || e.name === slot.grantedFeat)
      && (!ownedArchetype || isDedication(e) || ownedArchetype(e).length === 0)
      && (slot.grantedBy !== 'Multitalented' || e.level === 2 && traits.has('multiclass') && traits.has('dedication'))
      && (!spellcastingDedications || spellcastingDedications.has(e.name))
      && artisanSkillEligible
      && (slot.grantedBy !== 'Exceptional Artisan' || !!slot.grantedSkill
        && tokens(e.data.skill).some(skill => skill.toLowerCase() === slot.grantedSkill?.toLowerCase()))
      && (slot.grantedBy !== "Mechanic's Ingenuity"
        || tokens(e.data.skill).some(skill => /^(computers|crafting)$/i.test(skill)))
      && (slot.grantedBy !== 'Social Chameleon' || (slot.category === 'general'
        ? e.name === 'Adopted Ancestry'
        : !!slot.grantedAncestry && e.level === 1 && traits.has(slot.grantedAncestry.toLowerCase()) && !featRarity(e)))
      && (!slot.grantedOrder || new RegExp(`\\b${slot.grantedOrder === 'Wild' ? '(?:wild|untamed)' : slot.grantedOrder} order\\b`, 'i').test(String(e.data.prerequisite ?? '')))
      && (e.name !== 'Ancestral Magic' || ancestralMagicAvailable(c, entries,
        { name: e.name, type: 'Ancestry Feat', level: e.level, slot: slot.key, takenLevel: slot.level, sourceId: e.id }))
      && !(e.name === 'Ancestral Unarmed Attack' && (traits.has('ancestry') && redundantUnarmedTraits.size
        || [...redundantUnarmedTraits].some(ancestry => traits.has(ancestry)))
        && !c.feats.some(feat => feat.slot === slot.key && feat.name === e.name && (!feat.sourceId || feat.sourceId === e.id)))
      && !(getSettings().singleTrainingFeats && ['General Training', 'Advanced General Training'].includes(e.name) && taken.has(e.name))
      && !(getSettings().singleAdditionalArms && e.name === 'Additional Arms' && taken.has(e.name))
      && (e.name !== "Officer's Education" || c.feats.filter(feat => feat.name === e.name && feat.slot !== slot.key).length < 2)
      && (e.name !== 'Adaptive Visual Receptors' || c.feats.filter(feat => feat.name === e.name && feat.slot !== slot.key).length < 2)
      && (!['Commercial Customization', 'Tactical Customization', 'Advanced Customization', 'Superior Customization', 'Superior Drone'].includes(e.name)
        || c.feats.filter(feat => feat.name === e.name && feat.slot !== slot.key).length < 3)
      && (e.name !== 'Plentiful Grenades' || !taken.has(e.name) || slot.level >= 14
        && c.feats.filter(feat => feat.name === e.name && feat.slot !== slot.key).length < 2)
      && (e.name !== 'Exocortex Experimenter' || !taken.has(e.name) || slot.level >= 12
        && c.feats.filter(feat => feat.name === e.name && feat.slot !== slot.key).length < 2)
      && (e.name !== 'Expansive Array' || c.feats.filter(feat => feat.name === e.name && feat.slot !== slot.key).length < 2)
      && (!['Exocortex Experimenter', 'Convertible Chassis', 'Order Cross-Training'].includes(e.name)
        || c.feats.some(feat => feat.name === e.name && feat.slot === slot.key)
        || !!featChoiceOptions(e.name, c, entries, slot.key)?.length)
      && (options.includeUnmetPrerequisites || !prerequisites(e).missing.length)
      && !(/^(?:Animal Companion|Animal Empathy|Heal Animal|Incredible Companion|Incredible Mount|Incredible Beastmaster Companion|Mature Animal Companion|Mature Beastmaster Companion|Impressive Mount|Side by Side)\b/.test(e.name) && duplicatesOwnedAbility(c, entries, e, slot))
      && !(getSettings().singleAnimalCompanion && /^(?:Additional Companion|Swift Guardian|Beastmaster's Call|Lead the Pack|Pack Takedown)\b/.test(e.name))
      && (e.name !== 'Order Explorer' || orderExplorerOk || c.feats.some((f) => f.slot === slot.key && f.name === e.name))
      && (e.name !== 'Versatile Rogue' || !!featChoiceOptions(e.name, c, entries, slot.key)?.length
        || c.feats.some(feat => feat.slot === slot.key && feat.name === e.name))
      && (e.name !== 'Mercy' || c.feats.some(feat => feat.slot === slot.key && feat.name === e.name)
        || c.feats.filter(feat => feat.name === 'Mercy' && feat.slot !== slot.key).length < 3
          && !!featChoiceOptions(e.name, c, entries, slot.key)?.length)
      && (!isCompanionSpecialization(e.name) || specializations < 3)
      && EXCLUSIVE_FEAT_GROUPS.every((group) => !group.includes(e.name) || !group.some((name) => name !== e.name && taken.has(name)))
      && (!getSettings().exclusiveCyborgHearts || !CYBORG_HEART_FEATS.includes(e.name)
        || !CYBORG_HEART_FEATS.some(name => name !== e.name && taken.has(name)))
      && (!/^Mortification \(/.test(e.name) || ![...taken].some(name => /^Mortification \(/.test(name)))
      && (!taken.has(e.name) || e.name === 'Ubiquitous Gadgets' && slot.level >= 14
        && c.feats.filter(feat => feat.name === e.name && feat.slot !== slot.key && featTakenLevel(feat) <= slot.level).length === 1
        || e.name === 'Plentiful Grenades' && slot.level >= 14
        && c.feats.filter(feat => feat.name === e.name && feat.slot !== slot.key && featTakenLevel(feat) <= slot.level).length === 1
        || e.name === 'Exocortex Experimenter' && slot.level >= 12
        && c.feats.filter(feat => feat.name === e.name && feat.slot !== slot.key && featTakenLevel(feat) <= slot.level).length === 1
        || e.name === 'Expansive Array'
        && c.feats.filter(feat => feat.name === e.name && feat.slot !== slot.key).length === 1
        || (e.data.repeatable === true || isRepeatableCompanionSpecialization(e.name)) && canSelectWardenFeat(e.name, c, entries, slot.key,
            slot.category === 'archetype' && archetypesOf(e).includes('Beastmaster'))))
  const takenLineage = entries.some(entry => entry.kind === 'feat' && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system))
    && entry.traits.some(trait => trait.toLowerCase() === 'lineage') && taken.has(entry.name))
  const primaryAncestry = c.ancestry?.trim().toLowerCase()
  if (slot.category === 'ancestry' && primaryAncestry) {
    candidates.sort((a, b) => Number(!a.traits.has(primaryAncestry)) - Number(!b.traits.has(primaryAncestry)))
  }
  const seen = new Set<string>()
  const selected = c.feats.find(feat => feat.slot === slot.key)
  const selectedSource = selected && selectedFeatEntry(c, entries, selected.name, selected.sourceId)
  const skillSources = new Map<string, ContentEntry>()
  for (const { entry, equivalence, traits } of candidates) {
    if (entry.source !== 'official' || !traits.has('skill')) continue
    const previous = skillSources.get(equivalence)
    if (!previous || entry.id === selectedSource?.id || previous.id !== selectedSource?.id
      && !previous.systems.includes(c.systems[0]) && entry.systems.includes(c.systems[0])) {
      skillSources.set(equivalence, entry)
    }
  }
  const specificTail = slot.category === 'ancestry' && !!primaryAncestry && entries.some(entry =>
    entry.kind === 'feat' && !entry.deleted && entry.name === 'Prehensile Tail'
    && entry.systems.some(system => c.systems.includes(system))
    && entry.traits.some(trait => trait.toLowerCase() === primaryAncestry)
    && featSelectionLevel(entry, c, entries, slot.category, slot) <= Math.min(slot.level, slot.maxFeatLevel ?? slot.level))
  const animalEmpathy = slot.category === 'archetype' ? candidates
    .filter(({ entry }) => entry.source === 'official' && /^Animal Empathy(?: \(|$)/.test(entry.name))
    .sort((a, b) => Number(b.entry.id === selectedSource?.id) - Number(a.entry.id === selectedSource?.id)
      || Number(b.traits.has(classTrait ?? '')) - Number(a.traits.has(classTrait ?? ''))
      || Number(b.traits.has('ranger')) - Number(a.traits.has('ranger')))[0]?.entry : undefined
  const overcrowd = candidates.filter(({ entry }) => entry.name === 'Overcrowd' && entry.source === 'official')
    .sort((a, b) => Number(prerequisites(a.entry).missing.length > 0) - Number(prerequisites(b.entry).missing.length > 0)
      || Number(!!a.entry.data.prerequisite) - Number(!!b.entry.data.prerequisite))[0]?.entry
  // Prefer Pathfinder versions of these shared feats without hiding homebrew.
  const sharedOfficialFeats = new Map(['Advanced General Training', 'Cooperative Nature', 'Cooperative Soul',
    'Incredible Improvisation', 'Multitalented', 'Prescient Planner', 'Unconventional Weaponry'].map(name => [name,
    candidates.filter(({ entry }) => entry.name === name && entry.source === 'official')
      .sort((a, b) => Number(!a.entry.systems.includes('pf2e')) - Number(!b.entry.systems.includes('pf2e')))[0]?.entry]))
  const duplicateLore = new Set<string>()
  if (slot.category === 'ancestry') {
    const names = new Set([...candidates.map(candidate => candidate.entry.name),
      ...c.feats.filter(feat => feat.slot !== slot.key && featTakenLevel(feat) <= slot.level).map(feat => feat.name)])
    for (const { entry } of candidates.filter(candidate => candidate.entry.name === 'Ancestral Skills')) {
      const selection = { name: entry.name, type: 'Ancestry Feat', level: entry.level, sourceId: entry.id }
      const genericSkills = ancestralSkills(c, entries, [selection])
      const lore = ancestralSkillLores(c, entries, [selection])[0]
      if (genericSkills.length && lore && [...names].some(name => {
        const grant = ancestryLoreGrant(c, entries, name)
        return grant && grant.lore.toLowerCase() === lore.toLowerCase()
          && grant.skills.length === genericSkills.length && grant.skills.every(skill => genericSkills.includes(skill))
      })) duplicateLore.add(entry.id)
    }
  }
  return candidates.filter(({ entry, equivalence }) => {
       if (entry.traits.some(trait => trait.toLowerCase() === 'lineage')
         && (slot.level !== 1 || takenLineage)
         && !c.feats.some(feat => feat.slot === slot.key && feat.name === entry.name)) return false
      if (entry.name === 'Overcrowd' && entry.source === 'official' && entry !== overcrowd) return false
      if (animalEmpathy && entry.source === 'official' && /^Animal Empathy(?: \(|$)/.test(entry.name) && entry !== animalEmpathy) return false
      if (sharedOfficialFeats.has(entry.name) && entry.source === 'official' && entry !== sharedOfficialFeats.get(entry.name)) return false
      if (entry.name === 'Prehensile Limbs' && specificTail
        && !c.feats.some(feat => feat.slot === slot.key && feat.name === entry.name)) return false
      if (entry.name === 'Ancestral Skills' && duplicateLore.has(entry.id)
        && !c.feats.some(feat => feat.slot === slot.key && feat.name === entry.name)) return false
      if (skillSources.has(equivalence) && skillSources.get(equivalence) !== entry) return false
      if (seen.has(equivalence)) return false
      seen.add(equivalence)
      return true
    }).map(({ entry }) => entry)
}

export function syncOrderExplorerFeats(c: Character, entries: ContentEntry[]): Partial<Character> | undefined {
  let feats = c.feats
  let entryIds = c.entryIds
  for (const slot of plannedSlots(c).filter(slot => slot.grantedBy === 'Order Explorer')) {
    const selected = feats.find(feat => feat.slot === slot.key)
    if (selected) {
      const source = entries.find(entry => entry.kind === 'feat' && !entry.deleted && entry.name === selected.name
        && entry.systems.some(system => c.systems.includes(system)))
      if (!source) continue
      const order = slot.grantedOrder === 'Wild' ? '(?:wild|untamed)' : slot.grantedOrder
      if (new RegExp(`\\b${order} order\\b`, 'i').test(String(source.data.prerequisite ?? ''))) continue
      feats = feats.filter(feat => feat !== selected)
      if (!feats.some(feat => feat.name === selected.name)) {
        const ids = new Set(entries.filter(entry => entry.kind === 'feat' && entry.name === selected.name).map(entry => entry.id))
        entryIds = entryIds.filter(id => !ids.has(id))
      }
    }
    const candidates = eligibleFeats(entries, { ...c, feats, entryIds }, slot)
    if (candidates.length !== 1) continue
    const entry = candidates[0]
    feats = [...feats, { name: entry.name, type: 'Class Feat', level: entry.level, slot: slot.key, takenLevel: slot.level }]
    entryIds = [...new Set([...entryIds, entry.id])]
  }
  return feats === c.feats ? undefined : { feats, entryIds }
}

export const MASTERMIND_SKILLS = ['Arcana', 'Nature', 'Occultism', 'Religion']
const SCRAPPER_SKILLS = MASTERMIND_SKILLS
export const ROGUE_RACKETS = ['Thief', 'Ruffian', 'Scoundrel', 'Mastermind', 'Eldritch Trickster', 'Avenger'] as const
function eldritchTricksterDedications(entries: ContentEntry[]) {
  const feats = entries.filter(entry => entry.kind === 'feat' && !entry.deleted)
  return new Set(feats.filter(feat => feat.traits.some(trait => trait.toLowerCase() === 'multiclass') && isDedication(feat)
    && archetypesOf(feat).some(archetype => ['Basic', 'Expert', 'Master'].every(tier =>
      feats.some(candidate => candidate.name === `${tier} ${archetype} Spellcasting` && archetypesOf(candidate).includes(archetype)))))
    .map(feat => feat.name))
}
export function rogueRackets(c: Character, entries: ContentEntry[]) {
  if (c.className !== 'Rogue') return []
  const primary = selectedSubclass(c, entries)
  const taken = [primary, ...activeFeatsNamed(c, 'Versatile Rogue').map(feat => feat.choice)]
  return [...new Set(taken.filter((name): name is string => !!name && ROGUE_RACKETS.some(racket => racket === name)))]
}
const ANCESTRY_SKILL_GRANTS: Record<string, { skill: string; feat?: string }> = {
  "Caretaker's Intuition": { skill: 'Nature' },
  'Jotunborn Grappler': { skill: 'Athletics', feat: 'Titan Wrestler' },
  'Guardian Dedication': { skill: 'Athletics' },
  'Earned Glory': { skill: 'Performance', feat: 'Impressive Performance' },
  'Round Ears': { skill: 'Deception' },
  Sociable: { skill: 'Diplomacy', feat: 'Hobnobber' },
  'Cite the Deep Lore': { skill: 'Society', feat: 'Blend In' },
  "Diplomat's Facade": { skill: 'Deception', feat: 'Lie to Me' },
  'Broken Hand Technique': { skill: 'Athletics', feat: 'Titan Wrestler' },
  Spelunker: { skill: 'Acrobatics', feat: 'Quick Squeeze' },
}
const SKILLS_TAB_ANCESTRY_GRANTS = ["Caretaker's Intuition", 'Jotunborn Grappler', 'Guardian Dedication',
  'Earned Glory', 'Round Ears', 'Sociable', 'Cite the Deep Lore', "Diplomat's Facade", 'Broken Hand Technique', 'Spelunker']
export const SKILL_GRANT_REPLACEMENT_FEATS = ["Caretaker's Intuition", 'Jotunborn Grappler', 'Guardian Dedication']

function ancestrySkillGrant(c: Character, entries: ContentEntry[], name: string) {
  const grant = ANCESTRY_SKILL_GRANTS[name]
  const system = ["Caretaker's Intuition", 'Jotunborn Grappler', 'Guardian Dedication', 'Earned Glory', 'Round Ears', 'Sociable'].includes(name)
    ? 'pf2e' : 'sf2e'
  if (!grant || !c.systems.includes(system)) return undefined
  const source = selectedFeatEntry(c, entries, name)
  if (source && !source.systems.includes(system)) return undefined
  if (name === 'Spelunker' && !ancestryFeatTraits(c).includes('orc')) return undefined
  return grant
}

function ancestrySkillBefore(c: Character, entries: ContentEntry[], index: number) {
  const feat = c.feats[index]
  const level = Math.min(c.level, featTakenLevel(feat))
  const feats = c.feats.filter((other, i) => i !== index
    && (featTakenLevel(other) < level || featTakenLevel(other) === level && i < index))
  return ranksAt({ ...c, level, feats }, entries)
}

export function warmaskAlternateSkills(c: Character, entries: ContentEntry[], index: number) {
  const source = warmaskSource(c)
  if (!source || index < 0) return []
  const ranks = ancestrySkillBefore(c, entries, index)
  if (!ranks[source.skill]) return []
  return statDefs(c).filter(stat => stat.kind === 'skill' && !ranks[stat.name]).map(stat => stat.name).sort()
}

function scrapperRanksBefore(c: Character, entries: ContentEntry[], slotKey: string, index: number, withOverrides = true) {
  const level = Math.min(c.level, Number(slotKey.split(':')[1]) || (c.feats[index] ? featTakenLevel(c.feats[index]) : c.level))
  // Neither this feat's grants nor later training can unlock its expert alternative.
  return ranksAt({ ...c, level,
    feats: c.feats.filter(feat => feat.name !== 'Technomagical Scrapper' && featTakenLevel(feat) <= level),
  }, entries, level + 1, withOverrides)
}

function scrapperVariants(ranks: Record<string, number>) {
  const rank = SCRAPPER_SKILLS.every(skill => (ranks[skill] ?? 0) >= 1) ? 2 : 1
  return SCRAPPER_SKILLS.filter(skill => (ranks[skill] ?? 0) < rank)
    .map(skill => ({ skill, rank, label: `${skill} to ${RANKS[rank]}` }))
}

export function featChoiceOptions(name: string, c: Character, entries: ContentEntry[], slotKey: string, selectedIndex?: number,
  category?: FeatSlotCategory): string[] | undefined {
  const index = selectedIndex ?? c.feats.findIndex((feat) => feat.slot === slotKey)
  const background = slotKey === 'skill:1:scholar' || slotKey.startsWith('skill:1:background:')
    ? byName(entries, 'background', c.background) : undefined
  const fixedBackgroundChoice = background?.data[`background_choice_${name}`]
  if (name !== 'Assurance' && typeof fixedBackgroundChoice === 'string') return [fixedBackgroundChoice]
  if (name === 'Researched Spell Resistance') return researchedSpellResistanceVariants(c, entries)
  if (name === 'Planar Resilience' && c.systems.includes('pf2e')) return ['Cold', 'Fire']
  if (name === 'Lizardfolk Lore') return ['Nature', 'Occultism']
  if (name === 'Iruxi Armaments') return ['Claws', 'Fangs', 'Tail']
  if (name === 'Reinforced Skeleton') return ['Cold, Slashing', 'Cold, Piercing', 'Electricity, Slashing',
    'Electricity, Piercing', 'Fire, Slashing', 'Fire, Piercing']
  if (name === 'Assurance') {
    const level = Math.min(c.level, Number(slotKey.split(':')[1]) || c.level)
    const ranks = ranksAt({ ...c, level }, entries)
    const skills = new Set(statDefs(c).filter(stat => stat.kind === 'skill').map(stat => stat.name))
    const used = new Set(c.feats.flatMap((feat, i) => i !== index && feat.name === name && feat.choice ? [feat.choice] : []))
    const required = fixedBackgroundChoice || background?.data.background_skill
    return Object.keys(ranks).filter(skill => (skills.has(skill) || / lore$/i.test(skill))
      && ranks[skill] >= 1 && !used.has(skill) && (!required || skill === required)).sort((a, b) => a.localeCompare(b))
  }
  if (name === 'Elf Atavism' || name === 'Elven Atavism') return elfAtavismOptions(c, entries)
    .filter(entry => !getSettings().disableAncientElfMultitalented || entry.name !== 'Ancient Elf')
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b))
  if (name === 'Exocortex Experimenter' && c.systems.includes('sf2e')) {
    const used = new Set([c.subclass?.toLowerCase(),
      ...c.feats.filter((feat, i) => i !== index && feat.name === name).map(feat => feat.choice?.toLowerCase())])
    return MECHANIC_EXOCORTEXES.filter(option => !used.has(option.toLowerCase()))
  }
  if (name === 'Convertible Chassis' && c.systems.includes('sf2e')) {
    const base = c.mechanicDroneBaseChassis ?? c.mechanicDroneChassis
    const used = new Set(c.feats.filter((feat, i) => i !== index && feat.name === name).map(feat => feat.choice))
    return DRONE_CHASSIS.filter(option => option !== base && !used.has(option))
  }
  if (name === 'Advanced Drone' && c.systems.includes('sf2e')) return ['Burly', 'Deft']
  if (name === 'Superior Drone' && c.systems.includes('sf2e')) {
    const used = new Set(c.feats.filter((feat, i) => i !== index && feat.name === name).map(feat => feat.choice))
    return ['Ambusher', 'Bully', 'Daredevil', 'Racer', 'Tracker', 'Wrecker'].filter(option => !used.has(option))
  }
  if (name === 'Hellknight Dedication') return HELLKNIGHT_ORDERS
  if (ORDER_TRAINING_FEATS.includes(name)) return orderTrainingChoices(c, name, index)
  if (name === 'Deflective Plating') return ['Acid', 'Bludgeoning', 'Cold', 'Electricity', 'Fire', 'Piercing', 'Slashing', 'Sonic']
  const ancestryGrant = ancestrySkillGrant(c, entries, name)
  if (SKILLS_TAB_ANCESTRY_GRANTS.includes(name) && (index < 0
    || !SKILL_GRANT_REPLACEMENT_FEATS.includes(name) && !c.feats[index].choice)) return undefined
  if (ancestryGrant && index >= 0) {
    const ranks = ancestrySkillBefore(c, entries, index)
    if (!ranks[ancestryGrant.skill]) return undefined
    return statDefs(c).filter(stat => stat.kind === 'skill' && !ranks[stat.name]).map(stat => stat.name).sort()
  }
  const familiarityOptions = familiarityChoiceOptions(name, c, entries)
  if (familiarityOptions) return familiarityOptions
  if (name === 'Clan Lore') return Object.keys(CLAN_LORE_OPTIONS).sort((a, b) => clanLoreLabel(a).localeCompare(clanLoreLabel(b)))
  if (name === 'Dongun Education') return Object.keys(DONGUN_EDUCATION_LORES)
  if (name === 'Eye for Treasure' && index >= 0) {
    const ranks = ancestrySkillBefore(c, entries, index)
    if ((ranks.Crafting ?? 0) < 1) return undefined
    return statDefs(c).filter(stat => stat.kind === 'skill' && !(ranks[stat.name] ?? 0))
      .map(stat => stat.name).sort((a, b) => a.localeCompare(b))
  }
  if (name === "Officer's Medical Training" && index >= 0) {
    const ranks = ancestrySkillBefore(c, entries, index)
    if (!(ranks.Medicine ?? 0)) return undefined
    const savedLore = c.feats[index].choice
    return [...new Set([...statDefs(c).filter(stat => stat.kind === 'skill').map(stat => stat.name),
      ...c.lores.map(lore => lore.name), ...(savedLore && /.+\s+lore$/i.test(savedLore) ? [savedLore] : [])])]
      .filter(skill => !(ranks[skill] ?? 0)).sort((a, b) => a.localeCompare(b))
  }
  if (name === 'Unconventional Weaponry') {
    const level = Number(slotKey.split(':')[1]) || (index >= 0 ? featTakenLevel(c.feats[index]) : c.level)
    const atLevel = { ...c, level, feats: c.feats.filter((feat, i) => i !== index && featTakenLevel(feat) <= level) }
    return [...new Set(gearPickerEntries(entries, 'weapon').filter(entry =>
      entry.systems.some(system => c.systems.includes(system))
      && (uncommonWeapon(entry) || !featRarity(entry) || /^Shobhad Longrifle(?: \(Pathfinder\))?$/.test(entry.name) && featRarity(entry) === 'Rare')
      && (['Simple', 'Martial'].includes(weaponCategory(entry)) || weaponCategory(entry) === 'Advanced' && weaponRanks(atLevel, entries).Martial >= 1))
      .map(entry => combinationName(entries, entry.name)))].sort((a, b) => a.localeCompare(b))
  }
  if (name === 'Technomagical Scrapper') {
    const variants = scrapperVariants(scrapperRanksBefore(c, entries, slotKey, index))
    return variants.length ? variants.map(variant => variant.label) : undefined
  }
  if (name === 'Adopted Ancestry') return [...new Set(entries.filter((entry) => entry.kind === 'ancestry' && !entry.deleted && !isVersatileHeritage(entry)
    && entry.name !== c.ancestry && entry.systems.some((system) => c.systems.includes(system))
    && contentAccessGranted(c, entry)).map((entry) => entry.name))]
    .sort((a, b) => a.localeCompare(b))
  if (name === 'Skill Training' || name === 'Shiny') {
    const level = name === 'Shiny' && index >= 0 ? Math.min(c.level, featTakenLevel(c.feats[index])) : c.level
    const ranks = ranksAt({ ...c, level, feats: c.feats.filter((_, i) => i !== index) }, entries)
    if (name === 'Shiny' && !ranks.Performance) return undefined
    return statDefs(c).filter((stat) => stat.kind === 'skill' && !ranks[stat.name]).map((stat) => stat.name)
      .sort((a, b) => a.localeCompare(b))
  }
  if (name === 'Weapon Proficiency') {
    const feat = { name, type: 'General Feat', level: 1, ...(slotKey ? { slot: slotKey } : {}) }
    const feats = index < 0 ? [...c.feats, feat] : c.feats.map((existing, i) => i === index ? { ...existing, name } : existing)
    const candidateIndex = index < 0 ? feats.length - 1 : index
    const grants = weaponProficiencyGrants({ ...c, level: Math.max(c.level, featTakenLevel(feats[candidateIndex])), feats }, entries)
    if (grants.find((grant) => grant.index === candidateIndex)?.martial) return undefined
    const used = new Set(grants.flatMap((grant) => grant.index !== candidateIndex && !grant.martial && grant.feat.choice
      ? [grant.feat.choice.toLowerCase()] : []))
    return [...new Set(entries.filter((entry) => entry.kind === 'weapon' && !entry.deleted && weaponCategory(entry) === 'Advanced'
      && entry.systems.some((system) => c.systems.includes(system)) && !used.has(entry.name.toLowerCase())).map((entry) => entry.name))]
      .sort((a, b) => a.localeCompare(b))
  }
  if (name === 'Order Explorer') return availableOrders(c, index)
  if (name === 'Mercy') {
    const used = new Set(c.feats.flatMap((feat, i) => i !== index && feat.name === name && feat.choice ? [feat.choice] : []))
    return ['Mercy of the Body', 'Mercy of Grace', 'Mercy of the Mind'].filter(choice => !used.has(choice))
  }
  if (name === 'Multifarious Muse') {
    const used = new Set([selectedSubclass(c, entries), ...c.feats.flatMap((feat, i) =>
      i !== index && feat.name === name && featTakenLevel(feat) <= c.level && feat.choice ? [feat.choice] : [])])
    return subclassOptions({ ...c, className: 'Bard' }, entries).map(entry => entry.name).filter(muse => !used.has(muse))
  }
  if (name === 'Order Magic') return orderMagicOptions(c, index)
  if (name === 'Canny Acumen') return [...CANNY_STATS]
  if (name === 'Beast Trainer') return ['Pet', 'Train Animal']
  if (name === 'Touch of the Sea') return ['Gale Blast', 'Spout']
  if (name === 'Free Heart') return [...new Set(entries.filter(entry => entry.kind === 'background' && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system)) && entry.name !== c.background
    && !featRarity(entry)).map(entry => entry.name))].sort((a, b) => a.localeCompare(b))
  if (name === 'Exceptional Artisan') {
    const level = Math.min(c.level, index >= 0 ? featTakenLevel(c.feats[index]) : Number(slotKey.split(':')[1]) || c.level)
    const ranks = ranksAt({ ...c, level }, entries)
    return [...new Set([...statDefs(c).filter(stat => stat.kind === 'skill').map(stat => stat.name), ...c.lores.map(lore => lore.name)])]
      .filter(skill => (ranks[skill] ?? 0) >= 3).sort()
  }
  if (name === 'Versatile Rogue') {
    const used = new Set([selectedSubclass(c, entries), ...c.feats.flatMap((feat, i) =>
      i !== index && feat.name === name && featTakenLevel(feat) <= c.level && feat.choice ? [feat.choice] : [])])
    return ROGUE_RACKETS.filter(racket => !used.has(racket)
      && (racket !== 'Eldritch Trickster' || eldritchTricksterDedications(entries).size > 0))
  }
  if (name === 'Hold Mark') return ['Burning Sun', "Death's Head", 'Defiled Corpse', 'Empty Hand']
  if (name === 'Orc Warmask') return Object.keys(WARMASK_SOURCES)
  if (name === 'Alloyed Attacks') return ['Cold Iron', 'Silver', ...(c.level >= 13 ? ['Adamantine'] : [])]
  if (name === 'Favored Prey') return ['Animals', 'Beasts', 'Dragons', 'Fungi and Plants']
  if (name === 'Favored Terrain') return [...FAVORED_TERRAINS]
  if (name === 'Terrain Expertise') return terrainExpertiseOptions(c, index)
  if (DOMAIN_FEATS.includes(name)) {
    const domains = deityDomains(c, entries)
    if (!name.startsWith('Advanced')) return domains
    const level = Math.min(c.level, c.feats[index] ? featTakenLevel(c.feats[index]) : Number(slotKey.split(':')[1]) || c.level)
    const initialNames = name === "Advanced Deity's Domain" ? ["Deity's Domain"] : ['Domain Initiate', "Deity's Domain"]
    const initial = new Set(c.feats.flatMap((feat, featIndex) => featIndex !== index
      && featTakenLevel(feat) <= level && initialNames.includes(feat.name) && feat.choice
      ? [feat.choice.trim().toLowerCase()] : []))
    const used = new Set(c.feats.flatMap((feat, featIndex) => featIndex !== index
      && featTakenLevel(feat) <= level && feat.name === name && feat.choice ? [feat.choice.trim().toLowerCase()] : []))
    return domains.filter(domain => initial.has(domain.toLowerCase()) && !used.has(domain.toLowerCase()))
  }
  if (name === 'Second Blessing' || name === 'Third Blessing') {
    const used = [championBlessing(c), ...c.feats.flatMap((feat) => [
      ...(DEVOTED_BLESSINGS.some((blessing) => blessing === feat.name) ? [feat.name] : []),
      ...(feat.slot !== slotKey && ['Second Blessing', 'Third Blessing'].includes(feat.name) && feat.choice ? [feat.choice] : []),
    ])]
    return DEVOTED_BLESSINGS.filter((blessing) => !used.includes(blessing))
  }
  if (name === 'Inventor Dedication') return ['Armor', 'Construct', 'Weapon']
  if (name === 'Second Innovation' || name === 'Third Innovation') {
    const used = [selectedSubclass(c, entries), ...c.feats.flatMap((feat) =>
      feat.slot !== slotKey && ['Second Innovation', 'Third Innovation'].includes(feat.name) && feat.choice ? [feat.choice] : [])]
    return subclassOptions({ ...c, className: 'Inventor' }, entries).map((entry) => entry.name).filter((innovation) => !used.includes(innovation))
  }
  if (hasWardenChoice({ name }) && c.systems.includes('pf2e')) {
    const selected = new Set(c.feats.flatMap((feat) => feat.slot !== slotKey && hasWardenChoice(feat) && feat.choice ? [feat.choice] : []))
    const source = selectedFeatEntry(c, entries, name, selectedIndex === undefined ? undefined : c.feats[selectedIndex]?.sourceId)
    const beastmaster = (category ? category === 'archetype' : slotKey.startsWith('archetype:'))
      && archetypesOf(source).includes('Beastmaster')
    return wardenSpellOptions({ name }, entries, beastmaster).map((spell) => spell.name).filter((choice) => !selected.has(choice))
  }
  if (name === 'First World Magic' || name === 'Ancestral Magic' || name === 'Ancestral Cantrip') return undefined
  const spells = featSpellOptions(c, entries, { name, type: '', level: 1 })
  if (spells) return [...new Set(spells.map(spell => spell.name))]
}

export function deityDomains(c: Character, entries: ContentEntry[]) {
  const deity = byName(entries, 'deity', c.deity)
  const domains = new Map<string, string>()
  for (const value of tokens(deity?.data.domain_primary ?? deity?.data.domain)) {
    const domain = value.replace(/\s+/g, ' ')
    const key = domain.toLowerCase()
    if (!domains.has(key)) domains.set(key, domain)
  }
  return [...domains.values()].sort((a, b) => a.localeCompare(b))
}

// ---------- Class features ----------

// Covered by the boost, slot and skill planners rather than listed as features
const PLANNER_FEATURE = /^(ancestry and background|attribute boosts|skill increases|(.+ )?feats?)$/i

// Features the class grants automatically up to the character's level
const classFeatureCache = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()
export function classFeatures(entries: ContentEntry[], c: Character) {
  if (!c.className) return []
  let cache = classFeatureCache.get(entries)
  if (!cache) {
    cache = new Map()
    classFeatureCache.set(entries, cache)
  }
  const key = `${c.className}\0${c.level}`
  const cached = cache.get(key)
  if (cached) return cached
  const seen = new Set<string>()
  const features = entries
    .filter((e) => e.kind === 'classFeature' && e.data.class === c.className && e.level <= c.level && !PLANNER_FEATURE.test(e.name))
    .filter((e) => !seen.has(`${e.level}:${e.name}`) && seen.add(`${e.level}:${e.name}`))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  cache.set(key, features)
  return features
}

export function classDifficultyClass(c: Character, entries: ContentEntry[]) {
  const klass = byName(entries, 'class', c.className)
  if (!klass || c.level < 1) return undefined
  const attributes = parseAbilities(klass.data.attribute)
  const ability = attributes.length === 1 ? attributes[0] : c.boosts?.class
  if (!ability || attributes.length > 0 && !attributes.includes(ability)) return undefined
  const rank = classFeatures(entries, c).reduce((best, feature) => {
    for (const match of feature.description.matchAll(/proficiency(?: ranks?)? (?:for|in) ([^.]*?) increases? to (expert|master|legendary)/gi)) {
      if (/\bclass DCs?\b/i.test(match[1])) best = Math.max(best, rankFromText(match[2]))
    }
    return best
  }, 1)
  return 10 + abilityMod(c.abilities[ability]) + proficiencyBonus(rank, c.level)
}

export function classSpellcasting(c: Character, entries: ContentEntry[]) {
  if (c.className === 'Witchwarper') return witchwarperSpellcasting(c)
  const klass = byName(entries, 'class', c.className)
  const traditions = c.className === 'Druid' ? ['Primal'] : tokens(klass?.data.tradition)
  const focusOnlyCaster = ['Champion', 'Monk', 'Ranger'].includes(c.className ?? '')
  if (!traditions.length && !focusOnlyCaster) return undefined

  const progression: Record<string, number> = {
    'expert spellcaster': 2,
    'expert spellcasting': 2,
    'master spellcaster': 3,
    'master spellcasting': 3,
    'legendary spellcaster': 4,
    'legendary spellcasting': 4,
  }
  const features = classFeatures(entries, c)
  const rank = features.reduce((best, feature) => {
    let rank = progression[feature.name.toLowerCase()] ?? 0
    for (const match of feature.description.matchAll(/proficiency(?: ranks?)? (?:for|in) ([^.]*?) increases? to (expert|master|legendary)/gi)) {
      if (/\bspell (?:attack|DC)/i.test(match[1]) || focusOnlyCaster && /\bclass DC\b/.test(match[1])) {
        rank = Math.max(rank, { expert: 2, master: 3, legendary: 4 }[match[2].toLowerCase() as 'expert' | 'master' | 'legendary'])
      }
    }
    return Math.max(best, rank)
  }, c.className === 'Druid' ? c.level >= 19 ? 4 : c.level >= 15 ? 3 : c.level >= 7 ? 2 : 1 : 1)
  return { traditions, rank, ability: CASTING_ABILITY[c.className ?? ''] as Ability | undefined }
}

export function spellDifficultyClass(c: Character, entries: ContentEntry[]) {
  const casting = classSpellcasting(c, entries)
  const ability = casting?.ability ?? c.spellcasting?.ability
  return casting && ability ? 10 + abilityMod(c.abilities[ability]) + proficiencyBonus(casting.rank, c.level) : undefined
}

export function spellDCText(c: Character, entries: ContentEntry[], text: string) {
  return text.replace(/\byour spell(?:casting)? DC\b/gi, () => {
    const dc = spellDifficultyClass(c, entries)
    return dc === undefined ? 'spell DC (unavailable)' : `DC ${dc}`
  })
}

export function classSpellSlots(c: Character): Record<number, number> | undefined {
  if (c.className === 'Witchwarper') return witchwarperSpellSlots(c)
  if (c.className !== 'Druid' || activeFeatsNamed(c, 'Flexible Spellcaster Dedication').length) return undefined
  const slots: Record<number, number> = {}
  if (c.level < 1) return slots
  slots[0] = 5
  for (let rank = 1; rank <= Math.min(9, Math.ceil(c.level / 2)); rank++)
    slots[rank] = c.level === rank * 2 - 1 ? 2 : 3
  if (c.level >= 19) slots[10] = 1 + (c.level >= 20 && activeFeatsNamed(c, "Hierophant's Power").length ? 1 : 0)
  return slots
}

export function druidSpellList(c: Character, entries: ContentEntry[]) {
  if (c.className !== 'Druid') return []
  const extra = new Set([
    ...(c.level >= 8 && activeFeatsNamed(c, 'Fey Caller').length ? ['Illusory Disguise', 'Illusory Object', 'Illusory Scene'] : []),
    ...(c.level >= 8 && activeFeatsNamed(c, 'Forgotten Presence').length ? ['Rewrite Memory'] : []),
  ])
  return entries.filter(entry => entry.kind === 'spell' && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system))
    && !entry.traits.some(trait => trait.toLowerCase() === 'focus')
    && (extra.has(entry.name) || tokens(entry.data.tradition).some(tradition => tradition.toLowerCase() === 'primal')))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

// Spellcasting attribute is set by the class, not chosen
const CASTING_ABILITY: Record<string, Ability> = {
  Animist: 'wis', Bard: 'cha', Cleric: 'wis', Druid: 'wis', Magus: 'int', Oracle: 'cha', Psychic: 'int',
  Monk: 'wis', Ranger: 'wis', Sorcerer: 'cha', Summoner: 'cha', Thaumaturge: 'cha', Witch: 'int', Wizard: 'int', Champion: 'cha', Kineticist: 'con',
}

const FEATURE_RANK: Record<string, number> = { expertise: 2, mastery: 3, legend: 4 }

// "Reflex Expertise", "Perception Mastery" and similar raise that statistic's rank
export function featureRanks(features: ContentEntry[]) {
  const ranks: Record<string, number> = {}
  const raise = (stat: string, rank: number) => { ranks[stat] = Math.max(ranks[stat] ?? 0, rank) }
  for (const f of features) {
    const m = /^(Perception|Fortitude|Reflex|Will) (Expertise|Mastery|Legend)$/i.exec(f.name)
    if (m) raise(m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), FEATURE_RANK[m[2].toLowerCase()])
    // Features like Juggernaut or Evasion are named freely, but state the rank increase in their text
    for (const grant of f.description.matchAll(/proficiency ranks? for ([^.]*?) increases? to (expert|master|legendary)/gi)) {
      for (const stat of grant[1].matchAll(/\b(Perception|Fortitude|Reflex|Will)\b/gi)) {
        raise(stat[1][0].toUpperCase() + stat[1].slice(1).toLowerCase(), RANKS.findIndex((r) => r.toLowerCase() === grant[2].toLowerCase()))
      }
    }
  }
  return ranks
}

// ---------- Skills & proficiencies ----------

export const CANNY_STATS = ['Fortitude', 'Perception', 'Reflex', 'Will']
export function cannyAcumenOptions(c: Character, entries: ContentEntry[]) {
  const ranks = ranksAt({ ...c, feats: c.feats.filter((feat) => feat.name !== 'Canny Acumen') }, entries)
  return CANNY_STATS.filter((stat) => (ranks[stat] ?? 0) < (c.level >= 17 ? 3 : 2))
}

const hasFeat = (c: Character, name: string) => c.feats.some((f) => f.name === name)

export const FAVORED_TERRAINS = ['Aquatic', 'Arctic', 'Desert', 'Forest', 'Mountain', 'Plains', 'Sky', 'Swamp', 'Underground']

export const isPioneerHuman = (c: Character) => c.heritage?.trim().toLowerCase() === 'pioneer human'

export const terrainExpertiseTerrains = (c: Character) =>
  [...FAVORED_TERRAINS, ...(c.systems.includes('sf2e') ? ['Space'] : [])].sort((a, b) => a.localeCompare(b))

export function terrainExpertiseOptions(c: Character, source: number | 'pioneer' = -1) {
  const used = new Set([
    ...c.feats.flatMap((feat, index) => feat.name === 'Terrain Expertise' && index !== source && feat.choice ? [feat.choice] : []),
    ...(isPioneerHuman(c) && source !== 'pioneer' && c.pioneerTerrain ? [c.pioneerTerrain] : []),
  ].map(terrain => terrain.trim().toLowerCase()))
  return terrainExpertiseTerrains(c).filter(terrain => !used.has(terrain.toLowerCase()))
}

export function terrainExpertiseBenefits(c: Character) {
  const choices = [
    ...activeFeatsNamed(c, 'Terrain Expertise').flatMap(feat => feat.choice ? [feat.choice] : []),
    ...(isPioneerHuman(c) && c.pioneerTerrain ? [c.pioneerTerrain] : []),
  ].map(terrain => terrain.trim().toLowerCase())
  const terrains = terrainExpertiseTerrains(c).filter(terrain => choices.includes(terrain.toLowerCase()))
  return terrains.length ? { terrains, bonus: c.activeFeatEffects?.includes('Terrain Expertise') ? 1 : 0 } : undefined
}

export function selectedFavoredTerrain(c: Character) {
  const original = activeFeatsNamed(c, 'Favored Terrain')[0]?.choice
  const temporary = activeFeatsNamed(c, 'Terrain Master').length ? c.favoredTerrain : undefined
  return temporary && FAVORED_TERRAINS.includes(temporary) ? temporary : original
}

export function favoredTerrainChange(c: Character, choice: string | undefined,
  index = c.feats.indexOf(activeFeatsNamed(c, 'Favored Terrain')[0])): Partial<Character> {
  return { feats: c.feats.map((feat, i) => i === index ? { ...feat, choice } : feat), favoredTerrain: undefined }
}

export function favoredTerrainBenefits(c: Character, entries: ContentEntry[]) {
  const terrain = selectedFavoredTerrain(c)
  if (!terrain || !FAVORED_TERRAINS.includes(terrain) || !isFeatEffectActive(c, 'Favored Terrain')) return undefined
  return { terrain, enhanced: c.className === 'Ranger' && c.level >= 11
    || classFeatures(entries, c).some(feature => feature.name === 'Unimpeded Journey') }
}

export function armorStrengthMet(c: Character, armor: ContentEntry, allowConstitution = true) {
  const threshold = num(armor.data.strength)
  const score = threshold >= 10 && !armor.systems.includes('sf2e')
  const strength = (score ? c.abilities.str : abilityMod(c.abilities.str))
    + (activeFeatsNamed(c, 'Thresher Ko-1 Frame').length ? score ? 4 : 2 : 0)
  const constitution = allowConstitution && isSoldier(c) ? score ? c.abilities.con : abilityMod(c.abilities.con) : -Infinity
  return threshold > 0 && Math.max(strength, constitution) >= threshold
}

export function armorBulk(c: Character, armor: ContentEntry, worn: boolean) {
  return worn && isSoldier(c) && armorStrengthMet(c, armor, false) && num(armor.data.bulk) > 1
    ? Math.max(1, num(armor.data.bulk) - 1) : armor.data.bulk
}

export function starfinderArmorPenalties(c: Character, entries: ContentEntry[]) {
  const worn = wornArmor(c, entries)
  const armor = worn && armorEntry(c, entries, worn.name)
  if (armor && !armor.systems.includes('sf2e')) {
    const base = Math.min(0, num(armor.data.speed_penalty))
    const meets = armorStrengthMet(c, armor)
    const mobility = activeFeatsNamed(c, 'Hellknight Mobility').length > 0 && armorCategory(armor) === 'Heavy'
    const iron = activeFeatsNamed(c, 'Unburdened Iron').length ? 5 : 0
    return { check: 0, speed: Math.min(0, base + iron + (meets ? mobility ? 10 : 5 : 0)) }
  }
  if (!armor) return { check: 0, speed: 0 }
  const meets = armorStrengthMet(c, armor)
  const check = meets ? 0 : Math.min(0, num(armor.data.check_penalty))
  const penalty = Math.min(0, num(armor.data.speed_penalty))
  const heavyConstruction = worn?.id === INVENTOR_ARMOR_ID && armorModifications(c).some(mod => mod.name === 'Heavy Construction')
  const mobility = activeFeatsNamed(c, 'Hellknight Mobility').length > 0 && armorCategory(armor) === 'Heavy'
  const iron = activeFeatsNamed(c, 'Unburdened Iron').length ? 5 : 0
  return { check, speed: heavyConstruction && meets ? 0 : Math.min(0, penalty + iron + (meets ? mobility ? 10 : 5 : 0)) }
}

type MovementSpeedOptions = { includeUncannyDash?: boolean }

export function speedBonuses(c: Character, entries: ContentEntry[] = [], options: MovementSpeedOptions = {}) {
  const terrain = favoredTerrainBenefits(c, entries)
  const mods = wornArmor(c, entries)?.id === INVENTOR_ARMOR_ID ? armorModifications(c) : []
  const names = new Set(mods.map(mod => mod.name))
  const overdrive = armorOverdriveActive(c)
  const booster = names.has('Hyper Boosters') ? overdrive
    ? (ranksAt(c, entries).Crafting ?? 0) >= 4 ? 30 : 20 : 10
    : names.has('Speed Boosters') ? overdrive ? 10 : 5 : 0
  const terrainSpeed = terrain?.enhanced && terrain.terrain === 'Plains' ? 10 : 0
  const dashSpeed = options.includeUncannyDash && activeFeatsNamed(c, 'Uncanny Dash').length
    && activeFeatsNamed(c, 'Gg-os Frame').length ? 10 : 0
  const skeletonSpeed = activeFeatsNamed(c, 'Reinforced Skeleton').length ? 5 : 0
  const fleet = activeFeatsNamed(c, 'Fleet').length ? 'Fleet'
    : activeFeatsNamed(c, 'Gg-os Frame').length ? 'Gg-os Frame (Fleet)' : undefined
  const status = [
    { source: `${names.has('Hyper Boosters') ? 'Hyper Boosters' : 'Speed Boosters'} (status)`, feet: booster },
    { source: 'Favored Terrain (Plains; status)', feet: terrainSpeed },
    { source: 'Uncanny Dash (status)', feet: dashSpeed },
    { source: 'Reinforced Skeleton (status)', feet: skeletonSpeed },
    { source: 'Athletic Rush (status)', feet: isSpellActive(c, entries, 'Athletic Rush') ? 10 : 0 },
    { source: 'Quantum Field (status)', feet: witchwarperParadox(c)?.name === 'Precog' && c.witchwarper?.movingInQuantumField ? 5 : 0 },
  ].sort((a, b) => b.feet - a.feet)[0]
  const armorPenalty = starfinderArmorPenalties(c, entries).speed
  return [...(fleet ? [{ source: fleet, feet: 5 }] : []),
    ...(hellknightBenefitActive(c, 'Trailblazing Stride') ? [{ source: 'Trailblazing Stride (circumstance)', feet: 10 }] : []),
    ...['Nimble Elf', 'Primal Nimbleness'].filter((name) => activeFeatsNamed(c, name).length).map((source) => ({ source, feet: 5 })),
    ...(status.feet > 0 ? [status] : []),
    ...(armorPenalty ? [{ source: 'Armor penalty', feet: armorPenalty }] : []),
    ...(activeFeatsNamed(c, 'Hellknight Mobility').length && activeFeatsNamed(c, 'Unburdened Iron').length
      && armorCategory(armorEntry(c, entries, wornArmor(c, entries)?.name ?? '')) === 'Heavy' && wornArmor(c, entries)
      ? [{ source: 'Hellknight Mobility', feet: 5 }] : [])]
}

// Land Speed: ancestry speed (25 if unknown) plus feat bonuses
export const speed = (c: Character, entries: ContentEntry[], options: MovementSpeedOptions = {}) =>
  Math.max(5, (num(byName(entries, 'ancestry', c.ancestry)?.data.speed) || 25)
    + speedBonuses(c, entries, options).reduce((sum, bonus) => sum + bonus.feet, 0))

export function ragingAthleteBenefits(c: Character, entries: ContentEntry[]) {
  if (!c.raging || !activeFeatsNamed(c, 'Raging Athlete').length) return undefined
  const land = speed(c, entries)
  return { jumpDCAdjustment: -10, longJumpExtra: 10, verticalLeap: 5,
    horizontalLeap: land >= 30 ? 20 : land >= 15 ? 15 : undefined }
}

export function magneticLevitatorsActive(c: Character, entries: ContentEntry[]) {
  const armor = wornArmor(c, entries)
  return c.className === 'Mechanic' && c.systems.includes('sf2e')
    && !!armor && !!c.mechanicArmorMods?.[armor.id]?.magneticLevitators
}

// Unconditional movement Speeds granted by ancestry and class feats
const ANCESTRY_MOVEMENT_FEATS: Record<string, Record<string, number>> = {
  'Aqueous Dragonblood': { Swim: 15 }, 'Burrowing Tripkee': { Burrow: 15 }, 'Cave Climber': { Climb: 10 }, 'Climbing Claws': { Climb: 10 },
  'Climbing Gremlin': { Climb: 20 }, 'Cunning Climber': { Climb: 10 }, 'Delver': { Burrow: 15 }, 'Digger': { Burrow: 15 },
  'Finned Ridges': { Swim: 15 }, 'Full Flight': { Fly: 25 }, 'Fully Flighted': { Fly: 25 }, 'Generation Digger': { Burrow: 15 },
  'Gremlin Aviator': { Fly: 25 }, 'Gripping Limbs': { Climb: 15 }, 'Heart of Earth': { Burrow: 15 }, "Hero's Wings": { Fly: 25 },
  'Into the Sky': { Fly: 25 }, 'One with Earth': { Burrow: 15 }, 'Powerful Tail': { Climb: 10 }, 'Practiced Paddler': { Swim: 15 },
  'Prodigious Climber': { Climb: 10 }, 'Scaling Poppet': { Climb: 15 }, 'Scuttle Up': { Climb: 10 }, 'Sea Legs': { Swim: 10 },
  'Skilled Climber': { Climb: 10 }, 'Skillful Climber': { Climb: 10 }, 'Soaring Form': { Fly: 20 }, 'Soaring Poppet': { Fly: 15 },
  'Sodbuster': { Burrow: 10 }, 'Summiting Dragonblood': { Climb: 20 }, 'Swift Swimmer': { Swim: 15 }, 'Swimming Poppet': { Swim: 15 },
  'Tree Climber (Goblin)': { Climb: 10 }, "True Dragon's Flight": { Fly: 20 }, 'Warren Digger': { Burrow: 15 },
}

export function movementSpeeds(c: Character, entries: ContentEntry[], options: MovementSpeedOptions = {}) {
  const trailblazing = hellknightBenefitActive(c, 'Trailblazing Stride') ? 10 : 0
  const land = speed(trailblazing ? { ...c, activeFeatEffects: c.activeFeatEffects?.filter(name => name !== 'Trailblazing Stride') } : c, entries, options)
  const dash = !!options.includeUncannyDash && activeFeatsNamed(c, 'Uncanny Dash').length > 0
    && activeFeatsNamed(c, 'Gg-os Frame').length > 0
  const armorPenalty = starfinderArmorPenalties(c, entries).speed
  const landStatus = speedBonuses(c, entries, options).find(bonus => bonus.source.endsWith('(status)'))?.feet ?? 0
  const fieldSpeed = witchwarperParadox(c)?.name === 'Precog' && c.witchwarper?.movingInQuantumField ? 5 : 0
  const skeletonStatus = activeFeatsNamed(c, 'Reinforced Skeleton').length ? 5 : 0
  const fixedStatus = Math.max(dash ? 10 : 0, fieldSpeed, skeletonStatus)
  const fixed = (name: string, feet: number, source: string) => ({
    name, feet: Math.max(5, feet + fixedStatus + armorPenalty), status: fixedStatus,
    source: `${source}${dash ? ', Uncanny Dash (+10 status)' : fieldSpeed ? ', Quantum Field (+5 status)'
      : skeletonStatus ? ', Reinforced Skeleton (+5 status)' : ''}${armorPenalty ? `, armor (${armorPenalty})` : ''}`,
  })
  const atLandSpeed = (name: string, source: string) => ({ name, feet: land, source, status: landStatus })
  const features = activeAnimalFeatures(c, entries)
  const movement: { name: string; feet: number; source: string; status: number }[] = [
    ...(features.includes('Fish Tail') ? [atLandSpeed('Swim', 'Animal Feature')] : []),
    ...(features.includes('Wings') ? [atLandSpeed('Fly', 'Animal Feature')] : []),
    ...(isSpellActive(c, entries, 'Stormwind Flight') ? [atLandSpeed('Fly', 'Stormwind Flight')] : []),
    ...(activeUntamedShiftEffects(c, entries).includes('Wings') ? [fixed('Fly', 30, 'Untamed Shift')] : [])]
  if (characterHeritages(c, entries).some(heritage => heritage.name === 'Aquatic Elf')) {
    movement.push(fixed('Swim', 30, 'Aquatic Elf'))
  }
  if (magneticLevitatorsActive(c, entries)) movement.push(fixed('Fly', 10, 'Magnetic Levitators'))
  if (activeFeatsNamed(c, 'Soaring Armor').length && wornArmor(c, entries)?.id === INVENTOR_ARMOR_ID) {
    movement.push(atLandSpeed('Fly', 'Soaring Armor'))
  }
  if (!getSettings().championFormNoFlight) {
    for (const name of ['Celestial Form', 'Fiendish Form']) {
      if (activeFeatsNamed(c, name).length) movement.push(atLandSpeed('Fly', name))
    }
  }
  if (activeFeatsNamed(c, 'Natural Swimmer').length) movement.push(fixed('Swim', 15, 'Natural Swimmer'))
  if (activeFeatsNamed(c, "Gecko's Grip").length
    && characterHeritages(c, entries).some(heritage => heritage.name === 'Cliffscale Lizardfolk')) {
    movement.push(fixed('Climb', 15, "Gecko's Grip"))
  }
  if (activeFeatsNamed(c, 'Burrowing Specialist').length) {
    const source = selectedFeatEntry(c, entries, 'Burrowing Specialist')
    const feet = Number(/Option\(s\):\s*(\d+)\s*(?:feet|ft)/i.exec(source?.description ?? '')?.[1])
    if (feet > 0) movement.push(fixed('Burrow', feet, 'Burrowing Specialist'))
  }
  if (activeFeatsNamed(c, 'Tree Climber').length && ancestryFeatTraits(c).includes('elf')) movement.push(fixed('Climb', 10, 'Tree Climber'))
  for (const [feat, speeds] of Object.entries(ANCESTRY_MOVEMENT_FEATS)) {
    if (!activeFeatsNamed(c, feat).length) continue
    for (const [name, feet] of Object.entries(speeds)) {
      const swiftSwimmerSpeed = feat === 'Swift Swimmer' && characterHeritages(c, entries)
        .some(heritage => heritage.name === 'Wetlander Lizardfolk') ? 25 : feet
      movement.push(fixed(name, swiftSwimmerSpeed, feat))
    }
  }
  if (c.raging && activeFeatsNamed(c, "Dragon's Rage Wings").length) movement.push(atLandSpeed('Fly', "Dragon's Rage Wings"))
  if (isFeatEffectActive(c, "Implement's Flight") && activeFeatsNamed(c, "Implement's Flight").length) {
    movement.push(atLandSpeed('Fly', "Implement's Flight"))
  }
  if (activeFeatsNamed(c, 'Flamboyant Athlete').length) {
    for (const name of ['Climb', 'Swim']) movement.push({ name, feet: Math.floor(land / 2 / 5) * 5, source: 'Flamboyant Athlete', status: 0 })
  }
  if (ragingAthleteBenefits(c, entries)) {
    for (const name of ['Climb', 'Swim']) movement.push(atLandSpeed(name, 'Raging Athlete'))
  }
  if (canopyCrawlerAffects(c, entries)) {
    const fastest = [atLandSpeed('Land', ''), ...movement].reduce((best, candidate) => candidate.feet > best.feet
      || candidate.feet === best.feet && candidate.status < best.status ? candidate : best)
    movement.push({ ...fastest, name: 'Climb', source: 'Canopy Crawler' })
  }
  const merged = new Map<string, typeof movement[number]>()
  for (const candidate of movement) {
    const previous = merged.get(candidate.name)
    if (!previous || candidate.feet > previous.feet) merged.set(candidate.name, { ...candidate })
    else if (candidate.feet === previous.feet) {
      previous.source += `, ${candidate.source}`
      previous.status = Math.min(previous.status, candidate.status)
    }
  }
  const terrain = favoredTerrainBenefits(c, entries)
  if (terrain?.enhanced) {
    const name = terrain.terrain === 'Aquatic' ? 'Swim'
      : ['Forest', 'Mountain', 'Underground'].includes(terrain.terrain) ? 'Climb' : terrain.terrain === 'Sky' ? 'Fly' : undefined
    if (name) {
      const previous = merged.get(name)
      const source = `Favored Terrain (${terrain.terrain})`
      if (previous) {
        const extra = Math.max(0, 10 - previous.status)
        if (extra) merged.set(name, { name, feet: previous.feet + extra, status: 10, source: `${previous.source}, ${source} (+10 status)` })
      } else if (name !== 'Fly') merged.set(name, { ...atLandSpeed(name, source) })
    }
    if (canopyCrawlerAffects(c, entries)) {
      const climb = merged.get('Climb')
      const fastest = [atLandSpeed('Land', ''), ...merged.values()].reduce((best, candidate) => candidate.feet > best.feet ? candidate : best)
      if (climb && climb.feet < fastest.feet) merged.set('Climb', { ...fastest, name: 'Climb', source: 'Canopy Crawler' })
    }
  }
  return [{ name: 'Land', feet: land, source: undefined }, ...[...merged.values()]
    .sort((a, b) => a.name.localeCompare(b.name)).map(({ name, feet, source }) => ({ name, feet, source }))]
    .map(movement => trailblazing ? { ...movement, feet: movement.feet + trailblazing,
      source: [movement.source, 'Trailblazing Stride (+10 circumstance)'].filter(Boolean).join(', ') } : movement)
}

function parryBonusFromText(text: string) {
  if (!/\bparry\b/i.test(text)) return 0
  let bonus = 0
  for (const pattern of [
    /\+(\d+)\s*circumstance bonus to AC/gi,
    /circumstance bonus to AC[^.]{0,120}parry[^.]{0,120}\+(\d+)/gi,
    /parry[^.]{0,120}increases?[^.]{0,80}\+(\d+)/gi,
  ]) {
    for (const match of text.matchAll(pattern)) bonus = Math.max(bonus, Number(match[1]))
  }
  return bonus
}

function hasParryTrait(entry?: ContentEntry) {
  return !!entry && [...entry.traits, ...tokens(entry.data.trait)].some(trait => trait.toLowerCase() === 'parry')
}

function defensiveArmamentsParry(c: Character, weapon: OwnedWeapon, entry = weaponEntry([], weapon.name)) {
  const group = String(entry?.data.weapon_group ?? '').toLowerCase()
  return activeFeatsNamed(c, 'Defensive Armaments').length > 0 && weaponHands(entry ? [entry] : [], weapon, c) === 2
    && (group === 'crossbow' || group === 'firearm')
}

function weaponHasParry(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const enhanced = effectiveWeapon(c, entries, weapon)
  const entry = weaponEntry(entries, enhanced.name)
  return hasParryTrait(entry) || (activeFeatsNamed(c, 'Raise Haft').length > 0
    && weaponHands(entries, enhanced, c) === 2) || defensiveArmamentsParry(c, enhanced, entry)
    || enhanced.runes.some(rune => runeName(rune) === 'Parrying'
      && weaponRuneApplies(entries, enhanced, rune)) && weaponAttack(c, entries, weapon).rank > 0
    || installedWeaponUpgrades(c, entries, weapon).some(upgrade => /^Protection Grid(?:\s*\(|$)/i.test(upgrade.name))
}

export function availableStances(c: Character, entries: ContentEntry[]) {
  const stances = new Map<string, ContentEntry>()
  for (const feat of [...c.feats.filter(feat => featTakenLevel(feat) <= c.level), ...automaticFeatGrants(c, entries)]) {
    const entry = selectedFeatEntry(c, entries, feat.name, 'sourceId' in feat ? feat.sourceId : undefined)
    if (entry && entry.level <= c.level && isStanceFeat(entry)) {
      const title = featDisplayName(entry)
      if (!stances.has(title) || entry.name === c.activeStance) stances.set(title, entry)
    }
  }
  return [...stances.values()].sort((a, b) =>
    adoptedAncestryText(c, featDisplayName(a)).localeCompare(adoptedAncestryText(c, featDisplayName(b))))
}

export const activeStance = (c: Character, entries: ContentEntry[]) =>
  c.activeStance ? availableStances(c, entries).find(entry => entry.name === c.activeStance) : undefined

function twinParryValue(c: Character, entries: ContentEntry[]) {
  if (!activeFeatsNamed(c, 'Twin Parry').length) return 0
  const meleeWeapons = ownedWeapons(c, entries).filter(weapon => {
    const entry = weaponEntry(entries, weapon.name)
    const melee = /melee/i.test(String(entry?.data.weapon_type ?? '')) || !isRanged(entry)
    return weaponEquipped(c, entries, weapon) && !!entry && weaponCategory(entry) !== 'Unarmed' && melee
  })
  const oneHanded = meleeWeapons.filter(weapon => weaponHands(entries, weapon, c) === 1)
  const freeHandWeapons = meleeWeapons.filter(weapon => {
    const entry = weaponEntry(entries, weapon.name)
    return [...(entry?.traits ?? []), ...tokens(entry?.data.trait)].some(trait => /^free[- ]hand$/i.test(trait))
  })
  const freeHands = Math.max(0, totalHandCapacity(c) - equippedHands(c, entries))
  // The house rule lets a worn free-hand weapon pair with an unarmed attack even with occupied hands.
  const unarmed = getSettings().unarmedCountsAsWeapons
  const freeHandCount = unarmed
    ? Math.max(freeHands, freeHandWeapons.length > 0 ? 2 : 0)
    : Math.min(freeHands, freeHandWeapons.length)
  if (oneHanded.length + freeHandCount < 2) return 0
  return oneHanded.some(weapon => weaponHasParry(c, entries, weapon))
    || (unarmed || freeHands > 0) && freeHandWeapons.some(weapon => weaponHasParry(c, entries, weapon)) ? 2 : 1
}

export function hasParryWeapon(c: Character, entries: ContentEntry[]) {
  return ownedWeapons(c, entries).some(weapon => weaponEquipped(c, entries, weapon) && weaponHasParry(c, entries, weapon))
    || twinParryValue(c, entries) > 0
}

function parryFeatEntries(c: Character, entries: ContentEntry[]) {
  return c.feats.filter(feat => featTakenLevel(feat) <= c.level).map(feat => selectedFeatEntry(c, entries, feat.name, feat.sourceId)).filter((entry): entry is ContentEntry => !!entry)
}

export function parryValue(c: Character, entries: ContentEntry[]) {
  const featEntries = parryFeatEntries(c, entries).filter(entry => entry.name !== 'Twin Parry')
  const hasWeapon = hasParryWeapon(c, entries)
  if (!hasWeapon) return 0
  const featBonus = featEntries.reduce((best, entry) => Math.max(best, parryBonusFromText(entry.description)), 0)
  const raisedHaftBonus = activeFeatsNamed(c, 'Raise Haft').length > 0
    && ownedWeapons(c, entries).some(weapon => weaponEquipped(c, entries, weapon)
      && weaponHands(entries, weapon, c) === 2 && hasParryTrait(weaponEntry(entries, weapon.name))) ? 2 : 0
  const tacticalGrid = ownedWeapons(c, entries).some(weapon => weaponEquipped(c, entries, weapon)
    && installedWeaponUpgrades(c, entries, weapon).some(upgrade => /^Protection Grid \(Tactical\)$/i.test(upgrade.name)))
  return Math.max(1, featBonus, raisedHaftBonus, twinParryValue(c, entries), tacticalGrid ? 2 : 0)
}

export const twinnedDefenseActive = (c: Character, entries: ContentEntry[]) =>
  featDisplayName(activeStance(c, entries)) === 'Twinned Defense Stance' && twinParryValue(c, entries) > 0

export const parryBonus = (c: Character, entries: ContentEntry[]) =>
  Math.max(c.parrying ? parryValue(c, entries) : 0, twinnedDefenseActive(c, entries) ? twinParryValue(c, entries) : 0)

const TRADITION_SKILLS = [['Arcane', 'Arcana'], ['Divine', 'Religion'], ['Occult', 'Occultism'], ['Primal', 'Nature']] as const

function researchedTraditionOptions(ranks: Record<string, number>, traditions: string[]) {
  const capacity = 1 + TRADITION_SKILLS.filter(([tradition, skill]) =>
    traditions.includes(tradition) && (ranks[skill] ?? 0) >= 3).length
  return traditions.length < capacity ? TRADITION_SKILLS.filter(([tradition, skill]) =>
    !traditions.includes(tradition) && (ranks[skill] ?? 0) >= (traditions.length ? 1 : 2))
    .map(([tradition]) => tradition) : []
}

function researchedSpellResistanceVariants(c: Character, entries: ContentEntry[]) {
  const ranks = ranksAt(c, entries)
  const variants = new Map<string, string>()
  const visit = (traditions: string[]) => {
    for (const tradition of researchedTraditionOptions(ranks, traditions)) {
      const next = [...traditions, tradition]
      const key = [...next].sort().join(', ')
      if (variants.has(key)) continue
      variants.set(key, next.join(', '))
      visit(next)
    }
  }
  visit([])
  return [...variants.values()].sort((a, b) => a.localeCompare(b))
}

export function researchedSpellResistanceChoices(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  const ranks = ranksAt(c, entries)
  const saved = feat.choice?.split(',').map(value => value.trim()).filter(Boolean) ?? []
  const traditions: string[] = []
  const rows: { value: string; options: string[] }[] = []
  for (let index = 0; index < 4; index++) {
    const value = saved[index] ?? ''
    const options: string[] = traditions.length === index
      ? researchedTraditionOptions(ranks, traditions)
      : []
    if (!value && index > 0 && !options.length) break
    rows.push({ value, options })
    if (!value) break
    if (options.includes(value)) {
      traditions.push(value)
    }
  }
  return { rows, traditions }
}

export function researchedSpellResistance(c: Character, entries: ContentEntry[]) {
  const feat = activeFeatsNamed(c, 'Researched Spell Resistance')[0]
  if (!feat) return undefined
  const { traditions } = researchedSpellResistanceChoices(c, entries, feat)
  return traditions.length ? { traditions, bonus: 1 } : undefined
}

export function perceptionCircumstance(c: Character) {
  if (activeFeatsNamed(c, 'Superior Sight').length) return { value: 2, source: 'Superior Sight' }
}

export const perceptionCircumstanceBonus = (c: Character) => perceptionCircumstance(c)?.value ?? 0

export const initiativeBonus = (c: Character, entries: ContentEntry[]) =>
  defenseSummary(c, entries).perception - perceptionCircumstanceBonus(c)
    + Math.max(['Superior Sight', 'Incredible Initiative'].some((name) => activeFeatsNamed(c, name).length) ? 2 : 0,
      wornArmor(c, entries)?.material === 'Orichalcum' ? 1 : 0)

export const RANKS = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary']

export interface StatDef { name: string; ability: Ability; kind: 'skill' | 'save' | 'perception' }

export function statDefs(c: Character): StatDef[] {
  const nimble = c.level >= 4 && activeFeatsNamed(c, 'Nimble Athlete').length > 0
  const skills: [string, Ability][] = [
    ['Acrobatics', 'dex'], ['Arcana', 'int'], ['Athletics', nimble && c.abilities.dex > c.abilities.str ? 'dex' : 'str'], ['Crafting', 'int'], ['Deception', 'cha'],
    ['Diplomacy', 'cha'], ['Intimidation', 'cha'], ['Medicine', 'wis'], ['Nature', 'wis'], ['Occultism', 'int'],
    ['Performance', 'cha'], ['Religion', 'wis'], ['Society', 'int'], ['Stealth', 'dex'], ['Survival', 'wis'],
    ['Thievery', 'dex'],
  ]
  if (c.systems.includes('sf2e')) skills.push(['Computers', 'int'], ['Piloting', 'dex'])
  skills.sort((a, b) => a[0].localeCompare(b[0]))
  return [
    { name: 'Perception', ability: 'wis', kind: 'perception' },
    { name: 'Fortitude', ability: 'con', kind: 'save' },
    { name: 'Reflex', ability: 'dex', kind: 'save' },
    { name: 'Will', ability: 'wis', kind: 'save' },
    ...skills.map(([name, ability]): StatDef => ({ name, ability, kind: 'skill' })),
  ]
}

const rankFromText = (v: unknown) => {
  const i = RANKS.findIndex((r) => typeof v === 'string' && v.toLowerCase().includes(r.toLowerCase()))
  return i < 0 ? 0 : i
}

// Class text looks like "Trained in Intimidation" / "Trained in a number of additional skills equal to 3 plus your Intelligence modifier"
export function classSkills(klass?: ContentEntry) {
  const lines = tokensLoose(klass?.data.skill_proficiency)
  const fixed = lines.flatMap((l) => {
    const m = /^trained in (?!a number|(?:one|two|three) (?:or more|of|skills? determined|skills? based)|your choice)(.+)$/i.exec(l)
    return m ? m[1].split(/,| and /).map((s) => s.trim()).filter(Boolean) : []
  })
  const choices = lines.flatMap((l) => {
    const m = /^trained in (?:your choice of\s+|one of\s+(?:the following skills of your choice:\s*)?)(.+)$/i.exec(l)
    return m ? [m[1].split(/,| or /).map((x) => x.trim()).filter(Boolean)] : []
  })[0] ?? []
  const extra = lines.map((l) => /additional skills? equal to (\d+)/i.exec(l)).find(Boolean)
  if (klass?.name === 'Fighter' && getSettings().fighterPhysicalSkills) {
    return { fixed: [...new Set([...fixed, 'Acrobatics', 'Athletics'])], choices: [], additional: extra ? +extra[1] : 0 }
  }
  return { fixed, choices, additional: extra ? +extra[1] : 0 }
}

// Some Starfinder class records concatenate proficiency sentences without commas.
const tokensLoose = (v: unknown) => (typeof v === 'string' ? v.split(/(?:,\s*|\s+)(?=Trained in\b)/i).map((t) => t.trim()) : [])

// The skill each druidic order grants
export const DRUID_ORDERS: Record<string, string> = {
  Animal: 'Athletics', Flame: 'Acrobatics', Leaf: 'Diplomacy', Stone: 'Crafting', Storm: 'Acrobatics', Wave: 'Medicine', Wild: 'Intimidation',
}

function normalizeDruidOrder(order?: string) {
  return order === 'Untamed' ? 'Wild' : order
}

const INVESTIGATOR_SKILLS: Record<string, string> = {
  'Alchemical Sciences': 'Crafting', 'Forensic Medicine': 'Medicine', Interrogation: 'Diplomacy',
}
const SWASHBUCKLER_SKILLS: Record<string, string> = {
  Battledancer: 'Performance', Braggart: 'Intimidation', Fencer: 'Deception',
  Gymnast: 'Athletics', Rascal: 'Thievery', Wit: 'Diplomacy',
}
const DRACONIC_SKILLS: Record<string, string> = {
  Arcane: 'Arcana', Divine: 'Religion', Occult: 'Occultism', Primal: 'Nature',
}

export function subclassSkillChoice(c: Character, entries: ContentEntry[]) {
  const subclass = selectedSubclass(c, entries)
  const key = `${c.className}:${subclass}`
  if (c.className === 'Investigator' && subclass === 'Empiricism') {
    return { key, label: 'Methodology skill', options: [...statDefs(c).filter(stat => stat.kind === 'skill' && stat.ability === 'int').map(stat => stat.name), 'Lore'].sort() }
  }
  if (c.className === 'Investigator' && subclass === 'Esoterica') {
    return { key, label: 'Methodology skill', options: ['Occultism', 'Religion'] }
  }
  if (c.className === 'Sorcerer' && subclass === 'Draconic') {
    return { key, label: 'Draconic exemplar', options: Object.keys(DRACONIC_SKILLS).sort() }
  }
  if (c.className === 'Oracle' && subclass === 'Lore') {
    return { key, label: 'Mystery Lore', options: [] }
  }
}

export function subclassSkillGrants(c: Character, entries: ContentEntry[]): string[] {
  if (c.level < 1 || !c.className) return []
  const erudite = eruditeWarrior(c)
  if (erudite) return [erudite.skill, ...(erudite.lore ? [erudite.lore] : [])]
  const subclass = selectedSubclass(c, entries)
  if (!subclass) return []
  if (c.className === 'Druid') return DRUID_ORDERS[subclass] ? [DRUID_ORDERS[subclass]] : []
  const option = subclassOptions(c, entries).find(entry => entry.name === subclass)
  const selected = c.subclassSkillChoices?.[`${c.className}:${subclass}`]
  if (c.className === 'Investigator') {
    const skill = INVESTIGATOR_SKILLS[subclass]
    if (skill) return [skill]
    if (subclass === 'Esoterica' && selected && ['Occultism', 'Religion'].includes(selected)) return [selected]
    if (subclass === 'Empiricism' && selected) {
      if (selected === 'Lore') {
        const lore = c.subclassSkillChoices?.[`${c.className}:${subclass}:lore`]?.trim()
        return lore && / lore$/i.test(lore) ? [lore] : []
      }
      if (statDefs(c).some(stat => stat.kind === 'skill' && stat.ability === 'int' && stat.name === selected)) return [selected]
    }
    return []
  }
  if (c.className === 'Swashbuckler') return SWASHBUCKLER_SKILLS[subclass] ? [SWASHBUCKLER_SKILLS[subclass]] : []
  if (['Witch', 'Oracle', 'Sorcerer', 'Envoy', 'Mystic', 'Operative', 'Witchwarper'].includes(c.className)) {
    const skills = tokens(option?.data.skill)
    if (c.className === 'Sorcerer' && subclass === 'Draconic' && selected && DRACONIC_SKILLS[selected]) skills.push(DRACONIC_SKILLS[selected])
    if (c.className === 'Oracle' && subclass === 'Lore') {
      const lore = selected?.trim()
      if (lore && / lore$/i.test(lore)) skills.push(lore)
    }
    return skills
  }
  return []
}

// The initial order spell (a focus spell) each druidic order grants
export const ORDER_SPELLS: Record<string, string> = {
  Animal: 'Heal Animal', Flame: 'Wildfire', Leaf: 'Cornucopia', Stone: 'Crushing Ground', Storm: 'Tempest Surge', Wave: 'Rising Surf', Wild: 'Untamed Shift',
}

// Orders picked with Order Explorer that an Order Magic feat can still take the spell of
export const orderMagicOptions = (c: Character, exceptIndex = -1) => {
  const used = new Set(c.feats.flatMap((f, i) => f.name === 'Order Magic' && i !== exceptIndex && f.choice ? [normalizeDruidOrder(f.choice)] : []))
  return c.feats.flatMap((f) => {
    const order = normalizeDruidOrder(f.choice)
    return f.name === 'Order Explorer' && order && !used.has(order) ? [order] : []
  })
}

const spellNameCache = new WeakMap<ContentEntry[], Map<string, string>>()
const spellName = (entries: ContentEntry[], name: string) => {
  if (name.toLowerCase() === 'goodberry') name = 'Cornucopia'
  let map = spellNameCache.get(entries)
  if (!map) {
    map = new Map()
    for (const e of entries) if (e.kind === 'spell') map.set(e.name.toLowerCase(), e.name)
    spellNameCache.set(entries, map)
  }
  return map.get(name.toLowerCase()) ?? name.replace(/\b\w/g, (m) => m.toUpperCase())
}

// Focus spells from the druid's order, Order Magic and feats that grant one; plus the resulting Focus Points
export function focusSpells(c: Character, entries: ContentEntry[]) {
  const out = new Map<string, { name: string; source: string }>()
  const add = (name: string, source: string) => {
    name = spellName(entries, name)
    if (!out.has(name.toLowerCase())) out.set(name.toLowerCase(), { name, source })
  }
  const active = c.feats.filter(feat => featTakenLevel(feat) <= c.level)
  const paradox = witchwarperParadox(c)
  if (paradox) add(paradox.initialWarpSpell, `${paradox.name} paradox`)
  const champion = c.className === 'Champion' && c.level >= 1
  const devotionAvailable = c.devotionSpell && (championDevotionOptions(c, entries).includes(c.devotionSpell)
    || !!c.deity && !byName(entries, 'deity', c.deity))
  if (champion && c.devotionSpell && devotionAvailable) {
    add(c.devotionSpell, 'Devotion Spells')
  }
  const orders = c.className === 'Druid' ? [selectedSubclass(c, entries), ...active.flatMap((f) => f.name === 'Order Explorer' ? [normalizeDruidOrder(f.choice)] : [])] : []
  const addOrder = (raw?: string) => {
    const order = normalizeDruidOrder(raw)
    if (order && ORDER_SPELLS[order]) add(ORDER_SPELLS[order], `${order} Order`)
  }
  if (c.className === 'Druid') {
    addOrder(selectedSubclass(c, entries))
    for (const f of active) if (f.name === 'Order Magic') addOrder(f.choice)
  }
  let points = 0
  let bonusPoints = 0
  for (const f of active) {
    const data = selectedFeatEntry(c, entries, f.name, f.sourceId)?.data
    if (!data) continue
    if (typeof data.grants_focus_spells === 'string') for (const n of data.grants_focus_spells.split(', ')) add(n, f.name)
    if (typeof data.grants_order_spells === 'string') {
      for (const pair of data.grants_order_spells.split(', ')) {
        const [order, spell] = pair.split(':')
        if (orders.some((o) => o?.toLowerCase() === order)) add(spell, f.name)
      }
    }
    if (data.grants_focus_point) {
      points++
      if (!data.grants_focus_spells && !data.grants_order_spells
        && !selectedFeatEntry(c, entries, f.name, f.sourceId)?.spellGrants?.some(grant => grant.kind === 'focus')) bonusPoints++
    }
  }
  for (const grant of grantedFeatSpells(c, entries)) if (grant.rule.kind === 'focus') add(grant.entry.name, grant.source)
  if (activeFeatsNamed(c, 'Untamed Form').length) add('Untamed Form', 'Untamed Form')
  const spells = [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
  const pool = new Set([...spells.map(spell => spell.name), ...grantedWardenSpells(c, entries).map(spell => spell.name)])
  const nonCantrips = [...pool].filter(name => !byName(entries, 'spell', name)?.traits.some(trait => trait.toLowerCase() === 'cantrip')).length
  return { spells, points: pool.size || champion
    ? Math.min(3, Math.max(nonCantrips + bonusPoints + (champion && !devotionAvailable ? 1 : 0), 1 + points)) : 0 }
}

export function championDevotionOptions(c: Character, entries: ContentEntry[]): NonNullable<Character['devotionSpell']>[] {
  const font = tokens(byName(entries, 'deity', c.deity)?.data.divine_font).map(value => value.toLowerCase())
  return ['Shields of the Spirit', ...(font.includes('heal') ? ['Lay on Hands' as const] : []),
    ...(font.includes('harm') ? ['Touch of the Void' as const] : [])]
}

// Orders not yet used by the main order or another Order Explorer feat
export function availableOrders(c: Character, exceptIndex = -1) {
  const used = new Set([selectedSubclass(c), ...c.feats.flatMap((f, i) => f.name === 'Order Explorer' && i !== exceptIndex ? [normalizeDruidOrder(f.choice)] : [])])
  return Object.keys(DRUID_ORDERS).filter((o) => !used.has(o))
}

// Skills the class grants: fixed, chosen, or tied to an order or Champion deity. They are always trained; the house rule
// (autoClassSkills) also ranks them up at every skill increase the level cap allows, without using the character's own increases.
export function autoClassSkills(c: Character, entries: ContentEntry[]) {
  const { fixed, choices } = classSkills(byName(entries, 'class', c.className))
  const explored = c.className === 'Druid' && getSettings().orderExplorerSkills
    ? activeFeatsNamed(c, 'Order Explorer').flatMap(feat => {
      const order = normalizeDruidOrder(feat.choice)
      return order && DRUID_ORDERS[order] ? [DRUID_ORDERS[order]] : []
    })
    : []
  const picked = c.classSkill && choices.includes(c.classSkill) ? c.classSkill : undefined
  const rackets = rogueRackets(c, entries)
  const divine = c.className === 'Champion' || rackets.includes('Avenger') ? tokens(byName(entries, 'deity', c.deity)?.data.skill) : []
  const extra = c.rogueRacketSkills?.Mastermind
  const racketSkills = [
    ...(rackets.includes('Thief') ? ['Thievery'] : []),
    ...(rackets.includes('Ruffian') ? ['Intimidation'] : []),
    ...(rackets.includes('Scoundrel') ? ['Deception', 'Diplomacy'] : []),
    ...(rackets.includes('Mastermind') ? ['Society', ...(extra && SCRAPPER_SKILLS.includes(extra) ? [extra] : [])] : []),
  ]
  return [...new Set([...fixed, ...(picked ? [picked] : []), ...subclassSkillGrants(c, entries), ...explored, ...divine, ...racketSkills])]
}

export function selectedSubclass(c: Character, entries: ContentEntry[] = []) {
  const saved = c.className === 'Druid' ? c.order : c.subclass
  if (saved !== undefined) return c.className === 'Druid' ? normalizeDruidOrder(saved) : saved
  const raw = c.imported?.raw
  const build = raw && typeof raw === 'object' && 'build' in raw ? raw.build : raw
  const specials = build && typeof build === 'object' && 'class' in build && build.class === c.className
    && 'specials' in build && Array.isArray(build.specials) ? build.specials : []
  const names = new Set([...c.feats.flatMap((feat) => [feat.name,
    ...(['Second Innovation', 'Third Innovation', 'Versatile Rogue', 'Multifarious Muse'].includes(feat.name) ? [] : [feat.choice])]), ...specials]
    .filter((name): name is string => typeof name === 'string').map((name) => name.replace(/ (?:Instinct|Order)$/, '')))
  if (c.className === 'Druid') {
    const explored = new Set(c.feats.flatMap((feat) => feat.name === 'Order Explorer' && feat.choice ? [normalizeDruidOrder(feat.choice)] : []))
    return [...names].map(order => normalizeDruidOrder(order)!)
      .find((order) => Object.hasOwn(DRUID_ORDERS, order) && !explored.has(order))
  }
  return subclassOptions(c, entries).find((entry) => names.has(entry.name))?.name
}

export function classLabel(c: Character, entries: ContentEntry[] = []) {
  if (!c.className) return ''
  const subclass = selectedSubclass(c, entries)
  if (!subclass) return c.className
  if (c.className === 'Champion') return `Champion of ${subclass}`
  if (c.className === 'Druid') return `Druid of the ${subclass === 'Wild' ? 'Untamed' : subclass} Order`
  if (c.className === 'Barbarian') return `${subclass.replace(/ Instinct$/, '')} Instinct Barbarian`
  if (c.className === 'Ranger') return `${subclass.replace(/ Edge$/, '')} Edge Ranger`
  if (c.className === 'Rogue') return `${subclass.replace(/ Racket$/, '')} Racket Rogue`
  if (c.className === 'Bard') return `${subclass.replace(/ Muse$/, '')} Muse Bard`
  return `${subclass} ${c.className}`
}

const subclassOptionsCache = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()
export function subclassOptions(c: Character, entries: ContentEntry[]) {
  let cache = subclassOptionsCache.get(entries)
  if (!cache) {
    cache = new Map()
    subclassOptionsCache.set(entries, cache)
  }
  const key = `${c.className ?? ''}\0${[...c.systems].sort().join(',')}`
  const cached = cache.get(key)
  if (cached) return cached
  const options = entries.filter((entry) => entry.kind === 'subclass' && !entry.deleted && entry.data.class === c.className
    && entry.systems.some(system => c.systems.includes(system)))
  const result = [...options, ...(c.systems.includes('sf2e') ? STARFINDER_SUBCLASSES.filter(entry =>
    entry.data.class === c.className && !options.some(existing => existing.name === entry.name && existing.systems.includes('sf2e'))) : [])]
    .sort((a, b) => a.name.localeCompare(b.name))
  cache.set(key, result)
  return result
}

export const backgroundHasTerrainLore = (bg?: ContentEntry) =>
  typeof bg?.data.skill === 'string' && bg.data.skill.split(/,\s*(?![^()]*\))/).some(skill =>
    /\blore\b/i.test(skill) && /\bterrain\b/i.test(skill) && !/^[\w' -]+ Lore$/i.test(skill.trim()))

export type BackgroundVariant = { value: string; background: ContentEntry; terrain?: string; lore?: string; custom?: boolean }

export function backgroundVariants(options: ContentEntry[], lores: string[] = []) {
  return options.filter(background => !background.data.background_choice_required)
    .flatMap<BackgroundVariant>(background => {
      const available = backgroundLoreOptions(background, lores)
      return backgroundHasTerrainLore(background)
        ? FAVORED_TERRAINS.map(terrain => ({ value: `${background.name} (${terrain} Lore)`, background, terrain }))
        : backgroundLoreCount(background) && available.length
          ? [...(backgroundLoreCount(background) === 1 ? available.map(lore => ({
            value: `${background.name} (${lore})`, background, lore,
          })) : []), { value: `${background.name} (Custom${available === lores ? '' : ' Profession'} Lore)`, background, custom: true }]
          : [{ value: background.name, background }]
    })
}

function backgroundLoreChoices(bg: ContentEntry, c?: Character) {
  const seen = new Set<string>()
  return Array.from({ length: backgroundLoreCount(bg) }, (_, index) => {
    const name = (c?.backgroundLores?.[bg.name]?.[index] ?? '').trim().replace(/\s+/g, ' ')
    if (!/^.+\s+lore$/i.test(name) || seen.has(name.toLowerCase())) return ''
    seen.add(name.toLowerCase())
    return name
  })
}

export function backgroundSkills(bg?: ContentEntry, c?: Character) {
  const skills = typeof bg?.data.skill === 'string' ? bg.data.skill.split(/,\s*(?![^()]*\))/).map(skill => skill.trim()).filter(Boolean) : []
  const terrain = bg && c?.backgroundTerrainLore?.[bg.name]
  const selected = bg ? backgroundLoreChoices(bg, c).filter(Boolean) : []
  const skillChoice = bg && c?.backgroundSkillChoices?.[bg.name]
  return [...skills.flatMap(skill => isOpenBackgroundLore(skill)
    ? /\bterrain\b/i.test(skill) && !selected.length && terrain && FAVORED_TERRAINS.includes(terrain) ? [`${terrain} Lore`] : [] : [skill]),
  ...selected, ...(skillChoice && tokens(bg?.data.background_skill_options).includes(skillChoice) ? [skillChoice] : [])]
}

export function backgroundSkillSlots(c: Character, entries: ContentEntry[]) {
  if (c.level < 1) return []
  return [byName(entries, 'background', c.background), freeHeartBackground(c, entries)].flatMap(background => {
    const options = tokens(background?.data.background_skill_options)
    if (!background || !options.length) return []
    const saved = c.backgroundSkillChoices?.[background.name]
    return [{ background, options, value: saved && options.includes(saved) ? saved : '' }]
  })
}

export function backgroundLoreSlots(c: Character, entries: ContentEntry[]) {
  if (c.level < 1) return []
  return [byName(entries, 'background', c.background), freeHeartBackground(c, entries)].flatMap(background => {
    if (!background || backgroundHasTerrainLore(background) && c.backgroundTerrainLore?.[background.name]) return []
    const legacy = c.backgroundTerrainLore?.[background.name]
    return backgroundLoreChoices(background, c).map((value, index) => ({
      background, index, value: value || (index === 0 && legacy && FAVORED_TERRAINS.includes(legacy) ? `${legacy} Lore` : ''),
    }))
  })
}
export function backgroundLoreIncreaseSlots(c: Character, entries: ContentEntry[]) {
  return [byName(entries, 'background', c.background), freeHeartBackground(c, entries)].flatMap(background =>
    background && /At 3rd level, 7th level, and 15th level,[^.]*skill increases[^.]*only to these Lore skills/i.test(background.description)
      ? [3, 7, 15].filter(level => level <= c.level).map(level => ({
        key: `background-lore:${encodeURIComponent(background.name)}:${level}`, level,
        skills: backgroundLoreChoices(background, c).filter(Boolean),
      })) : [])
}
export function freeHeartBackground(c: Character, entries: ContentEntry[]) {
  const choice = activeFeatsNamed(c, 'Free Heart')[0]?.choice
  return choice && choice !== c.background ? entries.find(entry => entry.kind === 'background' && !entry.deleted
    && entry.name === choice && entry.systems.some(system => c.systems.includes(system)) && !featRarity(entry)) : undefined
}

export const skillIncreaseLevels = (c: Character) => range(3, 19, 2).filter((l) => l <= c.level)
const rankCap = (level: number) => (level >= 15 ? 4 : level >= 7 ? 3 : 2)
export const canIncreaseTo = (level: number, currentRank: number) => currentRank < rankCap(level)

export const LONGEVITY_EXPERT_SLOT = 'expert-longevity'
export function longevityExpertLevel(c: Character) {
  if (!activeFeatsNamed(c, 'Ancestral Longevity').length) return undefined
  const feat = activeFeatsNamed(c, 'Expert Longevity')[0]
  return feat ? featTakenLevel(feat) : undefined
}

export function normalizeLongevitySkills(c: Character): Character {
  const training = activeFeatsNamed(c, 'Ancestral Longevity')[0]
  const expert = longevityExpertLevel(c) === undefined ? undefined : activeFeatsNamed(c, 'Expert Longevity')[0]
  const valid = new Set([...statDefs(c).filter(stat => stat.kind === 'skill').map(stat => stat.name), ...c.lores.map(lore => lore.name)])
  const trainingChoice = training?.choice && valid.has(training.choice) ? training.choice : undefined
  const expertChoice = expert?.choice && valid.has(expert.choice) ? expert.choice : undefined
  if (!trainingChoice && !expertChoice) return c
  return {
    ...c,
    skillPicks: trainingChoice ? [...new Set([...(c.skillPicks ?? []), trainingChoice])] : c.skillPicks,
    skillIncreases: expertChoice ? { [LONGEVITY_EXPERT_SLOT]: expertChoice, ...c.skillIncreases } : c.skillIncreases,
    feats: c.feats.map(feat => feat === training && trainingChoice || feat === expert && expertChoice
      ? { ...feat, choice: undefined } : feat),
  }
}

const featDataNames = new WeakMap<ContentEntry[], Map<string, Set<string>>>()
const featData = (c: Character, entries: ContentEntry[], field: string) => {
  let fields = featDataNames.get(entries)
  if (!fields) {
    fields = new Map()
    featDataNames.set(entries, fields)
  }
  let names = fields.get(field)
  if (!names) {
    names = new Set(entries.filter(entry => entry.kind === 'feat' && !entry.deleted
      && typeof entry.data[field] === 'string' && !!entry.data[field]).map(entry => entry.name))
    fields.set(field, names)
  }
  return c.feats.flatMap((f) => {
    if (!names.has(f.name)) return []
    const v = selectedFeatEntry(c, entries, f.name, f.sourceId)?.data[field]
    return typeof v === 'string' && v ? [{ value: v, source: f.name }] : []
  })
}

const DONGUN_EDUCATION_LORES: Record<string, string[]> = {
  'Engineering Lore, Explosive Lore': ['Engineering Lore', 'Explosive Lore'],
  'Engineering Lore, Firearm Lore': ['Engineering Lore', 'Firearm Lore'],
  'Explosive Lore, Firearm Lore': ['Explosive Lore', 'Firearm Lore'],
}

function dongunEducationLores(c: Character) {
  return activeFeatsNamed(c, 'Dongun Education').flatMap(feat => DONGUN_EDUCATION_LORES[feat.choice ?? ''] ?? [])
}

// Automatically advancing Lore skills, including ancestry-specific grants.
export const featLores = (c: Character, entries: ContentEntry[]) => [...new Set([
  ...dongunEducationLores(c),
  ...featData({ ...c, feats: c.feats.filter((feat) => featTakenLevel(feat) <= c.level) }, entries, 'grants_lore').map((g) => g.value),
  ...ancestralSkillLores(c, entries),
  ...(c.feats.some(feat => feat.name === 'Dwarven Lore' && featTakenLevel(feat) <= c.level) ? ['Dwarven Lore'] : []),
  ...Object.entries(ANCESTRY_LORE_GRANTS).flatMap(([name, grant]) =>
    activeFeatsNamed(c, name).length ? [grant.lore] : []),
  ...c.feats.flatMap(feat => feat.name !== 'Dwarven Lore' && featTakenLevel(feat) <= c.level
    ? [ancestryLoreGrant(c, entries, feat.name)?.lore].filter((lore): lore is string => !!lore) : []),
  ...c.feats.flatMap(feat => {
    const lore = feat.name === 'Clan Lore' && feat.choice && featTakenLevel(feat) <= c.level
      ? CLAN_LORE_OPTIONS[feat.choice]?.lore : undefined
    return lore ? [`${lore} Lore`] : []
  }),
  ...c.feats.flatMap(feat => feat.name === 'Lizardfolk Lore' && featTakenLevel(feat) <= c.level
    ? [feat.replacements?.[0]?.trim().replace(/\s+lore$/i, ' Lore')].filter((lore): lore is string => !!lore) : []),
  ...activeFeatsNamed(c, 'Additional Lore').flatMap((feat) => {
    const choice = feat.choice?.trim()
    return choice ? [/\s+lore$/i.test(choice) ? choice.replace(/\s+lore$/i, ' Lore') : `${choice} Lore`] : []
  }),
])]

const CLAN_LORE_OPTIONS: Record<string, { hilt: 'Goldhilt' | 'Steelhilt' | 'Ironhilt'; skills: [string, string]; lore: string }> = {
  Aringeld: { hilt: 'Steelhilt', skills: ['Diplomacy', 'Society'], lore: 'Mercantile' },
  Breakiron: { hilt: 'Steelhilt', skills: ['Crafting', 'Survival'], lore: 'Alchemy' },
  Ertubur: { hilt: 'Steelhilt', skills: ['Medicine', 'Religion'], lore: 'Mortuary' },
  Felltree: { hilt: 'Ironhilt', skills: ['Athletics', 'Survival'], lore: 'Lumber' },
  Firecask: { hilt: 'Goldhilt', skills: ['Crafting', 'Nature'], lore: 'Alcohol' },
  Gelderon: { hilt: 'Ironhilt', skills: ['Athletics', 'Nature'], lore: 'Farming' },
  Grimmark: { hilt: 'Steelhilt', skills: ['Crafting', 'Society'], lore: 'Architecture' },
  Ironfist: { hilt: 'Steelhilt', skills: ['Crafting', 'Medicine'], lore: 'Smelting' },
  Lasthall: { hilt: 'Ironhilt', skills: ['Society', 'Survival'], lore: 'Highhelm' },
  Molgrade: { hilt: 'Goldhilt', skills: ['Crafting', 'Thievery'], lore: 'Smithing' },
  Oriddus: { hilt: 'Goldhilt', skills: ['Religion', 'Society'], lore: 'Dwarven Pantheon' },
  Pearlcask: { hilt: 'Steelhilt', skills: ['Crafting', 'Nature'], lore: 'Aquaculture' },
  Runebinder: { hilt: 'Goldhilt', skills: ['Arcana', 'Occultism'], lore: 'Academia' },
  Stonefist: { hilt: 'Steelhilt', skills: ['Athletics', 'Intimidation'], lore: 'Warfare' },
  Tolorr: { hilt: 'Goldhilt', skills: ['Diplomacy', 'Society'], lore: 'Library' },
  Vanderholl: { hilt: 'Ironhilt', skills: ['Athletics', 'Crafting'], lore: 'Labor' },
}

export const CLAN_LORES = [...new Set(Object.values(CLAN_LORE_OPTIONS).map(grant => `${grant.lore} Lore`))]

export function clanLoreLabel(clan: string) {
  const grant = CLAN_LORE_OPTIONS[clan]
  return grant ? `${grant.hilt}, ${clan}: ${[...grant.skills, `${grant.lore} Lore`].join(', ')}` : clan
}

export function loreReplacementChoices(c: Character, entries: ContentEntry[], index: number) {
  const feat = c.feats[index]
  if (!feat || !['Clan Lore', 'Dwarven Lore'].includes(feat.name)) return []
  const skills = feat.name === 'Dwarven Lore' ? ['Crafting', 'Religion']
    : CLAN_LORE_OPTIONS[feat.choice ?? '']?.skills ?? []
  const ranks = ancestrySkillBefore(c, entries, index)
  const trained = skills.filter(skill => (ranks[skill] ?? 0) > 0)
  const available = statDefs(c).filter(stat => stat.kind === 'skill' && !(ranks[stat.name] ?? 0)).map(stat => stat.name)
  return trained.map((skill, replacementIndex) => ({
    skill,
    options: available.filter(option => !feat.replacements?.slice(0, replacementIndex).includes(option)),
    value: feat.replacements?.[replacementIndex],
  }))
}

export function lizardfolkLoreReplacementChoices(c: Character, entries: ContentEntry[], index: number) {
  const feat = c.feats[index]
  if (!feat || feat.name !== 'Lizardfolk Lore') return []
  const skills = ['Survival', ...(feat.choice && ['Nature', 'Occultism'].includes(feat.choice) ? [feat.choice] : [])]
  const ranks = ancestrySkillBefore(c, entries, index)
  const available = statDefs(c).filter(stat => stat.kind === 'skill' && !(ranks[stat.name] ?? 0)).map(stat => stat.name)
  return skills.flatMap((skill, i) => (ranks[skill] ?? 0) > 0 ? [{
    skill, index: i + 1,
    options: available.filter(option => !feat.replacements?.slice(1, i + 1).includes(option)),
    value: feat.replacements?.[i + 1],
  }] : [])
}

export function normalizeConditionalSkillChoices(c: Character, entries: ContentEntry[]): Character {
  c = normalizeLaborerSkills(c)
  const picks = [...(c.skillPicks ?? [])]
  const lores = [...c.lores]
  let changed = false
  const add = (skill: string) => {
    if (!picks.includes(skill)) picks.push(skill)
    if (/\s+lore$/i.test(skill) && !lores.some(lore => lore.name === skill)) lores.push({ name: skill, rank: 0 })
    changed = true
  }
  const feats = c.feats.map((feat, index) => {
    if (featTakenLevel(feat) > c.level) return feat
    if (feat.name === 'Dwarven Lore' || feat.name === 'Clan Lore') {
      const replacements = [...(feat.replacements ?? [])]
      loreReplacementChoices(c, entries, index).forEach((row, i) => {
        if (row.value && row.options.includes(row.value)) {
          add(row.value)
          replacements[i] = ''
        }
      })
      while (replacements.length && !replacements[replacements.length - 1]) replacements.pop()
      return replacements.length === (feat.replacements?.length ?? 0) && replacements.every((value, i) => value === feat.replacements?.[i])
        ? feat : { ...feat, replacements: replacements.length ? replacements : undefined }
    }
    if (feat.name === 'Lizardfolk Lore') {
      const replacements = [...(feat.replacements ?? [])]
      lizardfolkLoreReplacementChoices(c, entries, index).forEach(row => {
        if (row.value && row.options.includes(row.value)) {
          add(row.value)
          replacements[row.index] = ''
        }
      })
      while (replacements.length > 1 && !replacements[replacements.length - 1]) replacements.pop()
      return replacements.length === (feat.replacements?.length ?? 0) && replacements.every((value, i) => value === feat.replacements?.[i])
        ? feat : { ...feat, replacements: replacements.length ? replacements : undefined }
    }
    if (SKILL_GRANT_REPLACEMENT_FEATS.includes(feat.name)
      || ![...SKILLS_TAB_ANCESTRY_GRANTS, 'Eye for Treasure', "Officer's Medical Training", 'Shiny'].includes(feat.name)
      || !feat.choice || !featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index)?.includes(feat.choice)) return feat
    add(feat.choice)
    return { ...feat, choice: undefined }
  })
  const warmaskIndex = c.feats.findIndex(feat => feat.name === 'Orc Warmask' && featTakenLevel(feat) <= c.level)
  let warmask = c.warmask
  const alternate = warmask?.alternateSkill
  if (alternate && warmaskAlternateSkills(c, entries, warmaskIndex).includes(alternate)) {
    add(alternate)
    warmask = { ...warmask, alternateSkill: undefined }
  }
  return changed ? { ...c, feats, warmask, skillPicks: picks, lores } : c
}

export function ancestralSkills(c: Character, entries: ContentEntry[], selections = activeFeatsNamed(c, 'Ancestral Skills')) {
  const skills = new Set(selections.flatMap(selection => {
    const source = selectedFeatEntry(c, entries, selection.name, selection.sourceId)
    if (!source?.traits.some(trait => ancestryFeatTraits(c).includes(trait.toLowerCase()))) return []
    const options = /Option\(s\):\s*([^\n]+)/i.exec(source?.description ?? '')?.[1] ?? ''
    return tokens(options || source?.data.skill)
  }))
  return statDefs(c).filter(stat => stat.kind === 'skill' && skills.has(stat.name)).map(stat => stat.name)
}

function ancestralSkillLores(c: Character, entries: ContentEntry[], selections = activeFeatsNamed(c, 'Ancestral Skills')) {
  return selections.flatMap(selection => {
    const source = selectedFeatEntry(c, entries, selection.name, selection.sourceId)
    const ancestry = source?.traits.find(trait => ancestryFeatTraits(c).includes(trait.toLowerCase()))
      ?? (!source && !selection.sourceId ? c.ancestry : undefined)
    return ancestry ? [`${titleCase(ancestry)} Lore`] : []
  })
}

function normalizeLaborerSkills(c: Character): Character {
  if (!c.systems.includes('sf2e')) return c
  const feat = activeFeatsNamed(c, 'Experienced Laborer')[0]
  const choice = feat?.choice?.trim().replace(/\s+/g, ' ')
  if (!choice || /^lore$/i.test(choice)) return c
  const name = /\s+lore$/i.test(choice) ? choice.replace(/\s+lore$/i, ' Lore') : `${choice} Lore`
  const existing = c.lores.find(lore => lore.name.toLowerCase() === name.toLowerCase())
  const skill = existing?.name ?? name
  return {
    ...c,
    feats: c.feats.map(selected => selected === feat ? { ...selected, choice: undefined } : selected),
    skillPicks: [...new Set([...(c.skillPicks ?? []), skill])],
    lores: existing ? c.lores : [...c.lores, { name: skill, rank: 0 }],
  }
}

export function deityGrantedLores(c: Character) {
  const deity = c.deity?.trim()
  return getSettings().deityLore && deity ? [`${deity} Lore`] : []
}

export function trainedFeatLores(c: Character) {
  return [
    ...(c.systems.includes('pf2e') && activeFeatsNamed(c, 'Underworld Investigator').length
      ? [{ name: 'Underworld Lore', source: 'Underworld Investigator' }] : []),
  ]
}

const ANCESTRY_LORE_GRANTS: Record<string, { skills: string[]; lore: string }> = {
  "Grandmother's Lore": { skills: ['Deception', 'Thievery'], lore: 'Lao Shu Po Lore' },
  'Ysoki Lore': { skills: ['Acrobatics', 'Stealth'], lore: 'Ysoki Lore' },
  'Orc Lore': { skills: ['Athletics', 'Survival'], lore: 'Orc Lore' },
}
const ANCESTRY_SKILL_ONLY_GRANTS: Record<string, string[]> = {
  'Tinkering Fingers': ['Crafting'],
  'Extended Family': ['Diplomacy'],
  'X-hat Firewalker Frame': ['Computers'],
  'Subtle Cyborg': ['Deception'],
  'Pick On Someone My Size': ['Intimidation'],
}
function ancestryLoreGrant(c: Character, entries: ContentEntry[], name: string) {
  if (ANCESTRY_LORE_GRANTS[name]) return ANCESTRY_LORE_GRANTS[name]
  if (name === 'Dwarven Lore') return { skills: ['Crafting', 'Religion'], lore: 'Dwarf Lore' }
  if (!name.endsWith(' Lore') || name === 'Clan Lore' || name === 'Additional Lore' || name === 'Lizardfolk Lore') return undefined
  const source = selectedFeatEntry(c, entries, name)
  const text = source?.description ?? ''
  const skillsText = /(?:trained proficiency rank in|become trained in|you're trained in)\s+([^.]+)/i.exec(text)?.[1]
  const lore = /additional lore (?:general )?feat for\s+([a-z][\w' -]*? lore)\b/i.exec(text)?.[1]
  if (!skillsText || !lore) return undefined
  const skills = statDefs(c).filter(stat => stat.kind === 'skill'
    && new RegExp(`\\b${stat.name}\\b`, 'i').test(skillsText)).map(stat => stat.name)
  return skills.length ? { skills, lore } : undefined
}
const rankDependentFeats = new Set(['Dwarven Lore', 'Clan Lore', 'Lizardfolk Lore', 'Munitions Crafter', 'Eye for Treasure', "Stonemason's Eye", "Officer's Medical Training", 'Rat Retinal HUD', ...Object.keys(ANCESTRY_LORE_GRANTS), ...Object.keys(ANCESTRY_SKILL_ONLY_GRANTS)])

function skillTrainingSkills(c: Character, entries: ContentEntry[]) {
  const skills = new Set(statDefs(c).filter((stat) => stat.kind === 'skill').map((stat) => stat.name))
  const trained = activeFeatsNamed(c, 'Skill Training').flatMap((feat) => feat.choice && skills.has(feat.choice) ? [feat.choice] : [])
  c.feats.forEach((feat, index) => {
    const grant = ancestrySkillGrant(c, entries, feat.name)
    if (!grant || featTakenLevel(feat) > c.level) return
    if (SKILLS_TAB_ANCESTRY_GRANTS.includes(feat.name) && !feat.choice) {
      trained.push(grant.skill)
      return
    }
    const ranks = ancestrySkillBefore(c, entries, index)
    if (!ranks[grant.skill]) trained.push(grant.skill)
    else if (feat.choice && skills.has(feat.choice) && !ranks[feat.choice]) trained.push(feat.choice)
  })
  c.feats.forEach((feat, index) => {
    if (featTakenLevel(feat) > c.level || !rankDependentFeats.has(feat.name) && !ancestryLoreGrant(c, entries, feat.name)) return
    const simpleSkills = feat.name === 'Dwarven Lore' || feat.name === 'Lizardfolk Lore' ? undefined
      : ancestryLoreGrant(c, entries, feat.name)?.skills ?? ANCESTRY_SKILL_ONLY_GRANTS[feat.name]
    if (simpleSkills && feat.name !== 'Pick On Someone My Size') {
      trained.push(...simpleSkills)
      return
    }
    const ranks = ancestrySkillBefore(c, entries, index)
    if (simpleSkills) {
      if (feat.name !== 'Pick On Someone My Size' || !ranks.Intimidation) trained.push(...simpleSkills)
    } else if (feat.name === 'Dwarven Lore' || feat.name === 'Clan Lore') {
      const baseSkills = feat.name === 'Dwarven Lore' ? ['Crafting', 'Religion']
        : CLAN_LORE_OPTIONS[feat.choice ?? '']?.skills ?? []
      let replacementIndex = 0
      for (const skill of baseSkills) {
        if (!(ranks[skill] ?? 0)) trained.push(skill)
        else {
          const replacement = feat.replacements?.[replacementIndex]
          const allowed = loreReplacementChoices(c, entries, index)[replacementIndex]?.options ?? []
          if (replacement && allowed.includes(replacement)) trained.push(replacement)
          else if (!replacement) trained.push(skill)
          replacementIndex++
        }
      }
    } else if (feat.name === 'Lizardfolk Lore') {
      for (const [skill, replacementIndex] of [['Survival', 1], [feat.choice ?? '', 2]] as const) {
        if (!skill || !['Survival', 'Nature', 'Occultism'].includes(skill)) continue
        if (!(ranks[skill] ?? 0)) trained.push(skill)
        else {
          const replacement = feat.replacements?.[replacementIndex]
          const allowed = lizardfolkLoreReplacementChoices(c, entries, index).find(row => row.index === replacementIndex)?.options ?? []
          if (replacement && allowed.includes(replacement)) trained.push(replacement)
          else trained.push(skill)
        }
      }
    } else if (feat.name === 'Munitions Crafter' && !(ranks.Crafting ?? 0)) {
      trained.push('Crafting')
    } else if (feat.name === 'Eye for Treasure') {
      const skill = (ranks.Crafting ?? 0) > 0 && feat.choice ? feat.choice : 'Crafting'
      if (skill && skills.has(skill) && !(ranks[skill] ?? 0)) trained.push(skill)
    } else if (feat.name === "Officer's Medical Training") {
      if (!(ranks.Medicine ?? 0) || !feat.choice) trained.push('Medicine')
      else if (featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index)?.includes(feat.choice)) trained.push(feat.choice)
    } else if (feat.name === 'Rat Retinal HUD' && !(ranks.Computers ?? 0)) {
      trained.push('Computers')
    } else if (feat.name === "Stonemason's Eye" && !(ranks.Crafting ?? 0)) trained.push('Crafting')
  })
  if (activeFeatsNamed(c, 'Beast Trainer').length) trained.push('Nature')
  const warmask = warmaskSource(c)
  if (warmask) {
    const index = c.feats.findIndex(feat => feat.name === 'Orc Warmask' && featTakenLevel(feat) <= c.level)
    const alternate = c.warmask?.alternateSkill
    if (alternate && warmaskAlternateSkills(c, entries, index).includes(alternate)) trained.push(alternate)
    else trained.push(warmask.skill)
  }
  const holdMarkSkills: Record<string, string> = {
    'Burning Sun': 'Diplomacy', "Death's Head": 'Survival', 'Defiled Corpse': 'Religion', 'Empty Hand': 'Intimidation',
  }
  for (const feat of activeFeatsNamed(c, 'Hold Mark')) {
    const skill = holdMarkSkills[feat.choice ?? '']
    if (skill) trained.push(skill)
  }
  for (const feat of activeFeatsNamed(c, 'Shiny')) {
    const without = { ...c, level: Math.min(c.level, featTakenLevel(feat)), feats: c.feats.filter((other) => other !== feat && other.name !== 'Shiny') }
    const already = ranksAt(without, entries).Performance >= 1
    if (!already || !feat.choice) trained.push('Performance')
    else if (feat.choice && skills.has(feat.choice) && !(ranksAt(without, entries)[feat.choice] >= 1)) trained.push(feat.choice)
  }
  return trained
}

// Senses from the ancestry and from feats
export function senses(c: Character, entries: ContentEntry[]) {
  const ancestry = byName(entries, 'ancestry', c.ancestry)?.data.vision
  const out = typeof ancestry === 'string' && ancestry ? [{ value: ancestry, source: c.ancestry }] : []
  const addVision = (value: string, source: string) => {
    if (!out.some((sense) => sense.value.toLowerCase() === value.toLowerCase())) out.push({ value, source })
  }
  if (hellknightBenefitActive(c, 'Seek Injustice')) {
    addVision('See through up to 5 feet of stone, wood, or similar barriers (not metal; 1 minute)', 'Seek Injustice')
  }
  for (const heritage of characterHeritages(c, entries)) {
    const vision = heritage.data.grants_vision ?? heritage.data.vision
    if (typeof vision === 'string' && vision) addVision(vision, heritage.name)
    else if (heritage.name === 'Cavern Elf') addVision('Darkvision', heritage.name)
  }
  if (activeFeatsNamed(c, 'Necromantic Lifesense').length) addVision('Lifesense (imprecise) 30 feet', 'Necromantic Lifesense')
  if (hasDivineIntercession(c, 'Asmodeus', 'moderate-boon')) addVision('Darkvision', 'Asmodeus (Moderate Boon)')
  if (activeFeatsNamed(c, "Jotun's Eyes").length) addVision('Darkvision', "Jotun's Eyes")
  if (ancestryFeatTraits(c).includes('dwarf') && carriedWeapons(c, entries).some(weapon => weaponHeld(c, entries, weapon)
    && weaponEntry(entries, weapon.name)?.data.named_weapon_source === 'Axe of the Dwarven Lords')) {
    addVision('Greater Darkvision', 'Axe of the Dwarven Lords')
  }
  if (c.systems.includes('sf2e')) {
    const native: Record<string, string> = {
      Maraquoi: 'Dermal Hearing (imprecise) 30 feet',
      Moyishuu: 'Emotionsense (imprecise) 20 feet',
      Talphi: 'Scent (imprecise) 30 feet',
    }
    if (c.ancestry && native[c.ancestry]) addVision(native[c.ancestry], c.ancestry)
    if (c.ancestry === 'Fonqugon' && c.heritage && /^Acid Quake(?: Fonqugon)?$/i.test(c.heritage)) {
      addVision('Tremorsense (imprecise) 15 feet', c.heritage)
    }
  }
  if (testSubjectAdaptation(c) === 'Psychic Augmentation') addVision('Limited Telepathy 30 feet', 'Test-Subject Ysoki')
  const hasVision = (value: string) => out.some((sense) => sense.value.toLowerCase().includes(value))
  const explicitVision = ['Acute Vision', 'Nocturnal Senses', 'Superior Sight', 'Adaptive Visual Receptors']
  const passive = { ...c, feats: c.feats.filter((feat) => featTakenLevel(feat) <= c.level && !explicitVision.includes(feat.name)) }
  for (const grant of featData(passive, entries, 'grants_vision')) addVision(grant.value, grant.source)
  if (activeFeatsNamed(c, 'Defy the Darkness').length) {
    const darkvision = out.findIndex((sense) => sense.value.toLowerCase() === 'darkvision')
    if (darkvision >= 0) out.splice(darkvision, 1)
    addVision('Greater Darkvision', 'Defy the Darkness')
  }
  for (const name of ['Celestial Form', 'Fiendish Form']) {
    if (activeFeatsNamed(c, name).length && !hasVision('darkvision')) addVision('Darkvision', name)
  }
  const features = activeAnimalFeatures(c, entries)
  for (const vision of [
    ...(features.includes('Cat Eyes') ? ['Low-Light Vision'] : []),
    ...(features.includes('Owl Eyes') ? ['Darkvision'] : []),
  ]) {
    addVision(vision, 'Animal Feature')
  }
  if (activeFeatsNamed(c, 'Superior Sight').length && !hasVision('darkvision')) {
    addVision(hasVision('low-light vision') ? 'Darkvision' : 'Low-Light Vision', 'Superior Sight')
  }
  for (const _feat of activeFeatsNamed(c, 'Adaptive Visual Receptors').slice(0, 2)) {
    if (!hasVision('darkvision')) addVision(hasVision('low-light vision') ? 'Darkvision' : 'Low-Light Vision', 'Adaptive Visual Receptors')
  }
  const addScent = (feet: number, source: string) => {
    const existing = out.find((sense) => /^Scent \(imprecise\) \d+ feet$/i.test(sense.value))
    if (existing && Number(/\d+/.exec(existing.value)?.[0]) >= feet) return
    const grant = { value: `Scent (imprecise) ${feet} feet`, source }
    if (existing) Object.assign(existing, grant)
    else out.push(grant)
  }
  if (isSpellActive(c, entries, 'Keen Smell')) addScent(c.level >= 5 ? 60 : 30, 'Keen Smell')
  if (activeFeatsNamed(c, 'Enhanced Olfactory System').length) addScent(30, 'Enhanced Olfactory System')
  if (activeFeatsNamed(c, 'Enhanced Senses').length) {
    const names: Record<string, string> = {
      Ysoki: 'Scent', Formian: 'Scent', Talphi: 'Scent', Maraquoi: 'Dermal Hearing',
      Moyishuu: 'Emotionsense', Fonqugon: 'Tremorsense',
    }
    const name = names[c.ancestry ?? '']
    const sense = name && out.find(sense => sense.value.startsWith(`${name} (imprecise) `) && /\d+ feet$/.test(sense.value))
    if (sense) {
      const feet = Number(/\d+/.exec(sense.value)?.[0])
      Object.assign(sense, { value: `${name} (imprecise) ${feet + 30} feet`, source: `${sense.source}, Enhanced Senses` })
    }
  }
  if (c.raging) {
    if (activeFeatsNamed(c, 'Acute Vision').length) addVision('Darkvision', 'Acute Vision')
    if (activeFeatsNamed(c, 'Acute Scent').length) addScent(30, 'Acute Scent')
    if (activeFeatsNamed(c, 'Nocturnal Senses').length) {
      if (hasVision('low-light vision')) addVision('Darkvision', 'Nocturnal Senses')
      if (hasVision('scent (imprecise)')) addScent(60, 'Nocturnal Senses')
    }
  }
  return out.sort((a, b) => a.value.localeCompare(b.value))
}

const shieldFeaturesCache = new WeakMap<ContentEntry[], ContentEntry[]>()
export function automaticFeatGrants(c: Character, entries: ContentEntry[]) {
  const grants: { name: string; source: string; level: number; choice?: string }[] = []
  for (const benefit of hellknightTrainingBenefits(c)) {
    if (benefit.name === 'Dedication to the Five' && benefit.choice && GODCLAW_DOMAINS.includes(benefit.choice)) {
      grants.push({ name: 'Domain Initiate', source: benefit.feat.name, level: featTakenLevel(benefit.feat), choice: benefit.choice })
    }
  }
  let shieldFeatures = shieldFeaturesCache.get(entries)
  if (!shieldFeatures) {
    shieldFeatures = entries.filter(feature => feature.kind === 'classFeature' && feature.name === 'Shield Block' && !feature.deleted)
    shieldFeaturesCache.set(entries, shieldFeatures)
  }
  const shieldBlockFeature = shieldFeatures.find(feature => feature.data.class === c.className && feature.level <= c.level
    && feature.systems.some(system => c.systems.includes(system)))
  if (shieldBlockFeature && c.className) {
    grants.push({ name: 'Shield Block', source: c.className, level: shieldBlockFeature.level })
  } else if (c.level >= 1 && c.systems.includes('pf2e') && c.className === 'Cleric'
    && selectedSubclass(c, entries) === 'Warpriest') {
    grants.push({ name: 'Shield Block', source: 'Warpriest', level: 1 })
  }
  if (isPioneerHuman(c)) grants.push({ name: 'Terrain Expertise', source: 'Pioneer Human', level: 1,
    ...(c.pioneerTerrain ? { choice: c.pioneerTerrain } : {}) })
  if (testSubjectAdaptation(c) === 'Cybernetic Augmentation') {
    grants.push({ name: 'Assurance', choice: 'Computers', source: 'Test-Subject Ysoki', level: 1 })
  }
  if (soldierStyle(c)?.name === 'Close Quarters') {
    grants.push({ name: 'Whirling Swipe', source: 'Close Quarters', level: 1 })
  }
  const memorySkill = witchwarperParadox(c) && c.witchwarper?.anchor === 'Core Memories' ? c.witchwarper.coreMemorySkill : undefined
  if (memorySkill) {
    const rank = ranksAt({ ...c, witchwarper: { ...c.witchwarper, coreMemorySkill: undefined } }, entries)[memorySkill] ?? 0
    if (rank > 0) grants.push({ name: 'Assurance', choice: memorySkill, source: 'Core Memories', level: 1 })
    if (rank >= 2 && (/ lore$/i.test(memorySkill)
      || ['Arcana', 'Computers', 'Crafting', 'Medicine', 'Nature', 'Occultism', 'Religion', 'Society'].includes(memorySkill))) {
      grants.push({ name: 'Automatic Knowledge', choice: memorySkill, source: 'Core Memories', level: 1 })
    }
  }
  if (c.systems.includes('pf2e') && activeFeatsNamed(c, 'Orc Kinship').length) {
    grants.push({ name: 'Adopted Ancestry', choice: 'Orc', source: 'Orc Kinship',
      level: Math.min(...activeFeatsNamed(c, 'Orc Kinship').map(featTakenLevel)) })
  }
  if (c.ancestry === 'Orc' && c.heritage === 'Hold-Scarred Orc') {
    grants.push({ name: 'Diehard', source: 'Hold-Scarred Orc', level: 1 })
  }
  for (const feat of c.feats) {
    const grant = ancestrySkillGrant(c, entries, feat.name)
    if (grant?.feat && featTakenLevel(feat) <= c.level) grants.push({ name: grant.feat, source: feat.name, level: featTakenLevel(feat) })
    const lore = (feat.name === 'Dwarven Lore' ? undefined : ancestryLoreGrant(c, entries, feat.name)?.lore)
      ?? (feat.name === 'Ancestral Skills' ? ancestralSkillLores(c, entries, [feat])[0] : undefined)
    if (lore && featTakenLevel(feat) <= c.level) grants.push({
      name: 'Additional Lore', choice: lore.replace(/ Lore$/, ''), source: feat.name, level: featTakenLevel(feat),
    })
  }
  for (const [source, name] of [["Gecko's Grip", 'Combat Climber'], ['Rider', 'Ride'], ['Gg-os Frame', 'Fleet'], ['X-hat Firewalker Frame', 'Phreaker'],
    ['Data Retrieval', 'Open-Source Research'], ['Hydraulic Pistons', 'Quick Jump']]) {
    for (const feat of activeFeatsNamed(c, source)) grants.push({ name, source, level: featTakenLevel(feat) })
  }
  for (const feat of activeFeatsNamed(c, 'Pick On Someone My Size')) {
    if (ancestrySkillBefore(c, entries, c.feats.indexOf(feat)).Intimidation)
      grants.push({ name: 'Intimidating Glare', source: feat.name, level: featTakenLevel(feat) })
  }
  const ruggedSource = selectedFeatEntry(c, entries, 'Rugged Survivalist')
  if (c.systems.includes('sf2e') && ancestryFeatTraits(c).includes('orc') && activeFeatsNamed(c, 'Rugged Survivalist').length
    && (!ruggedSource || ruggedSource.systems.includes('sf2e') && ruggedSource.traits.some(trait => trait.toLowerCase() === 'orc'))) {
    grants.push({ name: 'Forager', source: 'Rugged Survivalist', level: Math.min(...activeFeatsNamed(c, 'Rugged Survivalist').map(featTakenLevel)) })
  }
  const sourceLevel = (name: string) => Math.min(...activeFeatsNamed(c, name).map(featTakenLevel))
  if (activeFeatsNamed(c, "Officer's Medical Training").length) {
    grants.push({ name: 'Battle Medicine', source: "Officer's Medical Training", level: sourceLevel("Officer's Medical Training") })
  }
  const eyeForTreasure = activeFeatsNamed(c, 'Eye for Treasure')
  if (eyeForTreasure.length) {
    grants.push({ name: "Crafter's Appraisal", source: 'Eye for Treasure', level: sourceLevel('Eye for Treasure') })
  }
  for (const feat of activeFeatsNamed(c, "Stonemason's Eye")) {
    const index = c.feats.indexOf(feat)
    if ((ancestrySkillBefore(c, entries, index).Crafting ?? 0) > 0) {
      grants.push({ name: 'Specialty Crafting', choice: 'Stonemasonry', source: "Stonemason's Eye", level: featTakenLevel(feat) })
    }
  }
  if (activeFeatsNamed(c, 'Clever Improviser').length) {
    grants.push({ name: 'Untrained Improvisation', source: 'Clever Improviser', level: sourceLevel('Clever Improviser') })
  }
  for (const [source, training] of Object.entries(INITIATE_TRAINING)) {
    if (!activeFeatsNamed(c, source).length) continue
    for (const name of training.feats) {
      grants.push({ name, source, level: sourceLevel(source) })
    }
  }
  if (activeFeatsNamed(c, 'Snarecrafter Dedication').length) {
    grants.push({ name: 'Snare Crafting', source: 'Snarecrafter Dedication', level: sourceLevel('Snarecrafter Dedication') })
  }
  if (activeFeatsNamed(c, 'Friend of the Sea').length) {
    grants.push({ name: 'Pet', source: 'Friend of the Sea', level: sourceLevel('Friend of the Sea') })
  }
  if (activeFeatsNamed(c, 'Predictive Purchase').length) {
    for (const name of ['Prescient Planner', 'Prescient Consumable']) {
      grants.push({ name, source: 'Predictive Purchase', level: sourceLevel('Predictive Purchase') })
    }
  }
  if (c.systems.includes('pf2e') && activeFeatsNamed(c, 'Orc Warmask').length) {
    grants.push({ name: 'Dubious Knowledge', source: 'Orc Warmask', level: sourceLevel('Orc Warmask') })
  }
  for (const feat of activeFeatsNamed(c, 'Exceptional Artisan')) {
    if (feat.choice && featChoiceOptions(feat.name, c, entries, feat.slot ?? '', c.feats.indexOf(feat))?.includes(feat.choice)) {
      grants.push({ name: 'Assurance', source: `Exceptional Artisan (${feat.choice})`, level: featTakenLevel(feat) })
    }
  }
  const freeHeart = activeFeatsNamed(c, 'Free Heart')[0]
  const extraBackground = freeHeartBackground(c, entries)
  if (freeHeart && extraBackground) {
    for (const name of tokens(extraBackground.data.feat)) grants.push({ name, source: `Free Heart (${extraBackground.name})`, level: featTakenLevel(freeHeart) })
  }
  for (const feat of activeFeatsNamed(c, 'Beast Trainer')) {
    if (feat.choice === 'Pet' || feat.choice === 'Train Animal') {
      grants.push({ name: feat.choice, source: 'Beast Trainer', level: featTakenLevel(feat) })
    }
  }
  for (const name of ['Transgnomanist', 'Augmented Dedication']) {
    if (activeFeatsNamed(c, name).length) grants.push({ name: 'Augmented Body', source: name, level: sourceLevel(name) })
  }
  if (activeFeatsNamed(c, 'Raging Intimidation').length) {
    for (const [name, minimum, rank] of [['Intimidating Glare', 1, 1], ['Scare to Death', 15, 4]] as const) {
      for (let level = Math.max(sourceLevel('Raging Intimidation'), minimum); level <= c.level; level++) {
        if ((ranksAt({ ...c, level }, entries).Intimidation ?? 0) < rank) continue
        grants.push({ name, source: 'Raging Intimidation', level })
        break
      }
    }
  }
  const talon = activeFeatsNamed(c, 'Talon Transporter')[0]
  if (talon && !activeFeatsNamed(c, 'Hefty Hauler').some(feat => featTakenLevel(feat) <= featTakenLevel(talon))) {
    grants.push({ name: 'Hefty Hauler', source: 'Talon Transporter', level: sourceLevel('Talon Transporter') })
  }
  return grants
}

function baseRanks(c: Character, entries: ContentEntry[], beforeLevel = 99) {
  const klass = byName(entries, 'class', c.className)
  const ranks: Record<string, number> = {}
  const bump = (n: string) => { ranks[n] = Math.max(ranks[n] ?? 0, 1) }
  if (testSubjectAdaptation(c) === 'Cybernetic Augmentation' && beforeLevel > 1) bump('Computers')
  autoClassSkills({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries).forEach(bump)
  const erudite = eruditeWarrior({ ...c, level: Math.min(c.level, beforeLevel - 1) })
  if (erudite) for (const skill of [erudite.skill, ...(erudite.lore ? [erudite.lore] : [])]) {
    ranks[skill] = Math.max(ranks[skill] ?? 0, erudite.rank)
  }
  backgroundSkills(byName(entries, 'background', c.background), c).forEach(bump)
  backgroundSkills(freeHeartBackground({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries), c).forEach(bump)
  if (isPioneerHuman(c)) bump('Survival')
  c.skillPicks?.forEach(bump)
  featLores({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries).forEach(bump)
  const educationLevel = Math.min(c.level, beforeLevel - 1)
  for (const name of dongunEducationLores({ ...c, level: educationLevel })) {
    ranks[name] = Math.max(ranks[name] ?? 0, educationLevel >= 15 ? 4 : educationLevel >= 7 ? 3 : educationLevel >= 2 ? 2 : 1)
  }
  trainedFeatLores({ ...c, level: Math.min(c.level, beforeLevel - 1) }).forEach(grant => bump(grant.name))
  deityGrantedLores(c).forEach(bump)
  skillTrainingSkills({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries).forEach(bump)
  c.lores.forEach((l) => { ranks[l.name] = Math.max(ranks[l.name] ?? 0, l.rank) })
  ranks.Perception = rankFromText(klass?.data.perception_proficiency)
  ranks.Fortitude = rankFromText(klass?.data.fortitude_proficiency)
  ranks.Reflex = rankFromText(klass?.data.reflex_proficiency)
  ranks.Will = rankFromText(klass?.data.will_proficiency)
  for (const [stat, rank] of Object.entries(featureRanks(classFeatures(entries, c)))) ranks[stat] = Math.max(ranks[stat] ?? 0, rank)
  const canny = c.feats.find((f) => f.name === 'Canny Acumen')?.choice
  if (canny && CANNY_STATS.includes(canny)) ranks[canny] = Math.max(ranks[canny] ?? 0, c.level >= 17 ? 3 : 2)
  return ranks
}

const rankCaches = new WeakMap<ContentEntry[], {
  settings: ReturnType<typeof getSettings>
  values: Map<string, Record<string, number>>
}>()

// Ranks from class/background/picks plus skill increases below `beforeLevel`; legacy overrides apply only to skills.
export const EXPERT_GRANT_FEATS: Record<string, { skill: string }> = {
  ...INITIATE_TRAINING,
  'Hellknight Preferment': { skill: 'Intimidation' },
  'Hellknight Signifer Preferment': { skill: 'Intimidation' },
}

export function ranksAt(c: Character, entries: ContentEntry[], beforeLevel = 99, withOverrides = true) {
  const settings = getSettings()
  let cache = rankCaches.get(entries)
  if (!cache || cache.settings !== settings) {
    cache = { settings, values: new Map() }
    rankCaches.set(entries, cache)
  }
  // Recursive training grants repeatedly visit the same earlier character state.
  const key = JSON.stringify([{ ...c, extraSlots: undefined, dismissedFeatSlots: undefined, updatedAt: undefined }, beforeLevel, withOverrides])
  const cached = cache.values.get(key)
  if (cached) {
    cache.values.delete(key)
    cache.values.set(key, cached)
    return { ...cached }
  }
  const ranks = calculateRanks(c, entries, beforeLevel, withOverrides)
  if (cache.values.size >= 128) {
    const oldest = cache.values.keys().next().value
    if (oldest !== undefined) cache.values.delete(oldest)
  }
  cache.values.set(key, { ...ranks })
  return ranks
}

function calculateRanks(c: Character, entries: ContentEntry[], beforeLevel: number, withOverrides: boolean) {
  c = { ...normalizeLaborerSkills(normalizeLongevitySkills({ ...c, level: Math.min(c.level, beforeLevel - 1) })), level: c.level }
  const ranks = baseRanks(c, entries, beforeLevel)
  const autoSkills = autoClassSkills({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries)
  const rankUp = getSettings().autoClassSkills
  const loreUp = getSettings().autoLores
  const lores = loreUp ? [...backgroundSkills(byName(entries, 'background', c.background), c).filter((n) => /lore$/i.test(n)), ...c.lores.map((l) => l.name), ...featLores(c, entries), ...autoSkills.filter(name => / lore$/i.test(name))] : []
  if (loreUp) lores.push(...trainedFeatLores({ ...c, level: Math.min(c.level, beforeLevel - 1) }).map(grant => grant.name),
    ...deityGrantedLores(c))
  if (loreUp) lores.push(...activeFeatsNamed({ ...c, level: Math.min(c.level, beforeLevel - 1) }, "Officer's Medical Training")
    .flatMap(feat => feat.choice && /.+\s+lore$/i.test(feat.choice) ? [feat.choice] : []))
  if (loreUp) lores.push(...backgroundSkills(freeHeartBackground({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries), c)
    .filter(name => /lore$/i.test(name)))
  const additionalLores = featLores({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries)
  const scrapper = proficiencyFeats(c, 'Technomagical Scrapper').find(({ feat }) => featTakenLevel(feat) < beforeLevel)
  const scrapperLevel = scrapper ? featTakenLevel(scrapper.feat) : undefined
  const prior = scrapper && scrapperRanksBefore(c, entries, scrapper.feat.slot ?? '', scrapper.index, withOverrides)
  const scrapperGrants: Record<string, number> = prior ? { Crafting: Math.min(2, (prior.Crafting ?? 0) + 1) } : {}
  const variant = prior && scrapperVariants(prior).find(option => option.label === scrapper?.feat.choice || option.skill === scrapper?.feat.choice)
  if (variant) scrapperGrants[variant.skill] = variant.rank
  const initiateGrants = Object.entries(EXPERT_GRANT_FEATS).flatMap(([name, training]) => {
    const level = Math.min(...activeFeatsNamed(c, name).map(featTakenLevel).filter(level => level < beforeLevel))
    return Number.isFinite(level) ? [{ skill: training.skill, level }] : []
  })
  const ancestral = activeFeatsNamed(c, 'Ancestral Skills').find(feat => featTakenLevel(feat) < beforeLevel)
  const ancestralLevel = ancestral && featTakenLevel(ancestral)
  const ancestrySkills = ancestral ? ancestralSkills(c, entries) : []
  const longevityLevel = longevityExpertLevel({ ...c, level: Math.min(c.level, beforeLevel - 1) })
  const educationSlots = officerEducationSlots({ ...c, level: Math.min(c.level, beforeLevel - 1) })
  const ingenuitySlots = mechanicIngenuitySlots({ ...c, level: Math.min(c.level, beforeLevel - 1) })
  const signiferSlots = signiferExpertSlots({ ...c, level: Math.min(c.level, beforeLevel - 1) })
  const backgroundSlots = backgroundLoreIncreaseSlots({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries)
  const increases = new Set(skillIncreaseLevels(c).filter(level => level < beforeLevel))
  // Feat-granted ranks must precede skill increases spent at later levels.
  const levels = [...new Set([...increases, ...(scrapperLevel === undefined ? [] : [scrapperLevel]),
    ...initiateGrants.map(grant => grant.level), ...(ancestralLevel === undefined ? [] : [ancestralLevel]),
    ...(longevityLevel === undefined ? [] : [longevityLevel]), ...educationSlots.map(slot => slot.level),
    ...ingenuitySlots.map(slot => slot.level), ...signiferSlots.map(slot => slot.level),
    ...backgroundSlots.map(slot => slot.level)])].sort((a, b) => a - b)
  for (const l of levels) {
    if (l === longevityLevel) {
      const skill = c.skillIncreases?.[LONGEVITY_EXPERT_SLOT]
      if (skill && ranks[skill] === 1) ranks[skill] = 2
    }
    for (const slot of educationSlots.filter(slot => slot.level === l)) {
      const skill = c.skillIncreases?.[slot.key]
      if (skill && ranks[skill] === 1 && (statDefs(c).some(stat => stat.kind === 'skill' && stat.name === skill)
        || /.+\s+lore$/i.test(skill))) ranks[skill] = 2
    }
    for (const slot of signiferSlots.filter(slot => slot.level === l)) {
      const skill = c.skillIncreases?.[slot.key]
      if (skill && slot.skills.includes(skill) && ranks[skill] === 1) ranks[skill] = 2
    }
    for (const slot of backgroundSlots.filter(slot => slot.level === l)) {
      const skill = c.skillIncreases?.[slot.key]
      if (skill && slot.skills.includes(skill) && (ranks[skill] ?? 0) > 0 && canIncreaseTo(l, ranks[skill])) ranks[skill]++
    }
    if (increases.has(l)) {
      const skill = c.skillIncreases?.[l]
      if (skill) ranks[skill] = Math.min(4, (ranks[skill] ?? 0) + 1)
      if (rankUp) for (const name of autoSkills) ranks[name] = Math.max(ranks[name] ?? 0, rankCap(l))
      for (const name of lores) if ((ranks[name] ?? 0) > 0) ranks[name] = Math.max(ranks[name], rankCap(l))
      if (l === 3 || l === 7 || l === 15) {
        for (const name of additionalLores) ranks[name] = Math.max(ranks[name] ?? 0, rankCap(l))
      }
      for (const slot of ingenuitySlots.filter(slot => slot.level === l)) {
        const skill = c.skillIncreases?.[slot.key]
        if ((skill === 'Computers' || skill === 'Crafting') && (ranks[skill] ?? 0) > 0
          && canIncreaseTo(l, ranks[skill])) ranks[skill]++
      }
    }
    if (l === scrapperLevel) for (const [name, rank] of Object.entries(scrapperGrants)) ranks[name] = Math.max(ranks[name] ?? 0, rank)
    for (const grant of initiateGrants.filter(grant => grant.level === l)) ranks[grant.skill] = Math.max(ranks[grant.skill] ?? 0, 2)
    if (l === ancestralLevel) for (const name of ancestrySkills) ranks[name] = Math.max(ranks[name] ?? 0, 1)
  }
  if (withOverrides) {
    const skillNames = new Set(statDefs(c).filter((stat) => stat.kind === 'skill').map((stat) => stat.name))
    for (const [name, rank] of Object.entries(c.rankOverrides ?? {})) {
      if (skillNames.has(name)) {
        const autoFloor = rankUp && autoSkills.includes(name)
          ? Math.max(1, ...[...increases].map(rankCap)) : 0
        ranks[name] = Math.max(rank, scrapperGrants[name] ?? rank, autoFloor)
      }
    }
  }
  for (const grant of initiateGrants) ranks[grant.skill] = Math.max(ranks[grant.skill] ?? 0, 2)
  for (const name of ancestrySkills) ranks[name] = Math.max(ranks[name] ?? 0, 1)
  for (const name of [
    ...autoSkills,
    ...backgroundSkills(byName(entries, 'background', c.background), c),
    ...backgroundSkills(freeHeartBackground({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries), c),
    ...(isPioneerHuman(c) ? ['Survival'] : []),
    ...skillTrainingSkills({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries),
  ]) ranks[name] = Math.max(1, ranks[name] ?? 0)
  if (getSettings().skillTokenConversion && c.skillTokenUpgrades?.length) {
    const state = skillTokenState({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries)
    for (const { purchase } of state.active) ranks[purchase.skill] = Math.max(ranks[purchase.skill] ?? 0, purchase.rank)
  }
  return ranks
}

export const proficiencyBonus = (rank: number, level: number) => (rank > 0 ? level + rank * 2 : 0)

export function dailyLongevityRanks(c: Character, entries: ContentEntry[]) {
  return ranksAt(c, entries)
}

export function skillDownload(c: Character, entries: ContentEntry[]) {
  const feat = activeFeatsNamed(c, 'Skill Download')[0]
  const skill = feat?.choice
  const valid = statDefs(c).some(stat => stat.kind === 'skill' && stat.name === skill)
    || c.lores.some(lore => lore.name === skill) || featLores(c, entries).includes(skill ?? '')
    || trainedFeatLores(c).some(grant => grant.name === skill)
    || deityGrantedLores(c).includes(skill ?? '')
    || backgroundSkills(byName(entries, 'background', c.background), c).includes(skill ?? '')
    || backgroundSkills(freeHeartBackground(c, entries), c).includes(skill ?? '') || autoClassSkills(c, entries).includes(skill ?? '')
  return skill && valid ? { skill, rank: c.level >= 17 ? 3 : c.level >= 9 ? 2 : 1 } : undefined
}

export function untrainedSkillProficiency(c: Character) {
  const clever = !!activeFeatsNamed(c, 'Clever Improviser').length
  if (!clever && !activeFeatsNamed(c, 'Untrained Improvisation').length) return undefined
  return {
    bonus: Math.max(0, c.level - (c.level >= 7 ? 0 : c.level >= 5 ? 1 : 2)),
    source: clever ? 'Clever Improviser' : 'Untrained Improvisation',
    trainedActions: clever,
  }
}

export function bulkLimits(c: Character, entries: ContentEntry[]) {
  const strength = abilityMod(c.abilities.str)
  const size = activeFeatsNamed(c, "Jotun's Heart").length
    ? 'Huge' : String(byName(entries, 'ancestry', c.ancestry)?.data.size ?? 'Medium')
  const sizeMultipliers: Record<string, number> = { tiny: 0.5, large: 2, huge: 4, gargantuan: 8 }
  const sizeMultiplier = sizeMultipliers[size.trim().toLowerCase()] ?? 1
  const bonuses: { source: string; encumbered: number; maximum: number }[] = []
  const names = new Set([...c.feats.filter(feat => featTakenLevel(feat) <= c.level).map(feat => feat.name),
    ...automaticFeatGrants(c, entries).map(feat => feat.name)])
  const talon = activeFeatsNamed(c, 'Talon Transporter')[0]
  const priorHefty = talon && activeFeatsNamed(c, 'Hefty Hauler').some(feat => featTakenLevel(feat) <= featTakenLevel(talon))
  for (const name of names) {
    const feat = selectedFeatEntry(c, entries, name)
    const increase = /(?:^|[.!?]\s+|\n\s*)Increase your (?:maximum and encumbered|encumbered and maximum) Bulk limits by (\d+)\b/i
      .exec(feat?.description ?? '')
    const value = increase ? Number(increase[1])
      : name === 'Talon Transporter' && priorHefty || name === 'Adrenaline Rush' && c.raging ? 2 : 0
    if (value) bonuses.push({ source: name, encumbered: value, maximum: value })
  }
  if (classFeatures(entries, c).some(feature => feature.name === 'Walking Armory')) {
    const constitution = abilityMod(c.abilities.con)
    bonuses.push({ source: 'Walking Armory', encumbered: Math.ceil(constitution / 2), maximum: constitution })
  }
  return {
    encumbered: Math.floor((5 + strength + bonuses.reduce((total, bonus) => total + bonus.encumbered, 0)) * sizeMultiplier),
    maximum: Math.floor((10 + strength + bonuses.reduce((total, bonus) => total + bonus.maximum, 0)) * sizeMultiplier),
    strength, size, sizeMultiplier, bonuses,
  }
}

export const WEAPON_GROUPS = ['Simple', 'Martial', 'Advanced', 'Unarmed'] as const
export const ARMOR_GROUPS = ['Light', 'Medium', 'Heavy', 'Unarmored'] as const

// Class text such as "Trained in simple weapons" plus feature text such as
// "Your proficiency ranks for light armor and unarmored defense increase to expert"
function groupRanks<G extends string>(c: Character, entries: ContentEntry[], groups: readonly G[], field: string, applies: (text: string) => boolean) {
  const ranks = Object.fromEntries(groups.map((g) => [g, 0])) as Record<G, number>
  const mentioned = (text: string) => groups.filter((g) => new RegExp(`\\b${g}\\b`, 'i').test(text)
    || field === 'defense_proficiency' && /\ball armor\b/i.test(text) && g !== 'Unarmored')
  const klass = byName(entries, 'class', c.className)
  const base = klass?.data[field]
  if (typeof base === 'string') {
    for (const m of base.matchAll(/(untrained|trained|expert|master|legendary) in ([^,]+)/gi)) {
      if (!applies(m[2])) continue
      for (const g of mentioned(m[2])) ranks[g] = Math.max(ranks[g], rankFromText(m[1]))
    }
  }
  for (const f of classFeatures(entries, c)) {
    for (const m of f.description.matchAll(/proficiency ranks? for ([^.]*?) increases? to (expert|master|legendary)/gi)) {
      if (!applies(m[1])) continue
      for (const g of mentioned(m[1])) ranks[g] = Math.max(ranks[g], rankFromText(m[2]))
    }
    for (const m of f.description.matchAll(/(?:gain (expert|master|legendary) proficiency in|proficiency ranks? increases? to (expert|master|legendary) for) ([^.]+)/gi)) {
      if (!applies(m[3])) continue
      for (const g of mentioned(m[3])) ranks[g] = Math.max(ranks[g], rankFromText(m[1] || m[2]))
    }
  }
  return ranks
}

const baseWeaponRanks = (c: Character, entries: ContentEntry[]) =>
  groupRanks(c, entries, WEAPON_GROUPS, 'attack_proficiency', (t) => /weapons?|unarmed attacks?/i.test(t))
const proficiencyFeats = (c: Character, name: string) => c.feats.map((feat, index) => ({ feat, index }))
  .filter(({ feat }) => feat.name === name && featTakenLevel(feat) <= c.level)
  .sort((a, b) => featTakenLevel(a.feat) - featTakenLevel(b.feat) || a.index - b.index)

function weaponProficiencyGrants(c: Character, entries: ContentEntry[]) {
  return proficiencyFeats(c, 'Weapon Proficiency').map((selected, order) => ({
    ...selected,
    martial: order === 0 && baseWeaponRanks({ ...c, level: featTakenLevel(selected.feat) }, entries).Martial === 0,
  }))
}

export function weaponHasAncestryTrait(weapon: ContentEntry, entries: ContentEntry[]) {
  return entries.some(entry => ['ancestry', 'heritage'].includes(entry.kind) && !entry.deleted
    && weapon.traits.some(trait => trait.toLowerCase() === entry.name.toLowerCase()))
}

function unconventionalWeapon(c: Character, entries: ContentEntry[], weapon: ContentEntry) {
  const name = combinationName(entries, weapon.name)
  const identity = (value: string) => {
    const resolved = weaponEntry(entries, value)
    if (/^Shobhad Longrifle(?: \((?:Pathfinder|Starfinder)\))?$/.test(value) && resolved)
      return `Shobhad Longrifle:${resolved.systems.includes('sf2e') ? 'sf2e' : 'pf2e'}`
    return combinationName(entries, value)
  }
  return activeFeatsNamed(c, 'Unconventional Weaponry').find(feat => !!feat.choice && identity(feat.choice) === identity(name)
    && (uncommonWeapon(weapon) || !featRarity(weapon)
      || /^Shobhad Longrifle(?: \(Pathfinder\))?$/.test(weapon.name) && featRarity(weapon) === 'Rare' && feat.rareWeaponOverride)
    && featChoiceOptions(feat.name, c, entries, feat.slot ?? '', c.feats.indexOf(feat))?.some(option => identity(option) === identity(name)))
}

export function weaponAccessSources(c: Character, entries: ContentEntry[], weapon: ContentEntry) {
  const barbarianWarJavelinAccess = getSettings().barbarianWarJavelinAccess
    && c.className === 'Barbarian' && c.systems.includes('pf2e')
    && weapon.systems.includes('pf2e') && weapon.name === 'War Javelin' && featRarity(weapon) === 'Uncommon'
  const inventorFirearmAccess = getSettings().inventorFirearmAccess
    && c.className === 'Inventor' && c.systems.includes('pf2e')
    && weapon.systems.includes('pf2e') && featRarity(weapon) === 'Uncommon'
    && (String(weapon.data.weapon_group ?? '').toLowerCase() === 'firearm'
      || String(weapon.data.weapon_category ?? '').toLowerCase() === 'ammunition' && /firearm ammunition/i.test(weapon.name)
      || weapon.name === 'Bladed Gauntlet')
  return [...weaponFamiliarity(c, weapon, weaponCategory(weapon), entries).access,
    ...(unconventionalWeapon(c, entries, weapon) ? ['Unconventional Weaponry'] : []),
    ...(barbarianWarJavelinAccess ? ['Barbarian War Javelin Access'] : []),
    ...(inventorFirearmAccess ? ['Inventor Firearm Access'] : [])]
}

export function weaponRanks(c: Character, entries: ContentEntry[]) {
  const ranks = baseWeaponRanks(c, entries)
  if (weaponProficiencyGrants(c, entries).some((grant) => grant.martial)) ranks.Martial = Math.max(ranks.Martial, c.level >= 11 ? 2 : 1)
  if (c.level >= 11 && activeFeatsNamed(c, 'Martial Experience').length) {
    for (const category of ['Simple', 'Martial', 'Advanced'] as const) ranks[category] = Math.max(ranks[category], 1)
  }
  return ranks
}

function baseArmorRanks(c: Character, entries: ContentEntry[]) {
  const ranks = groupRanks(c, entries, ARMOR_GROUPS, 'defense_proficiency', (t) => /armor|unarmored defense/i.test(t))
  const klass = byName(entries, 'class', c.className)
  for (const group of ARMOR_GROUPS) {
    const key = group === 'Unarmored' ? 'unarmored' : `${group.toLowerCase()}_armor`
    ranks[group] = Math.max(ranks[group], rankFromText(klass?.data[`${key}_proficiency`]))
  }
  return ranks
}

export function armorRanks(c: Character, entries: ContentEntry[]) {
  const ranks = baseArmorRanks(c, entries)
  if (rogueRackets(c, entries).some(racket => racket === 'Ruffian' || racket === 'Avenger')) ranks.Medium = Math.max(ranks.Medium, ranks.Light, 1)
  if (activeFeatsNamed(c, 'Animal Skin').length) ranks.Unarmored = Math.max(ranks.Unarmored, 2)
  const guardianDedications = proficiencyFeats(c, 'Guardian Dedication')
  const guardianArmorGroups = new Set<typeof ARMOR_GROUPS[number]>()
  for (const { feat } of guardianDedications) {
    const level = featTakenLevel(feat)
    const prior = armorRanks({ ...c, level,
      feats: c.feats.filter(other => other.name !== 'Guardian Dedication' && featTakenLevel(other) <= level) }, entries)
    const granted = prior.Light && prior.Medium ? ['Heavy'] as const : ['Light', 'Medium'] as const
    for (const group of granted) {
      guardianArmorGroups.add(group)
      ranks[group] = Math.max(ranks[group], 1)
    }
  }
  if (guardianArmorGroups.size) {
    const classRanks = baseArmorRanks(c, entries)
    const armorExpertise = Math.max(...ARMOR_GROUPS.filter(group => group !== 'Unarmored').map(group => classRanks[group]))
    const unarmoredExpertise = c.level >= 13 ? classRanks.Unarmored : 0
    const grantedRank = Math.max(armorExpertise, unarmoredExpertise)
    if (grantedRank >= 2) for (const group of guardianArmorGroups) ranks[group] = Math.max(ranks[group], grantedRank)
  }
  const granted = new Set<typeof ARMOR_GROUPS[number]>()
  for (const { feat } of proficiencyFeats(c, 'Armor Proficiency')) {
    const prior = baseArmorRanks({ ...c, level: featTakenLevel(feat) }, entries)
    const group = ARMOR_GROUPS.find((group) => group !== 'Unarmored' && !prior[group] && !granted.has(group))
    if (!group) continue
    granted.add(group)
    ranks[group] = Math.max(ranks[group], c.level >= 13 ? 2 : 1)
  }
  const bulwark = activeFeatsNamed(c, 'Infernal Bulwark')[0]
  if (bulwark) {
    const level = featTakenLevel(bulwark)
    const prior = armorRanks({ ...c, level,
      feats: c.feats.filter(feat => feat.name !== bulwark.name && featTakenLevel(feat) <= level) }, entries).Heavy
    ranks.Heavy = Math.max(ranks.Heavy, prior ? 2 : 1)
  }
  return ranks
}

export function armorSaveBonus(c: Character, entries: ContentEntry[]) {
  const worn = wornArmor(c, entries)
  return Math.max(worn?.resilient ?? 0, num(worn && armorEntry(c, entries, worn.name)?.data.grade_save_bonus))
}

export type TotalPart = { label: string; value: number; note?: string }
export type TotalBreakdown = { total: number; parts: TotalPart[]; notes?: string[] }

export function savingThrowBreakdown(c: Character, entries: ContentEntry[], name: 'Fortitude' | 'Reflex' | 'Will',
  ranks = ranksAt(c, entries)): TotalBreakdown {
  const ability = { Fortitude: 'con', Reflex: 'dex', Will: 'wis' } as const
  const rank = ranks[name] ?? 0
  const armor = wornArmor(c, entries)
  const item = armorSaveBonus(c, entries)
  const researched = researchedSpellResistance(c, entries)
  const parts: TotalPart[] = [
    { label: ABILITY_LABEL[ability[name]], value: abilityMod(c.abilities[ability[name]]) },
    { label: 'Proficiency', value: proficiencyBonus(rank, c.level), note: RANKS[rank] },
    { label: armor ? `${armor.name} (resilient or grade)` : 'Item', value: item },
  ]
  if (name === 'Fortitude' && hasDivineIntercession(c, 'Asmodeus', 'major-curse')) {
    parts.push({ label: 'Asmodeus Major Curse: drained 4 (condition)', value: -4 })
  }
  const clumsy = name === 'Reflex' ? giantWeaponClumsy(c, entries) : 0
  if (clumsy) parts.push({ label: 'Giant Instinct: clumsy (status)', value: -clumsy })
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  const mightyBulwark = name === 'Reflex' && activeFeatsNamed(c, 'Mighty Bulwark').length > 0
  const bulwark = name === 'Reflex' && (mightyBulwark ? 'Mighty Bulwark' : armor && (activeFeatsNamed(c, 'Infernal Bulwark').length ? 'Infernal Bulwark'
    : armorEntry(c, entries, armor.name)?.traits.some(trait => trait.toLowerCase() === 'bulwark') ? armor.name : undefined))
  const guardianArmorBonus = name === 'Reflex' && armor && c.className === 'Guardian'
    && classFeatures(entries, c).some(feature => feature.name === 'Guardian Mastery')
    ? num(armorEntry(c, entries, armor.name)?.data.ac) + (armor.potency ?? 0)
      + (armorEntry(c, entries, armor.name)?.traits.some(trait => trait.toLowerCase() === 'bulwark') ? 1 : 0)
    : undefined
  const notes = [
    ...hellknightSkillNotes(c, name).map(benefit => `${benefit.name}: ${benefit.description}`),
    ...(bulwark
      ? [`${bulwark}: ${signed(total + Math.max(0, (mightyBulwark ? 4 : 3) - abilityMod(c.abilities.dex)))} on damaging Reflex saves using a +${mightyBulwark ? 4 : 3} circumstance bonus instead of Dexterity, if higher${mightyBulwark ? '' : " (requires armor with the bulwark trait)"}.`] : []),
    ...(guardianArmorBonus !== undefined
      ? [`Guardian Mastery: ${signed(total + Math.max(0, guardianArmorBonus - abilityMod(c.abilities.dex)))} on damaging Reflex saves using your armor's item bonus to AC (${signed(guardianArmorBonus)}) instead of Dexterity, if higher; a success becomes a critical success.`] : []),
    ...(researched ? [`Researched Spell Resistance: +1 circumstance against ${researched.traditions.join(', ')} spells and effects; circumstance bonuses do not stack.`] : []),
    ...(activeFeatsNamed(c, 'Hazard Finder').length
      ? ['Hazard Finder +1 circumstance against hazard effects; circumstance bonuses do not stack.'] : []),
    ...(activeFeatsNamed(c, 'Parthenogenic Hatchling').length
      ? ['Parthenogenic Hatchling +1 circumstance against diseases; a success becomes a critical success. If another ability would improve the save this way, a critical failure becomes a failure instead.'] : []),
  ]
  return { total, parts, notes: notes.length ? notes : undefined }
}

export function defenseSummary(c: Character, entries: ContentEntry[]) {
  const ranks = ranksAt(c, entries)
  return {
    perception: abilityMod(c.abilities.wis) + proficiencyBonus(ranks.Perception ?? 0, c.level)
      + perceptionItemBonus(c, entries) + perceptionCircumstanceBonus(c),
    ac: armorClass(c, entries),
    hp: maxHp(c, entries),
    fortitude: savingThrowBreakdown(c, entries, 'Fortitude', ranks).total,
    reflex: savingThrowBreakdown(c, entries, 'Reflex', ranks).total,
    will: savingThrowBreakdown(c, entries, 'Will', ranks).total,
  }
}

const cap = (v: string) => v[0].toUpperCase() + v.slice(1)

export const INFERNAL_BULWARK_ORDERS: Record<string, string> = {
  'Order of the Chain': 'electricity', 'Order of the Crucible': 'cold', 'Order of the Eclipse': 'void', 'Order of the Pyre': 'fire',
}

const HELLKNIGHT_ORDERS = [...new Set([...Object.keys(INFERNAL_BULWARK_ORDERS),
  'Order of the Gate', 'Order of the Godclaw', 'Order of the Nail', 'Order of the Pike', 'Order of the Rack', 'Order of the Scourge', 'Order of the Torrent'])].sort()

const ARMOR_SPECIALIZATIONS: Record<string, {
  kind: 'damage' | 'resistance' | 'reduction'; damage?: string; label: string; medium: number; heavy: number
}> = {
  wood: { kind: 'damage', damage: 'Piercing', label: 'Piercing Damage', medium: 3, heavy: 5 },
  skeletal: { kind: 'resistance', damage: 'Precision', label: 'Precision Resistance', medium: 3, heavy: 5 },
  composite: { kind: 'resistance', damage: 'Piercing', label: 'Piercing Resistance', medium: 1, heavy: 2 },
  leather: { kind: 'resistance', damage: 'Bludgeoning', label: 'Bludgeoning Resistance', medium: 1, heavy: 2 },
  plate: { kind: 'resistance', damage: 'Slashing', label: 'Slashing Resistance', medium: 1, heavy: 2 },
  chain: { kind: 'reduction', label: 'Critical Hit Damage Reduction', medium: 4, heavy: 6 },
}

// Armor specialization comes from class features and feats that mention it; its effect depends on the worn armor's group
export const isHellknightArmor = (armor?: ContentEntry) => /^Hellknight (?:Breastplate|Half Plate|Plate)\b/i.test(armor?.name ?? '')

export function hellknightArmorWorn(c: Character, entries: ContentEntry[]) {
  const worn = wornArmor(c, entries)
  return !!worn && isHellknightArmor(armorEntry(c, entries, worn.name))
}

export function armorSpecialization(c: Character, entries: ContentEntry[]) {
  const worn = wornArmor(c, entries)
  if (!worn) return undefined
  const armor = armorEntry(c, entries, worn.name)
  const groups = tokens(armor?.data.armor_group).map((g) => g.toLowerCase())
  const category = String(armor?.data.armor_category ?? '').toLowerCase()
  // Class features apply to every group; feats may limit it to named groups and armor categories
  const fromClass = !category || ['medium', 'heavy'].includes(category)
    ? classFeatures(entries, c).find((f) => /armor specialization/i.test(`${f.name} ${f.description}`)) : undefined
  const fromFeat = c.feats.find((f) => {
    if (featTakenLevel(f) > c.level) return false
    const e = selectedFeatEntry(c, entries, f.name, f.sourceId)
    if (f.name === 'Hellknight Preferment') return false
    if (!e?.data.grants_armor_specialization && !/armor specialization/i.test(f.name)) return false
    const allowed = tokens(e?.data.grants_armor_groups).map((g) => g.toLowerCase())
    const categories = tokens(e?.data.grants_armor_categories).map((g) => g.toLowerCase())
    return (!allowed.length || groups.some((g) => allowed.includes(g))) && (!categories.length || categories.includes(category))
  })
  const preferment = isHellknightArmor(armor) ? activeFeatsNamed(c, 'Hellknight Preferment')[0] : undefined
  if (!fromClass && !fromFeat && !preferment) return undefined
  const group = groups.map((g) => entries.find((e) => e.kind === 'armorGroup' && !e.deleted && e.name.toLowerCase() === g)).find(Boolean)
  if (!group) return undefined
  const rule = ARMOR_SPECIALIZATIONS[group.name.toLowerCase()]
  const base = category === 'medium' ? rule?.medium : category === 'heavy' ? rule?.heavy : undefined
  const improvement = armor?.data.armor_grade ? num(armor.data.grade_save_bonus) : worn.potency
  const benefit = rule && base !== undefined ? { kind: rule.kind, damage: rule.damage, value: base + improvement + (preferment && rule.kind === 'resistance' ? 1 : 0) } : undefined
  const summary = benefit ? `${benefit.value} ${rule.label}`
    : rule ? `Value not specified for ${category || 'unknown-category'} armor` : undefined
  return {
    group: group.name, armor: worn.name, feat: fromClass ? undefined : fromFeat?.name ?? preferment?.name, feature: fromClass?.name,
    effect: group.description.replace(/^Source .*?pg\. \d+\s*/i, ''), benefit, summary,
  }
}

function hellknightFeatCount(c: Character, entries: ContentEntry[]) {
  return c.feats.filter(feat => featTakenLevel(feat) <= c.level
    && /\bHellknight\b/.test(String(selectedFeatEntry(c, entries, feat.name, feat.sourceId)?.data.archetype ?? ''))).length
}

// Resistances from heritage, ancestry, background, class features, feats, carried items and worn armor (structured effects or synced "damage=value" data)
const FEAT_RESISTANCES: Record<string, Record<string, number | 'half'>> = {
  'Blast Resistance': { fire: 3, sonic: 3 }, 'Favor of Heaven': { good: 5, evil: 5 }, 'Inured to the Heat': { fire: 4 },
  'Nothing but Fluff': { precision: 'half' },
  'Skeletal Resistance': { cold: 2, electricity: 2, fire: 2, piercing: 2, slashing: 2 },
}

export function resistances(c: Character, entries: ContentEntry[]) {
  const sources = [
    ...characterHeritages(c, entries),
    c.ancestry ? byName(entries, 'ancestry', c.ancestry) : undefined,
    c.background ? byName(entries, 'background', c.background) : undefined,
    ...classFeatures(entries, c),
    ...c.feats.filter((feat) => featTakenLevel(feat) <= c.level
      && !['Primal Aegis', 'Harden Flesh', 'Heart of the Kaiju', 'Wasteland Warrior', 'Radiation Resistant', 'Deflective Plating', 'Infernal Bulwark', 'Energy Neutralizer', 'Enhanced Energy Neutralizer'].includes(feat.name))
      .map((feat) => selectedFeatEntry(c, entries, feat.name, feat.sourceId)),
    ...c.equipment.filter(g => !isNamedArmor(g.name)).map((g) => byName(entries, 'item', g.name)),
    wornArmor(c, entries) ? armorEntry(c, entries, wornArmor(c, entries)!.name) : undefined,
  ].filter((e): e is ContentEntry => !!e)
  const half = Math.max(1, Math.floor(c.level / 2))
  const out: { damage: string; value: number; source: string }[] = []
  for (const feat of activeFeatsNamed(c, 'Planar Resilience')) {
    if (feat.choice && ['Cold', 'Fire'].includes(feat.choice)) {
      out.push({ damage: feat.choice.toLowerCase(), value: half, source: 'Planar Resilience' })
    }
  }
  for (const feat of activeFeatsNamed(c, 'Reinforced Skeleton')) {
    const [energy, physical] = feat.choice?.split(',').map(value => value.trim()) ?? []
    if (['Cold', 'Electricity', 'Fire'].includes(energy ?? '')
      && ['Piercing', 'Slashing'].includes(physical ?? '')) {
      out.push({ damage: energy.toLowerCase(), value: half, source: 'Reinforced Skeleton' })
      out.push({ damage: physical.toLowerCase(), value: half, source: 'Reinforced Skeleton' })
    }
  }
  if (activeFeatsNamed(c, 'Sanguine Mastery').length) {
    out.push({ damage: 'bleed', value: half, source: 'Sanguine Mastery' })
    out.push({ damage: 'fast healing while an enemy within 30 feet is bleeding (inactive while dying)', value: half, source: 'Sanguine Mastery' })
  }
  if (activeFeatsNamed(c, 'Become as Spirit').length) {
    out.push({ damage: 'all damage except force, ghost touch, spirit, and vitality (for 1 round after destroying a thrall)',
      value: half, source: 'Become as Spirit' })
  }
  if (soldierStyle(c)?.name === 'Armor Storm') {
    out.push({ damage: 'all damage from attacks by suppressed creatures', value: half, source: 'Armor Storm' })
  }
  if ((c.weapons ?? []).some(weapon => weaponEntry(entries, weapon.name)?.data.named_weapon_source === "Spear of the Destroyer's Flame")) {
    out.push({ damage: 'fire', value: 20, source: "Spear of the Destroyer's Flame" })
  }
  if (hasDivineIntercession(c, 'Asmodeus', 'moderate-boon')) {
    out.push({ damage: 'Fire', value: 5, source: 'Asmodeus (Moderate Boon)' })
  }
  if (c.raging && c.level >= 9 && isGiantInstinct(c, entries)) {
    const value = Math.max(0, 3 + abilityMod(c.abilities.con))
    for (const damage of ['bludgeoning', ...(c.giantRagingResistance ? [c.giantRagingResistance] : [])]) {
      out.push({ damage, value, source: 'Raging Resistance' })
    }
  }
  const armor = wornArmor(c, entries)
  if (armor) out.push(...energyNeutralizerResistances(c, armor.id))
  if (wornArmor(c, entries)?.id === INVENTOR_ARMOR_ID) out.push(...inventorArmorResistances(c))
  const oaken = oakenResilience(c, entries)
  if (oaken) for (const damage of ['bludgeoning', 'piercing']) out.push({ damage, value: oaken.resistance, source: 'Oaken Resilience' })
  const cairn = cairnForm(c, entries)
  if (cairn) out.push({ damage: 'physical (except adamantine)', value: cairn.resistance, source: 'Cairn Form' })
  if (isSpellActive(c, entries, 'Mountain Resilience')) {
    const rank = grantedFeatSpells(c, entries).find(grant => grant.entry.name === 'Mountain Resilience')?.rank
      ?? Math.ceil(c.level / 2)
    if (rank >= 4) out.push({
      damage: 'physical (except adamantine)', value: Math.min(20, 5 * Math.floor((rank - 2) / 2)), source: 'Mountain Resilience',
    })
  }
  if (activeUntamedShiftEffects(c, entries).includes('Elemental')) {
    for (const damage of ['critical hits', 'precision']) out.push({ damage, value: 5, source: 'Untamed Shift' })
  }
  if (isSpellActive(c, entries, 'Untamed Form') && activeFeatsNamed(c, 'Elemental Shape').length) {
    out.push({ damage: 'fire', value: 5, source: 'Elemental Shape (polymorphed)' })
  }
  if (activeFeatsNamed(c, 'Wasteland Warrior').length) {
    for (const damage of ['cold', 'fire']) out.push({ damage, value: half, source: 'Wasteland Warrior' })
  }
  if (activeFeatsNamed(c, 'Radiation Resistant').length) {
    out.push({ damage: 'poison (radiation only)', value: c.level, source: 'Radiation Resistant' })
  }
  const bulwark = activeFeatsNamed(c, 'Infernal Bulwark').length ? activeFeatsNamed(c, 'Hellknight Dedication')[0]?.choice : undefined
  if (armor && bulwark && INFERNAL_BULWARK_ORDERS[bulwark]) {
    out.push({ damage: INFERNAL_BULWARK_ORDERS[bulwark], value: half, source: `Infernal Bulwark (${bulwark})` })
  }
  const dedication = activeFeatsNamed(c, 'Hellknight Dedication')
    .find(feat => /resistance to mental damage/i.test(selectedFeatEntry(c, entries, feat.name, feat.sourceId)?.description ?? ''))
  if (dedication) {
    out.push({ damage: 'mental', value: 1 + Math.max(0, hellknightFeatCount(c, entries) - 1), source: 'Hellknight Dedication' })
  }
  const plating = activeFeatsNamed(c, 'Deflective Plating')[0]?.choice
  if (plating && featChoiceOptions('Deflective Plating', c, entries, '')?.includes(plating)) {
    out.push({ damage: plating, value: Math.floor(c.level / 2), source: 'Deflective Plating' })
  }
  for (const e of sources) {
    for (const f of e.effects) if (f.type === 'resistance') out.push({ damage: f.damage, value: f.value, source: e.name })
    for (const part of String(e.data.resistances ?? '').split(',').filter(Boolean)) {
      const [damage, v] = part.split('=')
      out.push({ damage, value: v === 'half' ? half : v === 'hellknight' ? hellknightFeatCount(c, entries) : +v, source: e.name })
    }
  }
  for (const [feat, grants] of Object.entries(FEAT_RESISTANCES)) {
    if (activeFeatsNamed(c, feat).length) for (const [damage, value] of Object.entries(grants)) out.push({ damage, value: value === 'half' ? half : value, source: feat })
  }
  if (activeFeatsNamed(c, 'Pain Tolerance').length
    && !out.some(resistance => resistance.source === 'Pain Tolerance' && resistance.damage.toLowerCase() === 'mental')) {
    out.push({ damage: 'mental', value: Math.floor(c.level / 2), source: 'Pain Tolerance' })
  }
  const specialization = armorSpecialization(c, entries)
  if (specialization?.benefit?.kind === 'resistance' && specialization.benefit.damage) out.push({
    damage: specialization.benefit.damage, value: specialization.benefit.value,
    source: `${specialization.group} Armor Specialization`,
  })
  const aegis = abilityMod(c.abilities.wis)
  if (activeFeatsNamed(c, 'Primal Aegis').length && aegis > 0) {
    for (const damage of ['acid', 'cold', 'electricity', 'fire', 'vitality', 'void']) {
      out.push({ damage, value: aegis, source: 'Primal Aegis' })
    }
  }
  if (isFeatEffectActive(c, 'Heart of the Kaiju')) out.push({ damage: 'physical', value: 5, source: 'Heart of the Kaiju' })
  for (const rune of wornArmor(c)?.runes ?? []) {
    const m = /^Energy-Resistant( \(Greater\))?: (\w+)$/.exec(rune.replace(/^Greater Energy-Resistant/, 'Energy-Resistant (Greater)')) ?? /^()(\w+) Resistant$/.exec(rune)
    if (m) out.push({ damage: m[2], value: m[1] ? 10 : 5, source: `${rune} rune` })
  }
  return out.map((r) => ({ ...r, damage: cap(r.damage) }))
}

export function cairnForm(c: Character, entries: ContentEntry[]) {
  if (!isSpellActive(c, entries, 'Cairn Form')) return undefined
  const rank = grantedFeatSpells(c, entries).find(grant => grant.entry.name === 'Cairn Form')?.rank
    ?? Math.ceil(c.level / 2)
  if (rank < 4) return undefined
  return { rank, resistance: rank >= 10 ? 20 : rank >= 6 ? 10 : 5, dice: rank >= 10 ? 4 : rank >= 6 ? 3 : 2 }
}

export function oakenResilience(c: Character, entries: ContentEntry[], target: 'character' | 'familiar' = 'character') {
  const spellRank = isSpellActive(c, entries, 'Oaken Resilience')
    ? grantedFeatSpells(c, entries).find(grant => grant.source === 'Grown of Oak' && grant.entry.name === 'Oaken Resilience')?.rank
      ?? c.oakenResilienceRank : undefined
  const itemRanks = target === 'character' ? carriedWeapons(c, entries)
    .filter(weapon => weapon.briarOakenResilienceActive)
    .map(weapon => withNamedWeaponState(weaponEntry(entries, weapon.name), weapon, c.level)?.data.named_weapon_oaken_rank) : []
  const rank = Math.max(0, ...[spellRank, ...itemRanks]
    .filter((rank): rank is number => typeof rank === 'number' && Number.isInteger(rank) && rank >= 2 && rank <= 10))
  if (!rank) return undefined
  const steps = 1 + Math.floor((rank - 2) / 2)
  return { rank, resistance: 2 * steps, fireWeakness: 3 * steps }
}

export const wornArmor = (c: Character, entries: ContentEntry[] = []): OwnedArmor | undefined =>
  ownedArmors(c, entries).find(armor => armor.worn)
export const perceptionItemBonus = (c: Character, entries: ContentEntry[] = []) => Math.max(0, ...(wornArmor(c, entries)?.runes ?? []).map((rune) => {
  const name = runeName(rune)
  return name === 'Sunweave' ? 1 : name === 'Sunweave (Greater)' ? 2 : name === 'Sunweave (Major)' ? 3 : 0
}))

const armorCategory_ = (e: ContentEntry) => e.data.armor_category === 'Special' ? 'special' : armorCategory(e).toLowerCase()

function equippedArmorEntry(c: Character, entries: ContentEntry[]) {
  const worn = wornArmor(c, entries)
  return worn
    ? armorEntry(c, entries, worn.name)
    : c.armors
      ? undefined
      : c.equipment
        .map((item) => byName(entries, 'armor', item.name))
        .filter((entry): entry is ContentEntry => !!entry)
        .sort((a, b) => num(b.data.ac) - num(a.data.ac))[0]
}

export function animalSkinBenefits(c: Character, entries: ContentEntry[]) {
  if (!c.raging || !activeFeatsNamed(c, 'Animal Skin').length) return undefined
  const armor = equippedArmorEntry(c, entries)
  if (armor ? armorCategory_(armor) !== 'unarmored' : !!wornArmor(c)) return undefined
  return { itemBonus: classFeatures(entries, c).some((feature) => feature.name === 'Greater Juggernaut') ? 3 : 2, dexCap: 3 }
}

export function armorProficiencyRank(c: Character, entries: ContentEntry[], armor?: ContentEntry) {
  const armorCategory = armor ? armorCategory_(armor) : 'unarmored'
  const categoryKey = armorCategory === 'unarmored' ? 'unarmored' : `${armorCategory}_armor`
  const klass = byName(entries, 'class', c.className)
  const proficiencyFields = [
    klass?.data[`${categoryKey}_proficiency`],
    klass?.data.armor_proficiency,
    klass?.data.armor_class_proficiency,
    klass?.data.ac_proficiency,
  ]
  let rank = armorCategory === 'special' ? 0 : proficiencyFields.reduce<number>((best, value) => Math.max(best, rankFromText(value)), 0)
  const featureRank = armorCategory === 'special' ? 0 : classFeatures(entries, c).reduce<number>((best, feature) => {
    const name = feature.name.toLowerCase()
    const applies = name.includes('armor expertise')
      || (armorCategory === 'unarmored' ? name.includes('unarmored') : name.includes(`${armorCategory} armor`))
    if (!applies) return best
    if (name.includes('legendary')) return Math.max(best, 4)
    if (name.includes('master')) return Math.max(best, 3)
    if (name.includes('expert')) return Math.max(best, 2)
    return best
  }, 0)
  const ranks = armorRanks(c, entries)
  rank = Math.max(rank, featureRank, num(armor?.data.min_proficiency),
    armor?.data.highest_armor_proficiency ? Math.max(...Object.values(ranks)) : 0,
    armor?.data.medium_proficiency ? ranks.Medium : 0,
    armorCategory === 'special' ? 0 : ranks[armorCategory === 'unarmored' ? 'Unarmored' : armorCategory === 'light' ? 'Light' : armorCategory === 'medium' ? 'Medium' : 'Heavy'])
  return rank
}

export function armorClassBreakdown(c: Character, entries: ContentEntry[]): TotalBreakdown {
  const worn = wornArmor(c, entries)
  const armor = equippedArmorEntry(c, entries)
  const armorCategory = armor ? armorCategory_(armor) : 'unarmored'
  const rank = armorProficiencyRank(c, entries, armor)
  const dexterity = abilityMod(c.abilities.dex)
  const skin = animalSkinBenefits(c, entries)
  const dexCap = skin?.dexCap ?? (armor ? num(armor.data.dex_cap) : Number.POSITIVE_INFINITY)
  const raised = shieldRaised(c) ? shieldAcBonus(c, entries) : 0
  const raisedCantrip = isSpellActive(c, entries, 'Shield') ? 1 : 0
  const parry = parryBonus(c, entries)
  const candidates = [
    { label: 'Raised shield', value: raised },
    { label: 'Raised dermal plating', value: activeFeatsNamed(c, 'Thresher Ko-1 Frame').length
      && c.dermalPlating?.raised && !c.dermalPlating.damaged ? 1 : 0 },
    { label: 'Raise Shield cantrip', value: raisedCantrip },
    { label: 'Parry', value: parry },
  ].filter(candidate => candidate.value > 0)
  const best = Math.max(0, ...candidates.map(candidate => candidate.value))
  const parts: TotalPart[] = [
    { label: 'Base', value: 10 },
    { label: armor?.name ?? 'Armor', value: num(armor?.data.ac) },
    { label: worn ? `${worn.name} potency` : 'Armor potency', value: worn?.potency ?? 0 },
    ...(skin ? [{ label: 'Animal Skin (item)', value: skin.itemBonus }] : []),
    { label: 'Dexterity', value: Math.min(dexterity, dexCap),
      note: Number.isFinite(dexCap) ? `Modifier ${signed(dexterity)}; cap ${signed(dexCap)}` : undefined },
    { label: 'Proficiency', value: proficiencyBonus(rank, c.level), note: `${RANKS[rank]} (${armorCategory})` },
  ]
  if (best) parts.push({ label: `${candidates.filter(candidate => candidate.value === best).map(candidate => candidate.label).join(' / ')} (circumstance)`, value: best })
  const clumsy = giantWeaponClumsy(c, entries)
  if (clumsy) parts.push({ label: 'Giant Instinct: clumsy (status)', value: -clumsy })
  const notes = candidates.length > 1 ? ['Circumstance bonuses do not stack: '
    + candidates.map(candidate => `${candidate.label} ${signed(candidate.value)}`).join(', ') + '.'] : []
  if (activeFeatsNamed(c, 'Hazard Finder').length)
    notes.push('Hazard Finder +1 circumstance against hazard attacks; circumstance bonuses do not stack.')
  notes.push(...hellknightSkillNotes(c, 'AC').map(benefit => `${benefit.name}: ${benefit.description} Circumstance bonuses do not stack.`))
  return { total: parts.reduce((sum, part) => sum + part.value, 0), parts, notes }
}

export const armorClass = (c: Character, entries: ContentEntry[]) => armorClassBreakdown(c, entries).total

// Imported equipment shows up as configurable gear until the player edits it
const DWARF_CLAN_PISTOL_ID = 'granted-weapon:dwarf:clan-pistol'
const DWARF_CLAN_DAGGER_ID = 'granted-weapon:dwarf:clan-dagger'

const iruxiAttackIds = new Set([IRUXI_CLAWS.id, IRUXI_FANGS.id, IRUXI_TAIL.id])

function dwarfClanWeaponGrants(c: Character, entries: ContentEntry[]): OwnedWeapon[] {
  const nativeDwarf = c.systems.includes('pf2e') && c.ancestry?.trim().toLowerCase() === 'dwarf'
  const adoptedDwarf = getSettings().adoptedDwarfClanDagger
    && activeFeatsNamed(c, 'Adopted Ancestry').some(feat => feat.choice?.trim().toLowerCase() === 'dwarf')
  const clanPistol = activeFeatsNamed(c, 'Clan Pistol').length > 0
  if (!nativeDwarf && !adoptedDwarf && !clanPistol) return []
  const attributes = tokens(byName(entries, 'class', c.className)?.data.attribute)
    .map(attribute => ABILITY_NAMES[attribute.toLowerCase()]).filter((ability): ability is Ability => !!ability)
  const selected = c.boosts?.class
  const keyAbility = attributes.length === 1 ? attributes[0] ?? 'str'
    : selected && attributes.includes(selected) ? selected
      : attributes.includes('str') ? 'str' : attributes[0] ?? 'str'
  return [
    ...(clanPistol ? [{ id: DWARF_CLAN_PISTOL_ID, name: CLAN_PISTOL.name, potency: 0, striking: 0, runes: [], material: 'Orichalcum', stowed: true }] : []),
    ...(nativeDwarf || adoptedDwarf ? [{ id: DWARF_CLAN_DAGGER_ID,
      name: keyAbility === 'dex' ? CLAN_DAGGER_DEXTERITY.name : CLAN_DAGGER.name,
      potency: 0, striking: 0, runes: [], material: 'Orichalcum', stowed: true }] : []),
  ]
}

export function isGrantedDwarfClanWeapon(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  return dwarfClanWeaponGrants(c, entries).some(grant => grant.id === weapon.id)
}

export function clanDaggerFiligreeBonus(c: Character, entries: ContentEntry[]) {
  return c.level >= 5 && ownedWeapons(c, entries).some(weapon =>
    [CLAN_DAGGER.name, CLAN_DAGGER_DEXTERITY.name].includes(weapon.name)) ? c.level >= 11 ? 2 : 1 : 0
}

function carriedWeapons(c: Character, entries: ContentEntry[]): OwnedWeapon[] {
  return c.weapons ?? c.equipment
    .filter((g) => g.qty > 0 && weaponEntry(entries, g.name))
    .map((g) => ({ id: `eq-${g.name}`, name: g.name, potency: 0, striking: 0, runes: [] }))
}

export function animalStrengthWeapons(c: Character, entries: ContentEntry[]) {
  return carriedWeapons(c, entries).filter(weapon => weaponCategory(weaponEntry(entries, weapon.name)) !== 'Unarmed'
    && ![OVERSIZED_THROW.id, HAFT_STRIKER_WEAPON.id].includes(weapon.id))
}

function animalStrengthEnhancements(entries: ContentEntry[], weapon: OwnedWeapon, source: OwnedWeapon): OwnedWeapon {
  const enhanced = { ...weapon, potency: source.potency, striking: source.striking, runes: source.runes, material: undefined }
  return { ...enhanced, runes: enhanced.runes.filter(rune => weaponRuneApplies(entries, enhanced, rune)) }
}

export function animalStrengthRuneSources(c: Character, entries: ContentEntry[], target: OwnedWeapon) {
  const sources = new Map<string, { weapon: OwnedWeapon; ids: string[] }>()
  if (!activeFeatsNamed(c, 'Animal Strength').length) return []
  for (const weapon of animalStrengthWeapons(c, entries)) {
    const enhanced = animalStrengthEnhancements(entries, target, effectiveWeapon(c, entries, weapon))
    const key = JSON.stringify([enhanced.potency, enhanced.striking, enhanced.runes.map(rune => runeName(rune).toLowerCase()).sort()])
    const existing = sources.get(key)
    if (existing) existing.ids.push(weapon.id)
    else sources.set(key, { weapon, ids: [weapon.id] })
  }
  return [...sources.values()]
}

export function hasAnimalStrength(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  return !!activeFeatsNamed(c, 'Animal Strength').length
    && activeAnimalFeatures(c, entries).some(feature => ['Claws', 'Jaws'].includes(feature) && weapon.name === `${feature} (Animal Feature)`)
}

export function animalStrengthSource(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  return hasAnimalStrength(c, entries, weapon)
    ? animalStrengthWeapons(c, entries).find(source => source.id === c.animalStrengthWeapons?.[weapon.id]) : undefined
}

export function haftStrikerWeapons(c: Character, entries: ContentEntry[]) {
  if (c.level < 4 || !hasFeat(c, HAFT_STRIKER_WEAPON.name)) return []
  return carriedWeapons(c, entries).filter((weapon) => {
    const entry = weaponEntry(entries, weapon.name)
    return !weapon.attachedTo && !!entry && !isRanged(entry)
      && (/^(hammer|spear|polearm)$/i.test(String(entry.data.weapon_group)) || /\bstaff\b/i.test(entry.name))
      && weaponHands(entries, weapon, c) === 2 && weaponHeld(c, entries, weapon)
  })
}

export function haftStrikerSource(c: Character, entries: ContentEntry[]) {
  if (c.activeStance !== HAFT_STRIKER_WEAPON.name || activeStance(c, entries)?.name !== HAFT_STRIKER_WEAPON.name) return undefined
  const weapons = haftStrikerWeapons(c, entries)
  return weapons.find((weapon) => weapon.id === c.haftStrikerWeaponId) ?? weapons[0]
}

export function weaponCanUseTwoHands(entry: ContentEntry): boolean {
  return String(entry.data.hands).trim() === '1+'
    || String(entry.data.hands).trim() === '1 or 2'
    || String(entry.data.hands).trim() === '1'
      && [...entry.traits, ...tokens(entry.data.trait)].some(trait => /^two-hand\b/i.test(trait))
}

export function weaponHands(entries: ContentEntry[], weapon: OwnedWeapon, c?: Character): number | undefined {
  if (weapon.id === OVERSIZED_THROW.id) return 0
  const original = withNamedWeaponState(weaponEntry(entries, weapon.name), weapon)
  const entry = c ? weaponWithModifications(c, weapon, original) : original
  if (!entry) return undefined
  if (weaponCategory(entry) === 'Unarmed'
    || [...entry.traits, ...tokens(entry.data.trait)].some(trait => /^(?:unarmed|free[- ]hand)$/i.test(trait))) return 0
  if (weaponCanUseTwoHands(entry) && weapon.handsHeld === 2) return 2
  if (String(entry.data.hands).trim() === '1 or 2') return 1
  const match = /^([12])(?:\+)?$/.exec(String(entry.data.hands ?? '').trim())
  return match ? Number(match[1]) : undefined
}

export function hardpointWeaponEligible(c: Character, entries: ContentEntry[], weapon: OwnedWeapon): boolean {
  if (!activeFeatsNamed(c, 'Hardpoint').length || weapon.attachedTo) return false
  const entry = weaponEntry(entries, weapon.name)
  const bulk = entry?.data.bulk
  const maxBulk = activeFeatsNamed(c, 'Thresher Ko-1 Frame').length ? 1 : 0.1
  return !!entry && typeof bulk === 'number' && Number.isFinite(bulk) && bulk >= 0 && bulk <= maxBulk
    && weaponHands(entries, { ...weapon, handsHeld: 1 }, c) === 1
}

export function weaponHeld(c: Character, entries: ContentEntry[], weapon: OwnedWeapon): boolean {
  if (weapon.attachedTo) {
    const shield = shieldAttachmentSource(c, weapon)
    if (shield) return equippedShield(c)?.id === shield.id
    const source = ownedWeapons(c, entries).find(candidate => candidate.id === weapon.attachedTo && !candidate.attachedTo)
    return !!source && weaponHeld(c, entries, source)
  }
  if (weapon.name === HAFT_STRIKER_WEAPON.name) {
    const source = haftStrikerSource(c, entries)
    return !!source && weaponHeld(c, entries, source) && weaponHands(entries, source, c) === 2
  }
  const legacyPouch = weapon.id === `eq-${weapon.name}` && c.equipment.some(item =>
    item.name === weapon.name && (item.cheekQty ?? 0) >= item.qty)
  return weaponHands(entries, weapon, c) === 0 || !weapon.stowed && !weapon.cheekStored && !legacyPouch
}

export function totalArmHands(c: Character) {
  const additionalArms = activeFeatsNamed(c, 'Additional Arms').length
  return 2 * (1 + Number(testSubjectAdaptation(c) === 'Extra Limbs')
    + (getSettings().singleAdditionalArms ? Math.min(1, additionalArms) : additionalArms))
}

export const ringCapacity = (c: Character) => totalArmHands(c) * 5

function ownedItemBonus(c: Character, entries: ContentEntry[], bonuses: Record<string, number>) {
  return c.equipment.flatMap(item => {
    const entry = item.qty > 0 ? byName(entries, 'item', item.name) : undefined
    if (!entry || entry.deleted || !entry.systems.some(system => c.systems.includes(system))) return []
    const name = equipmentDisplayName(entry.name)
    const value = bonuses[name]
    return typeof value === 'number' ? [{ source: name, value }] : []
  }).sort((a, b) => b.value - a.value)[0]
}

function ownedGradedItemBonus(c: Character, entries: ContentEntry[], family: string, baseBonus = 1) {
  return ownedItemBonus(c, entries, { [family]: baseBonus, [`${family} (Greater)`]: baseBonus + 1, [`${family} (Major)`]: baseBonus + 2 })
}

export const voyagerPackBonus = (c: Character, entries: ContentEntry[]) => ownedItemBonus(c, entries, { "Voyager's Pack": 3 })
export const killerBeltBonus = (c: Character, entries: ContentEntry[]) => ownedGradedItemBonus(c, entries, "Killer's Belt")
export const wildwoodInkBonus = (c: Character, entries: ContentEntry[]) => ownedGradedItemBonus(c, entries, 'Wildwood Ink')
export const tradecraftTattooBonus = (c: Character, entries: ContentEntry[]) => ownedGradedItemBonus(c, entries, 'Tradecraft Tattoo', 2)
export const hunterArrowheadBonus = (c: Character, entries: ContentEntry[]) => ownedGradedItemBonus(c, entries, "Hunter's Arrowhead")

export function artifactItemSkillBonus(c: Character, entries: ContentEntry[], skill: string) {
  if (!['Arcana', 'Crafting', 'Diplomacy'].includes(skill)) return undefined
  const carried = carriedWeapons(c, entries).some(weapon => weaponEntry(entries, weapon.name)?.data.named_weapon_source === 'Azlanti Diamond')
    || c.equipment.some(item => item.qty > 0 && item.name === 'Azlanti Diamond')
  return carried ? { source: 'Azlanti Diamond', value: c.level >= 17 ? 3 : c.level >= 9 ? 2 : 1 } : undefined
}

export function ringCount(c: Character, entries: ContentEntry[]) {
  return c.equipment.reduce((count, item) =>
    count + (item.group === 'Rings' || equipmentGroupName(byName(entries, 'item', item.name), item.name) === 'Rings' ? item.qty : 0), 0)
}

export function totalHandCapacity(c: Character) {
  const arms = totalArmHands(c)
  const tail = activeFeatsNamed(c, 'Prehensile Tail').length > 0
  const limb = activeFeatsNamed(c, 'Prehensile Limbs').length > 0
  return arms + Number(tail) + Number(limb && !(tail && ancestryFeatTraits(c).includes('ysoki')))
}

export function weaponEquipped(c: Character, entries: ContentEntry[], weapon: OwnedWeapon): boolean {
  if (weapon.attachedTo) {
    const shield = shieldAttachmentSource(c, weapon)
    if (shield) return equippedShield(c)?.id === shield.id
    const source = ownedWeapons(c, entries).find(candidate => candidate.id === weapon.attachedTo && !candidate.attachedTo)
    return !!source && weaponEquipped(c, entries, source)
  }
  if (weapon.name === HAFT_STRIKER_WEAPON.name) {
    const source = haftStrikerSource(c, entries)
    return !!source && weaponEquipped(c, entries, source) && weaponHands(entries, source, c) === 2
  }
  return weaponHeld(c, entries, weapon)
}

export function equippedWeaponHands(c: Character, entries: ContentEntry[]): number {
  return ownedWeapons(c, entries).reduce((total, weapon) => {
    if (weapon.attachedTo || weapon.name === HAFT_STRIKER_WEAPON.name
      || !weaponEquipped(c, entries, weapon)) return total
    return total + (weaponHands(entries, weapon, c) ?? 0)
  }, 0)
}
export function equippedHands(c: Character, entries: ContentEntry[]): number {
  const shield = equippedShield(c)
  return equippedWeaponHands(c, entries) + Number(!!shield && !isBucklerShield(shield.name))
}
export function canEquipShield(c: Character, entries: ContentEntry[], shield: OwnedShield): boolean {
  return equippedWeaponHands(c, entries) + Number(!isBucklerShield(shield.name)) <= totalHandCapacity(c)
    && !ownedWeapons(c, entries).some(weapon => !weapon.attachedTo && weapon.name !== HAFT_STRIKER_WEAPON.name
      && weaponEquipped(c, entries, weapon) && weaponHands(entries, weapon, c) === undefined)
}

const canOversizedThrow = (c: Character) => c.level >= 4 && activeFeatsNamed(c, 'Oversized Throw').length > 0

export const hasDeityWeaponGrant = (c: Character) => !!c.deity && (['Champion', 'Cleric'].includes(c.className ?? '')
  || c.className === 'Ranger' && activeFeatsNamed(c, 'Vindicator Dedication').length > 0)

export function deityWeapon(c: Character, entries: ContentEntry[]) {
  if (!hasDeityWeaponGrant(c)) return undefined
  const carried = carriedWeapons(c, entries)
  const gauntlet = armorGauntlet(c, entries)
  const previous = carried.find((weapon) => weapon.id.startsWith('deity-weapon:') && isFavoredWeapon(c, entries, weapon.name))
  const entry = (previous ? weaponEntry(entries, previous.name) : undefined)
    ?? carried.map((weapon) => weaponEntry(entries, weapon.name)).find((entry) => entry && isFavoredWeapon(c, entries, entry.name))
    ?? (gauntlet && isFavoredWeapon(c, entries, gauntlet.name) ? weaponEntry(entries, gauntlet.name) : undefined)
    ?? SUPPLEMENTAL_WEAPONS.find(entry => isAutomaticUnarmed(entry.name) && isFavoredWeapon(c, entries, entry.name))
  if (!entry) return undefined
  const id = gauntlet?.name === entry.name ? GAUNTLET.id : `deity-weapon:${entry.id}`
  const saved = carried.find((weapon) => weapon.id === id)
    ?? carried.find((weapon) => weapon.name === entry.name && !weapon.id.startsWith('deity-weapon:'))
  return { entry, id: saved?.id ?? id }
}

export function ownedWeapons(c: Character, entries: ContentEntry[]): OwnedWeapon[] {
  const weapons = [...carriedWeapons(c, entries)]
  for (const grant of dwarfClanWeaponGrants(c, entries)) {
    const index = weapons.findIndex(weapon => weapon.id === grant.id || weapon.name === grant.name)
    if (index >= 0) {
      const saved = weapons[index]
      weapons[index] = { ...saved, ...grant, potency: saved.potency, striking: saved.striking, runes: saved.runes, stowed: saved.stowed,
        ...(saved.capacityLoaded !== undefined ? { capacityLoaded: saved.capacityLoaded } : {}) }
    } else weapons.push(grant)
  }
  const ironFists = c.feats.some((feat) => /^Iron Fists?$/i.test(feat.name))
  const tusks = c.feats.some((feat) => /^Tusks(?: \(Orc\))?$/i.test(feat.name))
  const haftStriker = !!haftStrikerSource(c, entries)
  const oversizedThrow = canOversizedThrow(c)
  const gauntlet = armorGauntlet(c, entries)
  const favored = deityWeapon(c, entries)
  const features = activeAnimalFeatures(c, entries)
  const animalAttacks = [ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS]
  const selectedAttacks = animalAttacks.filter((attack) => features.some((feature) => attack.name === `${feature} (Animal Feature)`))
  const shift = activeUntamedShiftEffects(c, entries)
  const untamedAttacks = [UNTAMED_CLAWS, UNTAMED_JAWS].filter(attack => shift.includes(attack === UNTAMED_CLAWS ? 'Claws' : 'Jaws'))
  const cairnAttacks = cairnForm(c, entries) ? [CAIRN_FIST] : []
  const sparkAttacks = activeFeatsNamed(c, 'Spark Fist').length ? [SPARK_FIST] : []
  const iruxiChoice = activeFeatsNamed(c, 'Iruxi Armaments')[0]?.choice
  const iruxiAttacks = iruxiChoice === 'Claws' ? [IRUXI_CLAWS]
    : iruxiChoice === 'Fangs' ? [IRUXI_FANGS] : iruxiChoice === 'Tail' ? [IRUXI_TAIL] : []
  const cards = activeFeatsNamed(c, "Fane's Fourberie").length && c.activeStance === "Fane's Fourberie"
    ? PLAYING_CARD_WEAPONS.filter(card => !!byName(entries, 'weapon', card.base)) : []
  const available = weapons.filter((weapon) =>
    (weapon.name !== IRON_FIST.name || ironFists) && (weapon.name !== ORC_TUSKS.name || tusks)
    && (weapon.name !== CAIRN_FIST.name || cairnAttacks.length > 0)
    && (weapon.name !== SPARK_FIST.name || sparkAttacks.length > 0)
    && (weapon.name !== HAFT_STRIKER_WEAPON.name || haftStriker)
    && (weapon.id !== OVERSIZED_THROW.id || oversizedThrow)
    && (weapon.id !== GAUNTLET.id || !!gauntlet)
    && (!PLAYING_CARD_WEAPONS.some(card => card.id === weapon.id) || cards.some(card => card.id === weapon.id))
    && (![...animalAttacks, UNTAMED_CLAWS, UNTAMED_JAWS].some((entry) => entry.name === weapon.name)
      || [...selectedAttacks, ...untamedAttacks].some((entry) => entry.name === weapon.name)))
    .map((weapon) => weapon.id === GAUNTLET.id && gauntlet && weapon.name !== gauntlet.name ? { ...weapon, name: gauntlet.name } : weapon)
  for (const entry of [...(ironFists ? [IRON_FIST] : []), ...(tusks ? [ORC_TUSKS] : []), ...iruxiAttacks,
    ...(haftStriker ? [HAFT_STRIKER_WEAPON] : []), ...(oversizedThrow ? [OVERSIZED_THROW] : []),
    ...selectedAttacks, ...untamedAttacks, ...cairnAttacks, ...sparkAttacks, ...(gauntlet ? [{ id: GAUNTLET.id, name: gauntlet.name }] : [])]) {
    if (!available.some((weapon) => weapon.name === entry.name)) {
      available.push({ id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] })
    }
  }
  for (const card of cards) if (!available.some(weapon => weapon.id === card.id)) {
    available.push({ id: card.id, name: card.name, potency: 0, striking: 0, runes: [] })
  }
  if (favored && weaponCategory(favored.entry) === 'Unarmed' && !available.some((weapon) => weapon.id === favored.id)) {
    available.push({ id: favored.id, name: favored.entry.name, potency: 0, striking: 0, runes: [] })
  }
  for (const source of [...available]) {
    if (source.attachedWeapon && canAttachWeapon(entries, source)) {
      available.push({ id: `attached:${source.id}`, name: source.attachedWeapon, attachedTo: source.id,
        potency: 0, striking: 0, runes: [] })
    }
  }
  for (const shield of ownedShields(c)) {
    const attachedWeapon = shieldAttachedWeapon(shield)
    if (shield) available.push({ ...(attachedWeapon ?? {
      id: `shield-bash:${shield.id}`, name: SHIELD_BASH.name, potency: 0, striking: 0, runes: [],
    }), attachedTo: shield.id })
  }
  if (available.some((weapon) => /\bgauntlets?\b/i.test(weapon.name))) {
    return available.filter((weapon) => weapon.id === favored?.id || weapon.name !== FIST.name && weapon.name !== IRON_FIST.name)
  }
  const hasOtherUnarmed = available.some((weapon) => weapon.name !== FIST.name && weapon.name !== SPARK_FIST.name
    && weaponCategory(weaponEntry(entries, weapon.name)) === 'Unarmed')
  if (hasOtherUnarmed) return available.filter((weapon) => weapon.id === favored?.id || weapon.name !== FIST.name)
  if (!available.some((weapon) => weapon.name === FIST.name)) {
    available.push({ id: FIST.id, name: FIST.name, potency: 0, striking: 0, runes: [] })
  }
  return available
}

export function knowsSpell(c: Character, entries: ContentEntry[], name: string) {
  return !!(c.spells?.some((spell) => spell.name === name)
    || c.feats.some(feat => featTakenLevel(feat) <= c.level && hasWardenChoice(feat) && feat.choice === name)
    || grantedFeatSpells(c, entries).some(grant => grant.entry.name === name)
    || minorMagicSpells(c, entries).some(spell => spell.name === name)
    || focusSpells(c, entries).spells.some((spell) => spell.name === name))
}

export const isSpellActive = (c: Character, entries: ContentEntry[], name: string) =>
  !!c.activeSpells?.includes(name) && knowsSpell(c, entries, name)

export function untamedFormRanks(c: Character) {
  const maximum = Math.ceil(c.level / 2)
  return [...new Set([maximum, ...(activeFeatsNamed(c, 'Form Control').length ? [Math.max(1, maximum - 2)] : [])])]
}

export function untamedFormOptions(c: Character) {
  const ranks = untamedFormRanks(c)
  const castRank = c.untamedForm?.rank && ranks.includes(c.untamedForm.rank) ? c.untamedForm.rank : ranks[0]
  const has = (name: string) => activeFeatsNamed(c, name).length > 0
  const choices: Array<{ name: string; rank: number; available: boolean; duration?: NonNullable<Character['untamedForm']>['originalDuration'] }> = [
    { name: 'Pest Form', rank: 1, available: true, duration: '10 minutes' },
    { name: 'Pest Form (Non-flying Insect)', rank: 1, available: has('Insect Shape'), duration: '24 hours' },
    { name: 'Animal Form', rank: 2, available: true },
    { name: 'Humanoid Form', rank: 2, available: has('Anthropomorphic Shape') },
    { name: 'Insect Form', rank: 3, available: has('Insect Shape') },
    { name: 'Dinosaur Form', rank: 4, available: has('Ferocious Shape') },
    { name: 'Aerial Form (Bat or Bird)', rank: 4, available: has('Soaring Shape') },
    { name: 'Aerial Form (Wasp)', rank: 4, available: has('Soaring Shape') && has('Insect Shape') },
    { name: 'Aerial Form (Pterosaur)', rank: 4, available: has('Soaring Shape') && has('Ferocious Shape') },
    { name: 'Elemental Form', rank: 5, available: has('Elemental Shape') },
    { name: 'Plant Form', rank: 5, available: has('Plant Shape') },
    { name: 'Dragon Form', rank: 6, available: has('Dragon Shape') },
    { name: 'Monstrosity Form (Cave Worm or Sea Serpent)', rank: 8, available: has('Monstrosity Shape') },
    { name: 'Monstrosity Form (Phoenix)', rank: 8, available: has('Monstrosity Shape') && has('Soaring Shape') },
  ]
  return choices.filter(choice => choice.available && choice.rank <= castRank)
    .map(choice => ({ name: choice.name, duration: castRank < ranks[0]
      ? has('Perfect Form Control') ? 'unlimited' : choice.duration === '24 hours' ? '24 hours' : '1 hour'
      : choice.duration ?? '1 minute' }))
}

export function canChangeUntamedForm(c: Character, entries: ContentEntry[]) {
  return !!activeFeatsNamed(c, 'As Mutable as Nature').length
    && isSpellActive(c, entries, 'Untamed Form') && c.untamedForm?.originalDuration === '1 minute'
}

export function magicHideTarget(c: Character) {
  return companionSpellTarget(c, c.magicHideCompanionId)
}

export function companionSpellTarget(c: Character, savedId?: string) {
  return c.companions?.find((companion) => companion.id === savedId)?.id ?? c.companions?.[0]?.id
}

export function spellActiveChange(c: Character, name: string, active: boolean): Pick<Character, 'activeSpells'> {
  return { activeSpells: [...(c.activeSpells ?? []).filter((spell) => spell !== name), ...(active ? [name] : [])] }
}

export function canopyCrawlerTarget(c: Character) {
  return c.level >= 9 && !!c.companions?.length ? 'Both' : 'Self'
}

export function canopyCrawlerAffects(c: Character, entries: ContentEntry[], companionId?: string) {
  if (c.level < 3 || !isSpellActive(c, entries, 'Canopy Crawler')) return false
  const target = canopyCrawlerTarget(c)
  return companionId === undefined || target === 'Both' && companionId === companionSpellTarget(c, c.canopyCrawlerCompanionId)
}

export function enlargeCompanionSize(c: Character, naturalSize?: string) {
  return c.level >= 7 && (naturalSize === 'Large' || c.enlargeCompanionSize !== 'Large') ? 'Huge' : 'Large'
}

export function isMagicHideActive(c: Character, entries: ContentEntry[], companionId?: string) {
  return isSpellActive(c, entries, 'Magic Hide') && (companionId === undefined || companionId === magicHideTarget(c))
}

export function magicHideChange(c: Character, active: boolean, companionId = magicHideTarget(c)): Partial<Character> {
  return {
    magicHideCompanionId: companionId,
    ...spellActiveChange(c, 'Magic Hide', active),
  }
}

export function activeAnimalFeatures(c: Character, entries: ContentEntry[]) {
  if (!isSpellActive(c, entries, 'Animal Feature')) return []
  const selected = hasFeat(c, 'Persistent Animal Feature')
    ? c.animalFeatures ?? [c.animalFeature ?? 'Claws']
    : [c.animalFeature ?? c.animalFeatures?.[0] ?? 'Claws']
  return ANIMAL_FEATURES.filter((feature) => selected.includes(feature.name) && feature.rank <= Math.ceil(c.level / 2)
    && (feature.name !== 'Wings' || !getSettings().championFormNoFlight))
    .map((feature) => feature.name)
}

const UNTAMED_SHIFT_CHOICES = [
  { name: 'Claws', feat: 'Untamed Form' }, { name: 'Jaws', feat: 'Insect Shape' },
  { name: 'Elemental', feat: 'Elemental Shape' }, { name: 'Plant', feat: 'Plant Shape' }, { name: 'Wings', feat: 'Soaring Shape' },
] as const
export function untamedShiftChoices() {
  return getSettings().championFormNoFlight
    ? UNTAMED_SHIFT_CHOICES.filter(choice => choice.name !== 'Wings')
    : UNTAMED_SHIFT_CHOICES
}

export function activeUntamedShiftEffects(c: Character, entries: ContentEntry[]) {
  if (!isSpellActive(c, entries, 'Untamed Shift')) return []
  const max = c.level >= 19 ? 3 : c.level >= 11 ? 2 : 1
  const available = untamedShiftChoices().filter(choice => activeFeatsNamed(c, choice.feat).length).map(choice => choice.name)
  return [...new Set(c.untamedShiftEffects ?? [])].filter(choice => available.includes(choice)).slice(0, max)
}

export const isAutomaticUnarmed = (name: string) => [FIST.name, IRON_FIST.name, CAIRN_FIST.name, SPARK_FIST.name, ORC_TUSKS.name, ANIMAL_FEATURE_CLAWS.name, ANIMAL_FEATURE_JAWS.name, UNTAMED_CLAWS.name, UNTAMED_JAWS.name].includes(name)
export const PLAYING_CARD_WEAPONS = [
  { id: 'playing-card:dagger', name: 'Dagger (Playing Card)', base: 'Dagger' },
  { id: 'playing-card:dart', name: 'Dart (Playing Card)', base: 'Dart' },
] as const
export function canAttachWeapon(entries: ContentEntry[], weapon: OwnedWeapon) {
  const entry = weaponEntry(entries, weapon.name)
  return !!entry && /^(firearm|crossbow)$/i.test(String(entry.data.weapon_group ?? ''))
}
export const SHIELD_ATTACHED_WEAPONS = ['Shield Boss', 'Shield Pistol', 'Shield Spikes'] as const
export function shieldAttachmentOptions(shield: Pick<OwnedShield, 'name'>) {
  return SHIELD_ATTACHED_WEAPONS.filter(name => shield.name !== 'Scale of Igroon' || name !== 'Shield Pistol')
}
function shieldAttachedWeapon(shield: OwnedShield) {
  const weapon = shield.attachedWeapon
  return shield.name === 'Scale of Igroon' && weapon && !shieldAttachmentOptions(shield).some(name => name === weapon.name)
    ? undefined : weapon
}
export function shieldAttachmentSource(c: Character, weapon: OwnedWeapon) {
  return ownedShields(c).find(shield => {
    const attached = shieldAttachedWeapon(shield)
    return shield.id === weapon.attachedTo && (attached?.id === weapon.id
      || !attached && weapon.id === `shield-bash:${shield.id}` && weapon.name === SHIELD_BASH.name)
  })
}
export const isLockedWeapon = (c: Character, name: string, entries: ContentEntry[] = [], id?: string) => isAutomaticUnarmed(name)
  || PLAYING_CARD_WEAPONS.some(card => card.name === name && activeFeatsNamed(c, "Fane's Fourberie").length > 0)
  || name === HAFT_STRIKER_WEAPON.name && !!haftStrikerSource(c, entries)
  || name === OVERSIZED_THROW.name && canOversizedThrow(c)
  || ARMOR_GAUNTLETS.some((option) => option === name) && name === armorGauntlet(c, entries)?.name
  || dwarfClanWeaponGrants(c, entries).some(weapon => weapon.name === name && (!id || weapon.id === id))
export function weaponEntry(entries: ContentEntry[], name: string) {
  let entry = resolveWeaponEntry(entries, name)
  if (entry?.source === 'homebrew' && entry.data.url && (entry.traits.some(trait => /^(?:two-hand|deadly|fatal(?: aim)?)$/i.test(trait.trim()))
    || !entry.weaponModes && entry.traits.some(trait => /^modular\b/i.test(trait)))) {
    const source = entries.find(candidate => candidate.kind === 'weapon' && candidate.source === 'official'
      && !candidate.deleted && candidate.data.url === entry?.data.url)
    if (source) entry = { ...entry,
      ...(!entry.weaponModes && entry.traits.some(trait => /^modular\b/i.test(trait)) && source.weaponModes ? { weaponModes: source.weaponModes } : {}),
      traits: entry.traits.map(trait => {
        const parameter = /^(two-hand|deadly|fatal(?: aim)?)$/i.exec(trait.trim())?.[1]
        return parameter ? source.traits.find(value => new RegExp(`^${parameter}\\s+(?:1)?d(?:4|6|8|10|12)$`, 'i').test(value.trim())) ?? trait : trait
      }) }
  }
  if (entry?.source === 'official' && entry.name === 'Reinforced Stock'
    && !entry.traits.some(trait => /^two-hand\s+d\d+$/i.test(trait.trim()))) {
    entry = { ...entry, traits: [...entry.traits.filter(trait => !/^two-hand$/i.test(trait.trim())), 'Two-Hand d8'] }
  }
  if (!entry || !entry.traits.some(trait => /^versatile$/i.test(trait.trim()))
    || entry.traits.some(trait => /^versatile\s+/i.test(trait.trim()))) return entry
  const primary = /(?:^|\s)(bludgeoning|piercing|slashing|[bps])$/i.exec(String(entry.data.damage ?? '').trim())?.[1]?.[0].toUpperCase()
  const types = String(entry.data.damage_type ?? '').split(',').map(type => type.trim().toLowerCase())
    .filter(type => /^(bludgeoning|piercing|slashing|b|p|s)$/.test(type)).map(type => type[0].toUpperCase())
  const alternate = [...new Set(types.filter(type => type !== primary))]
  if (!primary || !alternate.length) return entry
  return { ...entry, traits: entry.traits.map(trait => /^versatile$/i.test(trait.trim()) ? `Versatile ${alternate.join(', ')}` : trait) }
}

function resolveWeaponEntry(entries: ContentEntry[], name: string) {
  const hammerMultipistol = name.startsWith('Hammer Multipistol')
    ? hammerMultipistolEntries(entries).find(entry => entry.name === name) : undefined
  if (hammerMultipistol) return hammerMultipistol
  const shobhad = /^Shobhad Longrifle \((Pathfinder|Starfinder)\)$/.exec(name)
  if (shobhad) {
    const system = shobhad[1] === 'Starfinder' ? 'sf2e' : 'pf2e'
    const variant = entries.find(entry => entry.kind === 'weapon' && !entry.deleted && entry.source === 'official' && entry.name === 'Shobhad Longrifle'
      && entry.systems.includes(system))
    return variant ? { ...variant, name } : undefined
  }
  const card = PLAYING_CARD_WEAPONS.find(option => option.name === name)
  const base = card && byName(entries, 'weapon', card.base)
  if (card && base) return { ...base, id: card.id, name: card.name }
  return SUPPLEMENTAL_WEAPONS.find(entry => entry.name === name && (isAutomaticUnarmed(name) || name === HAFT_STRIKER_WEAPON.name))
    ?? byName(entries, 'weapon', name) ?? namedWeaponEntries(entries).find(entry => entry.name === name)
    ?? SUPPLEMENTAL_WEAPONS.find(entry => entry.name === name)
    ?? [...ATTACHED_WEAPONS, SHIELD_BASH].find(entry => entry.name === name)
}

const namedWeaponCache = new WeakMap<ContentEntry[], ContentEntry[]>()
function namedWeaponEntries(entries: ContentEntry[]) {
  let weapons = namedWeaponCache.get(entries)
  if (!weapons) {
    weapons = makeNamedWeaponEntries(entries, propertyRunes(entries, 'Weapon'))
    namedWeaponCache.set(entries, weapons)
  }
  return weapons
}

function hammerMultipistolEntries(entries: ContentEntry[]) {
  const originals = entries.filter(entry => entry.kind === 'weapon' && !entry.deleted
    && /^Mace Multipistol \((?:Melee|Ranged)\)$/.test(entry.name))
  if (!originals.some(entry => entry.name.endsWith('(Melee)')) || !originals.some(entry => entry.name.endsWith('(Ranged)'))) return []
  return originals.map(entry => ({
    ...entry,
    id: `homebrew:hammer-multipistol-${entry.name.endsWith('(Melee)') ? 'melee' : 'ranged'}`,
    source: 'homebrew' as const,
    name: entry.name.replace(/^Mace Multipistol/, 'Hammer Multipistol'),
    description: 'A reinforced hammer head is built into this multipistol, letting its wielder switch between crushing melee blows and close-range gunfire.',
    data: { ...entry.data },
  }))
}
export function armorDisplayName(armor: Pick<OwnedArmor, 'name' | 'material'>) {
  if (isNamedArmor(armor.name)) return armor.name
  const material = armor.material?.replace(/\s+\([^)]*\)$/, '')
  if (!material || armor.name.toLowerCase().startsWith(material.toLowerCase())) return armor.name
  const base = material === 'Grisantian Hide' ? armor.name.replace(/^Hide(?:\s+|$)/i, '')
    : material === 'Duskwood' ? armor.name.replace(/^(?:Wood|Wooden)(?:\s+|$)/i, '') : armor.name
  return `${material} ${base}`.trim()
}

export function armorEntry(c: Character, entries: ContentEntry[], name: string) {
  return characterArmorGrants(c, entries).find(entry => entry.name === name)
    ?? byName(entries, 'armor', name)
    ?? namedArmorEntries(entries).find(entry => entry.name === name)
}

function characterArmorGrants(c: Character, entries: ContentEntry[]) {
  const grants = grantedArmorEntries(c, selectedSubclass(c, entries))
  if (activeFeatsNamed(c, 'Ardent Armiger').length) {
    const armor = armigerArmorEntry(c, armorRanks(c, entries))
    if (armor) grants.push(armor)
  }
  return grants
}

const namedArmorCache = new WeakMap<ContentEntry[], ContentEntry[]>()
function namedArmorEntries(entries: ContentEntry[]) {
  let armors = namedArmorCache.get(entries)
  if (!armors) {
    armors = makeNamedArmorEntries(entries, propertyRunes(entries, 'Armor'))
    namedArmorCache.set(entries, armors)
  }
  return armors
}

export function shieldEntry(entries: ContentEntry[], name: string) {
  return byName(entries, 'shield', name) ?? makeNamedShieldEntry(entries, name)
}

export function ownedArmors(c: Character, entries: ContentEntry[]): OwnedArmor[] {
  const grants = characterArmorGrants(c, entries)
  const attached = grants.find(entry => entry.data.attached)
  const best = c.armors ? undefined : c.equipment
    .map((g) => armorEntry(c, entries, g.name))
    .filter((e): e is ContentEntry => !!e)
    .sort((a, b) => num(b.data.ac) + (namedArmorEnhancements(b)?.potency ?? 0)
      - num(a.data.ac) - (namedArmorEnhancements(a)?.potency ?? 0))[0]
  const saved = c.armors ?? c.equipment.filter((g) => armorEntry(c, entries, g.name))
    .map((g) => ({ id: `eq-${g.name}`, name: g.name, potency: 0, resilient: 0, runes: [], worn: g.name === best?.name }))
  const ordinary = saved.filter(armor => !isGrantedArmor(armor.id))
    .map(armor => effectiveArmor(c, entries, canWearWithAttachedArmor(armor, attached) ? armor : { ...armor, worn: false }))
  const generated = grants.map(entry => {
    const existing = saved.find(armor => armor.id === entry.id)
    return effectiveArmor(c, entries, {
      potency: 0, resilient: 0, runes: [], ...existing, id: entry.id, name: entry.name,
      worn: entry.data.attached ? true : attached ? false : existing?.worn ?? !ordinary.some(armor => armor.worn),
    })
  })
  return [...generated, ...ordinary]
}

export function isWoodArmor(entries: ContentEntry[], armor: OwnedArmor) {
  return tokens(byName(entries, 'armor', armor.name)?.data.armor_group).some((group) => group.toLowerCase() === 'wood')
}

function scaledMaterial(material: OwnedArmor['material'], level: number, equipment: 'Armor'): OwnedArmor['material']
function scaledMaterial(material: OwnedWeapon['material'], level: number, equipment: 'Weapon'): OwnedWeapon['material']
function scaledMaterial(material: OwnedWeapon['material'], level: number, equipment: 'Armor' | 'Weapon'): OwnedWeapon['material'] {
  const base = material?.replace(/\s*\([^)]+\)$/, '')
  if (base === 'Duskwood') return level >= (equipment === 'Armor' ? 19 : 17) ? 'Duskwood (High-Grade)' : 'Duskwood (Standard-Grade)'
  if (base === 'Grisantian Hide') return level >= 19 ? 'Grisantian Hide (High-Grade)' : 'Grisantian Hide (Standard-Grade)'
  if (base === 'Peachwood') return level >= 18 ? 'Peachwood (High-Grade)' : 'Peachwood (Standard-Grade)'
  if (base === 'Cold Iron') return level >= 16 ? 'Cold Iron (High-Grade)' : level >= 10 ? 'Cold Iron (Standard-Grade)' : 'Cold Iron (Low-Grade)'
  return material
}

export function effectiveArmor(c: Character, entries: ContentEntry[], armor: OwnedArmor): OwnedArmor {
  const grant = characterArmorGrants(c, entries).find(entry => entry.id === armor.id)
  if (grant) {
    const automatic = automaticArmorFundamentals(c.level, grant)
    const runesAllowed = grant.data.runes_allowed !== false
    const fundamentalsAllowed = runesAllowed && !grant.systems.includes('sf2e')
    return { ...armor, name: grant.name, material: grant.data.fixed_material === 'Duskwood'
      ? scaledMaterial('Duskwood', c.level, 'Armor') : grant.data.fixed_material === 'Orichalcum' ? 'Orichalcum' : grant.data.attached ? undefined
      : scaledMaterial(armor.material, c.level, 'Armor'),
      potency: fundamentalsAllowed ? Math.max(armor.potency, automatic.potency) : 0,
      resilient: fundamentalsAllowed ? Math.max(armor.resilient, automatic.resilient) : 0,
      runes: runesAllowed ? armor.runes : [] }
  }
  const material = scaledMaterial(isWoodArmor(entries, armor) ? 'Duskwood' : armor.material, c.level, 'Armor')
  const named = namedArmorEnhancements(armorEntry(c, entries, armor.name))
  if (named) return { ...armor, material, potency: Math.max(armor.potency, named.potency),
    resilient: Math.max(armor.resilient, named.resilient), runes: [...new Set([...named.runes, ...armor.runes])] }
  return material === armor.material ? armor : { ...armor, material }
}

export function armorGauntlet(c: Character, entries: ContentEntry[]) {
  const armor = ownedArmors(c, entries).find((armor) => armor.worn)
  if (armor?.id === INVENTOR_ARMOR_ID && getSettings().inventorArmorGauntlets) return { armor, name: 'Bladed Gauntlet', locked: true }
  return armor && ['Full Plate', 'Half Plate', 'Hellknight Plate', 'Splint Mail', 'Power Suit'].includes(armor.name)
    ? { armor, name: armor.gauntlet ?? GAUNTLET.name, locked: false } : undefined
}

// ---------- Weapons ----------

export const STRIKING_LABEL = ['', 'Striking', 'Greater Striking', 'Major Striking', 'Mythic Striking']
export const WEAPON_PROPERTY_RUNES = [
  'Ancestral Echoing', 'Anarchic', 'Axiomatic', 'Bane', 'Corrosive', 'Disarming', 'Disrupting', 'Flaming', 'Frost', 'Ghost Touch',
  'Grappling', 'Grievous', 'Holy', 'Hopeful', 'Impactful', 'Parrying', 'Quickstrike', 'Returning', 'Shifting', 'Shock', 'Speed', 'Thundering',
  'Unholy', 'Vorpal', 'Wounding',
]
export const ARMOR_PROPERTY_RUNES = [
  'Acid Resistant', 'Cold Resistant', 'Electricity Resistant', 'Fire Resistant', 'Fortification', 'Glamered',
  'Invisibility', 'Magnetic', 'Malleable', 'Ready', 'Shadow', 'Sinister Knight', 'Slick', 'Winged',
]
const ENERGY_TYPES = ['Acid', 'Cold', 'Electricity', 'Fire']
// Property runes come from the synced AoN content (all grades); the built-in lists are the fallback until it has loaded.
// Energy-Resistant needs a damage type chosen when crafted, so each type gets its own option.
// AoN names graded runes "Greater Moonweave"; show them as "Moonweave (Greater)"
export const runeName = (name: string) => name.replace(/^(Lesser|Greater|Major|True)\s+(.+)$/, '$2 ($1)')
const runeContentCache = new WeakMap<ContentEntry[], {
  items: Map<string, ContentEntry>; weapons: Map<string, ContentEntry>
}>()
function runeContent(entries: ContentEntry[], name: string, kind?: 'Weapon') {
  let index = runeContentCache.get(entries)
  if (!index) {
    index = { items: new Map(), weapons: new Map() }
    for (const entry of entries) {
      if (entry.kind !== 'item') continue
      const name = runeName(entry.name)
      if (!index.items.has(name)) index.items.set(name, entry)
      if (entry.data.item_subcategory === 'Weapon Property Runes' && !index.weapons.has(name)) index.weapons.set(name, entry)
    }
    runeContentCache.set(entries, index)
  }
  return (kind === 'Weapon' ? index.weapons : index.items).get(runeName(name))
}
const GRADE_ORDER = ['', 'Lesser', 'Greater', 'Major', 'True']
const runeSort = (a: string, b: string) => {
  const grade = (n: string) => GRADE_ORDER.indexOf(/ \((\w+)\)(?=$|:)/.exec(n)?.[1] ?? '')
  return a.replace(/ \(\w+\)/, '').localeCompare(b.replace(/ \(\w+\)/, '')) || grade(a) - grade(b)
}
export function propertyRunes(entries: ContentEntry[], kind: 'Armor' | 'Weapon') {
  const names = new Map<string, number>()
  for (const entry of entries.filter((e) => e.kind === 'item' && e.data.item_subcategory === `${kind} Property Runes`)) {
    const name = runeName(entry.name)
    if (!names.has(name) || entry.level < names.get(name)!) names.set(name, entry.level)
  }
  if (!names.size) return (kind === 'Armor' ? ARMOR_PROPERTY_RUNES : WEAPON_PROPERTY_RUNES).map((name) => ({ name }))
  return [...names].flatMap(([name, level]) => {
    const m = /^Energy-Resistant( \(Greater\))?$/.exec(name)
    return (m ? ENERGY_TYPES.map((type) => `Energy-Resistant${m[1] ?? ''}: ${type}`) : [name])
      .map((option) => ({ name: option, level }))
  }).sort((a, b) => runeSort(a.name, b.name))
}

const FALLBACK_RUNE_USAGE: Record<string, string> = {
  Disarming: 'etched onto a melee weapon',
  Parrying: 'etched onto a melee weapon',
  Grappling: 'etched onto a melee weapon',
  Wounding: 'etched onto a piercing or slashing melee weapon',
  Returning: 'etched onto a thrown weapon',
  Shifting: 'etched onto a melee weapon',
  Vorpal: 'etched onto a slashing melee weapon',
  Speed: 'etched onto a melee weapon',
  Disrupting: 'etched onto a melee weapon',
  Holy: "etched onto a weapon that isn't unholy",
  Unholy: "etched into a weapon that isn't holy",
}

export const runeBaseName = (name: string) => runeName(name).replace(/ \((Lesser|Greater|Major|True)\)$/, '')

export function weaponRuneApplies(entries: ContentEntry[], weapon: OwnedWeapon, rune: string) {
  const entry = weaponEntry(entries, weapon.name)
  const traits = (entry?.traits ?? []).map((trait) => trait.toLowerCase())
  const damage = `${weaponDamage(entry)} ${entry?.data.damage_type ?? ''} ${traits.filter((trait) => /^(versatile|modular)\b/.test(trait)).join(' ')}`.toLowerCase()
  const name = runeBaseName(rune)
  const content = runeContent(entries, rune, 'Weapon')
  const usage = String(content?.data.usage ?? FALLBACK_RUNE_USAGE[name] ?? 'etched onto a weapon').toLowerCase().replace(/\s+/g, ' ')
  if (name === 'Shifting' && weaponCategory(entry) === 'Unarmed') return false
  if (/\bmelee\b/.test(usage) && (!entry || isRanged(entry))) return false
  if (/\branged\b/.test(usage) && !isRanged(entry)) return false
  if (/\bthrown\b/.test(usage) && !traits.some((trait) => /^thrown\b/.test(trait))) return false
  const damageTypes = [...usage.matchAll(/\b(bludgeoning|piercing|slashing)\b/g)].map((match) => match[1])
  if (damageTypes.length && !damageTypes.some((type) =>
    new RegExp(`\\b(?:${type}|${type[0]})\\b`, 'i').test(damage))) return false
  if (/parry trait/.test(usage) && !traits.includes('parry')) return false
  if (/monk trait/.test(usage) && !traits.includes('monk')) return false
  if (/clan dagger/.test(usage) && entry?.name.toLowerCase() !== 'clan dagger') return false
  if (/isn't (unholy|holy)/.test(usage)) {
    const forbidden = /isn't (unholy|holy)/.exec(usage)![1]
    if (traits.includes(forbidden) || weapon.runes.some((existing) => runeBaseName(existing).toLowerCase() === forbidden)) return false
  }
  if (/without a disrupting rune/.test(usage) && weapon.runes.some((existing) => runeBaseName(existing) === 'Disrupting')) return false
  if (weapon.runes.some((existing) => {
    const existingEntry = runeContent(entries, existing)
    return String(existingEntry?.data.usage).toLowerCase().replace(/\s+/g, ' ').includes(`without a ${name.toLowerCase()} rune`)
  })) return false
  return true
}

export function eligibleWeaponRunes(entries: ContentEntry[], weapon: OwnedWeapon) {
  const forms = [...combinationForms(entries, weapon.name)]
  if (PLAYING_CARD_WEAPONS.some(card => card.id === weapon.id)) {
    forms.push(...PLAYING_CARD_WEAPONS.flatMap(card => {
      const entry = weaponEntry(entries, card.name)
      return entry ? [entry] : []
    }))
  }
  return propertyRunes(entries, 'Weapon').filter((rune) =>
    !weapon.runes.some((existing) => runeBaseName(existing) === runeBaseName(rune.name))
    && (weaponRuneApplies(entries, weapon, rune.name)
      || forms.some(form => weaponRuneApplies(entries, { ...weapon, name: form.name }, rune.name))))
}

export function handwrapRuneOptions(c: Character, entries: ContentEntry[]) {
  const unarmed = [
    ...SUPPLEMENTAL_WEAPONS.filter((entry) => weaponCategory(entry) === 'Unarmed')
      .map((entry) => ({ id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] })),
    ...ownedWeapons(c, entries).filter((weapon) => weaponCategory(weaponEntry(entries, weapon.name)) === 'Unarmed'),
  ]
  const available = new Set(unarmed.flatMap((weapon) =>
    eligibleWeaponRunes(entries, { ...weapon, runes: effectiveHandwraps(c, entries)?.runes ?? [] }).map((rune) => rune.name)))
  return propertyRunes(entries, 'Weapon').filter((rune) => available.has(rune.name))
}

export function canBeLivingWeapon(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const entry = weaponEntry(entries, weapon.name)
  return weapon.id !== OVERSIZED_THROW.id && weapon.id !== GAUNTLET.id && weapon.name !== HAFT_STRIKER_WEAPON.name
    && !PLAYING_CARD_WEAPONS.some(card => card.id === weapon.id)
    && !!activeFeatsNamed(c, 'Living Weapon').length && weaponCategory(entry) !== 'Unarmed'
    && !entry?.traits.some((trait) => /^free[- ]hand$/i.test(trait.trim()))
}

export const DEVOTED_BLESSINGS = ['Blessed Armament', 'Blessed Shield', 'Blessed Swiftness'] as const

export function championBlessing(c: Character) {
  return c.blessing ?? c.feats.find((feat) => feat.name === 'Blessing of the Devoted')?.choice
    ?? (hasFeat(c, 'Blessed Armament') ? 'Blessed Armament' : undefined)
}

export function championBlessings(c: Character) {
  if (c.className !== 'Champion' || c.level < 3) return []
  const second = c.level >= 8 && hasFeat(c, 'Second Blessing')
  const third = second && c.level >= 16 && hasFeat(c, 'Third Blessing')
  return [...new Set([championBlessing(c),
    ...(second ? [c.feats.find((feat) => feat.name === 'Second Blessing')?.choice] : []),
    ...(third ? [c.feats.find((feat) => feat.name === 'Third Blessing')?.choice] : []),
  ].filter((name): name is string => !!name && DEVOTED_BLESSINGS.some((blessing) => blessing === name)))]
}

export function isFavoredWeapon(c: Character, entries: ContentEntry[], name: string) {
  const favored = tokens(byName(entries, 'deity', c.deity)?.data.favored_weapon)
    .flatMap((weapon) => weapon.split(/\s+or\s+/i)).map((weapon) => weapon.toLowerCase())
  const entry = weaponEntry(entries, name)
  const base = entry?.data.named_weapon ? namedWeaponBaseName(entry) : name
  return favored.includes(base.replace(/ \(Animal Feature\)$/, '')
    .replace(/^(Shobhad Longrifle) \((?:Pathfinder|Starfinder)\)$/, '$1').toLowerCase())
}

function isDeadlySimplicityWeapon(c: Character, entries: ContentEntry[], entry?: ContentEntry) {
  if (!entry || !isFavoredWeapon(c, entries, entry.name)) return false
  const category = weaponCategory(entry)
  return category === 'Unarmed' || category === 'Simple' && weaponRanks(c, entries).Simple >= 1
}

export function blessedArmamentTargets(c: Character, entries: ContentEntry[]) {
  const favored = ownedWeapons(c, entries).filter((weapon) => isFavoredWeapon(c, entries, weapon.name))
  const manufactured = favored.filter((weapon) => weapon.id !== OVERSIZED_THROW.id && weaponCategory(weaponEntry(entries, weapon.name)) !== 'Unarmed')
  const handwraps = effectiveHandwraps(c, entries)
  return [...manufactured, ...(handwraps && favored.some((weapon) => weaponCategory(weaponEntry(entries, weapon.name)) === 'Unarmed')
    ? [{ id: HANDWRAPS.id, name: HANDWRAPS.name, ...handwraps }] : [])]
}

export function blessedArmamentTarget(c: Character, entries: ContentEntry[]) {
  const targets = blessedArmamentTargets(c, entries)
  return c.blessedArmament?.weaponId ? targets.find((weapon) => weapon.id === c.blessedArmament?.weaponId) : targets[0]
}

export function deitySanctification(c: Character, entries: ContentEntry[]) {
  const deity = byName(entries, 'deity', c.deity)
  const options = tokens(deity?.data.sanctification).flatMap((value): NonNullable<Character['sanctification']>[] =>
    value.toLowerCase() === 'holy' ? ['Holy'] : value.toLowerCase() === 'unholy' ? ['Unholy'] : [])
  const required = deity?.data.sanctification_required === true && options.length === 1 ? options[0] : undefined
  const selected = required ?? (c.sanctification && options.includes(c.sanctification) ? c.sanctification : undefined)
  return { options, required, selected }
}

export function blessedArmamentRuneOptions(c: Character, entries: ContentEntry[] = []) {
  const options = ['Fearsome', 'Ghost Touch', 'Returning', 'Shifting', 'Vitalizing']
  const radiant = c.level >= 10 && hasFeat(c, 'Radiant Armament')
  const sanctification = deitySanctification(c, entries).selected
  if (radiant) options.push('Astral', 'Brilliant', ...(sanctification ? [sanctification] : []))
  if (c.level >= 20 && hasFeat(c, 'Armament Paragon')) {
    options.push('Animated', 'Fearsome (Greater)', 'Grievous', 'Keen', 'Vitalizing (Greater)')
    if (radiant) options.push('Astral (Greater)', 'Brilliant (Greater)')
  }
  return options.sort((a, b) => a.localeCompare(b))
}

export function isBlessedArmament(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const targetId = c.blessedArmament?.weaponId || blessedArmamentTarget(c, entries)?.id
  return weapon.id !== OVERSIZED_THROW.id && championBlessings(c).includes('Blessed Armament')
    && isFavoredWeapon(c, entries, weapon.name)
    && (targetId === weapon.id
      || !!effectiveHandwraps(c, entries) && targetId === HANDWRAPS.id && weaponCategory(weaponEntry(entries, weapon.name)) === 'Unarmed')
}

export function blessedArmamentRune(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const rune = c.blessedArmament?.rune
  if (!rune || !isBlessedArmament(c, entries, weapon) || !blessedArmamentRuneOptions(c, entries).includes(runeName(rune))) return undefined
  if (weapon.runes.some((existing) => runeBaseName(existing) === runeBaseName(rune)) || !weaponRuneApplies(entries, weapon, rune)) return undefined
  return runeName(rune)
}

function withBlessedArmament(c: Character, entries: ContentEntry[], weapon: OwnedWeapon): OwnedWeapon {
  const rune = blessedArmamentRune(c, entries, weapon)
  return rune ? { ...weapon, runes: [...weapon.runes, rune] } : weapon
}

export function livingWeaponRunes(weapon: OwnedWeapon) {
  return [...weapon.runes.filter((rune) => runeName(rune) !== 'Shifting').slice(0, maxPropertyRunes(weapon.potency)), 'Shifting']
}

export function livingWeaponEnhancements(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const source = c.livingWeaponEnhancements
    ?? carriedWeapons(c, entries).find((candidate) => candidate.livingWeapon && canBeLivingWeapon(c, entries, candidate))
    ?? weapon
  const automatic = activeFeatsNamed(c, 'Living Weapon').length ? automaticWeaponFundamentals(c.level) : { potency: 0, striking: 0 }
  return { potency: Math.max(source.potency, automatic.potency), striking: Math.max(source.striking, automatic.striking), runes: source.runes }
}

export const automaticWeaponFundamentals = (level: number) => ({
  potency: [2, 10, 16].filter((at) => level >= at).length,
  striking: [4, 12, 19].filter((at) => level >= at).length,
})

export function automaticHardlightGrade(level: number): HardlightGrade {
  const automatic = automaticWeaponFundamentals(level)
  return (Object.keys(HARDLIGHT_GRADES) as HardlightGrade[]).reduce<HardlightGrade>((best, grade) => {
    const stats = HARDLIGHT_GRADES[grade]
    return stats.potency <= automatic.potency && stats.striking <= automatic.striking ? grade : best
  }, 'Commercial')
}

export function classHandwrapKind(c: Character, entries: ContentEntry[] = []): 'mighty' | 'hardlight' | undefined {
  if (!c.className) return undefined
  const klass = byName(entries, 'class', c.className)
  if (klass?.deleted) return undefined
  const systems = klass ? klass.systems.filter(system => c.systems.includes(system)) : c.systems
  return systems.length === 1 ? systems[0] === 'sf2e' ? 'hardlight' : 'mighty' : undefined
}

export function effectiveHandwraps(c: Character, entries: ContentEntry[] = []): Character['handwraps'] {
  const kind = classHandwrapKind(c, entries)
  const handwraps: Character['handwraps'] = c.handwraps ?? (kind
    ? { potency: 0, striking: 0, runes: [], kind: kind === 'hardlight' ? 'hardlight' : undefined }
    : undefined)
  if (!handwraps) return undefined
  if (handwraps.kind === 'hardlight') {
    const grades = Object.keys(HARDLIGHT_GRADES) as HardlightGrade[]
    const grade = grades[Math.max(grades.indexOf(handwraps.grade ?? 'Commercial'), grades.indexOf(automaticHardlightGrade(c.level)))]
    const { potency, striking } = HARDLIGHT_GRADES[grade]
    return { ...handwraps, grade, potency, striking }
  }
  const automatic = automaticWeaponFundamentals(c.level)
  return { ...handwraps, potency: Math.max(handwraps.potency, automatic.potency), striking: Math.max(handwraps.striking, automatic.striking) }
}

export function canBeVerdantWeapon(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  return weapon.id !== OVERSIZED_THROW.id && weapon.name !== HAFT_STRIKER_WEAPON.name
    && !PLAYING_CARD_WEAPONS.some(card => card.id === weapon.id)
    && weaponCategory(weaponEntry(entries, weapon.name)) !== 'Unarmed'
    && c.feats.some((feat) => featTakenLevel(feat) <= c.level && ['Verdant Weapon', 'Verdant Weapon Jousting'].includes(feat.name))
}

export function barbarianInstinct(c: Character, entries: ContentEntry[]) {
  return c.className === 'Barbarian' && c.systems.includes('pf2e') && c.level >= 1
    ? selectedSubclass(c, entries)?.replace(/\s+Instinct$/i, '').trim().toLowerCase() : undefined
}

export const isGiantInstinct = (c: Character, entries: ContentEntry[]) => barbarianInstinct(c, entries) === 'giant'

export function canBeGiantWeapon(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const entry = weaponEntry(entries, weapon.name)
  return isGiantInstinct(c, entries) && !!entry && entry.systems.includes('pf2e')
    && !weapon.attachedTo && !shieldAttachmentSource(c, weapon) && !usesWeaponUpgrades(entry)
    && weapon.id !== OVERSIZED_THROW.id && weapon.name !== HAFT_STRIKER_WEAPON.name
    && !PLAYING_CARD_WEAPONS.some(card => card.id === weapon.id)
    && weaponCategory(entry) !== 'Unarmed'
    && !entry.traits.some(trait => /^free[- ]hand$/i.test(trait.trim()))
}

export const isGiantWeapon = (c: Character, entries: ContentEntry[], weapon: OwnedWeapon) =>
  c.giantWeaponId === weapon.id && canBeGiantWeapon(c, entries, weapon)

const countsAsGiantWeapon = (c: Character, entries: ContentEntry[], weapon: OwnedWeapon) =>
  isGiantWeapon(c, entries, weapon) || isGiantInstinct(c, entries)
    && weaponEntry(entries, weapon.name)?.data.named_weapon_source === 'Ridill'

export function giantWeaponClumsy(c: Character, entries: ContentEntry[]) {
  return isGiantInstinct(c, entries) && ownedWeapons(c, entries).some(weapon =>
    countsAsGiantWeapon(c, entries, weapon) && weaponEquipped(c, entries, weapon)) ? 1 : 0
}

function giantWeaponSize(c: Character, entries: ContentEntry[]): NonNullable<OwnedWeapon['size']> {
  const size = String(byName(entries, 'ancestry', c.ancestry)?.data.size ?? 'Medium').toLowerCase()
  return size === 'tiny' ? 'Small' : size === 'large' ? 'Huge' : size === 'huge' ? 'Gargantuan' : 'Large'
}

function rageDamageBonus(c: Character, entries: ContentEntry[], weapon: OwnedWeapon, traits: string[], ranged: boolean) {
  if (!c.raging || !c.systems.includes('pf2e') || c.level < 1
    || c.className !== 'Barbarian' && !activeFeatsNamed(c, 'Barbarian Dedication').length) return 0
  if (ranged && (!traits.some(trait => /^thrown\b/.test(trait))
    || !activeFeatsNamed(c, 'Raging Thrower').length)) return 0
  const instinct = barbarianInstinct(c, entries)
  const stage = c.level >= 15 ? 2 : c.level >= 7 ? 1 : 0
  const value = instinct === 'giant' && countsAsGiantWeapon(c, entries, weapon) ? [6, 10, 18][stage]
    : instinct === 'fury' ? [3, 7, 13][stage] : 2
  return traits.includes('agile') ? Math.floor(value / 2) : value
}

export function canBeWeaponInnovation(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const innovation = c.className === 'Inventor' && selectedSubclass(c, entries) === 'Weapon'
    || activeFeatsNamed(c, 'Inventor Dedication').some(feat => feat.choice === 'Weapon')
    || c.className === 'Inventor' && ['Second Innovation', 'Third Innovation']
      .some(name => activeFeatsNamed(c, name).some(feat => feat.choice === 'Weapon'))
  if (!innovation || !c.systems.includes('pf2e') || weapon.id === OVERSIZED_THROW.id || weapon.name === HAFT_STRIKER_WEAPON.name
    || PLAYING_CARD_WEAPONS.some(card => card.id === weapon.id)) return false
  const entry = weaponEntry(entries, weapon.name)
  if (!entry || entry.level !== 0 || !entry.systems.includes('pf2e') || weaponCategory(entry) === 'Unarmed') return false
  return contentAccessGranted(c, entry)
    || !!c.gearAccessOverrides?.includes(entry.id) || weaponAccessSources(c, entries, entry).length > 0
}

export function hasAutomaticWeaponFundamentals(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  return !!shieldAttachmentSource(c, weapon) && weapon.name !== SHIELD_BASH.name
    || weapon.name === 'Bladed Gauntlet' && !!armorGauntlet(c, entries)?.locked
    || deityWeapon(c, entries)?.id === weapon.id
    || isGrantedDwarfClanWeapon(c, entries, weapon)
    || c.systems.includes('pf2e') && [CLAN_DAGGER.name, CLAN_DAGGER_DEXTERITY.name, CLAN_PISTOL.name].includes(weapon.name)
    || !!weapon.livingWeapon && canBeLivingWeapon(c, entries, weapon)
    || !!weapon.verdantWeapon && canBeVerdantWeapon(c, entries, weapon)
    || isGiantWeapon(c, entries, weapon)
    || !!weapon.inventorInnovation && canBeWeaponInnovation(c, entries, weapon)
    || PLAYING_CARD_WEAPONS.some(card => card.id === weapon.id) && activeFeatsNamed(c, "Fane's Fourberie").length > 0
}

export function usesWeaponUpgrades(entry?: ContentEntry) {
  return !!entry?.systems.includes('sf2e') && entry.traits.some(trait => /^(?:tech|analog)$/i.test(trait.trim()))
}

export function installedWeaponUpgrades(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const entry = weaponEntry(entries, weapon.name)
  const unarmed = weaponCategory(entry) === 'Unarmed'
  const handwraps = unarmed ? effectiveHandwraps(c, entries) : undefined
  const ids = unarmed
    ? handwraps?.kind === 'hardlight' && !animalStrengthSource(c, entries, weapon) ? handwraps.upgrades : undefined
    : usesWeaponUpgrades(entry) ? weapon.upgrades : undefined
  return (ids ?? []).flatMap(id => {
    const upgrade = entries.find(candidate => candidate.id === id && !candidate.deleted && candidate.kind === 'item'
      && candidate.systems.includes('sf2e') && candidate.data.item_subcategory === 'Weapon Upgrades')
    return upgrade ? [upgrade] : []
  })
}

export function effectiveWeapon(c: Character, entries: ContentEntry[], weapon: OwnedWeapon): OwnedWeapon {
  const shield = shieldAttachmentSource(c, weapon)
  if (shield) {
    const generated = shield.id === 'granted-shield:hardwood'
    const material = shield.name === 'Scale of Igroon' && weapon.name !== SHIELD_BASH.name ? 'Orichalcum' : generated
      ? /High-Grade/.test(shield.name) ? 'Duskwood (High-Grade)' : 'Duskwood (Standard-Grade)'
      : shieldAllowsUpgrades(shield) ? shield.material?.name : undefined
    if (weapon.name === SHIELD_BASH.name) return { ...weapon, material, potency: 0, striking: 0, runes: [] }
    const automatic = automaticWeaponFundamentals(c.level)
    return withBlessedArmament(c, entries, { ...weapon, material,
      potency: Math.max(weapon.potency, automatic.potency),
      striking: Math.max(weapon.striking, automatic.striking) })
  }
  if (weapon.attachedTo) {
    const source = ownedWeapons(c, entries).find(candidate => candidate.id === weapon.attachedTo && !candidate.attachedTo)
    if (source) {
      const base = effectiveWeapon(c, entries, source)
      return { ...weapon, potency: base.potency, striking: base.striking, material: base.material, runes: base.runes }
    }
  }
  if (weapon.id === OVERSIZED_THROW.id) return { ...weapon, potency: 0, striking: 0, runes: [], material: undefined }
  const clanGrant = dwarfClanWeaponGrants(c, entries).find(grant => grant.id === weapon.id)
  if (clanGrant) weapon = { ...weapon, name: clanGrant.name, material: 'Orichalcum' }
  const forms = combinationForms(entries, weapon.name)
  const form = forms.find(entry => entry.name.endsWith(`(${weapon.combinationForm})`))
  if (form) {
    const selectedForm = { ...weapon, name: form.name }
    weapon = { ...selectedForm, runes: selectedForm.runes.filter(rune => weaponRuneApplies(entries, selectedForm, rune)) }
  }
  const entry = weaponEntry(entries, weapon.name)
  const builtIn = namedWeaponEnhancements(withNamedWeaponState(entry, weapon, c.level))
  if (builtIn?.material) weapon = { ...weapon, material: builtIn.material }
  if (usesWeaponUpgrades(entry) && weaponCategory(entry) !== 'Unarmed') return { ...weapon, potency: Number(entry?.data.weapon_tracking ?? 0), striking: 0, runes: [] }
  const scaled = builtIn?.material && weapon.material === builtIn.material ? weapon.material : scaledMaterial(weapon.material, c.level, 'Weapon')
  if (scaled !== weapon.material) weapon = { ...weapon, material: scaled }
  const favored = deityWeapon(c, entries)?.id === weapon.id
  const automatic = automaticWeaponFundamentals(c.level)
  if (hasAutomaticWeaponFundamentals(c, entries, weapon)) weapon = { ...weapon,
    potency: Math.max(weapon.potency, automatic.potency),
    striking: Math.max(weapon.striking, automatic.striking),
  }
  if (PLAYING_CARD_WEAPONS.some(card => card.id === weapon.id) && activeFeatsNamed(c, "Fane's Fourberie").length) {
    const shared = c.playingCardEnhancements
    weapon = { ...weapon, potency: Math.max(weapon.potency, shared?.potency ?? 0),
      striking: Math.max(weapon.striking, shared?.striking ?? 0), runes: shared?.runes ?? weapon.runes, material: undefined }
  }
  const gauntlet = weapon.id === GAUNTLET.id || weapon.name === 'Bladed Gauntlet' ? armorGauntlet(c, entries) : undefined
  const plate = weapon.id === GAUNTLET.id || gauntlet?.locked ? gauntlet?.armor : undefined
  if (plate) weapon = { ...weapon, material: plate.material,
    potency: plate.id === INVENTOR_ARMOR_ID && getSettings().inventorArmorGauntlets ? Math.max(weapon.potency, plate.potency) : plate.potency,
    striking: plate.id === INVENTOR_ARMOR_ID && getSettings().inventorArmorGauntlets ? Math.max(weapon.striking, plate.resilient) : plate.resilient }
  const haft = weapon.name === HAFT_STRIKER_WEAPON.name ? haftStrikerSource(c, entries) : undefined
  if (haft) {
    const source = effectiveWeapon(c, entries, haft)
    const inherited = { ...weapon, livingWeapon: !!source.livingWeapon && canBeLivingWeapon(c, entries, haft),
      potency: source.potency, striking: source.striking, material: source.material, runes: source.runes }
    weapon = { ...inherited, runes: source.runes.filter((rune) => weaponRuneApplies(entries, inherited, rune)) }
  }
  if (weaponCategory(weaponEntry(entries, weapon.name)) !== 'Unarmed') {
    let enhanced = weapon
    const peachwood = scaledMaterial('Peachwood', c.level, 'Weapon')
    if (weapon.livingWeapon && canBeLivingWeapon(c, entries, weapon)) {
      const shared: OwnedWeapon = { ...weapon, ...livingWeaponEnhancements(c, entries, weapon), material: peachwood }
      enhanced = { ...shared, runes: livingWeaponRunes(shared).filter((rune) => weaponRuneApplies(entries, shared, rune)) }
    }
    if (weapon.verdantWeapon && canBeVerdantWeapon(c, entries, weapon)) {
      enhanced = { ...enhanced, material: peachwood }
    }
    if (weapon.inventorInnovation && canBeWeaponInnovation(c, entries, weapon)) enhanced = { ...enhanced, material: 'Orichalcum' }
    if (isGiantWeapon(c, entries, weapon)) enhanced = { ...enhanced, size: giantWeaponSize(c, entries), material: 'Orichalcum' }
    if (plate) enhanced = { ...enhanced, material: plate.material, potency: weapon.potency, striking: weapon.striking }
    if (builtIn) enhanced = { ...enhanced, potency: Math.max(enhanced.potency, builtIn.potency),
      striking: Math.max(enhanced.striking, builtIn.striking), runes: [...new Set([...builtIn.runes, ...enhanced.runes])] }
    return withBlessedArmament(c, entries, weapon.id === GAUNTLET.id ? { ...enhanced,
      runes: enhanced.runes.filter((rune) => weaponRuneApplies(entries, enhanced, rune))
        .slice(0, maxPropertyRunes(enhanced.potency, enhanced.material,
          hasWeaponRuneCapacity(c, weapon, weaponEntry(entries, weapon.name)))) } : enhanced)
  }
  const animalSource = animalStrengthSource(c, entries, weapon)
  if (animalSource) {
    return animalStrengthEnhancements(entries, weapon, effectiveWeapon(c, entries, animalSource))
  }
  const fundamentals = effectiveHandwraps(c, entries)
  const enhanced: OwnedWeapon = { ...weapon, material: undefined,
    potency: Math.max(favored ? weapon.potency : 0, fundamentals?.potency ?? 0),
    striking: Math.max(favored ? weapon.striking : 0, fundamentals?.striking ?? 0),
    runes: fundamentals?.kind === 'hardlight' ? [] : fundamentals?.runes ?? [] }
  if (fundamentals?.kind === 'hardlight') return enhanced
  return withBlessedArmament(c, entries, { ...enhanced, runes: enhanced.runes.filter((rune) => weaponRuneApplies(entries, enhanced, rune)) })
}

export const maxPropertyRunes = (potency: number, material?: OwnedWeapon['material'], runeCapacity = false) => {
  const slots = Math.max(0, Math.min(4, potency))
  const materialBonus = slots > 0 && material === 'Orichalcum' ? 1 : 0
  const modificationBonus = slots > 0 && runeCapacity ? 1 : 0
  return Math.min(4 + Number(materialBonus > 0 && modificationBonus > 0), slots + materialBonus + modificationBonus)
}

const WEAPON_CATEGORIES = ['Simple', 'Martial', 'Advanced', 'Unarmed'] as const
export function weaponCategory(entry?: ContentEntry): (typeof WEAPON_CATEGORIES)[number] {
  const text = `${entry?.data.weapon_category ?? ''} ${entry?.data.weapon_type ?? ''} ${(entry?.traits ?? []).join(' ')}`.toLowerCase()
  return WEAPON_CATEGORIES.find((cat) => text.includes(cat.toLowerCase())) ?? 'Simple'
}
export const isRanged = (entry?: ContentEntry) => /ranged/i.test(String(entry?.data.weapon_type ?? '')) || num(entry?.data.range) > 0
export const weaponDamage = (entry?: ContentEntry) => {
  const damage = String(entry?.data.damage ?? '').trim()
  return /[a-z]$/i.test(damage) || !entry?.data.damage_type ? damage : `${damage} ${String(entry.data.damage_type).charAt(0).toUpperCase()}`
}

export function alloyedAttackMaterial(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const entry = weaponEntry(entries, weapon.name)
  if (weaponCategory(entry) !== 'Unarmed' || isRanged(entry)) return undefined
  return alloyedAttackChoice(c)
}

export function armorCategory(entry?: ContentEntry): 'Light' | 'Medium' | 'Heavy' | 'Unarmored' {
  const text = `${entry?.data.armor_category ?? ''} ${(entry?.traits ?? []).join(' ')}`.toLowerCase()
  return (['Light', 'Medium', 'Heavy'] as const).find((cat) => new RegExp(`\\b${cat.toLowerCase()}\\b`).test(text)) ?? (/unarmored/.test(text) || !entry ? 'Unarmored' : 'Light')
}

export function weaponAttack(c: Character, entries: ContentEntry[], w: OwnedWeapon) {
  const upgrades = installedWeaponUpgrades(c, entries, w)
  w = effectiveWeapon(c, entries, w)
  if (combinationForms(entries, w.name).length || PLAYING_CARD_WEAPONS.some(card => card.id === w.id)) {
    w = { ...w, runes: w.runes.filter(rune => weaponRuneApplies(entries, w, rune)) }
  }
  let entry = withNamedWeaponState(weaponEntry(entries, w.name), w, c.level)
  const sparkFist = w.name === SPARK_FIST.name && activeFeatsNamed(c, 'Spark Fist').length > 0
  const cairn = w.name === CAIRN_FIST.name || sparkFist ? cairnForm(c, entries) : undefined
  if (cairn) {
    const fist = sparkFist ? SPARK_FIST : CAIRN_FIST
    entry = { ...fist, data: { ...fist.data, damage: `${cairn.dice}d6 bludgeoning` } }
  }
  if (sparkFist && (activeFeatsNamed(c, 'Iron Fists').length || activeFeatsNamed(c, 'Iron Fist').length) && entry) {
    entry = { ...entry, traits: [...new Set([...entry.traits, 'Shove'])] }
  }
  if (w.id === OVERSIZED_THROW.id) {
    const specialization = classFeatures(entries, c).map((feature) => feature.name.toLowerCase())
    const dice = specialization.includes('greater weapon specialization') || c.className === 'Barbarian' && c.level >= 15 ? 3
      : specialization.includes('weapon specialization') || c.className === 'Barbarian' && c.level >= 7 ? 2 : 1
    entry = { ...OVERSIZED_THROW, data: { ...OVERSIZED_THROW.data, damage: `${dice}d10 bludgeoning` } }
  }
  entry = weaponWithMode(w, entry)
  entry = weaponWithModifications(c, w, entry)
  if (entry && hasDivineIntercession(c, 'Erastil', 'moderate-boon')
    && /\blongbow\b/i.test(namedWeaponBaseName(entry))) {
    entry = { ...entry, traits: entry.traits.map(trait => /^volley\b/i.test(trait) ? 'Volley (if beneficial)' : trait),
      data: { ...entry.data, range: num(entry.data.range) * 2 } }
  }
  if (entry && hasDivineIntercession(c, 'Gorum', 'moderate-boon')
    && /^(?:bastard sword|greatsword)$/i.test(namedWeaponBaseName(entry)) && !entry.traits.some(trait => /^forceful$/i.test(trait))) {
    entry = { ...entry, traits: [...entry.traits, 'Forceful'] }
  }
  const hydraulicFist = !!entry && /^(?:iron )?fists?$/i.test(entry.name) && !!activeFeatsNamed(c, 'Hydraulic Pistons').length
  const mechanicMods = c.className === 'Mechanic' && c.systems.includes('sf2e') && weaponCategory(entry) !== 'Unarmed'
    ? c.mechanicWeaponMods?.[w.id] : undefined
  if (entry && !isRanged(entry)) {
    const shield = getSettings().bucklerMeleeFinesse ? shieldAttachmentSource(c, w) : undefined
    const existingTraits = entry.traits.map(trait => trait.toLowerCase())
    const added = [
      ...(getSettings().gauntletFinesse && /^(?:spiked )?gauntlet$/i.test(entry.name.trim()) ? ['Finesse'] : []),
      ...(shield?.attachedWeapon && isBucklerShield(shield.name) ? ['Finesse'] : []),
      ...(/\bgauntlets?\b/i.test(entry.name) && c.feats.some(feat => /^Iron Fists?$/i.test(feat.name)
        && featTakenLevel(feat) <= c.level) ? ['Shove'] : []),
      ...(hydraulicFist ? ['Boost d4', 'Tech'] : []),
    ].filter(trait => !existingTraits.includes(trait.toLowerCase()))
    if (added.length) entry = { ...entry, traits: [...entry.traits, ...added] }
  }
  if (entry) {
    const existingTraits = entry.traits.map(trait => trait.toLowerCase())
    const added = [
      ...(defensiveArmamentsParry(c, w, entry) || upgrades.some(upgrade => /^Protection Grid(?:\s*\(|$)/i.test(upgrade.name)) ? ['Parry'] : []),
      ...(upgrades.some(upgrade => upgrade.name === 'Merciful') ? ['Nonlethal'] : []),
      ...(mechanicMods?.incapacitant ? ['Nonlethal'] : []),
      ...(upgrades.some(upgrade => /^Smuggler's Grip(?:\s*\(|$)/i.test(upgrade.name)) ? ['Concealed'] : []),
    ].filter(trait => !existingTraits.includes(trait.toLowerCase()))
    if (added.length) entry = { ...entry, traits: [...entry.traits, ...added] }
  }
  if (entry && c.className === 'Barbarian' && c.raging && getSettings().barbarianIgnoreAgile
    && entry.traits.some(trait => /^agile$/i.test(trait.trim()))) {
    entry = { ...entry, traits: entry.traits.filter(trait => !/^agile$/i.test(trait.trim())) }
  }
  const traits = (entry?.traits ?? []).map((t) => t.toLowerCase())
  const ranged = isRanged(entry)
  const thrown = traits.some((t) => t.startsWith('thrown'))
  const strongArm = (thrown || w.id === OVERSIZED_THROW.id) && activeFeatsNamed(c, 'Strong Arm').length > 0
  const thrownRange = num(entry?.data.thrown_range)
    || Number(traits.map(trait => /^thrown\s+(\d+)\s*(?:ft\.?|feet)?$/i.exec(trait)?.[1]).find(Boolean) ?? 0)
  const str = abilityMod(c.abilities.str)
  const dex = abilityMod(c.abilities.dex)
  const ability: Ability = ranged ? 'dex' : traits.includes('finesse') && dex > str ? 'dex' : 'str'
  const mod = ability === 'dex' ? dex : str
  const clumsy = ability === 'dex' ? giantWeaponClumsy(c, entries) : 0
  const divineAttackBonus = hasDivineIntercession(c, 'Iomedae', 'major-boon')
    && !!entry && /^longsword$/i.test(namedWeaponBaseName(entry)) && weaponHeld(c, entries, w) ? 2 : 0
  const category = weaponCategory(entry)
  const advancedTraining = category === 'Advanced' && weaponProficiencyGrants(c, entries)
    .some((grant) => !grant.martial && grant.feat.choice?.trim().toLowerCase() === entry?.name.toLowerCase())
  const familiarity = entry ? weaponFamiliarity(c, entry, category, entries) : undefined
  const unconventional = entry && unconventionalWeapon(c, entries, entry)
  const familiarCategory = familiarity?.proficiency
  const unconventionalCategory = unconventional ? category === 'Advanced' ? 'Martial' : 'Simple' : undefined
  const innovationCategory = w.inventorInnovation && category === 'Advanced' && canBeWeaponInnovation(c, entries, w) ? 'Martial' : undefined
  const ranks = weaponRanks(c, entries)
  const avengerRank = rogueRackets(c, entries).includes('Avenger') && isFavoredWeapon(c, entries, w.name)
    ? Math.max(1, baseWeaponRanks(c, entries).Simple, baseWeaponRanks(c, entries).Martial) : 0
  const martialExperience = activeFeatsNamed(c, 'Martial Experience').length > 0
  const expertise = familiarity?.expertise || unconventional && activeFeatsNamed(c, 'Unconventional Expertise').length > 0
  const rank = Math.max(category === 'Unarmed' ? 1 : 0, ranks[category], familiarCategory ? ranks[familiarCategory] : 0,
    unconventionalCategory ? ranks[unconventionalCategory] : 0, innovationCategory ? ranks[innovationCategory] : 0,
    familiarity?.trained ? 1 : 0, expertise ? Math.max(...Object.values(baseWeaponRanks(c, entries))) : 0,
    advancedTraining ? c.level >= 11 ? 2 : 1 : 0, avengerRank, cairn ? Math.max(...Object.values(ranks)) : 0)
  const agile = traits.includes('agile')
  const agileGrace = agile && activeFeatsNamed(c, 'Agile Grace').length > 0
  const mapStep = agileGrace ? 3 : agile ? 4 : 5
  const flurry = c.className === 'Ranger' && (selectedSubclass(c, entries)?.replace(/ Edge$/, '') === 'Flurry'
    || activeFeatsNamed(c, 'Manifold Edge').some(feat => feat.choice === 'Flurry'))
  const flurryStep = (c.level >= 17 && rank >= 3 ? 2 : 3) - Number(agile)
  const prof = rank === 0 && martialExperience ? c.level : proficiencyBonus(rank, c.level)
  const proficiencySources = [
    { name: category, rank: Math.max(category === 'Unarmed' ? 1 : 0, ranks[category]) },
    ...(familiarCategory ? [{ name: `${familiarCategory} via weapon familiarity`, rank: ranks[familiarCategory] }] : []),
    ...(unconventionalCategory ? [{ name: `${unconventionalCategory} via Unconventional Weaponry`, rank: ranks[unconventionalCategory] }] : []),
    ...(innovationCategory ? [{ name: 'Martial via Weapon Innovation', rank: ranks.Martial }] : []),
    ...(familiarity?.trained ? [{ name: 'Weapon familiarity training', rank: 1 }] : []),
    ...(expertise ? [{ name: 'Weapon expertise', rank: Math.max(...Object.values(baseWeaponRanks(c, entries))) }] : []),
    ...(advancedTraining ? [{ name: 'Weapon Proficiency feat', rank: c.level >= 11 ? 2 : 1 }] : []),
    ...(avengerRank ? [{ name: 'Avenger favored weapon', rank: avengerRank }] : []),
    ...(cairn ? [{ name: 'Cairn Form: highest weapon proficiency', rank: Math.max(...Object.values(ranks)) }] : []),
    ...(martialExperience ? [{ name: 'Martial Experience', rank: c.level >= 11 ? 1 : 0 }] : []),
  ].filter(source => source.rank === rank).map(source => source.name)
  const m = /(\d+)d(\d+)\s*([A-Za-z]+)?/.exec(String(entry?.data.damage ?? ''))
  const damageType = m?.[3]?.toLowerCase()
  const physicalTypes = ['b', 'p', 's', 'bludgeoning', 'piercing', 'slashing']
  const energyTypes = ['a', 'c', 'e', 'f', 'so', 'acid', 'cold', 'electricity', 'fire', 'sonic']
  const chosenDamageType = mechanicMods?.damageType
  const modifiedDamageType = c.level >= 5 && chosenDamageType
    && (physicalTypes.includes(damageType ?? '') && physicalTypes.includes(chosenDamageType)
      || energyTypes.includes(damageType ?? '') && energyTypes.includes(chosenDamageType)) ? chosenDamageType : m?.[3]
  const dice = m ? Math.max(cairn ? Math.max(+m[1], 1 + w.striking) : (+m[1]) * (1 + w.striking), num(entry?.data.named_weapon_damage_dice)) : 0
  const attachedSource = w.attachedTo
    ? ownedWeapons(c, entries).find(source => source.id === w.attachedTo && !source.attachedTo) : undefined
  const twoHandDie = weaponHands(entries, attachedSource ?? w, c) === 2
    ? traits.map(trait => /^two-hand\s+(?:1)?d(4|6|8|10|12)$/i.exec(trait.trim())?.[1]).find(Boolean) : undefined
  const baseDie = m ? Number(twoHandDie ?? m[2]) : 0
  const dieSteps = [4, 6, 8, 10, 12]
  const baseDamageDie = hasFeat(c, 'Deadly Simplicity') && isDeadlySimplicityWeapon(c, entries, entry)
    ? category === 'Unarmed' ? Math.max(baseDie, 6) : dieSteps.find((step) => step > baseDie) ?? baseDie
    : baseDie
  const shieldWarfare = activeFeatsNamed(c, 'Shield Warfare').length > 0
    && (String(entry?.data.weapon_group ?? '').toLowerCase() === 'shield' || /^shield (?:bash|boss|spikes)$/i.test(entry?.name ?? ''))
  const die = shieldWarfare ? dieSteps.find(step => step > baseDamageDie) ?? baseDamageDie : baseDamageDie
  const heart = activeFeatsNamed(c, "Jotun's Heart").length > 0
  const battleStance = activeStance(c, entries)?.name === "Jotun's Battle Stance"
  const hasReachTrait = traits.some(trait => /^reach(?:\s|$)/i.test(trait))
  const baseReach = num(entry?.data.reach) || (hasReachTrait ? 10 : 5)
  const reach = isRanged(entry) ? 0
    : heart ? Math.max(10, baseReach) + (battleStance ? 5 : 0)
    : battleStance && weaponHands(entries, w, c) === 2 && !hasReachTrait ? 10 : baseReach
  const flat = !ranged || thrown ? !ranged && traits.includes('finesse') && rogueRackets(c, entries).includes('Thief') ? Math.max(dex, str) : str
    : traits.includes('propulsive') ? str > 0 ? Math.floor(str / 2) : str : 0
  const mechanicSpecialization = c.className === 'Mechanic' && c.systems.includes('sf2e') && c.level >= 7 && rank >= 2
    ? (c.level >= 15 ? 2 : 1) * rank : 0
  const barbarianSpecialization = c.className === 'Barbarian' && c.systems.includes('pf2e') && c.level >= 7 && rank >= 2
    ? (c.level >= 15 ? 2 : 1) * rank : 0
  const starfinderSpecialization = c.systems.includes('sf2e') && rank >= 2
    && (c.className === 'Soldier' && c.level >= 7 || c.className === 'Witchwarper' && c.level >= 13) ? rank : 0
  const cairnSpecialization = cairn && rank >= 2
    ? classFeatures(entries, c).some(feature => /^greater weapon specialization$/i.test(feature.name)) ? rank * 2
      : classFeatures(entries, c).some(feature => /^weapon specialization$/i.test(feature.name)) ? rank : 0 : 0
  const rageDamage = rageDamageBonus(c, entries, w, traits, ranged)
  const damageBonus = flat + Math.max(mechanicSpecialization, barbarianSpecialization, cairnSpecialization, starfinderSpecialization) + rageDamage
    + (w.id === 'mechanic:turret' && c.subclass === 'Turret' && mechanicMods?.pinpointShot ? abilityMod(c.abilities.int) : 0)
  const livingSource = w.name === HAFT_STRIKER_WEAPON.name ? haftStrikerSource(c, entries) : w
  const jousting = !ranged && num(entry?.data.hands) === 1 && (
    c.level >= 4 && hasFeat(c, 'Favored Weapon Jousting') && isFavoredWeapon(c, entries, livingSource?.name ?? w.name)
    || c.level >= 4 && hasFeat(c, 'Verdant Weapon Jousting') && !!livingSource?.verdantWeapon && canBeVerdantWeapon(c, entries, livingSource)
    || c.level >= 4 && activeFeatsNamed(c, 'Weapon Innovation Jousting').length > 0
      && !!livingSource?.inventorInnovation && canBeWeaponInnovation(c, entries, livingSource)
    || c.level >= 14 && (hasFeat(c, 'Living Weapon Joust') || hasFeat(c, 'Living Weapon Jousting')) && !!livingSource?.livingWeapon && canBeLivingWeapon(c, entries, livingSource))
  const pristineLivingWeapon = c.level >= 14
    && ['Pristine Living Weapon', 'Living Weapon', 'Wild Hunter Dedication'].every((name) => hasFeat(c, name))
    && !!livingSource?.livingWeapon && canBeLivingWeapon(c, entries, livingSource)
  const range = ranged && num(entry?.data.range) > 0
    ? (num(entry?.data.range) + (strongArm ? 10 : 0) + (mechanicMods?.longRange ? 30 : 0)) * (w.runes.some(rune => runeBaseName(rune).toLowerCase() === 'impossible') ? 2 : 1)
      * (activeFeatsNamed(c, 'Far Shot').length ? 2 : 1) : 0
  const style = soldierStyle(c)
  const areaTrait = entry?.traits.find(trait => /^area(?:\s|$)/i.test(trait))
  const automatic = traits.some(trait => /^automatic(?:\s|$)/i.test(trait))
  const closeQuarters = style?.name === 'Close Quarters' && !ranged && weaponHands(entries, w, c) === 2
  const classDC = isSoldier(c) ? classDifficultyClass(c, entries) : undefined
  const areaAttacks = classDC === undefined ? [] : [
    ...(areaTrait ? [{ name: 'Area Fire', shape: areaTrait.replace(/^area\s*/i, '') }] : []),
    ...(automatic ? [{ name: 'Auto-Fire', shape: `${style?.name === 'Action Hero' ? range : Math.floor(range / 2)}-foot cone` }] : []),
    ...(closeQuarters ? [{ name: 'Soldier feat area', shape: '5-foot burst' }] : []),
  ].map(area => ({ ...area, dc: classDC + (usesWeaponUpgrades(entry) ? w.potency : 0),
    note: `Area Fire and Auto-Fire take two actions; soldier feats use their listed action costs. Basic Reflex save. Failure${style?.name === 'Bombard' ? ' or success (not critical success)' : ''} suppresses enemies until your next turn (-1 circumstance to attacks, -10-foot status to Speeds).${
      !/\bgrenade\b/i.test(`${entry?.name} ${entry?.data.weapon_group ?? ''}`) ? " Primary Target: before the area attack, make a free Strike without increasing MAP; a hit changes that target's successful area save to failure." : ' Grenades and grenade launchers cannot use Primary Target.'}${
      style?.name === 'Bombard' ? ` Exclude up to ${Math.max(0, Math.floor(abilityMod(c.abilities.con) / 2))} allies.` : ''}${style ? ` ${style.description}` : ''}` }))
  return {
    entry,
    upgrades,
    pristineLivingWeapon,
    rageDamage,
    areaAttacks,
    additionalDamage: [...divineAttackDamage(c), ...namedWeaponDamage(entry),
      ...(sparkFist ? [{ source: 'Spark Fist', value: `${dice} fire`,
        note: `Activate with one action, once per minute, until the end of your next turn. Each successful fist Strike also deals ${dice} fire damage to you.` }] : [])],
    traits: [...new Set([...(entry?.traits ?? []),
      ...w.runes.map((rune) => runeName(rune)).filter((rune) => rune === 'Holy' || rune === 'Unholy'),
      ...(w.runes.some((rune) => runeName(rune) === 'Hooked') && !traits.includes('trip') ? ['Trip'] : []),
      ...(w.runes.some((rune) => runeName(rune) === 'Grappling') && weaponRuneApplies(entries, w, 'Grappling')
        && !traits.includes('grapple') ? ['Grapple'] : []),
      ...(w.runes.some((rune) => runeName(rune) === 'Disarming') && weaponRuneApplies(entries, w, 'Disarming')
        && !traits.includes('disarm') ? ['Disarm'] : []),
      ...(w.runes.some((rune) => runeName(rune) === 'Parrying') && weaponRuneApplies(entries, w, 'Parrying')
        && !traits.includes('parry') ? ['Parry'] : []),
      ...(activeFeatsNamed(c, 'Raise Haft').length > 0 && weaponHands(entries, w, c) === 2
        && !traits.includes('parry') ? ['Parry'] : []),
      ...(activeFeatsNamed(c, 'Iruxi Spirit Strike').length > 0 && c.ancestry === 'Lizardfolk'
        && iruxiAttackIds.has(w.id) && !traits.includes('ghost touch') ? ['Ghost Touch'] : []),
      ...(jousting && !traits.some((trait) => /^jousting\b/.test(trait)) ? ['Jousting'] : [])])].sort((a, b) => a.localeCompare(b)),
    criticalSpecialization: hydraulicFist || isBlessedArmament(c, entries, w) || !!familiarity?.criticalSpecialization
      || category === 'Unarmed' && activeFeatsNamed(c, 'Iruxi Unarmed Cunning').length > 0
      || c.level >= 5 && iruxiAttackIds.has(w.id) && activeFeatsNamed(c, 'Iruxi Armaments').length > 0
      || isSoldier(c) && c.level >= 5 && traits.some(trait => /^(?:area|automatic)(?:\s|$)/i.test(trait)),
    criticalNote: cairn ? `On a critical hit, Fortitude save against ${classDifficultyClass(c, entries) ?? 'your class DC'} or stunned 1 for 1 round.` : undefined,
    ability,
    mod,
    prof,
    rank,
    item: w.potency,
    attack: mod + prof + w.potency - clumsy + divineAttackBonus,
    multipleAttackPenalties: [0, -mapStep, -2 * mapStep],
    huntedPreyMultipleAttackPenalties: flurry ? [0, -flurryStep, -2 * flurryStep] : undefined,
    breakdown: {
      total: mod + prof + w.potency - clumsy + divineAttackBonus,
      parts: [
        { label: ABILITY_LABEL[ability], value: mod },
        { label: 'Proficiency', value: prof, note: `${RANKS[rank]} (${proficiencySources.join(', ')})` },
        { label: 'Effective weapon potency (item)', value: w.potency },
        ...(divineAttackBonus ? [{ label: 'Iomedae (Major Boon) (status)', value: divineAttackBonus }] : []),
        ...(clumsy ? [{ label: 'Giant Instinct: clumsy (status)', value: -clumsy }] : []),
      ],
      notes: [
        `Multiple attack penalty: 0/${signed(-mapStep)}/${signed(-2 * mapStep)}${agileGrace ? ' (Agile Grace)' : agile ? ' (Agile)' : ''}.`,
        ...(activeFeatsNamed(c, 'Spirit Coffin').length
          ? ['Spirit Coffin: weapon and unarmed Strikes are magical against incorporeal creatures; if already magical, they gain ghost touch.'] : []),
      ],
    } satisfies TotalBreakdown,
    range,
    reach,
    thrownRange: !ranged && thrown && thrownRange > 0
      ? (thrownRange + (strongArm ? 10 : 0) + (mechanicMods?.longRange ? 30 : 0)) * (w.runes.some(rune => runeBaseName(rune).toLowerCase() === 'impossible') ? 2 : 1) : 0,
    thrownRangeBonus: strongArm ? 10 : 0,
    damage: m ? `${dice}d${die}${damageBonus ? signed(damageBonus) : ''}${modifiedDamageType ? ` ${modifiedDamageType}` : ''}` : '',
  }
}

export const additionalSkillCount = (c: Character, entries: ContentEntry[]) =>
  Math.max(0, classSkills(byName(entries, 'class', c.className)).additional
    + abilityMod(c.abilities.int) + trainedSkillFeatBonus(c, entries)
    + Number(isPioneerHuman(c) && [...autoClassSkills(c, entries), ...backgroundSkills(byName(entries, 'background', c.background))].includes('Survival')))
    + (() => {
      const klass = classSkills(byName(entries, 'class', c.className))
      const classTraining = new Set([...klass.fixed, ...(c.classSkill && klass.choices.includes(c.classSkill) ? [c.classSkill] : [])])
      return backgroundSkills(byName(entries, 'background', c.background), c).filter(skill => classTraining.has(skill)).length
    })()
    + backgroundSkills(freeHeartBackground(c, entries), c).filter(skill => autoClassSkills(c, entries).includes(skill)).length
    + c.feats.reduce((total, feat, index) => {
      if (featTakenLevel(feat) > c.level) return total
      const ancestry = ancestrySkillGrant(c, entries, feat.name)
      const warmask = feat.name === 'Orc Warmask' ? warmaskSource(c) : undefined
      const named = ancestry ? [ancestry.skill]
        : feat.name === 'Pick On Someone My Size' ? []
        : feat.name === 'Ancestral Skills' ? ancestralSkills(c, entries, [feat])
        : feat.name === 'Lizardfolk Lore' ? ['Survival', ...(feat.choice && ['Nature', 'Occultism'].includes(feat.choice) ? [feat.choice] : [])]
        : (feat.name === 'Dwarven Lore' ? undefined : ancestryLoreGrant(c, entries, feat.name)?.skills) ?? ANCESTRY_SKILL_ONLY_GRANTS[feat.name]
        ?? (feat.name === 'Dwarven Lore' ? ['Crafting', 'Religion']
        : feat.name === 'Clan Lore' ? CLAN_LORE_OPTIONS[feat.choice ?? '']?.skills ?? []
        : feat.name === 'Eye for Treasure' ? ['Crafting']
        : feat.name === "Officer's Medical Training" ? ['Medicine']
        : feat.name === 'Rat Retinal HUD' ? ['Computers']
        : feat.name === 'Shiny' ? ['Performance']
        : warmask ? [warmask.skill] : [])
      if (!named.length) return total
      const ranks = ancestrySkillBefore({ ...c, skillPicks: [] }, entries, index)
      const replacementChoices = feat.name === 'Dwarven Lore' || feat.name === 'Clan Lore'
        ? loreReplacementChoices(c, entries, index) : feat.name === 'Lizardfolk Lore'
          ? lizardfolkLoreReplacementChoices(c, entries, index) : undefined
      const choices = !replacementChoices && !warmask && feat.choice
        ? featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) : undefined
      return total + named.reduce((count, skill) => {
        if (!(ranks[skill] ?? 0)) return count
        const row = replacementChoices?.find(choice => choice.skill === skill)
        const saved = row ? !!row.value && row.options.includes(row.value)
          : warmask ? !!c.warmask?.alternateSkill && warmaskAlternateSkills(c, entries, index).includes(c.warmask.alternateSkill)
          : !!feat.choice && !!choices?.includes(feat.choice)
        return count + Number(!saved)
      }, 0)
    }, 0)
    + Number(testSubjectAdaptation(c) === 'Cybernetic Augmentation'
      && [...autoClassSkills(c, entries), ...backgroundSkills(byName(entries, 'background', c.background))].includes('Computers'))
    + (rogueRackets(c, entries).includes('Avenger') ? tokens(byName(entries, 'deity', c.deity)?.data.skill)
      .filter(skill => [...classSkills(byName(entries, 'class', c.className)).fixed,
        ...backgroundSkills(byName(entries, 'background', c.background))].includes(skill)).length : 0)
    + (() => {
      const klass = classSkills(byName(entries, 'class', c.className))
      const prior = new Set([...klass.fixed, ...(c.classSkill && klass.choices.includes(c.classSkill) ? [c.classSkill] : []),
        ...backgroundSkills(byName(entries, 'background', c.background))])
      return subclassSkillGrants(c, entries).reduce((count, skill) => {
        const duplicate = prior.has(skill)
        prior.add(skill)
        return count + Number(duplicate)
      }, 0)
    })()

function trainedSkillFeatBonus(c: Character, entries: ContentEntry[]) {
  return c.feats.reduce((total, selected) => {
    if (featTakenLevel(selected) > c.level) return total
    if (selected.name === 'Skill Download') return total
    if (selected.name === 'Natural Skill') return total + 2
    if (selected.name === 'Experienced Laborer' && c.systems.includes('sf2e')) return total + 1
    if (selected.name === "Officer's Education") return total + (activeFeatsNamed(c, selected.name).slice(0, 2).includes(selected) ? 2 : 0)
    if (selected.name === 'Ancestral Longevity') return total + 1
    const feat = selectedFeatEntry(c, entries, selected.name, selected.sourceId)
    const text = `${feat?.description ?? ''} ${String(feat?.data.skill ?? '')}`
    const grant = /(?:trained|become trained)\s+in\s+(one|two|three|four|1|2|3|4)\s+(?:additional\s+)?skills?\s+of\s+your\s+choice/i.exec(text)
    if (!grant) return total
    const counts: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, '1': 1, '2': 2, '3': 3, '4': 4 }
    return total + counts[grant[1].toLowerCase()]
  }, 0)
}

function baseSkillRankBudget(c: Character, entries: ContentEntry[]) {
  c = normalizeLaborerSkills(normalizeLongevitySkills(c))
  let effectivePicks = [...(c.skillPicks ?? [])]
  let currentRanks = effectivePicks.length ? ranksAt({ ...c, skillPicks: effectivePicks }, entries, 99, false) : {}
  for (const skill of c.skillPicks ?? []) {
    const candidate = effectivePicks.filter((_, i) => i !== effectivePicks.indexOf(skill))
    const candidateRanks = ranksAt({ ...c, skillPicks: candidate }, entries, 99, false)
    if (Object.entries(currentRanks).every(([name, rank]) => (candidateRanks[name] ?? 0) >= rank)) {
      effectivePicks = candidate
      currentRanks = candidateRanks
    }
  }
  const remaining = { trained: Math.max(0, additionalSkillCount(c, entries) - effectivePicks.length), expert: 0, master: 0, legendary: 0 }
  for (const token of skillIncreaseTokens(c, entries)) {
    const skill = c.skillIncreases?.[token.key]
    if (!skill || token.skills && !token.skills.includes(skill)) remaining[(['trained', 'expert', 'master', 'legendary'] as const)[token.rank - 1]]++
  }
  return remaining
}

type SkillTokenUpgrade = NonNullable<Character['skillTokenUpgrades']>[number]
interface SkillToken {
  key: string
  rank: number
  skills?: string[]
}

function skillIncreaseTokens(c: Character, entries: ContentEntry[]): SkillToken[] {
  return [
    ...(longevityExpertLevel(c) !== undefined ? [{ key: LONGEVITY_EXPERT_SLOT, rank: 2 }] : []),
    ...officerEducationSlots(c).map(slot => ({ key: slot.key, rank: 2 })),
    ...signiferExpertSlots(c).map(slot => ({ key: slot.key, rank: 2, skills: slot.skills })),
    ...mechanicIngenuitySlots(c).map(slot => ({ key: slot.key, rank: rankCap(slot.level), skills: ['Computers', 'Crafting'] })),
    ...backgroundLoreIncreaseSlots(c, entries).map(slot => ({ ...slot, rank: rankCap(slot.level) })),
    ...skillIncreaseLevels(c).map(level => ({ key: String(level), rank: rankCap(level) })),
  ]
}

function unusedSkillTokens(c: Character, entries: ContentEntry[]) {
  const tokens: SkillToken[] = Array.from({ length: baseSkillRankBudget(c, entries).trained },
    (_, index) => ({ key: `trained:${index}`, rank: 1 }))
  tokens.push(...skillIncreaseTokens(c, entries).filter(token => !c.skillIncreases?.[token.key]
    || token.skills && !token.skills.includes(c.skillIncreases[token.key])))
  return tokens
}

function takeSkillToken(tokens: SkillToken[], rank: number): string[] | undefined {
  const index = tokens.reduce((best, token, index) => token.rank >= rank
    && (best < 0 || token.rank < tokens[best].rank) ? index : best, -1)
  if (index >= 0) return [tokens.splice(index, 1)[0].key]
  if (rank <= 1) return undefined
  const first = takeSkillToken(tokens, rank - 1)
  const second = first && takeSkillToken(tokens, rank - 1)
  return first && second ? [...first, ...second] : undefined
}

export function normalizeGrantedSkillSpending(c: Character, entries: ContentEntry[]): Character {
  const spending = [...Object.values(c.skillIncreases ?? {}), ...(c.skillTokenUpgrades ?? []).map(purchase => purchase.skill)]
  if (!spending.length) return c
  const free = ranksAt({ ...c, skillIncreases: {}, rankOverrides: undefined, skillTokenUpgrades: undefined }, entries)
  const skills = [...new Set(spending.filter(skill => (free[skill] ?? 0) >= 2))]
  if (!skills.length) return c
  const historical = getSettings().planSkillPrerequisites ? [] : c.feats.flatMap(feat => {
    const level = featTakenLevel(feat)
    if (level > c.level) return []
    const source = selectedFeatEntry(c, entries, feat.name, feat.sourceId)
    return [...String(source?.data.prerequisite ?? '').matchAll(/\b(trained|expert|master|legendary)\s+(?:in|with)\s+([^.;]+)/gi)]
      .flatMap(match => skills.filter(skill => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(match[2]))
        .map(skill => ({ level, skill, rank: RANKS.findIndex(rank => rank.toLowerCase() === match[1].toLowerCase()) })))
  })
  const spendingState = (character: Character) => character.skillTokenUpgrades?.length
    ? calculateSkillTokenState(character, entries) : { ranks: ranksAt(character, entries), active: [] }
  let next = c
  let state = spendingState(c)
  const accept = (candidate: Character, removed?: SkillTokenUpgrade) => {
    const after = spendingState(candidate)
    if (Object.entries(state.ranks).some(([skill, rank]) => (after.ranks[skill] ?? 0) < rank)
      || state.active.some(item => item.purchase !== removed && !after.active.some(other => other.purchase === item.purchase))) return
    for (const requirement of historical) {
      const before = spendingState({ ...next, level: requirement.level }).ranks[requirement.skill] ?? 0
      if (before >= requirement.rank
        && (spendingState({ ...candidate, level: requirement.level }).ranks[requirement.skill] ?? 0) < requirement.rank) return
    }
    next = candidate
    state = after
  }
  for (const purchase of c.skillTokenUpgrades ?? []) {
    if ((free[purchase.skill] ?? 0) >= purchase.rank && state.active.some(item => item.purchase === purchase)) {
      accept({ ...next, skillTokenUpgrades: next.skillTokenUpgrades?.filter(item => item !== purchase) }, purchase)
    }
  }
  for (const token of skillIncreaseTokens(c, entries)) {
    const skill = next.skillIncreases?.[token.key]
    if (!skill || !skills.includes(skill)) continue
    const skillIncreases = { ...next.skillIncreases }
    delete skillIncreases[token.key]
    accept({ ...next, skillIncreases })
  }
  return next
}

export function skillTokenState(c: Character, entries: ContentEntry[]) {
  return calculateSkillTokenState(normalizeGrantedSkillSpending(c, entries), entries)
}

function calculateSkillTokenState(c: Character, entries: ContentEntry[]) {
  const raw = { ...c, skillTokenUpgrades: undefined }
  const ranks = ranksAt(raw, entries)
  const available = unusedSkillTokens(raw, entries)
  const active: { purchase: SkillTokenUpgrade; index: number }[] = []
  const inactive: { purchase: SkillTokenUpgrade; index: number; reason: string }[] = []
  const used = new Set<string>()
  const names = new Set(statDefs(c).filter(stat => stat.kind === 'skill').map(stat => stat.name))
  const enabled = getSettings().skillTokenConversion
  for (const { purchase, index } of (c.skillTokenUpgrades ?? []).map((purchase, index) => ({ purchase, index }))
    .sort((a, b) => a.purchase.level - b.purchase.level || a.purchase.rank - b.purchase.rank)) {
    let reason = !enabled ? 'House rule disabled; purchase preserved.'
      : !Number.isInteger(purchase.level) || purchase.level < 1 || ![2, 3, 4].includes(purchase.rank)
        ? 'Invalid purchase level or rank.'
        : purchase.level > c.level ? `Available at level ${purchase.level}.`
          : purchase.level < (purchase.rank === 4 ? 15 : purchase.rank === 3 ? 7 : 3)
            ? 'Purchase is below the minimum proficiency level.'
            : !names.has(purchase.skill) && !/^.+ lore$/i.test(purchase.skill)
              ? 'Only skills and Lore can be upgraded.' : ''
    const atLevel = { ...raw, level: Math.min(c.level, purchase.level) }
    if (!reason) {
      const prior = Math.max(ranksAt(atLevel, entries)[purchase.skill] ?? 0,
        ...active.filter(item => item.purchase.skill === purchase.skill).map(item => item.purchase.rank))
      if (prior < purchase.rank - 1) reason = `Requires ${RANKS[purchase.rank - 1]} ${purchase.skill} first.`
    }
    const sources = !reason ? unusedSkillTokens(atLevel, entries).filter(token =>
      !used.has(token.key) && (!token.skills || token.skills.includes(purchase.skill))) : []
    const payment = !reason && new Set(purchase.payment).size === purchase.payment.length
      ? takeSkillToken(sources.filter(token => purchase.payment.includes(token.key)), purchase.rank) : undefined
    if (!reason && (!payment || payment.length !== purchase.payment.length)) reason = 'Payment unavailable; refund or restore its unused skill choices.'
    if (reason) inactive.push({ purchase, index, reason })
    else {
      purchase.payment.forEach(key => used.add(key))
      active.push({ purchase, index })
      ranks[purchase.skill] = Math.max(ranks[purchase.skill] ?? 0, purchase.rank)
    }
  }
  return { active, inactive, used, ranks, available: available.filter(token => !used.has(token.key)) }
}

export function skillTokenPurchase(c: Character, entries: ContentEntry[], skill: string, target: number,
  convertOnly = false, state = skillTokenState(c, entries)) {
  c = normalizeGrantedSkillSpending(c, entries)
  if (!getSettings().skillTokenConversion || !Number.isInteger(target)
    || target < 2 || target > (c.level >= 15 ? 4 : c.level >= 7 ? 3 : c.level >= 3 ? 2 : 1)) return undefined
  const current = state.ranks[skill] ?? 0
  if (current < 1 || target <= current || !statDefs(c).some(stat => stat.kind === 'skill' && stat.name === skill)
    && !/^.+ lore$/i.test(skill)) return undefined
  const available = state.available.filter(token => !token.skills || token.skills.includes(skill))
  const purchases: SkillTokenUpgrade[] = []
  for (const rank of [2, 3, 4] as const) {
    if (rank <= current || rank > target) continue
    const eligible = available.filter(token => !convertOnly || token.rank < rank)
    const payment = takeSkillToken(eligible, rank)
    if (!payment) return undefined
    for (const key of payment) available.splice(available.findIndex(token => token.key === key), 1)
    purchases.push({ skill, rank, level: c.level, payment })
  }
  return [...c.skillTokenUpgrades ?? [], ...purchases]
}

export function skillTokenPayment(payment: string[], c: Character, entries: ContentEntry[]) {
  const sources = unusedSkillTokens({ ...c, skillTokenUpgrades: undefined }, entries)
  return [1, 2, 3, 4].flatMap(rank => {
    const count = payment.filter(key => sources.some(token => token.key === key && token.rank === rank)).length
    return count ? [`${count} ${RANKS[rank]}`] : []
  }).join(' + ')
}

export function skillRankBudget(c: Character, entries: ContentEntry[]) {
  c = normalizeGrantedSkillSpending(c, entries)
  const raw = { ...c, skillTokenUpgrades: undefined }
  const remaining = baseSkillRankBudget(raw, entries)
  if (!getSettings().skillTokenConversion || !c.skillTokenUpgrades?.length) return remaining
  const state = skillTokenState(c, entries)
  for (const token of unusedSkillTokens(raw, entries)) {
    if (state.used.has(token.key)) remaining[(['trained', 'expert', 'master', 'legendary'] as const)[token.rank - 1]]--
  }
  return remaining
}

export function skillRankAllocations(c: Character, entries: ContentEntry[]) {
  c = normalizeGrantedSkillSpending(normalizeConditionalSkillChoices(normalizeLongevitySkills(c), entries), entries)
  const keys = ['trained', 'expert', 'master', 'legendary'] as const
  const remaining = skillRankBudget(c, entries)
  const total = { trained: additionalSkillCount(c, entries), expert: 0, master: 0, legendary: 0 }
  const backgroundTraining = backgroundSkillSlots(c, entries)
  total.trained += backgroundTraining.length
  remaining.trained += backgroundTraining.filter(slot => !slot.value).length
  const erudite = eruditeWarrior(c)
  if (erudite) {
    total.trained++
    remaining.trained += Number(!erudite.lore)
  }
  for (const token of skillIncreaseTokens(c, entries)) total[keys[token.rank - 1]]++
  if (activeFeatsNamed(c, 'Skill Download').length) {
    const key = keys[c.level >= 17 ? 2 : c.level >= 9 ? 1 : 0]
    total[key]++
    if (!skillDownload(c, entries)) remaining[key]++
  }
  return keys.map((key, index) => ({ rank: RANKS[index + 1], used: Math.max(0, total[key] - remaining[key]), total: total[key] }))
}

const eligibleSourceCache = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()
function skillRequirementSources(c: Character, entries: ContentEntry[]) {
  const cache = eligibleSourceCache.get(entries) ?? new Map<string, ContentEntry[]>()
  eligibleSourceCache.set(entries, cache)
  const { updatedAt: _u, equipment: _e, armors: _a, weapons: _w, spentFocusPoints: _f, innateSpellUses: _i, itemSpellUses: _s, ...stable } = c
  const { feats: _feats, entryIds: _ids, ...withoutFeats } = stable
  const sources = new Map<string, ContentEntry>()
  for (const category of ['class', 'ancestry', 'archetype'] as const) {
    const key = JSON.stringify([category, category === 'archetype' ? stable : withoutFeats])
    let found = cache.get(key)
    if (!found) {
      found = eligibleFeats(entries, c, { category, level: c.level, key: `${category}:${c.level}:skill-requirements` },
        { includeUnmetPrerequisites: true })
      if (cache.size >= 8) cache.delete(cache.keys().next().value!)
      cache.set(key, found)
    }
    for (const source of found) sources.set(source.id, source)
  }
  return [...sources.values()]
}

export function skillRankRequirements(c: Character, entries: ContentEntry[], skills: string[]) {
  const result = new Map<string, Map<number, string[]>>()
  if (!skills.length) return result
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const skillPattern = new RegExp(`\\b(?:${[...skills].sort((a, b) => b.length - a.length).map(escape).join('|')})\\b`, 'gi')
  const sources = new Map<string, ContentEntry>(skillRequirementSources(c, entries).map(source => [source.id, source]))
  for (const feat of c.feats.filter(feat => featTakenLevel(feat) <= c.level)) {
    const category = feat.slot?.split(':')[0] ?? feat.type.replace(/ Feat$/, '').toLowerCase()
    if (!['class', 'ancestry', 'archetype'].includes(category) || /\bdedication$/i.test(feat.name)) continue
    const selectedSources = featPrerequisiteSources(entries, { ...c, name: feat.name,
      entryIds: feat.sourceId ? [feat.sourceId] : c.entryIds, ancestryTraits: ancestryFeatTraits(c),
      category })
    for (const source of selectedSources) sources.set(source.id, source)
  }
  for (const source of sources.values()) {
    if (source.traits.some(trait => /^(?:skill|general|dedication)$/i.test(trait)) || /\bdedication$/i.test(source.name)) continue
    const text = String(source.data.prerequisite ?? '')
    const clauses = text.matchAll(/\b(trained|expert|master|legendary)\s+(?:in|with)\s+([\s\S]*?)(?=\b(?:untrained|trained|expert|master|legendary)\s+(?:in|with)\s+|$)/gi)
    for (const clause of clauses) {
      const rank = RANKS.findIndex(rank => rank.toLowerCase() === clause[1].toLowerCase())
      for (const match of clause[2].matchAll(skillPattern)) {
        const skill = skills.find(skill => skill.toLowerCase() === match[0].toLowerCase())!
        const ranks = result.get(skill) ?? new Map<number, string[]>()
        const notes = ranks.get(rank) ?? []
        const note = `${source.name}: ${text}`
        if (!notes.includes(note)) notes.push(note)
        ranks.set(rank, notes)
        result.set(skill, ranks)
      }
    }
  }
  return result
}

// ---------- Spells ----------

export const SPELL_TRADITIONS = ['Arcane', 'Divine', 'Occult', 'Primal']

// SF2e lists every grade of a base item ("Advanced Armored Coat", "Azimuth Laser Pistol, Tactical"); keep the bases
const GRADES = ['commercial', 'tactical', 'advanced', 'superior', 'elite', 'ultimate', 'paragon']
const normalName = (n: string) => n.toLowerCase().replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
export function baseItems(items: ContentEntry[]) {
  const names = new Set(items.map((e) => normalName(e.name)))
  return items.filter((e) => {
    const words = normalName(e.name).split(' ')
    const stripped = words.filter((w) => !GRADES.includes(w)).join(' ')
    return stripped === words.join(' ') || !stripped || !names.has(stripped)
  })
}

export function gearPickerEntries(entries: ContentEntry[], kind: 'weapon' | 'armor' | 'shield') {
  const seen = new Set<string>()
  // Saved gear resolves by name; picker Access and source must use that same first record.
  const pool = baseItems([...entries.filter(entry => entry.kind === kind && !entry.deleted && !entry.data.retired),
    ...(kind === 'armor' ? namedArmorEntries(entries) : kind === 'shield' ? [makeNamedShieldEntry(entries, 'Scale of Igroon')].filter((entry): entry is ContentEntry => !!entry) : []),
    ...(kind === 'weapon' ? [...hammerMultipistolEntries(entries),
      ...namedWeaponEntries(entries).filter(entry => !entry.data.named_weapon_resolver_only)] : [])])
  return pool.map(entry => kind === 'weapon' && entry.name === 'Shobhad Longrifle' && entry.source === 'official'
    ? { ...entry, name: `Shobhad Longrifle (${entry.systems.includes('sf2e') ? 'Starfinder' : 'Pathfinder'})` } : entry).filter(entry => {
    if (seen.has(entry.name)) return false
    seen.add(entry.name)
    return true
  })
}

const combinationCache = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()
export function combinationForms(entries: ContentEntry[], name: string) {
  let index = combinationCache.get(entries)
  if (!index) {
    index = new Map()
    const groups = new Map<string, ContentEntry[]>()
    for (const entry of [...entries, ...hammerMultipistolEntries(entries), ...namedWeaponEntries(entries)]) {
      if (entry.kind !== 'weapon' || entry.deleted || !entry.traits.some(trait => trait.toLowerCase() === 'combination')) continue
      const match = /^(.*?) \((Melee|Ranged)\)$/.exec(entry.name)
      const url = String(entry.data.url ?? '')
      if (!match || !url) continue
      const key = `${match[1]}\0${url}\0${[...entry.systems].sort().join(',')}`
      const group = groups.get(key) ?? []
      group.push(entry)
      groups.set(key, group)
    }
    for (const group of groups.values()) {
      const melee = group.find(entry => entry.name.endsWith('(Melee)'))
      const ranged = group.find(entry => entry.name.endsWith('(Ranged)'))
      if (melee && ranged) {
        for (const entry of [melee, ranged]) if (!index.has(entry.name)) index.set(entry.name, [melee, ranged])
        if (melee.data.named_weapon_source) index.set(String(melee.data.named_weapon_source), [melee, ranged])
      }
    }
    combinationCache.set(entries, index)
  }
  return index.get(name) ?? []
}

export function combinationName(entries: ContentEntry[], name: string) {
  return combinationForms(entries, name).length ? name.replace(/ \((?:Melee|Ranged)\)$/, '') : name
}

// Specific magic weapons/armor (Fractal Hook, ...) are not bases; AoN marks them by trait, subcategory or level above 0
export function isMagicItem(e: ContentEntry) {
  if (e.data.named_armor || e.data.named_shield) return true
  if (e.data.named_weapon) return true
  if (e.source === 'homebrew') return false
  const sub = String(e.data.item_subcategory ?? '')
  if (e.traits.some((t) => t.toLowerCase() === 'magical')) return true
  if (/specific|magic/i.test(sub)) return true
  // Base weapons/armor (Composite Longbow, ...) can carry a level but are still bases
  if (/base/i.test(sub)) return false
  return e.level > 0 && !e.systems.includes('sf2e') && !e.data.weapon_category && !e.data.armor_category
}

// ---------- Languages ----------

const titleCase = (v: string) => v.trim().replace(/\b\w/g, (ch) => ch.toUpperCase())

// [language, who speaks it]
export const LANGUAGE_CATEGORIES: Record<string, [string, string][]> = {
  Common: [
    ['Common', 'Humans, dwarves, elves, halflings, and other common ancestries'], ['Draconic', 'Dragons, reptilian humanoids'],
    ['Dwarven', 'Dwarves'], ['Elven', 'Elves, aiuvarins'], ['Fey', 'Fey, centaurs, plant and fungus creatures'],
    ['Gnomish', 'Gnomes'], ['Goblin', 'Goblins, hobgoblins, bugbears'], ['Halfling', 'Halflings'],
    ['Jotun', 'Giants, ogres, trolls, cyclopes'], ['Orcish', 'Orcs, dromaars'], ['Sakvroth', 'Subterranean civilizations, serpentfolk'],
  ],
  Uncommon: [
    ['Aklo', 'Evil fey, otherworldly monsters'], ['Amurrun', 'Catfolk'], ['Anugobu', 'Anugobu'], ['Aquan', 'Water elementals'],
    ['Auran', 'Air elementals'], ['Chthonian', 'Demons'], ['Diabolic', 'Devils'], ['Empyrean', 'Angels and other celestials'],
    ['Ignan', 'Fire elementals'], ['Iruxi', 'Lizardfolk'], ['Kholo', 'The hyena-like kholos'], ['Kitsune', 'Kitsune'],
    ['Muan', 'Wood elemental creatures'], ['Nagaji', 'Nagaji'], ['Necril', 'Ghouls, intelligent undead'], ['Petran', 'Metal elementals'],
    ['Shadowtongue', 'Nidalese, shadow creatures'], ['Terran', 'Earth elementals'],
  ],
  Secret: [['Wildsong', 'Druids']],
  Rare: [
    ['Anadi', 'Anadi'], ['Androffan', 'Androids'], ['Goloma', 'Goloma'], ['Grioth', 'Grioth'], ['Kovintal', 'Kovintus'],
    ['Mi-Go', 'Mi-Go'], ['Munavri', 'Munavri'], ['Rasu', 'Conrasu'], ['Samsaran', 'Samsaran'], ['Sasquatch', 'Sasquatch'],
    ['Shae', 'Shae'], ['Shisk', 'Shisk'], ['Shoony', 'Shoony'], ['Strix', 'Strix'], ['Surki', 'Surki'], ['Vanara', 'Vanara'],
    ['Vishkanyan', 'Vishkanya'], ['Yithian', 'Yithian'],
  ],
}
const RARITY_ORDER = ['Common', 'Uncommon', 'Secret', 'Rare']

// Languages synced from AoN, grouped by rarity; the built-in list is the fallback until content has loaded
export function languageGroups(entries: ContentEntry[]): Record<string, [string, string][]> {
  const synced = entries.filter((e) => e.kind === 'language')
  if (!synced.length) return Object.fromEntries(Object.entries(LANGUAGE_CATEGORIES).sort(([a], [b]) => a.localeCompare(b)))
  const groups: Record<string, [string, string][]> = {}
  const seen = new Set<string>()
  for (const e of synced) {
    const key = e.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const listed = titleCase(String(e.data.rarity || e.traits.find((t) => RARITY_ORDER.includes(titleCase(t))) || 'Common'))
    // Wildsong is the only secret language; AoN's other "secret"-flagged ones are rare
    const rarity = key === 'wildsong' ? 'Secret' : listed === 'Secret' ? 'Rare' : listed
    const who = e.description.replace(/\.$/, '')
    ;(groups[rarity] ??= []).push([e.name, who])
  }
  for (const list of Object.values(groups)) list.sort((a, b) => a[0].localeCompare(b[0]))
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)))
}
const allLanguages = (entries: ContentEntry[]) => Object.values(languageGroups(entries)).flat().map(([name]) => name)
// Languages a class always teaches
const CLASS_LANGUAGES: Record<string, string[]> = { Druid: ['Wildsong'] }

export function migrateAncestralLinguistics(c: Character): Partial<Character> | undefined {
  const legacy = activeFeatsNamed(c, 'Ancestral Linguistics').filter(feat => feat.choice?.trim())
  if (!legacy.length) return undefined
  const languages = [...new Map([...c.languages, ...legacy.map(feat => feat.choice!.trim())]
    .map(language => [language.toLowerCase(), language])).values()]
  return { languages, feats: c.feats.map(feat => legacy.includes(feat) ? { ...feat, choice: undefined } : feat) }
}

// Fixed languages (Common, ancestry, class) plus how many more the character may pick
export function languageAllowance(c: Character, entries: ContentEntry[]) {
  const ancestry = byName(entries, 'ancestry', c.ancestry)
  const known = new Set(allLanguages(entries).map((l) => l.toLowerCase()))
  const fromAncestry = tokens(ancestry?.data.language).map(titleCase).filter((l) => known.has(l.toLowerCase()))
  const featGrants = c.feats.flatMap((f) => tokens(selectedFeatEntry(c, entries, f.name, f.sourceId)?.data.grants_languages).map((l) => ({ lang: titleCase(l), source: f.name })))
    .filter((g) => known.has(g.lang.toLowerCase()))
  const fromFeats = featGrants.map((g) => g.lang)
  const sources: Record<string, string> = Object.fromEntries([
    ...fromAncestry.map((l) => [l.toLowerCase(), `${c.ancestry} Ancestry`]),
    ...(c.className ? CLASS_LANGUAGES[c.className] ?? [] : []).map((l) => [l.toLowerCase(), `${c.className} Class`]),
    ...featGrants.map((g) => [g.lang.toLowerCase(), g.source]),
  ])
  const locked = [...new Set(['Common', ...fromAncestry, ...(c.className ? CLASS_LANGUAGES[c.className] ?? [] : []), ...fromFeats])]
  const society = ranksAt(c, entries).Society ?? 0
  const prodigy = !!activeFeatsNamed(c, 'Linguistic Prodigy').length
  const feats = (prodigy ? 2 : 0) + activeFeatsNamed(c, 'Multilingual').length
    * (2 + (society >= 3 ? 1 : 0) + (society >= 4 ? 1 : 0) + (prodigy ? 1 : 0))
  const commonOnlySlots = officerEducationSlots(c).length
  return { locked, sources, commonOnlySlots, slots: 1 + Math.max(0, abilityMod(c.abilities.int)) + feats
    + activeFeatsNamed(c, 'Ancestral Linguistics').length + commonOnlySlots }
}
