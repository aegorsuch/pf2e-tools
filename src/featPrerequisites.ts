import type { Character, ContentEntry } from './types'

export interface PrerequisiteCheck {
  missing: string[]
  manual: string[]
}

export interface PrerequisiteFacts {
  className?: string
  ancestry?: string
  heritage?: string
  ancestryTraits?: string[]
  subclass?: string
  additionalSubclasses: string[]
  orders: string[]
  feats: { name: string; level: number; category?: string }[]
  features: string[]
  ranks: Record<string, number>
  armor: Record<string, number>
  weapons: Record<string, number>
  abilities: Character['abilities']
  senses: string[]
}

const key = (text: string) => text.trim().toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const met = (): PrerequisiteCheck => ({ missing: [], manual: [] })
const missing = (text: string): PrerequisiteCheck => ({ missing: [text], manual: [] })
const manual = (text: string): PrerequisiteCheck => ({ missing: [], manual: [text] })
const satisfied = (result: PrerequisiteCheck) => !result.missing.length && !result.manual.length
const rankSatisfied = (actual: number, required: number) => required === 0 ? actual === 0 : actual >= required
const RANKS = ['untrained', 'trained', 'expert', 'master', 'legendary']
const ABILITIES: Record<string, keyof Character['abilities']> = {
  strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
}
const ROLE_CLASSES: Record<string, string> = {
  instinct: 'Barbarian', order: 'Druid', cause: 'Champion', muse: 'Bard', doctrine: 'Cleric',
  'research field': 'Alchemist', racket: 'Rogue', bloodline: 'Sorcerer', patron: 'Witch', 'arcane school': 'Wizard',
  mystery: 'Oracle', methodology: 'Investigator', innovation: 'Inventor', way: 'Gunslinger',
  'hybrid study': 'Magus', 'conscious mind': 'Psychic', practice: 'Animist', eidolon: 'Summoner', style: 'Swashbuckler',
  "hunter's edge": 'Ranger', edge: 'Ranger',
}
const ROLE_PATTERN = new RegExp(`^(.+?) (${Object.keys(ROLE_CLASSES).sort((a, b) => b.length - a.length).join('|')})$`)
const rankPrefix = /^(untrained|trained|expert|master|legendary)\s+(?:in|with)\s+/i

interface ContentIndex {
  named: Map<string, ContentEntry[]>
  protectedPattern?: RegExp
}
const indexes = new WeakMap<ContentEntry[], ContentIndex>()
function contentIndex(entries: ContentEntry[]) {
  let index = indexes.get(entries)
  if (index) return index
  const named = new Map<string, ContentEntry[]>()
  for (const entry of entries) {
    if (entry.deleted || !['feat', 'classFeature', 'heritage', 'ancestry', 'class', 'subclass'].includes(entry.kind)) continue
    const name = key(entry.name)
    named.set(name, [...(named.get(name) ?? []), entry])
  }
  const compoundNames = [...named.keys()].filter((name) => /\band\b|\bor\b|[,;]/.test(name)).sort((a, b) => b.length - a.length)
  index = { named, protectedPattern: compoundNames.length
    ? new RegExp(`(^|[^a-z0-9])(${compoundNames.map(escape).join('|')})(?=$|[^a-z0-9])`, 'gi') : undefined }
  indexes.set(entries, index)
  return index
}

export function featPrerequisiteSources(entries: ContentEntry[], context: {
  name: string
  entryIds: string[]
  className?: string
  ancestry?: string
  heritage?: string
  ancestryTraits?: string[]
  category?: string
}) {
  const candidates = (contentIndex(entries).named.get(key(context.name)) ?? []).filter((entry) => entry.kind === 'feat')
  const hasTrait = (entry: ContentEntry, trait?: string) => !!trait && entry.traits.some((value) => key(value) === key(trait))
  const isAncestry = (entry: ContentEntry) => hasTrait(entry, context.ancestry) || hasTrait(entry, context.heritage)
    || context.ancestryTraits?.some((trait) => hasTrait(entry, trait))
  const linked = candidates.filter((entry) => context.entryIds.includes(entry.id))
  const pool = linked.length ? linked : candidates
  const contextual = pool.filter((entry) => {
    if (context.category === 'class') return hasTrait(entry, context.className)
    if (context.category === 'ancestry') return isAncestry(entry)
    if (context.category === 'archetype') return hasTrait(entry, 'Archetype')
    if (context.category === 'general') return hasTrait(entry, 'General')
    if (context.category === 'skill') return hasTrait(entry, 'Skill')
    return false
  })
  if (contextual.length) return contextual
  if (context.category) return pool
  const natural = pool.filter((entry) => hasTrait(entry, context.className) || isAncestry(entry))
  return natural.length ? natural : pool
}

