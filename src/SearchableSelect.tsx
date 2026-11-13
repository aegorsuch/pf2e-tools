import { Fragment, useId, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { PickerDialog } from './PickerDialog'
import { searchSelectOptions, selectOptionCount, selectOptionList } from './searchSelectOptions'

type Props = Omit<ComponentPropsWithoutRef<'select'>, 'multiple' | 'defaultValue' | 'value'> & {
  'aria-label': string
  value: string
  label?: string
  onPrepare?: () => void
  optionCount?: number
  renderDetails?: (value: string) => ReactNode
}

const PAGE = 100

export function SearchableSelect({ label, onPrepare, optionCount, renderDetails, children, onChange, value, ...props }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const select = useRef<HTMLSelectElement>(null)
  const generatedId = useId()
  const id = props.id ?? generatedId
  const searchLabel = `Search ${props['aria-label'].replace(/^(?:add|choose)\s+/i, '').toLowerCase()}`
  const searchable = useMemo(() => (optionCount ?? selectOptionCount(children)) > 10, [children, optionCount])
  const activeQuery = searchable ? query.trim() : ''
  const filtered = activeQuery ? searchSelectOptions(children, activeQuery, value) : { children, matches: 0 }
  const options = useMemo(() => selectOptionList(children), [children])
  const matching = activeQuery ? selectOptionList(filtered.children) : options
  const shown = matching.slice(0, limit)
  const choose = (next: string) => {
    const control = select.current
    if (!control || props.disabled || !options.some(option => option.value === next && !option.disabled)) return
    control.value = next
    control.dispatchEvent(new Event('change', { bubbles: true }))
    setOpen(false)
    setQuery('')
  }
  return <span className="searchable-select">
    {label && <label htmlFor={id}>{label}</label>}
    {searchable && <button onFocus={onPrepare} onPointerDown={onPrepare}
      type="button" id={id} className="feat-picker-button" aria-label={props['aria-label']} aria-haspopup="dialog"
      aria-expanded={open} aria-describedby={props['aria-describedby']} disabled={props.disabled} onClick={() => {
        onPrepare?.()
        setQuery('')
        setLimit(PAGE)
        setOpen(true)
      }}>{options.find(option => option.value === value)?.label ?? (value || 'Choose')}</button>}
    <select {...props} ref={select} id={searchable ? `${id}-value` : id} value={value} hidden={searchable}
      onChange={event => { onChange?.(event); setQuery('') }}>
      {children}
    </select>
    {searchable && open && <PickerDialog label={`${props['aria-label']} picker`} searchLabel={searchLabel}
      query={query} onQuery={next => { setQuery(next); setLimit(PAGE) }} onClose={() => setOpen(false)}>
      <ul className="feat-modal-list">
        {shown.map((option, index) => <Fragment key={option.value}>
          {option.group && (index === 0 || shown[index - 1].group !== option.group)
            && <li className="feat-modal-level">{option.group}</li>}
          <li className="picker-option-row">
            <button type="button" aria-label={`${props['aria-label']}: ${option.label}`} disabled={option.disabled}
              className={option.value === value ? 'active' : undefined} onClick={() => choose(option.value)}>{option.label}</button>
            {renderDetails?.(option.value)}
          </li>
        </Fragment>)}
      </ul>
      {activeQuery && !filtered.matches && <small role="status">No matches.</small>}
      {matching.length > shown.length && <button type="button" onClick={() => setLimit(limit + PAGE)}>
        Show more ({matching.length - shown.length} left, or use search)
      </button>}
    </PickerDialog>}
  </span>
}
