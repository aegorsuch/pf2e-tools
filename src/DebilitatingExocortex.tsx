import { activeFeatsNamed } from './builder'
import { mechanicClassDC } from './mechanicRules'
import type { Character } from './types'

export function DebilitatingExocortex({ c, choices, onChange, enduring }: {
  c: Character
  choices?: string[]
  onChange: (choices: string[]) => void
  enduring?: { active: boolean; onChange: (active: boolean) => void }
}) {
  if (!activeFeatsNamed(c, 'Debilitating Exocortex').length) return null
  const count = activeFeatsNamed(c, 'Double Debilitating Exocortex').length ? 2 : 1
  const options = ['Dazzled', 'Deafened', 'Off-guard', 'Suppressed',
    ...(activeFeatsNamed(c, 'Improved Debilitating Exocortex').length ? ['Clumsy', 'Enfeebled', 'Stupefied'] : [])]
  const selected = choices ?? []
  const active = selected.slice(0, count)
  return <div className="col"><strong>Debilitating Exocortex (Modify)</strong>
    {Array.from({ length: count }, (_, index) => <label key={index}>Condition {index + 1}{' '}
      <select aria-label={`Debilitating Exocortex condition ${index + 1}`} value={selected[index] ?? ''} onChange={event => {
        const choice = event.target.value
        if (choice && (!options.includes(choice) || active.some((item, i) => i !== index && item === choice))) return
        const next = [...selected]
        while (next.length <= index) next.push('')
        next[index] = choice
        onChange(next)
      }}>
        <option value="">None</option>
        {selected[index] && !options.includes(selected[index]) && <option value={selected[index]} disabled>{selected[index]} (unavailable)</option>}
        {options.map(option => <option key={option} disabled={active.some((item, i) => i !== index && item === option)}>{option}</option>)}
      </select>
    </label>)}
    {c.level >= 13 && enduring && <label><input type="checkbox" aria-label="Enduring Debilitating Exocortex"
      checked={enduring.active} disabled={!active.some(option => options.includes(option))}
      onChange={event => enduring.onChange(event.target.checked)} /> Enduring Debilitating Exocortex</label>}
    {active.some(option => options.includes(option)) && <small>Creatures damaged by the exocortex must succeed at Fortitude DC {mechanicClassDC(c)}
      {activeFeatsNamed(c, 'Foolproof Debilitations').length ? ' (enemies must critically succeed)' : ''} or gain{' '}
      {active.filter(option => options.includes(option)).map(option =>
        ['Clumsy', 'Enfeebled', 'Stupefied'].includes(option) ? `${option} ${count === 2 ? 2 : 1}` : option).join(' and ')}
      {' '}until the end of their next turn. Turn off when the mod expires.</small>}
  </div>
}
