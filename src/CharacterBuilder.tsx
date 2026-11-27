import { Info, SourceNote } from './Info'
import { confirmRemoval, REMOVAL_EVENT } from './confirmRemoval'
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AbilitiesContent } from './AbilitiesSection'
import { Achievements } from './Achievements'
import { EntryDescription } from './EntryDescription'
import { SearchableSelect } from './SearchableSelect'
import { EquipmentSearch } from './EquipmentSearch'
export { EquipmentSearch } from './EquipmentSearch'
import { CLASS_ARCHETYPES, DRUID_ORDERS, activeFeatsNamed, armorClassBreakdown, classLabel, selectedClassArchetype, selectedSubclass, subclassOptions, subclassSkillChoice, characterClassSkills, ancestryFlaws, characterAncestryLabel, computeAbilities, defenseSummary, equippedShield, featChoiceOptions, freeHeartBackground, hasCyborgHeritage, hasParryWeapon, heritagesFor, inventiveOffensiveChange, isPioneerHuman, isVersatileHeritage, languageAllowance, migrateAncestralLinguistics, ownedWeapons, parryValue, plannedSlots, rogueRackets, shieldAcBonus, shieldAlwaysRaisedSource, shieldRaised, shieldRaisedChange, shieldRaiseLabel, showParryControl, activeHomebrewDedications, homebrewDedication, orphanedArchetypeFeats, syncClassArchetypeDedication, syncOrderExplorerFeats, terrainExpertiseOptions, testSubjectAdaptation, unslottedFeats, type SectionProps } from './builder'
import { featTakenLevel } from './featChoices'
import { ABILITY_LABEL, WARRIOR_LEGEND_DAMAGE_TYPES, boostSlots, classFeatures, deityLabel, isGrantedDwarfClanWeapon, isLockedWeapon, hasPersonalUpgradeSlot, ownedArmors, warriorLegendWeakness } from './builder'
import { ClassFeatures } from './ClassFeatures'
import { classArchetypeSlotViews, featSectionGrants, SearchableFeatSlots } from './FeatSlots'
import { ArmorList, PersonalUpgradeSlot, Augmentations, BulkLimits, DermalPlatingToggle, Gadgets, GrenadeMods, GrenadeSpecialist, HandwrapsGear, MunitionsCrafter, SimplePoisons, WarmaskGear, WeaponList } from './GearSection'
import { adoptedAncestryText } from './featChoices'
import { ActionIcon } from './ActionIcon'
import { DamageRoll } from './SpellDamage'
import { LanguagesSection } from './LanguagesSection'
import { ArmorProficiency, WeaponProficiency, RageToggle, ResistanceSummary, SensesAndSpeed, SensesAndSpeedSummary, SkillsSection, SkillsSummary } from './SkillsSection'
import { SpellsPanel } from './SpellsSection'
import { AIM, AimToggle, DeviseAStratagemToggle, HuntPreyToggle, StatusesContent, StatusesSummary, parryTrait } from './StatusesSection'
import { boneShieldActive, canUseGiantStature, effectiveHandwraps, hasDermalPlating, isSpellActive, knowsSpell, ringCapacity, ringCount, spellActiveChange, temporaryHpGrant, twinnedDefenseActive } from './builder'
import { MinionsContent, MinionsSummary } from './MinionsSection'
import { FormulasContent, FormulasSummary } from './FormulasSection'
import { constructCompanionChange, faithfulSteedChange } from './companions'
import { equippedHands, offensiveDefenseAttack, totalHandCapacity } from './builder'
import { ethnicityLabel, ethnicityOptions } from './featAccess'
import { db } from './db'
import { TotalBreakdown } from './TotalBreakdown'
import { DeferredContent, DeferredDetails } from './DeferredDetails'
import { HighTechMedic } from './HighTechMedic'
import { clearItemGlitching, setEnduringMod } from './mechanicEnduring'
import { TechnomancerFeatures } from './TechnomancerFeatures'
import { GREATER_CROSS_PLATFORM_APPLICATION_FEAT, VERSATILE_FIRMWARE_FEAT } from './technomancer'
import { CharacterPictures } from './CharacterPictures'
import { isGrenade, withBreachingGrenades } from './formulas'
import { subclassBaseDescription, subclassFeatureRows } from './subclassFeatures'

import { SubclassSlot } from './SubclassSlot'
import { MYSTIC_CONNECTIONS } from './mystic'
import { OPERATIVE_EXPLOITS } from './starfinderSubclasses'
import type { Character, ContentEntry, EntryKind } from './types'
import { WORN_EQUIPMENT_GROUPS, equipmentDisplayName, equipmentGroupName, type EquipmentGroupName } from './equipmentGroups'
import { DivineIntercessions } from './intercessionPicker'
import { syncDivineBoonFeats } from './divineIntercessions'
import { NamedArmorAbilities } from './NamedArmorAbilities'
import { backgroundVariants, type BackgroundVariant } from './builder'
import { hasMagicWarriorMask, SHADOWED_SCALE_MASK } from './magicWarriorMasks'
import { characterDeityLores, normalizeAcolyte } from './backgrounds'
import { getSettings } from './settings'
import { arcaneThesisOptions, selectedArcaneThesis, type ArcaneThesis } from './arcaneTheses'
import { fatalMethodOptions, selectedFatalMethod, type FatalMethod } from './fatalMethods'
import { WitchwarperAnchor } from './WitchwarperFeatures'
import { GAUNTLET, HAFT_STRIKER_WEAPON, OVERSIZED_THROW } from './supplemental'

const LEVELED_SUBCLASS_CLASSES = ['Alchemist', 'Animist', 'Barbarian', 'Champion', 'Gunslinger', 'Inventor', 'Ranger', 'Rogue']

const NONE: ContentEntry[] = []

function Pick({ label, kind, value, options, onChange, ancestry, terrainLore, backgroundLores, deityLores, disabled }: {
  label: string
  kind: string
  value?: string
  options: ContentEntry[]
  onChange: (v: string | undefined, terrain?: string, lore?: string, custom?: boolean) => void
  ancestry?: string
  terrainLore?: Character['backgroundTerrainLore']
  backgroundLores?: Character['backgroundLores']
  deityLores?: string[]
  disabled?: boolean
}) {
  const [ready, setReady] = useState(false)
  const [deitySort, setDeitySort] = useState<'name' | 'category'>('name')
  const variants = useMemo<BackgroundVariant[]>(() => kind === 'background' ? backgroundVariants(options, deityLores)
    : options.map(background => ({ value: background.name, background })), [options, kind, deityLores])
  const selectedLore = backgroundLores?.[value ?? '']?.[0]
    ?? (terrainLore?.[value ?? ''] ? `${terrainLore[value ?? '']} Lore` : undefined)
  const selectedValue = variants.find(option => option.background.name === value
    && (option.terrain ? option.terrain === terrainLore?.[value ?? '']
      : option.lore ? option.lore === selectedLore : !option.custom))?.value
    ?? variants.find(option => option.background.name === value && option.custom)?.value ?? value
  const byName = useMemo(() => new Map(variants.map(option => [option.value, option.background])), [variants])
  const labels = useMemo(() => new Map(variants.map(option =>
    [option.value, kind === 'deity' ? deityLabel(option.background) : option.value])), [variants, kind])
  const choices = useMemo(() => {
    if (!ready) return null
    const option = (name: string) => <option key={name} value={name}>{labels.get(name)}</option>
    if (kind === 'deity' && deitySort === 'category') {
      const groups = new Map<string, string[]>()
      for (const name of [...labels.keys()].sort()) {
        const category = String(byName.get(name)?.data.deity_category ?? '').trim() || 'Other'
        groups.set(category, [...(groups.get(category) ?? []), name])
      }
      return [...groups].sort(([a], [b]) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)))
        .map(([category, names]) => <optgroup key={category} label={category}>{names.map(option)}</optgroup>)
    }
    if (kind !== 'heritage') return [...labels.keys()].sort().map(option)
    const names = [...labels.keys()].sort()
    return [false, true].map(versatile => {
      const group = names.filter(name => isVersatileHeritage(byName.get(name)!) === versatile)
      return group.length > 0 && <optgroup key={String(versatile)} label={versatile ? 'Versatile' : ancestry ?? 'Ancestry'}>
        {group.map(option)}
      </optgroup>
    })
  }, [labels, ready, kind, byName, ancestry, deitySort])
  const prepare = () => {
    // Populate before the browser opens its native select popup.
    if (!ready) flushSync(() => setReady(true))
  }
  const unavailable = kind === 'heritage' && !!value && !labels.has(value)
  return (<>
      {kind === 'deity' && <label>Sort by{' '}
        <select aria-label="Sort deities by" value={deitySort} onChange={event => setDeitySort(event.target.value === 'category' ? 'category' : 'name')}>
          <option value="name">Alphabetical</option>
          <option value="category">Category</option>
        </select>
      </label>}
      <SearchableSelect label={label} aria-label={label} value={selectedValue ?? ''} disabled={disabled} onPrepare={prepare} optionCount={labels.size}
        alwaysSearchable={kind === 'class'}
        optionSystems={kind === 'class' ? name => [...new Set(options.filter(entry => entry.name === name).flatMap(entry => entry.systems))] : undefined}
        searchText={kind === 'background' ? name => String(byName.get(name)?.data.feat ?? '') : undefined}
        renderDetails={name => {
          const entry = byName.get(name)
          return entry ? <EntryDescription name={entry.name} entry={entry} buttonLabel="Details" className="picker-details" deferDetails /> : null
        }}
        onFocus={prepare} onPointerDown={prepare} onChange={(e) => {
          const option = variants.find(option => option.value === e.target.value)
          onChange(option?.background.name ?? (e.target.value || undefined), option?.terrain, option?.lore, option?.custom)
        }}>
        <option value="">No {kind}</option>
        {selectedValue && (!ready || !labels.has(selectedValue)) && <option value={selectedValue} disabled={unavailable}>
          {labels.get(selectedValue) ?? (unavailable ? `${value} (not available for this ancestry)` : selectedValue)}
        </option>}
        {choices}
      </SearchableSelect></>
  )
}

