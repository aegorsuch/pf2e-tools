import { Info } from './Info'
import { confirmRemoval, REMOVAL_EVENT } from './confirmRemoval'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AbilitiesContent, AbilityBoostChoices } from './AbilitiesSection'
import { Achievements } from './Achievements'
import { EntryDescription } from './EntryDescription'
import { SearchableSelect } from './SearchableSelect'
import { DRUID_ORDERS, activeFeatsNamed, armorClassBreakdown, classLabel, selectedSubclass, subclassOptions, subclassSkillChoice, classSkills, ancestryFlaws, ancestryLabel, computeAbilities, cyborgTestSubject, defenseSummary, equippedShield, featChoiceOptions, freeHeartBackground, hasCyborgHeritage, hasParryWeapon, heritagesFor, isBucklerShield, isPioneerHuman, isVersatileHeritage, languageAllowance, migrateAncestralLinguistics, ownedWeapons, parryValue, plannedSlots, rogueRackets, shieldAcBonus, shieldParagonActive, shieldRaised, shieldRaisedChange, activeHomebrewDedications, homebrewDedication, orphanedArchetypeFeats, syncOrderExplorerFeats, terrainExpertiseOptions, testSubjectAdaptation, unslottedFeats, type SectionProps } from './builder'
import { ClassFeatures } from './ClassFeatures'
import { featSectionGrants, SearchableFeatSlots } from './FeatSlots'
import { ArmorList, Augmentations, BulkLimits, Gadgets, GrenadeMods, GrenadeSpecialist, HandwrapsGear, MunitionsCrafter, SimplePoisons, WarmaskGear, WeaponList } from './GearSection'
import { adoptedAncestryText } from './featChoices'
import { ActionIcon } from './ActionIcon'
import { LanguagesSection } from './LanguagesSection'
import { ArmorProficiency, WeaponProficiency, commonLoreOptions, RageToggle, SensesAndSpeed, SkillsSection, SkillsSummary } from './SkillsSection'
import { SpellsContent, SpellsSummary } from './SpellsSection'
import { StancesContent, StancesSummary } from './StancesSection'
import { effectiveHandwraps, ringCapacity, ringCount, twinnedDefenseActive } from './builder'
import { MinionsContent, MinionsSummary } from './MinionsSection'
import { FormulasContent, FormulasSummary } from './FormulasSection'
import { constructCompanionChange, faithfulSteedChange, isCompanionEquipmentItem } from './companions'
import { equippedHands, totalHandCapacity } from './builder'
import { ethnicityLabel, ethnicityOptions } from './featAccess'
import { db } from './db'
import { TotalBreakdown } from './TotalBreakdown'
import { DeferredDetails } from './DeferredDetails'
import { CheekPouches } from './CheekPouches'
import { HighTechMedic } from './HighTechMedic'
import { clearItemGlitching, setEnduringMod } from './mechanicEnduring'
import { ItemTroubleshoot } from './ItemTroubleshoot'
import { isGrenade } from './formulas'
import type { Character, ContentEntry, EntryKind } from './types'
import { WORN_EQUIPMENT_GROUPS, equipmentDisplayName, equipmentFitsGroup, equipmentGroupName, type EquipmentGroupName } from './equipmentGroups'
import { DivineIntercessions } from './intercessionPicker'
import { syncDivineBoonFeats } from './divineIntercessions'
import { NamedArmorAbilities } from './NamedArmorAbilities'
import { backgroundLoreSlots, backgroundVariants, type BackgroundVariant } from './builder'
import { backgroundLoreOptions, characterDeityLores, deityLoreBackgroundEntries } from './backgrounds'
import { getSettings } from './settings'
import { fatalMethodOptions, selectedFatalMethod, type FatalMethod } from './fatalMethods'

const NONE: ContentEntry[] = []

function SelectedSubclassRules({ entry, label = entry.name }: { entry: ContentEntry, label?: string }) {
  return <section aria-label={`${entry.name} rules`}>
    <strong>{label}</strong>
    {entry.description.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => {
      const label = /^([^:.\n]{1,60}):\s+/.exec(paragraph)
      return <p key={index}>{label && <><strong>{label[1]}</strong>
        {entry.data.subclass_type === 'fatal-method' && label[1] === 'Consume Thrall' && <> <ActionIcon actions="Free Action" /></>}
        {' '}</>}{label ? paragraph.slice(label[0].length) : paragraph}</p>
    })}
  </section>
}

