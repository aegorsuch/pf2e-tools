import { useState } from 'react'
import { ActionIcon } from './ActionIcon'
import type { ContentEntry } from './types'

type Damage = { label: string; dice: number; sides: number; type: string; bonus?: number
  additional?: { dice: number; sides: number; type: string; label?: string; bonus?: number }; outcomes?: { label: string; dice: number }[]
  components?: { dice: number; sides: number; type: string }[]; note?: string }
type DamageResult = number | number[] | { primary: number; additional: number }

export function spellDamage(name: string, rank: number, spellcastingModifier?: number): Damage[] {
  switch (name) {
    case 'Ancient Dust': {
      if (rank < 1 || spellcastingModifier === undefined) return []
      const heightened = Math.floor((rank - 1) / 2)
      return [{ label: 'Damage', dice: heightened, sides: 6, bonus: spellcastingModifier, type: 'void',
        additional: { label: 'Failure persistent', dice: 0, sides: 0, bonus: 1 + heightened, type: 'void' } }]
    }
    case 'Torturous Trauma':
      return rank >= 1 && spellcastingModifier !== undefined
        ? [{ label: 'Damage', dice: rank, sides: 4, bonus: spellcastingModifier, type: 'bludgeoning' }] : []
    case 'Glimpse Weakness': {
      if (rank < 1) return []
      const ampDice = 1 + Math.floor((rank - 1) / 2)
      return [
        { label: 'Precision damage', dice: 0, sides: 0, bonus: 1 + rank, type: 'precision' },
        { label: 'Amp precision damage', dice: ampDice, sides: 4, bonus: ampDice, type: 'precision' },
      ]
    }
    case 'Thrall Charge':
      return rank >= 1 ? [{ label: 'Strike bonus', dice: rank >= 10 ? 4 : rank >= 6 ? 3 : rank >= 2 ? 2 : 1,
        sides: 6, type: 'weapon damage',
        additional: { label: 'Destroyed thrall status bonus', dice: 0, sides: 0, bonus: rank, type: 'damage' } }] : []
    case 'Glass Shield':
      return rank >= 1 ? [{ label: 'Shield Block damage', dice: rank >= 3 ? 3 + Math.min(3, Math.floor((rank - 3) / 2)) : 1,
        sides: 4, type: 'piercing', note: 'When shield breaks, creature that broke it must be within 5 feet' }] : []
    case 'Bramble Bush': {
      if (rank < 1) return []
      const heightened = Math.floor((rank - 1) / 2)
      return [
        { label: 'Initial damage', dice: 1 + heightened, sides: 4, type: 'piercing' },
        { label: 'Hazardous terrain', dice: 1, sides: 4, bonus: heightened, type: 'piercing' },
      ]
    }
    case 'Ignition':
      return rank >= 1 ? [4, 6].map(sides => ({
        label: sides === 4 ? 'Ranged' : 'Melee', dice: rank + 1, sides, type: 'fire',
        additional: { label: 'Critical hit persistent', dice: rank, sides, type: 'fire' },
      })) : []
    case 'Live Wire': {
      if (rank < 1) return []
      const dice = 1 + Math.floor((rank - 1) / 2)
      return [{ label: 'Damage', dice, sides: 4, type: 'slashing', components: [
        { dice, sides: 4, type: 'electricity' },
        { dice, sides: 4, type: 'persistent electricity (critical hit)' },
      ], note: 'On a failure, only electricity damage applies' }]
    }
    case 'Puff of Poison': {
      if (rank < 1) return []
      const dice = 1 + Math.floor((rank - 1) / 2)
      return [{ label: 'Damage', dice, sides: 4, type: 'poison',
        additional: { label: 'Failure persistent', dice, sides: 4, type: 'poison' } }]
    }
    case 'Slashing Gust':
      return rank >= 1 ? [{ label: 'Damage', dice: rank + 1, sides: 4, type: 'slashing',
        additional: { label: 'Critical hit persistent', dice: rank, sides: 4, type: 'bleed' } }] : []
    case 'Telekinetic Rend': {
      if (rank < 1) return []
      const dice = 1 + Math.floor((rank - 1) / 2)
      return [
        { label: 'Damage', dice, sides: 6, type: 'bludgeoning or slashing' },
        { label: 'Amp damage', dice, sides: 6, type: 'bludgeoning', additional: { dice, sides: 6, type: 'slashing' } },
      ]
    }
    case 'Dancing Blade': {
      if (rank < 1) return []
      const dice = 3 + Math.floor((rank - 1) / 2)
      return [6, 10].map(sides => ({ label: sides === 6 ? 'Damage' : 'Amp damage', dice, sides, type: 'weapon damage type' }))
    }
    case 'Redistribute Potential':
      return rank >= 1 ? [
        { label: 'Damage', dice: rank + 3, sides: 4, type: 'cold or fire' },
        { label: 'Amp damage', dice: 4 + 2 * rank, sides: 6, type: 'cold or fire' },
      ] : []
    case 'Shatter Mind':
      return rank >= 1 ? [4, 10].map(sides => ({
        label: sides === 4 ? 'Damage' : 'Amp damage', dice: rank + 2, sides, type: 'mental',
      })) : []
    case 'Imaginary Weapon':
      return rank >= 1 ? [
        { label: 'Damage', dice: rank + 1, sides: 6, type: 'force' },
        { label: 'Amp damage', dice: 2 * rank, sides: 6, type: 'force' },
      ] : []
    case 'Caustic Blast':
      return rank >= 1 ? [{ label: 'Damage', dice: 1 + Math.floor((rank - 1) / 2), sides: 8, type: 'acid',
        note: `Critical failure: ${1 + Math.floor((rank - 1) / 2)} persistent acid` }] : []
    case 'Electric Arc':
      return rank >= 1 ? [{ label: 'Damage', dice: rank + 1, sides: 4, type: 'electricity' }] : []
    case 'Frostbite':
      return rank >= 1 ? [{ label: 'Damage', dice: rank + 1, sides: 4, type: 'cold',
        note: `Critical failure: weakness ${rank} to bludgeoning until the start of your next turn` }] : []
    case 'Gouging Claw':
      return rank >= 1 ? [{ label: 'Damage', dice: rank + 1, sides: 6, type: 'piercing or slashing',
        additional: { dice: 0, sides: 0, bonus: rank + 1, type: 'persistent bleed' },
        note: 'Double damage and bleed on a critical success' }] : []
    case 'Cataclysm':
      return rank >= 10 ? [{ label: 'Damage', dice: 3, sides: 10, type: 'acid', components: [
        { dice: 3, sides: 10, type: 'bludgeoning (grounded)' },
        { dice: 3, sides: 10, type: 'cold' },
        { dice: 3, sides: 10, type: 'electricity' },
        { dice: 3, sides: 10, type: 'bludgeoning (flying)' },
        { dice: 3, sides: 10, type: 'bludgeoning (tsunami; double if swimming)' },
        { dice: 3, sides: 10, type: 'fire' },
      ], note: 'Treat resistances as 10 lower' }] : []
    case 'Fireball':
      return rank >= 3 ? [{ label: 'Damage', dice: 6 + 2 * (rank - 3), sides: 6, type: 'fire' }] : []
    case 'Eldritch Wrath':
      return rank >= 4 ? [{ label: 'Damage', dice: rank - 1, sides: 12, type: 'mental' }] : []
    case 'Slice Reality':
      return rank >= 6 ? [{ label: 'Damage', dice: rank + 1, sides: 8, type: 'void' }] : []
    case 'Death Sentence':
      return rank >= 7 ? [{ label: 'Damage', dice: rank + 4, sides: 10, type: 'spirit' }] : []
    case 'Call Cosmos': {
      if (rank < 9) return []
      const dice = rank >= 10 ? 7 : 5
      return [{ label: 'Damage', dice, sides: 12, type: 'cold',
        additional: { dice, sides: 12, type: 'fire' } }]
    }
    case 'Quantum Negation':
      return rank >= 10 ? [
        { label: 'Target level 13 or lower', dice: 0, sides: 0, bonus: 9999, type: 'untyped damage',
          note: 'Reduce Will save success by one step; target reduced to 0 HP ceases to exist; immune for 1 minute' },
        { label: 'Target level 14-16', dice: 25, sides: 10, type: 'untyped damage',
          note: 'Target reduced to 0 HP ceases to exist; immune for 1 minute' },
        { label: 'Target level 17 or higher', dice: 20, sides: 10, type: 'untyped damage',
          note: 'Target reduced to 0 HP dies instantly; immune for 1 minute' },
      ] : []
    case 'Needle Darts':
      return rank >= 1 ? [{ label: 'Damage', dice: rank + 2, sides: 4, type: 'piercing',
        additional: { label: 'Critical hit persistent', dice: 0, sides: 0, bonus: rank, type: 'bleed' } }] : []
    case 'Telekinetic Projectile':
      return rank >= 1 ? [{ label: 'Damage', dice: rank + 1, sides: 6, type: 'B/P/S' }] : []
    case 'Injury Echo': {
      if (rank < 1) return []
      const dice = 1 + Math.floor((rank - 1) / 2)
      return [{ label: 'Damage', dice, sides: 8, type: 'B/P/S',
        additional: { label: 'Conditional persistent bleed', dice, sides: 4, type: 'bleed' } }]
    }
    case 'Haunting Hymn':
      return rank >= 1 ? [{ label: 'Damage', dice: 1 + Math.floor((rank - 1) / 2), sides: 8, type: 'sonic' }] : []
    case 'Bonewall Bulwark':
      return rank >= 3 ? [{ label: 'Wall attack', dice: rank, sides: 10, type: 'bludgeoning' }] : []
    case "Moth's Supper":
      return rank >= 3 ? [{ label: '10-minute healing', dice: rank - 1, sides: 4, type: 'HP',
        additional: { label: 'Treat Wounds bonus', dice: 2 * (rank - 1), sides: 4, type: 'HP' } }] : []
    case 'Grim Tendrils':
      return rank >= 1 ? [{ label: 'Damage', dice: 2 * rank, sides: 4, type: 'void' }] : []
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
    case 'Entropy Strike':
      return rank >= 3 ? [{ label: 'Damage', dice: rank + 2, sides: 8, type: 'void',
        additional: { label: 'Tech creature persistent', dice: rank - 1, sides: 6, type: 'persistent acid' },
        note: 'Double damage on a critical hit' }] : []
    case 'Supercharge Weapon':
      return rank >= 1 ? [{ label: 'Extra damage', dice: 1 + Math.floor((rank - 1) / 2), sides: 6, type: 'weapon damage type',
        note: 'Added to the next Strike with the chosen weapon' }] : []
    case 'Rocket Dash':
      return rank >= 6 ? [{ label: 'Damage', dice: 6 + 2 * Math.floor((rank - 6) / 2), sides: 12, type: 'fire',
        additional: { label: 'Critical failure persistent', dice: 2 + Math.floor((rank - 6) / 2), sides: 6, type: 'persistent fire' } }] : []
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
    case 'Inject Nanobots':
    case 'Inject Nanobot':
      return rank >= 2 ? [{ label: 'Damage', dice: 2 * rank, sides: 6, type: 'acid',
        note: 'Critical hit: double damage' }] : []
    case 'Corrosive Haze':
      return rank >= 6 ? [{ label: 'Damage', dice: rank, sides: 8, type: 'acid',
        additional: { label: 'Persistent', dice: rank - 5, sides: 6, type: 'persistent acid' } },
      { label: 'Unattended objects', dice: rank - 3, sides: 8, type: 'acid' }] : []
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
      return cantripDamage(name, rank)
  }
}

