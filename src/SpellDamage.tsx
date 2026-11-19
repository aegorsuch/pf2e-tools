import { useState } from 'react'
import { ActionIcon } from './ActionIcon'
import type { ContentEntry } from './types'

type Damage = { label: string; dice: number; sides: number; type: string; bonus?: number; criticalBleed?: number }

export function spellDamage(name: string, rank: number): Damage[] {
  switch (name) {
    case 'Fireball':
      return rank >= 3 ? [{ label: 'Damage', dice: 6 + 2 * (rank - 3), sides: 6, type: 'fire' }] : []
    case 'Needle Darts':
      return rank >= 1 ? [{ label: 'Damage', dice: rank + 2, sides: 4, type: 'piercing', criticalBleed: rank }] : []
    case 'Grisly Growths':
      return rank >= 5 ? [{ label: 'Damage', dice: 2 * rank, sides: 6, type: 'piercing' }] : []
    case 'Execute':
      return rank >= 7 ? [{ label: 'Damage', dice: 0, sides: 0, bonus: 10 * rank, type: 'vitality or void' }] : []
    case 'Desiccate':
      return rank >= 8 ? [{ label: 'Damage', dice: 10 + rank - 8, sides: 10, type: 'void' }] : []
    case 'Massacre':
      return rank >= 9 ? [{ label: 'Success', dice: rank >= 10 ? 10 : 9, sides: 6, type: 'void' }] : []
    case 'Void Warp':
      return rank >= 1 ? [{ label: 'Damage', dice: rank + 1, sides: 4, type: 'void' }] : []
    case 'Deathly Scream':
      return rank >= 1 ? [{ label: 'Damage', dice: rank, sides: 4, type: 'mental' }] : []
    case 'Harm':
      return rank >= 1 ? [{ label: 'Damage', dice: rank, sides: 8, type: 'void' }] : []
    case 'Heal Animal':
    case 'Heal Companion':
      return rank >= 1 ? [
        { label: '1-action healing', dice: rank, sides: name === 'Heal Animal' ? 8 : 10, type: 'HP' },
        { label: '2-action healing', dice: rank, sides: name === 'Heal Animal' ? 8 : 10, bonus: 8 * rank, type: 'HP' },
      ] : []
    case 'Slime Spit':
      return rank >= 1 ? [{ label: 'Damage', dice: 2 * rank, sides: 6, type: 'poison' }] : []
    case 'Warning Stripes':
      return rank >= 3 ? [{ label: 'Contact damage', dice: 2 + Math.floor((rank - 3) / 2), sides: 8, type: 'poison' }] : []
    case "Ranger's Bramble":
      return rank >= 3 ? [{ label: 'Critical failure', dice: 2 + rank - 3, sides: 4, type: 'persistent bleed' }] : []
    case 'Gluttonous Growth':
      return rank >= 5 ? [{ label: 'Sustain damage', dice: 4 + 2 * (rank - 5), sides: 6, type: 'piercing' }] : []
    case 'Pulverizing Wake':
      return rank >= 5 ? [
        { label: 'Strike bonus', dice: 3, sides: 8, type: 'sonic' },
        { label: 'Cone', dice: 6 + rank - 5, sides: 8, type: 'sonic' },
      ] : []
    default:
      return []
  }
}

export function rollSpellDamage({ dice, sides, bonus = 0 }: Damage) {
  return Array.from({ length: dice }, () => Math.floor(Math.random() * sides) + 1)
    .reduce((sum, roll) => sum + roll, bonus)
}

export function spellActionRolls(name: string, rank: number, entry?: ContentEntry) {
  const rolls = spellDamage(name, rank)
  if (name === 'Harm') return rolls.flatMap(damage =>
    ['One Action', 'Two Actions', 'Three Actions'].map((actions, index) =>
      ({ damage: { ...damage, label: `${index + 1}-action damage` }, actions })))
  if (name === 'Heal Animal' || name === 'Heal Companion') return rolls.map((damage, index) => ({
    damage, actions: index === 0 ? 'One Action' : 'Two Actions',
  }))
  const actions = entry?.data.actions
  return typeof actions === 'string' && /^(?:(?:single|one|two|three|free) actions?|reaction)$/i.test(actions)
    ? rolls.map(damage => ({ damage, actions })) : []
}

export function DamageRoll({ name, damage, actions, showLabel }: { name: string; damage: Damage; actions?: string; showLabel?: boolean }) {
  const [result, setResult] = useState<ReturnType<typeof rollSpellDamage>>()
  const formula = damage.dice > 0
    ? `${damage.dice}d${damage.sides}${damage.bonus ? `+${damage.bonus}` : ''} ${damage.type}`
    : `${damage.bonus ?? 0} ${damage.type}`
  return <span>
    <button type="button" className={actions ? 'spell-action-button' : undefined}
      aria-label={`Roll ${name}: ${damage.label}`} title={`${actions ? `${actions}; ` : ''}${damage.label}: ${formula}`}
      onClick={() => setResult(rollSpellDamage(damage))}>
      {actions ? <><ActionIcon actions={actions} />{showLabel && <small>{damage.label}</small>}</> : `${damage.label}: ${formula}`}
    </button>
    {result !== undefined && <output aria-live="polite" aria-label={`${name}: ${damage.label} result`}>
      {' '}{result} {damage.type}
      {damage.criticalBleed !== undefined && <>; critical: {result * 2} {damage.type} + {damage.criticalBleed} persistent bleed</>}
    </output>}
  </span>
}

export function SpellActions({ name, rank, entry }: { name: string; rank: number; entry?: ContentEntry }) {
  const rolls = spellActionRolls(name, rank, entry)
  return rolls.length ? <>{rolls.map(({ damage, actions }) =>
    <DamageRoll key={`${damage.label}:${damage.dice}:${actions}`} name={name} damage={damage} actions={actions}
      showLabel={rolls.length > 1 && name !== 'Heal Animal' && name !== 'Heal Companion' && name !== 'Harm'} />)}</>
    : <ActionIcon entry={entry} />
}

export function SpellDamageRolls({ name, rank }: { name: string; rank: number }) {
  return <>{spellDamage(name, rank).map((damage) =>
    <DamageRoll key={`${damage.label}:${damage.dice}`} name={name} damage={damage} />)}</>
}
