export const REMOVAL_EVENT = 'pf2e-removal-confirmed'

export function confirmRemoval(label: string, remove: () => void) {
  if (!window.confirm(`Remove ${label}?`)) return
  if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent(REMOVAL_EVENT, { detail: label }))
  remove()
}
