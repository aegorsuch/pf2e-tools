import { classFeatures, type SectionProps } from './builder'

export function ClassFeatures({ c, entries }: SectionProps) {
  if (!c.className) return null
  const features = classFeatures(entries, c)
  const imported = entries.some((e) => e.kind === 'classFeature')
  return (
    <>
      <h4>Class Features ({features.length})</h4>
      {!imported && <p>Class feature data is still loading.</p>}
      <ul>
        {features.map((f) => (
          <li key={f.id}>
            <b>L{String(f.level).padStart(2, '0')} {f.name}</b>
            {f.description && <><br /><small>{f.description}</small></>}
          </li>
        ))}
      </ul>
    </>
  )
}
