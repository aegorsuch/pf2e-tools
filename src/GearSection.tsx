import { Fragment, useState } from 'react'
import {
  propertyRunes, eligibleWeaponRunes, runeName, STRIKING_LABEL, gearPickerEntries, isMagicItem, armorCategory, isRanged, weaponDamage, maxPropertyRunes, ownedArmors, ownedWeapons, signed, weaponAttack, weaponCategory, isAutomaticUnarmed, isLockedWeapon,
  animalStrengthSource, animalStrengthRuneSources, hasAnimalStrength, armorDisplayName, armorEntry, armorGauntlet, automaticHardlightGrade, automaticWeaponFundamentals, blessedArmamentRune, bulkLimits, canBeLivingWeapon, canBeVerdantWeapon, deityWeapon, effectiveHandwraps, effectiveWeapon, hasAutomaticWeaponFundamentals, hasDeityWeaponGrant, haftStrikerSource, haftStrikerWeapons, handwrapRuneOptions, isWoodArmor, livingWeaponEnhancements, livingWeaponRunes, type SectionProps,
} from './builder'
import { newId } from './db'
import { confirmRemoval } from './confirmRemoval'
import { Info, SourceNote } from './Info'
import { EntryDescription } from './EntryDescription'
import { GearTraits } from './GearTraits'
import { gearAccess } from './gearAccess'
import { SearchableSelect } from './SearchableSelect'
import { automaticArmorFundamentals, canWearWithAttachedArmor, INVENTOR_ARMOR_ID, INVENTOR_SUITS, isGrantedArmor } from './grantedArmor'
import { ARMOR_GAUNTLETS, GAUNTLET, HAFT_STRIKER_WEAPON, HANDWRAPS, HARDLIGHT_GRADES, HARDLIGHT_HANDWRAPS, OVERSIZED_THROW } from './supplemental'
import type { ContentEntry, HardlightGrade, OwnedArmor, OwnedWeapon } from './types'

const POTENCY = [0, 1, 2, 3]
const WEAPON_MATERIALS = ['Orichalcum', 'Peachwood'] as const
const ARMOR_MATERIALS = ['Duskwood', 'Grisantian Hide', 'Orichalcum'] as const

export function BulkLimits({ c, entries }: Pick<SectionProps, 'c' | 'entries'>) {
  const limits = bulkLimits(c, entries)
  return <div aria-label="Bulk limits">
    <p>Encumbered above <b>{limits.encumbered}</b> Bulk; maximum <b>{limits.maximum}</b> Bulk.</p>
    <small>Strength {signed(limits.strength)}; size {limits.size}
      {limits.sizeMultiplier !== 1 ? ` (limits ×${limits.sizeMultiplier})` : ''}
      {limits.bonuses.map(bonus => `; ${bonus.source} ${bonus.encumbered === bonus.maximum
        ? signed(bonus.encumbered) : `(encumbered ${signed(bonus.encumbered)}, maximum ${signed(bonus.maximum)})`}`).join('')}.
      {' '}Worn-item bonuses and temporary size changes are not tracked.</small>
  </div>
}

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

function GearAccess({ c, entries, entry, save }: SectionProps & { entry: ContentEntry }) {
  const access = gearAccess(c, entries, entry)
  if (!access) return null
  return <div className="col gear-access">
    <small>Access: {access.requirement}{access.automatic
      ? ` (met${access.sources.length ? `: ${access.sources.join(', ')}` : ''})` : access.approved ? ' (GM approved)' : ' (not met)'}</small>
    {!access.automatic && <label><input type="checkbox" aria-label={`GM approved access to ${entry.name}`} checked={access.approved}
      onChange={event => save({ gearAccessOverrides: event.target.checked
        ? [...new Set([...(c.gearAccessOverrides ?? []), entry.id])]
        : c.gearAccessOverrides?.filter(id => id !== entry.id) })} /> GM approved access</label>}
  </div>
}

