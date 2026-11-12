import { useId, type ReactNode } from 'react'

export function SourceNote({ source, note }: { source: string; note: string }) {
  const id = useId()
  return <>
    <button type="button" className="source-note-trigger" popoverTarget={id}
      aria-label={`${source} note`} title={note}>*</button> ({source})
    <span id={id} popover="auto" className="source-note" role="note">{note}</span>
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