const deityLabel = (deity: ContentEntry) => {
  const epithet = deity.name === 'Lao Shu Po' && deity.source === 'official' ? 'Grandmother Rat' : deity.data.epithet
  return typeof epithet === 'string' && epithet.trim()
    ? `${deity.name}, ${epithet.trim().replace(/^The /, 'the ')}`
    : deity.name
}

function Pick({ label, kind, value, options, onChange, ancestry, terrainLore, loreOptions = NONE_LORES, backgroundLores }: {
  label: string
  kind: string
  value?: string
  options: ContentEntry[]
  onChange: (v: string | undefined, terrain?: string, lore?: string, custom?: boolean) => void
  ancestry?: string
  terrainLore?: Character['backgroundTerrainLore']
  loreOptions?: string[]
  backgroundLores?: Character['backgroundLores']
}) {
  const [ready, setReady] = useState(false)
  const variants = useMemo<BackgroundVariant[]>(() => kind === 'background' ? backgroundVariants(options, loreOptions)
    : options.map(background => ({ value: background.name, background })), [options, kind, loreOptions])
  const selectedLore = backgroundLores?.[value ?? '']?.[0]
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
    if (kind !== 'heritage') return [...labels.keys()].sort().map(option)
    const names = [...labels.keys()].sort()
    return [false, true].map(versatile => {
      const group = names.filter(name => isVersatileHeritage(byName.get(name)!) === versatile)
      return group.length > 0 && <optgroup key={String(versatile)} label={versatile ? 'Versatile' : ancestry ?? 'Ancestry'}>
        {group.map(option)}
      </optgroup>
    })
  }, [labels, ready, kind, byName, ancestry])
  const prepare = () => {
    // Populate before the browser opens its native select popup.
    if (!ready) flushSync(() => setReady(true))
  }
  const unavailable = kind === 'heritage' && !!value && !labels.has(value)
  return (
      <SearchableSelect label={label} aria-label={label} value={selectedValue ?? ''} onPrepare={prepare} optionCount={labels.size}
        searchText={kind === 'background' ? name => String(byName.get(name)?.data.feat ?? '') : undefined}
        renderDetails={name => {
          const entry = byName.get(name)
          return entry ? <EntryDescription name={entry.name} entry={entry} buttonLabel="Details" className="picker-details" /> : null
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
      </SearchableSelect>
  )
}

const NONE_LORES: string[] = []

export function BackgroundLoreChoices({ c, entries, save, background, options }: SectionProps & {
  background: ContentEntry; options: string[]
}) {
  const slots = backgroundLoreSlots(c, entries).filter(slot => slot.background.name === background.name)
  const available = backgroundLoreOptions(background, options)
  if (background.data.background_choice_required || slots.length === 1 && available.includes(slots[0].value)) return null
  const id = `background-lores-${encodeURIComponent(background.id)}`
  return <>{slots.map(slot => <label key={`${slot.index}:${slot.value}`}>
    {slots.length > 1 ? `Lore ${slot.index + 1}` : 'Lore'}{' '}
    <input aria-label={`${background.name} Lore ${slot.index + 1}`} defaultValue={slot.value} list={id}
      onInput={event => event.currentTarget.setCustomValidity('')}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }}
      onBlur={event => {
        const input = event.currentTarget
        const value = input.value.trim().replace(/\s+/g, ' ')
        const name = !value ? '' : /\s+lore$/i.test(value) ? value : `${value} Lore`
        if (/^lore$/i.test(value)) input.setCustomValidity('Enter a Lore specialty.')
        else if (name && slots.some(other => other.index !== slot.index && other.value.toLowerCase() === name.toLowerCase()))
          input.setCustomValidity('This Lore skill is already selected.')
        if (!input.reportValidity() || name === slot.value) return
        const update = () => {
          const choices = [...(c.backgroundLores?.[background.name] ?? [])]
          choices[slot.index] = name
          save({ backgroundLores: { ...c.backgroundLores, [background.name]: choices } })
        }
        if (!name && slot.value) {
          confirmRemoval(`"${slot.value}"`, update)
          input.value = slot.value
        } else update()
      }} />
  </label>)}{!!slots.length && <datalist id={id}>{available.map(name => <option key={name} value={name} />)}</datalist>}</>
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

