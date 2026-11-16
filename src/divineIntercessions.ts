import type { Character } from './types'

export type Intercession = {
  id: string
  tier: 'Minor' | 'Moderate' | 'Major'
  kind: 'Boon' | 'Curse'
  description: string
}

type DeityIntercessions = {
  source: string
  items?: Intercession[]
  unavailable?: string
}

const intercession = (id: string, tier: Intercession['tier'], kind: Intercession['kind'], description: string): Intercession =>
  ({ id, tier, kind, description })

export const DIVINE_INTERCESSIONS: Record<string, DeityIntercessions> = {
  Abadar: {
    source: 'https://2e.aonprd.com/Deities.aspx?ID=277',
    items: [
      intercession('minor-boon', 'Minor', 'Boon', 'Once, a creature’s successful Deception check to maliciously lie to you alone becomes a critical failure.'),
      intercession('moderate-boon', 'Moderate', 'Boon', 'On Earn Income, a critical failure becomes a failure and a success earns twice the usual income.'),
      intercession('major-boon', 'Major', 'Boon', 'Once per day, when a possible agreement exists, you can offer a divinely inspired deal and treat your Diplomacy result as 20 plus your modifier. This does not automatically improve the degree of success.'),
      intercession('minor-curse', 'Minor', 'Curse', 'When you commit a crime such as theft, illegal harm, or undermining a law-abiding court, a visible mark describing it appears on your skin and remains until you make legal restitution.'),
      intercession('moderate-curse', 'Moderate', 'Curse', 'Your Earn Income check result is always one degree of success worse.'),
      intercession('major-curse', 'Major', 'Curse', 'You are constantly affected by ring of truth and always suffer its failure effect when you lie.'),
    ],
  },
  Asmodeus: {
    source: 'https://2e.aonprd.com/Deities.aspx?ID=278',
    items: [
      intercession('minor-boon', 'Minor', 'Boon', 'Once, after failing a significant Request, you can cast suggestion on its target to suggest the same course of action.'),
      intercession('moderate-boon', 'Moderate', 'Boon', 'You gain darkvision and fire resistance 5. These benefits are automatically reflected in the character’s senses and resistance summaries while this boon is checked.'),
      intercession('major-boon', 'Major', 'Boon', 'A creature that freely enters a bargain with you cannot voluntarily break its side while you uphold yours, unless an outside force intervenes.'),
      intercession('minor-curse', 'Minor', 'Curse', 'You gain fire weakness 5. This is automatically reflected in the Defense summary while this curse is checked.'),
      intercession('moderate-curse', 'Moderate', 'Curse', 'You cannot voluntarily back out of an agreement, contract, or your word; you need follow only its letter, not its spirit.'),
      intercession('major-curse', 'Major', 'Curse', 'You become permanently drained 4, removable only by another intercession. While checked, the character’s maximum HP is reduced by 4 × level and Fortitude is reduced by 4. Disruptive acts also make you sickened 1; track that separately.'),
    ],
  },
  Calistria: {
    source: 'https://2e.aonprd.com/Deities.aspx?ID=279',
    items: [
      intercession('minor-boon', 'Minor', 'Boon', 'Once, a failed check to Lie becomes a critical success. This is typically for an extremely consequential lie.'),
      intercession('moderate-boon', 'Moderate', 'Boon', 'A foot-long wasp befriends you as a familiar; it always has the burrower and flier abilities while you retain Calistria’s grace.'),
      intercession('major-boon', 'Major', 'Boon', 'You always know the direction and distance to the nearest creature that has wronged you and remains unpunished.'),
      intercession('minor-curse', 'Minor', 'Curse', 'When someone new seeks vengeance against you, you suffer a painful sting and giant wasp venom at stage 1.'),
      intercession('moderate-curse', 'Moderate', 'Curse', 'Whenever you Make an Impression, the result is one degree of success worse. Even without trying, a long conversation can insult someone and impose the critical-failure effect.'),
      intercession('major-curse', 'Major', 'Curse', 'When someone unable to pursue vengeance against you imagines revenge, a creature roughly your level manifests to carry it out, then vanishes when the revenge is complete or it is destroyed.'),
    ],
  },
  Erastil: {
    source: 'https://2e.aonprd.com/Deities.aspx?ID=282',
    items: [
      intercession('minor-boon', 'Minor', 'Boon', 'A critical failure to Subsist in the wild becomes a failure.'),
      intercession('moderate-boon', 'Moderate', 'Boon', 'You ignore a longbow’s volley trait and double its normal range increment.'),
      intercession('major-boon', 'Major', 'Boon', 'You can cast speak with plants as a divine innate spell, need no food or drink in a healthy natural environment, and can perform commune with nature without secondary casters or checks.'),
      intercession('minor-curse', 'Minor', 'Curse', 'Food you did not grow, gather, or harvest tastes like ash and leaves you fatigued.'),
      intercession('moderate-curse', 'Moderate', 'Curse', 'Animals’ attitudes toward you are one category worse.'),
      intercession('major-curse', 'Major', 'Curse', 'You cannot acquire food on your own: your attempts always fail, forcing you to rely on others and make very hard checks to request or receive food.'),
    ],
  },
  Gorum: {
    source: 'https://2e.aonprd.com/Deities.aspx?ID=283',
    items: [
      intercession('minor-boon', 'Minor', 'Boon', 'You can Interact to draw a temporary, non-magical iron weapon when you have none; it lasts only while you use it to attack and cannot be given away or sold.'),
      intercession('moderate-boon', 'Moderate', 'Boon', 'Your greatsword Strikes gain the forceful trait.'),
      intercession('major-boon', 'Major', 'Boon', 'When reduced to 0 HP, you are instead restored to half your maximum HP and become doomed 1 (or increase doomed by 1).'),
      intercession('minor-curse', 'Minor', 'Curse', 'Armor and shields you wear or wield have their AC item bonus reduced by 2 (minimum 0), and their Hardness, HP, and Break Threshold are halved.'),
      intercession('moderate-curse', 'Moderate', 'Curse', 'Your weapon and unarmed attacks deal damage with one smaller die, and all your attacks are nonlethal.'),
      intercession('major-curse', 'Major', 'Curse', 'When combat begins, you become fatigued and slowed 1. At the end of each of your turns, slowed increases by 1. These conditions end only when combat ends.'),
    ],
  },
  Iomedae: {
    source: 'https://2e.aonprd.com/Deities.aspx?ID=285',
    items: [
      intercession('minor-boon', 'Minor', 'Boon', 'Your clothing and person stay clean and unrumpled, and your blade and armor remain clean and unblemished. This has no automated mechanical effect.'),
      intercession('moderate-boon', 'Moderate', 'Boon', 'Once, Iomedae removes your current negative effects (except those from similarly powerful sources), restores all HP, and replenishes spells, Focus Points, and other daily resources.'),
      intercession('major-boon', 'Major', 'Boon', 'Longswords you wield gain axiomatic, holy, and major striking runes while held, subject to rune limits; you also gain a +2 status bonus to longsword attack rolls. These conditional rune and attack effects are tracked manually.'),
      intercession('minor-curse', 'Minor', 'Curse', 'Your weapons, armor, and shields have half their usual HP and Break Threshold.'),
      intercession('moderate-curse', 'Moderate', 'Curse', 'You cannot receive circumstance bonuses to your attack rolls, and enemies do not take circumstance penalties to AC against your attacks.'),
      intercession('major-curse', 'Major', 'Curse', 'Any weapon you wield becomes broken after you Strike with it; this cannot break artifacts or similarly powerful weapons.'),
    ],
  },
  Torag: {
    source: 'https://2e.aonprd.com/Deities.aspx?ID=294',
    items: [
      intercession('minor-boon', 'Minor', 'Boon', 'Once, an item you hold or wear regains all HP and has double Hardness for 1 minute; this can prevent its destruction.'),
      intercession('moderate-boon', 'Moderate', 'Boon', 'You gain the effects of a dwarf ancestry feat chosen by Torag, even if you are not a dwarf, while the blessing lasts. The GM must choose and apply the feat manually.'),
      intercession('major-boon', 'Major', 'Boon', 'Standing watch for at least 6 hours counts as rest and lets you recover Focus Points; you gain +4 status to Perception to notice approaching dangers while on guard. With a shield, you can Defend during exploration without slowing down, combine it with another exploration activity, and gain +5 shield Hardness.'),
      intercession('minor-curse', 'Minor', 'Curse', 'Whenever an item you are using takes damage, it becomes broken.'),
      intercession('moderate-curse', 'Moderate', 'Curse', 'You gain item bonuses only from items you made yourself.'),
      intercession('major-curse', 'Major', 'Curse', 'Your community’s attitudes toward you shift two steps worse, often seeking to exile you permanently.'),
    ],
  },
  'Green Faith': {
    source: 'https://2e.aonprd.com/Deities.aspx?ID=298',
    unavailable: 'No Green Faith-specific divine intercessions were found in the published rules; none have been invented here.',
  },
  'Lao Shu Po': {
    source: 'https://2e.aonprd.com/Deities.aspx?ID=312',
    unavailable: 'The current Archives of Nethys entry has no deity-specific divine intercessions for Lao Shu Po (Grandmother Rat). No effects have been invented here.',
  },
}

export function hasDivineIntercession(c: Character, deity: string, id: string) {
  return c.deity === deity && (c.divineIntercessions?.[deity] ?? []).includes(id)
}

export function activeDivineIntercessions(c: Character, deity: string) {
  return (c.divineIntercessions?.[deity] ?? [])
}

export function divineIntercessionWeaknesses(c: Character) {
  return hasDivineIntercession(c, 'Asmodeus', 'minor-curse')
    ? [{ damage: 'Fire', value: 5, source: 'Asmodeus (Minor Curse)' }]
    : []
}
