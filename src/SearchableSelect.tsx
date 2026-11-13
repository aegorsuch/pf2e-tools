import { useId, useState, type ComponentPropsWithoutRef } from 'react'
import { searchSelectOptions } from './searchSelectOptions'

type Props = Omit<ComponentPropsWithoutRef<'select'>, 'multiple' | 'defaultValue' | 'value'> & {
  'aria-label': string
  value: string
  label?: string
  onPrepare?: () => void
}

export function SearchableSelect({ label, onPrepare, children, onChange, value, ...props }: Props) {
  const [query, setQuery] = useState('')
  const generatedId = useId()
  const id = props.id ?? generatedId
  const statusId = `${id}-search-status`
  const searchLabel = `Search ${props['aria-label'].replace(/^(?:add|choose)\s+/i, '').toLowerCase()}`
  const options = query.trim() ? searchSelectOptions(children, query, value) : { children, matches: 0 }
  return <span className="searchable-select">
    {label && <label htmlFor={id}>{label}</label>}
    <input type="search" aria-label={searchLabel}
      placeholder={searchLabel} value={query} disabled={props.disabled}
      onFocus={onPrepare} onChange={event => {
        const next = event.target.value
        onPrepare?.()
        setQuery(next)
      }} />
    <select {...props} id={id} value={value}
      aria-describedby={[props['aria-describedby'], query.trim() && !options.matches ? statusId : ''].filter(Boolean).join(' ') || undefined}
      onChange={event => { onChange?.(event); setQuery('') }}>
      {options.children}
    </select>
    {query.trim() && !options.matches && <small id={statusId} role="status">No matches.</small>}
  </span>
}
