import type { Character, ContentEntry, HardlightGrade, OwnedArmor } from './types'

export function removeColdIronTusks(c: Character): Character {
  const feats = c.feats.filter(feat => feat.name !== 'Cold Iron Tusks')
  const entryIds = c.entryIds.filter(id => id !== 'homebrew:cold-iron-tusks')
  return feats.length === c.feats.length && entryIds.length === c.entryIds.length ? c : { ...c, feats, entryIds }
}

export const GRAPPLING_RUNE: ContentEntry = {
  id: 'homebrew:grappling-rune', systems: ['pf2e'], kind: 'item', source: 'homebrew',
  name: 'Grappling', level: 5, traits: ['Magical', 'Rare'],
  description: 'Etched loops and interlocking lines help this weapon catch and hold foes. Price 140 gp. Usage: etched onto a melee weapon.\n\nThe weapon gains the grapple trait. You can use it to Grapple without a free hand, using its reach and adding its item bonus to attack rolls as an item bonus to the Athletics check. On a critical failure, you can drop the weapon to take the effects of a failure instead.\n\nIf the weapon normally has the grapple trait, you can attempt to Grapple the target as a reaction when you critically hit it with this weapon.',
  data: { item_category: 'Runes', item_subcategory: 'Weapon Property Runes', usage: 'etched onto a melee weapon',
    price: 14000, bulk: 0, rarity: 'rare', sourceBook: 'Homebrew' },
  effects: [], updatedAt: 1,
}

export const DISARMING_RUNE: ContentEntry = {
  ...GRAPPLING_RUNE, id: 'homebrew:disarming-rune', name: 'Disarming',
  description: "Curved markings guide this weapon around an opponent's grip. Price 140 gp. Usage: etched onto a melee weapon.\n\nThe weapon gains the disarm trait. Attempt Disarm with the weapon's reach without needing a free hand, and add its item bonus to attack rolls to the Athletics check. On a critical failure, you may drop the weapon to take a failure instead.",
}

export const PARRYING_RUNE: ContentEntry = {
  ...GRAPPLING_RUNE, id: 'homebrew:parrying-rune', name: 'Parrying',
  description: 'Defensive markings guide this weapon into a guarding position. Price 140 gp. Usage: etched onto a melee weapon.\n\nThe weapon gains the parry trait. If you are trained or better with this weapon, you can spend one action while wielding it to gain a +1 circumstance bonus to AC until the start of your next turn. This bonus does not stack with other circumstance bonuses to AC.',
}

export const KILLERS_BELT_MAJOR: ContentEntry = {
  id: 'homebrew:killers-belt-major', systems: ['pf2e'], kind: 'item', source: 'homebrew',
  name: "Killer's Belt (Major)", level: 17, traits: ['Invested', 'Magical'],
  description: "Blood-red rubies set in this imposing belt project a fearsome presence. Price 15,000 gp.\n\nWhile wearing and investing this belt, you gain a +3 item bonus to Intimidation checks.\n\nActivate: Bleeding Rubies (one action, manipulate). Frequency: once per day. Requirements: You have a free hand, and your last action dealt damage to an enemy with a Strike or spell attack roll. Crush one of the belt's rubies to cause that enemy to take 3d6 persistent bleed damage. The ruby returns after 24 hours.",
  data: { item_category: 'Worn Items', item_subcategory: 'Other Worn Items', usage: 'worn belt',
    bulk: 0.1, price: 1500000, rarity: 'common', skill: 'Intimidation', sourceBook: 'Homebrew',
    url: 'https://2e.aonprd.com/Equipment.aspx?ID=3968' },
  effects: [{ type: 'bonus', target: 'Intimidation', bonusType: 'item', value: 3 }], updatedAt: 1,
}

