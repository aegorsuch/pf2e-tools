import { useState } from 'react'
import { activeFeatsNamed, type SectionProps } from './builder'
import { droneCustomizationSlots, droneStats } from './drone'
import { damageDrone, DRONE_DAMAGE_TYPES, type DroneDamageType } from './droneDamage'
import { Info } from './Info'

export function DroneHealth({ c, entries, save }: SectionProps) {
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<DroneDamageType>('bludgeoning')
  const [area, setArea] = useState(false)
  const [nonlethal, setNonlethal] = useState(false)
  const [result, setResult] = useState('')
  const stats = droneStats(c, entries)
  const slots = droneCustomizationSlots(c)
  if (!stats || !slots) return null
  const hp = Math.min(stats.hp, Math.max(0, c.mechanicDroneHp ?? stats.hp))
  const temp = Math.max(0, c.mechanicDroneTemporaryHp ?? 0)
  const emergency = (c.mechanicDroneCustomizations?.Advanced ?? []).slice(0, slots.Advanced)
    .some(item => item.name === 'Emergency Repair')
  const value = Number(amount)
  return <details>
    <summary>Drone HP {hp}/{stats.hp}{temp ? `; temporary HP ${temp}` : ''}</summary>
    <div className="col">
      <label>Current HP{' '}<input type="number" min={0} max={stats.hp} step={1} aria-label="Drone current HP"
        value={hp} onChange={event => {
          const next = Number(event.target.value)
          if (event.target.value && Number.isInteger(next) && next >= 0 && next <= stats.hp) save({ mechanicDroneHp: next })
        }} /> / {stats.hp}</label>
      <label>Temporary HP{' '}<input type="number" min={0} step={1} aria-label="Drone temporary HP"
        value={temp} onChange={event => {
          const next = Number(event.target.value)
          if (event.target.value && Number.isInteger(next) && next >= 0) save({ mechanicDroneTemporaryHp: next })
        }} /></label>
      {c.mechanicDroneDesperateRepairActive && <button type="button" onClick={() =>
        save({ mechanicDroneTemporaryHp: Math.max(temp, Math.max(0, c.level + Math.floor((c.abilities.int - 10) / 2))) })}>
        Apply Desperate Repair
      </button>}
      <div className="row">
        <label>Damage{' '}<input type="number" min={1} step={1} aria-label="Drone damage"
          value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <label>Type{' '}<select aria-label="Drone damage type" value={type} onChange={event => {
          const next = DRONE_DAMAGE_TYPES.find(item => item === event.target.value)
          if (next) setType(next)
        }}>{DRONE_DAMAGE_TYPES.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><input type="checkbox" checked={area} onChange={event => setArea(event.target.checked)} /> Area</label>
        <label><input type="checkbox" checked={nonlethal} onChange={event => setNonlethal(event.target.checked)} /> Nonlethal</label>
        <button type="button" disabled={!hp || !Number.isInteger(value) || value <= 0}
          onClick={() => {
            const patch = damageDrone(c, entries, value, type, area, nonlethal)
            save(patch)
            setResult(Object.keys(patch).length ? 'Damage applied.' : 'No damage after immunity or resistance.')
            setAmount('')
          }}>Apply damage</button>
      </div>
      {result && <small role="status">{result}</small>}
      <Info label="Damage rules">Enter one damage type at a time after saves. Applies listed resistance, electricity weakness,
        damage-type and nonlethal immunity, force field, then temporary HP. "Other" bypasses the force field;
        apply other immunities and modifiers separately.</Info>
      {!hp && <><small>Shut down: immune to damage and unable to act until repaired.</small>
        <button type="button" onClick={() => save({ mechanicDroneHp: 1 })}>Reboot after 1 minute</button></>}
      <button type="button" disabled={hp === stats.hp} onClick={() => save({ mechanicDroneHp: stats.hp })}>
        Fully repair (daily preparations or {activeFeatsNamed(c, 'Quick Repair').length ? '10 minutes' : '1 hour'})
      </button>
      {emergency && <>
        <button type="button" disabled={!hp || hp === stats.hp || !!c.mechanicDroneEmergencyRepairUsed} onClick={() =>
          save({ mechanicDroneHp: Math.min(stats.hp, hp + c.level * (stats.superior ? 2 : 1)),
            mechanicDroneEmergencyRepairUsed: true })}>Emergency Repair</button>
        {c.mechanicDroneEmergencyRepairUsed && <button type="button" onClick={() => save({ mechanicDroneEmergencyRepairUsed: false })}>
          Emergency Repair: 10 minutes elapsed
        </button>}
      </>}
    </div>
  </details>
}
