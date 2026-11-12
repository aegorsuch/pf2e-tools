import type { ContentEntry, HardlightGrade, OwnedArmor } from './types'

export const HAFT_STRIKER_WEAPON: ContentEntry = {
  id: 'supplemental:haft-striker-stance',
  systems: ['pf2e'],
  kind: 'weapon',
  source: 'official',
  name: 'Haft Striker Stance',
  level: 0,
  traits: ['Agile', 'Finesse'],
  description: 'You treat the haft of your wielded weapon as a simple weapon dealing 1d4 bludgeoning damage. The haft is in the club group and has the agile and finesse traits.',
  data: { weapon_category: 'Simple', weapon_group: 'Club', weapon_type: 'Melee', damage: '1d4 bludgeoning' },
  effects: [],
  updatedAt: 1,
}

export const OVERSIZED_THROW: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:oversized-throw', name: 'Oversized Throw',
  traits: ['Thrown'],
  description: 'While raging with a hand free, hurl an object your size or one size smaller that you can lift. It takes the damage it would deal on a successful Strike, regardless of the result. The attack takes two actions and has a 20-foot range increment. Damage dice increase with weapon specialization.',
  data: { weapon_category: 'Simple', weapon_type: 'Ranged', damage: '1d10 bludgeoning', range: 20, hands: '1', url: 'https://2e.aonprd.com/Feats.aspx?ID=5818' },
}

export const FIST: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:fist', name: 'Fist',
  traits: ['Agile', 'Finesse', 'Nonlethal', 'Unarmed'],
  description: 'A basic fist unarmed attack deals 1d4 bludgeoning damage.',
  data: { weapon_category: 'Unarmed', weapon_group: 'Brawling', weapon_type: 'Melee', damage: '1d4 bludgeoning' },
}

export const IRON_FIST: ContentEntry = {
  ...FIST, id: 'supplemental:iron-fist', name: 'Iron Fist',
  traits: ['Agile', 'Finesse', 'Shove', 'Unarmed'],
  description: 'Iron Fists removes the nonlethal trait from your fist attacks and adds the shove trait.',
}

export const ORC_TUSKS: ContentEntry = {
  ...FIST, id: 'supplemental:orc-tusks', name: 'Tusks',
  traits: ['Finesse', 'Unarmed'],
  description: 'Tusks grants a 1d6 piercing unarmed attack in the brawling group with finesse.',
  data: { ...FIST.data, damage: '1d6 piercing', url: 'https://2e.aonprd.com/Feats.aspx?ID=4519' },
}

export const GAUNTLET: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:full-plate-gauntlet', name: 'Gauntlet',
  traits: ['Agile', 'Free-Hand'],
  description: 'Full plate, half plate, and splint mail include gauntlets that can be used as simple weapons dealing 1d4 bludgeoning damage.',
  data: { weapon_category: 'Simple', weapon_group: 'Brawling', weapon_type: 'Melee', damage: '1d4 bludgeoning' },
}

export const ARMOR_GAUNTLETS: NonNullable<OwnedArmor['gauntlet']>[] = ['Gauntlet', 'Spiked Gauntlet', 'Bladed Gauntlet', 'Clawed Gauntlet']

const homebrewFeat = (id: string, name: string, level: number, traits: string[], description: string, data: ContentEntry['data'] = {}): ContentEntry => ({
  id: `homebrew:${id}`, systems: ['pf2e'], kind: 'feat', source: 'homebrew', name, level, traits, description, data, effects: [], updatedAt: 1,
})