export const HUNTERS_ARROWHEADS: ContentEntry[] = [
  { grade: 'Greater', bonus: 2, level: 9, price: 65000 },
  { grade: 'Major', bonus: 3, level: 17, price: 1500000 },
].map(({ grade, bonus, level, price }) => ({
  id: `homebrew:hunters-arrowhead-${grade.toLowerCase()}`, systems: ['pf2e'], kind: 'item', source: 'homebrew',
  name: `Hunter's Arrowhead (${grade})`, level, traits: ['Invested', 'Magical', 'Rare'],
  description: `This stronger charm is a religious symbol of Ketephys. Wear it as a pendant or carry it in a pocket or quiver. Against a creature you have designated with Hunt Prey, gain a +${bonus} item bonus to Survival checks and attack rolls. This item bonus does not stack with weapon potency or other item bonuses.\n\nActivate: Guided Shot (reaction, concentrate). Frequency once per day. Trigger You would miss with a bow attack. Effect Gain a +2 circumstance bonus to that attack roll, potentially turning the miss into a hit. Track this activation manually.`,
  data: { item_category: 'Worn Items', item_subcategory: 'Other Worn Items', usage: 'worn or carried',
    bulk: 0, price, rarity: 'rare', skill: 'Survival', sourceBook: 'Homebrew',
    url: 'https://2e.aonprd.com/Equipment.aspx?ID=2343' },
  effects: [], updatedAt: 1,
}))

export const HAFT_STRIKER_WEAPON: ContentEntry = {
  id: 'supplemental:haft-striker-stance',
  systems: ['pf2e'],
  kind: 'weapon',
  source: 'official',
  name: 'Haft Striker Stance',
  level: 0,
  traits: ['Agile', 'Finesse'],
  description: 'You treat the haft of your wielded weapon as a simple weapon dealing 1d4 bludgeoning damage. The haft is in the club group and has the agile and finesse traits.',
  data: { weapon_category: 'Simple', weapon_group: 'Club', weapon_type: 'Melee', damage: '1d4 bludgeoning', hands: 1 },
  effects: [],
  updatedAt: 1,
}

export const OVERSIZED_THROW: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:oversized-throw', name: 'Oversized Throw',
  traits: ['Thrown'],
  description: 'While raging with a hand free, hurl an object your size or one size smaller that you can lift. It takes the damage it would deal on a successful Strike, regardless of the result. The attack takes two actions and has a 20-foot range increment. Damage dice increase with weapon specialization.',
  data: { weapon_category: 'Simple', weapon_type: 'Ranged', damage: '1d10 bludgeoning', range: 20, hands: '1', actions: 'Two Actions', url: 'https://2e.aonprd.com/Feats.aspx?ID=5818' },
}

export const ATTACHED_WEAPONS: ContentEntry[] = [
  { ...HAFT_STRIKER_WEAPON, id: 'supplemental:bayonet', name: 'Bayonet', traits: ['Agile', 'Attached', 'Finesse'],
    data: { weapon_category: 'Martial', weapon_group: 'Knife', weapon_type: 'Melee', damage: '1d4 piercing', hands: '1 or 2' } },
  { ...HAFT_STRIKER_WEAPON, id: 'supplemental:reinforced-stock', name: 'Reinforced Stock', traits: ['Attached', 'Finesse', 'Two-Hand d8'],
    data: { weapon_category: 'Martial', weapon_group: 'Club', weapon_type: 'Melee', damage: '1d4 bludgeoning', hands: '1 or 2' } },
]

export const SHIELD_BASH: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:shield-bash', name: 'Shield Bash', traits: [],
  description: 'Strike with your shield for 1d4 bludgeoning damage. Shield Bash cannot have weapon runes.',
  data: { weapon_category: 'Martial', weapon_group: 'Shield', weapon_type: 'Melee',
    damage: '1d4 bludgeoning', hands: 1, url: 'https://2e.aonprd.com/Weapons.aspx?ID=395' },
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

export const CLAN_PISTOL: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:clan-pistol', name: 'Clan Pistol',
  traits: ['Concussive', 'Dwarf', 'Fatal d10', 'Uncommon'],
  description: '',
  data: { weapon_category: 'Martial', weapon_group: 'Firearm', weapon_type: 'Ranged', damage: '1d6 piercing',
    range: 80, reload: 1, hands: 1, url: 'https://2e.aonprd.com/Weapons.aspx?ID=197' },
}

