import { ensureAonImported } from './aon'
import { db } from './db'
import type { GameSystem } from './types'

export async function readCatalog(full: boolean, enabled: GameSystem[], readyKey: string, requestKey: string) {
  if (full && requestKey && readyKey !== requestKey) return { key: readyKey, full: false, entries: [] }
  const all = full ? await db.content.toArray() : [
    ...await db.content.where('source').equals('homebrew').toArray(),
    ...await db.content.where('kind').anyOf('class', 'ancestry', 'subclass').toArray(),
  ]
  const unique = new Map(all.filter(entry => !entry.deleted && entry.systems.some(system => enabled.includes(system)))
    .map(entry => [entry.id, entry]))
  return { key: readyKey, full, entries: [...unique.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) }
}

export async function loadRequiredCatalogs(
  systems: GameSystem[],
  onStatus: (message: string) => void,
  isActive: () => boolean,
) {
  const warnings: string[] = []
  for (const system of systems) {
    if (!isActive()) return false
    try {
      const count = await ensureAonImported(system, value => {
        if (isActive()) onStatus(`Loading ${system} content: ${value}`)
      })
      if (isActive() && count) onStatus(`Loaded ${count} ${system} entries from Archives of Nethys`)
    } catch (error) {
      const cached = await db.content.where('id').startsWith(`aon:${system}:`).filter(entry => !entry.deleted).count()
      if (!isActive()) return false
      const message = `Could not load ${system} content (${error instanceof Error ? error.message : error})`
      if (!cached) throw new Error(message)
      warnings.push(`${message}; using saved data`)
    }
  }
  if (!isActive()) return false
  if (warnings.length) onStatus(warnings.join('; '))
  return true
}
