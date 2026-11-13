import { useId, useMemo, useState, type ComponentPropsWithoutRef } from 'react'
import { searchSelectOptions, selectOptionCount } from './searchSelectOptions'

type Props = Omit<ComponentPropsWithoutRef<'select'>, 'multiple' | 'defaultValue' | 'value'> & {
  'aria-label': string
  value: string
  label?: string
  onPrepare?: () => void
  optionCount?: number
}

export function SearchableSelect({ label, onPrepare, optionCount, children, onChange, value, ...props }: Props) {
  const [query, setQuery] = useState('')
  const generatedId = useId()
  const id = props.id ?? generatedId
  const statusId = `${id}-search-status`
  const searchLabel = `Search ${props['aria-label'].replace(/^(?:add|choose)\s+/i, '').toLowerCase()}`
  const searchable = useMemo(() => (optionCount ?? selectOptionCount(children)) > 10, [children, optionCount])
  const activeQuery = searchable ? query.trim() : ''
  const options = activeQuery ? searchSelectOptions(children, activeQuery, value) : { children, matches: 0 }
  return <span className="searchable-select">
    {label && <label htmlFor={id}>{label}</label>}
    {searchable && <input type="search" aria-label={searchLabel}
      placeholder={searchLabel} value={query} disabled={props.disabled}
      onFocus={onPrepare} onChange={event => {
        const next = event.target.value
        onPrepare?.()
        setQuery(next)
      }} />}
    <select {...props} id={id} value={value}
      aria-describedby={[props['aria-describedby'], activeQuery && !options.matches ? statusId : ''].filter(Boolean).join(' ') || undefined}
      onChange={event => { onChange?.(event); setQuery('') }}>
      {options.children}
    </select>
    {activeQuery && !options.matches && <small id={statusId} role="status">No matches.</small>}
  </span>
}
