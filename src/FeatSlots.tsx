import { eligibleFeats, plannedSlots, type SectionProps } from './builder'
import type { FeatSlotCategory } from './types'

interface FeatSlotsProps extends SectionProps {
  categories?: FeatSlotCategory[]
  title?: string
  manageExtraSlots?: boolean
}

const LABEL: Record<FeatSlotCategory, string> = {
  class: 'Class', ancestry: 'Ancestry', skill: 'Skill', general: 'General', archetype: 'Archetype', bonus: 'Bonus',
}

export function FeatSlots({ c, entries, save, categories, title = 'Feat slots', manageExtraSlots = false }: FeatSlotsProps) {
  const allSlots = plannedSlots(c)
  const slots = allSlots.filter((slot) => !categories || categories.includes(slot.category))
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

  return (
    <>
      <h4>{title}</h4>
      <ul>
        {slots.map((s) => {
          const current = c.feats.find((f) => f.slot === s.key)?.name ?? ''
          const options = eligibleFeats(entries, c, s)
          return (
            <li key={s.key}>
              L{String(s.level).padStart(2, '0')} {LABEL[s.category]}{' '}
              <select value={current} onChange={(e) => choose(s.key, s.category, e.target.value)}>
                <option value="">- empty -</option>
                {current && !options.some((o) => o.name === current) && <option>{current}</option>}
                {options.map((o) => <option key={o.id} value={o.name}>L{String(o.level).padStart(2, '0')} {o.name}</option>)}
              </select>
            </li>
          )
        })}
      </ul>
      {aboveLevel.length > 0 && (
        <small>Some feats sit in slots above your current level: {aboveLevel.map((f) => f.name).join(', ')}</small>
      )}
      {manageExtraSlots && <div className="row">
          <small>Extra slots (class bonus feats, etc.): {c.extraSlots.map((x) => `L${x.level} ${LABEL[x.category]} x${x.count}`).join('; ') || 'none'}</small>
          <button onClick={() => {
            const category = window.prompt('Slot category? (class, ancestry, skill, general, archetype, bonus)', 'class')?.trim() as FeatSlotCategory | undefined
            const level = Number(window.prompt('Slot level?', '1'))
            if (category && LABEL[category] && level >= 1 && level <= 20) save({ extraSlots: [...c.extraSlots, { category, level, count: 1 }] })
          }}>+ Extra slot</button>
          {c.extraSlots.length > 0 && <button onClick={() => save({ extraSlots: c.extraSlots.slice(0, -1) })}>Remove last</button>}
        </div>}
    </>
  )
}
