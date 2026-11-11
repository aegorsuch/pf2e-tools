import type { Character, ContentEntry } from './types'

export type Ability = keyof Character['abilities']
export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export const abilityMod = (score: number) => Math.floor((score - 10) / 2)
export const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

const num = (v: unknown) => (typeof v === 'number' ? v : Number.isFinite(parseFloat(String(v))) ? parseFloat(String(v)) : 0)

const byName = (entries: ContentEntry[], kind: ContentEntry['kind'], name?: string) =>
  name ? entries.find((e) => e.kind === kind && e.name === name) : undefined

// Level 1 HP = ancestry HP + class HP + Con; each later level adds class HP + Con
export function maxHp(c: Character, entries: ContentEntry[]) {
  const ancestry = num(byName(entries, 'ancestry', c.ancestry)?.data.hp)
  const cls = num(byName(entries, 'class', c.className)?.data.hp)
  return ancestry + (cls + abilityMod(c.abilities.con)) * c.level
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Heritages link to an ancestry only on SF2e; elsewhere every heritage is offered.
export function heritagesFor(entries: ContentEntry[], ancestry?: string) {
  const all = entries.filter((e) => e.kind === 'heritage')
  const target = ancestry ? slug(ancestry) : ''
  const linked = all.filter((e) => e.data.ancestry === target)
  return linked.length ? linked : all.filter((e) => !e.data.ancestry)
}

// Best-effort feat category from AoN traits
export function featType(feat: ContentEntry, c: Character) {
  const t = feat.traits.map((x) => x.toLowerCase())
  if (t.includes('general')) return t.includes('skill') ? 'Skill Feat' : 'General Feat'
  if (t.includes('skill')) return 'Skill Feat'
  if (c.ancestry && t.includes(c.ancestry.toLowerCase())) return 'Ancestry Feat'
  if (c.className && t.includes(c.className.toLowerCase())) return 'Class Feat'
  if (t.includes('archetype')) return 'Archetype Feat'
  return 'Feat'
}
