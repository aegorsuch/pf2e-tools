import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function PickerDialog({ label, searchLabel, query, onQuery, onClose, children }: {
  label: string
  searchLabel: string
  query: string
  onQuery: (query: string) => void
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.activeElement
    search.current?.focus()
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  const content = <div className="feat-modal-backdrop" onClick={() => close.current()}>
    <div ref={panel} className="feat-modal" role="dialog" aria-modal="true" aria-label={label}
      onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (event.target instanceof Element && event.target.closest('dialog[open]')) return
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          close.current()
        } else if (event.key === 'Tab') {
          const controls = [...(panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ) ?? [])].filter(control => control.getClientRects().length > 0)
          const first = controls[0]
          const last = controls.at(-1)
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }
      }}>
      <label>{searchLabel}{' '}
        <input ref={search} type="search" aria-label={searchLabel} placeholder={searchLabel} value={query}
          onChange={event => onQuery(event.target.value)} />
      </label>
      {children}
      <button type="button" onClick={() => close.current()}>Cancel</button>
    </div>
  </div>
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}