export const CLAN_DAGGER: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:clan-dagger', name: 'Clan Dagger',
  traits: ['Agile', 'Dwarf', 'Parry', 'Uncommon', 'Versatile B'],
  description: '',
  data: { weapon_category: 'Simple', weapon_group: 'Knife', weapon_type: 'Melee', damage: '1d4 piercing',
    hands: 1, url: 'https://2e.aonprd.com/Weapons.aspx?ID=368' },
}

export const CLAN_DAGGER_DEXTERITY: ContentEntry = {
  ...CLAN_DAGGER, id: 'supplemental:clan-dagger-dexterity', name: 'Clan Dagger (Dexterity)',
  source: 'homebrew', traits: ['Agile', 'Disarm', 'Dwarf', 'Finesse', 'Parry', 'Uncommon', 'Versatile S'],
  description: 'An orichalcum clan dagger balanced for precise, agile cuts and deft parries. Its fundamental runes improve automatically with its wielder.',
  data: { ...CLAN_DAGGER.data, weapon_category: 'Martial', damage: '1d4 piercing',
    url: 'https://2e.aonprd.com/Weapons.aspx?ID=387' },
}

export const GAUNTLET: ContentEntry = {
  ...HAFT_STRIKER_WEAPON, id: 'supplemental:full-plate-gauntlet', name: 'Gauntlet',
  traits: ['Agile', 'Free-Hand'],
  description: 'Full plate, half plate, Hellknight plate, and splint mail include gauntlets that can be used as simple weapons dealing 1d4 bludgeoning damage.',
  data: { weapon_category: 'Simple', weapon_group: 'Brawling', weapon_type: 'Melee', damage: '1d4 bludgeoning' },
}

export const ARMOR_GAUNTLETS: NonNullable<OwnedArmor['gauntlet']>[] = ['Gauntlet', 'Spiked Gauntlet', 'Bladed Gauntlet', 'Clawed Gauntlet']

const homebrewFeat = (id: string, name: string, level: number, traits: string[], description: string, data: ContentEntry['data'] = {}): ContentEntry => ({
  id: `homebrew:${id}`, systems: ['pf2e'], kind: 'feat', source: 'homebrew', name, level, traits, description, data, effects: [], updatedAt: 1,
})

export const PERSISTENT_SPELLS = [
  { name: 'Keen Smell', level: 6 },
  { name: 'Canopy Crawler', level: 8 },
  { name: 'Animal Feature', level: 8 },
  { name: 'Magic Hide', level: 10 },
  { name: 'Gravity Weapon', level: 14 },
  { name: 'Enlarge Companion', level: 18 },
] as const

