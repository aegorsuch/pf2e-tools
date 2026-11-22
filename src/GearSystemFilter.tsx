import type { GearSystem } from './gearSystem'

export function GearSystemFilter({ value, onChange }: {
  value: GearSystem; onChange: (value: GearSystem) => void
}) {
  return <select aria-label="Systems" value={value} onChange={event => {
    const system = event.target.value
    if (system === 'both' || system === 'pf2e' || system === 'sf2e') onChange(system)
  }}>
    <option value="both">Both</option>
    <option value="pf2e">PF2E</option>
    <option value="sf2e">SF2E</option>
  </select>
}
