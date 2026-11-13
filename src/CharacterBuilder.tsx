import { Info } from './Info'
import { confirmRemoval } from './confirmRemoval'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { AbilitiesSection, AbilityBoostChoices } from './AbilitiesSection'
import { Achievements } from './Achievements'
import { EntryDescription } from './EntryDescription'
import { SearchableSelect } from './SearchableSelect'
import { DRUID_ORDERS, MASTERMIND_SKILLS, activeFeatsNamed, armorClassBreakdown, classLabel, selectedSubclass, subclassOptions, classSkills, ancestryFlaws, ancestryLabel, computeAbilities, defenseSummary, equippedShield, featChoiceOptions, freeHeartBackground, heritagesFor, isPioneerHuman, isVersatileHeritage, languageAllowance, migrateAncestralLinguistics, ownedWeapons, parryValue, plannedSlots, rogueRackets, shieldParagonActive, shieldRaised, shieldRaisedChange, signed, activeHomebrewDedications, homebrewDedication, orphanedArchetypeFeats, terrainExpertiseOptions, unslottedFeats, type SectionProps } from './builder'
import { ClassFeatures } from './ClassFeatures'
import { SearchableFeatSlots } from './FeatSlots'
import { ArmorList, Augmentations, BulkLimits, Gadgets, HandwrapsGear, SimplePoisons, WeaponList } from './GearSection'
import { ActionIcon } from './ActionIcon'
import { LanguagesSection } from './LanguagesSection'
import { SkillsSection } from './SkillsSection'
import { SpellsSection } from './SpellsSection'
import { MinionsSection } from './MinionsSection'
import { FormulasSection } from './FormulasSection'
import { faithfulSteedChange } from './companions'
import { ethnicityOptions } from './featAccess'
import { db } from './db'
import { TotalBreakdown } from './TotalBreakdown'
import type { Character, ContentEntry, EntryKind } from './types'

const NONE: ContentEntry[] = []

const deityLabel = (deity: ContentEntry) => typeof deity.data.epithet === 'string' && deity.data.epithet.trim()
  ? `${deity.name}, ${deity.data.epithet.trim().replace(/^The /, 'the ')}`
  : deity.name

function Pick({ label, kind, value, options, onChange, ancestry }: {
  label: string
  kind: string
  value?: string
  options: ContentEntry[]
  onChange: (v: string | undefined) => void
  ancestry?: string
}) {
  const [ready, setReady] = useState(false)
  const byName = useMemo(() => new Map(options.map(entry => [entry.name, entry])), [options])
  const labels = useMemo(() => new Map(options.map((entry) => [entry.name, kind === 'deity' ? deityLabel(entry) : entry.name])), [options, kind])
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
      <SearchableSelect label={label} aria-label={label} value={value ?? ''} onPrepare={prepare} optionCount={labels.size}
        renderDetails={name => {
          const entry = byName.get(name)
          return entry ? <EntryDescription name={entry.name} entry={entry} buttonLabel="Details" className="picker-details" /> : null
        }}
        onFocus={prepare} onPointerDown={prepare} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">No {kind}</option>
        {value && (!ready || !labels.has(value)) && <option value={value} disabled={unavailable}>
          {labels.get(value) ?? (unavailable ? `${value} (not available for this ancestry)` : value)}
        </option>}
        {choices}
      </SearchableSelect>
  )
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

function EquipmentSearch({ c, entries, save }: SectionProps) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? entries.filter(e => e.kind === 'item' && e.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40)
      : []
  }, [entries, query])
  return <>
    <input placeholder="Search equipment" value={query} onChange={event => setQuery(event.target.value)} />
    <ul>
      {matches.map(g => <li key={g.id}>
        {detail(g) ? <Info label={g.name}>{detail(g)}</Info> : <b>{g.name}</b>} <ActionIcon entry={g} /> ({g.kind}{g.level ? ` ${g.level}` : ''}){' '}
        <button onClick={() => {
          const have = c.equipment.find(item => item.name === g.name)
          save({ equipment: have ? c.equipment.map(item => item === have ? { ...item, qty: item.qty + 1 } : item) : [...c.equipment, { name: g.name, qty: 1 }] })
        }}>Add</button>
      </li>)}
    </ul>
  </>
}