export function Search({ c, entries, save, kind, label, onPick }: SectionProps & {
  entries: ContentEntry[]
  kind: 'weapon' | 'armor' | 'shield'
  label: string
  onPick: (e: ContentEntry) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<(typeof TABS)[number]>('Standard')
  const [picked, setPicked] = useState<Record<string, string>>({})
  if (!open) return <button type="button" className="gear-add" onClick={() => setOpen(true)}>{label}</button>
  const pool = gearPickerEntries(entries, kind)
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
  return (
    <div className="col gear-picker">
      <div className="gear-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="gear-filters">
        {filters.filter((f) => f.options.length > 0).map((f) => (
          <SearchableSelect key={f.label} aria-label={f.label} value={picked[f.label] ?? ''}
            onChange={(e) => setPicked({ ...picked, [f.label]: e.target.value })}>
            <option value="">All {f.label}</option>
            {f.options.map((o) => <option key={o}>{o}</option>)}
          </SearchableSelect>
        ))}
      </div>
      <div className="row">
        <input type="search" aria-label={`Search ${kind}s`} autoFocus placeholder={`Search ${kind}s`} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={close}>Cancel</button>
      </div>
      <ul className="gear-results">
        {matches.map((m) => {
          const access = gearAccess(c, entries, m)
          const blocked = !!access && !access.automatic && !access.approved
          return (
          <li key={m.id}>
            <span><b>{m.name}</b>{weaponDamage(m) ? ` (${weaponDamage(m)})` : ''}{m.level ? ` (level ${m.level})` : ''}
              {' '}<small>{m.systems.map(system => system === 'sf2e' ? 'SF2E' : 'PF2E').join(' / ')}</small>
            </span>
            <GearAccess c={c} entries={entries} entry={m} save={save} />
            <button type="button" disabled={blocked} title={blocked ? 'Meet Access or obtain GM approval before adding.' : undefined}
              onClick={() => { if (!blocked) { onPick(m); close() } }}>Add</button>
          </li>
          )
        })}
        {matches.length === 0 && <li><small>No {kind}s match.</small></li>}
      </ul>
    </div>
  )
}

function GearTag({ name, entry, onRemove, source = 'Granted by Living Weapon', kind = 'rune' }: {
  name: string; entry?: ContentEntry; onRemove?: () => void; source?: string; kind?: 'rune' | 'material'
}) {
  return (
    <div className="rune" title={onRemove ? undefined : source}>
      <EntryDescription name={name} entry={entry} />
      {onRemove && <button type="button" aria-label={`Remove ${name} ${kind}`} onClick={() => confirmRemoval(`"${name}" ${kind}`, onRemove)}>×</button>}
    </div>
  )
}

function Material({ name, entries, equipment, onRemove, source }: {
  name: string; entries: ContentEntry[]; equipment: 'Weapon' | 'Armor'; onRemove?: () => void; source?: string
}) {
  const base = name.replace(/\s*\([^)]+\)$/, '').replace('Grisantian Hide', 'Grisantian Pelt')
  const grade = /\([^)]+\)$/.exec(name)?.[0]
  const items = entries.filter((entry) => entry.kind === 'item' && !entry.deleted)
  const entry = (grade ? items.find((entry) => entry.name === `${base} ${equipment} ${grade}`) : undefined)
    ?? items.find((entry) => entry.name === `${base} ${equipment}`)
    ?? items.find((entry) => entry.name === base && entry.data.item_category === 'Materials')
  return <GearTag name={name} entry={entry} onRemove={onRemove} source={source} kind="material" />
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
        <GearTag key={r} name={r} entry={entryFor(r)} source={source} onRemove={onChange ? () => onChange(runes.filter((x) => x !== r)) : undefined} />
      ))}
      {[...freeRunes].sort((a, b) => a.name.localeCompare(b.name)).map((r) => <GearTag key={r.name} name={r.name} entry={entryFor(r.name)} source={r.source} />)}
      {onChange && runes.length < limit && options.some((option) => !runes.includes(option.name)) && (
        <SearchableSelect aria-label="Add property rune" value="" onChange={(e) => {
          if (options.some((option) => option.name === e.target.value) && !runes.includes(e.target.value)) {
            onChange([...runes, e.target.value].sort((a, b) => a.localeCompare(b)))
          }
        }}>
          <option value="">Add rune…</option>
          {options.filter((o) => !runes.includes(o.name)).map((o) => (
            <option key={o.name} value={o.name}>{o.name}{o.level !== undefined ? ` (Level ${o.level})` : ''}</option>
          ))}
        </SearchableSelect>
      )}
    </div>
  )
}

