import { ActionIcon } from './ActionIcon'
import { namedArmorAbilities } from './namedArmor'
import type { ContentEntry } from './types'

export function NamedArmorAbilities({ entry }: { entry?: ContentEntry }) {
  const abilities = namedArmorAbilities(entry)
  if (!abilities.length) return null
  return <div className="col">
    {entry?.name === 'Shadowed Scale, the Jungle Secret' && <small>Concealment applies only while wearing the mask in a jungle, not everywhere.</small>}
    {abilities.map(ability => <details key={ability.name}>
      <summary>{ability.name} <ActionIcon actions={ability.actions} /></summary>
      {ability.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </details>)}
  </div>
}
