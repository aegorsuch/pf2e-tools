import { EntryDescription } from './EntryDescription'
import { confirmRemoval } from './confirmRemoval'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ABILITIES, ABILITY_LABEL, abilityMod, activeAnimalFeatures, activeFeatsNamed, activeUntamedShiftEffects, canopyCrawlerAffects, canopyCrawlerTarget, championDevotionOptions, classSpellcasting, companionSpellTarget, focusSpells, isMagicHideActive, isSpellActive, magicHideChange, proficiencyBonus, signed, spellActiveChange, untamedShiftChoices, type SectionProps } from './builder'
import { ANIMAL_FEATURES, PERSISTENT_SPELLS } from './supplemental'
import type { Character, ContentEntry } from './types'
import { featTakenLevel, grantedWardenSpells, selectedFeatEntry, spellWardenLabel } from './featChoices'
import { ActionIcon } from './ActionIcon'
import { SpellActions, SpellDamageRolls, spellActionRolls } from './SpellDamage'
import { companionAdvancement, companionStats } from './companions'
import { dailyInnateUses, grantedFeatSpells, mageAutomatonOptions, unresolvedFeatSpells, type limitedSpellUses } from './featSpells'
import { SearchableSelect } from './SearchableSelect'
import { featSpellOptions } from './featSpells'
import { MAGIC_TRADITIONS, minorMagicOptions, minorMagicSpells } from './minorMagic'
import { canChangeUntamedForm, untamedFormOptions, untamedFormRanks } from './builder'
import { classDifficultyClass, classSpellSlots, druidSpellList, innateSpellAbility, spellDifficultyClass } from './builder'
import { divineAttackDamage } from './divineIntercessions'
import { SourceNote } from './Info'
import { itemSpells, itemSpellUses, type ItemSpell } from './itemSpells'
import { specificMagicItemName } from './equipmentGroups'
import { getSettings } from './settings'
import { witchwarperParadox, witchwarperRepertoireSlots, witchwarperSpellOptions } from './witchwarper'
import { spellAccessGranted } from './featAccess'

const RANK_NAMES = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary']
const AUTOMATED_SPELL_EFFECTS = ['Athletic Rush', 'Cairn Form', 'Imitate Fauna', 'Keen Smell', 'Magic Hide', 'Mountain Resilience', 'Oaken Resilience', 'Stormwind Flight', 'Untamed Form']

const isCommonSpell = (entry?: ContentEntry) => !!entry && !entry.traits.some(trait => /^(?:uncommon|rare|unique)$/i.test(trait))
  && !/^(?:uncommon|rare|unique)$/i.test(String(entry.data.rarity ?? ''))

function uniqueSpellNames<T extends { name: string }>(spells: T[]) {
  const names = new Set<string>()
  return spells.filter(spell => {
    if (names.has(spell.name)) return false
    names.add(spell.name)
    return true
  })
}

export function UntamedFormOptions({ c, entries, save }: SectionProps) {
  const active = isSpellActive(c, entries, 'Untamed Form')
  const mutable = !!activeFeatsNamed(c, 'As Mutable as Nature').length
  const canChange = canChangeUntamedForm(c, entries)
  const options = untamedFormOptions(c)
  const ranks = untamedFormRanks(c)
  const state = c.untamedForm
  const durations: NonNullable<NonNullable<Character['untamedForm']>['originalDuration']>[] =
    ['1 minute', '10 minutes', '24 hours', '1 hour', 'unlimited']
  return <fieldset className="col">
    <legend>Untamed Form</legend>
    <label>Cast rank{' '}
      <select aria-label="Untamed Form cast rank" value={state?.rank && ranks.includes(state.rank) ? state.rank : ranks[0]} disabled={active}
        onChange={event => {
          const rank = Number(event.target.value)
          if (active || !ranks.includes(rank)) return
          save({ untamedForm: { rank } })
        }}>
        {ranks.map(rank => <option key={rank} value={rank}>{rank}{rank !== ranks[0] ? ' (Form Control)' : ''}</option>)}
      </select>
    </label>
    <label>{active && mutable ? 'Change form' : 'Form'}{' '}
      {active && mutable && <ActionIcon actions="Single Action" />}
      <select aria-label="Untamed Form list" value={state?.form ?? ''} disabled={active && !canChange}
        onChange={event => {
          const form = options.find(option => option.name === event.target.value)
          if (!form || active && !canChange) return
          save({ untamedForm: { ...state, form: form.name, shape: undefined,
            originalDuration: active ? state?.originalDuration : form.duration } })
        }}>
        <option value="">Choose form list</option>
        {state?.form && !options.some(option => option.name === state.form) && <option value={state.form} disabled>{state.form} (unavailable)</option>}
        {options.map(option => <option key={option.name}>{option.name}</option>)}
      </select>
    </label>
    <label>Shape{' '}
      <input aria-label="Untamed Form shape" value={state?.shape ?? ''} disabled={!state?.form || active && !canChange}
        onChange={event => {
          if (!state?.form || active && !canChange) return
          save({ untamedForm: { ...state, shape: event.target.value } })
        }} />
    </label>
    <label>Original duration{' '}
      <select aria-label="Untamed Form original duration" value={state?.originalDuration ?? ''} disabled={active || !state?.form}
        onChange={event => {
          const duration = durations.find(duration => duration === event.target.value)
          if (active || !state?.form || !duration) return
          save({ untamedForm: { ...state, originalDuration: duration } })
        }}>
        <option value="">Choose duration</option>
        {durations.map(duration => <option key={duration}>{duration}</option>)}
      </select>
    </label>
    {mutable && active && !canChange && <small>As Mutable as Nature requires an original duration of 1 minute.</small>}
    <SourceNote source="Untamed Form" note={`Track the chosen battle form's other statistics separately; this does not replace your character statistics.${canChange
      ? ' Each form change costs 1 action. Remaining spell duration does not reset.' : ''}`} />
  </fieldset>
}

export function FocusPointTracker({ c, save, points }: Pick<SectionProps, 'c' | 'save'> & { points: number }) {
  const capacity = Math.min(3, Math.max(0, points))
  if (!capacity) return null
  const spent = new Set((c.spentFocusPoints ?? []).filter(index => Number.isInteger(index) && index >= 0 && index < capacity))
  return <span className="focus-tracker" role="group" aria-label={`${capacity - spent.size} of ${capacity} focus points available`}>
    {Array.from({ length: capacity }, (_, index) => {
      const label = `${spent.has(index) ? 'Restore' : 'Spend'} focus point ${index + 1}`
      return <button key={index} type="button" className="focus-point" aria-label={label}
        title={label} aria-pressed={!spent.has(index)} onClick={() => {
          const next = new Set(spent)
          if (next.has(index)) next.delete(index)
          else next.add(index)
          void save({ spentFocusPoints: [...next],
            focusPointsSpentSinceRefocus: Math.max(0, (c.focusPointsSpentSinceRefocus ?? spent.size) + (spent.has(index) ? -1 : 1)) })
        }} />
    })}
  </span>
}

export function InnateSpellUses({ c, save, grant }: Pick<SectionProps, 'c' | 'save'> & {
  grant: ReturnType<typeof grantedFeatSpells>[number]
}) {
  const uses = dailyInnateUses(c, grant)
  if (!uses) return null
  return spellUseTracker(`${grant.entry.name} (${grant.source})`, uses,
    spent => save({ innateSpellUses: { ...c.innateSpellUses, [uses.key]: spent } }), grant.rule.shared)
}

export function ItemSpellUses({ c, save, spell }: Pick<SectionProps, 'c' | 'save'> & { spell: ItemSpell }) {
  const uses = itemSpellUses(c, spell)
  if (!uses) return null
  return spellUseTracker(`${spell.name} (${specificMagicItemName(spell.source)})`, uses,
    spent => save({ itemSpellUses: { ...c.itemSpellUses, [uses.key]: spent } }))
}

function spellUseTracker(label: string, uses: NonNullable<ReturnType<typeof limitedSpellUses>>,
  onChange: (spent: number[]) => void, shared = false) {
  return <span className="focus-tracker" role="group"
    aria-label={`${uses.remaining} of ${uses.limit} uses remaining${shared ? ' (shared)' : ''}`}>
    {Array.from({ length: uses.limit }, (_, index) => {
      const spent = uses.spent.includes(index)
      const action = `${spent ? 'Restore' : 'Spend'} ${label} use ${index + 1}`
      return <button key={index} type="button" className="focus-point" aria-label={action}
        title={action} aria-pressed={!spent} onClick={() => {
          const next = new Set(uses.spent)
          if (next.has(index)) next.delete(index)
          else next.add(index)
          onChange([...next])
        }} />
    })}
  </span>
}

