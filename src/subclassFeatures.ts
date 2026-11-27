import type { ContentEntry } from './types'

const ACTION_COST = '(Single Action|One Action|Two Actions|Three Actions|Free Action|Reaction)'
const SECTION = /(?=\bLevel \d+ [A-Z]|\b(?:Slinger's Reload|Initial Deed|Advanced Deed|Greater Deed) Action )/

// AoN publishes some subclass choices (Ranger edges, Gunslinger ways) with later-level abilities inside one description.
export function subclassFeatureRows(entry: ContentEntry): { name: string; level: number; description: string; actions?: string }[] {
  const rows: { name: string; level: number; description: string; actions?: string }[] = []
  let level = 1
  for (const part of entry.description.split(SECTION).slice(1)) {
    const heading = /^Level (\d+) /.exec(part)
    if (heading) level = Number(heading[1])
    let text = part.replace(/^Level \d+ /, '').trim()
    let actions: string | undefined
    let name: string | undefined
    const deed = new RegExp(`^(?:Slinger's Reload|Initial Deed|Advanced Deed|Greater Deed) Action (.+?) ${ACTION_COST}\\b\\s*`).exec(text)
    if (deed) {
      name = deed[1]
      actions = deed[2]
      text = text.slice(deed[0].length)
    } else {
      const title = /^([A-Z][\w'’-]*(?: [A-Z][\w'’-]*)*)\s+([A-Z][a-z].*)$/s.exec(text)
      if (!title) continue
      name = title[1]
      text = title[2]
    }
    if (!heading && !deed) continue
    rows.push({ name, level, description: text.replace(/^(?:Gunslinger )?Source [^]*?pg\. \d+\s*/, '').trim(), actions })
  }
  return rows
}
