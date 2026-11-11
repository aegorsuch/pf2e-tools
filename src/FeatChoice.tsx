import { hasWardenChoice, wardenSpellOptions } from './featChoices'
import { DRUID_ORDERS } from './builder'
import type { SectionProps } from './builder'

export function FeatChoice({ c, entries, save, index }: SectionProps & { index: number }) {
  const feat = c.feats[index]
  if (!feat) return null
  if (feat.name === 'Order Explorer') {
    return (
      <label className="feat-choice">
        <select aria-label="Order Explorer order" value={feat.choice ?? ''} onChange={(e) => {
          const choice = e.target.value || undefined
          save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
        }}>
          <option value="">Choose order…</option>
          {Object.entries(DRUID_ORDERS).filter(([o]) => o !== c.order).map(([o, skill]) => <option key={o} value={o}>{o} ({skill})</option>)}
        </select>
      </label>
    )
  }
  const isWarden = hasWardenChoice(feat) && c.systems.includes('pf2e')
  const repeatable = entries.some((entry) => entry.kind === 'feat' && entry.name === feat.name && entry.data.repeatable === true)
  if (!isWarden && !repeatable) return null
  if (!isWarden) {
    return <label className="feat-choice">
      Choice{' '}
      <input key={`${index}:${feat.name}:${feat.choice ?? ''}`} aria-label={`${feat.name} choice`} defaultValue={feat.choice ?? ''}
        onBlur={(e) => {
          const choice = e.target.value.trim() || undefined
          if (choice !== feat.choice) save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
        }} />
    </label>
  }
  const selected = new Set(c.feats.flatMap((f, i) => i !== index && hasWardenChoice(f) && f.choice ? [f.choice] : []))
  const available = wardenSpellOptions(feat, entries)
  const options = available.filter((spell) => !selected.has(spell.name) || spell.name === feat.choice)
  return (
    <label className="feat-choice">
      <select aria-label={`${feat.name} warden spell`} value={feat.choice ?? ''} onChange={(e) => {
        const choice = e.target.value || undefined
        save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
      }}>
        <option value="">Choose warden spell…</option>
        {feat.choice && !options.some((spell) => spell.name === feat.choice) && <option value={feat.choice}>{feat.choice}</option>}
        {options.map((spell) => <option key={spell.id} value={spell.name}>{spell.name}</option>)}
      </select>
      {available.length === 0 && <small>Warden spell data unavailable.</small>}
    </label>
  )
}
