import type { Character, SpellGrant } from './types'
import { featTakenLevel } from './featChoices'

export const GODCLAW_DOMAINS = ['Duty', 'Might', 'Perfection', 'Protection']
export const HELLKNIGHT_TRADITIONS = ['Arcane', 'Divine', 'Occult', 'Primal']
export const PYRE_ENERGY_TYPES = ['acid', 'cold', 'electricity', 'fire', 'sonic'] as const

export const HELLKNIGHT_FAVORED_WEAPONS: Record<string, string[]> = {
  'Order of the Chain': ['Flail', 'Spiked Chain'],
  'Order of the Gate': ['Dagger'],
  'Order of the Godclaw': ['Morningstar'],
  'Order of the Nail': ['Halberd', 'Lance'],
  'Order of the Pyre': ['Glaive'],
  'Order of the Rack': ['Longsword', 'Whip'],
  'Order of the Scourge': ['Mace', 'Whip', 'Scourge'],
  'Order of the Torrent': ['Halberd', 'Longbow'],
  'Order of the Pike': ['Longspear'],
}

export const ORDER_TRAINING_FEATS = ['Order Training', 'Advanced Order Training', 'Order Cross-Training']
type OrderBenefit = { name: string; description: string; actions?: string }
const ORDER_BENEFITS: Record<string, OrderBenefit> = {
  'Order of the Chain': {
    name: 'Shackles of Law',
    actions: 'Two Actions',
    description: 'Two actions (flourish): make a melee Strike, then attempt to Grapple if it hits and deals damage. Apply your current multiple attack penalty to both attacks before increasing it. With a flail or spiked chain, no free hand is required and a successful Grapple becomes a critical success.',
  },
  'Order of the Gate': {
    name: 'Locate Lawbreakers',
    description: 'Gain Locate as an innate spell once per day, using your chosen tradition.',
  },
  'Order of the Godclaw': {
    name: 'Dedication to the Five',
    description: 'Gain Domain Initiate for Duty, Might, Perfection, or Protection. Casting its domain spell grants temporary HP equal to twice its rank for 1 round. Religious symbols of Abadar, Asmodeus, Iomedae, Irori, or Uirch can serve as your divine focus.',
  },
  'Order of the Nail': {
    name: 'Trailblazing Stride',
    description: 'Ignore land-based difficult terrain from plants, fungi, and uneven ground. Successfully Recalling Knowledge about an animal, beast, fungus, or plant grants +10 feet to your Speeds until your turn ends (circumstance).',
  },
  'Order of the Pyre': {
    name: 'Righteous Resistance',
    description: 'Gain Resist Energy as a divine innate spell twice per day, targeting yourself only. When choosing fire resistance, use your level if it exceeds the resistance normally granted by the spell.',
  },
  'Order of the Rack': {
    name: 'Disillusionment',
    description: 'For saves against dreams or illusions and Perception checks to disbelieve illusions, upgrade a success to a critical success and a critical failure to a failure.',
  },
  'Order of the Scourge': {
    name: 'Fear No Law, Fear No One',
    actions: 'One Action',
    description: 'One action: Strike a creature. On a damaging hit, allies who can see you within 20 feet reduce frightened by 1, or by 2 if your target caused their fear.',
  },
  'Order of the Torrent': {
    name: 'Free the Bound',
    actions: 'Reaction',
    description: 'React when an ally within your reach is about to Escape. They gain +1 circumstance to that check and, unless they critically fail, can react to Strike a reachable enemy. Increase their multiple attack penalty only after both attacks.',
  },
  'Order of the Pike': {
    name: 'Bestiary Secrets',
    description: 'Successfully Tracking a monster reveals your choice of its highest weakness, highest resistance, immunities, or lowest save. Choose again if that information does not apply. When you roll initiative against that tracked monster, it is off-guard to you until your first turn ends.',
  },
}

