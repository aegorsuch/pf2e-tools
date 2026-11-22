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

export function fiendOptions(fiends: SummonedFiend[], rank: number, lineage?: string, requiredTrait?: string) {
  const maxLevel = fiendLevelLimit(rank)
  const category: Record<string, string> = { Pitborn: 'demon', Hellspawn: 'devil', Grimspawn: 'daemon', Faultspawn: 'asura' }
  const required = lineage ? category[lineage] : undefined
  if (maxLevel === undefined || lineage && !required) return []
  return fiends.filter(fiend => fiend.level <= maxLevel
    && (!required || fiend.traits.some(trait => trait.toLowerCase() === required))
    && (!requiredTrait || fiend.traits.some(trait => trait.toLowerCase() === requiredTrait.toLowerCase())))
}

export function activeSummonedFiend(c: Character) {
  return c.summonedFiend
}

export function normalizeFiends(hits: Hit[]): SummonedFiend[] {
  const byId = new Map(hits.map(hit => [hit._id, hit._source]))
  const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
  const numericArray = (keys: string[], source: Record<string, unknown>) => keys.map(key => numeric(source[key]) ?? null)
  const text = (value: unknown) => typeof value === 'string' ? value : ''
  const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  return hits.flatMap(hit => {
    const source = hit._source
    if (!source) return []
    const categories = /^(demon|devil|daemon|asura)$/i
    const remasters = strings(source.remaster_id).map(id => byId.get(id)).filter(Boolean)
    if (!hit._id || (remasters.length > 0 && remasters.every(remaster =>
      strings(source.trait).filter(trait => categories.test(trait)).every(trait =>
        strings(remaster?.trait).some(value => value.toLowerCase() === trait.toLowerCase()))))
      || text(source.rarity).toLowerCase() !== 'common'
      || !strings(source.trait).some(trait => trait.toLowerCase() === 'fiend')
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
