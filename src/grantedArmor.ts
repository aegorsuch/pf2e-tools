import { featTakenLevel } from './featChoices'
import type { Character, ContentEntry, OwnedArmor } from './types'
import { armorModifications } from './inventorArmor'

export const INVENTOR_ARMOR_ID = 'granted-armor:inventor'
export const HARDWOOD_ARMOR_ID = 'granted-armor:hardwood'
export const INVENTOR_SUITS = ['Power Suit', 'Subterfuge Suit'] as const
export const isGrantedArmor = (id: string) => id.startsWith('granted-armor:')
export const canWearWithAttachedArmor = (armor: OwnedArmor, body?: ContentEntry) =>
  !body || armor.id === body.id || body.data.flight_suit_allowed === true && /^Flight Suit(?: \([^)]+\))?$/i.test(armor.name)
export const automaticArmorFundamentals = (level: number, entry?: ContentEntry) => ({
  potency: entry?.data.automatic_fundamentals === false ? 0 : level >= 18 ? 3 : level >= 11 ? 2 : level >= 5 ? 1 : 0,
  resilient: entry?.data.automatic_fundamentals === false ? 0 : level >= 20 ? 3 : level >= 14 ? 2 : level >= 8 ? 1 : 0,
})

const STARFINDER_ARMOR_GRADES = [
  { name: 'Paragon', level: 20, ac: 3, resilient: 3, upgrades: 3 },
  { name: 'Ultimate', level: 18, ac: 3, resilient: 2, upgrades: 3 },
  { name: 'Elite', level: 14, ac: 2, resilient: 2, upgrades: 2 },
  { name: 'Superior', level: 11, ac: 2, resilient: 1, upgrades: 2 },
  { name: 'Advanced', level: 8, ac: 1, resilient: 1, upgrades: 1 },
  { name: 'Tactical', level: 5, ac: 1, resilient: 0, upgrades: 1 },
  { name: 'Commercial', level: 0, ac: 0, resilient: 0, upgrades: 0 },
] as const

export const starfinderArmorGrade = (level: number) =>
  STARFINDER_ARMOR_GRADES.find(grade => level >= grade.level) ?? STARFINDER_ARMOR_GRADES[6]

const BODY_ARMOR = [
  { ancestry: 'Automaton', feat: 'Reinforced Chassis', name: 'Reinforced Chassis', url: 'Feats.aspx?ID=3095' },
  { ancestry: 'Lizardfolk', heritage: 'Bakuwa Lizardfolk', name: 'Bakuwa Plates', url: 'Heritages.aspx?ID=377' },
  { ancestry: 'Conrasu', heritage: 'Rite of Reinforcement', name: 'Reinforced Exoskeleton', url: 'Heritages.aspx?ID=164' },
  { ancestry: 'Kashrishi', feat: 'Tough Skin', name: 'Tough Skin', url: 'Feats.aspx?ID=3969' },
  { ancestry: 'Surki', heritage: 'Hardshell Surki', name: 'Hardshell Carapace', url: 'Heritages.aspx?ID=311' },
  { ancestry: 'Nagaji', heritage: 'Titan Nagaji', name: 'Titan Scales', url: 'Heritages.aspx?ID=218' },
] as const

const armorEntry = (id: string, name: string, data: ContentEntry['data'], traits: string[], description: string): ContentEntry => ({
  id, name, kind: 'armor', systems: ['pf2e'], source: 'official', level: 0, traits, description,
  data: { armor_category: 'Medium', ...data }, effects: [], updatedAt: 1,
})

