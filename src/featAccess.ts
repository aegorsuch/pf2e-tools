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
const TIAN_ELEMENTALISM = 'Tian Xia origin or exposure to Tian elementalism'
const NIDAL_HUSBANDRY = 'Nidal origin or exposure to Nidalese husbandry'
const RIVETHUN_MEMBERSHIP = 'Member of the Rivethun'
const DWARVEN_DEFENDER = 'Undergone defender training in a dwarven settlement such as Highhelm'
const achievementLabels = new Map([LASTWALL_MEMBERSHIP, TIAN_ELEMENTALISM, RIVETHUN_MEMBERSHIP, DWARVEN_DEFENDER]
  .map(label => [label.toLowerCase(), label]))
const lastwallAccess = new Set([
  LASTWALL_MEMBERSHIP.toLowerCase(),
  'knights of lastwall',
  'knights of lastwall have access to this feat',
  'a character who is a member of the knights of lastwall has access to this option',
  'you are a member of the knights of lastwall',
])

export function achievementKey(access: string) {
  const key = achievementLabel(access.trim().replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'")).toLowerCase()
  if (key === 'tian xia origin' || key === TIAN_ELEMENTALISM.toLowerCase()) return TIAN_ELEMENTALISM.toLowerCase()
  if (/^rivethun adherent background or (?:you are )?(?:a )?member of the rivethun$/.test(key)) return RIVETHUN_MEMBERSHIP.toLowerCase()
  if (/^dwarf or have undergone defender training in a dwarven settlement such as highhelm$/.test(key)) return DWARVEN_DEFENDER.toLowerCase()
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
  return ['Chiardmar Steed', 'Nidarrmar Steed'].includes(entry.name) && achievementKey(access) === 'from nidal'
    ? NIDAL_HUSBANDRY : access
}

export function achievementOptions(entries: ContentEntry[]) {
  const cached = achievementCache.get(entries)
  if (cached) return cached
  const options = new Map<string, AchievementOption>()
  for (const entry of entries) {
    if (entry.deleted || !['feat', 'weapon', 'armor', 'shield'].includes(entry.kind)) continue
    const requirement = narrativeRequirement(entry, String(entry.data.access ?? '').trim().replace(/\s+/g, ' '))
    if (!narrativeAccess.test(requirement)) continue
    const key = achievementKey(requirement)
    const existing = options.get(key)
    if (existing) {
      if (!existing.feats.includes(entry.name)) existing.feats.push(entry.name)
    } else options.set(key, { key, requirement: achievementLabels.get(key) ?? achievementLabel(requirement), feats: [entry.name] })
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
  return [...new Set(entries.filter(entry => !entry.deleted && entry.kind === 'feat'
    && (!target || entry.traits.some(trait => trait.toLowerCase() === target)))
    .flatMap(entry => [entry.data.access, entry.data.prerequisite]
      .flatMap(requirement => String(requirement ?? '').split(/[,;]|\s+and\s+/i).flatMap(accessEthnicities)))
    .map(name => name.replace(/\b[a-z]/g, letter => letter.toUpperCase())))]
    .sort((a, b) => a.localeCompare(b))
}

export function featRarity(entry: ContentEntry) {
  const rarity = entry.traits.find(trait => /^(uncommon|rare|unique)$/i.test(trait))
    ?? (/^(uncommon|rare|unique)$/i.test(String(entry.data.rarity)) ? String(entry.data.rarity) : undefined)
  return rarity ? rarity[0].toUpperCase() + rarity.slice(1).toLowerCase() : undefined
}

export function featAccess(c: Character, entry: ContentEntry): FeatAccessCheck | undefined {
  const access = String(entry.data.access ?? '').trim().replace(/\s+/g, ' ')
  if (!access || /^(?:(?:rarity|access)\s*:\s*)?(?:uncommon|rare|unique)(?:\s+(?:feat|option))?[.!?]?$/i.test(access)) return undefined
  const ethnicity = !!c.ethnicity && accessEthnicities(access).some(name => name.toLowerCase() === c.ethnicity!.trim().toLowerCase())
  const narrative = narrativeRequirement(entry, access)
  const key = achievementKey(narrative)
  const background = key === RIVETHUN_MEMBERSHIP.toLowerCase() && c.background?.toLowerCase() === 'rivethun adherent'
  const ancestry = key === DWARVEN_DEFENDER.toLowerCase() && c.ancestry?.toLowerCase() === 'dwarf'
  const achievement = narrativeAccess.test(narrative) && c.achievements?.some(value => achievementKey(value) === achievementKey(narrative))
  return {
    requirement: access,
    automatic: ethnicity || background || ancestry || !!achievement,
    approved: c.featAccessOverrides?.includes(entry.id) ?? false,
    source: ethnicity ? 'ethnicity' : background ? 'background' : ancestry ? 'ancestry' : achievement ? 'achievement' : undefined,
  }
}
