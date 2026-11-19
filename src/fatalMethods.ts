import type { Character, ContentEntry } from './types'

export type FatalMethod = NonNullable<Character['fatalMethod']>

const METHODS: FatalMethod[] = ['Puppeteer', 'Reaper']

const fallbackDescriptions: Record<FatalMethod, string> = {
  Puppeteer: 'You prefer to study life and death from afar. You gain the Consume Thrall action and the thrall proliferation ability.\n\n'
    + 'Consume Thrall: Once per day, if you have no Focus Points and at least one thrall within 30 feet, destroy one thrall within 30 feet to regain 1 Focus Point. This Focus Point can be spent only on a grave spell.\n\n'
    + 'Thrall Proliferation: Once per round when you cast create thrall, you can create one additional thrall in range.',
  Reaper: "Reaper's Edge: Trained in martial weapons and medium armor; expert in martial weapons at 11th level and medium armor at 13th.\n\nThrall Teamwork: Once per round after casting create thrall, make a melee Strike against a creature within your melee reach and adjacent to one of your thralls.",
}

export function fatalMethodOptions(entries: ContentEntry[]): ContentEntry[] {
  return METHODS.map(name => entries.find(entry => !entry.deleted && entry.kind === 'subclass'
    && entry.data.subclass_type === 'fatal-method' && entry.name === name)
    ?? {
      id: `fatal-method:${name.toLowerCase()}`, systems: ['pf2e'], kind: 'subclass', source: 'official',
      name, level: 1, traits: [], description: fallbackDescriptions[name],
      data: { class: 'Necromancer', subclass_type: 'fatal-method', url: `https://2e.aonprd.com/FatalMethods.aspx?ID=${name === 'Puppeteer' ? 1 : 2}` },
      effects: [], updatedAt: 1,
    })
}

export function selectedFatalMethod(c: Character): FatalMethod | undefined {
  return c.className === 'Necromancer' && METHODS.includes(c.fatalMethod as FatalMethod) ? c.fatalMethod : undefined
}

export function fatalMethodGrants(c: Character): {
  method?: FatalMethod
  features: string[]
  martialWeapons: number
  mediumArmor: number
} {
  const method = selectedFatalMethod(c)
  return {
    method,
    features: method === 'Puppeteer' ? ['Consume Thrall', 'Thrall Proliferation']
      : method === 'Reaper' ? ["Reaper's Edge", 'Thrall Teamwork'] : [],
    martialWeapons: method === 'Reaper' ? (c.level >= 11 ? 2 : 1) : 0,
    mediumArmor: method === 'Reaper' ? (c.level >= 13 ? 2 : 1) : 0,
  }
}