// Cantrip damage by heightened rank: [base dice, dice added per step, rank step, sides, type]
const CANTRIP_DAMAGE: Record<string, [number, number, number, number, string]> = {
  'Astral Rain': [4, 1, 1, 4, 'bludgeoning or piercing'],
  'Buzzing Bites': [1, 1, 1, 4, 'piercing'],
  'Clinging Ice': [1, 1, 1, 4, 'cold'],
  'Cosmic Cannon': [2, 1, 1, 4, 'force'],
  'Daze': [1, 1, 2, 6, 'mental'],
  'Divine Lance': [2, 1, 1, 4, 'spirit'],
  'Eldritch Lance': [2, 1, 1, 6, 'mental'],
  'Emoticon': [2, 1, 1, 4, 'bludgeoning or force'],
  'Forbidden Thought': [2, 1, 1, 6, 'mental'],
  'Gale Blast': [1, 1, 1, 6, 'bludgeoning'],
  'Ghostly Shift': [2, 1, 2, 6, 'force (amp only)'],
  'Murmuration': [1, 1, 1, 4, 'piercing or sonic'],
  'Pact Broker': [2, 1, 1, 4, 'mental'],
  'Phase Bolt': [3, 1, 1, 4, 'piercing'],
  'Ricochet': [2, 1, 1, 4, 'bludgeoning or slashing'],
  'Scatter Scree': [2, 1, 1, 4, 'bludgeoning'],
  'Spirit Object': [2, 2, 1, 4, 'weapon damage type'],
  'Spout': [2, 1, 1, 4, 'bludgeoning'],
  'Timber': [2, 1, 1, 4, 'bludgeoning'],
  'Trade Death for Life': [1, 1, 1, 4, 'void'],
  'Vitality Lash': [2, 1, 1, 6, 'vitality'],
}

