import { EntryDescription } from './EntryDescription'
import { confirmRemoval } from './confirmRemoval'
import { useMemo, useState, type ReactNode } from 'react'
import { ABILITIES, ABILITY_LABEL, abilityMod, activeAnimalFeatures, canopyCrawlerAffects, canopyCrawlerTarget, classSpellcasting, companionSpellTarget, enlargeCompanionSize, focusSpells, isMagicHideActive, isSpellActive, magicHideChange, proficiencyBonus, signed, spellActiveChange, type SectionProps } from './builder'
import { ANIMAL_FEATURES } from './supplemental'
import type { Character, ContentEntry } from './types'
import { grantedWardenSpells, spellWardenLabel, wardenTierOf } from './featChoices'
import { ActionIcon } from './ActionIcon'
import { SpellDamageRolls } from './SpellDamage'
import { companionAdvancement, companionStats } from './companions'

const RANK_NAMES = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary']

export function AnimalFeatureOptions({ c, entries, save }: SectionProps) {
  const active = activeAnimalFeatures(c, entries)
  const multiple = c.feats.some((feat) => feat.name === 'Persistent Animal Feature')
  return <fieldset className="col">
    <legend>Animal Feature: {multiple ? 'choose effects' : 'choose one'}</legend>
    {ANIMAL_FEATURES.map((feature) => {
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

export function CompanionSpellOptions({ c, entries, save, name, companionId }: SectionProps & {
  name: 'Canopy Crawler' | 'Enlarge Companion'
  companionId?: string
}) {
  const canopy = name === 'Canopy Crawler'
  const targetId = companionSpellTarget(c, canopy ? c.canopyCrawlerCompanionId : c.enlargeCompanionId)
  const companion = c.companions?.find((companion) => companion.id === companionId)
  const selectedCompanion = c.companions?.find((companion) => companion.id === (companionId ?? targetId))
  const naturalSize = !canopy && selectedCompanion ? companionStats(c, entries, selectedCompanion.type,
    selectedCompanion.id === c.companions?.[0]?.id ? companionAdvancement(c) : undefined, selectedCompanion.id)?.naturalSize : undefined
  const tooLarge = naturalSize === 'Huge' || naturalSize === 'Gargantuan'
  const needsHuge = naturalSize === 'Large'
  const enlargeUnavailable = !canopy && (tooLarge || needsHuge && c.level < 7)
  const active = companionId === undefined ? isSpellActive(c, entries, name)
    : canopy ? canopyCrawlerAffects(c, entries, companionId) : isSpellActive(c, entries, name) && companionId === targetId
  const target = canopyCrawlerTarget(c)
  return <div className="row">
    <label title={tooLarge ? 'Enlarge Companion has no effect on Huge or larger companions.'
      : needsHuge && c.level < 7 ? 'Requires rank 4 (character level 7) to enlarge a Large companion.' : undefined}>
      <input type="checkbox" aria-label={`${name}${companionId ? ` on ${companion?.name || companion?.type || companionId}` : ' active'}`}
      disabled={c.level < 3 || enlargeUnavailable || canopy && !!companionId && target === 'Self'} checked={active && !enlargeUnavailable} onChange={(e) => {
        if (c.level < 3 || enlargeUnavailable || canopy && !!companionId && target === 'Self') return
        save({
          ...spellActiveChange(c, name, e.target.checked),
          ...(canopy ? { canopyCrawlerCompanionId: companionId ?? targetId }
            : { enlargeCompanionId: companionId ?? targetId }),
        })
      }} /> {companionId ? name : 'Active'}</label>
    {canopy ? null : tooLarge ? null : needsHuge ? <span>Size: Huge</span> : <label>Size{' '}
      <select aria-label="Enlarge Companion size" value={enlargeCompanionSize(c)} onChange={(e) => {
        if (e.target.value === 'Large' || e.target.value === 'Huge' && c.level >= 7) save({ enlargeCompanionSize: e.target.value })
      }}>
        <option>Large</option><option disabled={c.level < 7}>Huge</option>
      </select>
    </label>}
    {(c.companions?.length ?? 0) > 1 && (!canopy || target !== 'Self') && <label>Companion{' '}
      <select aria-label={`${name} companion`} value={targetId ?? ''} onChange={(e) => {
        if (c.companions?.some((companion) => companion.id === e.target.value))
          save(canopy ? { canopyCrawlerCompanionId: e.target.value } : { enlargeCompanionId: e.target.value })
      }}>
        {[...(c.companions ?? [])].sort((a, b) => (a.name || a.type).localeCompare(b.name || b.type))
          .map((companion) => <option key={companion.id} value={companion.id}>{companion.name || companion.type}</option>)}
      </select>
    </label>}
  </div>
}

function SpellItem({ name, entry, note, onRemove, active, onToggle, children }: {
  name: string; entry?: ContentEntry; note?: string; onRemove?: () => void
  active?: boolean; onToggle?: (active: boolean) => void
  children?: ReactNode
}) {
  return (
    <li className="spell-item">
      <div className="spell-name">
        <EntryDescription name={name} entry={entry} /> <ActionIcon entry={entry} />{note && <> <small>({note})</small></>}
        {children}
      </div>
      {onToggle && <label><input type="checkbox" aria-label={`${name} active`} checked={!!active}
        onChange={(e) => onToggle(e.target.checked)} /> Active</label>}
      {onRemove && <button type="button" className="spell-remove" aria-label={`Remove ${name}`} title="Remove"
        onClick={() => confirmRemoval(`spell "${name}"`, onRemove)}>×</button>}
    </li>
  )
}

export function SpellsSection({ c, entries, save }: SectionProps) {
  const [tradition, setTradition] = useState(c.spellcasting?.tradition ?? '')
  const sc = c.spellcasting
  const casting = classSpellcasting(c, entries)
  const traditions = casting?.traditions ?? []
  const spells = c.spells ?? []
  const granted = grantedWardenSpells(c, entries)
  const { spells: focus, points: focusPoints } = focusSpells(c, entries)
  const buffProps = (name: string, entry?: ContentEntry) => {
    const duration = entry?.data.duration
    const timed = Number(duration) > 0 || typeof duration === 'string' && /\b(?:round|minute|hour|day|sustain|unlimited)/i.test(duration)
    if (['Animal Feature', 'Canopy Crawler', 'Enlarge Companion', "Ranger's Bramble", 'Ephemeral Tracking', "Hunter's Vision"].includes(name) || name !== 'Magic Hide' && !timed) return {}
    return {
      active: name === 'Magic Hide' ? isMagicHideActive(c, entries) : c.activeSpells?.includes(name),
      onToggle: (active: boolean) => save(name === 'Magic Hide' ? magicHideChange(c, active) : {
        activeSpells: [...(c.activeSpells ?? []).filter((spell) => spell !== name), ...(active ? [name] : [])],
      }),
    }
  }
  const controls = (name: string) => <>
    {name === 'Animal Feature' ? <AnimalFeatureOptions c={c} entries={entries} save={save} />
      : name === 'Canopy Crawler' || name === 'Enlarge Companion' ? <CompanionSpellOptions c={c} entries={entries} save={save} name={name} /> : null}
    <SpellDamageRolls name={name} rank={Math.ceil(c.level / 2)} />
  </>
  const manualSpells = spells.filter((s) => !granted.some((g) => g.id === s.entryId || g.name === s.name))
  const setSc = (patch: Partial<NonNullable<Character['spellcasting']>>) => {
    if (!casting) return
    save({ spellcasting: { ability: 'int', tradition: traditions[0] ?? '', slots: {}, ...sc, ...patch, rank: casting.rank, ...(casting.ability ? { ability: casting.ability } : {}) } })
  }
  const selectedTradition = traditions.length === 1
    ? traditions[0]
    : traditions.includes(tradition) ? tradition : ''

  const matches = useMemo(() => {
    if (!selectedTradition) return []
    return entries
      .filter((e) => e.kind === 'spell')
      .filter((e) => !selectedTradition || String(e.data.tradition ?? '').toLowerCase().includes(selectedTradition.toLowerCase()))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .slice(0, 40)
  }, [entries, selectedTradition])

  const castAbility = casting?.ability ?? sc?.ability
  const mod = casting && castAbility ? abilityMod(c.abilities[castAbility]) + proficiencyBonus(casting.rank, c.level) : 0
  const groupLabel = (name: string, entryId: string | undefined, rank: number, cantrip: boolean) => {
    const entry = entries.find((e) => e.kind === 'spell' && (entryId ? e.id === entryId : e.name === name))
    return spellWardenLabel(entry?.data.warden_spell_tier) ?? (cantrip ? 'Cantrips' : `Rank ${rank}`)
  }
  const listedSpells = [
    ...granted.map((s) => ({ name: s.name, entryId: s.id, group: spellWardenLabel(wardenTierOf(s)) ?? `Rank ${s.level}`, index: -1 })),
    ...spells.flatMap((s, index) => manualSpells.includes(s) ? [{ name: s.name, entryId: s.entryId, group: groupLabel(s.name, s.entryId, s.rank, s.cantrip), index }] : []),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const groupOrder = ['Cantrips', ...Array.from({ length: 10 }, (_, i) => `Rank ${i + 1}`),
    'Initiate Warden', 'Advanced Warden', 'Master Warden', 'Peerless Warden']
  const groups = [...new Set(listedSpells.map((s) => s.group))]
    .sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b))

  return (
    <details className="character-section">
      <summary className="character-section-summary">
        <strong>Spells</strong>
        <span>{manualSpells.length + granted.length + focus.length} spells</span>
      </summary>
      <div className="character-section-content">
      {casting && <>
      <div className="row">
        {!casting.ability && <label>Casting ability{' '}
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
        {traditions.length === 1 && <b>{traditions[0]} tradition</b>}
      </div>
      {(sc || casting.ability) && (
        <div className="skill-row with-item spell-dc-row">
          <span className="skill-name">DC {10 + mod} <small>(Attack {signed(mod)})</small></span>
          <span className="rank-dots" role="img" aria-label={`Spellcasting proficiency: ${RANK_NAMES[casting.rank]}`} title={RANK_NAMES[casting.rank]}>
            {['T', 'E', 'M', 'L'].map((letter, i) => <button key={letter} type="button" tabIndex={-1} disabled className={casting.rank >= i + 1 ? 'on' : ''}>{letter}</button>)}
          </span>
          <span className="skill-part"><small>{castAbility ? ABILITY_LABEL[castAbility] : ''}</small>{signed(castAbility ? abilityMod(c.abilities[castAbility]) : 0)}</span>
          <span className="skill-part"><small>Prof</small>{signed(proficiencyBonus(casting.rank, c.level))}</span>
          <span className="skill-part"><small>Item</small>{signed(0)}</span>
        </div>
      )}
      {sc && traditions.length > 0 && (
        <div className="row">
          <small>Slots per rank:</small>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
            <label key={r}>{r}{' '}
              <input type="number" min={0} style={{ width: '3.5em' }} value={sc.slots[r] ?? 0}
                onChange={(e) => setSc({ slots: { ...sc.slots, [r]: Math.max(0, +e.target.value || 0) } })} />
            </label>
          ))}
        </div>
      )}
      </>}
      {focus.length > 0 && (
        <div>
          <b>Focus Spells</b> <small>(Focus Points: {focusPoints})</small>
          <ul>
            {focus.map((s) => {
              const entry = entries.find((e) => e.kind === 'spell' && e.name === s.name)
              return <SpellItem key={s.name} entry={entry} name={s.name} note={s.source} {...buffProps(s.name, entry)}>
                {controls(s.name)}
              </SpellItem>
            })}
          </ul>
        </div>
      )}
      {groups.map((g) => (
        <div key={g}>
          <b>{g}</b>
          <ul>
            {listedSpells.filter((s) => s.group === g).map((s) => {
              const entry = entries.find((entry) => entry.kind === 'spell' && (s.entryId ? entry.id === s.entryId : entry.name === s.name))
              return <SpellItem key={`${s.name}-${s.index}`} name={s.name} entry={entry} {...buffProps(s.name, entry)}
                onRemove={s.index >= 0 ? () => save({ spells: spells.filter((_, j) => j !== s.index),
                  activeSpells: c.activeSpells?.filter((name) => name !== s.name) }) : undefined}>
                {controls(s.name)}
              </SpellItem>
            })}
          </ul>
        </div>
      ))}
      <div className="row">
        {casting && traditions.length > 0 && <select aria-label="Filter spells by tradition" value={tradition} onChange={(e) => setTradition(e.target.value)}>
          <option value="">Any tradition</option>
          {traditions.map((t) => <option key={t}>{t}</option>)}
        </select>}
      </div>
      <ul>
        {matches.map((m) => {
          const cantrip = m.traits.some((t) => t.toLowerCase() === 'cantrip')
          const have = spells.some((s) => s.entryId === m.id) || granted.some((s) => s.id === m.id)
          return (
            <li key={m.id}>
              <EntryDescription name={m.name} entry={m} /> <ActionIcon entry={m} showOther /> ({cantrip ? 'cantrip' : `rank ${m.level}`}) {spellWardenLabel(m.data.warden_spell_tier) && (
                <small>({spellWardenLabel(m.data.warden_spell_tier)})</small>
              )} {m.data.tradition ?? ''}{' '}
              <button disabled={have} onClick={() => save({ spells: [...spells, { name: m.name, rank: m.level, cantrip, entryId: m.id }] })}>
                {have ? 'Added' : 'Add'}
              </button>
            </li>
          )
        })}
      </ul>
      </div>
    </details>
  )
}
