import type { ContentEntry } from './types'

export function weaponUpgradeSummary(upgrade: ContentEntry, itemBonus: number, merciful = false): string | undefined {
  const name = upgrade.name.replace(/\s*\([^)]*\)$/, '')
  const grade = /\(([^)]+)\)$/.exec(upgrade.name)?.[1]?.toLowerCase()
  const tactical = grade === 'tactical'
  switch (name) {
    case 'Acid Module':
      return `Critical hit: DC ${tactical ? 34 : 24} Fortitude or -1 status AC until your next turn ends.${tactical ? ' Acid ignores resistance.' : ''}`
    case 'Entropic Destabilizer':
      return `Critical hit: ${merciful ? 'persistent void negated by Merciful' : `${tactical ? 4 : 2}d4 persistent void, also applied to a raised shield`}. Void damage affects objects and constructs.${tactical ? ' Void ignores resistance and immunity.' : ''}`
    case 'Fear Projector':
      return `Critical hit: frightened ${tactical ? 2 : 1}.`
    case 'Flaming Module':
      return `Critical hit: ${merciful ? 'persistent fire negated by Merciful' : `${tactical ? 2 : 1}d10 persistent fire`}.${tactical ? ' Fire ignores resistance.' : ''}`
    case 'Frost Module':
      return `Critical hit: DC ${tactical ? 34 : 24} Fortitude or slowed 1 until your next turn ends.${tactical ? ' Cold ignores resistance.' : ''}`
    case 'Ghost Killer':
      return 'Can affect incorporeal creatures; they can touch and wield this weapon.'
    case 'Holy Module':
      return `Against unholy targets: 2d4 spirit instead. Unholy wielder: enfeebled 2. Critical hit: DC ${tactical ? 35 : 28} Fortitude or dazzled (blinded if unholy) until your next turn ends.`
    case 'Loudener':
      return `Critical hit: DC ${tactical ? 34 : 24} Fortitude or deafened${tactical ? ' permanently' : ' for 1 minute (1 hour on critical failure)'}.${tactical ? ' Sonic ignores resistance.' : ''}`
    case 'Merciful':
      return 'Only nonlethal attacks; persistent damage is negated. Critical hit: choose fascination for 1 minute or your critical specialization.'
    case 'Quicklock':
      return 'While wielded, quickened; the extra action can only Strike with this weapon.'
    case 'Shock Module':
      return `Critical hit: electricity arcs to up to two creatures within 10 feet${tactical ? '; critical electricity damage is 2d10 and ignores resistance' : ', dealing equal electricity damage'}.`
    case "Smuggler's Grip":
      return tactical ? 'Concealed; Interact to store or retrieve weapon extradimensionally, with +4 item bonus to Conceal the Object while stored.' : 'Grants concealed.'
    case 'Uniclamp':
      return 'Holds one nonmagical tech item up to 1 Bulk (not a weapon or shield); activate it using the hands wielding this weapon.'
    case 'Glarecaster':
      return 'Critical hit: dazzled for 1 round.'
    case 'Divinity Jammer':
      return 'Critical hit: stupefied 1 until your next turn ends, or 3 rounds for a celestial, fiend, monitor, or creature with divine spells or abilities.'
    case 'Tracking Module':
      return 'Track a creature hit within 1 week using Arcana, Nature, Occultism, or Religion instead of Survival; follow its trail.'
    case 'Boom Ripple':
      return `Critical hit: ${tactical ? 4 : 2}d6 bludgeoning in ${tactical ? 20 : 10}-foot burst, DC ${tactical ? 30 : 20} basic Reflex; critical failure pushes 10 feet. Primary Target uses the Area Fire area instead.`
    case 'Gravitational Generator':
      return 'Critical hit dealing damage to a flying creature: it falls up to 20 feet and loses 5 feet of fly Speed for 1 minute; subsequent hits reduce it further. No effect in zero gravity.'
    case 'Protection Grid':
      return `Grants parry; position defensively for +${tactical ? 2 : 1} circumstance AC.`
    case 'Radiation Module':
      return `Critical hit: DC ${tactical ? 32 : 22} Fortitude against ${tactical ? 'incredible' : 'severe'} radiation sickness.${tactical ? ' Poison ignores resistance.' : ''}`
    case 'Suppression Matrix':
      return `Critical hit: target suppressed until your next turn begins${tactical ? ' and cannot use reactions while suppressed' : ''}.`
    case 'Animated Intelligence': {
      const advanced = grade === 'advanced'
      const attack = (advanced ? 32 : tactical ? 27 : 18) + itemBonus
      return `Autoattack (2 actions): release weapon; it flies ${advanced ? 60 : tactical ? 50 : 30} feet and attacks at +${attack} with +0 ability modifier. Flat check DC ${advanced ? 4 : tactical ? 5 : 6} each round; failure ends it for 10 minutes.${advanced ? ' Provides flanking.' : ''}`
    }
    case "Sniper's Scope": {
      const bonus = grade === 'superior' ? 3 : grade === 'advanced' ? 2 : tactical ? 1 : 0
      const increment = grade === 'superior' ? 40 : grade === 'advanced' ? 20 : 10
      return `${bonus ? `+${bonus} item to visual Seek through scope. ` : ''}Adjust Sight (1 action): range +${increment} feet, or +${increment * 2} if base range is at least 50 feet, until next turn or unwielded.`
    }
    case 'Truesight Sight':
      return `+${tactical ? 2 : 1} item to visual Seek through scope. See the Truth (2 actions, once/day): see invisible creatures and nearby hidden incorporeal creatures for 10 minutes.${tactical ? ' Secret counteract +20, rank 7, to see through illusions, morphs, and polymorphs.' : ''}`
    case 'Tactical Bioscanner':
      return 'On hit, Scan Complete (free action): Recall Knowledge with +1 circumstance, or +2 on a critical hit; target immune for 1 day.'
    default:
      return undefined
  }
}
