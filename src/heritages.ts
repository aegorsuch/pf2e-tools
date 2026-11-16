import { featTakenLevel } from './featChoices'
import type { Character, ContentEntry } from './types'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// PF2e's index omits parent ancestry. Exceptional names are verified against AoN ancestry heritage listings.
const HERITAGE_PARENTS = new Map(Object.entries({
  Human: ['Half-Elf', 'Half-Orc'],
  Conrasu: ['Rite of Light', 'Rite of Passage', 'Rite of Reinforcement', 'Rite of Invocation', 'Rite of Knowing'],
  Ghoran: ['Ancient Ash', 'Enchanting Lily', 'Strong Oak', 'Thorned Rose'],
  Kashrishi: ['Athamasi', 'Lethoci', 'Nascent', 'Trogloshi', 'Xyloshi'],
  'Awakened Animal': ['Climbing Animal', 'Flying Animal', 'Running Animal', 'Swimming Animal'],
  Ratfolk: ['Deep Rat', 'Desert Rat', 'Longsnout Rat', 'Sewer Rat', 'Shadow Rat', 'Snow Rat', 'Tunnel Rat'],
  Wayang: ['Shadow of the Courtier', 'Shadow of the Hermit', 'Shadow of the Sailor', 'Shadow of the Smith', 'Shadow of the Wanderer'],
  Yaksha: ['Deny the Firstborn Pursuit', "Deny Lady Nanbyo's Charity", "Deny the Traitor's Rebirth",
    'Respite of Cloudless Paths', 'Respite of Loam and Leaf', 'Respite of a Thousand Roofs'],
  Yaoguai: ['Born of Animal', 'Born of Celestial', 'Born of Elements', 'Born of Item', 'Born of Vegetation'],
  Dragonet: ['Homing Drake', 'House Drake'],
  Sprite: ['Dijiang'],
}).flatMap(([ancestry, names]) => names.map(name => [slug(name), slug(ancestry)] as const)))

const VERSATILE_HERITAGES = new Set([
  'Aasimar', 'Aphorite', 'Ganzi', 'Tiefling', 'Ifrit', 'Oread', 'Suli', 'Sylph', 'Undine', 'Ardande', 'Talos',
  'Changeling', 'Nephilim', 'Aiuvarin', 'Dromaar', 'Dhampir', 'Dragonblood', 'Duskwalker', 'Hungerseed',
  'Reflection', 'Fadrim', 'Beastkin', 'Cyborg', 'Borai', 'Corpsefolk', 'Gap-touched', 'Prismeni', 'Xenometric Android',
].map(slug))

export const isVersatileHeritage = (entry: ContentEntry) => VERSATILE_HERITAGES.has(slug(entry.name))
  || entry.data.versatile === true || entry.traits.some(trait => slug(trait) === 'versatile')

export function heritagesFor(entries: ContentEntry[], ancestry?: string) {
  const all = entries.filter((e) => e.kind === 'heritage' && !e.deleted)
  if (!ancestry) return all
  const target = slug(ancestry)
  const names = new Set([target, ...entries.filter((e) => e.kind === 'ancestry' && !e.deleted).map((e) => slug(e.name))])
  return all.filter((e) => {
    if (isVersatileHeritage(e)) return true
    const linked = e.data.ancestry ? slug(String(e.data.ancestry)) : ''
    if (linked) return linked === target
    const name = slug(e.name)
    const tagged = e.traits.map(slug).filter((t) => names.has(t))
    if (tagged.length) return tagged.includes(target)
    const parent = HERITAGE_PARENTS.get(name)
    if (parent) return parent === target
    const named = [...names].filter(ancestry => name.endsWith(`-${ancestry}`))
    if (named.length) return named.includes(target)
    return e.source === 'homebrew'
  })
}

export function elfAtavismOptions(c: Character, entries: ContentEntry[]) {
  return heritagesFor(entries, 'Elf')
    .filter(entry => !isVersatileHeritage(entry) && entry.systems.some(system => c.systems.includes(system)))
}

export function characterHeritages(c: Character, entries: ContentEntry[]) {
  const primary = entries.find(entry => entry.kind === 'heritage' && entry.name === c.heritage && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system)))
  const choices = new Set(c.feats.filter(feat => ['Elf Atavism', 'Elven Atavism'].includes(feat.name)
    && featTakenLevel(feat) <= c.level).map(feat => feat.choice))
  return [...(primary ? [primary] : []),
    ...elfAtavismOptions(c, entries).filter(entry => choices.has(entry.name) && entry.name !== primary?.name)]
}
