import { eligibleFeats, plannedSlots, type SectionProps } from './builder'
import type { FeatSlotCategory } from './types'

const LABEL: Record<FeatSlotCategory, string> = {
  class: 'Class', ancestry: 'Ancestry', skill: 'Skill', general: 'General', archetype: 'Archetype', bonus: 'Bonus',
}

export function FeatSlots({ c, entries, save }: SectionProps) {
  const slots = plannedSlots(c)
  const bg = entries.find((e) => e.kind === 'background' && e.name === c.background)
  const slotted = new Set(slots.map((s) => s.key))
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
      <h3>Feat slots</h3>
      {bg?.data.feat && <small>Background grants: <b>{String(bg.data.feat)}</b></small>}
      <ul>
        {slots.map((s) => {
          const current = c.feats.find((f) => f.slot === s.key)?.name ?? ''
          const options = eligibleFeats(entries, c, s)
          return (
            <li key={s.key}>
              L{s.level} {LABEL[s.category]}{' '}
              <select value={current} onChange={(e) => choose(s.key, s.category, e.target.value)}>
                <option value="">- empty -</option>
                {current && !options.some((o) => o.name === current) && <option>{current}</option>}
                {options.map((o) => <option key={o.id} value={o.name}>{o.name} (L{o.level})</option>)}
              </select>
            </li>
          )
        })}
      </ul>
      {c.feats.some((f) => f.slot && !slotted.has(f.slot)) && (
        <small>Some feats sit in slots above your current level: {c.feats.filter((f) => f.slot && !slotted.has(f.slot)).map((f) => f.name).join(', ')}</small>
      )}
      <div className="row">
        <small>Extra slots (class bonus feats, etc.): {c.extraSlots.map((x) => `L${x.level} ${LABEL[x.category]} x${x.count}`).join('; ') || 'none'}</small>
        <button onClick={() => {
          const category = window.prompt('Slot category? (class, ancestry, skill, general, archetype, bonus)', 'class')?.trim() as FeatSlotCategory | undefined
          const level = Number(window.prompt('Slot level?', '1'))
          if (category && LABEL[category] && level >= 1 && level <= 20) save({ extraSlots: [...c.extraSlots, { category, level, count: 1 }] })
        }}>+ Extra slot</button>
        {c.extraSlots.length > 0 && <button onClick={() => save({ extraSlots: c.extraSlots.slice(0, -1) })}>Remove last</button>}
      </div>
    </>
  )
}
