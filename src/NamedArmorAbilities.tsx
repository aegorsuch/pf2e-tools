import { ActionIcon } from './ActionIcon'
import { namedArmorAbilities } from './namedArmor'
import type { ContentEntry } from './types'

export function NamedArmorAbilities({ entry, inlineSummary = false, avatar }: {
  entry?: ContentEntry; inlineSummary?: boolean
  avatar?: { active: boolean; disabled: boolean; toggle: () => void }
}) {
  const abilities = namedArmorAbilities(entry)
  if (!abilities.length) return null
  return <div className="col">
    {abilities.map(ability => inlineSummary && ability.name === 'Summary'
      ? <div className="col" key={ability.name}>{ability.paragraphs.map((paragraph, index) => <small key={index}>{paragraph}</small>)}</div>
      : <details key={ability.name}>
      <summary>{ability.name} {avatar && ability.actions === 'Two Actions' && ability.paragraphs.some(p => /\bcasts avatar\b/i.test(p))
        ? <button type="button" className={`spell-action-button${avatar.active ? ' on' : ''}`}
          aria-label={`${avatar.active ? 'Dismiss' : 'Activate'} Ancestral Embrace Avatar`}
          aria-pressed={avatar.active} disabled={avatar.disabled}
          onClick={event => { event.preventDefault(); event.stopPropagation(); avatar.toggle() }}><ActionIcon actions={ability.actions} /></button>
        : <ActionIcon actions={ability.actions} />}</summary>
      {ability.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </details>)}
  </div>
}