function Level({ label, value, options, format, onChange, disabled, minimum = 0 }: {
  label: string
  value: number
  options: number[]
  format: (n: number) => string
  onChange: (n: number) => void
  disabled?: boolean
  minimum?: number
}) {
  if (disabled || !options.some(option => option >= minimum && option !== value)) {
    return <span>{label} <b>{format(value)}</b></span>
  }
  return (
    <label>{label}{' '}
      <select value={value} disabled={disabled} onChange={(e) => {
        const next = +e.target.value
        if (!disabled && options.includes(next) && next >= minimum) onChange(next)
      }}>
        {options.map((o) => <option key={o} value={o} disabled={o < minimum}>{format(o)}</option>)}
      </select>
    </label>
  )
}

export function HandwrapsGear({ c, entries, save }: SectionProps) {
  const handwraps = effectiveHandwraps(c)
  const automatic = automaticWeaponFundamentals(c.level)
  const minimumGrade = automaticHardlightGrade(c.level)
  const item = handwraps?.kind === 'hardlight' ? HARDLIGHT_HANDWRAPS : HANDWRAPS
  const grades = Object.keys(HARDLIGHT_GRADES) as HardlightGrade[]
  const limit = handwraps?.kind === 'hardlight' ? HARDLIGHT_GRADES[handwraps.grade ?? 'Commercial'].upgrades : maxPropertyRunes(handwraps?.potency ?? 0)
  return (
    <div className="col gear-list">
      {handwraps ? <details className="gear-card" aria-label={item.name} open>
        <summary><strong>{item.name}</strong></summary>
        <small>{handwraps.kind === 'hardlight' ? 'Grade' : 'Fundamental runes'} automatically upgrade with character level.</small>
        {handwraps.kind === 'hardlight' ? <label>Grade{' '}
          <select aria-label="Hardlight handwraps grade" value={handwraps.grade ?? 'Commercial'} onChange={(e) => {
            const grade = grades.find((name) => name === e.target.value)
            if (grade && grades.indexOf(grade) >= grades.indexOf(minimumGrade)) {
              const { potency, striking, upgrades } = HARDLIGHT_GRADES[grade]
              save({ handwraps: { ...handwraps, grade, potency, striking, runes: handwraps.runes.slice(0, upgrades) } })
            }
          }}>
            {grades.map((grade) => <option key={grade} disabled={grades.indexOf(grade) < grades.indexOf(minimumGrade)}>{grade}</option>)}
          </select>
        </label> : <div className="row">
          <Level label="Potency" value={handwraps.potency} options={POTENCY} minimum={automatic.potency} format={(n) => n ? `+${n}` : 'None'}
            onChange={(potency) => save({ handwraps: { ...handwraps, potency, runes: handwraps.runes.slice(0, maxPropertyRunes(potency)) } })} />
          <Level label="Striking" value={handwraps.striking} options={POTENCY} minimum={automatic.striking} format={(n) => STRIKING_LABEL[n] || 'None'}
            onChange={(striking) => save({ handwraps: { ...handwraps, striking } })} />
        </div>}
        <Runes runes={handwraps.runes} entries={entries} options={handwrapRuneOptions(c, entries)} limit={limit}
          onChange={(runes) => save({ handwraps: { ...handwraps, runes } })} />
        <button type="button" className="spell-remove" aria-label={`Remove ${item.name}`}
          onClick={() => confirmRemoval(`"${item.name}"`, () => save({ handwraps: undefined }))}>×</button>
      </details> : <div className="row">
        <button type="button" className="gear-add" onClick={() => save({ handwraps: { ...automatic, runes: [] } })}>
        Add {HANDWRAPS.name}
        </button>
        {c.systems.includes('sf2e') && <button type="button" className="gear-add"
          onClick={() => save({ handwraps: { kind: 'hardlight', grade: minimumGrade, ...automatic, runes: [] } })}>
          Add {HARDLIGHT_HANDWRAPS.name}
        </button>}
      </div>}
    </div>
  )
}

