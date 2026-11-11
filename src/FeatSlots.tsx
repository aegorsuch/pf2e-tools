import { eligibleFeats, plannedSlots, type SectionProps } from './builder'
import type { FeatSlotCategory } from './types'

interface FeatSlotsProps extends SectionProps {
  categories?: FeatSlotCategory[]
  title?: string
}

const LABEL: Record<FeatSlotCategory, string> = {
  class: 'Class', ancestry: 'Ancestry', skill: 'Skill', general: 'General', archetype: 'Archetype', bonus: 'Bonus',
}

export function FeatSlots({ c, entries, save, categories, title = 'Feat slots' }: FeatSlotsProps) {
  const allSlots = plannedSlots(c)
  const slots = allSlots.filter((slot) => !categories || categories.includes(slot.category))
  const standardKeys = new Set(plannedSlots({ ...c, extraSlots: [] }).map((slot) => slot.key))
  const aboveLevel = c.feats.filter((f) => {
    if (!f.slot) return false
    const category = f.slot.split(':')[0] as FeatSlotCategory
    return (!categories || categories.includes(category)) && !allSlots.some((slot) => slot.key === f.slot)
  })
  const choose = (key: string, category: FeatSlotCategory, name: string) => {
    const feat = entries.find((e) => e.kind === 'feat' && e.name === name && eligibleFeats(entries, c, { key, category, level: 20 }).includes(e))
    const old = c.feats.find((f) => f.slot === key)
    const oldId = old && entries.find((e) => e.kind === 'feat' && e.name === old.name)?.id
    const feats = c.feats.filter((f) => f.slot !== key)
    const entryIds = c.entryIds.filter((id) => id !== oldId)
    if (feat) {
      feats.push({ name: feat.name, type: `${LABEL[category]} Feat`, level: feat.level, slot: key })
      entryIds.push(feat.id)
    }
    save({ feats, entryIds })
  }
  const removeExtra = (category: FeatSlotCategory, level: number, key: string) => {
    const index = c.extraSlots.findIndex((slot) => slot.category === category && slot.level === level && slot.count > 0)
    if (index < 0) return
    const extraSlots = c.extraSlots.flatMap((slot, i) =>
      i !== index ? [slot] : slot.count > 1 ? [{ ...slot, count: slot.count - 1 }] : [])
    const prefix = `${category}:${level}:`
    const removedIndex = Number(key.slice(prefix.length))
    const removed = c.feats.filter((feat) => feat.slot === key)
    const feats = c.feats.filter((feat) => feat.slot !== key).map((feat) => {
      if (!feat.slot?.startsWith(prefix)) return feat
      const slotIndex = Number(feat.slot.slice(prefix.length))
      return slotIndex > removedIndex ? { ...feat, slot: `${prefix}${slotIndex - 1}` } : feat
    })
    const removedIds = new Set(removed.flatMap((feat) => {
      if (feats.some((remaining) => remaining.name === feat.name)) return []
      return entries.filter((entry) => entry.kind === 'feat' && entry.name === feat.name).map((entry) => entry.id)
    }))
    save({ extraSlots, feats, entryIds: c.entryIds.filter((id) => !removedIds.has(id)) })
  }

  return (
    <>
      <h4>{title}</h4>
      <ul>
        {slots.map((s) => {
          const current = c.feats.find((f) => f.slot === s.key)?.name ?? ''
          const options = eligibleFeats(entries, c, s)
          const first = slots.find((slot) => slot.category === s.category && slot.level === s.level)?.key === s.key
          const extra = !standardKeys.has(s.key)
          const label = `L${String(s.level).padStart(2, '0')} ${LABEL[s.category]}`
          return (
            <li key={s.key}>
              {label}{' '}
              <select value={current} onChange={(e) => choose(s.key, s.category, e.target.value)}>
                <option value="">- empty -</option>
                {current && !options.some((o) => o.name === current) && <option>{current}</option>}
                {options.map((o) => <option key={o.id} value={o.name}>L{String(o.level).padStart(2, '0')} {o.name}</option>)}
              </select>
              {first && current && <button type="button" aria-label={`Add ${label} feat slot`}
                onClick={() => save({ extraSlots: [...c.extraSlots, { category: s.category, level: s.level, count: 1 }] })}>+</button>}
              {extra && <button type="button" aria-label={`Remove ${label} extra feat slot ${s.key.split(':')[2]}`}
                onClick={() => removeExtra(s.category, s.level, s.key)}>−</button>}
            </li>
          )
        })}
      </ul>
      {aboveLevel.length > 0 && (
        <small>Some feats sit in slots above your current level: {aboveLevel.map((f) => f.name).join(', ')}</small>
      )}
    </>
  )
}
