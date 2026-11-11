import { Info } from './Info'
import { classFeatures, type SectionProps } from './builder'
import { ActionIcon } from './ActionIcon'

export function ClassFeatures({ c, entries }: SectionProps) {
  if (!c.className) return null
  const features = classFeatures(entries, c)
  const imported = entries.some((e) => e.kind === 'classFeature')
  return (
    <details className="character-subsection">
      <summary><h4>Class Features ({features.length})</h4></summary>
      {!imported && <p>Class feature data is still loading.</p>}
      <ul>
        {features.map((f) => (
          <li key={f.id}>
            <b>L{String(f.level).padStart(2, '0')} {f.name}</b> <ActionIcon entry={f} />
            {f.description && <Info>{f.description}</Info>}
          </li>
        ))}
      </ul>
    </details>
  )
}
