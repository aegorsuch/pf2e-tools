import { featTakenLevel } from './featChoices'
import type { Character, ContentEntry, SpellGrant } from './types'

export const DOMAIN_FEATS = ['Domain Initiate', "Deity's Domain", 'Advanced Domain', "Advanced Deity's Domain"]

const featCache = new WeakMap<ContentEntry[], Map<string, ContentEntry>>()
function featSource(c: Character, entries: ContentEntry[], name: string) {
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

export function featSpellOptions(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
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
  const out: { entry: ContentEntry; source: string; rule: SpellGrant; rank: number }[] = []
  for (const feat of c.feats) {
    if (featTakenLevel(feat) > c.level) continue
    const source = featSource(c, entries, feat.name)
    const rules = source?.spellGrants ?? []
    const options = featSpellOptions(c, entries, feat)
    if (feat.name === 'Qi Spells' && feat.choice && options?.some(spell => spell.name === feat.choice)) {
      const entry = options.find(spell => spell.name === feat.choice)
      if (entry) out.push({ entry, source: feat.name, rule: { kind: 'focus', spells: [entry.name], heightened: true }, rank: Math.ceil(c.level / 2) })
      continue
    }
    if (DOMAIN_FEATS.includes(feat.name) && feat.choice) {
      const advanced = feat.name.startsWith('Advanced')
      for (const entry of entries.filter(spell => spell.kind === 'spell' && !spell.deleted && spell.traits.includes('Focus')
        && spell.systems.some(system => c.systems.includes(system))
        && spell.level === (advanced ? 4 : 1)
        && String(spell.data.domain).split(/,\s*/).some(domain => domain.toLowerCase() === feat.choice!.toLowerCase()))) {
        out.push({ entry, source: `${feat.name}: ${feat.choice}`, rule: { kind: 'focus', spells: [entry.name], tradition: 'Divine', heightened: true }, rank: Math.ceil(c.level / 2) })
      }
    }
    for (const rule of rules) {
      const names = rule.choice ? options?.filter(spell => spell.name === feat.choice).map(spell => spell.name) ?? [] : rule.spells
      for (const name of names) {
        const entry = entries.find(spell => spell.kind === 'spell' && !spell.deleted && spell.name.toLowerCase() === name.toLowerCase()
          && spell.systems.some(system => c.systems.includes(system)))
        if (entry) out.push({ entry, source: feat.name, rule, rank: rule.heightened || entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
          ? Math.ceil(c.level / 2) : rule.rank ?? entry.level })
      }
    }
  }
  return out
}

export function unresolvedFeatSpells(c: Character, entries: ContentEntry[]) {
  return c.feats.filter(feat => featTakenLevel(feat) <= c.level).flatMap(feat => {
    const source = featSource(c, entries, feat.name)
    return (source?.spellGrants ?? []).flatMap(rule => (rule.choice ? feat.choice ? [feat.choice] : [] : rule.spells)
      .filter(name => !entries.some(entry => entry.kind === 'spell' && !entry.deleted && entry.name.toLowerCase() === name.toLowerCase()
        && entry.systems.some(system => c.systems.includes(system))))
      .map(name => ({ name, source })))
  })
}
