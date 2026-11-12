import { useState } from 'react'

type Damage = { label: string; dice: number; sides: number; type: string }

export function spellDamage(name: string, rank: number): Damage[] {
  switch (name) {
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

export function rollSpellDamage({ dice, sides }: Damage) {
  const rolls = Array.from({ length: dice }, () => Math.floor(Math.random() * sides) + 1)
  return { rolls, total: rolls.reduce((sum, roll) => sum + roll, 0) }
}

function DamageRoll({ name, damage }: { name: string; damage: Damage }) {
  const [result, setResult] = useState<ReturnType<typeof rollSpellDamage>>()
  return <span>
    <button type="button" aria-label={`Roll ${name}: ${damage.label}`} title={`${damage.label}: ${damage.dice}d${damage.sides} ${damage.type}`}
      onClick={() => setResult(rollSpellDamage(damage))}>
      {damage.label}: {damage.dice}d{damage.sides} {damage.type}
    </button>
    {result && <output aria-live="polite" aria-label={`${name}: ${damage.label} result`}>
      {' '}{result.total} {damage.type} ({result.rolls.join(' + ')})
    </output>}
  </span>
}

export function SpellDamageRolls({ name, rank }: { name: string; rank: number }) {
  return <>{spellDamage(name, rank).map((damage) =>
    <DamageRoll key={`${damage.label}:${damage.dice}`} name={name} damage={damage} />)}</>
}
