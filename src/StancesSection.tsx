import { activeStance, availableStances, type SectionProps } from './builder'
import { EntryDescription } from './EntryDescription'
import { adoptedAncestryText, featDisplayName } from './featChoices'

export function StancesSummary({ c, entries }: SectionProps) {
  const active = activeStance(c, entries)
  return <summary className="character-section-summary">
    <strong>Stances</strong><span>{availableStances(c, entries).length}, {active ? adoptedAncestryText(c, featDisplayName(active)) : 'None'} Active</span>
  </summary>
}

export function StancesContent({ c, entries, save }: SectionProps) {
  const stances = availableStances(c, entries)
  const active = activeStance(c, entries)
  const group = `stance:${c.id}`
  return <div className="character-section-content">
    <fieldset className="stance-options">
      <legend>Active stance</legend>
      <label><input type="radio" name={group} checked={!active}
        onChange={() => save({ activeStance: undefined })} /> None</label>
      {stances.map(entry => <div className="stance-option" key={entry.name}>
        <input type="radio" name={group} aria-label={`Use ${adoptedAncestryText(c, featDisplayName(entry))}`}
          checked={active?.name === entry.name} onChange={() => save({ activeStance: entry.name })} />
        <EntryDescription character={c} name={entry.name} entry={entry} entries={entries} className="feat-name" />
      </div>)}
    </fieldset>
  </div>
}
