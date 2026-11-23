import { SearchableSelect } from './SearchableSelect'
import { confirmRemoval } from './confirmRemoval'
import { RUNESMITH_RUNES, maxEtchedRunes, runicRepertoireSize } from './runesmithRunes'
import type { SectionProps } from './builder'

function RuneDetails({ name, faded }: { name: string; faded?: boolean }) {
  const rune = RUNESMITH_RUNES.find(item => item.name === name)
  return <details>
    <summary>{name}{faded ? ' (faded)' : ''}</summary>
    {rune && <>
      <small>{[`Rune ${rune.level}`, ...rune.traits, rune.usage].filter(Boolean).join(' · ')}</small>
      <p style={{ whiteSpace: 'pre-line' }}>{rune.description}</p>
    </>}
  </details>
}

export function RunesmithFeatures({ c, save }: SectionProps) {
  const known = c.runicRepertoire ?? []
  const etched = (c.etchedRunes ?? []).filter(name => known.includes(name))
  const capacity = runicRepertoireSize(c.level)
  const maxEtched = maxEtchedRunes(c.level)
  const available = RUNESMITH_RUNES.filter(rune => rune.level <= c.level && !known.includes(rune.name))
  return <div className="col" aria-label="Runesmith runes">
    <h4>Runic Repertoire ({known.length}/{capacity})</h4>
    {known.map(name => <div key={name} className="gear-traits">
      <RuneDetails name={name} />
      <button type="button" aria-label={`Etch ${name}`} disabled={etched.includes(name)}
        onClick={() => save({ etchedRunes: [...etched, name].slice(-maxEtched) })}>Etch</button>
      <button type="button" aria-label={`Remove ${name} from repertoire`}
        onClick={() => confirmRemoval(`${name} from your repertoire`, () => save({
          runicRepertoire: known.filter(rune => rune !== name), etchedRunes: etched.filter(rune => rune !== name) }))}>×</button>
    </div>)}
    {known.length < capacity && <SearchableSelect aria-label="Add rune to repertoire" value=""
      onChange={event => { if (event.target.value) save({ runicRepertoire: [...known, event.target.value] }) }}>
      <option value="">Add rune</option>
      {available.map(rune => <option key={rune.name} value={rune.name}>{rune.name} ({rune.level})</option>)}
    </SearchableSelect>}
    <h4>Etched Runes ({etched.length}/{maxEtched})</h4>
    {etched.map(name => <div key={name} className="gear-traits">
      <RuneDetails name={name} />
      <button type="button" aria-label={`Invoke ${name}`} title="Invoke the rune; it fades away"
        onClick={() => save({ etchedRunes: etched.filter(rune => rune !== name) })}>Invoke</button>
    </div>)}
  </div>
}
