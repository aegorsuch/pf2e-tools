import type { Character } from './types.ts'
import type { Hit } from './aonQuery.ts'

export type SummonedFiend = {
  id: string
  name: string
  level: number
  traits: string[]
  url: string
  abilities: (number | null)[]
  hp?: number
  ac?: number
  saves: (number | null)[]
  perception?: number
  senses: string
  skills: string
  speed: string
  resistances: string
  weaknesses: string
  attacks: string[]
}

export function fiendLevelLimit(rank: number) {
  return Number.isInteger(rank) && rank >= 5 && rank <= 10 ? 2 * rank - 5 : undefined
}

export function fiendOptions(fiends: SummonedFiend[], rank: number, lineage?: string, requiredTrait?: string, highestOnly = false) {
  const maxLevel = fiendLevelLimit(rank)
  const category: Record<string, string> = { Pitborn: 'demon', Hellspawn: 'devil', Grimspawn: 'daemon', Faultspawn: 'asura',
    Angelkin: 'angel', Lawbringer: 'archon', Musetouched: 'azata' }
  const required = lineage ? category[lineage] : undefined
  if (maxLevel === undefined || lineage && !required) return []
  const eligible = fiends.filter(fiend => fiend.level <= maxLevel
    && (!required || fiend.traits.some(trait => trait.toLowerCase() === required))
    && (!requiredTrait || fiend.traits.some(trait => trait.toLowerCase() === requiredTrait.toLowerCase())))
  if (!highestOnly) return eligible
  const highest = Math.max(...eligible.map(fiend => fiend.level))
  return eligible.filter(fiend => fiend.level === highest)
}

export function normalizeCelestials(hits: Hit[]): SummonedFiend[] {
  return normalizeCreatures(hits, ['celestial'], /^(angel|archon|azata)$/i)
}

export const summonSpellName = (creature: Pick<SummonedFiend, 'traits'>) =>
  creature.traits.some(trait => trait.toLowerCase() === 'celestial') ? 'Summon Celestial' : 'Summon Fiend'

export function activeSummonedFiend(c: Character) {
  return c.summonedFiend
}

export function normalizeFiends(hits: Hit[]): SummonedFiend[] {
  return normalizeCreatures(hits, ['fiend'], /^(demon|devil|daemon|asura)$/i)
}

export function plantLevelLimit(rank: number) {
  return Number.isInteger(rank) && rank >= 1 && rank <= 10
    ? rank === 1 ? -1 : rank === 2 ? 1 : rank <= 4 ? rank - 1 : 2 * rank - 5 : undefined
}

export function plantOptions(creatures: SummonedFiend[], rank: number) {
  const maxLevel = plantLevelLimit(rank)
  return maxLevel === undefined ? [] : creatures.filter(creature => creature.level <= maxLevel
    && creature.traits.some(trait => /^(plant|fungus)$/i.test(trait)))
}

export function normalizePlants(hits: Hit[]): SummonedFiend[] {
  return normalizeCreatures(hits, ['plant', 'fungus'], /^(plant|fungus)$/i)
}

export function undeadLevelLimit(rank: number) {
  return Number.isInteger(rank) && rank >= 1 && rank <= 10
    ? rank === 1 ? -1 : rank <= 4 ? rank - 1 : 2 * rank - 5 : undefined
}

export function undeadOptions(creatures: SummonedFiend[], rank: number) {
  const maxLevel = undeadLevelLimit(rank)
  return maxLevel === undefined ? [] : creatures.filter(creature => creature.level <= maxLevel
    && creature.traits.some(trait => /^undead$/i.test(trait)))
}

export function normalizeUndead(hits: Hit[]): SummonedFiend[] {
  return normalizeCreatures(hits, ['undead'], /^undead$/i)
}

function normalizeCreatures(hits: Hit[], requiredTraits: string[], categories: RegExp): SummonedFiend[] {
  const byId = new Map(hits.map(hit => [hit._id, hit._source]))
  const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
  const numericArray = (keys: string[], source: Record<string, unknown>) => keys.map(key => numeric(source[key]) ?? null)
  const text = (value: unknown) => typeof value === 'string' ? value : ''
  const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  return hits.flatMap(hit => {
    const source = hit._source
    if (!source) return []
    const remasters = strings(source.remaster_id).map(id => byId.get(id)).filter(Boolean)
    if (!hit._id || (remasters.length > 0 && remasters.every(remaster =>
      strings(source.trait).filter(trait => categories.test(trait)).every(trait =>
        strings(remaster?.trait).some(value => value.toLowerCase() === trait.toLowerCase()))))
      || text(source.rarity).toLowerCase() !== 'common'
      || !strings(source.trait).some(trait => requiredTraits.includes(trait.toLowerCase()))
      || typeof source.level !== 'number' || !Number.isFinite(source.level) || source.level > 15
      || !text(source.name) || !/^\/Monsters\.aspx\?ID=\d+$/.test(text(source.url))) return []
    const traits = strings(source.trait)
    const attacks = [...text(source.markdown).matchAll(/\*\*(?:Melee|Ranged)\*\*\s*(?:<actions[^>]*\/>\s*)?([^\n]+)\n\s*\*\*Damage\*\*\s*([^\n]+)/gi)]
      .map(match => `${match[1].replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')} — ${match[2].replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')}`)
    return [{
      id: hit._id, name: text(source.name), level: source.level, traits, url: `https://2e.aonprd.com${source.url}`,
      abilities: numericArray(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'], source),
      hp: numeric(source.hp), ac: numeric(source.ac),
      saves: numericArray(['fortitude_save', 'reflex_save', 'will_save'], source),
      perception: numeric(source.perception), senses: text(source.sense),
      skills: text(source.skill_markdown).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'),
      speed: text(source.speed_raw), resistances: text(source.resistance_raw), weaknesses: text(source.weakness_raw), attacks,
    }]
  }).sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level || a.id.localeCompare(b.id))
}
