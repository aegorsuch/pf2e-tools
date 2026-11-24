import type { ComponentProps } from 'react'
import { ActionIcon } from './ActionIcon'
import { namedArmorAbilities } from './namedArmor'
import { DamageRoll } from './SpellDamage'
import type { ContentEntry } from './types'

export function NamedArmorAbilities({ entry, inlineSummary = false, avatar, activations, damageRolls }: {
  entry?: ContentEntry; inlineSummary?: boolean
  avatar?: { active: boolean; disabled: boolean; toggle: () => void }
  activations?: Record<string, { label: string; active?: boolean; disabled?: boolean; toggle: () => void }>
  damageRolls?: Record<string, Omit<ComponentProps<typeof DamageRoll>, 'actions'>>
}) {
  const abilities = namedArmorAbilities(entry)
  if (!abilities.length) return null
  return <div className="col">
    {abilities.map(ability => inlineSummary && ability.name === 'Summary'
      ? <div className="col" key={ability.name}>{ability.paragraphs.map((paragraph, index) => <small key={index}>{paragraph}</small>)}</div>
      : <details key={ability.name}>
      <summary>{ability.name} {damageRolls?.[ability.name]
        ? <span onClick={event => event.stopPropagation()}><DamageRoll {...damageRolls[ability.name]} actions={ability.actions} /></span>
        : activations?.[ability.name]
        ? <button type="button" className={`spell-action-button${activations[ability.name].active ? ' on' : ''}`}
          aria-label={activations[ability.name].label} aria-pressed={!!activations[ability.name].active}
          disabled={activations[ability.name].disabled}
          onClick={event => { event.preventDefault(); event.stopPropagation(); activations[ability.name].toggle() }}><ActionIcon actions={ability.actions} /></button>
        : avatar && ability.actions === 'Two Actions' && ability.paragraphs.some(p => /\bcasts avatar\b/i.test(p))
        ? <button type="button" className={`spell-action-button${avatar.active ? ' on' : ''}`}
          aria-label={`${avatar.active ? 'Dismiss' : 'Activate'} Ancestral Embrace Avatar`}
          aria-pressed={avatar.active} disabled={avatar.disabled}
          onClick={event => { event.preventDefault(); event.stopPropagation(); avatar.toggle() }}><ActionIcon actions={ability.actions} /></button>
        : <ActionIcon actions={ability.actions} />}</summary>
      {ability.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </details>)}
  </div>
}
