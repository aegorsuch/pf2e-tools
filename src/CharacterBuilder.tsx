import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { AbilitiesSection, AbilityBoostChoices } from './AbilitiesSection'
import { ancestryFlaws, ancestryLabel, computeAbilities, featType, heritagesFor, maxHp } from './builder'
import { ClassFeatures } from './ClassFeatures'
import { FeatSlots } from './FeatSlots'
import { FeatChoice } from './FeatChoice'
import { canSelectWardenFeat } from './featChoices'
import { SkillsSection } from './SkillsSection'
import { SpellsSection } from './SpellsSection'
import { db } from './db'
import type { Character, ContentEntry, EntryKind } from './types'

const GEAR: EntryKind[] = ['item', 'weapon', 'armor']
const NONE: ContentEntry[] = []

function Pick({ label, kind, value, options, onChange }: {
  label: string
  kind: string
  value?: string
  options: ContentEntry[]
  onChange: (v: string | undefined) => void
}) {
  const names = [...new Set(options.map((o) => o.name))].sort()
  return (
    <label>
      {label}{' '}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">No {kind}</option>
        {value && !names.includes(value) && <option>{value}</option>}
        {names.map((n) => <option key={n}>{n}</option>)}
      </select>
    </label>
  )
}

const detail = (e?: ContentEntry) =>
  e ? Object.entries(e.data).filter(([k]) => k !== 'url' && k !== 'sourceBook').map(([k, v]) => `${k}: ${v}`).join(' | ') : ''

