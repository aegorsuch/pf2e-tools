import type { Character, ContentEntry, FeatSlot, FeatSlotCategory, OwnedArmor, OwnedWeapon } from './types'
import { canSelectWardenFeat, hasWardenChoice, isCompanionSpecialization, wardenSpellOptions } from './featChoices'
import { getSettings } from './settings'
import { createFeatPrerequisiteChecker, type PrerequisiteFacts } from './featPrerequisites'
import { ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS, ANIMAL_FEATURES, ARMOR_GAUNTLETS, FIST, GAUNTLET, HAFT_STRIKER_WEAPON, HANDWRAPS, HARDLIGHT_GRADES, IRON_FIST, ORC_TUSKS, OVERSIZED_THROW, SUPPLEMENTAL_WEAPONS } from './supplemental'

export type Ability = keyof Character['abilities']
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
export function maxHp(c: Character, entries: ContentEntry[]) {
  const ancestry = num(byName(entries, 'ancestry', c.ancestry)?.data.hp)
  const cls = num(byName(entries, 'class', c.className)?.data.hp)
  const toughness = c.feats.some((feat) => feat.name.toLowerCase() === 'toughness') ? c.level : 0
  return ancestry + (cls + abilityMod(c.abilities.con)) * c.level + toughness
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

// A heritage belongs to an ancestry via its ancestry field (SF2e id or AoN field) or ancestry trait;
// heritages naming no ancestry (versatile ones) are offered to everyone. Both systems' heritages are merged.
export function heritagesFor(entries: ContentEntry[], ancestry?: string) {
  const all = entries.filter((e) => e.kind === 'heritage')
  if (!ancestry) return all
  const target = slug(ancestry)
  const names = new Set(entries.filter((e) => e.kind === 'ancestry').map((e) => slug(e.name)))
  return all.filter((e) => {
    const linked = e.data.ancestry ? slug(String(e.data.ancestry)) : ''
    if (linked) return linked === target
    const tagged = e.traits.map(slug).filter((t) => names.has(t))
    return tagged.length === 0 || tagged.includes(target)
  })
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

export interface PlannedSlot { key: string; category: FeatSlotCategory; level: number; maxFeatLevel?: number }

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
}

export const featTakenLevel = (feat: Character['feats'][number]) => Number(feat.slot?.split(':')[1]) || feat.level
const activeFeatsNamed = (c: Character, name: string) => c.feats.filter((feat) => feat.name === name && featTakenLevel(feat) <= c.level)
// House rule: Rangers get Snarecrafter Dedication at level 2 in a locked Dedications slot
export const HOMEBREW_DEDICATIONS = [
  { setting: 'rangerSnarecrafter', className: 'Ranger', name: 'Snarecrafter Dedication', slot: 'archetype:2:g99' },
  { setting: 'championCavalier', className: 'Champion', name: 'Cavalier Dedication', slot: 'archetype:2:g98' },
  { setting: 'druidCavalier', className: 'Druid', name: 'Cavalier Dedication', slot: 'archetype:2:g97' },
] as const
export const homebrewDedication = (slot: string) => HOMEBREW_DEDICATIONS.find((d) => d.slot === slot)
export const activeHomebrewDedications = (c: Character) =>
  HOMEBREW_DEDICATIONS.filter((d) => getSettings()[d.setting] && c.className === d.className && c.level >= 2)
export const isGrantedSlot = (key: string) => /:g\d+$/.test(key)

export function plannedSlots(c: Character): PlannedSlot[] {
  const base: FeatSlot[] = [
    ...SLOT_RULES.flatMap((r) => r.levels.map((level) => ({ category: r.category, level, count: 1 }))),
    ...(getSettings().freeArchetype ? [{ category: 'archetype' as const, levels: range(2, 20, 2) }].flatMap((r) => r.levels.map((level) => ({ category: r.category, level, count: level === 2 && activeHomebrewDedications(c).length ? 0 : 1 }))) : []),
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
  Object.entries(GRANTED_SLOTS).forEach(([name, g], i) => {
    const grantingFeat = c.feats.find((f) => f.name === name)
    if (!grantingFeat) return
    const limited = name === 'Advanced General Training' || name === 'Ancestral Paragon'
    const level = limited ? featTakenLevel(grantingFeat) : g.level
    if (level > c.level) return
    const id = `${g.category}:${g.level}`
    const group = `${g.category}:${level}`
    if (!groupOrder.has(group)) groupOrder.set(group, groupOrder.size)
    // Keep saved granted-feat selections attached to their original slot key.
    slots.push({ key: `${id}:g${i}`, category: g.category, level, ...(limited ? { maxFeatLevel: g.level } : {}) })
  })
  for (const d of activeHomebrewDedications(c)) {
    if (!groupOrder.has('archetype:2')) groupOrder.set('archetype:2', groupOrder.size)
    slots.push({ key: d.slot, category: 'archetype', level: 2 })
  }
  const visible = slots.filter((slot) => !c.dismissedFeatSlots?.includes(slot.key) || homebrewDedication(slot.key))
  for (const slot of slots) {
    if (!visible.some((other) => other.category === slot.category && other.level === slot.level)) visible.push(slot)
  }
  return visible.sort((a, b) => a.level - b.level
    || (groupOrder.get(`${a.category}:${a.level}`) ?? 0) - (groupOrder.get(`${b.category}:${b.level}`) ?? 0))
}

const archetypesOf = (e?: ContentEntry): string[] => {
  const a = e?.data.archetype
  return (Array.isArray(a) ? a : typeof a === 'string' ? a.split(',') : [])
    .flatMap((name) => typeof name === 'string' && name.trim() ? [name.trim()] : [])
}
const isDedication = (e?: ContentEntry) => !!e?.traits.some((t) => t.toLowerCase() === 'dedication')

// Archetype rules: other archetype feats need that archetype's Dedication, and a new Dedication needs
// two other feats from every Dedication already taken
function archetypeRule(c: Character, entries: ContentEntry[], slotKey: string, asArchetype: boolean) {
  const taken = c.feats.filter((f) => f.slot !== slotKey).flatMap((f) => {
    const entry = byName(entries, 'feat', f.name)
    return entry && archetypesOf(entry).length ? [entry] : []
  })
  const dedications = taken.filter(isDedication)
  return (e: ContentEntry) => {
    const archetypes = archetypesOf(e)
    if (!archetypes.length || !asArchetype && !e.traits.some((t) => t.toLowerCase() === 'archetype')) return true
    const shares = (entry: ContentEntry, names = archetypes) => archetypesOf(entry).some((name) => names.includes(name))
    if (!isDedication(e)) return dedications.some((t) => shares(t))
    return dedications.every((d) =>
      shares(d) || taken.filter((t) => !isDedication(t) && shares(t, archetypesOf(d))).length >= 2)
  }
}

// Feats sitting in a slot that no longer exists at the current level (e.g. a Free Archetype slot taken over by a
// house rule). Slots above the character's level are kept so lowering the level is reversible.
export function unslottedFeats(c: Character) {
  const keys = new Set(plannedSlots(c).map((s) => s.key))
  return c.feats.filter((f) => f.slot && !keys.has(f.slot) && Number(f.slot.split(':')[1]) <= c.level)
}

// Archetype feats whose archetype's Dedication isn't taken (e.g. the Dedication was removed or never picked)
export function orphanedArchetypeFeats(c: Character, entries: ContentEntry[]) {
  const info = c.feats.map((f) => ({ f, e: byName(entries, 'feat', f.name) }))
  const dedications = new Set(info.flatMap(({ e }) => e && isDedication(e) ? archetypesOf(e) : []))
  return info.filter(({ f, e }) => e && !isDedication(e) && archetypesOf(e).length
    && (e.traits.some((t) => t.toLowerCase() === 'archetype') || f.slot?.startsWith('archetype:'))
    && !archetypesOf(e).some((name) => dedications.has(name)))
    .map(({ f }) => f)
}

// Feats only, with lowercased traits, cached per entries array so each picker render skips the full scan
const featNameCache = new WeakMap<ContentEntry[], Map<string, ContentEntry>>()
export function featByName(entries: ContentEntry[]) {
  let map = featNameCache.get(entries)
  if (!map) {
    map = new Map()
    for (const e of entries) if (e.kind === 'feat' && !map.has(e.name)) map.set(e.name, e)
    featNameCache.set(entries, map)
  }
  return map
}
const featIndexCache = new WeakMap<ContentEntry[], { entry: ContentEntry; traits: Set<string> }[]>()
function featIndex(entries: ContentEntry[]) {
  let index = featIndexCache.get(entries)
  if (!index) {
    index = entries.filter((e) => e.kind === 'feat').sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)).map((entry) => ({ entry, traits: new Set(entry.traits.map((t) => t.toLowerCase())) }))
    featIndexCache.set(entries, index)
  }
  return index
}

