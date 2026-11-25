import type { Character } from './types'

export type Apparition = { id: string; name: string; skills: string[]; spells: { name: string; rank: number }[]; vessel?: string; url: string }
type Hit = { _id: string; _source: { name: string; markdown?: string; text?: string } }

const ORDINAL = /^(cantrip|\d+)/i

export function normalizeApparitions(hits: Hit[]): Apparition[] {
  return hits.flatMap(({ _id, _source }) => {
    const text = _source.markdown ?? _source.text ?? ''
    const skills = /\*\*Apparition Skills\*\*\s*([^\n]+)/.exec(text)?.[1].split(',').map(skill => skill.trim()).filter(Boolean) ?? []
    const spells = [...text.matchAll(/^- \*\*([^*]+)\*\*\s*\[([^\]]+)\]/gm)].flatMap(match => {
      const rank = ORDINAL.exec(match[1].trim())
      return rank ? [{ name: match[2], rank: /^cantrip/i.test(rank[1]) ? 0 : Number(rank[1]) }] : []
    })
    const vessel = /\*\*Vessel Spell\*\*\s*\[([^\]]+)\]/.exec(text)?.[1]
    const id = /Apparitions\.aspx\?ID=(\d+)/.exec(text)?.[1] ?? _id
    return skills.length || spells.length ? [{ id, name: _source.name, skills, spells, vessel, url: `/Apparitions.aspx?ID=${id}` }] : []
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export function apparitionLimit(c: Pick<Character, 'level'>) {
  return c.level >= 15 ? 4 : c.level >= 7 ? 3 : 2
}

export function attunedApparitions(c: Pick<Character, 'className' | 'systems' | 'attunedApparitions' | 'level'>) {
  if (c.className !== 'Animist' || !c.systems.includes('pf2e')) return []
  return (c.attunedApparitions ?? []).slice(0, apparitionLimit(c))
}

export function primaryApparition(c: Pick<Character, 'className' | 'systems' | 'attunedApparitions' | 'primaryApparition' | 'level'>) {
  const attuned = attunedApparitions(c)
  return attuned.find(apparition => apparition.id === c.primaryApparition) ?? attuned[0]
}
