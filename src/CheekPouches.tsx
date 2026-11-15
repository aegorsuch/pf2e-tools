import { useState } from 'react'
import { activeFeatsNamed, weaponHands, type SectionProps } from './builder'
import { SourceNote } from './Info'
import { cheekPouchStatus, storeCheekItem } from './cheekPouchRules'

export function CheekPouches({ c, entries, save }: SectionProps) {
  const [picked, setPicked] = useState('')
  const [fits, setFits] = useState(false)
  const [prepare, setPrepare] = useState(false)
  const [error, setError] = useState('')
  const status = cheekPouchStatus(c, entries)
  if (!status.hasPouches && !status.count) return null
  const equipment = c.equipment
  const weapons = c.weapons ?? []
  const choices = [
    ...equipment.map((item, index) => ({ key: `e:${index}:${encodeURIComponent(item.name)}`, name: item.name,
      available: item.qty - (item.cheekQty ?? 0) })),
    ...weapons.filter(weapon => !weapon.attachedTo && (weaponHands(entries, weapon) ?? 0) > 0
      && !equipment.some(item => weapon.id === `eq-${item.name}`))
      .map(weapon => ({ key: `w:${weapon.id}`, name: weapon.name, available: weapon.cheekStored ? 0 : 1 })),
  ].filter(item => item.available > 0)
  const add = () => {
    if (!status.hasPouches || !fits) return
    const result = storeCheekItem(c, entries, picked, prepare)
    if ('error' in result) {
      setError(result.error)
      return
    }
    save(result.patch)
    setError('')
    setFits(false)
    setPrepare(false)
  }
  return <section className="col" aria-label="Cheek pouches">
    <h4>Cheek Pouches <SourceNote inlineSource={false} source="Cheek Pouches" note={(status.portal
      ? 'Up to 10 Bulk; items must fit in your mouth. Stored items are difficult to detect.'
      : `${activeFeatsNamed(c, 'Big Mouth').length ? 'Up to 1 Bulk.' : 'Up to four items, each light Bulk or less.'} Each item must have no dimension longer than 1 foot. Speech is difficult to understand while items are stored.`)
      + (activeFeatsNamed(c, 'Quick Stow').length ? ' Quick Stow stores a held item as a free action once per round.' : '')
      + (activeFeatsNamed(c, 'Cheek Holster').length ? ' A prepared firearm can be drawn and fired with one action.' : '')
      + (activeFeatsNamed(c, 'Explosive Surprise').length ? ' A prepared grenade can be drawn and thrown with one action without a free hand.' : '')} /></h4>
    <ul>
      {equipment.map((item, index) => (item.cheekQty ?? 0) > 0 && <li key={`e:${index}`}>
        {item.name} ×{item.cheekQty}{(item.cheekPreparedQty ?? 0) > 0 && ` (${item.cheekPreparedQty} prepared)`}{' '}
        {(item.cheekQty ?? 0) > (item.cheekPreparedQty ?? 0) && <button type="button" onClick={() => save({ equipment: equipment.map((existing, i) => i === index
          ? { ...existing, cheekQty: Math.max(0, (existing.cheekQty ?? 0) - 1) } : existing) })}>Retrieve</button>}
        {(item.cheekPreparedQty ?? 0) > 0 && <button type="button" onClick={() => save({ equipment: equipment.map((existing, i) => i === index
          ? { ...existing, cheekQty: Math.max(0, (existing.cheekQty ?? 0) - 1),
            cheekPreparedQty: Math.max(0, (existing.cheekPreparedQty ?? 0) - 1) } : existing) })}>Retrieve prepared</button>}
      </li>)}
      {weapons.filter(weapon => weapon.cheekStored).map(weapon => <li key={weapon.id}>{weapon.name}{weapon.cheekHolstered && ' (prepared)'}{' '}
        <button type="button" onClick={() => save({ weapons: weapons.map(existing => existing.id === weapon.id
          ? { ...existing, cheekStored: false, cheekHolstered: false } : existing) })}>Retrieve</button>
      </li>)}
    </ul>
    {(status.missingBulk || status.invalid || status.overLimit || !status.hasPouches) && <small role="status">
      {!status.hasPouches ? 'Cheek Pouches unavailable; retrieve stored items.'
        : status.missingBulk ? 'Stored item bulk unavailable; sync item data.'
          : status.invalid ? 'Stored item or quantity is no longer eligible.' : 'Stored items exceed cheek pouch capacity.'}
    </small>}
    {status.hasPouches && <>
      <label>Store item{' '}<select aria-label="Cheek pouch item" value={picked} onChange={event => {
        setPicked(event.target.value); setFits(false); setPrepare(false); setError('')
      }}>
        <option value="">Choose item</option>
        {choices.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
      </select></label>
      <label><input type="checkbox" checked={fits} onChange={event => setFits(event.target.checked)} />{' '}
        {status.portal ? 'Fits in mouth' : 'No dimension exceeds 1 foot'}
      </label>
      {picked && (picked.startsWith('e:') && activeFeatsNamed(c, 'Explosive Surprise').length > 0
        || picked.startsWith('w:') && activeFeatsNamed(c, 'Cheek Holster').length > 0) && <label>
        <input type="checkbox" checked={prepare} onChange={event => setPrepare(event.target.checked)} />{' '}
        {picked.startsWith('w:') ? 'Prepare firearm' : 'Prepare grenade'} (10 minutes)
      </label>}
      <button type="button" disabled={!picked || !fits} onClick={add}>Store in cheek pouch</button>
      {error && <small role="status">{error}</small>}
    </>}
  </section>
}
