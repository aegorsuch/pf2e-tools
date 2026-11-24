import type { Character, ContentEntry } from './types'

export interface FeatAccessCheck {
  requirement: string
  automatic: boolean
  approved: boolean
  source?: 'ethnicity' | 'achievement' | 'background' | 'ancestry'
}

interface AchievementOption {
  key: string
  requirement: string
  feats: string[]
}

const achievementCache = new WeakMap<ContentEntry[], AchievementOption[]>()
const narrativeAccess = /\b(?:defeat(?:ed)?|befriend|initiated|trained (?:by|with)|defender training|attended|encountered|invited|executed|mission|help|side with|permission|exposure to|members?|attendant rank|knights of lastwall|tian xia origin)\b/i
const LASTWALL_MEMBERSHIP = 'Member of the Knights of Lastwall'
const LASTWALL_TRAINING = 'Trained with the Knights of Lastwall'
const PATHFINDER_MEMBERSHIP = 'Member of the Pathfinder Society'
const PATHFINDER_TRAINING = 'Trained with the Pathfinder Society'
const SHACKLES_TRAVEL = 'Traveled through the Shackles'
const TIAN_ELEMENTALISM = 'Tian Xia origin or exposure to Tian elementalism'
const TIAN_ELEMENTALISM_TRAINING = 'Trained in Tian Xia elementalism'
const WUKONG_EXTENSION_ACCESS = 'Tian Xia origin or familiar with Sun Wukong'
const NIDAL_HUSBANDRY = 'Nidal origin or exposure to Nidalese husbandry'
const NIDALESE_HORSELORDS = 'Trained with the Nidalese Horselords'
const NIDALESE_HORSELORDS_KEY = 'member of the nidalese horselords'
const RIVETHUN_MEMBERSHIP = 'Member of the Rivethun'
const DWARVEN_DEFENDER = 'Undergone defender training in a dwarven settlement such as Highhelm'
const OLD_CHELIAX = 'From Old Cheliax'
const DONGUN_HOLD_OR_ALKENSTAR = 'From Dongun Hold or Alkenstar'
const ALKENSTAR_OR_DONGUN_TRAVEL = 'Travelled through Alkenstar or Dongun Hold'
const ALKENSTAR = 'From Alkenstar'
const MANA_WASTES = 'From Mana Wastes'
const ALKENSTAR_OR_MANA_WASTES = 'from alkenstar or the mana wastes'
const ALKENSTAR_TRAVEL = 'Traveled through Alkenstar'
const MANA_WASTES_TRAVEL = 'Traveled through the Mana Wastes'
const ALKENSTAR_OR_MANA_WASTES_TRAVEL = 'Traveled through Alkenstar or the Mana Wastes'
const NIXBRIX_CHALLENGE = "Agree to Nixbrix's challenge to defeat Bitey"
const BLACK_POWDER_FEATS = new Set(['Inured to Alchemy', 'Pain Tolerance', 'Powder Punch Stance'])
const achievementLabels = new Map([LASTWALL_MEMBERSHIP, TIAN_ELEMENTALISM, WUKONG_EXTENSION_ACCESS, RIVETHUN_MEMBERSHIP, DWARVEN_DEFENDER,
  OLD_CHELIAX, DONGUN_HOLD_OR_ALKENSTAR, ALKENSTAR, MANA_WASTES, NIXBRIX_CHALLENGE]
  .map(label => [label.toLowerCase(), label]))
achievementLabels.set(LASTWALL_MEMBERSHIP.toLowerCase(), LASTWALL_TRAINING)
achievementLabels.set(PATHFINDER_MEMBERSHIP.toLowerCase(), PATHFINDER_TRAINING)
achievementLabels.set(TIAN_ELEMENTALISM.toLowerCase(), TIAN_ELEMENTALISM_TRAINING)
achievementLabels.set(NIDALESE_HORSELORDS_KEY, NIDALESE_HORSELORDS)
const lastwallAccess = new Set([
  LASTWALL_MEMBERSHIP.toLowerCase(),
  'member of knights of lastwall',
  'knights of lastwall',
  'knights of lastwall have access to this feat',
  'a character who is a member of the knights of lastwall has access to this option',
  'you are a member of the knights of lastwall',
  LASTWALL_TRAINING.toLowerCase(),
])

