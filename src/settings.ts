import { useSyncExternalStore } from 'react'

export interface Settings {
  // House rule: skills a class (or druid order) grants also rank up for free as the level allows
  autoClassSkills: boolean
  // House rule: the character's Lore skills also rank up for free as the level allows
  autoLores: boolean
}

const KEY = 'app-settings'
const DEFAULTS: Settings = { autoClassSkills: false, autoLores: false }

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null) }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

export const getSettings = () => current

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* settings stay in memory */ }
  listeners.forEach((l) => l())
}

export const useSettings = () => useSyncExternalStore((cb) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}, getSettings)