export function CharacterBuilder({ character: c, onClose }: { character: Character; onClose: () => void }) {
  const [featQuery, setFeatQuery] = useState('')
  const [gearQuery, setGearQuery] = useState('')
  const [maxLevelOnly, setMaxLevelOnly] = useState(true)
  const systemsKey = c.systems.join()
  const entries = useLiveQuery(
    () => db.content.filter((e) => !e.deleted && e.systems.some((s) => c.systems.includes(s))).toArray(),
    [systemsKey],
  ) ?? NONE
  const save = (patch: Partial<Character>) => {
    const next = { ...c, ...patch, updatedAt: Date.now() }
    // Boost-built characters keep their scores in sync with ancestry/background/class/level changes
    if (next.boosts) next.abilities = computeAbilities(next, entries)
    return db.characters.put(next)
  }
  const section = { c, entries, save }
  const of = (kind: EntryKind) => entries.filter((e) => e.kind === kind)
  const named = (kind: EntryKind, name?: string) => (name ? of(kind).find((e) => e.name === name) : undefined)

  const featMatches = useMemo(() => {
    const q = featQuery.trim().toLowerCase()
    return entries
      .filter((e) => e.kind === 'feat' && (!maxLevelOnly || e.level <= c.level))
      .filter((e) => e.data.repeatable !== true || canSelectWardenFeat(e.name, c, entries))
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.traits.some((t) => t.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40)
  }, [entries, featQuery, maxLevelOnly, c])

  const gearMatches = useMemo(() => {
    const q = gearQuery.trim().toLowerCase()
    return q
      ? entries.filter((e) => GEAR.includes(e.kind) && e.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40)
      : []
  }, [entries, gearQuery])

  const ancestry = named('ancestry', c.ancestry)
  const klass = named('class', c.className)
  const background = named('background', c.background)
  const flaws = ancestryFlaws(c, entries)

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
        <b>HP {maxHp(c, entries)}</b>
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
          </div>
          {ancestry && <small><b>{ancestry.name}</b>: {detail(ancestry)}</small>}
          {flaws.length > 0 && <small>Ancestry flaw: {flaws.map((a) => a.toUpperCase()).join(', ')}</small>}
          <AbilityBoostChoices {...section} groups={['ancestry']} />
          <FeatSlots {...section} categories={['ancestry']} title="Ancestry Feats" />
        </div>
      </details>

      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Background</strong>
          <span>{c.background || 'Choose background'}</span>
        </summary>
        <div className="character-section-content">
          <Pick label="Background" kind="background" value={c.background} options={of('background')} onChange={(v) => save({ background: v })} />
          {background && <small><b>{background.name}</b>: {detail(background)}</small>}
          <AbilityBoostChoices {...section} groups={['background']} />
          {background?.data.skill && <small>Trained skills: <b>{String(background.data.skill)}</b></small>}
          {background?.data.feat && <small>Background grants: <b>{String(background.data.feat)}</b></small>}
        </div>
      </details>

      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Class</strong>
          <span>{c.className || 'Choose class'}</span>
        </summary>
        <div className="character-section-content">
          <Pick label="Class" kind="class" value={c.className} options={of('class')} onChange={(v) => save({ className: v })} />
          {klass && <small><b>{klass.name}</b>: {detail(klass)}</small>}
          <AbilityBoostChoices {...section} groups={['class']} />
          <ClassFeatures {...section} />
          <FeatSlots {...section} categories={['class']} title="Class Feats" />
        </div>
      </details>

      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Deity</strong>
          <span>{c.deity || 'Optional'}</span>
        </summary>
        <div className="character-section-content">
          <Pick label="Deity" kind="deity" value={c.deity} options={of('deity')} onChange={(v) => save({ deity: v })} />
        </div>
      </details>

      <details className="character-section">
        <summary className="character-section-summary">
          <strong>Equipment</strong>
          <span>{c.equipment.length} items</span>
        </summary>
        <div className="character-section-content">
          <ul>
            {c.equipment.map((g, i) => (
              <li key={`${g.name}-${i}`}>
                {g.name} x<input type="number" min={1} style={{ width: '4em' }} value={g.qty}
                  onChange={(e) => save({ equipment: c.equipment.map((x, j) => (j === i ? { ...x, qty: Math.max(1, +e.target.value || 1) } : x)) })} />{' '}
                <button onClick={() => save({ equipment: c.equipment.filter((_, j) => j !== i) })}>Remove</button>
              </li>
            ))}
          </ul>
          <input placeholder="Search weapons, armor and gear" value={gearQuery} onChange={(e) => setGearQuery(e.target.value)} />
          <ul>
            {gearMatches.map((g) => (
              <li key={g.id}>
                <b>{g.name}</b> ({g.kind}{g.level ? ` ${g.level}` : ''}) {detail(g)}{' '}
                <button onClick={() => {
                  const have = c.equipment.find((x) => x.name === g.name)
                  save({ equipment: have ? c.equipment.map((x) => (x === have ? { ...x, qty: x.qty + 1 } : x)) : [...c.equipment, { name: g.name, qty: 1 }] })
                }}>Add</button>
              </li>
            ))}
          </ul>
        </div>
      </details>

      <SkillsSection {...section} />
      <FeatSlots {...section} categories={['skill', 'general', 'archetype', 'bonus']} title="Other Feat Slots" />
      <SpellsSection {...section} />

      <h3>All feats ({c.feats.length})</h3>
      <ul className="feat-slot-list">
        {c.feats.map((feat, index) => ({ feat, index })).sort((a, b) => a.feat.name.localeCompare(b.feat.name)).map(({ feat: f, index: i }) => (
          <li className="feat-slot-row" key={`${f.name}-${i}`}>
            {f.name} <small>({f.type}, L{f.level}{f.choice ? `, ${f.choice}` : ''})</small>{' '}
            <button onClick={() => {
              const feats = c.feats.filter((_, j) => j !== i)
              const ids = new Set(entries.filter((e) => e.kind === 'feat' && e.name === f.name).map((e) => e.id))
              save({ feats, entryIds: feats.some((feat) => feat.name === f.name) ? c.entryIds : c.entryIds.filter((id) => !ids.has(id)) })
            }}>Remove</button>
            {!f.slot && <FeatChoice {...section} index={i} />}
          </li>
        ))}
      </ul>
      <div className="row">
        <input placeholder="Search feats by name or trait (e.g. General, Elf)" value={featQuery} onChange={(e) => setFeatQuery(e.target.value)} />
        <label><input type="checkbox" checked={maxLevelOnly} onChange={(e) => setMaxLevelOnly(e.target.checked)} /> Up to my level</label>
      </div>
      <ul>
        {featMatches.map((f) => (
          <li key={f.id}>
            <b>{f.name}</b> (L{f.level}) {f.traits.join(', ')}{f.data.prerequisite ? ` - Prereq: ${f.data.prerequisite}` : ''}{' '}
            <button disabled={c.feats.some((feat) => feat.name === f.name) && f.data.repeatable !== true} onClick={() => save({
              feats: [...c.feats, { name: f.name, type: featType(f, c), level: f.level }],
              entryIds: c.entryIds.includes(f.id) ? c.entryIds : [...c.entryIds, f.id],
            })}>Add</button>
            <br /><small>{f.description}</small>
          </li>
        ))}
      </ul>

      <h3>Languages</h3>
      <input key={c.id} defaultValue={c.languages.join(', ')}
        onBlur={(e) => save({ languages: e.target.value.split(',').map((l) => l.trim()).filter(Boolean) })} />
    </section>
  )
}
