import { classFeatures, type SectionProps } from './builder'

export function ClassFeatures({ c, entries }: SectionProps) {
  if (!c.className) return null
  const features = classFeatures(entries, c)
  const imported = entries.some((e) => e.kind === 'classFeature')
  return (
    <>
      <h3>Class features ({features.length})</h3>
      {!imported && <p>No class feature data yet. Re-run "Import official (AoN)".</p>}
      <ul>
        {features.map((f) => (
          <li key={f.id}>
            <b>{f.name}</b> <small>(L{f.level})</small>
            {f.description && <><br /><small>{f.description}</small></>}
          </li>
        ))}
      </ul>
    </>
  )
}
