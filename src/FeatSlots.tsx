import { eligibleFeats, featType, plannedSlots, type SectionProps } from './builder'
import { FeatChoice } from './FeatChoice'
import { ActionIcon } from './ActionIcon'
import { actionOptionLabel } from './actionCost'
import { compareFeatSelections } from './featChoices'
import type { FeatSlotCategory } from './types'

interface FeatSlotsProps extends SectionProps {
  categories?: FeatSlotCategory[]
  title?: string
  bare?: boolean
}

const LABEL: Record<FeatSlotCategory, string> = {
  class: 'Class', ancestry: 'Ancestry', skill: 'Skill', general: 'General', archetype: 'Archetype', bonus: 'Bonus',
}

export function FeatSlots({ c, entries, save, categories, title = 'Feat slots', bare }: FeatSlotsProps) {
  const allSlots = plannedSlots(c)
  const background = entries.find((entry) => entry.kind === 'background' && entry.name === c.background)
  const backgroundFeats = typeof background?.data.feat === 'string'
    ? background.data.feat.split(',').flatMap((name) => {
      const feat = entries.find((entry) => entry.kind === 'feat' && entry.name === name.trim())
      return feat && (!categories || categories.some((category) => featType(feat, c) === `${LABEL[category]} Feat`))
        ? [feat] : []
    }) : []
  const slots = allSlots.filter((slot) => !categories || categories.includes(slot.category))
    .sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level
      const aFeat = c.feats.find((feat) => feat.slot === a.key)
      const bFeat = c.feats.find((feat) => feat.slot === b.key)
      if (!aFeat || !bFeat) return Number(!aFeat) - Number(!bFeat)
      return compareFeatSelections(aFeat, bFeat)
    })
  const standardKeys = new Set(plannedSlots({ ...c, extraSlots: [] }).map((slot) => slot.key))
  const aboveLevel = c.feats.filter((f) => {
    if (!f.slot) return false
    const category = f.slot.split(':')[0] as FeatSlotCategory
    return (!categories || categories.includes(category)) && !allSlots.some((slot) => slot.key === f.slot)
  })
  const choose = (key: string, category: FeatSlotCategory, level: number, name: string) => {
    const feat = entries.find((e) => e.kind === 'feat' && e.name === name && eligibleFeats(entries, c, { key, category, level }).includes(e))
    const old = c.feats.find((f) => f.slot === key)
    const oldId = old && entries.find((e) => e.kind === 'feat' && e.name === old.name)?.id
    const feats = c.feats.filter((f) => f.slot !== key)
    const entryIds = c.entryIds.filter((id) => id !== oldId || feats.some((f) => f.name === old?.name))
    if (feat) {
      feats.push({ name: feat.name, type: `${LABEL[category]} Feat`, level: feat.level, slot: key })
      if (!entryIds.includes(feat.id)) entryIds.push(feat.id)
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

  const Wrapper = bare ? 'div' : 'details'
  return (
    <Wrapper className={bare ? undefined : 'character-subsection'}>
      {!bare && <summary><h4>{title}</h4></summary>}
      <ul className="feat-slot-list">
        {backgroundFeats.map((feat) => (
          <li className="feat-slot-row background-feat-row" key={`background:${feat.id}`}>
            <span>Background {featType(feat, c)}</span>
            <span>{feat.name} <ActionIcon entry={feat} /></span>
          </li>
        ))}
        {slots.map((s, index) => {
          const current = c.feats.find((f) => f.slot === s.key)?.name ?? ''
          const featIndex = c.feats.findIndex((f) => f.slot === s.key)
          const options = eligibleFeats(entries, c, s)
          const optionsByLevel = new Map<number, typeof options>()
          for (const option of options) optionsByLevel.set(option.level, [...(optionsByLevel.get(option.level) ?? []), option])
          const firstAtLevel = !slots.slice(0, index).some((slot) => slot.category === s.category && slot.level === s.level)
          const extra = !standardKeys.has(s.key)
          const label = `L${String(s.level).padStart(2, '0')} ${LABEL[s.category]}`
          return (
            <li className={`feat-slot-row${index > 0 && slots[index - 1].level !== s.level ? ' feat-level-start' : ''}`} key={s.key}>
              <span>{label}{s.category === 'skill' ? ' Feats' : ''}</span>
              <select aria-label={`${label} feat`} value={current} onChange={(e) => choose(s.key, s.category, s.level, e.target.value)}>
                <option value="">- empty -</option>
                {current && !options.some((o) => o.name === current) && (
                  <option value={current}>{actionOptionLabel(current, entries.find((entry) => entry.kind === 'feat' && entry.name === current))}</option>
                )}
                {[...optionsByLevel].map(([level, levelOptions]) => (
                  <optgroup key={level} label={`L${String(level).padStart(2, '0')}`}>
                    {levelOptions.map((option) => <option key={option.id} value={option.name}>{actionOptionLabel(option.name, option)}</option>)}
                  </optgroup>
                ))}
              </select>
              {featIndex >= 0 && <FeatChoice c={c} entries={entries} save={save} index={featIndex} />}
              {extra
                ? <button type="button" aria-label={`Remove ${label} extra feat slot ${s.key.split(':')[2]}`}
                  onClick={() => removeExtra(s.category, s.level, s.key)}>−</button>
                : <button type="button" aria-label={`${label} slot is granted by level`} title="Granted by level" disabled>−</button>}
              {firstAtLevel
                ? <button type="button" aria-label={`Add ${label} feat slot`}
                  onClick={() => save({ extraSlots: [...c.extraSlots, { category: s.category, level: s.level, count: 1 }] })}>+</button>
                : <button type="button" className="slot-spacer" aria-hidden="true" tabIndex={-1} disabled>+</button>}
            </li>
          )
        })}
      </ul>
      {aboveLevel.length > 0 && (
        <small>Some feats sit in slots above your current level: {aboveLevel.map((f) => f.name).join(', ')}</small>
      )}
    </Wrapper>
  )
}