export function homebrewCharacterOptions(entries: ContentEntry[]): ContentEntry[] {
  const nimbleClasses = ['Champion', 'Fighter', 'Gunslinger', 'Monk', 'Operative', 'Ranger', 'Rogue', 'Swashbuckler']
  const poison = entries.find((entry) => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
    && entry.name === 'Poison Resistance' && entry.level === 2 && entry.traits.includes('Druid'))
  const simplicity = entries.find((entry) => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
    && entry.name === 'Deadly Simplicity' && entry.traits.includes('Cleric'))
  const rangerCopies = ['Effortless Concentration', 'Forgotten Presence', 'Timeless Nature'].flatMap(name => {
    const original = entries.find(entry => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
      && entry.name === name && entry.traits.includes('Druid'))
    if (!original) return []
    return [{ ...original, id: `homebrew:ranger-${name.toLowerCase().replaceAll(' ', '-')}`, source: 'homebrew' as const,
      traits: [...original.traits.filter(trait => !['Druid', 'Bard', 'Necromancer', 'Sorcerer', 'Summoner', 'Witch', 'Wizard'].includes(trait)), 'Ranger'],
      data: { ...Object.fromEntries(Object.entries(original.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Ranger' },
      updatedAt: 1 }]
  })
  const strongArm = entries.find(entry => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
    && entry.name === 'Strong Arm' && entry.traits.includes('Rogue'))
  const twinnedDefense = entries.find(entry => entry.kind === 'feat' && entry.source === 'official' && !entry.deleted
    && entry.name === 'Twinned Defense (Fighter)' && entry.traits.includes('Fighter'))
  return [
    ...rangerCopies,
    { ...homebrewFeat('nimble-athlete', 'Nimble Athlete', 4, nimbleClasses,
      'Homebrew class feat. You use the higher of your Strength or Dexterity modifiers for Athletics checks and Athletics DCs. This includes combat maneuvers such as Grapple, Trip, Shove, Disarm, and Reposition, as well as climbing, swimming, and jumping.\n\nThis does not change your damage, carrying capacity, or Strength prerequisites.',
      { class: nimbleClasses.join(', '), prerequisite: 'expert in Athletics' }), systems: ['pf2e', 'sf2e'] },
    ...(twinnedDefense ? [{ ...twinnedDefense, id: 'homebrew:ranger-twinned-defense-stance', name: 'Twinned Defense Stance',
      source: 'homebrew' as const, traits: [...twinnedDefense.traits.filter(trait => trait !== 'Fighter'), 'Ranger'],
      description: twinnedDefense.description.replaceAll(twinnedDefense.name, 'Twinned Defense Stance')
        .split('\n\n').filter(paragraph => !/^Archetypes?\b/i.test(paragraph)).join('\n\n'),
      data: { ...Object.fromEntries(Object.entries(twinnedDefense.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Ranger' },
      updatedAt: 1 }] : []),
    homebrewFeat('rider', 'Rider', 1, ['Champion', 'Commander', 'Druid', 'Ranger'],
      "You are especially good at riding animal companions. You gain the Ride general feat. You gain a +1 circumstance bonus to Nature checks to Command an Animal when commanding your own animal companion, if a check is required.\n\nIf you gain an animal companion, it gains the mount special ability while it is at least one size larger than you. This is the full mount special ability: while carrying a rider, it can move and Support you on the same turn and can use its other Speeds, not just its land Speed. This feat does not grant any new Speeds or increase the companion's size.\n\nThis feat does not grant an animal companion and does not apply to construct companions, eidolons, or familiars.",
      { class: 'Champion, Commander, Druid, Ranger' }),
    homebrewFeat('greywatch-initiate', 'Greywatch Initiate', 4, ['Gunslinger', 'Investigator', 'Ranger'],
      "You've received the basic training developed for all Greywatch recruits. You become an expert in Deception and gain the Face in the Crowd and Lengthy Diversion skill feats.",
      { class: 'Gunslinger, Investigator, Ranger', prerequisite: 'Trained in Deception' }),
    ...(strongArm ? [{ ...strongArm, id: 'homebrew:strong-arm-ranger-barbarian', source: 'homebrew' as const,
      traits: [...strongArm.traits.filter(trait => trait !== 'Rogue'), 'Ranger', 'Barbarian'],
      data: { ...Object.fromEntries(Object.entries(strongArm.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Ranger, Barbarian' },
      updatedAt: 1 }] : []),
    homebrewFeat('favored-weapon-jousting', 'Favored Weapon Jousting', 4, ['Champion'],
      "You know how to use the favored weapon of your deity while riding your animal companion. If one handed and melee, your deity's favored weapon gains the jousting trait.", { class: 'Champion', prerequisite: 'Favored Weapon Symbol' }),
    homebrewFeat('primal-nimbleness', 'Primal Nimbleness', 1, ['Druid', 'Ranger'],
      'Your muscles are tightly honed. Your Speed increases by 5 feet.', { class: 'Druid, Ranger' }),
    homebrewFeat('as-mutable-as-nature', 'As Mutable as Nature', 12, ['Druid', '3rd Party'],
      "Prerequisite: You can cast untamed form.\nRequirements: You are currently under the effects of untamed form which has an original duration of 1 minute.\n\nYour shape is as mutable as nature itself, able to shift and change at a moment's notice. You change your form to another that you have access to.",
      { class: 'Druid', actions: 'Single Action', prerequisite: 'You can cast untamed form',
        requirements: 'You are currently under the effects of untamed form which has an original duration of 1 minute.' }),
    ...PERSISTENT_SPELLS.map(({ name, level }) => homebrewFeat(`persistent-${name.toLowerCase().replaceAll(' ', '-')}`,
      `Persistent ${name}`, level, ['Ranger'],
      `When you cast ${name}, you can extend its duration to last until the next time you make your daily preparations instead of its normal duration.${name === 'Animal Feature'
        ? ' This extended duration applies to all options except wings.\n\nYou can have multiple Animal Feature effects active at the same time. Each effect must meet the spell rank requirement.' : ''}`,
      { class: 'Ranger' })),
    homebrewFeat('impaling-throw', 'Impaling Throw', 1, ['Flourish', 'Ranger', '3rd Party'],
      'Requirements: You are wielding a weapon which does piercing damage with the Thrown trait.\n\nYou know a thorn in the flank of your quarry is an easy quarry to take down. Make a ranged Strike against your prey with the required weapon. If you hit the creature, the weapon stays inside of them instead of dropping to the ground. As long as they leave the weapon in, they are clumsy 1. Removing the weapon requires a single Interact action requiring them to succeed on either an Athletics or Medicine skill check against your class DC.\n\nSpecial: You can use Impaling Throw with improvised weapons that are determined to be appropriate, or when throwing weapons without the thrown trait that deal piercing damage.',
      { class: 'Ranger', actions: 'Single Action', requirements: 'You are wielding a weapon which does piercing damage with the Thrown trait.' }),
    homebrewFeat('impaled-takedown', 'Impaled Takedown', 4, ['Flourish', 'Ranger', '3rd Party'],
      'Requirements: You are adjacent to your Hunted Prey. The prey must have a weapon embedded in them (such as from Impaling Throw), and you must either have a free hand or have just completed a successful melee Strike against them this turn with a piercing weapon.\n\nYou can handle impaled creatures with ease. Taking a hold of the required weapon if necessary, you attempt to Shove or Trip the adjacent hunted prey. For the purposes of this attack you may add any item bonus granted to the weapon via proficiency runes to the check. On a success the creature is also considered off-guard to your next strike and they are clumsy 2 until the weapon is removed.',
      { class: 'Ranger', actions: 'Single Action', requirements: 'Adjacent Hunted Prey with an embedded weapon; free hand or a successful melee piercing Strike against them this turn.' }),
    homebrewFeat('favored-weapon-symbol', 'Favored Weapon Symbol', 1, ['Champion'],
      "You cultivate a divine conduit within your deity's symbol that can manifest into your deity's favored weapon. You spend 10 minutes focusing divine energy into your deity's symbol, imprinting it with the potential of your deity's favored weapon.\n\nWhen holding or wearing the imprinted holy symbol, you can use an Interact action to cause the divine energy to surge outward, immediately growing the weapon directly from the symbol into your hand. A second Interact action causes the divine matter to swiftly retract back into the holy symbol.\n\nThe favored weapon from your icon can be etched with weapon runes or affixed with talismans as normal, which are safely suppressed when the weapon is retracted inside the symbol.", { class: 'Champion' }),
    homebrewFeat('verdant-weapon-jousting', 'Verdant Weapon Jousting', 4, ['Druid'],
      'You know how to use your verdant weapon while riding your animal companion. If one handed and melee, your verdant weapon gains the jousting trait.', { class: 'Druid' }),
    homebrewFeat('weapon-innovation-jousting', 'Weapon Innovation Jousting', 4, ['Inventor'],
      'Your weapon innovation is balanced for mounted combat. Your one-handed melee weapon innovation gains the jousting trait. Its mounted benefits apply while riding a suitable mount, including a construct companion.',
      { class: 'Inventor', prerequisite: 'Weapon innovation' }),
    homebrewFeat('living-weapon-joust', 'Living Weapon Jousting', 14, ['Archetype'],
      'You know how to use your living weapon while riding your animal companion. If one handed and melee, your living weapon gains the jousting trait.', { archetype: 'Wild Hunter' }),
    homebrewFeat('pristine-living-weapon', 'Pristine Living Weapon', 14, ['Archetype'],
      'Prerequisites: Living Weapon, Wild Hunter Dedication.\n\nYour living weapon can cut through the resistances of magical creatures. The weapon is treated as cold iron and silver. If you critically hit a creature that has a weakness to cold iron or silver, the target takes 1d6 persistent bleed damage as the primal energies within your weapon slow its natural healing.',
      { archetype: 'Wild Hunter', prerequisite: 'Living Weapon, Wild Hunter Dedication' }),
    homebrewFeat('third-blessing', 'Third Blessing', 16, ['Champion'],
      'Your continued service grants you a third boon. Choose a third blessing of the devoted, different from your other blessings, and gain its benefits.',
      { class: 'Champion', prerequisite: 'Second Blessing' }),
    homebrewFeat('second-innovation', 'Second Innovation', 8, ['Inventor'],
      'Choose a second innovation, different from your existing innovation, and gain its benefits.', { class: 'Inventor' }),
    homebrewFeat('third-innovation', 'Third Innovation', 16, ['Inventor'],
      'Choose a third innovation, different from your other innovations, and gain its benefits.',
      { class: 'Inventor', prerequisite: 'Second Innovation' }),
    homebrewFeat('versatile-rogue', 'Versatile Rogue', 10, ['Rogue'],
      "Your street-smart adaptability lets you master more than one style of underhanded work. Choose a rogue's racket you don't already have. You gain the trained skill, skill feat, and special benefits of that racket.\n\nSpecial: You do not gain an additional key attribute boost from this racket. You can select this feat multiple times, choosing a different rogue's racket each time.",
      { class: 'Rogue', repeatable: true }),
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
    ...(simplicity ? [{
      ...simplicity, id: 'homebrew:champion-deadly-simplicity', source: 'homebrew' as const,
      traits: ['Champion'],
      data: { ...Object.fromEntries(Object.entries(simplicity.data).filter(([key]) => !['archetype', 'archetype_levels'].includes(key))), class: 'Champion' },
      updatedAt: 1,
    }] : []),
    {
      ...homebrewFeat('caravan-contortionist', 'Caravan Contortionist', 1, [],
        'You spent your youth traveling with a nomadic caravan troupe, dazzling crowds by folding yourself into tiny crates, slipping through narrow hoops, and performing daring acrobatic stunts. Life on the road taught you how to slip out of tight binds—both literal and figurative—and how traveling performers survive between towns.\n\nChoose two attribute boosts. One must be to Dexterity or Charisma, and one is a free attribute boost.\n\nYou’re trained in the Acrobatics skill and the Caravan Lore skill. You gain the Quick Squeeze skill feat.',
        { attribute: 'Dexterity, Charisma', skill: 'Acrobatics, Caravan Lore', feat: 'Quick Squeeze' }),
      kind: 'background',
    },
    {
      ...homebrewFeat('direwolf-bonded', 'Direwolf Bonded', 1, ['Rare'],
        "You grew up hunting beside a direwolf, learning to read its signals and coordinate your movements. Sarkorian hunters passed down this partnership as a way to track and bring down quarry across their rugged homeland. Playful wrestling with your growing wolf taught you to hold your own against much larger creatures. Greater challenges, distant hunting grounds, or loyalty to your bonded wolf might draw you toward adventure.\n\nChoose two attribute boosts. One must be to Dexterity or Wisdom, and one is a free attribute boost.\n\nYou're trained in Nature and Sarkoris Lore. You gain the Canny Acumen general feat and the Titan Wrestler skill feat.\n\nTrained direwolves can Aid your Nature, Perception, and Survival checks; this benefit also applies to other characters with the Direwolf Bonded background.",
        { attribute: 'Dexterity, Wisdom', skill: 'Nature, Sarkoris Lore', feat: 'Canny Acumen, Titan Wrestler', rarity: 'rare' }),
      kind: 'background',
    },
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
  const flyssa = entries.find((entry) => entry.id === 'aon:pf2e:weapon-285' && entry.kind === 'weapon' && entry.source === 'official' && !entry.deleted)
  return [...(base ? [{
    ...base, id: 'homebrew:clawed-gauntlet', source: 'homebrew' as const, name: 'Clawed Gauntlet',
    traits: base.traits.filter(trait => trait.toLowerCase() !== 'uncommon'),
    data: { ...base.data, rarity: 'common' },
    description: 'Four curved blades mounted over the fist give this close-combat gauntlet the appearance of claws.',
    updatedAt: 1,
  }] : []), ...(flyssa ? [{
    ...flyssa, id: 'homebrew:seax', source: 'homebrew' as const, name: 'Seax',
    description: 'A broad-backed blade with a long cutting edge and a sharp point, carried as both a tool and a close-quarters weapon.',
    updatedAt: 1,
  }] : [])]
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

export const UNTAMED_CLAWS: ContentEntry = {
  ...ANIMAL_FEATURE_CLAWS, id: 'supplemental:untamed-claws', name: 'Untamed Claws',
  description: 'Untamed Shift grants agile, finesse claws dealing 1d6 slashing damage. A free hand is required to attack.',
}

export const UNTAMED_JAWS: ContentEntry = {
  ...ANIMAL_FEATURE_JAWS, id: 'supplemental:untamed-jaws', name: 'Untamed Jaws',
  description: 'Untamed Shift grants jaws dealing 1d8 piercing damage.',
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

export const SUPPLEMENTAL_WEAPONS = [HAFT_STRIKER_WEAPON, OVERSIZED_THROW, FIST, IRON_FIST, ORC_TUSKS,
  CLAN_PISTOL, CLAN_DAGGER, CLAN_DAGGER_DEXTERITY, ANIMAL_FEATURE_CLAWS, ANIMAL_FEATURE_JAWS, UNTAMED_CLAWS, UNTAMED_JAWS, GAUNTLET]

export function homebrewCompanions(entries: ContentEntry[]): ContentEntry[] {
  const variants = [
    { id: 'homebrew:sarkorian-direwolf', name: 'Sarkorian Direwolf', base: 'Isgeri Boarhound', size: 'Medium',
      description: "A powerful, keen-nosed direwolf raised among Sarkoris's hunting traditions. It tracks quarry over rough ground and fights alongside its bonded partner." },
    { id: 'homebrew:snow-leopard', name: 'Snow Leopard', base: 'Cat', size: 'Small',
      description: 'A pale-furred mountain cat whose spotted coat blends with snow and stone. It stalks prey with patience, then closes in with a sudden pounce.' },
  ]
  return variants.flatMap<ContentEntry>((variant) => {
    const base = entries.find((entry) => entry.kind === 'companion' && entry.source === 'official' && entry.systems.includes('pf2e') && !entry.deleted && entry.name === variant.base)
    if (!base) return []
    const rename = (text: string) => variant.name === 'Sarkorian Direwolf'
      ? text.replace(/\b(?:Isgeri )?boarhound(s?)\b/gi, (match: string, plural: string) => {
        const noun = plural ? 'direwolves' : 'direwolf'
        return /^[A-Z]/.test(match) ? noun[0].toUpperCase() + noun.slice(1) : noun
      }) : text
    return [{
      ...base, id: variant.id, name: variant.name, source: 'homebrew',
      traits: base.traits.filter(trait => trait.toLowerCase() !== 'mount'),
      description: `${variant.description}\n\nStarts ${variant.size}.`,
      data: Object.fromEntries(Object.entries({ ...base.data, size: variant.size, mount: false, fixed_size: false })
        .map(([key, value]) => [key, typeof value === 'string' ? rename(value) : value])),
      // Fresh-device defaults must not supersede synced user edits or deletions.
      updatedAt: 1,
    }]
  })
}
