import type { Character, ContentEntry } from './types'
import { activeFeatsNamed, classSpellcasting, classSpellSlots, selectedSubclass } from './builder'
import { attunementFamiliarAbilities, hasArcaneThesis } from './arcaneTheses'
import { hasDivineIntercession } from './divineIntercessions'
import { contentAccessGranted } from './featAccess'
import { getSettings } from './settings'

export const FAMILIAR_RESISTANCE_TYPES = ['acid', 'cold', 'electricity', 'fire', 'poison', 'sonic'] as const
export const FAMILIAR_SKILLS = [
  'Acrobatics', 'Arcana', 'Athletics', 'Crafting', 'Deception', 'Diplomacy', 'Intimidation', 'Medicine',
  'Nature', 'Occultism', 'Performance', 'Religion', 'Society', 'Survival', 'Thievery',
]

export const SQUOX_TRICKS_DESCRIPTION = 'A squox can Disarm or Trip with its tail using Acrobatics instead of Athletics, without a free hand. ' +
  'Against an off-guard target, it can attempt either maneuver against creatures up to two sizes larger and gains a +2 circumstance bonus.'

const key = (name: string) => name.trim().toLocaleLowerCase()

export const GLYPH_FAMILIAR_ABILITIES = ['Construct', 'Flier', 'Tough']

export function aquaticPetFamiliar(c: Character) {
  return getSettings().aquaticPetFamiliar && activeFeatsNamed(c, 'Friend of the Sea').length > 0
}

export function combineWaspAndAquaticFamiliar(c: Character) {
  return getSettings().combineWaspAndAquaticFamiliar && familiarSelection(c).wasp && aquaticPetFamiliar(c)
}

export function familiarSelection(c: Character) {
  const leshyGrant = activeFeatsNamed(c, 'Leshy Familiar').length > 0
  const undeadGrant = activeFeatsNamed(c, 'Undead Familiar').length > 0
  const spiritFamiliar = c.systems.includes('pf2e') && c.className === 'Animist'
    && activeFeatsNamed(c, 'Spirit Familiar (Animist)').length > 0
  const classFamiliar = c.className === 'Witch' ? 'normal'
    : c.className === 'Druid' && leshyGrant ? 'leshy'
    : spiritFamiliar ? 'normal'
    : undeadGrant ? 'undead' : leshyGrant ? 'leshy'
    : activeFeatsNamed(c, 'Familiar').some(feat => /^(?:Class|Archetype) Feat$/i.test(feat.type)
      || /^(?:class|archetype):/.test(feat.slot ?? '')) ? 'normal' : undefined
  const leshy = classFamiliar === 'leshy'
  const undeadFamiliar = classFamiliar === 'undead'
  const crocodileFamiliar = !classFamiliar && activeFeatsNamed(c, "Crocodile's Twin").length > 0
  const familiar = !!classFamiliar || crocodileFamiliar
    || ['Animal Accomplice', 'Familiar', 'Glyph Familiar'].some(name => activeFeatsNamed(c, name).length > 0)
    || hasArcaneThesis(c, 'Improved Familiar Attunement')
  const wasp = !familiar && hasDivineIntercession(c, 'Calistria', 'moderate-boon')
  const divineEmissary = activeFeatsNamed(c, 'Divine Emissary').length > 0 ? 1 : 0
  const leshySecret = leshy && activeFeatsNamed(c, 'Leshy Familiar Secrets').length > 0 ? 1 : 0
  const glyph = !classFamiliar && c.systems.includes('pf2e') && activeFeatsNamed(c, 'Glyph Familiar').length > 0
  const witchAbilities = c.className === 'Witch' ? 2 + [6, 12, 18].filter(level => c.level >= level).length : 0
  const dailyAbilityLimit = (undeadFamiliar
    ? activeFeatsNamed(c, 'Enhanced Undead Familiar').length
      ? c.level >= 10 && activeFeatsNamed(c, 'Incredible Undead Familiar').length ? 5 : 3 : 1
    : glyph ? (activeFeatsNamed(c, 'Enhanced Glyph Familiar').length ? 2 : 1)
    : activeFeatsNamed(c, 'Incredible Familiar').length ? 6 : activeFeatsNamed(c, 'Enhanced Familiar').length ? 4 : 2)
    + witchAbilities + divineEmissary + leshySecret + attunementFamiliarAbilities(c)
  return { leshy, undeadFamiliar, crocodileFamiliar, familiar, wasp, spiritFamiliar, dailyAbilityLimit, glyph }
}

export function purifyAirAvailable(c: Character) {
  const feat = activeFeatsNamed(c, 'Leshy Familiar Secrets')[0]
  return familiarSelection(c).leshy && !!feat && (feat.choice ?? c.familiar?.leshySecret) === 'Purify Air'
}

