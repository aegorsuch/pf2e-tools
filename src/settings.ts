import { useSyncExternalStore } from 'react'

export interface Settings {
  singleAdditionalArms: boolean
  singleAugmentedBody: boolean
  singleDistantTelepath: boolean
  adoptedDwarfClanDagger: boolean
  disableAdoptedAncestry: boolean
  disableAncientElfMultitalented: boolean
  disableBeastmasterWardenSpells: boolean
  exclusiveCyborgHearts: boolean
  cyberbornTestSubjectFeat: boolean
  // House rule: skills a class (or druid order) grants also rank up for free as the level allows
  autoClassSkills: boolean
  sf2eDeitySkills: boolean
  // House rule: Order Explorer grants training in the explored order's skill
  orderExplorerSkills: boolean
  // House rule: the character's Lore skills also rank up for free as the level allows
  autoLores: boolean
  deityLore: boolean
  // Variant rule: Free Archetype grants an archetype feat at every even level
  freeArchetype: boolean
  ignoreArchetypeFeatMinimums: boolean
  // House rule: Rangers get Snarecrafter Dedication for free at level 2, locked in the Dedications section
  rangerSnarecrafter: boolean
  warriorLegendClearTheWay: boolean
  orcTattooedHistorian: boolean
  dwarfStalwartDefender: boolean
  // House rules: Champions, Commanders, Druids, and Rangers get Cavalier Dedication for free at level 2
  championCavalier: boolean
  commanderCavalier: boolean
  commanderCaptain: boolean
  druidCavalier: boolean
  rangerCavalier: boolean
  // House rules: Champions, Commanders, Druids, and Rangers get Beastmaster Dedication for free at level 2
  championBeastmaster: boolean
  commanderBeastmaster: boolean
  druidBeastmaster: boolean
  rangerBeastmaster: boolean
  // House rules: Bards get Animal Trainer, Beastmaster and Cavalier Dedications for free at level 2
  bardAnimalTrainer: boolean
  bardBeastmaster: boolean
  bardCavalier: boolean
  envoyFieldAgent: boolean
  envoyAugmented: boolean
  mysticFieldAgent: boolean
  mysticXenoDruid: boolean
  mechanicFieldAgent: boolean
  mechanicAugmented: boolean
  androidAugmented: boolean
  mechanicGrenadier: boolean
  technomancerGrenadier: boolean
  technomancerJunkomancer: boolean
  operativeFieldAgent: boolean
  solarianFieldAgent: boolean
  solarianShieldAce: boolean
  solarianParagonsGuard: boolean
  soldierFieldAgent: boolean
  // House rule: Soldiers get Grenadier Dedication in a locked level-2 slot
  soldierGrenadier: boolean
  technomancerFieldAgent: boolean
  technomancerAugmented: boolean
  witchwarperFieldAgent: boolean
  // House rule: suppress flight grants from Animal Feature, Auspice, Celestial/Fiendish Form and Mount, and Untamed Shift
  championFormNoFlight: boolean
  // House rule: General feat pickers hide skill feats
  generalFeatsOnly: boolean
  planSkillPrerequisites: boolean
  skillTokenConversion: boolean
  fighterPhysicalSkills: boolean
  innateHighestMental: boolean
  avengerEldritchHighestMental: boolean
  innateAutoHeighten: boolean
  consolidateInnateTraditions: boolean
  uniqueInnateSpellChoices: boolean
  automaticSfWeaponUpgrades: boolean
  plasmaTurret: boolean
  rocketFistHandWeapons: boolean
  plasmaCasterOneHanded: boolean
  presenceIntensifierDaily: boolean
  testSubjectDatajackScaling: boolean
  studentOfApotheosisStrengthWisdom: boolean // Kept for compatibility with saved settings.
  iconFreeBoosts: boolean
  // House rule: General Training and Advanced General Training can each be selected once
  singleTrainingFeats: boolean
  // House rule: Inventors have Access to uncommon firearms, firearm ammunition, and the Bladed Gauntlet
  inventorFirearmAccess: boolean
  inventorArmorGauntlets: boolean
  bucklerMeleeFinesse: boolean
  freeHandFinesse: boolean
  staffAcrobatSpear: boolean
  staffAcrobatNoPrerequisites: boolean
  whirlwindStanceNoPrerequisites: boolean
  unarmedCountsAsWeapons: boolean
  barbarianIgnoreAgile: boolean
  barbarianWarJavelinAccess: boolean
  warmaskScaling: boolean
  cyborgTestSubject: boolean
  // House rule: a character has at most one animal companion; extra companion grants strengthen it instead
  singleAnimalCompanion: boolean
  protectCompanionAll: boolean
}

