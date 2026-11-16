import { EntryDescription } from './EntryDescription'
import { confirmRemoval } from './confirmRemoval'
import { useMemo, useState, type ReactNode } from 'react'
import { ABILITIES, ABILITY_LABEL, abilityMod, activeAnimalFeatures, activeFeatsNamed, activeUntamedShiftEffects, canopyCrawlerAffects, canopyCrawlerTarget, championDevotionOptions, classSpellcasting, companionSpellTarget, focusSpells, isMagicHideActive, isSpellActive, magicHideChange, proficiencyBonus, signed, spellActiveChange, UNTAMED_SHIFT_CHOICES, type SectionProps } from './builder'
import { ANIMAL_FEATURES } from './supplemental'
import type { Character, ContentEntry } from './types'
import { grantedWardenSpells, spellWardenLabel } from './featChoices'
import { ActionIcon } from './ActionIcon'
import { SpellActions, SpellDamageRolls, spellActionRolls } from './SpellDamage'
import { companionAdvancement, companionStats } from './companions'
import { dailyInnateUses, grantedFeatSpells, unresolvedFeatSpells } from './featSpells'
import { featTakenLevel } from './featChoices'
import { SearchableSelect } from './SearchableSelect'
import { featSpellOptions, fixedAncestralCantrip } from './featSpells'
import { MAGIC_TRADITIONS, minorMagicOptions, minorMagicSpells } from './minorMagic'
import { canChangeUntamedForm, untamedFormOptions, untamedFormRanks } from './builder'
import { classDifficultyClass, classSpellSlots, druidSpellList, innateSpellAbility } from './builder'
import { divineAttackDamage } from './divineIntercessions'
import { SourceNote } from './Info'

const RANK_NAMES = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary']
const INLINE_SPELL_BUFFS = ['Imitate Fauna', 'Gravity Weapon', 'Keen Smell', 'Magic Hide']

const isCommonSpell = (entry?: ContentEntry) => !!entry && !entry.traits.some(trait => /^(?:uncommon|rare|unique)$/i.test(trait))
  && !/^(?:uncommon|rare|unique)$/i.test(String(entry.data.rarity ?? ''))

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
    {canChange && <small>Each form change costs 1 action. Remaining spell duration does not reset.</small>}
    <small>Track the chosen battle form's other statistics separately; this does not replace your character statistics.</small>
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
  const label = `${grant.entry.name} (${grant.source})`
  return <span className="focus-tracker" role="group"
    aria-label={`${uses.remaining} of ${uses.limit} uses remaining${grant.rule.shared ? ' (shared)' : ''}`}>
    {Array.from({ length: uses.limit }, (_, index) => {
      const spent = uses.spent.includes(index)
      const action = `${spent ? 'Restore' : 'Spend'} ${label} use ${index + 1}`
      return <button key={index} type="button" className="focus-point" aria-label={action}
        title={action} aria-pressed={!spent} onClick={() => {
          const next = new Set(uses.spent)
          if (next.has(index)) next.delete(index)
          else next.add(index)
          save({ innateSpellUses: { ...c.innateSpellUses, [uses.key]: [...next] } })
        }} />
    })}
  </span>
}