export function purifyAirActive(c: Character) {
  return !!c.familiar?.purifyAirActive && purifyAirAvailable(c)
}

export function witchPatronFamiliarAbility(c: Character, entries: ContentEntry[]) {
  const selected = c.className === 'Witch' ? selectedSubclass(c, entries) : undefined
  if (!selected) return undefined
  const patron = entries.find(entry => entry.kind === 'subclass' && !entry.deleted && entry.data.class === 'Witch'
    && entry.name.trim().toLowerCase() === selected.trim().toLowerCase()
    && entry.systems.some(system => c.systems.includes(system))
    && typeof entry.data.grants_familiar_ability === 'string')
  const name = patron?.data.grants_familiar_ability
  if (!patron || typeof name !== 'string' || !name) return undefined
  return {
    id: `${patron.id}:familiar-ability`,
    systems: patron.systems,
    kind: 'familiar' as const,
    source: patron.source,
    name,
    level: 1,
    traits: [],
    description: String(patron.data.familiar_ability_description ?? ''),
    data: { ability_type: 'Patron' },
    effects: [],
    updatedAt: patron.updatedAt,
  }
}

export function familiarAbilityCapacity(c: Character, entries: ContentEntry[]) {
  const dailyAbilityLimit = familiarSelection(c).dailyAbilityLimit
  const patronAbility = witchPatronFamiliarAbility(c, entries)
  return {
    dailyAbilityLimit,
    selectableAbilityLimit: Math.max(0, dailyAbilityLimit - Number(!!patronAbility)),
    patronAbility,
  }
}

export function specificFamiliarAbilityName(grant: string) {
  return grant.replace(/\s*\(.*\)$/, '').trim()
}

export function familiarAbilitySlots(c: Character, entries: ContentEntry[], isWasp = false) {
  const capacity = familiarAbilityCapacity(c, entries)
  const state = familiarSelection(c)
  const emissaryChoice = !isWasp ? activeFeatsNamed(c, 'Divine Emissary')[0]?.choice : undefined
  const emissaryAbility = emissaryChoice && isDivineEmissaryAbility(emissaryChoice) ? emissaryChoice : undefined
  const leshySecret = !isWasp && state.leshy && activeFeatsNamed(c, 'Leshy Familiar Secrets').length > 0
    ? activeFeatsNamed(c, 'Leshy Familiar Secrets')[0]?.choice ?? c.familiar?.leshySecret : undefined
  const leshyChoice = !isWasp && state.leshy
    ? activeFeatsNamed(c, 'Leshy Familiar')[0]?.choice ?? c.familiar?.leshyAbility : undefined
  const leshyAbility = leshyChoice === 'Plant' || leshyChoice === 'Fungus' ? leshyChoice : undefined
  const patronAbility = isWasp ? undefined : capacity.patronAbility
  const baseSelectableLimit = patronAbility ? capacity.selectableAbilityLimit : capacity.dailyAbilityLimit
  const specificFamiliars = isWasp || state.glyph || state.leshy ? [] : specificFamiliarOptions(c, entries)
  const name = isWasp || state.glyph || state.leshy ? undefined : state.spiritFamiliar ? 'Spirit Familiar'
    : state.undeadFamiliar && c.systems.includes('pf2e') ? 'Undead Familiar' : c.familiar?.specificFamiliar
  const selectedSpecificOption = specificFamiliars.find(option => key(option.entry.name) === key(name ?? ''))
  const selectedSpecific = selectedSpecificOption?.entry
  const activeSpecific = selectedSpecific && contentAccessGranted(c, selectedSpecific)
    && (specificFamiliarRequirement(selectedSpecific) > 0 || state.spiritFamiliar || state.undeadFamiliar) && selectedSpecificOption?.available ? selectedSpecific : undefined
  const selectableAbilityLimit = baseSelectableLimit - (activeSpecific ? selectedSpecificOption?.required ?? 0 : 0)
    - Number(!!emissaryAbility) - Number(!isWasp && state.leshy && activeFeatsNamed(c, 'Leshy Familiar Secrets').length > 0)
  return { patronAbility, dailyAbilityLimit: capacity.dailyAbilityLimit, specificFamiliars, selectedSpecific,
    activeSpecific, selectableAbilityLimit, emissaryAbility, leshySecret, leshyAbility }
}

