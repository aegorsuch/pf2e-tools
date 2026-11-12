import { Info } from './Info'
import { confirmRemoval } from './confirmRemoval'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { AbilitiesSection, AbilityBoostChoices } from './AbilitiesSection'
import { DRUID_ORDERS, classLabel, selectedSubclass, subclassOptions, classSkills, ancestryFlaws, ancestryLabel, computeAbilities, defenseSummary, heritagesFor, languageAllowance, plannedSlots, signed, activeHomebrewDedications, homebrewDedication, orphanedArchetypeFeats, unslottedFeats } from './builder'
import { ClassFeatures } from './ClassFeatures'
import { FeatSlots } from './FeatSlots'
import { BulkLimits, HandwrapsGear } from './GearSection'
import { ActionIcon } from './ActionIcon'
import { LanguagesSection } from './LanguagesSection'
import { SkillsSection } from './SkillsSection'
import { SpellsSection } from './SpellsSection'
import { MinionsSection } from './MinionsSection'
import { faithfulSteedChange } from './companions'
import { ethnicityOptions } from './featAccess'
import { db } from './db'
import type { Character, ContentEntry, EntryKind } from './types'

const GEAR: EntryKind[] = ['item', 'weapon', 'armor']
const NONE: ContentEntry[] = []

const deityLabel = (deity: ContentEntry) => typeof deity.data.epithet === 'string' && deity.data.epithet.trim()
  ? `${deity.name}, ${deity.data.epithet.trim().replace(/^The /, 'the ')}`
  : deity.name