export function AnimalFeatureOptions({ c, entries, save }: SectionProps) {
  const active = activeAnimalFeatures(c, entries)
  const multiple = c.feats.some((feat) => feat.name === 'Persistent Animal Feature')
  return <fieldset className="col">
    <legend>Animal Feature: {multiple ? 'choose effects' : 'choose one'}</legend>
    {ANIMAL_FEATURES.map((feature) => {
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

export function CompanionSpellOptions({ c, entries, save, name, companionId, toggleOnly = false, hideToggle = false }: SectionProps & {
  name: 'Canopy Crawler' | 'Enlarge Companion'
  companionId?: string
  toggleOnly?: boolean
  hideToggle?: boolean
}) {
  const canopy = name === 'Canopy Crawler'
  const targetId = companionSpellTarget(c, canopy ? c.canopyCrawlerCompanionId : c.enlargeCompanionId)
  const companion = c.companions?.find((companion) => companion.id === companionId)
  const selectedCompanion = c.companions?.find((companion) => companion.id === (companionId ?? targetId))
  const naturalSize = !canopy && selectedCompanion ? companionStats(c, entries, selectedCompanion.type,
    selectedCompanion.id === c.companions?.[0]?.id ? companionAdvancement(c) : undefined, selectedCompanion.id)?.naturalSize : undefined
  const tooLarge = naturalSize === 'Huge' || naturalSize === 'Gargantuan'
  const needsHuge = naturalSize === 'Large'
  const enlargeUnavailable = !canopy && (tooLarge || needsHuge && c.level < 7)
  const active = companionId === undefined ? isSpellActive(c, entries, name)
    : canopy ? canopyCrawlerAffects(c, entries, companionId) : isSpellActive(c, entries, name) && companionId === targetId
  const target = canopyCrawlerTarget(c)
  return <div className="row">
    {!hideToggle && <label title={tooLarge ? 'Enlarge Companion has no effect on Huge or larger companions.'
      : needsHuge && c.level < 7 ? 'Requires rank 4 (character level 7) to enlarge a Large companion.' : undefined}>
      <input type="checkbox" aria-label={`${name}${companionId ? ` on ${companion?.name || companion?.type || companionId}` : ' active'}`}
      disabled={c.level < 3 || enlargeUnavailable || canopy && !!companionId && target === 'Self'} checked={active && !enlargeUnavailable} onChange={(e) => {
        if (c.level < 3 || enlargeUnavailable || canopy && !!companionId && target === 'Self') return
        save({
          ...spellActiveChange(c, name, e.target.checked),
          ...(canopy ? { canopyCrawlerCompanionId: companionId ?? targetId }
            : { enlargeCompanionId: companionId ?? targetId }),
        })
      }} /> {companionId ? name : 'Active'}</label>}
    {!toggleOnly && (c.companions?.length ?? 0) > 1 && (!canopy || target !== 'Self') && <label>Companion{' '}
      <select aria-label={`${name} companion`} value={targetId ?? ''} onChange={(e) => {
        if (c.companions?.some((companion) => companion.id === e.target.value))
          save(canopy ? { canopyCrawlerCompanionId: e.target.value } : { enlargeCompanionId: e.target.value })
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

function SpellItem({ name, entry, note, onRemove, active, onToggle, activeLabel, children, inlineControls, rankLabel, rank, saveDC }: {
  name: string; entry?: ContentEntry; note?: ReactNode; onRemove?: () => void
  active?: boolean; onToggle?: (active: boolean) => void
  activeLabel?: string
  children?: ReactNode
  inlineControls?: ReactNode
  rankLabel?: string
  rank: number
  saveDC?: number
}) {
  const metadata = spellMetadata(entry, rank)
  const inlineActive = INLINE_SPELL_BUFFS.includes(name)
  const activeToggle = onToggle && <label><input type="checkbox" aria-label={`${name} active`} checked={!!active}
    onChange={(e) => onToggle(e.target.checked)} /> {activeLabel ?? (name === 'Oaken Resilience' ? 'Active on you' : 'Active')}</label>
  return (
    <li className="innate-spell-row">
      <div className="innate-spell-name">
        <div className="spell-title"><EntryDescription name={name} entry={entry} />
          <SpellActions name={name} entry={entry} rank={rank} />{inlineControls}{inlineActive && activeToggle}</div>
        {rankLabel && <small className="spell-rank-label">{rankLabel}</small>}
        {note && <small>{note}</small>}
      </div>
      <span><small>Duration</small>{metadata.duration}</span>
      <span><small>Range</small>{metadata.range}</span>
      <span><small>Save</small>{spellSave(metadata.save, saveDC)}</span>
      <span><small>Area/Targets</small>{metadata.targets}</span>
      {!inlineActive && activeToggle}
      {(children || onRemove) && <div className="innate-spell-controls">
        {children}
        {onRemove && <button type="button" className="spell-remove" aria-label={`Remove ${name}`} title="Remove"
          onClick={() => confirmRemoval(`spell "${name}"`, onRemove)}>×</button>}
      </div>}
    </li>
  )
}

function spellMetadata(entry?: ContentEntry, rank = entry?.level ?? 0) {
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const current = entry?.data[key]
      if (current !== undefined && current !== null && String(current).trim())
        return String(current).replace(/^[a-z]/, initial => initial.toUpperCase())
    }
    return '—'
  }
  const name = entry?.name ?? ''
  const duration = value('duration_text', 'duration')
  const seconds = /^\d+$/.test(duration) ? Number(duration) : undefined
  const unit = seconds ? ([[86400, 'day'], [3600, 'hour'], [60, 'minute'], [6, 'round'], [1, 'second']] as const)
    .find(([size]) => seconds % size === 0) : undefined
  const range = value('range_text', 'range')
  const targets = value('area', 'targets', 'target')
  const save = value('saving_throw', 'save', 'saving_throw_dc')
  const tracks = name === 'Vanishing Tracks'
  const instant = [
    'Distracting Decoy', 'Heal Companion', 'Slime Spit', 'Snare Hopping',
    "Hunter's Luck", 'Soothing Mist', 'Threatening Mimicry', 'Mindlink',
  ].includes(name)
  if (tracks && rank >= 4) return { duration: '8 hours', range: '20 feet', save, targets: 'Up to 10 creatures' }
  return {
    duration: instant ? 'Instant' : tracks && rank >= 2 || name === 'Speak with Plants' && rank >= 4 ? '8 hours'
      : unit && seconds !== undefined ? `${seconds / unit[0]} ${unit[1]}${seconds / unit[0] === 1 ? '' : 's'}`
      : seconds === 0 ? '—' : duration,
    range: name === 'Pulverizing Wake' ? '15-foot cone'
      : ['Speak with Plants', 'Gravity Weapon', 'Keen Smell', 'Animal Feature', "Hunter's Luck"].includes(name)
      || tracks && range === '—' ? 'Self'
      : /^\d+$/.test(range) ? Number(range) === 0 ? 'Touch' : `${range} feet` : range.replace(/^touch$/i, 'Touch'),
    save: save === '—' ? /\b(?:basic )?(?:Fortitude|Reflex|Will)(?= (?:saving throws?|saves?))/i.exec(entry?.description ?? '')?.[0] ?? save : save,
    targets: name === 'Pulverizing Wake' ? '1 creature within reach'
      : ['Animal Feature', "Hunter's Luck", 'Speak with Plants'].includes(name)
      || targets === '—' && ['Sure Strike', 'True Strike', 'Vanishing Tracks'].includes(name) ? 'Self' : targets,
  }
}

function spellResolution(entry: ContentEntry) {
  const defense = spellMetadata(entry).save
  return {
    save: /\b(?:Fortitude|Reflex|Will)\b/i.test(defense)
      || /\b(?:Fortitude|Reflex|Will) (?:saving throws?|saves?)\b/i.test(entry.description),
    attack: entry.traits.some(trait => /^attack$/i.test(trait))
      || /\b(?:AC|Armor Class)\b/i.test(defense)
      || /\b(?:make|attempt) (?:a |an )?(?:ranged |melee )?spell attack\b/i.test(entry.description),
  }
}

function InnateSpellRow({ grant, note, active, onToggle, activeLabel, inlineControls, children, saveDC }: {
  grant: ReturnType<typeof grantedFeatSpells>[number]
  note?: ReactNode
  active?: boolean
  onToggle?: (value: boolean) => void
  activeLabel?: string
  inlineControls?: ReactNode
  children?: ReactNode
  saveDC?: number
}) {
  return <SpellItem name={grant.entry.name} entry={grant.entry} rank={grant.rank} note={note}
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

function spellSummaryData(c: Character, entries: ContentEntry[]) {
  const spells = c.spells ?? []
  const granted = grantedWardenSpells(c, entries)
  const featSpells = grantedFeatSpells(c, entries)
  const innate = featSpells.filter(grant => grant.rule.kind === 'innate')
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name) || a.source.localeCompare(b.source))
  const { spells: focus, points: focusPoints } = focusSpells(c, entries)
  const manualSpells = spells.filter((s) => !granted.some((g) => g.id === s.entryId || g.name === s.name)
    && !focus.some(grant => grant.name === s.name))
  return { spells, granted, featSpells, innate, focus, focusPoints, manualSpells }
}

export function SpellsSummary({ c, entries, data }: Pick<SectionProps, 'c' | 'entries'> & { data?: ReturnType<typeof spellSummaryData> }) {
  const { manualSpells, granted, focus, innate } = data ?? spellSummaryData(c, entries)
  const slots = classSpellSlots(c)
  const prepared = Object.entries(c.spellcasting?.prepared ?? {}).filter(([key, value]) => {
    const [rank, index] = key.split(':').map(Number)
    return value && Number.isInteger(index) && index >= 0 && index < (slots?.[rank] ?? 0)
  })
  const classSpells = slots ? new Set(prepared.map(([, value]) => value)).size : manualSpells.length
  return <summary className="character-section-summary">
    <strong>Spells</strong>
    <span>{classSpells + new Set([...granted.map(spell => spell.name), ...focus.map(spell => spell.name)]).size + innate.length} spells
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
  const [query, setQuery] = useState('')
  const [preparedSlot, setPreparedSlot] = useState<string>()
  const casting = classSpellcasting(c, entries)
  const automaticSlots = classSpellSlots(c)
  const druid = automaticSlots !== undefined
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
  const druidAvailable = useMemo(() => {
    const learned = new Set((c.spells ?? []).map(spell => spell.entryId ?? spell.name))
    return druidList?.filter(entry => isCommonSpell(entry) || learned.has(entry.id) || learned.has(entry.name))
  }, [druidList, c.spells])
  const { spells, granted, featSpells, innate, focus, focusPoints, manualSpells } = data ?? spellSummaryData(c, entries)
  const otherFocus = focus.filter(spell => !granted.some(warden => warden.name === spell.name))
  const grownOfOakSpell = featSpells.find(grant => grant.source === 'Grown of Oak' && grant.entry.name === 'Oaken Resilience')
  const unresolved = unresolvedFeatSpells(c, entries)
  const spellRank = Math.max(casting?.rank ?? 0, innate.length ? c.level >= 12 ? 2 : 1 : 0)
  const grantDetails = (grant: typeof featSpells[number]) => {
    const ability = grant.rule.kind === 'innate' ? innateSpellAbility(c, grant.rule.ability) : grant.rule.ability ?? casting?.ability
    const proficiency = grant.rule.kind === 'innate' ? spellRank : casting?.rank ?? 1
    const mod = ability ? abilityMod(c.abilities[ability]) + proficiencyBonus(Math.max(1, proficiency), c.level) : undefined
    const resolution = spellResolution(grant.entry)
    const frequency = dailyInnateUses(c, grant) ? undefined : grant.rule.frequency
    const higherDC = grant.rule.dc === 'higher-class-or-spell'
    const classDC = higherDC && resolution.save ? classDifficultyClass(c, entries) : undefined
    const castingAbility = casting?.ability ?? sc?.ability
    const spellDC = mod === undefined ? undefined : Math.max(10 + mod, casting && castingAbility
      ? 10 + abilityMod(c.abilities[castingAbility]) + proficiencyBonus(Math.max(1, spellRank), c.level) : 0)
    const dc = higherDC ? classDC === undefined || spellDC === undefined ? undefined : Math.max(classDC, spellDC)
      : mod === undefined ? undefined : 10 + mod
    const stats = resolution.attack && mod !== undefined ? `Attack ${signed(mod)}` : undefined
    const notes = grant.source === 'Empathetic Connection' && grant.entry.name === 'Mindlink' ? [] : [
      frequency && `${frequency}${grant.rule.shared ? ' shared between alternatives' : ''}`,
      grant.rule.condition && !(grant.source === 'Mask of Power' && grant.rule.condition === 'Must be wearing your warmask') && grant.rule.condition,
      stats && `${!higherDC && ability ? `${ABILITY_LABEL[ability]} ` : ''}${stats}`,
      higherDC && resolution.save && classDC === undefined
        ? <span role="status">Class DC unavailable: choose your class key attribute or sync class content.</span>
        : (resolution.save || resolution.attack) && mod === undefined
          && <span role="status">Check granting source for spellcasting attribute and DC.</span>,
    ].filter(Boolean)
    return { dc, note: notes.length ? <>{notes.map((note, index) => <span key={index}>{index > 0 && '; '}{note}</span>)}</> : undefined }
  }
  const buffProps = (name: string, entry?: ContentEntry) => {
    const duration = entry?.data.duration
    const timed = name === 'Untamed Form' || INLINE_SPELL_BUFFS.includes(name) || Number(duration) > 0
      || typeof duration === 'string' && /\b(?:round|minute|hour|day|sustain|unlimited)/i.test(duration)
    if (['Animal Feature', 'Untamed Shift', 'Canopy Crawler', 'Enlarge Companion', 'Shield', 'Invisibility',
      'Vanishing Tracks', 'Speak with Plants', "Ranger's Bramble", 'Ephemeral Tracking', "Hunter's Vision",
      'Gluttonous Growth', 'Pack Breaker'].includes(name) || name !== 'Magic Hide' && !timed) return {}
    return {
      active: name === 'Magic Hide' ? isMagicHideActive(c, entries) : c.activeSpells?.includes(name),
      activeLabel: name === 'Oaken Resilience' && grownOfOakSpell && activeFeatsNamed(c, 'Leshy Familiar').length
        ? 'Active on you and leshy familiar' : undefined,
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
    {name === 'Animal Feature' ? <AnimalFeatureOptions c={c} entries={entries} save={save} />
      : name === 'Canopy Crawler' || name === 'Enlarge Companion' ? <CompanionSpellOptions c={c} entries={entries} save={save} name={name} hideToggle /> : null}
    {name === 'Untamed Shift' && <fieldset className="col">
      <legend>Untamed Shift: choose up to {c.level >= 19 ? 3 : c.level >= 11 ? 2 : 1} effects</legend>
      {UNTAMED_SHIFT_CHOICES.map(choice => {
        const selected = activeUntamedShiftEffects(c, entries)
        const max = c.level >= 19 ? 3 : c.level >= 11 ? 2 : 1
        const unavailable = !activeFeatsNamed(c, choice.feat).length || !selected.includes(choice.name) && selected.length >= max
        return <label key={choice.name}><input type="checkbox" aria-label={`Untamed Shift: ${choice.name}`}
          checked={selected.includes(choice.name)} disabled={unavailable} onChange={event => {
            if (unavailable) return
            const effects = [...selected.filter(effect => effect !== choice.name), ...(event.target.checked ? [choice.name] : [])]
            save({ untamedShiftEffects: effects, ...spellActiveChange(c, 'Untamed Shift', effects.length > 0) })
          }} /> {choice.name}{!activeFeatsNamed(c, choice.feat).length && <small> (requires {choice.feat})</small>}</label>
      })}
      {activeUntamedShiftEffects(c, entries).includes('Plant') && <small>Reach 10 feet, or 15 feet with a reach weapon.</small>}
    </fieldset>}
    {name === 'Untamed Form' && <UntamedFormOptions c={c} entries={entries} save={save} />}
    {name === 'Oaken Resilience' && (grownOfOakSpell
      ? <small>Cast rank {grownOfOakSpell.rank} (Grown of Oak)</small>
      : <label>Cast rank{' '}
      <select aria-label="Oaken Resilience cast rank" value={c.oakenResilienceRank ?? ''} onChange={(event) => {
        const value = Number(event.target.value)
        save({ oakenResilienceRank: Number.isInteger(value) && value >= 2 && value <= 10 ? value : undefined })
      }}>
        <option value="">Choose cast rank</option>
        {Array.from({ length: 9 }, (_, i) => i + 2).map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      {!c.oakenResilienceRank && <small> Choose cast rank to apply resistance and weakness.</small>}
    </label>)}
    {!spellActionRolls(name, rank, entries.find(entry => entry.kind === 'spell' && entry.name === name)).length
      && <SpellDamageRolls name={name} rank={rank} />}
  </>
  const inlineControls = (name: string) => name === 'Shield'
    ? <label title="Raise the Shield cantrip for a +1 circumstance bonus to AC until your next turn.">
      <input type="checkbox" aria-label="Raise Shield Cantrip (+1 AC)" checked={isSpellActive(c, entries, 'Shield')}
        onChange={event => save(spellActiveChange(c, 'Shield', event.target.checked))} /> Raise Shield Cantrip (+1 AC)
    </label>
    : name === 'Canopy Crawler' || name === 'Enlarge Companion'
      ? <CompanionSpellOptions c={c} entries={entries} save={save} name={name} toggleOnly /> : undefined
  const setSc = (patch: Partial<NonNullable<Character['spellcasting']>>) => {
    if (!casting) return
    save({ spellcasting: { ability: 'int', tradition: traditions[0] ?? '', slots: {}, ...sc, ...patch, rank: casting.rank, ...(casting.ability ? { ability: casting.ability } : {}) } })
  }
  const selectedTradition = traditions.length === 1
    ? traditions[0]
    : traditions.includes(tradition) ? tradition : ''

  const matches = useMemo(() => {
    if (!selectedTradition) return []
    const q = query.trim().toLowerCase()
    if (druid && !q) return []
    return (druidList ?? spellIndex.spells)
      .filter((e) => druid || String(e.data.tradition ?? '').toLowerCase().includes(selectedTradition.toLowerCase()))
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.traits.some(trait => trait.toLowerCase().includes(q)))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .slice(0, 40)
  }, [spellIndex, selectedTradition, query, druid, druidList])

  const castAbility = casting?.ability ?? sc?.ability
  const mod = casting && castAbility ? abilityMod(c.abilities[castAbility]) + proficiencyBonus(casting.rank, c.level) : 0
  const classSpellDC = casting && castAbility ? 10 + mod : undefined
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
    return Array.from({ length: 11 }, (_, rank) => available
      .filter(spell => rank === 0 ? spell.cantrip : !spell.cantrip && spell.rank <= rank)
      .filter(spell => {
        const entry = spell.entryId ? spellIndex.byId.get(spell.entryId) : spellIndex.byName.get(spell.name)
        const traditions = String(entry?.data.tradition ?? '').toLowerCase().split(/,\s*/)
        return druid || !selectedTradition || !entry || traditions.includes(selectedTradition.toLowerCase())
      })
      .sort((a, b) => a.name.localeCompare(b.name) || (a.entryId ?? '').localeCompare(b.entryId ?? '')))
  }, [druidAvailable, c.spells, druid, selectedTradition, spellIndex])
  const classSlotRanks = Array.from({ length: 11 }, (_, rank) => ({
    rank,
    count: Math.max(0, Math.min(20, Math.trunc(Number(sc?.slots[rank]) || 0))),
  })).filter(item => item.count > 0)
  const allFocus = [...otherFocus.map(spell => ({ name: spell.name, entryId: undefined, index: -1 })),
    ...listedSpells.filter(spell => spell.group === 'Focus Spells')].sort((a, b) => a.name.localeCompare(b.name))
  const renderSpellGroup = (group: string) => <section className="innate-spell-group" key={group}>
    <h5>{group}</h5>
    <SpellColumns />
    <ul>{listedSpells.filter(spell => spell.group === group).map(spell => {
      const entry = spellEntry(spell.name, spell.entryId)
      const rank = Math.ceil(c.level / 2)
      return <SpellItem key={`${spell.name}-${spell.index}`} name={spell.name} entry={entry} rank={rank} saveDC={classSpellDC}
        inlineControls={inlineControls(spell.name)} {...buffProps(spell.name, entry)}
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
        {!casting.ability && <label>Casting ability{' '}
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
      {(sc || casting.ability) && (
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
      {sc && traditions.length > 0 && (
        <div className="row spell-slot-counts">
          <small>Spell slots:</small>
          {automaticSlots ? Object.entries(automaticSlots).map(([rank, count]) => <small key={rank}>
            {rank === '0' ? 'Cantrips' : `Rank ${rank}`}: {count}
          </small>) : Array.from({ length: 11 }, (_, rank) => (
            <label key={rank}>{rank === 0 ? 'Cantrips' : `Rank ${rank}`}{' '}
              <input type="number" min={0} max={20} style={{ width: '3.5em' }} value={sc.slots[rank] ?? 0}
                onChange={(e) => setSc({ slots: { ...sc.slots, [rank]: Math.max(0, Math.min(20, +e.target.value || 0)) } })} />
            </label>
          ))}
        </div>
      )}
      {druid && <small>Slots follow your Druid level and feats. Prepare common primal spells below;
        learn other primal spells only after gaining access. Order spells use Focus Points.</small>}
      {c.className === 'Druid' && !druid && <small role="status">
        Flexible Spellcaster preparation is not automated; your manual spell-slot settings are retained.
      </small>}
      {sc && traditions.length > 0 && classSlotRanks.length > 0 && <div className="class-spell-slots">
        <div className="row">
          <b>Class Spell Slots</b>
          {(sc.spentSlots?.length ?? 0) > 0 && <button type="button" aria-label="Reset class spell slots"
            title="Restore class spell slots during daily preparations."
            onClick={() => setSc({ spentSlots: [] })}>Reset slots</button>}
        </div>
        {classSlotRanks.map(({ rank, count }) => {
          const cantrip = rank === 0
          const title = cantrip ? `Cantrips (Heightened Level ${Math.ceil(c.level / 2)})` : `Spell Rank ${rank}`
          const options = preparedOptions[rank]
          return <section className="spell-slot-group" key={rank}>
            <h5>{title}</h5>
            <SpellColumns />
            <ul>{Array.from({ length: count }, (_, index) => {
              const slotKey = `${rank}:${index}`
              const selectedValue = sc.prepared?.[slotKey] ?? ''
              const selectedSpell = (c.spells ?? []).find(spell => (spell.entryId ?? spell.name) === selectedValue)
              const selectedEntry = selectedSpell ? spellEntry(selectedSpell.name, selectedSpell.entryId)
                : spellIndex.byId.get(selectedValue)
              const metadata = spellMetadata(selectedEntry, cantrip ? Math.ceil(c.level / 2) : rank)
              const spent = sc.spentSlots?.includes(slotKey) ?? false
              const selectedOption = options.find(spell => (spell.entryId ?? spell.name) === selectedValue
                || selectedSpell && !selectedSpell.entryId && spell.name === selectedSpell.name)
              const valid = !!selectedOption
              const showOptions = options.length <= 10 || preparedSlot === slotKey
              return <li className="spellbook-row" key={slotKey}>
                <div className="spellbook-slot">
                  {!cantrip && <button type="button" disabled={!valid || spent} aria-label={`Cast spell slot rank ${rank} slot ${index + 1}`}
                    onClick={() => {
                      if (!valid || spent) return
                      setSc({ spentSlots: [...new Set([...(sc.spentSlots ?? []), slotKey])] })
                    }}>Cast</button>}
                  <SearchableSelect aria-label={`${cantrip ? 'Cantrip' : `Spell Rank ${rank}`} slot ${index + 1}`}
                    value={selectedValue} optionCount={options.length} disabled={spent} onPrepare={() => setPreparedSlot(slotKey)}
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
                    {selectedValue && (!valid || !showOptions || (selectedOption?.entryId ?? selectedOption?.name) !== selectedValue)
                      && <option value={selectedValue} disabled={!valid}>{selectedSpell?.name ?? selectedEntry?.name ?? selectedValue}{!valid && ' (unavailable)'}</option>}
                    {showOptions && options.map(spell => <option key={spell.entryId ?? spell.name} value={spell.entryId ?? spell.name}>{spell.name}</option>)}
                  </SearchableSelect>
                  {selectedEntry && <EntryDescription name={selectedEntry.name} entry={selectedEntry}
                    buttonLabel="Details" className="picker-details" />}
                  {selectedEntry && <SpellActions name={selectedEntry.name} entry={selectedEntry} rank={cantrip ? Math.ceil(c.level / 2) : rank} />}
                </div>
                <span><small>Duration</small>{metadata.duration}</span>
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
      {c.feats.map((feat, index) => {
        if (!['First World Magic', 'Ancestral Magic', 'Ancestral Cantrip'].includes(feat.name) || featTakenLevel(feat) > c.level) return null
        if (feat.name === 'Ancestral Cantrip' && fixedAncestralCantrip(c, entries)) return null
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
        <ul>{minorMagicSpells(c, entries).map(entry => <SpellItem key={entry.name} name={entry.name} entry={entry} rank={Math.ceil(c.level / 2)}
          inlineControls={inlineControls(entry.name)} saveDC={10 + abilityMod(c.abilities[innateSpellAbility(c)]) + proficiencyBonus(1, c.level)}
          note={`Minor Magic; rank ${Math.ceil(c.level / 2)} ${c.minorMagic?.tradition}`} {...buffProps(entry.name, entry)}>
          {controls(entry.name)}
        </SpellItem>)}</ul>
      </div>}
      {(focusPoints > 0 || allFocus.length > 0) && (
        <div>
          <div className="focus-spells-heading"><b>Focus Spells</b><FocusPointTracker c={c} save={save} points={focusPoints} /></div>
          {allFocus.length > 0 && <section className="innate-spell-group">
            <h5>Focus {Math.ceil(c.level / 2)}</h5>
            <SpellColumns />
            <ul>
            {allFocus.map((s) => {
              const entry = spellEntry(s.name, s.entryId)
              const grant = featSpells.find(grant => grant.rule.kind === 'focus' && grant.entry.name === s.name)
              const details = grant ? grantDetails(grant) : undefined
              return <SpellItem key={s.name} entry={entry} name={s.name} rank={Math.ceil(c.level / 2)} inlineControls={inlineControls(s.name)}
                note={details?.note} saveDC={details ? details.dc : classSpellDC} {...buffProps(s.name, entry)}
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
            return <InnateSpellRow key={grant.usageKey} grant={grant} note={details.note} saveDC={details.dc}
              inlineControls={<>{inlineControls(grant.entry.name)}<InnateSpellUses c={c} save={save} grant={grant} /></>}
              {...buffProps(grant.entry.name, grant.entry)}>
              {controls(grant.entry.name, grant.rank)}
            </InnateSpellRow>
          })}</ul>
        </section>)}
      </div>}
      {unresolved.map((grant, index) => <p key={`${grant.source?.id}:${grant.name}:${index}`} className="feat-prerequisite-note" role="status">
        Spell data unavailable: {grant.name} (<EntryDescription name={grant.sourceName ?? grant.source?.name ?? 'Granting feat'} entry={grant.source} entries={entries} />).
        {' '}Review source rules; this spell is not automated.
      </p>)}
      {druid && groups.some(group => group !== 'Focus Spells') && <b>Learned spell access</b>}
      {groups.filter(group => group !== 'Focus Spells').map(renderSpellGroup)}
      <div className="row">
        {casting && traditions.length > 0 && !druid && <select aria-label="Filter spells by tradition" value={tradition} onChange={(e) => setTradition(e.target.value)}>
          <option value="">Any tradition</option>
          {traditions.map((t) => <option key={t}>{t}</option>)}
        </select>}
        {casting && traditions.length > 0 && <label>Search spells{' '}
          <input type="search" aria-label="Search spells" value={query} onChange={event => setQuery(event.target.value)} />
        </label>}
      </div>
      <ul>
        {matches.map((m) => {
          const cantrip = m.traits.some((t) => t.toLowerCase() === 'cantrip')
          const have = spells.some((s) => s.entryId === m.id) || granted.some((s) => s.id === m.id)
            || !!druidAvailable?.some(entry => entry.id === m.id)
          return (
            <li key={m.id}>
              <EntryDescription name={m.name} entry={m} /> <ActionIcon entry={m} showOther /> ({cantrip ? 'cantrip' : `rank ${m.level}`}) {spellWardenLabel(m.data.warden_spell_tier) && (
                <small>({spellWardenLabel(m.data.warden_spell_tier)})</small>
              )} {druid ? 'Primal' : m.data.tradition ?? ''}{' '}
              <button disabled={have} onClick={() => save({ spells: [...spells, { name: m.name, rank: m.level, cantrip, entryId: m.id }] })}>
                {have ? druid ? 'Available' : 'Added' : druid ? 'Learn' : 'Add'}
              </button>
            </li>
          )
        })}
      </ul>
      {query.trim() && selectedTradition && !matches.length && <small role="status">No matching spells.</small>}
      </div>
  )
}
