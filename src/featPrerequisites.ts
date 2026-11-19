import type { Character, ContentEntry } from './types'
import { ancestralUnarmedFeatNames } from './featChoices'
import { ethnicityKey } from './featAccess'

export interface PrerequisiteCheck {
  missing: string[]
  manual: string[]
}

export interface PrerequisiteFacts {
  className?: string
  ancestry?: string
  heritage?: string
  heritages?: string[]
  ethnicity?: string
  ancestryTraits?: string[]
  subclass?: string
  fatalMethod?: string
  additionalSubclasses: string[]
  exocortexes?: string[]
  orders: string[]
  feats: { name: string; level: number; category?: string }[]
  features: string[]
  ranks: Record<string, number>
  buildSkillRanks?: Record<string, number>
  armor: Record<string, number>
  weapons: Record<string, number>
  weaponRank?: (name: string) => number | undefined
  hellknightWeapons?: string[]
  abilities: Character['abilities']
  senses: string[]
  swimSpeed?: boolean
  spellcastingClassFeature?: boolean
  classFocusSpells?: boolean
  canCastSpells?: boolean
  maxSpellRank?: number
  focusPool?: boolean
  untamedForm?: boolean
  wardenSpells?: string[]
  companionTypes?: string[]
  familiar?: boolean
  primalInnateSpell?: boolean
  gnomePrimalInnateSpell?: boolean
  limitedTelepathy?: boolean
  constructCompanion?: boolean
  championBlessings?: string[]
  deity?: string
  sanctification?: 'Holy' | 'Unholy' | 'None'
  deityAlignment?: string
  legacyTenetsOfGood?: boolean
  devotionSpells?: string[]
  championReaction?: 'protective' | 'offensive'
}

const key = (text: string) => text.trim().toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const met = (): PrerequisiteCheck => ({ missing: [], manual: [] })
const missing = (text: string): PrerequisiteCheck => ({ missing: [text], manual: [] })
const manual = (text: string): PrerequisiteCheck => ({ missing: [], manual: [text] })
const satisfied = (result: PrerequisiteCheck) => !result.missing.length && !result.manual.length
export const ignoresFeatPrerequisites = (entry: ContentEntry) =>
  entry.kind === 'feat' && (entry.systems.includes('pf2e')
    && ["pilgrim's token", 'sanctify water', 'exhort the faithful', 'battle prayer', 'sacred defense'].includes(key(entry.name))
    || entry.systems.includes('sf2e') && key(entry.name) === 'religious talisman')
const prerequisiteText = (entry: ContentEntry) => {
  const text = typeof entry.data.prerequisite === 'string' ? entry.data.prerequisite : ''
  if (ignoresFeatPrerequisites(entry)) return ''
  return entry.kind === 'feat' && key(entry.name) === 'numb to death'
    ? text.split(';').filter(part => key(part).replace(/\.$/, '') !== 'you have died at least once').join(';')
    : text
}
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
  'fatal method': 'Necromancer', 'grim fascination': 'Necromancer',
}
const ROLE_PATTERN = new RegExp(`^(.+?) (${Object.keys(ROLE_CLASSES).sort((a, b) => b.length - a.length).join('|')})$`)
const rankPrefix = /^(untrained|trained|expert|master|legendary)\s+(?:in|with)\s+/i
const GOOD_CHAMPION_CAUSES = new Set(['justice', 'grandeur', 'liberation', 'redemption', 'paladin', 'redeemer', 'liberator'])
const EVIL_CHAMPION_CAUSES = new Set(['desecration', 'iniquity', 'obedience', 'desecrator', 'antipaladin', 'tyrant'])
const CHAMPION_CAUSE_ALIASES: Record<string, string> = { redeemer: 'redemption', liberator: 'liberation' }

export function championCauseTenets(cause?: string) {
  const normalized = key(cause ?? '')
  if (GOOD_CHAMPION_CAUSES.has(normalized)) return 'good'
  if (EVIL_CHAMPION_CAUSES.has(normalized)) return 'evil'
  return undefined
}