export function AnimalFeatureOptions({ c, entries, save }: SectionProps) {
  const active = activeAnimalFeatures(c, entries)
  const multiple = c.feats.some((feat) => feat.name === 'Persistent Animal Feature')
  return <fieldset className="col">
    <legend>Animal Feature: {multiple ? 'choose effects' : 'choose one'}</legend>
    {ANIMAL_FEATURES.filter(feature => feature.name !== 'Wings' || !getSettings().championFormNoFlight).map((feature) => {
      const unavailable = feature.rank > Math.ceil(c.level / 2)
      return <label key={feature.name} className={unavailable ? 'disabled' : undefined}>
        <input type="checkbox" aria-label={`Animal Feature: ${feature.name}`} disabled={unavailable} checked={active.includes(feature.name)}
          onChange={(e) => {
            if (unavailable) return
            const selected = isSpellActive(c, entries, 'Animal Feature') ? c.animalFeatures ?? active : []
            const animalFeatures = multiple
              ? [...selected.filter((name) => name !== feature.name), ...(e.target.checked ? [feature.name] : [])]
              : e.target.checked ? [feature.name] : []
            save({
              animalFeature: e.target.checked ? feature.name : animalFeatures[0] ?? feature.name,
              animalFeatures,
              ...spellActiveChange(c, 'Animal Feature', animalFeatures.length > 0),
            })
          }} /> {feature.name} <small>{feature.effect}{unavailable ? ` (requires rank ${feature.rank}; character level ${feature.rank * 2 - 1})` : ''}</small>
      </label>
    })}
  </fieldset>
}

function UntamedShiftOptions({ c, entries, save }: SectionProps) {
  const selected = activeUntamedShiftEffects(c, entries)
  const max = c.level >= 19 ? 3 : c.level >= 11 ? 2 : 1
  return <fieldset className="col">
    <legend>Untamed Shift: choose up to {max} effects</legend>
    {untamedShiftChoices().map(choice => {
      const unavailable = !activeFeatsNamed(c, choice.feat).length || !selected.includes(choice.name) && selected.length >= max
      return <label key={choice.name}><input type="checkbox" aria-label={`Untamed Shift: ${choice.name}`}
        checked={selected.includes(choice.name)} disabled={unavailable} onChange={event => {
          if (unavailable) return
          const effects = [...selected.filter(effect => effect !== choice.name), ...(event.target.checked ? [choice.name] : [])]
          save({ untamedShiftEffects: effects, ...spellActiveChange(c, 'Untamed Shift', effects.length > 0) })
        }} /> {choice.name}{!activeFeatsNamed(c, choice.feat).length && <small> (requires {choice.feat})</small>}</label>
    })}
    {selected.includes('Plant') && <small>Reach 10 feet, or 15 feet with a reach weapon.</small>}
  </fieldset>
}

