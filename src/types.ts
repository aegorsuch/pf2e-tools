export type GameSystem = 'pf2e' | 'sf2e'
export type EntryKind =
  | 'feat' | 'weapon' | 'armor' | 'spell' | 'item' | 'ancestry' | 'class'
  | 'armorGroup' | 'weaponGroup' | 'background' | 'heritage' | 'deity'
export type Source = 'official' | 'homebrew'

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

export interface FeatSlot {
  category: FeatSlotCategory
  level: number
  count: number
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
  className?: string
  heritage?: string
  background?: string
  deity?: string
  abilities: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>
  // Imported/picked feats by name; entryIds links to ContentEntry once matched
  // slot is set when the feat fills a slot from the slot planner (e.g. 'class:2:0')
  feats: { name: string; type: string; level: number; choice?: string; slot?: string }[]
  equipment: { name: string; qty: number }[]
  lores: { name: string; rank: number }[]
  languages: string[]
  // Original Pathbuilder data kept so nothing is lost on import
  imported?: { source: 'pathbuilder'; raw: unknown; unmapped: string[] }
  // IDs of ContentEntry picked (feats, gear, etc.)
  entryIds: string[]
  // Ability boost choices keyed by boost slot (e.g. 'ancestry:2', 'lvl5:0'); when set, abilities are derived from them
  boosts?: Record<string, keyof Character['abilities']>
  // Extra trained skills picked from the class allotment, and skill increases keyed by level
  skillPicks?: string[]
  skillIncreases?: Record<string, string>
  // Manual rank (0-4) per skill/save/perception, for class features not modelled
  rankOverrides?: Record<string, number>
  spellcasting?: { ability: keyof Character['abilities']; tradition: string; rank: number; slots: Record<string, number> }
  spells?: { name: string; rank: number; cantrip: boolean; entryId?: string }[]
  // Manually added slots on top of those from class/ancestry and granted effects
  extraSlots: FeatSlot[]
  updatedAt: number
  deleted?: boolean
}
