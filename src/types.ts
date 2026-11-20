export type GameSystem = 'pf2e' | 'sf2e'
export const WORN_EQUIPMENT_GROUPS = [
  'Arms', 'Backpacks', 'Belt', 'Body', 'Boots', 'Bracelets', 'Chest', 'Cloaks', 'Clothing', 'Eyes', 'Eyewear',
  'Face', 'Feet', 'Gloves', 'Hands', 'Handwraps', 'Head', 'Headband', 'Headwear', 'Mask', 'Neck', 'Necklaces', 'Rings', 'Shoulders',
  'Throat', 'Torso', 'Wrists', 'Other Worn Items',
] as const
export const EQUIPMENT_GROUPS = ['Arrows', 'Bolts', 'Bullets', 'Grafts', 'Other equipment', 'Poisons', 'Tattoos', ...WORN_EQUIPMENT_GROUPS] as const
export type EquipmentGroupName = typeof EQUIPMENT_GROUPS[number]
export type EntryKind =
  | 'feat' | 'weapon' | 'armor' | 'spell' | 'ritual' | 'item' | 'ancestry' | 'class'
  | 'shield' | 'armorGroup' | 'weaponGroup' | 'background' | 'heritage' | 'deity' | 'classFeature' | 'language'
  | 'companion' | 'companionSpec' | 'companionAdv' | 'subclass' | 'familiar' | 'trait'
export type Source = 'official' | 'homebrew'
export type WeaponMode = { id: string; damageType: string; traits: string[] }
export type HardlightGrade = 'Commercial' | 'Tactical' | 'Advanced' | 'Superior' | 'Elite' | 'Ultimate' | 'Paragon'
export type DroneCustomizationGrade = 'Commercial' | 'Tactical' | 'Advanced' | 'Superior'
export type DroneCustomization = { name: string; choice?: string; choice2?: string }
export type DroneChassis = 'Agile' | 'Imitator' | 'Powerful' | 'Surveillance' | 'Tank'
export type DroneProfile = {
  size?: Character['mechanicDroneSize']
  imitator?: Character['mechanicDroneImitator']
  racerSpeed?: Character['mechanicDroneRacerSpeed']
  customizations?: Character['mechanicDroneCustomizations']
}
export type MechanicEnergy = 'acid' | 'cold' | 'electricity' | 'fire' | 'sonic'
export type MedicMod = 'Numbing Analgesic' | 'Powerful Stimulant' | 'Protective Excretions' | 'Restorative Boost'
export type MechanicMine = {
  id?: string
  enduring?: boolean
  baseDamage?: 'fire' | 'piercing'
  damageType?: 'acid' | 'cold' | 'electricity' | 'fire' | 'sonic' | 'bludgeoning' | 'piercing' | 'slashing'
  bigBoom?: boolean
  bunkerBuster?: boolean
  incapacitant?: boolean
  smartMine?: boolean
  smartTargets?: string[]
  transmutativeCasing?: string
  exploitiveAssault?: string
  targeting?: boolean
  healing?: boolean
  bigBang?: boolean
  blackHole?: boolean
  medicMods?: MedicMod[]
  debilitation?: string[]
}

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
  // Weapon potency (0-4) and striking (0 none, 1 striking, 2 greater, 3 major, 4 mythic)
  potency: number
  striking: number
  runes: string[]
  upgrades?: string[]
  material?: string
  size?: 'Small' | 'Large' | 'Huge' | 'Gargantuan'
  livingWeapon?: boolean
  verdantWeapon?: boolean
  osteoArmament?: boolean
  inventorInnovation?: boolean
  inventorModifications?: Partial<Record<'initial' | 'breakthrough' | 'revolutionary' | 'manifold' | 'basic', string>> & {
    complexSimplicityTraits?: string[]
  }
  combinationForm?: 'Melee' | 'Ranged'
  weaponMode?: string
  stowed?: boolean
  cheekStored?: boolean
  cheekHolstered?: boolean
  handsHeld?: 1 | 2
  handPair?: number
  attachedWeapon?: 'Bayonet' | 'Reinforced Stock'
  attachedTo?: string
  capacityLoaded?: number
  briarSharpness?: number
  briarOakenResilienceActive?: boolean
  coldstarForm?: 'Paired' | 'Flame' | 'Frost' | 'Merged'
  azlantiBond?: 0 | 1 | 2
}
export interface OwnedArmor {
  id: string
  name: string
  potency: number
  // Resilient (0-3)
  resilient: number
  runes: string[]
  worn: boolean
  material?: 'Duskwood' | 'Duskwood (Standard-Grade)' | 'Duskwood (High-Grade)' | 'Orichalcum' | 'Grisantian Hide' | 'Grisantian Hide (Standard-Grade)' | 'Grisantian Hide (High-Grade)'
  gauntlet?: 'Gauntlet' | 'Spiked Gauntlet' | 'Bladed Gauntlet' | 'Clawed Gauntlet'
}

