export type GameSystem = 'pf2e' | 'sf2e'
export type EntryKind =
  | 'feat' | 'weapon' | 'armor' | 'spell' | 'item' | 'ancestry' | 'class'
  | 'shield' | 'armorGroup' | 'weaponGroup' | 'background' | 'heritage' | 'deity' | 'classFeature' | 'language'
  | 'companion' | 'companionSpec' | 'companionAdv' | 'subclass' | 'familiar'
export type Source = 'official' | 'homebrew'
export type HardlightGrade = 'Commercial' | 'Tactical' | 'Advanced' | 'Superior' | 'Elite' | 'Ultimate' | 'Paragon'

export type BonusType = 'circumstance' | 'status' | 'item' | 'untyped'
export type FeatSlotCategory = 'class' | 'ancestry' | 'skill' | 'general' | 'archetype' | 'bonus'

// Effects a feat/item/ancestry grants; applied by the character calculator
export type Effect =
  | { type: 'sense'; sense: string; range?: number }
  | { type: 'bonus'; target: string; bonusType: BonusType; value: number }
  | { type: 'proficiency'; target: string; rank: 'trained' | 'expert' | 'master' | 'legendary' }
  | { type: 'speed'; movement: string; feet: number }
  | { type: 'resistance'; damage: string; value: number }
  | { type: 'language'; name: string }
  | { type: 'featSlot'; category: FeatSlotCategory; level: number; count: number }
  | { type: 'grant'; entryId: string }

// Gear the player owns and configures; names resolve to ContentEntry weapons/armor/shields
export interface OwnedWeapon {
  id: string
  name: string
  // Weapon potency (0-3) and striking (0 none, 1 striking, 2 greater, 3 major)
  potency: number
  striking: number
  runes: string[]
  material?: 'Duskwood' | 'Duskwood (Standard-Grade)' | 'Duskwood (High-Grade)' | 'Orichalcum' | 'Peachwood (Greater)' | 'Peachwood (Standard-Grade)' | 'Peachwood (High-Grade)' | 'Cold Iron (Low-Grade)' | 'Cold Iron (Standard-Grade)' | 'Cold Iron (High-Grade)' | 'Grisantian Hide (Standard-Grade)' | 'Grisantian Hide (High-Grade)'
  livingWeapon?: boolean
  verdantWeapon?: boolean
  stowed?: boolean
}
export interface OwnedArmor {
  id: string
  name: string
  potency: number
  // Resilient (0-3)
  resilient: number
  runes: string[]
  worn: boolean
  material?: 'Duskwood' | 'Duskwood (Standard-Grade)' | 'Duskwood (High-Grade)' | 'Orichalcum' | 'Grisantian Hide (Standard-Grade)' | 'Grisantian Hide (High-Grade)'
  gauntlet?: 'Gauntlet' | 'Spiked Gauntlet' | 'Bladed Gauntlet' | 'Clawed Gauntlet'
}
export interface OwnedShield {
  id: string
  name: string
  hardness: number
  hp: number
  damage: number
  raised: boolean
}

export interface FeatSlot {
  category: FeatSlotCategory
  level: number
  count: number
}

export interface SpellGrant {
  kind: 'innate' | 'focus'
  spells: string[]
  choice?: 'cantrip' | 'listed'
  tradition?: string
  rank?: number
  heightened?: boolean
  frequency?: string
  shared?: boolean
  ability?: keyof Character['abilities']
  dc?: 'higher-class-or-spell'
}

export interface ContentEntry {
  id: string
  // PF2e and SF2e are compatible: an entry can belong to one or both
  systems: GameSystem[]
  kind: EntryKind
  source: Source
  name: string
  level: number
  traits: string[]
  description: string
  // Kind-specific fields (e.g. damage, bulk, prerequisites, armor/weapon group id)
  data: Record<string, string | number | boolean>
  effects: Effect[]
  spellGrants?: SpellGrant[]
  updatedAt: number
  deleted?: boolean
}

export interface Character {
  id: string
  // Enabled rulesets; one or both
  systems: GameSystem[]
  name: string
  level: number
  ancestry?: string
  ethnicity?: string
  featAccessOverrides?: string[]
  className?: string
  subclass?: string
  heritage?: string
  // Druidic order, which grants a skill
  order?: string
  // The skill picked when the class grants a choice (e.g. Acrobatics or Athletics)
  classSkill?: string
  background?: string
  deity?: string
  blessing?: '' | 'Blessed Armament' | 'Blessed Shield' | 'Blessed Swiftness'
  sanctification?: 'Holy' | 'Unholy'
  blessedArmament?: { weaponId: string; rune: string }
  haftStrikerWeaponId?: string
  raging?: boolean
  activeFeatEffects?: string[]
  abilities: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>
  // Imported/picked feats by name; entryIds links to ContentEntry once matched
  // slot is set when the feat fills a slot from the slot planner (e.g. 'class:2:0')
  feats: { name: string; type: string; level: number; choice?: string; slot?: string; takenLevel?: number }[]
  skippedFeatSlots?: string[]
  dismissedFeatSlots?: string[]
  equipment: { name: string; qty: number }[]
  // Configured weapons, armor and shield; armor/shield fall back to equipment when unset
  weapons?: OwnedWeapon[]
  livingWeaponEnhancements?: Pick<OwnedWeapon, 'potency' | 'striking' | 'runes'>
  handwraps?: Pick<OwnedWeapon, 'potency' | 'striking' | 'runes'> & { kind?: 'hardlight'; grade?: HardlightGrade }
  armors?: OwnedArmor[]
  shield?: OwnedShield
  lores: { name: string; rank: number }[]
  languages: string[]
  // Original Pathbuilder data kept so nothing is lost on import
  imported?: { source: 'pathbuilder'; raw: unknown; unmapped: string[] }
  // IDs of ContentEntry picked (feats, gear, etc.)
  entryIds: string[]
  // Ability boost choices keyed by boost slot (e.g. 'ancestry:2', 'lvl5:0'); when set, abilities are derived from them
  boosts?: Record<string, keyof Character['abilities']>
  // Trained skill picks and skill increases keyed by level
  skillPicks?: string[]
  skillIncreases?: Record<string, string>
  // Legacy skill-rank overrides; saves and Perception are always derived from class/features
  rankOverrides?: Record<string, number>
  spellcasting?: { ability: keyof Character['abilities']; tradition: string; rank: number; slots: Record<string, number> }
  spells?: { name: string; rank: number; cantrip: boolean; entryId?: string }[]
  activeSpells?: string[]
  innateSpellUses?: Record<string, number>
  animalFeature?: 'Cat Eyes' | 'Claws' | 'Fish Tail' | 'Jaws' | 'Owl Eyes' | 'Wings'
  animalFeatures?: NonNullable<Character['animalFeature']>[]
  animalStrengthWeapons?: Record<string, string>
  favoredTerrain?: string
  magicHideCompanionId?: string
  canopyCrawlerTarget?: 'Self' | 'Companion' | 'Both'
  canopyCrawlerCompanionId?: string
  enlargeCompanionSize?: 'Large' | 'Huge'
  enlargeCompanionId?: string
  // Minions: animal companions by type; advancement comes from feats such as Mature Animal Companion
  companions?: { id: string; name: string; type: string; auspiceServitor?: 'Celestial' | 'Fiend' | 'Monitor'; auspiceLanguage?: string }[]
  faithfulSteedGranted?: boolean
  // Manually added slots on top of those from class/ancestry and granted effects
  extraSlots: FeatSlot[]
  updatedAt: number
  deleted?: boolean
}
