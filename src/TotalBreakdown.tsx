import { useId } from 'react'
import { signed, type TotalBreakdown as Breakdown } from './builder'

export function TotalBreakdown({ label, breakdown, signedTotal = false }: {
  label: string
  breakdown: Breakdown
  signedTotal?: boolean
}) {
  const id = useId()
  return <>
    <button type="button" className="total-breakdown-trigger" popoverTarget={id}
      aria-label={`${label} ${signedTotal ? signed(breakdown.total) : breakdown.total}: show breakdown`}
      onClick={event => event.stopPropagation()}>
      {signedTotal ? signed(breakdown.total) : breakdown.total}
    </button>
    <span id={id} popover="auto" className="total-breakdown" role="note" onClick={event => event.stopPropagation()}>
      <strong>{label}: {signedTotal ? signed(breakdown.total) : breakdown.total}</strong>
      <span className="total-breakdown-parts">{breakdown.parts.map((part, index) => <span className="total-breakdown-part" key={`${part.label}:${index}`}>
        <span>{part.label}{part.note && <small> ({part.note})</small>}</span><b>{signed(part.value)}</b>
      </span>)}</span>
      {breakdown.notes?.map(note => <span className="total-breakdown-note" key={note}>{note}</span>)}
    </span>
  </>
}