function cantripDamage(name: string, rank: number): Damage[] {
  const formula = CANTRIP_DAMAGE[name]
  if (!formula || rank < 1) return []
  const [base, added, step, sides, type] = formula
  return [{ label: 'Damage', dice: base + added * Math.floor((rank - 1) / step), sides, type }]
}

export function rollSpellDamage({ dice, sides, bonus = 0 }: Damage) {
  return Array.from({ length: dice }, () => Math.floor(Math.random() * sides) + 1)
    .reduce((sum, roll) => sum + roll, bonus)
}

const WARP_WORLD_EFFECTS = [
  { name: 'Supernova', type: 'fire', persistent: 'electricity', note: 'Critical failure: double damage and dazzled for 1 round.' },
  { name: 'Earthquake', type: 'bludgeoning', note: 'Critical failure: double damage and knocked prone.' },
  { name: 'Inferno', type: 'fire', note: 'Everything in the aura is concealed by smoke for 1 round. Critical failure: double damage and sickened 1.' },
  { name: 'Eldritch Storm', type: 'sonic', persistent: 'mental', note: 'Critical failure: double damage and confused for 1 round.' },
  { name: 'Flash Freeze', type: 'cold', note: 'Critical failure: double damage and slowed 1 for 1 round.' },
  { name: 'Radioactive Blast', type: 'bludgeoning', persistent: 'fire',
    note: 'Critical failure: double damage and persistent poison damage; fatigued while persistent poison damage lasts.' },
] as const