function SpellEffectActions({ c, entries, save, entry, name }: SectionProps & {
  entry?: ContentEntry
  name: 'Animal Feature' | 'Untamed Shift' | 'Untamed Form'
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const dialogId = useId()
  const form = name === 'Untamed Form'
  const actions = form ? 'Two Actions' : typeof entry?.data.actions === 'string' && entry.data.actions.trim() ? entry.data.actions
    : name === 'Animal Feature' ? 'Single Action' : 'Single Action to Two Actions'
  const label = form ? 'Configure Untamed Form' : `Choose ${name} effects`
  return <>
    <button type="button" className="spell-action-button" aria-label={label}
      aria-haspopup="dialog" aria-controls={dialogId} title={`${actions}; ${label}`}
      onClick={() => {
        dialog.current?.showModal()
        dialog.current?.querySelector('h4')?.focus()
      }}>
      <ActionIcon actions={actions} />
    </button>
    <dialog ref={dialog} id={dialogId} className="entry-dialog" aria-labelledby={titleId}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <h4 id={titleId} tabIndex={-1}>{form ? 'Untamed Form options' : `${name} effects`}</h4>
      {form ? <UntamedFormOptions c={c} entries={entries} save={save} />
        : name === 'Animal Feature' ? <AnimalFeatureOptions c={c} entries={entries} save={save} />
        : <UntamedShiftOptions c={c} entries={entries} save={save} />}
      <form method="dialog"><button autoFocus>Close</button></form>
    </dialog>
  </>
}

export function CompanionSpellOptions({ c, entries, save, name, companionId, toggleOnly = false, hideToggle = false }: SectionProps & {
  name: 'Canopy Crawler' | 'Enlarge Companion' | 'Apex Companion'
  companionId?: string
  toggleOnly?: boolean
  hideToggle?: boolean
}) {
  const canopy = name === 'Canopy Crawler'
  const apex = name === 'Apex Companion'
  const targetKey = canopy ? 'canopyCrawlerCompanionId' : apex ? 'apexCompanionId' : 'enlargeCompanionId'
  const targetId = companionSpellTarget(c, c[targetKey])
  const companion = c.companions?.find((companion) => companion.id === companionId)
  const selectedCompanion = c.companions?.find((companion) => companion.id === (companionId ?? targetId))
  const selectedStats = !canopy && selectedCompanion ? companionStats(c, entries, selectedCompanion.type,
    selectedCompanion.id === c.companions?.[0]?.id ? companionAdvancement(c) : undefined, selectedCompanion.id) : undefined
  const naturalSize = selectedStats?.naturalSize
  const tooLarge = naturalSize === 'Huge' || naturalSize === 'Gargantuan'
  const needsHuge = naturalSize === 'Large'
  const enlargeUnavailable = !canopy && !apex && (tooLarge || needsHuge && c.level < 7)
  const invalidAnimal = apex && (!selectedCompanion || selectedCompanion.type === 'Construct Companion'
    || selectedStats?.entry.traits.some(trait => ['construct', 'eidolon'].includes(trait.toLowerCase())))
  const unavailable = c.level < (apex ? 19 : 3) || enlargeUnavailable || invalidAnimal
  const active = companionId === undefined ? isSpellActive(c, entries, name)
    : canopy ? canopyCrawlerAffects(c, entries, companionId) : isSpellActive(c, entries, name) && companionId === targetId
  const target = canopyCrawlerTarget(c)
  return <div className="row">
    {!hideToggle && <label title={apex ? 'Requires an animal companion with room to expand to Huge size.'
      : tooLarge ? 'Enlarge Companion has no effect on Huge or larger companions.'
      : needsHuge && c.level < 7 ? 'Requires rank 4 (character level 7) to enlarge a Large companion.' : undefined}>
      <input type="checkbox" aria-label={`${name}${companionId ? ` on ${companion?.name || companion?.type || companionId}` : ' active'}`}
      disabled={unavailable || canopy && !!companionId && target === 'Self'} checked={active && !unavailable} onChange={(e) => {
        if (unavailable || canopy && !!companionId && target === 'Self') return
        const change = spellActiveChange(c, name, e.target.checked)
        const other = apex ? 'Enlarge Companion' : 'Apex Companion'
        if (!canopy && e.target.checked && (companionId ?? targetId) === companionSpellTarget(c, apex ? c.enlargeCompanionId : c.apexCompanionId))
          change.activeSpells = change.activeSpells?.filter(spell => spell !== other)
        save({
          ...change,
          [targetKey]: companionId ?? targetId,
        })
      }} /> {companionId ? name : 'Active'}</label>}
    {!toggleOnly && (c.companions?.length ?? 0) > 1 && (!canopy || target !== 'Self') && <label>Companion{' '}
      <select aria-label={`${name} companion`} value={targetId ?? ''} onChange={(e) => {
        if (!c.companions?.some((companion) => companion.id === e.target.value)) return
        const other = apex ? 'Enlarge Companion' : 'Apex Companion'
        save({ [targetKey]: e.target.value,
          ...(!canopy && c.activeSpells?.includes(name)
            && e.target.value === companionSpellTarget(c, apex ? c.enlargeCompanionId : c.apexCompanionId)
            ? { activeSpells: c.activeSpells.filter(spell => spell !== other) } : {}) })
      }}>
        {[...(c.companions ?? [])].sort((a, b) => (a.name || a.type).localeCompare(b.name || b.type))
          .map((companion) => <option key={companion.id} value={companion.id}>{companion.name || companion.type}</option>)}
      </select>
    </label>}
  </div>
}

function SpellColumns() {
  return <div className="spellbook-columns" aria-hidden="true">
    <span>Spell</span><span>Duration</span><span>Range</span><span>Save</span><span>Area/Targets</span>
  </div>
}

function spellSave(save: string, dc?: number) {
  return dc !== undefined && /\b(?:Fortitude|Reflex|Will)\b/i.test(save) && !/\bDC\s+\d+/i.test(save) ? `${save} DC ${dc}` : save
}

function SpellItem({ c, name, entry, note, onRemove, active, onToggle, activeLabel, children, inlineControls, rank, saveDC, actionControls }: {
  c: Character
  name: string; entry?: ContentEntry; note?: ReactNode; onRemove?: () => void
  active?: boolean; onToggle?: (active: boolean) => void
  activeLabel?: string
  children?: ReactNode
  inlineControls?: ReactNode
  actionControls?: ReactNode
  rank: number
  saveDC?: number
}) {
  const metadata = spellMetadata(entry, rank, c)
  const activeToggle = onToggle && <label><input type="checkbox" aria-label={`${name} active`} checked={!!active}
    onChange={(e) => onToggle(e.target.checked)} /> {activeLabel ?? 'Active'}</label>
  return (
    <li className="innate-spell-row">
      <div className="innate-spell-name">
        <div className="spell-title"><EntryDescription name={name} entry={entry} />
          {actionControls ?? (!['Animal Feature', 'Untamed Shift', 'Untamed Form'].includes(name) && <SpellActions name={name} entry={entry} rank={rank} />)}{inlineControls}{activeToggle}</div>
        {note && <small>{note}</small>}
      </div>
      <span><small>Duration</small>{metadata.duration}{metadata.durationNote
        && <SourceNote source="Persistent Animal Feature" note={metadata.durationNote} inlineSource={false} />}</span>
      <span><small>Range</small>{metadata.range}</span>
      <span><small>Save</small>{spellSave(metadata.save, saveDC)}</span>
      <span><small>Area/Targets</small>{metadata.targets}</span>
      {(children || onRemove) && <div className="innate-spell-controls">
        {children}
        {onRemove && <button type="button" className="spell-remove" aria-label={`Remove ${name}`} title="Remove"
          onClick={() => confirmRemoval(`spell "${name}"`, onRemove)}>×</button>}
      </div>}
    </li>
  )
}

// Heightened entries that raise a spell's range and duration, e.g. Beastmaster Trance
function heightenedRangeDuration(entry: ContentEntry | undefined, rank: number) {
  let result: { range: string; duration: string } | undefined
  const pattern = /Heightened \((\d+)(?:st|nd|rd|th)\)\s+Increase the range to (.+?) and the duration (?:of|to) (.+?)\.(?=\s|$)/g
  for (const match of entry?.description.matchAll(pattern) ?? [])
    if (rank >= Number(match[1])) result = { range: match[2], duration: match[3] }
  return result && { range: result.range.replace(/^[a-z]/, initial => initial.toUpperCase()),
    duration: result.duration.replace(/^[a-z]/, initial => initial.toUpperCase()) }
}

function spellMetadata(entry?: ContentEntry, rank = entry?.level ?? 0, c?: Character) {
  const base = spellMetadataBase(entry, rank, c)
  return { ...base, ...heightenedRangeDuration(entry, rank) }
}

function spellMetadataBase(entry?: ContentEntry, rank = entry?.level ?? 0, c?: Character) {
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const current = entry?.data[key]
      if (current !== undefined && current !== null && String(current).trim())
        return String(current).replace(/^[a-z]/, initial => initial.toUpperCase())
    }
    return '—'
  }
  const name = entry?.name ?? ''
  const persistent = !!c && PERSISTENT_SPELLS.some(spell => spell.name === name && c.level >= spell.level)
    && activeFeatsNamed(c, `Persistent ${name}`).length > 0
  const duration = value('duration_text', 'duration')
  const seconds = /^\d+$/.test(duration) ? Number(duration) : undefined
  const unit = seconds ? ([[86400, 'day'], [3600, 'hour'], [60, 'minute'], [6, 'round'], [1, 'second']] as const)
    .find(([size]) => seconds % size === 0) : undefined
  const range = value('range_text', 'range')
  const targets = value('area', 'targets', 'target')
  const save = value('saving_throw', 'save', 'saving_throw_dc')
  const tracks = name === 'Vanishing Tracks'
  const instant = [
    'Distracting Decoy', 'Heal Animal', 'Heal Companion', 'Slime Spit', 'Snare Hopping',
    "Hunter's Luck", 'Soothing Mist', 'Threatening Mimicry', 'Mindlink', 'Pulverizing Wake', 'Combustion', 'Terrain Transposition',
    'Seek the Stars', 'Seek The Stars',
  ].includes(name)
  if (tracks && rank >= 4) return { duration: '8 hours', range: '20 feet', save, targets: 'Up to 10 creatures' }
  return {
    duration: persistent ? 'Until next daily preparations'
      : instant ? 'Instant' : tracks && rank >= 2 || name === 'Speak with Plants' && rank >= 4 ? '8 hours'
      : name === 'Canopy Crawler' && rank >= 5 ? '1 hour'
      : name === 'Speak with Stones' && rank >= 6 ? '8 hours'
      : unit && seconds !== undefined ? `${seconds / unit[0]} ${unit[1]}${seconds / unit[0] === 1 ? '' : 's'}`
      : seconds === 0 ? '—' : duration,
    durationNote: persistent && name === 'Animal Feature' && !getSettings().championFormNoFlight ? "Wings retain the spell's normal duration." : undefined,
    range: name === 'Pulverizing Wake' ? '15-foot cone'
      : name === 'Warning Stripes' ? 'Self or 30 feet'
      : ['Athletic Rush', 'Enduring Might', 'Speak with Plants', 'Speak with Stones', 'Gravity Weapon', 'Keen Smell', 'Animal Feature', "Hunter's Luck", 'One with Stone', 'Seek the Stars', 'Seek The Stars'].includes(name)
      || tracks && range === '—' ? 'Self'
      : /^\d+$/.test(range) ? Number(range) === 0 ? 'Touch' : `${range} feet` : range.replace(/^touch$/i, 'Touch'),
    save: save === '—' ? /\b(?:basic )?(?:Fortitude|Reflex|Will)(?= (?:saving throws?|saves?))/i.exec(entry?.description ?? '')?.[0] ?? save : save,
    targets: name === 'Beastmaster Trance' && getSettings().singleAnimalCompanion ? 'Your animal companion'
      : name === 'Magic Passage' ? `5-foot-wide, 10-foot-tall, ${rank >= 7 ? 20 : 10}-foot-deep section of wooden, plaster, or stone wall`
      : name === 'Pummeling Rubble' ? '15-foot cone'
      : name === 'Pulverizing Wake' ? '1 creature within reach'
      : name === 'Warning Stripes' ? 'Yourself or your animal companion'
      : name === 'Canopy Crawler' && rank >= 5 ? 'Yourself and your animal companion'
      : ['Athletic Rush', 'Enduring Might', 'Animal Feature', 'Gravity Weapon', 'Keen Smell', "Hunter's Luck", 'Speak with Plants', 'Speak with Stones', 'One with Stone', 'Seek the Stars', 'Seek The Stars'].includes(name)
      || targets === '—' && ['Sure Strike', 'True Strike', 'Vanishing Tracks'].includes(name) ? 'Self' : targets,
  }
}

function spellResolution(entry: ContentEntry) {
  const defense = spellMetadata(entry).save
  return {
    save: /\b(?:Fortitude|Reflex|Will)\b/i.test(defense)
      || /\b(?:Fortitude|Reflex|Will) (?:saving throws?|saves?)\b/i.test(entry.description),
    attack: entry.name !== 'Pulverizing Wake' && (entry.traits.some(trait => /^attack$/i.test(trait))
      || /\b(?:AC|Armor Class)\b/i.test(defense)
      || /\b(?:make|attempt) (?:a |an )?(?:ranged |melee )?spell attack\b/i.test(entry.description)),
  }
}

function InnateSpellRow({ c, grant, note, active, onToggle, activeLabel, inlineControls, children, saveDC }: {
  c: Character
  grant: ReturnType<typeof grantedFeatSpells>[number]
  note?: ReactNode
  active?: boolean
  onToggle?: (value: boolean) => void
  activeLabel?: string
  inlineControls?: ReactNode
  children?: ReactNode
  saveDC?: number
}) {
  return <SpellItem c={c} name={grant.entry.name} entry={grant.entry} rank={grant.rank} note={note}
    active={active} onToggle={onToggle} activeLabel={activeLabel} inlineControls={inlineControls} saveDC={saveDC}>
    {children}
  </SpellItem>
}

