import { useId, useRef, useState } from 'react'
import type { ContentEntry } from './types'
import type { PrerequisiteCheck } from './featPrerequisites'
import type { FeatAccessCheck } from './featAccess'
import { featRarity } from './featAccess'
import { ActionIcon } from './ActionIcon'

const featIndexes = new WeakMap<ContentEntry[], { urls: Map<string, ContentEntry>; names: Map<string, ContentEntry> }>()
function featIndex(entries: ContentEntry[]) {
  let index = featIndexes.get(entries)
  if (!index) {
    index = { urls: new Map(), names: new Map() }
    for (const candidate of entries) {
      if (candidate.kind !== 'feat' || candidate.deleted) continue
      if (typeof candidate.data.url === 'string' && !index.urls.has(candidate.data.url)) index.urls.set(candidate.data.url, candidate)
      for (const system of candidate.systems) {
        const key = `${system}:${candidate.name.toLowerCase()}`
        if (!index.names.has(key)) index.names.set(key, candidate)
      }
    }
    featIndexes.set(entries, index)
  }
  return index
}

export function EntryDescription({ name, entry, className, prerequisites, access, buttonLabel, grantSource, descriptionNote, entries }: {
  name: string; entry?: ContentEntry; className?: string; prerequisites?: PrerequisiteCheck; access?: FeatAccessCheck; buttonLabel?: string; grantSource?: string; descriptionNote?: string; entries?: ContentEntry[]
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [history, setHistory] = useState<ContentEntry[]>([])
  const active = history.at(-1) ?? entry
  const featActions = active?.kind === 'feat' && typeof active.data.actions === 'string' && active.data.actions.trim() !== ''
  const rarity = active && featRarity(active)
  const index = entries && active?.featLinks?.length ? featIndex(entries) : undefined
  const leads = index && active?.featLinks?.map(link => ({
    ...link, target: index.urls.get(link.url)
      ?? active.systems.map(system => index.names.get(`${system}:${link.name.toLowerCase()}`)).find(Boolean),
  }))
  const description = leads?.length ? active?.description.replace(/\n\n[^\n]*\bleads to\.\.\.[\s\S]*$/i, '') : active?.description
  return (
    <>
      <button type="button" className={className} aria-label={buttonLabel ? `${buttonLabel}: ${name}` : undefined}
        aria-haspopup="dialog" onClick={() => {
          dialog.current?.showModal()
          dialog.current?.querySelector('h4')?.focus()
        }}>
        {buttonLabel ?? name}{(!!prerequisites?.missing.length || access && !access.automatic && !access.approved) && <> <span role="img"
          aria-label={prerequisites?.missing.length ? 'Prerequisites unmet' : 'Access information'}>*</span></>}
        {entry?.kind === 'feat' && typeof entry.data.actions === 'string' && entry.data.actions.trim() && !buttonLabel && <> <ActionIcon entry={entry} /></>}
        {grantSource && <> <small>({grantSource})</small></>}
      </button>
      <dialog ref={dialog} className="entry-dialog" aria-labelledby={titleId}
        onClose={() => setHistory([])}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }}>
        <h4 id={titleId} tabIndex={-1}>{history.length ? active?.name : name}{featActions && <> <ActionIcon entry={active} /></>}{active && active.kind !== 'trait' && <small> (Level {active.level}{rarity ? `; ${rarity}` : ''})</small>}</h4>
        {!history.length && !!prerequisites?.missing.length && <p className="feat-prerequisite-note" role="status">
          Prerequisites unmet: {prerequisites.missing.join('; ')}
        </p>}
        {!history.length && !!prerequisites?.manual.length && <p className="feat-prerequisite-note">
          Check prerequisites manually: {prerequisites.manual.join('; ')}
        </p>}
        {!history.length && access && <p className="feat-prerequisite-note">
          Access: {access.requirement}{/[.!?]$/.test(access.requirement) ? '' : '.'} {access.automatic
            ? access.source === 'achievement' ? 'Satisfied by checked achievement.' : 'Granted by selected ethnicity.'
            : access.approved ? 'GM approved access.' : 'Access not established; GM permission required.'}
          {' '}Access does not replace prerequisites.
        </p>}
        <p>{description || 'Description unavailable. Sync Archives of Nethys content to load it.'}</p>
        {!history.length && descriptionNote && <p>{descriptionNote}</p>}
        {!!leads?.length && <p>Leads to: {leads.map((link, index) => <span key={`${link.url}:${index}`}>
          {index > 0 && ', '}{link.target
            ? <button type="button" onClick={() => { const target = link.target; if (target) setHistory(previous => [...previous, target]); dialog.current?.querySelector('h4')?.focus() }}>{link.name}</button>
            : <span>{link.name} (unavailable)</span>}
        </span>)}</p>}
        {typeof active?.data.url === 'string' && <p><a href={active.data.url} target="_blank" rel="noreferrer">Archives of Nethys</a></p>}
        {history.length > 0 && <button type="button" onClick={() => { setHistory(previous => previous.slice(0, -1)); dialog.current?.querySelector('h4')?.focus() }}>Back</button>}
        <form method="dialog"><button autoFocus>Close</button></form>
      </dialog>
    </>
  )
}
