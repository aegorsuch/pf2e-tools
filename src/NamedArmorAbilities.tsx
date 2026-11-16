import { ActionIcon } from './ActionIcon'
import { namedArmorAbilities } from './namedArmor'
import type { ContentEntry } from './types'

export function NamedArmorAbilities({ entry }: { entry?: ContentEntry }) {
  const abilities = namedArmorAbilities(entry)
  if (!abilities.length) return null
  return <div className="col">
    <small>Activations, limited uses, and conditional effects are tracked manually.
      {entry?.data.named_armor && ' Worn magic armor is treated as invested.'}
    </small>
    {entry?.name.startsWith("Slithermaw's Bane") && <small>
      The resilient rune grants an additional +1 item bonus only on saves versus poison, not all saving throws.
      Terrain adaptation bonuses apply only in the chosen environment.
      {entry.name.endsWith('(Artifact)') && ' The armor’s own senses, skills, attributes, and actions are not the wearer’s statistics. Track heroic legacy choices separately.'}
    </small>}
    {entry?.name === 'Ancestral Embrace' && <small>Choose the ancestry feat when investing the armor and track it separately; meet all prerequisites other than level. The feat is lost when investment ends.</small>}
    {entry?.name === 'Shadowed Scale, the Jungle Secret' && <small>Concealment applies only while wearing the mask in a jungle, not everywhere.</small>}
    {abilities.map(ability => <details key={ability.name}>
      <summary>{ability.name} <ActionIcon actions={ability.actions} /></summary>
      {ability.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </details>)}
  </div>
}
