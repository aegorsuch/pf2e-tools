import { ancestryFeatTraits, featTakenLevel, selectedFeatEntry } from './featChoices'
import type { Character, ContentEntry } from './types'

interface FamiliarityRule {
  trait?: string
  weapons?: string[]
  access?: string[]
  accessOnlyTrait?: boolean
  trained?: boolean
  advanced?: false | 'Simple'
  choice?: 'Sword' | 'Axe or Hammer'
}

const RULES: Record<string, FamiliarityRule> = {
  'Dwarven Weapon Familiarity': { trait: 'Dwarf', weapons: ['Battle Axe', 'Pick', 'Warhammer'] },
  'Elven Weapon Familiarity': { trait: 'Elf', weapons: ['Longbow', 'Composite Longbow', 'Rapier', 'Shortbow', 'Composite Shortbow'] },
  'Warrior Fadrim': { weapons: ['Longbow', 'Composite Longbow', 'Rapier', 'Shortbow', 'Composite Shortbow', 'Shortsword'] },
  'Gnome Weapon Familiarity': { trait: 'Gnome', weapons: ['Glaive', 'Kukri'], access: ['Kukri'] },
  'Goblin Weapon Familiarity': { trait: 'Goblin' },
  'Halfling Weapon Familiarity': { trait: 'Halfling', weapons: ['Sling', 'Shortsword'] },
  'Orc Weapon Familiarity': { trait: 'Orc', weapons: ['Falchion', 'Greataxe'] },
  'Vesk Weapon Familiarity': { trait: 'Vesk', trained: true },
  'Catfolk Weapon Familiarity': { trait: 'Catfolk', weapons: ['Kama', 'Kukri', 'Scimitar', 'Sickle'] },
  'Hobgoblin Weapon Familiarity': { trait: 'Hobgoblin', weapons: ['Composite Longbow', 'Composite Shortbow', 'Glaive', 'Longbow', 'Longsword', 'Shortbow'] },
  'Kholo Weapon Familiarity': { trait: 'Kholo', weapons: ['Flail', 'Khopesh', 'Mambele', 'War Flail'] },
  'Kobold Weapon Familiarity': { trait: 'Kobold', weapons: ['Greatpick', 'Light Pick', 'Pick'] },
  'Tripkee Weapon Familiarity': { trait: 'Tripkee', weapons: ['Blowgun', 'Dart', 'Hatchet', 'Scythe', 'Shortbow'] },
  'Jotunborn Weapon Familiarity': { trait: 'Jotunborn', weapons: ['Bola', 'Greataxe', 'Halberd', 'Maul', 'Longspear', 'War Flail'] },
  'Athamaru Weapon Familiarity': { trait: 'Athamaru', weapons: ['Crossbow', 'Heavy Crossbow', 'Longspear', 'Spear', 'Trident'], advanced: false },
  'Centaur Weapon Familiarity': { weapons: ['Lance', 'Longbow', 'Longspear', 'Shortbow', 'Spear'], advanced: false },
  'Merfolk Weapon Familiarity': { trait: 'Merfolk', accessOnlyTrait: true, weapons: ['Crossbow', 'Heavy Crossbow', 'Longspear', 'Spear', 'Trident'] },
  'Minotaur Weapon Familiarity': { weapons: ['Battle Axe', 'Falchion', 'Glaive', 'Greataxe'], advanced: false },
  'Surki Weapon Familiarity': { weapons: ['Pick', 'Light Hammer', 'Sickle', 'Scythe'], choice: 'Axe or Hammer' },
  'Tengu Weapon Familiarity': { trait: 'Tengu', weapons: ['Katana', 'Khakkara', 'Khakkhara', 'Temple Sword', 'Wakizashi'],
    access: ['Katana', 'Khakkara', 'Khakkhara', 'Temple Sword', 'Wakizashi'], choice: 'Sword' },
  'Duskwalker Weapon Familiarity': { weapons: ['Bo Staff', 'Longbow', 'Composite Longbow', 'Scythe', 'Staff'] },
  'Viking Weapon Familiarity': { weapons: ['Battle Axe', 'Hatchet', 'Longsword', 'Shield Boss', 'Shield Spikes', 'Shortsword'], advanced: 'Simple' },
  'Oni Weapon Familiarity': { weapons: ['Khakkhara', 'Nodachi', 'Ogre Hook', 'Tetsubo'], advanced: 'Simple' },
  'Wayang Weapon Familiarity': { weapons: ['Blowgun', 'Fighting Fan', 'Kris', 'Longspear', 'Machete', 'Sai', 'Trident'],
    access: ['Blowgun', 'Fighting Fan', 'Kris', 'Longspear', 'Machete', 'Sai', 'Trident'] },
  'Bugbear Weapon Familiarity': { weapons: ['Bastard Sword', 'Capturing Spetum', 'Falchion', 'Scourge', 'Scythe', 'Whip'], access: ['Capturing Spetum'] },
  'Genie Weapon Familiarity': { trait: 'Geniekin', weapons: ['Falchion', 'Ranseur', 'Scimitar', 'Trident'], trained: true },
  'Azarketi Weapon Familiarity': { trait: 'Azarketi', weapons: ['Crossbow', 'Hand Crossbow', 'Longspear', 'Spear', 'Trident'], trained: true },
  'Conrasu Weapon Familiarity': { trait: 'Conrasu', weapons: ['Composite Shortbow', 'Glaive', 'Longspear', 'Longsword', 'Shortbow', 'Spear'], trained: true },
  'Ghoran Weapon Familiarity': { trait: 'Ghoran', weapons: ['Glaive', 'Greatclub', 'Hatchet', 'Scythe', 'Sickle'], trained: true },
  'Vanara Weapon Familiarity': { trait: 'Vanara', weapons: ['Bo Staff', 'Chakram', 'Katar', 'Panabas', 'Urumi'],
    access: ['Bo Staff', 'Chakram', 'Katar', 'Panabas', 'Urumi'], trained: true },
  'Vishkanya Weapon Familiarity': { trait: 'Vishkanya', weapons: ['Blowgun', 'Fighting Fan', 'Kris', 'Kukri', 'Shuriken'],
    access: ['Blowgun', 'Fighting Fan', 'Kris', 'Kukri', 'Shuriken'], trained: true },
}

