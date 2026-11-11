import { hasWardenChoice, wardenSpellOptions } from './featChoices'
import { CANNY_STATS, DRUID_ORDERS, availableOrders } from './builder'
import type { SectionProps } from './builder'

export function FeatChoice({ c, entries, save, index }: SectionProps & { index: number }) {
  const feat = c.feats[index]
  if (!feat) return null
  if (feat.name === 'Canny Acumen') {
    return (
      <label className="feat-choice">
        <select aria-label="Canny Acumen statistic" value={feat.choice ?? ''} onChange={(e) => {
          const choice = e.target.value || undefined
          save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
        }}>
          <option value="">Choose statistic…</option>
          {CANNY_STATS.map((stat) => <option key={stat} value={stat}>{stat}</option>)}
        </select>
      </label>
    )
  }
  if (feat.name === 'Order Explorer') {
    return (
      <label className="feat-choice">
        <select aria-label="Order Explorer order" value={feat.choice ?? ''} onChange={(e) => {
          const choice = e.target.value || undefined
          save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
        }}>
          <option value="">Choose order…</option>
          {availableOrders(c, index).map((o) => <option key={o} value={o}>{o} ({DRUID_ORDERS[o]})</option>)}
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
