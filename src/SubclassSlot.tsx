import { useState } from 'react'
import { EntryDescription } from './EntryDescription'
import { PickerDialog } from './PickerDialog'
import type { Character, ContentEntry } from './types'

type Props = {
  c: Character
  entries: ContentEntry[]
  label: string
  options: ContentEntry[]
  selected?: ContentEntry
  displayName?: (entry: ContentEntry) => string
  describe?: (entry: ContentEntry) => ContentEntry
  disabled?: boolean
  onChange: (name: string | undefined) => void
}

// Subclass choice styled like a feat slot: a row that opens a searchable list and clears with the minus button.
export function SubclassSlot({ c, entries, label, options, selected, displayName = entry => entry.name, describe = entry => entry, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = options.filter(entry => !needle || `${entry.name} ${entry.description}`.toLowerCase().includes(needle))
  return <>
    {selected
      ? <EntryDescription character={c} name={displayName(selected)} entry={describe(selected)} entries={entries} className="feat-name" />
      : <button type="button" className="feat-name feat-picker-button" aria-label={`${label} feat`} aria-haspopup="dialog" aria-expanded={open}
        disabled={disabled} onClick={() => setOpen(true)}>Choose {label}</button>}
    {selected && <button type="button" aria-label={`Clear ${label}`} title="Clear selection" disabled={disabled}
      onClick={() => onChange(undefined)}>−</button>}
    {open && <PickerDialog label={`${label} feat picker`} searchLabel={`Search ${label}`} query={query} onQuery={setQuery} onClose={() => { setOpen(false); setQuery('') }}>
      <ul className="feat-modal-list">
        {shown.map(entry => <li key={entry.id}><button type="button" onClick={() => { onChange(entry.name); setOpen(false); setQuery('') }}>{displayName(entry)}</button></li>)}
      </ul>
      {!shown.length && <small role="status">No matching options.</small>}
    </PickerDialog>}
  </>
}
