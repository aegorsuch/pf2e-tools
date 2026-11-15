import { newId } from './db'
import type { SectionProps } from './builder'
import type { Character } from './types'

export function ItemTroubleshoot({ c, save, id, kind, label, attach, creature = false }: Pick<SectionProps, 'c' | 'save'> & {
  id?: string
  kind: string
  label: string
  attach?: (id: string) => Partial<Character>
  creature?: boolean
}) {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e')) return null
  const key = id ? `${kind}:${id}` : undefined
  const glitching = key ? c.mechanicGlitching?.[key] ?? 0 : 0
  const update = (value: number) => {
    if (!Number.isInteger(value) || value < 0 || !id && !attach && value > 0) return
    if (!id && value === 0) return
    const itemId = id ?? newId()
    const next = { ...c.mechanicGlitching }
    if (value) next[`${kind}:${itemId}`] = value
    else delete next[`${kind}:${itemId}`]
    save({ ...(!id ? attach?.(itemId) : {}), mechanicGlitching: next })
  }
  return <details>
    <summary>{glitching ? `Glitching ${glitching}` : 'Troubleshoot'}</summary>
    <div className="row">
    <label>Glitching{' '}<input type="number" min={0} step={1} aria-label={`Glitching: ${label}`}
      value={glitching} onChange={event => {
        const value = Number(event.target.value)
        if (event.target.value !== '' && Number.isInteger(value) && value >= 0) update(value)
      }} /></label>
    <button type="button" disabled={!glitching} onClick={() => update(glitching - 1)}>Troubleshoot</button>
    {glitching > 0 && <small>Flat check DC {5 + glitching} {creature ? 'at the start of each turn' : 'when using this item'}; apply the result manually.</small>}
    </div>
  </details>
}
