import { ActionIcon } from './ActionIcon'
import { namedArmorAbilities } from './namedArmor'
import type { ContentEntry } from './types'

export function NamedArmorAbilities({ entry, inlineSummary = false }: { entry?: ContentEntry; inlineSummary?: boolean }) {
  const abilities = namedArmorAbilities(entry)
  if (!abilities.length) return null
  return <div className="col">
    {abilities.map(ability => inlineSummary && ability.name === 'Summary'
      ? <div className="col" key={ability.name}>{ability.paragraphs.map((paragraph, index) => <small key={index}>{paragraph}</small>)}</div>
      : <details key={ability.name}>
      <summary>{ability.name} <ActionIcon actions={ability.actions} /></summary>
      {ability.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </details>)}
  </div>
}