export function DevotionSpellChoice({ c, entries, save }: SectionProps) {
  if (c.className !== 'Champion' || c.level < 1) return null
  const options = championDevotionOptions(c, entries)
  const deity = entries.find(entry => entry.kind === 'deity' && entry.name === c.deity && !entry.deleted)
  return <div className="col">
    <label>Devotion spell{' '}
      <select aria-label="Devotion spell" value={c.devotionSpell ?? ''} onChange={event => {
        const choice = options.find(option => option === event.target.value)
        save({ devotionSpell: choice })
      }}>
        <option value="">Choose devotion spell</option>
        {c.devotionSpell && !options.includes(c.devotionSpell) && <option value={c.devotionSpell} disabled>{c.devotionSpell} (unavailable)</option>}
        {options.map(option => <option key={option}>{option}</option>)}
      </select>
    </label>
    {!c.deity ? <small>Choose a deity to see its divine font options.</small>
      : !deity ? <small>Deity data unavailable; sync content to verify divine font options.</small>
        : c.devotionSpell && !options.includes(c.devotionSpell)
          ? <small>Selected spell is not available from this deity's divine font.</small> : null}
  </div>
}

export function WitchwarperRepertoire({ c, entries, save }: SectionProps) {
  const [castRanks, setCastRanks] = useState<Record<string, number>>({})
  const spellIndex = useMemo(() => {
    const spells = entries.filter(entry => entry.kind === 'spell' && !entry.deleted && entry.systems.some(system => c.systems.includes(system)))
    return { spells, byId: new Map(spells.map(entry => [entry.id, entry])), byName: new Map(spells.map(entry => [entry.name, entry])) }
  }, [entries, c.systems])
  const options = useMemo(() => Array.from({ length: 11 }, (_, rank) => witchwarperSpellOptions(c, spellIndex.spells, rank)),
    [c.className, c.subclass, c.level, c.systems, c.spells, c.ancestry, c.ethnicity, c.background,
      c.achievements, c.featAccessOverrides, spellIndex])
  const paradox = witchwarperParadox(c)
  const casting = classSpellcasting(c, entries)
  const slots = classSpellSlots(c)
  if (!paradox || !casting?.ability || !slots) return null
  const sc = { ...c.spellcasting, ability: casting.ability, tradition: paradox.tradition, rank: casting.rank, slots }
  const setSc = (patch: Partial<NonNullable<Character['spellcasting']>>) => save({ spellcasting: { ...sc, ...patch } })
  const dc = spellDifficultyClass(c, entries)
  const selected = new Set<string>()
  const known = witchwarperRepertoireSlots(c).map(slot => {
    const entry = slot.granted ? spellIndex.byName.get(slot.granted)
      : spellIndex.byId.get(slot.value) ?? spellIndex.byName.get(slot.value)
    const key = `${slot.rank}:${entry?.name}`
    const valid = !!entry && !selected.has(key) && (slot.granted ? entry.name === slot.granted
      : options[slot.rank].some(option => option.id === entry.id))
    if (valid) selected.add(key)
    return { ...slot, entry, valid }
  })
  return <div className="class-spell-slots">
    <div className="row"><b>Spell Repertoire</b>
      {!!sc.spentSlots?.length && <button type="button" aria-label="Reset class spell slots"
        onClick={() => setSc({ spentSlots: [] })}>Reset slots</button>}
    </div>
    {[...new Set(known.map(slot => slot.rank))].map(rank => {
      const available = Array.from({ length: slots[rank] ?? 0 }, (_, index) => `${rank}:${index}`)
        .filter(key => !sc.spentSlots?.includes(key)).length
      return <section className="spell-slot-group" key={rank}>
        <h5>{rank === 0 ? `Cantrips (Heightened Level ${Math.ceil(c.level / 2)})`
          : `Spell Rank ${rank} (${available}/${slots[rank]} slots)`}</h5>
        <SpellColumns />
        <ul>{known.filter(slot => slot.rank === rank).map((slot, index) => {
          const choices = uniqueSpellNames([
            ...(slot.entry && options[rank].some(entry => entry.id === slot.entry?.id) ? [slot.entry] : []),
            ...options[rank].filter(entry => !known.some(other => other.key !== slot.key
              && other.rank === rank && other.valid && other.entry?.name === entry.name)),
          ])
          const signature = c.level >= 3 && rank > 0 && sc.signatureSpells?.[rank] === slot.key && slot.valid
          const requestedRank = castRanks[slot.key] ?? rank
          const allowedRanks = signature ? Object.keys(slots).map(Number)
            .filter(value => value > 0 && value >= (slot.entry?.level ?? rank)) : [rank]
          const castRank = allowedRanks.includes(requestedRank) ? requestedRank : rank
          const freeSlot = Array.from({ length: slots[castRank] ?? 0 }, (_, index) => `${castRank}:${index}`)
            .find(key => !sc.spentSlots?.includes(key))
          const metadata = spellMetadata(slot.entry, rank === 0 ? Math.ceil(c.level / 2) : castRank, c)
          const value = slot.granted ? slot.entry?.id ?? slot.granted : slot.value
          return <li className="spellbook-row" key={slot.key}>
            <div className="spellbook-slot">
              {slot.granted ? <><EntryDescription name={slot.granted} entry={slot.entry} />
                <SourceNote source={`${paradox.name} paradox`} note="Granted repertoire spell; does not use a free spell choice." /></>
                : <SearchableSelect aria-label={`Witchwarper ${rank === 0 ? 'cantrip' : `rank ${rank} spell`} ${index + 1}`}
                  value={value} onChange={event => {
                    const value = event.target.value
                    if (value && !choices.some(entry => entry.id === value)) return
                    const select = () => setSc({ repertoire: { ...sc.repertoire, [slot.key]: value } })
                    if (!value && slot.value) confirmRemoval(`repertoire spell "${slot.entry?.name ?? slot.value}"`, select)
                    else select()
                  }}>
                  <option value="">Not Selected</option>
                  {slot.value && !choices.some(entry => entry.id === slot.value)
                    && <option value={slot.value} disabled={!slot.valid}>{slot.entry?.name ?? slot.value}{!slot.valid && ' (unavailable)'}</option>}
                  {choices.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </SearchableSelect>}
              {slot.entry && !slot.granted && <EntryDescription name={slot.entry.name} entry={slot.entry}
                buttonLabel="Details" className="picker-details" />}
              {rank > 0 && <button type="button" disabled={!slot.valid || !freeSlot}
                aria-label={`Cast ${slot.entry?.name ?? 'unselected spell'} at rank ${castRank}`}
                onClick={() => {
                  if (slot.valid && freeSlot) setSc({ spentSlots: [...new Set([...(sc.spentSlots ?? []), freeSlot])] })
                }}>Cast</button>}
              {c.level >= 3 && rank > 0 && <button type="button" disabled={!slot.valid}
                aria-label={`Signature spell rank ${rank} choice ${index + 1}`} aria-pressed={signature}
                className={signature ? 'on' : ''} onClick={() => {
                  const select = () => setSc({ signatureSpells: { ...sc.signatureSpells, [rank]: signature ? '' : slot.key } })
                  if (signature) confirmRemoval(`signature spell "${slot.entry?.name}"`, select)
                  else select()
                }}>Signature</button>}
              {signature && <select aria-label={`Cast rank for ${slot.entry?.name}`} value={castRank}
                onChange={event => setCastRanks({ ...castRanks, [slot.key]: Number(event.target.value) })}>
                {allowedRanks.map(value => <option key={value} value={value}>Rank {value}</option>)}
              </select>}
              {slot.entry && <SpellActions name={slot.entry.name} entry={slot.entry} rank={rank === 0 ? Math.ceil(c.level / 2) : castRank} />}
            </div>
            <span><small>Duration</small>{metadata.duration}</span>
            <span><small>Range</small>{metadata.range}</span>
            <span><small>Save</small>{spellSave(metadata.save, dc)}</span>
            <span><small>Area/Targets</small>{metadata.targets}</span>
            {(slot.value || slot.granted) && !slot.valid
              && <small className="innate-spell-controls" role="status">Selected repertoire spell unavailable for your current spell list or rank.</small>}
          </li>
        })}</ul>
      </section>
    })}
  </div>
}

function spellSummaryData(c: Character, entries: ContentEntry[]) {
  const spells = (c.spells ?? []).map(spell => spell.name.toLowerCase() === 'goodberry'
    ? { ...spell, name: 'Cornucopia', entryId: entries.find(entry => entry.kind === 'spell' && !entry.deleted
      && entry.name === 'Cornucopia' && entry.systems.some(system => c.systems.includes(system)))?.id ?? spell.entryId } : spell)
  const granted = grantedWardenSpells(c, entries)
  const featSpells = grantedFeatSpells(c, entries)
  const innate = featSpells.filter(grant => grant.rule.kind === 'innate')
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name) || a.source.localeCompare(b.source))
  const { spells: focus, points: focusPoints } = focusSpells(c, entries)
  const manualSpells = spells.filter((s) => !granted.some((g) => g.id === s.entryId || g.name === s.name)
    && !focus.some(grant => grant.name === s.name))
  return { spells, granted, featSpells, innate, focus, focusPoints, manualSpells, items: itemSpells(c, entries) }
}