const key = (name: string) => name.replace(/^Finesse Scimitar$/, 'Scimitar').toLowerCase().replace(/[^a-z0-9]/g, '')
const named = (names: string[] | undefined, weapon: ContentEntry) => names?.some(name => key(name) === key(weapon.name)) ?? false
const DWARF_STARFINDER_WEAPONS = ['Artillery Laser', 'Breaching Gun', 'Hammer', 'Machine Gun', 'Roto Laser', 'Stellar Cannon']
const gradeFamilies = new WeakMap<ContentEntry[], Map<string, Set<string>>>()

function gradeFamilyNames(entries: ContentEntry[], weapon: ContentEntry) {
  const family = weapon.data.weapon_grade_family ?? weapon.data.url
  if (!weapon.systems.includes('sf2e') || typeof family !== 'string' || !family) return undefined
  let families = gradeFamilies.get(entries)
  if (!families) {
    families = new Map()
    for (const entry of entries) {
      const entryFamily = entry.data.weapon_grade_family ?? entry.data.url
      if (entry.kind !== 'weapon' || entry.deleted || !entry.systems.includes('sf2e')
        || typeof entryFamily !== 'string' || !entryFamily) continue
      const names = families.get(entryFamily) ?? new Set<string>()
      names.add(key(entry.name))
      families.set(entryFamily, names)
    }
    gradeFamilies.set(entries, families)
  }
  return families.get(family)
}

export const uncommonWeapon = (weapon: ContentEntry) => !/^(rare|unique)$/i.test(String(weapon.data.rarity))
  && !weapon.traits.some(trait => /^(rare|unique)$/i.test(trait))
  && (String(weapon.data.rarity).toLowerCase() === 'uncommon' || weapon.traits.some(trait => trait.toLowerCase() === 'uncommon'))

export function familiarityChoiceOptions(name: string, c: Character, entries: ContentEntry[]) {
  const choice = RULES[name]?.choice
  if (!choice) return undefined
  return [...new Set(entries.filter(entry => entry.kind === 'weapon' && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system))
    && (choice === 'Sword' ? String(entry.data.weapon_group).toLowerCase() === 'sword'
      && [...(c.weapons ?? []), ...c.equipment.filter(item => item.qty > 0)].some(owned => owned.name === entry.name)
      : /^(axe|hammer)$/i.test(String(entry.data.weapon_group)) && !uncommonWeapon(entry)
        && !entry.traits.some(trait => /^(rare|unique)$/i.test(trait)) && !/^(rare|unique)$/i.test(String(entry.data.rarity))))
    .map(entry => entry.name))].sort((a, b) => a.localeCompare(b))
}

function ancestralFamiliaritySource(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  if (feat.name !== 'Ancestral Weapon Familiarity' || !c.systems.includes('sf2e')) return undefined
  const level = Math.min(c.level, featTakenLevel(feat))
  const entry = selectedFeatEntry({ ...c, level }, entries, feat.name, feat.sourceId)
  const ancestry = entry?.traits.find(trait => ancestryFeatTraits({ ...c, level }).includes(trait.toLowerCase()))
  if (entry?.systems.includes('sf2e') && ancestry) return { entry, ancestry }
}

export function isFixedAncestralWeaponFamiliarity(c: Character, entries: ContentEntry[], feat: Character['feats'][number]) {
  const source = ancestralFamiliaritySource(c, entries, feat)
  return !!source && key(source.ancestry) !== 'astrazoan'
    && !/traditional weapons of another ancestry/i.test(source.entry.description)
}

