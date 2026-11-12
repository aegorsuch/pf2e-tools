import { useId, useRef } from 'react'
import type { ContentEntry } from './types'
import type { PrerequisiteCheck } from './featPrerequisites'
import type { FeatAccessCheck } from './featAccess'
import { ActionIcon } from './ActionIcon'

export function EntryDescription({ name, entry, className, prerequisites, access }: {
  name: string; entry?: ContentEntry; className?: string; prerequisites?: PrerequisiteCheck; access?: FeatAccessCheck
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const featActions = entry?.kind === 'feat' && typeof entry.data.actions === 'string' && entry.data.actions.trim() !== ''
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        {name}{(!!prerequisites?.missing.length || access) && <> <span role="img"
          aria-label={prerequisites?.missing.length ? 'Prerequisites unmet' : 'Access information'}>*</span></>}
        {featActions && <> <ActionIcon entry={entry} /></>}
      </button>
      <dialog ref={dialog} className="entry-dialog" aria-labelledby={titleId}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }}>
        <h4 id={titleId}>{name}{featActions && <> <ActionIcon entry={entry} /></>}{entry && <small> (Level {entry.level})</small>}</h4>
        {!!prerequisites?.missing.length && <p className="feat-prerequisite-note" role="status">
          Prerequisites unmet: {prerequisites.missing.join('; ')}
        </p>}
        {!!prerequisites?.manual.length && <p className="feat-prerequisite-note">
          Check prerequisites manually: {prerequisites.manual.join('; ')}
        </p>}
        {access && <p className="feat-prerequisite-note">
          Access: {access.requirement}. {access.automatic ? 'Granted by selected ethnicity.' : access.approved ? 'GM approved access.' : 'Access not established; GM permission required.'}
          {' '}Access does not replace prerequisites.
        </p>}
        <p>{entry?.description || 'Description unavailable. Sync Archives of Nethys content to load it.'}</p>
        {typeof entry?.data.url === 'string' && <p><a href={entry.data.url} target="_blank" rel="noreferrer">Archives of Nethys</a></p>}
        <form method="dialog"><button autoFocus>Close</button></form>
      </dialog>
    </>
  )
}