function RitualsContent({ c, entries, save }: SectionProps) {
  const rituals = entries.filter(entry => entry.kind === 'ritual' && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system))).sort((a, b) => a.name.localeCompare(b.name))
  const manualNames = c.rituals ?? []
  const grantedNames = new Set<string>()
  for (const feat of c.feats.filter(feat => featTakenLevel(feat) <= c.level)) {
    const source = selectedFeatEntry(c, entries, feat.name, feat.sourceId)
    for (const name of source?.ritualGrants ?? []) grantedNames.add(name.toLowerCase())
  }
  const ritualNames = [...new Map([...manualNames, ...grantedNames].map(name => [name.toLowerCase(), name])).values()]
    .sort((a, b) => a.localeCompare(b))
  if (!ritualNames.length) return null
  const saveManualNames = (names: string[]) => save({ rituals: names })
  return <section className="innate-spell-group">
    <h5>Rituals</h5>
    <SpellColumns />
    <ul>{ritualNames.map(name => {
      const key = name.toLowerCase()
      const entry = rituals.find(ritual => ritual.name.toLowerCase() === key)
      const manuallyAdded = manualNames.some(ritual => ritual.toLowerCase() === key)
      return <SpellItem c={c} key={key} name={entry?.name ?? name} entry={entry} rank={entry?.level ?? 0}
        actionControls={<ActionIcon entry={entry} showOther />}
        note={!entry && <span role="status">Ritual data unavailable.</span>}>
        {manuallyAdded && !grantedNames.has(key) && <button type="button" className="spell-remove"
          aria-label={`Remove ritual ${entry?.name ?? name}`} title="Remove" onClick={() => confirmRemoval(`ritual "${name}"`,
            () => saveManualNames(manualNames.filter(ritual => ritual.toLowerCase() !== key)))}>×</button>}
      </SpellItem>
    })}</ul>
  </section>
}

export function SpellsSummary({ c, entries, data }: Pick<SectionProps, 'c' | 'entries'> & { data?: ReturnType<typeof spellSummaryData> }) {
  const { manualSpells, granted, focus, innate, items } = data ?? spellSummaryData(c, entries)
  const slots = classSpellSlots(c)
  const prepared = Object.entries(c.spellcasting?.prepared ?? {}).filter(([key, value]) => {
    const [rank, index] = key.split(':').map(Number)
    return value && Number.isInteger(index) && index >= 0 && index < (slots?.[rank] ?? 0)
  })
  const classSpells = witchwarperParadox(c)
    ? new Set(witchwarperRepertoireSlots(c).flatMap(slot => slot.granted ? [slot.granted] : slot.value ? [slot.value] : [])).size
    : slots ? new Set(prepared.map(([, value]) => value)).size : manualSpells.length
  return <summary className="character-section-summary">
    <strong>Spells</strong>
    <span>{classSpells + new Set([...granted.map(spell => spell.name), ...focus.map(spell => spell.name)]).size + innate.length + items.length} spells
      {c.className === 'Champion' && c.level >= 1 && !focus.some(spell => spell.source === 'Devotion Spells') && ' · Choose devotion spell'}</span>
  </summary>
}

export function SpellsSection(props: SectionProps) {
  const data = useMemo(() => spellSummaryData(props.c, props.entries), [props.c, props.entries])
  return <details className="character-section">
    <SpellsSummary {...props} data={data} />
    <SpellsContent {...props} data={data} />
  </details>
}

