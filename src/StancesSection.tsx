import { activeStance, availableStances, ELEMENTAL_MEDICINES, intensifiedElementDamage, type SectionProps } from './builder'
import { EntryDescription } from './EntryDescription'
import { adoptedAncestryText, featDisplayName } from './featChoices'
import { DamageRoll } from './SpellDamage'
import { SourceNote } from './Info'

export function StancesSummary({ c, entries }: SectionProps) {
  const active = activeStance(c, entries)
  return <summary className="character-section-summary">
    <strong>Stances</strong><span>{availableStances(c, entries).length}, {active ? adoptedAncestryText(c, featDisplayName(active)) : 'None'} Active</span>
  </summary>
}

export function StancesContent({ c, entries, save }: SectionProps) {
  const stances = availableStances(c, entries)
  const active = activeStance(c, entries)
  const medicine = c.intensifiedElement
  const damage = intensifiedElementDamage(c, entries)
  const group = `stance:${c.id}`
  return <div className="character-section-content">
    <fieldset className="stance-options">
      <legend>Active stance</legend>
      <label><input type="radio" name={group} checked={!active}
        onChange={() => save({ activeStance: undefined })} /> None</label>
      {stances.map(entry => <div className="stance-option" key={entry.name}>
        <input type="radio" name={group} aria-label={`Use ${adoptedAncestryText(c, featDisplayName(entry))}`}
          checked={active?.name === entry.name}
          disabled={entry.name === 'Intensified Element Stance' && active?.name !== entry.name && (!medicine || !!medicine.used)}
          onChange={() => save({ activeStance: entry.name,
            ...(entry.name === 'Intensified Element Stance' && medicine
              ? { intensifiedElement: { ...medicine, used: true } } : {}) })} />
        <EntryDescription character={c} name={entry.name} entry={entry} entries={entries} className="feat-name" />
        {entry.name === 'Intensified Element Stance' && <>
          <label>Elemental medicine{' '}
            <select aria-label="Intensified Element Stance medicine" value={medicine?.element ?? ''} disabled={!!medicine?.used}
              onChange={event => {
                const element = ELEMENTAL_MEDICINES.find(value => value === event.target.value)
                save({ intensifiedElement: element ? { element, legendary: medicine?.legendary } : undefined })
              }}>
              <option value="">None</option>
              {ELEMENTAL_MEDICINES.map(element => <option key={element}>{element}</option>)}
            </select>
          </label>
          {medicine && <>
            <label><input type="checkbox" aria-label="Legendary elemental medicine" checked={!!medicine.legendary}
              disabled={!!medicine.used} onChange={event => save({ intensifiedElement: { ...medicine, legendary: event.target.checked } })} /> Legendary crafter</label>
            <label><input type="checkbox" aria-label="Elemental medicine expended" checked={!!medicine.used}
              disabled={active?.name === entry.name} onChange={event => save({ intensifiedElement: { ...medicine, used: event.target.checked } })} /> Expended</label>
          </>}
          {damage && <span><DamageRoll name="Intensified Element Stance"
            damage={{ label: 'Conditional damage', dice: damage.dice, sides: 6, type: damage.type }} />
            <SourceNote source="Intensified Element Stance" note={`Additional damage on strikes and damaging spells against ${damage.targets}.`} />
          </span>}
        </>}
      </div>)}
    </fieldset>
  </div>
}