export function activeFamiliarAbilities(c: Character, entries: ContentEntry[]) {
  const state = familiarSelection(c)
  const aquatic = aquaticPetFamiliar(c)
  const aquaticChoices = aquatic ? (c.pet?.abilities ?? []).filter(name => !!name && !['darkvision', 'tough'].includes(key(name))).slice(0, 2) : []
  const catalog = familiarAbilityEntries(entries, c)
  if (combineWaspAndAquaticFamiliar(c)) {
    const waspLimit = familiarAbilitySlots(c, entries, true).selectableAbilityLimit
    const choices = [...(c.waspFamiliar?.abilities ?? []).slice(0, waspLimit), ...aquaticChoices]
    const grants = ['Darkvision', 'Tough', 'Burrower', 'Flier']
    return [...choices.flatMap((name, index) => {
      const entry = familiarAbilityEntry(name, catalog, c)
      if (!entry || /^specific familiar\b/i.test(String(entry.data.ability_type ?? ''))) return []
      const others = [...grants, ...choices.filter((_, otherIndex) => otherIndex !== index)]
      return familiarAbilityUnavailableReason(entry, c, others, state.undeadFamiliar, entries, choices.slice(0, index)) ? [] : [entry.name]
    }), ...grants]
  }
  const aquaticAbilities = aquaticChoices.flatMap((name, index) => {
    const entry = familiarAbilityEntry(name, catalog, c)
    if (!entry || /^specific familiar\b/i.test(String(entry.data.ability_type ?? ''))) return []
    const others = ['Darkvision', 'Tough', ...aquaticChoices.filter((_, otherIndex) => otherIndex !== index)]
    return familiarAbilityUnavailableReason(entry, c, others, false, entries, aquaticChoices.slice(0, index), true) ? [] : [entry.name]
  })
  if (!state.familiar && !state.wasp) return aquaticAbilities
  const data = state.wasp ? c.waspFamiliar : c.familiar
  const { activeSpecific, selectableAbilityLimit, emissaryAbility, leshySecret, leshyAbility } = familiarAbilitySlots(c, entries, state.wasp)
  const grants = activeSpecific
    ? specificFamiliarGrants(activeSpecific).abilities : state.glyph && !state.wasp ? GLYPH_FAMILIAR_ABILITIES
      : leshyAbility ? [leshyAbility] : []
  const choices = (data?.abilities ?? []).filter(name => !emissaryAbility || !isDivineEmissaryAbility(name))
    .slice(0, selectableAbilityLimit)
  return [...choices.flatMap((name, index) => {
    const entry = familiarAbilityEntry(name, catalog, c)
    if (!entry || /^specific familiar\b/i.test(String(entry.data.ability_type ?? ''))) return []
    const others = [...grants, ...(emissaryAbility ? [emissaryAbility] : []), ...choices.filter((_, otherIndex) => otherIndex !== index)]
    return familiarAbilityUnavailableReason(entry, c, others, state.undeadFamiliar, entries, choices.slice(0, index)) ? [] : [entry.name]
  }), ...(emissaryAbility && (key(emissaryAbility) !== 'medic' || familiarMedicRank(c) !== undefined) ? [emissaryAbility] : []),
  ...(leshySecret ? [leshySecret] : []), ...grants, ...aquaticAbilities]
}

export function familiarSpellBenefits(c: Character, entries: ContentEntry[], slots: Record<number, number>) {
  const active = activeFamiliarAbilities(c, entries).map(key)
  const highestRank = Math.max(0, ...Object.entries(slots)
    .filter(([rank, count]) => Number(rank) > 0 && count > 0
      && !(c.className === 'Necromancer' && Number(rank) === 10)).map(([rank]) => Number(rank)))
  return {
    cantrip: active.includes('cantrip connection') && (slots[0] ?? 0) > 0,
    batteryRank: active.includes('spell battery') && highestRank >= 4 ? highestRank - 3 : undefined,
  }
}

const familiarEntryCache = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()
const EMISSARY_ABILITIES: Record<string, string> = {
  Erudite: "Your familiar gains 1 reaction at the start of its turns, which it can use only to Aid you on a Religion check. It automatically succeeds its check to Aid you with Religion checks, or automatically critically succeeds if you're a master in Religion.",
  Luminous: 'Your familiar sheds bright light in a 30-foot radius and dim light for the next 30 feet. It can suppress or resume this light by using an action, which has the concentrate trait.',
  Medic: 'Your familiar can Cast a Spell once per day: the 1-action version of heal at a rank 2 lower than your highest-rank spell slot, only on you. You must be able to cast 3rd-rank spells from spell slots to select this ability.',
  Radiant: 'Your familiar gains resistance to evil and negative damage equal to half your level.',
}
const emissaryNames = new Set(Object.keys(EMISSARY_ABILITIES).map(key))
export const isDivineEmissaryAbility = (name: string) => emissaryNames.has(key(name))
export const LESHY_SECRET_ABILITIES = ['Grasping Tendrils', 'Purify Air', 'Verdant Burst'] as const
export const PURIFY_AIR_DESCRIPTION = 'Recycles air for one Medium creature in stale air; creatures within 15 feet gain +2 circumstance to saves against inhaled poison, olfactory, and other breathing-dependent effects, at GM discretion.'

