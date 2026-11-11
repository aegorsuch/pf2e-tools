import { useState } from 'react'
import {
  ARMOR_PROPERTY_RUNES, STRIKING_LABEL, baseItems, isMagicItem, armorCategory, isRanged, weaponDamage, WEAPON_PROPERTY_RUNES, armorClass, maxPropertyRunes, ownedArmors, ownedWeapons, signed, weaponAttack, weaponCategory,
  type SectionProps,
} from './builder'
import { newId } from './db'
import type { ContentEntry, OwnedArmor, OwnedWeapon } from './types'

const POTENCY = [0, 1, 2, 3]

type Filter = { label: string; values: (e: ContentEntry) => string[]; fixed?: string[] }

const text = (v: unknown) => (v === undefined || v === '' ? [] : [String(v)])
const CATEGORY = /^(light|medium|heavy)( armor)?$/i
const FILTERS: Record<'weapon' | 'armor' | 'shield', Filter[]> = {
  weapon: [
    { label: 'Proficiencies', values: (e) => [weaponCategory(e)], fixed: ['Advanced', 'Martial', 'Simple', 'Unarmed'] },
    { label: 'Rarities', values: (e) => text(e.data.rarity) },
    { label: 'Types', values: (e) => [isRanged(e) ? 'Ranged' : 'Melee'] },
    { label: 'Groups', values: (e) => text(e.data.weapon_group) },
    { label: 'Hands', values: (e) => text(e.data.hands) },
    { label: 'Dice', values: (e) => text(/\d+(d\d+)/.exec(String(e.data.damage ?? ''))?.[1]) },
    { label: 'Traits', values: (e) => e.traits },
  ],
  armor: [
    { label: 'Categories', values: (e) => [armorCategory(e)], fixed: ['Heavy', 'Light', 'Medium', 'Unarmored'] },
    { label: 'Rarities', values: (e) => text(e.data.rarity) },
    { label: 'Groups', values: (e) => text(e.data.armor_group) },
    { label: 'Traits', values: (e) => e.traits.filter((t) => !CATEGORY.test(t)) },
  ],
  shield: [
    { label: 'Rarities', values: (e) => text(e.data.rarity) },
    { label: 'Traits', values: (e) => e.traits },
  ],
}
const TABS = ['Standard', 'Magic', 'Custom', 'All'] as const
const inTab = (e: ContentEntry, tab: (typeof TABS)[number]) =>
  tab === 'All' || (tab === 'Custom' ? e.source === 'homebrew' : tab === 'Magic' ? isMagicItem(e) : e.source !== 'homebrew' && !isMagicItem(e))

