import type { Character, ContentEntry } from './types'
import { featTakenLevel } from './builder'
import { companionAdvancement, companionStats } from './companions'

type CompanionShape = { attacks: { name: string; traits: string }[]; size: string; speed: string }

type BeastmasterFeat = {
  requirement: string
  qualifies: (companion: CompanionShape) => boolean
}

const hasAttack = (pattern: RegExp) => (companion: CompanionShape) => companion.attacks.some(attack => pattern.test(attack.name))
const LARGE = ['Large', 'Huge', 'Gargantuan']

export const BEASTMASTER_FEATS: Record<string, BeastmasterFeat> = {
  'Billowing Wings': { requirement: 'animal companion with wings',
    qualifies: companion => /\bfly\b/i.test(companion.speed) || hasAttack(/\bwing/i)(companion) },
  'Bestial Protection': { requirement: "animal companion that's Large or larger", qualifies: companion => LARGE.includes(companion.size) },
  'Ferocious Charge': { requirement: 'animal companion with an antlers, head, or horn unarmed attack',
    qualifies: hasAttack(/\b(?:antlers?|head|horns?)\b/i) },
  "Nature's Precision": { requirement: 'animal companion with an agile or finesse unarmed attack',
    qualifies: companion => companion.attacks.some(attack => /\b(?:agile|finesse)\b/i.test(attack.traits)) },
  'Running Kick': { requirement: 'animal companion with a foot, hoof, or talon unarmed attack', qualifies: hasAttack(/\b(?:foot|feet|hoof|hooves|talons?)\b/i) },
  'Sinking Jaws': { requirement: 'animal companion with a jaws or fangs unarmed attack', qualifies: hasAttack(/\b(?:jaws?|fangs?)\b/i) },
  'Sweeping Tail': { requirement: 'animal companion with a tail unarmed attack', qualifies: hasAttack(/\btail\b/i) },
  'Vicious Rend': { requirement: 'animal companion with a claw, fist, pincer, or talon unarmed attack',
    qualifies: hasAttack(/\b(?:claws?|fists?|pincers?|talons?)\b/i) },
}

const shape = (stats: NonNullable<ReturnType<typeof companionStats>>): CompanionShape => ({
  attacks: stats.attacks, size: stats.naturalSize, speed: stats.speed,
})

export const companionQualifiesForFeat = (companion: CompanionShape, featName: string) =>
  BEASTMASTER_FEATS[featName]?.qualifies(companion) ?? true

// Whether any of the character's animal companions meets a Beastmaster feat's companion prerequisite
export function beastmasterRequirementMissing(c: Character, entries: ContentEntry[], featName: string) {
  const feat = BEASTMASTER_FEATS[featName]
  if (!feat) return undefined
  const advancement = companionAdvancement(c)
  const met = (c.companions ?? []).some((companion, index) => {
    const stats = companionStats(c, entries, companion.type, index === 0 ? advancement : undefined, companion.id)
    return !!stats && feat.qualifies(shape(stats))
  })
  return met ? undefined : feat.requirement
}

export type BeastmasterManeuver = { name: string; actions: string; traits?: string; requirements?: string; description: string }

// Activities and passive abilities the companion gains from Beastmaster feats it qualifies for
export function beastmasterAbilities(c: Character, level: number, strength: number, specialized: boolean, companion: CompanionShape) {
  const owned = (name: string) => c.feats.some(feat => feat.name === name && featTakenLevel(feat) <= c.level)
  const has = (name: string) => owned(name) && companionQualifiesForFeat(companion, name)
  const maneuvers: BeastmasterManeuver[] = []
  if (has('Sinking Jaws')) maneuvers.push({ name: 'Sinking Jaws', actions: 'Single Action',
    requirements: 'This companion has a creature grabbed or restrained with its jaws or fangs',
    description: `This companion's grabbed or restrained foe takes ${level + strength} piercing damage (the companion's level plus its Strength modifier).` })
  if (has('Sweeping Tail')) maneuvers.push({ name: 'Sweeping Tail', actions: 'Two Actions',
    description: 'This companion makes two tail Strikes against different creatures within its reach, increasing its multiple attack penalty as normal. On a hit, it pushes a target back 5 feet or 10 feet on a critical hit. This is forced movement.' })
  if (has('Running Kick')) maneuvers.push({ name: 'Running Kick', actions: 'Two Actions',
    description: "This companion Strides up to twice its Speed and makes a hoof, foot, or talon Strike at any point during the movement. This movement doesn't provoke reactions from a creature damaged by the Strike." })
  if (has('Vicious Rend')) maneuvers.push({ name: 'Vicious Rend', actions: 'Two Actions',
    description: `Make two claw, fist, pincer, or talon Strikes against the same target, applying the multiple attack penalty as normal. If both Strikes hit, the target takes an additional ${specialized ? '2d6' : '1d6'} persistent bleed damage.` })
  if (has('Ferocious Charge')) maneuvers.push({ name: 'Ferocious Charge', actions: 'Two Actions',
    description: `The companion Strides up to twice its Speed in a straight line and makes an antlers, head, or horn Strike. If it moved at least 20 feet, it deals an additional ${specialized ? '2d8' : '1d8'} damage. The companion can use Ferocious Charge while Burrowing, Climbing, Flying, or Swimming instead of Striding if it has the corresponding movement type.` })
  const special: { name: string; note: string }[] = []
  if (has("Nature's Precision")) special.push({ name: "Nature's Precision", note:
    `When the companion strikes an off-guard creature with an agile or finesse unarmed attack, it deals an additional ${specialized ? '2d4' : '1d4'} precision damage. If it already deals precision damage, combine the precision damage.` })
  if (has('Bestial Protection')) special.push({ name: 'Bestial Protection', note:
    "When a creature adjacent to the companion that's smaller than it targets you with an attack, that creature becomes frightened 1." })
  if (owned('Pack Movement')) special.push({ name: 'Pack Movement', note:
    'Two Actions (flourish): you and your companion both Stride (or Burrow, Climb, Fly, or Swim if you both have that Speed). If you both end within reach of the same creature, each of you makes a melee Strike against it.' })
  if (owned('Heightened Instincts')) special.push({ name: 'Heightened Instincts', note:
    'When a companion succeeds at a saving throw, it gets a critical success instead.' })
  if ((c.companions?.length ?? 0) > 1) special.push({ name: 'Call Companion', note:
    'Exploration, 1 minute: switch your active companion for another of your animal companions.' })
  if (owned('Tenacious Endurance')) special.push({ name: 'Tenacious Endurance', note:
    "When the companion is reduced to 0 Hit Points and isn't wounded, it can remain standing with 1 Hit Point and become wounded 1." })
  return { maneuvers, special, gust: has('Billowing Wings') }
}