export function weaponFamiliarity(c: Character, weapon: ContentEntry, category: 'Simple' | 'Martial' | 'Advanced' | 'Unarmed', entries: ContentEntry[] = []) {
  const access: string[] = []
  let proficiency: 'Simple' | 'Martial' | undefined
  let trained = false
  let expertise = false
  let criticalSpecialization = false
  let pirateCriticalSpecialization = false
  for (const feat of c.feats) {
    if (featTakenLevel(feat) > c.level) continue
    if (feat.name === 'Space Pirate Dedication' && c.systems.includes('sf2e')) {
      const familyNames = gradeFamilyNames(entries, weapon)
      const names = [weapon.name, String(weapon.data.proficiency_base ?? ''), ...(familyNames ?? [])]
      if (names.some(name => /(?:cutlass|flail|rapier)\b/i.test(name))
        || weapon.traits.some(trait => /^razing(?:\s|$)/i.test(trait))) {
        if (category === 'Martial') proficiency = 'Simple'
        else if (category === 'Advanced' && proficiency !== 'Simple') proficiency = 'Martial'
        pirateCriticalSpecialization = true
      }
      continue
    }
    if (feat.name === 'Explosive Savant') {
      const group = String(weapon.data.weapon_group).toLowerCase()
      if (group === 'bomb' || weapon.traits.some(trait => trait.toLowerCase() === 'bomb')
        || group === 'firearm' && category === 'Martial') proficiency = 'Simple'
      else if (group === 'firearm' && category === 'Advanced' && proficiency !== 'Simple') proficiency = 'Martial'
      continue
    }
    if (feat.name === 'Ancestral Weapon Familiarity' && c.systems.includes('sf2e')) {
      const source = ancestralFamiliaritySource(c, entries, feat)
      if (!source || !isFixedAncestralWeaponFamiliarity(c, entries, feat)) continue
      const options = /Option\(s\):\s*([^\n]*)/i.exec(source.entry.description)?.[1] ?? ''
      const ancestralTrait = weapon.traits.some(trait => key(trait) === key(source.ancestry))
      const dwarfStarfinder = key(source.ancestry) === 'dwarf'
      const group = key(String(weapon.data.weapon_group ?? ''))
      const listedNames = [...(dwarfStarfinder ? DWARF_STARFINDER_WEAPONS : []), ...options.split(/\s*,\s*|\s+or\s+/i)]
      const familyNames = gradeFamilyNames(entries, weapon)
      const dwarfWeapon = dwarfStarfinder && DWARF_STARFINDER_WEAPONS.some(name =>
        key(name) === key(weapon.name) || familyNames?.has(key(name)))
      const matchesList = listedNames.some(name => key(name) === key(weapon.name) || familyNames?.has(key(name)))
        || /\ball bows\b/i.test(options) && group === 'bow'
        || /\baxes\b/i.test(options) && group === 'axe'
        || /\bany doshko\b/i.test(options) && /\bdoshko\b/i.test(weapon.name)
        || /\bany pick\b/i.test(options) && group === 'pick'
      if ((ancestralTrait || dwarfWeapon) && uncommonWeapon(weapon)) access.push(feat.name)
      if (ancestralTrait || matchesList) {
        if (category === 'Martial') proficiency = 'Simple'
        else if (category === 'Advanced' && proficiency !== 'Simple') proficiency = 'Martial'
        criticalSpecialization ||= c.level >= 5
      }
      continue
    }
    const rule = RULES[feat.name]
    if (!rule) continue
    const doshko = feat.name === 'Vesk Weapon Familiarity' && /\bdoshko\b/i.test(weapon.name)
    const trait = !!rule.trait && weapon.traits.some(trait => trait.toLowerCase() === rule.trait!.toLowerCase())
    if (trait && uncommonWeapon(weapon) || named(rule.access, weapon)) access.push(feat.name)
    const selection = !!feat.choice && key(feat.choice) === key(weapon.name)
      && !!familiarityChoiceOptions(feat.name, c, [weapon])?.includes(weapon.name)
    if (!(trait && !rule.accessOnlyTrait || named(rule.weapons, weapon) || doshko || selection
      || feat.name === 'Oni Weapon Familiarity' && /horns/i.test(weapon.name) && category === 'Unarmed')) continue
    if (category === 'Martial' || category === 'Advanced' && rule.advanced === 'Simple') proficiency = 'Simple'
    else if (category === 'Advanced' && rule.advanced !== false && proficiency !== 'Simple') proficiency = 'Martial'
    trained ||= !!rule.trained && (named(rule.weapons, weapon) || doshko)
    expertise ||= !!rule.trained && c.feats.some(other => other.name === feat.name.replace('Familiarity', 'Expertise') && featTakenLevel(other) <= c.level)
    criticalSpecialization ||= (!rule.trained || feat.name === 'Vesk Weapon Familiarity') && c.level >= 5 && feat.name !== 'Jotunborn Weapon Familiarity'
  }
  return { access, proficiency, trained, expertise, criticalSpecialization, pirateCriticalSpecialization }
}
