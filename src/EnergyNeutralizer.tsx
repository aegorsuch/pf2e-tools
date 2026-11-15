import { activeFeatsNamed, type SectionProps } from './builder'
import { energyNeutralizerCount, MECHANIC_ENERGIES } from './mechanicEnergy'

export function EnergyNeutralizer({ c, save, id, label }: Pick<SectionProps, 'c' | 'save'> & { id: string; label: string }) {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e') || !activeFeatsNamed(c, 'Energy Neutralizer').length) return null
  const selected = c.mechanicArmorMods?.[id]?.energyNeutralizer ?? []
  const active = selected.slice(0, energyNeutralizerCount(c))
  return <div className="col"><strong>Energy Neutralizer (Modify)</strong>
    {Array.from({ length: energyNeutralizerCount(c) }, (_, index) => <label key={index}>Energy {index + 1}{' '}
      <select aria-label={`Energy Neutralizer ${label} ${index + 1}`} value={selected[index] ?? ''} onChange={event => {
        const choice = MECHANIC_ENERGIES.find(type => type === event.target.value)
        if (event.target.value && (!choice || active.some((type, i) => type === choice && i !== index))) return
        const next = [...selected]
        while (next.length <= index) next.push(null)
        next[index] = choice ?? null
        save({ mechanicArmorMods: { ...c.mechanicArmorMods, [id]: {
          ...c.mechanicArmorMods?.[id], energyNeutralizer: next,
        } } })
      }}>
        <option value="">None</option>
        {MECHANIC_ENERGIES.map(type => <option key={type} disabled={active.some((other, i) => i !== index && other === type)}>{type}</option>)}
      </select>
    </label>)}
    <small>Turn the mod off when it expires.</small>
  </div>
}