export function featSelectionLevel(entry: ContentEntry, c: Character, entries: ContentEntry[], category: FeatSlotCategory) {
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

const EXCLUSIVE_FEAT_GROUPS = [['Chiardmar Steed', 'Nidarrmar Steed']]

export function featPrerequisiteChecker(c: Character, entries: ContentEntry[], level = c.level, excludedIndex = -1) {
  const facts = new Map<number, PrerequisiteFacts>()
  return createFeatPrerequisiteChecker(entries, {
    level: Math.min(c.level, level), entryIds: c.entryIds, knownOrders: Object.keys(DRUID_ORDERS),
    facts: (atLevel) => {
      const cached = facts.get(atLevel)
      if (cached) return cached
      const character = { ...c, level: Math.min(c.level, atLevel),
        feats: c.feats.filter((feat, index) => index !== excludedIndex && featTakenLevel(feat) <= Math.min(c.level, atLevel)) }
      if (character.boosts) character.abilities = computeAbilities(character, entries)
      const ranks = ranksAt(character, entries)
      const subclass = selectedSubclass(character, entries)
      const additionalSubclasses = character.feats.flatMap((feat) => feat.choice && (
        character.className === 'Bard' && feat.name === 'Multifarious Muse'
        || character.className === 'Inventor' && ['Second Innovation', 'Third Innovation'].includes(feat.name)
      ) ? [feat.choice] : [])
      const museFeats = character.className === 'Bard' ? [subclass, ...additionalSubclasses].flatMap((name) => {
        const muse = entries.find((entry) => entry.kind === 'subclass' && entry.data.class === 'Bard' && entry.name === name)
        const feat = /\bMuse Feat\s+(.+?)(?:\s+Muse Spell|$)/i.exec(muse?.description ?? '')?.[1].trim()
        return feat ? [feat] : []
      }) : []
      const features = classFeatures(entries, character)
      const focus = focusSpells(character, entries)
      const hasFocusPool = focus.points > 0 || features.some((feature) => /\byou (?:start with|gain) a focus pool\b/i.test(feature.description))
      const casting = !!classSpellcasting(character, entries)?.traditions.length
      const value: PrerequisiteFacts = {
        className: character.className, ancestry: character.ancestry, heritage: character.heritage,
        ancestryTraits: ancestryFeatTraits(character),
        subclass, additionalSubclasses,
        orders: character.className === 'Druid' ? [
          character.order ?? subclass ?? '',
          ...character.feats.flatMap((feat) => feat.name === 'Order Explorer' && feat.choice ? [feat.choice] : []),
        ] : [],
        feats: character.feats.map((feat) => ({
          name: feat.name, level: featTakenLevel(feat),
          category: feat.slot?.split(':')[0] ?? feat.type.replace(/ Feat$/, '').toLowerCase(),
        })),
        features: [...features.map((feature) => feature.name), ...museFeats,
          ...automaticFeatGrants(character, entries).map((feat) => feat.name),
          ...tokens(byName(entries, 'background', character.background)?.data.feat),
          ...(character.className === 'Druid' && (character.order ?? subclass) === 'Animal' ? ['Animal Companion'] : []),
          ...(casting ? ['spellcasting'] : []),
          ...(hasFocusPool ? ['focus pool'] : []),
          ...(casting || hasFocusPool || character.spells?.length ? ['ability to cast spells'] : []),
          ...(character.companions?.length ? ['an animal companion'] : []),
        ],
        ranks: { ...Object.fromEntries(statDefs(character).map((stat) => [stat.name, 0])), ...ranks },
        armor: armorRanks(character, entries), weapons: weaponRanks(character, entries),
        abilities: character.abilities,
        // Prerequisites describe available capabilities, not the current combat toggle.
        senses: senses({ ...character, raging: true }, entries).map((sense) => sense.value),
      }
      facts.set(atLevel, value)
      return value
    },
  })
}

export function ancestryFeatTraits(c: Character) {
  return [c.ancestry, c.heritage, ...activeFeatsNamed(c, 'Adopted Ancestry').map((feat) => feat.choice)]
    .filter((name): name is string => !!name).map((name) => name.trim().toLowerCase())
}

export function eligibleFeats(entries: ContentEntry[], c: Character, slot: PlannedSlot) {
  const wanted: Partial<Record<FeatSlotCategory, string | undefined>> = {
    class: c.className, ancestry: c.ancestry, skill: 'skill', general: 'general', archetype: 'archetype',
  }
  const trait = wanted[slot.category]?.toLowerCase()
  const ancestryTraits = slot.category === 'ancestry' ? ancestryFeatTraits(c) : []
  if (slot.category !== 'bonus' && !trait && !ancestryTraits.length) return []
  const taken = new Set([
    ...c.feats.filter((f) => f.slot !== slot.key).map((f) => f.name),
    ...automaticFeatGrants({ ...c, level: Math.min(c.level, slot.level),
      feats: c.feats.filter((feat) => feat.slot !== slot.key) }, entries).map((feat) => feat.name),
  ])
  const specializations = c.feats.filter((feat) => feat.slot !== slot.key && isCompanionSpecialization(feat.name)).length
  const archetypeAllowed = archetypeRule(c, entries, slot.key, slot.category === 'archetype')
  const generalOnly = slot.category === 'general' && getSettings().generalFeatsOnly
  const orderExplorerOk = availableOrders(c).length > 0
  const prerequisites = featPrerequisiteChecker(c, entries, slot.level, c.feats.findIndex((feat) => feat.slot === slot.key))
  return featIndex(entries)
    .filter(({ entry: e, traits }) => featSelectionLevel(e, c, entries, slot.category) <= Math.min(slot.level, slot.maxFeatLevel ?? slot.level)
      && (slot.category === 'bonus' || !!trait && traits.has(trait) || ancestryTraits.some((ancestry) => traits.has(ancestry))
        || slot.category === 'archetype' && archetypesOf(e).length > 0)
      && !(generalOnly && traits.has('skill'))
      && !prerequisites(e).missing.length
      && (e.name !== 'Order Explorer' || orderExplorerOk || c.feats.some((f) => f.slot === slot.key && f.name === e.name))
      && (!isCompanionSpecialization(e.name) || specializations < 3)
      && (e.name !== 'Third Blessing' || c.feats.some((feat) => feat.name === 'Second Blessing' && feat.level <= slot.level))
      && (e.name !== 'Third Innovation' || c.feats.some((feat) => feat.name === 'Second Innovation' && feat.level <= slot.level))
      && (e.name !== 'Deadly Simplicity' || [...entries, ...SUPPLEMENTAL_WEAPONS]
        .some((weapon) => weapon.kind === 'weapon' && !weapon.deleted && isDeadlySimplicityWeapon(c, entries, weapon)))
      && (!['Chiardmar Steed', 'Nidarrmar Steed'].includes(e.name)
        || c.companions?.some((companion) => companion.type === 'Horse'))
      && (e.name !== 'Pristine Living Weapon' || ['Living Weapon', 'Wild Hunter Dedication'].every((name) =>
        c.feats.some((feat) => feat.name === name && feat.level <= slot.level)))
      && EXCLUSIVE_FEAT_GROUPS.every((group) => !group.includes(e.name) || !group.some((name) => name !== e.name && taken.has(name)))
      && (!taken.has(e.name) || (e.data.repeatable === true || e.name !== 'Auspicious Mount' && isCompanionSpecialization(e.name)) && canSelectWardenFeat(e.name, c, entries, slot.key))
      && archetypeAllowed(e))
    .map(({ entry }) => entry)
}

export function featChoiceOptions(name: string, c: Character, entries: ContentEntry[], slotKey: string, selectedIndex?: number): string[] | undefined {
  const index = selectedIndex ?? c.feats.findIndex((feat) => feat.slot === slotKey)
  if (name === 'Adopted Ancestry') return [...new Set(entries.filter((entry) => entry.kind === 'ancestry' && !entry.deleted
    && entry.name !== c.ancestry && entry.systems.some((system) => c.systems.includes(system))).map((entry) => entry.name))]
    .sort((a, b) => a.localeCompare(b))
  if (name === 'Skill Training') {
    const ranks = ranksAt({ ...c, feats: c.feats.filter((_, i) => i !== index) }, entries)
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
  if (name === 'Order Magic') return orderMagicOptions(c, index)
  if (name === 'Canny Acumen') return [...CANNY_STATS]
  if (name === "Deity's Domain") return [...new Set(entries.filter((entry) => (entry.kind === 'deity' || entry.kind === 'spell') && !entry.deleted)
    .flatMap((entry) => [...tokens(entry.data.domain_primary ?? entry.data.domain), ...tokens(entry.data.domain_alternate)]))]
    .sort((a, b) => a.localeCompare(b))
  if (name === 'Second Blessing' || name === 'Third Blessing') {
    const used = [championBlessing(c), ...c.feats.flatMap((feat) => [
      ...(DEVOTED_BLESSINGS.some((blessing) => blessing === feat.name) ? [feat.name] : []),
      ...(feat.slot !== slotKey && ['Second Blessing', 'Third Blessing'].includes(feat.name) && feat.choice ? [feat.choice] : []),
    ])]
    return DEVOTED_BLESSINGS.filter((blessing) => !used.includes(blessing))
  }
  if (name === 'Second Innovation' || name === 'Third Innovation') {
    const used = [selectedSubclass(c, entries), ...c.feats.flatMap((feat) =>
      feat.slot !== slotKey && ['Second Innovation', 'Third Innovation'].includes(feat.name) && feat.choice ? [feat.choice] : [])]
    return subclassOptions({ ...c, className: 'Inventor' }, entries).map((entry) => entry.name).filter((innovation) => !used.includes(innovation))
  }
  if (hasWardenChoice({ name }) && c.systems.includes('pf2e')) {
    const selected = new Set(c.feats.flatMap((feat) => feat.slot !== slotKey && hasWardenChoice(feat) && feat.choice ? [feat.choice] : []))
    return wardenSpellOptions({ name }, entries).map((spell) => spell.name).filter((choice) => !selected.has(choice))
  }
}

export function deityDomains(c: Character, entries: ContentEntry[]) {
  const deity = byName(entries, 'deity', c.deity)
  return tokens(deity?.data.domain_primary ?? deity?.data.domain)
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
  const rank = traditions.length
    ? features.reduce((best, feature) => Math.max(best, progression[feature.name.toLowerCase()] ?? 0), 1)
    : features.reduce((best, feature) => {
      const m = /proficiency ranks? for (?:your )?[\w ]*class DC increases to (expert|master|legendary)/i.exec(feature.description)
      const rank = m ? { expert: 2, master: 3, legendary: 4 }[m[1].toLowerCase() as 'expert' | 'master' | 'legendary'] : 0
      return Math.max(best, rank)
    }, 1)
  return { traditions, rank, ability: CASTING_ABILITY[c.className ?? ''] as Ability | undefined }
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

export function speedBonuses(c: Character) {
  return ['Fleet', 'Primal Nimbleness'].filter((name) => activeFeatsNamed(c, name).length).map((source) => ({ source, feet: 5 }))
}

// Land Speed: ancestry speed (25 if unknown) plus feat bonuses
export const speed = (c: Character, entries: ContentEntry[]) =>
  (num(byName(entries, 'ancestry', c.ancestry)?.data.speed) || 25) + speedBonuses(c).reduce((sum, bonus) => sum + bonus.feet, 0)

export function ragingAthleteBenefits(c: Character, entries: ContentEntry[]) {
  if (!c.raging || !activeFeatsNamed(c, 'Raging Athlete').length) return undefined
  const land = speed(c, entries)
  return { jumpDCAdjustment: -10, longJumpExtra: 10, verticalLeap: 5,
    horizontalLeap: land >= 30 ? 20 : land >= 15 ? 15 : undefined }
}

export function movementSpeeds(c: Character, entries: ContentEntry[]) {
  const land = speed(c, entries)
  const features = activeAnimalFeatures(c, entries)
  const movement: { name: string; feet: number; source: string }[] = [
    ...(features.includes('Fish Tail') ? [{ name: 'Swim', feet: land, source: 'Animal Feature' }] : []),
    ...(features.includes('Wings') ? [{ name: 'Fly', feet: land, source: 'Animal Feature' }] : [])]
  if (activeFeatsNamed(c, 'Natural Swimmer').length) movement.push({ name: 'Swim', feet: 15, source: 'Natural Swimmer' })
  if (ragingAthleteBenefits(c, entries)) {
    for (const name of ['Climb', 'Swim']) movement.push({ name, feet: land, source: 'Raging Athlete' })
  }
  if (canopyCrawlerAffects(c, entries)) movement.push({ name: 'Climb', feet: Math.max(land, ...movement.map((speed) => speed.feet)), source: 'Canopy Crawler' })
  const merged = new Map<string, typeof movement[number]>()
  for (const candidate of movement) {
    const previous = merged.get(candidate.name)
    if (!previous || candidate.feet > previous.feet) merged.set(candidate.name, { ...candidate })
    else if (candidate.feet === previous.feet) previous.source += `, ${candidate.source}`
  }
  return [{ name: 'Land', feet: land, source: undefined }, ...[...merged.values()].sort((a, b) => a.name.localeCompare(b.name))]
}

export const perceptionCircumstanceBonus = (c: Character) => activeFeatsNamed(c, 'Superior Sight').length ? 2 : 0

export const initiativeBonus = (c: Character, entries: ContentEntry[]) =>
  defenseSummary(c, entries).perception + Math.max(0,
    Math.max(activeFeatsNamed(c, 'Incredible Initiative').length ? 2 : 0, wornArmor(c, entries)?.material === 'Orichalcum' ? 1 : 0)
      - perceptionCircumstanceBonus(c))

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
    const m = /^trained in (?!a number|one (?:or more|of|skill determined)|your choice)(.+)$/i.exec(l)
    return m ? m[1].split(/,| and /).map((s) => s.trim()).filter(Boolean) : []
  })
  const choices = lines.flatMap((l) => {
    const m = /^trained in (?:your choice of|one of) (.+)$/i.exec(l)
    return m ? [m[1].split(/,| or /).map((x) => x.trim()).filter(Boolean)] : []
  })[0] ?? []
  const extra = lines.map((l) => /additional skills? equal to (\d+)/i.exec(l)).find(Boolean)
  return { fixed, choices, additional: extra ? +extra[1] : 0 }
}

