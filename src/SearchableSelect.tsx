import { Fragment, useId, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { PickerDialog } from './PickerDialog'
import { selectOptionCount, selectOptionList } from './searchSelectOptions'

type Props = Omit<ComponentPropsWithoutRef<'select'>, 'multiple' | 'defaultValue' | 'value'> & {
  'aria-label': string
  value: string
  label?: string
  onPrepare?: () => void
  onClear?: () => void
  optionCount?: number
  alwaysSearchable?: boolean
  filters?: ReactNode
  primaryDetails?: boolean
  renderDetails?: (value: string) => ReactNode
  searchText?: (value: string) => string
}

const PAGE = 100

export function SearchableSelect({ label, onPrepare, onClear, optionCount, alwaysSearchable = false, filters, primaryDetails = false, renderDetails, searchText, children, onChange, value, ...props }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [container, setContainer] = useState<HTMLElement>()
  const select = useRef<HTMLSelectElement>(null)
  const generatedId = useId()
  const id = props.id ?? generatedId
  const searchLabel = `Search ${props['aria-label'].replace(/^(?:add|choose)\s+/i, '').toLowerCase()}`
  const searchable = useMemo(() => alwaysSearchable || (optionCount ?? selectOptionCount(children)) > 10, [children, optionCount, alwaysSearchable])
  const options = useMemo(() => selectOptionList(children), [children])
  const activeQuery = searchable && open ? query.trim().toLowerCase() : ''
  let matches = 0
  const matching: typeof options = []
  if (open) for (const option of options) {
    const match = !activeQuery || `${option.label} ${option.value} ${searchText?.(option.value) ?? ''}`.toLowerCase().includes(activeQuery)
    if (activeQuery && option.value && match) matches++
    if ((!primaryDetails || option.value) && (match || !option.value || option.value === value)) matching.push(option)
  }
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
    <span className="searchable-select-control">
      {searchable && <button onFocus={onPrepare} onPointerDown={onPrepare}
        type="button" id={id} className="feat-picker-button" aria-label={props['aria-label']} aria-haspopup="dialog"
        aria-expanded={open} aria-describedby={props['aria-describedby']} disabled={props.disabled} onClick={event => {
          onPrepare?.()
          setQuery('')
          setLimit(PAGE)
          setContainer(event.currentTarget.closest('dialog[open]') ?? undefined)
          setOpen(true)
        }}>{options.find(option => option.value === value)?.label ?? (value || 'Choose')}</button>}
      <select {...props} ref={select} id={searchable ? `${id}-value` : id} value={value} hidden={searchable}
        onChange={event => { onChange?.(event); setQuery('') }}>
        {children}
      </select>
      {onClear && value && <button type="button" className="searchable-select-clear"
        aria-label={`Clear ${props['aria-label']}`} title="Clear selection" disabled={props.disabled}
        onClick={onClear}>×</button>}
    </span>
    {searchable && open && <PickerDialog label={`${props['aria-label']} picker`} searchLabel={searchLabel}
      container={container}
      query={query} onQuery={next => { setQuery(next); setLimit(PAGE) }} onClose={() => setOpen(false)}>
      {filters}
      <ul className="feat-modal-list">
        {shown.map((option, index) => <Fragment key={option.value}>
          {option.group && (index === 0 || shown[index - 1].group !== option.group)
            && <li className="feat-modal-level">{option.group}</li>}
          <li className="picker-option-row">
            {primaryDetails ? <>
              <button type="button" className="picker-add" aria-label={`Select ${option.label}`}
                disabled={option.disabled} onClick={() => choose(option.value)}>+</button>
              {renderDetails?.(option.value) ?? <span className="picker-spell-name">{option.label}</span>}
            </> : <>
              <button type="button" aria-label={`${props['aria-label']}: ${option.label}`} disabled={option.disabled}
                className={option.value === value ? 'active' : undefined} onClick={() => choose(option.value)}>{option.label}</button>
              {renderDetails?.(option.value)}
            </>}
          </li>
        </Fragment>)}
      </ul>
      {activeQuery && !matches && <small role="status">No matches.</small>}
      {matching.length > shown.length && <button type="button" onClick={() => setLimit(limit + PAGE)}>
        Show more ({matching.length - shown.length} left, or use search)
      </button>}
    </PickerDialog>}
  </span>
}