export function SpellsContent({ c, entries, save, data }: SectionProps & { data?: ReturnType<typeof spellSummaryData> }) {
  const [tradition, setTradition] = useState(c.spellcasting?.tradition ?? '')
  const [preparedSlot, setPreparedSlot] = useState<string>()
  const casting = classSpellcasting(c, entries)
  const automaticSlots = classSpellSlots(c)
  const witchwarper = witchwarperParadox(c)
  const druid = c.className === 'Druid' && automaticSlots !== undefined
  const sc: Character['spellcasting'] = c.className === 'Druid' ? { ...c.spellcasting,
    ability: 'wis', tradition: 'Primal', rank: casting?.rank ?? 1,
    slots: automaticSlots ?? c.spellcasting?.slots ?? {} } : c.spellcasting
  const traditions = casting?.traditions ?? []
  const spellIndex = useMemo(() => {
    const spells = entries.filter(entry => entry.kind === 'spell' && !entry.deleted
      && entry.systems.some(system => c.systems.includes(system)))
    const byId = new Map<string, ContentEntry>()
    const byName = new Map<string, ContentEntry>()
    for (const spell of spells) {
      if (!byId.has(spell.id)) byId.set(spell.id, spell)
      if (!byName.has(spell.name)) byName.set(spell.name, spell)
    }
    return { spells, byId, byName }
  }, [entries, c.systems])
  const spellEntry = (name: string, id?: string) => id ? spellIndex.byId.get(id) : spellIndex.byName.get(name)
  const druidList = useMemo(() => druid ? druidSpellList(c, spellIndex.spells) : undefined,
    [druid, c.className, c.level, c.feats, c.systems, spellIndex])
  const druidAvailable = useMemo(() => druidList?.filter(entry => spellAccessGranted(c, entry)),
    [druidList, c.spells, c.ancestry, c.ethnicity, c.background, c.achievements, c.featAccessOverrides])
  const { spells, granted, featSpells, innate, focus, focusPoints, manualSpells, items } = data ?? spellSummaryData(c, entries)
  const otherFocus = focus.filter(spell => !granted.some(warden => warden.name === spell.name))
  const grownOfOakSpell = featSpells.find(grant => grant.source === 'Grown of Oak' && grant.entry.name === 'Oaken Resilience')
  const unresolved = unresolvedFeatSpells(c, entries)
  const spellRank = Math.max(casting?.rank ?? 0, innate.length ? c.level >= 12 ? 2 : 1 : 0)
  const grantDetails = (grant: typeof featSpells[number]) => {
    const ability = grant.rule.kind === 'innate' ? innateSpellAbility(c, grant.rule.ability) : grant.rule.ability ?? casting?.ability
    const proficiency = grant.rule.kind === 'innate' ? spellRank : casting?.rank ?? 1
    const mod = ability ? abilityMod(c.abilities[ability]) + proficiencyBonus(Math.max(1, proficiency), c.level) : undefined
    const resolution = spellResolution(grant.entry)
    const frequency = dailyInnateUses(c, grant) || /^at[- ]will$/i.test(grant.rule.frequency?.trim() ?? '') ? undefined : grant.rule.frequency
    const higherDC = grant.rule.dc === 'higher-class-or-spell'
    const classDC = higherDC && resolution.save ? classDifficultyClass(c, entries) : undefined
    const castingAbility = casting?.ability ?? sc?.ability
    const spellDC = mod === undefined ? undefined : Math.max(10 + mod, casting && castingAbility
      ? 10 + abilityMod(c.abilities[castingAbility]) + proficiencyBonus(Math.max(1, spellRank), c.level) : 0)
    const dc = higherDC ? classDC === undefined || spellDC === undefined ? undefined : Math.max(classDC, spellDC)
      : mod === undefined ? undefined : 10 + mod
    const stats = resolution.attack && mod !== undefined ? `Attack ${signed(mod)}` : undefined
    const notes = grant.source === 'Empathetic Connection' && grant.entry.name === 'Mindlink'
      || grant.source === 'Grown of Oak' && grant.entry.name === 'Oaken Resilience' ? [] : [
      frequency && `${frequency}${grant.rule.shared ? ' shared between alternatives' : ''}`,
      grant.rule.condition && !(grant.source === 'Mask of Power' && grant.rule.condition === 'Must be wearing your warmask')
        && grant.rule.condition !== 'Only within your claimed territory'
        && grant.rule.condition !== 'Only through barriers of earth or stone'
        && !(grant.entry.name === 'Command' && grant.rule.condition === 'This effect loses the linguistic trait') && grant.rule.condition,
      stats && `${!higherDC && ability ? `${ABILITY_LABEL[ability]} ` : ''}${stats}`,
      higherDC && resolution.save && classDC === undefined
        && <span role="status">Class DC unavailable: choose your class key attribute or sync class content.</span>,
    ].filter(Boolean)
    return { dc, note: notes.length ? <>{notes.map((note, index) => <span key={index}>{index > 0 && '; '}{note}</span>)}</> : undefined }
  }
  const buffProps = (name: string) => {
    if (!AUTOMATED_SPELL_EFFECTS.includes(name)) return {}
    return {
      active: name === 'Magic Hide' ? isMagicHideActive(c, entries) : c.activeSpells?.includes(name),
      onToggle: (active: boolean) => save(name === 'Magic Hide' ? magicHideChange(c, active) : {
        activeSpells: [...(c.activeSpells ?? []).filter((spell) => spell !== name), ...(active ? [name] : [])],
      }),
    }
  }
  const attackDamage = divineAttackDamage(c)
  const controls = (name: string, rank = Math.ceil(c.level / 2)) => <>
    {attackDamage.length > 0 && entries.some(entry => entry.kind === 'spell' && !entry.deleted && entry.name === name
      && entry.systems.some(system => c.systems.includes(system)) && spellResolution(entry).attack)
      && attackDamage.map(damage => <small key={damage.source}>+{damage.value} <SourceNote inlineSource={false}
        source={damage.source} note={damage.note} /></small>)}
    {(name === 'Canopy Crawler' || name === 'Enlarge Companion' || name === 'Apex Companion')
      && <CompanionSpellOptions c={c} entries={entries} save={save} name={name} hideToggle />}
    {name === 'Oaken Resilience' && (grownOfOakSpell
      ? <small>Cast rank {grownOfOakSpell.rank}</small>
      : <label>Cast rank{' '}
      <select aria-label="Oaken Resilience cast rank" value={c.oakenResilienceRank ?? ''} onChange={(event) => {
        const value = Number(event.target.value)
        save({ oakenResilienceRank: Number.isInteger(value) && value >= 2 && value <= 10 ? value : undefined })
      }}>
        <option value="">Choose cast rank</option>
        {Array.from({ length: 9 }, (_, i) => i + 2).map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>)}
    {!spellActionRolls(name, rank, entries.find(entry => entry.kind === 'spell' && entry.name === name)).length
      && <SpellDamageRolls name={name} rank={rank} />}
  </>
  const inlineControls = (name: string) => name === 'Animal Feature' || name === 'Untamed Shift' || name === 'Untamed Form'
    ? <SpellEffectActions c={c} entries={entries} save={save} entry={spellEntry(name)} name={name} />
    : name === 'Shield'
    ? <label title="Raise the Shield cantrip for a +1 circumstance bonus to AC until your next turn.">
      <input type="checkbox" aria-label="Raise Shield Cantrip (+1 AC)" checked={isSpellActive(c, entries, 'Shield')}
        onChange={event => save(spellActiveChange(c, 'Shield', event.target.checked))} /> Raise Shield Cantrip (+1 AC)
    </label>
    : name === 'Canopy Crawler' || name === 'Enlarge Companion' || name === 'Apex Companion'
      ? <CompanionSpellOptions c={c} entries={entries} save={save} name={name} toggleOnly /> : undefined
  const setSc = (patch: Partial<NonNullable<Character['spellcasting']>>) => {
    if (!casting) return
    save({ spellcasting: { ability: 'int', tradition: traditions[0] ?? '', slots: {}, ...sc, ...patch, rank: casting.rank, ...(casting.ability ? { ability: casting.ability } : {}) } })
  }
  const selectedTradition = traditions.length === 1
    ? traditions[0]
    : traditions.includes(tradition) ? tradition : ''

  const castAbility = casting?.ability ?? sc?.ability
  const mod = casting && castAbility ? abilityMod(c.abilities[castAbility]) + proficiencyBonus(casting.rank, c.level) : 0
  const classSpellDC = spellDifficultyClass(c, entries)
  const ownsFeat = (name: string) => c.feats.some(feat => feat.name === name && featTakenLevel(feat) <= c.level)
  const beastmasterCasting = ownsFeat('Beastmaster Dedication')
    ? ownsFeat('Master Beastmaster Spellcasting') ? 3 : ownsFeat('Expert Beastmaster Spellcasting') ? 2 : 1 : 0
  const groupLabel = (name: string, entryId: string | undefined, rank: number, cantrip: boolean) => {
    const entry = spellEntry(name, entryId)
    return spellWardenLabel(entry?.data.warden_spell_tier) || entry?.traits.some(trait => trait.toLowerCase() === 'focus')
      ? 'Focus Spells' : cantrip ? 'Cantrips' : `Rank ${rank}`
  }
  const listedSpells = [
    ...granted.map((s) => ({ name: s.name, entryId: s.id, group: 'Focus Spells', index: -1 })),
    ...spells.flatMap((s, index) => manualSpells.includes(s)
      && (!druid || !isCommonSpell(spellEntry(s.name, s.entryId)))
      ? [{ name: s.name, entryId: s.entryId, group: groupLabel(s.name, s.entryId, s.rank, s.cantrip), index }] : []),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const groupOrder = ['Focus Spells', 'Cantrips', ...Array.from({ length: 10 }, (_, i) => `Rank ${i + 1}`)]
  const groups = [...new Set(listedSpells.map((s) => s.group))]
    .sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b))
  const innateGroups: { key: string; tradition: string; rank: number; grants: typeof innate }[] = []
  for (const grant of innate) {
    const tradition = grant.rule.tradition ? grant.rule.tradition[0].toUpperCase() + grant.rule.tradition.slice(1) : 'Innate'
    const key = `${tradition}:${grant.rank}`
    let group = innateGroups.find(item => item.key === key)
    if (!group) {
      group = { key, tradition, rank: grant.rank, grants: [] }
      innateGroups.push(group)
    }
    group.grants.push(grant)
  }
  innateGroups.sort((a, b) => a.tradition.localeCompare(b.tradition) || a.rank - b.rank)
  const preparedOptions = useMemo(() => {
    const available = druidAvailable?.map(entry => ({ name: entry.name, entryId: entry.id,
      rank: entry.level, cantrip: entry.traits.some(trait => trait.toLowerCase() === 'cantrip') })) ?? c.spells ?? []
    return Array.from({ length: 11 }, (_, rank) => {
      const options = available
      .filter(spell => rank === 0 ? spell.cantrip : !spell.cantrip && spell.rank <= rank)
      .filter(spell => {
        const entry = spell.entryId ? spellIndex.byId.get(spell.entryId) : spellIndex.byName.get(spell.name)
        const traditions = String(entry?.data.tradition ?? '').toLowerCase().split(/,\s*/)
        return druid || !selectedTradition || !entry || traditions.includes(selectedTradition.toLowerCase())
      })
      .sort((a, b) => a.name.localeCompare(b.name) || (a.entryId ?? '').localeCompare(b.entryId ?? ''))
      return { options, choices: druid ? uniqueSpellNames(options) : options }
    })
  }, [druidAvailable, c.spells, druid, selectedTradition, spellIndex])
  const classSlotRanks = Array.from({ length: 11 }, (_, rank) => ({
    rank,
    count: Math.max(0, Math.min(20, Math.trunc(Number(sc?.slots[rank]) || 0))),
  })).filter(item => item.count > 0)
  const allFocus = [...otherFocus.map(spell => ({ name: spell.name, entryId: undefined, index: -1 })),
    ...listedSpells.filter(spell => spell.group === 'Focus Spells')].sort((a, b) => a.name.localeCompare(b.name))
  const focusTraditions = [...new Set(allFocus.flatMap(spell => {
    const entry = spellEntry(spell.name, spell.entryId)
    const grant = featSpells.find(grant => grant.rule.kind === 'focus' && grant.entry.name === spell.name)
    const fallback = entry?.traits.includes('Ranger') || ['Ranger', 'Druid'].includes(c.className ?? '')
      ? 'Primal' : selectedTradition || (c.className === 'Champion' ? 'Divine' : '')
    return String(grant?.rule.tradition || entry?.data.tradition || fallback).split(',')
      .map(tradition => tradition.trim().replace(/^[a-z]/, initial => initial.toUpperCase())).filter(Boolean)
  }))]
  const renderSpellGroup = (group: string) => <section className="innate-spell-group" key={group}>
    <h5>{group}</h5>
    <SpellColumns />
    <ul>{listedSpells.filter(spell => spell.group === group).map(spell => {
      const entry = spellEntry(spell.name, spell.entryId)
      const rank = Math.ceil(c.level / 2)
      return <SpellItem c={c} key={`${spell.name}-${spell.index}`} name={spell.name} entry={entry} rank={rank} saveDC={classSpellDC}
        inlineControls={inlineControls(spell.name)} {...buffProps(spell.name)}
        onRemove={spell.index >= 0 ? () => save({ spells: spells.filter((_, index) => index !== spell.index),
          activeSpells: c.activeSpells?.filter(name => name !== spell.name) }) : undefined}>
        {controls(spell.name, rank)}
      </SpellItem>
    })}</ul>
  </section>

  return (
      <div className="character-section-content">
      <DevotionSpellChoice c={c} entries={entries} save={save} />
      {casting && <>
      <div className="row">
        {!casting.ability && c.className !== 'Witchwarper' && <label>Casting ability{' '}
          <select value={sc?.ability ?? ''} onChange={(e) => setSc({ ability: e.target.value as never })}>
            <option value="">none</option>
            {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_LABEL[a]}</option>)}
          </select>
        </label>}
        {traditions.length > 1 && <label>Tradition{' '}
              <select value={selectedTradition} onChange={(e) => { setSc({ tradition: e.target.value }); setTradition(e.target.value) }}>
                <option value="">Choose…</option>
                {traditions.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>}
        {traditions.length === 1 && <b>{traditions[0]} tradition</b>}
      </div>
      {(c.className === 'Witchwarper' ? casting.ability : sc || casting.ability) && (
        <div className="skill-row with-item spell-dc-row">
          <span className="skill-name">DC {10 + mod} <small>(Attack {signed(mod)})</small></span>
          <span className="rank-dots" role="img" aria-label={`Spellcasting proficiency: ${RANK_NAMES[casting.rank]}`} title={RANK_NAMES[casting.rank]}>
            {['T', 'E', 'M', 'L'].map((letter, i) => <button key={letter} type="button" tabIndex={-1} disabled className={casting.rank >= i + 1 ? 'on' : ''}>{letter}</button>)}
          </span>
          <span className="skill-part"><small>{castAbility ? ABILITY_LABEL[castAbility] : ''}</small>{signed(castAbility ? abilityMod(c.abilities[castAbility]) : 0)}</span>
          <span className="skill-part"><small>Prof</small>{signed(proficiencyBonus(casting.rank, c.level))}</span>
          <span className="skill-part"><small>Item</small>{signed(0)}</span>
        </div>
      )}
      {sc && traditions.length > 0 && !automaticSlots && (
        <div className="row spell-slot-counts">
          <small>Spell slots:</small>
          {Array.from({ length: 11 }, (_, rank) => (
            <label key={rank}>{rank === 0 ? 'Cantrips' : `Rank ${rank}`}{' '}
              <input type="number" min={0} max={20} style={{ width: '3.5em' }} value={sc.slots[rank] ?? 0}
                onChange={(e) => setSc({ slots: { ...sc.slots, [rank]: Math.max(0, Math.min(20, +e.target.value || 0)) } })} />
            </label>
          ))}
        </div>
      )}
      {c.className === 'Druid' && !druid && <small role="status">
        Flexible Spellcaster preparation is not automated; your manual spell-slot settings are retained.
      </small>}
      {witchwarper && <WitchwarperRepertoire c={c} entries={entries} save={save} />}
      {!witchwarper && sc && traditions.length > 0 && classSlotRanks.length > 0 && <div className="class-spell-slots">
        <div className="row">
          <b>Class Spell Slots</b>
          {(sc.spentSlots?.length ?? 0) > 0 && <button type="button" aria-label="Reset class spell slots"
            title="Restore class spell slots during daily preparations."
            onClick={() => setSc({ spentSlots: [] })}>Reset slots</button>}
        </div>
        {classSlotRanks.map(({ rank, count }) => {
          const cantrip = rank === 0
          const title = cantrip ? `Cantrips (Heightened Level ${Math.ceil(c.level / 2)})` : `Spell Rank ${rank}`
          const { options, choices } = preparedOptions[rank]
          return <section className="spell-slot-group" key={rank}>
            <h5>{title}</h5>
            <SpellColumns />
            <ul>{Array.from({ length: count }, (_, index) => {
              const slotKey = `${rank}:${index}`
              const selectedValue = sc.prepared?.[slotKey] ?? ''
              const selectedSpell = (c.spells ?? []).find(spell => (spell.entryId ?? spell.name) === selectedValue)
              const selectedEntry = selectedSpell ? spellEntry(selectedSpell.name, selectedSpell.entryId)
                : spellIndex.byId.get(selectedValue)
              const metadata = spellMetadata(selectedEntry, cantrip ? Math.ceil(c.level / 2) : rank, c)
              const spent = sc.spentSlots?.includes(slotKey) ?? false
              const selectedOption = options.find(spell => (spell.entryId ?? spell.name) === selectedValue
                || selectedSpell && !selectedSpell.entryId && spell.name === selectedSpell.name)
              const valid = !!selectedOption
              const displayedSelection = druid && selectedOption && selectedValue === selectedOption.name
                ? { ...selectedOption, entryId: undefined } : selectedOption
              const slotOptions = druid && displayedSelection
                ? choices.map(option => option.name === displayedSelection.name ? displayedSelection : option) : choices
              const showOptions = slotOptions.length <= 10 || preparedSlot === slotKey
              return <li className="spellbook-row" key={slotKey}>
                <div className="spellbook-slot">
                  {!cantrip && <button type="button" disabled={!valid || spent} aria-label={`Cast spell slot rank ${rank} slot ${index + 1}`}
                    onClick={() => {
                      if (!valid || spent) return
                      setSc({ spentSlots: [...new Set([...(sc.spentSlots ?? []), slotKey])] })
                    }}>Cast</button>}
                  <SearchableSelect aria-label={`${cantrip ? 'Cantrip' : `Spell Rank ${rank}`} slot ${index + 1}`}
                    value={selectedValue} optionCount={slotOptions.length} disabled={spent} onPrepare={() => setPreparedSlot(slotKey)}
                    onChange={event => {
                      const value = event.target.value
                      if (value && !(valid && value === selectedValue) && !options.some(spell => (spell.entryId ?? spell.name) === value)) return
                      const prepare = () => {
                        const prepared = { ...sc.prepared }
                        if (value) prepared[slotKey] = value
                        else delete prepared[slotKey]
                        setSc({ prepared })
                      }
                      if (!value && selectedValue) confirmRemoval(`prepared spell "${selectedEntry?.name ?? selectedValue}"`, prepare)
                      else prepare()
                    }}>
                    <option value="">Not Selected</option>
                    {selectedValue && (!valid || !showOptions || (displayedSelection?.entryId ?? displayedSelection?.name) !== selectedValue)
                      && <option value={selectedValue} disabled={!valid}>{selectedSpell?.name ?? selectedEntry?.name ?? selectedValue}{!valid && ' (unavailable)'}</option>}
                    {showOptions && slotOptions.map(spell => <option key={spell.entryId ?? spell.name} value={spell.entryId ?? spell.name}>{spell.name}</option>)}
                  </SearchableSelect>
                  {selectedEntry && <EntryDescription name={selectedEntry.name} entry={selectedEntry}
                    buttonLabel="Details" className="picker-details" />}
                  {selectedEntry && (selectedEntry.name === 'Animal Feature' || selectedEntry.name === 'Untamed Shift'
                    ? <SpellEffectActions c={c} entries={entries} save={save} entry={selectedEntry} name={selectedEntry.name} />
                    : <SpellActions name={selectedEntry.name} entry={selectedEntry} rank={cantrip ? Math.ceil(c.level / 2) : rank} />)}
                </div>
                <span><small>Duration</small>{metadata.duration}{metadata.durationNote
                  && <SourceNote source="Persistent Animal Feature" note={metadata.durationNote} inlineSource={false} />}</span>
                <span><small>Range</small>{metadata.range}</span>
                <span><small>Save</small>{spellSave(metadata.save, classSpellDC)}</span>
                <span><small>Area/Targets</small>{metadata.targets}</span>
                {selectedValue && !valid && <small className="innate-spell-controls" role="status">
                  Selected spell unavailable for your current spell list or slot rank.
                </small>}
              </li>
            })}</ul>
          </section>
        })}
      </div>}
      </>}
      {c.heritage === 'Mage Automaton' && c.level >= 1 && (() => {
        const options = mageAutomatonOptions(c, entries)
        const current = c.mageAutomatonCantrip ?? ''
        return <SearchableSelect label="Mage Automaton cantrip" aria-label="Mage Automaton cantrip" value={current}
          onChange={event => {
            const value = event.target.value
            if (value && !options.some(entry => entry.name === value)) return
            const select = () => save({ mageAutomatonCantrip: value || undefined })
            if (!value && current) confirmRemoval(`Mage Automaton cantrip "${current}"`, select)
            else select()
          }}>
          <option value="">Choose cantrip</option>
          {current && !options.some(entry => entry.name === current) && <option value={current} disabled>{current} (unavailable)</option>}
          {[...new Set(options.map(entry => entry.name))].map(name => <option key={name}>{name}</option>)}
        </SearchableSelect>
      })()}
      {c.feats.map((feat, index) => {
        if (feat.name !== 'First World Magic' || featTakenLevel(feat) > c.level) return null
        const options = featSpellOptions(c, entries, feat) ?? []
        return <span className="feat-choice" key={feat.slot ?? `${feat.name}:${index}`}>
          <SearchableSelect label={`${feat.name} spell`} aria-label={`${feat.name} spell`} value={feat.choice ?? ''} onChange={event => {
            const choice = event.target.value || undefined
            if (choice && !options.some(spell => spell.name === choice)) return
            save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
          }}>
            <option value="">Choose spell</option>
            {feat.choice && !options.some(spell => spell.name === feat.choice) && <option disabled value={feat.choice}>{feat.choice} (unavailable)</option>}
            {[...new Set(options.map(spell => spell.name))].map(name => <option key={name}>{name}</option>)}
          </SearchableSelect>
          {!options.length && <small>No available spells. Check ancestry, earlier choices, and imported spell data.</small>}
        </span>
      })}
      {!!activeFeatsNamed(c, 'Minor Magic').length && <div className="col">
        <b>Minor Magic</b>
        <label>Tradition{' '}<select aria-label="Minor Magic tradition" value={c.minorMagic?.tradition ?? ''} onChange={event => {
          const tradition = MAGIC_TRADITIONS.find(value => value === event.target.value)
          save({ minorMagic: { ...c.minorMagic, tradition } })
        }}><option value="">Choose tradition</option>{MAGIC_TRADITIONS.map(value => <option key={value}>{value}</option>)}</select></label>
        {c.minorMagic?.tradition && Array.from({ length: 2 }, (_, index) => {
          const tradition = c.minorMagic!.tradition!
          const choices = c.minorMagic?.cantrips?.[tradition] ?? []
          const current = choices[index] ?? ''
          const options = minorMagicOptions(c, entries).filter(entry => entry.name === current || !choices.includes(entry.name))
          return <SearchableSelect key={index} label={`Minor Magic cantrip ${index + 1}`}
            aria-label={`Minor Magic cantrip ${index + 1}`} value={current} onChange={event => {
              const value = event.target.value
              if (value && !options.some(entry => entry.name === value)) return
              const next = Array.from({ length: 2 }, (_, i) => i === index ? value : choices[i] ?? '')
              save({ minorMagic: { ...c.minorMagic, cantrips: { ...c.minorMagic?.cantrips, [tradition]: next } } })
            }}>
            <option value="">Choose cantrip</option>
            {current && !options.some(entry => entry.name === current) && <option value={current} disabled>{current} (unavailable)</option>}
            {[...new Set(options.map(entry => entry.name))].map(name => <option key={name}>{name}</option>)}
          </SearchableSelect>
        })}
        <small>{ABILITY_LABEL[innateSpellAbility(c)]} spell attack {signed(abilityMod(c.abilities[innateSpellAbility(c)]) + proficiencyBonus(1, c.level))};
          DC {10 + abilityMod(c.abilities[innateSpellAbility(c)]) + proficiencyBonus(1, c.level)} (trained).</small>
        <ul>{minorMagicSpells(c, entries).map(entry => <SpellItem c={c} key={entry.name} name={entry.name} entry={entry} rank={Math.ceil(c.level / 2)}
          inlineControls={inlineControls(entry.name)} saveDC={10 + abilityMod(c.abilities[innateSpellAbility(c)]) + proficiencyBonus(1, c.level)}
          note={`Minor Magic; rank ${Math.ceil(c.level / 2)} ${c.minorMagic?.tradition}`} {...buffProps(entry.name)}>
          {controls(entry.name)}
        </SpellItem>)}</ul>
      </div>}
      {(focusPoints > 0 || allFocus.length > 0) && (
        <div>
          <div className="focus-spells-heading"><b>Focus Spells</b><FocusPointTracker c={c} save={save} points={focusPoints} /></div>
          {allFocus.length > 0 && <section className="innate-spell-group">
            <h5>{focusTraditions.length > 0 && `${focusTraditions.join(' / ')} `}Focus Spells Rank {Math.ceil(c.level / 2)}</h5>
            <SpellColumns />
            <ul>
            {allFocus.map((s) => {
              const entry = spellEntry(s.name, s.entryId)
              const grant = featSpells.find(grant => grant.rule.kind === 'focus' && grant.entry.name === s.name)
              const details = grant ? grantDetails(grant) : undefined
              const note = details ? details.note : entry && spellResolution(entry).attack
                ? !casting && beastmasterCasting ? `Wis Attack ${signed(abilityMod(c.abilities.wis) + proficiencyBonus(beastmasterCasting, c.level))}`
                : casting && castAbility ? `${ABILITY_LABEL[castAbility]} Attack ${signed(mod)}`
                  : <span role="status">Check the granting rules for this spell's spellcasting attribute and proficiency.</span>
                : undefined
              return <SpellItem c={c} key={s.name} entry={entry} name={s.name} rank={Math.ceil(c.level / 2)} inlineControls={inlineControls(s.name)}
                note={note} saveDC={details ? details.dc : !casting && beastmasterCasting ? 10 + abilityMod(c.abilities.wis) + proficiencyBonus(beastmasterCasting, c.level) : classSpellDC} {...buffProps(s.name)}
                onRemove={s.index >= 0 ? () => save({ spells: spells.filter((_, index) => index !== s.index),
                  activeSpells: c.activeSpells?.filter(name => name !== s.name) }) : undefined}>
                {controls(s.name)}
              </SpellItem>
            })}
            </ul>
          </section>}
        </div>
      )}
      {innate.length > 0 && <div>
        <div className="row"><b>Innate Spells</b>
        </div>
        {innateGroups.map(group => <section className="innate-spell-group" key={group.key}>
          <h5>{group.tradition} Spell Rank {group.rank}</h5>
          <SpellColumns />
          <ul>{group.grants.map(grant => {
            const details = grantDetails(grant)
            return <InnateSpellRow c={c} key={grant.usageKey} grant={grant} note={details.note} saveDC={details.dc}
              inlineControls={<>{inlineControls(grant.entry.name)}<InnateSpellUses c={c} save={save} grant={grant} /></>}
              {...buffProps(grant.entry.name)}>
              {controls(grant.entry.name, grant.rank)}
            </InnateSpellRow>
          })}</ul>
        </section>)}
      </div>}
      <RitualsContent c={c} entries={entries} save={save} />
      {items.length > 0 && <section className="innate-spell-group">
        <h5>Item Spells</h5>
        <SpellColumns />
        <ul>{items.map((spell, index) => {
          const uses = itemSpellUses(c, spell)
          const note = [(!uses || !/\bper day\b/i.test(spell.frequency ?? '')) && spell.frequency, spell.condition]
            .filter(Boolean).join('; ')
          return <SpellItem c={c} key={`${spell.source.id}:${index}`}
          name={spell.name} entry={spell.entry} rank={spell.rank}
          saveDC={spell.dc ?? (spell.usesSpellcasting ? classSpellDC : undefined)}
          inlineControls={<ItemSpellUses c={c} save={save} spell={spell} />}
          actionControls={spell.actions ? <ActionIcon actions={spell.actions} showOther />
            : <SpellActions name={spell.name} entry={spell.entry} rank={spell.rank} />}
          note={spell.entry ? note || undefined : <>{note && `${note}; `}
            <span role="status">Spell data unavailable. Sync Archives of Nethys content to load it.</span>
          </>} />
        })}</ul>
      </section>}
      {unresolved.map((grant, index) => <p key={`${grant.source?.id}:${grant.name}:${index}`} className="feat-prerequisite-note" role="status">
        Spell data unavailable: {grant.name} (<EntryDescription name={grant.sourceName ?? grant.source?.name ?? 'Granting feat'} entry={grant.source} entries={entries} />).
        {' '}Review source rules; this spell is not automated.
      </p>)}
      {druid && groups.some(group => group !== 'Focus Spells') && <b>Learned spell access</b>}
      {groups.filter(group => group !== 'Focus Spells').map(renderSpellGroup)}
      </div>
  )
}