export function grantedArmorEntries(c: Character, innovation = c.subclass): ContentEntry[] {
  const active = c.feats.filter(feat => featTakenLevel(feat) <= c.level)
  const body = c.systems.includes('pf2e') ? BODY_ARMOR.find(source => source.ancestry === c.ancestry
    && ('feat' in source ? active.some(feat => feat.name === source.feat) : source.heritage === c.heritage))
    : undefined
  const chassis = body?.ancestry === 'Automaton'
  const entries: ContentEntry[] = body ? [armorEntry(`granted-armor:${body.ancestry.toLowerCase()}`, body.name, {
    attached: true, armor_group: 'Plate', ac: chassis ? c.level >= 10 ? 5 : c.level >= 5 ? 4 : 3 : 4,
    dex_cap: 1, check_penalty: chassis ? 0 : -2, speed_penalty: chassis ? 0 : -5,
    url: `https://2e.aonprd.com/${body.url}`,
    ...(chassis ? { fixed_material: 'Orichalcum' } : { strength: 3 }),
  }, chassis ? [] : body.ancestry === 'Lizardfolk' ? ['Aquadynamic', 'Comfort'] : ['Comfort'],
  'Attached medium plate armor. Cannot be removed or worn with other armor; accepts armor runes.')] : []
  if (hardwoodActive(c)) {
    const kineticist = c.className === 'Kineticist'
    entries.push(armorEntry(HARDWOOD_ARMOR_ID, kineticist ? 'Hardwood Armor' : 'Wooden Breastplate', {
      armor_group: 'Wood', ac: kineticist ? 3 : 4, dex_cap: kineticist ? 2 : 1,
      check_penalty: -2, speed_penalty: -5, strength: kineticist ? 2 : 3, bulk: kineticist ? 1 : 2,
      fixed_material: 'Duskwood', highest_armor_proficiency: kineticist,
    }, [], kineticist ? 'Hardwood Armor uses your highest armor proficiency.' : 'Wooden breastplate granted by Hardwood Armor.'))
  }
  if (c.systems.includes('sf2e')) {
    const shell = starfinderBodyArmor(c, name => active.some(feat => feat.name === name))
    if (shell) entries.push(shell)
  }
  const armorInnovation = c.className === 'Inventor' && innovation === 'Armor'
    || active.some(feat => feat.choice === 'Armor' && (feat.name === 'Inventor Dedication'
      || c.className === 'Inventor' && ['Second Innovation', 'Third Innovation'].includes(feat.name)))
  if (c.systems.includes('pf2e') && armorInnovation) {
    const power = c.inventorArmorSuit !== 'Subterfuge Suit'
    const heavy = power && armorModifications(c).some(mod => mod.name === 'Heavy Construction')
    entries.push(armorEntry(INVENTOR_ARMOR_ID, power ? 'Power Suit' : 'Subterfuge Suit', {
      innovation: true, armor_category: heavy ? 'Heavy' : 'Medium', armor_group: heavy ? 'Plate' : 'Composite',
      ac: power ? 5 : 2, dex_cap: power ? 1 : 4, check_penalty: power ? -2 : -1,
      speed_penalty: heavy ? -10 : power ? -5 : 0, strength: power ? 3 : 0,
      bulk: heavy ? 3 : power ? 2 : 1, medium_proficiency: heavy, url: 'https://2e.aonprd.com/Innovations.aspx?ID=1',
    }, heavy ? ['Bulwark', 'Entrench Melee', 'Entrench Ranged'] : [], 'Armor innovation. Accepts fundamental and property runes like ordinary armor.'))
  }
  return entries
}

export const hardwoodActive = (c: Character) => c.systems.includes('pf2e')
  && ['Ranger', 'Druid', 'Kineticist'].includes(c.className ?? '')
  && c.feats.some(feat => feat.name === 'Hardwood Armor' && featTakenLevel(feat) <= c.level)

export const hardwoodHasShield = (c: Character) => hardwoodActive(c) && c.className !== 'Ranger'