// skill_proficiency is stored joined with ", "; the sentences themselves contain no other commas we rely on
const tokensLoose = (v: unknown) => (typeof v === 'string' ? v.split(/,\s(?=Trained)/i).map((t) => t.trim()) : [])

// The skill each druidic order grants
export const DRUID_ORDERS: Record<string, string> = {
  Animal: 'Athletics', Flame: 'Crafting', Leaf: 'Nature', Stone: 'Crafting', Storm: 'Acrobatics', Wave: 'Athletics', Wild: 'Intimidation',
}

// The initial order spell (a focus spell) each druidic order grants
export const ORDER_SPELLS: Record<string, string> = {
  Animal: 'Heal Animal', Flame: 'Wildfire', Leaf: 'Goodberry', Stone: 'Crushing Ground', Storm: 'Tempest Surge', Wave: 'Rising Surf', Wild: 'Untamed Form',
}

// Orders picked with Order Explorer that an Order Magic feat can still take the spell of
export const orderMagicOptions = (c: Character, exceptIndex = -1) => {
  const used = new Set(c.feats.flatMap((f, i) => f.name === 'Order Magic' && i !== exceptIndex && f.choice ? [f.choice] : []))
  return c.feats.flatMap((f) => f.name === 'Order Explorer' && f.choice && !used.has(f.choice) ? [f.choice] : [])
}

