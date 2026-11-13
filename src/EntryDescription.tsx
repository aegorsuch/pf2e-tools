import { useId, useRef } from 'react'
import type { ContentEntry } from './types'
import type { PrerequisiteCheck } from './featPrerequisites'
import type { FeatAccessCheck } from './featAccess'
import { featRarity } from './featAccess'
import { ActionIcon } from './ActionIcon'

export function EntryDescription({ name, entry, className, prerequisites, access, buttonLabel, grantSource }: {
  name: string; entry?: ContentEntry; className?: string; prerequisites?: PrerequisiteCheck; access?: FeatAccessCheck; buttonLabel?: string; grantSource?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const featActions = entry?.kind === 'feat' && typeof entry.data.actions === 'string' && entry.data.actions.trim() !== ''
  const rarity = entry && featRarity(entry)
  return (
    <>
      <button type="button" className={className} aria-label={buttonLabel ? `${buttonLabel}: ${name}` : undefined}
        aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        {buttonLabel ?? name}{(!!prerequisites?.missing.length || access && !access.automatic && !access.approved) && <> <span role="img"
          aria-label={prerequisites?.missing.length ? 'Prerequisites unmet' : 'Access information'}>*</span></>}
        {featActions && !buttonLabel && <> <ActionIcon entry={entry} /></>}
        {grantSource && <> <small>({grantSource})</small></>}
      </button>
      <dialog ref={dialog} className="entry-dialog" aria-labelledby={titleId}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }}>
        <h4 id={titleId}>{name}{featActions && <> <ActionIcon entry={entry} /></>}{entry && <small> (Level {entry.level}{rarity ? `; ${rarity}` : ''})</small>}</h4>
        {!!prerequisites?.missing.length && <p className="feat-prerequisite-note" role="status">
          Prerequisites unmet: {prerequisites.missing.join('; ')}
        </p>}
        {!!prerequisites?.manual.length && <p className="feat-prerequisite-note">
          Check prerequisites manually: {prerequisites.manual.join('; ')}
        </p>}
        {access && <p className="feat-prerequisite-note">
          Access: {access.requirement}{/[.!?]$/.test(access.requirement) ? '' : '.'} {access.automatic
            ? access.source === 'achievement' ? 'Satisfied by checked achievement.' : 'Granted by selected ethnicity.'
            : access.approved ? 'GM approved access.' : 'Access not established; GM permission required.'}
          {' '}Access does not replace prerequisites.
        </p>}
        <p>{entry?.description || 'Description unavailable. Sync Archives of Nethys content to load it.'}</p>
        {typeof entry?.data.url === 'string' && <p><a href={entry.data.url} target="_blank" rel="noreferrer">Archives of Nethys</a></p>}
        <form method="dialog"><button autoFocus>Close</button></form>
      </dialog>
    </>
  )
}
