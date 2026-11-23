import { SearchableSelect } from './SearchableSelect'
import { confirmRemoval } from './confirmRemoval'
import { RUNESMITH_RUNES, maxEtchedRunes, runicRepertoireSize } from './runesmithRunes'
import { ranksAt, type SectionProps } from './builder'

const RUNE_TRADITIONS: [string, string][] = [['Arcane', 'Arcana'], ['Primal', 'Nature'], ['Occult', 'Occultism'], ['Divine', 'Religion']]

function RuneDetails({ name, faded, tradition }: { name: string; faded?: boolean; tradition?: string }) {
  const rune = RUNESMITH_RUNES.find(item => item.name === name)
  return <details>
    <summary>{name}{faded ? ' (faded)' : ''}</summary>
    {rune && <>
      <small>{[`Rune ${rune.level}`, ...rune.traits.map(trait => trait === 'Magical' && tradition ? tradition : trait), rune.usage].filter(Boolean).join(' · ')}</small>
      <p style={{ whiteSpace: 'pre-line' }}>{rune.description}</p>
    </>}
  </details>
}

export function RunesmithFeatures({ c, entries, save }: SectionProps) {
  const ranks = ranksAt(c, entries)
  const traditions = RUNE_TRADITIONS.filter(([, skill]) => (ranks[skill] ?? 0) >= 1).map(([tradition]) => tradition)
  const isMagical = (name: string) => !!RUNESMITH_RUNES.find(rune => rune.name === name)?.traits.includes('Magical')
  const traditionSelect = (name: string) => isMagical(name) && traditions.length > 0 && <select aria-label={`${name} tradition`}
    value={c.runeTraditions?.[name] ?? ''}
    onChange={event => save({ runeTraditions: { ...c.runeTraditions, [name]: event.target.value } })}>
    <option value="">Magical</option>
    {traditions.map(tradition => <option key={tradition} value={tradition}>{tradition}</option>)}
  </select>
  const known = c.runicRepertoire ?? []
  const etched = (c.etchedRunes ?? []).filter(name => known.includes(name))
  const capacity = runicRepertoireSize(c.level)
  const maxEtched = maxEtchedRunes(c.level)
  const available = RUNESMITH_RUNES.filter(rune => rune.level <= c.level && !known.includes(rune.name))
  return <div className="col" aria-label="Runesmith runes">
    <h4>Runic Repertoire ({known.length}/{capacity})</h4>
    {known.map(name => <div key={name} className="gear-traits">
      <RuneDetails name={name} tradition={c.runeTraditions?.[name]} />
      {traditionSelect(name)}
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
      <RuneDetails name={name} tradition={c.runeTraditions?.[name]} />
      <button type="button" aria-label={`Invoke ${name}`} title="Invoke the rune; it fades away"
        onClick={() => save({ etchedRunes: etched.filter(rune => rune !== name) })}>Invoke</button>
    </div>)}
  </div>
}
