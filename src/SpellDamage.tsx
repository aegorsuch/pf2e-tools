import { useState } from 'react'
import { ActionIcon } from './ActionIcon'
import type { ContentEntry } from './types'

type Damage = { label: string; dice: number; sides: number; type: string; bonus?: number; persistentBleed?: number
  additional?: { dice: number; sides: number; type: string }; outcomes?: { label: string; dice: number }[] }

export function spellDamage(name: string, rank: number): Damage[] {
  switch (name) {
    case 'Fireball':
      return rank >= 3 ? [{ label: 'Damage', dice: 6 + 2 * (rank - 3), sides: 6, type: 'fire' }] : []
    case 'Needle Darts':
      return rank >= 1 ? [{ label: 'Damage', dice: rank + 2, sides: 4, type: 'piercing' }] : []
    case 'Telekinetic Projectile':
      return rank >= 1 ? [{ label: 'Damage', dice: rank + 1, sides: 6, type: 'B/P/S' }] : []
    case 'Grim Tendrils':
      return rank >= 1 ? [{ label: 'Damage', dice: 2 * rank, sides: 4, type: 'void', persistentBleed: rank }] : []
    case 'Shadow Army':
      return rank >= 10 ? [{ label: 'Damage', dice: 3, sides: 10, type: 'mental',
        additional: { dice: 3, sides: 10, type: 'bludgeoning' } }] : []
    case 'Blood Runs Cold':
      return rank >= 2 ? [{ label: 'Damage', dice: 1 + Math.floor((rank - 2) / 2), sides: 6, type: 'persistent cold' }] : []
    case 'Bloodspray Curse': {
      if (rank < 4) return []
      const dice = 2 + Math.floor((rank - 4) / 2)
      return [{ label: 'Strike bonus', dice, sides: 6, type: 'piercing or slashing',
        additional: { dice, sides: 6, type: 'persistent bleed (failure only)' } }]
    }
    case 'Blood-Feasting Breath':
      return rank >= 5 ? [{ label: 'Damage', dice: rank, sides: 6, type: 'void' }] : []
    case "Poltergeist's Fury":
      return rank >= 6 ? [{ label: 'Damage', dice: rank, sides: 4, type: 'piercing' }] : []
    case 'Devouring Void':
      return rank >= 7 ? [{ label: 'Damage', dice: rank, sides: 8, type: 'void' }] : []
    case 'Canticle of Everlasting Grief':
      return rank >= 8 ? [{ label: 'Damage', dice: 10, sides: 6, type: 'mental' }] : []
    case 'Vampiric Revelry':
      return rank >= 9 ? [{ label: 'Damage', dice: 12, sides: 6, type: 'void' }] : []
    case 'Necrotize':
      return rank >= 6 ? [{ label: 'Damage', dice: 2 * rank, sides: 6, type: 'void' }] : []
    case 'Phantasmal Calamity':
      return rank >= 6 ? [{ label: 'Damage', dice: 11 + 2 * (rank - 6), sides: 6, type: 'mental' }] : []
    case 'Tear the Veil':
      return rank >= 10 ? [{ label: 'Damage', dice: 20, sides: 12, type: 'void', outcomes: [
        { label: 'Success', dice: 5 }, { label: 'Failure', dice: 10 }, { label: 'Critical failure', dice: 20 },
      ] }] : []
    case 'Whispers of the Void': {
      if (rank < 4) return []
      const success = 2 + Math.floor((rank - 4) / 2)
      return [{ label: 'Damage', dice: 2 * success, sides: 8, type: 'persistent void', outcomes: [
        { label: 'Success', dice: success }, { label: 'Failure or critical failure', dice: 2 * success },
      ] }]
    }
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
  if (name === 'Vampiric Revelry') return rolls.map(damage => ({ damage, actions: 'Two Actions' }))
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
  const [result, setResult] = useState<number | number[] | { primary: number; additional: number }>()
  const formula = damage.outcomes ? `${damage.outcomes.map(outcome => `${outcome.dice}d${damage.sides}`).join(' / ')} ${damage.type}`
    : damage.dice > 0
    ? `${damage.dice}d${damage.sides}${damage.bonus ? `+${damage.bonus}` : ''} ${damage.type}`
    : `${damage.bonus ?? 0} ${damage.type}`
  return <span>
    <button type="button" className={actions ? 'spell-action-button' : undefined}
      aria-label={`Roll ${name}: ${damage.label}`} title={`${actions ? `${actions}; ` : ''}${damage.label}: ${formula}${damage.persistentBleed !== undefined ? ` + ${damage.persistentBleed} persistent bleed` : ''}${damage.additional ? ` + ${damage.additional.dice}d${damage.additional.sides} ${damage.additional.type}` : ''}`}
      onClick={() => {
        if (damage.outcomes) {
          const dice = Array.from({ length: damage.dice }, () => Math.floor(Math.random() * damage.sides) + 1)
          setResult(damage.outcomes.map(outcome => dice.slice(0, outcome.dice).reduce((sum, roll) => sum + roll, 0)))
          return
        }
        const primary = rollSpellDamage(damage)
        setResult(damage.additional ? { primary, additional: rollSpellDamage({ label: damage.label, ...damage.additional }) } : primary)
      }}>
      {actions ? <><ActionIcon actions={actions} />{showLabel && <small>{damage.label}</small>}</> : `${damage.label}: ${formula}`}
    </button>
    {result !== undefined && <output aria-live="polite" aria-label={`${name}: ${damage.label} result`}>
      {Array.isArray(result) ? <> {damage.outcomes?.map((outcome, index) =>
        <span key={outcome.label}>{index > 0 && '; '}{outcome.label}: {result[index]} {damage.type}</span>)}</>
        : <> {typeof result === 'number' ? result : result.primary} {damage.type}
          {typeof result !== 'number' && damage.additional && <> + {result.additional} {damage.additional.type}</>}</>}
      {typeof result === 'number' && damage.persistentBleed !== undefined && <> + {damage.persistentBleed} persistent bleed</>}
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
