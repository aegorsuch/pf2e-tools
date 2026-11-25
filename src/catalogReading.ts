import { db } from './db'
import type { GameSystem } from './types'

export async function readCatalog(full: boolean, enabled: GameSystem[], readyKey: string, requestKey: string) {
  if (full && requestKey && readyKey !== requestKey) return { key: readyKey, full: false, entries: [] }
  const systemEntries = full && enabled.length
    ? await db.content.where('systems').anyOf(...enabled).distinct().toArray()
    : []
  const all = full ? systemEntries : [
    ...await db.content.where('source').equals('homebrew').toArray(),
    ...await db.content.where('kind').anyOf('class', 'ancestry', 'subclass').toArray(),
  ]
  const unique = new Map(all.filter(entry => !entry.deleted && entry.systems.some(system => enabled.includes(system)))
    .map(entry => [entry.id, entry]))
  return { key: readyKey, full, entries: [...unique.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) }
}