export function Search({ entries, kind, label, onPick }: {
  entries: ContentEntry[]
  kind: 'weapon' | 'armor' | 'shield'
  label: string
  onPick: (e: ContentEntry) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<(typeof TABS)[number]>('Standard')
  const [picked, setPicked] = useState<Record<string, string>>({})
  const pool = baseItems(entries.filter((e) => e.kind === kind))
  const filters = FILTERS[kind].map((f) => ({ ...f, options: f.fixed ?? [...new Set(pool.filter((e) => inTab(e, tab)).flatMap(f.values))].sort((a, b) => a.localeCompare(b)) }))
  const query = q.trim().toLowerCase()
  const matches = [...new Map(
    pool
      .filter((e) => inTab(e, tab) && (!query || e.name.toLowerCase().includes(query)))
      .filter((e) => filters.every((f) => !picked[f.label] || f.values(e).includes(picked[f.label])))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => [m.name, m]),
  ).values()]
  const close = () => { setOpen(false); setQ(''); setPicked({}) }
  if (!open) return <button type="button" className="gear-add" onClick={() => setOpen(true)}>{label}</button>
  return (
    <div className="col gear-picker">
      <div className="gear-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="gear-filters">
        {filters.filter((f) => f.options.length > 0).map((f) => (
          <select key={f.label} aria-label={f.label} value={picked[f.label] ?? ''}
            onChange={(e) => setPicked({ ...picked, [f.label]: e.target.value })}>
            <option value="">All {f.label}</option>
            {f.options.map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}
      </div>
      <div className="row">
        <input autoFocus placeholder={`Search ${kind}s`} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={close}>Cancel</button>
      </div>
      <ul className="gear-results">
        {matches.map((m) => (
          <li key={m.id}>
            <span><b>{m.name}</b>{weaponDamage(m) ? ` (${weaponDamage(m)})` : ''}{m.level ? ` (level ${m.level})` : ''}</span>
            <button type="button" onClick={() => { onPick(m); close() }}>Add</button>
          </li>
        ))}
        {matches.length === 0 && <li><small>No {kind}s match.</small></li>}
      </ul>
    </div>
  )
}

function Runes({ runes, options, limit, onChange }: {
  runes: string[]
  options: string[]
  limit: number
  onChange: (r: string[]) => void
}) {
  return (
    <div className="gear-runes">
      {runes.map((r) => (
        <button key={r} type="button" className="rune" title="Remove rune" onClick={() => onChange(runes.filter((x) => x !== r))}>{r} ×</button>
      ))}
      {runes.length < limit && (
        <select aria-label="Add property rune" value="" onChange={(e) => e.target.value && onChange([...runes, e.target.value])}>
          <option value="">Add rune…</option>
          {options.filter((o) => !runes.includes(o)).map((o) => <option key={o}>{o}</option>)}
        </select>
      )}
    </div>
  )
}

function Level({ label, value, options, format, onChange }: {
  label: string
  value: number
  options: number[]
  format: (n: number) => string
  onChange: (n: number) => void
}) {
  return (
    <label>{label}{' '}
      <select value={value} onChange={(e) => onChange(+e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{format(o)}</option>)}
      </select>
    </label>
  )
}

export function WeaponList({ c, entries, save }: SectionProps) {
  const weapons = ownedWeapons(c, entries)
  const update = (id: string, patch: Partial<OwnedWeapon>) => save({ weapons: weapons.map((w) => (w.id === id ? { ...w, ...patch } : w)) })
  const move = (i: number, d: number) => {
    const next = [...weapons]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    save({ weapons: next })
  }
  return (
    <div className="col gear-list">
      <Search entries={entries} kind="weapon" label="Add Weapon"
        onPick={(e) => save({ weapons: [...weapons, { id: newId(), name: e.name, potency: 0, striking: 0, runes: [] }] })} />
      {weapons.map((w, i) => {
        const a = weaponAttack(c, entries, w)
        return (
          <article key={w.id} className="gear-card">
            <header className="row">
              <strong>{[w.potency ? `+${w.potency}` : '', STRIKING_LABEL[w.striking], w.name].filter(Boolean).join(' ')}</strong>
              <span className="character-actions">
                <button type="button" aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
                <button type="button" aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
              </span>
            </header>
            {a.traits.length > 0 && <div className="gear-traits">{a.traits.map((t) => <span key={t}>{t}</span>)}</div>}
            <div className="gear-stats">
              <span><small>Attack</small><b>{signed(a.attack)}</b></span>
              {a.range > 0 && <span><small>Range</small><b>{a.range} feet</b></span>}
              <span><small>{a.ability === 'dex' ? 'Dexterity' : 'Strength'}</small>{signed(a.mod)}</span>
              <span><small>Proficiency</small>{signed(a.prof)}</span>
              <span><small>Item</small>{signed(a.item)}</span>
            </div>
            {a.damage && <div className="gear-damage">{a.damage}{w.runes.length > 0 && ` + ${w.runes.join(', ')}`}</div>}
            <div className="row">
              <Level label="Potency" value={w.potency} options={POTENCY} format={(n) => (n ? `+${n}` : 'None')}
                onChange={(potency) => update(w.id, { potency, runes: w.runes.slice(0, maxPropertyRunes(potency)) })} />
              <Level label="Striking" value={w.striking} options={POTENCY} format={(n) => STRIKING_LABEL[n] || 'None'}
                onChange={(striking) => update(w.id, { striking })} />
            </div>
            <Runes runes={w.runes} options={WEAPON_PROPERTY_RUNES} limit={maxPropertyRunes(w.potency)} onChange={(runes) => update(w.id, { runes })} />
            <div className="row">
              <button type="button" aria-pressed={!!w.stowed} onClick={() => update(w.id, { stowed: !w.stowed })}>{w.stowed ? 'Draw' : 'Stow'}</button>
              <button type="button" onClick={() => save({ weapons: weapons.filter((x) => x.id !== w.id) })}>Remove</button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function ArmorList({ c, entries, save }: SectionProps) {
  const armors = ownedArmors(c, entries)
  const update = (id: string, patch: Partial<OwnedArmor>) => save({ armors: armors.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  const shield = c.shield
  const worn = armors.find((a) => a.worn)
  return (
    <div className="col gear-list">
      <Search entries={entries} kind="armor" label="Add Armor"
        onPick={(e) => save({ armors: [...armors, { id: newId(), name: e.name, potency: 0, resilient: 0, runes: [], worn: !armors.some((a) => a.worn) }] })} />
      {armors.map((a) => {
        const entry = entries.find((e) => e.kind === 'armor' && e.name === a.name)
        return (
          <article key={a.id} className="gear-card">
            <header className="row">
              <strong>{[a.potency ? `+${a.potency}` : '', a.resilient ? ['', 'Resilient', 'Greater Resilient', 'Major Resilient'][a.resilient] : '', a.name].filter(Boolean).join(' ')}</strong>
              <label><input type="checkbox" checked={a.worn}
                onChange={(e) => save({ armors: armors.map((x) => ({ ...x, worn: x.id === a.id ? e.target.checked : e.target.checked ? false : x.worn })) })} /> Worn</label>
            </header>
            {entry && entry.traits.length > 0 && <div className="gear-traits">{entry.traits.map((t) => <span key={t}>{t}</span>)}</div>}
            {entry && (
              <div className="gear-stats">
                <span><small>Armor Class</small><b>{String(entry.data.ac ?? '—')}</b></span>
                <span><small>Dexterity cap</small>{String(entry.data.dex_cap ?? '—')}</span>
                <span><small>Check</small>{String(entry.data.check_penalty ?? '—')}</span>
                <span><small>Strength</small>{String(entry.data.strength ?? '—')}</span>
              </div>
            )}
            <div className="row">
              <Level label="Potency" value={a.potency} options={POTENCY} format={(n) => (n ? `+${n}` : 'None')}
                onChange={(potency) => update(a.id, { potency, runes: a.runes.slice(0, maxPropertyRunes(potency)) })} />
              <Level label="Resilient" value={a.resilient} options={POTENCY} format={(n) => ['None', 'Resilient', 'Greater', 'Major'][n]}
                onChange={(resilient) => update(a.id, { resilient })} />
            </div>
            <Runes runes={a.runes} options={ARMOR_PROPERTY_RUNES} limit={maxPropertyRunes(a.potency)} onChange={(runes) => update(a.id, { runes })} />
            <button type="button" onClick={() => save({ armors: armors.filter((x) => x.id !== a.id) })}>Remove</button>
          </article>
        )
      })}
      {!worn && <small>No armor worn: unarmored.</small>}

      {shield ? (
        <article className="gear-card">
          <header className="row">
            <strong>{shield.name}</strong>
            <label><input type="checkbox" checked={shield.raised} onChange={(e) => save({ shield: { ...shield, raised: e.target.checked } })} /> Raised (+2 AC)</label>
          </header>
          <div className="row">
            <label>Hardness <input type="number" min={0} value={shield.hardness} onChange={(e) => save({ shield: { ...shield, hardness: Math.max(0, +e.target.value || 0) } })} /></label>
            <label>Hit Points <input type="number" min={0} value={shield.hp} onChange={(e) => save({ shield: { ...shield, hp: Math.max(0, +e.target.value || 0) } })} /></label>
            <label>Damage <input type="number" min={0} value={shield.damage} onChange={(e) => save({ shield: { ...shield, damage: Math.max(0, +e.target.value || 0) } })} /></label>
          </div>
          <button type="button" onClick={() => save({ shield: undefined })}>Remove</button>
        </article>
      ) : (
        <Search entries={entries} kind="shield" label="Add Shield"
          onPick={(e) => save({
            shield: {
              id: newId(), name: e.name, raised: false, damage: 0,
              hardness: parseFloat(String(e.data.hardness)) || 0, hp: parseFloat(String(e.data.hp)) || 0,
            },
          })} />
      )}
      {!shield && (
        <button type="button" className="gear-add" onClick={() => save({ shield: { id: newId(), name: 'Shield', hardness: 3, hp: 24, damage: 0, raised: false } })}>Add Custom Shield</button>
      )}
      <small>Armor Class <b>{armorClass(c, entries)}</b></small>
    </div>
  )
}
