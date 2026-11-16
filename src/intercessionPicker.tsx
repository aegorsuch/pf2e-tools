import type { ContentEntry } from './types'
import { DIVINE_INTERCESSIONS } from './divineIntercessions'

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
      <p>These GM-awarded boons are optional. Uncheck a boon when it ends.</p>
      {data.unavailable ? <p>{data.unavailable}</p> : data.items?.filter(item => item.kind === 'Boon').map(item => {
        return <div className="divine-intercession" key={item.id}>
          <label>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={event => toggle(item.id, event.target.checked)} />
            {' '}<strong>{item.tier} Boon:</strong> {item.description}
          </label>
        </div>
      })}
      <small><a href={data.source} target="_blank" rel="noreferrer">Archives of Nethys source</a></small>
    </section>
  )
}
