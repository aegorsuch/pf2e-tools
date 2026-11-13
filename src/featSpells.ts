import { featTakenLevel } from './featChoices'
import type { Character, ContentEntry, SpellGrant } from './types'
import { warmaskSource } from './warmask'

export const DOMAIN_FEATS = ['Domain Initiate', "Deity's Domain", 'Advanced Domain', "Advanced Deity's Domain"]

const domainSpellCache = new WeakMap<ContentEntry[], ContentEntry[]>()
export function domainFeatSpells(c: Character, entries: ContentEntry[], featName: string, domain: string) {
  let spells = domainSpellCache.get(entries)
  if (!spells) {
    spells = entries.filter(entry => entry.kind === 'spell' && !entry.deleted && entry.traits.includes('Focus')
      && (entry.level === 1 || entry.level === 4) && typeof entry.data.domain === 'string')
    domainSpellCache.set(entries, spells)
  }
  return spells.filter(spell => spell.systems.some(system => c.systems.includes(system))
    && spell.level === (featName.startsWith('Advanced') ? 4 : 1)
    && String(spell.data.domain).split(',').some(value => value.trim().toLowerCase() === domain.trim().toLowerCase()))
}

export function domainSpellDescription(c: Character, entries: ContentEntry[], featName: string, domain: string) {
  const names = [...new Set(domainFeatSpells(c, entries, featName, domain).map(spell => spell.name))]
  return names.length ? `Granted focus spell${names.length === 1 ? '' : 's'}: ${names.join(', ')}.`
    : 'Domain spell data unavailable. Sync Archives of Nethys content to load it.'
}

export function refocusRecovery(c: Character, entries: ContentEntry[], capacity: number, spent: number) {
  let recovery = 1
  for (const feat of c.feats.filter(feat => featTakenLevel(feat) <= c.level)) {
    const text = entries.find(entry => entry.kind === 'feat' && !entry.deleted && entry.name === feat.name
      && entry.systems.some(system => c.systems.includes(system)))?.description ?? ''
    if (/When you Refocus, you (?:regain|recover) all your Focus Points/i.test(text)) recovery = capacity
    const conditional = /spent at least ([23]) Focus Points since the last time you Refocused/i.exec(text)
    const amount = /(?:recover|regain) ([23]) Focus Points when you Refocus instead of 1/i.exec(text)
    if (conditional && amount && (c.focusPointsSpentSinceRefocus ?? spent) >= Number(conditional[1])) {
      recovery = Math.max(recovery, Number(amount[1]))
    }
  }
  return Math.min(capacity, recovery)
}

const spellAlias = (name: string) => name.toLowerCase() === 'pass without trace' ? 'vanishing tracks' : name.toLowerCase()
const matchesSpell = (spell: ContentEntry, name: string) => spell.name.toLowerCase() === name.toLowerCase()
  || spell.name.toLowerCase() === spellAlias(name)

const featCache = new WeakMap<ContentEntry[], Map<string, ContentEntry>>()
function featSource(c: Character, entries: ContentEntry[], name: string) {
  if (name === 'Ancestral Magic' || name === 'Ancestral Cantrip') {
    const ancestries = [c.ancestry, c.heritage, ...c.feats.filter(feat => feat.name === 'Adopted Ancestry'
      && featTakenLevel(feat) <= c.level).map(feat => feat.choice)].filter((value): value is string => !!value)
    return entries.find(entry => entry.kind === 'feat' && !entry.deleted && entry.name === name
      && entry.systems.some(system => c.systems.includes(system))
      && entry.traits.some(trait => ancestries.some(ancestry => ancestry.toLowerCase() === trait.toLowerCase())))
  }
  let map = featCache.get(entries)
  if (!map) {
    map = new Map()
    for (const entry of entries) if (entry.kind === 'feat' && !entry.deleted) {
      for (const system of entry.systems) if (!map.has(`${system}:${entry.name}`)) map.set(`${system}:${entry.name}`, entry)
    }
    featCache.set(entries, map)
  }
  return c.systems.map(system => map.get(`${system}:${name}`)).find(Boolean)
}

