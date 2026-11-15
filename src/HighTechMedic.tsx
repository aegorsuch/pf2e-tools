import { activeFeatsNamed, type SectionProps } from './builder'
import type { ContentEntry, MedicMod } from './types'

export function HighTechMedic({ c, save, index, entry }: Pick<SectionProps, 'c' | 'save'> & { index: number; entry?: ContentEntry }) {
  const item = c.equipment[index]
  if (!item || c.className !== 'Mechanic' || !c.systems.includes('sf2e') || !activeFeatsNamed(c, 'High-tech Medic').length || !entry) return null
  const traits = entry.traits.map(trait => trait.toLowerCase())
  const rigEligible = traits.includes('healing') || traits.includes('serum')
  const modEligible = traits.includes('serum') || /^medpatch\b/i.test(item.name)
  if (!rigEligible && !modEligible) return null
  const rigUsed = c.equipment.reduce((sum, gear) => sum + Math.max(0, Math.min(gear.qty, gear.mechanicRigQty ?? 0)), 0)
  const rigQty = Math.max(0, Math.min(item.qty, item.mechanicRigQty ?? 0))
  const update = (patch: Partial<typeof item>) => save({ equipment: c.equipment.map((gear, i) => i === index ? { ...gear, ...patch } : gear) })
  const mods: MedicMod[] = ['Numbing Analgesic', 'Powerful Stimulant', 'Protective Excretions', 'Restorative Boost']
  return <div className="col">
    {rigEligible && <label>In custom rig{' '}<input type="number" aria-label={`${item.name} in custom rig`}
      min={0} max={Math.min(item.qty, Math.max(rigQty, 3 - rigUsed + rigQty))} value={rigQty} onChange={event => {
        const qty = Number(event.target.value)
        if (Number.isInteger(qty) && qty >= 0 && qty <= item.qty && rigUsed - rigQty + qty <= 3) update({ mechanicRigQty: qty })
      }} /> / 3 total</label>}
    {modEligible && <>
      <strong>Modify one {item.name}</strong>
      {mods.map(mod => <label key={mod}><input type="checkbox" checked={!!item.mechanicMedicMods?.includes(mod)}
        onChange={event => update({ mechanicMedicMods: event.target.checked
          ? [...(item.mechanicMedicMods ?? []), mod] : (item.mechanicMedicMods ?? []).filter(existing => existing !== mod) })} /> {mod}</label>)}
      {item.mechanicMedicMods?.includes('Numbing Analgesic') && <small>Reduce sickened by 1.</small>}
      {item.mechanicMedicMods?.includes('Powerful Stimulant') && <small>Reduce enfeebled or frightened by 1.</small>}
      {item.mechanicMedicMods?.includes('Protective Excretions') && <small>Attempt a DC 10 flat check to end one persistent damage type.</small>}
      {item.mechanicMedicMods?.includes('Restorative Boost') && <small>Fast healing {Math.ceil(entry.level / 2)} for 3 rounds.</small>}
      <small>Turn mods off when they expire.</small>
    </>}
  </div>
}