export function familiarMedicRank(c: Character) {
  const slots = classSpellSlots(c) ?? c.spellcasting?.slots
  const highest = Math.max(0, ...Object.entries(slots ?? {})
    .filter(([rank, count]) => Number(rank) > 0 && count > 0).map(([rank]) => Number(rank)))
  return highest >= 3 ? highest - 2 : undefined
}

export function familiarAbilityEntries(entries: ContentEntry[], c: Character) {
  const base = baseFamiliarAbilityEntries(entries, c)
  const emissary = activeFeatsNamed(c, 'Divine Emissary').length ? Object.entries(EMISSARY_ABILITIES).map(([name, description]): ContentEntry => ({
    id: `divine-emissary:${key(name)}`, systems: c.systems, kind: 'familiar', source: 'official', name, level: 1,
    traits: [], description, data: { ability_type: 'Divine Emissary',
      ...(name === 'Erudite' ? { actions: 'Reaction' } : name === 'Luminous' ? { actions: 'Single Action' } : {}) },
    effects: [], updatedAt: 0,
  })) : []
  const leshy = familiarSelection(c).leshy && activeFeatsNamed(c, 'Leshy Familiar Secrets').length
    ? LESHY_SECRET_ABILITIES.map((name): ContentEntry => ({
      id: `leshy-secret:${key(name)}`, systems: c.systems, kind: 'familiar', source: 'official', name, level: 1,
      traits: [], description: '', data: { ability_type: 'Leshy Familiar Secrets' }, effects: [], updatedAt: 0,
    })) : []
  const leshyForms = familiarSelection(c).leshy ? ['Plant', 'Fungus'].map((name): ContentEntry => ({
    id: `leshy-familiar:${key(name)}`, systems: c.systems, kind: 'familiar', source: 'official', name, level: 1,
    traits: [], description: `Your familiar has the ${name.toLowerCase()} trait instead of the animal trait.`,
    data: { ability_type: 'Leshy Familiar' }, effects: [], updatedAt: 0,
  })) : []
  const squoxTricks: ContentEntry[] = c.systems.includes('sf2e') && !base.some(entry => key(entry.name) === 'squox tricks'
    && key(String(entry.data.ability_type ?? '')) === 'specific familiar - squox') ? [{
    id: 'homebrew:specific-familiar:squox-tricks', systems: ['sf2e'], kind: 'familiar' as const, source: 'homebrew' as const,
    name: 'Squox Tricks', level: 1, traits: [], description: SQUOX_TRICKS_DESCRIPTION,
    data: { ability_type: 'Specific Familiar - Squox' }, effects: [], updatedAt: 0,
  }] : []
  return emissary.length || leshy.length || leshyForms.length || squoxTricks.length
    ? [...base, ...emissary, ...leshy, ...leshyForms, ...squoxTricks] : base
}

function baseFamiliarAbilityEntries(entries: ContentEntry[], c: Character) {
  let bySystems = familiarEntryCache.get(entries)
  if (!bySystems) familiarEntryCache.set(entries, bySystems = new Map())
  const systemsKey = c.systems.join()
  let result = bySystems.get(systemsKey)
  if (!result) bySystems.set(systemsKey, result = computeFamiliarAbilityEntries(entries, c))
  return result
}

