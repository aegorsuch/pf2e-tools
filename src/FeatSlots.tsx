import { Fragment } from 'react'
import { confirmRemoval } from './confirmRemoval'
import { EntryDescription } from './EntryDescription'
import { ancestryFeatTraits, automaticFeatGrants, cannyAcumenOptions, deityDomains, eligibleFeats, featByName, featChoiceOptions, featSelectionPrerequisiteChecker, featSelectionLevel, featTakenLevel, featType, homebrewDedication, isGrantedSlot, plannedSlots, type PlannedSlot, type SectionProps } from './builder'
import { FeatChoice } from './FeatChoice'
import { featPrerequisiteSources } from './featPrerequisites'
import { actionOptionLabel } from './actionCost'
import { compareFeatSelections } from './featChoices'
import { featAccess } from './featAccess'
import { DOMAIN_FEATS } from './featSpells'
import type { Character, ContentEntry, FeatSlotCategory } from './types'

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

type FeatOption = { entry: ContentEntry; choice?: string; value: string; label: string; disabled?: boolean }

export function FeatSlots({ c, entries, save, categories, title = 'Feat slots', bare, search = {}, onSearch }: FeatSlotsProps) {
  const allSlots = plannedSlots(c)
  const background = entries.find((entry) => entry.kind === 'background' && entry.name === c.background)
  const backgroundFeats = typeof background?.data.feat === 'string'
    ? background.data.feat.split(',').flatMap((name) => {
      const feat = entries.find((entry) => entry.kind === 'feat' && entry.name === name.trim())
      return feat && (!categories || categories.some((category) => featType(feat, c) === `${LABEL[category]} Feat`))
        ? [feat] : []
    }) : []
  const automaticFeats = !categories || categories.includes('skill')
    ? automaticFeatGrants(c, entries).filter((grant) => !c.feats.some((feat) => feat.name === grant.name && featTakenLevel(feat) <= c.level)
      && !backgroundFeats.some((feat) => feat.name === grant.name)) : []
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
  const classNames = new Set([c.className, ...entries.filter((entry) => entry.kind === 'class').map((entry) => entry.name)])
  const displayName = (name: string) => name.replace(/ \(([^)]+)\)$/, (suffix, label: string) => classNames.has(label) ? '' : suffix)
  const choiceLabel = (name: string, choice: string) => name === 'Order Explorer' || name === 'Order Magic' ? `${choice} Order` : choice
  const cannyOptions = new Set(cannyAcumenOptions(c, entries))
  const accessKey = `access:${categories?.join(',') ?? 'all'}`
  const gmAccess = search[accessKey] === 'approved'
  const prerequisiteChecks = new Map<string, ReturnType<typeof featSelectionPrerequisiteChecker>>()
  const prerequisitesFor = (entry: ContentEntry, slot: PlannedSlot) => {
    let check = prerequisiteChecks.get(slot.key)
    if (!check) {
      check = featSelectionPrerequisiteChecker(c, entries, slot)
      prerequisiteChecks.set(slot.key, check)
    }
    return check(entry)
  }
  const optionsFor = (entry: ContentEntry, slot: PlannedSlot): FeatOption[] => {
    const prerequisites = prerequisitesFor(entry, slot)
    const unmet = prerequisites.missing.length > 0
    const access = featAccess(c, entry)
    const accessMissing = access && !access.automatic && !access.approved && !gmAccess
    const label = `${actionOptionLabel(displayName(entry.name), entry)}${unmet ? ` * Missing ${prerequisites.missing.join('; ')}` : prerequisites.manual.length ? ' (check prerequisites)' : ''}${access
      ? ` * Access: ${access.requirement} (${access.automatic ? 'met' : access.approved || gmAccess ? 'GM approved' : 'GM approval needed'})` : ''}`
    const choices = featChoiceOptions(entry.name, c, entries, slot.key)
    if (choices?.length === 0 && unmet) return [{ entry, value: entry.name, disabled: true, label }]
    return choices !== undefined
      ? choices.map((choice) => {
        const noImprovement = entry.name === 'Canny Acumen' && !cannyOptions.has(choice)
        const disabled = unmet || !!accessMissing || noImprovement || DOMAIN_FEATS.includes(entry.name) && !entry.name.startsWith('Advanced') && !deityDomains(c, entries).includes(choice)
        return { entry, choice, disabled, value: JSON.stringify([entry.name, choice]), label: `${label} (${choiceLabel(entry.name, choice)}${noImprovement ? ' - no improvement' : ''})` }
      })
      : [{ entry, value: entry.name, label, disabled: unmet || !!accessMissing }]
  }
  const saveFeatChanges = (patch: Partial<Character>) => {
    const next = { ...c, ...patch }
    const savedLevel = Math.max(next.level, ...next.feats.map(featTakenLevel))
    const keys = new Set(plannedSlots({ ...next, level: savedLevel, dismissedFeatSlots: [] }).map((slot) => slot.key))
    const feats = next.feats.filter((feat) => !feat.slot || !isGrantedSlot(feat.slot) || keys.has(feat.slot))
    const remaining = new Set(feats.map((feat) => feat.name))
    const removed = new Set(c.feats.filter((feat) => !remaining.has(feat.name)).map((feat) => feat.name))
    const removedIds = new Set(entries.filter((entry) => entry.kind === 'feat' && removed.has(entry.name)).map((entry) => entry.id))
    const visibleKeys = new Set(plannedSlots({ ...next, feats }).map((slot) => slot.key))
    save({
      ...patch, feats, entryIds: next.entryIds.filter((id) => !removedIds.has(id)),
      featAccessOverrides: next.featAccessOverrides?.filter(id => !removedIds.has(id)),
      dismissedFeatSlots: (next.dismissedFeatSlots ?? []).filter((key) => !visibleKeys.has(key) && (!isGrantedSlot(key) || keys.has(key))),
    })
  }
  const choose = (key: string, category: FeatSlotCategory, level: number, name: string) => {
    const slot = allSlots.find((slot) => slot.key === key) ?? { key, category, level }
    const option = eligibleFeats(entries, c, slot).flatMap((entry) => optionsFor(entry, slot)).find((option) => option.value === name && !option.disabled)
    if (name && name !== 'N/A' && !option) return
    const feats = c.feats.filter((f) => f.slot !== key)
    const entryIds = [...c.entryIds]
    if (option) {
      const { entry, choice } = option
      feats.push({ name: entry.name, type: `${LABEL[category]} Feat`, level: entry.level, slot: key, ...(choice ? { choice } : {}) })
      if (!entryIds.includes(entry.id)) entryIds.push(entry.id)
    }
    const skippedFeatSlots = (c.skippedFeatSlots ?? []).filter((slot) => slot !== key)
    if (category === 'archetype' && name === 'N/A') skippedFeatSlots.push(key)
    const access = option ? featAccess(c, option.entry) : undefined
    const featAccessOverrides = option && access && !access.automatic && gmAccess
      ? [...new Set([...(c.featAccessOverrides ?? []), option.entry.id])] : c.featAccessOverrides
    saveFeatChanges({ feats, entryIds, skippedFeatSlots, featAccessOverrides })
    onSearch?.(accessKey, '')
  }
  const removeExtra = (category: FeatSlotCategory, level: number, key: string) => {
    const index = c.extraSlots.findIndex((slot) => slot.category === category && slot.level === level && slot.count > 0)
    if (index < 0) return
    const extraSlots = c.extraSlots.flatMap((slot, i) =>
      i !== index ? [slot] : slot.count > 1 ? [{ ...slot, count: slot.count - 1 }] : [])
    const prefix = `${category}:${level}:`
    const removedIndex = Number(key.slice(prefix.length))
    const feats = c.feats.filter((feat) => feat.slot !== key).map((feat) => {
      if (!feat.slot?.startsWith(prefix)) return feat
      const slotIndex = Number(feat.slot.slice(prefix.length))
      return slotIndex > removedIndex ? { ...feat, slot: `${prefix}${slotIndex - 1}` } : feat
    })
    const skippedFeatSlots = (c.skippedFeatSlots ?? []).filter((slot) => slot !== key).map((slot) => {
      if (!slot.startsWith(prefix)) return slot
      const slotIndex = Number(slot.slice(prefix.length))
      return slotIndex > removedIndex ? `${prefix}${slotIndex - 1}` : slot
    })
    saveFeatChanges({ extraSlots, feats, skippedFeatSlots })
  }
  const addSlot = (category: FeatSlotCategory, level: number) => {
    const dismissed = plannedSlots({ ...c, dismissedFeatSlots: [] }).find((slot) =>
      slot.category === category && slot.level === level && c.dismissedFeatSlots?.includes(slot.key) && !allSlots.some((visible) => visible.key === slot.key))
    if (dismissed) save({ dismissedFeatSlots: c.dismissedFeatSlots?.filter((key) => key !== dismissed.key) })
    else save({ extraSlots: [...c.extraSlots, { category, level, count: 1 }] })
  }
  const removeSlot = (slot: PlannedSlot, extra: boolean) => {
    const selection = c.feats.find((feat) => feat.slot === slot.key)
    const remove = () => {
      if (allSlots.filter((other) => other.category === slot.category && other.level === slot.level).length === 1) {
        choose(slot.key, slot.category, slot.level, '')
      } else if (extra) {
        removeExtra(slot.category, slot.level, slot.key)
      } else {
        saveFeatChanges({
          dismissedFeatSlots: [...(c.dismissedFeatSlots ?? []), slot.key],
          feats: c.feats.filter((feat) => feat.slot !== slot.key),
          skippedFeatSlots: c.skippedFeatSlots?.filter((key) => key !== slot.key),
        })
      }
      onSearch?.(`${slot.key}:open`, '')
    }
    if (selection) confirmRemoval(`${selection.name} feat selection${extra ? ' and extra slot' : ''}`, remove)
    else remove()
  }

  const multi = new Set(slots.map((slot) => slot.category)).size > 1
  const Wrapper = bare ? 'div' : 'details'
  return (
    <Wrapper className={bare ? undefined : 'character-subsection'}>
      {!bare && <summary><h4>{title}</h4></summary>}
      {onSearch && <label title="Overrides rarity and access only, never prerequisites. Approval is saved for the selected feat.">
        <input type="checkbox" aria-label={`GM access approval (${title})`} checked={gmAccess}
          onChange={(event) => onSearch(accessKey, event.target.checked ? 'approved' : '')} /> GM approved access for next feat
      </label>}
      <ul className="feat-slot-list">
        {backgroundFeats.map((feat) => (
          <li className="feat-slot-row background-feat-row" key={`background:${feat.id}`}>
            <span>Background {featType(feat, c)}</span>
            <EntryDescription name={displayName(feat.name)} entry={feat} className="feat-name" access={featAccess(c, feat)} />
          </li>
        ))}
        {automaticFeats.map((feat) => (
          <li className="feat-slot-row automatic-feat-row" key={`automatic:${feat.name}`}>
            <span>Granted Skill Feat</span>
            <EntryDescription name={feat.name} entry={featByName(entries).get(feat.name)} className="feat-name" />
            <small>({feat.source})</small>
          </li>
        ))}
        {slots.map((s, index) => {
          const newLevel = index === 0 || slots[index - 1].level !== s.level
          const current = c.feats.find((f) => f.slot === s.key)?.name ?? (c.skippedFeatSlots?.includes(s.key) ? 'N/A' : '')
          const featIndex = c.feats.findIndex((f) => f.slot === s.key)
          const selection = c.feats[featIndex]
          const selectedName = selection
            ? `${displayName(selection.name)}${selection.choice ? ` (${choiceLabel(selection.name, selection.choice)})` : ''}` : current
          const sources = featPrerequisiteSources(entries, {
            ...c, name: current, category: s.category, ancestryTraits: ancestryFeatTraits(c),
          })
          const currentEntry = sources[0] ?? featByName(entries).get(current)
          const access = currentEntry ? featAccess(c, currentEntry) : undefined
          const ambiguous = new Set(sources.map((entry) => String(entry.data.prerequisite ?? ''))).size > 1
          const prerequisites = ambiguous ? { missing: [], manual: [`Verify source version of ${current}`] }
            : currentEntry ? prerequisitesFor(currentEntry, s) : undefined
          const picksType = s.category === 'archetype'
          const type = search[`${s.key}:type`] || (currentEntry ? (isDedication(currentEntry) ? 'dedication' : 'archetype') : 'archetype')
          const open = search[`${s.key}:open`] === '1'
          // Archetype pickers only build their (very long) list while the popup is open
          // Lists are only built while a picker is open; selects open on focus
          const lazy = !!onSearch && !open
          const options = lazy ? [] : eligibleFeats(entries, c, s, { includeUnmetPrerequisites: true }).filter((o) => matches(o) && (!picksType || (type === 'dedication') === isDedication(o)))
          const shown = picksType ? options.slice(0, Number(search[`${s.key}:limit`]) || PAGE) : options
          const optionsByLevel = new Map<number, FeatOption[]>()
          for (const option of shown) {
            const level = featSelectionLevel(option, c, entries, s.category)
            optionsByLevel.set(level, [...(optionsByLevel.get(level) ?? []), ...optionsFor(option, s)])
          }
          const firstAtLevel = !slots.slice(0, index).some((slot) => slot.category === s.category && slot.level === s.level)
          const granted = isGrantedSlot(s.key)
          const extra = !standardKeys.has(s.key) && !granted
          const label = `L${String(s.level).padStart(2, '0')} ${LABEL[s.category]}`
          const lastSlot = slots.filter((slot) => slot.category === s.category && slot.level === s.level).length === 1
          const locked = !!homebrewDedication(s.key)
          return (
            <Fragment key={s.key}>
            {!multi && newLevel && <li className="feat-level-heading">Level {String(s.level).padStart(2, '0')}</li>}
            <li className={`feat-slot-row${multi && index > 0 && newLevel ? ' feat-level-start' : ''}`}>
              {multi && <span>{label}{s.category === 'skill' ? ' Feats' : ''}</span>}
              {homebrewDedication(s.key) ? (
                <EntryDescription name={homebrewDedication(s.key)!.name} entry={currentEntry} className="feat-name" prerequisites={prerequisites} access={access} />
              ) : current ? (
                current === 'N/A' ? <span>N/A</span> : <EntryDescription name={selectedName} entry={currentEntry} className="feat-name" prerequisites={prerequisites} access={access} />
              ) : picksType ? (
                <button type="button" className="feat-picker-button" aria-label={`${label} feat`} onClick={() => onSearch?.(`${s.key}:open`, '1')}>
                  {current || '- empty -'}
                </button>
              ) : <select aria-label={`${label} feat`} value={current}
                onFocus={onSearch ? () => onSearch(`${s.key}:open`, '1') : undefined}
                onBlur={onSearch ? () => onSearch(`${s.key}:open`, '') : undefined} onChange={(e) => choose(s.key, s.category, s.level, e.target.value)}>
                <option value="">- empty -</option>
                {[...optionsByLevel].sort(([a], [b]) => a - b).map(([level, levelOptions]) => (
                  <optgroup key={level} label={`L${String(level).padStart(2, '0')}`}>
                    {levelOptions.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
                  </optgroup>
                ))}
              </select>}
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
                      {[...optionsByLevel].sort(([a], [b]) => a - b).map(([level, levelOptions]) => [
                        <li key={`l${level}`} className="feat-modal-level">L{String(level).padStart(2, '0')}</li>,
                        ...levelOptions.map((option) => (
                          <li key={option.value}>
                            <button type="button" aria-label={`${label}: ${option.label}`} disabled={option.disabled} className={option.entry.name === current ? 'active' : undefined}
                              onClick={() => { choose(s.key, s.category, s.level, option.value); onSearch?.(`${s.key}:open`, '') }}>
                              {option.label}
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
              {featIndex >= 0 && (!selection.choice || featChoiceOptions(selection.name, c, entries, s.key) === undefined)
                && <FeatChoice c={c} entries={entries} save={save} index={featIndex} />}
              {access && !access.automatic && !access.approved && <div className="feat-access-controls">
                <small>Access: {access.requirement} ({access.automatic ? 'met' : access.approved ? 'GM approved' : 'GM approval needed'})</small>
                {!access.automatic && currentEntry && <label>
                  <input type="checkbox" aria-label={`GM approved access: ${currentEntry.name}`} checked={access.approved}
                    onChange={(event) => save({ featAccessOverrides: event.target.checked
                      ? [...new Set([...(c.featAccessOverrides ?? []), currentEntry.id])]
                      : c.featAccessOverrides?.filter(id => id !== currentEntry.id) })} /> GM approved access
                </label>}
              </div>}
              <button type="button" aria-label={locked ? `${label} slot is granted by a house rule`
                : lastSlot ? `Clear ${label} feat selection`
                : `Remove ${label}${extra ? ' extra' : ''} feat slot ${s.key.split(':')[2]}`}
                title={locked ? 'Granted by a house rule' : lastSlot ? 'Clear selection' : 'Remove slot'}
                disabled={locked || lastSlot && !current}
                onClick={() => removeSlot(s, extra)}>−</button>
              {firstAtLevel && (!granted || !slots.some((o) => o.category === s.category && o.level === s.level && !isGrantedSlot(o.key)))
                ? <button type="button" aria-label={`Add ${label} feat slot`}
                  onClick={() => addSlot(s.category, s.level)}>+</button>
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