const NONE_LORES: string[] = []

const TEST_SUBJECT_ADAPTATIONS = ['Cybernetic Augmentation', 'Extra Limbs', 'Psychic Augmentation', 'Radioactive'] as const
const STELLAR_NOMAD_LORES = ['Vesk Lore', 'Damoritosh Lore', 'Pact Worlds Lore'] as const

export function HeritagePick({ c, entries, save }: SectionProps) {
  const canChooseAdaptation = c.systems.includes('sf2e') && c.ancestry === 'Ysoki'
  const variants = TEST_SUBJECT_ADAPTATIONS.map(adaptation => ({
    adaptation, name: `Test-Subject Ysoki (${adaptation})`,
  }))
  const nomadVariants = STELLAR_NOMAD_LORES.map(lore => ({ lore, name: `Stellar Nomad Kasatha (${lore})` }))
  const options = heritagesFor(entries, c.ancestry)
    .filter(entry => !getSettings().disableAncientElfMultitalented || entry.name !== 'Ancient Elf')
    .flatMap(entry => canChooseAdaptation && entry.name === 'Test-Subject Ysoki' && entry.systems.includes('sf2e')
      ? [...(c.heritage === entry.name && !c.testSubjectAdaptation ? [entry] : []),
        ...variants.map(variant => ({ ...entry, name: variant.name }))]
      : c.systems.includes('sf2e') && c.ancestry === 'Kasatha' && entry.name === 'Stellar Nomad Kasatha'
        && entry.systems.includes('sf2e') ? [entry, ...nomadVariants.map(variant => ({ ...entry, name: variant.name }))]
        : [entry])
  const value = canChooseAdaptation && c.heritage === 'Test-Subject Ysoki' && c.testSubjectAdaptation
    ? variants.find(variant => variant.adaptation === c.testSubjectAdaptation)?.name ?? c.heritage
    : c.heritage === 'Stellar Nomad Kasatha' && c.stellarNomadLore
      ? nomadVariants.find(variant => variant.lore === c.stellarNomadLore)?.name ?? c.heritage : c.heritage
  return <Pick label="Heritage" kind="heritage" ancestry={c.ancestry} value={value} options={options}
    onChange={name => {
      const variant = variants.find(option => option.name === name)
      const nomad = nomadVariants.find(option => option.name === name)
      save({ heritage: variant ? 'Test-Subject Ysoki' : nomad ? 'Stellar Nomad Kasatha' : name,
        testSubjectAdaptation: variant?.adaptation, stellarNomadLore: nomad?.lore })
    }} />
}

export function ClassPick({ c, entries, save, options }: SectionProps & { options: ContentEntry[] }) {
  const archetypes = c.systems.includes('pf2e') ? CLASS_ARCHETYPES : []
  const available = archetypes.flatMap(archetype => {
    const base = options.find(option => option.name === archetype.className && option.systems.includes('pf2e'))
    if (!base) return []
    const types = archetype.name === 'Warrior of Legend' ? WARRIOR_LEGEND_DAMAGE_TYPES : [undefined]
    return types.map(damageType => ({
      archetype, damageType,
      entry: { ...base, name: `${archetype.className} (${archetype.name}${damageType ? ` (${damageType})` : ''})` },
    }))
  })
  const selected = selectedClassArchetype(c, entries)
  const weakness = warriorLegendWeakness(c, entries)
  const damageType = WARRIOR_LEGEND_DAMAGE_TYPES.find(type => type.toLowerCase() === weakness?.damage)
  const selectedName = selected && `${selected.className} (${selected.name}${damageType ? ` (${damageType})` : ''})`
  return <Pick label="Class" kind="class" value={selectedName ?? c.className}
    options={[...options, ...available.map(option => option.entry)]} onChange={value => {
      const option = available.find(item => item.entry.name === value)
      const archetype = option?.archetype
      save({ className: archetype?.className ?? value, subclass: archetype?.subclass ?? '', fatalMethod: undefined, arcaneThesis: undefined,
        ...(c.classKeyAbility && (archetype?.className ?? value) !== c.className ? { classKeyAbility: undefined } : {}),
        ...(option?.damageType ? { warriorLegendDamageType: option.damageType,
          feats: c.feats.map(feat => feat.name.toLowerCase() === 'warrior of legend dedication'
            ? { ...feat, choice: option.damageType } : feat) } : {}) })
    }} />
}

function DeityCard({ deity }: { deity?: ContentEntry }) {
  if (!deity) return null
  const d = deity.data
  const line = (label: string, value: unknown) => value ? <p><b>{label}</b> {String(value)}</p> : null
  return (
    <div className="deity-card">
      <h4>{deityLabel(deity)}</h4>
      {String(d.about || deity.description).split('\n\n').map((p) => <p key={p}>{p}</p>)}
      {line('Category', d.deity_category)}
      {line('Edicts', d.edict)}
      {line('Anathema', d.anathema)}
      {line('Areas of Concern', d.area_of_concern)}
      {line('Religious Symbol', d.religious_symbol)}
      {line('Pantheon Members', d.pantheon_member)}
      <h5>Devotee Benefits</h5>
      {line('Divine Attribute', String(d.attribute ?? '').replace(/, /g, ' or '))}
      {line('Divine Font', String(d.divine_font ?? '').replace(/, /g, ' or '))}
      {line('Divine Sanctification', d.sanctification)}
      {line('Divine Skill', d.skill)}
      {line('Favored Weapon', String(d.favored_weapon ?? '').replace(/, /g, ' or '))}
      {line('Domains', d.domain_primary ?? d.domain)}
      {line('Alternate Domains', d.domain_alternate)}
      {d.cleric_spells && (
        <>
          <p><b>Cleric Spells</b></p>
          <ul>{String(d.cleric_spells).split('; ').map((s) => <li key={s}>{s}</li>)}</ul>
        </>
      )}
      {d.url && <small><a href={String(d.url)} target="_blank" rel="noreferrer">Archives of Nethys</a></small>}
    </div>
  )
}

const detail = (e?: ContentEntry) =>
  e ? Object.entries(e.data).filter(([k]) => k !== 'url' && k !== 'sourceBook').map(([k, v]) => `${k}: ${v}`).join(' | ') : ''