export function EquipmentSearch({ c, entries, save, category, onClose }: SectionProps & { category?: EquipmentGroupName; onClose?: () => void }) {
  const [query, setQuery] = useState('')
  const ringsFull = ringCount(c, entries) >= ringCapacity(c)
  const matches = useMemo(() => {
    const q = query.trim().replace(/[\u2018\u2019]/g, "'").toLowerCase()
    if (!q && !category) return []
    const candidates = entries.filter(e => e.kind === 'item' && !isCompanionEquipmentItem(e)
        && (!q || [e.name.replace(/[\u2018\u2019]/g, "'"), equipmentDisplayName(e.name)].some(name => name.toLowerCase().includes(q)))
        && (!category || equipmentFitsGroup(e, category)))
    const owned = new Set(c.equipment.map(item => item.name))
    const unique = new Map<string, ContentEntry>()
    for (const entry of candidates) {
      const key = entry.source === 'official' && entry.data.url
        ? `${entry.systems.join(',')}:${entry.data.url}:${entry.level}:${equipmentDisplayName(entry.name)}` : entry.id
      const previous = unique.get(key)
      if (!previous || owned.has(entry.name) || !owned.has(previous.name)
        && entry.data.price !== undefined && previous.data.price === undefined) unique.set(key, entry)
    }
    return [...unique.values()].sort((a, b) => equipmentDisplayName(a.name).localeCompare(equipmentDisplayName(b.name)))
  }, [entries, query, category, c.equipment])
  return <div className="equipment-search">
    <div className="row">
      <input type="search" aria-label={`Search ${category?.toLowerCase() ?? 'equipment'}`} placeholder={`Search ${category?.toLowerCase() ?? 'equipment'}`}
        autoFocus={!!onClose} value={query} onChange={event => setQuery(event.target.value)} />
      {onClose && <button type="button" onClick={onClose}>Cancel</button>}
    </div>
    <ul className="gear-results">
      {matches.map(g => <li key={g.id}>
        <EntryDescription name={g.name} entry={g} className="equipment-name" /> <ActionIcon entry={g} /> ({g.kind}{g.level ? ` ${g.level}` : ''}){' '}
        <button aria-label={`Add ${equipmentDisplayName(g.name)}`} disabled={equipmentGroupName(g) === 'Rings' && ringsFull}
          title={equipmentGroupName(g) === 'Rings' && ringsFull ? 'Ring capacity reached' : undefined} onClick={() => {
          const have = c.equipment.find(item => item.name === g.name
            && (!category || equipmentGroupName(g, item.name, item.group) === category))
          save({ equipment: have ? c.equipment.map(item => item === have ? { ...item, qty: item.qty + 1 } : item)
            : [...c.equipment, { name: g.name, qty: 1, ...(category ? { group: category } : {}) }] })
          onClose?.()
        }}>Add</button>
      </li>)}
      {(query.trim() || category) && !matches.length && <li><small>No matching {category?.toLowerCase() ?? 'equipment'}.</small></li>}
    </ul>
  </div>
}

type EquipmentRow = { item: Character['equipment'][number]; index: number; entry?: ContentEntry }

