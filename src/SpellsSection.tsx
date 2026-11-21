import { EntryDescription } from './EntryDescription'
import { confirmRemoval } from './confirmRemoval'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ABILITIES, ABILITY_LABEL, abilityMod, activeAnimalFeatures, activeBattleForm, activeFeatsNamed, activeUntamedShiftEffects, boneShieldActive, boneShieldChange, canopyCrawlerAffects, canopyCrawlerTarget, championDevotionOptions, classSpellcasting, companionSpellTarget, focusSpells, isMagicHideActive, isSpellActive, magicHideChange, proficiencyBonus, signed, spellActiveChange, untamedShiftChoices, type SectionProps } from './builder'
import { ANIMAL_FEATURES, PERSISTENT_SPELLS } from './supplemental'
import type { Character, ContentEntry } from './types'
import { featTakenLevel, grantedWardenSpells, selectedFeatEntry, spellWardenLabel } from './featChoices'
import { ActionIcon } from './ActionIcon'
import { DamageRoll, SpellActions, SpellDamageRolls, spellActionRolls } from './SpellDamage'
import { intensifiedElementDamage } from './builder'
import { companionAdvancementFor, companionStats } from './companions'
import { dailyInnateUses, gnomeHeritageCantripOptions, gnomeHeritageTradition, grantedFeatSpells, mageAutomatonOptions, unresolvedFeatSpells, type limitedSpellUses } from './featSpells'
import { SearchableSelect } from './SearchableSelect'
import { featSpellOptions } from './featSpells'
import { MAGIC_TRADITIONS, minorMagicOptions, minorMagicSpells } from './minorMagic'
import { canChangeUntamedForm, untamedFormOptions, untamedFormRanks } from './builder'
import { classDifficultyClass, classExtraSlots, isSpontaneousClass, classRepertoireRows, classSpellSlots, conditionPenalty, druidSpellList, giantWeaponClumsy, innateSpellAbility, necromancerDirge, necromancerDirgeCanLearn, necromancerSpellList, spellDifficultyClass, type Ability } from './builder'
import { divineAttackDamage } from './divineIntercessions'
import { SourceNote } from './Info'
import { itemSpells, itemSpellUses, type ItemSpell } from './itemSpells'
import { DeferredDetails } from './DeferredDetails'
import { specificMagicItemName } from './equipmentGroups'
import { getSettings } from './settings'
import { witchwarperParadox, witchwarperRepertoireSlots, witchwarperSpellOptions } from './witchwarper'
import { spellAccessGranted } from './featAccess'
import { ANIMAL_FORMS, crocodileBattleForm, DINOSAUR_FORMS, INSECT_FORMS } from './battleForms'
import { familiarSpellBenefits } from './familiarAbilities'
import { PYRE_ENERGY_TYPES } from './hellknight'

const RANK_NAMES = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary']
const AUTOMATED_SPELL_EFFECTS = ['Athletic Rush', 'Cairn Form', 'Imitate Fauna', 'Keen Smell', 'Magic Hide', 'Mountain Resilience', 'Mystic Armor', 'Oaken Resilience', 'Stormwind Flight']

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
  const shapes = state?.form === 'Animal Form' ? ANIMAL_FORMS
    : state?.form === 'Dinosaur Form' ? DINOSAUR_FORMS : state?.form === 'Insect Form' ? INSECT_FORMS : undefined
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
    {state && shapes ? <label>Shape{' '}
      <select aria-label="Untamed Form shape" value={shapes.find(form => form.name.toLowerCase() === state.shape?.trim().toLowerCase())?.name ?? state.shape ?? ''} disabled={active && !canChange}
        onChange={event => {
          if (active && !canChange) return
          const shape = shapes.find(form => form.name === event.target.value)?.name
          save({ untamedForm: { ...state, shape } })
        }}>
        <option value="">Choose shape</option>
        {state.shape && !shapes.some(form => form.name.toLowerCase() === state.shape?.trim().toLowerCase())
          && <option value={state.shape} disabled>{state.shape} (unavailable)</option>}
        {shapes.map(form => <option key={form.name}>{form.name}</option>)}
      </select>
    </label> : <label>Shape{' '}
      <input aria-label="Untamed Form shape" value={state?.shape ?? ''} disabled={!state?.form || active && !canChange}
        onChange={event => {
          if (!state?.form || active && !canChange) return
          save({ untamedForm: { ...state, shape: event.target.value } })
        }} />
    </label>}
    {!!activeFeatsNamed(c, 'Dragon Shape').length && <label>Dragon Shape resistance{' '}
      <select aria-label="Dragon Shape resistance" value={c.dragonShapeResistance ?? ''} onChange={event => {
        const value = event.target.value
        if (value !== '' && value !== 'bludgeoning' && value !== 'poison') return
        save({ dragonShapeResistance: value || undefined })
      }}>
        <option value="">Choose resistance</option>
        <option value="bludgeoning">Bludgeoning</option><option value="poison">Poison</option>
      </select>
    </label>}
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
    <SourceNote source="Untamed Form" note={`${activeBattleForm(c, entries)?.source === 'Untamed Form'
      ? 'The chosen battle form replaces your character statistics where applicable.'
      : "Track the chosen battle form's other statistics separately; this does not replace your character statistics."}${canChange
      ? ' Each form change costs 1 action. Remaining spell duration does not reset.' : ''}`} />
  </fieldset>
}

