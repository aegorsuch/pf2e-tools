import { Fragment, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { confirmRemoval } from './confirmRemoval'
import { EntryDescription } from './EntryDescription'
import { ActionIcon } from './ActionIcon'
import { RUNESMITH_RUNES } from './runesmithRunes'
import { DamageRoll, rollSpellDamage, rollTreehealerHealing } from './SpellDamage'
import { PickerDialog } from './PickerDialog'
import { DeferredContent, DeferredDetails } from './DeferredDetails'
import { sortPickerOptions } from './PickerSort'
import { MASTERMIND_SKILLS, activeFeatsNamed, ancestryFeatTraits, archetypesOf, automaticFeatGrants, byName, canUseGiantStature, cannyAcumenOptions, clanLoreLabel, conditionValue, eligibleFeats, featByName, featChoiceOptions, featSkillChoiceLabel, featEffectChange, featSelectionPrerequisiteChecker, featSelectionLevel, featTakenLevel, featType, giantStatureChange, giantStatureSize, homebrewDedication, investigatorSkillfulLessonSkills, isFeatEffectActive, isGrantedSlot, knownSpellNames, matchesSkill, plannedSlots, ranksAt, selectedClassArchetype, selectedFavoredTerrain, selectedFeatEntry, statDefs, subclassOptions, subclassSkillChoice, temporarySkillTrainings, type PlannedSlot, type SectionProps } from './builder'
import { AutomaticFeatChoice, CarryTheirMemoriesChoice, FeatChoice } from './FeatChoice'
import { isFixedAncestralWeaponFamiliarity } from './weaponFamiliarity'
import { featPrerequisiteSources, featPrerequisiteSuggestions, featSynergySuggestions } from './featPrerequisites'
import { actionOptionLabel } from './actionCost'
import { adoptedAncestryText, compareFeatSelections, featDisplayName } from './featChoices'
import { featAccess, featRarity, type FeatAccessCheck } from './featAccess'
import { DOMAIN_FEATS, automaticFeatChoiceKey, domainSpellDescription, featSpellOptions, fixedAncestralCantrip, isInnateSpellChoice, widespreadFascinationOptions } from './featSpells'
import type { Character, ContentEntry, FeatSlotCategory } from './types'
import type { PrerequisiteCheck } from './featPrerequisites'
import { getSettings } from './settings'
import { TORAG_BOON_FEAT_SLOT } from './divineIntercessions'
import { hellknightTrainingBenefit, ORDER_TRAINING_FEATS } from './hellknight'

interface FeatSlotsProps extends SectionProps {
  categories?: FeatSlotCategory[]
  title?: string
  bare?: boolean
  // Per-slot search text, held by the parent so this stays a pure render
  search?: Record<string, string>
  onSearch?: (key: string, text: string) => void
  pickerEligibility?: (slot: PlannedSlot) => ContentEntry[]
  pickerVariantCache?: Map<string, FeatOption[]>
  plannedFeatSlots?: PlannedSlot[]
}

function TreehealerRoll() {
  const [result, setResult] = useState<{ target: number; self: number }>()
  return <span>
    <button type="button" className="spell-action-button" aria-label="Roll Treehealer: Healing"
      title="10 minutes; Healing: 7d8+56 HP; you regain half the amount"
      onClick={() => setResult(rollTreehealerHealing())}>Roll healing</button>
    {result && <output aria-live="polite" aria-label="Treehealer healing result">
      Plant creature: {result.target} HP; you: {result.self} HP
    </output>}
  </span>
}

function BattlePrayerRoll({ c, entries }: Pick<SectionProps, 'c' | 'entries'>) {
  const [result, setResult] = useState<{ check: number; success: number; critical: number }>()
  const rank = Math.max(ranksAt(c, entries).Religion ?? 0,
    ...temporarySkillTrainings(c, entries).filter(training => training.skill === 'Religion').map(training => training.rank))
  const dice = rank >= 4 ? 3 : 1
  return <span>
    <button type="button" className="spell-action-button" aria-label={result ? 'Hide Battle Prayer result' : 'Roll Battle Prayer'}
      onClick={() => {
        if (result) { setResult(undefined); return }
        const check = rollSpellDamage({ label: 'Religion', dice: 1, sides: 20, type: '' })
        const success = rollSpellDamage({ label: 'Damage', dice, sides: 6, type: '' })
        const critical = success + rollSpellDamage({ label: 'Damage', dice, sides: 6, type: '' })
        setResult({ check, success, critical })
      }}><ActionIcon actions="Single Action" /></button>
    {result && <output aria-live="polite" aria-label="Battle Prayer result">
      {' '}Religion d20: {result.check} (add Religion modifier; compare with Will DC); success: {result.success} alignment damage;
      {' '}critical success: {result.critical} alignment damage
    </output>}
  </span>
}

const PAGE = 100

const classNamesCache = new WeakMap<ContentEntry[], Set<string>>()
function classNamesFor(entries: ContentEntry[]) {
  let names = classNamesCache.get(entries)
  if (!names) {
    names = new Set(entries.filter(entry => entry.kind === 'class').map(entry => entry.name))
    classNamesCache.set(entries, names)
  }
  return names
}

const selectedCheckCaches = new WeakMap<ContentEntry[], { context: string; checks: Map<string, PrerequisiteCheck> }>()
function selectedChecks(c: Character, entries: ContentEntry[]) {
  // Empty-slot layout and save timestamps do not affect a selected feat's prerequisites.
  const context = JSON.stringify([{ ...c, extraSlots: undefined, dismissedFeatSlots: undefined, updatedAt: undefined }, getSettings()])
  let cache = selectedCheckCaches.get(entries)
  if (!cache || cache.context !== context) {
    cache = { context, checks: new Map() }
    selectedCheckCaches.set(entries, cache)
  }
  return cache.checks
}

const LABEL: Record<FeatSlotCategory, string> = {
  class: 'Class', ancestry: 'Ancestry', skill: 'Skill', general: 'General', archetype: 'Dedication', bonus: 'Bonus',
}

type FeatOption = { entry: ContentEntry; choice?: string; mastermindSkill?: string; methodologySkill?: string; gunslingerSkill?: string; value: string; label: string; disabled?: boolean; prerequisites: PrerequisiteCheck; access?: FeatAccessCheck }

function FeatVariantGroup({ summary, autoOpen, count, renderOptions }: {
  summary: ReactNode; autoOpen: boolean; count: number; renderOptions: (limit: number) => ReactNode
}) {
  const [expanded, setExpanded] = useState(autoOpen)
  const [limit, setLimit] = useState(PAGE)
  return <details className="feat-variant-group" open={autoOpen} onToggle={event => {
    if (event.target === event.currentTarget) setExpanded(event.currentTarget.open)
  }}>
    <summary>{summary}</summary>
    {(expanded || autoOpen) && <ul className="feat-variant-list">
      {renderOptions(limit)}
      {count > limit && <li><button type="button" onClick={() => setLimit(previous => previous + PAGE)}>
        Show more ({count - limit} left, or use search)
      </button></li>}
    </ul>}
  </details>
}

const FEAT_ACTION_CONTROLS = new Set(["Giant's Lunge", 'Desperate Wrath', 'Come and Get Me', "Giant's Stature", "Infused with Belkzen's Might", 'Heroic Defiance'])
const FEAT_ACTION_TITLES: Record<string, string> = {
  "Giant's Lunge": 'Melee reach becomes at least 10 feet until Rage ends.',
  'Desperate Wrath': 'Activate when your turn starts at half HP or less; ends above half HP or when Rage ends.',
  'Come and Get Me': 'While active, you are off-guard and attacks against you gain +2 circumstance damage.',
  "Infused with Belkzen's Might": 'Expend one use of Living History; lasts until the end of your next turn.',
  'Heroic Defiance': 'Activate when you gain doomed; lasts 1 minute. Once per 10 minutes.',
}

function FeatActionControls({ c, entries, save, entry }: SectionProps & { entry?: ContentEntry }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const name = entry?.name
  if (!entry || !name || !FEAT_ACTION_CONTROLS.has(name) || !activeFeatsNamed(c, name).length) return null
  const actions = typeof entry.data.actions === 'string' ? entry.data.actions : ''
  const giantStature = name === "Giant's Stature"
  const canGrow = giantStature && canUseGiantStature(c, entries)
  const size = giantStature ? giantStatureSize(c, entries) : undefined
  return <>
    <button type="button" className="spell-action-button" aria-label={`${name} options`} aria-haspopup="dialog"
      onClick={() => { dialog.current?.showModal(); dialog.current?.querySelector('h4')?.focus() }}>
      {actions ? <ActionIcon actions={actions} showOther /> : 'Options'}
    </button>
    <dialog ref={dialog} className="entry-dialog" aria-labelledby={titleId}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <h4 id={titleId} tabIndex={-1}>{name}</h4>
      {giantStature ? <label>Size{' '}
        <select aria-label="Giant's Stature size" value={size ?? ''} disabled={!canGrow || !!size}
          onChange={event => {
            const value = event.target.value
            if (!canGrow || size || value !== 'Large' && value !== 'Huge'
              || value === 'Huge' && !activeFeatsNamed(c, "Titan's Stature").length) return
            save(giantStatureChange(c, value))
          }}>
          <option value="">Normal size</option>
          <option value="Large">Large</option>
          {!!activeFeatsNamed(c, "Titan's Stature").length && <option value="Huge">Huge</option>}
        </select>
      </label> : <label title={FEAT_ACTION_TITLES[name]}>
        <input type="checkbox" aria-label={`${name} active`} checked={isFeatEffectActive(c, name)}
          disabled={name !== "Infused with Belkzen's Might" && name !== 'Heroic Defiance' && !c.raging && !isFeatEffectActive(c, name)}
          onChange={event => save(featEffectChange(c, name, event.target.checked))} /> {name} active
      </label>}
      <form method="dialog"><button autoFocus>Close</button></form>
    </dialog>
  </>
}

export function SearchableFeatSlots(props: Omit<FeatSlotsProps, 'search' | 'onSearch' | 'pickerEligibility'>) {
  const [search, setSearch] = useState<Record<string, string>>({})
  const pickerEligibility = useMemo(() => featPickerEligibility(props.c, props.entries), [props.c, props.entries])
  const settings = JSON.stringify(getSettings())
  const cache = useMemo(() => ({
    context: [props.c, props.entries, settings] as const,
    options: new Map<string, FeatOption[]>(),
  }), [props.c, props.entries, settings])
  const pickerVariantCache = cache.options
  const body = () => <FeatSlots {...props} bare search={search} pickerEligibility={pickerEligibility} pickerVariantCache={pickerVariantCache}
    onSearch={(key, text) => setSearch(previous => ({ ...previous, [key]: text }))} />
  if (props.bare) return body()
  const allSlots = props.plannedFeatSlots ?? plannedSlots(props.c, props.entries)
  const slots = [...allSlots, ...(props.categories?.includes('archetype') ? classArchetypeSlotViews(props.c, props.entries, allSlots) : [])]
    .filter(slot => !props.categories || props.categories.includes(slot.displayCategory ?? slot.category))
  const { backgroundFeats, automaticFeats, memories } = featSectionGrants(props.c, props.entries, props.categories, allSlots)
  const grantedCount = backgroundFeats.length + automaticFeats.length + memories.length
  const filled = slots.filter(slot => props.c.feats.some(feat => feat.slot === slot.key)).length + grantedCount
  return <DeferredDetails className="character-subsection">
    <summary><h4>{props.title ?? 'Feat slots'} {filled}/{slots.length + grantedCount}</h4></summary>
    <DeferredContent>{body}</DeferredContent>
  </DeferredDetails>
}

export function featPickerEligibility(c: Character, entries: ContentEntry[]) {
  let previousSettings = getSettings()
  const cached = new Map<string, ContentEntry[]>()
  return (slot: PlannedSlot) => {
    const key = JSON.stringify(slot)
    const settings = getSettings()
    if (settings !== previousSettings) {
      cached.clear()
      previousSettings = settings
    }
    const previous = cached.get(key)
    if (previous) {
      cached.delete(key)
      cached.set(key, previous)
      return previous
    }
    const result = eligibleFeats(entries, c, slot, { includeUnmetPrerequisites: true })
    if (cached.size >= 32) cached.delete(cached.keys().next().value!)
    cached.set(key, result)
    return result
  }
}

export function featSectionGrants(c: Character, entries: ContentEntry[], categories?: FeatSlotCategory[], allSlots = plannedSlots(c, entries)) {
  const featsByName = featByName(entries)
  const grantedType = (name: string) => {
    const entry = featsByName.get(name)
    return entry ? featType(entry, c) : ['Untrained Improvisation', 'Shield Block'].includes(name) ? 'General Feat' : 'Skill Feat'
  }
  const background = byName(entries, 'background', c.background)
  const backgroundFeats = typeof background?.data.feat === 'string'
    ? background.data.feat.split(',').flatMap((name) => {
      const feat = byName(entries, 'feat', name.trim())
      return feat && !allSlots.some(slot => slot.grantedBy === background?.name && slot.grantedFeat === feat.name)
        && (!categories || categories.some((category) => featType(feat, c) === `${LABEL[category]} Feat`))
        ? [feat] : []
    }) : []
  const grants = !categories || categories.some(category => ['class', 'skill', 'general', 'ancestry'].includes(category))
    ? automaticFeatGrants(c, entries) : []
  const automaticFeats = grants.filter((grant) =>
      (!categories || categories.some(category => grantedType(grant.name) === `${LABEL[category]} Feat`))
      && (grant.name === 'Additional Lore' || grant.name === 'Augmented Body' && !getSettings().singleAugmentedBody || grant.name === 'Assurance' && (grant.source.startsWith('Exceptional Artisan (') || grant.source === 'Test-Subject Ysoki' || grant.source === 'Gnome Obsession' || grant.source === 'From the Shadows Leadership Perk' || grant.source.startsWith('Effortless Influencer ('))
        || !c.feats.some((feat) => feat.name === grant.name && featTakenLevel(feat) <= c.level))
      && !backgroundFeats.some((feat) => feat.name === grant.name))
    .map(grant => ({ ...grant, fixedLore: grant.name === 'Additional Lore' && !!grant.choice, choice: grant.choice
      ?? c.automaticFeatChoices?.[grant.choiceKey ?? automaticFeatChoiceKey(grant.source, grant.name)] }))
    .filter((grant, index, all) => {
      if (grant.name === 'Augmented Body' && getSettings().singleAugmentedBody)
        return all.findIndex(other => other.name === grant.name) === index
      if (grant.name !== 'Additional Lore' || !grant.choice) return true
      const key = grant.choice.trim().replace(/\s+lore$/i, '').toLowerCase()
      const matches = all.filter(other => other.name === 'Additional Lore'
        && other.choice?.trim().replace(/\s+lore$/i, '').toLowerCase() === key)
      const preferred = matches.find(other => other.source !== 'Ancestral Skills') ?? matches[0]
      return all.indexOf(preferred) === index
    })
  const memories = !categories || categories.includes('skill')
    ? c.feats.flatMap((feat, index) => feat.name === 'Carry Their Memories' && featTakenLevel(feat) <= c.level
      ? [{ kind: 'memory' as const, level: featTakenLevel(feat), index, feat: { name: 'Assurance', choice: feat.choice } }] : [])
    : []
  return { background, backgroundFeats, grants, automaticFeats, memories, grantedType }
}

function arcanaChoiceCandidates(entries: ContentEntry[], name: string) {
  const matches = entries.filter(entry => entry.kind === 'feat' && !entry.deleted && entry.name === name && entry.systems.includes('pf2e'))
  const wizard = matches.filter(entry => entry.traits.some(trait => trait.toLowerCase() === 'wizard'))
  const pool = wizard.length ? wizard : matches
  return pool.find(entry => entry.description.trim()) ?? pool[0]
}

export function classArchetypeSlotViews(c: Character, entries: ContentEntry[], slots: PlannedSlot[]) {
  if (selectedClassArchetype(c, entries)?.name !== 'Warrior of Legend') return []
  return slots.filter(slot => slot.category === 'class' && !slot.displayCategory && !slot.grantedBy
    && !c.feats.some(feat => feat.slot === slot.key) && !c.skippedFeatSlots?.includes(slot.key))
    .map(slot => ({ ...slot, displayCategory: 'archetype' as const }))
}

export function FeatSlots({ c, entries, save, categories, title = 'Feat slots', bare, search = {}, onSearch,
  pickerEligibility, pickerVariantCache, plannedFeatSlots }: FeatSlotsProps) {
  const checks = selectedChecks(c, entries)
  const selectedPrerequisites = (slot: PlannedSlot, entry: ContentEntry) => {
    const key = JSON.stringify([slot, entry])
    let result = checks.get(key)
    if (!result) {
      result = featSelectionPrerequisiteChecker(c, entries, slot)(entry)
      checks.set(key, result)
    }
    return result
  }
  const allSlots = plannedFeatSlots ?? plannedSlots(c, entries)
  const featsByName = featByName(entries)
  const { background, backgroundFeats, grants, automaticFeats, memories, grantedType } = featSectionGrants(c, entries, categories, allSlots)
  const slots = [...allSlots, ...(categories?.includes('archetype') ? classArchetypeSlotViews(c, entries, allSlots) : [])]
    .filter((slot) => !categories || categories.includes(slot.displayCategory ?? slot.category))
    .sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level
      const aFeat = c.feats.find((feat) => feat.slot === a.key)
      const bFeat = c.feats.find((feat) => feat.slot === b.key)
      if (!aFeat || !bFeat) return Number(!aFeat) - Number(!bFeat)
      return compareFeatSelections(aFeat, bFeat)
    })
  const knownFeats = [...c.feats.filter(feat => featTakenLevel(feat) <= c.level).map(feat => feat.name),
    ...grants.map(feat => feat.name), ...String(background?.data.feat ?? '').split(',').map(name => name.trim())]
  const suggestions = slots.some(slot => ['general', 'skill'].includes(slot.category)
    && (!onSearch || search[`${slot.key}:open`] === '1'))
    ? featPrerequisiteSuggestions(entries, { className: c.className, ancestryTraits: ancestryFeatTraits(c), knownFeats })
    : new Map<string, string[]>()
  const synergies = slots.some(slot => ['general', 'skill'].includes(slot.category)
    && (!onSearch || search[`${slot.key}:open`] === '1'))
    ? featSynergySuggestions(entries, { knownFeats, systems: c.systems })
    : new Map<string, string[]>()
  const matches = (o: ContentEntry, query: string, unlocks: string[] = []) => !query
    || [o.name, adoptedAncestryText(c, featDisplayName(o)), String(o.data.archetype ?? ''), ...o.traits, ...unlocks].some((t) => t.toLowerCase().includes(query))
  const isDedication = (o?: ContentEntry) => !!o?.traits.some((t) => /^dedication$/i.test(t))
  const classArchetype = selectedClassArchetype(c, entries)?.name
  const isClassArchetypeFeat = (entry: ContentEntry) => !!classArchetype
    && entry.traits.some(trait => /^archetype$/i.test(trait)) && archetypesOf(entry).includes(classArchetype)
  const standardKeys = new Set(plannedSlots({ ...c, extraSlots: [] }).map((slot) => slot.key))
  const aboveLevel = c.feats.filter((f) => {
    if (!f.slot) return false
    const category = f.slot.split(':')[0] as FeatSlotCategory
    return (!categories || categories.includes(allSlots.find(slot => slot.key === f.slot)?.displayCategory ?? category))
      && !allSlots.some((slot) => slot.key === f.slot)
  })
  const classNames = classNamesFor(entries)
  const displayName = (name: string) => adoptedAncestryText(c, featDisplayName(featsByName.get(name), name === 'Living Weapon Joust' ? 'Living Weapon Jousting' : name))
    .replace(/ \(([^)]+)\)$/, (suffix, label: string) =>
      classNames.has(label) || label === c.className || label === classArchetype ? '' : suffix)
  const fixedLabel = (name: string, sourceId?: string) => {
    if (name === 'Ancestral Cantrip') {
      const spell = fixedAncestralCantrip(c, entries, sourceId)
      return spell && (entries.find(entry => entry.kind === 'spell' && entry.name.toLowerCase() === spell.toLowerCase())?.name
        ?? spell.replace(/\b\w/g, char => char.toUpperCase()))
    }
    if (name !== 'Creature Speech') return undefined
    const source = selectedFeatEntry(c, entries, name, sourceId)
    const option = /Option\(s\):\s*([^\n]+)/i.exec(source?.description ?? '')?.[1]?.trim()
    return option && (source?.traits.some(trait => trait.toLowerCase() === 'ysoki') && option.toLowerCase() === 'rodents'
      ? 'Rats' : option.replace(/^[a-z]/, char => char.toUpperCase()))
  }
  const choiceLabel = (name: string, choice: string) => name === 'Researched Spell Resistance' ? choice.split(',').map(value => value.trim()).sort().join(', ')
    : name === 'Clan Lore' ? clanLoreLabel(choice)
    : name === 'Widespread Fascination' ? entries.find(entry => entry.kind === 'subclass'
      && entry.data.class === 'Necromancer' && entry.data.grants_focus_spells === choice)?.name ?? choice
    : name === 'Bone Magic' ? choice.replace(/^occult\|Void Warp$/, 'primal|Void Warp')
      .replace(/^(occult|primal)\|/, (_, tradition: string) => `${tradition[0].toUpperCase()}${tradition.slice(1)}: `)
    : name === 'Order Explorer' || name === 'Order Magic' ? `${choice} Order` : featSkillChoiceLabel(name, choice)
  const subclassDescription = (name: string, choice?: string) => {
    const classes: Record<string, string> = { 'Versatile Rogue': 'Rogue', 'Versatile Investigator': 'Investigator', 'Multifarious Muse': 'Bard',
      'Versatile Gunslinger': 'Gunslinger', 'Versatile Envoy': 'Envoy', 'Versatile Operative': 'Operative',
      'Second Innovation': 'Inventor', 'Third Innovation': 'Inventor', 'Order Explorer': 'Druid' }
    const className = classes[name]
    if (!choice || !className) return undefined
    const names = [choice, `${choice} Order`, ...(choice === 'Wild' ? ['Untamed', 'Untamed Order'] : [])]
    const entry = name === 'Versatile Envoy' || name === 'Versatile Operative'
      ? subclassOptions({ ...c, className }, entries).find(candidate => names.includes(candidate.name))
      : entries.find(candidate => !candidate.deleted && candidate.data.class === className
        && (candidate.kind === 'subclass' || candidate.kind === 'classFeature') && names.includes(candidate.name))
    return entry?.description ? `${choiceLabel(name, choice)}: ${entry.description}`
      : `${choiceLabel(name, choice)} description unavailable in loaded content.`
  }
  const cannyOptions = new Set(cannyAcumenOptions(c, entries))
  let knownSpells: Set<string> | undefined
  const prerequisiteChecks = new Map<string, ReturnType<typeof featSelectionPrerequisiteChecker>>()
  const prerequisitesFor = (entry: ContentEntry, slot: PlannedSlot) => {
    let check = prerequisiteChecks.get(slot.key)
    if (!check) {
      check = featSelectionPrerequisiteChecker(c, entries, slot)
      prerequisiteChecks.set(slot.key, check)
    }
    return check(entry)
  }
  const optionsFor = (entry: ContentEntry, slot: PlannedSlot, skill = ''): FeatOption[] => {
    const prerequisites = prerequisitesFor(entry, slot)
    const unmet = prerequisites.missing.length > 0
    const access = featAccess(c, entry)
    const details = { prerequisites, access }
    const rarity = featRarity(entry)
    const accessMissing = access && !access.automatic && !access.approved
    const unlocks = ['general', 'skill'].includes(slot.category) ? suggestions.get(entry.name) : undefined
    const pairs = ['general', 'skill'].includes(slot.category) ? synergies.get(entry.name) : undefined
    const fixed = fixedLabel(entry.name, entry.id)
    const label = `${actionOptionLabel(displayName(entry.name), entry)}${fixed ? ` (${fixed})` : ''}${unlocks?.length ? ` (Unlocks ${unlocks.map(displayName).join(', ')})` : ''}${pairs?.length ? ` (Pairs with ${pairs.map(displayName).join(', ')})` : ''}${rarity ? ` (${rarity})` : ''}${unmet ? ` * Missing ${prerequisites.missing.join('; ')}` : prerequisites.manual.length ? ' (check prerequisites)' : ''}${accessMissing
      ? ` * Access: ${access.requirement}` : ''}`
    const allChoices = ['Ancestral Magic', 'Otherworldly Acumen'].includes(entry.name)
      || entry.name === 'Ancestral Cantrip' && !fixed
      ? [...new Set((featSpellOptions(c, entries, { name: entry.name, type: 'Ancestry Feat', level: entry.level,
        slot: slot.key, takenLevel: slot.level, sourceId: entry.id }) ?? []).map(spell => spell.name))]
      : ['Free Heart', 'Ancestral Linguistics', 'Ancestral Longevity', 'Expert Longevity'].includes(entry.name)
      ? undefined : featChoiceOptions(entry.name, c, entries, slot.key, undefined, slot.category)
    const lessonSkills = slot.grantedBy === "Investigator's Skillful Lessons"
      ? investigatorSkillfulLessonSkills(c, entries, slot.level) : undefined
    const currentChoice = c.feats.find(feat => feat.slot === slot.key && feat.name === entry.name)?.choice
    const choices = allChoices?.filter(choice => (!getSettings().uniqueInnateSpellChoices || !isInnateSpellChoice(entry)
      || choice === currentChoice || !(knownSpells ??= knownSpellNames(c, entries)).has(choice.replace(/^(?:occult|primal)\|/i, '').toLowerCase()))
      && (!skill || entry.name !== 'Skill Training' || choice === skill)
      && (slot.grantedBy !== 'Palewatch Initiate' || !slot.redundantFeat
        || !['Assurance', 'Skill Training'].includes(entry.name) || choice === slot.grantedSkill)
      && (!lessonSkills || lessonSkills.some(lessonSkill => choice === lessonSkill
        || /Lore$/i.test(lessonSkill) && /^Lore$/i.test(choice))))
    if (choices?.length === 0 && unmet) return [{ entry, value: entry.name, disabled: true, label, ...details }]
    return choices !== undefined
      ? choices.flatMap((choice) => {
        const noImprovement = entry.name === 'Canny Acumen' && !cannyOptions.has(choice)
        const disabled = unmet || !!accessMissing || noImprovement
        if (entry.name === 'Versatile Rogue' && choice === 'Mastermind') return MASTERMIND_SKILLS.map(mastermindSkill => ({
          entry, choice, mastermindSkill, disabled, value: JSON.stringify([entry.name, choice, mastermindSkill]), ...details,
          label: `${label} (Mastermind - ${mastermindSkill})`,
        }))
        if (entry.name === 'Versatile Investigator') {
          const skillChoice = subclassSkillChoice({ ...c, className: 'Investigator', subclass: choice }, entries)
          if (skillChoice?.options.length) return skillChoice.options.map(methodologySkill => ({
            entry, choice, methodologySkill, disabled, value: JSON.stringify([entry.name, choice, methodologySkill]), ...details,
            label: `${label} (${choice} - ${methodologySkill})`,
          }))
        }
        if (entry.name === 'Versatile Gunslinger') {
          const skillChoice = subclassSkillChoice({ ...c, className: 'Gunslinger', subclass: choice }, entries)
          if (skillChoice?.options.length) return skillChoice.options.map(gunslingerSkill => ({
            entry, choice, gunslingerSkill, disabled, value: JSON.stringify([entry.name, choice, gunslingerSkill]), ...details,
            label: `${label} (${choice} - ${gunslingerSkill})`,
          }))
        }
        return [{ entry, choice, disabled, value: JSON.stringify([entry.name, choice]), label: `${label} (${choiceLabel(entry.name, choice)}${noImprovement ? ' - no improvement' : ''})`, ...details }]
      })
      : [{ entry, value: entry.name, label, disabled: unmet || !!accessMissing, ...details }]
  }
  const cachedOptionsFor = (entry: ContentEntry, slot: PlannedSlot, skill = '') => {
    if (!pickerVariantCache) return optionsFor(entry, slot, skill)
    const key = JSON.stringify([slot.key, entry.id, skill, suggestions.get(entry.name) ?? [], synergies.get(entry.name) ?? []])
    const cached = pickerVariantCache.get(key)
    if (cached) {
      pickerVariantCache.delete(key)
      pickerVariantCache.set(key, cached)
      return cached
    }
    const result = optionsFor(entry, slot, skill)
    if (pickerVariantCache.size >= 4096) pickerVariantCache.delete(pickerVariantCache.keys().next().value!)
    pickerVariantCache.set(key, result)
    return result
  }
  const saveFeatChanges = (patch: Partial<Character>) => {
    const next = { ...c, ...patch }
    const savedLevel = Math.max(next.level, ...next.feats.map(featTakenLevel))
    let feats = next.feats
    let keys: Set<string>
    for (;;) {
      keys = new Set(plannedSlots({ ...next, feats, level: savedLevel, dismissedFeatSlots: [] }, entries).map((slot) => slot.key))
      const retained = feats.filter((feat) => !feat.slot || !isGrantedSlot(feat.slot) || keys.has(feat.slot))
      if (retained.length === feats.length) break
      feats = retained
    }
    const remaining = new Set(feats.map((feat) => feat.name))
    const removed = new Set(c.feats.filter((feat) => !remaining.has(feat.name)).map((feat) => feat.name))
    const removedIds = new Set(entries.filter((entry) => entry.kind === 'feat' && removed.has(entry.name)).map((entry) => entry.id))
    const visibleKeys = new Set(plannedSlots({ ...next, feats }, entries).map((slot) => slot.key))
    save({
      ...patch, feats, entryIds: next.entryIds.filter((id) => !removedIds.has(id)),
      featAccessOverrides: next.featAccessOverrides?.filter(id => !removedIds.has(id)),
      skippedFeatSlots: next.skippedFeatSlots?.filter(key => !isGrantedSlot(key) || keys.has(key)),
      dismissedFeatSlots: (next.dismissedFeatSlots ?? []).filter((key) => !visibleKeys.has(key) && (!isGrantedSlot(key) || keys.has(key))),
    })
  }
  const choose = (key: string, category: FeatSlotCategory, level: number, name: string, sourceId?: string) => {
    const slot = allSlots.find((slot) => slot.key === key) ?? { key, category, level }
    if (slot.grantedBy === 'Eldritch Trickster' && name === 'N/A') return
    const wantedName = name.startsWith('[') ? (JSON.parse(name) as string[])[0] : name
    const option = eligibleFeats(entries, c, slot, { name: wantedName }).filter(entry => entry.name === wantedName)
      .flatMap((entry) => cachedOptionsFor(entry, slot))
      .find((option) => option.value === name && !option.disabled && (!sourceId || option.entry.id === sourceId))
    if (name && name !== 'N/A' && !option) return
    const changedAncestry = slot.grantedBy === 'Social Chameleon' && category === 'general'
      && c.feats.find(feat => feat.slot === key)?.choice !== option?.choice
    const ancestryKey = key.replace(/^general:/, 'ancestry:')
    const feats = c.feats.filter((f) => f.slot !== key && !(changedAncestry && f.slot === ancestryKey))
    const entryIds = [...c.entryIds]
    if (option) {
      const { entry, choice } = option
      feats.push({ name: entry.name, type: `${LABEL[category]} Feat`, level: entry.level, slot: key,
        ...(category === 'ancestry' || entry.traits.some(trait => trait.toLowerCase() === 'skill')
          || ['Ancestral Cantrip', 'Ancestral Magic', 'Ancestral Weapon Familiarity'].includes(entry.name) ? { sourceId: entry.id } : {}),
        ...(key === 'ancestry:1:elders-deeds'
          ? { takenLevel: featTakenLevel(activeFeatsNamed(c, "Inscribed with Elders' Deeds")[0]) }
          : slot.level !== Number(key.split(':')[1]) ? { takenLevel: slot.level } : {}), ...(choice ? { choice } : {}) })
      if (!entryIds.includes(entry.id)) entryIds.push(entry.id)
    }
    const skippedFeatSlots = (c.skippedFeatSlots ?? []).filter((slot) => slot !== key)
    if ((category === 'archetype' || category === 'ancestry' || key === 'skill:4:0') && name === 'N/A') skippedFeatSlots.push(key)
    saveFeatChanges({ feats, entryIds, skippedFeatSlots,
      ...(option?.mastermindSkill ? { rogueRacketSkills: { ...c.rogueRacketSkills, Mastermind: option.mastermindSkill } } : {}),
      ...(option?.methodologySkill && option.choice ? {
        subclassSkillChoices: { ...c.subclassSkillChoices, [`Investigator:${option.choice}`]: option.methodologySkill },
      } : {}),
      ...(option?.gunslingerSkill && option.choice ? {
        subclassSkillChoices: { ...c.subclassSkillChoices, [`Gunslinger:${option.choice}`]: option.gunslingerSkill },
      } : {}) })
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
    const dismissed = c.dismissedFeatSlots?.length ? plannedSlots({ ...c, dismissedFeatSlots: [] }, entries).find((slot) =>
      slot.category === category && slot.level === level && c.dismissedFeatSlots?.includes(slot.key) && !allSlots.some((visible) => visible.key === slot.key)) : undefined
    if (dismissed) save({ dismissedFeatSlots: c.dismissedFeatSlots?.filter((key) => key !== dismissed.key) })
    else save({ extraSlots: [...c.extraSlots, { category, level, count: 1 }] })
  }
  const removeSlot = (slot: PlannedSlot, extra: boolean) => {
    const selection = c.feats.find((feat) => feat.slot === slot.key)
    const remove = () => {
      if (slot.key === 'skill:4:0' || slot.grantedFeat || slot.redundantFeat || slot.grantedAncestry || slot.grantedBy === 'Versatile Rogue' || slot.grantedBy === 'Eldritch Trickster' || slot.grantedBy === 'Order Explorer' || slot.grantedBy === "Officer's Education" || slot.grantedBy === "Mechanic's Ingenuity" || slot.grantedBy === "Operative's Specialization" || slot.grantedBy === 'Versatile Operative' || slot.grantedBy === 'Sniper' || slot.grantedBy === 'Social Chameleon' || slot.grantedBy === 'Natural Performer' || slot.grantedBy === 'Pitborn' || slot.grantedBy === 'Captain Dedication' || slot.grantedBy === 'Scion of Many Planes' || slot.grantedBy === 'In Another Life'
        || allSlots.filter((other) => other.category === slot.category && other.level === slot.level).length === 1) {
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
  const grantedCount = backgroundFeats.length + automaticFeats.length + memories.length
  const rows = [
    ...backgroundFeats.map(feat => ({ kind: 'background' as const, level: 1, feat })),
    ...automaticFeats.map(feat => ({ kind: 'automatic' as const, level: feat.level, feat })),
    ...memories,
    ...slots.map((slot, index) => ({ kind: 'slot' as const, level: slot.level, slot, index })),
  ].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level
    if (categories?.length !== 1 || !['general', 'skill'].includes(categories[0])) return 0
    const aFeat = a.kind === 'slot' ? c.feats.find(feat => feat.slot === a.slot.key) : a.feat
    const bFeat = b.kind === 'slot' ? c.feats.find(feat => feat.slot === b.slot.key) : b.feat
    if (!aFeat || !bFeat) return Number(!aFeat) - Number(!bFeat)
    return displayName(aFeat.name).localeCompare(displayName(bFeat.name)) || compareFeatSelections(aFeat, bFeat)
  })
  const Wrapper = bare ? 'div' : 'details'
  return (
    <Wrapper className={bare ? undefined : 'character-subsection'}>
      {!bare && <summary><h4>{title} {slots.filter(slot => c.feats.some(feat => feat.slot === slot.key)).length + grantedCount}/{slots.length + grantedCount}</h4></summary>}
      <ul className="feat-slot-list">
        {rows.map((row, rowIndex) => {
          const newLevel = rowIndex === 0 || rows[rowIndex - 1].level !== row.level
          const heading = !multi && newLevel
            ? <li className="feat-level-heading">Level {String(row.level).padStart(2, '0')}</li> : null
          if (row.kind === 'memory') return <Fragment key={`memory:${row.index}`}>
            {heading}
            <li className={`feat-slot-row automatic-feat-row${multi && rowIndex > 0 && newLevel ? ' feat-level-start' : ''}`}>
              <EntryDescription character={c} name="Assurance" entry={featsByName.get('Assurance')} entries={entries}
                className="feat-name" grantSource="Carry Their Memories (temporary)" deferDetails={!!onSearch} />
              <CarryTheirMemoriesChoice c={c} entries={entries} save={save} index={row.index} />
              <button type="button" aria-label={`Add L${String(row.level).padStart(2, '0')} Skill feat slot`}
                onClick={() => addSlot('skill', row.level)}>+</button>
            </li>
          </Fragment>
          if (row.kind !== 'slot') {
            const { feat } = row
            const background = row.kind === 'background'
            const entry = background ? row.feat : featsByName.get(feat.name)
            const category = (['class', 'ancestry', 'skill', 'general', 'archetype', 'bonus'] as const)
              .find(category => grantedType(feat.name) === `${LABEL[category]} Feat`) ?? 'bonus'
            return <Fragment key={`${row.kind}:${feat.name}:${row.kind === 'automatic' ? row.feat.choiceKey ?? `${row.feat.source}:${row.feat.choice ?? ''}` : ''}`}>
              {heading}
              <li className={`feat-slot-row ${background ? 'background' : 'automatic'}-feat-row${multi && rowIndex > 0 && newLevel ? ' feat-level-start' : ''}`}>
                {background && grantedType(feat.name) !== 'Skill Feat' && multi && <span>L{String(row.level).padStart(2, '0')} Background {grantedType(feat.name)}</span>}
                {!(row.kind === 'automatic' && feat.name === 'Additional Lore' && row.feat.source === 'Nephilim Lore') && <EntryDescription character={c} name={`${displayName(feat.name)}${row.kind === 'automatic' && row.feat.choice ? ` (${row.feat.choice})` : ''}`}
                  entry={entry} choice={row.kind === 'automatic' ? row.feat.choice : undefined} entries={entries} className="feat-name" access={entry ? featAccess(c, entry) : undefined}
                  grantSource={row.kind === 'automatic' ? row.feat.source : c.background} deferDetails={!!onSearch} />}
                {row.kind === 'automatic' && !row.feat.fixedLore && <AutomaticFeatChoice c={c} entries={entries} save={save}
                  name={feat.name} source={row.feat.source} choice={row.feat.choice}
                  choiceKey={row.feat.choiceKey} choiceIndex={row.feat.choiceIndex} />}
                <button type="button" aria-label={`Add L${String(row.level).padStart(2, '0')} ${LABEL[category]} feat slot`}
                  onClick={() => addSlot(category, row.level)}>+</button>
              </li>
            </Fragment>
          }
          const { slot: s } = row
          const current = c.feats.find((f) => f.slot === s.key)?.name ?? (c.skippedFeatSlots?.includes(s.key) ? 'N/A' : '')
          const featIndex = c.feats.findIndex((f) => f.slot === s.key)
          const selection = c.feats[featIndex]
          const selectedChoices = selection ? featChoiceOptions(selection.name, c, entries, s.key, featIndex, s.category) : undefined
          const selectedChoice = selection && (['Elemental Wrath', 'Ancestral Linguistics', 'Ancestral Longevity', 'Expert Longevity', 'Tattooed Historian Dedication', 'Captain Dedication', 'Carry Their Memories',
            'Cite the Deep Lore', "Diplomat's Facade", 'Broken Hand Technique', 'Spelunker', 'Core Attunement', 'Divine Warrior', 'Primal Warrior', 'Eye for Treasure', 'Expressive Face', "Officer's Medical Training", 'Shiny', 'Adaptive Visual Receptors', 'Additional Arms', 'Augmented Body', 'Distant Telepath'].includes(selection.name)
            || c.systems.includes('sf2e') && ['Lashunta', 'Shirren'].includes(c.ancestry ?? '') && ['Creature Shape', 'Creature Ally'].includes(selection.name)
            || isFixedAncestralWeaponFamiliarity(c, entries, selection)) ? undefined
            : selection?.name === 'Favored Terrain' ? selectedFavoredTerrain(c) ?? selection.choice : selection?.choice
          const selectedLabel = selection?.name === 'Versatile Rogue' && selectedChoice === 'Mastermind' && c.rogueRacketSkills?.Mastermind
            ? `Mastermind - ${c.rogueRacketSkills.Mastermind}`
            : selection?.name === 'Versatile Investigator' && selectedChoice && c.subclassSkillChoices?.[`Investigator:${selectedChoice}`]
              ? `${selectedChoice} - ${c.subclassSkillChoices[`Investigator:${selectedChoice}`]}`
              : selection?.name === 'Versatile Gunslinger' && selectedChoice && c.subclassSkillChoices?.[`Gunslinger:${selectedChoice}`]
                ? `${selectedChoice} - ${c.subclassSkillChoices[`Gunslinger:${selectedChoice}`]}`
              : selectedChoice && choiceLabel(selection?.name ?? '', selectedChoice)
          const fixedOrSelectedLabel = selection && (fixedLabel(selection.name, selection.sourceId) ?? selectedLabel)
          const selectedName = selection
            ? `${displayName(selection.name)}${fixedOrSelectedLabel ? ` (${fixedOrSelectedLabel})` : ''}` : current
          const sources = selection ? featPrerequisiteSources(entries, {
            ...c, name: current, category: s.category, ancestryTraits: ancestryFeatTraits({ ...c, level: Math.min(c.level, s.level) }),
          }) : []
          const currentEntry = sources.find(source => source.id === selection?.sourceId) ?? sources[0] ?? featByName(entries).get(current)
          const arcanaChoiceEntry = selection && ['Basic Arcana', 'Advanced Arcana'].includes(selection.name)
            && selection.choice ? arcanaChoiceCandidates(entries, selection.choice) : undefined
          const descriptionEntry = arcanaChoiceEntry ?? currentEntry
          const descriptionName = arcanaChoiceEntry ? displayName(arcanaChoiceEntry.name) : selectedName
          const showFeatActionControls = !!currentEntry && FEAT_ACTION_CONTROLS.has(currentEntry.name)
            && !!activeFeatsNamed(c, currentEntry.name).length
          const showWrathRoll = currentEntry?.name === 'Wrath of the Hold' && !!activeFeatsNamed(c, currentEntry.name).length
          const showTreehealerRoll = c.systems.includes('pf2e') && currentEntry?.name === 'Treehealer'
            && !!activeFeatsNamed(c, currentEntry.name).length
          const showBattlePrayerRoll = c.systems.includes('pf2e') && currentEntry?.name === 'Battle Prayer'
            && !!activeFeatsNamed(c, currentEntry.name).length
          const showPiercingDoom = c.systems.includes('pf2e') && currentEntry?.name === 'Piercing Doom'
            && !!activeFeatsNamed(c, currentEntry.name).length
          const showInscribedBlast = c.systems.includes('pf2e') && currentEntry?.name === 'Inscribed Blast' && !!activeFeatsNamed(c, currentEntry.name).length
          const showCoreCannon = c.systems.includes('pf2e') && currentEntry?.name === 'Core Cannon' && !!activeFeatsNamed(c, currentEntry.name).length
          const tattooRune = c.systems.includes('pf2e') && currentEntry?.name === 'Runic Tattoo' && activeFeatsNamed(c, currentEntry.name).length
            ? RUNESMITH_RUNES.find(rune => rune.name === selection?.choice) : undefined
          const showAcidicSpitRoll = c.systems.includes('sf2e') && currentEntry?.name === 'Acidic Spit'
            && !!activeFeatsNamed(c, currentEntry.name).length
          const access = currentEntry ? featAccess(c, currentEntry) : undefined
          const ambiguous = new Set(sources.map((entry) => String(entry.data.prerequisite ?? ''))).size > 1
          const ruleGranted = activeFeatsNamed(c, current).some(feat => feat.slot === s.key)
            && (homebrewDedication(s.key)?.name === current || s.key === 'class:2:0' && s.grantedFeat === current)
          const prerequisites = ambiguous && !ruleGranted ? { missing: [], manual: [`Verify source version of ${current}`] }
            : currentEntry ? selectedPrerequisites(s, currentEntry) : undefined
          const picksType = s.category === 'archetype'
          const popup = !!onSearch || picksType
          const multiclassOnly = s.grantedBy === 'Multitalented' || s.grantedBy === 'Eldritch Trickster'
          const type = multiclassOnly ? 'dedication'
            : search[`${s.key}:type`] || (currentEntry ? (isDedication(currentEntry) ? 'dedication' : 'archetype') : 'archetype')
          const open = search[`${s.key}:open`] === '1'
          const lazy = !!onSearch && !open
          const slotQuery = (open ? search[`${s.key}:query`] ?? '' : '').trim().toLowerCase()
          const investigatorLessonSkills = s.grantedBy === "Investigator's Skillful Lessons"
            ? investigatorSkillfulLessonSkills(c, entries, s.level) : undefined
          const skill = s.category === 'skill' && open ? search[`${s.key}:skill`] ?? '' : ''
          const suggestible = ['general', 'skill'].includes(s.category)
          const matchesEntry = (entry: ContentEntry) => matches(entry, slotQuery,
            suggestible ? [...(suggestions.get(entry.name) ?? []), ...(synergies.get(entry.name) ?? [])] : undefined)
          const variantCache = new Map<string, FeatOption[]>()
          const variantsFor = (entry: ContentEntry) => {
            let variants = variantCache.get(entry.id)
            if (!variants) {
              variants = cachedOptionsFor(entry, s, skill)
                .filter(variant => matchesEntry(entry) || variant.label.toLowerCase().includes(slotQuery))
              variantCache.set(entry.id, variants)
            }
            return variants
          }
          const options = lazy ? [] : (pickerEligibility
            ? pickerEligibility(s) : eligibleFeats(entries, c, s, { includeUnmetPrerequisites: true })).filter((o) =>
            (matchesEntry(o) || variantsFor(o).length > 0)
            && matchesSkill(o, skill, featsByName)
            && (!skill || o.name !== 'Skill Training' || cachedOptionsFor(o, s, skill).length > 0)
            && (classArchetype !== 'Warrior of Legend' || s.category !== 'class' || s.grantedFeat || (s.displayCategory === 'archetype'
              ? isClassArchetypeFeat(o) : !isClassArchetypeFeat(o)))
            && (!picksType || (type === 'dedication') === isDedication(o)))
          const sortValue = search[`${s.key}:sort`]
          const sort = sortValue === 'name' || sortValue === 'level' ? sortValue : suggestible ? 'suggested' : 'level'
          const optionLevels = new Map<string, number>()
          const byLevel = (option: ContentEntry) => {
            let level = optionLevels.get(option.id)
            if (level === undefined) {
              level = featSelectionLevel(option, c, entries, s.category, s)
              optionLevels.set(option.id, level)
            }
            return level
          }
          const orderedOptions = popup || suggestible ? sortPickerOptions(options, sort === 'name' ? 'name' : 'level',
            option => displayName(option.name), byLevel) : options
          if (sort === 'suggested') orderedOptions.sort((a, b) =>
            Number(suggestions.has(b.name) || synergies.has(b.name)) - Number(suggestions.has(a.name) || synergies.has(a.name)))
          const shown = popup ? orderedOptions.slice(0, Number(search[`${s.key}:limit`]) || PAGE) : orderedOptions
          const names = new Set<string>()
          const sourceVariants = new Set<string>()
          for (const option of options) {
            if (names.has(option.name) && option.traits.some(trait => trait.toLowerCase() === 'skill')) sourceVariants.add(option.name)
            names.add(option.name)
          }
          const optionsByLevel = new Map<number, FeatOption[]>()
          const suggested: FeatOption[] = []
          const paired: FeatOption[] = []
          const suggestedValues = new Set<string>()
          const pairedValues = new Set<string>()
          for (const option of shown) {
            if (suggestible && synergies.has(option.name)) {
              for (const variant of variantsFor(option)) {
                const key = JSON.stringify([variant.entry.id, variant.value, variant.label, variant.disabled])
                if (pairedValues.has(key)) continue
                pairedValues.add(key)
                paired.push(variant)
              }
              continue
            }
            if (suggestible && suggestions.has(option.name)) {
              for (const variant of variantsFor(option)) {
                const key = JSON.stringify([variant.entry.id, variant.value, variant.label, variant.disabled])
                if (suggestedValues.has(key)) continue
                suggestedValues.add(key)
                suggested.push(variant)
              }
              continue
            }
            const level = byLevel(option)
            const variants = variantsFor(option)
            const bucket = optionsByLevel.get(level)
            if (bucket) bucket.push(...variants)
            else optionsByLevel.set(level, [...variants])
          }
          const granted = isGrantedSlot(s.key)
          const training = selection && featTakenLevel(selection) <= c.level
            ? hellknightTrainingBenefit(c, selection.name, selection.choice) : undefined
          const extra = !standardKeys.has(s.key) && !granted
          const label = `L${String(s.level).padStart(2, '0')} ${LABEL[s.displayCategory ?? s.category]}`
          const grantSource = s.key === TORAG_BOON_FEAT_SLOT ? 'Torag boon' : undefined
          const emptyLabel = grantSource ? `Empty (${grantSource})`
            : s.redundantFeat || s.grantedAncestry && s.grantedBy !== 'Social Chameleon' ? `Empty (${s.grantedBy})`
              : s.grantedFeat === 'Canny Acumen' ? '- empty -' : s.grantedFeat || '- empty -'
          const lastSlot = slots.filter((slot) => slot.category === s.category && slot.level === s.level).length === 1
          const classDedication = s.key === 'class:2:0' && !!s.grantedFeat
          const locked = !!homebrewDedication(s.key) || classDedication
          const requiredGrant = s.key === 'skill:4:0' || !!s.grantedFeat || !!s.redundantFeat || !!s.grantedAncestry || s.grantedBy === 'Versatile Rogue' || s.grantedBy === 'Versatile Investigator' || s.grantedBy === "Investigator's Skillful Lessons" || s.grantedBy === 'Eldritch Trickster' || s.grantedBy === 'Order Explorer' || s.grantedBy === "Officer's Education" || s.grantedBy === "Mechanic's Ingenuity" || s.grantedBy === "Operative's Specialization" || s.grantedBy === 'Versatile Operative' || s.grantedBy === 'Sniper' || s.grantedBy === 'Social Chameleon' || s.grantedBy === 'Natural Performer' || s.grantedBy === 'Pitborn' || s.grantedBy === 'Captain Dedication' || s.grantedBy === 'Scion of Many Planes' || s.grantedBy === 'In Another Life'
          const automaticOrderFeat = s.grantedBy === 'Order Explorer' && !!current
            && (() => {
              const eligible = eligibleFeats(entries, c, s)
              return eligible.length === 1 && eligible[0].name === current
            })()
          const optionLabel = (option: FeatOption) => sourceVariants.has(option.entry.name)
            ? `${option.label} (${option.entry.source === 'homebrew' ? 'Homebrew'
              : option.entry.systems.map(system => system === 'pf2e' ? 'PF2e' : 'SF2e').join('/')})` : option.label
          const popupOption = (option: FeatOption) => <li key={`${option.entry.id}:${option.value}`} className="picker-option-row">
            <button type="button" aria-label={`${label}: ${optionLabel(option)}`} disabled={option.disabled}
              className={option.entry.name === current ? 'active' : undefined}
              onClick={() => { choose(s.key, s.category, s.level, option.value, option.entry.id); onSearch?.(`${s.key}:open`, '') }}>
              {optionLabel(option)}
            </button>
            <EntryDescription character={c} name={`${displayName(option.entry.name)}${DOMAIN_FEATS.includes(option.entry.name) && option.choice ? ` (${option.choice})` : ''}`}
              entry={option.entry} choice={option.choice} entries={entries} buttonLabel="Details" className="picker-details" deferDetails
              prerequisites={option.prerequisites} access={option.access}
              descriptionNote={option.entry.name === 'Elemental Wrath' ? 'House rule: grants Caustic Blast with its normal acid damage; no damage type selection.'
                : DOMAIN_FEATS.includes(option.entry.name) && option.choice
                  ? domainSpellDescription(c, entries, option.entry.name, option.choice)
                  : subclassDescription(option.entry.name, option.choice)} />
          </li>
          const popupOptions = (options: FeatOption[]) => {
            const groups = new Map<string, FeatOption[]>()
            for (const option of options) {
              const variants = groups.get(option.entry.id) ?? []
              variants.push(option)
              groups.set(option.entry.id, variants)
            }
            return [...groups].flatMap(([id, variants]) => {
              const entry = variants[0].entry
              const collapse = variants.length > 10 || variants.length > 1
                && ['Unconventional Weaponry', 'Adopted Ancestry'].includes(entry.name)
              return collapse ? [<li key={id}>
                <FeatVariantGroup autoOpen={!!slotQuery && !matchesEntry(entry)}
                  count={variants.length}
                  summary={<>{displayName(entry.name)} ({variants.length} choices)</>}
                  renderOptions={limit => variants.slice(0, limit).map(popupOption)} />
              </li>] : variants.map(popupOption)
            })
          }
          return (
            <Fragment key={s.key}>
            {heading}
            <li className={`feat-slot-row${multi && rowIndex > 0 && newLevel ? ' feat-level-start' : ''}`}>
              {multi && <span>{label}{s.category === 'skill' ? ' Feats' : ''}</span>}
              {homebrewDedication(s.key) ? (
                <EntryDescription character={c} name={homebrewDedication(s.key)!.name} entry={currentEntry} entries={entries} className="feat-name" prerequisites={prerequisites} access={access} deferDetails={!!onSearch} />
              ) : current ? (
                current === 'N/A' ? <span>N/A</span> : <>
                  <EntryDescription character={c} name={descriptionName} entry={descriptionEntry}
                    choice={arcanaChoiceEntry ? undefined : selection?.choice} entries={entries} className="feat-name"
                    prerequisites={arcanaChoiceEntry ? selectedPrerequisites(s, arcanaChoiceEntry) : prerequisites}
                    access={descriptionEntry ? featAccess(c, descriptionEntry) : access}
                    grantSource={arcanaChoiceEntry ? selection?.name : grantSource}
                    deferDetails={!!onSearch}
                    buttonActions={training?.actions} hideButtonActions={showFeatActionControls || showWrathRoll || showTreehealerRoll || showBattlePrayerRoll || showPiercingDoom || showAcidicSpitRoll || showInscribedBlast || showCoreCannon}
                    descriptionNote={selection?.name === 'Elemental Wrath' ? 'House rule: grants Caustic Blast with its normal acid damage; no damage type selection.'
                      : selection?.choice && DOMAIN_FEATS.includes(selection.name)
                        ? domainSpellDescription(c, entries, selection.name, selection.choice)
                        : subclassDescription(selection?.name ?? '', selection?.choice)} />
                  {showFeatActionControls && <FeatActionControls c={c} entries={entries} save={save} entry={currentEntry} />}
                  {showWrathRoll && <DamageRoll name="Wrath of the Hold" actions="Two Actions" toggleResult
                    damage={{ label: 'Damage', dice: 4 + Math.floor((c.level - 8) / 2), sides: 6, type: 'spirit' }} />}
                  {showTreehealerRoll && <TreehealerRoll />}
                  {showBattlePrayerRoll && <BattlePrayerRoll c={c} entries={entries} />}
                  {showPiercingDoom && <DamageRoll name="Piercing Doom" actions="Two Actions" toggleResult
                    disabled={conditionValue(c, 'doomed') < 2}
                    damage={{ label: 'Additional damage on a successful melee Strike', dice: 1, sides: 10, type: 'void' }} />}
                  {showInscribedBlast && <>
                    <DamageRoll name="Inscribed Blast" actions="Reaction" disabled={!!c.inscribedBlastUsed}
                      onRoll={() => save({ inscribedBlastUsed: true })}
                      damage={{ label: 'Damage', dice: 2 + (c.level >= 10 ? Math.floor((c.level - 5) / 5) : 0), sides: 4, type: 'force' }} />
                    <button type="button" aria-label="Inscribed Blast uses" title="Click to toggle runes intact or faded"
                      onClick={() => save({ inscribedBlastUsed: !c.inscribedBlastUsed })}>{c.inscribedBlastUsed ? 0 : 1}/1</button>
                  </>}
                  {tattooRune && <details className="character-subsection">
                    <summary>{tattooRune.name}{c.runicTattooFaded ? ' (faded)' : ''}</summary>
                    <small>{[`Rune ${tattooRune.level}`, ...tattooRune.traits, tattooRune.usage].filter(Boolean).join(' · ')}</small>
                    <p style={{ whiteSpace: 'pre-line' }}>{tattooRune.description}</p>
                    <button type="button" aria-label="Runic Tattoo invoked"
                      title="Invoke the tattoo; it stays faded until your next daily preparations"
                      onClick={() => save({ runicTattooFaded: !c.runicTattooFaded })}>{c.runicTattooFaded ? 'Faded' : 'Invoke'}</button>
                  </details>}
                  {showCoreCannon && <>
                    <button type="button" className="spell-action-button" aria-label="Core Cannon transform"
                      disabled={!c.coreCannonActive && !!c.coreCannonUsed}
                      title={c.coreCannonActive ? 'Interact to revert to standard form' : 'Transform into cannon form'}
                      onClick={() => save(c.coreCannonActive ? { coreCannonActive: false } : { coreCannonActive: true, coreCannonUsed: true })}>
                      {c.coreCannonActive ? 'Revert' : <ActionIcon actions="Two Actions" showOther />}
                    </button>
                    <button type="button" aria-label="Core Cannon uses" title="Click to toggle daily use"
                      onClick={() => save({ coreCannonUsed: !c.coreCannonUsed })}>{c.coreCannonUsed ? 0 : 1}/1</button>
                  </>}
                  {showAcidicSpitRoll && <DamageRoll name="Acidic Spit" actions="Two Actions" toggleResult
                    damage={{ label: 'Damage', dice: c.level >= 16 ? 11 : 8, sides: 6, type: 'acid' }} />}
                </>
              ) : popup ? (
                <button type="button" className="feat-name feat-picker-button" aria-label={`${label} feat`} aria-haspopup="dialog" aria-expanded={open}
                  onClick={() => onSearch?.(`${s.key}:open`, '1')}>
                  {current || emptyLabel}
                </button>
              ) : <select aria-label={`${label} feat`} value={current}
                onChange={(e) => choose(s.key, s.category, s.level, e.target.value)}>
                <option value="">{emptyLabel}</option>
                {(s.category === 'ancestry' || s.key === 'skill:4:0') && <option value="N/A">N/A</option>}
                {suggested.length > 0 && <optgroup label="Suggested prerequisites">
                  {suggested.sort((a, b) => displayName(a.entry.name).localeCompare(displayName(b.entry.name)) || a.label.localeCompare(b.label))
                    .map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
                </optgroup>}
                {paired.length > 0 && <optgroup label="Suggested combinations">
                  {paired.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
                </optgroup>}
                {[...optionsByLevel].sort(([a], [b]) => a - b).map(([level, levelOptions]) => (
                  <optgroup key={level} label={`L${String(level).padStart(2, '0')}`}>
                    {levelOptions.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
                  </optgroup>
                ))}
              </select>}
              {popup && open && (
                <PickerDialog label={`${label} feat picker`} searchLabel={`Search ${label} feats`} query={search[`${s.key}:query`] ?? ''}
                  onClose={() => onSearch?.(`${s.key}:open`, '')} onQuery={query => {
                          onSearch?.(`${s.key}:query`, query)
                          onSearch?.(`${s.key}:limit`, '')
                        }}>
                    <label>Sort by{' '}<select aria-label={`Sort ${label} feats by`} value={sort} onChange={event => {
                      onSearch?.(`${s.key}:sort`, event.target.value)
                      onSearch?.(`${s.key}:limit`, '')
                    }}>
                      {suggestible && <option value="suggested">Suggested</option>}
                      <option value="name">Alphabetical</option>
                      <option value="level">Level</option>
                    </select></label>
                    {s.category === 'skill' && <label>Skill{' '}
                      <select aria-label={`Filter ${label} feats by skill`} value={skill} onChange={event => {
                        onSearch?.(`${s.key}:skill`, event.target.value)
                        onSearch?.(`${s.key}:limit`, '')
                      }}>
                        <option value="">All skills</option>
                        {(investigatorLessonSkills ?? statDefs(c).filter(stat => stat.kind === 'skill').map(stat => stat.name).concat('Lore'))
                          .sort((a, b) => a.localeCompare(b)).map(name => <option key={name}>{name}</option>)}
                      </select>
                    </label>}
                    {picksType && !multiclassOnly && <div className="feat-type-tabs" role="tablist">
                      {([['archetype', 'Archetype'], ['dedication', 'Dedication']] as const).map(([value, text]) => (
                        <button key={value} type="button" role="tab" aria-selected={type === value} className={type === value ? 'active' : undefined}
                          onClick={() => onSearch?.(`${s.key}:type`, value)}>{text}</button>
                      ))}
                    </div>}
                    <ul className="feat-modal-list">
                      <li><button type="button" aria-label={`${label} clear`} onClick={() => { choose(s.key, s.category, s.level, ''); onSearch?.(`${s.key}:open`, '') }}>{emptyLabel}</button></li>
                      {(s.category === 'ancestry' || s.key === 'skill:4:0' || picksType && s.grantedBy !== 'Eldritch Trickster') && <li><button type="button" aria-label={`${label} N/A`} onClick={() => { choose(s.key, s.category, s.level, 'N/A'); onSearch?.(`${s.key}:open`, '') }}>N/A</button></li>}
                      {sort === 'suggested' && <>
                        {suggested.length > 0 && <><li className="feat-modal-level">Suggested prerequisites</li>{popupOptions(suggested)}</>}
                        {paired.length > 0 && <><li className="feat-modal-level">Suggested combinations</li>{popupOptions(paired)}</>}
                      </>}
                      {sort === 'name' ? popupOptions(shown.flatMap(variantsFor))
                        : sort === 'suggested' ? [...optionsByLevel].sort(([a], [b]) => a - b).map(([level, levelOptions]) => [
                          <li key={`l${level}`} className="feat-modal-level">L{String(level).padStart(2, '0')}</li>,
                          ...popupOptions(levelOptions),
                        ]) : [...new Set(shown.map(byLevel))].map(level => [
                          <li key={`l${level}`} className="feat-modal-level">L{String(level).padStart(2, '0')}</li>,
                          ...popupOptions(shown.filter(option => byLevel(option) === level).flatMap(variantsFor)),
                        ])}
                    </ul>
                    {!options.length && <small role="status">No matching feats.</small>}
                    {options.length > shown.length && (
                      <button type="button" onClick={() => onSearch?.(`${s.key}:limit`, String(shown.length + PAGE))}>Show more ({options.length - shown.length} left, or use search)</button>
                    )}
                </PickerDialog>
              )}
              {featIndex >= 0 && !(classDedication && selection.name.toLowerCase() === 'warrior of legend dedication')
                && (classDedication && selection.name === 'Bloodrager Dedication' || !selection.choice || selectedChoices === undefined || selection.name === 'Favored Terrain'
                || ['Bone Magic', 'Reinforced Skeleton'].includes(selection.name)
                || selection.name === 'Lizardfolk Lore' && !selectedChoices.includes(selection.choice)
                || DOMAIN_FEATS.includes(selection.name) && !selectedChoices.some(choice => choice.toLowerCase() === selection.choice?.trim().toLowerCase())
                || selection.name === 'Mercy' && !selectedChoices.includes(selection.choice)
                || ORDER_TRAINING_FEATS.includes(selection.name) && !selectedChoices.includes(selection.choice)
                || selection.name === 'Technomagical Scrapper' && !selectedChoices.includes(selection.choice))
                && <FeatChoice c={c} entries={entries} save={save} index={featIndex} />}
              {selection?.name === 'Widespread Fascination' && selection.choice
                && !widespreadFascinationOptions(c, entries, selection)
                  .some(entry => entry.name === selection.choice || entry.data.grants_focus_spells === selection.choice)
                && <small role="status">Saved Widespread Fascination choice is unavailable. Select a different grim fascination.</small>}
              {access && !access.automatic && !access.approved && <div className="feat-access-controls">
                <small>Access: {access.requirement}</small>
                {!access.automatic && currentEntry && <label>
                  <input type="checkbox" aria-label={`GM approved access: ${currentEntry.name}`} checked={access.approved}
                    onChange={(event) => save({ featAccessOverrides: event.target.checked
                      ? [...new Set([...(c.featAccessOverrides ?? []), currentEntry.id])]
                      : c.featAccessOverrides?.filter(id => id !== currentEntry.id) })} /> Approve access
                </label>}
              </div>}
              {!automaticOrderFeat && !(s.category === 'class' && s.displayCategory === 'archetype' && !current && !s.grantedFeat) && <button type="button" aria-label={classDedication
                ? `${label}${s.displayCategory === 'archetype' ? '' : ' dedication'} required by class archetype`
                : locked ? `${label} slot is granted by a house rule`
                : lastSlot || requiredGrant ? `Clear ${label} feat selection`
                : `Remove ${label}${extra ? ' extra' : ''} feat slot ${s.key.split(':')[2]}`}
                title={classDedication ? 'Required by class archetype' : locked ? 'Granted by a house rule' : lastSlot || requiredGrant ? 'Clear selection' : 'Remove slot'}
                disabled={locked || !current && !extra && (lastSlot || requiredGrant)}
                onClick={() => removeSlot(s, extra)}>−</button>}
              {!(s.category === 'class' && s.displayCategory === 'archetype' && !current && !s.grantedFeat) && <button type="button" aria-label={`Add ${label} feat slot`}
                onClick={() => addSlot(s.category, s.level)}>+</button>
              }
            </li>
            </Fragment>
          )
        })}
      </ul>
      {aboveLevel.length > 0 && (
        <small>Some feats sit in slots above your current level: {aboveLevel.map((f) => displayName(f.name)).join(', ')}</small>
      )}
    </Wrapper>
  )
}