const GREATER_ORDER_BENEFITS: Record<string, OrderBenefit> = {
  'Order of the Chain': {
    name: 'Sturdy Bindings',
    description: 'A critical failure on your Grapple check becomes a failure. When a creature you have grabbed tries to Escape, its failure becomes a critical failure and its critical success becomes a success.',
  },
  'Order of the Gate': {
    name: 'Devil Allies',
    description: 'Cast Summon Fiend once per day as a rank-6 innate spell of your chosen tradition, summoning only devils. Its rank increases by 1 at levels 14, 16, 18, and 20.',
  },
  'Order of the Godclaw': {
    name: 'Blessing of the Five',
    actions: 'Three Actions',
    description: 'Three actions, once per day: cast the three-action Heal at a rank equal to half your level, rounded up, minus 1. You can exclude up to five creatures. Alternatively, restore a creature within 30 feet that died in the last round to 1 HP and doomed 1. Both options share the same daily use.',
  },
  'Order of the Nail': {
    name: 'Reveal Beasts',
    description: 'A successful Recall Knowledge check to identify an animal, beast, fungus, or plant becomes a critical success. A critical success also makes that creature frightened 1.',
  },
  'Order of the Pyre': {
    name: 'Spiritual Disruption',
    actions: 'Two Actions',
    description: 'Two actions: make a melee Strike that counts as two attacks for your multiple attack penalty. On a hit, deal 1d6 persistent spirit damage and make the target stupefied 1 until that persistent damage ends.',
  },
  'Order of the Rack': {
    name: 'Silence Heresy',
    actions: 'Two Actions',
    description: 'Two actions: make a melee Strike. On a hit, the target can only whisper for 1 round, cannot use most voice-based auditory effects, and must pass a DC 5 flat check to Cast a Spell. On a critical hit, it cannot speak for 1 round and can only whisper for 1 minute afterward. It is then immune to this ability for 1 minute.',
  },
  'Order of the Scourge': {
    name: 'Seek Injustice',
    actions: 'Three Actions',
    description: 'Three actions, once per day: for 1 minute, see through up to 5 feet of stone, wood, or similar barriers. Metal and denser barriers still block your vision.',
  },
  'Order of the Torrent': {
    name: 'Unbound Torrent',
    description: 'Cast Unfettered Movement once per day as a divine innate spell at a rank equal to half your level, rounded up, minus 1.',
  },
  'Order of the Pike': {
    name: 'The Harder They Fall',
    actions: 'One Action',
    description: 'One action: choose a visible Huge or larger creature. Gain +1 circumstance to AC and saves against that creature for 1 round.',
  },
}

export const hellknightOrder = (c: Character) =>
  c.feats.find(feat => feat.name === 'Hellknight Dedication' && featTakenLevel(feat) <= c.level)?.choice

const crossTrainingOrder = (choice?: string) =>
  Object.keys(ORDER_BENEFITS).find(order => choice === order || choice?.startsWith(`${order}: `))

export function hellknightTrainingBenefit(c: Character, name: string, choice?: string) {
  if (!ORDER_TRAINING_FEATS.includes(name)) return undefined
  const native = hellknightOrder(c)
  if (!native) return undefined
  const order = name === 'Order Cross-Training' ? crossTrainingOrder(choice) : native
  if (!order || name === 'Order Cross-Training' && order === native) return undefined
  const benefit = (name === 'Advanced Order Training' ? GREATER_ORDER_BENEFITS : ORDER_BENEFITS)[order]
  return benefit ? { ...benefit, order,
    description: benefit.description + (name === 'Order Training' && order === 'Order of the Gate' ? ' It becomes rank 5 at level 14.' : ''),
    choice: name === 'Order Cross-Training' ? choice?.slice(order.length + 2) : choice } : undefined
}

export function hellknightTrainingBenefits(c: Character) {
  return c.feats.flatMap(feat => {
    const benefit = featTakenLevel(feat) <= c.level && hellknightTrainingBenefit(c, feat.name, feat.choice)
    return benefit ? [{ ...benefit, feat }] : []
  })
}

