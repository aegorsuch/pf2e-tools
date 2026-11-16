import type { ContentEntry } from './types'
import { DIVINE_INTERCESSIONS } from './divineIntercessions'

const AUTOMATED = new Set(['Asmodeus:moderate-boon', 'Asmodeus:minor-curse', 'Asmodeus:major-curse'])

export function DivineIntercessions({ deity, selected, onChange }: {
  deity: ContentEntry
  selected: string[]
  onChange: (selected: string[]) => void
}) {
  const data = DIVINE_INTERCESSIONS[deity.name]
  if (!data) return null
  const toggle = (id: string, checked: boolean) => onChange(
    checked ? [...new Set([...selected, id])] : selected.filter(value => value !== id),
  )
  return (
    <section className="divine-intercessions" aria-label="Divine Intercessions">
      <h5>Divine Intercessions</h5>
      <p>These GM-awarded boons and curses are optional trackers, not character choices. Uncheck an intercession when it ends.</p>
      {data.unavailable ? <p>{data.unavailable}</p> : data.items?.map(item => {
        const key = `${deity.name}:${item.id}`
        const automated = AUTOMATED.has(key)
        return <div className="divine-intercession" key={item.id}>
          <label>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={event => toggle(item.id, event.target.checked)} />
            {' '}{item.tier} {item.kind}
          </label>
          <p>{item.description}</p>
          {!automated && <small>Track only; apply this effect and its duration or conditions manually.</small>}
        </div>
      })}
      <small><a href={data.source} target="_blank" rel="noreferrer">Archives of Nethys source</a></small>
    </section>
  )
}
