import { abilityMod, automaticFeatGrants, featTakenLevel, investigatorMethodologies, ranksAt } from './builder'
import { featRarity } from './featAccess'
import type { Character, ContentEntry } from './types'

export const STANDARD_SNARE_FORMULAS = ['Pit Illusion Snare', 'Shadow Cloak Snare']
export const BLACK_POWDER_FORMULA = 'Black Powder (Dose or Round)'
export const formulaKey = (name: string) => name.trim().toLowerCase()

export function isBlackPowderDose(entry: ContentEntry) {
  const name = formulaKey(entry.name)
  return /^black powder\b/.test(name) && /\b(?:dose|round)\b/.test(name) && !/\b(?:horn|keg)\b/.test(name)
}

export function isMunitionsAmmunition(entry: ContentEntry) {
  if (isBlackPowderDose(entry)) return true
  const category = `${entry.data.item_category ?? ''} ${entry.data.item_subcategory ?? ''} ${entry.data.weapon_category ?? ''}`
  const alchemical = entry.traits.some(trait => formulaKey(trait) === 'alchemical')
    || /\balchemical\b/i.test(category)
  return alchemical && /\bammunition\b/i.test(`${entry.name} ${category}`)
}

export function isMunitionsConsumable(entry: ContentEntry) {
  if (entry.deleted || !['item', 'weapon'].includes(entry.kind)
    || /\bblack powder\b.*\b(?:horn|keg)\b/i.test(entry.name)) return false
  const category = `${entry.data.item_category ?? ''} ${entry.data.item_subcategory ?? ''} ${entry.data.weapon_category ?? ''}`
  return isBlackPowderDose(entry) || entry.traits.some(trait => formulaKey(trait) === 'bomb')
    || /\bbomb\b/i.test(category) || isMunitionsAmmunition(entry)
}

const munitionsCache = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()
export function munitionsFormulaOptions(entries: ContentEntry[], systems: Character['systems']) {
  let cache = munitionsCache.get(entries)
  if (!cache) munitionsCache.set(entries, cache = new Map())
  const key = [...systems].sort().join()
  const cached = cache.get(key)
  if (cached) return cached
  const result = entries.filter(entry => isMunitionsConsumable(entry) && !isBlackPowderDose(entry)
    && entry.level === 1 && entry.systems.some(system => systems.includes(system))
    && !['Rare', 'Unique'].includes(featRarity(entry) ?? ''))
  cache.set(key, result)
  return result
}

export function munitionsLimits(c: Character) {
  if (!c.feats.some(feat => feat.name === 'Munitions Crafter' && featTakenLevel(feat) <= c.level)) return undefined
  return { formulaChoices: 4, prepared: 4 + Math.ceil(c.level / 2) }
}

export function updateFormulaChoice(values: string[], index: number, value: string) {
  const next = Array.from({ length: Math.max(values.length, index + 1) }, (_, i) => values[i] ?? '')
  next[index] = value
  return next
}

export function snareAdvancements(c: Character, entries: ContentEntry[]) {
  const dedication = c.feats.filter(feat => feat.name === 'Snarecrafter Dedication' && featTakenLevel(feat) <= c.level)
    .sort((a, b) => featTakenLevel(a) - featTakenLevel(b))[0]
  if (!dedication) return []
  const skill = (level: number) => {
    const ranks = ranksAt({ ...c, level }, entries, level + 1, false)
    return Math.max(ranks.Crafting ?? 0, c.className === 'Ranger' ? ranks.Survival ?? 0 : 0)
  }
  const advancements: { rank: number; level: number }[] = []
  const start = featTakenLevel(dedication)
  let previous = start > 1 ? skill(start - 1) : 0
  for (let level = start; level <= c.level; level++) {
    const before = level > 1 ? previous : 0
    const after = skill(level)
    for (let rank = Math.max(2, before + 1); rank <= Math.min(4, after); rank++) advancements.push({ rank, level })
    previous = after
  }
  return advancements
}

export function gadgetLimits(c: Character, entries: ContentEntry[]) {
  if (!c.feats.some(feat => feat.name === 'Gadget Specialist' && featTakenLevel(feat) <= c.level)) return undefined
  const crafting = ranksAt(c, entries).Crafting ?? 0
  const rank = crafting >= 4 ? 4 : crafting >= 3 ? 3 : 2
  const ubiquitous = c.feats.filter(feat => feat.name === 'Ubiquitous Gadgets' && featTakenLevel(feat) <= c.level)
    .sort((a, b) => featTakenLevel(a) - featTakenLevel(b))
  const extras = ubiquitous.length ? 1 + Number(ubiquitous.slice(1).some(feat => featTakenLevel(feat) >= 14)) : 0
  return { formulas: 3 * (rank - 1), prepared: rank + 2 * extras }
}

