import { Info } from './Info'
import { SearchableSelect } from './SearchableSelect'
import { isWitchwarper, witchwarperSetup, WITCHWARPER_ANCHORS } from './witchwarper'
import type { SectionProps } from './builder'

export function WitchwarperAnchor({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  if (!isWitchwarper(c)) return null
  const anchor = WITCHWARPER_ANCHORS.find(option => option.name === c.witchwarper?.anchor)
  return <>
    <SearchableSelect label="Anchor" aria-label="Anchor" value={anchor?.name ?? ''} onChange={event => {
      const option = WITCHWARPER_ANCHORS.find(option => option.name === event.target.value)
      save({ witchwarper: { ...c.witchwarper, anchor: option?.name } })
    }}>
      <option value="">Choose anchor</option>
      {WITCHWARPER_ANCHORS.map(option => <option key={option.name}>{option.name}</option>)}
    </SearchableSelect>
    {anchor && <Info label={anchor.name}>{anchor.description}</Info>}
  </>
}

export function WitchwarperFeatures({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  const setup = witchwarperSetup(c)
  if (!setup) return null
  return <div className="col">
    <Info label={`Quantum Field (${setup.quantumField.radiusFeet}-foot burst)`}>{setup.quantumField.effect}</Info>
    {setup.paradox.name === 'Precog' && <label>
      <input type="checkbox" aria-label="Moving within quantum field" checked={!!c.witchwarper?.movingInQuantumField}
        onChange={event => save({ witchwarper: { ...c.witchwarper, movingInQuantumField: event.target.checked } })} />
      {' '}Moving within quantum field
    </label>}
  </div>
}
