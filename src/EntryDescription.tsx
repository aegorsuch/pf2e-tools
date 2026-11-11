import { useId, useRef } from 'react'
import type { ContentEntry } from './types'

export function EntryDescription({ name, entry, className }: { name: string; entry?: ContentEntry; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>{name}</button>
      <dialog ref={dialog} className="entry-dialog" aria-labelledby={titleId}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }}>
        <h4 id={titleId}>{name}{entry && <small> (Level {entry.level})</small>}</h4>
        <p>{entry?.description || 'Description unavailable. Sync Archives of Nethys content to load it.'}</p>
        {typeof entry?.data.url === 'string' && <p><a href={entry.data.url} target="_blank" rel="noreferrer">Archives of Nethys</a></p>}
        <form method="dialog"><button autoFocus>Close</button></form>
      </dialog>
    </>
  )
}