const spellNameCache = new WeakMap<ContentEntry[], Map<string, string>>()
const spellName = (entries: ContentEntry[], name: string) => {
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
  const add = (name: string, source: string) => { if (!out.has(name.toLowerCase())) out.set(name.toLowerCase(), { name: spellName(entries, name), source }) }
  const orders = c.className === 'Druid' ? [c.order, ...c.feats.flatMap((f) => f.name === 'Order Explorer' ? [f.choice] : [])] : []
  const addOrder = (order?: string) => { if (order && ORDER_SPELLS[order]) add(ORDER_SPELLS[order], `${order} Order`) }
  if (c.className === 'Druid') {
    addOrder(c.order)
    for (const f of c.feats) if (f.name === 'Order Magic') addOrder(f.choice)
  }
  let points = 0
  for (const f of c.feats) {
    const data = byName(entries, 'feat', f.name)?.data
    if (!data) continue
    if (typeof data.grants_focus_spells === 'string') for (const n of data.grants_focus_spells.split(', ')) add(n, f.name)
    if (typeof data.grants_order_spells === 'string') {
      for (const pair of data.grants_order_spells.split(', ')) {
        const [order, spell] = pair.split(':')
        if (orders.some((o) => o?.toLowerCase() === order)) add(spell, f.name)
      }
    }
    if (data.grants_focus_point) points++
  }
  const spells = [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { spells, points: spells.length ? Math.min(3, 1 + points) : 0 }
}

// Orders not yet used by the main order or another Order Explorer feat
export function availableOrders(c: Character, exceptIndex = -1) {
  const used = new Set([c.order, ...c.feats.flatMap((f, i) => f.name === 'Order Explorer' && i !== exceptIndex ? [f.choice] : [])])
  return Object.keys(DRUID_ORDERS).filter((o) => !used.has(o))
}

// Skills the class grants: fixed, chosen, or tied to an order or Champion deity. They are always trained; the house rule
// (autoClassSkills) also ranks them up at every skill increase the level cap allows, without using the character's own increases.
export function autoClassSkills(c: Character, entries: ContentEntry[]) {
  const { fixed, choices } = classSkills(byName(entries, 'class', c.className))
  const order = c.className === 'Druid' && c.order ? DRUID_ORDERS[c.order] : undefined
  const picked = c.classSkill && choices.includes(c.classSkill) ? c.classSkill : undefined
  const divine = c.className === 'Champion' ? tokens(byName(entries, 'deity', c.deity)?.data.skill) : []
  // Order Explorer adds a second druidic order, whose skill is also trained
  const explored = c.className === 'Druid' ? c.feats.flatMap((f) => f.name === 'Order Explorer' && f.choice && DRUID_ORDERS[f.choice] ? [DRUID_ORDERS[f.choice]] : []) : []
  return [...new Set([...fixed, ...(picked ? [picked] : []), ...(order ? [order] : []), ...explored, ...divine])]
}

export function selectedSubclass(c: Character, entries: ContentEntry[] = []) {
  const saved = c.className === 'Druid' ? c.order : c.subclass
  if (saved !== undefined) return saved
  const raw = c.imported?.raw
  const build = raw && typeof raw === 'object' && 'build' in raw ? raw.build : raw
  const specials = build && typeof build === 'object' && 'class' in build && build.class === c.className
    && 'specials' in build && Array.isArray(build.specials) ? build.specials : []
  const names = new Set([...c.feats.flatMap((feat) => [feat.name,
    ...(['Second Innovation', 'Third Innovation'].includes(feat.name) ? [] : [feat.choice])]), ...specials]
    .filter((name): name is string => typeof name === 'string').map((name) => name.replace(/ (?:Instinct|Order)$/, '')))
  if (c.className === 'Druid') {
    const explored = new Set(c.feats.flatMap((feat) => feat.name === 'Order Explorer' && feat.choice ? [feat.choice] : []))
    return [...names].find((order) => Object.hasOwn(DRUID_ORDERS, order) && !explored.has(order))
  }
  return subclassOptions(c, entries).find((entry) => names.has(entry.name))?.name
}

export function classLabel(c: Character, entries: ContentEntry[] = []) {
  if (!c.className) return ''
  const subclass = selectedSubclass(c, entries)
  if (!subclass) return c.className
  if (c.className === 'Champion') return `Champion of ${subclass}`
  if (c.className === 'Druid') return `Druid of the ${subclass} Order`
  if (c.className === 'Barbarian') return `${subclass.replace(/ Instinct$/, '')} Instinct Barbarian`
  return `${subclass} ${c.className}`
}

export function subclassOptions(c: Character, entries: ContentEntry[]) {
  return entries.filter((entry) => entry.kind === 'subclass' && !entry.deleted && entry.data.class === c.className)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const backgroundSkills = (bg?: ContentEntry) => tokens(bg?.data.skill)

export const skillIncreaseLevels = (c: Character) => range(3, 19, 2).filter((l) => l <= c.level)
const rankCap = (level: number) => (level >= 15 ? 4 : level >= 7 ? 3 : 2)
export const canIncreaseTo = (level: number, currentRank: number) => currentRank < rankCap(level)

const featData = (c: Character, entries: ContentEntry[], field: string) =>
  c.feats.flatMap((f) => {
    const v = byName(entries, 'feat', f.name)?.data[field]
    return typeof v === 'string' && v ? [{ value: v, source: f.name }] : []
  })

// Lore skills taught by feats such as Wild Hunter Dedication (Additional Lore)
export const featLores = (c: Character, entries: ContentEntry[]) => [...new Set([
  ...featData({ ...c, feats: c.feats.filter((feat) => featTakenLevel(feat) <= c.level) }, entries, 'grants_lore').map((g) => g.value),
  ...activeFeatsNamed(c, 'Additional Lore').flatMap((feat) => {
    const choice = feat.choice?.trim()
    return choice ? [/\s+lore$/i.test(choice) ? choice.replace(/\s+lore$/i, ' Lore') : `${choice} Lore`] : []
  }),
])]

function skillTrainingSkills(c: Character) {
  const skills = new Set(statDefs(c).filter((stat) => stat.kind === 'skill').map((stat) => stat.name))
  return activeFeatsNamed(c, 'Skill Training').flatMap((feat) => feat.choice && skills.has(feat.choice) ? [feat.choice] : [])
}

// Senses from the ancestry and from feats
export function senses(c: Character, entries: ContentEntry[]) {
  const ancestry = byName(entries, 'ancestry', c.ancestry)?.data.vision
  const out = typeof ancestry === 'string' && ancestry ? [{ value: ancestry, source: c.ancestry }] : []
  const addVision = (value: string, source: string) => {
    if (!out.some((sense) => sense.value.toLowerCase() === value.toLowerCase())) out.push({ value, source })
  }
  const hasVision = (value: string) => out.some((sense) => sense.value.toLowerCase().includes(value))
  const explicitVision = ['Acute Vision', 'Nocturnal Senses', 'Superior Sight']
  const passive = { ...c, feats: c.feats.filter((feat) => featTakenLevel(feat) <= c.level && !explicitVision.includes(feat.name)) }
  for (const grant of featData(passive, entries, 'grants_vision')) addVision(grant.value, grant.source)
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
  const addScent = (feet: number, source: string) => {
    const existing = out.find((sense) => /^Scent \(imprecise\) \d+ feet$/i.test(sense.value))
    if (existing && Number(/\d+/.exec(existing.value)?.[0]) >= feet) return
    const grant = { value: `Scent (imprecise) ${feet} feet`, source }
    if (existing) Object.assign(existing, grant)
    else out.push(grant)
  }
  if (isSpellActive(c, entries, 'Keen Smell')) addScent(c.level >= 5 ? 60 : 30, 'Keen Smell')
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

export function automaticFeatGrants(c: Character, entries: ContentEntry[]) {
  if (!activeFeatsNamed(c, 'Raging Intimidation').length) return []
  const rank = ranksAt(c, entries).Intimidation ?? 0
  return [
    ...(rank >= 1 ? [{ name: 'Intimidating Glare', source: 'Raging Intimidation' }] : []),
    ...(c.level >= 15 && rank >= 4 ? [{ name: 'Scare to Death', source: 'Raging Intimidation' }] : []),
  ]
}

function baseRanks(c: Character, entries: ContentEntry[], beforeLevel = 99) {
  const klass = byName(entries, 'class', c.className)
  const ranks: Record<string, number> = {}
  const bump = (n: string) => { ranks[n] = Math.max(ranks[n] ?? 0, 1) }
  autoClassSkills(c, entries).forEach(bump)
  backgroundSkills(byName(entries, 'background', c.background)).forEach(bump)
  c.skillPicks?.forEach(bump)
  featLores({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries).forEach(bump)
  skillTrainingSkills(c).forEach(bump)
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

// Ranks from class/background/picks plus skill increases below `beforeLevel`; legacy overrides apply only to skills.
export function ranksAt(c: Character, entries: ContentEntry[], beforeLevel = 99, withOverrides = true) {
  const ranks = baseRanks(c, entries, beforeLevel)
  const autoSkills = autoClassSkills(c, entries)
  const rankUp = getSettings().autoClassSkills
  const loreUp = getSettings().autoLores
  const lores = loreUp ? [...backgroundSkills(byName(entries, 'background', c.background)).filter((n) => /lore$/i.test(n)), ...c.lores.map((l) => l.name), ...featLores(c, entries)] : []
  const additionalLores = featLores({ ...c, level: Math.min(c.level, beforeLevel - 1) }, entries)
  for (const l of skillIncreaseLevels(c).filter((x) => x < beforeLevel)) {
    const skill = c.skillIncreases?.[l]
    if (skill) ranks[skill] = Math.min(4, (ranks[skill] ?? 0) + 1)
    if (rankUp) for (const name of autoSkills) ranks[name] = Math.max(ranks[name] ?? 0, rankCap(l))
    for (const name of lores) ranks[name] = Math.max(ranks[name] ?? 0, rankCap(l))
    if (l === 3 || l === 7 || l === 15) {
      for (const name of additionalLores) ranks[name] = Math.max(ranks[name] ?? 0, rankCap(l))
    }
  }
  if (withOverrides) {
    const skillNames = new Set(statDefs(c).filter((stat) => stat.kind === 'skill').map((stat) => stat.name))
    for (const [name, rank] of Object.entries(c.rankOverrides ?? {})) {
      if (skillNames.has(name)) ranks[name] = rank
    }
  }
  for (const name of [
    ...autoClassSkills(c, entries),
    ...backgroundSkills(byName(entries, 'background', c.background)),
    ...skillTrainingSkills(c),
  ]) ranks[name] = Math.max(1, ranks[name] ?? 0)
  return ranks
}

export const proficiencyBonus = (rank: number, level: number) => (rank > 0 ? level + rank * 2 : 0)

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

export function weaponRanks(c: Character, entries: ContentEntry[]) {
  const ranks = baseWeaponRanks(c, entries)
  if (weaponProficiencyGrants(c, entries).some((grant) => grant.martial)) ranks.Martial = Math.max(ranks.Martial, c.level >= 11 ? 2 : 1)
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
  const granted = new Set<typeof ARMOR_GROUPS[number]>()
  for (const { feat } of proficiencyFeats(c, 'Armor Proficiency')) {
    const prior = baseArmorRanks({ ...c, level: featTakenLevel(feat) }, entries)
    const group = ARMOR_GROUPS.find((group) => group !== 'Unarmored' && !prior[group] && !granted.has(group))
    if (!group) continue
    granted.add(group)
    ranks[group] = Math.max(ranks[group], c.level >= 13 ? 2 : 1)
  }
  return ranks
}

export function defenseSummary(c: Character, entries: ContentEntry[]) {
  const ranks = ranksAt(c, entries)
  const resilient = wornArmor(c)?.resilient ?? 0
  const save = (name: string, ability: Ability) =>
    abilityMod(c.abilities[ability]) + proficiencyBonus(ranks[name] ?? 0, c.level) + (name === 'Perception' ? perceptionItemBonus(c) : resilient)
  return {
    perception: save('Perception', 'wis') + perceptionCircumstanceBonus(c),
    ac: armorClass(c, entries),
    hp: maxHp(c, entries),
    fortitude: save('Fortitude', 'con'),
    reflex: save('Reflex', 'dex'),
    will: save('Will', 'wis'),
  }
}

const cap = (v: string) => v[0].toUpperCase() + v.slice(1)

// Armor specialization comes from class features and feats that mention it; its effect depends on the worn armor's group
export function armorSpecialization(c: Character, entries: ContentEntry[]) {
  const worn = wornArmor(c)
  if (!worn) return undefined
  const armor = byName(entries, 'armor', worn.name)
  const groups = tokens(armor?.data.armor_group).map((g) => g.toLowerCase())
  const category = String(armor?.data.armor_category ?? '').toLowerCase()
  // Class features apply to every group; feats may limit it to named groups and armor categories
  const anyGroup = classFeatures(entries, c).some((f) => /armor specialization/i.test(`${f.name} ${f.description}`))
  const fromFeat = c.feats.find((f) => {
    const e = byName(entries, 'feat', f.name)
    if (!e?.data.grants_armor_specialization && !/armor specialization/i.test(f.name)) return false
    const allowed = tokens(e?.data.grants_armor_groups).map((g) => g.toLowerCase())
    const categories = tokens(e?.data.grants_armor_categories).map((g) => g.toLowerCase())
    return (!allowed.length || groups.some((g) => allowed.includes(g))) && (!categories.length || categories.includes(category))
  })
  if (!anyGroup && !fromFeat) return undefined
  const group = groups.map((g) => entries.find((e) => e.kind === 'armorGroup' && e.name.toLowerCase() === g)).find(Boolean)
  return group ? { group: group.name, armor: worn.name, feat: anyGroup ? undefined : fromFeat?.name, effect: group.description.replace(/^Source .*?pg\. \d+\s*/i, '') } : undefined
}

// Resistances from heritage, ancestry, background, class features, feats, carried items and worn armor (structured effects or synced "damage=value" data)
export function resistances(c: Character, entries: ContentEntry[]) {
  const sources = [
    c.heritage ? entries.find((e) => e.kind === 'heritage' && e.name === c.heritage) : undefined,
    c.ancestry ? byName(entries, 'ancestry', c.ancestry) : undefined,
    c.background ? byName(entries, 'background', c.background) : undefined,
    ...classFeatures(entries, c),
    ...c.feats.map((f) => byName(entries, 'feat', f.name)),
    ...c.equipment.map((g) => byName(entries, 'item', g.name)),
    wornArmor(c) ? byName(entries, 'armor', wornArmor(c)!.name) : undefined,
  ].filter((e): e is ContentEntry => !!e)
  const half = Math.max(1, Math.floor(c.level / 2))
  const out: { damage: string; value: number; source: string }[] = []
  for (const e of sources) {
    for (const f of e.effects) if (f.type === 'resistance') out.push({ damage: f.damage, value: f.value, source: e.name })
    for (const part of String(e.data.resistances ?? '').split(',').filter(Boolean)) {
      const [damage, v] = part.split('=')
      out.push({ damage, value: v === 'half' ? half : +v, source: e.name })
    }
  }
  for (const rune of wornArmor(c)?.runes ?? []) {
    const m = /^Energy-Resistant( \(Greater\))?: (\w+)$/.exec(rune.replace(/^Greater Energy-Resistant/, 'Energy-Resistant (Greater)')) ?? /^()(\w+) Resistant$/.exec(rune)
    if (m) out.push({ damage: m[2], value: m[1] ? 10 : 5, source: `${rune} rune` })
  }
  return out.map((r) => ({ ...r, damage: cap(r.damage) }))
}

export const wornArmor = (c: Character, entries: ContentEntry[] = []): OwnedArmor | undefined =>
  c.armors?.filter((armor) => armor.worn).map((armor) => effectiveArmor(c, entries, armor))[0]
export const perceptionItemBonus = (c: Character) => Math.max(0, ...(wornArmor(c)?.runes ?? []).map((rune) => {
  const name = runeName(rune)
  return name === 'Sunweave' ? 1 : name === 'Sunweave (Greater)' ? 2 : name === 'Sunweave (Major)' ? 3 : 0
}))

const armorCategory_ = (e: ContentEntry) => armorCategory(e).toLowerCase()

export function armorClass(c: Character, entries: ContentEntry[]) {
  const worn = wornArmor(c)
  const armor = worn
    ? byName(entries, 'armor', worn.name)
    : c.armors
      ? undefined
      : c.equipment
        .map((item) => byName(entries, 'armor', item.name))
        .filter((entry): entry is ContentEntry => !!entry)
        .sort((a, b) => num(b.data.ac) - num(a.data.ac))[0]
  const armorCategory = armor ? armorCategory_(armor) : 'unarmored'
  const categoryKey = armorCategory === 'unarmored' ? 'unarmored' : `${armorCategory}_armor`
  const klass = byName(entries, 'class', c.className)
  const proficiencyFields = [
    klass?.data[`${categoryKey}_proficiency`],
    klass?.data.armor_proficiency,
    klass?.data.armor_class_proficiency,
    klass?.data.ac_proficiency,
  ]
  let rank = proficiencyFields.reduce<number>((best, value) => Math.max(best, rankFromText(value)), 0)
  const featureRank = classFeatures(entries, c).reduce<number>((best, feature) => {
    const name = feature.name.toLowerCase()
    const applies = name.includes('armor expertise')
      || (armorCategory === 'unarmored' ? name.includes('unarmored') : name.includes(`${armorCategory} armor`))
    if (!applies) return best
    if (name.includes('legendary')) return Math.max(best, 4)
    if (name.includes('master')) return Math.max(best, 3)
    if (name.includes('expert')) return Math.max(best, 2)
    return best
  }, 0)
  rank = Math.max(rank, featureRank, armorRanks(c, entries)[armorCategory === 'unarmored' ? 'Unarmored' : armorCategory === 'light' ? 'Light' : armorCategory === 'medium' ? 'Medium' : 'Heavy'])
  const dexterity = abilityMod(c.abilities.dex)
  const dexCap = armor ? num(armor.data.dex_cap) : Number.POSITIVE_INFINITY
  const raised = c.shield?.raised ? 2 : 0
  return 10 + num(armor?.data.ac) + (worn?.potency ?? 0) + Math.min(dexterity, dexCap) + proficiencyBonus(rank, c.level) + raised
}

// Imported equipment shows up as configurable gear until the player edits it
function carriedWeapons(c: Character, entries: ContentEntry[]): OwnedWeapon[] {
  return c.weapons ?? c.equipment
    .filter((g) => byName(entries, 'weapon', g.name))
    .map((g) => ({ id: `eq-${g.name}`, name: g.name, potency: 0, striking: 0, runes: [] }))
}

export function haftStrikerWeapons(c: Character, entries: ContentEntry[]) {
  if (c.level < 4 || !hasFeat(c, HAFT_STRIKER_WEAPON.name)) return []
  return carriedWeapons(c, entries).filter((weapon) => {
    const entry = weaponEntry(entries, weapon.name)
    return num(entry?.data.hands) === 2 && !isRanged(entry) && /^(hammer|spear|polearm)$/i.test(String(entry?.data.weapon_group))
  })
}

export function haftStrikerSource(c: Character, entries: ContentEntry[]) {
  const weapons = haftStrikerWeapons(c, entries)
  return weapons.find((weapon) => weapon.id === c.haftStrikerWeaponId) ?? weapons[0]
}

const canOversizedThrow = (c: Character) => c.className === 'Barbarian' && c.level >= 4 && !!c.raging && hasFeat(c, 'Oversized Throw')

export function ownedWeapons(c: Character, entries: ContentEntry[]): OwnedWeapon[] {
  const weapons = carriedWeapons(c, entries)
  const ironFists = c.feats.some((feat) => /^Iron Fists?$/i.test(feat.name))
  const tusks = c.feats.some((feat) => /^Tusks(?: \(Orc\))?$/i.test(feat.name)) || c.level >= 5 && hasFeat(c, 'Cold Iron Tusks')
  const haftStriker = !!haftStrikerSource(c, entries)
  const oversizedThrow = canOversizedThrow(c)
  const gauntlet = armorGauntlet(c, entries)
  const features = activeAnimalFeatures(c, entries)
  const animalAttacks = [ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS]
  const selectedAttacks = animalAttacks.filter((attack) => features.some((feature) => attack.name === `${feature} (Animal Feature)`))
  const available = weapons.filter((weapon) =>
    (weapon.name !== IRON_FIST.name || ironFists) && (weapon.name !== ORC_TUSKS.name || tusks)
    && (weapon.name !== HAFT_STRIKER_WEAPON.name || haftStriker)
    && (weapon.id !== OVERSIZED_THROW.id || oversizedThrow)
    && (weapon.id !== GAUNTLET.id || !!gauntlet)
    && (!animalAttacks.some((entry) => entry.name === weapon.name) || selectedAttacks.some((entry) => entry.name === weapon.name)))
    .map((weapon) => weapon.id === GAUNTLET.id && gauntlet && weapon.name !== gauntlet.name ? { ...weapon, name: gauntlet.name } : weapon)
  for (const entry of [...(ironFists ? [IRON_FIST] : []), ...(tusks ? [ORC_TUSKS] : []), ...(haftStriker ? [HAFT_STRIKER_WEAPON] : []), ...(oversizedThrow ? [OVERSIZED_THROW] : []), ...selectedAttacks, ...(gauntlet ? [{ id: GAUNTLET.id, name: gauntlet.name }] : [])]) {
    if (!available.some((weapon) => weapon.name === entry.name)) {
      available.push({ id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] })
    }
  }
  if (available.some((weapon) => /\bgauntlets?\b/i.test(weapon.name))) {
    return available.filter((weapon) => weapon.name !== FIST.name && weapon.name !== IRON_FIST.name)
  }
  const hasOtherUnarmed = available.some((weapon) => weapon.name !== FIST.name
    && weaponCategory(weaponEntry(entries, weapon.name)) === 'Unarmed')
  if (hasOtherUnarmed) return available.filter((weapon) => weapon.name !== FIST.name)
  if (!available.some((weapon) => weapon.name === FIST.name)) {
    available.push({ id: FIST.id, name: FIST.name, potency: 0, striking: 0, runes: [] })
  }
  return available
}

export function knowsSpell(c: Character, entries: ContentEntry[], name: string) {
  return !!(c.spells?.some((spell) => spell.name === name)
    || c.feats.some((feat) => hasWardenChoice(feat) && feat.choice === name)
    || focusSpells(c, entries).spells.some((spell) => spell.name === name))
}

export const isSpellActive = (c: Character, entries: ContentEntry[], name: string) =>
  !!c.activeSpells?.includes(name) && knowsSpell(c, entries, name)

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
  return ANIMAL_FEATURES.filter((feature) => selected.includes(feature.name) && feature.rank <= Math.ceil(c.level / 2))
    .map((feature) => feature.name)
}

export const isAutomaticUnarmed = (name: string) => [FIST.name, IRON_FIST.name, ORC_TUSKS.name, ANIMAL_FEATURE_CLAWS.name, ANIMAL_FEATURE_JAWS.name].includes(name)
export const isLockedWeapon = (c: Character, name: string, entries: ContentEntry[] = []) => isAutomaticUnarmed(name)
  || name === HAFT_STRIKER_WEAPON.name && !!haftStrikerSource(c, entries)
  || name === OVERSIZED_THROW.name && canOversizedThrow(c)
  || ARMOR_GAUNTLETS.some((option) => option === name) && name === armorGauntlet(c, entries)?.name
export const weaponEntry = (entries: ContentEntry[], name: string) =>
  SUPPLEMENTAL_WEAPONS.find((entry) => entry.name === name && isAutomaticUnarmed(name))
  ?? byName(entries, 'weapon', name) ?? SUPPLEMENTAL_WEAPONS.find((entry) => entry.name === name)
export function ownedArmors(c: Character, entries: ContentEntry[]): OwnedArmor[] {
  if (c.armors) return c.armors.map((armor) => effectiveArmor(c, entries, armor))
  const best = c.equipment
    .map((g) => byName(entries, 'armor', g.name))
    .filter((e): e is ContentEntry => !!e)
    .sort((a, b) => num(b.data.ac) - num(a.data.ac))[0]
  return c.equipment.filter((g) => byName(entries, 'armor', g.name))
    .map((g) => effectiveArmor(c, entries, { id: `eq-${g.name}`, name: g.name, potency: 0, resilient: 0, runes: [], worn: g.name === best?.name }))
}

export function isWoodArmor(entries: ContentEntry[], armor: OwnedArmor) {
  return tokens(byName(entries, 'armor', armor.name)?.data.armor_group).some((group) => group.toLowerCase() === 'wood')
}

export function effectiveArmor(c: Character, entries: ContentEntry[], armor: OwnedArmor): OwnedArmor {
  return isWoodArmor(entries, armor)
    ? { ...armor, material: c.level >= 19 ? 'Duskwood (High-Grade)' : 'Duskwood (Standard-Grade)' }
    : armor
}

export function armorGauntlet(c: Character, entries: ContentEntry[]) {
  const armor = ownedArmors(c, entries).find((armor) => armor.worn)
  return armor && ['Full Plate', 'Half Plate', 'Hellknight Plate', 'Splint Mail'].includes(armor.name)
    ? { armor, name: armor.gauntlet ?? GAUNTLET.name } : undefined
}

// ---------- Weapons ----------

export const STRIKING_LABEL = ['', 'Striking', 'Greater Striking', 'Major Striking']
export const WEAPON_PROPERTY_RUNES = [
  'Ancestral Echoing', 'Anarchic', 'Axiomatic', 'Bane', 'Corrosive', 'Disrupting', 'Flaming', 'Frost', 'Ghost Touch',
  'Grievous', 'Holy', 'Hopeful', 'Impactful', 'Quickstrike', 'Returning', 'Shifting', 'Shock', 'Speed', 'Thundering',
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
  const content = entries.find((candidate) => candidate.kind === 'item'
    && candidate.data.item_subcategory === 'Weapon Property Runes' && runeName(candidate.name) === runeName(rune))
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
    const existingEntry = entries.find((candidate) => candidate.kind === 'item' && runeName(candidate.name) === runeName(existing))
    return String(existingEntry?.data.usage).toLowerCase().replace(/\s+/g, ' ').includes(`without a ${name.toLowerCase()} rune`)
  })) return false
  return true
}