function EquipmentGroup({ c, entries, save, group, rows, integratedComm, bracelets = [], simplePoisons = false }: SectionProps & { group: EquipmentGroupName; rows: EquipmentRow[]; integratedComm?: ContentEntry | null; bracelets?: string[]; simplePoisons?: boolean }) {
  const [adding, setAdding] = useState(false)
  const searchId = useId()
  const addButton = useRef<HTMLButtonElement>(null)
  const displayed = [
    ...rows.map(row => ({ kind: 'item' as const, name: equipmentDisplayName(row.item.name), row })),
    ...(integratedComm !== undefined ? [{ kind: 'comm' as const, name: 'Comm Unit' }] : []),
    ...bracelets.map(id => ({ kind: 'bracelet' as const, name: 'Bracelet of Empathy', id })),
    ...(simplePoisons ? [{ kind: 'simple-poisons' as const, name: 'Simple injury poisons' }] : []),
    ...(group === 'Mask' && c.systems.includes('pf2e') && activeFeatsNamed(c, 'Orc Warmask').length
      ? [{ kind: 'warmask' as const, name: adoptedAncestryText(c, 'Orc Warmask') }] : []),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const alwaysAvailable = WORN_EQUIPMENT_GROUPS.some(name => name === group) || group === 'Grafts' || group === 'Tattoos'
  if (!displayed.length && !alwaysAvailable) return null
  const body = displayed.length > 0 && <ul>
    {displayed.map(display => {
      if (display.kind === 'warmask') return <li key="warmask"><WarmaskGear c={c} entries={entries} save={save} /></li>
      if (display.kind === 'comm') return <li key="integrated-comm"><EntryDescription name="Comm Unit" entry={integratedComm ?? undefined}
        descriptionNote="Integrated comm unit operated by thought, including calls and photos without speaking or moving. Does not count as an augmentation." /></li>
      if (display.kind === 'bracelet') return <li key={`bracelet-${display.id}`}><EntryDescription name="Bracelet of Empathy"
        entry={entries.find(entry => entry.kind === 'item' && entry.name === 'Collar of Empathy')} className="equipment-name" /></li>
      if (display.kind === 'simple-poisons') return <li key="simple-poisons"><SimplePoisons c={c} entries={entries} save={save} /></li>
      const { item, index, entry } = display.row
      return <li key={`${item.name}-${index}`}>
      <EntryDescription name={item.name} entry={entry} className="equipment-name" /> <ActionIcon entry={entry} />{item.qty > 1 && <span> x{item.qty}</span>}{' '}
      <button onClick={() => confirmRemoval(`gear "${item.name}"`, () => {
        const nextMods = { ...c.mechanicGrenadeMods }
        delete nextMods[`equipment:${item.name}`]
        save({ ...(c.mechanicEnduringMod?.kind === 'medic' && c.mechanicEnduringMod.item === item.mechanicItemId
          ? setEnduringMod(c) : {}), equipment: c.equipment.filter((_, i) => i !== index), mechanicGrenadeMods: nextMods,
          ...clearItemGlitching(c, 'equipment', item.mechanicItemId),
          ...(c.mechanicEnduringMod?.kind === 'grenade' && c.mechanicEnduringMod.item === `equipment:${item.name}`
            ? { mechanicEnduringMod: undefined } : {}) })
      })}>Remove</button>
      <HighTechMedic c={c} save={save} index={index} entry={entry} />
      {entry?.name === 'Shadowed Scale, the Jungle Secret' && <NamedArmorAbilities entry={entry} />}
      <ItemTroubleshoot c={c} save={save} kind="equipment" id={item.mechanicItemId} label={item.name}
        attach={id => ({ equipment: c.equipment.map((gear, i) => i === index ? { ...gear, mechanicItemId: id } : gear) })} />
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

export function CharacterBuilder({ character: c, catalog, onClose, deityLores = NONE_LORES }: {
  character: Character; catalog: ContentEntry[]; onClose: () => void; deityLores?: string[]
}) {
  const systemsKey = c.systems.join()
  const baseEntries = characterCatalog(catalog, systemsKey)
  const deityLoreKey = JSON.stringify(characterDeityLores([c], deityLores))
  const availableDeityLores = useMemo<string[]>(() => JSON.parse(deityLoreKey), [deityLoreKey])
  const entries = useMemo(() => deityLoreBackgroundEntries(baseEntries, availableDeityLores), [baseEntries, availableDeityLores])
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
      const next = { ...current, ...patch, updatedAt: Math.max(Date.now(), current.updatedAt + 1) }
      Object.assign(next, syncDivineBoonFeats(next))
      Object.assign(next, syncOrderExplorerFeats(next, entries))
      Object.assign(next, faithfulSteedChange(next, entries))
      Object.assign(next, constructCompanionChange(next))
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
  useEffect(() => {
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
  const { locked: lockedLanguages, slots: languageSlots } = languageAllowance(c, entries)
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
  const fatalMethods = fatalMethodOptions(entries)
  const fatalMethod = selectedFatalMethod(c)
  const fatalMethodEntry = fatalMethods.find(entry => entry.name === fatalMethod)
  const subclassChoice = subclassSkillChoice(c, entries)
  const choiceValue = subclassChoice ? c.subclassSkillChoices?.[subclassChoice.key] ?? '' : ''
  const background = named('background', c.background)
  const loreOptions = useMemo(() => [...new Set([...commonLoreOptions(availableDeityLores), ...c.lores.map(lore => lore.name),
    ...Object.values(c.backgroundLores ?? {}).flat().filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b)), [c.lores, c.backgroundLores, availableDeityLores])
  const backgroundLabel = (name: string) => {
    const lore = c.backgroundTerrainLore?.[name] ? `${c.backgroundTerrainLore[name]} Lore`
      : c.backgroundLores?.[name]?.filter(Boolean).join(', ')
    return lore ? `${name} (${lore})` : name
  }
  const equipmentGroups = useMemo(() => {
    const items = new Map<string, ContentEntry>()
    const fallback = new Map<string, ContentEntry>()
    for (const entry of entries) {
      if (entry.kind === 'item' && !items.has(entry.name)) items.set(entry.name, entry)
      else if ((entry.kind === 'weapon' || entry.kind === 'armor') && !fallback.has(entry.name)) fallback.set(entry.name, entry)
    }
    const groups: Record<EquipmentGroupName, EquipmentRow[]> = {
      Arrows: [], Bolts: [], Bullets: [], Grafts: [], 'Other equipment': [], Poisons: [], Tattoos: [],
      Arms: [], Backpacks: [], Belt: [], Body: [], Boots: [], Bracelets: [], Chest: [], Cloaks: [], Clothing: [],
      Eyes: [], Eyewear: [], Face: [], Feet: [], Gloves: [], Hands: [], Handwraps: [], Head: [], Headband: [], Headwear: [],
      Mask: [], Neck: [], Necklaces: [], Rings: [], Shoulders: [], Throat: [], Torso: [], Wrists: [], 'Other Worn Items': [],
    }
    c.equipment.forEach((item, index) => {
      const entry = items.get(item.name) ?? fallback.get(item.name)
      const group = equipmentGroupName(entry, item.name, item.group)
      groups[group].push({ item, index, entry })
    })
    Object.values(groups).forEach(rows => rows.sort((a, b) => a.item.name.localeCompare(b.item.name)))
    return groups
  }, [c.equipment, entries])
  const freeHeart = activeFeatsNamed(c, 'Free Heart')[0]
  const freeHeartOptions = freeHeart ? new Set(featChoiceOptions('Free Heart', c, entries, freeHeart.slot ?? '') ?? []) : undefined
  const extraBackground = freeHeartBackground(c, entries)
  const flaws = ancestryFlaws(c, entries)
  const defense = defenseSummary(c, entries)
  const parry = parryValue(c, entries)
  const parryWeapon = hasParryWeapon(c, entries)
  const stanceParry = twinnedDefenseActive(c, entries)
  const shield = equippedShield(c)
  const shieldRaiseLabel = shield && isBucklerShield(shield.name) ? 'Raise Buckler' : 'Raise Shield'
  const weaponCount = ownedWeapons(c, entries).length
  const handsUsed = equippedHands(c, entries)
  const handLimit = totalHandCapacity(c)
  const pairedEmpathyBracelets = (c.companions ?? []).flatMap(companion =>
    companion.equipment?.Collar?.name === 'Collar of Empathy'
      ? [companion.id]
      : [])
  const featSlots = plannedSlots(c, entries)
  const featGrants = featSectionGrants(c, entries, ['skill', 'general'], featSlots)
  const classSlots = featSlots.filter(slot => slot.category === 'class')
  const classFilled = classSlots.filter(slot => c.feats.some(feat => feat.slot === slot.key)).length

  const featSection = (category: 'general' | 'skill' | 'archetype') => {
    const title = { general: 'General Feats', skill: 'Skill Feats', archetype: 'Dedications' }[category]
    const slots = featSlots.filter((slot) => slot.category === category)
    const filled = slots.filter((slot) => c.feats.some((f) => f.slot === slot.key) || c.skippedFeatSlots?.includes(slot.key)).length
    const granted = category === 'archetype' ? 0
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
          <SearchableFeatSlots {...section} categories={[category]} title={title} bare />
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
        <label>Name <input value={c.name} onChange={(e) => save({ name: e.target.value })} /></label>
      </div>
      <DeferredDetails>
        <summary className="character-section-summary"><strong>Ability Scores</strong></summary>
        <AbilitiesContent {...section} />
      </DeferredDetails>
      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Ancestry</strong>
          <span>{ancestryLabel(c.ancestry, c.heritage) || 'Choose ancestry'}</span>
        </summary>
        <div className="character-section-content">
          <div className="row">
            <Pick label="Ancestry" kind="ancestry" value={c.ancestry} options={of('ancestry')} onChange={(v) => save({ ancestry: v, heritage: undefined, ethnicity: undefined })} />
            <Pick label="Heritage" kind="heritage" ancestry={c.ancestry} value={c.heritage}
              options={heritagesFor(entries, c.ancestry).filter(entry => !getSettings().disableAncientElfMultitalented || entry.name !== 'Ancient Elf')}
              onChange={(v) => save({ heritage: v })} />
              <SearchableSelect label="Ethnicity" aria-label="Ethnicity" value={selectedEthnicity} disabled={!c.ancestry} onChange={(e) => save({ ethnicity: e.target.value || undefined })}>
                <option value="">Not specified</option>
                {selectedEthnicity && !ethnicities.includes(selectedEthnicity) && <option value={selectedEthnicity} disabled={unavailableEthnicity}>
                  {selectedEthnicity}{unavailableEthnicity ? ` (not available for ${c.ancestry ?? 'this ancestry'})` : ''}
                </option>}
                {ethnicities.map(name => <option key={name}>{name}</option>)}
              </SearchableSelect>
          </div>
          {ancestry && <AncestryDetails entry={ancestry} />}
          {heritage && <AncestryDetails entry={heritage} />}
          {c.systems.includes('sf2e') && c.ancestry === 'Ysoki' && c.heritage === 'Test-Subject Ysoki' && <label>
            Test-Subject adaptation{' '}
            <select aria-label="Test-Subject adaptation" value={c.testSubjectAdaptation ?? ''}
              onChange={event => {
                const value = event.target.value
                if (value === '' || value === 'Cybernetic Augmentation' || value === 'Extra Limbs'
                  || value === 'Psychic Augmentation' || value === 'Radioactive') {
                  save({ testSubjectAdaptation: value || undefined })
                }
              }}>
              <option value="">Choose adaptation</option>
              <option>Cybernetic Augmentation</option>
              <option>Extra Limbs</option>
              <option>Psychic Augmentation</option>
              <option>Radioactive</option>
            </select>
          </label>}
          {(cyborgTestSubject(c) || c.systems.includes('sf2e') && c.ancestry === 'Ysoki' && c.heritage === 'Test-Subject Ysoki')
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
          <SearchableFeatSlots {...section} categories={['ancestry']} title="Ancestry Feats" />
        </div>
      </DeferredDetails>

      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Background</strong>
          <span>{c.background ? backgroundLabel(c.background) : 'Choose background'}</span>
        </summary>
        <div className="character-section-content">
          <Pick label="Background" kind="background" value={c.background} options={of('background')} terrainLore={c.backgroundTerrainLore}
            loreOptions={loreOptions} backgroundLores={c.backgroundLores}
            onChange={(background, terrain, lore, custom) => save({ background, ...(background && terrain
              ? { backgroundTerrainLore: { ...c.backgroundTerrainLore, [background]: terrain } } : {}),
            ...(background && (lore || custom) ? { backgroundLores: { ...c.backgroundLores, [background]: [lore ?? ''] } } : {}) })} />
          {background && <BackgroundDetails entry={background} label={backgroundLabel(background.name)} />}
          {background && <BackgroundLoreChoices {...section} background={background} options={loreOptions} />}
          {freeHeart && <Pick label="Free Heart background" kind="background" value={freeHeart.choice}
            options={of('background').filter(entry => freeHeartOptions?.has(entry.name))}
            terrainLore={c.backgroundTerrainLore} loreOptions={loreOptions} backgroundLores={c.backgroundLores}
            onChange={(choice, terrain, lore, custom) => save({ feats: c.feats.map(feat => feat === freeHeart ? { ...feat, choice } : feat),
              ...(choice && terrain ? { backgroundTerrainLore: { ...c.backgroundTerrainLore, [choice]: terrain } } : {}),
              ...(choice && (lore || custom) ? { backgroundLores: { ...c.backgroundLores, [choice]: [lore ?? ''] } } : {}) })} />}
          {extraBackground && <BackgroundDetails entry={extraBackground} label={`Free Heart: ${extraBackground.name}`} />}
          {extraBackground && <BackgroundLoreChoices {...section} background={extraBackground} options={loreOptions} />}
          <Achievements {...section} />
        </div>
      </DeferredDetails>

      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Class</strong>
          <span>{classLabel(c, entries) || 'Choose class'}{classSlots.length > 0 && `, ${classFilled}/${classSlots.length}`}</span>
        </summary>
        <div className="character-section-content">
          <div className="row">
            <Pick label="Class" kind="class" value={c.className} options={of('class')} onChange={(v) => save({ className: v, subclass: '', fatalMethod: undefined })} />
            <label>Level <input aria-label="Character level" type="number" min={1} max={20} value={c.level}
              onChange={(e) => save({ level: Math.min(20, Math.max(1, +e.target.value || 1)) })} /></label>
          </div>
          {c.className !== 'Druid' && subclasses.length > 0 && <>
            <Pick label={c.className === 'Necromancer' ? 'Grim Fascination' : c.className === 'Rogue' ? 'Racket' : c.className === 'Ranger' ? "Hunter's Edge" : c.className === 'Champion' ? 'Cause' : c.className === 'Barbarian' ? 'Instinct' : c.className === 'Inventor' ? 'Innovation' : c.className === 'Mechanic' ? 'Exocortex' : c.className === 'Envoy' ? 'Leadership style' : c.className === 'Mystic' ? 'Connection' : c.className === 'Operative' ? 'Specialization' : c.className === 'Witchwarper' ? 'Paradox' : c.className === 'Soldier' ? 'Fighting style' : 'Subclass'}
              kind="subclass" value={subclassName} options={subclasses.filter((entry) => c.className !== 'Inventor'
                || !c.feats.some((feat) => ['Second Innovation', 'Third Innovation'].includes(feat.name) && feat.choice === entry.name))}
              onChange={(v) => save({ subclass: v ?? '' })} />
            {subclass && <SelectedSubclassRules entry={subclass} />}
          </>}
          {c.className === 'Necromancer' && <>
            <Pick label="Fatal Method" kind="fatal method" value={fatalMethod} options={fatalMethods}
              onChange={value => save({ fatalMethod: value as FatalMethod | undefined })} />
            {fatalMethodEntry && <SelectedSubclassRules entry={fatalMethodEntry} />}
          </>}
          {rogueRackets(c, entries).filter(racket => racket !== subclassName).map(racket => {
            const entry = subclasses.find(candidate => candidate.name === racket)
            return entry ? <SelectedSubclassRules key={racket} entry={entry} label={`${racket} racket (Versatile Rogue)`} /> : null
          })}
          {classSkills(klass).choices.length > 0 && (
              <SearchableSelect label="Class skill" aria-label="Class skill" value={c.classSkill ?? ''} onChange={(e) => save({ classSkill: e.target.value || undefined })}>
                <option value="">Choose skill</option>
                {[...classSkills(klass).choices].sort((a, b) => a.localeCompare(b)).map((s) => <option key={s}>{s}</option>)}
              </SearchableSelect>
          )}
          {subclassChoice && <>
            {subclassChoice.options.length > 0 && <SearchableSelect label={subclassChoice.label} aria-label={subclassChoice.label}
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
          {c.className === 'Druid' && (
              <SearchableSelect label="Druidic Order" aria-label="Druidic Order" value={subclassName ?? ''} onChange={(e) => save({ order: e.target.value })}>
                <option value="">No order</option>
                {Object.keys(DRUID_ORDERS).filter((o) => o === subclassName || !c.feats.some((f) => f.name === 'Order Explorer' && (f.choice === o || o === 'Wild' && f.choice === 'Untamed'))).sort((a, b) => (a === 'Wild' ? 'Untamed' : a).localeCompare(b === 'Wild' ? 'Untamed' : b)).map((o) => <option key={o} value={o}>{o === 'Wild' ? 'Untamed' : o}</option>)}
              </SearchableSelect>
          )}
          {c.className === 'Druid' && subclass && <SelectedSubclassRules entry={subclass} />}
          {klass && <Info label={klass.name}>{detail(klass)}</Info>}
          <AbilityBoostChoices {...section} groups={['class']} />
          <ClassFeatures {...section} />
          <SearchableFeatSlots {...section} categories={['class']} title="Class Feats" />
        </div>
      </DeferredDetails>

      {featSection('archetype')}
      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Defense</strong>
          <span>Armor Class <TotalBreakdown label="Armor Class" breakdown={armorClassBreakdown(c, entries)} />, Hit Points {defense.hp}</span>
          {(shield || parry > 0) && <span className="combat-summary-toggles" onClick={(event) => event.stopPropagation()}>
            {shield && <label title={shieldParagonActive(c) ? 'Always raised by Shield Paragon' : undefined}>
              <input type="checkbox" aria-label={`${shieldRaiseLabel} (summary)`} checked={shieldRaised(c)} disabled={shieldParagonActive(c)}
                onChange={(event) => { if (!shieldParagonActive(c)) save(shieldRaisedChange(c, event.target.checked)) }} /> {shieldRaiseLabel} (+{shieldAcBonus(c, entries)} AC)</label>}
            {parryWeapon && parry > 0 && <label><input type="checkbox" aria-label="Parry active (summary)" checked={!!c.parrying || stanceParry}
              disabled={stanceParry} onChange={(event) => { if (!stanceParry) save({ parrying: event.target.checked }) }} /> Parry (+{parry} AC)</label>}
          </span>}
        </summary>
        <div className="character-section-content">
          <SkillsSection {...section} part="defense" />
          <ArmorProficiency c={c} entries={entries} />
          <h4>Armor</h4>
          <ArmorList {...section} part="armor" />
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
          <span>{c.equipment.length + (effectiveHandwraps(c, entries) ? 1 : 0) + (c.augmentations?.length ?? 0) + pairedEmpathyBracelets.length} Items, {handsUsed}/{handLimit} Hands</span>
        </summary>
        <div className="character-section-content">
          <BulkLimits {...section} />
          <ArmorProficiency c={c} entries={entries} />
          <h4>Armor</h4>
          <ArmorList {...section} part="armor" />
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
          <CheekPouches {...section} />
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
          <EquipmentGroup {...section} group="Hands" rows={equipmentGroups.Hands} />
          <EquipmentGroup {...section} group="Handwraps" rows={equipmentGroups.Handwraps} />
          <EquipmentGroup {...section} group="Head" rows={equipmentGroups.Head} />
          <EquipmentGroup {...section} group="Headband" rows={equipmentGroups.Headband} />
          <EquipmentGroup {...section} group="Headwear" rows={equipmentGroups.Headwear} />
          <EquipmentGroup {...section} group="Mask" rows={equipmentGroups.Mask} />
          <MunitionsCrafter {...section} />
          <EquipmentGroup {...section} group="Neck" rows={equipmentGroups.Neck} />
          <EquipmentGroup {...section} group="Necklaces" rows={equipmentGroups.Necklaces} />
          <EquipmentGroup {...section} group="Other equipment" rows={equipmentGroups['Other equipment']}
            integratedComm={hasCyborgHeritage(c) ? entries.find(entry => entry.kind === 'item'
              && entry.name === 'Comm Unit' && entry.systems.includes('sf2e')) ?? null : undefined} />
          <EquipmentGroup {...section} group="Other Worn Items" rows={equipmentGroups['Other Worn Items']} />
          <EquipmentGroup {...section} group="Poisons" rows={equipmentGroups.Poisons}
            simplePoisons={activeFeatsNamed(c, 'Poison Weapon').length > 0} />
          <EquipmentGroup {...section} group="Rings" rows={equipmentGroups.Rings} />
          <h4>Shield</h4>
          <ArmorList {...section} part="shield" />
          <EquipmentGroup {...section} group="Shoulders" rows={equipmentGroups.Shoulders} />
          <EquipmentGroup {...section} group="Tattoos" rows={equipmentGroups.Tattoos} />
          <EquipmentGroup {...section} group="Throat" rows={equipmentGroups.Throat} />
          <EquipmentGroup {...section} group="Torso" rows={equipmentGroups.Torso} />
          <WeaponProficiency c={c} entries={entries} />
          <h4>Weapons</h4>
          <WeaponList {...section} />
          <EquipmentGroup {...section} group="Wrists" rows={equipmentGroups.Wrists} />
          <EquipmentSearch {...section} />
        </div>
      </DeferredDetails>

      <DeferredDetails>
        <FormulasSummary {...section} />
        <FormulasContent {...section} />
      </DeferredDetails>
      {featSection('general')}
      <DeferredDetails>
        <summary className="character-section-summary">
          <strong>Languages</strong>
          <span>{languageSummary}</span>
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
          <RageToggle {...section} summary />
        </summary>
        <div className="character-section-content">
          <SkillsSection {...section} part="offense" />
        </div>
      </DeferredDetails>
      <DeferredDetails>
        <summary className="character-section-summary"><strong>Senses and Speed</strong></summary>
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
      <DeferredDetails>
        <SpellsSummary {...section} />
        <SpellsContent {...section} />
      </DeferredDetails>
      <DeferredDetails>
        <StancesSummary {...section} />
        <StancesContent {...section} />
      </DeferredDetails>
    </section>
  )
}