type EquipmentGroupName = 'Arrows' | 'Bolts' | 'Bullets' | 'Grafts' | 'Other equipment' | 'Tattoos'
type EquipmentRow = { item: Character['equipment'][number]; index: number; entry?: ContentEntry }

function EquipmentGroup({ c, save, group, rows }: Pick<SectionProps, 'c' | 'save'> & { group: EquipmentGroupName; rows: EquipmentRow[] }) {
  if (!rows.length) return null
  return <div><h4>{group}</h4><ul>
    {rows.map(({ item, index, entry }) => <li key={`${item.name}-${index}`}>
      {item.name} <ActionIcon entry={entry} /> x<input type="number" min={1} style={{ width: '4em' }} value={item.qty}
        onChange={event => save({ equipment: c.equipment.map((existing, i) => i === index ? { ...existing, qty: Math.max(1, +event.target.value || 1) } : existing) })} />{' '}
      <button onClick={() => confirmRemoval(`gear "${item.name}"`, () => save({ equipment: c.equipment.filter((_, i) => i !== index) }))}>Remove</button>
    </li>)}
  </ul></div>
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
    <small>Pioneer Human grants Trained Survival and free Terrain Expertise. If your class or background also trains Survival, choose one additional trained skill in Skills.</small>
  </div>
}