export function eligibleWeaponRunes(entries: ContentEntry[], weapon: OwnedWeapon) {
  return propertyRunes(entries, 'Weapon').filter((rune) =>
    !weapon.runes.some((existing) => runeBaseName(existing) === runeBaseName(rune.name))
    && weaponRuneApplies(entries, weapon, rune.name))
}

export function handwrapRuneOptions(c: Character, entries: ContentEntry[]) {
  const unarmed = [
    ...SUPPLEMENTAL_WEAPONS.filter((entry) => weaponCategory(entry) === 'Unarmed')
      .map((entry) => ({ id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] })),
    ...ownedWeapons(c, entries).filter((weapon) => weaponCategory(weaponEntry(entries, weapon.name)) === 'Unarmed'),
  ]
  const available = new Set(unarmed.flatMap((weapon) =>
    eligibleWeaponRunes(entries, { ...weapon, runes: c.handwraps?.runes ?? [] }).map((rune) => rune.name)))
  return propertyRunes(entries, 'Weapon').filter((rune) => available.has(rune.name))
}

export function canBeLivingWeapon(c: Character, entries: ContentEntry[], weapon: OwnedWeapon) {
  const entry = weaponEntry(entries, weapon.name)
  return weapon.id !== OVERSIZED_THROW.id && weapon.id !== GAUNTLET.id && weapon.name !== HAFT_STRIKER_WEAPON.name
    && c.feats.some((feat) => feat.name === 'Living Weapon') && weaponCategory(entry) !== 'Unarmed'
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
  return favored.includes(name.replace(/ \(Animal Feature\)$/, '').toLowerCase())
}