export function FocusPointTracker({ c, save, points }: Pick<SectionProps, 'c' | 'save'> & { points: number }) {
  const capacity = Math.min(3, Math.max(0, points))
  if (!capacity) return null
  const spent = new Set((c.spentFocusPoints ?? []).filter(index => Number.isInteger(index) && index >= 0 && index < capacity))
  const damoritoshsClaw = c.systems.includes('sf2e') && c.ancestry === 'Vesk'
    && !!activeFeatsNamed(c, "Damoritosh's Claw").length
  const clawUsed = !!c.dailyFeatUses?.["Damoritosh's Claw"]
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
    {damoritoshsClaw && <button type="button" aria-label="Use Damoritosh's Claw" disabled={clawUsed || !spent.size}
      title="In combat, once per day, regain 1 Focus Point up to your usual maximum."
      onClick={() => {
        if (clawUsed || !spent.size) return
        save({ spentFocusPoints: [...spent].slice(1), dailyFeatUses: { ...c.dailyFeatUses, "Damoritosh's Claw": true } })
      }}>Damoritosh's Claw <ActionIcon actions="Single Action" /></button>}
  </span>
}

export function EnergizedFont({ c, save, points }: Pick<SectionProps, 'c' | 'save'> & { points: number }) {
  if (!activeFeatsNamed(c, 'Energized Font').length || points <= 0) return null
  const capacity = Math.min(3, points)
  const spent = [...new Set((c.spentFocusPoints ?? []).filter(index => Number.isInteger(index) && index >= 0 && index < capacity))]
  const used = !!c.dailyFeatUses?.['Energized Font']
  return <span>
    <button type="button" aria-label="Use Energized Font" disabled={used || !spent.length} onClick={() => {
      if (used || !spent.length) return
      save({ spentFocusPoints: spent.slice(1), focusPointsSpentSinceRefocus: c.focusPointsSpentSinceRefocus ?? spent.length,
        dailyFeatUses: { ...c.dailyFeatUses, 'Energized Font': true } })
    }}>Energized Font <ActionIcon actions="Single Action" /></button>
    <label><input type="checkbox" aria-label="Energized Font used" checked={used}
      onChange={event => save({ dailyFeatUses: { ...c.dailyFeatUses, 'Energized Font': event.target.checked } })} /> Used</label>
  </span>
}

export function FloralRestoration({ c, save, points }: Pick<SectionProps, 'c' | 'save'> & { points: number }) {
  if (!activeFeatsNamed(c, 'Floral Restoration').length) return null
  const capacity = Math.min(3, Math.max(0, points))
  const spent = (c.spentFocusPoints ?? []).find(index => Number.isInteger(index) && index >= 0 && index < capacity)
  const used = !!c.dailyFeatUses?.['Floral Restoration']
  return <span>
    <button type="button" aria-label="Use Floral Restoration" disabled={used}
      title="Requires a 15-foot by 15-foot area of healthy plant life not used for Floral Restoration in the past 24 hours."
      onClick={() => {
        if (used) return
        save({ ...(spent !== undefined ? {
          spentFocusPoints: (c.spentFocusPoints ?? []).filter(index => index !== spent),
          focusPointsSpentSinceRefocus: c.focusPointsSpentSinceRefocus ?? new Set((c.spentFocusPoints ?? [])
            .filter(index => Number.isInteger(index) && index >= 0 && index < capacity)).size,
        } : {}),
          dailyFeatUses: { ...c.dailyFeatUses, 'Floral Restoration': true } })
      }}>Floral Restoration <ActionIcon actions="Single Action" /></button>
    <DamageRoll name="Floral Restoration" damage={{ label: 'Healing', dice: 4 + Math.floor((c.level - 7) / 2), sides: 8, type: 'HP' }} />
    <label><input type="checkbox" aria-label="Floral Restoration used" checked={used}
      onChange={event => save({ dailyFeatUses: { ...c.dailyFeatUses, 'Floral Restoration': event.target.checked } })} /> Used</label>
  </span>
}

export function InnateSpellUses({ c, save, grant, additionalGrants = [] }: Pick<SectionProps, 'c' | 'save'> & {
  grant: ReturnType<typeof grantedFeatSpells>[number]
  additionalGrants?: ReturnType<typeof grantedFeatSpells>
}) {
  const uses = dailyInnateUses(c, grant)
  if (!uses) return null
  if (additionalGrants.length) {
    const pools = [grant, ...additionalGrants].flatMap(item => {
      const pool = dailyInnateUses(c, item)
      return pool ? [{ grant: item, uses: pool }] : []
    })
    const remaining = pools.reduce((sum, pool) => sum + pool.uses.remaining, 0)
    const limit = pools.reduce((sum, pool) => sum + pool.uses.limit, 0)
    return <span className="focus-tracker" role="group" aria-label={`${remaining} of ${limit} uses remaining`}>
      {pools.flatMap(pool => Array.from({ length: pool.uses.limit }, (_, index) => {
        const spent = pool.uses.spent.includes(index)
        const label = `${spent ? 'Restore' : 'Spend'} ${pool.grant.entry.name} (${pool.grant.source}) use ${index + 1}`
        return <button key={`${pool.uses.key}:${index}`} type="button" className="focus-point"
          aria-label={label} title={label} aria-pressed={!spent} onClick={() => {
            const next = new Set(pool.uses.spent)
            if (next.has(index)) next.delete(index)
            else next.add(index)
            save({ innateSpellUses: { ...c.innateSpellUses, [pool.uses.key]: [...next] } })
          }} />
      }))}
    </span>
  }
  return spellUseTracker(`${grant.entry.name} (${grant.source})`, uses,
    spent => save({ innateSpellUses: { ...c.innateSpellUses, [uses.key]: spent } }), grant.rule.shared)
}

function groupedInnateSpells(c: Character, grants: ReturnType<typeof grantedFeatSpells>) {
  const grouped: ReturnType<typeof grantedFeatSpells>[] = []
  for (const grant of grants) {
    const compatible = !grant.rule.shared && !grant.rule.condition && !!dailyInnateUses(c, grant)
    const match = compatible && grouped.find(group => {
      const first = group[0]
      return !first.rule.shared && !first.rule.condition && !!dailyInnateUses(c, first)
        && first.entry.name.toLowerCase() === grant.entry.name.toLowerCase()
        && first.rank === grant.rank && first.rule.tradition?.toLowerCase() === grant.rule.tradition?.toLowerCase()
        && first.rule.frequency?.toLowerCase() === grant.rule.frequency?.toLowerCase()
        && first.rule.ability === grant.rule.ability && first.rule.dc === grant.rule.dc
        && !group.some(existing => existing.usageKey === grant.usageKey)
    })
    if (match) match.push(grant)
    else grouped.push([grant])
  }
  return grouped
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

export function DinosaurFormOptions({ c, save, rank }: Pick<SectionProps, 'c' | 'save'> & { rank: number }) {
  const active = c.activeSpells?.includes('Dinosaur Form')
  return <fieldset className="col">
    <legend>Dinosaur Form</legend>
    <label>Form{' '}
      <select aria-label="Dinosaur Form battle form" value={active ? c.dinosaurForm?.form ?? '' : ''}
        onChange={event => {
          if (!DINOSAUR_FORMS.some(form => form.name === event.target.value) || rank < 4 || rank > 10 || !Number.isInteger(rank)) return
          save({ dinosaurForm: { form: event.target.value, rank }, ...spellActiveChange(c, 'Dinosaur Form', true) })
        }}>
        <option value="">Choose form</option>
        {DINOSAUR_FORMS.map(form => <option key={form.name}>{form.name}</option>)}
      </select>
    </label>
    <button type="button" disabled={!active} onClick={() => save({
      dinosaurForm: undefined, ...spellActiveChange(c, 'Dinosaur Form', false),
    })}>Dismiss Dinosaur Form</button>
  </fieldset>
}

export function CrocodileFormToggle({ c, entries, save }: SectionProps) {
  const active = isSpellActive(c, entries, 'Animal Form')
  return <label><input type="checkbox" aria-label="Crocodile Form active" checked={active}
    onChange={event => save(spellActiveChange(c, 'Animal Form', event.target.checked))} /> Active</label>
}

function CrocodileFormActions({ c, entries, save, rank }: SectionProps & { rank: number }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const dialogId = useId()
  const form = crocodileBattleForm(rank, c.level)
  return <>
    <button type="button" className="spell-action-button" aria-label="Crocodile Form options"
      aria-haspopup="dialog" aria-controls={dialogId} title="Two Actions; Crocodile Form options"
      onClick={() => { dialog.current?.showModal(); dialog.current?.querySelector('h4')?.focus() }}>
      <ActionIcon actions="Two Actions" />
    </button>
    <dialog ref={dialog} id={dialogId} className="entry-dialog" aria-labelledby={titleId}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <h4 id={titleId} tabIndex={-1}>Crocodile Form (Rank {rank})</h4>
      <CrocodileFormToggle c={c} entries={entries} save={save} />
      {form ? <>
        <p>{form.size} animal battle form for 1 minute. Speed {form.speed} feet; swim {form.swimSpeed} feet.
          Hold your breath for the transformation. Low-light vision and imprecise scent 30 feet.</p>
        <p>AC {form.ac}; temporary HP {form.temporaryHp}; attack {signed(form.attack)};
          damage bonus {signed(form.damageBonus)}; Athletics {signed(form.athletics)}.
          Ignore armor check and Speed penalties. Use your own unarmed attack or Athletics modifier if higher.
          Only the form's unarmed attacks can be used to Strike.</p>
        <p>{form.attacks.map(attack => `${attack.name.replace('Crocodile ', '')}: ${String(attack.data.damage)}${attack.traits.includes('Agile') ? ' (agile)' : ''}, reach ${attack.data.reach} feet`).join('; ')}.</p>
      </> : <p role="status">Crocodile Form is unavailable at this spell rank.</p>}
      <form method="dialog"><button autoFocus>Close</button></form>
    </dialog>
  </>
}

function SpellEffectActions({ c, entries, save, entry, name, rank = Math.ceil(c.level / 2) }: SectionProps & {
  entry?: ContentEntry
  name: 'Animal Feature' | 'Untamed Shift' | 'Untamed Form' | 'Dinosaur Form'
  rank?: number
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const dialogId = useId()
  const form = name === 'Untamed Form' || name === 'Dinosaur Form'
  const actions = form ? 'Two Actions' : typeof entry?.data.actions === 'string' && entry.data.actions.trim() ? entry.data.actions
    : name === 'Animal Feature' ? 'Single Action' : 'Single Action to Two Actions'
  const label = form ? name === 'Dinosaur Form' ? 'Choose Dinosaur Form' : 'Configure Untamed Form' : `Choose ${name} effects`
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
      <h4 id={titleId} tabIndex={-1}>{form ? `${name} options` : `${name} effects`} (Rank {name === 'Untamed Form' ? c.untamedForm?.rank ?? rank : rank})</h4>
      {name === 'Untamed Form' && <label><input type="checkbox" aria-label="Untamed Form active"
        checked={isSpellActive(c, entries, name)} onChange={event => save(spellActiveChange(c, name, event.target.checked))} /> Active</label>}
      {name === 'Dinosaur Form' ? <DinosaurFormOptions c={c} save={save} rank={rank} />
        : form ? <UntamedFormOptions c={c} entries={entries} save={save} />
        : name === 'Animal Feature' ? <AnimalFeatureOptions c={c} entries={entries} save={save} />
        : <UntamedShiftOptions c={c} entries={entries} save={save} />}
      <p>{entry?.description || 'Description unavailable. Sync Archives of Nethys content to load it.'}</p>
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
    companionAdvancementFor(c, (c.companions ?? []).findIndex(companion => companion.id === selectedCompanion.id)), selectedCompanion.id) : undefined
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

function ActiveSpellActions({ name, entry, rank, actions: actionOverride, children }: {
  name: string; entry?: ContentEntry; rank?: number; actions?: string; children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const actions = actionOverride ?? (typeof entry?.data.actions === 'string' ? entry.data.actions : '')
  return <>
    <button type="button" className="spell-action-button" aria-label={`${name} options`} aria-haspopup="dialog"
      onClick={() => { dialog.current?.showModal(); dialog.current?.querySelector('h4')?.focus() }}>
      {actions ? <ActionIcon actions={actions} showOther /> : 'Options'}
    </button>
    <dialog ref={dialog} className="entry-dialog" aria-labelledby={titleId}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <h4 id={titleId} tabIndex={-1}>{name}{rank === undefined ? '' : ` (Rank ${rank})`}</h4>
      {children}
      {name === 'Mountain Resilience' && rank !== undefined && rank >= 4 && <p>Resistance {Math.min(20, 5 * Math.floor((rank - 2) / 2))} to physical damage, except adamantine.</p>}
      <p>{entry?.description || 'Description unavailable. Sync Archives of Nethys content to load it.'}</p>
      <form method="dialog"><button autoFocus>Close</button></form>
    </dialog>
  </>
}

export function FalseVitalityActions({ c, save, entry, rank, actions, disabled }: Pick<SectionProps, 'c' | 'save'> & {
  entry?: ContentEntry; rank: number; actions?: string; disabled?: boolean
}) {
  const active = !!c.activeSpells?.includes('False Vitality')
  const valid = Number.isInteger(rank) && rank >= 2 && rank <= 10
  return <ActiveSpellActions name="False Vitality" entry={entry} rank={rank} actions={actions}>
    <label><input type="checkbox" aria-label="False Vitality active" checked={active}
      disabled={!active && (disabled || !valid)} onChange={event => {
        const next = event.target.checked
        if (next && (disabled || !valid)) return
        save({ ...spellActiveChange(c, 'False Vitality', next), falseVitalityRank: next ? rank : undefined })
      }} /> Active</label>
  </ActiveSpellActions>
}

export function BoneShieldActions({ c, save, entry, rank, actions, disabled }: Pick<SectionProps, 'c' | 'save'> & {
  entry?: ContentEntry; rank: number; actions?: string; disabled?: boolean
}) {
  const active = boneShieldActive(c)
  return <ActiveSpellActions name="Bone Shield" entry={entry} rank={rank} actions={actions}>
    <label><input type="checkbox" aria-label="Bone Shield active" checked={active}
      disabled={!active && disabled} onChange={event => save(boneShieldChange(c, event.target.checked))} /> Active</label>
  </ActiveSpellActions>
}

export function PyreResistEnergyActions({ c, save, entry, rank }: Pick<SectionProps, 'c' | 'save'> & {
  entry?: ContentEntry; rank: number
}) {
  const selected = c.pyreResistEnergy
  const baseResistance = rank >= 7 ? 15 : rank >= 4 ? 10 : 5
  return <ActiveSpellActions name="Resist Energy" entry={entry} rank={rank} actions="Two Actions">
    <label>Resistance{' '}
      <select aria-label="Resist Energy type" value={selected?.damage ?? ''} onChange={event => {
        const damage = PYRE_ENERGY_TYPES.find(type => type === event.target.value)
        save({ pyreResistEnergy: damage ? { damage, value: damage === 'fire' ? Math.max(c.level, baseResistance) : baseResistance } : undefined })
      }}>
        <option value="">None</option>
        {PYRE_ENERGY_TYPES.map(type => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
      </select>
    </label>
    {selected && <label>Amount{' '}
      <input type="number" min={selected.damage === 'fire' ? c.level : 1} step="1" aria-label="Resist Energy amount"
        aria-invalid={selected.damage === 'fire' && selected.value !== undefined && selected.value < c.level || undefined}
        value={selected.value ?? ''}
        onChange={event => {
          const value = Number(event.target.value)
          save({ pyreResistEnergy: { ...selected,
            value: event.target.value && Number.isSafeInteger(value) && value > 0 ? value : undefined } })
        }} />
      {selected.damage === 'fire' && selected.value !== undefined && selected.value < c.level
        && <span role="alert">Fire resistance must be at least {c.level}.</span>}
    </label>}
  </ActiveSpellActions>
}

export function DirgeLearnOptions({ options, onLearn }: { options: ContentEntry[]; onLearn: (entry: ContentEntry) => void }) {
  return <ul className="dirge-options">
    {options.map(entry => <li key={entry.id}>
      <button type="button" aria-label={`Learn ${entry.name}`} onClick={() => onLearn(entry)}>+</button>
      <EntryDescription name={entry.name} entry={entry} />
    </li>)}
  </ul>
}

function DirgeIcon() {
  return <svg className="dirge-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 6c-2-2-5-3-9-3v15c4 0 7 1 9 3 2-2 5-3 9-3V3c-4 0-7 1-9 3ZM12 6v15" />
  </svg>
}

function SignatureCast({ name, baseRank, slots, spent, onCast }: { name: string; baseRank: number
  slots: Record<number, number>; spent: string[]; onCast: (key: string) => void }) {
  const ranks = Object.keys(slots).map(Number).filter(value => value > 0 && value >= baseRank && slots[value] > 0)
  const [chosen, setChosen] = useState(baseRank)
  const rank = ranks.includes(chosen) ? chosen : ranks[0] ?? baseRank
  const free = Array.from({ length: slots[rank] ?? 0 }, (_, index) => `${rank}:${index}`).find(key => !spent.includes(key))
  return <>
    <button type="button" disabled={!free} aria-label={`Cast signature spell ${name} at rank ${rank}`}
      onClick={() => free && onCast(free)}>Cast</button>
    <select aria-label={`Cast rank for ${name}`} value={rank} onChange={event => setChosen(Number(event.target.value))}>
      {ranks.map(value => <option key={value} value={value}>Rank {value}</option>)}
    </select>
  </>
}

export function DirgeRankButton({ rank, onOpen }: { rank: number; onOpen: (rank: number) => void }) {
  const label = rank === 0 ? 'Open Dirge cantrips' : `Open Dirge rank ${rank}`
  return <button type="button" className="dirge-rank-button" aria-label={label} title={label}
    aria-haspopup="dialog" onClick={() => onOpen(rank)}><DirgeIcon /></button>
}

function SpellColumns() {
  return <div className="spellbook-columns" aria-hidden="true">
    <span>Spell</span><span>Duration</span><span>Range</span><span>Save</span><span>Area/Targets</span>
  </div>
}

function compareSelectedSpells(a: string, b: string) {
  return a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0
}

export function SelectedSlotSpell({ name, entry, onClear, disabled = false, source, heightened = 0 }: {
  name: string; entry?: ContentEntry; onClear?: () => void; disabled?: boolean; source?: string; heightened?: number
}) {
  return <span className="rune" title={source}>
    <EntryDescription name={name} entry={entry} buttonSuffix={heightened > 0 ? ` (+${heightened})` : undefined} />
    {onClear && <button type="button" aria-label={`Clear ${name} spell slot`} title="Clear spell slot"
      disabled={disabled} onClick={() => confirmRemoval(`spell "${name}"`, onClear)}>×</button>}
  </span>
}

function spellSave(save: string, dc?: number) {
  return dc !== undefined && /\b(?:Fortitude|Reflex|Will)\b/i.test(save) && !/\bDC\s+\d+/i.test(save) ? `${save} DC ${dc}` : save
}

function SpellItem({ c, name, entry, note, onRemove, active, onToggle, activeLabel, children, inlineControls, effectControls, effectRank, rank, saveDC, actionControls }: {
  c: Character
  name: string; entry?: ContentEntry; note?: ReactNode; onRemove?: () => void
  active?: boolean; onToggle?: (active: boolean) => void
  activeLabel?: string
  children?: ReactNode
  inlineControls?: ReactNode
  effectControls?: ReactNode
  effectRank?: number
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
          {onRemove && <button type="button" className="spell-remove" aria-label={`Remove ${name}`} title="Remove"
            onClick={() => confirmRemoval(`spell "${name}"`, onRemove)}>×</button>}
          {onToggle ? <ActiveSpellActions name={name} entry={entry} rank={name === 'Oaken Resilience' ? effectRank : effectRank ?? rank}>
            {activeToggle}{effectControls}
          </ActiveSpellActions> : actionControls ?? (!['Animal Feature', 'Untamed Shift', 'Untamed Form', 'Dinosaur Form',
            'Shield', 'Bone Shield', 'False Vitality', 'Canopy Crawler', 'Enlarge Companion', 'Apex Companion'].includes(name)
            && !(name === 'Animal Form' && activeFeatsNamed(c, 'Ancestral Form').length)
            && <SpellActions name={name} entry={entry} rank={rank} />)}{inlineControls}</div>
        {note && <small>{note}</small>}
      </div>
      <span><small>Duration</small>{metadata.duration}{metadata.durationNote
        && <SourceNote source="Persistent Animal Feature" note={metadata.durationNote} inlineSource={false} />}</span>
      <span><small>Range</small>{metadata.range}</span>
      <span><small>Save</small>{spellSave(metadata.save, saveDC)}</span>
      <span><small>Area/Targets</small>{metadata.targets}</span>
      {children && <div className="innate-spell-controls">
        {children}
      </div>}
    </li>
  )
}

// Heightened entries that raise a spell's range and duration, e.g. Beastmaster Trance
function heightenedRangeDuration(entry: ContentEntry | undefined, rank: number) {
  const result: { range?: string; duration?: string } = {}
  const capitalize = (text: string) => text.replace(/^[a-z]/, initial => initial.toUpperCase())
  const pattern = /Heightened \((\d+)(?:st|nd|rd|th)\)\s+(?:Increase the range to (.+?) and the duration (?:of|to) (.+?)|The duration (?:is|increases to) (.+?))\.(?=\s|$)/g
  for (const match of entry?.description.matchAll(pattern) ?? [])
    if (rank >= Number(match[1])) {
      if (match[2]) result.range = capitalize(match[2])
      result.duration = capitalize(match[3] ?? match[4])
    }
  return result.duration ? { ...(result.range ? { range: result.range } : {}), duration: result.duration } : undefined
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
      : entry && (seconds === 0 || duration === '—') ? 'Instant' : duration,
    durationNote: persistent && name === 'Animal Feature' && !getSettings().championFormNoFlight ? "Wings retain the spell's normal duration." : undefined,
    range: name === 'Pulverizing Wake' ? '15-foot cone'
      : name === 'Warning Stripes' ? 'Self or 30 feet'
      : ['Athletic Rush', 'Animal Form', 'Dinosaur Form', 'Enduring Might', 'Speak with Plants', 'Speak with Stones', 'Gravity Weapon', 'Keen Smell', 'Animal Feature', "Hunter's Luck", 'One with Stone', 'Seek the Stars', 'Seek The Stars'].includes(name)
      || tracks && range === '—' ? 'Self'
      : /^\d+$/.test(range) ? Number(range) === 0 ? 'Touch' : `${range} feet` : range.replace(/^touch$/i, 'Touch'),
    save: save === '—' ? /\b(?:basic )?(?:Fortitude|Reflex|Will)(?= (?:saving throws?|saves?))/i.exec(entry?.description ?? '')?.[0] ?? save : save,
    targets: name === 'Beastmaster Trance' && getSettings().singleAnimalCompanion ? 'Your animal companion'
      : name === 'Magic Passage' ? `5-foot-wide, 10-foot-tall, ${rank >= 7 ? 20 : 10}-foot-deep section of wooden, plaster, or stone wall`
      : name === 'Pummeling Rubble' ? '15-foot cone'
      : name === 'Pulverizing Wake' ? '1 creature within reach'
      : name === 'Warning Stripes' ? 'Yourself or your animal companion'
      : name === 'Canopy Crawler' && rank >= 5 ? 'Yourself and your animal companion'
      : name === 'Mask of Terror' && rank >= 8 ? 'Up to 5 creatures'
      : ['Athletic Rush', 'Animal Form', 'Dinosaur Form', 'Enduring Might', 'Animal Feature', 'Gravity Weapon', 'Keen Smell', "Hunter's Luck", 'Speak with Plants', 'Speak with Stones', 'One with Stone', 'Seek the Stars', 'Seek The Stars'].includes(name)
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

function InnateSpellRow({ c, grant, note, active, onToggle, activeLabel, inlineControls, effectControls, effectRank, actionControls, children, saveDC }: {
  c: Character
  grant: ReturnType<typeof grantedFeatSpells>[number]
  note?: ReactNode
  active?: boolean
  onToggle?: (value: boolean) => void
  activeLabel?: string
  inlineControls?: ReactNode
  effectControls?: ReactNode
  effectRank?: number
  actionControls?: ReactNode
  children?: ReactNode
  saveDC?: number
}) {
  return <SpellItem c={c} name={grant.entry.name} entry={grant.entry} rank={grant.rank} note={note}
    active={active} onToggle={onToggle} activeLabel={activeLabel} inlineControls={inlineControls} effectControls={effectControls} effectRank={effectRank} actionControls={actionControls} saveDC={saveDC}>
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
  const baseSlots = classSpellSlots(c)
  if (!paradox || !casting?.ability || !baseSlots) return null
  const benefits = familiarSpellBenefits(c, entries, baseSlots)
  const slots = { ...baseSlots }
  if (benefits.batteryRank !== undefined) slots[benefits.batteryRank] = (slots[benefits.batteryRank] ?? 0) + 1
  const sc = { ...c.spellcasting, ability: casting.ability, tradition: paradox.tradition, rank: casting.rank, slots: baseSlots }
  const setSc = (patch: Partial<NonNullable<Character['spellcasting']>>) => save({ spellcasting: { ...sc, ...patch } })
  const dc = spellDifficultyClass(c, entries)
  const selected = new Set<string>()
  const known = witchwarperRepertoireSlots(c, benefits.cantrip).map(slot => {
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
        <ul>{known.filter(slot => slot.rank === rank).map((slot, index) => ({ slot, index }))
          .sort((a, b) => compareSelectedSpells(a.slot.entry?.name ?? a.slot.granted ?? a.slot.value,
            b.slot.entry?.name ?? b.slot.granted ?? b.slot.value))
          .map(({ slot, index }) => {
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
                : slot.value ? <SelectedSlotSpell name={slot.entry?.name ?? slot.value} entry={slot.entry}
                  onClear={() => setSc({ repertoire: { ...sc.repertoire, [slot.key]: '' } })} />
                : <SearchableSelect aria-label={`Witchwarper ${rank === 0 ? 'cantrip' : `rank ${rank} spell`} ${index + 1}`}
                  value={value} alwaysSearchable primaryDetails renderDetails={choice => {
                    const entry = spellIndex.byId.get(choice) ?? spellIndex.byName.get(choice)
                    return entry && <span className="picker-spell-name"><EntryDescription name={entry.name} entry={entry} /></span>
                  }} onChange={event => {
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
              {slot.entry && (slot.entry.name === 'Bone Shield'
                ? <BoneShieldActions c={c} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : slot.entry.name === 'False Vitality'
                ? <FalseVitalityActions c={c} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : <SpellActions name={slot.entry.name} entry={slot.entry} rank={rank === 0 ? Math.ceil(c.level / 2) : castRank} />)}
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
  const special = featSpells.filter(grant => grant.rule.kind === 'feat')
  const innate = featSpells.filter(grant => grant.rule.kind === 'innate')
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name) || a.source.localeCompare(b.source))
  const { spells: focus, points: focusPoints } = focusSpells(c, entries)
  const manualSpells = spells.filter((s) => !granted.some((g) => g.id === s.entryId || g.name === s.name)
    && !focus.some(grant => grant.name === s.name))
  return { spells, granted, featSpells, innate, special, focus, focusPoints, manualSpells, items: itemSpells(c, entries) }
}

function characterRituals(c: Character, entries: ContentEntry[]) {
  const manualNames = c.rituals ?? []
  const grantedNames = new Set<string>()
  for (const feat of c.feats.filter(feat => featTakenLevel(feat) <= c.level)) {
    const source = selectedFeatEntry(c, entries, feat.name, feat.sourceId)
    for (const name of source?.ritualGrants ?? []) grantedNames.add(name.toLowerCase())
  }
  const ritualNames = [...new Map([...manualNames, ...grantedNames].map(name => [name.toLowerCase(), name])).values()]
    .sort((a, b) => a.localeCompare(b))
  return { manualNames, grantedNames, ritualNames }
}

function RitualsContent({ c, entries, save }: SectionProps) {
  const { manualNames, grantedNames, ritualNames } = characterRituals(c, entries)
  const rituals = entries.filter(entry => entry.kind === 'ritual' && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system))).sort((a, b) => a.name.localeCompare(b.name))
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
  const { manualSpells, granted, focus, innate, special, items } = data ?? spellSummaryData(c, entries)
  const baseSlots = classSpellSlots(c)
  const benefits = familiarSpellBenefits(c, entries, baseSlots ?? c.spellcasting?.slots ?? {})
  const witchwarper = witchwarperParadox(c)
  const slots = classRepertoireRows(c) ?? (classSpellcasting(c, entries)?.traditions.length ? c.spellcasting?.slots : undefined)
  const extraSlots = baseSlots ? classExtraSlots(c) : []
  const choices = witchwarper ? witchwarperRepertoireSlots(c, benefits.cantrip).map(slot => !!(slot.granted || slot.value))
    : slots ? Array.from({ length: 11 }, (_, rank) => {
      const baseCount = Math.max(0, Math.min(20, Math.trunc(Number(slots[rank]) || 0)))
      const extras = extraSlots.filter(slot => slot.rank === rank)
      const count = baseCount + Number(rank === 0 && benefits.cantrip) + Number(rank === benefits.batteryRank)
      const normalCount = baseCount - extras.length
      return Array.from({ length: count }, (_, index) => {
        const extra = extras[index - (count - extras.length)]
        const key = extra?.key ?? (index === normalCount && rank === 0 && benefits.cantrip
          ? 'familiar-cantrip-connection' : index === normalCount && rank === benefits.batteryRank
            ? `familiar-spell-battery:${rank}` : `${rank}:${index}`)
        return !!extra || !!c.spellcasting?.prepared?.[key]
      })
    }).flat() : []
  const otherSpells = new Set([...granted.map(spell => spell.name), ...focus.map(spell => spell.name)]).size
    + groupedInnateSpells(c, innate).length + special.length + items.length
  const selected = (slots || witchwarper ? choices.filter(Boolean).length : manualSpells.length) + otherSpells
  const total = choices.length + otherSpells
  return <summary className="character-section-summary">
    <strong>Spells</strong>
    <span>{choices.length && selected < total ? `${selected}/${total}` : selected} spells
      {c.className === 'Champion' && c.level >= 1 && !focus.some(spell => spell.source === 'Devotion Spells') && ' · Choose devotion spell'}</span>
  </summary>
}

type SpellData = ReturnType<typeof spellSummaryData>
export function spellCategoryAvailability(c: Character, entries: ContentEntry[], data: SpellData) {
  const { granted, focus, focusPoints, innate, special, items, manualSpells } = data
  const casting = classSpellcasting(c, entries)
  const focusOnlyClass = ['Champion', 'Monk', 'Ranger'].includes(c.className ?? '')
  const heritage = c.heritage?.toLowerCase() ?? ''
  const class_ = classSpellSlots(c) !== undefined || !!witchwarperParadox(c) || manualSpells.length > 0
    || !focusOnlyClass && (!!casting?.traditions.length
      || Object.values(c.spellcasting?.slots ?? {}).some(count => count > 0))
  const focusAvailable = focus.length > 0 || granted.length > 0 || focusPoints > 0
    || (c.className === 'Champion' && c.level >= 1) || !!activeFeatsNamed(c, 'Floral Restoration').length
  const innateAvailable = innate.length > 0 || c.heritage === 'Mage Automaton' && c.level >= 1
    || c.systems.includes('pf2e') && c.level >= 1 && ['fey-touched gnome', 'wellspring gnome'].includes(heritage)
    || !!activeFeatsNamed(c, 'Minor Magic').length || !!activeFeatsNamed(c, 'First World Magic').length
  return { class: class_, focus: focusAvailable, innate: innateAvailable, feat: special.length > 0, items: items.length > 0,
    rituals: characterRituals(c, entries).ritualNames.length > 0 }
}

export function SpellsPanel(props: SectionProps) {
  const data = useMemo(() => spellSummaryData(props.c, props.entries), [props.c, props.entries])
  const available = spellCategoryAvailability(props.c, props.entries, data)
  if (!Object.values(available).some(Boolean)) return null
  return <DeferredDetails>
    <SpellsSummary {...props} data={data} />
    <SpellsContent {...props} data={data} />
  </DeferredDetails>
}

export function SpellsSection(props: SectionProps) {
  const data = useMemo(() => spellSummaryData(props.c, props.entries), [props.c, props.entries])
  return <details className="character-section">
    <SpellsSummary {...props} data={data} />
    <SpellsContent {...props} data={data} />
  </details>
}

export function SpellsContent({ c, entries, save, data }: SectionProps & { data?: ReturnType<typeof spellSummaryData> }) {
  const [category, setCategory] = useState<'class' | 'focus' | 'innate' | 'feat' | 'items' | 'rituals'>('class')
  const [tradition, setTradition] = useState(c.spellcasting?.tradition ?? '')
  const [preparedSlot, setPreparedSlot] = useState<string>()
  const [dirgeOpen, setDirgeOpen] = useState(false)
  const [dirgeRank, setDirgeRank] = useState(0)
  const [dirgeQuery, setDirgeQuery] = useState('')
  const dirgeDialog = useRef<HTMLDialogElement>(null)
  const dirgeTitleId = useId()
  const casting = classSpellcasting(c, entries)
  const intensified = intensifiedElementDamage(c, entries)
  const automaticSlots = classSpellSlots(c)
  const witchwarper = witchwarperParadox(c)
  const druid = c.className === 'Druid' && automaticSlots !== undefined
  const necromancer = c.className === 'Necromancer'
  const preparedClass = druid || necromancer
  const bard = automaticSlots !== undefined && isSpontaneousClass(c)
  const extraSlots = automaticSlots ? classExtraSlots(c) : []
  const sc: Character['spellcasting'] = ['Druid', 'Necromancer'].includes(c.className ?? '') ? { ...c.spellcasting,
    ability: necromancer ? 'int' : 'wis', tradition: necromancer ? 'Occult' : 'Primal', rank: casting?.rank ?? 1,
    slots: automaticSlots ?? c.spellcasting?.slots ?? {} }
    : c.className === 'Bard' && automaticSlots ? { ability: 'cha', tradition: 'Occult', rank: casting?.rank ?? 1,
      ...c.spellcasting, slots: classRepertoireRows(c) ?? automaticSlots }
      : automaticSlots ? { ability: casting?.ability ?? 'int', tradition: casting?.traditions[0] ?? '',
        rank: casting?.rank ?? 1, ...c.spellcasting, slots: classRepertoireRows(c) ?? automaticSlots } : c.spellcasting
  const benefits = familiarSpellBenefits(c, entries, automaticSlots ?? sc?.slots ?? {})
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
  const dirge = useMemo(() => necromancer ? necromancerDirge(c, spellIndex.spells) : undefined,
    [necromancer, c, spellIndex])
  const dirgeOptions = useMemo(() => necromancer ? uniqueSpellNames(necromancerSpellList(c, spellIndex.spells)
    .filter(entry => spellAccessGranted(c, entry) && necromancerDirgeCanLearn(c, spellIndex.spells, entry))) : [],
    [necromancer, c, spellIndex, dirge])
  const rankedDirgeOptions = dirgeOptions.filter(entry => (dirgeRank === 0
    ? entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
    : entry.level === dirgeRank && !entry.traits.some(trait => trait.toLowerCase() === 'cantrip'))
    && entry.name.toLowerCase().includes(dirgeQuery.trim().toLowerCase()))
  const { spells, granted, featSpells, innate, special, focus, focusPoints, manualSpells, items } = data ?? spellSummaryData(c, entries)
  const available = spellCategoryAvailability(c, entries, data ?? spellSummaryData(c, entries))
  const otherFocus = focus.filter(spell => !granted.some(warden => warden.name === spell.name))
  const grownOfOakSpell = featSpells.find(grant => grant.source === 'Grown of Oak' && grant.entry.name === 'Oaken Resilience')
  const unresolved = unresolvedFeatSpells(c, entries)
  const spellRank = Math.max(casting?.rank ?? 0, innate.length ? c.level >= 12 ? 2 : 1 : 0)
  const spellPenalty = (ability: Ability) => Math.max(conditionPenalty(c, ability), ability === 'dex' ? giantWeaponClumsy(c, entries) : 0)
  const grantDetails = (grant: typeof featSpells[number]) => {
    const ability = grant.rule.kind === 'innate' ? innateSpellAbility(c, grant.rule.ability) : grant.rule.ability ?? casting?.ability
    const proficiency = grant.rule.kind === 'innate' ? spellRank : casting?.rank ?? 1
    const mod = ability ? abilityMod(c.abilities[ability]) + proficiencyBonus(Math.max(1, proficiency), c.level) - spellPenalty(ability) : undefined
    const resolution = spellResolution(grant.entry)
    const frequency = /^at[- ]will$/i.test(grant.rule.frequency?.trim() ?? '')
      || dailyInnateUses(c, grant) && /\bper day(?: each)?$/i.test(grant.rule.frequency ?? '') ? undefined : grant.rule.frequency
    const higherDC = grant.rule.dc === 'higher-class-or-spell'
    const classDC = higherDC && resolution.save ? classDifficultyClass(c, entries) : undefined
    const castingAbility = casting?.ability ?? sc?.ability
    const spellDC = mod === undefined ? undefined : Math.max(10 + mod, casting && castingAbility
      ? 10 + abilityMod(c.abilities[castingAbility]) + proficiencyBonus(Math.max(1, spellRank), c.level) - spellPenalty(castingAbility) : 0)
    const dc = higherDC ? classDC === undefined || spellDC === undefined ? undefined : Math.max(classDC, spellDC)
      : mod === undefined ? undefined : 10 + mod
    const stats = resolution.attack && mod !== undefined ? `Attack ${signed(mod)}` : undefined
    const notes = grant.source === 'Empathetic Connection' && grant.entry.name === 'Mindlink'
      || grant.source === 'Grown of Oak' && grant.entry.name === 'Oaken Resilience' ? [] : [
      frequency && `${frequency}${grant.rule.shared ? ' shared between alternatives' : ''}`,
      grant.rule.condition && !(grant.source === 'Mask of Power' && grant.rule.condition === 'Must be wearing your warmask')
        && !(['Ancestral Form', 'Bone Investiture', 'Fossil Rider'].includes(grant.source)
          && /^Must target yourself(?:; crocodile form only)?$/.test(grant.rule.condition))
        && grant.rule.condition !== 'Only within your claimed territory'
        && grant.rule.condition !== 'Only through barriers of earth or stone'
        && !(grant.entry.name === 'Resist Energy' && ['Order Training', 'Order Cross-Training'].includes(grant.source)
          && /^Self only\. Fire resistance is at least \d+\.$/.test(grant.rule.condition))
        && !(['Order Training', 'Order Cross-Training'].includes(grant.source) && grant.rule.kind === 'focus'
          && /^Casting this domain spell grants \d+ temporary HP for 1 round\.$/.test(grant.rule.condition))
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
    {!spellActionRolls(name, rank, entries.find(entry => entry.kind === 'spell' && entry.name === name)).length
      && <SpellDamageRolls name={name} rank={rank} />}
  </>
  const effectControls = (name: string) => name === 'Oaken Resilience' && (grownOfOakSpell
      ? <small>Cast rank {grownOfOakSpell.rank}</small>
      : <label>Cast rank{' '}
      <select aria-label="Oaken Resilience cast rank" value={c.oakenResilienceRank ?? ''} onChange={(event) => {
        const value = Number(event.target.value)
        save({ oakenResilienceRank: Number.isInteger(value) && value >= 2 && value <= 10 ? value : undefined })
      }}>
        <option value="">Choose cast rank</option>
        {Array.from({ length: 9 }, (_, i) => i + 2).map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>)
  const activeRank = (name: string) => name === 'Oaken Resilience' ? grownOfOakSpell?.rank ?? c.oakenResilienceRank
    : name === 'Mountain Resilience' || name === 'Cairn Form'
      ? featSpells.find(grant => grant.entry.name === name)?.rank ?? Math.ceil(c.level / 2) : undefined
  const inlineControls = (name: string, rank = Math.ceil(c.level / 2)) => name === 'Animal Feature' || name === 'Untamed Shift' || name === 'Untamed Form' || name === 'Dinosaur Form'
    ? <SpellEffectActions c={c} entries={entries} save={save} entry={spellEntry(name)} name={name} rank={rank} />
    : name === 'Animal Form' && activeFeatsNamed(c, 'Ancestral Form').length
    ? <CrocodileFormActions c={c} entries={entries} save={save} rank={rank} />
    : name === 'False Vitality'
    ? <FalseVitalityActions c={c} save={save} entry={spellEntry(name)} rank={rank} />
    : name === 'Bone Shield'
    ? <BoneShieldActions c={c} save={save} entry={spellEntry(name)} rank={rank} />
    : name === 'Shield'
    ? <ActiveSpellActions name={name} entry={spellEntry(name)} rank={rank}><label title="Raise the Shield cantrip for a +1 circumstance bonus to AC until your next turn.">
      <input type="checkbox" aria-label="Raise Shield Cantrip (+1 AC)" checked={isSpellActive(c, entries, 'Shield')}
        disabled={boneShieldActive(c) && !isSpellActive(c, entries, 'Shield')}
        onChange={event => save(spellActiveChange(c, 'Shield', event.target.checked))} /> Raise Shield Cantrip (+1 AC)
    </label></ActiveSpellActions>
    : name === 'Canopy Crawler' || name === 'Enlarge Companion' || name === 'Apex Companion'
      ? <ActiveSpellActions name={name} entry={spellEntry(name)} rank={rank}>
        <CompanionSpellOptions c={c} entries={entries} save={save} name={name} />
      </ActiveSpellActions> : undefined
  const setSc = (patch: Partial<NonNullable<Character['spellcasting']>>) => {
    if (!casting) return
    save({ spellcasting: { ability: 'int', tradition: traditions[0] ?? '', slots: {}, ...sc, ...patch, rank: casting.rank, ...(casting.ability ? { ability: casting.ability } : {}) } })
  }
  const selectedTradition = traditions.length === 1
    ? traditions[0]
    : traditions.includes(tradition) ? tradition : ''

  const castAbility = casting?.ability ?? sc?.ability
  const mod = casting && castAbility ? abilityMod(c.abilities[castAbility]) + proficiencyBonus(casting.rank, c.level) - spellPenalty(castAbility) : 0
  const classSpellDC = spellDifficultyClass(c, entries)
  const ownsFeat = (name: string) => c.feats.some(feat => feat.name === name && featTakenLevel(feat) <= c.level)
  const beastmasterCasting = ownsFeat('Beastmaster Dedication')
    ? ownsFeat('Master Beastmaster Spellcasting') ? 3 : ownsFeat('Expert Beastmaster Spellcasting') ? 2 : 1 : 0
  const groupLabel = (name: string, entryId: string | undefined, rank: number, cantrip: boolean) => {
    const entry = spellEntry(name, entryId)
    return spellWardenLabel(entry?.data.warden_spell_tier) || entry?.traits.some(trait => trait.toLowerCase() === 'focus')
      ? 'Focus Spells' : cantrip ? 'Cantrips' : `Rank ${rank}`
  }
  const listedSpellCandidates = [
    ...granted.map((s) => ({ name: s.name, entryId: s.id, group: 'Focus Spells', index: -1 })),
    ...dirge?.filter(entry => !c.spells?.some(spell => spell.name === entry.name))
      .map(entry => ({ name: entry.name, entryId: entry.id,
        group: groupLabel(entry.name, entry.id, entry.level, entry.traits.some(trait => trait.toLowerCase() === 'cantrip')), index: -1 })) ?? [],
    ...spells.flatMap((s, index) => manualSpells.includes(s)
      && (!druid || !isCommonSpell(spellEntry(s.name, s.entryId)))
      ? [{ name: s.name, entryId: s.entryId, group: groupLabel(s.name, s.entryId, s.rank, s.cantrip), index }] : []),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const seenDirgeNames = new Set<string>()
  const listedSpells = listedSpellCandidates.filter(spell => {
    if (!necromancer || spell.group === 'Focus Spells') return true
    const key = spell.name.toLowerCase()
    if (seenDirgeNames.has(key)) return false
    seenDirgeNames.add(key)
    return true
  })
  const groupOrder = ['Focus Spells', 'Cantrips', ...Array.from({ length: 10 }, (_, i) => `Rank ${i + 1}`)]
  const groups = [...new Set(listedSpells.map((s) => s.group))]
    .sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b))
  const innateGroups: { key: string; tradition: string; rank: number; grants: (typeof innate)[] }[] = []
  for (const grants of groupedInnateSpells(c, innate)) {
    const grant = grants[0]
    const tradition = grant.rule.tradition ? grant.rule.tradition[0].toUpperCase() + grant.rule.tradition.slice(1) : 'Innate'
    const key = `${tradition}:${grant.rank}`
    let group = innateGroups.find(item => item.key === key)
    if (!group) {
      group = { key, tradition, rank: grant.rank, grants: [] }
      innateGroups.push(group)
    }
    group.grants.push(grants)
  }
  innateGroups.sort((a, b) => a.tradition.localeCompare(b.tradition) || a.rank - b.rank)
  const preparedOptions = useMemo(() => {
    const forced = bard ? extraSlots.flatMap(extra => {
      const entry = spellIndex.byName.get(extra.spell)
      return entry ? [{ name: entry.name, entryId: entry.id, rank: entry.level, cantrip: false, forced: true }] : []
    }) : []
    const available = [...((druidAvailable ?? dirge)?.map(entry => ({ name: entry.name, entryId: entry.id,
      rank: entry.level, cantrip: entry.traits.some(trait => trait.toLowerCase() === 'cantrip'), forced: false })) ?? (c.spells ?? [])
      .filter(spell => !forced.some(extra => extra.name === spell.name)).map(spell => ({ ...spell, forced: false }))), ...forced]
      .map(spell => {
        const entry = spell.entryId ? spellIndex.byId.get(spell.entryId) : spellIndex.byName.get(spell.name)
        const baseRank = entry && Number.isInteger(entry.level) && entry.level >= 1 && entry.level <= 10
          ? entry.level : spell.rank
        return { ...spell, baseRank }
      })
    return Array.from({ length: 11 }, (_, rank) => {
      const options = available
      .filter(spell => rank === 0 ? spell.cantrip : !spell.cantrip && (bard ? spell.baseRank === rank : spell.rank <= rank))
      .filter(spell => {
        const entry = spell.entryId ? spellIndex.byId.get(spell.entryId) : spellIndex.byName.get(spell.name)
        const traditions = String(entry?.data.tradition ?? '').toLowerCase().split(/,\s*/)
        return preparedClass || spell.forced || !selectedTradition || !entry || traditions.includes(selectedTradition.toLowerCase())
      })
      .sort((a, b) => (rank === 0 ? 0 : b.baseRank - a.baseRank)
        || a.name.localeCompare(b.name) || (a.entryId ?? '').localeCompare(b.entryId ?? ''))
      return { options, choices: preparedClass ? uniqueSpellNames(options) : options }
    })
  }, [druidAvailable, dirge, c.spells, preparedClass, selectedTradition, spellIndex, bard, c.feats, c.level])
  const classSlotRanks = Array.from({ length: 11 }, (_, rank) => ({
    rank,
    count: Math.max(0, Math.min(20, Math.trunc(Number(sc?.slots[rank]) || 0)))
      + Number(rank === 0 && benefits.cantrip) + Number(rank === benefits.batteryRank),
  })).filter(item => item.count > 0)
  const allFocus = [...otherFocus.map(spell => ({ name: spell.name, entryId: undefined, index: -1 })),
    ...listedSpells.filter(spell => spell.group === 'Focus Spells')].sort((a, b) => a.name.localeCompare(b.name))
  const categories = ([['class', 'Class Spells'], ['focus', 'Focus Spells'], ['innate', 'Innate Spells'], ['feat', 'Feat Spells'],
    ['items', 'Item Spells'], ['rituals', 'Rituals']] as const)
    .filter(([value]) => value === 'focus' ? available.focus || allFocus.length > 0 : available[value])
  const activeCategory = categories.some(([value]) => value === category) ? category : categories[0]?.[0]
  const renderSpellGroup = (group: string) => <section className="innate-spell-group" key={group}>
    <h5>{group}</h5>
    <SpellColumns />
    <ul>{listedSpells.filter(spell => spell.group === group).map(spell => {
      const entry = spellEntry(spell.name, spell.entryId)
      const rank = spell.name === 'False Vitality' ? Number(spell.group.replace('Rank ', ''))
        : necromancer && !entry?.traits.some(trait => trait.toLowerCase() === 'cantrip')
        ? entry?.level ?? 1 : Math.ceil(c.level / 2)
      return <SpellItem c={c} key={`${spell.name}-${spell.index}`} name={spell.name} entry={entry} rank={rank} saveDC={classSpellDC}
        inlineControls={inlineControls(spell.name, rank)} effectControls={effectControls(spell.name)}
        effectRank={activeRank(spell.name)} {...buffProps(spell.name)}
        onRemove={spell.index >= 0 ? () => save({ spells: spells.filter((saved, index) => necromancer
          ? saved.name.toLowerCase() !== spell.name.toLowerCase() : index !== spell.index),
          activeSpells: c.activeSpells?.filter(name => name !== spell.name) }) : undefined}>
        {controls(spell.name, rank)}
      </SpellItem>
    })}</ul>
  </section>
  const spellcastingSummary = casting && (c.className === 'Witchwarper' ? casting.ability : sc || casting.ability) && (
    <div className="skill-row with-item spell-dc-row">
      <span className="skill-name">{selectedTradition && `${selectedTradition} `}DC {10 + mod} <small>(Attack {signed(mod)})</small></span>
      <span className="rank-dots" role="img" aria-label={`Spellcasting proficiency: ${RANK_NAMES[casting.rank]}`} title={RANK_NAMES[casting.rank]}>
        {['T', 'E', 'M', 'L'].map((letter, i) => <button key={letter} type="button" tabIndex={-1} disabled className={casting.rank >= i + 1 ? 'on' : ''}>{letter}</button>)}
      </span>
      <span className="skill-part"><small>{castAbility ? ABILITY_LABEL[castAbility] : ''}</small>{signed(castAbility ? abilityMod(c.abilities[castAbility]) : 0)}</span>
      <span className="skill-part"><small>Prof</small>{signed(proficiencyBonus(casting.rank, c.level))}</span>
      <span className="skill-part"><small>Item</small>{signed(0)}</span>
      {castAbility && spellPenalty(castAbility) > 0 && <span className="skill-part"><small>Status</small>{signed(-spellPenalty(castAbility))}</span>}
    </div>
  )
  const openDirge = (rank: number) => {
    setDirgeRank(rank)
    setDirgeQuery('')
    setDirgeOpen(true)
    dirgeDialog.current?.showModal()
    dirgeDialog.current?.querySelector('h4')?.focus()
  }

  return (
      <div className="character-section-content">
      {intensified && <span><DamageRoll name="Intensified Element Stance"
        damage={{ label: 'Conditional spell damage', dice: intensified.dice, sides: 6, type: intensified.type }} />
        <SourceNote source="Intensified Element Stance" note={`Additional damage for damaging spells against ${intensified.targets}.`} />
      </span>}
      <div className="gear-tabs spell-category-tabs" role="group" aria-label="Spell categories">
        {categories.map(([value, label]) =>
          <button key={value} type="button" className={activeCategory === value ? 'on' : ''}
            aria-pressed={activeCategory === value} onClick={() => setCategory(value)}>{label}</button>)}
      </div>
      <div hidden={activeCategory !== 'feat'}>
        {[...new Set(special.map(grant => grant.source))].map(source => <section className="innate-spell-group" key={source}>
          <h5>{source} · Spell Rank {special.find(grant => grant.source === source)?.rank}</h5>
          <SpellColumns />
          <ul>{special.filter(grant => grant.source === source).map(grant => {
            const details = grant.source === 'Natural Illusionist'
              ? { note: grant.rule.condition, dc: undefined } : grantDetails(grant)
            return <SpellItem c={c} key={`${grant.usageKey}:${grant.entry.name}`} name={grant.entry.name}
              entry={grant.entry} rank={grant.rank} note={details.note} saveDC={details.dc}
              inlineControls={<>{inlineControls(grant.entry.name, grant.rank)}<InnateSpellUses c={c} save={save} grant={grant} /></>}
              effectControls={effectControls(grant.entry.name)} effectRank={activeRank(grant.entry.name)} {...buffProps(grant.entry.name)}>
              {controls(grant.entry.name, grant.rank)}
            </SpellItem>
          })}</ul>
        </section>)}
      </div>
      <div hidden={activeCategory !== 'class'}>
      {necromancer && c.level >= 1 && <>
        <dialog ref={dirgeDialog} className="entry-dialog dirge-dialog" aria-labelledby={dirgeTitleId}
          onClose={event => { if (event.target === event.currentTarget) setDirgeOpen(false) }}
          onClick={event => { if (event.target === event.currentTarget) dirgeDialog.current?.close() }}>
          <h4 id={dirgeTitleId} tabIndex={-1}>Dirge</h4>
          <div className="gear-tabs spell-category-tabs" role="group" aria-label="Dirge spell ranks">
            {Array.from({ length: 11 }, (_, rank) => <button key={rank} type="button"
              aria-label={rank === 0 ? 'Cantrips' : `Rank ${rank}`} aria-pressed={dirgeRank === rank}
              className={dirgeRank === rank ? 'on' : ''} onClick={() => setDirgeRank(rank)}>{rank}</button>)}
          </div>
          {groups.filter(group => group !== 'Focus Spells').map(group =>
            <div className="dirge-rank" key={group} hidden={group !== (dirgeRank === 0 ? 'Cantrips' : `Rank ${dirgeRank}`)}>{renderSpellGroup(group)}</div>)}
          <label>Search spells{' '}<input type="search" aria-label="Search dirge spells" value={dirgeQuery}
            onChange={event => setDirgeQuery(event.target.value)} /></label>
          {dirgeOpen && <DirgeLearnOptions options={rankedDirgeOptions} onLearn={entry => {
            if (!rankedDirgeOptions.some(option => option.id === entry.id)) return
            save({ spells: [...(c.spells ?? []), { name: entry.name, entryId: entry.id, rank: entry.level,
              cantrip: entry.traits.some(trait => trait.toLowerCase() === 'cantrip') }] })
          }} />}
          <form method="dialog"><button autoFocus>Close</button></form>
        </dialog>
      </>}
      {casting && <>
      {(!casting.ability && c.className !== 'Witchwarper' || traditions.length > 1) && <div className="row">
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
      </div>}
      {spellcastingSummary}
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
      {['Druid', 'Necromancer'].includes(c.className ?? '') && !automaticSlots && <small role="status">
        Flexible Spellcaster preparation is not automated; your manual spell-slot settings are retained.
      </small>}
      {witchwarper && <WitchwarperRepertoire c={c} entries={entries} save={save} />}
      {!witchwarper && sc && traditions.length > 0 && classSlotRanks.length > 0 && <div className="class-spell-slots">
        {(sc.spentSlots?.length ?? 0) > 0 && <div className="row">
          <button type="button" aria-label="Reset class spell slots"
            title="Restore class spell slots during daily preparations."
            onClick={() => setSc({ spentSlots: [] })}>Reset slots</button>
        </div>}
        {classSlotRanks.map(({ rank, count }) => {
          const cantrip = rank === 0
          const title = cantrip ? `Cantrips (Heightened Level ${Math.ceil(c.level / 2)})` : `Spell Rank ${rank}`
          const { options, choices } = preparedOptions[rank]
          const extras = extraSlots.filter(slot => slot.rank === rank)
          return <section className="spell-slot-group" key={rank}>
            <h5>{title}{necromancer && <> <DirgeRankButton rank={rank} onOpen={openDirge} /></>}</h5>
            <SpellColumns />
            <ul>{Array.from({ length: count }, (_, index) => {
              const extra = extras[index - (count - extras.length)]
              const normalCount = Math.max(0, Math.min(20, Math.trunc(Number(sc.slots[rank]) || 0)))
                - extras.length
              const slotKey = extra?.key ?? (index === normalCount && cantrip && benefits.cantrip
                ? 'familiar-cantrip-connection' : index === normalCount && rank === benefits.batteryRank
                  ? `familiar-spell-battery:${rank}` : `${rank}:${index}`)
              const selectedValue = extra ? spellIndex.byName.get(extra.spell)?.id ?? extra.spell
                : sc.prepared?.[slotKey] ?? ''
              const selectedSpell = (c.spells ?? []).find(spell => (spell.entryId ?? spell.name) === selectedValue)
              const selectedEntry = selectedSpell ? spellEntry(selectedSpell.name, selectedSpell.entryId)
                : spellIndex.byId.get(selectedValue) ?? spellIndex.byName.get(selectedValue)
              return { index, extra, slotKey, selectedValue, selectedSpell, selectedEntry }
            }).sort((a, b) => compareSelectedSpells(a.selectedSpell?.name ?? a.selectedEntry?.name ?? a.selectedValue,
              b.selectedSpell?.name ?? b.selectedEntry?.name ?? b.selectedValue))
              .map(({ index, extra, slotKey, selectedValue, selectedSpell, selectedEntry }) => {
              const restricted = !!extra
              const metadata = spellMetadata(selectedEntry, cantrip ? Math.ceil(c.level / 2) : rank, c)
              const spent = sc.spentSlots?.includes(slotKey) ?? false
              const exhausted = bard && !spent && !!automaticSlots && (sc.spentSlots ?? [])
                .filter(key => /^\d+:\d+$/.test(key) ? key.startsWith(`${rank}:`) : extras.some(slot => slot.key === key)).length
                >= (automaticSlots[rank] ?? 0)
              const selectedOption = options.find(spell => (spell.entryId ?? spell.name) === selectedValue
                || selectedSpell && !selectedSpell.entryId && spell.name === selectedSpell.name)
              const valid = !!selectedOption
              const signature = bard && c.level >= 3 && !cantrip && valid
                && (!!extra || activeFeatsNamed(c, 'Ultimate Polymath').length > 0 || sc.signatureSpells?.[rank] === slotKey)
              const displayedSelection = preparedClass && selectedOption && selectedValue === selectedOption.name
                ? { ...selectedOption, entryId: undefined } : selectedOption
              const slotOptions = extra ? options.filter(option => option.name === extra.spell)
                : preparedClass && displayedSelection
                  ? choices.map(option => option.name === displayedSelection.name ? displayedSelection : option) : choices
              const showOptions = slotOptions.length <= 10 || preparedSlot === slotKey
              return <li className="spellbook-row" key={slotKey}>
                <div className="spellbook-slot">
                  {signature && automaticSlots && selectedOption
                    ? <SignatureCast name={selectedOption.name} baseRank={selectedOption.baseRank} slots={automaticSlots}
                      spent={sc.spentSlots ?? []} onCast={key => setSc({ spentSlots: [...new Set([...(sc.spentSlots ?? []), key])] })} />
                    : !cantrip && <button type="button" disabled={!valid || spent || exhausted} aria-label={`Cast spell slot rank ${rank} slot ${index + 1}`}
                    onClick={() => {
                      if (!valid || spent || exhausted) return
                      setSc({ spentSlots: [...new Set([...(sc.spentSlots ?? []), slotKey])] })
                    }}>Cast</button>}
                  {bard && c.level >= 3 && !cantrip && valid && !extra && !activeFeatsNamed(c, 'Ultimate Polymath').length
                    && <button type="button" className={signature ? 'on' : ''} aria-pressed={signature}
                      aria-label={`Signature spell rank ${rank} choice ${index + 1}`} onClick={() => {
                        const select = () => setSc({ signatureSpells: { ...sc.signatureSpells, [rank]: signature ? '' : slotKey } })
                        if (signature) confirmRemoval(`signature spell "${selectedEntry?.name ?? selectedValue}"`, select)
                        else select()
                      }}>Signature</button>}
                  {selectedValue ? <SelectedSlotSpell name={selectedSpell?.name ?? selectedEntry?.name ?? selectedValue}
                    entry={selectedEntry} disabled={spent} source={extra?.source}
                    heightened={!cantrip && selectedOption ? Math.max(0, rank - selectedOption.baseRank) : 0}
                    onClear={restricted ? undefined : () => {
                      const prepared = { ...sc.prepared }
                      delete prepared[slotKey]
                      setSc({ prepared })
                    }} />
                  : <SearchableSelect aria-label={`${cantrip ? 'Cantrip' : `Spell Rank ${rank}`} slot ${index + 1}`}
                    value={selectedValue} optionCount={slotOptions.length} disabled={spent || restricted} alwaysSearchable primaryDetails
                    renderDetails={value => {
                      const option = slotOptions.find(spell => (spell.entryId ?? spell.name) === value)
                      const entry = option && spellEntry(option.name, option.entryId)
                      return entry && <span className="picker-spell-name">
                        {!cantrip && rank > option.baseRank ? `+${rank - option.baseRank} ` : ''}
                        <EntryDescription name={entry.name} entry={entry} />
                      </span>
                    }}
                    title={extra?.source} onPrepare={() => setPreparedSlot(slotKey)}
                    onChange={event => {
                      if (restricted) return
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
                    {showOptions && slotOptions.map(spell => <option key={spell.entryId ?? spell.name} value={spell.entryId ?? spell.name}>
                      {!cantrip && rank > spell.baseRank ? `+${rank - spell.baseRank} ` : ''}{spell.name}
                    </option>)}
                  </SearchableSelect>}
                  {selectedEntry && (selectedEntry.name === 'Bone Shield'
                    ? <BoneShieldActions c={c} save={save} entry={selectedEntry} rank={rank} disabled={!valid} />
                    : selectedEntry.name === 'False Vitality'
                    ? <FalseVitalityActions c={c} save={save} entry={selectedEntry} rank={rank} disabled={!valid} />
                    : selectedEntry.name === 'Animal Feature' || selectedEntry.name === 'Untamed Shift' || selectedEntry.name === 'Dinosaur Form'
                    ? <SpellEffectActions c={c} entries={entries} save={save} entry={selectedEntry} name={selectedEntry.name} rank={rank} />
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
      {druid && groups.some(group => group !== 'Focus Spells') && <b>Learned spell access</b>}
      {!necromancer && groups.filter(group => group !== 'Focus Spells').map(renderSpellGroup)}
      </div>
      <div hidden={activeCategory !== 'innate'}>
      {c.systems.includes('pf2e') && c.level >= 1 && ['fey-touched gnome', 'wellspring gnome'].includes(c.heritage?.toLowerCase() ?? '') && (() => {
        const tradition = gnomeHeritageTradition(c)
        const options = gnomeHeritageCantripOptions(c, entries)
        const current = tradition ? c.gnomeHeritageMagic?.cantrips?.[tradition] ?? '' : ''
        return <div className="col">
          {c.heritage?.toLowerCase() === 'wellspring gnome' && <label>Wellspring Gnome tradition{' '}
            <select aria-label="Wellspring Gnome tradition" value={c.gnomeHeritageMagic?.tradition ?? ''} onChange={event => {
              const value = (['Arcane', 'Divine', 'Occult'] as const).find(option => option === event.target.value)
              save({ gnomeHeritageMagic: { ...c.gnomeHeritageMagic, tradition: value } })
            }}><option value="">Choose tradition</option>{['Arcane', 'Divine', 'Occult'].map(value => <option key={value}>{value}</option>)}</select>
          </label>}
          {tradition && <SearchableSelect label={`${c.heritage} cantrip`} aria-label={`${c.heritage} cantrip`} value={current}
            onChange={event => {
              const value = event.target.value
              if (value && !options.some(entry => entry.name === value)) return
              const select = () => save({ gnomeHeritageMagic: { ...c.gnomeHeritageMagic,
                cantrips: { ...c.gnomeHeritageMagic?.cantrips, [tradition]: value || undefined } } })
              if (!value && current) confirmRemoval(`${c.heritage} cantrip "${current}"`, select)
              else select()
            }}>
            <option value="">Choose cantrip</option>
            {current && !options.some(entry => entry.name === current) && <option value={current} disabled>{current} (unavailable)</option>}
            {[...new Set(options.map(entry => entry.name))].map(name => <option key={name}>{name}</option>)}
          </SearchableSelect>}
        </div>
      })()}
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
        <small>{ABILITY_LABEL[innateSpellAbility(c)]} spell attack {signed(abilityMod(c.abilities[innateSpellAbility(c)]) + proficiencyBonus(1, c.level) - spellPenalty(innateSpellAbility(c)))};
          DC {10 + abilityMod(c.abilities[innateSpellAbility(c)]) + proficiencyBonus(1, c.level) - spellPenalty(innateSpellAbility(c))} (trained).</small>
        <ul>{minorMagicSpells(c, entries).map(entry => <SpellItem c={c} key={entry.name} name={entry.name} entry={entry} rank={Math.ceil(c.level / 2)}
          inlineControls={inlineControls(entry.name)} saveDC={10 + abilityMod(c.abilities[innateSpellAbility(c)]) + proficiencyBonus(1, c.level) - spellPenalty(innateSpellAbility(c))}
          note={`Minor Magic; rank ${Math.ceil(c.level / 2)} ${c.minorMagic?.tradition}`} {...buffProps(entry.name)}>
          {controls(entry.name)}
        </SpellItem>)}</ul>
      </div>}
      {innate.length > 0 && <div>
        <div className="row"><b>Innate Spells</b>
        </div>
        {innateGroups.map(group => <section className="innate-spell-group" key={group.key}>
          <h5>{group.tradition} Spell Rank {group.rank}</h5>
          <SpellColumns />
          <ul>{group.grants.map(grants => {
            const grant = grants[0]
            const details = grantDetails(grant)
            return <InnateSpellRow c={c} key={grant.usageKey} grant={grant} note={details.note} saveDC={details.dc}
              actionControls={grant.entry.name === 'Resist Energy' && ['Order Training', 'Order Cross-Training'].includes(grant.source)
                && grant.rule.condition?.startsWith('Self only. Fire resistance is at least ')
                ? <PyreResistEnergyActions c={c} save={save} entry={grant.entry} rank={grant.rank} /> : undefined}
              inlineControls={<>{inlineControls(grant.entry.name, grant.rank)}<InnateSpellUses c={c} save={save} grant={grant}
                additionalGrants={grants.slice(1)} /></>}
              effectControls={effectControls(grant.entry.name)}
              effectRank={activeRank(grant.entry.name)}
              {...buffProps(grant.entry.name)}>
              {controls(grant.entry.name, grant.rank)}
            </InnateSpellRow>
          })}</ul>
        </section>)}
      </div>}
      </div>
      <div hidden={activeCategory !== 'focus'}>
      {spellcastingSummary}
      <DevotionSpellChoice c={c} entries={entries} save={save} />
      {(focusPoints > 0 || allFocus.length > 0 || !!activeFeatsNamed(c, 'Floral Restoration').length) && (
        <div>
          <div className="focus-spells-heading"><b>Focus Spells</b><FocusPointTracker c={c} save={save} points={focusPoints} />
            <EnergizedFont c={c} save={save} points={focusPoints} /><FloralRestoration c={c} save={save} points={focusPoints} /></div>
          {allFocus.length > 0 && <section className="innate-spell-group">
            <SpellColumns />
            <ul>
            {allFocus.map((s) => {
              const entry = spellEntry(s.name, s.entryId)
              const grant = featSpells.find(grant => grant.rule.kind === 'focus' && grant.entry.name === s.name)
              const details = grant ? grantDetails(grant) : undefined
              const note = details ? details.note : entry && spellResolution(entry).attack
                ? !casting && beastmasterCasting ? `Wis Attack ${signed(abilityMod(c.abilities.wis) + proficiencyBonus(beastmasterCasting, c.level) - spellPenalty('wis'))}`
                : casting && castAbility ? `${ABILITY_LABEL[castAbility]} Attack ${signed(mod)}`
                  : <span role="status">Check the granting rules for this spell's spellcasting attribute and proficiency.</span>
                : undefined
              return <SpellItem c={c} key={s.name} entry={entry} name={s.name} rank={Math.ceil(c.level / 2)} inlineControls={inlineControls(s.name)}
                note={note} effectControls={effectControls(s.name)}
                effectRank={activeRank(s.name)}
                saveDC={details ? details.dc : !casting && beastmasterCasting ? 10 + abilityMod(c.abilities.wis) + proficiencyBonus(beastmasterCasting, c.level) - spellPenalty('wis') : classSpellDC} {...buffProps(s.name)}
                onRemove={s.index >= 0 ? () => save({ spells: spells.filter((_, index) => index !== s.index),
                  activeSpells: c.activeSpells?.filter(name => name !== s.name) }) : undefined}>
                {controls(s.name)}
              </SpellItem>
            })}
            </ul>
          </section>}
        </div>
      )}
      </div>
      <div hidden={activeCategory !== 'items'}>
      {items.length > 0 && <section className="innate-spell-group">
        <h5>Item Spells</h5>
        <SpellColumns />
        <ul>{items.map((spell, index) => {
          const uses = itemSpellUses(c, spell)
          const note = (!uses || !/\bper day\b/i.test(spell.frequency ?? '')) ? spell.frequency : undefined
          return <SpellItem c={c} key={`${spell.source.id}:${index}`}
          name={spell.name} entry={spell.entry} rank={spell.rank}
          saveDC={spell.dc ?? (spell.usesSpellcasting ? classSpellDC : undefined)}
          inlineControls={<ItemSpellUses c={c} save={save} spell={spell} />}
          actionControls={spell.name === 'Bone Shield'
            ? <BoneShieldActions c={c} save={save} entry={spell.entry} rank={spell.rank} actions={spell.actions} />
            : spell.name === 'False Vitality'
            ? <FalseVitalityActions c={c} save={save} entry={spell.entry} rank={spell.rank} actions={spell.actions} />
            : spell.actions ? <ActionIcon actions={spell.actions}
            showOther={!(spell.name === 'Creation' && /^1 minute$/i.test(spell.actions.trim()))} />
            : <SpellActions name={spell.name} entry={spell.entry} rank={spell.rank} />}
          note={spell.entry ? note || undefined : <>{note && `${note}; `}
            <span role="status">Spell data unavailable. Sync Archives of Nethys content to load it.</span>
          </>} />
        })}</ul>
      </section>}
      </div>
      <div hidden={activeCategory !== 'rituals'}>
      <RitualsContent c={c} entries={entries} save={save} />
      </div>
      {unresolved.map((grant, index) => <p key={`${grant.source?.id}:${grant.name}:${index}`} className="feat-prerequisite-note" role="status">
        Spell data unavailable: {grant.name} (<EntryDescription name={grant.sourceName ?? grant.source?.name ?? 'Granting feat'} entry={grant.source} entries={entries} />).
        {' '}Review source rules; this spell is not automated.
      </p>)}
      </div>
  )
}
