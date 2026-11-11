import { Fragment } from 'react'
import { EntryDescription } from './EntryDescription'
import { eligibleFeats, featByName, featType, homebrewDedication, isGrantedSlot, plannedSlots, type SectionProps } from './builder'
import { FeatChoice } from './FeatChoice'
import { ActionIcon } from './ActionIcon'
import { actionOptionLabel } from './actionCost'
import { compareFeatSelections } from './featChoices'
import type { ContentEntry, FeatSlotCategory } from './types'

interface FeatSlotsProps extends SectionProps {
  categories?: FeatSlotCategory[]
  title?: string
  bare?: boolean
  // Per-slot search text, held by the parent so this stays a pure render
  search?: Record<string, string>
  onSearch?: (key: string, text: string) => void
}

const PAGE = 100

const LABEL: Record<FeatSlotCategory, string> = {
  class: 'Class', ancestry: 'Ancestry', skill: 'Skill', general: 'General', archetype: 'Dedication', bonus: 'Bonus',
}

export function FeatSlots({ c, entries, save, categories, title = 'Feat slots', bare, search = {}, onSearch }: FeatSlotsProps) {
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
  const q = (search['*'] ?? '').trim().toLowerCase()
  const matches = (o: ContentEntry) => !q || [o.name, String(o.data.archetype ?? ''), ...o.traits].some((t) => t.toLowerCase().includes(q))
  const isDedication = (o?: ContentEntry) => !!o?.traits.some((t) => /^dedication$/i.test(t))
  const standardKeys = new Set(plannedSlots({ ...c, extraSlots: [] }).map((slot) => slot.key))
  const aboveLevel = c.feats.filter((f) => {
    if (!f.slot) return false
    const category = f.slot.split(':')[0] as FeatSlotCategory
    return (!categories || categories.includes(category)) && !allSlots.some((slot) => slot.key === f.slot)
  })
  const choose = (key: string, category: FeatSlotCategory, level: number, name: string) => {
    const feat = entries.find((e) => e.kind === 'feat' && e.name === name && eligibleFeats(entries, c, allSlots.find((slot) => slot.key === key) ?? { key, category, level }).includes(e))
    const old = c.feats.find((f) => f.slot === key)
    const oldId = old && entries.find((e) => e.kind === 'feat' && e.name === old.name)?.id
    const feats = c.feats.filter((f) => f.slot !== key)
    const entryIds = c.entryIds.filter((id) => id !== oldId || feats.some((f) => f.name === old?.name))
    if (feat) {
      feats.push({ name: feat.name, type: `${LABEL[category]} Feat`, level: feat.level, slot: key })
      if (!entryIds.includes(feat.id)) entryIds.push(feat.id)
    }
    // Dropping a granting feat also drops the feat it granted
    const orphan = (f: { slot?: string }) => f.slot && isGrantedSlot(f.slot)
      && !plannedSlots({ ...c, feats }).some((slot) => slot.key === f.slot)
    const skippedFeatSlots = (c.skippedFeatSlots ?? []).filter((slot) => slot !== key)
    if (category === 'archetype' && name === 'N/A') skippedFeatSlots.push(key)
    save({ feats: feats.filter((f) => !orphan(f)), entryIds, skippedFeatSlots })
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
    const skippedFeatSlots = (c.skippedFeatSlots ?? []).filter((slot) => slot !== key).map((slot) => {
      if (!slot.startsWith(prefix)) return slot
      const slotIndex = Number(slot.slice(prefix.length))
      return slotIndex > removedIndex ? `${prefix}${slotIndex - 1}` : slot
    })
    save({ extraSlots, feats, entryIds: c.entryIds.filter((id) => !removedIds.has(id)), skippedFeatSlots })
  }

  const multi = new Set(slots.map((slot) => slot.category)).size > 1
  const Wrapper = bare ? 'div' : 'details'
  return (
    <Wrapper className={bare ? undefined : 'character-subsection'}>
      {!bare && <summary><h4>{title}</h4></summary>}
      <ul className="feat-slot-list">
        {backgroundFeats.map((feat) => (
          <li className="feat-slot-row background-feat-row" key={`background:${feat.id}`}>
            <span>Background {featType(feat, c)}</span>
            <EntryDescription name={feat.name} entry={feat} className="feat-name" />
            <ActionIcon entry={feat} />
          </li>
        ))}
        {slots.map((s, index) => {
          const newLevel = index === 0 || slots[index - 1].level !== s.level
          const current = c.feats.find((f) => f.slot === s.key)?.name ?? (c.skippedFeatSlots?.includes(s.key) ? 'N/A' : '')
          const featIndex = c.feats.findIndex((f) => f.slot === s.key)
          const currentEntry = featByName(entries).get(current)
          const picksType = s.category === 'archetype'
          const type = search[`${s.key}:type`] || (currentEntry ? (isDedication(currentEntry) ? 'dedication' : 'archetype') : 'archetype')
          const open = search[`${s.key}:open`] === '1'
          // Archetype pickers only build their (very long) list while the popup is open
          // Lists are only built while a picker is open; selects open on focus
          const lazy = !!onSearch && !open
          const options = lazy ? [] : eligibleFeats(entries, c, s).filter((o) => matches(o) && (!picksType || (type === 'dedication') === isDedication(o)))
          const shown = picksType ? options.slice(0, Number(search[`${s.key}:limit`]) || PAGE) : options
          const optionsByLevel = new Map<number, typeof options>()
          for (const option of shown) optionsByLevel.set(option.level, [...(optionsByLevel.get(option.level) ?? []), option])
          const firstAtLevel = !slots.slice(0, index).some((slot) => slot.category === s.category && slot.level === s.level)
          const granted = isGrantedSlot(s.key)
          const extra = !standardKeys.has(s.key) && !granted
          const label = `L${String(s.level).padStart(2, '0')} ${LABEL[s.category]}`
          const PickerWrapper = current ? 'details' : 'span'
          return (
            <Fragment key={s.key}>
            {!multi && newLevel && <li className="feat-level-heading">Level {String(s.level).padStart(2, '0')}</li>}
            <li className={`feat-slot-row${multi && index > 0 && newLevel ? ' feat-level-start' : ''}`}>
              {multi && <span>{label}{s.category === 'skill' ? ' Feats' : ''}</span>}
              {homebrewDedication(s.key) ? (
                <EntryDescription name={homebrewDedication(s.key)!.name} entry={currentEntry} className="feat-name" />
              ) : <>
              {current === 'N/A' ? <span>N/A</span> : current && <EntryDescription name={current} entry={currentEntry} className="feat-name" />}
              <PickerWrapper className="feat-change">
              {current && <summary>Change</summary>}
              {picksType ? (
                <button type="button" className="feat-picker-button" aria-label={`${label} feat`} onClick={() => onSearch?.(`${s.key}:open`, '1')}>
                  {current || '- empty -'}
                </button>
              ) : <select aria-label={`${label} feat`} value={current}
                onFocus={onSearch ? () => onSearch(`${s.key}:open`, '1') : undefined}
                onBlur={onSearch ? () => onSearch(`${s.key}:open`, '') : undefined} onChange={(e) => choose(s.key, s.category, s.level, e.target.value)}>
                <option value="">- empty -</option>
                {current && !options.some((o) => o.name === current) && (
                  <option value={current}>{actionOptionLabel(current, currentEntry)}</option>
                )}
                {[...optionsByLevel].map(([level, levelOptions]) => (
                  <optgroup key={level} label={`L${String(level).padStart(2, '0')}`}>
                    {levelOptions.map((option) => <option key={option.id} value={option.name}>{actionOptionLabel(option.name, option)}</option>)}
                  </optgroup>
                ))}
              </select>}
              </PickerWrapper>
              </>}
              {picksType && open && (
                <div className="feat-modal-backdrop" onClick={() => onSearch?.(`${s.key}:open`, '')}>
                  <div className="feat-modal" role="dialog" aria-label={`${label} feat picker`} onClick={(e) => e.stopPropagation()}>
                    <div className="feat-type-tabs" role="tablist">
                      {([['archetype', 'Archetype'], ['dedication', 'Dedication']] as const).map(([value, text]) => (
                        <button key={value} type="button" role="tab" aria-selected={type === value} className={type === value ? 'active' : undefined}
                          onClick={() => onSearch?.(`${s.key}:type`, value)}>{text}</button>
                      ))}
                    </div>
                    <ul className="feat-modal-list">
                      <li><button type="button" aria-label={`${label} clear`} onClick={() => { choose(s.key, s.category, s.level, ''); onSearch?.(`${s.key}:open`, '') }}>- empty -</button></li>
                      <li><button type="button" aria-label={`${label} N/A`} onClick={() => { choose(s.key, s.category, s.level, 'N/A'); onSearch?.(`${s.key}:open`, '') }}>N/A</button></li>
                      {[...optionsByLevel].map(([level, levelOptions]) => [
                        <li key={`l${level}`} className="feat-modal-level">L{String(level).padStart(2, '0')}</li>,
                        ...levelOptions.map((option) => (
                          <li key={option.id}>
                            <button type="button" aria-label={`${label}: ${option.name}`} className={option.name === current ? 'active' : undefined}
                              onClick={() => { choose(s.key, s.category, s.level, option.name); onSearch?.(`${s.key}:open`, '') }}>
                              {actionOptionLabel(option.name, option)}
                            </button>
                          </li>
                        )),
                      ])}
                    </ul>
                    {options.length > shown.length && (
                      <button type="button" onClick={() => onSearch?.(`${s.key}:limit`, String(shown.length + PAGE))}>Show more ({options.length - shown.length} left, or use search)</button>
                    )}
                    <button type="button" onClick={() => onSearch?.(`${s.key}:open`, '')}>Cancel</button>
                  </div>
                </div>
              )}
              {featIndex >= 0 && <FeatChoice c={c} entries={entries} save={save} index={featIndex} />}
              {extra
                ? <button type="button" aria-label={`Remove ${label} extra feat slot ${s.key.split(':')[2]}`}
                  onClick={() => removeExtra(s.category, s.level, s.key)}>−</button>
                : <button type="button" aria-label={`${label} slot is granted by ${granted ? 'a feat' : 'level'}`} title={granted ? 'Granted by a feat' : 'Granted by level'} disabled>−</button>}
              {firstAtLevel && (!granted || !slots.some((o) => o.category === s.category && o.level === s.level && !isGrantedSlot(o.key)))
                ? <button type="button" aria-label={`Add ${label} feat slot`}
                  onClick={() => save({ extraSlots: [...c.extraSlots, { category: s.category, level: s.level, count: 1 }] })}>+</button>
                : <button type="button" className="slot-spacer" aria-hidden="true" tabIndex={-1} disabled>+</button>}
            </li>
            </Fragment>
          )
        })}
      </ul>
      {aboveLevel.length > 0 && (
        <small>Some feats sit in slots above your current level: {aboveLevel.map((f) => f.name).join(', ')}</small>
      )}
    </Wrapper>
  )
}
