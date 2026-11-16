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
const LASTWALL_TRAINING = 'Member of or trained by Knights of Lastwall'
const PATHFINDER_MEMBERSHIP = 'Member of the Pathfinder Society'
const PATHFINDER_TRAINING = 'Member of or trained by the Pathfinder Society'
const TIAN_ELEMENTALISM = 'Tian Xia origin or exposure to Tian elementalism'
const WUKONG_EXTENSION_ACCESS = 'Tian Xia origin or familiar with Sun Wukong'
const NIDAL_HUSBANDRY = 'Nidal origin or exposure to Nidalese husbandry'
const RIVETHUN_MEMBERSHIP = 'Member of the Rivethun'
const DWARVEN_DEFENDER = 'Undergone defender training in a dwarven settlement such as Highhelm'
const OLD_CHELIAX = 'From Old Cheliax'
const DONGUN_HOLD_OR_ALKENSTAR = 'From Dongun Hold or Alkenstar'
const ALKENSTAR = 'From Alkenstar'
const MANA_WASTES = 'From Mana Wastes'
const ALKENSTAR_OR_MANA_WASTES = 'from alkenstar or the mana wastes'
const NIXBRIX_CHALLENGE = "Agree to Nixbrix's challenge to defeat Bitey"
const BLACK_POWDER_FEATS = new Set(['Inured to Alchemy', 'Pain Tolerance', 'Powder Punch Stance'])
const achievementLabels = new Map([LASTWALL_MEMBERSHIP, TIAN_ELEMENTALISM, WUKONG_EXTENSION_ACCESS, RIVETHUN_MEMBERSHIP, DWARVEN_DEFENDER,
  OLD_CHELIAX, DONGUN_HOLD_OR_ALKENSTAR, ALKENSTAR, MANA_WASTES, NIXBRIX_CHALLENGE]
  .map(label => [label.toLowerCase(), label]))
achievementLabels.set(LASTWALL_MEMBERSHIP.toLowerCase(), LASTWALL_TRAINING)
achievementLabels.set(PATHFINDER_MEMBERSHIP.toLowerCase(), PATHFINDER_TRAINING)
const lastwallAccess = new Set([
  LASTWALL_MEMBERSHIP.toLowerCase(),
  'knights of lastwall',
  'knights of lastwall have access to this feat',
  'a character who is a member of the knights of lastwall has access to this option',
  'you are a member of the knights of lastwall',
  LASTWALL_TRAINING.toLowerCase(),
])

export function achievementKey(access: string) {
  const key = achievementLabel(access.trim().replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'")).toLowerCase()
  if (key === 'tian xia origin' || key === TIAN_ELEMENTALISM.toLowerCase()) return TIAN_ELEMENTALISM.toLowerCase()
  if (/^rivethun adherent background or (?:you are )?(?:a )?member of the rivethun$/.test(key)) return RIVETHUN_MEMBERSHIP.toLowerCase()
  if (/^dwarf or have undergone defender training in a dwarven settlement such as highhelm$/.test(key)) return DWARVEN_DEFENDER.toLowerCase()
  if (key === DONGUN_HOLD_OR_ALKENSTAR.toLowerCase()) return key
  if (key === 'from the mana wastes') return MANA_WASTES.toLowerCase()
  if (key === PATHFINDER_TRAINING.toLowerCase()) return PATHFINDER_MEMBERSHIP.toLowerCase()
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
    : ['Chiardmar Steed', 'Nidarrmar Steed'].includes(entry.name)
    && (achievementKey(access) === 'from nidal' || /^you\ufffdre from nidal[.!?]*$/i.test(access))
    ? NIDAL_HUSBANDRY : access
}

function isAchievementRequirement(requirement: string) {
  const key = achievementKey(requirement)
  return narrativeAccess.test(requirement) || key === OLD_CHELIAX.toLowerCase() || key === DONGUN_HOLD_OR_ALKENSTAR.toLowerCase()
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
      for (const label of [ALKENSTAR, MANA_WASTES, ...(blackPowderFeat(entry) ? [NIXBRIX_CHALLENGE] : [])]) {
        add(achievementKey(label), label, entry.name)
      }
    } else if (isAchievementRequirement(requirement)) {
      add(key, achievementLabels.get(key) ?? achievementLabel(requirement), entry.name)
    }
  }
  const result = [...options.values()].sort((a, b) => a.requirement.localeCompare(b.requirement))
  for (const option of result) option.feats.sort((a, b) => a.localeCompare(b))
  achievementCache.set(entries, result)
  return result
}

function accessEthnicities(access: string) {
  return access.split(/\s+or\s+/i).flatMap((clause) => {
    const name = /^([a-z][a-z' -]*?) ethnicity$/i.exec(clause.trim())?.[1]
    return name && !/\b(?:any|and|you|your|must)\b/i.test(name) ? [name] : []
  })
}

export function ethnicityOptions(entries: ContentEntry[], ancestry?: string) {
  const target = ancestry?.trim().toLowerCase()
  const additional = target === 'human' ? [
    'Chelaxian', 'Erutaki', 'Garundi', 'Keleshite', 'Lirgeni', 'Mauxi', 'Nidalese', 'Shoanti', 'Taldan', 'Tian-Dan', 'Tian-Yae', 'Ulfen', 'Varisian', 'Vudrani',
  ] : target === 'elf' ? ['Ekujae', 'Spiresworn'] : target === 'orc' ? ['Belkzen'] : []
  const names = [...additional, ...entries.filter(entry => !entry.deleted && entry.kind === 'feat'
    && (!target || entry.traits.some(trait => trait.toLowerCase() === target)))
    .flatMap(entry => [entry.data.access, entry.data.prerequisite]
      .flatMap(requirement => String(requirement ?? '').split(/[,;]|\s+and\s+/i).flatMap(accessEthnicities)))
    .map(name => name.replace(/\b[a-z]/g, letter => letter.toUpperCase()))]
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
  const ethnicity = !!c.ethnicity && accessEthnicities(access).some(name => name.toLowerCase() === c.ethnicity!.trim().toLowerCase())
  const key = achievementKey(narrative)
  const background = key === RIVETHUN_MEMBERSHIP.toLowerCase() && c.background?.toLowerCase() === 'rivethun adherent'
  const ancestry = key === DWARVEN_DEFENDER.toLowerCase() && c.ancestry?.toLowerCase() === 'dwarf'
  const achievements = new Set(c.achievements?.map(achievementKey))
  const achievement = key === ALKENSTAR_OR_MANA_WASTES
    ? achievements.has(key) || achievements.has(achievementKey(ALKENSTAR)) || achievements.has(achievementKey(MANA_WASTES))
      || blackPowderFeat(entry) && achievements.has(achievementKey(NIXBRIX_CHALLENGE))
    : isAchievementRequirement(narrative) && (achievements.has(key)
      || key === DONGUN_HOLD_OR_ALKENSTAR.toLowerCase() && achievements.has(achievementKey(ALKENSTAR)))
  return {
    requirement: key === TIAN_ELEMENTALISM.toLowerCase() ? TIAN_ELEMENTALISM
      : key === LASTWALL_MEMBERSHIP.toLowerCase() ? LASTWALL_TRAINING
      : key === PATHFINDER_MEMBERSHIP.toLowerCase() ? PATHFINDER_TRAINING : narrative,
    automatic: ethnicity || background || ancestry || !!achievement,
    approved: c.featAccessOverrides?.includes(entry.id) ?? false,
    source: ethnicity ? 'ethnicity' : background ? 'background' : ancestry ? 'ancestry' : achievement ? 'achievement' : undefined,
  }
}
