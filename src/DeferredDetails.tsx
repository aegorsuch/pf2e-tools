import { Children, memo, useState, type ReactNode } from 'react'

const DeferredBody = memo(function DeferredBody({ children }: { open: boolean; children: ReactNode }) {
  return children
}, (_previous, next) => !next.open)

export function DeferredDetails({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  const [summary, ...body] = Children.toArray(children)

  return <details className="character-section" onToggle={event => {
    if (event.target !== event.currentTarget) return
    const next = event.currentTarget.open
    setOpen(next)
    if (next) setOpened(true)
  }}>
    {summary}
    {opened && <DeferredBody open={open}>{body}</DeferredBody>}
  </details>
}