export function WeaponList({ c, entries, save }: SectionProps) {
  const weapons = ownedWeapons(c, entries)
  const gauntlet = armorGauntlet(c, entries)
  const favored = deityWeapon(c, entries)
  const livingSource = weapons.find((weapon) => weapon.livingWeapon && canBeLivingWeapon(c, entries, weapon))
  const saveWeapons = (next: OwnedWeapon[]) => save({
    ...(livingSource ? { livingWeaponEnhancements: livingWeaponEnhancements(c, entries, livingSource) } : {}),
    weapons: [...next, ...(c.weapons ?? []).filter((weapon) =>
      (isAutomaticUnarmed(weapon.name) || weapon.name === HAFT_STRIKER_WEAPON.name || weapon.id === GAUNTLET.id || weapon.id === OVERSIZED_THROW.id || weapon.id.startsWith('deity-weapon:')) && !weapons.some((visible) => visible.id === weapon.id))],
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
      {hasDeityWeaponGrant(c) && !favored && <small role="status">Favored weapon unavailable. Sync official content and check your deity's favored weapon.</small>}
      <Search c={c} save={save} entries={entries.filter((entry) => entry.kind !== 'weapon' || !isLockedWeapon(c, entry.name, entries))} kind="weapon" label="Add Weapon"
        onPick={(e) => saveWeapons([...weapons, { id: newId(), name: e.name, potency: 0, striking: 0, runes: [] }])} />
      {sorted.map((w) => {
        const displayName = w.name.replace(/ \(Animal Feature\)$/, '')
        const a = weaponAttack(c, entries, w)
        const enhanced = effectiveWeapon(c, entries, w)
        const unarmed = weaponCategory(a.entry) === 'Unarmed'
        const strength = hasAnimalStrength(c, entries, w)
        const strengthSources = strength ? animalStrengthRuneSources(c, entries, w) : []
        const strengthOptions = [{ id: '', name: handwraps ? handwrapItem.name : 'No runes' },
          ...strengthSources.map(source => source.weapon)].sort((a, b) => a.name.localeCompare(b.name))
        const strengthSource = animalStrengthSource(c, entries, w)
        const strengthSelection = strengthSource && strengthSources.find(source => source.ids.includes(strengthSource.id))?.weapon.id
        const inherited = !!handwraps && unarmed && !strengthSource
        const fixed = w.id === OVERSIZED_THROW.id
        const haft = w.name === HAFT_STRIKER_WEAPON.name ? haftStrikerSource(c, entries) : undefined
        const inheritedLivingWeapon = !!haft && !!enhanced.livingWeapon
        const canUseLivingWeapon = !fixed && !haft && canBeLivingWeapon(c, entries, w)
        const livingWeapon = canUseLivingWeapon && !!w.livingWeapon
        const shared = livingWeapon ? livingWeaponEnhancements(c, entries, w) : w
        const canUseVerdantWeapon = canBeVerdantWeapon(c, entries, w)
        const plate = w.id === GAUNTLET.id ? gauntlet?.armor : undefined
        const automatic = hasAutomaticWeaponFundamentals(c, entries, w) ? automaticWeaponFundamentals(c.level) : { potency: 0, striking: 0 }
        const freeShifting = livingWeapon || inheritedLivingWeapon && enhanced.runes.some(rune => runeName(rune) === 'Shifting')
        const blessed = strengthSource ? undefined : blessedArmamentRune(c, entries, { ...enhanced, runes: unarmed ? handwraps?.runes ?? []
          : livingWeapon ? livingWeaponRunes({ ...w, ...shared }) : haft ? enhanced.runes : w.runes })
        const freeRunes = [...(freeShifting ? [{ name: 'Shifting', source: 'Granted by Living Weapon' }] : []),
          ...(blessed ? [{ name: blessed, source: 'Granted by Blessed Armament' }] : [])]
        const damageDice = /^(\d+)d/.exec(a.damage)?.[1]
        const damageRunes = enhanced.runes.filter((rune) => !['Animated', 'Fearsome', 'Fearsome (Greater)', 'Ghost Touch', 'Grievous', 'Hooked', 'Keen', 'Returning', 'Shifting', 'Crushing', 'Crushing (Greater)'].includes(runeName(rune))).sort((x, y) => x.localeCompare(y))
          .map((rune) => {
            const source = runeName(rune)
            const note = source === 'Holy' ? 'Holy: 2d4 spirit instead against unholy targets.'
              : source === 'Unholy' ? 'Unholy: 2d4 spirit instead against holy targets.'
                : source === 'Astral (Greater)' ? 'Greater Astral: spirit damage ignores spirit resistance.' : undefined
            const value = /^(?:Greater )?Impactful(?: \(Greater\))?$/.test(rune) ? '1d6 force'
              : /^Astral(?: \(Greater\))?$/.test(source) ? '1d6 spirit'
                : source === 'Holy' || source === 'Unholy' ? '1d4 spirit'
                  : rune === 'Shockwave' ? damageDice ? `${damageDice} bludgeoning splash` : 'bludgeoning splash equal to weapon damage dice'
                    : rune
            return { source, note, value: value.replace(/\b(bludgeoning|piercing|slashing)\b/gi, (type) => type[0].toUpperCase()) }
          })
        const pristineNote = a.pristineLivingWeapon
          ? 'Pristine Living Weapon: treated as cold iron and silver. Critical hit against a creature with a weakness to cold iron or silver: 1d6 persistent bleed.'
          : undefined
        const compactDamage = a.damage.replace(/\b(bludgeoning|piercing|slashing)\b/gi, (type) => type[0].toUpperCase())
        const crushing = enhanced.runes.some((rune) => runeName(rune) === 'Crushing (Greater)') ? 2 : enhanced.runes.includes('Crushing') ? 1 : 0
        return (
          <details key={w.id} className="gear-card" aria-label={displayName} open={!c.collapsedWeaponIds?.includes(w.id)} onToggle={event => {
            if (event.target !== event.currentTarget) return
            const collapsed = c.collapsedWeaponIds ?? []
            if (event.currentTarget.open === !collapsed.includes(w.id)) return
            save({ collapsedWeaponIds: event.currentTarget.open ? collapsed.filter(id => id !== w.id) : [...collapsed, w.id] })
          }}>
            <summary><strong>{displayName}</strong> <small>Attack {signed(a.attack)}{a.damage && <>, Damage {compactDamage}{pristineNote
              && <SourceNote source="Pristine Living Weapon" note={pristineNote} />}{damageRunes.length > 0 && ' + '}{damageRunes.map((rune, index) =>
              <Fragment key={`${rune.source}:${index}`}>{index > 0 && ', '}{rune.value}{rune.note
                && <SourceNote source={rune.source} note={rune.note} />}</Fragment>)}</>}</small></summary>
            {gauntlet && w.id === GAUNTLET.id && <label>Armor gauntlet{' '}
              <select aria-label="Armor gauntlet" value={gauntlet.name} onChange={(e) => {
                const choice = ARMOR_GAUNTLETS.find((name) => name === e.target.value)
                if (choice) save({ armors: ownedArmors(c, entries).map((armor) => armor.id === gauntlet.armor.id ? { ...armor, gauntlet: choice } : armor) })
              }}>
                {[...ARMOR_GAUNTLETS].sort((a, b) => a.localeCompare(b)).map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>}
            {a.entry?.description && <Info label="Summary">{a.entry.description}</Info>}
            {a.entry && <GearAccess c={c} entries={entries} entry={a.entry} save={save} />}
            {a.traits.length > 0 && <GearTraits traits={a.traits} entries={entries} system={a.entry?.systems[0]} />}
            <div className="gear-stats">
              <span><small>Attack</small><b>{signed(a.attack)}</b></span>
              {a.range > 0 && <span><small>Range</small><b>{a.range} feet</b></span>}
              <span><small>{a.ability === 'dex' ? 'Dexterity' : 'Strength'}</small>{signed(a.mod)}</span>
              <span><small>Proficiency</small>{signed(a.prof)}</span>
              <span><small>Item</small>{signed(a.item)}</span>
            </div>
            {!!crushing && <small>{`Critical hit: clumsy ${crushing} and enfeebled ${crushing} until the end of your next turn.`}</small>}
            {strength && <>
              <small>Critical hit: 1d6 persistent bleed (Animal Strength).</small>
                <SearchableSelect aria-label={`Animal Strength runes: ${displayName}`} value={strengthSelection ?? c.animalStrengthWeapons?.[w.id] ?? ''} onChange={event => {
                  if (event.target.value && !strengthSources.some(source => source.weapon.id === event.target.value)) return
                  const sources = { ...c.animalStrengthWeapons }
                  if (event.target.value) sources[w.id] = event.target.value
                  else delete sources[w.id]
                  save({ animalStrengthWeapons: sources })
                }}>
                  {c.animalStrengthWeapons?.[w.id] && !strengthSource
                    && <option disabled value={c.animalStrengthWeapons[w.id]}>Saved weapon unavailable</option>}
                  {strengthOptions.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
                </SearchableSelect>
              {c.animalStrengthWeapons?.[w.id] && !strengthSource
                && <small role="status">Saved Animal Strength weapon unavailable; normal unarmed runes apply. Choose another carried weapon.</small>}
            </>}
            {enhanced.runes.includes('Shockwave') && <small>Shockwave splash does not harm you.</small>}
            {haft && <>
              {canBeLivingWeapon(c, entries, haft) && <label>
                <input type="checkbox" aria-label={`Living Weapon: inherited from ${haft.name}`}
                  checked={inheritedLivingWeapon} disabled /> Living Weapon
              </label>}
              {haftStrikerWeapons(c, entries).length > 1 && <span>Haft weapon{' '}
                <SearchableSelect aria-label="Haft weapon" value={haft.id} onChange={(e) => save({ haftStrikerWeaponId: e.target.value })}>
                  {haftStrikerWeapons(c, entries).map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
                </SearchableSelect>
              </span>}
            </>}
            {favored?.id === w.id && <small>Favored weapon of {c.deity}; fundamental runes scale with character level.</small>}
            {unarmed && enhanced.material && <div className="gear-runes">
              <span>Material</span><Material name={enhanced.material} entries={entries} equipment="Weapon" source="Granted by Cold Iron Tusks" />
            </div>}
            {fixed ? <small>Temporary thrown object; materials, runes, and enhancements cannot be changed.</small>
              : haft ? null
              : unarmed ? null : <div className="row">
              {enhanced.material ? <div className="gear-runes"><span>Material{pristineNote
                && <SourceNote source="Pristine Living Weapon" note={pristineNote} />}</span>
                <Material name={enhanced.material} entries={entries} equipment={plate ? 'Armor' : 'Weapon'}
                  source={plate ? `Inherited from ${plate.name}` : livingWeapon ? 'Granted by Living Weapon' : 'Granted by Verdant Weapon'}
                  onRemove={livingWeapon || plate || w.verdantWeapon && canUseVerdantWeapon ? undefined : () =>
                    update(w.id, { material: undefined, runes: w.runes.slice(0, maxPropertyRunes(enhanced.potency)) })} />
              </div> : plate ? <small>Material: Standard (from {plate.name})</small> : <span>Material{' '}
                <SearchableSelect aria-label="Weapon material" value="" onChange={(e) => {
                  const material = WEAPON_MATERIALS.find((name) => name === e.target.value)
                  if (!material) return
                  update(w.id, { material, runes: w.runes.slice(0, maxPropertyRunes(enhanced.potency, material)) })
                }}>
                  <option value="">Add material...</option>
                  {WEAPON_MATERIALS.map((name) => <option key={name}>{name}</option>)}
                </SearchableSelect>
              </span>}
              {canUseLivingWeapon && <label><input type="checkbox" aria-label="Living Weapon: grant Shifting rune" checked={!!w.livingWeapon}
                onChange={(e) => update(w.id, { livingWeapon: e.target.checked })} /> Living Weapon</label>}
              <Level label="Potency" value={enhanced.potency} options={POTENCY} disabled={!!plate} minimum={plate ? 0 : automatic.potency} format={(n) => (n ? `+${n}` : 'None')}
                onChange={(potency) => update(w.id, { potency, runes: shared.runes.slice(0, maxPropertyRunes(potency, enhanced.material)) })} />
              <Level label="Striking" value={enhanced.striking} options={POTENCY} disabled={!!plate} minimum={plate ? 0 : automatic.striking} format={(n) => STRIKING_LABEL[n] || 'None'}
                onChange={(striking) => update(w.id, { striking })} />
            </div>}
            {!fixed && <Runes runes={livingWeapon ? shared.runes.filter((rune) => runeName(rune) !== 'Shifting').slice(0, maxPropertyRunes(shared.potency))
              : enhanced.runes.filter((rune) => rune !== blessed && (!freeShifting || rune !== 'Shifting'))}
              entries={entries} options={unarmed || haft ? [] : eligibleWeaponRunes(entries, { ...w, runes: [...shared.runes, ...enhanced.runes] }).filter((rune) => !freeShifting || rune.name !== 'Shifting')}
              limit={maxPropertyRunes(enhanced.potency, enhanced.material)} freeRunes={freeRunes}
              source={strengthSource ? `Animal Strength: ${strengthSource.name}` : haft ? `Inherited from ${haft.name}` : inherited ? `Inherited from ${handwrapItem.name}` : undefined}
              onChange={unarmed || haft ? undefined : (runes) => update(w.id, { runes })} />}
            <div className="row">
              {canUseVerdantWeapon && <label><input type="checkbox" aria-label={`Verdant Weapon: ${w.name}`} checked={!!w.verdantWeapon}
                onChange={(e) => saveWeapons(weapons.map((weapon) => ({ ...weapon, verdantWeapon: weapon.id === w.id && e.target.checked })))} /> Verdant Weapon</label>}
              {!isLockedWeapon(c, w.name, entries, w.id) && <button type="button" className="spell-remove" aria-label={`Remove ${w.name}`} title="Remove"
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
  const attached = armors.map(armor => armorEntry(c, entries, armor.name)).find(entry => entry?.data.attached)
  const saveArmors = (next: OwnedArmor[]) => save({ armors: [
    ...(c.armors ?? []).filter(armor => isGrantedArmor(armor.id) && !armors.some(current => current.id === armor.id)),
    ...next.map(armor => !canWearWithAttachedArmor(armor, attached)
      ? { ...armor, worn: c.armors?.find(saved => saved.id === armor.id)?.worn ?? armor.worn } : armor),
  ] })
  const update = (id: string, patch: Partial<OwnedArmor>) => saveArmors(armors.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const shield = c.shield
  return (
    <div className="col gear-list">
      <Search c={c} save={save} entries={entries} kind="armor" label="Add Armor"
        onPick={(e) => saveArmors([...armors, { id: newId(), name: e.name, potency: 0, resilient: 0, runes: [], worn: !armors.some((a) => a.worn) }])} />
      {[...armors].sort((x, y) => x.name.localeCompare(y.name)).map((a) => {
        const entry = armorEntry(c, entries, a.name)
        const body = !!entry?.data.attached
        const wornLocked = body || !canWearWithAttachedArmor(a, attached)
        const runesAllowed = entry?.data.runes_allowed !== false
        const granted = isGrantedArmor(a.id)
        const starfinder = granted && entry?.systems.includes('sf2e') ? entry : undefined
        const runePotency = starfinder ? Number(starfinder.data.grade_ac_bonus) : a.potency
        const automatic = granted ? automaticArmorFundamentals(c.level, entry) : { potency: 0, resilient: 0 }
        return (
          <article key={a.id} className="gear-card">
            <header className="row">
              <strong>{armorDisplayName(a)}</strong>
              <label><input type="checkbox" aria-label={`Worn ${a.name}`} checked={a.worn} disabled={wornLocked}
                title={body ? 'Attached to character' : wornLocked ? 'Cannot wear armor over attached body armor' : undefined}
                onChange={(e) => {
                  if (wornLocked) return
                  saveArmors(armors.map((x) => ({ ...x, worn: x.id === a.id ? e.target.checked : attached ? x.worn : e.target.checked ? false : x.worn })))
                }} /> Worn</label>
            </header>
            {a.id === INVENTOR_ARMOR_ID && <SearchableSelect label="Innovation armor" aria-label="Inventor armor suit" value={a.name}
              onChange={event => {
                const suit = INVENTOR_SUITS.find(name => name === event.target.value)
                if (suit) save({ inventorArmorSuit: suit })
              }}>
              {INVENTOR_SUITS.map(name => <option key={name}>{name}</option>)}
            </SearchableSelect>}
            {entry?.description && <Info label="Summary">{entry.description}</Info>}
            {starfinder && <small>Grade: {String(starfinder.data.armor_grade)} (automatic)</small>}
            {Number(entry?.data.upgrade_slots) > 0 && <small>Armor upgrade slots: {Number(entry?.data.upgrade_slots)}. Track installed upgrades separately.</small>}
            {entry?.data.upgrades_allowed === false && <small>Armor upgrades cannot be installed on this armor.</small>}
            {entry && <GearAccess c={c} entries={entries} entry={entry} save={save} />}
            {entry && entry.traits.length > 0 && <GearTraits traits={entry.traits} entries={entries} system={entry.systems[0]} />}
            {entry && (
              <div className="gear-stats">
                <span><small>Armor Class</small><b>{String(entry.data.ac ?? '—')}</b></span>
                <span><small>Dexterity cap</small>{String(entry.data.dex_cap ?? '—')}</span>
                <span><small>Check</small>{String(entry.data.check_penalty ?? '—')}</span>
                <span><small>Strength</small>{String(entry.data.strength ?? '—')}</span>
                {granted && <span><small>Category</small>{String(entry.data.armor_category ?? '—')}</span>}
                {granted && <span><small>Group</small>{String(entry.data.armor_group || '—')}</span>}
                {granted && <span><small>Speed</small>{String(entry.data.speed_penalty ?? 0)}</span>}
                {starfinder && <span><small>Grade AC increase</small>+{Number(entry.data.grade_ac_bonus)}</span>}
                {starfinder && <span><small>Saving throws</small>+{Number(entry.data.grade_save_bonus)}</span>}
              </div>
            )}
            <div className="row">
              {a.material ? <div className="gear-runes"><span>Material</span>
                <Material name={a.material} entries={entries} equipment="Armor" source={body ? 'Attached to character' : 'Locked by Wood armor group'}
                  onRemove={body || isWoodArmor(entries, a) ? undefined : () =>
                    update(a.id, { material: undefined, runes: a.runes.slice(0, maxPropertyRunes(a.potency)) })} />
              </div> : body ? <span>Material: Attached</span> : <span>Material{' '}
                <SearchableSelect aria-label="Armor material" value="" onChange={(e) => {
                  if (isWoodArmor(entries, a)) return
                  const material = ARMOR_MATERIALS.find((name) => name === e.target.value)
                  if (!material) return
                  update(a.id, { material, runes: a.runes.slice(0, maxPropertyRunes(a.potency, material)) })
                }}>
                  <option value="">Add material...</option>
                  {ARMOR_MATERIALS.map((name) => <option key={name}>{name}</option>)}
                </SearchableSelect>
              </span>}
              {runesAllowed && !starfinder && <Level label="Potency" value={a.potency} options={POTENCY} minimum={automatic.potency} format={(n) => (n ? `+${n}` : 'None')}
                onChange={(potency) => update(a.id, { potency, runes: a.runes.slice(0, maxPropertyRunes(potency, a.material)) })} />}
              {runesAllowed && !starfinder && <Level label="Resilient" value={a.resilient} options={POTENCY} minimum={automatic.resilient} format={(n) => ['None', 'Resilient', 'Greater', 'Major'][n]}
                onChange={(resilient) => update(a.id, { resilient })} />}
            </div>
            {runesAllowed ? <Runes runes={a.runes} entries={entries} options={propertyRunes(entries, 'Armor')} limit={maxPropertyRunes(runePotency, a.material)} onChange={(runes) => update(a.id, { runes })} />
              : <small>Armor runes cannot be etched onto this shell.</small>}
            {!granted && <button type="button" className="spell-remove" aria-label={`Remove ${a.name}`} title="Remove"
              onClick={() => confirmRemoval(`armor "${a.name}"`, () => saveArmors(armors.filter((x) => x.id !== a.id)))}>×</button>}
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
        <Search c={c} save={save} entries={entries} kind="shield" label="Add Shield"
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