function isDeadlySimplicityWeapon(c: Character, entries: ContentEntry[], entry?: ContentEntry) {
  if (!entry || !isFavoredWeapon(c, entries, entry.name)) return false
  const category = weaponCategory(entry)
  return category === 'Unarmed' || category === 'Simple' && weaponRanks(c, entries).Simple >= 1
}

export function blessedArmamentTargets(c: Character, entries: ContentEntry[]) {
  const favored = ownedWeapons(c, entries).filter((weapon) => isFavoredWeapon(c, entries, weapon.name))
  const manufactured = favored.filter((weapon) => weapon.id !== OVERSIZED_THROW.id && weaponCategory(weaponEntry(entries, weapon.name)) !== 'Unarmed')
  return [...manufactured, ...(c.handwraps && favored.some((weapon) => weaponCategory(weaponEntry(entries, weapon.name)) === 'Unarmed')
    ? [{ id: HANDWRAPS.id, name: HANDWRAPS.name, ...c.handwraps }] : [])]
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
      || !!c.handwraps && targetId === HANDWRAPS.id && weaponCategory(weaponEntry(entries, weapon.name)) === 'Unarmed')
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
  return { potency: source.potency, striking: source.striking, runes: source.runes }
}

export function effectiveWeapon(c: Character, entries: ContentEntry[], weapon: OwnedWeapon): OwnedWeapon {
  if (weapon.id === OVERSIZED_THROW.id) return { ...weapon, potency: 0, striking: 0, runes: [], material: undefined }
  const plate = weapon.id === GAUNTLET.id ? armorGauntlet(c, entries)?.armor : undefined
  if (plate) weapon = { ...weapon, material: plate.material }
  const haft = weapon.name === HAFT_STRIKER_WEAPON.name ? haftStrikerSource(c, entries) : undefined
  if (haft) {
    const source = effectiveWeapon(c, entries, haft)
    const inherited = { ...weapon, potency: source.potency, striking: source.striking, material: source.material, runes: source.runes }
    weapon = { ...inherited, runes: source.runes.filter((rune) => weaponRuneApplies(entries, inherited, rune)) }
  }
  if (weaponCategory(weaponEntry(entries, weapon.name)) !== 'Unarmed') {
    let enhanced = weapon
    if (weapon.livingWeapon && canBeLivingWeapon(c, entries, weapon)) {
      const shared: OwnedWeapon = { ...weapon, ...livingWeaponEnhancements(c, entries, weapon), material: 'Peachwood (Greater)' }
      enhanced = { ...shared, runes: livingWeaponRunes(shared).filter((rune) => weaponRuneApplies(entries, shared, rune)) }
    }
    return withBlessedArmament(c, entries, weapon.id === GAUNTLET.id ? { ...enhanced,
      runes: enhanced.runes.filter((rune) => weaponRuneApplies(entries, enhanced, rune)).slice(0, maxPropertyRunes(enhanced.potency, enhanced.material)) } : enhanced)
  }
  const fundamentals = c.handwraps?.kind === 'hardlight' ? HARDLIGHT_GRADES[c.handwraps.grade ?? 'Commercial'] : c.handwraps
  const material = weapon.name === ORC_TUSKS.name && c.level >= 5 && hasFeat(c, 'Cold Iron Tusks')
    ? c.level >= 16 ? 'Cold Iron (High-Grade)' : c.level >= 10 ? 'Cold Iron (Standard-Grade)' : 'Cold Iron (Low-Grade)' : undefined
  const enhanced: OwnedWeapon = { ...weapon, material, potency: fundamentals?.potency ?? 0, striking: fundamentals?.striking ?? 0, runes: c.handwraps?.runes ?? [] }
  return withBlessedArmament(c, entries, { ...enhanced, runes: enhanced.runes.filter((rune) => weaponRuneApplies(entries, enhanced, rune)) })
}