export const hellknightBenefitActive = (c: Character, name: string) =>
  !!c.activeFeatEffects?.includes(name) && hellknightTrainingBenefits(c).some(benefit => benefit.name === name)

export function orderTrainingChoices(c: Character, name = 'Order Training', exceptIndex = -1): string[] | undefined {
  if (name === 'Order Cross-Training') {
    if (!hellknightOrder(c)) return []
    const used = new Set([hellknightOrder(c), ...c.feats.flatMap((feat, index) =>
      feat.name === name && index !== exceptIndex ? [crossTrainingOrder(feat.choice)] : [])])
    return Object.keys(ORDER_BENEFITS).sort().filter(order => !used.has(order)).flatMap(order => {
      const choices = order === 'Order of the Gate' ? HELLKNIGHT_TRADITIONS : order === 'Order of the Godclaw' ? GODCLAW_DOMAINS : undefined
      return choices ? choices.map(choice => `${order}: ${choice}`) : [order]
    })
  }
  const order = hellknightOrder(c)
  if (name === 'Advanced Order Training') return order === 'Order of the Gate' ? HELLKNIGHT_TRADITIONS : undefined
  return order === 'Order of the Gate' ? HELLKNIGHT_TRADITIONS
    : order === 'Order of the Godclaw' ? GODCLAW_DOMAINS : undefined
}

export function hellknightTrainingSpellRules(c: Character, name: string, choice?: string): SpellGrant[] {
  const benefit = hellknightTrainingBenefit(c, name, choice)
  if (!benefit) return []
  const innate = (spell: string, rank: number, tradition: string, frequency = 'once per day', condition?: string): SpellGrant =>
    ({ kind: 'innate', spells: [spell], rank, tradition, frequency, condition })
  if (benefit.name === 'Locate Lawbreakers' && benefit.choice && HELLKNIGHT_TRADITIONS.includes(benefit.choice)) {
    return [innate('Locate', benefit.order === hellknightOrder(c) && c.level >= 14 ? 5 : 3, benefit.choice)]
  }
  if (benefit.name === 'Righteous Resistance') {
    return [innate('Resist Energy', 2, 'Divine', 'twice per day',
      `Self only. Fire resistance is at least ${c.level}.`)]
  }
  if (benefit.name === 'Devil Allies' && benefit.choice && HELLKNIGHT_TRADITIONS.includes(benefit.choice)) {
    return [innate('Summon Fiend', Math.min(10, Math.floor(c.level / 2)), benefit.choice, 'once per day', 'Devils only')]
  }
  if (benefit.name === 'Blessing of the Five') {
    return [{ ...innate('Heal', Math.max(1, Math.ceil(c.level / 2) - 1), 'Divine', 'once per day',
      'Three-action version; exclude up to five creatures. Shares its daily use with restoring a creature that died within the last round (30 feet, 1 HP, doomed 1).'),
      fixedRank: true, shared: true }]
  }
  return benefit.name === 'Unbound Torrent'
    ? [innate('Unfettered Movement', Math.max(1, Math.ceil(c.level / 2) - 1), 'Divine')] : []
}

export function hellknightSkillNotes(c: Character, skill: string) {
  return hellknightTrainingBenefits(c).filter(benefit =>
    ['Shackles of Law', 'Sturdy Bindings'].includes(benefit.name) && skill === 'Athletics'
    || benefit.name === 'Disillusionment' && ['Perception', 'Fortitude', 'Reflex', 'Will'].includes(skill)
    || benefit.name === 'Reveal Beasts' && (['Arcana', 'Nature', 'Occultism', 'Religion', 'Society'].includes(skill) || / Lore$/.test(skill))
    || benefit.name === 'Bestiary Secrets' && skill === 'Survival'
    || benefit.name === 'The Harder They Fall' && ['AC', 'Fortitude', 'Reflex', 'Will'].includes(skill))
}