export function rollWarpWorld(rank: number) {
  const index = Math.floor(Math.random() * WARP_WORLD_EFFECTS.length)
  const effect = WARP_WORLD_EFFECTS[index]
  const persistentDice = rank - 3
  const damage = rollSpellDamage({ label: 'Damage', dice: rank, sides: 12, type: effect.type })
  const persistent = 'persistent' in effect
    ? rollSpellDamage({ label: 'Persistent', dice: persistentDice, sides: 6, type: effect.persistent }) : undefined
  const poison = index === 5
    ? rollSpellDamage({ label: 'Critical failure persistent', dice: persistentDice, sides: 6, type: 'poison' }) : undefined
  return { index, damage, persistent, poison }
}

export function WarpWorldRoll({ rank }: { rank: number }) {
  const [result, setResult] = useState<ReturnType<typeof rollWarpWorld>>()
  const effect = result && WARP_WORLD_EFFECTS[result.index]
  return <span>
    <button type="button" className="spell-action-button" aria-label={result ? 'Hide Warp World result' : 'Roll Warp World'}
      title={`Two Actions; roll a Warp World effect and ${rank}d12 damage`}
      onClick={() => setResult(result ? undefined : rollWarpWorld(rank))}><ActionIcon actions="Two Actions" /></button>
    {result && effect && <output aria-live="polite" aria-label="Warp World result">
      {' '}{effect.name}: {result.damage} {effect.type}
      {'persistent' in effect && result.persistent !== undefined && <>; {result.persistent} persistent {effect.persistent}</>}
      {result.poison !== undefined && <>; critical failure: {result.poison} persistent poison</>}
      {' '}{effect.note}
    </output>}
  </span>
}