export const maxPropertyRunes = (potency: number, material?: OwnedWeapon['material']) => {
  const slots = Math.max(0, Math.min(3, potency))
  return slots + (slots > 0 && material === 'Orichalcum' ? 1 : 0)
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

export function armorCategory(entry?: ContentEntry): 'Light' | 'Medium' | 'Heavy' | 'Unarmored' {
  const text = `${entry?.data.armor_category ?? ''} ${(entry?.traits ?? []).join(' ')}`.toLowerCase()
  return (['Light', 'Medium', 'Heavy'] as const).find((cat) => new RegExp(`\\b${cat.toLowerCase()}\\b`).test(text)) ?? (/unarmored/.test(text) || !entry ? 'Unarmored' : 'Light')
}

export function weaponAttack(c: Character, entries: ContentEntry[], w: OwnedWeapon) {
  w = effectiveWeapon(c, entries, w)
  let entry = weaponEntry(entries, w.name)
  if (w.id === OVERSIZED_THROW.id) {
    const specialization = classFeatures(entries, c).map((feature) => feature.name.toLowerCase())
    const dice = specialization.includes('greater weapon specialization') || c.className === 'Barbarian' && c.level >= 15 ? 3
      : specialization.includes('weapon specialization') || c.className === 'Barbarian' && c.level >= 7 ? 2 : 1
    entry = { ...OVERSIZED_THROW, data: { ...OVERSIZED_THROW.data, damage: `${dice}d10 bludgeoning` } }
  }
  const traits = (entry?.traits ?? []).map((t) => t.toLowerCase())
  const ranged = isRanged(entry)
  const thrown = traits.some((t) => t.startsWith('thrown'))
  const str = abilityMod(c.abilities.str)
  const dex = abilityMod(c.abilities.dex)
  const ability: Ability = ranged ? 'dex' : traits.includes('finesse') && dex > str ? 'dex' : 'str'
  const mod = ability === 'dex' ? dex : str
  const category = weaponCategory(entry)
  const advancedTraining = category === 'Advanced' && weaponProficiencyGrants(c, entries)
    .some((grant) => !grant.martial && grant.feat.choice?.trim().toLowerCase() === entry?.name.toLowerCase())
  const rank = Math.max(category === 'Unarmed' ? 1 : 0, weaponRanks(c, entries)[category], advancedTraining ? c.level >= 11 ? 2 : 1 : 0)
  const prof = proficiencyBonus(rank, c.level)
  const m = /(\d+)d(\d+)\s*([A-Za-z]+)?/.exec(String(entry?.data.damage ?? ''))
  const dice = m ? (+m[1]) * (1 + w.striking) : 0
  const baseDie = m ? +m[2] : 0
  const dieSteps = [4, 6, 8, 10, 12]
  const die = hasFeat(c, 'Deadly Simplicity') && isDeadlySimplicityWeapon(c, entries, entry)
    ? category === 'Unarmed' ? Math.max(baseDie, 6) : dieSteps.find((step) => step > baseDie) ?? baseDie
    : baseDie
  const flat = !ranged || thrown ? str : traits.includes('propulsive') ? Math.floor(str / 2) : 0
  const jousting = !ranged && num(entry?.data.hands) === 1 && (
    c.level >= 4 && hasFeat(c, 'Favored Weapon Jousting') && isFavoredWeapon(c, entries, w.name)
    || c.level >= 4 && hasFeat(c, 'Verdant Weapon Jousting') && w.verdantWeapon
    || c.level >= 14 && hasFeat(c, 'Living Weapon Joust') && w.livingWeapon && canBeLivingWeapon(c, entries, w))
  const livingSource = w.name === HAFT_STRIKER_WEAPON.name ? haftStrikerSource(c, entries) : w
  const pristineLivingWeapon = c.level >= 14
    && ['Pristine Living Weapon', 'Living Weapon', 'Wild Hunter Dedication'].every((name) => hasFeat(c, name))
    && !!livingSource?.livingWeapon && canBeLivingWeapon(c, entries, livingSource)
  return {
    entry,
    pristineLivingWeapon,
    traits: [...new Set([...(entry?.traits ?? []),
      ...w.runes.map((rune) => runeName(rune)).filter((rune) => rune === 'Holy' || rune === 'Unholy'),
      ...(w.runes.some((rune) => runeName(rune) === 'Hooked') && !traits.includes('trip') ? ['Trip'] : []),
      ...(jousting && !traits.some((trait) => /^jousting\b/.test(trait)) ? ['Jousting'] : [])])],
    criticalSpecialization: isBlessedArmament(c, entries, w),
    ability,
    mod,
    prof,
    rank,
    item: w.potency,
    attack: mod + prof + w.potency,
    range: ranged ? num(entry?.data.range) : 0,
    damage: m ? `${dice}d${die}${flat ? signed(flat) : ''}${m[3] ? ` ${m[3]}` : ''}` : '',
  }
}

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

// Specific magic weapons/armor (Fractal Hook, ...) are not bases; AoN marks them by trait, subcategory or level above 0
export function isMagicItem(e: ContentEntry) {
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

// Fixed languages (Common, ancestry, class) plus how many more the character may pick
export function languageAllowance(c: Character, entries: ContentEntry[]) {
  const ancestry = byName(entries, 'ancestry', c.ancestry)
  const known = new Set(allLanguages(entries).map((l) => l.toLowerCase()))
  const fromAncestry = tokens(ancestry?.data.language).map(titleCase).filter((l) => known.has(l.toLowerCase()))
  const featGrants = c.feats.flatMap((f) => tokens(byName(entries, 'feat', f.name)?.data.grants_languages).map((l) => ({ lang: titleCase(l), source: f.name })))
    .filter((g) => known.has(g.lang.toLowerCase()))
  const fromFeats = featGrants.map((g) => g.lang)
  const sources: Record<string, string> = Object.fromEntries([
    ...fromAncestry.map((l) => [l.toLowerCase(), `${c.ancestry} Ancestry`]),
    ...(c.className ? CLASS_LANGUAGES[c.className] ?? [] : []).map((l) => [l.toLowerCase(), `${c.className} Class`]),
    ...featGrants.map((g) => [g.lang.toLowerCase(), g.source]),
  ])
  const locked = [...new Set(['Common', ...fromAncestry, ...(c.className ? CLASS_LANGUAGES[c.className] ?? [] : []), ...fromFeats])]
  const society = ranksAt(c, entries).Society ?? 0
  const feats = activeFeatsNamed(c, 'Multilingual').length * (2 + (society >= 3 ? 1 : 0) + (society >= 4 ? 1 : 0))
  return { locked, sources, slots: 1 + Math.max(0, abilityMod(c.abilities.int)) + feats }
}
