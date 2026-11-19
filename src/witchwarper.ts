import type { Character, ContentEntry } from './types'
import { spellAccessGranted } from './featAccess'

export type WitchwarperParadoxName = 'Analyst' | 'Anomaly' | 'Gap Influenced' | 'Precog'
export const WITCHWARPER_KEY_ATTRIBUTES = ['int', 'cha'] as const
export const WITCHWARPER_ANCHORS = [
  { name: 'Core Memories', description: 'During daily preparations, choose a trained skill to gain Assurance. If expert in a Recall Knowledge skill, also gain Automatic Knowledge. Once per round when Sustaining your field, reduce stupefied by 1.' },
  { name: 'Focal Point', description: 'When a reaction would disrupt your spellcasting, a successful DC 15 flat check prevents disruption. Once per round when Sustaining your field, reduce clumsy by 1 and ignore suppressed until your next turn.' },
  { name: 'Tangible Object', description: '+1 circumstance to Perception and Will against illusions and holograms. Once per round when Sustaining your field, reduce frightened by 1; if not frightened, gain +1 circumstance to Will saves against fear and +2 circumstance to Will DC against Demoralize until your next turn.' },
] as const

export interface WitchwarperParadox {
  name: WitchwarperParadoxName
  skill: string
  tradition: 'Arcane' | 'Occult'
  spells: readonly string[]
  initialWarpSpell: string
  quantumField: string
  sourceUrl: string
}

export const WITCHWARPER_PARADOXES: readonly WitchwarperParadox[] = [
  {
    name: 'Analyst',
    skill: 'Computers',
    tradition: 'Arcane',
    spells: ['Analyze Target', 'Sure Strike', 'Sift the Sphere', 'Hypercognition', 'Translocate',
      'Subjective Reality', 'Truesight', 'Retrocognition', 'Disappearance', 'Foresight'],
    initialWarpSpell: 'Warp Probability',
    quantumField: 'When you Seek or Recall Knowledge, you can apply the result against two related targets in your quantum field. When you Sustain the field, you can Seek or Recall Knowledge against a target in it as a free action.',
    sourceUrl: 'https://2e.aonsrd.com/classes/6-witchwarper/paradoxes/1-analyst',
  },
  {
    name: 'Anomaly',
    skill: 'Deception',
    tradition: 'Arcane',
    spells: ['Stumble', 'Shifting Surge', 'Dispel Magic', 'Void Whispers', 'Eldritch Wrath', 'Wall of Stone',
      'Slice Reality', 'Death Sentence', 'Void Vessel', 'Call Cosmos'],
    initialWarpSpell: 'Warp Terrain',
    quantumField: 'When an enemy in your quantum field attempts an action with the concentrate trait, the action is disrupted unless it succeeds at a DC 5 flat check; after its first failure, it is temporarily immune for 24 hours.',
    sourceUrl: 'https://2e.aonsrd.com/classes/6-witchwarper/paradoxes/2-anomaly',
  },
  {
    name: 'Gap Influenced',
    skill: 'Society',
    tradition: 'Occult',
    spells: ['Daze', 'Delete', 'Instant Virus', 'Entropy Strike', 'Confusion', 'Synaptic Pulse', 'Repulsion',
      'Warp Mind', 'Disappearance', 'Phantasmagoria'],
    initialWarpSpell: 'Warp Presence',
    quantumField: 'You are concealed to creatures within your quantum field. When a creature in the field hits you with an attack, you lose this benefit against that creature until the start of your next turn.',
    sourceUrl: 'https://2e.aonsrd.com/classes/6-witchwarper/paradoxes/3-gap-influenced',
  },
  {
    name: 'Precog',
    skill: 'Piloting',
    tradition: 'Occult',
    spells: ['Injury Echo', 'Fleet Step', 'Temporal Bullets', "Time's Edge", 'Weight of Ages', 'Chrono Push',
      'Phantasmal Calamity', 'True Target', 'Moment of Renewal', 'Foresight'],
    initialWarpSpell: 'Warp Time',
    quantumField: 'An enemy using a move action inside your quantum field takes a -5-foot status penalty to Speed during that action. You and your allies gain a +5-foot status bonus to Speed during move actions used inside the field.',
    sourceUrl: 'https://2e.aonsrd.com/classes/6-witchwarper/paradoxes/4-precog',
  },
]

