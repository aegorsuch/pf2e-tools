import type { Character } from './types'

export const MAGIC_WARRIOR_MASK_FEATS = [
  'Cunning Trickster Mask',
  "Emancipator's Mask",
  "Grand Medic's Mask",
  'Protective Spirit Mask',
  'Sky Master Mask',
  'Stalking Feline Mask',
  "Storyteller's Mask",
  'Thick Hide Mask',
  "Tireless Guide's Mask",
  'Vigilant Mask',
] as const

export const SHADOWED_SCALE_MASK = 'Shadowed Scale, the Jungle Secret'

const magicWarriorMaskFeats = new Set<string>(MAGIC_WARRIOR_MASK_FEATS)

export function hasMagicWarriorMask(c: Pick<Character, 'systems' | 'feats' | 'level'>) {
  return c.systems.includes('pf2e') && c.feats.some(feat =>
    magicWarriorMaskFeats.has(feat.name) && (feat.takenLevel ?? feat.level) <= c.level)
}