export type CompanionEquipmentSlot = 'Barding' | 'Collar' | 'Saddle' | 'Shoes' | 'Other'
export interface CompanionEquipment {
  entryId: string
  name: string
  qty: number
}
export type CompanionEquipmentSet = Partial<Record<Exclude<CompanionEquipmentSlot, 'Other'>, CompanionEquipment>> & {
  Other?: CompanionEquipment[] | CompanionEquipment
}
export interface OwnedShield {
  id: string
  name: string
  equipped?: boolean
  hardness: number
  hp: number
  damage: number
  raised: boolean
  takingCover?: boolean
  attachedWeapon?: OwnedWeapon
  material?: { name: string; hardness?: number; hp?: number }
  reinforcingRune?: 'Minor' | 'Lesser' | 'Moderate' | 'Greater' | 'Major' | 'Supreme'
}

export interface FeatSlot {
  category: FeatSlotCategory
  level: number
  count: number
}

export interface SpellGrant {
  kind: 'innate' | 'focus' | 'feat'
  spells: string[]
  choice?: 'cantrip' | 'listed'
  tradition?: string
  rank?: number
  heightened?: boolean
  fixedRank?: boolean
  frequency?: string
  condition?: string
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
  choiceDescriptions?: { text: string; options: Record<string, string> }[]
  comparisonRules?: string
  // Kind-specific fields (e.g. damage, bulk, prerequisites, armor/weapon group id)
  data: Record<string, string | number | boolean>
  effects: Effect[]
  spellGrants?: SpellGrant[]
  ritualGrants?: string[]
  weaponModes?: WeaponMode[]
  featLinks?: { name: string; url: string }[]
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
  achievements?: string[]
  featAccessOverrides?: string[]
  gearAccessOverrides?: string[]
  className?: string
  subclass?: string
  fatalMethod?: 'Puppeteer' | 'Reaper'
  heritage?: string
  testSubjectAdaptation?: 'Cybernetic Augmentation' | 'Extra Limbs' | 'Psychic Augmentation' | 'Radioactive'
  activeHandPair?: number
  ysokiDailyUses?: { contaminate?: boolean; retinalHud?: boolean }
  dailyFeatUses?: Record<string, boolean>
  hourlyFeatUses?: Record<string, boolean>
  monthlyFeatUses?: Record<string, boolean>
  pioneerEnvironment?: 'Cold' | 'Heat'
  pioneerTerrain?: string
  // Druidic order, which grants a skill
  order?: string
  // The skill picked when the class grants a choice (e.g. Acrobatics or Athletics)
  classSkill?: string
  subclassSkillChoices?: Record<string, string>
  witchwarper?: {
    anchor?: 'Core Memories' | 'Focal Point' | 'Tangible Object'
    coreMemorySkill?: string
    movingInQuantumField?: boolean
  }
  rogueRacketSkills?: Record<string, string>
  background?: string
  backgroundTerrainLore?: Record<string, string>
  backgroundLores?: Record<string, string[]>
  backgroundSkillChoices?: Record<string, string>
  deity?: string
  divineIntercessions?: Record<string, string[]>
  inactiveDivineBoonFeats?: Character['feats']
  blessing?: '' | 'Blessed Armament' | 'Blessed Shield' | 'Blessed Swiftness'
  sanctification?: 'Holy' | 'Unholy'
  legacyTenetsOfGood?: boolean
  devotionSpell?: 'Lay on Hands' | 'Touch of the Void' | 'Shields of the Spirit'
  blessedArmament?: { weaponId: string; rune: string }
  inventiveOffensive?: { weaponId: string; traits: string[] }
  haftStrikerWeaponId?: string
  raging?: boolean
  giantWeaponId?: string
  giantRagingResistance?: 'Cold' | 'Electricity' | 'Fire'
  parrying?: boolean
  activeStance?: string
  intensifiedElement?: { element: 'Earth' | 'Fire' | 'Metal' | 'Water' | 'Wood'; legendary?: boolean; used?: boolean }
  activeFeatEffects?: string[]
  currentSpell?: 'air' | 'water' | 'air and water'
  hardenFleshActive?: boolean
  focusPointsSpentSinceRefocus?: number
  abilities: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>
  // Imported/picked feats by name; entryIds links to ContentEntry once matched
  // slot is set when the feat fills a slot from the slot planner (e.g. 'class:2:0')
  feats: { name: string; type: string; level: number; choice?: string; sourceId?: string; replacements?: string[]; culturalWeapon?: boolean; rareWeaponOverride?: boolean; slot?: string; takenLevel?: number }[]
  skippedFeatSlots?: string[]
  dismissedFeatSlots?: string[]
  equipment: { name: string; qty: number; group?: EquipmentGroupName | 'Belts' | 'Waist'; cheekQty?: number; cheekPreparedQty?: number; mechanicRigQty?: number; mechanicMedicMods?: MedicMod[]; mechanicItemId?: string }[]
  simplePoisonsSpent?: number
  augmentations?: { id: string; entryId: string; name: string; slot: string }[]
  hardpointWeaponId?: string
  dermalPlating?: { grade?: HardlightGrade; raised?: boolean; damaged?: boolean }
  secondaryPowerSourceIds?: string[]
  secondaryPowerUses?: Record<string, number>
  formulas?: string[]
  snareFormulaChoices?: string[]
  snareAdvancementFormulaChoices?: string[]
  gadgetFormulaChoices?: string[]
  gadgetPreparations?: string[]
  gadgetUsed?: boolean[]
  grenadeFormulaChoices?: string[]
  grenadePreparations?: string[]
  grenadeUsed?: boolean[]
  mechanicGrenadeMods?: Record<string, {
    bigBoom?: boolean
    bunkerBuster?: boolean
    incapacitant?: boolean
    longRange?: boolean
    damageType?: 'acid' | 'cold' | 'electricity' | 'fire' | 'sonic' | 'bludgeoning' | 'piercing' | 'slashing'
    transmutativeCasing?: string
    exploitiveAssault?: string
  }>
  mechanicTurretArray?: 'Chaingun' | 'Disintegrator' | 'Laser Beam' | 'Thunderclap' | 'Volt Thrower' | 'Zero Emitter'
  mechanicTurretGrade?: HardlightGrade
  mechanicTurretUpgrades?: string[]
  mechanicMines?: { carried: number; deployed: number }
  mechanicGlitching?: Record<string, number>
  mechanicEnduringMod?: { item: string; mod: string; kind?: 'weapon' | 'grenade' | 'armor' | 'drone' | 'mine' | 'medic' | 'exo'; label?: string; value?: string | Array<string | null> }
  mechanicEnduringMine?: MechanicMine
  mechanicCarriedMines?: MechanicMine[]
  mechanicDeployedMines?: MechanicMine[]
  mechanicExocortexDebilitation?: string[]
  mechanicDroneChassis?: DroneChassis
  mechanicDroneBaseChassis?: DroneChassis
  mechanicDroneProfiles?: Partial<Record<DroneChassis, DroneProfile>>
  mechanicDroneSize?: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'
  mechanicDroneImitator?: {
    species?: string
    attack?: string
    damageType?: string
    speed?: Partial<Record<'Land' | 'Climb' | 'Swim' | 'Fly' | 'Burrow', number>>
  }
  mechanicDroneRacerSpeed?: 'Land' | 'Swim' | 'Fly'
  mechanicDroneCustomizations?: Partial<Record<DroneCustomizationGrade, DroneCustomization[]>>
  mechanicDroneAssistantActive?: boolean
  mechanicDroneWeapons?: OwnedWeapon[]
  mechanicDroneHeldWeaponIds?: string[]
  mechanicDroneArmorUpgrades?: string[]
  mechanicDroneForceFields?: Record<string, { hp: number; active: boolean; coolingDown: boolean }>
  mechanicDroneHp?: number
  mechanicDroneTemporaryHp?: number
  mechanicDroneEmergencyRepairUsed?: boolean
  mechanicDroneEnergyShielding?: Record<string, Exclude<MechanicEnergy, 'sonic'>>
  mechanicDroneKillbotActive?: boolean
  mechanicDroneDesperateRepairActive?: boolean
  mechanicArmorMods?: Record<string, { magneticLevitators?: boolean; energyNeutralizer?: Array<MechanicEnergy | null> }>
  mechanicWeaponMods?: Record<string, {
    bigBoom?: boolean
    incapacitant?: boolean
    longRange?: boolean
    bunkerBuster?: boolean
    pinpointShot?: boolean
    explosiveShot?: boolean
    transmutativeCasing?: string
    exploitiveAssault?: string
    glitchPulse?: boolean
    damageType?: 'acid' | 'cold' | 'electricity' | 'fire' | 'sonic' | 'bludgeoning' | 'piercing' | 'slashing'
  }>
  munitionsFormulaChoices?: string[]
  munitionsPreparations?: string[]
  munitionsUsed?: boolean[]
  brastlewarkFormulaMode?: 'standard' | 'other'
  brastlewarkFormulaChoices?: string[]
  // Configured weapons, armor and shield; armor/shield fall back to equipment when unset
  weapons?: OwnedWeapon[]
  collapsedWeaponIds?: string[]
  livingWeaponEnhancements?: Pick<OwnedWeapon, 'potency' | 'striking' | 'runes'>
  playingCardEnhancements?: Pick<OwnedWeapon, 'potency' | 'striking' | 'runes'>
  handwraps?: Pick<OwnedWeapon, 'potency' | 'striking' | 'runes' | 'upgrades'> & { kind?: 'hardlight'; grade?: HardlightGrade }
  armors?: OwnedArmor[]
  inventorArmorSuit?: 'Power Suit' | 'Subterfuge Suit'
  inventorArmorModifications?: Partial<Record<'initial' | 'breakthrough' | 'revolutionary' | 'manifold' | 'basic', string>> & {
    enhanced?: string; incredible?: string; overdrive?: boolean; voidHealing?: boolean
  }
  warmask?: { worn?: boolean; attuned?: boolean; alternateSkill?: string }
  shield?: OwnedShield
  hardwoodShield?: { equipped?: boolean; raised?: boolean; damage?: number; reinforcingRune?: OwnedShield['reinforcingRune']; attachedWeapon?: OwnedWeapon }
  inventorBuckler?: Character['hardwoodShield']
  lores: { name: string; rank: number }[]
  languages: string[]
  // Original Pathbuilder data kept so nothing is lost on import
  imported?: { source: 'pathbuilder'; raw: unknown; unmapped: string[] }
  // IDs of ContentEntry picked (feats, gear, etc.)
  entryIds: string[]
  // Ability boost choices keyed by boost slot (e.g. 'ancestry:2', 'lvl5:0'); when set, abilities are derived from them
  boosts?: Record<string, keyof Character['abilities']>
  alternateAncestryBoosts?: boolean
  // Trained skill picks and skill increases keyed by level
  skillPicks?: string[]
  skillIncreases?: Record<string, string>
  skillTokenUpgrades?: { skill: string; rank: 2 | 3 | 4; level: number; payment: string[] }[]
  // Legacy skill-rank overrides; saves and Perception are always derived from class/features
  rankOverrides?: Record<string, number>
  spellcasting?: {
    ability: keyof Character['abilities']; tradition: string; rank: number; slots: Record<string, number>
    prepared?: Record<string, string>
    spentSlots?: string[]
    repertoire?: Record<string, string>
    signatureSpells?: Record<string, string>
  }
  beckoningDirge?: { spell?: string; rank?: number; used?: boolean }
  minorMagic?: { tradition?: 'Arcane' | 'Divine' | 'Occult' | 'Primal'; cantrips?: Partial<Record<'Arcane' | 'Divine' | 'Occult' | 'Primal', string[]>> }
  mageAutomatonCantrip?: string
  gnomeHeritageMagic?: { tradition?: 'Arcane' | 'Divine' | 'Occult'; cantrips?: Partial<Record<'Arcane' | 'Divine' | 'Occult' | 'Primal', string>> }
  spells?: { name: string; rank: number; cantrip: boolean; entryId?: string }[]
  rituals?: string[]
  activeSpells?: string[]
  pyreResistEnergy?: { damage: 'acid' | 'cold' | 'electricity' | 'fire' | 'sonic'; value?: number }
  boneShieldRaised?: boolean
  dinosaurForm?: { form: string; rank: number }
  untamedForm?: {
    form?: string
    shape?: string
    rank?: number
    originalDuration?: '1 minute' | '10 minutes' | '24 hours' | '1 hour' | 'unlimited'
  }
  dragonShapeResistance?: 'bludgeoning' | 'poison'
  oakenResilienceRank?: number
  falseVitalityRank?: number
  spentFocusPoints?: number[]
  innateSpellUses?: Record<string, number | number[]>
  itemSpellUses?: Record<string, number[]>
  dailyAbilityUses?: Record<string, boolean>
  animalFeature?: 'Cat Eyes' | 'Claws' | 'Fish Tail' | 'Jaws' | 'Owl Eyes' | 'Wings'
  animalFeatures?: NonNullable<Character['animalFeature']>[]
  untamedShiftEffects?: ('Claws' | 'Jaws' | 'Elemental' | 'Plant' | 'Wings')[]
  animalStrengthWeapons?: Record<string, string>
  favoredTerrain?: string
  magicHideCompanionId?: string
  canopyCrawlerTarget?: 'Self' | 'Companion' | 'Both'
  canopyCrawlerCompanionId?: string
  enlargeCompanionSize?: 'Large' | 'Huge'
  enlargeCompanionId?: string
  apexCompanionId?: string
  mountedCompanionId?: string
  // Companions and their equipped gear
  companions?: { id: string; name: string; type: string; equipment?: CompanionEquipmentSet; supportActive?: boolean;
    auspiceServitor?: 'Celestial' | 'Fiend' | 'Monitor'; auspiceSubtype?: 'Angel' | 'Devil'; auspiceLanguage?: string;
    mascotLanguage?: string; mascotBannerAffixed?: boolean; paleHorse?: 'Fire' | 'Poison' | 'Void'; spiritAspect?: 'Might' | 'Swiftness' | 'Insight' }[]
  familiar?: { name?: string; leshyAbility?: 'Plant' | 'Fungus'; leshySecret?: 'Grasping Tendrils' | 'Purify Air' | 'Verdant Burst'; abilities?: string[]; abilityOptions?: { resistance?: string[]; skilled?: string[]; fastMovement?: string }; oakenResilienceActive?: boolean; oakenResilienceRank?: number }
  waspFamiliar?: Character['familiar']
  pet?: { name?: string; aquatic?: boolean; abilities?: string[] }
  faithfulSteedGranted?: boolean
  // Manually added slots on top of those from class/ancestry and granted effects
  extraSlots: FeatSlot[]
  updatedAt: number
  deleted?: boolean
}
