import { useState } from 'react'
import {
  propertyRunes, eligibleWeaponRunes, runeName, STRIKING_LABEL, baseItems, isMagicItem, armorCategory, isRanged, weaponDamage, maxPropertyRunes, ownedArmors, ownedWeapons, signed, weaponAttack, weaponCategory, isAutomaticUnarmed, isLockedWeapon,
  armorGauntlet, blessedArmamentRune, canBeLivingWeapon, effectiveWeapon, haftStrikerSource, haftStrikerWeapons, handwrapRuneOptions, isWoodArmor, livingWeaponEnhancements, livingWeaponRunes, type SectionProps,
} from './builder'
import { newId } from './db'
import { confirmRemoval } from './confirmRemoval'
import { Info } from './Info'
import { EntryDescription } from './EntryDescription'
import { ARMOR_GAUNTLETS, GAUNTLET, HAFT_STRIKER_WEAPON, HANDWRAPS, HARDLIGHT_GRADES, HARDLIGHT_HANDWRAPS, OVERSIZED_THROW } from './supplemental'
import type { ContentEntry, HardlightGrade, OwnedArmor, OwnedWeapon } from './types'

const POTENCY = [0, 1, 2, 3]
const WEAPON_MATERIALS = ['Orichalcum', 'Peachwood (Greater)'] as const

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

function Rune({ name, entry, onRemove, source = 'Granted by Living Weapon' }: { name: string; entry?: ContentEntry; onRemove?: () => void; source?: string }) {
  return (
    <div className="rune" title={onRemove ? undefined : source}>
      <EntryDescription name={name} entry={entry} />
      {onRemove && <button type="button" aria-label={`Remove ${name} rune`} onClick={() => confirmRemoval(`"${name}" rune`, onRemove)}>×</button>}
    </div>
  )
}