function starfinderBodyArmor(c: Character, hasFeat: (name: string) => boolean): ContentEntry | undefined {
  const ancestry = c.ancestry
  if (!ancestry) return undefined
  const grade = starfinderArmorGrade(c.level)
  const make = (name: string, url: string, data: ContentEntry['data'], traits: string[]): ContentEntry => ({
    ...armorEntry(`granted-armor:${ancestry.toLowerCase()}`, name, {
      attached: true, dex_cap: 1, check_penalty: -2, speed_penalty: 0,
      armor_group: 'Plate', ...data, url: `https://2e.aonsrd.com/${url}`,
      automatic_fundamentals: false, armor_grade: grade.name,
      base_ac: data.ac, ac: Number(data.ac) + grade.ac, grade_ac_bonus: grade.ac, grade_save_bonus: grade.resilient,
      upgrade_slots: data.upgrades_allowed === false ? 0 : Number(data.upgrade_slots ?? 0) + grade.upgrades,
    }, grade.resilient ? [...traits, 'Resilient'] : traits,
    'Attached body armor. Material is fixed; see source rules for armor runes, upgrades, and flight suits.'),
    systems: ['sf2e'], level: grade.level,
  })
  if (c.ancestry === 'Copaxi' && hasFeat('Armored Shell')) return make('Armored Shell', 'feats/1383-armored-shell', {
    ac: hasFeat('Enhanced Shell') ? 4 : 3, armor_category: 'Special', armor_group: '', strength: 3,
    min_proficiency: 1, runes_allowed: false, upgrades_allowed: hasFeat('Enhanced Shell'),
    upgrade_slots: hasFeat('Enhanced Shell') ? 2 : 0, flight_suit_allowed: true,
  }, ['Comfort', 'Exposed'])
  if (c.ancestry === 'Trox' && c.heritage === 'Fortified Trox') {
    const heavy = hasFeat('Heavy Exoskeleton')
    return make('Fortified Exoskeleton', 'ancestries/49-trox/heritages/270-fortified-trox', {
      ac: heavy ? 5 : 4, armor_category: heavy ? 'Heavy' : 'Medium', min_proficiency: 1, strength: 3,
      medium_proficiency: heavy, speed_penalty: heavy ? -10 : 0, ...(heavy ? { bulk: 3 } : {}),
      upgrades_allowed: false, flight_suit_allowed: true,
    }, heavy ? ['Bulwark', 'Comfort', 'Exposed'] : ['Analog', 'Comfort', 'Exposed'])
  }
  if (c.ancestry === 'Urog' && c.heritage === 'Crystal Carapace Urog') return make('Crystal Carapace', 'ancestries/50-urog/heritages/274-crystal-carapace-urog', {
    ac: 2, dex_cap: 2, check_penalty: -1, armor_category: 'Light', armor_group: 'Ceramic',
    min_proficiency: 1, upgrades_allowed: false, flight_suit_allowed: true,
  }, ['Archaic', 'Comfort', 'Flexible'])
  if (c.ancestry === 'Gnarefuroid' && c.heritage === 'Hullborne Gnarefuroid') return make('Hullborne Carapace', 'ancestries/54-gnarefuroid/heritages/300-hullborne-gnarefuroid', {
    ac: 3, dex_cap: 2, strength: 2, armor_group: 'Ceramic', upgrade_slots: 1,
  }, ['Analog', 'Comfort'])
  if (c.ancestry === 'Android' && c.heritage === 'Hellforged Android') {
    const hardened = hasFeat('Hardened Plates')
    return make('Hellforged Plates', 'ancestries/7-android/heritages/99-hellforged-android', {
      ac: hardened ? 6 : 5, dex_cap: 0, check_penalty: -3, speed_penalty: -10,
      strength: hardened ? 4 : 3, armor_category: hardened ? 'Heavy' : 'Medium', min_proficiency: 1,
    }, hardened ? ['Bulwark', 'Comfort'] : ['Comfort'])
  }
  if (c.ancestry === 'Khizar' && c.heritage === 'Petrified') return make('Petrified Bark', 'ancestries/21-khizar/heritages/90-petrified', {
    ac: 4, speed_penalty: -5, strength: 3,
  }, ['Bulwark', 'Comfort', 'Exposed'])
  if (c.ancestry === 'Barathu' && c.heritage === 'Rugged Explorer Barathu') return make('Rugged Explorer Shell', 'ancestries/8-barathu/heritages/107-rugged-explorer-barathu', {
    ac: c.level >= 5 ? 3 : 2, dex_cap: 2, strength: 2, armor_group: 'Composite', min_proficiency: 1,
    upgrades_allowed: false, flight_suit_allowed: true,
  }, ['Comfort', 'Exposed'])
  if (c.ancestry === 'Vesk' && c.heritage === 'Plated Vesk') return make('Vesk Plates', 'ancestries/15-vesk/heritages/66-plated-vesk', {
    ac: c.level >= 5 ? 4 : 3, strength: 3, upgrades_allowed: false, flight_suit_allowed: true,
  }, ['Comfort', 'Exposed'])
}