export function homebrewCharacterOptions(entries: ContentEntry[]): ContentEntry[] {
  const poison = entries.find((entry) => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
    && entry.name === 'Poison Resistance' && entry.level === 2 && entry.traits.includes('Druid'))
  return [
    homebrewFeat('favored-weapon-jousting', 'Favored Weapon Jousting', 4, ['Champion'],
      "You know how to use the favored weapon of your deity while riding your animal companion. If one handed and melee, your deity's favored weapon gains the jousting trait.", { class: 'Champion' }),
    homebrewFeat('cold-iron-tusks', 'Cold Iron Tusks', 5, ['Orc', 'Uncommon'],
      'Like all orcs, you have tusks, but, uniquely, you coat or inlay them with cold iron, allowing your bite to easily damage demons.', { ancestry: 'Orc', rarity: 'uncommon' }),
    homebrewFeat('primal-nimbleness', 'Primal Nimbleness', 1, ['Druid', 'Ranger'],
      'Your muscles are tightly honed. Your Speed increases by 5 feet.', { class: 'Druid, Ranger' }),
    homebrewFeat('favored-weapon-symbol', 'Favored Weapon Symbol', 1, ['Champion'],
      "You cultivate a divine conduit within your deity's symbol that can manifest into your deity's favored weapon. You spend 10 minutes focusing divine energy into your deity's symbol, imprinting it with the potential of your deity's favored weapon.\n\nWhen holding or wearing the imprinted holy symbol, you can use an Interact action to cause the divine energy to surge outward, immediately growing the weapon directly from the symbol into your hand. A second Interact action causes the divine matter to swiftly retract back into the holy symbol.\n\nThe favored weapon from your icon can be etched with weapon runes or affixed with talismans as normal, which are safely suppressed when the weapon is retracted inside the symbol.", { class: 'Champion' }),
    homebrewFeat('verdant-weapon-jousting', 'Verdant Weapon Jousting', 4, ['Druid'],
      'You know how to use your verdant weapon while riding your animal companion. If one handed and melee, your verdant weapon gains the jousting trait.', { class: 'Druid' }),
    homebrewFeat('living-weapon-joust', 'Living Weapon Joust', 14, ['Archetype'],
      'You know how to use your living weapon while riding your animal companion. If one handed and melee, your living weapon gains the jousting trait.', { archetype: 'Wild Hunter' }),
    homebrewFeat('third-blessing', 'Third Blessing', 16, ['Champion'],
      'Your continued service grants you a third boon. Choose a third blessing of the devoted, different from your other blessings, and gain its benefits.',
      { class: 'Champion', prerequisite: 'Second Blessing' }),
    {
      ...homebrewFeat('summertouched-human', 'Summertouched Human', 1, ['Human'],
        'The power of summer flows through you. You gain fire resistance equal to half your level (minimum 1), and you treat environmental heat effects as if they were one step less extreme (incredible heat becomes extreme, extreme heat becomes severe, and so on).',
        { ancestry: 'Human', resistances: 'fire=half' }),
      kind: 'heritage',
    },
    ...(poison ? [{
      ...poison, id: 'homebrew:ranger-poison-resistance', source: 'homebrew' as const,
      traits: ['Ranger'],
      description: 'Your affinity for the natural world grants you protection against some of its dangers. You gain poison resistance equal to half your level, and you gain a +1 status bonus to saving throws against poisons.',
      data: { ...Object.fromEntries(Object.entries(poison.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Ranger', resistances: 'poison=half' }, updatedAt: 1,
    }] : []),
  ]
}

export const ANIMAL_FEATURES = [
  { name: 'Cat Eyes', rank: 2, effect: 'Low-light vision' },
  { name: 'Claws', rank: 2, effect: '1d6 slashing; agile, finesse, unarmed' },
  { name: 'Fish Tail', rank: 4, effect: 'Swim Speed equal to land Speed' },
  { name: 'Jaws', rank: 2, effect: '1d8 piercing; unarmed' },
  { name: 'Owl Eyes', rank: 4, effect: 'Darkvision' },
  { name: 'Wings', rank: 4, effect: 'Fly Speed equal to land Speed' },
] as const

export function homebrewWeapons(entries: ContentEntry[]): ContentEntry[] {
  const base = entries.find((entry) => entry.id === 'aon:pf2e:weapon-304' && entry.kind === 'weapon' && entry.source === 'official' && !entry.deleted)
  return base ? [{
    ...base, id: 'homebrew:clawed-gauntlet', source: 'homebrew', name: 'Clawed Gauntlet',
    description: 'Four curved blades mounted over the fist give this close-combat gauntlet the appearance of claws.',
    updatedAt: 1,
  }] : []
}

export const ANIMAL_FEATURE_CLAWS: ContentEntry = {
  ...FIST, id: 'supplemental:animal-feature-claws', name: 'Claws (Animal Feature)',
  traits: ['Agile', 'Finesse', 'Unarmed'],
  description: 'Animal Feature grants a claw unarmed attack dealing 1d6 slashing damage.',
  data: { ...FIST.data, damage: '1d6 slashing' },
}

export const ANIMAL_FEATURE_JAWS: ContentEntry = {
  ...FIST, id: 'supplemental:animal-feature-jaws', name: 'Jaws (Animal Feature)',
  traits: ['Unarmed'],
  description: 'Animal Feature grants a jaws unarmed attack dealing 1d8 piercing damage.',
  data: { ...FIST.data, damage: '1d8 piercing' },
}

export const HANDWRAPS: ContentEntry = {
  ...FIST, id: 'supplemental:handwraps', kind: 'item', name: 'Handwraps of Mighty Blows', level: 2,
  traits: ['Invested', 'Magical'],
  description: 'These handwraps carry weapon potency, striking, and property runes. Their benefits apply to your unarmed attacks; property runes apply only to compatible attacks.',
  data: { usage: 'worn gloves' },
}

export const HARDLIGHT_HANDWRAPS: ContentEntry = {
  ...HANDWRAPS, id: 'supplemental:hardlight-handwraps', systems: ['sf2e'], name: 'Hardlight Handwraps', level: 0,
  traits: ['Invested', 'Magical', 'Tech'],
  description: 'Hardlight handwraps enhance unarmed attacks. Their grade determines tracking, damage dice, and upgrade capacity.',
  data: { usage: 'worn gloves', url: 'https://2e.aonsrd.com/treasure/112-hardlight-handwraps' },
}

export const HARDLIGHT_GRADES: Record<HardlightGrade, { potency: number; striking: number; upgrades: number }> = {
  Commercial: { potency: 0, striking: 0, upgrades: 1 },
  Tactical: { potency: 1, striking: 0, upgrades: 1 },
  Advanced: { potency: 1, striking: 1, upgrades: 2 },
  Superior: { potency: 2, striking: 1, upgrades: 2 },
  Elite: { potency: 2, striking: 2, upgrades: 3 },
  Ultimate: { potency: 3, striking: 2, upgrades: 3 },
  Paragon: { potency: 3, striking: 3, upgrades: 4 },
}

export const SUPPLEMENTAL_WEAPONS = [HAFT_STRIKER_WEAPON, OVERSIZED_THROW, FIST, IRON_FIST, ORC_TUSKS, ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS, GAUNTLET]

export function homebrewCompanions(entries: ContentEntry[]): ContentEntry[] {
  const variants = [
    { id: 'homebrew:sarkorian-direwolf', name: 'Sarkorian Direwolf', base: 'Isgeri Boarhound', size: 'Large' },
    { id: 'homebrew:snow-leopard', name: 'Snow Leopard', base: 'Cat', size: 'Medium' },
  ]
  return variants.flatMap<ContentEntry>((variant) => {
    const base = entries.find((entry) => entry.kind === 'companion' && entry.source === 'official' && entry.systems.includes('pf2e') && !entry.deleted && entry.name === variant.base)
    if (!base) return []
    return [{
      ...base, id: variant.id, name: variant.name, source: 'homebrew',
      traits: [...new Set([...base.traits, 'Mount'])],
      description: `Based on ${base.name}. Starts ${variant.size} and never grows larger; has the Mount trait.\n\n${base.description}`,
      data: { ...base.data, size: variant.size, mount: true, fixed_size: true },
      // Fresh-device defaults must not supersede synced user edits or deletions.
      updatedAt: 1,
    }]
  })
}