function ancestralCantripRules(c: Character, entries: ContentEntry[]) {
  const source = featSource(c, entries, 'Ancestral Cantrip')
  const options = /Option\(s\):\s*([^\n]*)/i.exec(source?.description ?? '')?.[1]
  if (!options) return undefined
  const parts = options.split(';').map(part => part.trim())
  if (parts.some(part => /shiny heritage only/i.test(part)) && !/\bshiny\b/i.test(c.heritage ?? '')) return undefined
  const tradition = parts.find(part => /^(arcane|divine|occult|primal)$/i.test(part))
  const spells = parts.at(-1)?.split(/\s*,\s*|\s+or\s+/i).map(name => name.trim().replace(/[.)]+$/, '')).filter(Boolean) ?? []
  return spells.length ? { tradition, spells, any: /^any (?:arcane|divine|occult|primal) cantrip$/i.test(spells[0]) } : undefined
}

function ancestralMagicRules(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  const source = featSource(c, entries, 'Ancestral Magic')
  const options = /Option\(s\):\s*(arcane|divine|occult|primal)\s*;([^\n]*)/i.exec(source?.description ?? '')
  if (!options) return undefined
  const level = featTakenLevel(feat)
  const rank = level >= 17 ? 7 : level >= 13 ? 5 : level >= 9 ? 3 : 1
  const used = new Set(c.feats.filter(other => other.name === feat.name
    && (feat.slot ? other.slot !== feat.slot : other !== feat)).flatMap(other => other.choice ? [other.choice.toLowerCase()] : []))
  const spells = [...options[2].matchAll(/(?:^|;)\s*(\d+)(?:st|nd|rd|th)\s+([^;]+)/gi)]
    .filter(match => Number(match[1]) <= rank)
    .flatMap(match => match[2].split(',').map(name => name.trim().replace(/[.)]+$/, '')).filter(Boolean))
    .filter(name => !used.has(name.toLowerCase()))
  return { tradition: options[1], rank, spells }
}

export function ancestralMagicAvailable(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  return !!ancestralMagicRules(c, entries, feat)?.spells.length
}

