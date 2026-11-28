import { EntryDescription } from './EntryDescription'
import { apparitionLimit, attunedApparitions, primaryApparition, type Apparition } from './apparitions'
import { confirmRemoval } from './confirmRemoval'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ABILITIES, ABILITY_LABEL, abilityMod, activeAnimalFeatures, activeBattleForm, activeFeatsNamed, activeUntamedShiftEffects, boneShieldActive, boneShieldChange, canopyCrawlerAffects, canopyCrawlerTarget, championDevotionOptions, classSpellcasting, companionSpellTarget, focusSpells, investigatorMethodologies, hasSwarmkeeperSwarm, isMagicHideActive, isSpellActive, magicHideTarget, SWARM_TARGET_ID, knowsSpell, magicHideChange, proficiencyBonus, protectCompanionTarget, protectCompanionTargets, rogueRackets, signed, spellActiveChange, spellRemovalChange, untamedShiftChoices, type SectionProps } from './builder'
import { ANIMAL_FEATURES, PERSISTENT_SPELLS } from './supplemental'
import type { Character, ContentEntry } from './types'
import { featTakenLevel, grantedWardenSpells, selectedFeatEntry, spellWardenLabel } from './featChoices'
import { ActionIcon } from './ActionIcon'
import { DamageRoll, SpellActions, SpellDamageRolls, spellActionRolls, spellDamage } from './SpellDamage'
import { intensifiedElementDamage, RESIST_ENERGY_TYPES } from './builder'
import { companionAdvancementFor, companionStats, effectiveSpiritAspect } from './companions'
import { classInnateTradition, dailyInnateUses, innateTraditionOptions, gnomeHeritageCantripOptions, gnomeHeritageTradition, grantedFeatSpells, investigatorEsotericaCantripOptions, mageAutomatonOptions, originalNephilimLineage, unresolvedFeatSpells, type limitedSpellUses } from './featSpells'
import { fiendOptions, plantOptions, undeadOptions, type SummonedFiend } from './summonedFiends'
import { SearchableSelect } from './SearchableSelect'
import { featSpellOptions } from './featSpells'
import { MAGIC_TRADITIONS, minorMagicOptions } from './minorMagic'
import { canChangeUntamedForm, untamedFormOptions, untamedFormRanks } from './builder'
import { animistApparitionSlots, avengerClericSpellSlots, loanerSpellIsSlot, minorMagicInheritedTradition, minorMagicSpells, avengerEldritchCastingClass, classDifficultyClass, classExtraSlots, isSpontaneousClass, classRepertoireRows, classSpellSlots, conditionPenalty, druidSpellList, witchSpellList, giantWeaponClumsy, innateSpellAbility, knownSpellNames, selectedGrantedSpellNames, necromancerDirge, necromancerDirgeLearnChecker, necromancerGrantedDirgeSpells, necromancerSpellList, spellDifficultyClass, spellName, wizardArchetypeSpellbookChoices, wizardCurriculum, wizardSchool, wizardSchoolBookSpells, type Ability } from './builder'
import { hasDivineIntercession } from './divineIntercessions'
import { SourceNote } from './Info'
import { itemSpells, itemSpellUses, itemSpellUsesChange, type ItemSpell } from './itemSpells'
import { DeferredDetails } from './DeferredDetails'
import { specificMagicItemName } from './equipmentGroups'
import { getSettings } from './settings'
import { witchwarperParadox, witchwarperRepertoireSlots, witchwarperSpellOptions } from './witchwarper'
import { spellAccessGranted } from './featAccess'
import { ANCESTRAL_AVATAR, ANIMAL_FORMS, CAYPIN_FORM, LASHUNTA_CREATURE_FORMS, animalBattleForm, crocodileBattleForm, DINOSAUR_FORMS, INSECT_FORMS, insectBattleForm } from './battleForms'
import { isAncestralEmbrace } from './namedArmor'
import { familiarSpellBenefits } from './familiarAbilities'
import { PYRE_ENERGY_TYPES } from './hellknight'
import { matchesSpellTrait, spellTraits, SpellTraitFilter } from './SpellTraitFilter'
import { PickerSort, type PickerSortOrder } from './PickerSort'
import { sortSpellsByDamage, spellDamageLabel } from './spellDamageTypes'
import { spellResolution } from './spellDefense'
import { GearSystemFilter } from './GearSystemFilter'
import { matchesGearSystem, type GearSystem } from './gearSystem'
import { FORCE_FIELD_PGA_RESISTANCE_TYPES, TECHNOMANCER_LANGUAGE_RULES } from './technomancer'

const RANK_NAMES = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary']
const AUTOMATED_SPELL_EFFECTS = ['Athletic Rush', 'Bless', 'Bonding Charge', 'Cairn Form', 'Eat Fire', 'Enduring Might', 'Fly', 'Force-FieldPGA', 'Gravity Weapon', 'Imitate Fauna', 'Keen Smell', 'Magnetic Tuning', 'Magic Hide', 'Mountain Resilience', 'Mystic Armor', 'Oaken Resilience', 'Repair Protocols', 'Resist Energy', 'Skyfire Wings', 'Stormwind Flight', 'Supercharge Armor', 'Summon Celestial', 'Tailwind']
const STATUS_TRACKED_SPELL_EFFECTS = [...AUTOMATED_SPELL_EFFECTS, 'Animal Feature', 'Canopy Crawler', 'Heroism', 'Marvelous Mount', 'Speak with Plants', 'Warning Stripes']
const SLOT_INCREASE_FEATS = ['Cantrip Expansion', 'Arcane Breadth', 'Divine Breadth', 'Perfect Encore', 'Deep Lore',
  'Faceless Trickster', "Archwizard's Might", 'Bloodline Perfection', 'Maker of Miracles', 'Mind over Matter',
  'Mortem Ultimatum', 'Oracular Providence', 'Patron\'s Truth', 'Quantum Research', "Hierophant's Power",
  'Cache Caster', 'Root Access']

const spellSlotCount = (selected: number, total: number) => `${String(selected).padStart(String(total).length, '0')}/${total}`

function spellSlotCounts(c: Character, entries: ContentEntry[]) {
  const automatic = classSpellSlots(c)
  const slots = classRepertoireRows(c) ?? automatic ?? c.spellcasting?.slots ?? {}
  const manualCacheSlots = automatic === undefined
    ? classExtraSlots(c, entries).filter(extra => extra.source === 'Cache Caster') : []
  const benefits = familiarSpellBenefits(c, entries, automatic ?? slots)
  const counts: Record<number, number> = {}
  for (let rank = 0; rank <= 10; rank++)
    counts[rank] = Math.max(0, Math.min(20, Math.trunc(Number(slots[rank]) || 0)))
      + Number(manualCacheSlots.some(extra => extra.rank === rank))
      + Number(rank === 0 && benefits.cantrip) + Number(rank === benefits.batteryRank)
  return counts
}

function spellSlotIncreaseNotes(c: Character, entries: ContentEntry[]) {
  const extras = classExtraSlots(c, entries)
  const featSources = new Set([...SLOT_INCREASE_FEATS,
    ...extras.filter(extra => c.feats.some(feat => feat.name === extra.source)).map(extra => extra.source)])
  const current = spellSlotCounts(c, entries)
  const notes = new Map<number, string[]>()
  const add = (rank: number, note: string) => notes.set(rank, [...notes.get(rank) ?? [], note])
  for (const source of featSources) {
    if (!c.feats.some(feat => feat.name === source)) continue
    const withoutSource = { ...c, feats: c.feats.filter(feat => feat.name !== source) }
    const baseline = spellSlotCounts(withoutSource, entries)
    for (let rank = 0; rank <= 10; rank++) {
      const increase = current[rank] - baseline[rank]
      if (increase > 0) add(rank, `+${increase} ${source}`)
    }
  }
  const automatic = classSpellSlots(c)
  const slots = classRepertoireRows(c) ?? automatic ?? c.spellcasting?.slots ?? {}
  const benefits = familiarSpellBenefits(c, entries, automatic ?? slots)
  if (benefits.cantrip) add(0, '+1 Cantrip Connection')
  if (benefits.batteryRank !== undefined) add(benefits.batteryRank, '+1 Spell Battery')
  const extraSources = new Map<string, Map<number, number>>()
  for (const extra of extras.filter(extra => extra.source === 'Divine Font' || /curriculum/i.test(extra.source))) {
    const ranks = extraSources.get(extra.source) ?? new Map<number, number>()
    ranks.set(extra.rank, (ranks.get(extra.rank) ?? 0) + 1)
    extraSources.set(extra.source, ranks)
  }
  for (const [source, ranks] of extraSources)
    for (const [rank, count] of ranks) add(rank, `+${count} ${source}`)
  return notes
}

function PharasmaSpellBonus({ c, entry, name, rank }: { c: Character; entry?: ContentEntry; name: string; rank: number }) {
  if (!hasDivineIntercession(c, 'Pharasma', 'moderate-boon') || rank < 1) return null
  const rolls = spellDamage(name, rank)
  const relevant = name === 'Heal' || rolls.some(roll => /^(?:HP|vitality\b)/i.test(roll.type))
    || /\bvitality damage\b|\b(?:heals?|restores?|regains?)\b[^.]*\b(?:HP|Hit Points)\b/i.test(entry?.description ?? '')
  return relevant ? <small>+{rank} status <SourceNote source="Pharasma (Moderate Boon)"
    note="Applies to vitality damage against undead or Hit Points restored to living creatures; status bonuses do not stack. Not included in rolls." inlineSource /></small> : null
}

const isCommonSpell = (entry?: ContentEntry) => !!entry && !entry.traits.some(trait => /^(?:uncommon|rare|unique)$/i.test(trait))
  && !/^(?:uncommon|rare|unique)$/i.test(String(entry.data.rarity ?? ''))

function uniqueSpellVariants<T extends { name: string }>(spells: T[], systems: (spell: T) => string) {
  const names = new Set<string>()
  return spells.filter(spell => {
    const key = `${spell.name}\0${systems(spell)}`
    if (names.has(key)) return false
    names.add(key)
    return true
  })
}

