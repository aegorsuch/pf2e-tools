import { Fragment, useId, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { PickerDialog } from './PickerDialog'
import { selectOptionCount, selectOptionList } from './searchSelectOptions'
import { PickerSort, sortPickerOptions, type PickerSortOrder } from './PickerSort'
import { SpellDefenseFilter } from './SpellDefenseFilter'
import { matchesSpellDefense, type SpellDefense } from './spellDefense'
import { GearSystemFilter } from './GearSystemFilter'
import { matchesGearSystem, type GearSystem } from './gearSystem'
import type { ContentEntry, GameSystem } from './types'

type Props = Omit<ComponentPropsWithoutRef<'select'>, 'multiple' | 'defaultValue' | 'value'> & {
  'aria-label': string
  value: string
  label?: string
  onPrepare?: () => void
  onClear?: () => void
  optionCount?: number
  alwaysSearchable?: boolean
  defaultSortOrder?: PickerSortOrder
  filters?: ReactNode
  primaryDetails?: boolean
  renderDetails?: (value: string) => ReactNode
  searchText?: (value: string) => string
  optionLevel?: (value: string) => number | undefined
  optionSortName?: (value: string) => string | undefined
  optionSpell?: (value: string) => ContentEntry | undefined
  optionSystems?: (value: string) => GameSystem[]
}

const PAGE = 100

export function SearchableSelect({ label, onPrepare, onClear, optionCount, alwaysSearchable = false, defaultSortOrder = 'name', filters, primaryDetails = false, renderDetails, searchText, optionLevel, optionSortName, optionSpell, optionSystems, children, onChange, value, ...props }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [container, setContainer] = useState<HTMLElement>()
  const [sort, setSort] = useState<PickerSortOrder>(defaultSortOrder)
  const [defense, setDefense] = useState<SpellDefense>('all')
  const [system, setSystem] = useState<GearSystem>('both')
  const select = useRef<HTMLSelectElement>(null)
  const generatedId = useId()
  const id = props.id ?? generatedId
  const searchLabel = `Search ${props['aria-label'].replace(/^(?:add|choose)\s+/i, '').toLowerCase()}`
  const searchable = useMemo(() => alwaysSearchable || !!optionLevel || !!optionSpell || (optionCount ?? selectOptionCount(children)) > 10, [children, optionCount, alwaysSearchable, optionLevel, optionSpell])
  const options = useMemo(() => selectOptionList(children), [children])
  const levelFor = useMemo(() => {
    if (!optionLevel || !open || sort !== 'level') return undefined
    const levels = new Map<string, number | undefined>()
    return (value: string) => {
      if (!levels.has(value)) levels.set(value, optionLevel(value))
      return levels.get(value)
    }
  }, [optionLevel, open, options, sort])
  const activeQuery = searchable && open ? query.trim().toLowerCase() : ''
  let matches = 0
  const matching: typeof options = []
  if (open) for (const option of options) {
    const match = !activeQuery || `${option.label} ${option.value} ${searchText?.(option.value) ?? ''}`.toLowerCase().includes(activeQuery)
    const needsSpell = optionSpell && (defense !== 'all' || system !== 'both')
      && !!option.value && (match || option.value === value)
    const spell = needsSpell ? optionSpell(option.value) : undefined
    const defenseMatch = !optionSpell || defense === 'all' || matchesSpellDefense(spell, defense)
    const systemMatch = system === 'both' || (optionSystems ? optionSystems(option.value).includes(system)
      : !optionSpell || !!spell && matchesGearSystem(spell, system, spell.systems))
    if (option.value && match && defenseMatch && systemMatch) matches++
    if ((!primaryDetails || option.value) && ((!option.value || match || option.value === value)
      && (!option.value || defenseMatch && systemMatch))) matching.push(option)
  }
  const ordered = optionLevel && open ? [
    ...matching.filter(option => !option.value),
    ...sortPickerOptions(matching.filter(option => !!option.value), sort,
      option => optionSortName?.(option.value) ?? option.label, option => levelFor?.(option.value)),
  ] : matching
  const shown = ordered.slice(0, limit)
  const choose = (next: string) => {
    const control = select.current
    if (!control || props.disabled || !options.some(option => option.value === next && !option.disabled)) return
    control.value = next
    control.dispatchEvent(new Event('change', { bubbles: true }))
    setOpen(false)
    setQuery('')
    setDefense('all')
    setSystem('both')
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
      {optionLevel && <PickerSort label={`Sort ${props['aria-label']} by`} value={sort}
        includeHighestLevel={defaultSortOrder === 'level-desc'} onChange={next => { setSort(next); setLimit(PAGE) }} />}
      {optionSpell && <SpellDefenseFilter value={defense} onChange={next => { setDefense(next); setLimit(PAGE) }} />}
      {(optionSpell || optionSystems) && <GearSystemFilter value={system} onChange={next => { setSystem(next); setLimit(PAGE) }} />}
      {filters}
      <ul className="feat-modal-list">
        {shown.map((option, index) => <Fragment key={option.value}>
          {!optionLevel && option.group && (index === 0 || shown[index - 1].group !== option.group)
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
      {(activeQuery || defense !== 'all' || system !== 'both') && !matches && <small role="status">No matches.</small>}
      {matching.length > shown.length && <button type="button" onClick={() => setLimit(limit + PAGE)}>
        Show more ({matching.length - shown.length} left, or use search)
      </button>}
    </PickerDialog>}
  </span>
}
