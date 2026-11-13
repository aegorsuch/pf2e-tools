import { useMemo, useState } from 'react'
import { achievementKey, achievementOptions } from './featAccess'
import type { SectionProps } from './builder'

export function Achievements({ c, entries, save }: SectionProps) {
  const [opened, setOpened] = useState(false)
  const [query, setQuery] = useState('')
  const options = useMemo(() => achievementOptions(entries), [entries])
  const selected = new Set((c.achievements ?? []).map(achievementKey))
  const q = query.trim().toLowerCase()
  const shown = options.filter(option => !q || [option.requirement, ...option.feats].some(text => text.toLowerCase().includes(q)))
  return (
    <details className="character-subsection" onToggle={event => {
      if (event.target === event.currentTarget && event.currentTarget.open) setOpened(true)
    }}>
      <summary><h4>Achievements</h4>{selected.size > 0 && <span>{selected.size} checked</span>}</summary>
      {opened && <div className="col">
        <label>Search achievements{' '}
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <ul className="achievement-list">
          {shown.map(option => <li key={option.key}>
            <label>
              <input type="checkbox" checked={selected.has(option.key)} onChange={event => {
                const next = new Set((c.achievements ?? []).map(achievementKey))
                if (event.target.checked) next.add(option.key)
                else next.delete(option.key)
                void save({ achievements: [...next] })
              }} />
              <span>{option.requirement}</span>
            </label>
          </li>)}
        </ul>
        {shown.length === 0 && <p>{options.length ? 'No matching achievements.' : 'No achievement-based access conditions in loaded content.'}</p>}
      </div>}
    </details>
  )
}