export function spellActionRolls(name: string, rank: number, entry?: ContentEntry, spellcastingModifier?: number) {
  const rolls = spellDamage(name, rank, spellcastingModifier)
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

function rollDamage(damage: Damage): DamageResult {
  if (damage.outcomes) {
    const dice = Array.from({ length: damage.dice }, () => Math.floor(Math.random() * damage.sides) + 1)
    return damage.outcomes.map(outcome => dice.slice(0, outcome.dice).reduce((sum, roll) => sum + roll, 0))
  }
  const primary = rollSpellDamage(damage)
  if (damage.components) return [primary, ...damage.components.map(component => rollSpellDamage({ label: damage.label, ...component }))]
  return damage.additional ? { primary, additional: rollSpellDamage({ label: damage.label, ...damage.additional }) } : primary
}

function DamageResultText({ damage, result, showPrimaryLabel = true }: { damage: Damage; result: DamageResult; showPrimaryLabel?: boolean }) {
  return Array.isArray(result) ? damage.components
    ? <> {[{ type: damage.type }, ...damage.components].map((component, index) =>
      <span key={index}>{index > 0 && '; '}{result[index]} {component.type}</span>)}</>
    : <> {damage.outcomes?.map((outcome, index) =>
      <span key={outcome.label}>{index > 0 && '; '}{outcome.label}: {result[index]} {damage.type}</span>)}</>
    : <> {showPrimaryLabel && damage.additional?.label && `${damage.label}: `}{typeof result === 'number' ? result : result.primary} {damage.type}
      {typeof result !== 'number' && damage.additional && <>{damage.additional.label ? `; ${damage.additional.label}: ` : ' + '}{result.additional} {damage.additional.type}</>}</>
}

function damageFormula(damage: Damage) {
  return damage.outcomes ? `${damage.outcomes.map(outcome => `${outcome.dice}d${damage.sides}`).join(' / ')} ${damage.type}`
    : damage.dice > 0
    ? `${damage.dice}d${damage.sides}${damage.bonus ? `${damage.bonus > 0 ? '+' : ''}${damage.bonus}` : ''} ${damage.type}`
    : `${damage.bonus ?? 0} ${damage.type}`
}

function damageTitle(damage: Damage) {
  return `${damage.label}: ${damageFormula(damage)}${damage.additional ? `${damage.additional.label ? `; ${damage.additional.label}: ` : ' + '}${damage.additional.dice ? `${damage.additional.dice}d${damage.additional.sides}${damage.additional.bonus ? `+${damage.additional.bonus}` : ''}` : damage.additional.bonus ?? 0} ${damage.additional.type}` : ''}${damage.components?.map(component => ` + ${component.dice}d${component.sides} ${component.type}`).join('') ?? ''}${damage.note ? `; ${damage.note}` : ''}`
}

export function DamageRoll({ name, damage, actions, showLabel, disabled, onRoll, toggleResult = false }: {
  name: string; damage: Damage; actions?: string; showLabel?: boolean; disabled?: boolean; onRoll?: () => void; toggleResult?: boolean
}) {
  const [result, setResult] = useState<DamageResult>()
  const title = damageTitle(damage)
  return <span>
    <button type="button" disabled={disabled} className={actions ? 'spell-action-button' : undefined}
      aria-label={toggleResult && result !== undefined ? `Hide ${name}: ${damage.label} result`
        : `Roll ${name}: ${damage.label}${damage.additional?.label ? ` and ${damage.additional.label}` : ''}`} title={`${actions ? `${actions}; ` : ''}${title}`}
      onClick={() => {
        if (disabled) return
        if (toggleResult && result !== undefined) {
          setResult(undefined)
          return
        }
        onRoll?.()
        setResult(rollDamage(damage))
      }}>
      {actions ? <><ActionIcon actions={actions} />{showLabel && <small>{damage.label}</small>}</> : `${damage.label}: ${damageFormula(damage)}`}
    </button>
    {result !== undefined && <output aria-live="polite" aria-label={`${name}: ${damage.label} result`}>
      <DamageResultText damage={damage} result={result} />
    </output>}
  </span>
}

export function MultipleDamageRoll({ name, damages, actions }: { name: string; damages: Damage[]; actions: string }) {
  const [results, setResults] = useState<DamageResult[]>()
  return <span>
    <button type="button" className="spell-action-button" aria-label={`${results ? 'Hide' : 'Roll'} ${name}${results ? ' results' : ': Damage'}`}
      title={`${actions}; ${damages.map(damageTitle).join('; ')}`}
      onClick={() => setResults(results ? undefined : damages.map(rollDamage))}><ActionIcon actions={actions} /></button>
    {results && <output aria-live="polite" aria-label={`${name}: Damage results`}>
      {damages.map((damage, index) => <span key={`${damage.label}:${index}`}>
        {index > 0 && '; '}{damage.label}:<DamageResultText damage={damage} result={results[index]} showPrimaryLabel={false} />
        {damage.note && ` (${damage.note})`}
      </span>)}
    </output>}
  </span>
}

export function SpellActions({ name, rank, entry, spellcastingModifier }: { name: string; rank: number; entry?: ContentEntry; spellcastingModifier?: number }) {
  if (name === 'Warp World' && rank >= 4) return <WarpWorldRoll rank={rank} />
  const rolls = spellActionRolls(name, rank, entry, spellcastingModifier)
  const groups = new Map<string, Damage[]>()
  for (const { damage, actions } of rolls) groups.set(actions, [...groups.get(actions) ?? [], damage])
  return rolls.length ? <>{[...groups].map(([actions, damages]) => damages.length > 1
    ? <MultipleDamageRoll key={actions} name={name} damages={damages} actions={actions} />
    : <DamageRoll key={actions} name={name} damage={damages[0]} actions={actions} toggleResult />)}</>
    : <><ActionIcon entry={entry} />{rank >= 1 && spellcastingModifier === undefined && ['Ancient Dust', 'Torturous Trauma'].includes(name)
      && <small role="status">Spellcasting modifier unavailable.</small>}</>
}

export function SpellDamageRolls({ name, rank, spellcastingModifier }: { name: string; rank: number; spellcastingModifier?: number }) {
  return <>{spellDamage(name, rank, spellcastingModifier).map((damage) =>
    <DamageRoll key={`${damage.label}:${damage.dice}`} name={name} damage={damage} />)}</>
}