const KEY = 'app-settings'
const DEFAULTS: Settings = {
  singleAdditionalArms: true, singleAugmentedBody: true, singleDistantTelepath: true, adoptedDwarfClanDagger: true,
  disableAdoptedAncestry: true, disableAncientElfMultitalented: true, disableBeastmasterWardenSpells: true,
  exclusiveCyborgHearts: true, cyberbornTestSubjectFeat: true, autoClassSkills: false, sf2eDeitySkills: true, orderExplorerSkills: true,
  autoLores: false, deityLore: true, freeArchetype: true, ignoreArchetypeFeatMinimums: true, rangerSnarecrafter: false,
  warriorLegendClearTheWay: true, orcTattooedHistorian: true, dwarfStalwartDefender: true,
  bardAnimalTrainer: true, bardBeastmaster: true, bardCavalier: true, envoyFieldAgent: true, envoyAugmented: true, mysticFieldAgent: true,
  mysticXenoDruid: true, mechanicFieldAgent: true, mechanicAugmented: true, mechanicGrenadier: true,
  androidAugmented: true,
  technomancerGrenadier: true, technomancerJunkomancer: true, operativeFieldAgent: true,
  solarianFieldAgent: true, solarianShieldAce: true, solarianParagonsGuard: true, soldierFieldAgent: true, soldierGrenadier: true, technomancerFieldAgent: true,
  technomancerAugmented: true, witchwarperFieldAgent: true, championCavalier: false, commanderCavalier: true,
  commanderCaptain: true, druidCavalier: false, rangerCavalier: true, championBeastmaster: true,
  commanderBeastmaster: true, druidBeastmaster: true, rangerBeastmaster: true, championFormNoFlight: true,
  generalFeatsOnly: false, planSkillPrerequisites: true, skillTokenConversion: true, fighterPhysicalSkills: true,
  innateHighestMental: true, avengerEldritchHighestMental: true, innateAutoHeighten: true,
  consolidateInnateTraditions: true,   uniqueInnateSpellChoices: true, automaticSfWeaponUpgrades: true, plasmaTurret: true, rocketFistHandWeapons: true, plasmaCasterOneHanded: true,
  presenceIntensifierDaily: true,
  testSubjectDatajackScaling: true,
  studentOfApotheosisStrengthWisdom: true, iconFreeBoosts: true, singleTrainingFeats: true, inventorFirearmAccess: true,
  inventorArmorGauntlets: true, bucklerMeleeFinesse: true, freeHandFinesse: true, staffAcrobatSpear: true,
  staffAcrobatNoPrerequisites: true, whirlwindStanceNoPrerequisites: true, unarmedCountsAsWeapons: true,
  barbarianIgnoreAgile: true, barbarianWarJavelinAccess: true, warmaskScaling: true, cyborgTestSubject: true,
  singleAnimalCompanion: true, protectCompanionAll: true,
}

const settingKeys = Object.keys(DEFAULTS) as (keyof Settings)[]

function normalize(value: unknown): Settings | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const settings = { ...DEFAULTS }
  for (const key of settingKeys) {
    if (key in record) {
      if (typeof record[key] !== 'boolean') return null
      settings[key] = record[key]
    }
  }
  return settings
}

function load(): { settings: Settings; updatedAt: number } {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown
    if (!stored || typeof stored !== 'object') return { settings: DEFAULTS, updatedAt: 0 }
    const record = stored as Record<string, unknown>
    if ('settings' in record) {
      const settings = normalize(record.settings)
      const updatedAt = record.updatedAt
      return settings && typeof updatedAt === 'number' && Number.isSafeInteger(updatedAt)
        ? { settings, updatedAt }
        : { settings: DEFAULTS, updatedAt: 0 }
    }
    // Migrate settings saved by earlier versions, which stored values without a timestamp.
    const settings = normalize(record)
    return settings ? { settings, updatedAt: 1 } : { settings: DEFAULTS, updatedAt: 0 }
  } catch {
    return { settings: DEFAULTS, updatedAt: 0 }
  }
}

const initial = load()
let current = initial.settings
let currentUpdatedAt = initial.updatedAt
const listeners = new Set<() => void>()

export const getSettings = () => current
export const getSettingsUpdatedAt = () => currentUpdatedAt
export const subscribeSettings = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ settings: current, updatedAt: currentUpdatedAt })) } catch { /* settings stay in memory */ }
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  currentUpdatedAt = Math.max(Date.now(), currentUpdatedAt + 1)
  save()
  notify()
}

export function applySyncedSettings(value: unknown, updatedAt: number) {
  const settings = normalize(value)
  if (!settings || !Number.isSafeInteger(updatedAt) || updatedAt < 0) {
    throw new Error('Invalid synced settings')
  }
  if (updatedAt < currentUpdatedAt) return
  if (updatedAt === currentUpdatedAt && settingKeys.every((key) => settings[key] === current[key])) return
  current = settings
  currentUpdatedAt = updatedAt
  save()
  notify()
}

export const useSettings = () => useSyncExternalStore((cb) => {
  return subscribeSettings(cb)
}, getSettings, getSettings)
