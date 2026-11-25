import { ensureAonImported } from './aon'
import { db } from './db'
import type { GameSystem } from './types'

export { readCatalog } from './catalogReading'

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