export function grenadeLimits(c: Character, entries: ContentEntry[]) {
  if (!c.feats.some(feat => feat.name === 'Grenade Specialist' && featTakenLevel(feat) <= c.level)) return undefined
  const rank = ranksAt(c, entries).Crafting ?? 0
  const plentiful = c.feats.filter(feat => feat.name === 'Plentiful Grenades' && featTakenLevel(feat) <= c.level)
    .sort((a, b) => featTakenLevel(a) - featTakenLevel(b))
  const extras = plentiful.length ? 1 + Number(plentiful.slice(1).some(feat => featTakenLevel(feat) >= 14)) : 0
  return { formulas: 2, prepared: (rank >= 4 ? 6 : rank >= 3 ? 4 : rank >= 2 ? 3 : 2) + 2 * extras }
}

export function cauldronLevels(c: Character) {
  if (!c.systems.includes('pf2e') || !c.feats.some(feat => feat.name === 'Cauldron' && featTakenLevel(feat) <= c.level)) return []
  return [1, 1, 1, 1, ...Array.from({ length: Math.max(0, Math.floor((c.level - 4) / 2) + 1) }, (_, i) => 4 + 2 * i)]
}

export function isCauldronConsumable(entry: ContentEntry) {
  return !entry.deleted && entry.kind === 'item' && entry.traits.some(trait => ['oil', 'potion'].includes(formulaKey(trait)))
    && !featRarity(entry)
}

export function isGrenade(entry: ContentEntry) {
  return !entry.deleted && entry.kind === 'item' && entry.traits.some(trait => formulaKey(trait) === 'grenade')
}

export function isInvestigatorAlchemyFormula(entry: ContentEntry) {
  const subcategory = String(entry.data.item_subcategory ?? '')
  return !entry.deleted && entry.kind === 'item'
    && /^(?:Alchemical Elixirs|Alchemical Tools)$/i.test(subcategory)
}

export function formulaSources(c: Character, entries: ContentEntry[]) {
  const active = c.feats.filter(feat => featTakenLevel(feat) <= c.level)
  const background = entries.find(entry => entry.kind === 'background' && entry.name === c.background)
  const backgroundFeats = String(background?.data.feat ?? '').split(',').map(formulaKey)
  const snareCrafting = active.some(feat => feat.name === 'Snare Crafting')
    || automaticFeatGrants(c, entries).some(feat => feat.name === 'Snare Crafting')
    || backgroundFeats.includes('snare crafting')
  const brastlewark = active.find(feat => feat.name === 'Brastlewark Snare Engineering')
  const munitionsCrafter = active.find(feat => feat.name === 'Munitions Crafter')
  return { snareCrafting, brastlewark, munitionsCrafter }
}

export function formulaGrants(c: Character, entries: ContentEntry[]) {
  const investigatorAlchemy = investigatorMethodologies(c, entries).includes('Alchemical Sciences')
    ? { formulas: c.level + 1, vials: Math.max(0, abilityMod(c.abilities.int)) } : undefined
  return { sources: formulaSources(c, entries), snares: snareAdvancements(c, entries),
    gadgets: gadgetLimits(c, entries), grenades: grenadeLimits(c, entries), munitions: munitionsLimits(c),
    cauldron: cauldronLevels(c), investigatorAlchemy }
}

export function knownFormulas(c: Character, entries: ContentEntry[], grants = formulaGrants(c, entries)) {
  const { sources: { snareCrafting, brastlewark, munitionsCrafter }, snares, gadgets, grenades, cauldron, investigatorAlchemy } = grants
  const groups = [
    { source: 'Alchemical Sciences', names: (c.investigatorAlchemicalFormulas ?? []).slice(0, investigatorAlchemy?.formulas ?? 0) },
    { source: 'Snare Crafting', names: snareCrafting ? c.snareFormulaChoices ?? [] : [] },
    ...snares.map(({ rank }) => ({
      source: 'Snarecrafter Dedication', names: (c.snareAdvancementFormulaChoices ?? []).slice((rank - 2) * 3, (rank - 1) * 3),
    })),
    { source: 'Gadget Specialist', names: (c.gadgetFormulaChoices ?? []).slice(0, gadgets?.formulas ?? 0) },
    { source: 'Grenade Specialist', names: (c.grenadeFormulaChoices ?? []).slice(0, grenades?.formulas ?? 0) },
    { source: 'Cauldron', names: (c.cauldronFormulaChoices ?? []).slice(0, cauldron.length) },
    { source: 'Munitions Crafter', names: munitionsCrafter
      ? [entries.find(entry => !entry.deleted && isBlackPowderDose(entry)
        && entry.systems.some(system => c.systems.includes(system)))?.name ?? BLACK_POWDER_FORMULA,
        ...(c.munitionsFormulaChoices ?? []).slice(0, 4)]
      : [] },
    { source: 'Brastlewark Snare Engineering', names: brastlewark
      ? c.brastlewarkFormulaMode === 'standard' ? STANDARD_SNARE_FORMULAS : c.brastlewarkFormulaMode === 'other' ? c.brastlewarkFormulaChoices ?? [] : []
      : [] },
    { source: 'Other', names: c.formulas ?? [] },
  ]
  const known = new Map<string, { name: string; source: string }>()
  for (const group of groups) for (const name of group.names) {
    if (typeof name === 'string' && name.trim() && !known.has(formulaKey(name))) known.set(formulaKey(name), { name, source: group.source })
  }
  return [...known.values()].sort((a, b) => a.name.localeCompare(b.name))
}