function computeFamiliarAbilityEntries(entries: ContentEntry[], c: Character) {
  const seen = new Set<string>()
  return entries.filter(entry => entry.kind === 'familiar').sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).filter(entry => {
    if (entry.deleted || /^pet\b/i.test(String(entry.data.ability_type ?? ''))
      || !entry.systems.some(system => c.systems.includes(system))) return false
    const identity = `${key(entry.name)}:${key(String(entry.data.ability_type ?? 'familiar'))}`
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

export function familiarAbilityEntry(name: string, entries: ContentEntry[], c: Character) {
  return familiarAbilityEntries(entries, c).find(entry => key(entry.name) === key(name))
}

export function isFamiliarAbilityRepeatable(entry: ContentEntry) {
  return /\b(?:select|choose) this ability repeatedly\b|\bselect(?:ing)? this (?:familiar|master) ability more than once\b/i.test(entry.description)
}

function changesCreatureTrait(entry: ContentEntry) {
  return /\b(?:has|gains|takes on|changes to|becomes)\b[\s\S]{0,100}\btrait\b/i.test(entry.description)
    || /\btrait instead of the\b/i.test(entry.description)
}

export function familiarAbilityUnavailableReason(entry: ContentEntry, c: Character, selected: string[], undead = false,
  entries: ContentEntry[] = [], selectedChoices = selected, independent = false) {
  const spellcasting = classSpellcasting(c, entries) ?? c.spellcasting
  const slots = classSpellSlots(c) ?? c.spellcasting?.slots
  if (undead && (/^(?:constructed?|dragon)$/i.test(entry.name) || changesCreatureTrait(entry))) {
    return 'An undead familiar cannot select an ability that changes its trait.'
  }
  if (!independent && (familiarSelection(c).leshy || familiarSelection(c).glyph)
    && (/^(?:constructed?|dragon|plant|fungus)$/i.test(entry.name) || changesCreatureTrait(entry))) {
    return 'This familiar already has an ability that changes its trait.'
  }
  if (selected.some(name => key(name) === 'dragon') && key(entry.name) !== 'dragon'
    && (/^(?:constructed?|plant|fungus)$/i.test(entry.name) || changesCreatureTrait(entry))) {
    return 'This familiar already has an ability that changes its trait.'
  }
  if (selected.some(name => key(name) === key(entry.name)) && !isFamiliarAbilityRepeatable(entry)) {
    return 'This ability has already been selected.'
  }
  const selectedNames = new Set(selected.map(key))
  const emissary = !independent && activeFeatsNamed(c, 'Divine Emissary').length > 0
  if (emissaryNames.has(key(entry.name))) {
    if (!emissary) return 'Requires the Divine Emissary feat.'
    if (selected.some(name => emissaryNames.has(key(name)))) {
      return 'Only one divine emissary familiar ability can be selected at a time.'
    }
    if (key(entry.name) === 'medic' && familiarMedicRank(c) === undefined) {
      return 'Requires spell slots of rank 3 or higher.'
    }
  } else if (emissary && selectedChoices.filter(name => !isDivineEmissaryAbility(name)).length
    >= familiarAbilitySlots(c, entries).selectableAbilityLimit - Number(!familiarAbilitySlots(c, entries).emissaryAbility)) {
    return 'The extra slot from Divine Emissary can only hold a divine emissary familiar ability.'
  }
  const abilityPrerequisites = [...entry.description.matchAll(/(?:familiar|it) must have (?:the )?\[?([a-z][a-z -]*?)\]?(?:\([^)]*\))? ability/gi)]
    .map(match => key(match[1]))
  const missingAbility = abilityPrerequisites.find(name => !selectedNames.has(name))
  if (missingAbility) return `Requires the ${missingAbility} familiar ability.`
  const level = /\byou must be at least (\d+)(?:st|nd|rd|th) level\b/i.exec(entry.description)
  if (level && c.level < Number(level[1])) return `Requires level ${level[1]}.`
  const spellRank = /\byou must be able to cast (\d+)(?:st|nd|rd|th)-(?:level|rank) spells using spell slots\b/i.exec(entry.description)
  if (spellRank) {
    const requiredRank = Number(spellRank[1])
    const hasRank = Object.entries(slots ?? {}).some(([rank, count]) => Number(rank) >= requiredRank && count > 0)
    if (!hasRank) return `Requires spell slots of rank ${requiredRank} or higher.`
  }
  if (/\byou must have quick alchemy\b/i.test(entry.description)
    && c.className !== 'Alchemist' && !c.feats.some(feat => feat.name === 'Quick Alchemy')) {
    return 'Requires Quick Alchemy.'
  }
  if (/\byou must be able to prepare cantrips or add them to your repertoire\b/i.test(entry.description) && !spellcasting) {
    return 'Requires spellcasting that prepares cantrips or has a repertoire.'
  }
  if (key(entry.name) === 'skilled' && !spellcasting?.ability) return 'Requires a spellcasting ability modifier.'
  if (/\byour familiar must be an animal\b/i.test(entry.description)
    && (undead || !independent && c.feats.some(feat => ['Leshy Familiar', 'Undead Familiar'].includes(feat.name)))) {
    return 'Requires an animal familiar.'
  }
  if (/\byour familiar must have the speech ability\b/i.test(entry.description)
    && !selectedNames.has('speech')) return 'Requires the Speech familiar ability.'
  return undefined
}

export function minionMovementSpeeds(abilities: string[], fastMovement?: string, aquatic = false) {
  const selected = abilities.map(key)
  const has = (name: string) => selected.includes(key(name))
  const amphibious = has('Amphibious')
  const speeds = [
    ...(!aquatic || amphibious ? [{ movement: 'Land', feet: 25 }] : []),
    ...(aquatic || amphibious ? [{ movement: 'Swim', feet: 25 }] : []),
    ...(has('Burrower') ? [{ movement: 'Burrow', feet: 5 }] : []),
    ...(has('Climber') ? [{ movement: 'Climb', feet: 25 }] : []),
    ...(has('Flier') ? [{ movement: 'Fly', feet: 25 }] : []),
  ]
  const eligible = speeds.filter(speed => speed.feet === 25)
  const chosen = eligible.find(speed => speed.movement === fastMovement) ?? eligible[0]
  return speeds.map(speed => ({
    ...speed,
    feet: has('Fast Movement') && (speed.movement === chosen?.movement
      || amphibious && ['Land', 'Swim'].includes(speed.movement) && ['Land', 'Swim'].includes(chosen?.movement ?? ''))
      ? 40 : speed.feet,
  }))
}

export function familiarAbilityEffects(abilities: string[], level: number,
  options?: NonNullable<Character['familiar']>['abilityOptions'], spellcastingModifier = 0, aquatic = false) {
  const selected = abilities.map(key)
  const has = (name: string) => selected.includes(key(name))
  const resistanceRank = has('Major Resistance') ? level
    : has('Greater Resistance') ? 3 + Math.floor(level / 2)
      : has('Resistance') ? Math.max(1, Math.floor(level / 2)) : 0
  const resistanceTypes = (options?.resistance ?? []).filter((type): type is typeof FAMILIAR_RESISTANCE_TYPES[number] =>
    FAMILIAR_RESISTANCE_TYPES.includes(type as typeof FAMILIAR_RESISTANCE_TYPES[number]))
  const skillModifier = level + spellcastingModifier
  return {
    hitPoints: level * (5 + (has('Tough') ? 2 : 0)),
    speeds: getSettings().familiarFastMovementAllSpeeds && has('Fast Movement')
      ? minionMovementSpeeds(abilities.filter(ability => key(ability) !== 'fast movement'), undefined, aquatic)
        .map(speed => ({ ...speed, feet: speed.feet + 15 }))
      : minionMovementSpeeds(abilities, options?.fastMovement, aquatic),
    senses: [
      ...(has('Darkvision') ? ['Darkvision'] : []),
      ...(has('Scent') ? ['Scent (imprecise, 30 feet)'] : []),
      ...(has('Echolocation') ? ['Hearing (precise, 20 feet)'] : []),
      ...(has('Tremorsense') ? ['Tremorsense (imprecise, 30 feet)'] : []),
      ...(has('Wavesense') ? ['Wavesense (imprecise, 30 feet)'] : []),
    ],
    resistances: [...resistanceTypes.map(type => ({ damage: type, value: resistanceRank })),
      ...(has('Radiant') ? ['evil', 'negative'].map(damage => ({ damage, value: Math.floor(level / 2) })) : [])],
    skilled: (options?.skilled ?? []).filter(skill => [...FAMILIAR_SKILLS, 'Perception'].includes(skill))
      .map(skill => ({ skill, modifier: skillModifier })),
  }
}

const isSpecificFamiliar = (entry: ContentEntry) => /^specific familiar\b/i.test(String(entry.data.ability_type ?? ''))

export function specificFamiliarRequirement(entry: ContentEntry): number {
  const text = `${entry.data.required_abilities ?? entry.data.required_number_of_abilities ?? ''} ${entry.description}`
  const required = /required number of abilities\W*(\d+)/i.exec(text)?.[1]
    ?? /^\s*(\d+)\s*$/.exec(String(entry.data.required_abilities ?? entry.data.required_number_of_abilities ?? ''))?.[1]
  if (required !== undefined) return Number(required)
  const fallback = FALLBACK_SPECIFIC_FAMILIARS.find(item => key(item.name) === key(entry.name))
  return fallback && fallback !== entry ? specificFamiliarRequirement(fallback) : 0
}

const SPIRIT_FAMILIAR_ID = 'fallback:specific-familiar:spirit-familiar'
const UNDEAD_FAMILIAR_ID = 'fallback:specific-familiar:undead-familiar'

const FALLBACK_SPECIFIC_FAMILIARS: ContentEntry[] = [{
  id: 'fallback:specific-familiar:calligraphy-wyrm', name: 'Calligraphy Wyrm', kind: 'familiar', systems: ['pf2e'], source: 'official', level: 0,
  traits: ['Uncommon', 'Dragon'],
  description: 'Required Number of Abilities 6\n\nCalligraphy wyrms are curious dragons constantly in search of new lore and writing. They make natural allies for academics of all stripes, whether remaining in the towers of Cobyslarni or heading into fieldwork like the Pathfinder Society, but are also found working with witches contracted to draconic powers or wizards who\u2019ve somehow managed to impress the tiny creatures.\n\nWhile knowledgeable, calligraphy wyrms can also be know-it-alls. Their chirpy, high-pitched voices make this attitude humorous to some and insufferable to others.\n\nGranted Abilities darkvision, flier, manual dexterity, scent, skilled (arcana, society), speech\n\nInk Spray (one action, Arcane) Frequency once per 10 minutes; Effect The wyrm splatters ink in a 10-foot cone. Each creature in the area must attempt a Reflex save with a DC equal to its master\u2019s spell DC or class DC, whichever is higher. Critical Success The creature is unaffected. Success If the creature was invisible, it is concealed instead for 2 rounds. Failure As success, but for 1 minute. Critical Failure As success, but for 10 minutes. The creature is also blinded for 1 round or until it wipes the ink from its eyes using an Interact action.\n\nStylus Claws The wyrm has stylus-shaped claws that it can fill with its natural ink, using its claw as a pen without having to purchase ink.',
  data: { ability_type: 'Specific Familiar', required_abilities: 6, access: 'affiliation with Cobyslarni or the Pathfinder Society' }, effects: [], updatedAt: 0,
}, {
  id: 'fallback:specific-familiar:spirit-familiar', name: 'Spirit Familiar', kind: 'familiar', systems: ['pf2e'], source: 'official', level: 0,
  traits: ['Spirit'], description: 'Required Number of Abilities 0\n\nAn apparition manifests as your familiar after daily preparations.',
  data: { ability_type: 'Specific Familiar', required_abilities: 0 }, effects: [], updatedAt: 0,
}, {
  id: 'fallback:specific-familiar:undead-familiar', name: 'Undead Familiar', kind: 'familiar', systems: ['pf2e'], source: 'official', level: 0,
  traits: ['Undead'], description: 'Required Number of Abilities 0\n\nYour familiar is an undead creature infused with void energy.',
  data: { ability_type: 'Specific Familiar', required_abilities: 0 }, effects: [], updatedAt: 0,
}, {
  id: 'homebrew:specific-familiar:nine-tailed-fox', name: 'Nine-Tailed Fox', kind: 'familiar', systems: ['pf2e'], source: 'homebrew', level: 0,
  traits: [], description: '', data: { ability_type: 'Specific Familiar', required_abilities: 1, granted_abilities: 'Scent' },
  effects: [], updatedAt: 0,
}, {
  id: 'homebrew:specific-familiar:squox', name: 'Squox', kind: 'familiar', systems: ['sf2e'], source: 'homebrew', level: 0,
  traits: ['Tiny', 'Animal'],
  description: 'A highly adaptable vulpine mammal native to Castrovel, known for its elaborate calls and fondness for shiny objects.',
  data: { ability_type: 'Specific Familiar', required_abilities: 2, granted_abilities: 'Scent, Climber, Skilled (Acrobatics)' },
  effects: [], updatedAt: 0,
}]

export function specificFamiliarOptions(c: Character, entries: ContentEntry[]) {
  const reduction = activeFeatsNamed(c, 'Improved Familiar').length ? 2 : 0
  const state = familiarSelection(c)
  const abilities = familiarAbilityCapacity(c, entries).selectableAbilityLimit - Number(activeFeatsNamed(c, 'Divine Emissary').length > 0)
    - Number(state.leshy && activeFeatsNamed(c, 'Leshy Familiar Secrets').length > 0)
  const official = familiarAbilityEntries(entries, c).filter(isSpecificFamiliar)
  const known = new Set(official.map(entry => key(entry.name)))
  if (state.spiritFamiliar) {
    const spirit = FALLBACK_SPECIFIC_FAMILIARS.find(entry => entry.id === SPIRIT_FAMILIAR_ID)!
    return [{ entry: spirit, required: 0, available: true }]
  }
  if (state.undeadFamiliar && c.systems.includes('pf2e')) {
    const undead = FALLBACK_SPECIFIC_FAMILIARS.find(entry => entry.id === UNDEAD_FAMILIAR_ID)!
    return [{ entry: undead, required: 0, available: true }]
  }
  return [...official, ...FALLBACK_SPECIFIC_FAMILIARS.filter(entry => entry.id !== SPIRIT_FAMILIAR_ID && entry.id !== UNDEAD_FAMILIAR_ID
    && entry.systems.some(system => c.systems.includes(system)) && !known.has(key(entry.name)))].map(entry => {
    const required = Math.max(0, specificFamiliarRequirement(entry) - reduction)
    return { entry, required, available: abilities >= required }
  })
}

const titleCase = (text: string) => text.replace(/\b\w/g, letter => letter.toUpperCase())

const GRANTED_LIST = /\bGranted Abilities\W+((?:[a-z][a-z' -]*(?:\([^)]*\))?(?:,\s*)?)+)/

const builtInSpecific = (entry?: ContentEntry) =>
  FALLBACK_SPECIFIC_FAMILIARS.find(item => key(item.name) === key(entry?.name ?? ''))

export function specificFamiliarGrants(entry?: ContentEntry): { abilities: string[]; skilled: string[] } {
  const parsed = parseSpecificGrants(entry)
  const builtIn = builtInSpecific(entry)
  const grants = !parsed.abilities.length && builtIn && builtIn !== entry ? parseSpecificGrants(builtIn) : parsed
  return hasInherentDragonTrait(entry) && !grants.abilities.some(ability => key(ability) === 'dragon')
    ? { ...grants, abilities: [...grants.abilities, 'Dragon'] } : grants
}

function hasInherentDragonTrait(entry?: ContentEntry) {
  return !!entry && isSpecificFamiliar(entry) && [...entry.traits, ...(builtInSpecific(entry)?.traits ?? [])]
    .some(trait => key(trait) === 'dragon')
}

export function specificFamiliarInherentDragon(entry?: ContentEntry) {
  if (!hasInherentDragonTrait(entry)) return false
  const parsed = parseSpecificGrants(entry)
  const fallback = builtInSpecific(entry)
  const grants = !parsed.abilities.length && fallback && fallback !== entry ? parseSpecificGrants(fallback) : parsed
  return !grants.abilities.some(ability => key(ability) === 'dragon')
}

export function specificFamiliarGrantedLabels(entry?: ContentEntry): string[] {
  const raw = String(entry?.data.granted_abilities ?? '') || GRANTED_LIST.exec(entry?.description ?? '')?.[1] || ''
  const fallback = builtInSpecific(entry)
  if (!raw && fallback && fallback !== entry) return specificFamiliarGrantedLabels(fallback)
  const labels = raw.split(/,(?![^()]*\))/).map(item => titleCase(item.trim().replace(/[.;]$/, ''))).filter(Boolean)
  if (hasInherentDragonTrait(entry) && !labels.some(label => key(label) === 'dragon')) labels.push('Dragon')
  return labels
}

function parseSpecificGrants(entry?: ContentEntry) {
  const raw = String(entry?.data.granted_abilities ?? '') || GRANTED_LIST.exec(entry?.description ?? '')?.[1] || ''
  const abilities: string[] = []
  const skilled: string[] = []
  for (const part of raw.split(/,(?![^()]*\))/).map(item => item.trim().replace(/[.;]$/, '')).filter(Boolean)) {
    const skills = /^skilled\s*\(([^)]*)\)/i.exec(part)
    if (skills) {
      abilities.push('Skilled')
      skilled.push(...skills[1].split(/,|\band\b/).map(skill => titleCase(skill.trim())).filter(skill => FAMILIAR_SKILLS.includes(skill)))
    } else abilities.push(titleCase(part))
  }
  return { abilities, skilled }
}

export function selectedSpecificFamiliar(c: Character, entries: ContentEntry[]) {
  const name = c.familiar?.specificFamiliar
  return name ? specificFamiliarOptions(c, entries).find(option => option.entry.name === name)?.entry : undefined
}

export function specificFamiliarSections(entry?: ContentEntry): { summary: string[]; abilities: string[] } {
  const parsed = parseSpecificSections(entry)
  const builtIn = builtInSpecific(entry)
  return !parsed.abilities.length && builtIn && builtIn !== entry ? parseSpecificSections(builtIn) : parsed
}

function parseSpecificSections(entry?: ContentEntry) {
  const clean = (parts: string[]) => parts.map(part => part.trim()).filter(part => part && !/^(?:Source|Required Number of Abilities)\b/i.test(part))
  const paragraphs = (entry?.description ?? '').split(/\n\s*\n/)
  const boundary = paragraphs.findIndex(part => /\bGranted Abilities\b/i.test(part))
  if (boundary < 0) return { summary: clean(paragraphs.slice(0, 1)), abilities: [] as string[] }
  const match = GRANTED_LIST.exec(paragraphs[boundary])
  const rest = match ? paragraphs[boundary].slice(match.index + match[0].length) : ''
  return { summary: clean([...paragraphs.slice(0, boundary), ...rest ? [rest] : []]), abilities: clean(paragraphs.slice(boundary + 1)) }
}
