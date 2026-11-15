import type { ContentEntry } from './types'

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

const paths: Record<string, string> = {
  Envoy: '1-envoy/leadership-styles', Mystic: '2-mystic/connections',
  Operative: '3-operative/specializations', Witchwarper: '6-witchwarper/paradoxes',
}

export const STARFINDER_SUBCLASSES: ContentEntry[] = Object.entries(choices).flatMap(([className, options]) =>
  options.map(([name, skill, slug]) => ({
    id: `supplemental:sf2e:${className.toLowerCase()}:${slug}`, systems: ['sf2e'], kind: 'subclass', source: 'official',
    name, level: 1, traits: [], description: `Trained in ${skill}.`,
    data: { class: className, skill, url: `https://2e.aonsrd.com/classes/${paths[className]}/${slug}` },
    effects: [], updatedAt: 1,
  })))
