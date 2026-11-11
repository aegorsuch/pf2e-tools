import type { Character, ContentEntry, FeatSlot, FeatSlotCategory } from './types'
import { canSelectWardenFeat } from './featChoices'

export type Ability = keyof Character['abilities']
export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export const ABILITY_LABEL: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

export const abilityMod = (score: number) => Math.floor((score - 10) / 2)
export const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

const num = (v: unknown) => (typeof v === 'number' ? v : Number.isFinite(parseFloat(String(v))) ? parseFloat(String(v)) : 0)

const byName = (entries: ContentEntry[], kind: ContentEntry['kind'], name?: string) =>
  name ? entries.find((e) => e.kind === kind && e.name === name) : undefined

// Level 1 HP = ancestry HP + class HP + Con; each later level adds class HP + Con
export function maxHp(c: Character, entries: ContentEntry[]) {
  const ancestry = num(byName(entries, 'ancestry', c.ancestry)?.data.hp)
  const cls = num(byName(entries, 'class', c.className)?.data.hp)
  return ancestry + (cls + abilityMod(c.abilities.con)) * c.level
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function ancestryLabel(ancestry?: string, heritage?: string) {
  if (!ancestry) return heritage ?? ''
  if (!heritage) return ancestry
  const includesAncestry = `-${slug(heritage)}-`.includes(`-${slug(ancestry)}-`)
  return includesAncestry ? heritage : `${heritage} ${ancestry}`
}

// Heritages link to an ancestry only on SF2e; elsewhere every heritage is offered.
export function heritagesFor(entries: ContentEntry[], ancestry?: string) {
  const all = entries.filter((e) => e.kind === 'heritage')
  const target = ancestry ? slug(ancestry) : ''
  const linked = all.filter((e) => e.data.ancestry === target)
  return linked.length ? linked : all.filter((e) => !e.data.ancestry)
}

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

export interface PlannedSlot { key: string; category: FeatSlotCategory; level: number }

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

export function plannedSlots(c: Character): PlannedSlot[] {
  const base: FeatSlot[] = [
    ...SLOT_RULES.flatMap((r) => r.levels.map((level) => ({ category: r.category, level, count: 1 }))),
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
  return slots.sort((a, b) => a.level - b.level
    || (groupOrder.get(`${a.category}:${a.level}`) ?? 0) - (groupOrder.get(`${b.category}:${b.level}`) ?? 0))
}

export function eligibleFeats(entries: ContentEntry[], c: Character, slot: PlannedSlot) {
  const wanted: Partial<Record<FeatSlotCategory, string | undefined>> = {
    class: c.className, ancestry: c.ancestry, skill: 'skill', general: 'general', archetype: 'archetype',
  }
  const trait = wanted[slot.category]?.toLowerCase()
  if (slot.category !== 'bonus' && !trait) return []
  const taken = new Set(c.feats.filter((f) => f.slot !== slot.key).map((f) => f.name))
  return entries
    .filter((e) => e.kind === 'feat' && e.level <= slot.level
      && (!taken.has(e.name) || e.data.repeatable === true && canSelectWardenFeat(e.name, c, entries, slot.key)))
    .filter((e) => !trait || e.traits.some((t) => t.toLowerCase() === trait))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

// ---------- Class features ----------

// Covered by the boost, slot and skill planners rather than listed as features
const PLANNER_FEATURE = /^(ancestry and background|attribute boosts|skill increases|(.+ )?feats?)$/i

// Features the class grants automatically up to the character's level
export function classFeatures(entries: ContentEntry[], c: Character) {
  if (!c.className) return []
  const seen = new Set<string>()
  return entries
    .filter((e) => e.kind === 'classFeature' && e.data.class === c.className && e.level <= c.level && !PLANNER_FEATURE.test(e.name))
    .filter((e) => !seen.has(`${e.level}:${e.name}`) && seen.add(`${e.level}:${e.name}`))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

export function classSpellcasting(c: Character, entries: ContentEntry[]) {
  const klass = byName(entries, 'class', c.className)
  const traditions = tokens(klass?.data.tradition)
  if (!traditions.length) return undefined

  const progression: Record<string, number> = {
    'expert spellcaster': 2,
    'expert spellcasting': 2,
    'master spellcaster': 3,
    'master spellcasting': 3,
    'legendary spellcaster': 4,
    'legendary spellcasting': 4,
  }
  const rank = classFeatures(entries, c).reduce((best, feature) =>
    Math.max(best, progression[feature.name.toLowerCase()] ?? 0), 1)
  return { traditions, rank }
}

const FEATURE_RANK: Record<string, number> = { expertise: 2, mastery: 3, legend: 4 }

// "Reflex Expertise", "Perception Mastery" and similar raise that statistic's rank
export function featureRanks(features: ContentEntry[]) {
  const ranks: Record<string, number> = {}
  for (const f of features) {
    const m = /^(Perception|Fortitude|Reflex|Will) (Expertise|Mastery|Legend)$/i.exec(f.name)
    if (!m) continue
    const stat = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
    ranks[stat] = Math.max(ranks[stat] ?? 0, FEATURE_RANK[m[2].toLowerCase()])
  }
  return ranks
}

// ---------- Skills & proficiencies ----------

export const RANKS = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary']

export interface StatDef { name: string; ability: Ability; kind: 'skill' | 'save' | 'perception' }

export function statDefs(c: Character): StatDef[] {
  const skills: [string, Ability][] = [
    ['Acrobatics', 'dex'], ['Arcana', 'int'], ['Athletics', 'str'], ['Crafting', 'int'], ['Deception', 'cha'],
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
    const m = /^trained in (?!a number|one or more|your choice)(.+)$/i.exec(l)
    return m ? m[1].split(/,| and /).map((s) => s.trim()).filter(Boolean) : []
  })
  const extra = lines.map((l) => /additional skills? equal to (\d+)/i.exec(l)).find(Boolean)
  return { fixed, additional: extra ? +extra[1] : 0 }
}

// skill_proficiency is stored joined with ", "; the sentences themselves contain no other commas we rely on
const tokensLoose = (v: unknown) => (typeof v === 'string' ? v.split(/,\s(?=Trained)/i).map((t) => t.trim()) : [])

export const backgroundSkills = (bg?: ContentEntry) => tokens(bg?.data.skill)

export const skillIncreaseLevels = (c: Character) => range(3, 19, 2).filter((l) => l <= c.level)
const rankCap = (level: number) => (level >= 15 ? 4 : level >= 7 ? 3 : 2)
export const canIncreaseTo = (level: number, currentRank: number) => currentRank < rankCap(level)

function baseRanks(c: Character, entries: ContentEntry[]) {
  const klass = byName(entries, 'class', c.className)
  const ranks: Record<string, number> = {}
  const bump = (n: string) => { ranks[n] = Math.max(ranks[n] ?? 0, 1) }
  classSkills(klass).fixed.forEach(bump)
  backgroundSkills(byName(entries, 'background', c.background)).forEach(bump)
  c.skillPicks?.forEach(bump)
  c.lores.forEach((l) => { ranks[l.name] = Math.max(ranks[l.name] ?? 0, l.rank) })
  ranks.Perception = rankFromText(klass?.data.perception_proficiency)
  ranks.Fortitude = rankFromText(klass?.data.fortitude_proficiency)
  ranks.Reflex = rankFromText(klass?.data.reflex_proficiency)
  ranks.Will = rankFromText(klass?.data.will_proficiency)
  for (const [stat, rank] of Object.entries(featureRanks(classFeatures(entries, c)))) ranks[stat] = Math.max(ranks[stat] ?? 0, rank)
  return ranks
}

// Ranks from class/background/picks plus skill increases below `beforeLevel`; legacy overrides apply only to skills.
export function ranksAt(c: Character, entries: ContentEntry[], beforeLevel = 99, withOverrides = true) {
  const ranks = baseRanks(c, entries)
  for (const l of skillIncreaseLevels(c).filter((x) => x < beforeLevel)) {
    const skill = c.skillIncreases?.[l]
    if (skill) ranks[skill] = Math.min(4, (ranks[skill] ?? 0) + 1)
  }
  if (withOverrides) {
    const skillNames = new Set(statDefs(c).filter((stat) => stat.kind === 'skill').map((stat) => stat.name))
    for (const [name, rank] of Object.entries(c.rankOverrides ?? {})) {
      if (skillNames.has(name)) ranks[name] = rank
    }
  }
  for (const name of [
    ...classSkills(byName(entries, 'class', c.className)).fixed,
    ...backgroundSkills(byName(entries, 'background', c.background)),
  ]) ranks[name] = Math.max(1, ranks[name] ?? 0)
  return ranks
}

export const proficiencyBonus = (rank: number, level: number) => (rank > 0 ? level + rank * 2 : 0)

export const additionalSkillCount = (c: Character, entries: ContentEntry[]) =>
  Math.max(0, classSkills(byName(entries, 'class', c.className)).additional
    + abilityMod(c.abilities.int) + trainedSkillFeatBonus(c, entries))

function trainedSkillFeatBonus(c: Character, entries: ContentEntry[]) {
  return c.feats.reduce((total, selected) => {
    if (selected.name === 'Natural Skill') return total + 2
    const feat = byName(entries, 'feat', selected.name)
    const text = `${feat?.description ?? ''} ${String(feat?.data.skill ?? '')}`
    const grant = /(?:trained|become trained)\s+in\s+(one|two|three|four|1|2|3|4)\s+(?:additional\s+)?skills?\s+of\s+your\s+choice/i.exec(text)
    if (!grant) return total
    const counts: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, '1': 1, '2': 2, '3': 3, '4': 4 }
    return total + counts[grant[1].toLowerCase()]
  }, 0)
}

export function skillRankBudget(c: Character, entries: ContentEntry[]) {
  const picks = c.skillPicks?.length ?? 0
  const remaining = { trained: Math.max(0, additionalSkillCount(c, entries) - picks), expert: 0, master: 0, legendary: 0 }
  for (const level of skillIncreaseLevels(c)) {
    if (c.skillIncreases?.[level]) continue
    const rank = rankCap(level)
    if (rank === 2) remaining.expert++
    else if (rank === 3) remaining.master++
    else remaining.legendary++
  }
  return remaining
}

// ---------- Spells ----------

export const SPELL_TRADITIONS = ['Arcane', 'Divine', 'Occult', 'Primal']
