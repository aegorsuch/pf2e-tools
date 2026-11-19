import type { Character, ContentEntry } from './types'
import { activeFeatsNamed, classSpellcasting, classSpellSlots } from './builder'
import { hasDivineIntercession } from './divineIntercessions'

export const FAMILIAR_RESISTANCE_TYPES = ['acid', 'cold', 'electricity', 'fire', 'poison', 'sonic'] as const
export const FAMILIAR_SKILLS = [
  'Arcana', 'Athletics', 'Crafting', 'Deception', 'Diplomacy', 'Intimidation', 'Medicine',
  'Nature', 'Occultism', 'Performance', 'Religion', 'Society', 'Survival', 'Thievery',
]

const key = (name: string) => name.trim().toLocaleLowerCase()

export function familiarSelection(c: Character) {
  const leshyGrant = activeFeatsNamed(c, 'Leshy Familiar').length > 0
  const undeadGrant = activeFeatsNamed(c, 'Undead Familiar').length > 0
  const classFamiliar = c.className === 'Witch' ? 'normal'
    : c.className === 'Druid' && leshyGrant ? 'leshy'
    : undeadGrant ? 'undead' : leshyGrant ? 'leshy'
    : activeFeatsNamed(c, 'Familiar').some(feat => /^(?:Class|Archetype) Feat$/i.test(feat.type)
      || /^(?:class|archetype):/.test(feat.slot ?? '')) ? 'normal' : undefined
  const leshy = classFamiliar === 'leshy'
  const undeadFamiliar = classFamiliar === 'undead'
  const crocodileFamiliar = !classFamiliar && activeFeatsNamed(c, "Crocodile's Twin").length > 0
  const familiar = !!classFamiliar || crocodileFamiliar
    || ['Animal Accomplice', 'Familiar'].some(name => activeFeatsNamed(c, name).length > 0)
  const wasp = !familiar && hasDivineIntercession(c, 'Calistria', 'moderate-boon')
  const witchAbilities = c.className === 'Witch' ? 2 + [6, 12, 18].filter(level => c.level >= level).length : 0
  const dailyAbilityLimit = (undeadFamiliar
    ? activeFeatsNamed(c, 'Enhanced Undead Familiar').length
      ? c.level >= 10 && activeFeatsNamed(c, 'Incredible Undead Familiar').length ? 5 : 3 : 1
    : activeFeatsNamed(c, 'Incredible Familiar').length ? 6 : activeFeatsNamed(c, 'Enhanced Familiar').length ? 4 : 2)
    + witchAbilities
  return { leshy, undeadFamiliar, crocodileFamiliar, familiar, wasp, dailyAbilityLimit }
}

export function activeFamiliarAbilities(c: Character, entries: ContentEntry[]) {
  const state = familiarSelection(c)
  if (!state.familiar && !state.wasp) return []
  const data = state.wasp ? c.waspFamiliar : c.familiar
  const choices = (data?.abilities ?? []).slice(0, state.dailyAbilityLimit)
  const catalog = familiarAbilityEntries(entries, c)
  return choices.flatMap((name, index) => {
    const entry = familiarAbilityEntry(name, catalog, c)
    if (!entry || /^specific familiar\b/i.test(String(entry.data.ability_type ?? ''))) return []
    const others = choices.filter((_, otherIndex) => otherIndex !== index)
    return familiarAbilityUnavailableReason(entry, c, others, state.undeadFamiliar, entries) ? [] : [entry.name]
  })
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

export function familiarAbilityEntries(entries: ContentEntry[], c: Character) {
  const seen = new Set<string>()
  return [...entries].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).filter(entry => {
    if (entry.deleted || entry.kind !== 'familiar' || /^pet\b/i.test(String(entry.data.ability_type ?? ''))
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
  entries: ContentEntry[] = []) {
  const spellcasting = classSpellcasting(c, entries) ?? c.spellcasting
  const slots = classSpellSlots(c) ?? c.spellcasting?.slots
  if (undead && (/^(?:constructed?|dragon)$/i.test(entry.name) || changesCreatureTrait(entry))) {
    return 'An undead familiar cannot select an ability that changes its trait.'
  }
  if (selected.some(name => key(name) === key(entry.name)) && !isFamiliarAbilityRepeatable(entry)) {
    return 'This ability has already been selected.'
  }
  const selectedNames = new Set(selected.map(key))
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
    && (undead || c.feats.some(feat => ['Leshy Familiar', 'Undead Familiar'].includes(feat.name)))) {
    return 'Requires an animal familiar.'
  }
  if (/\byour familiar must have the speech ability\b/i.test(entry.description)
    && !selectedNames.has('speech')) return 'Requires the Speech familiar ability.'
  return undefined
}

export function familiarAbilityEffects(abilities: string[], level: number,
  options?: NonNullable<Character['familiar']>['abilityOptions'], spellcastingModifier = 0) {
  const selected = abilities.map(key)
  const has = (name: string) => selected.includes(key(name))
  const fastMovement = options?.fastMovement ?? 'Land'
  const resistanceRank = has('Major Resistance') ? level
    : has('Greater Resistance') ? 3 + Math.floor(level / 2)
      : has('Resistance') ? Math.max(1, Math.floor(level / 2)) : 0
  const resistanceTypes = (options?.resistance ?? []).filter((type): type is typeof FAMILIAR_RESISTANCE_TYPES[number] =>
    FAMILIAR_RESISTANCE_TYPES.includes(type as typeof FAMILIAR_RESISTANCE_TYPES[number]))
  const skillModifier = level + spellcastingModifier
  return {
    hitPoints: level * (5 + (has('Tough') ? 2 : 0)),
    speeds: [
      { movement: 'Land', feet: fastMovement === 'Land' && has('Fast Movement') ? 40 : 25 },
      ...(has('Amphibious') ? [{ movement: 'Swim', feet: fastMovement === 'Swim' && has('Fast Movement') ? 40 : 25 }] : []),
      ...(has('Burrower') ? [{ movement: 'Burrow', feet: 5 }] : []),
      ...(has('Climber') ? [{ movement: 'Climb', feet: fastMovement === 'Climb' && has('Fast Movement') ? 40 : 25 }] : []),
      ...(has('Flier') ? [{ movement: 'Fly', feet: fastMovement === 'Fly' && has('Fast Movement') ? 40 : 25 }] : []),
    ],
    senses: [
      ...(has('Darkvision') ? ['Darkvision'] : []),
      ...(has('Scent') ? ['Scent (imprecise, 30 feet)'] : []),
      ...(has('Echolocation') ? ['Hearing (precise, 20 feet)'] : []),
      ...(has('Tremorsense') ? ['Tremorsense (imprecise, 30 feet)'] : []),
      ...(has('Wavesense') ? ['Wavesense (imprecise, 30 feet)'] : []),
    ],
    resistances: resistanceTypes.map(type => ({ damage: type, value: resistanceRank })),
    skilled: (options?.skilled ?? []).filter(skill => FAMILIAR_SKILLS.includes(skill))
      .map(skill => ({ skill, modifier: skillModifier })),
  }
}