const paradoxByName = new Map<string, WitchwarperParadox>(WITCHWARPER_PARADOXES.map(paradox => [paradox.name, paradox]))
const isWitchwarper = (c: Character) => c.systems.includes('sf2e') && c.className === 'Witchwarper' && c.level >= 1

export function witchwarperParadox(c: Character): WitchwarperParadox | undefined {
  if (!isWitchwarper(c)) return undefined
  return paradoxByName.get(c.subclass ?? '')
}

export function witchwarperSpellcasting(c: Character) {
  if (!isWitchwarper(c)) return undefined
  const paradox = witchwarperParadox(c)
  const ability = c.boosts?.class
  const proficiencyRank = c.level >= 19 ? 4 : c.level >= 15 ? 3 : c.level >= 7 ? 2 : 1
  return {
    traditions: paradox ? [paradox.tradition] : [],
    ability: ability === 'int' || ability === 'cha' ? ability : undefined,
    rank: proficiencyRank,
  }
}

export function witchwarperSpellSlots(c: Character): Record<number, number> | undefined {
  if (!isWitchwarper(c)) return undefined
  const slots: Record<number, number> = { 0: 5 }
  const highestRank = Math.min(9, Math.ceil(c.level / 2))
  for (let rank = 1; rank <= highestRank; rank++)
    slots[rank] = c.level === rank * 2 - 1 ? 3 : 4
  if (c.level >= 19) slots[10] = 1 + Number(c.level >= 20
    && c.feats.some(feat => feat.name === 'Quantum Research' && (feat.takenLevel ?? feat.level) <= c.level))
  return slots
}

export function witchwarperRepertoireSlots(c: Character, extraCantrip = false) {
  const paradox = witchwarperParadox(c)
  const slots = witchwarperSpellSlots(c)
  if (!paradox || !slots) return []
  return Object.entries(slots).flatMap(([key, count]) => {
    const rank = Number(key)
    return Array.from({ length: rank === 10 ? 2 : count }, (_, index) => ({
      key: `${rank}:${index}`, rank,
      granted: index === 0 && rank < 10 ? paradox.spells[rank] : undefined,
      value: c.spellcasting?.repertoire?.[`${rank}:${index}`] ?? '',
    }))
  }).concat(extraCantrip ? [{
    key: 'familiar-cantrip-connection', rank: 0, granted: undefined,
    value: c.spellcasting?.repertoire?.['familiar-cantrip-connection'] ?? '',
  }] : [])
}

export function witchwarperSpellOptions(c: Character, entries: ContentEntry[], rank: number) {
  const paradox = witchwarperParadox(c)
  if (!paradox) return []
  return entries.filter(entry => entry.kind === 'spell' && !entry.deleted && entry.systems.some(system => c.systems.includes(system))
    && !entry.traits.some(trait => /^focus$/i.test(trait))
    && (rank === 0 ? entry.traits.some(trait => /^cantrip$/i.test(trait))
      : !entry.traits.some(trait => /^cantrip$/i.test(trait)) && entry.level <= rank)
    && String(entry.data.tradition ?? '').toLowerCase().split(/,\s*/).includes(paradox.tradition.toLowerCase())
    && spellAccessGranted(c, entry))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

export function witchwarperSetup(c: Character) {
  const paradox = witchwarperParadox(c)
  if (!paradox) return undefined
  return {
    paradox,
    keyAttribute: (c.boosts?.class === 'int' || c.boosts?.class === 'cha') ? c.boosts.class : undefined,
    focusPoints: 1,
    initialWarpSpell: paradox.initialWarpSpell,
    quantumField: {
      shape: 'burst' as const,
      radiusFeet: c.level >= 19 ? 100 : 20,
      effect: paradox.quantumField,
    },
  }
}