function BackgroundDetails({ entry, label = entry.name }: { entry: ContentEntry; label?: string }) {
  const facts = [
    entry.data.attribute && `Attribute boosts: ${entry.data.attribute}`,
    entry.data.skill && `Trained skills: ${entry.data.skill}`,
    entry.data.feat && `Granted skill feat: ${entry.data.feat}`,
  ].filter((fact): fact is string => typeof fact === 'string')
  const source = entry.data.sourceBook
  return <article className="background-entry">
    <h4>{label}</h4>
    {entry.description.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    {!entry.data.full_description && facts.length > 0 && <p>{facts.join('. ')}.</p>}
    {typeof source === 'string' && source && <small>{source}</small>}
  </article>
}

function AncestryDetails({ entry }: { entry: ContentEntry }) {
  const paragraphs = entry.description.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean)
  if (entry.source === 'official') {
    if (paragraphs[0] === entry.name) paragraphs.shift()
    if (/^Source\b/.test(paragraphs[0] ?? '')) paragraphs.shift()
  }
  const description = entry.kind === 'ancestry' ? [paragraphs.join(' ')] : paragraphs
  return <article className="ancestry-entry" aria-label={entry.name}>
    <p><strong>{entry.name}:</strong>{description[0] && <> {description[0]}</>}</p>
    {description.slice(1).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
  </article>
}

type EquipmentRow = { item: Character['equipment'][number]; index: number; entry?: ContentEntry }

function EquipmentGroup({ c, entries, save, group, rows, bracelets = [], simplePoisons = false }: SectionProps & { group: EquipmentGroupName; rows: EquipmentRow[]; bracelets?: string[]; simplePoisons?: boolean }) {
  const [adding, setAdding] = useState(false)
  const searchId = useId()
  const addButton = useRef<HTMLButtonElement>(null)
  const displayed = [
    ...rows.map(row => ({ kind: 'item' as const, name: equipmentDisplayName(row.item.name), row })),
    ...bracelets.map(id => ({ kind: 'bracelet' as const, name: 'Bracelet of Empathy', id })),
    ...(simplePoisons ? [{ kind: 'simple-poisons' as const, name: 'Poison Weapon' }] : []),
    ...(group === 'Mask' && c.systems.includes('pf2e') && activeFeatsNamed(c, 'Orc Warmask').length
      ? [{ kind: 'warmask' as const, name: adoptedAncestryText(c, 'Orc Warmask') }] : []),
    ...(group === 'Mask' && hasMagicWarriorMask(c)
      && !rows.some(row => row.item.name === SHADOWED_SCALE_MASK && row.item.qty > 0)
      ? [{ kind: 'magic-warrior-mask' as const, name: SHADOWED_SCALE_MASK }] : []),
    ...(group === 'Tattoos' && c.systems.includes('pf2e') && activeFeatsNamed(c, 'Tattooed Historian Dedication').length
      && !c.equipment.some(item => item.name === 'Storied Skin' && item.qty > 0)
      ? [{ kind: 'storied-skin' as const, name: 'Storied Skin' }] : []),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const alwaysAvailable = WORN_EQUIPMENT_GROUPS.some(name => name === group)
    || ['Grafts', 'Grenades', 'Tattoos', 'Toolkits'].includes(group)
  if (!displayed.length && !alwaysAvailable) return null
  const body = displayed.length > 0 && <ul>
    {displayed.map(display => {
      if (display.kind === 'warmask') return <li key="warmask"><WarmaskGear c={c} entries={entries} save={save} /></li>
      if (display.kind === 'storied-skin') return <li key="storied-skin"><EntryDescription name="Storied Skin"
        entry={entries.find(entry => entry.kind === 'item' && entry.name === 'Storied Skin' && !entry.deleted && entry.systems.includes('pf2e'))}
        className="equipment-name" /></li>
      if (display.kind === 'magic-warrior-mask') {
        const entry = entries.find(entry => entry.kind === 'item' && entry.name === SHADOWED_SCALE_MASK
          && !entry.deleted && entry.systems.includes('pf2e'))
        return <li key="magic-warrior-mask"><EntryDescription name={SHADOWED_SCALE_MASK} entry={entry} className="equipment-name" />
          <ActionIcon entry={entry} /><NamedArmorAbilities entry={entry} /></li>
      }
      if (display.kind === 'bracelet') return <li key={`bracelet-${display.id}`}><EntryDescription name="Bracelet of Empathy"
        entry={entries.find(entry => entry.kind === 'item' && entry.name === 'Collar of Empathy')} className="equipment-name" /></li>
      if (display.kind === 'simple-poisons') return <li key="simple-poisons"><SimplePoisons c={c} entries={entries} save={save} /></li>
      const { item, index, entry } = display.row
      const locked = item.name === 'Storied Skin' && c.systems.includes('pf2e')
        && activeFeatsNamed(c, 'Tattooed Historian Dedication').length > 0
        || item.name === SHADOWED_SCALE_MASK && hasMagicWarriorMask(c)
      return <li key={`${item.name}-${index}`}>
      <EntryDescription name={item.name} entry={withBreachingGrenades(c, entry)} className="equipment-name" /> <ActionIcon entry={entry} />{item.qty > 1 && <span> x{item.qty}</span>}{' '}
      <KillersBeltRoll name={item.name} entry={entry} />
      {!locked && <button onClick={() => confirmRemoval(`gear "${item.name}"`, () => {
        const nextMods = { ...c.mechanicGrenadeMods }
        delete nextMods[`equipment:${item.name}`]
        save({ ...(c.mechanicEnduringMod?.kind === 'medic' && c.mechanicEnduringMod.item === item.mechanicItemId
          ? setEnduringMod(c) : {}), equipment: c.equipment.filter((_, i) => i !== index), mechanicGrenadeMods: nextMods,
          ...clearItemGlitching(c, 'equipment', item.mechanicItemId),
          ...(c.mechanicEnduringMod?.kind === 'grenade' && c.mechanicEnduringMod.item === `equipment:${item.name}`
            ? { mechanicEnduringMod: undefined } : {}) })
      })}>Remove</button>}
      <HighTechMedic c={c} save={save} index={index} entry={entry} />
      {entry?.name === 'Shadowed Scale, the Jungle Secret' && <NamedArmorAbilities entry={entry} />}
      {entry && isGrenade(entry) && c.className === 'Mechanic' && c.systems.includes('sf2e') && <>
        <GrenadeMods c={c} grenade={entry} label={item.name} itemKey={`equipment:${item.name}`} save={save} />
      </>}
      </li>
    })}
  </ul>
  return <div className="equipment-group">
    <div className="equipment-group-heading">
      <h4>{group}</h4>
      {group === 'Rings' && <span aria-label="Rings used">{ringCount(c, entries)}/{ringCapacity(c)}</span>}
      <button ref={addButton} type="button" className="icon-button" aria-label={`Add ${group}`} title={`Add ${group}`}
        aria-expanded={adding} aria-controls={searchId} onClick={() => setAdding(!adding)}>+</button>
    </div>
    <div id={searchId} hidden={!adding}>
      {adding && <EquipmentSearch c={c} entries={entries} save={save} category={group} onClose={() => {
        setAdding(false)
        addButton.current?.focus()
      }} />}
    </div>
    {group === 'Handwraps' && <HandwrapsGear c={c} entries={entries} save={save} />}
    {body}
  </div>
}

function PioneerHumanOptions({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  if (!isPioneerHuman(c)) return null
  const options = terrainExpertiseOptions(c, 'pioneer')
  const terrain = options.find(terrain => terrain.toLowerCase() === c.pioneerTerrain?.trim().toLowerCase()) ?? c.pioneerTerrain ?? ''
  return <div className="col">
    <div className="row">
      <label>Environmental protection{' '}
        <select aria-label="Pioneer Human environmental protection" value={c.pioneerEnvironment ?? ''} onChange={event => {
          const value = event.target.value
          if (value === '' || value === 'Cold' || value === 'Heat') save({ pioneerEnvironment: value === '' ? undefined : value })
        }}>
          <option value="">Choose cold or heat</option><option>Cold</option><option>Heat</option>
        </select>
      </label>
      <SearchableSelect label="Terrain Expertise" aria-label="Pioneer Human Terrain Expertise terrain" value={terrain} onChange={event => {
        if (event.target.value && !options.includes(event.target.value)) return
        save({ pioneerTerrain: event.target.value || undefined })
      }}>
        <option value="">Choose terrain</option>
        {terrain && !options.includes(terrain) && <option disabled>{terrain}</option>}
        {options.map(terrain => <option key={terrain}>{terrain}</option>)}
      </SearchableSelect>
    </div>
  </div>
}

const filteredCatalogs = new WeakMap<ContentEntry[], Map<string, ContentEntry[]>>()

function characterCatalog(catalog: ContentEntry[], systemsKey: string) {
  let filtered = filteredCatalogs.get(catalog)
  if (!filtered) {
    filtered = new Map()
    filteredCatalogs.set(catalog, filtered)
  }
  let entries = filtered.get(systemsKey)
  if (!entries) {
    const systems = systemsKey.split(',')
    entries = catalog.filter(e => e.systems.some(s => systems.includes(s)))
    filtered.set(systemsKey, entries)
  }
  return entries
}

export function CharacterBuilder({ character, catalog, onClose, deityLores = NONE_LORES }: {
  character: Character; catalog: ContentEntry[]; onClose: () => void; deityLores?: string[]
}) {
  const c = useMemo(() => normalizeAcolyte(character), [character])
  const systemsKey = c.systems.join()
  const baseEntries = characterCatalog(catalog, systemsKey)
  const entries = useMemo(() => {
    if (!c.systems.includes('sf2e') || c.className !== 'Technomancer') return baseEntries
    return [...baseEntries,
      ...[VERSATILE_FIRMWARE_FEAT, GREATER_CROSS_PLATFORM_APPLICATION_FEAT]
        .filter(feat => !baseEntries.some(entry => entry.id === feat.id))]
  }, [baseEntries, c.className, c.systems])
  const deityLoreKey = JSON.stringify(characterDeityLores([c], deityLores))
  const availableDeityLores = useMemo<string[]>(() => JSON.parse(deityLoreKey), [deityLoreKey])
  const latest = useRef(c)
  latest.current = c
  const [undo, setUndo] = useState<{ label: string; snapshot: Character } | null>(null)
  useEffect(() => {
    let timer: number | undefined
    const onRemoval = (event: Event) => {
      window.clearTimeout(timer)
      setUndo({ label: String((event as CustomEvent).detail), snapshot: latest.current })
      timer = window.setTimeout(() => setUndo(null), 10000)
    }
    window.addEventListener(REMOVAL_EVENT, onRemoval)
    return () => { window.removeEventListener(REMOVAL_EVENT, onRemoval); window.clearTimeout(timer) }
  }, [])
  const save = (patch: Partial<Character>) => {
    return db.transaction('rw', db.characters, async () => {
      const current = await db.characters.get(c.id)
      if (!current) throw new Error('Character no longer exists')
      const next = normalizeAcolyte({ ...current, ...patch, updatedAt: Math.max(Date.now(), current.updatedAt + 1) })
      Object.assign(next, syncClassArchetypeDedication(next, entries))
      Object.assign(next, syncDivineBoonFeats(next))
      Object.assign(next, syncOrderExplorerFeats(next, entries))
      Object.assign(next, faithfulSteedChange(next, entries))
      Object.assign(next, constructCompanionChange(next))
      Object.assign(next, inventiveOffensiveChange(next, entries))
      if (next.activeStance === "Paragon's Guard" && (!equippedShield(next) || !activeFeatsNamed(next, "Paragon's Guard").length))
        next.activeStance = undefined
      if ((!next.systems.includes('pf2e') || next.className !== 'Investigator') && next.deviseAStratagemActive) {
        next.deviseAStratagemActive = undefined
      }
      if (next.hardenFleshActive && !activeFeatsNamed(next, 'Harden Flesh').length) next.hardenFleshActive = false
      if (next.activeFeatEffects?.includes('Reckless Riding Lunge')
        && (next.mountedCompanionId !== current.mountedCompanionId
          || !next.companions?.some(companion => companion.id === next.mountedCompanionId)
          || !activeFeatsNamed(next, 'Reckless Riding Lunge').length)) {
        next.activeFeatEffects = next.activeFeatEffects.filter(effect => effect !== 'Reckless Riding Lunge')
      }
      if (next.activeFeatEffects?.includes("Giant's Lunge")
        && (!next.raging || !activeFeatsNamed(next, "Giant's Lunge").length)) {
        next.activeFeatEffects = next.activeFeatEffects.filter(effect => effect !== "Giant's Lunge")
      }
      if (next.activeFeatEffects?.includes("Dragon's Rage Wings")
        && (!next.raging || !activeFeatsNamed(next, "Dragon's Rage Wings").length)) {
        next.activeFeatEffects = next.activeFeatEffects.filter(effect => effect !== "Dragon's Rage Wings")
      }
      if (next.giantStature && (!canUseGiantStature(next, entries)
        || next.giantStature === 'Huge' && !activeFeatsNamed(next, "Titan's Stature").length)) next.giantStature = undefined
      if (!next.raging) {
        next.elementalExplosionUsed = false
        next.scouringRageUsed = false
        next.scouringRageDamage = undefined
      }
      if (!next.raging || !activeFeatsNamed(next, 'Dragon Transformation').length) next.dragonTransformation = undefined
      if (!next.raging || !activeFeatsNamed(next, 'Animal Rage').length || !next.barbarianAnimal) next.animalRageForm = false
      if (next.activeFeatEffects) next.activeFeatEffects = next.activeFeatEffects.filter(effect =>
        !['Desperate Wrath', 'Come and Get Me', "Spirits' Interference", 'Ghost Wrangler'].includes(effect)
          || !!next.raging && !!activeFeatsNamed(next, effect).length)
      if (!next.raging || !activeFeatsNamed(next, 'Animalistic Brutality').length) next.animalisticBrutality = undefined
      if (next.boosts) next.abilities = computeAbilities(next, entries)
      await db.characters.put(next)
    })
  }
  // House rules: keep the free Dedications (e.g. Ranger's Snarecrafter) in step with the rule, class and level
  const wanted = activeHomebrewDedications(c)
  const missing = wanted.filter((d) => !c.feats.some((f) => f.slot === d.slot) && entries.some((e) => e.kind === 'feat' && e.name === d.name))
  const stale = c.feats.filter((f) => homebrewDedication(f.slot ?? '') && !wanted.some((d) => d.slot === f.slot))
  const unslotted = unslottedFeats(c, entries)
  const orphaned = [...unslotted, ...orphanedArchetypeFeats({ ...c, feats: c.feats.filter((f) => !unslotted.includes(f)) }, entries)]
  const missingSteed = faithfulSteedChange(c, entries)
  const missingConstruct = constructCompanionChange(c)
  const requiredDedication = syncClassArchetypeDedication(c, entries)
  useEffect(() => {
    if (requiredDedication) {
      void save({})
      return
    }
    if (orphaned.length) {
      const feats = c.feats.filter((f) => !orphaned.includes(f))
      const dropped = new Set(orphaned.map((f) => f.name))
      const kept = new Set(feats.map((f) => f.name))
      const removedIds = new Set(entries.filter((e) => e.kind === 'feat' && dropped.has(e.name) && !kept.has(e.name)).map((e) => e.id))
      void save({ feats, entryIds: c.entryIds.filter((id) => !removedIds.has(id)) })
      return
    }
    if (!missing.length && !stale.length) {
      const migration = migrateAncestralLinguistics(c)
      const orderFeats = syncOrderExplorerFeats(c, entries)
      if (missingSteed || missingConstruct || migration || orderFeats)
        void save({ ...missingSteed, ...missingConstruct, ...migration, ...orderFeats })
      return
    }
    const added = missing.map((d) => ({ d, entry: entries.find((e) => e.kind === 'feat' && e.name === d.name)! }))
    void save({
      feats: [...c.feats.filter((f) => !stale.includes(f)), ...added.map(({ d, entry }) => ({ name: d.name, type: 'Dedication Feat', level: entry.level, slot: d.slot }))],
      entryIds: [...new Set([...c.entryIds, ...added.map(({ entry }) => entry.id)])],
    })
  })
  const section = { c, entries, save }
  const ethnicities = useMemo(() => c.ancestry ? ethnicityOptions(entries, c.ancestry) : [], [entries, c.ancestry])
  const selectedEthnicity = ethnicityLabel(c.ethnicity ?? '')
  const savedEthnicity = selectedEthnicity.trim().toLowerCase()
  const unavailableEthnicity = !!savedEthnicity && !ethnicities.some(name => name.toLowerCase() === savedEthnicity)
  const { locked: lockedLanguages, slots: languageSlots, slotSources: languageSlotSources } = languageAllowance(c, entries)
  const knownLanguages = [...new Map([...lockedLanguages, ...(migrateAncestralLinguistics(c)?.languages ?? c.languages)].map((l) => [l.toLowerCase(), l])).values()]
  const languageSummary = `${knownLanguages.length}/${lockedLanguages.length + languageSlots}: ${[...knownLanguages].sort((a, b) => a.localeCompare(b)).join(', ')}`
  const of = useMemo(() => {
    const groups = new Map<EntryKind, ContentEntry[]>()
    for (const entry of entries) {
      const group = groups.get(entry.kind)
      if (group) group.push(entry)
      else groups.set(entry.kind, [entry])
    }
    return (kind: EntryKind) => groups.get(kind) ?? NONE
  }, [entries])
  const named = (kind: EntryKind, name?: string) => (name ? of(kind).find((e) => e.name === name) : undefined)
  const deity = named('deity', c.deity)

  const ancestry = named('ancestry', c.ancestry)
  const heritage = named('heritage', c.heritage)
  const klass = named('class', c.className)
  const subclasses = subclassOptions(c, entries).filter(entry => entry.data.subclass_type !== 'fatal-method')
  const subclassName = selectedSubclass(c, entries)
  const subclass = subclasses.find((entry) => entry.name === subclassName)
  const subclassLabel = c.className === 'Necromancer' ? 'Grim Fascination' : c.className === 'Witch' ? 'Patron' : c.className === 'Rogue' ? 'Racket' : c.className === 'Ranger' ? "Hunter's Edge" : c.className === 'Champion' ? 'Cause' : c.className === 'Barbarian' ? 'Instinct' : c.className === 'Inventor' ? 'Innovation' : c.className === 'Mechanic' ? 'Exocortex' : c.className === 'Envoy' ? 'Leadership style' : c.className === 'Mystic' ? 'Connection' : c.className === 'Operative' ? 'Specialization' : c.className === 'Witchwarper' ? 'Paradox' : c.className === 'Soldier' ? 'Fighting style' : 'Subclass'
  const investigatorMethodNames = [...new Set([...subclasses.map(method => method.name), ...(subclassName ? [subclassName] : [])])]
  const investigatorMethodVariants = c.className === 'Investigator' ? investigatorMethodNames.flatMap(method => {
    const choice = subclassSkillChoice({ ...c, subclass: method }, entries)
    return choice?.options.length
      ? choice.options.map(skill => ({ value: `${method}|${skill}`, label: `${method} (${skill})` }))
      : [{ value: method, label: method }]
  }) : []
  const additionalInvestigatorMethods = c.className === 'Investigator'
    ? activeFeatsNamed(c, 'Versatile Investigator').flatMap(feat => {
      const method = subclasses.find(entry => entry.name === feat.choice)
      return method ? [method] : []
    }) : []
  const additionalEnvoyStyles = c.className === 'Envoy'
    ? activeFeatsNamed(c, 'Versatile Envoy').flatMap(feat => {
      const style = subclasses.find(entry => entry.name === feat.choice)
      return style ? [style] : []
    }) : []
  const additionalOperativeSpecializations = c.className === 'Operative' && c.systems.includes('sf2e')
    ? activeFeatsNamed(c, 'Versatile Operative').flatMap(feat => {
      const specialization = subclasses.find(entry => entry.name === feat.choice)
      return specialization ? [specialization] : []
    }) : []
  const fatalMethods = fatalMethodOptions(entries)
  const fatalMethod = selectedFatalMethod(c)
  const arcaneTheses = arcaneThesisOptions(entries)
  const arcaneThesis = selectedArcaneThesis(c)
  const subclassChoice = subclassSkillChoice(c, entries)
  const choiceValue = subclassChoice ? c.subclassSkillChoices?.[subclassChoice.key] ?? '' : ''
  const methodPickerValue = subclassName && subclassChoice?.options.length
    ? choiceValue ? `${subclassName}|${choiceValue}` : subclassName : subclassName ?? ''
  const background = named('background', c.background)
  const backgroundLabel = (name: string) => {
    const lore = c.backgroundLores?.[name]?.filter(Boolean).join(', ')
      || (c.backgroundTerrainLore?.[name] ? `${c.backgroundTerrainLore[name]} Lore` : '')
    return lore ? `${name} (${lore})` : name
  }
  const equipmentEntries = useMemo(() => {
    const items = new Map<string, ContentEntry>()
    const fallback = new Map<string, ContentEntry>()
    for (const entry of entries) {
      if (entry.kind === 'item' && !items.has(entry.name)) items.set(entry.name, entry)
      else if ((entry.kind === 'weapon' || entry.kind === 'armor') && !fallback.has(entry.name)) fallback.set(entry.name, entry)
    }
    return { items, fallback }
  }, [entries])
  const equipmentGroups = useMemo(() => {
    const groups: Record<EquipmentGroupName, EquipmentRow[]> = {
      Arrows: [], Bolts: [], Bullets: [], Grafts: [], Grenades: [], 'Other equipment': [], Poisons: [], Tattoos: [], Toolkits: [],
      Arms: [], Backpacks: [], Belt: [], Body: [], Boots: [], Bracelets: [], Chest: [], Cloaks: [], Clothing: [],
      Eyes: [], Eyewear: [], Face: [], Feet: [], Gloves: [], Hands: [], Handwraps: [], Head: [], Headband: [], Headwear: [],
      Mask: [], Neck: [], Necklaces: [], Rings: [], Shoulders: [], Throat: [], Torso: [], Wrists: [], 'Other Worn Items': [],
    }
    c.equipment.forEach((item, index) => {
      const entry = equipmentEntries.items.get(item.name) ?? equipmentEntries.fallback.get(item.name)
      const group = item.name === 'Storied Skin' && c.systems.includes('pf2e')
        && activeFeatsNamed(c, 'Tattooed Historian Dedication').length ? 'Tattoos' : equipmentGroupName(entry, item.name, item.group)
      groups[group].push({ item, index, entry })
    })
    Object.values(groups).forEach(rows => rows.sort((a, b) => a.item.name.localeCompare(b.item.name)))
    return groups
  }, [c.equipment, c.feats, c.level, c.systems, equipmentEntries])
  const freeHeart = activeFeatsNamed(c, 'Free Heart')[0]
  const freeHeartOptions = freeHeart ? new Set(featChoiceOptions('Free Heart', c, entries, freeHeart.slot ?? '') ?? []) : undefined
  const extraBackground = freeHeartBackground(c, entries)
  const flaws = ancestryFlaws(c, entries)
  const defense = defenseSummary(c, entries)
  const temporaryHp = temporaryHpGrant(c, entries)
  const parry = parryValue(c, entries)
  const parryWeapon = hasParryWeapon(c, entries)
  const stanceParry = twinnedDefenseActive(c, entries)
  const shield = equippedShield(c)
  const shieldCantrip = knowsSpell(c, entries, 'Shield')
  const boneShield = boneShieldActive(c)
  const raiseShieldLabel = shieldRaiseLabel(shield)
  const weaponCount = ownedWeapons(c, entries).length
  const handsUsed = equippedHands(c, entries)
  const handLimit = totalHandCapacity(c)
  const pairedEmpathyBracelets = (c.companions ?? []).flatMap(companion =>
    companion.equipment?.Collar?.name === 'Collar of Empathy'
      ? [companion.id]
      : [])
  const featSlots = plannedSlots(c, entries)
  const featGrants = featSectionGrants(c, entries, ['skill', 'general'], featSlots)
  const archetypeGrants = featSectionGrants(c, entries, ['archetype'], featSlots)
  const ancestryGrants = featSectionGrants(c, entries, ['ancestry'], featSlots)
  const ancestrySlots = featSlots.filter(slot => slot.category === 'ancestry')
  const ancestryGranted = ancestryGrants.backgroundFeats.length + ancestryGrants.automaticFeats.length + ancestryGrants.memories.length
  const ancestryFilled = ancestrySlots.filter(slot => c.feats.some(feat => feat.slot === slot.key)).length + ancestryGranted
  const classSlots = featSlots.filter(slot => (slot.displayCategory ?? slot.category) === 'class')
  const classFilled = classSlots.filter(slot => c.feats.some(feat => feat.slot === slot.key)).length

  const featSection = (category: 'general' | 'skill' | 'archetype') => {
    const title = { general: 'General Feats', skill: 'Skill Feats', archetype: 'Dedications' }[category]
    const slots = [...featSlots, ...(category === 'archetype' ? classArchetypeSlotViews(c, entries, featSlots) : [])]
      .filter((slot) => (slot.displayCategory ?? slot.category) === category)
    const filled = slots.filter((slot) => c.feats.some((f) => f.slot === slot.key) || c.skippedFeatSlots?.includes(slot.key)).length
    const granted = category === 'archetype' ? archetypeGrants.automaticFeats.length
      : [...featGrants.backgroundFeats, ...featGrants.automaticFeats]
        .filter(feat => featGrants.grantedType(feat.name) === `${category === 'skill' ? 'Skill' : 'General'} Feat`).length
        + (category === 'skill' ? featGrants.memories.length : 0)
    return (
      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>{title}</strong>
          <span>{filled + granted}/{slots.length + granted}</span>
        </summary>
        <div className="character-section-content">
          <SearchableFeatSlots {...section} categories={[category]} title={title} bare plannedFeatSlots={featSlots} />
          {category === 'archetype' && slots.length === 0 && (
            <button type="button" onClick={() => save({ extraSlots: [...c.extraSlots, { category: 'archetype', level: Math.max(2, c.level), count: 1 }] })}>
              Add Dedication feat slot
            </button>
          )}
        </div>
      </DeferredDetails>
    )
  }

  return (
    <section className="col">
      <div className="row">
        <h2>{c.name}</h2>
        <button onClick={onClose}>Close</button>
      </div>
      {undo && <div role="status" className="row">
        <span>Removed {undo.label}.</span>
        <button type="button" onClick={() => {
          void db.characters.put({ ...undo.snapshot, updatedAt: Date.now() }).then(() => setUndo(null))
        }}>Undo</button>
      </div>}
      {!entries.some((e) => e.kind === 'class') && <p>No class data yet. Official content is still loading.</p>}

      <div className="row">
        <label>Name <input key={`${c.id}:${c.name}`} defaultValue={c.name}
          onBlur={(e) => { if (e.currentTarget.value !== c.name) void save({ name: e.currentTarget.value }) }} /></label>
          <label>Level <input key={`${c.id}:${c.level}`} aria-label="Character level" type="number" min={1} max={20}
            defaultValue={c.level} onBlur={(e) => {
              const level = Math.min(20, Math.max(1, +e.currentTarget.value || 1))
              e.currentTarget.value = String(level)
              if (level !== c.level) void save({ level })
            }} /></label>
      </div>
      <DeferredDetails>
        <summary className="character-section-summary"><strong>Ability Scores</strong></summary>
        <AbilitiesContent {...section} />
      </DeferredDetails>
      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Ancestry</strong>
          <span>{characterAncestryLabel(c, entries) || 'Choose ancestry'}
            {ancestrySlots.length + ancestryGranted > 0 && ` (${ancestryFilled}/${ancestrySlots.length + ancestryGranted})`}</span>
        </summary>
        <DeferredContent>{() => <div className="character-section-content">
          <div className="row">
            <Pick label="Ancestry" kind="ancestry" value={c.ancestry} options={of('ancestry')} onChange={(v) => save({ ancestry: v, heritage: undefined, ethnicity: undefined, testSubjectAdaptation: undefined, stellarNomadLore: undefined })} />
            <HeritagePick {...section} />
              {ethnicities.length > 0 && <SearchableSelect label="Ethnicity" aria-label="Ethnicity" value={selectedEthnicity} onChange={(e) => save({ ethnicity: e.target.value || undefined })}>
                <option value="">Not specified</option>
                {selectedEthnicity && !ethnicities.includes(selectedEthnicity) && <option value={selectedEthnicity} disabled={unavailableEthnicity}>
                  {selectedEthnicity}{unavailableEthnicity ? ` (not available for ${c.ancestry ?? 'this ancestry'})` : ''}
                </option>}
                {ethnicities.map(name => <option key={name}>{name}</option>)}
              </SearchableSelect>}
          </div>
          {ancestry && <AncestryDetails entry={ancestry} />}
          {heritage && <AncestryDetails entry={heritage} />}
          {(c.systems.includes('sf2e') && c.ancestry === 'Ysoki' && c.heritage === 'Test-Subject Ysoki')
            && <Info label="Test-Subject Ysoki">
              <a href="https://2e.aonsrd.com/heritages/141-test-subject-ysoki" target="_blank" rel="noreferrer">Heritage rules</a>
            </Info>}
          {hasCyborgHeritage(c) && <Info label="Cyborg">
            <a href="https://2e.aonsrd.com/traits/342-cyborg" target="_blank" rel="noreferrer">Cyborg trait</a>
          </Info>}
          {(hasCyborgHeritage(c) || testSubjectAdaptation(c) === 'Cybernetic Augmentation') && !activeFeatsNamed(c, 'Biotech Os Upgrade').length && <Info label="Tech">
              <a href="https://2e.aonsrd.com/traits/179-tech" target="_blank" rel="noreferrer">Tech trait</a>
            </Info>}
          {!!activeFeatsNamed(c, 'Biotech Os Upgrade').length && <Info label="Biotech">
            <a href="https://2e.aonsrd.com/traits/216-biotech" target="_blank" rel="noreferrer">Biotech trait</a>
          </Info>}
          {!!activeFeatsNamed(c, 'Eva Module').length && <Info label="Cosmic">
            <a href="https://2e.aonsrd.com/traits/52-cosmic" target="_blank" rel="noreferrer">Cosmic trait</a>
          </Info>}
          <PioneerHumanOptions {...section} />
          {flaws.length > 0 && <small>Ancestry flaw: {flaws.map((a) => a.toUpperCase()).join(', ')}</small>}
          <SearchableFeatSlots {...section} categories={['ancestry']} title="Ancestry Feats" plannedFeatSlots={featSlots} />
        </div>}</DeferredContent>
      </DeferredDetails>

      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Background</strong>
          <span>{c.background ? backgroundLabel(c.background) : 'Choose background'}</span>
        </summary>
        <div className="character-section-content">
          <Pick label="Background" kind="background" value={c.background} options={of('background')} terrainLore={c.backgroundTerrainLore}
            backgroundLores={c.backgroundLores} deityLores={availableDeityLores}
            onChange={(background, terrain, lore, custom) => save({ background, ...(background && terrain
              ? { backgroundTerrainLore: { ...c.backgroundTerrainLore, [background]: terrain } } : {}),
            ...(background && (lore || custom) ? { backgroundLores: { ...c.backgroundLores, [background]: [lore ?? ''] } } : {}) })} />
          {background && <BackgroundDetails entry={background} label={backgroundLabel(background.name)} />}
          {freeHeart && <Pick label="Free Heart background" kind="background" value={freeHeart.choice}
            options={of('background').filter(entry => freeHeartOptions?.has(entry.name))}
            terrainLore={c.backgroundTerrainLore} backgroundLores={c.backgroundLores} deityLores={availableDeityLores}
            onChange={(choice, terrain, lore, custom) => save({ feats: c.feats.map(feat => feat === freeHeart ? { ...feat, choice } : feat),
              ...(choice && terrain ? { backgroundTerrainLore: { ...c.backgroundTerrainLore, [choice]: terrain } } : {}),
              ...(choice && (lore || custom) ? { backgroundLores: { ...c.backgroundLores, [choice]: [lore ?? ''] } } : {}) })} />}
          {extraBackground && <BackgroundDetails entry={extraBackground} label={`Free Heart: ${extraBackground.name}`} />}
          <Achievements {...section} />
        </div>
      </DeferredDetails>

      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Class</strong>
          <span>{classLabel(c, entries) || 'Choose class'}{classSlots.length > 0 && `, ${classFilled}/${classSlots.length}`}</span>
          <RageToggle {...section} summary />
          <AimToggle {...section} summary />
          <HuntPreyToggle {...section} summary />
          <DeviseAStratagemToggle {...section} summary />
        </summary>
        <DeferredContent>{() => <div className="character-section-content">
          <div className="row">
            <ClassPick c={c} entries={entries} save={save} options={of('class')} />
          </div>
          <WitchwarperAnchor c={c} save={save} />
          <TechnomancerFeatures {...section} />
          {characterClassSkills(c, entries).choices.length > 0 && (
              <SearchableSelect label="Class skill" aria-label="Class skill" value={c.classSkill ?? ''} onChange={(e) => save({ classSkill: e.target.value || undefined })}>
                <option value="">Choose skill</option>
                {[...characterClassSkills(c, entries).choices].sort((a, b) => a.localeCompare(b)).map((s) => <option key={s}>{s}</option>)}
              </SearchableSelect>
          )}
          {subclassChoice && <>
            {c.className !== 'Investigator' && subclassChoice.options.length > 0 && <SearchableSelect label={subclassChoice.label} aria-label={subclassChoice.label}
              value={choiceValue} onChange={event => {
                const value = event.target.value
                if (value && !subclassChoice.options.includes(value)) return
                save({ subclassSkillChoices: { ...c.subclassSkillChoices, [subclassChoice.key]: value } })
              }}>
              <option value="">Choose {subclassChoice.label.toLowerCase()}</option>
              {choiceValue && !subclassChoice.options.includes(choiceValue) && <option disabled>{choiceValue}</option>}
              {subclassChoice.options.map(value => <option key={value}>{value}</option>)}
            </SearchableSelect>}
            {(subclassChoice.options.length === 0 || choiceValue === 'Lore') && <label>Lore specialty{' '}
              <input aria-label={`${subclassChoice.label} specialty`}
                key={`${subclassChoice.key}:${choiceValue}`}
                defaultValue={c.subclassSkillChoices?.[subclassChoice.options.length ? `${subclassChoice.key}:lore` : subclassChoice.key]?.replace(/ Lore$/i, '') ?? ''}
                onBlur={event => {
                  const name = event.target.value.trim().replace(/\s+Lore$/i, '')
                  const key = subclassChoice.options.length ? `${subclassChoice.key}:lore` : subclassChoice.key
                  save({ subclassSkillChoices: { ...c.subclassSkillChoices, [key]: name ? `${name} Lore` : '' } })
                }} />
            </label>}
          </>}
          {additionalInvestigatorMethods.map(method => {
            const choice = subclassSkillChoice({ ...c, subclass: method.name }, entries)
            const value = choice ? c.subclassSkillChoices?.[choice.key] ?? '' : ''
            return <Fragment key={method.id}>
              {choice && (choice.options.length === 0 || value === 'Lore') && <label>{method.name} Lore specialty{' '}
                <input aria-label={`${method.name} methodology Lore specialty`}
                  key={`${choice.key}:${value}`}
                  defaultValue={c.subclassSkillChoices?.[choice.options.length ? `${choice.key}:lore` : choice.key]?.replace(/ Lore$/i, '') ?? ''}
                  onBlur={event => {
                    const name = event.target.value.trim().replace(/\s+Lore$/i, '')
                    const key = choice.options.length ? `${choice.key}:lore` : choice.key
                    save({ subclassSkillChoices: { ...c.subclassSkillChoices, [key]: name ? `${name} Lore` : '' } })
                  }} />
              </label>}
            </Fragment>
          })}
          {klass && <Info label={klass.name}>{detail(klass)}</Info>}
          {!c.boosts && (() => {
            const choices = boostSlots(c, entries).find(slot => slot.key === 'class')?.options
            return choices && <label>Class key attribute <select aria-label="Class key attribute"
              value={c.classKeyAbility ?? ''} onChange={event => {
                const ability = choices.find(option => option === event.target.value)
                save({ classKeyAbility: ability })
              }}>
              <option value="">Choose attribute</option>
              {choices.map(ability => <option key={ability} value={ability}>{ABILITY_LABEL[ability]}</option>)}
            </select></label>
          })()}
          <SearchableFeatSlots {...section} categories={['class']} title="Class Features & Feats" plannedFeatSlots={featSlots}
            selectors={[
              ...(c.className !== 'Druid' && c.className !== 'Investigator' && subclasses.length > 0 ? [{ key: 'subclass-choice', level: 1, name: subclass ? (c.className === 'Ranger' ? `${subclass.name} Edge` : subclass.name) : subclassLabel, control: <SubclassSlot c={c} entries={entries}
                label={subclassLabel} disabled={!!selectedClassArchetype(c, entries)} selected={subclass}
                options={subclasses.filter(entry => c.className !== 'Inventor'
                  || !c.feats.some(feat => ['Second Innovation', 'Third Innovation'].includes(feat.name) && feat.choice === entry.name))}
                displayName={entry => c.className === 'Ranger' ? `${entry.name} Edge` : entry.name}
                describe={entry => LEVELED_SUBCLASS_CLASSES.includes(c.className ?? '') && c.systems.includes('pf2e')
                  ? { ...entry, description: subclassBaseDescription(entry) } : entry}
                onChange={name => save({ subclass: name ?? '' })} /> }] : []),
              ...((c.className === 'Druid' || c.className === 'Investigator' && (subclasses.length > 0 || !!subclassName) || c.className === 'Necromancer'
              || c.className === 'Wizard' && c.systems.includes('pf2e')) ? [{ key: 'class-choice', level: 1, control: <>
          {c.className === 'Investigator' && (subclasses.length > 0 || !!subclassName) && <>
            {c.className === 'Investigator' ? <SearchableSelect label="Methodology" aria-label="Methodology"
              value={methodPickerValue} disabled={!!selectedClassArchetype(c, entries)} onChange={event => {
                const value = event.target.value
                const separator = value.indexOf('|')
                const method = separator < 0 ? value : value.slice(0, separator)
                const skill = separator < 0 ? undefined : value.slice(separator + 1)
                if (method && !investigatorMethodNames.includes(method)) return
                const choice = method ? subclassSkillChoice({ ...c, className: 'Investigator', subclass: method }, entries) : undefined
                if (choice?.options.length && (!skill || !choice.options.includes(skill))) return
                save({ subclass: method, ...(choice ? {
                  subclassSkillChoices: { ...c.subclassSkillChoices, [choice.key]: skill ?? '' },
                } : {}) })
              }}>
              <option value="">No methodology</option>
              {methodPickerValue && !investigatorMethodVariants.some(option => option.value === methodPickerValue)
                && <option value={methodPickerValue} disabled>{subclassName}{subclassChoice?.options.length ? ' (choose skill)' : ''}</option>}
              {investigatorMethodVariants.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SearchableSelect> : null}
          </>}
          {c.className === 'Necromancer' && <>
            <Pick label="Fatal Method" kind="fatal method" value={fatalMethod} options={fatalMethods}
              onChange={value => save({ fatalMethod: value as FatalMethod | undefined })} />
          </>}
          {c.className === 'Wizard' && c.systems.includes('pf2e') && <>
            <Pick label="Arcane Thesis" kind="arcane thesis" value={arcaneThesis} options={arcaneTheses}
              onChange={value => save({ arcaneThesis: value as ArcaneThesis | undefined })} />
          </>}
          {c.className === 'Druid' && (
              <SearchableSelect label="Druidic Order" aria-label="Druidic Order" value={subclassName ?? ''} onChange={(e) => save({ order: e.target.value })}>
                <option value="">No order</option>
                {Object.keys(DRUID_ORDERS).filter((o) => o === subclassName || !c.feats.some((f) => f.name === 'Order Explorer' && (f.choice === o || o === 'Wild' && f.choice === 'Untamed'))).sort((a, b) => (a === 'Wild' ? 'Untamed' : a).localeCompare(b === 'Wild' ? 'Untamed' : b)).map((o) => <option key={o} value={o}>{o === 'Wild' ? 'Untamed' : o}</option>)}
              </SearchableSelect>
          )}
            </> }] : []),
            ]}
            features={[...[
              ...rogueRackets(c, entries).filter(racket => racket !== subclassName).flatMap(racket => {
                const entry = subclasses.find(candidate => candidate.name === racket)
                return entry ? [{ entry, label: `${racket} Racket (Versatile Rogue)` }] : []
              }),
              ...additionalInvestigatorMethods.map(entry => ({ entry, label: `${entry.name} Methodology (Versatile Investigator)` })),
              ...additionalEnvoyStyles.map(entry => ({ entry, label: `${entry.name} Leadership Style (Versatile Envoy)` })),
              ...c.feats.filter(feat => ['Second Innovation', 'Third Innovation'].includes(feat.name)).flatMap(feat => {
                const entry = subclasses.find(candidate => candidate.name === feat.choice)
                return entry ? [{ entry, label: `${entry.name} Innovation (${feat.name})` }] : []
              }),
              ...c.feats.filter(feat => feat.name === 'Order Explorer').flatMap(feat => {
                const order = feat.choice === 'Untamed' ? 'Wild' : feat.choice
                const entry = subclasses.find(candidate => candidate.name === order || candidate.name === feat.choice)
                return entry ? [{ entry, label: `${feat.choice} Order (Order Explorer)` }] : []
              }),
              ...(c.systems.includes('pf2e') && subclass && LEVELED_SUBCLASS_CLASSES.includes(c.className ?? '')
                ? subclassFeatureRows(subclass).filter(row => row.level <= c.level).map(row => ({
                  entry: { ...subclass, description: row.description, data: { ...subclass.data, ...(row.actions ? { actions: row.actions } : {}) } }, label: c.className === 'Ranger' && row.name === 'Masterful Hunter' ? `Masterful ${subclass.name} Edge` : `${row.name} (${subclass.name})`, level: row.level })) : []),
              ...(c.systems.includes('pf2e') && c.className === 'Gunslinger' ? activeFeatsNamed(c, 'Versatile Gunslinger').flatMap(feat => {
                const way = subclasses.find(entry => entry.name === feat.choice)
                const taken = featTakenLevel(feat)
                return way ? subclassFeatureRows(way).map(row => ({ row, way, level: Math.max(row.level, taken) })).filter(({ level }) => level <= c.level)
                  .map(({ row, way, level }) => ({ entry: { ...way, description: row.description, data: { ...way.data, ...(row.actions ? { actions: row.actions } : {}) } },
                    label: `${row.name} (${way.name})`, level })) : []
              }) : []),
              ...(c.className === 'Mystic' && c.systems.includes('sf2e') && subclass && MYSTIC_CONNECTIONS[subclass.name] ? [
                { entry: { ...subclass, description: MYSTIC_CONNECTIONS[subclass.name].harmony }, label: `${subclass.name} Harmony`, level: 1 },
                { entry: { ...subclass, description: MYSTIC_CONNECTIONS[subclass.name].perfectHarmony }, label: `${subclass.name} Perfect Harmony`, level: 19 },
              ].filter(row => row.level <= c.level) : []),
              ...(c.className === 'Operative' && c.systems.includes('sf2e') ? [{ entry: AIM, label: 'Aim', level: 1 }] : []),
              ...(c.className === 'Operative' && c.systems.includes('sf2e') ? [
                ...(subclass ? [{ entry: subclass, level: 1 }] : []),
                ...additionalOperativeSpecializations.map(entry => ({ entry, level: featTakenLevel(
                  c.feats.find(feat => feat.name === 'Versatile Operative' && feat.choice === entry.name) ?? { level: 1 } as Character['feats'][number]) })),
              ].flatMap(({ entry, level }) => {
                const exploit = OPERATIVE_EXPLOITS[entry.name]
                const enhancedLevel = Math.max(9, level)
                return exploit ? [
                  { entry: { ...entry, description: exploit.exploit }, label: `${entry.name} Exploit`, level },
                  ...(exploit.exploitAction ? [{ entry: { ...entry, description: exploit.exploitAction.description, data: { ...entry.data, actions: exploit.exploitAction.actions } },
                    label: `${exploit.exploitAction.name} (${entry.name})`, level }] : []),
                  { entry: { ...entry, description: exploit.enhanced }, label: `${entry.name} Enhanced Exploit`, level: enhancedLevel },
                  ...(exploit.enhancedAction ? [{ entry: { ...entry, description: exploit.enhancedAction.description, data: { ...entry.data, actions: exploit.enhancedAction.actions } },
                    label: `${exploit.enhancedAction.name} (${entry.name})`, level: enhancedLevel }] : []),
                ].filter(row => row.level <= c.level) : []
              }) : []),
            ].map(({ entry, label, level }: { entry: ContentEntry; label: string; level?: number }) => ({ ...entry, id: `${entry.id}:${label}`, name: label, description: /^Trained in [^.]*\.\s*$/.test(entry.description ?? '') ? '' : entry.description, level: level ?? (/\((Versatile |Second Innovation|Third Innovation|Order Explorer)/.test(label)
              ? featTakenLevel(c.feats.find(feat => (feat.name.startsWith('Versatile ') || /Innovation|Order Explorer/.test(feat.name)) && (feat.choice === entry.name || feat.choice === 'Untamed' && entry.name === 'Wild')) ?? { level: 1 } as Character['feats'][number]) : 1) })), ...(c.className ? classFeatures(entries, c) : [])]} prelude={<ClassFeatures {...section} />} />
        </div>}</DeferredContent>
      </DeferredDetails>

      {featSection('archetype')}
      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Defense</strong>
          <span>Armor Class <TotalBreakdown label="Armor Class" breakdown={armorClassBreakdown(c, entries)} />, Hit Points {defense.hp}
            {temporaryHp && `+${temporaryHp.value}`}</span>
          <span onClick={event => { if (event.target instanceof Element && event.target.closest('button')) event.stopPropagation() }}>
            <ResistanceSummary c={c} entries={entries} />
          </span>
          {(shield || shieldCantrip || boneShield || parry > 0 || hasDermalPlating(c)) && <span className="combat-summary-toggles" onClick={(event) => event.stopPropagation()}>
            <DermalPlatingToggle c={c} save={save} context="(summary)" />
            {shield && <label title={shieldAlwaysRaisedSource(c) ? `Always raised by ${shieldAlwaysRaisedSource(c)}` : undefined}>
              <input type="checkbox" aria-label={`${raiseShieldLabel} (summary)`} checked={shieldRaised(c)} disabled={!!shieldAlwaysRaisedSource(c)}
                onChange={(event) => { if (!shieldAlwaysRaisedSource(c)) save(shieldRaisedChange(c, event.target.checked)) }} /> {raiseShieldLabel} (+{shieldAcBonus(c, entries)} AC)</label>}
            {boneShield ? <label><input type="checkbox" aria-label="Raise Bone Shield (summary)"
              checked={!!c.boneShieldRaised} onChange={event => save({ boneShieldRaised: event.target.checked })} /> Raise Bone Shield (+2 AC)</label>
            : shieldCantrip && <label><input type="checkbox" aria-label="Raise Shield Cantrip (summary)"
              checked={isSpellActive(c, entries, 'Shield')}
              onChange={event => save(spellActiveChange(c, 'Shield', event.target.checked))} /> Raise Shield Cantrip (+1 AC)</label>}
            {parryWeapon && parry > 0 && showParryControl(c, shield) && <span><input type="checkbox" aria-label="Parry active (summary)" checked={!!c.parrying || stanceParry}
              disabled={stanceParry} onChange={(event) => { if (!stanceParry) save({ parrying: event.target.checked }) }} />{' '}
              <EntryDescription name="Parry" entry={parryTrait(c, entries)} character={c} entries={entries} deferDetails /> (+{parry} AC)</span>}
          </span>}
        </summary>
        <div className="character-section-content">
          <SkillsSection {...section} part="defense" />
        </div>
      </DeferredDetails>
      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Deity</strong>
          <span>{deity ? deityLabel(deity) : c.deity || 'Optional'}</span>
        </summary>
        <div className="character-section-content">
          <Pick label="Deity" kind="deity" value={c.deity} options={of('deity')} onChange={(v) => save({ deity: v })} />
          <DeityCard deity={deity} />
          {deity && <DivineIntercessions deity={deity} selected={c.divineIntercessions?.[deity.name] ?? []}
            onChange={selected => save({ divineIntercessions: { ...c.divineIntercessions, [deity.name]: selected } })} />}
        </div>
      </DeferredDetails>

      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Equipment</strong>
          <span>{c.equipment.length + (effectiveHandwraps(c, entries) ? 1 : 0) + (c.augmentations?.length ?? 0) + pairedEmpathyBracelets.length
            + (c.weapons ?? []).filter(weapon => !weapon.attachedTo && weapon.id !== GAUNTLET.id
              && weapon.id !== OVERSIZED_THROW.id && weapon.id !== 'sf2e:soldier:offensive-defense'
              && !weapon.id.startsWith('sf2e:solarian:') && weapon.name !== HAFT_STRIKER_WEAPON.name
              && (!isLockedWeapon(c, weapon.name, entries, weapon.id) || isGrantedDwarfClanWeapon(c, entries, weapon))).length
            + ownedArmors(c, entries).filter(armor => c.armors || !armor.id.startsWith('eq-')).length
            + Number(!!c.shield)} Items, {handsUsed}/{handLimit} Hands</span>
        </summary>
        <DeferredContent>{() => <div className="character-section-content">
          <BulkLimits {...section} />
          <ArmorProficiency c={c} entries={entries} />
          <h4>Armor</h4>
          <ArmorList {...section} part="armor" />
          {hasPersonalUpgradeSlot(c) && <h4>Personal Upgrade</h4>}
          <PersonalUpgradeSlot {...section} />
          <EquipmentGroup {...section} group="Arms" rows={equipmentGroups.Arms} />
          <EquipmentGroup {...section} group="Arrows" rows={equipmentGroups.Arrows} />
          <Augmentations {...section} />
          <EquipmentGroup {...section} group="Backpacks" rows={equipmentGroups.Backpacks} />
          <EquipmentGroup {...section} group="Belt" rows={equipmentGroups.Belt} />
          <EquipmentGroup {...section} group="Body" rows={equipmentGroups.Body} />
          <EquipmentGroup {...section} group="Bolts" rows={equipmentGroups.Bolts} />
          <EquipmentGroup {...section} group="Boots" rows={equipmentGroups.Boots} />
          <EquipmentGroup {...section} group="Bracelets" rows={equipmentGroups.Bracelets} bracelets={pairedEmpathyBracelets} />
          <EquipmentGroup {...section} group="Bullets" rows={equipmentGroups.Bullets} />
          <EquipmentGroup {...section} group="Chest" rows={equipmentGroups.Chest} />
          <EquipmentGroup {...section} group="Cloaks" rows={equipmentGroups.Cloaks} />
          <EquipmentGroup {...section} group="Clothing" rows={equipmentGroups.Clothing} />
          <EquipmentGroup {...section} group="Eyes" rows={equipmentGroups.Eyes} />
          <EquipmentGroup {...section} group="Eyewear" rows={equipmentGroups.Eyewear} />
          <EquipmentGroup {...section} group="Face" rows={equipmentGroups.Face} />
          <EquipmentGroup {...section} group="Feet" rows={equipmentGroups.Feet} />
          <Gadgets {...section} />
          <EquipmentGroup {...section} group="Gloves" rows={equipmentGroups.Gloves} />
          <EquipmentGroup {...section} group="Grafts" rows={equipmentGroups.Grafts} />
          <GrenadeSpecialist {...section} />
          <EquipmentGroup {...section} group="Grenades" rows={equipmentGroups.Grenades} />
          <EquipmentGroup {...section} group="Hands" rows={equipmentGroups.Hands} />
          <EquipmentGroup {...section} group="Handwraps" rows={equipmentGroups.Handwraps} />
          <EquipmentGroup {...section} group="Head" rows={equipmentGroups.Head} />
          <EquipmentGroup {...section} group="Headband" rows={equipmentGroups.Headband} />
          <EquipmentGroup {...section} group="Headwear" rows={equipmentGroups.Headwear} />
          <EquipmentGroup {...section} group="Mask" rows={equipmentGroups.Mask} />
          <MunitionsCrafter {...section} />
          <EquipmentGroup {...section} group="Neck" rows={equipmentGroups.Neck} />
          <EquipmentGroup {...section} group="Necklaces" rows={equipmentGroups.Necklaces} />
          <EquipmentGroup {...section} group="Other equipment" rows={equipmentGroups['Other equipment']} />
          <EquipmentGroup {...section} group="Other Worn Items" rows={equipmentGroups['Other Worn Items']} />
          <EquipmentGroup {...section} group="Poisons" rows={equipmentGroups.Poisons}
            simplePoisons={activeFeatsNamed(c, 'Poison Weapon').length > 0} />
          <EquipmentGroup {...section} group="Rings" rows={equipmentGroups.Rings} />
          <h4>Shield</h4>
          <ArmorList {...section} part="shield" />
          <EquipmentGroup {...section} group="Shoulders" rows={equipmentGroups.Shoulders} />
          <EquipmentGroup {...section} group="Tattoos" rows={equipmentGroups.Tattoos} />
          <EquipmentGroup {...section} group="Throat" rows={equipmentGroups.Throat} />
          <EquipmentGroup {...section} group="Toolkits" rows={equipmentGroups.Toolkits} />
          <EquipmentGroup {...section} group="Torso" rows={equipmentGroups.Torso} />
          <WeaponProficiency c={c} entries={entries} />
          <h4>Weapons</h4>
          {(() => {
            const offensiveDefense = offensiveDefenseAttack(c, entries)
            return offensiveDefense
              ? <WeaponList {...section} entries={[...entries, offensiveDefense.entry]} additionalWeapons={[offensiveDefense.weapon]} />
              : <WeaponList {...section} />
          })()}
          <EquipmentGroup {...section} group="Wrists" rows={equipmentGroups.Wrists} />
          <EquipmentSearch {...section} />
        </div>}</DeferredContent>
      </DeferredDetails>

      <DeferredDetails>
        <FormulasSummary {...section} />
        <FormulasContent {...section} />
      </DeferredDetails>
      {featSection('general')}
      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Languages</strong>
          <span>{languageSummary}{languageSlotSources.length > 0 && <span onClick={event => event.stopPropagation()}>
            <SourceNote source="Language slots" note={languageSlotSources.map(item => `${item.value > 0 ? '+' : ''}${item.value} ${item.source}`).join('; ')} />
          </span>}</span>
        </summary>
        <div className="character-section-content">
          <LanguagesSection {...section} />
        </div>
      </DeferredDetails>
      <DeferredDetails>
        <MinionsSummary {...section} />
        <MinionsContent {...section} />
      </DeferredDetails>
      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Offense</strong>
          <span>{weaponCount} Weapons, {handsUsed}/{handLimit} Hands</span>
        </summary>
        <div className="character-section-content">
          <SkillsSection {...section} part="offense" />
        </div>
      </DeferredDetails>
      <DeferredDetails>
        <summary className="character-section-summary"><strong>Picture</strong><span>{c.picture ? 'Added' : 'None'}</span></summary>
        <DeferredContent>{() => <CharacterPictures picture={c.picture}
          save={picture => save({ picture })} />}</DeferredContent>
      </DeferredDetails>
      <DeferredDetails>
        <SensesAndSpeedSummary {...section} />
        <div className="character-section-content">
          <SensesAndSpeed {...section} />
        </div>
      </DeferredDetails>
      {featSection('skill')}
      <DeferredDetails>
        <SkillsSummary {...section} />
        <div className="character-section-content">
          <SkillsSection {...section} deityLores={availableDeityLores} />
        </div>
      </DeferredDetails>
      <SpellsPanel {...section} />
      <DeferredDetails>
        <StatusesSummary {...section} />
        <StatusesContent {...section} />
      </DeferredDetails>
    </section>
  )
}

function KillersBeltRoll({ name, entry }: { name: string; entry?: ContentEntry }) {
  const match = /^Killer's Belt\b/.test(name) ? /(\d+)d(\d+) persistent bleed/.exec(entry?.description ?? '') : null
  return match ? <DamageRoll name="Bleeding Rubies" actions="Single Action"
    damage={{ label: 'Persistent bleed', dice: Number(match[1]), sides: Number(match[2]), type: 'persistent bleed' }} /> : null
}