// Split only top-level operators; parentheses and punctuation inside known names stay atomic.
function splitOutside(text: string, separator: RegExp) {
  let depth = 0
  let start = 0
  let cursor = 0
  const parts: string[] = []
  for (const match of text.matchAll(separator)) {
    for (let i = cursor; i < match.index; i++) {
      if (text[i] === '(') depth++
      else if (text[i] === ')') depth--
    }
    cursor = match.index + match[0].length
    if (depth !== 0) continue
    parts.push(text.slice(start, match.index).trim())
    start = match.index + match[0].length
  }
  parts.push(text.slice(start).trim())
  return parts.filter(Boolean)
}

export function createFeatPrerequisiteChecker(entries: ContentEntry[], context: {
  level: number
  entryIds: string[]
  knownOrders: string[]
  facts: (level: number) => PrerequisiteFacts
}) {
  const index = contentIndex(entries)
  const knownEntries = (text: string) => index.named.get(key(text)) ?? []
  const resultFor = (yes: boolean, text: string) => yes ? met() : missing(text)

  const atom = (text: string, level: number, trail: Set<string>, inheritedRank?: string): PrerequisiteCheck | undefined => {
    const facts = context.facts(level)
    const name = key(text).replace(/\.$/, '')
    const qualified = /^\[([^\]]+)\]\s*(.+)$/.exec(name)
    if (qualified) return key(facts.className ?? '') === qualified[1] ? evaluate(qualified[2], level, trail) : met()
    const ability = /^(strength|dexterity|constitution|intelligence|wisdom|charisma)\s*(\+?\d+)$/.exec(name)
    const minimumLevel = /^(?:level (\d+)|(?:at least )?(\d+)(?:st|nd|rd|th) level)$/.exec(name)
    if (minimumLevel) return resultFor(level >= Number(minimumLevel[1] ?? minimumLevel[2]), text)
    if (ability) {
      const score = facts.abilities[ABILITIES[ability[1]]]
      const requirement = Number(ability[2])
      return resultFor(ability[2].startsWith('+') || requirement < 10
        ? Math.floor((score - 10) / 2) >= requirement : score >= requirement, text)
    }
    const ranked = rankPrefix.exec(name)
    if (ranked || inheritedRank) {
      const rank = RANKS.indexOf(ranked?.[1] ?? inheritedRank!)
      const subject = name.replace(rankPrefix, '').replace(/^(?:your choice of|at least one of|one of)\s+/, '').replace(/\s+saves?$/, '')
      const skill = Object.keys(facts.ranks).find((skill) => key(skill) === subject)
      const armor = /^(light|medium|heavy) armor$|^(unarmored) defense$/.exec(subject)
      const weapon = /^(simple|martial|advanced) weapons?$|^(unarmed) attacks?$/.exec(subject)
      if (skill) return resultFor(rankSatisfied(facts.ranks[skill], rank), text)
      if (/^[\w' -]+ lore$/.test(subject) && !/\b(?:and|or)\b/.test(subject)) return resultFor(rankSatisfied(0, rank), text)
      if (/^(?:at least )?one (?:or more )?lore skills?$/.test(subject)) {
        return resultFor(Object.entries(facts.ranks).some(([skill, value]) => / lore$/i.test(skill) && value >= rank), text)
      }
      if (armor) {
        const group = armor[1] ?? armor[2]
        return resultFor(rankSatisfied(facts.armor[group[0].toUpperCase() + group.slice(1)] ?? 0, rank), text)
      }
      if (weapon) {
        const group = weapon[1] ?? weapon[2]
        return resultFor(rankSatisfied(facts.weapons[group[0].toUpperCase() + group.slice(1)] ?? 0, rank), text)
      }
    }
    const role = ROLE_PATTERN.exec(name)
    if (role) {
      const choices = role[2] === 'order' ? facts.orders : [facts.subclass ?? '', ...facts.additionalSubclasses]
      const normalize = (value: string) => {
        const name = key(value).replace(/^the /, '').replace(new RegExp(` ${role[2]}$`), '')
        return role[2] === 'order' && name === 'untamed' ? 'wild' : name
      }
      const expected = normalize(role[1])
      const known = role[2] === 'order' ? context.knownOrders.some((order) => normalize(order) === expected)
        : knownEntries(role[1]).some((entry) => entry.kind === 'subclass' && entry.data.class === ROLE_CLASSES[role[2]])
      if (!known && !choices.some((choice) => normalize(choice) === expected)) return undefined
      return resultFor(facts.className === ROLE_CLASSES[role[2]] && choices.some((choice) => normalize(choice) === normalize(role[1])), text)
    }
    const reference = name.replace(/ (?:class feature|feat|heritage|ancestry)$/, '')
    if (facts.features.some((feature) => key(feature) === reference)) return met()
    const content = knownEntries(reference)
    if (content.some((entry) => entry.kind === 'heritage')) return resultFor(key(facts.heritage ?? '') === reference, text)
    if (content.some((entry) => entry.kind === 'ancestry')) return resultFor(key(facts.ancestry ?? '') === reference, text)
    if (content.some((entry) => entry.kind === 'class')) return resultFor(key(facts.className ?? '') === reference, text)
    const selected = facts.feats.filter((feat) => key(feat.name) === reference)
    if (selected.length) {
      if (trail.has(reference)) return missing(`Circular prerequisite: ${text}`)
      const next = new Set([...trail, reference])
      const checks = selected.map((feat) => {
        const sources = featPrerequisiteSources(entries, {
          ...facts, name: feat.name, category: feat.category, entryIds: context.entryIds,
        })
        const requirements = [...new Set(sources.map((entry) => String(entry.data.prerequisite ?? '')))]
        return requirements.length > 1 ? manual(`Verify source version of ${text}`) : evaluate(requirements[0] ?? '', feat.level, next)
      })
      return checks.find(satisfied) ?? checks[0]
    }
    if (content.some((entry) => entry.kind === 'feat' || entry.kind === 'classFeature')) return missing(text)
    if (/^(?:low-light vision|darkvision|scent|tremorsense)$/.test(name)) {
      return resultFor(facts.senses.some((sense) => key(sense).includes(name)), text)
    }
    return undefined
  }

  const evaluate = (input: string, level: number, trail: Set<string>, inheritedRank?: string): PrerequisiteCheck => {
    const text = input.trim()
    if (!text) return met()
    const atomic = atom(text, level, trail, inheritedRank)
    if (atomic) return atomic
    const protectedNames: string[] = []
    const safe = index.protectedPattern ? text.replace(index.protectedPattern, (_, prefix: string, name: string) => {
      protectedNames.push(name)
      return `${prefix}@${protectedNames.length - 1}@`
    }) : text
    const restore = (part: string) => part.replace(/@(\d+)@/g, (_, i: string) => protectedNames[Number(i)])
    const combine = (parts: string[], either: boolean) => {
      const inherited = rankPrefix.exec(text)?.[1]?.toLowerCase() ?? inheritedRank
      const last = key(restore(parts[parts.length - 1]))
      const sharedRole = ROLE_PATTERN.exec(last)
      const sharedHeritage = last.endsWith(' heritage')
      const checks = parts.map((part) => {
        let value = restore(part)
        if (sharedRole && (knownEntries(value).some((entry) => entry.kind === 'subclass' && entry.data.class === ROLE_CLASSES[sharedRole[2]])
          || sharedRole[2] === 'order' && context.knownOrders.some((order) => key(order) === key(value)))) value += ` ${sharedRole[2]}`
        else if (sharedHeritage && knownEntries(value).some((entry) => entry.kind === 'heritage')) value += ' heritage'
        return evaluate(value, level, trail, inherited)
      })
      // An unknown alternative might qualify; report it rather than rejecting the entire OR.
      if (either) return checks.some(satisfied) ? met() : checks.some((check) => check.manual.length) ? manual(text) : missing(text)
      return { missing: [...new Set(checks.flatMap((check) => check.missing))], manual: [...new Set(checks.flatMap((check) => check.manual))] }
    }
    const required = splitOutside(safe, /;\s*/g)
    if (required.length > 1) return combine(required, false)
    const oxford = splitOutside(safe, /,\s*(?:or\s+)?|\s+or\s+/gi)
    if (oxford.length > 1 && /,\s*or\s+/i.test(safe)) return combine(oxford, true)
    const comma = splitOutside(safe, /,\s*/g)
    if (comma.length > 1) return combine(comma, /\b(?:one of|your choice of)\b/i.test(text))
    const alternatives = splitOutside(safe, /\s+or\s+/gi)
    if (alternatives.length > 1) return combine(alternatives, true)
    const requiredAnd = splitOutside(safe, /\s+and\s+/gi)
    if (requiredAnd.length > 1) return combine(requiredAnd, false)
    if (text.startsWith('(') && text.endsWith(')')) return evaluate(text.slice(1, -1), level, trail, inheritedRank)
    return manual(text)
  }

  const results = new Map<ContentEntry, PrerequisiteCheck>()
  return (entry: ContentEntry): PrerequisiteCheck => {
    let result = results.get(entry)
    if (!result) {
      result = evaluate(typeof entry.data.prerequisite === 'string' ? entry.data.prerequisite : '', context.level, new Set([key(entry.name)]))
      results.set(entry, result)
    }
    return result
  }
}