export function featSpellOptions(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  if (feat.name === 'Mask of Power') {
    return entries.filter(spell => spell.kind === 'spell' && !spell.deleted
      && spell.systems.some(system => c.systems.includes(system))
      && ['Fear', 'Phantom Pain', 'True Strike', 'Sure Strike'].includes(spell.name))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Touch of the Sea') {
    return entries.filter(spell => spell.kind === 'spell' && !spell.deleted
      && spell.systems.some(system => c.systems.includes(system))
      && ['Gale Blast', 'Spout'].includes(spell.name)).sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Ancestral Cantrip') {
    const rules = ancestralCantripRules(c, entries)
    return entries.filter(spell => spell.kind === 'spell' && !spell.deleted
      && spell.systems.some(system => c.systems.includes(system))
      && spell.traits.some(trait => trait.toLowerCase() === 'cantrip')
      && !!rules && (rules.any ? !!rules.tradition && String(spell.data.tradition ?? '').toLowerCase().split(/,\s*/).includes(rules.tradition.toLowerCase())
        && !spell.traits.some(trait => /^(uncommon|rare|unique|focus)$/i.test(trait))
        : rules.spells.some(name => matchesSpell(spell, name))))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  if (feat.name === 'Ancestral Magic') {
    const rules = ancestralMagicRules(c, entries, feat)
    return entries.filter(spell => spell.kind === 'spell' && !spell.deleted
      && spell.systems.some(system => c.systems.includes(system))
      && rules?.spells.some(name => matchesSpell(spell, name)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  const entry = featSource(c, entries, feat.name)
  const rule = entry?.spellGrants?.find(grant => grant.choice)
  if (!rule && feat.name !== 'Qi Spells') return undefined
  return entries.filter(spell => spell.kind === 'spell' && !spell.deleted && spell.systems.some(system => c.systems.includes(system))
    && (feat.name === 'Qi Spells'
      ? spell.level === 1 && spell.traits.includes('Focus') && spell.traits.includes('Monk')
      : rule?.choice === 'cantrip'
        ? spell.traits.some(trait => trait.toLowerCase() === 'cantrip')
          && typeof rule.tradition === 'string' && String(spell.data.tradition).toLowerCase().split(/,\s*/).includes(rule.tradition.toLowerCase())
          && !spell.traits.some(trait => /^(uncommon|rare|unique|focus)$/i.test(trait))
        : rule?.spells.some(name => name.toLowerCase() === spell.name.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function grantedFeatSpells(c: Character, entries: ContentEntry[]) {
  const out: { entry: ContentEntry; source: string; rule: SpellGrant; rank: number; usageKey: string }[] = []
  for (const [index, feat] of c.feats.entries()) {
    if (featTakenLevel(feat) > c.level) continue
    const selection = feat.slot ?? `${feat.name}:${c.feats.slice(0, index).filter(other => other.name === feat.name).length}`
    const source = featSource(c, entries, feat.name)
    if (feat.name === 'Mask of Power') {
      const warmask = warmaskSource(c)
      const entry = featSpellOptions(c, entries, feat)?.find(spell => spell.name === feat.choice)
      if (warmask && entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: warmask.tradition, frequency: 'once per day',
          condition: 'Must be wearing your warmask' },
        rank: 1, usageKey: JSON.stringify([selection, feat.name, 'daily']) })
      continue
    }
    if (feat.name === 'Ancestral Cantrip') {
      const rule = ancestralCantripRules(c, entries)
      const spell = feat.choice && featSpellOptions(c, entries, feat)?.find(entry => entry.name === feat.choice)
      if (rule && spell) out.push({ entry: spell, source: feat.name,
        rule: { kind: 'innate', spells: [spell.name], tradition: rule.tradition, frequency: 'at will', heightened: true,
          ...(!rule.tradition ? { condition: 'Tradition not specified in ancestry source; verify with GM' } : {}) },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, spell.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Elemental Wrath') {
      const damage = ['Acid', 'Cold', 'Electricity', 'Fire'].find(value => value.toLowerCase() === feat.choice?.toLowerCase())
      const spell = entries.find(entry => entry.kind === 'spell' && !entry.deleted
        && ['Acid Splash', 'Caustic Splash'].includes(entry.name) && entry.systems.some(system => c.systems.includes(system)))
      if (damage && spell) {
        const entry = { ...spell, traits: [...spell.traits.filter(trait => trait.toLowerCase() !== 'acid'), damage],
          description: `${spell.description.replace(/\bacid\b/gi, match => match[0] === 'A' ? damage : damage.toLowerCase())}\n\nElemental Wrath: ${damage.toLowerCase()} damage and trait; verbal components only.` }
        out.push({ entry, source: feat.name,
          rule: { kind: 'innate', spells: [entry.name], tradition: 'primal', frequency: 'at will', heightened: true },
          rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, 'elemental-wrath']) })
      }
      continue
    }
    if (feat.name === 'Grown of Oak') {
      const entry = entries.find(spell => spell.kind === 'spell' && !spell.deleted && spell.name === 'Oaken Resilience'
        && spell.systems.some(system => c.systems.includes(system)))
      const slots = Object.entries(c.spellcasting?.slots ?? {}).filter(([rank, count]) => count > 0 && Number.isInteger(Number(rank)) && Number(rank) >= 1 && Number(rank) <= 10).map(([rank]) => Number(rank))
      const otherSpells = grantedFeatSpells({ ...c, feats: c.feats.filter(other => other.name !== 'Grown of Oak') }, entries)
      const highest = Math.max(c.className === 'Druid' ? Math.min(10, Math.ceil(c.level / 2)) : 0,
        ...slots, ...otherSpells.filter(grant => !grant.entry.traits.some(trait => trait.toLowerCase() === 'cantrip')).map(grant => grant.rank), 0)
      if (entry && highest >= 3) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'primal', frequency: 'at will',
          condition: 'Targets you and your leshy familiar within 30 feet' },
        rank: highest - 1, usageKey: JSON.stringify([selection, feat.name, entry.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Touch of the Sea') {
      const entry = featSpellOptions(c, entries, feat)?.find(spell => spell.name === feat.choice)
      if (entry) out.push({ entry, source: feat.name,
        rule: { kind: 'innate', spells: [entry.name], tradition: 'primal', frequency: 'at will', heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, entry.name.toLowerCase()]) })
      continue
    }
    if (feat.name === 'Ancestral Magic') {
      const rule = ancestralMagicRules(c, entries, feat)
      const spell = feat.choice && featSpellOptions(c, entries, feat)?.find(entry => entry.name === feat.choice)
      if (rule && spell) out.push({ entry: spell, source: feat.name,
        rule: { kind: 'innate', spells: [spell.name], tradition: rule.tradition, frequency: 'once per day' },
        rank: rule.rank, usageKey: JSON.stringify([selection, feat.name, spell.name.toLowerCase()]) })
      continue
    }
    const rules = source?.spellGrants ?? []
    const options = featSpellOptions(c, entries, feat)
    if (feat.name === 'Qi Spells' && feat.choice && options?.some(spell => spell.name === feat.choice)) {
      const entry = options.find(spell => spell.name === feat.choice)
      if (entry) out.push({ entry, source: feat.name, rule: { kind: 'focus', spells: [entry.name], heightened: true },
        rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, 'qi']) })
      continue
    }
    if (DOMAIN_FEATS.includes(feat.name) && feat.choice) {
      for (const entry of domainFeatSpells(c, entries, feat.name, feat.choice)) {
        out.push({ entry, source: `${feat.name}: ${feat.choice}`, rule: { kind: 'focus', spells: [entry.name], tradition: 'Divine', heightened: true },
          rank: Math.ceil(c.level / 2), usageKey: JSON.stringify([selection, feat.name, 'domain', entry.name]) })
      }
    }
    for (const baseRule of rules) {
      const rule = feat.name === 'Forgotten in the Crowd' && baseRule.kind === 'innate'
        && baseRule.frequency === 'once per day' && baseRule.spells.some(name => name.toLowerCase() === 'invisibility')
        && c.feats.some(other => other.name === 'Face in the Crowd' && featTakenLevel(other) <= c.level)
        ? { ...baseRule, frequency: 'twice per day' } : baseRule
      const names = rule.choice ? options?.filter(spell => spell.name === feat.choice).map(spell => spell.name) ?? [] : rule.spells
      for (const name of names) {
        const available = entries.filter(spell => spell.kind === 'spell' && !spell.deleted && matchesSpell(spell, name)
          && spell.systems.some(system => c.systems.includes(system)))
        const entry = available.find(spell => spell.name.toLowerCase() === name.toLowerCase()) ?? available[0]
        if (entry) out.push({ entry, source: feat.name, rule, rank: rule.heightened || entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
          ? Math.ceil(c.level / 2) : rule.rank ?? entry.level,
          usageKey: JSON.stringify([selection, feat.name, baseRule.spells.map(spell => spell.toLowerCase()).sort(),
            rule.tradition?.toLowerCase() ?? '', rule.shared || rule.choice ? 'shared' : entry.name.toLowerCase()]) })
      }
    }
  }
  return out
}

export function dailyInnateUses(c: Character, grant: ReturnType<typeof grantedFeatSpells>[number]) {
  if (grant.rule.kind !== 'innate') return undefined
  const frequency = /^(once|twice|(\d+) times) per day(?: each)?$/i.exec(grant.rule.frequency ?? '')
  if (!frequency) return undefined
  const limit = frequency[1].toLowerCase() === 'once' ? 1 : frequency[1].toLowerCase() === 'twice' ? 2 : Number(frequency[2])
  const used = c.innateSpellUses?.[grant.usageKey] ?? 0
  return { key: grant.usageKey, limit, used, remaining: Math.max(0, limit - used) }
}

export function unresolvedFeatSpells(c: Character, entries: ContentEntry[]) {
  return c.feats.filter(feat => featTakenLevel(feat) <= c.level).flatMap(feat => {
    const source = featSource(c, entries, feat.name)
    if (feat.name === 'Grown of Oak' && !entries.some(entry => entry.kind === 'spell' && !entry.deleted
      && entry.name === 'Oaken Resilience' && entry.systems.some(system => c.systems.includes(system)))) {
      return [{ name: 'Oaken Resilience', source }]
    }
    if (feat.name === 'Elemental Wrath' && !entries.some(entry => entry.kind === 'spell' && !entry.deleted
      && ['Acid Splash', 'Caustic Splash'].includes(entry.name) && entry.systems.some(system => c.systems.includes(system)))) {
      return [{ name: 'Acid Splash or Caustic Splash', source }]
    }
    return (source?.spellGrants ?? []).flatMap(rule => (rule.choice ? feat.choice ? [feat.choice] : [] : rule.spells)
      .filter(name => !entries.some(entry => entry.kind === 'spell' && !entry.deleted && matchesSpell(entry, name)
        && entry.systems.some(system => c.systems.includes(system))))
      .map(name => ({ name, source })))
  })
}