interface ContentIndex {
  named: Map<string, ContentEntry[]>
  protectedPattern?: RegExp | null
}
const indexes = new WeakMap<ContentEntry[], ContentIndex>()
function contentIndex(entries: ContentEntry[]) {
  let index = indexes.get(entries)
  if (index) return index
  const named = new Map<string, ContentEntry[]>()
  for (const entry of entries) {
    if (entry.deleted || !['feat', 'classFeature', 'heritage', 'ancestry', 'class', 'subclass'].includes(entry.kind)) continue
    const name = key(entry.name)
    const sources = named.get(name)
    if (sources) sources.push(entry)
    else named.set(name, [entry])
  }
  index = { named }
  indexes.set(entries, index)
  return index
}

function protectedPattern(entries: ContentEntry[]) {
  const index = contentIndex(entries)
  if (index.protectedPattern === undefined) {
    const compoundNames = [...index.named.keys()].filter((name) => /\band\b|\bor\b|[,;]/.test(name))
      .sort((a, b) => b.length - a.length)
    index.protectedPattern = compoundNames.length
      ? new RegExp(`(^|[^a-z0-9])(${compoundNames.map(escape).join('|')})(?=$|[^a-z0-9])`, 'gi') : null
  }
  return index.protectedPattern ?? undefined
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

const suggestionIndexes = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()

export function featPrerequisiteSuggestions(entries: ContentEntry[], context: {
  className?: string; ancestryTraits: string[]; knownFeats?: string[]
}) {
  let index = suggestionIndexes.get(entries)
  if (!index) {
    index = new Map()
    const named = contentIndex(entries).named
    const names = [...named].filter(([, sources]) => sources.some(entry => entry.kind === 'feat')).map(([name]) => name)
      .sort((a, b) => b.length - a.length)
    if (names.length) {
      const byFirstWord = new Map<string, { name: string; offset: number }[]>()
      for (const name of names) {
        const first = /[a-z0-9]+/.exec(name)
        if (!first) continue
        const bucket = byFirstWord.get(first[0]) ?? []
        bucket.push({ name, offset: first.index })
        byFirstWord.set(first[0], bucket)
      }
      for (const entry of entries) {
        if (entry.deleted || entry.kind !== 'feat' || !entry.data.prerequisite) continue
        const text = key(String(entry.data.prerequisite))
        const references = new Set<string>()
        let after = 0
        for (const word of text.matchAll(/[a-z0-9]+/g)) {
          if (word.index < after) continue
          const reference = byFirstWord.get(word[0])?.find(({ name, offset }) => {
            const start = word.index - offset
            return start >= after && (start === 0 || !/[a-z0-9]/.test(text[start - 1]))
              && text.startsWith(name, start) && !/[a-z0-9]/.test(text[start + name.length] ?? '')
          })
          if (!reference) continue
          references.add(reference.name)
          after = word.index - reference.offset + reference.name.length
        }
        for (const reference of references) {
          for (const prerequisite of named.get(reference) ?? []) {
            if (prerequisite.kind !== 'feat' || prerequisite.name === entry.name
              || !prerequisite.traits.some(trait => /^(general|skill)$/i.test(trait))) continue
            const dependents = index.get(prerequisite.name) ?? []
            if (!dependents.includes(entry)) dependents.push(entry)
            index.set(prerequisite.name, dependents)
          }
        }
      }
    }
    suggestionIndexes.set(entries, index)
  }
  const traits = new Set([context.className ?? '', ...context.ancestryTraits].filter(Boolean).map(key))
  const known = new Set(context.knownFeats?.map(key))
  const suggestions = new Map<string, string[]>()
  for (const [name, dependents] of index) {
    if (known.has(key(name))) continue
    const unlocks = [...new Set(dependents.filter(entry => entry.traits.some(trait => traits.has(key(trait))))
      .map(entry => entry.name))].sort((a, b) => a.localeCompare(b))
    if (unlocks.length) suggestions.set(name, unlocks)
  }
  return suggestions
}

export function featSynergySuggestions(entries: ContentEntry[], context: { knownFeats?: string[]; systems?: string[] }) {
  const suggestions = new Map<string, string[]>()
  const known = new Set(context.knownFeats?.map(key))
  const sourceName = 'Forgotten in the Crowd'
  if (!known.has(key(sourceName))) return suggestions
  const supportsSystem = (entry: ContentEntry) => !context.systems?.length
    || entry.systems.some(system => context.systems?.includes(system))
  const named = contentIndex(entries).named
  const source = named.get(key(sourceName))?.find(entry => entry.kind === 'feat' && supportsSystem(entry))
  const target = named.get(key('Face in the Crowd'))?.find(entry => entry.kind === 'feat'
    && entry.traits.some(trait => /^(?:general|skill)$/i.test(trait)) && supportsSystem(entry))
  if (source && target) suggestions.set(target.name, [source.name])
  return suggestions
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
  ignoreAttributePrerequisites?: boolean
  facts: (level: number) => PrerequisiteFacts
}) {
  const index = contentIndex(entries)
  const knownEntries = (text: string) => index.named.get(key(text)) ?? []
  const resultFor = (yes: boolean, text: string) => yes ? met() : missing(text)
  const snarecrafter = (entry: ContentEntry) =>
    String(entry.data.archetype ?? '').split(',').some(archetype => key(archetype) === 'snarecrafter')

  const atom = (text: string, level: number, trail: Set<string>, inheritedRank?: string, survivalForCrafting = false): PrerequisiteCheck | undefined => {
    const facts = context.facts(level)
    const name = key(text).replace(/\.$/, '')
    if (/^kijimuna gnome(?: heritage)?,? or at least one primal innate spell from a gnome heritage or feat$/.test(name))
      return resultFor([facts.heritage, ...(facts.heritages ?? [])].some(heritage => key(heritage ?? '') === 'kijimuna gnome')
        || !!facts.gnomePrimalInnateSpell, text)
    if (name === 'arctic elf, cavern elf, desert elf, woodland elf, or any other elf heritage based on adapting to an environment') {
      const heritages = [facts.heritage ?? '', ...(facts.heritages ?? [])].map(key).filter(Boolean)
      if (heritages.some(heritage => ['arctic elf', 'cavern elf', 'desert elf', 'woodland elf', 'aquatic elf'].includes(heritage))) return met()
      if (!heritages.length || heritages.every(heritage => ['ancient elf', 'seer elf', 'whisper elf', 'half-elf', 'aiuvarin'].includes(heritage))) return missing(text)
      return manual(text)
    }
    if (/^(?:you have a )?spellcasting class feature$/.test(name)) return resultFor(!!facts.spellcastingClassFeature
      || trail.has('hellknight signifer preferment') && !!facts.classFocusSpells, text)
    if (name === 'intercept attack' || name === 'disarming intercept') {
      return resultFor(facts.className === 'Guardian', text)
    }
    if (name === 'you have a swim speed' || name === 'you have swim speed') return resultFor(!!facts.swimSpeed, text)
    if (name === 'focus pool') return resultFor(!!facts.focusPool, text)
    if (trail.has('hallowed earth') && ['the hallowed dead', 'hallowed dead'].includes(name))
      return resultFor(facts.feats.some(feat => ['the hallowed dead', 'hallowed dead'].includes(key(feat.name))), text)
    if (name === 'a familiar' || name === 'familiar') return resultFor(!!facts.familiar, text)
    if (name === 'at least one primal innate spell') return resultFor(!!facts.primalInnateSpell, text)
    if (name === 'at least one primal innate spell from a gnome heritage or feat')
      return resultFor(!!facts.gnomePrimalInnateSpell, text)
    if (name === 'kijimuna gnome')
      return resultFor([facts.heritage, ...(facts.heritages ?? [])].some(heritage => key(heritage ?? '') === name), text)
    if (name === 'limited telepathy') return resultFor(!!facts.limitedTelepathy, text)
    if (key(facts.deity ?? '') === 'laws of mortality'
      && (name === 'you follow the laws of mortality' || name === "can't have a patron deity")) return met()
    if (name === 'you can cast untamed form') return resultFor(!!facts.untamedForm, text)
    const exocortex = /^(drone|mine|turret) exocortex$/.exec(name)
    if (exocortex) return resultFor(facts.className === 'Mechanic'
      && !!facts.exocortexes?.some(choice => key(choice) === exocortex[1]), text)
    if (name === 'sneak attack 2d6' && facts.className === 'Rogue') return resultFor(level >= 5, text)
    if (name === 'construct companion' || name === 'a construct companion') return resultFor(!!facts.constructCompanion, text)
    if (facts.className === 'Champion' && ['blessed armament', 'blessed shield', 'blessed swiftness'].includes(name)) {
      return resultFor(!!facts.championBlessings?.some(blessing => key(blessing) === name), text)
    }
    if (name === 'tenets of good' || name === 'tenets of evil') {
      if (facts.className !== 'Champion' || level < 1) return manual(text)
      const tenets = championCauseTenets(facts.subclass)
      if (tenets === name.replace('tenets of ', '')) return met()
      if (tenets) return missing(text)
      return name === 'tenets of good' && facts.legacyTenetsOfGood ? met() : manual(text)
    }
    const forbiddenSanctification = /^you (?:aren't|are not) (holy|unholy)$/.exec(name)?.[1]
    if (forbiddenSanctification) {
      const forbiddenFeats = forbiddenSanctification === 'holy'
        ? ['the hallowed dead', 'hallowed dead'] : ['the unholy dead', 'unholy dead']
      if (facts.feats.some(feat => forbiddenFeats.includes(key(feat.name)))) return missing(text)
      if (!facts.sanctification) return manual(text)
      return resultFor(key(facts.sanctification) !== forbiddenSanctification, text)
    }
    const requiredSanctification = /^you are (holy|unholy)$/.exec(name)?.[1]
      ?? (facts.className === 'Champion' && ['holy', 'unholy'].includes(name) ? name : undefined)
    if (requiredSanctification) {
      const grantingFeats = requiredSanctification === 'holy'
        ? ['the hallowed dead', 'hallowed dead'] : ['the unholy dead', 'unholy dead']
      if (facts.feats.some(feat => grantingFeats.includes(key(feat.name)))) return met()
      if (!facts.sanctification) return manual(text)
      return resultFor(key(facts.sanctification) === requiredSanctification, text)
    }
    const deityAlignment = /^you (?:follow|worship) a (good|evil)-aligned deity$/.exec(name)
    if (deityAlignment) {
      if (!facts.deityAlignment) return manual(text)
      const allowed = deityAlignment[1] === 'good'
        ? ['lg', 'ng', 'cg', 'good', 'lawful good', 'neutral good', 'chaotic good']
        : ['le', 'ne', 'ce', 'evil', 'lawful evil', 'neutral evil', 'chaotic evil']
      return resultFor(allowed.includes(key(facts.deityAlignment)), text)
    }
    if (facts.className === 'Champion' && name === "champion's aura") return resultFor(level >= 1, text)
    if (facts.className === 'Champion' && name === 'devotion spells') return resultFor(level >= 1, text)
    if (name === 'any feat with the oath trait') {
      const selectedSources = facts.feats.map(feat => featPrerequisiteSources(entries, {
        ...facts, name: feat.name, category: feat.category, entryIds: context.entryIds,
      }))
      const oath = (entry: ContentEntry) => entry.traits.some(trait => key(trait) === 'oath')
      if (selectedSources.some(sources => sources.length && sources.every(oath))) return met()
      return selectedSources.some(sources => !sources.length || sources.some(oath)) ? manual(text) : missing(text)
    }
    if (facts.className === 'Champion' && (name === "champion's reaction"
      || name.startsWith("champion's reaction that grants "))) {
      if (!facts.championReaction) return manual(text)
      if (name === "champion's reaction") return met()
      if (name.startsWith("champion's reaction that grants an ally resistance")) {
        return resultFor(facts.championReaction === 'protective', text)
      }
      if (name.startsWith("champion's reaction that grants extra damage with your strikes")) {
        return resultFor(facts.championReaction === 'offensive', text)
      }
    }
    const devotionSpell = /^devotion spell\s*\((.+)\)$/.exec(name)
    const spell = (devotionSpell?.[1] ?? name).replace(/^[_*]+|[_*]+$/g, '')
    if (facts.className === 'Champion' && ['lay on hands', 'touch of the void', 'shields of the spirit'].includes(spell)) {
      return resultFor(!!facts.devotionSpells?.some(value => key(value) === spell), text)
    }
    // Bare lowercase wording describes a capability, not the named Animal Companion feat.
    if (name === 'an animal companion' || text.replace(/\.$/, '').trim() === 'animal companion') return resultFor(!!facts.companionTypes?.length
      || facts.feats.some(feat => key(feat.name) === 'animal companion')
      || facts.features.some(feature => ['animal companion', 'an animal companion'].includes(key(feature))), text)
    if (name === 'horse animal companion') return resultFor(!!facts.companionTypes?.some(type => key(type) === 'horse'), text)
    if (name === 'warden spells') return resultFor(!!facts.wardenSpells?.length, text)
    const wardenSpell = /^(.+?) warden spell$/.exec(name)
    if (wardenSpell) return resultFor(!!facts.wardenSpells?.some(spell =>
      key(spell) === wardenSpell[1].replace(/^[_*]+|[_*]+$/g, '')), text)
    const spellRank = /^can cast (\d+)(?:st|nd|rd|th)-(?:rank|level) spells$/.exec(name)
    if (spellRank) return resultFor((facts.maxSpellRank ?? 0) >= Number(spellRank[1]), text)
    const qualified = /^\[([^\]]+)\]\s*(.+)$/.exec(name)
    if (qualified) return key(facts.className ?? '') === qualified[1]
      ? evaluate(qualified[2], level, trail, inheritedRank, survivalForCrafting) : met()
    const ethnicity = /^([a-z][a-z' ()-]*?) ethnicity$/.exec(name)
    if (ethnicity && !/\b(?:and|or|any|you|your|must)\b/.test(ethnicity[1])) {
      return resultFor(ethnicityKey(facts.ethnicity ?? '') === ethnicityKey(ethnicity[1]), text)
    }
    const ability = /^(strength|dexterity|constitution|intelligence|wisdom|charisma)\s*(\+?\d+)$/.exec(name)
    const minimumLevel = /^(?:level (\d+)|(?:at least )?(\d+)(?:st|nd|rd|th) level)$/.exec(name)
    if (minimumLevel) return resultFor(level >= Number(minimumLevel[1] ?? minimumLevel[2]), text)
    if (ability) {
      if (context.ignoreAttributePrerequisites) return met()
      const score = facts.abilities[ABILITIES[ability[1]]]
      const requirement = Number(ability[2])
      return resultFor(ability[2].startsWith('+') || requirement < 10
        ? Math.floor((score - 10) / 2) >= requirement : score >= requirement, text)
    }
    const ranked = rankPrefix.exec(name)
    if (ranked || inheritedRank) {
      const rank = RANKS.indexOf(ranked?.[1] ?? inheritedRank!)
      const subject = name.replace(rankPrefix, '').replace(/^(?:your choice of|at least one of|one of)\s+/, '').replace(/\s+saves?$/, '')
      const armor = /^(light|medium|heavy) armor$|^(unarmored) defense$/.exec(subject)
        ?? (/^hellknight (?:half )?plate$/.test(subject) ? [subject, 'heavy'] as unknown as RegExpExecArray : null)
      const weapon = /^(simple|martial|advanced) weapons?$|^(unarmed) attacks?$/.exec(subject)
      const skill = armor || weapon || /^clan daggers?$/.test(subject) ? undefined
        : Object.keys(facts.buildSkillRanks ?? facts.ranks).find((skill) => key(skill) === subject)
      if (/^(?:at least )?(?:one|any) skill$/.test(subject)) {
        return resultFor(Object.entries(facts.buildSkillRanks ?? facts.ranks).some(([stat, value]) =>
          !/^(?:perception|fortitude|reflex|will)$/i.test(stat) && value >= rank), text)
      }
      if (skill) {
        const ranks = /^(?:perception|fortitude|reflex|will)$/i.test(skill)
          ? facts.ranks : facts.buildSkillRanks ?? facts.ranks
        const actual = subject === 'crafting' && survivalForCrafting && facts.className === 'Ranger'
          ? Math.max(ranks[skill], ranks.Survival ?? 0) : ranks[skill]
        return resultFor(rankSatisfied(actual, rank), text)
      }
      if (/^[\w' -]+ lore$/.test(subject) && !/\b(?:and|or)\b/.test(subject)) return resultFor(rankSatisfied(0, rank), text)
      if (/^(?:at least )?one (?:or more )?lore skills?$/.test(subject)) {
        return resultFor(Object.entries(facts.buildSkillRanks ?? facts.ranks)
          .some(([skill, value]) => / lore$/i.test(skill) && value >= rank), text)
      }
      if (armor) {
        const group = armor[1] ?? armor[2]
        return resultFor(rankSatisfied(facts.armor[group[0].toUpperCase() + group.slice(1)] ?? 0, rank), text)
      }
      if (/^clan daggers?$/.test(subject)) return resultFor(rankSatisfied(facts.weapons.Simple ?? 0, rank), text)
      if (/^(?:your )?order'?s favored weapons?$/.test(subject)) {
        if (!facts.hellknightWeapons?.length || !facts.weaponRank) return manual(text)
        const ranks = facts.hellknightWeapons.map(weapon => facts.weaponRank!(weapon))
        if (ranks.some(value => value !== undefined && rankSatisfied(value, rank))) return met()
        return ranks.some(value => value === undefined) ? manual(text) : missing(text)
      }
      if (weapon) {
        const group = weapon[1] ?? weapon[2]
        return resultFor(rankSatisfied(facts.weapons[group[0].toUpperCase() + group.slice(1)] ?? 0, rank), text)
      }
      if (subject === 'sawtooth sabers') {
        const weaponRank = facts.weaponRank?.('Sawtooth Saber')
        return weaponRank === undefined ? manual(text) : resultFor(rankSatisfied(weaponRank, rank), text)
      }
    }
    if (/^(?:passed the hellknight test|member of a hellknight order|trained by a hellknight order|lawful alignment|you've refused to take or have failed the hellknight test)\.?$/.test(name)) return met()
    const role = ROLE_PATTERN.exec(name)
    if (role) {
      const choices = role[2] === 'order' ? facts.orders : role[2] === 'fatal method' ? [facts.fatalMethod ?? '']
        : [facts.subclass ?? '', ...facts.additionalSubclasses]
      const normalize = (value: string) => {
        const name = key(value).replace(/^the /, '').replace(new RegExp(` ${role[2]}$`), '')
        return role[2] === 'order' && name === 'untamed' ? 'wild'
          : role[2] === 'cause' ? CHAMPION_CAUSE_ALIASES[name] ?? name : name
      }
      const expected = normalize(role[1])
      const known = role[2] === 'order' ? context.knownOrders.some((order) => normalize(order) === expected)
        : knownEntries(role[1]).some((entry) => entry.kind === 'subclass' && entry.data.class === ROLE_CLASSES[role[2]])
      if (known || role[2] === 'fatal method' && ['puppeteer', 'reaper'].includes(expected)
        || role[2] === 'grim fascination' && ['blood', 'bone', 'flesh', 'spirit'].includes(expected)
        || role[2] === 'cause' && Object.values(CHAMPION_CAUSE_ALIASES).includes(expected)
        || choices.some((choice) => normalize(choice) === expected)) {
        return resultFor(facts.className === ROLE_CLASSES[role[2]] && choices.some((choice) => normalize(choice) === expected), text)
      }
    }
    const reference = name.replace(/ (?:class feature|feat|heritage|ancestry)$/, '')
    const references = reference === 'attack of opportunity' ? [reference, 'reactive strike']
      : reference === 'reactive strike' ? [reference, 'attack of opportunity']
      : reference === 'ancestral unarmed attack' ? [reference, ...ancestralUnarmedFeatNames(
        facts.ancestryTraits ?? [facts.ancestry ?? '', facts.heritage ?? '']).map(key)] : [reference]
    if (reference === 'spellcasting' && facts.spellcastingClassFeature
      || reference === 'focus pool' && facts.focusPool
      || reference === 'ability to cast spells' && facts.canCastSpells) return met()
    if (facts.features.some((feature) => references.includes(key(feature)))) return met()
    const content = references.flatMap(knownEntries)
    if (content.some((entry) => entry.kind === 'heritage')) return resultFor(key(facts.heritage ?? '') === reference
      || !!facts.heritages?.some(heritage => key(heritage) === reference)
      || !!facts.ancestryTraits?.some(trait => key(trait) === reference), text)
    if (content.some((entry) => entry.kind === 'ancestry')) return resultFor(key(facts.ancestry ?? '') === reference, text)
    if (content.some((entry) => entry.kind === 'class')) return resultFor(key(facts.className ?? '') === reference, text)
    const selected = facts.feats.filter((feat) => references.includes(key(feat.name)))
    if (selected.length) {
      if (references.some(value => trail.has(value))) return missing(`Circular prerequisite: ${text}`)
      const next = new Set([...trail, ...references])
      const checks = selected.map((feat) => {
        const sources = featPrerequisiteSources(entries, {
          className: facts.className, ancestry: facts.ancestry, heritage: facts.heritage,
          ancestryTraits: facts.ancestryTraits, name: feat.name, category: feat.category, entryIds: context.entryIds,
        })
        const requirements = [...new Set(sources.map(prerequisiteText))]
        return requirements.length > 1 ? manual(`Verify source version of ${text}`)
          : evaluate(requirements[0] ?? '', feat.level, next, undefined, sources.some(snarecrafter))
      })
      return checks.find(satisfied) ?? checks[0]
    }
    if (content.some((entry) => entry.kind === 'feat' || entry.kind === 'classFeature')) return missing(text)
    if (name === 'a sense with a listed range') {
      return resultFor(facts.senses.some(sense => {
        const range = /\b(\d+)\s*(?:feet|foot|ft)\b/i.exec(sense)
        return !!range && Number(range[1]) > 0 && !/telepath/i.test(sense)
      }), text)
    }
    if (/^(?:low-light vision|darkvision|scent|tremorsense)$/.test(name)) {
      return resultFor(facts.senses.some((sense) => key(sense).includes(name)), text)
    }
    return undefined
  }

  const evaluate = (input: string, level: number, trail: Set<string>, inheritedRank?: string, survivalForCrafting = false): PrerequisiteCheck => {
    const text = input.trim()
    if (!text) return met()
    const atomic = atom(text, level, trail, inheritedRank, survivalForCrafting)
    if (atomic) return atomic
    const protectedNames: string[] = []
    const pattern = protectedPattern(entries)
    const safe = pattern ? text.replace(pattern, (_, prefix: string, name: string) => {
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
        return evaluate(value, level, trail, inherited, survivalForCrafting)
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
    if (text.startsWith('(') && text.endsWith(')')) return evaluate(text.slice(1, -1), level, trail, inheritedRank, survivalForCrafting)
    return manual(text)
  }

  const results = new Map<ContentEntry, PrerequisiteCheck>()
  return (entry: ContentEntry): PrerequisiteCheck => {
    let result = results.get(entry)
    if (!result) {
      result = evaluate(prerequisiteText(entry), context.level,
        new Set([key(entry.name)]), undefined, snarecrafter(entry))
      results.set(entry, result)
    }
    return result
  }
}
