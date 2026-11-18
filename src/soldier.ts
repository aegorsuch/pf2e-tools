import type { Character } from './types'

export const ERUDITE_LORE_KEY = 'Soldier:Erudite Warrior:lore'

export const SOLDIER_STYLES = [
  { name: 'Action Hero', skill: '', slug: '1-action-hero',
    description: 'Successful ranged Strikes with automatic weapons suppress until your next turn. Auto-Fire uses the full range increment, and you can choose any primary target in its cone.' },
  { name: 'Armor Storm', skill: '', slug: '2-armor-storm',
    description: 'Exclude yourself from your ranged weapon areas. Resist attacks by suppressed creatures for half your level (minimum 1). Disarm, Grapple, Reposition, Shove, and Trip need no free hand, gain +1 status against suppressed foes, and suppress on success.' },
  { name: 'Bombard', skill: '', slug: '3-bombard',
    description: 'Exclude allies equal to half your Constitution modifier from area weapon attacks. Enemies succeeding, but not critically succeeding, on saves against your area attacks are also suppressed.' },
  { name: 'Close Quarters', skill: '', slug: '4-close-quarters',
    description: 'For soldier feats, wielded two-handed melee weapons qualify as area weapons with a 5-foot burst centered on a corner of your space; you are unaffected. Primary Target and soldier feats can use a two-handed melee Strike. Grants Whirling Swipe.' },
  { name: 'Erudite Warrior (Diplomacy)', skill: 'Diplomacy', slug: '5-erudite-warrior',
    description: 'Trained in Diplomacy and one chosen Lore. Both become expert at level 7, master at 13, and legendary at 17. Oppressive Presence suppresses one enemy within 60 feet until your next turn; the effect ends if it targets you with a Strike or another offensive action.' },
  { name: 'Erudite Warrior (Society)', skill: 'Society', slug: '5-erudite-warrior',
    description: 'Trained in Society and one chosen Lore. Both become expert at level 7, master at 13, and legendary at 17. Oppressive Presence suppresses one enemy within 60 feet until your next turn; the effect ends if it targets you with a Strike or another offensive action.' },
]

export const isSoldier = (c: Character) => c.systems.includes('sf2e') && c.className === 'Soldier' && c.level >= 1

export function soldierStyle(c: Character) {
  return isSoldier(c) ? SOLDIER_STYLES.find(style => style.name === c.subclass) : undefined
}

export function eruditeWarrior(c: Character) {
  const style = soldierStyle(c)
  if (!style?.skill) return undefined
  const lore = c.subclassSkillChoices?.[ERUDITE_LORE_KEY]?.trim()
  return { skill: style.skill, lore: lore && /^.+\s+lore$/i.test(lore) ? lore : undefined,
    rank: c.level >= 17 ? 4 : c.level >= 13 ? 3 : c.level >= 7 ? 2 : 1 }
}
