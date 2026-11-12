export function confirmRemoval(label: string, remove: () => void) {
  if (window.confirm(`Remove ${label}?`)) remove()
}
