import type { Character, ContentEntry } from './types'

export type ArcaneThesis = NonNullable<Character['arcaneThesis']>

const THESES: ArcaneThesis[] = ['Improved Familiar Attunement', 'Metamagical Experimentation', 'Spell Blending', 'Spell Substitution', 'Staff Nexus']

const fallbackDescriptions: Record<ArcaneThesis, string> = {
  'Improved Familiar Attunement': 'You gain the Familiar wizard feat. Your familiar gains an extra ability, and it gains an additional extra ability when you reach 6th, 12th, and 18th levels. Your arcane bond stores magical energy in your familiar instead of an item, and you gain the Drain Familiar free action instead of Drain Bonded Item.',
  'Metamagical Experimentation': 'You gain one 1st-level metamagic wizard feat of your choice. Starting at 4th level, during your daily preparations, you can gain a metamagic wizard feat of your choice with a level requirement of no more than half your level, which you can use until your next daily preparations.',
  'Spell Blending': 'When you make your daily preparations, you can trade two spell slots of the same level for a bonus spell slot of up to 2 levels higher than the traded slots. Bonus spell slots must be of a level you can normally cast, and each must be of a different spell level. You can also trade any spell slot for two additional cantrips, but no more than one slot at a time for cantrips.',
  'Spell Substitution': 'You can exchange prepared spells during a short period of rest. In 10 minutes, you can swap one prepared spell in a spell slot for another spell from your spellbook of the same level.',
  'Staff Nexus': 'You begin play with a makeshift staff containing one cantrip and one 1st-level spell from your spellbook. It gains no charges normally; expend a spell slot to grant it charges as for a normal staff. At 8th level you can expend two spells, and at 16th level up to three spells, to add charges equal to their combined levels.',
}

const optionsCache = new WeakMap<ContentEntry[], ContentEntry[]>()

export function arcaneThesisOptions(entries: ContentEntry[]): ContentEntry[] {
  let options = optionsCache.get(entries)
  if (!options) {
    options = THESES.map((name, index) => entries.find(entry => !entry.deleted && entry.kind === 'subclass'
      && entry.data.subclass_type === 'arcane-thesis' && entry.name === name)
      ?? {
        id: `arcane-thesis:${name.toLowerCase().replace(/\s+/g, '-')}`, systems: ['pf2e'], kind: 'subclass', source: 'official',
        name, level: 1, traits: [], description: fallbackDescriptions[name],
        data: { class: 'Wizard', subclass_type: 'arcane-thesis', url: `https://2e.aonprd.com/ArcaneThesis.aspx?ID=${index + 1}` },
        effects: [], updatedAt: 1,
      })
    optionsCache.set(entries, options)
  }
  return options
}

export function selectedArcaneThesis(c: Character): ArcaneThesis | undefined {
  return c.className === 'Wizard' && c.systems.includes('pf2e') && THESES.includes(c.arcaneThesis as ArcaneThesis)
    ? c.arcaneThesis : undefined
}

export const attunementFamiliarAbilities = (c: Character) =>
  selectedArcaneThesis(c) === 'Improved Familiar Attunement'
    ? 1 + [6, 12, 18].filter(level => c.level >= level).length : 0
