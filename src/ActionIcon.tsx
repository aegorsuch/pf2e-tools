import type { ContentEntry } from './types'

const ACTIONS: Record<string, { count?: number; symbol?: 'free' | 'reaction' }> = {
  'single action': { count: 1 },
  'one action': { count: 1 },
  'two actions': { count: 2 },
  'three actions': { count: 3 },
  'free action': { symbol: 'free' },
  'reaction': { symbol: 'reaction' },
}

export function ActionIcon({ entry, showOther = false }: { entry?: ContentEntry; showOther?: boolean }) {
  const value = entry?.data.actions
  if (typeof value !== 'string' || !value.trim()) return null
  const parts = value.split(/(single action|one action|two actions|three actions|free action|reaction)/gi)
  if (parts.length === 1) return showOther ? <>{value}</> : null

  return (
    <span className="action-cost" aria-label={value} title={value}>
      {parts.map((part, index) => {
        const action = ACTIONS[part.toLowerCase()]
        if (!action) return <span aria-hidden="true" key={index}>{part}</span>
        if (action.symbol === 'reaction') return (
          <svg key={index} aria-hidden="true" viewBox="0 0 24 24" className="action-icon">
            <path fill="currentColor" d="M5 4c9 0 15 3 15 9 0 4-4 6-10 6v3l-7-5 7-5v3c4 0 6-1 6-3 0-3-4-5-11-8Z" />
          </svg>
        )
        return (
          <svg key={index} aria-hidden="true" viewBox={`0 0 ${(action.count ?? 1) * 12 + 4} 20`} className="action-icon"
            style={{ width: `${(action.count ?? 1) * 0.65 + 0.2}em` }}>
            {Array.from({ length: action.count ?? 1 }, (_, i) => action.symbol === 'free'
              ? <path key={i} d="M8 2 15 10 8 18 1 10Z M8 6 11.5 10 8 14 4.5 10Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
              : <path key={i} d={`M${i * 12 + 2} 2 ${i * 12 + 10} 10 ${i * 12 + 2} 18 ${i * 12 + 6} 10Z`} fill="currentColor" />)}
          </svg>
        )
      })}
    </span>
  )
}
