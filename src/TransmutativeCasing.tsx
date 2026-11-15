import { activeFeatsNamed } from './builder'
import type { Character } from './types'

export function TransmutativeCasing({ c, value, onChange }: { c: Character; value?: string; onChange: (value: string | undefined) => void }) {
  if (!activeFeatsNamed(c, 'Transmutative Casing').length) return null
  const choices = ['Cold Iron', 'Silver',
    ...(activeFeatsNamed(c, 'Advanced Transmutative Casing').length ? ['Adamantine (standard-grade)', 'Aucturnite', 'Noqual'] : []),
    ...(activeFeatsNamed(c, 'Superior Transmutative Casing').length
      ? ['Abysium (standard-grade)', 'Djezet (standard-grade)', 'Cold Siccatite (standard-grade)', 'Hot Siccatite (standard-grade)'] : [])]
  return <label>Transmutative Casing{' '}
    <select aria-label="Transmutative Casing" value={value ?? ''} onChange={event => {
      if (!event.target.value || choices.includes(event.target.value)) onChange(event.target.value || undefined)
    }}>
      <option value="">None</option>
      {value && !choices.includes(value) && <option value={value} disabled>{value} (unavailable)</option>}
      {choices.map(choice => <option key={choice}>{choice}</option>)}
    </select>
    {value && choices.includes(value) && <small> Physical damage uses {value}; turn off when the mod expires.</small>}
  </label>
}
