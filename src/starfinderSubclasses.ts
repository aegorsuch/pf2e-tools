import type { ContentEntry } from './types'
import { SOLDIER_STYLES } from './soldier'

export const STARFINDER_MYSTIC_TRADITIONS: Record<string, string> = {
  Akashic: 'Occult', Elemental: 'Primal', Healing: 'Divine', Rhythm: 'Primal', Shadow: 'Divine',
}

// Archives of Nethys publishes these SF2e choices under their class pages, not as catalog categories.
const choices: Record<string, [string, string, string][]> = {
  Envoy: [
    ['From the Front', 'Athletics', '1-from-the-front'],
    ['From the Shadows', 'Stealth', '2-from-the-shadows'],
    ['Guns Blazing', 'Acrobatics', '3-guns-blazing'],
    ['In the Spotlight', 'Performance', '4-in-the-spotlight'],
    ['Infosphere Director', 'Computers', '5-infosphere-director'],
    ['Through Desperate Times', 'Medicine', '6-through-desperate-times'],
  ],
  Mystic: [
    ['Akashic', 'Occultism', '1-akashic'],
    ['Elemental', 'Nature', '2-elemental'],
    ['Healing', 'Medicine', '3-healing'],
    ['Rhythm', 'Performance', '4-rhythm'],
    ['Shadow', 'Stealth', '5-shadow'],
  ],
  Operative: [
    ['Ghost', 'Deception', '1-ghost'],
    ['Infiltrator', 'Computers', '2-infiltrator'],
    ['Skirmisher', 'Acrobatics', '3-skirmisher'],
    ['Sniper', 'Stealth', '4-sniper'],
    ['Striker', 'Athletics', '5-striker'],
  ],
  Witchwarper: [
    ['Analyst', 'Computers', '1-analyst'],
    ['Anomaly', 'Deception', '2-anomaly'],
    ['Gap Influenced', 'Society', '3-gap-influenced'],
    ['Precog', 'Piloting', '4-precog'],
  ],
}

export const OPERATIVE_EXPLOITS: Record<string, { exploit: string; enhanced: string }> = {
  Ghost: { exploit: 'You can Aim at targets you are undetected by as a free action.', enhanced: 'You gain the Ghost Tap action.' },
  Infiltrator: { exploit: 'You gain the Sabotage action.',
    enhanced: 'You can Sabotage as a free action whenever you critically hit a tech creature with a melee or ranged attack, targeting the triggering creature. You can Sabotage as a reaction whenever a tech creature or a creature using a tech weapon critically fails a melee attack roll against you, targeting the triggering creature or weapon.' },
  Skirmisher: { exploit: "Your ranged Strikes with one-handed ranged weapons don't trigger reactions that are triggered by a ranged attack.",
    enhanced: 'When you make a successful Strike against an adjacent enemy with a one-handed ranged weapon, you calculate the damage as if the lowest-rolled weapon damage die for the attack had the maximum result instead. At 17th level, the two lowest-rolled damage dice increase to the maximum result.' },
  Sniper: { exploit: 'You ignore the unwieldy and volley trait of guns you wield belonging to the sniper group. You gain one of the following operative feats as a bonus feat: Keep Them in Your Sights or Scope Sight.',
    enhanced: "Your first failed ranged Strike against your mark using a sniper weapon doesn't count toward your multiple attack penalty. You can Reload your sniper weapon as a free action once per turn." },
  Striker: { exploit: 'You have expert proficiency with one-handed melee weapons and unarmed attacks with the agile or finesse traits instead of with martial guns, and you can Aim with and treat such weapons as guns for operative feats. You gain the Reactive Step reaction.',
    enhanced: 'You gain the Overwhelming Strike free action.' },
}

const paths: Record<string, string> = {
  Envoy: '1-envoy/leadership-styles', Mystic: '2-mystic/connections',
  Operative: '3-operative/specializations', Witchwarper: '6-witchwarper/paradoxes',
}

const envoyPerks: Record<string, { feat?: string; choice?: string; description: string }> = {
  'From the Front': { description: 'You are trained in medium armor. When your light armor proficiency increases to expert or master, your medium armor proficiency increases to the same rank.' },
  'From the Shadows': { feat: 'Assurance', choice: 'Stealth', description: 'You gain Assurance (Stealth) as a bonus feat.' },
  'Guns Blazing': { feat: 'Incredible Initiative', description: 'You gain Incredible Initiative as a bonus feat.' },
  'In the Spotlight': { feat: 'Impressive Performance', description: 'You gain Impressive Performance as a bonus feat.' },
  'Infosphere Director': { feat: 'Digital Diversion', description: 'You gain Digital Diversion as a bonus feat.' },
  'Through Desperate Times': { feat: 'Battle Medicine', description: 'You gain Battle Medicine as a bonus feat.' },
}

export const STARFINDER_SUBCLASSES: ContentEntry[] = [...Object.entries(choices).flatMap(([className, options]) =>
  options.map(([name, skill, slug]): ContentEntry => ({
    id: `supplemental:sf2e:${className.toLowerCase()}:${slug}`, systems: ['sf2e'], kind: 'subclass', source: 'official',
    name, level: 1, traits: [], description: `Trained in ${skill}.${className === 'Envoy' ? ` ${envoyPerks[name]?.description ?? ''}` : ''}`,
    data: { class: className, skill, ...(envoyPerks[name] ? {
      leadership_perk_feat: envoyPerks[name].feat,
      leadership_perk_choice: envoyPerks[name].choice,
    } : {}), url: `https://2e.aonsrd.com/classes/${paths[className]}/${slug}` },
    effects: [], updatedAt: 1,
  }))), ...[
    ['Drone', '1-drone', 'A robot companion with three commercial customizations.'],
    ['Mine', '2-mine', 'A remotely deployed network of mines.'],
    ['Turret', '3-turret', 'A deployable ranged weapon with its own defenses.'],
  ].map(([name, slug, description]): ContentEntry => ({
    id: `supplemental:sf2e:mechanic:${slug}`, systems: ['sf2e'], kind: 'subclass', source: 'official',
    name, level: 1, traits: [], description,
    data: { class: 'Mechanic', url: `https://2e.aonsrd.com/classes/7-mechanic/exocortex/${slug}` },
    effects: [], updatedAt: 1,
  })), ...SOLDIER_STYLES.map(({ name, skill, slug, description }): ContentEntry => ({
    id: `supplemental:sf2e:soldier:${slug}:${skill || 'style'}`, systems: ['sf2e'], kind: 'subclass', source: 'official',
    name, level: 1, traits: [], description,
    data: { class: 'Soldier', skill, url: `https://2e.aonsrd.com/classes/5-soldier/fighting-styles/${slug}` },
    effects: [], updatedAt: 1,
  }))]