export function achievementKey(access: string) {
  const key = achievementLabel(access.trim().replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'")).toLowerCase()
    .replace(/^(?:member of or trained by|trained by|trained with(?= the | knights)) /, 'member of ')
  if ([NIDAL_HUSBANDRY.toLowerCase(), NIDALESE_HORSELORDS.toLowerCase(),
    NIDALESE_HORSELORDS_KEY, 'member of nidalese horselords', 'trained with nidalese horselords'].includes(key)) return NIDALESE_HORSELORDS_KEY
  if (key === 'tian xia origin' || key === TIAN_ELEMENTALISM.toLowerCase()
    || key === 'tian xia origin or exposure to tian xia elementalism'
    || key === TIAN_ELEMENTALISM_TRAINING.toLowerCase()) return TIAN_ELEMENTALISM.toLowerCase()
  if (/^rivethun adherent background or (?:you are )?(?:a )?member of the rivethun$/.test(key)) return RIVETHUN_MEMBERSHIP.toLowerCase()
  if (/^dwarf or have undergone defender training in a dwarven settlement such as highhelm$/.test(key)) return DWARVEN_DEFENDER.toLowerCase()
  if (key === DONGUN_HOLD_OR_ALKENSTAR.toLowerCase()
    || key === ALKENSTAR_OR_DONGUN_TRAVEL.toLowerCase()) return DONGUN_HOLD_OR_ALKENSTAR.toLowerCase()
  if (key === ALKENSTAR_TRAVEL.toLowerCase() || key === 'travelled through alkenstar') return ALKENSTAR.toLowerCase()
  if (key === 'from the mana wastes' || key === MANA_WASTES_TRAVEL.toLowerCase()
    || key === 'travelled through the mana wastes') return MANA_WASTES.toLowerCase()
  if (key === ALKENSTAR_OR_MANA_WASTES_TRAVEL.toLowerCase()
    || key === 'travelled through alkenstar or the mana wastes') return ALKENSTAR_OR_MANA_WASTES
  if (key === 'from the shackles' || key === SHACKLES_TRAVEL.toLowerCase()) return SHACKLES_TRAVEL.toLowerCase()
  return lastwallAccess.has(key) ? LASTWALL_MEMBERSHIP.toLowerCase() : key
}

function achievementLabel(requirement: string) {
  const label = requirement
    .replace(/^a character who is (?:a )?/i, '')
    .replace(/^you(?:['\u2019]ve| have) /i, '')
    .replace(/^you(?:['\u2019]re| are| must be) (?:a )?/i, '')
    .replace(/^you /i, '')
    .replace(/^members of /i, 'Member of ')
    .replace(/\s+(?:has|have) access to [^.!?]+[.!?]*$/i, '')
    .replace(/[.!?]+$/, '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function narrativeRequirement(entry: ContentEntry, access: string) {
  return entry.name === 'Wukong Extension' ? WUKONG_EXTENSION_ACCESS
    : ['born in the saddle', 'chiardmar steed', 'nidarrmar steed'].includes(entry.name.toLowerCase()) ? NIDALESE_HORSELORDS
    : achievementKey(access) === SHACKLES_TRAVEL.toLowerCase() ? SHACKLES_TRAVEL
    : access
}

function isAchievementRequirement(requirement: string) {
  const key = achievementKey(requirement)
  return narrativeAccess.test(requirement) || key === TIAN_ELEMENTALISM.toLowerCase()
    || key === OLD_CHELIAX.toLowerCase() || key === DONGUN_HOLD_OR_ALKENSTAR.toLowerCase()
    || key === SHACKLES_TRAVEL.toLowerCase()
}

function trainingLabel(requirement: string, key: string) {
  if (key === DONGUN_HOLD_OR_ALKENSTAR.toLowerCase()) return ALKENSTAR_OR_DONGUN_TRAVEL
  if (key === ALKENSTAR_OR_MANA_WASTES) return ALKENSTAR_OR_MANA_WASTES_TRAVEL
  const label = achievementLabels.get(key) ?? achievementLabel(requirement)
  if (achievementLabels.has(key) && /^trained (?:with|in) /i.test(label)) return label
  return /^(?:member of|trained by) /i.test(label)
    ? label.replace(/^(?:member of(?: or trained by)?|trained by) /i, 'Trained with ') : requirement
}

function blackPowderFeat(entry: ContentEntry) {
  return entry.source === 'official' && entry.systems.includes('pf2e') && entry.kind === 'feat' && BLACK_POWDER_FEATS.has(entry.name)
}

export function achievementOptions(entries: ContentEntry[]) {
  const cached = achievementCache.get(entries)
  if (cached) return cached
  const options = new Map<string, AchievementOption>()
  const add = (key: string, label: string, name: string) => {
    const existing = options.get(key)
    if (existing) {
      if (!existing.feats.includes(name)) existing.feats.push(name)
    } else options.set(key, { key, requirement: label, feats: [name] })
  }
  for (const entry of entries) {
    if (entry.deleted || !['feat', 'weapon', 'armor', 'shield'].includes(entry.kind)) continue
    const requirement = narrativeRequirement(entry, String(entry.data.access ?? '').trim().replace(/\s+/g, ' '))
    const key = achievementKey(requirement)
    if (key === ALKENSTAR_OR_MANA_WASTES) {
      for (const label of [ALKENSTAR_TRAVEL, MANA_WASTES_TRAVEL, ...(blackPowderFeat(entry) ? [NIXBRIX_CHALLENGE] : [])]) {
        add(achievementKey(label), label, entry.name)
      }
    } else if (isAchievementRequirement(requirement)) {
      add(key, trainingLabel(achievementLabels.get(key) ?? achievementLabel(requirement), key), entry.name)
    }
  }
  const result = [...options.values()].sort((a, b) => a.requirement.localeCompare(b.requirement))
  for (const option of result) option.feats.sort((a, b) => a.localeCompare(b))
  achievementCache.set(entries, result)
  return result
}

const DWARF_ETHNICITIES: Record<string, string[]> = {
  'Ergaksen (Surface)': ['Ergaksen', 'Surface Dwarf'],
  'Grondaksen (Underground)': ['Grondaksen', 'Underground Dwarf'],
  'Holtaksen (Mountain)': ['Holtaksen', 'Mountain Dwarf'],
}

const HALFLING_ETHNICITIES: Record<string, string[]> = {
  Isgeri: [],
  'Jaric (Mountain)': ['Jaric', 'Mountain Halfling'],
  Mihrini: [],
  "Song'o (Jungle)": ["Song'o", 'Jungle Halfling'],
  'Uhlam (Forest)': ['Uhlam', 'Forest Halfling'],
}

export function ethnicityLabel(name: string) {
  const key = name.trim().toLowerCase()
  return Object.entries({ ...DWARF_ETHNICITIES, ...HALFLING_ETHNICITIES }).find(([label, aliases]) =>
    [label, ...aliases].some(alias => alias.toLowerCase() === key))?.[0] ?? name
}

export const ethnicityKey = (name: string) => ethnicityLabel(name).trim().toLowerCase()

function accessEthnicities(access: string) {
  return access.split(/\s+or\s+/i).flatMap((clause) => {
    const name = /^([a-z][a-z' ()-]*?) ethnicity$/i.exec(clause.trim().replace(/^any (?=surface dwarf ethnicity$)/i, ''))?.[1]
    return name && !/\b(?:any|and|you|your|must)\b/i.test(name) ? [name] : []
  })
}

export function ethnicityOptions(entries: ContentEntry[], ancestry?: string) {
  const target = ancestry?.trim().toLowerCase()
  if (target === 'dwarf') return Object.keys(DWARF_ETHNICITIES)
  if (target === 'halfling') return Object.keys(HALFLING_ETHNICITIES)
  const additional = target === 'human' ? [
    'Chelaxian', 'Erutaki', 'Garundi', 'Keleshite', 'Lirgeni', 'Mauxi', 'Nidalese', 'Olehala', 'Shoanti', 'Taldan', 'Tian-Dan', 'Tian-Yae', 'Ulfen', 'Varki', 'Varisian', 'Vudrani',
  ] : target === 'elf' ? ['Ekujae', 'Spiresworn'] : target === 'orc' ? ['Belkzen'] : []
  const names = [...additional, ...entries.filter(entry => !entry.deleted && entry.kind === 'feat'
    && (!target || entry.traits.some(trait => trait.toLowerCase() === target)))
    .flatMap(entry => [entry.data.access, entry.data.prerequisite]
      .flatMap(requirement => String(requirement ?? '').split(/[,;]|\s+and\s+/i).flatMap(accessEthnicities)))
    .map(name => ethnicityLabel(name.replace(/\b[a-z]/g, letter => letter.toUpperCase())))]
  const unique = new Map<string, string>()
  for (const name of names) if (!unique.has(name.toLowerCase())) unique.set(name.toLowerCase(), name)
  return [...unique.values()].sort((a, b) => a.localeCompare(b))
}

export function featRarity(entry: ContentEntry) {
  const rarity = entry.traits.find(trait => /^(uncommon|rare|unique)$/i.test(trait))
    ?? (/^(uncommon|rare|unique)$/i.test(String(entry.data.rarity)) ? String(entry.data.rarity) : undefined)
  return rarity ? rarity[0].toUpperCase() + rarity.slice(1).toLowerCase() : undefined
}

export function featAccess(c: Character, entry: ContentEntry): FeatAccessCheck | undefined {
  const access = String(entry.data.access ?? '').trim().replace(/\s+/g, ' ')
  const narrative = narrativeRequirement(entry, access)
  if ((!access && entry.name !== 'Wukong Extension')
    || entry.name !== 'Wukong Extension'
      && /^(?:(?:rarity|access)\s*:\s*)?(?:uncommon|rare|unique)(?:\s+(?:feat|option))?[.!?]?$/i.test(access)) return undefined
  const ethnicity = !!c.ethnicity && accessEthnicities(access).some(name => ethnicityKey(name) === ethnicityKey(c.ethnicity!))
  const key = achievementKey(narrative)
  const background = key === RIVETHUN_MEMBERSHIP.toLowerCase() && c.background?.toLowerCase() === 'rivethun adherent'
  const alternatives = access.toLowerCase().split(/\s+or\s+/)
  const heritage = c.heritage?.toLowerCase()
  const ancestry = key === DWARVEN_DEFENDER.toLowerCase() && c.ancestry?.toLowerCase() === 'dwarf'
    || !!heritage && alternatives.some(alternative => alternative.replace(/[.!?]+$/, '') === `${heritage} heritage`)
  const achievements = new Set(c.achievements?.map(achievementKey))
  const achievement = (key === ALKENSTAR_OR_MANA_WASTES
    ? achievements.has(key) || achievements.has(achievementKey(ALKENSTAR)) || achievements.has(achievementKey(MANA_WASTES))
      || blackPowderFeat(entry) && achievements.has(achievementKey(NIXBRIX_CHALLENGE))
    : isAchievementRequirement(narrative) && (achievements.has(key)
      || key === DONGUN_HOLD_OR_ALKENSTAR.toLowerCase() && achievements.has(achievementKey(ALKENSTAR))))
    || alternatives.some(alternative => isAchievementRequirement(alternative) && achievements.has(achievementKey(alternative)))
  return {
    requirement: trainingLabel(key === TIAN_ELEMENTALISM.toLowerCase() ? TIAN_ELEMENTALISM : narrative, key),
    automatic: ethnicity || background || ancestry || !!achievement,
    approved: c.featAccessOverrides?.includes(entry.id) ?? false,
    source: ethnicity ? 'ethnicity' : background ? 'background' : ancestry ? 'ancestry' : achievement ? 'achievement' : undefined,
  }
}

export function contentAccessGranted(c: Character, entry: ContentEntry) {
  const access = featAccess(c, entry)
  return !access || access.automatic || access.approved
}

export function spellAccessGranted(c: Character, entry: ContentEntry) {
  return contentAccessGranted(c, entry) || !!c.spells?.some(spell =>
    spell.entryId ? spell.entryId === entry.id : spell.name === entry.name)
}