export function CharacterBuilder({ character: c, onClose }: { character: Character; onClose: () => void }) {
  const systemsKey = c.systems.join()
  const entries = useLiveQuery(
    () => db.content.filter((e) => !e.deleted && e.systems.some((s) => c.systems.includes(s))).toArray(),
    [systemsKey],
  ) ?? NONE
  const save = (patch: Partial<Character>) => {
    return db.transaction('rw', db.characters, async () => {
      const current = await db.characters.get(c.id)
      if (!current) throw new Error('Character no longer exists')
      const next = { ...current, ...patch, updatedAt: Math.max(Date.now(), current.updatedAt + 1) }
      Object.assign(next, faithfulSteedChange(next, entries))
      if (next.boosts) next.abilities = computeAbilities(next, entries)
      await db.characters.put(next)
    })
  }
  // House rules: keep the free Dedications (e.g. Ranger's Snarecrafter) in step with the rule, class and level
  const wanted = activeHomebrewDedications(c)
  const missing = wanted.filter((d) => !c.feats.some((f) => f.slot === d.slot) && entries.some((e) => e.kind === 'feat' && e.name === d.name))
  const stale = c.feats.filter((f) => homebrewDedication(f.slot ?? '') && !wanted.some((d) => d.slot === f.slot))
  const unslotted = unslottedFeats(c)
  const orphaned = [...unslotted, ...orphanedArchetypeFeats({ ...c, feats: c.feats.filter((f) => !unslotted.includes(f)) }, entries)]
  const missingSteed = faithfulSteedChange(c, entries)
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
      if (missingSteed || migration) void save({ ...missingSteed, ...migration })
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
  const savedEthnicity = c.ethnicity?.trim().toLowerCase()
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
  const klass = named('class', c.className)
  const subclasses = subclassOptions(c, entries)
  const subclassName = selectedSubclass(c, entries)
  const subclass = subclasses.find((entry) => entry.name === subclassName)
  const background = named('background', c.background)
  const equipmentGroups = useMemo(() => {
    const items = new Map<string, ContentEntry>()
    const fallback = new Map<string, ContentEntry>()
    for (const entry of entries) {
      if (entry.kind === 'item' && !items.has(entry.name)) items.set(entry.name, entry)
      else if ((entry.kind === 'weapon' || entry.kind === 'armor') && !fallback.has(entry.name)) fallback.set(entry.name, entry)
    }
    const groups: Record<EquipmentGroupName, EquipmentRow[]> = { Arrows: [], Bolts: [], Bullets: [], Grafts: [], 'Other equipment': [], Tattoos: [] }
    c.equipment.forEach((item, index) => {
      const entry = items.get(item.name) ?? fallback.get(item.name)
      const category = String(entry?.data.item_category ?? '').toLowerCase()
      const ammo = /\b(?:arrows?|bolts?|bullets?)\b/i.exec(item.name)?.[0].toLowerCase()
      const group = category === 'grafts' ? 'Grafts' : category === 'tattoos' ? 'Tattoos'
        : ammo?.startsWith('arrow') ? 'Arrows' : ammo?.startsWith('bolt') ? 'Bolts' : ammo ? 'Bullets' : 'Other equipment'
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
  const weaponCount = ownedWeapons(c, entries).length
  const classSlots = plannedSlots(c).filter(slot => slot.category === 'class')
  const classFilled = classSlots.filter(slot => c.feats.some(feat => feat.slot === slot.key)).length

  const featSection = (category: 'general' | 'skill' | 'archetype') => {
    const title = { general: 'General Feats', skill: 'Skill Feats', archetype: 'Dedications' }[category]
    const slots = plannedSlots(c).filter((slot) => slot.category === category)
    const filled = slots.filter((slot) => c.feats.some((f) => f.slot === slot.key) || c.skippedFeatSlots?.includes(slot.key)).length
    return (
      <details className="character-section">
        <summary className="character-section-summary">
          <strong>{title}</strong>
          <span>{filled}/{slots.length}</span>
        </summary>
        <div className="character-section-content">
          <SearchableFeatSlots {...section} categories={[category]} title={title} bare />
          {category === 'archetype' && slots.length === 0 && (
            <button type="button" onClick={() => save({ extraSlots: [...c.extraSlots, { category: 'archetype', level: Math.max(2, c.level), count: 1 }] })}>
              Add Dedication feat slot
            </button>
          )}
        </div>
      </details>
    )
  }

  return (
    <section className="col">
      <div className="row">
        <h2>{c.name}</h2>
        <button onClick={onClose}>Close</button>
      </div>
      {!entries.some((e) => e.kind === 'class') && <p>No class data yet. Official content is still loading.</p>}

      <div className="row">
        <label>Name <input value={c.name} onChange={(e) => save({ name: e.target.value })} /></label>
        <label>Level <input type="number" min={1} max={20} value={c.level}
          onChange={(e) => save({ level: Math.min(20, Math.max(1, +e.target.value || 1)) })} /></label>
      </div>
      <AbilitiesSection {...section} />
      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Ancestry</strong>
          <span>{ancestryLabel(c.ancestry, c.heritage) || 'Choose ancestry'}</span>
        </summary>
        <div className="character-section-content">
          <div className="row">
            <Pick label="Ancestry" kind="ancestry" value={c.ancestry} options={of('ancestry')} onChange={(v) => save({ ancestry: v, heritage: undefined, ethnicity: undefined })} />
            <Pick label="Heritage" kind="heritage" ancestry={c.ancestry} value={c.heritage} options={heritagesFor(entries, c.ancestry)} onChange={(v) => save({ heritage: v })} />
              <SearchableSelect label="Ethnicity" aria-label="Ethnicity" value={c.ethnicity ?? ''} disabled={!c.ancestry} onChange={(e) => save({ ethnicity: e.target.value || undefined })}>
                <option value="">Not specified</option>
                {c.ethnicity && !ethnicities.includes(c.ethnicity) && <option value={c.ethnicity} disabled={unavailableEthnicity}>
                  {c.ethnicity}{unavailableEthnicity ? ` (not available for ${c.ancestry ?? 'this ancestry'})` : ''}
                </option>}
                {ethnicities.map(name => <option key={name}>{name}</option>)}
              </SearchableSelect>
          </div>
          <PioneerHumanOptions {...section} />
          <small>Ethnicity options match your ancestry and come from official feat access and prerequisite rules. Access does not replace prerequisites.</small>
          {ancestry && <Info label={ancestry.name}>{detail(ancestry)}</Info>}
          {flaws.length > 0 && <small>Ancestry flaw: {flaws.map((a) => a.toUpperCase()).join(', ')}</small>}
          <AbilityBoostChoices {...section} groups={['ancestry']} />
          <SearchableFeatSlots {...section} categories={['ancestry']} title="Ancestry Feats" />
        </div>
      </details>

      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Background</strong>
          <span>{c.background || 'Choose background'}</span>
        </summary>
        <div className="character-section-content">
          <Pick label="Background" kind="background" value={c.background} options={of('background')} onChange={(v) => save({ background: v })} />
          {background && <Info label={background.name}>{detail(background)}</Info>}
          {freeHeart && <Pick label="Free Heart background" kind="background" value={freeHeart.choice}
            options={of('background').filter(entry => freeHeartOptions?.has(entry.name))}
            onChange={(choice) => save({ feats: c.feats.map(feat => feat === freeHeart ? { ...feat, choice } : feat) })} />}
          {extraBackground && <Info label={`Free Heart: ${extraBackground.name}`}>{detail(extraBackground)}</Info>}
          {freeHeart && <small>Free Heart grants the background's trained skill and skill feat, but not its attribute boosts.</small>}
          <AbilityBoostChoices {...section} groups={['background']} />
          {background?.data.skill && <small>Trained skills: <b>{String(background.data.skill)}</b></small>}
          {background?.data.feat && <small>Background grants: <b>{String(background.data.feat)}</b></small>}
          <Achievements {...section} />
        </div>
      </details>

      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Class</strong>
          <span>{classLabel(c, entries) || 'Choose class'}{classSlots.length > 0 && `, ${classFilled}/${classSlots.length}`}</span>
        </summary>
        <div className="character-section-content">
          <Pick label="Class" kind="class" value={c.className} options={of('class')} onChange={(v) => save({ className: v, subclass: '' })} />
          {c.className !== 'Druid' && subclasses.length > 0 && <>
            <Pick label={c.className === 'Ranger' ? "Hunter's Edge" : c.className === 'Champion' ? 'Cause' : c.className === 'Barbarian' ? 'Instinct' : c.className === 'Inventor' ? 'Innovation' : 'Subclass'}
              kind="subclass" value={subclassName} options={subclasses.filter((entry) => c.className !== 'Inventor'
                || !c.feats.some((feat) => ['Second Innovation', 'Third Innovation'].includes(feat.name) && feat.choice === entry.name))}
              onChange={(v) => save({ subclass: v ?? '' })} />
            {subclass && <Info label={subclass.name}>{subclass.description}</Info>}
          </>}
          {rogueRackets(c, entries).filter(racket => racket !== subclassName).map(racket => {
            const entry = subclasses.find(candidate => candidate.name === racket)
            return entry ? <Info key={racket} label={`${racket} racket (Versatile Rogue)`}>{entry.description}</Info> : null
          })}
          {classSkills(klass).choices.length > 0 && (
              <SearchableSelect label="Class skill" aria-label="Class skill" value={c.classSkill ?? ''} onChange={(e) => save({ classSkill: e.target.value || undefined })}>
                <option value="">Choose skill</option>
                {classSkills(klass).choices.map((s) => <option key={s}>{s}</option>)}
              </SearchableSelect>
          )}
          {rogueRackets(c, entries).includes('Mastermind') && <label>Mastermind skill{' '}
            <select aria-label="Mastermind racket skill" value={c.rogueRacketSkills?.Mastermind ?? ''} onChange={event => {
              const skill = event.target.value
              if (skill && !MASTERMIND_SKILLS.includes(skill)) return
              save({ rogueRacketSkills: { ...c.rogueRacketSkills, Mastermind: skill } })
            }}>
              <option value="">Choose skill</option>
              {MASTERMIND_SKILLS.map(skill => <option key={skill}>{skill}</option>)}
            </select>
          </label>}
          {c.className === 'Druid' && (
              <SearchableSelect label="Druidic Order" aria-label="Druidic Order" value={subclassName ?? ''} onChange={(e) => save({ order: e.target.value })}>
                <option value="">No order</option>
                {Object.keys(DRUID_ORDERS).filter((o) => o === c.order || !c.feats.some((f) => f.name === 'Order Explorer' && f.choice === o)).map((o) => <option key={o} value={o}>{o}</option>)}
              </SearchableSelect>
          )}
          {klass && <Info label={klass.name}>{detail(klass)}</Info>}
          <AbilityBoostChoices {...section} groups={['class']} />
          <ClassFeatures {...section} />
          <SearchableFeatSlots {...section} categories={['class']} title="Class Feats" />
        </div>
      </details>

      {featSection('archetype')}
      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Defense</strong>
          <span>Armor Class <TotalBreakdown label="Armor Class" breakdown={armorClassBreakdown(c, entries)} />, Hit Points {defense.hp}</span>
          {(equippedShield(c) || parry > 0) && <span className="defense-summary-toggles" onClick={(event) => event.stopPropagation()}>
            {equippedShield(c) && <label title={shieldParagonActive(c) ? 'Always raised by Shield Paragon' : undefined}>
              <input type="checkbox" aria-label="Raise Shield (summary)" checked={shieldRaised(c)} disabled={shieldParagonActive(c)}
                onChange={(event) => { if (!shieldParagonActive(c)) save(shieldRaisedChange(c, event.target.checked)) }} /> Raise Shield (+2 AC)</label>}
            {parry > 0 && <label><input type="checkbox" aria-label="Parry active (summary)" checked={!!c.parrying}
              onChange={(event) => save({ parrying: event.target.checked })} /> Parry (+{parry} AC)</label>}
          </span>}
        </summary>
        <div className="character-section-content">
          <SkillsSection {...section} part="defense" />
        </div>
      </details>
      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Deity</strong>
          <span>{deity ? deityLabel(deity) : c.deity || 'Optional'}</span>
        </summary>
        <div className="character-section-content">
          <Pick label="Deity" kind="deity" value={c.deity} options={of('deity')} onChange={(v) => save({ deity: v })} />
          <DeityCard deity={deity} />
        </div>
      </details>

      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Equipment</strong>
          <span>{c.equipment.length + (c.handwraps ? 1 : 0) + (c.augmentations?.length ?? 0)} items</span>
        </summary>
        <div className="character-section-content">
          <BulkLimits {...section} />
          <h4>Armor</h4>
          <ArmorList {...section} part="armor" />
          <EquipmentGroup {...section} group="Arrows" rows={equipmentGroups.Arrows} />
          <Augmentations {...section} />
          <EquipmentGroup {...section} group="Bolts" rows={equipmentGroups.Bolts} />
          <EquipmentGroup {...section} group="Bullets" rows={equipmentGroups.Bullets} />
          <Gadgets {...section} />
          <EquipmentGroup {...section} group="Grafts" rows={equipmentGroups.Grafts} />
          <h4>Handwraps</h4>
          <HandwrapsGear {...section} />
          <EquipmentGroup {...section} group="Other equipment" rows={equipmentGroups['Other equipment']} />
          <h4>Shield</h4>
          <ArmorList {...section} part="shield" />
          <SimplePoisons {...section} />
          <EquipmentGroup {...section} group="Tattoos" rows={equipmentGroups.Tattoos} />
          <h4>Weapons</h4>
          <WeaponList {...section} />
          <EquipmentSearch {...section} />
        </div>
      </details>

      <FormulasSection {...section} />
      {featSection('general')}
      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Languages</strong>
          <span>{languageSummary}</span>
        </summary>
        <div className="character-section-content">
          <LanguagesSection {...section} />
        </div>
      </details>
      <MinionsSection {...section} />
      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Offense</strong>
          <span>Perception {signed(defense.perception)}, {weaponCount} Weapon{weaponCount === 1 ? '' : 's'}</span>
        </summary>
        <div className="character-section-content">
          <SkillsSection {...section} part="offense" />
        </div>
      </details>
      {featSection('skill')}
      <details className="character-section">
        <summary className="character-section-summary"><strong>Skills</strong></summary>
        <div className="character-section-content">
          <SkillsSection {...section} />
        </div>
      </details>
      <SpellsSection {...section} />
    </section>
  )
}
