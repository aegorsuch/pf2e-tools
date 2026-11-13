import { useId, type ReactNode } from 'react'

export function SourceNote({ source, note, inlineSource = true }: { source: string; note: string; inlineSource?: boolean }) {
  const id = useId()
  const summary = inlineSource ? note : `${note} (${source})`
  return <>
    <button type="button" className="source-note-trigger" popoverTarget={id}
      aria-label={`${source} note`} title={summary}>*</button>{inlineSource && ` (${source})`}
    <span id={id} popover="auto" className="source-note" role="note">{summary}</span>
  </>
}

export function Info({ label = 'Info', children }: { label?: string; children: ReactNode }) {
  return (
    <details className="info">
      <summary>{label}</summary>
      <small>{children}</small>
    </details>
  )
}
