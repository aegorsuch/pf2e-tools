import { useSyncExternalStore } from 'react'

export interface Settings {
  // House rule: skills a class (or druid order) grants also rank up for free as the level allows
  autoClassSkills: boolean
  // House rule: Order Explorer grants training in the explored order's skill
  orderExplorerSkills: boolean
  // House rule: the character's Lore skills also rank up for free as the level allows
  autoLores: boolean
  // Variant rule: Free Archetype grants an archetype feat at every even level
  freeArchetype: boolean
  // House rule: Rangers get Snarecrafter Dedication for free at level 2, locked in the Dedications section
  rangerSnarecrafter: boolean
  // House rules: Champions and Druids get Cavalier Dedication for free at level 2
  championCavalier: boolean
  druidCavalier: boolean
  // House rule: Celestial Form and Fiendish Form do not grant flight
  championFormNoFlight: boolean
  // House rule: General feat pickers hide skill feats
  generalFeatsOnly: boolean
  // House rule: General Training and Advanced General Training can each be selected once
  singleTrainingFeats: boolean
}

const KEY = 'app-settings'
const DEFAULTS: Settings = { autoClassSkills: false, orderExplorerSkills: true, autoLores: false, freeArchetype: true, rangerSnarecrafter: false, championCavalier: false, druidCavalier: false, championFormNoFlight: true, generalFeatsOnly: false, singleTrainingFeats: true }

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
}, getSettings)