function Runes({ runes, options, entries, limit, freeRunes = [], onChange, source }: {
  runes: string[]
  options: { name: string; level?: number }[]
  entries: ContentEntry[]
  limit: number
  freeRunes?: { name: string; source: string }[]
  onChange?: (r: string[]) => void
  source?: string
}) {
  const sortedRunes = [...runes].sort((a, b) => a.localeCompare(b))
  const entryFor = (name: string) => entries.find((entry) => entry.kind === 'item'
    && /Property Runes$/.test(String(entry.data.item_subcategory))
    && runeName(entry.name) === runeName(name).split(':')[0])
  return (
    <div className="gear-runes">
      {sortedRunes.map((r) => (
        <Rune key={r} name={r} entry={entryFor(r)} source={source} onRemove={onChange ? () => onChange(runes.filter((x) => x !== r)) : undefined} />
      ))}
      {[...freeRunes].sort((a, b) => a.name.localeCompare(b.name)).map((r) => <Rune key={r.name} name={r.name} entry={entryFor(r.name)} source={r.source} />)}
      {onChange && runes.length < limit && options.some((option) => !runes.includes(option.name)) && (
        <select aria-label="Add property rune" value="" onChange={(e) => {
          if (options.some((option) => option.name === e.target.value) && !runes.includes(e.target.value)) {
            onChange([...runes, e.target.value].sort((a, b) => a.localeCompare(b)))
          }
        }}>
          <option value="">Add rune…</option>
          {options.filter((o) => !runes.includes(o.name)).map((o) => (
            <option key={o.name} value={o.name}>{o.name}{o.level !== undefined ? ` (Level ${o.level})` : ''}</option>
          ))}
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

export function HandwrapsGear({ c, entries, save }: SectionProps) {
  const handwraps = c.handwraps
  const item = handwraps?.kind === 'hardlight' ? HARDLIGHT_HANDWRAPS : HANDWRAPS
  const grades = Object.keys(HARDLIGHT_GRADES) as HardlightGrade[]
  const limit = handwraps?.kind === 'hardlight' ? HARDLIGHT_GRADES[handwraps.grade ?? 'Commercial'].upgrades : maxPropertyRunes(handwraps?.potency ?? 0)
  return (
    <div className="col gear-list">
      {handwraps ? <details className="gear-card" aria-label={item.name} open>
        <summary><strong>{item.name}</strong></summary>
        {handwraps.kind === 'hardlight' ? <label>Grade{' '}
          <select aria-label="Hardlight handwraps grade" value={handwraps.grade ?? 'Commercial'} onChange={(e) => {
            const grade = grades.find((name) => name === e.target.value)
            if (grade) {
              const { potency, striking, upgrades } = HARDLIGHT_GRADES[grade]
              save({ handwraps: { ...handwraps, grade, potency, striking, runes: handwraps.runes.slice(0, upgrades) } })
            }
          }}>
            {grades.map((grade) => <option key={grade}>{grade}</option>)}
          </select>
        </label> : <div className="row">
          <Level label="Potency" value={handwraps.potency} options={POTENCY} format={(n) => n ? `+${n}` : 'None'}
            onChange={(potency) => save({ handwraps: { ...handwraps, potency, runes: handwraps.runes.slice(0, maxPropertyRunes(potency)) } })} />
          <Level label="Striking" value={handwraps.striking} options={POTENCY} format={(n) => STRIKING_LABEL[n] || 'None'}
            onChange={(striking) => save({ handwraps: { ...handwraps, striking } })} />
        </div>}
        <Runes runes={handwraps.runes} entries={entries} options={handwrapRuneOptions(c, entries)} limit={limit}
          onChange={(runes) => save({ handwraps: { ...handwraps, runes } })} />
        <button type="button" className="spell-remove" aria-label={`Remove ${item.name}`}
          onClick={() => confirmRemoval(`"${item.name}"`, () => save({ handwraps: undefined }))}>×</button>
      </details> : <div className="row">
        <button type="button" className="gear-add" onClick={() => save({ handwraps: { potency: 0, striking: 0, runes: [] } })}>
        Add {HANDWRAPS.name}
        </button>
        {c.systems.includes('sf2e') && <button type="button" className="gear-add"
          onClick={() => save({ handwraps: { kind: 'hardlight', grade: 'Commercial', potency: 0, striking: 0, runes: [] } })}>
          Add {HARDLIGHT_HANDWRAPS.name}
        </button>}
      </div>}
    </div>
  )
}

export function WeaponList({ c, entries, save }: SectionProps) {
  const weapons = ownedWeapons(c, entries)
  const gauntlet = armorGauntlet(c, entries)
  const livingSource = weapons.find((weapon) => weapon.livingWeapon && canBeLivingWeapon(c, entries, weapon))
  const saveWeapons = (next: OwnedWeapon[]) => save({
    ...(livingSource ? { livingWeaponEnhancements: livingWeaponEnhancements(c, entries, livingSource) } : {}),
    weapons: [...next, ...(c.weapons ?? []).filter((weapon) =>
      (isAutomaticUnarmed(weapon.name) || weapon.name === HAFT_STRIKER_WEAPON.name || weapon.id === GAUNTLET.id || weapon.id === OVERSIZED_THROW.id) && !weapons.some((visible) => visible.id === weapon.id))],
  })
  const update = (id: string, patch: Partial<OwnedWeapon>) => {
    const weapon = weapons.find((weapon) => weapon.id === id)
    if (weapon?.livingWeapon && canBeLivingWeapon(c, entries, weapon)
      && (patch.potency !== undefined || patch.striking !== undefined || patch.runes !== undefined)) {
      const shared = livingWeaponEnhancements(c, entries, weapon)
      save({ livingWeaponEnhancements: {
        potency: patch.potency ?? shared.potency, striking: patch.striking ?? shared.striking, runes: patch.runes ?? shared.runes,
      } })
    } else saveWeapons(weapons.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }
  const sorted = [...weapons].sort((x, y) => x.name.localeCompare(y.name))
  const handwraps = c.handwraps
  const handwrapItem = handwraps?.kind === 'hardlight' ? HARDLIGHT_HANDWRAPS : HANDWRAPS
  return (
    <div className="col gear-list">
      <Search entries={entries.filter((entry) => !isLockedWeapon(c, entry.name, entries))} kind="weapon" label="Add Weapon"
        onPick={(e) => saveWeapons([...weapons, { id: newId(), name: e.name, potency: 0, striking: 0, runes: [] }])} />
      {sorted.map((w) => {
        const displayName = w.name.replace(/ \(Animal Feature\)$/, '')
        const a = weaponAttack(c, entries, w)
        const enhanced = effectiveWeapon(c, entries, w)
        const unarmed = weaponCategory(a.entry) === 'Unarmed'
        const inherited = !!handwraps && unarmed
        const fixed = w.id === OVERSIZED_THROW.id
        const haft = w.name === HAFT_STRIKER_WEAPON.name ? haftStrikerSource(c, entries) : undefined
        const canUseLivingWeapon = !fixed && !haft && canBeLivingWeapon(c, entries, w)
        const livingWeapon = canUseLivingWeapon && !!w.livingWeapon
        const shared = livingWeapon ? livingWeaponEnhancements(c, entries, w) : w
        const canUseVerdantWeapon = !fixed && !haft && !unarmed && c.feats.some((feat) => feat.name === 'Verdant Weapon' || feat.name === 'Verdant Weapon Jousting')
        const freeShifting = livingWeapon
        const blessed = blessedArmamentRune(c, entries, { ...enhanced, runes: unarmed ? handwraps?.runes ?? []
          : livingWeapon ? livingWeaponRunes({ ...w, ...shared }) : haft ? enhanced.runes : w.runes })
        const freeRunes = [...(freeShifting ? [{ name: 'Shifting', source: 'Granted by Living Weapon' }] : []),
          ...(blessed ? [{ name: blessed, source: 'Granted by Blessed Armament' }] : [])]
        const damageDice = /^(\d+)d/.exec(a.damage)?.[1]
        const damageRunes = enhanced.runes.filter((rune) => !['Animated', 'Fearsome', 'Fearsome (Greater)', 'Ghost Touch', 'Grievous', 'Hooked', 'Keen', 'Returning', 'Shifting', 'Crushing', 'Crushing (Greater)'].includes(runeName(rune))).sort((x, y) => x.localeCompare(y))
          .map((rune) => {
            if (/^(?:Greater )?Impactful(?: \(Greater\))?$/.test(rune)) return '1d6 force'
            if (/^Astral(?: \(Greater\))?$/.test(runeName(rune))) return `1d6${runeName(rune) === 'Astral (Greater)' ? '*' : ''} spirit`
            if (runeName(rune) === 'Holy' || runeName(rune) === 'Unholy') return '1d4* spirit'
            if (rune === 'Shockwave') return damageDice ? `${damageDice} bludgeoning splash` : 'bludgeoning splash equal to weapon damage dice'
            return rune
          })
        const damage = a.damage ? `${a.damage}${damageRunes.length > 0 ? ` + ${damageRunes.join(', ')}` : ''}` : ''
        const pristineNote = a.pristineLivingWeapon
          ? 'Pristine Living Weapon: treated as cold iron and silver. Critical hit against a creature with a weakness to cold iron or silver: 1d6 persistent bleed.'
          : undefined
        const damageNote = [...enhanced.runes.map((rune) => runeName(rune)).flatMap((rune) =>
          rune === 'Holy' ? ['Holy: 2d4 spirit instead against unholy targets.']
            : rune === 'Unholy' ? ['Unholy: 2d4 spirit instead against holy targets.']
              : rune === 'Astral (Greater)' ? ['Greater Astral: spirit damage ignores spirit resistance.'] : []),
        ...(pristineNote ? [pristineNote] : [])].join(' ') || undefined
        const compactDamage = damage.replace(/\b(bludgeoning|piercing|slashing)\b/gi, (type) => type[0].toUpperCase())
        const crushing = enhanced.runes.some((rune) => runeName(rune) === 'Crushing (Greater)') ? 2 : enhanced.runes.includes('Crushing') ? 1 : 0
        return (
          <details key={w.id} className="gear-card" aria-label={displayName} open>
            <summary><strong>{displayName}</strong> <small title={damageNote}>Attack {signed(a.attack)}{damage && `, Damage ${compactDamage}${a.pristineLivingWeapon ? '*' : ''}`}</small></summary>
            {gauntlet && w.id === GAUNTLET.id && <label>Armor gauntlet{' '}
              <select aria-label="Armor gauntlet" value={gauntlet.name} onChange={(e) => {
                const choice = ARMOR_GAUNTLETS.find((name) => name === e.target.value)
                if (choice) save({ armors: ownedArmors(c, entries).map((armor) => armor.id === gauntlet.armor.id ? { ...armor, gauntlet: choice } : armor) })
              }}>
                {[...ARMOR_GAUNTLETS].sort((a, b) => a.localeCompare(b)).map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>}
            {a.entry?.description && <Info label="Summary">{a.entry.description}</Info>}
            {a.traits.length > 0 && <div className="gear-traits">{a.traits.map((t) => <span key={t}>{t}</span>)}</div>}
            <div className="gear-stats">
              <span><small>Attack</small><b>{signed(a.attack)}</b></span>
              {a.range > 0 && <span><small>Range</small><b>{a.range} feet</b></span>}
              <span><small>{a.ability === 'dex' ? 'Dexterity' : 'Strength'}</small>{signed(a.mod)}</span>
              <span><small>Proficiency</small>{signed(a.prof)}</span>
              <span><small>Item</small>{signed(a.item)}</span>
            </div>
            {!!crushing && <small>{`Critical hit: clumsy ${crushing} and enfeebled ${crushing} until the end of your next turn.`}</small>}
            {enhanced.runes.includes('Shockwave') && <small>Shockwave splash does not harm you.</small>}
            {haft && <>
              {haftStrikerWeapons(c, entries).length > 1 && <label>Haft weapon{' '}
                <select aria-label="Haft weapon" value={haft.id} onChange={(e) => save({ haftStrikerWeaponId: e.target.value })}>
                  {haftStrikerWeapons(c, entries).map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
                </select>
              </label>}
            </>}
            {unarmed && enhanced.material && <div className="row">
              <label>Material{' '}
                <select aria-label="Weapon material" value={enhanced.material} disabled>
                  <option>{enhanced.material}</option>
                </select>
              </label>
            </div>}
            {fixed ? <small>Temporary thrown object; materials, runes, and enhancements cannot be changed.</small>
              : haft ? null
              : unarmed ? null : <div className="row">
              <label title={pristineNote}>Material{a.pristineLivingWeapon && '*'}{' '}
                <select aria-label="Weapon material" value={enhanced.material ?? ''} disabled={livingWeapon || w.id === GAUNTLET.id && !!gauntlet} onChange={(e) => {
                  const material = WEAPON_MATERIALS.find((name) => name === e.target.value)
                  update(w.id, { material, runes: w.runes.slice(0, maxPropertyRunes(enhanced.potency, material)) })
                }}>
                  <option value="">Standard</option>
                  {enhanced.material?.startsWith('Duskwood') && <option>{enhanced.material}</option>}
                  {WEAPON_MATERIALS.map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
              {canUseLivingWeapon && <label><input type="checkbox" aria-label="Living Weapon: grant Shifting rune" checked={!!w.livingWeapon}
                onChange={(e) => update(w.id, { livingWeapon: e.target.checked })} /> Living Weapon</label>}
              <Level label="Potency" value={enhanced.potency} options={POTENCY} format={(n) => (n ? `+${n}` : 'None')}
                onChange={(potency) => update(w.id, { potency, runes: shared.runes.slice(0, maxPropertyRunes(potency, enhanced.material)) })} />
              <Level label="Striking" value={enhanced.striking} options={POTENCY} format={(n) => STRIKING_LABEL[n] || 'None'}
                onChange={(striking) => update(w.id, { striking })} />
            </div>}
            {!fixed && <Runes runes={livingWeapon ? shared.runes.filter((rune) => runeName(rune) !== 'Shifting').slice(0, maxPropertyRunes(shared.potency))
              : enhanced.runes.filter((rune) => rune !== blessed && (!freeShifting || rune !== 'Shifting'))}
              entries={entries} options={unarmed || haft ? [] : eligibleWeaponRunes(entries, { ...w, runes: [...shared.runes, ...enhanced.runes] }).filter((rune) => !freeShifting || rune.name !== 'Shifting')}
              limit={maxPropertyRunes(enhanced.potency, enhanced.material)} freeRunes={freeRunes}
              source={haft ? `Inherited from ${haft.name}` : inherited ? `Inherited from ${handwrapItem.name}` : undefined}
              onChange={unarmed || haft ? undefined : (runes) => update(w.id, { runes })} />}
            <div className="row">
              {canUseVerdantWeapon && <label><input type="checkbox" aria-label={`Verdant Weapon: ${w.name}`} checked={!!w.verdantWeapon}
                onChange={(e) => saveWeapons(weapons.map((weapon) => ({ ...weapon, verdantWeapon: weapon.id === w.id && e.target.checked })))} /> Verdant Weapon</label>}
              {!isLockedWeapon(c, w.name, entries) && <button type="button" className="spell-remove" aria-label={`Remove ${w.name}`} title="Remove"
                onClick={() => confirmRemoval(`weapon "${w.name}"`, () => saveWeapons(weapons.filter((x) => x.id !== w.id)))}>×</button>}
            </div>
          </details>
        )
      })}
    </div>
  )
}

export function ArmorList({ c, entries, save }: SectionProps) {
  const armors = ownedArmors(c, entries)
  const update = (id: string, patch: Partial<OwnedArmor>) => save({ armors: armors.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  const shield = c.shield
  return (
    <div className="col gear-list">
      <Search entries={entries} kind="armor" label="Add Armor"
        onPick={(e) => save({ armors: [...armors, { id: newId(), name: e.name, potency: 0, resilient: 0, runes: [], worn: !armors.some((a) => a.worn) }] })} />
      {[...armors].sort((x, y) => x.name.localeCompare(y.name)).map((a) => {
        const entry = entries.find((e) => e.kind === 'armor' && e.name === a.name)
        return (
          <article key={a.id} className="gear-card">
            <header className="row">
              <strong>{a.name}</strong>
              <label><input type="checkbox" checked={a.worn}
                onChange={(e) => save({ armors: armors.map((x) => ({ ...x, worn: x.id === a.id ? e.target.checked : e.target.checked ? false : x.worn })) })} /> Worn</label>
            </header>
            {entry?.description && <Info label="Summary">{entry.description}</Info>}
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
              <label>Material{' '}
                <select aria-label="Armor material" value={a.material ?? ''} disabled={isWoodArmor(entries, a)} onChange={(e) => {
                  if (isWoodArmor(entries, a)) return
                  const material = e.target.value === 'Duskwood' ? 'Duskwood' : e.target.value === 'Orichalcum' ? 'Orichalcum' : undefined
                  update(a.id, { material, runes: a.runes.slice(0, maxPropertyRunes(a.potency, material)) })
                }}>
                  <option value="">Standard</option>
                  <option value="Duskwood">Duskwood</option>
                  {a.material?.startsWith('Duskwood (') && <option>{a.material}</option>}
                  <option value="Orichalcum">Orichalcum</option>
                </select>
              </label>
              <Level label="Potency" value={a.potency} options={POTENCY} format={(n) => (n ? `+${n}` : 'None')}
                onChange={(potency) => update(a.id, { potency, runes: a.runes.slice(0, maxPropertyRunes(potency, a.material)) })} />
              <Level label="Resilient" value={a.resilient} options={POTENCY} format={(n) => ['None', 'Resilient', 'Greater', 'Major'][n]}
                onChange={(resilient) => update(a.id, { resilient })} />
            </div>
            <Runes runes={a.runes} entries={entries} options={propertyRunes(entries, 'Armor')} limit={maxPropertyRunes(a.potency, a.material)} onChange={(runes) => update(a.id, { runes })} />
            <button type="button" className="spell-remove" aria-label={`Remove ${a.name}`} title="Remove"
              onClick={() => confirmRemoval(`armor "${a.name}"`, () => save({ armors: armors.filter((x) => x.id !== a.id) }))}>×</button>
          </article>
        )
      })}
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
          <button type="button" className="spell-remove" aria-label={`Remove ${shield.name}`} title="Remove"
            onClick={() => confirmRemoval(`shield "${shield.name}"`, () => save({ shield: undefined }))}>×</button>
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
    </div>
  )
}
