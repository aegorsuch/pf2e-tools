import type { ReactNode } from 'react'

export function Info({ label = 'Info', children }: { label?: string; children: ReactNode }) {
  return (
    <details className="info">
      <summary>{label}</summary>
      <small>{children}</small>
    </details>
  )
}