function arcaneSpellbookOptions(c: Character, spells: ContentEntry[], rank: number, system: 'pf2e' | 'sf2e') {
  return spells.filter(entry => entry.systems.includes(system)
    && (rank === 0 ? entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
      : entry.level === rank && !entry.traits.some(trait => trait.toLowerCase() === 'cantrip'))
    && String(entry.data.tradition ?? '').split(/,\s*/).some(tradition => tradition.toLowerCase() === 'arcane')
    && !entry.traits.some(trait => /^(uncommon|rare|unique)$/i.test(trait))
    && !/^(uncommon|rare|unique)$/i.test(String(entry.data.rarity))
    && spellAccessGranted(c, entry))
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
    {state?.form === 'Pest Form' && (state.rank && ranks.includes(state.rank) ? state.rank : ranks[0]) >= 4 && <label>
    <input type="checkbox" aria-label="Untamed Pest Form flying" checked={!!state.pestFlying} disabled={active && !canChange}
      onChange={event => save({ untamedForm: { ...state, pestFlying: event.target.checked } })} /> Flying creature
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
  const normalCapacity = Math.min(3, Math.max(0, points))
  const desperateWarden = !!activeFeatsNamed(c, 'Desperate Warden').length
  const temporary = desperateWarden ? c.desperateWardenFocusPoint : undefined
  const capacity = normalCapacity || (temporary === -1 ? 1 : 0)
  if (!capacity && !desperateWarden) return null
  const spent = new Set((c.spentFocusPoints ?? []).filter(index => Number.isInteger(index) && index >= 0 && index < normalCapacity))
  const damoritoshsClaw = c.systems.includes('sf2e') && c.ancestry === 'Vesk'
    && !!activeFeatsNamed(c, "Damoritosh's Claw").length
  const clawUsed = !!c.dailyFeatUses?.["Damoritosh's Claw"]
  const wardenUsed = !!c.dailyFeatUses?.['Desperate Warden']
  return <span className="focus-tracker" role="group" aria-label={`${capacity - spent.size} of ${capacity} focus points available`}>
    {Array.from({ length: capacity }, (_, index) => {
      const isTemporary = temporary === index || temporary === -1 && index === 0
      const label = `${spent.has(index) ? 'Restore' : 'Spend'} focus point ${index + 1}`
      return <button key={index} type="button" className="focus-point" aria-label={label}
        title={label} aria-pressed={!spent.has(index)} onClick={() => {
          const next = new Set(spent)
          if (next.has(index)) next.delete(index)
          else if (index < normalCapacity) next.add(index)
          void save({ spentFocusPoints: [...next],
            focusPointsSpentSinceRefocus: Math.max(0, (c.focusPointsSpentSinceRefocus ?? spent.size) + (spent.has(index) ? -1 : 1)),
            ...(isTemporary && !spent.has(index) ? { desperateWardenFocusPoint: undefined } : {}) })
        }} />
    })}
    {damoritoshsClaw && <button type="button" aria-label="Use Damoritosh's Claw" disabled={clawUsed || !spent.size}
      title="In combat, once per day, regain 1 Focus Point up to your usual maximum."
      onClick={() => {
        if (clawUsed || !spent.size) return
        save({ spentFocusPoints: [...spent].slice(1), dailyFeatUses: { ...c.dailyFeatUses, "Damoritosh's Claw": true } })
      }}>Damoritosh's Claw <ActionIcon actions="Single Action" /></button>}
    {desperateWarden && <>
      <button type="button" aria-label="Use Desperate Warden"
        disabled={wardenUsed || temporary !== undefined || spent.size < normalCapacity} onClick={() => {
          if (wardenUsed || temporary !== undefined || spent.size < normalCapacity) return
          const index = normalCapacity ? [...spent][0] : -1
          save({ spentFocusPoints: [...spent].filter(value => value !== index), desperateWardenFocusPoint: index,
            dailyFeatUses: { ...c.dailyFeatUses, 'Desperate Warden': true } })
        }}>Desperate Warden <ActionIcon actions="Free Action" /></button>
    </>}
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
        const description = [`Rank ${pool.grant.rank}`, pool.grant.rule.condition].filter(Boolean).join('; ')
        return <button key={`${pool.uses.key}:${index}`} type="button" className="focus-point"
          aria-label={label} aria-description={description} title={`${label}; ${description}`} aria-pressed={!spent} onClick={() => {
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
    const compatible = !grant.rule.shared && !!dailyInnateUses(c, grant)
    const match = compatible && grouped.find(group => {
      const first = group[0]
      return !first.rule.shared && !!dailyInnateUses(c, first)
        && first.rule.kind === grant.rule.kind
        && first.entry.name.toLowerCase() === grant.entry.name.toLowerCase()
        && first.rule.tradition?.toLowerCase() === grant.rule.tradition?.toLowerCase()
        && first.rule.ability === grant.rule.ability && first.rule.dc === grant.rule.dc
        && !group.some(existing => existing.usageKey === grant.usageKey)
    })
    if (match) match.push(grant)
    else grouped.push([grant])
  }
  return grouped.map(group => group.sort((a, b) => b.rank - a.rank))
}

export function ItemSpellUses({ c, save, spell }: Pick<SectionProps, 'c' | 'save'> & { spell: ItemSpell }) {
  const uses = itemSpellUses(c, spell)
  if (!uses) return null
  return spellUseTracker(`${spell.name} (${specificMagicItemName(spell.source)})`, uses,
    spent => save(itemSpellUsesChange(c, spell, spent)))
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
  const multiple = activeFeatsNamed(c, 'Persistent Animal Feature').length > 0
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

export function PestFormActions({ c, save, entry, rank, source = 'Pest Form', disabled }: Pick<SectionProps, 'c' | 'save'> & {
  entry?: ContentEntry; rank: number; source?: 'Pest Form' | 'Ancestral Pest'; disabled?: boolean
}) {
  const state = c.pestForm?.source === source && c.pestForm.rank === rank ? c.pestForm : undefined
  const active = !!c.activeSpells?.includes('Pest Form') && !!state
  const transforming = !!c.activeSpells?.includes('Pest Form')
  const valid = Number.isInteger(rank) && rank >= 1 && rank <= 10
  const update = (patch: Partial<NonNullable<Character['pestForm']>>) =>
    save({ pestForm: { rank, source, ...state, ...patch } })
  return <ActiveSpellActions name="Pest Form" entry={entry} rank={rank} actions="Two Actions">
    {source === 'Pest Form' && rank >= 4 && <label><input type="checkbox" aria-label="Pest Form flying"
      checked={!!state?.flying} disabled={transforming || disabled} onChange={event => update({ flying: event.target.checked })} /> Flying creature</label>}
    {source === 'Ancestral Pest' && c.ancestry === 'Entu Colony' && <label>
      <input type="checkbox" aria-label="Ancestral Pest original animal swims" checked={!!state?.swimming}
        disabled={transforming || disabled} onChange={event => update({ swimming: event.target.checked })} /> Original animal has a swim Speed
    </label>}
    <label><input type="checkbox" aria-label={`${source} active`} checked={active}
      disabled={!active && (disabled || !valid)} onChange={event => {
        const next = event.target.checked
        if (next && (disabled || !valid)) return
        save({ ...spellActiveChange(c, 'Pest Form', next),
          pestForm: next ? { rank, source, flying: state?.flying, swimming: state?.swimming } : undefined })
      }} /> {source === 'Ancestral Pest' && c.ancestry === 'Lashunta' ? 'Squox form' : 'Active'}</label>
  </ActiveSpellActions>
}

export function CrocodileFormToggle({ c, entries, save }: SectionProps) {
  const active = isSpellActive(c, entries, 'Animal Form')
  return <label><input type="checkbox" aria-label="Crocodile Form active" checked={active}
    onChange={event => save(spellActiveChange(c, 'Animal Form', event.target.checked))} /> Active</label>
}

export function CreatureShapeOptions({ c, entries, save, rank }: SectionProps & { rank: number }) {
  const shirren = c.ancestry === 'Shirren'
  const spell = shirren ? 'Insect Form' : 'Animal Form'
  const active = isSpellActive(c, entries, spell) && !!c.creatureShape
  const form = c.creatureShape && (shirren ? insectBattleForm('Ant', rank, c.level)
    : animalBattleForm(c.creatureShape.form, c.creatureShape.rank, c.level))
  const lashunta = c.ancestry === 'Lashunta'
  const options = lashunta ? LASHUNTA_CREATURE_FORMS : [...ANIMAL_FORMS, CAYPIN_FORM]
  const label = shirren ? 'Kucharn' : lashunta ? 'Creature Shape' : 'Caypin'
  return <fieldset className="col">
    <legend>{label} form</legend>
    {shirren ? <label><input type="checkbox" aria-label="Kucharn form active" checked={active}
      onChange={event => save({ ...spellActiveChange(c, spell, event.target.checked),
        creatureShape: event.target.checked ? { form: 'Ant', rank } : undefined })} /> Active</label>
      : <label>Battle form{' '}
      <select aria-label={`${label} battle form`} value={active ? c.creatureShape?.form ?? '' : ''}
        onChange={event => {
          if (!options.some(option => option.name === event.target.value)) return
          save({ ...spellActiveChange(c, spell, true), creatureShape: { form: event.target.value, rank } })
        }}>
        <option value="">Choose form</option>
        {options.map(option => <option key={option.name}>{option.name}</option>)}
      </select>
    </label>}
    {active && form && <p>{form.size}; AC {form.ac}; temporary HP {form.temporaryHp}; Speed {form.speed} feet;
      attack {signed(form.attack)}; Athletics {signed(form.athletics)}.</p>}
    <SourceNote source="Creature Shape" note={shirren
      ? 'Uses ant battle form statistics for kucharn; GM approval required. Use your normal AC if higher.'
      : lashunta
      ? 'Shotalashu and Squox battle forms are custom options requiring GM approval. Use your normal AC if higher.'
      : 'Caypin battle form is a custom option requiring GM approval; other forms use the closest battle form chosen by the GM. Use your normal AC if higher.'} />
    <button type="button" disabled={!active} onClick={() => save({
      creatureShape: undefined, ...spellActiveChange(c, spell, false),
    })}>Dismiss Creature Shape</button>
  </fieldset>
}

export function CaypinAllyToggle({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  return <label><input type="checkbox" aria-label="Summoned Caypin active" checked={!!c.creatureAllyActive}
    onChange={event => save({ creatureAllyActive: event.target.checked,
      ...(!event.target.checked && c.mountedSummon === 'ally:Caypin' ? { mountedSummon: undefined } : {}) })} /> Active
    <SourceNote source="Caypin" note="GM approval required: caypin is a beast, not an animal, and Creature Ally's rank 5 spell normally permits creatures of level 5 or lower." />
  </label>
}

export function CatAllyToggle({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  return <label><input type="checkbox" aria-label="Summoned Cat active" checked={!!c.creatureAllyActive}
    onChange={event => {
      const active = event.target.checked
      const change = () => save({ creatureAllyActive: active })
      if (active) change()
      else confirmRemoval('summoned Cat', change)
    }} /> Active</label>
}

export function ShirrenAllyToggle({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  return <label><input type="checkbox" aria-label="Summoned Kucharn active" checked={!!c.shirrenCreatureAllyActive}
    onChange={event => save({ shirrenCreatureAllyActive: event.target.checked,
      ...(!event.target.checked && c.mountedSummon === 'ally:Emganat' ? { mountedSummon: undefined } : {}) })} /> Active
    <SourceNote source="Emganat" note="GM approval required: kucharns do not have the animal trait required by Summon Animal." />
  </label>
}

export function LashuntaAllyOptions({ c, save, confirmDismiss = false }: Pick<SectionProps, 'c' | 'save'> & { confirmDismiss?: boolean }) {
  return <label>Summoned creature{' '}
    <select aria-label="Creature Ally summoned creature" value={c.lashuntaCreatureAlly ?? ''} onChange={event => {
      const value = event.target.value
      if (value !== '' && value !== 'Shotalashu' && value !== 'Squox') return
      const select = () => save({ lashuntaCreatureAlly: value || undefined,
        ...(value ? { lashuntaCreatureAllyChoice: value } : {}),
        ...(c.mountedSummon?.startsWith('ally:') && c.mountedSummon !== `ally:${value}` ? { mountedSummon: undefined } : {}) })
      if (confirmDismiss && c.lashuntaCreatureAlly && c.lashuntaCreatureAlly !== value)
        confirmRemoval(`summoned ${c.lashuntaCreatureAlly}`, select)
      else select()
    }}>
      <option value="">None</option>
      <option>Shotalashu</option>
      <option>Squox</option>
    </select>
    <SourceNote source="Shotalashu" note="GM approval required: shotalashu has the beast trait, not the animal trait required by Summon Animal." />
  </label>
}

export function SummonFiendActions({ c, entries, save, entry, rank, lineageOnly = false, requiredTrait, disabled, innate = false }: SectionProps & {
  entry?: ContentEntry; rank: number; lineageOnly?: boolean; requiredTrait?: string; disabled?: boolean; innate?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [fiends, setFiends] = useState<SummonedFiend[]>()
  const [error, setError] = useState('')
  const celestial = entry?.name === 'Summon Celestial'
  const spellName = celestial ? 'Summon Celestial' : 'Summon Fiend'
  const noun = celestial ? 'celestial' : 'fiend'
  const lineage = lineageOnly ? originalNephilimLineage(c, entries) ?? '' : undefined
  const options = fiendOptions(fiends ?? [], rank, lineageOnly ? lineage || 'unknown' : undefined, requiredTrait, true)
  const [opened, setOpened] = useState(false)
  const open = () => {
    setOpened(true)
    dialog.current?.showModal()
    dialog.current?.querySelector('h4')?.focus()
    if (fiends) return
    setError('')
    void fetch(`${import.meta.env.BASE_URL}data/aon-${celestial ? 'celestials' : 'fiends'}.json`).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json() as Promise<SummonedFiend[]>
    }).then(data => {
      if (!Array.isArray(data)) throw new Error(`Invalid ${noun} catalog`)
      setFiends(data)
    }).catch((failure: unknown) => setError(`Unable to load ${noun}s: ${failure instanceof Error ? failure.message : String(failure)}`))
  }
  const choose = (selected?: SummonedFiend) => save({ summonedFiend: selected, ...spellActiveChange(c, spellName, !!selected),
      summonInnateRanks: { ...c.summonInnateRanks, fiend: selected && innate ? rank : undefined },
      ...(c.mountedSummon?.startsWith('fiend:') && c.mountedSummon !== `fiend:${selected?.id}` ? { mountedSummon: undefined } : {}) })
  const only = options.length === 1 ? options[0] : undefined
  useEffect(() => {
    if (!opened || !fiends) return
    setOpened(false)
    if (only && !c.summonedFiend) choose(only)
  })
  return <>
    <button type="button" className="spell-action-button" aria-label={`${spellName} options`} aria-haspopup="dialog" disabled={disabled} onClick={open}>
      <ActionIcon actions="Three Actions" />
    </button>
    <dialog ref={dialog} className="entry-dialog" aria-labelledby={titleId}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <h4 id={titleId} tabIndex={-1}>{spellName} (Rank {rank})</h4>
      {error ? <p role="alert">{error}</p> : !fiends ? <p role="status">Loading {noun}s...</p> : <SearchableSelect
        label={`Summoned ${noun}`} aria-label={`Summoned ${noun}`} value={c.summonedFiend?.id ?? ''} alwaysSearchable
        onChange={event => {
          const value = event.target.value
          const selected = options.find(fiend => fiend.id === value)
          if (value && !selected) return
          const select = () => choose(selected)
          if (c.summonedFiend && c.summonedFiend.id !== value) confirmRemoval(`summoned ${c.summonedFiend.name}`, select)
          else select()
        }}>
        <option value="">None</option>
        {c.summonedFiend && !options.some(fiend => fiend.id === c.summonedFiend?.id)
          && <option value={c.summonedFiend.id} disabled>{c.summonedFiend.name} (unavailable)</option>}
        {options.map(fiend => <option key={fiend.id} value={fiend.id}>{fiend.name} (Level {fiend.level})</option>)}
      </SearchableSelect>}
        <label><input type="checkbox" aria-label={`${spellName} active`} checked={!!c.summonedFiend}
          disabled={!c.summonedFiend}
          onChange={event => {
            if (event.target.checked || !c.summonedFiend) return
            confirmRemoval(`summoned ${c.summonedFiend.name}`, () => save({
              summonedFiend: undefined, ...spellActiveChange(c, spellName, false),
              ...(c.mountedSummon?.startsWith('fiend:') ? { mountedSummon: undefined } : {}),
            }))
          }} /> {spellName}{c.summonedFiend ? `: ${c.summonedFiend.name}` : ''}</label>
      <p>{entry?.description || 'Description unavailable. Sync Archives of Nethys content to load it.'}</p>
      <form method="dialog"><button autoFocus>Close</button></form>
    </dialog>
  </>
}

export function SummonUndeadActions({ c, save, entry, rank, disabled, innate = false }: Pick<SectionProps, 'c' | 'save'> & {
  entry?: ContentEntry; rank: number; disabled?: boolean; innate?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [undead, setUndead] = useState<SummonedFiend[]>()
  const [error, setError] = useState('')
  const options = undeadOptions(undead ?? [], rank)
  const open = () => {
    dialog.current?.showModal()
    dialog.current?.querySelector('h4')?.focus()
    if (undead) return
    setError('')
    void fetch(`${import.meta.env.BASE_URL}data/aon-undead.json`).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json() as Promise<SummonedFiend[]>
    }).then(data => {
      if (!Array.isArray(data)) throw new Error('Invalid undead catalog')
      setUndead(data)
    }).catch((failure: unknown) => setError(`Unable to load undead: ${failure instanceof Error ? failure.message : String(failure)}`))
  }
  return <>
    <button type="button" className="spell-action-button" aria-label="Summon Undead options" aria-haspopup="dialog"
      disabled={disabled} onClick={open}><ActionIcon actions="Three Actions" /></button>
    <dialog ref={dialog} className="entry-dialog" aria-labelledby={titleId}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <h4 id={titleId} tabIndex={-1}>Summon Undead (Rank {rank})</h4>
      {error ? <p role="alert">{error}</p> : !undead ? <p role="status">Loading undead...</p> : <SearchableSelect
        label="Summoned undead" aria-label="Summoned undead" value={c.summonedUndead?.id ?? ''} alwaysSearchable
        onChange={event => {
          const value = event.target.value
          const selected = options.find(creature => creature.id === value)
          if (value && !selected) return
          const select = () => save({ summonedUndead: selected, ...spellActiveChange(c, 'Summon Undead', !!selected),
            summonInnateRanks: { ...c.summonInnateRanks, undead: selected && innate ? rank : undefined },
            ...(c.mountedSummon?.startsWith('undead:') && c.mountedSummon !== `undead:${selected?.id}` ? { mountedSummon: undefined } : {}) })
          if (c.summonedUndead && c.summonedUndead.id !== value) confirmRemoval(`summoned ${c.summonedUndead.name}`, select)
          else select()
        }}>
        <option value="">None</option>
        {c.summonedUndead && !options.some(creature => creature.id === c.summonedUndead?.id)
          && <option value={c.summonedUndead.id} disabled>{c.summonedUndead.name} (unavailable)</option>}
        {options.map(creature => <option key={creature.id} value={creature.id}>
          {creature.name} (Level {creature.level})
        </option>)}
      </SearchableSelect>}
      <p>{entry?.description || 'Description unavailable. Sync Archives of Nethys content to load it.'}</p>
      <form method="dialog"><button autoFocus>Close</button></form>
    </dialog>
  </>
}

function MarvelousMountActions({ c, save, entry, disabled }: Pick<SectionProps, 'c' | 'save'> & {
  entry?: ContentEntry; disabled?: boolean
}) {
  const active = c.activeSpells?.includes('Marvelous Mount') ?? false
  return <button type="button" className="spell-action-button" aria-label={active ? 'Dismiss Marvelous Mount' : 'Summon Marvelous Mount'}
    aria-pressed={active} title={active ? 'Dismiss Marvelous Mount' : 'Summon Marvelous Mount'}
    disabled={disabled} onClick={() => save(spellActiveChange(c, 'Marvelous Mount', !active))}>
    <ActionIcon entry={entry} showOther compactOther />
  </button>
}

export function SummonPlantActions({ c, save, entry, rank, disabled, slainCreatureRank = false, actions = 'Three Actions', innate = false }: Pick<SectionProps, 'c' | 'save'> & {
  entry?: ContentEntry; rank: number; disabled?: boolean; slainCreatureRank?: boolean; actions?: string; innate?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [creatures, setCreatures] = useState<SummonedFiend[]>()
  const [error, setError] = useState('')
  const [slainLevel, setSlainLevel] = useState('')
  const level = Number(slainLevel)
  const validLevel = slainLevel !== '' && Number.isInteger(level) && level >= 1 && level <= 20
  const effectiveRank = slainCreatureRank
    ? Math.max(Math.ceil(level / 2), getSettings().innateAutoHeighten ? rank : 0) : rank
  const options = slainCreatureRank && !validLevel ? [] : plantOptions(creatures ?? [], effectiveRank)
  const open = () => {
    dialog.current?.showModal()
    dialog.current?.querySelector('h4')?.focus()
    if (creatures) return
    setError('')
    void fetch(`${import.meta.env.BASE_URL}data/aon-plants.json`).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json() as Promise<SummonedFiend[]>
    }).then(data => {
      if (!Array.isArray(data)) throw new Error('Invalid plant and fungus catalog')
      setCreatures(data)
    }).catch((failure: unknown) => setError(`Unable to load plants and fungi: ${failure instanceof Error ? failure.message : String(failure)}`))
  }
  return <>
    <button type="button" className="spell-action-button" aria-label="Summon Plant or Fungus options" aria-haspopup="dialog" disabled={disabled} onClick={open}>
      <ActionIcon actions={actions} />
    </button>
    <dialog ref={dialog} className="entry-dialog" aria-labelledby={titleId}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <h4 id={titleId} tabIndex={-1}>Summon Plant or Fungus</h4>
      {slainCreatureRank && <label>Slain creature level <input type="number" min="1" max="20" step="1"
        value={slainLevel} onChange={event => setSlainLevel(event.target.value)} /></label>}
      {error ? <p role="alert">{error}</p> : !creatures ? <p role="status">Loading plants and fungi...</p> : <SearchableSelect
        label="Summoned plant or fungus" aria-label="Summoned plant or fungus" value={c.summonedPlant?.id ?? ''} alwaysSearchable
        onChange={event => {
          const value = event.target.value
          const selected = options.find(creature => creature.id === value)
          if (value && !selected) return
          const select = () => save({ summonedPlant: selected,
            summonInnateRanks: { ...c.summonInnateRanks, plant: selected && innate ? rank : undefined },
            ...(c.mountedSummon?.startsWith('plant:') && c.mountedSummon !== `plant:${selected?.id}` ? { mountedSummon: undefined } : {}) })
          if (c.summonedPlant && c.summonedPlant.id !== value) confirmRemoval(`summoned ${c.summonedPlant.name}`, select)
          else select()
        }}>
        <option value="">None</option>
        {c.summonedPlant && !options.some(creature => creature.id === c.summonedPlant?.id)
          && <option value={c.summonedPlant.id} disabled>{c.summonedPlant.name} (unavailable)</option>}
        {options.map(creature => <option key={creature.id} value={creature.id}>{creature.name} (Level {creature.level})</option>)}
      </SearchableSelect>}
      <p>{entry?.description || 'Description unavailable. Sync Archives of Nethys content to load it.'}</p>
      <form method="dialog"><button autoFocus>Close</button></form>
    </dialog>
  </>
}

export function ZealousConvictionToggle({ c, save, rank }: Pick<SectionProps, 'c' | 'save'> & { rank: number }) {
  return <label><input type="checkbox" aria-label="Zealous Conviction active on self" checked={c.zealousConvictionRank !== undefined}
    onChange={event => save({ zealousConvictionRank: event.target.checked ? rank : undefined })} /> Zealous Conviction</label>
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

export function RapidShapeActions({ c, save }: SectionProps) {
  if (!activeFeatsNamed(c, 'Rapid Shape').length) return null
  const used = !!c.dailyAbilityUses?.['Rapid Shape']
  return <div className="row">
    <button type="button" aria-label="Cast Untamed Form with Rapid Shape" disabled={used}
      onClick={() => {
        if (used) return
        save({ ...spellActiveChange(c, 'Untamed Form', true), dailyAbilityUses: { ...c.dailyAbilityUses, 'Rapid Shape': true } })
      }}><ActionIcon actions="Single Action" /> Rapid Shape</button>
    <button type="button" aria-label="Reset Rapid Shape" disabled={!used}
      onClick={() => save({ dailyAbilityUses: { ...c.dailyAbilityUses, 'Rapid Shape': false } })}>Daily preparations</button>
  </div>
}

export function SpellEffectActions({ c, entries, save, entry, name, rank = Math.ceil(c.level / 2) }: SectionProps & {
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
      {name === 'Untamed Form' && <RapidShapeActions c={c} entries={entries} save={save} />}
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

export function ProtectCompanionOptions({ c, save, companionId, familiarTarget, disabled, entries, showDetails }: Pick<SectionProps, 'c' | 'save'>
  & { companionId?: string; familiarTarget?: 'primary' | 'wasp'; disabled?: boolean; entries?: ContentEntry[]; showDetails?: boolean }) {
  const targets = protectCompanionTargets(c)
  const target = protectCompanionTarget(c)
  const allTargets = getSettings().protectCompanionAll
  const active = !!c.activeSpells?.includes('Protect Companion')
  const specificTarget = targets.find(item => companionId !== undefined ? item.companionId === companionId
    : familiarTarget !== undefined && item.familiar === familiarTarget)
  const selected = companionId !== undefined || familiarTarget !== undefined ? specificTarget : target
  const entry = entries?.find(item => item.kind === 'spell' && !item.deleted && item.name === 'Protect Companion'
    && item.systems.some(system => c.systems.includes(system)))
  const selectTarget = (item: NonNullable<typeof target>) => ({
    protectCompanionId: item.companionId, protectCompanionFamiliar: item.familiar,
  })
  return <div className="row">
    <label><input type="checkbox" aria-label={specificTarget ? `Protect Companion on ${specificTarget.name}` : 'Protect Companion active'}
      checked={active && (allTargets || !specificTarget || specificTarget.key === target?.key)} disabled={!active && (disabled || !allTargets && !selected)}
      onChange={event => save({ ...spellActiveChange(c, 'Protect Companion', event.target.checked),
        ...(!allTargets && selected ? selectTarget(selected) : {}) })} />
      {!showDetails && ' Protect Companion'}</label>
    {showDetails && <><EntryDescription name="Protect Companion" entry={entry} entries={entries} character={c} hideButtonActions />
      {' '}<ActiveSpellActions name="Protect Companion" entry={entry} actions="Single Action">
        <ProtectCompanionOptions c={c} save={save} companionId={companionId} familiarTarget={familiarTarget} disabled={disabled} />
      </ActiveSpellActions></>}
    {!allTargets && !companionId && !familiarTarget && targets.length > 1 && <label>Target{' '}
      <select aria-label="Protect Companion target" value={target?.key ?? ''} onChange={event => {
        const selectedTarget = targets.find(item => item.key === event.target.value)
        if (selectedTarget) save(selectTarget(selectedTarget))
      }}>{targets.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select>
    </label>}
  </div>
}

export function SpiritOfTheBeastOptions({ c, save, companionId, disabled }: Pick<SectionProps, 'c' | 'save'> & {
  companionId?: string; disabled?: boolean
}) {
  const companions = (c.companions ?? []).filter(companion => !companionId || companion.id === companionId)
  const hasAlpha = activeFeatsNamed(c, 'Spirit of the Alpha').length > 0
  return <div className="col">{companions.map(companion => <label key={companion.id}>
    {companions.length > 1 && <>{companion.name || companion.type}{' '}</>}
    <SearchableSelect aria-label={`Spirit of the Beast aspect on ${companion.name || companion.type}`}
      value={effectiveSpiritAspect(c, companion) ?? ''} disabled={disabled} onChange={event => {
        const spiritAspect = (hasAlpha ? ['Alpha'] as const : ['Might', 'Swiftness', 'Insight'] as const)
          .find(aspect => aspect === event.target.value)
        save({ companions: c.companions?.map(item => item.id === companion.id ? { ...item, spiritAspect } : item) })
      }}>
      <option value="">Spirit of the Beast…</option>
      {(hasAlpha ? ['the Alpha'] : ['Insight', 'Might', 'Swiftness']).map(aspect =>
        <option key={aspect} value={aspect === 'the Alpha' ? 'Alpha' : aspect}>Aspect of {aspect}</option>)}
    </SearchableSelect>
  </label>)}</div>
}

export function ActiveSpellActions({ name, entry, rank, actions: actionOverride, children, buttonRef }: {
  name: string; entry?: ContentEntry; rank?: number; actions?: string; children: ReactNode; buttonRef?: RefObject<HTMLButtonElement | null>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const actions = actionOverride ?? (typeof entry?.data.actions === 'string' ? entry.data.actions : '')
  return <>
    <button ref={buttonRef} type="button" className="spell-action-button" aria-label={`${name} options`} aria-haspopup="dialog"
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

function SummonAnimalStatus({ c, save, entry, name, specialAlly }: Pick<SectionProps, 'c' | 'save'> & {
  entry?: ContentEntry; name: ReactNode; specialAlly: boolean
}) {
  const action = useRef<HTMLButtonElement>(null)
  const lashunta = specialAlly && c.ancestry === 'Lashunta'
  const vesk = specialAlly && c.ancestry === 'Vesk'
  const pahtra = specialAlly && c.ancestry === 'Pahtra'
  const shirren = specialAlly && c.ancestry === 'Shirren'
  const active = lashunta ? !!c.lashuntaCreatureAlly : vesk || pahtra ? !!c.creatureAllyActive
    : shirren ? !!c.shirrenCreatureAllyActive : !!c.activeSpells?.includes('Summon Animal')
  const setActive = (next: boolean) => {
    if (lashunta && next && !c.lashuntaCreatureAllyChoice && !c.lashuntaCreatureAlly) {
      action.current?.click()
      return
    }
    const change = () => {
      if (lashunta) {
        save({ lashuntaCreatureAlly: next ? c.lashuntaCreatureAlly ?? c.lashuntaCreatureAllyChoice : undefined,
          ...(!next ? { lashuntaCreatureAllyChoice: c.lashuntaCreatureAlly,
            ...(c.mountedSummon?.startsWith('ally:') ? { mountedSummon: undefined } : {}) } : {}) })
      } else if (vesk || pahtra || shirren) {
        save({ ...(vesk || pahtra ? { creatureAllyActive: next } : { shirrenCreatureAllyActive: next }),
          ...(!next && (vesk && c.mountedSummon === 'ally:Caypin'
            || shirren && c.mountedSummon === 'ally:Emganat') ? { mountedSummon: undefined } : {}) })
      } else save(spellActiveChange(c, 'Summon Animal', next))
    }
    if (!next && specialAlly) confirmRemoval(`summoned ${lashunta ? c.lashuntaCreatureAlly : vesk ? 'Caypin' : pahtra ? 'Cat' : 'Kucharn'}`, change)
    else change()
  }
  const toggle = (label: string, disabled = false) => <input type="checkbox" aria-label={label} checked={active} disabled={disabled}
    onChange={event => setActive(event.target.checked)} />
  return <>{toggle('Summon Animal status')}{' '}{name}{' '}
    <ActiveSpellActions name="Summon Animal" entry={entry} actions="Three Actions" buttonRef={action}>
      {lashunta && <LashuntaAllyOptions c={c} save={save} confirmDismiss />}
      <label>{toggle('Summon Animal active', lashunta && !active && !c.lashuntaCreatureAllyChoice)} Active</label>
      {vesk && <SourceNote source="Caypin" note="GM approval required: caypin is a beast, not an animal, and Creature Ally's rank 5 spell normally permits creatures of level 5 or lower." />}
      {shirren && <SourceNote source="Emganat" note="GM approval required: kucharns do not have the animal trait required by Summon Animal." />}
    </ActiveSpellActions>
  </>
}

export function TailwindActions({ c, save, entry, rank, disabled }: Pick<SectionProps, 'c' | 'save'> & {
  entry: ContentEntry; rank: number; disabled?: boolean
}) {
  const active = !!c.activeSpells?.includes('Tailwind')
  return <ActiveSpellActions name="Tailwind" entry={entry} rank={rank}
    actions={typeof entry.data.actions === 'string' ? entry.data.actions : 'Two Actions'}>
    <label><input type="checkbox" aria-label="Tailwind active" checked={active}
      disabled={!active && disabled} onChange={event => save(spellActiveChange(c, 'Tailwind', event.target.checked))} /> Active</label>
  </ActiveSpellActions>
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

function ShieldActions({ c, entries, save, entry, rank, disabled }: SectionProps & {
  entry?: ContentEntry; rank: number; disabled?: boolean
}) {
  const active = isSpellActive(c, entries, 'Shield')
  return <ActiveSpellActions name="Shield" entry={entry} rank={rank} actions={typeof entry?.data.actions === 'string' ? entry.data.actions : 'Single Action'}>
    <label><input type="checkbox" aria-label="Raise Shield Cantrip (+1 AC)" checked={active}
      disabled={!active && (disabled || boneShieldActive(c))}
      onChange={event => save(spellActiveChange(c, 'Shield', event.target.checked))} /> Raise Shield Cantrip (+1 AC)</label>
  </ActiveSpellActions>
}

function EatFireActions({ c, save, entry, rank, disabled }: Pick<SectionProps, 'c' | 'save'> & {
  entry?: ContentEntry; rank: number; disabled?: boolean
}) {
  const active = !!c.activeSpells?.includes('Eat Fire')
  return <ActiveSpellActions name="Eat Fire" entry={entry} rank={rank} actions={typeof entry?.data.actions === 'string' ? entry.data.actions : 'Reaction'}>
    <label><input type="checkbox" aria-label="Eat Fire active" checked={active} disabled={!active && disabled}
      onChange={event => save(spellActiveChange(c, 'Eat Fire', event.target.checked))} /> Active</label>
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

export function DirgeLearnOptions({ options, onLearn, marked, showDamage }: { options: ContentEntry[]; onLearn: (entry: ContentEntry) => void; marked?: Set<string>; showDamage?: boolean }) {
  return <ul className="dirge-options">
    {options.map(entry => <li key={entry.id}>
      <button type="button" aria-label={`Learn ${entry.name}`} onClick={() => onLearn(entry)}>+</button>
      <EntryDescription name={entry.name} entry={entry} deferDetails />
      {' '}<small>{entry.systems.map(system => system.toUpperCase()).join(' / ')}</small>
      {showDamage && <> <small>{spellDamageLabel(entry)}</small></>}
      {marked?.has(entry.name.toLowerCase()) && <> <strong>School</strong></>}
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

function spellbookRankButton(book: string, rank: number, onOpen: (rank: number) => void) {
  const label = rank === 0 ? `Open ${book} cantrips` : `Open ${book} rank ${rank}`
  return <button type="button" className="dirge-rank-button" aria-label={label} title={label}
    aria-haspopup="dialog" onClick={() => onOpen(rank)}><DirgeIcon /></button>
}

export function DirgeRankButton({ rank, onOpen }: { rank: number; onOpen: (rank: number) => void }) {
  return spellbookRankButton('Dirge', rank, onOpen)
}

function SpellbookRankButton({ book, rank, onOpen }: {
  book: string; rank: number; onOpen: (rank: number) => void
}) {
  return spellbookRankButton(book, rank, onOpen)
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

function spellSave(save: string, dc?: number, entry?: ContentEntry, attackBonus?: number) {
  const savingThrow = dc !== undefined && /\b(?:Fortitude|Reflex|Will)\b/i.test(save) && !/\bDC\s+\d+/i.test(save)
    ? `${save} DC ${dc}` : save
  if (!entry || !spellResolution(entry).attack) return savingThrow
  const attack = `AC${attackBonus === undefined ? '' : `, ${signed(attackBonus)}`}`
  return savingThrow === '—' || /^(?:AC|Armor Class)$/i.test(savingThrow) ? attack : `${attack}; ${savingThrow}`
}

function SpellItem({ c, name, nameControl, entry, note, onRemove, active, onToggle, activeLabel, activeActions, children, inlineControls, effectControls, effectRank, rank, saveDC, attackBonus, actionControls, spellcastingModifier }: {
  c: Character
  name: string; entry?: ContentEntry; note?: ReactNode; onRemove?: () => void
  nameControl?: ReactNode
  active?: boolean; onToggle?: (active: boolean) => void
  activeLabel?: string
  activeActions?: string
  children?: ReactNode
  inlineControls?: ReactNode
  effectControls?: ReactNode
  effectRank?: number
  actionControls?: ReactNode
  rank: number
  saveDC?: number
  attackBonus?: number
  spellcastingModifier?: number
}) {
  const metadata = spellMetadata(entry, rank, c)
  const activeToggle = onToggle && <label><input type="checkbox" aria-label={`${name} active`} checked={!!active}
    onChange={(e) => onToggle(e.target.checked)} /> {activeLabel ?? 'Active'}</label>
  return (
    <li className="innate-spell-row">
      <div className="innate-spell-name">
        <div className="spell-title">{nameControl ?? <EntryDescription name={name} entry={entry} />}
          {onRemove && <button type="button" className="spell-remove" aria-label={`Remove ${name}`} title="Remove"
            onClick={() => confirmRemoval(`spell "${name}"`, onRemove)}>×</button>}
          {onToggle && name === 'Fly' ? <button type="button" className="spell-action-button"
            aria-label={active ? `Deactivate ${name}` : `Activate ${name}`} aria-pressed={!!active}
            onClick={() => onToggle(!active)}><ActionIcon actions={activeActions
              ?? (typeof entry?.data.actions === 'string' ? entry.data.actions : 'Two Actions')} showOther /></button>
            : onToggle ? <ActiveSpellActions name={name} entry={entry} actions={activeActions} rank={name === 'Oaken Resilience' ? effectRank : effectRank ?? rank}>
            {activeToggle}{effectControls}
          </ActiveSpellActions>           : actionControls ?? (!['Animal Feature', 'Untamed Shift', 'Untamed Form', 'Dinosaur Form', 'Pest Form',
            'Shield', 'Bone Shield', 'False Vitality', 'Canopy Crawler', 'Enlarge Companion', 'Apex Companion', 'Protect Companion', 'Spirit of the Beast',
            'Summon Undead', 'Marvelous Mount'].includes(name)
            && !(name === 'Animal Form' && activeFeatsNamed(c, 'Ancestral Form').length)
              && <SpellActions name={name} entry={entry} rank={rank} spellcastingModifier={spellcastingModifier} />)}{inlineControls}
          <PharasmaSpellBonus c={c} entry={entry} name={name} rank={rank} /></div>
        {name === 'Heal' && !!activeFeatsNamed(c, 'Guiding Heal').length && <SourceNote source="Guiding Heal"
          note="After using Guiding Heal, a one- or two-action heal grants its target +1 status to AC, saves, and attack rolls until the end of your next turn. Status bonuses do not stack." />}
        {note && <small>{note}</small>}
      </div>
      <span><small>Duration</small>{metadata.duration}{metadata.durationNote
        && <SourceNote source="Persistent Animal Feature" note={metadata.durationNote} inlineSource={false} />}</span>
      <span><small>Range</small>{metadata.range}</span>
      <span><small>Save</small>{spellSave(metadata.save, saveDC, entry, attackBonus)}</span>
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
  const save = name === 'Supercharge Prism' ? 'Reflex' : value('saving_throw', 'save', 'saving_throw_dc')
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
      : ['Athletic Rush', 'Tailwind', 'Animal Form', 'Dinosaur Form', 'Enduring Might', 'Speak with Plants', 'Speak with Stones', 'Gravity Weapon', 'Keen Smell', 'Animal Feature', "Hunter's Luck", 'One with Stone', 'Seek the Stars', 'Seek The Stars'].includes(name)
      || tracks && range === '—' ? 'Self'
      : /^\d+$/.test(range) ? Number(range) === 0 ? 'Touch' : `${range} feet` : range.replace(/^touch$/i, 'Touch'),
    save: save === '—' ? /\b(?:basic )?(?:Fortitude|Reflex|Will)(?= (?:saving throws?|saves?))/i.exec(entry?.description ?? '')?.[0] ?? save : save,
    targets: name === 'Beastmaster Trance' && getSettings().singleAnimalCompanion ? 'Your animal companion'
      : name === 'Supercharge Prism' ? '20-foot line'
      : name === 'Bramble Bush' ? '5-foot cube'
      : name === 'Magic Passage' ? `5-foot-wide, 10-foot-tall, ${rank >= 7 ? 20 : 10}-foot-deep section of wooden, plaster, or stone wall`
      : name === 'Pummeling Rubble' ? '15-foot cone'
      : name === 'Pulverizing Wake' ? '1 creature within reach'
      : name === 'Warning Stripes' ? 'Yourself or your animal companion'
      : name === 'Canopy Crawler' && rank >= 5 ? 'Yourself and your animal companion'
      : name === 'Mask of Terror' && rank >= 8 ? 'Up to 5 creatures'
      : ['Athletic Rush', 'Tailwind', 'Animal Form', 'Dinosaur Form', 'Enduring Might', 'Animal Feature', 'Gravity Weapon', 'Keen Smell', "Hunter's Luck", 'Speak with Plants', 'Speak with Stones', 'One with Stone', 'Seek the Stars', 'Seek The Stars'].includes(name)
      || targets === '—' && ['Sure Strike', 'True Strike', 'Vanishing Tracks'].includes(name) ? 'Self' : targets,
  }
}

function InnateSpellRow({ c, grant, note, active, onToggle, activeLabel, inlineControls, effectControls, effectRank, actionControls, children, saveDC, attackBonus, spellcastingModifier }: {
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
  attackBonus?: number
  spellcastingModifier?: number
}) {
  return <SpellItem c={c} name={grant.entry.name} entry={grant.entry} rank={grant.rank} note={note}
    active={active} onToggle={onToggle} activeLabel={activeLabel} inlineControls={inlineControls} effectControls={effectControls} effectRank={effectRank} actionControls={actionControls} saveDC={saveDC} attackBonus={attackBonus} spellcastingModifier={spellcastingModifier}>
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
  const slotIncreaseNotesByRank = useMemo(() => spellSlotIncreaseNotes(c, entries), [c, entries])
  if (!paradox || !casting?.ability || !baseSlots) return null
  const castingModifier = abilityMod(c.abilities[casting.ability])
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
      const count = (slots[rank] ?? 0) + Number(rank === 0 && benefits.cantrip)
      const selectedCount = known.filter(slot => slot.rank === rank && (slot.granted || slot.value)).length
      const title = rank === 0 ? `Cantrips (Heightened Level ${Math.ceil(c.level / 2)})`
        : `Spell Rank ${rank}`
      const sourceLabel = rank === 0 ? 'Cantrip slots' : `Rank ${rank} slots`
      return <section className="spell-slot-group" key={rank}>
        <h5>{title} ({spellSlotCount(selectedCount, count)})
          {slotIncreaseNotesByRank.get(rank)?.length
            && <SourceNote source={sourceLabel} note={slotIncreaseNotesByRank.get(rank)!.join('; ')} />}</h5>
        <SpellColumns />
        <ul>{known.filter(slot => slot.rank === rank).map((slot, index) => ({ slot, index }))
          .sort((a, b) => compareSelectedSpells(a.slot.entry?.name ?? a.slot.granted ?? a.slot.value,
            b.slot.entry?.name ?? b.slot.granted ?? b.slot.value))
          .map(({ slot, index }) => {
          const choices = uniqueSpellVariants([
            ...(slot.entry && options[rank].some(entry => entry.id === slot.entry?.id) ? [slot.entry] : []),
            ...options[rank].filter(entry => !known.some(other => other.key !== slot.key
              && other.rank === rank && other.valid && other.entry?.name === entry.name)
              && entry.id !== slot.entry?.id),
          ], entry => [...entry.systems].sort().join(','))
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
                  onClear={() => {
                    const repertoire = { ...sc.repertoire, [slot.key]: '' }
                    if (slot.entry) save({ spellcasting: { ...sc, repertoire }, ...spellRemovalChange(c, slot.entry.name) })
                    else setSc({ repertoire })
                  }} />
                : <SearchableSelect aria-label={`Witchwarper ${rank === 0 ? 'cantrip' : `rank ${rank} spell`} ${index + 1}`}
                  value={value} alwaysSearchable primaryDetails optionLevel={choice => spellIndex.byId.get(choice)?.level}
                  optionSpell={choice => spellIndex.byId.get(choice) ?? spellIndex.byName.get(choice)} renderDetails={choice => {
                    const entry = spellIndex.byId.get(choice) ?? spellIndex.byName.get(choice)
                    return entry && <span className="picker-spell-name"><EntryDescription name={entry.name} entry={entry} deferDetails />
                      {' '}<small>{entry.systems.map(system => system.toUpperCase()).join(' / ')}</small></span>
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
              {slot.entry && (slot.entry.name === 'Shield'
                ? <ShieldActions c={c} entries={entries} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : slot.entry.name === 'Eat Fire'
                ? <EatFireActions c={c} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : slot.entry.name === 'Bone Shield'
                ? <BoneShieldActions c={c} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : slot.entry.name === 'Summon Undead'
                ? <SummonUndeadActions c={c} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : slot.entry.name === 'Marvelous Mount'
                ? <MarvelousMountActions c={c} save={save} entry={slot.entry} disabled={!slot.valid} />
                : ['Summon Fiend', 'Summon Celestial'].includes(slot.entry.name)
                ? <SummonFiendActions c={c} entries={entries} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : slot.entry.name === 'Summon Plant or Fungus'
                ? <SummonPlantActions c={c} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : slot.entry.name === 'False Vitality'
                ? <FalseVitalityActions c={c} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : slot.entry.name === 'Tailwind'
                ? <TailwindActions c={c} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : slot.entry.name === 'Pest Form'
                ? <PestFormActions c={c} save={save} entry={slot.entry} rank={castRank} disabled={!slot.valid} />
                : <SpellActions name={slot.entry.name} entry={slot.entry} rank={rank === 0 ? Math.ceil(c.level / 2) : castRank}
                  spellcastingModifier={castingModifier} />)}
              {slot.entry && slot.valid && <PharasmaSpellBonus c={c} entry={slot.entry} name={slot.entry.name} rank={rank === 0 ? Math.ceil(c.level / 2) : castRank} />}
            </div>
            <span><small>Duration</small>{metadata.duration}</span>
            <span><small>Range</small>{metadata.range}</span>
            <span><small>Save</small>{spellSave(metadata.save, dc, slot.entry, dc === undefined ? undefined : dc - 10)}</span>
            <span><small>Area/Targets</small>{metadata.targets}</span>
            {(slot.value || slot.granted) && !slot.valid
              && <small className="innate-spell-controls" role="status">Selected repertoire spell unavailable for your current spell list or rank.</small>}
          </li>
        })}</ul>
      </section>
    })}
  </div>
}

function investigatorTricksterAceSlots(c: Character, entries: ContentEntry[]) {
  if (!c.systems.includes('pf2e') || c.className !== 'Investigator') return []
  return c.feats.flatMap((feat, index) => feat.name === "Trickster's Ace" && featTakenLevel(feat) <= c.level
    ? [{ feat, index, options: featSpellOptions(c, entries, feat) ?? [] }] : [])
}

function loanerSpellSlots(c: Character, entries: ContentEntry[]) {
  if (!c.systems.includes('pf2e') || loanerSpellIsSlot(c)) return []
  const traditions = classSpellcasting(c, entries)?.traditions.map(tradition => tradition.toLowerCase()) ?? []
  return c.feats.flatMap((feat, index) => feat.name === 'Loaner Spell' && featTakenLevel(feat) <= c.level
    ? [{ feat, index, options: (featSpellOptions(c, entries, feat) ?? []).filter(spell => !traditions.length
      || String(spell.data.tradition ?? '').toLowerCase().split(/,\s*/).some(value => traditions.includes(value))
      || spell.name === feat.choice) }] : [])
}

function spellSummaryData(c: Character, entries: ContentEntry[]) {
  const spells = (c.spells ?? []).map(spell => spell.name.toLowerCase() === 'goodberry'
    ? { ...spell, name: 'Cornucopia', entryId: entries.find(entry => entry.kind === 'spell' && !entry.deleted
      && entry.name === 'Cornucopia' && entry.systems.some(system => c.systems.includes(system)))?.id ?? spell.entryId } : spell)
  const granted = grantedWardenSpells(c, entries)
  const featSpells = grantedFeatSpells(c, entries)
  const special = featSpells.filter(grant => grant.rule.kind === 'feat' && grant.source !== 'Heroic Presence')
  const innate = featSpells.filter(grant => grant.rule.kind === 'innate' || grant.source === 'Heroic Presence')
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name) || a.source.localeCompare(b.source))
  const { spells: focus, points: focusPoints } = focusSpells(c, entries)
  const manualSpells = spells.filter((s) => !granted.some((g) => g.id === s.entryId || g.name === s.name)
    && !focus.some(grant => grant.name === s.name))
  return { spells, granted, featSpells, innate, special, focus, focusPoints, manualSpells, items: itemSpells(c, entries) }
}

export function automatedSpellStatusControls({ c, entries, save }: SectionProps) {
  const data = spellSummaryData(c, entries)
  const names = new Set([
    ...data.spells.map(spell => spell.name),
    ...data.granted.map(spell => spell.name),
    ...data.featSpells.map(spell => spell.entry.name),
    ...data.focus.map(spell => spell.name),
    ...data.items.map(spell => spell.name),
    ...c.activeSpells ?? [],
  ])
  const spellStatusName = (name: string) => {
    const entry = entries.find(candidate => candidate.kind === 'spell' && !candidate.deleted
      && candidate.name.toLowerCase() === name.toLowerCase() && candidate.systems.some(system => c.systems.includes(system)))
    return entry ? <EntryDescription name={name} entry={entry} entries={entries} character={c} /> : name
  }
  const statusElement = (name: string, toggle: ReactNode) => {
    const entry = entries.find(candidate => candidate.kind === 'spell' && !candidate.deleted
      && candidate.name.toLowerCase() === name.toLowerCase() && candidate.systems.some(system => c.systems.includes(system)))
    const actions = name === 'Heroism' ? 'Two Actions' : typeof entry?.data.actions === 'string' ? entry.data.actions : ''
    return <>{toggle}{' '}{spellStatusName(name)}
      {name === 'Force-FieldPGA' && <label> Resistance type{' '}
        <select aria-label="Force-FieldPGA resistance" value={c.forceFieldPgaResistance ?? ''} onChange={event => {
          const value = FORCE_FIELD_PGA_RESISTANCE_TYPES.find(type => type === event.target.value)
          save({ forceFieldPgaResistance: value })
        }}>
          <option value="">Choose damage type</option>
          {FORCE_FIELD_PGA_RESISTANCE_TYPES.map(type =>
            <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
        </select>
      </label>}
      {name === 'Resist Energy' && <label> Resistance type{' '}
        <select aria-label="Resist Energy type" value={c.resistEnergyType ?? ''} onChange={event => {
          save({ resistEnergyType: RESIST_ENERGY_TYPES.find(type => type === event.target.value) })
        }}>
          <option value="">Choose damage type</option>
          {RESIST_ENERGY_TYPES.map(type => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
        </select>
      </label>}
      {name === 'Animal Feature'
        ? <> <SpellEffectActions c={c} entries={entries} save={save} entry={entry} name="Animal Feature" rank={Math.ceil(c.level / 2)} /></>
        : actions && <> <ActiveSpellActions name={name} entry={entry} actions={actions}>{toggle}</ActiveSpellActions></>}
    </>
  }
  const magicHideTargets = [...(c.companions ?? []).map(companion => ({ id: companion.id, name: companion.name || companion.type })),
    ...(hasSwarmkeeperSwarm(c) ? [{ id: SWARM_TARGET_ID, name: 'Swarm' }] : [])]
  const controls = STATUS_TRACKED_SPELL_EFFECTS.filter(name => names.has(name)).map(name => ({ name, element: statusElement(name,
    <><input type="checkbox" aria-label={`${name} status`} checked={name === 'Magic Hide' ? isMagicHideActive(c, entries) : !!c.activeSpells?.includes(name)}
      onChange={event => save(name === 'Magic Hide' ? magicHideChange(c, event.target.checked) : spellActiveChange(c, name, event.target.checked))} />
    {name === 'Magic Hide' && magicHideTargets.length > 1 && <label>Target{' '}
      <select aria-label="Magic Hide target" value={magicHideTarget(c) ?? ''} onChange={event => {
        if (magicHideTargets.some(target => target.id === event.target.value)) save({ magicHideCompanionId: event.target.value })
      }}>{magicHideTargets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select>
    </label>}</>) }))
  if (names.has('Summon Animal')) {
    const specialAlly = c.systems.includes('sf2e') && ['Vesk', 'Shirren', 'Lashunta', 'Pahtra'].includes(c.ancestry ?? '')
      && data.featSpells.some(grant => grant.source === 'Creature Ally' && grant.entry.name === 'Summon Animal')
    const entry = entries.find(candidate => candidate.kind === 'spell' && !candidate.deleted
      && candidate.name === 'Summon Animal' && candidate.systems.some(system => c.systems.includes(system)))
    controls.push({ name: 'Summon Animal', element: <SummonAnimalStatus c={c} save={save} entry={entry}
      name={spellStatusName('Summon Animal')} specialAlly={specialAlly} /> })
  }
  if (knowsSpell(c, entries, 'Shield') || c.activeSpells?.includes('Shield')) {
    const active = isSpellActive(c, entries, 'Shield')
    controls.push({ name: 'Shield', element: statusElement('Shield',
      <input type="checkbox" aria-label="Shield status" checked={active} disabled={!active && boneShieldActive(c)}
        onChange={event => save(spellActiveChange(c, 'Shield', event.target.checked))} />) })
  }
  if (names.has('Bone Shield')) controls.push({ name: 'Bone Shield', element: statusElement('Bone Shield',
    <input type="checkbox" aria-label="Bone Shield status" checked={boneShieldActive(c)}
      onChange={event => save(boneShieldChange(c, event.target.checked))} />) })
  if (names.has('False Vitality')) {
    const availableRanks = [
      ...data.spells.filter(spell => spell.name === 'False Vitality').map(spell => spell.rank),
      ...data.featSpells.filter(spell => spell.entry.name === 'False Vitality').map(spell => spell.rank),
      ...data.items.filter(spell => spell.name === 'False Vitality').map(spell => spell.rank),
    ].filter((rank): rank is number => Number.isInteger(rank) && rank >= 2 && rank <= 10)
    const rank = c.falseVitalityRank ?? Math.max(0, ...availableRanks)
    const active = c.activeSpells?.includes('False Vitality') ?? false
    const valid = Number.isInteger(rank) && rank >= 2 && rank <= 10
    controls.push({ name: 'False Vitality', element: statusElement('False Vitality',
      <input type="checkbox" aria-label="False Vitality status" checked={active} disabled={!active && !valid}
        onChange={event => {
          const next = event.target.checked
          if (next && !valid) return
          save({ ...spellActiveChange(c, 'False Vitality', next), falseVitalityRank: next ? rank : undefined })
        }} />) })
  }
  return controls
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
  const { manualSpells, granted, featSpells, focus, innate, special, items } = data ?? spellSummaryData(c, entries)
  const baseSlots = classSpellSlots(c)
  const benefits = familiarSpellBenefits(c, entries, baseSlots ?? c.spellcasting?.slots ?? {})
  const witchwarper = witchwarperParadox(c)
  const slots = classRepertoireRows(c) ?? (classSpellcasting(c, entries)?.traditions.length ? c.spellcasting?.slots : undefined)
  const extraSlots = baseSlots !== undefined || c.className === 'Technomancer' ? classExtraSlots(c, entries) : []
  const choices = witchwarper ? witchwarperRepertoireSlots(c, benefits.cantrip).map(slot => !!(slot.granted || slot.value))
    : slots ? Array.from({ length: 11 }, (_, rank) => {
      const baseCount = Math.max(0, Math.min(20, Math.trunc(Number(slots[rank]) || 0)))
      const extras = extraSlots.filter(slot => slot.rank === rank)
      const manualCacheCount = baseSlots === undefined ? extras.filter(slot => slot.source === 'Cache Caster').length : 0
      const count = baseCount + manualCacheCount + Number(rank === 0 && benefits.cantrip) + Number(rank === benefits.batteryRank)
      const normalCount = baseCount - extras.length + manualCacheCount
      return Array.from({ length: count }, (_, index) => {
        const extra = extras[index - (count - extras.length)]
        const key = extra?.key ?? (index === normalCount && rank === 0 && benefits.cantrip
          ? 'familiar-cantrip-connection' : index === normalCount && rank === benefits.batteryRank
            ? `familiar-spell-battery:${rank}` : `${rank}:${index}`)
        return extra?.spell ? true : !!c.spellcasting?.prepared?.[key]
      })
    }).flat() : []
  const otherSpells = new Set([...granted.map(spell => spell.name), ...focus.map(spell => spell.name)]).size
    + groupedInnateSpells(c, innate).length + special.length + items.length
  const tricksterAceSlots = investigatorTricksterAceSlots(c, entries)
  const missingTricksterAceChoices = tricksterAceSlots.filter(slot =>
    !slot.options.some(option => option.name === slot.feat.choice)).length
  const missingLoanerSpellChoices = loanerSpellSlots(c, entries).filter(slot =>
    !slot.options.some(option => option.name === slot.feat.choice)).length
  const esotericaSlots = investigatorMethodologies(c, entries).includes('Esoterica') ? 2 : 0
  const selectedEsotericaSlots = featSpells.filter(grant => grant.source === 'Esoterica').length
  const missingEsotericaSlots = Math.max(0, esotericaSlots - selectedEsotericaSlots)
  const featChoices = c.feats.filter(feat => featTakenLevel(feat) <= c.level
    && (feat.name === 'First World Magic' || ['Psychic Talent', 'Psychic Master', 'Psychic Mastery', 'Psychic Paragon'].includes(feat.name) && c.systems.includes('sf2e')))
  const missingFeatChoices = featChoices.filter(feat => !innate.some(grant => grant.source === feat.name && grant.entry.name === feat.choice)).length
  const minorSlots = activeFeatsNamed(c, 'Minor Magic').length ? 2 : 0
  const minorSelected = minorSlots ? minorMagicSpells(c, entries).length : 0
  const selected = (slots || witchwarper ? choices.filter(Boolean).length : manualSpells.length) + otherSpells + minorSelected
  const total = choices.length + otherSpells + missingFeatChoices + minorSlots + missingEsotericaSlots
    + missingTricksterAceChoices + missingLoanerSpellChoices
  return <summary className="character-section-summary">
    <strong>Spells</strong>
    <span>{selected < total ? `${selected}/${total}` : selected} spells
      {c.className === 'Champion' && c.level >= 1 && !focus.some(spell => spell.source === 'Devotion Spells') && ' · Choose devotion spell'}</span>
  </summary>
}

type SpellData = ReturnType<typeof spellSummaryData>
export function spellCategoryAvailability(c: Character, entries: ContentEntry[], data: SpellData) {
  const { granted, focus, focusPoints, innate, special, items, manualSpells } = data
  const casting = classSpellcasting(c, entries)
  const focusOnlyClass = ['Champion', 'Monk', 'Ranger'].includes(c.className ?? '')
  const heritage = c.heritage?.toLowerCase() ?? ''
  const hasMinorMagic = activeFeatsNamed(c, 'Minor Magic').length > 0
  const hasLoanerSpell = loanerSpellSlots(c, entries).length > 0
  const class_ = hasLoanerSpell || classSpellSlots(c) !== undefined || !!witchwarperParadox(c)
    || manualSpells.length > 0 || hasMinorMagic
    || !focusOnlyClass && (!!casting?.traditions.length
      || Object.values(c.spellcasting?.slots ?? {}).some(count => count > 0))
  const focusAvailable = focus.length > 0 || granted.length > 0 || focusPoints > 0
    || (c.className === 'Champion' && c.level >= 1) || !!activeFeatsNamed(c, 'Floral Restoration').length
    || !!activeFeatsNamed(c, 'Desperate Warden').length
  const investigatorClassAvailable = c.className === 'Investigator' && c.systems.includes('pf2e')
    && (investigatorMethodologies(c, entries).includes('Esoterica') || investigatorTricksterAceSlots(c, entries).length > 0)
  const innateAvailable = innate.some(grant => grant.source !== 'Esoterica') || c.heritage === 'Mage Automaton' && c.level >= 1
    || c.systems.includes('pf2e') && c.level >= 1 && ['fey-touched gnome', 'wellspring gnome'].includes(heritage)
    || !!activeFeatsNamed(c, 'First World Magic').length
    || c.systems.includes('sf2e') && ['Psychic Talent', 'Psychic Master', 'Psychic Mastery', 'Psychic Paragon'].some(name => activeFeatsNamed(c, name).length > 0)
  return { class: class_ || investigatorClassAvailable, focus: focusAvailable, innate: innateAvailable,
    feat: special.some(grant => grant.source !== "Trickster's Ace" && grant.source !== 'Loaner Spell'), items: items.length > 0,
    rituals: characterRituals(c, entries).ritualNames.length > 0 }
}

function ApparitionAttunement({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  const [catalog, setCatalog] = useState<Apparition[]>()
  const [error, setError] = useState('')
  useEffect(() => {
    void fetch(`${import.meta.env.BASE_URL}data/aon-apparitions.json`).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json() as Promise<Apparition[]>
    }).then(data => {
      if (!Array.isArray(data)) throw new Error('Invalid apparition catalog')
      setCatalog(data)
    }).catch((failure: unknown) => setError(`Unable to load apparitions: ${failure instanceof Error ? failure.message : String(failure)}`))
  }, [])
  const attuned = attunedApparitions(c)
  const limit = apparitionLimit(c)
  const primary = primaryApparition(c)
  const attune = (index: number, id: string) => {
    const next = [...attuned]
    const chosen = catalog?.find(apparition => apparition.id === id)
    if (chosen) next[index] = chosen
    else next.splice(index, 1)
    const list = next.filter(Boolean)
    save({ attunedApparitions: list, primaryApparition: list.some(apparition => apparition.id === primary?.id) ? primary?.id : list[0]?.id })
  }
  return <section className="spell-slot-group">
    <h6>Apparition Attunement</h6>
    {error && <p role="alert">{error}</p>}
    {Array.from({ length: limit }, (_, index) => {
      const current = attuned[index]
      return <label key={index}>Attuned apparition {index + 1}{' '}
        <select aria-label={`Attuned apparition ${index + 1}`} value={current?.id ?? ''}
          disabled={!catalog || index > attuned.length}
          onChange={event => {
            const id = event.target.value
            if (current && current.id !== id) confirmRemoval(`apparition "${current.name}"`, () => attune(index, id))
            else attune(index, id)
          }}>
          <option value="">{catalog ? 'Choose apparition...' : 'Loading...'}</option>
          {current && !catalog?.some(apparition => apparition.id === current.id) && <option value={current.id}>{current.name}</option>}
          {catalog?.filter(apparition => apparition.id === current?.id || !attuned.some(other => other.id === apparition.id)).map(apparition =>
            <option key={apparition.id} value={apparition.id}>{apparition.name}</option>)}
        </select>
      </label>
    })}
    {attuned.length > 1 && <label>Primary apparition{' '}
      <select aria-label="Primary apparition" value={primary?.id ?? ''} onChange={event => save({ primaryApparition: event.target.value })}>
        {attuned.map(apparition => <option key={apparition.id} value={apparition.id}>{apparition.name}</option>)}
      </select>
    </label>}
    {attuned.map(apparition => <small key={apparition.id}>{apparition.name}: {apparition.skills.join(', ')}
      {apparition.id === primary?.id && apparition.vessel ? ` · Vessel spell: ${apparition.vessel}` : ''}</small>)}
  </section>
}

export function AnimistApparitionSpells({ c, entries, save }: SectionProps) {
  const slots = animistApparitionSlots(c)
  if (!Object.keys(slots).length) return null
  const casting: NonNullable<Character['spellcasting']> = {
    ...c.spellcasting,
    ability: c.spellcasting?.ability ?? 'wis',
    tradition: c.spellcasting?.tradition ?? 'Divine',
    rank: c.spellcasting?.rank ?? 1,
    slots: classSpellSlots(c) ?? c.spellcasting?.slots ?? {},
  }
  const availableSpells = entries.filter(entry => entry.kind === 'spell' && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system)))
  const spellById = new Map(availableSpells.map(entry => [entry.id, entry]))
  const spellByName = new Map(availableSpells.map(entry => [entry.name, entry]))
  const highestRankCastable = Math.max(...Object.keys(slots).map(Number))
  const repertoire = casting.apparitionRepertoire ?? []
  const granted = attunedApparitions(c).flatMap(apparition => apparition.spells
    .filter(spell => spell.rank <= highestRankCastable).map(spell => spellByName.get(spell.name))).filter((entry): entry is ContentEntry => !!entry)
  const grantedIds = new Set(granted.map(entry => entry.id))
  const repertoireEntries = [...new Map([...granted, ...[...new Set(repertoire)].flatMap(value => {
    const entry = spellById.get(value) ?? spellByName.get(value)
    return entry ? [entry] : []
  })].map(entry => [entry.id, entry])).values()]
  const repertoireIds = new Set(repertoireEntries.map(entry => entry.id))
  const cantripLimit = slots[0] ?? 0
  const cantripCount = repertoireEntries.filter(entry => entry.traits.some(trait => trait.toLowerCase() === 'cantrip')).length
  const highestRank = Math.max(...Object.keys(slots).map(Number))
  const addOptions = availableSpells.filter(entry => !repertoireIds.has(entry.id)
    && (entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
      ? cantripCount < cantripLimit : entry.level <= highestRank))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const castAbility = classSpellcasting(c, entries)?.ability
  const update = (patch: Partial<NonNullable<Character['spellcasting']>>) =>
    save({ spellcasting: { ...casting, ...patch } })
  const addSpell = (id: string) => {
    if (!addOptions.some(entry => entry.id === id)) return
    update({ apparitionRepertoire: [...new Set([...repertoire, id])] })
  }
  const removeSpell = (entry: ContentEntry) => {
    const apparitionSlots = { ...casting.apparitionSlots }
    for (const [key, value] of Object.entries(apparitionSlots)) {
      if (value === entry.id || value === entry.name) delete apparitionSlots[key]
    }
    update({ apparitionRepertoire: repertoire.filter(value => value !== entry.id && value !== entry.name), apparitionSlots })
  }
  const castSlots = Object.entries(slots).filter(([rank]) => Number(rank) > 0)
  return <section className="class-spell-slots">
    <h5>Apparition Spellcasting</h5>
    <ApparitionAttunement c={c} save={save} />
    {(casting.apparitionSpentSlots?.length ?? 0) > 0 && <div className="row">
      <button type="button" aria-label="Reset apparition spell slots"
        title="Restore apparition spell slots during daily preparations."
        onClick={() => update({ apparitionSpentSlots: [] })}>Reset slots</button>
    </div>}
    <section className="spell-slot-group">
      <h6>Apparition Spell Repertoire</h6>
      <SearchableSelect aria-label="Add apparition spell" value="" optionCount={addOptions.length} alwaysSearchable
        defaultSortOrder="level-desc" optionLevel={value => spellById.get(value)?.level}
        optionSpell={value => spellById.get(value)}
        renderDetails={value => {
          const entry = spellById.get(value)
          return entry && <EntryDescription name={entry.name} entry={entry} entries={entries} character={c}
            buttonLabel="Details" className="picker-details" deferDetails />
        }}
        onChange={event => addSpell(event.target.value)}>
        <option value="">Add apparition spell...</option>
        {addOptions.map(entry => <option key={entry.id} value={entry.id}>{entry.name} (Rank {entry.level})</option>)}
      </SearchableSelect>
      <ul>{repertoireEntries.map(entry => <li className="spellbook-row" key={entry.id}>
        <div className="spellbook-slot">
          <EntryDescription name={entry.name} entry={entry} entries={entries} character={c} />
        </div>
        <span><small>Spell</small>{entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
          ? `Cantrip (Heightened Level ${Math.ceil(c.level / 2)})` : `Rank ${entry.level}`}</span>
        {!grantedIds.has(entry.id) && <button type="button" className="spell-remove" aria-label={`Remove apparition spell ${entry.name}`}
          onClick={() => confirmRemoval(`apparition spell "${entry.name}"`, () => removeSpell(entry))}>×</button>}
      </li>)}</ul>
    </section>
    {castSlots.map(([rankText, count]) => {
      const rank = Number(rankText)
      const options = repertoireEntries.filter(entry => !entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
        && entry.level <= rank)
      return <section className="spell-slot-group" key={rank}>
        <h6>Apparition Spell Rank {rank}</h6>
        <SpellColumns />
        <ul>{Array.from({ length: count }, (_, index) => {
          const slotKey = `apparition:${rank}:${index}`
          const selectedValue = casting.apparitionSlots?.[slotKey] ?? ''
          const selectedEntry = spellById.get(selectedValue) ?? spellByName.get(selectedValue)
          const valid = options.some(entry => entry.id === selectedValue || entry.name === selectedValue)
          const spent = casting.apparitionSpentSlots?.includes(slotKey) ?? false
          const selectSpell = (value: string) => {
            if (value && !options.some(entry => entry.id === value)) return
            const apparitionSlots = { ...casting.apparitionSlots }
            if (value) apparitionSlots[slotKey] = value
            else delete apparitionSlots[slotKey]
            update({ apparitionSlots })
          }
          return <li className="spellbook-row" key={slotKey}>
            <div className="spellbook-slot">
              <button type="button" disabled={!valid || spent} aria-label={`Cast apparition spell rank ${rank} slot ${index + 1}`}
                onClick={() => update({ apparitionSpentSlots: [...new Set([...(casting.apparitionSpentSlots ?? []), slotKey])] })}>
                Cast
              </button>
              {selectedValue
                ? <SelectedSlotSpell name={selectedEntry?.name ?? selectedValue} entry={selectedEntry} disabled={spent}
                  heightened={selectedEntry ? Math.max(0, rank - selectedEntry.level) : 0}
                  onClear={() => confirmRemoval(`apparition spell slot "${selectedEntry?.name ?? selectedValue}"`,
                    () => selectSpell(''))} />
                : <SearchableSelect aria-label={`Apparition spell rank ${rank} slot ${index + 1}`} value=""
                  optionCount={options.length} alwaysSearchable primaryDetails defaultSortOrder="level-desc"
                  optionLevel={value => spellById.get(value)?.level}
                  optionSpell={value => spellById.get(value)}
                  renderDetails={value => {
                    const entry = spellById.get(value)
                    return entry && <EntryDescription name={entry.name} entry={entry} entries={entries}
                      buttonLabel="Details" className="picker-details" deferDetails />
                  }}
                  onChange={event => selectSpell(event.target.value)}>
                  <option value="">Not Selected</option>
                  {options.map(entry => <option key={entry.id} value={entry.id}>{entry.name}
                    {rank > entry.level ? ` (+${rank - entry.level})` : ''}</option>)}
                </SearchableSelect>}
              {selectedEntry && <SpellActions name={selectedEntry.name} entry={selectedEntry} rank={rank}
                spellcastingModifier={castAbility ? abilityMod(c.abilities[castAbility]) : undefined} />}
              {spent && <small role="status">Spent</small>}
            </div>
            <span><small>Spell</small>{selectedEntry?.name ?? (selectedValue ? `${selectedValue} (unavailable)` : '—')}</span>
            <span><small>Rank</small>{rank}</span>
            <span><small>Range</small>{selectedEntry ? spellMetadata(selectedEntry, rank, c).range : '—'}</span>
            <span><small>Save</small>{selectedEntry ? spellSave(spellMetadata(selectedEntry, rank, c).save,
              spellDifficultyClass(c, entries)) : '—'}</span>
            <span><small>Area/Targets</small>{selectedEntry ? spellMetadata(selectedEntry, rank, c).targets : '—'}</span>
          </li>
        })}</ul>
      </section>
    })}
  </section>
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
  const [bookOpen, setBookOpen] = useState(false)
  const [bookSource, setBookSource] = useState<'Dirge' | 'Wizard' | 'Magus' | 'Witch' | 'Technomancer'>(
    c.className === 'Necromancer' ? 'Dirge' : c.className === 'Magus' ? 'Magus'
      : c.className === 'Witch' ? 'Witch' : c.className === 'Technomancer' ? 'Technomancer' : 'Wizard')
  const [bookRank, setBookRank] = useState(0)
  const [bookSlotKey, setBookSlotKey] = useState<string>()
  const [bookQuery, setBookQuery] = useState('')
  const [bookTrait, setBookTrait] = useState('all')
  const [bookSystem, setBookSystem] = useState<GearSystem>('both')
  const [bookSort, setBookSort] = useState<PickerSortOrder>('name')
  const bookDialog = useRef<HTMLDialogElement>(null)
  const bookTitleId = useId()
  const casting = classSpellcasting(c, entries)
  const intensified = intensifiedElementDamage(c, entries)
  const automaticSlots = classSpellSlots(c)
  const witchwarper = witchwarperParadox(c)
  const avengerCastingClass = avengerEldritchCastingClass(c, entries)
  const druid = c.className === 'Druid' && automaticSlots !== undefined
  const necromancer = c.className === 'Necromancer'
  const wizard = c.className === 'Wizard' && c.systems.includes('pf2e')
  const avengerCleric = !!avengerClericSpellSlots(c, entries)
  const magus = c.className === 'Magus' && c.systems.includes('pf2e')
  const witch = c.className === 'Witch' && c.systems.includes('pf2e')
  const technomancer = c.className === 'Technomancer' && c.systems.includes('sf2e')
  const bard = automaticSlots !== undefined && isSpontaneousClass(c)
  const bloodrager = c.className === 'Barbarian' && c.systems.includes('pf2e')
    && activeFeatsNamed(c, 'Bloodrager Dedication').some(feat => feat.choice === 'Arcane' || feat.choice === 'Divine')
  const warrior = c.className === 'Champion' ? activeFeatsNamed(c, 'Divine Warrior')[0]
    : c.className === 'Ranger' ? activeFeatsNamed(c, 'Primal Warrior')[0] : undefined
  const extraSlots = automaticSlots !== undefined || technomancer ? classExtraSlots(c, entries) : []
  const avengerTraditionSwitch = !avengerCastingClass && !!c.spellcasting && rogueRackets(c, entries).includes('Avenger')
    && /^(occult|divine)$/i.test(c.spellcasting.tradition)
  const traditions = warrior ? [warrior.name === 'Divine Warrior' ? 'Divine' : 'Primal']
    : avengerTraditionSwitch ? ['Occult', 'Divine'] : casting?.traditions ?? []
  const sc: Character['spellcasting'] = automaticSlots ? { ...c.spellcasting,
    ability: casting?.ability ?? c.spellcasting?.ability ?? 'int',
    tradition: traditions.length === 1 ? traditions[0] : c.spellcasting?.tradition ?? traditions[0] ?? '',
    rank: casting?.rank ?? c.spellcasting?.rank ?? 1, slots: classRepertoireRows(c) ?? automaticSlots }
    : c.spellcasting ?? (casting && avengerCastingClass ? {
      ability: casting.ability ?? 'int', tradition: traditions.length === 1 ? traditions[0] : '', rank: casting.rank, slots: {},
    } : undefined)
  const benefits = familiarSpellBenefits(c, entries, automaticSlots ?? sc?.slots ?? {})
  const wizardSpellbookSlots = wizardArchetypeSpellbookChoices(c, Number(benefits.cantrip))
  const wizardBookUser = wizard || technomancer || wizardSpellbookSlots.length > 0
  const preparedClass = ['Animist', 'Cleric', 'Druid', 'Magus', 'Necromancer', 'Technomancer', 'Witch', 'Wizard']
    .includes(c.className ?? '') || wizardSpellbookSlots.length > 0 || avengerCleric
  const systemsKey = c.systems.join(',')
  const spellIndex = useMemo(() => {
    const systems = systemsKey.split(',')
    const spells = entries.filter(entry => entry.kind === 'spell' && !entry.deleted
      && entry.systems.some(system => systems.includes(system)))
    const byId = new Map<string, ContentEntry>()
    const byName = new Map<string, ContentEntry>()
    for (const spell of spells) {
      if (!byId.has(spell.id)) byId.set(spell.id, spell)
      if (!byName.has(spell.name)) byName.set(spell.name, spell)
    }
    return { spells, byId, byName }
  }, [entries, systemsKey])
  const spellEntry = (name: string, id?: string) => id ? spellIndex.byId.get(id) : spellIndex.byName.get(name)
  const arcaneBookOptions = useMemo(() => bookOpen && bookSource !== 'Dirge' && bookSource !== 'Witch' ? uniqueSpellVariants(
    arcaneSpellbookOptions(c, spellIndex.spells, bookRank, bookSource === 'Technomancer' ? 'sf2e' : 'pf2e'),
    entry => [...entry.systems].sort().join(',')) : [],
    [c, spellIndex, bookRank, bookSource, bookOpen])
  const programmedSpellEntries = useMemo(() => technomancer && c.technomancerProgrammingLanguage
    ? TECHNOMANCER_LANGUAGE_RULES[c.technomancerProgrammingLanguage].spellCache.flatMap(name => {
      const entry = spellIndex.spells.find(spell => spell.systems.includes('sf2e')
        && spell.name.toLowerCase() === name.toLowerCase())
      return entry ? [entry] : []
    }) : [], [technomancer, c.technomancerProgrammingLanguage, spellIndex])
  const programmedSpellNames = useMemo(() => new Set(programmedSpellEntries.map(entry => entry.name.toLowerCase())),
    [programmedSpellEntries])
  const selectedGrantNames = useMemo(() => selectedGrantedSpellNames(c, entries), [c, entries])
  const preventDuplicateSpells = getSettings().uniqueInnateSpellChoices
  const knownArcaneSpells = new Set([
    ...(c.spells ?? []).map(spell => spell.name.toLowerCase()),
    ...programmedSpellNames,
    ...(preventDuplicateSpells ? selectedGrantNames : []),
  ])
  const rankedArcaneBookOptions = arcaneBookOptions.filter(entry => (bookRank === 0
    ? entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
    : entry.level === bookRank && !entry.traits.some(trait => trait.toLowerCase() === 'cantrip'))
    && entry.name.toLowerCase().includes(bookQuery.trim().toLowerCase())
    && matchesGearSystem(entry, bookSystem, c.systems)
    && !knownArcaneSpells.has(entry.name.toLowerCase()))
  const druidList = useMemo(() => druid ? druidSpellList(c, spellIndex.spells)
    : witch ? witchSpellList(c, entries) : undefined,
    [druid, witch, c.className, c.subclass, c.level, c.feats, c.systems, spellIndex, entries])
  const druidAvailable = useMemo(() => druid ? druidList?.filter(entry => spellAccessGranted(c, entry)) : undefined,
    [druidList, c.spells, c.ancestry, c.ethnicity, c.background, c.achievements, c.featAccessOverrides])
  const witchBookOptions = useMemo(() => witch
    ? uniqueSpellVariants((druidList ?? []).filter(entry => spellAccessGranted(c, entry)),
      entry => [...entry.systems].sort().join(','))
    : [], [witch, druidList, c])
  const knownWitchSpells = useMemo(() => {
    const known = new Set((c.spells ?? []).map(spell => spell.name.toLowerCase()))
    for (const value of Object.values(c.spellcasting?.prepared ?? {})) {
      const entry = spellIndex.byId.get(value) ?? spellIndex.byName.get(value)
      if (entry) known.add(entry.name.toLowerCase())
    }
    return known
  }, [c.spells, c.spellcasting?.prepared, spellIndex])
  const witchAvailable = useMemo(() => witch
    ? witchBookOptions.filter(entry => knownWitchSpells.has(entry.name.toLowerCase()))
    : undefined, [witch, witchBookOptions, knownWitchSpells])
  const dirge = useMemo(() => necromancer ? necromancerDirge(c, spellIndex.spells) : undefined,
    [necromancer, c, spellIndex])
  const dirgeOptions = useMemo(() => {
    if (!necromancer || !bookOpen || bookSource !== 'Dirge') return []
    const list = necromancerSpellList(c, spellIndex.spells)
    const canLearn = necromancerDirgeLearnChecker(c, spellIndex.spells, list)
    return uniqueSpellVariants(list.filter(entry => spellAccessGranted(c, entry) && canLearn(entry)),
      entry => [...entry.systems].sort().join(','))
  }, [necromancer, c, spellIndex, bookOpen, bookSource])
  const rankedDirgeOptions = dirgeOptions.filter(entry => (bookRank === 0
    ? entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
    : entry.level === bookRank && !entry.traits.some(trait => trait.toLowerCase() === 'cantrip'))
    && entry.name.toLowerCase().includes(bookQuery.trim().toLowerCase())
    && matchesGearSystem(entry, bookSystem, c.systems)
    && !(c.spells ?? []).some(spell => spell.name.toLowerCase() === entry.name.toLowerCase())
    && (!preventDuplicateSpells || !selectedGrantNames.has(entry.name.toLowerCase())))
  const rankedWitchBookOptions = (bookOpen && bookSource === 'Witch' ? witchBookOptions : []).filter(entry => (bookRank === 0
    ? entry.traits.some(trait => trait.toLowerCase() === 'cantrip')
    : entry.level === bookRank && !entry.traits.some(trait => trait.toLowerCase() === 'cantrip'))
    && entry.name.toLowerCase().includes(bookQuery.trim().toLowerCase())
    && matchesGearSystem(entry, bookSystem, c.systems) && !knownWitchSpells.has(entry.name.toLowerCase())
    && (!preventDuplicateSpells || !selectedGrantNames.has(entry.name.toLowerCase())))
  const schoolBookSpells = useMemo(() => wizardSchoolBookSpells(c, entries), [c, entries])
  useEffect(() => { if (schoolBookSpells) save({ spells: schoolBookSpells }) }, [schoolBookSpells])
  const schoolSpells = useMemo(() => new Set((wizardCurriculum(wizardSchool(c, entries))[bookRank] ?? [])
    .map(name => spellName(entries, name).toLowerCase())), [c, entries, bookRank])
  const schoolFirst = (list: ContentEntry[]) => bookSource === 'Wizard' && schoolSpells.size
    ? [...list].sort((a, b) => Number(schoolSpells.has(b.name.toLowerCase())) - Number(schoolSpells.has(a.name.toLowerCase()))) : list
  const bookOptions = bookSource === 'Dirge' ? rankedDirgeOptions
    : bookSource === 'Witch' ? rankedWitchBookOptions : schoolFirst(rankedArcaneBookOptions)
  const filteredBookOptions = bookOptions.filter(entry => matchesSpellTrait(entry, bookTrait))
  const rankedBookOptions = bookSort === 'damage' ? sortSpellsByDamage(filteredBookOptions, entry => entry, entry => entry.name) : filteredBookOptions
  const { spells, granted, featSpells, innate, special, focus, focusPoints, manualSpells, items } = data ?? spellSummaryData(c, entries)
  const available = spellCategoryAvailability(c, entries, data ?? spellSummaryData(c, entries))
  const otherFocus = focus.filter(spell => !granted.some(warden => warden.name === spell.name))
  const grownOfOakSpell = featSpells.find(grant => grant.source === 'Grown of Oak' && grant.entry.name === 'Oaken Resilience')
  const unresolved = unresolvedFeatSpells(c, entries)
  const spellRank = Math.max(casting?.rank ?? 0, innate.some(grant => grant.rule.kind === 'innate') ? c.level >= 12 ? 2 : 1 : 0)
  const spellPenalty = (ability: Ability) => Math.max(conditionPenalty(c, ability), ability === 'dex' ? giantWeaponClumsy(c, entries) : 0)
  const grantDetails = (grant: typeof featSpells[number]) => {
    const ability = grant.rule.kind === 'innate' ? innateSpellAbility(c, grant.rule.ability) : grant.rule.ability ?? casting?.ability
    const proficiency = grant.rule.kind === 'innate' ? spellRank : casting?.rank ?? 1
    const mod = ability ? abilityMod(c.abilities[ability]) + proficiencyBonus(Math.max(1, proficiency), c.level) - spellPenalty(ability) : undefined
    const resolution = spellResolution(grant.entry)
    const frequency = /^at[- ]will$/i.test(grant.rule.frequency?.trim() ?? '')
      || dailyInnateUses(c, grant) && (/\bper day(?: each)?$/i.test(grant.rule.frequency ?? '')
        || /^(?:once per hour|twice per week)(?: each)?$/i.test(grant.rule.frequency ?? '')) ? undefined : grant.rule.frequency
    const higherDC = grant.rule.dc === 'higher-class-or-spell'
    const classOnlyDC = grant.rule.dc === 'class' && !(grant.source === 'Loaner Spell' && casting?.ability)
    const needsClassDC = higherDC && resolution.save || classOnlyDC && (resolution.save || resolution.attack)
    const classDC = needsClassDC ? classDifficultyClass(c, entries) : undefined
    const castingAbility = casting?.ability ?? sc?.ability
    const spellDC = mod === undefined ? undefined : Math.max(10 + mod, casting && castingAbility
      ? 10 + abilityMod(c.abilities[castingAbility]) + proficiencyBonus(Math.max(1, spellRank), c.level) - spellPenalty(castingAbility) : 0)
    const dc = classOnlyDC ? classDC
      : higherDC ? classDC === undefined || spellDC === undefined ? undefined : Math.max(classDC, spellDC)
      : mod === undefined ? undefined : 10 + mod
    const notes = grant.source === 'Empathetic Connection' && grant.entry.name === 'Mindlink'
      || grant.source === 'Melodic Adaptation' && grant.entry.name === 'Detect Magic'
      || grant.source === 'Grown of Oak' && grant.entry.name === 'Oaken Resilience' ? [] : [
      frequency && `${frequency}${grant.rule.shared ? ' shared between alternatives' : ''}`,
      grant.rule.condition && !(grant.source === 'Mask of Power' && grant.rule.condition === 'Must be wearing your warmask')
        && !(['Ancestral Form', 'Bone Investiture', 'Fossil Rider'].includes(grant.source)
          && /^Must target yourself(?:; crocodile form only)?$/.test(grant.rule.condition))
        && grant.rule.condition !== 'Only within your claimed territory'
        && grant.rule.condition !== 'Only through barriers of earth or stone'
        && !(grant.source === 'Creature Shape'
          && grant.rule.condition === 'Transform only into a battle form that matches your ancestral creature; use your normal AC if higher')
        && !(grant.source === 'Creature Ally' && grant.rule.condition === 'Cat only')
        && !(grant.entry.name === 'Resist Energy' && ['Order Training', 'Order Cross-Training'].includes(grant.source)
          && /^Self only\. Fire resistance is at least \d+\.$/.test(grant.rule.condition))
        && !(['Order Training', 'Order Cross-Training'].includes(grant.source) && grant.rule.kind === 'focus'
          && /^Casting this domain spell grants \d+ temporary HP for 1 round\.$/.test(grant.rule.condition))
        && !(grant.entry.name === 'Command' && grant.rule.condition === 'This effect loses the linguistic trait') && grant.rule.condition,
      needsClassDC && classDC === undefined
        && <span role="status">Class DC unavailable: choose your class key attribute or sync class content.</span>,
    ].filter(Boolean)
    return { dc, attackBonus: classOnlyDC ? classDC === undefined ? undefined : classDC - 10 : mod,
      spellcastingModifier: ability ? abilityMod(c.abilities[ability]) : undefined,
      note: notes.length ? <>{notes.map((note, index) => <span key={index}>{index > 0 && '; '}{note}</span>)}</> : undefined }
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
  const controls = (name: string, rank = Math.ceil(c.level / 2), spellcastingModifier?: number, spell?: ContentEntry) => <>
    {!spellActionRolls(name, rank, spell ?? entries.find(entry => entry.kind === 'spell' && entry.name === name), spellcastingModifier).length
      && <SpellDamageRolls name={name} rank={rank} spellcastingModifier={spellcastingModifier}
        energyType={typeof spell?.data.dragon_breath_energy === 'string' ? spell.data.dragon_breath_energy : undefined} />}
  </>
  const effectControls = (name: string) => name === 'Force-FieldPGA'
    ? <label>Resistance type{' '}
      <select aria-label="Force-FieldPGA resistance" value={c.forceFieldPgaResistance ?? ''} onChange={event => {
        const value = FORCE_FIELD_PGA_RESISTANCE_TYPES.find(type => type === event.target.value)
        save({ forceFieldPgaResistance: value })
      }}>
        <option value="">Choose damage type</option>
        {FORCE_FIELD_PGA_RESISTANCE_TYPES.map(type =>
          <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
      </select>
    </label>
    : name === 'Resist Energy' ? <label> Resistance type{' '}
      <select aria-label="Resist Energy type" value={c.resistEnergyType ?? ''} onChange={event => {
        save({ resistEnergyType: RESIST_ENERGY_TYPES.find(type => type === event.target.value) })
      }}>
        <option value="">Choose damage type</option>
        {RESIST_ENERGY_TYPES.map(type => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
      </select>
      </label>
    : name === 'Oaken Resilience' && (grownOfOakSpell
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
  const inlineControls = (name: string, rank = Math.ceil(c.level / 2), source?: string) => name === 'Animal Feature' || name === 'Untamed Shift' || name === 'Untamed Form' || name === 'Dinosaur Form'
    ? <SpellEffectActions c={c} entries={entries} save={save} entry={spellEntry(name)} name={name} rank={rank} />
    : name === 'Pest Form'
    ? <PestFormActions c={c} save={save} entry={spellEntry(name)} rank={rank} source={source === 'Ancestral Pest' ? source : 'Pest Form'} />
    : name === 'Animal Form' && source !== 'Creature Shape' && activeFeatsNamed(c, 'Ancestral Form').length
    ? <CrocodileFormActions c={c} entries={entries} save={save} rank={rank} />
    : name === 'False Vitality'
    ? <FalseVitalityActions c={c} save={save} entry={spellEntry(name)} rank={rank} />
    : name === 'Bone Shield'
    ? <BoneShieldActions c={c} save={save} entry={spellEntry(name)} rank={rank} />
    : name === 'Protect Companion'
    ? <ActiveSpellActions name={name} entry={spellEntry(name)} rank={rank}><ProtectCompanionOptions c={c} save={save} /></ActiveSpellActions>
    : name === 'Spirit of the Beast'
    ? <ActiveSpellActions name={name} entry={spellEntry(name)} rank={rank}><SpiritOfTheBeastOptions c={c} save={save} /></ActiveSpellActions>
    : name === 'Shield'
    ? <ShieldActions c={c} entries={entries} save={save} entry={spellEntry(name)} rank={rank} />
    : name === 'Canopy Crawler' || name === 'Enlarge Companion' || name === 'Apex Companion'
      ? <ActiveSpellActions name={name} entry={spellEntry(name)} rank={rank}>
        <CompanionSpellOptions c={c} entries={entries} save={save} name={name} />
      </ActiveSpellActions> : undefined
  const setSc = (patch: Partial<NonNullable<Character['spellcasting']>>) => {
    if (!casting && !avengerTraditionSwitch) return
    save({ spellcasting: { ability: 'int', tradition: traditions[0] ?? '', slots: {}, ...sc, ...patch,
      rank: casting?.rank ?? patch.rank ?? sc?.rank ?? 1, ...(casting?.ability
        ? { ability: avengerCastingClass === 'Psychic' ? c.spellcasting?.ability ?? 'int' : casting.ability } : {}) } })
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
    ...programmedSpellEntries.map(entry => ({ name: entry.name, entryId: entry.id,
      group: groupLabel(entry.name, entry.id, entry.level, entry.traits.some(trait => trait.toLowerCase() === 'cantrip')), index: -1 })),
    ...dirge?.filter(entry => !c.spells?.some(spell => spell.name === entry.name))
      .map(entry => ({ name: entry.name, entryId: entry.id,
        group: groupLabel(entry.name, entry.id, entry.level, entry.traits.some(trait => trait.toLowerCase() === 'cantrip')), index: -1 })) ?? [],
    ...spells.flatMap((s, index) => manualSpells.includes(s) && !programmedSpellNames.has(s.name.toLowerCase())
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
  const choiceSlots: {
    key: string; label: string; tradition: string; rank: number; current: string; options: ContentEntry[]
    select: (value: string) => void; grant?: typeof featSpells[number]; entry?: ContentEntry
  }[] = []
  let occupiedSpells: Set<string> | undefined
  const availableInnateOptions = (options: ContentEntry[], current: string) => options.filter(entry =>
    !getSettings().uniqueInnateSpellChoices || entry.name === current
      || !(occupiedSpells ??= knownSpellNames(c, entries)).has(spellName(entries, entry.name).toLowerCase()))
  c.feats.forEach((feat, index) => {
    if (!(feat.name === 'First World Magic' || ['Psychic Talent', 'Psychic Master', 'Psychic Mastery', 'Psychic Paragon'].includes(feat.name) && c.systems.includes('sf2e'))
      || featTakenLevel(feat) > c.level) return
    const current = feat.choice ?? ''
    const options = availableInnateOptions(featSpellOptions(c, entries, feat) ?? [], current)
    const grant = innate.find(item => item.source === feat.name && item.entry.name === current)
    const tradition = grant?.rule.tradition ?? (feat.name !== 'First World Magic' ? 'Occult'
      : c.heritage?.toLowerCase() === 'wellspring gnome' ? gnomeHeritageTradition(c) ?? 'Innate' : 'Primal')
    choiceSlots.push({ key: `${feat.name}:${index}`, label: `${feat.name} spell`, tradition,
      rank: grant?.rank ?? (!getSettings().innateAutoHeighten && ['Psychic Master', 'Psychic Mastery'].includes(feat.name) ? 2
        : !getSettings().innateAutoHeighten && feat.name === 'Psychic Paragon' ? 6 : Math.ceil(c.level / 2)),
      current, options, grant, entry: grant?.entry,
      select: value => save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: value || undefined } : existing) }) })
  })
  if (investigatorMethodologies(c, entries).includes('Esoterica')) {
    for (const tradition of ['Divine', 'Occult'] as const) {
      const current = c.investigatorEsotericaSpells?.[tradition] ?? ''
      const options = availableInnateOptions(investigatorEsotericaCantripOptions(c, entries, tradition), current)
      const grant = featSpells.find(item => item.source === 'Esoterica' && item.rule.tradition === tradition
        && item.entry.name === current)
      choiceSlots.push({ key: `Esoterica:${tradition}`, label: `Esoterica ${tradition} cantrip`, tradition,
        rank: Math.ceil(c.level / 2), current, options, grant, entry: grant?.entry,
        select: value => save({ investigatorEsotericaSpells: { ...c.investigatorEsotericaSpells, [tradition]: value || undefined } }) })
    }
  }
  const tricksterAceSlots = investigatorTricksterAceSlots(c, entries)
  const loanerSpellSlotsForCharacter = loanerSpellSlots(c, entries)
  const inheritedMinorTradition = minorMagicInheritedTradition(c, entries)
  const minorTradition = inheritedMinorTradition ?? c.minorMagic?.tradition
  const minorCharacter = inheritedMinorTradition && c.minorMagic?.tradition !== inheritedMinorTradition
    ? { ...c, minorMagic: { ...c.minorMagic, tradition: inheritedMinorTradition } } : c
  if (activeFeatsNamed(c, 'Minor Magic').length && minorTradition) {
    const choices = c.minorMagic?.cantrips?.[minorTradition] ?? []
    const granted = minorMagicSpells(c, entries)
    for (let index = 0; index < 2; index++) {
      const current = choices[index] ?? ''
      choiceSlots.push({ key: `Minor Magic:${index}`, label: `Minor Magic cantrip ${index + 1}`,
        tradition: minorTradition, rank: Math.ceil(c.level / 2), current,
        options: availableInnateOptions(minorMagicOptions(minorCharacter, entries)
          .filter(entry => !choices.includes(entry.name) || entry.name === current), current),
        entry: granted.find(entry => entry.name === current),
        select: value => {
          const next = Array.from({ length: 2 }, (_, i) => i === index ? value : choices[i] ?? '')
          save({ minorMagic: { ...c.minorMagic, cantrips: { ...c.minorMagic?.cantrips, [minorTradition]: next } } })
        } })
    }
  }
  const choiceGrants = new Set(choiceSlots.flatMap(slot => slot.grant ? [slot.grant] : []))
  const investigatorClassChoices = choiceSlots.filter(slot => slot.key.startsWith('Esoterica:'))
  const minorMagicChoiceSlots = choiceSlots.filter(slot => slot.key.startsWith('Minor Magic:'))
  const innateChoiceSlots = choiceSlots.filter(slot => !slot.key.startsWith('Esoterica:')
    && !slot.key.startsWith('Minor Magic:'))
  const tricksterAceSpells = special.filter(grant => grant.source === "Trickster's Ace")
  const loanerSpells = special.filter(grant => grant.source === 'Loaner Spell')
  const otherSpecialSpells = special.filter(grant => grant.source !== "Trickster's Ace" && grant.source !== 'Loaner Spell')
  const renderChoiceSlot = (slot: typeof choiceSlots[number]) => {
    const details = slot.grant ? grantDetails(slot.grant) : undefined
    const inheritsCasting = !!inheritedMinorTradition && slot.key.startsWith('Minor Magic:') && !!casting?.ability
    const ability = inheritsCasting ? casting.ability! : innateSpellAbility(c)
    const modifier = details?.spellcastingModifier ?? abilityMod(c.abilities[ability])
    const dc = details?.dc ?? 10 + modifier + proficiencyBonus(inheritsCasting ? Math.max(1, casting.rank) : 1, c.level) - spellPenalty(ability)
    if (slot.entry) return <SpellItem c={c} key={slot.key} name={slot.entry.name} entry={slot.entry} rank={slot.rank}
      nameControl={<SelectedSlotSpell name={slot.entry.name} entry={slot.entry} source={slot.label}
        onClear={() => slot.select('')} />}
      note={details?.note} spellcastingModifier={modifier} saveDC={dc} attackBonus={details?.attackBonus ?? dc - 10}
      actionControls={slot.entry.name === 'Summon Undead'
        ? <SummonUndeadActions c={c} save={save} entry={slot.entry} rank={slot.rank} innate={slot.grant?.rule.kind === 'innate'} />
        : slot.entry.name === 'Marvelous Mount' ? <MarvelousMountActions c={c} save={save} entry={slot.entry} />
        : slot.entry.name === 'Summon Plant or Fungus'
        ? <SummonPlantActions c={c} save={save} entry={slot.entry} rank={slot.rank} innate={slot.grant?.rule.kind === 'innate'} /> : undefined}
      inlineControls={<>{inlineControls(slot.entry.name, slot.rank, slot.grant?.source)}
        {slot.grant?.rule.kind === 'innate' && <InnateSpellUses c={c} save={save} grant={slot.grant} />}</>}
      effectControls={effectControls(slot.entry.name)} effectRank={activeRank(slot.entry.name)}
      {...buffProps(slot.entry.name)}>
      {controls(slot.entry.name, slot.rank, modifier)}
    </SpellItem>
    return <li className="spellbook-row" key={slot.key}>
      <div className="spellbook-slot"><SearchableSelect aria-label={slot.label}
        value={slot.current} alwaysSearchable primaryDetails
        optionSpell={value => slot.options.find(entry => entry.name === value)}
        onChange={event => {
          const value = event.target.value
          if (value && !slot.options.some(entry => entry.name === value)) return
          const select = () => slot.select(value)
          if (!value && slot.current) confirmRemoval(`spell "${slot.current}"`, select)
          else select()
        }}>
        <option value="">Choose spell</option>
        {slot.current && !slot.options.some(entry => entry.name === slot.current)
          && <option disabled value={slot.current}>{slot.current} (unavailable)</option>}
        {[...new Set(slot.options.map(entry => entry.name))].map(name => <option key={name}>{name}</option>)}
      </SearchableSelect></div>
      <span><small>Duration</small>—</span><span><small>Range</small>—</span>
      <span><small>Save</small>—</span><span><small>Area/Targets</small>—</span>
    </li>
  }
  const innateGroups: { key: string; tradition: string; rank: number; grants: (typeof innate)[]; choices: typeof choiceSlots }[] = []
  const innateGroup = (traditionName: string | undefined, rank: number) => {
    const tradition = traditionName ? traditionName[0].toUpperCase() + traditionName.slice(1) : 'Innate'
    const key = `${tradition}:${rank}`
    let group = innateGroups.find(item => item.key === key)
    if (!group) {
      group = { key, tradition, rank, grants: [], choices: [] }
      innateGroups.push(group)
    }
    return group
  }
  for (const grants of groupedInnateSpells(c, innate.filter(grant => !choiceGrants.has(grant)))) {
    const grant = grants[0]
    innateGroup(grant.rule.tradition, grant.rank).grants.push(grants)
  }
  for (const slot of innateChoiceSlots) innateGroup(slot.tradition, slot.rank).choices.push(slot)
  innateGroups.sort((a, b) => a.tradition.localeCompare(b.tradition) || a.rank - b.rank)
  const preparedOptions = useMemo(() => {
    const forced = bard ? extraSlots.flatMap(extra => {
      const entry = extra.spell ? spellIndex.byName.get(extra.spell) : undefined
      return entry ? [{ name: entry.name, entryId: entry.id, rank: entry.level, cantrip: false, forced: true }] : []
    }) : []
    const bloodragerSpells = bloodrager ? spellIndex.spells.filter(entry => spellAccessGranted(c, entry)) : undefined
    const warriorSpells = warrior ? featSpellOptions(c, entries, warrior) : undefined
    const clericSpells = avengerCleric ? spellIndex.spells.filter(entry => spellAccessGranted(c, entry)
      && !entry.traits.some(trait => trait.toLowerCase() === 'focus')
      && String(entry.data.tradition ?? '').split(',').some(tradition => tradition.trim().toLowerCase() === 'divine')) : undefined
    const programmedNames = new Set(programmedSpellEntries.map(entry => entry.name.toLowerCase()))
    const databaseSpells = [...(c.spells ?? []).filter(spell => !programmedNames.has(spell.name.toLowerCase())),
      ...programmedSpellEntries.map(entry => ({ name: entry.name, entryId: entry.id, rank: entry.level,
        cantrip: entry.traits.some(trait => trait.toLowerCase() === 'cantrip') }))]
    const learnedNames = new Set(databaseSpells.map(spell => spell.name.toLowerCase()))
    const grantedDirge = new Set(necromancerGrantedDirgeSpells(c))
    const available = [...((warriorSpells ?? bloodragerSpells ?? clericSpells ?? witchAvailable ?? druidAvailable ?? dirge)?.map(entry => ({ name: entry.name, entryId: entry.id,
      rank: entry.level, cantrip: entry.traits.some(trait => trait.toLowerCase() === 'cantrip'), forced: grantedDirge.has(entry.name) })) ?? databaseSpells
      .filter(spell => !forced.some(extra => extra.name === spell.name)).map(spell => ({ ...spell, forced: false }))), ...forced]
      .filter(spell => spell.forced || preparedClass && learnedNames.has(spell.name.toLowerCase())
        || !preventDuplicateSpells || !selectedGrantNames.has(spell.name.toLowerCase()))
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
      return { options, choices: preparedClass || bloodrager ? uniqueSpellVariants(options, spell => {
        const entry = spell.entryId ? spellIndex.byId.get(spell.entryId) : spellIndex.byName.get(spell.name)
        return [...entry?.systems ?? []].sort().join(',')
      }) : options }
    })
  }, [druidAvailable, witchAvailable, dirge, c, entries, warrior, preparedClass, selectedTradition, spellIndex, bard,
    bloodrager, avengerCleric, programmedSpellEntries, selectedGrantNames, preventDuplicateSpells])
  const manualCacheSlots = automaticSlots === undefined
    ? extraSlots.filter(extra => extra.source === 'Cache Caster') : []
  const classSlotRanks = Array.from({ length: 11 }, (_, rank) => ({
    rank,
    count: Math.max(0, Math.min(20, Math.trunc(Number(sc?.slots[rank]) || 0)))
      + Number(manualCacheSlots.some(extra => extra.rank === rank))
      + Number(rank === 0 && benefits.cantrip) + Number(rank === benefits.batteryRank),
  })).filter(item => item.count > 0)
  const slotIncreaseNotesByRank = useMemo(() => spellSlotIncreaseNotes(c, entries), [c, entries])
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
      const rank = (spell.name === 'False Vitality' || spell.name === 'Pest Form') && spell.group.startsWith('Rank ')
        ? Number(spell.group.replace('Rank ', ''))
        : necromancer && !entry?.traits.some(trait => trait.toLowerCase() === 'cantrip')
        ? entry?.level ?? 1 : Math.ceil(c.level / 2)
      return <SpellItem c={c} key={`${spell.name}-${spell.index}`} name={spell.name} entry={entry} rank={rank} saveDC={classSpellDC}
         attackBonus={classSpellDC === undefined ? undefined : classSpellDC - 10}
         spellcastingModifier={castAbility ? abilityMod(c.abilities[castAbility]) : undefined}
        actionControls={spell.name === 'Summon Undead'
          ? <SummonUndeadActions c={c} save={save} entry={entry} rank={rank} />
          : spell.name === 'Marvelous Mount' ? <MarvelousMountActions c={c} save={save} entry={entry} />
          : ['Summon Fiend', 'Summon Celestial'].includes(spell.name) ? <SummonFiendActions c={c} entries={entries} save={save} entry={entry} rank={rank} />
          : spell.name === 'Summon Plant or Fungus' ? <SummonPlantActions c={c} save={save} entry={entry} rank={rank} /> : undefined}
        inlineControls={inlineControls(spell.name, rank)} effectControls={effectControls(spell.name)}
        effectRank={activeRank(spell.name)} {...buffProps(spell.name)}
        onRemove={spell.index >= 0 ? () => save({ spells: spells.filter((saved, index) => necromancer
          ? saved.name.toLowerCase() !== spell.name.toLowerCase() : index !== spell.index),
          ...spellRemovalChange(c, spell.name) }) : undefined}>
        {controls(spell.name, rank, castAbility ? abilityMod(c.abilities[castAbility]) : undefined)}
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
  const openSpellbook = (source: 'Dirge' | 'Wizard' | 'Magus' | 'Witch' | 'Technomancer', rank: number, slotKey?: string) => {
    setBookSource(source)
    setBookRank(rank)
    setBookSlotKey(slotKey)
    setBookQuery('')
    setBookTrait('all')
    setBookSystem('both')
    setBookOpen(true)
    bookDialog.current?.showModal()
    bookDialog.current?.querySelector('h4')?.focus()
  }
  const openDirge = (rank: number) => openSpellbook('Dirge', rank)
  const openWizardBookRank = (rank: number) => {
    const slots = wizardSpellbookSlots.filter(slot => slot.rank === rank)
    const assigned = new Set((c.spells ?? []).map(spell => spell.bookSlot))
    const slot = slots.find(candidate => !assigned.has(candidate.key)) ?? slots[0]
    openSpellbook('Wizard', rank, slot?.key)
  }
  const learnSpellbookSpell = (entry: ContentEntry) => {
    if (!rankedBookOptions.some(option => option.id === entry.id)) return
    if (bookSource === 'Dirge') {
      save({ spells: [...(c.spells ?? []), { name: entry.name, entryId: entry.id, rank: entry.level,
        cantrip: entry.traits.some(trait => trait.toLowerCase() === 'cantrip') }] })
      return
    }
    const rankSlots = wizardSpellbookSlots.filter(candidate => candidate.rank === bookRank)
    const assigned = new Set((c.spells ?? []).map(spell => spell.bookSlot))
    const slot = rankSlots.find(candidate => candidate.key === bookSlotKey)
      ?? rankSlots.find(candidate => !assigned.has(candidate.key)) ?? rankSlots[0]
    if ((c.spells ?? []).some(spell => spell.name.toLowerCase() === entry.name.toLowerCase()
      && spell.bookSlot !== slot?.key)) return
    const spells = slot ? (c.spells ?? []).filter(spell => spell.bookSlot !== slot.key) : [...(c.spells ?? [])]
    spells.push({ name: entry.name, entryId: entry.id, rank: slot?.rank ?? entry.level,
      cantrip: slot?.cantrip ?? entry.traits.some(trait => trait.toLowerCase() === 'cantrip'),
      ...(slot ? { bookSlot: slot.key } : {}) })
    const current = slot && (c.spells ?? []).find(spell => spell.bookSlot === slot.key)
    const prepared = current && c.spellcasting?.prepared
      ? Object.fromEntries(Object.entries(c.spellcasting.prepared)
        .filter(([, preparedSpell]) => preparedSpell !== current.entryId && preparedSpell !== current.name))
      : undefined
    const patch = { spells, ...(prepared ? { spellcasting: { ...c.spellcasting!, prepared } } : {}) }
    const update = () => {
      save(patch)
      if (slot) bookDialog.current?.close()
    }
    if (current && current.entryId !== entry.id) confirmRemoval(`${bookSource} spellbook spell "${current.name}"`, update)
    else update()
  }
  const renderTricksterAceChoices = () => tricksterAceSlots.map(({ feat, index, options }) => {
    const label = `Trickster's Ace spell${tricksterAceSlots.length > 1 ? ` ${index + 1}` : ''}`
    return <label key={`trickster-ace:${index}`}>{label}{' '}
      <SearchableSelect aria-label={label} value={feat.choice ?? ''} alwaysSearchable
        optionSpell={value => options.find(entry => entry.name === value)}
        onChange={event => {
          const value = event.target.value
          if (value && !options.some(entry => entry.name === value)) return
          const select = () => save({ feats: c.feats.map((existing, i) => i === index
            ? { ...existing, choice: value || undefined } : existing) })
          if (!value && feat.choice) confirmRemoval(`spell "${feat.choice}"`, select)
          else select()
        }}>
        <option value="">Choose spell</option>
        {feat.choice && !options.some(entry => entry.name === feat.choice)
          && <option value={feat.choice} disabled>{feat.choice} (unavailable)</option>}
        {[...new Set(options.map(entry => entry.name))].map(name => <option key={name}>{name}</option>)}
      </SearchableSelect>
    </label>
  })
  const loanerRank = (feat: Character['feats'][number]) => loanerSpells.find(grant => grant.entry.name === feat.choice)?.entry.level
  const renderLoanerSpellChoices = (rank?: number) => loanerSpellSlotsForCharacter.map(({ feat, index, options }, slotIndex) => {
    if (rank !== undefined) {
      const placed = loanerRank(feat)
      if (placed !== undefined) return null
      if (classSlotRanks[0].rank !== rank) return null
    }
    const label = `Loaner Spell${loanerSpellSlotsForCharacter.length > 1 ? ` ${slotIndex + 1}` : ''}`
    return <SearchableSelect key={`loaner-spell:${index}`} aria-label={label} value={feat.choice ?? ''} alwaysSearchable
        optionSpell={value => options.find(entry => entry.name === value)}
        onChange={event => {
          const value = event.target.value
          if (value && !options.some(entry => entry.name === value)) return
          const select = () => save({ feats: c.feats.map((existing, i) => i === index
            ? { ...existing, choice: value || undefined } : existing) })
          if (!value && feat.choice) confirmRemoval(`spell "${feat.choice}"`, select)
          else select()
        }}>
        <option value="">Choose spell</option>
        {feat.choice && !options.some(entry => entry.name === feat.choice)
          && <option value={feat.choice} disabled>{feat.choice} (unavailable)</option>}
        {[...new Set(options.map(entry => entry.name))].map(name => <option key={name}>{name}</option>)}
      </SearchableSelect>
  })
  const renderGrantRow = (grant: typeof special[number], onClear?: () => void, sharedCast?: ReactNode) => {
        const details = grant.source === 'Natural Illusionist'
          ? { note: grant.rule.condition, dc: undefined, attackBonus: undefined, spellcastingModifier: undefined } : grantDetails(grant)
        return <SpellItem c={c} key={`${grant.usageKey}:${grant.entry.name}`} name={grant.entry.name}
          entry={grant.entry} rank={grant.rank} note={details.note} saveDC={details.dc} attackBonus={details.attackBonus} spellcastingModifier={details.spellcastingModifier}
          nameControl={onClear ? <SelectedSlotSpell name={grant.entry.name} entry={grant.entry} source={grant.source} onClear={onClear} /> : undefined}
          actionControls={grant.entry.name === 'Summon Undead'
            ? <SummonUndeadActions c={c} save={save} entry={grant.entry} rank={grant.rank} />
            : grant.entry.name === 'Marvelous Mount' ? <MarvelousMountActions c={c} save={save} entry={grant.entry} />
            : ['Summon Fiend', 'Summon Celestial'].includes(grant.entry.name) ? <SummonFiendActions c={c} entries={entries} save={save} entry={grant.entry} rank={grant.rank}
              requiredTrait={grant.rule.condition === 'Devils only' ? 'devil' : undefined} />
              : grant.entry.name === 'Summon Plant or Fungus' ? <SummonPlantActions c={c} save={save} entry={grant.entry} rank={grant.rank} /> : undefined}
          inlineControls={<>{inlineControls(grant.entry.name, grant.rank)}
            {sharedCast ?? <InnateSpellUses c={c} save={save} grant={grant} />}</>}
          effectControls={effectControls(grant.entry.name)} effectRank={activeRank(grant.entry.name)} {...buffProps(grant.entry.name)}>
          {controls(grant.entry.name, grant.rank, details.spellcastingModifier, grant.entry)}
        </SpellItem>
      }
  const renderSpecialGroups = (grants: typeof special) => [...new Set(grants.map(grant => grant.source))]
    .map(source => <section className="innate-spell-group" key={source}>
      <h5>{source} · Spell Rank {grants.find(grant => grant.source === source)?.rank}</h5>
      <SpellColumns />
      <ul>{grants.filter(grant => grant.source === source).map(grant => renderGrantRow(grant))}</ul>
    </section>)
  const mergedGrantSources = [...tricksterAceSpells, ...loanerSpells.map(grant => ({ ...grant, rank: grant.entry.level }))]
  const mergeIntoClass = !witchwarper && !!sc && traditions.length > 0 && classSlotRanks.length > 0
  const minorMerged = mergeIntoClass && !!inheritedMinorTradition
  const mergedGrants = mergeIntoClass ? mergedGrantSources : []
  const extraGrantRanks = [...new Set(mergedGrants.map(grant => grant.rank))]
    .filter(rank => !classSlotRanks.some(slot => slot.rank === rank)).sort((a, b) => a - b)
  const standaloneGrants = (grants: typeof special) => mergeIntoClass ? [] : grants
  const slotKeyForIndex = (rank: number, count: number, index: number) => {
    const extras = extraSlots.filter(slot => slot.rank === rank)
    const manualCacheCount = automaticSlots === undefined ? extras.filter(slot => slot.source === 'Cache Caster').length : 0
    const normalCount = Math.max(0, Math.min(20, Math.trunc(Number(sc?.slots[rank]) || 0))) - extras.length + manualCacheCount
    const extra = extras[index - (count - extras.length)]
    const slotKey = extra?.key ?? (index === normalCount && rank === 0 && benefits.cantrip
      ? 'familiar-cantrip-connection' : index === normalCount && rank === benefits.batteryRank
        ? `familiar-spell-battery:${rank}` : `${rank}:${index}`)
    return { extra, slotKey }
  }
  const renderMergedGrant = (grant: typeof special[number]) => {
    const slot = grant.source === 'Loaner Spell'
      ? loanerSpellSlotsForCharacter.find(({ feat }) => feat.choice === grant.entry.name) : undefined
    const count = classSlotRanks.find(item => item.rank === grant.rank)?.count ?? 0
    const slots = Array.from({ length: count }, (_, index) => slotKeyForIndex(grant.rank, count, index))
    const spent = sc?.spentSlots ?? []
    const exhausted = bard && !!automaticSlots && slots.filter(({ slotKey }) => spent.includes(slotKey)).length >= (automaticSlots[grant.rank] ?? 0)
    const free = exhausted ? undefined : slots.find(({ extra, slotKey }) => !spent.includes(slotKey)
      && !extra?.spell && (!extra?.allowedSpells || extra.allowedSpells.includes(grant.entry.name)))?.slotKey
    return renderGrantRow(grant, slot ? () => save({ feats: c.feats.map((feat, index) =>
      index === slot.index ? { ...feat, choice: undefined } : feat) }) : undefined,
    slot ? <button type="button" disabled={!free} aria-label={`Cast Loaner Spell ${grant.entry.name}`}
      onClick={() => { if (free) setSc({ spentSlots: [...new Set([...spent, free])] }) }}>Cast</button> : undefined)
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
        {renderSpecialGroups(otherSpecialSpells)}
      </div>
      <div hidden={activeCategory !== 'class'}>
      {!!activeFeatsNamed(c, 'Minor Magic').length && !minorMerged && <div className="class-spell-slots">
        <section className="spell-slot-group">
          <h5>Minor Magic · Cantrips (Heightened Level {Math.ceil(c.level / 2)})</h5>
          <label>Tradition{' '}<select aria-label="Minor Magic tradition" value={c.minorMagic?.tradition ?? ''} onChange={event => {
            const tradition = MAGIC_TRADITIONS.find(value => value === event.target.value)
            save({ minorMagic: { ...c.minorMagic, tradition } })
          }}><option value="">Choose tradition</option>{MAGIC_TRADITIONS.map(value => <option key={value}>{value}</option>)}</select></label>
          {minorTradition && <>
            <small>{ABILITY_LABEL[innateSpellAbility(c)]} spell attack {signed(abilityMod(c.abilities[innateSpellAbility(c)]) + proficiencyBonus(1, c.level) - spellPenalty(innateSpellAbility(c)))};
              DC {10 + abilityMod(c.abilities[innateSpellAbility(c)]) + proficiencyBonus(1, c.level) - spellPenalty(innateSpellAbility(c))} (trained).</small>
            <SpellColumns />
            <ul>{minorMagicChoiceSlots.map(renderChoiceSlot)}</ul>
          </>}
        </section>
      </div>}
      {investigatorClassChoices.length > 0
        && (!sc || traditions.length === 0 || !classSlotRanks.some(({ rank }) => rank === 0))
        && <div className="class-spell-slots"><section className="spell-slot-group">
          <h5>Cantrips (Heightened Level {Math.ceil(c.level / 2)})</h5>
          <SpellColumns />
          <ul>{investigatorClassChoices.map(renderChoiceSlot)}</ul>
        </section></div>}
      {!mergeIntoClass && renderTricksterAceChoices()}
      {renderSpecialGroups(standaloneGrants(tricksterAceSpells))}
      {!mergeIntoClass && renderLoanerSpellChoices()}
      {renderSpecialGroups(standaloneGrants(loanerSpells))}
      {(necromancer || wizard || magus || witch || technomancer || wizardSpellbookSlots.length > 0) && c.level >= 1 && <dialog ref={bookDialog}
        className="entry-dialog dirge-dialog" aria-labelledby={bookTitleId}
        onClose={event => { if (event.target === event.currentTarget) setBookOpen(false) }}
        onClick={event => { if (event.target === event.currentTarget) bookDialog.current?.close() }}>
        <h4 id={bookTitleId} tabIndex={-1}>{bookSource === 'Dirge' ? 'Dirge'
          : bookSource === 'Witch' ? 'Witch Familiar' : bookSource === 'Technomancer' ? 'Spell Database' : `${bookSource} Spellbook`}</h4>
        <div className="gear-tabs spell-category-tabs" role="group" aria-label={`${bookSource} spell ranks`}>
          {Array.from({ length: 11 }, (_, rank) => <button key={rank} type="button"
            aria-label={rank === 0 ? 'Cantrips' : `Rank ${rank}`} aria-pressed={bookRank === rank}
            className={bookRank === rank ? 'on' : ''} onClick={() => setBookRank(rank)}>{rank}</button>)}
        </div>
        {groups.filter(group => group !== 'Focus Spells').map(group =>
          <div className="dirge-rank" key={group} hidden={group !== (bookRank === 0 ? 'Cantrips' : `Rank ${bookRank}`)}>
            {renderSpellGroup(group)}
          </div>)}
        <label>Search spells{' '}<input type="search" aria-label={`Search ${bookSource.toLowerCase()} spells`} value={bookQuery}
          onChange={event => setBookQuery(event.target.value)} /></label>
        <PickerSort label="Sort spellbook by" value={bookSort} onChange={setBookSort} includeLevel={false} includeDamage />
        <SpellTraitFilter value={bookTrait} traits={spellTraits(bookOptions)} onChange={setBookTrait} />
        <GearSystemFilter value={bookSystem} onChange={setBookSystem} />
        {bookOpen && <DirgeLearnOptions options={rankedBookOptions} onLearn={learnSpellbookSpell}
          showDamage={bookSort === 'damage'}
          marked={bookSource === 'Wizard' ? schoolSpells : undefined} />}
        <form method="dialog"><button autoFocus>Close</button></form>
      </dialog>}
      {(casting || avengerTraditionSwitch) && <>
      {(!casting?.ability && !avengerTraditionSwitch && c.className !== 'Witchwarper' || traditions.length > 1) && <div className="row">
        {!casting?.ability && !avengerTraditionSwitch && c.className !== 'Witchwarper' && <label>Casting ability{' '}
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
      {['Animist', 'Cleric', 'Druid', 'Magus', 'Necromancer', 'Technomancer', 'Witch', 'Wizard']
        .includes(c.className ?? '') && !automaticSlots && activeFeatsNamed(c, 'Flexible Spellcaster Dedication').length > 0 && <small role="status">
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
          const selectedCount = Array.from({ length: count }, (_, index) => {
            const { extra, slotKey } = slotKeyForIndex(rank, count, index)
            return !!extra?.spell || !!sc.prepared?.[slotKey]
          }).filter(Boolean).length
          const increaseNotes = slotIncreaseNotesByRank.get(rank)
          const sourceLabel = cantrip ? 'Cantrip slots' : `Rank ${rank} slots`
          const classRows = Array.from({ length: count }, (_, index) => {
            const { extra, slotKey } = slotKeyForIndex(rank, count, index)
            const selectedValue = extra?.spell ? spellIndex.byName.get(extra.spell)?.id ?? extra.spell
              : sc.prepared?.[slotKey] ?? ''
            const selectedSpell = (c.spells ?? []).find(spell => (spell.entryId ?? spell.name) === selectedValue)
            const selectedEntry = selectedSpell ? spellEntry(selectedSpell.name, selectedSpell.entryId)
              : spellIndex.byId.get(selectedValue) ?? spellIndex.byName.get(selectedValue)
            return { kind: 'class' as const, name: selectedSpell?.name ?? selectedEntry?.name ?? selectedValue,
              index, extra, slotKey, selectedValue, selectedSpell, selectedEntry }
          })
          const rows = [...classRows,
            ...(cantrip ? [...investigatorClassChoices, ...(minorMerged ? minorMagicChoiceSlots : [])] : [])
              .map(slot => ({ kind: 'choice' as const, name: slot.entry?.name ?? slot.current, slot })),
            ...mergedGrants.filter(grant => grant.rank === rank)
              .map(grant => ({ kind: 'grant' as const, name: grant.entry.name, grant })),
          ].sort((a, b) => compareSelectedSpells(a.name, b.name))
          return <section className="spell-slot-group" key={rank}>
            <h5>{title} ({spellSlotCount(selectedCount, count)})
              {increaseNotes?.length && <SourceNote source={sourceLabel} note={increaseNotes.join('; ')} />}
              {necromancer && <> <DirgeRankButton rank={rank} onOpen={openDirge} /></>}
              {(wizard || wizardSpellbookSlots.some(slot => slot.rank === rank)) && <>
                <SpellbookRankButton book="Wizard" rank={rank}
                  onOpen={wizardSpellbookSlots.length > 0 && !wizard ? openWizardBookRank : rank => openSpellbook('Wizard', rank)} />
              </>}
              {magus && <> <SpellbookRankButton book="Magus" rank={rank} onOpen={rank => openSpellbook('Magus', rank)} /></>}
              {technomancer && <> <SpellbookRankButton book="Spell Database" rank={rank} onOpen={rank => openSpellbook('Technomancer', rank)} /></>}
              {witch && <> <SpellbookRankButton book="Witch" rank={rank} onOpen={rank => openSpellbook('Witch', rank)} /></>}</h5>
            <SpellColumns />
            <ul>{rows.map(row => {
              if (row.kind === 'choice') return renderChoiceSlot(row.slot)
              if (row.kind === 'grant') return renderMergedGrant(row.grant)
              const { index, extra, slotKey, selectedValue, selectedSpell, selectedEntry } = row
              const restricted = !!extra?.spell
              const metadata = spellMetadata(selectedEntry, cantrip ? Math.ceil(c.level / 2) : rank, c)
              const spent = !bloodrager && (sc.spentSlots?.includes(slotKey) ?? false)
              const extraOptions = extra?.allowedSpells?.flatMap(name => {
                const entry = spellIndex.byName.get(name)
                const cacheRankAllowed = extra.source !== 'Cache Caster'
                  || !!entry && !entry.traits.some(trait => trait.toLowerCase() === 'cantrip') && entry.level <= rank
                return entry && cacheRankAllowed && spellAccessGranted(c, entry) ? [{ name: entry.name, entryId: entry.id,
                  baseRank: entry.level, cantrip: entry.traits.some(trait => trait.toLowerCase() === 'cantrip') }] : []
              }) ?? []
              const fixedOption = extra?.spell && selectedEntry ? { name: selectedEntry.name, entryId: selectedEntry.id,
                baseRank: selectedEntry.level, cantrip: selectedEntry.traits.some(trait => trait.toLowerCase() === 'cantrip') } : undefined
              const baseSelectedOption = options.find(spell => (spell.entryId ?? spell.name) === selectedValue
                || selectedSpell && !selectedSpell.entryId && spell.name === selectedSpell.name)
              const baseDisplayedSelection = preparedClass && baseSelectedOption && selectedValue === baseSelectedOption.name
                ? { ...baseSelectedOption, entryId: undefined } : baseSelectedOption
              let slotOptions: { name: string; entryId?: string; baseRank: number; cantrip: boolean }[] = extra?.allowedSpells ? extraOptions
                : extra ? warrior && fixedOption ? [fixedOption] : options.filter(option => option.name === extra.spell)
                  : preparedClass && baseDisplayedSelection
                    ? choices.map(option => option.name === baseDisplayedSelection.name ? baseDisplayedSelection : option) : choices
              if (bloodrager && cantrip) {
                const other = sc.prepared?.[`0:${index === 0 ? 1 : 0}`]
                const otherEntry = other ? spellIndex.byId.get(other) ?? spellIndex.byName.get(other) : undefined
                slotOptions = slotOptions.filter(option => {
                  const entry = option.entryId ? spellIndex.byId.get(option.entryId) : spellIndex.byName.get(option.name)
                  return option.name !== otherEntry?.name && (!bloodrager || !otherEntry || spellResolution(otherEntry).attack
                    || !!entry && spellResolution(entry).attack)
                })
              }
              if (cantrip && preparedClass) {
                const activeKeys = new Set(Array.from({ length: count }, (_, i) => slotKeyForIndex(rank, count, i).slotKey))
                const taken = new Set(Object.entries(sc.prepared ?? {})
                  .filter(([key, value]) => activeKeys.has(key) && key !== slotKey && value)
                  .flatMap(([, value]) => [value, (spellIndex.byId.get(value) ?? spellIndex.byName.get(value))?.name ?? value]))
                slotOptions = slotOptions.filter(option => !taken.has(option.entryId ?? option.name)
                  && !taken.has(option.name))
              }
              let optionIndex: Map<string, typeof slotOptions[number]> | undefined
              const spellOption = (value: string) => {
                optionIndex ??= new Map(slotOptions.map(spell => [spell.entryId ?? spell.name, spell]))
                return optionIndex.get(value)
              }
              const selectedOption = slotOptions.find(spell => (spell.entryId ?? spell.name) === selectedValue
                || selectedSpell && !selectedSpell.entryId && spell.name === selectedSpell.name)
              const exhausted = bard && !spent && !!automaticSlots && (sc.spentSlots ?? [])
                .filter(key => /^\d+:\d+$/.test(key) ? key.startsWith(`${rank}:`) : extras.some(slot => slot.key === key)).length
                >= (automaticSlots[rank] ?? 0)
              const valid = !!selectedOption
              const bloodragerSignatureLimit = bloodrager && activeFeatsNamed(c, 'Rising Blood Magic').length && c.level >= 6
                ? 1 + Number(!!activeFeatsNamed(c, 'Surging Blood Magic').length)
                  + Number(!!activeFeatsNamed(c, 'Exultant Blood Magic').length) : 0
              const bloodragerSignatures = Object.entries(sc.signatureSpells ?? {})
                .filter(([spellRank, key]) => Number(spellRank) > 0 && !!sc.prepared?.[key]
                  && Number(spellRank) in (sc.slots ?? {}))
                .slice(0, bloodragerSignatureLimit).map(([, key]) => key)
              const signature = bard && (bloodrager ? bloodragerSignatureLimit > 0 : c.level >= 3) && !cantrip && valid
                && (!bloodrager || bloodragerSignatures.includes(slotKey))
                && (!!extra || activeFeatsNamed(c, 'Ultimate Polymath').length > 0 || sc.signatureSpells?.[rank] === slotKey)
              const displayedSelection = preparedClass && selectedOption && selectedValue === selectedOption.name
                ? { ...selectedOption, entryId: undefined } : selectedOption
              const showOptions = slotOptions.length <= 10 || preparedSlot === slotKey
              return <li className="spellbook-row" key={slotKey}>
                <div className="spellbook-slot">
                  {signature && automaticSlots && selectedOption
                    ? <SignatureCast name={selectedOption.name} baseRank={selectedOption.baseRank} slots={automaticSlots}
                      spent={sc.spentSlots ?? []} onCast={key => setSc({ spentSlots: [...new Set([...(sc.spentSlots ?? []), key])] })} />
                    : !cantrip && <button type="button" disabled={!valid || spent || exhausted} aria-label={`Cast spell slot rank ${rank} slot ${index + 1}`}
                    onClick={() => {
                      if (!valid || spent || exhausted) return
                      const free = bloodrager ? Array.from({ length: automaticSlots?.[rank] ?? 0 }, (_, i) => `${rank}:${i}`)
                        .find(key => !sc.spentSlots?.includes(key)) : slotKey
                      if (free) setSc({ spentSlots: [...new Set([...(sc.spentSlots ?? []), free])] })
                    }}>Cast</button>}
                  {bard && (bloodrager ? bloodragerSignatureLimit > 0 : c.level >= 3) && !cantrip && valid && !extra && !activeFeatsNamed(c, 'Ultimate Polymath').length
                    && <button type="button" className={signature ? 'on' : ''} aria-pressed={signature}
                      disabled={bloodrager && !signature && bloodragerSignatures.length >= bloodragerSignatureLimit}
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
                      save({ spellcasting: { ...sc, prepared },
                        ...(selectedEntry ? spellRemovalChange(c, selectedEntry.name) : {}) })
                    }} />
                  : <SearchableSelect aria-label={`${cantrip ? 'Cantrip' : `Spell Rank ${rank}`} slot ${index + 1}`}
                    value={selectedValue} optionCount={slotOptions.length} disabled={spent || restricted} alwaysSearchable primaryDetails
                    defaultSortOrder="level-desc"
                    optionLevel={value => spellOption(value)?.baseRank} optionSortName={value => spellOption(value)?.name}
                    optionSpell={value => {
                      const option = spellOption(value)
                      return option && spellEntry(option.name, option.entryId)
                    }}
                    renderDetails={value => {
                      const option = slotOptions.find(spell => (spell.entryId ?? spell.name) === value)
                      const entry = option && spellEntry(option.name, option.entryId)
                      return entry && <span className="picker-spell-name">
                        {!cantrip && rank > option.baseRank ? `+${rank - option.baseRank} ` : ''}
                        <EntryDescription name={entry.name} entry={entry} deferDetails />
                        {' '}<small>{entry.systems.map(system => system.toUpperCase()).join(' / ')}</small>
                      </span>
                    }}
                    title={extra?.source} onPrepare={() => setPreparedSlot(slotKey)}
                    onChange={event => {
                      if (restricted) return
                      const value = event.target.value
                      if (value && !(valid && value === selectedValue)
                        && !slotOptions.some(spell => (spell.entryId ?? spell.name) === value)) return
                      const prepare = () => {
                        const prepared = { ...sc.prepared }
                        if (value) prepared[slotKey] = value
                        else delete prepared[slotKey]
                        if (selectedEntry && value !== selectedValue) {
                          save({ spellcasting: { ...sc, prepared }, ...spellRemovalChange(c, selectedEntry.name) })
                        } else setSc({ prepared })
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
                  {selectedEntry && (selectedEntry.name === 'Shield'
                    ? <ShieldActions c={c} entries={entries} save={save} entry={selectedEntry} rank={cantrip ? Math.ceil(c.level / 2) : rank} disabled={!valid} />
                    : selectedEntry.name === 'Eat Fire'
                    ? <EatFireActions c={c} save={save} entry={selectedEntry} rank={cantrip ? Math.ceil(c.level / 2) : rank} disabled={!valid} />
                    : selectedEntry.name === 'Oaken Resilience'
                    ? <ActiveSpellActions name={selectedEntry.name} entry={selectedEntry} rank={rank}>
                      <label><input type="checkbox" aria-label={`Oaken Resilience active at rank ${rank}`}
                        checked={isSpellActive(c, entries, selectedEntry.name)} disabled={!valid}
                        onChange={event => save({ ...spellActiveChange(c, selectedEntry.name, event.target.checked),
                          ...(event.target.checked ? { oakenResilienceRank: rank } : {}) })} /> Active</label>
                    </ActiveSpellActions>
                    : selectedEntry.name === 'Bone Shield'
                    ? <BoneShieldActions c={c} save={save} entry={selectedEntry} rank={rank} disabled={!valid} />
                    : selectedEntry.name === 'Summon Undead'
                    ? <SummonUndeadActions c={c} save={save} entry={selectedEntry} rank={rank} disabled={!valid} />
                    : selectedEntry.name === 'Marvelous Mount'
                    ? <MarvelousMountActions c={c} save={save} entry={selectedEntry} disabled={!valid} />
                    : ['Summon Fiend', 'Summon Celestial'].includes(selectedEntry.name)
                    ? <SummonFiendActions c={c} entries={entries} save={save} entry={selectedEntry} rank={rank} disabled={!valid} />
                    : selectedEntry.name === 'Summon Plant or Fungus'
                    ? <SummonPlantActions c={c} save={save} entry={selectedEntry} rank={rank} disabled={!valid} />
                    : selectedEntry.name === 'False Vitality'
                    ? <FalseVitalityActions c={c} save={save} entry={selectedEntry} rank={rank} disabled={!valid} />
                    : selectedEntry.name === 'Tailwind'
                    ? <TailwindActions c={c} save={save} entry={selectedEntry} rank={rank} disabled={!valid} />
                    : selectedEntry.name === 'Protect Companion'
                    ? <ActiveSpellActions name={selectedEntry.name} entry={selectedEntry} rank={Math.ceil(c.level / 2)}><ProtectCompanionOptions c={c} save={save} disabled={!valid} /></ActiveSpellActions>
                    : selectedEntry.name === 'Spirit of the Beast'
                    ? <ActiveSpellActions name={selectedEntry.name} entry={selectedEntry} rank={rank}><SpiritOfTheBeastOptions c={c} save={save} disabled={!valid} /></ActiveSpellActions>
                    : selectedEntry.name === 'Pest Form'
                    ? <PestFormActions c={c} save={save} entry={selectedEntry} rank={rank} disabled={!valid} />
                    : selectedEntry.name === 'Animal Feature' || selectedEntry.name === 'Untamed Shift' || selectedEntry.name === 'Dinosaur Form'
                    ? <SpellEffectActions c={c} entries={entries} save={save} entry={selectedEntry} name={selectedEntry.name} rank={rank} />
                    : <SpellActions name={selectedEntry.name} entry={selectedEntry} rank={cantrip ? Math.ceil(c.level / 2) : rank}
                      spellcastingModifier={castAbility ? abilityMod(c.abilities[castAbility]) : undefined} />)}
                  {selectedEntry && valid && <PharasmaSpellBonus c={c} entry={selectedEntry} name={selectedEntry.name} rank={cantrip ? Math.ceil(c.level / 2) : rank} />}
                </div>
                <span><small>Duration</small>{metadata.duration}{metadata.durationNote
                  && <SourceNote source="Persistent Animal Feature" note={metadata.durationNote} inlineSource={false} />}</span>
                <span><small>Range</small>{metadata.range}</span>
                <span><small>Save</small>{spellSave(metadata.save, classSpellDC, selectedEntry, classSpellDC === undefined ? undefined : classSpellDC - 10)}</span>
                <span><small>Area/Targets</small>{metadata.targets}</span>
                {selectedValue && !valid && <small className="innate-spell-controls" role="status">
                  Selected spell unavailable for your current spell list or slot rank.
                </small>}
              </li>
            })}</ul>
            {rank === classSlotRanks[0].rank && renderTricksterAceChoices()}{renderLoanerSpellChoices(rank)}
          </section>
        })}
        {extraGrantRanks.map(rank => <section className="spell-slot-group" key={`granted:${rank}`}>
          <h5>Spell Rank {rank}</h5>
          <SpellColumns />
          <ul>{mergedGrants.filter(grant => grant.rank === rank)
            .sort((a, b) => compareSelectedSpells(a.entry.name, b.entry.name)).map(renderMergedGrant)}</ul>
          {renderLoanerSpellChoices(rank)}
        </section>)}
      </div>}
      </>}
      {c.className === 'Animist' && c.systems.includes('pf2e')
        && <AnimistApparitionSpells c={c} entries={entries} save={save} />}
      {druid && groups.some(group => group !== 'Focus Spells') && <b>Learned spell access</b>}
      {!necromancer && !wizardBookUser && groups.filter(group => group !== 'Focus Spells').map(renderSpellGroup)}
      </div>
      <div hidden={activeCategory !== 'innate'}>
      {c.systems.includes('pf2e') && c.level >= 1 && ['fey-touched gnome', 'wellspring gnome'].includes(c.heritage?.toLowerCase() ?? '') && (() => {
        const tradition = gnomeHeritageTradition(c)
        const current = tradition ? c.gnomeHeritageMagic?.cantrips?.[tradition] ?? '' : ''
        const options = availableInnateOptions(gnomeHeritageCantripOptions(c, entries), current)
        return <div className="col">
          {c.heritage?.toLowerCase() === 'wellspring gnome' && <label>Wellspring Gnome tradition{' '}
            <select aria-label="Wellspring Gnome tradition" value={c.gnomeHeritageMagic?.tradition ?? ''} onChange={event => {
              const value = (['Arcane', 'Divine', 'Occult'] as const).find(option => option === event.target.value)
              save({ gnomeHeritageMagic: { ...c.gnomeHeritageMagic, tradition: value } })
            }}><option value="">Choose tradition</option>{['Arcane', 'Divine', 'Occult'].map(value => <option key={value}>{value}</option>)}</select>
          </label>}
          {tradition && <SearchableSelect label={`${c.heritage} cantrip`} aria-label={`${c.heritage} cantrip`} value={current}
            optionSpell={value => options.find(entry => entry.name === value)}
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
        const current = c.mageAutomatonCantrip ?? ''
        const options = availableInnateOptions(mageAutomatonOptions(c, entries), current)
        return <SearchableSelect label="Mage Automaton cantrip" aria-label="Mage Automaton cantrip" value={current}
          optionSpell={value => options.find(entry => entry.name === value)}
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
      {innateGroups.length > 0 && <div>
        <div className="row"><b>Innate Spells</b>
          {getSettings().consolidateInnateTraditions && !classInnateTradition(c, entries) && innateTraditionOptions(c, entries).length > 1
            && <select aria-label="Innate spell tradition" value={c.innateTradition ?? ''}
              onChange={event => save({ innateTradition: event.target.value || undefined })}>
              <option value="">Each spell's own tradition</option>
              {innateTraditionOptions(c, entries).map(tradition => <option key={tradition} value={tradition}>
                {tradition[0].toUpperCase() + tradition.slice(1)}</option>)}
            </select>}
        </div>
        {innateGroups.map(group => <section className="innate-spell-group" key={group.key}>
          <h5>{group.tradition} Spell Rank {group.rank}</h5>
          <SpellColumns />
          <ul>{[
            ...group.choices.map(slot => ({ name: slot.current || slot.label, slot })),
            ...group.grants.map(grants => ({ name: grants[0].entry.name, grants })),
          ].sort((a, b) => a.name.localeCompare(b.name)).map(item => {
            if ('slot' in item) return renderChoiceSlot(item.slot)
            const grants = item.grants
            const grant = grants[0]
            const details = grantDetails(grant)
            return <InnateSpellRow c={c} key={grant.usageKey} grant={grant} note={details.note} saveDC={details.dc} attackBonus={details.attackBonus} spellcastingModifier={details.spellcastingModifier}
              actionControls={grant.source === 'Heroic Presence' ? <ActiveSpellActions name={grant.entry.name} entry={grant.entry} rank={grant.rank} actions="Single Action">
                <ZealousConvictionToggle c={c} save={save} rank={grant.rank} />
                <SourceNote source="Heroic Presence" note="A repugnant command immediately ends the effect on that target." /></ActiveSpellActions>
                : grant.entry.name === 'Summon Undead' ? <SummonUndeadActions c={c} save={save}
                  entry={grant.entry} rank={grant.rank} innate />
                : grant.entry.name === 'Marvelous Mount' ? <MarvelousMountActions c={c} save={save} entry={grant.entry} />
                : ['Summon Fiend', 'Summon Celestial'].includes(grant.entry.name) ? <SummonFiendActions c={c} entries={entries} save={save}
                  entry={grant.entry} rank={grant.rank} innate lineageOnly={grant.source === 'Summon Nephilim Kin'}
                  requiredTrait={grant.rule.condition === 'Devils only' ? 'devil' : undefined} />
                : grant.entry.name === 'Summon Plant or Fungus' ? <SummonPlantActions c={c} save={save} entry={grant.entry} rank={grant.rank} innate />
                : c.systems.includes('sf2e') && c.ancestry === 'Lashunta'
                && grant.source === 'Creature Ally' && grant.entry.name === 'Summon Animal'
                ? <ActiveSpellActions name={grant.entry.name} entry={grant.entry} rank={grant.rank} actions="Three Actions">
                  <LashuntaAllyOptions c={c} save={save} />
                </ActiveSpellActions>
                : c.systems.includes('sf2e') && c.ancestry === 'Vesk'
                && grant.source === 'Creature Ally' && grant.entry.name === 'Summon Animal'
                ? <ActiveSpellActions name={grant.entry.name} entry={grant.entry} rank={grant.rank} actions="Three Actions">
                  <CaypinAllyToggle c={c} save={save} />
                </ActiveSpellActions>
                : c.systems.includes('sf2e') && c.ancestry === 'Pahtra'
                && grant.source === 'Creature Ally' && grant.entry.name === 'Summon Animal'
                ? <ActiveSpellActions name={grant.entry.name} entry={grant.entry} rank={grant.rank} actions="Three Actions">
                  <CatAllyToggle c={c} save={save} />
                </ActiveSpellActions>
                : c.systems.includes('sf2e') && c.ancestry === 'Shirren'
                && grant.source === 'Creature Ally' && grant.entry.name === 'Summon Animal'
                ? <ActiveSpellActions name={grant.entry.name} entry={grant.entry} rank={grant.rank} actions="Three Actions">
                  <ShirrenAllyToggle c={c} save={save} />
                </ActiveSpellActions>
                : c.systems.includes('sf2e') && grant.source === 'Creature Shape'
                  && (['Vesk', 'Lashunta'].includes(c.ancestry ?? '') && grant.entry.name === 'Animal Form'
                    || c.ancestry === 'Shirren' && grant.entry.name === 'Insect Form')
                ? <ActiveSpellActions name={grant.entry.name} entry={grant.entry} rank={grant.rank} actions="Two Actions">
                  <CreatureShapeOptions c={c} entries={entries} save={save} rank={grant.rank} />
                </ActiveSpellActions>
                : grant.entry.name === 'Resist Energy' && ['Order Training', 'Order Cross-Training'].includes(grant.source)
                && grant.rule.condition?.startsWith('Self only. Fire resistance is at least ')
                ? <PyreResistEnergyActions c={c} save={save} entry={grant.entry} rank={grant.rank} /> : undefined}
              inlineControls={<>{inlineControls(grant.entry.name, grant.rank, grant.source)}<InnateSpellUses c={c} save={save} grant={grant}
                additionalGrants={grants.slice(1)} /></>}
              effectControls={effectControls(grant.entry.name)}
              effectRank={activeRank(grant.entry.name)}
              {...buffProps(grant.entry.name)}>
              {controls(grant.entry.name, grant.rank, details.spellcastingModifier, grant.entry)}
            </InnateSpellRow>
          })}</ul>
        </section>)}
      </div>}
      </div>
      <div hidden={activeCategory !== 'focus'}>
      {spellcastingSummary}
      {(focusPoints > 0 || allFocus.length > 0 || !!activeFeatsNamed(c, 'Floral Restoration').length
        || !!activeFeatsNamed(c, 'Desperate Warden').length) && (
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
              const note = details ? details.note : entry && spellResolution(entry).attack && !casting && !beastmasterCasting
                ? <span role="status">Check the granting rules for this spell's spellcasting attribute and proficiency.</span>
                : undefined
              const focusModifier = details?.spellcastingModifier ?? (!casting && beastmasterCasting ? abilityMod(c.abilities.wis)
                : castAbility ? abilityMod(c.abilities[castAbility]) : undefined)
              return <SpellItem c={c} key={s.name} entry={entry} name={s.name} rank={Math.ceil(c.level / 2)} inlineControls={inlineControls(s.name)} spellcastingModifier={focusModifier}
                note={note} effectControls={effectControls(s.name)}
                effectRank={activeRank(s.name)}
                attackBonus={details ? details.attackBonus : !casting && beastmasterCasting
                  ? abilityMod(c.abilities.wis) + proficiencyBonus(beastmasterCasting, c.level) - spellPenalty('wis')
                  : classSpellDC === undefined ? undefined : classSpellDC - 10}
                saveDC={details ? details.dc : !casting && beastmasterCasting ? 10 + abilityMod(c.abilities.wis) + proficiencyBonus(beastmasterCasting, c.level) - spellPenalty('wis') : classSpellDC} {...buffProps(s.name)}
                onRemove={s.index >= 0 ? () => save({ spells: spells.filter((_, index) => index !== s.index),
                  ...spellRemovalChange(c, s.name) }) : undefined}>
                {controls(s.name, Math.ceil(c.level / 2), focusModifier)}
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
          const note = (!uses || !/(?:\bper day\b|^once per hour$|^twice per week$)/i.test(spell.frequency ?? '')) ? spell.frequency : undefined
          return <SpellItem c={c} key={`${spell.source.id}:${index}`}
          name={spell.name} entry={spell.entry} rank={spell.rank}
          active={spell.name === 'Avatar' && isAncestralEmbrace(spell.source.name) ? !!c.activeSpells?.includes(ANCESTRAL_AVATAR) : undefined}
          onToggle={spell.name === 'Avatar' && isAncestralEmbrace(spell.source.name)
            ? active => save(spellActiveChange(c, ANCESTRAL_AVATAR, active)) : undefined}
          activeActions={spell.name === 'Avatar' && isAncestralEmbrace(spell.source.name) ? spell.actions : undefined}
          saveDC={spell.dc ?? (spell.usesSpellcasting ? classSpellDC : undefined)}
          attackBonus={spell.attackBonus ?? (spell.usesSpellcasting && classSpellDC !== undefined ? classSpellDC - 10 : undefined)}
          inlineControls={<ItemSpellUses c={c} save={save} spell={spell} />}
          actionControls={spell.name === 'Bone Shield'
            ? <BoneShieldActions c={c} save={save} entry={spell.entry} rank={spell.rank} actions={spell.actions} />
            : spell.name === 'False Vitality'
            ? <FalseVitalityActions c={c} save={save} entry={spell.entry} rank={spell.rank} actions={spell.actions} />
            : spell.name === 'Summon Undead'
            ? <SummonUndeadActions c={c} save={save} entry={spell.entry} rank={spell.rank} />
            : spell.name === 'Marvelous Mount'
            ? <MarvelousMountActions c={c} save={save} entry={spell.entry} />
            : ['Summon Fiend', 'Summon Celestial'].includes(spell.name)
            ? <SummonFiendActions c={c} entries={entries} save={save} entry={spell.entry} rank={spell.rank} />
            : spell.name === 'Summon Plant or Fungus'
            ? <SummonPlantActions c={c} save={save} entry={spell.entry} rank={spell.rank} actions={spell.actions}
              slainCreatureRank={/^Shadowed Scale, the Jungle Secret$/i.test(spell.source.name)} />
            : spell.name === 'Soothe' || spell.name === 'Heal' || spell.name === 'Electric Arc'
            ? <SpellActions name={spell.name} entry={spell.entry} rank={spell.rank} actionOverride={spell.actions} />
            : spell.actions ? <ActionIcon actions={spell.actions}
            showOther={!/^10 minutes$/i.test(spell.actions.trim()) && !(spell.name === 'Creation' && /^1 minute$/i.test(spell.actions.trim()))} />
            : <SpellActions name={spell.name} entry={spell.entry} rank={spell.rank}
              spellcastingModifier={spell.usesSpellcasting && castAbility ? abilityMod(c.abilities[castAbility]) : undefined} />}
          note={spell.entry ? (spell.note && note ? `${spell.note}; ${note}` : spell.note ?? note) : <>{spell.note && `${spell.note}; `}{note && `${note}; `}
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