function Pick({ label, kind, value, options, onChange }: {
  label: string
  kind: string
  value?: string
  options: ContentEntry[]
  onChange: (v: string | undefined) => void
}) {
  const labels = new Map(options.map((entry) => [entry.name, kind === 'deity' ? deityLabel(entry) : entry.name]))
  const names = [...labels.keys()].sort()
  return (
    <label>
      {label}{' '}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">No {kind}</option>
        {value && !names.includes(value) && <option>{value}</option>}
        {names.map((n) => <option key={n} value={n}>{labels.get(n)}</option>)}
      </select>
    </label>
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

export function CharacterBuilder({ character: c, onClose }: { character: Character; onClose: () => void }) {
  const [gearQuery, setGearQuery] = useState('')
  const systemsKey = c.systems.join()
  const entries = useLiveQuery(
    () => db.content.filter((e) => !e.deleted && e.systems.some((s) => c.systems.includes(s))).toArray(),
    [systemsKey],
  ) ?? NONE
  const save = (patch: Partial<Character>) => {
    const next = { ...c, ...patch, updatedAt: Date.now() }
    Object.assign(next, faithfulSteedChange(next, entries))
    // Boost-built characters keep their scores in sync with ancestry/background/class/level changes
    if (next.boosts) next.abilities = computeAbilities(next, entries)
    return db.characters.put(next)
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
      if (missingSteed) void save(missingSteed)
      return
    }
    const added = missing.map((d) => ({ d, entry: entries.find((e) => e.kind === 'feat' && e.name === d.name)! }))
    void save({
      feats: [...c.feats.filter((f) => !stale.includes(f)), ...added.map(({ d, entry }) => ({ name: d.name, type: 'Dedication Feat', level: entry.level, slot: d.slot }))],
      entryIds: [...new Set([...c.entryIds, ...added.map(({ entry }) => entry.id)])],
    })
  })
  const [featSearch, setFeatSearch] = useState<Record<string, string>>({})
  const section = { c, entries, save }
  const ethnicities = useMemo(() => ethnicityOptions(entries), [entries])
  const searchProps = { search: featSearch, onSearch: (key: string, text: string) => setFeatSearch((prev) => ({ ...prev, [key]: text })) }
  const { locked: lockedLanguages, slots: languageSlots } = languageAllowance(c, entries)
  const knownLanguages = [...new Map([...lockedLanguages, ...c.languages].map((l) => [l.toLowerCase(), l])).values()]
  const languageSummary = `${knownLanguages.length}/${lockedLanguages.length + languageSlots}: ${[...knownLanguages].sort((a, b) => a.localeCompare(b)).join(', ')}`
  const of = (kind: EntryKind) => entries.filter((e) => e.kind === kind)
  const named = (kind: EntryKind, name?: string) => (name ? of(kind).find((e) => e.name === name) : undefined)
  const deity = named('deity', c.deity)

  const gearMatches = useMemo(() => {
    const q = gearQuery.trim().toLowerCase()
    return q
      ? entries.filter((e) => GEAR.includes(e.kind) && e.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40)
      : []
  }, [entries, gearQuery])

  const ancestry = named('ancestry', c.ancestry)
  const klass = named('class', c.className)
  const subclasses = subclassOptions(c, entries)
  const subclassName = selectedSubclass(c, entries)
  const subclass = subclasses.find((entry) => entry.name === subclassName)
  const background = named('background', c.background)
  const flaws = ancestryFlaws(c, entries)
  const defense = defenseSummary(c, entries)

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
          <FeatSlots {...section} {...searchProps} categories={[category]} title={title} bare />
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
            <Pick label="Ancestry" kind="ancestry" value={c.ancestry} options={of('ancestry')} onChange={(v) => save({ ancestry: v, heritage: undefined })} />
            <Pick label="Heritage" kind="heritage" value={c.heritage} options={heritagesFor(entries, c.ancestry)} onChange={(v) => save({ heritage: v })} />
            <label>Ethnicity{' '}
              <select aria-label="Ethnicity" value={c.ethnicity ?? ''} onChange={(e) => save({ ethnicity: e.target.value || undefined })}>
                <option value="">Not specified</option>
                {c.ethnicity && !ethnicities.includes(c.ethnicity) && <option>{c.ethnicity}</option>}
                {ethnicities.map(name => <option key={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <small>Ethnicity options come from official feat access and prerequisite rules. Access does not replace prerequisites.</small>
          {ancestry && <Info label={ancestry.name}>{detail(ancestry)}</Info>}
          {flaws.length > 0 && <small>Ancestry flaw: {flaws.map((a) => a.toUpperCase()).join(', ')}</small>}
          <AbilityBoostChoices {...section} groups={['ancestry']} />
          <FeatSlots {...section} {...searchProps} categories={['ancestry']} title="Ancestry Feats" />
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
          <AbilityBoostChoices {...section} groups={['background']} />
          {background?.data.skill && <small>Trained skills: <b>{String(background.data.skill)}</b></small>}
          {background?.data.feat && <small>Background grants: <b>{String(background.data.feat)}</b></small>}
        </div>
      </details>

      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Class</strong>
          <span>{classLabel(c, entries) || 'Choose class'}</span>
        </summary>
        <div className="character-section-content">
          <Pick label="Class" kind="class" value={c.className} options={of('class')} onChange={(v) => save({ className: v, subclass: '' })} />
          {subclasses.length > 0 && <>
            <Pick label={c.className === 'Ranger' ? "Hunter's Edge" : c.className === 'Champion' ? 'Cause' : c.className === 'Barbarian' ? 'Instinct' : c.className === 'Inventor' ? 'Innovation' : 'Subclass'}
              kind="subclass" value={subclassName} options={subclasses.filter((entry) => c.className !== 'Inventor'
                || !c.feats.some((feat) => ['Second Innovation', 'Third Innovation'].includes(feat.name) && feat.choice === entry.name))}
              onChange={(v) => save({ subclass: v ?? '' })} />
            {subclass && <Info label={subclass.name}>{subclass.description}</Info>}
          </>}
          {classSkills(klass).choices.length > 0 && (
            <label>
              Class skill{' '}
              <select value={c.classSkill ?? ''} onChange={(e) => save({ classSkill: e.target.value || undefined })}>
                <option value="">Choose skill</option>
                {classSkills(klass).choices.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          )}
          {c.className === 'Druid' && (
            <label>
              Druidic Order{' '}
              <select value={subclassName ?? ''} onChange={(e) => save({ order: e.target.value })}>
                <option value="">No order</option>
                {Object.keys(DRUID_ORDERS).filter((o) => o === c.order || !c.feats.some((f) => f.name === 'Order Explorer' && f.choice === o)).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )}
          {klass && <Info label={klass.name}>{detail(klass)}</Info>}
          <AbilityBoostChoices {...section} groups={['class']} />
          <ClassFeatures {...section} />
          <FeatSlots {...section} {...searchProps} categories={['class']} title="Class Feats" />
        </div>
      </details>

      {featSection('archetype')}
      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Defense</strong>
          <span>Armor Class {defense.ac}, Hit Points {defense.hp}</span>
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
          <strong>Gear</strong>
          <span>{c.equipment.length + (c.handwraps ? 1 : 0)} items</span>
        </summary>
        <div className="character-section-content">
          <BulkLimits {...section} />
          <HandwrapsGear {...section} />
          <ul>
            {c.equipment.map((g, i) => (
              <li key={`${g.name}-${i}`}>
                {g.name} <ActionIcon entry={entries.find((entry) => GEAR.includes(entry.kind) && entry.name === g.name)} /> x<input type="number" min={1} style={{ width: '4em' }} value={g.qty}
                  onChange={(e) => save({ equipment: c.equipment.map((x, j) => (j === i ? { ...x, qty: Math.max(1, +e.target.value || 1) } : x)) })} />{' '}
                <button onClick={() => confirmRemoval(`gear "${g.name}"`, () => save({ equipment: c.equipment.filter((_, j) => j !== i) }))}>Remove</button>
              </li>
            ))}
          </ul>
          <input placeholder="Search weapons, armor and gear" value={gearQuery} onChange={(e) => setGearQuery(e.target.value)} />
          <ul>
            {gearMatches.map((g) => (
              <li key={g.id}>
                {detail(g) ? <Info label={g.name}>{detail(g)}</Info> : <b>{g.name}</b>} <ActionIcon entry={g} /> ({g.kind}{g.level ? ` ${g.level}` : ''}){' '}
                <button onClick={() => {
                  const have = c.equipment.find((x) => x.name === g.name)
                  save({ equipment: have ? c.equipment.map((x) => (x === have ? { ...x, qty: x.qty + 1 } : x)) : [...c.equipment, { name: g.name, qty: 1 }] })
                }}>Add</button>
              </li>
            ))}
          </ul>
        </div>
      </details>

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
          <span>Perception {signed(defense.perception)}</span>
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
